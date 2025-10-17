/**
 * Ladder Diagram Structure Manager
 * Manages the ladder diagram data structure with rungs, branches, and components
 */

class LadderStructure {
    constructor() {
        this.rungs = [];
        this.nextRungId = 0;
        this.nextBranchId = 0;
        this.gridCols = 10;
        this.gridRows = 3;
        
        // Initialize with one rung and main branch
        this.initialize();
    }

    initialize() {
        // Create main rung with main branch (row 0)
        const mainBranch = {
            id: this.nextBranchId++,
            row: 0,
            start_col: 0,
            end_col: this.gridCols - 1,
            parent_branch_id: null,
            connection_col: null,
            components: []
        };

        this.rungs.push({
            id: this.nextRungId++,
            branches: [mainBranch]
        });
    }

    /**
     * Add a component to the ladder at specific row and column
     */
    addComponent(row, col, type, address, label) {
        // Find or create branch at this row
        let branch = this.findBranchAtRow(row);
        
        if (!branch) {
            // Need to create a new branch
            console.warn(`No branch at row ${row}, cannot add component yet`);
            return null;
        }

        // Check if component already exists at this position
        const existingIndex = branch.components.findIndex(c => c.col === col);
        if (existingIndex !== -1) {
            // Replace existing component
            branch.components[existingIndex] = { type, address, label, col };
        } else {
            // Add new component and sort by column
            branch.components.push({ type, address, label, col });
            branch.components.sort((a, b) => a.col - b.col);
        }

        return branch;
    }

    /**
     * Remove component at specific row and column
     */
    removeComponent(row, col) {
        const branch = this.findBranchAtRow(row);
        if (!branch) return false;

        const index = branch.components.findIndex(c => c.col === col);
        if (index !== -1) {
            branch.components.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Create a new branch (parallel path)
     */
    createBranch(parentRow, connectionCol, newRow, startCol, endCol) {
        const parentBranch = this.findBranchAtRow(parentRow);
        if (!parentBranch) {
            console.error(`Parent branch at row ${parentRow} not found`);
            return null;
        }

        // Ensure we have enough rows
        if (newRow >= this.gridRows) {
            this.gridRows = newRow + 1;
        }

        const newBranch = {
            id: this.nextBranchId++,
            row: newRow,
            start_col: startCol,
            end_col: endCol,
            parent_branch_id: parentBranch.id,
            connection_col: connectionCol,
            components: []
        };

        // Add to the current rung
        this.rungs[0].branches.push(newBranch);
        
        return newBranch;
    }

    /**
     * Find branch at specific row
     */
    findBranchAtRow(row) {
        for (const rung of this.rungs) {
            const branch = rung.branches.find(b => b.row === row);
            if (branch) return branch;
        }
        return null;
    }

    /**
     * Find branch by ID
     */
    findBranchById(id) {
        for (const rung of this.rungs) {
            const branch = rung.branches.find(b => b.id === id);
            if (branch) return branch;
        }
        return null;
    }

    /**
     * Get component at specific position
     */
    getComponentAt(row, col) {
        const branch = this.findBranchAtRow(row);
        if (!branch) return null;
        
        return branch.components.find(c => c.col === col) || null;
    }

    /**
     * Get all branches
     */
    getAllBranches() {
        const branches = [];
        for (const rung of this.rungs) {
            branches.push(...rung.branches);
        }
        return branches;
    }

    /**
     * Get child branches of a parent branch
     */
    getChildBranches(parentBranchId) {
        const children = [];
        for (const rung of this.rungs) {
            for (const branch of rung.branches) {
                if (branch.parent_branch_id === parentBranchId) {
                    children.push(branch);
                }
            }
        }
        return children;
    }

    /**
     * Check if a column has a vertical connection at a specific row
     */
    hasVerticalConnection(row, col) {
        const branch = this.findBranchAtRow(row);
        if (!branch) return false;

        // Check if this is a connection point to a child branch
        const children = this.getChildBranches(branch.id);
        return children.some(child => child.connection_col === col);
    }

    /**
     * Export to JSON
     */
    toJSON() {
        return {
            rungs: this.rungs,
            metadata: {
                grid_cols: this.gridCols,
                grid_rows: this.gridRows
            }
        };
    }

    /**
     * Import from JSON
     */
    fromJSON(data) {
        this.rungs = data.rungs || [];
        this.gridCols = data.metadata?.grid_cols || 10;
        this.gridRows = data.metadata?.grid_rows || 3;
        
        // Update next IDs
        let maxRungId = 0;
        let maxBranchId = 0;
        
        for (const rung of this.rungs) {
            if (rung.id >= maxRungId) maxRungId = rung.id + 1;
            for (const branch of rung.branches) {
                if (branch.id >= maxBranchId) maxBranchId = branch.id + 1;
            }
        }
        
        this.nextRungId = maxRungId;
        this.nextBranchId = maxBranchId;
    }

    /**
     * Clear all data
     */
    clear() {
        this.rungs = [];
        this.nextRungId = 0;
        this.nextBranchId = 0;
        this.initialize();
    }

    /**
     * Remove empty branches (no components and not main branch)
     */
    cleanupEmptyBranches() {
        for (const rung of this.rungs) {
            rung.branches = rung.branches.filter(branch => 
                branch.parent_branch_id === null || // Keep main branch
                branch.components.length > 0 || // Keep if has components
                this.getChildBranches(branch.id).length > 0 // Keep if has children
            );
        }
        
        // Adjust grid rows if needed
        let maxRow = 0;
        for (const rung of this.rungs) {
            for (const branch of rung.branches) {
                if (branch.row > maxRow) maxRow = branch.row;
            }
        }
        this.gridRows = Math.max(3, maxRow + 1);
    }
}
