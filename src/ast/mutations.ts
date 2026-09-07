/**
 * AST Mutation Helpers for Structural Mermaid Editing
 */

import {
  ArrowType,
  FlowchartDirection,
  MermaidEdgeDef,
  MermaidFlowchartAST,
  MermaidNodeDef,
  MermaidShapeType,
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
  label: string = 'New Step',
  shape: MermaidShapeType = 'rectangle'
): string {
  const id = generateUniqueNodeId(ast, 'step');
  const newNode: MermaidNodeDef = {
    type: 'node',
    id,
    label: label.trim() || id,
    shape,
  };
  ast.nodes.set(id, newNode);
  return id;
}

export function addChildNode(
  ast: MermaidFlowchartAST,
  parentId: string,
  label: string = 'Next Step',
  shape: MermaidShapeType = 'rectangle'
): { nodeId: string; edgeId: string } {
  const childId = generateUniqueNodeId(ast, 'step');
  const parentNode = ast.nodes.get(parentId);

  const childNode: MermaidNodeDef = {
    type: 'node',
    id: childId,
    label: label.trim() || childId,
    shape,
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

  const edgeId = `e_${fromId}_${toId}_${Date.now()}_${ast.edges.length}`;
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

export function updateNodeShape(
  ast: MermaidFlowchartAST,
  nodeId: string,
  newShape: MermaidShapeType
): boolean {
  const node = ast.nodes.get(nodeId);
  if (!node) return false;
  node.shape = newShape;
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

  // Update or insert in ast.styles
  const existingIndex = ast.styles.findIndex((s) => s.targetId === nodeId);
  if (existingIndex !== -1) {
    ast.styles[existingIndex].styles = { ...cleanStyles };
  } else {
    ast.styles.push({
      type: 'style',
      targetId: nodeId,
      styles: { ...cleanStyles },
    });
  }

  return true;
}

export function clearNodeStyle(
  ast: MermaidFlowchartAST,
  nodeId: string
): boolean {
  if (!ast.nodes.has(nodeId)) return false;

  const node = ast.nodes.get(nodeId)!;
  delete node.style;

  ast.styles = ast.styles.filter((s) => s.targetId !== nodeId);
  return true;
}

export function getNodeStyle(
  ast: MermaidFlowchartAST,
  nodeId: string
): Record<string, string> | undefined {
  const node = ast.nodes.get(nodeId);
  if (node?.style) return node.style;

  const styleDef = ast.styles.find((s) => s.targetId === nodeId);
  return styleDef?.styles;
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

export function updateEdgeType(
  ast: MermaidFlowchartAST,
  edgeId: string,
  newType: ArrowType
): boolean {
  const edge = ast.edges.find((e) => e.id === edgeId);
  if (!edge) return false;
  edge.arrowType = newType;
  return true;
}

export function reverseEdgeDirection(
  ast: MermaidFlowchartAST,
  edgeId: string
): string | null {
  const edge = ast.edges.find((e) => e.id === edgeId);
  if (!edge) return null;

  const temp = edge.from;
  edge.from = edge.to;
  edge.to = temp;
  edge.id = `e_${edge.from}_${edge.to}_${Date.now()}`;
  return edge.id;
}

export function insertNodeOnEdge(
  ast: MermaidFlowchartAST,
  edgeId: string,
  label = 'New Step',
  shape: MermaidShapeType = 'rectangle'
): { nodeId: string; edge1Id: string; edge2Id: string } | null {
  const edgeIndex = ast.edges.findIndex((e) => e.id === edgeId);
  if (edgeIndex === -1) return null;

  const oldEdge = ast.edges[edgeIndex];
  const fromId = oldEdge.from;
  const toId = oldEdge.to;
  const arrowType = oldEdge.arrowType;
  const edgeLabel = oldEdge.label;

  const parentNode = ast.nodes.get(fromId);
  const childNode = ast.nodes.get(toId);
  const subgraphId = parentNode?.subgraphId || childNode?.subgraphId;

  const newNodeId = generateUniqueNodeId(ast, 'step');
  const newNode: MermaidNodeDef = {
    type: 'node',
    id: newNodeId,
    label: label.trim() || newNodeId,
    shape,
    subgraphId,
  };
  ast.nodes.set(newNodeId, newNode);

  if (subgraphId && ast.subgraphs.has(subgraphId)) {
    const sub = ast.subgraphs.get(subgraphId)!;
    if (!sub.nodeIds.includes(newNodeId)) {
      sub.nodeIds.push(newNodeId);
    }
  }

  // Remove the old edge
  ast.edges.splice(edgeIndex, 1);

  // Add edge 1: fromId -> newNodeId (inheriting label)
  const edge1Id = `e_${fromId}_${newNodeId}_${Date.now()}`;
  const edge1: MermaidEdgeDef = {
    type: 'edge',
    id: edge1Id,
    from: fromId,
    to: newNodeId,
    arrowType,
    label: edgeLabel,
  };

  // Add edge 2: newNodeId -> toId
  const edge2Id = `e_${newNodeId}_${toId}_${Date.now() + 1}`;
  const edge2: MermaidEdgeDef = {
    type: 'edge',
    id: edge2Id,
    from: newNodeId,
    to: toId,
    arrowType,
  };

  ast.edges.push(edge1, edge2);

  return { nodeId: newNodeId, edge1Id, edge2Id };
}

export function insertNodeBetween(
  ast: MermaidFlowchartAST,
  fromId: string,
  toId: string,
  label = 'New Step',
  shape: MermaidShapeType = 'rectangle'
): { nodeId: string; edge1Id: string; edge2Id: string } | null {
  if (fromId === toId) return null;
  if (!ast.nodes.has(fromId) || !ast.nodes.has(toId)) return null;

  const existing = ast.edges.find((e) => e.from === fromId && e.to === toId);
  if (existing) {
    return insertNodeOnEdge(ast, existing.id, label, shape);
  }

  // If not directly connected yet, create node and connect both
  const parentNode = ast.nodes.get(fromId);
  const childNode = ast.nodes.get(toId);
  const subgraphId = parentNode?.subgraphId || childNode?.subgraphId;

  const newNodeId = generateUniqueNodeId(ast, 'step');
  const newNode: MermaidNodeDef = {
    type: 'node',
    id: newNodeId,
    label: label.trim() || newNodeId,
    shape,
    subgraphId,
  };
  ast.nodes.set(newNodeId, newNode);

  if (subgraphId && ast.subgraphs.has(subgraphId)) {
    const sub = ast.subgraphs.get(subgraphId)!;
    if (!sub.nodeIds.includes(newNodeId)) {
      sub.nodeIds.push(newNodeId);
    }
  }

  const edge1Id = `e_${fromId}_${newNodeId}_${Date.now()}`;
  const edge1: MermaidEdgeDef = {
    type: 'edge',
    id: edge1Id,
    from: fromId,
    to: newNodeId,
    arrowType: 'arrow',
  };

  const edge2Id = `e_${newNodeId}_${toId}_${Date.now() + 1}`;
  const edge2: MermaidEdgeDef = {
    type: 'edge',
    id: edge2Id,
    from: newNodeId,
    to: toId,
    arrowType: 'arrow',
  };

  ast.edges.push(edge1, edge2);

  return { nodeId: newNodeId, edge1Id, edge2Id };
}

export function setDiagramDirection(
  ast: MermaidFlowchartAST,
  direction: FlowchartDirection
): void {
  ast.direction = direction;
}
