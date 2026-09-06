import {
  Plugin,
  WorkspaceLeaf,
  Notice,
  MarkdownRenderChild,
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

    // 2. Register Markdown Post-Processor for in-note ```mermaid blocks (Reading View & Live Preview)
    this.registerMarkdownPostProcessor((element, context) => {
      const selector =
        '.block-language-mermaid, pre.language-mermaid, .mermaid, [class*="language-mermaid"]';

      const mermaidBlocks: HTMLElement[] = [];

      // Check if element itself matches
      if (element.matches?.(selector)) {
        mermaidBlocks.push(element);
      }

      // Check child descendants
      element.querySelectorAll(selector).forEach((el) => {
        mermaidBlocks.push(el as HTMLElement);
      });

      // Fallback for Live Preview CM6 embeds rendering SVG directly
      if (mermaidBlocks.length === 0) {
        const mermaidSvg = element.querySelector(
          'svg[id*="mermaid"], svg .node, svg .flowchart-link'
        );
        if (mermaidSvg) {
          const container =
            mermaidSvg.closest('.cm-embed-block') ||
            mermaidSvg.parentElement ||
            element;
          mermaidBlocks.push(container as HTMLElement);
        }
      }

      mermaidBlocks.forEach((block) => {
        if (block.querySelector('.mermaid-studio-edit-btn')) return;

        (block as HTMLElement).style.position = 'relative';

        const editBtn = createEl('button', {
          cls: 'mermaid-studio-edit-btn',
        });
        const iconSpan = editBtn.createSpan({ cls: 'mermaid-edit-btn-icon' });
        setIcon(iconSpan, 'git-pull-request');
        editBtn.createSpan({ text: 'Visual Mode' });

        editBtn.addEventListener('click', async (e) => {
          e.stopPropagation();

          let sectionInfo = context.getSectionInfo(block as HTMLElement);
          if (!sectionInfo && element) {
            sectionInfo = context.getSectionInfo(element);
          }

          const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
          if (file instanceof TFile) {
            const content = await this.app.vault.read(file);
            let rawCode = '';

            if (sectionInfo) {
              const lines = content.split('\n');
              const codeLines = lines.slice(
                sectionInfo.lineStart + 1,
                sectionInfo.lineEnd
              );
              rawCode = codeLines.join('\n');
            } else {
              // Live Preview CM6 fallback: extract first matching mermaid block
              const match = content.match(/```(?:mermaid)\n([\s\S]*?)```/);
              if (match) {
                rawCode = match[1];
                const linesBefore = content
                  .substring(0, match.index || 0)
                  .split('\n');
                const matchLines = match[0].split('\n');
                sectionInfo = {
                  lineStart: linesBefore.length - 1,
                  lineEnd: linesBefore.length - 1 + matchLines.length - 1,
                  text: content,
                };
              }
            }

            if (!rawCode) {
              new Notice('Could not locate Mermaid block in note.');
              return;
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
              context.sourcePath,
              sectionInfo || { lineStart: 0, lineEnd: 0 },
              rawCode
            ).open();
          }
        });

        block.appendChild(editBtn);
        context.addChild(new MarkdownRenderChild(editBtn));
      });
    });

    // 3. Ribbon Icon
    this.addRibbonIcon('git-pull-request', 'Visual Mermaid Studio', () => {
      this.createNewDiagram();
    });

    // 4. Commands
    this.addCommand({
      id: 'create-new-mermaid-diagram',
      name: 'Create New Mermaid Diagram',
      callback: () => {
        this.createNewDiagram();
      },
    });

    // 5. Settings Tab
    this.addSettingTab(new VisualMermaidSettingTab(this.app, this));
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
