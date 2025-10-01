import api from './api';

interface ReturnItem {
  itemId: string;
  productId: string;
  product: { _id: string; name: string; price: number; unit: string; department: { _id: string; name: string } };
  quantity: number;
  reason: string;
  reasonEn: string;
  displayReason: string;
  status?: string;
  reviewNotes?: string;
}

interface Return {
  id: string;
  returnNumber: string;
  order: { id: string; orderNumber: string; totalAmount: number; adjustedTotal: number; branch: string; branchName: string; displayNotes: string };
  items: ReturnItem[];
  status: 'pending' | 'approved' | 'rejected';
  date: string;
  createdAt: string;
  notes: string;
  reviewNotes: string;
  branch: { _id: string; name: string };
  createdBy: { _id: string; username: string; name: string };
  reviewedBy?: { _id: string; username: string; name: string };
  statusHistory: Array<{ status: string; changedBy: { _id: string; username: string; name: string }; notes: string; displayNotes: string; changedAt: string }>;
}

interface CreateReturnData {
  orderId: string;
  branchId: string;
  reason: string;
  items: Array<{ product: string; quantity: number; reason: string }>;
  notes?: string;
}

interface UpdateReturnData {
  status: 'approved' | 'rejected';
  reviewNotes?: string;
}

export const returnsAPI = {
  getAll: async (query: {
    status?: string;
    branch?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
    isRtl?: boolean;
  } = {}) => {
    console.log(`[${new Date().toISOString()}] returnsAPI.getAll - Sending:`, query);
    try {
      const response = await api.get<{ success: boolean; returns: Return[]; total: number }>('/returns', {
        params: { ...query, isRtl: query.isRtl ?? true },
      });
      console.log(`[${new Date().toISOString()}] returnsAPI.getAll - Response:`, response);
      return response.data;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] returnsAPI.getAll - Error:`, error);
      throw new Error(error.response?.data?.message || 'Error fetching returns');
    }
  },

  getById: async (id: string, isRtl: boolean = true) => {
    console.log(`[${new Date().toISOString()}] returnsAPI.getById - Sending:`, id);
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error(`[${new Date().toISOString()}] returnsAPI.getById - Invalid ID:`, id);
      throw new Error('Invalid return ID');
    }
    try {
      const response = await api.get<{ success: boolean; return: Return }>(`/returns/${id}`, { params: { isRtl } });
      console.log(`[${new Date().toISOString()}] returnsAPI.getById - Response:`, response);
      return response.data;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] returnsAPI.getById - Error:`, error);
      throw new Error(error.response?.data?.message || 'Error fetching return');
    }
  },

  getBranches: async (isRtl: boolean = true) => {
    console.log(`[${new Date().toISOString()}] returnsAPI.getBranches - Sending`);
    try {
      const response = await api.get<{ success: boolean; branches: Array<{ _id: string; name: string; displayName: string }> }>('/branches', {
        params: { isRtl },
      });
      console.log(`[${new Date().toISOString()}] returnsAPI.getBranches - Response:`, response);
      return response.data;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] returnsAPI.getBranches - Error:`, error);
      throw new Error(error.response?.data?.message || 'Error fetching branches');
    }
  },

  createReturn: async (data: CreateReturnData, isRtl: boolean = true) => {
    console.log(`[${new Date().toISOString()}] returnsAPI.createReturn - Sending:`, data);
    if (
      !/^[0-9a-fA-F]{24}$/.test(data.orderId) ||
      !/^[0-9a-fA-F]{24}$/.test(data.branchId) ||
      !data.reason ||
      data.items.some((item) => !/^[0-9a-fA-F]{24}$/.test(item.product) || item.quantity < 1 || !item.reason)
    ) {
      console.error(`[${new Date().toISOString()}] returnsAPI.createReturn - Invalid data:`, data);
      throw new Error(isRtl ? 'بيانات غير صالحة: تحقق من معرف الطلب، معرف الفرع، السبب، أو بيانات العناصر' : 'Invalid data: Check order ID, branch ID, reason, or item data');
    }
    try {
      const response = await api.post<{ success: boolean; return: Return }>('/returns', {
        orderId: data.orderId,
        branchId: data.branchId,
        reason: data.reason.trim(),
        items: data.items.map((item) => ({
          product: item.product,
          quantity: item.quantity,
          reason: item.reason.trim(),
        })),
        notes: data.notes?.trim(),
      }, { params: { isRtl } });
      console.log(`[${new Date().toISOString()}] returnsAPI.createReturn - Response:`, response);
      return response.data;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] returnsAPI.createReturn - Error:`, error);
      throw new Error(error.response?.data?.message || (isRtl ? 'خطأ في إنشاء المرتجع' : 'Error creating return'));
    }
  },

  updateReturnStatus: async (returnId: string, data: UpdateReturnData, isRtl: boolean = true) => {
    console.log(`[${new Date().toISOString()}] returnsAPI.updateReturnStatus - Sending:`, { returnId, data });
    if (!/^[0-9a-fA-F]{24}$/.test(returnId) || !['approved', 'rejected'].includes(data.status)) {
      console.error(`[${new Date().toISOString()}] returnsAPI.updateReturnStatus - Invalid data:`, { returnId, data });
      throw new Error(isRtl ? 'معرف المرتجع أو الحالة غير صالحة' : 'Invalid return ID or status');
    }
    try {
      const response = await api.put<{ success: boolean; return: Return; adjustedTotal: number }>(`/returns/${returnId}`, {
        status: data.status,
        reviewNotes: data.reviewNotes?.trim(),
      }, { params: { isRtl } });
      console.log(`[${new Date().toISOString()}] returnsAPI.updateReturnStatus - Response:`, response);
      return response.data;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] returnsAPI.updateReturnStatus - Error:`, error);
      throw new Error(error.response?.data?.message || (isRtl ? 'خطأ في تحديث حالة المرتجع' : 'Error updating return status'));
    }
  },
};