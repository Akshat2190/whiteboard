import React, { memo } from 'react';
import { useWhiteboardStore } from '../../store/whiteboardStore';

const STROKE_COLORS = [
  '#ffffff', '#000000', '#ef4444', '#22c55e', '#3b82f6',
  '#f59e0b', '#f97316', '#a855f7', '#ec4899', '#14b8a6',
];

const BG_COLORS = [
  'transparent', '#1e1e2e', '#ef4444', '#22c55e', '#3b82f6',
  '#f59e0b', '#f97316', '#a855f7', '#ec4899', '#14b8a6',
];

const FILL_STYLES = [
  { id: 'hachure', label: 'Hachure', icon: '▤' },
  { id: 'solid', label: 'Solid', icon: '■' },
  { id: 'cross-hatch', label: 'Cross', icon: '▦' },
  { id: 'none', label: 'None', icon: '□' },
];

const STROKE_WIDTHS = [
  { value: 1, label: 'Thin' },
  { value: 2, label: 'Medium' },
  { value: 4, label: 'Bold' },
];

const STROKE_STYLES = [
  { id: 'solid', label: '—', preview: 'solid' },
  { id: 'dashed', label: '- -', preview: 'dashed' },
  { id: 'dotted', label: '···', preview: 'dotted' },
];

const ROUGHNESS_LEVELS = [
  { value: 0, label: 'Architect' },
  { value: 1, label: 'Artist' },
  { value: 2, label: 'Cartoonist' },
];

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function ColorSwatch({ color, isSelected, onClick, isTransparent }) {
  return (
    <button
      onClick={onClick}
      title={color === 'transparent' ? 'Transparent' : color}
      style={{
        width: 22,
        height: 22,
        borderRadius: 4,
        border: isSelected ? '2px solid #6965db' : '1.5px solid rgba(255,255,255,0.15)',
        background: isTransparent
          ? 'repeating-linear-gradient(45deg, #555 0, #555 3px, transparent 3px, transparent 6px)'
          : color,
        cursor: 'pointer',
        flexShrink: 0,
        padding: 0,
        outline: isSelected ? '1px solid #fff' : 'none',
        outlineOffset: 1,
        boxSizing: 'border-box',
      }}
    />
  );
}

function OptionButton({ isActive, onClick, children, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        flex: 1,
        padding: '5px 4px',
        borderRadius: 5,
        border: isActive ? '1.5px solid #6965db' : '1.5px solid rgba(255,255,255,0.1)',
        background: isActive ? 'rgba(105,101,219,0.2)' : 'rgba(255,255,255,0.04)',
        color: isActive ? '#c4c2ff' : 'rgba(255,255,255,0.7)',
        cursor: 'pointer',
        fontSize: 11,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        transition: 'all 0.12s',
      }}
    >
      {children}
    </button>
  );
}

