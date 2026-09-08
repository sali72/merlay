/**
 * Serializer: Converts MermaidStateAST to clean, normalized Mermaid stateDiagram syntax
 */

import { MermaidStateAST, MermaidStateDef } from './types';
import { isNodeInsideComposite } from './mutations/transitionMutations';

export function serializeMermaidStateDiagram(ast: MermaidStateAST): string {
  const lines: string[] = [];

  // 1. Header
  lines.push(ast.diagramType || 'stateDiagram-v2');

  // 2. Global Direction
  if (ast.direction) {
    lines.push(`    direction ${ast.direction}`);
  }

  const emittedStates = new Set<string>();
  const emittedTransitions = new Set<string>();

  // 3. Composite States (Top-level)
  const childCompIds = new Set<string>();
  for (const comp of ast.compositeStates.values()) {
    if (comp.compositeIds) {
      for (const cid of comp.compositeIds) childCompIds.add(cid);
    }
  }

  for (const [compId, compDef] of ast.compositeStates.entries()) {
    if (childCompIds.has(compId)) continue; // Will be emitted inside parent composite state
    emitCompositeState(
      lines,
      compId,
      compDef,
      ast,
      emittedStates,
      emittedTransitions,
      '    '
    );
  }

  // 4. Standalone Special States (choice, fork, join, custom labeled) or Unconnected States
  for (const [stateId, state] of ast.states.entries()) {
    if (
      stateId === '[*]' ||
      emittedStates.has(stateId) ||
      state.compositeId ||
      ast.compositeStates.has(stateId)
    ) {
      continue;
    }
    if (
      state.stateType === 'choice' ||
      state.stateType === 'fork' ||
      state.stateType === 'join' ||
      (state.label && state.label !== state.id)
    ) {
      emitStateDeclaration(lines, state, '    ');
      emittedStates.add(state.id);
    } else if (
      !ast.transitions.some((t) => t.from === stateId || t.to === stateId)
    ) {
      // Unconnected standalone normal state must be declared so it does not vanish
      lines.push(`    ${state.id}`);
      emittedStates.add(state.id);
    }
  }

  // 5. Remaining Transitions (never emit invalid [*] --> [*] self-loops)
  for (const tr of ast.transitions) {
    if (tr.from === '[*]' && tr.to === '[*]') continue;
    // Only outer nodes can point to composites; inner nodes cannot point to outer composite.
    if (ast.compositeStates.has(tr.to) && isNodeInsideComposite(ast, tr.from, tr.to)) {
      continue;
    }
    if (!emittedTransitions.has(tr.id)) {
      emitTransition(lines, tr, '    ');
      emittedTransitions.add(tr.id);
    }
  }

  // 6. Styles
  if (ast.styles && ast.styles.length > 0) {
    lines.push('');
    for (const s of ast.styles) {
      const stylePairs = Object.entries(s.styles)
        .map(([k, v]) => `${k}:${v}`)
        .join(',');
      lines.push(`    style ${s.targetId} ${stylePairs}`);
    }
  }

  // 7. Preserved statements (notes, classDefs, comments, --, :::) at top level
  if (ast.rawLines && ast.rawLines.length > 0) {
    const topLevelRaws = ast.rawLines.filter((r) => !r.compositeId);
    if (topLevelRaws.length > 0) {
      lines.push('');
      for (const raw of topLevelRaws) {
        lines.push(`    ${raw.text}`);
      }
    }
  }

  return lines.join('\n').trim() + '\n';
}

