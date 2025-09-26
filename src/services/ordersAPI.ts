import axios from 'axios';
import axiosRetry from 'axios-retry';
import { toast } from 'react-toastify';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';
const isRtl = localStorage.getItem('language') === 'ar';

const ordersAxios = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  params: { isRtl: isRtl.toString() },
});

axiosRetry(ordersAxios, { retries: 3, retryDelay: (retryCount) => retryCount * 1000 });

ordersAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(`[${new Date().toISOString()}] Orders API request:`, {
      url: config.url,
      method: config.method,
      headers: config.headers,
      params: config.params,
    });
    return config;
  },
  (error) => {
    console.error(`[${new Date().toISOString()}] Orders API request error:`, error);
    return Promise.reject(error);
  }
);

ordersAxios.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;
    console.error(`[${new Date().toISOString()}] Orders API response error:`, {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });

    let message = error.response?.data?.message || (isRtl ? 'خطأ غير متوقع' : 'Unexpected error');
    if (error.response?.status === 400) {
      message = error.response?.data?.message || (isRtl ? 'بيانات غير صالحة' : 'Invalid data');
      if (error.response?.data?.field) {
        message = `${message}: ${error.response.data.field} = ${error.response.data.value}`;
      }
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
          toast.error(isRtl ? 'التوكن منتهي الصلاحية، يرجى تسجيل الدخول مجددًا' : 'Token expired, please log in again', {
            position: 'top-right',
            autoClose: 3000,
            pauseOnFocusLoss: true,
          });
          return Promise.reject({ message: isRtl ? 'التوكن منتهي الصلاحية ولا يوجد توكن منعش' : 'Token expired and no refresh token available', status: 401 });
        }
        const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        localStorage.setItem('token', accessToken);
        if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken);
        console.log(`[${new Date().toISOString()}] Token refreshed successfully`);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return ordersAxios(originalRequest);
      } catch (refreshError) {
        console.error(`[${new Date().toISOString()}] Refresh token failed:`, refreshError);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        toast.error(isRtl ? 'فشل تجديد التوكن، يرجى تسجيل الدخول مجددًا' : 'Failed to refresh token, please log in again', {
          position: 'top-right',
          autoClose: 3000,
          pauseOnFocusLoss: true,
        });
        return Promise.reject({ message: isRtl ? 'فشل تجديد التوكن' : 'Failed to refresh token', status: 401 });
      }
    }

    toast.error(message, { position: 'top-right', autoClose: 3000, pauseOnFocusLoss: true });
    return Promise.reject({ message, status: error.response?.status });
  }
);

const isValidObjectId = (id: string): boolean => /^[0-9a-fA-F]{24}$/.test(id);

