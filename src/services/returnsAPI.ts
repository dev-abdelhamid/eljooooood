import api from './api';

export const returnsAPI = {
  getAll: async (query = {}) => {
    console.log(`[${new Date().toISOString()}] returnsAPI.getAll - Sending:`, query);
    try {
      const response = await api.get('/returns', { params: query });
      console.log(`[${new Date().toISOString()}] returnsAPI.getAll - Response:`, response);
      return response;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] returnsAPI.getAll - Error:`, error);
      throw error;
    }
  },

  getById: async (id) => {
    console.log(`[${new Date().toISOString()}] returnsAPI.getById - Sending:`, id);
    try {
      const response = await api.get(`/returns/${id}`);
      console.log(`[${new Date().toISOString()}] returnsAPI.getById - Response:`, response);
      return response;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] returnsAPI.getById - Error:`, error);
      throw error;
    }
  },

  createReturn: async (data) => {
    console.log(`[${new Date().toISOString()}] returnsAPI.createReturn - Sending:`, data);
    try {
      const response = await api.post('/returns', data);
      console.log(`[${new Date().toISOString()}] returnsAPI.createReturn - Response:`, response);
      return response;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] returnsAPI.createReturn - Error:`, error);
      throw error;
    }
  },

  updateReturnStatus: async (returnId, data) => {
    console.log(`[${new Date().toISOString()}] returnsAPI.updateReturnStatus - Sending:`, { returnId, data });
    try {
      const response = await api.put(`/returns/${returnId}`, data);
      console.log(`[${new Date().toISOString()}] returnsAPI.updateReturnStatus - Response:`, response);
      return response;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] returnsAPI.updateReturnStatus - Error:`, error);
      throw error;
    }
  },

  getBranches: async () => {
    console.log(`[${new Date().toISOString()}] returnsAPI.getBranches - Sending`);
    try {
      const response = await api.get('/branches');
      console.log(`[${new Date().toISOString()}] returnsAPI.getBranches - Response:`, response);
      return response;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] returnsAPI.getBranches - Error:`, error);
      throw error;
    }
  },
};