import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Bell, Settings, LogOut, Users, Clock,
  MoreVertical, Star, Archive, Trash2, Zap, Grid, List,
  ChevronRight, TrendingUp, Code2, GitBranch, Activity
} from 'lucide-react';
import styles from './Dashboard.module.css';

// ─── Mock data ───────────────────────────────────────────────────
const PROJECTS = [
  {
    id: 'p1', name: 'E-Commerce Platform', desc: 'Microservices architecture with auth, cart, and payment flows',
    lastEdited: '2 hours ago', collaborators: ['AN', 'SL', 'RK'],
    color: '#00FFD1', tags: ['Next.js', 'PostgreSQL'], starred: true, nodes: 14, generated: true,
  },
  {
    id: 'p2', name: 'ML Pipeline Orchestrator', desc: 'Data ingestion → feature engineering → model training pipeline',
    lastEdited: '1 day ago', collaborators: ['MJ', 'AN'],
    color: '#7B61FF', tags: ['Python', 'FastAPI', 'Redis'], starred: false, nodes: 22, generated: true,
  },
  {
    id: 'p3', name: 'Real-time Chat App', desc: 'WebSocket-based chat with channels, DMs, and file sharing',
    lastEdited: '3 days ago', collaborators: ['SL'],
    color: '#FF61DC', tags: ['Socket.IO', 'Express'], starred: true, nodes: 9, generated: false,
  },
  {
    id: 'p4', name: 'API Gateway Design', desc: 'Rate limiting, auth middleware, and service routing patterns',
    lastEdited: '1 week ago', collaborators: ['RK', 'MJ', 'TH', 'AN'],
    color: '#FFB800', tags: ['Go', 'gRPC'], starred: false, nodes: 18, generated: true,
  },
  {
    id: 'p5', name: 'Booking System', desc: 'Calendar-based scheduling with notifications and conflict resolution',
    lastEdited: '2 weeks ago', collaborators: ['TH'],
    color: '#00FFD1', tags: ['Rails', 'Postgres'], starred: false, nodes: 11, generated: false,
  },
  {
    id: 'p6', name: 'IoT Dashboard', desc: 'Device management, telemetry streaming, and alert configuration',
    lastEdited: '1 month ago', collaborators: ['SL', 'RK'],
    color: '#7B61FF', tags: ['MQTT', 'TimescaleDB'], starred: false, nodes: 27, generated: true,
  },
];

const AVATAR_COLORS = {
  AN: 'linear-gradient(135deg, #00FFD1, #00CCAA)',
  SL: 'linear-gradient(135deg, #7B61FF, #5B41DF)',
  RK: 'linear-gradient(135deg, #FF61DC, #CC41B9)',
  MJ: 'linear-gradient(135deg, #FFB800, #FF8C00)',
  TH: 'linear-gradient(135deg, #00C6FF, #0072FF)',
};

// ─── Particle burst on "New Project" ──────────────────────────────
const ParticleBurst = ({ trigger }) => {
  if (!trigger) return null;
  return (
    <div className={styles.particleBurst} aria-hidden>
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={i}
          className={styles.particle}
          initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
          animate={{
            scale: [0, 1, 0],
            x: Math.cos((i / 12) * Math.PI * 2) * (60 + Math.random() * 40),
            y: Math.sin((i / 12) * Math.PI * 2) * (60 + Math.random() * 40),
            opacity: [1, 1, 0],
          }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.02 }}
          style={{
            background: i % 3 === 0 ? 'var(--cyan)' : i % 3 === 1 ? 'var(--violet)' : '#FF61DC',
          }}
        />
      ))}
    </div>
  );
};

