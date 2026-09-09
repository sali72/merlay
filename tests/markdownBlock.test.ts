import { test } from 'node:test';
import * as assert from 'node:assert';
import {
  findMermaidBlockBounds,
  replaceMermaidBlock,
  isCursorInMermaidBlock,
  findTargetMermaidBlock,
} from '../src/utils/markdownBlock';

test('findMermaidBlockBounds: finds exact bounds of mermaid block', () => {
  const doc = [
    '# Note Title',
    '',
    'Some introductory text.',
    '',
    '```mermaid',
    'flowchart LR',
    '    A["Start"] --> B["End"]',
    '```',
    '',
    'Follow up paragraph.',
  ];

  const bounds = findMermaidBlockBounds(doc, 4);
  assert.ok(bounds);
  assert.equal(bounds.start, 4);
  assert.equal(bounds.end, 7);
});

test('replaceMermaidBlock: shrinks diagram (deleting nodes) without deleting closing ```', () => {
  const initialDoc = [
    '# Note Title',
    '',
    '```mermaid',
    'flowchart LR',
    '    A["Start"] --> B["Process"]',
    '    B --> C["Review"]',
    '    C --> D["End"]',
    '```',
    '',
    'End of note.',
  ].join('\n');

  // Delete two nodes C and D
  const shrunkCode = 'flowchart LR\n    A["Start"] --> B["End"]';

  const res1 = replaceMermaidBlock(initialDoc, shrunkCode, 2);
  const expected1 = [
    '# Note Title',
    '',
    '```mermaid',
    'flowchart LR',
    '    A["Start"] --> B["End"]',
    '```',
    '',
    'End of note.',
  ].join('\n');

  assert.equal(res1.updatedText, expected1);
  assert.equal(res1.newStartLine, 2);
  assert.equal(res1.newEndLine, 5);

  // Successive delete: delete another node (shrinking even further)
  const furtherShrunk = 'flowchart LR\n    A["Single"]';
  const res2 = replaceMermaidBlock(res1.updatedText, furtherShrunk, res1.newStartLine);
  const expected2 = [
    '# Note Title',
    '',
    '```mermaid',
    'flowchart LR',
    '    A["Single"]',
    '```',
    '',
    'End of note.',
  ].join('\n');

  assert.equal(res2.updatedText, expected2);
  assert.equal(res2.newStartLine, 2);
  assert.equal(res2.newEndLine, 5);
  assert.ok(res2.updatedText.includes('```\n\nEnd of note.'));
});

test('replaceMermaidBlock: expands diagram (adding nodes) preserving fences', () => {
  const initialDoc = [
    '```mermaid',
    'flowchart LR',
    '    A --> B',
    '```',
    'Text below',
  ].join('\n');

  const expandedCode = 'flowchart LR\n    A --> B\n    B --> C\n    C --> D\n    D --> E';
  const res = replaceMermaidBlock(initialDoc, expandedCode, 0);

  const expected = [
    '```mermaid',
    'flowchart LR',
    '    A --> B',
    '    B --> C',
    '    C --> D',
    '    D --> E',
    '```',
    'Text below',
  ].join('\n');

  assert.equal(res.updatedText, expected);
});

test('replaceMermaidBlock: auto-heals note if closing ``` was missing', () => {
  const damagedDoc = [
    '# Title',
    '```mermaid',
    'flowchart LR',
    '    A --> B',
    'Text that was trapped without closing fence',
  ].join('\n');

  const fixedCode = 'flowchart LR\n    A --> B';
  const res = replaceMermaidBlock(damagedDoc, fixedCode, 1);

  assert.ok(res.updatedText.includes('```mermaid\nflowchart LR\n    A --> B\n```'));
  assert.ok(res.updatedText.includes('Text that was trapped without closing fence'));
});

test('replaceMermaidBlock: handles multiple mermaid blocks in same note', () => {
  const doc = [
    '# Block 1',
    '```mermaid',
    'flowchart LR',
    '    A --> B',
    '```',
    '',
    '# Block 2',
    '```mermaid',
    'flowchart TD',
    '    X --> Y',
    '    Y --> Z',
    '```',
    '',
    'Footer text',
  ].join('\n');

  // Edit only Block 2 (hintStartLine = 7)
  const newBlock2 = 'flowchart TD\n    X --> Z';
  const res = replaceMermaidBlock(doc, newBlock2, 7, 'flowchart TD\n    X --> Y\n    Y --> Z');

  const expected = [
    '# Block 1',
    '```mermaid',
    'flowchart LR',
    '    A --> B',
    '```',
    '',
    '# Block 2',
    '```mermaid',
    'flowchart TD',
    '    X --> Z',
    '```',
    '',
    'Footer text',
  ].join('\n');

  assert.equal(res.updatedText, expected);
  // Ensure Block 1 was untouched
  assert.ok(res.updatedText.includes('# Block 1\n```mermaid\nflowchart LR\n    A --> B\n```'));
});

