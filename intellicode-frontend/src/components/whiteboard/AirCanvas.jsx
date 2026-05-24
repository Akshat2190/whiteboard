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

/* ─── State machine constants ───────────────────────────────────────────────── */
const MODE = { DRAW: 'DRAW', MANIPULATE: 'MANIPULATE' };
const HS   = { IDLE:'IDLE', DRAWING:'DRAWING', PINCHING:'PINCHING', GRABBING:'GRABBING', REPOSITIONING:'REPOSITIONING' };

/* ─── Per-hand state factory ────────────────────────────────────────────────── */
function makeHandState() {
  return {
    state: HS.IDLE,
    isFist: false, isOpenPalm: false,
    cursorPos: null, smoothBuf: [],
    activeStroke: null,
    clearStart: null,
    undoFired: false,
    pinching: false, pinchPos: null,
    flickBuf: [],       // last 6 lm8 pixel positions for velocity tracking
  };
}

/* ─── Hand pose classifier → returns raw boolean flags ───────────────────── */
function classifyHandPose(lms, W, H) {
  // Per-spec exact finger conditions (in image/Y space)
  const iU = lms[8].y  < lms[6].y;   // index up
  const mU = lms[12].y < lms[10].y;  // middle up
  const rU = lms[16].y < lms[14].y;
  const pU = lms[20].y < lms[18].y;
  // Pinch: pixel-space distance lm4↔lm8 < 40px (per spec)
  const tx = (1-lms[4].x)*W, ty = lms[4].y*H;
  const ix = (1-lms[8].x)*W, iy = lms[8].y*H;
  const pinchDist = Math.hypot(tx-ix, ty-iy);
  // Open palm: all 4 fingers up + thumb clearly extended laterally
  const thumbExt = Math.abs((1-lms[4].x)*W - (1-lms[5].x)*W) > 36;
  return {
    isDrawing:    iU && !mU,
    isReposition: iU && mU,
    isPinching:   pinchDist < 40,
    isOpenPalm:   iU && mU && rU && pU && thumbExt,
    isFist:       !iU && !mU && !rU && !pU,
    pinchDist,
    pinchPos: { x: (tx+ix)/2, y: (ty+iy)/2 },
  };
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
function mx(lm, W) { return lm.x * W; } // selfieMode:true already mirrors; no extra flip needed
function my(lm, H) { return lm.y * H; }

function detectPinch(lms, W, H) {
  const t = { x: mx(lms[4], W), y: my(lms[4], H) };
  const i = { x: mx(lms[8], W), y: my(lms[8], H) };
  return { pinching: dist(t, i) < 42, pos: { x: (t.x+i.x)/2, y: (t.y+i.y)/2 } };
}

function ptLineDist(p, a, b) {
  const dx = b.x-a.x, dy = b.y-a.y, len = Math.hypot(dx,dy);
  return len < 1 ? dist(p,a) : Math.abs((p.x-a.x)*dy-(p.y-a.y)*dx)/len;
}
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  let mx2 = 0, mi = 0;
  for (let i=1; i<pts.length-1; i++) { const d=ptLineDist(pts[i],pts[0],pts[pts.length-1]); if(d>mx2){mx2=d;mi=i;} }
  if (mx2 > eps) { const L=rdp(pts.slice(0,mi+1),eps), R=rdp(pts.slice(mi),eps); return [...L.slice(0,-1),...R]; }
  return [pts[0], pts[pts.length-1]];
}
function bbox(dots) {
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  dots.forEach(d=>{x0=Math.min(x0,d.x);y0=Math.min(y0,d.y);x1=Math.max(x1,d.x);y1=Math.max(y1,d.y);});
  return {x:x0,y:y0,w:x1-x0,h:y1-y0,cx:(x0+x1)/2,cy:(y0+y1)/2};
}
function bboxGeom(dots) { const b=bbox(dots); return {x:b.x,y:b.y,width:b.w,height:b.h,cx:b.cx,cy:b.cy}; }

