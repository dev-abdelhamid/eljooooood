import React, { useReducer, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { branchesAPI, ordersAPI, returnsAPI, productsAPI, salesAPI } from '../services/api';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Edit2, Trash2, Key, AlertCircle, MapPin, Box, Package, TrendingUp, Calendar } from 'lucide-react';
import { FormInput } from './ChefDetails';
import { Chart as ChartJS, ArcElement, BarElement, LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend } from 'chart.js';
import { debounce } from 'lodash';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';

const Bar = lazy(() => import('react-chartjs-2').then(module => ({ default: module.Bar })));
const Line = lazy(() => import('react-chartjs-2').then(module => ({ default: module.Line })));
const Pie = lazy(() => import('react-chartjs-2').then(module => ({ default: module.Pie })));

ChartJS.register(ArcElement, BarElement, LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend);

interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  phone?: string;
  user?: {
    id: string;
    name: string;
    username: string;
    email?: string;
    phone?: string;
    createdAt: string;
    updatedAt: string;
  };
  createdBy?: {
    id: string;
    name: string;
    username: string;
    displayName: string;
  };
  createdAt: string;
  updatedAt: string;
  displayName: string;
  displayAddress: string;
  displayCity: string;
}

interface Product {
  id: string;
  name: string;
  nameEn?: string;
  displayName: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  totalQuantity: number;
  createdAt: string;
  items: Array<{
    product: string;
    quantity: number;
    price: number;
  }>;
}

interface Return {
  id: string;
  returnNumber: string;
  status: string;
  total: number;
  totalQuantity: number;
  createdAt: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}

interface Sale {
  id: string;
  orderId: string;
  totalAmount: number;
  createdAt: string;
}

interface FormState {
  name: string;
  code: string;
  address: string;
  city: string;
  phone: string;
  user: {
    name: string;
    username: string;
    email: string;
    phone: string;
  };
}

interface State {
  branch: Branch | null;
  orders: Order[];
  returns: Return[];
  sales: Sale[];
  products: Product[];
  activeTab: 'info' | 'stats' | 'orders' | 'returns';
  isEditModalOpen: boolean;
  isResetPasswordModalOpen: boolean;
  isDeleteModalOpen: boolean;
  formData: FormState;
  passwordData: { password: string; confirmPassword: string };
  formErrors: Record<string, string>;
  error: string;
  loading: boolean;
  ordersLoading: boolean;
  returnsLoading: boolean;
  salesLoading: boolean;
  productsLoading: boolean;
  showPassword: boolean;
  showConfirmPassword: boolean;
}

interface Action {
  type: string;
  payload?: any;
}

const initialState: State = {
  branch: null,
  orders: [],
  returns: [],
  sales: [],
  products: [],
  activeTab: 'info',
  isEditModalOpen: false,
  isResetPasswordModalOpen: false,
  isDeleteModalOpen: false,
  formData: {
    name: '',
    code: '',
    address: '',
    city: '',
    phone: '',
    user: {
      name: '',
      username: '',
      email: '',
      phone: '',
    },
  },
  passwordData: { password: '', confirmPassword: '' },
  formErrors: {},
  error: '',
  loading: true,
  ordersLoading: true,
  returnsLoading: true,
  salesLoading: true,
  productsLoading: true,
  showPassword: false,
  showConfirmPassword: false,
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_BRANCH':
      return { ...state, branch: action.payload, loading: false };
    case 'SET_ORDERS':
      return { ...state, orders: action.payload, ordersLoading: false };
    case 'SET_RETURNS':
      return { ...state, returns: action.payload, returnsLoading: false };
    case 'SET_SALES':
      return { ...state, sales: action.payload, salesLoading: false };
    case 'SET_PRODUCTS':
      return { ...state, products: action.payload, productsLoading: false };
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_MODAL':
      return { ...state, [action.payload.modal]: action.payload.isOpen };
    case 'SET_FORM_DATA':
      return { ...state, formData: action.payload };
    case 'SET_PASSWORD_DATA':
      return { ...state, passwordData: action.payload };
    case 'SET_FORM_ERRORS':
      return { ...state, formErrors: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ORDERS_LOADING':
      return { ...state, ordersLoading: action.payload };
    case 'SET_RETURNS_LOADING':
      return { ...state, returnsLoading: action.payload };
    case 'SET_SALES_LOADING':
      return { ...state, salesLoading: action.payload };
    case 'SET_PRODUCTS_LOADING':
      return { ...state, productsLoading: action.payload };
    case 'TOGGLE_PASSWORD_VISIBILITY':
      return { ...state, [action.payload.field]: !state[action.payload.field] };
    default:
      return state;
  }
};

