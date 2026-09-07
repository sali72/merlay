import { test } from 'node:test';
import * as assert from 'node:assert';
import {
  findMermaidBlockBounds,
  replaceMermaidBlock,
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
