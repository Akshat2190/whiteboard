import rough from 'roughjs/bin/rough';
import { getStroke } from 'perfect-freehand';

export { rough };

// ─── Style Helpers ──────────────────────────────────────────────────────────

function getRoughOptions(element) {
  const fillColor =
    element.backgroundColor === 'transparent' || !element.backgroundColor
      ? 'none'
      : element.backgroundColor;

  return {
    roughness: element.roughness ?? 1,
    stroke: element.strokeColor || '#ffffff',
    strokeWidth: element.strokeWidth || 2,
    fill: fillColor,
    fillStyle: element.fillStyle || 'hachure',
    seed: element.seed || 1,
    strokeLineDash:
      element.strokeStyle === 'dashed'
        ? [8, 4]
        : element.strokeStyle === 'dotted'
        ? [2, 4]
        : undefined,
  };
}

// ─── Shape Drawers ───────────────────────────────────────────────────────────

export function drawRectangle(rc, element) {
  const { x, y, width, height } = element;
  rc.rectangle(x, y, width, height, getRoughOptions(element));
}

export function drawEllipse(rc, element) {
  const { x, y, width, height } = element;
  const cx = x + width / 2;
  const cy = y + height / 2;
  rc.ellipse(cx, cy, Math.abs(width), Math.abs(height), getRoughOptions(element));
}

export function drawDiamond(rc, element) {
  const { x, y, width, height } = element;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const points = [
    [cx, y],
    [x + width, cy],
    [cx, y + height],
    [x, cy],
  ];
  rc.polygon(points, getRoughOptions(element));
}

export function drawLine(rc, element) {
  const { x, y, width, height } = element;
  rc.line(x, y, x + width, y + height, getRoughOptions(element));
}

export function drawArrow(rc, element) {
  const { x, y, width, height } = element;
  const x2 = x + width;
  const y2 = y + height;

  rc.line(x, y, x2, y2, getRoughOptions(element));

  // Arrowhead
  const angle = Math.atan2(y2 - y, x2 - x);
  const headLen = 20;
  const spread = 0.4; // ~22 degrees

  const ax1 = x2 - headLen * Math.cos(angle - spread);
  const ay1 = y2 - headLen * Math.sin(angle - spread);
  const ax2 = x2 - headLen * Math.cos(angle + spread);
  const ay2 = y2 - headLen * Math.sin(angle + spread);

  const opts = { ...getRoughOptions(element), fill: element.strokeColor || '#ffffff', fillStyle: 'solid' };
  rc.line(x2, y2, ax1, ay1, opts);
  rc.line(x2, y2, ax2, ay2, opts);
}

export function drawFreedraw(ctx, element) {
  if (!element.points || element.points.length < 2) return;

  const stroke = getStroke(element.points, {
    size: (element.strokeWidth || 2) * 4,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
  });

  if (!stroke.length) return;

  ctx.beginPath();
  ctx.fillStyle = element.strokeColor || '#ffffff';
  ctx.globalAlpha = (element.opacity ?? 100) / 100;

  const [first, ...rest] = stroke;
  ctx.moveTo(first[0], first[1]);
  for (const [px, py] of rest) {
    ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function drawText(ctx, element) {
  const { x, y, text, fontSize = 20, fontFamily = 'Inter', strokeColor = '#ffffff', opacity = 100 } = element;
  ctx.globalAlpha = opacity / 100;
  ctx.font = `${fontSize}px ${fontFamily}, sans-serif`;
  ctx.fillStyle = strokeColor;
  ctx.textBaseline = 'top';

  const lines = (text || '').split('\n');
  lines.forEach((line, i) => {
    ctx.fillText(line, x, y + i * (fontSize * 1.2));
  });
  ctx.globalAlpha = 1;
}

// ─── Hit Testing ──────────────────────────────────────────────────────────────

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function isInsideRect(px, py, x, y, w, h, tolerance = 5) {
  return px >= x - tolerance && px <= x + w + tolerance && py >= y - tolerance && py <= y + h + tolerance;
}

export function getElementAtPosition(px, py, elements) {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.isDeleted) continue;

    const { x, y, width: w, height: h, type } = el;

    if (type === 'freedraw') {
      if (!el.points?.length) continue;
      // Check bounding box first
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [px2, py2] of el.points) {
        minX = Math.min(minX, px2); minY = Math.min(minY, py2);
        maxX = Math.max(maxX, px2); maxY = Math.max(maxY, py2);
      }
      if (isInsideRect(px, py, minX, minY, maxX - minX, maxY - minY, 10)) return el;
    } else if (type === 'line' || type === 'arrow') {
      if (distToSegment(px, py, x, y, x + w, y + h) < 8) return el;
    } else if (type === 'text') {
      const fontSize = el.fontSize || 20;
      const lines = (el.text || '').split('\n');
      const textWidth = Math.max(50, ...lines.map((l) => l.length * fontSize * 0.6));
      const textHeight = lines.length * fontSize * 1.2;
      if (isInsideRect(px, py, x, y, textWidth, textHeight)) return el;
    } else {
      if (isInsideRect(px, py, x, y, w, h)) return el;
    }
  }
  return null;
}

export function getElementsInRect(rx1, ry1, rx2, ry2, elements) {
  const minX = Math.min(rx1, rx2);
  const maxX = Math.max(rx1, rx2);
  const minY = Math.min(ry1, ry2);
  const maxY = Math.max(ry1, ry2);

  return elements.filter((el) => {
    if (el.isDeleted) return false;
    const { x, y, width: w, height: h } = el;
    const elMaxX = x + w;
    const elMaxY = y + h;
    return x < maxX && elMaxX > minX && y < maxY && elMaxY > minY;
  });
}

export function getResizeHandles(element) {
  const { x, y, width: w, height: h } = element;
  return [
    { position: 'nw', x, y },
    { position: 'n', x: x + w / 2, y },
    { position: 'ne', x: x + w, y },
    { position: 'e', x: x + w, y: y + h / 2 },
    { position: 'se', x: x + w, y: y + h },
    { position: 's', x: x + w / 2, y: y + h },
    { position: 'sw', x, y: y + h },
    { position: 'w', x, y: y + h / 2 },
  ];
}

export function normalizeElement(element) {
  let { x, y, width, height } = element;
  if (width < 0) { x += width; width = -width; }
  if (height < 0) { y += height; height = -height; }
  return { ...element, x, y, width, height };
}

export function getTextDimensions(element) {
  const fontSize = element.fontSize || 20;
  const lines = (element.text || '').split('\n');
  const width = Math.max(50, ...lines.map((l) => l.length * fontSize * 0.6));
  const height = lines.length * fontSize * 1.2;
  return { width, height };
}
