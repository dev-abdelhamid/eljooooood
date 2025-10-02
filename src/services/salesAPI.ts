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
});

axiosRetry(salesAxios, {
  retries: 3,
  retryDelay: (retryCount) => retryCount * 1000,
  retryCondition: (error) => !error.response || error.response.status >= 500,
});

const handleError = async (error: any, originalRequest: any): Promise<never> => {
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
          position: isRtl ? 'top-right' : 'top-left',
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
        position: isRtl ? 'top-right' : 'top-left',
        autoClose: 3000,
        pauseOnFocusLoss: true,
      });
      return Promise.reject({ message: isRtl ? 'فشل تجديد التوكن' : 'Failed to refresh token', status: 401 });
    }
  }

  toast.error(message, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000, pauseOnFocusLoss: true });
  return Promise.reject({ message, status: error.response?.status });
};

salesAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    const language = localStorage.getItem('language') || 'en';
    config.params = { ...config.params, lang: language };
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
  (response) => {
    const data = response.data;
    if (!data) {
      console.error(`[${new Date().toISOString()}] Empty response data:`, response);
      throw new Error(isRtl ? 'استجابة فارغة من الخادم' : 'Empty response from server');
    }
    return data;
  },
  (error) => handleError(error, error.config)
);

const isValidObjectId = (id: string): boolean => /^[0-9a-fA-F]{24}$/.test(id);
const isValidPhone = (phone: string | undefined): boolean => !phone || /^\+?\d{7,15}$/.test(phone);
const isValidPaymentMethod = (method: string | undefined): boolean => !method || ['cash', 'credit_card', 'bank_transfer'].includes(method);
const isValidPaymentStatus = (status: string | undefined): boolean => !status || ['pending', 'completed', 'failed'].includes(status);

const formatDateForAPI = (date: Date): string => {
  const offset = date.getTimezoneOffset();
  const adjustedDate = new Date(date.getTime() - offset * 60 * 1000);
  return adjustedDate.toISOString().split('T')[0];
};

