/**
 * Hook for single and batch Node operations (create, delete, kind, style, direction),
 * dispatched through the current diagram driver's mutation surface.
 */

import { useCallback } from 'react';
import { DiagramDriver } from '../../../diagrams/types';
import { ThemePreset } from '../../constants';

export interface UseNodeMutationsOptions {
  driver: DiagramDriver;
  ast: any;
  applyMutation: (mutator: (currentAst: any) => void, keepNodeId?: string) => void;
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
}: UseNodeMutationsOptions) {
  const m = driver.mutations;
  const anchors = m.anchors;

  const handleSproutNextStep = useCallback(
    (parentId: string) => {
      let createdChildId: string | null = null;
      applyMutation((currentAst) => {
        createdChildId = m.addChildNode(currentAst, parentId, driver.labels.addChild);
      }, parentId);
      if (createdChildId) {
        setSelectedNodeId(createdChildId);
      }
    },
    [m, driver, applyMutation, setSelectedNodeId]
  );

  const handleDeleteSelectedNode = useCallback(() => {
    if (!selectedNodeId) return;
    const targetId = selectedNodeId;
    const starKind = selectedStarKind as 'start' | 'end' | null | undefined;
    // Clear selection immediately (including anchor kind)
    setSelectedNodeId(null);
    setSelectedNodeRect(null);
    setActiveNodePopover(null);
    updateSelectedNodeHalo(new Set());
    if (setSelectedStarKind) setSelectedStarKind(null);
    if (anchors?.isAnchor(targetId)) {
      applyMutation((a) => {
        anchors.delete(a, starKind ?? null);
      });
      return;
    }
    applyMutation((a) => {
      m.deleteNode(a, targetId);
    });
  }, [
    selectedNodeId,
    selectedStarKind,
    anchors,
    m,
    setSelectedNodeId,
    setSelectedNodeRect,
    setActiveNodePopover,
    updateSelectedNodeHalo,
    setSelectedStarKind,
    applyMutation,
  ]);

  const handleUpdateNodeKind = useCallback(
    (kind: string, specificId?: string) => {
      const targets = specificId
        ? [specificId]
        : selectedNodeIds.size > 1
        ? Array.from(selectedNodeIds)
        : selectedNodeId
        ? [selectedNodeId]
        : [];
      if (targets.length === 0) return;
      applyMutation((a) => {
        m.updateNodesKind(a, targets, kind);
      }, specificId || selectedNodeId || undefined);
      setActiveNodePopover(null);
    },
    [m, applyMutation, selectedNodeIds, selectedNodeId, setActiveNodePopover]
  );

  const handleBatchUpdateNodeKind = useCallback(
    (kind: string) => {
      const filtered = Array.from(selectedNodeIds).filter(
        (id) => !(anchors && anchors.isAnchor(id))
      );
      if (filtered.length === 0) return;
      applyMutation((a) => {
        m.updateNodesKind(a, filtered, kind);
      });
      setActiveMultiPopover(null);
    },
    [selectedNodeIds, anchors, m, applyMutation, setActiveMultiPopover]
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

      applyMutation((a) => {
        if (!preset.fill && !preset.stroke && !preset.color) {
          m.clearNodesStyle(a, targets);
        } else {
          const styles: Record<string, string> = {};
          if (preset.fill) styles['fill'] = preset.fill;
          if (preset.stroke) styles['stroke'] = preset.stroke;
          if (preset.color) styles['color'] = preset.color;
          m.updateNodesStyle(a, targets, styles);
        }
      }, specificId || selectedNodeId || undefined);
    },
    [m, applyMutation, selectedNodeIds, selectedNodeId]
  );

  const handleUpdateCustomStyle = useCallback(
    (property: string, value: string, specificId?: string) => {
      const target = specificId || selectedNodeId;
      if (!target) return;

      applyMutation((a) => {
        const currentStyle = m.getNodeStyle(a, target) || {};
        const updated = { ...currentStyle };
        if (value) {
          updated[property] = value;
        } else {
          delete updated[property];
        }
        m.updateNodeStyle(a, target, Object.keys(updated).length > 0 ? updated : null);
      }, specificId || selectedNodeId || undefined);
    },
    [m, applyMutation, selectedNodeId]
  );

  const handleClearNodeStyle = useCallback(
    (specificId?: string) => {
      const target = specificId || selectedNodeId;
      if (!target) return;

      applyMutation((a) => {
        m.clearNodeStyle(a, target);
      }, specificId || selectedNodeId || undefined);
    },
    [m, applyMutation, selectedNodeId]
  );

  const handleAddStandaloneStep = useCallback(() => {
    let createdNodeId: string | null = null;
    applyMutation((a) => {
      createdNodeId = m.addNode(a, `New ${driver.labels.node}`);
    });
    if (createdNodeId) {
      setSelectedNodeId(createdNodeId);
    }
  }, [m, driver, applyMutation, setSelectedNodeId]);

  const handleToggleDirection = useCallback(() => {
    if (!driver.capabilities.supportsDirection) return;
    const currentDir = m.getDirection(ast) || 'TD';
    const nextDir = currentDir === 'LR' ? 'TD' : 'LR';
    applyMutation((a) => {
      m.setDirection(a, nextDir);
    });
  }, [driver, m, ast, applyMutation]);

  const handleAddStartState = useCallback(() => {
    if (!anchors) return null;
    let createdId: string | null = null;
    applyMutation((a) => {
      createdId = anchors.add(a, 'start');
    });
    if (createdId) {
      setSelectedNodeId(createdId);
    }
    return createdId;
  }, [anchors, applyMutation, setSelectedNodeId]);

  const handleAddEndState = useCallback(() => {
    if (!anchors) return null;
    let createdId: string | null = null;
    applyMutation((a) => {
      createdId = anchors.add(a, 'end');
    });
    if (createdId) {
      setSelectedNodeId(createdId);
    }
    return createdId;
  }, [anchors, applyMutation, setSelectedNodeId]);

  const handleConnectToEnd = useCallback(() => {
    if (!selectedNodeId || !anchors) return;
    applyMutation((a) => {
      anchors.connectToEnd(a, selectedNodeId);
    });
  }, [selectedNodeId, anchors, applyMutation]);

  return {
    handleSproutNextStep,
    handleDeleteSelectedNode,
    handleUpdateNodeKind,
    handleBatchUpdateNodeKind,
    handleApplyNodePreset,
    handleUpdateCustomStyle,
    handleClearNodeStyle,
    handleAddStandaloneStep,
    handleToggleDirection,
    handleAddStartState,
    handleAddEndState,
    handleConnectToEnd,
    hasStartState: anchors ? anchors.has(ast, 'start') : false,
    hasEndState: anchors ? anchors.has(ast, 'end') : false,
  };
}
