import axios from 'axios';
import axiosRetry from 'axios-retry';
import { toast } from 'react-toastify';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';

const inventoryAxios = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

axiosRetry(inventoryAxios, { retries: 3, retryDelay: (retryCount) => retryCount * 1000 });

inventoryAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const language = localStorage.getItem('language') || 'en';
    config.params = { ...config.params, lang: language };
    console.log(`[${new Date().toISOString()}] Inventory API request:`, {
      url: config.url,
      method: config.method,
      headers: config.headers,
      params: config.params,
    });
    return config;
  },
  (error) => {
    console.error(`[${new Date().toISOString()}] Inventory API request error:`, error);
    return Promise.reject(error);
  }
);

inventoryAxios.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;
    console.error(`[${new Date().toISOString()}] Inventory API response error:`, {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });

    let message = error.response?.data?.message || 'Unexpected error';
    const isRtl = localStorage.getItem('language') === 'ar';
    if (error.response?.status === 400) message = error.response?.data?.message || (isRtl ? 'بيانات غير صالحة' : 'Invalid data');
    if (error.response?.status === 403) message = error.response?.data?.message || (isRtl ? 'عملية غير مصرح بها' : 'Unauthorized operation');
    if (error.response?.status === 404) message = error.response?.data?.message || (isRtl ? 'المورد غير موجود' : 'Resource not found');
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
        return inventoryAxios(originalRequest);
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

