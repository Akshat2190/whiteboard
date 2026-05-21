import api from './api';

export const authService = {
  async register(name, email, password) {
    const response = await api.post('/api/auth/register', { name, email, password });
    const { accessToken, refreshToken } = response.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    return response.data;
  },

  async login(email, password) {
    const response = await api.post('/api/auth/login', { email, password });
    const { accessToken, refreshToken } = response.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    return response.data;
  },

  async logout() {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        await api.post('/api/auth/logout', { refreshToken });
      }
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  },

  async getMe() {
    const response = await api.get('/api/auth/me');
    return response.data;
  },

  async refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token found');
    }
    const response = await api.post('/api/auth/refresh', { refreshToken });
    const { accessToken } = response.data;
    localStorage.setItem('accessToken', accessToken);
    return response.data;
  },
};
