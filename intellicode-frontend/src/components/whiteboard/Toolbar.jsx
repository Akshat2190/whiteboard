import React, { memo } from 'react';
import { useWhiteboardStore } from '../../store/whiteboardStore';

const TOOLS = [
  { id: 'hand', icon: '✋', label: 'Hand', shortcut: 'H' },
  { id: 'select', icon: '⬡', label: 'Select', shortcut: 'V', iconType: 'cursor' },
  null, // separator
  { id: 'rectangle', icon: '▭', label: 'Rectangle', shortcut: 'R' },
  { id: 'diamond', icon: '◇', label: 'Diamond', shortcut: 'D' },
  { id: 'ellipse', icon: '○', label: 'Ellipse', shortcut: 'O' },
  { id: 'arrow', icon: '↗', label: 'Arrow', shortcut: 'A' },
  { id: 'line', icon: '—', label: 'Line', shortcut: 'L' },
  { id: 'freedraw', icon: '✏', label: 'Pencil', shortcut: 'P' },
  { id: 'text', icon: 'A', label: 'Text', shortcut: 'T', textIcon: true },
  null, // separator
  { id: 'eraser', icon: '⌫', label: 'Eraser', shortcut: 'E' },
  null, // separator
  { id: 'image', icon: '🖼', label: 'Image', shortcut: 'I', disabled: true, tooltip: 'Coming soon' },
];

// SVG icons for tools that need custom rendering
function CursorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 2l4.5 12 2.5-4 4.5-2.5L2 2z" />
    </svg>
  );
}

function ToolButton({ tool, isActive, onClick }) {
  if (!tool) return <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />;

  return (
    <div style={{ position: 'relative' }} title={tool.tooltip || `${tool.label} (${tool.shortcut})`}>
      <button
        onClick={!tool.disabled ? onClick : undefined}
        style={{
          width: 36,
          height: 36,
          borderRadius: 6,
          border: 'none',
          background: isActive ? '#6965db' : 'transparent',
          color: tool.disabled ? 'rgba(255,255,255,0.3)' : isActive ? '#fff' : 'rgba(255,255,255,0.75)',
          cursor: tool.disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          transition: 'background 0.12s, color 0.12s',
          position: 'relative',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          if (!isActive && !tool.disabled) e.currentTarget.style.background = '#3d3d4a';
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.background = 'transparent';
        }}
      >
        <span style={{
          fontSize: tool.textIcon ? 15 : 16,
          fontWeight: tool.textIcon ? 700 : 400,
          lineHeight: 1,
          fontFamily: tool.textIcon ? 'Inter, sans-serif' : undefined,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {tool.iconType === 'cursor' ? <CursorIcon /> : tool.icon}
        </span>
        <span style={{
          fontSize: 8,
          lineHeight: 1,
          opacity: 0.6,
          fontFamily: 'Inter, monospace',
          letterSpacing: 0,
        }}>
          {tool.shortcut}
        </span>
      </button>
    </div>
  );
}

const Toolbar = memo(function Toolbar() {
  const { tool, setTool } = useWhiteboardStore();

  return (
    <div style={{
      position: 'fixed',
      top: 12,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 100,
      background: '#232329',
      borderRadius: 8,
      boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.06) inset',
      padding: '4px 6px',
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {TOOLS.map((t, i) => (
        <ToolButton
          key={t ? t.id : `sep-${i}`}
          tool={t}
          isActive={t && tool === t.id}
          onClick={() => t && setTool(t.id)}
        />
      ))}
    </div>
  );
});

export default Toolbar;