// ─── Project Card ─────────────────────────────────────────────────
const ProjectCard = ({ project, viewMode, onClick }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  if (viewMode === 'list') {
    return (
      <motion.div
        className={styles.listCard}
        layout
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        whileHover={{ x: 4 }}
        onClick={() => navigate(`/workspace/${project.id}`)}
      >
        <div className={styles.listCardDot} style={{ background: project.color, boxShadow: `0 0 10px ${project.color}60` }} />
        <div className={styles.listCardInfo}>
          <div className={styles.listCardName}>{project.name}</div>
          <div className={styles.listCardDesc}>{project.desc}</div>
        </div>
        <div className={styles.listCardMeta}>
          {project.tags.map(t => <span key={t} className={styles.tag}>{t}</span>)}
        </div>
        <div className={styles.listCardStats}>
          <span className={styles.statChip}><Code2 size={11} /> {project.nodes} nodes</span>
        </div>
        <div className={styles.avatarRow}>
          {project.collaborators.slice(0, 3).map((init) => (
            <div key={init} className={styles.collabAvatar} style={{ background: AVATAR_COLORS[init] }}>{init}</div>
          ))}
        </div>
        <span className={styles.listCardTime}><Clock size={11} /> {project.lastEdited}</span>
        <ChevronRight size={14} className={styles.chevron} />
      </motion.div>
    );
  }

  return (
    <motion.div
      className={styles.projectCard}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -6, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {/* Card top accent */}
      <div className={styles.cardAccent} style={{ background: project.color, boxShadow: `0 0 24px ${project.color}60` }} />

      {/* Header */}
      <div className={styles.cardHead}>
        <div className={styles.cardIcon} style={{ background: `${project.color}18`, border: `1px solid ${project.color}40` }}>
          <Code2 size={16} style={{ color: project.color }} />
        </div>
        <div className={styles.cardActions}>
          {project.starred && <Star size={14} className={styles.starIcon} style={{ color: '#FFB800', fill: '#FFB800' }} />}
          <div className={styles.menuWrap}>
            <button
              className={styles.menuBtn}
              onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
              aria-label="Project menu"
            >
              <MoreVertical size={15} />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  className={styles.dropMenu}
                  initial={{ opacity: 0, scale: 0.9, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -8 }}
                  transition={{ duration: 0.15 }}
                >
                  {[
                    { icon: Star, label: 'Star' },
                    { icon: Archive, label: 'Archive' },
                    { icon: Trash2, label: 'Delete', danger: true },
                  ].map(({ icon: I, label, danger }) => (
                    <button key={label} className={`${styles.dropItem} ${danger ? styles.danger : ''}`} onClick={e => e.stopPropagation()}>
                      <I size={13} /> {label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={styles.cardBody} onClick={() => navigate(`/workspace/${project.id}`)}>
        <h3 className={styles.cardName}>{project.name}</h3>
        <p className={styles.cardDesc}>{project.desc}</p>
        <div className={styles.tagRow}>
          {project.tags.map(t => <span key={t} className={styles.tag}>{t}</span>)}
        </div>
      </div>

      {/* Footer */}
      <div className={styles.cardFooter}>
        <div className={styles.collabRow}>
          {project.collaborators.slice(0, 4).map((init) => (
            <div key={init} className={styles.collabAvatar} style={{ background: AVATAR_COLORS[init] }}>{init}</div>
          ))}
          {project.collaborators.length > 4 && (
            <div className={styles.collabMore}>+{project.collaborators.length - 4}</div>
          )}
        </div>
        <div className={styles.cardTimestamp}>
          <Clock size={11} />
          <span>{project.lastEdited}</span>
        </div>
      </div>

      {/* Generated badge */}
      {project.generated && (
        <div className={styles.generatedBadge}>
          <Zap size={10} /> Code ready
        </div>
      )}
    </motion.div>
  );
};

// ─── Sidebar ──────────────────────────────────────────────────────
const Sidebar = () => {
  const navigate = useNavigate();
  const [active, setActive] = useState('all');

  const filters = [
    { id: 'all', label: 'All Projects', count: 6 },
    { id: 'starred', label: 'Starred', count: 2 },
    { id: 'recent', label: 'Recent', count: 3 },
    { id: 'shared', label: 'Shared with me', count: 1 },
    { id: 'archived', label: 'Archived', count: 0 },
  ];

  return (
    <motion.aside
      className={styles.sidebar}
      initial={{ x: -280, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Logo */}
      <div className={styles.sidebarLogo} onClick={() => navigate('/')}>
        <div className={styles.logoIcon}><Zap size={15} /></div>
        <span className={styles.logoText}>IntelliCode</span>
      </div>

      <div className={styles.sidebarDivider} />

      {/* Filters */}
      <div className={styles.sidebarSection}>
        <span className={styles.sidebarSectionLabel}>Workspace</span>
        {filters.map(f => (
          <button
            key={f.id}
            className={`${styles.sidebarItem} ${active === f.id ? styles.sidebarItemActive : ''}`}
            onClick={() => setActive(f.id)}
          >
            <span>{f.label}</span>
            {f.count > 0 && <span className={styles.sidebarCount}>{f.count}</span>}
          </button>
        ))}
      </div>

      <div className={styles.sidebarDivider} />

      {/* Recent projects */}
      <div className={styles.sidebarSection}>
        <span className={styles.sidebarSectionLabel}>Recent</span>
        {PROJECTS.slice(0, 4).map(p => (
          <button key={p.id} className={styles.sidebarProject} onClick={() => navigate(`/workspace/${p.id}`)}>
            <div className={styles.sidebarProjectDot} style={{ background: p.color }} />
            <span className={styles.sidebarProjectName}>{p.name}</span>
          </button>
        ))}
      </div>

      {/* Bottom actions */}
      <div className={styles.sidebarBottom}>
        <button className={styles.sidebarBottomBtn}><Settings size={15} /> Settings</button>
        <button className={styles.sidebarBottomBtn} onClick={() => navigate('/')}><LogOut size={15} /> Sign out</button>
      </div>
    </motion.aside>
  );
};

// ─── Loading Skeleton ─────────────────────────────────────────────
const SkeletonCard = () => (
  <div className={styles.skeletonCard}>
    <div className={`skeleton ${styles.skeletonAccent}`} />
    <div className={styles.skeletonBody}>
      <div className={`skeleton ${styles.skeletonTitle}`} />
      <div className={`skeleton ${styles.skeletonLine}`} />
      <div className={`skeleton ${styles.skeletonLine}`} style={{ width: '60%' }} />
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [particleTrigger, setParticleTrigger] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(t);
  }, []);

  const filtered = PROJECTS.filter(p => {
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.desc.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q))
    );
  });

  const handleNewProject = () => {
    setParticleTrigger(true);
    setTimeout(() => {
      setParticleTrigger(false);
      navigate('/workspace/new');
    }, 700);
  };

  return (
    <div className={styles.layout}>
      <Sidebar />

      <main className={styles.main}>
        {/* Top bar */}
        <motion.header
          className={styles.topBar}
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className={styles.topBarLeft}>
            <h1 className={styles.pageTitle}>Dashboard</h1>
            <span className={styles.pageSub}>{filtered.length} projects</span>
          </div>
          <div className={styles.topBarRight}>
            {/* Search */}
            <div className={styles.searchWrap}>
              <Search size={15} className={styles.searchIcon} />
              <input
                id="dashboard-search"
                type="text"
                placeholder="Search projects..."
                className={styles.searchInput}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {/* View toggle */}
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.viewBtnActive : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid view"
              >
                <Grid size={15} />
              </button>
              <button
                className={`${styles.viewBtn} ${viewMode === 'list' ? styles.viewBtnActive : ''}`}
                onClick={() => setViewMode('list')}
                title="List view"
              >
                <List size={15} />
              </button>
            </div>
            {/* Bell */}
            <button className={styles.bellBtn} aria-label="Notifications">
              <Bell size={17} />
              <span className={styles.bellDot} />
            </button>
            {/* Avatar */}
            <div className={styles.avatarBtn}>AN</div>
          </div>
        </motion.header>

        {/* Stats row */}
        <motion.div
          className={styles.statsRow}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          {[
            { icon: Code2, label: 'Total Projects', value: '6', color: 'var(--cyan)', trend: '+2 this month' },
            { icon: TrendingUp, label: 'Code Generated', value: '42K', color: 'var(--violet)', trend: 'lines' },
            { icon: Users, label: 'Collaborators', value: '5', color: '#FF61DC', trend: 'active' },
            { icon: GitBranch, label: 'Diagrams', value: '101', color: '#FFB800', trend: 'total nodes' },
          ].map(({ icon: Icon, label, value, color, trend }) => (
            <div key={label} className={styles.statCard}>
              <div className={styles.statCardIcon} style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                <Icon size={16} style={{ color }} />
              </div>
              <div>
                <div className={styles.statCardValue} style={{ color }}>{value}</div>
                <div className={styles.statCardLabel}>{label}</div>
                <div className={styles.statCardTrend}>{trend}</div>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Projects header */}
        <div className={styles.projectsHeader}>
          <h2 className={styles.projectsTitle}>Your Projects</h2>
          <div className={styles.projectsActions}>
            {['All', 'Starred', 'Recent'].map(f => (
              <button
                key={f}
                className={`${styles.filterPill} ${filter === f.toLowerCase() ? styles.filterPillActive : ''}`}
                onClick={() => setFilter(f.toLowerCase())}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Projects grid/list */}
        <div className={viewMode === 'grid' ? styles.projectsGrid : styles.projectsList}>
          {/* NEW PROJECT card */}
          <motion.div
            className={styles.newCard}
            whileHover={{ scale: 1.02, borderColor: 'var(--border-cyan)' }}
            whileTap={{ scale: 0.98 }}
            onClick={handleNewProject}
            style={{ position: 'relative' }}
          >
            <ParticleBurst trigger={particleTrigger} />
            <motion.div
              className={styles.newCardPlus}
              animate={{ rotate: particleTrigger ? 135 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <Plus size={28} />
            </motion.div>
            <span className={styles.newCardLabel}>New Project</span>
            <span className={styles.newCardSub}>Start from blank canvas</span>
          </motion.div>

          <AnimatePresence mode="popLayout">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
            ) : (
              filtered.map((p, i) => (
                <ProjectCard key={p.id} project={p} viewMode={viewMode} />
              ))
            )}
          </AnimatePresence>
        </div>

        {!loading && filtered.length === 0 && (
          <motion.div
            className={styles.emptyState}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Search size={40} className={styles.emptyIcon} />
            <h3>No projects found</h3>
            <p>Try a different search term or create a new project.</p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
