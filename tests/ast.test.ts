import test from 'node:test';
import assert from 'node:assert/strict';

import { tokenize } from '../src/ast/lexer.ts';
import { parseMermaidFlowchart } from '../src/ast/parser.ts';
import { serializeMermaidFlowchart } from '../src/ast/serializer.ts';

test('Lexer tokenizes basic flowchart', () => {
  const code = 'flowchart LR\n    A[Start] --> B(End)';
  const tokens = tokenize(code);
  assert.ok(tokens.length > 0);
  assert.equal(tokens[0].type, 'DIRECTIVE');
  assert.equal(tokens[0].value, 'flowchart');
  assert.equal(tokens[1].type, 'DIRECTION');
  assert.equal(tokens[1].value, 'LR');
});

test('Parser creates AST with all node shapes and labels', () => {
  const code = `flowchart TD
    rect[Rectangle]
    round(Rounded)
    stad([Stadium])
    sub[[Subroutine]]
    cyl[(Database)]
    circ((Circle))
    diam{Decision}
    hex{{Hexagon}}
    para[/Parallelogram/]
    rect --> round
    round --> stad
    stad ==> sub
    sub -.-> cyl
    cyl <--> circ
    circ -->|Yes| diam
    diam -->|No| hex
    hex --- para
`;

  const ast = parseMermaidFlowchart(code);
  assert.equal(ast.direction, 'TD');
  assert.equal(ast.nodes.size, 9);
  assert.equal(ast.edges.length, 8);

  assert.equal(ast.nodes.get('rect')?.shape, 'rectangle');
  assert.equal(ast.nodes.get('round')?.shape, 'rounded');
  assert.equal(ast.nodes.get('stad')?.shape, 'stadium');
  assert.equal(ast.nodes.get('sub')?.shape, 'subroutine');
  assert.equal(ast.nodes.get('cyl')?.shape, 'cylinder');
  assert.equal(ast.nodes.get('circ')?.shape, 'circle');
  assert.equal(ast.nodes.get('diam')?.shape, 'diamond');
  assert.equal(ast.nodes.get('hex')?.shape, 'hexagon');
  assert.equal(ast.nodes.get('para')?.shape, 'parallelogram');

  assert.equal(ast.edges[5].label, 'Yes');
  assert.equal(ast.edges[6].label, 'No');
});

test('Parser handles chained connections A --> B --> C', () => {
  const code = `flowchart LR
    A["Node 1"] --> B["Node 2"] --> C["Node 3"]
`;

  const ast = parseMermaidFlowchart(code);
  assert.equal(ast.nodes.size, 3);
  assert.equal(ast.edges.length, 2);
  assert.equal(ast.edges[0].from, 'A');
  assert.equal(ast.edges[0].to, 'B');
  assert.equal(ast.edges[1].from, 'B');
  assert.equal(ast.edges[1].to, 'C');
});

test('Parser and Serializer handle Subgraphs cleanly', () => {
  const code = `flowchart LR
    subgraph backend ["Backend API"]
        direction TB
        Server["API Server"]
        DB[("PostgreSQL")]
    end

    Client["Client Web"] --> Server
    Server --> DB
`;

  const ast = parseMermaidFlowchart(code);
  assert.equal(ast.subgraphs.size, 1);
  const sub = ast.subgraphs.get('backend');
  assert.ok(sub);
  assert.equal(sub.label, 'Backend API');
  assert.equal(sub.nodeIds.length, 2);
  assert.equal(sub.direction, 'TB');

  const serialized = serializeMermaidFlowchart(ast);
  assert.ok(serialized.includes('subgraph backend ["Backend API"]'));
  assert.ok(serialized.includes('Client'));
  assert.ok(serialized.includes('Server'));
});

test('Parser and Serializer handle Styles and ClassDefs', () => {
  const code = `flowchart LR
    A["Server"] --> B["Database"]

    classDef primary fill:#3b82f6,color:#fff
    style A fill:#10b981,stroke:#047857
`;

  const ast = parseMermaidFlowchart(code);
  assert.equal(ast.styles.length, 1);
  assert.equal(ast.styles[0].targetId, 'A');
  assert.equal(ast.styles[0].styles.fill, '#10b981');
  assert.equal(ast.classDefs.size, 1);
  assert.equal(ast.classDefs.get('primary')?.styles.fill, '#3b82f6');

  const serialized = serializeMermaidFlowchart(ast);
  assert.ok(serialized.includes('style A fill:#10b981,stroke:#047857'));
  assert.ok(serialized.includes('classDef primary fill:#3b82f6,color:#fff'));
});

test('Round-trip semantic idempotency', () => {
  const original = `flowchart LR
    A["Step 1"] -->|next| B["Step 2"]
    B --> C["Step 3"]
`;

  const ast1 = parseMermaidFlowchart(original);
  const serialized1 = serializeMermaidFlowchart(ast1);
  const ast2 = parseMermaidFlowchart(serialized1);
  const serialized2 = serializeMermaidFlowchart(ast2);

  assert.equal(serialized1, serialized2);
  assert.equal(ast1.nodes.size, ast2.nodes.size);
  assert.equal(ast1.edges.length, ast2.edges.length);
});

test('Parser and Serializer handle multiline and special characters cleanly', () => {
  const code = `flowchart TD
    A["Line 1\\nLine 2"] --> B["Card with (parens) and [brackets]"]
`;

  const ast = parseMermaidFlowchart(code);
  assert.equal(ast.nodes.size, 2);
  assert.equal(ast.edges.length, 1);

  const serialized = serializeMermaidFlowchart(ast);
  assert.ok(serialized.includes('Line 1\\nLine 2'));
  assert.ok(serialized.includes('Card with (parens) and [brackets]'));
});

