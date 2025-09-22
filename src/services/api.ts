import axios from 'axios';
import { notificationsAPI } from './notifications';
import { returnsAPI } from './returnsAPI';
import { salesAPI } from './salesAPI';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';
const isRtl = localStorage.getItem('language') === 'ar'; // Assuming language is stored in localStorage

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  params: { isRtl: isRtl.toString() }, // Add isRtl globally
});

const isValidObjectId = (id: string): boolean => /^[0-9a-fA-F]{24}$/.test(id);

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
      params: config.params,
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
    if (error.response?.status === 400) {
      message = error.response?.data?.message || 'بيانات غير صالحة';
      if (error.response?.data?.field) {
        message = `${message}: ${error.response.data.field} = ${error.response.data.value}`;
      }
    }
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
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] Branches getById - Invalid branch ID:`, id);
      throw new Error('Invalid branch ID');
    }
    const response = await api.get(`/branches/${id}`);
    console.log(`[${new Date().toISOString()}] Branches getById response:`, response);
    return response;
  },
  create: async (branchData: {
    name: string;
    nameEn?: string;
    code: string;
    address: string;
    city: string;
    phone?: string;
    user: {
      name: string;
      nameEn?: string;
      username: string;
      password: string;
      email?: string;
      phone?: string;
      isActive?: boolean;
    };
  }) => {
    const response = await api.post('/branches', {
      name: branchData.name.trim(),
      nameEn: branchData.nameEn?.trim(),
      code: branchData.code.trim(),
      address: branchData.address.trim(),
      city: branchData.city.trim(),
      phone: branchData.phone?.trim(),
      user: {
        name: branchData.user.name.trim(),
        nameEn: branchData.user.nameEn?.trim(),
        username: branchData.user.username.trim(),
        password: branchData.user.password,
        email: branchData.user.email?.trim(),
        phone: branchData.user.phone?.trim(),
        isActive: branchData.user.isActive ?? true,
      },
    });
    console.log(`[${new Date().toISOString()}] Branches create response:`, response);
    return response;
  },
  update: async (id: string, branchData: {
    name: string;
    nameEn?: string;
    code: string;
    address: string;
    city: string;
    phone?: string;
    user: {
      name: string;
      nameEn?: string;
      username: string;
      email?: string;
      phone?: string;
      isActive?: boolean;
    };
  }) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] Branches update - Invalid branch ID:`, id);
      throw new Error('Invalid branch ID');
    }
    const response = await api.put(`/branches/${id}`, {
      name: branchData.name.trim(),
      nameEn: branchData.nameEn?.trim(),
      code: branchData.code.trim(),
      address: branchData.address.trim(),
      city: branchData.city.trim(),
      phone: branchData.phone?.trim(),
      user: {
        name: branchData.user.name.trim(),
        nameEn: branchData.user.nameEn?.trim(),
        username: branchData.user.username.trim(),
        email: branchData.user.email?.trim(),
        phone: branchData.user.phone?.trim(),
        isActive: branchData.user.isActive ?? true,
      },
    });
    console.log(`[${new Date().toISOString()}] Branches update response:`, response);
    return response;
  },
  delete: async (id: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] Branches delete - Invalid branch ID:`, id);
      throw new Error('Invalid branch ID');
    }
    const response = await api.delete(`/branches/${id}`);
    console.log(`[${new Date().toISOString()}] Branches delete response:`, response);
    return response;
  },
  checkEmail: async (email: string) => {
    const response = await api.post('/branches/check-email', { email: email.trim() });
    console.log(`[${new Date().toISOString()}] Branches checkEmail response:`, response);
    return response;
  },
  resetPassword: async (id: string, password: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] Branches resetPassword - Invalid branch ID:`, id);
      throw new Error('Invalid branch ID');
    }
    const response = await api.post(`/branches/${id}/reset-password`, { password });
    console.log(`[${new Date().toISOString()}] Branches resetPassword response:`, response);
    return response;
  },
};

