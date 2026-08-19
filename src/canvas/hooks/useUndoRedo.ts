import { useState, useCallback, useRef } from 'react';
import { Node } from '@xyflow/react';

export interface CanvasSnapshot {
  code: string;
  positions?: Record<string, { x: number; y: number }>;
}

export function useUndoRedo(initialCode: string) {
  const historyRef = useRef<CanvasSnapshot[]>([{ code: initialCode }]);
  const pointerRef = useRef<number>(0);
  const [, setTrigger] = useState(0);

  const pushSnapshot = useCallback((newCode: string, currentNodes?: Node[]) => {
    let positions: Record<string, { x: number; y: number }> | undefined;

    if (currentNodes && currentNodes.length > 0) {
      positions = {};
      for (const n of currentNodes) {
        positions[n.id] = { x: n.position.x, y: n.position.y };
      }
    }

    const currentSnapshot = historyRef.current[pointerRef.current];
    if (currentSnapshot && currentSnapshot.code === newCode) {
      // If code is the same, just update positions
      if (positions) {
        currentSnapshot.positions = positions;
      }
      return;
    }

    // Discard redo history
    historyRef.current = historyRef.current.slice(0, pointerRef.current + 1);
    historyRef.current.push({ code: newCode, positions });

    // Limit history length
    if (historyRef.current.length > 50) {
      historyRef.current.shift();
    }
    pointerRef.current = historyRef.current.length - 1;
    setTrigger((n) => n + 1);
  }, []);

  const undo = useCallback((): CanvasSnapshot | null => {
    if (pointerRef.current > 0) {
      pointerRef.current--;
      setTrigger((n) => n + 1);
      return historyRef.current[pointerRef.current];
    }
    return null;
  }, []);

  const redo = useCallback((): CanvasSnapshot | null => {
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
