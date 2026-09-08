/**
 * Hook for Multi-Select Batch operations (batch delete, shape, type, styles, grouping, ungrouping).
 */

import { useCallback } from 'react';
import {
  clearEdgesStyle,
  clearNodesStyle,
  createSubgraph,
  deleteEdges,
  deleteNodes,
  deleteSubgraph,
  getEdgeStyle,
  getNodeStyle,
  moveNodesToSubgraph,
  updateEdgeStyle,
  updateEdgesStyle,
  updateEdgesType,
  updateNodeStyle,
  updateNodesShape,
  updateNodesStyle,
} from '../../../ast/mutations';
import { ArrowType, MermaidFlowchartAST, MermaidShapeType } from '../../../ast/types';
import { MermaidStateAST } from '../../../diagrams/state/types';
import * as stateMutations from '../../../diagrams/state/mutations';
import { ThemePreset } from '../../constants';

export interface UseBatchMutationsOptions {
  isStateDiagram: boolean;
  applyAstMutation: (mutator: (currentAst: MermaidFlowchartAST) => void, keepNodeId?: string) => void;
  applyStateAstMutation: (mutator: (currentAst: MermaidStateAST) => void, keepNodeId?: string) => void;
  selectedSubgraphId: string | null;
  selectedNodeIds: Set<string>;
  selectedEdgeIds: Set<string>;
  selectedNodeIdsRef: React.MutableRefObject<Set<string>>;
  selectedEdgeIdsRef: React.MutableRefObject<Set<string>>;
  setSelectedNodeIds: (ids: Set<string>) => void;
  setSelectedEdgeIds: (ids: Set<string>) => void;
  setSelectedNodeRect: (rect: any) => void;
  setSelectedEdgePos: (pos: any) => void;
  setSelectedSubgraphId: (id: string | null) => void;
  setSelectedSubgraphRect: (rect: any) => void;
  setActiveNodePopover: (p: any) => void;
  setActiveEdgePopover: (p: any) => void;
  setActiveMultiPopover: (p: any) => void;
  setActiveSubgraphPopover: (p: any) => void;
  updateSelectedNodeHalo: (targets: any) => void;
  updateSelectedEdgeHalo: (targets: any) => void;
}

