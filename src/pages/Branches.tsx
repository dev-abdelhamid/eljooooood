import React, { useState, useEffect, useCallback, useMemo, useReducer, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { branchesAPI } from '../services/api';
import { MapPin, Plus, Edit2, Trash2, Key, AlertCircle, Search, X, ChevronDown } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { debounce } from 'lodash';

interface Branch {
  _id: string;
  name: string;
  nameEn?: string;
  code: string;
  address: string;
  addressEn?: string;
  city: string;
  cityEn?: string;
  phone?: string;
  isActive: boolean;
  user?: {
    _id: string;
    name: string;
    nameEn?: string;
    username: string;
    email?: string;
    phone?: string;
    isActive: boolean;
  };
  createdBy?: {
    _id: string;
    name: string;
    nameEn?: string;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
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
  isActive: boolean;
  user: {
    name: string;
    nameEn: string;
    username: string;
    email: string;
    phone: string;
    password: string;
    isActive: boolean;
  };
}

type FormAction =
  | { type: 'UPDATE_FIELD'; field: keyof FormState; value: any }
  | { type: 'UPDATE_USER_FIELD'; field: keyof FormState['user']; value: any }
  | { type: 'RESET' };

const formReducer = (state: FormState, action: FormAction): FormState => {
  switch (action.type) {
    case 'UPDATE_FIELD':
      return { ...state, [action.field]: action.value };
    case 'UPDATE_USER_FIELD':
      return { ...state, user: { ...state.user, [action.field]: action.value } };
    case 'RESET':
      return {
        name: '',
        nameEn: '',
        code: '',
        address: '',
        addressEn: '',
        city: '',
        cityEn: '',
        phone: '',
        isActive: true,
        user: { name: '', nameEn: '', username: '', email: '', phone: '', password: '', isActive: true },
      };
    default:
      return state;
  }
};

const translations = {
  ar: {
    manage: 'إدارة الفروع',
    addProducts: 'إدارة الفروع وإضافتها أو تعديلها',
    add: 'إضافة فرع',
    addFirst: 'إضافة أول فرع',
    noBranches: 'لا توجد فروع',
    noMatch: 'لا توجد فروع مطابقة',
    empty: 'لا توجد فروع متاحة',
    searchPlaceholder: 'ابحث عن فرع بالاسم أو الكود...',
    code: 'الكود',
    address: 'العنوان',
    addressEn: 'العنوان (إنجليزي)',
    city: 'المدينة',
    cityEn: 'المدينة (إنجليزي)',
    phone: 'الهاتف',
    status: 'الحالة',
    active: 'نشط',
    inactive: 'غير نشط',
    edit: 'تعديل',
    resetPassword: 'إعادة تعيين كلمة المرور',
    delete: 'حذف',
    name: 'اسم الفرع (عربي)',
    nameEn: 'اسم الفرع (إنجليزي)',
    nameRequired: 'اسم الفرع مطلوب',
    nameEnRequired: 'اسم الفرع بالإنجليزية مطلوب',
    codeRequired: 'كود الفرع مطلوب',
    addressRequired: 'العنوان مطلوب',
    addressEnRequired: 'العنوان بالإنجليزية مطلوب',
    cityRequired: 'المدينة مطلوبة',
    cityEnRequired: 'المدينة بالإنجليزية مطلوبة',
    userName: 'اسم المستخدم (عربي)',
    userNameEn: 'اسم المستخدم (إنجليزي)',
    userNameRequired: 'اسم المستخدم مطلوب',
    userNameEnRequired: 'اسم المستخدم بالإنجليزية مطلوب',
    username: 'اسم المستخدم',
    usernameRequired: 'اسم المستخدم للفرع مطلوب',
    passwordRequired: 'كلمة المرور مطلوبة',
    namePlaceholder: 'أدخل اسم الفرع',
    nameEnPlaceholder: 'أدخل اسم الفرع بالإنجليزية',
    codePlaceholder: 'أدخل كود الفرع',
    addressPlaceholder: 'أدخل العنوان',
    addressEnPlaceholder: 'أدخل العنوان بالإنجليزية',
    cityPlaceholder: 'أدخل المدينة',
    cityEnPlaceholder: 'أدخل المدينة بالإنجليزية',
    phonePlaceholder: 'أدخل رقم الهاتف',
    userNamePlaceholder: 'أدخل اسم المستخدم',
    userNameEnPlaceholder: 'أدخل اسم المستخدم بالإنجليزية',
    usernamePlaceholder: 'أدخل اسم المستخدم للفرع',
    emailPlaceholder: 'أدخل الإيميل',
    userPhonePlaceholder: 'أدخل رقم هاتف المستخدم',
    passwordPlaceholder: 'أدخل كلمة المرور',
    update: 'تحديث الفرع',
    requiredFields: 'يرجى ملء جميع الحقول المطلوبة',
    emailExists: 'الإيميل مستخدم بالفعل',
    codeExists: 'الكود مستخدم بالفعل',
    usernameExists: 'اسم المستخدم مستخدم بالفعل',
    unauthorized: 'غير مصرح لك بالوصول',
    fetchError: 'خطأ أثناء جلب البيانات',
    updateError: 'خطأ أثناء تحديث الفرع',
    createError: 'خطأ أثناء إنشاء الفرع',
    added: 'تم إضافة الفرع بنجاح',
    updated: 'تم تحديث الفرع بنجاح',
    newPassword: 'كلمة المرور الجديدة',
    confirmPassword: 'تأكيد كلمة المرور',
    newPasswordPlaceholder: 'أدخل كلمة المرور الجديدة',
    confirmPasswordPlaceholder: 'تأكيد كلمة المرور',
    passwordMismatch: 'كلمة المرور وتأكيدها غير متطابقتين',
    passwordTooShort: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
    passwordResetSuccess: 'تم إعادة تعيين كلمة المرور بنجاح',
    passwordResetError: 'خطأ أثناء إعادة تعيين كلمة المرور',
    reset: 'إعادة تعيين',
    cancel: 'إلغاء',
    confirmDelete: 'تأكيد الحذف',
    deleteWarning: 'هل أنت متأكد من حذف هذا الفرع؟',
    deleteRestricted: 'لا يمكن حذف الفرع لوجود طلبات أو مخزون مرتبط',
    deleteError: 'خطأ أثناء حذف الفرع',
    deleted: 'تم حذف الفرع بنجاح',
    scrollToForm: 'الذهاب إلى نموذج الإضافة',
  },
  en: {
    manage: 'Manage Branches',
    addProducts: 'Manage, add, or edit branches',
    add: 'Add Branch',
    addFirst: 'Add First Branch',
    noBranches: 'No Branches Found',
    noMatch: 'No Matching Branches',
    empty: 'No Branches Available',
    searchPlaceholder: 'Search by branch name or code...',
    code: 'Code',
    address: 'Address',
    addressEn: 'Address (English)',
    city: 'City',
    cityEn: 'City (English)',
    phone: 'Phone',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    edit: 'Edit',
    resetPassword: 'Reset Password',
    delete: 'Delete',
    name: 'Branch Name (Arabic)',
    nameEn: 'Branch Name (English)',
    nameRequired: 'Branch name is required',
    nameEnRequired: 'Branch name in English is required',
    codeRequired: 'Branch code is required',
    addressRequired: 'Address is required',
    addressEnRequired: 'Address in English is required',
    cityRequired: 'City is required',
    cityEnRequired: 'City in English is required',
    userName: 'User Name (Arabic)',
    userNameEn: 'User Name (English)',
    userNameRequired: 'User name is required',
    userNameEnRequired: 'User name in English is required',
    username: 'Username',
    usernameRequired: 'Branch username is required',
    passwordRequired: 'Password is required',
    namePlaceholder: 'Enter branch name',
    nameEnPlaceholder: 'Enter branch name in English',
    codePlaceholder: 'Enter branch code',
    addressPlaceholder: 'Enter address',
    addressEnPlaceholder: 'Enter address in English',
    cityPlaceholder: 'Enter city',
    cityEnPlaceholder: 'Enter city in English',
    phonePlaceholder: 'Enter phone number',
    userNamePlaceholder: 'Enter user name',
    userNameEnPlaceholder: 'Enter user name in English',
    usernamePlaceholder: 'Enter branch username',
    emailPlaceholder: 'Enter email',
    userPhonePlaceholder: 'Enter user phone number',
    passwordPlaceholder: 'Enter password',
    update: 'Update Branch',
    requiredFields: 'Please fill all required fields',
    emailExists: 'Email is already in use',
    codeExists: 'Code is already in use',
    usernameExists: 'Username is already in use',
    unauthorized: 'You are not authorized to access',
    fetchError: 'Error fetching data',
    updateError: 'Error updating branch',
    createError: 'Error creating branch',
    added: 'Branch added successfully',
    updated: 'Branch updated successfully',
    newPassword: 'New Password',
    confirmPassword: 'Confirm Password',
    newPasswordPlaceholder: 'Enter new password',
    confirmPasswordPlaceholder: 'Confirm password',
    passwordMismatch: 'Passwords do not match',
    passwordTooShort: 'Password must be at least 6 characters',
    passwordResetSuccess: 'Password reset successfully',
    passwordResetError: 'Error resetting password',
    reset: 'Reset',
    cancel: 'Cancel',
    confirmDelete: 'Confirm Deletion',
    deleteWarning: 'Are you sure you want to delete this branch?',
    deleteRestricted: 'Cannot delete branch with associated orders or inventory',
    deleteError: 'Error deleting branch',
    deleted: 'Branch deleted successfully',
    scrollToForm: 'Go to Add Form',
  },
};

const CustomInput = ({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
        className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors group-focus-within:text-amber-500`}
      >
        <Search />
      </motion.div>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full ${isRtl ? 'pl-11 pr-4' : 'pr-11 pl-4'} py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-md text-sm placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={ariaLabel}
      />
      <motion.div
        initial={{ opacity: value ? 1 : 0 }}
        animate={{ opacity: value ? 1 : 0 }}
        transition={{ duration: 0.15 }}
        className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-amber-500 transition-colors`}
      >
        <button
          onClick={() => onChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>)}
          aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
        >
          <X className="w-5 h-5" />
        </button>
      </motion.div>
    </div>
  );
};

