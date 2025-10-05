import axios, { AxiosError } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

const isValidObjectId = (id: string): boolean => /^[0-9a-fA-F]{24}$/.test(id);

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const language = localStorage.getItem('language') || 'en';
    config.params = { ...config.params, lang: language };
    console.log(`[${new Date().toISOString()}] API request:`, {
      url: config.url,
      method: config.method,
      headers: config.headers,
      params: config.params,
      data: config.data,
    });
    return config;
  },
  (error) => {
    console.error(`[${new Date().toISOString()}] API request error:`, error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response.data,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    console.error(`[${new Date().toISOString()}] API response error:`, {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    const isRtl = localStorage.getItem('language') === 'ar';
    let message = (error.response?.data as any)?.message || (isRtl ? 'خطأ غير متوقع' : 'Unexpected error');
    if (error.response?.status === 400) {
      message = (error.response?.data as any)?.message || (isRtl ? 'بيانات غير صالحة' : 'Invalid data');
      if ((error.response?.data as any)?.field) {
        message = `${message}: ${(error.response?.data as any).field} = ${(error.response?.data as any).value}`;
      }
    }
    if (error.response?.status === 403) {
      message = (error.response?.data as any)?.message || (isRtl ? 'عملية غير مصرح بها' : 'Unauthorized operation');
    }
    if (error.response?.status === 404) {
      message = (error.response?.data as any)?.message || (isRtl ? 'المورد غير موجود' : 'Resource not found');
    }
    if (error.response?.status === 429) {
      message = isRtl ? 'طلبات كثيرة جدًا، حاول مرة أخرى لاحقًا' : 'Too many requests, try again later';
    }
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          console.error(`[${new Date().toISOString()}] No refresh token available`);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          return Promise.reject({ message: isRtl ? 'التوكن منتهي الصلاحية ولا يوجد توكن منعش' : 'Token expired and no refresh token available', status: 401 });
        }
        const response = await axios.post<{ accessToken: string; refreshToken?: string }>(`${API_BASE_URL}/auth/refresh-token`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        localStorage.setItem('token', accessToken);
        if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken);
        console.log(`[${new Date().toISOString()}] Token refreshed successfully`);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error(`[${new Date().toISOString()}] Refresh token failed:`, refreshError);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject({ message: isRtl ? 'فشل تجديد التوكن' : 'Failed to refresh token', status: 401 });
      }
    }
    return Promise.reject({ message, status: error.response?.status });
  }
);

interface InventoryItem {
  _id: string;
  product: {
    _id: string;
    name: string;
    nameEn: string;
    code: string;
    unit: string;
    unitEn: string;
    department: { _id: string; name: string; nameEn: string } | null;
  } | null;
  branch: { _id: string; name: string; nameEn: string };
  currentStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  damagedStock?: number;
}

interface ReturnRequest {
  _id: string;
  returnNumber: string;
  branch: { _id: string; name: string; nameEn: string };
  items: Array<{
    product: { _id: string; name: string; nameEn: string; unit: string; unitEn: string };
    quantity: number;
    reason: string;
    reasonEn: string;
  }>;
  reason: string;
  reasonEn: string;
  status: 'pending_approval' | 'approved' | 'rejected';
}

interface RestockRequest {
  _id: string;
  product: { _id: string; name: string; nameEn: string };
  branch: { _id: string; name: string; nameEn: string };
  requestedQuantity: number;
  status: string;
}

