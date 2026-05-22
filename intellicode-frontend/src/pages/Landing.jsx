import { useNavigate } from 'react-router-dom';
import { ArrowRight, Zap, Code2, Users, GitBranch, Layers, Shield } from 'lucide-react';
import styles from './Landing.module.css';

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

function FeatureCard({ icon: Icon, title, desc, color }) {
  return (
    <div className={styles.featureCard} style={{ borderColor: `${color}40` }}>
      <div className={styles.featureIcon} style={{ color }}>
        <Icon size={24} />
      </div>
      <h3 className={styles.featureTitle}>{title}</h3>
      <p className={styles.featureDesc}>{desc}</p>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      {/* === NAVBAR === */}
      <nav className={styles.nav}>
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
          <button
            className={`btn btn-primary ${styles.navCta}`}
            onClick={() => navigate('/auth')}
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* === HERO === */}
      <section className={styles.hero}>
        <div className={styles.orbCyan} />
        <div className={styles.orbViolet} />

        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span className={styles.badgeDot} />
            <span>Now in Public Beta — Free to start</span>
          </div>

          <h1 className={styles.heroTitle}>
            Draw.{' '}
            <span className="gradient-text">Think.</span>
            <br />
            Build.
          </h1>

          <p className={styles.heroSub}>
            The AI-powered collaborative whiteboard that transforms your system
            architecture diagrams into production-ready full stack code — instantly.
          </p>

          <div className={styles.heroCtas}>
            <button
              id="landing-start-building"
              className={`btn btn-primary ${styles.ctaPrimary}`}
              onClick={() => navigate('/auth')}
            >
              Start Building
              <ArrowRight size={16} />
            </button>
            <button className={`btn btn-ghost ${styles.ctaSecondary}`}>
              Watch Demo
            </button>
          </div>

          <div className={styles.socialProof}>
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
          </div>
        </div>

        <div className={styles.heroPreview}>
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

          <div className={styles.previewBody}>
            <div className={styles.previewLeft}>
              <div className={styles.previewToolbar}>
                {['▭', '○', '→', 'T', '✏'].map((t, i) => (
                  <div key={i} className={styles.toolbarBtn}>{t}</div>
                ))}
              </div>
              <div className={styles.previewPlaceholder}>
                <div className={styles.placeholderBox} style={{ left: '20%', top: '20%', width: '30%', height: '25%' }} />
                <div className={styles.placeholderBox} style={{ left: '60%', top: '20%', width: '30%', height: '25%' }} />
                <div className={styles.placeholderBox} style={{ left: '40%', top: '60%', width: '30%', height: '25%' }} />
              </div>
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
        </div>
      </section>

      {/* === STATS BAR === */}
      <div className={styles.statsBar}>
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
      </div>

      {/* === FEATURES === */}
      <section className={styles.features}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionBadge}>Features</div>
          <h2 className={styles.sectionTitle}>
            Everything you need to go from{' '}
            <span className="gradient-text">idea to code</span>
          </h2>
          <p className={styles.sectionSub}>
            A complete platform for designing, collaborating, and generating code — all in one canvas.
          </p>
        </div>

        <div className={styles.featuresGrid}>
          {features.map((f) => (
            <FeatureCard
              key={f.title}
              {...f}
            />
          ))}
        </div>
      </section>

      {/* === HOW IT WORKS === */}
      <section className={styles.howSection}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionBadge}>How It Works</div>
          <h2 className={styles.sectionTitle}>Three steps to ship faster</h2>
        </div>

        <div className={styles.stepsRow}>
          {[
            { num: '01', title: 'Draw Your Architecture', desc: 'Use our infinite canvas to sketch boxes, arrows, and labels representing your system components.' },
            { num: '02', title: 'Click Generate Code', desc: 'Our AI reads the diagram, understands relationships, and infers patterns like auth, CRUD, and microservices.' },
            { num: '03', title: 'Copy, Export, Ship', desc: 'Get clean, typed, production-ready code organized by file. Export to GitHub, download as ZIP, or open in editor.' },
          ].map((step) => (
            <div
              key={step.num}
              className={styles.stepCard}
            >
              <span className={styles.stepNum}>{step.num}</span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepDesc}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* === CTA BANNER === */}
      <section className={styles.ctaBanner}>
        <h2 className={styles.ctaTitle}>Ready to ship faster?</h2>
        <p className={styles.ctaSub}>Join 2,400+ engineers building with IntelliCode</p>
        <button
          className={`btn btn-primary ${styles.ctaBannerBtn}`}
          onClick={() => navigate('/auth')}
        >
          Get Started Free
          <ArrowRight size={16} />
        </button>
      </section>

      {/* === FOOTER === */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div>
            <div className={styles.footerLogo}>
              <Zap size={16} />
              <span>IntelliCode</span>
            </div>
          </div>
          <div className={styles.footerLinks}>
            <a href="#">Docs</a>
            <a href="#">Twitter</a>
            <a href="#">GitHub</a>
          </div>
          <div className={styles.footerRight}>
            <span>© 2024 IntelliCode. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
