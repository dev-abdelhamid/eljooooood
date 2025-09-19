import axios from 'axios';
import { ordersAPI } from './ordersAPI';
import { notificationsAPI } from './notifications';
import { returnsAPI } from './returnsAPI';
import { salesAPI } from './salesAPI';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(`[${new Date().toISOString()}] API request:`, {
      url: config.url,
      method: config.method,
      headers: config.headers,
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
  async (error) => {
    const originalRequest = error.config;
    console.error(`[${new Date().toISOString()}] API response error:`, {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    let message = error.response?.data?.message || 'خطأ غير متوقع';
    if (error.response?.status === 400) message = error.response?.data?.message || 'بيانات غير صالحة';
    if (error.response?.status === 403) message = error.response?.data?.message || 'عملية غير مصرح بها';
    if (error.response?.status === 404) message = error.response?.data?.message || 'المورد غير موجود';
    if (error.response?.status === 429) message = 'طلبات كثيرة جدًا، حاول مرة أخرى لاحقًا';
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          console.error(`[${new Date().toISOString()}] No refresh token available`);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          return Promise.reject({ message: 'التوكن منتهي الصلاحية ولا يوجد توكن منعش', status: 401 });
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
        return Promise.reject({ message: 'فشل تجديد التوكن', status: 401 });
      }
    }
    return Promise.reject({ message, status: error.response?.status });
  }
);

export const authAPI = {
  login: async (credentials: { username: string; password: string }) => {
    const response = await api.post('/auth/login', {
      username: credentials.username.trim(),
      password: credentials.password,
    });
    console.log(`[${new Date().toISOString()}] Login response:`, response);
    return response;
  },
  refreshToken: async (refreshToken: string) => {
    const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken });
    console.log(`[${new Date().toISOString()}] Refresh token response:`, response.data);
    return response.data;
  },
  getProfile: async () => {
    const response = await api.get('/auth/profile');
    console.log(`[${new Date().toISOString()}] Profile response:`, response);
    return {
      ...response,
      user: {
        ...response.user,
        _id: response.user.id || response.user._id,
      },
    };
  },
  updateProfile: async (data: { name?: string; password?: string }) => {
    const response = await api.put('/auth/profile', {
      name: data.name?.trim(),
      password: data.password,
    });
    console.log(`[${new Date().toISOString()}] Update profile response:`, response);
    return response;
  },
  checkEmail: async (email: string) => {
    const response = await api.post('/auth/check-email', { email: email.trim() });
    console.log(`[${new Date().toISOString()}] Check email response:`, response);
    return response;
  },
};

