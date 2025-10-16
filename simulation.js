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
     */
    executeScanCycle() {
        // Clear wire and component states for this scan
        this.wireStates = {};
        this.componentStates = {};
        
        // Execute ladder logic
        this.evaluateLadder();
        
        // Trigger redraw
        if (window.drawLadder) {
            window.drawLadder();
        }
    }

    /**
     * Evaluate the entire ladder diagram
     */
    evaluateLadder() {
        if (!window.grid || !window.ROWS || !window.COLS) {
            console.error('Grid not available');
            return;
        }

        const grid = window.grid;
        const ROWS = window.ROWS;
        const COLS = window.COLS;

        // Process each rung (row 0 is main rung, others are branches)
        // Start with row 0 (main rung)
        this.evaluateRung(grid, 0, COLS);

        // Evaluate branches by finding vertical connections
        this.evaluateBranches(grid, ROWS, COLS);
    }

    /**
     * Evaluate a single rung
     */
    evaluateRung(grid, row, cols) {
        let powerState = true; // Power starts from left rail
        
        for (let col = 0; col < cols; col++) {
            const cell = grid[row][col];
            const cellKey = `${row}-${col}`;
            
            // Store wire state entering this cell
            this.wireStates[`${cellKey}-in`] = powerState;
            
            if (!cell) {
                // Empty cell - power continues if we have it
                this.wireStates[`${cellKey}-out`] = powerState;
                continue;
            }

            if (cell.type === 'HLINE' || cell.type === 'BOTH') {
                // Horizontal line - power passes through
                this.wireStates[`${cellKey}-out`] = powerState;
            } else if (cell.type === 'VLINE') {
                // Vertical line only - check if power comes from branches
                const branchPower = this.checkBranchPower(grid, row, col);
                powerState = powerState || branchPower;
                this.wireStates[`${cellKey}-out`] = powerState;
            } else if (cell.type === 'NO') {
                // Normally Open contact - passes power if pin is ON
                const pinState = this.getPinState(cell.address);
                const componentActive = powerState && pinState;
                this.componentStates[cellKey] = componentActive;
                powerState = powerState && pinState;
                this.wireStates[`${cellKey}-out`] = powerState;
            } else if (cell.type === 'NC') {
                // Normally Closed contact - passes power if pin is OFF
                const pinState = this.getPinState(cell.address);
                const componentActive = powerState && !pinState;
                this.componentStates[cellKey] = componentActive;
                powerState = powerState && !pinState;
                this.wireStates[`${cellKey}-out`] = powerState;
            } else if (cell.type === 'OUT') {
                // Output coil - energizes if power reaches it
                if (cell.address && cell.address.startsWith('O:')) {
                    this.pinStates[cell.address] = powerState;
                    this.componentStates[cellKey] = powerState;
                }
                this.wireStates[`${cellKey}-out`] = powerState;
            }
        }
    }

    /**
     * Evaluate branches (parallel paths)
     */
    evaluateBranches(grid, rows, cols) {
        // Find all vertical connections (VLINE or BOTH)
        for (let col = 0; col < cols; col++) {
            for (let row = 0; row < rows - 1; row++) {
                const cell = grid[row][col];
                
                if (cell && (cell.type === 'VLINE' || cell.type === 'BOTH')) {
                    // Check if power enters this vertical line
                    const cellKey = `${row}-${col}`;
                    const hasPower = this.wireStates[`${cellKey}-in`] || false;
                    
                    if (hasPower) {
                        // Power flows down to the next row
                        const nextRow = row + 1;
                        const nextCellKey = `${nextRow}-${col}`;
                        
                        // Mark that this branch starting point has power
                        this.wireStates[`${nextCellKey}-branch-start`] = true;
                        
                        // Evaluate the branch row from this point
                        this.evaluateBranchRow(grid, nextRow, col, cols);
                    }
                }
            }
        }
    }

    /**
     * Evaluate a branch row starting from a specific column
     */
    evaluateBranchRow(grid, row, startCol, cols) {
        let powerState = true; // Power comes from vertical line
        
        // Evaluate from startCol to the right
        for (let col = startCol; col < cols; col++) {
            const cell = grid[row][col];
            const cellKey = `${row}-${col}`;
            
            // Store wire state
            this.wireStates[`${cellKey}-in`] = powerState;
            
            if (!cell) {
                this.wireStates[`${cellKey}-out`] = powerState;
                continue;
            }

            if (cell.type === 'HLINE' || cell.type === 'BOTH') {
                this.wireStates[`${cellKey}-out`] = powerState;
            } else if (cell.type === 'VLINE') {
                // Check if this connects back to upper row
                const upperCell = grid[row - 1] ? grid[row - 1][col] : null;
                if (upperCell && powerState) {
                    // Contribute power back to the upper row
                    const upperCellKey = `${row - 1}-${col}`;
                    const currentUpperPower = this.wireStates[`${upperCellKey}-out`] || false;
                    this.wireStates[`${upperCellKey}-out`] = currentUpperPower || powerState;
                }
                this.wireStates[`${cellKey}-out`] = powerState;
            } else if (cell.type === 'NO') {
                const pinState = this.getPinState(cell.address);
                const componentActive = powerState && pinState;
                this.componentStates[cellKey] = componentActive;
                powerState = powerState && pinState;
                this.wireStates[`${cellKey}-out`] = powerState;
            } else if (cell.type === 'NC') {
                const pinState = this.getPinState(cell.address);
                const componentActive = powerState && !pinState;
                this.componentStates[cellKey] = componentActive;
                powerState = powerState && !pinState;
                this.wireStates[`${cellKey}-out`] = powerState;
            } else if (cell.type === 'OUT') {
                if (cell.address && cell.address.startsWith('O:')) {
                    // OR with existing output state (for parallel branches)
                    const currentState = this.pinStates[cell.address] || false;
                    this.pinStates[cell.address] = currentState || powerState;
                    this.componentStates[cellKey] = powerState;
                }
                this.wireStates[`${cellKey}-out`] = powerState;
            }
        }
        
        // Also evaluate from startCol to the left (in case branch extends left)
        powerState = true;
        for (let col = startCol - 1; col >= 0; col--) {
            const cell = grid[row][col];
            const cellKey = `${row}-${col}`;
            
            if (!cell || !cell.type) break;
            if (cell.type !== 'HLINE' && cell.type !== 'BOTH') break;
            
            this.wireStates[`${cellKey}-in`] = powerState;
            this.wireStates[`${cellKey}-out`] = powerState;
        }
    }

    /**
     * Check if power comes from any branches below
     */
    checkBranchPower(grid, row, col) {
        // Check if there's a vertical line connecting to rows below
        for (let r = row + 1; r < grid.length; r++) {
            const cell = grid[r][col];
            if (cell && (cell.type === 'VLINE' || cell.type === 'BOTH')) {
                const cellKey = `${r}-${col}`;
                if (this.wireStates[`${cellKey}-out`]) {
                    return true;
                }
            } else {
                break; // No more vertical connections
            }
        }
        return false;
    }

    /**
     * Check if a wire segment is energized
     */
    isWireEnergized(row, col, position = 'out') {
        const cellKey = `${row}-${col}`;
        return this.wireStates[`${cellKey}-${position}`] || false;
    }

    /**
     * Check if a component is active/energized
     */
    isComponentActive(row, col) {
        const cellKey = `${row}-${col}`;
        return this.componentStates[cellKey] || false;
    }

    /**
     * Set scan cycle time
     */
    setScanCycleTime(ms) {
        this.scanCycleMs = Math.max(10, Math.min(5000, ms)); // Between 10ms and 5000ms
        
        if (this.isRunning && this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = setInterval(() => {
                if (!this.isPaused) {
                    this.executeScanCycle();
                }
            }, this.scanCycleMs);
        }
    }

    /**
     * Get simulation statistics
     */
    getStats() {
        return {
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            scanCount: this.scanCount,
            scanCycleMs: this.scanCycleMs,
            activeOutputs: Object.keys(this.pinStates).filter(k => k.startsWith('O:') && this.pinStates[k]).length,
            activeInputs: Object.keys(this.pinStates).filter(k => k.startsWith('I:') && this.pinStates[k]).length
        };
    }

    /**
     * Reset simulation (keep running state but reset counters)
     */
    reset() {
        this.scanCount = 0;
        
        // Reset all outputs
        Object.keys(this.pinStates).forEach(address => {
            if (address.startsWith('O:')) {
                this.pinStates[address] = false;
            }
        });
        
        console.log('Simulation reset');
    }
}

// Create global simulation instance
window.plcSimulation = new PLCSimulation();
