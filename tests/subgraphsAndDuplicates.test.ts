import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMermaidFlowchart } from '../src/ast/parser';
import { serializeMermaidFlowchart } from '../src/ast/serializer';
import {
  createSubgraph,
  deleteSubgraph,
  renameSubgraph,
  moveNodeToSubgraph,
  moveNodesToSubgraph,
  duplicateNodes,
  updateSubgraphStyle,
  clearSubgraphStyle,
  getSubgraphStyle,
} from '../src/ast/mutations';

test('Subgraph Mutations: createSubgraph, moveNode, renameSubgraph, dissolve', () => {
  const code = `flowchart TD
    A["Node A"] --> B["Node B"]
    B --> C["Node C"]
`;
  const ast = parseMermaidFlowchart(code);
  assert.equal(ast.subgraphs.size, 0);

  // 1. Create subgraph grouping A and B
  const subId = createSubgraph(ast, 'Service Alpha', ['A', 'B']);
  assert.ok(ast.subgraphs.has(subId));
  assert.equal(ast.subgraphs.get(subId)?.label, 'Service Alpha');
  assert.deepEqual(ast.subgraphs.get(subId)?.nodeIds, ['A', 'B']);
  assert.equal(ast.nodes.get('A')?.subgraphId, subId);
  assert.equal(ast.nodes.get('B')?.subgraphId, subId);

  // 2. Move C into the subgraph
  const moved = moveNodeToSubgraph(ast, 'C', subId);
  assert.ok(moved);
  assert.deepEqual(ast.subgraphs.get(subId)?.nodeIds, ['A', 'B', 'C']);
  assert.equal(ast.nodes.get('C')?.subgraphId, subId);

  // 3. Move A out of the subgraph (ungroup)
  moveNodeToSubgraph(ast, 'A', null);
  assert.deepEqual(ast.subgraphs.get(subId)?.nodeIds, ['B', 'C']);
  assert.equal(ast.nodes.get('A')?.subgraphId, undefined);

  // 4. Rename subgraph
  renameSubgraph(ast, subId, 'Renamed Service');
  assert.equal(ast.subgraphs.get(subId)?.label, 'Renamed Service');

  // 5. Serialize and check syntax
  const serialized = serializeMermaidFlowchart(ast);
  assert.ok(serialized.includes('subgraph ' + subId + ' ["Renamed Service"]'));
  assert.ok(serialized.includes('B["Node B"]'));
  assert.ok(serialized.includes('C["Node C"]'));

  // 6. Dissolve subgraph (delete container, keep inner nodes)
  deleteSubgraph(ast, subId, false);
  assert.equal(ast.subgraphs.size, 0);
  assert.equal(ast.nodes.size, 3);
  assert.equal(ast.nodes.get('B')?.subgraphId, undefined);
  assert.equal(ast.nodes.get('C')?.subgraphId, undefined);
});

test('Subgraph Mutations: deleteSubgraph with deleteInnerNodes = true', () => {
  const code = `flowchart LR
    subgraph S1 ["Group 1"]
        A["Node A"]
        B["Node B"]
    end
    C["Node C"]
    A --> B
    B --> C
`;
  const ast = parseMermaidFlowchart(code);
  assert.equal(ast.subgraphs.size, 1);
  assert.equal(ast.nodes.size, 3);
  assert.equal(ast.edges.length, 2);

  deleteSubgraph(ast, 'S1', true);
  assert.equal(ast.subgraphs.size, 0);
  assert.equal(ast.nodes.size, 1);
  assert.ok(ast.nodes.has('C'));
  // Edges connecting to A or B should be removed
  assert.equal(ast.edges.length, 0);
});

test('Subgraph Mutations: batch moveNodesToSubgraph', () => {
  const code = `flowchart TD
    A["A"]
    B["B"]
    C["C"]
`;
  const ast = parseMermaidFlowchart(code);
  const subId = createSubgraph(ast, 'Batch Group');
  moveNodesToSubgraph(ast, ['A', 'C'], subId);

  assert.deepEqual(ast.subgraphs.get(subId)?.nodeIds, ['A', 'C']);
  assert.equal(ast.nodes.get('A')?.subgraphId, subId);
  assert.equal(ast.nodes.get('B')?.subgraphId, undefined);
  assert.equal(ast.nodes.get('C')?.subgraphId, subId);
});

