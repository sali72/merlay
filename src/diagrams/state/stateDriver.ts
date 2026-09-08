/**
 * State diagram driver: wires the state parser/serializer and mutations into
 * the unified DiagramDriver contract.
 */

import { DiagramDriver } from '../types';
import {
  FlowchartDirection,
  MermaidEdgeDef,
  MermaidNodeDef,
  MermaidShapeType,
  MermaidSubgraphDef,
} from '../viewModel';
import { MermaidStateAST, MermaidStateType, StateDirection } from './types';
import { parseMermaidStateDiagram } from './parser';
import { serializeMermaidStateDiagram } from './serializer';
import * as st from './mutations';

const STATE_KIND_OPTIONS = [
  { kind: 'normal', label: 'Normal State' },
  { kind: 'choice', label: 'Choice <<choice>>' },
  { kind: 'fork', label: 'Fork <<fork>>' },
  { kind: 'join', label: 'Join <<join>>' },
];

/** Map a state type onto the shared flowchart-shaped view model. */
function stateTypeToShape(stateType: MermaidStateType): MermaidShapeType {
  if (stateType === 'start' || stateType === 'end') return 'circle';
  if (stateType === 'choice') return 'diamond';
  return 'rectangle'; // normal, fork, join
}

function cloneStateAst(ast: MermaidStateAST): MermaidStateAST {
  return {
    ...ast,
    states: new Map(Array.from(ast.states, ([id, s]) => [id, { ...s }])),
    transitions: ast.transitions.map((t) => ({ ...t })),
    compositeStates: new Map(
      Array.from(ast.compositeStates, ([id, c]) => [
        id,
        {
          ...c,
          stateIds: [...c.stateIds],
          compositeIds: [...c.compositeIds],
        },
      ])
    ),
    styles: ast.styles.map((s) => ({ ...s })),
    rawLines: ast.rawLines.map((r) => ({ ...r })),
  };
}

function createEmptyStateAst(): MermaidStateAST {
  return {
    diagramType: 'stateDiagram-v2',
    states: new Map(),
    transitions: [],
    compositeStates: new Map(),
    styles: [],
    rawLines: [],
  };
}

