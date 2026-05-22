import { useState, useEffect } from 'react';
import { X, Check, Zap } from 'lucide-react';
import styles from './CodeGenModal.module.css';

export default function CodeGenModal({ isOpen, onClose }) {
  const [phase, setPhase] = useState('generating'); // 'generating' | 'done'

  useEffect(() => {
    if (!isOpen) {
      setPhase('generating');
      return;
    }
    const timer = setTimeout(() => {
      setPhase('done');
    }, 3000);
    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className={styles.backdrop} onClick={onClose} />

      {/* Modal */}
      <div className={styles.modal}>
        <div className={styles.topGlow} />

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.aiIcon}>
              <Zap size={16} />
            </div>
            <div>
              <h2 className={styles.title}>Generate Code</h2>
              <p className={styles.subtitle}>
                {phase === 'generating' ? 'AI is generating your code...' : 'Done!'}
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {phase === 'generating' ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <p>Analyzing your architecture...</p>
            </div>
          ) : (
            <div className={styles.doneState}>
              <div className={styles.checkmark}>
                <Check size={32} />
              </div>
              <p>Your code is ready!</p>
              <button className="btn btn-primary" onClick={onClose}>
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
