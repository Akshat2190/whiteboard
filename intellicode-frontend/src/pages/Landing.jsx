import { useEffect, useRef, useState } from 'react';
import { motion, useAnimation, useInView } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Zap, Users, Code2, GitBranch,
  Layers, Shield, ChevronRight, Play
} from 'lucide-react';
import StarField from '../components/StarField';
import styles from './Landing.module.css';

// === LIVE DIAGRAM ANIMATION ===
const DiagramPreview = () => {
  const [phase, setPhase] = useState(0); // 0=diagram, 1=scanning, 2=code

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase(p => (p + 1) % 3);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const codeLines = [
    'class UserService {',
    '  constructor(private db: Database) {}',
    '  async getUser(id: string) {',
    '    return this.db.find({ id });',
    '  }',
    '}',
  ];

  return (
    <div className={styles.diagramWrap}>
      {/* Diagram nodes */}
      <motion.div
        className={styles.diagramNodes}
        animate={{ opacity: phase === 2 ? 0 : 1, scale: phase === 2 ? 0.95 : 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Node: Client */}
        <motion.div className={`${styles.node} ${styles.nodeClient}`}
          animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
          <Users size={14} />
          <span>Client</span>
        </motion.div>

        {/* Arrow */}
        <div className={styles.arrow}>
          <div className={styles.arrowLine} />
          <ChevronRight size={12} className={styles.arrowHead} />
        </div>

        {/* Node: API */}
        <motion.div className={`${styles.node} ${styles.nodeApi}`}
          animate={{ y: [0, -8, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}>
          <Zap size={14} />
          <span>API</span>
        </motion.div>

        {/* Arrow */}
        <div className={styles.arrow}>
          <div className={styles.arrowLine} />
          <ChevronRight size={12} className={styles.arrowHead} />
        </div>

        {/* Node: DB */}
        <motion.div className={`${styles.node} ${styles.nodeDb}`}
          animate={{ y: [0, -5, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}>
          <Layers size={14} />
          <span>Database</span>
        </motion.div>
      </motion.div>

      {/* Scanning line */}
      {phase === 1 && (
        <motion.div
          className={styles.scanLine}
          initial={{ y: '-100%', opacity: 0 }}
          animate={{ y: ['0%', '100%'], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.8, ease: 'linear' }}
        />
      )}

      {/* Code output */}
      <motion.div
        className={styles.codeOutput}
        animate={{ opacity: phase === 2 ? 1 : 0, y: phase === 2 ? 0 : 10 }}
        transition={{ duration: 0.5 }}
      >
        {codeLines.map((line, i) => (
          <motion.div
            key={i}
            className={styles.codeLine}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: phase === 2 ? 1 : 0, x: phase === 2 ? 0 : -10 }}
            transition={{ delay: i * 0.1 + 0.2 }}
          >
            <span className={styles.lineNum}>{i + 1}</span>
            <span className={styles.lineContent}>{line}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* AI badge */}
      {phase === 1 && (
        <motion.div
          className={styles.aiBadge}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
        >
          <Zap size={10} />
          <span>AI Analyzing...</span>
        </motion.div>
      )}
    </div>
  );
};

// === FEATURE CARD ===
const FeatureCard = ({ icon: Icon, title, desc, color, delay, className }) => {
  return (
    <motion.div
      className={`${styles.featureCard} glass-card ${className || ''}`}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ y: -8, scale: 1.02 }}
      style={{ '--accent': color }}
    >
      <div className={styles.featureIcon} style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
        <Icon size={20} style={{ color }} />
      </div>
      <h3 className={styles.featureTitle}>{title}</h3>
      <p className={styles.featureDesc}>{desc}</p>
    </motion.div>
  );
};

const features = [
  {
    icon: Code2,
    title: 'Instant Code Generation',
    desc: 'Draw your system architecture and watch IntelliCode generate production-ready boilerplate in seconds.',
    color: '#00FFD1',
  },
  {
    icon: Users,
    title: 'Real-time Collaboration',
    desc: 'Multiple engineers can draw and edit simultaneously. See live cursors, selections, and changes.',
    color: '#7B61FF',
  },
  {
    icon: GitBranch,
    title: 'Version Control',
    desc: 'Every diagram state is versioned. Branch, diff, and merge your architecture like code.',
    color: '#FF61DC',
  },
  {
    icon: Layers,
    title: 'Multi-Framework Support',
    desc: 'Generate for React, Next.js, FastAPI, Express, Go, and more. One diagram, many targets.',
    color: '#FFB800',
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    desc: 'SOC2 compliant, end-to-end encrypted, with self-hosted options for sensitive architectures.',
    color: '#00FFD1',
  },
  {
    icon: Zap,
    title: 'AI-Powered Inference',
    desc: 'Our model understands implicit patterns — authentication flows, CRUD, microservices — and generates the right code.',
    color: '#7B61FF',
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const heroRef = useRef(null);

  return (
    <div className={styles.page}>
      <StarField count={150} />

      {/* === NAVBAR === */}
      <motion.nav
        className={styles.nav}
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <div className={styles.navLogo}>
          <div className={styles.navLogoIcon}><Zap size={16} /></div>
          <span>IntelliCode</span>
        </div>
        <div className={styles.navLinks}>
          <button className={styles.navLink}>Features</button>
          <button className={styles.navLink}>Pricing</button>
          <button className={styles.navLink}>Docs</button>
        </div>
        <div className={styles.navActions}>
          <button className="btn btn-ghost" onClick={() => navigate('/auth')}>Sign in</button>
          <motion.button
            className={`btn btn-primary ${styles.navCta}`}
            onClick={() => navigate('/auth')}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            Get Started
          </motion.button>
        </div>
      </motion.nav>

      {/* === HERO === */}
      <section className={styles.hero} ref={heroRef}>
        {/* Ambient glow orbs */}
        <div className={styles.orbCyan} />
        <div className={styles.orbViolet} />

        <div className={styles.heroContent}>
          {/* Badge */}
          <motion.div
            className={styles.heroBadge}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5, type: 'spring' }}
          >
            <span className={styles.badgeDot} />
            <span>Now in Public Beta — Free to start</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            className={styles.heroTitle}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
          >
            Draw.{' '}
            <span className="gradient-text">Think.</span>
            <br />
            Build.
          </motion.h1>

          {/* Subtext */}
          <motion.p
            className={styles.heroSub}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            The AI-powered collaborative whiteboard that transforms your system
            architecture diagrams into production-ready full stack code — instantly.
          </motion.p>

          {/* CTAs */}
          <motion.div
            className={styles.heroCtas}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65, duration: 0.6 }}
          >
            <motion.button
              id="landing-start-building"
              className={`btn btn-primary ${styles.ctaPrimary} pulse-btn`}
              onClick={() => navigate('/auth')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Start Building
              <ArrowRight size={16} />
            </motion.button>
            <motion.button
              className={`btn btn-ghost ${styles.ctaSecondary}`}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <Play size={16} />
              Watch Demo
            </motion.button>
          </motion.div>

          {/* Social proof */}
          <motion.div
            className={styles.socialProof}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
          >
            <div className={styles.avatarStack}>
              {['AN', 'SL', 'RK', 'MJ'].map((init, i) => (
                <div
                  key={i}
                  className={styles.stackAvatar}
                  style={{ background: `hsl(${i * 60 + 160}, 80%, 50%)` }}
                >
                  {init}
                </div>
              ))}
            </div>
            <span className={styles.proofText}>
              <strong>2,400+</strong> engineers building faster
            </span>
          </motion.div>
        </div>

        {/* === HERO PREVIEW === */}
        <motion.div
          className={styles.heroPreview}
          initial={{ opacity: 0, scale: 0.9, rotateX: 8 }}
          animate={{ opacity: 1, scale: 1, rotateX: 0 }}
          transition={{ delay: 0.4, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Browser chrome */}
          <div className={styles.browserChrome}>
            <div className={styles.chromeDots}>
              <span style={{ background: '#FF5F57' }} />
              <span style={{ background: '#FFBD2E' }} />
              <span style={{ background: '#28CA41' }} />
            </div>
            <div className={styles.chromeUrl}>
              <code>intellicode.dev/workspace/arch-v2</code>
            </div>
          </div>

          {/* Preview content */}
          <div className={styles.previewBody}>
            <div className={styles.previewLeft}>
              <div className={styles.previewToolbar}>
                {['▭', '○', '→', 'T', '✏'].map((t, i) => (
                  <div key={i} className={styles.toolbarBtn}>{t}</div>
                ))}
              </div>
              <DiagramPreview />
            </div>
            <div className={styles.previewRight}>
              <div className={styles.fileTabs}>
                <div className={`${styles.fileTab} ${styles.fileTabActive}`}>UserService.ts</div>
                <div className={styles.fileTab}>auth.ts</div>
                <div className={styles.fileTab}>db.ts</div>
              </div>
              <div className={styles.editorArea}>
                {[
                  { kw: 'import', rest: ' { Injectable } from', str: " '@nestjs/common'" },
                  { kw: 'import', rest: ' { DatabaseService } from', str: " './db'" },
                  { kw: '', rest: '', str: '' },
                  { kw: '@Injectable()', rest: '', str: '' },
                  { kw: 'export class', rest: ' UserService {', str: '' },
                  { kw: '  constructor', rest: '(', str: '' },
                  { kw: '    private', rest: ' db: DatabaseService', str: '' },
                  { kw: '  ) {}', rest: '', str: '' },
                ].map((line, i) => (
                  <div key={i} className={styles.editorLine}>
                    <span className={styles.editorLineNum}>{i + 1}</span>
                    <span className={styles.editorKw}>{line.kw}</span>
                    <span className={styles.editorText}>{line.rest}</span>
                    <span className={styles.editorStr}>{line.str}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* === STATS BAR === */}
      <motion.div
        className={styles.statsBar}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        {[
          { val: '2.4K+', label: 'Engineers' },
          { val: '18K+', label: 'Diagrams created' },
          { val: '340K+', label: 'Lines generated' },
          { val: '99.9%', label: 'Uptime' },
        ].map(({ val, label }) => (
          <div key={label} className={styles.statItem}>
            <span className={styles.statVal}>{val}</span>
            <span className={styles.statLabel}>{label}</span>
          </div>
        ))}
      </motion.div>

      {/* === FEATURES === */}
      <section className={styles.features}>
        <motion.div
          className={styles.sectionHeader}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className={styles.sectionBadge}>Features</div>
          <h2 className={styles.sectionTitle}>
            Everything you need to go from{' '}
            <span className="gradient-text">idea to code</span>
          </h2>
          <p className={styles.sectionSub}>
            A complete platform for designing, collaborating, and generating code — all in one canvas.
          </p>
        </motion.div>

        <div className={styles.featuresGrid}>
          {features.map((f, i) => (
            <FeatureCard
              key={f.title}
              {...f}
              delay={i * 0.1}
              className={i % 5 === 0 ? 'float-1' : i % 5 === 2 ? 'float-2' : i % 5 === 4 ? 'float-3' : ''}
            />
          ))}
        </div>
      </section>

      {/* === HOW IT WORKS === */}
      <section className={styles.howSection}>
        <motion.div
          className={styles.sectionHeader}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className={styles.sectionBadge}>How It Works</div>
          <h2 className={styles.sectionTitle}>Three steps to ship faster</h2>
        </motion.div>

        <div className={styles.stepsRow}>
          {[
            { num: '01', title: 'Draw Your Architecture', desc: 'Use our infinite canvas to sketch boxes, arrows, and labels representing your system components.' },
            { num: '02', title: 'Click Generate Code', desc: 'Our AI reads the diagram, understands relationships, and infers patterns like auth, CRUD, and microservices.' },
            { num: '03', title: 'Copy, Export, Ship', desc: 'Get clean, typed, production-ready code organized by file. Export to GitHub, download as ZIP, or open in editor.' },
          ].map((step, i) => (
            <motion.div
              key={step.num}
              className={styles.stepCard}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
            >
              <span className={styles.stepNum}>{step.num}</span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepDesc}>{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* === CTA BANNER === */}
      <motion.section
        className={styles.ctaBanner}
        initial={{ opacity: 0, scale: 0.97 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
      >
        <div className={styles.ctaBannerGlow} />
        <h2 className={styles.ctaBannerTitle}>
          Ready to build at the speed of thought?
        </h2>
        <p className={styles.ctaBannerSub}>
          Join 2,400+ engineers who ship architecture-driven code with IntelliCode.
        </p>
        <motion.button
          className={`btn btn-primary ${styles.ctaBannerBtn} pulse-btn`}
          onClick={() => navigate('/auth')}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.97 }}
        >
          Start for free
          <ArrowRight size={16} />
        </motion.button>
      </motion.section>

      {/* === FOOTER === */}
      <footer className={styles.footer}>
        <div className={styles.footerLogo}>
          <div className={styles.navLogoIcon}><Zap size={14} /></div>
          <span>IntelliCode</span>
        </div>
        <div className={styles.footerLinks}>
          {['Privacy', 'Terms', 'Docs', 'Status', 'Blog'].map(l => (
            <a key={l} href="#" className={styles.footerLink}>{l}</a>
          ))}
        </div>
        <span className={styles.footerCopy}>© 2026 IntelliCode. All rights reserved.</span>
      </footer>
    </div>
  );
}
