import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { chefsAPI, departmentAPI } from '../services/api';
import { ChefHat, AlertCircle, Edit2, Key, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomInput, CustomDropdown } from './Chefs'; // Reuse from Chefs.tsx

interface Department {
  id: string;
  name: string;
  nameEn?: string;
  code: string;
  description?: string;
}

interface Chef {
  id: string;
  user: {
    id: string;
    name: string;
    nameEn?: string;
    username: string;
    email?: string;
    phone?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  } | null;
  department: Department | null;
  createdAt: string;
  updatedAt: string;
}

interface ChefStats {
  ordersCompleted: number;
  averagePrepTime: number;
  rating: number;
  monthlyPerformance: { month: string; orders: number }[];
}

const translations = {
  ar: {
    details: 'التفاصيل',
    statistics: 'الإحصائيات',
    back: 'رجوع',
    username: 'اسم المستخدم',
    email: 'الإيميل',
    phone: 'الهاتف',
    department: 'القسم',
    createdAt: 'تاريخ الإنشاء',
    updatedAt: 'تاريخ التحديث',
    status: 'الحالة',
    active: 'نشط',
    inactive: 'غير نشط',
    edit: 'تعديل',
    resetPassword: 'تغيير كلمة المرور',
    name: 'اسم الشيف (عربي)',
    nameEn: 'اسم الشيف (إنجليزي)',
    nameRequired: 'اسم الشيف مطلوب',
    nameEnRequired: 'اسم الشيف بالإنجليزية مطلوب',
    usernameRequired: 'اسم المستخدم مطلوب',
    departmentRequired: 'القسم مطلوب',
    namePlaceholder: 'أدخل اسم الشيف',
    nameEnPlaceholder: 'أدخل اسم الشيف بالإنجليزية',
    usernamePlaceholder: 'أدخل اسم المستخدم',
    emailPlaceholder: 'أدخل الإيميل',
    phonePlaceholder: 'أدخل رقم الهاتف',
    departmentPlaceholder: 'اختر القسم',
    update: 'تحديث الشيف',
    requiredFields: 'يرجى ملء جميع الحقول المطلوبة',
    usernameExists: 'اسم المستخدم مستخدم بالفعل',
    emailExists: 'الإيميل مستخدم بالفعل',
    updateError: 'خطأ في تحديث الشيف',
    updated: 'تم تحديث الشيف بنجاح',
    newPassword: 'كلمة المرور الجديدة',
    confirmPassword: 'تأكيد كلمة المرور',
    newPasswordPlaceholder: 'أدخل كلمة المرور الجديدة',
    confirmPasswordPlaceholder: 'أدخل تأكيد كلمة المرور',
    passwordMismatch: 'كلمات المرور غير متطابقة',
    passwordTooShort: 'كلمة المرور قصيرة جدًا (6 أحرف على الأقل)',
    passwordResetSuccess: 'تم تغيير كلمة المرور بنجاح',
    passwordResetError: 'خطأ في تغيير كلمة المرور',
    reset: 'إعادة تعيين',
    cancel: 'إلغاء',
    fetchError: 'خطأ في جلب البيانات',
    ordersCompleted: 'الطلبات المكتملة',
    avgPrepTime: 'متوسط وقت التحضير (دقائق)',
    rating: 'التقييم',
    monthlyOrders: 'الطلبات الشهرية',
    noDepartments: 'لا توجد أقسام متاحة',
  },
  en: {
    details: 'Details',
    statistics: 'Statistics',
    back: 'Back',
    username: 'Username',
    email: 'Email',
    phone: 'Phone',
    department: 'Department',
    createdAt: 'Created At',
    updatedAt: 'Updated At',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    edit: 'Edit',
    resetPassword: 'Change Password',
    name: 'Chef Name (Arabic)',
    nameEn: 'Chef Name (English)',
    nameRequired: 'Chef name is required',
    nameEnRequired: 'Chef name in English is required',
    usernameRequired: 'Username is required',
    departmentRequired: 'Department is required',
    namePlaceholder: 'Enter chef name',
    nameEnPlaceholder: 'Enter chef name in English',
    usernamePlaceholder: 'Enter username',
    emailPlaceholder: 'Enter email',
    phonePlaceholder: 'Enter phone number',
    departmentPlaceholder: 'Select department',
    update: 'Update Chef',
    requiredFields: 'Please fill all required fields',
    usernameExists: 'Username already in use',
    emailExists: 'Email already in use',
    updateError: 'Error updating chef',
    updated: 'Chef updated successfully',
    newPassword: 'New Password',
    confirmPassword: 'Confirm Password',
    newPasswordPlaceholder: 'Enter new password',
    confirmPasswordPlaceholder: 'Enter confirm password',
    passwordMismatch: 'Passwords do not match',
    passwordTooShort: 'Password too short (at least 6 characters)',
    passwordResetSuccess: 'Password changed successfully',
    passwordResetError: 'Error changing password',
    reset: 'Reset',
    cancel: 'Cancel',
    fetchError: 'Error fetching data',
    ordersCompleted: 'Orders Completed',
    avgPrepTime: 'Average Prep Time (minutes)',
    rating: 'Rating',
    monthlyOrders: 'Monthly Orders',
    noDepartments: 'No departments available',
  },
};

