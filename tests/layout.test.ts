import test from 'node:test';
import assert from 'node:assert/strict';

import { parseMermaidFlowchart } from '../src/ast/parser.ts';
import {
  extractPositionsFromMermaidSvg,
  calculateDagreLayout,
  pointsToSvgPath,
} from '../src/layout/dagreLayout.ts';

test('calculateDagreLayout generates accurate nodes, subgraphs, B-spline edge paths and label positions', () => {
  const code = `flowchart TD
    A[Start] -->|Yes| B{Decision}
    B -->|Option 1| C[Action 1]
    B -->|Option 2| D[Action 2]
    C --> E[End]
    D --> E
  `;

  const ast = parseMermaidFlowchart(code);
  const layout = calculateDagreLayout(ast);

  assert.equal(layout.direction, 'TD');
  assert.equal(layout.nodes.length, 5);
  assert.equal(layout.edges.length, 5);

  // Verify node coordinates exist and have positive dimensions
  for (const node of layout.nodes) {
    assert.ok(node.width > 0);
    assert.ok(node.height > 0);
    assert.ok(typeof node.x === 'number');
    assert.ok(typeof node.y === 'number');
  }

  // Verify all edges have valid B-spline SVG paths
  for (const edge of layout.edges) {
    assert.ok(edge.svgPath, `Edge ${edge.id} must have svgPath`);
    assert.ok(edge.svgPath.startsWith('M'), `Edge ${edge.id} svgPath must start with M`);
    assert.ok(edge.points && edge.points.length >= 2, `Edge ${edge.id} must have at least 2 points`);
  }

  // Verify labeled edges have label positions
  const edgeYes = layout.edges.find((e) => e.label === 'Yes');
  assert.ok(edgeYes);
  assert.ok(edgeYes.labelPosition, 'Labeled edge must have labelPosition');
  assert.ok(typeof edgeYes.labelPosition.x === 'number');
  assert.ok(typeof edgeYes.labelPosition.y === 'number');
});

