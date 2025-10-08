import axios, { AxiosResponse } from 'axios';
import { toast } from 'react-toastify';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';

const isRtl = localStorage.getItem('language') === 'ar';

const salesAxios = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
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
      const refreshTokenValue = localStorage.getItem('refreshToken');
      if (!refreshTokenValue) {
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
      const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken: refreshTokenValue });
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
  (response: AxiosResponse) => {
    const data = response.data;
    if (!data) {
      console.error(`[${new Date().toISOString()}] Empty response data:`, response);
      throw new Error(isRtl ? 'استجابة فارغة من الخادم' : 'Empty response from server');
    }
    return data;
  },
  (error) => handleError(error, error.config)
);

interface Item {
  productId: string;
  quantity: number;
  unitPrice: number;
}

interface Sale {
  saleNumber: string;
  branch: {
    _id: string;
    name: string;
    nameEn?: string;
    displayName: string;
  };
  items: Array<{
    product: string;
    productName: string;
    productNameEn?: string;
    displayName: string;
    displayUnit: string;
    quantity: number;
    unitPrice: number;
    department?: {
      _id: string;
      name: string;
      nameEn?: string;
      displayName: string;
    };
  }>;
  totalAmount: number;
  status: string;
  paymentMethod: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  returns?: Array<{
    _id: string;
    returnNumber: string;
    status: string;
    items: Array<{
      product: string;
      productName: string;
      productNameEn?: string;
      quantity: number;
      reason: string;
    }>;
    reason: string;
    createdAt: string;
  }>;
}

interface AnalyticsData {
  totalSales: number;
  totalCount: number;
  averageOrderValue: number;
  returnRate: number;
  topProduct: {
    productId: string | null;
    productName: string;
    displayName: string;
    totalQuantity: number;
    totalRevenue: number;
  };
  productSales: Array<{
    productId: string;
    productName: string;
    productNameEn?: string;
    displayName: string;
    totalQuantity: number;
    totalRevenue: number;
  }>;
  leastProductSales: Array<{
    productId: string;
    productName: string;
    productNameEn?: string;
    displayName: string;
    totalQuantity: number;
    totalRevenue: number;
  }>;
  departmentSales: Array<{
    departmentId: string;
    departmentName: string;
    departmentNameEn?: string;
    displayName: string;
    totalRevenue: number;
    totalQuantity: number;
  }>;
  leastDepartmentSales: Array<{
    departmentId: string;
    departmentName: string;
    departmentNameEn?: string;
    displayName: string;
    totalRevenue: number;
    totalQuantity: number;
  }>;
  salesTrends: Array<{
    period: string;
    totalSales: number;
    saleCount: number;
  }>;
  topCustomers: Array<{
    customerName: string;
    customerPhone: string;
    totalSpent: number;
    purchaseCount: number;
  }>;
  returnStats: Array<{
    status: string;
    count: number;
    totalQuantity: number;
  }>;
}

const isValidObjectId = (id: string): boolean => /^[0-9a-fA-F]{24}$/.test(id);

const isValidPhone = (phone: string | undefined): boolean => !phone || /^\+?\d{7,15}$/.test(phone);

const isValidPaymentMethod = (method: string | undefined): boolean => !method || ['cash', 'card'].includes(method);

const isValidPaymentStatus = (status: string | undefined): boolean => !status || ['pending', 'completed', 'canceled'].includes(status);

const isValidDate = (date: string | undefined): boolean => !date || !isNaN(new Date(date).getTime());

