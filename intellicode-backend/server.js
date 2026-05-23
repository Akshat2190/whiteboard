require('dotenv').config();
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
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

  // Redis is optional for local dev. If it is unavailable, the app will still start.
  if (process.env.REDIS_URL) {
    console.log('Redis configured, will connect on demand if available.');
  }

  const app = express();
  app.disable('etag');
  app.use(helmet());
  app.set('trust proxy', 1);

  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://localhost:5000',
    process.env.CLIENT_URL,
  ].filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, Postman)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not allowed`));
      },
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(morgan('dev'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
    next();
  });

  app.get('/', (req, res) => {
    res.json({ success: true, message: 'IntelliCode API is running' });
  });

  app.get('/favicon.ico', (req, res) => {
    res.sendStatus(204);
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/files', fileRoutes);
  app.use('/api/generate', generateRoutes);

  app.use(errorHandler);

  const server = http.createServer(app);
  const { Server } = require('socket.io');
  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`Socket CORS: origin ${origin} not allowed`));
      },
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