test('extractPositionsFromMermaidSvg extracts LS-* and LE-* edge paths and label coordinates', () => {
  const sampleSvg = `
  <svg id="mermaid-sample" width="600" height="500" xmlns="http://www.w3.org/2000/svg">
    <g class="output">
      <g class="clusters">
        <g class="cluster" id="flowchart-sub1-0">
          <rect x="50" y="40" width="300" height="200"></rect>
          <g class="label"><text>My Group</text></g>
        </g>
      </g>
      <g class="edgePaths">
        <g class="edgePath LS-A LE-B" id="L-A-B-0">
          <path class="path" d="M120,60L120,90C120,110,180,110,180,130L180,160"></path>
        </g>
        <g class="edgePath LS-B LE-C">
          <path class="flowchart-link" d="M180,200L180,250"></path>
        </g>
      </g>
      <g class="edgeLabels">
        <g class="edgeLabel LS-A LE-B" transform="translate(150, 110)">
          <g class="label"><foreignObject><div>Next</div></foreignObject></g>
        </g>
      </g>
      <g class="nodes">
        <g class="node default" id="flowchart-A-0" transform="translate(120, 60)">
          <rect x="-40" y="-18" width="80" height="36"></rect>
        </g>
        <g class="node default" id="flowchart-B-1" transform="translate(180, 180)">
          <rect x="-50" y="-20" width="100" height="40"></rect>
        </g>
        <g class="node default" id="flowchart-C-2" transform="translate(180, 270)">
          <polygon points="0,0 80,0 70,36 -10,36"></polygon>
        </g>
      </g>
    </g>
  </svg>
  `;

  const code = `flowchart TD
    subgraph sub1 [My Group]
      A[Step A]
      B[Step B]
    end
    C[/Step C/]
    A -->|Next| B
    B --> C
  `;

  const ast = parseMermaidFlowchart(code);

  const originalDOMParser = (globalThis as any).DOMParser;

  try {
    (globalThis as any).DOMParser = class {
      parseFromString(_str: string) {
        return {
          querySelector: (selector: string) => {
            if (selector === 'svg') return { getAttribute: () => null };
            return null;
          },
          querySelectorAll: (selector: string) => {
            if (selector.includes('.node')) {
              return [
                {
                  getAttribute: (a: string) => (a === 'id' ? 'flowchart-A-0' : a === 'transform' ? 'translate(120, 60)' : ''),
                  querySelector: (s: string) => (s === 'rect' ? { getAttribute: (a: string) => (a === 'width' ? '80' : '36') } : null),
                },
                {
                  getAttribute: (a: string) => (a === 'id' ? 'flowchart-B-1' : a === 'transform' ? 'translate(180, 180)' : ''),
                  querySelector: (s: string) => (s === 'rect' ? { getAttribute: (a: string) => (a === 'width' ? '100' : '40') } : null),
                },
                {
                  getAttribute: (a: string) => (a === 'id' ? 'flowchart-C-2' : a === 'transform' ? 'translate(180, 270)' : ''),
                  querySelector: (s: string) => (s === 'polygon' ? { getAttribute: (a: string) => (a === 'points' ? '0,0 80,0 70,36 -10,36' : '') } : null),
                },
              ];
            }
            if (selector.includes('.cluster')) {
              return [
                {
                  getAttribute: (a: string) => (a === 'id' ? 'flowchart-sub1-0' : ''),
                  querySelector: (s: string) => (s === 'rect' ? { getAttribute: (a: string) => (a === 'x' ? '50' : a === 'y' ? '40' : a === 'width' ? '300' : '200') } : null),
                },
              ];
            }
            if (selector.includes('path')) {
              return [
                {
                  getAttribute: (a: string) => (a === 'class' ? 'path' : a === 'd' ? 'M120,60L120,90C120,110,180,110,180,130L180,160' : ''),
                  parentElement: {
                    getAttribute: (a: string) => (a === 'class' ? 'edgePath LS-A LE-B' : a === 'id' ? 'L-A-B-0' : ''),
                  },
                },
                {
                  getAttribute: (a: string) => (a === 'class' ? 'flowchart-link' : a === 'd' ? 'M180,200L180,250' : ''),
                  parentElement: {
                    getAttribute: (a: string) => (a === 'class' ? 'edgePath LS-B LE-C' : ''),
                  },
                },
              ];
            }
            if (selector.includes('edgeLabel')) {
              return [
                {
                  getAttribute: (a: string) => (a === 'class' ? 'edgeLabel LS-A LE-B' : a === 'transform' ? 'translate(150, 110)' : ''),
                  textContent: 'Next',
                  parentElement: null,
                },
              ];
            }
            return [];
          },
        } as any;
      }
    } as any;

    const result = extractPositionsFromMermaidSvg(sampleSvg, ast);
    assert.ok(result, 'extractPositionsFromMermaidSvg must succeed');
    assert.equal(result.nodes.length, 3);
    assert.equal(result.subgraphs.length, 1);
    assert.equal(result.edges.length, 2);

    // Verify node A extracted
    const nodeA = result.nodes.find((n) => n.id === 'A');
    assert.ok(nodeA);
    assert.equal(nodeA.width, 80);
    assert.equal(nodeA.height, 36);
    assert.equal(nodeA.x, 120 - 40); // cx - w/2
    assert.equal(nodeA.y, 60 - 18);  // cy - h/2

    // Verify edge A->B extracted exact svgPath and labelPosition
    const edgeAB = result.edges.find((e) => e.from === 'A' && e.to === 'B');
    assert.ok(edgeAB);
    assert.equal(edgeAB.svgPath, 'M120,60L120,90C120,110,180,110,180,130L180,160');
    assert.deepEqual(edgeAB.labelPosition, { x: 150, y: 110 });

    // Verify edge B->C extracted exact svgPath
    const edgeBC = result.edges.find((e) => e.from === 'B' && e.to === 'C');
    assert.ok(edgeBC);
    assert.equal(edgeBC.svgPath, 'M180,200L180,250');
  } finally {
    (globalThis as any).DOMParser = originalDOMParser;
  }
});

test('pointsToSvgPath converts points to smooth d3.curveBasis path', () => {
  const points = [
    { x: 50, y: 50 },
    { x: 100, y: 100 },
    { x: 150, y: 150 },
  ];

  const path = pointsToSvgPath(points);
  assert.ok(path.startsWith('M50,50'));
  assert.ok(path.includes('C'));
  assert.ok(path.endsWith('150,150'));
});
