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
    let message = error.response?.data?.message || (isRtl ? 'خطأ غير متوقع' : 'Unexpected error');
    if (error.response?.status === 400) {
      message = error.response?.data?.message || (isRtl ? 'بيانات غير صالحة' : 'Invalid data');
      if (error.response?.data?.field) {
        message = `${message}: ${error.response.data.field} = ${error.response.data.value}`;
      }
    }
    if (error.response?.status === 403) message = error.response?.data?.message || (isRtl ? 'عملية غير مصرح بها' : 'Unauthorized operation');
    if (error.response?.status === 404) message = error.response?.data?.message || (isRtl ? 'المورد غير موجود' : 'Resource not found');
    if (error.response?.status === 429) message = isRtl ? 'طلبات كثيرة جدًا، حاول مرة أخرى لاحقًا' : 'Too many requests, try again later';
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
  getAll: async (params: { department?: string; search?: string; page?: number; limit?: number } = {}) => {
    if (params.department && !isValidObjectId(params.department)) {
      console.error(`[${new Date().toISOString()}] productsAPI.getAll - Invalid department ID:`, params.department);
      throw new Error(isRtl ? 'معرف القسم غير صالح' : 'Invalid department ID');
    }
    const response = await api.get('/products', { params });
    console.log(`[${new Date().toISOString()}] productsAPI.getAll - Response:`, response);
    return response; // Returns { data: Product[], totalPages: number, currentPage: number, totalItems: number }
  },
  getById: async (id: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] productsAPI.getById - Invalid product ID:`, id);
      throw new Error(isRtl ? 'معرف المنتج غير صالح' : 'Invalid product ID');
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
    unit: string;
    unitEn?: string;
    description?: string;
  }) => {
    if (!isValidObjectId(productData.department)) {
      console.error(`[${new Date().toISOString()}] productsAPI.create - Invalid department ID:`, productData.department);
      throw new Error(isRtl ? 'معرف القسم غير صالح' : 'Invalid department ID');
    }
    const response = await api.post('/products', {
      name: productData.name.trim(),
      nameEn: productData.nameEn?.trim(),
      code: productData.code.trim(),
      department: productData.department,
      price: productData.price,
      unit: productData.unit?.trim(),
      unitEn: productData.unitEn?.trim(),
      description: productData.description?.trim(),
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
    unit: string;
    unitEn?: string;
    description: string;
  }>) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] productsAPI.update - Invalid product ID:`, id);
      throw new Error(isRtl ? 'معرف المنتج غير صالح' : 'Invalid product ID');
    }
    if (productData.department && !isValidObjectId(productData.department)) {
      console.error(`[${new Date().toISOString()}] productsAPI.update - Invalid department ID:`, productData.department);
      throw new Error(isRtl ? 'معرف القسم غير صالح' : 'Invalid department ID');
    }
    const response = await api.put(`/products/${id}`, {
      name: productData.name?.trim(),
      nameEn: productData.nameEn?.trim(),
      code: productData.code?.trim(),
      department: productData.department,
      price: productData.price,
      unit: productData.unit?.trim(),
      unitEn: productData.unitEn?.trim(),
      description: productData.description?.trim(),
    });
    console.log(`[${new Date().toISOString()}] productsAPI.update - Response:`, response);
    return response;
  },
  delete: async (id: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] productsAPI.delete - Invalid product ID:`, id);
      throw new Error(isRtl ? 'معرف المنتج غير صالح' : 'Invalid product ID');
    }
    const response = await api.delete(`/products/${id}`);
    console.log(`[${new Date().toISOString()}] productsAPI.delete - Response:`, response);
    return response;
  },
};

export const branchesAPI = {
  getAll: async () => {
    const response = await api.get('/branches');
    console.log(`[${new Date().toISOString()}] branchesAPI.getAll - Response:`, response);
    return response;
  },
  getById: async (id: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] branchesAPI.getById - Invalid branch ID:`, id);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
    }
    const response = await api.get(`/branches/${id}`);
    console.log(`[${new Date().toISOString()}] branchesAPI.getById - Response:`, response);
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
    console.log(`[${new Date().toISOString()}] branchesAPI.create - Response:`, response);
    return response;
  },
  update: async (id: string, branchData: Partial<{
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
  }>) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] branchesAPI.update - Invalid branch ID:`, id);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
    }
    const response = await api.put(`/branches/${id}`, {
      name: branchData.name?.trim(),
      nameEn: branchData.nameEn?.trim(),
      code: branchData.code?.trim(),
      address: branchData.address?.trim(),
      addressEn: branchData.addressEn?.trim(),
      city: branchData.city?.trim(),
      cityEn: branchData.cityEn?.trim(),
      phone: branchData.phone?.trim(),
      user: branchData.user
        ? {
            name: branchData.user.name?.trim(),
            nameEn: branchData.user.nameEn?.trim(),
            username: branchData.user.username?.trim(),
            email: branchData.user.email?.trim(),
            phone: branchData.user.phone?.trim(),
            isActive: branchData.user.isActive ?? true,
          }
        : undefined,
    });
    console.log(`[${new Date().toISOString()}] branchesAPI.update - Response:`, response);
    return response;
  },
  delete: async (id: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] branchesAPI.delete - Invalid branch ID:`, id);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
    }
    const response = await api.delete(`/branches/${id}`);
    console.log(`[${new Date().toISOString()}] branchesAPI.delete - Response:`, response);
    return response;
  },
  checkEmail: async (email: string) => {
    const response = await api.post('/branches/check-email', { email: email.trim() });
    console.log(`[${new Date().toISOString()}] branchesAPI.checkEmail - Response:`, response);
    return response;
  },
  resetPassword: async (id: string, password: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] branchesAPI.resetPassword - Invalid branch ID:`, id);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
    }
    const response = await api.post(`/branches/${id}/reset-password`, { password });
    console.log(`[${new Date().toISOString()}] branchesAPI.resetPassword - Response:`, response);
    return response;
  },
};

export const usersAPI = {
  getAll: async () => {
    const response = await api.get('/users');
    console.log(`[${new Date().toISOString()}] usersAPI.getAll - Response:`, response);
    return response;
  },
  getById: async (id: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] usersAPI.getById - Invalid user ID:`, id);
      throw new Error(isRtl ? 'معرف المستخدم غير صالح' : 'Invalid user ID');
    }
    const response = await api.get(`/users/${id}`);
    console.log(`[${new Date().toISOString()}] usersAPI.getById - Response:`, response);
    return response;
  },
  create: async (userData: {
    name: string;
    nameEn?: string;
    username: string;
    password: string;
    email?: string;
    phone?: string;
    role: 'admin' | 'branch' | 'production';
    branch?: string;
    isActive?: boolean;
  }) => {
    if (userData.role === 'branch' && !isValidObjectId(userData.branch)) {
      console.error(`[${new Date().toISOString()}] usersAPI.create - Invalid branch ID:`, userData.branch);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
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
      isActive: userData.isActive ?? true,
    });
    console.log(`[${new Date().toISOString()}] usersAPI.create - Response:`, response);
    return response;
  },
  update: async (id: string, userData: Partial<{
    name: string;
    nameEn?: string;
    username: string;
    email?: string;
    phone?: string;
    role: 'admin' | 'branch' | 'production';
    branch?: string;
    isActive?: boolean;
  }>) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] usersAPI.update - Invalid user ID:`, id);
      throw new Error(isRtl ? 'معرف المستخدم غير صالح' : 'Invalid user ID');
    }
    if (userData.role === 'branch' && userData.branch && !isValidObjectId(userData.branch)) {
      console.error(`[${new Date().toISOString()}] usersAPI.update - Invalid branch ID:`, userData.branch);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
    }
    const response = await api.put(`/users/${id}`, {
      name: userData.name?.trim(),
      nameEn: userData.nameEn?.trim(),
      username: userData.username?.trim(),
      email: userData.email?.trim(),
      phone: userData.phone?.trim(),
      role: userData.role,
      branch: userData.branch,
      isActive: userData.isActive ?? true,
    });
    console.log(`[${new Date().toISOString()}] usersAPI.update - Response:`, response);
    return response;
  },
  delete: async (id: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] usersAPI.delete - Invalid user ID:`, id);
      throw new Error(isRtl ? 'معرف المستخدم غير صالح' : 'Invalid user ID');
    }
    const response = await api.delete(`/users/${id}`);
    console.log(`[${new Date().toISOString()}] usersAPI.delete - Response:`, response);
    return response;
  },
  checkEmail: async (email: string) => {
    const response = await api.post('/users/check-email', { email: email.trim() });
    console.log(`[${new Date().toISOString()}] usersAPI.checkEmail - Response:`, response);
    return response;
  },
  resetPassword: async (id: string, password: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] usersAPI.resetPassword - Invalid user ID:`, id);
      throw new Error(isRtl ? 'معرف المستخدم غير صالح' : 'Invalid user ID');
    }
    const response = await api.post(`/users/${id}/reset-password`, { password });
    console.log(`[${new Date().toISOString()}] usersAPI.resetPassword - Response:`, response);
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
    const response = await axios.post(`${API_BASE_URL}/orders`, orderData, {
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
    });
    console.log(`ordersAPI.create - Response at ${new Date().toISOString()}:`, response.data);
    return response.data;
  },

  getAll: async (params: { status?: string; branch?: string; page?: number; limit?: number; department?: string; search?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' } = {}) => {
    const response = await axios.get(`${API_BASE_URL}/orders`, { 
      params,
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    console.log(`ordersAPI.getAll - Response at ${new Date().toISOString()}:`, response.data);
    return response.data;
  },

  getById: async (id: string) => {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error(`ordersAPI.getById - Invalid order ID at ${new Date().toISOString()}:`, id);
      throw new Error('Invalid order ID');
    }
    const response = await axios.get(`${API_BASE_URL}/orders/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    console.log(`ordersAPI.getById - Response at ${new Date().toISOString()}:`, response.data);
    return response.data;
  },

  updateStatus: async (id: string, data: { status: string; notes?: string }) => {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error(`ordersAPI.updateStatus - Invalid order ID at ${new Date().toISOString()}:`, id);
      throw new Error('Invalid order ID');
    }
    const response = await axios.patch(`${API_BASE_URL}/orders/${id}/status`, data, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    console.log(`ordersAPI.updateStatus - Response at ${new Date().toISOString()}:`, response.data);
    return response.data;
  },

  updateChefItem: async (orderId: string, data: { taskId: string; status: string }) => {
    if (!/^[0-9a-fA-F]{24}$/.test(orderId) || !/^[0-9a-fA-F]{24}$/.test(data.taskId)) {
      console.error(`ordersAPI.updateChefItem - Invalid order ID or task ID at ${new Date().toISOString()}:`, { orderId, taskId: data.taskId });
      throw new Error('Invalid order ID or task ID');
    }
    const response = await axios.patch(`${API_BASE_URL}/orders/${orderId}/tasks/${data.taskId}/status`, { status: data.status }, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    console.log(`ordersAPI.updateChefItem - Response at ${new Date().toISOString()}:`, response.data);
    return response.data;
  },

  assignChef: async (orderId: string, data: { items: Array<{ itemId: string; assignedTo: string }> }) => {
    console.log(`[${new Date().toISOString()}] ordersAPI.assignChef - Sending:`, { orderId, data });
    if (!/^[0-9a-fA-F]{24}$/.test(orderId) || data.items.some(item => !/^[0-9a-fA-F]{24}$/.test(item.itemId) || !/^[0-9a-fA-F]{24}$/.test(item.assignedTo))) {
      console.error(`[${new Date().toISOString()}] ordersAPI.assignChef - بيانات غير صالحة:`, { orderId, data });
      throw new Error('معرف الطلب أو معرف العنصر أو معرف الشيف غير صالح');
    }
    const response = await axios.patch(`${API_BASE_URL}/orders/${orderId}/assign`, {
      items: data.items,
      timestamp: new Date().toISOString(),
    }, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    console.log(`[${new Date().toISOString()}] ordersAPI.assignChef - Response:`, response.data);
    return response.data;
  },

  confirmDelivery: async (orderId: string) => {
    if (!/^[0-9a-fA-F]{24}$/.test(orderId)) {
      console.error(`ordersAPI.confirmDelivery - Invalid order ID at ${new Date().toISOString()}:`, orderId);
      throw new Error('Invalid order ID');
    }
    console.log(`ordersAPI.confirmDelivery - Sending at ${new Date().toISOString()}:`, { orderId });
    const response = await axios.patch(`${API_BASE_URL}/orders/${orderId}/confirm-delivery`, {}, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    console.log(`ordersAPI.confirmDelivery - Response at ${new Date().toISOString()}:`, response.data);
    return response.data;
  },
};


export const departmentAPI = {
  getAll: async (params: { page?: number; limit?: number; search?: string } = {}) => {
    const response = await api.get('/departments', { params });
    console.log(`[${new Date().toISOString()}] departmentAPI.getAll - Response:`, response);
    return response;
  },
  getById: async (id: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] departmentAPI.getById - Invalid department ID:`, id);
      throw new Error(isRtl ? 'معرف القسم غير صالح' : 'Invalid department ID');
    }
    const response = await api.get(`/departments/${id}`);
    console.log(`[${new Date().toISOString()}] departmentAPI.getById - Response:`, response);
    return response;
  },
  create: async (departmentData: {
    name: string;
    nameEn?: string;
    code: string;
    description?: string;
  }) => {
    const response = await api.post('/departments', {
      name: departmentData.name.trim(),
      nameEn: departmentData.nameEn?.trim(),
      code: departmentData.code.trim(),
      description: departmentData.description?.trim(),
    });
    console.log(`[${new Date().toISOString()}] departmentAPI.create - Response:`, response);
    return response;
  },
  update: async (id: string, departmentData: Partial<{
    name: string;
    nameEn?: string;
    code: string;
    description: string;
  }>) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] departmentAPI.update - Invalid department ID:`, id);
      throw new Error(isRtl ? 'معرف القسم غير صالح' : 'Invalid department ID');
    }
    const response = await api.put(`/departments/${id}`, {
      name: departmentData.name?.trim(),
      nameEn: departmentData.nameEn?.trim(),
      code: departmentData.code?.trim(),
      description: departmentData.description?.trim(),
    });
    console.log(`[${new Date().toISOString()}] departmentAPI.update - Response:`, response);
    return response;
  },
  delete: async (id: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] departmentAPI.delete - Invalid department ID:`, id);
      throw new Error(isRtl ? 'معرف القسم غير صالح' : 'Invalid department ID');
    }
    const response = await api.delete(`/departments/${id}`);
    console.log(`[${new Date().toISOString()}] departmentAPI.delete - Response:`, response);
    return response;
  },
};
export const chefsAPI = {
  getAll: async (params = { isRtl: true }) => {
    try {
      const response = await api.get('/chefs', { params });
      console.log(`[${new Date().toISOString()}] chefsAPI.getAll - Response:`, response.data);
      return response.data;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] chefsAPI.getAll - Error:`, err.response?.data || err.message);
      throw new Error(err.response?.data?.message || 'Failed to fetch chefs');
    }
  },
  getById: async (id: string, params = { isRtl: true }) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] chefsAPI.getById - Invalid chef ID:`, id);
      throw new Error('Invalid chef ID');
    }
    try {
      const response = await api.get(`/chefs/${id}`, { params });
      console.log(`[${new Date().toISOString()}] chefsAPI.getById - Response:`, response.data);
      return response.data;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] chefsAPI.getById - Error:`, err.response?.data || err.message);
      throw new Error(err.response?.data?.message || 'Failed to fetch chef');
    }
  },
  getByUserId: async (userId: string, params = { isRtl: true }) => {
    if (!isValidObjectId(userId)) {
      console.error(`[${new Date().toISOString()}] chefsAPI.getByUserId - Invalid user ID:`, userId);
      throw new Error('Invalid user ID');
    }
    try {
      const response = await api.get(`/chefs/by-user/${userId}`, { params });
      console.log(`[${new Date().toISOString()}] chefsAPI.getByUserId - Response:`, response.data);
      return response.data;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] chefsAPI.getByUserId - Error:`, err.response?.data || err.message);
      throw new Error(err.response?.data?.message || 'Failed to fetch chef by user ID');
    }
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
    try {
      const response = await api.post('/chefs', {
        user: {
          name: chefData.user.name.trim(),
          nameEn: chefData.user.nameEn?.trim(),
          username: chefData.user.username.trim(),
          email: chefData.user.email?.trim(),
          phone: chefData.user.phone?.trim(),
          password: chefData.user.password,
          role: 'chef',
          isActive: chefData.user.isActive ?? true,
        },
        department: chefData.department,
      });
      console.log(`[${new Date().toISOString()}] chefsAPI.create - Response:`, response.data);
      return response.data;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] chefsAPI.create - Error:`, err.response?.data || err.message);
      throw new Error(err.response?.data?.message || 'Failed to create chef');
    }
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
    try {
      const response = await api.put(`/chefs/${id}`, {
        user: {
          name: chefData.user.name.trim(),
          nameEn: chefData.user.nameEn?.trim(),
          username: chefData.user.username.trim(),
          email: chefData.user.email?.trim() || undefined,
          phone: chefData.user.phone?.trim() || undefined,
          isActive: chefData.user.isActive ?? true,
        },
        department: chefData.department,
      });
      console.log(`[${new Date().toISOString()}] chefsAPI.update - Response:`, response.data);
      return response.data;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] chefsAPI.update - Error:`, err.response?.data || err.message);
      throw new Error(err.response?.data?.message || 'Failed to update chef');
    }
  },
  delete: async (id: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] chefsAPI.delete - Invalid chef ID:`, id);
      throw new Error('Invalid chef ID');
    }
    try {
      const response = await api.delete(`/chefs/${id}`);
      console.log(`[${new Date().toISOString()}] chefsAPI.delete - Response:`, response.data);
      return response.data;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] chefsAPI.delete - Error:`, err.response?.data || err.message);
      throw new Error(err.response?.data?.message || 'Failed to delete chef');
    }
  },
  resetPassword: async (id: string, password: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] chefsAPI.resetPassword - Invalid chef ID:`, id);
      throw new Error('Invalid chef ID');
    }
    try {
      const response = await api.post(`/chefs/${id}/reset-password`, { password });
      console.log(`[${new Date().toISOString()}] chefsAPI.resetPassword - Response:`, response.data);
      return response.data;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] chefsAPI.resetPassword - Error:`, err.response?.data || err.message);
      throw new Error(err.response?.data?.message || 'Failed to reset password');
    }
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
  getInventory: async (params: { branch?: string; product?: string } = {}) => {
    if (params.branch && !isValidObjectId(params.branch)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getInventory - Invalid branch ID:`, params.branch);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
    }
    if (params.product && !isValidObjectId(params.product)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getInventory - Invalid product ID:`, params.product);
      throw new Error(isRtl ? 'معرف المنتج غير صالح' : 'Invalid product ID');
    }
    const response = await api.get('/inventory', { params });
    console.log(`[${new Date().toISOString()}] inventoryAPI.getInventory - Response:`, response);
    return response.inventory;
  },
  getByBranch: async (branchId: string) => {
    if (!isValidObjectId(branchId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getByBranch - Invalid branch ID:`, branchId);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
    }
    const response = await api.get(`/inventory/branch/${branchId}`);
    console.log(`[${new Date().toISOString()}] inventoryAPI.getByBranch - Response:`, response);
    return response.inventory;
  },
  getAll: async (params: { branch?: string; product?: string } = {}) => {
    if (params.branch && !isValidObjectId(params.branch)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getAll - Invalid branch ID:`, params.branch);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
    }
    if (params.product && !isValidObjectId(params.product)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getAll - Invalid product ID:`, params.product);
      throw new Error(isRtl ? 'معرف المنتج غير صالح' : 'Invalid product ID');
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
      console.error(`[${new Date().toISOString()}] inventoryAPI.create - Invalid data:`, data);
      throw new Error(isRtl ? 'معرف الفرع، المنتج، المستخدم، أو الطلب غير صالح' : 'Invalid branch ID, product ID, user ID, or order ID');
    }
    if (data.currentStock < 0) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.create - Invalid stock quantity:`, data.currentStock);
      throw new Error(isRtl ? 'كمية المخزون لا يمكن أن تكون سالبة' : 'Stock quantity cannot be negative');
    }
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
      console.error(`[${new Date().toISOString()}] inventoryAPI.bulkCreate - Invalid data:`, data);
      throw new Error(isRtl ? 'معرف الفرع، المستخدم، الطلب، أو العناصر غير صالحة' : 'Invalid branch ID, user ID, order ID, or items');
    }
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
      throw new Error(isRtl ? 'معرف المخزون، المنتج، أو الفرع غير صالح' : 'Invalid inventory ID, product ID, or branch ID');
    }
    if (data.currentStock !== undefined && data.currentStock < 0) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStock - Invalid stock quantity:`, data.currentStock);
      throw new Error(isRtl ? 'كمية المخزون لا يمكن أن تكون سالبة' : 'Stock quantity cannot be negative');
    }
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
      console.error(`[${new Date().toISOString()}] inventoryAPI.processReturnItems - Invalid data:`, { returnId, data });
      throw new Error(isRtl ? 'معرف الإرجاع، الفرع، أو العناصر غير صالحة' : 'Invalid return ID, branch ID, or items');
    }
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
      console.error(`[${new Date().toISOString()}] inventoryAPI.createRestockRequest - Invalid data:`, data);
      throw new Error(isRtl ? 'معرف المنتج، الفرع، أو الكمية المطلوبة غير صالحة' : 'Invalid product ID, branch ID, or requested quantity');
    }
    const response = await api.post('/inventory/restock-requests', {
      productId: data.productId,
      branchId: data.branchId,
      requestedQuantity: data.requestedQuantity,
      notes: data.notes?.trim(),
    });
    console.log(`[${new Date().toISOString()}] inventoryAPI.createRestockRequest - Response:`, response);
    return response.restockRequest;
  },
  getRestockRequests: async (params: { branchId?: string } = {}) => {
    if (params.branchId && !isValidObjectId(params.branchId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getRestockRequests - Invalid branch ID:`, params.branchId);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
    }
    const response = await api.get('/inventory/restock-requests', { params });
    console.log(`[${new Date().toISOString()}] inventoryAPI.getRestockRequests - Response:`, response);
    return response.restockRequests;
  },
  approveRestockRequest: async (requestId: string, data: { approvedQuantity: number; userId: string }) => {
    if (!isValidObjectId(requestId) || !isValidObjectId(data.userId) || data.approvedQuantity < 1) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.approveRestockRequest - Invalid data:`, { requestId, data });
      throw new Error(isRtl ? 'معرف الطلب، المستخدم، أو الكمية المعتمدة غير صالحة' : 'Invalid request ID, user ID, or approved quantity');
    }
    const response = await api.patch(`/inventory/restock-requests/${requestId}/approve`, {
      approvedQuantity: data.approvedQuantity,
      userId: data.userId,
    });
    console.log(`[${new Date().toISOString()}] inventoryAPI.approveRestockRequest - Response:`, response);
    return response.restockRequest;
  },
  getHistory: async (params: { branchId?: string; productId?: string } = {}) => {
    if (params.branchId && !isValidObjectId(params.branchId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getHistory - Invalid branch ID:`, params.branchId);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
    }
    if (params.productId && !isValidObjectId(params.productId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getHistory - Invalid product ID:`, params.productId);
      throw new Error(isRtl ? 'معرف المنتج غير صالح' : 'Invalid product ID');
    }
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
      console.error(`[${new Date().toISOString()}] inventoryAPI.createReturn - Invalid data:`, data);
      throw new Error(isRtl ? 'معرف الطلب، الفرع، السبب، أو العناصر غير صالحة' : 'Invalid order ID, branch ID, reason, or items');
    }
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
    if (params.product && !isValidObjectId(params.product)) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.getAll - Invalid product ID:`, params.product);
      throw new Error(isRtl ? 'معرف المنتج غير صالح' : 'Invalid product ID');
    }
    if (params.department && !isValidObjectId(params.department)) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.getAll - Invalid department ID:`, params.department);
      throw new Error(isRtl ? 'معرف القسم غير صالح' : 'Invalid department ID');
    }
    const response = await api.get('/factory-inventory', { params });
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.getAll - Response:`, response);
    return response;
  },
  addProductionBatch: async (data: { productId: string; quantity: number }) => {
    if (!isValidObjectId(data.productId)) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.addProductionBatch - Invalid product ID:`, data.productId);
      throw new Error(isRtl ? 'معرف المنتج غير صالح' : 'Invalid product ID');
    }
    if (data.quantity < 1) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.addProductionBatch - Invalid quantity:`, data.quantity);
      throw new Error(isRtl ? 'الكمية غير صالحة' : 'Invalid quantity');
    }
    const response = await api.post('/factory-inventory/production', data);
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.addProductionBatch - Response:`, response);
    return response;
  },
  allocateToBranch: async (data: { requestId: string; productId: string; allocatedQuantity: number }) => {
    if (!isValidObjectId(data.requestId) || !isValidObjectId(data.productId)) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.allocateToBranch - Invalid request ID or product ID:`, data);
      throw new Error(isRtl ? 'معرف الطلب أو المنتج غير صالح' : 'Invalid request ID or product ID');
    }
    if (data.allocatedQuantity < 1) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.allocateToBranch - Invalid quantity:`, data.allocatedQuantity);
      throw new Error(isRtl ? 'الكمية المخصصة غير صالحة' : 'Invalid allocated quantity');
    }
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
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.approveRestockRequest - Invalid request ID:`, requestId);
      throw new Error(isRtl ? 'معرف الطلب غير صالح' : 'Invalid request ID');
    }
    if (data.approvedQuantity < 1) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.approveRestockRequest - Invalid approved quantity:`, data.approvedQuantity);
      throw new Error(isRtl ? 'الكمية المعتمدة غير صالحة' : 'Invalid approved quantity');
    }
    const response = await api.patch(`/factory-inventory/restock-requests/${requestId}/approve`, data);
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.approveRestockRequest - Response:`, response);
    return response;
  },
  getHistory: async (params: { productId?: string } = {}) => {
    if (params.productId && !isValidObjectId(params.productId)) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.getHistory - Invalid product ID:`, params.productId);
      throw new Error(isRtl ? 'معرف المنتج غير صالح' : 'Invalid product ID');
    }
    const response = await api.get('/factory-inventory/history', { params });
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.getHistory - Response:`, response);
    return response;
  },
  getByBranch: async (branchId: string) => {
    if (!isValidObjectId(branchId)) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.getByBranch - Invalid branch ID:`, branchId);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
    }
    const response = await api.get(`/inventory/branch/${branchId}`);
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.getByBranch - Response:`, response);
    return response;
  },
};

export { notificationsAPI, returnsAPI, salesAPI };
export default api;