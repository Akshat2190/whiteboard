import { useRef, useState, useEffect, useCallback } from 'react';
import styles from './AirCanvas.module.css';

/* ─── CDN loader ───────────────────────────────────────────────────────────── */
const HANDS_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.crossOrigin = 'anonymous';
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

/* ─── Constants ────────────────────────────────────────────────────────────── */
const COLORS = [
  { label: 'Red-Pink', value: '#FF3B6B' },
  { label: 'Orange',   value: '#FF8C00' },
  { label: 'Yellow',   value: '#FFE600' },
  { label: 'Cyan',     value: '#00FFD1' },
  { label: 'Violet',   value: '#7C5CFF' },
  { label: 'White',    value: '#FFFFFF' },
];
const DEFAULT_COLOR    = '#00FFD1';
const DEFAULT_WIDTH    = 8;
const CLEAR_HOLD_MS    = 1500;  // right fist hold to clear
const BOTH_HOLD_MS     = 800;   // both fists hold to confirm
const DOT_SPACING      = 5;
const SMOOTH_WEIGHTS   = [0.1, 0.2, 0.3, 0.4];
const LEFT_ALPHA       = 0.38;  // secondary (left-hand) stroke opacity

/* ─── Per-hand state factory ───────────────────────────────────────────────── */
function makeHandState() {
  return {
    gesture: 'none', prevGesture: 'none',
    cursorPos: null, smoothBuf: [],
    activeStroke: null,
    clearStart: null,   // right-hand only: for clear hold
    undoFired: false,   // left-hand only: prevent repeat undo on continuous fist
  };
}

/* ─── Gesture detection ────────────────────────────────────────────────────── */
function detectGesture(lms) {
  const up = (tip, pip) => lms[tip].y < lms[pip].y;
  const iU = up(8,6), mU = up(12,10), rU = up(16,14), pU = up(20,18);
  if (!iU && !mU && !rU && !pU) return 'clear';
  if (iU && mU) return 'pause';
  if (iU && !mU) return 'draw';
  return 'none';
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
function smoothedPos(buf) {
  const n = buf.length;
  if (!n) return null;
  if (n === 1) return buf[0];
  const w = SMOOTH_WEIGHTS.slice(-n);
  const wS = w.reduce((a, b) => a + b, 0);
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += buf[i].x * w[i]; sy += buf[i].y * w[i]; }
  return { x: sx / wS, y: sy / wS };
}
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function gestureLabel(gR, gL) {
  const both = gR === 'clear' && gL === 'clear';
  if (both)            return 'both fists → confirm';
  if (gR === 'draw')   return 'R drawing';
  if (gL === 'draw')   return 'L drawing';
  if (gR === 'clear')  return 'R fist → clearing…';
  if (gL === 'clear')  return 'L fist → undo';
  if (gR === 'pause' || gL === 'pause') return 'repositioning';
  return 'no hand';
}

