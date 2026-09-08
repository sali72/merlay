/**
 * AST Mutations for Mermaid State Diagrams
 */

import {
  MermaidCompositeStateDef,
  MermaidStateAST,
  MermaidStateDef,
  MermaidStateType,
  MermaidTransitionDef,
  StateDirection,
} from './types';

let stateIdCounter = 1;

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

export function duplicateStates(
  ast: MermaidStateAST,
  stateIds: Iterable<string>
): { stateIds: string[]; transitionIds: string[] } {
  const idMap = new Map<string, string>();
  const newCreatedStateIds: string[] = [];
  const newCreatedTransitionIds: string[] = [];

  for (const sid of stateIds) {
    if (sid === '[*]') continue;
    const oldState = ast.states.get(sid);
    if (!oldState) continue;

    const baseName = oldState.label || sid;
    const newId = `s_${Date.now().toString(36).slice(-4)}_${Math.floor(Math.random() * 1000)}`;
    idMap.set(sid, newId);
    newCreatedStateIds.push(newId);

    const clonedState: MermaidStateDef = {
      type: 'state',
      id: newId,
      label: `${baseName} Copy`,
      stateType: oldState.stateType,
      compositeId: oldState.compositeId,
      style: oldState.style ? { ...oldState.style } : undefined,
    };
    ast.states.set(newId, clonedState);

    if (clonedState.style) {
      ast.styles.push({ targetId: newId, styles: { ...clonedState.style } });
    }

    if (oldState.compositeId && ast.compositeStates.has(oldState.compositeId)) {
      ast.compositeStates.get(oldState.compositeId)!.stateIds.push(newId);
    }
  }

  for (const tr of ast.transitions) {
    const newFrom = idMap.get(tr.from);
    const newTo = idMap.get(tr.to);
    if (newFrom && newTo) {
      const newTr = connectStates(ast, newFrom, newTo, tr.label);
      if (newTr) newCreatedTransitionIds.push(newTr.id);
    }
  }

  return { stateIds: newCreatedStateIds, transitionIds: newCreatedTransitionIds };
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

export function setStateDiagramDirection(
  ast: MermaidStateAST,
  direction: StateDirection
): void {
  ast.direction = direction;
}

export function createCompositeState(
  ast: MermaidStateAST,
  label = 'Composite State'
): string {
  let n = ast.compositeStates.size + 1;
  while (ast.compositeStates.has(`comp_${n}`)) n++;
  const compId = `comp_${n}`;
  const newComp: MermaidCompositeStateDef = {
    type: 'composite',
    id: compId,
    label: label || compId,
    stateIds: [],
    compositeIds: [],
  };

  ast.compositeStates.set(compId, newComp);
  return compId;
}

export function renameCompositeState(
  ast: MermaidStateAST,
  compId: string,
  newLabel: string
): void {
  const comp = ast.compositeStates.get(compId);
  if (comp) {
    comp.label = newLabel;
  }
}

export function deleteCompositeState(
  ast: MermaidStateAST,
  compId: string,
  deleteInnerStates = false
): void {
  const comp = ast.compositeStates.get(compId);
  if (!comp) return;

  if (deleteInnerStates) {
    for (const sid of comp.stateIds) {
      deleteState(ast, sid);
    }
  } else {
    for (const sid of comp.stateIds) {
      const st = ast.states.get(sid);
      if (st && st.compositeId === compId) {
        delete st.compositeId;
      }
    }
  }

  ast.compositeStates.delete(compId);
}

export function moveStateToComposite(
  ast: MermaidStateAST,
  stateId: string,
  targetCompId?: string
): void {
  // The [*] anchor is global — it can never live inside a composite.
  if (stateId === '[*]') return;
  const state = ast.states.get(stateId);
  if (!state) return;

  // Remove from old composite
  if (state.compositeId && ast.compositeStates.has(state.compositeId)) {
    const oldCompId = state.compositeId;
    const oldComp = ast.compositeStates.get(oldCompId)!;
    oldComp.stateIds = oldComp.stateIds.filter((id) => id !== stateId);
    if (oldComp.stateIds.length === 0 && (!oldComp.compositeIds || oldComp.compositeIds.length === 0)) {
      ast.compositeStates.delete(oldCompId);
      ast.styles = ast.styles.filter((s) => s.targetId !== oldCompId);
    }
  }

  // Assign to new composite
  if (targetCompId && ast.compositeStates.has(targetCompId)) {
    state.compositeId = targetCompId;
    const targetComp = ast.compositeStates.get(targetCompId)!;
    if (!targetComp.stateIds.includes(stateId)) {
      targetComp.stateIds.push(stateId);
    }
  } else {
    delete state.compositeId;
  }
}
