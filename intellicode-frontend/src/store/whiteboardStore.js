import { create } from 'zustand';

const deepClone = (arr) => arr.map((el) => ({ ...el, points: el.points ? [...el.points] : [] }));

export const useWhiteboardStore = create((set, get) => ({
  // Canvas elements
  elements: [],
  selectedIds: [],

  // Active tool
  tool: 'hand',

  // Viewport
  zoom: 1,
  scrollX: 0,
  scrollY: 0,

  // Style properties
  strokeColor: '#ffffff',
  backgroundColor: 'transparent',
  fillStyle: 'hachure',
  strokeWidth: 2,
  strokeStyle: 'solid',
  roughness: 1,
  opacity: 100,

  // History
  history: [[]],
  historyIndex: 0,

  // Actions
  setTool: (tool) => set({ tool, selectedIds: [] }),

  addElement: (element) =>
    set((state) => ({ elements: [...state.elements, element] })),

  updateElement: (id, changes) =>
    set((state) => ({
      elements: state.elements.map((el) => (el.id === id ? { ...el, ...changes } : el)),
    })),

  deleteElement: (id) =>
    set((state) => ({
      elements: state.elements.map((el) => (el.id === id ? { ...el, isDeleted: true } : el)),
    })),

  deleteSelected: () => {
    const { selectedIds, elements } = get();
    if (!selectedIds.length) return;
    set({
      elements: elements.map((el) =>
        selectedIds.includes(el.id) ? { ...el, isDeleted: true } : el
      ),
      selectedIds: [],
    });
  },

  setSelectedIds: (ids) => set({ selectedIds: ids }),

  setZoom: (zoom) => set({ zoom: Math.min(5, Math.max(0.1, zoom)) }),

  setScroll: (x, y) => set({ scrollX: x, scrollY: y }),

  setStrokeColor: (strokeColor) => set({ strokeColor }),
  setBackgroundColor: (backgroundColor) => set({ backgroundColor }),
  setFillStyle: (fillStyle) => set({ fillStyle }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
  setStrokeStyle: (strokeStyle) => set({ strokeStyle }),
  setRoughness: (roughness) => set({ roughness }),
  setOpacity: (opacity) => set({ opacity }),

  pushHistory: () => {
    const { elements, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(deepClone(elements));
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    set({ elements: deepClone(history[newIndex]), historyIndex: newIndex, selectedIds: [] });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    set({ elements: deepClone(history[newIndex]), historyIndex: newIndex, selectedIds: [] });
  },

  clearCanvas: () => {
    const { pushHistory } = get();
    pushHistory();
    set({ elements: [], selectedIds: [] });
  },

  // Clipboard
  clipboard: [],
  setClipboard: (elements) => set({ clipboard: elements }),
}));
