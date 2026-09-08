/**
 * Hook for Multi-Select Batch operations (batch delete, kind, styles, grouping, ungrouping),
 * dispatched through the current diagram driver's mutation surface.
 */

import { useCallback } from 'react';
import { DiagramDriver } from '../../../diagrams/types';
import { ThemePreset } from '../../constants';

export interface UseBatchMutationsOptions {
  driver: DiagramDriver;
  applyMutation: (mutator: (currentAst: any) => void, keepNodeId?: string) => void;
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
}: UseBatchMutationsOptions) {
  const m = driver.mutations;
  const anchors = m.anchors;

  const handleBatchDeleteSelected = useCallback(() => {
    if (selectedSubgraphId) {
      applyMutation((a) => {
        m.deleteGroup(a, selectedSubgraphId, false);
      });
      setSelectedSubgraphId(null);
      setSelectedSubgraphRect(null);
      setActiveSubgraphPopover(null);
      return;
    }

    if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) return;
    const nodesToDelete = Array.from(selectedNodeIds);
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

    applyMutation((a) => {
      if (nodesToDelete.length > 0) {
        m.deleteNodes(a, nodesToDelete);
      }
      if (edgesToDelete.length > 0) {
        m.deleteEdges(a, edgesToDelete);
      }
    });
  }, [
    selectedSubgraphId,
    selectedNodeIds,
    selectedEdgeIds,
    selectedNodeIdsRef,
    selectedEdgeIdsRef,
    m,
    applyMutation,
    setSelectedNodeIds,
    setSelectedEdgeIds,
    setSelectedNodeRect,
    setSelectedEdgePos,
    setActiveNodePopover,
    setActiveEdgePopover,
    setActiveMultiPopover,
    updateSelectedNodeHalo,
    updateSelectedEdgeHalo,
    setSelectedSubgraphId,
    setSelectedSubgraphRect,
    setActiveSubgraphPopover,
  ]);

  const handleBatchUpdateNodeKind = useCallback(
    (kind: string) => {
      if (selectedNodeIds.size === 0) return;
      applyMutation((a) => {
        m.updateNodesKind(a, selectedNodeIds, kind);
      });
      setActiveMultiPopover(null);
    },
    [selectedNodeIds, m, applyMutation, setActiveMultiPopover]
  );

  const handleBatchUpdateEdgeType = useCallback(
    (newType: string) => {
      if (selectedEdgeIds.size === 0 || !m.updateEdgesType) return;
      applyMutation((a) => {
        m.updateEdgesType!(a, selectedEdgeIds, newType);
      });
      setActiveMultiPopover(null);
    },
    [selectedEdgeIds, m, applyMutation, setActiveMultiPopover]
  );

  const handleBatchApplyThemePreset = useCallback(
    (preset: ThemePreset) => {
      applyMutation((a) => {
        if (selectedNodeIds.size > 0) {
          if (!preset.fill && !preset.stroke && !preset.color) {
            m.clearNodesStyle(a, selectedNodeIds);
          } else {
            const styles: Record<string, string> = {};
            if (preset.fill) styles['fill'] = preset.fill;
            if (preset.stroke) styles['stroke'] = preset.stroke;
            if (preset.color) styles['color'] = preset.color;
            m.updateNodesStyle(a, selectedNodeIds, styles);
          }
        }
        if (selectedEdgeIds.size > 0 && m.updateEdgesStyle) {
          if (!preset.stroke) {
            m.clearEdgesStyle!(a, selectedEdgeIds);
          } else {
            m.updateEdgesStyle!(a, selectedEdgeIds, { stroke: preset.stroke });
          }
        }
      });
    },
    [selectedNodeIds, selectedEdgeIds, m, applyMutation]
  );

  const handleBatchUpdateCustomStyle = useCallback(
    (property: string, value: string) => {
      applyMutation((a) => {
        if (selectedNodeIds.size > 0) {
          for (const nid of selectedNodeIds) {
            const currentStyle = m.getNodeStyle(a, nid) || {};
            const updated = { ...currentStyle };
            if (value) updated[property] = value;
            else delete updated[property];
            m.updateNodeStyle(a, nid, Object.keys(updated).length > 0 ? updated : null);
          }
        }
        if (selectedEdgeIds.size > 0 && m.updateEdgeStyle) {
          for (const eid of selectedEdgeIds) {
            const currentStyle = m.getEdgeStyle?.(a, eid) || {};
            const updated = { ...currentStyle };
            if (value) updated[property] = value;
            else delete updated[property];
            m.updateEdgeStyle!(a, eid, Object.keys(updated).length > 0 ? updated : null);
          }
        }
      });
    },
    [selectedNodeIds, selectedEdgeIds, m, applyMutation]
  );

  const handleBatchClearStyle = useCallback(() => {
    applyMutation((a) => {
      if (selectedNodeIds.size > 0) {
        m.clearNodesStyle(a, selectedNodeIds);
      }
      if (selectedEdgeIds.size > 0 && m.clearEdgesStyle) {
        m.clearEdgesStyle!(a, selectedEdgeIds);
      }
    });
  }, [selectedNodeIds, selectedEdgeIds, m, applyMutation]);

  const handleBatchGroupSelected = useCallback(() => {
    const filtered = Array.from(selectedNodeIds).filter(
      (id) => !(anchors && anchors.isAnchor(id))
    );
    if (filtered.length === 0) return;
    applyMutation((a) => {
      m.createGroupWithMembers(a, `New ${driver.labels.group}`, filtered);
    });
  }, [selectedNodeIds, anchors, m, driver, applyMutation]);

  const handleBatchUngroupSelected = useCallback(() => {
    const filtered = Array.from(selectedNodeIds).filter(
      (id) => !(anchors && anchors.isAnchor(id))
    );
    if (filtered.length === 0) return;
    applyMutation((a) => {
      m.moveNodesToGroup(a, filtered, null);
    });
  }, [selectedNodeIds, anchors, m, applyMutation]);

  return {
    handleBatchDeleteSelected,
    handleBatchUpdateNodeKind,
    handleBatchUpdateEdgeType,
    handleBatchApplyThemePreset,
    handleBatchUpdateCustomStyle,
    handleBatchClearStyle,
    handleBatchGroupSelected,
    handleBatchUngroupSelected,
  };
}
