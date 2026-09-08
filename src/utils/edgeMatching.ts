import { MermaidEdgeDef } from '../diagrams/viewModel';

export interface SvgElementMetadata {
  id?: string | null;
  className?: string | null;
  textContent?: string | null;
}

/**
 * Robustly matches an SVG DOM element (path, group, label) produced by Mermaid.js
 * to its corresponding MermaidEdgeDef AST definition.
 *
 * Supports:
 * - Mermaid v10 underscore IDs: L_From_To_0
 * - Mermaid v9 hyphenated IDs: L-From-To-0
 * - Dagre start/end class annotations: LS_From LE_To
 * - Direct textContent matching against edge labels
 * - Positional sequence index fallback
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function matchSvgEdgeToAst(
  el: SvgElementMetadata,
  edges: MermaidEdgeDef[],
  fallbackIdx?: number
): MermaidEdgeDef | null {
  const idAttr = (el.id || '').trim();
  const classAttr = (el.className || '').trim();
  const textContent = (el.textContent || '').trim();

  // 1. Try matching by SVG id attribute (e.g. L_A_B_0 or L-A-B-0)
  if (idAttr) {
    const normId = idAttr.replace(/[-_]/g, '_');
    for (const edge of edges) {
      const normFrom = edge.from.replace(/[-_]/g, '_');
      const normTo = edge.to.replace(/[-_]/g, '_');
      const pat = `(^|_)L_${escapeRegex(normFrom)}_${escapeRegex(normTo)}(_|$)`;
      if (
        new RegExp(pat).test(normId) ||
        normId.includes(`_${normFrom}_${normTo}_`) ||
        normId.endsWith(`_${normFrom}_${normTo}`) ||
        normId === `${normFrom}_${normTo}`
      ) {
        return edge;
      }
    }
  }

  // 2. Try matching by SVG class attribute (e.g. LS_A LE_B)
  if (classAttr) {
    const normClass = classAttr.replace(/[-_]/g, '_');
    for (const edge of edges) {
      const normFrom = edge.from.replace(/[-_]/g, '_');
      const normTo = edge.to.replace(/[-_]/g, '_');
      const hasFrom = new RegExp(`(^|\\s)LS_${escapeRegex(normFrom)}(\\s|$)`).test(normClass);
      const hasTo = new RegExp(`(^|\\s)LE_${escapeRegex(normTo)}(\\s|$)`).test(normClass);
      if (hasFrom && hasTo) {
        return edge;
      }
      if (normClass.includes(`_${normFrom}_${normTo}_`)) {
        return edge;
      }
    }
  }

  // 3. Try matching by label text content
  if (textContent) {
    const matched = edges.find((ed) => ed.label && ed.label.trim() === textContent);
    if (matched) return matched;
  }

  // 4. Sequential fallback index
  if (
    fallbackIdx !== undefined &&
    fallbackIdx >= 0 &&
    fallbackIdx < edges.length
  ) {
    return edges[fallbackIdx];
  }

  return null;
}
