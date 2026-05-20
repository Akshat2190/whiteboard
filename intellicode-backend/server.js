require('dotenv').config();
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./src/config/db');
const redisClient = require('./src/config/redis');
const authRoutes = require('./src/routes/auth.routes');
const projectRoutes = require('./src/routes/project.routes');
const fileRoutes = require('./src/routes/file.routes');
const generateRoutes = require('./src/routes/generate.routes');
const errorHandler = require('./src/middleware/error.middleware');
const { initSocket } = require('./src/socket/socket');

const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectDB();

  redisClient.on('error', (err) => {
    console.warn('Redis warning:', err.message || err);
  });

  redisClient.on('connect', () => {
    console.log('Redis connected');
  });

  const app = express();
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CLIENT_URL,
      credentials: true,
    })
  );
  app.use(morgan('dev'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/files', fileRoutes);
  app.use('/api/generate', generateRoutes);

  app.use(errorHandler);

  const server = http.createServer(app);
  const { Server } = require('socket.io');
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true,
    },
  });

  initSocket(io);

  const listenOnPort = (port) =>
    new Promise((resolve, reject) => {
      server.once('listening', () => resolve(port));
      server.once('error', reject);
      server.listen(port);
    });

  const startOnAvailablePort = async (startingPort, maxAttempts = 10) => {
    let port = Number(startingPort);
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        await listenOnPort(port);
        return port;
      } catch (error) {
        if (error.code !== 'EADDRINUSE') {
          throw error;
        }
        console.warn(`Port ${port} is in use, trying port ${port + 1}`);
        port += 1;
      }
    }
    throw new Error(`No available port found between ${startingPort} and ${port}`);
  };

  const boundPort = await startOnAvailablePort(PORT);
  console.log(`IntelliCode server running on port ${boundPort}`);
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
