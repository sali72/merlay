/**
 * Hook to manage AST state, projections (displayNodes, displayEdges, displaySubgraphs),
 * and applying mutations for Flowcharts and State Diagrams.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  ArrowType,
  FlowchartDirection,
  MermaidEdgeDef,
  MermaidFlowchartAST,
  MermaidNodeDef,
  MermaidShapeType,
  MermaidSubgraphDef,
} from '../../../ast/types';
import { parseMermaidFlowchart } from '../../../ast/parser';
import { serializeMermaidFlowchart } from '../../../ast/serializer';
import { SupportedDiagramType } from '../../../diagrams/types';
import { MermaidStateAST } from '../../../diagrams/state/types';
import { parseMermaidStateDiagram } from '../../../diagrams/state/parser';
import { serializeMermaidStateDiagram } from '../../../diagrams/state/serializer';

export interface UseDiagramAstOptions {
  code: string;
  setCode: (code: string) => void;
  onCodeChange: (code: string) => void;
  pushHistoryState: (code: string) => void;
  diagramType: SupportedDiagramType;
  pinNodeForCamera: (nodeId: string) => void;
}

export function useDiagramAst({
  code,
  setCode,
  onCodeChange,
  pushHistoryState,
  diagramType,
  pinNodeForCamera,
}: UseDiagramAstOptions) {
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

  return {
    isStateDiagram,
    ast,
    setAst,
    stateAst,
    setStateAst,
    syntaxError,
    setSyntaxError,
    displayNodes,
    displayEdges,
    displaySubgraphs,
    displayDirection,
    applyAstMutation,
    applyStateAstMutation,
  };
}
