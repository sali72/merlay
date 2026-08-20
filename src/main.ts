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

    // 2. Register Markdown Post-Processor for in-note ```mermaid blocks
    this.registerMarkdownPostProcessor((element, context) => {
      const mermaidBlocks = element.querySelectorAll(
        '.block-language-mermaid, pre.language-mermaid'
      );

      mermaidBlocks.forEach((block) => {
        if (block.querySelector('.mermaid-studio-edit-btn')) return;

        (block as HTMLElement).style.position = 'relative';

        const editBtn = createEl('button', {
          cls: 'mermaid-studio-edit-btn',
        });
        const iconSpan = editBtn.createSpan({ cls: 'mermaid-edit-btn-icon' });
        setIcon(iconSpan, 'git-pull-request');
        editBtn.createSpan({ text: 'Edit Diagram' });

        editBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const sectionInfo = context.getSectionInfo(block as HTMLElement);
          if (!sectionInfo) {
            new Notice('Could not determine code block location in file.');
            return;
          }

          const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
          if (file instanceof TFile) {
            const content = await this.app.vault.read(file);
            const lines = content.split('\n');
            const codeLines = lines.slice(
              sectionInfo.lineStart + 1,
              sectionInfo.lineEnd
            );
            const rawCode = codeLines.join('\n');

            new MermaidBlockModal(
              this.app,
              this,
              context.sourcePath,
              sectionInfo,
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
