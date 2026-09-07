/**
 * Native Mermaid View with Direct Structural Manipulation Overlay
 * Renders Obsidian's exact native Mermaid SVG (100% parity, zero layout simulation)
 * with direct-manipulation node sprouting, drag-to-connect, inline label editing, and camera stabilization.
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  ArrowType,
  MermaidEdgeDef,
  MermaidFlowchartAST,
  FlowchartDirection,
  MermaidShapeType,
} from '../ast/types';
import { parseMermaidFlowchart } from '../ast/parser';
import { serializeMermaidFlowchart } from '../ast/serializer';
import {
  addChildNode,
  addNode,
  connectNodes,
  deleteEdge,
  deleteNode,
  deleteNodes,
  insertNodeOnEdge,
  reverseEdgeDirection,
  setDiagramDirection,
  updateEdgeLabel,
  updateEdgeType,
  updateNodeLabel,
  updateNodeShape,
  updateNodesShape,
  updateNodeStyle,
  updateNodesStyle,
  clearNodeStyle,
  clearNodesStyle,
  getNodeStyle,
  updateEdgeStyle,
  clearEdgeStyle,
  getEdgeStyle,
} from '../ast/mutations';
import { matchSvgEdgeToAst } from '../utils/edgeMatching';
import {
  CursorMode,
  Rect,
  SelectedEdgePos,
  SelectionBox,
  ActiveNodePopover,
  ActiveEdgePopover,
  NativeMermaidViewProps,
  PopoverPos,
} from './types';
import { ThemePreset, EdgeThemePreset } from './constants';
import { renderMermaidSvg } from './renderer/mermaidRenderer';
import { applySelectedNodeHalos } from './renderer/selectionHalo';
import { CanvasTopBar } from './components/CanvasTopBar';
import { SelectionMarquee } from './components/SelectionMarquee';
import { ConnectionLine } from './components/ConnectionLine';
import { ConnectionHandle } from './components/ConnectionHandle';
import { NodeActionHud } from './components/NodeActionHud';
import { MultiSelectHud } from './components/MultiSelectHud';
import { EdgeActionHud } from './components/EdgeActionHud';
import { ShapePopover } from './components/ShapePopover';
import { NodeStylePopover } from './components/NodeStylePopover';
import { EdgeStylePopover } from './components/EdgeStylePopover';
import { SyntaxDrawer } from './components/SyntaxDrawer';

export type { NativeMermaidViewProps };

export const NativeMermaidView: React.FC<NativeMermaidViewProps> = ({
  app,
  initialCode,
  onCodeChange,
}) => {
  const [code, setCode] = useState<string>(
    initialCode || 'flowchart LR\n    A["Start"] --> B["Process"]\n    B --> C["End"]'
  );
  const [ast, setAst] = useState<MermaidFlowchartAST>(() =>
    parseMermaidFlowchart(code)
  );

  // Mode & Multi-Selection state
  const [cursorMode, setCursorMode] = useState<CursorMode>('select');
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const selectedNodeId = selectedNodeIds.size === 1 ? Array.from(selectedNodeIds)[0] : null;

  const setSelectedNodeId = useCallback((id: string | null) => {
    setSelectedNodeIds(id ? new Set([id]) : new Set());
  }, []);

  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [activeNodePopover, setActiveNodePopover] = useState<ActiveNodePopover>(null);
  const [activeEdgePopover, setActiveEdgePopover] = useState<ActiveEdgePopover>(null);

  // Marquee Drag Selection state
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const dragBoxStartRef = useRef<{ x: number; y: number } | null>(null);
  const isMarqueeActiveRef = useRef<boolean>(false);

  // Zoom & Pan state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Node editing state
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editNodeLabel, setEditNodeLabel] = useState<string>('');
  const [editingPos, setEditingPos] = useState<Rect | null>(null);

  // Drag-to-connect state
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [dragLine, setDragLine] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  // Selected element overlay coordinates (relative to worldRef)
  const [selectedNodeRect, setSelectedNodeRect] = useState<Rect | null>(null);
  const [selectedEdgePos, setSelectedEdgePos] = useState<SelectedEdgePos | null>(null);

  // Inline edge caption editing state
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [editEdgeLabel, setEditEdgeLabel] = useState<string>('');
  const [editingEdgePos, setEditingEdgePos] = useState<Rect | null>(null);

  // Hovered node state for connection handle
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredNodeRect, setHoveredNodeRect] = useState<Rect | null>(null);

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
  const renderTicketRef = useRef<number>(0);

  // Exact 1:1 screen-to-world coordinate calculation
  const getLocalRect = useCallback(
    (el: Element): Rect | null => {
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

  // Update selected node overlay box (for single selected node)
  const updateSelectedNodeRect = useCallback(() => {
    if (selectedNodeIds.size !== 1 || !svgMountRef.current) {
      setSelectedNodeRect(null);
      return;
    }

    const singleId = Array.from(selectedNodeIds)[0];
    const nodeEl = svgMountRef.current.querySelector(
      `[data-mermaid-node-id="${singleId}"]`
    );
    if (nodeEl) {
      const rect = getLocalRect(nodeEl);
      if (rect) setSelectedNodeRect(rect);
    }
  }, [selectedNodeIds, getLocalRect]);

  // Update shape-matched SVG selection halo for all currently selected nodes
  const updateSelectedNodeHalo = useCallback(
    (targets?: string | null | Set<string> | string[]) => {
      applySelectedNodeHalos(svgMountRef.current, selectedNodeIds, targets);
    },
    [selectedNodeIds]
  );

  const startEditingNode = (nodeId: string, nodeEl: Element) => {
    setSelectedEdgeId(null);
    setSelectedEdgePos(null);
    setEditingEdgeId(null);
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

  const startEditingEdge = (edgeId: string, anchorEl: Element) => {
    setSelectedNodeId(null);
    setSelectedNodeRect(null);
    setEditingNodeId(null);
    const rect = getLocalRect(anchorEl);
    if (rect) {
      setEditingEdgePos({
        x: rect.x + rect.width / 2 - 70,
        y: rect.y + rect.height / 2 - 16,
        width: Math.max(140, rect.width + 24),
        height: Math.max(32, rect.height + 8),
      });
    }
    const edgeDef = ast.edges.find((e) => e.id === edgeId);
    setEditEdgeLabel(edgeDef?.label || '');
    setEditingEdgeId(edgeId);
    setSelectedEdgeId(edgeId);
  };

  const handleFinishEditingEdge = () => {
    if (editingEdgeId) {
      applyAstMutation((a) => {
        updateEdgeLabel(a, editingEdgeId, editEdgeLabel);
      });
      setEditingEdgeId(null);
      setEditingEdgePos(null);
    }
  };

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

      // Node Click -> Selection (supports Shift / Cmd / Ctrl multi-selection)
      htmlEl.onclick = (e) => {
        e.stopPropagation();
        setSelectedEdgeId(null);
        setSelectedEdgePos(null);

        const isMulti = e.shiftKey || e.metaKey || e.ctrlKey;
        if (isMulti) {
          setSelectedNodeIds((prev) => {
            const next = new Set(prev);
            if (next.has(targetNodeId)) {
              next.delete(targetNodeId);
            } else {
              next.add(targetNodeId);
            }
            updateSelectedNodeHalo(next);
            return next;
          });
        } else {
          setSelectedNodeIds(new Set([targetNodeId]));
          const rect = getLocalRect(htmlEl);
          if (rect) setSelectedNodeRect(rect);
          updateSelectedNodeHalo(new Set([targetNodeId]));
        }
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
    });

    // Helper: Match SVG element to AST edge definition
    const findEdgeForElement = (
      el: Element,
      fallbackIdx?: number
    ): MermaidEdgeDef | null => {
      return matchSvgEdgeToAst(
        {
          id: el.getAttribute('id'),
          className: el.getAttribute('class'),
          textContent: el.textContent,
        },
        ast.edges,
        fallbackIdx
      );
    };

    // B. Setup Edge Paths & Invisible Hit-Areas
    mountEl.querySelectorAll('.mermaid-edge-hit-area').forEach((el) => el.remove());

    const rawEdgePaths = mountEl.querySelectorAll(
      '.edgePaths path, .edgePath path, path.flowchart-link, [class*="flowchart-link"]'
    );
    const edgePaths: SVGPathElement[] = [];
    rawEdgePaths.forEach((p) => {
      const pathEl = p as SVGPathElement;
      if (
        pathEl.tagName.toLowerCase() === 'path' &&
        pathEl.getAttribute('d') &&
        !pathEl.classList.contains('mermaid-edge-hit-area') &&
        !pathEl.classList.contains('arrowheadPath')
      ) {
        edgePaths.push(pathEl);
      }
    });

    edgePaths.forEach((pathEl, idx) => {
      const targetEdge = findEdgeForElement(pathEl, idx);
      if (!targetEdge) return;
      const targetEdgeId = targetEdge.id;

      pathEl.setAttribute('data-mermaid-edge-id', targetEdgeId);
      pathEl.style.cursor = 'pointer';

      // Create an invisible 18px stroke hit overlay
      const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      hitArea.setAttribute('d', pathEl.getAttribute('d') || '');
      hitArea.setAttribute('class', 'mermaid-edge-hit-area');
      hitArea.setAttribute('data-mermaid-edge-id', targetEdgeId);
      hitArea.setAttribute('fill', 'none');
      hitArea.setAttribute('stroke', 'transparent');
      hitArea.setAttribute('stroke-width', '18');
      hitArea.setAttribute('stroke-linecap', 'round');
      hitArea.style.cursor = 'pointer';
      hitArea.style.pointerEvents = 'stroke';

      pathEl.parentNode?.insertBefore(hitArea, pathEl.nextSibling);

      const handleEdgeClick = (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setSelectedEdgeId(targetEdgeId);
        setSelectedNodeId(null);
        setEditingNodeId(null);

        if (worldRef.current && e.clientX && e.clientY) {
          const worldRect = worldRef.current.getBoundingClientRect();
          setSelectedEdgePos({
            x: (e.clientX - worldRect.left) / zoom,
            y: (e.clientY - worldRect.top) / zoom,
            label: targetEdge.label,
            from: targetEdge.from,
            to: targetEdge.to,
            arrowType: targetEdge.arrowType,
          });
        } else {
          const rect = getLocalRect(pathEl);
          if (rect) {
            setSelectedEdgePos({
              x: rect.x + rect.width / 2,
              y: rect.y + rect.height / 2,
              label: targetEdge.label,
              from: targetEdge.from,
              to: targetEdge.to,
              arrowType: targetEdge.arrowType,
            });
          }
        }
      };

      const handleEdgeDblClick = (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        startEditingEdge(targetEdgeId, pathEl);
      };

      pathEl.onclick = handleEdgeClick;
      pathEl.ondblclick = handleEdgeDblClick;

      hitArea.onclick = handleEdgeClick;
      hitArea.ondblclick = handleEdgeDblClick;

      hitArea.onmouseenter = () => {
        pathEl.classList.add('mermaid-edge-hovered');
      };
      hitArea.onmouseleave = () => {
        pathEl.classList.remove('mermaid-edge-hovered');
      };
    });

    // C. Setup Edge Labels
    const edgeLabels = mountEl.querySelectorAll(
      '.edgeLabels .edgeLabel, .edgeLabel, [class*="edgeLabel"]'
    );
    edgeLabels.forEach((el) => {
      const htmlEl = el as SVGGraphicsElement;
      const targetEdge = findEdgeForElement(htmlEl);
      if (!targetEdge) return;
      const targetEdgeId = targetEdge.id;

      htmlEl.setAttribute('data-mermaid-edge-id', targetEdgeId);
      htmlEl.style.cursor = 'pointer';

      htmlEl.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        setSelectedEdgeId(targetEdgeId);
        setSelectedNodeId(null);
        setEditingNodeId(null);

        const rect = getLocalRect(htmlEl);
        if (rect) {
          setSelectedEdgePos({
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
            label: targetEdge.label,
            from: targetEdge.from,
            to: targetEdge.to,
            arrowType: targetEdge.arrowType,
          });
        }
      };

      htmlEl.ondblclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        startEditingEdge(targetEdgeId, htmlEl);
      };
    });
  }, [
    ast,
    zoom,
    getLocalRect,
    updateSelectedNodeHalo,
    setSelectedNodeId,
  ]);

  // 3. Camera Stabilization: Lock viewport around active element across re-renders
  const stabilizeCamera = useCallback(() => {
    if (!pendingCameraPinRef.current || !svgMountRef.current) return;
    const { nodeId, screenX, screenY } = pendingCameraPinRef.current;
    pendingCameraPinRef.current = null;

    const el = svgMountRef.current.querySelector(
      `[data-mermaid-node-id="${nodeId}"]`
    );
    if (!el) return;

    const newRect = el.getBoundingClientRect();
    const newCenterX = newRect.left + newRect.width / 2;
    const newCenterY = newRect.top + newRect.height / 2;

    const deltaX = screenX - newCenterX;
    const deltaY = screenY - newCenterY;

    setPan((p) => ({ x: p.x + deltaX, y: p.y + deltaY }));
  }, []);

  // Update selected node rect and shape halo whenever selection, zoom, or pan changes
  useEffect(() => {
    updateSelectedNodeRect();
    updateSelectedNodeHalo();
    return () => {
      if (svgMountRef.current) {
        svgMountRef.current
          .querySelectorAll('.mermaid-node-selection-halo')
          .forEach((el) => el.remove());
      }
    };
  }, [selectedNodeIds, zoom, pan, updateSelectedNodeRect, updateSelectedNodeHalo]);

  // Global Keyboard Shortcuts (V for Select, H for Hand, Space for pan, Delete/Backspace, Escape)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isInputActive =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA';

      // Spacebar hold to temporarily activate hand pan
      if (e.code === 'Space' && !isInputActive && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
        return;
      }

      // Hotkey V: Select Mode
      if ((e.key === 'v' || e.key === 'V') && !isInputActive) {
        setCursorMode('select');
        return;
      }

      // Hotkey H: Hand Mode
      if ((e.key === 'h' || e.key === 'H') && !isInputActive) {
        setCursorMode('hand');
        return;
      }

      // Escape: Dismiss popovers and clear selection
      if (e.key === 'Escape') {
        if (activeNodePopover || activeEdgePopover) {
          setActiveNodePopover(null);
          setActiveEdgePopover(null);
        } else if (selectedNodeIds.size > 0 || selectedEdgeId) {
          setSelectedNodeIds(new Set());
          setSelectedEdgeId(null);
          updateSelectedNodeHalo(new Set());
        }
        return;
      }

      // Delete / Backspace: Delete selected elements
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputActive) {
        if (selectedNodeIds.size > 0) {
          e.preventDefault();
          handleBatchDeleteSelected();
        } else if (selectedEdgeId) {
          e.preventDefault();
          handleDeleteSelectedEdge();
        }
      }
    };

    const handleGlobalKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('keyup', handleGlobalKeyUp);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('keyup', handleGlobalKeyUp);
    };
  }, [activeNodePopover, activeEdgePopover, selectedNodeIds, selectedEdgeId, updateSelectedNodeHalo]);

  // 1. Render Obsidian's native Mermaid SVG with direct engine and double buffering
  useEffect(() => {
    const mountEl = svgMountRef.current;
    if (!mountEl) return;

    const ticket = ++renderTicketRef.current;

    renderMermaidSvg(app, code)
      .then((svgHtml) => {
        // Discard stale renders
        if (ticket !== renderTicketRef.current) return;

        // Double buffering: Atomic swap of DOM content (no blank gap!)
        mountEl.innerHTML = svgHtml;
        setSyntaxError(null);

        setupSvgInteractivity();
        stabilizeCamera();
        updateSelectedNodeRect();
        updateSelectedNodeHalo();
      })
      .catch((err) => {
        if (ticket !== renderTicketRef.current) return;
        console.error('Mermaid render error:', err);
        setSyntaxError(err?.message || 'Diagram syntax error');
      });
  }, [
    code,
    app,
    setupSvgInteractivity,
    stabilizeCamera,
    updateSelectedNodeRect,
    updateSelectedNodeHalo,
  ]);

  // Node Actions
  const handleSproutNextStep = (parentId: string) => {
    let createdChildId: string | null = null;
    applyAstMutation((a) => {
      const res = addChildNode(a, parentId, 'Next Step');
      createdChildId = res.nodeId;
    }, parentId);

    if (createdChildId) {
      setSelectedNodeId(createdChildId);
    }
  };

  const handleDeleteSelectedNode = () => {
    if (!selectedNodeId) return;
    const targetId = selectedNodeId;
    setSelectedNodeId(null);
    setSelectedNodeRect(null);
    setActiveNodePopover(null);
    updateSelectedNodeHalo(new Set());
    applyAstMutation((a) => {
      deleteNode(a, targetId);
    });
  };

  const handleBatchDeleteSelected = () => {
    if (selectedNodeIds.size === 0) return;
    const targets = Array.from(selectedNodeIds);
    setSelectedNodeIds(new Set());
    setSelectedNodeRect(null);
    setActiveNodePopover(null);
    updateSelectedNodeHalo(new Set());
    applyAstMutation((a) => {
      deleteNodes(a, targets);
    });
  };

  const handleUpdateNodeShape = (shape: MermaidShapeType, specificId?: string) => {
    applyAstMutation((a) => {
      if (specificId) {
        updateNodeShape(a, specificId, shape);
      } else if (selectedNodeIds.size > 1) {
        updateNodesShape(a, selectedNodeIds, shape);
      } else if (selectedNodeId) {
        updateNodeShape(a, selectedNodeId, shape);
      }
    }, specificId || selectedNodeId || undefined);
    setActiveNodePopover(null);
  };

  const handleApplyNodePreset = (
    preset: ThemePreset,
    specificId?: string
  ) => {
    applyAstMutation((a) => {
      const targets = specificId
        ? [specificId]
        : selectedNodeIds.size > 0
        ? Array.from(selectedNodeIds)
        : selectedNodeId
        ? [selectedNodeId]
        : [];

      if (!preset.fill && !preset.stroke && !preset.color) {
        clearNodesStyle(a, targets);
      } else {
        const styles: Record<string, string> = {};
        if (preset.fill) styles['fill'] = preset.fill;
        if (preset.stroke) styles['stroke'] = preset.stroke;
        if (preset.color) styles['color'] = preset.color;
        updateNodesStyle(a, targets, styles);
      }
    }, specificId || selectedNodeId || undefined);
  };

  const handleUpdateCustomStyle = (
    property: string,
    value: string,
    specificId?: string
  ) => {
    applyAstMutation((a) => {
      const targets = specificId
        ? [specificId]
        : selectedNodeIds.size > 0
        ? Array.from(selectedNodeIds)
        : selectedNodeId
        ? [selectedNodeId]
        : [];

      for (const nid of targets) {
        const current = getNodeStyle(a, nid) || {};
        const updated = { ...current };
        if (value) {
          updated[property] = value;
        } else {
          delete updated[property];
        }
        updateNodeStyle(a, nid, updated);
      }
    }, specificId || selectedNodeId || undefined);
  };

  const handleClearNodeStyle = (specificId?: string) => {
    applyAstMutation((a) => {
      const targets = specificId
        ? [specificId]
        : selectedNodeIds.size > 0
        ? Array.from(selectedNodeIds)
        : selectedNodeId
        ? [selectedNodeId]
        : [];
      clearNodesStyle(a, targets);
    }, specificId || selectedNodeId || undefined);
  };

  const handleAddStandaloneStep = () => {
    let createdNodeId: string | null = null;
    applyAstMutation((a) => {
      createdNodeId = addNode(a, 'New Step');
    });

    if (createdNodeId) {
      setSelectedNodeId(createdNodeId);
    }
  };

  const handleToggleDirection = () => {
    const order: FlowchartDirection[] = ['TD', 'LR', 'BT', 'RL'];
    const nextDir = order[(order.indexOf(ast.direction) + 1) % order.length];
    applyAstMutation((a) => {
      setDiagramDirection(a, nextDir);
    });
  };

  const handleChangeEdgeType = (newType: ArrowType) => {
    if (!selectedEdgeId) return;
    applyAstMutation((a) => {
      updateEdgeType(a, selectedEdgeId, newType);
    });
    setSelectedEdgePos((prev) => (prev ? { ...prev, arrowType: newType } : null));
  };

  const handleReverseEdge = () => {
    if (!selectedEdgeId) return;
    let newEdgeId: string | null = null;
    applyAstMutation((a) => {
      newEdgeId = reverseEdgeDirection(a, selectedEdgeId);
    });
    if (newEdgeId) {
      setSelectedEdgeId(newEdgeId);
      setSelectedEdgePos((prev) =>
        prev
          ? {
              ...prev,
              from: prev.to,
              to: prev.from,
            }
          : null
      );
    }
  };

  const handleInsertNodeOnEdge = (edgeId: string) => {
    let createdNodeId: string | null = null;
    applyAstMutation((a) => {
      const res = insertNodeOnEdge(a, edgeId, 'New Step');
      if (res) createdNodeId = res.nodeId;
    });
    setSelectedEdgeId(null);
    setSelectedEdgePos(null);
    if (createdNodeId) {
      setSelectedNodeId(createdNodeId);
    }
  };

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
    setSelectedEdgePos((prev) => (prev ? { ...prev, label: newLabel } : null));
  };

  const handleApplyEdgePreset = (preset: EdgeThemePreset) => {
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
  };

  const handleUpdateEdgeCustomStyle = (property: string, value: string) => {
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
  };

  const handleClearEdgeStyle = () => {
    if (!selectedEdgeId) return;
    applyAstMutation((a) => {
      clearEdgeStyle(a, selectedEdgeId);
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
      (e.target as HTMLElement).closest('.mermaid-multiselect-hud') ||
      (e.target as HTMLElement).closest('.mermaid-connection-handle')
    ) {
      return;
    }

    const isMiddleClick = e.button === 1;
    const isHandModeActive = cursorMode === 'hand' || isSpacePressed || isMiddleClick;

    if (isHandModeActive) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    // In Select Mode: Left click on canvas background starts marquee selection
    if (e.button === 0 && worldRef.current) {
      const worldRect = worldRef.current.getBoundingClientRect();
      const worldX = (e.clientX - worldRect.left) / zoom;
      const worldY = (e.clientY - worldRect.top) / zoom;

      dragBoxStartRef.current = { x: worldX, y: worldY };
      isMarqueeActiveRef.current = false;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
      return;
    }

    // Drag-to-connect line update
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

    // Marquee Drag Selection update
    if (dragBoxStartRef.current && worldRef.current) {
      const worldRect = worldRef.current.getBoundingClientRect();
      const currentX = (e.clientX - worldRect.left) / zoom;
      const currentY = (e.clientY - worldRect.top) / zoom;
      const startX = dragBoxStartRef.current.x;
      const startY = dragBoxStartRef.current.y;

      const dist = Math.hypot(currentX - startX, currentY - startY);
      if (dist > 3) {
        isMarqueeActiveRef.current = true;
        setSelectionBox({ startX, startY, currentX, currentY });

        const minX = Math.min(startX, currentX);
        const maxX = Math.max(startX, currentX);
        const minY = Math.min(startY, currentY);
        const maxY = Math.max(startY, currentY);

        const newSelected = new Set<string>();
        if (svgMountRef.current) {
          for (const nodeId of ast.nodes.keys()) {
            const nodeEl = svgMountRef.current.querySelector(
              `[data-mermaid-node-id="${nodeId}"]`
            );
            if (nodeEl) {
              const rect = getLocalRect(nodeEl);
              if (rect) {
                const intersects = !(
                  rect.x + rect.width < minX ||
                  rect.x > maxX ||
                  rect.y + rect.height < minY ||
                  rect.y > maxY
                );
                if (intersects) {
                  newSelected.add(nodeId);
                }
              }
            }
          }
        }
        setSelectedNodeIds(newSelected);
        updateSelectedNodeHalo(newSelected);
      }
      return;
    }

    // Proximity-based smooth hover clearance
    if (hoveredNodeId && hoveredNodeRect && worldRef.current && !connectingSourceId) {
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
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    setIsPanning(false);

    if (dragBoxStartRef.current) {
      dragBoxStartRef.current = null;
      setSelectionBox(null);
      setTimeout(() => {
        isMarqueeActiveRef.current = false;
      }, 50);
    }

    if (connectingSourceId) {
      const targetNodeEl = (e.target as HTMLElement).closest(
        '[data-mermaid-node-id]'
      ) as HTMLElement | null;
      const targetNodeId = targetNodeEl?.getAttribute('data-mermaid-node-id');

      const targetEdgeEl = (e.target as HTMLElement).closest(
        '[data-mermaid-edge-id]'
      ) as HTMLElement | null;
      const targetEdgeId = targetEdgeEl?.getAttribute('data-mermaid-edge-id');

      if (targetNodeId && targetNodeId !== connectingSourceId) {
        // Dragging to another node simply creates a directed arrow
        applyAstMutation((a) => {
          connectNodes(a, connectingSourceId, targetNodeId);
        }, connectingSourceId);
      } else if (targetEdgeId) {
        // Dropped directly on an existing arrow -> split arrow and insert node in between
        let createdNodeId: string | null = null;
        applyAstMutation((a) => {
          const res = insertNodeOnEdge(a, targetEdgeId, 'New Step');
          if (res) createdNodeId = res.nodeId;
        });
        if (createdNodeId) setSelectedNodeId(createdNodeId);
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

  // Bounding box enclosing all selected nodes in world coordinates (for Multi-Select)
  const multiSelectBounds = useMemo(() => {
    if (selectedNodeIds.size <= 1 || !svgMountRef.current) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let found = 0;

    for (const id of selectedNodeIds) {
      const el = svgMountRef.current.querySelector(
        `[data-mermaid-node-id="${id}"]`
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
  }, [selectedNodeIds, getLocalRect]);

  // Position for Shape & Style popovers (anchored to single sprout or multi-select cluster)
  const popoverPos: PopoverPos | null = useMemo(() => {
    if (selectedNodeIds.size > 1 && multiSelectBounds) {
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
    return null;
  }, [selectedNodeIds.size, multiSelectBounds, selectedNodeRect, sproutX, sproutY, isLR]);

  return (
    <div
      className={`mermaid-native-editor-root is-mode-${cursorMode} ${
        isPanning ? 'is-panning' : ''
      } ${isSpacePressed ? 'is-space-held' : ''}`}
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        if (!connectingSourceId) {
          setHoveredNodeId(null);
          setHoveredNodeRect(null);
        }
      }}
      onClick={() => {
        if (isMarqueeActiveRef.current) return;
        setSelectedNodeIds(new Set());
        setSelectedNodeRect(null);
        setSelectedEdgeId(null);
        setSelectedEdgePos(null);
        setEditingNodeId(null);
        setEditingEdgeId(null);
        setActiveNodePopover(null);
        setActiveEdgePopover(null);
        updateSelectedNodeHalo(new Set());
      }}
    >
      {/* Top Controls Bar */}
      <CanvasTopBar
        cursorMode={cursorMode}
        onSetCursorMode={setCursorMode}
        onAddStep={handleAddStandaloneStep}
        direction={ast.direction}
        onToggleDirection={handleToggleDirection}
        onFitView={handleFitView}
        showCodeDrawer={showCodeDrawer}
        onToggleCodeDrawer={() => setShowCodeDrawer(!showCodeDrawer)}
      />

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
        <div className="mermaid-native-svg-mount mermaid" ref={svgMountRef} />

        {/* Interactive Overlay Layer */}
        <div className="mermaid-native-overlay">
          {/* Connection Dragging SVG Line */}
          <ConnectionLine dragLine={dragLine} />

          {/* Marquee Drag Selection Box */}
          <SelectionMarquee box={selectionBox} />

          {/* Node Connection Handle (Downstream anchor dot) */}
          <ConnectionHandle
            hoveredNodeRect={hoveredNodeRect}
            isLR={isLR}
            cursorMode={cursorMode}
            isSpacePressed={isSpacePressed}
            onStartConnect={handleStartConnect}
          />

          {/* Multi-Select Floating Action HUD */}
          {multiSelectBounds && selectedNodeIds.size > 1 && (
            <MultiSelectHud
              selectedCount={selectedNodeIds.size}
              centerX={multiSelectBounds.centerX}
              topY={multiSelectBounds.topY}
              activeNodePopover={activeNodePopover}
              onTogglePopover={(popover) =>
                setActiveNodePopover((prev) => (prev === popover ? null : popover))
              }
              onBatchDelete={handleBatchDeleteSelected}
            />
          )}

          {/* Single Node Relational Sprout HUD */}
          {selectedNodeRect && selectedNodeId && selectedNodeIds.size === 1 && (
            <NodeActionHud
              selectedNodeId={selectedNodeId}
              sproutX={sproutX}
              sproutY={sproutY}
              isLR={isLR}
              currentNode={ast.nodes.get(selectedNodeId)}
              currentStyle={
                ast.nodes.get(selectedNodeId)?.style ||
                getNodeStyle(ast, selectedNodeId)
              }
              activeNodePopover={activeNodePopover}
              onSproutNextStep={() => handleSproutNextStep(selectedNodeId)}
              onRename={() => {
                const el = svgMountRef.current?.querySelector(
                  `[data-mermaid-node-id="${selectedNodeId}"]`
                );
                if (el) startEditingNode(selectedNodeId, el);
              }}
              onTogglePopover={(popover) =>
                setActiveNodePopover((prev) => (prev === popover ? null : popover))
              }
              onDelete={handleDeleteSelectedNode}
            />
          )}

          {/* Shape Popover (supports single or multi-select) */}
          {activeNodePopover === 'shape' && popoverPos && (
            <ShapePopover
              popoverPos={popoverPos}
              selectedNodeId={selectedNodeId}
              selectedNodeIds={selectedNodeIds}
              astNodes={ast.nodes}
              onSelectShape={(shape) => handleUpdateNodeShape(shape)}
            />
          )}

          {/* Node Visual Styling Popover (supports single or multi-select) */}
          {activeNodePopover === 'style' && popoverPos && (
            <NodeStylePopover
              popoverPos={popoverPos}
              currentStyle={
                selectedNodeId
                  ? ast.nodes.get(selectedNodeId)?.style ||
                    getNodeStyle(ast, selectedNodeId)
                  : Array.from(selectedNodeIds).length > 0
                  ? ast.nodes.get(Array.from(selectedNodeIds)[0])?.style ||
                    getNodeStyle(ast, Array.from(selectedNodeIds)[0])
                  : undefined
              }
              onApplyPreset={handleApplyNodePreset}
              onUpdateCustomStyle={handleUpdateCustomStyle}
              onClearStyle={handleClearNodeStyle}
            />
          )}

          {/* Selected Edge HUD */}
          {selectedEdgePos && selectedEdgeId && (
            <EdgeActionHud
              selectedEdgeId={selectedEdgeId}
              selectedEdgePos={selectedEdgePos}
              selectedEdgeStyle={
                ast.edges.find((e) => e.id === selectedEdgeId)?.style ||
                getEdgeStyle(ast, selectedEdgeId)
              }
              activeEdgePopover={activeEdgePopover}
              onChangeEdgeType={handleChangeEdgeType}
              onReverseEdge={handleReverseEdge}
              onInsertNodeOnEdge={() => handleInsertNodeOnEdge(selectedEdgeId)}
              onUpdateEdgeLabel={handleUpdateEdgeLabel}
              onToggleStylePopover={() =>
                setActiveEdgePopover((prev) => (prev === 'style' ? null : 'style'))
              }
              onDeleteEdge={handleDeleteSelectedEdge}
            />
          )}

          {/* Edge Style Popover */}
          {activeEdgePopover === 'style' && selectedEdgePos && selectedEdgeId && (
            <EdgeStylePopover
              selectedEdgePos={selectedEdgePos}
              currentEdgeStyle={
                ast.edges.find((e) => e.id === selectedEdgeId)?.style ||
                getEdgeStyle(ast, selectedEdgeId)
              }
              onApplyPreset={handleApplyEdgePreset}
              onUpdateCustomStyle={handleUpdateEdgeCustomStyle}
              onClearStyle={handleClearEdgeStyle}
            />
          )}

          {/* Inline Edge Caption Editor Overlay (Double-Click) */}
          {editingEdgeId && editingEdgePos && (
            <input
              autoFocus
              className="mermaid-inline-edge-input nodrag"
              style={{
                position: 'absolute',
                left: editingEdgePos.x,
                top: editingEdgePos.y,
                width: editingEdgePos.width,
                height: editingEdgePos.height,
                zIndex: 200,
              }}
              value={editEdgeLabel}
              placeholder="Caption..."
              onChange={(e) => setEditEdgeLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFinishEditingEdge();
                if (e.key === 'Escape') {
                  setEditingEdgeId(null);
                  setEditingEdgePos(null);
                }
              }}
              onBlur={handleFinishEditingEdge}
              onClick={(e) => e.stopPropagation()}
            />
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
      <SyntaxDrawer
        isOpen={showCodeDrawer}
        code={code}
        syntaxError={syntaxError}
        onClose={() => setShowCodeDrawer(false)}
        onChangeCode={(newCode) => {
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
      />
    </div>
  );
};
