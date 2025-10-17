/**
 * PLC Ladder Diagram Simulation Engine
 * Handles logic execution, state management, and power flow calculation
 */

class PLCSimulation {
    constructor() {
        this.isRunning = false;
        this.pinStates = {}; // Stores current state of all I/O pins
        this.wireStates = {}; // Stores energized state of wires at each grid position
        this.componentStates = {}; // Stores state of each component
    }

    /**
     * Initialize pin states from pins configuration
     */
    initializePins(inputPins, outputPins) {
        // Initialize all inputs to false (OFF)
        inputPins.forEach(pin => {
            this.pinStates[pin.address] = false;
        });

        // Initialize all outputs to false (OFF)
        outputPins.forEach(pin => {
            this.pinStates[pin.address] = false;
        });
    }

    /**
     * Start the simulation
     */
    start() {
        this.isRunning = true;
        console.log('Simulation started');
        this.executeScanCycle(); // Execute once immediately
    }

    /**
     * Stop the simulation
     */
    stop() {
        this.isRunning = false;
        
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }
        
        // Reset all outputs
        Object.keys(this.pinStates).forEach(address => {
            if (address.startsWith('O:')) {
                this.pinStates[address] = false;
            }
        });
        
        // Clear wire states
        this.wireStates = {};
        this.componentStates = {};
        