/* ── Shape recognizer — returns {type, confidence, ...geometry} ── */
function recognizeShape(dots) {
  if (dots.length < 8) return { type:'freeform', confidence:1, dots, ...bboxGeom(dots) };
  const bb = bbox(dots); const {cx,cy} = bb;
  const first=dots[0], last=dots[dots.length-1];
  const perim = dots.reduce((s,d,i)=>i?s+dist(d,dots[i-1]):0, 0);
  const closed = dist(first,last) < Math.min(perim*0.20, 80);
  const rs = dots.map(d=>dist(d,{x:cx,y:cy}));
  const rM = rs.reduce((a,b)=>a+b,0)/rs.length;
  const cv = Math.sqrt(rs.reduce((s,r)=>s+(r-rM)**2,0)/rs.length)/rM;

  // 1. CIRCLE
  if (closed && cv < 0.18 && dist(first,last) < 40) {
    return { type:'circle', confidence: Math.max(0.6, 1-cv/0.18), cx, cy, r:rM, ...bboxGeom(dots) };
  }
  // 2. STAR — alternating peaks/valleys before rect check
  if (closed && dots.length >= 20) {
    let peaks=0, valleys=0;
    for (let i=1;i<rs.length-1;i++) {
      if (rs[i]>rs[i-1]&&rs[i]>rs[i+1]&&rs[i]>rM*1.2) peaks++;
      if (rs[i]<rs[i-1]&&rs[i]<rs[i+1]&&rs[i]<rM*0.8) valleys++;
    }
    if (peaks>=4&&peaks<=7&&Math.abs(peaks-valleys)<=1)
      return { type:'star', confidence:0.75, cx, cy, r:rM, outerR:Math.max(...rs), innerR:Math.min(...rs), ...bboxGeom(dots) };
  }
  // 3. HEART — two humps top, V bottom
  if (closed && dots.length >= 16) {
    const tDots=dots.filter(d=>d.y<cy), bDots=dots.filter(d=>d.y>=cy);
    if (tDots.length>=4 && bDots.length>=4) {
      const tS=rdp(tDots,15), bS=rdp(bDots,15);
      if (tS.length>=4&&tS.length<=8&&bS.length>=2&&bS.length<=5)
        return { type:'heart', confidence:0.68, cx, cy, ...bboxGeom(dots) };
    }
  }
  // 4. RECTANGLE / TRIANGLE (closed)
  if (closed) {
    const c14=rdp(dots,14), c20=rdp(dots,20);
    if (c14.length===3||c20.length===3)
      return { type:'triangle', confidence:0.82, points:c14.length===3?c14:c20, ...bboxGeom(dots) };
    if (c14.length>=4&&c14.length<=6) {
      const ar=bb.w/Math.max(bb.h,1);
      if (ar>0.12&&ar<9) return { type:'rectangle', confidence:0.80, x:bb.x, y:bb.y, width:bb.w, height:bb.h, cx, cy };
    }
  }
  // 5. ARROW — sharp turn near endpoint on open stroke
  {
    const simp=rdp(dots,12);
    if (!closed && simp.length>=3) {
      const ang=[];
      for (let i=1;i<simp.length;i++) ang.push(Math.atan2(simp[i].y-simp[i-1].y,simp[i].x-simp[i-1].x));
      const sharp=(i)=>{ let d=Math.abs(ang[i+1]-ang[i]); if(d>Math.PI)d=2*Math.PI-d; return d>Math.PI*0.5; };
      const len=dist(simp[0],simp[simp.length-1]);
      if ((sharp(0)||sharp(ang.length-2)) && len>60)
        return { type:'arrow', confidence:0.72, points:simp, ...bboxGeom(dots) };
    }
  }
  // 6. LINE
  {
    const simp=rdp(dots,16);
    if (simp.length===2) return { type:'line', confidence:0.90, p1:simp[0], p2:simp[1], ...bboxGeom(dots) };
    const elong=Math.max(bb.w,bb.h)/Math.max(Math.min(bb.w,bb.h),1);
    if (elong>5&&simp.length<=4) return { type:'line', confidence:0.70, p1:dots[0], p2:last, ...bboxGeom(dots) };
  }
  // 7. FREEFORM fallback
  return { type:'freeform', confidence:1, dots, ...bboxGeom(dots) };
}

/* ── Solidify a completed stroke → ShapeObject ─────────────────── */
function solidifyStroke(stroke, side) {
  const raw = recognizeShape(stroke.dots);
  const id  = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const base = {
    id, hand: side, color: stroke.color, radius: stroke.radius, alpha: stroke.alpha,
    rotation: 0, scale: 1, originalPoints: stroke.dots, selected: false,
    recognizedAs: raw.type, confidence: raw.confidence, flashFrames: 2,
  };
  // Low confidence → always keep as freeform (never discard)
  if (raw.confidence < 0.6) {
    const b=bbox(stroke.dots);
    return { ...base, type:'freeform', dots:stroke.dots, x:b.x,y:b.y,width:b.w,height:b.h,cx:b.cx,cy:b.cy };
  }
  const { type, confidence, ...geom } = raw;  // eslint-disable-line no-unused-vars
  return { ...base, type, ...geom };
}

function objCentroid(o) {
  if (o.type==='circle'||o.type==='star'||o.type==='heart') return {x:o.cx,y:o.cy};
  if (o.type==='rectangle') return {x:o.x+o.width/2,y:o.y+o.height/2};
  if (o.type==='line') return {x:(o.p1.x+o.p2.x)/2,y:(o.p1.y+o.p2.y)/2};
  if (o.type==='triangle'||o.type==='arrow') return {x:o.points.reduce((s,p)=>s+p.x,0)/o.points.length,y:o.points.reduce((s,p)=>s+p.y,0)/o.points.length};
  if (o.dots?.length) { const b=bbox(o.dots); return {x:b.cx,y:b.cy}; }
  return {x:o.cx??0,y:o.cy??0};
}
function hitTest(obj, pt) {
  const TOL=22;
  if (obj.type==='circle'||obj.type==='star') return dist(pt,{x:obj.cx,y:obj.cy})<(obj.r??obj.outerR??40)+TOL;
  if (obj.type==='rectangle') return pt.x>obj.x-TOL&&pt.x<obj.x+obj.width+TOL&&pt.y>obj.y-TOL&&pt.y<obj.y+obj.height+TOL;
  if (obj.type==='line') return ptLineDist(pt,obj.p1,obj.p2)<TOL;
  if (obj.type==='triangle'||obj.type==='arrow') return Math.min(...obj.points.map(p=>dist(p,pt)))<TOL*2;
  if (obj.type==='heart') return dist(pt,{x:obj.cx,y:obj.cy})<obj.width*0.6+TOL;
  if (obj.dots) { const b=bbox(obj.dots); return pt.x>b.x-TOL&&pt.x<b.x+b.w+TOL&&pt.y>b.y-TOL&&pt.y<b.y+b.h+TOL; }
  return false;
}
function translateObj(o, dx, dy) {
  const mv=(p)=>({x:p.x+dx,y:p.y+dy});
  if (o.type==='circle'||o.type==='star'||o.type==='heart') return {...o,cx:o.cx+dx,cy:o.cy+dy};
  if (o.type==='rectangle') return {...o,x:o.x+dx,y:o.y+dy};
  if (o.type==='line') return {...o,p1:mv(o.p1),p2:mv(o.p2)};
  if (o.type==='triangle'||o.type==='arrow') return {...o,points:o.points.map(mv)};
  if (o.dots) return {...o,dots:o.dots.map(mv)};
  return o;
}

