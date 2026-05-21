import api from './api';

export const generateService = {
  async generateCode(projectId, objects) {
    const response = await api.post(`/api/generate/${projectId}`, { objects });
    return response.data;
  },
};
