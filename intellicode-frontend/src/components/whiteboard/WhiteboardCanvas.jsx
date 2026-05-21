import { useRef } from 'react';
import styles from './WhiteboardCanvas.module.css';

function WhiteboardNode({ node, isSelected, activeTool, onSelectNode, onDeleteNode, onColorNode, onLabelChange, onMoveNode }) {
  const dragging = useRef(false);
  const startMouse = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });

  const handleMouseDown = (event) => {
    if (event.button !== 0) return;

    if (activeTool === 'eraser') {
      onDeleteNode(node.id);
      return;
    }

    if (activeTool === 'color') {
      onColorNode(node.id);
      onSelectNode(node.id);
      return;
    }

    onSelectNode(node.id);
    dragging.current = true;
    startMouse.current = { x: event.clientX, y: event.clientY };
    startPos.current = { x: node.x, y: node.y };

    const handleMouseMove = (moveEvent) => {
      if (!dragging.current) return;

      const dx = moveEvent.clientX - startMouse.current.x;
      const dy = moveEvent.clientY - startMouse.current.y;

      onMoveNode(node.id, {
        x: Math.max(0, startPos.current.x + dx),
        y: Math.max(0, startPos.current.y + dy),
      });
    };

    const handleMouseUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    event.preventDefault();
  };

  const handleDoubleClick = () => {
    if (activeTool !== 'text') return;
    const nextLabel = prompt('Edit node text', node.label);
    if (nextLabel !== null) onLabelChange(node.id, nextLabel);
  };

  return (
    <div
      className={`${styles.node} ${isSelected ? styles.nodeSelected : ''} ${
        node.type === 'circle'
          ? styles.nodeCircle
          : node.type === 'arrow'
          ? styles.nodeArrow
          : styles.nodeRect
      }`}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      style={{
        left: node.x,
        top: node.y,
        width: node.w,
        height: node.h,
        background: `${node.color}20`,
        borderColor: `${node.color}60`,
        cursor: 'grab',
        userSelect: 'none',
      }}
    >
      <span className={styles.nodeLabel}>{node.label}</span>
    </div>
  );
}

export default function WhiteboardCanvas({
  nodes,
  activeTool,
  selectedNodeId,
  onSelectNode,
  onMoveNode,
  onDeleteNode,
  onColorNode,
  onLabelChange,
}) {
  return (
    <div className={styles.canvasOuter}>
      <div className={styles.canvasGrid}>
        {!nodes.length && (
          <div className={styles.emptyState}>
            No nodes yet. Use the toolbar to add shapes.
          </div>
        )}
        {nodes.map((node) => (
          <WhiteboardNode
            key={node.id}
            node={node}
            isSelected={selectedNodeId === node.id}
            activeTool={activeTool}
            onSelectNode={onSelectNode}
            onDeleteNode={onDeleteNode}
            onColorNode={onColorNode}
            onLabelChange={onLabelChange}
            onMoveNode={onMoveNode}
          />
        ))}
      </div>
    </div>
  );
}
