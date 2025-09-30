import axios from 'axios';
import axiosRetry from 'axios-retry';
import { toast } from 'react-toastify';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';

const notificationsAxios = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

axiosRetry(notificationsAxios, { retries: 3, retryDelay: (retryCount) => retryCount * 1000 });

notificationsAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(`[${new Date().toISOString()}] Notifications API request:`, {
      url: config.url,
      method: config.method,
      headers: config.headers,
    });
    return config;
  },
  (error) => {
    console.error(`[${new Date().toISOString()}] Notifications API request error:`, error);
    return Promise.reject(error);
  }
);

notificationsAxios.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;
    console.error(`[${new Date().toISOString()}] Notifications API response error:`, {
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
          console.error(`[${new Date().toISOString()}] No refresh token available`);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          toast.error('التوكن منتهي الصلاحية، يرجى تسجيل الدخول مجددًا', {
            position: 'top-right',
            autoClose: 3000,
            pauseOnFocusLoss: true,
          });
          return Promise.reject({ message: 'التوكن منتهي الصلاحية ولا يوجد توكن منعش', status: 401 });
        }
        const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        localStorage.setItem('token', accessToken);
        if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken);
        console.log(`[${new Date().toISOString()}] Token refreshed successfully`);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return notificationsAxios(originalRequest);
      } catch (refreshError) {
        console.error(`[${new Date().toISOString()}] Refresh token failed:`, refreshError);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        toast.error('فشل تجديد التوكن، يرجى تسجيل الدخول مجددًا', {
          position: 'top-right',
          autoClose: 3000,
          pauseOnFocusLoss: true,
        });
        return Promise.reject({ message: 'فشل تجديد التوكن', status: 401 });
      }
    }

    toast.error(message, { position: 'top-right', autoClose: 3000, pauseOnFocusLoss: true });
    return Promise.reject({ message, status: error.response?.status });
  }
);

export const notificationsAPI = {
  create: async <T extends { user: string; type: string; message: string; data?: any }>(notificationData: T) => {
    if (!/^[0-9a-fA-F]{24}$/.test(notificationData.user)) {
      console.error(`[${new Date().toISOString()}] Invalid user ID:`, notificationData.user);
      throw new Error('معرف المستخدم غير صالح');
    }
    if (notificationData.data?.orderId && !/^[0-9a-fA-F]{24}$/.test(notificationData.data.orderId)) {
      console.error(`[${new Date().toISOString()}] Invalid order ID:`, notificationData.data.orderId);
      throw new Error('معرف الطلب غير صالح');
    }
    try {
      const response = await notificationsAxios.post('/notifications', {
        user: notificationData.user,
        type: notificationData.type,
        message: notificationData.message.trim(),
        data: {
          ...notificationData.data,
          eventId: notificationData.data?.eventId || crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      });
      console.log(`[${new Date().toISOString()}] notificationsAPI.create - Response:`, response);
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] notificationsAPI.create - Error:`, err);
      throw err;
    }
  },

  getAll: async (params: { userId?: string; read?: boolean; page?: number; limit?: number; departmentId?: string; branchId?: string; chefId?: string } = {}) => {
    if (params.userId && !/^[0-9a-fA-F]{24}$/.test(params.userId)) {
      console.error(`[${new Date().toISOString()}] Invalid user ID:`, params.userId);
      throw new Error('معرف المستخدم غير صالح');
    }
    try {
      const response = await notificationsAxios.get('/notifications', { params });
      console.log(`[${new Date().toISOString()}] notificationsAPI.getAll - Response:`, response);
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] notificationsAPI.getAll - Error:`, err);
      throw err;
    }
  },

  getById: async (id: string) => {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error(`[${new Date().toISOString()}] Invalid notification ID:`, id);
      throw new Error('معرف الإشعار غير صالح');
    }
    try {
      const response = await notificationsAxios.get(`/notifications/${id}`);
      console.log(`[${new Date().toISOString()}] notificationsAPI.getById - Response:`, response);
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] notificationsAPI.getById - Error:`, err);
      throw err;
    }
  },

  markAsRead: async (id: string) => {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error(`[${new Date().toISOString()}] Invalid notification ID:`, id);
      throw new Error('معرف الإشعار غير صالح');
    }
    try {
      const response = await notificationsAxios.patch(`/notifications/${id}/read`, {});
      console.log(`[${new Date().toISOString()}] notificationsAPI.markAsRead - Response:`, response);
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] notificationsAPI.markAsRead - Error:`, err);
      throw err;
    }
  },

  markAllAsRead: async (userId: string) => {
    if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
      console.error(`[${new Date().toISOString()}] Invalid user ID:`, userId);
      throw new Error('معرف المستخدم غير صالح');
    }
    try {
      const response = await notificationsAxios.patch(`/notifications/mark-all-read`, { user: userId });
      console.log(`[${new Date().toISOString()}] notificationsAPI.markAllAsRead - Response:`, response);
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] notificationsAPI.markAllAsRead - Error:`, err);
      throw err;
    }
  },

  clear: async () => {
    try {
      const response = await notificationsAxios.delete(`/notifications/clear`);
      console.log(`[${new Date().toISOString()}] notificationsAPI.clear - Response:`, response);
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] notificationsAPI.clear - Error:`, err);
      throw err;
    }
  },
};

export default notificationsAPI;