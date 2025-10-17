import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';

const factoryApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

factoryApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const language = localStorage.getItem('language') || 'en';
    config.params = { ...config.params, lang: language };
    console.log(`[${new Date().toISOString()}] Factory API request:`, {
      url: config.url,
      method: config.method,
      headers: config.headers,
      params: config.params,
    });
    return config;
  },
  (error) => {
    console.error(`[${new Date().toISOString()}] Factory API request error:`, error);
    return Promise.reject(error);
  }
);

factoryApi.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;
    console.error(`[${new Date().toISOString()}] Factory API response error:`, {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    const isRtl = localStorage.getItem('language') === 'ar';
    let message = error.response?.data?.message || (isRtl ? 'خطأ غير متوقع' : 'Unexpected error');
    if (error.response?.status === 400) {
      message = error.response?.data?.message || (isRtl ? 'بيانات غير صالحة' : 'Invalid data');
    }
    if (error.response?.status === 403) message = error.response?.data?.message || (isRtl ? 'عملية غير مصرح بها' : 'Unauthorized operation');
    if (error.response?.status === 404) message = error.response?.data?.message || (isRtl ? 'المورد غير موجود' : 'Resource not found');
    if (error.response?.status === 429) message = isRtl ? 'طلبات كثيرة جدًا، حاول مرة أخرى لاحقًا' : 'Too many requests, try again later';
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          console.error(`[${new Date().toISOString()}] No refresh token available`);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          return Promise.reject({ message: isRtl ? 'التوكن منتهي الصلاحية ولا يوجد توكن منعش' : 'Token expired and no refresh token available', status: 401 });
        }
        const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        localStorage.setItem('token', accessToken);
        if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken);
        console.log(`[${new Date().toISOString()}] Token refreshed successfully`);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return factoryApi(originalRequest);
      } catch (refreshError) {
        console.error(`[${new Date().toISOString()}] Refresh token failed:`, refreshError);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject({ message: isRtl ? 'فشل تجديد التوكن' : 'Failed to refresh token', status: 401 });
      }
    }
    return Promise.reject({ message, status: error.response?.status });
  }
);

export const factoryInventoryAPI = {
  getFactoryInventory: async (params = {}) => {
    if (params.product && !isValidObjectId(params.product)) {
      throw new Error('Invalid product ID');
    }
    if (params.department && !isValidObjectId(params.department)) {
      throw new Error('Invalid department ID');
    }
    const response = await factoryApi.get('/factory', { params });
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.getFactoryInventory - Response:`, response);
    return response.inventory || [];
  },

  createFactoryProductionRequest: async (data) => {
    if (!['branch', 'production'].includes(data.type)) {
      throw new Error('Invalid request type');
    }
    if (data.type === 'branch' && !isValidObjectId(data.branchId)) {
      throw new Error('Invalid branch ID');
    }
    if (!Array.isArray(data.items) || data.items.length === 0 || data.items.some(item => !isValidObjectId(item.productId) || item.quantity < 1)) {
      throw new Error('Invalid items');
    }
    const response = await factoryApi.post('/factory/production-requests', {
      type: data.type,
      branchId: data.type === 'branch' ? data.branchId : null,
      items: data.items,
      notes: data.notes?.trim(),
    });
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.createFactoryProductionRequest - Response:`, response);
    return response.request;
  },

  assignChefToRequest: async (data) => {
    if (!isValidObjectId(data.requestId) || !isValidObjectId(data.chefId)) {
      throw new Error('Invalid request ID or chef ID');
    }
    const response = await factoryApi.put('/factory/production-requests/assign', {
      requestId: data.requestId,
      chefId: data.chefId,
    });
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.assignChefToRequest - Response:`, response);
    return response.request;
  },

  completeProductionRequest: async (requestId) => {
    if (!isValidObjectId(requestId)) {
      throw new Error('Invalid request ID');
    }
    const response = await factoryApi.put(`/factory/production-requests/${requestId}/complete`);
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.completeProductionRequest - Response:`, response);
    return response.request;
  },

  getFactoryProductionRequests: async (params = {}) => {
    if (params.type && !['branch', 'production'].includes(params.type)) {
      throw new Error('Invalid request type');
    }
    if (params.status && !['pending', 'assigned', 'in_progress', 'completed', 'delivered', 'rejected'].includes(params.status)) {
      throw new Error('Invalid request status');
    }
    const response = await factoryApi.get('/factory/production-requests', { params });
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.getFactoryProductionRequests - Response:`, response);
    return response.requests || [];
  },

  getFactoryInventoryHistory: async (params = {}) => {
    if (params.productId && !isValidObjectId(params.productId)) {
      throw new Error('Invalid product ID');
    }
    if (params.period && !['daily', 'weekly', 'monthly'].includes(params.period)) {
      throw new Error('Invalid period');
    }
    if (params.groupBy && !['day', 'week', 'month'].includes(params.groupBy)) {
      throw new Error('Invalid groupBy');
    }
    const response = await factoryApi.get('/factory/history', { params });
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.getFactoryInventoryHistory - Response:`, response);
    return response.history || [];
  },
};

export default factoryApi;