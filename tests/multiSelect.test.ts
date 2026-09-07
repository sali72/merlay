import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMermaidFlowchart } from '../src/ast/parser';
import { serializeMermaidFlowchart } from '../src/ast/serializer';
import {
  deleteNodes,
  updateNodesShape,
  updateNodesStyle,
  clearNodesStyle,
  getNodeStyle,
} from '../src/ast/mutations';

test('Multi-Select Batch Mutations: deleteNodes removes multiple nodes and cascades edges', () => {
  const initial = `flowchart TD
  A[Start] --> B[Task 1]
  B --> C[Task 2]
  C --> D[Task 3]
  D --> E[End]
  A --> C
  B --> E`;

  const ast = parseMermaidFlowchart(initial);
  assert.equal(ast.nodes.size, 5);
  assert.equal(ast.edges.length, 6);

  // Batch delete nodes B and C
  const deletedCount = deleteNodes(ast, ['B', 'C']);
  assert.equal(deletedCount, 2);
  assert.equal(ast.nodes.has('B'), false);
  assert.equal(ast.nodes.has('C'), false);
  assert.equal(ast.nodes.has('A'), true);
  assert.equal(ast.nodes.has('D'), true);
  assert.equal(ast.nodes.has('E'), true);

  // Edges connecting B or C (A-->B, B-->C, C-->D, A-->C, B-->E) must all be removed
  // Only remaining edge should be D --> E!
  assert.equal(ast.edges.length, 1);
  assert.equal(ast.edges[0].from, 'D');
  assert.equal(ast.edges[0].to, 'E');

  const serialized = serializeMermaidFlowchart(ast);
  assert.ok(serialized.includes('D --> E'));
  assert.ok(serialized.includes('D["Task 3"]'));
  assert.ok(serialized.includes('E["End"]'));
  assert.ok(!serialized.includes('Task 1'));
  assert.ok(!serialized.includes('Task 2'));
});

test('Multi-Select Batch Mutations: deleteNodes cleans subgraphs and styles', () => {
  const code = `flowchart TD
  subgraph Cluster["Backend Services"]
    API[API Gateway]
    Auth[Auth Service]
    Worker[Background Worker]
  end
  Client --> API
  API --> Auth
  API --> Worker
  style Auth fill:#fef3c7,stroke:#f59e0b
  style Worker fill:#ecfdf5,stroke:#10b981`;

  const ast = parseMermaidFlowchart(code);
  const cluster = ast.subgraphs.get('Cluster');
  assert.ok(cluster);
  assert.equal(cluster.nodeIds.length, 3);
  assert.equal(ast.styles.length, 2);

  // Delete Auth and Worker
  deleteNodes(ast, ['Auth', 'Worker']);

  // Subgraph should now only contain API
  assert.deepEqual(cluster.nodeIds, ['API']);

  // Style declarations for Auth and Worker must be removed
  assert.equal(ast.styles.some((s) => s.targetId === 'Auth'), false);
  assert.equal(ast.styles.some((s) => s.targetId === 'Worker'), false);

  // Serialization sanity check
  const serialized = serializeMermaidFlowchart(ast);
  assert.ok(!serialized.includes('Auth'));
  assert.ok(!serialized.includes('Worker'));
  assert.ok(serialized.includes('API["API Gateway"]'));
});

test('Multi-Select Batch Mutations: updateNodesShape updates multiple nodes at once', () => {
  const code = `flowchart TD
  A[Node A] --> B[Node B]
  B --> C[Node C]
  C --> D[Node D]`;

  const ast = parseMermaidFlowchart(code);

  // Batch change A, B, and C to circle
  const morphedCount = updateNodesShape(ast, ['A', 'B', 'C'], 'circle');
  assert.equal(morphedCount, 3);

  assert.equal(ast.nodes.get('A')?.shape, 'circle');
  assert.equal(ast.nodes.get('B')?.shape, 'circle');
  assert.equal(ast.nodes.get('C')?.shape, 'circle');
  assert.equal(ast.nodes.get('D')?.shape, 'rectangle'); // D remains unchanged

  const serialized = serializeMermaidFlowchart(ast);
  assert.ok(serialized.includes('A(("Node A"))'));
  assert.ok(serialized.includes('B(("Node B"))'));
  assert.ok(serialized.includes('C(("Node C"))'));
  assert.ok(serialized.includes('D["Node D"]'));
});