const translations = {
  ar: {
    branchDetails: 'تفاصيل الفرع',
    branchInfoTab: 'معلومات الفرع',
    statsTab: 'إحصائيات الفرع',
    ordersTab: 'الطلبات الحديثة',
    returnsTab: 'المرتجعات الحديثة',
    name: 'اسم الفرع',
    code: 'الكود',
    address: 'العنوان',
    city: 'المدينة',
    phone: 'رقم الهاتف',
    user: 'المستخدم',
    userName: 'اسم المستخدم',
    username: 'اسم المستخدم',
    email: 'الإيميل',
    userPhone: 'هاتف المستخدم',
    createdBy: 'تم الإنشاء بواسطة',
    createdAt: 'تاريخ الإنشاء',
    updatedAt: 'تاريخ التحديث',
    editBranch: 'تعديل الفرع',
    deleteBranch: 'حذف الفرع',
    resetPassword: 'إعادة تعيين كلمة المرور',
    save: 'حفظ',
    cancel: 'إلغاء',
    back: 'رجوع',
    newPassword: 'كلمة المرور الجديدة',
    confirmPassword: 'تأكيد كلمة المرور',
    passwordPlaceholder: 'أدخل كلمة المرور الجديدة',
    confirmPasswordPlaceholder: 'تأكيد كلمة المرور',
    passwordMismatch: 'كلمة المرور وتأكيدها غير متطابقتين',
    passwordTooShort: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
    passwordRequired: 'كلمة المرور مطلوبة',
    branchNotFound: 'الفرع غير موجود',
    serverError: 'خطأ في السيرفر',
    branchUpdated: 'تم تحديث الفرع بنجاح',
    branchDeleted: 'تم حذف الفرع بنجاح',
    passwordReset: 'تم إعادة تعيين كلمة المرور بنجاح',
    emailInUse: 'الإيميل مستخدم بالفعل، اختر إيميل آخر',
    usernameInUse: 'اسم المستخدم مستخدم بالفعل، اختر اسمًا آخر',
    codeInUse: 'كود الفرع مستخدم بالفعل، اختر كودًا آخر',
    requiredField: 'هذا الحقل مطلوب',
    deleteWarning: 'هل أنت متأكد من حذف هذا الفرع؟ لا يمكن التراجع عن هذا الإجراء.',
    deleteRestricted: 'لا يمكن حذف الفرع لوجود طلبات أو مخزون مرتبط',
    confirmDelete: 'تأكيد حذف الفرع',
    noOrders: 'لا توجد طلبات حديثة',
    noReturns: 'لا توجد مرتجعات حديثة',
    noProducts: 'لا توجد منتجات',
    orderNumber: 'رقم الطلب',
    returnNumber: 'رقم المرتجع',
    status: 'الحالة',
    total: 'الإجمالي',
    totalQuantity: 'الكمية الإجمالية',
    totalOrders: 'إجمالي الطلبات الحديثة',
    totalReturns: 'إجمالي المرتجعات الحديثة',
    totalSales: 'إجمالي المبيعات',
    avgDailyOrders: 'متوسط الطلبات اليومي',
    topProducts: 'المنتجات الأكثر طلبًا',
    ordersVsReturns: 'حركة الطلبات والمرتجعات',
    ordersByStatus: 'الطلبات حسب الحالة',
    status_mukammal: 'مكتمل',
    status_qaid_al_tanfeez: 'قيد التنفيذ',
    status_malgha: 'ملغى',
    status_approved: 'معتمد',
    status_rejected: 'مرفوض',
    status_pending: 'قيد الانتظار',
  },
  en: {
    branchDetails: 'Branch Details',
    branchInfoTab: 'Branch Info',
    statsTab: 'Branch Stats',
    ordersTab: 'Recent Orders',
    returnsTab: 'Recent Returns',
    name: 'Branch Name',
    code: 'Code',
    address: 'Address',
    city: 'City',
    phone: 'Phone',
    user: 'User',
    userName: 'User Name',
    username: 'Username',
    email: 'Email',
    userPhone: 'User Phone',
    createdBy: 'Created By',
    createdAt: 'Created At',
    updatedAt: 'Updated At',
    editBranch: 'Edit Branch',
    deleteBranch: 'Delete Branch',
    resetPassword: 'Reset Password',
    save: 'Save',
    cancel: 'Cancel',
    back: 'Back',
    newPassword: 'New Password',
    confirmPassword: 'Confirm Password',
    passwordPlaceholder: 'Enter new password',
    confirmPasswordPlaceholder: 'Confirm password',
    passwordMismatch: 'Passwords do not match',
    passwordTooShort: 'Password must be at least 6 characters',
    passwordRequired: 'Password is required',
    branchNotFound: 'Branch not found',
    serverError: 'Server error',
    branchUpdated: 'Branch updated successfully',
    branchDeleted: 'Branch deleted successfully',
    passwordReset: 'Password reset successfully',
    emailInUse: 'Email is already in use, choose another',
    usernameInUse: 'Username is already in use, choose another',
    codeInUse: 'Branch code is already in use, choose another',
    requiredField: 'This field is required',
    deleteWarning: 'Are you sure you want to delete this branch? This action cannot be undone.',
    deleteRestricted: 'Cannot delete branch with associated orders or inventory',
    confirmDelete: 'Confirm Branch Deletion',
    noOrders: 'No recent orders available',
    noReturns: 'No recent returns available',
    noProducts: 'No products available',
    orderNumber: 'Order Number',
    returnNumber: 'Return Number',
    status: 'Status',
    total: 'Total',
    totalQuantity: 'Total Quantity',
    totalOrders: 'Total Recent Orders',
    totalReturns: 'Total Recent Returns',
    totalSales: 'Total Sales',
    avgDailyOrders: 'Average Daily Orders',
    topProducts: 'Top Ordered Products',
    ordersVsReturns: 'Orders vs Returns Activity',
    ordersByStatus: 'Orders by Status',
    status_mukammal: 'Completed',
    status_qaid_al_tanfeez: 'In Progress',
    status_malgha: 'Cancelled',
    status_approved: 'Approved',
    status_rejected: 'Rejected',
    status_pending: 'Pending',
  },
};

const BranchProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [state, dispatch] = useReducer(reducer, initialState);

  const getRecentDateRange = useCallback(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);
    return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
  }, []);

  const fetchBranch = useCallback(
    async (retryCount = 0) => {
      if (!id || !user || user.role !== 'admin') {
        dispatch({ type: 'SET_ERROR', payload: t.branchNotFound });
        dispatch({ type: 'SET_LOADING', payload: false });
        toast.error(t.branchNotFound, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const response = await branchesAPI.getById(id);
        const branchData: Branch = {
          id: response._id,
          name: response.name,
          code: response.code,
          address: response.address,
          city: response.city,
          phone: response.phone,
          user: response.user
            ? {
                id: response.user._id,
                name: response.user.name,
                username: response.user.username,
                email: response.user.email,
                phone: response.user.phone,
                createdAt: response.user.createdAt,
                updatedAt: response.user.updatedAt,
              }
            : undefined,
          createdBy: response.createdBy
            ? {
                id: response.createdBy._id,
                name: response.createdBy.name,
                username: response.createdBy.username,
                displayName: response.createdBy.name,
              }
            : undefined,
          createdAt: response.createdAt,
          updatedAt: response.updatedAt,
          displayName: response.name,
          displayAddress: response.address,
          displayCity: response.city,
        };
        dispatch({ type: 'SET_BRANCH', payload: branchData });
        dispatch({
          type: 'SET_FORM_DATA',
          payload: {
            name: branchData.name,
            code: branchData.code,
            address: branchData.address,
            city: branchData.city,
            phone: branchData.phone || '',
            user: {
              name: branchData.user?.name || '',
              username: branchData.user?.username || '',
              email: branchData.user?.email || '',
              phone: branchData.user?.phone || '',
            },
          },
        });
        dispatch({ type: 'SET_ERROR', payload: '' });
      } catch (err: any) {
        if (retryCount < 2) {
          setTimeout(() => fetchBranch(retryCount + 1), 1000);
          return;
        }
        dispatch({ type: 'SET_ERROR', payload: err.message || t.branchNotFound });
        toast.error(err.message || t.branchNotFound, { position: isRtl ? 'top-right' : 'top-left' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [id, user, t, isRtl]
  );

  const fetchOrders = useCallback(
    async (retryCount = 0) => {
      if (!id) return;
      dispatch({ type: 'SET_ORDERS_LOADING', payload: true });
      try {
        const { startDate, endDate } = getRecentDateRange();
        const response = await ordersAPI.getAll({
          branch: id,
          startDate,
          endDate,
          limit: 50,
          sort: '-createdAt',
        });
        const mappedOrders: Order[] = response.map((order: any) => ({
          id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          total: Number(order.totalAmount) || 0,
          totalQuantity: order.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
          createdAt: order.createdAt,
          items: order.items.map((item: any) => ({
            product: item.product,
            quantity: item.quantity,
            price: item.price,
          })),
        }));
        dispatch({ type: 'SET_ORDERS', payload: mappedOrders });
      } catch (err: any) {
        if (retryCount < 2) {
          setTimeout(() => fetchOrders(retryCount + 1), 1000);
          return;
        }
        toast.error(t.noOrders, { position: isRtl ? 'top-right' : 'top-left' });
      } finally {
        dispatch({ type: 'SET_ORDERS_LOADING', payload: false });
      }
    },
    [id, t, isRtl, getRecentDateRange]
  );

  const fetchReturns = useCallback(
    async (retryCount = 0) => {
      if (!id) return;
      dispatch({ type: 'SET_RETURNS_LOADING', payload: true });
      try {
        const { startDate, endDate } = getRecentDateRange();
        const response = await returnsAPI.getAll({
          branchId: id,
          startDate,
          endDate,
          limit: 50,
          sort: '-createdAt',
        });
        const mappedReturns: Return[] = response.map((returnItem: any) => ({
          id: returnItem._id,
          returnNumber: returnItem.returnNumber,
          status: returnItem.status,
          total: Number(returnItem.items.reduce((sum: number, item: any) => sum + item.quantity * item.price, 0)) || 0,
          totalQuantity: returnItem.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
          createdAt: returnItem.createdAt,
          items: returnItem.items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        }));
        dispatch({ type: 'SET_RETURNS', payload: mappedReturns });
      } catch (err: any) {
        if (retryCount < 2) {
          setTimeout(() => fetchReturns(retryCount + 1), 1000);
          return;
        }
        toast.error(t.noReturns, { position: isRtl ? 'top-right' : 'top-left' });
      } finally {
        dispatch({ type: 'SET_RETURNS_LOADING', payload: false });
      }
    },
    [id, t, isRtl, getRecentDateRange]
  );

  const fetchSales = useCallback(
    async (retryCount = 0) => {
      if (!id) return;
      dispatch({ type: 'SET_SALES_LOADING', payload: true });
      try {
        const { startDate, endDate } = getRecentDateRange();
        const response = await salesAPI.getAll({
          branchId: id,
          startDate,
          endDate,
          limit: 50,
          sort: '-createdAt',
        });
        const mappedSales: Sale[] = response.map((sale: any) => ({
          id: sale._id,
          orderId: sale.orderId,
          totalAmount: Number(sale.totalAmount) || 0,
          createdAt: sale.createdAt,
        }));
        dispatch({ type: 'SET_SALES', payload: mappedSales });
      } catch (err: any) {
        if (retryCount < 2) {
          setTimeout(() => fetchSales(retryCount + 1), 1000);
          return;
        }
        toast.error(t.serverError, { position: isRtl ? 'top-right' : 'top-left' });
      } finally {
        dispatch({ type: 'SET_SALES_LOADING', payload: false });
      }
    },
    [id, t, isRtl, getRecentDateRange]
  );

  const fetchProducts = useCallback(
    async (retryCount = 0) => {
      dispatch({ type: 'SET_PRODUCTS_LOADING', payload: true });
      try {
        const response = await productsAPI.getAll({ limit: 0 });
        const mappedProducts: Product[] = response.data.map((product: any) => ({
          id: product._id,
          name: product.name,
          nameEn: product.nameEn,
          displayName: isRtl ? product.name : (product.nameEn || product.name),
        }));
        dispatch({ type: 'SET_PRODUCTS', payload: mappedProducts });
      } catch (err: any) {
        if (retryCount < 2) {
          setTimeout(() => fetchProducts(retryCount + 1), 1000);
          return;
        }
        toast.error(t.noProducts, { position: isRtl ? 'top-right' : 'top-left' });
      } finally {
        dispatch({ type: 'SET_PRODUCTS_LOADING', payload: false });
      }
    },
    [t, isRtl]
  );

  const validateForm = useCallback(
    async () => {
      const errors: Record<string, string> = {};
      if (!state.formData.name.trim()) errors.name = t.requiredField;
      if (!state.formData.code.trim()) errors.code = t.requiredField;
      if (!state.formData.address.trim()) errors.address = t.requiredField;
      if (!state.formData.city.trim()) errors.city = t.requiredField;
      if (!state.formData.user.name.trim()) errors['user.name'] = t.requiredField;
      if (!state.formData.user.username.trim()) errors['user.username'] = t.requiredField;
      if (state.formData.user.email.trim()) {
        try {
          const isEmailAvailable = await branchesAPI.checkEmail(state.formData.user.email);
          if (!isEmailAvailable && state.formData.user.email !== state.branch?.user?.email) {
            errors['user.email'] = t.emailInUse;
          }
        } catch {
          errors['user.email'] = t.serverError;
        }
      }
      dispatch({ type: 'SET_FORM_ERRORS', payload: errors });
      return Object.keys(errors).length === 0;
    },
    [state.formData, state.branch, t]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!(await validateForm())) {
        toast.error(t.requiredField, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        const branchData = {
          name: state.formData.name.trim(),
          code: state.formData.code.trim(),
          address: state.formData.address.trim(),
          city: state.formData.city.trim(),
          phone: state.formData.phone.trim() || undefined,
          user: {
            name: state.formData.user.name.trim(),
            username: state.formData.user.username.trim(),
            email: state.formData.user.email.trim() || undefined,
            phone: state.formData.user.phone.trim() || undefined,
          },
        };
        const response = await branchesAPI.update(id!, branchData);
        dispatch({
          type: 'SET_BRANCH',
          payload: {
            ...response,
            displayName: response.name,
            displayAddress: response.address,
            displayCity: response.city,
            user: response.user
              ? { ...response.user, displayName: response.user.name }
              : undefined,
            createdBy: response.createdBy
              ? { ...response.createdBy, displayName: response.createdBy.name }
              : undefined,
          },
        });
        toast.success(t.branchUpdated, { position: isRtl ? 'top-right' : 'top-left' });
        dispatch({ type: 'SET_MODAL', payload: { modal: 'isEditModalOpen', isOpen: false } });
      } catch (err: any) {
        const errorMessage =
          err.message?.includes('code') ? t.codeInUse :
          err.message?.includes('username') ? t.usernameInUse :
          err.message?.includes('email') ? t.emailInUse : t.serverError;
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [id, state.formData, t, isRtl, validateForm]
  );

  const handleResetPassword = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!state.passwordData.password || !state.passwordData.confirmPassword) {
        dispatch({ type: 'SET_ERROR', payload: t.passwordRequired });
        toast.error(t.passwordRequired, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      if (state.passwordData.password !== state.passwordData.confirmPassword) {
        dispatch({ type: 'SET_ERROR', payload: t.passwordMismatch });
        toast.error(t.passwordMismatch, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      if (state.passwordData.password.length < 6) {
        dispatch({ type: 'SET_ERROR', payload: t.passwordTooShort });
        toast.error(t.passwordTooShort, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        await branchesAPI.resetPassword(id!, state.passwordData.password);
        toast.success(t.passwordReset, { position: isRtl ? 'top-right' : 'top-left' });
        dispatch({ type: 'SET_MODAL', payload: { modal: 'isResetPasswordModalOpen', isOpen: false } });
        dispatch({ type: 'SET_PASSWORD_DATA', payload: { password: '', confirmPassword: '' } });
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', payload: err.message || t.serverError });
        toast.error(err.message || t.serverError, { position: isRtl ? 'top-right' : 'top-left' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [id, state.passwordData, t, isRtl]
  );

  const handleDelete = useCallback(
    async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        await branchesAPI.delete(id!);
        toast.success(t.branchDeleted, { position: isRtl ? 'top-right' : 'top-left' });
        navigate('/branches');
      } catch (err: any) {
        const errorMessage = err.message?.includes('orders or inventory') ? t.deleteRestricted : t.serverError;
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [id, t, isRtl, navigate]
  );

  const statsData = useMemo(() => {
    const totalOrders = state.orders.length;
    const totalReturns = state.returns.length;
    const totalSales = state.sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const days = [...new Set(state.orders.map(item => new Date(item.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')))].length;
    const avgDailyOrders = days > 0 ? (totalOrders / days).toFixed(2) : '0';

    const productQuantities = state.orders.reduce((acc, order) => {
      order.items.forEach(item => {
        acc[item.product] = (acc[item.product] || 0) + item.quantity;
      });
      return acc;
    }, {} as Record<string, number>);

    const topProducts = Object.entries(productQuantities)
      .map(([productId, quantity]) => ({
        productId,
        quantity,
        name: state.products.find(p => p.id === productId)?.displayName || `منتج ${productId}`,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const topProductsData = {
      labels: topProducts.map(p => p.name),
      datasets: [{
        label: t.topProducts,
        data: topProducts.map(p => p.quantity),
        backgroundColor: [
          'rgba(245, 158, 11, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(147, 51, 234, 0.8)',
        ],
        borderColor: [
          'rgba(245, 158, 11, 1)',
          'rgba(59, 130, 246, 1)',
          'rgba(16, 185, 129, 1)',
          'rgba(239, 68, 68, 1)',
          'rgba(147, 51, 234, 1)',
        ],
        borderWidth: 1,
        hoverBackgroundColor: [
          'rgba(245, 158, 11, 1)',
          'rgba(59, 130, 246, 1)',
          'rgba(16, 185, 129, 1)',
          'rgba(239, 68, 68, 1)',
          'rgba(147, 51, 234, 1)',
        ],
        hoverBorderWidth: 2,
      }],
    };

    const activityDates = [...new Set([
      ...state.orders.map(o => new Date(o.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')),
      ...state.returns.map(r => new Date(r.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')),
    ])].sort();

    const ordersByDate = activityDates.reduce((acc, date) => {
      acc[date] = state.orders.filter(o => new Date(o.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US') === date).length;
      return acc;
    }, {} as Record<string, number>);

    const returnsByDate = activityDates.reduce((acc, date) => {
      acc[date] = state.returns.filter(r => new Date(r.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US') === date).length;
      return acc;
    }, {} as Record<string, number>);

    const ordersVsReturnsData = {
      labels: activityDates,
      datasets: [
        {
          label: t.ordersTab,
          data: activityDates.map(date => ordersByDate[date] || 0),
          borderColor: 'rgba(245, 158, 11, 1)',
          backgroundColor: 'rgba(245, 158, 11, 0.2)',
          fill: true,
          tension: 0.4,
        },
        {
          label: t.returnsTab,
          data: activityDates.map(date => returnsByDate[date] || 0),
          borderColor: 'rgba(239, 68, 68, 1)',
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          fill: true,
          tension: 0.4,
        },
      ],
    };

    const statusCounts = state.orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const pieData = {
      labels: Object.keys(statusCounts).map(status => t[`status_${status}`] || status),
      datasets: [{
        data: Object.values(statusCounts),
        backgroundColor: [
          'rgba(245, 158, 11, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(16, 185, 129, 0.8)',
        ],
        borderColor: [
          'rgba(245, 158, 11, 1)',
          'rgba(59, 130, 246, 1)',
          'rgba(239, 68, 68, 1)',
          'rgba(16, 185, 129, 1)',
        ],
        borderWidth: 1,
        hoverOffset: 20,
      }],
    };

    return { totalOrders, totalReturns, totalSales, avgDailyOrders, topProductsData, ordersVsReturnsData, pieData };
  }, [state.orders, state.returns, state.sales, state.products, t, isRtl]);

  useEffect(() => {
    const loadData = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ORDERS_LOADING', payload: true });
      dispatch({ type: 'SET_RETURNS_LOADING', payload: true });
      dispatch({ type: 'SET_SALES_LOADING', payload: true });
      dispatch({ type: 'SET_PRODUCTS_LOADING', payload: true });

      try {
        await Promise.all([
          fetchBranch(),
          fetchOrders(),
          fetchReturns(),
          fetchSales(),
          fetchProducts(),
        ]);
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', payload: err.message || t.serverError });
        toast.error(err.message || t.serverError, { position: isRtl ? 'top-right' : 'top-left' });
      }
    };

    loadData();
  }, [fetchBranch, fetchOrders, fetchReturns, fetchSales, fetchProducts, t, isRtl]);

  return (
    <div className="mx-auto px-4 py-6 min-h-screen bg-white" dir={isRtl ? 'rtl' : 'ltr'}>
      <Suspense fallback={<LoadingSpinner size="lg" />}>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="flex items-center justify-between mb-4 shadow-sm bg-white p-4 rounded-xl"
        >
          <div className="flex items-center gap-2">
            <MapPin className="w-6 h-6 text-amber-600" />
            <h1 className="text-xl font-bold text-gray-900">{t.branchDetails}</h1>
          </div>
          <button
            onClick={() => navigate('/branches')}
            className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-sm hover:shadow-md"
            aria-label={t.back}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t.back}
          </button>
        </motion.div>

        <AnimatePresence>
          {state.error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 shadow-sm"
            >
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-red-600 text-xs">{state.error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {(state.loading || state.ordersLoading || state.returnsLoading || state.salesLoading || state.productsLoading) ? (
          <div className="flex items-center justify-center min-h-[50vh] bg-gray-50">
            <LoadingSpinner size="lg" />
          </div>
        ) : !state.branch ? (
          <div className="flex items-center justify-center min-h-[50vh] bg-gray-50">
            <div className="p-5 bg-white rounded-xl shadow-sm max-w-md w-full text-center">
              <AlertCircle className="w-10 h-10 text-red-600 mx-auto mb-3" />
              <p className="text-gray-600 text-sm">{t.branchNotFound}</p>
              <button
                onClick={() => navigate('/branches')}
                className="mt-3 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors flex items-center gap-1.5 mx-auto shadow-sm hover:shadow-md"
                aria-label={t.back}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {t.back}
              </button>
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-xl shadow-sm p-5"
          >
            <div className="flex border-b border-gray-200 mb-4">
              <button
                onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: 'info' })}
                className={`px-4 py-2 text-xs font-medium ${state.activeTab === 'info' ? 'border-b-2 border-amber-600 text-amber-600' : 'text-gray-600 hover:text-amber-600'} transition-colors`}
                aria-label={t.branchInfoTab}
              >
                {t.branchInfoTab}
              </button>
              <button
                onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: 'stats' })}
                className={`px-4 py-2 text-xs font-medium ${state.activeTab === 'stats' ? 'border-b-2 border-amber-600 text-amber-600' : 'text-gray-600 hover:text-amber-600'} transition-colors`}
                aria-label={t.statsTab}
              >
                {t.statsTab}
              </button>
              <button
                onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: 'orders' })}
                className={`px-4 py-2 text-xs font-medium ${state.activeTab === 'orders' ? 'border-b-2 border-amber-600 text-amber-600' : 'text-gray-600 hover:text-amber-600'} transition-colors`}
                aria-label={t.ordersTab}
              >
                {t.ordersTab}
              </button>
              <button
                onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: 'returns' })}
                className={`px-4 py-2 text-xs font-medium ${state.activeTab === 'returns' ? 'border-b-2 border-amber-600 text-amber-600' : 'text-gray-600 hover:text-amber-600'} transition-colors`}
                aria-label={t.returnsTab}
              >
                {t.returnsTab}
              </button>
            </div>

            <AnimatePresence mode="wait">
              {state.activeTab === 'info' ? (
                <motion.div
                  key="info"
                  initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: isRtl ? -20 : 20 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-gray-900">{state.branch.displayName}</h2>
                    <MapPin className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="block text-xs font-medium text-gray-700">{t.name}</span>
                      <span className="text-xs text-gray-600">{state.branch.displayName}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-gray-700">{t.code}</span>
                      <span className="text-xs text-gray-600">{state.branch.code || '-'}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-gray-700">{t.address}</span>
                      <span className="text-xs text-gray-600">{state.branch.displayAddress || '-'}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-gray-700">{t.city}</span>
                      <span className="text-xs text-gray-600">{state.branch.displayCity || '-'}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-gray-700">{t.phone}</span>
                      <span className="text-xs text-gray-600">{state.branch.phone || '-'}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-gray-700">{t.createdBy}</span>
                      <span className="text-xs text-gray-600">{state.branch.createdBy?.displayName || '-'}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-gray-700">{t.createdAt}</span>
                      <span className="text-xs text-gray-600">{new Date(state.branch.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-gray-700">{t.updatedAt}</span>
                      <span className="text-xs text-gray-600">{new Date(state.branch.updatedAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}</span>
                    </div>
                    {state.branch.user && (
                      <>
                        <div>
                          <span className="block text-xs font-medium text-gray-700">{t.userName}</span>
                          <span className="text-xs text-gray-600">{state.branch.user.name}</span>
                        </div>
                        <div>
                          <span className="block text-xs font-medium text-gray-700">{t.username}</span>
                          <span className="text-xs text-gray-600">{state.branch.user.username || '-'}</span>
                        </div>
                        <div>
                          <span className="block text-xs font-medium text-gray-700">{t.email}</span>
                          <span className="text-xs text-gray-600">{state.branch.user.email || '-'}</span>
                        </div>
                        <div>
                          <span className="block text-xs font-medium text-gray-700">{t.userPhone}</span>
                          <span className="text-xs text-gray-600">{state.branch.user.phone || '-'}</span>
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              ) : state.activeTab === 'stats' ? (
                <motion.div
                  key="stats"
                  initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: isRtl ? -20 : 20 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="space-y-4"
                >
                  <h2 className="text-lg font-semibold text-gray-900">{t.statsTab}</h2>
                  {state.ordersLoading || state.returnsLoading || state.salesLoading || state.productsLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[...Array(3)].map((_, index) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-lg animate-pulse">
                          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                          <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                        </div>
                      ))}
                    </div>
                  ) : (state.orders.length === 0 && state.returns.length === 0 && state.sales.length === 0) ? (
                    <div className="text-center text-xs text-gray-600">{t.noOrders}</div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3 bg-white rounded-lg shadow-sm border border-gray-100 flex items-center gap-2">
                          <Box className="w-5 h-5 text-amber-600" />
                          <div>
                            <p className="text-xs text-gray-600">{t.totalOrders}</p>
                            <p className="text-lg font-semibold text-gray-900">{statsData.totalOrders}</p>
                          </div>
                        </div>
                        <div className="p-3 bg-white rounded-lg shadow-sm border border-gray-100 flex items-center gap-2">
                          <Package className="w-5 h-5 text-amber-600" />
                          <div>
                            <p className="text-xs text-gray-600">{t.totalReturns}</p>
                            <p className="text-lg font-semibold text-gray-900">{statsData.totalReturns}</p>
                          </div>
                        </div>
                        <div className="p-3 bg-white rounded-lg shadow-sm border border-gray-100 flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-amber-600" />
                          <div>
                            <p className="text-xs text-gray-600">{t.totalSales}</p>
                            <p className="text-lg font-semibold text-gray-900">{statsData.totalSales.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}</p>
                          </div>
                        </div>
                        <div className="p-3 bg-white rounded-lg shadow-sm border border-gray-100 flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-amber-600" />
                          <div>
                            <p className="text-xs text-gray-600">{t.avgDailyOrders}</p>
                            <p className="text-lg font-semibold text-gray-900">{statsData.avgDailyOrders}</p>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <motion.div
                          className="p-4 bg-white rounded-lg shadow-sm border border-gray-100"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3 }}
                        >
                          <h3 className="text-sm font-medium text-gray-900 mb-3">{t.topProducts}</h3>
                          <div className="h-64">
                            <Suspense fallback={<LoadingSpinner size="sm" />}>
                              <Bar
                                data={statsData.topProductsData}
                                options={{
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  plugins: {
                                    legend: { display: false },
                                    tooltip: {
                                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                      titleFont: { size: 12 },
                                      bodyFont: { size: 12 },
                                      padding: 10,
                                    },
                                  },
                                  scales: {
                                    y: {
                                      beginAtZero: true,
                                      title: {
                                        display: true,
                                        text: isRtl ? 'الكمية' : 'Quantity',
                                        font: { size: 12 },
                                      },
                                      ticks: { font: { size: 10 } },
                                    },
                                    x: {
                                      title: {
                                        display: true,
                                        text: isRtl ? 'المنتجات' : 'Products',
                                        font: { size: 12 },
                                      },
                                      ticks: {
                                        font: { size: 10 },
                                        maxRotation: 45,
                                        minRotation: 45,
                                      },
                                    },
                                  },
                                  animation: {
                                    duration: 1000,
                                    easing: 'easeOutQuart',
                                  },
                                }}
                              />
                            </Suspense>
                          </div>
                        </motion.div>
                        <motion.div
                          className="p-4 bg-white rounded-lg shadow-sm border border-gray-100"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3, delay: 0.1 }}
                        >
                          <h3 className="text-sm font-medium text-gray-900 mb-3">{t.ordersVsReturns}</h3>
                          <div className="h-64">
                            <Suspense fallback={<LoadingSpinner size="sm" />}>
                              <Line
                                data={statsData.ordersVsReturnsData}
                                options={{
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  plugins: {
                                    legend: { position: 'bottom', labels: { font: { size: 12 } } },
                                    tooltip: {
                                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                      titleFont: { size: 12 },
                                      bodyFont: { size: 12 },
                                      padding: 10,
                                    },
                                  },
                                  scales: {
                                    y: {
                                      beginAtZero: true,
                                      title: {
                                        display: true,
                                        text: isRtl ? 'العدد' : 'Count',
                                        font: { size: 12 },
                                      },
                                      ticks: { font: { size: 10 } },
                                    },
                                    x: {
                                      title: {
                                        display: true,
                                        text: isRtl ? 'التاريخ' : 'Date',
                                        font: { size: 12 },
                                      },
                                      ticks: { font: { size: 10 } },
                                    },
                                  },
                                  animation: {
                                    duration: 1000,
                                    easing: 'easeOutQuart',
                                  },
                                }}
                              />
                            </Suspense>
                          </div>
                        </motion.div>
                        <motion.div
                          className="p-4 bg-white rounded-lg shadow-sm border border-gray-100"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3, delay: 0.2 }}
                        >
                          <h3 className="text-sm font-medium text-gray-900 mb-3">{t.ordersByStatus}</h3>
                          <div className="h-64">
                            <Suspense fallback={<LoadingSpinner size="sm" />}>
                              <Pie
                                data={statsData.pieData}
                                options={{
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  plugins: {
                                    legend: { position: 'bottom', labels: { font: { size: 12 } } },
                                    tooltip: {
                                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                      titleFont: { size: 12 },
                                      bodyFont: { size: 12 },
                                      padding: 10,
                                    },
                                  },
                                  animation: {
                                    duration: 1000,
                                    easing: 'easeOutQuart',
                                  },
                                }}
                              />
                            </Suspense>
                          </div>
                        </motion.div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : state.activeTab === 'orders' ? (
                <motion.div
                  key="orders"
                  initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: isRtl ? -20 : 20 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="space-y-4"
                >
                  <h2 className="text-lg font-semibold text-gray-900">{t.ordersTab}</h2>
                  {state.ordersLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, index) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-lg animate-pulse">
                          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                        </div>
                      ))}
                    </div>
                  ) : state.orders.length === 0 ? (
                    <div className="text-center text-xs text-gray-600">{t.noOrders}</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.orderNumber}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.status}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.total}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.totalQuantity}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.createdAt}</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {state.orders.map((order) => (
                            <tr key={order.id}>
                              <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-900">{order.orderNumber}</td>
                              <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-600">{t[`status_${order.status}`] || order.status}</td>
                              <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-600">{order.total.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}</td>
                              <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-600">{order.totalQuantity}</td>
                              <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-600">{new Date(order.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="returns"
                  initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: isRtl ? -20 : 20 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="space-y-4"
                >
                  <h2 className="text-lg font-semibold text-gray-900">{t.returnsTab}</h2>
                  {state.returnsLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, index) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-lg animate-pulse">
                          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                        </div>
                      ))}
                    </div>
                  ) : state.returns.length === 0 ? (
                    <div className="text-center text-xs text-gray-600">{t.noReturns}</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.returnNumber}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.status}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.total}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.totalQuantity}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.createdAt}</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {state.returns.map((returnItem) => (
                            <tr key={returnItem.id}>
                              <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-900">{returnItem.returnNumber}</td>
                              <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-600">{t[`status_${returnItem.status}`] || returnItem.status}</td>
                              <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-600">{returnItem.total.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}</td>
                              <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-600">{returnItem.totalQuantity}</td>
                              <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-600">{new Date(returnItem.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {user?.role === 'admin' && (
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => dispatch({ type: 'SET_MODAL', payload: { modal: 'isEditModalOpen', isOpen: true } })}
                  className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-sm hover:shadow-md"
                  aria-label={t.editBranch}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  {t.editBranch}
                </button>
                <button
                  onClick={() => dispatch({ type: 'SET_MODAL', payload: { modal: 'isResetPasswordModalOpen', isOpen: true } })}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-sm hover:shadow-md"
                  aria-label={t.resetPassword}
                >
                  <Key className="w-3.5 h-3.5" />
                  {t.resetPassword}
                </button>
                <button
                  onClick={() => dispatch({ type: 'SET_MODAL', payload: { modal: 'isDeleteModalOpen', isOpen: true } })}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-sm hover:shadow-md"
                  aria-label={t.deleteBranch}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t.deleteBranch}
                </button>
              </div>
            )}
          </motion.div>
        )}

        <AnimatePresence>
          {state.isEditModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeInOut' }}
              className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50"
              onClick={() => dispatch({ type: 'SET_MODAL', payload: { modal: 'isEditModalOpen', isOpen: false } })}
            >
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                transition={{ duration: 0.15, ease: 'easeInOut' }}
                className="bg-white rounded-xl shadow-xl max-w-full w-[90vw] sm:max-w-2xl p-5"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{t.editBranch}</h3>
                <form onSubmit={handleSubmit} className="space-y-3" dir={isRtl ? 'rtl' : 'ltr'}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="name" className="block text-xs font-medium text-gray-700 mb-1">{t.name}</label>
                      <FormInput
                        value={state.formData.name}
                        onChange={(value) => dispatch({ type: 'SET_FORM_DATA', payload: { ...state.formData, name: value } })}
                        placeholder={t.name}
                        ariaLabel={t.name}
                        error={state.formErrors.name}
                      />
                      {state.formErrors.name && <p className="text-xs text-red-600 mt-1">{state.formErrors.name}</p>}
                    </div>
                    <div>
                      <label htmlFor="code" className="block text-xs font-medium text-gray-700 mb-1">{t.code}</label>
                      <FormInput
                        value={state.formData.code}
                        onChange={(value) => dispatch({ type: 'SET_FORM_DATA', payload: { ...state.formData, code: value } })}
                        placeholder={t.code}
                        ariaLabel={t.code}
                        error={state.formErrors.code}
                      />
                      {state.formErrors.code && <p className="text-xs text-red-600 mt-1">{state.formErrors.code}</p>}
                    </div>
                    <div>
                      <label htmlFor="address" className="block text-xs font-medium text-gray-700 mb-1">{t.address}</label>
                      <FormInput
                        value={state.formData.address}
                        onChange={(value) => dispatch({ type: 'SET_FORM_DATA', payload: { ...state.formData, address: value } })}
                        placeholder={t.address}
                        ariaLabel={t.address}
                        error={state.formErrors.address}
                      />
                      {state.formErrors.address && <p className="text-xs text-red-600 mt-1">{state.formErrors.address}</p>}
                    </div>
                    <div>
                      <label htmlFor="city" className="block text-xs font-medium text-gray-700 mb-1">{t.city}</label>
                      <FormInput
                        value={state.formData.city}
                        onChange={(value) => dispatch({ type: 'SET_FORM_DATA', payload: { ...state.formData, city: value } })}
                        placeholder={t.city}
                        ariaLabel={t.city}
                        error={state.formErrors.city}
                      />
                      {state.formErrors.city && <p className="text-xs text-red-600 mt-1">{state.formErrors.city}</p>}
                    </div>
                    <div>
                      <label htmlFor="phone" className="block text-xs font-medium text-gray-700 mb-1">{t.phone}</label>
                      <FormInput
                        value={state.formData.phone}
                        onChange={(value) => dispatch({ type: 'SET_FORM_DATA', payload: { ...state.formData, phone: value } })}
                        placeholder={t.phone}
                        ariaLabel={t.phone}
                        type="tel"
                      />
                    </div>
                    <div>
                      <label htmlFor="userName" className="block text-xs font-medium text-gray-700 mb-1">{t.userName}</label>
                      <FormInput
                        value={state.formData.user.name}
                        onChange={(value) => dispatch({ type: 'SET_FORM_DATA', payload: { ...state.formData, user: { ...state.formData.user, name: value } } })}
                        placeholder={t.userName}
                        ariaLabel={t.userName}
                        error={state.formErrors['user.name']}
                      />
                      {state.formErrors['user.name'] && <p className="text-xs text-red-600 mt-1">{state.formErrors['user.name']}</p>}
                    </div>
                    <div>
                      <label htmlFor="username" className="block text-xs font-medium text-gray-700 mb-1">{t.username}</label>
                      <FormInput
                        value={state.formData.user.username}
                        onChange={(value) => dispatch({ type: 'SET_FORM_DATA', payload: { ...state.formData, user: { ...state.formData.user, username: value } } })}
                        placeholder={t.username}
                        ariaLabel={t.username}
                        error={state.formErrors['user.username']}
                      />
                      {state.formErrors['user.username'] && <p className="text-xs text-red-600 mt-1">{state.formErrors['user.username']}</p>}
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1">{t.email}</label>
                      <FormInput
                        value={state.formData.user.email}
                        onChange={(value) => dispatch({ type: 'SET_FORM_DATA', payload: { ...state.formData, user: { ...state.formData.user, email: value } } })}
                        placeholder={t.email}
                        ariaLabel={t.email}
                        type="email"
                        error={state.formErrors['user.email']}
                      />
                      {state.formErrors['user.email'] && <p className="text-xs text-red-600 mt-1">{state.formErrors['user.email']}</p>}
                    </div>
                    <div>
                      <label htmlFor="userPhone" className="block text-xs font-medium text-gray-700 mb-1">{t.userPhone}</label>
                      <FormInput
                        value={state.formData.user.phone}
                        onChange={(value) => dispatch({ type: 'SET_FORM_DATA', payload: { ...state.formData, user: { ...state.formData.user, phone: value } } })}
                        placeholder={t.userPhone}
                        ariaLabel={t.userPhone}
                        type="tel"
                      />
                    </div>
                  </div>
                  {state.error && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      <span className="text-red-600 text-xs">{state.error}</span>
                    </div>
                  )}
                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'SET_MODAL', payload: { modal: 'isEditModalOpen', isOpen: false } })}
                      className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs transition-colors shadow-sm hover:shadow-md"
                      aria-label={t.cancel}
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors shadow-sm hover:shadow-md"
                      aria-label={t.save}
                    >
                      {t.save}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}

          {state.isResetPasswordModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeInOut' }}
              className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50"
              onClick={() => dispatch({ type: 'SET_MODAL', payload: { modal: 'isResetPasswordModalOpen', isOpen: false } })}
            >
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                transition={{ duration: 0.15, ease: 'easeInOut' }}
                className="bg-white rounded-xl shadow-xl max-w-full w-[90vw] sm:max-w-sm p-5"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{t.resetPassword}</h3>
                <form onSubmit={handleResetPassword} className="space-y-3" dir={isRtl ? 'rtl' : 'ltr'}>
                  <div>
                    <label htmlFor="newPassword" className="block text-xs font-medium text-gray-700 mb-1">{t.newPassword}</label>
                    <FormInput
                      value={state.passwordData.password}
                      onChange={(value) => dispatch({ type: 'SET_PASSWORD_DATA', payload: { ...state.passwordData, password: value } })}
                      placeholder={t.passwordPlaceholder}
                      ariaLabel={t.newPassword}
                      type={state.showPassword ? 'text' : 'password'}
                      showPasswordToggle
                      showPassword={state.showPassword}
                      togglePasswordVisibility={() => dispatch({ type: 'TOGGLE_PASSWORD_VISIBILITY', payload: { field: 'showPassword' } })}
                    />
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className="block text-xs font-medium text-gray-700 mb-1">{t.confirmPassword}</label>
                    <FormInput
                      value={state.passwordData.confirmPassword}
                      onChange={(value) => dispatch({ type: 'SET_PASSWORD_DATA', payload: { ...state.passwordData, confirmPassword: value } })}
                      placeholder={t.confirmPasswordPlaceholder}
                      ariaLabel={t.confirmPassword}
                      type={state.showConfirmPassword ? 'text' : 'password'}
                      showPasswordToggle
                      showPassword={state.showConfirmPassword}
                      togglePasswordVisibility={() => dispatch({ type: 'TOGGLE_PASSWORD_VISIBILITY', payload: { field: 'showConfirmPassword' } })}
                    />
                  </div>
                  {state.error && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      <span className="text-red-600 text-xs">{state.error}</span>
                    </div>
                  )}
                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'SET_MODAL', payload: { modal: 'isResetPasswordModalOpen', isOpen: false } })}
                      className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs transition-colors shadow-sm hover:shadow-md"
                      aria-label={t.cancel}
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors shadow-sm hover:shadow-md"
                      aria-label={t.save}
                    >
                      {t.save}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Suspense>
    </div>
  );
}


export default BranchProfile;