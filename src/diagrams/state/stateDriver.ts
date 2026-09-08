import { DiagramDriver } from '../types';
import { MermaidStateAST } from './types';
import { parseMermaidStateDiagram } from './parser';
import { serializeMermaidStateDiagram } from './serializer';

export const StateDiagramDriver: DiagramDriver<MermaidStateAST> = {
  type: 'stateDiagram',
  displayName: 'State Diagram',
  supportsDirection: true,
  canHandle(code: string): boolean {
    const trimmed = code.trim();
    return /^stateDiagram(-v2)?\b/i.test(trimmed);
  },
  parse(code: string): MermaidStateAST {
    return parseMermaidStateDiagram(code);
  },
  serialize(ast: MermaidStateAST): string {
    return serializeMermaidStateDiagram(ast);
  },
  createDefault(direction = 'LR'): string {
    const dirLine = direction ? `    direction ${direction}\n` : '';
    return `stateDiagram-v2\n${dirLine}    [*] --> Idle\n    Idle --> Processing : Submit\n    Processing --> Success : Approve\n    Processing --> Failed : Reject\n    Success --> [*]\n    Failed --> Idle : Retry\n`;
  },
};
