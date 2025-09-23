import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { notificationsAPI } from './notifications';
import { returnsAPI } from './returnsAPI';
import { salesAPI } from './salesAPI';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';

// Helper function to get isRtl dynamically
const getIsRtl = () => localStorage.getItem('language') === 'ar';

// Helper function to validate ObjectId
const isValidObjectId = (id: string): boolean => /^[0-9a-fA-F]{24}$/.test(id);

// Helper function to trim string fields
const trimObjectStrings = <T>(obj: T): T => {
  if (!obj || typeof obj !== 'object') return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.trim() : value,
    ])
  ) as T;
};

// Centralized error messages
const errorMessages = {
  ar: {
    unexpected: 'خطأ غير متوقع',
    invalidData: 'بيانات غير صالحة',
    unauthorized: 'عملية غير مصرح بها',
    notFound: 'المورد غير موجود',
    tooManyRequests: 'طلبات كثيرة جدًا، حاول مرة أخرى لاحقًا',
    invalidId: (resource: string) => `معرف ${resource} غير صالح`,
    negativeStock: 'كمية المخزون لا يمكن أن تكون سالبة',
    invalidQuantity: 'الكمية غير صالحة',
  },
  en: {
    unexpected: 'Unexpected error',
    invalidData: 'Invalid data',
    unauthorized: 'Unauthorized operation',
    notFound: 'Resource not found',
    tooManyRequests: 'Too many requests, try again later',
    invalidId: (resource: string) => `Invalid ${resource} ID`,
    negativeStock: 'Stock quantity cannot be negative',
    invalidQuantity: 'Invalid quantity',
  },
};

