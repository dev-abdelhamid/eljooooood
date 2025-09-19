import axios from 'axios';
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
    console.log(`API request at ${new Date().toISOString()}:`, {
      url: config.url,
      method: config.method,
      headers: config.headers,
    });
    return config;
  },
  (error) => {
    console.error(`API request error at ${new Date().toISOString()}:`, error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;
    console.error(`API response error at ${new Date().toISOString()}:`, {
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
          console.error(`No refresh token available at ${new Date().toISOString()}`);
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
        console.log(`Token refreshed successfully at ${new Date().toISOString()}`);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error(`Refresh token failed at ${new Date().toISOString()}:`, refreshError);
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
    console.log(`Login response at ${new Date().toISOString()}:`, response);
    return response;
  },
  refreshToken: async (refreshToken: string) => {
    const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken });
    console.log(`Refresh token response at ${new Date().toISOString()}:`, response.data);
    return response.data;
  },
  getProfile: async () => {
    const response = await api.get('/auth/profile');
    console.log(`Profile response at ${new Date().toISOString()}:`, response);
    return {
      ...response,
      user: {
        ...(response as any).user,
        _id: (response as any).user.id || (response as any).user._id,
      },
    };
  },
  updateProfile: async (data: { name?: string; password?: string }) => {
    const response = await api.put('/auth/profile', {
      name: data.name?.trim(),
      password: data.password,
    });
    console.log(`Update profile response at ${new Date().toISOString()}:`, response);
    return response;
  },
  checkEmail: async (email: string) => {
    const response = await api.post('/auth/check-email', { email: email.trim() });
    console.log(`Check email response at ${new Date().toISOString()}:`, response);
    return response;
  },
};

