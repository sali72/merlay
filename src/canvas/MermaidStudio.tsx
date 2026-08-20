import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { parseMermaidFlowchart } from '../ast/parser';
import { serializeMermaidFlowchart } from '../ast/serializer';
import { calculateMermaidLayout } from '../layout/dagreLayout';
import { findSpliceCandidateEdge } from '../layout/geometry';
import { exportDiagramAsPng, exportDiagramAsSvg, copyDiagramToClipboard } from './exportUtils';
import {
  ArrowType,
  FlowchartDirection,
  MermaidEdgeDef,
  MermaidFlowchartAST,
  MermaidNodeDef,
  MermaidShapeType,
} from '../ast/types';

import { ShapeNode } from './nodes/ShapeNode';
import { SubgraphNode } from './nodes/SubgraphNode';
import { CustomEdge } from './edges/CustomEdge';
import { TopToolbar } from './toolbar/TopToolbar';
import { useUndoRedo } from './hooks/useUndoRedo';
import { AlertWarningIcon, CloseIcon, CodeIcon } from './icons/Icons';

function getEdgeMarkers(arrowType: ArrowType, isSelected = false) {
  const isBidirectional = arrowType === 'bidirectional';
  const isOpen =
    arrowType === 'open' ||
    arrowType === 'dotted_open' ||
    arrowType === 'thick_open';

  const markerColor = isSelected
    ? 'var(--mermaid-accent, #7c3aed)'
    : 'var(--mermaid-text-muted, #888888)';

  return {
    markerEnd: isOpen
      ? undefined
      : {
          type: MarkerType.ArrowClosed,
          color: markerColor,
          width: 12,
          height: 12,
        },
    markerStart: isBidirectional
      ? {
          type: MarkerType.ArrowClosed,
          color: markerColor,
          width: 12,
          height: 12,
        }
      : undefined,
  };
}

function getDefaultHandles(direction: FlowchartDirection) {
  switch (direction) {
    case 'TD':
    case 'TB':
      return { sourceHandle: 'bottom-src', targetHandle: 'top-tgt' };
    case 'BT':
      return { sourceHandle: 'top-src', targetHandle: 'bottom-tgt' };
    case 'RL':
      return { sourceHandle: 'left-src', targetHandle: 'right-tgt' };
    case 'LR':
    default:
      return { sourceHandle: 'right-src', targetHandle: 'left-tgt' };
  }
}

export interface MermaidStudioProps {
  initialCode: string;
  onCodeChange: (newCode: string) => void;
  onCopyNotice?: () => void;
  showMinimap?: boolean;
  defaultCodePanelWidth?: number;
}

