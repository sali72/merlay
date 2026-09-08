/**
 * Transition mutations for Mermaid State Diagrams
 */

import { MermaidStateAST, MermaidTransitionDef } from '../types';

export function ensureStartEndEntry(ast: MermaidStateAST): void {
  if (!ast.states.has('[*]')) {
    ast.states.set('[*]', {
      type: 'state',
      id: '[*]',
      label: '[*]',
      stateType: 'start',
    });
  }
}

export function connectStates(
  ast: MermaidStateAST,
  fromId: string,
  toId: string,
  label?: string
): MermaidTransitionDef | null {
  if (fromId === '[*]' && toId === '[*]') return null;

  // Same endpoints with the same label are duplicates; same endpoints with a
  // different label are distinct transitions (different events/conditions).
  const normalizedLabel = label?.trim() || undefined;
  const existing = ast.transitions.find(
    (t) => t.from === fromId && t.to === toId && (t.label || undefined) === normalizedLabel
  );
  if (existing) {
    return existing;
  }

  if (fromId === '[*]' || toId === '[*]') {
    ensureStartEndEntry(ast);
  }

  const transitionId = `t_${fromId}_${toId}_${ast.transitions.length + 1}`;
  const newTransition: MermaidTransitionDef = {
    type: 'transition',
    id: transitionId,
    from: fromId,
    to: toId,
    label,
  };

  ast.transitions.push(newTransition);
  return newTransition;
}

export function deleteTransition(ast: MermaidStateAST, transitionId: string): void {
  ast.transitions = ast.transitions.filter((t) => t.id !== transitionId);
}

export function deleteTransitions(
  ast: MermaidStateAST,
  transitionIds: Iterable<string>
): void {
  const idSet = new Set(transitionIds);
  ast.transitions = ast.transitions.filter((t) => !idSet.has(t.id));
}

export function connectToEndState(
  ast: MermaidStateAST,
  fromId: string,
  label?: string
): MermaidTransitionDef | null {
  return connectStates(ast, fromId, '[*]', label);
}

export function connectFromStartState(
  ast: MermaidStateAST,
  toId: string,
  label?: string
): MermaidTransitionDef | null {
  return connectStates(ast, '[*]', toId, label);
}

export function updateTransitionLabel(
  ast: MermaidStateAST,
  transitionId: string,
  newLabel: string
): void {
  const tr = ast.transitions.find((t) => t.id === transitionId);
  if (tr) {
    tr.label = newLabel.trim() || undefined;
  }
}
