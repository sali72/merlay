/**
 * Hook for Canvas mouse interactions: panning, connection dragging, node hover proximity, and marquee triggering.
 */

import React, { useState } from 'react';
import { CursorMode, Rect } from '../types';
import { connectNodes, insertNodeOnEdge } from '../../ast/mutations';
import * as stateMutations from '../../diagrams/state/mutations';
import { MermaidFlowchartAST, MermaidNodeDef, MermaidEdgeDef } from '../../ast/types';
import { MermaidStateAST } from '../../diagrams/state/types';

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
  isStateDiagram: boolean;
  applyAstMutation: (mutator: (currentAst: MermaidFlowchartAST) => void, keepNodeId?: string) => void;
  applyStateAstMutation: (mutator: (currentAst: MermaidStateAST) => void, keepNodeId?: string) => void;
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
  isStateDiagram,
  applyAstMutation,
  applyStateAstMutation,
  setSelectedNodeId,
}: UseCanvasMouseInteractionsOptions) {
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

  const handleStartConnect = (
    e: React.MouseEvent,
    startX: number,
    startY: number
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (!hoveredNodeId) return;
    // End anchors have no outgoing transitions.
    if (hoveredNodeId === '[*]' && hoveredNodeKind === 'end') return;

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
      const srcIsStart = connectingSourceId === '[*]' && connectingSourceKind === 'start';
      const srcIsEnd = connectingSourceId === '[*]' && connectingSourceKind === 'end';
      const tgtIsStart = targetNodeId === '[*]' && targetKind === 'start';
      const tgtIsEnd = targetNodeId === '[*]' && targetKind === 'end';

      const isBlockedAnchorEdge =
        (targetNodeId === '[*]' && connectingSourceId === '[*]') ||
        srcIsEnd ||
        tgtIsStart ||
        (isStateDiagram && targetNodeId === '[*]' && !tgtIsEnd) ||
        (isStateDiagram && connectingSourceId === '[*]' && !srcIsStart);

      if (targetNodeId && targetNodeId !== connectingSourceId && !isBlockedAnchorEdge) {
        if (isStateDiagram) {
          applyStateAstMutation((a) => {
            stateMutations.connectStates(a, connectingSourceId, targetNodeId);
          }, connectingSourceId);
        } else {
          applyAstMutation((a) => {
            connectNodes(a, connectingSourceId, targetNodeId);
          }, connectingSourceId);
        }
      } else if (targetEdgeId) {
        let createdNodeId: string | null = null;
        if (isStateDiagram) {
          applyStateAstMutation((a) => {
            const tr = a.transitions.find((t) => t.id === targetEdgeId);
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
            const res = insertNodeOnEdge(a, targetEdgeId, 'New Step');
            if (res) createdNodeId = res.nodeId;
          });
        }
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
