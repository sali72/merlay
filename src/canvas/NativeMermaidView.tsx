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
  createSubgraph,
  deleteSubgraph,
  renameSubgraph,
  moveNodeToSubgraph,
  moveNodesToSubgraph,
  duplicateNodes,
  updateSubgraphStyle,
  clearSubgraphStyle,
  getSubgraphStyle,
} from '../ast/mutations';
import { matchSvgEdgeToAst } from '../utils/edgeMatching';
import { getDistanceToSvgPath } from '../utils/edgeGeometry';
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
import { useHistory } from './useHistory';
import { CanvasTopBar } from './components/CanvasTopBar';
import { SelectionMarquee } from './components/SelectionMarquee';
import { ConnectionLine } from './components/ConnectionLine';
import { ConnectionHandle } from './components/ConnectionHandle';
import { NodeActionHud } from './components/NodeActionHud';
import { MultiSelectHud } from './components/MultiSelectHud';
import { EdgeActionHud } from './components/EdgeActionHud';
import { SubgraphActionHud } from './components/SubgraphActionHud';
import { SubgraphPopover } from './components/SubgraphPopover';
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

  // Undo/Redo History Stack
  const history = useHistory(code);
  // Stable reference to pushState (history object identity changes every render)
  const pushHistoryState = history.pushState;
  const undoHistory = history.undo;
  const redoHistory = history.redo;

  // Clipboard for Copy / Paste
  const clipboardNodesRef = useRef<string[]>([]);

  // Subgraph Selection & Editing State
  const [selectedSubgraphId, setSelectedSubgraphId] = useState<string | null>(null);
  const [selectedSubgraphRect, setSelectedSubgraphRect] = useState<Rect | null>(null);
  const [editingSubgraphId, setEditingSubgraphId] = useState<string | null>(null);
  const [editSubgraphLabel, setEditSubgraphLabel] = useState<string>('');
  const [editingSubgraphPos, setEditingSubgraphPos] = useState<Rect | null>(null);
  const [activeSubgraphPopover, setActiveSubgraphPopover] = useState<'style' | null>(null);
  // Subgraphs with no rendered cluster element (e.g. empty groups mermaid
  // collapses) stay selectable via fallback chips.
  const [unmatchedSubgraphIds, setUnmatchedSubgraphIds] = useState<string[]>([]);

  // Mode & Multi-Selection state
  const [cursorMode, setCursorMode] = useState<CursorMode>('select');
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(new Set());

  // Mirrors of selection state for stable callbacks (avoid render-loop via deps)
  // Declared before helpers so helpers can sync them synchronously.
  const selectedNodeIdsRef = useRef<Set<string>>(new Set());
  const selectedEdgeIdsRef = useRef<Set<string>>(new Set());

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
    const next = id ? new Set([id]) : new Set<string>();
    selectedNodeIdsRef.current = next;
    setSelectedNodeIds(next);
  }, []);

  const setSelectedEdgeId = useCallback((id: string | null) => {
    const next = id ? new Set([id]) : new Set<string>();
    selectedEdgeIdsRef.current = next;
    setSelectedEdgeIds(next);
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
  const zoomRef = useRef<number>(1);
  zoomRef.current = zoom;
  const astRef = useRef(ast);
  astRef.current = ast;
  useEffect(() => {
    selectedNodeIdsRef.current = selectedNodeIds;
  }, [selectedNodeIds]);
  useEffect(() => {
    selectedEdgeIdsRef.current = selectedEdgeIds;
  }, [selectedEdgeIds]);
  // rAF throttle for marquee selection updates
  const marqueeRafRef = useRef<number>(0);
  const pendingMarqueeRef = useRef<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);

  // Exact 1:1 screen-to-world coordinate calculation (stable: reads zoom via ref)
  const getLocalRect = useCallback((el: Element): Rect | null => {
    if (!worldRef.current) return null;
    const z = zoomRef.current;
    const worldRect = worldRef.current.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    return {
      x: (elRect.left - worldRect.left) / z,
      y: (elRect.top - worldRect.top) / z,
      width: elRect.width / z,
      height: elRect.height / z,
    };
  }, []);

  // Mutate AST and serialize to code (stable across selection changes)
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
        pushHistoryState(serialized);
        setCode(serialized);
        setAst(newAst);
        setSyntaxError(null);
        onCodeChange(serialized);
      } catch (err: any) {
        console.error('AST Mutation Error:', err);
      }
    },
    [ast, pushHistoryState, onCodeChange]
  );

  // Update selected node overlay box (for single selected node)
  // Reads selection via ref so it stays stable and never triggers full re-renders.
  const updateSelectedNodeRect = useCallback(() => {
    const ids = selectedNodeIdsRef.current;
    if (ids.size !== 1 || !svgMountRef.current) {
      setSelectedNodeRect(null);
      return;
    }

    const singleId = Array.from(ids)[0];
    const nodeEl = svgMountRef.current.querySelector(
      `[data-mermaid-node-id="${singleId}"]`
    );
    if (nodeEl) {
      const rect = getLocalRect(nodeEl);
      if (rect) setSelectedNodeRect(rect);
    } else {
      setSelectedNodeRect(null);
    }
  }, [getLocalRect]);

  // Update shape-matched SVG selection halo for all currently selected nodes
  // Stable: falls back to refs when no explicit targets are given.
  const updateSelectedNodeHalo = useCallback(
    (targets?: string | null | Set<string> | string[]) => {
      applySelectedNodeHalos(
        svgMountRef.current,
        selectedNodeIdsRef.current,
        targets
      );
    },
    []
  );

  // Update selection styling for all currently selected edges (stable)
  const updateSelectedEdgeHalo = useCallback(
    (targets?: string | null | Set<string> | string[]) => {
      applySelectedEdgeHalos(
        svgMountRef.current,
        selectedEdgeIdsRef.current,
        targets
      );
    },
    []
  );

  const startEditingNode = useCallback(
    (nodeId: string, nodeEl: Element) => {
      setSelectedEdgeIds(new Set());
      selectedEdgeIdsRef.current = new Set();
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
    },
    [ast, getLocalRect, updateSelectedEdgeHalo]
  );

  const handleFinishEditingNode = () => {
    if (editingNodeId) {
      applyAstMutation((a) => {
        updateNodeLabel(a, editingNodeId, editNodeLabel);
      }, editingNodeId);
      setEditingNodeId(null);
      setEditingPos(null);
    }
  };

  const startEditingEdge = useCallback(
    (edgeId: string, anchorEl: Element) => {
      setSelectedNodeIds(new Set());
      selectedNodeIdsRef.current = new Set();
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
    },
    [ast, getLocalRect, updateSelectedEdgeHalo, updateSelectedNodeHalo]
  );

  const handleFinishEditingEdge = () => {
    if (editingEdgeId) {
      applyAstMutation((a) => {
        updateEdgeLabel(a, editingEdgeId, editEdgeLabel);
      });
      setEditingEdgeId(null);
      setEditingEdgePos(null);
    }
  };

  const startEditingSubgraph = useCallback(
    (subId: string, subEl: Element) => {
      setSelectedNodeIds(new Set());
      setSelectedEdgeIds(new Set());
      selectedNodeIdsRef.current = new Set();
      selectedEdgeIdsRef.current = new Set();
      setSelectedNodeRect(null);
      setSelectedEdgePos(null);
      setEditingNodeId(null);
      setEditingEdgeId(null);
      updateSelectedNodeHalo(new Set());
      updateSelectedEdgeHalo(new Set());

      const rect = getLocalRect(subEl);
      if (rect) {
        setEditingSubgraphPos({
          x: rect.x + rect.width / 2 - 80,
          y: rect.y + 10,
          width: Math.max(160, Math.min(240, rect.width - 20)),
          height: 30,
        });
      }
      const subDef = ast.subgraphs.get(subId);
      setEditSubgraphLabel(subDef?.label || subId);
      setEditingSubgraphId(subId);
      setSelectedSubgraphId(subId);
    },
    [ast, getLocalRect, updateSelectedEdgeHalo, updateSelectedNodeHalo]
  );

  const handleFinishEditingSubgraph = () => {
    if (editingSubgraphId) {
      const label = editSubgraphLabel.trim();
      if (label) {
        applyAstMutation((a) => {
          renameSubgraph(a, editingSubgraphId, label);
        });
      }
      setEditingSubgraphId(null);
      setEditingSubgraphPos(null);
    }
  };

  // 2. Attach interactive listeners to SVG elements
  const setupSvgInteractivity = useCallback(() => {
    const mountEl = svgMountRef.current;
    if (!mountEl) return;

    const selectSubgraphByEl = (targetSubId: string, htmlEl: Element) => {
      setSelectedSubgraphId(targetSubId);
      const empty = new Set<string>();
      selectedNodeIdsRef.current = empty;
      selectedEdgeIdsRef.current = new Set<string>();
      setSelectedNodeIds(new Set());
      setSelectedEdgeIds(new Set());
      setSelectedNodeRect(null);
      setSelectedEdgePos(null);
      setActiveNodePopover(null);
      setActiveEdgePopover(null);
      setActiveMultiPopover(null);
      setActiveSubgraphPopover(null);
      updateSelectedNodeHalo(new Set());
      updateSelectedEdgeHalo(new Set());

      mountEl.querySelectorAll('.mermaid-cluster-selected').forEach((c) =>
        c.classList.remove('mermaid-cluster-selected')
      );
      htmlEl.classList.add('mermaid-cluster-selected');

      const rect = getLocalRect(htmlEl);
      if (rect) setSelectedSubgraphRect(rect);
    };

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

      // Empty subgraphs degrade to plain `.node` elements with id
      // `{diagramId}-{subId}` (verified against mermaid 11 render output:
      // zero `.cluster` elements, one `.node`). Claim them as groups here —
      // before the label fallback — so they stay selectable on canvas.
      // Real nodes always match the loop above (their ids contain the
      // `flowchart-` infix), so skip those to avoid misattribution.
      if (!matchedNodeId && idAttr && !idAttr.includes('flowchart-')) {
        for (const subId of ast.subgraphs.keys()) {
          if (idAttr === subId || idAttr.endsWith(`-${subId}`)) {
            htmlEl.setAttribute('data-mermaid-subgraph-id', subId);
            const targetSubId = subId;
            htmlEl.onclick = (e) => {
              e.stopPropagation();
              selectSubgraphByEl(targetSubId, htmlEl);
            };
            htmlEl.ondblclick = (e) => {
              e.stopPropagation();
              startEditingSubgraph(targetSubId, htmlEl);
            };
            // No connection-handle hover: groups are not connectable nodes.
            return;
          }
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
        setSelectedSubgraphId(null);
        setSelectedSubgraphRect(null);
        setActiveSubgraphPopover(null);
        mountEl.querySelectorAll('.mermaid-cluster-selected').forEach((c) =>
          c.classList.remove('mermaid-cluster-selected')
        );

        if (isMulti) {
          const prev = selectedNodeIdsRef.current;
          const next = new Set(prev);
          if (next.has(targetNodeId)) {
            next.delete(targetNodeId);
          } else {
            next.add(targetNodeId);
          }
          selectedNodeIdsRef.current = next;
          setSelectedNodeIds(next);
          updateSelectedNodeHalo(next);
        } else {
          const nextNodes = new Set([targetNodeId]);
          const emptyEdges = new Set<string>();
          selectedNodeIdsRef.current = nextNodes;
          selectedEdgeIdsRef.current = emptyEdges;
          setSelectedNodeIds(nextNodes);
          setSelectedEdgeIds(emptyEdges);
          setSelectedEdgePos(null);
          updateSelectedEdgeHalo(emptyEdges);
          const rect = getLocalRect(htmlEl);
          if (rect) setSelectedNodeRect(rect);
          updateSelectedNodeHalo(nextNodes);
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
      const edgeGroup = el.closest(
        '.edgePath, .edgeLabel, [class*="edgePath"], [class*="edgeLabel"]'
      );
      const id = el.getAttribute('id') || edgeGroup?.getAttribute('id');
      const className = [
        el.getAttribute('class') || '',
        edgeGroup?.getAttribute('class') || '',
      ]
        .filter(Boolean)
        .join(' ');
      const textContent = (el.textContent || edgeGroup?.textContent || '').trim();

      return matchSvgEdgeToAst(
        {
          id,
          className,
          textContent,
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
        !pathEl.classList.contains('arrowheadPath') &&
        !edgePaths.includes(pathEl)
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

      // Create an invisible 10px stroke hit overlay
      const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      hitArea.setAttribute('d', pathEl.getAttribute('d') || '');
      hitArea.setAttribute('class', 'mermaid-edge-hit-area');
      hitArea.setAttribute('data-mermaid-edge-id', targetEdgeId);
      hitArea.setAttribute('fill', 'none');
      hitArea.setAttribute('stroke', 'transparent');
      hitArea.setAttribute('stroke-width', '10');
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

        // Proximity resolution: If multiple edges are near the click, pick the exact closest one
        let resolvedEdge = edgeDef;
        let resolvedPath = pathEl;
        if (e.clientX && e.clientY && edgePaths.length > 1) {
          let closestDist = Infinity;
          for (const p of edgePaths) {
            const dist = getDistanceToSvgPath(p, e.clientX, e.clientY);
            if (dist < closestDist) {
              const edgeId = p.getAttribute('data-mermaid-edge-id');
              const found = ast.edges.find((ed) => ed.id === edgeId);
              if (found) {
                closestDist = dist;
                resolvedEdge = found;
                resolvedPath = p;
              }
            }
          }
        }

        const edgeId = resolvedEdge.id;
        const isMulti = e.shiftKey || e.metaKey || e.ctrlKey;
        setSelectedSubgraphId(null);
        setSelectedSubgraphRect(null);
        setActiveSubgraphPopover(null);
        mountEl.querySelectorAll('.mermaid-cluster-selected').forEach((c) =>
          c.classList.remove('mermaid-cluster-selected')
        );

        if (isMulti) {
          const prev = selectedEdgeIdsRef.current;
          const next = new Set(prev);
          if (next.has(edgeId)) {
            next.delete(edgeId);
          } else {
            next.add(edgeId);
          }
          selectedEdgeIdsRef.current = next;
          setSelectedEdgeIds(next);
          updateSelectedEdgeHalo(next);
        } else {
          const nextEdges = new Set([edgeId]);
          const emptyNodes = new Set<string>();
          selectedEdgeIdsRef.current = nextEdges;
          selectedNodeIdsRef.current = emptyNodes;
          setSelectedEdgeIds(nextEdges);
          setSelectedNodeIds(emptyNodes);
          setSelectedNodeRect(null);
          setEditingNodeId(null);
          updateSelectedNodeHalo(emptyNodes);
          updateSelectedEdgeHalo(nextEdges);

          const rect = getLocalRect(resolvedPath);
          if (rect) {
            setSelectedEdgePos({
              x: rect.x + rect.width / 2,
              y: rect.y + rect.height / 2,
              label: resolvedEdge.label,
              from: resolvedEdge.from,
              to: resolvedEdge.to,
              arrowType: resolvedEdge.arrowType,
            });
          }
        }
      };

      hitArea.onclick = (e) => {
        onEdgeClick(e, targetEdge, hitArea);
      };

      pathEl.onclick = (e) => {
        onEdgeClick(e, targetEdge, pathEl);
      };

      // Hover feedback on edge stroke (O(1): no path sampling here.
      // Proximity resolution is only needed on click, not on every mousemove.)
      hitArea.onmouseenter = () => {
        pathEl.classList.add('mermaid-edge-hovered');
      };

      hitArea.onmousemove = () => {
        if (!pathEl.classList.contains('mermaid-edge-hovered')) {
          mountEl
            .querySelectorAll('.mermaid-edge-hovered')
            .forEach((p) => p.classList.remove('mermaid-edge-hovered'));
          pathEl.classList.add('mermaid-edge-hovered');
        }
      };

      hitArea.onmouseleave = () => {
        pathEl.classList.remove('mermaid-edge-hovered');
      };

      pathEl.onmousemove = hitArea.onmousemove;
      pathEl.onmouseleave = hitArea.onmouseleave;
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

        setSelectedSubgraphId(null);
        setSelectedSubgraphRect(null);
        setActiveSubgraphPopover(null);
        mountEl.querySelectorAll('.mermaid-cluster-selected').forEach((c) =>
          c.classList.remove('mermaid-cluster-selected')
        );

        const isMulti = mouseEv.shiftKey || mouseEv.metaKey || mouseEv.ctrlKey;
        if (isMulti) {
          const prev = selectedEdgeIdsRef.current;
          const next = new Set(prev);
          if (next.has(targetEdgeId)) {
            next.delete(targetEdgeId);
          } else {
            next.add(targetEdgeId);
          }
          selectedEdgeIdsRef.current = next;
          setSelectedEdgeIds(next);
          updateSelectedEdgeHalo(next);
        } else {
          const nextEdges = new Set([targetEdgeId]);
          const emptyNodes = new Set<string>();
          selectedEdgeIdsRef.current = nextEdges;
          selectedNodeIdsRef.current = emptyNodes;
          setSelectedEdgeIds(nextEdges);
          setSelectedNodeIds(emptyNodes);
          setSelectedNodeRect(null);
          setEditingNodeId(null);
          updateSelectedNodeHalo(emptyNodes);
          updateSelectedEdgeHalo(nextEdges);

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

    // D. Setup Subgraph Clusters
    // NOTE: use `.cluster` only (not `[class*="cluster"]`) so inner
    // `.cluster-label` elements don't each get their own click handler.
    // Matching is two-pass: strong signals (id, node containment) first,
    // then duplicate labels are disambiguated by DOM order vs AST order.
    const clusterElements = Array.from(mountEl.querySelectorAll('.cluster'));
    const usedSubIds = new Set<string>();
    const pendingLabelClusters: Element[] = [];

    const selectSubgraph = selectSubgraphByEl;

    const matchByIdOrContainment = (htmlEl: Element): string | null => {
      const idAttr = htmlEl.getAttribute('id') || '';
      if (idAttr) {
        for (const subId of ast.subgraphs.keys()) {
          if (usedSubIds.has(subId)) continue;
          if (
            idAttr.includes(`flowchart-${subId}-`) ||
            idAttr === `flowchart-${subId}` ||
            idAttr.endsWith(`-${subId}`) ||
            idAttr === subId
          ) {
            return subId;
          }
        }
      }
      // NOTE: nodes are siblings of clusters in mermaid output (never nested
      // inside them), so containment below is only a best-effort fallback.
      for (const [subId, subDef] of ast.subgraphs.entries()) {
        if (usedSubIds.has(subId)) continue;
        if (subDef.nodeIds.length === 0) continue;
        for (const nid of subDef.nodeIds) {
          if (htmlEl.querySelector(`[data-mermaid-node-id="${nid}"]`)) {
            return subId;
          }
        }
      }
      return null;
    };

    const unassignedClusters: Element[] = [];
    for (const el of clusterElements) {
      const htmlEl = el as SVGGraphicsElement;
      htmlEl.style.cursor = 'pointer';
      const matched = matchByIdOrContainment(htmlEl);
      if (matched) {
        usedSubIds.add(matched);
        htmlEl.setAttribute('data-mermaid-subgraph-id', matched);
        const targetSubId = matched;
        htmlEl.onclick = (e) => {
          e.stopPropagation();
          selectSubgraph(targetSubId, htmlEl);
        };
        htmlEl.ondblclick = (e) => {
          e.stopPropagation();
          startEditingSubgraph(targetSubId, htmlEl);
        };
      } else {
        unassignedClusters.push(htmlEl);
      }
    }

    // Second pass: label matching disambiguated by order among duplicates.
    // Groups remaining clusters by their rendered label (DOM order) and
    // remaining subgraphs by AST label (insertion order), assigning nth-to-nth.
    const clustersByLabel = new Map<string, Element[]>();
    for (const el of unassignedClusters) {
      const labelText =
        el.querySelector('.label, text, .cluster-label')?.textContent?.trim() ?? '';
      const key = labelText;
      if (!clustersByLabel.has(key)) clustersByLabel.set(key, []);
      clustersByLabel.get(key)!.push(el);
    }
    const subsByLabel = new Map<string, string[]>();
    for (const [subId, subDef] of ast.subgraphs.entries()) {
      if (usedSubIds.has(subId)) continue;
      for (const key of [subDef.label, subId]) {
        if (!subsByLabel.has(key)) subsByLabel.set(key, []);
        subsByLabel.get(key)!.push(subId);
      }
    }
    for (const el of unassignedClusters) {
      const htmlEl = el as SVGGraphicsElement;
      if (htmlEl.hasAttribute('data-mermaid-subgraph-id')) continue;
      const labelText =
        htmlEl.querySelector('.label, text, .cluster-label')?.textContent?.trim() ?? '';
      const clusterQueue = clustersByLabel.get(labelText) ?? [];
      const subQueue = subsByLabel.get(labelText) ?? [];
      if (subQueue.length === 0) {
        pendingLabelClusters.push(htmlEl);
        continue;
      }
      const idx = clusterQueue.indexOf(el);
      const targetSubId = subQueue[Math.min(idx, subQueue.length - 1)];
      if (usedSubIds.has(targetSubId)) continue;
      usedSubIds.add(targetSubId);
      // Remove from queue so duplicates assign in order
      const qIdx = subQueue.indexOf(targetSubId);
      if (qIdx !== -1) subQueue.splice(qIdx, 1);
      htmlEl.setAttribute('data-mermaid-subgraph-id', targetSubId);
      htmlEl.onclick = (e) => {
        e.stopPropagation();
        selectSubgraph(targetSubId, htmlEl);
      };
      htmlEl.ondblclick = (e) => {
        e.stopPropagation();
        startEditingSubgraph(targetSubId, htmlEl);
      };
    }
    for (const el of pendingLabelClusters) {
      const htmlEl = el as SVGGraphicsElement;
      if (!htmlEl.onclick) {
        htmlEl.style.cursor = 'default';
      }
    }
  }, [
    ast,
    getLocalRect,
    updateSelectedNodeHalo,
    updateSelectedEdgeHalo,
    setSelectedNodeId,
    setSelectedEdgeId,
    setSelectedSubgraphId,
    setSelectedSubgraphRect,
    startEditingNode,
    startEditingEdge,
    startEditingSubgraph,
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

  // Action Handlers
  const handleBatchDeleteSelected = useCallback(() => {
    if (selectedSubgraphId) {
      applyAstMutation((a) => {
        deleteSubgraph(a, selectedSubgraphId, false);
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
    selectedNodeIdsRef.current = empty;
    selectedEdgeIdsRef.current = new Set<string>();
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
  }, [
    selectedSubgraphId,
    selectedNodeIds,
    selectedEdgeIds,
    updateSelectedNodeHalo,
    updateSelectedEdgeHalo,
    applyAstMutation,
  ]);

  const handleUndo = useCallback(() => {
    const prevCode = undoHistory();
    if (prevCode !== null) {
      try {
        const parsed = parseMermaidFlowchart(prevCode);
        setCode(prevCode);
        setAst(parsed);
        setSyntaxError(null);
        onCodeChange(prevCode);
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
        setEditingNodeId(null);
        setEditingEdgeId(null);
        setEditingSubgraphId(null);
      } catch (err) {
        console.error('Failed to parse undo state:', err);
      }
    }
  }, [undoHistory, onCodeChange]);

  const handleRedo = useCallback(() => {
    const nextCode = redoHistory();
    if (nextCode !== null) {
      try {
        const parsed = parseMermaidFlowchart(nextCode);
        setCode(nextCode);
        setAst(parsed);
        setSyntaxError(null);
        onCodeChange(nextCode);
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
        setEditingNodeId(null);
        setEditingEdgeId(null);
        setEditingSubgraphId(null);
      } catch (err) {
        console.error('Failed to parse redo state:', err);
      }
    }
  }, [redoHistory, onCodeChange]);

  const handleSelectAll = useCallback(() => {
    const allNodeIds = new Set(ast.nodes.keys());
    const allEdgeIds = new Set(ast.edges.map((e) => e.id));
    selectedNodeIdsRef.current = allNodeIds;
    selectedEdgeIdsRef.current = allEdgeIds;
    setSelectedNodeIds(allNodeIds);
    setSelectedEdgeIds(allEdgeIds);
    setSelectedSubgraphId(null);
    setSelectedNodeRect(null);
    setSelectedEdgePos(null);
    setSelectedSubgraphRect(null);
    setActiveSubgraphPopover(null);
    updateSelectedNodeHalo(allNodeIds);
    updateSelectedEdgeHalo(allEdgeIds);
  }, [ast, updateSelectedNodeHalo, updateSelectedEdgeHalo]);

  const handleDuplicateSelected = useCallback(() => {
    if (selectedNodeIds.size === 0) return;
    applyAstMutation((currentAst) => {
      const result = duplicateNodes(currentAst, selectedNodeIds);
      if (result.nodeIds.length > 0) {
        const newSet = new Set(result.nodeIds);
        const newEdges = new Set(result.edgeIds);
        selectedNodeIdsRef.current = newSet;
        selectedEdgeIdsRef.current = newEdges;
        setSelectedNodeIds(newSet);
        setSelectedEdgeIds(newEdges);
        updateSelectedNodeHalo(newSet);
        updateSelectedEdgeHalo(newEdges);
      }
    });
  }, [selectedNodeIds, applyAstMutation, updateSelectedNodeHalo, updateSelectedEdgeHalo]);

  const handleCopySelected = useCallback(() => {
    if (selectedNodeIds.size > 0) {
      clipboardNodesRef.current = Array.from(selectedNodeIds);
    }
  }, [selectedNodeIds]);

  const handlePasteSelected = useCallback(() => {
    if (clipboardNodesRef.current.length === 0) return;
    applyAstMutation((currentAst) => {
      const result = duplicateNodes(currentAst, clipboardNodesRef.current);
      if (result.nodeIds.length > 0) {
        const newSet = new Set(result.nodeIds);
        const newEdges = new Set(result.edgeIds);
        selectedNodeIdsRef.current = newSet;
        selectedEdgeIdsRef.current = newEdges;
        setSelectedNodeIds(newSet);
        setSelectedEdgeIds(newEdges);
        updateSelectedNodeHalo(newSet);
        updateSelectedEdgeHalo(newEdges);
      }
    });
  }, [applyAstMutation, updateSelectedNodeHalo, updateSelectedEdgeHalo]);

  const handleAddGroup = useCallback(() => {
    applyAstMutation((currentAst) => {
      const newNodeId = addNode(currentAst, 'Step 1');
      createSubgraph(currentAst, 'New Group', [newNodeId]);
    });
  }, [applyAstMutation]);

  const handleApplySubgraphPreset = useCallback(
    (preset: ThemePreset) => {
      if (!selectedSubgraphId) return;
      const target = selectedSubgraphId;
      applyAstMutation((a) => {
        if (!preset.fill && !preset.stroke && !preset.color) {
          clearSubgraphStyle(a, target);
        } else {
          const styles: Record<string, string> = {};
          if (preset.fill) styles['fill'] = preset.fill;
          if (preset.stroke) styles['stroke'] = preset.stroke;
          if (preset.color) styles['color'] = preset.color;
          updateSubgraphStyle(a, target, styles);
        }
      });
    },
    [selectedSubgraphId, applyAstMutation]
  );

  const handleUpdateSubgraphCustomStyle = useCallback(
    (property: string, value: string) => {
      if (!selectedSubgraphId) return;
      const target = selectedSubgraphId;
      applyAstMutation((a) => {
        const current = getSubgraphStyle(a, target) || {};
        const updated = { ...current };
        if (value) {
          updated[property] = value;
        } else {
          delete updated[property];
        }
        updateSubgraphStyle(a, target, updated);
      });
    },
    [selectedSubgraphId, applyAstMutation]
  );

  const handleClearSubgraphStyle = useCallback(() => {
    if (!selectedSubgraphId) return;
    const target = selectedSubgraphId;
    applyAstMutation((a) => {
      clearSubgraphStyle(a, target);
    });
  }, [selectedSubgraphId, applyAstMutation]);

  const selectUnmatchedSubgraph = useCallback(
    (subId: string, index: number) => {
      setSelectedSubgraphId(subId);
      const empty = new Set<string>();
      selectedNodeIdsRef.current = empty;
      selectedEdgeIdsRef.current = new Set<string>();
      setSelectedNodeIds(new Set());
      setSelectedEdgeIds(new Set());
      setSelectedNodeRect(null);
      setSelectedEdgePos(null);
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
      // Synthetic rect below the fallback chip row so the HUD has an anchor.
      setSelectedSubgraphRect({ x: 24, y: 52 + index * 4, width: 200, height: 30 });
    },
    [updateSelectedEdgeHalo, updateSelectedNodeHalo]
  );

  // Global Keyboard Shortcuts
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
      if ((e.key === 'v' || e.key === 'V') && !isInputActive && !e.ctrlKey && !e.metaKey) {
        setCursorMode('select');
        return;
      }

      // Hotkey H: Hand Mode
      if ((e.key === 'h' || e.key === 'H') && !isInputActive && !e.ctrlKey && !e.metaKey) {
        setCursorMode('hand');
        return;
      }

      // Hotkey Ctrl+Z (Undo)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z') && !isInputActive) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Hotkey Ctrl+Shift+Z or Ctrl+Y (Redo)
      if (
        (e.ctrlKey || e.metaKey) &&
        ((e.shiftKey && (e.key === 'z' || e.key === 'Z')) || e.key === 'y' || e.key === 'Y') &&
        !isInputActive
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Hotkey Ctrl+A (Select All)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A') && !isInputActive) {
        e.preventDefault();
        handleSelectAll();
        return;
      }

      // Hotkey Ctrl+D (Duplicate Selected)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D') && !isInputActive) {
        e.preventDefault();
        handleDuplicateSelected();
        return;
      }

      // Hotkey Ctrl+C (Copy Selected)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C') && !isInputActive) {
        if (selectedNodeIds.size > 0) {
          e.preventDefault();
          handleCopySelected();
          return;
        }
      }

      // Hotkey Ctrl+V (Paste Selected)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V') && !isInputActive) {
        if (clipboardNodesRef.current.length > 0) {
          e.preventDefault();
          handlePasteSelected();
          return;
        }
      }

      // Escape: Dismiss popovers and clear selection
      if (e.key === 'Escape') {
        if (activeNodePopover || activeEdgePopover || activeMultiPopover || activeSubgraphPopover) {
          setActiveNodePopover(null);
          setActiveEdgePopover(null);
          setActiveMultiPopover(null);
          setActiveSubgraphPopover(null);
        } else if (selectedNodeIds.size > 0 || selectedEdgeIds.size > 0 || selectedSubgraphId) {
          selectedNodeIdsRef.current = new Set();
          selectedEdgeIdsRef.current = new Set();
          setSelectedNodeIds(new Set());
          setSelectedEdgeIds(new Set());
          setSelectedSubgraphId(null);
          setSelectedNodeRect(null);
          setSelectedEdgePos(null);
          setSelectedSubgraphRect(null);
          setActiveSubgraphPopover(null);
          updateSelectedNodeHalo(new Set());
          updateSelectedEdgeHalo(new Set());
          if (svgMountRef.current) {
            svgMountRef.current
              .querySelectorAll('.mermaid-cluster-selected')
              .forEach((c) => c.classList.remove('mermaid-cluster-selected'));
          }
        }
        return;
      }

      // Delete / Backspace: Delete selected elements
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputActive) {
        if (selectedSubgraphId || selectedNodeIds.size > 0 || selectedEdgeIds.size > 0) {
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
    activeSubgraphPopover,
    selectedNodeIds,
    selectedEdgeIds,
    selectedSubgraphId,
    updateSelectedNodeHalo,
    updateSelectedEdgeHalo,
    handleBatchDeleteSelected,
    handleUndo,
    handleRedo,
    handleSelectAll,
    handleDuplicateSelected,
    handleCopySelected,
    handlePasteSelected,
  ]);

  // Latest-callback refs so the render effect only depends on code/app.
  // Without this, selection changes recreate setup/halo callbacks and would
  // trigger a full (expensive, async) mermaid re-render that wipes the DOM
  // mid-interaction — breaking single-select and freezing multi-select.
  const setupRef = useRef(setupSvgInteractivity);
  setupRef.current = setupSvgInteractivity;
  const stabilizeRef = useRef(stabilizeCamera);
  stabilizeRef.current = stabilizeCamera;
  const rectRef = useRef(updateSelectedNodeRect);
  rectRef.current = updateSelectedNodeRect;
  const haloNodeRef = useRef(updateSelectedNodeHalo);
  haloNodeRef.current = updateSelectedNodeHalo;
  const haloEdgeRef = useRef(updateSelectedEdgeHalo);
  haloEdgeRef.current = updateSelectedEdgeHalo;

  // 1. Render Obsidian's native Mermaid SVG with direct engine and double buffering
  // NOTE: deps are intentionally [code, app] only. Selection/zoom/pan must NOT
  // trigger a full re-render; they are handled by the lightweight halo effect above.
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

        setupRef.current();
        stabilizeRef.current();
        rectRef.current();
        haloNodeRef.current();
        haloEdgeRef.current();

        // Track subgraphs with no rendered cluster element so they stay
        // selectable via fallback chips (covers empty groups mermaid may
        // collapse, plus any matcher misses).
        try {
          const rendered = new Set<string>();
          mountEl
            .querySelectorAll('[data-mermaid-subgraph-id]')
            .forEach((el) => {
              const id = el.getAttribute('data-mermaid-subgraph-id');
              if (id) rendered.add(id);
            });
          const missing: string[] = [];
          for (const subId of astRef.current.subgraphs.keys()) {
            if (!rendered.has(subId)) missing.push(subId);
          }
          setUnmatchedSubgraphIds((prev) => {
            if (prev.length === missing.length && prev.every((id) => missing.includes(id))) {
              return prev;
            }
            return missing;
          });
        } catch {
          /* ignore */
        }
      })
      .catch((err) => {
        if (ticket !== renderTicketRef.current) return;
        console.error('Mermaid render error:', err);
        setSyntaxError(err?.message || 'Diagram syntax error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, app]);

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
              delete updated[property];
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

    // Marquee Drag Selection update (rAF-throttled; skips redundant setState)
    if (dragBoxStartRef.current && worldRef.current) {
      const worldRect = worldRef.current.getBoundingClientRect();
      const z = zoomRef.current;
      const currentX = (e.clientX - worldRect.left) / z;
      const currentY = (e.clientY - worldRect.top) / z;
      const startX = dragBoxStartRef.current.x;
      const startY = dragBoxStartRef.current.y;

      const dist = Math.hypot(currentX - startX, currentY - startY);
      if (dist > 3) {
        isMarqueeActiveRef.current = true;
        setSelectionBox({ startX, startY, currentX, currentY });
        pendingMarqueeRef.current = { startX, startY, currentX, currentY };

        if (marqueeRafRef.current) return;
        marqueeRafRef.current = requestAnimationFrame(() => {
          marqueeRafRef.current = 0;
          const pending = pendingMarqueeRef.current;
          pendingMarqueeRef.current = null;
          if (!pending || !svgMountRef.current) return;
          const { startX: sx, startY: sy, currentX: cx, currentY: cy } = pending;
          // Re-read latest pointer via stored box? Use last selectionBox instead.
          // Fallback: compute from current box state is handled by closure below.
          const minX = Math.min(sx, cx);
          const maxX = Math.max(sx, cx);
          const minY = Math.min(sy, cy);
          const maxY = Math.max(sy, cy);

          const newSelectedNodes = new Set<string>();
          const newSelectedEdges = new Set<string>();
          const mount = svgMountRef.current;
          if (mount) {
            // 1. Check nodes
            for (const nodeId of ast.nodes.keys()) {
              const nodeEl = mount.querySelector(
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
              const edgePathEl = mount.querySelector(
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
          const sameSets = (a: Set<string>, b: Set<string>) => {
            if (a.size !== b.size) return false;
            for (const v of a) if (!b.has(v)) return false;
            return true;
          };
          if (!sameSets(newSelectedNodes, selectedNodeIdsRef.current)) {
            selectedNodeIdsRef.current = newSelectedNodes;
            setSelectedNodeIds(newSelectedNodes);
            updateSelectedNodeHalo(newSelectedNodes);
          }
          if (!sameSets(newSelectedEdges, selectedEdgeIdsRef.current)) {
            selectedEdgeIdsRef.current = newSelectedEdges;
            setSelectedEdgeIds(newSelectedEdges);
            updateSelectedEdgeHalo(newSelectedEdges);
          }
        });
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
      if (marqueeRafRef.current) {
        cancelAnimationFrame(marqueeRafRef.current);
        marqueeRafRef.current = 0;
      }
      // Flush any pending marquee selection so mouse-up state is exact
      const pending = pendingMarqueeRef.current;
      pendingMarqueeRef.current = null;
      if (pending && svgMountRef.current) {
        const minX = Math.min(pending.startX, pending.currentX);
        const maxX = Math.max(pending.startX, pending.currentX);
        const minY = Math.min(pending.startY, pending.currentY);
        const maxY = Math.max(pending.startY, pending.currentY);
        const newSelectedNodes = new Set<string>();
        const newSelectedEdges = new Set<string>();
        for (const nodeId of ast.nodes.keys()) {
          const nodeEl = svgMountRef.current.querySelector(
            `[data-mermaid-node-id="${nodeId}"]`
          );
          if (nodeEl) {
            const rect = getLocalRect(nodeEl);
            if (
              rect &&
              !(rect.x + rect.width < minX || rect.x > maxX || rect.y + rect.height < minY || rect.y > maxY)
            ) {
              newSelectedNodes.add(nodeId);
            }
          }
        }
        for (const edge of ast.edges) {
          const edgePathEl = svgMountRef.current.querySelector(
            `path[data-mermaid-edge-id="${edge.id}"]:not(.mermaid-edge-hit-area)`
          );
          if (edgePathEl) {
            const rect = getLocalRect(edgePathEl);
            if (
              rect &&
              !(rect.x + rect.width < minX || rect.x > maxX || rect.y + rect.height < minY || rect.y > maxY)
            ) {
              newSelectedEdges.add(edge.id);
            }
          }
        }
        selectedNodeIdsRef.current = newSelectedNodes;
        selectedEdgeIdsRef.current = newSelectedEdges;
        setSelectedNodeIds(newSelectedNodes);
        setSelectedEdgeIds(newSelectedEdges);
        updateSelectedNodeHalo(newSelectedNodes);
        updateSelectedEdgeHalo(newSelectedEdges);
      }
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

  // Position for the subgraph style popover (anchored above the group HUD)
  const subgraphPopoverPos: PopoverPos | null = useMemo(() => {
    if (!selectedSubgraphRect || !selectedSubgraphId) return null;
    return {
      left: selectedSubgraphRect.x + selectedSubgraphRect.width / 2,
      top: selectedSubgraphRect.y - 20,
      transform: 'translate(-50%, -100%)',
    };
  }, [selectedSubgraphRect, selectedSubgraphId]);

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
        selectedNodeIdsRef.current = new Set();
        selectedEdgeIdsRef.current = new Set();
        setSelectedNodeIds(new Set());
        setSelectedEdgeIds(new Set());
        setSelectedSubgraphId(null);
        setSelectedNodeRect(null);
        setSelectedEdgePos(null);
        setSelectedSubgraphRect(null);
        setEditingNodeId(null);
        setEditingEdgeId(null);
        setEditingSubgraphId(null);
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
      }}
    >
      {/* Top Controls Bar */}
      <CanvasTopBar
        cursorMode={cursorMode}
        onSetCursorMode={setCursorMode}
        onAddStep={handleAddStandaloneStep}
        onAddGroup={handleAddGroup}
        direction={ast.direction}
        onToggleDirection={handleToggleDirection}
        onFitView={handleFitView}
        showCodeDrawer={showCodeDrawer}
        onToggleCodeDrawer={() => setShowCodeDrawer(!showCodeDrawer)}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
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
              onGroupSelected={() => {
                applyAstMutation((currentAst) => {
                  createSubgraph(currentAst, 'New Group', selectedNodeIds);
                });
              }}
              canUngroup={Array.from(selectedNodeIds).some(
                (nid) => !!ast.nodes.get(nid)?.subgraphId
              )}
              onUngroupSelected={() => {
                applyAstMutation((currentAst) => {
                  moveNodesToSubgraph(currentAst, selectedNodeIds, null);
                });
              }}
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

          {/* Subgraph Floating Action HUD */}
          {selectedSubgraphRect && selectedSubgraphId && ast.subgraphs.has(selectedSubgraphId) && !isMultiSelect && (
            <SubgraphActionHud
              subgraph={ast.subgraphs.get(selectedSubgraphId)!}
              centerX={selectedSubgraphRect.x + selectedSubgraphRect.width / 2}
              topY={selectedSubgraphRect.y}
              currentStyle={
                ast.subgraphs.get(selectedSubgraphId)?.style ||
                getSubgraphStyle(ast, selectedSubgraphId)
              }
              isStyleActive={activeSubgraphPopover === 'style'}
              onToggleStyle={() =>
                setActiveSubgraphPopover((prev) => (prev === 'style' ? null : 'style'))
              }
              onRename={() => {
                const subEl = svgMountRef.current?.querySelector(
                  `[data-mermaid-subgraph-id="${selectedSubgraphId}"]`
                );
                if (subEl) {
                  startEditingSubgraph(selectedSubgraphId, subEl);
                } else if (selectedSubgraphRect) {
                  // Fallback for groups with no rendered cluster element
                  // (e.g. empty groups mermaid collapses): anchor the inline
                  // editor to the HUD rect instead of an SVG element.
                  const rect = selectedSubgraphRect;
                  setEditingSubgraphPos({
                    x: rect.x + rect.width / 2 - 80,
                    y: rect.y + 10,
                    width: Math.max(160, Math.min(240, rect.width - 20)),
                    height: 30,
                  });
                  const subDef = ast.subgraphs.get(selectedSubgraphId);
                  setEditSubgraphLabel(subDef?.label || selectedSubgraphId);
                  setEditingSubgraphId(selectedSubgraphId);
                }
              }}
              onDissolve={() => {
                applyAstMutation((currentAst) => {
                  deleteSubgraph(currentAst, selectedSubgraphId, false);
                });
                setSelectedSubgraphId(null);
                setSelectedSubgraphRect(null);
                setActiveSubgraphPopover(null);
              }}
              onDeleteAll={() => {
                applyAstMutation((currentAst) => {
                  deleteSubgraph(currentAst, selectedSubgraphId, true);
                });
                setSelectedSubgraphId(null);
                setSelectedSubgraphRect(null);
                setActiveSubgraphPopover(null);
              }}
            />
          )}

          {/* Subgraph Style Popover (same presets as nodes, emitted as style <subId>) */}
          {activeSubgraphPopover === 'style' && subgraphPopoverPos && selectedSubgraphId && ast.subgraphs.has(selectedSubgraphId) && !isMultiSelect && (
            <NodeStylePopover
              popoverPos={subgraphPopoverPos}
              currentStyle={
                ast.subgraphs.get(selectedSubgraphId)?.style ||
                getSubgraphStyle(ast, selectedSubgraphId)
              }
              onApplyPreset={handleApplySubgraphPreset}
              onUpdateCustomStyle={handleUpdateSubgraphCustomStyle}
              onClearStyle={handleClearSubgraphStyle}
            />
          )}

          {/* Fallback chips for groups with no rendered cluster element */}
          {unmatchedSubgraphIds.length > 0 && (
            <div
              className="mermaid-group-fallback-bar nodrag"
              style={{
                position: 'absolute',
                left: 12,
                top: 12,
                display: 'flex',
                gap: 6,
                zIndex: 120,
                maxWidth: '70%',
                flexWrap: 'wrap',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {unmatchedSubgraphIds.map((subId, idx) => {
                const sub = ast.subgraphs.get(subId);
                if (!sub) return null;
                const isActive = selectedSubgraphId === subId;
                return (
                  <button
                    key={subId}
                    type="button"
                    className={`mermaid-subgraph-badge ${isActive ? 'is-selected' : ''}`}
                    style={isActive ? { outline: '2px solid var(--mermaid-accent)' } : undefined}
                    title={
                      sub.nodeIds.length === 0
                        ? `Empty group "${sub.label}" — click to select`
                        : `Group "${sub.label}" — click to select`
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      selectUnmatchedSubgraph(subId, idx);
                    }}
                  >
                    <span>{sub.label || subId}</span>
                    {sub.nodeIds.length === 0 && <span> (empty)</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Subgraph Membership Popover */}
          {activeNodePopover === 'subgraph' && popoverPos && selectedNodeId && (
            <div
              style={{
                position: 'absolute',
                left: popoverPos.left,
                top: popoverPos.top,
                transform: popoverPos.transform,
                zIndex: 200,
              }}
            >
              <SubgraphPopover
                currentSubgraphId={ast.nodes.get(selectedNodeId)?.subgraphId}
                subgraphs={Array.from(ast.subgraphs.values())}
                onSelectSubgraph={(subId) => {
                  applyAstMutation((currentAst) => {
                    moveNodeToSubgraph(currentAst, selectedNodeId, subId);
                  }, selectedNodeId);
                  setActiveNodePopover(null);
                }}
                onCreateNewGroup={() => {
                  applyAstMutation((currentAst) => {
                    createSubgraph(currentAst, 'New Group', [selectedNodeId]);
                  }, selectedNodeId);
                  setActiveNodePopover(null);
                }}
                onClose={() => setActiveNodePopover(null)}
              />
            </div>
          )}

          {/* Inline Subgraph Label Editor Overlay */}
          {editingSubgraphId && editingSubgraphPos && (
            <input
              autoFocus
              className="mermaid-inline-node-input nodrag"
              style={{
                position: 'absolute',
                left: editingSubgraphPos.x,
                top: editingSubgraphPos.y,
                width: editingSubgraphPos.width,
                height: editingSubgraphPos.height,
                zIndex: 220,
              }}
              value={editSubgraphLabel}
              onChange={(e) => setEditSubgraphLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFinishEditingSubgraph();
                if (e.key === 'Escape') {
                  setEditingSubgraphId(null);
                  setEditingSubgraphPos(null);
                }
              }}
              onBlur={handleFinishEditingSubgraph}
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
