import { useState, useRef, useCallback, useMemo } from 'react';
import {
  ActiveEdgePopover,
  ActiveMultiPopover,
  ActiveNodePopover,
  PopoverPos,
  Rect,
  SelectedEdgePos,
} from '../types';
import {
  applySelectedEdgeHalos,
  applySelectedNodeHalos,
} from '../renderer/selectionHalo';

export interface UseCanvasSelectionOptions {
  svgMountRef: React.RefObject<HTMLDivElement>;
  getLocalRect: (el: Element) => Rect | null;
  displayDirection: string;
  selectedStarKind?: 'start' | 'end' | null;
}

export function useCanvasSelection({
  svgMountRef,
  getLocalRect,
  displayDirection,
  selectedStarKind,
}: UseCanvasSelectionOptions) {
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(new Set());
  const [selectedSubgraphId, setSelectedSubgraphId] = useState<string | null>(null);

  const [selectedNodeRect, setSelectedNodeRect] = useState<Rect | null>(null);
  const [selectedEdgePos, setSelectedEdgePos] = useState<SelectedEdgePos | null>(null);
  const [selectedSubgraphRect, setSelectedSubgraphRect] = useState<Rect | null>(null);

  const selectedNodeIdsRef = useRef<Set<string>>(new Set());
  const selectedEdgeIdsRef = useRef<Set<string>>(new Set());

  const [activeNodePopover, setActiveNodePopover] = useState<ActiveNodePopover>(null);
  const [activeEdgePopover, setActiveEdgePopover] = useState<ActiveEdgePopover>(null);
  const [activeMultiPopover, setActiveMultiPopover] = useState<ActiveMultiPopover>(null);
  const [activeSubgraphPopover, setActiveSubgraphPopover] = useState<'style' | null>(null);

  const [unmatchedSubgraphIds, setUnmatchedSubgraphIds] = useState<string[]>([]);

  const isMultiSelect = selectedNodeIds.size + selectedEdgeIds.size > 1;

  const selectedNodeId =
    selectedNodeIds.size === 1
      ? Array.from(selectedNodeIds)[0]
      : null;

  const selectedEdgeId =
    selectedEdgeIds.size === 1
      ? Array.from(selectedEdgeIds)[0]
      : null;

  const updateSelectedNodeHalo = useCallback(
    (targets?: string | null | Set<string> | string[]) => {
      applySelectedNodeHalos(
        svgMountRef.current,
        selectedNodeIdsRef.current,
        targets,
        selectedStarKind ?? null
      );
    },
    [svgMountRef, selectedStarKind]
  );

  const updateSelectedEdgeHalo = useCallback(
    (targets?: string | null | Set<string> | string[]) => {
      applySelectedEdgeHalos(
        svgMountRef.current,
        selectedEdgeIdsRef.current,
        targets
      );
    },
    [svgMountRef]
  );

  const updateSelectedNodeRect = useCallback(() => {
    const currentId =
      selectedNodeIdsRef.current.size === 1
        ? Array.from(selectedNodeIdsRef.current)[0]
        : null;
    if (!currentId || !svgMountRef.current) {
      setSelectedNodeRect(null);
      return;
    }
    // For [*] we keep anchors distinct — HUD should anchor to the selected
    // start or end circle, not the union of both.
    const selector =
      currentId === '[*]' && selectedStarKind
        ? `[data-mermaid-node-id="${currentId}"][data-mermaid-start-end="${selectedStarKind}"]`
        : `[data-mermaid-node-id="${currentId}"]`;
    const nodeEls = Array.from(svgMountRef.current.querySelectorAll(selector)) as Element[];
    // Fallback to any [*] element if kind-filtered query found nothing (e.g. during re-render)
    const elsToUse =
      nodeEls.length > 0
        ? nodeEls
        : Array.from(svgMountRef.current.querySelectorAll(`[data-mermaid-node-id="${currentId}"]`));
    if (elsToUse.length === 0) {
      setSelectedNodeRect(null);
      return;
    }
    if (elsToUse.length === 1) {
      const rect = getLocalRect(elsToUse[0]);
      if (rect) setSelectedNodeRect(rect);
      return;
    }
    // Union of all matching rects (covers both start & end anchors when no kind).
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let found = false;
    for (const el of elsToUse) {
      const r = getLocalRect(el);
      if (!r) continue;
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.width);
      maxY = Math.max(maxY, r.y + r.height);
      found = true;
    }
    if (found) {
      setSelectedNodeRect({ x: minX, y: minY, width: maxX - minX, height: maxY - minY });
    }
  }, [getLocalRect, svgMountRef, selectedStarKind]);

  const setSelectedNodeId = useCallback(
    (id: string | null) => {
      const newSet = id ? new Set([id]) : new Set<string>();
      selectedNodeIdsRef.current = newSet;
      setSelectedNodeIds(newSet);
      updateSelectedNodeHalo(newSet);
      if (id && svgMountRef.current) {
        const selector =
          id === '[*]' && selectedStarKind
            ? `[data-mermaid-node-id="${id}"][data-mermaid-start-end="${selectedStarKind}"]`
            : `[data-mermaid-node-id="${id}"]`;
        let nodeEls = Array.from(svgMountRef.current.querySelectorAll(selector)) as Element[];
        if (nodeEls.length === 0) {
          nodeEls = Array.from(svgMountRef.current.querySelectorAll(`[data-mermaid-node-id="${id}"]`));
        }
        if (nodeEls.length > 0) {
          if (nodeEls.length === 1) {
            const rect = getLocalRect(nodeEls[0]);
            if (rect) setSelectedNodeRect(rect);
          } else {
            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;
            let found = false;
            for (const el of nodeEls) {
              const r = getLocalRect(el);
              if (!r) continue;
              minX = Math.min(minX, r.x);
              minY = Math.min(minY, r.y);
              maxX = Math.max(maxX, r.x + r.width);
              maxY = Math.max(maxY, r.y + r.height);
              found = true;
            }
            if (found) setSelectedNodeRect({ x: minX, y: minY, width: maxX - minX, height: maxY - minY });
          }
        }
      } else {
        setSelectedNodeRect(null);
      }
    },
    [getLocalRect, updateSelectedNodeHalo, svgMountRef, selectedStarKind]
  );

  const setSelectedEdgeId = useCallback(
    (id: string | null) => {
      const newSet = id ? new Set([id]) : new Set<string>();
      selectedEdgeIdsRef.current = newSet;
      setSelectedEdgeIds(newSet);
      updateSelectedEdgeHalo(newSet);
      if (!id) setSelectedEdgePos(null);
    },
    [updateSelectedEdgeHalo]
  );

  const clearSelection = useCallback(() => {
    selectedNodeIdsRef.current = new Set();
    selectedEdgeIdsRef.current = new Set();
    setSelectedNodeIds(new Set());
    setSelectedEdgeIds(new Set());
    setSelectedSubgraphId(null);
    setSelectedNodeRect(null);
    setSelectedEdgePos(null);
    setSelectedSubgraphRect(null);
    setActiveNodePopover(null);
    setActiveEdgePopover(null);
    setActiveMultiPopover(null);
    setActiveSubgraphPopover(null);
    updateSelectedNodeHalo(new Set());
    updateSelectedEdgeHalo(new Set());
    if (svgMountRef.current) {
      svgMountRef.current
        .querySelectorAll('.mermaid-cluster-selected')
        .forEach((c) => c.classList.remove('mermaid-cluster-selected'));
    }
  }, [svgMountRef, updateSelectedNodeHalo, updateSelectedEdgeHalo]);

  // Downstream Sprout Button Position based on diagram direction
  const isLR = displayDirection === 'LR' || displayDirection === 'RL';
  const sproutX = selectedNodeRect
    ? isLR
      ? selectedNodeRect.x + selectedNodeRect.width + 12
      : selectedNodeRect.x + selectedNodeRect.width / 2
    : 0;
  const sproutY = selectedNodeRect
    ? isLR
      ? selectedNodeRect.y + selectedNodeRect.height / 2
      : selectedNodeRect.y + selectedNodeRect.height + 12
    : 0;

  // Bounding box enclosing all selected nodes & edges in world coordinates (for Multi-Select)
  const multiSelectBounds = useMemo(() => {
    const totalCount = selectedNodeIds.size + selectedEdgeIds.size;
    if (totalCount <= 1 || !svgMountRef.current) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let found = 0;

    for (const id of selectedNodeIds) {
      const els = Array.from(
        svgMountRef.current.querySelectorAll(`[data-mermaid-node-id="${id}"]`)
      );
      for (const el of els) {
        const rect = getLocalRect(el);
        if (rect) {
          minX = Math.min(minX, rect.x);
          minY = Math.min(minY, rect.y);
          maxX = Math.max(maxX, rect.x + rect.width);
          maxY = Math.max(maxY, rect.y + rect.height);
          found++;
        }
      }
    }

    for (const edgeId of selectedEdgeIds) {
      const el = svgMountRef.current.querySelector(
        `path[data-mermaid-edge-id="${edgeId}"]:not(.mermaid-edge-hit-area)`
      );
      if (el) {
        const rect = getLocalRect(el);
        if (rect) {
          minX = Math.min(minX, rect.x);
          minY = Math.min(minY, rect.y);
          maxX = Math.max(maxX, rect.x + rect.width);
          maxY = Math.max(maxY, rect.y + rect.height);
          found++;
        }
      }
    }

    if (found === 0) return null;
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: minX + (maxX - minX) / 2,
      topY: minY,
    };
  }, [selectedNodeIds, selectedEdgeIds, getLocalRect, svgMountRef]);

  // Position for Shape, Arrow Type & Style popovers (anchored to single sprout or multi-select cluster)
  const popoverPos: PopoverPos | null = useMemo(() => {
    if (isMultiSelect && multiSelectBounds) {
      return {
        left: multiSelectBounds.centerX,
        top: multiSelectBounds.topY - 8,
        transform: 'translate(-50%, 0)',
      };
    }
    if (selectedNodeRect) {
      return {
        left: sproutX,
        top: isLR ? sproutY + 28 : sproutY + 36,
        transform: isLR ? 'translate(0, 0)' : 'translate(-50%, 0)',
      };
    }
    if (selectedEdgePos) {
      return {
        left: selectedEdgePos.x,
        top: selectedEdgePos.y + 14,
        transform: 'translate(-50%, 0)',
      };
    }
    return null;
  }, [
    isMultiSelect,
    multiSelectBounds,
    selectedNodeRect,
    selectedEdgePos,
    sproutX,
    sproutY,
    isLR,
  ]);

  // Position for the subgraph style popover (anchored above the group HUD)
  const subgraphPopoverPos: PopoverPos | null = useMemo(() => {
    if (!selectedSubgraphRect || !selectedSubgraphId) return null;
    return {
      left: selectedSubgraphRect.x + selectedSubgraphRect.width / 2,
      top: selectedSubgraphRect.y - 20,
      transform: 'translate(-50%, -100%)',
    };
  }, [selectedSubgraphRect, selectedSubgraphId]);

  const isolateSelection = useCallback(
    (keepType: 'node' | 'edge' | 'subgraph', id: string) => {
      const empty = new Set<string>();
      if (keepType === 'node') {
        selectedEdgeIdsRef.current = empty;
        setSelectedEdgeIds(empty);
        setSelectedEdgePos(null);
        updateSelectedEdgeHalo(empty);
      } else if (keepType === 'edge') {
        selectedNodeIdsRef.current = empty;
        setSelectedNodeIds(empty);
        setSelectedNodeRect(null);
        updateSelectedNodeHalo(empty);
        setSelectedEdgeId(id);
        updateSelectedEdgeHalo(new Set([id]));
      } else if (keepType === 'subgraph') {
        selectedNodeIdsRef.current = empty;
        selectedEdgeIdsRef.current = empty;
        setSelectedNodeIds(empty);
        setSelectedEdgeIds(empty);
        setSelectedNodeRect(null);
        setSelectedEdgePos(null);
        setActiveNodePopover(null);
        setActiveEdgePopover(null);
        setActiveMultiPopover(null);
        setActiveSubgraphPopover(null);
        updateSelectedNodeHalo(empty);
        updateSelectedEdgeHalo(empty);
        setSelectedSubgraphId(id);
      }
    },
    [updateSelectedNodeHalo, updateSelectedEdgeHalo, setSelectedEdgeId]
  );

  return {
    selectedNodeIds,
    setSelectedNodeIds,
    selectedEdgeIds,
    setSelectedEdgeIds,
    selectedSubgraphId,
    setSelectedSubgraphId,
    selectedNodeRect,
    setSelectedNodeRect,
    selectedEdgePos,
    setSelectedEdgePos,
    selectedSubgraphRect,
    setSelectedSubgraphRect,
    selectedNodeIdsRef,
    selectedEdgeIdsRef,
    activeNodePopover,
    setActiveNodePopover,
    activeEdgePopover,
    setActiveEdgePopover,
    activeMultiPopover,
    setActiveMultiPopover,
    activeSubgraphPopover,
    setActiveSubgraphPopover,
    unmatchedSubgraphIds,
    setUnmatchedSubgraphIds,
    isMultiSelect,
    selectedNodeId,
    selectedEdgeId,
    setSelectedNodeId,
    setSelectedEdgeId,
    clearSelection,
    isolateSelection,
    updateSelectedNodeHalo,
    updateSelectedEdgeHalo,
    updateSelectedNodeRect,
    isLR,
    sproutX,
    sproutY,
    multiSelectBounds,
    popoverPos,
    subgraphPopoverPos,
  };
}