export const inventoryAPI = {
  getInventory: async (params: { branch?: string; product?: string; lowStock?: boolean; page?: number; limit?: number } = {}) => {
    if (params.branch && !isValidObjectId(params.branch)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getInventory - Invalid branch ID:`, params.branch);
      throw new Error('Invalid branch ID');
    }
    if (params.product && !isValidObjectId(params.product)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getInventory - Invalid product ID:`, params.product);
      throw new Error('Invalid product ID');
    }
    const response = await api.get<{ inventory: InventoryItem[]; totalPages: number; currentPage: number }>('/inventory', {
      params: { ...params, page: params.page || 1, limit: params.limit || 10 },
    });
    console.log(`[${new Date().toISOString()}] inventoryAPI.getInventory - Response:`, response);
    return response;
  },

  getByBranch: async (branchId: string, params: { page?: number; limit?: number; search?: string; lowStock?: boolean } = {}) => {
    if (!isValidObjectId(branchId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getByBranch - Invalid branch ID:`, branchId);
      throw new Error('Invalid branch ID');
    }
    const response = await api.get<{ inventory: InventoryItem[]; totalPages: number; currentPage: number }>(`/inventory/branch/${branchId}`, { params });
    console.log(`[${new Date().toISOString()}] inventoryAPI.getByBranch - Response:`, response);
    return response;
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
      throw new Error('Invalid branch ID, product ID, user ID, or order ID');
    }
    if (data.currentStock < 0) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.create - Invalid stock quantity:`, data.currentStock);
      throw new Error('Stock quantity cannot be negative');
    }
    const response = await api.post<{ inventory: InventoryItem }>('/inventory', {
      branchId: data.branchId,
      productId: data.productId,
      currentStock: data.currentStock,
      minStockLevel: data.minStockLevel ?? 0,
      maxStockLevel: data.maxStockLevel ?? 1000,
      userId: data.userId,
      orderId: data.orderId,
    });
    console.log(`[${new Date().toISOString()}] inventoryAPI.create - Response:`, response);
    return response.inventory;
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
      throw new Error('Invalid branch ID, user ID, order ID, or items');
    }
    const response = await api.post<{ inventories: InventoryItem[] }>('/inventory/bulk', {
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
    console.log(`[${new Date().toISOString()}] inventoryAPI.bulkCreate - Response:`, response);
    return response.inventories;
  },

  updateStock: async (id: string, data: Partial<{
    currentStock: number;
    minStockLevel: number;
    maxStockLevel: number;
  }>) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStock - Invalid inventory ID:`, id);
      throw new Error('Invalid inventory ID');
    }
    if (data.currentStock !== undefined && data.currentStock < 0) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStock - Invalid stock quantity:`, data.currentStock);
      throw new Error('Stock quantity cannot be negative');
    }
    if (data.minStockLevel !== undefined && data.minStockLevel < 0) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStock - Invalid min stock level:`, data.minStockLevel);
      throw new Error('Min stock level cannot be negative');
    }
    if (data.maxStockLevel !== undefined && data.maxStockLevel < 0) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStock - Invalid max stock level:`, data.maxStockLevel);
      throw new Error('Max stock level cannot be negative');
    }
    const response = await api.put<{ inventory: InventoryItem }>(`/inventory/${id}`, data);
    console.log(`[${new Date().toISOString()}] inventoryAPI.updateStock - Response:`, response);
    return response.inventory;
  },

  createReturn: async (data: {
    orderId?: string;
    branchId: string;
    reason: string;
    items: Array<{ productId: string; orderId?: string; quantity: number; reason: string; notes?: string }>;
    notes?: string;
    orders?: string[];
  }) => {
    if (
      !isValidObjectId(data.branchId) ||
      (data.orderId && !isValidObjectId(data.orderId)) ||
      !data.reason ||
      !['تالف', 'منتج خاطئ', 'كمية زائدة', 'أخرى'].includes(data.reason) ||
      !Array.isArray(data.items) ||
      data.items.length === 0 ||
      data.items.some(item => 
        !isValidObjectId(item.productId) || 
        (item.orderId && !isValidObjectId(item.orderId)) || 
        item.quantity < 1 || 
        !['تالف', 'منتج خاطئ', 'كمية زائدة', 'أخرى'].includes(item.reason)
      ) ||
      (data.orders && data.orders.some(id => !isValidObjectId(id)))
    ) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.createReturn - Invalid data:`, data);
      throw new Error('Invalid order ID, branch ID, reason, items, or orders');
    }
    const response = await api.post<{ returnRequest: ReturnRequest }>('/returns', {
      orderId: data.orderId,
      branchId: data.branchId,
      reason: data.reason.trim(),
      items: data.items.map(item => ({
        product: item.productId,
        order: item.orderId,
        quantity: item.quantity,
        reason: item.reason.trim(),
        notes: item.notes?.trim(),
      })),
      notes: data.notes?.trim(),
      orders: data.orders,
    });
    console.log(`[${new Date().toISOString()}] inventoryAPI.createReturn - Response:`, response);
    return response.returnRequest;
  },

  getReturnableOrdersForProduct: async (productId: string, branchId: string) => {
    if (!isValidObjectId(productId) || !isValidObjectId(branchId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getReturnableOrdersForProduct - Invalid product ID or branch ID:`, { productId, branchId });
      throw new Error('Invalid product ID or branch ID');
    }
    const response = await api.get<{ orders: Array<{ orderId: string; orderNumber: string; remainingQuantity: number }> }>(
      `/inventory/returnable-orders/${productId}/branch/${branchId}`
    );
    console.log(`[${new Date().toISOString()}] inventoryAPI.getReturnableOrdersForProduct - Response:`, response);
    return response.orders;
  },

  getHistory: async (params: { branchId?: string; productId?: string; page?: number; limit?: number } = {}) => {
    if (params.branchId && !isValidObjectId(params.branchId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getHistory - Invalid branch ID:`, params.branchId);
      throw new Error('Invalid branch ID');
    }
    if (params.productId && !isValidObjectId(params.productId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getHistory - Invalid product ID:`, params.productId);
      throw new Error('Invalid product ID');
    }
    const response = await api.get<{ history: Array<{
      _id: string;
      product: { _id: string; name: string; nameEn: string; unit: string; unitEn: string };
      branch: { _id: string; name: string; nameEn: string };
      action: string;
      quantity: number;
      reference: string;
      createdBy: { _id: string; name: string; nameEn: string };
      createdAt: string;
    }>; totalPages: number; currentPage: number }>('/inventory/history', { params });
    console.log(`[${new Date().toISOString()}] inventoryAPI.getHistory - Response:`, response);
    return response;
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
      throw new Error('Invalid product ID, branch ID, or requested quantity');
    }
    const response = await api.post<{ restockRequest: RestockRequest }>('/inventory/restock-requests', {
      productId: data.productId,
      branchId: data.branchId,
      requestedQuantity: data.requestedQuantity,
      notes: data.notes?.trim(),
    });
    console.log(`[${new Date().toISOString()}] inventoryAPI.createRestockRequest - Response:`, response);
    return response.restockRequest;
  },

  getRestockRequests: async (params: { branchId?: string; page?: number; limit?: number } = {}) => {
    if (params.branchId && !isValidObjectId(params.branchId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getRestockRequests - Invalid branch ID:`, params.branchId);
      throw new Error('Invalid branch ID');
    }
    const response = await api.get<{ restockRequests: RestockRequest[] }>('/inventory/restock-requests', { params });
    console.log(`[${new Date().toISOString()}] inventoryAPI.getRestockRequests - Response:`, response);
    return response.restockRequests;
  },

  approveRestockRequest: async (requestId: string, data: { approvedQuantity: number; userId: string }) => {
    if (!isValidObjectId(requestId) || !isValidObjectId(data.userId) || data.approvedQuantity < 1) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.approveRestockRequest - Invalid data:`, { requestId, data });
      throw new Error('Invalid request ID, user ID, or approved quantity');
    }
    const response = await api.patch<{ restockRequest: RestockRequest }>(`/inventory/restock-requests/${requestId}/approve`, {
      approvedQuantity: data.approvedQuantity,
      userId: data.userId,
    });
    console.log(`[${new Date().toISOString()}] inventoryAPI.approveRestockRequest - Response:`, response);
    return response.restockRequest;
  },

  getProductDetails: async (productId: string, branchId: string, params: { page?: number; limit?: number } = {}) => {
    if (!isValidObjectId(productId) || !isValidObjectId(branchId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getProductDetails - Invalid product ID or branch ID:`, { productId, branchId });
      throw new Error('Invalid product ID or branch ID');
    }
    const response = await api.get<{
      product: { _id: string; name: string; nameEn: string; unit: string; unitEn: string; department: { _id: string; name: string; nameEn: string } };
      inventory: InventoryItem;
      movements: Array<{
        _id: string;
        product: { _id: string; name: string; nameEn: string };
        branch: { _id: string; name: string; nameEn: string };
        action: string;
        quantity: number;
        reference: string;
        createdAt: string;
      }>;
      transfers: Array<{
        _id: string;
        product: { _id: string; name: string; nameEn: string };
        fromBranchName: string;
        toBranchName: string;
        quantity: number;
        type: 'transfer_in' | 'transfer_out';
        createdAt: string;
      }>;
      returns: Array<{
        _id: string;
        branchName: string;
        items: Array<{ productName: string; quantity: number; unit: string }>;
      }>;
      statistics: {
        totalRestocks: number;
        totalAdjustments: number;
        totalReturns: number;
        totalTransfersIn: number;
        totalTransfersOut: number;
        averageStockLevel: number;
        lowStockStatus: boolean;
      };
      totalPages: number;
      currentPage: number;
    }>(`/inventory/product/${productId}/branch/${branchId}`, { params });
    console.log(`[${new Date().toISOString()}] inventoryAPI.getProductDetails - Response:`, response);
    return response;
  },
};
export default inventoryAPI;