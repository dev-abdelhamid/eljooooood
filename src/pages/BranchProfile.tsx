import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { branchesAPI, ordersAPI, salesAPI } from '../services/api';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Edit2, Trash2, Key, AlertCircle, MapPin, Box, TrendingUp, Calendar } from 'lucide-react';
import { CustomDropdown } from '../components/UI/CustomDropdown';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { FormInput } from './ChefDetails'; // استيراد FormInput من ChefDetails

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface Branch {
  id: string;
  name: string;
  nameEn?: string;
  code: string;
  address: string;
  addressEn?: string;
  city: string;
  cityEn?: string;
  phone?: string;
  user?: {
    id: string;
    name: string;
    nameEn?: string;
    username: string;
    email?: string;
    phone?: string;
    createdAt: string;
    updatedAt: string;
  };
  createdBy?: {
    id: string;
    name: string;
    nameEn?: string;
    username: string;
    displayName: string;
  };
  createdAt: string;
  updatedAt: string;
  displayName: string;
  displayAddress: string;
  displayCity: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
}

interface Sale {
  id: string;
  saleNumber: string;
  total: number;
  createdAt: string;
}

interface FormState {
  name: string;
  nameEn: string;
  code: string;
  address: string;
  addressEn: string;
  city: string;
  cityEn: string;
  phone: string;
  user: {
    name: string;
    nameEn: string;
    username: string;
    email: string;
    phone: string;
  };
}

const translations = {
  ar: {
    branchDetails: 'تفاصيل الفرع',
    branchInfoTab: 'معلومات الفرع',
    ordersTab: 'طلبات الفرع',
    salesTab: 'مبيعات الفرع',
    statsTab: 'إحصائيات الفرع',
    name: 'اسم الفرع',
    nameEn: 'اسم الفرع (إنجليزي)',
    code: 'الكود',
    address: 'العنوان',
    addressEn: 'العنوان (إنجليزي)',
    city: 'المدينة',
    cityEn: 'المدينة (إنجليزي)',
    phone: 'رقم الهاتف',
    user: 'المستخدم',
    userName: 'اسم المستخدم',
    userNameEn: 'اسم المستخدم (إنجليزي)',
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
    noOrders: 'لا توجد طلبات',
    noSales: 'لا توجد مبيعات',
    orderNumber: 'رقم الطلب',
    status: 'الحالة',
    total: 'الإجمالي',
    saleNumber: 'رقم المبيعة',
    totalOrders: 'إجمالي الطلبات',
    totalSales: 'إجمالي المبيعات',
    avgDailyOrders: 'متوسط الطلبات اليومي',
    salesOverTime: 'المبيعات عبر الزمن',
    ordersByStatus: 'الطلبات حسب الحالة',
  },
  en: {
    branchDetails: 'Branch Details',
    branchInfoTab: 'Branch Info',
    ordersTab: 'Branch Orders',
    salesTab: 'Branch Sales',
    statsTab: 'Branch Stats',
    name: 'Branch Name',
    nameEn: 'Branch Name (English)',
    code: 'Code',
    address: 'Address',
    addressEn: 'Address (English)',
    city: 'City',
    cityEn: 'City (English)',
    phone: 'Phone',
    user: 'User',
    userName: 'User Name',
    userNameEn: 'User Name (English)',
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
    noOrders: 'No orders available',
    noSales: 'No sales available',
    orderNumber: 'Order Number',
    status: 'Status',
    total: 'Total',
    saleNumber: 'Sale Number',
    totalOrders: 'Total Orders',
    totalSales: 'Total Sales',
    avgDailyOrders: 'Average Daily Orders',
    salesOverTime: 'Sales Over Time',
    ordersByStatus: 'Orders by Status',
  },
};

