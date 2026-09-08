/**
 * Orchestrates SVG interactivity setup for Native Mermaid diagrams:
 * binds nodes, edge hit-areas/labels, and subgraph clusters.
 */

import { MermaidEdgeDef, MermaidNodeDef, MermaidSubgraphDef } from '../../ast/types';
import { Rect } from '../types';
import { setupNodeInteractivity, StartEndKind, getStartEndKind } from './nodeInteractivity';
import { setupEdgeInteractivity } from './edgeInteractivity';
import { setupClusterInteractivity } from './clusterInteractivity';

export type { StartEndKind };
export { getStartEndKind };

export interface SetupSvgInteractivityOptions {
  mountEl: HTMLElement;
  displayNodes: Map<string, MermaidNodeDef>;
  displayEdges: MermaidEdgeDef[];
  displaySubgraphs: Map<string, MermaidSubgraphDef>;
  getLocalRect: (el: Element) => Rect | null;
  selectedNodeIdsRef: React.RefObject<Set<string>>;
  selectedEdgeIdsRef: React.RefObject<Set<string>>;
  onSelectNode: (targetNodeId: string, isMulti: boolean, htmlEl: Element) => void;
  onSelectEdge: (targetEdge: MermaidEdgeDef, resolvedPath: Element, isMulti: boolean) => void;
  onSelectSubgraph: (targetSubId: string, htmlEl: Element) => void;
  onStartEditingNode: (nodeId: string, nodeEl: Element) => void;
  onStartEditingEdge: (edgeId: string, anchorEl: Element) => void;
  onStartEditingSubgraph: (subId: string, subEl: Element) => void;
  onHoverNode: (nodeId: string, rect: Rect | null, startEndKind?: StartEndKind) => void;
}

export function setupSvgInteractivity(options: SetupSvgInteractivityOptions): void {
  const {
    mountEl,
    displayNodes,
    displayEdges,
    displaySubgraphs,
    getLocalRect,
    onSelectNode,
    onSelectEdge,
    onSelectSubgraph,
    onStartEditingNode,
    onStartEditingEdge,
    onStartEditingSubgraph,
    onHoverNode,
  } = options;

  // 1. Nodes & [*] anchors
  setupNodeInteractivity({
    mountEl,
    displayNodes,
    displaySubgraphs,
    getLocalRect,
    onSelectNode,
    onSelectSubgraph,
    onStartEditingNode,
    onStartEditingSubgraph,
    onHoverNode,
  });

  // 2. Edges & edge labels
  setupEdgeInteractivity({
    mountEl,
    displayEdges,
    onSelectEdge,
    onStartEditingEdge,
  });

  // 3. Subgraph clusters
  setupClusterInteractivity({
    mountEl,
    displaySubgraphs,
    onSelectSubgraph,
    onStartEditingSubgraph,
  });
}