/* ─── Component ────────────────────────────────────────────────────────────── */
export default function AirCanvas({ onClose, onConfirm }) {
  const videoRef      = useRef(null);
  const canvasRef     = useRef(null);
  const rafRef        = useRef(null);
  const cameraStopRef = useRef(null);
  const handsRef      = useRef(null);

  // All drawing state in one ref object keyed by 'Left' / 'Right'
  // NOTE: with selfieMode:true, MediaPipe "Right" = user's right hand (as seen in mirror)
  const hs = useRef({ Left: makeHandState(), Right: makeHandState() });
  const strokesRef     = useRef([]);  // { dots, color, radius, alpha }[]
  const clearPctRef    = useRef(0);   // right-hand fist progress
  const bothFistsRef   = useRef(null);// timestamp when both fists started
  const confirmFiredRef= useRef(false);

  const colorRef = useRef(DEFAULT_COLOR);
  const widthRef = useRef(DEFAULT_WIDTH);

  const [color, setColor]             = useState(DEFAULT_COLOR);
  const [strokeWidth, setStrokeWidth] = useState(DEFAULT_WIDTH);
  const [initState, setInitState]     = useState('idle');
  const [errorMsg, setErrorMsg]       = useState('');
  const [clearPct, setClearPct]       = useState(0);
  const [gestureSummary, setGestureSummary] = useState('no hand');

  useEffect(() => { colorRef.current = color; },       [color]);
  useEffect(() => { widthRef.current = strokeWidth; }, [strokeWidth]);

  /* ── Key shortcuts 1-6 ─────────────────────────────────────────────────── */
  useEffect(() => {
    const h = (e) => {
      const i = parseInt(e.key, 10);
      if (i >= 1 && i <= COLORS.length) setColor(COLORS[i - 1].value);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  /* ── rAF draw loop ─────────────────────────────────────────────────────── */
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx  = canvas.getContext('2d');
    const time = performance.now() / 1000;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw one dot with wobble, respecting alpha
    const drawDot = (x, y, radius, c, alpha, di) => {
      const rx = x + Math.sin(time * 1.8 + di * 0.4) * 1.2;
      const ry = y + Math.cos(time * 2.1 + di * 0.3) * 1.2;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = c;
      ctx.shadowBlur  = radius * 2;
      ctx.beginPath();
      ctx.arc(rx, ry, radius, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.restore();
    };

    // Committed strokes
    let di = 0;
    for (const s of strokesRef.current) {
      for (let i = 0; i < s.dots.length; i++)
        drawDot(s.dots[i].x, s.dots[i].y, s.radius, s.color, s.alpha, di++);
    }
    // Active strokes for each hand
    for (const side of ['Left', 'Right']) {
      const st = hs.current[side].activeStroke;
      if (st) for (let i = 0; i < st.dots.length; i++)
        drawDot(st.dots[i].x, st.dots[i].y, st.radius, st.color, st.alpha, di++);
    }

    // Cursor dots with L/R label
    const cursorDefs = [
      { side: 'Left',  label: 'L', labelAlpha: LEFT_ALPHA + 0.2 },
      { side: 'Right', label: 'R', labelAlpha: 1 },
    ];
    for (const { side, label, labelAlpha } of cursorDefs) {
      const h = hs.current[side];
      if (!h.cursorPos) continue;
      const { x, y } = h.cursorPos;
      const isDrawing = h.gesture === 'draw';
      ctx.save();
      ctx.globalAlpha = side === 'Left' ? (isDrawing ? LEFT_ALPHA + 0.3 : LEFT_ALPHA) : (isDrawing ? 1 : 0.55);
      ctx.shadowColor = colorRef.current;
      ctx.shadowBlur  = 14;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle   = colorRef.current;
      ctx.fill();
      ctx.restore();

      // Label text
      ctx.save();
      ctx.globalAlpha   = labelAlpha;
      ctx.font          = '600 10px "Instrument Sans", system-ui, sans-serif';
      ctx.fillStyle     = colorRef.current;
      ctx.textAlign     = 'center';
      ctx.textBaseline  = 'bottom';
      ctx.shadowColor   = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur    = 4;
      ctx.fillText(label, x, y - 9);
      ctx.restore();
    }

    setClearPct(clearPctRef.current);
    setGestureSummary(gestureLabel(hs.current.Right.gesture, hs.current.Left.gesture));
    rafRef.current = requestAnimationFrame(drawFrame);
  }, []);

  /* ── MediaPipe results handler ─────────────────────────────────────────── */
  const onResults = useCallback((results) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width, H = canvas.height;
    const now = Date.now();

    // Which sides were detected this frame
    const detected = new Set();

    if (results.multiHandLandmarks?.length) {
      for (let idx = 0; idx < results.multiHandLandmarks.length; idx++) {
        const lms  = results.multiHandLandmarks[idx];
        // selfieMode: MediaPipe "Right" label = user's right hand in mirrored view
        const side = results.multiHandedness?.[idx]?.label ?? 'Right';
        const h    = hs.current[side];
        detected.add(side);

        const g = detectGesture(lms);
        h.gesture = g;

        h.smoothBuf.push({ x: lms[8].x * W, y: lms[8].y * H });
        if (h.smoothBuf.length > 4) h.smoothBuf.shift();
        h.cursorPos = smoothedPos(h.smoothBuf);

        // ── Per-hand gesture actions ───────────────────────────────────────
        if (side === 'Right') {
          // Right fist → clear canvas (1.5s hold)
          if (g === 'clear') {
            if (!h.clearStart) h.clearStart = now;
            const pct = Math.min(100, ((now - h.clearStart) / CLEAR_HOLD_MS) * 100);
            clearPctRef.current = pct;
            if (pct >= 100) {
              strokesRef.current         = [];
              hs.current.Left.activeStroke  = null;
              hs.current.Right.activeStroke = null;
              h.clearStart      = null;
              clearPctRef.current = 0;
            }
          } else {
            h.clearStart = null;
            clearPctRef.current = 0;
          }
        }

        if (side === 'Left') {
          // Left fist → undo ONE stroke per gesture (fire once on transition)
          if (g === 'clear') {
            if (!h.undoFired) {
              if (strokesRef.current.length) strokesRef.current = strokesRef.current.slice(0, -1);
              h.undoFired = true;
            }
          } else {
            h.undoFired = false;
          }
          // Left fist clears only its own clear timer
          if (g !== 'clear') h.clearStart = null;
        }

        // ── Draw strokes ──────────────────────────────────────────────────
        const isPrimary = side === 'Right';
        const alpha     = isPrimary ? 1.0 : LEFT_ALPHA;
        const drawColor = colorRef.current;

        if (g === 'draw') {
          if (h.prevGesture !== 'draw') {
            h.activeStroke = { dots: [], color: drawColor, radius: widthRef.current / 2, alpha };
          }
          if (h.activeStroke && h.cursorPos) {
            const dots = h.activeStroke.dots;
            const last = dots[dots.length - 1];
            if (!last || dist(h.cursorPos, last) >= DOT_SPACING)
              dots.push({ x: h.cursorPos.x, y: h.cursorPos.y });
          }
        } else {
          if (h.prevGesture === 'draw' && h.activeStroke?.dots?.length)
            strokesRef.current.push({ ...h.activeStroke });
          h.activeStroke = null;
        }

        h.prevGesture = g;
      }
    }

    // Reset hands not seen this frame
    for (const side of ['Left', 'Right']) {
      if (!detected.has(side)) {
        const h = hs.current[side];
        if (h.prevGesture === 'draw' && h.activeStroke?.dots?.length)
          strokesRef.current.push({ ...h.activeStroke });
        Object.assign(h, makeHandState());
        if (side === 'Right') clearPctRef.current = 0;
      }
    }

    // ── Both fists → confirm ─────────────────────────────────────────────
    const bothFist = hs.current.Left.gesture === 'clear' && hs.current.Right.gesture === 'clear';
    if (bothFist) {
      if (!bothFistsRef.current) { bothFistsRef.current = now; confirmFiredRef.current = false; }
      if (!confirmFiredRef.current && now - bothFistsRef.current >= BOTH_HOLD_MS) {
        confirmFiredRef.current = true;
        onConfirm?.();
      }
    } else {
      bothFistsRef.current = null;
    }
  }, [onConfirm]);

  /* ── Resize ────────────────────────────────────────────────────────────── */
  const resizeCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = c.offsetWidth; c.height = c.offsetHeight;
  }, []);

  /* ── Init MediaPipe ────────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorMsg('Camera API not supported.'); setInitState('error'); return;
      }
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } }); }
      catch (err) { setErrorMsg(err?.message || 'Camera denied.'); setInitState('error'); return; }
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
      if (videoRef.current) { videoRef.current.srcObject = stream; try { await videoRef.current.play(); } catch (_) {} }
      setInitState('loading');
      try {
        await loadScript(HANDS_CDN);
        if (cancelled) return;
        // eslint-disable-next-line no-undef
        const HandsClass = window.Hands;
        if (!HandsClass) throw new Error('window.Hands undefined after CDN load.');
        const hands = new HandsClass({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
        hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.75, minTrackingConfidence: 0.75, selfieMode: true });
        hands.onResults(onResults);
        handsRef.current = hands;
        let rafSend;
        const tick = async () => {
          if (cancelled) return;
          if (videoRef.current?.readyState >= 2) await hands.send({ image: videoRef.current }).catch(() => {});
          rafSend = requestAnimationFrame(tick);
        };
        rafSend = requestAnimationFrame(tick);
        cameraStopRef.current = () => cancelAnimationFrame(rafSend);
        if (!cancelled) setInitState('ready');
      } catch (err) {
        if (!cancelled) { setErrorMsg('Hand tracking failed — ' + (err?.message || err)); setInitState('error'); }
        stream.getTracks().forEach(t => t.stop());
      }
    };
    init();
    return () => {
      cancelled = true; cameraStopRef.current?.(); handsRef.current?.close?.();
      if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    };
  }, [onResults]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    rafRef.current = requestAnimationFrame(drawFrame);
    return () => { window.removeEventListener('resize', resizeCanvas); cancelAnimationFrame(rafRef.current); };
  }, [resizeCanvas, drawFrame]);

  /* ── Manual toolbar actions ────────────────────────────────────────────── */
  const handleUndo = () => { strokesRef.current = strokesRef.current.slice(0, -1); };
  const handleClearAll = () => {
    strokesRef.current = [];
    hs.current.Left.activeStroke  = null;
    hs.current.Right.activeStroke = null;
  };

  const isReady  = initState === 'ready';
  const isError  = initState === 'error';
  const gR = hs.current.Right.gesture;
  const isActive = gR === 'draw' || hs.current.Left.gesture === 'draw';

  /* ── Render ────────────────────────────────────────────────────────────── */
  return (
    <div className={styles.root} role="dialog" aria-modal="true" aria-label="Air Canvas">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className={styles.topBar}>
        <div className={styles.topLeft}>
          <button id="ac-close" className={styles.closeBtn} onClick={onClose} title="Close" aria-label="Close">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/>
            </svg>
          </button>
        </div>

        <h1 className={styles.title}>draw anything</h1>

        <div className={styles.topRight}>
          {/* Gesture badge */}
          <div className={`${styles.gestureBadge} ${isActive ? styles.gestureBadgeActive : ''}`}>
            <span
              className={styles.gestureDot}
              style={{
                background: isActive ? '#00FFD1' : gR === 'clear' ? '#F97316' : 'rgba(255,255,255,0.2)',
                boxShadow:  isActive ? '0 0 6px #00FFD1' : gR === 'clear' ? '0 0 6px #F97316' : 'none',
              }}
            />
            <span className={styles.gestureText}>{gestureSummary}</span>
          </div>

          {/* Camera pill */}
          <div className={styles.camPill}>
            <span className={styles.camPillDot} style={{ background: isError ? '#EF4444' : isReady ? '#22C55E' : '#F59E0B' }} />
            <span>{isError ? 'no cam' : isReady ? 'live' : 'starting'}</span>
          </div>

          {/* Export (wired to onConfirm; disabled until both-fists) */}
          <button id="ac-export" className={styles.exportBtn} onClick={onConfirm} disabled={!onConfirm} title="Both fists to confirm">
            Export
          </button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className={styles.body}>

        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.paletteStack}>
            {COLORS.map((c, i) => (
              <button
                key={c.value}
                id={`ac-color-${i + 1}`}
                className={`${styles.swatch} ${color === c.value ? styles.swatchActive : ''}`}
                style={{ background: c.value, boxShadow: color === c.value ? `0 0 0 2px #111318, 0 0 0 4px #fff` : undefined }}
                onClick={() => setColor(c.value)}
                title={`${c.label} (${i + 1})`}
                aria-label={`Color: ${c.label}`}
              />
            ))}
          </div>
          <div className={styles.sidebarDivider} />
          <button id="ac-undo" className={styles.sidebarIconBtn} onClick={handleUndo} title="Undo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
            </svg>
          </button>
          <button id="ac-clear" className={styles.sidebarIconBtn} onClick={handleClearAll} title="Clear all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            </svg>
          </button>
        </aside>

        {/* Canvas area */}
        <div className={styles.canvasArea}>
          <div className={styles.dotGrid} />

          {/* PiP */}
          <div className={styles.pip}>
            <video ref={videoRef} id="ac-video" className={styles.pipVideo} playsInline muted autoPlay />
            {isReady && <div className={styles.liveBadge}>LIVE</div>}
          </div>

          <canvas ref={canvasRef} id="ac-canvas" className={styles.drawCanvas} />

          {initState === 'loading' && (
            <div className={styles.loadingOverlay}>
              <div className={styles.spinner} />
              <p className={styles.loadingText}>Loading hand tracking…</p>
            </div>
          )}

          {isError && (
            <div className={styles.errorCard}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.5">
                <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                <line x1="1" y1="1" x2="23" y2="23" stroke="#EF4444" strokeWidth="1.5"/>
              </svg>
              <h3 className={styles.errorTitle}>Camera unavailable</h3>
              <p className={styles.errorMsg}>{errorMsg || 'Allow camera access and reload.'}</p>
              <button id="ac-fallback-btn" className={styles.fallbackBtn} onClick={onClose}>Close</button>
            </div>
          )}

          {/* Right-hand fist clear ring */}
          {clearPct > 0 && clearPct < 100 && (
            <div className={styles.clearRing}>
              <svg width="60" height="60" viewBox="0 0 60 60">
                <circle cx="30" cy="30" r="25" fill="none" stroke="rgba(249,115,22,0.15)" strokeWidth="4"/>
                <circle cx="30" cy="30" r="25" fill="none" stroke="#F97316" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 25}`}
                  strokeDashoffset={`${2 * Math.PI * 25 * (1 - clearPct / 100)}`}
                  transform="rotate(-90 30 30)"
                />
              </svg>
              <span className={styles.clearLabel}>{Math.round(clearPct)}%</span>
            </div>
          )}

          {/* Bottom bar */}
          <div className={styles.bottomBar}>
            <div className={styles.sliderGroup}>
              <span className={styles.sliderLabel}>size</span>
              <input id="ac-stroke-width" type="range" min="4" max="20" value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
                className={styles.slider} style={{ '--thumb-color': color }} />
              <span className={styles.sliderValue}>{strokeWidth}px</span>
            </div>

            <div className={styles.hintRow}>
              <span>R index → draw</span>
              <span className={styles.hintDiv}/>
              <span>L fist → undo</span>
              <span className={styles.hintDiv}/>
              <span>R fist 1.5s → clear</span>
              <span className={styles.hintDiv}/>
              <span>both fists → confirm</span>
            </div>

            <span className={styles.fistHint}>keys 1–6 → colour</span>
          </div>
        </div>
      </div>
    </div>
  );
}