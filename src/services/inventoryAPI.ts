import axios, { AxiosRequestConfig } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';

const isValidObjectId = (id: string): boolean => /^[0-9a-fA-F]{24}$/.test(id);

const createErrorMessage = (errorType: string, isRtl: boolean): string => {
  const messages: { [key: string]: { ar: string; en: string } } = {
    invalidBranchId: { ar: 'معرف الفرع غير صالح', en: 'Invalid branch ID' },
    invalidProductId: { ar: 'معرف المنتج غير صالح', en: 'Invalid product ID' },
    invalidUserId: { ar: 'معرف المستخدم غير صالح', en: 'Invalid user ID' },
    invalidOrderId: { ar: 'معرف الطلب غير صالح', en: 'Invalid order ID' },
    invalidReturnId: { ar: 'معرف المرتجع غير صالح', en: 'Invalid return ID' },
    invalidRequestId: { ar: 'معرف الطلب غير صالح', en: 'Invalid request ID' },
    invalidQuantity: { ar: 'الكمية غير صالحة', en: 'Invalid quantity' },
    invalidItems: { ar: 'العناصر غير صالحة', en: 'Invalid items' },
    invalidReason: { ar: 'السبب غير صالح', en: 'Invalid reason' },
    invalidStock: { ar: 'كمية المخزون غير صالحة', en: 'Invalid stock quantity' },
  };
  return isRtl ? messages[errorType].ar : messages[errorType].en;
};

