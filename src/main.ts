import {
  Plugin,
  WorkspaceLeaf,
  Notice,
  MarkdownView,
  TFile,
  setIcon,
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
import { MermaidBlockModal } from './views/MermaidBlockModal';

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
      this.scanAndAttachToElement(element, context.sourcePath);

      // MutationObserver to catch asynchronous Mermaid SVG rendering
      const observer = new MutationObserver(() => {
        this.scanAndAttachToElement(element, context.sourcePath);
      });
      observer.observe(element, { childList: true, subtree: true });

      context.addChild({
        unload() {
          observer.disconnect();
        },
      } as any);
    });

    // 3. Workspace events to auto-attach in Live Preview CodeMirror 6 views
    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        this.scanActiveView();
      })
    );
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        this.scanActiveView();
      })
    );

    // Initial scan after workspace is ready
    this.app.workspace.onLayoutReady(() => {
      this.scanActiveView();
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

  scanActiveView() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return;
    this.scanAndAttachToElement(view.contentEl, view.file?.path);
  }

  scanAndAttachToElement(container: HTMLElement, sourcePath?: string) {
    const selector =
      '.block-language-mermaid, .mermaid, pre.language-mermaid, [class*="language-mermaid"], .cm-embed-block, .cm-preview-code-block, svg[id*="mermaid"]';

    if (container.matches?.(selector)) {
      this.attachButtonToTarget(container, sourcePath);
    }

    container.querySelectorAll(selector).forEach((el) => {
      this.attachButtonToTarget(el as HTMLElement, sourcePath);
    });
  }

  attachButtonToTarget(el: HTMLElement, sourcePath?: string) {
    // Locate the outermost container box
    const parent =
      (el.closest('.cm-preview-code-block') as HTMLElement) ||
      (el.closest('.cm-embed-block') as HTMLElement) ||
      (el.classList?.contains('block-language-mermaid')
        ? el
        : (el.closest('.block-language-mermaid') as HTMLElement)) ||
      (el.classList?.contains('mermaid')
        ? el
        : (el.closest('.mermaid') as HTMLElement)) ||
      el.parentElement ||
      el;

    if (!parent) return;
    if (parent.querySelector('.mermaid-studio-edit-btn')) return;

    parent.style.position = 'relative';

    const editBtn = createEl('button', {
      cls: 'mermaid-studio-edit-btn',
    });
    const iconSpan = editBtn.createSpan({ cls: 'mermaid-edit-btn-icon' });
    setIcon(iconSpan, 'git-pull-request');
    editBtn.createSpan({ text: 'Visual Mode' });

    editBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();

      const filePath =
        sourcePath || this.app.workspace.getActiveFile()?.path;
      if (!filePath) {
        new Notice('Could not determine note file path.');
        return;
      }

      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile)) {
        new Notice('File not found in vault.');
        return;
      }

      const content = await this.app.vault.read(file);
      const matches = Array.from(
        content.matchAll(/```(?:mermaid)\s*\n([\s\S]*?)```/g)
      );

      if (matches.length === 0) {
        new Notice('No Mermaid diagram block found in note.');
        return;
      }

      // If multiple blocks, find best match by comparing node text content
      let targetMatch = matches[0];
      if (matches.length > 1) {
        const blockText = parent.textContent || '';
        for (const m of matches) {
          const lines = m[1].split('\n');
          let score = 0;
          for (const l of lines) {
            const trimmed = l.trim();
            if (
              trimmed &&
              !trimmed.startsWith('%%') &&
              !trimmed.startsWith('flowchart') &&
              !trimmed.startsWith('graph')
            ) {
              const labelMatch = trimmed.match(
                /\["?(.*?)"?\]|\("?(.*?)"?\)|\{"?(.*?)"?\}/
              );
              if (labelMatch && blockText.includes(labelMatch[1])) {
                score++;
              }
            }
          }
          if (score > 0) {
            targetMatch = m;
            break;
          }
        }
      }

      const rawCode = targetMatch[1];
      const matchIndex = targetMatch.index || 0;
      const linesBefore = content.substring(0, matchIndex).split('\n');
      const matchLines = targetMatch[0].split('\n');
      const sectionInfo = {
        lineStart: linesBefore.length - 1,
        lineEnd: linesBefore.length - 1 + matchLines.length - 1,
        text: content,
      };

      // Scope Check: Only allow flowcharts in MVP
      const firstContentLine =
        rawCode
          .split('\n')
          .find((l) => l.trim().length > 0 && !l.trim().startsWith('%%'))
          ?.trim()
          .toLowerCase() || '';

      if (
        !firstContentLine.startsWith('flowchart') &&
        !firstContentLine.startsWith('graph')
      ) {
        new Notice(
          'Visual Mode currently supports Flowcharts (flowchart / graph).'
        );
        return;
      }

      new MermaidBlockModal(
        this.app,
        this,
        filePath,
        sectionInfo,
        rawCode
      ).open();
    });

    parent.appendChild(editBtn);
  }

  async openVisualModeForActiveFile(view: MarkdownView) {
    const file = view.file;
    if (!file) return;
    const content = await this.app.vault.read(file);
    const match = content.match(/```(?:mermaid)\s*\n([\s\S]*?)```/);
    if (!match) {
      new Notice('No Mermaid code block found in active note.');
      return;
    }

    const rawCode = match[1];
    const matchIndex = match.index || 0;
    const linesBefore = content.substring(0, matchIndex).split('\n');
    const matchLines = match[0].split('\n');
    const sectionInfo = {
      lineStart: linesBefore.length - 1,
      lineEnd: linesBefore.length - 1 + matchLines.length - 1,
      text: content,
    };

    new MermaidBlockModal(
      this.app,
      this,
      file.path,
      sectionInfo,
      rawCode
    ).open();
  }

  async createNewDiagram() {
    try {
      const activeFile = this.app.workspace.getActiveFile();
      const parentDir = activeFile?.parent ? activeFile.parent.path : '';
      const baseName = 'New Diagram';
      let fileName = `${baseName}.mmd`;
      let counter = 1;

      while (
        this.app.vault.getAbstractFileByPath(
          parentDir ? `${parentDir}/${fileName}` : fileName
        )
      ) {
        fileName = `${baseName} ${counter++}.mmd`;
      }

      const fullPath = parentDir ? `${parentDir}/${fileName}` : fileName;
      const initialCode = `flowchart ${this.settings.defaultDirection}\n    A["Start"] --> B["Process"]\n    B --> C["End"]\n`;

      const createdFile = await this.app.vault.create(fullPath, initialCode);
      const leaf = this.app.workspace.getLeaf('tab');
      await leaf.openFile(createdFile);

      new Notice(`Created diagram: ${fileName}`);
    } catch (e: any) {
      new Notice(`Error creating diagram: ${e.message}`);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
