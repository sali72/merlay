import { useState, useRef, useCallback, useMemo } from 'react';
import {
  ArrowType,
  FlowchartDirection,
  MermaidEdgeDef,
  MermaidFlowchartAST,
  MermaidNodeDef,
  MermaidShapeType,
  MermaidSubgraphDef,
} from '../../ast/types';
import { parseMermaidFlowchart } from '../../ast/parser';
import { serializeMermaidFlowchart } from '../../ast/serializer';
import {
  addChildNode,
  addNode,
  clearEdgeStyle,
  clearEdgesStyle,
  clearNodeStyle,
  clearNodesStyle,
  clearSubgraphStyle,
  connectNodes,
  createSubgraph,
  deleteEdge,
  deleteEdges,
  deleteNode,
  deleteNodes,
  deleteSubgraph,
  duplicateNodes,
  getEdgeStyle,
  getNodeStyle,
  getSubgraphStyle,
  insertNodeOnEdge,
  moveNodeToSubgraph,
  moveNodesToSubgraph,
  renameSubgraph,
  reverseEdgeDirection,
  setDiagramDirection,
  updateEdgeLabel,
  updateEdgeStyle,
  updateEdgeType,
  updateEdgesStyle,
  updateEdgesType,
  updateNodeLabel,
  updateNodeShape,
  updateNodeStyle,
  updateNodesShape,
  updateNodesStyle,
  updateSubgraphStyle,
} from '../../ast/mutations';
import { SupportedDiagramType } from '../../diagrams/types';
import { MermaidStateAST, MermaidStateType } from '../../diagrams/state/types';
import { parseMermaidStateDiagram } from '../../diagrams/state/parser';
import { serializeMermaidStateDiagram } from '../../diagrams/state/serializer';
import * as stateMutations from '../../diagrams/state/mutations';
import { EdgeThemePreset, ThemePreset } from '../constants';

export interface UseDiagramMutationsOptions {
  code: string;
  setCode: (code: string) => void;
  onCodeChange: (code: string) => void;
  pushHistoryState: (code: string) => void;
  diagramType: SupportedDiagramType;
  pinNodeForCamera: (nodeId: string) => void;
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>;
  selectedEdgeId: string | null;
  selectedEdgeIds: Set<string>;
  selectedSubgraphId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;
  setSelectedSubgraphId: (id: string | null) => void;
  setSelectedNodeIds: (ids: Set<string>) => void;
  setSelectedEdgeIds: (ids: Set<string>) => void;
  setSelectedNodeRect: (rect: any) => void;
  setSelectedEdgePos: (pos: any) => void;
  setSelectedSubgraphRect: (rect: any) => void;
  setActiveNodePopover: (p: any) => void;
  setActiveEdgePopover: (p: any) => void;
  setActiveMultiPopover: (p: any) => void;
  setActiveSubgraphPopover: (p: any) => void;
  updateSelectedNodeHalo: (targets: any) => void;
  updateSelectedEdgeHalo: (targets: any) => void;
  selectedNodeIdsRef: React.MutableRefObject<Set<string>>;
  selectedEdgeIdsRef: React.MutableRefObject<Set<string>>;
}

