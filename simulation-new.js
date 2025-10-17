/**
 * NEW: Simplified PLC Simulation using Ladder Structure
 * This replaces the complex grid-based simulation with a clean branch-based approach
 */

class LadderSimulation {
    constructor() {
        this.isRunning = false;
        this.pinStates = {}; // Stores current state of all I/O pins
        this.branchPowerStates = {}; // Stores power state at each position in each branch
        this.componentStates = {}; // Stores active state of components
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
        console.log('Simulation started with new ladder structure');
        this.executeScan();
    }

    /**
     * Stop the simulation
     */
    stop() {
        this.isRunning = false;
        
        // Clear states
        this.branchPowerStates = {};
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
                this.executeScan();
            }
            
            return this.pinStates[address];
        }
        return false;
    }

    /**
     * Get pin state
     */
    getPinState(address) {
        return this.pinStates[address] || false;
    }

    /**
     * Execute one scan cycle using ladder structure
     */
    executeScan() {
        // Clear states for this scan
        this.branchPowerStates = {};
        this.componentStates = {};
        
        // Clear all outputs first (they will be set if power reaches them)
        Object.keys(this.pinStates).forEach(address => {
            if (address.startsWith('O:')) {
                this.pinStates[address] = false;
            }
        });
        
        // Evaluate ladder logic
        this.evaluateLadder();
        
        // Trigger redraw
        if (window.drawLadder) {
            window.drawLadder();
        }
    }

    /**
     * Evaluate the entire ladder diagram using the new structure
     */
    evaluateLadder() {
        if (!window.ladderStructure) {
            console.error('Ladder structure not available');
            return;
        }

        const ladderStructure = window.ladderStructure;
        const branches = ladderStructure.getAllBranches();

        // Sort branches: main branches first, then child branches
        branches.sort((a, b) => {
            if (a.parent_branch_id === null && b.parent_branch_id !== null) return -1;
            if (a.parent_branch_id !== null && b.parent_branch_id === null) return 1;
            return a.row - b.row;
        });

        // Evaluate each branch
        for (const branch of branches) {
            this.evaluateBranch(branch, ladderStructure);
        }
    }

    /**
     * Evaluate a single branch
     */
    evaluateBranch(branch, ladderStructure) {
        const branchKey = `branch-${branch.id}`;
        
        // Determine if this branch has power at the start
        let hasPower = false;
        
        if (branch.parent_branch_id === null) {
            // Main branch (row 0) - always has power from left rail
            hasPower = true;
        } else {
            // Child branch - check if parent has power at connection point
            const parentBranch = ladderStructure.findBranchById(branch.parent_branch_id);
            if (parentBranch) {
                const parentPowerKey = `branch-${parentBranch.id}-col-${branch.connection_col}`;
                hasPower = this.branchPowerStates[parentPowerKey] || false;
            }
        }

        // Mark initial power state at branch start
        const startKey = `branch-${branch.id}-col-${branch.start_col}`;
        this.branchPowerStates[startKey] = hasPower;

        // Evaluate components in sequence (left to right)
        let currentCol = branch.start_col;
        
        for (const component of branch.components) {
            // Mark power state before this component
            const beforeKey = `branch-${branch.id}-col-${component.col}`;
            this.branchPowerStates[beforeKey] = hasPower;
            
            // Evaluate component
            const result = this.evaluateComponent(component, hasPower);
            hasPower = result.powerAfter;
            
            // Store component state (for coloring)
            const compKey = `${branch.row}-${component.col}`;
            this.componentStates[compKey] = result.isActive;
            
            // Mark power state after this component
            const afterKey = `branch-${branch.id}-col-${component.col + 1}`;
            this.branchPowerStates[afterKey] = hasPower;
            
            currentCol = component.col + 1;
        }

        // Mark power state at branch end
        const endKey = `branch-${branch.id}-col-${branch.end_col}`;
        this.branchPowerStates[endKey] = hasPower;
    }

    /**
     * Evaluate a single component
     * Returns: { powerAfter: boolean, isActive: boolean }
     */
    evaluateComponent(component, powerBefore) {
        const pinState = this.getPinState(component.address);
        
        switch (component.type) {
            case 'NO': // Normally Open contact
                // Passes power if input is ON
                const noPasses = pinState === true;
                return {
                    powerAfter: powerBefore && noPasses,
                    isActive: noPasses // Green if input is ON
                };
            
            case 'NC': // Normally Closed contact
                // Passes power if input is OFF
                const ncPasses = pinState === false;
                return {
                    powerAfter: powerBefore && ncPasses,
                    isActive: ncPasses // Green if input is OFF (conducting)
                };
            
            case 'OUT': // Output coil
                // Energize output if power reaches it
                if (powerBefore) {
                    this.pinStates[component.address] = true;
                }
                return {
                    powerAfter: powerBefore, // Power continues through coil
                    isActive: powerBefore // Red if energized
                };
            
            default:
                return {
                    powerAfter: powerBefore,
                    isActive: false
                };
        }
    }

    /**
     * Check if wire is energized at a specific grid position
     */
    isWireEnergized(row, col) {
        // Check all branches at this row
        if (!window.ladderStructure) return false;
        
        const branch = window.ladderStructure.findBranchAtRow(row);
        if (!branch) return false;
        
        // Check if this column is within the branch and has power
        if (col >= branch.start_col && col <= branch.end_col) {
            const key = `branch-${branch.id}-col-${col}`;
            return this.branchPowerStates[key] || false;
        }
        
        return false;
    }

    /**
     * Check if component is active at a specific grid position
     */
    isComponentActive(row, col) {
        const key = `${row}-${col}`;
        return this.componentStates[key] || false;
    }
}

// Create global instance
// Note: This will replace the old PLCSimulation instance
window.plcSimulation = new LadderSimulation();
