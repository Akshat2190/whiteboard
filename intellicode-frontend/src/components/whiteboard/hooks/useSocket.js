import { useEffect, useRef, useCallback } from 'react';
import { useWhiteboardStore } from '../../../store/whiteboardStore';

const CURSOR_DEBOUNCE = 50;

export function useSocket({ projectId, onRemoteDraw, onRemoteCursor }) {
  const socketRef = useRef(null);
  const cursorTimerRef = useRef(null);
  const { zoom, scrollX, scrollY } = useWhiteboardStore();

  useEffect(() => {
    // Socket.io is already set up in SocketContext — we reuse it
    // This hook simply provides a thin wrapper for whiteboard-specific events
    return () => {
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
    };
  }, []);

  const emitDraw = useCallback((socket, element) => {
    if (!socket || !projectId) return;
    socket.emit('whiteboard:draw', { projectId, object: element });
  }, [projectId]);

  const emitCursor = useCallback((socket, x, y) => {
    if (!socket || !projectId) return;
    if (cursorTimerRef.current) return;
    cursorTimerRef.current = setTimeout(() => {
      cursorTimerRef.current = null;
      // Convert canvas coords to screen coords for transmission
      const screenX = x * zoom + scrollX;
      const screenY = y * zoom + scrollY;
      socket.emit('whiteboard:cursor', { projectId, x: screenX, y: screenY });
    }, CURSOR_DEBOUNCE);
  }, [projectId, zoom, scrollX, scrollY]);

  return { emitDraw, emitCursor };
}
