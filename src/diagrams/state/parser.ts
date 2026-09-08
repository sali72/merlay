/**
 * Parser for Mermaid State Diagrams (stateDiagram-v2 / stateDiagram)
 */

import { StateToken, tokenizeStateDiagram } from './lexer';
import {
  MermaidCompositeStateDef,
  MermaidStateAST,
  MermaidStateDef,
  MermaidStateType,
  MermaidTransitionDef,
  StateDirection,
} from './types';

export function parseMermaidStateDiagram(input: string): MermaidStateAST {
  const tokens = tokenizeStateDiagram(input);
  let cursor = 0;

  const ast: MermaidStateAST = {
    diagramType: 'stateDiagram-v2',
    states: new Map(),
    transitions: [],
    compositeStates: new Map(),
    styles: [],
    rawLines: [],
  };

  const compositeStack: string[] = [];

  function currentToken(): StateToken {
    return tokens[cursor] || { type: 'EOF', value: '', line: -1, col: -1 };
  }

  function advance(): StateToken {
    const t = currentToken();
    cursor++;
    return t;
  }

  function skipNewlines() {
    while (currentToken().type === 'NEWLINE') {
      advance();
    }
  }

  // Parse Header
  skipNewlines();
  if (currentToken().type === 'DIRECTIVE') {
    const dirToken = advance();
    ast.diagramType = dirToken.value.toLowerCase() === 'statediagram'
      ? 'stateDiagram'
      : 'stateDiagram-v2';
  }

  while (cursor < tokens.length && currentToken().type !== 'EOF') {
    skipNewlines();
    if (currentToken().type === 'EOF') break;

    const token = currentToken();

    // 1. Comments — preserved verbatim so visual edits never drop them
    if (token.type === 'COMMENT') {
      const t = advance();
      ast.rawLines.push({ text: t.value, compositeId: compositeStack[compositeStack.length - 1] });
      continue;
    }

    // 1b. Unsupported statements (notes, classDefs, --, :::) — preserved verbatim
    if (token.type === 'RAW_LINE') {
      const t = advance();
      ast.rawLines.push({ text: t.value, compositeId: compositeStack[compositeStack.length - 1] });
      continue;
    }

    // 2. Direction statement: direction LR / direction TB
    if (token.type === 'DIRECTION_KEYWORD') {
      advance(); // consume 'direction'
      if (currentToken().type === 'DIRECTION') {
        const dirVal = advance().value as StateDirection;
        const currentComposite = compositeStack[compositeStack.length - 1];
        if (currentComposite && ast.compositeStates.has(currentComposite)) {
          ast.compositeStates.get(currentComposite)!.direction = dirVal;
        } else {
          ast.direction = dirVal;
        }
      }
      continue;
    }

    // 3. Composite State close: '}'
    if (token.type === 'CLOSE_BRACE') {
      advance();
      compositeStack.pop();
      continue;
    }

    // 4. State keyword declaration:
    // - state "Label" as StateId
    // - state StateId <<choice>> / <<fork>> / <<join>>
    // - state StateId { ... }
    if (token.type === 'STATE_KEYWORD') {
      advance(); // consume 'state'
      parseStateKeywordStatement();
      continue;
    }

    // 5. Transition or State with colon statement:
    // - StateA --> StateB [: label]
    // - [*] --> StateA
    // - StateA --> [*]
    // - StateA : Label description
    if (token.type === 'START_END' || token.type === 'IDENTIFIER') {
      parseTransitionOrStateDescription();
      continue;
    }

    // 6. Style statement: style StateA fill:...
    if (token.type === 'STYLE') {
      advance();
      let targetId = '';
      if (currentToken().type === 'IDENTIFIER') {
        targetId = advance().value;
      }
      const styleTokens: string[] = [];
      while (currentToken().type !== 'NEWLINE' && currentToken().type !== 'EOF') {
        styleTokens.push(advance().value);
      }
      if (targetId) {
        const styleMap = parseStyleString(styleTokens.join(' '));
        ast.styles.push({ targetId, styles: styleMap });
        if (ast.states.has(targetId)) {
          ast.states.get(targetId)!.style = {
            ...(ast.states.get(targetId)!.style || {}),
            ...styleMap,
          };
        }
      }
      continue;
    }

    // Advance unknown tokens to avoid infinite loops
    advance();
  }

  // 7. Reconcile: a transition may reference a composite id before it is
  // declared, which creates an implicit state. Composite ids win — drop the
  // duplicate state (transitions keep the id and resolve to the composite).
  for (const compId of ast.compositeStates.keys()) {
    const dupState = ast.states.get(compId);
    if (!dupState) continue;
    const comp = ast.compositeStates.get(compId)!;
    if (dupState.label && dupState.label !== compId && (comp.label === compId || !comp.label)) {
      comp.label = dupState.label;
    }
    ast.states.delete(compId);
    for (const other of ast.compositeStates.values()) {
      other.stateIds = other.stateIds.filter((id) => id !== compId);
    }
  }

  return ast;

  function parseStateKeywordStatement() {
    let label = '';
    let stateId = '';

    // Check if label string first: state "My State" as S1
    if (currentToken().type === 'STRING') {
      label = advance().value;
      if (currentToken().type === 'AS_KEYWORD') {
        advance(); // consume 'as'
        if (currentToken().type === 'IDENTIFIER') {
          stateId = advance().value;
        }
      }
    } else if (currentToken().type === 'IDENTIFIER') {
      stateId = advance().value;
      if (currentToken().type === 'AS_KEYWORD') {
        advance(); // consume 'as'
        if (currentToken().type === 'IDENTIFIER') {
          label = stateId;
          stateId = advance().value;
        }
      }
    }

    if (!stateId) return;

    // Check for stereotype <<choice>>, <<fork>>, <<join>>
    let stateType: MermaidStateType = 'normal';
    if (currentToken().type === 'CHOICE') {
      stateType = 'choice';
      advance();
    } else if (currentToken().type === 'FORK') {
      stateType = 'fork';
      advance();
    } else if (currentToken().type === 'JOIN') {
      stateType = 'join';
      advance();
    }

    // Check for composite state opening brace '{'
    if (currentToken().type === 'OPEN_BRACE') {
      advance(); // consume '{'
      const compDef: MermaidCompositeStateDef = {
        type: 'composite',
        id: stateId,
        label: label || stateId,
        stateIds: [],
        compositeIds: [],
      };
      ast.compositeStates.set(stateId, compDef);

      const parentComp = compositeStack[compositeStack.length - 1];
      if (parentComp && ast.compositeStates.has(parentComp)) {
        ast.compositeStates.get(parentComp)!.compositeIds.push(stateId);
      }

      compositeStack.push(stateId);
      return;
    }

    // Otherwise standard state or stereotype state
    ensureStateExists(stateId, label, stateType);
  }

  function parseTransitionOrStateDescription() {
    const fromToken = advance();
    const fromId = fromToken.value;

    if (fromId === '[*]') {
      ensureStateExists('[*]', '[*]', 'start');
    }

    // Case A: Transition: from --> to [: label]
    if (currentToken().type === 'ARROW') {
      advance(); // consume '-->'

      let toId = '';
      if (currentToken().type === 'START_END' || currentToken().type === 'IDENTIFIER') {
        toId = advance().value;
      }
      if (!toId) return;

      if (toId === '[*]') {
        ensureStateExists('[*]', '[*]', 'end');
      } else {
        ensureStateExists(toId);
      }

      if (fromId !== '[*]') {
        ensureStateExists(fromId);
      }

      let transitionLabel: string | undefined;
      if (currentToken().type === 'COLON') {
        advance(); // consume ':'
        if (currentToken().type === 'STRING' || currentToken().type === 'IDENTIFIER') {
          transitionLabel = advance().value.trim();
        }
      }

      const transitionDef: MermaidTransitionDef = {
        type: 'transition',
        id: `t_${fromId}_${toId}_${ast.transitions.length + 1}`,
        from: fromId,
        to: toId,
        label: transitionLabel,
      };

      ast.transitions.push(transitionDef);
      return;
    }

    // Case B: State description: StateId : Description
    if (currentToken().type === 'COLON') {
      advance(); // consume ':'
      let desc = '';
      if (currentToken().type === 'STRING' || currentToken().type === 'IDENTIFIER') {
        desc = advance().value.trim();
      }
      ensureStateExists(fromId, desc);
      return;
    }

    // Case C: Standalone state reference
    ensureStateExists(fromId);
  }

  function ensureStateExists(
    id: string,
    label?: string,
    stateType: MermaidStateType = 'normal'
  ) {
    const currentComp = compositeStack[compositeStack.length - 1];

    // Composite states are valid transition endpoints — never shadow them
    // with a duplicate state of the same id.
    if (id !== '[*]' && ast.compositeStates.has(id)) {
      return;
    }

    if (!ast.states.has(id)) {
      const newState: MermaidStateDef = {
        type: 'state',
        id,
        label: label || id,
        stateType,
        compositeId: currentComp,
      };
      ast.states.set(id, newState);

      if (currentComp && ast.compositeStates.has(currentComp)) {
        const comp = ast.compositeStates.get(currentComp)!;
        if (!comp.stateIds.includes(id)) {
          comp.stateIds.push(id);
        }
      }
    } else {
      const existing = ast.states.get(id)!;
      if (label) existing.label = label;
      if (stateType !== 'normal') existing.stateType = stateType;
      if (currentComp && !existing.compositeId) {
        existing.compositeId = currentComp;
        const comp = ast.compositeStates.get(currentComp);
        if (comp && !comp.stateIds.includes(id)) {
          comp.stateIds.push(id);
        }
      }
    }
  }

  function parseStyleString(str: string): Record<string, string> {
    const styleMap: Record<string, string> = {};
    const parts = str.split(/[,;]/);
    for (const part of parts) {
      const colonIdx = part.indexOf(':');
      if (colonIdx !== -1) {
        const k = part.substring(0, colonIdx).trim();
        const v = part.substring(colonIdx + 1).trim();
        if (k && v) styleMap[k] = v;
      }
    }
    return styleMap;
  }
}
