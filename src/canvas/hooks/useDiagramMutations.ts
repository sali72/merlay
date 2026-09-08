/**
 * Diagram Mutations Coordinator Hook
 * Composes domain-specific mutation hooks: AST, Node, Edge, Subgraph, Batch, and Clipboard.
 */

import React from 'react';
import { SupportedDiagramType } from '../../diagrams/types';
import { useDiagramAst } from './mutations/useDiagramAst';
import { useNodeMutations } from './mutations/useNodeMutations';
import { useEdgeMutations } from './mutations/useEdgeMutations';
import { useSubgraphMutations } from './mutations/useSubgraphMutations';
import { useBatchMutations } from './mutations/useBatchMutations';
import { useClipboardMutations } from './mutations/useClipboardMutations';

export interface UseDiagramMutationsOptions {
  code: string;
  setCode: (code: string) => void;
  onCodeChange: (code: string) => void;
  pushHistoryState: (code: string) => void;
  diagramType: SupportedDiagramType;
  pinNodeForCamera: (nodeId: string) => void;
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>;
  selectedEdgeId: string | null;
  selectedEdgeIds: Set<string>;
  selectedSubgraphId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;
  setSelectedSubgraphId: (id: string | null) => void;
  setSelectedNodeIds: (ids: Set<string>) => void;
  setSelectedEdgeIds: (ids: Set<string>) => void;
  setSelectedNodeRect: (rect: any) => void;
  setSelectedEdgePos: (pos: any) => void;
  setSelectedSubgraphRect: (rect: any) => void;
  setActiveNodePopover: (p: any) => void;
  setActiveEdgePopover: (p: any) => void;
  setActiveMultiPopover: (p: any) => void;
  setActiveSubgraphPopover: (p: any) => void;
  updateSelectedNodeHalo: (targets: any) => void;
  updateSelectedEdgeHalo: (targets: any) => void;
  selectedNodeIdsRef: React.MutableRefObject<Set<string>>;
  selectedEdgeIdsRef: React.MutableRefObject<Set<string>>;
  selectedStarKind?: 'start' | 'end' | null;
  setSelectedStarKind?: (k: 'start' | 'end' | null) => void;
}

export function useDiagramMutations({
  code,
  setCode,
  onCodeChange,
  pushHistoryState,
  diagramType,
  pinNodeForCamera,
  selectedNodeId,
  selectedNodeIds,
  selectedEdgeId,
  selectedEdgeIds,
  selectedSubgraphId,
  setSelectedNodeId,
  setSelectedEdgeId,
  setSelectedSubgraphId,
  setSelectedNodeIds,
  setSelectedEdgeIds,
  setSelectedNodeRect,
  setSelectedEdgePos,
  setSelectedSubgraphRect,
  setActiveNodePopover,
  setActiveEdgePopover,
  setActiveMultiPopover,
  setActiveSubgraphPopover,
  updateSelectedNodeHalo,
  updateSelectedEdgeHalo,
  selectedNodeIdsRef,
  selectedEdgeIdsRef,
  selectedStarKind,
  setSelectedStarKind,
}: UseDiagramMutationsOptions) {
  // 1. AST State & Projections
  const astHook = useDiagramAst({
    code,
    setCode,
    onCodeChange,
    pushHistoryState,
    diagramType,
    pinNodeForCamera,
  });

  const {
    isStateDiagram,
    ast,
    setAst,
    stateAst,
    setStateAst,
    syntaxError,
    setSyntaxError,
    displayNodes,
    displayEdges,
    displaySubgraphs,
    displayDirection,
    applyAstMutation,
    applyStateAstMutation,
  } = astHook;

  // 2. Node Operations
  const nodeOps = useNodeMutations({
    isStateDiagram,
    ast,
    stateAst,
    applyAstMutation,
    applyStateAstMutation,
    selectedNodeId,
    selectedNodeIds,
    setSelectedNodeId,
    setSelectedNodeRect,
    setSelectedNodeIds,
    selectedNodeIdsRef,
    setActiveNodePopover,
    setActiveMultiPopover,
    updateSelectedNodeHalo,
    selectedStarKind,
    setSelectedStarKind,
  });

  // 3. Edge Operations
  const edgeOps = useEdgeMutations({
    isStateDiagram,
    applyAstMutation,
    applyStateAstMutation,
    selectedEdgeId,
    setSelectedEdgeId,
    setSelectedEdgeIds,
    setSelectedEdgePos,
    setSelectedNodeId,
    updateSelectedEdgeHalo,
  });

  // 4. Subgraph Operations
  const subgraphOps = useSubgraphMutations({
    isStateDiagram,
    applyAstMutation,
    applyStateAstMutation,
    selectedSubgraphId,
    setSelectedSubgraphId,
    setSelectedSubgraphRect,
    setActiveSubgraphPopover,
  });

  // 5. Batch Operations
  const batchOps = useBatchMutations({
    isStateDiagram,
    applyAstMutation,
    applyStateAstMutation,
    selectedSubgraphId,
    selectedNodeIds,
    selectedEdgeIds,
    selectedNodeIdsRef,
    selectedEdgeIdsRef,
    setSelectedNodeIds,
    setSelectedEdgeIds,
    setSelectedNodeRect,
    setSelectedEdgePos,
    setSelectedSubgraphId,
    setSelectedSubgraphRect,
    setActiveNodePopover,
    setActiveEdgePopover,
    setActiveMultiPopover,
    setActiveSubgraphPopover,
    updateSelectedNodeHalo,
    updateSelectedEdgeHalo,
  });

  // 6. Clipboard Operations
  const clipboardOps = useClipboardMutations({
    isStateDiagram,
    applyAstMutation,
    applyStateAstMutation,
    selectedNodeIds,
    selectedNodeIdsRef,
    selectedEdgeIdsRef,
    setSelectedNodeIds,
    setSelectedEdgeIds,
    updateSelectedNodeHalo,
    updateSelectedEdgeHalo,
  });

  return {
    // Model state
    ast,
    setAst,
    stateAst,
    setStateAst,
    displayNodes,
    displayEdges,
    displaySubgraphs,
    displayDirection,
    syntaxError,
    setSyntaxError,
    applyAstMutation,
    applyStateAstMutation,

    // Composed operations
    ...nodeOps,
    ...edgeOps,
    ...subgraphOps,
    ...batchOps,
    ...clipboardOps,
  };
}