// Create Axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor
api.interceptors.request.use(
  (config: AxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    const isRtl = getIsRtl();
    config.params = { ...config.params, isRtl: isRtl.toString() };
    if (token) {
      config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
    }
    console.log(`[${new Date().toISOString()}] API request:`, {
      url: config.url,
      method: config.method,
      headers: config.headers,
      params: config.params,
      data: config.data,
    });
    return config;
  },
  (error: AxiosError) => {
    console.error(`[${new Date().toISOString()}] API request error:`, error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response: AxiosResponse) => response.data,
  async (error: AxiosError) => {
    const isRtl = getIsRtl();
    const messages = isRtl ? errorMessages.ar : errorMessages.en;
    const originalRequest = error.config;
    let message = error.response?.data?.message || messages.unexpected;

    if (error.response?.status === 400) {
      message = error.response?.data?.message || messages.invalidData;
      if (error.response?.data?.field) {
        message = `${message}: ${error.response.data.field} = ${error.response.data.value}`;
      }
    } else if (error.response?.status === 403) {
      message = error.response?.data?.message || messages.unauthorized;
    } else if (error.response?.status === 404) {
      message = error.response?.data?.message || messages.notFound;
    } else if (error.response?.status === 429) {
      message = messages.tooManyRequests;
    } else if (!error.response && error.code === 'ECONNABORTED') {
      message = isRtl ? 'انتهت مهلة الطلب، تحقق من الاتصال بالشبكة' : 'Request timed out, check your network connection';
    }

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

    console.error(`[${new Date().toISOString()}] API response error:`, {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    return Promise.reject({ message, status: error.response?.status });
  }
);

// Interfaces for TypeScript
interface User {
  _id: string;
  name: string;
  nameEn?: string;
  displayName: string;
  username: string;
  email?: string;
  phone?: string;
  role: 'admin' | 'branch' | 'production';
  branch?: string;
  isActive: boolean;
}

interface Product {
  _id: string;
  name: string;
  nameEn?: string;
  displayName: string;
  code: string;
  department: { _id: string; name: string; nameEn?: string; displayName: string };
  price: number;
  unit: string;
  unitEn?: string;
  displayUnit: string;
  description?: string;
}

interface Branch {
  _id: string;
  name: string;
  nameEn?: string;
  displayName: string;
  code: string;
  address: string;
  addressEn?: string;
  city: string;
  cityEn?: string;
  phone?: string;
}

interface Department {
  _id: string;
  name: string;
  nameEn?: string;
  displayName: string;
  code: string;
  description?: string;
}

interface Order {
  _id: string;
  orderNumber: string;
  branchId: string;
  items: Array<{ productId: string; quantity: number; price: number }>;
  status: string;
  notes?: string;
  priority?: string;
  requestedDeliveryDate: string;
}

interface Chef {
  _id: string;
  user: User;
  department: string;
}

interface Inventory {
  _id: string;
  branchId: string;
  productId: string;
  currentStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  userId: string;
  orderId?: string;
}

interface PaginatedResponse<T> {
  data: T[];
  totalPages: number;
  currentPage: number;
  totalItems: number;
}

// Auth API
export const authAPI = {
  login: async (credentials: { username: string; password: string }) => {
    const response = await api.post<{ user: User; accessToken: string; refreshToken: string }>('/auth/login', trimObjectStrings(credentials));
    console.log(`[${new Date().toISOString()}] authAPI.login - Response:`, response);
    return response;
  },
  refreshToken: async (refreshToken: string) => {
    const response = await axios.post<{ accessToken: string; refreshToken?: string }>(`${API_BASE_URL}/auth/refresh-token`, { refreshToken });
    console.log(`[${new Date().toISOString()}] authAPI.refreshToken - Response:`, response.data);
    return response.data;
  },
  getProfile: async () => {
    const response = await api.get<{ user: User }>('/auth/profile');
    console.log(`[${new Date().toISOString()}] authAPI.getProfile - Response:`, response);
    return {
      ...response,
      user: {
        ...response.user,
        id: response.user.id || response.user._id,
        displayName: response.user.displayName || (getIsRtl() ? response.user.name : response.user.nameEn || response.user.name),
      },
    };
  },
  updateProfile: async (data: { name?: string; nameEn?: string; email?: string; phone?: string; password?: string }) => {
    const response = await api.put<User>('/auth/update-profile', trimObjectStrings(data));
    console.log(`[${new Date().toISOString()}] authAPI.updateProfile - Response:`, response);
    return response;
  },
  checkEmail: async (email: string) => {
    const response = await api.post<{ exists: boolean }>('/auth/check-email', { email: email.trim() });
    console.log(`[${new Date().toISOString()}] authAPI.checkEmail - Response:`, response);
    return response;
  },
};

// Products API
export const productsAPI = {
  getAll: async (params: { department?: string; search?: string; page?: number; limit?: number } = {}) => {
    if (params.department && !isValidObjectId(params.department)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('القسم') : errorMessages.en.invalidId('department'));
    }
    const response = await api.get<PaginatedResponse<Product>>('/products', { params });
    console.log(`[${new Date().toISOString()}] productsAPI.getAll - Response:`, response);
    return response;
  },
  getById: async (id: string) => {
    if (!isValidObjectId(id)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('المنتج') : errorMessages.en.invalidId('product'));
    }
    const response = await api.get<Product>(`/products/${id}`);
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
    ingredients?: string[];
    preparationTime?: number;
  }) => {
    if (!isValidObjectId(productData.department)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('القسم') : errorMessages.en.invalidId('department'));
    }
    const response = await api.post<Product>('/products', trimObjectStrings(productData));
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
    ingredients: string[];
    preparationTime: number;
  }>) => {
    if (!isValidObjectId(id)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('المنتج') : errorMessages.en.invalidId('product'));
    }
    if (productData.department && !isValidObjectId(productData.department)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('القسم') : errorMessages.en.invalidId('department'));
    }
    const response = await api.put<Product>(`/products/${id}`, trimObjectStrings(productData));
    console.log(`[${new Date().toISOString()}] productsAPI.update - Response:`, response);
    return response;
  },
  delete: async (id: string) => {
    if (!isValidObjectId(id)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('المنتج') : errorMessages.en.invalidId('product'));
    }
    const response = await api.delete<{ message: string }>(`/products/${id}`);
    console.log(`[${new Date().toISOString()}] productsAPI.delete - Response:`, response);
    return response;
  },
};

