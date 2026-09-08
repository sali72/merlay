/**
 * Style mutations for Nodes, Edges, and Subgraphs in Flowchart diagrams
 */

import { MermaidFlowchartAST } from '../types';

export function clearNodeStyle(
  ast: MermaidFlowchartAST,
  nodeId: string
): boolean {
  if (!ast.nodes.has(nodeId)) return false;

  const node = ast.nodes.get(nodeId)!;
  delete node.style;

  // Clear class bindings so the node is completely reset to diagram default
  node.classes = undefined;

  ast.styles = ast.styles.filter((s) => s.targetId !== nodeId);
  return true;
}

export function updateNodeStyle(
  ast: MermaidFlowchartAST,
  nodeId: string,
  styles: Record<string, string> | null
): boolean {
  if (!ast.nodes.has(nodeId)) return false;

  const node = ast.nodes.get(nodeId)!;

  if (!styles || Object.keys(styles).length === 0) {
    return clearNodeStyle(ast, nodeId);
  }

  // Clean empty values
  const cleanStyles: Record<string, string> = {};
  for (const [k, v] of Object.entries(styles)) {
    const trimmed = v.trim();
    if (trimmed) {
      cleanStyles[k.trim()] = trimmed;
    }
  }

  if (Object.keys(cleanStyles).length === 0) {
    return clearNodeStyle(ast, nodeId);
  }

  // Update on node
  node.style = cleanStyles;

  // Detach any previous class bindings so the new explicit style takes full effect
  node.classes = undefined;

  // Remove ALL existing entries for nodeId in ast.styles, and add the single new clean entry
  ast.styles = ast.styles.filter((s) => s.targetId !== nodeId);
  ast.styles.push({
    type: 'style',
    targetId: nodeId,
    styles: { ...cleanStyles },
  });

  return true;
}

export function getNodeStyle(
  ast: MermaidFlowchartAST,
  nodeId: string
): Record<string, string> | undefined {
  const node = ast.nodes.get(nodeId);
  if (node?.style && Object.keys(node.style).length > 0) return node.style;

  const styleDef = ast.styles.find((s) => s.targetId === nodeId);
  if (styleDef?.styles && Object.keys(styleDef.styles).length > 0) {
    return styleDef.styles;
  }

  // Fallback to styles from classes assigned to the node
  if (node?.classes && node.classes.length > 0) {
    const combined: Record<string, string> = {};
    for (const cls of node.classes) {
      const cdef = ast.classDefs.get(cls);
      if (cdef?.styles) {
        Object.assign(combined, cdef.styles);
      }
    }
    if (Object.keys(combined).length > 0) {
      return combined;
    }
  }

  // Fallback to default classDef if defined
  const defaultClass = ast.classDefs.get('default');
  if (defaultClass?.styles && Object.keys(defaultClass.styles).length > 0) {
    return defaultClass.styles;
  }

  return undefined;
}

/**
 * Batch update visual styles for multiple nodes.
 */
export function updateNodesStyle(
  ast: MermaidFlowchartAST,
  nodeIds: Iterable<string>,
  styles: Record<string, string> | null
): number {
  let count = 0;
  for (const id of nodeIds) {
    if (updateNodeStyle(ast, id, styles)) {
      count++;
    }
  }
  return count;
}

/**
 * Batch clear visual styles for multiple nodes.
 */
export function clearNodesStyle(
  ast: MermaidFlowchartAST,
  nodeIds: Iterable<string>
): number {
  let count = 0;
  for (const id of nodeIds) {
    if (clearNodeStyle(ast, id)) {
      count++;
    }
  }
  return count;
}

/**
 * Clear any custom visual style from an edge.
 */
export function clearEdgeStyle(
  ast: MermaidFlowchartAST,
  edgeId: string
): boolean {
  const edge = ast.edges.find((e) => e.id === edgeId);
  if (!edge) return false;
  delete edge.style;
  return true;
}

/**
 * Update the visual style dictionary of a single edge.
 */
