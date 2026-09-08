/**
 * Hook for Canvas mouse interactions: panning, connection dragging, node hover proximity, and marquee triggering.
 */

import React, { useState } from 'react';
import { CursorMode, Rect } from '../types';
import { DiagramDriver } from '../../diagrams/types';
import { MermaidNodeDef, MermaidEdgeDef } from '../../ast/types';

export interface UseCanvasMouseInteractionsOptions {
  worldRef: React.RefObject<HTMLDivElement>;
  zoom: number;
  cursorMode: CursorMode;
  isSpacePressed: boolean;
  isPanning: boolean;
  startPan: (clientX: number, clientY: number) => void;
  updatePan: (clientX: number, clientY: number) => void;
  endPan: () => void;
  marquee: {
    startMarquee: (clientX: number, clientY: number) => void;
    updateMarquee: (
      clientX: number,
      clientY: number,
      displayNodes: Map<string, MermaidNodeDef>,
      displayEdges: MermaidEdgeDef[]
    ) => boolean;
    endMarquee: (
      displayNodes: Map<string, MermaidNodeDef>,
      displayEdges: MermaidEdgeDef[]
    ) => void;
    dragBoxStartRef: React.MutableRefObject<{ x: number; y: number } | null>;
  };
  displayNodes: Map<string, MermaidNodeDef>;
  displayEdges: MermaidEdgeDef[];
  driver: DiagramDriver;
  applyMutation: (mutator: (currentAst: any) => void, keepNodeId?: string) => void;
  setSelectedNodeId: (id: string | null) => void;
}

export function useCanvasMouseInteractions({
  worldRef,
  zoom,
  cursorMode,
  isSpacePressed,
  isPanning,
  startPan,
  updatePan,
  endPan,
  marquee,
  displayNodes,
  displayEdges,
  driver,
  applyMutation,
  setSelectedNodeId,
}: UseCanvasMouseInteractionsOptions) {
  const m = driver.mutations;
  const anchors = m.anchors;

  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [connectingSourceKind, setConnectingSourceKind] = useState<'start' | 'end' | null>(null);
  const [dragLine, setDragLine] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredNodeRect, setHoveredNodeRect] = useState<Rect | null>(null);
  const [hoveredNodeKind, setHoveredNodeKind] = useState<'start' | 'end' | null>(null);

  const isAnchorId = (id: string | null | undefined): boolean =>
    !!anchors && !!id && anchors.isAnchor(id);

  const handleStartConnect = (
    e: React.MouseEvent,
    startX: number,
    startY: number
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (!hoveredNodeId) return;
    // End anchors have no outgoing transitions.
    if (isAnchorId(hoveredNodeId) && hoveredNodeKind === 'end') return;

    setConnectingSourceId(hoveredNodeId);
    setConnectingSourceKind(hoveredNodeKind);
    setDragLine({
      x1: startX,
      y1: startY,
      x2: startX,
      y2: startY,
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest('.nodrag') ||
      (e.target as HTMLElement).closest('.mermaid-action-hud') ||
      (e.target as HTMLElement).closest('.mermaid-multiselect-hud') ||
      (e.target as HTMLElement).closest('.mermaid-connection-handle')
    ) {
      return;
    }

    const isMiddleClick = e.button === 1;
    const isHandModeActive = cursorMode === 'hand' || isSpacePressed || isMiddleClick;

    if (isHandModeActive) {
      startPan(e.clientX, e.clientY);
      return;
    }

    if (e.button === 0) {
      marquee.startMarquee(e.clientX, e.clientY);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      updatePan(e.clientX, e.clientY);
      return;
    }

    if (connectingSourceId && worldRef.current) {
      const worldRect = worldRef.current.getBoundingClientRect();
      const currentWorldX = (e.clientX - worldRect.left) / zoom;
      const currentWorldY = (e.clientY - worldRect.top) / zoom;
      setDragLine((prev) =>
        prev
          ? {
              ...prev,
              x2: currentWorldX,
              y2: currentWorldY,
            }
          : null
      );
      return;
    }

    const isMarquee = marquee.updateMarquee(
      e.clientX,
      e.clientY,
      displayNodes,
      displayEdges
    );

    if (!isMarquee && hoveredNodeId && hoveredNodeRect && worldRef.current && !connectingSourceId) {
      const worldRect = worldRef.current.getBoundingClientRect();
      const mouseX = (e.clientX - worldRect.left) / zoom;
      const mouseY = (e.clientY - worldRect.top) / zoom;
      const pad = 24;
      const withinX =
        mouseX >= hoveredNodeRect.x - pad &&
        mouseX <= hoveredNodeRect.x + hoveredNodeRect.width + pad + 24;
      const withinY =
        mouseY >= hoveredNodeRect.y - pad &&
        mouseY <= hoveredNodeRect.y + hoveredNodeRect.height + pad + 24;

      if (!withinX || !withinY) {
        setHoveredNodeId(null);
        setHoveredNodeRect(null);
        setHoveredNodeKind(null);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    endPan();

    if (marquee.dragBoxStartRef.current) {
      marquee.endMarquee(displayNodes, displayEdges);
    }

    if (connectingSourceId) {
      const targetNodeEl = (e.target as HTMLElement).closest(
        '[data-mermaid-node-id]'
      ) as HTMLElement | null;
      const targetNodeId = targetNodeEl?.getAttribute('data-mermaid-node-id');
      const targetKind = targetNodeEl?.getAttribute('data-mermaid-start-end') as
        | 'start'
        | 'end'
        | null;

      const targetEdgeEl = (e.target as HTMLElement).closest(
        '[data-mermaid-edge-id]'
      ) as HTMLElement | null;
      const targetEdgeId = targetEdgeEl?.getAttribute('data-mermaid-edge-id');

      // Directional guard for start/end anchors.
      const srcIsStart = isAnchorId(connectingSourceId) && connectingSourceKind === 'start';
      const srcIsEnd = isAnchorId(connectingSourceId) && connectingSourceKind === 'end';
      const tgtIsStart = isAnchorId(targetNodeId) && targetKind === 'start';
      const tgtIsEnd = isAnchorId(targetNodeId) && targetKind === 'end';

      const isBlockedAnchorEdge =
        (isAnchorId(targetNodeId) && isAnchorId(connectingSourceId)) ||
        srcIsEnd ||
        tgtIsStart ||
        (isAnchorId(targetNodeId) && !tgtIsEnd) ||
        (isAnchorId(connectingSourceId) && !srcIsStart);

      if (targetNodeId && targetNodeId !== connectingSourceId && !isBlockedAnchorEdge) {
        applyMutation((a) => {
          m.connect(a, connectingSourceId, targetNodeId);
        }, connectingSourceId);
      } else if (targetEdgeId) {
        let createdNodeId: string | null = null;
        applyMutation((a) => {
          createdNodeId = m.insertNodeOnEdge(a, targetEdgeId, `New ${driver.labels.node}`);
        });
        if (createdNodeId) setSelectedNodeId(createdNodeId);
      }

      setConnectingSourceId(null);
      setConnectingSourceKind(null);
      setDragLine(null);
    }
  };

  return {
    connectingSourceId,
    setConnectingSourceId,
    connectingSourceKind,
    setConnectingSourceKind,
    dragLine,
    setDragLine,
    hoveredNodeId,
    setHoveredNodeId,
    hoveredNodeRect,
    setHoveredNodeRect,
    hoveredNodeKind,
    setHoveredNodeKind,
    handleStartConnect,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}
