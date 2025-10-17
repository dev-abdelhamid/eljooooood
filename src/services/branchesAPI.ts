import axios from 'axios';
import api from './api';

const isValidObjectId = (id: string): boolean => /^[0-9a-fA-F]{24}$/.test(id);

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