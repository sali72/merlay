# Visual Mermaid Studio (`obsidian-visual-mermaid`)

A native, bidirectional drag-and-drop visual diagramming plugin for [Obsidian](https://obsidian.md).

Build and modify **Mermaid flowcharts visually** with zero coding friction, while generating **100% clean, standard, portable Mermaid syntax** that AI assistants and humans can collaborate on seamlessly.

---

## ✨ Features

- 🎨 **Visual Drag & Drop Canvas**: Interactive, hardware-accelerated canvas with smooth zooming, panning, and minimap powered by React Flow.
- ⚡ **Quick-Sprout Creation**: Hover directional handles (`+`) or press `Tab` / `Enter` to sprout and connect nodes instantly with zero menu hunting.
- 🔀 **Drag-to-Splice Connections**: Drop a new node directly onto an existing arrow (`A --> B`) to automatically splice it in (`A --> NewNode --> B`).
- 🔷 **All 9 Mermaid Flowchart Shapes**: Rectangles `[]`, Rounded `()`, Stadium `([])`, Subroutines `[[]]`, Database Cylinders `[()]`, Circles `(())`, Diamonds `{}`, Hexagons `{{}}`, and Parallelograms `[/ /]`.
- ✏️ **Floating Action Menus**: In-place shape morphing, color palette pickers, and line style selectors (`-->`, `-.->`, `==>`, `<-->`).
- 🤖 **Zero Lock-In & AI Co-Pilot Ready**: Generates pure, standard Mermaid code with **no comment metadata hacks** (`%% mv: ... %%`). AI-generated diagrams parse and render with zero layout breakage.
- 🪄 **Deterministic Auto-Tidy**: Powered by **Elk.js** graph layout engine for clean, collision-free architecture diagrams.
- 📝 **Dual-Mode Integration**:
  - **Standalone Files**: Open `.mmd` and `.mermaid` files directly from your Obsidian file explorer.
  - **Inline Note Editing**: Click the floating **"✏️ Edit"** button above any ````mermaid```` block in your notes to edit visually in a synchronized split pane.
- ⏪ **Snapshot Undo / Redo**: Full `Ctrl+Z` / `Ctrl+Shift+Z` history.

---

## 🚀 Installation

### Via BRAT (Beta Testing)
1. Install the [Obsidian BRAT](https://github.com/TfTHacker/obsidian42-brat) community plugin.
2. Open BRAT settings → click **"Add Beta plugin"**.
3. Enter this GitHub repository URL and click **"Add Plugin"**.

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the latest [Release](https://github.com/sali72/obsidian-visual-mermaid/releases).
2. Copy them into your vault under `.obsidian/plugins/obsidian-visual-mermaid/`.
3. In Obsidian, go to **Settings → Community plugins** and enable **Visual Mermaid Studio**.

---

## 📖 Usage

### 1. Creating a Standalone Diagram
- Run the command: `Visual Mermaid Studio: Create New Diagram`.
- Or create a new file named `diagram.mmd` or `architecture.mermaid` in your vault and open it.

### 2. Editing In-Note Diagrams
- Hover over any rendered Mermaid block in Reading View or Live Preview.
- Click the **"✏️ Edit"** button in the top-right corner to open the Visual Studio split pane.

### 3. Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Tab` | Sprout connected child node from selection |
| `Enter` | Create new unconnected node |
| `Double Click Node` | Edit label inline |
| `Ctrl + Z` / `Cmd + Z` | Undo |
| `Ctrl + Shift + Z` / `Cmd + Shift + Z` | Redo |
| `Delete` / `Backspace` | Delete selected node or edge |

---

## 🛠️ Development

```bash
# Install dependencies
npm install

# Start development build with watch mode
npm run dev

# Production build
npm run build

# Run unit tests
npm test
```

---

## 📄 License

MIT License © 2026 Ali
