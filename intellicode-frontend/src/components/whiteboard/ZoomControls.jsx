import React, { memo } from 'react';
import { useWhiteboardStore } from '../../store/whiteboardStore';

const ZoomControls = memo(function ZoomControls() {
  const { zoom, setZoom, setScroll } = useWhiteboardStore();
  const pct = Math.round(zoom * 100);

  const btnStyle = {
    width: 28,
    height: 28,
    borderRadius: 5,
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.75)',
    cursor: 'pointer',
    fontSize: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.12s',
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      background: '#232329',
      borderRadius: 8,
      padding: '3px 6px',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
    }}>
      <button
        style={btnStyle}
        onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}
        title="Zoom out (Ctrl+-)"
        onMouseEnter={(e) => e.currentTarget.style.background = '#3d3d4a'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >−</button>

      <button
        style={{ ...btnStyle, width: 52, fontSize: 12, fontFamily: 'Inter, monospace', color: 'rgba(255,255,255,0.85)' }}
        onClick={() => { setZoom(1); setScroll(0, 0); }}
        title="Reset zoom (Ctrl+0)"
        onMouseEnter={(e) => e.currentTarget.style.background = '#3d3d4a'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        {pct}%
      </button>

      <button
        style={btnStyle}
        onClick={() => setZoom(Math.min(5, zoom + 0.1))}
        title="Zoom in (Ctrl+=)"
        onMouseEnter={(e) => e.currentTarget.style.background = '#3d3d4a'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >+</button>
    </div>
  );
});

export default ZoomControls;