// Branches API
export const branchesAPI = {
  getAll: async () => {
    const response = await api.get<Branch[]>('/branches');
    console.log(`[${new Date().toISOString()}] branchesAPI.getAll - Response:`, response);
    return response;
  },
  getById: async (id: string) => {
    if (!isValidObjectId(id)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الفرع') : errorMessages.en.invalidId('branch'));
    }
    const response = await api.get<Branch>(`/branches/${id}`);
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
    const response = await api.post<Branch>('/branches', trimObjectStrings(branchData));
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
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الفرع') : errorMessages.en.invalidId('branch'));
    }
    const response = await api.put<Branch>(`/branches/${id}`, trimObjectStrings(branchData));
    console.log(`[${new Date().toISOString()}] branchesAPI.update - Response:`, response);
    return response;
  },
  delete: async (id: string) => {
    if (!isValidObjectId(id)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الفرع') : errorMessages.en.invalidId('branch'));
    }
    const response = await api.delete<{ message: string }>(`/branches/${id}`);
    console.log(`[${new Date().toISOString()}] branchesAPI.delete - Response:`, response);
    return response;
  },
  checkEmail: async (email: string) => {
    const response = await api.post<{ exists: boolean }>('/branches/check-email', { email: email.trim() });
    console.log(`[${new Date().toISOString()}] branchesAPI.checkEmail - Response:`, response);
    return response;
  },
  resetPassword: async (id: string, password: string) => {
    if (!isValidObjectId(id)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الفرع') : errorMessages.en.invalidId('branch'));
    }
    const response = await api.post<{ message: string }>(`/branches/${id}/reset-password`, { password });
    console.log(`[${new Date().toISOString()}] branchesAPI.resetPassword - Response:`, response);
    return response;
  },
};

// Users API
export const usersAPI = {
  getAll: async () => {
    const response = await api.get<User[]>('/users');
    console.log(`[${new Date().toISOString()}] usersAPI.getAll - Response:`, response);
    return response;
  },
  getById: async (id: string) => {
    if (!isValidObjectId(id)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('المستخدم') : errorMessages.en.invalidId('user'));
    }
    const response = await api.get<User>(`/users/${id}`);
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
    if (userData.role === 'branch' && userData.branch && !isValidObjectId(userData.branch)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الفرع') : errorMessages.en.invalidId('branch'));
    }
    const response = await api.post<User>('/users', trimObjectStrings(userData));
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
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('المستخدم') : errorMessages.en.invalidId('user'));
    }
    if (userData.role === 'branch' && userData.branch && !isValidObjectId(userData.branch)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الفرع') : errorMessages.en.invalidId('branch'));
    }
    const response = await api.put<User>(`/users/${id}`, trimObjectStrings(userData));
    console.log(`[${new Date().toISOString()}] usersAPI.update - Response:`, response);
    return response;
  },
  delete: async (id: string) => {
    if (!isValidObjectId(id)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('المستخدم') : errorMessages.en.invalidId('user'));
    }
    const response = await api.delete<{ message: string }>(`/users/${id}`);
    console.log(`[${new Date().toISOString()}] usersAPI.delete - Response:`, response);
    return response;
  },
  checkEmail: async (email: string) => {
    const response = await api.post<{ exists: boolean }>('/users/check-email', { email: email.trim() });
    console.log(`[${new Date().toISOString()}] usersAPI.checkEmail - Response:`, response);
    return response;
  },
  resetPassword: async (id: string, password: string) => {
    if (!isValidObjectId(id)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('المستخدم') : errorMessages.en.invalidId('user'));
    }
    const response = await api.post<{ message: string }>(`/users/${id}/reset-password`, { password });
    console.log(`[${new Date().toISOString()}] usersAPI.resetPassword - Response:`, response);
    return response;
  },
};

// Orders API
export const ordersAPI = {
  create: async (orderData: {
    orderNumber: string;
    branchId: string;
    items: Array<{ productId: string; quantity: number; price: number }>;
    status: string;
    notes?: string;
    priority?: string;
    requestedDeliveryDate: string;
  }) => {
    if (!isValidObjectId(orderData.branchId) || orderData.items.some(item => !isValidObjectId(item.productId))) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الفرع أو المنتج') : errorMessages.en.invalidId('branch or product'));
    }
    const response = await api.post<Order>('/orders', trimObjectStrings(orderData));
    console.log(`[${new Date().toISOString()}] ordersAPI.create - Response:`, response);
    return response;
  },
  getAll: async (params: { status?: string; branch?: string; page?: number; limit?: number; search?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' } = {}) => {
    if (params.branch && !isValidObjectId(params.branch)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الفرع') : errorMessages.en.invalidId('branch'));
    }
    const response = await api.get<PaginatedResponse<Order>>('/orders', { params });
    console.log(`[${new Date().toISOString()}] ordersAPI.getAll - Response:`, response);
    return response;
  },
  getById: async (id: string) => {
    if (!isValidObjectId(id)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الطلب') : errorMessages.en.invalidId('order'));
    }
    const response = await api.get<Order>(`/orders/${id}`);
    console.log(`[${new Date().toISOString()}] ordersAPI.getById - Response:`, response);
    return response;
  },
  updateStatus: async (id: string, data: { status: string; notes?: string }) => {
    if (!isValidObjectId(id)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الطلب') : errorMessages.en.invalidId('order'));
    }
    const response = await api.patch<Order>(`/orders/${id}/status`, trimObjectStrings(data));
    console.log(`[${new Date().toISOString()}] ordersAPI.updateStatus - Response:`, response);
    return response;
  },
  confirmDelivery: async (orderId: string) => {
    if (!isValidObjectId(orderId)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الطلب') : errorMessages.en.invalidId('order'));
    }
    const response = await api.patch<Order>(`/orders/${orderId}/confirm-delivery`, {});
    console.log(`[${new Date().toISOString()}] ordersAPI.confirmDelivery - Response:`, response);
    return response;
  },
};