export const usersAPI = {
  getAll: async () => {
    const response = await api.get('/users');
    console.log(`[${new Date().toISOString()}] Users getAll response:`, response);
    return response;
  },
  getById: async (id: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] Users getById - Invalid user ID:`, id);
      throw new Error('Invalid user ID');
    }
    const response = await api.get(`/users/${id}`);
    console.log(`[${new Date().toISOString()}] Users getById response:`, response);
    return response;
  },
  create: async (userData: {
    name: string;
    nameEn?: string;
    username: string;
    password: string;
    email?: string;
    phone?: string;
    role: 'admin' | 'branch' | 'chef' | 'production';
    branch?: string;
    department?: string;
    isActive?: boolean;
  }) => {
    if (userData.role === 'branch' && !isValidObjectId(userData.branch)) {
      console.error(`[${new Date().toISOString()}] Users create - Invalid branch ID:`, userData.branch);
      throw new Error('Invalid branch ID');
    }
    if (userData.role === 'chef' && !isValidObjectId(userData.department)) {
      console.error(`[${new Date().toISOString()}] Users create - Invalid department ID:`, userData.department);
      throw new Error('Invalid department ID');
    }
    const response = await api.post('/users', {
      name: userData.name.trim(),
      nameEn: userData.nameEn?.trim(),
      username: userData.username.trim(),
      password: userData.password,
      email: userData.email?.trim(),
      phone: userData.phone?.trim(),
      role: userData.role,
      branch: userData.branch,
      department: userData.department,
      isActive: userData.isActive ?? true,
    });
    console.log(`[${new Date().toISOString()}] Users create response:`, response);
    return response;
  },
  update: async (id: string, userData: {
    name: string;
    nameEn?: string;
    username: string;
    email?: string;
    phone?: string;
    role: 'admin' | 'branch' | 'chef' | 'production';
    branch?: string;
    department?: string;
    isActive?: boolean;
  }) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] Users update - Invalid user ID:`, id);
      throw new Error('Invalid user ID');
    }
    if (userData.role === 'branch' && !isValidObjectId(userData.branch)) {
      console.error(`[${new Date().toISOString()}] Users update - Invalid branch ID:`, userData.branch);
      throw new Error('Invalid branch ID');
    }
    if (userData.role === 'chef' && !isValidObjectId(userData.department)) {
      console.error(`[${new Date().toISOString()}] Users update - Invalid department ID:`, userData.department);
      throw new Error('Invalid department ID');
    }
    const response = await api.put(`/users/${id}`, {
      name: userData.name.trim(),
      nameEn: userData.nameEn?.trim(),
      username: userData.username.trim(),
      email: userData.email?.trim(),
      phone: userData.phone?.trim(),
      role: userData.role,
      branch: userData.branch,
      department: userData.department,
      isActive: userData.isActive ?? true,
    });
    console.log(`[${new Date().toISOString()}] Users update response:`, response);
    return response;
  },
  delete: async (id: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] Users delete - Invalid user ID:`, id);
      throw new Error('Invalid user ID');
    }
    const response = await api.delete(`/users/${id}`);
    console.log(`[${new Date().toISOString()}] Users delete response:`, response);
    return response;
  },
  checkEmail: async (email: string) => {
    const response = await api.post('/users/check-email', { email: email.trim() });
    console.log(`[${new Date().toISOString()}] Users checkEmail response:`, response);
    return response;
  },
  resetPassword: async (id: string, password: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] Users resetPassword - Invalid user ID:`, id);
      throw new Error('Invalid user ID');
    }
    const response = await api.post(`/users/${id}/reset-password`, { password });
    console.log(`[${new Date().toISOString()}] Users resetPassword response:`, response);
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
    if (!isValidObjectId(orderData.branchId)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.create - Invalid branchId:`, orderData.branchId);
      throw new Error('Invalid branch ID');
    }
    const response = await api.post('/orders', orderData);
    console.log(`[${new Date().toISOString()}] ordersAPI.create - Response:`, response);
    return response;
  },
  getAll: async (params: { status?: string; branch?: string; page?: number; limit?: number; department?: string; search?: string; sortBy?: string; sortOrder: 'asc' | 'desc' } = {}) => {
    if (params.branch && !isValidObjectId(params.branch)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.getAll - Invalid branch ID:`, params.branch);
      throw new Error('Invalid branch ID');
    }
    const response = await api.get('/orders', { params });
    console.log(`[${new Date().toISOString()}] ordersAPI.getAll - Response:`, response);
    return response;
  },
  getById: async (id: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.getById - Invalid order ID:`, id);
      throw new Error('Invalid order ID');
    }
    const response = await api.get(`/orders/${id}`);
    console.log(`[${new Date().toISOString()}] ordersAPI.getById - Response:`, response);
    return response;
  },
  updateStatus: async (id: string, data: { status: string; notes?: string }) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.updateStatus - Invalid order ID:`, id);
      throw new Error('Invalid order ID');
    }
    const response = await api.patch(`/orders/${id}/status`, data);
    console.log(`[${new Date().toISOString()}] ordersAPI.updateStatus - Response:`, response);
    return response;
  },
  updateChefItem: async (orderId: string, data: { taskId: string; status: string }) => {
    if (!isValidObjectId(orderId) || !isValidObjectId(data.taskId)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.updateChefItem - Invalid order ID or task ID:`, { orderId, taskId: data.taskId });
      throw new Error('Invalid order ID or task ID');
    }
    const response = await api.patch(`/orders/${orderId}/tasks/${data.taskId}/status`, { status: data.status });
    console.log(`[${new Date().toISOString()}] ordersAPI.updateChefItem - Response:`, response);
    return response;
  },
  assignChef: async (orderId: string, data: { items: Array<{ itemId: string; assignedTo: string }> }) => {
    if (!isValidObjectId(orderId) || data.items.some(item => !isValidObjectId(item.itemId) || !isValidObjectId(item.assignedTo))) {
      console.error(`[${new Date().toISOString()}] ordersAPI.assignChef - Invalid data:`, { orderId, data });
      throw new Error('معرف الطلب أو معرف العنصر أو معرف الشيف غير صالح');
    }
    const response = await api.patch(`/orders/${orderId}/assign`, {
      items: data.items,
      timestamp: new Date().toISOString(),
    });
    console.log(`[${new Date().toISOString()}] ordersAPI.assignChef - Response:`, response);
    return response;
  },
  confirmDelivery: async (orderId: string) => {
    if (!isValidObjectId(orderId)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.confirmDelivery - Invalid order ID:`, orderId);
      throw new Error('Invalid order ID');
    }
    const response = await api.patch(`/orders/${orderId}/confirm-delivery`, {});
    console.log(`[${new Date().toISOString()}] ordersAPI.confirmDelivery - Response:`, response);
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
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] productsAPI.getById - Invalid product ID:`, id);
      throw new Error('Invalid product ID');
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
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] productsAPI.update - Invalid product ID:`, id);
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
    console.log(`[${new Date().toISOString()}] productsAPI.update - Response:`, response);
    return response;
  },
  delete: async (id: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] productsAPI.delete - Invalid product ID:`, id);
      throw new Error('Invalid product ID');
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
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] departmentAPI.update - Invalid department ID:`, id);
      throw new Error('Invalid department ID');
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
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] departmentAPI.delete - Invalid department ID:`, id);
      throw new Error('Invalid department ID');
    }
    const response = await api.delete(`/departments/${id}`);
    console.log(`[${new Date().toISOString()}] departmentAPI.delete - Response:`, response);
    return response;
  },
};

export const chefsAPI = {
  getAll: async () => {
    const response = await api.get('/chefs');
    console.log(`[${new Date().toISOString()}] chefsAPI.getAll - Response:`, response);
    return response;
  },
  getByUserId: async (userId: string) => {
    if (!isValidObjectId(userId)) {
      console.error(`[${new Date().toISOString()}] chefsAPI.getByUserId - Invalid user ID:`, userId);
      throw new Error('Invalid user ID');
    }
    const response = await api.get(`/chefs/by-user/${userId}`);
    console.log(`[${new Date().toISOString()}] chefsAPI.getByUserId - Response:`, response);
    return response;
  },
  create: async (chefData: {
    user: {
      name: string;
      nameEn?: string;
      username: string;
      email?: string;
      phone?: string;
      password: string;
      role: string;
      isActive?: boolean;
    };
    department: string;
  }) => {
    const response = await api.post('/chefs', {
      user: {
        name: chefData.user.name.trim(),
        nameEn: chefData.user.nameEn?.trim(),
        username: chefData.user.username.trim(),
        email: chefData.user.email?.trim(),
        phone: chefData.user.phone?.trim(),
        password: chefData.user.password,
        role: chefData.user.role,
        isActive: chefData.user.isActive ?? true,
      },
      department: chefData.department,
    });
    console.log(`[${new Date().toISOString()}] chefsAPI.create - Response:`, response);
    return response;
  },
  update: async (id: string, chefData: {
    user: {
      name: string;
      nameEn?: string;
      username: string;
      email?: string;
      phone?: string;
      isActive?: boolean;
    };
    department: string;
  }) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] chefsAPI.update - Invalid chef ID:`, id);
      throw new Error('Invalid chef ID');
    }
    const response = await api.put(`/chefs/${id}`, {
      user: {
        name: chefData.user.name.trim(),
        nameEn: chefData.user.nameEn?.trim(),
        username: chefData.user.username.trim(),
        email: chefData.user.email?.trim(),
        phone: chefData.user.phone?.trim(),
        isActive: chefData.user.isActive ?? true,
      },
      department: chefData.department,
    });
    console.log(`[${new Date().toISOString()}] chefsAPI.update - Response:`, response);
    return response;
  },
  delete: async (id: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] chefsAPI.delete - Invalid chef ID:`, id);
      throw new Error('Invalid chef ID');
    }
    const response = await api.delete(`/chefs/${id}`);
    console.log(`[${new Date().toISOString()}] chefsAPI.delete - Response:`, response);
    return response;
  },
  resetPassword: async (id: string, password: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] chefsAPI.resetPassword - Invalid chef ID:`, id);
      throw new Error('Invalid chef ID');
    }
    const response = await api.post(`/chefs/${id}/reset-password`, { password });
    console.log(`[${new Date().toISOString()}] chefsAPI.resetPassword response:`, response);
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
      console.error(`[${new Date().toISOString()}] productionAssignmentsAPI.create - Invalid data:`, assignmentData);
      throw new Error('Invalid order ID, product ID, chef ID, or item ID');
    }
    const response = await api.post('/orders/tasks', assignmentData);
    console.log(`[${new Date().toISOString()}] productionAssignmentsAPI.create - Response:`, response);
    return response;
  },
  getChefTasks: async (chefId: string, query: { page?: number; limit?: number; status?: string; search?: string } = {}) => {
    if (!isValidObjectId(chefId)) {
      console.error(`[${new Date().toISOString()}] productionAssignmentsAPI.getChefTasks - Invalid chefId:`, chefId);
      throw new Error('Invalid chef ID');
    }
    const response = await api.get(`/orders/tasks/chef/${chefId}`, { params: query });
    console.log(`[${new Date().toISOString()}] productionAssignmentsAPI.getChefTasks - Response:`, response);
    return response;
  },
  updateTaskStatus: async (orderId: string, taskId: string, data: { status: string }) => {
    if (!isValidObjectId(orderId) || !isValidObjectId(taskId)) {
      console.error(`[${new Date().toISOString()}] productionAssignmentsAPI.updateTaskStatus - Invalid orderId or taskId:`, { orderId, taskId });
      throw new Error('Invalid order ID or task ID');
    }
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
  // Same as before, no changes needed based on request
};

export const factoryInventoryAPI = {
  // Same as before
};

export { notificationsAPI, returnsAPI, salesAPI };
export default api;