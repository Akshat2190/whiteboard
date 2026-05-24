import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { Zap, ChevronLeft, AlertCircle } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { projectService } from '../services/project.service';
import { generateService } from '../services/generate.service';
import CodeGenModal from '../components/CodeGenModal';
import Whiteboard from '../components/Whiteboard/Whiteboard';
import AirCanvas from '../components/whiteboard/AirCanvas';

export default function Workspace() {
  const navigate = useNavigate();
  const { id: projectId } = useParams();
  const { user } = useAuth();
  const { socket, joinProject } = useSocket();

  const [project, setProject] = useState(null);
  const [showCodeGen, setShowCodeGen] = useState(false);
  const [showHandDraw, setShowHandDraw] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        setLoading(true);
        const projectResponse = await projectService.getProject(projectId);
        setProject(projectResponse.project);
        setError('');
      } catch (err) {
        console.error('Workspace load failed:', err);
        setError(err.message || 'Failed to load workspace');
      } finally {
        setLoading(false);
      }
    };

    if (projectId) loadWorkspace();
  }, [projectId]);

  useEffect(() => {
    if (socket && projectId) {
      joinProject(projectId);
    }
  }, [socket, projectId, joinProject]);

  // Called by Whiteboard's built-in "Generate Code" button.
  // Now opens the hand-draw canvas instead of calling the API directly.
  const handleGenerateCode = useCallback((_elements) => {
    setShowHandDraw(true);
  }, []);

  // Called by HandDrawCanvas once the user clicks "Analyze & Generate".
  // Receives the canvas PNG as a base64 data URL.
  const handleHandDrawConfirm = useCallback(async (imageDataUrl) => {
    setShowHandDraw(false);
    setGenerating(true);
    setShowCodeGen(true);
    setError('');
    try {
      await generateService.generateCode(projectId, [
        { type: 'handDrawing', imageData: imageDataUrl },
      ]);
    } catch (err) {
      console.error('Generate code failed:', err);
      setError(err.message || 'Code generation failed');
    } finally {
      setGenerating(false);
    }
  }, [projectId]);

  if (loading) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#121212', color: '#fff', gap: 16, fontFamily: 'Inter, sans-serif' }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
          <Zap size={32} color="#6965db" />
        </motion.div>
        <p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading workspace...</p>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#121212', color: '#fff', gap: 16, fontFamily: 'Inter, sans-serif' }}>
        <AlertCircle size={36} color="#ef4444" />
        <p style={{ color: 'rgba(255,255,255,0.7)' }}>{error}</p>
        <button
          onClick={() => navigate('/dashboard')}
          style={{ background: '#6965db', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* Thin top bar for back navigation */}
      <div style={{
        position: 'fixed',
        top: 12,
        left: 12,
        zIndex: 150,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <button
          onClick={() => navigate('/dashboard')}
          title="Back to Dashboard"
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.12)',
            background: '#232329',
            color: 'rgba(255,255,255,0.8)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <ChevronLeft size={18} />
        </button>
        {project && (
          <div style={{
            background: '#232329',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            padding: '6px 12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#fff', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {project.name}
            </p>
          </div>
        )}
      </div>

      {/* Full-screen Whiteboard */}
      <Whiteboard
        projectId={projectId}
        onGenerateCode={handleGenerateCode}
      />

      {/* Air canvas — webcam + hand tracking, opens when user clicks Generate Code */}
      {showHandDraw && (
        <AirCanvas
          onClose={() => setShowHandDraw(false)}
        />
      )}

      {/* Code gen progress modal */}
      {showCodeGen && (
        <CodeGenModal isOpen onClose={() => setShowCodeGen(false)} />
      )}
    </div>
  );
}