// Departments API
export const departmentAPI = {
  getAll: async (params: { page?: number; limit?: number; search?: string } = {}) => {
    const response = await api.get<PaginatedResponse<Department>>('/departments', { params });
    console.log(`[${new Date().toISOString()}] departmentAPI.getAll - Response:`, response);
    return response;
  },
  getById: async (id: string) => {
    if (!isValidObjectId(id)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('القسم') : errorMessages.en.invalidId('department'));
    }
    const response = await api.get<Department>(`/departments/${id}`);
    console.log(`[${new Date().toISOString()}] departmentAPI.getById - Response:`, response);
    return response;
  },
  create: async (departmentData: {
    name: string;
    nameEn?: string;
    code: string;
    description?: string;
  }) => {
    const response = await api.post<Department>('/departments', trimObjectStrings(departmentData));
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
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('القسم') : errorMessages.en.invalidId('department'));
    }
    const response = await api.put<Department>(`/departments/${id}`, trimObjectStrings(departmentData));
    console.log(`[${new Date().toISOString()}] departmentAPI.update - Response:`, response);
    return response;
  },
  delete: async (id: string) => {
    if (!isValidObjectId(id)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('القسم') : errorMessages.en.invalidId('department'));
    }
    const response = await api.delete<{ message: string }>(`/departments/${id}`);
    console.log(`[${new Date().toISOString()}] departmentAPI.delete - Response:`, response);
    return response;
  },
};

// Chefs API
export const chefsAPI = {
  getAll: async () => {
    const response = await api.get<Chef[]>('/chefs');
    console.log(`[${new Date().toISOString()}] chefsAPI.getAll - Response:`, response);
    return response;
  },
  getByUserId: async (userId: string) => {
    if (!isValidObjectId(userId)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('المستخدم') : errorMessages.en.invalidId('user'));
    }
    const response = await api.get<Chef>(`/chefs/by-user/${userId}`);
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
    if (!isValidObjectId(chefData.department)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('القسم') : errorMessages.en.invalidId('department'));
    }
    const response = await api.post<Chef>('/chefs', trimObjectStrings(chefData));
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
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الطاهي') : errorMessages.en.invalidId('chef'));
    }
    if (!isValidObjectId(chefData.department)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('القسم') : errorMessages.en.invalidId('department'));
    }
    const response = await api.put<Chef>(`/chefs/${id}`, trimObjectStrings(chefData));
    console.log(`[${new Date().toISOString()}] chefsAPI.update - Response:`, response);
    return response;
  },
  delete: async (id: string) => {
    if (!isValidObjectId(id)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الطاهي') : errorMessages.en.invalidId('chef'));
    }
    const response = await api.delete<{ message: string }>(`/chefs/${id}`);
    console.log(`[${new Date().toISOString()}] chefsAPI.delete - Response:`, response);
    return response;
  },
  resetPassword: async (id: string, password: string) => {
    if (!isValidObjectId(id)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الطاهي') : errorMessages.en.invalidId('chef'));
    }
    const response = await api.post<{ message: string }>(`/chefs/${id}/reset-password`, { password });
    console.log(`[${new Date().toISOString()}] chefsAPI.resetPassword - Response:`, response);
    return response;
  },
};

