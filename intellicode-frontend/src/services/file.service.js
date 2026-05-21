import api from './api';

export const fileService = {
  async getFiles(projectId) {
    const response = await api.get(`/api/files/project/${projectId}`);
    return response.data;
  },

  async getFile(fileId) {
    const response = await api.get(`/api/files/${fileId}`);
    return response.data;
  },

  async updateFile(fileId, code) {
    const response = await api.put(`/api/files/${fileId}`, { code });
    return response.data;
  },

  async deleteFile(fileId) {
    const response = await api.delete(`/api/files/${fileId}`);
    return response.data;
  },
};