const PropertiesPanel = memo(function PropertiesPanel({ visible }) {
  const {
    selectedIds, elements,
    strokeColor, setStrokeColor,
    backgroundColor, setBackgroundColor,
    fillStyle, setFillStyle,
    strokeWidth, setStrokeWidth,
    strokeStyle, setStrokeStyle,
    roughness, setRoughness,
    opacity, setOpacity,
    updateElement, tool,
  } = useWhiteboardStore();

  if (!visible) return null;

  // Determine if panel should show fill options
  const selectedEls = elements.filter((el) => selectedIds.includes(el.id));
  const hasFillable = selectedEls.some((el) => ['rectangle', 'ellipse', 'diamond'].includes(el.type));
  const showFill = hasFillable || ['rectangle', 'ellipse', 'diamond'].includes(tool);

  // Update selected elements when style changes
  const updateSelected = (changes) => {
    selectedIds.forEach((id) => updateElement(id, changes));
  };

  return (
    <div style={{
      position: 'fixed',
      right: 12,
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 100,
      background: '#232329',
      borderRadius: 8,
      padding: '14px 12px',
      width: 200,
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      border: '1px solid rgba(255,255,255,0.08)',
      fontFamily: 'Inter, sans-serif',
      maxHeight: 'calc(100vh - 120px)',
      overflowY: 'auto',
    }}>
      {/* Stroke Color */}
      <Section title="Stroke">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
          {STROKE_COLORS.map((c) => (
            <ColorSwatch
              key={c}
              color={c}
              isSelected={strokeColor === c}
              onClick={() => { setStrokeColor(c); updateSelected({ strokeColor: c }); }}
            />
          ))}
        </div>
        <input
          type="color"
          value={strokeColor === 'transparent' ? '#ffffff' : strokeColor}
          onChange={(e) => { setStrokeColor(e.target.value); updateSelected({ strokeColor: e.target.value }); }}
          style={{ width: '100%', height: 26, borderRadius: 4, border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', background: 'none', padding: 0 }}
        />
      </Section>

      {/* Background Color */}
      <Section title="Background">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {BG_COLORS.map((c) => (
            <ColorSwatch
              key={c}
              color={c}
              isSelected={backgroundColor === c}
              isTransparent={c === 'transparent'}
              onClick={() => { setBackgroundColor(c); updateSelected({ backgroundColor: c }); }}
            />
          ))}
        </div>
      </Section>

      {/* Fill Style */}
      {showFill && (
        <Section title="Fill">
          <div style={{ display: 'flex', gap: 4 }}>
            {FILL_STYLES.map((f) => (
              <OptionButton
                key={f.id}
                isActive={fillStyle === f.id}
                onClick={() => { setFillStyle(f.id); updateSelected({ fillStyle: f.id }); }}
                title={f.label}
              >
                <span style={{ fontSize: 13 }}>{f.icon}</span>
              </OptionButton>
            ))}
          </div>
        </Section>
      )}

      {/* Stroke Width */}
      <Section title="Stroke Width">
        <div style={{ display: 'flex', gap: 4 }}>
          {STROKE_WIDTHS.map((w) => (
            <OptionButton
              key={w.value}
              isActive={strokeWidth === w.value}
              onClick={() => { setStrokeWidth(w.value); updateSelected({ strokeWidth: w.value }); }}
              title={w.label}
            >
              <div style={{ width: 20, height: w.value, background: 'currentColor', borderRadius: 2 }} />
            </OptionButton>
          ))}
        </div>
      </Section>

      {/* Stroke Style */}
      <Section title="Stroke Style">
        <div style={{ display: 'flex', gap: 4 }}>
          {STROKE_STYLES.map((s) => (
            <OptionButton
              key={s.id}
              isActive={strokeStyle === s.id}
              onClick={() => { setStrokeStyle(s.id); updateSelected({ strokeStyle: s.id }); }}
              title={s.id}
            >
              <span style={{ fontSize: 12, letterSpacing: s.id === 'dotted' ? 2 : 0 }}>{s.label}</span>
            </OptionButton>
          ))}
        </div>
      </Section>

      {/* Roughness */}
      <Section title="Roughness">
        <div style={{ display: 'flex', gap: 4 }}>
          {ROUGHNESS_LEVELS.map((r) => (
            <OptionButton
              key={r.value}
              isActive={roughness === r.value}
              onClick={() => { setRoughness(r.value); updateSelected({ roughness: r.value }); }}
              title={r.label}
            >
              <span style={{ fontSize: 9 }}>{r.label.slice(0, 4)}</span>
            </OptionButton>
          ))}
        </div>
      </Section>

      {/* Opacity */}
      <Section title={`Opacity — ${opacity}%`}>
        <input
          type="range"
          min={10}
          max={100}
          value={opacity}
          onChange={(e) => {
            const v = Number(e.target.value);
            setOpacity(v);
            updateSelected({ opacity: v });
          }}
          style={{ width: '100%', accentColor: '#6965db' }}
        />
      </Section>
    </div>
  );
});

export default PropertiesPanel;