const CustomDropdown = ({
  value,
  onChange,
  options,
  ariaLabel,
  disabled = false,
}: {
  value: string | boolean;
  onChange: (value: string) => void;
  options: { value: string | boolean; label: string }[];
  ariaLabel: string;
  disabled?: boolean;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((opt) => opt.value === value) || options[0] || { label: isRtl ? 'اختر' : 'Select' };
  return (
    <div className="relative group">
      <motion.button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 bg-gradient-to-r from-white to-gray-50 shadow-md text-sm text-gray-700 ${isRtl ? 'text-right' : 'text-left'} flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={ariaLabel}
      >
        <span className="truncate">{selectedOption.label}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-5 h-5 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
        </motion.div>
      </motion.button>
      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute w-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 z-20 max-h-60 overflow-y-auto scrollbar-thin"
          >
            {options.map((option) => (
              <motion.div
                key={String(option.value)}
                onClick={() => {
                  onChange(String(option.value));
                  setIsOpen(false);
                }}
                className="px-4 py-2.5 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-600 cursor-pointer transition-colors duration-200"
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

const CustomTextarea = ({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  ariaLabel: string;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="relative group">
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 bg-white shadow-md text-sm placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}
        rows={4}
        aria-label={ariaLabel}
      />
    </div>
  );
};

export const Branches: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const formRef = useRef<HTMLDivElement>(null);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [resetPasswordData, setResetPasswordData] = useState({ password: '', confirmPassword: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [formData, dispatchForm] = useReducer(formReducer, {
    name: '',
    nameEn: '',
    code: '',
    address: '',
    addressEn: '',
    city: '',
    cityEn: '',
    phone: '',
    isActive: true,
    user: { name: '', nameEn: '', username: '', email: '', phone: '', password: '', isActive: true },
  });

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchTerm(value.trim());
    }, 500),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    if (value.length >= 2 || value === '') {
      debouncedSearch(value);
    }
  };

  const fetchData = useCallback(async () => {
    if (!user || user.role !== 'admin') {
      setError(t.unauthorized);
      setLoading(false);
      toast.error(t.unauthorized, { position: isRtl ? 'top-right' : 'top-left' });
      navigate('/dashboard');
      return;
    }
    setLoading(true);
    try {
      const response = await branchesAPI.getAll({ page, limit: 12 });
      const data = Array.isArray(response.data) ? response.data : response;
      setBranches(data);
      setTotalPages(response.totalPages || Math.ceil(data.length / 12));
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Fetch error:`, err);
      setError(err.message || t.fetchError);
      toast.error(t.fetchError, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setLoading(false);
    }
  }, [user, page, t, isRtl, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredBranches = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return branches
      .filter((branch) => {
        const name = (isRtl ? branch.name : branch.nameEn || branch.name).toLowerCase();
        const code = branch.code.toLowerCase();
        return name.startsWith(lowerSearchTerm) || code.startsWith(lowerSearchTerm) || name.includes(lowerSearchTerm);
      })
      .sort((a, b) => {
        const aName = (isRtl ? a.name : a.nameEn || a.name).toLowerCase();
        const bName = (isRtl ? b.name : b.nameEn || b.name).toLowerCase();
        const aCode = a.code.toLowerCase();
        const bCode = b.code.toLowerCase();
        if (aName.startsWith(lowerSearchTerm) && !bName.startsWith(lowerSearchTerm)) return -1;
        if (!aName.startsWith(lowerSearchTerm) && bName.startsWith(lowerSearchTerm)) return 1;
        if (aCode.startsWith(lowerSearchTerm) && !bCode.startsWith(lowerSearchTerm)) return -1;
        if (!aCode.startsWith(lowerSearchTerm) && bCode.startsWith(lowerSearchTerm)) return 1;
        return aName.localeCompare(bName);
      });
  }, [branches, searchTerm, isRtl]);

  const checkEmailAvailability = useCallback(async (email: string) => {
    try {
      const response = await branchesAPI.checkEmail(email);
      return response.available;
    } catch {
      return false;
    }
  }, []);

  const validateForm = useCallback(async () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = t.nameRequired;
    if (!formData.nameEn.trim()) errors.nameEn = t.nameEnRequired;
    if (!formData.code.trim()) errors.code = t.codeRequired;
    if (!formData.address.trim()) errors.address = t.addressRequired;
    if (!formData.addressEn.trim()) errors.addressEn = t.addressEnRequired;
    if (!formData.city.trim()) errors.city = t.cityRequired;
    if (!formData.cityEn.trim()) errors.cityEn = t.cityEnRequired;
    if (!showEditModal) {
      if (!formData.user.name.trim()) errors.userName = t.userNameRequired;
      if (!formData.user.nameEn.trim()) errors.userNameEn = t.userNameEnRequired;
      if (!formData.user.username.trim()) errors.username = t.usernameRequired;
      if (!formData.user.password.trim()) errors.password = t.passwordRequired;
      if (formData.user.email.trim()) {
        const isEmailAvailable = await checkEmailAvailability(formData.user.email);
        if (!isEmailAvailable && (!selectedBranch || formData.user.email !== selectedBranch.user?.email)) {
          errors.email = t.emailExists;
        }
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, showEditModal, t, checkEmailAvailability, selectedBranch]);

  const openAddModal = useCallback(() => {
    dispatchForm({ type: 'RESET' });
    setShowAddModal(true);
    setShowEditModal(false);
    setSelectedBranch(null);
    setFormErrors({});
    setError('');
    scrollToForm();
  }, []);

  const openEditModal = useCallback((branch: Branch, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatchForm({ type: 'RESET' });
    dispatchForm({ type: 'UPDATE_FIELD', field: 'name', value: branch.name });
    dispatchForm({ type: 'UPDATE_FIELD', field: 'nameEn', value: branch.nameEn || '' });
    dispatchForm({ type: 'UPDATE_FIELD', field: 'code', value: branch.code });
    dispatchForm({ type: 'UPDATE_FIELD', field: 'address', value: branch.address });
    dispatchForm({ type: 'UPDATE_FIELD', field: 'addressEn', value: branch.addressEn || '' });
    dispatchForm({ type: 'UPDATE_FIELD', field: 'city', value: branch.city });
    dispatchForm({ type: 'UPDATE_FIELD', field: 'cityEn', value: branch.cityEn || '' });
    dispatchForm({ type: 'UPDATE_FIELD', field: 'phone', value: branch.phone || '' });
    dispatchForm({ type: 'UPDATE_FIELD', field: 'isActive', value: branch.isActive });
    dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'name', value: branch.user?.name || '' });
    dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'nameEn', value: branch.user?.nameEn || '' });
    dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'username', value: branch.user?.username || '' });
    dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'email', value: branch.user?.email || '' });
    dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'phone', value: branch.user?.phone || '' });
    dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'isActive', value: branch.user?.isActive ?? true });
    setShowEditModal(true);
    setShowAddModal(false);
    setSelectedBranch(branch);
    setFormErrors({});
    setError('');
    scrollToForm();
  }, []);

  const openResetPasswordModal = useCallback((branch: Branch, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBranch(branch);
    setResetPasswordData({ password: '', confirmPassword: '' });
    setShowResetPasswordModal(true);
    setError('');
  }, []);

  const openDeleteModal = useCallback((branch: Branch, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBranch(branch);
    setShowDeleteModal(true);
    setError('');
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!(await validateForm())) {
        toast.error(t.requiredFields, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      try {
        const branchData = {
          name: formData.name.trim(),
          nameEn: formData.nameEn.trim() || undefined,
          code: formData.code.trim(),
          address: formData.address.trim(),
          addressEn: formData.addressEn.trim() || undefined,
          city: formData.city.trim(),
          cityEn: formData.cityEn.trim() || undefined,
          phone: formData.phone.trim() || undefined,
          isActive: formData.isActive,
          user: showEditModal
            ? {
                name: formData.user.name.trim(),
                nameEn: formData.user.nameEn.trim() || undefined,
                username: formData.user.username.trim(),
                email: formData.user.email.trim() || undefined,
                phone: formData.user.phone.trim() || undefined,
                isActive: formData.user.isActive,
              }
            : {
                name: formData.user.name.trim(),
                nameEn: formData.user.nameEn.trim() || undefined,
                username: formData.user.username.trim(),
                email: formData.user.email.trim() || undefined,
                phone: formData.user.phone.trim() || undefined,
                password: formData.user.password.trim(),
                isActive: formData.user.isActive,
              },
        };
        if (showEditModal && selectedBranch) {
          await branchesAPI.update(selectedBranch._id, branchData);
          setBranches(branches.map((b) => (b._id === selectedBranch._id ? { ...b, ...branchData } : b)));
          toast.success(t.updated, { position: isRtl ? 'top-right' : 'top-left' });
        } else {
          const response = await branchesAPI.create(branchData);
          setBranches([...branches, response]);
          toast.success(t.added, { position: isRtl ? 'top-right' : 'top-left' });
        }
        setShowAddModal(false);
        setShowEditModal(false);
        setError('');
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Submit error:`, err);
        let errorMessage = showEditModal ? t.updateError : t.createError;
        if (err.response?.data?.message) {
          const message = err.response.data.message;
          errorMessage =
            message === 'Branch code already exists' ? t.codeExists :
            message === 'Username already exists' ? t.usernameExists :
            message.includes('الإيميل') || message.includes('email') ? t.emailExists :
            message;
        }
        setError(errorMessage);
        toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
      }
    },
    [formData, showEditModal, selectedBranch, branches, t, isRtl]
  );

  const handleResetPassword = useCallback(
    async (e: React.FormEvent) => {
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
        await branchesAPI.resetPassword(selectedBranch!._id, resetPasswordData.password);
        setShowResetPasswordModal(false);
        setResetPasswordData({ password: '', confirmPassword: '' });
        toast.success(t.passwordResetSuccess, { position: isRtl ? 'top-right' : 'top-left' });
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Reset password error:`, err);
        const errorMessage = err.message || t.passwordResetError;
        setError(errorMessage);
        toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
      }
    },
    [resetPasswordData, selectedBranch, t, isRtl]
  );

  const handleDelete = useCallback(async () => {
    if (!selectedBranch) return;
    try {
      await branchesAPI.delete(selectedBranch._id);
      setBranches(branches.filter((b) => b._id !== selectedBranch._id));
      toast.success(t.deleted, { position: isRtl ? 'top-right' : 'top-left' });
      setShowDeleteModal(false);
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Delete error:`, err);
      let errorMessage = t.deleteError;
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message === 'Cannot delete branch with associated orders or inventory' ?
          t.deleteRestricted : err.response.data.message;
      }
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    }
  }, [selectedBranch, branches, t, isRtl]);

  const handleCardClick = useCallback((branchId: string) => {
    navigate(`/branches/${branchId}`);
  }, [navigate]);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const renderPagination = useMemo(() => {
    const pages = [];
    const maxPagesToShow = 5;
    const startPage = Math.max(1, page - Math.floor(maxPagesToShow / 2));
    const endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <motion.button
          key={i}
          onClick={() => setPage(i)}
          className={`w-10 h-10 text-sm font-medium rounded-xl ${page === i ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-amber-200'} transition-colors duration-200 shadow-md`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {i}
        </motion.button>
      );
    }

    return (
      <div className="flex justify-center items-center mt-6 gap-2">
        <motion.button
          onClick={() => setPage((p) => Math.max(p - 1, 1))}
          disabled={page === 1}
          className="w-10 h-10 rounded-xl bg-gray-200 text-gray-700 disabled:opacity-50 hover:bg-amber-200 transition-colors duration-200 shadow-md"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {isRtl ? '→' : '←'}
        </motion.button>
        {pages}
        <motion.button
          onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
          disabled={page === totalPages}
          className="w-10 h-10 rounded-xl bg-gray-200 text-gray-700 disabled:opacity-50 hover:bg-amber-200 transition-colors duration-200 shadow-md"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {isRtl ? '←' : '→'}
        </motion.button>
      </div>
    );
  }, [page, totalPages, isRtl]);

  return (
    <div className={`mx-auto px-4 py-8 min-h-screen overflow-y-auto scrollbar-thin ${isRtl ? 'rtl font-arabic' : 'ltr font-sans'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6 flex flex-col items-center sm:flex-row sm:justify-between sm:items-center gap-4"
      >
        <div className="flex items-center gap-3">
          <MapPin className="w-8 h-8 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.manage}</h1>
            <p className="text-gray-600 text-sm">{t.addProducts}</p>
          </div>
        </div>
        {user?.role === 'admin' && (
          <motion.button
            onClick={openAddModal}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm transition-colors duration-200 flex items-center justify-center gap-2 shadow-lg"
            aria-label={t.add}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Plus className="w-4 h-4" />
            {t.add}
          </motion.button>
        )}
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm">{error}</span>
        </motion.div>
      )}

      {user?.role === 'admin' && (
        <div className={`lg:hidden fixed bottom-6 ${isRtl ? 'left-6' : 'right-6'} z-50`}>
          <motion.button
            onClick={openAddModal}
            className="p-3 bg-amber-600 hover:bg-amber-700 text-white rounded-full shadow-lg transition-all duration-200"
            aria-label={t.scrollToForm}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Plus className="w-6 h-6" />
          </motion.button>
        </div>
      )}

      <div className="space-y-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="p-5 bg-gradient-to-r from-white to-gray-50 rounded-xl shadow-lg"
        >
          <CustomInput
            value={searchInput}
            onChange={handleSearchChange}
            placeholder={t.searchPlaceholder}
            ariaLabel={t.searchPlaceholder}
          />
        </motion.div>

        <div className="lg:overflow-y-auto lg:max-h-[calc(100vh-8rem)] scrollbar-thin">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="p-5 bg-white rounded-xl shadow-md">
                  <div className="space-y-3 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredBranches.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="p-8 text-center bg-white rounded-xl shadow-lg"
            >
              <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-sm">{searchTerm ? t.noMatch : t.empty}</p>
              {user?.role === 'admin' && !searchTerm && (
                <motion.button
                  onClick={openAddModal}
                  className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm transition-colors duration-200 shadow-lg"
                  aria-label={t.addFirst}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {t.addFirst}
                </motion.button>
              )}
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {filteredBranches.map((branch, index) => (
                  <motion.div
                    key={branch._id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.15, delay: index * 0.02 }}
                    className="p-5 bg-white rounded-xl shadow-lg transition-colors duration-200 flex flex-col justify-between border border-gray-100 hover:border-amber-200 cursor-pointer"
                    onClick={() => handleCardClick(branch._id)}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-bold text-gray-900 text-base truncate" style={{ fontWeight: 700 }}>
                          {isRtl ? branch.name : branch.nameEn || branch.name}
                        </h3>
                        <MapPin className="w-5 h-5 text-amber-600" />
                      </div>
                      <p className="text-sm text-gray-500">{t.code}: {branch.code}</p>
                      <p className="text-sm text-gray-600 truncate">{t.address}: {isRtl ? branch.address : branch.addressEn || branch.address}</p>
                      <p className="text-sm text-gray-600 truncate">{t.city}: {isRtl ? branch.city : branch.cityEn || branch.city}</p>
                      <p className="text-sm text-gray-600 truncate">{t.phone}: {branch.phone || '-'}</p>
                      <p className={`text-sm font-medium ${branch.isActive ? 'text-teal-600' : 'text-red-600'}`}>
                        {t.status}: {branch.isActive ? t.active : t.inactive}
                      </p>
                    </div>
                    {user?.role === 'admin' && (
                      <div className="mt-4 flex justify-end gap-2">
                        <motion.button
                          onClick={(e) => openEditModal(branch, e)}
                          className="w-8 h-8 bg-amber-600 hover:bg-amber-700 text-white rounded-full transition-colors duration-200 flex items-center justify-center"
                          aria-label={t.edit}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </motion.button>
                        <motion.button
                          onClick={(e) => openResetPasswordModal(branch, e)}
                          className="w-8 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors duration-200 flex items-center justify-center"
                          aria-label={t.resetPassword}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Key className="w-4 h-4" />
                        </motion.button>
                        <motion.button
                          onClick={(e) => openDeleteModal(branch, e)}
                          className="w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors duration-200 flex items-center justify-center"
                          aria-label={t.delete}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </motion.button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {filteredBranches.length > 0 && renderPagination}

      <div ref={formRef}>
        <AnimatePresence>
          {(showAddModal || showEditModal) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-xl shadow-2xl max-w-2xl p-6 w-[90vw]"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-4">{showEditModal ? t.edit : t.add}</h3>
                <form onSubmit={handleSubmit} className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  >
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-gray-700">{t.name}</h4>
                      <CustomInput
                        value={formData.name}
                        onChange={(e) => dispatchForm({ type: 'UPDATE_FIELD', field: 'name', value: e.target.value })}
                        placeholder={t.namePlaceholder}
                        ariaLabel={t.name}
                      />
                      {formErrors.name && <p className="text-red-600 text-xs">{formErrors.name}</p>}
                      <CustomInput
                        value={formData.nameEn}
                        onChange={(e) => dispatchForm({ type: 'UPDATE_FIELD', field: 'nameEn', value: e.target.value })}
                        placeholder={t.nameEnPlaceholder}
                        ariaLabel={t.nameEn}
                      />
                      {formErrors.nameEn && <p className="text-red-600 text-xs">{formErrors.nameEn}</p>}
                      <CustomInput
                        value={formData.code}
                        onChange={(e) => dispatchForm({ type: 'UPDATE_FIELD', field: 'code', value: e.target.value })}
                        placeholder={t.codePlaceholder}
                        ariaLabel={t.code}
                      />
                      {formErrors.code && <p className="text-red-600 text-xs">{formErrors.code}</p>}
                      <CustomInput
                        value={formData.address}
                        onChange={(e) => dispatchForm({ type: 'UPDATE_FIELD', field: 'address', value: e.target.value })}
                        placeholder={t.addressPlaceholder}
                        ariaLabel={t.address}
                      />
                      {formErrors.address && <p className="text-red-600 text-xs">{formErrors.address}</p>}
                      <CustomInput
                        value={formData.addressEn}
                        onChange={(e) => dispatchForm({ type: 'UPDATE_FIELD', field: 'addressEn', value: e.target.value })}
                        placeholder={t.addressEnPlaceholder}
                        ariaLabel={t.addressEn}
                      />
                      {formErrors.addressEn && <p className="text-red-600 text-xs">{formErrors.addressEn}</p>}
                      <CustomInput
                        value={formData.city}
                        onChange={(e) => dispatchForm({ type: 'UPDATE_FIELD', field: 'city', value: e.target.value })}
                        placeholder={t.cityPlaceholder}
                        ariaLabel={t.city}
                      />
                      {formErrors.city && <p className="text-red-600 text-xs">{formErrors.city}</p>}
                      <CustomInput
                        value={formData.cityEn}
                        onChange={(e) => dispatchForm({ type: 'UPDATE_FIELD', field: 'cityEn', value: e.target.value })}
                        placeholder={t.cityEnPlaceholder}
                        ariaLabel={t.cityEn}
                      />
                      {formErrors.cityEn && <p className="text-red-600 text-xs">{formErrors.cityEn}</p>}
                      <CustomInput
                        value={formData.phone}
                        onChange={(e) => dispatchForm({ type: 'UPDATE_FIELD', field: 'phone', value: e.target.value })}
                        placeholder={t.phonePlaceholder}
                        ariaLabel={t.phone}
                      />
                      <CustomDropdown
                        value={formData.isActive}
                        onChange={(value) => dispatchForm({ type: 'UPDATE_FIELD', field: 'isActive', value: value === 'true' })}
                        options={[
                          { value: true, label: t.active },
                          { value: false, label: t.inactive },
                        ]}
                        ariaLabel={t.status}
                      />
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-gray-700">{t.user}</h4>
                      <CustomInput
                        value={formData.user.name}
                        onChange={(e) => dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'name', value: e.target.value })}
                        placeholder={t.userNamePlaceholder}
                        ariaLabel={t.userName}
                      />
                      {formErrors.userName && <p className="text-red-600 text-xs">{formErrors.userName}</p>}
                      <CustomInput
                        value={formData.user.nameEn}
                        onChange={(e) => dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'nameEn', value: e.target.value })}
                        placeholder={t.userNameEnPlaceholder}
                        ariaLabel={t.userNameEn}
                      />
                      {formErrors.userNameEn && <p className="text-red-600 text-xs">{formErrors.userNameEn}</p>}
                      <CustomInput
                        value={formData.user.username}
                        onChange={(e) => dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'username', value: e.target.value })}
                        placeholder={t.usernamePlaceholder}
                        ariaLabel={t.username}
                      />
                      {formErrors.username && <p className="text-red-600 text-xs">{formErrors.username}</p>}
                      <CustomInput
                        value={formData.user.email}
                        onChange={(e) => dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'email', value: e.target.value })}
                        placeholder={t.emailPlaceholder}
                        ariaLabel={t.email}
                      />
                      {formErrors.email && <p className="text-red-600 text-xs">{formErrors.email}</p>}
                      <CustomInput
                        value={formData.user.phone}
                        onChange={(e) => dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'phone', value: e.target.value })}
                        placeholder={t.userPhonePlaceholder}
                        ariaLabel={t.userPhone}
                      />
                      <CustomDropdown
                        value={formData.user.isActive}
                        onChange={(value) => dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'isActive', value: value === 'true' })}
                        options={[
                          { value: true, label: t.active },
                          { value: false, label: t.inactive },
                        ]}
                        ariaLabel={t.status}
                      />
                      {!showEditModal && (
                        <>
                          <CustomInput
                            value={formData.user.password}
                            onChange={(e) => dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'password', value: e.target.value })}
                            placeholder={t.passwordPlaceholder}
                            ariaLabel={t.password}
                            type="password"
                          />
                          {formErrors.password && <p className="text-red-600 text-xs">{formErrors.password}</p>}
                        </>
                      )}
                    </div>
                  </motion.div>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3"
                    >
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <span className="text-red-600 text-sm">{error}</span>
                    </motion.div>
                  )}
                  <div className="flex justify-end gap-3">
                    <motion.button
                      onClick={() => {
                        setShowAddModal(false);
                        setShowEditModal(false);
                      }}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-sm transition-colors duration-200 shadow-sm"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {t.cancel}
                    </motion.button>
                    <motion.button
                      type="submit"
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm transition-colors duration-200 shadow-lg"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {showEditModal ? t.update : t.add}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
          {showResetPasswordModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-xl shadow-2xl max-w-md p-6 w-[90vw]"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-4">{t.resetPassword}</h3>
                <form onSubmit={handleResetPassword} className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
                  <div className="space-y-4">
                    <CustomInput
                      value={resetPasswordData.password}
                      onChange={(e) => setResetPasswordData({ ...resetPasswordData, password: e.target.value })}
                      placeholder={t.newPasswordPlaceholder}
                      ariaLabel={t.newPassword}
                      type="password"
                    />
                    <CustomInput
                      value={resetPasswordData.confirmPassword}
                      onChange={(e) => setResetPasswordData({ ...resetPasswordData, confirmPassword: e.target.value })}
                      placeholder={t.confirmPasswordPlaceholder}
                      ariaLabel={t.confirmPassword}
                      type="password"
                    />
                  </div>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3"
                    >
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <span className="text-red-600 text-sm">{error}</span>
                    </motion.div>
                  )}
                  <div className="flex justify-end gap-3">
                    <motion.button
                      onClick={() => setShowResetPasswordModal(false)}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-sm transition-colors duration-200 shadow-sm"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {t.cancel}
                    </motion.button>
                    <motion.button
                      type="submit"
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm transition-colors duration-200 shadow-lg"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {t.reset}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
          {showDeleteModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-xl shadow-2xl max-w-md p-6 w-[90vw]"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-4">{t.confirmDelete}</h3>
                <p className="text-sm text-gray-600 mb-6">{t.deleteWarning}</p>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3"
                  >
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-red-600 text-sm">{error}</span>
                  </motion.div>
                )}
                <div className="flex justify-end gap-3">
                  <motion.button
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-sm transition-colors duration-200 shadow-sm"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {t.cancel}
                  </motion.button>
                  <motion.button
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm transition-colors duration-200 shadow-lg"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {t.delete}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Branches;