// Production Assignments API
export const productionAssignmentsAPI = {
  create: async (assignmentData: {
    order: string;
    product: string;
    chef: string;
    quantity: number;
    itemId: string;
  }) => {
    if (
      !isValidObjectId(assignmentData.order) ||
      !isValidObjectId(assignmentData.product) ||
      !isValidObjectId(assignmentData.chef) ||
      !isValidObjectId(assignmentData.itemId)
    ) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الطلب، المنتج، الطاهي، أو العنصر') : errorMessages.en.invalidId('order, product, chef, or item'));
    }
    const response = await api.post('/orders/tasks', trimObjectStrings(assignmentData));
    console.log(`[${new Date().toISOString()}] productionAssignmentsAPI.create - Response:`, response);
    return response;
  },
  getChefTasks: async (chefId: string, query: { page?: number; limit?: number; status?: string; search?: string } = {}) => {
    if (!isValidObjectId(chefId)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الطاهي') : errorMessages.en.invalidId('chef'));
    }
    const response = await api.get<PaginatedResponse<any>>(`/orders/tasks/chef/${chefId}`, { params: query });
    console.log(`[${new Date().toISOString()}] productionAssignmentsAPI.getChefTasks - Response:`, response);
    return response;
  },
  updateTaskStatus: async (orderId: string, taskId: string, data: { status: string }) => {
    if (!isValidObjectId(orderId) || !isValidObjectId(taskId)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الطلب أو المهمة') : errorMessages.en.invalidId('order or task'));
    }
    const response = await api.patch(`/orders/${orderId}/tasks/${taskId}/status`, trimObjectStrings(data));
    console.log(`[${new Date().toISOString()}] productionAssignmentsAPI.updateTaskStatus - Response:`, response);
    return response;
  },
  getAllTasks: async () => {
    const response = await api.get('/orders/tasks');
    console.log(`[${new Date().toISOString()}] productionAssignmentsAPI.getAllTasks - Response:`, response);
    return response;
  },
};

// Inventory API
export const inventoryAPI = {
  getInventory: async (params: { branch?: string; product?: string } = {}) => {
    if (params.branch && !isValidObjectId(params.branch)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الفرع') : errorMessages.en.invalidId('branch'));
    }
    if (params.product && !isValidObjectId(params.product)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('المنتج') : errorMessages.en.invalidId('product'));
    }
    const response = await api.get<{ inventory: Inventory[] }>('/inventory', { params });
    console.log(`[${new Date().toISOString()}] inventoryAPI.getInventory - Response:`, response);
    return response.inventory;
  },
  getByBranch: async (branchId: string) => {
    if (!isValidObjectId(branchId)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الفرع') : errorMessages.en.invalidId('branch'));
    }
    const response = await api.get<{ inventory: Inventory[] }>(`/inventory/branch/${branchId}`);
    console.log(`[${new Date().toISOString()}] inventoryAPI.getByBranch - Response:`, response);
    return response.inventory;
  },
  getAll: async (params: { branch?: string; product?: string } = {}) => {
    if (params.branch && !isValidObjectId(params.branch)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الفرع') : errorMessages.en.invalidId('branch'));
    }
    if (params.product && !isValidObjectId(params.product)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('المنتج') : errorMessages.en.invalidId('product'));
    }
    const response = await api.get<{ inventory: Inventory[] }>('/inventory', { params });
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
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الفرع، المنتج، المستخدم، أو الطلب') : errorMessages.en.invalidId('branch, product, user, or order'));
    }
    if (data.currentStock < 0) {
      throw new Error(getIsRtl() ? errorMessages.ar.negativeStock : errorMessages.en.negativeStock);
    }
    const response = await api.post<{ inventory: Inventory }>('/inventory', trimObjectStrings(data));
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
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الفرع، المستخدم، الطلب، أو العناصر') : errorMessages.en.invalidId('branch, user, order, or items'));
    }
    const response = await api.post<{ inventories: Inventory[] }>('/inventory/bulk', trimObjectStrings(data));
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
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('المخزون، المنتج، أو الفرع') : errorMessages.en.invalidId('inventory, product, or branch'));
    }
    if (data.currentStock !== undefined && data.currentStock < 0) {
      throw new Error(getIsRtl() ? errorMessages.ar.negativeStock : errorMessages.en.negativeStock);
    }
    const response = await api.put<{ inventory: Inventory }>(`/inventory/${id}`, trimObjectStrings(data));
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
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الإرجاع، الفرع، أو العناصر') : errorMessages.en.invalidId('return, branch, or items'));
    }
    const response = await api.patch('/inventory/returns/${returnId}/process', trimObjectStrings(data));
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
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('المنتج، الفرع، أو الكمية') : errorMessages.en.invalidId('product, branch, or quantity'));
    }
    const response = await api.post('/inventory/restock-requests', trimObjectStrings(data));
    console.log(`[${new Date().toISOString()}] inventoryAPI.createRestockRequest - Response:`, response);
    return response.restockRequest;
  },
  getRestockRequests: async (params: { branchId?: string } = {}) => {
    if (params.branchId && !isValidObjectId(params.branchId)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الفرع') : errorMessages.en.invalidId('branch'));
    }
    const response = await api.get('/inventory/restock-requests', { params });
    console.log(`[${new Date().toISOString()}] inventoryAPI.getRestockRequests - Response:`, response);
    return response.restockRequests;
  },
  approveRestockRequest: async (requestId: string, data: { approvedQuantity: number; userId: string }) => {
    if (!isValidObjectId(requestId) || !isValidObjectId(data.userId) || data.approvedQuantity < 1) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الطلب، المستخدم، أو الكمية') : errorMessages.en.invalidId('request, user, or quantity'));
    }
    const response = await api.patch('/inventory/restock-requests/${requestId}/approve', trimObjectStrings(data));
    console.log(`[${new Date().toISOString()}] inventoryAPI.approveRestockRequest - Response:`, response);
    return response.restockRequest;
  },
  getHistory: async (params: { branchId?: string; productId?: string } = {}) => {
    if (params.branchId && !isValidObjectId(params.branchId)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الفرع') : errorMessages.en.invalidId('branch'));
    }
    if (params.productId && !isValidObjectId(params.productId)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('المنتج') : errorMessages.en.invalidId('product'));
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
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الطلب، الفرع، السبب، أو العناصر') : errorMessages.en.invalidId('order, branch, reason, or items'));
    }
    const response = await api.post('/inventory/returns', trimObjectStrings(data));
    console.log(`[${new Date().toISOString()}] inventoryAPI.createReturn - Response:`, response);
    return response.returnRequest;
  },
};

