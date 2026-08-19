import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { parseMermaidFlowchart } from '../ast/parser';
import { serializeMermaidFlowchart } from '../ast/serializer';
import { calculateElkLayout } from '../layout/elkLayout';
import {
  ArrowType,
  FlowchartDirection,
  MermaidFlowchartAST,
  MermaidNodeDef,
  MermaidShapeType,
} from '../ast/types';

import { ShapeNode } from './nodes/ShapeNode';
import { SubgraphNode } from './nodes/SubgraphNode';
import { CustomEdge } from './edges/CustomEdge';
import { TopToolbar } from './toolbar/TopToolbar';
import { FloatingNodeToolbar } from './toolbar/FloatingNodeToolbar';
import { FloatingEdgeToolbar } from './toolbar/FloatingEdgeToolbar';
import { useUndoRedo } from './hooks/useUndoRedo';

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
  const [code, setCode] = useState<string>(initialCode || 'flowchart LR\n    A["Start"] --> B["Process"]\n    B --> C["End"]');
  const [showCodePanel, setShowCodePanel] = useState<boolean>(true);
  const [syntaxError, setSyntaxError] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const [ast, setAst] = useState<MermaidFlowchartAST>(() => parseMermaidFlowchart(code));

  const { pushSnapshot, undo, redo, canUndo, canRedo } = useUndoRedo(code);

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
  const loadFromCode = useCallback(async (newCode: string, runLayout = true) => {
    try {
      const parsedAst = parseMermaidFlowchart(newCode);
      setAst(parsedAst);
      setSyntaxError(null);

      if (runLayout) {
        const layout = await calculateElkLayout(parsedAst);

        const flowNodes: Node[] = [];

        // Add subgraphs as background nodes
        for (const sub of layout.subgraphs) {
          flowNodes.push({
            id: sub.id,
            type: 'subgraphNode',
            position: { x: sub.x, y: sub.y },
            style: { width: sub.width, height: sub.height },
            data: { id: sub.id, label: sub.label },
            draggable: true,
          });
        }

        // Add regular nodes
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
          });
        }

        const flowEdges: Edge[] = layout.edges.map((e) => ({
          id: e.id,
          source: e.from,
          target: e.to,
          type: 'customEdge',
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
  }, [setNodes, setEdges]);

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
      pushSnapshot(serialized);
      onCodeChange(serialized);
    },
    [pushSnapshot, onCodeChange]
  );

  // Connect handler
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;

      const newEdgeDef = {
        type: 'edge' as const,
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
            data: { arrowType: 'arrow' },
          },
          eds
        )
      );

      updateCodeFromAST(updatedAst);
    },
    [ast, setEdges, updateCodeFromAST]
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

      if (direction === 'right') newX += offset;
      else if (direction === 'down') newY += offset;
      else if (direction === 'left') newX -= offset;
      else if (direction === 'up') newY -= offset;

      const newNodeDef: MermaidNodeDef = {
        type: 'node',
        id: newId,
        label: 'New Step',
        shape: 'rectangle',
      };

      const newEdgeDef = {
        type: 'edge' as const,
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
          type: 'customEdge',
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

  // Shape change
  const handleShapeChange = useCallback(
    (newShape: MermaidShapeType) => {
      if (!selectedNodeId) return;
      const node = ast.nodes.get(selectedNodeId);
      if (!node) return;

      node.shape = newShape;
      updateCodeFromAST({ ...ast });

      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNodeId
            ? { ...n, data: { ...n.data, shape: newShape } }
            : n
        )
      );
    },
    [selectedNodeId, ast, updateCodeFromAST, setNodes]
  );

  // Color change
  const handleColorChange = useCallback(
    (color: string) => {
      if (!selectedNodeId) return;

      const styleObj: Record<string, string> = color ? { fill: color, stroke: color, color: '#ffffff' } : {};
      const existingStyleIdx = ast.styles.findIndex((s) => s.targetId === selectedNodeId);

      const updatedStyles = [...ast.styles];
      if (color) {
        if (existingStyleIdx !== -1) {
          updatedStyles[existingStyleIdx] = { type: 'style', targetId: selectedNodeId, styles: styleObj };
        } else {
          updatedStyles.push({ type: 'style', targetId: selectedNodeId, styles: styleObj });
        }
      } else if (existingStyleIdx !== -1) {
        updatedStyles.splice(existingStyleIdx, 1);
      }

      const updatedAst = { ...ast, styles: updatedStyles };
      updateCodeFromAST(updatedAst);

      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNodeId
            ? { ...n, data: { ...n.data, style: styleObj } }
            : n
        )
      );
    },
    [selectedNodeId, ast, updateCodeFromAST, setNodes]
  );

  // Delete selected node
  const handleDeleteNode = useCallback(() => {
    if (!selectedNodeId) return;

    const updatedNodes = new Map(ast.nodes);
    updatedNodes.delete(selectedNodeId);

    const updatedEdges = ast.edges.filter(
      (e) => e.from !== selectedNodeId && e.to !== selectedNodeId
    );

    const updatedAst: MermaidFlowchartAST = {
      ...ast,
      nodes: updatedNodes,
      edges: updatedEdges,
    };

    updateCodeFromAST(updatedAst);

    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) =>
      eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId)
    );
    setSelectedNodeId(null);
  }, [selectedNodeId, ast, updateCodeFromAST, setNodes, setEdges]);

  // Add new standalone node
  const handleAddNode = useCallback(() => {
    const newId = `node_${Date.now().toString().slice(-4)}`;
    const newNodeDef: MermaidNodeDef = {
      type: 'node',
      id: newId,
      label: 'New Node',
      shape: 'rectangle',
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
        position: { x: 100 + Math.random() * 50, y: 100 + Math.random() * 50 },
        data: {
          id: newId,
          label: 'New Node',
          shape: 'rectangle',
        },
      },
    ]);
  }, [ast, updateCodeFromAST, setNodes]);

  // Add new subgraph
  const handleAddSubgraph = useCallback(() => {
    const subId = `sub_${Date.now().toString().slice(-4)}`;
    const newSub = {
      type: 'subgraph' as const,
      id: subId,
      label: 'New Group',
      nodeIds: [],
      subgraphIds: [],
    };

    const updatedSubs = new Map(ast.subgraphs);
    updatedSubs.set(subId, newSub);

    const updatedAst = { ...ast, subgraphs: updatedSubs };
    updateCodeFromAST(updatedAst);

    setNodes((nds) => [
      ...nds,
      {
        id: subId,
        type: 'subgraphNode',
        position: { x: 80, y: 80 },
        style: { width: 260, height: 180 },
        data: { id: subId, label: 'New Group' },
      },
    ]);
  }, [ast, updateCodeFromAST, setNodes]);

  // Direction change
  const handleDirectionChange = useCallback(
    async (dir: FlowchartDirection) => {
      const updatedAst = { ...ast, direction: dir };
      updateCodeFromAST(updatedAst);
      const layout = await calculateElkLayout(updatedAst);
      setNodes((nds) =>
        nds.map((n) => {
          const found = layout.nodes.find((ln) => ln.id === n.id);
          return found ? { ...n, position: { x: found.x, y: found.y } } : n;
        })
      );
    },
    [ast, updateCodeFromAST, setNodes]
  );

  // Undo / Redo handlers
  const handleUndo = useCallback(() => {
    const prevCode = undo();
    if (prevCode) {
      setCode(prevCode);
      onCodeChange(prevCode);
      loadFromCode(prevCode, true);
    }
  }, [undo, onCodeChange, loadFromCode]);

  const handleRedo = useCallback(() => {
    const nextCode = redo();
    if (nextCode) {
      setCode(nextCode);
      onCodeChange(nextCode);
      loadFromCode(nextCode, true);
    }
  }, [redo, onCodeChange, loadFromCode]);

  // Node selection tracking
  const onSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: { nodes: Node[]; edges: Edge[] }) => {
      setSelectedNodeId(selNodes[0]?.id || null);
      setSelectedEdgeId(selEdges[0]?.id || null);
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
      },
    }));
  }, [nodes, handleLabelChange, handleSprout]);

  const selectedNode = ast.nodes.get(selectedNodeId || '');

  return (
    <div className="mermaid-studio-container">
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
        showCodePanel={showCodePanel}
        onToggleCodePanel={() => setShowCodePanel(!showCodePanel)}
      />

      {/* Main Split Body */}
      <div className="mermaid-studio-body">
        {/* Visual Canvas Panel */}
        <div className="mermaid-canvas-pane">
          <ReactFlow
            nodes={augmentedNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
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

            {/* Floating Node Toolbar on selection */}
            {selectedNode && (
              <FloatingNodeToolbar
                currentShape={selectedNode.shape}
                onShapeChange={handleShapeChange}
                onColorChange={handleColorChange}
                onDelete={handleDeleteNode}
              />
            )}
          </ReactFlow>
        </div>

        {/* Live Synchronized Code Panel */}
        {showCodePanel && (
          <div className="mermaid-code-pane">
            <div className="mermaid-code-header">
              <span>Mermaid Syntax</span>
              {syntaxError && <span className="mermaid-error-badge">⚠️ Syntax Warning</span>}
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
