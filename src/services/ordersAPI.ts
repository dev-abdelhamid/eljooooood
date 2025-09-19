import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';

export const ordersAPI = {
  create: async (orderData: {
    orderNumber: string;
    branchId: string;
    items: Array<{ productId: string; quantity: number; price: number; department?: { _id: string } }>;
    status: string;
    notes?: string;
    priority?: string;
    requestedDeliveryDate: string;
  }) => {
    console.log(`ordersAPI.create - Sending at ${new Date().toISOString()}:`, orderData);
    if (!orderData.branchId || !/^[0-9a-fA-F]{24}$/.test(orderData.branchId)) {
      console.error(`ordersAPI.create - Invalid branchId at ${new Date().toISOString()}:`, orderData.branchId);
      throw new Error('Invalid branch ID');
    }
    const response = await axios.post(`${API_BASE_URL}/orders`, orderData, {
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
    });
    console.log(`ordersAPI.create - Response at ${new Date().toISOString()}:`, response.data);
    return response.data;
  },

  getAll: async (params: { status?: string; branch?: string; page?: number; limit?: number; department?: string; search?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' } = {}) => {
    const response = await axios.get(`${API_BASE_URL}/orders`, { 
      params,
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    console.log(`ordersAPI.getAll - Response at ${new Date().toISOString()}:`, response.data);
    return response.data;
  },

  getById: async (id: string) => {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error(`ordersAPI.getById - Invalid order ID at ${new Date().toISOString()}:`, id);
      throw new Error('Invalid order ID');
    }
    const response = await axios.get(`${API_BASE_URL}/orders/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    console.log(`ordersAPI.getById - Response at ${new Date().toISOString()}:`, response.data);
    return response.data;
  },

  updateStatus: async (id: string, data: { status: string; notes?: string }) => {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error(`ordersAPI.updateStatus - Invalid order ID at ${new Date().toISOString()}:`, id);
      throw new Error('Invalid order ID');
    }
    const response = await axios.patch(`${API_BASE_URL}/orders/${id}/status`, data, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    console.log(`ordersAPI.updateStatus - Response at ${new Date().toISOString()}:`, response.data);
    return response.data;
  },

  updateChefItem: async (orderId: string, data: { taskId: string; status: string }) => {
    if (!/^[0-9a-fA-F]{24}$/.test(orderId) || !/^[0-9a-fA-F]{24}$/.test(data.taskId)) {
      console.error(`ordersAPI.updateChefItem - Invalid order ID or task ID at ${new Date().toISOString()}:`, { orderId, taskId: data.taskId });
      throw new Error('Invalid order ID or task ID');
    }
    const response = await axios.patch(`${API_BASE_URL}/orders/${orderId}/tasks/${data.taskId}/status`, { status: data.status }, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    console.log(`ordersAPI.updateChefItem - Response at ${new Date().toISOString()}:`, response.data);
    return response.data;
  },

  assignChef: async (orderId: string, data: { items: Array<{ itemId: string; assignedTo: string }> }) => {
    console.log(`[${new Date().toISOString()}] ordersAPI.assignChef - Sending:`, { orderId, data });
    if (!/^[0-9a-fA-F]{24}$/.test(orderId) || data.items.some(item => !/^[0-9a-fA-F]{24}$/.test(item.itemId) || !/^[0-9a-fA-F]{24}$/.test(item.assignedTo))) {
      console.error(`[${new Date().toISOString()}] ordersAPI.assignChef - بيانات غير صالحة:`, { orderId, data });
      throw new Error('معرف الطلب أو معرف العنصر أو معرف الشيف غير صالح');
    }
    const response = await axios.patch(`${API_BASE_URL}/orders/${orderId}/assign`, {
      items: data.items,
      timestamp: new Date().toISOString(),
    }, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    console.log(`[${new Date().toISOString()}] ordersAPI.assignChef - Response:`, response.data);
    return response.data;
  },

  confirmDelivery: async (orderId: string) => {
    if (!/^[0-9a-fA-F]{24}$/.test(orderId)) {
      console.error(`ordersAPI.confirmDelivery - Invalid order ID at ${new Date().toISOString()}:`, orderId);
      throw new Error('Invalid order ID');
    }
    console.log(`ordersAPI.confirmDelivery - Sending at ${new Date().toISOString()}:`, { orderId });
    const response = await axios.patch(`${API_BASE_URL}/orders/${orderId}/confirm-delivery`, {}, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    console.log(`ordersAPI.confirmDelivery - Response at ${new Date().toISOString()}:`, response.data);
    return response.data;
  },
};