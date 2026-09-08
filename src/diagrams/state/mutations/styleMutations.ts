/**
 * Style mutations for Mermaid State Diagrams
 */

import { MermaidStateAST } from '../types';

export function updateStateStyle(
  ast: MermaidStateAST,
  stateId: string,
  styles: Record<string, string>
): void {
  if (stateId === '[*]') return;
  const state = ast.states.get(stateId);
  if (state) {
    state.style = { ...(state.style || {}), ...styles };
  }
  const existingIndex = ast.styles.findIndex((s) => s.targetId === stateId);
  if (existingIndex >= 0) {
    ast.styles[existingIndex].styles = {
      ...ast.styles[existingIndex].styles,
      ...styles,
    };
  } else {
    ast.styles.push({ targetId: stateId, styles: { ...styles } });
  }
}

export function updateStatesStyle(
  ast: MermaidStateAST,
  stateIds: Iterable<string>,
  styles: Record<string, string>
): void {
  for (const id of stateIds) {
    updateStateStyle(ast, id, styles);
  }
}

export function clearStateStyle(ast: MermaidStateAST, stateId: string): void {
  const state = ast.states.get(stateId);
  if (state) {
    delete state.style;
  }
  ast.styles = ast.styles.filter((s) => s.targetId !== stateId);
}

export function clearStatesStyle(
  ast: MermaidStateAST,
  stateIds: Iterable<string>
): void {
  const idSet = new Set(stateIds);
  for (const id of idSet) {
    const state = ast.states.get(id);
    if (state) {
      delete state.style;
    }
  }
  ast.styles = ast.styles.filter((s) => !idSet.has(s.targetId));
}

export function getStateStyle(
  ast: MermaidStateAST,
  stateId: string
): Record<string, string> | undefined {
  return ast.states.get(stateId)?.style;
}

export function updateCompositeStateStyle(
  ast: MermaidStateAST,
  compId: string,
  styles: Record<string, string>
): void {
  const comp = ast.compositeStates.get(compId);
  if (comp) {
    comp.style = { ...(comp.style || {}), ...styles };
  }
  const existingIndex = ast.styles.findIndex((s) => s.targetId === compId);
  if (existingIndex >= 0) {
    ast.styles[existingIndex].styles = {
      ...ast.styles[existingIndex].styles,
      ...styles,
    };
  } else {
    ast.styles.push({ targetId: compId, styles: { ...styles } });
  }
}

export function clearCompositeStateStyle(
  ast: MermaidStateAST,
  compId: string
): void {
  const comp = ast.compositeStates.get(compId);
  if (comp) {
    delete comp.style;
  }
  ast.styles = ast.styles.filter((s) => s.targetId !== compId);
}

export function getCompositeStateStyle(
  ast: MermaidStateAST,
  compId: string
): Record<string, string> | undefined {
  return ast.compositeStates.get(compId)?.style;
}
