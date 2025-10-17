import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(`API request at ${new Date().toISOString()}:`, {
      url: config.url,
      method: config.method,
      headers: config.headers,
    });
    return config;
  },
  (error) => {
    console.error(`API request error at ${new Date().toISOString()}:`, error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;
    console.error(`API response error at ${new Date().toISOString()}:`, {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });

    let message = error.response?.data?.message || 'Unexpected error';
    if (error.response?.status === 400) message = error.response?.data?.message || 'Invalid data';
    if (error.response?.status === 403) message = error.response?.data?.message || 'Unauthorized operation';
    if (error.response?.status === 404) message = error.response?.data?.message || 'Resource not found';
    if (error.response?.status === 429) message = 'Too many requests, please try again later';

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          console.error(`No refresh token available at ${new Date().toISOString()}`);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          return Promise.reject({ message: 'Token expired and no refresh token available', status: 401 });
        }
        const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        localStorage.setItem('token', accessToken);
        if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken);
        console.log(`Token refreshed successfully at ${new Date().toISOString()}`);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error(`Refresh token failed at ${new Date().toISOString()}:`, refreshError);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject({ message: 'Failed to refresh token', status: 401 });
      }
    }

    return Promise.reject({ message, status: error.response?.status });
  }
);

export const branchesAPI = {
  getAll: async (params: { status?: string } = {}) => {
    const response = await api.get('/branches', { params });
    console.log(`Branches getAll response at ${new Date().toISOString()}:`, response);
    return response;
  },
  getById: async (id: string) => {
    const response = await api.get(`/branches/${id}`);
    console.log(`Branches getById response at ${new Date().toISOString()}:`, response);
    return response;
  },
  create: async (branchData: {
    name: { ar: string; en: string };
    code: string;
    address: { ar: string; en: string };
    city: { ar: string; en: string };
    phone?: string;
    user: {
      name: { ar: string; en: string };
      username: string;
      password: string;
      email?: string;
      phone?: string;
      isActive: boolean;
    };
  }) => {
    const response = await api.post('/branches', {
      name: { ar: branchData.name.ar.trim(), en: branchData.name.en.trim() },
      code: branchData.code.trim(),
      address: { ar: branchData.address.ar.trim(), en: branchData.address.en.trim() },
      city: { ar: branchData.city.ar.trim(), en: branchData.city.en.trim() },
      phone: branchData.phone?.trim(),
      user: {
        name: { ar: branchData.user.name.ar.trim(), en: branchData.user.name.en.trim() },
        username: branchData.user.username.trim(),
        password: branchData.user.password,
        email: branchData.user.email?.trim(),
        phone: branchData.user.phone?.trim(),
        isActive: branchData.user.isActive,
      },
    });
    console.log(`Branches create response at ${new Date().toISOString()}:`, response);
    return response;
  },
  update: async (id: string, branchData: {
    name: { ar: string; en: string };
    code: string;
    address: { ar: string; en: string };
    city: { ar: string; en: string };
    phone?: string;
    user: {
      name: { ar: string; en: string };
      username: string;
      email?: string;
      phone?: string;
      isActive: boolean;
    };
  }) => {
    const response = await api.put(`/branches/${id}`, {
      name: { ar: branchData.name.ar.trim(), en: branchData.name.en.trim() },
      code: branchData.code.trim(),
      address: { ar: branchData.address.ar.trim(), en: branchData.address.en.trim() },
      city: { ar: branchData.city.ar.trim(), en: branchData.city.en.trim() },
      phone: branchData.phone?.trim(),
      user: {
        name: { ar: branchData.user.name.ar.trim(), en: branchData.user.name.en.trim() },
        username: branchData.user.username.trim(),
        email: branchData.user.email?.trim(),
        phone: branchData.user.phone?.trim(),
        isActive: branchData.user.isActive,
      },
    });
    console.log(`Branches update response at ${new Date().toISOString()}:`, response);
    return response;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/branches/${id}`);
    console.log(`Branches delete response at ${new Date().toISOString()}:`, response);
    return response;
  },
  checkEmail: async (email: string) => {
    const response = await api.post('/branches/check-email', { email: email.trim() });
    console.log(`Branches checkEmail response at ${new Date().toISOString()}:`, response);
    return response;
  },
  resetBranchPassword: async (id: string, data: { password: string }) => {
    const response = await api.patch(`/branches/${id}/reset-password`, {
      password: data.password,
    });
    console.log(`Branches resetBranchPassword response at ${new Date().toISOString()}:`, response);
    return response;
  },
};