function emitCompositeState(
  lines: string[],
  compId: string,
  compDef: import('./types').MermaidCompositeStateDef,
  ast: MermaidStateAST,
  emittedStates: Set<string>,
  emittedTransitions: Set<string>,
  indent: string
) {
  const hasChildren =
    (compDef.compositeIds?.length ?? 0) > 0 ||
    compDef.stateIds.some((id) => id !== '[*]');
  const hasRaw = ast.rawLines?.some((r) => r.compositeId === compId);

  // An emptied composite block with no members is invalid syntax in Mermaid — emit as simple state
  if (!hasChildren && !hasRaw) {
    if (compDef.label && compDef.label !== compId) {
      lines.push(`${indent}state "${escapeString(compDef.label)}" as ${compId}`);
    } else {
      lines.push(`${indent}state ${compId}`);
    }
    return;
  }

  if (compDef.label && compDef.label !== compId) {
    lines.push(`${indent}state "${escapeString(compDef.label)}" as ${compId} {`);
  } else {
    lines.push(`${indent}state ${compId} {`);
  }

  const innerIndent = indent + '    ';

  if (compDef.direction) {
    lines.push(`${innerIndent}direction ${compDef.direction}`);
  }

  // 1. Nested child composite states
  if (compDef.compositeIds && compDef.compositeIds.length > 0) {
    for (const childCompId of compDef.compositeIds) {
      const childComp = ast.compositeStates.get(childCompId);
      if (childComp) {
        emitCompositeState(
          lines,
          childCompId,
          childComp,
          ast,
          emittedStates,
          emittedTransitions,
          innerIndent
        );
      }
    }
  }

  // 2. Inner states (guarantee state is declared in composite state even without transitions)
  for (const stateId of compDef.stateIds) {
    const state = ast.states.get(stateId);
    if (state && state.id !== '[*]') {
      emitInnerStateDeclaration(lines, state, innerIndent);
      emittedStates.add(state.id);
    }
  }

  // 3. Inner transitions (including transitions to/from nested child composites)
  const compMembers = new Set([...compDef.stateIds, ...(compDef.compositeIds || [])]);
  for (const tr of ast.transitions) {
    if (tr.from === '[*]' && tr.to === '[*]') continue;
    // Only outer nodes can point to composites; inner nodes cannot point to outer composite.
    if (ast.compositeStates.has(tr.to) && isNodeInsideComposite(ast, tr.from, tr.to)) {
      continue;
    }
    if (
      (compMembers.has(tr.from) || tr.from === '[*]') &&
      (compMembers.has(tr.to) || tr.to === '[*]') &&
      !emittedTransitions.has(tr.id)
    ) {
      emitTransition(lines, tr, innerIndent);
      emittedTransitions.add(tr.id);
    }
  }

  // 4. Preserved statements scoped to this composite (notes, -- separators)
  if (ast.rawLines) {
    for (const raw of ast.rawLines) {
      if (raw.compositeId === compId) {
        lines.push(`${innerIndent}${raw.text}`);
      }
    }
  }

  lines.push(`${indent}}`);
  lines.push('');
}

function emitInnerStateDeclaration(lines: string[], state: MermaidStateDef, indent: string) {
  if (state.stateType === 'choice') {
    lines.push(`${indent}state ${state.id} <<choice>>`);
  } else if (state.stateType === 'fork') {
    lines.push(`${indent}state ${state.id} <<fork>>`);
  } else if (state.stateType === 'join') {
    lines.push(`${indent}state ${state.id} <<join>>`);
  } else if (state.id !== '[*]' && state.label && state.label !== state.id && state.label !== '[*]') {
    lines.push(`${indent}state "${escapeString(state.label)}" as ${state.id}`);
  } else {
    lines.push(`${indent}state ${state.id}`);
  }
}

function emitStateDeclaration(lines: string[], state: MermaidStateDef, indent: string) {
  if (state.stateType === 'choice') {
    lines.push(`${indent}state ${state.id} <<choice>>`);
  } else if (state.stateType === 'fork') {
    lines.push(`${indent}state ${state.id} <<fork>>`);
  } else if (state.stateType === 'join') {
    lines.push(`${indent}state ${state.id} <<join>>`);
  } else if (state.id !== '[*]' && state.label && state.label !== state.id && state.label !== '[*]') {
    lines.push(`${indent}state "${escapeString(state.label)}" as ${state.id}`);
  }
}

function emitTransition(
  lines: string[],
  tr: { from: string; to: string; label?: string },
  indent: string
) {
  if (tr.label) {
    lines.push(`${indent}${tr.from} --> ${tr.to} : ${tr.label}`);
  } else {
    lines.push(`${indent}${tr.from} --> ${tr.to}`);
  }
}

function escapeString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n');
}
