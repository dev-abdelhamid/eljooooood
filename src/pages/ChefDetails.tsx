import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { chefsAPI, departmentAPI } from '../services/api';
import { ChefHat, AlertCircle, Edit2, Trash2, Key, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomInput } from '../components/UI/CustomInput';
import { CustomDropdown } from '../components/UI/CustomDropdown';

interface Department {
  id: string;
  name: string;
  nameEn?: string;
  code: string;
  description?: string;
  displayName: string;
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

const translations = {
  ar: {
    chefDetails: 'تفاصيل الشيف',
    back: 'رجوع',
    name: 'اسم الشيف (عربي)',
    nameEn: 'اسم الشيف (إنجليزي)',
    username: 'اسم المستخدم',
    email: 'الإيميل',
    phone: 'الهاتف',
    department: 'القسم',
    status: 'الحالة',
    active: 'نشط',
    inactive: 'غير نشط',
    createdAt: 'تاريخ الإنشاء',
    updatedAt: 'تاريخ التحديث',
    edit: 'تعديل',
    resetPassword: 'تغيير كلمة المرور',
    delete: 'حذف',
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
    unauthorized: 'غير مصرح لك',
    fetchError: 'خطأ في جلب البيانات',
    updateError: 'خطأ في تحديث الشيف',
    updated: 'تم تحديث الشيف بنجاح',
    passwordResetSuccess: 'تم تغيير كلمة المرور بنجاح',
    passwordResetError: 'خطأ في تغيير كلمة المرور',
    newPassword: 'كلمة المرور الجديدة',
    confirmPassword: 'تأكيد كلمة المرور',
    newPasswordPlaceholder: 'أدخل كلمة المرور الجديدة',
    confirmPasswordPlaceholder: 'أدخل تأكيد كلمة المرور',
    passwordMismatch: 'كلمات المرور غير متطابقة',
    passwordTooShort: 'كلمة المرور قصيرة جدًا (6 أحرف على الأقل)',
    reset: 'إعادة تعيين',
    cancel: 'إلغاء',
    confirmDelete: 'تأكيد الحذف',
    deleteWarning: 'هل أنت متأكد من حذف هذا الشيف؟',
    deleteError: 'خطأ في الحذف',
    deleted: 'تم الحذف بنجاح',
    noDepartments: 'لا توجد أقسام متاحة',
    notFound: 'الشيف غير موجود',
  },
  en: {
    chefDetails: 'Chef Details',
    back: 'Back',
    name: 'Chef Name (Arabic)',
    nameEn: 'Chef Name (English)',
    username: 'Username',
    email: 'Email',
    phone: 'Phone',
    department: 'Department',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    createdAt: 'Created At',
    updatedAt: 'Updated At',
    edit: 'Edit',
    resetPassword: 'Change Password',
    delete: 'Delete',
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
    unauthorized: 'Unauthorized access',
    fetchError: 'Error fetching data',
    updateError: 'Error updating chef',
    updated: 'Chef updated successfully',
    passwordResetSuccess: 'Password changed successfully',
    passwordResetError: 'Error changing password',
    newPassword: 'New Password',
    confirmPassword: 'Confirm Password',
    newPasswordPlaceholder: 'Enter new password',
    confirmPasswordPlaceholder: 'Enter confirm password',
    passwordMismatch: 'Passwords do not match',
    passwordTooShort: 'Password too short (at least 6 characters)',
    reset: 'Reset',
    cancel: 'Cancel',
    confirmDelete: 'Confirm Deletion',
    deleteWarning: 'Are you sure you want to delete this chef?',
    deleteError: 'Error deleting',
    deleted: 'Deleted successfully',
    noDepartments: 'No departments available',
    notFound: 'Chef not found',
  },
};

export function ChefDetails() {
  const { id } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [chef, setChef] = useState<Chef | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
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

  const fetchData = useCallback(async () => {
    if (!id) {
      setError(t.notFound);
      setLoading(false);
      toast.error(t.notFound, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    if (!user || user.role !== 'admin') {
      setError(t.unauthorized);
      setLoading(false);
      toast.error(t.unauthorized, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    setLoading(true);
    try {
      const [chefResponse, departmentsResponse] = await Promise.all([
        chefsAPI.getById(id), // استخدام getById
        departmentAPI.getAll({ isRtl }),
      ]);

      // الاستجابة من /chefs/:id لا تحتوي على مفتاح data
      const chefData = chefResponse;
      if (!chefData || !chefData.user || !chefData.department) {
        setError(t.notFound);
        toast.error(t.notFound, { position: isRtl ? 'top-right' : 'top-left' });
        setLoading(false);
        return;
      }

      setChef({
        id: chefData._id,
        user: {
          id: chefData.user._id,
          name: chefData.user.name,
          nameEn: chefData.user.nameEn,
          username: chefData.user.username,
          email: chefData.user.email,
          phone: chefData.user.phone,
          isActive: chefData.user.isActive,
          createdAt: chefData.user.createdAt,
          updatedAt: chefData.user.updatedAt,
        },
        department: {
          id: chefData.department._id,
          name: chefData.department.name,
          nameEn: chefData.department.nameEn,
          code: chefData.department.code,
          description: chefData.department.description,
          displayName: isRtl ? chefData.department.name : chefData.department.nameEn || chefData.department.name,
        },
        createdAt: chefData.createdAt,
        updatedAt: chefData.updatedAt,
      });

      const departmentsData = Array.isArray(departmentsResponse.data) ? departmentsResponse.data : [];
      setDepartments(
        departmentsData.map((dept: any) => ({
          id: dept._id,
          name: dept.name,
          nameEn: dept.nameEn,
          code: dept.code,
          description: dept.description,
          displayName: isRtl ? dept.name : dept.nameEn || dept.name,
        }))
      );

      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Fetch error:`, err);
      setError(err.message || t.fetchError);
      toast.error(err.message || t.fetchError, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setLoading(false);
    }
  }, [id, user, t, isRtl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    if (departments.length === 0) {
      setError(t.noDepartments);
      toast.error(t.noDepartments, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    setFormData({
      name: chef?.user?.name || '',
      nameEn: chef?.user?.nameEn || '',
      username: chef?.user?.username || '',
      email: chef?.user?.email || '',
      phone: chef?.user?.phone || '',
      department: chef?.department?.id || departments[0].id,
      isActive: chef?.user?.isActive ?? true,
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

  const openDeleteModal = () => {
    setIsDeleteModalOpen(true);
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
          role: 'chef',
          isActive: formData.isActive,
        },
        department: formData.department,
      };
      const response = await chefsAPI.update(chef!.id, chefData);
      const updatedChef = response; // الاستجابة لا تحتوي على مفتاح data
      setChef({
        ...chef!,
        user: {
          ...chef!.user!,
          name: updatedChef.user.name,
          nameEn: updatedChef.user.nameEn,
          username: updatedChef.user.username,
          email: updatedChef.user.email,
          phone: updatedChef.user.phone,
          isActive: updatedChef.user.isActive,
          updatedAt: updatedChef.user.updatedAt,
        },
        department: {
          id: updatedChef.department._id,
          name: updatedChef.department.name,
          nameEn: updatedChef.department.nameEn,
          code: updatedChef.department.code,
          description: updatedChef.department.description,
          displayName: isRtl ? updatedChef.department.name : updatedChef.department.nameEn || updatedChef.department.name,
        },
        updatedAt: updatedChef.updatedAt,
      });
      toast.success(t.updated, { position: isRtl ? 'top-right' : 'top-left' });
      setIsEditModalOpen(false);
    } catch (err: any) {
      const errorMessage = err.message || t.updateError;
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
      await chefsAPI.resetPassword(chef!.id, resetPasswordData.password);
      setIsResetPasswordModalOpen(false);
      setResetPasswordData({ password: '', confirmPassword: '' });
      toast.success(t.passwordResetSuccess, { position: isRtl ? 'top-right' : 'top-left' });
    } catch (err: any) {
      const errorMessage = err.message || t.passwordResetError;
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  const handleDelete = async () => {
    try {
      await chefsAPI.delete(chef!.id);
      toast.success(t.deleted, { position: isRtl ? 'top-right' : 'top-left' });
      setIsDeleteModalOpen(false);
      navigate('/chefs');
    } catch (err: any) {
      const errorMessage = err.message || t.deleteError;
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPassword((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="p-6 bg-white rounded-xl shadow-sm max-w-md w-full">
          <div className="space-y-4 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!chef) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="p-6 bg-white rounded-xl shadow-sm max-w-md w-full text-center">
          <AlertCircle className="w-10 h-10 text-red-600 mx-auto mb-3" />
          <p className="text-gray-600 text-sm">{t.notFound}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`mx-auto max-w-3xl px-4 py-6 min-h-screen bg-gray-100 font-sans ${
        isRtl ? 'rtl font-arabic' : 'ltr'
      }`}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between mb-6"
      >
        <div className="flex items-center gap-2">
          <ChefHat className="w-6 h-6 text-amber-600" />
          <h1 className="text-xl font-bold text-gray-900">{t.chefDetails}</h1>
        </div>
        <button
          onClick={() => navigate('/chefs')}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm transition-colors flex items-center gap-2 shadow-sm hover:shadow-md"
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
            <span className="text-red-600 text-sm">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-xl shadow-sm p-6"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              {isRtl ? chef.user?.name : chef.user?.nameEn || chef.user?.name}
            </h2>
            <ChefHat className="w-6 h-6 text-amber-600" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="block text-sm font-medium text-gray-700">{t.name}</span>
              <span className="text-sm text-gray-600">{chef.user?.name || '-'}</span>
            </div>
            <div>
              <span className="block text-sm font-medium text-gray-700">{t.nameEn}</span>
              <span className="text-sm text-gray-600">{chef.user?.nameEn || '-'}</span>
            </div>
            <div>
              <span className="block text-sm font-medium text-gray-700">{t.username}</span>
              <span className="text-sm text-gray-600">{chef.user?.username || '-'}</span>
            </div>
            <div>
              <span className="block text-sm font-medium text-gray-700">{t.email}</span>
              <span className="text-sm text-gray-600">{chef.user?.email || '-'}</span>
            </div>
            <div>
              <span className="block text-sm font-medium text-gray-700">{t.phone}</span>
              <span className="text-sm text-gray-600">{chef.user?.phone || '-'}</span>
            </div>
            <div>
              <span className="block text-sm font-medium text-gray-700">{t.department}</span>
              <span className="text-sm text-gray-600">{chef.department?.displayName || '-'}</span>
            </div>
            <div>
              <span className="block text-sm font-medium text-gray-700">{t.status}</span>
              <span className={`text-sm ${chef.user?.isActive ? 'text-green-600' : 'text-red-600'}`}>
                {chef.user?.isActive ? t.active : t.inactive}
              </span>
            </div>
            <div>
              <span className="block text-sm font-medium text-gray-700">{t.createdAt}</span>
              <span className="text-sm text-gray-600">
                {new Date(chef.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}
              </span>
            </div>
            <div>
              <span className="block text-sm font-medium text-gray-700">{t.updatedAt}</span>
              <span className="text-sm text-gray-600">
                {new Date(chef.updatedAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}
              </span>
            </div>
          </div>
          {user?.role === 'admin' && (
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={openEditModal}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors flex items-center gap-2 shadow-sm hover:shadow-md"
              >
                <Edit2 className="w-4 h-4" />
                {t.edit}
              </button>
              <button
                onClick={openResetPasswordModal}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm transition-colors flex items-center gap-2 shadow-sm hover:shadow-md"
              >
                <Key className="w-4 h-4" />
                {t.resetPassword}
              </button>
              <button
                onClick={openDeleteModal}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition-colors flex items-center gap-2 shadow-sm hover:shadow-md"
              >
                <Trash2 className="w-4 h-4" />
                {t.delete}
              </button>
            </div>
          )}
        </div>
      </motion.div>

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
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    {t.name}
                  </label>
                  <CustomInput
                    value={formData.name}
                    onChange={(value) => setFormData({ ...formData, name: value })}
                    placeholder={t.namePlaceholder}
                    ariaLabel={t.name}
                    type="text"
                  />
                  {formErrors.name && <p className="text-sm text-red-600 mt-1">{formErrors.name}</p>}
                </div>
                <div>
                  <label htmlFor="nameEn" className="block text-sm font-medium text-gray-700 mb-1">
                    {t.nameEn}
                  </label>
                  <CustomInput
                    value={formData.nameEn}
                    onChange={(value) => setFormData({ ...formData, nameEn: value })}
                    placeholder={t.nameEnPlaceholder}
                    ariaLabel={t.nameEn}
                    type="text"
                  />
                  {formErrors.nameEn && <p className="text-sm text-red-600 mt-1">{formErrors.nameEn}</p>}
                </div>
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                    {t.username}
                  </label>
                  <CustomInput
                    value={formData.username}
                    onChange={(value) => setFormData({ ...formData, username: value })}
                    placeholder={t.usernamePlaceholder}
                    ariaLabel={t.username}
                    type="text"
                  />
                  {formErrors.username && <p className="text-sm text-red-600 mt-1">{formErrors.username}</p>}
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    {t.email}
                  </label>
                  <CustomInput
                    value={formData.email}
                    onChange={(value) => setFormData({ ...formData, email: value })}
                    placeholder={t.emailPlaceholder}
                    ariaLabel={t.email}
                    type="email"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    {t.phone}
                  </label>
                  <CustomInput
                    value={formData.phone}
                    onChange={(value) => setFormData({ ...formData, phone: value })}
                    placeholder={t.phonePlaceholder}
                    ariaLabel={t.phone}
                    type="tel"
                  />
                </div>
                <div>
                  <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
                    {t.department}
                  </label>
                  <CustomDropdown
                    value={formData.department}
                    onChange={(value) => setFormData({ ...formData, department: value })}
                    options={[
                      { value: '', label: t.departmentPlaceholder },
                      ...departments.map((dept) => ({
                        value: dept.id,
                        label: dept.displayName,
                      })),
                    ]}
                    ariaLabel={t.department}
                  />
                  {formErrors.department && <p className="text-sm text-red-600 mt-1">{formErrors.department}</p>}
                </div>
                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                    {t.status}
                  </label>
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
                  <span className="text-red-600 text-sm">{error}</span>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm transition-colors shadow-sm hover:shadow-md"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm transition-colors shadow-sm hover:shadow-md"
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
              <div className="space-y-4">
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    {t.newPassword}
                  </label>
                  <CustomInput
                    value={resetPasswordData.password}
                    onChange={(value) => setResetPasswordData({ ...resetPasswordData, password: value })}
                    placeholder={t.newPasswordPlaceholder}
                    ariaLabel={t.newPassword}
                    type="password"
                    showPasswordToggle
                    showPassword={showPassword['reset']}
                    togglePasswordVisibility={() => togglePasswordVisibility('reset')}
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    {t.confirmPassword}
                  </label>
                  <CustomInput
                    value={resetPasswordData.confirmPassword}
                    onChange={(value) => setResetPasswordData({ ...resetPasswordData, confirmPassword: value })}
                    placeholder={t.confirmPasswordPlaceholder}
                    ariaLabel={t.confirmPassword}
                    type="password"
                    showPasswordToggle
                    showPassword={showPassword['confirm']}
                    togglePasswordVisibility={() => togglePasswordVisibility('confirm')}
                  />
                </div>
                {error && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="text-red-600 text-sm">{error}</span>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsResetPasswordModalOpen(false)}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm transition-colors shadow-sm hover:shadow-md"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm transition-colors shadow-sm hover:shadow-md"
                  >
                    {t.reset}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-xl shadow-xl max-w-full w-[90vw] sm:max-w-sm p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.confirmDelete}</h3>
            <p className="text-sm text-gray-600 mb-4">{t.deleteWarning}</p>
            {error && (
              <div className="p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 mb-4">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-red-600 text-sm">{error}</span>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm transition-colors shadow-sm hover:shadow-md"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors shadow-sm hover:shadow-md"
              >
                {t.delete}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}