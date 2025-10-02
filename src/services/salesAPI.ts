// src/services/salesAPI.js
import api from './api'; // استيراد الـ api الرئيسية من api.ts (مش هننشئ instance جديد)
import { toast } from 'react-toastify';

const isValidObjectId = (id: string): boolean => /^[0-9a-fA-F]{24}$/.test(id);
const isValidPhone = (phone: string | undefined): boolean => !phone || /^\+?\d{7,15}$/.test(phone);
const isValidPaymentMethod = (method: string | undefined): boolean => !method || ['cash', 'credit_card', 'bank_transfer'].includes(method);
const isValidPaymentStatus = (status: string | undefined): boolean => !status || ['pending', 'completed', 'failed'].includes(status);

export const salesAPI = {
  create: async (saleData: {
    items: Array<{ productId: string; quantity: number; unitPrice: number }>;
    branch: string;
    notes?: string;
    paymentMethod?: string;
    paymentStatus?: string;
    customerName?: string;
    customerPhone?: string;
  }) => {
    console.log(`[${new Date().toISOString()}] salesAPI.create - Sending:`, saleData);
    if (!isValidObjectId(saleData.branch)) {
      console.error(`[${new Date().toISOString()}] salesAPI.create - Invalid branch ID:`, saleData.branch);
      throw new Error('Invalid branch ID');
    }
    if (saleData.items.some((item) => !isValidObjectId(item.productId) || item.quantity < 1 || item.unitPrice < 0)) {
      console.error(`[${new Date().toISOString()}] salesAPI.create - Invalid productId, quantity, or unitPrice in items:`, saleData.items);
      throw new Error('Invalid product ID, quantity, or unit price');
    }
    if (!isValidPhone(saleData.customerPhone)) {
      console.error(`[${new Date().toISOString()}] salesAPI.create - Invalid customer phone:`, saleData.customerPhone);
      throw new Error('Invalid customer phone');
    }
    if (!isValidPaymentMethod(saleData.paymentMethod)) {
      console.error(`[${new Date().toISOString()}] salesAPI.create - Invalid payment method:`, saleData.paymentMethod);
      throw new Error('Invalid payment method');
    }
    if (!isValidPaymentStatus(saleData.paymentStatus)) {
      console.error(`[${new Date().toISOString()}] salesAPI.create - Invalid payment status:`, saleData.paymentStatus);
      throw new Error('Invalid payment status');
    }
    try {
      for (const item of saleData.items) {
        const inventory = await inventoryAPI.getInventory({ branch: saleData.branch, product: item.productId });
        if (!inventory || inventory.length === 0 || inventory[0].currentStock < item.quantity) {
          console.error(`[${new Date().toISOString()}] salesAPI.create - Insufficient stock for product:`, item.productId);
          throw new Error(`Insufficient stock for product ${item.productId}`);
        }
      }
      const response = await api.post('/sales', {
        items: saleData.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        branch: saleData.branch,
        notes: saleData.notes?.trim(),
        paymentMethod: saleData.paymentMethod?.trim(),
        paymentStatus: saleData.paymentStatus?.trim() || 'pending',
        customerName: saleData.customerName?.trim(),
        customerPhone: saleData.customerPhone?.trim(),
      });
      console.log(`[${new Date().toISOString()}] salesAPI.create - Response:`, response);
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] salesAPI.create - Error:`, err);
      toast.error(err.message || 'Failed to create sale');
      throw err;
    }
  },

  update: async (id: string, saleData: Partial<{
    items: Array<{ productId: string; quantity: number; unitPrice: number }>;
    branch: string;
    notes?: string;
    paymentMethod?: string;
    paymentStatus?: string;
    customerName?: string;
    customerPhone?: string;
  }>) => {
    console.log(`[${new Date().toISOString()}] salesAPI.update - Sending:`, { id, saleData });
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] salesAPI.update - Invalid sale ID:`, id);
      throw new Error('Invalid sale ID');
    }
    if (saleData.branch && !isValidObjectId(saleData.branch)) {
      console.error(`[${new Date().toISOString()}] salesAPI.update - Invalid branch ID:`, saleData.branch);
      throw new Error('Invalid branch ID');
    }
    if (saleData.items?.some((item) => !isValidObjectId(item.productId) || item.quantity < 1 || item.unitPrice < 0)) {
      console.error(`[${new Date().toISOString()}] salesAPI.update - Invalid productId, quantity, or unitPrice in items:`, saleData.items);
      throw new Error('Invalid product ID, quantity, or unit price');
    }
    if (!isValidPhone(saleData.customerPhone)) {
      console.error(`[${new Date().toISOString()}] salesAPI.update - Invalid customer phone:`, saleData.customerPhone);
      throw new Error('Invalid customer phone');
    }
    if (!isValidPaymentMethod(saleData.paymentMethod)) {
      console.error(`[${new Date().toISOString()}] salesAPI.update - Invalid payment method:`, saleData.paymentMethod);
      throw new Error('Invalid payment method');
    }
    if (!isValidPaymentStatus(saleData.paymentStatus)) {
      console.error(`[${new Date().toISOString()}] salesAPI.update - Invalid payment status:`, saleData.paymentStatus);
      throw new Error('Invalid payment status');
    }
    try {
      if (saleData.items && saleData.branch) {
        for (const item of saleData.items) {
          const inventory = await inventoryAPI.getInventory({ branch: saleData.branch, product: item.productId });
          if (!inventory || inventory.length === 0 || inventory[0].currentStock < item.quantity) {
            console.error(`[${new Date().toISOString()}] salesAPI.update - Insufficient stock for product:`, item.productId);
            throw new Error(`Insufficient stock for product ${item.productId}`);
          }
        }
      }
      const response = await api.put(`/sales/${id}`, {
        items: saleData.items?.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        branch: saleData.branch,
        notes: saleData.notes?.trim(),
        paymentMethod: saleData.paymentMethod?.trim(),
        paymentStatus: saleData.paymentStatus?.trim(),
        customerName: saleData.customerName?.trim(),
        customerPhone: saleData.customerPhone?.trim(),
      });
      console.log(`[${new Date().toISOString()}] salesAPI.update - Response:`, response);
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] salesAPI.update - Error:`, err);
      toast.error(err.message || 'Failed to update sale');
      throw err;
    }
  },

  delete: async (id: string) => {
    console.log(`[${new Date().toISOString()}] salesAPI.delete - Sending:`, id);
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] salesAPI.delete - Invalid sale ID:`, id);
      throw new Error('Invalid sale ID');
    }
    try {
      const response = await api.delete(`/sales/${id}`);
      console.log(`[${new Date().toISOString()}] salesAPI.delete - Response:`, response);
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] salesAPI.delete - Error:`, err);
      toast.error(err.message || 'Failed to delete sale');
      throw err;
    }
  },

  getAll: async (params: { branch?: string; startDate?: string; endDate?: string; page?: number; limit?: number; paymentStatus?: string } = {}) => {
    console.log(`[${new Date().toISOString()}] salesAPI.getAll - Params:`, params);
    if (params.branch && !isValidObjectId(params.branch)) {
      console.error(`[${new Date().toISOString()}] salesAPI.getAll - Invalid branch ID:`, params.branch);
      throw new Error('Invalid branch ID');
    }
    try {
      const response = await api.get('/sales', { params });
      console.log(`[${new Date().toISOString()}] salesAPI.getAll - Response:`, response);
      if (!response || !Array.isArray(response.sales)) {
        console.error(`[${new Date().toISOString()}] salesAPI.getAll - Invalid sales response:`, response);
        throw new Error('Invalid sales response from server');
      }
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] salesAPI.getAll - Error:`, err);
      toast.error(err.message || 'Failed to fetch sales');
      throw err;
    }
  },

  getById: async (id: string) => {
    console.log(`[${new Date().toISOString()}] salesAPI.getById - Sending:`, id);
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] salesAPI.getById - Invalid sale ID:`, id);
      throw new Error('Invalid sale ID');
    }
    try {
      const response = await api.get(`/sales/${id}`);
      console.log(`[${new Date().toISOString()}] salesAPI.getById - Response:`, response);
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] salesAPI.getById - Error:`, err);
      toast.error(err.message || 'Failed to fetch sale');
      throw err;
    }
  },

  getAnalytics: async (params: { branch?: string; startDate?: string; endDate?: string; paymentStatus?: string } = {}) => {
    console.log(`[${new Date().toISOString()}] salesAPI.getAnalytics - Params:`, params);
    if (params.branch && !isValidObjectId(params.branch)) {
      console.error(`[${new Date().toISOString()}] salesAPI.getAnalytics - Invalid branch ID:`, params.branch);
      throw new Error('Invalid branch ID');
    }
    try {
      const response = await api.get('/sales/analytics', { params });
      console.log(`[${new Date().toISOString()}] salesAPI.getAnalytics - Response:`, response);
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] salesAPI.getAnalytics - Error:`, err);
      toast.error(err.message || 'Failed to fetch sales analytics');
      throw err;
    }
  },

  exportReport: async (params: { branch?: string; startDate?: string; endDate?: string; format: 'csv' | 'pdf' }) => {
    console.log(`[${new Date().toISOString()}] salesAPI.exportReport - Params:`, params);
    if (params.branch && !isValidObjectId(params.branch)) {
      console.error(`[${new Date().toISOString()}] salesAPI.exportReport - Invalid branch ID:`, params.branch);
      throw new Error('Invalid branch ID');
    }
    try {
      const response = await api.get('/sales/export', {
        params,
        responseType: 'blob',
      });
      console.log(`[${new Date().toISOString()}] salesAPI.exportReport - Response:`, response);
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] salesAPI.exportReport - Error:`, err);
      toast.error(err.message || 'Failed to export report');
      throw err;
    }
  },
};

export default salesAPI;