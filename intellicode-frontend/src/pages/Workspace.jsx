import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
  MousePointer2,
  Square,
  Circle,
  ArrowRight,
  Type,
  Eraser,
  Palette,
  Zap,
  ChevronLeft,
  Plus,
  AlertCircle,
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { projectService } from '../services/project.service';
import { generateService } from '../services/generate.service';
import CodeGenModal from '../components/CodeGenModal';
import WhiteboardCanvas from '../components/whiteboard/WhiteboardCanvas';
import styles from './Workspace.module.css';

const TOOLBAR_TOOLS = [
  { id: 'select', icon: MousePointer2, label: 'Select' },
  { id: 'rect', icon: Square, label: 'Rectangle' },
  { id: 'circle', icon: Circle, label: 'Circle' },
  { id: 'arrow', icon: ArrowRight, label: 'Arrow' },
  { id: 'text', icon: Type, label: 'Text' },
  { id: 'eraser', icon: Eraser, label: 'Eraser' },
  { id: 'color', icon: Palette, label: 'Color' },
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function Workspace() {
  const navigate = useNavigate();
  const { id: projectId } = useParams();
  const { user } = useAuth();
  const { socket, joinProject, emitWhiteboardSync, onlineUsers } = useSocket();

  const [project, setProject] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [activeTool, setActiveTool] = useState('select');
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [showCodeGen, setShowCodeGen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const whiteboardSaveTimeout = useRef(null);
  const pendingWhiteboardState = useRef([]);

  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        setLoading(true);
        const [projectResponse, whiteboardResponse] = await Promise.all([
          projectService.getProject(projectId),
          projectService.getWhiteboard(projectId).catch(() => ({ whiteboardState: [] })),
        ]);

        setProject(projectResponse.project);
        setNodes(Array.isArray(whiteboardResponse.whiteboardState) ? whiteboardResponse.whiteboardState : []);
        setError('');
      } catch (err) {
        console.error('Workspace load failed:', err);
        setError(err.message || 'Failed to load workspace');
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      loadWorkspace();
    }
  }, [projectId]);

  useEffect(() => {
    if (socket && projectId) {
      joinProject(projectId);
    }
  }, [socket, projectId, joinProject]);

  useEffect(() => {
    if (!socket) return;

    const handleWhiteboardMessage = (data) => {
      const next = data?.object || data?.state;
      if (!Array.isArray(next)) return;
      setNodes(next);
    };

    socket.on('whiteboard:draw', handleWhiteboardMessage);
    socket.on('whiteboard:sync', handleWhiteboardMessage);

    return () => {
      socket.off('whiteboard:draw', handleWhiteboardMessage);
      socket.off('whiteboard:sync', handleWhiteboardMessage);
    };
  }, [socket]);

  const flushWhiteboardState = useCallback(
    (state = pendingWhiteboardState.current) => {
      if (!Array.isArray(state)) return;

      if (whiteboardSaveTimeout.current) {
        clearTimeout(whiteboardSaveTimeout.current);
        whiteboardSaveTimeout.current = null;
      }

      if (socket) {
        emitWhiteboardSync(projectId, state);
      }

      projectService.saveWhiteboard(projectId, state).catch((err) => {
        console.error('Error saving whiteboard:', err);
      });
    },
    [emitWhiteboardSync, projectId, socket]
  );

  const scheduleWhiteboardSave = useCallback(
    (state) => {
      pendingWhiteboardState.current = state;

      if (whiteboardSaveTimeout.current) {
        clearTimeout(whiteboardSaveTimeout.current);
      }

      whiteboardSaveTimeout.current = setTimeout(() => {
        flushWhiteboardState(state);
      }, 2000);
    },
    [flushWhiteboardState]
  );

  useEffect(() => {
    const handlePageExit = () => {
      flushWhiteboardState();
    };

    window.addEventListener('beforeunload', handlePageExit);
    window.addEventListener('pagehide', handlePageExit);

    return () => {
      window.removeEventListener('beforeunload', handlePageExit);
      window.removeEventListener('pagehide', handlePageExit);
      flushWhiteboardState();
    };
  }, [flushWhiteboardState]);

  const updateNodes = (updater) => {
    setNodes((prevNodes) => {
      const updatedNodes = typeof updater === 'function' ? updater(prevNodes) : updater;
      if (!Array.isArray(updatedNodes)) {
        return prevNodes;
      }
      scheduleWhiteboardSave(updatedNodes);
      return updatedNodes;
    });
  };

  const createNewNode = () => {
    const shapeType = ['rect', 'circle', 'arrow'].includes(activeTool) ? activeTool : 'rect';
    return {
      id: Date.now().toString(),
      x: 80,
      y: 80,
      w: 140,
      h: 60,
      label: 'New node',
      color: '#7B61FF',
      type: shapeType,
    };
  };

  const handleAddNode = () => {
    const newNode = createNewNode();
    updateNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
  };

  const handleMoveNode = (nodeId, position) => {
    updateNodes((prevNodes) =>
      prevNodes.map((node) => {
        if (node.id !== nodeId) return node;
        return {
          ...node,
          x: clamp(position.x, 0, 1000),
          y: clamp(position.y, 0, 1000),
        };
      })
    );
  };

  const handleDeleteNode = (nodeId) => {
    updateNodes((prev) => prev.filter((item) => item.id !== nodeId));
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  };

  const handleColorNode = (nodeId) => {
    const colors = ['#7B61FF', '#00FFD1', '#FF5CA8', '#FFC72C', '#4EC5FF'];
    updateNodes((prev) =>
      prev.map((item) =>
        item.id === nodeId
          ? { ...item, color: colors[(colors.indexOf(item.color) + 1) % colors.length] }
          : item
      )
    );
  };

  const handleLabelChange = (nodeId, label) => {
    updateNodes((prev) => prev.map((item) => (item.id === nodeId ? { ...item, label } : item)));
  };

  const handleSelectNode = (nodeId) => {
    setSelectedNodeId(nodeId);
  };

  const handleGenerateCode = async () => {
    if (!nodes.length) {
      setError('Add some nodes before generating code.');
      return;
    }

    setGenerating(true);
    setShowCodeGen(true);
    setError('');

    try {
      await generateService.generateCode(projectId, nodes);
    } catch (err) {
      console.error('Generate code failed:', err);
      setError(err.message || 'Code generation failed');
    } finally {
      setGenerating(false);
      setShowCodeGen(false);
    }
  };


  if (loading) {
    return (
      <div className={styles.pageLoader}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }}>
          <Zap size={32} />
        </motion.div>
        <p>Loading workspace...</p>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className={styles.pageError}>
        <AlertCircle size={36} />
        <p>{error}</p>
        <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className={styles.workspacePage}>
      <header className={styles.workspaceHeader}>
        <div className={styles.headerLeft}>
          <button className={styles.backButton} onClick={() => navigate('/dashboard')}>
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1>{project?.name}</h1>
            <p>{project?.description || 'Collaborative design workspace'}</p>
          </div>
        </div>
        <div className={styles.headerRight}>
          <button className="btn btn-primary" onClick={handleGenerateCode} disabled={generating}>
            <Zap size={16} />
            {generating ? 'Generating...' : 'Generate Code'}
          </button>
        </div>
      </header>

      <div className={styles.workspaceBody}>
        <aside className={styles.leftSidebar}>
          <div className={styles.toolbarHeader}>
            <span>Tools</span>
            <button className="btn btn-ghost" onClick={handleAddNode}>
              <Plus size={14} /> Add node
            </button>
          </div>
          <div className={styles.toolbarList}>
            {TOOLBAR_TOOLS.map((tool) => (
              <button
                key={tool.id}
                type="button"
                className={`${styles.toolButton} ${activeTool === tool.id ? styles.toolButtonActive : ''}`}
                onClick={() => setActiveTool(tool.id)}
              >
                <tool.icon size={16} />
                <span>{tool.label}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className={styles.canvasSection}>
          <div className={styles.canvasToolbar}>
            <span className={styles.canvasStatus}>Active tool: {activeTool}</span>
            <span className={styles.collaboratorBadge}>
              {onlineUsers.length || 1} collaborator{onlineUsers.length === 1 ? '' : 's'} online
            </span>
          </div>
          <WhiteboardCanvas
            nodes={nodes}
            activeTool={activeTool}
            selectedNodeId={selectedNodeId}
            onSelectNode={handleSelectNode}
            onMoveNode={handleMoveNode}
            onDeleteNode={handleDeleteNode}
            onColorNode={handleColorNode}
            onLabelChange={handleLabelChange}
          />
        </main>

      </div>

      {showCodeGen && (
        <CodeGenModal isOpen onClose={() => setShowCodeGen(false)} />
      )}
    </div>
  );
}
