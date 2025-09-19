import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';

const isValidObjectId = (id: string): boolean => /^[0-9a-fA-F]{24}$/.test(id);

export const ordersAPI = {
  create: async (orderData: {
    orderNumber: string;
    branchId: string;
    items: Array<{ productId: string; quantity: number; price: number; department?: { _id: string } }>;
    status?: string;
    notes?: string;
    priority?: string;
    requestedDeliveryDate?: string;
  }) => {
    console.log(`[${new Date().toISOString()}] ordersAPI.create - Sending:`, orderData);
    if (!isValidObjectId(orderData.branchId)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.create - معرف الفرع غير صالح:`, orderData.branchId);
      throw new Error('معرف الفرع غير صالح');
    }
    if (!orderData.orderNumber || !orderData.items?.length) {
      console.error(`[${new Date().toISOString()}] ordersAPI.create - رقم الطلب أو العناصر مفقودة:`, orderData);
      throw new Error('رقم الطلب ومصفوفة العناصر مطلوبة');
    }
    if (orderData.items.some(item => !isValidObjectId(item.productId) || item.quantity < 1)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.create - بيانات العناصر غير صالحة:`, orderData.items);
      throw new Error('معرف المنتج أو الكمية غير صالحة');
    }
    try {
      const response = await axios.post(`${API_BASE_URL}/orders`, {
        ...orderData,
        items: orderData.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      console.log(`[${new Date().toISOString()}] ordersAPI.create - Response:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] ordersAPI.create - Error:`, error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'خطأ في إنشاء الطلب');
    }
  },

  getAll: async (params: { status?: string; branch?: string; page?: number; limit?: number; department?: string; search?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' } = {}) => {
    console.log(`[${new Date().toISOString()}] ordersAPI.getAll - Sending:`, params);
    if (params.branch && !isValidObjectId(params.branch)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.getAll - معرف الفرع غير صالح:`, params.branch);
      throw new Error('معرف الفرع غير صالح');
    }
    try {
      const response = await axios.get(`${API_BASE_URL}/orders`, {
        params,
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      console.log(`[${new Date().toISOString()}] ordersAPI.getAll - Response:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] ordersAPI.getAll - Error:`, error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'خطأ في استرجاع الطلبات');
    }
  },

  getById: async (id: string) => {
    console.log(`[${new Date().toISOString()}] ordersAPI.getById - Sending:`, { id });
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.getById - معرف الطلب غير صالح:`, id);
      throw new Error('معرف الطلب غير صالح');
    }
    try {
      const response = await axios.get(`${API_BASE_URL}/orders/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      console.log(`[${new Date().toISOString()}] ordersAPI.getById - Response:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] ordersAPI.getById - Error:`, error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'خطأ في استرجاع الطلب');
    }
  },

  updateStatus: async (id: string, data: { status: string; notes?: string }) => {
    console.log(`[${new Date().toISOString()}] ordersAPI.updateStatus - Sending:`, { id, data });
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.updateStatus - معرف الطلب غير صالح:`, id);
      throw new Error('معرف الطلب غير صالح');
    }
    if (!data.status) {
      console.error(`[${new Date().toISOString()}] ordersAPI.updateStatus - الحالة مطلوبة:`, data);
      throw new Error('الحالة مطلوبة');
    }
    try {
      const response = await axios.patch(`${API_BASE_URL}/orders/${id}/status`, data, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      console.log(`[${new Date().toISOString()}] ordersAPI.updateStatus - Response:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] ordersAPI.updateStatus - Error:`, error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'خطأ في تحديث حالة الطلب');
    }
  },

  updateChefItem: async (orderId: string, data: { taskId: string; status: string }) => {
    console.log(`[${new Date().toISOString()}] ordersAPI.updateChefItem - Sending:`, { orderId, data });
    if (!isValidObjectId(orderId) || !isValidObjectId(data.taskId)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.updateChefItem - معرف الطلب أو المهمة غير صالح:`, { orderId, taskId: data.taskId });
      throw new Error('معرف الطلب أو المهمة غير صالح');
    }
    try {
      const response = await axios.patch(`${API_BASE_URL}/orders/${orderId}/tasks/${data.taskId}/status`, { status: data.status }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      console.log(`[${new Date().toISOString()}] ordersAPI.updateChefItem - Response:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] ordersAPI.updateChefItem - Error:`, error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'خطأ في تحديث حالة المهمة');
    }
  },

  assignChef: async (orderId: string, data: { items: Array<{ itemId: string; assignedTo: string }> }) => {
    console.log(`[${new Date().toISOString()}] ordersAPI.assignChef - Sending:`, { orderId, data });
    if (!isValidObjectId(orderId) || data.items.some(item => !isValidObjectId(item.itemId) || !isValidObjectId(item.assignedTo))) {
      console.error(`[${new Date().toISOString()}] ordersAPI.assignChef - بيانات غير صالحة:`, { orderId, data });
      throw new Error('معرف الطلب أو معرف العنصر أو معرف الشيف غير صالح');
    }
    try {
      const response = await axios.patch(`${API_BASE_URL}/orders/${orderId}/assign`, {
        items: data.items,
        timestamp: new Date().toISOString(),
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      console.log(`[${new Date().toISOString()}] ordersAPI.assignChef - Response:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] ordersAPI.assignChef - Error:`, error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'خطأ في تعيين الشيف');
    }
  },

  confirmDelivery: async (orderId: string) => {
    console.log(`[${new Date().toISOString()}] ordersAPI.confirmDelivery - Sending:`, { orderId });
    if (!isValidObjectId(orderId)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.confirmDelivery - معرف الطلب غير صالح:`, orderId);
      throw new Error('معرف الطلب غير صالح');
    }
    try {
      const response = await axios.patch(`${API_BASE_URL}/orders/${orderId}/confirm-delivery`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      console.log(`[${new Date().toISOString()}] ordersAPI.confirmDelivery - Response:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] ordersAPI.confirmDelivery - Error:`, error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'خطأ في تأكيد التوصيل');
    }
  },
};