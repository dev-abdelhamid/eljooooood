import axios from 'axios';
import axiosRetry from 'axios-retry';
import { toast } from 'react-toastify';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';

const returnsAxios = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

axiosRetry(returnsAxios, {
  retries: 3,
  retryDelay: (retryCount) => retryCount * 1000,
  retryCondition: (error) => {
    return axios.isCancel(error) || error.code === 'ECONNABORTED' || !error.response || error.response.status >= 500;
  },
});

returnsAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    const language = localStorage.getItem('language') || 'ar'; // Default to 'ar' for consistency with backend
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.params = { ...config.params, lang: language };
    console.log(`[${new Date().toISOString()}] Returns API request:`, {
      url: config.url,
      method: config.method,
      headers: config.headers,
      params: config.params,
      data: config.data,
    });
    return config;
  },
  (error) => {
    console.error(`[${new Date().toISOString()}] Returns API request error:`, error);
    return Promise.reject(error);
  }
);

returnsAxios.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;
    const language = localStorage.getItem('language') || 'ar';
    const isRtl = language === 'ar';

    let message = error.response?.data?.message || error.message || (isRtl ? 'خطأ غير متوقع' : 'Unexpected error');

    if (error.code === 'ECONNABORTED') {
      message = isRtl ? 'انتهت مهلة الطلب، حاول مرة أخرى' : 'Request timed out, please try again';
    } else if (!error.response) {
      message = isRtl ? 'فشل الاتصال بالخادم' : 'Failed to connect to server';
    } else if (error.response.status === 400) {
      message = error.response.data?.message || (isRtl ? 'بيانات غير صالحة' : 'Invalid data');
    } else if (error.response.status === 403) {
      message = error.response.data?.message || (isRtl ? 'عملية غير مصرح بها' : 'Unauthorized operation');
    } else if (error.response.status === 404) {
      message = error.response.data?.message || (isRtl ? 'الفرع أو المنتج غير موجود' : 'Branch or product not found');
    } else if (error.response.status === 422) {
      message = error.response.data?.message || (isRtl ? 'الكمية غير كافية أو تتجاوز المسلم' : 'Insufficient quantity or exceeds delivered quantity');
    } else if (error.response.status === 429) {
      message = isRtl ? 'طلبات كثيرة جدًا، حاول مرة أخرى لاحقًا' : 'Too many requests, try again later';
    } else if (error.response.status === 500) {
      message = isRtl ? 'خطأ في الخادم، حاول مرة أخرى لاحقًا' : 'Server error, please try again later';
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
        return returnsAxios(originalRequest);
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
  }
);

const isValidObjectId = (id: string): boolean => /^[0-9a-fA-F]{24}$/.test(id);

