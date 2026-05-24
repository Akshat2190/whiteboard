import { useRef, useState, useEffect, useCallback } from 'react';
import styles from './HandDrawCanvas.module.css';

const PRESET_COLORS = [
  { label: 'Black',  value: '#0D1120' },
  { label: 'Red',    value: '#EF4444' },
  { label: 'Blue',   value: '#3B82F6' },
  { label: 'Green',  value: '#22C55E' },
  { label: 'Orange', value: '#F97316' },
];

/**
 * HandDrawCanvas
 *
 * Props:
 *   onConfirm(base64: string) — called with the canvas PNG data URL
 *   onClose()                 — called when the user cancels
 */
export default function HandDrawCanvas({ onConfirm, onClose }) {
  const canvasRef      = useRef(null);
  const containerRef   = useRef(null);
  const strokesRef     = useRef([]);       // Array of stroke arrays: [{x,y}]
  const currentStroke  = useRef(null);     // Active stroke being drawn
  const isDrawing      = useRef(false);

  const [tool, setTool]         = useState('pen');   // 'pen' | 'eraser'
  const [color, setColor]       = useState('#0D1120');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [status, setStatus]     = useState('idle'); // 'idle' | 'analyzing' | 'done' | 'error'
  const [statusMsg, setStatusMsg] = useState('');

  // ── Helpers ──────────────────────────────────────────────────────────────

  const getCtx = () => canvasRef.current?.getContext('2d');

  const applyContext = useCallback((ctx) => {
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth   = Math.max(strokeWidth * 5, 20);
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth   = strokeWidth;
    }
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';
  }, [tool, color, strokeWidth]);

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const stroke of strokesRef.current) {
      if (!stroke.points || stroke.points.length < 2) continue;
      ctx.save();
      // Apply stroke's saved style
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth   = stroke.width;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }, []);

  // ── Canvas sizing (mount + resize) ────────────────────────────────────────

  useEffect(() => {
    const fit = () => {
      const container = containerRef.current;
      const canvas    = canvasRef.current;
      if (!container || !canvas) return;
      canvas.width  = container.clientWidth;
      canvas.height = container.clientHeight;
      redrawAll();
    };

    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [redrawAll]);

  // ── Pointer helpers ───────────────────────────────────────────────────────

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    if (e.touches) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // ── Drawing events ────────────────────────────────────────────────────────

  const handleMouseDown = (e) => {
    e.preventDefault();
    isDrawing.current   = true;
    const pos           = getPos(e);
    const ctx           = getCtx();
    if (!ctx) return;

    const strokeColor = tool === 'eraser' ? '#FFFFFF' : color;
    const strokeW     = tool === 'eraser' ? Math.max(strokeWidth * 5, 20) : strokeWidth;

    currentStroke.current = {
      points: [pos],
      color:  strokeColor,
      width:  strokeW,
    };

    applyContext(ctx);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing.current || !currentStroke.current) return;
    e.preventDefault();
    const pos = getPos(e);
    const ctx = getCtx();
    if (!ctx) return;

    currentStroke.current.points.push(pos);
    applyContext(ctx);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endStroke = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    if (currentStroke.current && currentStroke.current.points.length >= 2) {
      strokesRef.current.push(currentStroke.current);
    }
    currentStroke.current = null;
  };

  // ── Toolbar actions ───────────────────────────────────────────────────────

  const handleClear = () => {
    strokesRef.current = [];
    redrawAll();
  };

  const handleUndo = () => {
    if (!strokesRef.current.length) return;
    strokesRef.current.pop();
    redrawAll();
  };

  // ── Generate ──────────────────────────────────────────────────────────────

  const handleAnalyze = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const base64 = canvas.toDataURL('image/png');
    setStatus('analyzing');
    setStatusMsg('Analyzing your sketch...');
    try {
      await onConfirm(base64);
      setStatus('done');
      setStatusMsg('Code generation started!');
    } catch (err) {
      setStatus('error');
      setStatusMsg(err?.message || 'Generation failed. Please try again.');
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Hand Draw Canvas">
      <div className={styles.modal}>

        {/* ── Toolbar ─────────────────────────────────────────────────── */}
        <div className={styles.toolbar}>

          {/* Left group: tools */}
          <div className={styles.toolGroup}>
            <button
              id="hdc-tool-pen"
              className={`${styles.toolBtn} ${tool === 'pen' ? styles.active : ''}`}
              onClick={() => setTool('pen')}
              title="Pen"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
              <span>Pen</span>
            </button>

            <button
              id="hdc-tool-eraser"
              className={`${styles.toolBtn} ${tool === 'eraser' ? styles.active : ''}`}
              onClick={() => setTool('eraser')}
              title="Eraser"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 20H7L3 16l11-11 7 7-1 8z" />
                <path d="M6.0001 15.9999l3-3" />
              </svg>
              <span>Eraser</span>
            </button>

            <div className={styles.divider} />

            <button
              id="hdc-btn-undo"
              className={styles.toolBtn}
              onClick={handleUndo}
              title="Undo (removes last stroke)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7v6h6" />
                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
              </svg>
              <span>Undo</span>
            </button>

            <button
              id="hdc-btn-clear"
              className={styles.toolBtn}
              onClick={handleClear}
              title="Clear canvas"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
              <span>Clear</span>
            </button>
          </div>

          {/* Center group: colors + width */}
          <div className={styles.toolGroup}>
            <div className={styles.colorSwatches}>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  id={`hdc-color-${c.label.toLowerCase()}`}
                  className={`${styles.swatch} ${color === c.value ? styles.swatchActive : ''}`}
                  style={{ background: c.value }}
                  onClick={() => { setColor(c.value); setTool('pen'); }}
                  title={c.label}
                  aria-label={`Color: ${c.label}`}
                />
              ))}
            </div>

            <div className={styles.divider} />

            <label className={styles.sliderLabel}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="6" />
              </svg>
              <input
                id="hdc-stroke-width"
                type="range"
                min="2"
                max="20"
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
                className={styles.slider}
                title={`Stroke width: ${strokeWidth}px`}
              />
              <span className={styles.sliderValue}>{strokeWidth}px</span>
            </label>
          </div>

          {/* Right group: actions */}
          <div className={styles.toolGroup}>
            <button
              id="hdc-btn-close"
              className={styles.toolBtn}
              onClick={onClose}
              title="Cancel"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span>Cancel</span>
            </button>

            <button
              id="hdc-btn-analyze"
              className={styles.analyzeBtn}
              onClick={handleAnalyze}
              disabled={status === 'analyzing'}
              title="Analyze sketch and generate code"
            >
              {status === 'analyzing' ? (
                <>
                  <span className={styles.spinner} />
                  Analyzing...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  Analyze &amp; Generate
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Status banner ───────────────────────────────────────────── */}
        {status !== 'idle' && (
          <div className={`${styles.statusBar} ${styles[`status_${status}`]}`}>
            {status === 'analyzing' && <span className={styles.spinnerSmall} />}
            {statusMsg}
            {(status === 'done' || status === 'error') && (
              <button className={styles.statusClose} onClick={onClose} id="hdc-status-close">
                Close
              </button>
            )}
          </div>
        )}

        {/* ── Canvas area ─────────────────────────────────────────────── */}
        <div className={styles.canvasWrapper} ref={containerRef}>
          <canvas
            id="hdc-canvas"
            ref={canvasRef}
            className={styles.canvas}
            style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={endStroke}
            onMouseLeave={endStroke}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={endStroke}
          />

          {/* Empty state hint */}
          <div className={styles.hint} aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.25">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
            </svg>
            <p>Sketch your architecture here</p>
          </div>
        </div>

      </div>
    </div>
  );
}
