/**
 * Native Mermaid View with Direct Structural Manipulation Overlay
 * Renders Obsidian's exact native Mermaid SVG (100% parity, zero layout simulation)
 * with direct-manipulation node sprouting, drag-to-connect, inline label editing, and camera stabilization.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { App, MarkdownRenderer, Component, loadMermaid } from 'obsidian';
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
  insertNodeBetween,
  insertNodeOnEdge,
  reverseEdgeDirection,
  setDiagramDirection,
  updateEdgeLabel,
  updateEdgeType,
  updateNodeLabel,
  updateNodeShape,
  updateNodeStyle,
  clearNodeStyle,
  getNodeStyle,
} from '../ast/mutations';
import { matchSvgEdgeToAst } from '../utils/edgeMatching';
import {
  ArrowBidirectionalIcon,
  ArrowDottedIcon,
  ArrowOpenIcon,
  ArrowSolidIcon,
  ArrowThickIcon,
  CheckIcon,
  CloseIcon,
  CodeIcon,
  FitViewIcon,
  InsertStepIcon,
  PaletteIcon,
  PencilIcon,
  PlusIcon,
  ReverseIcon,
  ShapesIcon,
  ShapeIcons,
  TrashIcon,
} from './icons/Icons';

let cachedMermaidApi: any = null;

async function getMermaidApi(): Promise<any> {
  if (cachedMermaidApi) return cachedMermaidApi;
  if (typeof window !== 'undefined' && (window as any).mermaid) {
    cachedMermaidApi = (window as any).mermaid;
    return cachedMermaidApi;
  }
  try {
    cachedMermaidApi = await loadMermaid();
    return cachedMermaidApi;
  } catch (err) {
    console.warn(
      'Visual Mermaid: Direct loadMermaid not available, fallback to MarkdownRenderer',
      err
    );
    return null;
  }
}

let renderSeq = 0;

async function renderMermaidSvg(app: App, code: string): Promise<string> {
  const mermaidApi = await getMermaidApi();
  if (mermaidApi && typeof mermaidApi.render === 'function') {
    const id = `vmm_${Date.now()}_${++renderSeq}`;
    const scratch = document.body.createDiv('mermaid');
    scratch.style.position = 'absolute';
    scratch.style.visibility = 'hidden';
    scratch.style.top = '-9999px';
    scratch.style.left = '-9999px';
    scratch.style.width = '1200px';

    try {
      const res = await mermaidApi.render(id, code, scratch);
      scratch.remove();
      return typeof res === 'string' ? res : res.svg;
    } catch (err) {
      scratch.remove();
      throw err;
    }
  }

  // Fallback to MarkdownRenderer if direct API is unavailable
  const tempContainer = document.createElement('div');
  const comp = new Component();
  comp.load();
  await MarkdownRenderer.render(
    app,
    `\`\`\`mermaid\n${code}\n\`\`\``,
    tempContainer,
    '',
    comp
  );
  comp.unload();
  return tempContainer.innerHTML;
}

const SHAPE_OPTIONS: Array<{ type: MermaidShapeType; label: string }> = [
  { type: 'rectangle', label: 'Rectangle [ ]' },
  { type: 'rounded', label: 'Rounded ( )' },
  { type: 'stadium', label: 'Stadium ([ ])' },
  { type: 'subroutine', label: 'Subroutine [[ ]]' },
  { type: 'cylinder', label: 'Database [( )]' },
  { type: 'circle', label: 'Circle (( ))' },
  { type: 'double_circle', label: 'Double Circle ((( )))' },
  { type: 'diamond', label: 'Decision { }' },
  { type: 'hexagon', label: 'Hexagon {{ }}' },
  { type: 'parallelogram', label: 'Parallelogram [/ /]' },
  { type: 'parallelogram_alt', label: 'Parallelogram [\\ \\]' },
  { type: 'trapezoid', label: 'Trapezoid [/ \\]' },
  { type: 'trapezoid_alt', label: 'Inv. Trapezoid [\\ /]' },
  { type: 'asymmetric', label: 'Banner > ]' },
];

const THEME_PRESETS = [
  {
    name: 'Default',
    fill: '',
    stroke: '',
    color: '',
    bgPreview: 'transparent',
    borderPreview: 'var(--mermaid-border)',
  },
  {
    name: 'Emerald (Success)',
    fill: '#d1fae5',
    stroke: '#059669',
    color: '#065f46',
    bgPreview: '#10b981',
    borderPreview: '#047857',
  },
  {
    name: 'Sky (Process)',
    fill: '#e0f2fe',
    stroke: '#0284c7',
    color: '#0369a1',
    bgPreview: '#38bdf8',
    borderPreview: '#0284c7',
  },
  {
    name: 'Violet (Special)',
    fill: '#ede9fe',
    stroke: '#7c3aed',
    color: '#5b21b6',
    bgPreview: '#8b5cf6',
    borderPreview: '#6d28d9',
  },
  {
    name: 'Amber (Warning)',
    fill: '#fef3c7',
    stroke: '#d97706',
    color: '#92400e',
    bgPreview: '#f59e0b',
    borderPreview: '#d97706',
  },
  {
    name: 'Rose (Danger)',
    fill: '#ffe4e6',
    stroke: '#e11d48',
    color: '#9f1239',
    bgPreview: '#f43f5e',
    borderPreview: '#e11d48',
  },
  {
    name: 'Teal (Cloud)',
    fill: '#ccfbf1',
    stroke: '#0d9488',
    color: '#115e59',
    bgPreview: '#14b8a6',
    borderPreview: '#0f766e',
  },
  {
    name: 'Slate (System)',
    fill: '#334155',
    stroke: '#0f172a',
    color: '#f8fafc',
    bgPreview: '#475569',
    borderPreview: '#1e293b',
  },
];

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
  const [activeNodePopover, setActiveNodePopover] = useState<'shape' | 'style' | null>(null);

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
    from: string;
    to: string;
    arrowType: ArrowType;
  } | null>(null);

  // Inline edge caption editing state
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [editEdgeLabel, setEditEdgeLabel] = useState<string>('');
  const [editingEdgePos, setEditingEdgePos] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
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
  const renderTicketRef = useRef<number>(0);

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
  }, [ast, getLocalRect, zoom]);

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

  // Dismiss popovers and selection on Escape
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeNodePopover) {
          setActiveNodePopover(null);
        } else if (selectedNodeId || selectedEdgeId) {
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeNodePopover, selectedNodeId, selectedEdgeId]);

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
      })
      .catch((err) => {
        if (ticket !== renderTicketRef.current) return;
        console.error('Mermaid render error:', err);
        setSyntaxError(err?.message || 'Diagram syntax error');
      });
  }, [code, app, setupSvgInteractivity, stabilizeCamera, updateSelectedNodeRect]);

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
    setActiveNodePopover(null);
    applyAstMutation((a) => {
      deleteNode(a, targetId);
    });
  };

  const handleUpdateNodeShape = (nodeId: string, shape: MermaidShapeType) => {
    applyAstMutation((a) => {
      updateNodeShape(a, nodeId, shape);
    }, nodeId);
    setActiveNodePopover(null);
  };

  const handleApplyNodePreset = (
    nodeId: string,
    preset: { fill: string; stroke: string; color: string }
  ) => {
    applyAstMutation((a) => {
      if (!preset.fill && !preset.stroke && !preset.color) {
        clearNodeStyle(a, nodeId);
      } else {
        const styles: Record<string, string> = {};
        if (preset.fill) styles['fill'] = preset.fill;
        if (preset.stroke) styles['stroke'] = preset.stroke;
        if (preset.color) styles['color'] = preset.color;
        updateNodeStyle(a, nodeId, styles);
      }
    }, nodeId);
  };

  const handleUpdateCustomStyle = (
    nodeId: string,
    property: string,
    value: string
  ) => {
    applyAstMutation((a) => {
      const current = getNodeStyle(a, nodeId) || {};
      const updated = { ...current };
      if (value) {
        updated[property] = value;
      } else {
        delete updated[property];
      }
      updateNodeStyle(a, nodeId, updated);
    }, nodeId);
  };

  const handleClearNodeStyle = (nodeId: string) => {
    applyAstMutation((a) => {
      clearNodeStyle(a, nodeId);
    }, nodeId);
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

    // Proximity-based smooth hover clearance (avoids rapid mount/unmount flapping)
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

    if (connectingSourceId) {
      const targetEl = (e.target as HTMLElement).closest(
        '[data-mermaid-node-id]'
      ) as HTMLElement | null;
      const targetNodeId = targetEl?.getAttribute('data-mermaid-node-id');

      const targetEdgeEl = (e.target as HTMLElement).closest(
        '[data-mermaid-edge-id]'
      ) as HTMLElement | null;
      const targetEdgeId = targetEdgeEl?.getAttribute('data-mermaid-edge-id');

      if (targetNodeId && targetNodeId !== connectingSourceId) {
        // Dragging to another node simply creates a directed arrow (Mermaid allows multiple arrows)
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

  return (
    <div
      className="mermaid-native-editor-root"
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
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setSelectedEdgePos(null);
        setEditingNodeId(null);
        setEditingEdgeId(null);
        setActiveNodePopover(null);
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
        <div className="mermaid-native-svg-mount mermaid" ref={svgMountRef} />

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

          {/* Node Connection Handle (Downstream anchor dot) */}
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

                {/* Shape Picker Button */}
                <button
                  type="button"
                  className={`mermaid-hud-btn icon-only ${
                    activeNodePopover === 'shape' ? 'is-active' : ''
                  }`}
                  onClick={() =>
                    setActiveNodePopover((prev) => (prev === 'shape' ? null : 'shape'))
                  }
                  title="Change Shape"
                >
                  {(() => {
                    const currentNode = ast.nodes.get(selectedNodeId);
                    const ShapeComp =
                      currentNode && ShapeIcons[currentNode.shape as keyof typeof ShapeIcons]
                        ? ShapeIcons[currentNode.shape as keyof typeof ShapeIcons]
                        : ShapeIcons.rectangle;
                    return <ShapeComp size={14} />;
                  })()}
                </button>

                {/* Visual Style & Color Button */}
                <button
                  type="button"
                  className={`mermaid-hud-btn icon-only ${
                    activeNodePopover === 'style' ? 'is-active' : ''
                  }`}
                  onClick={() =>
                    setActiveNodePopover((prev) => (prev === 'style' ? null : 'style'))
                  }
                  title="Colors & Border Style"
                >
                  <PaletteIcon size={14} />
                  {(() => {
                    const currentStyle =
                      ast.nodes.get(selectedNodeId)?.style ||
                      getNodeStyle(ast, selectedNodeId);
                    if (currentStyle?.fill) {
                      return (
                        <span
                          className="mermaid-hud-color-indicator"
                          style={{ backgroundColor: currentStyle.fill }}
                        />
                      );
                    }
                    return null;
                  })()}
                </button>

                <div className="mermaid-hud-divider" />

                <button
                  type="button"
                  className="mermaid-hud-btn delete-btn icon-only"
                  onClick={handleDeleteSelectedNode}
                  title="Delete Step (and connections)"
                >
                  <TrashIcon size={13} />
                </button>
              </div>

              {/* Shape Popover */}
              {activeNodePopover === 'shape' && (
                <div
                  className="mermaid-popover-menu mermaid-shape-popover nodrag"
                  style={{
                    position: 'absolute',
                    left: sproutX,
                    top: isLR ? sproutY + 28 : sproutY + 36,
                    transform: isLR ? 'translate(0, 0)' : 'translate(-50%, 0)',
                    zIndex: 200,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {SHAPE_OPTIONS.map((shape) => {
                    const IconComp =
                      ShapeIcons[shape.type as keyof typeof ShapeIcons] || ShapeIcons.rectangle;
                    const isCurrent = ast.nodes.get(selectedNodeId)?.shape === shape.type;
                    return (
                      <button
                        key={shape.type}
                        type="button"
                        className={`mermaid-shape-item-btn ${isCurrent ? 'is-active' : ''}`}
                        onClick={() => handleUpdateNodeShape(selectedNodeId, shape.type)}
                      >
                        <span className="mermaid-shape-item-icon">
                          <IconComp size={15} />
                        </span>
                        <span>{shape.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Visual Styling Popover */}
              {activeNodePopover === 'style' && (
                <div
                  className="mermaid-popover-menu mermaid-style-popover nodrag"
                  style={{
                    position: 'absolute',
                    left: sproutX,
                    top: isLR ? sproutY + 28 : sproutY + 36,
                    transform: isLR ? 'translate(0, 0)' : 'translate(-50%, 0)',
                    zIndex: 200,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Theme Presets */}
                  <div className="mermaid-style-popover-title">Themes</div>
                  <div className="mermaid-swatches-grid">
                    {THEME_PRESETS.map((p) => {
                      const currentStyle =
                        ast.nodes.get(selectedNodeId)?.style || getNodeStyle(ast, selectedNodeId);
                      const isCurrent =
                        (!p.fill && !currentStyle?.fill) ||
                        (Boolean(currentStyle?.fill) &&
                          currentStyle?.fill?.toLowerCase() === p.fill.toLowerCase());
                      return (
                        <button
                          key={p.name}
                          type="button"
                          className={`mermaid-swatch-btn ${isCurrent ? 'is-active' : ''}`}
                          style={{
                            backgroundColor: p.bgPreview,
                            borderColor: p.borderPreview,
                          }}
                          onClick={() => handleApplyNodePreset(selectedNodeId, p)}
                          title={p.name}
                        >
                          {isCurrent && <CheckIcon size={12} />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Stroke Width */}
                  <div className="mermaid-style-control-row">
                    <span className="mermaid-style-popover-title">Border</span>
                    <div className="mermaid-style-segmented">
                      {['1px', '2px', '3px', '4px'].map((w) => {
                        const currentStyle =
                          ast.nodes.get(selectedNodeId)?.style || getNodeStyle(ast, selectedNodeId);
                        const isCurrent = currentStyle?.['stroke-width'] === w;
                        return (
                          <button
                            key={w}
                            type="button"
                            className={`mermaid-segmented-btn ${isCurrent ? 'is-active' : ''}`}
                            onClick={() => handleUpdateCustomStyle(selectedNodeId, 'stroke-width', w)}
                          >
                            {w}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Stroke Dash Style */}
                  <div className="mermaid-style-control-row">
                    <span className="mermaid-style-popover-title">Dash</span>
                    <div className="mermaid-style-segmented">
                      {[
                        { label: 'Solid', value: '' },
                        { label: 'Dashed', value: '5 5' },
                        { label: 'Dotted', value: '2 2' },
                      ].map((dash) => {
                        const currentStyle =
                          ast.nodes.get(selectedNodeId)?.style || getNodeStyle(ast, selectedNodeId);
                        const isCurrent =
                          (!dash.value && !currentStyle?.['stroke-dasharray']) ||
                          currentStyle?.['stroke-dasharray'] === dash.value;
                        return (
                          <button
                            key={dash.label}
                            type="button"
                            className={`mermaid-segmented-btn ${isCurrent ? 'is-active' : ''}`}
                            onClick={() =>
                              handleUpdateCustomStyle(selectedNodeId, 'stroke-dasharray', dash.value)
                            }
                          >
                            {dash.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Colors */}
                  <div className="mermaid-style-control-row">
                    <span>Fill Color</span>
                    <div className="mermaid-color-input-wrapper">
                      <input
                        type="color"
                        className="mermaid-color-picker-input"
                        value={
                          ast.nodes.get(selectedNodeId)?.style?.fill ||
                          getNodeStyle(ast, selectedNodeId)?.fill ||
                          '#ffffff'
                        }
                        onChange={(e) =>
                          handleUpdateCustomStyle(selectedNodeId, 'fill', e.target.value)
                        }
                        title="Custom Fill Color"
                      />
                    </div>
                  </div>

                  <div className="mermaid-style-control-row">
                    <span>Border Color</span>
                    <div className="mermaid-color-input-wrapper">
                      <input
                        type="color"
                        className="mermaid-color-picker-input"
                        value={
                          ast.nodes.get(selectedNodeId)?.style?.stroke ||
                          getNodeStyle(ast, selectedNodeId)?.stroke ||
                          '#7c3aed'
                        }
                        onChange={(e) =>
                          handleUpdateCustomStyle(selectedNodeId, 'stroke', e.target.value)
                        }
                        title="Custom Border Color"
                      />
                    </div>
                  </div>

                  <div className="mermaid-style-control-row">
                    <span>Text Color</span>
                    <div className="mermaid-color-input-wrapper">
                      <input
                        type="color"
                        className="mermaid-color-picker-input"
                        value={
                          ast.nodes.get(selectedNodeId)?.style?.color ||
                          getNodeStyle(ast, selectedNodeId)?.color ||
                          '#000000'
                        }
                        onChange={(e) =>
                          handleUpdateCustomStyle(selectedNodeId, 'color', e.target.value)
                        }
                        title="Custom Text Color"
                      />
                    </div>
                  </div>

                  {/* Reset to Default */}
                  <button
                    type="button"
                    className="mermaid-style-reset-btn"
                    onClick={() => handleClearNodeStyle(selectedNodeId)}
                  >
                    Reset to Default Theme
                  </button>
                </div>
              )}
            </>
          )}

          {/* Selected Edge HUD */}
          {selectedEdgePos && selectedEdgeId && (
            <div
              className="mermaid-edge-hud nodrag"
              style={{
                position: 'absolute',
                left: selectedEdgePos.x,
                top: selectedEdgePos.y - 12,
                transform: 'translate(-50%, -100%)',
                zIndex: 150,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Arrow Shape Pickers */}
              <button
                type="button"
                className={`mermaid-hud-btn icon-only ${
                  selectedEdgePos.arrowType === 'arrow' ? 'is-active' : ''
                }`}
                onClick={() => handleChangeEdgeType('arrow')}
                title="Solid Arrow (-->)"
              >
                <ArrowSolidIcon size={14} />
              </button>

              <button
                type="button"
                className={`mermaid-hud-btn icon-only ${
                  selectedEdgePos.arrowType === 'dotted' ? 'is-active' : ''
                }`}
                onClick={() => handleChangeEdgeType('dotted')}
                title="Dotted Arrow (-.->)"
              >
                <ArrowDottedIcon size={14} />
              </button>

              <button
                type="button"
                className={`mermaid-hud-btn icon-only ${
                  selectedEdgePos.arrowType === 'thick' ? 'is-active' : ''
                }`}
                onClick={() => handleChangeEdgeType('thick')}
                title="Thick Arrow (==>)"
              >
                <ArrowThickIcon size={14} />
              </button>

              <button
                type="button"
                className={`mermaid-hud-btn icon-only ${
                  selectedEdgePos.arrowType === 'open' ? 'is-active' : ''
                }`}
                onClick={() => handleChangeEdgeType('open')}
                title="Open Line (---)"
              >
                <ArrowOpenIcon size={14} />
              </button>

              <button
                type="button"
                className={`mermaid-hud-btn icon-only ${
                  selectedEdgePos.arrowType === 'bidirectional' ? 'is-active' : ''
                }`}
                onClick={() => handleChangeEdgeType('bidirectional')}
                title="Bidirectional Arrow (<-->)"
              >
                <ArrowBidirectionalIcon size={14} />
              </button>

              <div className="mermaid-hud-divider" />

              {/* Reverse Direction */}
              <button
                type="button"
                className="mermaid-hud-btn icon-only"
                onClick={handleReverseEdge}
                title="Reverse Direction (swap endpoints ⇄)"
              >
                <ReverseIcon size={14} />
              </button>

              {/* Insert Step Between */}
              <button
                type="button"
                className="mermaid-hud-btn insert-step-btn"
                onClick={() => handleInsertNodeOnEdge(selectedEdgeId)}
                title="Insert Step Between (splits connection)"
              >
                <InsertStepIcon size={13} />
                <span>Insert Step</span>
              </button>

              <div className="mermaid-hud-divider" />

              {/* Caption Input */}
              <input
                type="text"
                className="mermaid-edge-input"
                placeholder="Caption (e.g. Yes/No)..."
                defaultValue={selectedEdgePos.label || ''}
                key={selectedEdgeId + (selectedEdgePos.label || '')}
                onBlur={(e) => handleUpdateEdgeLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleUpdateEdgeLabel((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
              />

              {/* Delete Edge */}
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
