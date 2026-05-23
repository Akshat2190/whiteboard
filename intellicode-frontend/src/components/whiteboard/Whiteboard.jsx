import React, { useRef, useEffect, useCallback, useState } from 'react';
import Canvas from './Canvas';
import Toolbar from './Toolbar';
import PropertiesPanel from './PropertiesPanel';
import ZoomControls from './ZoomControls';
import UndoRedo from './UndoRedo';
import { useCanvas } from './hooks/useCanvas';
import { useHistory } from './hooks/useHistory';
import { useKeyboard } from './hooks/useKeyboard';
import { useWhiteboardStore } from '../../store/whiteboardStore';
import { useSocket } from '../../context/SocketContext';

const CURSOR_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function Whiteboard({ projectId, onGenerateCode, readOnly }) {
  // canvasComponentRef -> Canvas component (exposes canvasEl() and redraw())
  const canvasComponentRef = useRef(null);

  // A stable ref that always points to the actual <canvas> DOM element
  // useCanvas reads this to do getBoundingClientRect etc.
  const canvasElRef = useRef(null);

  const store = useWhiteboardStore();
  const { socket } = useSocket();

  // ─── History ──────────────────────────────────────────────────────────────
  const { pushHistory, undo, redo, canUndo, canRedo, historyRef, indexRef } = useHistory();

  const handleUndo = useCallback(() => {
    if (!canUndo()) return;
    indexRef.current -= 1;
    const snapshot = historyRef.current[indexRef.current];
    store.setSelectedIds([]);
    useWhiteboardStore.setState({
      elements: snapshot.map((el) => ({ ...el, points: el.points ? [...el.points] : [] })),
    });
  }, [historyRef, indexRef, store]);

  const handleRedo = useCallback(() => {
    if (!canRedo()) return;
    indexRef.current += 1;
    const snapshot = historyRef.current[indexRef.current];
    store.setSelectedIds([]);
    useWhiteboardStore.setState({
      elements: snapshot.map((el) => ({ ...el, points: el.points ? [...el.points] : [] })),
    });
  }, [historyRef, indexRef, store]);

  const doPushHistory = useCallback(() => {
    pushHistory(useWhiteboardStore.getState().elements);
  }, [pushHistory]);

  // ─── Redraw trigger ───────────────────────────────────────────────────────
  const handleRedraw = useCallback(() => {
    canvasComponentRef.current?.redraw?.();
  }, []);

  // ─── Sync canvasElRef after mount ────────────────────────────────────────
  // We use a short polling loop until the canvas reports itself, then stop
  useEffect(() => {
    const sync = () => {
      const el = canvasComponentRef.current?.canvasEl?.();
      if (el) {
        canvasElRef.current = el;
      } else {
        requestAnimationFrame(sync);
      }
    };
    sync();
  }, []);

  // ─── Canvas interaction ───────────────────────────────────────────────────
  const {
    onMouseDown, onMouseMove, onMouseUp, onWheel, onDoubleClick,
    onTouchStart, onTouchMove, onTouchEnd,
    currentElementRef, selRectRef, isSelRectRef,
    textInput, setTextInput,
  } = useCanvas({
    canvasRef: canvasElRef,   // ← pass the real canvas element ref
    pushHistory: doPushHistory,
    onRedraw: handleRedraw,
  });

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────
  useKeyboard({ onUndo: handleUndo, onRedo: handleRedo, canUndo, canRedo });

  // ─── Real-time collaboration ─────────────────────────────────────────────
  const [remoteCursors, setRemoteCursors] = useState({});
  const cursorTimeouts = useRef({});

  useEffect(() => {
    if (!socket || !projectId) return;

    const handleDraw = (data) => {
      if (!data?.object) return;
      const el = data.object;
      const { elements } = useWhiteboardStore.getState();
      if (elements.find((e) => e.id === el.id)) {
        store.updateElement(el.id, el);
      } else {
        store.addElement(el);
      }
    };

    const handleCursor = (data) => {
      if (!data?.userId) return;
      setRemoteCursors((prev) => ({
        ...prev,
        [data.userId]: { x: data.x, y: data.y, name: data.userName || 'User' },
      }));
      if (cursorTimeouts.current[data.userId]) clearTimeout(cursorTimeouts.current[data.userId]);
      cursorTimeouts.current[data.userId] = setTimeout(() => {
        setRemoteCursors((prev) => { const n = { ...prev }; delete n[data.userId]; return n; });
      }, 3000);
    };

    const handleSync = (data) => {
      const state = data?.state || data?.whiteboardState;
      if (Array.isArray(state)) useWhiteboardStore.setState({ elements: state });
    };

    socket.on('whiteboard:draw', handleDraw);
    socket.on('whiteboard:cursor', handleCursor);
    socket.on('whiteboard:sync', handleSync);

    return () => {
      socket.off('whiteboard:draw', handleDraw);
      socket.off('whiteboard:cursor', handleCursor);
      socket.off('whiteboard:sync', handleSync);
    };
  }, [socket, projectId, store]);

  // ─── Load saved state ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    import('../../services/project.service').then(({ projectService }) => {
      projectService.getWhiteboard(projectId)
        .then((res) => {
          const state = res?.whiteboardState;
          if (Array.isArray(state) && state.length) {
            useWhiteboardStore.setState({ elements: state });
            pushHistory(state);
          }
        })
        .catch(() => {});
    });
  }, [projectId, pushHistory]);

  // ─── Auto-save every 2s on element changes ────────────────────────────────
  const saveTimer = useRef(null);
  useEffect(() => {
    if (!projectId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const { elements } = useWhiteboardStore.getState();
      import('../../services/project.service').then(({ projectService }) => {
        projectService.saveWhiteboard(projectId, elements).catch(() => {});
      });
      if (socket) socket.emit('whiteboard:sync', { projectId, state: elements });
    }, 2000);
    return () => clearTimeout(saveTimer.current);
  }, [store.elements, projectId, socket]);

  // ─── Inline text editor ───────────────────────────────────────────────────
  const textareaRef = useRef(null);
  useEffect(() => {
    if (textInput && textareaRef.current) textareaRef.current.focus();
  }, [textInput]);

  const handleTextBlur = useCallback(() => {
    if (!textInput) return;
    const val = textareaRef.current?.value || '';
    if (val.trim()) {
      store.updateElement(textInput.id, { text: val });
    } else {
      store.updateElement(textInput.id, { isDeleted: true });
    }
    setTextInput(null);
    handleRedraw();
  }, [textInput, store, setTextInput, handleRedraw]);

  const handleTextKeyDown = useCallback((e) => {
    if (e.key === 'Escape') handleTextBlur();
    e.stopPropagation();
  }, [handleTextBlur]);

  // ─── Panel visibility ─────────────────────────────────────────────────────
  const { selectedIds, tool, strokeColor, zoom: storeZoom } = store;
  const showPanel = selectedIds.length > 0 ||
    ['rectangle', 'ellipse', 'diamond', 'arrow', 'line', 'freedraw', 'text'].includes(tool);

  // ─── Generate Code button ─────────────────────────────────────────────────
  const [generating, setGenerating] = useState(false);
  const handleGenerate = useCallback(async () => {
    const els = useWhiteboardStore.getState().elements.filter((e) => !e.isDeleted);
    if (!els.length) { alert('Draw your architecture first!'); return; }
    setGenerating(true);
    try { await onGenerateCode?.(els); }
    finally { setGenerating(false); }
  }, [onGenerateCode]);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      overflow: 'hidden',
      background: '#121212',
      fontFamily: 'Inter, sans-serif',
    }}>
      {/* Canvas fills everything */}
      <Canvas
        ref={canvasComponentRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onWheel={onWheel}
        onDoubleClick={onDoubleClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        currentElementRef={currentElementRef}
        selRectRef={selRectRef}
      />

      {/* All UI layers sit above canvas */}
      {!readOnly && <Toolbar />}
      {!readOnly && <PropertiesPanel visible={showPanel} />}

      {/* Bottom-left controls */}
      <div style={{
        position: 'fixed', bottom: 16, left: 16,
        display: 'flex', flexDirection: 'column', gap: 8, zIndex: 100,
        pointerEvents: 'all',
      }}>
        {!readOnly && (
          <UndoRedo
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={canUndo()}
            canRedo={canRedo()}
          />
        )}
        <ZoomControls />
      </div>

      {/* Generate Code button */}
      {onGenerateCode && (
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            position: 'fixed', top: 12, right: 12, zIndex: 110,
            background: generating ? '#4a4888' : '#6965db',
            color: '#fff', border: 'none', borderRadius: 8,
            padding: '10px 20px', fontWeight: 600, fontSize: 14,
            cursor: generating ? 'wait' : 'pointer',
            boxShadow: '0 2px 12px rgba(105,101,219,0.4)',
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'background 0.2s',
            fontFamily: 'Inter, sans-serif',
            pointerEvents: 'all',
          }}
        >
          {generating ? <>⟳ Generating...</> : <>✨ Generate Code</>}
        </button>
      )}

      {/* Inline text editor */}
      {textInput && (
        <textarea
          ref={textareaRef}
          defaultValue=""
          onBlur={handleTextBlur}
          onKeyDown={handleTextKeyDown}
          onChange={(e) => {
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
            e.target.style.width = Math.max(100, e.target.value.length * 12) + 'px';
          }}
          style={{
            position: 'fixed',
            left: textInput.screenX,
            top: textInput.screenY,
            zIndex: 200,
            background: 'transparent',
            border: '1px solid rgba(105,101,219,0.5)',
            outline: 'none',
            color: strokeColor || '#ffffff',
            fontSize: `${20 * storeZoom}px`,
            fontFamily: 'Inter, sans-serif',
            resize: 'none',
            overflow: 'hidden',
            minWidth: 100,
            minHeight: 28,
            lineHeight: 1.2,
            padding: '2px 4px',
            borderRadius: 3,
            pointerEvents: 'all',
          }}
        />
      )}

      {/* Remote cursors */}
      {Object.entries(remoteCursors).map(([userId, { x, y, name }], idx) => {
        const color = CURSOR_COLORS[idx % CURSOR_COLORS.length];
        return (
          <div key={userId} style={{
            position: 'fixed', left: x, top: y, zIndex: 300,
            pointerEvents: 'none', transform: 'translate(0,0)',
          }}>
            <svg width="16" height="20" viewBox="0 0 16 20">
              <path d="M0 0 L0 16 L4 12 L8 20 L10 19 L6 11 L12 11 Z" fill={color} stroke="#fff" strokeWidth="0.5" />
            </svg>
            <div style={{
              background: color, color: '#fff', borderRadius: 4,
              padding: '2px 6px', fontSize: 11, fontWeight: 600,
              marginTop: 2, whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif',
            }}>{name}</div>
          </div>
        );
      })}
    </div>
  );
}
