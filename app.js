/**
 * Main Application
 * Ties everything together
 */

// Initialize
const ladderData = new LadderData();
const canvas = document.getElementById('canvas');
const renderer = new LadderRenderer(canvas, ladderData);
const simulator = new LadderSimulator(ladderData);

// State
let currentTool = 'NO';
let isSimulationRunning = false;

// Tools configuration
const TOOLS = [
    { id: 'NO', label: 'NO Contact', icon: '| |' },
    { id: 'NC', label: 'NC Contact', icon: '|/|' },
    { id: 'OUT', label: 'Output', icon: '( )' },
    { id: 'HLINE', label: 'H-Line', icon: '─' },
    { id: 'VLINE', label: 'V-Line', icon: '│' },
    { id: 'CLEAR', label: 'Clear', icon: 'X' }
];

// Load pins from JSON
async function loadPins() {
    try {
        const response = await fetch('pins.json');
        const data = await response.json();
        ladderData.loadPins(data.inputs, data.outputs);
        simulator.initializePins();
        renderPins();
    } catch (error) {
        console.error('Error loading pins:', error);
        // Fallback pins
        const fallbackInputs = [
            { id: 'I0', label: 'Input 0', address: 'I:0/0' },
            { id: 'I1', label: 'Input 1', address: 'I:0/1' },
            { id: 'I2', label: 'Input 2', address: 'I:0/2' }
        ];
        const fallbackOutputs = [
            { id: 'O0', label: 'Output 0', address: 'O:0/0' },
            { id: 'O1', label: 'Output 1', address: 'O:0/1' }
        ];
        ladderData.loadPins(fallbackInputs, fallbackOutputs);
        simulator.initializePins();
        renderPins();
    }
}

// Render toolbox
function renderToolbox() {
    const toolbox = document.getElementById('toolbox');
    toolbox.innerHTML = '';
    
    TOOLS.forEach(tool => {
        const btn = document.createElement('button');
        btn.className = `tool-btn px-4 py-2 bg-slate-700 rounded-lg text-sm font-semibold ${
            tool.id === currentTool ? 'active' : ''
        }`;
        btn.innerHTML = `<div class="text-2xl mb-1">${tool.icon}</div><div class="text-xs">${tool.label}</div>`;
        btn.onclick = () => {
            if (currentTool === tool.id) {
                currentTool = null; // Deselect
            } else {
                currentTool = tool.id;
            }
            renderToolbox();
        };
        toolbox.appendChild(btn);
    });
}

// Render pins
function renderPins() {
    const inputPinsEl = document.getElementById('inputPins');
    const outputPinsEl = document.getElementById('outputPins');
    
    inputPinsEl.innerHTML = '';
    outputPinsEl.innerHTML = '';
    
    // Render inputs
    ladderData.pins.inputs.forEach(pin => {
        const isOn = simulator.getPinState(pin.address);
        const div = document.createElement('div');
        div.className = `pin-item p-3 bg-slate-700 rounded ${isOn ? 'on' : ''}`;
        div.innerHTML = `
            <div class="flex justify-between items-center">
                <div>
                    <div class="text-xs font-semibold">${pin.address}</div>
                    <div class="text-xs text-gray-400">${pin.label}</div>
                </div>
                <div class="text-xl">${isOn ? '●' : '○'}</div>
            </div>
        `;
        div.onclick = () => {
            if (isSimulationRunning) {
                simulator.toggleInput(pin.address);
                renderPins();
                renderer.setSimulationState(simulator);
                renderer.draw();
            }
        };
        inputPinsEl.appendChild(div);
    });
    
    // Render outputs
    ladderData.pins.outputs.forEach(pin => {
        const isOn = simulator.getPinState(pin.address);
        const div = document.createElement('div');
        div.className = `pin-item p-3 bg-slate-700 rounded ${isOn ? 'output-on' : ''}`;
        div.innerHTML = `
            <div class="flex justify-between items-center">
                <div>
                    <div class="text-xs font-semibold">${pin.address}</div>
                    <div class="text-xs text-gray-400">${pin.label}</div>
                </div>
                <div class="text-xl">${isOn ? '●' : '○'}</div>
            </div>
        `;
        outputPinsEl.appendChild(div);
    });
}

