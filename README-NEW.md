# PLC Ladder Diagram Simulator - Clean Version

## New Structure

This is a complete rewrite with a clean, well-structured architecture.

### Files:

1. **index-new.html** - Main HTML page (clean UI)
2. **ladder-data.js** - Data structure manager (branches, components, pins)
3. **ladder-renderer.js** - Canvas drawing engine
4. **ladder-simulator.js** - Logic execution engine
5. **app.js** - Main application controller
6. **pins.json** - I/O pin definitions

### Data Structure:

```javascript
{
  "rungs": [{
    "id": 0,
    "branches": [{
      "id": 0,
      "row": 0,
      "start_col": 0,
      "end_col": 9,
      "parent_branch_id": null,
      "connection_col": null,
      "components": [{
        "type": "NO",
        "address": "I:0/0",
        "label": "Input 0",
        "col": 1
      }]
    }]
  }]
}
```

### How It Works:

#### 1. Data Layer (ladder-data.js)
- Manages branches and components
- Each branch has a row, start/end columns, and list of components
- Components are ordered by column
- Clear parent-child relationships between branches

#### 2. Rendering Layer (ladder-renderer.js)
- Draws based on data structure
- No logic, just visualization
- Supports simulation state highlighting

#### 3. Simulation Layer (ladder-simulator.js)
- Evaluates branches in order (top to bottom)
- Evaluates components left to right within each branch
- Simple logic:
  - NO contact: passes power if input is ON
  - NC contact: passes power if input is OFF
  - Output coil: turns ON if power reaches it

#### 4. Application Layer (app.js)
- Coordinates between layers
- Handles user interactions
- Manages simulation state

### Key Improvements:

✅ **No more confusion about connections** - Explicit data structure
✅ **Simple simulation logic** - Linear evaluation, easy to understand
✅ **Clean separation of concerns** - Each file has one responsibility
✅ **Easy to debug** - Clear data flow
✅ **Easy to extend** - Add new component types easily

### Usage:

1. Open `index-new.html` in a browser (use local server)
2. Select a tool (NO, NC, OUT, V-Line, etc.)
3. Click on canvas to place components
4. Double-click components to assign pins
5. Click "Start" to begin simulation
6. Click input pins to toggle them
7. Watch outputs respond in real-time

### Testing:

```bash
# Start local server
python3 -m http.server 8080

# Open browser
http://localhost:8080/index-new.html
```

### Next Steps:

Once this version is working correctly, we can:
- Replace old index.html with this clean version
- Add more component types (timers, counters)
- Add save/load functionality
- Add export to PLC code
