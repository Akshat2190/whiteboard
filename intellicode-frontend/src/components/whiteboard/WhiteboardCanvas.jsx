import { useRef } from 'react';
import { motion } from 'framer-motion';
import styles from './WhiteboardCanvas.module.css';

const COLORS = ['#7B61FF', '#00FFD1', '#FF5CA8', '#FFC72C', '#4EC5FF'];

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
  const canvasRef = useRef(null);

  const handleNodeClick = (node) => {
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
  };

  const handleNodeDoubleClick = (node) => {
    if (activeTool !== 'text') return;
    const nextLabel = prompt('Edit node text', node.label);
    if (nextLabel === null) return;
    onLabelChange(node.id, nextLabel);
  };

  return (
    <div className={styles.canvasOuter} ref={canvasRef}>
      <div className={styles.canvasGrid}>
        {!nodes.length && (
          <div className={styles.emptyState}>
            No nodes yet. Use the toolbar to add and edit shapes.
          </div>
        )}
        {nodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const nodeStyles = {
            left: node.x,
            top: node.y,
            width: node.w,
            height: node.h,
            background: `${node.color}20`,
            borderColor: `${node.color}60`,
          };

          return (
            <motion.div
              key={node.id}
              className={`${styles.node} ${isSelected ? styles.nodeSelected : ''} ${
                node.type === 'circle'
                  ? styles.nodeCircle
                  : node.type === 'arrow'
                  ? styles.nodeArrow
                  : styles.nodeRect
              }`}
              drag
              dragMomentum={false}
              dragElastic={0.2}
              dragConstraints={canvasRef}
              onDragEnd={(event, info) => onMoveNode(node.id, info.offset)}
              onClick={() => handleNodeClick(node)}
              onDoubleClick={() => handleNodeDoubleClick(node)}
              whileTap={{ scale: 0.98 }}
              style={nodeStyles}
            >
              <span className={styles.nodeLabel}>{node.label}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
