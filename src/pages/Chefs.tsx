import React, { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { chefsAPI, departmentAPI } from '../services/api';
import { ChefHat, AlertCircle, Plus, Edit2, Trash2, Key, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { debounce } from 'lodash';
import { CustomInput } from '../components/UI/CustomInput';
import { CustomDropdown } from '../components/UI/CustomDropdown';

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

const translations = {
  ar: {
    manage: 'إدارة الشيفات',
    add: 'إضافة شيف',
    addFirst: 'إضافة أول شيف',
    noChefs: 'لا توجد شيفات',
    noMatch: 'لا توجد شيفات مطابقة',
    empty: 'لا توجد شيفات متاحة',
    searchPlaceholder: 'ابحث عن الشيفات...',
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
    noDepartments: 'No departments available',
    invalidUser: 'Invalid user',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
  },
};

// مكون البطاقة مع memo لتحسين الأداء
const ChefCard = memo(({ chef, t, isRtl, navigate, openEditModal, openResetPasswordModal, openDeleteModal, loggedInUser }: {
  chef: Chef;
  t: any;
  isRtl: boolean;
  navigate: (path: string) => void;
  openEditModal: (chef: Chef) => void;
  openResetPasswordModal: (chef: Chef) => void;
  openDeleteModal: (chef: Chef) => void;
  loggedInUser: any;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25, ease: 'easeOut' }}
    className="group"
  >
    <div
      className="p-6 bg-gradient-to-br from-white to-amber-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-md hover:shadow-lg border border-gray-200 dark:border-gray-700 hover:border-amber-300 transition-all duration-300 hover:-translate-y-1 hover:scale-105 cursor-pointer max-w-sm mx-auto border-t-4 border-blue-400"
      onClick={() => navigate(`/chefs/${chef.id}`)}
    >
      <div className="space-y-3 flex flex-col justify-between h-full">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base truncate">
              {isRtl ? chef.user?.name : chef.user?.nameEn || chef.user?.name}
            </h3>
            <motion.div whileHover={{ scale: 1.1 }} transition={{ duration: 0.2 }}>
              <ChefHat className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors" />
            </motion.div>
          </div>
          <p className="text-sm text-blue-600 dark:text-blue-400">
            {isRtl ? (chef.user?.isActive ? 'نشط' : 'غير نشط') : (chef.user?.isActive ? 'Active' : 'Inactive')}
          </p>
          <div className="text-sm text-gray-600 dark:text-gray-300 truncate">{chef.user?.username || '-'}</div>
          <div className="text-sm text-gray-600 dark:text-gray-300 truncate">{chef.user?.email || '-'}</div>
          <div className="text-sm text-gray-600 dark:text-gray-300 truncate">
            {isRtl ? chef.department?.name : chef.department?.nameEn || chef.department?.name || '-'}
          </div>
        </div>
        {loggedInUser?.role === 'admin' && (
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                openEditModal(chef);
              }}
              className="p-2 w-10 h-10 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors flex items-center justify-center shadow-sm hover:shadow-md"
              title={t.edit}
              aria-label={t.edit}
            >
              <Edit2 className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openResetPasswordModal(chef);
              }}
              className="p-2 w-10 h-10 bg-amber-500 hover:bg-amber-600 text-white rounded-full transition-colors flex items-center justify-center shadow-sm hover:shadow-md"
              title={t.resetPassword}
              aria-label={t.resetPassword}
            >
              <Key className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openDeleteModal(chef);
              }}
              className="p-2 w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors flex items-center justify-center shadow-sm hover:shadow-md"
              title={t.delete}
              aria-label={t.delete}
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  </motion.div>
));

