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
      console.error(`[${new Date().toISOString()}] inventoryAPI.getByBranch - Error:`, error.message, error.response?.data);
      throw new Error(params.lang === 'ar' ? `فشل في جلب المخزون: ${error.response?.data?.message || error.message}` : `Failed to fetch inventory: ${error.response?.data?.message || error.message}`);
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
      throw new Error(
        createErrorMessage('invalidBranchId', config.params?.lang === 'ar') ||
        createErrorMessage('invalidProductId', config.params?.lang === 'ar') ||
        createErrorMessage('invalidUserId', config.params?.lang === 'ar') ||
        createErrorMessage('invalidOrderId', config.params?.lang === 'ar')
      );
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
      console.error(`[${new Date().toISOString()}] inventoryAPI.create - Error:`, error.message, error.response?.data);
      throw new Error(config.params?.lang === 'ar' ? `فشل في إنشاء المخزون: ${error.response?.data?.message || error.message}` : `Failed to create inventory: ${error.response?.data?.message || error.message}`);
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
      console.error(`[${new Date().toISOString()}] inventoryAPI.bulkCreate - Error:`, error.message, error.response?.data);
      throw new Error(config.params?.lang === 'ar' ? `فشل في إنشاء المخزون الجماعي: ${error.response?.data?.message || error.message}` : `Failed to create bulk inventory: ${error.response?.data?.message || error.message}`);
    }
  },

  updateStock: async (
    id: string,
    data: Partial<{
      currentStock: number;
      minStockLevel: number;
      maxStockLevel: number;
    }>,
    config: AxiosRequestConfig = {}
  ) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStock - Invalid inventory ID:`, id);
      throw new Error(createErrorMessage('invalidBranchId', config.params?.lang === 'ar'));
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
        },
        config
      );
      console.log(`[${new Date().toISOString()}] inventoryAPI.updateStock - Response:`, response.data);
      return response.data.inventory;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStock - Error:`, error.message, error.response?.data);
      throw new Error(config.params?.lang === 'ar' ? `فشل في تحديث المخزون: ${error.response?.data?.message || error.message}` : `Failed to update inventory: ${error.response?.data?.message || error.message}`);
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
      const response = await axios.patch(
        `${API_BASE_URL}/inventory/${id}/limits`,
        {
          minStockLevel: data.minStockLevel,
          maxStockLevel: data.maxStockLevel,
        },
        config
      );
      console.log(`[${new Date().toISOString()}] inventoryAPI.updateStockLimits - Response:`, response.data);
      return response.data.inventory;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStockLimits - Error:`, error.message, error.response?.data);
      throw new Error(config.params?.lang === 'ar' ? `فشل في تحديث حدود المخزون: ${error.response?.data?.message || error.message}` : `Failed to update stock limits: ${error.response?.data?.message || error.message}`);
    }
  },

  createReturn: async (
    data: {
      orderId?: string;
      branchId: string;
      reason: string;
      items: Array<{ productId: string; quantity: number; reason: string }>;
      notes?: string;
    },
    config: AxiosRequestConfig = {}
  ) => {
    if (
      !isValidObjectId(data.branchId) ||
      !data.reason ||
      !Array.isArray(data.items) ||
      data.items.length === 0 ||
      data.items.some(item => !isValidObjectId(item.productId) || item.quantity < 1 || !item.reason) ||
      (data.orderId && !isValidObjectId(data.orderId))
    ) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.createReturn - Invalid data:`, data);
      throw new Error(
        createErrorMessage('invalidOrderId', config.params?.lang === 'ar') ||
        createErrorMessage('invalidBranchId', config.params?.lang === 'ar') ||
        createErrorMessage('invalidReason', config.params?.lang === 'ar') ||
        createErrorMessage('invalidItems', config.params?.lang === 'ar')
      );
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
      console.error(`[${new Date().toISOString()}] inventoryAPI.createReturn - Error:`, error.message, error.response?.data);
      throw new Error(config.params?.lang === 'ar' ? `فشل في إنشاء المرتجع: ${error.response?.data?.message || error.message}` : `Failed to create return: ${error.response?.data?.message || error.message}`);
    }
  },

  getReturns: async (
    params: { branchId?: string; status?: 'pending_approval' | 'approved' | 'rejected'; page?: number; limit?: number; lang?: string },
    config: AxiosRequestConfig = {}
  ) => {
    if (params.branchId && !isValidObjectId(params.branchId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getReturns - Invalid branch ID:`, params.branchId);
      throw new Error(createErrorMessage('invalidBranchId', params.lang === 'ar'));
    }
    try {
      const response = await axios.get(`${API_BASE_URL}/inventory/returns`, {
        ...config,
        params: {
          branchId: params.branchId,
          status: params.status,
          page: params.page ?? 1,
          limit: params.limit ?? 10,
          lang: params.lang,
        },
      });
      console.log(`[${new Date().toISOString()}] inventoryAPI.getReturns - Response:`, response.data);
      return {
        returns: response.data.returns || [],
        totalPages: response.data.totalPages || 1,
        currentPage: response.data.currentPage || 1,
      };
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getReturns - Error:`, error.message, error.response?.data);
      throw new Error(params.lang === 'ar' ? `فشل في جلب المرتجعات: ${error.response?.data?.message || error.message}` : `Failed to fetch returns: ${error.response?.data?.message || error.message}`);
    }
  },

  approveReturn: async (
    returnId: string,
    data: { status: 'approved' | 'rejected'; reviewNotes?: string },
    config: AxiosRequestConfig = {}
  ) => {
    if (!isValidObjectId(returnId) || !['approved', 'rejected'].includes(data.status)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.approveReturn - Invalid data:`, { returnId, data });
      throw new Error(createErrorMessage('invalidReturnId', config.params?.lang === 'ar') || createErrorMessage('invalidReason', config.params?.lang === 'ar'));
    }
    try {
      const response = await axios.put(
        `${API_BASE_URL}/inventory/returns/${returnId}`,
        {
          status: data.status,
          reviewNotes: data.reviewNotes?.trim(),
        },
        config
      );
      console.log(`[${new Date().toISOString()}] inventoryAPI.approveReturn - Response:`, response.data);
      return response.data.returnRequest;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.approveReturn - Error:`, error.message, error.response?.data);
      throw new Error(config.params?.lang === 'ar' ? `فشل في معالجة المرتجع: ${error.response?.data?.message || error.message}` : `Failed to process return: ${error.response?.data?.message || error.message}`);
    }
  },

  getProductDetails: async (
    productId: string,
    branchId: string,
    params: { page?: number; limit?: number; lang?: string; signal?: AbortSignal } = {}
  ) => {
    if (!isValidObjectId(productId) || !isValidObjectId(branchId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getProductDetails - Invalid IDs:`, { productId, branchId });
      throw new Error(createErrorMessage('invalidProductId', params.lang === 'ar') || createErrorMessage('invalidBranchId', params.lang === 'ar'));
    }
    try {
      const config: AxiosRequestConfig = {
        params: {
          page: params.page ?? 1,
          limit: params.limit ?? 10,
          lang: params.lang,
        },
        signal: params.signal,
      };
      const response = await axios.get(`${API_BASE_URL}/inventory/product/${productId}/branch/${branchId}`, config);
      console.log(`[${new Date().toISOString()}] inventoryAPI.getProductDetails - Response:`, response.data);
      return {
        product: response.data.product,
        inventory: response.data.inventory,
        movements: response.data.movements || [],
        transfers: response.data.transfers || [],
        statistics: response.data.statistics || {},
        totalPages: response.data.totalPages || 1,
        currentPage: response.data.currentPage || 1,
      };
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getProductDetails - Error:`, error.message, error.response?.data);
      throw new Error(params.lang === 'ar' ? `فشل في جلب تفاصيل المنتج: ${error.response?.data?.message || error.message}` : `Failed to fetch product details: ${error.response?.data?.message || error.message}`);
    }
  },

  getHistory: async (
    params: { branchId?: string; productId?: string; page?: number; limit?: number; lang?: string },
    config: AxiosRequestConfig = {}
  ) => {
    if (params.branchId && !isValidObjectId(params.branchId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getHistory - Invalid branch ID:`, params.branchId);
      throw new Error(createErrorMessage('invalidBranchId', params.lang === 'ar'));
    }
    if (params.productId && !isValidObjectId(params.productId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getHistory - Invalid product ID:`, params.productId);
      throw new Error(createErrorMessage('invalidProductId', params.lang === 'ar'));
    }
    try {
      const response = await axios.get(`${API_BASE_URL}/inventory/history`, {
        ...config,
        params: {
          branchId: params.branchId,
          productId: params.productId,
          page: params.page ?? 1,
          limit: params.limit ?? 10,
          lang: params.lang,
        },
      });
      console.log(`[${new Date().toISOString()}] inventoryAPI.getHistory - Response:`, response.data);
      return {
        history: response.data.history || [],
        totalPages: response.data.totalPages || 1,
        currentPage: response.data.currentPage || 1,
      };
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getHistory - Error:`, error.message, error.response?.data);
      throw new Error(params.lang === 'ar' ? `فشل في جلب سجل المخزون: ${error.response?.data?.message || error.message}` : `Failed to fetch inventory history: ${error.response?.data?.message || error.message}`);
    }
  },
};