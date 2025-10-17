import api, { isValidObjectId } from './api';

const isRtl = localStorage.getItem('language') === 'ar';

export const chefsAPI = {
  getAll: async (params: { page?: number; limit?: number; search?: string } = {}) => {
    try {
      const response = await api.get('/chefs', { params });
      console.log(`[${new Date().toISOString()}] chefsAPI.getAll - Response:`, response);
      if (!response || !Array.isArray(response.chefs)) {
        console.error(`[${new Date().toISOString()}] chefsAPI.getAll - Invalid response data:`, response);
        throw new Error(isRtl ? 'البيانات المستلمة من نقطة النهاية /chefs غير صالحة' : 'Invalid response data from /chefs endpoint');
      }
      return response; // Returns { chefs: Chef[], total: number, page: number, pages: number }
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] chefsAPI.getAll - Error:`, {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });
      throw new Error(err.message || (isRtl ? 'فشل في جلب الشيفات' : 'Failed to fetch chefs'));
    }
  },
  getByUserId: async (userId: string) => {
    if (!isValidObjectId(userId)) {
      console.error(`[${new Date().toISOString()}] chefsAPI.getByUserId - Invalid user ID:`, userId);
      throw new Error(isRtl ? 'معرف المستخدم غير صالح' : 'Invalid user ID');
    }
    try {
      const response = await api.get(`/chefs/by-user/${userId}`);
      console.log(`[${new Date().toISOString()}] chefsAPI.getByUserId - Response:`, response);
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] chefsAPI.getByUserId - Error:`, {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });
      throw new Error(err.message || (isRtl ? 'فشل في جلب بيانات الشيف' : 'Failed to fetch chef data'));
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
    if (!isValidObjectId(chefData.department)) {
      console.error(`[${new Date().toISOString()}] chefsAPI.create - Invalid department ID:`, chefData.department);
      throw new Error(isRtl ? 'معرف القسم غير صالح' : 'Invalid department ID');
    }
    try {
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
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] chefsAPI.create - Error:`, {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });
      throw new Error(err.message || (isRtl ? 'فشل في إنشاء الشيف' : 'Failed to create chef'));
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
      throw new Error(isRtl ? 'معرف الشيف غير صالح' : 'Invalid chef ID');
    }
    if (!isValidObjectId(chefData.department)) {
      console.error(`[${new Date().toISOString()}] chefsAPI.update - Invalid department ID:`, chefData.department);
      throw new Error(isRtl ? 'معرف القسم غير صالح' : 'Invalid department ID');
    }
    try {
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
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] chefsAPI.update - Error:`, {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });
      throw new Error(err.message || (isRtl ? 'فشل في تحديث الشيف' : 'Failed to update chef'));
    }
  },
  delete: async (id: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] chefsAPI.delete - Invalid chef ID:`, id);
      throw new Error(isRtl ? 'معرف الشيف غير صالح' : 'Invalid chef ID');
    }
    try {
      const response = await api.delete(`/chefs/${id}`);
      console.log(`[${new Date().toISOString()}] chefsAPI.delete - Response:`, response);
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] chefsAPI.delete - Error:`, {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });
      throw new Error(err.message || (isRtl ? 'فشل في حذف الشيف' : 'Failed to delete chef'));
    }
  },
  resetPassword: async (id: string, password: string) => {
    if (!isValidObjectId(id)) {
      console.error(`[${new Date().toISOString()}] chefsAPI.resetPassword - Invalid chef ID:`, id);
      throw new Error(isRtl ? 'معرف الشيف غير صالح' : 'Invalid chef ID');
    }
    try {
      const response = await api.post(`/chefs/${id}/reset-password`, { password });
      console.log(`[${new Date().toISOString()}] chefsAPI.resetPassword - Response:`, response);
      return response;
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] chefsAPI.resetPassword - Error:`, {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });
      throw new Error(err.message || (isRtl ? 'فشل في إعادة تعيين كلمة المرور' : 'Failed to reset password'));
    }
  },
};