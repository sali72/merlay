/**
 * Utilities for locating and safely replacing Mermaid code blocks within Markdown documents.
 * Guarantees that code fence delimiters (```mermaid and ```) are never deleted or corrupted,
 * even when diagrams shrink (deleting nodes) or expand (adding nodes).
 */

export interface BlockBounds {
  start: number; // line index of opening ```mermaid
  end: number; // line index of closing ```
}

export interface ReplaceResult {
  updatedText: string;
  newStartLine: number;
  newEndLine: number;
}

export function findMermaidBlockBounds(
  lines: string[],
  hintStartLine?: number,
  initialCode?: string,
  latestCode?: string
): BlockBounds | null {
  const findClosingFence = (startIdx: number): number => {
    for (let i = startIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('```') && !line.startsWith('```mermaid')) {
        return i;
      }
    }
    return -1;
  };

  const hint = hintStartLine ?? 0;

  // 1. Direct check at hintStartLine
  if (hint >= 0 && hint < lines.length && lines[hint]?.trim().startsWith('```mermaid')) {
    const end = findClosingFence(hint);
    if (end !== -1) {
      return { start: hint, end };
    }
  }

  // 2. Search outward from hint
  for (let offset = 1; offset < lines.length; offset++) {
    for (const sign of [-1, 1]) {
      const candidate = hint + offset * sign;
      if (candidate >= 0 && candidate < lines.length) {
        if (lines[candidate].trim().startsWith('```mermaid')) {
          const end = findClosingFence(candidate);
          if (end !== -1) {
            return { start: candidate, end };
          }
        }
      }
    }
  }

  // 3. Fallback: match by code content
  if (initialCode || latestCode) {
    const rawInitial = initialCode?.trim();
    const rawLatest = latestCode?.trim();
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('```mermaid')) {
        const end = findClosingFence(i);
        if (end !== -1) {
          const blockContent = lines.slice(i + 1, end).join('\n').trim();
          if (
            (rawInitial && blockContent === rawInitial) ||
            (rawLatest && blockContent === rawLatest)
          ) {
            return { start: i, end };
          }
        }
      }
    }
  }

  // 4. Fallback: first mermaid block
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('```mermaid')) {
      const end = findClosingFence(i);
      if (end !== -1) {
        return { start: i, end };
      }
    }
  }

  return null;
}

export function replaceMermaidBlock(
  documentText: string,
  newCode: string,
  hintStartLine?: number,
  initialCode?: string,
  latestCode?: string
): ReplaceResult {
  const lines = documentText.split('\n');
  const codeLines = newCode.trim().split('\n');
  const bounds = findMermaidBlockBounds(lines, hintStartLine, initialCode, latestCode);

  if (bounds) {
    const { start, end } = bounds;
    const before = lines.slice(0, start + 1); // includes ```mermaid
    const after = lines.slice(end); // includes ``` and everything following
    const newEndLine = start + 1 + codeLines.length;

    return {
      updatedText: [...before, ...codeLines, ...after].join('\n'),
      newStartLine: start,
      newEndLine,
    };
  }

  // Auto-heal case: If an opening ```mermaid exists but no closing fence was found
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('```mermaid')) {
      const before = lines.slice(0, i + 1);

      // Detect where the unclosed mermaid code ends and regular document text resumes
      let endIdx = lines.length;
      for (let j = i + 1; j < lines.length; j++) {
        const trimmed = lines[j].trim();
        if (!trimmed) continue;

        // If line is a markdown heading, rule, or other code fence
        if (trimmed.startsWith('#') || trimmed.startsWith('```') || trimmed === '---' || trimmed.startsWith('>')) {
          // Look back to preserve empty lines before headings
          endIdx = j;
          if (j > i + 1 && !lines[j - 1].trim()) {
            endIdx = j - 1;
          }
          break;
        }

        // If line doesn't match mermaid flowchart syntax
        const isMermaidSyntax =
          /^(flowchart|graph|subgraph|end|direction|classDef|class|style|%%)\b/i.test(trimmed) ||
          /(-->|--|==>|===|-\.->|-.-|<-->|<==>|\[.*\]|\(.*\)|{.*})/.test(trimmed);

        if (!isMermaidSyntax) {
          endIdx = j;
          break;
        }
      }

      const after = lines.slice(endIdx);
      const newEndLine = i + 1 + codeLines.length;
      return {
        updatedText: [...before, ...codeLines, '```', ...after].join('\n'),
        newStartLine: i,
        newEndLine,
      };
    }
  }

  // Failsafe: append a complete block to the document
  const appendText = `${documentText.trimEnd()}\n\n\`\`\`mermaid\n${newCode.trim()}\n\`\`\`\n`;
  const appendLines = appendText.split('\n');
  return {
    updatedText: appendText,
    newStartLine: Math.max(0, appendLines.length - codeLines.length - 2),
    newEndLine: appendLines.length - 2,
  };
}

