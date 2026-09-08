import { DiagramDriver } from '../types';
import { MermaidFlowchartAST } from '../../ast/types';
import { parseMermaidFlowchart } from '../../ast/parser';
import { serializeMermaidFlowchart } from '../../ast/serializer';

export const FlowchartDriver: DiagramDriver<MermaidFlowchartAST> = {
  type: 'flowchart',
  displayName: 'Flowchart',
  supportsDirection: true,
  canHandle(code: string): boolean {
    const trimmed = code.trim();
    return /^(flowchart|graph)\b/i.test(trimmed);
  },
  parse(code: string): MermaidFlowchartAST {
    return parseMermaidFlowchart(code);
  },
  serialize(ast: MermaidFlowchartAST): string {
    return serializeMermaidFlowchart(ast);
  },
  createDefault(direction = 'LR'): string {
    return `flowchart ${direction}\n    A["Start"] --> B["Process"]\n    B --> C["End"]\n`;
  },
};
