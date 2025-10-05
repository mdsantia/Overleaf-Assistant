# Overleaf Helper

**Version:** 1.8.8  
**Chrome Manifest Version:** 4  

Overleaf Helper is a Chrome extension designed to **streamline and enhance your Overleaf workflow**. It simplifies project management, template handling, and customizations while providing keyboard shortcuts and offline backup integration.

---

## Features

### 1. Project & Template Management
- Add your Overleaf projects to a local database.
- Upload templates to a specific project based on your configuration.
- Quickly access templates and project-specific material via the extension popup.

### 2. Offline Backup & Synchronization
- Integrates local backups for offline work.
- Restore or sync your project data when back online.

### 3. Floating Sidepanel Shortcuts
- Access frequently used shortcuts while working on any open Overleaf project.
- Navigate files, toggle views, and trigger custom actions without leaving the page.

### 4. Popup Interface
- Quickly access project material, templates, and configuration options.
- Central hub for managing projects and template customizations.

### 5. Keyboard Shortcuts
| Command            | Default (Windows/Linux)   | Default (Mac)           | Description                       |
|-------------------|---------------------------|------------------------|-----------------------------------|
| `open-files`       | Ctrl + H                  | Command + H            | Toggle file tree visibility       |
| `toggle-forward`   | Ctrl + Shift + Right      | Command + Shift + Right| Move to the next option           |
| `toggle-backward`  | Ctrl + Shift + Left       | Command + Shift + Left | Move to the previous option       |
| `_execute_action`  | Ctrl + Shift + E          | Command + Shift + E    | Activate the extension            |

---

## File Structure

Overleaf-Helper/

├── config/ # Configuration tab for altering project-specific settings

├── icons/ # PNG icons of various sizes

├── sidepanel/ # Floating sidepanel with shortcuts for open projects

│ ├── background.js

│ └── content.js

├── template-generation/ # Builds and uploads files from templates to projects

├── popup.html # Extension popup interface

├── popup.js

├── manifest.json

└── README.md

---

## Installation

1. Clone or download the repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (top right corner).
4. Click **Load unpacked** and select the extension directory.
5. The Overleaf Helper icon should appear in your Chrome toolbar.

---

## Usage

1. Open an Overleaf project in Chrome.
2. Use the **floating sidepanel** to access shortcuts and actions directly on your project.
3. Use the **popup interface** to access project-specific templates, backups, and configurations.
4. Add or customize projects in the **config tab** to tailor workflows and template behavior.
5. Offline work is supported via local backups; synced automatically when online.

---

## Permissions

- `activeTab` – Interact with the currently open project tab.
- `scripting` – Inject scripts for sidepanel and template functionality.
- `commands` – Handle keyboard shortcuts for fast navigation.
- `storage` – Save project data, templates, and user preferences.
- `fileSystem` – Support local backup integration.
- `contextMenus` – Add right-click menu actions for enhanced workflow.

---

## Contributing

1. Fork the repository.
2. Create a new feature branch: `git checkout -b feature-name`.
3. Commit your changes: `git commit -m "Add feature"`.
4. Push to the branch: `git push origin feature-name`.
5. Open a pull request detailing your changes.

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

## Contact

For questions, suggestions, or bug reports, reach out to **[Your Name]** at **[your-email@example.com]**.

---

Enhance your Overleaf workflow with **Overleaf Helper**: fast, customizable, and offline-ready! 🚀