export function useDiagramMutations({
  code,
  setCode,
  onCodeChange,
  pushHistoryState,
  diagramType,
  pinNodeForCamera,
  selectedNodeId,
  selectedNodeIds,
  selectedEdgeId,
  selectedEdgeIds,
  selectedSubgraphId,
  setSelectedNodeId,
  setSelectedEdgeId,
  setSelectedSubgraphId,
  setSelectedNodeIds,
  setSelectedEdgeIds,
  setSelectedNodeRect,
  setSelectedEdgePos,
  setSelectedSubgraphRect,
  setActiveNodePopover,
  setActiveEdgePopover,
  setActiveMultiPopover,
  setActiveSubgraphPopover,
  updateSelectedNodeHalo,
  updateSelectedEdgeHalo,
  selectedNodeIdsRef,
  selectedEdgeIdsRef,
}: UseDiagramMutationsOptions) {
  const isStateDiagram = diagramType === 'stateDiagram';

  const [ast, setAst] = useState<MermaidFlowchartAST>(() => {
    if (isStateDiagram) {
      return {
        diagramType: 'flowchart',
        direction: 'LR',
        nodes: new Map(),
        edges: [],
        subgraphs: new Map(),
        classes: new Map(),
        nodeClasses: new Map(),
        styles: [],
        linkStyles: [],
        classDefs: new Map(),
        rawLines: [],
      };
    }
    try {
      return parseMermaidFlowchart(code);
    } catch {
      return {
        diagramType: 'flowchart',
        direction: 'TD',
        nodes: new Map(),
        edges: [],
        subgraphs: new Map(),
        classes: new Map(),
        nodeClasses: new Map(),
        styles: [],
        linkStyles: [],
        classDefs: new Map(),
        rawLines: [],
      };
    }
  });

  const [stateAst, setStateAst] = useState<MermaidStateAST>(() => {
    if (!isStateDiagram) {
      return {
        diagramType: 'stateDiagram-v2',
        states: new Map(),
        transitions: [],
        compositeStates: new Map(),
        styles: [],
        rawLines: [],
      };
    }
    try {
      return parseMermaidStateDiagram(code);
    } catch {
      return {
        diagramType: 'stateDiagram-v2',
        states: new Map(),
        transitions: [],
        compositeStates: new Map(),
        styles: [],
        rawLines: [],
      };
    }
  });

  const [syntaxError, setSyntaxError] = useState<string | null>(null);
  const clipboardNodesRef = useRef<string[]>([]);

  // Projected nodes map for the canvas overlays
  const displayNodes = useMemo<Map<string, MermaidNodeDef>>(() => {
    if (!isStateDiagram) return ast.nodes;
    const map = new Map<string, MermaidNodeDef>();
    for (const [id, state] of stateAst.states.entries()) {
      let shape: MermaidShapeType = 'rectangle';
      if (state.stateType === 'start' || state.stateType === 'end') {
        shape = 'circle';
      } else if (state.stateType === 'choice') {
        shape = 'diamond';
      } else if (state.stateType === 'fork' || state.stateType === 'join') {
        shape = 'rectangle';
      }
      map.set(id, {
        type: 'node',
        id,
        label: state.label || id,
        shape,
        subgraphId: state.compositeId,
        style: state.style,
      });
    }
    return map;
  }, [isStateDiagram, ast.nodes, stateAst.states]);

  // Projected edges list for the canvas overlays
  const displayEdges = useMemo<MermaidEdgeDef[]>(() => {
    if (!isStateDiagram) return ast.edges;
    return stateAst.transitions.map((tr) => ({
      type: 'edge' as const,
      id: tr.id,
      from: tr.from,
      to: tr.to,
      arrowType: 'arrow' as ArrowType,
      label: tr.label,
      style: tr.style,
    }));
  }, [isStateDiagram, ast.edges, stateAst.transitions]);

  // Projected subgraphs map for the canvas overlays
  const displaySubgraphs = useMemo<Map<string, MermaidSubgraphDef>>(() => {
    if (!isStateDiagram) return ast.subgraphs;
    const map = new Map<string, MermaidSubgraphDef>();
    for (const [id, comp] of stateAst.compositeStates.entries()) {
      map.set(id, {
        type: 'subgraph',
        id,
        label: comp.label,
        direction: (comp.direction as FlowchartDirection) || 'TD',
        nodeIds: comp.stateIds,
        subgraphIds: comp.compositeIds,
        style: comp.style,
      });
    }
    return map;
  }, [isStateDiagram, ast.subgraphs, stateAst.compositeStates]);

  const displayDirection =
    ((isStateDiagram ? stateAst.direction : ast.direction) as FlowchartDirection) ||
    'LR';

  // Apply AST Mutation (Flowchart)
  const applyAstMutation = useCallback(
    (mutator: (currentAst: MermaidFlowchartAST) => void, keepNodeId?: string) => {
      try {
        if (keepNodeId) pinNodeForCamera(keepNodeId);
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
    [ast, pinNodeForCamera, pushHistoryState, setCode, onCodeChange]
  );

  // Apply State AST Mutation
  const applyStateAstMutation = useCallback(
    (mutator: (currentAst: MermaidStateAST) => void, keepNodeId?: string) => {
      try {
        if (keepNodeId) pinNodeForCamera(keepNodeId);
        const newAst: MermaidStateAST = {
          ...stateAst,
          states: new Map(stateAst.states),
          transitions: [...stateAst.transitions],
          compositeStates: new Map(stateAst.compositeStates),
          styles: [...stateAst.styles],
          rawLines: [...stateAst.rawLines],
        };
        mutator(newAst);
        const serialized = serializeMermaidStateDiagram(newAst);
        pushHistoryState(serialized);
        setCode(serialized);
        setStateAst(newAst);
        setSyntaxError(null);
        onCodeChange(serialized);
      } catch (err: any) {
        console.error('State AST Mutation Error:', err);
      }
    },
    [stateAst, pinNodeForCamera, pushHistoryState, setCode, onCodeChange]
  );

  // Node Mutations
  const handleSproutNextStep = useCallback(
    (parentId: string) => {
      let createdChildId: string | null = null;
      if (isStateDiagram) {
        applyStateAstMutation((currentAst) => {
          createdChildId = stateMutations.addChildState(currentAst, parentId, 'Next State');
        }, parentId);
      } else {
        applyAstMutation((currentAst) => {
          const res = addChildNode(currentAst, parentId, 'Next Step');
          createdChildId = res.nodeId;
        }, parentId);
      }
      if (createdChildId) {
        setSelectedNodeId(createdChildId);
      }
    },
    [isStateDiagram, applyStateAstMutation, applyAstMutation, setSelectedNodeId]
  );

  const handleDeleteSelectedNode = useCallback(() => {
    if (!selectedNodeId) return;
    if (isStateDiagram && selectedNodeId === '[*]') return;
    const targetId = selectedNodeId;
    setSelectedNodeId(null);
    setSelectedNodeRect(null);
    setActiveNodePopover(null);
    updateSelectedNodeHalo(new Set());
    if (isStateDiagram) {
      applyStateAstMutation((a) => {
        stateMutations.deleteState(a, targetId);
      });
    } else {
      applyAstMutation((a) => {
        deleteNode(a, targetId);
      });
    }
  }, [
    selectedNodeId,
    setSelectedNodeId,
    setSelectedNodeRect,
    setActiveNodePopover,
    updateSelectedNodeHalo,
    isStateDiagram,
    applyStateAstMutation,
    applyAstMutation,
  ]);

  const handleUpdateNodeShape = useCallback(
    (shape: MermaidShapeType, specificId?: string) => {
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
    },
    [applyAstMutation, selectedNodeIds, selectedNodeId, setActiveNodePopover]
  );

  const handleUpdateStateType = useCallback(
    (type: MermaidStateType, specificId?: string) => {
      const targetId = specificId || selectedNodeId;
      if (!targetId) return;
      applyStateAstMutation((a) => {
        stateMutations.updateStateType(a, targetId, type);
      }, type === 'start' || type === 'end' ? undefined : targetId);

      if (type === 'start' || type === 'end') {
        setSelectedNodeId(null);
        setSelectedNodeRect(null);
        setSelectedNodeIds(new Set());
        selectedNodeIdsRef.current = new Set();
        updateSelectedNodeHalo(null);
      }
      setActiveNodePopover(null);
    },
    [
      selectedNodeId,
      applyStateAstMutation,
      setActiveNodePopover,
      setSelectedNodeId,
      setSelectedNodeRect,
      setSelectedNodeIds,
      selectedNodeIdsRef,
      updateSelectedNodeHalo,
    ]
  );

  const handleBatchUpdateStateType = useCallback(
    (type: MermaidStateType) => {
      const filtered = Array.from(selectedNodeIds).filter((id) => id !== '[*]');
      if (filtered.length === 0) return;
      applyStateAstMutation((a) => {
        for (const nid of filtered) {
          stateMutations.updateStateType(a, nid, type);
        }
      });

      if (type === 'start' || type === 'end') {
        setSelectedNodeId(null);
        setSelectedNodeRect(null);
        setSelectedNodeIds(new Set());
        selectedNodeIdsRef.current = new Set();
        updateSelectedNodeHalo(null);
      }
      setActiveMultiPopover(null);
    },
    [
      selectedNodeIds,
      applyStateAstMutation,
      setActiveMultiPopover,
      setSelectedNodeId,
      setSelectedNodeRect,
      setSelectedNodeIds,
      selectedNodeIdsRef,
      updateSelectedNodeHalo,
    ]
  );

  const handleApplyNodePreset = useCallback(
    (preset: ThemePreset, specificId?: string) => {
      const targets = specificId
        ? [specificId]
        : selectedNodeIds.size > 0
        ? Array.from(selectedNodeIds)
        : selectedNodeId
        ? [selectedNodeId]
        : [];

      if (isStateDiagram) {
        applyStateAstMutation((a) => {
          if (!preset.fill && !preset.stroke && !preset.color) {
            stateMutations.clearStatesStyle(a, targets);
          } else {
            const styles: Record<string, string> = {};
            if (preset.fill) styles['fill'] = preset.fill;
            if (preset.stroke) styles['stroke'] = preset.stroke;
            if (preset.color) styles['color'] = preset.color;
            stateMutations.updateStatesStyle(a, targets, styles);
          }
        }, specificId || selectedNodeId || undefined);
        return;
      }

      applyAstMutation((a) => {
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
    },
    [isStateDiagram, applyStateAstMutation, applyAstMutation, selectedNodeIds, selectedNodeId]
  );

  const handleUpdateCustomStyle = useCallback(
    (property: string, value: string, specificId?: string) => {
      const target = specificId || selectedNodeId;
      if (!target) return;

      if (isStateDiagram) {
        applyStateAstMutation((a) => {
          const currentStyle = stateMutations.getStateStyle(a, target) || {};
          const updated = { ...currentStyle };
          if (value) {
            updated[property] = value;
          } else {
            delete updated[property];
          }
          stateMutations.updateStateStyle(a, target, updated);
        }, specificId || selectedNodeId || undefined);
        return;
      }

      applyAstMutation((a) => {
        const currentStyle = getNodeStyle(a, target) || {};
        const updated = { ...currentStyle };
        if (value) {
          updated[property] = value;
        } else {
          delete updated[property];
        }
        updateNodeStyle(a, target, updated);
      }, specificId || selectedNodeId || undefined);
    },
    [isStateDiagram, applyStateAstMutation, applyAstMutation, selectedNodeId]
  );

  const handleClearNodeStyle = useCallback(
    (specificId?: string) => {
      const target = specificId || selectedNodeId;
      if (!target) return;

      if (isStateDiagram) {
        applyStateAstMutation((a) => {
          stateMutations.clearStateStyle(a, target);
        }, specificId || selectedNodeId || undefined);
        return;
      }

      applyAstMutation((a) => {
        clearNodeStyle(a, target);
      }, specificId || selectedNodeId || undefined);
    },
    [isStateDiagram, applyStateAstMutation, applyAstMutation, selectedNodeId]
  );

  const handleAddStandaloneStep = useCallback(() => {
    let createdNodeId: string | null = null;
    if (isStateDiagram) {
      applyStateAstMutation((a) => {
        createdNodeId = stateMutations.addState(a, 'New State');
      });
    } else {
      applyAstMutation((a) => {
        createdNodeId = addNode(a, 'New Step');
      });
    }
    if (createdNodeId) {
      setSelectedNodeId(createdNodeId);
    }
  }, [isStateDiagram, applyStateAstMutation, applyAstMutation, setSelectedNodeId]);

  const handleToggleDirection = useCallback(() => {
    if (isStateDiagram) {
      const currentDir = stateAst.direction || 'TD';
      const nextDir = currentDir === 'LR' ? 'TD' : 'LR';
      applyStateAstMutation((a) => {
        stateMutations.setStateDiagramDirection(a, nextDir);
      });
    } else {
      const currentDir = ast.direction || 'TD';
      const nextDir = currentDir === 'LR' ? 'TD' : 'LR';
      applyAstMutation((a) => {
        setDiagramDirection(a, nextDir);
      });
    }
  }, [isStateDiagram, stateAst.direction, ast.direction, applyStateAstMutation, applyAstMutation]);

  // Edge Mutations
  const handleChangeEdgeType = useCallback(
    (newType: ArrowType) => {
      if (!selectedEdgeId) return;
      applyAstMutation((a) => {
        updateEdgeType(a, selectedEdgeId, newType);
      });
      setSelectedEdgePos((prev: any) =>
        prev ? { ...prev, arrowType: newType } : null
      );
    },
    [selectedEdgeId, applyAstMutation, setSelectedEdgePos]
  );

  const handleReverseEdge = useCallback(() => {
    if (!selectedEdgeId) return;
    let newEdgeId: string | null = null;
    if (isStateDiagram) {
      applyStateAstMutation((a) => {
        const tr = a.transitions.find((t) => t.id === selectedEdgeId);
        if (tr) {
          const oldFrom = tr.from;
          tr.from = tr.to;
          tr.to = oldFrom;
          newEdgeId = tr.id;
        }
      });
    } else {
      applyAstMutation((a) => {
        newEdgeId = reverseEdgeDirection(a, selectedEdgeId);
      });
    }
    if (newEdgeId) {
      setSelectedEdgeId(newEdgeId);
      setSelectedEdgePos((prev: any) =>
        prev
          ? {
              ...prev,
              from: prev.to,
              to: prev.from,
            }
          : null
      );
    }
  }, [
    selectedEdgeId,
    isStateDiagram,
    applyStateAstMutation,
    applyAstMutation,
    setSelectedEdgeId,
    setSelectedEdgePos,
  ]);

  const handleInsertNodeOnEdge = useCallback(
    (edgeId: string) => {
      let createdNodeId: string | null = null;
      if (isStateDiagram) {
        applyStateAstMutation((a) => {
          const tr = a.transitions.find((t) => t.id === edgeId);
          if (tr) {
            const newStateId = stateMutations.addState(a, 'New State');
            createdNodeId = newStateId;
            const oldTo = tr.to;
            const oldLabel = tr.label;
            tr.to = newStateId;
            delete tr.label;
            stateMutations.connectStates(a, newStateId, oldTo, oldLabel);
          }
        });
      } else {
        applyAstMutation((a) => {
          const res = insertNodeOnEdge(a, edgeId, 'New Step');
          if (res) createdNodeId = res.nodeId;
        });
      }
      setSelectedEdgeId(null);
      setSelectedEdgePos(null);
      if (createdNodeId) {
        setSelectedNodeId(createdNodeId);
      }
    },
    [
      isStateDiagram,
      applyStateAstMutation,
      applyAstMutation,
      setSelectedEdgeId,
      setSelectedEdgePos,
      setSelectedNodeId,
    ]
  );

  const handleDeleteSelectedEdge = useCallback(() => {
    if (!selectedEdgeId) return;
    const targetEdgeId = selectedEdgeId;
    setSelectedEdgeIds(new Set());
    setSelectedEdgePos(null);
    updateSelectedEdgeHalo(new Set());
    if (isStateDiagram) {
      applyStateAstMutation((a) => {
        stateMutations.deleteTransition(a, targetEdgeId);
      });
    } else {
      applyAstMutation((a) => {
        deleteEdge(a, targetEdgeId);
      });
    }
  }, [
    selectedEdgeId,
    setSelectedEdgeIds,
    setSelectedEdgePos,
    updateSelectedEdgeHalo,
    isStateDiagram,
    applyStateAstMutation,
    applyAstMutation,
  ]);

  const handleUpdateEdgeLabel = useCallback(
    (newLabel: string) => {
      if (!selectedEdgeId) return;
      if (isStateDiagram) {
        applyStateAstMutation((a) => {
          stateMutations.updateTransitionLabel(a, selectedEdgeId, newLabel);
        });
      } else {
        applyAstMutation((a) => {
          updateEdgeLabel(a, selectedEdgeId, newLabel);
        });
      }
      setSelectedEdgePos((prev: any) =>
        prev ? { ...prev, label: newLabel } : null
      );
    },
    [selectedEdgeId, isStateDiagram, applyStateAstMutation, applyAstMutation, setSelectedEdgePos]
  );

  const handleApplyEdgePreset = useCallback(
    (preset: EdgeThemePreset) => {
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
    },
    [selectedEdgeId, applyAstMutation]
  );

  const handleUpdateEdgeCustomStyle = useCallback(
    (property: string, value: string) => {
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
    },
    [selectedEdgeId, applyAstMutation]
  );

  const handleClearEdgeStyle = useCallback(() => {
    if (!selectedEdgeId) return;
    applyAstMutation((a) => {
      clearEdgeStyle(a, selectedEdgeId);
    });
  }, [selectedEdgeId, applyAstMutation]);

  // Subgraph / Group Mutations
  const handleAddGroup = useCallback(() => {
    if (isStateDiagram) {
      applyStateAstMutation((currentAst) => {
        const compId = stateMutations.createCompositeState(currentAst, 'Composite State');
        stateMutations.addState(currentAst, 'State 1', 'normal', compId);
      });
      return;
    }
    applyAstMutation((currentAst) => {
      const newNodeId = addNode(currentAst, 'Step 1');
      createSubgraph(currentAst, 'New Group', [newNodeId]);
    });
  }, [isStateDiagram, applyStateAstMutation, applyAstMutation]);

  const handleApplySubgraphPreset = useCallback(
    (preset: ThemePreset) => {
      if (!selectedSubgraphId) return;
      const target = selectedSubgraphId;

      if (isStateDiagram) {
        applyStateAstMutation((a) => {
          if (!preset.fill && !preset.stroke && !preset.color) {
            stateMutations.clearCompositeStateStyle(a, target);
          } else {
            const styles: Record<string, string> = {};
            if (preset.fill) styles['fill'] = preset.fill;
            if (preset.stroke) styles['stroke'] = preset.stroke;
            if (preset.color) styles['color'] = preset.color;
            stateMutations.updateCompositeStateStyle(a, target, styles);
          }
        });
        return;
      }

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
    [selectedSubgraphId, isStateDiagram, applyStateAstMutation, applyAstMutation]
  );

  const handleUpdateSubgraphCustomStyle = useCallback(
    (property: string, value: string) => {
      if (!selectedSubgraphId) return;
      const target = selectedSubgraphId;

      if (isStateDiagram) {
        applyStateAstMutation((a) => {
          const currentStyle = stateMutations.getCompositeStateStyle(a, target) || {};
          const updated = { ...currentStyle };
          if (value) {
            updated[property] = value;
          } else {
            delete updated[property];
          }
          stateMutations.updateCompositeStateStyle(a, target, updated);
        });
        return;
      }

      applyAstMutation((a) => {
        const currentStyle = getSubgraphStyle(a, target) || {};
        const updated = { ...currentStyle };
        if (value) {
          updated[property] = value;
        } else {
          delete updated[property];
        }
        updateSubgraphStyle(a, target, updated);
      });
    },
    [selectedSubgraphId, isStateDiagram, applyStateAstMutation, applyAstMutation]
  );

  const handleClearSubgraphStyle = useCallback(() => {
    if (!selectedSubgraphId) return;

    if (isStateDiagram) {
      applyStateAstMutation((a) => {
        stateMutations.clearCompositeStateStyle(a, selectedSubgraphId);
      });
      return;
    }

    applyAstMutation((a) => {
      clearSubgraphStyle(a, selectedSubgraphId);
    });
  }, [selectedSubgraphId, isStateDiagram, applyStateAstMutation, applyAstMutation]);

  const handleDissolveSubgraph = useCallback(() => {
    if (!selectedSubgraphId) return;
    if (isStateDiagram) {
      applyStateAstMutation((currentAst) => {
        stateMutations.deleteCompositeState(currentAst, selectedSubgraphId, false);
      });
    } else {
      applyAstMutation((currentAst) => {
        deleteSubgraph(currentAst, selectedSubgraphId, false);
      });
    }
    setSelectedSubgraphId(null);
    setSelectedSubgraphRect(null);
    setActiveSubgraphPopover(null);
  }, [
    selectedSubgraphId,
    isStateDiagram,
    applyStateAstMutation,
    applyAstMutation,
    setSelectedSubgraphId,
    setSelectedSubgraphRect,
    setActiveSubgraphPopover,
  ]);

  const handleDeleteSubgraphAll = useCallback(() => {
    if (!selectedSubgraphId) return;
    if (isStateDiagram) {
      applyStateAstMutation((currentAst) => {
        stateMutations.deleteCompositeState(currentAst, selectedSubgraphId, true);
      });
    } else {
      applyAstMutation((currentAst) => {
        deleteSubgraph(currentAst, selectedSubgraphId, true);
      });
    }
    setSelectedSubgraphId(null);
    setSelectedSubgraphRect(null);
    setActiveSubgraphPopover(null);
  }, [
    selectedSubgraphId,
    isStateDiagram,
    applyStateAstMutation,
    applyAstMutation,
    setSelectedSubgraphId,
    setSelectedSubgraphRect,
    setActiveSubgraphPopover,
  ]);

  const handleRenameSubgraph = useCallback(
    (subId: string, label: string) => {
      if (isStateDiagram) {
        applyStateAstMutation((a) => {
          stateMutations.renameCompositeState(a, subId, label);
        });
      } else {
        applyAstMutation((a) => {
          renameSubgraph(a, subId, label);
        });
      }
    },
    [isStateDiagram, applyStateAstMutation, applyAstMutation]
  );

  const handleMoveNodeToSubgraph = useCallback(
    (nodeId: string, subId: string | null) => {
      if (isStateDiagram) {
        applyStateAstMutation((currentAst) => {
          stateMutations.moveStateToComposite(currentAst, nodeId, subId || undefined);
        }, nodeId);
      } else {
        applyAstMutation((currentAst) => {
          moveNodeToSubgraph(currentAst, nodeId, subId);
        }, nodeId);
      }
    },
    [isStateDiagram, applyStateAstMutation, applyAstMutation]
  );

  const handleCreateGroupWithNode = useCallback(
    (nodeId: string) => {
      if (isStateDiagram) {
        applyStateAstMutation((currentAst) => {
          const compId = stateMutations.createCompositeState(currentAst, 'Composite State');
          stateMutations.moveStateToComposite(currentAst, nodeId, compId);
        }, nodeId);
      } else {
        applyAstMutation((currentAst) => {
          createSubgraph(currentAst, 'New Group', [nodeId]);
        }, nodeId);
      }
    },
    [isStateDiagram, applyStateAstMutation, applyAstMutation]
  );

  // Batch Mutations
  const handleBatchDeleteSelected = useCallback(() => {
    if (selectedSubgraphId) {
      if (isStateDiagram) {
        applyStateAstMutation((a) => {
          stateMutations.deleteCompositeState(a, selectedSubgraphId, false);
        });
      } else {
        applyAstMutation((a) => {
          deleteSubgraph(a, selectedSubgraphId, false);
        });
      }
      setSelectedSubgraphId(null);
      setSelectedSubgraphRect(null);
      setActiveSubgraphPopover(null);
      return;
    }

    if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) return;
    const nodesToDelete = Array.from(selectedNodeIds).filter((id) => !(isStateDiagram && id === '[*]'));
    const edgesToDelete = Array.from(selectedEdgeIds);

    const empty = new Set<string>();
    if (selectedNodeIdsRef.current) selectedNodeIdsRef.current = empty;
    if (selectedEdgeIdsRef.current) selectedEdgeIdsRef.current = new Set<string>();
    setSelectedNodeIds(new Set());
    setSelectedEdgeIds(new Set());
    setSelectedNodeRect(null);
    setSelectedEdgePos(null);
    setActiveNodePopover(null);
    setActiveEdgePopover(null);
    setActiveMultiPopover(null);
    updateSelectedNodeHalo(new Set());
    updateSelectedEdgeHalo(new Set());

    if (isStateDiagram) {
      applyStateAstMutation((a) => {
        if (nodesToDelete.length > 0) {
          stateMutations.deleteStates(a, nodesToDelete);
        }
        if (edgesToDelete.length > 0) {
          stateMutations.deleteTransitions(a, edgesToDelete);
        }
      });
    } else {
      applyAstMutation((a) => {
        if (nodesToDelete.length > 0) {
          deleteNodes(a, nodesToDelete);
        }
        if (edgesToDelete.length > 0) {
          deleteEdges(a, edgesToDelete);
        }
      });
    }
  }, [
    selectedSubgraphId,
    selectedNodeIds,
    selectedEdgeIds,
    selectedNodeIdsRef,
    selectedEdgeIdsRef,
    setSelectedNodeIds,
    setSelectedEdgeIds,
    setSelectedNodeRect,
    setSelectedEdgePos,
    setActiveNodePopover,
    setActiveEdgePopover,
    setActiveMultiPopover,
    updateSelectedNodeHalo,
    updateSelectedEdgeHalo,
    isStateDiagram,
    applyStateAstMutation,
    applyAstMutation,
    setSelectedSubgraphId,
    setSelectedSubgraphRect,
    setActiveSubgraphPopover,
  ]);

  const handleBatchUpdateShape = useCallback(
    (shape: MermaidShapeType) => {
      if (selectedNodeIds.size === 0) return;
      applyAstMutation((a) => {
        updateNodesShape(a, selectedNodeIds, shape);
      });
      setActiveMultiPopover(null);
    },
    [selectedNodeIds, applyAstMutation, setActiveMultiPopover]
  );

  const handleBatchUpdateEdgeType = useCallback(
    (newType: ArrowType) => {
      if (selectedEdgeIds.size === 0) return;
      applyAstMutation((a) => {
        updateEdgesType(a, selectedEdgeIds, newType);
      });
      setActiveMultiPopover(null);
    },
    [selectedEdgeIds, applyAstMutation, setActiveMultiPopover]
  );

  const handleBatchApplyThemePreset = useCallback(
    (preset: ThemePreset) => {
      if (isStateDiagram) {
        applyStateAstMutation((a) => {
          if (selectedNodeIds.size > 0) {
            if (!preset.fill && !preset.stroke && !preset.color) {
              stateMutations.clearStatesStyle(a, selectedNodeIds);
            } else {
              const styles: Record<string, string> = {};
              if (preset.fill) styles['fill'] = preset.fill;
              if (preset.stroke) styles['stroke'] = preset.stroke;
              if (preset.color) styles['color'] = preset.color;
              stateMutations.updateStatesStyle(a, selectedNodeIds, styles);
            }
          }
        });
        return;
      }

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
    },
    [isStateDiagram, applyStateAstMutation, applyAstMutation, selectedNodeIds, selectedEdgeIds]
  );

  const handleBatchUpdateCustomStyle = useCallback(
    (property: string, value: string) => {
      if (isStateDiagram) {
        applyStateAstMutation((a) => {
          if (selectedNodeIds.size > 0) {
            for (const nid of selectedNodeIds) {
              const currentStyle = stateMutations.getStateStyle(a, nid) || {};
              const updated = { ...currentStyle };
              if (value) updated[property] = value;
              else delete updated[property];
              stateMutations.updateStateStyle(a, nid, updated);
            }
          }
        });
        return;
      }

      applyAstMutation((a) => {
        if (selectedNodeIds.size > 0) {
          for (const nid of selectedNodeIds) {
            const currentStyle = getNodeStyle(a, nid) || {};
            const updated = { ...currentStyle };
            if (value) updated[property] = value;
            else delete updated[property];
            updateNodeStyle(a, nid, updated);
          }
        }
        if (selectedEdgeIds.size > 0) {
          for (const eid of selectedEdgeIds) {
            const currentStyle = getEdgeStyle(a, eid) || {};
            const updated = { ...currentStyle };
            if (value) updated[property] = value;
            else delete updated[property];
            updateEdgeStyle(a, eid, updated);
          }
        }
      });
    },
    [isStateDiagram, applyStateAstMutation, applyAstMutation, selectedNodeIds, selectedEdgeIds]
  );

  const handleBatchClearStyle = useCallback(() => {
    if (isStateDiagram) {
      applyStateAstMutation((a) => {
        if (selectedNodeIds.size > 0) {
          stateMutations.clearStatesStyle(a, selectedNodeIds);
        }
      });
      return;
    }

    applyAstMutation((a) => {
      if (selectedNodeIds.size > 0) {
        clearNodesStyle(a, selectedNodeIds);
      }
      if (selectedEdgeIds.size > 0) {
        clearEdgesStyle(a, selectedEdgeIds);
      }
    });
  }, [isStateDiagram, applyStateAstMutation, applyAstMutation, selectedNodeIds, selectedEdgeIds]);

  const handleBatchGroupSelected = useCallback(() => {
    if (isStateDiagram) {
      const filtered = Array.from(selectedNodeIds).filter((id) => id !== '[*]');
      if (filtered.length === 0) return;
      applyStateAstMutation((currentAst) => {
        const compId = stateMutations.createCompositeState(currentAst, 'Composite State');
        for (const nid of filtered) {
          stateMutations.moveStateToComposite(currentAst, nid, compId);
        }
      });
    } else {
      applyAstMutation((currentAst) => {
        createSubgraph(currentAst, 'New Group', selectedNodeIds);
      });
    }
  }, [isStateDiagram, applyStateAstMutation, applyAstMutation, selectedNodeIds]);

  const handleBatchUngroupSelected = useCallback(() => {
    if (isStateDiagram) {
      const filtered = Array.from(selectedNodeIds).filter((id) => id !== '[*]');
      if (filtered.length === 0) return;
      applyStateAstMutation((currentAst) => {
        for (const nid of filtered) {
          stateMutations.moveStateToComposite(currentAst, nid, undefined);
        }
      });
    } else {
      applyAstMutation((currentAst) => {
        moveNodesToSubgraph(currentAst, selectedNodeIds, null);
      });
    }
  }, [isStateDiagram, applyStateAstMutation, applyAstMutation, selectedNodeIds]);

  // Clipboard Mutations
  const handleDuplicateSelected = useCallback(() => {
    if (selectedNodeIds.size === 0) return;
    const filteredIds = isStateDiagram
      ? new Set(Array.from(selectedNodeIds).filter((id) => id !== '[*]'))
      : selectedNodeIds;
    if (filteredIds.size === 0) return;
    if (isStateDiagram) {
      applyStateAstMutation((currentAst) => {
        const result = stateMutations.duplicateStates(currentAst, filteredIds);
        if (result.stateIds.length > 0) {
          const newSet = new Set(result.stateIds);
          const newEdges = new Set(result.transitionIds);
          if (selectedNodeIdsRef.current) selectedNodeIdsRef.current = newSet;
          if (selectedEdgeIdsRef.current) selectedEdgeIdsRef.current = newEdges;
          setSelectedNodeIds(newSet);
          setSelectedEdgeIds(newEdges);
          updateSelectedNodeHalo(newSet);
          updateSelectedEdgeHalo(newEdges);
        }
      });
      return;
    }

    applyAstMutation((currentAst) => {
      const result = duplicateNodes(currentAst, selectedNodeIds);
      if (result.nodeIds.length > 0) {
        const newSet = new Set(result.nodeIds);
        const newEdges = new Set(result.edgeIds);
        if (selectedNodeIdsRef.current) selectedNodeIdsRef.current = newSet;
        if (selectedEdgeIdsRef.current) selectedEdgeIdsRef.current = newEdges;
        setSelectedNodeIds(newSet);
        setSelectedEdgeIds(newEdges);
        updateSelectedNodeHalo(newSet);
        updateSelectedEdgeHalo(newEdges);
      }
    });
  }, [
    isStateDiagram,
    applyStateAstMutation,
    selectedNodeIds,
    applyAstMutation,
    selectedNodeIdsRef,
    selectedEdgeIdsRef,
    setSelectedNodeIds,
    setSelectedEdgeIds,
    updateSelectedNodeHalo,
    updateSelectedEdgeHalo,
  ]);

  const handleCopySelected = useCallback(() => {
    if (selectedNodeIds.size > 0) {
      const filtered = Array.from(selectedNodeIds).filter((id) => !(isStateDiagram && id === '[*]'));
      if (filtered.length > 0) clipboardNodesRef.current = filtered;
    }
  }, [selectedNodeIds, isStateDiagram]);

  const handlePasteSelected = useCallback(() => {
    if (clipboardNodesRef.current.length === 0) return;
    if (isStateDiagram) {
      applyStateAstMutation((currentAst) => {
        const result = stateMutations.duplicateStates(currentAst, clipboardNodesRef.current);
        if (result.stateIds.length > 0) {
          const newSet = new Set(result.stateIds);
          const newEdges = new Set(result.transitionIds);
          if (selectedNodeIdsRef.current) selectedNodeIdsRef.current = newSet;
          if (selectedEdgeIdsRef.current) selectedEdgeIdsRef.current = newEdges;
          setSelectedNodeIds(newSet);
          setSelectedEdgeIds(newEdges);
          updateSelectedNodeHalo(newSet);
          updateSelectedEdgeHalo(newEdges);
        }
      });
      return;
    }

    applyAstMutation((currentAst) => {
      const result = duplicateNodes(currentAst, clipboardNodesRef.current);
      if (result.nodeIds.length > 0) {
        const newSet = new Set(result.nodeIds);
        const newEdges = new Set(result.edgeIds);
        if (selectedNodeIdsRef.current) selectedNodeIdsRef.current = newSet;
        if (selectedEdgeIdsRef.current) selectedEdgeIdsRef.current = newEdges;
        setSelectedNodeIds(newSet);
        setSelectedEdgeIds(newEdges);
        updateSelectedNodeHalo(newSet);
        updateSelectedEdgeHalo(newEdges);
      }
    });
  }, [
    isStateDiagram,
    applyStateAstMutation,
    applyAstMutation,
    selectedNodeIdsRef,
    selectedEdgeIdsRef,
    setSelectedNodeIds,
    setSelectedEdgeIds,
    updateSelectedNodeHalo,
    updateSelectedEdgeHalo,
  ]);

  const hasStartState = isStateDiagram
    ? stateMutations.hasStartState(stateAst)
    : false;
  const hasEndState = isStateDiagram
    ? stateMutations.hasEndState(stateAst)
    : false;

  const handleAddStartState = useCallback(() => {
    if (!isStateDiagram) return;
    let createdId: string | null = null;
    applyStateAstMutation((a) => {
      createdId = stateMutations.addStartState(a, 'New State');
    });
    if (createdId) {
      setSelectedNodeId(createdId);
    }
  }, [isStateDiagram, applyStateAstMutation, setSelectedNodeId]);

  const handleAddEndState = useCallback(() => {
    if (!isStateDiagram) return;
    let createdId: string | null = null;
    applyStateAstMutation((a) => {
      createdId = stateMutations.addEndState(a, 'New State');
    });
    if (createdId) {
      setSelectedNodeId(createdId);
    }
  }, [isStateDiagram, applyStateAstMutation, setSelectedNodeId]);

  return {
    ast,
    setAst,
    stateAst,
    setStateAst,
    displayNodes,
    displayEdges,
    displaySubgraphs,
    displayDirection,
    syntaxError,
    setSyntaxError,
    applyAstMutation,
    applyStateAstMutation,

    // Handlers
    handleSproutNextStep,
    handleDeleteSelectedNode,
    handleUpdateNodeShape,
    handleUpdateStateType,
    handleBatchUpdateStateType,
    handleApplyNodePreset,
    handleUpdateCustomStyle,
    handleClearNodeStyle,
    handleAddStartState,
    handleAddEndState,
    hasStartState,
    hasEndState,
    handleAddStandaloneStep,
    handleToggleDirection,

    handleChangeEdgeType,
    handleReverseEdge,
    handleInsertNodeOnEdge,
    handleDeleteSelectedEdge,
    handleUpdateEdgeLabel,
    handleApplyEdgePreset,
    handleUpdateEdgeCustomStyle,
    handleClearEdgeStyle,

    handleAddGroup,
    handleApplySubgraphPreset,
    handleUpdateSubgraphCustomStyle,
    handleClearSubgraphStyle,
    handleDissolveSubgraph,
    handleDeleteSubgraphAll,
    handleRenameSubgraph,
    handleMoveNodeToSubgraph,
    handleCreateGroupWithNode,

    handleBatchDeleteSelected,
    handleBatchUpdateShape,
    handleBatchUpdateEdgeType,
    handleBatchApplyThemePreset,
    handleBatchUpdateCustomStyle,
    handleBatchClearStyle,
    handleBatchGroupSelected,
    handleBatchUngroupSelected,

    handleDuplicateSelected,
    handleCopySelected,
    handlePasteSelected,
  };
}