        console.log('Simulation stopped');
    }

    /**
     * Reset simulation - stop and clear all states
     */
    reset() {
        this.stop();
        // Reset all pin states
        Object.keys(this.pinStates).forEach(address => {
            this.pinStates[address] = false;
        });
        console.log('Simulation reset');
    }

    /**
     * Toggle an input pin state and execute scan immediately
     */
    toggleInput(address) {
        if (address.startsWith('I:') || address.startsWith('O:')) {
            this.pinStates[address] = !this.pinStates[address];
            console.log(`Pin ${address} toggled to ${this.pinStates[address]}`);
            
            // Execute scan immediately if simulation is running
            if (this.isRunning) {
                this.executeScanCycle();
            }
            
            return this.pinStates[address];
        }
        return false;
    }

    /**
     * Set input pin state directly and execute scan
     */
    setInput(address, state) {
        if (address.startsWith('I:') || address.startsWith('O:')) {
            this.pinStates[address] = state;
            console.log(`Pin ${address} set to ${state}`);
            
            // Execute scan immediately if simulation is running
            if (this.isRunning) {
                this.executeScanCycle();
            }
        }
    }

    /**
     * Get pin state
     */
    getPinState(address) {
        return this.pinStates[address] || false;
    }

    /**
     * Execute one scan cycle
     * Iterates multiple times to handle feedback loops until stable
     */
    executeScanCycle() {
        const MAX_ITERATIONS = 10; // Prevent infinite loops
        let iterations = 0;
        let stateChanged = true;
        
        // Store previous states to detect changes
        let previousOutputStates = {};
        
        while (stateChanged && iterations < MAX_ITERATIONS) {
            iterations++;
            
            // Save current output states
            previousOutputStates = {};
            Object.keys(this.pinStates).forEach(address => {
                if (address.startsWith('O:')) {
                    previousOutputStates[address] = this.pinStates[address];
                }
            });
            
            // Clear wire and component states for this scan
            this.wireStates = {};
            this.componentStates = {};
            
            // Clear all output states before scan (they'll be set by energized coils)
            Object.keys(this.pinStates).forEach(address => {
                if (address.startsWith('O:')) {
                    this.pinStates[address] = false;
                }
            });
            
            // Mark leftmost wires as energized for all connected branches
            this.initializeBranchPower();
            
            // Execute ladder logic
            this.evaluateLadder();
            
            // Check if any output state changed
            stateChanged = false;
            Object.keys(this.pinStates).forEach(address => {
                if (address.startsWith('O:')) {
                    if (this.pinStates[address] !== previousOutputStates[address]) {
                        stateChanged = true;
                    }
                }
            });
        }
        
        console.log(`Scan completed in ${iterations} iteration(s)`);
        
        // Trigger redraw
        if (window.drawLadder) {
            window.drawLadder();
        }
    }

    /**
     * Initialize power on all branches connected to the left rail
     * All rows connected via vertical lines get power from the left rail
     */
    initializeBranchPower() {
        if (!window.grid || !window.ROWS || !window.COLS) {
            return;
        }

        const grid = window.grid;
        const ROWS = window.ROWS;
        const COLS = window.COLS;

        // For each row, find where it gets power from (via VLINE connections)
        const rowPowerColumns = new Map(); // Map<row, Set<columns>>
        rowPowerColumns.set(0, new Set([0])); // Row 0 gets power from left rail

        // Find all VLINE connections and track power sources
        for (let row = 0; row < ROWS - 1; row++) {
            for (let col = 0; col < COLS; col++) {
                const cell = grid[row][col];
                
                // If there's a VLINE or BOTH connecting rows
                if (cell && (cell.type === 'VLINE' || cell.type === 'BOTH')) {
                    const nextRow = row + 1;
                    if (!rowPowerColumns.has(nextRow)) {
                        rowPowerColumns.set(nextRow, new Set());
                    }
                    // The next row gets power from this column
                    rowPowerColumns.get(nextRow).add(col);
                }
            }
        }

        // Now energize wires in each powered row
        for (const [row, powerCols] of rowPowerColumns.entries()) {
            if (row === 0) {
                // Main rung - energize from left to first component
                for (let col = 0; col < COLS; col++) {
                    const cell = grid[row][col];
                    const cellKey = `${row}-${col}`;
                    
                    if (!cell || cell.type === 'HLINE' || cell.type === 'VLINE' || cell.type === 'BOTH') {
                        this.wireStates[cellKey] = true;
                    } else {
                        break; // Stop at first component
                    }
                }
            } else {
                // Branch rows - energize from each power source column
                for (const col of powerCols) {
                    // Find the leftmost position with an HLINE in this row
                    let startCol = 0;
                    for (let c = 0; c < COLS; c++) {
                        const cell = grid[row][c];
                        if (cell && (cell.type === 'HLINE' || cell.type === 'BOTH' || 
                                    cell.type === 'NO' || cell.type === 'NC' || cell.type === 'OUT')) {
                            startCol = c;
                            break;
                        }
                    }
                    
                    // Energize from startCol to first component
                    for (let c = startCol; c < COLS; c++) {
                        const cell = grid[row][c];
                        const cellKey = `${row}-${c}`;
                        
                        if (!cell || cell.type === 'HLINE' || cell.type === 'VLINE' || cell.type === 'BOTH') {
                            this.wireStates[cellKey] = true;
                        } else if (cell.type === 'NO' || cell.type === 'NC' || cell.type === 'OUT') {
                            break; // Stop at first component
                        }
                    }
                }
            }
        }
    }

    /**
     * Evaluate the entire ladder diagram
     * Ladder logic: scan left to right, evaluate series (AND) and parallel (OR) paths
     */
    evaluateLadder() {
        if (!window.grid || !window.ROWS || !window.COLS) {
            console.error('Grid not available');
            return;
        }

        const grid = window.grid;
        const ROWS = window.ROWS;
        const COLS = window.COLS;

        // Process each column from left to right
        for (let col = 0; col < COLS; col++) {
            // For each column, evaluate all rows together (parallel paths = OR)
            const columnHasPower = this.evaluateColumn(grid, col, ROWS);
            
            // Store result for this column
            for (let row = 0; row < ROWS; row++) {
                const cellKey = `${row}-${col}`;
                this.wireStates[cellKey] = columnHasPower[row];
            }
        }
    }

    /**
     * Evaluate a single column (all rows in parallel)
     * Returns array of power states for each row in this column
     */
    evaluateColumn(grid, col, rows) {
        const columnPower = [];
        
        for (let row = 0; row < rows; row++) {
            let hasPower = false;
            
            if (col === 0) {
                // First column - all rows connected to left rail start with power
                // UNLESS there's a blocking component at column 0
                hasPower = true;
                
                // However, branches need to verify they're actually connected
                if (row > 0) {
                    // Check if this branch is connected to a powered row via VLINE
                    hasPower = this.isConnectedToLeftRail(grid, row, col, rows);
                }
            } else {
                // Get power from previous column
                const prevKey = `${row}-${col-1}`;
                hasPower = this.wireStates[prevKey] || false;
                
                // Check if power comes from vertical lines (branches)
                hasPower = hasPower || this.checkVerticalPower(grid, row, col);
            }
            
            // Evaluate the component at this cell
            if (hasPower) {
                hasPower = this.evaluateCell(grid, row, col);
            }
            
            columnPower[row] = hasPower;
        }
        
        // Handle parallel paths (OR logic) - if any row has power, merge points get power
        this.handleParallelPaths(grid, col, rows, columnPower);
        
        return columnPower;
    }
    
    /**
     * Check if a branch row is connected to the left rail via vertical lines
     * Look for any VLINE/BOTH that connects this row to a powered row (like row 0)
     */
    isConnectedToLeftRail(grid, targetRow, col, rows) {
        if (targetRow === 0) return true; // Row 0 always connected
        
        // Check all columns from 0 up to current col for vertical connections
        for (let checkCol = 0; checkCol <= col; checkCol++) {
            // Check if there's a vertical line connecting this row to a powered row above
            for (let r = 0; r < targetRow; r++) {
                const cell = grid[r][checkCol];
                if (cell && (cell.type === 'VLINE' || cell.type === 'BOTH')) {
                    // Found a vertical connection at row r, column checkCol
                    // Check if it connects down to targetRow
                    let connected = true;
                    for (let checkR = r; checkR < targetRow; checkR++) {
                        const checkCell = grid[checkR][checkCol];
                        if (!checkCell || (checkCell.type !== 'VLINE' && checkCell.type !== 'BOTH')) {
                            connected = false;
                            break;
                        }
                    }
                    if (connected) return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Check if two rows are connected vertically at a given column
     */
    isConnectedVertically(grid, fromRow, toRow, col) {
        if (fromRow === toRow) return true;
        if (fromRow > toRow) return false; // Only check downward
        
        // Check if there's a continuous path of VLINE/BOTH from fromRow to toRow
        for (let r = fromRow; r < toRow; r++) {
            const cell = grid[r][col];
            if (!cell || (cell.type !== 'VLINE' && cell.type !== 'BOTH')) {
                return false;
            }
        }
        return true;
    }
    
    /**
     * Check if a given row traces back to row 0 via vertical lines
     */
    tracesToMainRung(grid, startRow, maxCol, rows) {
        if (startRow === 0) return true;
        
        // Simple check: if any vertical line in previous columns connects to row 0
        for (let col = 0; col <= maxCol; col++) {
            for (let r = 0; r < startRow; r++) {
                const cell = grid[r][col];
                if (cell && (cell.type === 'VLINE' || cell.type === 'BOTH')) {
                    if (r === 0) return true;
                }
            }
        }
        return false;
    }
    
    /**
     * Check if power comes from vertical lines above or below
     */
    checkVerticalPower(grid, row, col) {
        // Check if previous column has vertical line connecting to this row
        if (col > 0) {
            // Check row above
            if (row > 0) {
                const cellAbove = grid[row - 1][col - 1];
                if (cellAbove && (cellAbove.type === 'VLINE' || cellAbove.type === 'BOTH')) {
                    const prevKey = `${row-1}-${col-1}`;
                    if (this.wireStates[prevKey]) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    /**
     * Handle parallel paths - vertical connections create OR logic
     */
    handleParallelPaths(grid, col, rows, columnPower) {
        // Check for vertical lines in this column
        for (let row = 0; row < rows - 1; row++) {
            const cell = grid[row][col];
            if (cell && (cell.type === 'VLINE' || cell.type === 'BOTH')) {
                // If this row has power, give power to next row
                if (columnPower[row]) {
                    columnPower[row + 1] = true;
                }
                // If next row has power, give power to this row (OR)
                if (columnPower[row + 1]) {
                    columnPower[row] = true;
                }
            }
        }
    }
    
    /**
     * Evaluate a single cell and return if power passes through
     */
    evaluateCell(grid, row, col) {
        const cell = grid[row][col];
        const cellKey = `${row}-${col}`;
        
        if (!cell) {
            // Empty cell with HLINE or part of main rung
            if (row === 0) {
                return true; // Main rung always conducts
            }
            // Check if there's an HLINE
            return false; // Branch without HLINE blocks power
        }
        
        switch (cell.type) {
            case 'HLINE':
            case 'BOTH':
                // Horizontal line conducts power
                return true;
                
            case 'VLINE':
                // Vertical line doesn't block horizontal power on main rung
                if (row === 0) return true;
                return false;
                
            case 'NO':
                // Normally Open - conducts if input/output is ON
                const noInputState = this.getPinState(cell.address);
                // Component is "active" (green) when its input/output is ON
                // This works for both inputs and outputs (feedback)
                this.componentStates[cellKey] = noInputState;
                return noInputState; // Power passes through only if pin is ON
                
            case 'NC':
                // Normally Closed - conducts if input/output is OFF
                const ncInputState = this.getPinState(cell.address);
                const ncConducts = !ncInputState; // Conducts when pin is OFF
                // Component is "active" (green) when it's conducting (pin is OFF)
                // For feedback (outputs), it will be green when output is OFF
                this.componentStates[cellKey] = ncConducts;
                return ncConducts;
                
            case 'OUT':
                // Output coil - always passes power through, sets output state
                if (cell.address && cell.address.startsWith('O:')) {
                    // Output is energized if power reached it
                    this.pinStates[cell.address] = true;
                }
                this.componentStates[cellKey] = true;
                return true; // Coil always passes power through
                
            default:
                return true;
        }
    }

    /**
     * Check if a wire segment is energized
     */
    isWireEnergized(row, col) {
        const cellKey = `${row}-${col}`;
        return this.wireStates[cellKey] || false;
    }

    /**
     * Check if a component is active/energized
     */
    isComponentActive(row, col) {
        const cellKey = `${row}-${col}`;
        return this.componentStates[cellKey] || false;
    }
}

// Create global simulation instance
window.plcSimulation = new PLCSimulation();
