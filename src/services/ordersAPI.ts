import axios from 'axios';
import { toast } from 'react-toastify';

const isRtl = localStorage.getItem('language') === 'ar';

const isValidObjectId = (id: string): boolean => /^[0-9a-fA-F]{24}$/.test(id);

export const ordersAPI = {
  getAll: async (query: {
    status?: string;
    branch?: string;
    priority?: string;
    page?: number;
    limit?: number;
    lang?: string;
  } = {}) => {
    console.log(`[${new Date().toISOString()}] ordersAPI.getAll - Sending:`, query);
    try {
      const response = await axios.get('/orders', {
        baseURL: process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api',
        params: { ...query, lang: query.lang || (isRtl ? 'ar' : 'en') },
      });
      console.log(`[${new Date().toISOString()}] ordersAPI.getAll - Response:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] ordersAPI.getAll - Error:`, {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
      });
      const message = error.response?.data?.message || (isRtl ? 'فشل في جلب الطلبات' : 'Failed to fetch orders');
      toast.error(message, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
      throw new Error(message);
    }
  },

  getOrderById: async (id: string, lang: string = isRtl ? 'ar' : 'en') => {
    console.log(`[${new Date().toISOString()}] ordersAPI.getOrderById - Sending:`, { id });
    if (!isValidObjectId(id)) {
      const message = isRtl ? 'معرف الطلب غير صالح' : 'Invalid order ID';
      console.error(`[${new Date().toISOString()}] ordersAPI.getOrderById - Invalid ID:`, { id });
      toast.error(message, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
      throw new Error(message);
    }
    try {
      const response = await axios.get(`/orders/${id}`, {
        baseURL: process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api',
        params: { lang },
      });
      console.log(`[${new Date().toISOString()}] ordersAPI.getOrderById - Response:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] ordersAPI.getOrderById - Error:`, {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
      });
      const message = error.response?.data?.message || (isRtl ? 'فشل في جلب الطلب' : 'Failed to fetch order');
      toast.error(message, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
      throw new Error(message);
    }
  },

  createOrder: async (data: {
    orderNumber: string;
    branchId: string;
    items: Array<{
      product: string;
      quantity: number;
      price: number;
    }>;
    status?: string;
    notes?: string;
    priority?: string;
    lang?: string;
  }) => {
    console.log(`[${new Date().toISOString()}] ordersAPI.createOrder - Sending:`, data);
    if (
      !data.orderNumber ||
      !isValidObjectId(data.branchId) ||
      !data.items?.length ||
      data.items.some((item) => !isValidObjectId(item.product) || item.quantity < 1 || item.price < 0)
    ) {
      console.error(`[${new Date().toISOString()}] ordersAPI.createOrder - Invalid data:`, data);
      const message = isRtl ? 'بيانات الطلب غير صالحة' : 'Invalid order data';
      toast.error(message, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
      throw new Error(message);
    }
    try {
      const response = await axios.post('/orders', {
        orderNumber: data.orderNumber,
        branchId: data.branchId,
        items: data.items,
        status: data.status || 'pending',
        notes: data.notes?.trim(),
        priority: data.priority || 'medium',
        lang: data.lang || (isRtl ? 'ar' : 'en'),
      }, {
        baseURL: process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api',
      });
      console.log(`[${new Date().toISOString()}] ordersAPI.createOrder - Response:`, response.data);
      toast.success(isRtl ? 'تم إنشاء الطلب بنجاح' : 'Order created successfully', {
        position: isRtl ? 'top-right' : 'top-left',
        autoClose: 3000,
      });
      return response.data;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] ordersAPI.createOrder - Error:`, {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
      });
      const message = error.response?.data?.message || (isRtl ? 'فشل في إنشاء الطلب' : 'Failed to create order');
      toast.error(message, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
      throw new Error(message);
    }
  },
};