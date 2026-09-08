/**
 * Subgraph (Group) mutations for Flowchart diagrams
 */

import { MermaidFlowchartAST, MermaidSubgraphDef } from '../types';
import { deleteNodes } from './nodeMutations';

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
      if (ast.subgraphs.has(nid)) {
        moveSubgraphToSubgraph(ast, nid, subId);
      } else if (ast.nodes.has(nid)) {
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

function isSubgraphDescendant(
  ast: MermaidFlowchartAST,
  ancestorId: string,
  candidateId: string
): boolean {
  const ancestor = ast.subgraphs.get(ancestorId);
  if (!ancestor || !ancestor.subgraphIds) return false;
  if (ancestor.subgraphIds.includes(candidateId)) return true;
  return ancestor.subgraphIds.some((cid) => isSubgraphDescendant(ast, cid, candidateId));
}

export function moveSubgraphToSubgraph(
  ast: MermaidFlowchartAST,
  childSubId: string,
  targetParentId: string | null
): boolean {
  if (!ast.subgraphs.has(childSubId)) return false;
  if (childSubId === targetParentId) return false;
  if (targetParentId && isSubgraphDescendant(ast, childSubId, targetParentId)) return false;

  // Remove from old parent subgraph
  for (const parent of ast.subgraphs.values()) {
    if (parent.subgraphIds?.includes(childSubId)) {
      parent.subgraphIds = parent.subgraphIds.filter((id) => id !== childSubId);
    }
  }

  // Add to target parent
  if (targetParentId && ast.subgraphs.has(targetParentId)) {
    const target = ast.subgraphs.get(targetParentId)!;
    if (!target.subgraphIds) target.subgraphIds = [];
    if (!target.subgraphIds.includes(childSubId)) {
      target.subgraphIds.push(childSubId);
    }
  }
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
  if (ast.subgraphs.has(nodeId)) {
    return moveSubgraphToSubgraph(ast, nodeId, targetSubgraphId);
  }

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
