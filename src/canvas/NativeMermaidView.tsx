/**
 * Native Mermaid View with Interactive Overlay Layer
 * Renders Obsidian's native Mermaid SVG with full interactive editing, node/edge selection,
 * inline text editing, and drag-to-connect gestures.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { App, MarkdownRenderer, Component } from 'obsidian';
import {
  ArrowType,
  MermaidEdgeDef,
  MermaidFlowchartAST,
  MermaidNodeDef,
  MermaidShapeType,
} from '../ast/types';
import { FloatingNodeToolbar } from './toolbar/FloatingNodeToolbar';
import { FloatingEdgeToolbar } from './toolbar/FloatingEdgeToolbar';
import { serializeMermaidFlowchart } from '../ast/serializer';

export interface NativeMermaidViewProps {
  app?: App;
  code: string;
  ast: MermaidFlowchartAST;
  onCodeChange: (newCode: string) => void;
  onASTChange: (newAst: MermaidFlowchartAST) => void;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onSelectEdge: (edgeId: string | null) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onShapeChange: (nodeId: string, shape: MermaidShapeType) => void;
  onColorChange: (nodeId: string, color: string) => void;
  onLabelChange: (nodeId: string, label: string) => void;
  onEdgeArrowTypeChange: (edgeId: string, arrowType: ArrowType) => void;
  onEdgeLabelChange: (edgeId: string, label: string) => void;
  onReverseEdge: (edgeId: string) => void;
  onConnectNodes: (sourceId: string, targetId: string) => void;
  onCreateConnectedNode: (sourceId: string, flowPos: { x: number; y: number }) => void;
}

export const NativeMermaidView: React.FC<NativeMermaidViewProps> = ({
  app,
  code,
  ast,
  selectedNodeId,
  selectedEdgeId,
  onSelectNode,
  onSelectEdge,
  onDeleteNode,
  onDeleteEdge,
  onShapeChange,
  onColorChange,
  onLabelChange,
  onEdgeArrowTypeChange,
  onEdgeLabelChange,
  onReverseEdge,
  onConnectNodes,
  onCreateConnectedNode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgMountRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Pan & Zoom state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Inline editing state
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editLabelValue, setEditLabelValue] = useState<string>('');
  const [editingPos, setEditingPos] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Drag-to-connect state
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [dragLine, setDragLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // Selected element overlay positions (for toolbars)
  const [selectedNodePos, setSelectedNodePos] = useState<{ x: number; y: number; width: number } | null>(null);
  const [selectedEdgePos, setSelectedEdgePos] = useState<{ x: number; y: number } | null>(null);

  // Hovered node state (for connection handles)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredNodeRect, setHoveredNodeRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // 1. Render Native Obsidian Mermaid SVG
  useEffect(() => {
    let isCancelled = false;
    const mountEl = svgMountRef.current;
    if (!mountEl) return;

    mountEl.empty();
    const renderComponent = new Component();
    renderComponent.load();

    const markdown = `\`\`\`mermaid\n${code}\n\`\`\``;

    if (app) {
      MarkdownRenderer.render(app, markdown, mountEl, '', renderComponent).then(() => {
        if (isCancelled) return;
        setupSvgInteractivity();
      });
    } else {
      // Fallback if app context not provided
      const mermaidGlobal = (typeof window !== 'undefined' && (window as any).mermaid) as any;
      if (mermaidGlobal && typeof mermaidGlobal.render === 'function') {
        const id = `native_svg_${Date.now()}`;
        mermaidGlobal.render(id, code).then((res: any) => {
          if (isCancelled) return;
          mountEl.innerHTML = typeof res === 'string' ? res : res.svg;
          setupSvgInteractivity();
        });
      }
    }

    return () => {
      isCancelled = true;
      renderComponent.unload();
    };
  }, [code, app]);

  // 2. Setup DOM event listeners directly on the native SVG elements
  const setupSvgInteractivity = useCallback(() => {
    const mountEl = svgMountRef.current;
    if (!mountEl) return;

    const svg = mountEl.querySelector('svg');
    if (!svg) return;

    // A. Setup Nodes
    const nodeElements = mountEl.querySelectorAll('.node, [class*="node "]');
    nodeElements.forEach((el) => {
      const htmlEl = el as SVGGraphicsElement;
      htmlEl.style.cursor = 'pointer';

      const idAttr = htmlEl.getAttribute('id') || '';
      let matchedNodeId: string | null = null;

      for (const nid of ast.nodes.keys()) {
        if (
          idAttr.includes(`flowchart-${nid}-`) ||
          idAttr === `flowchart-${nid}` ||
          idAttr.endsWith(`-${nid}`) ||
          idAttr === nid
        ) {
          matchedNodeId = nid;
          break;
        }
      }

      if (!matchedNodeId) {
        const labelText = htmlEl.querySelector('.label, text')?.textContent?.trim();
        for (const [nid, ndef] of ast.nodes.entries()) {
          if (ndef.label === labelText || nid === labelText) {
            matchedNodeId = nid;
            break;
          }
        }
      }

      if (!matchedNodeId) return;
      const targetNodeId = matchedNodeId;
      htmlEl.setAttribute('data-mermaid-node-id', targetNodeId);

      // Node Click -> Selection
      htmlEl.onclick = (e) => {
        e.stopPropagation();
        onSelectNode(targetNodeId);
        onSelectEdge(null);
      };

      // Node Double Click -> Inline Editing
      htmlEl.ondblclick = (e) => {
        e.stopPropagation();
        const bbox = htmlEl.getBBox();
        const ctm = htmlEl.getCTM();
        if (ctm) {
          const pt = svg.createSVGPoint();
          pt.x = bbox.x;
          pt.y = bbox.y;
          const screenPt = pt.matrixTransform(ctm);
          const svgRect = svg.getBoundingClientRect();

          setEditingPos({
            x: screenPt.x - svgRect.left,
            y: screenPt.y - svgRect.top,
            width: Math.max(90, bbox.width),
            height: Math.max(32, bbox.height),
          });
        }
        const ndef = ast.nodes.get(targetNodeId);
        setEditLabelValue(ndef?.label || targetNodeId);
        setEditingNodeId(targetNodeId);
      };

      // Node Hover -> Show Connection Dots
      htmlEl.onmouseenter = () => {
        setHoveredNodeId(targetNodeId);
        try {
          const bbox = htmlEl.getBBox();
          const ctm = htmlEl.getCTM();
          if (ctm) {
            const pt = svg.createSVGPoint();
            pt.x = bbox.x;
            pt.y = bbox.y;
            const screenPt = pt.matrixTransform(ctm);
            const svgRect = svg.getBoundingClientRect();

            setHoveredNodeRect({
              x: screenPt.x - svgRect.left,
              y: screenPt.y - svgRect.top,
              width: bbox.width,
              height: bbox.height,
            });
          }
        } catch (err) {}
      };
    });

    // B. Setup Edges
    const edgeElements = mountEl.querySelectorAll('.flowchart-link, [class*="flowchart-link"], .edgePath');
    edgeElements.forEach((el) => {
      const htmlEl = el as SVGGraphicsElement;
      htmlEl.style.cursor = 'pointer';

      const idAttr = htmlEl.getAttribute('id') || htmlEl.parentElement?.getAttribute('id') || '';
      const classAttr = htmlEl.getAttribute('class') || htmlEl.parentElement?.getAttribute('class') || '';

      let matchedEdgeId: string | null = null;
      for (const edge of ast.edges) {
        if (
          idAttr.includes(`L-${edge.from}-${edge.to}`) ||
          classAttr.includes(`L-${edge.from}-${edge.to}`) ||
          idAttr.includes(`${edge.from}-${edge.to}`) ||
          classAttr.includes(`${edge.from}-${edge.to}`)
        ) {
          matchedEdgeId = edge.id;
          break;
        }
      }

      if (!matchedEdgeId) return;
      const targetEdgeId = matchedEdgeId;

      htmlEl.onclick = (e) => {
        e.stopPropagation();
        onSelectEdge(targetEdgeId);
        onSelectNode(null);

        try {
          const bbox = htmlEl.getBBox();
          const ctm = htmlEl.getCTM();
          if (ctm) {
            const pt = svg.createSVGPoint();
            pt.x = bbox.x + bbox.width / 2;
            pt.y = bbox.y + bbox.height / 2;
            const screenPt = pt.matrixTransform(ctm);
            const svgRect = svg.getBoundingClientRect();
            setSelectedEdgePos({
              x: screenPt.x - svgRect.left,
              y: screenPt.y - svgRect.top,
            });
          }
        } catch (err) {}
      };
    });
  }, [ast, onSelectNode, onSelectEdge]);

  // Update selected node toolbar position
  useEffect(() => {
    if (!selectedNodeId) {
      setSelectedNodePos(null);
      return;
    }

    const mountEl = svgMountRef.current;
    if (!mountEl) return;
    const svg = mountEl.querySelector('svg');
    if (!svg) return;

    const nodeEl = mountEl.querySelector(`[data-mermaid-node-id="${selectedNodeId}"]`) as SVGGraphicsElement | null;
    if (!nodeEl) return;

    try {
      const bbox = nodeEl.getBBox();
      const ctm = nodeEl.getCTM();
      if (ctm) {
        const pt = svg.createSVGPoint();
        pt.x = bbox.x + bbox.width / 2;
        pt.y = bbox.y;
        const screenPt = pt.matrixTransform(ctm);
        const svgRect = svg.getBoundingClientRect();

        setSelectedNodePos({
          x: screenPt.x - svgRect.left,
          y: screenPt.y - svgRect.top,
          width: bbox.width,
        });
      }
    } catch (err) {}
  }, [selectedNodeId, code, zoom, pan]);

  // Mouse pan & zoom handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.min(2.5, Math.max(0.35, z + delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.nodrag') || (e.target as HTMLElement).closest('.mermaid-handle')) {
      return;
    }
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
    }

    if (connectingSourceId && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDragLine((prev) =>
        prev
          ? {
              ...prev,
              x2: (e.clientX - rect.left - pan.x) / zoom,
              y2: (e.clientY - rect.top - pan.y) / zoom,
            }
          : null
      );
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    setIsPanning(false);

    if (connectingSourceId) {
      const targetEl = (e.target as HTMLElement).closest('[data-mermaid-node-id]') as HTMLElement | null;
      const targetNodeId = targetEl?.getAttribute('data-mermaid-node-id');

      if (targetNodeId && targetNodeId !== connectingSourceId) {
        onConnectNodes(connectingSourceId, targetNodeId);
      } else if (!targetEl && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const flowX = (e.clientX - rect.left - pan.x) / zoom;
        const flowY = (e.clientY - rect.top - pan.y) / zoom;
        onCreateConnectedNode(connectingSourceId, { x: flowX, y: flowY });
      }

      setConnectingSourceId(null);
      setDragLine(null);
    }
  };

  const handleStartConnect = (e: React.MouseEvent, startX: number, startY: number) => {
    e.stopPropagation();
    e.preventDefault();
    if (!hoveredNodeId) return;

    setConnectingSourceId(hoveredNodeId);
    setDragLine({
      x1: startX,
      y1: startY,
      x2: startX,
      y2: startY,
    });
  };

  const handleFinishEdit = () => {
    if (editingNodeId) {
      onLabelChange(editingNodeId, editLabelValue.trim());
      setEditingNodeId(null);
      setEditingPos(null);
    }
  };

  const selectedNode = selectedNodeId ? ast.nodes.get(selectedNodeId) : null;
  const selectedEdge = selectedEdgeId ? ast.edges.find((e) => e.id === selectedEdgeId) : null;

  return (
    <div
      className="mermaid-native-view-container"
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={() => {
        onSelectNode(null);
        onSelectEdge(null);
        setEditingNodeId(null);
      }}
    >
      {/* Zoom / Pan World Layer */}
      <div
        className="mermaid-native-world"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Rendered Native Mermaid SVG Output */}
        <div className="mermaid-native-svg-mount" ref={svgMountRef} />

        {/* Interactive Overlay Layer */}
        <div className="mermaid-native-overlay" ref={overlayRef}>
          {/* Connection Drag Line */}
          {dragLine && (
            <svg
              className="mermaid-drag-svg"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                overflow: 'visible',
                zIndex: 999,
              }}
            >
              <line
                x1={dragLine.x1}
                y1={dragLine.y1}
                x2={dragLine.x2}
                y2={dragLine.y2}
                stroke="var(--mermaid-accent, #7c3aed)"
                strokeWidth={2}
                strokeDasharray="4 4"
              />
            </svg>
          )}

          {/* Hovered Node Obsidian Canvas Connection Dots */}
          {hoveredNodeRect && hoveredNodeId && (
            <div
              className="mermaid-node-hover-handles"
              style={{
                position: 'absolute',
                left: hoveredNodeRect.x,
                top: hoveredNodeRect.y,
                width: hoveredNodeRect.width,
                height: hoveredNodeRect.height,
                pointerEvents: 'none',
              }}
            >
              {/* Top Handle */}
              <div
                className="mermaid-handle is-hovered"
                style={{ position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'all' }}
                onMouseDown={(e) => handleStartConnect(e, hoveredNodeRect.x + hoveredNodeRect.width / 2, hoveredNodeRect.y)}
              />
              {/* Bottom Handle */}
              <div
                className="mermaid-handle is-hovered"
                style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translate(-50%, 50%)', pointerEvents: 'all' }}
                onMouseDown={(e) => handleStartConnect(e, hoveredNodeRect.x + hoveredNodeRect.width / 2, hoveredNodeRect.y + hoveredNodeRect.height)}
              />
              {/* Left Handle */}
              <div
                className="mermaid-handle is-hovered"
                style={{ position: 'absolute', top: '50%', left: 0, transform: 'translate(-50%, -50%)', pointerEvents: 'all' }}
                onMouseDown={(e) => handleStartConnect(e, hoveredNodeRect.x, hoveredNodeRect.y + hoveredNodeRect.height / 2)}
              />
              {/* Right Handle */}
              <div
                className="mermaid-handle is-hovered"
                style={{ position: 'absolute', top: '50%', right: 0, transform: 'translate(50%, -50%)', pointerEvents: 'all' }}
                onMouseDown={(e) => handleStartConnect(e, hoveredNodeRect.x + hoveredNodeRect.width, hoveredNodeRect.y + hoveredNodeRect.height / 2)}
              />
            </div>
          )}

          {/* Selected Node Floating Toolbar */}
          {selectedNode && selectedNodePos && (
            <div
              className="nodrag nopan"
              style={{
                position: 'absolute',
                left: selectedNodePos.x,
                top: selectedNodePos.y - 12,
                transform: 'translate(-50%, -100%)',
                zIndex: 1000,
                pointerEvents: 'all',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <FloatingNodeToolbar
                currentShape={selectedNode.shape}
                currentColor={selectedNode.style?.fill || ''}
                onShapeChange={(shape) => onShapeChange(selectedNode.id, shape)}
                onColorChange={(color) => onColorChange(selectedNode.id, color)}
                onDelete={() => onDeleteNode(selectedNode.id)}
              />
            </div>
          )}

          {/* Selected Edge Floating Toolbar */}
          {selectedEdge && selectedEdgePos && (
            <div
              className="nodrag nopan"
              style={{
                position: 'absolute',
                left: selectedEdgePos.x,
                top: selectedEdgePos.y - 12,
                transform: 'translate(-50%, -100%)',
                zIndex: 1000,
                pointerEvents: 'all',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <FloatingEdgeToolbar
                currentArrowType={selectedEdge.arrowType}
                currentLabel={selectedEdge.label || ''}
                onArrowTypeChange={(newType) => onEdgeArrowTypeChange(selectedEdge.id, newType)}
                onLabelChange={(newLabel) => onEdgeLabelChange(selectedEdge.id, newLabel)}
                onReverse={() => onReverseEdge(selectedEdge.id)}
                onDelete={() => onDeleteEdge(selectedEdge.id)}
              />
            </div>
          )}

          {/* Inline Label Editing Input */}
          {editingNodeId && editingPos && (
            <input
              autoFocus
              className="mermaid-inline-input nodrag nopan"
              style={{
                position: 'absolute',
                left: editingPos.x,
                top: editingPos.y,
                width: editingPos.width,
                height: editingPos.height,
                zIndex: 1001,
                pointerEvents: 'all',
              }}
              value={editLabelValue}
              onChange={(e) => setEditLabelValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFinishEdit();
                if (e.key === 'Escape') {
                  setEditingNodeId(null);
                  setEditingPos(null);
                }
              }}
              onBlur={handleFinishEdit}
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      </div>

      {/* Floating Canvas Controls */}
      <div className="mermaid-view-controls nodrag">
        <button
          className="mermaid-control-btn"
          title="Zoom In"
          onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
        >
          +
        </button>
        <button
          className="mermaid-control-btn"
          title="Zoom Out"
          onClick={() => setZoom((z) => Math.max(0.35, z - 0.15))}
        >
          −
        </button>
        <button
          className="mermaid-control-btn"
          title="Reset View"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          ⟲
        </button>
      </div>
    </div>
  );
};