export const MermaidStudio: React.FC<MermaidStudioProps> = ({
  initialCode,
  onCodeChange,
  onCopyNotice,
  showMinimap = true,
  defaultCodePanelWidth = 340,
}) => {
  const [code, setCode] = useState<string>(
    initialCode ||
      'flowchart LR\n    A["Start"] --> B["Process"]\n    B --> C["End"]'
  );
  const [showCodePanel, setShowCodePanel] = useState<boolean>(true);
  const [syntaxError, setSyntaxError] = useState<string | null>(null);

  const [codePanelWidth, setCodePanelWidth] = useState<number>(() => {
    const saved = localStorage.getItem('obsidian-mermaid-panel-width');
    return saved ? parseInt(saved, 10) : defaultCodePanelWidth;
  });
  const [isResizing, setIsResizing] = useState<boolean>(false);

  const [isAutoLayout, setIsAutoLayout] = useState<boolean>(true);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [rfInstance, setRfInstance] = useState<any>(null);

  const [ast, setAst] = useState<MermaidFlowchartAST>(() =>
    parseMermaidFlowchart(code)
  );

  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChange(changes);

      // When dragging nodes in free-roam mode, smoothly adapt connected edges
      const draggedNodeIds = new Set<string>();
      for (const change of changes) {
        if (change.type === 'position' && change.dragging && change.id) {
          draggedNodeIds.add(change.id);
        }
      }

      if (draggedNodeIds.size > 0) {
        setEdges((eds) =>
          eds.map((e) => {
            if (
              (draggedNodeIds.has(e.source) || draggedNodeIds.has(e.target)) &&
              (e.data as any)?.svgPath
            ) {
              return {
                ...e,
                data: {
                  ...e.data,
                  svgPath: undefined,
                  labelPosition: undefined,
                },
              };
            }
            return e;
          })
        );
      }
    },
    [onNodesChange, setEdges]
  );

  const { pushSnapshot, undo, redo, canUndo, canRedo } = useUndoRedo(code);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasPaneRef = useRef<HTMLDivElement>(null);

  const nodeTypes = useMemo(
    () => ({
      shapeNode: ShapeNode,
      subgraphNode: SubgraphNode,
    }),
    []
  );

  const edgeTypes = useMemo(
    () => ({
      customEdge: CustomEdge,
    }),
    []
  );

  // Exact 1:1 Live Dagre & Native Mermaid Layout Engine (matches official Mermaid.js & Obsidian renderer)
  const runAutoLayout = useCallback(
    async (targetAst: MermaidFlowchartAST, selectNodeId?: string) => {
      try {
        const layout = await calculateMermaidLayout(targetAst);
        const defaultHandles = getDefaultHandles(targetAst.direction);

        const flowNodes: Node[] = [];

        for (const sub of layout.subgraphs) {
          flowNodes.push({
            id: sub.id,
            type: 'subgraphNode',
            position: { x: sub.x, y: sub.y },
            style: { width: sub.width, height: sub.height },
            data: { id: sub.id, label: sub.label },
            draggable: false,
          });
        }

        for (const node of layout.nodes) {
          flowNodes.push({
            id: node.id,
            type: 'shapeNode',
            position: { x: node.x, y: node.y },
            data: {
              id: node.id,
              label: node.label,
              shape: node.shape,
              style: node.style,
            },
            draggable: false,
            selected: selectNodeId === node.id,
          });
        }

        const flowEdges: Edge[] = layout.edges.map((e) => ({
          id: e.id,
          source: e.from,
          target: e.to,
          sourceHandle: defaultHandles.sourceHandle,
          targetHandle: defaultHandles.targetHandle,
          type: 'customEdge',
          ...getEdgeMarkers(e.arrowType),
          data: {
            arrowType: e.arrowType,
            label: e.label,
            svgPath: e.svgPath,
            labelPosition: e.labelPosition,
            direction: targetAst.direction,
          },
        }));

        setNodes(flowNodes);
        setEdges(flowEdges);
        if (selectNodeId) {
          setSelectedNodeId(selectNodeId);
          setSelectedNodeIds([selectNodeId]);
        }
      } catch (err) {
        console.error('Auto layout failed:', err);
      }
    },
    [setNodes, setEdges]
  );

  // Sync AST and Canvas layout from Code
  const loadFromCode = useCallback(
    async (
      newCode: string,
      runLayout = true,
      explicitPositions?: Record<string, { x: number; y: number }>
    ) => {
      try {
        const parsedAst = parseMermaidFlowchart(newCode);
        setAst(parsedAst);
        setSyntaxError(null);

        if (runLayout) {
          const layout = await calculateMermaidLayout(parsedAst);
          const defaultHandles = getDefaultHandles(parsedAst.direction);

          const flowNodes: Node[] = [];

          for (const sub of layout.subgraphs) {
            const pos = explicitPositions?.[sub.id] || { x: sub.x, y: sub.y };
            flowNodes.push({
              id: sub.id,
              type: 'subgraphNode',
              position: pos,
              style: { width: sub.width, height: sub.height },
              data: { id: sub.id, label: sub.label },
              draggable: !isAutoLayout,
            });
          }

          for (const node of layout.nodes) {
            const pos = explicitPositions?.[node.id] || { x: node.x, y: node.y };
            flowNodes.push({
              id: node.id,
              type: 'shapeNode',
              position: pos,
              data: {
                id: node.id,
                label: node.label,
                shape: node.shape,
                style: node.style,
              },
              draggable: !isAutoLayout,
            });
          }

          const flowEdges: Edge[] = layout.edges.map((e) => ({
            id: e.id,
            source: e.from,
            target: e.to,
            sourceHandle: defaultHandles.sourceHandle,
            targetHandle: defaultHandles.targetHandle,
            type: 'customEdge',
            ...getEdgeMarkers(e.arrowType),
            data: {
              arrowType: e.arrowType,
              label: e.label,
              svgPath: e.svgPath,
              labelPosition: e.labelPosition,
              direction: parsedAst.direction,
            },
          }));

          setNodes(flowNodes);
          setEdges(flowEdges);
        }
      } catch (e: any) {
        setSyntaxError(e.message || 'Syntax error parsing Mermaid code');
      }
    },
    [isAutoLayout, setNodes, setEdges]
  );

  useEffect(() => {
    loadFromCode(code, true);
  }, []);

  const updateCodeFromAST = useCallback(
    (newAst: MermaidFlowchartAST) => {
      const serialized = serializeMermaidFlowchart(newAst);
      setCode(serialized);
      setAst(newAst);
      pushSnapshot(serialized, nodes);
      onCodeChange(serialized);
    },
    [pushSnapshot, onCodeChange, nodes]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;

      const newEdgeDef: MermaidEdgeDef = {
        type: 'edge',
        id: `e_${params.source}_${params.target}_${Date.now()}`,
        from: params.source,
        to: params.target,
        arrowType: 'arrow' as ArrowType,
      };

      const updatedEdges = [...ast.edges, newEdgeDef];
      const updatedAst: MermaidFlowchartAST = {
        ...ast,
        edges: updatedEdges,
      };

      updateCodeFromAST(updatedAst);

      if (isAutoLayout) {
        runAutoLayout(updatedAst);
      } else {
        setEdges((eds) =>
          addEdge(
            {
              ...params,
              id: newEdgeDef.id,
              type: 'customEdge',
              ...getEdgeMarkers('arrow'),
              data: { arrowType: 'arrow', direction: ast.direction },
            },
            eds
          )
        );
      }
    },
    [ast, isAutoLayout, runAutoLayout, setEdges, updateCodeFromAST]
  );

  const onNodeDragStop = useCallback(
    (_event: any, node: Node) => {
      pushSnapshot(code, nodes);

      if (node.type !== 'shapeNode') return;

      const candidateEdge = findSpliceCandidateEdge(node, nodes, edges, 35);
      if (!candidateEdge) return;

      const sourceId = candidateEdge.source;
      const targetId = candidateEdge.target;
      const defaultHandles = getDefaultHandles(ast.direction);

      const edge1Def: MermaidEdgeDef = {
        type: 'edge',
        id: `e_${sourceId}_${node.id}_${Date.now()}`,
        from: sourceId,
        to: node.id,
        arrowType: 'arrow',
      };

      const edge2Def: MermaidEdgeDef = {
        type: 'edge',
        id: `e_${node.id}_${targetId}_${Date.now() + 1}`,
        from: node.id,
        to: targetId,
        arrowType: 'arrow',
      };

      const updatedEdges = ast.edges
        .filter(
          (e) =>
            e.id !== candidateEdge.id &&
            !(e.from === sourceId && e.to === targetId)
        )
        .concat([edge1Def, edge2Def]);

      const updatedAst: MermaidFlowchartAST = {
        ...ast,
        edges: updatedEdges,
      };

      setEdges((eds) =>
        eds
          .filter((e) => e.id !== candidateEdge.id)
          .concat([
            {
              id: edge1Def.id,
              source: sourceId,
              target: node.id,
              sourceHandle: defaultHandles.sourceHandle,
              targetHandle: defaultHandles.targetHandle,
              type: 'customEdge',
              ...getEdgeMarkers('arrow'),
              data: { arrowType: 'arrow', direction: ast.direction },
            },
            {
              id: edge2Def.id,
              source: node.id,
              target: targetId,
              sourceHandle: defaultHandles.sourceHandle,
              targetHandle: defaultHandles.targetHandle,
              type: 'customEdge',
              ...getEdgeMarkers('arrow'),
              data: { arrowType: 'arrow', direction: ast.direction },
            },
          ])
      );

      updateCodeFromAST(updatedAst);
    },
    [code, nodes, edges, ast, pushSnapshot, setEdges, updateCodeFromAST]
  );

  const connectingNodeRef = useRef<{
    nodeId: string;
    handleId: string | null;
    handleType: string | null;
  } | null>(null);

  const onConnectStart = useCallback(
    (
      _event: any,
      params: { nodeId: string | null; handleId: string | null; handleType: string | null }
    ) => {
      if (params.nodeId) {
        connectingNodeRef.current = {
          nodeId: params.nodeId,
          handleId: params.handleId,
          handleType: params.handleType,
        };
      }
    },
    []
  );

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState?: any) => {
      const sourceInfo = connectingNodeRef.current;
      connectingNodeRef.current = null;
      if (!sourceInfo) return;

      // If dropped on an existing node or handle, let onConnect handle it
      if (connectionState?.isValid) return;

      const targetEl = event.target as HTMLElement;
      if (targetEl?.closest('.react-flow__node') || targetEl?.closest('.react-flow__handle')) {
        return;
      }

      if (!rfInstance) return;

      const newId = `node_${Date.now().toString().slice(-4)}`;
      const newNodeDef: MermaidNodeDef = {
        type: 'node',
        id: newId,
        label: 'New Step',
        shape: 'rectangle',
      };

      const newEdgeDef: MermaidEdgeDef = {
        type: 'edge',
        id: `e_${sourceInfo.nodeId}_${newId}_${Date.now()}`,
        from: sourceInfo.nodeId,
        to: newId,
        arrowType: 'arrow' as ArrowType,
      };

      const updatedNodes = new Map(ast.nodes);
      updatedNodes.set(newId, newNodeDef);

      const updatedAst: MermaidFlowchartAST = {
        ...ast,
        nodes: updatedNodes,
        edges: [...ast.edges, newEdgeDef],
      };

      updateCodeFromAST(updatedAst);

      if (isAutoLayout) {
        runAutoLayout(updatedAst, newId);
      } else if (rfInstance) {
        const clientX = 'clientX' in event ? event.clientX : (event as TouchEvent).touches?.[0]?.clientX ?? 0;
        const clientY = 'clientY' in event ? event.clientY : (event as TouchEvent).touches?.[0]?.clientY ?? 0;

        const flowPos = rfInstance.screenToFlowPosition({ x: clientX, y: clientY });
        if (!flowPos) return;

        const defaultHandles = getDefaultHandles(ast.direction);
        const newEdge: Edge = {
          id: newEdgeDef.id,
          source: sourceInfo.nodeId,
          target: newId,
          sourceHandle: sourceInfo.handleId || defaultHandles.sourceHandle,
          targetHandle: defaultHandles.targetHandle,
          type: 'customEdge',
          ...getEdgeMarkers('arrow'),
          data: { arrowType: 'arrow', direction: ast.direction },
        };

        const newNode: Node = {
          id: newId,
          type: 'shapeNode',
          position: { x: flowPos.x - 65, y: flowPos.y - 24 },
          data: {
            id: newId,
            label: 'New Step',
            shape: 'rectangle',
          },
          selected: true,
        };

        setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), newNode]);
        setEdges((eds) => [...eds, newEdge]);
        setSelectedNodeId(newId);
        setSelectedNodeIds([newId]);
      }
    },
    [ast, isAutoLayout, rfInstance, runAutoLayout, updateCodeFromAST, setNodes, setEdges]
  );

  const handleLabelChange = useCallback(
    (nodeId: string, newLabel: string) => {
      const node = ast.nodes.get(nodeId);
      if (!node) return;

      node.label = newLabel;
      const updatedAst = { ...ast };
      updateCodeFromAST(updatedAst);

      if (isAutoLayout) {
        runAutoLayout(updatedAst, nodeId);
      } else {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, label: newLabel } } : n
          )
        );
      }
    },
    [ast, isAutoLayout, runAutoLayout, updateCodeFromAST, setNodes]
  );

  const handleSubgraphLabelChange = useCallback(
    (subgraphId: string, newLabel: string) => {
      const sub = ast.subgraphs.get(subgraphId);
      if (!sub) return;

      sub.label = newLabel;
      const updatedAst = { ...ast };
      updateCodeFromAST(updatedAst);

      if (isAutoLayout) {
        runAutoLayout(updatedAst);
      } else {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === subgraphId ? { ...n, data: { ...n.data, label: newLabel } } : n
          )
        );
      }
    },
    [ast, isAutoLayout, runAutoLayout, updateCodeFromAST, setNodes]
  );

  const handleUngroupSubgraph = useCallback(
    (subgraphId: string) => {
      const sub = ast.subgraphs.get(subgraphId);
      if (!sub) return;

      const updatedSubs = new Map(ast.subgraphs);
      updatedSubs.delete(subgraphId);

      const updatedNodes = new Map(ast.nodes);
      for (const nid of sub.nodeIds) {
        const node = updatedNodes.get(nid);
        if (node && node.subgraphId === subgraphId) {
          node.subgraphId = undefined;
        }
      }

      const updatedAst: MermaidFlowchartAST = {
        ...ast,
        nodes: updatedNodes,
        subgraphs: updatedSubs,
      };

      updateCodeFromAST(updatedAst);
      if (isAutoLayout) {
        runAutoLayout(updatedAst);
      } else {
        setNodes((nds) => nds.filter((n) => n.id !== subgraphId));
      }
    },
    [ast, isAutoLayout, runAutoLayout, updateCodeFromAST, setNodes]
  );

  const handleDeleteSubgraph = useCallback(
    (subgraphId: string) => {
      const sub = ast.subgraphs.get(subgraphId);
      if (!sub) return;

      const updatedSubs = new Map(ast.subgraphs);
      updatedSubs.delete(subgraphId);

      const nodesToDelete = new Set(sub.nodeIds);
      const updatedNodes = new Map(ast.nodes);
      for (const nid of nodesToDelete) {
        updatedNodes.delete(nid);
      }

      const updatedEdges = ast.edges.filter(
        (e) => !nodesToDelete.has(e.from) && !nodesToDelete.has(e.to)
      );

      const updatedAst = {
        ...ast,
        nodes: updatedNodes,
        edges: updatedEdges,
        subgraphs: updatedSubs,
      };

      updateCodeFromAST(updatedAst);
      if (isAutoLayout) {
        runAutoLayout(updatedAst);
      } else {
        loadFromCode(serializeMermaidFlowchart(updatedAst), true);
      }
    },
    [ast, isAutoLayout, runAutoLayout, updateCodeFromAST, loadFromCode]
  );

  const handleEdgeArrowTypeChange = useCallback(
    (edgeId: string, newArrowType: ArrowType) => {
      const edge = ast.edges.find((e) => e.id === edgeId);
      if (!edge) return;

      edge.arrowType = newArrowType;
      updateCodeFromAST({ ...ast });

      setEdges((eds) =>
        eds.map((e) =>
          e.id === edgeId
            ? {
                ...e,
                ...getEdgeMarkers(newArrowType, true),
                data: { ...e.data, arrowType: newArrowType },
              }
            : e
        )
      );
    },
    [ast, updateCodeFromAST, setEdges]
  );

  const handleEdgeLabelChange = useCallback(
    (edgeId: string, newLabel: string) => {
      const edge = ast.edges.find((e) => e.id === edgeId);
      if (!edge) return;

      edge.label = newLabel;
      const updatedAst = { ...ast };
      updateCodeFromAST(updatedAst);

      if (isAutoLayout) {
        runAutoLayout(updatedAst);
      } else {
        setEdges((eds) =>
          eds.map((e) => (e.id === edgeId ? { ...e, data: { ...e.data, label: newLabel } } : e))
        );
      }
    },
    [ast, isAutoLayout, runAutoLayout, updateCodeFromAST, setEdges]
  );

  const handleReverseEdge = useCallback(
    (edgeId?: string) => {
      const targetId = edgeId || selectedEdgeId;
      if (!targetId) return;

      const edge = ast.edges.find((e) => e.id === targetId);
      if (!edge) return;

      const oldFrom = edge.from;
      edge.from = edge.to;
      edge.to = oldFrom;

      const updatedAst = { ...ast };
      updateCodeFromAST(updatedAst);

      if (isAutoLayout) {
        runAutoLayout(updatedAst);
      } else {
        setEdges((eds) =>
          eds.map((e) =>
            e.id === targetId
              ? {
                  ...e,
                  source: edge.from,
                  target: edge.to,
                }
              : e
          )
        );
      }
    },
    [selectedEdgeId, ast, isAutoLayout, runAutoLayout, updateCodeFromAST, setEdges]
  );

  const handleDeleteEdge = useCallback(
    (edgeId?: string) => {
      const targetId = edgeId || selectedEdgeId;
      if (!targetId) return;

      const updatedEdges = ast.edges.filter((e) => e.id !== targetId);
      const updatedAst: MermaidFlowchartAST = {
        ...ast,
        edges: updatedEdges,
      };

      updateCodeFromAST(updatedAst);
      if (isAutoLayout) {
        runAutoLayout(updatedAst);
      } else {
        setEdges((eds) => eds.filter((e) => e.id !== targetId));
      }
      if (selectedEdgeId === targetId) setSelectedEdgeId(null);
    },
    [selectedEdgeId, ast, isAutoLayout, runAutoLayout, updateCodeFromAST, setEdges]
  );

  const handleDeleteNode = useCallback(
    (nodeId?: string) => {
      const targetId = nodeId || selectedNodeId;
      if (!targetId) return;

      const updatedNodes = new Map(ast.nodes);
      updatedNodes.delete(targetId);

      const updatedEdges = ast.edges.filter(
        (e) => e.from !== targetId && e.to !== targetId
      );

      const updatedAst: MermaidFlowchartAST = {
        ...ast,
        nodes: updatedNodes,
        edges: updatedEdges,
      };

      updateCodeFromAST(updatedAst);

      if (isAutoLayout) {
        runAutoLayout(updatedAst);
      } else {
        setNodes((nds) => nds.filter((n) => n.id !== targetId));
        setEdges((eds) =>
          eds.filter((e) => e.source !== targetId && e.target !== targetId)
        );
      }
      if (selectedNodeId === targetId) setSelectedNodeId(null);
    },
    [selectedNodeId, ast, isAutoLayout, runAutoLayout, updateCodeFromAST, setNodes, setEdges]
  );

  const handleAddNode = useCallback(
    (shape: MermaidShapeType = 'rectangle') => {
      if (selectedNodeId && ast.nodes.has(selectedNodeId)) {
        const node = ast.nodes.get(selectedNodeId)!;
        node.shape = shape;
        const updatedAst = { ...ast };
        updateCodeFromAST(updatedAst);
        if (isAutoLayout) {
          runAutoLayout(updatedAst, selectedNodeId);
        } else {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === selectedNodeId
                ? { ...n, data: { ...n.data, shape } }
                : n
            )
          );
        }
        return;
      }

      const newId = `node_${Date.now().toString().slice(-4)}`;
      const newNodeDef: MermaidNodeDef = {
        type: 'node',
        id: newId,
        label: 'New Node',
        shape,
      };

      const updatedNodes = new Map(ast.nodes);
      updatedNodes.set(newId, newNodeDef);

      const updatedAst = { ...ast, nodes: updatedNodes };
      updateCodeFromAST(updatedAst);

      if (isAutoLayout) {
        runAutoLayout(updatedAst, newId);
      } else {
        setNodes((nds) => [
          ...nds,
          {
            id: newId,
            type: 'shapeNode',
            position: {
              x: 100 + Math.random() * 50,
              y: 100 + Math.random() * 50,
            },
            data: {
              id: newId,
              label: 'New Node',
              shape,
            },
            selected: true,
          },
        ]);
        setSelectedNodeId(newId);
        setSelectedNodeIds([newId]);
      }
    },
    [selectedNodeId, ast, isAutoLayout, runAutoLayout, updateCodeFromAST, setNodes]
  );

  const handleAddSubgraph = useCallback(() => {
    const subId = `sub_${Date.now().toString().slice(-4)}`;
    const targetNodeIds = selectedNodeIds.length > 0 ? [...selectedNodeIds] : [];

    const newSub = {
      type: 'subgraph' as const,
      id: subId,
      label: targetNodeIds.length > 0 ? 'Group' : 'New Group',
      nodeIds: targetNodeIds,
      subgraphIds: [],
    };

    const updatedSubs = new Map(ast.subgraphs);
    updatedSubs.set(subId, newSub);

    const updatedNodes = new Map(ast.nodes);
    for (const nid of targetNodeIds) {
      const node = updatedNodes.get(nid);
      if (node) {
        node.subgraphId = subId;
      }
    }

    const updatedAst = {
      ...ast,
      nodes: updatedNodes,
      subgraphs: updatedSubs,
    };
    updateCodeFromAST(updatedAst);
    if (isAutoLayout) {
      runAutoLayout(updatedAst);
    } else {
      loadFromCode(serializeMermaidFlowchart(updatedAst), true);
    }
  }, [selectedNodeIds, ast, isAutoLayout, runAutoLayout, updateCodeFromAST, loadFromCode]);

  const handleDirectionChange = useCallback(
    async (dir: FlowchartDirection) => {
      const updatedAst = { ...ast, direction: dir };
      updateCodeFromAST(updatedAst);
      runAutoLayout(updatedAst);
    },
    [ast, updateCodeFromAST, runAutoLayout]
  );

  const handleToggleAutoLayout = useCallback(() => {
    setIsAutoLayout((prev) => {
      const next = !prev;
      if (next) {
        runAutoLayout(ast);
      } else {
        setNodes((nds) => nds.map((n) => ({ ...n, draggable: true })));
      }
      return next;
    });
  }, [ast, runAutoLayout, setNodes]);

  const handleUndo = useCallback(() => {
    const snap = undo();
    if (snap) {
      setCode(snap.code);
      onCodeChange(snap.code);
      loadFromCode(snap.code, true, snap.positions);
    }
  }, [undo, onCodeChange, loadFromCode]);

  const handleRedo = useCallback(() => {
    const snap = redo();
    if (snap) {
      setCode(snap.code);
      onCodeChange(snap.code);
      loadFromCode(snap.code, true, snap.positions);
    }
  }, [redo, onCodeChange, loadFromCode]);

  const handleFitView = useCallback(() => {
    if (rfInstance) {
      rfInstance.fitView({ padding: 0.2, duration: 400 });
    }
  }, [rfInstance]);

  // Code Panel Resizer handler
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';

      const startX = e.clientX;
      const startWidth = codePanelWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = startX - moveEvent.clientX;
        const newWidth = Math.min(
          Math.max(220, startWidth + deltaX),
          window.innerWidth * 0.75
        );
        setCodePanelWidth(newWidth);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        localStorage.setItem(
          'obsidian-mermaid-panel-width',
          String(codePanelWidth)
        );
        window.dispatchEvent(new Event('resize'));
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [codePanelWidth]
  );

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).tagName === 'INPUT' ||
        (e.target as HTMLElement).tagName === 'TEXTAREA'
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          e.preventDefault();
          handleDeleteNode();
        } else if (selectedEdgeId) {
          e.preventDefault();
          handleDeleteEdge();
        }
      } else if (e.key === 'Escape') {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setSelectedNodeIds([]);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    handleUndo,
    handleRedo,
    selectedNodeId,
    selectedEdgeId,
    handleDeleteNode,
    handleDeleteEdge,
  ]);

  const onSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: { nodes: Node[]; edges: Edge[] }) => {
      setSelectedNodeId(selNodes[0]?.id || null);
      setSelectedEdgeId(selEdges[0]?.id || null);
      setSelectedNodeIds(selNodes.map((n) => n.id));
    },
    []
  );

  const augmentedNodes = useMemo(() => {
    return nodes.map((node) => {
      if (node.type === 'subgraphNode') {
        return {
          ...node,
          data: {
            ...node.data,
            onLabelChange: handleSubgraphLabelChange,
            onUngroup: handleUngroupSubgraph,
            onDelete: handleDeleteSubgraph,
          },
        };
      }

      return {
        ...node,
        data: {
          ...node.data,
          direction: ast.direction,
          onLabelChange: handleLabelChange,
          onShapeChange: (nodeId: string, newShape: MermaidShapeType) => {
            const targetNode = ast.nodes.get(nodeId);
            if (!targetNode) return;
            targetNode.shape = newShape;
            const updatedAst = { ...ast };
            updateCodeFromAST(updatedAst);
            if (isAutoLayout) {
              runAutoLayout(updatedAst, nodeId);
            } else {
              setNodes((nds) =>
                nds.map((n) =>
                  n.id === nodeId
                    ? { ...n, data: { ...n.data, shape: newShape } }
                    : n
                )
              );
            }
          },
          onColorChange: (nodeId: string, color: string) => {
            const textColor = color === '#e0ac00' ? '#111111' : '#ffffff';
            const styleObj: Record<string, string> = color
              ? { fill: color, stroke: color, color: textColor }
              : {};
            const existingStyleIdx = ast.styles.findIndex(
              (s) => s.targetId === nodeId
            );
            const updatedStyles = [...ast.styles];
            if (color) {
              if (existingStyleIdx !== -1) {
                updatedStyles[existingStyleIdx] = {
                  type: 'style',
                  targetId: nodeId,
                  styles: styleObj,
                };
              } else {
                updatedStyles.push({
                  type: 'style',
                  targetId: nodeId,
                  styles: styleObj,
                });
              }
            } else if (existingStyleIdx !== -1) {
              updatedStyles.splice(existingStyleIdx, 1);
            }
            const updatedAst = { ...ast, styles: updatedStyles };
            updateCodeFromAST(updatedAst);
            if (isAutoLayout) {
              runAutoLayout(updatedAst, nodeId);
            } else {
              setNodes((nds) =>
                nds.map((n) =>
                  n.id === nodeId
                    ? { ...n, data: { ...n.data, style: styleObj } }
                    : n
                )
              );
            }
          },
          onDelete: (nodeId: string) => {
            handleDeleteNode(nodeId);
          },
        },
      };
    });
  }, [
    nodes,
    ast,
    isAutoLayout,
    runAutoLayout,
    handleLabelChange,
    handleSubgraphLabelChange,
    handleUngroupSubgraph,
    handleDeleteSubgraph,
    handleDeleteNode,
    updateCodeFromAST,
    setNodes,
  ]);

  const augmentedEdges = useMemo(() => {
    return edges.map((edge) => ({
      ...edge,
      data: {
        ...edge.data,
        direction: (edge.data as any)?.direction || ast.direction,
        onArrowTypeChange: handleEdgeArrowTypeChange,
        onLabelChange: handleEdgeLabelChange,
        onReverse: handleReverseEdge,
        onDelete: handleDeleteEdge,
      },
    }));
  }, [
    edges,
    ast.direction,
    handleEdgeArrowTypeChange,
    handleEdgeLabelChange,
    handleReverseEdge,
    handleDeleteEdge,
  ]);

  const handleExportPng = useCallback(async () => {
    if (canvasPaneRef.current) {
      try {
        await exportDiagramAsPng(canvasPaneRef.current, 'mermaid-diagram.png');
      } catch (err) {
        console.error('Failed to export PNG:', err);
      }
    }
  }, []);

  const handleExportSvg = useCallback(async () => {
    if (canvasPaneRef.current) {
      try {
        await exportDiagramAsSvg(canvasPaneRef.current, 'mermaid-diagram.svg');
      } catch (err) {
        console.error('Failed to export SVG:', err);
      }
    }
  }, []);

  const handleCopyImage = useCallback(async () => {
    if (canvasPaneRef.current) {
      try {
        await copyDiagramToClipboard(canvasPaneRef.current);
        if (onCopyNotice) onCopyNotice();
      } catch (err) {
        console.error('Failed to copy image to clipboard:', err);
      }
    }
  }, [onCopyNotice]);

  return (
    <div className="mermaid-studio-container" ref={containerRef}>
      {/* Floating Top Toolbar Dock */}
      <TopToolbar
        direction={ast.direction}
        onDirectionChange={handleDirectionChange}
        isAutoLayout={isAutoLayout}
        onToggleAutoLayout={handleToggleAutoLayout}
        onFitView={handleFitView}
        onAddNode={handleAddNode}
        onAddSubgraph={handleAddSubgraph}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onCopyCode={() => {
          navigator.clipboard.writeText(`\`\`\`mermaid\n${code}\n\`\`\``);
          if (onCopyNotice) onCopyNotice();
        }}
        onCopyImage={handleCopyImage}
        onExportPng={handleExportPng}
        onExportSvg={handleExportSvg}
        showCodePanel={showCodePanel}
        onToggleCodePanel={() => {
          setShowCodePanel(!showCodePanel);
          setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
          }, 50);
        }}
      />

      {/* Main Full-Screen Canvas Body */}
      <div className="mermaid-studio-body">
        {/* Visual Canvas Panel */}
        <div className="mermaid-canvas-pane" ref={canvasPaneRef}>
          {/* Native Mermaid SVG Arrowhead & Marker Definitions */}
          <svg style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0, pointerEvents: 'none' }}>
            <defs>
              <marker
                id="mermaid-marker-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerUnits="userSpaceOnUse"
                markerWidth="8"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--mermaid-text-muted, #888888)" />
              </marker>
              <marker
                id="mermaid-marker-arrow-selected"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerUnits="userSpaceOnUse"
                markerWidth="8"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--mermaid-accent, #7c3aed)" />
              </marker>
              <marker
                id="mermaid-marker-arrow-start"
                viewBox="0 0 10 10"
                refX="1"
                refY="5"
                markerUnits="userSpaceOnUse"
                markerWidth="8"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 10 0 L 0 5 L 10 10 z" fill="var(--mermaid-text-muted, #888888)" />
              </marker>
              <marker
                id="mermaid-marker-arrow-start-selected"
                viewBox="0 0 10 10"
                refX="1"
                refY="5"
                markerUnits="userSpaceOnUse"
                markerWidth="8"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 10 0 L 0 5 L 10 10 z" fill="var(--mermaid-accent, #7c3aed)" />
              </marker>
              <marker
                id="mermaid-marker-thick"
                viewBox="0 0 10 10"
                refX="10"
                refY="5"
                markerUnits="userSpaceOnUse"
                markerWidth="11"
                markerHeight="8"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--mermaid-text-muted, #888888)" />
              </marker>
              <marker
                id="mermaid-marker-thick-selected"
                viewBox="0 0 10 10"
                refX="10"
                refY="5"
                markerUnits="userSpaceOnUse"
                markerWidth="11"
                markerHeight="8"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--mermaid-accent, #7c3aed)" />
              </marker>
              <marker
                id="mermaid-marker-circle"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerUnits="userSpaceOnUse"
                markerWidth="10"
                markerHeight="10"
                orient="auto"
              >
                <circle cx="5" cy="5" r="4" fill="var(--mermaid-text-muted, #888888)" stroke="var(--mermaid-text-muted, #888888)" strokeWidth="1" />
              </marker>
              <marker
                id="mermaid-marker-circle-selected"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerUnits="userSpaceOnUse"
                markerWidth="10"
                markerHeight="10"
                orient="auto"
              >
                <circle cx="5" cy="5" r="4" fill="var(--mermaid-accent, #7c3aed)" stroke="var(--mermaid-accent, #7c3aed)" strokeWidth="1" />
              </marker>
              <marker
                id="mermaid-marker-cross"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerUnits="userSpaceOnUse"
                markerWidth="9"
                markerHeight="9"
                orient="auto"
              >
                <path d="M 1 1 L 9 9 M 9 1 L 1 9" stroke="var(--mermaid-text-muted, #888888)" strokeWidth="2" strokeLinecap="round" />
              </marker>
              <marker
                id="mermaid-marker-cross-selected"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerUnits="userSpaceOnUse"
                markerWidth="9"
                markerHeight="9"
                orient="auto"
              >
                <path d="M 1 1 L 9 9 M 9 1 L 1 9" stroke="var(--mermaid-accent, #7c3aed)" strokeWidth="2" strokeLinecap="round" />
              </marker>
            </defs>
          </svg>

          <ReactFlow
            nodes={augmentedNodes}
            edges={augmentedEdges}
            nodesDraggable={!isAutoLayout}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            onNodeDragStop={onNodeDragStop}
            onSelectionChange={onSelectionChange}
            onInit={(instance) => setRfInstance(instance)}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            deleteKeyCode={null}
            onPaneClick={() => {
              setSelectedNodeId(null);
              setSelectedEdgeId(null);
              setSelectedNodeIds([]);
            }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={16}
              size={1}
              color="var(--mermaid-border, rgba(128, 128, 128, 0.25))"
            />
            <Controls showInteractive={false} />
            {showMinimap && (
              <MiniMap
                nodeColor={() => 'var(--mermaid-accent, #7c3aed)'}
                maskColor="rgba(0, 0, 0, 0.3)"
                className="mermaid-minimap"
              />
            )}
          </ReactFlow>
        </div>

        {/* Resizable Side Code Drawer */}
        {showCodePanel && (
          <div
            className="mermaid-code-pane"
            style={{ width: `${codePanelWidth}px` }}
          >
            {/* Drag Resizer Handle */}
            <div
              className={`mermaid-code-resizer ${isResizing ? 'is-dragging' : ''}`}
              onMouseDown={handleResizeMouseDown}
              onDoubleClick={() => setCodePanelWidth(340)}
              title="Drag to resize code panel (Double click to reset)"
            />

            <div className="mermaid-code-header">
              <div className="mermaid-code-header-left">
                <span className="mermaid-code-title">
                  <CodeIcon size={15} />
                  Mermaid Syntax
                </span>
                {syntaxError && (
                  <span className="mermaid-error-badge" title={syntaxError}>
                    <AlertWarningIcon size={13} />
                    Syntax Error
                  </span>
                )}
              </div>
              <button
                type="button"
                className="mermaid-code-close-btn"
                onClick={() => setShowCodePanel(false)}
                title="Close Code Panel"
              >
                <CloseIcon size={14} />
              </button>
            </div>
            <textarea
              className="mermaid-code-textarea"
              value={code}
              onChange={(e) => {
                const val = e.target.value;
                setCode(val);
                onCodeChange(val);
                loadFromCode(val, false);
              }}
              placeholder="Enter Mermaid syntax..."
              spellCheck={false}
            />
          </div>
        )}
      </div>
    </div>
  );
};
