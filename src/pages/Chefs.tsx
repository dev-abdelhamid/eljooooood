import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { chefsAPI, departmentAPI } from '../services/api';
import { ChefHat, AlertCircle, Plus, Edit2, Trash2, Key, Eye, EyeOff, Search, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { debounce } from 'lodash';

interface Department {
  id: string;
  name: string;
  nameEn?: string;
  code: string;
  description?: string;
  chef?: string;
  chefs?: string[];
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
  departments: Department[];
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
    departments: 'الأقسام',
    createdAt: 'تاريخ الإنشاء',
    updatedAt: 'تاريخ التحديث',
    edit: 'تعديل',
    resetPassword: 'تغيير كلمة المرور',
    delete: 'حذف',
    name: 'اسم الشيف (عربي)',
    nameEn: 'اسم الشيف (إنجليزي)',
    nameRequired: 'اسم الشيف مطلوب',
    nameEnRequired: 'اسم الش[يف بالإنجليزية مطلوب',
    usernameRequired: 'اسم المستخدم مطلوب',
    passwordRequired: 'كلمة المرور مطلوبة',
    departmentsRequired: 'يجب اختيار قسم واحد على الأقل',
    namePlaceholder: 'أدخل اسم الشيف',
    nameEnPlaceholder: 'أدخل اسم الشيف بالإنجليزية',
    usernamePlaceholder: 'أدخل اسم المستخدم',
    emailPlaceholder: 'أدخل الإيميل',
    phonePlaceholder: 'أدخل رقم الهاتف',
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
    reserved: 'محجوز',
    selectOneOrMore: 'اختر قسم واحد أو أكثر',
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
    departments: 'Departments',
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
    departmentsRequired: 'At least one department is required',
    namePlaceholder: 'Enter chef name',
    nameEnPlaceholder: 'Enter chef name in English',
    usernamePlaceholder: 'Enter username',
    emailPlaceholder: 'Enter email',
    phonePlaceholder: 'Enter phone number',
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
    reserved: 'Reserved',
    selectOneOrMore: 'Select one or more departments',
  },
};

