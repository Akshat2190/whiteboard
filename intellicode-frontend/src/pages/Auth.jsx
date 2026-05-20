import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Zap, ArrowRight } from 'lucide-react';
import StarField from '../components/StarField';
import styles from './Auth.module.css';

const inputVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.4, 0, 0.2, 1] }
  }),
};

const cardVariants = {
  login: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } },
  signup: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } },
};

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate('/dashboard');
    }, 1500);
  };

  const toggle = () => {
    setMode(m => m === 'login' ? 'signup' : 'login');
    setForm({ name: '', email: '', password: '' });
  };

  return (
    <div className={styles.page}>
      <StarField count={100} />

      {/* Ambient orbs */}
      <div className={styles.orbLeft} />
      <div className={styles.orbRight} />

      {/* Logo */}
      <motion.div
        className={styles.logoBar}
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        onClick={() => navigate('/')}
      >
        <div className={styles.logoIcon}><Zap size={16} /></div>
        <span className={styles.logoText}>IntelliCode</span>
      </motion.div>

      {/* Auth Card */}
      <div className={styles.center}>
        <motion.div
          className={styles.card}
          key={mode}
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Card glow top line */}
          <div className={styles.cardTopGlow} />

          {/* Header */}
          <div className={styles.cardHeader}>
            <motion.h1
              className={styles.cardTitle}
              key={mode + '-title'}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </motion.h1>
            <p className={styles.cardSub}>
              {mode === 'login'
                ? 'Sign in to continue building with AI'
                : 'Start generating code from diagrams'}
            </p>
          </div>

          {/* Toggle pills */}
          <div className={styles.toggleRow}>
            <div className={styles.toggleTrack}>
              <motion.div
                className={styles.toggleThumb}
                animate={{ x: mode === 'login' ? 0 : '100%' }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
              <button
                className={`${styles.toggleBtn} ${mode === 'login' ? styles.active : ''}`}
                onClick={() => setMode('login')}
                id="auth-login-tab"
              >
                Sign In
              </button>
              <button
                className={`${styles.toggleBtn} ${mode === 'signup' ? styles.active : ''}`}
                onClick={() => setMode('signup')}
                id="auth-signup-tab"
              >
                Sign Up
              </button>
            </div>
          </div>

          {/* Google OAuth */}
          <motion.button
            className={styles.googleBtn}
            whileHover={{ scale: 1.02, borderColor: 'rgba(255,255,255,0.2)' }}
            whileTap={{ scale: 0.98 }}
            id="auth-google"
            type="button"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Continue with Google</span>
          </motion.button>

          {/* Divider */}
          <div className={styles.divider}>
            <div className={styles.dividerLine} />
            <span className={styles.dividerText}>or</span>
            <div className={styles.dividerLine} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className={styles.form}>
            <AnimatePresence>
              {mode === 'signup' && (
                <motion.div
                  className={styles.fieldWrap}
                  custom={0}
                  variants={inputVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                >
                  <label className={styles.label} htmlFor="auth-name">Full name</label>
                  <input
                    id="auth-name"
                    type="text"
                    placeholder="Alex Nova"
                    className={`input-field ${styles.input}`}
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required={mode === 'signup'}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              className={styles.fieldWrap}
              custom={1}
              variants={inputVariants}
              initial="hidden"
              animate="visible"
            >
              <label className={styles.label} htmlFor="auth-email">Email address</label>
              <input
                id="auth-email"
                type="email"
                placeholder="you@company.dev"
                className={`input-field ${styles.input}`}
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
              />
            </motion.div>

            <motion.div
              className={styles.fieldWrap}
              custom={2}
              variants={inputVariants}
              initial="hidden"
              animate="visible"
            >
              <div className={styles.labelRow}>
                <label className={styles.label} htmlFor="auth-password">Password</label>
                {mode === 'login' && (
                  <a href="#" className={styles.forgotLink}>Forgot password?</a>
                )}
              </div>
              <div className={styles.pwWrap}>
                <input
                  id="auth-password"
                  type={showPw ? 'text' : 'password'}
                  placeholder={mode === 'signup' ? 'Min. 8 characters' : '••••••••'}
                  className={`input-field ${styles.input} ${styles.pwInput}`}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  className={styles.pwToggle}
                  onClick={() => setShowPw(v => !v)}
                  aria-label="Toggle password visibility"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </motion.div>

            {/* Submit */}
            <motion.button
              id="auth-submit"
              type="submit"
              className={`btn btn-primary ${styles.submitBtn}`}
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              custom={3}
              variants={inputVariants}
              initial="hidden"
              animate="visible"
            >
              {loading ? (
                <div className={styles.spinner} />
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </motion.button>
          </form>

          {/* Switch mode link */}
          <p className={styles.switchText}>
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
            {' '}
            <button className={styles.switchBtn} onClick={toggle} type="button">
              {mode === 'login' ? 'Sign up free' : 'Sign in'}
            </button>
          </p>

          {/* Terms */}
          {mode === 'signup' && (
            <p className={styles.termsText}>
              By creating an account you agree to our{' '}
              <a href="#">Terms of Service</a> and{' '}
              <a href="#">Privacy Policy</a>.
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
