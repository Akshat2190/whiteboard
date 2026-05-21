import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Bell, Settings, LogOut, Users, Clock,
  MoreVertical, Star, Archive, Trash2, Zap, Grid, List,
  ChevronRight, TrendingUp, Code2, GitBranch, Activity
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { projectService } from '../services/project.service';
import styles from './Dashboard.module.css';

// ─── Project Card ─────────────────────────────────────────────────
const ProjectCard = ({ project, viewMode, onDelete }) => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const collaborators = Array.isArray(project.collaborators) ? project.collaborators : [];
  const collaboratorAvatars = collaborators.slice(0, 3);
  const moreCollaborators = Math.max(0, collaborators.length - 3);
  const tags = Array.isArray(project.tags) ? project.tags : [];

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project?')) return;
    
    setDeleting(true);
    try {
      await projectService.deleteProject(project._id);
      onDelete?.(project._id);
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert('Failed to delete project');
    } finally {
      setDeleting(false);
    }
  };

  if (viewMode === 'list') {
    return (
      <motion.div
        className={styles.listCard}
        layout
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        whileHover={{ x: 4 }}
        onClick={() => navigate(`/workspace/${project._id}`)}
      >
        <div className={styles.listCardDot} style={{ background: '#7B61FF' }} />
        <div className={styles.listCardInfo}>
          <div className={styles.listCardName}>{project.name}</div>
          <div className={styles.listCardDesc}>{project.description || 'No description'}</div>
        </div>
        <div className={styles.listCardMeta}>
          {tags.map((t) => (
            <span key={t} className={styles.tag}>{t}</span>
          ))}
        </div>
        <div className={styles.listCardStats}>
          <span className={styles.statChip}><Code2 size={11} /> {project.nodes || 0} nodes</span>
        </div>
        <div className={styles.avatarRow}>
          {collaboratorAvatars.map((init) => (
            <div key={init} className={styles.collabAvatar} style={{ background: '#7B61FF' }}>
              {typeof init === 'string' ? init.slice(0, 2).toUpperCase() : '??'}
            </div>
          ))}
          {moreCollaborators > 0 && <span className={styles.collabMore}>+{moreCollaborators}</span>}
        </div>
        <span className={styles.listCardTime}><Clock size={11} /> {project.lastEdited || '—'}</span>
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
      <div className={styles.cardAccent} style={{ background: project.color || '#7B61FF', boxShadow: `0 0 24px ${project.color || '#7B61FF'}60` }} />

      {/* Header */}
      <div className={styles.cardHead}>
        <div className={styles.cardIcon} style={{ background: `${project.color || '#7B61FF'}18`, border: `1px solid ${project.color || '#7B61FF'}40` }}>
          <Code2 size={16} style={{ color: project.color || '#7B61FF' }} />
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
                  <button className={styles.dropItem} onClick={e => e.stopPropagation()}>
                    <Star size={13} /> Star
                  </button>
                  <button className={styles.dropItem} onClick={e => e.stopPropagation()}>
                    <Archive size={13} /> Archive
                  </button>
                  <button
                    className={`${styles.dropItem} ${styles.danger}`}
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    <Trash2 size={13} /> {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={styles.cardBody} onClick={() => navigate(`/workspace/${project._id}`)}>
        <h3 className={styles.cardName}>{project.name}</h3>
        <p className={styles.cardDesc}>{project.description || 'No description'}</p>
        <div className={styles.tagRow}>
          {tags.map((tag) => (
            <span key={tag} className={styles.tag}>{tag}</span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className={styles.cardFooter}>
        <div className={styles.collabRow}>
          {collaborators.length > 4 && (
            <div className={styles.collabMore}>+{collaborators.length - 4}</div>
          )}
        </div>
        <div className={styles.cardTimestamp}>
          <Clock size={11} />
          <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Sidebar ──────────────────────────────────────────────────────
const Sidebar = ({ projects }) => {
  const navigate = useNavigate();
  const { logoutUser } = useAuth();
  const [active, setActive] = useState('all');

  const filters = [
    { id: 'all', label: 'All Projects', count: projects.length },
    { id: 'starred', label: 'Starred', count: 0 },
    { id: 'recent', label: 'Recent', count: Math.min(3, projects.length) },
    { id: 'shared', label: 'Shared with me', count: 0 },
    { id: 'archived', label: 'Archived', count: 0 },
  ];

  const handleLogout = async () => {
    await logoutUser();
  };

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
        {projects.slice(0, 4).map(p => (
          <button key={p._id} className={styles.sidebarProject} onClick={() => navigate(`/workspace/${p._id}`)}>
            <div className={styles.sidebarProjectDot} style={{ background: '#7B61FF' }} />
            <span className={styles.sidebarProjectName}>{p.name}</span>
          </button>
        ))}
      </div>

      {/* Bottom actions */}
      <div className={styles.sidebarBottom}>
        <button className={styles.sidebarBottomBtn}><Settings size={15} /> Settings</button>
        <button className={styles.sidebarBottomBtn} onClick={handleLogout}><LogOut size={15} /> Sign out</button>
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
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoading(true);
        const data = await projectService.getProjects();
        setProjects(data.projects || []);
        setError('');
      } catch (err) {
        setError('Failed to load projects');
        console.error('Error loading projects:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  const filtered = projects.filter(p => {
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q);
  });

  const handleNewProject = async () => {
    const projectName = prompt('Enter project name:', 'New Project');
    if (!projectName) return;

    try {
      const data = await projectService.createProject(projectName);
      setProjects([...projects, data.project]);
      navigate(`/workspace/${data.project._id}`);
    } catch (err) {
      alert('Failed to create project: ' + err.message);
    }
  };

  const handleDeleteProject = (id) => {
    setProjects(projects.filter(p => p._id !== id));
  };

  return (
    <div className={styles.layout}>
      <Sidebar projects={projects} />

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
            { icon: Code2, label: 'Total Projects', value: projects.length.toString(), color: 'var(--cyan)', trend: '' },
            { icon: TrendingUp, label: 'Code Generated', value: '0', color: 'var(--violet)', trend: '' },
            { icon: Users, label: 'Collaborators', value: '0', color: '#FF61DC', trend: '' },
            { icon: GitBranch, label: 'Diagrams', value: '0', color: '#FFB800', trend: '' },
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
            <div className={styles.newCardPlus}>
              <Plus size={28} />
            </div>
            <span className={styles.newCardLabel}>New Project</span>
            <span className={styles.newCardSub}>Start from blank canvas</span>
          </motion.div>

          <AnimatePresence mode="popLayout">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
            ) : (
              filtered.map((p) => (
                <ProjectCard key={p._id || p.id} project={p} viewMode={viewMode} onDelete={handleDeleteProject} />
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
