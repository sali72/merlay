/**
 * Diagram Opener and File Creator helpers for Obsidian Markdown integration
 */

import { MarkdownView, Notice, TFile, WorkspaceLeaf } from 'obsidian';
import type VisualMermaidPlugin from '../main';
import { findTargetMermaidBlock } from '../utils/markdownBlock';
import { detectDiagramType } from '../diagrams/registry';
import { MermaidBlockModal } from '../views/MermaidBlockModal';
import { DiagramTemplateModal } from '../views/DiagramTemplateModal';

export async function openVisualModeForActiveFile(
  plugin: VisualMermaidPlugin,
  view: MarkdownView
): Promise<void> {
  const file = view.file;
  if (!file) return;
  const content = await plugin.app.vault.read(file);
  const cursorLine = view.editor.getCursor().line;

  const blockMatch = findTargetMermaidBlock({
    content,
    hintLine: cursorLine,
  });

  if (!blockMatch) {
    new Notice('No Mermaid code block found in active note.');
    return;
  }

  openDiagramModal(plugin, file.path, blockMatch, content);
}

export function openDiagramModal(
  plugin: VisualMermaidPlugin,
  filePath: string,
  blockMatch: { rawCode: string; lineStart: number; lineEnd: number },
  content: string
): boolean {
  const rawCode = blockMatch.rawCode;
  const diagramType = detectDiagramType(rawCode);
  if (diagramType === 'unknown') {
    new Notice('Visual Mode currently supports Flowcharts and State Diagrams.');
    return false;
  }

  const sectionInfo = {
    lineStart: blockMatch.lineStart,
    lineEnd: blockMatch.lineEnd,
    text: content,
  };

  new MermaidBlockModal(
    plugin.app,
    plugin,
    filePath,
    sectionInfo,
    rawCode
  ).open();
  return true;
}

export async function createNewDiagram(
  plugin: VisualMermaidPlugin
): Promise<void> {
  new DiagramTemplateModal(plugin.app, (template) => {
    createDiagramFileWithTemplate(plugin, template.defaultCode);
  }).open();
}

export async function createDiagramFileWithTemplate(
  plugin: VisualMermaidPlugin,
  initialCode: string
): Promise<void> {
  try {
    const activeFile = plugin.app.workspace.getActiveFile();
    const parentDir = activeFile?.parent ? activeFile.parent.path : '';
    const baseName = 'New Diagram';
    let fileName = `${baseName}.mmd`;
    let counter = 1;

    while (
      plugin.app.vault.getAbstractFileByPath(
        parentDir ? `${parentDir}/${fileName}` : fileName
      )
    ) {
      fileName = `${baseName} ${counter++}.mmd`;
    }

    const fullPath = parentDir ? `${parentDir}/${fileName}` : fileName;
    const createdFile = await plugin.app.vault.create(fullPath, initialCode);
    const leaf = plugin.app.workspace.getLeaf('tab');
    await leaf.openFile(createdFile);

    new Notice(`Created diagram: ${fileName}`);
  } catch (e: any) {
    new Notice(`Error creating diagram: ${e.message}`);
  }
}