export const salesAPI = {
  create: async (saleData: {
    items: Array<{ productId: string; quantity: number; unitPrice: number }>;
    branch: string;
    notes?: string;
    paymentMethod?: string;
    paymentStatus?: string;
    customerName?: string;
    customerPhone?: string;
  }): Promise<Sale> => {
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
      throw new Error(isRtl ? 'طريقة الدفع غير صالحة (يجب أن تكون cash أو card)' : 'Invalid payment method (must be cash or card)');
    }
    if (!isValidPaymentStatus(saleData.paymentStatus)) {
      console.error(`[${new Date().toISOString()}] salesAPI.create - Invalid payment status:`, saleData.paymentStatus);
      throw new Error(isRtl ? 'حالة الدفع غير صالحة' : 'Invalid payment status');
    }
    const response = await salesAxios.post('/sales', { ...saleData, lang: isRtl ? 'ar' : 'en' });
    console.log(`[${new Date().toISOString()}] salesAPI.create - Success:`, response);
    return response.sale;
  },

  getAll: async (params: {
    page?: number;
    limit?: number;
    sort?: string;
    branch?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ sales: Sale[]; total: number; returns: any[] }> => {
    console.log(`[${new Date().toISOString()}] salesAPI.getAll - Sending:`, params);
    if (params.branch && !isValidObjectId(params.branch)) {
      console.error(`[${new Date().toISOString()}] salesAPI.getAll - Invalid branch ID:`, params.branch);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
    }
    if (!isValidDate(params.startDate)) {
      console.error(`[${new Date().toISOString()}] salesAPI.getAll - Invalid start date:`, params.startDate);
      throw new Error(isRtl ? 'تاريخ البدء غير صالح' : 'Invalid start date');
    }
    if (!isValidDate(params.endDate)) {
      console.error(`[${new Date().toISOString()}] salesAPI.getAll - Invalid end date:`, params.endDate);
      throw new Error(isRtl ? 'تاريخ الانتهاء غير صالح' : 'Invalid end date');
    }
    const response = await salesAxios.get('/sales', { params: { ...params, lang: isRtl ? 'ar' : 'en' } });
    console.log(`[${new Date().toISOString()}] salesAPI.getAll - Success:`, {
      total: response.total,
      salesCount: response.sales?.length,
    });
    return response;
  },

  getById: async (id: string): Promise<Sale> => {
    console.log(`[${new Date().toISOString()}] salesAPI.getById - Sending:`, { id });
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] salesAPI.getById - Invalid sale ID:`, id);
      throw new Error(isRtl ? 'معرف المبيعة غير صالح' : 'Invalid sale ID');
    }
    const response = await salesAxios.get(`/sales/${id}`, { params: { lang: isRtl ? 'ar' : 'en' } });
    console.log(`[${new Date().toISOString()}] salesAPI.getById - Success:`, response);
    return response.sale;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    console.log(`[${new Date().toISOString()}] salesAPI.delete - Sending:`, { id });
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] salesAPI.delete - Invalid sale ID:`, id);
      throw new Error(isRtl ? 'معرف المبيعة غير صالح' : 'Invalid sale ID');
    }
    const response = await salesAxios.delete(`/sales/${id}`, { params: { lang: isRtl ? 'ar' : 'en' } });
    console.log(`[${new Date().toISOString()}] salesAPI.delete - Success:`, response);
    return response;
  },

  getAnalytics: async (params: {
    branch?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<AnalyticsData> => {
    console.log(`[${new Date().toISOString()}] salesAPI.getAnalytics - Sending:`, params);
    if (params.branch && !isValidObjectId(params.branch)) {
      console.error(`[${new Date().toISOString()}] salesAPI.getAnalytics - Invalid branch ID:`, params.branch);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
    }
    if (!isValidDate(params.startDate)) {
      console.error(`[${new Date().toISOString()}] salesAPI.getAnalytics - Invalid start date:`, params.startDate);
      throw new Error(isRtl ? 'تاريخ البدء غير صالح' : 'Invalid start date');
    }
    if (!isValidDate(params.endDate)) {
      console.error(`[${new Date().toISOString()}] salesAPI.getAnalytics - Invalid end date:`, params.endDate);
      throw new Error(isRtl ? 'تاريخ الانتهاء غير صالح' : 'Invalid end date');
    }
    const response = await salesAxios.get('/sales/analytics', { params: { ...params, lang: isRtl ? 'ar' : 'en' } });
    console.log(`[${new Date().toISOString()}] salesAPI.getAnalytics - Success:`, {
      totalSales: response.totalSales,
      totalCount: response.totalCount,
      productSalesCount: response.productSales?.length,
      topCustomersCount: response.topCustomers?.length,
    });
    return response;
  },

  getBranchAnalytics: async (params: {
    startDate?: string;
    endDate?: string;
  }): Promise<AnalyticsData> => {
    console.log(`[${new Date().toISOString()}] salesAPI.getBranchAnalytics - Sending:`, params);
    if (!isValidDate(params.startDate)) {
      console.error(`[${new Date().toISOString()}] salesAPI.getBranchAnalytics - Invalid start date:`, params.startDate);
      throw new Error(isRtl ? 'تاريخ البدء غير صالح' : 'Invalid start date');
    }
    if (!isValidDate(params.endDate)) {
      console.error(`[${new Date().toISOString()}] salesAPI.getBranchAnalytics - Invalid end date:`, params.endDate);
      throw new Error(isRtl ? 'تاريخ الانتهاء غير صالح' : 'Invalid end date');
    }
    const response = await salesAxios.get('/sales/branch-analytics', { params: { ...params, lang: isRtl ? 'ar' : 'en' } });
    console.log(`[${new Date().toISOString()}] salesAPI.getBranchAnalytics - Success:`, {
      totalSales: response.totalSales,
      totalCount: response.totalCount,
      productSalesCount: response.productSales?.length,
      topCustomersCount: response.topCustomers?.length,
    });
    return response;
  },
};

export default salesAPI;