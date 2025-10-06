typescript
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { toast } from 'react-toastify';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

axiosRetry(api, { retries: 3, retryDelay: (retryCount) => retryCount * 1000 });

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const language = localStorage.getItem('language') || 'en';
    config.params = { ...config.params, lang: language };
    console.log(`[${new Date().to aeruginosa()}] API request:`, {
      url: config.url,
      method: config.method,
      headers: config.headers,
      params: config.params,
    });
    return config;
  },
  (error) => {
    console.error(`[${new Date().toISOString()}] API request error:`, error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;
    console.error(`[${new Date().toISOString()}] API response error:`, {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });

    let message = error.response?.data?.message || 'Unexpected error';
    const isRtl = localStorage.getItem('language') === 'ar';
    if (error.response?.status === 400) message = error.response?.data?.message || (isRtl ? 'بيانات غير صالحة' : 'Invalid data');
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
        return api(originalRequest);
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

export const inventoryAPI = {
  getByBranch: async (branchId: string) => {
    if (!isValidObjectId(branchId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getByBranch - Invalid branch ID:`, branchId);
      throw new Error('Invalid branch ID');
    }
    const response = await api.get(`/inventory/branch/${branchId}`);
    console.log(`[${new Date().toISOString()}] inventoryAPI.getByBranch - Response:`, response);
    return response.inventory;
  },
  updateStock: async (id: string, data: Partial<{
    minStockLevel: number;
    maxStockLevel: number;
  }>) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStock - Invalid inventory ID:`, id);
      throw new Error('Invalid inventory ID');
    }
    if (data.minStockLevel !== undefined && data.maxStockLevel !== undefined && data.maxStockLevel < data.minStockLevel) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStock - Max stock less than min stock:`, data);
      throw new Error('Maximum stock must be greater than or equal to minimum stock');
    }
    const response = await api.put(`/inventory/${id}`, {
      minStockLevel: data.minStockLevel,
      maxStockLevel: data.maxStockLevel,
    });
    console.log(`[${new Date().toISOString()}] inventoryAPI.updateStock - Response:`, response);
    return response.inventory;
  },
  getHistory: async (params: { branchId?: string; productId?: string }) => {
    if (params.branchId && !isValidObjectId(params.branchId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getHistory - Invalid branch ID:`, params.branchId);
      throw new Error('Invalid branch ID');
    }
    if (params.productId && !isValidObjectId(params.productId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getHistory - Invalid product ID:`, params.productId);
      throw new Error('Invalid product ID');
    }
    const response = await api.get('/inventory/history', { params });
    console.log(`[${new Date().toISOString()}] inventoryAPI.getHistory - Response:`, response);
    return response.history;
  },
};

export const returnAPI = {
  createReturnRequest: async (data: {
    branchId: string;
    items: Array<{ product: string; quantity: number; reason: string; notes?: string }>;
    reason: string;
    notes?: string;
  }) => {
    if (!isValidObjectId(data.branchId) || !data.items?.length || !data.reason) {
      console.error(`[${new Date().toISOString()}] returnAPI.createReturnRequest - Invalid data:`, data);
      throw new Error('Invalid branch ID, items, or reason');
    }
    for (const item of data.items) {
      if (!isValidObjectId(item.product) || item.quantity < 1 || !['تالف', 'منتج خاطئ', 'كمية زائدة', 'أخرى'].includes(item.reason)) {
        console.error(`[${new Date().toISOString()}] returnAPI.createReturnRequest - Invalid item data:`, item);
        throw new Error('Invalid item data');
      }
    }
    const response = await api.post('/inventory/returns', {
      branchId: data.branchId,
      items: data.items.map((item) => ({
        product: item.product,
        quantity: item.quantity,
        reason: item.reason,
        notes: item.notes?.trim(),
      })),
      reason: data.reason,
      notes: data.notes?.trim(),
    });
    console.log(`[${new Date().toISOString()}] returnAPI.createReturnRequest - Response:`, response);
    return response.returnRequest;
  },
  getReturnRequests: async (params: { branchId?: string } = {}) => {
    if (params.branchId && !isValidObjectId(params.branchId)) {
      console.error(`[${new Date().toISOString()}] returnAPI.getReturnRequests - Invalid branch ID:`, params.branchId);
      throw new Error('Invalid branch ID');
    }
    const response = await api.get('/inventory/returns', { params });
    console.log(`[${new Date().toISOString()}] returnAPI.getReturnRequests - Response:`, response);
    return response.returnRequests;
  },
};

export default { inventoryAPI, returnAPI };