export const salesAPI = {
  create: async (saleData: {
    items: Array<{ productId: string; quantity: number; unitPrice: number }>;
    branch: string;
    notes?: string;
    paymentMethod?: string;
    paymentStatus?: string;
    customerName?: string;
    customerPhone?: string;
  }) => {
    console.log(`[${new Date().toISOString()}] salesAPI.create - Sending:`, saleData);
    if (!isValidObjectId(saleData.branch)) {
      console.error(`[${new Date().toISOString()}] salesAPI.create - Invalid branch ID:`, saleData.branch);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
    }
    if (!saleData.items?.length || saleData.items.some((item) => !isValidObjectId(item.productId) || item.quantity < 1 || item.unitPrice < 0)) {
      console.error(`[${new Date().toISOString()}] salesAPI.create - Invalid items:`, saleData.items);
      throw new Error(isRtl ? 'بيانات المنتجات غير صالحة' : 'Invalid product data');
    }
    if (!isValidPhone(saleData.customerPhone)) {
      console.error(`[${new Date().toISOString()}] salesAPI.create - Invalid customer phone:`, saleData.customerPhone);
      throw new Error(isRtl ? 'رقم هاتف العميل غير صالح' : 'Invalid customer phone');
    }
    if (!isValidPaymentMethod(saleData.paymentMethod)) {
      console.error(`[${new Date().toISOString()}] salesAPI.create - Invalid payment method:`, saleData.paymentMethod);
      throw new Error(isRtl ? 'طريقة الدفع غير صالحة' : 'Invalid payment method');
    }
    if (!isValidPaymentStatus(saleData.paymentStatus)) {
      console.error(`[${new Date().toISOString()}] salesAPI.create - Invalid payment status:`, saleData.paymentStatus);
      throw new Error(isRtl ? 'حالة الدفع غير صالحة' : 'Invalid payment status');
    }
    try {
      for (const item of saleData.items) {
        const inventory = await inventoryAPI.getInventory({ branch: saleData.branch, product: item.productId });
        if (!inventory?.length || inventory[0].currentStock < item.quantity) {
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
        paymentMethod: saleData.paymentMethod?.trim() || 'cash',
        paymentStatus: saleData.paymentStatus?.trim() || 'pending',
        customerName: saleData.customerName?.trim(),
        customerPhone: saleData.customerPhone?.trim(),
        lang: isRtl ? 'ar' : 'en',
      });
      console.log(`[${new Date().toISOString()}] salesAPI.create - Response:`, response);
      toast.success(isRtl ? 'تم إنشاء المبيعة بنجاح' : 'Sale created successfully', { position: isRtl ? 'top-right' : 'top-left' });
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] salesAPI.create - Error:`, err);
      throw err;
    }
  },

  update: async (id: string, saleData: Partial<{
    items: Array<{ productId: string; quantity: number; unitPrice: number }>;
    branch: string;
    notes?: string;
    paymentMethod?: string;
    paymentStatus?: string;
    customerName?: string;
    customerPhone?: string;
  }>) => {
    console.log(`[${new Date().toISOString()}] salesAPI.update - Sending:`, { id, saleData });
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] salesAPI.update - Invalid sale ID:`, id);
      throw new Error(isRtl ? 'معرف المبيعة غير صالح' : 'Invalid sale ID');
    }
    if (saleData.branch && !isValidObjectId(saleData.branch)) {
      console.error(`[${new Date().toISOString()}] salesAPI.update - Invalid branch ID:`, saleData.branch);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
    }
    if (saleData.items?.length && saleData.items.some((item) => !isValidObjectId(item.productId) || item.quantity < 1 || item.unitPrice < 0)) {
      console.error(`[${new Date().toISOString()}] salesAPI.update - Invalid items:`, saleData.items);
      throw new Error(isRtl ? 'بيانات المنتجات غير صالحة' : 'Invalid product data');
    }
    if (!isValidPhone(saleData.customerPhone)) {
      console.error(`[${new Date().toISOString()}] salesAPI.update - Invalid customer phone:`, saleData.customerPhone);
      throw new Error(isRtl ? 'رقم هاتف العميل غير صالح' : 'Invalid customer phone');
    }
    if (!isValidPaymentMethod(saleData.paymentMethod)) {
      console.error(`[${new Date().toISOString()}] salesAPI.update - Invalid payment method:`, saleData.paymentMethod);
      throw new Error(isRtl ? 'طريقة الدفع غير صالحة' : 'Invalid payment method');
    }
    if (!isValidPaymentStatus(saleData.paymentStatus)) {
      console.error(`[${new Date().toISOString()}] salesAPI.update - Invalid payment status:`, saleData.paymentStatus);
      throw new Error(isRtl ? 'حالة الدفع غير صالحة' : 'Invalid payment status');
    }
    try {
      if (saleData.items && saleData.branch) {
        for (const item of saleData.items) {
          const inventory = await inventoryAPI.getInventory({ branch: saleData.branch, product: item.productId });
          if (!inventory?.length || inventory[0].currentStock < item.quantity) {
            console.error(`[${new Date().toISOString()}] salesAPI.update - Insufficient stock for product:`, item.productId);
            throw new Error(isRtl ? `المخزون غير كافٍ للمنتج ${item.productId}` : `Insufficient stock for product ${item.productId}`);
          }
        }
      }
      const response = await salesAxios.put(`/sales/${id}`, {
        items: saleData.items?.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        branch: saleData.branch,
        notes: saleData.notes?.trim(),
        paymentMethod: saleData.paymentMethod?.trim(),
        paymentStatus: saleData.paymentStatus?.trim(),
        customerName: saleData.customerName?.trim(),
        customerPhone: saleData.customerPhone?.trim(),
        lang: isRtl ? 'ar' : 'en',
      });
      console.log(`[${new Date().toISOString()}] salesAPI.update - Response:`, response);
      toast.success(isRtl ? 'تم تعديل المبيعة بنجاح' : 'Sale updated successfully', { position: isRtl ? 'top-right' : 'top-left' });
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] salesAPI.update - Error:`, err);
      throw err;
    }
  },

  delete: async (id: string) => {
    console.log(`[${new Date().toISOString()}] salesAPI.delete - Sending:`, id);
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] salesAPI.delete - Invalid sale ID:`, id);
      throw new Error(isRtl ? 'معرف المبيعة غير صالح' : 'Invalid sale ID');
    }
    try {
      const response = await salesAxios.delete(`/sales/${id}`, { params: { lang: isRtl ? 'ar' : 'en' } });
      console.log(`[${new Date().toISOString()}] salesAPI.delete - Response:`, response);
      toast.success(isRtl ? 'تم حذف المبيعة بنجاح' : 'Sale deleted successfully', { position: isRtl ? 'top-right' : 'top-left' });
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] salesAPI.delete - Error:`, err);
      throw err;
    }
  },

  getAll: async (params: { branch?: string; startDate?: string; endDate?: string; page?: number; limit?: number; paymentStatus?: string; sort?: string } = {}) => {
    console.log(`[${new Date().toISOString()}] salesAPI.getAll - Params:`, params);
    if (params.branch && !isValidObjectId(params.branch)) {
      console.error(`[${new Date().toISOString()}] salesAPI.getAll - Invalid branch ID:`, params.branch);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
    }
    try {
      const cleanedParams = {
        branch: params.branch,
        startDate: params.startDate,
        endDate: params.endDate,
        page: params.page || 1,
        limit: params.limit || 20,
        paymentStatus: params.paymentStatus,
        sort: params.sort || '-createdAt',
        lang: isRtl ? 'ar' : 'en',
      };
      const response = await salesAxios.get('/sales', { params: cleanedParams });
      console.log(`[${new Date().toISOString()}] salesAPI.getAll - Response:`, response);
      if (!response || !Array.isArray(response.sales)) {
        console.error(`[${new Date().toISOString()}] salesAPI.getAll - Invalid sales response:`, response);
        return { sales: [], total: 0, returns: [] };
      }
      return {
        sales: response.sales || [],
        total: response.total || 0,
        returns: response.returns || [],
      };
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
      return response || {};
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] salesAPI.getById - Error:`, err);
      throw err;
    }
  },

  getAnalytics: async (params: { branch?: string; startDate?: string; endDate?: string; paymentStatus?: string } = {}) => {
    console.log(`[${new Date().toISOString()}] salesAPI.getAnalytics - Params:`, params);
    if (params.branch && !isValidObjectId(params.branch)) {
      console.error(`[${new Date().toISOString()}] salesAPI.getAnalytics - Invalid branch ID:`, params.branch);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
    }
    try {
      const cleanedParams = {
        branch: params.branch,
        startDate: params.startDate,
        endDate: params.endDate,
        paymentStatus: params.paymentStatus,
        lang: isRtl ? 'ar' : 'en',
      };
      const response = await salesAxios.get('/sales/analytics', { params: cleanedParams });
      console.log(`[${new Date().toISOString()}] salesAPI.getAnalytics - Response:`, response);
      return response || {};
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] salesAPI.getAnalytics - Error:`, err);
      throw err;
    }
  },

  exportReport: async (params: { branch?: string; startDate?: string; endDate?: string; format: 'csv' | 'pdf' }) => {
    console.log(`[${new Date().toISOString()}] salesAPI.exportReport - Params:`, params);
    if (params.branch && !isValidObjectId(params.branch)) {
      console.error(`[${new Date().toISOString()}] salesAPI.exportReport - Invalid branch ID:`, params.branch);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
    }
    try {
      const response = await salesAxios.get('/sales/export', {
        params: { ...params, lang: isRtl ? 'ar' : 'en' },
        responseType: 'blob',
      });
      console.log(`[${new Date().toISOString()}] salesAPI.exportReport - Response:`, response);
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] salesAPI.exportReport - Error:`, err);
      throw err;
    }
  },
};

export default salesAPI;