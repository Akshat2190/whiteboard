const jwt = require('jsonwebtoken');
const redisClient = require('../config/redis');
const User = require('../models/User.model');

const signTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  });

  return { accessToken, refreshToken };
};

const safeStoreRefreshToken = async (userId, refreshToken) => {
  try {
    await redisClient.set(`refresh:${userId}`, refreshToken, 'EX', 60 * 60 * 24 * 30);
  } catch (error) {
    console.warn('Redis unavailable, refresh token not stored:', error.message || error);
  }
};

const safeDeleteRefreshToken = async (userId) => {
  try {
    await redisClient.del(`refresh:${userId}`);
  } catch (error) {
    console.warn('Redis unavailable, refresh token deletion skipped:', error.message || error);
  }
};

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required' });
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }

    const user = await User.create({ name, email, password });
    const { accessToken, refreshToken } = signTokens(user._id);

    await safeStoreRefreshToken(user._id, refreshToken);

    res.status(201).json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = signTokens(user._id);
    await safeStoreRefreshToken(user._id, refreshToken);

    res.status(200).json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    let storedToken;
    try {
      storedToken = await redisClient.get(`refresh:${decoded.id}`);
    } catch (error) {
      console.warn('Redis unavailable during refresh token validation:', error.message || error);
      storedToken = null;
    }

    if (!storedToken || storedToken !== refreshToken) {
      return res.status(401).json({ success: false, error: 'Refresh token expired or invalid' });
    }

    const accessToken = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });

    res.status(200).json({ success: true, accessToken });
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Refresh token expired or invalid' });
  }
};

const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    await safeDeleteRefreshToken(decoded.id);

    res.status(200).json({ success: true, message: 'Logged out' });
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Refresh token expired or invalid' });
  }
};

const getMe = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, user: req.user });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getMe,
};