export const branchesAPI = {
  getAll: async () => {
    const response = await api.get('/branches');
    console.log(`[${new Date().toISOString()}] Branches getAll response:`, response);
    return response;
  },
  getById: async (id: string) => {
    const response = await api.get(`/branches/${id}`);
    console.log(`[${new Date().toISOString()}] Branches getById response:`, response);
    return response;
  },
  create: async (branchData: {
    name: string;
    code: string;
    address: string;
    city: string;
    phone?: string;
    username: string;
    password: string;
    email?: string;
  }) => {
    const response = await api.post('/branches', {
      name: branchData.name.trim(),
      code: branchData.code.trim(),
      address: branchData.address.trim(),
      city: branchData.city.trim(),
      phone: branchData.phone?.trim(),
      username: branchData.username.trim(),
      password: branchData.password,
      email: branchData.email?.trim(),
    });
    console.log(`[${new Date().toISOString()}] Branches create response:`, response);
    return response;
  },
  update: async (id: string, branchData: {
    name: string;
    code: string;
    address: string;
    city: string;
    phone?: string;
  }) => {
    const response = await api.put(`/branches/${id}`, {
      name: branchData.name.trim(),
      code: branchData.code.trim(),
      address: branchData.address.trim(),
      city: branchData.city.trim(),
      phone: branchData.phone?.trim(),
    });
    console.log(`[${new Date().toISOString()}] Branches update response:`, response);
    return response;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/branches/${id}`);
    console.log(`[${new Date().toISOString()}] Branches delete response:`, response);
    return response;
  },
  checkEmail: async (email: string) => {
    const response = await api.post('/branches/check-email', { email: email.trim() });
    console.log(`[${new Date().toISOString()}] Branches checkEmail response:`, response);
    return response;
  },
};

export const productsAPI = {
  getAll: async (params: { department?: string; search?: string; page?: number; limit?: number } = {}) => {
    const response = await api.get('/products', { params });
    console.log(`[${new Date().toISOString()}] productsAPI.getAll - Response:`, response);
    return response;
  },
  getById: async (id: string) => {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error(`[${new Date().toISOString()}] productsAPI.getById - معرف المنتج غير صالح:`, id);
      throw new Error('معرف المنتج غير صالح');
    }
    const response = await api.get(`/products/${id}`);
    console.log(`[${new Date().toISOString()}] productsAPI.getById - Response:`, response);
    return response;
  },
  create: async (productData: {
    name: string;
    code: string;
    department: string;
    price: number;
    description?: string;
    unit?: string;
  }) => {
    const response = await api.post('/products', {
      name: productData.name.trim(),
      code: productData.code.trim(),
      department: productData.department,
      price: productData.price,
      description: productData.description?.trim(),
      unit: productData.unit?.trim(),
    });
    console.log(`[${new Date().toISOString()}] productsAPI.create - Response:`, response);
    return response;
  },
  update: async (id: string, productData: Partial<{
    name: string;
    code: string;
    department: string;
    price: number;
    description: string;
    unit: string;
  }>) => {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error(`[${new Date().toISOString()}] productsAPI.update - معرف المنتج غير صالح:`, id);
      throw new Error('معرف المنتج غير صالح');
    }
    const response = await api.put(`/products/${id}`, {
      name: productData.name?.trim(),
      code: productData.code?.trim(),
      department: productData.department,
      price: productData.price,
      description: productData.description?.trim(),
      unit: productData.unit?.trim(),
    });
    console.log(`[${new Date().toISOString()}] productsAPI.update - Response:`, response);
    return response;
  },
  delete: async (id: string) => {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error(`[${new Date().toISOString()}] productsAPI.delete - معرف المنتج غير صالح:`, id);
      throw new Error('معرف المنتج غير صالح');
    }
    const response = await api.delete(`/products/${id}`);
    console.log(`[${new Date().toISOString()}] productsAPI.delete - Response:`, response);
    return response;
  },
};

export const departmentAPI = {
  getAll: async () => {
    const response = await api.get('/departments');
    console.log(`[${new Date().toISOString()}] departmentAPI.getAll - Response:`, response);
    return response;
  },
  create: async (departmentData: { name: string; code: string; description?: string }) => {
    const response = await api.post('/departments', {
      name: departmentData.name.trim(),
      code: departmentData.code.trim(),
      description: departmentData.description?.trim(),
    });
    console.log(`[${new Date().toISOString()}] departmentAPI.create - Response:`, response);
    return response;
  },
  update: async (id: string, departmentData: Partial<{ name: string; code: string; description: string }>) => {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error(`[${new Date().toISOString()}] departmentAPI.update - معرف القسم غير صالح:`, id);
      throw new Error('معرف القسم غير صالح');
    }
    const response = await api.put(`/departments/${id}`, {
      name: departmentData.name?.trim(),
      code: departmentData.code?.trim(),
      description: departmentData.description?.trim(),
    });
    console.log(`[${new Date().toISOString()}] departmentAPI.update - Response:`, response);
    return response;
  },
  delete: async (id: string) => {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error(`[${new Date().toISOString()}] departmentAPI.delete - معرف القسم غير صالح:`, id);
      throw new Error('معرف القسم غير صالح');
    }
    const response = await api.delete(`/departments/${id}`);
    console.log(`[${new Date().toISOString()}] departmentAPI.delete - Response:`, response);
    return response;
  },
};

export const chefsAPI = {
  getAll: async () => {
    const response = await api.get('/users', { params: { role: 'chef' } }); // تغيير إلى /users مع فلتر role=chef
    console.log(`[${new Date().toISOString()}] chefsAPI.getAll - Response:`, response);
    return response;
  },
  getByUserId: async (userId: string) => {
    if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
      console.error(`[${new Date().toISOString()}] chefsAPI.getByUserId - معرف المستخدم غير صالح:`, userId);
      throw new Error('معرف المستخدم غير صالح');
    }
    const response = await api.get(`/users/${userId}`);
    console.log(`[${new Date().toISOString()}] chefsAPI.getByUserId - Response:`, response);
    return response;
  },
  create: async (chefData: {
    user: {
      name: string;
      username: string;
      email: string;
      phone: string;
      password: string;
      role: string;
    };
    department: string;
  }) => {
    const response = await api.post('/users', {
      name: chefData.user.name.trim(),
      username: chefData.user.username.trim(),
      email: chefData.user.email.trim(),
      phone: chefData.user.phone.trim(),
      password: chefData.user.password,
      role: 'chef',
      department: chefData.department,
    });
    console.log(`[${new Date().toISOString()}] chefsAPI.create - Response:`, response);
    return response;
  },
  update: async (id: string, chefData: Partial<{ name: string; email: string; phone: string; departmentId: string }>) => {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error(`[${new Date().toISOString()}] chefsAPI.update - معرف الشيف غير صالح:`, id);
      throw new Error('معرف الشيف غير صالح');
    }
    const response = await api.put(`/users/${id}`, {
      name: chefData.name?.trim(),
      email: chefData.email?.trim(),
      phone: chefData.phone?.trim(),
      department: chefData.departmentId,
    });
    console.log(`[${new Date().toISOString()}] chefsAPI.update - Response:`, response);
    return response;
  },
  delete: async (id: string) => {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error(`[${new Date().toISOString()}] chefsAPI.delete - معرف الشيف غير صالح:`, id);
      throw new Error('معرف الشيف غير صالح');
    }
    const response = await api.delete(`/users/${id}`);
    console.log(`[${new Date().toISOString()}] chefsAPI.delete - Response:`, response);
    return response;
  },
};

export const productionAssignmentsAPI = {
  create: async (assignmentData: {
    order: string;
    product: string;
    chef: string;
    quantity: number;
    itemId: string;
  }) => {
    if (!isValidObjectId(assignmentData.order) ||
        !isValidObjectId(assignmentData.product) ||
        !isValidObjectId(assignmentData.chef) ||
        !isValidObjectId(assignmentData.itemId)) {
      console.error(`[${new Date().toISOString()}] productionAssignmentsAPI.create - بيانات غير صالحة:`, assignmentData);
      throw new Error('معرف الطلب، المنتج، الشيف، أو العنصر غير صالح');
    }
    console.log(`[${new Date().toISOString()}] productionAssignmentsAPI.create - Sending:`, assignmentData);
    const response = await api.post('/orders/tasks', assignmentData);
    console.log(`[${new Date().toISOString()}] productionAssignmentsAPI.create - Response:`, response);
    return response;
  },
  getChefTasks: async (chefId: string, query: { page?: number; limit?: number; status?: string; search?: string } = {}) => {
    if (!isValidObjectId(chefId)) {
      console.error(`[${new Date().toISOString()}] productionAssignmentsAPI.getChefTasks - معرف الشيف غير صالح:`, chefId);
      throw new Error('معرف الشيف غير صالح');
    }
    console.log(`[${new Date().toISOString()}] productionAssignmentsAPI.getChefTasks - Sending:`, { chefId, query });
    const response = await api.get(`/orders/tasks/chef/${chefId}`, { params: query });
    console.log(`[${new Date().toISOString()}] productionAssignmentsAPI.getChefTasks - Response:`, response);
    return response;
  },
  updateTaskStatus: async (orderId: string, taskId: string, data: { status: string }) => {
    if (!isValidObjectId(orderId) || !isValidObjectId(taskId)) {
      console.error(`[${new Date().toISOString()}] productionAssignmentsAPI.updateTaskStatus - معرف الطلب أو المهمة غير صالح:`, { orderId, taskId });
      throw new Error('معرف الطلب أو المهمة غير صالح');
    }
    console.log(`[${new Date().toISOString()}] productionAssignmentsAPI.updateTaskStatus - Sending:`, { orderId, taskId, data });
    const response = await api.patch(`/orders/${orderId}/tasks/${taskId}/status`, data);
    console.log(`[${new Date().toISOString()}] productionAssignmentsAPI.updateTaskStatus - Response:`, response);
    return response;
  },
  getAllTasks: async () => {
    const response = await api.get('/orders/tasks');
    console.log(`[${new Date().toISOString()}] productionAssignmentsAPI.getAllTasks - Response:`, response);
    return response;
  },
};

export const inventoryAPI = {
  getInventory: async (params = {}) => {
    if (params.branch && !isValidObjectId(params.branch)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getInventory - معرف الفرع غير صالح:`, params.branch);
      throw new Error('معرف الفرع غير صالح');
    }
    if (params.product && !isValidObjectId(params.product)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getInventory - معرف المنتج غير صالح:`, params.product);
      throw new Error('معرف المنتج غير صالح');
    }
    const response = await api.get('/inventory', { params });
    console.log(`[${new Date().toISOString()}] inventoryAPI.getInventory - Response:`, response);
    return response.inventory;
  },
  getByBranch: async (branchId: string) => {
    if (!isValidObjectId(branchId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getByBranch - معرف الفرع غير صالح:`, branchId);
      throw new Error('معرف الفرع غير صالح');
    }
    console.log(`[${new Date().toISOString()}] inventoryAPI.getByBranch - Sending:`, { branchId });
    const response = await api.get(`/inventory/branch/${branchId}`);
    console.log(`[${new Date().toISOString()}] inventoryAPI.getByBranch - Response:`, response);
    return response.inventory;
  },
  getAll: async (params = {}) => {
    if (params.branch && !isValidObjectId(params.branch)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getAll - معرف الفرع غير صالح:`, params.branch);
      throw new Error('معرف الفرع غير صالح');
    }
    if (params.product && !isValidObjectId(params.product)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getAll - معرف المنتج غير صالح:`, params.product);
      throw new Error('معرف المنتج غير صالح');
    }
    const response = await api.get('/inventory', { params });
    console.log(`[${new Date().toISOString()}] inventoryAPI.getAll - Response:`, response);
    return response.inventory;
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
      console.error(`[${new Date().toISOString()}] inventoryAPI.create - بيانات غير صالحة:`, data);
      throw new Error('معرف الفرع، المنتج، المستخدم، أو الطلب غير صالح');
    }
    if (data.currentStock < 0) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.create - كمية المخزون غير صالحة:`, data.currentStock);
      throw new Error('كمية المخزون لا يمكن أن تكون سالبة');
    }
    console.log(`[${new Date().toISOString()}] inventoryAPI.create - Sending:`, data);
    const response = await api.post('/inventory', {
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
      console.error(`[${new Date().toISOString()}] inventoryAPI.bulkCreate - بيانات غير صالحة:`, data);
      throw new Error('معرف الفرع، المستخدم، الطلب، أو العناصر غير صالحة');
    }
    console.log(`[${new Date().toISOString()}] inventoryAPI.bulkCreate - Sending:`, data);
    const response = await api.post('/inventory/bulk', {
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
  updateStock: async (id: string, data: {
    currentStock?: number;
    minStockLevel?: number;
    maxStockLevel?: number;
    productId?: string;
    branchId?: string;
  }) => {
    if (
      !isValidObjectId(id) ||
      (data.productId && !isValidObjectId(data.productId)) ||
      (data.branchId && !isValidObjectId(data.branchId))
    ) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStock - معرف المخزون، المنتج، أو الفرع غير صالح:`, { id, data });
      throw new Error('معرف المخزون، المنتج، أو الفرع غير صالح');
    }
    if (data.currentStock !== undefined && data.currentStock < 0) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStock - كمية المخزون غير صالحة:`, data.currentStock);
      throw new Error('كمية المخزون لا يمكن أن تكون سالبة');
    }
    console.log(`[${new Date().toISOString()}] inventoryAPI.updateStock - Sending:`, { id, data });
    const response = await api.put(`/inventory/${id}`, {
      currentStock: data.currentStock,
      minStockLevel: data.minStockLevel,
      maxStockLevel: data.maxStockLevel,
      productId: data.productId,
      branchId: data.branchId,
    });
    console.log(`[${new Date().toISOString()}] inventoryAPI.updateStock - Response:`, response);
    return response.inventory;
  },
  processReturnItems: async (returnId: string, data: {
    branchId: string;
    items: Array<{ productId: string; quantity: number; status: 'approved' | 'rejected'; reviewNotes?: string }>;
  }) => {
    if (
      !isValidObjectId(returnId) ||
      !isValidObjectId(data.branchId) ||
      !Array.isArray(data.items) ||
      data.items.length === 0 ||
      data.items.some(item => !isValidObjectId(item.productId) || item.quantity < 1 || !['approved', 'rejected'].includes(item.status))
    ) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.processReturnItems - بيانات غير صالحة:`, { returnId, data });
      throw new Error('معرف الإرجاع، الفرع، أو العناصر غير صالحة');
    }
    console.log(`[${new Date().toISOString()}] inventoryAPI.processReturnItems - Sending:`, { returnId, data });
    const response = await api.patch(`/inventory/returns/${returnId}/process`, {
      branchId: data.branchId,
      items: data.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        status: item.status,
        reviewNotes: item.reviewNotes?.trim(),
      })),
    });
    console.log(`[${new Date().toISOString()}] inventoryAPI.processReturnItems - Response:`, response);
    return response.returnRequest;
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
      console.error(`[${new Date().toISOString()}] inventoryAPI.createRestockRequest - بيانات غير صالحة:`, data);
      throw new Error('معرف المنتج، الفرع، أو الكمية المطلوبة غير صالحة');
    }
    console.log(`[${new Date().toISOString()}] inventoryAPI.createRestockRequest - Sending:`, data);
    const response = await api.post('/inventory/restock-requests', {
      productId: data.productId,
      branchId: data.branchId,
      requestedQuantity: data.requestedQuantity,
      notes: data.notes?.trim(),
    });
    console.log(`[${new Date().toISOString()}] inventoryAPI.createRestockRequest - Response:`, response);
    return response.restockRequest;
  },
  getRestockRequests: async (params = {}) => {
    if (params.branchId && !isValidObjectId(params.branchId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getRestockRequests - معرف الفرع غير صالح:`, params.branchId);
      throw new Error('معرف الفرع غير صالح');
    }
    console.log(`[${new Date().toISOString()}] inventoryAPI.getRestockRequests - Sending:`, params);
    const response = await api.get('/inventory/restock-requests', { params });
    console.log(`[${new Date().toISOString()}] inventoryAPI.getRestockRequests - Response:`, response);
    return response.restockRequests;
  },
  approveRestockRequest: async (requestId: string, data: { approvedQuantity: number; userId: string }) => {
    if (!isValidObjectId(requestId) || !isValidObjectId(data.userId) || data.approvedQuantity < 1) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.approveRestockRequest - بيانات غير صالحة:`, { requestId, data });
      throw new Error('معرف الطلب، المستخدم، أو الكمية المعتمدة غير صالحة');
    }
    console.log(`[${new Date().toISOString()}] inventoryAPI.approveRestockRequest - Sending:`, { requestId, data });
    const response = await api.patch(`/inventory/restock-requests/${requestId}/approve`, {
      approvedQuantity: data.approvedQuantity,
      userId: data.userId,
    });
    console.log(`[${new Date().toISOString()}] inventoryAPI.approveRestockRequest - Response:`, response);
    return response.restockRequest;
  },
  getHistory: async (params = {}) => {
    if (params.branchId && !isValidObjectId(params.branchId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getHistory - معرف الفرع غير صالح:`, params.branchId);
      throw new Error('معرف الفرع غير صالح');
    }
    if (params.productId && !isValidObjectId(params.productId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getHistory - معرف المنتج غير صالح:`, params.productId);
      throw new Error('معرف المنتج غير صالح');
    }
    console.log(`[${new Date().toISOString()}] inventoryAPI.getHistory - Sending:`, params);
    const response = await api.get('/inventory/history', { params });
    console.log(`[${new Date().toISOString()}] inventoryAPI.getHistory - Response:`, response);
    return response.history;
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
      console.error(`[${new Date().toISOString()}] inventoryAPI.createReturn - بيانات غير صالحة:`, data);
      throw new Error('معرف الطلب، الفرع، السبب، أو العناصر غير صالحة');
    }
    console.log(`[${new Date().toISOString()}] inventoryAPI.createReturn - Sending:`, data);
    const response = await api.post('/inventory/returns', {
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
    console.log(`[${new Date().toISOString()}] inventoryAPI.createReturn - Response:`, response);
    return response.returnRequest;
  },
};

