/**
 * Native Mermaid View with Direct Structural Manipulation Overlay
 * Renders Obsidian's exact native Mermaid SVG (100% parity, zero layout simulation)
 * with direct-manipulation node sprouting, drag-to-connect, inline label editing, and camera stabilization.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { App, MarkdownRenderer, Component } from 'obsidian';
import {
  MermaidFlowchartAST,
  FlowchartDirection,
} from '../ast/types';
import { parseMermaidFlowchart } from '../ast/parser';
import { serializeMermaidFlowchart } from '../ast/serializer';
import {
  addChildNode,
  addNode,
  connectNodes,
  deleteEdge,
  deleteNode,
  setDiagramDirection,
  updateEdgeLabel,
  updateNodeLabel,
} from '../ast/mutations';
import {
  CloseIcon,
  CodeIcon,
  FitViewIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from './icons/Icons';

export interface NativeMermaidViewProps {
  app: App;
  initialCode: string;
  onCodeChange: (newCode: string) => void;
  onClose?: () => void;
}

export const NativeMermaidView: React.FC<NativeMermaidViewProps> = ({
  app,
  initialCode,
  onCodeChange,
  onClose,
}) => {
  const [code, setCode] = useState<string>(
    initialCode || 'flowchart LR\n    A["Start"] --> B["Process"]\n    B --> C["End"]'
  );
  const [ast, setAst] = useState<MermaidFlowchartAST>(() =>
    parseMermaidFlowchart(code)
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Zoom & Pan state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Node editing state
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editNodeLabel, setEditNodeLabel] = useState<string>('');
  const [editingPos, setEditingPos] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Drag-to-connect state
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [dragLine, setDragLine] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  // Selected element overlay coordinates (relative to worldRef)
  const [selectedNodeRect, setSelectedNodeRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [selectedEdgePos, setSelectedEdgePos] = useState<{
    x: number;
    y: number;
    label?: string;
  } | null>(null);

  // Hovered node state for connection handle
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredNodeRect, setHoveredNodeRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Drawer & feedback state
  const [showCodeDrawer, setShowCodeDrawer] = useState<boolean>(false);
  const [syntaxError, setSyntaxError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const svgMountRef = useRef<HTMLDivElement>(null);
  const pendingCameraPinRef = useRef<{
    nodeId: string;
    screenX: number;
    screenY: number;
  } | null>(null);

  // Exact 1:1 screen-to-world coordinate calculation
  const getLocalRect = useCallback(
    (el: Element): { x: number; y: number; width: number; height: number } | null => {
      if (!worldRef.current) return null;
      const worldRect = worldRef.current.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      return {
        x: (elRect.left - worldRect.left) / zoom,
        y: (elRect.top - worldRect.top) / zoom,
        width: elRect.width / zoom,
        height: elRect.height / zoom,
      };
    },
    [zoom]
  );

  // Mutate AST and serialize to code
  const applyAstMutation = useCallback(
    (mutator: (currentAst: MermaidFlowchartAST) => void, keepNodeId?: string) => {
      try {
        // Record screen position of active node to stabilize camera across re-render
        if (keepNodeId && svgMountRef.current) {
          const activeEl = svgMountRef.current.querySelector(
            `[data-mermaid-node-id="${keepNodeId}"]`
          );
          if (activeEl) {
            const b = activeEl.getBoundingClientRect();
            pendingCameraPinRef.current = {
              nodeId: keepNodeId,
              screenX: b.left + b.width / 2,
              screenY: b.top + b.height / 2,
            };
          }
        }

        const newAst = { ...ast };
        mutator(newAst);
        const serialized = serializeMermaidFlowchart(newAst);
        setCode(serialized);
        setAst(newAst);
        setSyntaxError(null);
        onCodeChange(serialized);
      } catch (err: any) {
        console.error('AST Mutation Error:', err);
      }
    },
    [ast, onCodeChange]
  );

  // Update selected node overlay box
  const updateSelectedNodeRect = useCallback(() => {
    if (!selectedNodeId || !svgMountRef.current) {
      setSelectedNodeRect(null);
      return;
    }

    const nodeEl = svgMountRef.current.querySelector(
      `[data-mermaid-node-id="${selectedNodeId}"]`
    );
    if (nodeEl) {
      const rect = getLocalRect(nodeEl);
      if (rect) setSelectedNodeRect(rect);
    }
  }, [selectedNodeId, getLocalRect]);

  // 1. Render Obsidian's native Mermaid SVG
  useEffect(() => {
    let isCancelled = false;
    const mountEl = svgMountRef.current;
    if (!mountEl) return;

    mountEl.empty();
    const renderComponent = new Component();
    renderComponent.load();

    const markdown = `\`\`\`mermaid\n${code}\n\`\`\``;

    MarkdownRenderer.render(app, markdown, mountEl, '', renderComponent)
      .then(() => {
        if (isCancelled) return;
        setupSvgInteractivity();
        stabilizeCamera();
        updateSelectedNodeRect();
      })
      .catch((err) => {
        console.error('Error rendering native Mermaid SVG:', err);
      });

    return () => {
      isCancelled = true;
      renderComponent.unload();
    };
  }, [code, app]);

  // Camera stabilization: keep active node anchored at same screen position
  const stabilizeCamera = useCallback(() => {
    const pin = pendingCameraPinRef.current;
    if (!pin || !svgMountRef.current) return;
    pendingCameraPinRef.current = null;

    const el = svgMountRef.current.querySelector(
      `[data-mermaid-node-id="${pin.nodeId}"]`
    );
    if (!el) return;

    const b = el.getBoundingClientRect();
    const currentScreenX = b.left + b.width / 2;
    const currentScreenY = b.top + b.height / 2;

    const deltaX = pin.screenX - currentScreenX;
    const deltaY = pin.screenY - currentScreenY;

    if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
      setPan((p) => ({ x: p.x + deltaX, y: p.y + deltaY }));
    }
  }, []);

  // Update selected node rect whenever selection, zoom, or pan changes
  useEffect(() => {
    updateSelectedNodeRect();
  }, [selectedNodeId, zoom, pan, updateSelectedNodeRect]);

  // 2. Attach interactive listeners to SVG elements
  const setupSvgInteractivity = useCallback(() => {
    const mountEl = svgMountRef.current;
    if (!mountEl) return;

    // A. Setup Node Listeners
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
        setSelectedNodeId(targetNodeId);
        setSelectedEdgeId(null);
        const rect = getLocalRect(htmlEl);
        if (rect) setSelectedNodeRect(rect);
      };

      // Node Double Click -> Inline Editing
      htmlEl.ondblclick = (e) => {
        e.stopPropagation();
        startEditingNode(targetNodeId, htmlEl);
      };

      // Node Hover -> Connection Handle
      htmlEl.onmouseenter = () => {
        setHoveredNodeId(targetNodeId);
        const rect = getLocalRect(htmlEl);
        if (rect) setHoveredNodeRect(rect);
      };

      htmlEl.onmouseleave = () => {
        setHoveredNodeId(null);
        setHoveredNodeRect(null);
      };
    });

    // B. Setup Edge Listeners
    const edgeElements = mountEl.querySelectorAll(
      '.flowchart-link, [class*="flowchart-link"], .edgePath path'
    );
    edgeElements.forEach((el) => {
      const htmlEl = el as SVGGraphicsElement;
      htmlEl.style.cursor = 'pointer';

      const classAttr =
        (htmlEl.getAttribute('class') || '') +
        ' ' +
        (htmlEl.parentElement?.getAttribute('class') || '');
      const idAttr =
        (htmlEl.getAttribute('id') || '') +
        ' ' +
        (htmlEl.parentElement?.getAttribute('id') || '');

      let matchedEdgeId: string | null = null;
      for (const edge of ast.edges) {
        const hasSource =
          classAttr.includes(`LS-${edge.from}`) || idAttr.includes(`LS-${edge.from}`);
        const hasTarget =
          classAttr.includes(`LE-${edge.to}`) || idAttr.includes(`LE-${edge.to}`);
        if (hasSource && hasTarget) {
          matchedEdgeId = edge.id;
          break;
        }
        if (
          idAttr.includes(`L-${edge.from}-${edge.to}`) ||
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
        setSelectedEdgeId(targetEdgeId);
        setSelectedNodeId(null);

        const rect = getLocalRect(htmlEl);
        const edgeDef = ast.edges.find((ed) => ed.id === targetEdgeId);
        if (rect) {
          setSelectedEdgePos({
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
            label: edgeDef?.label,
          });
        }
      };
    });
  }, [ast, getLocalRect]);

  const startEditingNode = (nodeId: string, nodeEl: Element) => {
    const rect = getLocalRect(nodeEl);
    if (rect) {
      setEditingPos({
        x: rect.x,
        y: rect.y,
        width: Math.max(90, rect.width),
        height: Math.max(34, rect.height),
      });
    }
    const ndef = ast.nodes.get(nodeId);
    setEditNodeLabel(ndef?.label || nodeId);
    setEditingNodeId(nodeId);
  };

  const handleFinishEditingNode = () => {
    if (editingNodeId) {
      applyAstMutation((a) => {
        updateNodeLabel(a, editingNodeId, editNodeLabel);
      }, editingNodeId);
      setEditingNodeId(null);
      setEditingPos(null);
    }
  };

  // Node Actions
  const handleSproutNextStep = (parentId: string) => {
    let createdChildId: string | null = null;
    applyAstMutation((a) => {
      const res = addChildNode(a, parentId, 'Next Step');
      createdChildId = res.nodeId;
    }, parentId);

    if (createdChildId) {
      setSelectedNodeId(createdChildId);
      setSelectedEdgeId(null);
    }
  };

  const handleDeleteSelectedNode = () => {
    if (!selectedNodeId) return;
    const targetId = selectedNodeId;
    setSelectedNodeId(null);
    setSelectedNodeRect(null);
    applyAstMutation((a) => {
      deleteNode(a, targetId);
    });
  };

  const handleAddStandaloneStep = () => {
    let newId: string | null = null;
    applyAstMutation((a) => {
      newId = addNode(a, 'New Step');
    });
    if (newId) {
      setSelectedNodeId(newId);
    }
  };

  const handleToggleDirection = () => {
    const nextDir: FlowchartDirection =
      ast.direction === 'LR' ? 'TD' : 'LR';
    applyAstMutation((a) => {
      setDiagramDirection(a, nextDir);
    }, selectedNodeId || undefined);
  };

  // Edge Actions
  const handleDeleteSelectedEdge = () => {
    if (!selectedEdgeId) return;
    const targetEdgeId = selectedEdgeId;
    setSelectedEdgeId(null);
    setSelectedEdgePos(null);
    applyAstMutation((a) => {
      deleteEdge(a, targetEdgeId);
    });
  };

  const handleUpdateEdgeLabel = (newLabel: string) => {
    if (!selectedEdgeId) return;
    applyAstMutation((a) => {
      updateEdgeLabel(a, selectedEdgeId, newLabel);
    });
  };

  // Drag-to-Connect
  const handleStartConnect = (
    e: React.MouseEvent,
    startX: number,
    startY: number
  ) => {
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

  // Mouse Pan & Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.min(3.0, Math.max(0.25, z + delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest('.nodrag') ||
      (e.target as HTMLElement).closest('.mermaid-action-hud') ||
      (e.target as HTMLElement).closest('.mermaid-connection-handle')
    ) {
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

    if (connectingSourceId && worldRef.current) {
      const worldRect = worldRef.current.getBoundingClientRect();
      setDragLine((prev) =>
        prev
          ? {
              ...prev,
              x2: (e.clientX - worldRect.left) / zoom,
              y2: (e.clientY - worldRect.top) / zoom,
            }
          : null
      );
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    setIsPanning(false);

    if (connectingSourceId) {
      const targetEl = (e.target as HTMLElement).closest(
        '[data-mermaid-node-id]'
      ) as HTMLElement | null;
      const targetNodeId = targetEl?.getAttribute('data-mermaid-node-id');

      if (targetNodeId && targetNodeId !== connectingSourceId) {
        applyAstMutation((a) => {
          connectNodes(a, connectingSourceId, targetNodeId);
        }, connectingSourceId);
      }

      setConnectingSourceId(null);
      setDragLine(null);
    }
  };

  const handleFitView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Downstream Sprout Button Position based on diagram direction
  const isLR = ast.direction === 'LR' || ast.direction === 'RL';
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

  return (
    <div
      className="mermaid-native-editor-root"
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={() => {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setEditingNodeId(null);
      }}
    >
      {/* Top Controls Bar */}
      <div className="mermaid-native-top-bar nodrag">
        <div className="mermaid-top-bar-left">
          <button
            type="button"
            className="mermaid-tool-btn mod-cta"
            onClick={handleAddStandaloneStep}
            title="Add new step"
          >
            <PlusIcon size={14} />
            <span>Add Step</span>
          </button>

          <button
            type="button"
            className="mermaid-tool-btn"
            onClick={handleToggleDirection}
            title={`Toggle Flow Direction (Current: ${ast.direction})`}
          >
            <span>Flow: {ast.direction}</span>
          </button>

          <div className="mermaid-bar-divider" />

          <button
            type="button"
            className="mermaid-tool-btn"
            onClick={handleFitView}
            title="Reset Zoom & Center (Fit View)"
          >
            <FitViewIcon size={14} />
          </button>
        </div>

        <div className="mermaid-top-bar-right">
          <button
            type="button"
            className={`mermaid-tool-btn ${showCodeDrawer ? 'is-active' : ''}`}
            onClick={() => setShowCodeDrawer(!showCodeDrawer)}
            title="Toggle Mermaid Syntax Drawer"
          >
            <CodeIcon size={14} />
            <span>Syntax</span>
          </button>
        </div>
      </div>

      {/* Interactive World Canvas */}
      <div
        className="mermaid-native-world"
        ref={worldRef}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Native Mermaid SVG Output */}
        <div className="mermaid-native-svg-mount" ref={svgMountRef} />

        {/* Interactive Overlay Layer */}
        <div className="mermaid-native-overlay">
          {/* Connection Dragging SVG Line */}
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
                strokeWidth={2.5}
                strokeDasharray="4 4"
              />
            </svg>
          )}

          {/* Hovered Node Connection Handle (Downstream only) */}
          {hoveredNodeRect && hoveredNodeId && (
            <div
              className="mermaid-connection-handle nodrag"
              style={{
                position: 'absolute',
                left: isLR
                  ? hoveredNodeRect.x + hoveredNodeRect.width
                  : hoveredNodeRect.x + hoveredNodeRect.width / 2,
                top: isLR
                  ? hoveredNodeRect.y + hoveredNodeRect.height / 2
                  : hoveredNodeRect.y + hoveredNodeRect.height,
                transform: 'translate(-50%, -50%)',
                zIndex: 100,
              }}
              onMouseDown={(e) =>
                handleStartConnect(
                  e,
                  isLR
                    ? hoveredNodeRect.x + hoveredNodeRect.width
                    : hoveredNodeRect.x + hoveredNodeRect.width / 2,
                  isLR
                    ? hoveredNodeRect.y + hoveredNodeRect.height / 2
                    : hoveredNodeRect.y + hoveredNodeRect.height
                )
              }
              title="Drag to connect with another step"
            />
          )}

          {/* Selected Node Halo & Relational Sprout HUD */}
          {selectedNodeRect && selectedNodeId && (
            <>
              {/* Selection Halo Ring */}
              <div
                className="mermaid-node-selection-ring"
                style={{
                  position: 'absolute',
                  left: selectedNodeRect.x - 3,
                  top: selectedNodeRect.y - 3,
                  width: selectedNodeRect.width + 6,
                  height: selectedNodeRect.height + 6,
                  pointerEvents: 'none',
                  zIndex: 90,
                }}
              />

              {/* Action HUD anchored directly downstream */}
              <div
                className="mermaid-action-hud nodrag"
                style={{
                  position: 'absolute',
                  left: sproutX,
                  top: sproutY,
                  transform: isLR ? 'translate(0, -50%)' : 'translate(-50%, 0)',
                  zIndex: 150,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="mermaid-hud-btn sprout-btn"
                  onClick={() => handleSproutNextStep(selectedNodeId)}
                  title="Sprout Next Step (creates connected child)"
                >
                  <PlusIcon size={13} />
                  <span>Next Step</span>
                </button>

                <button
                  type="button"
                  className="mermaid-hud-btn icon-only"
                  onClick={() => {
                    const el = svgMountRef.current?.querySelector(
                      `[data-mermaid-node-id="${selectedNodeId}"]`
                    );
                    if (el) startEditingNode(selectedNodeId, el);
                  }}
                  title="Rename Step"
                >
                  <PencilIcon size={13} />
                </button>

                <button
                  type="button"
                  className="mermaid-hud-btn delete-btn icon-only"
                  onClick={handleDeleteSelectedNode}
                  title="Delete Step (and connections)"
                >
                  <TrashIcon size={13} />
                </button>
              </div>
            </>
          )}

          {/* Selected Edge HUD */}
          {selectedEdgePos && selectedEdgeId && (
            <div
              className="mermaid-edge-hud nodrag"
              style={{
                position: 'absolute',
                left: selectedEdgePos.x,
                top: selectedEdgePos.y - 10,
                transform: 'translate(-50%, -100%)',
                zIndex: 150,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="text"
                className="mermaid-edge-input"
                placeholder="Condition (e.g. Yes/No)..."
                defaultValue={selectedEdgePos.label || ''}
                onBlur={(e) => handleUpdateEdgeLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleUpdateEdgeLabel((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
              />
              <button
                type="button"
                className="mermaid-hud-btn delete-btn icon-only"
                onClick={handleDeleteSelectedEdge}
                title="Delete connection"
              >
                <TrashIcon size={13} />
              </button>
            </div>
          )}

          {/* Inline Node Label Editor Overlay */}
          {editingNodeId && editingPos && (
            <input
              autoFocus
              className="mermaid-inline-node-input nodrag"
              style={{
                position: 'absolute',
                left: editingPos.x,
                top: editingPos.y,
                width: editingPos.width,
                height: editingPos.height,
                zIndex: 200,
              }}
              value={editNodeLabel}
              onChange={(e) => setEditNodeLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFinishEditingNode();
                if (e.key === 'Escape') {
                  setEditingNodeId(null);
                  setEditingPos(null);
                }
              }}
              onBlur={handleFinishEditingNode}
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      </div>

      {/* Slide-out Mermaid Code Syntax Drawer */}
      {showCodeDrawer && (
        <div className="mermaid-side-code-drawer nodrag">
          <div className="mermaid-code-drawer-header">
            <span>Mermaid Syntax</span>
            <button
              type="button"
              className="mermaid-code-close-btn"
              onClick={() => setShowCodeDrawer(false)}
            >
              <CloseIcon size={14} />
            </button>
          </div>
          {syntaxError && (
            <div className="mermaid-code-error-badge">{syntaxError}</div>
          )}
          <textarea
            className="mermaid-code-drawer-textarea"
            value={code}
            onChange={(e) => {
              const newCode = e.target.value;
              setCode(newCode);
              onCodeChange(newCode);
              try {
                const parsed = parseMermaidFlowchart(newCode);
                setAst(parsed);
                setSyntaxError(null);
              } catch (err: any) {
                setSyntaxError(err.message || 'Syntax Error');
              }
            }}
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );
};
