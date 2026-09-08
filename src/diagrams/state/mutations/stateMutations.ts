/**
 * State-specific mutations for Mermaid State Diagrams
 */

import {
  MermaidStateAST,
  MermaidStateDef,
  MermaidStateType,
} from '../types';
import {
  connectStates,
  ensureStartEndEntry,
} from './transitionMutations';

export function generateStateId(prefix = 'state'): string {
  return `${prefix}_${Date.now().toString(36).slice(-4)}_${Math.floor(
    Math.random() * 1000
  )}`;
}

export function addState(
  ast: MermaidStateAST,
  label = 'New State',
  stateType: MermaidStateType = 'normal',
  compositeId?: string
): string {
  const id = generateStateId('s');
  const newState: MermaidStateDef = {
    type: 'state',
    id,
    label: label || id,
    stateType,
    compositeId,
  };

  ast.states.set(id, newState);

  if (compositeId && ast.compositeStates.has(compositeId)) {
    ast.compositeStates.get(compositeId)!.stateIds.push(id);
  }

  return id;
}

export function addChildState(
  ast: MermaidStateAST,
  parentStateId: string,
  label = 'Next State',
  transitionLabel?: string
): string {
  const parent = ast.states.get(parentStateId);
  const compositeId = parent?.compositeId;
  const childId = addState(ast, label, 'normal', compositeId);

  connectStates(ast, parentStateId, childId, transitionLabel);
  return childId;
}

export { ensureStartEndEntry };

export function hasStartState(ast: MermaidStateAST): boolean {
  return ast.transitions.some((t) => t.from === '[*]');
}

export function hasEndState(ast: MermaidStateAST): boolean {
  return ast.transitions.some((t) => t.to === '[*]');
}

export function addStartState(
  ast: MermaidStateAST,
  label = 'New State'
): string | null {
  if (hasStartState(ast)) return null;
  ensureStartEndEntry(ast);
  const id = addState(ast, label, 'normal');
  connectStates(ast, '[*]', id);
  return id;
}

export function addEndState(
  ast: MermaidStateAST,
  label = 'New State'
): string | null {
  if (hasEndState(ast)) return null;
  ensureStartEndEntry(ast);
  const id = addState(ast, label, 'normal');
  connectStates(ast, id, '[*]');
  return id;
}

/** Remove composites left with no real members ([*] alone does not count). */
export function pruneEmptyComposites(ast: MermaidStateAST): void {
  for (const [compId, comp] of Array.from(ast.compositeStates.entries())) {
    const hasNested = (comp.compositeIds?.length ?? 0) > 0;
    const hasMembers = comp.stateIds.some((id) => id !== '[*]');
    if (!hasNested && !hasMembers) {
      for (const sid of comp.stateIds) {
        const st = ast.states.get(sid);
        if (st && st.compositeId === compId) {
          delete st.compositeId;
        }
      }
      ast.compositeStates.delete(compId);
      ast.styles = ast.styles.filter((s) => s.targetId !== compId);
    }
  }
}

/** Drop the [*] entry once no transition references it (it renders nothing). */
export function pruneOrphanStartEnd(ast: MermaidStateAST): void {
  if (
    ast.states.has('[*]') &&
    !ast.transitions.some((t) => t.from === '[*]' || t.to === '[*]')
  ) {
    ast.states.delete('[*]');
  }
}

export function deleteStartAnchor(ast: MermaidStateAST): void {
  const before = ast.transitions.length;
  ast.transitions = ast.transitions.filter((t) => t.from !== '[*]');
  if (ast.transitions.length !== before) {
    pruneOrphanStartEnd(ast);
  }
}

export function deleteEndAnchor(ast: MermaidStateAST): void {
  const before = ast.transitions.length;
  ast.transitions = ast.transitions.filter((t) => t.to !== '[*]');
  if (ast.transitions.length !== before) {
    pruneOrphanStartEnd(ast);
  }
}

export function deleteState(ast: MermaidStateAST, stateId: string): void {
  ast.states.delete(stateId);

  // Cascade delete all transitions connected to this state
  ast.transitions = ast.transitions.filter(
    (t) => t.from !== stateId && t.to !== stateId
  );

  // Remove from composite states
  for (const comp of ast.compositeStates.values()) {
    comp.stateIds = comp.stateIds.filter((id) => id !== stateId);
  }

  // Remove from styles
  ast.styles = ast.styles.filter((s) => s.targetId !== stateId);

  // An emptied composite block is invalid mermaid syntax — dissolve it.
  pruneEmptyComposites(ast);
  pruneOrphanStartEnd(ast);
}

export function deleteStates(ast: MermaidStateAST, stateIds: Iterable<string>): void {
  const idSet = new Set(stateIds);
  for (const id of idSet) {
    ast.states.delete(id);
  }

  ast.transitions = ast.transitions.filter(
    (t) => !idSet.has(t.from) && !idSet.has(t.to)
  );

  for (const comp of ast.compositeStates.values()) {
    comp.stateIds = comp.stateIds.filter((id) => !idSet.has(id));
  }

  ast.styles = ast.styles.filter((s) => !idSet.has(s.targetId));

  pruneEmptyComposites(ast);
  pruneOrphanStartEnd(ast);
}

export function updateStateLabel(
  ast: MermaidStateAST,
  stateId: string,
  newLabel: string
): void {
  if (stateId === '[*]') return;
  const state = ast.states.get(stateId);
  if (!state) return;
  // Only normal states carry text (choice diamonds, fork/join bars and [*]
  // anchors render no text in mermaid)
  if (state.stateType !== 'normal') return;
  state.label = newLabel;
}

/** States that carry editable text (double-click rename allowed). */
export function isStateTextEditable(state: MermaidStateDef | undefined): boolean {
  if (!state) return false;
  if (state.id === '[*]') return false;
  return state.stateType === 'normal';
}

export function updateStateType(
  ast: MermaidStateAST,
  stateId: string,
  newType: MermaidStateType
): void {
  if (stateId === '[*]') return;
  // Start/end anchors are managed via Add Start / Add End actions, never by
  // morphing a normal node (that was destructive: it deleted the node and
  // rewired edges, easily producing invalid `[*] --> [*]` transitions).
  if (newType === 'start' || newType === 'end') return;

  const state = ast.states.get(stateId);
  if (state) {
    state.stateType = newType;
    if (newType === 'choice' || newType === 'fork' || newType === 'join') {
      // Choice diamonds and fork/join bars carry no text
      state.label = state.id;
    } else if (state.label === '[*]') {
      state.label = state.id;
    }
    // normal keeps its existing label
  }
}