export const StateDiagramDriver: DiagramDriver<MermaidStateAST> = {
  type: 'stateDiagram',
  displayName: 'State Diagram',
  supportsDirection: true,
  canHandle(code: string): boolean {
    const trimmed = code.trim();
    return /^stateDiagram(-v2)?\b/i.test(trimmed);
  },
  parse(code: string): MermaidStateAST {
    return parseMermaidStateDiagram(code);
  },
  serialize(ast: MermaidStateAST): string {
    return serializeMermaidStateDiagram(ast);
  },
  createDefault(direction = 'LR'): string {
    const dirLine = direction ? `    direction ${direction}\n` : '';
    return `stateDiagram-v2\n${dirLine}    [*] --> Idle\n    Idle --> Processing : Submit\n    Processing --> Success : Approve\n    Processing --> Failed : Reject\n    Success --> [*]\n    Failed --> Idle : Retry\n`;
  },
  clone: cloneStateAst,
  createEmpty: createEmptyStateAst,
  project(ast: MermaidStateAST) {
    const nodes = new Map<string, MermaidNodeDef>();
    for (const [id, state] of ast.states.entries()) {
      nodes.set(id, {
        type: 'node',
        id,
        label: state.label || id,
        shape: stateTypeToShape(state.stateType),
        // [*] is both start and end — the DOM adapter owns start/end
        // disambiguation, so the projection carries no single kind for it.
        kind: id === '[*]' ? undefined : state.stateType,
        subgraphId: state.compositeId,
        style: state.style,
      });
    }
    const edges: MermaidEdgeDef[] = ast.transitions.map((tr) => ({
      type: 'edge' as const,
      id: tr.id,
      from: tr.from,
      to: tr.to,
      arrowType: 'arrow' as const,
      label: tr.label,
      style: tr.style,
    }));
    const subgraphs = new Map<string, MermaidSubgraphDef>();
    for (const [id, comp] of ast.compositeStates.entries()) {
      subgraphs.set(id, {
        type: 'subgraph',
        id,
        label: comp.label,
        direction: (comp.direction as FlowchartDirection) || 'TD',
        nodeIds: comp.stateIds,
        subgraphIds: comp.compositeIds,
        style: comp.style,
      });
    }
    return {
      nodes,
      edges,
      subgraphs,
      direction: ast.direction as FlowchartDirection | undefined,
    };
  },

  capabilities: {
    supportsDirection: true,
    supportsNodeKinds: true,
    supportsEdgeTypes: false,
    supportsEdgeStyles: false,
    supportsGroups: true,
    hasAnchors: true,
  },

  labels: {
    node: 'State',
    nodes: 'States',
    edge: 'Transition',
    edges: 'Transitions',
    group: 'Composite',
    addNode: 'Add State',
    addGroup: 'Add Composite',
    addChild: 'Next State',
    insertNodeOnEdge: 'Insert State',
    edgeLabelPlaceholder: 'Event / Condition (e.g. onClick)...',
  },

  nodeKindOptions: STATE_KIND_OPTIONS,

  mutations: {
    addNode: (ast, label) => st.addState(ast, label),
    addChildNode: (ast, parentId, label) => st.addChildState(ast, parentId, label),
    deleteNode: (ast, nodeId) => {
      st.deleteState(ast, nodeId);
    },
    deleteNodes: (ast, nodeIds) => {
      st.deleteStates(ast, Array.from(nodeIds).filter((id) => id !== '[*]'));
    },
    updateNodeLabel: (ast, nodeId, label) => {
      st.updateStateLabel(ast, nodeId, label);
    },
    isNodeTextEditable: (ast, nodeId) =>
      st.isStateTextEditable(ast.states.get(nodeId)),
    updateNodeKind: (ast, nodeId, kind) => {
      st.updateStateType(ast, nodeId, kind as MermaidStateType);
    },
    updateNodesKind: (ast, nodeIds, kind) => {
      for (const id of nodeIds) {
        st.updateStateType(ast, id, kind as MermaidStateType);
      }
    },

    connect: (ast, fromId, toId) => {
      st.connectStates(ast, fromId, toId);
    },
    deleteEdge: (ast, edgeId) => {
      st.deleteTransition(ast, edgeId);
    },
    deleteEdges: (ast, edgeIds) => {
      st.deleteTransitions(ast, edgeIds);
    },
    updateEdgeLabel: (ast, edgeId, label) => {
      st.updateTransitionLabel(ast, edgeId, label);
    },
    reverseEdge: (ast, edgeId) => {
      const tr = ast.transitions.find((t) => t.id === edgeId);
      if (!tr) return null;
      const oldFrom = tr.from;
      tr.from = tr.to;
      tr.to = oldFrom;
      return tr.id;
    },
    insertNodeOnEdge: (ast, edgeId, label) =>
      st.insertStateOnTransition(ast, edgeId, label),

    getNodeStyle: (ast, nodeId) => st.getStateStyle(ast, nodeId),
    updateNodeStyle: (ast, nodeId, styles) => {
      if (styles && Object.keys(styles).length > 0) {
        st.updateStateStyle(ast, nodeId, styles);
      } else {
        st.clearStateStyle(ast, nodeId);
      }
    },
    updateNodesStyle: (ast, nodeIds, styles) => {
      const ids = Array.from(nodeIds).filter((id) => id !== '[*]');
      if (styles && Object.keys(styles).length > 0) {
        st.updateStatesStyle(ast, ids, styles);
      } else {
        st.clearStatesStyle(ast, ids);
      }
    },
    clearNodeStyle: (ast, nodeId) => {
      st.clearStateStyle(ast, nodeId);
    },
    clearNodesStyle: (ast, nodeIds) => {
      st.clearStatesStyle(ast, nodeIds);
    },

    getGroupStyle: (ast, groupId) => st.getCompositeStateStyle(ast, groupId),
    updateGroupStyle: (ast, groupId, styles) => {
      if (styles && Object.keys(styles).length > 0) {
        st.updateCompositeStateStyle(ast, groupId, styles);
      } else {
        st.clearCompositeStateStyle(ast, groupId);
      }
    },
    clearGroupStyle: (ast, groupId) => {
      st.clearCompositeStateStyle(ast, groupId);
    },
    createGroup: (ast, label) => {
      const compId = st.createCompositeState(ast, label);
      st.addState(ast, 'State 1', 'normal', compId);
      return compId;
    },
    createGroupWithMembers: (ast, label, nodeIds) => {
      const compId = st.createCompositeState(ast, label);
      for (const nid of nodeIds) {
        st.moveStateToComposite(ast, nid, compId);
      }
      return compId;
    },
    deleteGroup: (ast, groupId, deleteMembers) => {
      st.deleteCompositeState(ast, groupId, deleteMembers);
    },
    renameGroup: (ast, groupId, label) => {
      st.renameCompositeState(ast, groupId, label);
    },
    moveNodeToGroup: (ast, nodeId, groupId) => {
      st.moveStateToComposite(ast, nodeId, groupId || undefined);
    },
    moveNodesToGroup: (ast, nodeIds, groupId) => {
      for (const nid of nodeIds) {
        st.moveStateToComposite(ast, nid, groupId || undefined);
      }
    },

    duplicateNodes: (ast, nodeIds) => {
      const res = st.duplicateStates(ast, nodeIds);
      return { nodeIds: res.stateIds, edgeIds: res.transitionIds };
    },

    getDirection: (ast) => ast.direction,
    setDirection: (ast, direction) => {
      st.setStateDiagramDirection(ast, direction as StateDirection);
    },

    anchors: {
      isAnchor: (nodeId) => nodeId === '[*]',
      has: (ast, kind) =>
        kind === 'start'
          ? ast.transitions.some((t) => t.from === '[*]')
          : ast.transitions.some((t) => t.to === '[*]'),
      add: (ast, kind) =>
        kind === 'start' ? st.addStartState(ast, 'New State') : st.addEndState(ast, 'New State'),
      connectToEnd: (ast, nodeId) => {
        st.connectToEndState(ast, nodeId);
      },
      delete: (ast, kind) => {
        if (kind === 'start') st.deleteStartAnchor(ast);
        else if (kind === 'end') st.deleteEndAnchor(ast);
        else {
          st.deleteStartAnchor(ast);
          st.deleteEndAnchor(ast);
        }
      },
    },
  },

  dom: {
    nodeIdPrefixes: ['state-'],
    anchorSelectors: '.state-start, .state-end, [id*="root_start"], [id*="root_end"]',
    anchorNodeId: '[*]',
    isAnchorElement(el) {
      const idAttr = el.getAttribute('id') || '';
      return (
        el.classList.contains('state-start') ||
        el.classList.contains('state-end') ||
        idAttr.includes('root_start') ||
        idAttr.includes('root_end') ||
        el.classList.contains('outer-path') ||
        !!el.querySelector?.('.outer-path')
      );
    },
    getAnchorKind(el) {
      const attr = el.getAttribute('data-mermaid-start-end');
      if (attr === 'start' || attr === 'end') return attr;
      const idAttr = el.getAttribute('id') || '';
      if (idAttr.includes('root_start') || idAttr.includes('_start-')) return 'start';
      if (idAttr.includes('root_end') || idAttr.includes('_end-')) return 'end';
      if (el.classList.contains('state-start')) return 'start';
      if (el.classList.contains('state-end')) return 'end';
      try {
        if (el.querySelector('.state-start')) return 'start';
        if (el.querySelector('.state-end')) return 'end';
        if (el.querySelector('.outer-path')) return 'end';
      } catch {
        /* ignore */
      }
      return null;
    },
  },
};
