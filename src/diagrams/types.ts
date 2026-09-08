/**
 * Unified Diagram Driver Types & Interfaces
 */

export type SupportedDiagramType =
  | 'flowchart'
  | 'stateDiagram'
  | 'mindmap'
  | 'sequenceDiagram'
  | 'classDiagram'
  | 'erDiagram'
  | 'unknown';

export interface DiagramTemplate {
  type: SupportedDiagramType;
  label: string;
  description: string;
  defaultCode: string;
}

export interface DiagramDriver<TAst = any> {
  type: SupportedDiagramType;
  displayName: string;
  supportsDirection: boolean;
  canHandle(code: string): boolean;
  parse(code: string): TAst;
  serialize(ast: TAst): string;
  createDefault(direction?: string): string;
}