export const branchesAPI = {
  getAll: async () => {
    const response = await api.get('/branches');
    console.log(`Branches getAll response at ${new Date().toISOString()}:`, response);
    return response;
  },
  getById: async (id: string) => {
    const response = await api.get(`/branches/${id}`);
    console.log(`Branches getById response at ${new Date().toISOString()}:`, response);
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
    console.log(`Branches create response at ${new Date().toISOString()}:`, response);
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
    console.log(`Branches update response at ${new Date().toISOString()}:`, response);
    return response;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/branches/${id}`);
    console.log(`Branches delete response at ${new Date().toISOString()}:`, response);
    return response;
  },
  checkEmail: async (email: string) => {
    const response = await api.post('/branches/check-email', { email: email.trim() });
    console.log(`Branches checkEmail response at ${new Date().toISOString()}:`, response);
    return response;
  },
};

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
    const response = await api.post('/orders', orderData);
    console.log(`ordersAPI.create - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
  getAll: async (params: { status?: string; branch?: string; page?: number; limit?: number; department?: string; search?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' } = {}) => {
    const response = await api.get('/orders', { params });
    console.log(`ordersAPI.getAll - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
  getById: async (id: string) => {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error(`ordersAPI.getById - Invalid order ID at ${new Date().toISOString()}:`, id);
      throw new Error('Invalid order ID');
    }
    const response = await api.get(`/orders/${id}`);
    console.log(`ordersAPI.getById - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
  updateStatus: async (id: string, data: { status: string; notes?: string }) => {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error(`ordersAPI.updateStatus - Invalid order ID at ${new Date().toISOString()}:`, id);
      throw new Error('Invalid order ID');
    }
    const response = await api.patch(`/orders/${id}/status`, data);
    console.log(`ordersAPI.updateStatus - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
  updateChefItem: async (orderId: string, data: { taskId: string; status: string }) => {
    if (!/^[0-9a-fA-F]{24}$/.test(orderId) || !/^[0-9a-fA-F]{24}$/.test(data.taskId)) {
      console.error(`ordersAPI.updateChefItem - Invalid order ID or task ID at ${new Date().toISOString()}:`, { orderId, taskId: data.taskId });
      throw new Error('Invalid order ID or task ID');
    }
    const response = await api.patch(`/orders/${orderId}/tasks/${data.taskId}/status`, { status: data.status });
    console.log(`ordersAPI.updateChefItem - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
  assignChef: async (orderId: string, data: { items: Array<{ itemId: string; assignedTo: string }> }) => {
    console.log(`ordersAPI.assignChef - Sending at ${new Date().toISOString()}:`, { orderId, data });
    if (!/^[0-9a-fA-F]{24}$/.test(orderId) || data.items.some((item) => !/^[0-9a-fA-F]{24}$/.test(item.itemId) || !/^[0-9a-fA-F]{24}$/.test(item.assignedTo))) {
      console.error(`ordersAPI.assignChef - Invalid data at ${new Date().toISOString()}:`, { orderId, data });
      throw new Error('Invalid order ID, item ID, or chef ID');
    }
    const timestamp = new Date().toISOString();
    const response = await api.patch(`/orders/${orderId}/assign`, { ...data, timestamp });
    console.log(`ordersAPI.assignChef - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
  confirmDelivery: async (orderId: string) => {
    if (!/^[0-9a-fA-F]{24}$/.test(orderId)) {
      console.error(`ordersAPI.confirmDelivery - Invalid order ID at ${new Date().toISOString()}:`, orderId);
      throw new Error('Invalid order ID');
    }
    console.log(`ordersAPI.confirmDelivery - Sending at ${new Date().toISOString()}:`, { orderId });
    const response = await api.patch(`/orders/${orderId}/confirm-delivery`);
    console.log(`ordersAPI.confirmDelivery - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
};

export const productsAPI = {
  getAll: async (params: { department?: string; search?: string; page?: number; limit?: number } = {}) => {
    const response = await api.get('/products', { params });
    console.log(`productsAPI.getAll - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
  getById: async (id: string) => {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error(`productsAPI.getById - Invalid product ID at ${new Date().toISOString()}:`, id);
      throw new Error('Invalid product ID');
    }
    const response = await api.get(`/products/${id}`);
    console.log(`productsAPI.getById - Response at ${new Date().toISOString()}:`, response);
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
    console.log(`productsAPI.create - Response at ${new Date().toISOString()}:`, response);
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
      console.error(`productsAPI.update - Invalid product ID at ${new Date().toISOString()}:`, id);
      throw new Error('Invalid product ID');
    }
    const response = await api.put(`/products/${id}`, {
      name: productData.name?.trim(),
      code: productData.code?.trim(),
      department: productData.department,
      price: productData.price,
      description: productData.description?.trim(),
      unit: productData.unit?.trim(),
    });
    console.log(`productsAPI.update - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
  delete: async (id: string) => {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error(`productsAPI.delete - Invalid product ID at ${new Date().toISOString()}:`, id);
      throw new Error('Invalid product ID');
    }
    const response = await api.delete(`/products/${id}`);
    console.log(`productsAPI.delete - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
};

export const departmentAPI = {
  getAll: async () => {
    const response = await api.get('/departments');
    console.log(`departmentAPI.getAll - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
  create: async (departmentData: { name: string; code: string; description?: string }) => {
    const response = await api.post('/departments', {
      name: departmentData.name.trim(),
      code: departmentData.code.trim(),
      description: departmentData.description?.trim(),
    });
    console.log(`departmentAPI.create - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
  update: async (id: string, departmentData: Partial<{ name: string; code: string; description: string }>) => {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error(`departmentAPI.update - Invalid department ID at ${new Date().toISOString()}:`, id);
      throw new Error('Invalid department ID');
    }
    const response = await api.put(`/departments/${id}`, {
      name: departmentData.name?.trim(),
      code: departmentData.code?.trim(),
      description: departmentData.description?.trim(),
    });
    console.log(`departmentAPI.update - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
  delete: async (id: string) => {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error(`departmentAPI.delete - Invalid department ID at ${new Date().toISOString()}:`, id);
      throw new Error('Invalid department ID');
    }
    const response = await api.delete(`/departments/${id}`);
    console.log(`departmentAPI.delete - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
};

export const chefsAPI = {
  getAll: async () => {
    const response = await api.get('/chefs');
    console.log(`chefsAPI.getAll - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
  getByUserId: async (userId: string) => {
    if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
      console.error(`chefsAPI.getByUserId - Invalid user ID at ${new Date().toISOString()}:`, userId);
      throw new Error('Invalid user ID');
    }
    const response = await api.get(`/chefs/by-user/${userId}`);
    console.log(`chefsAPI.getByUserId - Response at ${new Date().toISOString()}:`, response);
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
    const response = await api.post('/chefs', {
      user: {
        name: chefData.user.name.trim(),
        username: chefData.user.username.trim(),
        email: chefData.user.email.trim(),
        phone: chefData.user.phone.trim(),
        password: chefData.user.password,
        role: chefData.user.role,
      },
      department: chefData.department,
    });
    console.log(`chefsAPI.create - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
  update: async (id: string, chefData: Partial<{ userId: string; departmentId: string }>) => {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error(`chefsAPI.update - Invalid chef ID at ${new Date().toISOString()}:`, id);
      throw new Error('Invalid chef ID');
    }
    const response = await api.put(`/chefs/${id}`, chefData);
    console.log(`chefsAPI.update - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
  delete: async (id: string) => {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error(`chefsAPI.delete - Invalid chef ID at ${new Date().toISOString()}:`, id);
      throw new Error('Invalid chef ID');
    }
    const response = await api.delete(`/chefs/${id}`);
    console.log(`chefsAPI.delete - Response at ${new Date().toISOString()}:`, response);
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
    if (!/^[0-9a-fA-F]{24}$/.test(assignmentData.order) ||
        !/^[0-9a-fA-F]{24}$/.test(assignmentData.product) ||
        !/^[0-9a-fA-F]{24}$/.test(assignmentData.chef) ||
        !/^[0-9a-fA-F]{24}$/.test(assignmentData.itemId)) {
      console.error(`productionAssignmentsAPI.create - Invalid data at ${new Date().toISOString()}:`, assignmentData);
      throw new Error('Invalid order ID, product ID, chef ID, or item ID');
    }
    console.log(`[${new Date().toISOString()}] productionAssignmentsAPI.create - Sending:`, assignmentData);
    const response = await api.post('/orders/tasks', assignmentData);
    console.log(`[${new Date().toISOString()}] productionAssignmentsAPI.create - Response:`, response);
    return response;
  },
  getChefTasks: async (chefId: string, query: { page?: number; limit?: number; status?: string; search?: string } = {}) => {
    if (!/^[0-9a-fA-F]{24}$/.test(chefId)) {
      console.error(`[${new Date().toISOString()}] productionAssignmentsAPI.getChefTasks - Invalid chefId:`, chefId);
      throw new Error('Invalid chef ID');
    }
    console.log(`[${new Date().toISOString()}] productionAssignmentsAPI.getChefTasks - Sending:`, { chefId, query });
    const response = await api.get(`/orders/tasks/chef/${chefId}`, { params: query });
    console.log(`[${new Date().toISOString()}] productionAssignmentsAPI.getChefTasks - Response:`, response);
    return response;
  },
  updateTaskStatus: async (orderId: string, taskId: string, data: { status: string }) => {
    if (!/^[0-9a-fA-F]{24}$/.test(orderId) || !/^[0-9a-fA-F]{24}$/.test(taskId)) {
      console.error(`[${new Date().toISOString()}] productionAssignmentsAPI.updateTaskStatus - Invalid orderId or taskId:`, { orderId, taskId });
      throw new Error('Invalid order ID or task ID');
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
    if (params.branch && !/^[0-9a-fA-F]{24}$/.test(params.branch)) {
      console.error(`inventoryAPI.getInventory - Invalid branch ID at ${new Date().toISOString()}:`, params.branch);
      throw new Error('Invalid branch ID');
    }
    if (params.product && !/^[0-9a-fA-F]{24}$/.test(params.product)) {
      console.error(`inventoryAPI.getInventory - Invalid product ID at ${new Date().toISOString()}:`, params.product);
      throw new Error('Invalid product ID');
    }
    const response = await api.get('/inventory', { params });
    console.log(`inventoryAPI.getInventory - Response at ${new Date().toISOString()}:`, response);
    return response.inventory;
  },
  getByBranch: async (branchId) => {
    if (!/^[0-9a-fA-F]{24}$/.test(branchId)) {
      console.error(`inventoryAPI.getByBranch - Invalid branch ID at ${new Date().toISOString()}:`, branchId);
      throw new Error('Invalid branch ID');
    }
    console.log(`inventoryAPI.getByBranch - Sending at ${new Date().toISOString()}:`, { branchId });
    const response = await api.get(`/inventory/branch/${branchId}`);
    console.log(`inventoryAPI.getByBranch - Response at ${new Date().toISOString()}:`, response);
    return response.inventory;
  },
  getAll: async (params = {}) => {
    if (params.branch && !/^[0-9a-fA-F]{24}$/.test(params.branch)) {
      console.error(`inventoryAPI.getAll - Invalid branch ID at ${new Date().toISOString()}:`, params.branch);
      throw new Error('Invalid branch ID');
    }
    if (params.product && !/^[0-9a-fA-F]{24}$/.test(params.product)) {
      console.error(`inventoryAPI.getAll - Invalid product ID at ${new Date().toISOString()}:`, params.product);
      throw new Error('Invalid product ID');
    }
    const response = await api.get('/inventory', { params });
    console.log(`inventoryAPI.getAll - Response at ${new Date().toISOString()}:`, response);
    return response.inventory;
  },
  create: async (data) => {
    if (
      !/^[0-9a-fA-F]{24}$/.test(data.branchId) ||
      !/^[0-9a-fA-F]{24}$/.test(data.productId) ||
      !/^[0-9a-fA-F]{24}$/.test(data.userId) ||
      (data.orderId && !/^[0-9a-fA-F]{24}$/.test(data.orderId))
    ) {
      console.error(`inventoryAPI.create - Invalid data at ${new Date().toISOString()}:`, data);
      throw new Error('Invalid branch ID, product ID, user ID, or order ID');
    }
    if (data.currentStock < 0) {
      console.error(`inventoryAPI.create - Invalid stock quantity at ${new Date().toISOString()}:`, data.currentStock);
      throw new Error('Stock quantity cannot be negative');
    }
    console.log(`inventoryAPI.create - Sending at ${new Date().toISOString()}:`, data);
    const response = await api.post('/inventory', {
      branchId: data.branchId,
      productId: data.productId,
      currentStock: data.currentStock,
      minStockLevel: data.minStockLevel ?? 0,
      maxStockLevel: data.maxStockLevel ?? 1000,
      userId: data.userId,
      orderId: data.orderId,
    });
    console.log(`inventoryAPI.create - Response at ${new Date().toISOString()}:`, response);
    return response.inventory;
  },
  bulkCreate: async (data) => {
    if (
      !/^[0-9a-fA-F]{24}$/.test(data.branchId) ||
      !/^[0-9a-fA-F]{24}$/.test(data.userId) ||
      (data.orderId && !/^[0-9a-fA-F]{24}$/.test(data.orderId)) ||
      !Array.isArray(data.items) ||
      data.items.length === 0 ||
      data.items.some(item => !/^[0-9a-fA-F]{24}$/.test(item.productId) || item.currentStock < 0)
    ) {
      console.error(`inventoryAPI.bulkCreate - Invalid data at ${new Date().toISOString()}:`, data);
      throw new Error('Invalid branch ID, user ID, order ID, or items');
    }
    console.log(`inventoryAPI.bulkCreate - Sending at ${new Date().toISOString()}:`, data);
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
    console.log(`inventoryAPI.bulkCreate - Response at ${new Date().toISOString()}:`, response);
    return response.inventories;
  },
  updateStock: async (id, data) => {
    if (
      !/^[0-9a-fA-F]{24}$/.test(id) ||
      (data.productId && !/^[0-9a-fA-F]{24}$/.test(data.productId)) ||
      (data.branchId && !/^[0-9a-fA-F]{24}$/.test(data.branchId))
    ) {
      console.error(`inventoryAPI.updateStock - Invalid inventory ID, product ID, or branch ID at ${new Date().toISOString()}:`, { id, data });
      throw new Error('Invalid inventory ID, product ID, or branch ID');
    }
    if (data.currentStock !== undefined && data.currentStock < 0) {
      console.error(`inventoryAPI.updateStock - Invalid stock quantity at ${new Date().toISOString()}:`, data.currentStock);
      throw new Error('Stock quantity cannot be negative');
    }
    console.log(`inventoryAPI.updateStock - Sending at ${new Date().toISOString()}:`, { id, data });
    const response = await api.put(`/inventory/${id}`, {
      currentStock: data.currentStock,
      minStockLevel: data.minStockLevel,
      maxStockLevel: data.maxStockLevel,
      productId: data.productId,
      branchId: data.branchId,
    });
    console.log(`inventoryAPI.updateStock - Response at ${new Date().toISOString()}:`, response);
    return response.inventory;
  },
  processReturnItems: async (returnId, data) => {
    if (
      !/^[0-9a-fA-F]{24}$/.test(returnId) ||
      !/^[0-9a-fA-F]{24}$/.test(data.branchId) ||
      !Array.isArray(data.items) ||
      data.items.length === 0 ||
      data.items.some(item => !/^[0-9a-fA-F]{24}$/.test(item.productId) || item.quantity < 1 || !['approved', 'rejected'].includes(item.status))
    ) {
      console.error(`inventoryAPI.processReturnItems - Invalid data at ${new Date().toISOString()}:`, { returnId, data });
      throw new Error('Invalid return ID, branch ID, or items');
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
    return response.returnRequest;
  },
  createRestockRequest: async (data) => {
    if (
      !/^[0-9a-fA-F]{24}$/.test(data.productId) ||
      !/^[0-9a-fA-F]{24}$/.test(data.branchId) ||
      data.requestedQuantity < 1
    ) {
      console.error(`inventoryAPI.createRestockRequest - Invalid data at ${new Date().toISOString()}:`, data);
      throw new Error('Invalid product ID, branch ID, or requested quantity');
    }
    console.log(`inventoryAPI.createRestockRequest - Sending at ${new Date().toISOString()}:`, data);
    const response = await api.post('/inventory/restock-requests', {
      productId: data.productId,
      branchId: data.branchId,
      requestedQuantity: data.requestedQuantity,
      notes: data.notes?.trim(),
    });
    console.log(`inventoryAPI.createRestockRequest - Response at ${new Date().toISOString()}:`, response);
    return response.restockRequest;
  },
  getRestockRequests: async (params = {}) => {
    if (params.branchId && !/^[0-9a-fA-F]{24}$/.test(params.branchId)) {
      console.error(`inventoryAPI.getRestockRequests - Invalid branch ID at ${new Date().toISOString()}:`, params.branchId);
      throw new Error('Invalid branch ID');
    }
    console.log(`inventoryAPI.getRestockRequests - Sending at ${new Date().toISOString()}:`, params);
    const response = await api.get('/inventory/restock-requests', { params });
    console.log(`inventoryAPI.getRestockRequests - Response at ${new Date().toISOString()}:`, response);
    return response.restockRequests;
  },
  approveRestockRequest: async (requestId, data) => {
    if (!/^[0-9a-fA-F]{24}$/.test(requestId) || !/^[0-9a-fA-F]{24}$/.test(data.userId) || data.approvedQuantity < 1) {
      console.error(`inventoryAPI.approveRestockRequest - Invalid data at ${new Date().toISOString()}:`, { requestId, data });
      throw new Error('Invalid request ID, user ID, or approved quantity');
    }
    console.log(`inventoryAPI.approveRestockRequest - Sending at ${new Date().toISOString()}:`, { requestId, data });
    const response = await api.patch(`/inventory/restock-requests/${requestId}/approve`, {
      approvedQuantity: data.approvedQuantity,
      userId: data.userId,
    });
    console.log(`inventoryAPI.approveRestockRequest - Response at ${new Date().toISOString()}:`, response);
    return response.restockRequest;
  },
  getHistory: async (params = {}) => {
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
    return response.history;
  },
  createReturn: async (data) => {
    if (
      !/^[0-9a-fA-F]{24}$/.test(data.orderId) ||
      !/^[0-9a-fA-F]{24}$/.test(data.branchId) ||
      !data.reason ||
      !Array.isArray(data.items) ||
      data.items.length === 0 ||
      data.items.some(item => !/^[0-9a-fA-F]{24}$/.test(item.productId) || item.quantity < 1 || !item.reason)
    ) {
      console.error(`inventoryAPI.createReturn - Invalid data at ${new Date().toISOString()}:`, data);
      throw new Error('Invalid order ID, branch ID, reason, or items');
    }
    console.log(`inventoryAPI.createReturn - Sending at ${new Date().toISOString()}:`, data);
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
    console.log(`inventoryAPI.createReturn - Response at ${new Date().toISOString()}:`, response);
    return response.returnRequest;
  },
};

export const factoryInventoryAPI = {
  getAll: async (params: { product?: string; department?: string; lowStock?: boolean } = {}) => {
    const response = await api.get('/factory-inventory', { params });
    console.log(`factoryInventoryAPI.getAll - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
  addProductionBatch: async (data: { productId: string; quantity: number }) => {
    if (!/^[0-9a-fA-F]{24}$/.test(data.productId)) {
      console.error(`factoryInventoryAPI.addProductionBatch - Invalid product ID at ${new Date().toISOString()}:`, data.productId);
      throw new Error('Invalid product ID');
    }
    console.log(`factoryInventoryAPI.addProductionBatch - Sending at ${new Date().toISOString()}:`, data);
    const response = await api.post('/factory-inventory/production', data);
    console.log(`factoryInventoryAPI.addProductionBatch - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
  allocateToBranch: async (data: { requestId: string; productId: string; allocatedQuantity: number }) => {
    if (!/^[0-9a-fA-F]{24}$/.test(data.requestId) || !/^[0-9a-fA-F]{24}$/.test(data.productId)) {
      console.error(`factoryInventoryAPI.allocateToBranch - Invalid request ID or product ID at ${new Date().toISOString()}:`, data);
      throw new Error('Invalid request ID or product ID');
    }
    console.log(`factoryInventoryAPI.allocateToBranch - Sending at ${new Date().toISOString()}:`, data);
    const response = await api.post('/factory-inventory/allocate', data);
    console.log(`factoryInventoryAPI.allocateToBranch - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
  getRestockRequests: async () => {
    const response = await api.get('/factory-inventory/restock-requests');
    console.log(`factoryInventoryAPI.getRestockRequests - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
  approveRestockRequest: async (requestId: string, data: { approvedQuantity: number }) => {
    if (!/^[0-9a-fA-F]{24}$/.test(requestId)) {
      console.error(`factoryInventoryAPI.approveRestockRequest - Invalid request ID at ${new Date().toISOString()}:`, requestId);
      throw new Error('Invalid request ID');
    }
    console.log(`factoryInventoryAPI.approveRestockRequest - Sending at ${new Date().toISOString()}:`, { requestId, data });
    const response = await api.patch(`/factory-inventory/restock-requests/${requestId}/approve`, data);
    console.log(`factoryInventoryAPI.approveRestockRequest - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
  getHistory: async (params: { productId?: string } = {}) => {
    const response = await api.get('/factory-inventory/history', { params });
    console.log(`factoryInventoryAPI.getHistory - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
  getByBranch: async (branchId: string) => {
    if (!/^[0-9a-fA-F]{24}$/.test(branchId)) {
      console.error(`factoryInventoryAPI.getByBranch - Invalid branch ID at ${new Date().toISOString()}:`, branchId);
      throw new Error('Invalid branch ID');
    }
    const response = await api.get(`/inventory/branch/${branchId}`);
    console.log(`factoryInventoryAPI.getByBranch - Response at ${new Date().toISOString()}:`, response);
    return response;
  },
};

export { notificationsAPI, returnsAPI, salesAPI };
export default api;