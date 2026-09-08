/**
 * Hook for Clipboard and Duplication operations (duplicate, copy, paste),
 * dispatched through the current diagram driver's mutation surface.
 */

import { useCallback, useRef } from 'react';
import { DiagramDriver } from '../../../diagrams/types';

export interface UseClipboardMutationsOptions {
  driver: DiagramDriver;
  applyMutation: (mutator: (currentAst: any) => void, keepNodeId?: string) => void;
  selectedNodeIds: Set<string>;
  selectedNodeIdsRef: React.MutableRefObject<Set<string>>;
  selectedEdgeIdsRef: React.MutableRefObject<Set<string>>;
  setSelectedNodeIds: (ids: Set<string>) => void;
  setSelectedEdgeIds: (ids: Set<string>) => void;
  updateSelectedNodeHalo: (targets: any) => void;
  updateSelectedEdgeHalo: (targets: any) => void;
}

export function useClipboardMutations({
  driver,
  applyMutation,
  selectedNodeIds,
  selectedNodeIdsRef,
  selectedEdgeIdsRef,
  setSelectedNodeIds,
  setSelectedEdgeIds,
  updateSelectedNodeHalo,
  updateSelectedEdgeHalo,
}: UseClipboardMutationsOptions) {
  const m = driver.mutations;
  const anchors = m.anchors;
  const clipboardNodesRef = useRef<string[]>([]);

  const applyDuplication = useCallback(
    (nodeIds: Iterable<string>) => {
      applyMutation((currentAst) => {
        const result = m.duplicateNodes(currentAst, nodeIds);
        if (result.nodeIds.length > 0) {
          const newSet = new Set(result.nodeIds);
          const newEdges = new Set(result.edgeIds);
          if (selectedNodeIdsRef.current) selectedNodeIdsRef.current = newSet;
          if (selectedEdgeIdsRef.current) selectedEdgeIdsRef.current = newEdges;
          setSelectedNodeIds(newSet);
          setSelectedEdgeIds(newEdges);
          updateSelectedNodeHalo(newSet);
          updateSelectedEdgeHalo(newEdges);
        }
      });
    },
    [
      m,
      applyMutation,
      selectedNodeIdsRef,
      selectedEdgeIdsRef,
      setSelectedNodeIds,
      setSelectedEdgeIds,
      updateSelectedNodeHalo,
      updateSelectedEdgeHalo,
    ]
  );

  const handleDuplicateSelected = useCallback(() => {
    if (selectedNodeIds.size === 0) return;
    const filteredIds = Array.from(selectedNodeIds).filter(
      (id) => !(anchors && anchors.isAnchor(id))
    );
    if (filteredIds.length === 0) return;
    applyDuplication(filteredIds);
  }, [selectedNodeIds, anchors, applyDuplication]);

  const handleCopySelected = useCallback(() => {
    if (selectedNodeIds.size > 0) {
      const filtered = Array.from(selectedNodeIds).filter(
        (id) => !(anchors && anchors.isAnchor(id))
      );
      if (filtered.length > 0) clipboardNodesRef.current = filtered;
    }
  }, [selectedNodeIds, anchors]);

  const handlePasteSelected = useCallback(() => {
    if (clipboardNodesRef.current.length === 0) return;
    applyDuplication(clipboardNodesRef.current);
  }, [applyDuplication]);

  return {
    handleDuplicateSelected,
    handleCopySelected,
    handlePasteSelected,
  };
}