export const factoryInventoryAPI = {
  getAll: async (params: { product?: string; department?: string; lowStock?: boolean } = {}) => {
    const response = await api.get('/factory-inventory', { params });
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.getAll - Response:`, response);
    return response;
  },
  addProductionBatch: async (data: { productId: string; quantity: number }) => {
    if (!isValidObjectId(data.productId)) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.addProductionBatch - معرف المنتج غير صالح:`, data.productId);
      throw new Error('معرف المنتج غير صالح');
    }
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.addProductionBatch - Sending:`, data);
    const response = await api.post('/factory-inventory/production', data);
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.addProductionBatch - Response:`, response);
    return response;
  },
  allocateToBranch: async (data: { requestId: string; productId: string; allocatedQuantity: number }) => {
    if (!isValidObjectId(data.requestId) || !isValidObjectId(data.productId)) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.allocateToBranch - معرف الطلب أو المنتج غير صالح:`, data);
      throw new Error('معرف الطلب أو المنتج غير صالح');
    }
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.allocateToBranch - Sending:`, data);
    const response = await api.post('/factory-inventory/allocate', data);
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.allocateToBranch - Response:`, response);
    return response;
  },
  getRestockRequests: async () => {
    const response = await api.get('/factory-inventory/restock-requests');
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.getRestockRequests - Response:`, response);
    return response;
  },
  approveRestockRequest: async (requestId: string, data: { approvedQuantity: number }) => {
    if (!isValidObjectId(requestId)) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.approveRestockRequest - معرف الطلب غير صالح:`, requestId);
      throw new Error('معرف الطلب غير صالح');
    }
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.approveRestockRequest - Sending:`, { requestId, data });
    const response = await api.patch(`/factory-inventory/restock-requests/${requestId}/approve`, data);
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.approveRestockRequest - Response:`, response);
    return response;
  },
  getHistory: async (params: { productId?: string } = {}) => {
    const response = await api.get('/factory-inventory/history', { params });
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.getHistory - Response:`, response);
    return response;
  },
  getByBranch: async (branchId: string) => {
    if (!isValidObjectId(branchId)) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.getByBranch - معرف الفرع غير صالح:`, branchId);
      throw new Error('معرف الفرع غير صالح');
    }
    const response = await api.get(`/inventory/branch/${branchId}`);
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.getByBranch - Response:`, response);
    return response;
  },
};

export { ordersAPI, notificationsAPI, returnsAPI, salesAPI };
export default api;