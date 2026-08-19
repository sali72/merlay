/**
 * Parser for Mermaid Flowcharts
 */

import { Token, tokenize } from './lexer';
import {
  ArrowType,
  FlowchartDirection,
  MermaidClassDef,
  MermaidEdgeDef,
  MermaidFlowchartAST,
  MermaidNodeDef,
  MermaidShapeType,
  MermaidStyleDef,
  MermaidSubgraphDef,
} from './types';

export function parseMermaidFlowchart(input: string): MermaidFlowchartAST {
  const tokens = tokenize(input);
  let cursor = 0;

  const ast: MermaidFlowchartAST = {
    diagramType: 'flowchart',
    direction: 'TD',
    nodes: new Map(),
    edges: [],
    subgraphs: new Map(),
    styles: [],
    classDefs: new Map(),
    rawLines: [],
  };

  const subgraphStack: string[] = [];

  function currentToken(): Token {
    return tokens[cursor] || { type: 'EOF', value: '', line: -1, col: -1 };
  }

  function advance(): Token {
    const t = currentToken();
    cursor++;
    return t;
  }

  function skipNewlines() {
    while (currentToken().type === 'NEWLINE') {
      advance();
    }
  }

  // Parse header
  skipNewlines();
  if (currentToken().type === 'DIRECTIVE') {
    const dirToken = advance();
    ast.diagramType = dirToken.value.toLowerCase() as 'flowchart' | 'graph';

    if (currentToken().type === 'DIRECTION') {
      ast.direction = advance().value as FlowchartDirection;
    }
  }

  while (cursor < tokens.length && currentToken().type !== 'EOF') {
    skipNewlines();
    if (currentToken().type === 'EOF') break;

    const token = currentToken();

    // 1. Comments
    if (token.type === 'COMMENT') {
      advance();
      continue;
    }

    // 2. Subgraph start
    if (token.type === 'SUBGRAPH') {
      advance(); // consume 'subgraph'
      let subId = '';
      let subLabel = '';

      if (currentToken().type === 'IDENTIFIER') {
        subId = advance().value;
      }
      if (currentToken().type === 'NODE_SHAPE') {
        subLabel = currentToken().labelText || '';
        advance();
      } else if (!subLabel && subId) {
        subLabel = subId;
      }

      if (!subId) {
        subId = `sub_${ast.subgraphs.size + 1}`;
      }

      const parentSubId = subgraphStack[subgraphStack.length - 1];
      const subgraphDef: MermaidSubgraphDef = {
        type: 'subgraph',
        id: subId,
        label: subLabel || subId,
        nodeIds: [],
        subgraphIds: [],
      };

      ast.subgraphs.set(subId, subgraphDef);
      if (parentSubId && ast.subgraphs.has(parentSubId)) {
        ast.subgraphs.get(parentSubId)!.subgraphIds.push(subId);
      }

      subgraphStack.push(subId);
      continue;
    }

    // 3. Subgraph end
    if (token.type === 'END') {
      advance();
      subgraphStack.pop();
      continue;
    }

    // 4. Direction keyword (direction TB / direction LR)
    if (token.type === 'DIRECTION_KEYWORD') {
      advance(); // consume 'direction'
      if (currentToken().type === 'DIRECTION') {
        const dirVal = advance().value as FlowchartDirection;
        const currentSubId = subgraphStack[subgraphStack.length - 1];
        if (currentSubId && ast.subgraphs.has(currentSubId)) {
          ast.subgraphs.get(currentSubId)!.direction = dirVal;
        } else {
          ast.direction = dirVal;
        }
      }
      continue;
    }

    if (token.type === 'DIRECTION' && subgraphStack.length > 0) {
      const dirVal = advance().value as FlowchartDirection;
      const currentSubId = subgraphStack[subgraphStack.length - 1];
      if (ast.subgraphs.has(currentSubId)) {
        ast.subgraphs.get(currentSubId)!.direction = dirVal;
      }
      continue;
    }

    // 5. Style definition: style NodeID fill:#...,stroke:#...
    if (token.type === 'STYLE') {
      advance(); // consume 'style'
      if (currentToken().type === 'IDENTIFIER') {
        const targetId = advance().value;
        const styleMap: Record<string, string> = {};

        while (
          currentToken().type !== 'NEWLINE' &&
          currentToken().type !== 'EOF'
        ) {
          const part = advance().value;
          const [key, val] = part.split(':');
          if (key && val) {
            styleMap[key.trim()] = val.trim().replace(/[,;]$/, '');
          }
        }

        ast.styles.push({ type: 'style', targetId, styles: styleMap });
      }
      continue;
    }

    // 6. Class definition: classDef name fill:#...
    if (token.type === 'CLASS_DEF') {
      advance(); // consume 'classDef'
      if (currentToken().type === 'IDENTIFIER') {
        const className = advance().value;
        const styleMap: Record<string, string> = {};

        while (
          currentToken().type !== 'NEWLINE' &&
          currentToken().type !== 'EOF'
        ) {
          const part = advance().value;
          const [key, val] = part.split(':');
          if (key && val) {
            styleMap[key.trim()] = val.trim().replace(/[,;]$/, '');
          }
        }

        ast.classDefs.set(className, {
          type: 'classDef',
          name: className,
          styles: styleMap,
        });
      }
      continue;
    }

    // 7. Node / Edge statements
    if (token.type === 'IDENTIFIER') {
      parseNodeOrEdgeStatement();
      continue;
    }

    // Advance unknown tokens to avoid infinite loops
    advance();
  }

  return ast;

  function parseNodeOrEdgeStatement() {
    const leftNode = parseSingleNode();
    if (!leftNode) return;

    ensureNodeExists(leftNode);

    // Check if followed by an arrow (Edge)
    while (currentToken().type === 'ARROW' || currentToken().type === 'ARROW_LABEL') {
      let arrowType: ArrowType = 'arrow';
      let edgeLabel: string | undefined;

      if (currentToken().type === 'ARROW_LABEL') {
        edgeLabel = advance().labelText;
      }

      if (currentToken().type === 'ARROW') {
        arrowType = mapArrowType(advance().value);
      }

      if (currentToken().type === 'ARROW_LABEL') {
        edgeLabel = advance().labelText;
      }

      const rightNode = parseSingleNode();
      if (!rightNode) break;

      ensureNodeExists(rightNode);

      const edgeDef: MermaidEdgeDef = {
        type: 'edge',
        id: `e_${leftNode.id}_${rightNode.id}_${ast.edges.length + 1}`,
        from: leftNode.id,
        to: rightNode.id,
        arrowType,
        label: edgeLabel,
      };

      ast.edges.push(edgeDef);
    }
  }

  function parseSingleNode(): { id: string; label?: string; shape?: MermaidShapeType } | null {
    if (currentToken().type !== 'IDENTIFIER') return null;

    const idToken = advance();
    const id = idToken.value;
    let label: string | undefined;
    let shape: MermaidShapeType | undefined;

    if (currentToken().type === 'NODE_SHAPE') {
      const shapeToken = advance();
      label = shapeToken.labelText;
      shape = shapeToken.shapeType as MermaidShapeType;
    }

    return { id, label, shape };
  }

  function ensureNodeExists(nodeInfo: { id: string; label?: string; shape?: MermaidShapeType }) {
    const currentSubId = subgraphStack[subgraphStack.length - 1];

    if (!ast.nodes.has(nodeInfo.id)) {
      const newNode: MermaidNodeDef = {
        type: 'node',
        id: nodeInfo.id,
        label: nodeInfo.label || nodeInfo.id,
        shape: nodeInfo.shape || 'rectangle',
        subgraphId: currentSubId,
      };
      ast.nodes.set(nodeInfo.id, newNode);

      if (currentSubId && ast.subgraphs.has(currentSubId)) {
        const sub = ast.subgraphs.get(currentSubId)!;
        if (!sub.nodeIds.includes(nodeInfo.id)) {
          sub.nodeIds.push(nodeInfo.id);
        }
      }
    } else {
      // Update existing node with label/shape if supplied
      const existing = ast.nodes.get(nodeInfo.id)!;
      if (nodeInfo.label) existing.label = nodeInfo.label;
      if (nodeInfo.shape) existing.shape = nodeInfo.shape;
      if (currentSubId && !existing.subgraphId) {
        existing.subgraphId = currentSubId;
        const sub = ast.subgraphs.get(currentSubId);
        if (sub && !sub.nodeIds.includes(nodeInfo.id)) {
          sub.nodeIds.push(nodeInfo.id);
        }
      }
    }
  }
}

function mapArrowType(raw: string): ArrowType {
  switch (raw) {
    case '-.->':
    case '<-.->':
      return 'dotted';
    case '==>':
    case '<==>':
      return 'thick';
    case '<-->':
      return 'bidirectional';
    case '--x':
      return 'cross';
    case '--o':
      return 'circle';
    case '---':
      return 'open';
    case '-.-':
      return 'dotted_open';
    case '===':
      return 'thick_open';
    case '-->':
    default:
      return 'arrow';
  }
}
