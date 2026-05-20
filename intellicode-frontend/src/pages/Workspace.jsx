import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
  MousePointer2, Square, Circle, ArrowRight, Type, Eraser,
  Palette, Zap, Users, ChevronLeft, Maximize2, Send,
  MessageSquare, Code2, X, GripVertical, Download, Share2,
  PanelRightClose, PanelRightOpen, Plus, Hash, AtSign, Smile
} from 'lucide-react';
import CodeGenModal from '../components/CodeGenModal';
import styles from './Workspace.module.css';

// ─── Mock Data ────────────────────────────────────────────────────
const CHAT_MESSAGES = [
  { id: 1, user: 'Alex Nova', init: 'AN', color: '#00FFD1', time: '10:22', text: 'Added the auth service node. Should we connect it to Redis for session storage?', isAi: false },
  { id: 2, user: 'IntelliAI', init: 'AI', color: '#7B61FF', time: '10:22', text: 'Good idea! I can generate a Redis session adapter alongside the auth service. Just ask with @ai generate redis session', isAi: true },
  { id: 3, user: 'Sara Lee', init: 'SL', color: '#FF61DC', time: '10:24', text: 'I connected DB → UserService → API Gateway. The diagram is looking clean.', isAi: false },
  { id: 4, user: 'Alex Nova', init: 'AN', color: '#00FFD1', time: '10:26', text: '@ai explain the relationship between API Gateway and Auth service in this diagram', isAi: false },
  { id: 5, user: 'IntelliAI', init: 'AI', color: '#7B61FF', time: '10:26', text: 'The API Gateway acts as an entry point that delegates authentication to the Auth Service via a middleware call before forwarding requests to downstream services. I\'ll include JWT validation middleware in the generated code.', isAi: true },
];

const CODE_FILES = {
  'UserService.ts': `import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
  }
}`,
  'auth.ts': `import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../users/user.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.userService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  async login(user: any) {
    const payload = { sub: user.id, email: user.email };
    return { access_token: this.jwtService.sign(payload) };
  }
}`,
  'schema.prisma': `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  sessions     Session[]
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  user      User     @relation(fields: [userId], references: [id])
}`,
};

const ONLINE_USERS = [
  { init: 'AN', color: '#00FFD1', name: 'Alex Nova', x: 340, y: 180 },
  { init: 'SL', color: '#FF61DC', name: 'Sara Lee', x: 510, y: 290 },
];

const TOOLBAR_TOOLS = [
  { id: 'select', icon: MousePointer2, label: 'Select (V)' },
  { id: 'rect', icon: Square, label: 'Rectangle (R)' },
  { id: 'circle', icon: Circle, label: 'Circle (C)' },
  { id: 'arrow', icon: ArrowRight, label: 'Arrow (A)' },
  { id: 'text', icon: Type, label: 'Text (T)' },
  { id: 'eraser', icon: Eraser, label: 'Eraser (E)' },
  { id: 'color', icon: Palette, label: 'Color' },
];

