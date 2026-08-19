import { TextFileView, WorkspaceLeaf, Notice } from 'obsidian';
import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MermaidStudio } from '../canvas/MermaidStudio';

export const VIEW_TYPE_MERMAID_FILE = 'mermaid-visual-file-view';

export class MermaidFileView extends TextFileView {
  private root: Root | null = null;
  private currentData: string = '';

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_MERMAID_FILE;
  }

  getDisplayText(): string {
    return this.file ? this.file.basename : 'Visual Mermaid Diagram';
  }

  getIcon(): string {
    return 'git-pull-request';
  }

  getViewData(): string {
    return this.currentData;
  }

  setViewData(data: string, clear: boolean): void {
    this.currentData = data || 'flowchart LR\n    A["Start"] --> B["Process"]\n    B --> C["End"]';

    if (clear && this.root) {
      this.root.unmount();
      this.root = null;
    }

    if (!this.root) {
      const container = this.contentEl;
      container.empty();
      container.addClass('mermaid-studio-leaf-root');
      this.root = createRoot(container);
    }

    this.root.render(
      <React.StrictMode>
        <MermaidStudio
          initialCode={this.currentData}
          onCodeChange={(newCode) => {
            this.currentData = newCode;
            this.requestSave();
          }}
          onCopyNotice={() => {
            new Notice('Copied Mermaid syntax to clipboard!');
          }}
        />
      </React.StrictMode>
    );
  }

  clear(): void {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    this.currentData = '';
  }

  async onClose(): Promise<void> {
    this.clear();
  }
}
