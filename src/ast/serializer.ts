/**
 * Serializer: Converts MermaidFlowchartAST to clean, normalized Mermaid text
 */

import {
  ArrowType,
  MermaidFlowchartAST,
  MermaidNodeDef,
  MermaidShapeType,
} from './types';

export function serializeMermaidFlowchart(ast: MermaidFlowchartAST): string {
  const lines: string[] = [];

  // 1. Header
  lines.push(`${ast.diagramType || 'flowchart'} ${ast.direction || 'TD'}`);

  const emittedNodeIds = new Set<string>();

  // 2. Subgraphs
  for (const [subId, subDef] of ast.subgraphs.entries()) {
    const labelPart = subDef.label ? ` ["${escapeLabel(subDef.label)}"]` : '';
    lines.push(`    subgraph ${subId}${labelPart}`);

    if (subDef.direction) {
      lines.push(`        direction ${subDef.direction}`);
    }

    for (const nodeId of subDef.nodeIds) {
      const node = ast.nodes.get(nodeId);
      if (node) {
        lines.push(`        ${node.id}${formatShape(node.shape, node.label)}`);
        emittedNodeIds.add(node.id);
      }
    }

    lines.push('    end\n');
  }

  // 3. Standalone nodes (not part of any subgraph, or not yet defined with custom label)
  for (const [nodeId, node] of ast.nodes.entries()) {
    if (!node.subgraphId && !emittedNodeIds.has(nodeId)) {
      lines.push(`    ${node.id}${formatShape(node.shape, node.label)}`);
      emittedNodeIds.add(nodeId);
    }
  }

  if (lines.length > 1 && ast.edges.length > 0) {
    lines.push('');
  }

  // 4. Edges
  for (const edge of ast.edges) {
    const arrowStr = formatArrow(edge.arrowType, edge.label);
    lines.push(`    ${edge.from} ${arrowStr} ${edge.to}`);
  }

  // 5. ClassDefs
  if (ast.classDefs.size > 0) {
    lines.push('');
    for (const [name, def] of ast.classDefs.entries()) {
      const stylePairs = Object.entries(def.styles)
        .map(([k, v]) => `${k}:${v}`)
        .join(',');
      lines.push(`    classDef ${name} ${stylePairs}`);
    }
  }

  // 6. Style statements
  if (ast.styles.length > 0) {
    lines.push('');
    for (const style of ast.styles) {
      const stylePairs = Object.entries(style.styles)
        .map(([k, v]) => `${k}:${v}`)
        .join(',');
      lines.push(`    style ${style.targetId} ${stylePairs}`);
    }
  }

  return lines.join('\n').trim() + '\n';
}

function formatShape(shape: MermaidShapeType, label: string): string {
  const safe = `"${escapeLabel(label)}"`;
  switch (shape) {
    case 'rounded':
      return `(${safe})`;
    case 'stadium':
      return `([${safe}])`;
    case 'subroutine':
      return `[[${safe}]]`;
    case 'cylinder':
      return `[(${safe})]`;
    case 'circle':
      return `((${safe}))`;
    case 'diamond':
      return `{${safe}}`;
    case 'hexagon':
      return `{{${safe}}}`;
    case 'parallelogram':
      return `[/${safe}/]`;
    case 'rectangle':
    default:
      return `[${safe}]`;
  }
}

function formatArrow(type: ArrowType, label?: string): string {
  const labelPart = label ? `|${escapeLabel(label)}|` : '';
  switch (type) {
    case 'dotted':
      return label ? `-.->${labelPart}` : '-.->';
    case 'thick':
      return label ? `==>${labelPart}` : '==>';
    case 'bidirectional':
      return label ? `<-->${labelPart}` : '<-->';
    case 'cross':
      return label ? `--x${labelPart}` : '--x';
    case 'circle':
      return label ? `--o${labelPart}` : '--o';
    case 'open':
      return label ? `---${labelPart}` : '---';
    case 'dotted_open':
      return label ? `-.-${labelPart}` : '-.-';
    case 'thick_open':
      return label ? `===${labelPart}` : '===';
    case 'arrow':
    default:
      return label ? `-->${labelPart}` : '-->';
  }
}

function escapeLabel(label: string): string {
  return label.replace(/"/g, '#quot;');
}
