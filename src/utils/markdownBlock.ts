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

  // 1. Primary check when code content is available: match by code content
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

  const hint = hintStartLine ?? 0;

  // 2. Direct check at hintStartLine
  if (hint >= 0 && hint < lines.length && lines[hint]?.trim().startsWith('```mermaid')) {
    const end = findClosingFence(hint);
    if (end !== -1) {
      return { start: hint, end };
    }
  }

  // 3. Search outward from hint
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

  // Helper to score how well a block's tokens match text in domText (from SVG rendered labels)
  const scoreBlockTokens = (b: TargetMermaidBlockResult, lowerText: string): number => {
    const tokens = b.rawCode
      .split(/[^a-zA-Z0-9_]+/)
      .filter((t) => t.length >= 1)
      .map((t) => t.toLowerCase())
      .filter(
        (t) =>
          ![
            'flowchart',
            'graph',
            'statediagram',
            'v2',
            'direction',
            'style',
            'classdef',
            'class',
            'state',
            'subgraph',
            'end',
            'lr',
            'td',
            'tb',
            'rl',
            'bt',
          ].includes(t)
      );

    let score = 0;
    for (const token of tokens) {
      if (token.length >= 2 && lowerText.includes(token)) {
        score += 2;
      } else if (token.length === 1 && new RegExp(`\\b${token}\\b`, 'i').test(lowerText)) {
        score += 1;
      }
    }
    return score;
  };

  const lowerDomText = domText ? domText.toLowerCase().trim() : '';

  // 1. Direct sectionLineStart match (from context.getSectionInfo or dataset)
  if (typeof sectionLineStart === 'number' && !isNaN(sectionLineStart)) {
    const exactMatch = blocks.find((b) => b.lineStart === sectionLineStart);
    if (exactMatch) return exactMatch;
    const closeMatch = blocks.find(
      (b) => Math.abs(b.lineStart - sectionLineStart) <= 1
    );
    if (closeMatch) return closeMatch;
  }

  // 2. Editor position / hint line (from CodeMirror posAtDOM or cursor)
  if (typeof hintLine === 'number' && !isNaN(hintLine) && hintLine >= 0) {
    // 2a. Strict interior check: hintLine is within [lineStart, lineEnd] (NO +1 so back-to-back blocks do not overlap!)
    const strictlyInside = blocks.filter(
      (b) => hintLine >= b.lineStart && hintLine <= b.lineEnd
    );

    if (strictlyInside.length === 1) {
      const candidate = strictlyInside[0];
      // Check boundary: if hintLine is on candidate.lineEnd and another block starts at candidate.lineEnd + 1
      const nextBlock = blocks.find((b) => b.lineStart === candidate.lineEnd + 1);
      if (nextBlock && hintLine === candidate.lineEnd) {
        if (lowerDomText.length > 0) {
          const candScore = scoreBlockTokens(candidate, lowerDomText);
          const nextScore = scoreBlockTokens(nextBlock, lowerDomText);
          if (nextScore > candScore) {
            return nextBlock;
          }
        }
        if (typeof domIndex === 'number' && domIndex >= 0 && domIndex < blocks.length) {
          if (blocks[domIndex] === nextBlock) {
            return nextBlock;
          }
        }
      }
      return candidate;
    } else if (strictlyInside.length > 1) {
      // Disambiguate multiple overlapping candidates
      if (lowerDomText.length > 0) {
        let best = strictlyInside[0];
        let maxScore = -1;
        for (const b of strictlyInside) {
          const s = scoreBlockTokens(b, lowerDomText);
          if (s > maxScore) {
            maxScore = s;
            best = b;
          }
        }
        if (maxScore > 0) return best;
      }
      if (typeof domIndex === 'number' && domIndex >= 0 && domIndex < blocks.length) {
        if (strictlyInside.includes(blocks[domIndex])) {
          return blocks[domIndex];
        }
      }
      return strictlyInside[0];
    }
  }

  // 3. Content token scoring across all blocks (direct match with rendered SVG text)
  if (lowerDomText.length > 0) {
    let bestScore = -1;
    let bestMatch: TargetMermaidBlockResult | null = null;

    for (const b of blocks) {
      const score = scoreBlockTokens(b, lowerDomText);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = b;
      }
    }

    if (bestScore > 0 && bestMatch) {
      return bestMatch;
    }
  }

  // 4. Sequential DOM index match
  if (
    typeof domIndex === 'number' &&
    domIndex >= 0 &&
    domIndex < blocks.length
  ) {
    return blocks[domIndex];
  }

  // 5. Distance fallback
  if (typeof hintLine === 'number' && !isNaN(hintLine) && hintLine >= 0) {
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
    return bestBlock;
  }

  return blocks[0];
}


export function isCursorInMermaidBlock(
  content: string,
  cursorLine: number
): TargetMermaidBlockResult | null {
  const blockRegex = /```(?:mermaid)\s*\n([\s\S]*?)```/g;
  const matches = Array.from(content.matchAll(blockRegex));
  for (const m of matches) {
    const matchIndex = m.index || 0;
    const linesBefore = content.substring(0, matchIndex).split('\n');
    const matchLines = m[0].split('\n');
    const lineStart = linesBefore.length - 1;
    const lineEnd = lineStart + matchLines.length - 1;
    if (cursorLine >= lineStart && cursorLine <= lineEnd) {
      return {
        lineStart,
        lineEnd,
        rawCode: m[1],
      };
    }
  }
  return null;
}
