/**
 * Tokenizer for Mermaid Flowcharts
 */

export type TokenType =
  | 'DIRECTIVE'       // flowchart, graph
  | 'DIRECTION'       // TB, TD, BT, RL, LR
  | 'DIRECTION_KEYWORD' // direction
  | 'SUBGRAPH'        // subgraph
  | 'END'             // end
  | 'IDENTIFIER'      // node ID or word
  | 'NODE_SHAPE'      // shape with text e.g. [My Node]
  | 'ARROW'           // -->, -.->, ==>, etc.
  | 'ARROW_LABEL'     // |label|
  | 'STYLE'           // style
  | 'CLASS_DEF'       // classDef
  | 'CLASS'           // class
  | 'COMMENT'         // %%
  | 'NEWLINE'         // \n
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
  shapeType?: string;
  labelText?: string;
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const lines = input.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      tokens.push({ type: 'NEWLINE', value: '\n', line: lineIdx + 1, col: 1 });
      continue;
    }

    if (trimmed.startsWith('%%')) {
      tokens.push({
        type: 'COMMENT',
        value: trimmed,
        line: lineIdx + 1,
        col: rawLine.indexOf('%') + 1,
      });
      tokens.push({ type: 'NEWLINE', value: '\n', line: lineIdx + 1, col: rawLine.length + 1 });
      continue;
    }

    let pos = 0;
    while (pos < rawLine.length) {
      const char = rawLine[pos];

      // Skip whitespace
      if (char === ' ' || char === '\t' || char === '\r') {
        pos++;
        continue;
      }

      // Check for Arrow Label |label|
      if (char === '|') {
        const endPipe = rawLine.indexOf('|', pos + 1);
        if (endPipe !== -1) {
          const label = rawLine.substring(pos + 1, endPipe);
          tokens.push({
            type: 'ARROW_LABEL',
            value: label,
            labelText: label,
            line: lineIdx + 1,
            col: pos + 1,
          });
          pos = endPipe + 1;
          continue;
        }
      }

      // Check for arrows
      const arrowMatch = matchArrow(rawLine, pos);
      if (arrowMatch) {
        tokens.push({
          type: 'ARROW',
          value: arrowMatch.arrow,
          line: lineIdx + 1,
          col: pos + 1,
        });
        pos += arrowMatch.length;
        continue;
      }

      // Check for shape delimiters starting at pos
      const shapeMatch = matchShape(rawLine, pos);
      if (shapeMatch) {
        tokens.push({
          type: 'NODE_SHAPE',
          value: shapeMatch.raw,
          shapeType: shapeMatch.shapeType,
          labelText: shapeMatch.label,
          line: lineIdx + 1,
          col: pos + 1,
        });
        pos += shapeMatch.length;
        continue;
      }

      // Check for string in quotes e.g. "My Node"
      if (char === '"') {
        const endQuote = rawLine.indexOf('"', pos + 1);
        if (endQuote !== -1) {
          const val = rawLine.substring(pos + 1, endQuote);
          tokens.push({
            type: 'IDENTIFIER',
            value: val,
            line: lineIdx + 1,
            col: pos + 1,
          });
          pos = endQuote + 1;
          continue;
        }
      }

      // General word / identifier
      let wordEnd = pos;
      while (
        wordEnd < rawLine.length &&
        !/[\s\[\(\{\|\-\=\.\>\<\%\"]/.test(rawLine[wordEnd])
      ) {
        wordEnd++;
      }

      if (wordEnd > pos) {
        const word = rawLine.substring(pos, wordEnd);
        const upper = word.toUpperCase();

        if (word === 'flowchart' || word === 'graph') {
          tokens.push({ type: 'DIRECTIVE', value: word, line: lineIdx + 1, col: pos + 1 });
        } else if (word.toLowerCase() === 'direction') {
          tokens.push({ type: 'DIRECTION_KEYWORD', value: word, line: lineIdx + 1, col: pos + 1 });
        } else if (['TB', 'TD', 'BT', 'RL', 'LR'].includes(upper)) {
          tokens.push({ type: 'DIRECTION', value: upper, line: lineIdx + 1, col: pos + 1 });
        } else if (word.toLowerCase() === 'subgraph') {
          tokens.push({ type: 'SUBGRAPH', value: word, line: lineIdx + 1, col: pos + 1 });
        } else if (word.toLowerCase() === 'end') {
          tokens.push({ type: 'END', value: word, line: lineIdx + 1, col: pos + 1 });
        } else if (word === 'style') {
          tokens.push({ type: 'STYLE', value: word, line: lineIdx + 1, col: pos + 1 });
        } else if (word === 'classDef') {
          tokens.push({ type: 'CLASS_DEF', value: word, line: lineIdx + 1, col: pos + 1 });
        } else if (word === 'class') {
          tokens.push({ type: 'CLASS', value: word, line: lineIdx + 1, col: pos + 1 });
        } else {
          tokens.push({ type: 'IDENTIFIER', value: word, line: lineIdx + 1, col: pos + 1 });
        }

        pos = wordEnd;
        continue;
      }

      // Unmatched single character advance
      pos++;
    }

    tokens.push({ type: 'NEWLINE', value: '\n', line: lineIdx + 1, col: rawLine.length + 1 });
  }

  tokens.push({ type: 'EOF', value: '', line: lines.length + 1, col: 1 });
  return tokens;
}

function matchArrow(str: string, pos: number): { arrow: string; length: number } | null {
  const sub = str.substring(pos);

  // Specific multi-char arrows
  const arrowPatterns = [
    '<-->',
    '<-.->',
    '<==>',
    '-.->',
    '==>',
    '-->',
    '--o',
    '--x',
    'o--o',
    'x--x',
    '---',
    '-.-',
    '===',
    '->',
  ];

  for (const pat of arrowPatterns) {
    if (sub.startsWith(pat)) {
      return { arrow: pat, length: pat.length };
    }
  }

  return null;
}

function matchShape(
  str: string,
  pos: number
): { shapeType: string; label: string; raw: string; length: number } | null {
  const sub = str.substring(pos);

  const shapes: Array<{
    open: string;
    close: string;
    type: string;
  }> = [
    { open: '([', close: '])', type: 'stadium' },
    { open: '[[', close: ']]', type: 'subroutine' },
    { open: '[(', close: ')]', type: 'cylinder' },
    { open: '((', close: '))', type: 'circle' },
    { open: '{{', close: '}}', type: 'hexagon' },
    { open: '[/', close: '/]', type: 'parallelogram' },
    { open: '[\\', close: '\\]', type: 'parallelogram' },
    { open: '[', close: ']', type: 'rectangle' },
    { open: '(', close: ')', type: 'rounded' },
    { open: '{', close: '}', type: 'diamond' },
  ];

  for (const s of shapes) {
    if (sub.startsWith(s.open)) {
      const remainder = sub.substring(s.open.length);

      // Check if quoted string inside shape: ["..."]
      if (remainder.startsWith('"')) {
        let qPos = 1;
        let foundEndQuote = false;
        while (qPos < remainder.length) {
          if (remainder[qPos] === '"' && remainder[qPos - 1] !== '\\') {
            foundEndQuote = true;
            break;
          }
          qPos++;
        }

        if (foundEndQuote) {
          const afterQuote = remainder.substring(qPos + 1).trimStart();
          if (afterQuote.startsWith(s.close)) {
            const label = remainder.substring(1, qPos).replace(/#quot;/g, '"');
            const skipWhitespace = remainder.substring(qPos + 1).indexOf(s.close);
            const fullLength = s.open.length + qPos + 1 + skipWhitespace + s.close.length;
            return {
              shapeType: s.type,
              label,
              raw: sub.substring(0, fullLength),
              length: fullLength,
            };
          }
        }
      }

      // Non-quoted or fallback
      const closeIdx = sub.indexOf(s.close, s.open.length);
      if (closeIdx !== -1) {
        let label = sub.substring(s.open.length, closeIdx).trim();
        if (
          (label.startsWith('"') && label.endsWith('"')) ||
          (label.startsWith("'") && label.endsWith("'"))
        ) {
          label = label.slice(1, -1);
        }
        const fullLength = closeIdx + s.close.length;
        return {
          shapeType: s.type,
          label: label.replace(/#quot;/g, '"'),
          raw: sub.substring(0, fullLength),
          length: fullLength,
        };
      }
    }
  }

  return null;
}

