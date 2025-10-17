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

export const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

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
    const isRtl = localStorage.getItem('language') === 'ar';
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
        const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken });
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
  login: async (credentials) => {
    const response = await api.post('/auth/login', {
      username: credentials.username.trim(),
      password: credentials.password,
    });
    console.log(`[${new Date().toISOString()}] Login response:`, response);
    return response;
  },
  refreshToken: async (refreshToken) => {
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
  updateProfile: async (data) => {
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
  checkEmail: async (email) => {
    const response = await api.post('/auth/check-email', { email: email.trim() });
    console.log(`[${new Date().toISOString()}] Check email response:`, response);
    return response;
  },
};

export const productsAPI = {
  getAll: async (params = {}) => {
    if (params.department && !isValidObjectId(params.department)) {
      console.error(`[${new Date().toISOString()}] productsAPI.getAll - Invalid department ID:`, params.department);
      throw new Error('Invalid department ID');
    }
    const response = await api.get('/products', { params });
    console.log(`[${new Date().toISOString()}] productsAPI.getAll - Response:`, response);
    return response;
  },
  getById: async (id) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] productsAPI.getById - Invalid product ID:`, id);
      throw new Error('Invalid product ID');
    }
    const response = await api.get(`/products/${id}`);
    console.log(`[${new Date().toISOString()}] productsAPI.getById - Response:`, response);
    return response;
  },
  create: async (productData) => {
    if (!isValidObjectId(productData.department)) {
      console.error(`[${new Date().toISOString()}] productsAPI.create - Invalid department ID:`, productData.department);
      throw new Error('Invalid department ID');
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
  update: async (id, productData) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] productsAPI.update - Invalid product ID:`, id);
      throw new Error('Invalid product ID');
    }
    if (productData.department && !isValidObjectId(productData.department)) {
      console.error(`[${new Date().toISOString()}] productsAPI.update - Invalid department ID:`, productData.department);
      throw new Error('Invalid department ID');
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
  delete: async (id) => {
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
  getById: async (id) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] Branches getById - Invalid branch ID:`, id);
      throw new Error('Invalid branch ID');
    }
    const response = await api.get(`/branches/${id}`);
    console.log(`[${new Date().toISOString()}] Branches getById response:`, response);
    return response;
  },
  create: async (branchData) => {
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
  update: async (id, branchData) => {
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
  delete: async (id) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] Branches delete - Invalid branch ID:`, id);
      throw new Error('Invalid branch ID');
    }
    const response = await api.delete(`/branches/${id}`);
    console.log(`[${new Date().toISOString()}] Branches delete response:`, response);
    return response;
  },
  checkEmail: async (email) => {
    const response = await api.post('/branches/check-email', { email: email.trim() });
    console.log(`[${new Date().toISOString()}] Branches checkEmail response:`, response);
    return response;
  },
  resetPassword: async (id, password) => {
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
    console.log(`[${new Date().toISOString()}] usersAPI.getAll - Response:`, response);
    return response;
  },
  getById: async (id) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] usersAPI.getById - Invalid user ID:`, id);
      throw new Error('Invalid user ID');
    }
    const response = await api.get(`/users/${id}`);
    console.log(`[${new Date().toISOString()}] usersAPI.getById - Response:`, response);
    return response;
  },
  create: async (userData) => {
    if (userData.role === 'branch' && userData.branch && !isValidObjectId(userData.branch)) {
      console.error(`[${new Date().toISOString()}] usersAPI.create - Invalid branch ID:`, userData.branch);
      throw new Error('Invalid branch ID');
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
  update: async (id, userData) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] usersAPI.update - Invalid user ID:`, id);
      throw new Error('Invalid user ID');
    }
    if (userData.role === 'branch' && userData.branch && !isValidObjectId(userData.branch)) {
      console.error(`[${new Date().toISOString()}] usersAPI.update - Invalid branch ID:`, userData.branch);
      throw new Error('Invalid branch ID');
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
  delete: async (id) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] usersAPI.delete - Invalid user ID:`, id);
      throw new Error('Invalid user ID');
    }
    const response = await api.delete(`/users/${id}`);
    console.log(`[${new Date().toISOString()}] usersAPI.delete - Response:`, response);
    return response;
  },
  checkEmail: async (email) => {
    const response = await api.post('/users/check-email', { email: email.trim() });
    console.log(`[${new Date().toISOString()}] usersAPI.checkEmail - Response:`, response);
    return response;
  },
  resetPassword: async (id, password) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] usersAPI.resetPassword - Invalid user ID:`, id);
      throw new Error('Invalid user ID');
    }
    const response = await api.post(`/users/${id}/reset-password`, { password });
    console.log(`[${new Date().toISOString()}] usersAPI.resetPassword - Response:`, response);
    return response;
  },
};