export const inventoryAPI = {
  getAll: async (params: { branch?: string; product?: string; lowStock?: boolean; page?: number; limit?: number } = {}) => {
    console.log(`[${new Date().toISOString()}] inventoryAPI.getAll - Sending:`, params);
    try {
      if (params.branch && !isValidObjectId(params.branch)) {
        console.error(`[${new Date().toISOString()}] inventoryAPI.getAll - Invalid branch ID:`, params.branch);
        throw new Error('Invalid branch ID');
      }
      if (params.product && !isValidObjectId(params.product)) {
        console.error(`[${new Date().toISOString()}] inventoryAPI.getAll - Invalid product ID:`, params.product);
        throw new Error('Invalid product ID');
      }
      const response = await inventoryAxios.get('/inventory', { params });
      console.log(`[${new Date().toISOString()}] inventoryAPI.getAll - Response:`, response);
      return response.inventory;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getAll - Error:`, error);
      throw error;
    }
  },

  getByBranch: async (branchId: string) => {
    console.log(`[${new Date().toISOString()}] inventoryAPI.getByBranch - Sending:`, { branchId });
    try {
      if (!isValidObjectId(branchId)) {
        console.error(`[${new Date().toISOString()}] inventoryAPI.getByBranch - Invalid branch ID:`, branchId);
        throw new Error('Invalid branch ID');
      }
      const response = await inventoryAxios.get(`/inventory/branch/${branchId}`);
      console.log(`[${new Date().toISOString()}] inventoryAPI.getByBranch - Response:`, response);
      return response.inventory;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getByBranch - Error:`, error);
      throw error;
    }
  },

  create: async (data: {
    branchId: string;
    productId: string;
    currentStock: number;
    minStockLevel?: number;
    maxStockLevel?: number;
    userId: string;
    orderId?: string;
  }) => {
    console.log(`[${new Date().toISOString()}] inventoryAPI.create - Sending:`, data);
    try {
      if (
        !isValidObjectId(data.branchId) ||
        !isValidObjectId(data.productId) ||
        !isValidObjectId(data.userId) ||
        (data.orderId && !isValidObjectId(data.orderId)) ||
        data.currentStock < 0
      ) {
        console.error(`[${new Date().toISOString()}] inventoryAPI.create - Invalid data:`, data);
        throw new Error('Invalid branch ID, product ID, user ID, order ID, or negative stock quantity');
      }
      const response = await inventoryAxios.post('/inventory', {
        branchId: data.branchId,
        productId: data.productId,
        currentStock: data.currentStock,
        minStockLevel: data.minStockLevel ?? 0,
        maxStockLevel: data.maxStockLevel ?? 1000,
        userId: data.userId,
        orderId: data.orderId,
      });
      console.log(`[${new Date().toISOString()}] inventoryAPI.create - Response:`, response);
      return response.inventory;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.create - Error:`, error);
      throw error;
    }
  },

  bulkCreate: async (data: {
    branchId: string;
    userId: string;
    orderId?: string;
    items: Array<{ productId: string; currentStock: number; minStockLevel?: number; maxStockLevel?: number }>;
  }) => {
    console.log(`[${new Date().toISOString()}] inventoryAPI.bulkCreate - Sending:`, data);
    try {
      if (
        !isValidObjectId(data.branchId) ||
        !isValidObjectId(data.userId) ||
        (data.orderId && !isValidObjectId(data.orderId)) ||
        !Array.isArray(data.items) ||
        data.items.length === 0 ||
        data.items.some(item => !isValidObjectId(item.productId) || item.currentStock < 0)
      ) {
        console.error(`[${new Date().toISOString()}] inventoryAPI.bulkCreate - Invalid data:`, data);
        throw new Error('Invalid branch ID, user ID, order ID, or items');
      }
      const response = await inventoryAxios.post('/inventory/bulk', {
        branchId: data.branchId,
        userId: data.userId,
        orderId: data.orderId,
        items: data.items.map(item => ({
          productId: item.productId,
          currentStock: item.currentStock,
          minStockLevel: item.minStockLevel ?? 0,
          maxStockLevel: item.maxStockLevel ?? 1000,
        })),
      });
      console.log(`[${new Date().toISOString()}] inventoryAPI.bulkCreate - Response:`, response);
      return response.inventories;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.bulkCreate - Error:`, error);
      throw error;
    }
  },

  updateStock: async (id: string, data: Partial<{
    currentStock: number;
    minStockLevel: number;
    maxStockLevel: number;
    productId: string;
    branchId: string;
  }>) => {
    console.log(`[${new Date().toISOString()}] inventoryAPI.updateStock - Sending:`, { id, data });
    try {
      if (
        !isValidObjectId(id) ||
        (data.productId && !isValidObjectId(data.productId)) ||
        (data.branchId && !isValidObjectId(data.branchId)) ||
        (data.currentStock !== undefined && data.currentStock < 0)
      ) {
        console.error(`[${new Date().toISOString()}] inventoryAPI.updateStock - Invalid data:`, { id, data });
        throw new Error('Invalid inventory ID, product ID, branch ID, or negative stock quantity');
      }
      const response = await inventoryAxios.put(`/inventory/${id}`, {
        currentStock: data.currentStock,
        minStockLevel: data.minStockLevel,
        maxStockLevel: data.maxStockLevel,
        productId: data.productId,
        branchId: data.branchId,
      });
      console.log(`[${new Date().toISOString()}] inventoryAPI.updateStock - Response:`, response);
      return response.inventory;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStock - Error:`, error);
      throw error;
    }
  },

  createRestockRequest: async (data: {
    productId: string;
    branchId: string;
    requestedQuantity: number;
    notes?: string;
  }) => {
    console.log(`[${new Date().toISOString()}] inventoryAPI.createRestockRequest - Sending:`, data);
    try {
      if (
        !isValidObjectId(data.productId) ||
        !isValidObjectId(data.branchId) ||
        data.requestedQuantity < 1
      ) {
        console.error(`[${new Date().toISOString()}] inventoryAPI.createRestockRequest - Invalid data:`, data);
        throw new Error('Invalid product ID, branch ID, or requested quantity');
      }
      const response = await inventoryAxios.post('/inventory/restock-requests', {
        productId: data.productId,
        branchId: data.branchId,
        requestedQuantity: data.requestedQuantity,
        notes: data.notes?.trim(),
      });
      console.log(`[${new Date().toISOString()}] inventoryAPI.createRestockRequest - Response:`, response);
      return response.restockRequest;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.createRestockRequest - Error:`, error);
      throw error;
    }
  },

  getRestockRequests: async (params: { branchId?: string; page?: number; limit?: number } = {}) => {
    console.log(`[${new Date().toISOString()}] inventoryAPI.getRestockRequests - Sending:`, params);
    try {
      if (params.branchId && !isValidObjectId(params.branchId)) {
        console.error(`[${new Date().toISOString()}] inventoryAPI.getRestockRequests - Invalid branch ID:`, params.branchId);
        throw new Error('Invalid branch ID');
      }
      const response = await inventoryAxios.get('/inventory/restock-requests', { params });
      console.log(`[${new Date().toISOString()}] inventoryAPI.getRestockRequests - Response:`, response);
      return response.restockRequests;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getRestockRequests - Error:`, error);
      throw error;
    }
  },

  approveRestockRequest: async (requestId: string, data: { approvedQuantity: number; userId: string }) => {
    console.log(`[${new Date().toISOString()}] inventoryAPI.approveRestockRequest - Sending:`, { requestId, data });
    try {
      if (!isValidObjectId(requestId) || !isValidObjectId(data.userId) || data.approvedQuantity < 1) {
        console.error(`[${new Date().toISOString()}] inventoryAPI.approveRestockRequest - Invalid data:`, { requestId, data });
        throw new Error('Invalid request ID, user ID, or approved quantity');
      }
      const response = await inventoryAxios.patch(`/inventory/restock-requests/${requestId}/approve`, {
        approvedQuantity: data.approvedQuantity,
        userId: data.userId,
      });
      console.log(`[${new Date().toISOString()}] inventoryAPI.approveRestockRequest - Response:`, response);
      return response.restockRequest;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.approveRestockRequest - Error:`, error);
      throw error;
    }
  },

  getHistory: async (params: { branchId?: string; productId?: string; page?: number; limit?: number } = {}) => {
    console.log(`[${new Date().toISOString()}] inventoryAPI.getHistory - Sending:`, params);
    try {
      if (params.branchId && !isValidObjectId(params.branchId)) {
        console.error(`[${new Date().toISOString()}] inventoryAPI.getHistory - Invalid branch ID:`, params.branchId);
        throw new Error('Invalid branch ID');
      }
      if (params.productId && !isValidObjectId(params.productId)) {
        console.error(`[${new Date().toISOString()}] inventoryAPI.getHistory - Invalid product ID:`, params.productId);
        throw new Error('Invalid product ID');
      }
      const response = await inventoryAxios.get('/inventory/history', { params });
      console.log(`[${new Date().toISOString()}] inventoryAPI.getHistory - Response:`, response);
      return response.history;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getHistory - Error:`, error);
      throw error;
    }
  },
};

export default inventoryAPI;