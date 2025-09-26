import { api, isValidObjectId } from './api'; // استيراد الكائن api ودالة isValidObjectId

const isRtl = localStorage.getItem('language') === 'ar';

export const ordersAPI = {
  create: async (orderData: {
    orderNumber: string;
    branchId: string;
    items: Array<{ productId: string; quantity: number; price: number; department?: { _id: string } }>;
    status: string;
    notes?: string;
    notesEn?: string;
    priority?: string;
    requestedDeliveryDate: string;
  }) => {
    if (!isValidObjectId(orderData.branchId)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.create - Invalid branchId:`, orderData.branchId);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
    }
    const response = await api.post('/orders', {
      orderNumber: orderData.orderNumber.trim(),
      branchId: orderData.branchId,
      items: orderData.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        department: item.department,
      })),
      status: orderData.status.trim(),
      notes: orderData.notes?.trim(),
      notesEn: orderData.notesEn?.trim(),
      priority: orderData.priority?.trim(),
      requestedDeliveryDate: orderData.requestedDeliveryDate,
    });
    console.log(`[${new Date().toISOString()}] ordersAPI.create - Response:`, response);
    return response;
  },

  getAll: async (params: { status?: string; branch?: string; page?: number; limit?: number; department?: string; search?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' } = {}) => {
    if (params.branch && !isValidObjectId(params.branch)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.getAll - Invalid branch ID:`, params.branch);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
    }
    if (params.department && !isValidObjectId(params.department)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.getAll - Invalid department ID:`, params.department);
      throw new Error(isRtl ? 'معرف القسم غير صالح' : 'Invalid department ID');
    }
    const response = await api.get('/orders', { params });
    console.log(`[${new Date().toISOString()}] ordersAPI.getAll - Response:`, response);
    return response;
  },

  getById: async (id: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.getById - Invalid order ID:`, id);
      throw new Error(isRtl ? 'معرف الطلب غير صالح' : 'Invalid order ID');
    }
    const response = await api.get(`/orders/${id}`);
    console.log(`[${new Date().toISOString()}] ordersAPI.getById - Response:`, response);
    return response;
  },

  updateStatus: async (注文Id: string, data: { status: string; notes?: string; notesEn?: string }) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.updateStatus - Invalid order ID:`, id);
      throw new Error(isRtl ? 'معرف الطلب غير صالح' : 'Invalid order ID');
    }
    const response = await api.patch(`/orders/${id}/status`, {
      status: data.status.trim(),
      notes: data.notes?.trim(),
      notesEn: data.notesEn?.trim(),
    });
    console.log(`[${new Date().toISOString()}] ordersAPI.updateStatus - Response:`, response);
    return response;
  },

  updateChefItem: async (orderId: string, data: { taskId: string; status: string }) => {
    if (!isValidObjectId(orderId) || !isValidObjectId(data.taskId)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.updateChefItem - Invalid order ID or task ID:`, { orderId, taskId: data.taskId });
      throw new Error(isRtl ? 'معرف الطلب أو المهمة غير صالح' : 'Invalid order ID or task ID');
    }
    const response = await api.patch(`/orders/${orderId}/tasks/${data.taskId}/status`, {
      status: data.status.trim(),
    });
    console.log(`[${new Date().toISOString()}] ordersAPI.updateChefItem - Response:`, response);
    return response;
  },

  assignChef: async (orderId: string, data: { items: Array<{ itemId: string; assignedTo: string }>; notes?: string; notesEn?: string }) => {
    if (!isValidObjectId(orderId) || data.items.some(item => !isValidObjectId(item.itemId) || !isValidObjectId(item.assignedTo))) {
      console.error(`[${new Date().toISOString()}] ordersAPI.assignChef - Invalid data:`, { orderId, data });
      throw new Error(isRtl ? 'معرف الطلب، العنصر، أو الشيف غير صالح' : 'Invalid order ID, item ID, or chef ID');
    }
    const response = await api.patch(`/orders/${orderId}/assign`, {
      items: data.items,
      notes: data.notes?.trim(),
      notesEn: data.notesEn?.trim(),
      timestamp: new Date().toISOString(),
    });
    console.log(`[${new Date().toISOString()}] ordersAPI.assignChef - Response:`, response);
    return response;
  },

  confirmDelivery: async (orderId: string) => {
    if (!isValidObjectId(orderId)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.confirmDelivery - Invalid order ID:`, orderId);
      throw new Error(isRtl ? 'معرف الطلب غير صالح' : 'Invalid order ID');
    }
    const response = await api.patch(`/orders/${orderId}/confirm-delivery`, {});
    console.log(`[${new Date().toISOString()}] ordersAPI.confirmDelivery - Response:`, response);
    return response;
  },
};
