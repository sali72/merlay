/**
 * Hook for Clipboard and Duplication operations (duplicate, copy, paste).
 */

import { useCallback, useRef } from 'react';
import { duplicateNodes } from '../../../ast/mutations';
import { MermaidFlowchartAST } from '../../../ast/types';
import { MermaidStateAST } from '../../../diagrams/state/types';
import * as stateMutations from '../../../diagrams/state/mutations';

export interface UseClipboardMutationsOptions {
  isStateDiagram: boolean;
  applyAstMutation: (mutator: (currentAst: MermaidFlowchartAST) => void, keepNodeId?: string) => void;
  applyStateAstMutation: (mutator: (currentAst: MermaidStateAST) => void, keepNodeId?: string) => void;
  selectedNodeIds: Set<string>;
  selectedNodeIdsRef: React.MutableRefObject<Set<string>>;
  selectedEdgeIdsRef: React.MutableRefObject<Set<string>>;
  setSelectedNodeIds: (ids: Set<string>) => void;
  setSelectedEdgeIds: (ids: Set<string>) => void;
  updateSelectedNodeHalo: (targets: any) => void;
  updateSelectedEdgeHalo: (targets: any) => void;
}

export function useClipboardMutations({
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
}: UseClipboardMutationsOptions) {
  const clipboardNodesRef = useRef<string[]>([]);

  const handleDuplicateSelected = useCallback(() => {
    if (selectedNodeIds.size === 0) return;
    const filteredIds = isStateDiagram
      ? new Set(Array.from(selectedNodeIds).filter((id) => id !== '[*]'))
      : selectedNodeIds;
    if (filteredIds.size === 0) return;
    if (isStateDiagram) {
      applyStateAstMutation((currentAst) => {
        const result = stateMutations.duplicateStates(currentAst, filteredIds);
        if (result.stateIds.length > 0) {
          const newSet = new Set(result.stateIds);
          const newEdges = new Set(result.transitionIds);
          if (selectedNodeIdsRef.current) selectedNodeIdsRef.current = newSet;
          if (selectedEdgeIdsRef.current) selectedEdgeIdsRef.current = newEdges;
          setSelectedNodeIds(newSet);
          setSelectedEdgeIds(newEdges);
          updateSelectedNodeHalo(newSet);
          updateSelectedEdgeHalo(newEdges);
        }
      });
      return;
    }

    applyAstMutation((currentAst) => {
      const result = duplicateNodes(currentAst, selectedNodeIds);
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
  }, [
    isStateDiagram,
    applyStateAstMutation,
    selectedNodeIds,
    applyAstMutation,
    selectedNodeIdsRef,
    selectedEdgeIdsRef,
    setSelectedNodeIds,
    setSelectedEdgeIds,
    updateSelectedNodeHalo,
    updateSelectedEdgeHalo,
  ]);

  const handleCopySelected = useCallback(() => {
    if (selectedNodeIds.size > 0) {
      const filtered = Array.from(selectedNodeIds).filter((id) => !(isStateDiagram && id === '[*]'));
      if (filtered.length > 0) clipboardNodesRef.current = filtered;
    }
  }, [selectedNodeIds, isStateDiagram]);

  const handlePasteSelected = useCallback(() => {
    if (clipboardNodesRef.current.length === 0) return;
    if (isStateDiagram) {
      applyStateAstMutation((currentAst) => {
        const result = stateMutations.duplicateStates(currentAst, clipboardNodesRef.current);
        if (result.stateIds.length > 0) {
          const newSet = new Set(result.stateIds);
          const newEdges = new Set(result.transitionIds);
          if (selectedNodeIdsRef.current) selectedNodeIdsRef.current = newSet;
          if (selectedEdgeIdsRef.current) selectedEdgeIdsRef.current = newEdges;
          setSelectedNodeIds(newSet);
          setSelectedEdgeIds(newEdges);
          updateSelectedNodeHalo(newSet);
          updateSelectedEdgeHalo(newEdges);
        }
      });
      return;
    }

    applyAstMutation((currentAst) => {
      const result = duplicateNodes(currentAst, clipboardNodesRef.current);
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
  }, [
    isStateDiagram,
    applyStateAstMutation,
    applyAstMutation,
    selectedNodeIdsRef,
    selectedEdgeIdsRef,
    setSelectedNodeIds,
    setSelectedEdgeIds,
    updateSelectedNodeHalo,
    updateSelectedEdgeHalo,
  ]);

  return {
    handleDuplicateSelected,
    handleCopySelected,
    handlePasteSelected,
  };
}