test('Duplication Mutations: duplicateNodes clones nodes and internal edges', () => {
  const code = `flowchart TD
    A["Step 1"] --> B["Step 2"]
    B --> C["Step 3"]
`;
  const ast = parseMermaidFlowchart(code);
  const result = duplicateNodes(ast, ['A', 'B']);

  assert.equal(result.nodeIds.length, 2);
  assert.equal(result.edgeIds.length, 1); // Edge A -> B duplicated

  const [dupA, dupB] = result.nodeIds;
  assert.equal(ast.nodes.get(dupA)?.label, 'Step 1 (copy)');
  assert.equal(ast.nodes.get(dupB)?.label, 'Step 2 (copy)');

  const dupEdge = ast.edges.find((e) => e.id === result.edgeIds[0]);
  assert.ok(dupEdge);
  assert.equal(dupEdge?.from, dupA);
  assert.equal(dupEdge?.to, dupB);
});

test('Subgraph Style Mutations: update/get/clear round-trips through serializer', () => {
  const code = `flowchart TD
    subgraph sub_1 ["Group 1"]
        A["Node A"]
    end
    subgraph sub_2 ["Empty Group"]
    end
`;
  const ast = parseMermaidFlowchart(code);
  assert.equal(ast.subgraphs.size, 2);
  assert.deepEqual(ast.subgraphs.get('sub_2')?.nodeIds, []);

  // Empty groups are valid AST entries
  assert.equal(getSubgraphStyle(ast, 'sub_1'), undefined);

  // Update style on non-empty and empty groups alike
  assert.ok(updateSubgraphStyle(ast, 'sub_1', { fill: '#ff0000', stroke: '#00ff00' }));
  assert.deepEqual(getSubgraphStyle(ast, 'sub_1'), { fill: '#ff0000', stroke: '#00ff00' });
  assert.ok(updateSubgraphStyle(ast, 'sub_2', { fill: '#0000ff' }));
  assert.deepEqual(getSubgraphStyle(ast, 'sub_2'), { fill: '#0000ff' });

  // Unknown subgraph id fails cleanly
  assert.equal(updateSubgraphStyle(ast, 'nope', { fill: '#fff' }), false);
  assert.equal(getSubgraphStyle(ast, 'nope'), undefined);
  assert.equal(clearSubgraphStyle(ast, 'nope'), false);

  // Serializer emits style statements for subgraphs
  const serialized = serializeMermaidFlowchart(ast);
  assert.ok(serialized.includes('style sub_1 fill:#ff0000,stroke:#00ff00'));
  assert.ok(serialized.includes('style sub_2 fill:#0000ff'));

  // Re-parsing restores subgraph styles onto definitions
  const reparsed = parseMermaidFlowchart(serialized);
  assert.deepEqual(getSubgraphStyle(reparsed, 'sub_1'), { fill: '#ff0000', stroke: '#00ff00' });
  assert.deepEqual(getSubgraphStyle(reparsed, 'sub_2'), { fill: '#0000ff' });

  // Clearing removes both the def style and the style statement
  assert.ok(clearSubgraphStyle(ast, 'sub_1'));
  assert.equal(getSubgraphStyle(ast, 'sub_1'), undefined);
  assert.ok(!serializeMermaidFlowchart(ast).includes('style sub_1'));

  // Empty style object clears as well
  assert.ok(updateSubgraphStyle(ast, 'sub_2', { fill: '#111' }));
  assert.ok(updateSubgraphStyle(ast, 'sub_2', {}));
  assert.equal(getSubgraphStyle(ast, 'sub_2'), undefined);
});

test('Subgraph Style Mutations: solid border (stroke-dasharray none) round-trips', () => {
  const code = `flowchart TD
    subgraph sub_1 ["Group 1"]
        A["Node A"]
    end
`;
  const ast = parseMermaidFlowchart(code);

  // Solid writes explicit none so it overrides the dashed container default
  assert.ok(updateSubgraphStyle(ast, 'sub_1', { 'stroke-dasharray': 'none' }));
  assert.deepEqual(getSubgraphStyle(ast, 'sub_1'), { 'stroke-dasharray': 'none' });

  const serialized = serializeMermaidFlowchart(ast);
  assert.ok(serialized.includes('style sub_1 stroke-dasharray:none'));

  const reparsed = parseMermaidFlowchart(serialized);
  assert.deepEqual(getSubgraphStyle(reparsed, 'sub_1'), { 'stroke-dasharray': 'none' });
});