// ─── Canvas Component ─────────────────────────────────────────────
const WhiteboardCanvas = ({ activeTool, onGenerateClick }) => {
  const canvasRef = useRef(null);
  const [nodes] = useState([
    { id: 1, x: 80, y: 100, w: 110, h: 50, label: 'Client', color: '#00FFD1' },
    { id: 2, x: 260, y: 60, w: 120, h: 50, label: 'API Gateway', color: '#7B61FF' },
    { id: 3, x: 260, y: 170, w: 110, h: 50, label: 'Auth Service', color: '#FF61DC' },
    { id: 4, x: 450, y: 60, w: 120, h: 50, label: 'User Service', color: '#00FFD1' },
    { id: 5, x: 450, y: 170, w: 120, h: 50, label: 'PostgreSQL', color: '#FFB800' },
    { id: 6, x: 640, y: 60, w: 100, h: 50, label: 'Redis', color: '#00C6FF' },
  ]);

  const arrows = [
    [1, 2], [1, 3], [2, 4], [2, 3], [4, 5], [3, 5], [4, 6],
  ];

  const getCenter = (n) => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 });

  const getCursor = () => {
    const map = { select: 'default', rect: 'crosshair', circle: 'crosshair', arrow: 'crosshair', text: 'text', eraser: 'cell' };
    return map[activeTool] || 'default';
  };

  return (
    <div className={styles.canvasWrap} style={{ cursor: getCursor() }}>
      {/* Dot grid */}
      <div className={styles.dotGrid} />

      {/* SVG for arrows */}
      <svg className={styles.arrowLayer} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="rgba(255,255,255,0.3)" />
          </marker>
        </defs>
        {arrows.map(([from, to], i) => {
          const f = nodes.find(n => n.id === from);
          const t = nodes.find(n => n.id === to);
          if (!f || !t) return null;
          const fc = getCenter(f);
          const tc = getCenter(t);
          return (
            <motion.line
              key={i}
              x1={fc.x} y1={fc.y} x2={tc.x} y2={tc.y}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="1.5"
              strokeDasharray="5 3"
              markerEnd="url(#arrowhead)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            />
          );
        })}
      </svg>

      {/* Nodes */}
      {nodes.map((node, i) => (
        <motion.div
          key={node.id}
          className={styles.canvasNode}
          style={{
            left: node.x, top: node.y, width: node.w, height: node.h,
            borderColor: `${node.color}50`,
            background: `${node.color}10`,
            boxShadow: `0 0 16px ${node.color}20`,
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.08, type: 'spring', stiffness: 260, damping: 20 }}
          whileHover={{ scale: 1.05, boxShadow: `0 0 24px ${node.color}40`, zIndex: 10 }}
        >
          <span className={styles.nodeLabel} style={{ color: node.color }}>{node.label}</span>
        </motion.div>
      ))}

      {/* Live cursors */}
      {ONLINE_USERS.map(u => (
        <motion.div
          key={u.init}
          className={styles.liveCursor}
          style={{ left: u.x, top: u.y }}
          animate={{ x: [0, 8, -4, 0], y: [0, -6, 3, 0] }}
          transition={{ duration: 4 + Math.random() * 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M0 0L10 14L5 8L13 5L0 0Z" fill={u.color} />
          </svg>
          <span className={styles.cursorLabel} style={{ background: u.color, color: '#080B14' }}>{u.name}</span>
        </motion.div>
      ))}

      {/* Generate Code button — top center */}
      <motion.button
        id="workspace-generate"
        className={styles.generateBtn}
        onClick={onGenerateClick}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        animate={{
          boxShadow: [
            '0 4px 20px rgba(0,255,209,0.3)',
            '0 4px 36px rgba(0,255,209,0.6)',
            '0 4px 20px rgba(0,255,209,0.3)',
          ],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <Zap size={16} />
        <span>Generate Code</span>
      </motion.button>

      {/* Online users indicator — bottom left */}
      <div className={styles.onlineIndicator}>
        {ONLINE_USERS.map(u => (
          <div key={u.init} className={styles.onlineChip}>
            <div className={styles.onlineDot} style={{ background: u.color }} />
            <div className={styles.onlineAvatar} style={{ background: u.color + '30', border: `1px solid ${u.color}60`, color: u.color }}>
              {u.init}
            </div>
            <span className={styles.onlineName}>{u.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Code Editor Panel ────────────────────────────────────────────
const CodePanel = () => {
  const [activeFile, setActiveFile] = useState('UserService.ts');
  const files = Object.keys(CODE_FILES);

  const tokenize = (line) => {
    const keywords = /\b(import|export|from|class|const|let|var|return|async|await|new|if|else|interface|type|extends|implements|private|public|protected|static|readonly|null|undefined|true|false|void|string|number|boolean|any)\b/g;
    const strings = /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g;
    const comments = /\/\/.*/g;
    const decorators = /@\w+/g;

    return line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(strings, m => `<span class="str">${m}</span>`)
      .replace(comments, m => `<span class="cmt">${m}</span>`)
      .replace(decorators, m => `<span class="dec">${m}</span>`)
      .replace(keywords, m => `<span class="kw">${m}</span>`);
  };

  const lines = CODE_FILES[activeFile]?.split('\n') || [];

  return (
    <div className={styles.codePanel}>
      {/* File tabs */}
      <div className={styles.fileTabs}>
        {files.map(f => (
          <motion.button
            key={f}
            className={`${styles.fileTab} ${f === activeFile ? styles.fileTabActive : ''}`}
            onClick={() => setActiveFile(f)}
            whileHover={{ y: -1 }}
          >
            <Code2 size={11} />
            <span>{f}</span>
            {f === activeFile && <div className={styles.fileTabBar} />}
          </motion.button>
        ))}
        <button className={styles.newFileBtn}><Plus size={13} /></button>
      </div>

      {/* Editor */}
      <div className={styles.editorBody}>
        {lines.map((line, i) => (
          <div key={i} className={styles.editorLine}>
            <span className={styles.lineNum}>{i + 1}</span>
            <code
              className={styles.lineCode}
              dangerouslySetInnerHTML={{ __html: tokenize(line) || '&nbsp;' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Chat Panel ───────────────────────────────────────────────────
const ChatPanel = () => {
  const [messages, setMessages] = useState(CHAT_MESSAGES);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    if (!input.trim()) return;
    setMessages(m => [...m, {
      id: Date.now(), user: 'Alex Nova', init: 'AN', color: '#00FFD1',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: input.trim(), isAi: false,
    }]);
    setInput('');
  };

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <div className={styles.chatPanel}>
      {/* Chat header */}
      <div className={styles.chatHeader}>
        <MessageSquare size={14} className={styles.chatHeaderIcon} />
        <span className={styles.chatHeaderTitle}>Team Chat</span>
        <div className={styles.chatOnline}>
          <div className={styles.chatDot} />
          <span>3 online</span>
        </div>
      </div>

      {/* Messages */}
      <div className={styles.chatMessages}>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            className={`${styles.message} ${msg.isAi ? styles.aiMessage : ''}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div
              className={styles.msgAvatar}
              style={{ background: `${msg.color}25`, border: `1px solid ${msg.color}50`, color: msg.color }}
            >
              {msg.init}
            </div>
            <div className={styles.msgContent}>
              <div className={styles.msgMeta}>
                <span className={styles.msgUser} style={{ color: msg.color }}>{msg.user}</span>
                <span className={styles.msgTime}>{msg.time}</span>
              </div>
              <p className={styles.msgText}>
                {msg.text.split(/(@ai\b)/gi).map((part, i) =>
                  part.toLowerCase() === '@ai' ? (
                    <span key={i} className={styles.atAi}>{part}</span>
                  ) : part
                )}
              </p>
            </div>
          </motion.div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={styles.chatInputWrap}>
        <div className={styles.chatInputRow}>
          <input
            id="workspace-chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Message team or type @ai ..."
            className={styles.chatInput}
          />
          <motion.button
            className={styles.sendBtn}
            onClick={send}
            disabled={!input.trim()}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
          >
            <Send size={14} />
          </motion.button>
        </div>
        <div className={styles.chatHint}>
          <AtSign size={11} /> <span>Type <kbd>@ai</kbd> to ask the AI assistant</span>
        </div>
      </div>
    </div>
  );
};

// ─── Main Workspace ───────────────────────────────────────────────
export default function Workspace() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [activeTool, setActiveTool] = useState('select');
  const [modalOpen, setModalOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [splitPos, setSplitPos] = useState(60); // percent
  const dragging = useRef(false);

  const handleDrag = (e) => {
    if (!dragging.current) return;
    const pct = (e.clientX / window.innerWidth) * 100;
    setSplitPos(Math.min(75, Math.max(35, pct)));
  };

  useEffect(() => {
    const up = () => { dragging.current = false; };
    window.addEventListener('mouseup', up);
    window.addEventListener('mousemove', handleDrag);
    return () => { window.removeEventListener('mouseup', up); window.removeEventListener('mousemove', handleDrag); };
  }, []);

  return (
    <div className={styles.workspace}>
      {/* ── Top bar ── */}
      <motion.header
        className={styles.topBar}
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className={styles.topLeft}>
          <button className={styles.backBtn} onClick={() => navigate('/dashboard')}>
            <ChevronLeft size={16} />
          </button>
          <div className={styles.topLogoIcon}><Zap size={13} /></div>
          <div className={styles.topTitleArea}>
            <span className={styles.topTitle}>E-Commerce Platform</span>
            <span className={styles.topSub}>arch-v3 · Auto-saved</span>
          </div>
        </div>

        <div className={styles.topCenter}>
          {ONLINE_USERS.map(u => (
            <div key={u.init} className={styles.topAvatar} style={{ background: `${u.color}25`, border: `1px solid ${u.color}60`, color: u.color }} title={u.name}>
              {u.init}
            </div>
          ))}
          <div className={styles.topAvatar} style={{ background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.15)', color: 'var(--text-muted)' }}>
            <Plus size={11} />
          </div>
        </div>

        <div className={styles.topRight}>
          <button className={`btn btn-ghost ${styles.topBtn}`} style={{ fontSize: 12, padding: '7px 14px' }}>
            <Download size={14} /> Export
          </button>
          <button className={`btn btn-violet ${styles.topBtn}`} style={{ fontSize: 12, padding: '7px 14px' }}>
            <Share2 size={14} /> Share
          </button>
          <button
            className={styles.panelToggle}
            onClick={() => setRightPanelOpen(v => !v)}
            title="Toggle right panel"
          >
            {rightPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </button>
        </div>
      </motion.header>

      {/* ── Body ── */}
      <div className={styles.body}>
        {/* Left panel: Whiteboard */}
        <div
          className={styles.leftPanel}
          style={{ width: rightPanelOpen ? `${splitPos}%` : '100%' }}
        >
          {/* Floating toolbar */}
          <motion.div
            className={styles.floatingToolbar}
            initial={{ x: -60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            {TOOLBAR_TOOLS.map(({ id, icon: Icon, label }) => (
              <motion.button
                key={id}
                id={`tool-${id}`}
                className={`${styles.toolBtn} ${activeTool === id ? styles.toolBtnActive : ''}`}
                onClick={() => setActiveTool(id)}
                title={label}
                whileHover={{ scale: 1.12 }}
                whileTap={{ scale: 0.9 }}
              >
                <Icon size={17} />
              </motion.button>
            ))}

            <div className={styles.toolSep} />

            <button className={styles.toolBtn} title="Zoom in" onClick={() => {}}>+</button>
            <button className={styles.toolBtn} title="Zoom out" onClick={() => {}}>−</button>
            <button className={styles.toolBtn} title="Fullscreen"><Maximize2 size={15} /></button>
          </motion.div>

          <WhiteboardCanvas activeTool={activeTool} onGenerateClick={() => setModalOpen(true)} />
        </div>

        {/* Drag handle */}
        {rightPanelOpen && (
          <div
            className={styles.dragHandle}
            onMouseDown={() => { dragging.current = true; }}
          >
            <GripVertical size={14} className={styles.dragIcon} />
          </div>
        )}

        {/* Right panel: Code + Chat */}
        <AnimatePresence>
          {rightPanelOpen && (
            <motion.div
              className={styles.rightPanel}
              style={{ width: `${100 - splitPos}%` }}
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            >
              <CodePanel />
              <div className={styles.panelDivider} />
              <ChatPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Code Gen Modal */}
      <CodeGenModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onOpenEditor={() => {}}
      />
    </div>
  );
}
