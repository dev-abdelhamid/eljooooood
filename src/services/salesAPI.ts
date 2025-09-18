import axios from 'axios';
import axiosRetry from 'axios-retry';
import { toast } from 'react-toastify';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';

const salesAxios = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

axiosRetry(salesAxios, { retries: 3, retryDelay: (retryCount) => retryCount * 1000 });

salesAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(`[${new Date().toISOString()}] Sales API request:`, {
      url: config.url,
      method: config.method,
      headers: config.headers,
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
        return salesAxios(originalRequest);
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
    if (!/^[0-9a-fA-F]{24}$/.test(saleData.branch)) {
      console.error(`[${new Date().toISOString()}] Invalid branch ID:`, saleData.branch);
      throw new Error('معرف الفرع غير صالح');
    }
    if (saleData.items.some((item) => !/^[0-9a-fA-F]{24}$/.test(item.productId))) {
      console.error(`[${new Date().toISOString()}] Invalid productId in items:`, saleData.items);
      throw new Error('معرف المنتج غير صالح');
    }
    try {
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
      });
      console.log(`[${new Date().toISOString()}] salesAPI.create - Response:`, response);
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] salesAPI.create - Error:`, err);
      toast.error('فشل إنشاء المبيعة', { position: 'top-right', autoClose: 3000, pauseOnFocusLoss: true });
      throw err;
    }
  },

  getAll: async (params: { branch?: string; startDate?: string; endDate?: string; page?: number; limit?: number } = {}) => {
    if (params.branch && !/^[0-9a-fA-F]{24}$/.test(params.branch)) {
      console.error(`[${new Date().toISOString()}] Invalid branch ID:`, params.branch);
      throw new Error('معرف الفرع غير صالح');
    }
    console.log(`[${new Date().toISOString()}] salesAPI.getAll - Params:`, params);
    try {
      const response = await salesAxios.get('/sales', { params });
      console.log(`[${new Date().toISOString()}] salesAPI.getAll - Response:`, response);
      if (!response || !Array.isArray(response.sales)) {
        console.error(`[${new Date().toISOString()}] Invalid sales response:`, response);
        throw new Error('استجابة المبيعات غير صالحة من الخادم');
      }
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] salesAPI.getAll - Error:`, err);
      toast.error('فشل جلب المبيعات', { position: 'top-right', autoClose: 3000, pauseOnFocusLoss: true });
      throw err;
    }
  },

  getById: async (id: string) => {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error(`[${new Date().toISOString()}] Invalid sale ID:`, id);
      throw new Error('معرف المبيعة غير صالح');
    }
    try {
      const response = await salesAxios.get(`/sales/${id}`);
      console.log(`[${new Date().toISOString()}] salesAPI.getById - Response:`, response);
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] salesAPI.getById - Error:`, err);
      toast.error('فشل جلب المبيعة', { position: 'top-right', autoClose: 3000, pauseOnFocusLoss: true });
      throw err;
    }
  },

  getAnalytics: async (params: { branch?: string; startDate?: string; endDate?: string } = {}) => {
    if (params.branch && !/^[0-9a-fA-F]{24}$/.test(params.branch)) {
      console.error(`[${new Date().toISOString()}] Invalid branch ID:`, params.branch);
      throw new Error('معرف الفرع غير صالح');
    }
    console.log(`[${new Date().toISOString()}] salesAPI.getAnalytics - Params:`, params);
    try {
      const response = await salesAxios.get('/sales/analytics', { params });
      console.log(`[${new Date().toISOString()}] salesAPI.getAnalytics - Response:`, response);
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] salesAPI.getAnalytics - Error:`, err);
      toast.error('فشل جلب تحليلات المبيعات', { position: 'top-right', autoClose: 3000, pauseOnFocusLoss: true });
      throw err;
    }
  },
};

export default salesAPI;