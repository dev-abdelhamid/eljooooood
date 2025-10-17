import axios from 'axios';
import api from './api'; // استيراد api الرئيسي

const isValidObjectId = (id: string): boolean => /^[0-9a-fA-F]{24}$/.test(id);

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