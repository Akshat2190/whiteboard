import { useEffect, useRef } from 'react';
import { useWhiteboardStore } from '../../../store/whiteboardStore';

export function useKeyboard({ onUndo, onRedo, canUndo, canRedo }) {
  const store = useWhiteboardStore();
  const clipboardRef = useRef([]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const ctrl = e.ctrlKey || e.metaKey;

      // Delete / Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        store.deleteSelected();
        return;
      }

      // Escape
      if (e.key === 'Escape') {
        store.setSelectedIds([]);
        store.setTool('select');
        return;
      }

      // Ctrl shortcuts
      if (ctrl) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); onUndo?.(); return; }
        if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); onRedo?.(); return; }
        if (e.key === 'a') {
          e.preventDefault();
          const ids = store.elements.filter((el) => !el.isDeleted).map((el) => el.id);
          store.setSelectedIds(ids);
          return;
        }
        if (e.key === 'c') {
          e.preventDefault();
          const selected = store.elements.filter((el) => store.selectedIds.includes(el.id));
          clipboardRef.current = selected;
          return;
        }
        if (e.key === 'v') {
          e.preventDefault();
          const pasted = clipboardRef.current.map((el) => ({
            ...el,
            id: crypto.randomUUID(),
            x: el.x + 10,
            y: el.y + 10,
            points: el.points ? el.points.map(([px, py]) => [px + 10, py + 10]) : [],
          }));
          pasted.forEach((el) => store.addElement(el));
          store.setSelectedIds(pasted.map((el) => el.id));
          return;
        }
        if (e.key === 'd') {
          e.preventDefault();
          const selected = store.elements.filter((el) => store.selectedIds.includes(el.id));
          const duped = selected.map((el) => ({
            ...el,
            id: crypto.randomUUID(),
            x: el.x + 10,
            y: el.y + 10,
          }));
          duped.forEach((el) => store.addElement(el));
          store.setSelectedIds(duped.map((el) => el.id));
          return;
        }
        if (e.key === '=' || e.key === '+') { e.preventDefault(); store.setZoom(store.zoom + 0.1); return; }
        if (e.key === '-') { e.preventDefault(); store.setZoom(store.zoom - 0.1); return; }
        if (e.key === '0') { e.preventDefault(); store.setZoom(1); store.setScroll(0, 0); return; }
        return;
      }

      // Tool shortcuts
      const keyMap = {
        h: 'hand', H: 'hand', '1': 'hand',
        v: 'select', V: 'select', '2': 'select',
        r: 'rectangle', R: 'rectangle', '3': 'rectangle',
        d: 'diamond', D: 'diamond', '4': 'diamond',
        o: 'ellipse', O: 'ellipse', '5': 'ellipse',
        a: 'arrow', A: 'arrow', '6': 'arrow',
        l: 'line', L: 'line', '7': 'line',
        p: 'freedraw', P: 'freedraw', '8': 'freedraw',
        t: 'text', T: 'text', '9': 'text',
        e: 'eraser', E: 'eraser', '0': 'eraser',
      };

      if (keyMap[e.key]) {
        store.setTool(keyMap[e.key]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [store, onUndo, onRedo]);
}
