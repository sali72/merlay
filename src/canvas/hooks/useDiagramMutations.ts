/**
 * Diagram Mutations Coordinator Hook
 * Composes domain-specific mutation hooks behind the current diagram driver.
 */

import React from 'react';
import { useDiagramAst } from './mutations/useDiagramAst';
import { useNodeMutations } from './mutations/useNodeMutations';
import { useEdgeMutations } from './mutations/useEdgeMutations';
import { useSubgraphMutations } from './mutations/useSubgraphMutations';
import { useBatchMutations } from './mutations/useBatchMutations';
import { useClipboardMutations } from './mutations/useClipboardMutations';

export interface UseDiagramMutationsOptions {
  /** AST state created by the view via useDiagramAst (so the view can also read projections). */
  astHook: ReturnType<typeof useDiagramAst>;
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
  astHook,
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
  // 1. AST State & Driver Projections (owned by the view)
  const {
    driver,
    ast,
    syntaxError,
    setSyntaxError,
    displayNodes,
    displayEdges,
    displaySubgraphs,
    displayDirection,
    applyMutation,
  } = astHook;

  // 2. Node Operations
  const nodeOps = useNodeMutations({
    driver,
    ast,
    applyMutation,
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
    driver,
    applyMutation,
    selectedEdgeId,
    setSelectedEdgeId,
    setSelectedEdgeIds,
    setSelectedEdgePos,
    setSelectedNodeId,
    updateSelectedEdgeHalo,
  });

  // 4. Subgraph Operations
  const subgraphOps = useSubgraphMutations({
    driver,
    applyMutation,
    selectedSubgraphId,
    setSelectedSubgraphId,
    setSelectedSubgraphRect,
    setActiveSubgraphPopover,
  });

  // 5. Batch Operations
  const batchOps = useBatchMutations({
    driver,
    applyMutation,
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
    driver,
    applyMutation,
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
    driver,
    ast,
    displayNodes,
    displayEdges,
    displaySubgraphs,
    displayDirection,
    syntaxError,
    setSyntaxError,
    applyMutation,

    // Composed operations
    ...nodeOps,
    ...edgeOps,
    ...subgraphOps,
    ...batchOps,
    ...clipboardOps,
  };
}