export const returnsAPI = {
  getAll: async (query: {
    status?: string;
    branch?: string;
    search?: string;
    sort?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    console.log(`[${new Date().toISOString()}] returnsAPI.getAll - Sending:`, query);
    try {
      if (query.branch && !isValidObjectId(query.branch)) {
        console.error(`[${new Date().toISOString()}] returnsAPI.getAll - Invalid branch ID:`, query.branch);
        throw new Error('Invalid branch ID');
      }
      const response = await returnsAxios.get('/returns', { params: query });
      console.log(`[${new Date().toISOString()}] returnsAPI.getAll - Response:`, response);
      return response;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] returnsAPI.getAll - Error:`, error);
      throw error;
    }
  },

  getBranches: async () => {
    console.log(`[${new Date().toISOString()}] returnsAPI.getBranches - Sending`);
    try {
      const response = await returnsAxios.get('/branches');
      console.log(`[${new Date().toISOString()}] returnsAPI.getBranches - Response:`, response);
      return response;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] returnsAPI.getBranches - Error:`, error);
      throw error;
    }
  },

  createReturn: async (data: {
    branchId: string;
    items: Array<{
      productId: string;
      quantity: number;
      reason: string;
      reasonEn: string;
    }>;
    notes?: string;
  }) => {
    console.log(`[${new Date().toISOString()}] returnsAPI.createReturn - Sending:`, data);
    const language = localStorage.getItem('language') || 'ar';
    const isRtl = language === 'ar';

    // Validate input data
    if (
      !isValidObjectId(data.branchId) ||
      !Array.isArray(data.items) ||
      data.items.length === 0 ||
      data.items.some(
        (item) =>
          !isValidObjectId(item.productId) ||
          item.quantity < 1 ||
          !item.reason ||
          !item.reasonEn
      )
    ) {
      console.error(`[${new Date().toISOString()}] returnsAPI.createReturn - Invalid data:`, data);
      throw new Error(isRtl ? 'بيانات غير صالحة لإنشاء طلب الإرجاع' : 'Invalid data for creating return request');
    }

    try {
      const response = await returnsAxios.post('/returns', {
        branchId: data.branchId,
        items: data.items.map((item) => ({
          product: item.productId,
          quantity: Number(item.quantity),
          reason: item.reason.trim(),
          reasonEn: item.reasonEn.trim(),
        })),
        notes: data.notes ? data.notes.trim() : undefined,
      });
      console.log(`[${new Date().toISOString()}] returnsAPI.createReturn - Response:`, response);
      return response;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] returnsAPI.createReturn - Error:`, {
        message: error.message,
        status: error.status,
        response: error.response,
      });

      let errorMessage = error.message || (isRtl ? 'خطأ في إنشاء طلب الإرجاع' : 'Error creating return request');
      if (error.status === 400) {
        errorMessage = error.message || (isRtl ? 'بيانات غير صالحة' : 'Invalid data');
      } else if (error.status === 403) {
        errorMessage = error.message || (isRtl ? 'عملية غير مصرح بها' : 'Unauthorized operation');
      } else if (error.status === 404) {
        errorMessage = error.message || (isRtl ? 'الفرع أو المنتج غير موجود' : 'Branch or product not found');
      } else if (error.status === 422) {
        errorMessage = error.message || (isRtl ? 'الكمية غير كافية أو تتجاوز المسلم' : 'Insufficient quantity or exceeds delivered quantity');
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = isRtl ? 'انتهت مهلة الطلب، حاول مرة أخرى' : 'Request timed out, please try again';
      } else if (!error.response) {
        errorMessage = isRtl ? 'فشل الاتصال بالخادم' : 'Failed to connect to server';
      } else if (error.status === 500) {
        errorMessage = isRtl ? 'خطأ في الخادم، حاول مرة أخرى لاحقًا' : 'Server error, please try again later';
      }

      throw new Error(errorMessage);
    }
  },

  updateReturnStatus: async (
    returnId: string,
    data: {
      status: 'approved' | 'rejected';
      reviewNotes?: string;
    }
  ) => {
    console.log(`[${new Date().toISOString()}] returnsAPI.updateReturnStatus - Sending:`, { returnId, data });
    const language = localStorage.getItem('language') || 'ar';
    const isRtl = language === 'ar';

    if (
      !isValidObjectId(returnId) ||
      !['approved', 'rejected'].includes(data.status)
    ) {
      console.error(`[${new Date().toISOString()}] returnsAPI.updateReturnStatus - Invalid data:`, { returnId, data });
      throw new Error(isRtl ? 'معرف الإرجاع أو الحالة غير صالح' : 'Invalid return ID or status');
    }

    try {
      const response = await returnsAxios.put(`/returns/${returnId}`, {
        status: data.status,
        reviewNotes: data.reviewNotes ? data.reviewNotes.trim() : undefined,
      });
      console.log(`[${new Date().toISOString()}] returnsAPI.updateReturnStatus - Response:`, response);
      return response;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] returnsAPI.updateReturnStatus - Error:`, {
        message: error.message,
        status: error.status,
        response: error.response,
      });

      let errorMessage = error.message || (isRtl ? 'خطأ في تحديث حالة الإرجاع' : 'Error updating return status');
      if (error.status === 404) {
        errorMessage = error.message || (isRtl ? 'الإرجاع غير موجود' : 'Return not found');
      } else if (error.status === 500) {
        errorMessage = isRtl ? 'خطأ في الخادم، حاول مرة أخرى لاحقًا' : 'Server error, please try again later';
      }

      throw new Error(errorMessage);
    }
  },
};

export default returnsAPI;