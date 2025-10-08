import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { toast } from 'react-toastify';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';
const isRtl = localStorage.getItem('language') === 'ar';

export interface SalesApiError {
  message: string;
  status?: number;
  errors?: any[];
}

export const salesAxios = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Error handling
export const handleError = async (error: AxiosError, originalRequest: AxiosRequestConfig): Promise<never> => {
  const errorDetails = {
    url: error.config?.url,
    method: error.config?.method,
    status: error.response?.status,
    data: error.response?.data,
    message: error.message,
  };
  console.error(`[${new Date().toISOString()}] Sales API response error:`, errorDetails);

  let message = (error.response?.data as any)?.message || (isRtl ? 'خطأ غير متوقع' : 'Unexpected error');
  const errors = (error.response?.data as any)?.errors || [];

  switch (error.response?.status) {
    case 400:
      message = errors.length > 0 ? errors[0].msg : (isRtl ? 'بيانات غير صالحة' : 'Invalid data');
      break;
    case 403:
      message = (error.response?.data as any)?.message || (isRtl ? 'عملية غير مصرح بها' : 'Unauthorized operation');
      break;
    case 404:
      message = (error.response?.data as any)?.message || (isRtl ? 'المبيعة غير موجودة' : 'Sale not found');
      break;
    case 429:
      message = isRtl ? 'طلبات كثيرة جدًا، حاول مرة أخرى لاحقًا' : 'Too many requests, try again later';
      break;
    default:
      if (!navigator.onLine) {
        message = isRtl ? 'لا يوجد اتصال بالإنترنت' : 'No internet connection';
      }
  }

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
        });
        throw new Error(isRtl ? 'التوكن منتهي الصلاحية ولا يوجد توكن منعش' : 'Token expired and no refresh token available');
      }
      const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken });
      const { accessToken, refreshToken: newRefreshToken } = response.data;
      localStorage.setItem('token', accessToken);
      if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken);
      console.log(`[${new Date().toISOString()}] Token refreshed successfully`);
      originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${accessToken}` };
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
      });
      throw new Error(isRtl ? 'فشل تجديد التوكن' : 'Failed to refresh token');
    }
  }

  toast.error(message, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
  throw { message, status: error.response?.status, errors } as SalesApiError;
};

// Request interceptor
salesAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    const language = localStorage.getItem('language') || 'en';
    config.params = { ...config.params, lang: language };
    console.log(`[${new Date().toISOString()}] Sales API request:`, {
      url: config.url,
      method: config.method,
      headers: { ...config.headers, Authorization: token ? 'Bearer [REDACTED]' : undefined },
      params: config.params,
      data: config.data,
    });
    return config;
  },
  (error) => {
    console.error(`[${new Date().toISOString()}] Sales API request error:`, error);
    return Promise.reject(error);
  }
);

// Response interceptor
salesAxios.interceptors.response.use(
  (response) => {
    if (!response.data) {
      console.error(`[${new Date().toISOString()}] Empty response data:`, response);
      throw new Error(isRtl ? 'استجابة فارغة من الخادم' : 'Empty response from server');
    }
    return response.data;
  },
  (error) => handleError(error, error.config)
);

// Validation functions
export const isValidObjectId = (id: string): boolean => /^[0-9a-fA-F]{24}$/.test(id);
export const isValidPhone = (phone: string | undefined): boolean => !phone || /^\+?\d{7,15}$/.test(phone);
export const isValidPaymentMethod = (method: string | undefined): boolean => !method || ['cash', 'credit_card', 'bank_transfer'].includes(method);
export const isValidPaymentStatus = (status: string | undefined): boolean => !status || ['pending', 'completed', 'canceled'].includes(status);
export const isValidDate = (date: string | undefined): boolean => !date || !isNaN(new Date(date).getTime());

// Interfaces
interface SaleItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface SaleData {
  items: SaleItem[];
  branch: string;
  notes?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  customerName?: string;
  customerPhone?: string;
}

export interface AnalyticsParams {
  branch?: string;
  startDate?: string;
  endDate?: string;
}

export interface BranchStatsParams {
  startDate?: string;
  endDate?: string;
}

export const salesAPI = {
  create: async (saleData: SaleData) => {
    console.log(`[${new Date().toISOString()}] salesAPI.create - Sending:`, { ...saleData, items: saleData.items.length });
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
    const response = await salesAxios.post('/sales', saleData);
    console.log(`[${new Date().toISOString()}] salesAPI.create - Success:`, {
      saleId: response._id,
      saleNumber: response.saleNumber,
      totalAmount: response.totalAmount,
    });
    return response;
  },

  getAll: async (params: {
    page?: number;
    limit?: number;
    sort?: string;
    branch?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    console.log(`[${new Date().toISOString()}] salesAPI.getAll - Sending:`, params);
    if (params.branch && !isValidObjectId(params.branch)) {
      console.error(`[${new Date().toISOString()}] salesAPI.getAll - Invalid branch ID:`, params.branch);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
    }
    if (params.startDate && !isValidDate(params.startDate)) {
      console.error(`[${new Date().toISOString()}] salesAPI.getAll - Invalid start date:`, params.startDate);
      throw new Error(isRtl ? 'تاريخ البدء غير صالح' : 'Invalid start date');
    }
    if (params.endDate && !isValidDate(params.endDate)) {
      console.error(`[${new Date().toISOString()}] salesAPI.getAll - Invalid end date:`, params.endDate);
      throw new Error(isRtl ? 'تاريخ الانتهاء غير صالح' : 'Invalid end date');
    }
    const response = await salesAxios.get('/sales', { params });
    console.log(`[${new Date().toISOString()}] salesAPI.getAll - Success:`, {
      total: response.total,
      salesCount: response.sales?.length,
    });
    return response;
  },

  getById: async (id: string) => {
    console.log(`[${new Date().toISOString()}] salesAPI.getById - Sending:`, { id });
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] salesAPI.getById - Invalid sale ID:`, id);
      throw new Error(isRtl ? 'معرف المبيعة غير صالح' : 'Invalid sale ID');
    }
    const response = await salesAxios.get(`/sales/${id}`);
    console.log(`[${new Date().toISOString()}] salesAPI.getById - Success:`, {
      saleId: response.sale._id,
      saleNumber: response.sale.saleNumber,
    });
    return response.sale;
  },

  update: async (id: string, saleData: Partial<SaleData>) => {
    console.log(`[${new Date().toISOString()}] salesAPI.update - Sending:`, { id, ...saleData });
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
    const response = await salesAxios.put(`/sales/${id}`, saleData);
    console.log(`[${new Date().toISOString()}] salesAPI.update - Success:`, {
      saleId: response._id,
      saleNumber: response.saleNumber,
    });
    return response;
  },

  delete: async (id: string) => {
    console.log(`[${new Date().toISOString()}] salesAPI.delete - Sending:`, { id });
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] salesAPI.delete - Invalid sale ID:`, id);
      throw new Error(isRtl ? 'معرف المبيعة غير صالح' : 'Invalid sale ID');
    }
    const response = await salesAxios.delete(`/sales/${id}`);
    console.log(`[${new Date().toISOString()}] salesAPI.delete - Success:`, response);
    return response;
  },

  getAnalytics: async (params: AnalyticsParams) => {
    console.log(`[${new Date().toISOString()}] salesAPI.getAnalytics - Sending:`, params);
    if (params.branch && !isValidObjectId(params.branch)) {
      console.error(`[${new Date().toISOString()}] salesAPI.getAnalytics - Invalid branch ID:`, params.branch);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
    }
    if (params.startDate && !isValidDate(params.startDate)) {
      console.error(`[${new Date().toISOString()}] salesAPI.getAnalytics - Invalid start date:`, params.startDate);
      throw new Error(isRtl ? 'تاريخ البدء غير صالح' : 'Invalid start date');
    }
    if (params.endDate && !isValidDate(params.endDate)) {
      console.error(`[${new Date().toISOString()}] salesAPI.getAnalytics - Invalid end date:`, params.endDate);
      throw new Error(isRtl ? 'تاريخ الانتهاء غير صالح' : 'Invalid end date');
    }
    const response = await salesAxios.get('/sales/analytics', { params });
    console.log(`[${new Date().toISOString()}] salesAPI.getAnalytics - Success:`, {
      totalSales: response.totalSales,
      totalCount: response.totalCount,
      topProduct: response.topProduct?.productId,
    });
    return response;
  },

  getBranchStats: async (params: BranchStatsParams) => {
    console.log(`[${new Date().toISOString()}] salesAPI.getBranchStats - Sending:`, params);
    if (params.startDate && !isValidDate(params.startDate)) {
      console.error(`[${new Date().toISOString()}] salesAPI.getBranchStats - Invalid start date:`, params.startDate);
      throw new Error(isRtl ? 'تاريخ البدء غير صالح' : 'Invalid start date');
    }
    if (params.endDate && !isValidDate(params.endDate)) {
      console.error(`[${new Date().toISOString()}] salesAPI.getBranchStats - Invalid end date:`, params.endDate);
      throw new Error(isRtl ? 'تاريخ الانتهاء غير صالح' : 'Invalid end date');
    }
    const response = await salesAxios.get('/sales/branch-stats', { params });
    console.log(`[${new Date().toISOString()}] salesAPI.getBranchStats - Success:`, {
      totalSales: response.totalSales,
      totalCount: response.totalCount,
      topProduct: response.topProduct?.productId,
    });
    return response;
  },
};

export default salesAPI;