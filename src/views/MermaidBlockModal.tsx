import { Modal, App, Notice, TFile } from 'obsidian';
import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MermaidStudio } from '../canvas/MermaidStudio';

export interface SectionInfo {
  lineStart: number;
  lineEnd: number;
  text?: string;
}

export class MermaidBlockModal extends Modal {
  private root: Root | null = null;
  private filePath: string;
  private sectionInfo: SectionInfo;
  private initialCode: string;
  private latestCode: string;

  constructor(
    app: App,
    filePath: string,
    sectionInfo: SectionInfo,
    initialCode: string
  ) {
    super(app);
    this.filePath = filePath;
    this.sectionInfo = sectionInfo;
    this.initialCode = initialCode.trim();
    this.latestCode = this.initialCode;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('mermaid-block-modal-root');

    this.root = createRoot(contentEl);
    this.root.render(
      <React.StrictMode>
        <MermaidStudio
          initialCode={this.initialCode}
          onCodeChange={(newCode) => {
            this.latestCode = newCode;
            this.saveToNote();
          }}
          onCopyNotice={() => {
            new Notice('Copied Mermaid syntax to clipboard!');
          }}
        />
      </React.StrictMode>
    );
  }

  onClose(): void {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }

  private async saveToNote(): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(this.filePath);
    if (!(file instanceof TFile)) return;

    try {
      await this.app.vault.process(file, (data) => {
        const lines = data.split('\n');
        const startLine = this.sectionInfo.lineStart;
        const endLine = this.sectionInfo.lineEnd;

        // Replace the code block slice while preserving opening & closing fences
        const before = lines.slice(0, startLine + 1);
        const after = lines.slice(endLine);
        const codeLines = this.latestCode.split('\n');

        return [...before, ...codeLines, ...after].join('\n');
      });
    } catch (e: any) {
      console.error('Error saving mermaid block to note:', e);
    }
  }
}