const SearchInput = React.memo(({
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
        initial={false}
        animate={{ opacity: value ? 0 : 1 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className={`pointer-events-none absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4`}
      >
        <Search className="w-4 h-4" />
      </motion.div>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full ${isRtl ? 'pl-10 pr-3' : 'pr-10 pl-3'} py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={ariaLabel}
      />

      <AnimatePresence>
        {value && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            onClick={() => onChange('')}
            className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-gray-400 hover:text-amber-500 transition-colors`}
            aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
          >
            <X className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
});

const FormInput = React.memo(({
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
        className={`w-full px-3 py-2 text-sm border ${error ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'} ${showPasswordToggle ? (isRtl ? 'pr-10' : 'pl-10') : ''}`}
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
});

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

  const debouncedSearch = useMemo(
    () => debounce((value: string) => setSearchTerm(value), 500),
    []
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

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
          createdAt: chef.user.createdAt,
          updatedAt: chef.user.updatedAt,
        },
        departments: Array.isArray(chef.departments)
          ? chef.departments.map((d: any) => ({
              id: d._id,
              name: d.name,
              nameEn: d.nameEn,
              code: d.code,
              description: d.description,
              chef: d.chef,
              chefs: d.chefs,
            }))
          : (chef.department ? [{
              id: chef.department._id,
              name: chef.department.name,
              nameEn: chef.department.nameEn,
              code: chef.department.code,
              description: chef.department.description,
              chef: chef.department.chef,
              chefs: chef.department.chefs,
            }] : []),
        createdAt: chef.createdAt,
        updatedAt: chef.updatedAt,
      })));

      const fetchedDepts = Array.isArray(departmentsResponse.data) ? departmentsResponse.data : [];
      setDepartments(fetchedDepts.map((dept: any) => ({
        id: dept._id,
        name: dept.name,
        nameEn: dept.nameEn,
        code: dept.code,
        description: dept.description,
        chef: dept.chef,
        chefs: dept.chefs,
      })));

      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Fetch error:`, err);
      const msg = err.message || t.fetchError;
      setError(msg);
      toast.error(msg, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setLoading(false);
    }
  }, [loggedInUser, t, isRtl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredChefs = useMemo(() => {
    return chefs.filter(chef =>
      chef.user &&
      (
        (isRtl ? chef.user.name : chef.user.nameEn || chef.user.name)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chef.user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chef.user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chef.departments.some(d => (isRtl ? d.name : d.nameEn || d.name)?.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    );
  }, [chefs, searchTerm, isRtl]);

  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!formData.name) errors.name = t.nameRequired;
    if (!formData.nameEn) errors.nameEn = t.nameEnRequired;
    if (!formData.username) errors.username = t.usernameRequired;
    if (!isEditMode && !formData.password) errors.password = t.passwordRequired;
    if (formData.departments.length === 0) errors.departments = t.departmentsRequired;
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, isEditMode, t]);

  const openAddModal = () => {
    if (departments.length === 0) {
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
      departments: chef.departments.map(d => d.id),
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
        setChefs(prev => prev.map(c => c.id === selectedChef.id ? {
          ...c,
          user: { ...c.user!, ...updatedChef.user },
          departments: updatedChef.departments || [],
        } : c));
        toast.success(t.updated, { position: isRtl ? 'top-right' : 'top-left' });
      } else {
        const newChef = await chefsAPI.create(chefData);
        setChefs(prev => [...prev, {
          id: newChef._id,
          user: { ...newChef.user, id: newChef.user._id },
          departments: newChef.departments || [],
          createdAt: newChef.createdAt,
          updatedAt: newChef.updatedAt,
        }]);
        toast.success(t.added, { position: isRtl ? 'top-right' : 'top-left' });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      const msg = err.message?.includes('Username') ? t.usernameExists :
                 err.message?.includes('email') ? t.emailExists :
                 (isEditMode ? t.updateError : t.createError);
      setError(msg);
      toast.error(msg, { position: isRtl ? 'top-right' : 'top-left' });
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
      const msg = err.message || t.passwordResetError;
      setError(msg);
      toast.error(msg, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  const handleDelete = async () => {
    if (!selectedChef) return;
    try {
      await chefsAPI.delete(selectedChef.id);
      setChefs(prev => prev.filter(c => c.id !== selectedChef.id));
      toast.success(t.deleted, { position: isRtl ? 'top-right' : 'top-left' });
      setIsDeleteModalOpen(false);
    } catch (err: any) {
      const msg = err.message || t.deleteError;
      setError(msg);
      toast.error(msg, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPassword(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="mx-auto px-4 py-6 min-h-screen" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6"
      >
        <div className="flex items-center gap-2">
          <ChefHat className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.manage}</h1>
            <p className="text-sm text-gray-600">{isRtl ? 'إدارة الشيفات والأقسام' : 'Manage chefs and departments'}</p>
          </div>
        </div>
        {loggedInUser?.role === 'admin' && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors shadow-md"
          >
            <Plus className="w-4 h-4" />
            {t.add}
          </motion.button>
        )}
      </motion.div>

      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2"
          >
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <span className="text-sm text-red-700">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search & Count */}
      <div className="space-y-4">
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

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-sm text-gray-600"
        >
          {isRtl ? `عدد الشيفات: ${filteredChefs.length}` : `Chefs Count: ${filteredChefs.length}`}
        </motion.p>

        {/* Loading Skeleton */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className="p-5 bg-white rounded-xl shadow-sm"
              >
                <div className="space-y-3 animate-pulse">
                  <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : filteredChefs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center p-8 bg-white rounded-xl shadow-sm"
          >
            <ChefHat className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">{searchTerm ? t.noMatch : t.empty}</p>
            {loggedInUser?.role === 'admin' && !searchTerm && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={openAddModal}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors shadow-md"
              >
                {t.addFirst}
              </motion.button>
            )}
          </motion.div>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <AnimatePresence>
              {filteredChefs.map((chef) => (
                <motion.div
                  key={chef.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                  whileHover={{ y: -4 }}
                  className="p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between"
                  onClick={() => navigate(`/chefs/${chef.id}`)}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-gray-900 text-base truncate">
                        {isRtl ? chef.user?.name : chef.user?.nameEn || chef.user?.name}
                      </h3>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        {chef.user?.username}
                      </span>
                    </div>
                    <p className="text-sm text-amber-600 font-medium">
                      {chef.departments.length > 0
                        ? chef.departments.map(d => isRtl ? d.name : d.nameEn || d.name).join(' • ')
                        : '—'}
                    </p>
                    <p className="text-xs text-gray-600 truncate">{chef.user?.email || '—'}</p>
                  </div>

                  {loggedInUser?.role === 'admin' && (
                    <div className="flex justify-end gap-2 mt-4">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => { e.stopPropagation(); openEditModal(chef); }}
                        className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors"
                        title={t.edit}
                      >
                        <Edit2 className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => { e.stopPropagation(); openResetPasswordModal(chef); }}
                        className="p-2 bg-amber-500 hover:bg-amber-600 text-white rounded-full transition-colors"
                        title={t.resetPassword}
                      >
                        <Key className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => { e.stopPropagation(); openDeleteModal(chef); }}
                        className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                        title={t.delete}
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-gray-900 mb-5">
                {isEditMode ? t.edit : t.add}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.name}</label>
                    <FormInput value={formData.name} onChange={v => setFormData(prev => ({ ...prev, name: v }))} placeholder={t.namePlaceholder} ariaLabel={t.name} error={formErrors.name} />
                    {formErrors.name && <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.nameEn}</label>
                    <FormInput value={formData.nameEn} onChange={v => setFormData(prev => ({ ...prev, nameEn: v }))} placeholder={t.nameEnPlaceholder} ariaLabel={t.nameEn} error={formErrors.nameEn} />
                    {formErrors.nameEn && <p className="text-xs text-red-600 mt-1">{formErrors.nameEn}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.username}</label>
                    <FormInput value={formData.username} onChange={v => setFormData(prev => ({ ...prev, username: v }))} placeholder={t.usernamePlaceholder} ariaLabel={t.username} error={formErrors.username} />
                    {formErrors.username && <p className="text-xs text-red-600 mt-1">{formErrors.username}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.email}</label>
                    <FormInput value={formData.email} onChange={v => setFormData(prev => ({ ...prev, email: v }))} placeholder={t.emailPlaceholder} ariaLabel={t.email} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.phone}</label>
                    <FormInput value={formData.phone} onChange={v => setFormData(prev => ({ ...prev, phone: v }))} placeholder={t.phonePlaceholder} ariaLabel={t.phone} />
                  </div>
                  {!isEditMode && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.password}</label>
                      <FormInput
                        value={formData.password}
                        onChange={v => setFormData(prev => ({ ...prev, password: v }))}
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t.departments} <span className="text-xs text-gray-500">({t.selectOneOrMore})</span>
                  </label>
                  <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2 bg-gray-50">
                    {departments.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">{t.noDepartments}</p>
                    ) : (
                      departments.map(dept => {
                        const isAssigned = dept.chef || (dept.chefs && dept.chefs.length > 0);
                        const isCurrentChef = selectedChef && (
                          dept.chefs?.includes(selectedChef.user!.id) ||
                          dept.chef === selectedChef.user!.id
                        );
                        const disabled = isAssigned && !isCurrentChef;

                        return (
                          <label
                            key={dept.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                              disabled
                                ? 'bg-red-50 border-red-200 text-red-600 cursor-not-allowed'
                                : 'bg-white border-gray-300 cursor-pointer hover:border-amber-500'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={formData.departments.includes(dept.id)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setFormData(prev => ({
                                  ...prev,
                                  departments: checked
                                    ? [...prev.departments, dept.id]
                                    : prev.departments.filter(id => id !== dept.id)
                                }));
                              }}
                              disabled={disabled}
                              className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                            />
                            <span className="text-sm font-medium">
                              {isRtl ? dept.name : dept.nameEn || dept.name}
                              {disabled && ` (${t.reserved})`}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                  {formErrors.departments && <p className="text-xs text-red-600 mt-1">{formErrors.departments}</p>}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors"
                  >
                    {t.cancel}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors shadow-md"
                  >
                    {isEditMode ? t.update : t.add}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset Password Modal */}
      <AnimatePresence>
        {isResetPasswordModalOpen && selectedChef && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={(e) => e.target === e.currentTarget && setIsResetPasswordModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-gray-900 mb-5">{t.resetPassword}</h3>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.newPassword}</label>
                  <FormInput
                    value={resetPasswordData.password}
                    onChange={v => setResetPasswordData(prev => ({ ...prev, password: v }))}
                    placeholder={t.newPasswordPlaceholder}
                    type="password"
                    showPasswordToggle
                    showPassword={showPassword['newPassword']}
                    togglePasswordVisibility={() => togglePasswordVisibility('newPassword')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.confirmPassword}</label>
                  <FormInput
                    value={resetPasswordData.confirmPassword}
                    onChange={v => setResetPasswordData(prev => ({ ...prev, confirmPassword: v }))}
                    placeholder={t.confirmPasswordPlaceholder}
                    type="password"
                    showPasswordToggle
                    showPassword={showPassword['confirmPassword']}
                    togglePasswordVisibility={() => togglePasswordVisibility('confirmPassword')}
                  />
                </div>
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-sm text-red-700">{error}</span>
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-3">
                  <button type="button" onClick={() => setIsResetPasswordModalOpen(false)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors">
                    {t.cancel}
                  </button>
                  <button type="submit" className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors shadow-md">
                    {t.reset}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && selectedChef && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={(e) => e.target === e.currentTarget && setIsDeleteModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <Trash2 className="w-12 h-12 text-red-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">{t.confirmDelete}</h3>
              <p className="text-sm text-gray-600 mb-6">{t.deleteWarning}</p>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <span className="text-sm text-red-700">{error}</span>
                </div>
              )}
              <div className="flex justify-center gap-3">
                <button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors">
                  {t.cancel}
                </button>
                <button onClick={handleDelete} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors shadow-md">
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