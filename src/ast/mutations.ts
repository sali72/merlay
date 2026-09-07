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
  MermaidSubgraphDef,
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

  // Detach any previous class bindings so the new explicit style takes full effect
  // and is not overridden or conflicted with by external Mermaid class CSS
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

/**
 * Batch delete multiple nodes and all connected edges, subgraphs, and styles.
 */
export function deleteNodes(
  ast: MermaidFlowchartAST,
  nodeIds: Iterable<string>
): number {
  const idsSet = new Set(nodeIds);
  let deletedCount = 0;

  for (const id of idsSet) {
    if (ast.nodes.delete(id)) {
      deletedCount++;
    }
  }
  if (deletedCount === 0) return 0;

  // Filter edges connecting to any deleted node
  ast.edges = ast.edges.filter(
    (e) => !idsSet.has(e.from) && !idsSet.has(e.to)
  );

  // Filter from subgraphs
  for (const sub of ast.subgraphs.values()) {
    sub.nodeIds = sub.nodeIds.filter((id) => !idsSet.has(id));
  }

  // Filter styles
  ast.styles = ast.styles.filter((s) => !idsSet.has(s.targetId));

  return deletedCount;
}

/**
 * Batch update shape for multiple nodes.
 */
export function updateNodesShape(
  ast: MermaidFlowchartAST,
  nodeIds: Iterable<string>,
  shape: MermaidShapeType
): number {
  let count = 0;
  for (const id of nodeIds) {
    const node = ast.nodes.get(id);
    if (node) {
      node.shape = shape;
      count++;
    }
  }
  return count;
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
 * Batch update arrow type for multiple edges.
 */
export function updateEdgesType(
  ast: MermaidFlowchartAST,
  edgeIds: Iterable<string>,
  arrowType: ArrowType
): number {
  let count = 0;
  for (const id of edgeIds) {
    if (updateEdgeType(ast, id, arrowType)) {
      count++;
    }
  }
  return count;
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
 * Batch delete multiple edges from the diagram.
 */
export function deleteEdges(
  ast: MermaidFlowchartAST,
  edgeIds: Iterable<string>
): number {
  const idsSet = new Set(edgeIds);
  const initialLen = ast.edges.length;
  ast.edges = ast.edges.filter((e) => !idsSet.has(e.id));
  return initialLen - ast.edges.length;
}

/**
 * Generate a unique subgraph ID that doesn't collide with existing subgraphs.
 */
export function generateUniqueSubgraphId(
  ast: MermaidFlowchartAST,
  base = 'sub'
): string {
  let counter = ast.subgraphs.size + 1;
  let candidate = `${base}_${counter}`;
  while (ast.subgraphs.has(candidate)) {
    counter++;
    candidate = `${base}_${counter}`;
  }
  return candidate;
}

/**
 * Create a new subgraph in the AST, optionally grouping initial node IDs.
 */
export function createSubgraph(
  ast: MermaidFlowchartAST,
  label = 'New Group',
  nodeIds?: Iterable<string>
): string {
  const subId = generateUniqueSubgraphId(ast, 'sub');
  const validNodeIds: string[] = [];

  if (nodeIds) {
    for (const nid of nodeIds) {
      if (ast.nodes.has(nid)) {
        // Remove from any prior subgraph
        const node = ast.nodes.get(nid)!;
        if (node.subgraphId && ast.subgraphs.has(node.subgraphId)) {
          const oldSub = ast.subgraphs.get(node.subgraphId)!;
          oldSub.nodeIds = oldSub.nodeIds.filter((id) => id !== nid);
        }
        node.subgraphId = subId;
        validNodeIds.push(nid);
      }
    }
  }

  const subDef: MermaidSubgraphDef = {
    type: 'subgraph',
    id: subId,
    label: label.trim() || subId,
    nodeIds: validNodeIds,
    subgraphIds: [],
  };

  ast.subgraphs.set(subId, subDef);
  return subId;
}

/**
 * Delete a subgraph.
 * If deleteInnerNodes is false (default), the subgraph is dissolved (nodes become ungrouped).
 * If deleteInnerNodes is true, all inner nodes and their edges are deleted.
 */
export function deleteSubgraph(
  ast: MermaidFlowchartAST,
  subgraphId: string,
  deleteInnerNodes: boolean = false
): boolean {
  if (!ast.subgraphs.has(subgraphId)) return false;

  const sub = ast.subgraphs.get(subgraphId)!;
  const innerNodeIds = [...sub.nodeIds];

  if (deleteInnerNodes) {
    deleteNodes(ast, innerNodeIds);
  } else {
    for (const nid of innerNodeIds) {
      const node = ast.nodes.get(nid);
      if (node && node.subgraphId === subgraphId) {
        delete node.subgraphId;
      }
    }
  }

  // Remove from parent subgraphs if nested
  for (const parentSub of ast.subgraphs.values()) {
    parentSub.subgraphIds = parentSub.subgraphIds.filter((id) => id !== subgraphId);
  }

  // Remove style if any
  ast.styles = ast.styles.filter((s) => s.targetId !== subgraphId);

  // Remove subgraph definition
  ast.subgraphs.delete(subgraphId);
  return true;
}

/**
 * Rename a subgraph label.
 */
export function renameSubgraph(
  ast: MermaidFlowchartAST,
  subgraphId: string,
  newLabel: string
): boolean {
  const sub = ast.subgraphs.get(subgraphId);
  if (!sub) return false;
  sub.label = newLabel.trim() || subgraphId;
  return true;
}

/**
 * Move a single node to another subgraph, or unparent it if targetSubgraphId is null.
 */
export function moveNodeToSubgraph(
  ast: MermaidFlowchartAST,
  nodeId: string,
  targetSubgraphId: string | null
): boolean {
  const node = ast.nodes.get(nodeId);
  if (!node) return false;

  if ((node.subgraphId || null) === (targetSubgraphId || null)) return true;

  // Remove from old subgraph
  if (node.subgraphId && ast.subgraphs.has(node.subgraphId)) {
    const oldSub = ast.subgraphs.get(node.subgraphId)!;
    oldSub.nodeIds = oldSub.nodeIds.filter((id) => id !== nodeId);
  }

  if (targetSubgraphId) {
    if (!ast.subgraphs.has(targetSubgraphId)) return false;
    const targetSub = ast.subgraphs.get(targetSubgraphId)!;
    if (!targetSub.nodeIds.includes(nodeId)) {
      targetSub.nodeIds.push(nodeId);
    }
    node.subgraphId = targetSubgraphId;
  } else {
    delete node.subgraphId;
  }

  return true;
}

/**
 * Batch move multiple nodes to a subgraph or unparent them.
 */
export function moveNodesToSubgraph(
  ast: MermaidFlowchartAST,
  nodeIds: Iterable<string>,
  targetSubgraphId: string | null
): number {
  let count = 0;
  for (const nid of nodeIds) {
    if (moveNodeToSubgraph(ast, nid, targetSubgraphId)) {
      count++;
    }
  }
  return count;
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
 * Duplicate nodes with unique IDs, cloning styles and internal edges.
 */
export function duplicateNodes(
  ast: MermaidFlowchartAST,
  nodeIds: Iterable<string>
): { nodeIds: string[]; edgeIds: string[] } {
  const originalIds = Array.from(nodeIds).filter((id) => ast.nodes.has(id));
  if (originalIds.length === 0) return { nodeIds: [], edgeIds: [] };

  const idMap = new Map<string, string>();
  const newCreatedNodeIds: string[] = [];

  for (const oldId of originalIds) {
    const oldNode = ast.nodes.get(oldId)!;
    const newId = generateUniqueNodeId(ast, oldId.replace(/_\d+$/, ''));
    idMap.set(oldId, newId);

    const clonedNode: MermaidNodeDef = {
      type: 'node',
      id: newId,
      label: `${oldNode.label} (copy)`,
      shape: oldNode.shape,
      subgraphId: oldNode.subgraphId,
      style: oldNode.style ? { ...oldNode.style } : undefined,
      classes: oldNode.classes ? [...oldNode.classes] : undefined,
    };

    ast.nodes.set(newId, clonedNode);
    newCreatedNodeIds.push(newId);

    if (clonedNode.subgraphId && ast.subgraphs.has(clonedNode.subgraphId)) {
      ast.subgraphs.get(clonedNode.subgraphId)!.nodeIds.push(newId);
    }
  }

  // Duplicate internal edges connecting the duplicated nodes
  const newCreatedEdgeIds: string[] = [];
  const originalSet = new Set(originalIds);
  for (const edge of ast.edges) {
    if (originalSet.has(edge.from) && originalSet.has(edge.to)) {
      const newFrom = idMap.get(edge.from)!;
      const newTo = idMap.get(edge.to)!;
      const newEdgeId = `e_${newFrom}_${newTo}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newEdge: MermaidEdgeDef = {
        type: 'edge',
        id: newEdgeId,
        from: newFrom,
        to: newTo,
        arrowType: edge.arrowType,
        label: edge.label,
        style: edge.style ? { ...edge.style } : undefined,
      };
      ast.edges.push(newEdge);
      newCreatedEdgeIds.push(newEdgeId);
    }
  }

  return { nodeIds: newCreatedNodeIds, edgeIds: newCreatedEdgeIds };
}

