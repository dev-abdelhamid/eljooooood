import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { chefsAPI, departmentAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Modal } from '../components/UI/Modal';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { ChefHat, Search, AlertCircle, Plus, Edit2, Trash2, Key, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';

interface Chef {
  _id: string;
  user: {
    _id: string;
    name: string;
    nameEn?: string;
    username: string;
    email?: string;
    phone?: string;
    isActive: boolean;
  } | null;
  department: { _id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  password?: string; // For admin view only
}

interface Department {
  _id: string;
  name: string;
}

const translations = {
  ar: {
    manage: 'إدارة الشيفات',
    add: 'إضافة شيف',
    addFirst: 'إضافة أول شيف',
    noChefs: 'لا توجد شيفات',
    noMatch: 'لا توجد شيفات مطابقة',
    empty: 'لا توجد شيفات متاحة',
    searchPlaceholder: 'ابحث عن الشيفات...',
    previous: 'السابق',
    next: 'التالي',
    page: 'صفحة',
    of: 'من',
    username: 'اسم المستخدم',
    email: 'الإيميل',
    phone: 'الهاتف',
    department: 'القسم',
    createdAt: 'تاريخ الإنشاء',
    updatedAt: 'تاريخ التحديث',
    edit: 'تعديل',
    resetPassword: 'تغيير كلمة المرور',
    delete: 'حذف',
    name: 'اسم الشيف (عربي)',
    nameEn: 'اسم الشيف (إنجليزي)',
    nameRequired: 'اسم الشيف مطلوب',
    nameEnRequired: 'اسم الشيف بالإنجليزية مطلوب',
    usernameRequired: 'اسم المستخدم مطلوب',
    passwordRequired: 'كلمة المرور مطلوبة',
    departmentRequired: 'القسم مطلوب',
    namePlaceholder: 'أدخل اسم الشيف',
    nameEnPlaceholder: 'أدخل اسم الشيف بالإنجليزية',
    usernamePlaceholder: 'أدخل اسم المستخدم',
    emailPlaceholder: 'أدخل الإيميل',
    phonePlaceholder: 'أدخل رقم الهاتف',
    departmentPlaceholder: 'اختر القسم',
    passwordPlaceholder: 'أدخل كلمة المرور',
    update: 'تحديث الشيف',
    requiredFields: 'يرجى ملء جميع الحقول المطلوبة',
    usernameExists: 'اسم المستخدم مستخدم بالفعل',
    emailExists: 'الإيميل مستخدم بالفعل',
    unauthorized: 'غير مصرح لك',
    fetchError: 'خطأ في جلب البيانات',
    updateError: 'خطأ في تحديث الشيف',
    createError: 'خطأ في إنشاء الشيف',
    added: 'تم إضافة الشيف بنجاح',
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
    confirmDelete: 'تأكيد الحذف',
    deleteWarning: 'هل أنت متأكد من حذف هذا الشيف؟',
    deleteError: 'خطأ في الحذف',
    deleted: 'تم الحذف بنجاح',
    profile: 'عرض التفاصيل',
    currentPassword: 'كلمة المرور الحالية',
    noDepartments: 'لا توجد أقسام متاحة',
    invalidUser: 'مستخدم غير صالح',
    status: 'الحالة',
    active: 'نشط',
    inactive: 'غير نشط',
  },
  en: {
    manage: 'Manage Chefs',
    add: 'Add Chef',
    addFirst: 'Add First Chef',
    noChefs: 'No Chefs Found',
    noMatch: 'No Matching Chefs',
    empty: 'No Chefs Available',
    searchPlaceholder: 'Search chefs...',
    previous: 'Previous',
    next: 'Next',
    page: 'Page',
    of: 'of',
    username: 'Username',
    email: 'Email',
    phone: 'Phone',
    department: 'Department',
    createdAt: 'Created At',
    updatedAt: 'Updated At',
    edit: 'Edit',
    resetPassword: 'Change Password',
    delete: 'Delete',
    name: 'Chef Name (Arabic)',
    nameEn: 'Chef Name (English)',
    nameRequired: 'Chef name is required',
    nameEnRequired: 'Chef name in English is required',
    usernameRequired: 'Username is required',
    passwordRequired: 'Password is required',
    departmentRequired: 'Department is required',
    namePlaceholder: 'Enter chef name',
    nameEnPlaceholder: 'Enter chef name in English',
    usernamePlaceholder: 'Enter username',
    emailPlaceholder: 'Enter email',
    phonePlaceholder: 'Enter phone number',
    departmentPlaceholder: 'Select department',
    passwordPlaceholder: 'Enter password',
    update: 'Update Chef',
    requiredFields: 'Please fill all required fields',
    usernameExists: 'Username already in use',
    emailExists: 'Email already in use',
    unauthorized: 'Unauthorized access',
    fetchError: 'Error fetching data',
    updateError: 'Error updating chef',
    createError: 'Error creating chef',
    added: 'Chef added successfully',
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
    confirmDelete: 'Confirm Deletion',
    deleteWarning: 'Are you sure you want to delete this chef?',
    deleteError: 'Error deleting',
    deleted: 'Deleted successfully',
    profile: 'View Details',
    currentPassword: 'Current Password',
    noDepartments: 'No departments available',
    invalidUser: 'Invalid user',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
  },
};

export function Chefs() {
  const { language } = useLanguage();
  const { user: loggedInUser } = useAuth();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedChef, setSelectedChef] = useState<Chef | null>(null);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [resetPasswordData, setResetPasswordData] = useState({ password: '', confirmPassword: '' });
  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    username: '',
    email: '',
    phone: '',
    department: '',
    password: '',
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async () => {
    if (!loggedInUser || loggedInUser.role !== 'admin') {
      setError(t.unauthorized);
      setLoading(false);
      toast.error(t.unauthorized, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }

    setLoading(true);
    try {
      const [chefsResponse, departmentsResponse] = await Promise.all([
        chefsAPI.getAll({ page, limit: 10 }),
        departmentAPI.getAll(),
      ]);
      const fetchedChefs = Array.isArray(chefsResponse.data) ? chefsResponse.data : chefsResponse;
      setChefs(fetchedChefs.map((chef: Chef) => ({ ...chef, password: '********' }))); // Mock for security
      setDepartments(Array.isArray(departmentsResponse.data) ? departmentsResponse.data : departmentsResponse);
      setTotalPages(chefsResponse.totalPages || Math.ceil(fetchedChefs.length / 10));
      setError('');
    } catch (err: any) {
      setError(err.message || t.fetchError);
      toast.error(t.fetchError, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setLoading(false);
    }
  }, [loggedInUser, page, t, isRtl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredChefs = chefs.filter(
    (chef) =>
      chef.user &&
      ((isRtl ? chef.user.name : chef.user.nameEn || chef.user.name)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chef.user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chef.user.email?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.name) errors.name = t.nameRequired;
    if (!formData.nameEn) errors.nameEn = t.nameEnRequired;
    if (!formData.username) errors.username = t.usernameRequired;
    if (!isEditMode && !formData.password) errors.password = t.passwordRequired;
    if (!formData.department) errors.department = t.departmentRequired;
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openAddModal = () => {
    if (departments.length === 0) {
      setError(t.noDepartments);
      toast.error(t.noDepartments, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    setFormData({
      name: '',
      nameEn: '',
      username: '',
      email: '',
      phone: '',
      department: departments[0]._id,
      password: '',
      isActive: true,
    });
    setIsEditMode(false);
    setSelectedChef(null);
    setIsModalOpen(true);
    setFormErrors({});
    setError('');
  };

  const openEditModal = (chef: Chef) => {
    setFormData({
      name: chef.user?.name || '',
      nameEn: chef.user?.nameEn || '',
      username: chef.user?.username || '',
      email: chef.user?.email || '',
      phone: chef.user?.phone || '',
      department: chef.department?._id || '',
      password: '',
      isActive: chef.user?.isActive ?? true,
    });
    setIsEditMode(true);
    setSelectedChef(chef);
    setIsModalOpen(true);
    setFormErrors({});
    setError('');
  };

  const openProfileModal = (chef: Chef) => {
    setSelectedChef(chef);
    setIsProfileModalOpen(true);
  };

  const openResetPasswordModal = (chef: Chef) => {
    setSelectedChef(chef);
    setResetPasswordData({ password: '', confirmPassword: '' });
    setIsResetPasswordModalOpen(true);
    setError('');
  };

  const openDeleteModal = (chef: Chef) => {
    setSelectedChef(chef);
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
          ...(isEditMode ? {} : { password: formData.password.trim() }),
        },
        department: formData.department,
      };

      if (isEditMode && selectedChef) {
        const updatedChef = await chefsAPI.update(selectedChef._id, chefData);
        setChefs(chefs.map((c) => (c._id === selectedChef._id ? { ...updatedChef, password: '********' } : c)));
        toast.success(t.updated, { position: isRtl ? 'top-right' : 'top-left' });
      } else {
        const newChef = await chefsAPI.create(chefData);
        setChefs([...chefs, { ...newChef, password: '********' }]);
        toast.success(t.added, { position: isRtl ? 'top-right' : 'top-left' });
      }
      setIsModalOpen(false);
      setError('');
    } catch (err: any) {
      let errorMessage = isEditMode ? t.updateError : t.createError;
      if (err.response?.data?.message) {
        const message = err.response.data.message;
        errorMessage =
          message === 'Username already exists' ? t.usernameExists :
          message.includes('email') ? t.emailExists : message;
      }
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordData.password || !resetPasswordData.confirmPassword) {
      setError(t.passwordRequired);
      return;
    }
    if (resetPasswordData.password !== resetPasswordData.confirmPassword) {
      setError(t.passwordMismatch);
      return;
    }
    if (resetPasswordData.password.length < 6) {
      setError(t.passwordTooShort);
      return;
    }

    try {
      await chefsAPI.resetPassword(selectedChef!._id, resetPasswordData.password);
      setChefs(chefs.map((c) => (c._id === selectedChef!._id ? { ...c, password: '********' } : c)));
      setIsResetPasswordModalOpen(false);
      toast.success(t.passwordResetSuccess, { position: isRtl ? 'top-right' : 'top-left' });
    } catch (err: any) {
      setError(err.message || t.passwordResetError);
      toast.error(t.passwordResetError, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  const handleDelete = async () => {
    if (!selectedChef) return;
    try {
      await chefsAPI.delete(selectedChef._id);
      setChefs(chefs.filter((c) => c._id !== selectedChef._id));
      setIsDeleteModalOpen(false);
      toast.success(t.deleted, { position: isRtl ? 'top-right' : 'top-left' });
    } catch (err: any) {
      setError(err.message || t.deleteError);
      toast.error(t.deleteError, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPassword((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className={`mx-auto max-w-6xl p-4 sm:p-6 min-h-screen bg-gray-100 font-sans ${isRtl ? 'rtl font-arabic' : 'ltr'}`}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4"
      >
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-blue-500" />
          {t.manage}
        </h1>
        {loggedInUser?.role === 'admin' && (
          <Button
            variant="primary"
            icon={Plus}
            onClick={openAddModal}
            className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-full px-4 py-2 shadow-md transition-all duration-300 hover:shadow-lg"
          >
            {t.add}
          </Button>
        )}
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 shadow-sm"
          >
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-red-500 text-sm font-medium">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="p-4 sm:p-6 mb-6 bg-white rounded-2xl shadow-sm">
        <div className="relative flex-1 w-full sm:w-auto">
          <Search
            className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4`}
          />
          <Input
            value={searchTerm}
            onChange={(value) => setSearchTerm(value)}
            placeholder={t.searchPlaceholder}
            className={`pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-sm ${isRtl ? 'text-right' : 'text-left'}`}
            aria-label={t.searchPlaceholder}
          />
        </div>
      </Card>

      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ staggerChildren: 0.1 }}
      >
        {filteredChefs.length === 0 ? (
          <Card className="p-6 text-center bg-white rounded-2xl shadow-sm col-span-full">
            <ChefHat className="w-8 h-8 text-blue-400 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-800">{t.noChefs}</h3>
            <p className="text-gray-500 text-xs mt-2">
              {searchTerm ? t.noMatch : t.empty}
            </p>
            {loggedInUser?.role === 'admin' && !searchTerm && (
              <Button
                variant="primary"
                icon={Plus}
                onClick={openAddModal}
                className="mt-4 bg-blue-500 hover:bg-blue-600 text-white rounded-full px-4 py-2 text-sm shadow-md transition-all duration-300 hover:shadow-lg"
              >
                {t.addFirst}
              </Button>
            )}
          </Card>
        ) : (
          filteredChefs.map((chef) => (
            <motion.div
              key={chef._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer" onClick={() => openProfileModal(chef)}>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm text-gray-800 truncate">{isRtl ? chef.user?.name : chef.user?.nameEn || chef.user?.name}</h3>
                    <ChefHat className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="text-gray-600 flex"><span className="w-16 font-medium">{t.username}:</span> <span className="truncate">{chef.user?.username || '-'}</span></p>
                    <p className="text-gray-600 flex"><span className="w-16 font-medium">{t.email}:</span> <span className="truncate">{chef.user?.email || '-'}</span></p>
                    <p className="text-gray-600 flex"><span className="w-16 font-medium">{t.phone}:</span> <span>{chef.user?.phone || '-'}</span></p>
                    <p className="text-gray-600 flex"><span className="w-16 font-medium">{t.department}:</span> <span>{chef.department?.name || '-'}</span></p>
                    <p className={`flex ${chef.user?.isActive ? 'text-green-600' : 'text-red-600'}`}>
                      <span className="w-16 font-medium">{t.status}:</span> <span>{chef.user?.isActive ? t.active : t.inactive}</span>
                    </p>
                  </div>
                  {loggedInUser?.role === 'admin' && (
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="outline"
                        icon={Edit2}
                        onClick={(e) => { e.stopPropagation(); openEditModal(chef); }}
                        className="text-blue-500 hover:text-blue-600 border-blue-500 rounded-full text-xs px-3 py-1"
                      >
                        {t.edit}
                      </Button>
                      <Button
                        variant="outline"
                        icon={Key}
                        onClick={(e) => { e.stopPropagation(); openResetPasswordModal(chef); }}
                        className="text-blue-500 hover:text-blue-600 border-blue-500 rounded-full text-xs px-3 py-1"
                      >
                        {t.resetPassword}
                      </Button>
                      <Button
                        variant="outline"
                        icon={Trash2}
                        onClick={(e) => { e.stopPropagation(); openDeleteModal(chef); }}
                        className="text-red-500 hover:text-red-600 border-red-500 rounded-full text-xs px-3 py-1"
                      >
                        {t.delete}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </motion.div>

      {totalPages > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-center items-center mt-6 gap-2"
        >
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page === 1}
            className="px-3 py-1 bg-white text-gray-600 disabled:opacity-50 rounded-full text-xs"
          >
            {t.previous}
          </Button>
          <span className="px-3 py-1 text-gray-700 text-xs">
            {t.page} {page} {t.of} {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            disabled={page === totalPages}
            className="px-3 py-1 bg-white text-gray-600 disabled:opacity-50 rounded-full text-xs"
          >
            {t.next}
          </Button>
        </motion.div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditMode ? t.edit : t.add}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            <div className="space-y-4">
              <Input
                label={t.name}
                value={formData.name}
                onChange={(value) => setFormData({ ...formData, name: value })}
                placeholder={t.namePlaceholder}
                required
                error={formErrors.name}
                className="border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white text-sm transition-all duration-200"
              />
              <Input
                label={t.nameEn}
                value={formData.nameEn}
                onChange={(value) => setFormData({ ...formData, nameEn: value })}
                placeholder={t.nameEnPlaceholder}
                required
                error={formErrors.nameEn}
                className="border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white text-sm transition-all duration-200"
              />
              <Input
                label={t.username}
                value={formData.username}
                onChange={(value) => setFormData({ ...formData, username: value })}
                placeholder={t.usernamePlaceholder}
                required
                error={formErrors.username}
                className="border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white text-sm transition-all duration-200"
              />
              <Input
                label={t.email}
                value={formData.email}
                onChange={(value) => setFormData({ ...formData, email: value })}
                placeholder={t.emailPlaceholder}
                className="border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white text-sm transition-all duration-200"
              />
              <Input
                label={t.phone}
                value={formData.phone}
                onChange={(value) => setFormData({ ...formData, phone: value })}
                placeholder={t.phonePlaceholder}
                className="border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white text-sm transition-all duration-200"
              />
            </div>
            <div className="space-y-4">
              <Select
                label={t.department}
                options={departments.map((dept) => ({ value: dept._id, label: dept.name }))}
                value={formData.department}
                onChange={(value) => setFormData({ ...formData, department: value })}
                placeholder={t.departmentPlaceholder}
                required
                error={formErrors.department}
                className="border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white text-sm transition-all duration-200"
              />
              <Select
                label={t.status}
                options={[
                  { value: true, label: t.active },
                  { value: false, label: t.inactive },
                ]}
                value={formData.isActive}
                onChange={(value) => setFormData({ ...formData, isActive: value === 'true' })}
                className="border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white text-sm transition-all duration-200"
              />
              {!isEditMode && (
                <Input
                  label={t.password}
                  value={formData.password}
                  onChange={(value) => setFormData({ ...formData, password: value })}
                  placeholder={t.passwordPlaceholder}
                  type={showPassword['new'] ? 'text' : 'password'}
                  required
                  error={formErrors.password}
                  className="border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white text-sm transition-all duration-200"
                  icon={showPassword['new'] ? EyeOff : Eye}
                  onIconClick={() => setShowPassword((prev) => ({ ...prev, new: !prev.new }))}
                />
              )}
            </div>
          </motion.div>
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 shadow-sm"
              >
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-red-500 text-sm font-medium">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex gap-3 mt-4">
            <Button
              type="submit"
              variant="primary"
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white rounded-full px-4 py-2 text-sm shadow-md transition-all duration-300 hover:shadow-lg"
            >
              {isEditMode ? t.update : t.add}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full px-4 py-2 text-sm shadow-md transition-all duration-300 hover:shadow-lg"
            >
              {t.cancel}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        title={t.profile}
        size="md"
      >
        {selectedChef && (
          <div className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-blue-500" />
              <h3 className="text-base font-semibold text-gray-800">{isRtl ? selectedChef.user?.name : selectedChef.user?.nameEn || selectedChef.user?.name}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex flex-row items-center gap-2">
                <span className="w-20 font-medium text-gray-600">{t.username}:</span>
                <span className="text-gray-800 truncate">{selectedChef.user?.username || '-'}</span>
              </div>
              <div className="flex flex-row items-center gap-2">
                <span className="w-20 font-medium text-gray-600">{t.email}:</span>
                <span className="text-gray-800 truncate">{selectedChef.user?.email || '-'}</span>
              </div>
              <div className="flex flex-row items-center gap-2">
                <span className="w-20 font-medium text-gray-600">{t.phone}:</span>
                <span className="text-gray-800">{selectedChef.user?.phone || '-'}</span>
              </div>
              <div className="flex flex-row items-center gap-2">
                <span className="w-20 font-medium text-gray-600">{t.department}:</span>
                <span className="text-gray-800">{selectedChef.department?.name || '-'}</span>
              </div>
              <div className="flex flex-row items-center gap-2">
                <span className="w-20 font-medium text-gray-600">{t.status}:</span>
                <span className={`font-medium ${selectedChef.user?.isActive ? 'text-green-600' : 'text-red-600'}`}>
                  {selectedChef.user?.isActive ? t.active : t.inactive}
                </span>
              </div>
              <div className="flex flex-row items-center gap-2">
                <span className="w-20 font-medium text-gray-600">{t.createdAt}:</span>
                <span className="text-gray-800">{new Date(selectedChef.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex flex-row items-center gap-2">
                <span className="w-20 font-medium text-gray-600">{t.updatedAt}:</span>
                <span className="text-gray-800">{new Date(selectedChef.updatedAt).toLocaleString()}</span>
              </div>
              {loggedInUser?.role === 'admin' && (
                <div className="flex flex-row items-center gap-2">
                  <span className="w-20 font-medium text-gray-600">{t.currentPassword}:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-800">{showPassword[selectedChef._id] ? selectedChef.password : '********'}</span>
                    <button type="button" onClick={() => togglePasswordVisibility(selectedChef._id)} className="text-gray-500 hover:text-gray-700">
                      {showPassword[selectedChef._id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <Button
              variant="secondary"
              onClick={() => setIsProfileModalOpen(false)}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full px-4 py-2 text-sm shadow-md transition-all duration-300 hover:shadow-lg"
            >
              {t.cancel}
            </Button>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isResetPasswordModalOpen}
        onClose={() => setIsResetPasswordModalOpen(false)}
        title={t.resetPassword}
        size="sm"
      >
        <form onSubmit={handleResetPassword} className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <Input
            label={t.newPassword}
            value={resetPasswordData.password}
            onChange={(value) => setResetPasswordData({ ...resetPasswordData, password: value })}
            placeholder={t.newPasswordPlaceholder}
            type={showPassword['newPassword'] ? 'text' : 'password'}
            required
            className="border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white text-sm transition-all duration-200"
            icon={showPassword['newPassword'] ? EyeOff : Eye}
            onIconClick={() => setShowPassword((prev) => ({ ...prev, newPassword: !prev.newPassword }))}
          />
          <Input
            label={t.confirmPassword}
            value={resetPasswordData.confirmPassword}
            onChange={(value) => setResetPasswordData({ ...resetPasswordData, confirmPassword: value })}
            placeholder={t.confirmPasswordPlaceholder}
            type={showPassword['confirmPassword'] ? 'text' : 'password'}
            required
            className="border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white text-sm transition-all duration-200"
            icon={showPassword['confirmPassword'] ? EyeOff : Eye}
            onIconClick={() => setShowPassword((prev) => ({ ...prev, confirmPassword: !prev.confirmPassword }))}
          />
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 shadow-sm">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-red-500 text-sm font-medium">{error}</span>
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <Button
              type="submit"
              variant="primary"
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white rounded-full px-4 py-2 text-sm shadow-md transition-all duration-300 hover:shadow-lg"
            >
              {t.reset}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsResetPasswordModalOpen(false)}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full px-4 py-2 text-sm shadow-md transition-all duration-300 hover:shadow-lg"
            >
              {t.cancel}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={t.confirmDelete}
        size="sm"
      >
        <div className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <p className="text-gray-600 text-sm">{t.deleteWarning}</p>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 shadow-sm">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-red-500 text-sm font-medium">{error}</span>
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-full px-4 py-2 text-sm shadow-md transition-all duration-300 hover:shadow-lg"
            >
              {t.delete}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsDeleteModalOpen(false)}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full px-4 py-2 text-sm shadow-md transition-all duration-300 hover:shadow-lg"
            >
              {t.cancel}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}