import axios from 'axios';
import { API_BASE_URL } from './api';

const isValidObjectId = (id: string): boolean => /^[0-9a-fA-F]{24}$/.test(id);

const createErrorMessage = (errorType: string, isRtl: boolean): string => {
  const messages: { [key: string]: { ar: string; en: string } } = {
    invalidBranchId: { ar: 'معرف الفرع غير صالح', en: 'Invalid branch ID' },
    invalidProductId: { ar: 'معرف المنتج غير صالح', en: 'Invalid product ID' },
    invalidUserId: { ar: 'معرف المستخدم غير صالح', en: 'Invalid user ID' },
    invalidOrderId: { ar: 'معرف الطلب غير صالح', en: 'Invalid order ID' },
    invalidReturnId: { ar: 'معرف المرتجع غير صالح', en: 'Invalid return ID' },
    invalidQuantity: { ar: 'الكمية غير صالحة', en: 'Invalid quantity' },
  };
  return isRtl ? messages[errorType].ar : messages[errorType].en;
};

export const inventoryAPI = {
  getInventory: async (params: {
    branch?: string;
    product?: string;
    lowStock?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    if (params.branch && !isValidObjectId(params.branch)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getInventory - Invalid branch ID:`, params.branch);
      throw new Error(createErrorMessage('invalidBranchId', params.lang === 'ar'));
    }
    if (params.product && !isValidObjectId(params.product)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getInventory - Invalid product ID:`, params.product);
      throw new Error(createErrorMessage('invalidProductId', params.lang === 'ar'));
    }
    const response = await axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    }).get('/inventory', { params });
    console.log(`[${new Date().toISOString()}] inventoryAPI.getInventory - Response:`, response.data);
    return {
      inventory: response.data.inventory,
      totalPages: response.data.totalPages,
      currentPage: response.data.currentPage,
    };
  },

  getByBranch: async (branchId: string, params: { page?: number; limit?: number } = {}) => {
    if (!isValidObjectId(branchId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getByBranch - Invalid branch ID:`, branchId);
      throw new Error(createErrorMessage('invalidBranchId', params.lang === 'ar'));
    }
    const response = await axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    }).get(`/inventory/branch/${branchId}`, { params });
    console.log(`[${new Date().toISOString()}] inventoryAPI.getByBranch - Response:`, response.data);
    return {
      inventory: response.data.inventory,
      totalPages: response.data.totalPages,
      currentPage: response.data.currentPage,
    };
  },

  create: async (data: {
    branchId: string;
    productId: string;
    currentStock: number;
    minStockLevel?: number;
    maxStockLevel?: number;
    userId: string;
    orderId?: string;
  }) => {
    if (
      !isValidObjectId(data.branchId) ||
      !isValidObjectId(data.productId) ||
      !isValidObjectId(data.userId) ||
      (data.orderId && !isValidObjectId(data.orderId))
    ) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.create - Invalid data:`, data);
      throw new Error(createErrorMessage('invalidBranchId', data.lang === 'ar'));
    }
    if (data.currentStock < 0) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.create - Invalid stock quantity:`, data.currentStock);
      throw new Error(createErrorMessage('invalidQuantity', data.lang === 'ar'));
    }
    const response = await axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    }).post('/inventory', {
      branchId: data.branchId,
      productId: data.productId,
      currentStock: data.currentStock,
      minStockLevel: data.minStockLevel ?? 0,
      maxStockLevel: data.maxStockLevel ?? 1000,
      userId: data.userId,
      orderId: data.orderId,
    });
    console.log(`[${new Date().toISOString()}] inventoryAPI.create - Response:`, response.data);
    return response.data.inventory;
  },

  bulkCreate: async (data: {
    branchId: string;
    userId: string;
    orderId?: string;
    items: Array<{ productId: string; currentStock: number; minStockLevel?: number; maxStockLevel?: number }>;
  }) => {
    if (
      !isValidObjectId(data.branchId) ||
      !isValidObjectId(data.userId) ||
      (data.orderId && !isValidObjectId(data.orderId)) ||
      !Array.isArray(data.items) ||
      data.items.length === 0 ||
      data.items.some(item => !isValidObjectId(item.productId) || item.currentStock < 0)
    ) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.bulkCreate - Invalid data:`, data);
      throw new Error(createErrorMessage('invalidBranchId', data.lang === 'ar'));
    }
    const response = await axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    }).post('/inventory/bulk', {
      branchId: data.branchId,
      userId: data.userId,
      orderId: data.orderId,
      items: data.items.map(item => ({
        productId: item.productId,
        currentStock: item.currentStock,
        minStockLevel: item.minStockLevel ?? 0,
        maxStockLevel: item.maxStockLevel ?? 1000,
      })),
    });
    console.log(`[${new Date().toISOString()}] inventoryAPI.bulkCreate - Response:`, response.data);
    return response.data.inventories;
  },

  updateStock: async (id: string, data: Partial<{
    currentStock: number;
    minStockLevel: number;
    maxStockLevel: number;
    productId: string;
    branchId: string;
  }>) => {
    if (
      !isValidObjectId(id) ||
      (data.productId && !isValidObjectId(data.productId)) ||
      (data.branchId && !isValidObjectId(data.branchId))
    ) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStock - Invalid inventory ID, product ID, or branch ID:`, { id, data });
      throw new Error(createErrorMessage('invalidBranchId', data.lang === 'ar'));
    }
    if (data.currentStock !== undefined && data.currentStock < 0) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStock - Invalid stock quantity:`, data.currentStock);
      throw new Error(createErrorMessage('invalidQuantity', data.lang === 'ar'));
    }
    const response = await axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    }).put(`/inventory/${id}`, {
      currentStock: data.currentStock,
      minStockLevel: data.minStockLevel,
      maxStockLevel: data.maxStockLevel,
      productId: data.productId,
      branchId: data.branchId,
    });
    console.log(`[${new Date().toISOString()}] inventoryAPI.updateStock - Response:`, response.data);
    return response.data.inventory;
  },

  updateStockLimits: async (id: string, data: { minStockLevel: number; maxStockLevel: number }) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStockLimits - Invalid inventory ID:`, id);
      throw new Error(createErrorMessage('invalidBranchId', data.lang === 'ar'));
    }
    if (data.minStockLevel < 0 || data.maxStockLevel < 0 || data.maxStockLevel <= data.minStockLevel) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStockLimits - Invalid stock limits:`, data);
      throw new Error(createErrorMessage('invalidQuantity', data.lang === 'ar'));
    }
    const response = await axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    }).patch(`/inventory/${id}/limits`, {
      minStockLevel: data.minStockLevel,
      maxStockLevel: data.maxStockLevel,
    });
    console.log(`[${new Date().toISOString()}] inventoryAPI.updateStockLimits - Response:`, response.data);
    return response.data.inventory;
  },

  createReturn: async (data: {
    orderId: string;
    branchId: string;
    reason: string;
    items: Array<{ productId: string; quantity: number; reason: string }>;
    notes?: string;
  }) => {
    if (
      !isValidObjectId(data.orderId) ||
      !isValidObjectId(data.branchId) ||
      !data.reason ||
      !Array.isArray(data.items) ||
      data.items.length === 0 ||
      data.items.some(item => !isValidObjectId(item.productId) || item.quantity < 1 || !item.reason)
    ) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.createReturn - Invalid data:`, data);
      throw new Error(createErrorMessage('invalidReturnId', data.lang === 'ar'));
    }
    const response = await axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    }).post('/inventory/returns', {
      orderId: data.orderId,
      branchId: data.branchId,
      reason: data.reason.trim(),
      items: data.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        reason: item.reason.trim(),
      })),
      notes: data.notes?.trim(),
    });
    console.log(`[${new Date().toISOString()}] inventoryAPI.createReturn - Response:`, response.data);
    return response.data.returnRequest;
  },

  getReturns: async (params: { branchId?: string; status?: string; page?: number; limit?: number } = {}) => {
    if (params.branchId && !isValidObjectId(params.branchId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getReturns - Invalid branch ID:`, params.branchId);
      throw new Error(createErrorMessage('invalidBranchId', params.lang === 'ar'));
    }
    const response = await axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    }).get('/inventory/returns', { params });
    console.log(`[${new Date().toISOString()}] inventoryAPI.getReturns - Response:`, response.data);
    return {
      returns: response.data.returns,
      totalPages: response.data.totalPages,
      currentPage: response.data.currentPage,
    };
  },

  approveReturn: async (returnId: string, data: { status: 'approved' | 'rejected'; reviewNotes?: string }) => {
    if (!isValidObjectId(returnId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.approveReturn - Invalid return ID:`, returnId);
      throw new Error(createErrorMessage('invalidReturnId', data.lang === 'ar'));
    }
    if (!['approved', 'rejected'].includes(data.status)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.approveReturn - Invalid status:`, data.status);
      throw new Error(createErrorMessage('invalidQuantity', data.lang === 'ar'));
    }
    const response = await axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    }).put(`/inventory/returns/${returnId}`, {
      status: data.status,
      reviewNotes: data.reviewNotes?.trim(),
    });
    console.log(`[${new Date().toISOString()}] inventoryAPI.approveReturn - Response:`, response.data);
    return response.data.returnRequest;
  },

  getHistory: async (params: { branchId?: string; productId?: string; page?: number; limit?: number } = {}) => {
    if (params.branchId && !isValidObjectId(params.branchId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getHistory - Invalid branch ID:`, params.branchId);
      throw new Error(createErrorMessage('invalidBranchId', params.lang === 'ar'));
    }
    if (params.productId && !isValidObjectId(params.productId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getHistory - Invalid product ID:`, params.productId);
      throw new Error(createErrorMessage('invalidProductId', params.lang === 'ar'));
    }
    const response = await axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    }).get('/inventory/history', { params });
    console.log(`[${new Date().toISOString()}] inventoryAPI.getHistory - Response:`, response.data);
    return {
      history: response.data.history,
      totalPages: response.data.totalPages,
      currentPage: response.data.currentPage,
    };
  },

  createRestockRequest: async (data: {
    productId: string;
    branchId: string;
    requestedQuantity: number;
    notes?: string;
  }) => {
    if (
      !isValidObjectId(data.productId) ||
      !isValidObjectId(data.branchId) ||
      data.requestedQuantity < 1
    ) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.createRestockRequest - Invalid data:`, data);
      throw new Error(createErrorMessage('invalidProductId', data.lang === 'ar'));
    }
    const response = await axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    }).post('/inventory/restock-requests', {
      productId: data.productId,
      branchId: data.branchId,
      requestedQuantity: data.requestedQuantity,
      notes: data.notes?.trim(),
    });
    console.log(`[${new Date().toISOString()}] inventoryAPI.createRestockRequest - Response:`, response.data);
    return response.data.restockRequest;
  },

  getRestockRequests: async (params: { branchId?: string; page?: number; limit?: number } = {}) => {
    if (params.branchId && !isValidObjectId(params.branchId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getRestockRequests - Invalid branch ID:`, params.branchId);
      throw new Error(createErrorMessage('invalidBranchId', params.lang === 'ar'));
    }
    const response = await axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    }).get('/inventory/restock-requests', { params });
    console.log(`[${new Date().toISOString()}] inventoryAPI.getRestockRequests - Response:`, response.data);
    return {
      restockRequests: response.data.restockRequests,
      totalPages: response.data.totalPages,
      currentPage: response.data.currentPage,
    };
  },

  approveRestockRequest: async (requestId: string, data: { approvedQuantity: number; userId: string }) => {
    if (!isValidObjectId(requestId) || !isValidObjectId(data.userId) || data.approvedQuantity < 1) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.approveRestockRequest - Invalid data:`, { requestId, data });
      throw new Error(createErrorMessage('invalidReturnId', data.lang === 'ar'));
    }
    const response = await axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    }).patch(`/inventory/restock-requests/${requestId}/approve`, {
      approvedQuantity: data.approvedQuantity,
      userId: data.userId,
    });
    console.log(`[${new Date().toISOString()}] inventoryAPI.approveRestockRequest - Response:`, response.data);
    return response.data.restockRequest;
  },
};
