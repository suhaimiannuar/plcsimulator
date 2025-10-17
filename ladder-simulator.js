/**
 * Ladder Simulator
 * Executes ladder logic and tracks pin/wire states
 */

class LadderSimulator {
    constructor(ladderData) {
        this.ladderData = ladderData;
        this.isRunning = false;
        this.pinStates = {};
        this.wireStates = {}; // Map: 'row-col' -> boolean
        this.componentStates = {}; // Map: 'row-col' -> boolean
    }

    initializePins() {
        // Initialize all pins to OFF
        this.ladderData.pins.inputs.forEach(pin => {
            this.pinStates[pin.address] = false;
        });
        this.ladderData.pins.outputs.forEach(pin => {
            this.pinStates[pin.address] = false;
        });
    }

    start() {
        this.isRunning = true;
        this.executeScan();
    }

    stop() {
        this.isRunning = false;
        this.wireStates = {};
        this.componentStates = {};
    }

    reset() {
        this.stop();
        this.initializePins();
    }

    toggleInput(address) {
        if (!this.isRunning) return;
        
        this.pinStates[address] = !this.pinStates[address];
        this.executeScan();
    }

    getPinState(address) {
        return this.pinStates[address] || false;
    }

    setPinState(address, state) {
        this.pinStates[address] = state;
    }

    isWireEnergized(row, col) {
        const key = `${row}-${col}`;
        return this.wireStates[key] || false;
    }

    isComponentActive(row, col) {
        const key = `${row}-${col}`;
        return this.componentStates[key] || false;
    }

    executeScan() {
        // Clear previous states
        this.wireStates = {};
        this.componentStates = {};
        
        // First, clear all outputs
        this.ladderData.pins.outputs.forEach(pin => {
            this.pinStates[pin.address] = false;
        });
        
        // Evaluate ladder logic
        this.evaluateLadder();
    }

    evaluateLadder() {
        const branches = this.ladderData.getAllBranches();
        
        // Sort branches by row (evaluate top to bottom)
        branches.sort((a, b) => a.row - b.row);
        
        for (const branch of branches) {
            this.evaluateBranch(branch);
        }
    }

    evaluateBranch(branch) {
        // A branch has power if:
        // 1. It's the main rung (row 0) - always has power from left rail
        // 2. It's connected to a powered position via vertical line
        
        let hasPower = false;
        
        if (branch.row === 0) {
            // Main rung always starts with power
            hasPower = true;
        } else if (branch.connection_col !== null) {
            // Branch connected via vertical line
            // Check if the connection point on parent branch has power
            const parentBranch = this.ladderData.getAllBranches()
                .find(b => b.id === branch.parent_branch_id);
            
            if (parentBranch) {
                // Check if power reaches the connection point on parent branch
                hasPower = this.evaluatePowerAtColumn(parentBranch, branch.connection_col);
            }
        }
        
        // If branch doesn't have initial power, skip it
        if (!hasPower) return;
        
        // Mark initial wire as energized
        this.wireStates[`${branch.row}-${branch.start_col}`] = true;
        
        // Evaluate each component in sequence (left to right)
        let currentPower = true;
        let currentCol = branch.start_col;
        
        for (const component of branch.components) {
            // Mark wires up to this component as energized if we have power
            for (let col = currentCol; col < component.col; col++) {
                if (currentPower) {
                    this.wireStates[`${branch.row}-${col}`] = true;
                }
            }
            
            // Evaluate component
            const componentPower = this.evaluateComponent(component, currentPower);
            
            // Mark component as active if it's conducting/energized
            if (componentPower) {
                this.componentStates[`${branch.row}-${component.col}`] = true;
                this.wireStates[`${branch.row}-${component.col}`] = true;
            } else if (component.type === 'NC' && currentPower) {
                // NC contacts are "active" (green) when they're blocking power
                // But only if there's power available to block
                this.componentStates[`${branch.row}-${component.col}`] = true;
            }
            
            currentPower = componentPower;
            currentCol = component.col + 1;
        }
        
        // Mark remaining wires as energized if we still have power
        for (let col = currentCol; col <= branch.end_col; col++) {
            if (currentPower) {
                this.wireStates[`${branch.row}-${col}`] = true;
            }
        }
    }

    evaluatePowerAtColumn(branch, col) {
        // Simulate evaluation up to this column to see if power reaches it
        let hasPower = (branch.row === 0); // Main rung has power
        
        for (const component of branch.components) {
            if (component.col >= col) break; // Haven't reached this column yet
            
            // Evaluate component
            switch (component.type) {
                case 'NO':
                    hasPower = hasPower && this.getPinState(component.address);
                    break;
                case 'NC':
                    hasPower = hasPower && !this.getPinState(component.address);
                    break;
                case 'OUT':
                    // Outputs don't affect power flow
                    break;
            }
            
            if (!hasPower) break;
        }
        
        return hasPower;
    }

    evaluateComponent(component, inputPower) {
        if (!inputPower) {
            // No power coming in, component doesn't conduct
            if (component.type === 'OUT') {
                this.setPinState(component.address, false);
            }
            return false;
        }
        
        switch (component.type) {
            case 'NO':
                // Normally Open: conducts if input is ON
                return this.getPinState(component.address);
                
            case 'NC':
                // Normally Closed: conducts if input is OFF
                return !this.getPinState(component.address);
                
            case 'OUT':
                // Output: gets energized if power reaches it
                this.setPinState(component.address, true);
                return true;
                
            default:
                return false;
        }
    }
}