test('isCursorInMermaidBlock: detects cursor inside mermaid block boundaries', () => {
  const doc = [
    '# Note Title', // line 0
    'Intro text',   // line 1
    '```mermaid',   // line 2
    'flowchart LR', // line 3
    '    A --> B',  // line 4
    '```',          // line 5
    'Outro text',   // line 6
    '```mermaid',   // line 7
    'stateDiagram-v2', // line 8
    '    [*] --> S1',  // line 9
    '```',          // line 10
    'End',          // line 11
  ].join('\n');

  // Outside blocks
  assert.equal(isCursorInMermaidBlock(doc, 0), null);
  assert.equal(isCursorInMermaidBlock(doc, 1), null);
  assert.equal(isCursorInMermaidBlock(doc, 6), null);
  assert.equal(isCursorInMermaidBlock(doc, 11), null);

  // Inside Block 1 (lines 2 to 5)
  for (let line = 2; line <= 5; line++) {
    const match = isCursorInMermaidBlock(doc, line);
    assert.ok(match, `Expected line ${line} to be detected inside Block 1`);
    assert.equal(match.lineStart, 2);
    assert.equal(match.lineEnd, 5);
    assert.ok(match.rawCode.includes('flowchart LR'));
  }

  // Inside Block 2 (lines 7 to 10)
  for (let line = 7; line <= 10; line++) {
    const match = isCursorInMermaidBlock(doc, line);
    assert.ok(match, `Expected line ${line} to be detected inside Block 2`);
    assert.equal(match.lineStart, 7);
    assert.equal(match.lineEnd, 10);
    assert.ok(match.rawCode.includes('stateDiagram-v2'));
  }
});

test('findTargetMermaidBlock: correctly distinguishes back-to-back diagrams without any empty lines', () => {
  const backToBackDoc = [
    '```mermaid',      // line 0
    'flowchart LR',     // line 1
    '    A["Start"] --> B["End"]', // line 2
    '```',              // line 3
    '```mermaid',      // line 4
    'stateDiagram-v2',  // line 5
    '    [*] --> Idle', // line 6
    '    Idle --> [*]', // line 7
    '```',              // line 8
  ].join('\n');

  // Test 1: clicking Diagram 2 with hintLine at opening fence (line 4)
  const target2ByLine = findTargetMermaidBlock({
    content: backToBackDoc,
    hintLine: 4,
    domIndex: 1,
    domText: 'Idle',
  });
  assert.ok(target2ByLine);
  assert.equal(target2ByLine.lineStart, 4);
  assert.equal(target2ByLine.lineEnd, 8);
  assert.ok(target2ByLine.rawCode.includes('stateDiagram-v2'));

  // Test 2: clicking Diagram 1 with hintLine at line 0
  const target1ByLine = findTargetMermaidBlock({
    content: backToBackDoc,
    hintLine: 0,
    domIndex: 0,
    domText: 'Start End',
  });
  assert.ok(target1ByLine);
  assert.equal(target1ByLine.lineStart, 0);
  assert.equal(target1ByLine.lineEnd, 3);
  assert.ok(target1ByLine.rawCode.includes('flowchart LR'));

  // Test 3: boundary position where posAtDOM landed on closing fence (line 3)
  // but domText corresponds to Diagram 2
  const target2Boundary = findTargetMermaidBlock({
    content: backToBackDoc,
    hintLine: 3,
    domIndex: 1,
    domText: 'Idle',
  });
  assert.ok(target2Boundary);
  assert.equal(target2Boundary.lineStart, 4);
  assert.equal(target2Boundary.lineEnd, 8);
  assert.ok(target2Boundary.rawCode.includes('stateDiagram-v2'));

  // Test 4: replaceMermaidBlock updates Diagram 2 while leaving Diagram 1 untouched
  const updatedCode2 = 'stateDiagram-v2\n    [*] --> Running\n    Running --> [*]';
  const replaceResult2 = replaceMermaidBlock(
    backToBackDoc,
    updatedCode2,
    4,
    'stateDiagram-v2\n    [*] --> Idle\n    Idle --> [*]'
  );

  const expectedAfterReplace2 = [
    '```mermaid',
    'flowchart LR',
    '    A["Start"] --> B["End"]',
    '```',
    '```mermaid',
    'stateDiagram-v2',
    '    [*] --> Running',
    '    Running --> [*]',
    '```',
  ].join('\n');

  assert.equal(replaceResult2.updatedText, expectedAfterReplace2);
  assert.equal(replaceResult2.newStartLine, 4);
});

