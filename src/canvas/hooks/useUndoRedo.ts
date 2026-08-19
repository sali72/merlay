import { useState, useCallback, useRef } from 'react';

export function useUndoRedo(initialCode: string) {
  const historyRef = useRef<string[]>([initialCode]);
  const pointerRef = useRef<number>(0);
  const [, setTrigger] = useState(0);

  const pushSnapshot = useCallback((newCode: string) => {
    // If identical to current, ignore
    if (historyRef.current[pointerRef.current] === newCode) return;

    // Discard any redo history past current pointer
    historyRef.current = historyRef.current.slice(0, pointerRef.current + 1);
    historyRef.current.push(newCode);

    // Limit history length to 50
    if (historyRef.current.length > 50) {
      historyRef.current.shift();
    }
    pointerRef.current = historyRef.current.length - 1;
    setTrigger((n) => n + 1);
  }, []);

  const undo = useCallback((): string | null => {
    if (pointerRef.current > 0) {
      pointerRef.current--;
      setTrigger((n) => n + 1);
      return historyRef.current[pointerRef.current];
    }
    return null;
  }, []);

  const redo = useCallback((): string | null => {
    if (pointerRef.current < historyRef.current.length - 1) {
      pointerRef.current++;
      setTrigger((n) => n + 1);
      return historyRef.current[pointerRef.current];
    }
    return null;
  }, []);

  const canUndo = pointerRef.current > 0;
  const canRedo = pointerRef.current < historyRef.current.length - 1;

  return {
    pushSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
