/**
 * Hook for Group operations (creation, dissolve, deletion, rename, membership, styling),
 * dispatched through the current diagram driver's mutation surface.
 */

import { useCallback } from 'react';
import { DiagramDriver } from '../../../diagrams/types';
import { ThemePreset } from '../../constants';

export interface UseSubgraphMutationsOptions {
  driver: DiagramDriver;
  applyMutation: (mutator: (currentAst: any) => void, keepNodeId?: string) => void;
  selectedSubgraphId: string | null;
  setSelectedSubgraphId: (id: string | null) => void;
  setSelectedSubgraphRect: (rect: any) => void;
  setActiveSubgraphPopover: (p: any) => void;
}

export function useSubgraphMutations({
  driver,
  applyMutation,
  selectedSubgraphId,
  setSelectedSubgraphId,
  setSelectedSubgraphRect,
  setActiveSubgraphPopover,
}: UseSubgraphMutationsOptions) {
  const m = driver.mutations;

  const handleAddGroup = useCallback(() => {
    applyMutation((a) => {
      m.createGroup(a, `New ${driver.labels.group}`);
    });
  }, [m, driver, applyMutation]);

  const handleApplySubgraphPreset = useCallback(
    (preset: ThemePreset) => {
      if (!selectedSubgraphId) return;
      const target = selectedSubgraphId;

      applyMutation((a) => {
        if (!preset.fill && !preset.stroke && !preset.color) {
          m.clearGroupStyle(a, target);
        } else {
          const styles: Record<string, string> = {};
          if (preset.fill) styles['fill'] = preset.fill;
          if (preset.stroke) styles['stroke'] = preset.stroke;
          if (preset.color) styles['color'] = preset.color;
          m.updateGroupStyle(a, target, styles);
        }
      });
    },
    [selectedSubgraphId, m, applyMutation]
  );

  const handleUpdateSubgraphCustomStyle = useCallback(
    (property: string, value: string) => {
      if (!selectedSubgraphId) return;
      const target = selectedSubgraphId;

      applyMutation((a) => {
        const currentStyle = m.getGroupStyle(a, target) || {};
        const updated = { ...currentStyle };
        if (value) {
          updated[property] = value;
        } else {
          delete updated[property];
        }
        m.updateGroupStyle(a, target, Object.keys(updated).length > 0 ? updated : null);
      });
    },
    [selectedSubgraphId, m, applyMutation]
  );

  const handleClearSubgraphStyle = useCallback(() => {
    if (!selectedSubgraphId) return;
    applyMutation((a) => {
      m.clearGroupStyle(a, selectedSubgraphId);
    });
  }, [selectedSubgraphId, m, applyMutation]);

  const handleDissolveSubgraph = useCallback(() => {
    if (!selectedSubgraphId) return;
    applyMutation((a) => {
      m.deleteGroup(a, selectedSubgraphId, false);
    });
    setSelectedSubgraphId(null);
    setSelectedSubgraphRect(null);
    setActiveSubgraphPopover(null);
  }, [selectedSubgraphId, m, applyMutation, setSelectedSubgraphId, setSelectedSubgraphRect, setActiveSubgraphPopover]);

  const handleDeleteSubgraphAll = useCallback(() => {
    if (!selectedSubgraphId) return;
    applyMutation((a) => {
      m.deleteGroup(a, selectedSubgraphId, true);
    });
    setSelectedSubgraphId(null);
    setSelectedSubgraphRect(null);
    setActiveSubgraphPopover(null);
  }, [selectedSubgraphId, m, applyMutation, setSelectedSubgraphId, setSelectedSubgraphRect, setActiveSubgraphPopover]);

  const handleRenameSubgraph = useCallback(
    (subId: string, label: string) => {
      applyMutation((a) => {
        m.renameGroup(a, subId, label);
      });
    },
    [m, applyMutation]
  );

  const handleMoveNodeToSubgraph = useCallback(
    (nodeId: string, subId: string | null) => {
      applyMutation((a) => {
        m.moveNodeToGroup(a, nodeId, subId);
      }, nodeId);
    },
    [m, applyMutation]
  );

  const handleCreateGroupWithNode = useCallback(
    (nodeId: string) => {
      applyMutation((a) => {
        m.createGroupWithMembers(a, `New ${driver.labels.group}`, [nodeId]);
      }, nodeId);
    },
    [m, driver, applyMutation]
  );

  return {
    handleAddGroup,
    handleApplySubgraphPreset,
    handleUpdateSubgraphCustomStyle,
    handleClearSubgraphStyle,
    handleDissolveSubgraph,
    handleDeleteSubgraphAll,
    handleRenameSubgraph,
    handleMoveNodeToSubgraph,
    handleCreateGroupWithNode,
  };
}
