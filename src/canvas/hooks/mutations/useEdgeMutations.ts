/**
 * Hook for Edge operations (type, reversal, split with intermediate node, label, style, deletion),
 * dispatched through the current diagram driver's mutation surface.
 */

import { useCallback } from 'react';
import { DiagramDriver } from '../../../diagrams/types';
import { EdgeThemePreset } from '../../constants';

export interface UseEdgeMutationsOptions {
  driver: DiagramDriver;
  applyMutation: (mutator: (currentAst: any) => void, keepNodeId?: string) => void;
  selectedEdgeId: string | null;
  setSelectedEdgeId: (id: string | null) => void;
  setSelectedEdgeIds: (ids: Set<string>) => void;
  setSelectedEdgePos: (pos: any) => void;
  setSelectedNodeId: (id: string | null) => void;
  updateSelectedEdgeHalo: (targets: any) => void;
}

export function useEdgeMutations({
  driver,
  applyMutation,
  selectedEdgeId,
  setSelectedEdgeId,
  setSelectedEdgeIds,
  setSelectedEdgePos,
  setSelectedNodeId,
  updateSelectedEdgeHalo,
}: UseEdgeMutationsOptions) {
  const m = driver.mutations;

  const handleChangeEdgeType = useCallback(
    (newType: string) => {
      if (!selectedEdgeId || !m.updateEdgeType) return;
      applyMutation((a) => {
        m.updateEdgeType!(a, selectedEdgeId, newType);
      });
      setSelectedEdgePos((prev: any) =>
        prev ? { ...prev, arrowType: newType } : null
      );
    },
    [selectedEdgeId, m, applyMutation, setSelectedEdgePos]
  );

  const handleReverseEdge = useCallback(() => {
    if (!selectedEdgeId) return;
    let newEdgeId: string | null = null;
    applyMutation((a) => {
      newEdgeId = m.reverseEdge(a, selectedEdgeId);
    });
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
  }, [selectedEdgeId, m, applyMutation, setSelectedEdgeId, setSelectedEdgePos]);

  const handleInsertNodeOnEdge = useCallback(
    (edgeId: string) => {
      let createdNodeId: string | null = null;
      applyMutation((a) => {
        createdNodeId = m.insertNodeOnEdge(a, edgeId, `New ${driver.labels.node}`);
      });
      setSelectedEdgeId(null);
      setSelectedEdgePos(null);
      if (createdNodeId) {
        setSelectedNodeId(createdNodeId);
      }
    },
    [m, driver, applyMutation, setSelectedEdgeId, setSelectedEdgePos, setSelectedNodeId]
  );

  const handleDeleteSelectedEdge = useCallback(() => {
    if (!selectedEdgeId) return;
    const targetEdgeId = selectedEdgeId;
    setSelectedEdgeIds(new Set());
    setSelectedEdgePos(null);
    updateSelectedEdgeHalo(new Set());
    applyMutation((a) => {
      m.deleteEdge(a, targetEdgeId);
    });
  }, [
    selectedEdgeId,
    m,
    setSelectedEdgeIds,
    setSelectedEdgePos,
    updateSelectedEdgeHalo,
    applyMutation,
  ]);

  const handleUpdateEdgeLabel = useCallback(
    (newLabel: string) => {
      if (!selectedEdgeId) return;
      applyMutation((a) => {
        m.updateEdgeLabel(a, selectedEdgeId, newLabel);
      });
      setSelectedEdgePos((prev: any) =>
        prev ? { ...prev, label: newLabel } : null
      );
    },
    [selectedEdgeId, m, applyMutation, setSelectedEdgePos]
  );

  const handleApplyEdgePreset = useCallback(
    (preset: EdgeThemePreset) => {
      if (!selectedEdgeId || !m.updateEdgeStyle || !m.clearEdgeStyle) return;
      applyMutation((a) => {
        if (!preset.stroke) {
          m.clearEdgeStyle!(a, selectedEdgeId);
        } else {
          const current = m.getEdgeStyle?.(a, selectedEdgeId) || {};
          m.updateEdgeStyle!(a, selectedEdgeId, {
            ...current,
            stroke: preset.stroke,
          });
        }
      });
    },
    [selectedEdgeId, m, applyMutation]
  );

  const handleUpdateEdgeCustomStyle = useCallback(
    (property: string, value: string) => {
      if (!selectedEdgeId || !m.updateEdgeStyle) return;
      applyMutation((a) => {
        const current = m.getEdgeStyle?.(a, selectedEdgeId) || {};
        const updated = { ...current };
        if (value) {
          updated[property] = value;
        } else {
          delete updated[property];
        }
        m.updateEdgeStyle!(a, selectedEdgeId, Object.keys(updated).length > 0 ? updated : null);
      });
    },
    [selectedEdgeId, m, applyMutation]
  );

  const handleClearEdgeStyle = useCallback(() => {
    if (!selectedEdgeId || !m.clearEdgeStyle) return;
    applyMutation((a) => {
      m.clearEdgeStyle!(a, selectedEdgeId);
    });
  }, [selectedEdgeId, m, applyMutation]);

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
