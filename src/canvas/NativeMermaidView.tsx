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
  deleteEdges,
  deleteNode,
  deleteNodes,
  insertNodeOnEdge,
  reverseEdgeDirection,
  setDiagramDirection,
  updateEdgeLabel,
  updateEdgeType,
  updateEdgesType,
  updateNodeLabel,
  updateNodeShape,
  updateNodesShape,
  updateNodeStyle,
  updateNodesStyle,
  clearNodeStyle,
  clearNodesStyle,
  getNodeStyle,
  updateEdgeStyle,
  updateEdgesStyle,
  clearEdgeStyle,
  clearEdgesStyle,
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
  ActiveMultiPopover,
  NativeMermaidViewProps,
  PopoverPos,
} from './types';
import { ThemePreset, EdgeThemePreset } from './constants';
import { renderMermaidSvg } from './renderer/mermaidRenderer';
import {
  applySelectedNodeHalos,
  applySelectedEdgeHalos,
} from './renderer/selectionHalo';
import { CanvasTopBar } from './components/CanvasTopBar';
import { SelectionMarquee } from './components/SelectionMarquee';
import { ConnectionLine } from './components/ConnectionLine';
import { ConnectionHandle } from './components/ConnectionHandle';
import { NodeActionHud } from './components/NodeActionHud';
import { MultiSelectHud } from './components/MultiSelectHud';
import { EdgeActionHud } from './components/EdgeActionHud';
import { ShapePopover } from './components/ShapePopover';
import { EdgeTypePopover } from './components/EdgeTypePopover';
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
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(new Set());

  const isMultiSelect =
    selectedNodeIds.size + selectedEdgeIds.size > 1 ||
    (selectedNodeIds.size >= 1 && selectedEdgeIds.size >= 1);

  const selectedNodeId =
    selectedNodeIds.size === 1 && selectedEdgeIds.size === 0
      ? Array.from(selectedNodeIds)[0]
      : null;

  const selectedEdgeId =
    selectedEdgeIds.size === 1 && selectedNodeIds.size === 0
      ? Array.from(selectedEdgeIds)[0]
      : null;

  const setSelectedNodeId = useCallback((id: string | null) => {
    setSelectedNodeIds(id ? new Set([id]) : new Set());
  }, []);

  const setSelectedEdgeId = useCallback((id: string | null) => {
    setSelectedEdgeIds(id ? new Set([id]) : new Set());
  }, []);

  const [activeNodePopover, setActiveNodePopover] = useState<ActiveNodePopover>(null);
  const [activeEdgePopover, setActiveEdgePopover] = useState<ActiveEdgePopover>(null);
  const [activeMultiPopover, setActiveMultiPopover] = useState<ActiveMultiPopover>(null);

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

  // Update selection styling for all currently selected edges
  const updateSelectedEdgeHalo = useCallback(
    (targets?: string | null | Set<string> | string[]) => {
      applySelectedEdgeHalos(svgMountRef.current, selectedEdgeIds, targets);
    },
    [selectedEdgeIds]
  );

  const startEditingNode = (nodeId: string, nodeEl: Element) => {
    setSelectedEdgeIds(new Set());
    setSelectedEdgePos(null);
    setEditingEdgeId(null);
    updateSelectedEdgeHalo(new Set());
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
    setSelectedNodeIds(new Set());
    setSelectedNodeRect(null);
    setEditingNodeId(null);
    updateSelectedNodeHalo(new Set());
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
    updateSelectedEdgeHalo(new Set([edgeId]));
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
          setSelectedEdgeIds(new Set());
          setSelectedEdgePos(null);
          updateSelectedEdgeHalo(new Set());
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

      const onEdgeClick = (
        e: MouseEvent,
        edgeDef: MermaidEdgeDef,
        clickedEl: Element
      ) => {
        e.stopPropagation();
        e.preventDefault();

        const edgeId = edgeDef.id;
        const isMulti = e.shiftKey || e.metaKey || e.ctrlKey;
        if (isMulti) {
          setSelectedEdgeIds((prev) => {
            const next = new Set(prev);
            if (next.has(edgeId)) {
              next.delete(edgeId);
            } else {
              next.add(edgeId);
            }
            updateSelectedEdgeHalo(next);
            return next;
          });
        } else {
          setSelectedEdgeIds(new Set([edgeId]));
          setSelectedNodeIds(new Set());
          setSelectedNodeRect(null);
          setEditingNodeId(null);
          updateSelectedNodeHalo(new Set());
          updateSelectedEdgeHalo(new Set([edgeId]));

          if (worldRef.current && e.clientX && e.clientY) {
            const worldRect = worldRef.current.getBoundingClientRect();
            setSelectedEdgePos({
              x: (e.clientX - worldRect.left) / zoom,
              y: (e.clientY - worldRect.top) / zoom,
              label: edgeDef.label,
              from: edgeDef.from,
              to: edgeDef.to,
              arrowType: edgeDef.arrowType,
            });
          } else {
            const rect = getLocalRect(clickedEl);
            if (rect) {
              setSelectedEdgePos({
                x: rect.x + rect.width / 2,
                y: rect.y + rect.height / 2,
                label: edgeDef.label,
                from: edgeDef.from,
                to: edgeDef.to,
                arrowType: edgeDef.arrowType,
              });
            }
          }
        }
      };

      const handleEdgeDblClick = (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        startEditingEdge(targetEdgeId, pathEl);
      };

      pathEl.onclick = (e) => onEdgeClick(e, targetEdge, pathEl);
      pathEl.ondblclick = handleEdgeDblClick;

      hitArea.onclick = (e) => onEdgeClick(e, targetEdge, pathEl);
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
        const edgeDef = ast.edges.find((ed) => ed.id === targetEdgeId) || targetEdge;
        const mouseEv = e as unknown as MouseEvent;
        mouseEv.stopPropagation();
        mouseEv.preventDefault();

        const isMulti = mouseEv.shiftKey || mouseEv.metaKey || mouseEv.ctrlKey;
        if (isMulti) {
          setSelectedEdgeIds((prev) => {
            const next = new Set(prev);
            if (next.has(targetEdgeId)) {
              next.delete(targetEdgeId);
            } else {
              next.add(targetEdgeId);
            }
            updateSelectedEdgeHalo(next);
            return next;
          });
        } else {
          setSelectedEdgeIds(new Set([targetEdgeId]));
          setSelectedNodeIds(new Set());
          setSelectedNodeRect(null);
          setEditingNodeId(null);
          updateSelectedNodeHalo(new Set());
          updateSelectedEdgeHalo(new Set([targetEdgeId]));

          const rect = getLocalRect(htmlEl);
          if (rect) {
            setSelectedEdgePos({
              x: rect.x + rect.width / 2,
              y: rect.y + rect.height / 2,
              label: edgeDef.label,
              from: edgeDef.from,
              to: edgeDef.to,
              arrowType: edgeDef.arrowType,
            });
          }
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
    updateSelectedEdgeHalo,
    setSelectedNodeId,
    setSelectedEdgeId,
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

  // Update selected node and edge halos whenever selection, zoom, or pan changes
  useEffect(() => {
    updateSelectedNodeRect();
    updateSelectedNodeHalo();
    updateSelectedEdgeHalo();
    return () => {
      if (svgMountRef.current) {
        svgMountRef.current
          .querySelectorAll('.mermaid-node-selection-halo')
          .forEach((el) => el.remove());
        svgMountRef.current
          .querySelectorAll('.mermaid-edge-selected')
          .forEach((el) => el.classList.remove('mermaid-edge-selected'));
      }
    };
  }, [
    selectedNodeIds,
    selectedEdgeIds,
    zoom,
    pan,
    updateSelectedNodeRect,
    updateSelectedNodeHalo,
    updateSelectedEdgeHalo,
  ]);

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
        if (activeNodePopover || activeEdgePopover || activeMultiPopover) {
          setActiveNodePopover(null);
          setActiveEdgePopover(null);
          setActiveMultiPopover(null);
        } else if (selectedNodeIds.size > 0 || selectedEdgeIds.size > 0) {
          setSelectedNodeIds(new Set());
          setSelectedEdgeIds(new Set());
          setSelectedNodeRect(null);
          setSelectedEdgePos(null);
          updateSelectedNodeHalo(new Set());
          updateSelectedEdgeHalo(new Set());
        }
        return;
      }

      // Delete / Backspace: Delete selected elements
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputActive) {
        if (selectedNodeIds.size > 0 || selectedEdgeIds.size > 0) {
          e.preventDefault();
          handleBatchDeleteSelected();
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
  }, [
    activeNodePopover,
    activeEdgePopover,
    activeMultiPopover,
    selectedNodeIds,
    selectedEdgeIds,
    updateSelectedNodeHalo,
    updateSelectedEdgeHalo,
  ]);

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
        updateSelectedEdgeHalo();
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
    updateSelectedEdgeHalo,
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
    if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) return;
    const nodesToDelete = Array.from(selectedNodeIds);
    const edgesToDelete = Array.from(selectedEdgeIds);

    setSelectedNodeIds(new Set());
    setSelectedEdgeIds(new Set());
    setSelectedNodeRect(null);
    setSelectedEdgePos(null);
    setActiveNodePopover(null);
    setActiveEdgePopover(null);
    setActiveMultiPopover(null);
    updateSelectedNodeHalo(new Set());
    updateSelectedEdgeHalo(new Set());

    applyAstMutation((a) => {
      if (nodesToDelete.length > 0) {
        deleteNodes(a, nodesToDelete);
      }
      if (edgesToDelete.length > 0) {
        deleteEdges(a, edgesToDelete);
      }
    });
  };

  const handleBatchUpdateShape = (shape: MermaidShapeType) => {
    if (selectedNodeIds.size === 0) return;
    applyAstMutation((a) => {
      updateNodesShape(a, selectedNodeIds, shape);
    });
    setActiveMultiPopover(null);
  };

  const handleBatchUpdateEdgeType = (newType: ArrowType) => {
    if (selectedEdgeIds.size === 0) return;
    applyAstMutation((a) => {
      updateEdgesType(a, selectedEdgeIds, newType);
    });
    setActiveMultiPopover(null);
  };

  const handleBatchApplyThemePreset = (preset: ThemePreset) => {
    applyAstMutation((a) => {
      if (selectedNodeIds.size > 0) {
        if (!preset.fill && !preset.stroke && !preset.color) {
          clearNodesStyle(a, selectedNodeIds);
        } else {
          const styles: Record<string, string> = {};
          if (preset.fill) styles['fill'] = preset.fill;
          if (preset.stroke) styles['stroke'] = preset.stroke;
          if (preset.color) styles['color'] = preset.color;
          updateNodesStyle(a, selectedNodeIds, styles);
        }
      }
      if (selectedEdgeIds.size > 0) {
        if (!preset.stroke) {
          clearEdgesStyle(a, selectedEdgeIds);
        } else {
          updateEdgesStyle(a, selectedEdgeIds, { stroke: preset.stroke });
        }
      }
    });
  };

  const handleBatchUpdateCustomStyle = (property: string, value: string) => {
    applyAstMutation((a) => {
      if (selectedNodeIds.size > 0) {
        for (const nid of selectedNodeIds) {
          const current = getNodeStyle(a, nid) || {};
          const updated = { ...current };
          if (value) {
            updated[property] = value;
          } else {
            delete updated[property];
          }
          updateNodeStyle(a, nid, updated);
        }
      }
      if (selectedEdgeIds.size > 0) {
        if (
          property === 'stroke' ||
          property === 'stroke-width' ||
          property === 'stroke-dasharray' ||
          property === 'color'
        ) {
          for (const eid of selectedEdgeIds) {
            const current = getEdgeStyle(a, eid) || {};
            const updated = { ...current };
            if (value) {
              updated[property] = value;
            } else {
              delete current[property];
            }
            updateEdgeStyle(a, eid, updated);
          }
        }
      }
    });
  };

  const handleBatchClearStyle = () => {
    applyAstMutation((a) => {
      if (selectedNodeIds.size > 0) {
        clearNodesStyle(a, selectedNodeIds);
      }
      if (selectedEdgeIds.size > 0) {
        clearEdgesStyle(a, selectedEdgeIds);
      }
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
    setSelectedEdgeIds(new Set());
    setSelectedEdgePos(null);
    updateSelectedEdgeHalo(new Set());
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

        const newSelectedNodes = new Set<string>();
        const newSelectedEdges = new Set<string>();
        if (svgMountRef.current) {
          // 1. Check nodes
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
                  newSelectedNodes.add(nodeId);
                }
              }
            }
          }

          // 2. Check edges
          for (const edge of ast.edges) {
            const edgePathEl = svgMountRef.current.querySelector(
              `path[data-mermaid-edge-id="${edge.id}"]:not(.mermaid-edge-hit-area)`
            );
            if (edgePathEl) {
              const rect = getLocalRect(edgePathEl);
              if (rect) {
                const intersects = !(
                  rect.x + rect.width < minX ||
                  rect.x > maxX ||
                  rect.y + rect.height < minY ||
                  rect.y > maxY
                );
                if (intersects) {
                  newSelectedEdges.add(edge.id);
                }
              }
            }
          }
        }
        setSelectedNodeIds(newSelectedNodes);
        setSelectedEdgeIds(newSelectedEdges);
        updateSelectedNodeHalo(newSelectedNodes);
        updateSelectedEdgeHalo(newSelectedEdges);
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
  }, [selectedNodeIds, selectedEdgeIds, getLocalRect]);

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
  }, [isMultiSelect, multiSelectBounds, selectedNodeRect, selectedEdgePos, sproutX, sproutY, isLR]);

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
        setSelectedEdgeIds(new Set());
        setSelectedNodeRect(null);
        setSelectedEdgePos(null);
        setEditingNodeId(null);
        setEditingEdgeId(null);
        setActiveNodePopover(null);
        setActiveEdgePopover(null);
        setActiveMultiPopover(null);
        updateSelectedNodeHalo(new Set());
        updateSelectedEdgeHalo(new Set());
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
          {multiSelectBounds && isMultiSelect && (
            <MultiSelectHud
              selectedNodeCount={selectedNodeIds.size}
              selectedEdgeCount={selectedEdgeIds.size}
              centerX={multiSelectBounds.centerX}
              topY={multiSelectBounds.topY}
              activePopover={activeMultiPopover}
              onTogglePopover={(popover) =>
                setActiveMultiPopover((prev) => (prev === popover ? null : popover))
              }
              onBatchDelete={handleBatchDeleteSelected}
            />
          )}

          {/* Single Node Relational Sprout HUD */}
          {selectedNodeRect && selectedNodeId && !isMultiSelect && (
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

          {/* Shape Popover (supports single node or multi-select) */}
          {(activeNodePopover === 'shape' || activeMultiPopover === 'shape') && popoverPos && (
            <ShapePopover
              popoverPos={popoverPos}
              selectedNodeId={selectedNodeId}
              selectedNodeIds={selectedNodeIds}
              astNodes={ast.nodes}
              onSelectShape={(shape) => {
                if (isMultiSelect) {
                  handleBatchUpdateShape(shape);
                } else {
                  handleUpdateNodeShape(shape);
                }
              }}
            />
          )}

          {/* Edge Type Popover for multi-select */}
          {activeMultiPopover === 'edgeType' && popoverPos && (
            <EdgeTypePopover
              popoverPos={popoverPos}
              onSelectType={handleBatchUpdateEdgeType}
            />
          )}

          {/* Node & Edge Visual Styling Popover (supports single node or multi-select of nodes AND arrows) */}
          {(activeNodePopover === 'style' || activeMultiPopover === 'style') && popoverPos && (
            <NodeStylePopover
              popoverPos={popoverPos}
              currentStyle={
                selectedNodeId
                  ? ast.nodes.get(selectedNodeId)?.style ||
                    getNodeStyle(ast, selectedNodeId)
                  : selectedNodeIds.size > 0
                  ? ast.nodes.get(Array.from(selectedNodeIds)[0])?.style ||
                    getNodeStyle(ast, Array.from(selectedNodeIds)[0])
                  : selectedEdgeIds.size > 0
                  ? ast.edges.find((e) => e.id === Array.from(selectedEdgeIds)[0])?.style ||
                    getEdgeStyle(ast, Array.from(selectedEdgeIds)[0])
                  : undefined
              }
              onApplyPreset={
                isMultiSelect ? handleBatchApplyThemePreset : handleApplyNodePreset
              }
              onUpdateCustomStyle={
                isMultiSelect ? handleBatchUpdateCustomStyle : handleUpdateCustomStyle
              }
              onClearStyle={
                isMultiSelect ? handleBatchClearStyle : handleClearNodeStyle
              }
            />
          )}

          {/* Selected Edge HUD */}
          {selectedEdgePos && selectedEdgeId && !isMultiSelect && (
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
          {activeEdgePopover === 'style' && selectedEdgePos && selectedEdgeId && !isMultiSelect && (
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
