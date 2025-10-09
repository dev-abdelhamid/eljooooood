import axios from 'axios';
import axiosRetry from 'axios-retry';
import { toast } from 'react-toastify';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';

const returnsAxios = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

// Configure axios-retry for automatic retries
axiosRetry(returnsAxios, {
  retries: 5, // Increased retries to handle write conflicts
  retryDelay: (retryCount) => Math.min(retryCount * 2000, 10000), // Exponential backoff with cap
  retryCondition: (error) => {
    return (
      axios.isCancel(error) ||
      error.code === 'ECONNABORTED' ||
      !error.response ||
      error.response.status >= 500 ||
      error.message.includes('Write conflict') // Retry on write conflict
    );
  },
});

// Request interceptor for adding token and language
returnsAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    const language = localStorage.getItem('language') || 'en';
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.params = { ...config.params, lang: language };
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling and token refresh
returnsAxios.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;
    const language = localStorage.getItem('language') || 'en';
    const isRtl = language === 'ar';

    let message = error.response?.data?.message || error.message || (isRtl ? 'خطأ غير متوقع' : 'Unexpected error');

    if (error.code === 'ECONNABORTED') {
      message = isRtl ? 'انتهت مهلة الطلب' : 'Request timed out';
    } else if (!error.response) {
      message = isRtl ? 'فشل الاتصال بالخادم' : 'Failed to connect to server';
    } else {
      switch (error.response.status) {
        case 400:
          message = error.response.data?.message || (isRtl ? 'بيانات غير صالحة' : 'Invalid data');
          break;
        case 401:
          if (!originalRequest._retry) {
            originalRequest._retry = true;
            try {
              const refreshToken = localStorage.getItem('refreshToken');
              if (!refreshToken) {
                localStorage.clear();
                window.location.href = '/login';
                toast.error(isRtl ? 'التوكن منتهي الصلاحية' : 'Token expired', {
                  position: isRtl ? 'top-right' : 'top-left',
                  autoClose: 3000,
                });
                return Promise.reject({ message: isRtl ? 'التوكن منتهي' : 'Token expired', status: 401 });
              }
              const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken });
              const { accessToken, refreshToken: newRefreshToken } = response.data;
              localStorage.setItem('token', accessToken);
              if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken);
              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
              return returnsAxios(originalRequest);
            } catch (refreshError) {
              localStorage.clear();
              window.location.href = '/login';
              toast.error(isRtl ? 'فشل تجديد التوكن' : 'Failed to refresh token', {
                position: isRtl ? 'top-right' : 'top-left',
                autoClose: 3000,
              });
              return Promise.reject({ message: isRtl ? 'فشل تجديد التوكن' : 'Failed to refresh token', status: 401 });
            }
          }
          break;
        case 403:
          message = isRtl ? 'عملية غير مصرح بها' : 'Unauthorized operation';
          break;
        case 404:
          message = isRtl ? 'الفرع أو المنتج غير موجود' : 'Branch or product not found';
          break;
        case 422:
          message = isRtl ? 'الكمية غير كافية' : 'Insufficient quantity';
          break;
        case 429:
          message = isRtl ? 'طلبات كثيرة جدًا' : 'Too many requests';
          break;
        case 500:
          if (error.message.includes('Write conflict')) {
            message = isRtl ? 'تعارض في الكتابة، جاري المحاولة مجددًا' : 'Write conflict, retrying';
          } else {
            message = isRtl ? 'خطأ في السيرفر' : 'Server error';
          }
          break;
      }
    }

    toast.error(message, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
    return Promise.reject({ message, status: error.response?.status });
  }
);

const isValidObjectId = (id: string): boolean => /^[0-9a-fA-F]{24}$/.test(id);

export const returnsAPI = {
  getAll: async (query: {
    status?: string;
    branch?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    if (query.branch && !isValidObjectId(query.branch)) {
      throw new Error('Invalid branch ID');
    }
    return returnsAxios.get('/returns', { params: query });
  },

  getBranches: async () => {
    return returnsAxios.get('/branches');
  },

  createReturn: async (data: {
    branchId: string;
    items: Array<{
      product: string;
      quantity: number;
      reason: string;
      reasonEn?: string;
    }>;
    notes?: string;
    orders?: string[];
  }) => {
    if (
      !isValidObjectId(data.branchId) ||
      !Array.isArray(data.items) ||
      data.items.length === 0 ||
      data.items.some(
        (item) => !isValidObjectId(item.product) || item.quantity < 1 || !item.reason
      ) ||
      (data.orders && !Array.isArray(data.orders)) ||
      (data.orders && data.orders.some((id) => !isValidObjectId(id)))
    ) {
      throw new Error('Invalid return data');
    }
    return returnsAxios.post('/returns', {
      branchId: data.branchId,
      items: data.items.map((item) => ({
        product: item.product,
        quantity: Number(item.quantity),
        reason: item.reason.trim(),
        reasonEn: item.reasonEn?.trim() || undefined,
      })),
      notes: data.notes?.trim(),
      orders: data.orders || [],
    });
  },

  updateReturnStatus: async (
    returnId: string,
    data: {
      status: 'approved' | 'rejected';
      reviewNotes?: string;
    }
  ) => {
    if (!isValidObjectId(returnId) || !['approved', 'rejected'].includes(data.status)) {
      throw new Error('Invalid return ID or status');
    }
    return returnsAxios.put(`/returns/${returnId}`, {
      status: data.status,
      reviewNotes: data.reviewNotes?.trim(),
    });
  },
};

export default returnsAPI;