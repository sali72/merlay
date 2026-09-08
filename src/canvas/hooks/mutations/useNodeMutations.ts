/**
 * Hook for single and batch Node operations (create, delete, shape, style, direction, start/end states).
 */

import { useCallback } from 'react';
import {
  addChildNode,
  addNode,
  clearNodeStyle,
  clearNodesStyle,
  deleteNode,
  getNodeStyle,
  setDiagramDirection,
  updateNodeShape,
  updateNodeStyle,
  updateNodesShape,
  updateNodesStyle,
} from '../../../ast/mutations';
import { MermaidFlowchartAST, MermaidShapeType } from '../../../ast/types';
import { MermaidStateAST, MermaidStateType } from '../../../diagrams/state/types';
import * as stateMutations from '../../../diagrams/state/mutations';
import { ThemePreset } from '../../constants';

export interface UseNodeMutationsOptions {
  isStateDiagram: boolean;
  ast: MermaidFlowchartAST;
  stateAst: MermaidStateAST;
  applyAstMutation: (mutator: (currentAst: MermaidFlowchartAST) => void, keepNodeId?: string) => void;
  applyStateAstMutation: (mutator: (currentAst: MermaidStateAST) => void, keepNodeId?: string) => void;
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNodeRect: (rect: any) => void;
  setSelectedNodeIds: (ids: Set<string>) => void;
  selectedNodeIdsRef: React.MutableRefObject<Set<string>>;
  setActiveNodePopover: (p: any) => void;
  setActiveMultiPopover: (p: any) => void;
  updateSelectedNodeHalo: (targets: any) => void;
  selectedStarKind?: 'start' | 'end' | null;
  setSelectedStarKind?: (k: 'start' | 'end' | null) => void;
}