export function Chefs() {
  const { language } = useLanguage();
  const { user: loggedInUser } = useAuth();
  const navigate = useNavigate();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedChef, setSelectedChef] = useState<Chef | null>(null);
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
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchTerm(value);
    }, 500),
    []
  );

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
        chefsAPI.getAll({ isRtl }),
        departmentAPI.getAll({ isRtl }),
      ]);
      const fetchedChefs = Array.isArray(chefsResponse.data) ? chefsResponse.data : chefsResponse;
      setChefs(fetchedChefs.map((chef: any) => ({
        id: chef._id,
        user: {
          id: chef.user._id,
          name: chef.user.name,
          nameEn: chef.user.nameEn,
          username: chef.user.username,
          email: chef.user.email,
          phone: chef.user.phone,
          isActive: chef.user.isActive,
          createdAt: chef.user.createdAt,
          updatedAt: chef.user.updatedAt,
        },
        department: chef.department
          ? {
              id: chef.department._id,
              name: chef.department.name,
              nameEn: chef.department.nameEn,
              code: chef.department.code,
              description: chef.department.description,
            }
          : null,
        createdAt: chef.createdAt,
        updatedAt: chef.updatedAt,
      })));
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
      console.error(`[${new Date().toISOString()}] Fetch error:`, err);
      setError(err.message || t.fetchError);
      toast.error(err.message || t.fetchError, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setLoading(false);
    }
  }, [loggedInUser, t, isRtl]);

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
      department: departments[0].id,
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
      department: chef.department?.id || '',
      password: '',
      isActive: chef.user?.isActive ?? true,
    });
    setIsEditMode(true);
    setSelectedChef(chef);
    setIsModalOpen(true);
    setFormErrors({});
    setError('');
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
        const updatedChef = await chefsAPI.update(selectedChef.id, chefData);
        setChefs(
          chefs.map((c) =>
            c.id === selectedChef.id
              ? {
                  ...c,
                  user: {
                    ...c.user!,
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
                }
              : c
          )
        );
        toast.success(t.updated, { position: isRtl ? 'top-right' : 'top-left' });
      } else {
        const newChef = await chefsAPI.create(chefData);
        setChefs([
          ...chefs,
          {
            id: newChef._id,
            user: {
              id: newChef.user._id,
              name: newChef.user.name,
              nameEn: newChef.user.nameEn,
              username: newChef.user.username,
              email: newChef.user.email,
              phone: newChef.user.phone,
              isActive: newChef.user.isActive,
              createdAt: newChef.user.createdAt,
              updatedAt: newChef.user.updatedAt,
            },
            department: newChef.department
              ? {
                  id: newChef.department._id,
                  name: newChef.department.name,
                  nameEn: newChef.department.nameEn,
                  code: newChef.department.code,
                  description: newChef.department.description,
                }
              : null,
            createdAt: newChef.createdAt,
            updatedAt: newChef.updatedAt,
          },
        ]);
        toast.success(t.added, { position: isRtl ? 'top-right' : 'top-left' });
      }
      setIsModalOpen(false);
      setError('');
    } catch (err: any) {
      let errorMessage = isEditMode ? t.updateError : t.createError;
      if (err.message) {
        errorMessage =
          err.message.includes('Username') ? t.usernameExists :
          err.message.includes('email') ? t.emailExists : err.message;
      }
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
      await chefsAPI.resetPassword(selectedChef!.id, resetPasswordData.password);
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
    if (!selectedChef) return;
    try {
      await chefsAPI.delete(selectedChef.id);
      setChefs(chefs.filter((c) => c.id !== selectedChef.id));
      toast.success(t.deleted, { position: isRtl ? 'top-right' : 'top-left' });
      setIsDeleteModalOpen(false);
      setError('');
    } catch (err: any) {
      const errorMessage = err.message || t.deleteError;
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl w-full px-4">
          {[...Array(6)].map((_, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.05 }}
              className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 border-t-4 border-blue-400"
            >
              <div className="space-y-3 animate-pulse opacity-70">
                <div className="flex items-center justify-between gap-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4"></div>
                  <div className="w-6 h-6 bg-gray-200 dark:bg-gray-600 rounded-full"></div>
                </div>
                <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-2/3"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/2"></div>
                <div className="flex justify-end gap-2">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-full"></div>
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-full"></div>
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-full"></div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <div className={`mx-auto px-4 py-8 min-h-screen overflow-y-auto scrollbar-thin scrollbar-thumb-amber-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800`} dir={isRtl ? 'rtl' : 'ltr'}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4 bg-gradient-to-br from-white to-amber-50 dark:from-gray-800 dark:to-gray-900 p-6 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700"
      >
        <div className="flex items-center gap-3">
          <motion.div whileHover={{ scale: 1.1 }} transition={{ duration: 0.2 }}>
            <ChefHat className="w-8 h-8 text-blue-600 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-900/50 p-2 rounded-full" />
          </motion.div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t.manage}</h1>
            <p className="text-gray-600 dark:text-gray-300 text-sm">{isRtl ? 'إضافة، تعديل، أو حذف الشيفات' : 'Add, edit, or delete chefs'}</p>
          </div>
        </div>
        {loggedInUser?.role === 'admin' && (
          <button
            onClick={openAddModal}
            className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
            aria-label={t.add}
          >
            <Plus className="w-5 h-5" />
            {t.add}
          </button>
        )}
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="mb-6 p-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-lg flex items-center gap-2 shadow-md"
          >
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <span className="text-red-600 dark:text-red-400 text-sm">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        <div className="p-5 bg-gradient-to-br from-white to-amber-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700">
          <CustomInput
            value={searchInput}
            onChange={(value) => {
              setSearchInput(value);
              debouncedSearch(value);
            }}
            placeholder={t.searchPlaceholder}
            ariaLabel={t.searchPlaceholder}
            className="w-full"
          />
        </div>
        <div className="text-center text-sm text-gray-600 dark:text-gray-300">
          {isRtl ? `عدد الشيفات: ${filteredChefs.length}` : `Chefs Count: ${filteredChefs.length}`}
        </div>

        {filteredChefs.length === 0 ? (
          <div className="p-8 text-center bg-gradient-to-br from-white to-amber-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700">
            <ChefHat className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-300 text-sm">{searchTerm ? t.noMatch : t.empty}</p>
            {loggedInUser?.role === 'admin' && !searchTerm && (
              <button
                onClick={openAddModal}
                className="mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-md hover:shadow-lg"
                aria-label={t.addFirst}
              >
                {t.addFirst}
              </button>
            )}
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.05 }}
          >
            {filteredChefs.map((chef) => (
              <ChefCard
                key={chef.id}
                chef={chef}
                t={t}
                isRtl={isRtl}
                navigate={navigate}
                openEditModal={openEditModal}
                openResetPasswordModal={openResetPasswordModal}
                openDeleteModal={openDeleteModal}
                loggedInUser={loggedInUser}
              />
            ))}
          </motion.div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="bg-gradient-to-br from-white to-amber-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl max-w-full w-[90vw] sm:max-w-lg p-6 border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{isEditMode ? t.edit : t.add}</h3>
            <form onSubmit={handleSubmit} className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.name}</label>
                  <input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t.namePlaceholder}
                    className={`w-full px-3 py-3 border ${formErrors.name ? 'border-red-300' : 'border-gray-300 dark:border-gray-600'} rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all duration-300 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                  />
                  {formErrors.name && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{formErrors.name}</p>}
                </div>
                <div>
                  <label htmlFor="nameEn" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.nameEn}</label>
                  <input
                    id="nameEn"
                    value={formData.nameEn}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    placeholder={t.nameEnPlaceholder}
                    className={`w-full px-3 py-3 border ${formErrors.nameEn ? 'border-red-300' : 'border-gray-300 dark:border-gray-600'} rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all duration-300 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                  />
                  {formErrors.nameEn && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{formErrors.nameEn}</p>}
                </div>
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.username}</label>
                  <input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder={t.usernamePlaceholder}
                    className={`w-full px-3 py-3 border ${formErrors.username ? 'border-red-300' : 'border-gray-300 dark:border-gray-600'} rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all duration-300 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                  />
                  {formErrors.username && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{formErrors.username}</p>}
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.email}</label>
                  <input
                    id="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder={t.emailPlaceholder}
                    className={`w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all duration-300 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.phone}</label>
                  <input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder={t.phonePlaceholder}
                    className={`w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all duration-300 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                  />
                </div>
                <div>
                  <label htmlFor="department" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.department}</label>
                  <CustomDropdown
                    value={formData.department}
                    onChange={(value) => setFormData({ ...formData, department: value })}
                    options={departments.map((dept) => ({
                      value: dept.id,
                      label: isRtl ? dept.name : dept.nameEn || dept.name,
                    }))}
                    placeholder={t.departmentPlaceholder}
                    ariaLabel={t.department}
                    className={`w-full ${formErrors.department ? 'border-red-300' : ''}`}
                  />
                  {formErrors.department && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{formErrors.department}</p>}
                </div>
                {!isEditMode && (
                  <div className="sm:col-span-2">
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.newPassword}</label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword.password ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder={t.passwordPlaceholder}
                        className={`w-full px-3 py-3 border ${formErrors.password ? 'border-red-300' : 'border-gray-300 dark:border-gray-600'} rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all duration-300 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => ({ ...prev, password: !prev.password }))}
                        className="absolute top-1/2 -translate-y-1/2 right-3 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {showPassword.password ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {formErrors.password && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{formErrors.password}</p>}
                  </div>
                )}
                <div className="sm:col-span-2">
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.status}</label>
                  <CustomDropdown
                    value={formData.isActive}
                    onChange={(value) => setFormData({ ...formData, isActive: value === 'true' })}
                    options={[
                      { value: 'true', label: t.active },
                      { value: 'false', label: t.inactive },
                    ]}
                    ariaLabel={t.status}
                    className="w-full"
                  />
                </div>
              </div>
              {error && (
                <div className="p-2 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span className="text-red-600 dark:text-red-400 text-sm">{error}</span>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors shadow-md hover:shadow-lg"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-md hover:shadow-lg"
                >
                  {isEditMode ? t.update : t.add}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {isResetPasswordModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={(e) => { if (e.target === e.currentTarget) setIsResetPasswordModalOpen(false); }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="bg-gradient-to-br from-white to-amber-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl max-w-full w-[90vw] sm:max-w-sm p-6 border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t.resetPassword}</h3>
            <form onSubmit={handleResetPassword} className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.newPassword}</label>
                <div className="relative">
                  <input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={resetPasswordData.password}
                    onChange={(e) => setResetPasswordData({ ...resetPasswordData, password: e.target.value })}
                    placeholder={t.newPasswordPlaceholder}
                    className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all duration-300 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute top-1/2 -translate-y-1/2 right-3 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.confirmPassword}</label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={resetPasswordData.confirmPassword}
                    onChange={(e) => setResetPasswordData({ ...resetPasswordData, confirmPassword: e.target.value })}
                    placeholder={t.confirmPasswordPlaceholder}
                    className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all duration-300 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute top-1/2 -translate-y-1/2 right-3 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              {error && (
                <div className="p-2 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span className="text-red-600 dark:text-red-400 text-sm">{error}</span>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsResetPasswordModalOpen(false)}
                  className="px-5 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors shadow-md hover:shadow-lg"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-md hover:shadow-lg"
                >
                  {t.reset}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={(e) => { if (e.target === e.currentTarget) setIsDeleteModalOpen(false); }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="bg-gradient-to-br from-white to-amber-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl max-w-full w-[90vw] sm:max-w-sm p-6 border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t.confirmDelete}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{t.deleteWarning}</p>
            {error && (
              <div className="p-2 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-lg flex items-center gap-2 mb-4">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span className="text-red-600 dark:text-red-400 text-sm">{error}</span>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-5 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors shadow-md hover:shadow-lg"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleDelete}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors shadow-md hover:shadow-lg"
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