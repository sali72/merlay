import {
  Plugin,
  WorkspaceLeaf,
  MarkdownView,
  MarkdownPostProcessorContext,
} from 'obsidian';
import {
  DEFAULT_SETTINGS,
  VisualMermaidSettings,
  VisualMermaidSettingTab,
} from './settings/SettingsTab';
import {
  MermaidFileView,
  VIEW_TYPE_MERMAID_FILE,
} from './views/MermaidFileView';
import {
  MermaidObserverChild,
  setupGlobalWorkspaceObserver,
  scanAndAttachToElement,
  scanActiveWorkspace,
  scanActiveView,
} from './obsidian/workspaceObserver';
import {
  createNewDiagram,
  createDiagramFileWithTemplate,
  openVisualModeForActiveFile,
} from './obsidian/diagramOpener';

export default class VisualMermaidPlugin extends Plugin {
  public settings: VisualMermaidSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();

    // 1. Register custom File View for standalone .mmd and .mermaid files
    this.registerView(
      VIEW_TYPE_MERMAID_FILE,
      (leaf: WorkspaceLeaf) => new MermaidFileView(leaf, this)
    );
    this.registerExtensions(['mmd', 'mermaid'], VIEW_TYPE_MERMAID_FILE);

    // 2. Register Markdown Post-Processor (Reading View & Live Preview)
    this.registerMarkdownPostProcessor((element, context) => {
      const info = context.getSectionInfo(element);
      if (info) {
        element.setAttribute('data-mermaid-line-start', String(info.lineStart));
        element.setAttribute('data-mermaid-line-end', String(info.lineEnd));
      }
      scanAndAttachToElement(element, this, context.sourcePath, context);

      // MutationObserver to catch asynchronous Mermaid SVG rendering
      const observer = new MutationObserver(() => {
        scanAndAttachToElement(element, this, context.sourcePath, context);
      });
      observer.observe(element, { childList: true, subtree: true });

      context.addChild(new MermaidObserverChild(element, observer));
    });

    // 3. Global workspace DOM observer for Live Preview & Reading View
    this.app.workspace.onLayoutReady(() => {
      setupGlobalWorkspaceObserver(this);
    });

    // 4. Ribbon Icon
    this.addRibbonIcon('git-pull-request', 'Visual Mermaid Studio', () => {
      this.createNewDiagram();
    });

    // 5. Commands
    this.addCommand({
      id: 'create-new-mermaid-diagram',
      name: 'Create New Mermaid Diagram',
      callback: () => {
        this.createNewDiagram();
      },
    });

    this.addCommand({
      id: 'open-visual-mode-active-note',
      name: 'Open Visual Mode for Current Diagram',
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          if (!checking) {
            this.openVisualModeForActiveFile(view);
          }
          return true;
        }
        return false;
      },
    });

    // 6. Settings Tab
    this.addSettingTab(new VisualMermaidSettingTab(this.app, this));
  }

  // Delegated helpers for backward compatibility
  scanActiveWorkspace(): void {
    scanActiveWorkspace(this);
  }

  scanActiveView(): void {
    scanActiveView(this);
  }

  scanAndAttachToElement(
    container: HTMLElement,
    sourcePath?: string,
    context?: MarkdownPostProcessorContext
  ): void {
    scanAndAttachToElement(container, this, sourcePath, context);
  }

  openVisualModeForActiveFile(view: MarkdownView): Promise<void> {
    return openVisualModeForActiveFile(this, view);
  }

  createNewDiagram(): Promise<void> {
    return createNewDiagram(this);
  }

  createDiagramFileWithTemplate(initialCode: string): Promise<void> {
    return createDiagramFileWithTemplate(this, initialCode);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
