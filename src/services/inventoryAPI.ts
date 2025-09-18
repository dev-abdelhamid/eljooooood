import axios from 'axios';
import api from './api'; // Import the shared axios instance

export const inventoryAPI = {
  getInventory: async (params: { branch?: string; product?: string; lowStock?: boolean } = {}) => {
    if (params.branch && !/^[0-9a-fA-F]{24}$/.test(params.branch)) {
      console.error(`inventoryAPI.getInventory - Invalid branch ID at ${new Date().toISOString()}:`, params.branch);
      throw new Error('Invalid branch ID');
    }
    if (params.product && !/^[0-9a-fA-F]{24}$/.test(params.product)) {
      console.error(`inventoryAPI.getInventory - Invalid product ID at ${new Date().toISOString()}:`, params.product);
      throw new Error('Invalid product ID');
    }
    console.log(`inventoryAPI.getInventory - Sending at ${new Date().toISOString()}:`, params);
    const response = await api.get('/inventory', { params });
    console.log(`inventoryAPI.getInventory - Response at ${new Date().toISOString()}:`, response);
    return response;
  },

  getByBranch: async (branchId: string) => {
    if (!/^[0-9a-fA-F]{24}$/.test(branchId)) {
      console.error(`inventoryAPI.getByBranch - Invalid branch ID at ${new Date().toISOString()}:`, branchId);
      throw new Error('Invalid branch ID');
    }
    console.log(`inventoryAPI.getByBranch - Sending at ${new Date().toISOString()}:`, { branchId });
    const response = await api.get(`/inventory/branch/${branchId}`);
    console.log(`inventoryAPI.getByBranch - Response at ${new Date().toISOString()}:`, response);
    return response;
  },

  create: async (data: {
    productId: string;
    branchId: string;
    currentStock: number;
    minimumStock: number;
    lastUpdated?: string;
  }) => {
    if (!/^[0-9a-fA-F]{24}$/.test(data.productId) || !/^[0-9a-fA-F]{24}$/.test(data.branchId)) {
      console.error(`inventoryAPI.create - Invalid product ID or branch ID at ${new Date().toISOString()}:`, data);
      throw new Error('Invalid product ID or branch ID');
    }
    if (data.currentStock < 0 || data.minimumStock < 0) {
      console.error(`inventoryAPI.create - Invalid stock values at ${new Date().toISOString()}:`, data);
      throw new Error('Stock values cannot be negative');
    }
    console.log(`inventoryAPI.create - Sending at ${new Date().toISOString()}:`, data);
    const response = await api.post('/inventory', {
      product: data.productId,
      branch: data.branchId,
      currentStock: data.currentStock,
      minimumStock: data.minimumStock,
      lastUpdated: data.lastUpdated || new Date().toISOString(),
    });
    console.log(`inventoryAPI.create - Response at ${new Date().toISOString()}:`, response);
    return response;
  },

  updateStock: async (id: string, data: { currentStock?: number; minStockLevel?: number; maxStockLevel?: number }) => {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error(`inventoryAPI.updateStock - Invalid inventory ID at ${new Date().toISOString()}:`, id);
      throw new Error('Invalid inventory ID');
    }
    if (data.currentStock !== undefined && data.currentStock < 0) {
      console.error(`inventoryAPI.updateStock - Invalid currentStock value at ${new Date().toISOString()}:`, data.currentStock);
      throw new Error('Current stock cannot be negative');
    }
    console.log(`inventoryAPI.updateStock - Sending at ${new Date().toISOString()}:`, { id, data });
    const response = await api.put(`/inventory/${id}`, {
      currentStock: data.currentStock,
      minStockLevel: data.minStockLevel,
      maxStockLevel: data.maxStockLevel,
    });
    console.log(`inventoryAPI.updateStock - Response at ${new Date().toISOString()}:`, response);
    return response;
  },

  logHistory: async (data: {
    branchId: string;
    productId: string;
    quantity: number;
    action: 'add' | 'remove' | 'adjust';
    notes?: string;
  }) => {
    if (!/^[0-9a-fA-F]{24}$/.test(data.branchId) || !/^[0-9a-fA-F]{24}$/.test(data.productId)) {
      console.error(`inventoryAPI.logHistory - Invalid branch ID or product ID at ${new Date().toISOString()}:`, data);
      throw new Error('Invalid branch ID or product ID');
    }
    if (data.quantity < 0) {
      console.error(`inventoryAPI.logHistory - Invalid quantity at ${new Date().toISOString()}:`, data.quantity);
      throw new Error('Quantity cannot be negative');
    }
    console.log(`inventoryAPI.logHistory - Sending at ${new Date().toISOString()}:`, data);
    const response = await api.post('/inventory/history', {
      branch: data.branchId,
      product: data.productId,
      quantity: data.quantity,
      action: data.action,
      notes: data.notes?.trim(),
      timestamp: new Date().toISOString(),
    });
    console.log(`inventoryAPI.logHistory - Response at ${new Date().toISOString()}:`, response);
    return response;
  },

  getHistory: async (params: { branchId?: string; productId?: string } = {}) => {
    if (params.branchId && !/^[0-9a-fA-F]{24}$/.test(params.branchId)) {
      console.error(`inventoryAPI.getHistory - Invalid branch ID at ${new Date().toISOString()}:`, params.branchId);
      throw new Error('Invalid branch ID');
    }
    if (params.productId && !/^[0-9a-fA-F]{24}$/.test(params.productId)) {
      console.error(`inventoryAPI.getHistory - Invalid product ID at ${new Date().toISOString()}:`, params.productId);
      throw new Error('Invalid product ID');
    }
    console.log(`inventoryAPI.getHistory - Sending at ${new Date().toISOString()}:`, params);
    const response = await api.get('/inventory/history', { params });
    console.log(`inventoryAPI.getHistory - Response at ${new Date().toISOString()}:`, response);
    return response;
  },

  processReturnItems: async (
    returnId: string,
    data: {
      branchId: string;
      items: Array<{
        productId: string;
        quantity: number;
        status: 'approved' | 'rejected';
        reviewNotes?: string;
      }>;
    }
  ) => {
    if (!/^[0-9a-fA-F]{24}$/.test(returnId) || !/^[0-9a-fA-F]{24}$/.test(data.branchId)) {
      console.error(`inventoryAPI.processReturnItems - Invalid return ID or branch ID at ${new Date().toISOString()}:`, { returnId, branchId: data.branchId });
      throw new Error('Invalid return ID or branch ID');
    }
    if (data.items.some((item) => !/^[0-9a-fA-F]{24}$/.test(item.productId) || item.quantity < 0)) {
      console.error(`inventoryAPI.processReturnItems - Invalid item data at ${new Date().toISOString()}:`, data.items);
      throw new Error('Invalid product ID or quantity in items');
    }
    console.log(`inventoryAPI.processReturnItems - Sending at ${new Date().toISOString()}:`, { returnId, data });
    const response = await api.patch(`/inventory/returns/${returnId}/process`, {
      branchId: data.branchId,
      items: data.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        status: item.status,
        reviewNotes: item.reviewNotes?.trim(),
      })),
    });
    console.log(`inventoryAPI.processReturnItems - Response at ${new Date().toISOString()}:`, response);
    return response;
  },

  createRestockRequest: async (data: {
    productId: string;
    branchId: string;
    requestedQuantity: number;
    notes?: string;
  }) => {
    if (!/^[0-9a-fA-F]{24}$/.test(data.productId) || !/^[0-9a-fA-F]{24}$/.test(data.branchId)) {
      console.error(`inventoryAPI.createRestockRequest - Invalid product ID or branch ID at ${new Date().toISOString()}:`, data);
      throw new Error('Invalid product ID or branch ID');
    }
    if (data.requestedQuantity <= 0) {
      console.error(`inventoryAPI.createRestockRequest - Invalid requested quantity at ${new Date().toISOString()}:`, data.requestedQuantity);
      throw new Error('Requested quantity must be positive');
    }
    console.log(`inventoryAPI.createRestockRequest - Sending at ${new Date().toISOString()}:`, data);
    const response = await api.post('/inventory/restock-requests', {
      product: data.productId,
      branch: data.branchId,
      requestedQuantity: data.requestedQuantity,
      notes: data.notes?.trim(),
    });
    console.log(`inventoryAPI.createRestockRequest - Response at ${new Date().toISOString()}:`, response);
    return response;
  },

  getRestockRequests: async (params: { branchId?: string } = {}) => {
    if (params.branchId && !/^[0-9a-fA-F]{24}$/.test(params.branchId)) {
      console.error(`inventoryAPI.getRestockRequests - Invalid branch ID at ${new Date().toISOString()}:`, params.branchId);
      throw new Error('Invalid branch ID');
    }
    console.log(`inventoryAPI.getRestockRequests - Sending at ${new Date().toISOString()}:`, params);
    const response = await api.get('/inventory/restock-requests', { params });
    console.log(`inventoryAPI.getRestockRequests - Response at ${new Date().toISOString()}:`, response);
    return response;
  },

  getReturns: async (params: { status?: string; branch?: string; page?: number; limit?: number } = {}) => {
    if (params.branch && !/^[0-9a-fA-F]{24}$/.test(params.branch)) {
      console.error(`inventoryAPI.getReturns - Invalid branch ID at ${new Date().toISOString()}:`, params.branch);
      throw new Error('Invalid branch ID');
    }
    console.log(`inventoryAPI.getReturns - Sending at ${new Date().toISOString()}:`, params);
    const response = await api.get('/returns', { params });
    console.log(`inventoryAPI.getReturns - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
};

export default inventoryAPI;