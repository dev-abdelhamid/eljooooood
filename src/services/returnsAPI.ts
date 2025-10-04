import axios from 'axios';
import axiosRetry from 'axios-retry';
import { toast } from 'react-toastify';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';

const returnsAxios = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

axiosRetry(returnsAxios, { retries: 3, retryDelay: (retryCount) => retryCount * 1000 });

returnsAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const language = localStorage.getItem('language') || 'en';
    config.params = { ...config.params, lang: language };
    console.log(`[${new Date().toISOString()}] Returns API request:`, {
      url: config.url,
      method: config.method,
      headers: config.headers,
      params: config.params,
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
    console.error(`[${new Date().toISOString()}] Returns API response error:`, {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });

    const isRtl = localStorage.getItem('language') === 'ar';
    let message = error.response?.data?.message || (isRtl ? 'خطأ غير متوقع' : 'Unexpected error');

    if (error.response?.status === 400) {
      message = error.response?.data?.message || (isRtl ? 'بيانات غير صالحة' : 'Invalid data');
    }
    if (error.response?.status === 403) {
      message = error.response?.data?.message || (isRtl ? 'عملية غير مصرح بها' : 'Unauthorized operation');
    }
    if (error.response?.status === 404) {
      message = error.response?.data?.message || (isRtl ? 'الإرجاع غير موجود' : 'Return not found');
    }
    if (error.response?.status === 429) {
      message = isRtl ? 'طلبات كثيرة جدًا، حاول مرة أخرى لاحقًا' : 'Too many requests, try again later';
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
        return returnsAxios(originalRequest);
      } catch (refreshError) {
        console.error(`[${new Date().toISOString()}] Refresh token failed:`, refreshError);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        toast.error(isRtl ? 'فشل في تحديث التوكن، يرجى تسجيل الدخول مجددًا' : 'Failed to refresh token, please log in again', {
          position: 'top-right',
          autoClose: 3000,
          pauseOnFocusLoss: true,
        });
        return Promise.reject(refreshError);
      }
    }

    toast.error(message, {
      position: 'top-right',
      autoClose: 3000,
      pauseOnFocusLoss: true,
    });
    return Promise.reject({ message, status: error.response?.status || 500 });
  }
);

interface ReturnItem {
  productId: string;
  quantity: number;
  reason: string;
}

interface CreateReturnData {
  orderId?: string;
  branchId: string;
  reason: string;
  items: ReturnItem[];
  notes?: string;
}

export const returnsAPI = {
  createReturn: async (data: CreateReturnData) => {
    try {
      const response = await returnsAxios.post('/inventory/returns', {
        orderId: data.orderId,
        branchId: data.branchId,
        reason: data.reason.trim(),
        items: data.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          reason: item.reason.trim(),
        })),
        notes: data.notes?.trim(),
      });
      console.log(`[${new Date().toISOString()}] Return created successfully:`, response);
      return response.returnRequest;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error creating return:`, error);
      throw error;
    }
  },

  getAll: async (params: { branchId?: string; status?: string; page?: number; limit?: number } = {}) => {
    try {
      const response = await returnsAxios.get('/inventory/returns', { params });
      console.log(`[${new Date().toISOString()}] Returns fetched successfully:`, response);
      return response.returns;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error fetching returns:`, error);
      throw error;
    }
  },

  getByBranch: async (branchId: string, status?: string, page: number = 1, limit: number = 10) => {
    try {
      const params: { page: number; limit: number; status?: string } = { page, limit };
      if (status) params.status = status;
      const response = await returnsAxios.get(`/inventory/returns/branch/${branchId}`, { params });
      console.log(`[${new Date().toISOString()}] Returns by branch fetched successfully:`, response);
      return response.returns;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error fetching returns by branch:`, error);
      throw error;
    }
  },

  updateReturnStatus: async (returnId: string, data: { branchId: string; items: Array<{ productId: string; quantity: number; status: 'approved' | 'rejected'; reviewNotes?: string }>; }) => {
    try {
      const response = await returnsAxios.patch(`/inventory/returns/${returnId}/process`, {
        branchId: data.branchId,
        items: data.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          status: item.status,
          reviewNotes: item.reviewNotes?.trim(),
        })),
      });
      console.log(`[${new Date().toISOString()}] Return status updated successfully:`, response);
      return response.returnRequest;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error updating return status:`, error);
      throw error;
    }
  },

  getReturnById: async (returnId: string) => {
    try {
      const response = await returnsAxios.get(`/inventory/returns/${returnId}`);
      console.log(`[${new Date().toISOString()}] Return fetched by ID successfully:`, response);
      return response.returnRequest;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error fetching return by ID:`, error);
      throw error;
    }
  },
};

export default returnsAPI;