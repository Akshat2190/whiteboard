import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Zap, Download, ExternalLink, FileCode, ChevronRight } from 'lucide-react';
import styles from './CodeGenModal.module.css';

const STEPS = [
  { id: 'read', label: 'Reading diagram', detail: 'Parsing nodes and relationships...' },
  { id: 'analyze', label: 'Analyzing architecture', detail: 'Inferring patterns and dependencies...' },
  { id: 'generate', label: 'Generating code', detail: 'Writing boilerplate for each component...' },
  { id: 'done', label: 'Done!', detail: 'Your code is ready to use.' },
];

const GENERATED_FILES = [
  { name: 'src/services/UserService.ts', size: '2.4 KB', lang: 'TypeScript' },
  { name: 'src/controllers/AuthController.ts', size: '3.1 KB', lang: 'TypeScript' },
  { name: 'src/models/User.ts', size: '1.8 KB', lang: 'TypeScript' },
  { name: 'src/middleware/auth.ts', size: '1.2 KB', lang: 'TypeScript' },
  { name: 'src/routes/index.ts', size: '0.9 KB', lang: 'TypeScript' },
  { name: 'prisma/schema.prisma', size: '2.6 KB', lang: 'Prisma' },
  { name: 'docker-compose.yml', size: '0.7 KB', lang: 'YAML' },
  { name: 'package.json', size: '1.1 KB', lang: 'JSON' },
];

const LANG_COLORS = {
  TypeScript: '#3178C6',
  Prisma: '#5A67D8',
  YAML: '#CB171E',
  JSON: '#F5A623',
};