const createErrorMessage = (errorType, isRtl) => {
  const messages = {
    invalidBranchId: { ar: 'معرف الفرع غير صالح', en: 'Invalid branch ID' },
    invalidOrderId: { ar: 'معرف الطلب غير صالح', en: 'Invalid order ID' },
    invalidDepartmentId: { ar: 'معرف القسم غير صالح', en: 'Invalid department ID' },
    invalidProductId: { ar: 'معرف المنتج غير صالح', en: 'Invalid product ID' },
    invalidOrderOrTaskId: { ar: 'معرف الطلب أو المهمة غير صالح', en: 'Invalid order or task ID' },
    invalidOrderOrItemOrChefId: { ar: 'معرف الطلب، العنصر، أو الشيف غير صالح', en: 'Invalid order, item, or chef ID' },
    invalidStockQuantity: { ar: 'كمية المخزون يجب أن تكون غير سالبة', en: 'Stock quantity must be non-negative' },
    invalidMinStockLevel: { ar: 'الحد الأدنى للمخزون يجب أن يكون عددًا صحيحًا غير سالب', en: 'Minimum stock level must be a non-negative integer' },
    invalidMaxStockLevel: { ar: 'الحد الأقصى للمخزون يجب أن يكون عددًا صحيحًا غير سالب', en: 'Maximum stock level must be a non-negative integer' },
    maxLessThanMin: { ar: 'الحد الأقصى يجب أن يكون أكبر من الحد الأدنى', en: 'Maximum stock level must be greater than minimum' },
  };
  return isRtl ? messages[errorType].ar : messages[errorType].en;
};

