import React, { useState, useEffect, useCallback, useMemo, useReducer, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { branchesAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Modal } from '../components/UI/Modal';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { MapPin, Search, AlertCircle, Plus, Edit2, Trash2, Key } from 'lucide-react';
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
    subtitle: 'إدارة الفروع وإضافتها أو تعديلها',
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
    subtitle: 'Manage, add, or edit branches',
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

export const Branches: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const formRef = useRef<HTMLDivElement>(null);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
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
      setSearchTerm(value);
    }, 500),
    []
  );

  const fetchData = useCallback(async () => {
    if (!user || user.role !== 'admin') {
      setError(t.unauthorized);
      setLoading(false);
      toast.error(t.unauthorized, { position: isRtl ? 'top-right' : 'top-left' });
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
  }, [user, page, t, isRtl]);

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
    if (!isEditMode) {
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
  }, [formData, isEditMode, t, checkEmailAvailability, selectedBranch]);

  const openAddModal = useCallback(() => {
    dispatchForm({ type: 'RESET' });
    setIsEditMode(false);
    setSelectedBranch(null);
    setIsModalOpen(true);
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
    setIsEditMode(true);
    setSelectedBranch(branch);
    setIsModalOpen(true);
    setFormErrors({});
    setError('');
    scrollToForm();
  }, []);

  const openResetPasswordModal = useCallback((branch: Branch, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBranch(branch);
    setResetPasswordData({ password: '', confirmPassword: '' });
    setIsResetPasswordModalOpen(true);
    setError('');
  }, []);

  const openDeleteModal = useCallback((branch: Branch, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBranch(branch);
    setIsDeleteModalOpen(true);
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
          user: isEditMode
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
        if (isEditMode && selectedBranch) {
          await branchesAPI.update(selectedBranch._id, branchData);
          setBranches(branches.map((b) => (b._id === selectedBranch._id ? { ...b, ...branchData } : b)));
          toast.success(t.updated, { position: isRtl ? 'top-right' : 'top-left' });
        } else {
          const response = await branchesAPI.create(branchData);
          setBranches([...branches, response]);
          toast.success(t.added, { position: isRtl ? 'top-right' : 'top-left' });
        }
        setIsModalOpen(false);
        setError('');
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Submit error:`, err);
        let errorMessage = isEditMode ? t.updateError : t.createError;
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
    [formData, isEditMode, selectedBranch, branches, t, isRtl]
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
        setIsResetPasswordModalOpen(false);
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
      setIsDeleteModalOpen(false);
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
        <Button
          key={i}
          variant={page === i ? 'primary' : 'outline'}
          onClick={() => setPage(i)}
          className={`w-10 h-10 text-sm font-medium rounded-full ${page === i ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'} transition-colors`}
        >
          {i}
        </Button>
      );
    }

    return (
      <div className="flex justify-center items-center mt-6 gap-2">
        <Button
          variant="outline"
          onClick={() => setPage((p) => Math.max(p - 1, 1))}
          disabled={page === 1}
          className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 disabled:opacity-50 transition-colors"
        >
          {isRtl ? '→' : '←'}
        </Button>
        {pages}
        <Button
          variant="outline"
          onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
          disabled={page === totalPages}
          className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 disabled:opacity-50 transition-colors"
        >
          {isRtl ? '←' : '→'}
        </Button>
      </div>
    );
  }, [page, totalPages, isRtl]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className={`mx-auto max-w-7xl p-4 sm:p-6 min-h-screen bg-gray-100 ${isRtl ? 'rtl font-arabic' : 'ltr font-sans'}`}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4"
      >
        <div className="flex items-center gap-2 justify-center sm:justify-start">
          <MapPin className="w-6 h-6 text-amber-600" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-amber-900">{t.manage}</h1>
            <p className="text-sm text-gray-600">{t.subtitle}</p>
          </div>
        </div>
        {user?.role === 'admin' && (
          <Button
            variant="primary"
            icon={Plus}
            onClick={openAddModal}
            className="text-sm px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-md transition-transform transform hover:scale-105"
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
            className="mb-6 p-3 bg-red-100 border border-red-300 rounded-lg flex items-center gap-2 shadow-sm"
          >
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-red-600 text-sm font-medium">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {user?.role === 'admin' && (
        <div className={`lg:hidden fixed bottom-6 ${isRtl ? 'left-6' : 'right-6'} z-50`}>
          <Button
            onClick={openAddModal}
            variant="primary"
            className="p-3 bg-amber-600 hover:bg-amber-700 text-white rounded-full shadow-lg transition-transform transform hover:scale-105"
            aria-label={t.scrollToForm}
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      )}

      <div className="space-y-6">
        <Card className="p-4 bg-white rounded-lg shadow-md">
          <div className="relative">
            <Search
              className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 text-amber-500 w-5 h-5`}
            />
            <Input
              value={searchTerm}
              onChange={(value) => {
                setSearchTerm(value);
                debouncedSearch(value);
              }}
              placeholder={t.searchPlaceholder}
              className={`w-full pl-10 pr-4 py-2 text-sm border border-amber-300 rounded-full focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors bg-amber-50 ${isRtl ? 'text-right' : 'text-left'}`}
              aria-label={t.searchPlaceholder}
            />
          </div>
        </Card>

        <div className="lg:overflow-y-auto lg:max-h-[calc(100vh-8rem)] scrollbar-hidden">
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.1 }}
          >
            {filteredBranches.length === 0 ? (
              <Card className="p-6 text-center bg-white rounded-lg shadow-md col-span-full">
                <MapPin className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-amber-900">{t.noBranches}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {searchTerm ? t.noMatch : t.empty}
                </p>
                {user?.role === 'admin' && !searchTerm && (
                  <Button
                    variant="primary"
                    icon={Plus}
                    onClick={openAddModal}
                    className="mt-4 text-sm px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-md transition-transform transform hover:scale-105"
                  >
                    {t.addFirst}
                  </Button>
                )}
              </Card>
            ) : (
              filteredBranches.map((branch) => (
                <motion.div
                  key={branch._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card
                    className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer overflow-hidden"
                    onClick={() => handleCardClick(branch._id)}
                  >
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-base font-semibold text-amber-900 truncate max-w-[80%]">
                          {isRtl ? branch.name : branch.nameEn || branch.name}
                        </h3>
                        <MapPin className="w-5 h-5 text-amber-600" />
                      </div>
                      <p className="text-xs text-gray-600 truncate">{t.code}: {branch.code}</p>
                      <p className="text-xs text-gray-600 truncate">{t.address}: {isRtl ? branch.address : branch.addressEn || branch.address}</p>
                      <p className="text-xs text-gray-600 truncate">{t.city}: {isRtl ? branch.city : branch.cityEn || branch.city}</p>
                      <p className="text-xs text-gray-600 truncate">{t.phone}: {branch.phone || '-'}</p>
                      <p className={`text-xs font-medium ${branch.isActive ? 'text-green-600' : 'text-red-600'}`}>
                        {t.status}: {branch.isActive ? t.active : t.inactive}
                      </p>
                      {user?.role === 'admin' && (
                        <div className="flex gap-2 mt-3 justify-end">
                          <Button
                            variant="outline"
                            icon={Edit2}
                            onClick={(e) => openEditModal(branch, e)}
                            className="text-xs p-1.5 w-8 h-8 rounded-full text-amber-600 hover:text-amber-800 border-amber-600 hover:bg-amber-50"
                            aria-label={t.edit}
                          />
                          <Button
                            variant="outline"
                            icon={Key}
                            onClick={(e) => openResetPasswordModal(branch, e)}
                            className="text-xs p-1.5 w-8 h-8 rounded-full text-blue-500 hover:text-blue-700 border-blue-500 hover:bg-blue-50"
                            aria-label={t.resetPassword}
                          />
                          <Button
                            variant="outline"
                            icon={Trash2}
                            onClick={(e) => openDeleteModal(branch, e)}
                            className="text-xs p-1.5 w-8 h-8 rounded-full text-red-500 hover:text-red-700 border-red-500 hover:bg-red-50"
                            aria-label={t.delete}
                          />
                        </div>
                      )}
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </motion.div>
        </div>
      </div>

      {filteredBranches.length > 0 && renderPagination}

      <div ref={formRef}>
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={isEditMode ? t.edit : t.add}
          size="lg"
        >
          <form onSubmit={handleSubmit} className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-amber-900">{t.name}</h3>
                <Input
                  label={t.name}
                  value={formData.name}
                  onChange={(value) => dispatchForm({ type: 'UPDATE_FIELD', field: 'name', value })}
                  placeholder={t.namePlaceholder}
                  required
                  error={formErrors.name}
                  className="text-sm border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
                />
                <Input
                  label={t.nameEn}
                  value={formData.nameEn}
                  onChange={(value) => dispatchForm({ type: 'UPDATE_FIELD', field: 'nameEn', value })}
                  placeholder={t.nameEnPlaceholder}
                  required
                  error={formErrors.nameEn}
                  className="text-sm border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
                />
                <Input
                  label={t.code}
                  value={formData.code}
                  onChange={(value) => dispatchForm({ type: 'UPDATE_FIELD', field: 'code', value })}
                  placeholder={t.codePlaceholder}
                  required
                  error={formErrors.code}
                  className="text-sm border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
                />
                <Input
                  label={t.address}
                  value={formData.address}
                  onChange={(value) => dispatchForm({ type: 'UPDATE_FIELD', field: 'address', value })}
                  placeholder={t.addressPlaceholder}
                  required
                  error={formErrors.address}
                  className="text-sm border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
                />
                <Input
                  label={t.addressEn}
                  value={formData.addressEn}
                  onChange={(value) => dispatchForm({ type: 'UPDATE_FIELD', field: 'addressEn', value })}
                  placeholder={t.addressEnPlaceholder}
                  required
                  error={formErrors.addressEn}
                  className="text-sm border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
                />
                <Input
                  label={t.city}
                  value={formData.city}
                  onChange={(value) => dispatchForm({ type: 'UPDATE_FIELD', field: 'city', value })}
                  placeholder={t.cityPlaceholder}
                  required
                  error={formErrors.city}
                  className="text-sm border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
                />
                <Input
                  label={t.cityEn}
                  value={formData.cityEn}
                  onChange={(value) => dispatchForm({ type: 'UPDATE_FIELD', field: 'cityEn', value })}
                  placeholder={t.cityEnPlaceholder}
                  required
                  error={formErrors.cityEn}
                  className="text-sm border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
                />
                <Input
                  label={t.phone}
                  value={formData.phone}
                  onChange={(value) => dispatchForm({ type: 'UPDATE_FIELD', field: 'phone', value })}
                  placeholder={t.phonePlaceholder}
                  className="text-sm border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
                />
                <Select
                  label={t.status}
                  options={[
                    { value: true, label: t.active },
                    { value: false, label: t.inactive },
                  ]}
                  value={formData.isActive}
                  onChange={(value) => dispatchForm({ type: 'UPDATE_FIELD', field: 'isActive', value: value === 'true' })}
                  className="text-sm border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
                />
              </div>
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-amber-900">{t.user}</h3>
                <Input
                  label={t.userName}
                  value={formData.user.name}
                  onChange={(value) => dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'name', value })}
                  placeholder={t.userNamePlaceholder}
                  required={!isEditMode}
                  error={formErrors.userName}
                  className="text-sm border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
                />
                <Input
                  label={t.userNameEn}
                  value={formData.user.nameEn}
                  onChange={(value) => dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'nameEn', value })}
                  placeholder={t.userNameEnPlaceholder}
                  required={!isEditMode}
                  error={formErrors.userNameEn}
                  className="text-sm border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
                />
                <Input
                  label={t.username}
                  value={formData.user.username}
                  onChange={(value) => dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'username', value })}
                  placeholder={t.usernamePlaceholder}
                  required={!isEditMode}
                  error={formErrors.username}
                  className="text-sm border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
                />
                <Input
                  label={t.email}
                  value={formData.user.email}
                  onChange={(value) => dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'email', value })}
                  placeholder={t.emailPlaceholder}
                  error={formErrors.email}
                  className="text-sm border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
                />
                <Input
                  label={t.userPhone}
                  value={formData.user.phone}
                  onChange={(value) => dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'phone', value })}
                  placeholder={t.userPhonePlaceholder}
                  className="text-sm border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
                />
                <Select
                  label={t.status}
                  options={[
                    { value: true, label: t.active },
                    { value: false, label: t.inactive },
                  ]}
                  value={formData.user.isActive}
                  onChange={(value) => dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'isActive', value: value === 'true' })}
                  className="text-sm border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
                />
                {!isEditMode && (
                  <Input
                    label={t.password}
                    value={formData.user.password}
                    onChange={(value) => dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'password', value })}
                    placeholder={t.passwordPlaceholder}
                    type="password"
                    required
                    error={formErrors.password}
                    className="text-sm border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
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
                  className="p-3 bg-red-100 border border-red-300 rounded-lg flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span className="text-red-600 text-sm font-medium">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex gap-3 mt-6">
              <Button
                type="submit"
                variant="primary"
                className="flex-1 text-sm px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-md transition-transform transform hover:scale-105"
              >
                {isEditMode ? t.update : t.add}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 text-sm px-4 py-2 bg-gray-200 hover:bg-gray-300 text-amber-900 rounded-lg shadow-md transition-transform transform hover:scale-105"
              >
                {t.cancel}
              </Button>
            </div>
          </form>
        </Modal>
      </div>

      <Modal
        isOpen={isResetPasswordModalOpen}
        onClose={() => setIsResetPasswordModalOpen(false)}
        title={t.resetPassword}
        size="sm"
      >
        <form onSubmit={handleResetPassword} className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <Input
              label={t.newPassword}
              value={resetPasswordData.password}
              onChange={(value) => setResetPasswordData({ ...resetPasswordData, password: value })}
              placeholder={t.newPasswordPlaceholder}
              type="password"
              required
              className="text-sm border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
            />
            <Input
              label={t.confirmPassword}
              value={resetPasswordData.confirmPassword}
              onChange={(value) => setResetPasswordData({ ...resetPasswordData, confirmPassword: value })}
              placeholder={t.confirmPasswordPlaceholder}
              type="password"
              required
              className="text-sm border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
            />
          </motion.div>
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 bg-red-100 border border-red-300 rounded-lg flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-red-600 text-sm font-medium">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex gap-3 mt-4">
            <Button
              type="submit"
              variant="primary"
              className="flex-1 text-sm px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-md transition-transform transform hover:scale-105"
            >
              {t.reset}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsResetPasswordModalOpen(false)}
              className="flex-1 text-sm px-4 py-2 bg-gray-200 hover:bg-gray-300 text-amber-900 rounded-lg shadow-md transition-transform transform hover:scale-105"
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
          <p className="text-sm text-gray-600">{t.deleteWarning}</p>
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 bg-red-100 border border-red-300 rounded-lg flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-red-600 text-sm font-medium">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex gap-3 mt-4">
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              className="flex-1 text-sm px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md transition-transform transform hover:scale-105"
            >
              {t.delete}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsDeleteModalOpen(false)}
              className="flex-1 text-sm px-4 py-2 bg-gray-200 hover:bg-gray-300 text-amber-900 rounded-lg shadow-md transition-transform transform hover:scale-105"
            >
              {t.cancel}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Branches;