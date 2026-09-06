import { Modal, App, Notice, TFile } from 'obsidian';
import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { NativeMermaidView } from '../canvas/NativeMermaidView';
import type VisualMermaidPlugin from '../main';

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
  private plugin: VisualMermaidPlugin;
  private saveTimeout: number | null = null;

  constructor(
    app: App,
    plugin: VisualMermaidPlugin,
    filePath: string,
    sectionInfo: SectionInfo,
    initialCode: string
  ) {
    super(app);
    this.plugin = plugin;
    this.filePath = filePath;
    this.sectionInfo = sectionInfo;
    this.initialCode = initialCode.trim();
    this.latestCode = this.initialCode;
  }

  onOpen(): void {
    const { contentEl, modalEl } = this;
    modalEl.addClass('mod-mermaid-block-modal');
    contentEl.empty();
    contentEl.addClass('mermaid-block-modal-root');

    this.root = createRoot(contentEl);
    this.root.render(
      <React.StrictMode>
        <NativeMermaidView
          app={this.app}
          initialCode={this.initialCode}
          onCodeChange={(newCode) => {
            this.latestCode = newCode;
            this.scheduleSave();
          }}
          onClose={() => this.close()}
        />
      </React.StrictMode>
    );
  }

  onClose(): void {
    if (this.saveTimeout !== null) {
      window.clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
      this.saveToNote();
    }

    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }

  private scheduleSave(): void {
    if (this.saveTimeout !== null) {
      window.clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = window.setTimeout(() => {
      this.saveTimeout = null;
      this.saveToNote();
    }, 250);
  }

  private async saveToNote(): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(this.filePath);
    if (!(file instanceof TFile)) return;

    try {
      await this.app.vault.process(file, (data) => {
        const lines = data.split('\n');
        const startLine = this.sectionInfo.lineStart;
        const endLine = this.sectionInfo.lineEnd;

        // Verify delimiter at startLine and endLine
        if (
          lines[startLine]?.trim().startsWith('```mermaid') &&
          lines[endLine]?.trim().startsWith('```')
        ) {
          const before = lines.slice(0, startLine + 1);
          const after = lines.slice(endLine);
          const codeLines = this.latestCode.trim().split('\n');
          return [...before, ...codeLines, ...after].join('\n');
        }

        // Fallback: search for exact initial code block substring
        const rawInitial = this.initialCode.trim();
        const matchIndex = data.indexOf(rawInitial);
        if (matchIndex !== -1) {
          const result = (
            data.substring(0, matchIndex) +
            this.latestCode.trim() +
            data.substring(matchIndex + rawInitial.length)
          );
          this.initialCode = this.latestCode.trim();
          return result;
        }

        // Last fallback using index boundaries
        const before = lines.slice(0, startLine + 1);
        const after = lines.slice(endLine);
        const codeLines = this.latestCode.trim().split('\n');
        this.initialCode = this.latestCode.trim();
        return [...before, ...codeLines, ...after].join('\n');
      });
    } catch (e: any) {
      console.error('Error saving mermaid block to note:', e);
      new Notice(`Failed to save Mermaid diagram: ${e.message}`);
    }
  }
}
