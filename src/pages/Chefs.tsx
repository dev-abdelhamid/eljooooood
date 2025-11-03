import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { chefsAPI, departmentAPI } from '../services/api';
import { ChefHat, AlertCircle, Plus, Edit2, Trash2, Key, Eye, EyeOff, Search, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { debounce } from 'lodash';
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
    createdAt: string;
    updatedAt: string;
  } | null;
  department: Department[];
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
    department: 'الأقسام',
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
    departmentRequired: 'يجب اختيار قسم واحد على الأقل',
    namePlaceholder: 'أدخل اسم الشيف',
    nameEnPlaceholder: 'أدخل اسم الشيف بالإنجليزية',
    usernamePlaceholder: 'أدخل اسم المستخدم',
    emailPlaceholder: 'أدخل الإيميل',
    phonePlaceholder: 'أدخل رقم الهاتف',
    departmentPlaceholder: 'اختر الأقسام',
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
    department: 'Departments',
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
    departmentRequired: 'At least one department is required',
    namePlaceholder: 'Enter chef name',
    nameEnPlaceholder: 'Enter chef name in English',
    usernamePlaceholder: 'Enter username',
    emailPlaceholder: 'Enter email',
    phonePlaceholder: 'Enter phone number',
    departmentPlaceholder: 'Select departments',
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
  },
};

const SearchInput = ({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="relative group">
      <motion.div
        initial={{ opacity: value ? 0 : 1 }}
        animate={{ opacity: value ? 0 : 1 }}
        transition={{ duration: 0.15 }}
        className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 transition-colors group-focus-within:text-amber-500`}
      >
        <Search className="w-4 h-4" />
      </motion.div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full ${isRtl ? 'pl-10 pr-2' : 'pr-10 pl-2'} py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm hover:shadow-md text-xs placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={ariaLabel}
      />
      <motion.div
        initial={{ opacity: value ? 1 : 0 }}
        animate={{ opacity: value ? 1 : 0 }}
        transition={{ duration: 0.15 }}
        className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-gray-400 hover:text-amber-500 transition-colors`}
      >
        <button
          onClick={() => onChange('')}
          aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
          className="flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </div>
  );
};

