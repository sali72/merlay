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
  ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { parseMermaidFlowchart } from '../ast/parser';
import { serializeMermaidFlowchart } from '../ast/serializer';
import { calculateElkLayout } from '../layout/elkLayout';
import { findSpliceCandidateEdge } from '../layout/geometry';
import {
  exportDiagramAsPng,
  exportDiagramAsSvg,
  copyDiagramToClipboard,
} from './exportUtils';
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

function getEdgeMarkers(arrowType: ArrowType, isSelected = false) {
  const isBidirectional = arrowType === 'bidirectional';
  const isOpen =
    arrowType === 'open' ||
    arrowType === 'dotted_open' ||
    arrowType === 'thick_open';

  const markerColor = isSelected
    ? 'var(--interactive-accent, #7c3aed)'
    : 'var(--text-muted, #888888)';

  return {
    markerEnd: isOpen
      ? undefined
      : {
          type: MarkerType.ArrowClosed,
          color: markerColor,
          width: 16,
          height: 16,
        },
    markerStart: isBidirectional
      ? {
          type: MarkerType.ArrowClosed,
          color: markerColor,
          width: 16,
          height: 16,
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
}

export const MermaidStudio: React.FC<MermaidStudioProps> = ({
  initialCode,
  onCodeChange,
  onCopyNotice,
}) => {
  const [code, setCode] = useState<string>(
    initialCode ||
      'flowchart LR\n    A["Start"] --> B["Process"]\n    B --> C["End"]'
  );
  const [showCodePanel, setShowCodePanel] = useState<boolean>(true);
  const [syntaxError, setSyntaxError] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

  const [ast, setAst] = useState<MermaidFlowchartAST>(() =>
    parseMermaidFlowchart(code)
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

        const defaultHandles = getDefaultHandles(parsedAst.direction);

        if (runLayout) {
          const layout = await calculateElkLayout(parsedAst);

          const flowNodes: Node[] = [];

          // Add subgraphs as compound background nodes
          for (const sub of layout.subgraphs) {
            const pos = explicitPositions?.[sub.id] || { x: sub.x, y: sub.y };
            flowNodes.push({
              id: sub.id,
              type: 'subgraphNode',
              position: pos,
              style: { width: sub.width, height: sub.height },
              data: {
                id: sub.id,
                label: sub.label,
                direction: parsedAst.subgraphs.get(sub.id)?.direction,
              },
              draggable: true,
            });
          }

          // Add regular nodes
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
                direction: parsedAst.direction,
              },
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
            },
          }));

          setNodes(flowNodes);
          setEdges(flowEdges);
        } else {
          // Incremental update without destroying manual node positions
          const existingPosMap = new Map<string, { x: number; y: number }>();
          for (const n of nodes) {
            existingPosMap.set(n.id, { x: n.position.x, y: n.position.y });
          }

          const flowNodes: Node[] = [];

          // Add subgraphs
          for (const [subId, subDef] of parsedAst.subgraphs.entries()) {
            const existingPos = existingPosMap.get(subId) || { x: 50, y: 50 };
            flowNodes.push({
              id: subId,
              type: 'subgraphNode',
              position: existingPos,
              data: {
                id: subId,
                label: subDef.label,
                direction: subDef.direction,
              },
              draggable: true,
            });
          }

          // Add regular nodes
          let nextOffsetY = 100;
          for (const [nodeId, nodeDef] of parsedAst.nodes.entries()) {
            let pos = existingPosMap.get(nodeId);
            if (!pos) {
              const connectedEdge = parsedAst.edges.find(
                (e) => e.to === nodeId || e.from === nodeId
              );
              if (connectedEdge) {
                const otherId =
                  connectedEdge.to === nodeId
                    ? connectedEdge.from
                    : connectedEdge.to;
                const otherPos = existingPosMap.get(otherId);
                if (otherPos) {
                  pos = { x: otherPos.x + 180, y: otherPos.y };
                }
              }
              if (!pos) {
                pos = { x: 100, y: nextOffsetY };
                nextOffsetY += 90;
              }
            }

            flowNodes.push({
              id: nodeId,
              type: 'shapeNode',
              position: pos,
              data: {
                id: nodeId,
                label: nodeDef.label,
                shape: nodeDef.shape,
                style: nodeDef.style,
                direction: parsedAst.direction,
              },
            });
          }

          const flowEdges: Edge[] = parsedAst.edges.map((e) => ({
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
            },
          }));

          setNodes(flowNodes);
          setEdges(flowEdges);
        }
      } catch (e: any) {
        setSyntaxError(e.message || 'Syntax error parsing Mermaid code');
      }
    },
    [nodes, setNodes, setEdges]
  );

  // Initial load
  useEffect(() => {
    loadFromCode(code, true);
  }, []);

  // Update AST & Code helper
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

  // Connect handler
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

      setEdges((eds) =>
        addEdge(
          {
            ...params,
            id: newEdgeDef.id,
            type: 'customEdge',
            ...getEdgeMarkers('arrow'),
            data: { arrowType: 'arrow' },
          },
          eds
        )
      );

      updateCodeFromAST(updatedAst);
    },
    [ast, setEdges, updateCodeFromAST]
  );

  // Drag-to-Splice Handler
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
              data: { arrowType: 'arrow' },
            },
            {
              id: edge2Def.id,
              source: node.id,
              target: targetId,
              sourceHandle: defaultHandles.sourceHandle,
              targetHandle: defaultHandles.targetHandle,
              type: 'customEdge',
              ...getEdgeMarkers('arrow'),
              data: { arrowType: 'arrow' },
            },
          ])
      );

      updateCodeFromAST(updatedAst);
    },
    [code, nodes, edges, ast, pushSnapshot, setEdges, updateCodeFromAST]
  );

  // Sprout handler
  const handleSprout = useCallback(
    (sourceId: string, direction: 'right' | 'down' | 'left' | 'up') => {
      const sourceNode = nodes.find((n) => n.id === sourceId);
      if (!sourceNode) return;

      const newId = `node_${Date.now().toString().slice(-4)}`;
      const offset = 180;
      let newX = sourceNode.position.x;
      let newY = sourceNode.position.y;
      let sourceHandle = 'right-src';
      let targetHandle = 'left-tgt';

      if (direction === 'right') {
        newX += offset;
        sourceHandle = 'right-src';
        targetHandle = 'left-tgt';
      } else if (direction === 'down') {
        newY += offset;
        sourceHandle = 'bottom-src';
        targetHandle = 'top-tgt';
      } else if (direction === 'left') {
        newX -= offset;
        sourceHandle = 'left-src';
        targetHandle = 'right-tgt';
      } else if (direction === 'up') {
        newY -= offset;
        sourceHandle = 'top-src';
        targetHandle = 'bottom-tgt';
      }

      const newNodeDef: MermaidNodeDef = {
        type: 'node',
        id: newId,
        label: 'New Step',
        shape: 'rectangle',
      };

      const newEdgeDef: MermaidEdgeDef = {
        type: 'edge',
        id: `e_${sourceId}_${newId}_${Date.now()}`,
        from: sourceId,
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

      setNodes((nds) => [
        ...nds,
        {
          id: newId,
          type: 'shapeNode',
          position: { x: newX, y: newY },
          data: {
            id: newId,
            label: 'New Step',
            shape: 'rectangle',
            direction: ast.direction,
          },
        },
      ]);

      setEdges((eds) => [
        ...eds,
        {
          id: newEdgeDef.id,
          source: sourceId,
          target: newId,
          sourceHandle,
          targetHandle,
          type: 'customEdge',
          ...getEdgeMarkers('arrow'),
          data: { arrowType: 'arrow' },
        },
      ]);

      updateCodeFromAST(updatedAst);
    },
    [nodes, ast, setNodes, setEdges, updateCodeFromAST]
  );

  // Label change
  const handleLabelChange = useCallback(
    (nodeId: string, newLabel: string) => {
      const node = ast.nodes.get(nodeId);
      if (!node) return;

      node.label = newLabel;
      const updatedAst = { ...ast };
      updateCodeFromAST(updatedAst);

      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, label: newLabel } } : n
        )
      );
    },
    [ast, updateCodeFromAST, setNodes]
  );

  // Subgraph Label change
  const handleSubgraphLabelChange = useCallback(
    (subId: string, newLabel: string) => {
      const sub = ast.subgraphs.get(subId);
      if (!sub) return;

      sub.label = newLabel;
      const updatedAst = { ...ast };
      updateCodeFromAST(updatedAst);

      setNodes((nds) =>
        nds.map((n) =>
          n.id === subId ? { ...n, data: { ...n.data, label: newLabel } } : n
        )
      );
    },
    [ast, updateCodeFromAST, setNodes]
  );

  // Subgraph Ungroup
  const handleUngroupSubgraph = useCallback(
    (subId: string) => {
      const sub = ast.subgraphs.get(subId);
      if (!sub) return;

      const updatedSubs = new Map(ast.subgraphs);
      updatedSubs.delete(subId);

      const updatedNodes = new Map(ast.nodes);
      for (const [nid, node] of updatedNodes.entries()) {
        if (node.subgraphId === subId) {
          delete node.subgraphId;
        }
      }

      const updatedAst = {
        ...ast,
        nodes: updatedNodes,
        subgraphs: updatedSubs,
      };
      updateCodeFromAST(updatedAst);
      setNodes((nds) => nds.filter((n) => n.id !== subId));
    },
    [ast, updateCodeFromAST, setNodes]
  );

  // Subgraph Delete
  const handleDeleteSubgraph = useCallback(
    (subId: string) => {
      const sub = ast.subgraphs.get(subId);
      if (!sub) return;
      const nodeIdsToDelete = new Set(sub.nodeIds);
      const updatedSubs = new Map(ast.subgraphs);
      updatedSubs.delete(subId);

      const updatedNodes = new Map(ast.nodes);
      for (const nid of nodeIdsToDelete) {
        updatedNodes.delete(nid);
      }

      const updatedEdges = ast.edges.filter(
        (e) => !nodeIdsToDelete.has(e.from) && !nodeIdsToDelete.has(e.to)
      );

      const updatedAst = {
        ...ast,
        nodes: updatedNodes,
        edges: updatedEdges,
        subgraphs: updatedSubs,
      };
      updateCodeFromAST(updatedAst);
      setNodes((nds) =>
        nds.filter((n) => n.id !== subId && !nodeIdsToDelete.has(n.id))
      );
      setEdges((eds) =>
        eds.filter(
          (e) =>
            !nodeIdsToDelete.has(e.source) && !nodeIdsToDelete.has(e.target)
        )
      );
    },
    [ast, updateCodeFromAST, setNodes, setEdges]
  );

  // Edge Style change
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

  // Edge Label change
  const handleEdgeLabelChange = useCallback(
    (edgeId: string, newLabel: string) => {
      const edge = ast.edges.find((e) => e.id === edgeId);
      if (!edge) return;

      edge.label = newLabel;
      updateCodeFromAST({ ...ast });

      setEdges((eds) =>
        eds.map((e) =>
          e.id === edgeId ? { ...e, data: { ...e.data, label: newLabel } } : e
        )
      );
    },
    [ast, updateCodeFromAST, setEdges]
  );

  // Edge Reverse
  const handleReverseEdge = useCallback(
    (edgeId: string) => {
      const edgeIdx = ast.edges.findIndex((e) => e.id === edgeId);
      if (edgeIdx === -1) return;

      const edge = ast.edges[edgeIdx];
      const reversedEdge: MermaidEdgeDef = {
        ...edge,
        from: edge.to,
        to: edge.from,
      };

      const updatedEdges = [...ast.edges];
      updatedEdges[edgeIdx] = reversedEdge;

      const updatedAst = { ...ast, edges: updatedEdges };
      updateCodeFromAST(updatedAst);

      setEdges((eds) =>
        eds.map((e) =>
          e.id === edgeId
            ? {
                ...e,
                source: edge.to,
                target: edge.from,
              }
            : e
        )
      );
    },
    [ast, updateCodeFromAST, setEdges]
  );

  // Delete edge
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
      setEdges((eds) => eds.filter((e) => e.id !== targetId));
      if (selectedEdgeId === targetId) setSelectedEdgeId(null);
    },
    [selectedEdgeId, ast, updateCodeFromAST, setEdges]
  );

  // Delete node
  const handleDeleteNode = useCallback(
    (nodeId?: string) => {
      const targetId = nodeId || selectedNodeId;
      if (!targetId) return;

      // Check if it is a subgraph
      if (ast.subgraphs.has(targetId)) {
        handleDeleteSubgraph(targetId);
        return;
      }

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

      setNodes((nds) => nds.filter((n) => n.id !== targetId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== targetId && e.target !== targetId)
      );
      if (selectedNodeId === targetId) setSelectedNodeId(null);
    },
    [selectedNodeId, ast, handleDeleteSubgraph, updateCodeFromAST, setNodes, setEdges]
  );

  // Add new standalone node or morph selected node shape
  const handleAddNode = useCallback(
    (shape: MermaidShapeType = 'rectangle') => {
      if (selectedNodeId && ast.nodes.has(selectedNodeId)) {
        // Contextual Morph: If a node is selected, morph its shape!
        const node = ast.nodes.get(selectedNodeId)!;
        node.shape = shape;
        updateCodeFromAST({ ...ast });
        setNodes((nds) =>
          nds.map((n) =>
            n.id === selectedNodeId
              ? { ...n, data: { ...n.data, shape } }
              : n
          )
        );
        return;
      }

      // Otherwise, create a new node
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
            direction: ast.direction,
          },
        },
      ]);
    },
    [selectedNodeId, ast, updateCodeFromAST, setNodes]
  );

  // Add new subgraph / Group selected nodes
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
    loadFromCode(serializeMermaidFlowchart(updatedAst), true);
  }, [selectedNodeIds, ast, updateCodeFromAST, loadFromCode]);

  // Direction change (explicit user action -> runs full Elk layout)
  const handleDirectionChange = useCallback(
    async (dir: FlowchartDirection) => {
      const updatedAst = { ...ast, direction: dir };
      updateCodeFromAST(updatedAst);
      const layout = await calculateElkLayout(updatedAst);
      const defaultHandles = getDefaultHandles(dir);

      setNodes((nds) =>
        nds.map((n) => {
          const found = layout.nodes.find((ln) => ln.id === n.id);
          return found
            ? {
                ...n,
                position: { x: found.x, y: found.y },
                data: { ...n.data, direction: dir },
              }
            : n;
        })
      );

      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          sourceHandle: defaultHandles.sourceHandle,
          targetHandle: defaultHandles.targetHandle,
        }))
      );
    },
    [ast, updateCodeFromAST, setNodes, setEdges]
  );

  // Undo / Redo handlers preserving node positions
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

  // Fit View
  const handleFitView = useCallback(() => {
    if (rfInstance) {
      rfInstance.fitView({ padding: 0.2, duration: 400 });
    }
  }, [rfInstance]);

  // Keyboard shortcut listener
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

  // Node selection tracking
  const onSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: { nodes: Node[]; edges: Edge[] }) => {
      setSelectedNodeId(selNodes[0]?.id || null);
      setSelectedEdgeId(selEdges[0]?.id || null);
      setSelectedNodeIds(selNodes.map((n) => n.id));
    },
    []
  );

  // Inject callbacks into node data
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
          onSprout: handleSprout,
          onShapeChange: (nodeId: string, newShape: MermaidShapeType) => {
            const targetNode = ast.nodes.get(nodeId);
            if (!targetNode) return;
            targetNode.shape = newShape;
            updateCodeFromAST({ ...ast });
            setNodes((nds) =>
              nds.map((n) =>
                n.id === nodeId
                  ? { ...n, data: { ...n.data, shape: newShape } }
                  : n
              )
            );
          },
          onColorChange: (nodeId: string, color: string) => {
            const styleObj: Record<string, string> = color
              ? { fill: color, stroke: color, color: '#ffffff' }
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
            setNodes((nds) =>
              nds.map((n) =>
                n.id === nodeId
                  ? { ...n, data: { ...n.data, style: styleObj } }
                  : n
              )
            );
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
    handleLabelChange,
    handleSubgraphLabelChange,
    handleUngroupSubgraph,
    handleDeleteSubgraph,
    handleSprout,
    handleDeleteNode,
    updateCodeFromAST,
    setNodes,
  ]);

  // Inject callbacks into edge data
  const augmentedEdges = useMemo(() => {
    return edges.map((edge) => ({
      ...edge,
      data: {
        ...edge.data,
        onArrowTypeChange: handleEdgeArrowTypeChange,
        onLabelChange: handleEdgeLabelChange,
        onReverse: handleReverseEdge,
        onDelete: handleDeleteEdge,
      },
    }));
  }, [
    edges,
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
      {/* Top Toolbar */}
      <TopToolbar
        direction={ast.direction}
        onDirectionChange={handleDirectionChange}
        onAutoTidy={() => loadFromCode(code, true)}
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

      {/* Main Split Body */}
      <div className="mermaid-studio-body">
        {/* Visual Canvas Panel */}
        <div className="mermaid-canvas-pane" ref={canvasPaneRef}>
          <ReactFlow
            nodes={augmentedNodes}
            edges={augmentedEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
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
              color="var(--background-modifier-border, #3a3a3a)"
            />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={() => 'var(--interactive-accent, #7c3aed)'}
              maskColor="rgba(0,0,0,0.5)"
              className="mermaid-minimap"
            />
          </ReactFlow>
        </div>

        {/* Live Synchronized Code Panel */}
        {showCodePanel && (
          <div className="mermaid-code-pane">
            <div className="mermaid-code-header">
              <span className="mermaid-code-title">Mermaid Code</span>
              {syntaxError && (
                <span
                  className="mermaid-error-badge"
                  title={syntaxError}
                >
                  ⚠️ Syntax Error
                </span>
              )}
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

