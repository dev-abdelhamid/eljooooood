import axios from 'axios';
   import { toast } from 'react-toastify';

   const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';

   const returnsAxios = axios.create({
     baseURL: API_BASE_URL,
     timeout: 30000,
     headers: { 'Content-Type': 'application/json' },
   });

   returnsAxios.interceptors.request.use(
     (config) => {
       const token = localStorage.getItem('token');
       const language = localStorage.getItem('language') || 'ar';
       const isRtl = language === 'ar';
       if (token) {
         config.headers.Authorization = `Bearer ${token}`;
       }
       config.params = { ...config.params, lang: language };
       console.log(`[${new Date().toISOString()}] Returns API request:`, {
         url: config.url,
         method: config.method,
         headers: config.headers,
         params: config.params,
         data: config.data,
       });
       return config;
     },
     (error) => {
       console.error(`[${new Date().toISOString()}] Returns API request error:`, error);
       return Promise.reject(error);
     }
   );

   returnsAxios.interceptors.response.use(
     (response) => response,
     (error) => {
       const language = localStorage.getItem('language') || 'ar';
       const isRtl = language === 'ar';

       let message = error.response?.data?.message || error.message || (isRtl ? 'خطأ غير متوقع' : 'Unexpected error');
       const errors = error.response?.data?.errors || [];

       if (error.code === 'ECONNABORTED') {
         message = isRtl ? 'انتهت مهلة الطلب، حاول مرة أخرى' : 'Request timed out, please try again';
       } else if (!error.response) {
         message = isRtl ? 'فشل الاتصال بالخادم' : 'Failed to connect to server';
       } else if (error.response.status === 400) {
         message = errors.length
           ? errors.map((err: any) => err.msg).join(', ')
           : error.response.data?.message || (isRtl ? 'بيانات غير صالحة' : 'Invalid data');
       } else if (error.response.status === 403) {
         message = error.response.data?.message || (isRtl ? 'عملية غير مصرح بها' : 'Unauthorized operation');
       } else if (error.response.status === 404) {
         message = error.response.data?.message || (isRtl ? 'الفرع أو المنتج غير موجود' : 'Branch or product not found');
       } else if (error.response.status === 422) {
         message = error.response.data?.message || (isRtl ? 'الكمية غير كافية أو تتجاوز المسلم' : 'Insufficient quantity or exceeds delivered quantity');
       } else if (error.response.status === 429) {
         message = isRtl ? 'طلبات كثيرة جدًا، حاول مرة أخرى لاحقًا' : 'Too many requests, try again later';
       } else if (error.response.status === 500) {
         message = isRtl ? 'خطأ في الخادم، حاول مرة أخرى لاحقًا' : 'Server error, please try again later';
       }

       if (error.response?.status === 401) {
         console.error(`[${new Date().toISOString()}] Unauthorized:`, error);
         localStorage.removeItem('token');
         localStorage.removeItem('user');
         localStorage.removeItem('refreshToken');
         window.location.href = '/login';
         toast.error(isRtl ? 'التوكن منتهي الصلاحية، يرجى تسجيل الدخول مجددًا' : 'Token expired, please log in again', {
           position: isRtl ? 'top-right' : 'top-left',
           autoClose: 3000,
           pauseOnFocusLoss: true,
         });
         return Promise.reject({ message: isRtl ? 'التوكن منتهي الصلاحية' : 'Token expired', status: 401 });
       }

       console.error(`[${new Date().toISOString()}] Returns API response error:`, {
         status: error.response?.status,
         message,
         errors,
       });
       toast.error(message, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000, pauseOnFocusLoss: true });
       return Promise.reject({ message, status: error.response?.status, errors });
     }
   );

   const isValidObjectId = (id: string): boolean => /^[0-9a-fA-F]{24}$/.test(id);

   export const returnsAPI = {
     getAll: async (query: {
       status?: string;
       branch?: string;
       search?: string;
       sort?: string;
       page?: number;
       limit?: number;
     } = {}) => {
       console.log(`[${new Date().toISOString()}] returnsAPI.getAll - Sending:`, query);
       try {
         if (query.branch && !isValidObjectId(query.branch)) {
           console.error(`[${new Date().toISOString()}] returnsAPI.getAll - Invalid branch ID:`, query.branch);
           throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
         }
         const response = await returnsAxios.get('/returns', { params: query });
         console.log(`[${new Date().toISOString()}] returnsAPI.getAll - Response:`, response.data);
         return response.data;
       } catch (error: any) {
         console.error(`[${new Date().toISOString()}] returnsAPI.getAll - Error:`, error);
         throw error;
       }
     },

     getBranches: async () => {
       console.log(`[${new Date().toISOString()}] returnsAPI.getBranches - Sending`);
       try {
         const response = await returnsAxios.get('/branches');
         console.log(`[${new Date().toISOString()}] returnsAPI.getBranches - Response:`, response.data);
         return response.data;
       } catch (error: any) {
         console.error(`[${new Date().toISOString()}] returnsAPI.getBranches - Error:`, error);
         throw error;
       }
     },

     getAvailableStock: async (branchId: string, productIds: string[]) => {
       console.log(`[${new Date().toISOString()}] returnsAPI.getAvailableStock - Sending:`, { branchId, productIds });
       try {
         if (!isValidObjectId(branchId)) {
           console.error(`[${new Date().toISOString()}] returnsAPI.getAvailableStock - Invalid branch ID:`, branchId);
           throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
         }
         if (productIds.some((id) => !isValidObjectId(id))) {
           console.error(`[${new Date().toISOString()}] returnsAPI.getAvailableStock - Invalid product ID in:`, productIds);
           throw new Error(isRtl ? 'معرف منتج غير صالح' : 'Invalid product ID');
         }
         const response = await returnsAxios.get('/inventory/available', {
           params: { branchId, productIds: productIds.join(',') },
         });
         console.log(`[${new Date().toISOString()}] returnsAPI.getAvailableStock - Response:`, response.data);
         return response.data;
       } catch (error: any) {
         console.error(`[${new Date().toISOString()}] returnsAPI.getAvailableStock - Error:`, error);
         throw error;
       }
     },

     createReturn: async (data: {
       branchId: string;
       items: Array<{
         product: string;
         quantity: number;
         reason: string;
         reasonEn: string;
         price?: number;
       }>;
       notes?: string;
       orders?: string[];
     }) => {
       console.log(`[${new Date().toISOString()}] returnsAPI.createReturn - Sending:`, data);
       try {
         if (!isValidObjectId(data.branchId)) {
           console.error(`[${new Date().toISOString()}] returnsAPI.createReturn - Invalid branch ID:`, data.branchId);
           throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
         }
         for (const [index, item] of data.items.entries()) {
           if (!isValidObjectId(item.product)) {
             console.error(`[${new Date().toISOString()}] returnsAPI.createReturn - Invalid product ID at item ${index}:`, item.product);
             throw new Error(isRtl ? `معرف المنتج غير صالح في العنصر ${index + 1}` : `Invalid product ID at item ${index + 1}`);
           }
         }
         const response = await returnsAxios.post('/returns', data);
         console.log(`[${new Date().toISOString()}] returnsAPI.createReturn - Response:`, response.data);
         return response.data;
       } catch (error: any) {
         console.error(`[${new Date().toISOString()}] returnsAPI.createReturn - Error:`, error);
         throw error;
       }
     },

     updateReturnStatus: async (returnId: string, status: string, reviewNotes?: string) => {
       console.log(`[${new Date().toISOString()}] returnsAPI.updateReturnStatus - Sending:`, { returnId, status, reviewNotes });
       try {
         if (!isValidObjectId(returnId)) {
           console.error(`[${new Date().toISOString()}] returnsAPI.updateReturnStatus - Invalid return ID:`, returnId);
           throw new Error(isRtl ? 'معرف الإرجاع غير صالح' : 'Invalid return ID');
         }
         const response = await returnsAxios.put(`/returns/${returnId}`, { status, reviewNotes });
         console.log(`[${new Date().toISOString()}] returnsAPI.updateReturnStatus - Response:`, response.data);
         return response.data;
       } catch (error: any) {
         console.error(`[${new Date().toISOString()}] returnsAPI.updateReturnStatus - Error:`, error);
         throw error;
       }
     },

     getReturnById: async (returnId: string) => {
       console.log(`[${new Date().toISOString()}] returnsAPI.getReturnById - Sending:`, returnId);
       try {
         if (!isValidObjectId(returnId)) {
           console.error(`[${new Date().toISOString()}] returnsAPI.getReturnById - Invalid return ID:`, returnId);
           throw new Error(isRtl ? 'معرف الإرجاع غير صالح' : 'Invalid return ID');
         }
         const response = await returnsAxios.get(`/returns/${returnId}`);
         console.log(`[${new Date().toISOString()}] returnsAPI.getReturnById - Response:`, response.data);
         return response.data;
       } catch (error: any) {
         console.error(`[${new Date().toISOString()}] returnsAPI.getReturnById - Error:`, error);
         throw error;
       }
     },
   };

   export default returnsAPI;