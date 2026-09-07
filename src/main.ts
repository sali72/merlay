import {
  Plugin,
  WorkspaceLeaf,
  Notice,
  MarkdownView,
  MarkdownRenderChild,
  MarkdownPostProcessorContext,
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

class MermaidObserverChild extends MarkdownRenderChild {
  private observer: MutationObserver;

  constructor(containerEl: HTMLElement, observer: MutationObserver) {
    super(containerEl);
    this.observer = observer;
  }

  onunload(): void {
    this.observer.disconnect();
  }
}

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
      this.scanAndAttachToElement(element, context.sourcePath, context);

      // MutationObserver to catch asynchronous Mermaid SVG rendering
      const observer = new MutationObserver(() => {
        this.scanAndAttachToElement(element, context.sourcePath, context);
      });
      observer.observe(element, { childList: true, subtree: true });

      context.addChild(new MermaidObserverChild(element, observer));
    });

    // 3. Global workspace DOM observer for Live Preview & Reading View
    this.app.workspace.onLayoutReady(() => {
      this.setupGlobalWorkspaceObserver();
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

  setupGlobalWorkspaceObserver() {
    let scanTimer: number | null = null;
    const scheduleScan = (delay = 100) => {
      if (scanTimer !== null) window.clearTimeout(scanTimer);
      scanTimer = window.setTimeout(() => {
        scanTimer = null;
        this.scanActiveWorkspace();
      }, delay);
    };

    const target = this.app.workspace.containerEl || document.body;
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          scheduleScan(120);
          return;
        }
      }
    });

    observer.observe(target, {
      childList: true,
      subtree: true,
    });

    this.register(() => {
      observer.disconnect();
      if (scanTimer !== null) window.clearTimeout(scanTimer);
    });

    // Initial staggered scans to catch asynchronously rendered diagrams
    scheduleScan(50);
    scheduleScan(250);
    scheduleScan(600);
    scheduleScan(1200);

    // Also re-scan on workspace layout and leaf changes
    this.registerEvent(
      this.app.workspace.on('layout-change', () => scheduleScan(100))
    );
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => scheduleScan(100))
    );
    this.registerEvent(
      this.app.workspace.on('editor-change', () => scheduleScan(150))
    );
  }

  scanActiveWorkspace() {
    const root = this.app.workspace.containerEl || document.body;
    this.scanAndAttachToElement(root);
  }

  scanActiveView() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return;
    this.scanAndAttachToElement(view.contentEl, view.file?.path);
  }

  scanAndAttachToElement(
    container: HTMLElement,
    sourcePath?: string,
    context?: MarkdownPostProcessorContext
  ) {
    // Never scan inside our own editor modal or standalone view
    if (
      container.closest('.mod-mermaid-block-modal') ||
      container.closest('.mermaid-block-modal-root') ||
      container.closest('.mermaid-file-view-root') ||
      container.closest('.mermaid-native-container') ||
      container.closest('.mermaid-native-view') ||
      container.closest('.mermaid-native-editor-root') ||
      container.closest('.mermaid-studio-leaf-root') ||
      container.closest('.mermaid-native-world') ||
      container.closest('.mermaid-native-svg-mount')
    ) {
      return;
    }

    const mermaidSelectors = [
      '.block-language-mermaid',
      '.mermaid',
      'pre.language-mermaid',
      'svg[id*="mermaid"]',
      'svg .flowchart-link',
    ];

    const targets: HTMLElement[] = [];
    for (const sel of mermaidSelectors) {
      if (container.matches?.(sel)) {
        targets.push(container);
      }
      container.querySelectorAll(sel).forEach((el) => {
        targets.push(el as HTMLElement);
      });
    }

    const seenContainers = new Set<HTMLElement>();
    for (const el of targets) {
      const parent = this.findMermaidContainer(el);
      if (parent && !seenContainers.has(parent)) {
        seenContainers.add(parent);
        this.attachButtonToTarget(parent, sourcePath, context);
      }
    }
  }

  findMermaidContainer(el: HTMLElement): HTMLElement | null {
    // 1. STRICT: Never attach button inside Visual Mermaid modals or editor views
    if (
      el.closest('.mod-mermaid-block-modal') ||
      el.closest('.mermaid-block-modal-root') ||
      el.closest('.mermaid-file-view-root') ||
      el.closest('.mermaid-native-container') ||
      el.closest('.mermaid-native-view') ||
      el.closest('.mermaid-native-editor-root') ||
      el.closest('.mermaid-studio-leaf-root') ||
      el.closest('.mermaid-native-world') ||
      el.closest('.mermaid-native-svg-mount')
    ) {
      return null;
    }

    // 2. In Live Preview (CodeMirror 6), find the embed container
    const cmBlock =
      el.closest('.cm-preview-code-block') || el.closest('.cm-embed-block');
    if (cmBlock) return cmBlock as HTMLElement;

    // 3. In Reading View, find .block-language-mermaid
    const blockLang = el.classList?.contains('block-language-mermaid')
      ? el
      : el.closest('.block-language-mermaid');
    if (blockLang) return blockLang as HTMLElement;

    const mermaidDiv = el.classList?.contains('mermaid')
      ? el
      : el.closest('.mermaid');
    if (mermaidDiv) return mermaidDiv as HTMLElement;

    return el.parentElement || el;
  }

  attachButtonToTarget(
    parent: HTMLElement,
    sourcePath?: string,
    context?: MarkdownPostProcessorContext
  ) {
    if (
      !parent ||
      parent.closest('.mod-mermaid-block-modal') ||
      parent.closest('.mermaid-block-modal-root') ||
      parent.closest('.mermaid-file-view-root') ||
      parent.closest('.mermaid-native-container') ||
      parent.closest('.mermaid-native-view')
    ) {
      return;
    }

    if (parent.querySelector(':scope > .mermaid-studio-edit-btn')) return;

    parent.style.position = 'relative';

    const editBtn = createEl('button', {
      cls: 'mermaid-studio-edit-btn clickable-icon',
      attr: {
        'aria-label': 'Edit in visual mode',
      },
    });
    setIcon(editBtn, 'git-pull-request');

    // Dynamic positioning: match dimensions and place cleanly to the left of Obsidian's "Edit this block"
    const adjustPosition = () => {
      const editBlockBtn = parent.querySelector(
        '.edit-block-button'
      ) as HTMLElement;

      if (editBlockBtn) {
        const parentRect = parent.getBoundingClientRect();
        const ebRect = editBlockBtn.getBoundingClientRect();

        if (ebRect.width > 0 && parentRect.width > 0) {
          // Exactly match Obsidian's button dimensions
          editBtn.style.width = `${Math.round(ebRect.width)}px`;
          editBtn.style.height = `${Math.round(ebRect.height)}px`;

          // Position immediately to the left with 4px gap
          const offsetRight = Math.max(
            4,
            Math.round(parentRect.right - ebRect.left + 4)
          );
          editBtn.style.right = `${offsetRight}px`;
          editBtn.style.left = 'auto';

          // Match exact vertical top offset
          const topDiff = Math.round(ebRect.top - parentRect.top);
          if (topDiff >= 0) {
            editBtn.style.top = `${topDiff}px`;
          }
          return;
        }
      }

      // Default fallback
      editBtn.style.width = '28px';
      editBtn.style.height = '28px';
      editBtn.style.right = '36px';
      editBtn.style.top = 'var(--size-2-2, 8px)';
      editBtn.style.left = 'auto';
    };

    adjustPosition();
    parent.addEventListener('mouseenter', adjustPosition);
    editBtn.addEventListener('mouseenter', adjustPosition);

    editBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();

      // Resolve file path: check sourcePath, then enclosing leaf, then active view
      let filePath = sourcePath;
      if (!filePath) {
        const leaves = this.app.workspace.getLeavesOfType('markdown');
        for (const leaf of leaves) {
          if (
            leaf.view instanceof MarkdownView &&
            leaf.view.containerEl.contains(parent)
          ) {
            filePath = leaf.view.file?.path;
            break;
          }
        }
      }
      if (!filePath) {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        filePath = activeView?.file?.path || this.app.workspace.getActiveFile()?.path;
      }

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

      // Check context getSectionInfo first
      let sectionInfo = context ? context.getSectionInfo(parent) : null;
      let rawCode = '';

      if (sectionInfo) {
        const lines = content.split('\n');
        rawCode = lines
          .slice(sectionInfo.lineStart + 1, sectionInfo.lineEnd)
          .join('\n');
      } else {
        const matches = Array.from(
          content.matchAll(/```(?:mermaid)\s*\n([\s\S]*?)```/g)
        );

        if (matches.length === 0) {
          new Notice('No Mermaid diagram block found in note.');
          return;
        }

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

        rawCode = targetMatch[1];
        const matchIndex = targetMatch.index || 0;
        const linesBefore = content.substring(0, matchIndex).split('\n');
        const matchLines = targetMatch[0].split('\n');
        sectionInfo = {
          lineStart: linesBefore.length - 1,
          lineEnd: linesBefore.length - 1 + matchLines.length - 1,
          text: content,
        };
      }

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