export function ChefDetails() {
  const { id } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const { user: loggedInUser } = useAuth();
  const navigate = useNavigate();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [chef, setChef] = useState<Chef | null>(null);
  const [stats, setStats] = useState<ChefStats | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'statistics'>('details');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    username: '',
    email: '',
    phone: '',
    department: '',
    isActive: true,
  });
  const [resetPasswordData, setResetPasswordData] = useState({ password: '', confirmPassword: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  const fetchChefData = useCallback(async () => {
    if (!id) {
      setError(t.fetchError);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [chefResponse, statsResponse, departmentsResponse] = await Promise.all([
        chefsAPI.getById(id, { isRtl }),
        chefsAPI.getStatistics(id, { isRtl }),
        departmentAPI.getAll({ isRtl }),
      ]);
      setChef({
        id: chefResponse._id,
        user: {
          id: chefResponse.user._id,
          name: chefResponse.user.name,
          nameEn: chefResponse.user.nameEn,
          username: chefResponse.user.username,
          email: chefResponse.user.email,
          phone: chefResponse.user.phone,
          isActive: chefResponse.user.isActive,
          createdAt: chefResponse.user.createdAt,
          updatedAt: chefResponse.user.updatedAt,
        },
        department: chefResponse.department
          ? {
              id: chefResponse.department._id,
              name: chefResponse.department.name,
              nameEn: chefResponse.department.nameEn,
              code: chefResponse.department.code,
              description: chefResponse.department.description,
            }
          : null,
        createdAt: chefResponse.createdAt,
        updatedAt: chefResponse.updatedAt,
      });
      setStats(chefResponse.data);
      setDepartments(
        Array.isArray(departmentsResponse.data)
          ? departmentsResponse.data.map((dept: any) => ({
              id: dept._id,
              name: dept.name,
              nameEn: dept.nameEn,
              code: dept.code,
              description: dept.description,
            }))
          : departmentsResponse
      );
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Fetch chef error:`, err);
      setError(err.message || t.fetchError);
      toast.error(err.message || t.fetchError, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setLoading(false);
    }
  }, [id, t, isRtl]);

  useEffect(() => {
    fetchChefData();
  }, [fetchChefData]);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.name) errors.name = t.nameRequired;
    if (!formData.nameEn) errors.nameEn = t.nameEnRequired;
    if (!formData.username) errors.username = t.usernameRequired;
    if (!formData.department) errors.department = t.departmentRequired;
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openEditModal = () => {
    if (!chef) return;
    setFormData({
      name: chef.user?.name || '',
      nameEn: chef.user?.nameEn || '',
      username: chef.user?.username || '',
      email: chef.user?.email || '',
      phone: chef.user?.phone || '',
      department: chef.department?.id || '',
      isActive: chef.user?.isActive ?? true,
    });
    setIsEditModalOpen(true);
    setFormErrors({});
    setError('');
  };

  const openResetPasswordModal = () => {
    setResetPasswordData({ password: '', confirmPassword: '' });
    setIsResetPasswordModalOpen(true);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error(t.requiredFields, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }

    try {
      const chefData = {
        user: {
          name: formData.name.trim(),
          nameEn: formData.nameEn.trim(),
          username: formData.username.trim(),
          email: formData.email.trim() || undefined,
          phone: formData.phone.trim() || undefined,
          isActive: formData.isActive,
        },
        department: formData.department,
      };
      const updatedChef = await chefsAPI.update(id!, chefData);
      setChef({
        ...chef!,
        user: {
          ...chef!.user!,
          ...updatedChef.user,
          id: updatedChef.user._id,
          createdAt: updatedChef.user.createdAt,
          updatedAt: updatedChef.user.updatedAt,
        },
        department: updatedChef.department
          ? {
              id: updatedChef.department._id,
              name: updatedChef.department.name,
              nameEn: updatedChef.department.nameEn,
              code: updatedChef.department.code,
              description: updatedChef.department.description,
            }
          : null,
        createdAt: updatedChef.createdAt,
        updatedAt: updatedChef.updatedAt,
      });
      toast.success(t.updated, { position: isRtl ? 'top-right' : 'top-left' });
      setIsEditModalOpen(false);
      setError('');
    } catch (err: any) {
      const errorMessage =
        err.message.includes('Username') ? t.usernameExists :
        err.message.includes('email') ? t.emailExists : t.updateError;
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordData.password || !resetPasswordData.confirmPassword) {
      setError(t.passwordRequired);
      toast.error(t.passwordRequired, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    if (resetPasswordData.password !== resetPasswordData.confirmPassword) {
      setError(t.passwordMismatch);
      toast.error(t.passwordMismatch, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    if (resetPasswordData.password.length < 6) {
      setError(t.passwordTooShort);
      toast.error(t.passwordTooShort, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }

    try {
      await chefsAPI.resetPassword(id!, resetPasswordData.password);
      setIsResetPasswordModalOpen(false);
      setResetPasswordData({ password: '', confirmPassword: '' });
      toast.success(t.passwordResetSuccess, { position: isRtl ? 'top-right' : 'top-left' });
    } catch (err: any) {
      const errorMessage = err.message || t.passwordResetError;
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  const togglePasswordVisibility = (key: string) => {
    setShowPassword((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="p-6 bg-white rounded-xl shadow-sm max-w-6xl w-full">
          <div className="space-y-2 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!chef) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="p-6 bg-white rounded-xl shadow-sm max-w-6xl w-full text-center">
          <p className="text-red-600 text-xs">{t.fetchError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`mx-auto max-w-6xl px-4 py-6 min-h-screen bg-gray-100 font-sans ${isRtl ? 'rtl font-arabic' : 'ltr'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between mb-4"
      >
        <div className="flex items-center gap-2">
          <ChefHat className="w-6 h-6 text-amber-600" />
          <h1 className="text-xl font-bold text-gray-900 truncate">
            {isRtl ? chef.user?.name : chef.user?.nameEn || chef.user?.name}
          </h1>
        </div>
        <button
          onClick={() => navigate('/chefs')}
          className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-sm hover:shadow-md"
        >
          <ArrowLeft className="w-4 h-4" />
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

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex border-b border-gray-200 mb-4">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2 text-xs font-medium ${activeTab === 'details' ? 'border-b-2 border-amber-600 text-amber-600' : 'text-gray-600 hover:text-amber-600'}`}
          >
            {t.details}
          </button>
          <button
            onClick={() => setActiveTab('statistics')}
            className={`px-4 py-2 text-xs font-medium ${activeTab === 'statistics' ? 'border-b-2 border-amber-600 text-amber-600' : 'text-gray-600 hover:text-amber-600'}`}
          >
            {t.statistics}
          </button>
        </div>

        {activeTab === 'details' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-24 font-medium text-gray-600">{t.username}:</span>
                <span className="text-gray-800 truncate flex-1">{chef.user?.username || '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-24 font-medium text-gray-600">{t.email}:</span>
                <span className="text-gray-800 truncate flex-1">{chef.user?.email || '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-24 font-medium text-gray-600">{t.phone}:</span>
                <span className="text-gray-800 truncate flex-1">{chef.user?.phone || '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-24 font-medium text-gray-600">{t.department}:</span>
                <span className="text-gray-800 truncate flex-1">{isRtl ? chef.department?.name : chef.department?.nameEn || chef.department?.name || '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-24 font-medium text-gray-600">{t.status}:</span>
                <span className={`truncate flex-1 ${chef.user?.isActive ? 'text-green-600' : 'text-red-600'}`}>
                  {chef.user?.isActive ? t.active : t.inactive}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-24 font-medium text-gray-600">{t.createdAt}:</span>
                <span className="text-gray-800 truncate flex-1">{new Date(chef.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-24 font-medium text-gray-600">{t.updatedAt}:</span>
                <span className="text-gray-800 truncate flex-1">{new Date(chef.updatedAt).toLocaleString()}</span>
              </div>
            </div>
            {loggedInUser?.role === 'admin' && (
              <div className="flex justify-end gap-2">
                <button
                  onClick={openEditModal}
                  className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs transition-colors shadow-sm hover:shadow-md"
                >
                  {t.edit}
                </button>
                <button
                  onClick={openResetPasswordModal}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs transition-colors shadow-sm hover:shadow-md"
                >
                  {t.resetPassword}
                </button>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'statistics' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {stats ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-amber-50 rounded-lg shadow-sm">
                    <h4 className="text-xs font-medium text-gray-600">{t.ordersCompleted}</h4>
                    <p className="text-lg font-bold text-amber-600">{stats.ordersCompleted}</p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-lg shadow-sm">
                    <h4 className="text-xs font-medium text-gray-600">{t.avgPrepTime}</h4>
                    <p className="text-lg font-bold text-amber-600">{stats.averagePrepTime}</p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-lg shadow-sm">
                    <h4 className="text-xs font-medium text-gray-600">{t.rating}</h4>
                    <p className="text-lg font-bold text-amber-600">{stats.rating.toFixed(1)}</p>
                  </div>
                </div>
                <div className="p-4 bg-white rounded-lg shadow-sm">
                  
                </div>
              </>
            ) : (
              <p className="text-gray-600 text-xs">{t.fetchError}</p>
            )}
          </motion.div>
        )}
      </div>

      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-xl shadow-xl max-w-full w-[90vw] sm:max-w-lg p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.edit}</h3>
            <form onSubmit={handleSubmit} className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-xs font-medium text-gray-700 mb-1">                    {t.name}
                  </label>
                  <input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t.namePlaceholder}
                    required
                    className={`w-full px-3 py-2 border ${formErrors.name ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs ${isRtl ? 'text-right' : 'text-left'}`}
                  />
                  {formErrors.name && <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>}
                </div>
                <div>
                  <label htmlFor="nameEn" className="block text-xs font-medium text-gray-700 mb-1">{t.nameEn}</label>
                  <input
                    id="nameEn"
                    value={formData.nameEn}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    placeholder={t.nameEnPlaceholder}
                    required
                    className={`w-full px-3 py-2 border ${formErrors.nameEn ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs ${isRtl ? 'text-right' : 'text-left'}`}
                  />
                  {formErrors.nameEn && <p className="text-xs text-red-600 mt-1">{formErrors.nameEn}</p>}
                </div>
                <div>
                  <label htmlFor="username" className="block text-xs font-medium text-gray-700 mb-1">{t.username}</label>
                  <input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder={t.usernamePlaceholder}
                    required
                    className={`w-full px-3 py-2 border ${formErrors.username ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs ${isRtl ? 'text-right' : 'text-left'}`}
                  />
                  {formErrors.username && <p className="text-xs text-red-600 mt-1">{formErrors.username}</p>}
                </div>
                <div>
                  <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1">{t.email}</label>
                  <input
                    id="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder={t.emailPlaceholder}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all  duration-300 bg-white shadow-sm hover:shadow-md text-xs ${isRtl ? 'text-right' : 'text-left'}`}
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-xs font-medium text-gray-700 mb-1">{t.phone}</label>
                  <input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder={t.phonePlaceholder}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs ${isRtl ? 'text-right' : 'text-left'}`}
                  />
                </div>
                <div>
                  <label htmlFor="department" className="block text-xs font-medium text-gray-700 mb-1">{t.department}</label>
                  <CustomDropdown
                    value={formData.department}
                    onChange={(value) => setFormData({ ...formData, department: value })}
                    options={[
                      { value: '', label: t.departmentPlaceholder },
                      ...departments.map((dept) => ({
                        value: dept.id,
                        label: isRtl ? dept.name : dept.nameEn || dept.name,
                      })),
                    ]}
                    ariaLabel={t.department}
                  />
                  {formErrors.department && <p className="text-xs text-red-600 mt-1">{formErrors.department}</p>}
                </div>
                <div>
                  <label htmlFor="status" className="block text-xs font-medium text-gray-700 mb-1">{t.status}</label>
                  <CustomDropdown
                    value={formData.isActive}
                    onChange={(value) => setFormData({ ...formData, isActive: value === 'true' })}
                    options={[
                      { value: true, label: t.active },
                      { value: false, label: t.inactive },
                    ]}
                    ariaLabel={t.status}
                  />
                </div>
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
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs transition-colors shadow-sm hover:shadow-md"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors shadow-sm hover:shadow-md"
                >
                  {t.update}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {isResetPasswordModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-xl shadow-xl max-w-full w-[90vw] sm:max-w-sm p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.resetPassword}</h3>
            <form onSubmit={handleResetPassword} className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
              <div>
                <label htmlFor="newPassword" className="block text-xs font-medium text-gray-700 mb-1">{t.newPassword}</label>
                <CustomInput
                  value={resetPasswordData.password}
                  onChange={(value) => setResetPasswordData({ ...resetPasswordData, password: value })}
                  placeholder={t.newPasswordPlaceholder}
                  ariaLabel={t.newPassword}
                  type="password"
                  showPasswordToggle
                  showPassword={showPassword['newPassword']}
                  togglePasswordVisibility={() => togglePasswordVisibility('newPassword')}
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-medium text-gray-700 mb-1">{t.confirmPassword}</label>
                <CustomInput
                  value={resetPasswordData.confirmPassword}
                  onChange={(value) => setResetPasswordData({ ...resetPasswordData, confirmPassword: value })}
                  placeholder={t.confirmPasswordPlaceholder}
                  ariaLabel={t.confirmPassword}
                  type="password"
                  showPasswordToggle
                  showPassword={showPassword['confirmPassword']}
                  togglePasswordVisibility={() => togglePasswordVisibility('confirmPassword')}
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
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors shadow-sm hover:shadow-md"
                >
                  {t.reset}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}