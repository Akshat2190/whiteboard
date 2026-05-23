import { useRef, useCallback, useState } from 'react';
import { useWhiteboardStore } from '../../../store/whiteboardStore';
import {
  getElementAtPosition,
  getElementsInRect,
  getResizeHandles,
  normalizeElement,
} from '../../../utils/drawing';

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function getResizeCursor(pos) {
  const map = {
    nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize',
    e: 'e-resize', se: 'se-resize', s: 's-resize',
    sw: 'sw-resize', w: 'w-resize',
  };
  return map[pos] || 'default';
}

function hitHandle(px, py, handles, tolerance = 8) {
  for (const h of handles) {
    if (Math.abs(px - h.x) <= tolerance && Math.abs(py - h.y) <= tolerance) return h;
  }
  return null;
}

function setCursor(canvasRef, cursor) {
  if (canvasRef.current) canvasRef.current.style.cursor = cursor;
}

export function useCanvas({ canvasRef, pushHistory, onRedraw }) {
  // All interaction state as refs to avoid triggering re-renders mid-drag
  const isDrawingRef    = useRef(false);
  const startXRef       = useRef(0);
  const startYRef       = useRef(0);
  const currentElementRef = useRef(null);

  const isPanningRef    = useRef(false);
  const lastPanRef      = useRef({ x: 0, y: 0 });

  const isDraggingRef   = useRef(false);
  const dragOffsetRef   = useRef({});

  const isResizingRef   = useRef(false);
  const resizeHandleRef = useRef(null);
  const resizeStartRef  = useRef(null);

  const isSelRectRef    = useRef(false);
  const selRectRef      = useRef(null);

  const [textInput, setTextInput] = useState(null);
  const [, forceUpdate] = useState(0);
  const rerender = useCallback(() => forceUpdate((n) => n + 1), []);

  // ─── Coordinate helper ────────────────────────────────────────────────────
  const getCanvasPoint = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const { zoom, scrollX, scrollY } = useWhiteboardStore.getState();
    return {
      x: (e.clientX - rect.left - scrollX) / zoom,
      y: (e.clientY - rect.top  - scrollY) / zoom,
    };
  }, [canvasRef]);

  // ─── Mouse Down ──────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();

    const state = useWhiteboardStore.getState();
    const { tool, elements, selectedIds } = state;
    const { x, y } = getCanvasPoint(e);

    // HAND ─ pan
    if (tool === 'hand') {
      isPanningRef.current = true;
      lastPanRef.current = { x: e.clientX, y: e.clientY };
      setCursor(canvasRef, 'grabbing');
      return;
    }

    // ERASER
    if (tool === 'eraser') {
      const hit = getElementAtPosition(x, y, elements);
      if (hit) {
        pushHistory(elements);
        useWhiteboardStore.getState().updateElement(hit.id, { isDeleted: true });
        onRedraw?.();
      }
      return;
    }

    // TEXT
    if (tool === 'text') {
      pushHistory(elements);
      const id = uuid();
      const newEl = {
        id, type: 'text', x, y, width: 200, height: 40, angle: 0,
        strokeColor: state.strokeColor, backgroundColor: 'transparent',
        fillStyle: 'none', strokeWidth: state.strokeWidth,
        strokeStyle: state.strokeStyle, roughness: 0,
        opacity: state.opacity, points: [], text: '',
        fontSize: 20, fontFamily: 'Inter', isDeleted: false,
        seed: Math.floor(Math.random() * 100000),
      };
      useWhiteboardStore.getState().addElement(newEl);
      useWhiteboardStore.getState().setSelectedIds([id]);

      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const screenX = rect.left + x * state.zoom + state.scrollX;
        const screenY = rect.top  + y * state.zoom + state.scrollY;
        setTextInput({ id, x, y, screenX, screenY });
      }
      return;
    }

    // SELECT
    if (tool === 'select') {
      const activeEl = elements.filter((el) => !el.isDeleted);
      const store = useWhiteboardStore.getState();

      // Resize handle?
      if (selectedIds.length === 1) {
        const selEl = activeEl.find((el) => el.id === selectedIds[0]);
        if (selEl && !['freedraw', 'line', 'arrow'].includes(selEl.type)) {
          const handles = getResizeHandles(selEl);
          const hit = hitHandle(x, y, handles);
          if (hit) {
            isResizingRef.current = true;
            resizeHandleRef.current = hit.position;
            resizeStartRef.current = { x, y, element: { ...selEl } };
            setCursor(canvasRef, getResizeCursor(hit.position));
            return;
          }
        }
      }

      // Hit test an element
      const hit = getElementAtPosition(x, y, activeEl);
      if (hit) {
        if (!selectedIds.includes(hit.id)) store.setSelectedIds([hit.id]);
        isDraggingRef.current = true;
        const ids = selectedIds.includes(hit.id) ? selectedIds : [hit.id];
        dragOffsetRef.current = {};
        ids.forEach((id) => {
          const el = activeEl.find((e) => e.id === id);
          if (el) dragOffsetRef.current[id] = { dx: x - el.x, dy: y - el.y };
        });
        if (!selectedIds.includes(hit.id)) {
          dragOffsetRef.current[hit.id] = { dx: x - hit.x, dy: y - hit.y };
        }
        setCursor(canvasRef, 'move');
        return;
      }

      // Marquee selection
      store.setSelectedIds([]);
      isSelRectRef.current = true;
      startXRef.current = x;
      startYRef.current = y;
      selRectRef.current = { x, y, width: 0, height: 0 };
      return;
    }

    // DRAWING TOOLS
    const drawingTools = ['rectangle', 'ellipse', 'diamond', 'arrow', 'line', 'freedraw'];
    if (drawingTools.includes(tool)) {
      pushHistory(elements);
      const id = uuid();
      currentElementRef.current = {
        id, type: tool, x, y, width: 0, height: 0, angle: 0,
        strokeColor: state.strokeColor, backgroundColor: state.backgroundColor,
        fillStyle: state.fillStyle, strokeWidth: state.strokeWidth,
        strokeStyle: state.strokeStyle, roughness: state.roughness,
        opacity: state.opacity,
        points: tool === 'freedraw' ? [[x, y]] : [],
        text: '', fontSize: 20, fontFamily: 'Inter', isDeleted: false,
        seed: Math.floor(Math.random() * 100000),
      };
      isDrawingRef.current = true;
      startXRef.current = x;
      startYRef.current = y;
      onRedraw?.();
    }
  }, [canvasRef, getCanvasPoint, pushHistory, onRedraw]);

  // ─── Mouse Move ──────────────────────────────────────────────────────────
  const onMouseMove = useCallback((e) => {
    const { zoom, scrollX, scrollY, tool, selectedIds, elements } = useWhiteboardStore.getState();
    const { x, y } = getCanvasPoint(e);
    const store = useWhiteboardStore.getState();

    // Hover cursor hints
    if (!isPanningRef.current && !isDraggingRef.current && !isResizingRef.current && !isDrawingRef.current) {
      if (tool === 'hand') {
        setCursor(canvasRef, 'grab');
      } else if (tool === 'select') {
        const active = elements.filter((el) => !el.isDeleted);
        if (selectedIds.length === 1) {
          const selEl = active.find((el) => el.id === selectedIds[0]);
          if (selEl && !['freedraw', 'line', 'arrow'].includes(selEl.type)) {
            const h = hitHandle(x, y, getResizeHandles(selEl));
            if (h) { setCursor(canvasRef, getResizeCursor(h.position)); onRedraw?.(); return; }
          }
        }
        const hit = getElementAtPosition(x, y, active);
        setCursor(canvasRef, hit ? 'move' : 'default');
      } else if (tool === 'eraser') {
        setCursor(canvasRef, 'cell');
      } else if (['rectangle','ellipse','diamond','arrow','line','freedraw','text'].includes(tool)) {
        setCursor(canvasRef, 'crosshair');
      }
    }

    // Pan
    if (isPanningRef.current) {
      const dx = e.clientX - lastPanRef.current.x;
      const dy = e.clientY - lastPanRef.current.y;
      store.setScroll(scrollX + dx, scrollY + dy);
      lastPanRef.current = { x: e.clientX, y: e.clientY };
      onRedraw?.();
      return;
    }

    // Drawing
    if (isDrawingRef.current && currentElementRef.current) {
      const el = currentElementRef.current;
      if (el.type === 'freedraw') {
        el.points = [...(el.points || []), [x, y]];
      } else {
        el.width  = x - startXRef.current;
        el.height = y - startYRef.current;
      }
      onRedraw?.();
      return;
    }

    // Drag
    if (isDraggingRef.current) {
      const active = elements.filter((el) => !el.isDeleted);
      selectedIds.forEach((id) => {
        const offset = dragOffsetRef.current[id];
        if (!offset) return;
        const el = active.find((e) => e.id === id);
        if (!el) return;
        const newX = x - offset.dx;
        const newY = y - offset.dy;
        if (el.type === 'freedraw' && el.points?.length) {
          const dx = newX - el.x; const dy = newY - el.y;
          store.updateElement(id, { x: newX, y: newY, points: el.points.map(([px, py]) => [px + dx, py + dy]) });
        } else {
          store.updateElement(id, { x: newX, y: newY });
        }
      });
      onRedraw?.();
      return;
    }

    // Resize
    if (isResizingRef.current && resizeStartRef.current) {
      const { element: orig, x: sx, y: sy } = resizeStartRef.current;
      const dx = x - sx; const dy = y - sy;
      const pos = resizeHandleRef.current;
      let { x: ex, y: ey, width: ew, height: eh } = orig;
      if (pos.includes('e')) ew = orig.width  + dx;
      if (pos.includes('s')) eh = orig.height + dy;
      if (pos.includes('w')) { ex = orig.x + dx; ew = orig.width  - dx; }
      if (pos.includes('n')) { ey = orig.y + dy; eh = orig.height - dy; }
      store.updateElement(orig.id, { x: ex, y: ey, width: ew, height: eh });
      onRedraw?.();
      return;
    }

    // Marquee rect
    if (isSelRectRef.current) {
      selRectRef.current = {
        x: startXRef.current, y: startYRef.current,
        width: x - startXRef.current, height: y - startYRef.current,
      };
      rerender();
      onRedraw?.();
    }
  }, [canvasRef, getCanvasPoint, onRedraw, rerender]);

  // ─── Mouse Up ────────────────────────────────────────────────────────────
  const onMouseUp = useCallback((e) => {
    const { elements } = useWhiteboardStore.getState();
    const store = useWhiteboardStore.getState();

    if (isDrawingRef.current && currentElementRef.current) {
      const el = currentElementRef.current;
      let normalized = el;

      if (el.type === 'freedraw') {
        if (el.points?.length) {
          let minX = Infinity, minY = Infinity;
          for (const [px, py] of el.points) { minX = Math.min(minX, px); minY = Math.min(minY, py); }
          normalized = { ...el, x: minX, y: minY };
        }
      } else {
        normalized = normalizeElement(el);
      }

      const hasSize = el.type === 'freedraw'
        ? el.points?.length > 1
        : Math.abs(normalized.width) > 2 || Math.abs(normalized.height) > 2;

      if (hasSize) {
        store.addElement(normalized);
        store.setSelectedIds([normalized.id]);
      }

      isDrawingRef.current = false;
      currentElementRef.current = null;
      onRedraw?.();
    }

    if (isPanningRef.current) {
      isPanningRef.current = false;
      setCursor(canvasRef, 'grab');
    }

    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setCursor(canvasRef, 'default');
    }

    if (isResizingRef.current) {
      isResizingRef.current = false;
      resizeHandleRef.current = null;
      resizeStartRef.current = null;
      setCursor(canvasRef, 'default');
    }

    if (isSelRectRef.current && selRectRef.current) {
      const { x: rx, y: ry, width: rw, height: rh } = selRectRef.current;
      const found = getElementsInRect(rx, ry, rx + rw, ry + rh, elements.filter((e) => !e.isDeleted));
      store.setSelectedIds(found.map((el) => el.id));
      isSelRectRef.current = false;
      selRectRef.current = null;
      rerender();
      onRedraw?.();
    }
  }, [canvasRef, onRedraw, rerender]);

  // ─── Wheel ───────────────────────────────────────────────────────────────
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const { zoom, scrollX, scrollY } = useWhiteboardStore.getState();
    const store = useWhiteboardStore.getState();

    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY * -0.005;
      const newZoom = Math.min(5, Math.max(0.1, zoom + delta));
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const newScrollX = mouseX - (mouseX - scrollX) * (newZoom / zoom);
      const newScrollY = mouseY - (mouseY - scrollY) * (newZoom / zoom);
      store.setZoom(newZoom);
      store.setScroll(newScrollX, newScrollY);
    } else {
      store.setScroll(scrollX - e.deltaX, scrollY - e.deltaY);
    }
    onRedraw?.();
  }, [canvasRef, onRedraw]);

  // ─── Double Click ────────────────────────────────────────────────────────
  const onDoubleClick = useCallback((e) => {
    const { tool, elements } = useWhiteboardStore.getState();
    const { x, y } = getCanvasPoint(e);

    if (tool === 'select') {
      const hit = getElementAtPosition(x, y, elements.filter((el) => !el.isDeleted));
      if (hit?.type === 'text') {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const { zoom: z, scrollX: sx, scrollY: sy } = useWhiteboardStore.getState();
        setTextInput({
          id: hit.id, x: hit.x, y: hit.y,
          screenX: rect.left + hit.x * z + sx,
          screenY: rect.top  + hit.y * z + sy,
        });
      }
    }
  }, [canvasRef, getCanvasPoint]);

  // ─── Touch ───────────────────────────────────────────────────────────────
  const pinchRef = useRef(null);

  const onTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      const [t1, t2] = e.touches;
      pinchRef.current = {
        dist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
        zoom: useWhiteboardStore.getState().zoom,
      };
      return;
    }
    const t = e.touches[0];
    onMouseDown({ clientX: t.clientX, clientY: t.clientY, button: 0, preventDefault: () => e.preventDefault() });
  }, [onMouseDown]);

  const onTouchMove = useCallback((e) => {
    e.preventDefault();
    if (e.touches.length === 2 && pinchRef.current) {
      const [t1, t2] = e.touches;
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      useWhiteboardStore.getState().setZoom(pinchRef.current.zoom * (dist / pinchRef.current.dist));
      onRedraw?.();
      return;
    }
    if (e.touches.length === 1) {
      const t = e.touches[0];
      onMouseMove({ clientX: t.clientX, clientY: t.clientY });
    }
  }, [onMouseMove, onRedraw]);

  const onTouchEnd = useCallback(() => {
    pinchRef.current = null;
    onMouseUp({});
  }, [onMouseUp]);

  return {
    onMouseDown, onMouseMove, onMouseUp,
    onWheel, onDoubleClick,
    onTouchStart, onTouchMove, onTouchEnd,
    currentElementRef, selRectRef, isSelRectRef,
    textInput, setTextInput,
  };
}