export const ordersAPI = {
  create: async (orderData: {
    orderNumber: string;
    branchId: string;
    items: Array<{ productId: string; quantity: number; price: number; department?: { _id: string } }>;
    status: string;
    notes?: string;
    priority?: string;
    requestedDeliveryDate: string;
  }) => {
    console.log(`[${new Date().toISOString()}] ordersAPI.create - Sending:`, orderData);
    if (!isValidObjectId(orderData.branchId)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.create - Invalid branchId:`, orderData.branchId);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
    }
    if (orderData.items.some(item => !isValidObjectId(item.productId) || item.quantity < 1)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.create - Invalid items:`, orderData.items);
      throw new Error(isRtl ? 'بيانات العناصر غير صالحة' : 'Invalid items data');
    }
    try {
      const response = await ordersAxios.post('/orders', orderData);
      console.log(`[${new Date().toISOString()}] ordersAPI.create - Response:`, response);
      return response;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] ordersAPI.create - Error:`, error);
      throw error;
    }
  },

  getAll: async (params: {
    status?: string;
    branch?: string;
    page?: number;
    limit?: number;
    department?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}) => {
    if (params.branch && !isValidObjectId(params.branch)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.getAll - Invalid branch ID:`, params.branch);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
    }
    if (params.department && !isValidObjectId(params.department)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.getAll - Invalid department ID:`, params.department);
      throw new Error(isRtl ? 'معرف القسم غير صالح' : 'Invalid department ID');
    }
    try {
      const response = await ordersAxios.get('/orders', { params });
      console.log(`[${new Date().toISOString()}] ordersAPI.getAll - Response:`, response);
      return response;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] ordersAPI.getAll - Error:`, error);
      throw error;
    }
  },

  getById: async (id: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.getById - Invalid order ID:`, id);
      throw new Error(isRtl ? 'معرف الطلب غير صالح' : 'Invalid order ID');
    }
    try {
      const response = await ordersAxios.get(`/orders/${id}`);
      console.log(`[${new Date().toISOString()}] ordersAPI.getById - Response:`, response);
      return response;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] ordersAPI.getById - Error:`, error);
      throw error;
    }
  },

  updateStatus: async (id: string, data: { status: string; notes?: string }) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.updateStatus - Invalid order ID:`, id);
      throw new Error(isRtl ? 'معرف الطلب غير صالح' : 'Invalid order ID');
    }
    try {
      const response = await ordersAxios.patch(`/orders/${id}/status`, {
        status: data.status,
        notes: data.notes?.trim(),
      });
      console.log(`[${new Date().toISOString()}] ordersAPI.updateStatus - Response:`, response);
      return response;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] ordersAPI.updateStatus - Error:`, error);
      throw error;
    }
  },

  updateChefItem: async (orderId: string, data: { taskId: string; status: string }) => {
    if (!isValidObjectId(orderId) || !isValidObjectId(data.taskId)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.updateChefItem - Invalid order ID or task ID:`, { orderId, taskId: data.taskId });
      throw new Error(isRtl ? 'معرف الطلب أو المهمة غير صالح' : 'Invalid order ID or task ID');
    }
    try {
      const response = await ordersAxios.patch(`/orders/${orderId}/tasks/${data.taskId}/status`, { status: data.status });
      console.log(`[${new Date().toISOString()}] ordersAPI.updateChefItem - Response:`, response);
      return response;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] ordersAPI.updateChefItem - Error:`, error);
      throw error;
    }
  },

  assignChef: async (orderId: string, data: { items: Array<{ itemId: string; assignedTo: string }> }) => {
    console.log(`[${new Date().toISOString()}] ordersAPI.assignChef - Sending:`, { orderId, data });
    if (!isValidObjectId(orderId) || data.items.some(item => !isValidObjectId(item.itemId) || !isValidObjectId(item.assignedTo))) {
      console.error(`[${new Date().toISOString()}] ordersAPI.assignChef - Invalid data:`, { orderId, data });
      throw new Error(isRtl ? 'معرف الطلب، العنصر، أو الشيف غير صالح' : 'Invalid order ID, item ID, or chef ID');
    }
    try {
      const response = await ordersAxios.patch(`/orders/${orderId}/assign`, {
        items: data.items,
        timestamp: new Date().toISOString(),
      });
      console.log(`[${new Date().toISOString()}] ordersAPI.assignChef - Response:`, response);
      return response;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] ordersAPI.assignChef - Error:`, error);
      throw error;
    }
  },

  confirmDelivery: async (orderId: string) => {
    if (!isValidObjectId(orderId)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.confirmDelivery - Invalid order ID:`, orderId);
      throw new Error(isRtl ? 'معرف الطلب غير صالح' : 'Invalid order ID');
    }
    try {
      const response = await ordersAxios.patch(`/orders/${orderId}/confirm-delivery`, {});
      console.log(`[${new Date().toISOString()}] ordersAPI.confirmDelivery - Response:`, response);
      return response;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] ordersAPI.confirmDelivery - Error:`, error);
      throw error;
    }
  },
};

export default ordersAPI;