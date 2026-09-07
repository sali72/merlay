import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchSvgEdgeToAst } from '../src/utils/edgeMatching';
import { MermaidEdgeDef } from '../src/ast/types';

const sampleEdges: MermaidEdgeDef[] = [
  {
    type: 'edge',
    id: 'e_User_Login_1',
    from: 'User',
    to: 'Login',
    arrowType: 'arrow',
    label: '1. Enter Credentials',
  },
  {
    type: 'edge',
    id: 'e_Login_AuthService_2',
    from: 'Login',
    to: 'AuthService',
    arrowType: 'thick',
    label: '2. Verify Hash',
  },
  {
    type: 'edge',
    id: 'e_step-dash-1_step-dash-2_3',
    from: 'step-dash-1',
    to: 'step-dash-2',
    arrowType: 'dotted',
    label: 'Async Notification',
  },
  {
    type: 'edge',
    id: 'e_A_B_captionless',
    from: 'Alpha',
    to: 'Beta',
    arrowType: 'arrow',
  },
];

test('Edge Matching: Mermaid v10 underscore ID format L_From_To_Index', () => {
  const matched = matchSvgEdgeToAst({ id: 'L_User_Login_0' }, sampleEdges);
  assert.ok(matched);
  assert.equal(matched.from, 'User');
  assert.equal(matched.to, 'Login');
});

test('Edge Matching: Mermaid v9 hyphenated ID format L-From-To-Index', () => {
  const matched = matchSvgEdgeToAst({ id: 'L-Login-AuthService-0' }, sampleEdges);
  assert.ok(matched);
  assert.equal(matched.from, 'Login');
  assert.equal(matched.to, 'AuthService');
  assert.equal(matched.arrowType, 'thick');
});

test('Edge Matching: Node IDs containing hyphens and underscores', () => {
  // Mermaid transforms hyphens to underscores or keeps hyphens in SVG IDs
  const matched1 = matchSvgEdgeToAst({ id: 'L_step_dash_1_step_dash_2_0' }, sampleEdges);
  assert.ok(matched1);
  assert.equal(matched1.from, 'step-dash-1');
  assert.equal(matched1.to, 'step-dash-2');

  const matched2 = matchSvgEdgeToAst({ id: 'L-step-dash-1-step-dash-2-0' }, sampleEdges);
  assert.ok(matched2);
  assert.equal(matched2.from, 'step-dash-1');
  assert.equal(matched2.to, 'step-dash-2');
});

test('Edge Matching: Dagre-d3 class annotations LS_From and LE_To', () => {
  const matched = matchSvgEdgeToAst(
    { className: 'edgePath flowchart-link LS_User LE_Login' },
    sampleEdges
  );
  assert.ok(matched);
  assert.equal(matched.from, 'User');
  assert.equal(matched.to, 'Login');
});

test('Edge Matching: Direct textContent matching on edge labels', () => {
  const matched = matchSvgEdgeToAst(
    { id: 'random-text-container-42', textContent: '  1. Enter Credentials  ' },
    sampleEdges
  );
  assert.ok(matched);
  assert.equal(matched.id, 'e_User_Login_1');
  assert.equal(matched.label, '1. Enter Credentials');
});

test('Edge Matching: Captionless edges matched via SVG path ID', () => {
  const matched = matchSvgEdgeToAst({ id: 'L_Alpha_Beta_0' }, sampleEdges);
  assert.ok(matched);
  assert.equal(matched.from, 'Alpha');
  assert.equal(matched.to, 'Beta');
  assert.equal(matched.label, undefined);
});

test('Edge Matching: Sequential fallback index when SVG element has no matching attributes', () => {
  // Completely generic SVG path element
  const matched0 = matchSvgEdgeToAst({ id: '', className: 'path' }, sampleEdges, 0);
  assert.ok(matched0);
  assert.equal(matched0.from, 'User');

  const matched2 = matchSvgEdgeToAst({ id: 'path-99' }, sampleEdges, 2);
  assert.ok(matched2);
  assert.equal(matched2.from, 'step-dash-1');
  assert.equal(matched2.to, 'step-dash-2');
});

test('Edge Matching: Returns null for non-edge elements and out-of-bounds fallback', () => {
  const nonEdge = matchSvgEdgeToAst({ id: 'arrowheadPath', className: 'arrowMarker' }, sampleEdges);
  assert.equal(nonEdge, null);

  const outOfBounds = matchSvgEdgeToAst({ id: 'unknown-id' }, sampleEdges, 999);
  assert.equal(outOfBounds, null);

  const emptyList = matchSvgEdgeToAst({ id: 'L_User_Login_0' }, [], 0);
  assert.equal(emptyList, null);
});