export function BranchProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [branch, setBranch] = useState<Branch | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [activeTab, setActiveTab] = useState('info');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [formData, setFormData] = useState<FormState>({
    name: '',
    nameEn: '',
    code: '',
    address: '',
    addressEn: '',
    city: '',
    cityEn: '',
    phone: '',
    user: {
      name: '',
      nameEn: '',
      username: '',
      email: '',
      phone: '',
    },
  });
  const [passwordData, setPasswordData] = useState({ password: '', confirmPassword: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [salesLoading, setSalesLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const fetchBranch = useCallback(async () => {
    if (!id) {
      setError(t.branchNotFound);
      setLoading(false);
      toast.error(t.branchNotFound, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    if (!user || user.role !== 'admin') {
      setError(t.serverError);
      setLoading(false);
      toast.error(t.serverError, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    setLoading(true);
    try {
      const response = await branchesAPI.getById(id);
      const data = {
        id: response._id,
        name: response.name,
        nameEn: response.nameEn,
        code: response.code,
        address: response.address,
        addressEn: response.addressEn,
        city: response.city,
        cityEn: response.cityEn,
        phone: response.phone,
        user: response.user
          ? {
              id: response.user._id,
              name: response.user.name,
              nameEn: response.user.nameEn,
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
              nameEn: response.createdBy.nameEn,
              username: response.createdBy.username,
              displayName: isRtl ? response.createdBy.name : (response.createdBy.nameEn || response.createdBy.name),
            }
          : undefined,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
        displayName: isRtl ? response.name : (response.nameEn || response.name),
        displayAddress: isRtl ? response.address : (response.addressEn || response.address),
        displayCity: isRtl ? response.city : (response.cityEn || response.city),
      };
      setBranch(data);
      setFormData({
        name: data.name,
        nameEn: data.nameEn || '',
        code: data.code,
        address: data.address,
        addressEn: data.addressEn || '',
        city: data.city,
        cityEn: data.cityEn || '',
        phone: data.phone || '',
        user: {
          name: data.user?.name || '',
          nameEn: data.user?.nameEn || '',
          username: data.user?.username || '',
          email: data.user?.email || '',
          phone: data.user?.phone || '',
        },
      });
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || t.branchNotFound);
      toast.error(t.branchNotFound, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setLoading(false);
    }
  }, [id, user, isRtl, t]);

  const fetchOrders = useCallback(async () => {
    if (!id) return;
    setOrdersLoading(true);
    try {
      // بيانات افتراضية للطلبات
      setOrders([
        { id: '1', orderNumber: 'ORD001', status: 'مكتمل', total: 500, createdAt: '2025-09-01' },
        { id: '2', orderNumber: 'ORD002', status: 'قيد التنفيذ', total: 300, createdAt: '2025-09-10' },
        { id: '3', orderNumber: 'ORD003', status: 'ملغى', total: 200, createdAt: '2025-09-15' },
        { id: '4', orderNumber: 'ORD004', status: 'مكتمل', total: 700, createdAt: '2025-09-20' },
      ]);
    } catch (err: any) {
      toast.error(t.noOrders, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setOrdersLoading(false);
    }
  }, [id, t, isRtl]);

  const fetchSales = useCallback(async () => {
    if (!id) return;
    setSalesLoading(true);
    try {
      // بيانات افتراضية للمبيعات
      setSales([
        { id: '1', saleNumber: 'SALE001', total: 1000, createdAt: '2025-09-01' },
        { id: '2', saleNumber: 'SALE002', total: 1500, createdAt: '2025-09-10' },
        { id: '3', saleNumber: 'SALE003', total: 800, createdAt: '2025-09-15' },
        { id: '4', saleNumber: 'SALE004', total: 1200, createdAt: '2025-09-20' },
      ]);
    } catch (err: any) {
      toast.error(t.noSales, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setSalesLoading(false);
    }
  }, [id, t, isRtl]);

  useEffect(() => {
    fetchBranch();
    fetchOrders();
    fetchSales();
  }, [fetchBranch, fetchOrders, fetchSales]);

  const validateForm = useCallback(async () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = t.requiredField;
    if (!formData.nameEn.trim()) errors.nameEn = t.requiredField;
    if (!formData.code.trim()) errors.code = t.requiredField;
    if (!formData.address.trim()) errors.address = t.requiredField;
    if (!formData.addressEn.trim()) errors.addressEn = t.requiredField;
    if (!formData.city.trim()) errors.city = t.requiredField;
    if (!formData.cityEn.trim()) errors.cityEn = t.requiredField;
    if (!formData.user.name.trim()) errors['user.name'] = t.requiredField;
    if (!formData.user.nameEn.trim()) errors['user.nameEn'] = t.requiredField;
    if (!formData.user.username.trim()) errors['user.username'] = t.requiredField;
    try {
      if (formData.user.email.trim()) {
        const isEmailAvailable = await branchesAPI.checkEmail(formData.user.email);
        if (!isEmailAvailable && formData.user.email !== branch?.user?.email) {
          errors['user.email'] = t.emailInUse;
        }
      }
    } catch {
      errors['user.email'] = t.serverError;
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, branch, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(await validateForm())) {
      toast.error(t.requiredField, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    try {
      setLoading(true);
      const branchData = {
        name: formData.name.trim(),
        nameEn: formData.nameEn.trim() || undefined,
        code: formData.code.trim(),
        address: formData.address.trim(),
        addressEn: formData.addressEn.trim() || undefined,
        city: formData.city.trim(),
        cityEn: formData.cityEn.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        user: {
          name: formData.user.name.trim(),
          nameEn: formData.user.nameEn.trim() || undefined,
          username: formData.user.username.trim(),
          email: formData.user.email.trim() || undefined,
          phone: formData.user.phone.trim() || undefined,
        },
      };
      const response = await branchesAPI.update(id!, branchData);
      setBranch({
        ...response,
        displayName: isRtl ? response.name : (response.nameEn || response.name),
        displayAddress: isRtl ? response.address : (response.addressEn || response.address),
        displayCity: isRtl ? response.city : (response.cityEn || response.city),
        user: response.user
          ? {
              ...response.user,
              displayName: isRtl ? response.user.name : (response.user.nameEn || response.user.name),
            }
          : undefined,
        createdBy: response.createdBy
          ? {
              ...response.createdBy,
              displayName: isRtl ? response.createdBy.name : (response.createdBy.nameEn || response.createdBy.name),
            }
          : undefined,
      });
      toast.success(t.branchUpdated, { position: isRtl ? 'top-right' : 'top-left' });
      setIsEditModalOpen(false);
    } catch (err: any) {
      let errorMessage = t.serverError;
      if (err.response?.data?.message) {
        const message = err.response.data.message;
        errorMessage =
          message.includes('code') ? t.codeInUse :
          message.includes('username') ? t.usernameInUse :
          message.includes('email') ? t.emailInUse : message;
      }
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordData.password || !passwordData.confirmPassword) {
      setError(t.passwordRequired);
      toast.error(t.passwordRequired, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    if (passwordData.password !== passwordData.confirmPassword) {
      setError(t.passwordMismatch);
      toast.error(t.passwordMismatch, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    if (passwordData.password.length < 6) {
      setError(t.passwordTooShort);
      toast.error(t.passwordTooShort, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    try {
      setLoading(true);
      await branchesAPI.resetPassword(id!, passwordData.password);
      toast.success(t.passwordReset, { position: isRtl ? 'top-right' : 'top-left' });
      setIsResetPasswordModalOpen(false);
      setPasswordData({ password: '', confirmPassword: '' });
    } catch (err: any) {
      setError(err.response?.data?.message || t.serverError);
      toast.error(err.response?.data?.message || t.serverError, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      await branchesAPI.delete(id!);
      toast.success(t.branchDeleted, { position: isRtl ? 'top-right' : 'top-left' });
      navigate('/branches');
    } catch (err: any) {
      const errorMessage = err.response?.data?.message?.includes('orders or inventory') ? t.deleteRestricted : t.serverError;
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setLoading(false);
    }
  };

  const statsData = useMemo(() => {
    const totalOrders = orders.length;
    const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
    const days = [...new Set(orders.map(item => item.createdAt))].length;
    const avgDailyOrders = days > 0 ? (totalOrders / days).toFixed(2) : '0';

    const statusCounts = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const barData = {
      labels: sales.map(sale => new Date(sale.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')),
      datasets: [{
        label: t.totalSales,
        data: sales.map(sale => sale.total),
        backgroundColor: 'rgba(245, 158, 11, 0.6)',
        borderColor: 'rgba(245, 158, 11, 1)',
        borderWidth: 1,
      }],
    };

    const pieData = {
      labels: Object.keys(statusCounts),
      datasets: [{
        data: Object.values(statusCounts),
        backgroundColor: ['rgba(245, 158, 11, 0.6)', 'rgba(59, 130, 246, 0.6)', 'rgba(239, 68, 68, 0.6)'],
        borderColor: ['rgba(245, 158, 11, 1)', 'rgba(59, 130, 246, 1)', 'rgba(239, 68, 68, 1)'],
        borderWidth: 1,
      }],
    };

    return { totalOrders, totalSales, avgDailyOrders, barData, pieData };
  }, [orders, sales, t, isRtl]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="p-5 bg-white rounded-xl shadow-sm max-w-md w-full">
          <div className="space-y-3 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
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
    );
  }

  return (
    <div className="mx-auto px-4 py-6 min-h-screen bg-white" dir={isRtl ? 'rtl' : 'ltr'}>
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
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 shadow-sm"
          >
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-red-600 text-xs">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-xl shadow-sm p-5"
      >
        <div className="flex border-b border-gray-200 mb-4">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-4 py-2 text-xs font-medium ${activeTab === 'info' ? 'border-b-2 border-amber-600 text-amber-600' : 'text-gray-600 hover:text-amber-600'} transition-colors`}
            aria-label={t.branchInfoTab}
          >
            {t.branchInfoTab}
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-2 text-xs font-medium ${activeTab === 'stats' ? 'border-b-2 border-amber-600 text-amber-600' : 'text-gray-600 hover:text-amber-600'} transition-colors`}
            aria-label={t.statsTab}
          >
            {t.statsTab}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'info' ? (
            <motion.div
              key="info"
              initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRtl ? -20 : 20 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="space-y-3"
            >
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-900">{branch.displayName}</h2>
                <MapPin className="w-5 h-5 text-amber-600" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="block text-xs font-medium text-gray-700">{t.name}</span>
                  <span className="text-xs text-gray-600">{branch.displayName}</span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-gray-700">{t.nameEn}</span>
                  <span className="text-xs text-gray-600">{branch.nameEn || branch.name}</span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-gray-700">{t.code}</span>
                  <span className="text-xs text-gray-600">{branch.code || '-'}</span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-gray-700">{t.address}</span>
                  <span className="text-xs text-gray-600">{branch.displayAddress || '-'}</span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-gray-700">{t.addressEn}</span>
                  <span className="text-xs text-gray-600">{branch.addressEn || branch.address || '-'}</span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-gray-700">{t.city}</span>
                  <span className="text-xs text-gray-600">{branch.displayCity || '-'}</span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-gray-700">{t.cityEn}</span>
                  <span className="text-xs text-gray-600">{branch.cityEn || branch.city || '-'}</span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-gray-700">{t.phone}</span>
                  <span className="text-xs text-gray-600">{branch.phone || '-'}</span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-gray-700">{t.createdBy}</span>
                  <span className="text-xs text-gray-600">{branch.createdBy?.displayName || '-'}</span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-gray-700">{t.createdAt}</span>
                  <span className="text-xs text-gray-600">{new Date(branch.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}</span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-gray-700">{t.updatedAt}</span>
                  <span className="text-xs text-gray-600">{new Date(branch.updatedAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}</span>
                </div>
                {branch.user && (
                  <>
                    <div>
                      <span className="block text-xs font-medium text-gray-700">{t.userName}</span>
                      <span className="text-xs text-gray-600">{isRtl ? branch.user.name : (branch.user.nameEn || branch.user.name)}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-gray-700">{t.userNameEn}</span>
                      <span className="text-xs text-gray-600">{branch.user.nameEn || branch.user.name}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-gray-700">{t.username}</span>
                      <span className="text-xs text-gray-600">{branch.user.username || '-'}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-gray-700">{t.email}</span>
                      <span className="text-xs text-gray-600">{branch.user.email || '-'}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-gray-700">{t.userPhone}</span>
                      <span className="text-xs text-gray-600">{branch.user.phone || '-'}</span>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="stats"
              initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRtl ? -20 : 20 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="space-y-4"
            >
              <h2 className="text-lg font-semibold text-gray-900">{t.statsTab}</h2>
              {(ordersLoading || salesLoading) ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[...Array(3)].map((_, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                      <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                    </div>
                  ))}
                </div>
              ) : (orders.length === 0 && sales.length === 0) ? (
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
                      <TrendingUp className="w-5 h-5 text-amber-600" />
                      <div>
                        <p className="text-xs text-gray-600">{t.totalSales}</p>
                        <p className="text-lg font-semibold text-gray-900">{statsData.totalSales}</p>
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
                    <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                      <h3 className="text-sm font-medium text-gray-900 mb-3">{t.salesOverTime}</h3>
                      <div className="h-64">
                        <Bar
                          data={statsData.barData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: { y: { beginAtZero: true } },
                          }}
                        />
                      </div>
                    </div>
                    <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                      <h3 className="text-sm font-medium text-gray-900 mb-3">{t.ordersByStatus}</h3>
                      <div className="h-64">
                        <Pie
                          data={statsData.pieData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { position: 'bottom' } },
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                      <h3 className="text-sm font-medium text-gray-900 mb-2">{t.ordersTab}</h3>
                      {ordersLoading ? (
                        <div className="space-y-3">
                          {[...Array(3)].map((_, index) => (
                            <div key={index} className="p-3 bg-gray-50 rounded-lg animate-pulse">
                              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                              <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                            </div>
                          ))}
                        </div>
                      ) : orders.length === 0 ? (
                        <div className="text-center text-xs text-gray-600">{t.noOrders}</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.orderNumber}</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.status}</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.total}</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.createdAt}</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {orders.map((order) => (
                                <tr key={order.id}>
                                  <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-900">{order.orderNumber}</td>
                                  <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-600">{order.status}</td>
                                  <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-600">{order.total}</td>
                                  <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-600">{new Date(order.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                    <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                      <h3 className="text-sm font-medium text-gray-900 mb-2">{t.salesTab}</h3>
                      {salesLoading ? (
                        <div className="space-y-3">
                          {[...Array(3)].map((_, index) => (
                            <div key={index} className="p-3 bg-gray-50 rounded-lg animate-pulse">
                              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                              <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                            </div>
                          ))}
                        </div>
                      ) : sales.length === 0 ? (
                        <div className="text-center text-xs text-gray-600">{t.noSales}</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.saleNumber}</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.total}</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.createdAt}</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {sales.map((sale) => (
                                <tr key={sale.id}>
                                  <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-900">{sale.saleNumber}</td>
                                  <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-600">{sale.total}</td>
                                  <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-600">{new Date(sale.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {user?.role === 'admin' && (
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-sm hover:shadow-md"
              aria-label={t.editBranch}
            >
              <Edit2 className="w-3.5 h-3.5" />
              {t.editBranch}
            </button>
            <button
              onClick={() => setIsResetPasswordModalOpen(true)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-sm hover:shadow-md"
              aria-label={t.resetPassword}
            >
              <Key className="w-3.5 h-3.5" />
              {t.resetPassword}
            </button>
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-sm hover:shadow-md"
              aria-label={t.deleteBranch}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t.deleteBranch}
            </button>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {isEditModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setIsEditModalOpen(false)}
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
                      value={formData.name}
                      onChange={(value) => setFormData({ ...formData, name: value })}
                      placeholder={t.name}
                      ariaLabel={t.name}
                      error={formErrors.name}
                    />
                    {formErrors.name && <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>}
                  </div>
                  <div>
                    <label htmlFor="nameEn" className="block text-xs font-medium text-gray-700 mb-1">{t.nameEn}</label>
                    <FormInput
                      value={formData.nameEn}
                      onChange={(value) => setFormData({ ...formData, nameEn: value })}
                      placeholder={t.nameEn}
                      ariaLabel={t.nameEn}
                      error={formErrors.nameEn}
                    />
                    {formErrors.nameEn && <p className="text-xs text-red-600 mt-1">{formErrors.nameEn}</p>}
                  </div>
                  <div>
                    <label htmlFor="code" className="block text-xs font-medium text-gray-700 mb-1">{t.code}</label>
                    <FormInput
                      value={formData.code}
                      onChange={(value) => setFormData({ ...formData, code: value })}
                      placeholder={t.code}
                      ariaLabel={t.code}
                      error={formErrors.code}
                    />
                    {formErrors.code && <p className="text-xs text-red-600 mt-1">{formErrors.code}</p>}
                  </div>
                  <div>
                    <label htmlFor="address" className="block text-xs font-medium text-gray-700 mb-1">{t.address}</label>
                    <FormInput
                      value={formData.address}
                      onChange={(value) => setFormData({ ...formData, address: value })}
                      placeholder={t.address}
                      ariaLabel={t.address}
                      error={formErrors.address}
                    />
                    {formErrors.address && <p className="text-xs text-red-600 mt-1">{formErrors.address}</p>}
                  </div>
                  <div>
                    <label htmlFor="addressEn" className="block text-xs font-medium text-gray-700 mb-1">{t.addressEn}</label>
                    <FormInput
                      value={formData.addressEn}
                      onChange={(value) => setFormData({ ...formData, addressEn: value })}
                      placeholder={t.addressEn}
                      ariaLabel={t.addressEn}
                      error={formErrors.addressEn}
                    />
                    {formErrors.addressEn && <p className="text-xs text-red-600 mt-1">{formErrors.addressEn}</p>}
                  </div>
                  <div>
                    <label htmlFor="city" className="block text-xs font-medium text-gray-700 mb-1">{t.city}</label>
                    <FormInput
                      value={formData.city}
                      onChange={(value) => setFormData({ ...formData, city: value })}
                      placeholder={t.city}
                      ariaLabel={t.city}
                      error={formErrors.city}
                    />
                    {formErrors.city && <p className="text-xs text-red-600 mt-1">{formErrors.city}</p>}
                  </div>
                  <div>
                    <label htmlFor="cityEn" className="block text-xs font-medium text-gray-700 mb-1">{t.cityEn}</label>
                    <FormInput
                      value={formData.cityEn}
                      onChange={(value) => setFormData({ ...formData, cityEn: value })}
                      placeholder={t.cityEn}
                      ariaLabel={t.cityEn}
                      error={formErrors.cityEn}
                    />
                    {formErrors.cityEn && <p className="text-xs text-red-600 mt-1">{formErrors.cityEn}</p>}
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-xs font-medium text-gray-700 mb-1">{t.phone}</label>
                    <FormInput
                      value={formData.phone}
                      onChange={(value) => setFormData({ ...formData, phone: value })}
                      placeholder={t.phone}
                      ariaLabel={t.phone}
                      type="tel"
                    />
                  </div>
                  <div>
                    <label htmlFor="userName" className="block text-xs font-medium text-gray-700 mb-1">{t.userName}</label>
                    <FormInput
                      value={formData.user.name}
                      onChange={(value) => setFormData({ ...formData, user: { ...formData.user, name: value } })}
                      placeholder={t.userName}
                      ariaLabel={t.userName}
                      error={formErrors['user.name']}
                    />
                    {formErrors['user.name'] && <p className="text-xs text-red-600 mt-1">{formErrors['user.name']}</p>}
                  </div>
                  <div>
                    <label htmlFor="userNameEn" className="block text-xs font-medium text-gray-700 mb-1">{t.userNameEn}</label>
                    <FormInput
                      value={formData.user.nameEn}
                      onChange={(value) => setFormData({ ...formData, user: { ...formData.user, nameEn: value } })}
                      placeholder={t.userNameEn}
                      ariaLabel={t.userNameEn}
                      error={formErrors['user.nameEn']}
                    />
                    {formErrors['user.nameEn'] && <p className="text-xs text-red-600 mt-1">{formErrors['user.nameEn']}</p>}
                  </div>
                  <div>
                    <label htmlFor="username" className="block text-xs font-medium text-gray-700 mb-1">{t.username}</label>
                    <FormInput
                      value={formData.user.username}
                      onChange={(value) => setFormData({ ...formData, user: { ...formData.user, username: value } })}
                      placeholder={t.username}
                      ariaLabel={t.username}
                      error={formErrors['user.username']}
                    />
                    {formErrors['user.username'] && <p className="text-xs text-red-600 mt-1">{formErrors['user.username']}</p>}
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1">{t.email}</label>
                    <FormInput
                      value={formData.user.email}
                      onChange={(value) => setFormData({ ...formData, user: { ...formData.user, email: value } })}
                      placeholder={t.email}
                      ariaLabel={t.email}
                      type="email"
                      error={formErrors['user.email']}
                    />
                    {formErrors['user.email'] && <p className="text-xs text-red-600 mt-1">{formErrors['user.email']}</p>}
                  </div>
                  <div>
                    <label htmlFor="userPhone" className="block text-xs font-medium text-gray-700 mb-1">{t.userPhone}</label>
                    <FormInput
                      value={formData.user.phone}
                      onChange={(value) => setFormData({ ...formData, user: { ...formData.user, phone: value } })}
                      placeholder={t.userPhone}
                      ariaLabel={t.userPhone}
                      type="tel"
                    />
                  </div>
                </div>
                {error && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="text-red-600 text-xs">{error}</span>
                  </div>
                )}
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
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
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-sm hover:shadow-md"
                    aria-label={t.editBranch}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    {t.editBranch}
                  </button>
                  <button
                    onClick={() => { setIsEditModalOpen(false); setIsResetPasswordModalOpen(true); }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-sm hover:shadow-md"
                    aria-label={t.resetPassword}
                  >
                    <Key className="w-3.5 h-3.5" />
                    {t.resetPassword}
                  </button>
                  <button
                    onClick={() => { setIsEditModalOpen(false); setIsDeleteModalOpen(true); }}
                    className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-sm hover:shadow-md"
                    aria-label={t.deleteBranch}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t.deleteBranch}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {isResetPasswordModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setIsResetPasswordModalOpen(false)}
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
                    value={passwordData.password}
                    onChange={(value) => setPasswordData({ ...passwordData, password: value })}
                    placeholder={t.passwordPlaceholder}
                    ariaLabel={t.newPassword}
                    type="password"
                    showPasswordToggle
                    showPassword={showPassword}
                    togglePasswordVisibility={() => setShowPassword(!showPassword)}
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-xs font-medium text-gray-700 mb-1">{t.confirmPassword}</label>
                  <FormInput
                    value={passwordData.confirmPassword}
                    onChange={(value) => setPasswordData({ ...passwordData, confirmPassword: value })}
                    placeholder={t.confirmPasswordPlaceholder}
                    ariaLabel={t.confirmPassword}
                    type="password"
                    showPasswordToggle
                    showPassword={showConfirmPassword}
                    togglePasswordVisibility={() => setShowConfirmPassword(!showConfirmPassword)}
                  />
                </div>
                {error && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="text-red-600 text-xs">{error}</span>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsResetPasswordModalOpen(false)}
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

        {isDeleteModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setIsDeleteModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              transition={{ duration: 0.15, ease: 'easeInOut' }}
              className="bg-white rounded-xl shadow-xl max-w-full w-[90vw] sm:max-w-sm p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{t.confirmDelete}</h3>
              <p className="text-xs text-gray-600 mb-4">{t.deleteWarning}</p>
              {error && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 mb-4">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span className="text-red-600 text-xs">{error}</span>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs transition-colors shadow-sm hover:shadow-md"
                  aria-label={t.cancel}
                >
                  {t.cancel}
                </button>
                <button
                  onClick={handleDelete}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs transition-colors shadow-sm hover:shadow-md"
                  aria-label={t.deleteBranch}
                >
                  {t.deleteBranch}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default BranchProfile;