export function useBatchMutations({
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
}: UseBatchMutationsOptions) {
  const handleBatchDeleteSelected = useCallback(() => {
    if (selectedSubgraphId) {
      if (isStateDiagram) {
        applyStateAstMutation((a) => {
          stateMutations.deleteCompositeState(a, selectedSubgraphId, false);
        });
      } else {
        applyAstMutation((a) => {
          deleteSubgraph(a, selectedSubgraphId, false);
        });
      }
      setSelectedSubgraphId(null);
      setSelectedSubgraphRect(null);
      setActiveSubgraphPopover(null);
      return;
    }

    if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) return;
    const nodesToDelete = Array.from(selectedNodeIds).filter((id) => !(isStateDiagram && id === '[*]'));
    const edgesToDelete = Array.from(selectedEdgeIds);

    const empty = new Set<string>();
    if (selectedNodeIdsRef.current) selectedNodeIdsRef.current = empty;
    if (selectedEdgeIdsRef.current) selectedEdgeIdsRef.current = new Set<string>();
    setSelectedNodeIds(new Set());
    setSelectedEdgeIds(new Set());
    setSelectedNodeRect(null);
    setSelectedEdgePos(null);
    setActiveNodePopover(null);
    setActiveEdgePopover(null);
    setActiveMultiPopover(null);
    updateSelectedNodeHalo(new Set());
    updateSelectedEdgeHalo(new Set());

    if (isStateDiagram) {
      applyStateAstMutation((a) => {
        if (nodesToDelete.length > 0) {
          stateMutations.deleteStates(a, nodesToDelete);
        }
        if (edgesToDelete.length > 0) {
          stateMutations.deleteTransitions(a, edgesToDelete);
        }
      });
    } else {
      applyAstMutation((a) => {
        if (nodesToDelete.length > 0) {
          deleteNodes(a, nodesToDelete);
        }
        if (edgesToDelete.length > 0) {
          deleteEdges(a, edgesToDelete);
        }
      });
    }
  }, [
    selectedSubgraphId,
    selectedNodeIds,
    selectedEdgeIds,
    selectedNodeIdsRef,
    selectedEdgeIdsRef,
    setSelectedNodeIds,
    setSelectedEdgeIds,
    setSelectedNodeRect,
    setSelectedEdgePos,
    setActiveNodePopover,
    setActiveEdgePopover,
    setActiveMultiPopover,
    updateSelectedNodeHalo,
    updateSelectedEdgeHalo,
    isStateDiagram,
    applyStateAstMutation,
    applyAstMutation,
    setSelectedSubgraphId,
    setSelectedSubgraphRect,
    setActiveSubgraphPopover,
  ]);

  const handleBatchUpdateShape = useCallback(
    (shape: MermaidShapeType) => {
      if (selectedNodeIds.size === 0) return;
      applyAstMutation((a) => {
        updateNodesShape(a, selectedNodeIds, shape);
      });
      setActiveMultiPopover(null);
    },
    [selectedNodeIds, applyAstMutation, setActiveMultiPopover]
  );

  const handleBatchUpdateEdgeType = useCallback(
    (newType: ArrowType) => {
      if (selectedEdgeIds.size === 0) return;
      applyAstMutation((a) => {
        updateEdgesType(a, selectedEdgeIds, newType);
      });
      setActiveMultiPopover(null);
    },
    [selectedEdgeIds, applyAstMutation, setActiveMultiPopover]
  );

  const handleBatchApplyThemePreset = useCallback(
    (preset: ThemePreset) => {
      if (isStateDiagram) {
        applyStateAstMutation((a) => {
          if (selectedNodeIds.size > 0) {
            if (!preset.fill && !preset.stroke && !preset.color) {
              stateMutations.clearStatesStyle(a, selectedNodeIds);
            } else {
              const styles: Record<string, string> = {};
              if (preset.fill) styles['fill'] = preset.fill;
              if (preset.stroke) styles['stroke'] = preset.stroke;
              if (preset.color) styles['color'] = preset.color;
              stateMutations.updateStatesStyle(a, selectedNodeIds, styles);
            }
          }
        });
        return;
      }

      applyAstMutation((a) => {
        if (selectedNodeIds.size > 0) {
          if (!preset.fill && !preset.stroke && !preset.color) {
            clearNodesStyle(a, selectedNodeIds);
          } else {
            const styles: Record<string, string> = {};
            if (preset.fill) styles['fill'] = preset.fill;
            if (preset.stroke) styles['stroke'] = preset.stroke;
            if (preset.color) styles['color'] = preset.color;
            updateNodesStyle(a, selectedNodeIds, styles);
          }
        }
        if (selectedEdgeIds.size > 0) {
          if (!preset.stroke) {
            clearEdgesStyle(a, selectedEdgeIds);
          } else {
            updateEdgesStyle(a, selectedEdgeIds, { stroke: preset.stroke });
          }
        }
      });
    },
    [isStateDiagram, applyStateAstMutation, applyAstMutation, selectedNodeIds, selectedEdgeIds]
  );

  const handleBatchUpdateCustomStyle = useCallback(
    (property: string, value: string) => {
      if (isStateDiagram) {
        applyStateAstMutation((a) => {
          if (selectedNodeIds.size > 0) {
            for (const nid of selectedNodeIds) {
              const currentStyle = stateMutations.getStateStyle(a, nid) || {};
              const updated = { ...currentStyle };
              if (value) updated[property] = value;
              else delete updated[property];
              stateMutations.updateStateStyle(a, nid, updated);
            }
          }
        });
        return;
      }

      applyAstMutation((a) => {
        if (selectedNodeIds.size > 0) {
          for (const nid of selectedNodeIds) {
            const currentStyle = getNodeStyle(a, nid) || {};
            const updated = { ...currentStyle };
            if (value) updated[property] = value;
            else delete updated[property];
            updateNodeStyle(a, nid, updated);
          }
        }
        if (selectedEdgeIds.size > 0) {
          for (const eid of selectedEdgeIds) {
            const currentStyle = getEdgeStyle(a, eid) || {};
            const updated = { ...currentStyle };
            if (value) updated[property] = value;
            else delete updated[property];
            updateEdgeStyle(a, eid, updated);
          }
        }
      });
    },
    [isStateDiagram, applyStateAstMutation, applyAstMutation, selectedNodeIds, selectedEdgeIds]
  );

  const handleBatchClearStyle = useCallback(() => {
    if (isStateDiagram) {
      applyStateAstMutation((a) => {
        if (selectedNodeIds.size > 0) {
          stateMutations.clearStatesStyle(a, selectedNodeIds);
        }
      });
      return;
    }

    applyAstMutation((a) => {
      if (selectedNodeIds.size > 0) {
        clearNodesStyle(a, selectedNodeIds);
      }
      if (selectedEdgeIds.size > 0) {
        clearEdgesStyle(a, selectedEdgeIds);
      }
    });
  }, [isStateDiagram, applyStateAstMutation, applyAstMutation, selectedNodeIds, selectedEdgeIds]);

  const handleBatchGroupSelected = useCallback(() => {
    if (isStateDiagram) {
      const filtered = Array.from(selectedNodeIds).filter((id) => id !== '[*]');
      if (filtered.length === 0) return;
      applyStateAstMutation((currentAst) => {
        const compId = stateMutations.createCompositeState(currentAst, 'Composite State');
        for (const nid of filtered) {
          stateMutations.moveStateToComposite(currentAst, nid, compId);
        }
      });
    } else {
      applyAstMutation((currentAst) => {
        createSubgraph(currentAst, 'New Group', selectedNodeIds);
      });
    }
  }, [isStateDiagram, applyStateAstMutation, applyAstMutation, selectedNodeIds]);

  const handleBatchUngroupSelected = useCallback(() => {
    if (isStateDiagram) {
      const filtered = Array.from(selectedNodeIds).filter((id) => id !== '[*]');
      if (filtered.length === 0) return;
      applyStateAstMutation((currentAst) => {
        for (const nid of filtered) {
          stateMutations.moveStateToComposite(currentAst, nid, undefined);
        }
      });
    } else {
      applyAstMutation((currentAst) => {
        moveNodesToSubgraph(currentAst, selectedNodeIds, null);
      });
    }
  }, [isStateDiagram, applyStateAstMutation, applyAstMutation, selectedNodeIds]);

  return {
    handleBatchDeleteSelected,
    handleBatchUpdateShape,
    handleBatchUpdateEdgeType,
    handleBatchApplyThemePreset,
    handleBatchUpdateCustomStyle,
    handleBatchClearStyle,
    handleBatchGroupSelected,
    handleBatchUngroupSelected,
  };
}
