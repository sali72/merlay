/**
 * Composite State mutations for Mermaid State Diagrams
 */

import {
  MermaidCompositeStateDef,
  MermaidStateAST,
  StateDirection,
} from '../types';
import {
  deleteState,
  removeComposite,
} from './stateMutations';

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

  // Removes the definition, its styles, and the transitions that targeted
  // the composite itself (dropping them beats leaving mermaid to auto-create
  // a replacement state with the same id).
  removeComposite(ast, compId);
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
      removeComposite(ast, oldCompId);
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