function gestureLabel(rState, lState, rFist, lFist, mode) {
  if (rFist && lFist)                              return 'both fists → export';
  if (mode === MODE.MANIPULATE)                    return 'grabbing → drag / scale / rotate';
  if (rState === HS.DRAWING && lState === HS.DRAWING) return 'both drawing';
  if (rState === HS.DRAWING)                       return 'R drawing';
  if (lState === HS.DRAWING)                       return 'L drawing';
  if (rState === HS.GRABBING && lState === HS.GRABBING) return 'two-hand → scale/rotate';
  if (rState === HS.GRABBING)                      return 'R grab → drag';
  if (lState === HS.GRABBING)                      return 'L grab → drag';
  if (rState === HS.PINCHING || lState === HS.PINCHING) return 'pinching → grab object';
  if (rFist)                                       return 'R fist → hold to clear…';
  if (lFist)                                       return 'L fist → solidify stroke';
  if (rState === HS.REPOSITIONING || lState === HS.REPOSITIONING) return 'two fingers → lift pen';
  return 'ready';
}

/* ─── Component ────────────────────────────────────────────────────────────── */
export default function AirCanvas({ onClose, onConfirm }) {
  const videoRef         = useRef(null);
  const objectsCanvasRef = useRef(null); // Layer 1 — static objects, redraws on state change
  const drawCanvasRef    = useRef(null); // Layer 2 — active strokes, every frame
  const uiCanvasRef      = useRef(null); // Layer 3 — cursors/badges, every frame
  const rafRef           = useRef(null);
  const cameraStopRef    = useRef(null);
  const handsRef         = useRef(null);
  const needsObjRedraw   = useRef(false);
  const modeRef          = useRef(MODE.DRAW); // top-level app mode

  // All drawing state in one ref object keyed by 'Left' / 'Right'
  // NOTE: with selfieMode:true, MediaPipe "Right" = user's right hand (as seen in mirror)
  const hs = useRef({ Left: makeHandState(), Right: makeHandState() });
  const strokesRef     = useRef([]);  // { type, color, alpha, ... }[]
  const objectsRef     = useRef([]);  // recognized shape objects
  const clearPctRef    = useRef(0);
  const bothFistsRef   = useRef(null);
  const confirmFiredRef= useRef(false);
  const selectedIdRef  = useRef(null); // id of currently selected object
  const dragOffsetRef  = useRef(null); // {dx,dy} offset when dragging
  const prevPinchDist  = useRef(null);
  const prevPinchAngle = useRef(null); // for two-hand rotation
  const flingRef       = useRef([]);   // [{obj, vx, vy, startT}] fling animations
  const swatchPosRef   = useRef([]);   // sidebar swatch pixel positions for color-reassign
  const colorHoverRef  = useRef({ side: null, color: null, start: 0 }); // color-reassign hover state

  const colorRef          = useRef(DEFAULT_COLOR);
  const secondaryColorRef = useRef(COLORS[2].value); // 2 steps clockwise from default
  const widthRef          = useRef(DEFAULT_WIDTH);

  const [color, setColor]             = useState(DEFAULT_COLOR);
  const [strokeWidth, setStrokeWidth] = useState(DEFAULT_WIDTH);
  const [initState, setInitState]     = useState('idle');
  const [errorMsg, setErrorMsg]       = useState('');
  const [clearPct, setClearPct]       = useState(0);
  const [gestureSummary, setGestureSummary] = useState('no hand');
  const [shapeHint, setShapeHint]           = useState('');
  const [secColor, setSecColor]             = useState(COLORS[2].value);

  useEffect(() => {
    colorRef.current = color;
    const idx = COLORS.findIndex(c => c.value === color);
    const sc = COLORS[(idx + 2) % COLORS.length].value;
    secondaryColorRef.current = sc;
    setSecColor(sc);
  }, [color]);
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

  /* ── Layer 1: redrawObjects — called only on state change ──────────────── */
  const redrawObjects = useCallback(() => {
    const oc = objectsCanvasRef.current;
    if (!oc) return;
    const ctx = oc.getContext('2d');
    ctx.clearRect(0, 0, oc.width, oc.height);

    const drawFreeformDots = (dots, color, radius, alpha) => {
      dots.forEach((d, i) => {
        ctx.save(); ctx.globalAlpha = alpha * 0.9;
        ctx.shadowColor = color; ctx.shadowBlur = radius * 1.5;
        ctx.beginPath(); ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill(); ctx.restore();
      });
    };

    const drawShapeObj = (o) => {
      const cx = o.cx ?? (o.x + (o.width ?? 0) / 2);
      const cy = o.cy ?? (o.y + (o.height ?? 0) / 2);
      const sc = o.scale ?? 1;
      const rot = o.rotation ?? 0;
      const W = o.width ?? (o.r ? o.r * 2 : 40);
      const H = o.height ?? W;
      const lw = Math.max(2, (o.radius ?? 3) * 1.6);
      const isRecognized = o.type !== 'freeform';

      ctx.save();
      ctx.globalAlpha = o.alpha ?? 1;
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.scale(sc, sc);
      ctx.strokeStyle = o.color;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.shadowColor = o.color;
      ctx.shadowBlur = o.selected ? 20 : 7;

      // Subtle fill for recognized shapes (15% opacity)
      const setFill = () => {
        ctx.fillStyle = o.color + '26'; // hex 26 ≈ 15%
        if (isRecognized) ctx.fill();
      };

      // Flash override — 2-frame white bbox flash on solidify
      if ((o.flashFrames ?? 0) > 0) {
        ctx.strokeStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 18;
        ctx.strokeRect(-W/2 - 6, -H/2 - 6, W + 12, H + 12);
      }

      if (o.type === 'circle') {
        ctx.beginPath(); ctx.arc(0, 0, (o.r ?? W/2), 0, Math.PI * 2);
        setFill(); ctx.stroke();
      } else if (o.type === 'rectangle') {
        ctx.beginPath(); ctx.rect(-W/2, -H/2, W, H);
        setFill(); ctx.stroke();
      } else if (o.type === 'triangle') {
        // Use actual stored corner points (translated to local space)
        ctx.beginPath();
        const pts = o.points.map(p => ({ x: p.x - cx, y: p.y - cy }));
        ctx.moveTo(pts[0].x, pts[0].y);
        pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
        ctx.closePath(); setFill(); ctx.stroke();
      } else if (o.type === 'arrow') {
        const pts = o.points.map(p => ({ x: p.x - cx, y: p.y - cy }));
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
        pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke();
        // Arrowhead at last point
        const tip = pts[pts.length - 1], prev = pts[pts.length - 2];
        const ang = Math.atan2(tip.y - prev.y, tip.x - prev.x);
        const aLen = 14;
        ctx.beginPath();
        ctx.moveTo(tip.x, tip.y);
        ctx.lineTo(tip.x - aLen * Math.cos(ang - 0.45), tip.y - aLen * Math.sin(ang - 0.45));
        ctx.lineTo(tip.x - aLen * Math.cos(ang + 0.45), tip.y - aLen * Math.sin(ang + 0.45));
        ctx.closePath(); ctx.fillStyle = o.color; ctx.fill();
      } else if (o.type === 'line') {
        const p1 = { x: o.p1.x - cx, y: o.p1.y - cy };
        const p2 = { x: o.p2.x - cx, y: o.p2.y - cy };
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      } else if (o.type === 'star') {
        const oR = (o.outerR ?? W / 2), iR = (o.innerR ?? oR * 0.4);
        const pts2 = 5;
        ctx.beginPath();
        for (let i = 0; i < pts2 * 2; i++) {
          const r2 = i % 2 === 0 ? oR : iR;
          const a2 = (i * Math.PI) / pts2 - Math.PI / 2;
          i === 0 ? ctx.moveTo(r2 * Math.cos(a2), r2 * Math.sin(a2))
                  : ctx.lineTo(r2 * Math.cos(a2), r2 * Math.sin(a2));
        }
        ctx.closePath(); setFill(); ctx.stroke();
      } else if (o.type === 'heart') {
        const s = W / 120;
        ctx.beginPath();
        ctx.moveTo(0, -20 * s);
        ctx.bezierCurveTo(40 * s, -55 * s, 90 * s, -10 * s, 0, 40 * s);
        ctx.bezierCurveTo(-90 * s, -10 * s, -40 * s, -55 * s, 0, -20 * s);
        ctx.closePath(); setFill(); ctx.stroke();
      } else if (o.type === 'freeform' && o.dots) {
        ctx.restore(); // exit transform — freeform uses world coords
        drawFreeformDots(o.dots, o.color, o.radius ?? 3, o.alpha ?? 1);
        return;
      }

      ctx.restore();

      // Selection dashed bbox (world space)
      if (o.selected) {
        ctx.save(); ctx.globalAlpha = 0.35;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
        ctx.strokeRect(cx - W / 2 - 8, cy - H / 2 - 8, W + 16, H + 16);
        // Rotation handle
        ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath(); ctx.arc(cx, cy - H / 2 - 20, 8, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    };

    // Committed freehand strokes (legacy, from pre-solidify era)
    for (const s of strokesRef.current) {
      if (s.dots) {
        s.dots.forEach((d, i) => {
          ctx.save(); ctx.globalAlpha = s.alpha ?? 1;
          ctx.shadowColor = s.color; ctx.shadowBlur = (s.radius ?? 3) * 1.5;
          ctx.beginPath(); ctx.arc(d.x, d.y, s.radius ?? 3, 0, Math.PI * 2);
          ctx.fillStyle = s.color; ctx.fill(); ctx.restore();
        });
      }
    }
    // Shape objects (decrement flash frames)
    objectsRef.current = objectsRef.current.map(o => {
      drawShapeObj(o);
      return o.flashFrames > 0 ? { ...o, flashFrames: o.flashFrames - 1 } : o;
    });
    // If any flash frames remain, keep redrawing
    if (objectsRef.current.some(o => o.flashFrames > 0)) {
      needsObjRedraw.current = true;
    }
  }, []);

  /* ── Layer 2 + 3: rAF draw loop — active strokes + cursors ─────────────── */
  const drawFrame = useCallback(() => {
    const dc  = drawCanvasRef.current;
    const uic = uiCanvasRef.current;
    if (!dc || !uic) { rafRef.current = requestAnimationFrame(drawFrame); return; }
    const time = performance.now() / 1000;

    // Layer 1 conditional repaint
    if (needsObjRedraw.current) { needsObjRedraw.current = false; redrawObjects(); }

    // Layer 2 — active in-progress strokes
    const dctx = dc.getContext('2d');
    dctx.clearRect(0, 0, dc.width, dc.height);
    const drawDot = (ctx, x, y, radius, c, alpha, di) => {
      const rx = x + Math.sin(time * 1.8 + di * 0.4) * 1.2;
      const ry = y + Math.cos(time * 2.1 + di * 0.3) * 1.2;
      ctx.save(); ctx.globalAlpha = alpha; ctx.shadowColor = c; ctx.shadowBlur = radius * 2;
      ctx.beginPath(); ctx.arc(rx, ry, radius, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill();
      ctx.restore();
    };
    let di = 0;
    for (const side of ['Left', 'Right']) {
      const st = hs.current[side].activeStroke;
      if (st) for (let i = 0; i < st.dots.length; i++)
        drawDot(dctx, st.dots[i].x, st.dots[i].y, st.radius, st.color, st.alpha, di++);
    }

    // Layer 3 — per-hand cursors + UI overlays
    const uctx = uic.getContext('2d');
    uctx.clearRect(0, 0, uic.width, uic.height);

    // Fling animation — fly-out for deleted objects
    const nowMs = performance.now();
    flingRef.current = flingRef.current.filter(f => {
      const elapsed = nowMs - f.startT;
      if (elapsed > 400) return false;
      const prog = elapsed / 400;
      const ex = f.ox + f.vx * elapsed * 0.12;
      const ey = f.oy + f.vy * elapsed * 0.12;
      uctx.save();
      uctx.globalAlpha = 1 - prog;
      uctx.translate(ex, ey);
      uctx.scale(1 - prog * 0.4, 1 - prog * 0.4);
      uctx.strokeStyle = f.color; uctx.lineWidth = 2; uctx.shadowColor = f.color; uctx.shadowBlur = 12;
      uctx.beginPath(); uctx.arc(0, 0, Math.max(4, (f.r ?? 20) * (1 - prog * 0.5)), 0, Math.PI * 2); uctx.stroke();
      uctx.restore();
      return true;
    });

    // Hover + grab highlights on objects layer
    for (const side of ['Left', 'Right']) {
      const h = hs.current[side];
      if (!h.pinchPos) continue;
      objectsRef.current.forEach(o => {
        if (!hitTest(o, h.pinchPos)) return;
        const c = objCentroid(o);
        const W = o.width ?? (o.r ? o.r * 2 : 40), H = o.height ?? W;
        if (h.state === HS.GRABBING && o.selected) {
          // Solid rgba(255,255,255,0.5) bbox + rotation handle
          uctx.save();
          uctx.globalAlpha = 0.5; uctx.strokeStyle = '#fff'; uctx.lineWidth = 1.5;
          uctx.strokeRect(c.x - W/2 - 8, c.y - H/2 - 8, W + 16, H + 16);
          // Rotation handle
          uctx.fillStyle = 'rgba(255,255,255,0.75)';
          uctx.beginPath(); uctx.arc(c.x, c.y - H/2 - 20, 8, 0, Math.PI * 2); uctx.fill();
          uctx.restore();
        } else if (h.state === HS.PINCHING || h.state === HS.IDLE) {
          // Dashed hover bbox
          uctx.save();
          uctx.globalAlpha = 0.3; uctx.strokeStyle = '#fff'; uctx.lineWidth = 2;
          uctx.setLineDash([6, 4]);
          uctx.strokeRect(c.x - W/2 - 6, c.y - H/2 - 6, W + 12, H + 12);
          uctx.setLineDash([]);
          uctx.restore();
        }
      });
    }

    // Two-hand connector line when both grabbing same object
    const lh = hs.current.Left, rh = hs.current.Right;
    if (lh.state === HS.GRABBING && rh.state === HS.GRABBING && lh.pinchPos && rh.pinchPos) {
      uctx.save();
      uctx.globalAlpha = 0.2; uctx.strokeStyle = '#fff'; uctx.lineWidth = 1;
      uctx.beginPath(); uctx.moveTo(lh.pinchPos.x, lh.pinchPos.y); uctx.lineTo(rh.pinchPos.x, rh.pinchPos.y); uctx.stroke();
      uctx.restore();
    }

    // Color-reassign preview badge
    const ch = colorHoverRef.current;
    if (ch.color && selectedIdRef.current !== null) {
      const selObj = objectsRef.current.find(o => o.id === selectedIdRef.current);
      if (selObj) {
        const c = objCentroid(selObj);
        uctx.save();
        uctx.fillStyle = ch.color; uctx.globalAlpha = 0.85;
        uctx.beginPath(); uctx.arc(c.x + 20, c.y - 20, 8, 0, Math.PI * 2); uctx.fill();
        uctx.strokeStyle = '#fff'; uctx.lineWidth = 1.5; uctx.globalAlpha = 1;
        uctx.beginPath(); uctx.arc(c.x + 20, c.y - 20, 8, 0, Math.PI * 2); uctx.stroke();
        uctx.restore();
      }
    }

    // Per-hand cursors
    for (const side of ['Left', 'Right']) {
      const h = hs.current[side];
      if (!h.cursorPos) continue;
      const { x, y } = h.cursorPos;
      const isRight  = side === 'Right';
      const curColor = isRight ? colorRef.current : secondaryColorRef.current;
      const label    = isRight ? 'R' : 'L';
      uctx.save();
      if (h.state === HS.PINCHING || h.state === HS.GRABBING) {
        uctx.globalAlpha = isRight ? 0.9 : LEFT_ALPHA + 0.25;
        uctx.strokeStyle = curColor; uctx.lineWidth = 2;
        uctx.shadowColor = curColor; uctx.shadowBlur = 10;
        uctx.beginPath(); uctx.arc(x, y, 8, 0, Math.PI*2); uctx.stroke();
        uctx.beginPath(); uctx.arc(x, y, 18, 0, Math.PI*2); uctx.stroke();
        if (h.state === HS.GRABBING) {
          uctx.shadowBlur = 20; uctx.lineWidth = 1;
          uctx.beginPath(); uctx.arc(x, y, 24, 0, Math.PI*2); uctx.stroke();
        }
      } else if (h.state === HS.REPOSITIONING) {
        uctx.globalAlpha = isRight ? 0.8 : LEFT_ALPHA + 0.2;
        uctx.strokeStyle = curColor; uctx.lineWidth = 2; uctx.lineCap = 'round';
        uctx.shadowColor = curColor; uctx.shadowBlur = 8;
        uctx.beginPath(); uctx.moveTo(x-10, y); uctx.lineTo(x+10, y); uctx.stroke();
        uctx.beginPath(); uctx.moveTo(x, y-10); uctx.lineTo(x, y+10); uctx.stroke();
        uctx.beginPath(); uctx.arc(x, y, 2, 0, Math.PI*2); uctx.fillStyle = curColor; uctx.fill();
      } else {
        const r = isRight ? 8 : 7;
        uctx.globalAlpha = isRight ? 1 : LEFT_ALPHA + 0.25;
        uctx.shadowColor = curColor; uctx.shadowBlur = 14;
        uctx.beginPath(); uctx.arc(x, y, r, 0, Math.PI*2);
        uctx.fillStyle = curColor; uctx.fill();
        uctx.globalAlpha = 1;
        uctx.font = '700 9px "Instrument Sans", system-ui, sans-serif';
        uctx.fillStyle = '#fff'; uctx.textAlign = 'center'; uctx.textBaseline = 'middle';
        uctx.shadowBlur = 0;
        uctx.fillText(label, x, y);
      }
      uctx.restore();
    }

    setClearPct(clearPctRef.current);
    setGestureSummary(gestureLabel(
      hs.current.Right.state, hs.current.Left.state,
      hs.current.Right.isFist, hs.current.Left.isFist,
      modeRef.current,
    ));
    rafRef.current = requestAnimationFrame(drawFrame);
  }, [redrawObjects]);

  /* ── MediaPipe results handler ─────────────────────────────────────────── */
  const onResults = useCallback((results) => {
    const canvas = drawCanvasRef.current;
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

        // ── Classify pose (pixel-space, spec-exact) ─────────────────────────
        const pose = classifyHandPose(lms, W, H);
        h.isFist      = pose.isFist;
        h.isOpenPalm  = pose.isOpenPalm;
        h.pinching    = pose.isPinching;
        h.pinchPos    = pose.pinchPos;

        // mirrored X = (1 - lm.x) * W per spec
        h.smoothBuf.push({ x: (1-lms[8].x)*W, y: lms[8].y*H });
        if (h.smoothBuf.length > 4) h.smoothBuf.shift();
        h.cursorPos = smoothedPos(h.smoothBuf);

        // ── Flick velocity tracking (last 6 frames of lm8) ────────────────
        const lm8px = { x: (1-lms[8].x)*W, y: lms[8].y*H };
        h.flickBuf.push(lm8px);
        if (h.flickBuf.length > 6) h.flickBuf.shift();

        // Flick: speed > 180px/frame while GRABBING → delete fling
        if (h.state === HS.GRABBING && h.flickBuf.length >= 2 && selectedIdRef.current !== null) {
          const prev = h.flickBuf[h.flickBuf.length - 2];
          const speed = dist(lm8px, prev);
          if (speed > 180) {
            // Record fling animation before deleting
            const fObj = objectsRef.current.find(o => o.id === selectedIdRef.current);
            if (fObj) {
              const fc = objCentroid(fObj);
              flingRef.current.push({
                ox: fc.x, oy: fc.y,
                vx: (lm8px.x - prev.x), vy: (lm8px.y - prev.y),
                color: fObj.color, r: fObj.r ?? fObj.width / 2,
                startT: performance.now(),
              });
            }
            objectsRef.current = objectsRef.current.filter(o => o.id !== selectedIdRef.current);
            selectedIdRef.current = null; dragOffsetRef.current = null;
            modeRef.current = MODE.DRAW; needsObjRedraw.current = true;
          }
        }

        // ── State machine transition ─────────────────────────────────────
        const prevState = h.state;
        if (pose.isPinching) {
          // Open palm explicitly releases a grab
          if (pose.isOpenPalm && h.state === HS.GRABBING) {
            h.state = HS.REPOSITIONING;
          } else {
            const overObj = h.state === HS.GRABBING
              || objectsRef.current.some(o => hitTest(o, h.pinchPos));
            h.state = overObj ? HS.GRABBING : HS.PINCHING;
          }
        } else if (pose.isOpenPalm || pose.isReposition) {
          h.state = HS.REPOSITIONING;
        } else if (pose.isDrawing) {
          h.state = HS.DRAWING;
        } else {
          h.state = HS.IDLE;
        }

        // ── Per-hand fist: short (200-600ms) = solidify, long (>1.5s) = clear ──
        if (h.isFist) {
          if (!h.clearStart) h.clearStart = now;
          const held = now - h.clearStart;
          if (held >= CLEAR_HOLD_MS) {
            // Long fist → clear THIS hand's strokes/objects only
            strokesRef.current = strokesRef.current.filter(s => s.hand !== side);
            objectsRef.current = objectsRef.current.filter(o => o.hand !== side);
            h.activeStroke = null; h.clearStart = null;
            if (side === 'Right') clearPctRef.current = 0;
            needsObjRedraw.current = true;
          } else if (side === 'Right') {
            clearPctRef.current = Math.min(100, (held / CLEAR_HOLD_MS) * 100);
          }
        } else {
          if (h.clearStart) {
            const held = now - h.clearStart;
            if (held >= 200 && held <= 600) {
              // Short fist → solidify last completed stroke from THIS hand
              const lastStroke = [...strokesRef.current].reverse().find(s => s.hand === side);
              if (lastStroke) {
                strokesRef.current = strokesRef.current.filter(s => s !== lastStroke);
                const obj = solidifyStroke(lastStroke, side);
                objectsRef.current.push(obj);
                setShapeHint(obj.recognizedAs);
                setTimeout(() => setShapeHint(''), 1800);
                needsObjRedraw.current = true;
              }
            }
            h.clearStart = null;
            if (side === 'Right') clearPctRef.current = 0;
          }
        }

        // ── DRAW strokes ─────────────────────────────────────────────────
        const isPrimary = side === 'Right';
        const alpha     = isPrimary ? 1.0 : LEFT_ALPHA;
        // Left hand uses secondary color (2 steps clockwise from primary)
        const drawColor = isPrimary ? colorRef.current : secondaryColorRef.current;

        if (h.state === HS.DRAWING) {
          if (prevState !== HS.DRAWING) {
            h.activeStroke = { hand: side, dots: [], color: drawColor, radius: widthRef.current / 2, alpha };
          }
          if (h.activeStroke && h.cursorPos) {
            const dots = h.activeStroke.dots;
            const last = dots[dots.length - 1];
            if (!last || dist(h.cursorPos, last) >= DOT_SPACING)
              dots.push({ x: h.cursorPos.x, y: h.cursorPos.y });
          }
        } else {
          // Leaving DRAWING → auto-solidify via solidifyStroke
          if (prevState === HS.DRAWING && h.activeStroke?.dots?.length >= 4) {
            const obj = solidifyStroke(h.activeStroke, side);
            if (obj.type === 'freeform') {
              strokesRef.current.push(h.activeStroke); // keep as raw stroke
            } else {
              objectsRef.current.push(obj);
              setShapeHint(obj.recognizedAs);
              setTimeout(() => setShapeHint(''), 1800);
            }
            needsObjRedraw.current = true;
          }
          h.activeStroke = null;
        }

        // ── GRABBING: select & drag (right hand, MANIPULATE mode) ────────
        if (side === 'Right') {
          if (h.state === HS.GRABBING) {
            modeRef.current = MODE.MANIPULATE;
            if (selectedIdRef.current === null) {
              let best = null, bestD = 999;
              objectsRef.current.forEach(o => {
                const c = objCentroid(o), d = dist(h.pinchPos, c);
                if (hitTest(o, h.pinchPos) && d < bestD) { bestD = d; best = o.id; }
              });
              if (best !== null) {
                selectedIdRef.current = best;
                objectsRef.current = objectsRef.current.map(o => ({...o, selected: o.id === best}));
                const sel = objectsRef.current.find(o => o.id === best);
                dragOffsetRef.current = { dx: objCentroid(sel).x - h.pinchPos.x, dy: objCentroid(sel).y - h.pinchPos.y };
                needsObjRedraw.current = true;
              }
            } else {
              const off = dragOffsetRef.current || {dx:0,dy:0};
              const target = { x: h.pinchPos.x + off.dx, y: h.pinchPos.y + off.dy };
              objectsRef.current = objectsRef.current.map(o => {
                if (o.id !== selectedIdRef.current) return o;
                const c = objCentroid(o); return translateObj(o, target.x - c.x, target.y - c.y);
              });
              needsObjRedraw.current = true;
            }
          } else if (prevState === HS.GRABBING) {
            // Released grab → deselect, snap coords to int, exit MANIPULATE
            objectsRef.current = objectsRef.current.map(o => {
              if (!o.selected) return o;
              // Snap center coordinates to nearest integer
              const snapped = {};
              if (o.cx !== undefined) { snapped.cx = Math.round(o.cx); snapped.cy = Math.round(o.cy); }
              if (o.x  !== undefined) { snapped.x  = Math.round(o.x);  snapped.y  = Math.round(o.y);  }
              if (o.p1 !== undefined) {
                snapped.p1 = { x: Math.round(o.p1.x), y: Math.round(o.p1.y) };
                snapped.p2 = { x: Math.round(o.p2.x), y: Math.round(o.p2.y) };
              }
              return { ...o, ...snapped, selected: false };
            });
            selectedIdRef.current = null; dragOffsetRef.current = null;
            modeRef.current = MODE.DRAW;
            needsObjRedraw.current = true;
          }
        }

        // ── Two-hand GRABBING: scale + rotate ──────────────────────────────────
        if (hs.current.Left.state === HS.GRABBING && hs.current.Right.state === HS.GRABBING) {
          const lp = hs.current.Left.pinchPos, rp = hs.current.Right.pinchPos;
          if (lp && rp && selectedIdRef.current !== null) {
            const curDist  = dist(lp, rp);
            const curAngle = Math.atan2(rp.y - lp.y, rp.x - lp.x);
            if (prevPinchDist.current !== null) {
              const sf = Math.min(Math.max(curDist / prevPinchDist.current, 0.5), 2);
              let dAngle = 0;
              if (prevPinchAngle.current !== null) {
                dAngle = curAngle - prevPinchAngle.current;
                if (dAngle > Math.PI) dAngle -= 2 * Math.PI;
                if (dAngle < -Math.PI) dAngle += 2 * Math.PI;
              }
              objectsRef.current = objectsRef.current.map(o => {
                if (!o.selected) return o;
                const newScale = Math.min(4, Math.max(0.3, (o.scale ?? 1) * sf));
                const newRot   = (o.rotation ?? 0) + dAngle;
                return { ...o, scale: newScale, rotation: newRot };
              });
            }
            prevPinchDist.current  = curDist;
            prevPinchAngle.current = curAngle;
            needsObjRedraw.current = true;
          }
        } else { prevPinchDist.current = null; prevPinchAngle.current = null; }

        // ── Color reassign while grabbing ──────────────────────────────────
        // If one hand is GRABBING and the other hovers lm8 near a swatch for 300ms
        const otherSide = side === 'Right' ? 'Left' : 'Right';
        const otherH = hs.current[otherSide];
        if (h.state === HS.GRABBING && selectedIdRef.current !== null && otherH.cursorPos) {
          const swatches = swatchPosRef.current;
          let hoveredColor = null;
          for (const sw of swatches) {
            if (dist(otherH.cursorPos, sw) < 30) { hoveredColor = sw.color; break; }
          }
          const ch = colorHoverRef.current;
          if (hoveredColor) {
            if (ch.color !== hoveredColor) { colorHoverRef.current = { color: hoveredColor, start: now }; }
            else if (now - ch.start >= 300) {
              objectsRef.current = objectsRef.current.map(o =>
                o.id === selectedIdRef.current ? { ...o, color: hoveredColor } : o
              );
              colorHoverRef.current = { color: null, start: 0 };
              needsObjRedraw.current = true;
            }
          } else { colorHoverRef.current = { color: null, start: 0 }; }
        }
      }
    }

    // Reset hands not seen this frame
    for (const side of ['Left', 'Right']) {
      if (!detected.has(side)) {
        const h = hs.current[side];
        if (h.state === HS.DRAWING && h.activeStroke?.dots?.length >= 4) {
          const obj = solidifyStroke(h.activeStroke, side);
          if (obj.type === 'freeform') strokesRef.current.push(h.activeStroke);
          else objectsRef.current.push(obj);
          needsObjRedraw.current = true;
        }
        Object.assign(h, makeHandState());
        if (side === 'Right') { clearPctRef.current = 0; selectedIdRef.current = null; modeRef.current = MODE.DRAW; }
      }
    }

    // ── Both fists → confirm ─────────────────────────────────────────────
    const bothFist = hs.current.Left.isFist && hs.current.Right.isFist;
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

  /* ── Resize — sync all 3 canvas layers ─────────────────────────────────── */
  const resizeCanvas = useCallback(() => {
    for (const ref of [objectsCanvasRef, drawCanvasRef, uiCanvasRef]) {
      const c = ref.current;
      if (c) { c.width = c.offsetWidth; c.height = c.offsetHeight; }
    }
    needsObjRedraw.current = true;
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

  /* \u2500\u2500 Manual toolbar actions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  const handleUndo = useCallback(() => {
    // Only undoes completed strokes/objects, not mid-stroke
    if (objectsRef.current.length) objectsRef.current = objectsRef.current.slice(0, -1);
    else if (strokesRef.current.length) strokesRef.current = strokesRef.current.slice(0, -1);
    needsObjRedraw.current = true;
  }, []);

  const handleClearAll = useCallback(() => {
    strokesRef.current = []; objectsRef.current = [];
    hs.current.Left.activeStroke = null; hs.current.Right.activeStroke = null;
    needsObjRedraw.current = true;
  }, []);

  const handleExport = useCallback(() => {
    const oc = objectsCanvasRef.current, dc = drawCanvasRef.current, uc = uiCanvasRef.current;
    if (!oc) return;
    const W = oc.width, H = oc.height;
    const offscreen = document.createElement('canvas');
    offscreen.width = W; offscreen.height = H;
    const ctx = offscreen.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(oc, 0, 0);
    if (dc) ctx.drawImage(dc, 0, 0);
    if (uc) ctx.drawImage(uc, 0, 0);
    const dataURL = offscreen.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `aircanvas-export-${Date.now()}.png`;
    a.click();
    onConfirm?.(dataURL);
  }, [onConfirm]);

  // Ctrl+Z / Cmd+Z undo shortcut
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); handleUndo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo]);

  const isReady  = initState === 'ready';
  const isError  = initState === 'error';
  const isActive = hs.current.Right.state === HS.DRAWING || hs.current.Left.state === HS.DRAWING;
  const rFist    = hs.current.Right.isFist;
  const inManip  = modeRef.current === MODE.MANIPULATE;
  const bothGrab = hs.current.Right.state === HS.GRABBING && hs.current.Left.state === HS.GRABBING;
  const isRepo   = hs.current.Right.state === HS.REPOSITIONING || hs.current.Left.state === HS.REPOSITIONING;

  // Gesture badge: state-driven dot + text color
  const badgeDot  = isActive   ? '#00FFD1'
                  : bothGrab   ? '#F97316'
                  : inManip    ? '#A78BFA'
                  : isRepo     ? '#ffffff'
                  : rFist      ? '#F97316'
                  : 'rgba(255,255,255,0.18)';
  const badgeGlow = isActive   ? '0 0 6px #00FFD1'
                  : bothGrab   ? '0 0 6px #F97316'
                  : inManip    ? '0 0 6px #A78BFA'
                  : isRepo     ? '0 0 4px rgba(255,255,255,0.4)'
                  : rFist      ? '0 0 6px #F97316'
                  : 'none';
  const badgeTxtColor = isActive ? '#00FFD1'
                      : bothGrab ? '#F97316'
                      : inManip  ? '#C4B5FD'
                      : isRepo   ? '#ffffff'
                      : 'rgba(255,255,255,0.55)';

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
              style={{ background: badgeDot, boxShadow: badgeGlow }}
            />
            <span className={styles.gestureText} style={{ color: badgeTxtColor }}>{gestureSummary}</span>
          </div>

          {/* Camera pill */}
          <div className={styles.camPill}>
            <span className={styles.camPillDot} style={{ background: isError ? '#EF4444' : isReady ? '#22C55E' : '#F59E0B' }} />
            <span>{isError ? 'no cam' : isReady ? 'live' : 'starting'}</span>
          </div>

          {/* Export — composites canvas layers, triggers download */}
          <button id="ac-export" className={styles.exportBtn} onClick={handleExport} title="Export PNG">
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
                ref={el => {
                  if (el) {
                    const r = el.getBoundingClientRect();
                    const canvasR = objectsCanvasRef.current?.getBoundingClientRect();
                    if (canvasR) {
                      swatchPosRef.current[i] = {
                        x: r.left + r.width / 2 - canvasR.left,
                        y: r.top + r.height / 2 - canvasR.top,
                        color: c.value,
                      };
                    }
                  }
                }}
              />
            ))}
          </div>
          {/* Secondary color indicator — L-hand color, 2 steps clockwise */}
          <div className={styles.sidebarDivider} />
          <div
            title="Left-hand color (2× clockwise)"
            style={{
              width: 18, height: 18, borderRadius: '50%',
              background: secColor,
              opacity: 0.55,
              margin: '2px auto',
              boxShadow: `0 0 0 1.5px #111318, 0 0 0 3px ${secColor}55`,
              position: 'relative',
            }}
          >
            <span style={{
              position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
              fontSize: 8, fontWeight: 700, color: '#fff', letterSpacing: 0,
            }}>L</span>
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

          {/* Layer 1 — static objects */}
          <canvas ref={objectsCanvasRef} id="ac-canvas-objects" className={styles.layerCanvas} />
          {/* Layer 2 — active strokes */}
          <canvas ref={drawCanvasRef}    id="ac-canvas-draw"    className={styles.layerCanvas} />
          {/* Layer 3 — cursors / UI */}
          <canvas ref={uiCanvasRef}      id="ac-canvas-ui"      className={styles.layerCanvas} />

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

          {/* Shape recognition toast */}
          {shapeHint && (
            <div className={styles.shapeToast}>
              ✦ recognized <strong>{shapeHint}</strong>
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
              <span>index finger → draw</span>
              <span className={styles.hintDiv}/>
              <span>pinch → grab &amp; drag</span>
              <span className={styles.hintDiv}/>
              <span>fist (short) → solidify</span>
            </div>

            <span className={styles.fistHint}>2-hand pinch → scale &amp; rotate &nbsp;·&nbsp; flick → delete</span>
          </div>
        </div>
      </div>
    </div>
  );
}