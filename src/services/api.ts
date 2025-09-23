import axios from 'axios';
import { notificationsAPI } from './notifications';
import { returnsAPI } from './returnsAPI';
import { salesAPI } from './salesAPI';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';
const isRtl = localStorage.getItem('language') === 'ar';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  params: { isRtl: isRtl.toString() },
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
        ...response.user,
        id: response.user.id || response.user._id,
      },
    };
  },
  updateProfile: async (data: { name?: string; nameEn?: string; email?: string; phone?: string; password?: string }) => {
    const response = await api.put('/auth/update-profile', {
      name: data.name?.trim(),
      nameEn: data.nameEn?.trim(),
      email: data.email?.trim(),
      phone: data.phone?.trim(),
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

export const productsAPI = {
  getAll: async (params: { department?: string; search?: string; page?: number; limit?: number; isRtl?: boolean } = {}) => {
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
    nameEn?: string;
    code: string;
    department: string;
    price: number;
    description?: string;
    unit?: string;
    unitEn?: string;
  }) => {
    const response = await api.post('/products', {
      name: productData.name.trim(),
      nameEn: productData.nameEn?.trim(),
      code: productData.code.trim(),
      department: productData.department,
      price: productData.price,
      description: productData.description?.trim(),
      unit: productData.unit?.trim(),
      unitEn: productData.unitEn?.trim(),
    });
    console.log(`[${new Date().toISOString()}] productsAPI.create - Response:`, response);
    return response;
  },
  update: async (id: string, productData: Partial<{
    name: string;
    nameEn?: string;
    code: string;
    department: string;
    price: number;
    description: string;
    unit: string;
    unitEn?: string;
  }>) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] productsAPI.update - Invalid product ID:`, id);
      throw new Error('Invalid product ID');
    }
    const response = await api.put(`/products/${id}`, {
      name: productData.name?.trim(),
      nameEn: productData.nameEn?.trim(),
      code: productData.code?.trim(),
      department: productData.department,
      price: productData.price,
      description: productData.description?.trim(),
      unit: productData.unit?.trim(),
      unitEn: productData.unitEn?.trim(),
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
    addressEn?: string;
    city: string;
    cityEn?: string;
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
      addressEn: branchData.addressEn?.trim(),
      city: branchData.city.trim(),
      cityEn: branchData.cityEn?.trim(),
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
    addressEn?: string;
    city: string;
    cityEn?: string;
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
      addressEn: branchData.addressEn?.trim(),
      city: branchData.city.trim(),
      cityEn: branchData.cityEn?.trim(),
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