import { useRef, useCallback } from 'react';

export function useHistory() {
  const historyRef = useRef([[]]);
  const indexRef = useRef(0);

  const pushHistory = useCallback((elements) => {
    const cloned = elements.map((el) => ({ ...el, points: el.points ? [...el.points] : [] }));
    historyRef.current = historyRef.current.slice(0, indexRef.current + 1);
    historyRef.current.push(cloned);
    indexRef.current = historyRef.current.length - 1;
  }, []);

  const undo = useCallback((setElements) => {
    if (indexRef.current <= 0) return;
    indexRef.current -= 1;
    const snapshot = historyRef.current[indexRef.current];
    setElements(snapshot.map((el) => ({ ...el, points: el.points ? [...el.points] : [] })));
  }, []);

  const redo = useCallback((setElements) => {
    if (indexRef.current >= historyRef.current.length - 1) return;
    indexRef.current += 1;
    const snapshot = historyRef.current[indexRef.current];
    setElements(snapshot.map((el) => ({ ...el, points: el.points ? [...el.points] : [] })));
  }, []);

  const canUndo = () => indexRef.current > 0;
  const canRedo = () => indexRef.current < historyRef.current.length - 1;

  return { pushHistory, undo, redo, canUndo, canRedo, historyRef, indexRef };
}
