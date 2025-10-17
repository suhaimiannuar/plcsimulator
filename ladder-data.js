/**
 * Ladder Data Manager
 * Manages the ladder diagram data structure
 */

class LadderData {
    constructor() {
        this.rungs = [this.createEmptyRung(0)];
        this.pins = {
            inputs: [],
            outputs: []
        };
    }

    createEmptyRung(id) {
        return {
            id: id,
            branches: [
                {
                    id: 0,
                    row: 0,
                    start_col: 0,
                    end_col: 9,
                    parent_branch_id: null,
                    connection_col: null,
                    components: []
                },
                {
                    id: 1,
                    row: 1,
                    start_col: 0,
                    end_col: 9,
                    parent_branch_id: 0,
                    connection_col: 0,
                    components: []
                }
            ]
        };
    }

    loadPins(inputPins, outputPins) {
        this.pins.inputs = inputPins;
        this.pins.outputs = outputPins;
    }

    addComponent(row, col, type, address, label) {
        // Find the branch at this row
        const rung = this.rungs[0]; // For now, single rung
        let branch = rung.branches.find(b => b.row === row);

        if (!branch) {
            console.error('Branch not found at row', row);
            return false;
        }

        // Check if component already exists at this position
        const existingIndex = branch.components.findIndex(c => c.col === col);
        if (existingIndex >= 0) {
            // Update existing component
            branch.components[existingIndex] = { type, address, label, col };
        } else {
            // Add new component
            branch.components.push({ type, address, label, col });
            // Sort components by column
            branch.components.sort((a, b) => a.col - b.col);
        }

        return true;
    }

    removeComponent(row, col) {
        const rung = this.rungs[0];
        const branch = rung.branches.find(b => b.row === row);
        
        if (branch) {
            branch.components = branch.components.filter(c => c.col !== col);
            return true;
        }
        return false;
    }

    addBranch(row, start_col, end_col, connection_col) {
        const rung = this.rungs[0];
        
        // Check if branch already exists at this row
        if (rung.branches.find(b => b.row === row)) {
            console.log('Branch already exists at row', row);
            return;
        }

        const newBranch = {
            id: rung.branches.length,
            row: row,
            start_col: start_col,
            end_col: end_col,
            parent_branch_id: 0, // Connected to main rung
            connection_col: connection_col,
            components: []
        };

        rung.branches.push(newBranch);
    }

    removeBranch(row) {
        const rung = this.rungs[0];
        rung.branches = rung.branches.filter(b => b.row !== row);
    }

    getBranch(row) {
        const rung = this.rungs[0];
        return rung.branches.find(b => b.row === row);
    }

    getAllBranches() {
        return this.rungs[0].branches;
    }

    toJSON() {
        return {
            rungs: this.rungs,
            pins: this.pins
        };
    }

    fromJSON(data) {
        this.rungs = data.rungs || [this.createEmptyRung(0)];
        this.pins = data.pins || { inputs: [], outputs: [] };
    }
}