export const inventoryAPI = {
  getByBranch: async (
    branchId: string,
    params: { page?: number; limit?: number; search?: string; lowStock?: boolean; lang?: string; signal?: AbortSignal } = {}
  ) => {
    if (!isValidObjectId(branchId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getByBranch - Invalid branch ID:`, branchId);
      throw new Error(createErrorMessage('invalidBranchId', params.lang === 'ar'));
    }
    try {
      const config: AxiosRequestConfig = {
        params: {
          page: params.page ?? 1,
          limit: params.limit ?? 10,
          search: params.search?.trim(),
          lowStock: params.lowStock,
          lang: params.lang,
        },
        signal: params.signal,
      };
      const response = await axios.get(`${API_BASE_URL}/inventory/branch/${branchId}`, config);
      console.log(`[${new Date().toISOString()}] inventoryAPI.getByBranch - Response:`, response.data);
      return {
        inventory: response.data.inventory || [],
        totalPages: response.data.totalPages || 1,
        currentPage: response.data.currentPage || 1,
      };
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getByBranch - Error:`, error.message);
      throw new Error(params.lang === 'ar' ? `فشل في جلب المخزون: ${error.message}` : `Failed to fetch inventory: ${error.message}`);
    }
  },

  create: async (
    data: {
      branchId: string;
      productId: string;
      currentStock: number;
      minStockLevel?: number;
      maxStockLevel?: number;
      userId: string;
      orderId?: string;
    },
    config: AxiosRequestConfig = {}
  ) => {
    if (
      !isValidObjectId(data.branchId) ||
      !isValidObjectId(data.productId) ||
      !isValidObjectId(data.userId) ||
      (data.orderId && !isValidObjectId(data.orderId))
    ) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.create - Invalid data:`, data);
      throw new Error(createErrorMessage('invalidBranchId', config.params?.lang === 'ar') || 
                     createErrorMessage('invalidProductId', config.params?.lang === 'ar') || 
                     createErrorMessage('invalidUserId', config.params?.lang === 'ar') || 
                     createErrorMessage('invalidOrderId', config.params?.lang === 'ar'));
    }
    if (data.currentStock < 0) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.create - Invalid stock quantity:`, data.currentStock);
      throw new Error(createErrorMessage('invalidStock', config.params?.lang === 'ar'));
    }
    try {
      const response = await axios.post(
        `${API_BASE_URL}/inventory`,
        {
          branchId: data.branchId,
          productId: data.productId,
          currentStock: data.currentStock,
          minStockLevel: data.minStockLevel ?? 0,
          maxStockLevel: data.maxStockLevel ?? 1000,
          userId: data.userId,
          orderId: data.orderId,
        },
        config
      );
      console.log(`[${new Date().toISOString()}] inventoryAPI.create - Response:`, response.data);
      return response.data.inventory;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.create - Error:`, error.message);
      throw new Error(config.params?.lang === 'ar' ? `فشل في إنشاء المخزون: ${error.message}` : `Failed to create inventory: ${error.message}`);
    }
  },

  bulkCreate: async (
    data: {
      branchId: string;
      userId: string;
      orderId?: string;
      items: Array<{ productId: string; currentStock: number; minStockLevel?: number; maxStockLevel?: number }>;
    },
    config: AxiosRequestConfig = {}
  ) => {
    if (
      !isValidObjectId(data.branchId) ||
      !isValidObjectId(data.userId) ||
      (data.orderId && !isValidObjectId(data.orderId)) ||
      !Array.isArray(data.items) ||
      data.items.length === 0 ||
      data.items.some(item => !isValidObjectId(item.productId) || item.currentStock < 0)
    ) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.bulkCreate - Invalid data:`, data);
      throw new Error(createErrorMessage('invalidItems', config.params?.lang === 'ar'));
    }
    try {
      const response = await axios.post(
        `${API_BASE_URL}/inventory/bulk`,
        {
          branchId: data.branchId,
          userId: data.userId,
          orderId: data.orderId,
          items: data.items.map(item => ({
            productId: item.productId,
            currentStock: item.currentStock,
            minStockLevel: item.minStockLevel ?? 0,
            maxStockLevel: item.maxStockLevel ?? 1000,
          })),
        },
        config
      );
      console.log(`[${new Date().toISOString()}] inventoryAPI.bulkCreate - Response:`, response.data);
      return response.data.inventories;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.bulkCreate - Error:`, error.message);
      throw new Error(config.params?.lang === 'ar' ? `فشل في إنشاء المخزون الجماعي: ${error.message}` : `Failed to create bulk inventory: ${error.message}`);
    }
  },

  updateStock: async (
    id: string,
    data: Partial<{
      currentStock: number;
      minStockLevel: number;
      maxStockLevel: number;
      productId: string;
      branchId: string;
    }>,
    config: AxiosRequestConfig = {}
  ) => {
    if (
      !isValidObjectId(id) ||
      (data.productId && !isValidObjectId(data.productId)) ||
      (data.branchId && !isValidObjectId(data.branchId))
    ) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStock - Invalid inventory ID, product ID, or branch ID:`, { id, data });
      throw new Error(createErrorMessage('invalidBranchId', config.params?.lang === 'ar') || 
                     createErrorMessage('invalidProductId', config.params?.lang === 'ar'));
    }
    if (data.currentStock !== undefined && data.currentStock < 0) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStock - Invalid stock quantity:`, data.currentStock);
      throw new Error(createErrorMessage('invalidStock', config.params?.lang === 'ar'));
    }
    try {
      const response = await axios.put(
        `${API_BASE_URL}/inventory/${id}`,
        {
          currentStock: data.currentStock,
          minStockLevel: data.minStockLevel,
          maxStockLevel: data.maxStockLevel,
          productId: data.productId,
          branchId: data.branchId,
        },
        config
      );
      console.log(`[${new Date().toISOString()}] inventoryAPI.updateStock - Response:`, response.data);
      return response.data.inventory;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStock - Error:`, error.message);
      throw new Error(config.params?.lang === 'ar' ? `فشل في تحديث المخزون: ${error.message}` : `Failed to update inventory: ${error.message}`);
    }
  },

  updateStockLimits: async (
    id: string,
    data: { minStockLevel: number; maxStockLevel: number },
    config: AxiosRequestConfig = {}
  ) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStockLimits - Invalid inventory ID:`, id);
      throw new Error(createErrorMessage('invalidBranchId', config.params?.lang === 'ar'));
    }
    if (data.minStockLevel < 0 || data.maxStockLevel < 0 || data.maxStockLevel <= data.minStockLevel) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStockLimits - Invalid stock limits:`, data);
      throw new Error(createErrorMessage('invalidStock', config.params?.lang === 'ar'));
    }
    try {
      const response = await axios.put(
        `${API_BASE_URL}/inventory/${id}/stock-limits`,
        {
          minStockLevel: data.minStockLevel,
          maxStockLevel: data.maxStockLevel,
        },
        config
      );
      console.log(`[${new Date().toISOString()}] inventoryAPI.updateStockLimits - Response:`, response.data);
      return response.data.inventory;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStockLimits - Error:`, error.message);
      throw new Error(config.params?.lang === 'ar' ? `فشل في تحديث حدود المخزون: ${error.message}` : `Failed to update stock limits: ${error.message}`);
    }
  },

  processReturnItems: async (
    returnId: string,
    data: {
      branchId: string;
      items: Array<{ productId: string; quantity: number; status: 'approved' | 'rejected'; reviewNotes?: string }>;
    },
    config: AxiosRequestConfig = {}
  ) => {
    if (
      !isValidObjectId(returnId) ||
      !isValidObjectId(data.branchId) ||
      !Array.isArray(data.items) ||
      data.items.length === 0 ||
      data.items.some(item => !isValidObjectId(item.productId) || item.quantity < 1 || !['approved', 'rejected'].includes(item.status))
    ) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.processReturnItems - Invalid data:`, { returnId, data });
      throw new Error(createErrorMessage('invalidReturnId', config.params?.lang === 'ar') || 
                     createErrorMessage('invalidBranchId', config.params?.lang === 'ar') || 
                     createErrorMessage('invalidItems', config.params?.lang === 'ar'));
    }
    try {
      const response = await axios.patch(
        `${API_BASE_URL}/inventory/returns/${returnId}/process`,
        {
          branchId: data.branchId,
          items: data.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            status: item.status,
            reviewNotes: item.reviewNotes?.trim(),
          })),
        },
        config
      );
      console.log(`[${new Date().toISOString()}] inventoryAPI.processReturnItems - Response:`, response.data);
      return response.data.returnRequest;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.processReturnItems - Error:`, error.message);
      throw new Error(config.params?.lang === 'ar' ? `فشل في معالجة المرتجعات: ${error.message}` : `Failed to process return items: ${error.message}`);
    }
  },

  createRestockRequest: async (
    data: {
      productId: string;
      branchId: string;
      requestedQuantity: number;
      notes?: string;
    },
    config: AxiosRequestConfig = {}
  ) => {
    if (
      !isValidObjectId(data.productId) ||
      !isValidObjectId(data.branchId) ||
      data.requestedQuantity < 1
    ) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.createRestockRequest - Invalid data:`, data);
      throw new Error(createErrorMessage('invalidProductId', config.params?.lang === 'ar') || 
                     createErrorMessage('invalidBranchId', config.params?.lang === 'ar') || 
                     createErrorMessage('invalidQuantity', config.params?.lang === 'ar'));
    }
    try {
      const response = await axios.post(
        `${API_BASE_URL}/inventory/restock-requests`,
        {
          productId: data.productId,
          branchId: data.branchId,
          requestedQuantity: data.requestedQuantity,
          notes: data.notes?.trim(),
        },
        config
      );
      console.log(`[${new Date().toISOString()}] inventoryAPI.createRestockRequest - Response:`, response.data);
      return response.data.restockRequest;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.createRestockRequest - Error:`, error.message);
      throw new Error(config.params?.lang === 'ar' ? `فشل في إنشاء طلب إعادة التخزين: ${error.message}` : `Failed to create restock request: ${error.message}`);
    }
  },

  getRestockRequests: async (
    params: { branchId?: string },
    config: AxiosRequestConfig = {}
  ) => {
    if (params.branchId && !isValidObjectId(params.branchId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getRestockRequests - Invalid branch ID:`, params.branchId);
      throw new Error(createErrorMessage('invalidBranchId', config.params?.lang === 'ar'));
    }
    try {
      const response = await axios.get(`${API_BASE_URL}/inventory/restock-requests`, { ...config, params });
      console.log(`[${new Date().toISOString()}] inventoryAPI.getRestockRequests - Response:`, response.data);
      return response.data.restockRequests;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getRestockRequests - Error:`, error.message);
      throw new Error(config.params?.lang === 'ar' ? `فشل في جلب طلبات إعادة التخزين: ${error.message}` : `Failed to fetch restock requests: ${error.message}`);
    }
  },

  approveRestockRequest: async (
    requestId: string,
    data: { approvedQuantity: number; userId: string },
    config: AxiosRequestConfig = {}
  ) => {
    if (!isValidObjectId(requestId) || !isValidObjectId(data.userId) || data.approvedQuantity < 1) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.approveRestockRequest - Invalid data:`, { requestId, data });
      throw new Error(createErrorMessage('invalidRequestId', config.params?.lang === 'ar') || 
                     createErrorMessage('invalidUserId', config.params?.lang === 'ar') || 
                     createErrorMessage('invalidQuantity', config.params?.lang === 'ar'));
    }
    try {
      const response = await axios.patch(
        `${API_BASE_URL}/inventory/restock-requests/${requestId}/approve`,
        {
          approvedQuantity: data.approvedQuantity,
          userId: data.userId,
        },
        config
      );
      console.log(`[${new Date().toISOString()}] inventoryAPI.approveRestockRequest - Response:`, response.data);
      return response.data.restockRequest;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.approveRestockRequest - Error:`, error.message);
      throw new Error(config.params?.lang === 'ar' ? `فشل في الموافقة على طلب إعادة التخزين: ${error.message}` : `Failed to approve restock request: ${error.message}`);
    }
  },

  getHistory: async (
    params: { branchId?: string; productId?: string },
    config: AxiosRequestConfig = {}
  ) => {
    if (params.branchId && !isValidObjectId(params.branchId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getHistory - Invalid branch ID:`, params.branchId);
      throw new Error(createErrorMessage('invalidBranchId', config.params?.lang === 'ar'));
    }
    if (params.productId && !isValidObjectId(params.productId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getHistory - Invalid product ID:`, params.productId);
      throw new Error(createErrorMessage('invalidProductId', config.params?.lang === 'ar'));
    }
    try {
      const response = await axios.get(`${API_BASE_URL}/inventory/history`, { ...config, params });
      console.log(`[${new Date().toISOString()}] inventoryAPI.getHistory - Response:`, response.data);
      return response.data.history;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getHistory - Error:`, error.message);
      throw new Error(config.params?.lang === 'ar' ? `فشل في جلب سجل المخزون: ${error.message}` : `Failed to fetch inventory history: ${error.message}`);
    }
  },

  createReturn: async (
    data: {
      orderId: string;
      branchId: string;
      reason: string;
      items: Array<{ productId: string; quantity: number; reason: string }>;
      notes?: string;
    },
    config: AxiosRequestConfig = {}
  ) => {
    if (
      !isValidObjectId(data.orderId) ||
      !isValidObjectId(data.branchId) ||
      !data.reason ||
      !Array.isArray(data.items) ||
      data.items.length === 0 ||
      data.items.some(item => !isValidObjectId(item.productId) || item.quantity < 1 || !item.reason)
    ) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.createReturn - Invalid data:`, data);
      throw new Error(createErrorMessage('invalidOrderId', config.params?.lang === 'ar') || 
                     createErrorMessage('invalidBranchId', config.params?.lang === 'ar') || 
                     createErrorMessage('invalidReason', config.params?.lang === 'ar') || 
                     createErrorMessage('invalidItems', config.params?.lang === 'ar'));
    }
    try {
      const response = await axios.post(
        `${API_BASE_URL}/inventory/returns`,
        {
          orderId: data.orderId,
          branchId: data.branchId,
          reason: data.reason.trim(),
          items: data.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            reason: item.reason.trim(),
          })),
          notes: data.notes?.trim(),
        },
        config
      );
      console.log(`[${new Date().toISOString()}] inventoryAPI.createReturn - Response:`, response.data);
      return response.data.returnRequest;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.createReturn - Error:`, error.message);
      throw new Error(config.params?.lang === 'ar' ? `فشل في إنشاء المرتجع: ${error.message}` : `Failed to create return: ${error.message}`);
    }
  },
};