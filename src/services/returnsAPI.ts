import api from './api';

export const returnsAPI = {
  getAll: async (query: {
    status?: string;
    branch?: string;
    search?: string;
    sort?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    console.log(`[${new Date().toISOString()}] returnsAPI.getAll - Sending:`, query);
    try {
      const response = await api.get('/returns', { params: query });
      console.log(`[${new Date().toISOString()}] returnsAPI.getAll - Response:`, response);
      return response;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] returnsAPI.getAll - Error:`, error);
      throw error;
    }
  },

  getBranches: async () => {
    console.log(`[${new Date().toISOString()}] returnsAPI.getBranches - Sending`);
    try {
      const response = await api.get('/branches');
      console.log(`[${new Date().toISOString()}] returnsAPI.getBranches - Response:`, response);
      return response;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] returnsAPI.getBranches - Error:`, error);
      throw error;
    }
  },

  createReturn: async (data: {
    orderId: string;
    branchId: string;
    reason: string;
    items: Array<{
      product: string;
      quantity: number;
      reason: string;
    }>;
    notes?: string;
  }) => {
    console.log(`[${new Date().toISOString()}] returnsAPI.createReturn - Sending:`, data);
    if (
      !/^[0-9a-fA-F]{24}$/.test(data.orderId) ||
      !/^[0-9a-fA-F]{24}$/.test(data.branchId) ||
      !data.reason ||
      data.items.some(
        (item) => !/^[0-9a-fA-F]{24}$/.test(item.product) || item.quantity < 1 || !item.reason
      )
    ) {
      console.error(`[${new Date().toISOString()}] returnsAPI.createReturn - Invalid data:`, data);
      throw new Error('Invalid order ID, branch ID, reason, or item data');
    }
    try {
      const response = await api.post('/returns', {
        orderId: data.orderId,
        branchId: data.branchId,
        reason: data.reason.trim(),
        items: data.items.map((item) => ({
          product: item.product,
          quantity: item.quantity,
          reason: item.reason.trim(),
        })),
        notes: data.notes?.trim(),
      });
      console.log(`[${new Date().toISOString()}] returnsAPI.createReturn - Response:`, response);
      return response;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] returnsAPI.createReturn - Error:`, error);
      throw error;
    }
  },

  updateReturnStatus: async (
    returnId: string,
    data: {
      status: 'approved' | 'rejected';
      items: Array<{
        itemId: string;
        productId: string;
        status: 'approved' | 'rejected';
        reviewNotes?: string | null;
      }>;
      reviewNotes?: string;
    }
  ) => {
    console.log(`[${new Date().toISOString()}] returnsAPI.updateReturnStatus - Sending:`, { returnId, data });
    if (
      !/^[0-9a-fA-F]{24}$/.test(returnId) ||
      !['approved', 'rejected'].includes(data.status) ||
      data.items.some(
        (item) =>
          !/^[0-9a-fA-F]{24}$/.test(item.itemId) ||
          !/^[0-9a-fA-F]{24}$/.test(item.productId) ||
          !['approved', 'rejected'].includes(item.status)
      )
    ) {
      console.error(`[${new Date().toISOString()}] returnsAPI.updateReturnStatus - Invalid data:`, { returnId, data });
      throw new Error('Invalid return ID, item ID, product ID, or status');
    }
    if (data.items.some((item) => item.status !== data.status)) {
      console.error(`[${new Date().toISOString()}] returnsAPI.updateReturnStatus - Item statuses do not match overall status:`, { returnId, data });
      throw new Error('Item statuses must match the overall return status');
    }
    const correctedData = {
      status: data.status,
      reviewNotes: data.reviewNotes?.trim(),
      items: data.items.map((item) => ({
        itemId: item.itemId,
        productId: item.productId,
        status: item.status,
        reviewNotes: item.reviewNotes?.trim(),
      })),
    };
    try {
      const response = await api.put(`/returns/${returnId}`, correctedData);
      console.log(`[${new Date().toISOString()}] returnsAPI.updateReturnStatus - Response:`, response);
      return response;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] returnsAPI.updateReturnStatus - Error:`, error);
      if (error.status === 404) {
        throw new Error('الإرجاع غير موجود أو المسار غير صحيح');
      }
      throw error;
    }
  },
};