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
      const after = lines.slice(i + 1);
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