export function useNodeMutations({
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
}: UseNodeMutationsOptions) {
  const handleSproutNextStep = useCallback(
    (parentId: string) => {
      let createdChildId: string | null = null;
      if (isStateDiagram) {
        applyStateAstMutation((currentAst) => {
          createdChildId = stateMutations.addChildState(currentAst, parentId, 'Next State');
        }, parentId);
      } else {
        applyAstMutation((currentAst) => {
          const res = addChildNode(currentAst, parentId, 'Next Step');
          createdChildId = res.nodeId;
        }, parentId);
      }
      if (createdChildId) {
        setSelectedNodeId(createdChildId);
      }
    },
    [isStateDiagram, applyStateAstMutation, applyAstMutation, setSelectedNodeId]
  );

  const handleDeleteSelectedNode = useCallback(() => {
    if (!selectedNodeId) return;
    const targetId = selectedNodeId;
    const starKind = selectedStarKind as 'start' | 'end' | null | undefined;
    // Clear selection immediately (including star kind)
    setSelectedNodeId(null);
    setSelectedNodeRect(null);
    setActiveNodePopover(null);
    updateSelectedNodeHalo(new Set());
    if (setSelectedStarKind) setSelectedStarKind(null);
    if (isStateDiagram && targetId === '[*]') {
      applyStateAstMutation((a) => {
        if (starKind === 'start') stateMutations.deleteStartAnchor(a);
        else if (starKind === 'end') stateMutations.deleteEndAnchor(a);
        else {
          // Fallback when kind unknown (e.g. programmatic) — remove both directions
          a.transitions = a.transitions.filter((t) => t.from !== '[*]' && t.to !== '[*]');
          stateMutations.pruneOrphanStartEnd(a);
        }
      });
      return;
    }
    if (isStateDiagram) {
      applyStateAstMutation((a) => {
        stateMutations.deleteState(a, targetId);
      });
    } else {
      applyAstMutation((a) => {
        deleteNode(a, targetId);
      });
    }
  }, [
    selectedNodeId,
    selectedStarKind,
    setSelectedNodeId,
    setSelectedNodeRect,
    setActiveNodePopover,
    updateSelectedNodeHalo,
    setSelectedStarKind,
    isStateDiagram,
    applyStateAstMutation,
    applyAstMutation,
  ]);

  const handleUpdateNodeShape = useCallback(
    (shape: MermaidShapeType, specificId?: string) => {
      applyAstMutation((a) => {
        if (specificId) {
          updateNodeShape(a, specificId, shape);
        } else if (selectedNodeIds.size > 1) {
          updateNodesShape(a, selectedNodeIds, shape);
        } else if (selectedNodeId) {
          updateNodeShape(a, selectedNodeId, shape);
        }
      }, specificId || selectedNodeId || undefined);
      setActiveNodePopover(null);
    },
    [applyAstMutation, selectedNodeIds, selectedNodeId, setActiveNodePopover]
  );

  const handleUpdateStateType = useCallback(
    (type: MermaidStateType, specificId?: string) => {
      const targetId = specificId || selectedNodeId;
      if (!targetId) return;
      applyStateAstMutation((a) => {
        stateMutations.updateStateType(a, targetId, type);
      }, type === 'start' || type === 'end' ? undefined : targetId);

      if (type === 'start' || type === 'end') {
        setSelectedNodeId(null);
        setSelectedNodeRect(null);
        setSelectedNodeIds(new Set());
        selectedNodeIdsRef.current = new Set();
        updateSelectedNodeHalo(null);
      }
      setActiveNodePopover(null);
    },
    [
      selectedNodeId,
      applyStateAstMutation,
      setActiveNodePopover,
      setSelectedNodeId,
      setSelectedNodeRect,
      setSelectedNodeIds,
      selectedNodeIdsRef,
      updateSelectedNodeHalo,
    ]
  );

  const handleBatchUpdateStateType = useCallback(
    (type: MermaidStateType) => {
      const filtered = Array.from(selectedNodeIds).filter((id) => id !== '[*]');
      if (filtered.length === 0) return;
      applyStateAstMutation((a) => {
        for (const nid of filtered) {
          stateMutations.updateStateType(a, nid, type);
        }
      });

      if (type === 'start' || type === 'end') {
        setSelectedNodeId(null);
        setSelectedNodeRect(null);
        setSelectedNodeIds(new Set());
        selectedNodeIdsRef.current = new Set();
        updateSelectedNodeHalo(null);
      }
      setActiveMultiPopover(null);
    },
    [
      selectedNodeIds,
      applyStateAstMutation,
      setActiveMultiPopover,
      setSelectedNodeId,
      setSelectedNodeRect,
      setSelectedNodeIds,
      selectedNodeIdsRef,
      updateSelectedNodeHalo,
    ]
  );

  const handleApplyNodePreset = useCallback(
    (preset: ThemePreset, specificId?: string) => {
      const targets = specificId
        ? [specificId]
        : selectedNodeIds.size > 0
        ? Array.from(selectedNodeIds)
        : selectedNodeId
        ? [selectedNodeId]
        : [];

      if (isStateDiagram) {
        applyStateAstMutation((a) => {
          if (!preset.fill && !preset.stroke && !preset.color) {
            stateMutations.clearStatesStyle(a, targets);
          } else {
            const styles: Record<string, string> = {};
            if (preset.fill) styles['fill'] = preset.fill;
            if (preset.stroke) styles['stroke'] = preset.stroke;
            if (preset.color) styles['color'] = preset.color;
            stateMutations.updateStatesStyle(a, targets, styles);
          }
        }, specificId || selectedNodeId || undefined);
        return;
      }

      applyAstMutation((a) => {
        if (!preset.fill && !preset.stroke && !preset.color) {
          clearNodesStyle(a, targets);
        } else {
          const styles: Record<string, string> = {};
          if (preset.fill) styles['fill'] = preset.fill;
          if (preset.stroke) styles['stroke'] = preset.stroke;
          if (preset.color) styles['color'] = preset.color;
          updateNodesStyle(a, targets, styles);
        }
      }, specificId || selectedNodeId || undefined);
    },
    [isStateDiagram, applyStateAstMutation, applyAstMutation, selectedNodeIds, selectedNodeId]
  );

  const handleUpdateCustomStyle = useCallback(
    (property: string, value: string, specificId?: string) => {
      const target = specificId || selectedNodeId;
      if (!target) return;

      if (isStateDiagram) {
        applyStateAstMutation((a) => {
          const currentStyle = stateMutations.getStateStyle(a, target) || {};
          const updated = { ...currentStyle };
          if (value) {
            updated[property] = value;
          } else {
            delete updated[property];
          }
          stateMutations.updateStateStyle(a, target, updated);
        }, specificId || selectedNodeId || undefined);
        return;
      }

      applyAstMutation((a) => {
        const currentStyle = getNodeStyle(a, target) || {};
        const updated = { ...currentStyle };
        if (value) {
          updated[property] = value;
        } else {
          delete updated[property];
        }
        updateNodeStyle(a, target, updated);
      }, specificId || selectedNodeId || undefined);
    },
    [isStateDiagram, applyStateAstMutation, applyAstMutation, selectedNodeId]
  );

  const handleClearNodeStyle = useCallback(
    (specificId?: string) => {
      const target = specificId || selectedNodeId;
      if (!target) return;

      if (isStateDiagram) {
        applyStateAstMutation((a) => {
          stateMutations.clearStateStyle(a, target);
        }, specificId || selectedNodeId || undefined);
        return;
      }

      applyAstMutation((a) => {
        clearNodeStyle(a, target);
      }, specificId || selectedNodeId || undefined);
    },
    [isStateDiagram, applyStateAstMutation, applyAstMutation, selectedNodeId]
  );

  const handleAddStandaloneStep = useCallback(() => {
    let createdNodeId: string | null = null;
    if (isStateDiagram) {
      applyStateAstMutation((a) => {
        createdNodeId = stateMutations.addState(a, 'New State');
      });
    } else {
      applyAstMutation((a) => {
        createdNodeId = addNode(a, 'New Step');
      });
    }
    if (createdNodeId) {
      setSelectedNodeId(createdNodeId);
    }
  }, [isStateDiagram, applyStateAstMutation, applyAstMutation, setSelectedNodeId]);

  const handleToggleDirection = useCallback(() => {
    if (isStateDiagram) {
      const currentDir = stateAst.direction || 'TD';
      const nextDir = currentDir === 'LR' ? 'TD' : 'LR';
      applyStateAstMutation((a) => {
        stateMutations.setStateDiagramDirection(a, nextDir);
      });
    } else {
      const currentDir = ast.direction || 'TD';
      const nextDir = currentDir === 'LR' ? 'TD' : 'LR';
      applyAstMutation((a) => {
        setDiagramDirection(a, nextDir);
      });
    }
  }, [isStateDiagram, stateAst.direction, ast.direction, applyStateAstMutation, applyAstMutation]);

  const handleAddStartState = useCallback(() => {
    if (!isStateDiagram) return;
    let createdId: string | null = null;
    applyStateAstMutation((a) => {
      createdId = stateMutations.addStartState(a, 'New State');
    });
    if (createdId) {
      setSelectedNodeId(createdId);
    }
  }, [isStateDiagram, applyStateAstMutation, setSelectedNodeId]);

  const handleAddEndState = useCallback(() => {
    if (!isStateDiagram) return;
    let createdId: string | null = null;
    applyStateAstMutation((a) => {
      createdId = stateMutations.addEndState(a, 'New State');
    });
    if (createdId) {
      setSelectedNodeId(createdId);
    }
  }, [isStateDiagram, applyStateAstMutation, setSelectedNodeId]);

  const handleConnectToEnd = useCallback(() => {
    if (!selectedNodeId || !isStateDiagram) return;
    applyStateAstMutation((a) => {
      stateMutations.connectToEndState(a, selectedNodeId);
    });
  }, [selectedNodeId, isStateDiagram, applyStateAstMutation]);

  return {
    handleSproutNextStep,
    handleDeleteSelectedNode,
    handleUpdateNodeShape,
    handleUpdateStateType,
    handleBatchUpdateStateType,
    handleApplyNodePreset,
    handleUpdateCustomStyle,
    handleClearNodeStyle,
    handleAddStandaloneStep,
    handleToggleDirection,
    handleAddStartState,
    handleAddEndState,
    handleConnectToEnd,
    hasStartState: isStateDiagram ? stateMutations.hasStartState(stateAst) : false,
    hasEndState: isStateDiagram ? stateMutations.hasEndState(stateAst) : false,
  };
}