const FormInput = ({
  value,
  onChange,
  placeholder,
  ariaLabel,
  type = 'text',
  showPasswordToggle = false,
  showPassword = false,
  togglePasswordVisibility,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  type?: string;
  showPasswordToggle?: boolean;
  showPassword?: boolean;
  togglePasswordVisibility?: () => void;
  error?: string;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="relative">
      <input
        type={showPassword ? 'text' : type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 ${showPasswordToggle ? (isRtl ? 'pl-10 pr-3' : 'pr-10 pl-3') : ''} py-2 border ${error ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm hover:shadow-md text-xs placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={ariaLabel}
      />
      {showPasswordToggle && (
        <button
          type="button"
          onClick={togglePasswordVisibility}
          className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-gray-400 hover:text-amber-500 transition-colors`}
          aria-label={showPassword ? (isRtl ? 'إخفاء كلمة المرور' : 'Hide password') : (isRtl ? 'إظهار كلمة المرور' : 'Show password')}
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      )}
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
    departments: [] as string[],
    password: '',
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
        chefsAPI.getAll(),
        departmentAPI.getAll({ isRtl }),
      ]);

      const fetchedChefs = Array.isArray(chefsResponse.data) ? chefsResponse.data : [];
      setChefs(fetchedChefs.map((chef: any) => ({
        id: chef._id,
        user: {
          id: chef.user._id,
          name: chef.user.name,
          nameEn: chef.user.nameEn,
          username: chef.user.username,
          email: chef.user.email,
          phone: chef.user.phone,
          createdAt: chef.user.createdAt,
          updatedAt: chef.user.updatedAt,
        },
        department: chef.department.map((d: any) => ({
          id: d._id,
          name: d.name,
          nameEn: d.nameEn,
          code: d.code,
          description: d.description,
        })),
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
          : []
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
    if (formData.departments.length === 0) errors.departments = t.departmentRequired;
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
      departments: [],
      password: '',
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
      departments: chef.department.map(d => d.id),
      password: '',
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
          ...(isEditMode ? {} : { password: formData.password.trim() }),
        },
        departments: formData.departments,
      };

      if (isEditMode && selectedChef) {
        const updatedChef = await chefsAPI.update(selectedChef.id, chefData);
        setChefs(chefs.map(c => c.id === selectedChef.id ? {
          ...c,
          user: { ...c.user!, ...updatedChef.user },
          department: updatedChef.department,
        } : c));
        toast.success(t.updated, { position: isRtl ? 'top-right' : 'top-left' });
      } else {
        const newChef = await chefsAPI.create(chefData);
        setChefs([...chefs, {
          id: newChef._id,
          user: newChef.user,
          department: newChef.department,
          createdAt: newChef.createdAt,
          updatedAt: newChef.updatedAt,
        }]);
        toast.success(t.added, { position: isRtl ? 'top-right' : 'top-left' });
      }
      setIsModalOpen(false);
      setError('');
    } catch (err: any) {
      const errorMessage = isEditMode ? t.updateError : t.createError;
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
      setError(err.message || t.passwordResetError);
      toast.error(err.message || t.passwordResetError, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  const handleDelete = async () => {
    if (!selectedChef) return;
    try {
      await chefsAPI.delete(selectedChef.id);
      setChefs(chefs.filter(c => c.id !== selectedChef.id));
      toast.success(t.deleted, { position: isRtl ? 'top-right' : 'top-left' });
      setIsDeleteModalOpen(false);
      setError('');
    } catch (err: any) {
      setError(err.message || t.deleteError);
      toast.error(err.message || t.deleteError, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPassword(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="mx-auto px-4 py-6 min-h-screen" dir={isRtl ? 'rtl' : 'ltr'}>
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
          <SearchInput
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

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(6)].map((_, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="p-4 bg-white rounded-xl shadow-sm"
              >
                <div className="space-y-2 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : filteredChefs.length === 0 ? (
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
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            <AnimatePresence>
              {filteredChefs.map((chef) => (
                <motion.div
                  key={chef.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer"
                  onClick={() => navigate(`/chefs/${chef.id}`)}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold text-gray-900 text-sm truncate">
                        {isRtl ? chef.user?.name : chef.user?.nameEn || chef.user?.name}
                      </h3>
                      <p className="text-xs text-gray-500">{chef.user?.username || '-'}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {chef.department.map((dept) => (
                        <span key={dept.id} className="px-2 py-0.5 text-xs bg-amber-100 text-amber-800 rounded-full">
                          {isRtl ? dept.name : dept.nameEn || dept.name}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-600 truncate">{chef.user?.email || '-'}</p>
                  </div>
                  {loggedInUser?.role === 'admin' && (
                    <div className="mt-3 flex items-center justify-end gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(chef);
                        }}
                        className="p-1.5 w-7 h-7 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors flex items-center justify-center"
                        title={t.edit}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openResetPasswordModal(chef);
                        }}
                        className="p-1.5 w-7 h-7 bg-amber-500 hover:bg-amber-600 text-white rounded-full transition-colors flex items-center justify-center"
                        title={t.resetPassword}
                      >
                        <Key className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteModal(chef);
                        }}
                        className="p-1.5 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors flex items-center justify-center"
                        title={t.delete}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Modal Add/Edit */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{isEditMode ? t.edit : t.add}</h3>
              <form onSubmit={handleSubmit} className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t.name}</label>
                    <FormInput value={formData.name} onChange={(v) => setFormData({ ...formData, name: v })} placeholder={t.namePlaceholder} ariaLabel={t.name} error={formErrors.name} />
                    {formErrors.name && <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t.nameEn}</label>
                    <FormInput value={formData.nameEn} onChange={(v) => setFormData({ ...formData, nameEn: v })} placeholder={t.nameEnPlaceholder} ariaLabel={t.nameEn} error={formErrors.nameEn} />
                    {formErrors.nameEn && <p className="text-xs text-red-600 mt-1">{formErrors.nameEn}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t.username}</label>
                    <FormInput value={formData.username} onChange={(v) => setFormData({ ...formData, username: v })} placeholder={t.usernamePlaceholder} ariaLabel={t.username} error={formErrors.username} />
                    {formErrors.username && <p className="text-xs text-red-600 mt-1">{formErrors.username}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t.email}</label>
                    <FormInput value={formData.email} onChange={(v) => setFormData({ ...formData, email: v })} placeholder={t.emailPlaceholder} ariaLabel={t.email} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t.phone}</label>
                    <FormInput value={formData.phone} onChange={(v) => setFormData({ ...formData, phone: v })} placeholder={t.phonePlaceholder} ariaLabel={t.phone} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t.department}</label>
                    <select
                      multiple
                      value={formData.departments}
                      onChange={(e) => setFormData({ ...formData, departments: Array.from(e.target.selectedOptions, o => o.value) })}
                      className={`w-full h-32 p-2 border rounded-lg text-xs ${formErrors.departments ? 'border-red-300' : 'border-gray-300'}`}
                    >
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>
                          {isRtl ? dept.name : dept.nameEn || dept.name}
                        </option>
                      ))}
                    </select>
                    {formErrors.departments && <p className="text-xs text-red-600 mt-1">{formErrors.departments}</p>}
                  </div>
                  {!isEditMode && (
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">{t.password}</label>
                      <FormInput
                        value={formData.password}
                        onChange={(v) => setFormData({ ...formData, password: v })}
                        placeholder={t.passwordPlaceholder}
                        ariaLabel={t.password}
                        type="password"
                        showPasswordToggle
                        showPassword={showPassword['new']}
                        togglePasswordVisibility={() => togglePasswordVisibility('new')}
                        error={formErrors.password}
                      />
                      {formErrors.password && <p className="text-xs text-red-600 mt-1">{formErrors.password}</p>}
                    </div>
                  )}
                </div>
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="text-red-600 text-xs">{error}</span>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs transition-colors">
                    {t.cancel}
                  </button>
                  <button type="submit" className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors">
                    {isEditMode ? t.update : t.add}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset Password Modal */}
      <AnimatePresence>
        {isResetPasswordModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && setIsResetPasswordModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.resetPassword}</h3>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <FormInput
                  value={resetPasswordData.password}
                  onChange={(v) => setResetPasswordData({ ...resetPasswordData, password: v })}
                  placeholder={t.newPasswordPlaceholder}
                  ariaLabel={t.newPassword}
                  type="password"
                  showPasswordToggle
                  showPassword={showPassword['newPassword']}
                  togglePasswordVisibility={() => togglePasswordVisibility('newPassword')}
                />
                <FormInput
                  value={resetPasswordData.confirmPassword}
                  onChange={(v) => setResetPasswordData({ ...resetPasswordData, confirmPassword: v })}
                  placeholder={t.confirmPasswordPlaceholder}
                  ariaLabel={t.confirmPassword}
                  type="password"
                  showPasswordToggle
                  showPassword={showPassword['confirmPassword']}
                  togglePasswordVisibility={() => togglePasswordVisibility('confirmPassword')}
                />
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="text-red-600 text-xs">{error}</span>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setIsResetPasswordModalOpen(false)} className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs transition-colors">
                    {t.cancel}
                  </button>
                  <button type="submit" className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors">
                    {t.reset}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && setIsDeleteModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{t.confirmDelete}</h3>
              <p className="text-xs text-gray-600 mb-4">{t.deleteWarning}</p>
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 mb-4">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span className="text-red-600 text-xs">{error}</span>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsDeleteModalOpen(false)} className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs transition-colors">
                  {t.cancel}
                </button>
                <button onClick={handleDelete} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs transition-colors">
                  {t.delete}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}