import test from 'node:test';
import assert from 'node:assert';
import { parseMermaidStateDiagram } from '../src/diagrams/state/parser';
import { serializeMermaidStateDiagram } from '../src/diagrams/state/serializer';
import {
  addChildState,
  addState,
  connectStates,
  createCompositeState,
  deleteState,
  deleteTransition,
  moveStateToComposite,
  updateStateLabel,
  updateStateType,
  updateTransitionLabel,
  updateStateStyle,
  clearStateStyle,
  updateStatesStyle,
  clearStatesStyle,
  updateCompositeStateStyle,
  duplicateStates,
} from '../src/diagrams/state/mutations';

test('State Mutations: addState and addChildState sprouting', () => {
  const ast = parseMermaidStateDiagram('stateDiagram-v2\n    [*] --> Idle');
  const s2 = addChildState(ast, 'Idle', 'Processing', 'submit');

  assert.strictEqual(ast.states.has(s2), true);
  assert.strictEqual(ast.states.get(s2)?.label, 'Processing');
  const tr = ast.transitions.find((t) => t.from === 'Idle' && t.to === s2);
  assert.ok(tr);
  assert.strictEqual(tr?.label, 'submit');

  const serialized = serializeMermaidStateDiagram(ast);
  assert.match(serialized, /Idle --> s_.* : submit/);
});

test('State Mutations: connectStates and deleteTransition', () => {
  const ast = parseMermaidStateDiagram('stateDiagram-v2\n    [*] --> S1\n    S2 --> [*]');
  const tr = connectStates(ast, 'S1', 'S2', 'transition');
  assert.ok(tr);
  assert.strictEqual(ast.transitions.length, 3);

  deleteTransition(ast, tr!.id);
  assert.strictEqual(ast.transitions.length, 2);
});

test('State Mutations: deleteState cascades transitions', () => {
  const ast = parseMermaidStateDiagram(`stateDiagram-v2
    [*] --> A
    A --> B : to B
    B --> C : to C
    C --> [*]`);

  assert.strictEqual(ast.transitions.length, 4);
  deleteState(ast, 'B');

  assert.strictEqual(ast.states.has('B'), false);
  // Transitions connected to B (A --> B and B --> C) should be deleted
  assert.strictEqual(ast.transitions.length, 2);
  assert.strictEqual(ast.transitions.some((t) => t.from === 'B' || t.to === 'B'), false);
});

test('State Mutations: updateStateLabel and updateStateType morphing', () => {
  const ast = parseMermaidStateDiagram('stateDiagram-v2\n    [*] --> Decision');
  updateStateLabel(ast, 'Decision', 'Check Condition');
  assert.strictEqual(ast.states.get('Decision')?.label, 'Check Condition');

  updateStateType(ast, 'Decision', 'choice');
  assert.strictEqual(ast.states.get('Decision')?.stateType, 'choice');
  // Choice diamonds carry no text (label reset to id)
  assert.strictEqual(ast.states.get('Decision')?.label, 'Decision');

  const serialized = serializeMermaidStateDiagram(ast);
  assert.match(serialized, /state Decision <<choice>>/);
});

