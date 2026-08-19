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
import { calculateElkLayout } from '../layout/elkLayout';
import { findSpliceCandidateEdge } from '../layout/geometry';
import { exportDiagramAsPng, exportDiagramAsSvg } from './exportUtils';
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

        if (runLayout) {
          const layout = await calculateElkLayout(parsedAst);
          const defaultHandles = getDefaultHandles(parsedAst.direction);

          const flowNodes: Node[] = [];

          // Add subgraphs as background nodes
          for (const sub of layout.subgraphs) {
            const pos = explicitPositions?.[sub.id] || { x: sub.x, y: sub.y };
            flowNodes.push({
              id: sub.id,
              type: 'subgraphNode',
              position: pos,
              style: { width: sub.width, height: sub.height },
              data: { id: sub.id, label: sub.label },
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
        }
      } catch (e: any) {
        setSyntaxError(e.message || 'Syntax error parsing Mermaid code');
      }
    },
    [setNodes, setEdges]
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
    [selectedNodeId, ast, updateCodeFromAST, setNodes, setEdges]
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
          return found ? { ...n, position: { x: found.x, y: found.y } } : n;
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
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
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
    }));
  }, [
    nodes,
    ast,
    handleLabelChange,
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
        onDelete: handleDeleteEdge,
      },
    }));
  }, [
    edges,
    handleEdgeArrowTypeChange,
    handleEdgeLabelChange,
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

  return (
    <div className="mermaid-studio-container" ref={containerRef}>
      {/* Top Toolbar */}
      <TopToolbar
        direction={ast.direction}
        onDirectionChange={handleDirectionChange}
        onAutoTidy={() => loadFromCode(code, true)}
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
        onExportPng={handleExportPng}
        onExportSvg={handleExportSvg}
        showCodePanel={showCodePanel}
        onToggleCodePanel={() => setShowCodePanel(!showCodePanel)}
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
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            <Controls />
            <MiniMap
              nodeColor={() => 'var(--interactive-accent, #7c3aed)'}
              maskColor="rgba(0,0,0,0.6)"
            />
          </ReactFlow>
        </div>

        {/* Live Synchronized Code Panel */}
        {showCodePanel && (
          <div className="mermaid-code-pane">
            <div className="mermaid-code-header">
              <span>Mermaid Syntax</span>
              {syntaxError && (
                <span className="mermaid-error-badge">⚠️ Syntax Warning</span>
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
              placeholder="Mermaid flowchart code..."
              spellCheck={false}
            />
          </div>
        )}
      </div>
    </div>
  );
};
