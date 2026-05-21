// @refresh reset
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (!isAuthenticated) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) return;

    const newSocket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token: accessToken },
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });

    newSocket.on('room:users', (users) => {
      setOnlineUsers(Array.isArray(users) ? users : Object.values(users));
    });

    newSocket.on('user:joined', (user) => {
      setOnlineUsers((prev) => [...prev, user]);
    });

    newSocket.on('user:left', (userId) => {
      setOnlineUsers((prev) => prev.filter((u) => u.id !== userId));
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isAuthenticated]);

  const joinProject = useCallback(
    (projectId) => {
      if (socket) {
        socket.emit('join:project', projectId);
      }
    },
    [socket]
  );

  const emitWhiteboardDraw = useCallback(
    (projectId, object) => {
      if (socket) {
        socket.emit('whiteboard:draw', { projectId, object });
      }
    },
    [socket]
  );

  const emitWhiteboardSync = useCallback(
    (projectId, state) => {
      if (socket) {
        socket.emit('whiteboard:sync', { projectId, state });
      }
    },
    [socket]
  );

  const emitCursorMove = useCallback(
    (projectId, x, y) => {
      if (socket) {
        socket.emit('cursor:move', { projectId, x, y });
      }
    },
    [socket]
  );

  const emitChatMessage = useCallback(
    (projectId, content, type = 'text') => {
      if (socket) {
        socket.emit('chat:message', { projectId, content, type });
      }
    },
    [socket]
  );

  const emitCodeUpdate = useCallback(
    (projectId, fileId, code) => {
      if (socket) {
        socket.emit('code:update', { projectId, fileId, code });
      }
    },
    [socket]
  );

  const value = useMemo(
    () => ({
      socket,
      onlineUsers,
      joinProject,
      emitWhiteboardDraw,
      emitWhiteboardSync,
      emitCursorMove,
      emitChatMessage,
      emitCodeUpdate,
    }),
    [socket, onlineUsers, joinProject, emitWhiteboardDraw, emitWhiteboardSync, emitCursorMove, emitChatMessage, emitCodeUpdate]
  );

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === null) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};
