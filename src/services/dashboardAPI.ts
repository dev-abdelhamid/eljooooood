import api from './apiConfig';

export const dashboardAPI = {
  getStats: async (params = {}) => {
    try {
      const response = await api.get('/dashboard', { params });
      console.log(`[${new Date().toISOString()}] dashboardAPI.getStats - Response:`, response);
      return response;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] dashboardAPI.getStats - Error:`, error);
      throw error;
    }
  },

  getSalesAnalytics: async (params = {}) => {
    try {
      const response = await api.get('/dashboard/sales-analytics', { params });
      console.log(`[${new Date().toISOString()}] dashboardAPI.getSalesAnalytics - Response:`, response);
      return response;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] dashboardAPI.getSalesAnalytics - Error:`, error);
      throw error;
    }
  },

  getRecentActivities: async (params = {}) => {
    try {
      const response = await api.get('/dashboard/recent-activities', { params });
      console.log(`[${new Date().toISOString()}] dashboardAPI.getRecentActivities - Response:`, response);
      return response;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] dashboardAPI.getRecentActivities - Error:`, error);
      throw error;
    }
  },

  getTopProducts: async (branchId = null) => {
    try {
      const params = branchId ? { branchId } : {};
      const response = await api.get('/dashboard/top-products', { params });
      console.log(`[${new Date().toISOString()}] dashboardAPI.getTopProducts - Response:`, response);
      return response;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] dashboardAPI.getTopProducts - Error:`, error);
      throw error;
    }
  },

  getPendingReviews: async () => {
    try {
      const response = await api.get('/dashboard/pending-reviews');
      console.log(`[${new Date().toISOString()}] dashboardAPI.getPendingReviews - Response:`, response);
      return response;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] dashboardAPI.getPendingReviews - Error:`, error);
      throw error;
    }
  },

  getChefsPerformance: async () => {
    try {
      const response = await api.get('/dashboard/chefs-performance');
      console.log(`[${new Date().toISOString()}] dashboardAPI.getChefsPerformance - Response:`, response);
      return response;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] dashboardAPI.getChefsPerformance - Error:`, error);
      throw error;
    }
  },

  getChefTasks: async (chefId) => {
    try {
      if (!/^[0-9a-fA-F]{24}$/.test(chefId)) {
        throw new Error('معرف الشيف غير صالح');
      }
      const response = await api.get(`/dashboard/chef-tasks/${chefId}`);
      console.log(`[${new Date().toISOString()}] dashboardAPI.getChefTasks - Response:`, response);
      return response;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] dashboardAPI.getChefTasks - Error:`, error);
      throw error;
    }
  },
};