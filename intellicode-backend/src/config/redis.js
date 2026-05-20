const Redis = require('ioredis');

const client = new Redis(process.env.REDIS_URL, {
  lazyConnect: true,
  enableReadyCheck: false,
  maxRetriesPerRequest: 1,
  retryStrategy: () => null,
  connectTimeout: 10000,
});

let redisWarningLogged = false;

client.on('error', (error) => {
  if (!redisWarningLogged) {
    console.warn('Redis warning:', error.message || error);
    redisWarningLogged = true;
  }
});

client.on('connect', () => {
  console.log('Redis connected');
});

module.exports = client;
