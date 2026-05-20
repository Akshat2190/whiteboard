import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, ChevronDown, Zap } from 'lucide-react';
import styles from './Navbar.module.css';

export default function Navbar({ userName = 'Alex Nova', notifications = 3 }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <motion.nav
      className={styles.navbar}
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Logo */}
      <div className={styles.logo} onClick={() => navigate('/')} role="button">
        <div className={styles.logoIcon}>
          <Zap size={18} />
        </div>
        <span className={styles.logoText}>IntelliCode</span>
      </div>

      {/* Nav Links */}
      <div className={styles.navLinks}>
        {[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Workspace', path: '/workspace/demo' },
        ].map(({ label, path }) => (
          <button
            key={path}
            className={`${styles.navLink} ${location.pathname === path ? styles.active : ''}`}
            onClick={() => navigate(path)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Right side */}
      <div className={styles.navRight}>
        {/* Notifications */}
        <motion.button
          className={styles.notifBtn}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          aria-label="Notifications"
        >
          <Bell size={18} />
          {notifications > 0 && (
            <span className={styles.notifBadge}>{notifications}</span>
          )}
        </motion.button>

        {/* Avatar */}
        <motion.div
          className={styles.avatar}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className={styles.avatarImg}>
            {userName.split(' ').map(n => n[0]).join('')}
          </div>
          <span className={styles.avatarName}>{userName}</span>
          <ChevronDown size={14} className={styles.chevron} />
        </motion.div>
      </div>
    </motion.nav>
  );
}
