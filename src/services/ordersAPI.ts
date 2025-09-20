// ordersAPI.js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';

// إنشاء نسخة axios مخصصة لـ ordersAPI
const ordersApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// إضافة interceptors للتعامل مع التوكن
ordersApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(`API request at ${new Date().toISOString()}:`, {
      url: config.url,
      method: config.method,
      headers: config.headers,
    });
    return config;
  },
  (error) => {
    console.error(`API request error at ${new Date().toISOString()}:`, error);
    return Promise.reject(error);
  }
);

ordersApi.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;
    console.error(`API response error at ${new Date().toISOString()}:`, {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    let message = error.response?.data?.message || 'خطأ غير متوقع';
    if (error.response?.status === 400) message = error.response?.data?.message || 'بيانات غير صالحة';
    if (error.response?.status === 403) message = error.response?.data?.message || 'عملية غير مصرح بها';
    if (error.response?.status === 404) message = error.response?.data?.message || 'المورد غير موجود';
    if (error.response?.status === 429) message = 'طلبات كثيرة جدًا، حاول مرة أخرى لاحقًا';
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          console.error(`No refresh token available at ${new Date().toISOString()}`);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          return Promise.reject({ message: 'التوكن منتهي الصلاحية ولا يوجد توكن منعش', status: 401 });
        }
        const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        localStorage.setItem('token', accessToken);
        if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken);
        console.log(`Token refreshed successfully at ${new Date().toISOString()}`);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return ordersApi(originalRequest);
      } catch (refreshError) {
        console.error(`Refresh token failed at ${new Date().toISOString()}:`, refreshError);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject({ message: 'فشل تجديد التوكن', status: 401 });
      }
    }
    return Promise.reject({ message, status: error.response?.status });
  }
);

export const ordersAPI = {
  create: async (orderData) => {
    console.log(`ordersAPI.create - Sending at ${new Date().toISOString()}:`, orderData);
    if (!orderData.branchId || !/^[0-9a-fA-F]{24}$/.test(orderData.branchId)) {
      console.error(`ordersAPI.create - Invalid branchId at ${new Date().toISOString()}:`, orderData.branchId);
      throw new Error('Invalid branch ID');
    }
    const response = await ordersApi.post('/orders', orderData);
    console.log(`ordersAPI.create - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
  getAll: async (params = {}) => {
    const response = await ordersApi.get('/orders', { params });
    console.log(`ordersAPI.getAll - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
  getById: async (id) => {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error(`ordersAPI.getById - Invalid order ID at ${new Date().toISOString()}:`, id);
      throw new Error('Invalid order ID');
    }
    const response = await ordersApi.get(`/orders/${id}`);
    console.log(`ordersAPI.getById - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
  updateStatus: async (id, data) => {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error(`ordersAPI.updateStatus - Invalid order ID at ${new Date().toISOString()}:`, id);
      throw new Error('Invalid order ID');
    }
    const response = await ordersApi.patch(`/orders/${id}/status`, data);
    console.log(`ordersAPI.updateStatus - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
  updateChefItem: async (orderId, data) => {
    if (!/^[0-9a-fA-F]{24}$/.test(orderId) || !/^[0-9a-fA-F]{24}$/.test(data.taskId)) {
      console.error(`ordersAPI.updateChefItem - Invalid order ID or task ID at ${new Date().toISOString()}:`, { orderId, taskId: data.taskId });
      throw new Error('Invalid order ID or task ID');
    }
    const response = await ordersApi.patch(`/orders/${orderId}/tasks/${data.taskId}/status`, { status: data.status });
    console.log(`ordersAPI.updateChefItem - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
  assignChef: async (orderId, data) => {
    console.log(`[${new Date().toISOString()}] ordersAPI.assignChef - Sending:`, { orderId, data });
    if ((orderId) || data.items.some(item => !(item.itemId) || (item.assignedTo))) {
      console.error(`[${new Date().toISOString()}] ordersAPI.assignChef - بيانات غير صالحة:`, { orderId, data });
      throw new Error('معرف الطلب أو معرف العنصر أو معرف الشيف غير صالح');
    }
    try {
      const response = await ordersApi.patch(`/orders/${orderId}/assign`, {
        items: data.items,
        timestamp: new Date().toISOString(),
      });
      console.log(`[${new Date().toISOString()}] ordersAPI.assignChef - Response:`, response);
      return response;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ordersAPI.assignChef - Error:`, error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'خطأ في تعيين الشيف');
    }
  },
  confirmDelivery: async (orderId) => {
    if (!/^[0-9a-fA-F]{24}$/.test(orderId)) {
      console.error(`ordersAPI.confirmDelivery - Invalid order ID at ${new Date().toISOString()}:`, orderId);
      throw new Error('Invalid order ID');
    }
    console.log(`ordersAPI.confirmDelivery - Sending at ${new Date().toISOString()}:`, { orderId });
    const response = await ordersApi.patch(`/orders/${orderId}/confirm-delivery`);
    console.log(`ordersAPI.confirmDelivery - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
};

export default ordersAPI;