export const ordersAPI = {
  create: async (orderData, isRtl = false) => {
    if (!isValidObjectId(orderData.branchId)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.create - Invalid branchId:`, orderData.branchId);
      throw new Error(createErrorMessage('invalidBranchId', isRtl));
    }
    try {
      const response = await api.post('/orders', {
        orderNumber: orderData.orderNumber.trim(),
        branchId: orderData.branchId,
        items: orderData.items.map(item => ({
          product: item.product,
          quantity: item.quantity,
          price: item.price,
        })),
        status: orderData.status.trim(),
      });
      console.log(`[${new Date().toISOString()}] ordersAPI.create - Response:`, response);
      return response;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ordersAPI.create - Error:`, error.message);
      throw new Error(isRtl ? `فشل في إنشاء الطلب: ${error.message}` : `Failed to create order: ${error.message}`);
    }
  },
  getAll: async (params = {}) => {
    if (params.branch && !isValidObjectId(params.branch)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.getAll - Invalid branch ID:`, params.branch);
      throw new Error(createErrorMessage('invalidBranchId', params.lang === 'ar'));
    }
    if (params.department && !isValidObjectId(params.department)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.getAll - Invalid department ID:`, params.department);
      throw new Error(createErrorMessage('invalidDepartmentId', params.lang === 'ar'));
    }
    try {
      const response = await api.get('/orders', { params });
      console.log(`[${new Date().toISOString()}] ordersAPI.getAll - Response:`, response);
      return response;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ordersAPI.getAll - Error:`, error.message);
      throw new Error(params.lang === 'ar' ? `فشل في جلب الطلبات: ${error.message}` : `Failed to fetch orders: ${error.message}`);
    }
  },
  getById: async (orderId) => {
    if (!isValidObjectId(orderId)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.getById - Invalid order ID:`, orderId);
      throw new Error(createErrorMessage('invalidOrderId', localStorage.getItem('language') === 'ar'));
    }
    try {
      const response = await api.get(`/orders/${orderId}`);
      console.log(`[${new Date().toISOString()}] ordersAPI.getById - Response:`, response);
      return response;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ordersAPI.getById - Error:`, error.message);
      throw new Error(`Failed to fetch order: ${error.message}`);
    }
  },
  updateStatus: async (orderId, data) => {
    if (!isValidObjectId(orderId)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.updateStatus - Invalid order ID:`, orderId);
      throw new Error(createErrorMessage('invalidOrderId', localStorage.getItem('language') === 'ar'));
    }
    try {
      const response = await api.patch(`/orders/${orderId}/status`, {
        status: data.status.trim(),
      });
      console.log(`[${new Date().toISOString()}] ordersAPI.updateStatus - Response:`, response);
      return response;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ordersAPI.updateStatus - Error:`, error.message);
      throw new Error(`Failed to update order status: ${error.message}`);
    }
  },
  updateChefItem: async (orderId, data) => {
    if (!isValidObjectId(orderId) || !isValidObjectId(data.taskId)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.updateChefItem - Invalid order ID or task ID:`, { orderId, taskId: data.taskId });
      throw new Error(createErrorMessage('invalidOrderOrTaskId', localStorage.getItem('language') === 'ar'));
    }
    try {
      const response = await api.patch(`/orders/${orderId}/tasks/${data.taskId}/status`, {
        status: data.status.trim(),
      });
      console.log(`[${new Date().toISOString()}] ordersAPI.updateChefItem - Response:`, response);
      return response;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ordersAPI.updateChefItem - Error:`, error.message);
      throw new Error(`Failed to update item status: ${error.message}`);
    }
  },
  assignChef: async (orderId, data) => {
    if (!isValidObjectId(orderId) || data.items.some(item => !isValidObjectId(item.itemId) || !isValidObjectId(item.assignedTo))) {
      console.error(`[${new Date().toISOString()}] ordersAPI.assignChef - Invalid data:`, { orderId, data });
      throw new Error(createErrorMessage('invalidOrderOrItemOrChefId', localStorage.getItem('language') === 'ar'));
    }
    try {
      const response = await api.patch(`/orders/${orderId}/assign`, {
        items: data.items,
        timestamp: new Date().toISOString(),
      });
      console.log(`[${new Date().toISOString()}] ordersAPI.assignChef - Response:`, response);
      return response;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ordersAPI.assignChef - Error:`, error.message);
      throw new Error(`Failed to assign chefs: ${error.message}`);
    }
  },
  confirmDelivery: async (orderId) => {
    if (!isValidObjectId(orderId)) {
      console.error(`[${new Date().toISOString()}] ordersAPI.confirmDelivery - Invalid order ID:`, orderId);
      throw new Error(createErrorMessage('invalidOrderId', localStorage.getItem('language') === 'ar'));
    }
    try {
      const response = await api.patch(`/orders/${orderId}/confirm-delivery`, {});
      console.log(`[${new Date().toISOString()}] ordersAPI.confirmDelivery - Response:`, response);
      return response;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ordersAPI.confirmDelivery - Error:`, error.message);
      throw new Error(`Failed to confirm delivery: ${error.message}`);
    }
  },
};

export const departmentAPI = {
  getAll: async (params = {}) => {
    const response = await api.get('/departments', { params });
    console.log(`[${new Date().toISOString()}] departmentAPI.getAll - Response:`, response);
    return response;
  },
  getById: async (id) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] departmentAPI.getById - Invalid department ID:`, id);
      throw new Error('Invalid department ID');
    }
    const response = await api.get(`/departments/${id}`);
    console.log(`[${new Date().toISOString()}] departmentAPI.getById - Response:`, response);
    return response;
  },
  create: async (departmentData) => {
    const response = await api.post('/departments', {
      name: departmentData.name.trim(),
      nameEn: departmentData.nameEn?.trim(),
      code: departmentData.code.trim(),
      description: departmentData.description?.trim(),
    });
    console.log(`[${new Date().toISOString()}] departmentAPI.create - Response:`, response);
    return response;
  },
  update: async (id, departmentData) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] departmentAPI.update - Invalid department ID:`, id);
      throw new Error('Invalid department ID');
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
  delete: async (id) => {
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
  getById: async (id) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] chefsAPI.getById - Invalid chef ID:`, id);
      throw new Error('Invalid chef ID');
    }
    const response = await api.get(`/chefs/${id}`);
    console.log(`[${new Date().toISOString()}] chefsAPI.getById - Response:`, response);
    return response;
  },
  getByUserId: async (userId) => {
    if (!isValidObjectId(userId)) {
      console.error(`[${new Date().toISOString()}] chefsAPI.getByUserId - Invalid user ID:`, userId);
      throw new Error('Invalid user ID');
    }
    const response = await api.get(`/chefs/by-user/${userId}`);
    console.log(`[${new Date().toISOString()}] chefsAPI.getByUserId - Response:`, response);
    return response;
  },
  create: async (chefData) => {
    if (!isValidObjectId(chefData.department)) {
      console.error(`[${new Date().toISOString()}] chefsAPI.create - Invalid department ID:`, chefData.department);
      throw new Error('Invalid department ID');
    }
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
  update: async (id, chefData) => {
    if (!isValidObjectId(id) || !isValidObjectId(chefData.department)) {
      console.error(`[${new Date().toISOString()}] chefsAPI.update - Invalid chef ID or department ID:`, { id, department: chefData.department });
      throw new Error('Invalid chef ID or department ID');
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
  delete: async (id) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] chefsAPI.delete - Invalid chef ID:`, id);
      throw new Error('Invalid chef ID');
    }
    const response = await api.delete(`/chefs/${id}`);
    console.log(`[${new Date().toISOString()}] chefsAPI.delete - Response:`, response);
    return response;
  },
  resetPassword: async (id, password) => {
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
  create: async (assignmentData) => {
    if (
      !isValidObjectId(assignmentData.order) ||
      !isValidObjectId(assignmentData.product) ||
      !isValidObjectId(assignmentData.chef) ||
      !isValidObjectId(assignmentData.itemId)
    ) {
      console.error(`[${new Date().toISOString()}] productionAssignmentsAPI.create - Invalid data:`, assignmentData);
      throw new Error(createErrorMessage('invalidOrderOrItemOrChefId', localStorage.getItem('language') === 'ar'));
    }
    const response = await api.post('/orders/tasks', assignmentData);
    console.log(`[${new Date().toISOString()}] productionAssignmentsAPI.create - Response:`, response);
    return response;
  },
  getChefTasks: async (chefId, query = {}) => {
    if (!isValidObjectId(chefId)) {
      console.error(`[${new Date().toISOString()}] productionAssignmentsAPI.getChefTasks - Invalid chefId:`, chefId);
      throw new Error('Invalid chef ID');
    }
    const response = await api.get(`/orders/tasks/chef/${chefId}`, { params: query });
    console.log(`[${new Date().toISOString()}] productionAssignmentsAPI.getChefTasks - Response:`, response);
    return response;
  },
  updateTaskStatus: async (orderId, taskId, data) => {
    if (!isValidObjectId(orderId) || !isValidObjectId(taskId)) {
      console.error(`[${new Date().toISOString()}] productionAssignmentsAPI.updateTaskStatus - Invalid orderId or taskId:`, { orderId, taskId });
      throw new Error(createErrorMessage('invalidOrderOrTaskId', localStorage.getItem('language') === 'ar'));
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
    if (params.branch && !isValidObjectId(params.branch)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getInventory - Invalid branch ID:`, params.branch);
      throw new Error(createErrorMessage('invalidBranchId', params.lang === 'ar'));
    }
    if (params.product && !isValidObjectId(params.product)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getInventory - Invalid product ID:`, params.product);
      throw new Error(createErrorMessage('invalidProductId', params.lang === 'ar'));
    }
    const response = await api.get('/inventory', { params });
    console.log(`[${new Date().toISOString()}] inventoryAPI.getInventory - Response:`, response);
    return response.inventory;
  },
  getByBranch: async (branchId) => {
    if (!isValidObjectId(branchId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getByBranch - Invalid branch ID:`, branchId);
      throw new Error(createErrorMessage('invalidBranchId', localStorage.getItem('language') === 'ar'));
    }
    const response = await api.get(`/inventory/branch/${branchId}`);
    console.log(`[${new Date().toISOString()}] inventoryAPI.getByBranch - Response:`, response);
    return response.inventory;
  },
  getAll: async (params = {}) => {
    if (params.branch && !isValidObjectId(params.branch)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getAll - Invalid branch ID:`, params.branch);
      throw new Error(createErrorMessage('invalidBranchId', params.lang === 'ar'));
    }
    if (params.product && !isValidObjectId(params.product)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getAll - Invalid product ID:`, params.product);
      throw new Error(createErrorMessage('invalidProductId', params.lang === 'ar'));
    }
    const response = await api.get('/inventory', { params });
    console.log(`[${new Date().toISOString()}] inventoryAPI.getAll - Response:`, response);
    return response.inventory;
  },
  create: async (data) => {
    if (
      !isValidObjectId(data.branchId) ||
      !isValidObjectId(data.productId) ||
      !isValidObjectId(data.userId) ||
      (data.orderId && !isValidObjectId(data.orderId))
    ) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.create - Invalid data:`, data);
      throw new Error(createErrorMessage('invalidBranchId', localStorage.getItem('language') === 'ar'));
    }
    if (data.currentStock < 0) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.create - Invalid stock quantity:`, data.currentStock);
      throw new Error(createErrorMessage('invalidStockQuantity', localStorage.getItem('language') === 'ar'));
    }
    if (data.minStockLevel !== undefined && (data.minStockLevel < 0 || !Number.isInteger(data.minStockLevel))) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.create - Invalid minStockLevel:`, data.minStockLevel);
      throw new Error(createErrorMessage('invalidMinStockLevel', localStorage.getItem('language') === 'ar'));
    }
    if (data.maxStockLevel !== undefined && (data.maxStockLevel < 0 || !Number.isInteger(data.maxStockLevel))) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.create - Invalid maxStockLevel:`, data.maxStockLevel);
      throw new Error(createErrorMessage('invalidMaxStockLevel', localStorage.getItem('language') === 'ar'));
    }
    if (data.minStockLevel !== undefined && data.maxStockLevel !== undefined && data.maxStockLevel <= data.minStockLevel) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.create - Max stock level less than min:`, { minStockLevel: data.minStockLevel, maxStockLevel: data.maxStockLevel });
      throw new Error(createErrorMessage('maxLessThanMin', localStorage.getItem('language') === 'ar'));
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
  bulkCreate: async (data) => {
    if (
      !isValidObjectId(data.branchId) ||
      !isValidObjectId(data.userId) ||
      (data.orderId && !isValidObjectId(data.orderId)) ||
      !Array.isArray(data.items) ||
      data.items.length === 0 ||
      data.items.some(item => !isValidObjectId(item.productId) || item.currentStock < 0)
    ) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.bulkCreate - Invalid data:`, data);
      throw new Error(createErrorMessage('invalidBranchId', localStorage.getItem('language') === 'ar'));
    }
    if (data.items.some(item => item.minStockLevel !== undefined && (item.minStockLevel < 0 || !Number.isInteger(item.minStockLevel)))) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.bulkCreate - Invalid minStockLevel:`, data.items);
      throw new Error(createErrorMessage('invalidMinStockLevel', localStorage.getItem('language') === 'ar'));
    }
    if (data.items.some(item => item.maxStockLevel !== undefined && (item.maxStockLevel < 0 || !Number.isInteger(item.maxStockLevel)))) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.bulkCreate - Invalid maxStockLevel:`, data.items);
      throw new Error(createErrorMessage('invalidMaxStockLevel', localStorage.getItem('language') === 'ar'));
    }
    if (data.items.some(item => item.minStockLevel !== undefined && item.maxStockLevel !== undefined && item.maxStockLevel <= item.minStockLevel)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.bulkCreate - Max stock level less than min:`, data.items);
      throw new Error(createErrorMessage('maxLessThanMin', localStorage.getItem('language') === 'ar'));
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
  updateStock: async (id, data) => {
    if (
      !isValidObjectId(id) ||
      (data.productId && !isValidObjectId(data.productId)) ||
      (data.branchId && !isValidObjectId(data.branchId))
    ) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStock - Invalid inventory ID, product ID, or branch ID:`, { id, data });
      throw new Error(createErrorMessage('invalidBranchId', localStorage.getItem('language') === 'ar'));
    }
    if (data.currentStock !== undefined && (data.currentStock < 0 || !Number.isInteger(data.currentStock))) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStock - Invalid stock quantity:`, data.currentStock);
      throw new Error(createErrorMessage('invalidStockQuantity', localStorage.getItem('language') === 'ar'));
    }
    if (data.minStockLevel !== undefined && (data.minStockLevel < 0 || !Number.isInteger(data.minStockLevel))) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStock - Invalid minStockLevel:`, data.minStockLevel);
      throw new Error(createErrorMessage('invalidMinStockLevel', localStorage.getItem('language') === 'ar'));
    }
    if (data.maxStockLevel !== undefined && (data.maxStockLevel < 0 || !Number.isInteger(data.maxStockLevel))) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStock - Invalid maxStockLevel:`, data.maxStockLevel);
      throw new Error(createErrorMessage('invalidMaxStockLevel', localStorage.getItem('language') === 'ar'));
    }
    if (data.minStockLevel !== undefined && data.maxStockLevel !== undefined && data.maxStockLevel <= data.minStockLevel) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.updateStock - Max stock level less than min:`, { minStockLevel: data.minStockLevel, maxStockLevel: data.maxStockLevel });
      throw new Error(createErrorMessage('maxLessThanMin', localStorage.getItem('language') === 'ar'));
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
  processReturnItems: async (returnId, data) => {
    const language = localStorage.getItem('language') || 'en';
    const isRtl = language === 'ar';

    if (
      !isValidObjectId(returnId) ||
      !isValidObjectId(data.branchId) ||
      !Array.isArray(data.items) ||
      data.items.length === 0 ||
      data.items.some(item => !isValidObjectId(item.productId) || item.quantity < 1 || !['approved', 'rejected'].includes(item.status))
    ) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.processReturnItems - Invalid data:`, { returnId, data });
      throw new Error(createErrorMessage('invalidBranchId', isRtl));
    }

    try {
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
    } catch (error) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.processReturnItems - Error:`, {
        message: error.message,
        status: error.status,
        details: error.details,
        response: error.response,
      });
      let errorMessage = error.message || (isRtl ? 'خطأ في معالجة عناصر الإرجاع' : 'Error processing return items');
      if (error.status === 500) {
        errorMessage = isRtl ? 'خطأ في الخادم، حاول مرة أخرى لاحقًا' : 'Server error, please try again later';
      }
      throw new Error(errorMessage);
    }
  },
  createReturn: async (data) => {
    const language = localStorage.getItem('language') || 'en';
    const isRtl = language === 'ar';

    if (
      !isValidObjectId(data.orderId) ||
      !isValidObjectId(data.branchId) ||
      !data.reason ||
      !Array.isArray(data.items) ||
      data.items.length === 0 ||
      data.items.some(item => 
        (item.itemId && !isValidObjectId(item.itemId)) || 
        !isValidObjectId(item.productId) || 
        item.quantity < 1 || 
        !item.reason
      )
    ) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.createReturn - Invalid data:`, data);
      throw new Error(createErrorMessage('invalidBranchId', isRtl));
    }

    try {
      const response = await api.post('/inventory/returns', {
        orderId: data.orderId,
        branchId: data.branchId,
        reason: data.reason.trim(),
        items: data.items.map(item => ({
          itemId: item.itemId,
          productId: item.productId,
          quantity: item.quantity,
          reason: item.reason.trim(),
          reasonEn: item.reasonEn?.trim(),
        })),
        notes: data.notes?.trim(),
      });
      console.log(`[${new Date().toISOString()}] inventoryAPI.createReturn - Response:`, response);
      return response.returnRequest;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.createReturn - Error:`, {
        message: error.message,
        status: error.status,
        details: error.details,
        response: error.response,
      });
      let errorMessage = error.message || (isRtl ? 'خطأ في إنشاء طلب الإرجاع' : 'Error creating return request');
      if (error.status === 500) {
        errorMessage = isRtl ? 'خطأ في الخادم، حاول مرة أخرى لاحقًا' : 'Server error, please try again later';
      }
      throw new Error(errorMessage);
    }
  },
  createRestockRequest: async (data) => {
    if (
      !isValidObjectId(data.productId) ||
      !isValidObjectId(data.branchId) ||
      data.requestedQuantity < 1
    ) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.createRestockRequest - Invalid data:`, data);
      throw new Error(createErrorMessage('invalidBranchId', localStorage.getItem('language') === 'ar'));
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
  getRestockRequests: async (params = {}) => {
    if (params.branchId && !isValidObjectId(params.branchId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getRestockRequests - Invalid branch ID:`, params.branchId);
      throw new Error(createErrorMessage('invalidBranchId', params.lang === 'ar'));
    }
    const response = await api.get('/inventory/restock-requests', { params });
    console.log(`[${new Date().toISOString()}] inventoryAPI.getRestockRequests - Response:`, response);
    return response.restockRequests;
  },
  approveRestockRequest: async (requestId, data) => {
    if (!isValidObjectId(requestId) || !isValidObjectId(data.userId) || data.approvedQuantity < 1) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.approveRestockRequest - Invalid data:`, { requestId, data });
      throw new Error(createErrorMessage('invalidBranchId', localStorage.getItem('language') === 'ar'));
    }
    const response = await api.patch(`/inventory/restock-requests/${requestId}/approve`, {
      approvedQuantity: data.approvedQuantity,
      userId: data.userId,
    });
    console.log(`[${new Date().toISOString()}] inventoryAPI.approveRestockRequest - Response:`, response);
    return response.restockRequest;
  },
  getHistory: async (params = {}) => {
    if (params.branchId && !isValidObjectId(params.branchId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getHistory - Invalid branch ID:`, params.branchId);
      throw new Error(createErrorMessage('invalidBranchId', params.lang === 'ar'));
    }
    if (params.productId && !isValidObjectId(params.productId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.getHistory - Invalid product ID:`, params.productId);
      throw new Error(createErrorMessage('invalidProductId', params.lang === 'ar'));
    }
    const response = await api.get('/inventory/history', { params });
    console.log(`[${new Date().toISOString()}] inventoryAPI.getHistory - Response:`, response);
    return response.history;
  },
  checkOrderHistory: async (orderId) => {
    if (!isValidObjectId(orderId)) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.checkOrderHistory - Invalid order ID:`, orderId);
      throw new Error(createErrorMessage('invalidOrderId', localStorage.getItem('language') === 'ar'));
    }
    try {
      const response = await api.get(`/inventory/check-order-history/${orderId}`);
      console.log(`[${new Date().toISOString()}] inventoryAPI.checkOrderHistory - Response:`, response);
      return response.exists;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] inventoryAPI.checkOrderHistory - Error:`, {
        message: error.message,
        status: error.status,
        details: error.details,
        response: error.response,
      });
      let errorMessage = error.message || (localStorage.getItem('language') === 'ar' ? 'خطأ في التحقق من سجل الطلب' : 'Error checking order history');
      if (error.status === 500) {
        errorMessage = localStorage.getItem('language') === 'ar' ? 'خطأ في الخادم، حاول مرة أخرى لاحقًا' : 'Server error, please try again later';
      }
      throw new Error(errorMessage);
    }
  },
};






// api/factoryInventoryAPI.js and factoryOrdersAPI.js
export const factoryInventoryAPI = {
  getAll: async (params: { product?: string; department?: string; lowStock?: boolean; stockStatus?: 'low' | 'normal' | 'high'; lang?: string } = {}) => {
    if (params.product && !isValidObjectId(params.product)) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.getAll - Invalid product ID:`, params.product);
      throw new Error(createErrorMessage('invalidProductId', params.lang === 'ar'));
    }
    if (params.department && !isValidObjectId(params.department)) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.getAll - Invalid department ID:`, params.department);
      throw new Error(createErrorMessage('invalidDepartmentId', params.lang === 'ar'));
    }
    const response = await api.get('/factoryInventory', { params });
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.getAll - Response:`, response);
    return response; // Return the raw response as expected by FactoryInventory.tsx
  },
  create: async (data: { productId: string; userId: string; currentStock: number; minStockLevel?: number; maxStockLevel?: number; orderId?: string }) => {
    if (!isValidObjectId(data.productId) || !isValidObjectId(data.userId) || (data.orderId && !isValidObjectId(data.orderId))) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.create - Invalid data:`, data);
      throw new Error(createErrorMessage('invalidProductId', localStorage.getItem('language') === 'ar'));
    }
    if (data.currentStock < 0) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.create - Invalid stock quantity:`, data.currentStock);
      throw new Error(createErrorMessage('invalidStockQuantity', localStorage.getItem('language') === 'ar'));
    }
    if (data.minStockLevel !== undefined && (data.minStockLevel < 0 || !Number.isInteger(data.minStockLevel))) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.create - Invalid minStockLevel:`, data.minStockLevel);
      throw new Error(createErrorMessage('invalidMinStockLevel', localStorage.getItem('language') === 'ar'));
    }
    if (data.maxStockLevel !== undefined && (data.maxStockLevel < 0 || !Number.isInteger(data.maxStockLevel))) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.create - Invalid maxStockLevel:`, data.maxStockLevel);
      throw new Error(createErrorMessage('invalidMaxStockLevel', localStorage.getItem('language') === 'ar'));
    }
    if (data.minStockLevel !== undefined && data.maxStockLevel !== undefined && data.maxStockLevel <= data.minStockLevel) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.create - Max stock level less than min:`, { minStockLevel: data.minStockLevel, maxStockLevel: data.maxStockLevel });
      throw new Error(createErrorMessage('maxLessThanMin', localStorage.getItem('language') === 'ar'));
    }
    const response = await api.post('/factoryInventory', {
      productId: data.productId,
      userId: data.userId,
      currentStock: data.currentStock,
      minStockLevel: data.minStockLevel ?? 0,
      maxStockLevel: data.maxStockLevel ?? 1000,
      orderId: data.orderId,
    });
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.create - Response:`, response);
    return response;
  },
  bulkCreate: async (data: { userId: string; orderId?: string; items: { productId: string; currentStock: number; minStockLevel?: number; maxStockLevel?: number }[] }) => {
    if (!isValidObjectId(data.userId) || (data.orderId && !isValidObjectId(data.orderId)) || !Array.isArray(data.items) || data.items.length === 0 || data.items.some(item => !isValidObjectId(item.productId))) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.bulkCreate - Invalid data:`, data);
      throw new Error(createErrorMessage('invalidUserId', localStorage.getItem('language') === 'ar'));
    }
    if (data.items.some(item => item.currentStock < 0)) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.bulkCreate - Invalid stock quantity:`, data.items);
      throw new Error(createErrorMessage('invalidStockQuantity', localStorage.getItem('language') === 'ar'));
    }
    if (data.items.some(item => item.minStockLevel !== undefined && (item.minStockLevel < 0 || !Number.isInteger(item.minStockLevel)))) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.bulkCreate - Invalid minStockLevel:`, data.items);
      throw new Error(createErrorMessage('invalidMinStockLevel', localStorage.getItem('language') === 'ar'));
    }
    if (data.items.some(item => item.maxStockLevel !== undefined && (item.maxStockLevel < 0 || !Number.isInteger(item.maxStockLevel)))) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.bulkCreate - Invalid maxStockLevel:`, data.items);
      throw new Error(createErrorMessage('invalidMaxStockLevel', localStorage.getItem('language') === 'ar'));
    }
    if (data.items.some(item => item.minStockLevel !== undefined && item.maxStockLevel !== undefined && item.maxStockLevel <= item.minStockLevel)) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.bulkCreate - Max stock level less than min:`, data.items);
      throw new Error(createErrorMessage('maxLessThanMin', localStorage.getItem('language') === 'ar'));
    }
    const response = await api.post('/factoryInventory/bulk', {
      userId: data.userId,
      orderId: data.orderId,
      items: data.items.map(item => ({
        productId: item.productId,
        currentStock: item.currentStock,
        minStockLevel: item.minStockLevel ?? 0,
        maxStockLevel: item.maxStockLevel ?? 1000,
      })),
    });
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.bulkCreate - Response:`, response);
    return response;
  },
  updateStock: async (id: string, data: { currentStock?: number; minStockLevel?: number; maxStockLevel?: number }) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.updateStock - Invalid inventory ID:`, id);
      throw new Error(createErrorMessage('invalidInventoryId', localStorage.getItem('language') === 'ar'));
    }
    if (data.currentStock !== undefined && (data.currentStock < 0 || !Number.isInteger(data.currentStock))) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.updateStock - Invalid stock quantity:`, data.currentStock);
      throw new Error(createErrorMessage('invalidStockQuantity', localStorage.getItem('language') === 'ar'));
    }
    if (data.minStockLevel !== undefined && (data.minStockLevel < 0 || !Number.isInteger(data.minStockLevel))) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.updateStock - Invalid minStockLevel:`, data.minStockLevel);
      throw new Error(createErrorMessage('invalidMinStockLevel', localStorage.getItem('language') === 'ar'));
    }
    if (data.maxStockLevel !== undefined && (data.maxStockLevel < 0 || !Number.isInteger(data.maxStockLevel))) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.updateStock - Invalid maxStockLevel:`, data.maxStockLevel);
      throw new Error(createErrorMessage('invalidMaxStockLevel', localStorage.getItem('language') === 'ar'));
    }
    if (data.minStockLevel !== undefined && data.maxStockLevel !== undefined && data.maxStockLevel <= data.minStockLevel) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.updateStock - Max stock level less than min:`, { minStockLevel: data.minStockLevel, maxStockLevel: data.maxStockLevel });
      throw new Error(createErrorMessage('maxLessThanMin', localStorage.getItem('language') === 'ar'));
    }
    const response = await api.put(`/factoryInventory/${id}`, {
      currentStock: data.currentStock,
      minStockLevel: data.minStockLevel,
      maxStockLevel: data.maxStockLevel,
    });
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.updateStock - Response:`, response);
    return response;
  },
  getHistory: async (params: { productId?: string; department?: string; period?: 'daily' | 'weekly' | 'monthly'; lang?: string } = {}) => {
    if (params.productId && !isValidObjectId(params.productId)) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.getHistory - Invalid product ID:`, params.productId);
      throw new Error(createErrorMessage('invalidProductId', params.lang === 'ar'));
    }
    if (params.department && !isValidObjectId(params.department)) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.getHistory - Invalid department ID:`, params.department);
      throw new Error(createErrorMessage('invalidDepartmentId', params.lang === 'ar'));
    }
    if (params.period && !['daily', 'weekly', 'monthly'].includes(params.period)) {
      console.error(`[${new Date().toISOString()}] factoryInventoryAPI.getHistory - Invalid period:`, params.period);
      throw new Error(createErrorMessage('invalidStatus', params.lang === 'ar'));
    }
    const response = await api.get('/factoryInventory/history', { params });
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.getHistory - Response:`, response);
    return response;
  },
  getAvailableProducts: async () => {
    const response = await api.get('/products');
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.getAvailableProducts - Response:`, response);
    return response;
  },
};
export const factoryOrdersAPI = {
  create: async (data: { orderNumber: string; items: { product: string; quantity: number; }[]; notes?: string; priority?: string }) => {
    if (!data.orderNumber || !Array.isArray(data.items) || data.items.length === 0 || data.items.some(item => !isValidObjectId(item.product) || item.quantity < 1 )) {
      console.error(`[${new Date().toISOString()}] factoryOrdersAPI.create - Invalid data:`, data);
      throw new Error(createErrorMessage('invalidItems', localStorage.getItem('language') === 'ar'));
    }
    const response = await api.post('/factoryOrders', {
      orderNumber: data.orderNumber.trim(),
      items: data.items.map(item => ({
        product: item.product,
        quantity: item.quantity,
      })),
      notes: data.notes?.trim(),
      priority: data.priority?.trim() || 'medium',
    });
    console.log(`[${new Date().toISOString()}] factoryOrdersAPI.create - Response:`, response);
    return response;
  },
  getAll: async () => {
    const response = await api.get('/factoryOrders');
    console.log(`[${new Date().toISOString()}] factoryOrdersAPI.getAll - Response:`, response);
    return response;
  },
  getById: async (id: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] factoryOrdersAPI.getById - Invalid order ID:`, id);
      throw new Error(createErrorMessage('invalidOrderId', localStorage.getItem('language') === 'ar'));
    }
    const response = await api.get(`/factoryOrders/${id}`);
    console.log(`[${new Date().toISOString()}] factoryOrdersAPI.getById - Response:`, response);
    return response;
  },
  assignChefs: async (id: string, data: { items: { itemId: string; assignedTo: string }[] }) => {
    if (!isValidObjectId(id) || !Array.isArray(data.items) || data.items.some(item => !isValidObjectId(item.itemId) || !isValidObjectId(item.assignedTo))) {
      console.error(`[${new Date().toISOString()}] factoryOrdersAPI.assignChefs - Invalid data:`, { id, data });
      throw new Error(createErrorMessage('invalidOrderId', localStorage.getItem('language') === 'ar'));
    }
    const response = await api.patch(`/factoryOrders/${id}/assign`, {
      items: data.items,
    });
    console.log(`[${new Date().toISOString()}] factoryOrdersAPI.assignChefs - Response:`, response);
    return response;
  },
  updateStatus: async (id: string, data: { status: 'pending' | 'in_production' | 'completed' | 'cancelled' }) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] factoryOrdersAPI.updateStatus - Invalid order ID:`, id);
      throw new Error(createErrorMessage('invalidOrderId', localStorage.getItem('language') === 'ar'));
    }
    if (!['pending', 'in_production', 'completed', 'cancelled'].includes(data.status)) {
      console.error(`[${new Date().toISOString()}] factoryOrdersAPI.updateStatus - Invalid status:`, data.status);
      throw new Error(createErrorMessage('invalidStatus', localStorage.getItem('language') === 'ar'));
    }
    const response = await api.patch(`/factoryOrders/${id}/status`, {
      status: data.status,
    });
    console.log(`[${new Date().toISOString()}] factoryOrdersAPI.updateStatus - Response:`, response);
    return response;
  },
  confirmProduction: async (id: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] factoryOrdersAPI.confirmProduction - Invalid order ID:`, id);
      throw new Error(createErrorMessage('invalidOrderId', localStorage.getItem('language') === 'ar'));
    }
    const response = await api.patch(`/factoryOrders/${id}/confirm-production`, {});
    console.log(`[${new Date().toISOString()}] factoryOrdersAPI.confirmProduction - Response:`, response);
    return response;
  },
};


export { notificationsAPI, returnsAPI, salesAPI };
export default api;