import axios from 'axios';
import axiosRetry from 'axios-retry';
import { toast } from 'react-toastify';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';

const notificationsAxios = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

axiosRetry(notificationsAxios, { retries: 3, retryDelay: (retryCount) => retryCount * 1000 });

notificationsAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

notificationsAxios.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;
    let message = error.response?.data?.message || 'خطأ غير متوقع';
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          localStorage.clear();
          window.location.href = '/login';
          toast.error('التوكن منتهي الصلاحية', { position: 'top-right' });
          return Promise.reject({ message: 'التوكن منتهي الصلاحية', status: 401 });
        }
        const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        localStorage.setItem('token', accessToken);
        if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return notificationsAxios(originalRequest);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
        toast.error('فشل تجديد التوكن', { position: 'top-right' });
        return Promise.reject({ message: 'فشل تجديد التوكن', status: 401 });
      }
    }
    toast.error(message, { position: 'top-right' });
    return Promise.reject({ message, status: error.response?.status });
  }
);

interface NotificationData {
  user: string;
  type: string;
  message: string;
  data?: { orderId?: string; branchId?: string; chefId?: string; taskId?: string; returnId?: string; eventId?: string };
}

export const notificationsAPI = {
  create: async (notificationData: NotificationData) => {
    if (!/^[0-9a-fA-F]{24}$/.test(notificationData.user)) {
      throw new Error('معرف المستخدم غير صالح');
    }
    return notificationsAxios.post('/notifications', {
      ...notificationData,
      data: { ...notificationData.data, eventId: notificationData.data?.eventId || crypto.randomUUID() },
    });
  },
  getAll: async (params: { userId?: string; limit?: number; departmentId?: string; branchId?: string; chefId?: string } = {}) => {
    if (params.userId && !/^[0-9a-fA-F]{24}$/.test(params.userId)) {
      throw new Error('معرف المستخدم غير صالح');
    }
    return notificationsAxios.get('/notifications', { params });
  },
  markAsRead: async (id: string) => {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      throw new Error('معرف الإشعار غير صالح');
    }
    return notificationsAxios.patch(`/notifications/${id}/read`, {});
  },
  markAllAsRead: async (userId: string) => {
    if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
      throw new Error('معرف المستخدم غير صالح');
    }
    return notificationsAxios.patch(`/notifications/mark-all-read`, { user: userId });
  },
  clear: async () => {
    return notificationsAxios.delete('/notifications/clear');
  },
};

export default notificationsAPI;