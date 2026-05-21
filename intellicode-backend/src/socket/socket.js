const jwt = require('jsonwebtoken');
const Project = require('../models/Project.model');
const User = require('../models/User.model');
const Message = require('../models/Message.model');
const File = require('../models/File.model');
const redisClient = require('../config/redis');

const initSocket = (io) => {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return next(new Error('Authentication required'));
      }
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication required'));
    }
  });

  const isRedisReady = () => redisClient && redisClient.status === 'ready';

  const safeHSet = async (key, field, value) => {
    if (!isRedisReady()) return;
    try {
      await redisClient.hset(key, field, value);
    } catch (error) {
      console.warn('Redis hset failed', error.message || error);
    }
  };

  const safeHGetAll = async (key) => {
    if (!isRedisReady()) return {};
    try {
      return await redisClient.hgetall(key);
    } catch (error) {
      console.warn('Redis hgetall failed', error.message || error);
      return {};
    }
  };

  const safeHDel = async (key, field) => {
    if (!isRedisReady()) return;
    try {
      await redisClient.hdel(key, field);
    } catch (error) {
      console.warn('Redis hdel failed', error.message || error);
    }
  };

  io.on('connection', (socket) => {
    socket.projectAuthCache = new Map();

    socket.on('join:project', async (projectId) => {
      try {
        const project = await Project.findById(projectId);
        if (!project) {
          return;
        }

        const isAuthorized =
          project.owner.equals(socket.user._id) ||
          (Array.isArray(project.collaborators) && project.collaborators.some((collab) => collab.user.equals(socket.user._id)));

        if (!isAuthorized) {
          return;
        }

        socket.projectAuthCache.set(projectId, true);
        socket.join(projectId);
        await safeHSet(`online:${projectId}`, socket.user._id.toString(), JSON.stringify({ name: socket.user.name, avatar: socket.user.avatar }));
        const onlineUsers = await safeHGetAll(`online:${projectId}`);
        const parsedUsers = Object.entries(onlineUsers || {}).reduce((acc, [key, value]) => {
          try {
            acc[key] = JSON.parse(value);
          } catch (err) {
            acc[key] = { name: '', avatar: '' };
          }
          return acc;
        }, {});

        if (Object.keys(parsedUsers).length === 0) {
          parsedUsers[socket.user._id.toString()] = { name: socket.user.name, avatar: socket.user.avatar };
        }

        io.to(projectId).emit('room:users', parsedUsers);
        socket.to(projectId).emit('user:joined', {
          userId: socket.user._id,
          name: socket.user.name,
          avatar: socket.user.avatar,
        });
      } catch (error) {
        console.warn('join:project error', error.message || error);
      }
    });

    socket.on('code:generated', (data) => {
      if (!data?.projectId || !Array.isArray(data.files)) {
        return;
      }
      socket.to(data.projectId).emit('code:generated', {
        projectId: data.projectId,
        files: data.files,
        userId: socket.user._id,
      });
    });

    socket.on('whiteboard:draw', async (data) => {
      if (!data?.projectId || !data?.object) {
        return;
      }

      const isAuthorized = socket.projectAuthCache.get(data.projectId);
      if (!isAuthorized) return;

      socket.to(data.projectId).emit('whiteboard:draw', {
        object: data.object,
        userId: socket.user._id,
      });
    });

    socket.on('whiteboard:sync', async (data) => {
      if (!data?.projectId || !Array.isArray(data.state)) {
        return;
      }

      const isAuthorized = socket.projectAuthCache.get(data.projectId);
      if (!isAuthorized) return;

      socket.to(data.projectId).emit('whiteboard:sync', {
        state: data.state,
        userId: socket.user._id,
      });
    });

    socket.on('whiteboard:clear', async (data) => {
      if (!data?.projectId) {
        return;
      }
      const project = await Project.findById(data.projectId);
      if (!project) return;
      const isAuthorized =
        project.owner.equals(socket.user._id) ||
        (Array.isArray(project.collaborators) && project.collaborators.some((collab) => collab.user.equals(socket.user._id)));
      if (!isAuthorized) return;

      socket.to(data.projectId).emit('whiteboard:clear');
      try {
        await Project.findByIdAndUpdate(data.projectId, { whiteboardState: [] });
      } catch (error) {
        console.warn('whiteboard:clear save failed', error.message || error);
      }
    });

    socket.on('cursor:move', (data) => {
      if (!data?.projectId || typeof data.x !== 'number' || typeof data.y !== 'number') {
        return;
      }
      socket.to(data.projectId).emit('cursor:move', {
        userId: socket.user._id,
        name: socket.user.name,
        x: data.x,
        y: data.y,
      });
    });

    socket.on('chat:message', async (data) => {
      if (!data?.projectId || !data?.content) {
        return;
      }

      try {
        const savedMessage = await Message.create({
          project: data.projectId,
          user: socket.user._id,
          content: data.content,
          type: data.type || 'text',
        });
        await savedMessage.populate('user', 'name avatar');

        io.to(data.projectId).emit('chat:message', savedMessage);
      } catch (error) {
        console.warn('chat:message error', error.message || error);
      }
    });

    socket.on('code:update', async (data) => {
      if (!data?.projectId || !data?.fileId || typeof data.code !== 'string') {
        return;
      }
      socket.to(data.projectId).emit('code:update', {
        projectId: data.projectId,
        fileId: data.fileId,
        code: data.code,
        userId: socket.user._id,
      });

      try {
        await File.findByIdAndUpdate(data.fileId, {
          code: data.code,
          lastEditedBy: socket.user._id,
          lastEditedAt: new Date(),
        });
      } catch (error) {
        console.warn('code:update save failed', error.message || error);
      }
    });

    socket.on('disconnect', async () => {
      try {
        const rooms = Array.from(socket.rooms).filter((room) => room !== socket.id);
        for (const projectId of rooms) {
          await safeHDel(`online:${projectId}`, socket.user._id.toString());
          socket.to(projectId).emit('user:left', {
            userId: socket.user._id,
            name: socket.user.name,
          });
        }
      } catch (error) {
        console.warn('disconnect error', error.message || error);
      }
    });
  });
};

module.exports = { initSocket };