// Factory Inventory API
export const factoryInventoryAPI = {
  getAll: async (params: { product?: string; department?: string; lowStock?: boolean } = {}) => {
    if (params.product && !isValidObjectId(params.product)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('المنتج') : errorMessages.en.invalidId('product'));
    }
    if (params.department && !isValidObjectId(params.department)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('القسم') : errorMessages.en.invalidId('department'));
    }
    const response = await api.get('/factory-inventory', { params });
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.getAll - Response:`, response);
    return response;
  },
  addProductionBatch: async (data: { productId: string; quantity: number }) => {
    if (!isValidObjectId(data.productId)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('المنتج') : errorMessages.en.invalidId('product'));
    }
    if (data.quantity < 1) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidQuantity : errorMessages.en.invalidQuantity);
    }
    const response = await api.post('/factory-inventory/production', trimObjectStrings(data));
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.addProductionBatch - Response:`, response);
    return response;
  },
  allocateToBranch: async (data: { requestId: string; productId: string; allocatedQuantity: number }) => {
    if (!isValidObjectId(data.requestId) || !isValidObjectId(data.productId)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الطلب أو المنتج') : errorMessages.en.invalidId('request or product'));
    }
    if (data.allocatedQuantity < 1) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidQuantity : errorMessages.en.invalidQuantity);
    }
    const response = await api.post('/factory-inventory/allocate', trimObjectStrings(data));
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
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الطلب') : errorMessages.en.invalidId('request'));
    }
    if (data.approvedQuantity < 1) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidQuantity : errorMessages.en.invalidQuantity);
    }
    const response = await api.patch('/factory-inventory/restock-requests/${requestId}/approve', trimObjectStrings(data));
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.approveRestockRequest - Response:`, response);
    return response;
  },
  getHistory: async (params: { productId?: string } = {}) => {
    if (params.productId && !isValidObjectId(params.productId)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('المنتج') : errorMessages.en.invalidId('product'));
    }
    const response = await api.get('/factory-inventory/history', { params });
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.getHistory - Response:`, response);
    return response;
  },
  getByBranch: async (branchId: string) => {
    if (!isValidObjectId(branchId)) {
      throw new Error(getIsRtl() ? errorMessages.ar.invalidId('الفرع') : errorMessages.en.invalidId('branch'));
    }
    const response = await api.get('/inventory/branch/${branchId}');
    console.log(`[${new Date().toISOString()}] factoryInventoryAPI.getByBranch - Response:`, response);
    return response;
  },
};

export { notificationsAPI, returnsAPI, salesAPI };
export default api;