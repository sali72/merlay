import test from 'node:test';
import assert from 'node:assert';
import {
  detectDiagramType,
  getDriver,
  getDriverForCode,
  getAllDrivers,
  DIAGRAM_TEMPLATES,
} from '../src/diagrams/registry';

test('Diagram Registry: detectDiagramType', () => {
  // Flowchart
  assert.strictEqual(detectDiagramType('flowchart TD\n  A --> B'), 'flowchart');
  assert.strictEqual(detectDiagramType('graph LR\n  A --> B'), 'flowchart');
  assert.strictEqual(detectDiagramType('%% comment\nflowchart LR\n A --> B'), 'flowchart');

  // State Diagram
  assert.strictEqual(detectDiagramType('stateDiagram-v2\n  [*] --> S1'), 'stateDiagram');
  assert.strictEqual(detectDiagramType('stateDiagram\n  [*] --> S1'), 'stateDiagram');
  assert.strictEqual(detectDiagramType('%% comment\nstateDiagram-v2\n [*] --> S1'), 'stateDiagram');

  // Other types
  assert.strictEqual(detectDiagramType('mindmap\n  root((Root))'), 'mindmap');
  assert.strictEqual(detectDiagramType('sequenceDiagram\n  Alice->>Bob: Hello'), 'sequenceDiagram');
  assert.strictEqual(detectDiagramType('classDiagram\n  class Animal'), 'classDiagram');
  assert.strictEqual(detectDiagramType('erDiagram\n  CUSTOMER ||--o{ ORDER : places'), 'erDiagram');

  // Unknown
  assert.strictEqual(detectDiagramType(''), 'unknown');
  assert.strictEqual(detectDiagramType('%% only comments\n%% here'), 'unknown');
});

test('Diagram Registry: getDriver and getDriverForCode', () => {
  const flowchartDriver = getDriver('flowchart');
  assert.ok(flowchartDriver);
  assert.strictEqual(flowchartDriver?.displayName, 'Flowchart');
  assert.strictEqual(flowchartDriver?.supportsDirection, true);

  const stateDriver = getDriver('stateDiagram');
  assert.ok(stateDriver);
  assert.strictEqual(stateDriver?.displayName, 'State Diagram');
  assert.strictEqual(stateDriver?.supportsDirection, true);

  const driverFromCode = getDriverForCode('stateDiagram-v2\n  [*] --> Idle');
  assert.strictEqual(driverFromCode?.type, 'stateDiagram');

  assert.strictEqual(getAllDrivers().length >= 2, true);
  assert.strictEqual(DIAGRAM_TEMPLATES.length >= 2, true);

  // Verify first template is Flowchart (default)
  assert.strictEqual(DIAGRAM_TEMPLATES[0].type, 'flowchart');
  assert.strictEqual(DIAGRAM_TEMPLATES[1].type, 'stateDiagram');
});

test('Diagram Driver: parse and serialize via driver interface', () => {
  const flowchartDriver = getDriver('flowchart')!;
  const fcAst = flowchartDriver.parse('flowchart TD\n    A --> B\n');
  assert.strictEqual(fcAst.nodes.size, 2);
  const fcCode = flowchartDriver.serialize(fcAst);
  assert.ok(fcCode.includes('flowchart TD'));

  const stateDriver = getDriver('stateDiagram')!;
  const stAst = stateDriver.parse('stateDiagram-v2\n  [*] --> State1\n  State1 --> [*]\n');
  assert.strictEqual(stAst.states.size, 2);
  const stCode = stateDriver.serialize(stAst);
  assert.ok(stCode.includes('stateDiagram-v2'));
});
