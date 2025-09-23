
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';
const isRtl = localStorage.getItem('language') === 'ar';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  params: { isRtl: isRtl.toString() },
});

const isValidObjectId = (id: string): boolean => /^[0-9a-fA-F]{24}$/.test(id);

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(`[${new Date().toISOString()}] API request:`, {
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
    let message = error.response?.data?.message || 'خطأ غير متوقع';
    if (error.response?.status === 400) {
      message = error.response?.data?.message || 'بيانات غير صالحة';
      if (error.response?.data?.field) {
        message = `${message}: ${error.response.data.field} = ${error.response.data.value}`;
      }
    }
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
          return Promise.reject({ message: 'التوكن منتهي الصلاحية ولا يوجد توكن منعش', status: 401 });
        }
        const response = await axios.post<{ accessToken: string; refreshToken?: string }>(`${API_BASE_URL}/auth/refresh-token`, { refreshToken });
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
        return Promise.reject({ message: 'فشل تجديد التوكن', status: 401 });
      }
    }
    return Promise.reject({ message, status: error.response?.status });
  }
);

export const branchesAPI = {
  getAll: async () => {
    const response = await api.get('/branches');
    console.log(`[${new Date().toISOString()}] Branches getAll response:`, response);
    return response;
  },
  getById: async (id: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] Branches getById - Invalid branch ID:`, id);
      throw new Error('Invalid branch ID');
    }
    const response = await api.get(`/branches/${id}`);
    console.log(`[${new Date().toISOString()}] Branches getById response:`, response);
    return response;
  },
  create: async (branchData: {
    name: string;
    nameEn?: string;
    code: string;
    address: string;
    city: string;
    phone?: string;
    user: {
      name: string;
      nameEn?: string;
      username: string;
      password: string;
      email?: string;
      phone?: string;
      isActive?: boolean;
    };
  }) => {
    const response = await api.post('/branches', {
      name: branchData.name.trim(),
      nameEn: branchData.nameEn?.trim(),
      code: branchData.code.trim(),
      address: branchData.address.trim(),
      city: branchData.city.trim(),
      phone: branchData.phone?.trim(),
      user: {
        name: branchData.user.name.trim(),
        nameEn: branchData.user.nameEn?.trim(),
        username: branchData.user.username.trim(),
        password: branchData.user.password,
        email: branchData.user.email?.trim(),
        phone: branchData.user.phone?.trim(),
        isActive: branchData.user.isActive ?? true,
      },
    });
    console.log(`[${new Date().toISOString()}] Branches create response:`, response);
    return response;
  },
  update: async (id: string, branchData: {
    name: string;
    nameEn?: string;
    code: string;
    address: string;
    city: string;
    phone?: string;
    user: {
      name: string;
      nameEn?: string;
      username: string;
      email?: string;
      phone?: string;
      isActive?: boolean;
    };
  }) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] Branches update - Invalid branch ID:`, id);
      throw new Error('Invalid branch ID');
    }
    const response = await api.put(`/branches/${id}`, {
      name: branchData.name.trim(),
      nameEn: branchData.nameEn?.trim(),
      code: branchData.code.trim(),
      address: branchData.address.trim(),
      city: branchData.city.trim(),
      phone: branchData.phone?.trim(),
      user: {
        name: branchData.user.name.trim(),
        nameEn: branchData.user.nameEn?.trim(),
        username: branchData.user.username.trim(),
        email: branchData.user.email?.trim(),
        phone: branchData.user.phone?.trim(),
        isActive: branchData.user.isActive ?? true,
      },
    });
    console.log(`[${new Date().toISOString()}] Branches update response:`, response);
    return response;
  },
  delete: async (id: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] Branches delete - Invalid branch ID:`, id);
      throw new Error('Invalid branch ID');
    }
    const response = await api.delete(`/branches/${id}`);
    console.log(`[${new Date().toISOString()}] Branches delete response:`, response);
    return response;
  },
  checkEmail: async (email: string) => {
    const response = await api.post('/branches/check-email', { email: email.trim() });
    console.log(`[${new Date().toISOString()}] Branches checkEmail response:`, response);
    return response;
  },
  resetPassword: async (id: string, password: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] Branches resetPassword - Invalid branch ID:`, id);
      throw new Error('Invalid branch ID');
    }
    const response = await api.post(`/branches/${id}/reset-password`, { password });
    console.log(`[${new Date().toISOString()}] Branches resetPassword response:`, response);
    return response;
  },
};