test('Multi-Select Batch Mutations: updateNodesStyle and clearNodesStyle', () => {
  const code = `flowchart TD
  Step1[Step 1] --> Step2[Step 2]
  Step2 --> Step3[Step 3]`;

  const ast = parseMermaidFlowchart(code);

  // Apply visual theme to Step1 and Step3
  updateNodesStyle(ast, ['Step1', 'Step3'], {
    fill: '#7c3aed',
    stroke: '#5b21b6',
    color: '#ffffff',
  });

  assert.equal(getNodeStyle(ast, 'Step1')?.fill, '#7c3aed');
  assert.equal(getNodeStyle(ast, 'Step3')?.fill, '#7c3aed');
  assert.equal(getNodeStyle(ast, 'Step2'), undefined);

  let serialized = serializeMermaidFlowchart(ast);
  assert.ok(serialized.includes('style Step1 fill:#7c3aed,stroke:#5b21b6,color:#ffffff'));
  assert.ok(serialized.includes('style Step3 fill:#7c3aed,stroke:#5b21b6,color:#ffffff'));

  // Clear style for Step1
  clearNodesStyle(ast, ['Step1']);
  assert.equal(getNodeStyle(ast, 'Step1'), undefined);
  assert.equal(getNodeStyle(ast, 'Step3')?.fill, '#7c3aed');

  serialized = serializeMermaidFlowchart(ast);
  assert.ok(!serialized.includes('style Step1'));
  assert.ok(serialized.includes('style Step3'));
});

test('Multi-Select Marquee Geometry: Box Intersection Logic', () => {
  // Test marquee overlap formula:
  // !(rect.x + rect.width < minX || rect.x > maxX || rect.y + rect.height < minY || rect.y > maxY)
  const isIntersecting = (
    rect: { x: number; y: number; width: number; height: number },
    marquee: { minX: number; maxX: number; minY: number; maxY: number }
  ) => {
    return !(
      rect.x + rect.width < marquee.minX ||
      rect.x > marquee.maxX ||
      rect.y + rect.height < marquee.minY ||
      rect.y > marquee.maxY
    );
  };

  const nodeA = { x: 50, y: 50, width: 100, height: 60 };
  const nodeB = { x: 200, y: 50, width: 100, height: 60 };
  const nodeC = { x: 125, y: 200, width: 100, height: 60 };

  // 1. Marquee enclosing Node A only
  const marquee1 = { minX: 40, maxX: 160, minY: 40, maxY: 120 };
  assert.equal(isIntersecting(nodeA, marquee1), true);
  assert.equal(isIntersecting(nodeB, marquee1), false);
  assert.equal(isIntersecting(nodeC, marquee1), false);

  // 2. Marquee enclosing Node A and Node B
  const marquee2 = { minX: 40, maxX: 320, minY: 40, maxY: 120 };
  assert.equal(isIntersecting(nodeA, marquee2), true);
  assert.equal(isIntersecting(nodeB, marquee2), true);
  assert.equal(isIntersecting(nodeC, marquee2), false);

  // 3. Large marquee enclosing all three nodes
  const marquee3 = { minX: 0, maxX: 400, minY: 0, maxY: 300 };
  assert.equal(isIntersecting(nodeA, marquee3), true);
  assert.equal(isIntersecting(nodeB, marquee3), true);
  assert.equal(isIntersecting(nodeC, marquee3), true);

  // 4. Marquee that only touches the edge of Node C
  const marquee4 = { minX: 130, maxX: 140, minY: 190, maxY: 210 };
  assert.equal(isIntersecting(nodeA, marquee4), false);
  assert.equal(isIntersecting(nodeB, marquee4), false);
  assert.equal(isIntersecting(nodeC, marquee4), true);

  // 5. Empty space drag (no nodes hit)
  const marquee5 = { minX: 0, maxX: 30, minY: 0, maxY: 30 };
  assert.equal(isIntersecting(nodeA, marquee5), false);
  assert.equal(isIntersecting(nodeB, marquee5), false);
  assert.equal(isIntersecting(nodeC, marquee5), false);
});