export function updateEdgeStyle(
  ast: MermaidFlowchartAST,
  edgeId: string,
  styles: Record<string, string> | null
): boolean {
  const edge = ast.edges.find((e) => e.id === edgeId);
  if (!edge) return false;

  if (!styles || Object.keys(styles).length === 0) {
    return clearEdgeStyle(ast, edgeId);
  }

  // Clean empty values
  const cleanStyles: Record<string, string> = {};
  for (const [k, v] of Object.entries(styles)) {
    if (v && v.trim()) {
      cleanStyles[k] = v.trim();
    }
  }

  if (Object.keys(cleanStyles).length === 0) {
    return clearEdgeStyle(ast, edgeId);
  }

  edge.style = cleanStyles;
  return true;
}

/**
 * Get the visual style of an edge if defined.
 */
export function getEdgeStyle(
  ast: MermaidFlowchartAST,
  edgeId: string
): Record<string, string> | undefined {
  const edge = ast.edges.find((e) => e.id === edgeId);
  return edge?.style;
}

/**
 * Batch update visual styles for multiple edges.
 */
export function updateEdgesStyle(
  ast: MermaidFlowchartAST,
  edgeIds: Iterable<string>,
  styles: Record<string, string> | null
): number {
  let count = 0;
  for (const id of edgeIds) {
    if (updateEdgeStyle(ast, id, styles)) {
      count++;
    }
  }
  return count;
}

/**
 * Batch clear visual styles from multiple edges.
 */
export function clearEdgesStyle(
  ast: MermaidFlowchartAST,
  edgeIds: Iterable<string>
): number {
  let count = 0;
  for (const id of edgeIds) {
    if (clearEdgeStyle(ast, id)) {
      count++;
    }
  }
  return count;
}

/**
 * Clear any custom visual style from a subgraph.
 */
export function clearSubgraphStyle(
  ast: MermaidFlowchartAST,
  subgraphId: string
): boolean {
  if (!ast.subgraphs.has(subgraphId)) return false;

  const sub = ast.subgraphs.get(subgraphId)!;
  delete sub.style;

  ast.styles = ast.styles.filter((s) => s.targetId !== subgraphId);
  return true;
}

/**
 * Get the visual style of a subgraph if defined.
 */
export function getSubgraphStyle(
  ast: MermaidFlowchartAST,
  subgraphId: string
): Record<string, string> | undefined {
  const sub = ast.subgraphs.get(subgraphId);
  if (sub?.style && Object.keys(sub.style).length > 0) return sub.style;

  const styleDef = ast.styles.find((s) => s.targetId === subgraphId);
  if (styleDef?.styles && Object.keys(styleDef.styles).length > 0) {
    return styleDef.styles;
  }

  return undefined;
}

/**
 * Update the visual style dictionary of a single subgraph.
 * Mirrors updateNodeStyle but targets subgraphs (emitted as `style <subId> ...`).
 */
export function updateSubgraphStyle(
  ast: MermaidFlowchartAST,
  subgraphId: string,
  styles: Record<string, string> | null
): boolean {
  if (!ast.subgraphs.has(subgraphId)) return false;

  if (!styles || Object.keys(styles).length === 0) {
    return clearSubgraphStyle(ast, subgraphId);
  }

  // Clean empty values
  const cleanStyles: Record<string, string> = {};
  for (const [k, v] of Object.entries(styles)) {
    const trimmed = v.trim();
    if (trimmed) {
      cleanStyles[k.trim()] = trimmed;
    }
  }

  if (Object.keys(cleanStyles).length === 0) {
    return clearSubgraphStyle(ast, subgraphId);
  }

  const sub = ast.subgraphs.get(subgraphId)!;
  sub.style = cleanStyles;

  // Remove ALL existing entries for subgraphId in ast.styles, add single clean entry
  ast.styles = ast.styles.filter((s) => s.targetId !== subgraphId);
  ast.styles.push({
    type: 'style',
    targetId: subgraphId,
    styles: { ...cleanStyles },
  });

  return true;
}
