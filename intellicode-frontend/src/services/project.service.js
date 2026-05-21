import api from './api';

export const projectService = {
  async createProject(name) {
    const response = await api.post('/api/projects', { name });
    return response.data;
  },

  async getProjects() {
    const response = await api.get('/api/projects');
    return response.data;
  },

  async getProject(id) {
    const response = await api.get(`/api/projects/${id}`);
    return response.data;
  },

  async updateProject(id, name) {
    const response = await api.put(`/api/projects/${id}`, { name });
    return response.data;
  },

  async deleteProject(id) {
    const response = await api.delete(`/api/projects/${id}`);
    return response.data;
  },

  async addCollaborator(projectId, email) {
    const response = await api.post(`/api/projects/${projectId}/collaborators`, { email });
    return response.data;
  },

  async removeCollaborator(projectId, userId) {
    const response = await api.delete(`/api/projects/${projectId}/collaborators/${userId}`);
    return response.data;
  },

  async saveWhiteboard(projectId, state) {
    const response = await api.put(`/api/projects/${projectId}/whiteboard`, { state });
    return response.data;
  },

  async getWhiteboard(projectId) {
    const response = await api.get(`/api/projects/${projectId}/whiteboard`);
    return response.data;
  },
};
