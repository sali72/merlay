/**
 * Hook for Edge operations (type, reversal, split with intermediate node, label, style, deletion).
 */

import { useCallback } from 'react';
import {
  clearEdgeStyle,
  deleteEdge,
  getEdgeStyle,
  insertNodeOnEdge,
  reverseEdgeDirection,
  updateEdgeLabel,
  updateEdgeStyle,
  updateEdgeType,
} from '../../../ast/mutations';
import { ArrowType, MermaidFlowchartAST } from '../../../ast/types';
import { MermaidStateAST } from '../../../diagrams/state/types';
import * as stateMutations from '../../../diagrams/state/mutations';
import { EdgeThemePreset } from '../../constants';

export interface UseEdgeMutationsOptions {
  isStateDiagram: boolean;
  applyAstMutation: (mutator: (currentAst: MermaidFlowchartAST) => void, keepNodeId?: string) => void;
  applyStateAstMutation: (mutator: (currentAst: MermaidStateAST) => void, keepNodeId?: string) => void;
  selectedEdgeId: string | null;
  setSelectedEdgeId: (id: string | null) => void;
  setSelectedEdgeIds: (ids: Set<string>) => void;
  setSelectedEdgePos: (pos: any) => void;
  setSelectedNodeId: (id: string | null) => void;
  updateSelectedEdgeHalo: (targets: any) => void;
}

export function useEdgeMutations({
  isStateDiagram,
  applyAstMutation,
  applyStateAstMutation,
  selectedEdgeId,
  setSelectedEdgeId,
  setSelectedEdgeIds,
  setSelectedEdgePos,
  setSelectedNodeId,
  updateSelectedEdgeHalo,
}: UseEdgeMutationsOptions) {
  const handleChangeEdgeType = useCallback(
    (newType: ArrowType) => {
      if (!selectedEdgeId) return;
      applyAstMutation((a) => {
        updateEdgeType(a, selectedEdgeId, newType);
      });
      setSelectedEdgePos((prev: any) =>
        prev ? { ...prev, arrowType: newType } : null
      );
    },
    [selectedEdgeId, applyAstMutation, setSelectedEdgePos]
  );

  const handleReverseEdge = useCallback(() => {
    if (!selectedEdgeId) return;
    let newEdgeId: string | null = null;
    if (isStateDiagram) {
      applyStateAstMutation((a) => {
        const tr = a.transitions.find((t) => t.id === selectedEdgeId);
        if (tr) {
          const oldFrom = tr.from;
          tr.from = tr.to;
          tr.to = oldFrom;
          newEdgeId = tr.id;
        }
      });
    } else {
      applyAstMutation((a) => {
        newEdgeId = reverseEdgeDirection(a, selectedEdgeId);
      });
    }
    if (newEdgeId) {
      setSelectedEdgeId(newEdgeId);
      setSelectedEdgePos((prev: any) =>
        prev
          ? {
              ...prev,
              from: prev.to,
              to: prev.from,
            }
          : null
      );
    }
  }, [
    selectedEdgeId,
    isStateDiagram,
    applyStateAstMutation,
    applyAstMutation,
    setSelectedEdgeId,
    setSelectedEdgePos,
  ]);

  const handleInsertNodeOnEdge = useCallback(
    (edgeId: string) => {
      let createdNodeId: string | null = null;
      if (isStateDiagram) {
        applyStateAstMutation((a) => {
          const tr = a.transitions.find((t) => t.id === edgeId);
          if (tr) {
            const newStateId = stateMutations.addState(a, 'New State');
            createdNodeId = newStateId;
            const oldTo = tr.to;
            const oldLabel = tr.label;
            tr.to = newStateId;
            delete tr.label;
            stateMutations.connectStates(a, newStateId, oldTo, oldLabel);
          }
        });
      } else {
        applyAstMutation((a) => {
          const res = insertNodeOnEdge(a, edgeId, 'New Step');
          if (res) createdNodeId = res.nodeId;
        });
      }
      setSelectedEdgeId(null);
      setSelectedEdgePos(null);
      if (createdNodeId) {
        setSelectedNodeId(createdNodeId);
      }
    },
    [
      isStateDiagram,
      applyStateAstMutation,
      applyAstMutation,
      setSelectedEdgeId,
      setSelectedEdgePos,
      setSelectedNodeId,
    ]
  );

  const handleDeleteSelectedEdge = useCallback(() => {
    if (!selectedEdgeId) return;
    const targetEdgeId = selectedEdgeId;
    setSelectedEdgeIds(new Set());
    setSelectedEdgePos(null);
    updateSelectedEdgeHalo(new Set());
    if (isStateDiagram) {
      applyStateAstMutation((a) => {
        stateMutations.deleteTransition(a, targetEdgeId);
      });
    } else {
      applyAstMutation((a) => {
        deleteEdge(a, targetEdgeId);
      });
    }
  }, [
    selectedEdgeId,
    setSelectedEdgeIds,
    setSelectedEdgePos,
    updateSelectedEdgeHalo,
    isStateDiagram,
    applyStateAstMutation,
    applyAstMutation,
  ]);

  const handleUpdateEdgeLabel = useCallback(
    (newLabel: string) => {
      if (!selectedEdgeId) return;
      if (isStateDiagram) {
        applyStateAstMutation((a) => {
          stateMutations.updateTransitionLabel(a, selectedEdgeId, newLabel);
        });
      } else {
        applyAstMutation((a) => {
          updateEdgeLabel(a, selectedEdgeId, newLabel);
        });
      }
      setSelectedEdgePos((prev: any) =>
        prev ? { ...prev, label: newLabel } : null
      );
    },
    [selectedEdgeId, isStateDiagram, applyStateAstMutation, applyAstMutation, setSelectedEdgePos]
  );

  const handleApplyEdgePreset = useCallback(
    (preset: EdgeThemePreset) => {
      if (!selectedEdgeId) return;
      applyAstMutation((a) => {
        if (!preset.stroke) {
          clearEdgeStyle(a, selectedEdgeId);
        } else {
          const current = getEdgeStyle(a, selectedEdgeId) || {};
          updateEdgeStyle(a, selectedEdgeId, {
            ...current,
            stroke: preset.stroke,
          });
        }
      });
    },
    [selectedEdgeId, applyAstMutation]
  );

  const handleUpdateEdgeCustomStyle = useCallback(
    (property: string, value: string) => {
      if (!selectedEdgeId) return;
      applyAstMutation((a) => {
        const current = getEdgeStyle(a, selectedEdgeId) || {};
        const updated = { ...current };
        if (value) {
          updated[property] = value;
        } else {
          delete updated[property];
        }
        updateEdgeStyle(a, selectedEdgeId, updated);
      });
    },
    [selectedEdgeId, applyAstMutation]
  );

  const handleClearEdgeStyle = useCallback(() => {
    if (!selectedEdgeId) return;
    applyAstMutation((a) => {
      clearEdgeStyle(a, selectedEdgeId);
    });
  }, [selectedEdgeId, applyAstMutation]);

  return {
    handleChangeEdgeType,
    handleReverseEdge,
    handleInsertNodeOnEdge,
    handleDeleteSelectedEdge,
    handleUpdateEdgeLabel,
    handleApplyEdgePreset,
    handleUpdateEdgeCustomStyle,
    handleClearEdgeStyle,
  };
}
