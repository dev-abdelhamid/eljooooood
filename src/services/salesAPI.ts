import axios from 'axios';
import axiosRetry from 'axios-retry';
import { toast } from 'react-toastify';
import { inventoryAPI } from './api';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';
const isRtl = localStorage.getItem('language') === 'ar';

const salesAxios = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  params: { lang: isRtl ? 'ar' : 'en' },
});

axiosRetry(salesAxios, { retries: 3, retryDelay: (retryCount) => retryCount * 1000 });

salesAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.params = { ...config.params, lang: isRtl ? 'ar' : 'en' };
    console.log(`[${new Date().toISOString()}] Sales API request:`, {
      url: config.url,
      method: config.method,
      headers: config.headers,
      params: config.params,
    });
    return config;
  },
  (error) => {
    console.error(`[${new Date().toISOString()}] Sales API request error:`, error);
    return Promise.reject(error);
  }
);

salesAxios.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;
    console.error(`[${new Date().toISOString()}] Sales API response error:`, {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });

    let message = error.response?.data?.message || (isRtl ? 'خطأ غير متوقع' : 'Unexpected error');
    if (error.response?.status === 400) message = error.response?.data?.message || (isRtl ? 'بيانات غير صالحة' : 'Invalid data');
    if (error.response?.status === 403) message = error.response?.data?.message || (isRtl ? 'عملية غير مصرح بها' : 'Unauthorized operation');
    if (error.response?.status === 404) message = error.response?.data?.message || (isRtl ? 'المبيعة غير موجودة' : 'Sale not found');
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
        return salesAxios(originalRequest);
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

export const salesAPI = {
  create: async (saleData: {
    items: Array<{ productId: string; quantity: number; unitPrice: number }>;
    branch: string;
    notes?: string;
    paymentMethod?: string;
    customerName?: string;
    customerPhone?: string;
  }) => {
    console.log(`[${new Date().toISOString()}] salesAPI.create - Sending:`, saleData);
    if (!isValidObjectId(saleData.branch)) {
      console.error(`[${new Date().toISOString()}] salesAPI.create - Invalid branch ID:`, saleData.branch);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
    }
    if (saleData.items.some((item) => !isValidObjectId(item.productId) || item.quantity < 1 || item.unitPrice < 0)) {
      console.error(`[${new Date().toISOString()}] salesAPI.create - Invalid productId, quantity, or unitPrice in items:`, saleData.items);
      throw new Error(isRtl ? 'معرف المنتج، الكمية، أو السعر غير صالح' : 'Invalid product ID, quantity, or unit price');
    }
    try {
      // Check inventory before creating sale
      for (const item of saleData.items) {
        const inventory = await inventoryAPI.getInventory({ branch: saleData.branch, product: item.productId });
        if (!inventory || inventory.length === 0 || inventory[0].currentStock < item.quantity) {
          console.error(`[${new Date().toISOString()}] salesAPI.create - Insufficient stock for product:`, item.productId);
          throw new Error(isRtl ? `المخزون غير كافٍ للمنتج ${item.productId}` : `Insufficient stock for product ${item.productId}`);
        }
      }
      const response = await salesAxios.post('/sales', {
        items: saleData.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        branch: saleData.branch,
        notes: saleData.notes?.trim(),
        paymentMethod: saleData.paymentMethod?.trim(),
        customerName: saleData.customerName?.trim(),
        customerPhone: saleData.customerPhone?.trim(),
        lang: isRtl ? 'ar' : 'en',
      });
      console.log(`[${new Date().toISOString()}] salesAPI.create - Response:`, response);
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] salesAPI.create - Error:`, err);
      throw err;
    }
  },

  getAll: async (params: { branch?: string; startDate?: string; endDate?: string; page?: number; limit?: number } = {}) => {
    console.log(`[${new Date().toISOString()}] salesAPI.getAll - Params:`, params);
    if (params.branch && !isValidObjectId(params.branch)) {
      console.error(`[${new Date().toISOString()}] salesAPI.getAll - Invalid branch ID:`, params.branch);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
    }
    try {
      const response = await salesAxios.get('/sales', { params: { ...params, lang: isRtl ? 'ar' : 'en' } });
      console.log(`[${new Date().toISOString()}] salesAPI.getAll - Response:`, response);
      if (!response || !Array.isArray(response.sales)) {
        console.error(`[${new Date().toISOString()}] salesAPI.getAll - Invalid sales response:`, response);
        throw new Error(isRtl ? 'استجابة المبيعات غير صالحة من الخادم' : 'Invalid sales response from server');
      }
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] salesAPI.getAll - Error:`, err);
      throw err;
    }
  },

  getById: async (id: string) => {
    console.log(`[${new Date().toISOString()}] salesAPI.getById - Sending:`, id);
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] salesAPI.getById - Invalid sale ID:`, id);
      throw new Error(isRtl ? 'معرف المبيعة غير صالح' : 'Invalid sale ID');
    }
    try {
      const response = await salesAxios.get(`/sales/${id}`, { params: { lang: isRtl ? 'ar' : 'en' } });
      console.log(`[${new Date().toISOString()}] salesAPI.getById - Response:`, response);
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] salesAPI.getById - Error:`, err);
      throw err;
    }
  },

  getAnalytics: async (params: { branch?: string; startDate?: string; endDate?: string } = {}) => {
    console.log(`[${new Date().toISOString()}] salesAPI.getAnalytics - Params:`, params);
    if (params.branch && !isValidObjectId(params.branch)) {
      console.error(`[${new Date().toISOString()}] salesAPI.getAnalytics - Invalid branch ID:`, params.branch);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
    }
    try {
      const response = await salesAxios.get('/sales/analytics', { params: { ...params, lang: isRtl ? 'ar' : 'en' } });
      console.log(`[${new Date().toISOString()}] salesAPI.getAnalytics - Response:`, response);
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] salesAPI.getAnalytics - Error:`, err);
      throw err;
    }
  },
};

export default salesAPI;