export default function CodeGenModal({ isOpen, onClose, onOpenEditor }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [phase, setPhase] = useState('thinking'); // 'thinking' | 'done'
  const [selectedFiles, setSelectedFiles] = useState(new Set(GENERATED_FILES.map(f => f.name)));
  const [scanPos, setScanPos] = useState(0);

  // Animate through steps
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      setPhase('thinking');
      return;
    }
    let step = 0;
    const durations = [1200, 1400, 1600, 0];
    const tick = () => {
      if (step < STEPS.length - 1) {
        step++;
        setCurrentStep(step);
        if (step === STEPS.length - 1) {
          setPhase('done');
        } else {
          setTimeout(tick, durations[step]);
        }
      }
    };
    const t = setTimeout(tick, durations[0]);
    return () => clearTimeout(t);
  }, [isOpen]);

  // Scan line animation
  useEffect(() => {
    if (phase !== 'thinking') return;
    const interval = setInterval(() => {
      setScanPos(p => (p + 1) % 100);
    }, 30);
    return () => clearInterval(interval);
  }, [phase]);

  const toggleFile = (name) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedFiles.size === GENERATED_FILES.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(GENERATED_FILES.map(f => f.name)));
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className={styles.modal}
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            role="dialog"
            aria-modal="true"
            aria-label="Code generation modal"
          >
            {/* Top glow */}
            <div className={styles.topGlow} />

            {/* Header */}
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                <div className={styles.aiIcon}>
                  <Zap size={16} />
                </div>
                <div>
                  <h2 className={styles.title}>Generate Code</h2>
                  <p className={styles.subtitle}>AI is analyzing your architecture diagram</p>
                </div>
              </div>
              <button className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
                <X size={18} />
              </button>
            </div>

            {/* Diagram preview with scan */}
            <div className={styles.scanArea}>
              {/* Diagram nodes */}
              <div className={styles.diagramPreview}>
                {[
                  { label: 'Client', x: '5%', y: '40%', color: '#00FFD1' },
                  { label: 'API Gateway', x: '28%', y: '20%', color: '#7B61FF' },
                  { label: 'Auth', x: '28%', y: '60%', color: '#FF61DC' },
                  { label: 'User Service', x: '55%', y: '15%', color: '#00FFD1' },
                  { label: 'DB', x: '78%', y: '25%', color: '#FFB800' },
                  { label: 'Cache', x: '78%', y: '60%', color: '#00C6FF' },
                ].map(({ label, x, y, color }) => (
                  <div
                    key={label}
                    className={styles.diagramNode}
                    style={{
                      left: x, top: y,
                      transform: 'translate(-50%, -50%)',
                      borderColor: `${color}60`,
                      background: `${color}10`,
                      color,
                      boxShadow: phase === 'done' ? `0 0 12px ${color}40` : 'none',
                    }}
                  >
                    {label}
                  </div>
                ))}

                {/* SVG connector lines */}
                <svg className={styles.connectorSvg} viewBox="0 0 400 120" preserveAspectRatio="none">
                  {[
                    { x1: 30, y1: 52, x2: 122, y2: 32 },
                    { x1: 30, y1: 52, x2: 122, y2: 72 },
                    { x1: 137, y1: 32, x2: 225, y2: 22 },
                    { x1: 225, y1: 22, x2: 315, y2: 32 },
                    { x1: 225, y1: 22, x2: 315, y2: 72 },
                  ].map((line, i) => (
                    <motion.line
                      key={i}
                      {...line}
                      stroke="rgba(255,255,255,0.15)"
                      strokeWidth="1"
                      strokeDasharray="4 3"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ delay: i * 0.1, duration: 0.5 }}
                    />
                  ))}
                </svg>

                {/* Scan line */}
                {phase === 'thinking' && (
                  <motion.div
                    className={styles.scanLine}
                    animate={{ left: ['0%', '100%', '0%'] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                  />
                )}

                {/* Done overlay glow */}
                {phase === 'done' && (
                  <motion.div
                    className={styles.doneGlow}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                  />
                )}
              </div>

              {/* Status label */}
              <div className={styles.statusBar}>
                {phase === 'thinking' ? (
                  <motion.div
                    className={styles.thinkingDots}
                    key="thinking"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <span className={styles.dot} />
                    <span className={styles.dot} style={{ animationDelay: '0.2s' }} />
                    <span className={styles.dot} style={{ animationDelay: '0.4s' }} />
                    <span className={styles.statusText}>{STEPS[currentStep]?.detail}</span>
                  </motion.div>
                ) : (
                  <motion.div
                    className={styles.doneStatus}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <Check size={14} />
                    <span>Analysis complete — {GENERATED_FILES.length} files ready</span>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Progress Steps */}
            <div className={styles.stepsRow}>
              {STEPS.map((step, i) => {
                const done = i < currentStep;
                const active = i === currentStep;
                const pending = i > currentStep;
                return (
                  <div key={step.id} className={styles.stepItem}>
                    <motion.div
                      className={`${styles.stepCircle} ${done ? styles.stepDone : active ? styles.stepActive : styles.stepPending}`}
                      animate={active && phase === 'thinking' ? { scale: [1, 1.15, 1] } : {}}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      {done ? <Check size={12} /> : <span>{i + 1}</span>}
                    </motion.div>
                    <span className={`${styles.stepLabel} ${done ? styles.stepLabelDone : active ? styles.stepLabelActive : ''}`}>
                      {step.label}
                    </span>
                    {i < STEPS.length - 1 && (
                      <div className={`${styles.stepConnector} ${done ? styles.stepConnectorDone : ''}`} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* File List */}
            <AnimatePresence>
              {phase === 'done' && (
                <motion.div
                  className={styles.filesSection}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.4 }}
                >
                  <div className={styles.filesHeader}>
                    <span className={styles.filesTitle}>Generated Files</span>
                    <button className={styles.selectAllBtn} onClick={toggleAll}>
                      {selectedFiles.size === GENERATED_FILES.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className={styles.filesList}>
                    {GENERATED_FILES.map((file, i) => (
                      <motion.div
                        key={file.name}
                        className={`${styles.fileRow} ${selectedFiles.has(file.name) ? styles.fileRowSelected : ''}`}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        onClick={() => toggleFile(file.name)}
                      >
                        <div className={`${styles.checkbox} ${selectedFiles.has(file.name) ? styles.checkboxChecked : ''}`}>
                          {selectedFiles.has(file.name) && <Check size={10} />}
                        </div>
                        <FileCode size={14} className={styles.fileIcon} />
                        <span className={styles.fileName}>{file.name}</span>
                        <span
                          className={styles.fileLang}
                          style={{
                            color: LANG_COLORS[file.lang] || 'var(--text-muted)',
                            borderColor: `${LANG_COLORS[file.lang] || '#666'}40`,
                          }}
                        >
                          {file.lang}
                        </span>
                        <span className={styles.fileSize}>{file.size}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions */}
            <div className={styles.actions}>
              {phase === 'done' ? (
                <>
                  <motion.button
                    className={`btn btn-ghost ${styles.actionBtn}`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Download size={15} />
                    Download ZIP
                  </motion.button>
                  <motion.button
                    id="modal-open-editor"
                    className={`btn btn-primary ${styles.actionBtnPrimary} pulse-btn`}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { onClose(); onOpenEditor && onOpenEditor(); }}
                  >
                    <ExternalLink size={15} />
                    Open in Editor
                    <ChevronRight size={14} />
                  </motion.button>
                </>
              ) : (
                <button className={`btn btn-ghost ${styles.cancelBtn}`} onClick={onClose}>
                  Cancel
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