test('State Mutations: composite state creation and grouping', () => {
  const ast = parseMermaidStateDiagram('stateDiagram-v2\n    [*] --> S1\n    S1 --> S2');
  const compId = createCompositeState(ast, 'MainFlow');
  moveStateToComposite(ast, 'S1', compId);
  moveStateToComposite(ast, 'S2', compId);

  const comp = ast.compositeStates.get(compId)!;
  assert.deepStrictEqual(comp.stateIds, ['S1', 'S2']);
  assert.strictEqual(ast.states.get('S1')?.compositeId, compId);
  assert.strictEqual(ast.states.get('S2')?.compositeId, compId);

  const serialized = serializeMermaidStateDiagram(ast);
  assert.match(serialized, /state "MainFlow" as comp_1 \{/);
  assert.match(serialized, /S1/);
  assert.match(serialized, /S2/);
  assert.match(serialized, /S1 --> S2/);
});

test('State Mutations: single state in group never loses state or emits empty braces', () => {
  const ast = parseMermaidStateDiagram('stateDiagram-v2\n    [*] --> Solo');
  const compId = createCompositeState(ast, 'SoloGroup');
  moveStateToComposite(ast, 'Solo', compId);

  const serialized = serializeMermaidStateDiagram(ast);
  assert.match(serialized, /state "SoloGroup" as comp_1 \{/);
  assert.match(serialized, /Solo/);
  // Braces must NOT be empty
  assert.doesNotMatch(serialized, /state "SoloGroup" as comp_1 \{\s*\}/);

  // Ungrouping auto-dissolves the composite state
  moveStateToComposite(ast, 'Solo', undefined);
  assert.strictEqual(ast.compositeStates.has(compId), false);
  const ungrouped = serializeMermaidStateDiagram(ast);
  assert.doesNotMatch(ungrouped, /SoloGroup/);
  assert.match(ungrouped, /Solo/);
});

test('State Mutations: unconnected normal state is never dropped', () => {
  const ast = parseMermaidStateDiagram('stateDiagram-v2\n    [*] --> S1');
  addState(ast, 'OrphanState', 'normal');

  const serialized = serializeMermaidStateDiagram(ast);
  assert.match(serialized, /OrphanState/);
});

test('State Mutations: state and composite styling round-trip', () => {
  const ast = parseMermaidStateDiagram(`stateDiagram-v2
    [*] --> Active
    Active --> Done
    Done --> [*]`);

  // Apply theme style
  updateStateStyle(ast, 'Active', { fill: '#d1fae5', stroke: '#059669', color: '#065f46' });
  const compId = createCompositeState(ast, 'SubFlow');
  updateCompositeStateStyle(ast, compId, { fill: '#fef3c7', stroke: '#d97706' });

  const serialized = serializeMermaidStateDiagram(ast);
  // Diagram should NOT be wiped! All states, transitions, and styles preserved
  assert.match(serialized, /\[\*\] --> Active/);
  assert.match(serialized, /Active --> Done/);
  assert.match(serialized, /style Active fill:#d1fae5,stroke:#059669,color:#065f46/);
  assert.match(serialized, /style comp_1 fill:#fef3c7,stroke:#d97706/);

  // Clear style
  clearStateStyle(ast, 'Active');
  const cleared = serializeMermaidStateDiagram(ast);
  assert.doesNotMatch(cleared, /style Active/);
  assert.match(cleared, /Active --> Done/);
});

test('State Mutations: start/end are added via actions, never by morphing nodes', () => {
  const ast = parseMermaidStateDiagram(`stateDiagram-v2
    StartNode --> S1
    S1 --> EndNode`);

  // Morphing a node to start/end is a no-op (anchors are added explicitly)
  updateStateType(ast, 'StartNode', 'start');
  updateStateType(ast, 'EndNode', 'end');
  assert.strictEqual(ast.states.has('StartNode'), true);
  assert.strictEqual(ast.states.has('EndNode'), true);
  assert.strictEqual(
    ast.transitions.some((t) => t.from === '[*]' && t.to === '[*]'),
    false
  );

  const serialized = serializeMermaidStateDiagram(ast);
  // Must NOT emit state "[*]" as id, nor invalid [*] --> [*] self-loops
  assert.doesNotMatch(serialized, /state "\[\*\]" as/);
  assert.doesNotMatch(serialized, /state \[\*\] as/);
  assert.doesNotMatch(serialized, /\[\*\] --> \[\*\]/);
});

test('State Mutations: add start/end anchors exactly once', () => {
  const ast = parseMermaidStateDiagram('stateDiagram-v2\n    A --> B');
  const { addStartState, addEndState, hasStartState, hasEndState } = require('../src/diagrams/state/mutations');

  assert.strictEqual(hasStartState(ast), false);
  assert.strictEqual(hasEndState(ast), false);

  const startId = addStartState(ast, 'First');
  assert.ok(startId);
  assert.strictEqual(hasStartState(ast), true);
  assert.strictEqual(addStartState(ast, 'Again'), null);

  const endId = addEndState(ast, 'Last');
  assert.ok(endId);
  assert.strictEqual(hasEndState(ast), true);
  assert.strictEqual(addEndState(ast, 'Again'), null);

  const serialized = serializeMermaidStateDiagram(ast);
  assert.match(serialized, /\[\*\] -->/);
  assert.match(serialized, /--> \[\*\]/);
  assert.doesNotMatch(serialized, /\[\*\] --> \[\*\]/);
});

test('State Mutations: only normal states carry editable text (choice/fork/join do not)', () => {
  const ast = parseMermaidStateDiagram('stateDiagram-v2\n    [*] --> C');
  const { updateStateLabel, isStateTextEditable } = require('../src/diagrams/state/mutations');

  updateStateLabel(ast, 'C', 'Hello');
  assert.strictEqual(ast.states.get('C')?.label, 'Hello');
  assert.strictEqual(isStateTextEditable(ast.states.get('C')), true);

  updateStateType(ast, 'C', 'choice');
  assert.strictEqual(isStateTextEditable(ast.states.get('C')), false);
  assert.strictEqual(ast.states.get('C')?.label, 'C');
  updateStateLabel(ast, 'C', 'Pick One');
  assert.notStrictEqual(ast.states.get('C')?.label, 'Pick One');
  assert.doesNotMatch(serializeMermaidStateDiagram(ast), /Pick One/);

  updateStateType(ast, 'C', 'fork');
  assert.strictEqual(isStateTextEditable(ast.states.get('C')), false);
  updateStateLabel(ast, 'C', 'Ignored');
  assert.notStrictEqual(ast.states.get('C')?.label, 'Ignored');

  updateStateType(ast, 'C', 'normal');
  assert.strictEqual(isStateTextEditable(ast.states.get('C')), true);
  updateStateLabel(ast, 'C', 'Back To Normal');
  assert.strictEqual(ast.states.get('C')?.label, 'Back To Normal');
});

test('State Mutations: duplicate states clones states and internal transitions', () => {
  const ast = parseMermaidStateDiagram(`stateDiagram-v2
    [*] --> A
    A --> B : next
    B --> [*]`);

  const result = duplicateStates(ast, ['A', 'B']);
  assert.strictEqual(result.stateIds.length, 2);
  assert.strictEqual(result.transitionIds.length, 1);

  const serialized = serializeMermaidStateDiagram(ast);
  assert.match(serialized, /A --> B : next/);
  assert.match(serialized, /Copy/);
});
