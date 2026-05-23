import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import rough from 'roughjs/bin/rough';
import { useWhiteboardStore } from '../../store/whiteboardStore';
import {
  drawRectangle,
  drawEllipse,
  drawDiamond,
  drawLine,
  drawArrow,
  drawFreedraw,
  drawText,
  getResizeHandles,
} from '../../utils/drawing';

const HANDLE_SIZE = 8;
const SELECTION_COLOR = '#6965db';

function drawElement(rc, ctx, element) {
  ctx.save();
  ctx.globalAlpha = (element.opacity ?? 100) / 100;

  switch (element.type) {
    case 'rectangle': drawRectangle(rc, element); break;
    case 'ellipse':   drawEllipse(rc, element); break;
    case 'diamond':   drawDiamond(rc, element); break;
    case 'line':      drawLine(rc, element); break;
    case 'arrow':     drawArrow(rc, element, ctx); break;
    case 'freedraw':  drawFreedraw(ctx, element); break;
    case 'text':      drawText(ctx, element); break;
    default: break;
  }

  ctx.restore();
}

function drawSelectionBox(ctx, element) {
  const { x, y, width, height, type } = element;
  if (type === 'freedraw') return;

  ctx.save();
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(x - 4, y - 4, width + 8, height + 8);
  ctx.setLineDash([]);

  if (type !== 'line' && type !== 'arrow') {
    const handles = getResizeHandles({ x: x - 4, y: y - 4, width: width + 8, height: height + 8 });
    handles.forEach(({ x: hx, y: hy }) => {
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(hx - HANDLE_SIZE / 2, hy - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
      ctx.fill();
      ctx.stroke();
    });
  }

  ctx.restore();
}

// Canvas exposes its internal ref via imperative handle so useCanvas can attach to the real DOM node
const Canvas = forwardRef(function Canvas({
  onMouseDown, onMouseMove, onMouseUp, onWheel, onDoubleClick,
  onTouchStart, onTouchMove, onTouchEnd,
  currentElementRef, selRectRef,
}, ref) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  // Expose both the canvas DOM node and a redraw trigger
  useImperativeHandle(ref, () => ({
    canvasEl: () => canvasRef.current,
    redraw: () => scheduleRedraw(),
  }));

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { elements, selectedIds, zoom, scrollX, scrollY } = useWhiteboardStore.getState();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = '#121212';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dot grid
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    const gridSize = 20 * zoom;
    const offsetX = ((scrollX % gridSize) + gridSize) % gridSize;
    const offsetY = ((scrollY % gridSize) + gridSize) % gridSize;
    for (let gx = offsetX; gx < canvas.width; gx += gridSize) {
      for (let gy = offsetY; gy < canvas.height; gy += gridSize) {
        ctx.beginPath();
        ctx.arc(gx, gy, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Viewport transform
    ctx.save();
    ctx.setTransform(zoom, 0, 0, zoom, scrollX, scrollY);

    const rc = rough.canvas(canvas);

    // All persisted elements
    elements.forEach((el) => {
      if (el.isDeleted) return;
      drawElement(rc, ctx, el);
    });

    // In-progress element
    const current = currentElementRef?.current;
    if (current) drawElement(rc, ctx, current);

    // Selection outlines
    selectedIds.forEach((id) => {
      const el = elements.find((e) => e.id === id);
      if (el && !el.isDeleted) drawSelectionBox(ctx, el);
    });

    // Marquee selection rect
    const selRect = selRectRef?.current;
    if (selRect) {
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.fillStyle = 'rgba(105, 101, 219, 0.1)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      const { x, y, width, height } = selRect;
      ctx.fillRect(x, y, width, height);
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [currentElementRef, selRectRef]);

  // Stable scheduleRedraw ref so useImperativeHandle closure is always fresh
  const scheduleRedrawRef = useRef(null);
  const scheduleRedraw = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(render);
  }, [render]);
  scheduleRedrawRef.current = scheduleRedraw;

  // Subscribe to store changes and trigger redraws
  useEffect(() => {
    return useWhiteboardStore.subscribe(() => {
      scheduleRedrawRef.current?.();
    });
  }, []);

  // Resize canvas to fill window
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      scheduleRedrawRef.current?.();
    };

    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', touchAction: 'none', position: 'absolute', inset: 0 }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onWheel={onWheel}
      onDoubleClick={onDoubleClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    />
  );
});

export default Canvas;
