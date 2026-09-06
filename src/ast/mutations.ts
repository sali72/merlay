/**
 * AST Mutation Helpers for Structural Mermaid Editing
 */

import {
  ArrowType,
  FlowchartDirection,
  MermaidEdgeDef,
  MermaidFlowchartAST,
  MermaidNodeDef,
} from './types';

export function generateUniqueNodeId(
  ast: MermaidFlowchartAST,
  base = 'node'
): string {
  let counter = ast.nodes.size + 1;
  let candidate = `${base}_${counter}`;
  while (ast.nodes.has(candidate)) {
    counter++;
    candidate = `${base}_${counter}`;
  }
  return candidate;
}

export function addNode(
  ast: MermaidFlowchartAST,
  label: string = 'New Step'
): string {
  const id = generateUniqueNodeId(ast, 'step');
  const newNode: MermaidNodeDef = {
    type: 'node',
    id,
    label: label.trim() || id,
    shape: 'rectangle',
  };
  ast.nodes.set(id, newNode);
  return id;
}

export function addChildNode(
  ast: MermaidFlowchartAST,
  parentId: string,
  label: string = 'Next Step'
): { nodeId: string; edgeId: string } {
  const childId = generateUniqueNodeId(ast, 'step');
  const parentNode = ast.nodes.get(parentId);

  const childNode: MermaidNodeDef = {
    type: 'node',
    id: childId,
    label: label.trim() || childId,
    shape: 'rectangle',
    subgraphId: parentNode?.subgraphId,
  };
  ast.nodes.set(childId, childNode);

  if (childNode.subgraphId && ast.subgraphs.has(childNode.subgraphId)) {
    const sub = ast.subgraphs.get(childNode.subgraphId)!;
    if (!sub.nodeIds.includes(childId)) {
      sub.nodeIds.push(childId);
    }
  }

  const edgeId = `e_${parentId}_${childId}_${Date.now()}`;
  const newEdge: MermaidEdgeDef = {
    type: 'edge',
    id: edgeId,
    from: parentId,
    to: childId,
    arrowType: 'arrow',
  };
  ast.edges.push(newEdge);

  return { nodeId: childId, edgeId };
}

export function connectNodes(
  ast: MermaidFlowchartAST,
  fromId: string,
  toId: string,
  arrowType: ArrowType = 'arrow',
  label?: string
): string | null {
  if (fromId === toId) return null;
  if (!ast.nodes.has(fromId) || !ast.nodes.has(toId)) return null;

  // Check if identical directed connection already exists
  const existing = ast.edges.find((e) => e.from === fromId && e.to === toId);
  if (existing) {
    if (label !== undefined) existing.label = label;
    return existing.id;
  }

  const edgeId = `e_${fromId}_${toId}_${Date.now()}`;
  const newEdge: MermaidEdgeDef = {
    type: 'edge',
    id: edgeId,
    from: fromId,
    to: toId,
    arrowType,
    label: label?.trim() || undefined,
  };
  ast.edges.push(newEdge);
  return edgeId;
}

export function deleteNode(ast: MermaidFlowchartAST, nodeId: string): boolean {
  if (!ast.nodes.has(nodeId)) return false;

  // Remove node
  ast.nodes.delete(nodeId);

  // Remove connected edges
  ast.edges = ast.edges.filter((e) => e.from !== nodeId && e.to !== nodeId);

  // Remove from subgraphs
  for (const sub of ast.subgraphs.values()) {
    sub.nodeIds = sub.nodeIds.filter((id) => id !== nodeId);
  }

  // Remove from styles
  ast.styles = ast.styles.filter((s) => s.targetId !== nodeId);

  return true;
}

export function deleteEdge(ast: MermaidFlowchartAST, edgeId: string): boolean {
  const initialLen = ast.edges.length;
  ast.edges = ast.edges.filter((e) => e.id !== edgeId);
  return ast.edges.length < initialLen;
}

export function updateNodeLabel(
  ast: MermaidFlowchartAST,
  nodeId: string,
  newLabel: string
): boolean {
  const node = ast.nodes.get(nodeId);
  if (!node) return false;
  node.label = newLabel.trim() || nodeId;
  return true;
}

export function updateEdgeLabel(
  ast: MermaidFlowchartAST,
  edgeId: string,
  newLabel: string
): boolean {
  const edge = ast.edges.find((e) => e.id === edgeId);
  if (!edge) return false;
  edge.label = newLabel.trim() || undefined;
  return true;
}

export function setDiagramDirection(
  ast: MermaidFlowchartAST,
  direction: FlowchartDirection
): void {
  ast.direction = direction;
}