export interface TargetMermaidBlockQuery {
  content: string;
  hintLine?: number;
  domIndex?: number;
  domText?: string;
  sectionLineStart?: number;
}

export interface TargetMermaidBlockResult {
  lineStart: number;
  lineEnd: number;
  rawCode: string;
}

export function findTargetMermaidBlock(
  query: TargetMermaidBlockQuery
): TargetMermaidBlockResult | null {
  const { content, hintLine, domIndex, domText, sectionLineStart } = query;
  const blockRegex = /```(?:mermaid)\s*\n([\s\S]*?)```/g;
  const matches = Array.from(content.matchAll(blockRegex));
  if (matches.length === 0) return null;

  const blocks: TargetMermaidBlockResult[] = matches.map((m) => {
    const matchIndex = m.index || 0;
    const linesBefore = content.substring(0, matchIndex).split('\n');
    const matchLines = m[0].split('\n');
    const lineStart = linesBefore.length - 1;
    const lineEnd = lineStart + matchLines.length - 1;
    return {
      lineStart,
      lineEnd,
      rawCode: m[1],
    };
  });

  if (blocks.length === 1) {
    return blocks[0];
  }

  // 1. Direct sectionLineStart match (from context.getSectionInfo or dataset)
  if (typeof sectionLineStart === 'number' && !isNaN(sectionLineStart)) {
    const directMatch = blocks.find(
      (b) => Math.abs(b.lineStart - sectionLineStart) <= 1
    );
    if (directMatch) return directMatch;
  }

  // 2. Editor position / hint line (from CodeMirror posAtDOM or cursor)
  if (typeof hintLine === 'number' && !isNaN(hintLine) && hintLine >= 0) {
    for (const b of blocks) {
      if (hintLine >= b.lineStart && hintLine <= b.lineEnd + 1) {
        return b;
      }
    }
    // Find closest block
    let bestBlock = blocks[0];
    let minDistance = Infinity;
    for (const b of blocks) {
      const dist = Math.min(
        Math.abs(hintLine - b.lineStart),
        Math.abs(hintLine - b.lineEnd)
      );
      if (dist < minDistance) {
        minDistance = dist;
        bestBlock = b;
      }
    }
    if (minDistance <= 30) {
      return bestBlock;
    }
  }

  // 3. Sequential DOM index match
  if (
    typeof domIndex === 'number' &&
    domIndex >= 0 &&
    domIndex < blocks.length
  ) {
    return blocks[domIndex];
  }

  // 4. Content token scoring (supports all diagram types: flowcharts, state diagrams, etc.)
  if (domText && domText.trim().length > 0) {
    const lowerDomText = domText.toLowerCase();
    let bestScore = -1;
    let bestMatch = blocks[0];

    for (const b of blocks) {
      const tokens = b.rawCode
        .split(/[^a-zA-Z0-9_]+/)
        .filter((t) => t.length >= 3)
        .map((t) => t.toLowerCase())
        .filter(
          (t) =>
            ![
              'flowchart',
              'graph',
              'statediagram',
              'direction',
              'style',
              'classdef',
              'class',
              'state',
              'subgraph',
              'end',
            ].includes(t)
        );

      let score = 0;
      for (const token of tokens) {
        if (lowerDomText.includes(token)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = b;
      }
    }

    if (bestScore > 0) {
      return bestMatch;
    }
  }

  return blocks[0];
}
