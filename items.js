// Items/Components definition for the ladder diagram editor
// This file contains the logic for each item type that can be placed on the diagram

const LadderItems = {
    // Contact items
    NO: {
        id: 'NO',
        label: 'NO Contact',
        icon: '| |',
        category: 'contact',
        draw: function(ctx, x, y, cell) {
            ctx.strokeStyle = '#9CA3AF';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x - 15, y - 12);
            ctx.lineTo(x - 15, y + 12);
            ctx.moveTo(x + 15, y - 12);
            ctx.lineTo(x + 15, y + 12);
            ctx.stroke();
        },
        drawLabels: function(ctx, x, y, cell) {
            ctx.fillStyle = '#E5E7EB';
            if (cell.address) {
                ctx.font = '10px Inter';
                ctx.fillText(cell.address, x, y - 25);
            }
            if (cell.label) {
                ctx.font = '9px Inter';
                ctx.fillText(cell.label, x, y + 25);
            }
        },
        canAcceptPin: function(pinType) {
            // NO contacts can accept both input and output pins (for feedback)
            return true;
        },
        breaksWire: true,
        defaultAddress: (col) => `I:0/${col}`
    },

    NC: {
        id: 'NC',
        label: 'NC Contact',
        icon: '|/|',
        category: 'contact',
        draw: function(ctx, x, y, cell) {
            ctx.strokeStyle = '#9CA3AF';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x - 15, y - 12);
            ctx.lineTo(x - 15, y + 12);
            ctx.moveTo(x + 15, y - 12);
            ctx.lineTo(x + 15, y + 12);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x - 12, y - 12);
            ctx.lineTo(x + 12, y + 12);
            ctx.stroke();
        },
        drawLabels: function(ctx, x, y, cell) {
            ctx.fillStyle = '#E5E7EB';
            if (cell.address) {
                ctx.font = '10px Inter';
                ctx.fillText(cell.address, x, y - 25);
            }
            if (cell.label) {
                ctx.font = '9px Inter';
                ctx.fillText(cell.label, x, y + 25);
            }
        },
        canAcceptPin: function(pinType) {
            // NC contacts can accept both input and output pins (for feedback)
            return true;
        },
        breaksWire: true,
        defaultAddress: (col) => `I:0/${col}`
    },

    OUT: {
        id: 'OUT',
        label: 'Output',
        icon: '( )',
        category: 'output',
        draw: function(ctx, x, y, cell) {
            ctx.strokeStyle = '#9CA3AF';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x, y, 15, 0, 2 * Math.PI);
            ctx.stroke();
        },
        drawLabels: function(ctx, x, y, cell) {
            ctx.fillStyle = '#E5E7EB';
            if (cell.address) {
                ctx.font = '10px Inter';
                ctx.fillText(cell.address, x, y - 25);
            }
            if (cell.label) {
                ctx.font = '9px Inter';
                ctx.fillText(cell.label, x, y + 25);
            }
        },
        canAcceptPin: function(pinType) {
            // Output coils only accept output pins
            return pinType === 'output';
        },
        breaksWire: true,
        defaultAddress: (col) => `O:0/${col}`
    },

    // Line items
    HLINE: {
        id: 'HLINE',
        label: 'H-Line',
        icon: '─',
        category: 'line',
        draw: function(ctx, x, y, cell) {
            // Drawing is handled in the wire drawing phase
        },
        breaksWire: false,
        canCoexistWithVLine: true
    },

    VLINE: {
        id: 'VLINE',
        label: 'V-Line',
        icon: '│',
        category: 'line',
        draw: function(ctx, x, y, row, ROWS, CELL_HEIGHT) {
            ctx.strokeStyle = '#9CA3AF';
            ctx.lineWidth = 3;
            ctx.beginPath();
            if (row < ROWS - 1) {
                // Connect to row below
                const yBelow = ((row + 1) + 0.5) * CELL_HEIGHT;
                ctx.moveTo(x, y);
                ctx.lineTo(x, yBelow);
            }
            ctx.stroke();
        },
        breaksWire: false,
        canCoexistWithHLine: true
    },

    BOTH: {
        id: 'BOTH',
        label: 'H+V Line',
        icon: '┼',
        category: 'line',
        draw: function(ctx, x, y, row, ROWS, CELL_HEIGHT) {
            // Draw vertical line
            ctx.strokeStyle = '#9CA3AF';
            ctx.lineWidth = 3;
            ctx.beginPath();
            if (row < ROWS - 1) {
                const yBelow = ((row + 1) + 0.5) * CELL_HEIGHT;
                ctx.moveTo(x, y);
                ctx.lineTo(x, yBelow);
            }
            ctx.stroke();
            // Horizontal line is drawn in wire drawing phase
        },
        breaksWire: false,
        hasHLine: true,
        hasVLine: true
    },

    CLEAR: {
        id: 'CLEAR',
        label: 'Clear',
        icon: 'X',
        category: 'tool'
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LadderItems;
}
