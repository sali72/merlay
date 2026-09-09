# Visual Mermaid Studio (`obsidian-visual-mermaid`)

A native, structural visual diagramming plugin for [Obsidian](https://obsidian.md).

Edit and construct **Mermaid flowcharts visually** directly on top of Obsidian's native Mermaid rendering engine. No spatial fighting, no layout drift, and zero code lock-in—just **100% clean, standard, portable Mermaid syntax** that AI assistants and humans can collaborate on seamlessly.

---

## 💡 The Philosophy: Structural, Not Spatial

Mermaid was designed as a code-first, declarative diagramming tool without arbitrary coordinate positioning. Traditional visual editors attempt to fight this by imposing foreign coordinate systems (e.g. React Flow, Elk), leading to broken round-trips and layout mismatches.

**Visual Mermaid Studio** embraces Mermaid's design principles:
- **1:1 Native Obsidian Parity:** Overlays direct-manipulation controls directly on Obsidian's exact Mermaid SVG output.
- **Topological Operations:** Add steps, sprout downstream connections, link nodes, and adjust labels without manual pixel alignment.
- **Ultra-Lean Footprint:** Zero heavy canvas dependencies (no Elk, Dagre, or React Flow). Bundled at just ~170 KB.

---

## ✨ Features

- 🎯 **Inline "Visual Mode" Integration:**
  - Appears seamlessly on hover adjacent to Obsidian's native `Edit this block` button on any ````mermaid```` block in Reading View or Live Preview.
  - Matches Obsidian's native theme styling (light & dark mode compatible).
  - Launches a focused, full-screen interactive modal with zero note distraction.
- ⚡ **Relational Sprouting (`+ Next Step`):**
  - Select any node to reveal the directional sprout button, automatically oriented with diagram flow (`LR` or `TD`). Spawns a downstream connected step in one click.
- 🔗 **Drag-to-Connect Handles:**
  - Hover any node to expose an interactive anchor handle; drag and drop onto any other step to create a new connection.
- ✏️ **Inline Label Editing:**
  - Double-click any node to edit its text inline.
  - Click any arrow to open the floating Edge HUD for editing edge condition labels or deleting connections.
- 📷 **Camera Stabilization (No Jump-Scare):**
  - Automatically tracks and pins the active node on screen when the diagram re-renders, preventing jarring jumps during structural edits.
- 💻 **Live Syntax Drawer:**
  - Slide-out side drawer displaying the live Mermaid text in real-time.
- 📂 **Standalone File Editor:**
  - Open and edit standalone `.mmd` and `.mermaid` files directly from the Obsidian file explorer.
- 🤖 **Zero Lock-In & AI Co-Pilot Ready:**
  - Generates pure, pristine Mermaid syntax without comment hacks (`%% mv: ... %%`). Full bidirectional compatibility with LLMs and git.

---

## 🚀 Installation

### Via BRAT (Beta Testing)
1. Install the [Obsidian BRAT](https://github.com/TfTHacker/obsidian42-brat) community plugin.
2. Open BRAT settings → click **"Add Beta plugin"**.
3. Enter this GitHub repository URL: `https://github.com/sali72/obsidian-visual-mermaid`
4. Click **"Add Plugin"**.

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the latest [Release](https://github.com/sali72/obsidian-visual-mermaid/releases).
2. Copy them into your vault under `.obsidian/plugins/obsidian-visual-mermaid/`.
3. In Obsidian, open **Settings → Community plugins** and enable **Visual Mermaid Studio**.

---

## 📖 Usage

### 1. In-Note Diagram Editing & Insertion
- **Slash Commands (`/`):**
  - Type `/Insert Mermaid Diagram` in Live Preview to pick from template types (Flowchart, State Diagram, etc.).
  - Or type `/flowchart` or `/state` directly to insert and immediately launch Visual Mode.
- **Right-Click Context Menu:**
  - Right-click anywhere in your note editor → **Insert Mermaid Diagram** → select a diagram template.
  - Right-click directly inside an existing Mermaid code block → **Edit Diagram in Visual Mode**.
- **Hover Button:**
  - Hover over any ````mermaid```` block in your notes (Live Preview or Reading View).
  - Click the **"Visual Mode"** button beside "Edit this block".
  - Add nodes, sprout next steps, connect edges, or edit labels. Changes are debounced and saved automatically into your note.

### 2. Standalone `.mmd` Files
- **File Explorer Right-Click:** Right-click any folder in the Obsidian File Explorer → **New Mermaid Diagram** to create a `.mmd` file directly inside that folder.
- **Ribbon & Command Palette:**
  - Click the **Visual Mermaid Studio** ribbon icon on the left sidebar.
  - Or press `Ctrl + P` / `Cmd + P` and run `Visual Mermaid Studio: Create New Mermaid Diagram (File)`.
  - Or open any `.mmd` or `.mermaid` file in your vault.

### 3. Command Palette
- `Visual Mermaid Studio: Insert Mermaid Diagram`: Insert a diagram block into the current note at cursor.
- `Visual Mermaid Studio: Insert Mermaid Diagram: Flowchart`: Directly insert a flowchart block and launch Visual Mode.
- `Visual Mermaid Studio: Insert Mermaid Diagram: State Diagram`: Directly insert a state diagram block and launch Visual Mode.
- `Visual Mermaid Studio: Open Visual Mode for Current Diagram`: Open the visual editor for the diagram block under cursor.
- `Visual Mermaid Studio: Create New Mermaid Diagram (File)`: Create a standalone `.mmd` file.

---

## ⌨️ Interaction Guide

| Interaction | Action |
| :--- | :--- |
| `Click Node` | Select node and reveal `+ Next Step` sprout HUD |
| `Click "+ Next Step"` | Sprout a connected child step downstream |
| `Drag from Node Handle` | Connect to another node |
| `Double Click Node` | Edit node label inline |
| `Click Edge` | Open Edge HUD (edit label or delete) |
| `Delete` / `Backspace` | Delete selected node or edge |
| `Mouse Drag Canvas` | Pan diagram |
| `Mouse Wheel / Trackpad` | Zoom in / out |

---

## 🛠️ Development

```bash
# Install dependencies
npm install

# Build production bundle
npm run build

# Run unit tests
npm test
```

### Architecture & Contributing
- [Architecture Guide](ARCHITECTURE.md): Design philosophy, module map, and engineering rules.
- [Adding a New Diagram Type](docs/ADDING_NEW_DIAGRAM.md): 5-phase procedure and AI prompt template for extending the diagram driver system.

---

## 📄 License

MIT License © 2026 Ali
