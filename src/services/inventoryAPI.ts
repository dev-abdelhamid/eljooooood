import axios from 'axios';
import { toast } from 'react-toastify';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';

const inventoryAxios = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor for adding token and language
inventoryAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    const language = localStorage.getItem('language') || 'ar';
    const isRtl = language === 'ar';
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.params = { ...config.params, lang: language };
    console.log(`[${new Date().toISOString()}] Inventory API request:`, {
      url: config.url,
      method: config.method,
      headers: config.headers,
      params: config.params,
      data: config.data,
    });
    return config;
  },
  (error) => {
    console.error(`[${new Date().toISOString()}] Inventory API request error:`, error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
inventoryAxios.interceptors.response.use(
  (response) => response,
  (error) => {
    const language = localStorage.getItem('language') || 'ar';
    const isRtl = language === 'ar';

    let message = error.response?.data?.message || error.message || (isRtl ? 'خطأ غير متوقع' : 'Unexpected error');
    const errors = error.response?.data?.errors || [];

    if (error.code === 'ECONNABORTED') {
      message = isRtl ? 'انتهت مهلة الطلب، حاول مرة أخرى' : 'Request timed out, please try again';
    } else if (!error.response) {
      message = isRtl ? 'فشل الاتصال بالخادم' : 'Failed to connect to server';
    } else if (error.response.status === 400) {
      message = errors.length
        ? errors.map((err) => err.msg).join(', ')
        : error.response.data?.message || (isRtl ? 'بيانات غير صالحة' : 'Invalid data');
    } else if (error.response.status === 403) {
      message = error.response.data?.message || (isRtl ? 'عملية غير مصرح بها' : 'Unauthorized operation');
    } else if (error.response.status === 404) {
      message = error.response.data?.message || (isRtl ? 'الفرع أو المنتج غير موجود' : 'Branch or product not found');
    } else if (error.response.status === 422) {
      message = error.response.data?.message || (isRtl ? 'بيانات غير صالحة' : 'Invalid data');
    } else if (error.response.status === 429) {
      message = isRtl ? 'طلبات كثيرة جدًا، حاول مرة أخرى لاحقًا' : 'Too many requests, try again later';
    } else if (error.response.status === 500) {
      message = isRtl ? 'خطأ في الخادم، حاول مرة أخرى لاحقًا' : 'Server error, please try again later';
    }

    if (error.response?.status === 401) {
      console.error(`[${new Date().toISOString()}] Unauthorized:`, error);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
      toast.error(isRtl ? 'التوكن منتهي الصلاحية، يرجى تسجيل الدخول مجددًا' : 'Token expired, please log in again', {
        position: isRtl ? 'top-right' : 'top-left',
        autoClose: 3000,
        pauseOnFocusLoss: true,
      });
      return Promise.reject({ message: isRtl ? 'التوكن منتهي الصلاحية' : 'Token expired', status: 401 });
    }

    console.error(`[${new Date().toISOString()}] Inventory API response error:`, {
      status: error.response?.status,
      message,
      errors,
    });
    toast.error(message, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000, pauseOnFocusLoss: true });
    return Promise.reject({ message, status: error.response?.status, errors });
  }
);

// Validate ObjectId
const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

export const inventoryAPI = {
  getByBranch: async (branchId) => {
    console.log(`[${new Date().toISOString()}] inventoryAPI.getByBranch - Sending:`, { branchId });
    try {
      if (!isValidObjectId(branchId)) {
        console.error(`[${new Date().toISOString()}] inventoryAPI.getByBranch - Invalid branch ID:`, branchId);
        throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
      }
      const response = await inventoryAxios.get(`/inventory/branch/${branchId}`);
      console.log(`[${new Date().toISOString()}] inventoryAPI.getByBranch - Response:`, response.data);
      return response.data;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getByBranch - Error:`, error);
      throw error;
    }
  },

  getHistory: async ({ productId, branchId }) => {
    console.log(`[${new Date().toISOString()}] inventoryAPI.getHistory - Sending:`, { productId, branchId });
    try {
      if (!isValidObjectId(productId)) {
        console.error(`[${new Date().toISOString()}] inventoryAPI.getHistory - Invalid product ID:`, productId);
        throw new Error(isRtl ? 'معرف المنتج غير صالح' : 'Invalid product ID');
      }
      if (!isValidObjectId(branchId)) {
        console.error(`[${new Date().toISOString()}] inventoryAPI.getHistory - Invalid branch ID:`, branchId);
        throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
      }
      const response = await inventoryAxios.get('/inventory/history', {
        params: { productId, branchId },
      });
      console.log(`[${new Date().toISOString()}] inventoryAPI.getHistory - Response:`, response.data);
      return response.data;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getHistory - Error:`, error);
      throw error;
    }
  },

  updateStock: async (inventoryId, data) => {
    console.log(`[${new Date().toISOString()}] inventoryAPI.updateStock - Sending:`, { inventoryId, data });
    try {
      if (!isValidObjectId(inventoryId)) {
        console.error(`[${new Date().toISOString()}] inventoryAPI.updateStock - Invalid inventory ID:`, inventoryId);
        throw new Error(isRtl ? 'معرف المخزون غير صالح' : 'Invalid inventory ID');
      }
      if (!isValidObjectId(data.branchId)) {
        console.error(`[${new Date().toISOString()}] inventoryAPI.updateStock - Invalid branch ID:`, data.branchId);
        throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
      }
      if (data.minStockLevel < 0 || data.maxStockLevel < 0) {
        throw new Error(isRtl ? 'مستويات المخزون يجب أن تكون غير سالبة' : 'Stock levels must be non-negative');
      }
      if (data.maxStockLevel <= data.minStockLevel) {
        throw new Error(isRtl ? 'الحد الأقصى للمخزون يجب أن يكون أكبر من الحد الأدنى' : 'Maximum stock must be greater than minimum stock');
      }
      const response = await inventoryAxios.put(`/inventory/${inventoryId}`, data);
      console.log(`[${new Date().toISOString()}] inventoryAPI.updateStock - Response:`, response.data);
      return response.data;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStock - Error:`, error);
      throw error;
    }
  },
};

export default inventoryAPI;