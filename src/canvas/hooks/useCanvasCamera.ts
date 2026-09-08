import { useState, useRef, useCallback } from 'react';
import { Rect } from '../types';

export interface UseCanvasCameraOptions {
  worldRef: React.RefObject<HTMLDivElement>;
  svgMountRef: React.RefObject<HTMLDivElement>;
}

export function useCanvasCamera({ worldRef, svgMountRef }: UseCanvasCameraOptions) {
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);

  const zoomRef = useRef<number>(1);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pendingCameraPinRef = useRef<{
    nodeId: string;
    screenX: number;
    screenY: number;
  } | null>(null);

  // Convert an SVG/DOM element bounding rect to world coordinates
  const getLocalRect = useCallback((el: Element): Rect | null => {
    if (!worldRef.current) return null;
    const worldRect = worldRef.current.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    if (elRect.width === 0 && elRect.height === 0) return null;
    const currentZoom = zoomRef.current;
    return {
      x: (elRect.left - worldRect.left) / currentZoom,
      y: (elRect.top - worldRect.top) / currentZoom,
      width: elRect.width / currentZoom,
      height: elRect.height / currentZoom,
    };
  }, [worldRef]);

  // Record screen position of active node to stabilize camera across re-render
  const pinNodeForCamera = useCallback((nodeId: string) => {
    if (!svgMountRef.current) return;
    const activeEl = svgMountRef.current.querySelector(
      `[data-mermaid-node-id="${nodeId}"]`
    );
    if (activeEl) {
      const b = activeEl.getBoundingClientRect();
      pendingCameraPinRef.current = {
        nodeId,
        screenX: b.left + b.width / 2,
        screenY: b.top + b.height / 2,
      };
    }
  }, [svgMountRef]);

  // Readjust camera pan after re-rendering so mutated node remains visually stationary
  const stabilizeCamera = useCallback(() => {
    const pin = pendingCameraPinRef.current;
    if (!pin || !svgMountRef.current) return;
    pendingCameraPinRef.current = null;

    const activeEl = svgMountRef.current.querySelector(
      `[data-mermaid-node-id="${pin.nodeId}"]`
    );
    if (!activeEl) return;

    const b = activeEl.getBoundingClientRect();
    const newScreenX = b.left + b.width / 2;
    const newScreenY = b.top + b.height / 2;

    const deltaX = pin.screenX - newScreenX;
    const deltaY = pin.screenY - newScreenY;

    if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
      setPan((prev) => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));
    }
  }, [svgMountRef]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((prevZoom) => {
        const newZoom = Math.min(Math.max(prevZoom * zoomFactor, 0.2), 3);
        zoomRef.current = newZoom;
        return newZoom;
      });
    } else {
      // Pan
      setPan((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  }, []);

  const handleFitView = useCallback(() => {
    setZoom(1);
    zoomRef.current = 1;
    setPan({ x: 0, y: 0 });
  }, []);

  const startPan = useCallback((clientX: number, clientY: number) => {
    setIsPanning(true);
    panStartRef.current = {
      x: clientX - pan.x,
      y: clientY - pan.y,
    };
  }, [pan]);

  const updatePan = useCallback((clientX: number, clientY: number) => {
    setPan({
      x: clientX - panStartRef.current.x,
      y: clientY - panStartRef.current.y,
    });
  }, []);

  const endPan = useCallback(() => {
    setIsPanning(false);
  }, []);

  return {
    zoom,
    setZoom,
    pan,
    setPan,
    isPanning,
    setIsPanning,
    zoomRef,
    panStartRef,
    pendingCameraPinRef,
    getLocalRect,
    pinNodeForCamera,
    stabilizeCamera,
    handleWheel,
    handleFitView,
    startPan,
    updatePan,
    endPan,
  };
}
