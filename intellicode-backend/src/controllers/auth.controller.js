const jwt = require('jsonwebtoken');
const redisClient = require('../config/redis');
const User = require('../models/User.model');

const parseExpiresInToMs = (value) => {
  if (!value) return 0;
  const match = /^([0-9]+)(s|m|h|d)?$/i.exec(value);
  if (!match) {
    return Number(value) || 0;
  }

  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase();

  switch (unit) {
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 60 * 1000;
    case 'h':
      return amount * 60 * 60 * 1000;
    case 'd':
      return amount * 24 * 60 * 60 * 1000;
    default:
      return amount;
  }
};

const getCookieOptions = (maxAgeMs) => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: maxAgeMs,
  };
};

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
    const { name, email: rawEmail, password } = req.body;
    const email = rawEmail?.trim().toLowerCase();

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
    const refreshMaxAge = parseExpiresInToMs(process.env.JWT_REFRESH_EXPIRES_IN) || 30 * 24 * 60 * 60 * 1000;
    const accessMaxAge = parseExpiresInToMs(process.env.JWT_EXPIRES_IN) || 60 * 60 * 1000;

    res.cookie('refreshToken', refreshToken, getCookieOptions(refreshMaxAge));
    res.cookie('accessToken', accessToken, getCookieOptions(accessMaxAge));

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
    let { email, password } = req.body;
    email = email?.trim().toLowerCase();
    password = password?.trim();

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
    const refreshMaxAge = parseExpiresInToMs(process.env.JWT_REFRESH_EXPIRES_IN) || 30 * 24 * 60 * 60 * 1000;
    const accessMaxAge = parseExpiresInToMs(process.env.JWT_EXPIRES_IN) || 60 * 60 * 1000;

    res.cookie('refreshToken', refreshToken, getCookieOptions(refreshMaxAge));
    res.cookie('accessToken', accessToken, getCookieOptions(accessMaxAge));

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
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
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

    const { accessToken, refreshToken: newRefreshToken } = signTokens(decoded.id);
    await safeStoreRefreshToken(decoded.id, newRefreshToken);

    const refreshMaxAge = parseExpiresInToMs(process.env.JWT_REFRESH_EXPIRES_IN) || 30 * 24 * 60 * 60 * 1000;
    const accessMaxAge = parseExpiresInToMs(process.env.JWT_EXPIRES_IN) || 60 * 60 * 1000;

    res.cookie('refreshToken', newRefreshToken, getCookieOptions(refreshMaxAge));
    res.cookie('accessToken', accessToken, getCookieOptions(accessMaxAge));

    res.status(200).json({ success: true, accessToken });
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Refresh token expired or invalid' });
  }
};

const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    await safeDeleteRefreshToken(decoded.id);

    res.clearCookie('refreshToken', getCookieOptions(0));
    res.clearCookie('accessToken', getCookieOptions(0));

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
