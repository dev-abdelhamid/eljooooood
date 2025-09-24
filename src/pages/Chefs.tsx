import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { chefsAPI, departmentAPI } from '../services/api';
import { ChefHat, Search, AlertCircle, Plus, Edit2, Trash2, ChevronDown, Key, X , Eye , EyeOff  } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { debounce } from 'lodash';

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

export const CustomInput = ({
  value,
  onChange,
  placeholder,
  ariaLabel,
  type = 'text',
  showPasswordToggle = false,
  showPassword = false,
  togglePasswordVisibility,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  type?: string;
  showPasswordToggle?: boolean;
  showPassword?: boolean;
  togglePasswordVisibility?: () => void;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="relative group">
      {!showPasswordToggle && (
        <motion.div
          initial={{ opacity: value ? 0 : 1 }}
          animate={{ opacity: value ? 0 : 1 }}
          transition={{ duration: 0.15 }}
          className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 transition-colors group-focus-within:text-amber-600`}
        >
          <Search />
        </motion.div>
      )}
      <input
        type={showPasswordToggle ? (showPassword ? 'text' : 'password') : type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full ${isRtl ? 'pl-10 pr-2' : 'pr-10 pl-2'} py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={ariaLabel}
      />
      {showPasswordToggle ? (
        <button
          type="button"
          onClick={togglePasswordVisibility}
          className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-amber-600 transition-colors`}
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      ) : (
        <motion.div
          initial={{ opacity: value ? 1 : 0 }}
          animate={{ opacity: value ? 1 : 0 }}
          transition={{ duration: 0.15 }}
          className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-amber-600 transition-colors`}
        >
          <button
            onClick={() => onChange('')}
            aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </div>
  );
};

export const CustomDropdown = ({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string | boolean;
  onChange: (value: string) => void;
  options: { value: string | boolean; label: string }[];
  ariaLabel: string;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((opt) => opt.value === value) || options[0] || { label: isRtl ? 'اختر' : 'Select' };

  return (
    <div className="relative group">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-gradient-to-r from-white to-gray-50 shadow-sm hover:shadow-md text-xs text-gray-700 ${isRtl ? 'text-right' : 'text-left'} flex justify-between items-center`}
        aria-label={ariaLabel}
      >
        <span className="truncate">{selectedOption.label}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-gray-400 group-focus-within:text-amber-600 transition-colors" />
        </motion.div>
      </motion.button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-300 z-20 max-h-48 overflow-y-auto scrollbar-none"
          >
            {options.map((option) => (
              <motion.div
                key={option.value.toString()}
                onClick={() => {
                  onChange(option.value.toString());
                  setIsOpen(false);
                }}
                className="px-3 py-2 text-xs text-gray-700 hover:bg-amber-50 hover:text-amber-600 cursor-pointer transition-colors duration-200"
                whileHover={{ backgroundColor: '#fef3c7' }}
              >
                {option.label}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

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

  const togglePasswordVisibility = (id: string) => {
    setShowPassword((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-6xl w-full px-4">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="p-4 bg-white rounded-xl shadow-sm">
              <div className="space-y-2 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`mx-auto max-w-6xl px-4 py-6 min-h-screen overflow-y-auto scrollbar-none bg-gray-100 font-sans ${isRtl ? 'rtl font-arabic' : 'ltr'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-3"
      >
        <div className="flex items-center gap-2">
          <ChefHat className="w-6 h-6 text-amber-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t.manage}</h1>
            <p className="text-gray-600 text-xs">{isRtl ? 'إضافة، تعديل، أو حذف الشيفات' : 'Add, edit, or delete chefs'}</p>
          </div>
        </div>
        {loggedInUser?.role === 'admin' && (
          <button
            onClick={openAddModal}
            className="w-full sm:w-auto px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md"
            aria-label={t.add}
          >
            <Plus className="w-3.5 h-3.5" />
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
            className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 shadow-sm"
          >
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-red-600 text-xs">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        <div className="p-4 bg-white rounded-xl shadow-sm">
          <CustomInput
            value={searchInput}
            onChange={(value) => {
              setSearchInput(value);
              debouncedSearch(value);
            }}
            placeholder={t.searchPlaceholder}
            ariaLabel={t.searchPlaceholder}
          />
        </div>
        <div className="text-center text-xs text-gray-600">
          {isRtl ? `عدد الشيفات: ${filteredChefs.length}` : `Chefs Count: ${filteredChefs.length}`}
        </div>

        {filteredChefs.length === 0 ? (
          <div className="p-6 text-center bg-white rounded-xl shadow-sm">
            <ChefHat className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 text-xs">{searchTerm ? t.noMatch : t.empty}</p>
            {loggedInUser?.role === 'admin' && !searchTerm && (
              <button
                onClick={openAddModal}
                className="mt-3 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors shadow-sm hover:shadow-md"
                aria-label={t.addFirst}
              >
                {t.addFirst}
              </button>
            )}
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto scrollbar-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.1 }}
          >
            {filteredChefs.map((chef) => (
              <motion.div
                key={chef.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div
                  className="p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer border border-gray-100"
                  onClick={() => navigate(`/chefs/${chef.id}`)}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold text-gray-900 text-sm truncate">
                        {isRtl ? chef.user?.name : chef.user?.nameEn || chef.user?.name}
                      </h3>
                      <ChefHat className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="w-20 font-medium">{t.username}:</span>
                      <span className="truncate flex-1">{chef.user?.username || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="w-20 font-medium">{t.email}:</span>
                      <span className="truncate flex-1">{chef.user?.email || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="w-20 font-medium">{t.department}:</span>
                      <span className="truncate flex-1">{isRtl ? chef.department?.name : chef.department?.nameEn || chef.department?.name || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-20 font-medium">{t.status}:</span>
                      <span className={`truncate flex-1 ${chef.user?.isActive ? 'text-green-600' : 'text-red-600'}`}>
                        {chef.user?.isActive ? t.active : t.inactive}
                      </span>
                    </div>
                  </div>
                  {loggedInUser?.role === 'admin' && (
                    <div className="mt-3 flex items-center justify-end gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(chef);
                        }}
                        className="p-1.5 w-8 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors flex items-center justify-center shadow-sm hover:shadow-md"
                        title={t.edit}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openResetPasswordModal(chef);
                        }}
                        className="p-1.5 w-8 h-8 bg-amber-500 hover:bg-amber-600 text-white rounded-full transition-colors flex items-center justify-center shadow-sm hover:shadow-md"
                        title={t.resetPassword}
                      >
                        <Key className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteModal(chef);
                        }}
                        className="p-1.5 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors flex items-center justify-center shadow-sm hover:shadow-md"
                        title={t.delete}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-xl shadow-xl max-w-full w-[90vw] sm:max-w-lg p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{isEditMode ? t.edit : t.add}</h3>
            <form onSubmit={handleSubmit} className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-xs font-medium text-gray-700 mb-1">{t.name}</label>
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
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs ${isRtl ? 'text-right' : 'text-left'}`}
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
                {!isEditMode && (
                  <div>
                    <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1">{t.password}</label>
                    <CustomInput
                      value={formData.password}
                      onChange={(value) => setFormData({ ...formData, password: value })}
                      placeholder={t.passwordPlaceholder}
                      ariaLabel={t.password}
                      type="password"
                      showPasswordToggle
                      showPassword={showPassword['new']}
                      togglePasswordVisibility={() => setShowPassword((prev) => ({ ...prev, new: !prev.new }))}
                    />
                    {formErrors.password && <p className="text-xs text-red-600 mt-1">{formErrors.password}</p>}
                  </div>
                )}
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
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs transition-colors shadow-sm hover:shadow-md"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors shadow-sm hover:shadow-md"
                >
                  {isEditMode ? t.update : t.add}
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
                  togglePasswordVisibility={() => setShowPassword((prev) => ({ ...prev, newPassword: !prev.newPassword }))}
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
                  togglePasswordVisibility={() => setShowPassword((prev) => ({ ...prev, confirmPassword: !prev.confirmPassword }))}
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

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-xl shadow-xl max-w-full w-[90vw] sm:max-w-sm p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.confirmDelete}</h3>
            <div className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
              <p className="text-gray-600 text-xs">{t.deleteWarning}</p>
              {error && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span className="text-red-600 text-xs">{error}</span>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs transition-colors shadow-sm hover:shadow-md"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs transition-colors shadow-sm hover:shadow-md"
                >
                  {t.delete}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}