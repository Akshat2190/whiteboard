import React, { memo } from 'react';

const UndoRedo = memo(function UndoRedo({ onUndo, onRedo, canUndo, canRedo }) {
  const btnStyle = (active) => ({
    width: 32,
    height: 32,
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    color: active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)',
    cursor: active ? 'pointer' : 'not-allowed',
    fontSize: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.12s, color 0.12s',
  });

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      background: '#232329',
      borderRadius: 8,
      padding: '3px 4px',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
    }}>
      <button
        style={btnStyle(canUndo)}
        onClick={canUndo ? onUndo : undefined}
        title="Undo (Ctrl+Z)"
        onMouseEnter={(e) => { if (canUndo) e.currentTarget.style.background = '#3d3d4a'; }}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        ↩
      </button>
      <button
        style={btnStyle(canRedo)}
        onClick={canRedo ? onRedo : undefined}
        title="Redo (Ctrl+Shift+Z)"
        onMouseEnter={(e) => { if (canRedo) e.currentTarget.style.background = '#3d3d4a'; }}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        ↪
      </button>
    </div>
  );
});

export default UndoRedo;