// Canvas click handler
canvas.addEventListener('click', (event) => {
    if (isSimulationRunning || !currentTool) return;
    
    const pos = renderer.getClickedPosition(event);
    if (!pos) return;
    
    handleToolPlacement(pos.row, pos.col);
});

// Canvas double-click handler for pin assignment
canvas.addEventListener('dblclick', (event) => {
    if (isSimulationRunning) return;
    
    const pos = renderer.getClickedPosition(event);
    if (!pos) return;
    
    showPinAssignmentDialog(pos.row, pos.col, event);
});

// Handle tool placement
function handleToolPlacement(row, col) {
    switch (currentTool) {
        case 'NO':
        case 'NC':
        case 'OUT':
            // Place component
            ladderData.addComponent(row, col, currentTool, '', '');
            break;
            
        case 'VLINE':
            // Create a new branch connected at this column
            // Find the next available row
            const branches = ladderData.getAllBranches();
            const maxRow = Math.max(...branches.map(b => b.row));
            const newRow = maxRow + 1;
            
            // Add new branch
            ladderData.addBranch(newRow, 0, 9, col);
            console.log(`Created new branch at row ${newRow}, connected at column ${col}`);
            break;
            
        case 'HLINE':
            // Extend branch (handled automatically by data structure)
            break;
            
        case 'CLEAR':
            // If clicking on row > 0, remove the entire branch
            if (row > 0) {
                const branch = ladderData.getBranch(row);
                if (branch) {
                    ladderData.removeBranch(row);
                    console.log(`Removed branch at row ${row}`);
                }
            } else {
                // On main rung (row 0), just remove component
                ladderData.removeComponent(row, col);
            }
            break;
    }
    
    renderer.draw();
}

// Show pin assignment dialog
function showPinAssignmentDialog(row, col, event) {
    const branch = ladderData.getBranch(row);
    if (!branch) return;
    
    const component = branch.components.find(c => c.col === col);
    if (!component) return;
    
    const isOutput = component.type === 'OUT';
    const allPins = isOutput ? 
        ladderData.pins.outputs : 
        [...ladderData.pins.inputs, ...ladderData.pins.outputs];
    
    const select = document.createElement('select');
    select.className = 'absolute bg-slate-700 text-white p-2 rounded shadow-lg z-50';
    select.style.left = event.clientX + 'px';
    select.style.top = event.clientY + 'px';
    
    const defaultOption = document.createElement('option');
    defaultOption.textContent = '-- Select Pin --';
    defaultOption.value = '';
    select.appendChild(defaultOption);
    
    allPins.forEach(pin => {
        const option = document.createElement('option');
        option.value = JSON.stringify(pin);
        option.textContent = `${pin.address} - ${pin.label}`;
        if (component.address === pin.address) {
            option.selected = true;
        }
        select.appendChild(option);
    });
    
    select.onchange = () => {
        if (select.value) {
            const pin = JSON.parse(select.value);
            component.address = pin.address;
            component.label = pin.label;
            renderer.draw();
        }
        document.body.removeChild(select);
    };
    
    select.onblur = () => {
        if (document.body.contains(select)) {
            document.body.removeChild(select);
        }
    };
    
    document.body.appendChild(select);
    select.focus();
}

// Simulation controls
document.getElementById('startStopBtn').onclick = () => {
    isSimulationRunning = !isSimulationRunning;
    const btn = document.getElementById('startStopBtn');
    
    if (isSimulationRunning) {
        simulator.start();
        btn.textContent = '⏹ Stop';
        btn.className = 'px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold';
        renderer.setSimulationState(simulator);
    } else {
        simulator.stop();
        btn.textContent = '▶ Start';
        btn.className = 'px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold';
        renderer.setSimulationState(null);
    }
    
    renderPins();
    renderer.draw();
};

document.getElementById('resetBtn').onclick = () => {
    simulator.reset();
    renderPins();
    renderer.setSimulationState(null);
    renderer.draw();
    
    if (isSimulationRunning) {
        isSimulationRunning = false;
        const btn = document.getElementById('startStopBtn');
        btn.textContent = '▶ Start';
        btn.className = 'px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold';
    }
};

// ESC key to deselect tool
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        currentTool = null;
        renderToolbox();
    }
});

// Initialize
window.onload = async () => {
    await loadPins();
    renderToolbox();
    renderer.draw();
};
