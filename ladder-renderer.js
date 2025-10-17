/**
 * Ladder Renderer
 * Handles all canvas drawing operations
 */

class LadderRenderer {
    constructor(canvas, ladderData) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ladderData = ladderData;
        
        // Configuration
        this.config = {
            RAIL_WIDTH: 40,
            COLS: 10,
            CELL_WIDTH: 80,
            CELL_HEIGHT: 80,
            GRID_COLOR: '#374151',
            WIRE_COLOR: '#9ca3af',
            WIRE_ENERGIZED_COLOR: '#fbbf24',
            COMPONENT_COLOR: '#e5e7eb',
            COMPONENT_ACTIVE_COLOR: '#22c55e',
            OUTPUT_ACTIVE_COLOR: '#f97316'
        };
        
        this.simulationState = null;
    }

    setSimulationState(state) {
        this.simulationState = state;
    }

    draw() {
        // Adjust canvas height based on number of branches
        const branches = this.ladderData.getAllBranches();
        const maxRow = Math.max(...branches.map(b => b.row));
        const requiredHeight = (maxRow + 2) * this.config.CELL_HEIGHT;
        
        if (this.canvas.height < requiredHeight) {
            this.canvas.height = requiredHeight;
        }
        
        this.clear();
        this.drawRails();
        this.drawGrid();
        this.drawBranches();
        this.drawColumnLabels();
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawRails() {
        const { RAIL_WIDTH, COLS, CELL_WIDTH, WIRE_COLOR } = this.config;
        const h = this.canvas.height;
        const rightRailX = RAIL_WIDTH + COLS * CELL_WIDTH;
        
        this.ctx.strokeStyle = WIRE_COLOR;
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        // Left rail
        this.ctx.moveTo(RAIL_WIDTH, 0);
        this.ctx.lineTo(RAIL_WIDTH, h);
        // Right rail
        this.ctx.moveTo(rightRailX, 0);
        this.ctx.lineTo(rightRailX, h);
        this.ctx.stroke();
    }

    drawGrid() {
        const { RAIL_WIDTH, COLS, CELL_WIDTH, GRID_COLOR } = this.config;
        const branches = this.ladderData.getAllBranches();
        const maxRow = Math.max(...branches.map(b => b.row));
        const h = (maxRow + 1) * this.config.CELL_HEIGHT;
        
        this.ctx.strokeStyle = GRID_COLOR;
        this.ctx.lineWidth = 1;
        
        // Vertical lines
        for (let col = 0; col <= COLS; col++) {
            const x = RAIL_WIDTH + col * CELL_WIDTH;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, h);
            this.ctx.stroke();
        }
        
        // Horizontal lines
        for (let row = 0; row <= maxRow + 1; row++) {
            const y = row * this.config.CELL_HEIGHT;
            const rightRailX = RAIL_WIDTH + COLS * CELL_WIDTH;
            this.ctx.beginPath();
            this.ctx.moveTo(RAIL_WIDTH, y);
            this.ctx.lineTo(rightRailX, y);
            this.ctx.stroke();
        }
    }

    drawBranches() {
        const branches = this.ladderData.getAllBranches();
        
        for (const branch of branches) {
            this.drawBranch(branch);
        }
    }

    drawBranch(branch) {
        const { RAIL_WIDTH, CELL_WIDTH, CELL_HEIGHT } = this.config;
        const y = (branch.row + 0.5) * CELL_HEIGHT;
        
        // Draw horizontal wire
        const startX = RAIL_WIDTH + branch.start_col * CELL_WIDTH;
        const endX = RAIL_WIDTH + (branch.end_col + 1) * CELL_WIDTH;
        
        // Determine if wire is energized
        const isEnergized = this.simulationState && 
                           this.simulationState.isWireEnergized(branch.row, branch.start_col);
        
        this.ctx.strokeStyle = isEnergized ? this.config.WIRE_ENERGIZED_COLOR : this.config.WIRE_COLOR;
        this.ctx.lineWidth = 2;
        
        // Draw wire in segments (broken by components)
        let currentX = startX;
        
        for (const component of branch.components) {
            const compX = RAIL_WIDTH + (component.col + 0.5) * CELL_WIDTH;
            
            // Draw wire up to component
            this.ctx.beginPath();
            this.ctx.moveTo(currentX, y);
            this.ctx.lineTo(compX - 20, y);
            this.ctx.stroke();
            
            // Draw component
            this.drawComponent(component, compX, y, branch.row);
            
            // Check if wire after component is energized
            const afterEnergized = this.simulationState && 
                                  this.simulationState.isWireEnergized(branch.row, component.col + 1);
            this.ctx.strokeStyle = afterEnergized ? this.config.WIRE_ENERGIZED_COLOR : this.config.WIRE_COLOR;
            
            currentX = compX + 20;
        }
        
        // Draw remaining wire
        this.ctx.beginPath();
        this.ctx.moveTo(currentX, y);
        this.ctx.lineTo(endX, y);
        this.ctx.stroke();
        
        // Draw vertical connection if this is a branch
        if (branch.connection_col !== null) {
            const connX = RAIL_WIDTH + (branch.connection_col + 0.5) * CELL_WIDTH;
            const parentY = (0 + 0.5) * CELL_HEIGHT; // Assume parent is row 0
            
            this.ctx.strokeStyle = this.config.WIRE_COLOR;
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.moveTo(connX, parentY);
            this.ctx.lineTo(connX, y);
            this.ctx.stroke();
        }
        
        // Draw row label
        this.ctx.fillStyle = '#9ca3af';
        this.ctx.font = '12px Inter';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`R${branch.row}`, 20, y + 5);
    }

    drawComponent(component, x, y, row) {
        const isActive = this.simulationState && 
                        this.simulationState.isComponentActive(row, component.col);
        const isOutput = component.type === 'OUT';
        
        const color = isActive ? 
                     (isOutput ? this.config.OUTPUT_ACTIVE_COLOR : this.config.COMPONENT_ACTIVE_COLOR) : 
                     this.config.COMPONENT_COLOR;
        
        this.ctx.strokeStyle = color;
        this.ctx.fillStyle = color;
        this.ctx.lineWidth = 3;
        
        switch (component.type) {
            case 'NO':
                // Normally Open Contact
                this.ctx.beginPath();
                this.ctx.moveTo(x - 15, y - 15);
                this.ctx.lineTo(x - 15, y + 15);
                this.ctx.moveTo(x + 15, y - 15);
                this.ctx.lineTo(x + 15, y + 15);
                this.ctx.stroke();
                break;
                
            case 'NC':
                // Normally Closed Contact
                this.ctx.beginPath();
                this.ctx.moveTo(x - 15, y - 15);
                this.ctx.lineTo(x - 15, y + 15);
                this.ctx.moveTo(x + 15, y - 15);
                this.ctx.lineTo(x + 15, y + 15);
                this.ctx.stroke();
                this.ctx.beginPath();
                this.ctx.moveTo(x - 12, y - 15);
                this.ctx.lineTo(x + 12, y + 15);
                this.ctx.stroke();
                break;
                
            case 'OUT':
                // Output Coil
                this.ctx.beginPath();
                this.ctx.arc(x, y, 15, 0, 2 * Math.PI);
                this.ctx.stroke();
                break;
        }
        
        // Draw labels
        this.ctx.font = '10px Inter';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(component.address || '', x, y - 25);
        this.ctx.font = '8px Inter';
        this.ctx.fillText(component.label || '', x, y + 28);
    }

    drawColumnLabels() {
        const { RAIL_WIDTH, COLS, CELL_WIDTH, CELL_HEIGHT } = this.config;
        const branches = this.ladderData.getAllBranches();
        const maxRow = Math.max(...branches.map(b => b.row));
        const y = (maxRow + 1) * CELL_HEIGHT + 20;
        
        this.ctx.fillStyle = '#9ca3af';
        this.ctx.font = '12px Inter';
        this.ctx.textAlign = 'center';
        
        for (let col = 0; col < COLS; col++) {
            const x = RAIL_WIDTH + (col + 0.5) * CELL_WIDTH;
            this.ctx.fillText(col + 1, x, y);
        }
    }

    getClickedPosition(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const col = Math.floor((x - this.config.RAIL_WIDTH) / this.config.CELL_WIDTH);
        const row = Math.floor(y / this.config.CELL_HEIGHT);
        
        if (col >= 0 && col < this.config.COLS && row >= 0) {
            return { row, col };
        }
        return null;
    }
}
