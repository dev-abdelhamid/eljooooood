import axios from 'axios';
import axiosRetry from 'axios-retry';
import { toast } from 'react-toastify';
import api from './api'; // استخدام الـ api instance الأساسي بدل salesAxios

axiosRetry(api, { retries: 3, retryDelay: (retryCount) => retryCount * 1000 });

export const salesAPI = {
  create: async (saleData: {
    items: Array<{ productId: string; quantity: number; unitPrice: number }>;
    branch: string;
    notes?: string;
    paymentMethod?: string;
    customerName?: string;
    customerPhone?: string;
  }) => {
    console.log(`[${new Date().toISOString()}] salesAPI.create - Sending:`, saleData);
    if (!/^[0-9a-fA-F]{24}$/.test(saleData.branch)) {
      console.error(`[${new Date().toISOString()}] Invalid branch ID:`, saleData.branch);
      throw new Error('معرف الفرع غير صالح');
    }
    if (saleData.items.some((item) => !/^[0-9a-fA-F]{24}$/.test(item.productId))) {
      console.error(`[${new Date().toISOString()}] Invalid productId in items:`, saleData.items);
      throw new Error('معرف المنتج غير صالح');
    }
    try {
      const response = await api.post('/sales', {
        items: saleData.items.map(item => ({
          product: item.productId, // تغيير productId إلى product
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        branch: saleData.branch,
        notes: saleData.notes?.trim(),
        paymentMethod: saleData.paymentMethod?.trim() || 'cash', // التأكد من إن paymentMethod تكون cash, credit, أو other
        customerName: saleData.customerName?.trim(),
        customerPhone: saleData.customerPhone?.trim(),
      });
      console.log(`[${new Date().toISOString()}] salesAPI.create - Response:`, response);
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] salesAPI.create - Error:`, err);
      toast.error('فشل إنشاء المبيعة', { position: 'top-right', autoClose: 3000, pauseOnFocusLoss: true });
      throw err;
    }
  },

  getAll: async (params: { branch?: string; startDate?: string; endDate?: string; page?: number; limit?: number } = {}) => {
    if (params.branch && !/^[0-9a-fA-F]{24}$/.test(params.branch)) {
      console.error(`[${new Date().toISOString()}] Invalid branch ID:`, params.branch);
      throw new Error('معرف الفرع غير صالح');
    }
    console.log(`[${new Date().toISOString()}] salesAPI.getAll - Params:`, params);
    try {
      const response = await api.get('/sales', { params });
      console.log(`[${new Date().toISOString()}] salesAPI.getAll - Response:`, response);
      if (!response || !Array.isArray(response.sales)) {
        console.error(`[${new Date().toISOString()}] Invalid sales response:`, response);
        throw new Error('استجابة المبيعات غير صالحة من الخادم');
      }
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] salesAPI.getAll - Error:`, err);
      toast.error('فشل جلب المبيعات', { position: 'top-right', autoClose: 3000, pauseOnFocusLoss: true });
      throw err;
    }
  },

  getById: async (id: string) => {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error(`[${new Date().toISOString()}] Invalid sale ID:`, id);
      throw new Error('معرف المبيعة غير صالح');
    }
    try {
      const response = await api.get(`/sales/${id}`);
      console.log(`[${new Date().toISOString()}] salesAPI.getById - Response:`, response);
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] salesAPI.getById - Error:`, err);
      toast.error('فشل جلب المبيعة', { position: 'top-right', autoClose: 3000, pauseOnFocusLoss: true });
      throw err;
    }
  },

  getAnalytics: async (params: { branch?: string; startDate?: string; endDate?: string } = {}) => {
    if (params.branch && !/^[0-9a-fA-F]{24}$/.test(params.branch)) {
      console.error(`[${new Date().toISOString()}] Invalid branch ID:`, params.branch);
      throw new Error('معرف الفرع غير صالح');
    }
    console.log(`[${new Date().toISOString()}] salesAPI.getAnalytics - Params:`, params);
    try {
      const response = await api.get('/sales/analytics', { params });
      console.log(`[${new Date().toISOString()}] salesAPI.getAnalytics - Response:`, response);
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] salesAPI.getAnalytics - Error:`, err);
      toast.error('فشل جلب تحليلات المبيعات', { position: 'top-right', autoClose: 3000, pauseOnFocusLoss: true });
      throw err;
    }
  },
};

export default salesAPI;