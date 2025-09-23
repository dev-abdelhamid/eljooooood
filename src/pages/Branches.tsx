import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { branchesAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Modal } from '../components/UI/Modal';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { MapPin, Search, AlertCircle, Plus, Edit2, Trash2, ChevronDown, Key, User, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate, Link } from 'react-router-dom';

interface Branch {
  _id: string;
  name: string;
  nameEn?: string;
  code: string;
  address: string;
  city: string;
  cityEn?: string; // Added for English city name
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
    password?: string; // For admin viewing
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

const translations = {
  ar: {
    manage: 'إدارة الفروع',
    add: 'إضافة فرع',
    addFirst: 'إضافة أول فرع',
    noBranches: 'لا توجد فروع',
    noMatch: 'لا توجد فروع مطابقة',
    empty: 'لا توجد فروع متاحة',
    searchPlaceholder: 'ابحث عن الفروع...',
    status: 'الحالة',
    allStatuses: 'جميع الحالات',
    active: 'نشط',
    inactive: 'غير نشط',
    filters: 'الفلاتر',
    previous: 'السابق',
    next: 'التالي',
    page: 'صفحة',
    of: 'من',
    code: 'الكود',
    address: 'العنوان',
    city: 'المدينة',
    cityEn: 'المدينة (إنجليزي)',
    phone: 'الهاتف',
    user: 'المستخدم',
    username: 'اسم المستخدم',
    email: 'الإيميل',
    userPhone: 'هاتف المستخدم',
    userStatus: 'حالة المستخدم',
    createdBy: 'تم الإنشاء بواسطة',
    createdAt: 'تاريخ الإنشاء',
    updatedAt: 'تاريخ التحديث',
    edit: 'تعديل',
    resetPassword: 'إعادة تعيين كلمة المرور',
    delete: 'حذف',
    name: 'اسم الفرع (عربي)',
    nameEn: 'اسم الفرع (إنجليزي)',
    nameRequired: 'اسم الفرع مطلوب',
    nameEnRequired: 'اسم الفرع بالإنجليزية مطلوب',
    codeRequired: 'كود الفرع مطلوب',
    addressRequired: 'العنوان مطلوب',
    cityRequired: 'المدينة مطلوبة',
    cityEnRequired: 'المدينة بالإنجليزية مطلوبة',
    userName: 'اسم المستخدم (عربي)',
    userNameEn: 'اسم المستخدم (إنجليزي)',
    userNameRequired: 'اسم المستخدم مطلوب',
    userNameEnRequired: 'اسم المستخدم بالإنجليزية مطلوب',
    usernameRequired: 'اسم المستخدم للفرع مطلوب',
    passwordRequired: 'كلمة المرور مطلوبة',
    namePlaceholder: 'أدخل اسم الفرع',
    nameEnPlaceholder: 'أدخل اسم الفرع بالإنجليزية',
    codePlaceholder: 'أدخل كود الفرع',
    addressPlaceholder: 'أدخل العنوان',
    cityPlaceholder: 'أدخل المدينة',
    cityEnPlaceholder: 'أدخل المدينة بالإنجليزية',
    phonePlaceholder: 'أدخل رقم الهاتف',
    userNamePlaceholder: 'أدخل اسم المستخدم',
    userNameEnPlaceholder: 'أدخل اسم المستخدم بالإنجليزية',
    usernamePlaceholder: 'أدخل اسم المستخدم للفرع',
    emailPlaceholder: 'أدخل الإيميل',
    userPhonePlaceholder: 'أدخل رقم هاتف المستخدم',
    passwordPlaceholder: 'أدخل كلمة المرور للفرع',
    update: 'تحديث الفرع',
    requiredFields: 'يرجى ملء جميع الحقول المطلوبة',
    emailExists: 'الإيميل مستخدم بالفعل، اختر إيميل آخر',
    codeExists: 'هذا الكود مستخدم بالفعل، اختر كودًا آخر',
    usernameExists: 'اسم المستخدم مستخدم بالفعل، اختر اسمًا آخر',
    unauthorized: 'غير مصرح لك بالوصول',
    fetchError: 'حدث خطأ أثناء جلب البيانات',
    updateError: 'حدث خطأ أثناء تحديث الفرع',
    createError: 'حدث خطأ أثناء إنشاء الفرع',
    added: 'تم إضافة الفرع بنجاح',
    updated: 'تم تحديث الفرع بنجاح',
    newPassword: 'كلمة المرور الجديدة',
    confirmPassword: 'تأكيد كلمة المرور',
    newPasswordPlaceholder: 'أدخل كلمة المرور الجديدة',
    confirmPasswordPlaceholder: 'أدخل تأكيد كلمة المرور',
    passwordMismatch: 'كلمة المرور وتأكيدها غير متطابقتين',
    passwordTooShort: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
    passwordResetSuccess: 'تم إعادة تعيين كلمة المرور بنجاح',
    passwordResetError: 'حدث خطأ أثناء إعادة تعيين كلمة المرور',
    reset: 'إعادة تعيين',
    cancel: 'إلغاء',
    confirmDelete: 'تأكيد حذف الفرع',
    deleteWarning: 'هل أنت متأكد من حذف هذا الفرع؟ لا يمكن التراجع عن هذا الإجراء.',
    deleteRestricted: 'لا يمكن حذف الفرع لوجود طلبات أو مخزون مرتبط',
    deleteError: 'حدث خطأ أثناء حذف الفرع',
    deleted: 'تم حذف الفرع بنجاح',
    profile: 'عرض التفاصيل',
    backToBranches: 'العودة إلى الفروع',
    branchDetails: 'تفاصيل الفرع',
    userDetails: 'تفاصيل المستخدم',
    viewCurrentPassword: 'عرض كلمة المرور الحالية',
    currentPassword: 'كلمة المرور الحالية',
  },
  en: {
    manage: 'Manage Branches',
    add: 'Add Branch',
    addFirst: 'Add First Branch',
    noBranches: 'No Branches Found',
    noMatch: 'No Matching Branches',
    empty: 'No Branches Available',
    searchPlaceholder: 'Search branches...',
    status: 'Status',
    allStatuses: 'All Statuses',
    active: 'Active',
    inactive: 'Inactive',
    filters: 'Filters',
    previous: 'Previous',
    next: 'Next',
    page: 'Page',
    of: 'of',
    code: 'Code',
    address: 'Address',
    city: 'City',
    cityEn: 'City (English)',
    phone: 'Phone',
    user: 'User',
    username: 'Username',
    email: 'Email',
    userPhone: 'User Phone',
    userStatus: 'User Status',
    createdBy: 'Created By',
    createdAt: 'Created At',
    updatedAt: 'Updated At',
    edit: 'Edit',
    resetPassword: 'Reset Password',
    delete: 'Delete',
    name: 'Branch Name (Arabic)',
    nameEn: 'Branch Name (English)',
    nameRequired: 'Branch name is required',
    nameEnRequired: 'Branch name in English is required',
    codeRequired: 'Branch code is required',
    addressRequired: 'Address is required',
    cityRequired: 'City is required',
    cityEnRequired: 'City in English is required',
    userName: 'User Name (Arabic)',
    userNameEn: 'User Name (English)',
    userNameRequired: 'User name is required',
    userNameEnRequired: 'User name in English is required',
    usernameRequired: 'Branch username is required',
    passwordRequired: 'Password is required',
    namePlaceholder: 'Enter branch name',
    nameEnPlaceholder: 'Enter branch name in English',
    codePlaceholder: 'Enter branch code',
    addressPlaceholder: 'Enter address',
    cityPlaceholder: 'Enter city',
    cityEnPlaceholder: 'Enter city in English',
    phonePlaceholder: 'Enter phone number',
    userNamePlaceholder: 'Enter user name',
    userNameEnPlaceholder: 'Enter user name in English',
    usernamePlaceholder: 'Enter branch username',
    emailPlaceholder: 'Enter email',
    userPhonePlaceholder: 'Enter user phone number',
    passwordPlaceholder: 'Enter branch password',
    update: 'Update Branch',
    requiredFields: 'Please fill all required fields',
    emailExists: 'Email is already in use, choose another',
    codeExists: 'This code is already in use, choose another',
    usernameExists: 'Username is already in use, choose another',
    unauthorized: 'You are not authorized to access',
    fetchError: 'An error occurred while fetching data',
    updateError: 'An error occurred while updating the branch',
    createError: 'An error occurred while creating the branch',
    added: 'Branch added successfully',
    updated: 'Branch updated successfully',
    newPassword: 'New Password',
    confirmPassword: 'Confirm Password',
    newPasswordPlaceholder: 'Enter new password',
    confirmPasswordPlaceholder: 'Enter confirm password',
    passwordMismatch: 'Password and confirmation do not match',
    passwordTooShort: 'Password must be at least 6 characters',
    passwordResetSuccess: 'Password reset successfully',
    passwordResetError: 'An error occurred while resetting the password',
    reset: 'Reset',
    cancel: 'Cancel',
    confirmDelete: 'Confirm Branch Deletion',
    deleteWarning: 'Are you sure you want to delete this branch? This action cannot be undone.',
    deleteRestricted: 'Cannot delete branch with associated orders or inventory',
    deleteError: 'An error occurred while deleting the branch',
    deleted: 'Branch deleted successfully',
    profile: 'View Details',
    backToBranches: 'Back to Branches',
    branchDetails: 'Branch Details',
    userDetails: 'User Details',
    viewCurrentPassword: 'View Current Password',
    currentPassword: 'Current Password',
  },
};

// صفحة القائمة الرئيسية للفروع
const BranchesList: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
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
  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    code: '',
    address: '',
    city: '',
    cityEn: '',
    phone: '',
    isActive: true,
    user: { name: '', nameEn: '', username: '', email: '', phone: '', password: '', isActive: true },
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async () => {
    if (!user || user.role !== 'admin') {
      setError(t.unauthorized);
      setLoading(false);
      toast.error(t.unauthorized, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }

    setLoading(true);
    try {
      const response = await branchesAPI.getAll({ status: filterStatus === 'all' ? undefined : filterStatus, page, limit: 10 });
      const data = Array.isArray(response.data) ? response.data : response;
      setBranches(data.map((branch: Branch) => ({ ...branch, user: { ...branch.user, password: '********' } })));
      setTotalPages(response.totalPages || Math.ceil(data.length / 10));
      setError('');
    } catch (err: any) {
      setError(err.message || t.fetchError);
      toast.error(t.fetchError, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setLoading(false);
    }
  }, [user, filterStatus, page, t, isRtl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredBranches = branches.filter(
    (branch) =>
      branch &&
      ((isRtl ? branch.name : branch.nameEn || branch.name)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (isRtl ? branch.city : branch.cityEn || branch.city)?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const checkEmailAvailability = async (email: string) => {
    try {
      const response = await branchesAPI.checkEmail(email);
      return response.available;
    } catch {
      return false;
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.name) errors.name = t.nameRequired;
    if (!formData.nameEn) errors.nameEn = t.nameEnRequired;
    if (!formData.code) errors.code = t.codeRequired;
    if (!formData.address) errors.address = t.addressRequired;
    if (!formData.city) errors.city = t.cityRequired;
    if (!formData.cityEn) errors.cityEn = t.cityEnRequired;
    if (!isEditMode) {
      if (!formData.user.name) errors.userName = t.userNameRequired;
      if (!formData.user.nameEn) errors.userNameEn = t.userNameEnRequired;
      if (!formData.user.username) errors.username = t.usernameRequired;
      if (!formData.user.password) errors.password = t.passwordRequired;
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openAddModal = () => {
    setFormData({
      name: '',
      nameEn: '',
      code: '',
      address: '',
      city: '',
      cityEn: '',
      phone: '',
      isActive: true,
      user: { name: '', nameEn: '', username: '', email: '', phone: '', password: '', isActive: true },
    });
    setIsEditMode(false);
    setSelectedBranch(null);
    setIsModalOpen(true);
    setFormErrors({});
    setError('');
  };

  const openEditModal = (branch: Branch) => {
    setFormData({
      name: branch.name,
      nameEn: branch.nameEn || '',
      code: branch.code,
      address: branch.address,
      city: branch.city,
      cityEn: branch.cityEn || '',
      phone: branch.phone || '',
      isActive: branch.isActive,
      user: {
        name: branch.user?.name || '',
        nameEn: branch.user?.nameEn || '',
        username: branch.user?.username || '',
        email: branch.user?.email || '',
        phone: branch.user?.phone || '',
        password: '',
        isActive: branch.user?.isActive ?? true,
      },
    });
    setIsEditMode(true);
    setSelectedBranch(branch);
    setIsModalOpen(true);
    setFormErrors({});
    setError('');
  };

  const openResetPasswordModal = (branch: Branch) => {
    setSelectedBranch(branch);
    setResetPasswordData({ password: '', confirmPassword: '' });
    setIsResetPasswordModalOpen(true);
    setError('');
  };

  const openDeleteModal = (branch: Branch) => {
    setSelectedBranch(branch);
    setIsDeleteModalOpen(true);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error(t.requiredFields, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }

    if (!isEditMode && formData.user.email) {
      const isEmailAvailable = await checkEmailAvailability(formData.user.email);
      if (!isEmailAvailable) {
        setError(t.emailExists);
        toast.error(t.emailExists, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
    }

    try {
      const branchData = {
        name: formData.name.trim(),
        nameEn: formData.nameEn.trim(),
        code: formData.code.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        cityEn: formData.cityEn.trim(),
        phone: formData.phone.trim() || undefined,
        isActive: formData.isActive,
        user: isEditMode
          ? {
              name: formData.user.name.trim(),
              nameEn: formData.user.nameEn.trim(),
              username: formData.user.username.trim(),
              email: formData.user.email.trim() || undefined,
              phone: formData.user.phone.trim() || undefined,
              isActive: formData.user.isActive,
            }
          : {
              name: formData.user.name.trim(),
              nameEn: formData.user.nameEn.trim(),
              username: formData.user.username.trim(),
              email: formData.user.email.trim() || undefined,
              phone: formData.user.phone.trim() || undefined,
              password: formData.user.password.trim(),
              isActive: formData.user.isActive,
            },
      };

      if (isEditMode && selectedBranch) {
        await branchesAPI.update(selectedBranch._id, branchData);
        setBranches(branches.map((b) => (b._id === selectedBranch._id ? { ...b, ...branchData, user: { ...b.user, ...branchData.user } } : b)));
        toast.success(t.updated, { position: isRtl ? 'top-right' : 'top-left' });
      } else {
        const response = await branchesAPI.create(branchData);
        setBranches([...branches, { ...response, user: { ...response.user, password: '********' } }]);
        toast.success(t.added, { position: isRtl ? 'top-right' : 'top-left' });
      }
      setIsModalOpen(false);
      setError('');
    } catch (err: any) {
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
      await branchesAPI.resetBranchPassword(selectedBranch!._id, { password: resetPasswordData.password });
      setBranches(branches.map((b) => (b._id === selectedBranch!._id ? { ...b, user: { ...b.user, password: '********' } } : b)));
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
    if (!selectedBranch) return;
    try {
      await branchesAPI.delete(selectedBranch._id);
      setBranches(branches.filter((b) => b._id !== selectedBranch._id));
      toast.success(t.deleted, { position: isRtl ? 'top-right' : 'top-left' });
      setIsDeleteModalOpen(false);
      setError('');
    } catch (err: any) {
      let errorMessage = t.deleteError;
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message === 'Cannot delete branch with associated orders or inventory' ?
          t.deleteRestricted : err.response.data.message;
      }
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  const togglePasswordVisibility = (branchId: string) => {
    setShowPassword((prev) => ({ ...prev, [branchId]: !prev[branchId] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className={`mx-auto p-4 sm:p-6 min-h-screen bg-gray-100 ${isRtl ? 'rtl font-arabic' : 'ltr font-sans'}`}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4"
      >
        <h1 className="text-3xl sm:text-4xl font-bold text-amber-900 flex items-center justify-center sm:justify-start gap-3">
          <MapPin className="w-8 h-8 text-amber-600" />
          {t.manage}
        </h1>
        {user?.role === 'admin' && (
          <Button
            variant="primary"
            icon={Plus}
            onClick={openAddModal}
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-6 py-3 shadow-md transition-transform transform hover:scale-105"
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
           

 className="mb-8 p-4 bg-red-100 border border-red-300 rounded-lg flex items-center gap-3 shadow-sm"
          >
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-600 font-medium">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="p-6 mb-8 bg-white rounded-lg shadow-md">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search
              className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 text-amber-500 w-5 h-5`}
            />
            <Input
              value={searchTerm}
              onChange={(value) => setSearchTerm(value)}
              placeholder={t.searchPlaceholder}
              className={`pl-10 pr-4 py-2 border border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 transition-colors bg-amber-50 ${isRtl ? 'text-right' : 'text-left'}`}
              aria-label={t.searchPlaceholder}
            />
          </div>
          <div className="relative flex-1">
            <Select
              label={t.status}
              options={[
                { value: 'all', label: t.allStatuses },
                { value: 'active', label: t.active },
                { value: 'inactive', label: t.inactive },
              ]}
              value={filterStatus}
              onChange={(value) => setFilterStatus(value)}
              className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 transition-colors bg-amber-50"
              aria-label={t.status}
            />
          </div>
          <Button
            variant="outline"
            icon={ChevronDown}
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="sm:hidden bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-lg px-4 py-2"
          >
            {t.filters}
          </Button>
        </div>
        <AnimatePresence>
          {isFilterOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 sm:hidden"
            >
              <Select
                label={t.status}
                options={[
                  { value: 'all', label: t.allStatuses },
                  { value: 'active', label: t.active },
                  { value: 'inactive', label: t.inactive },
                ]}
                value={filterStatus}
                onChange={(value) => setFilterStatus(value)}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 transition-colors bg-amber-50"
                aria-label={t.status}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex justify-center mt-6">
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page === 1}
            className="mx-2 px-4 py-2 bg-amber-100 text-amber-800 disabled:opacity-50"
          >
            {t.previous}
          </Button>
          <span className="px-4 py-2 text-amber-900">
            {t.page} {page} {t.of} {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            disabled={page === totalPages}
            className="mx-2 px-4 py-2 bg-amber-100 text-amber-800 disabled:opacity-50"
          >
            {t.next}
          </Button>
        </div>
      </Card>

      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ staggerChildren: 0.1 }}
      >
        {filteredBranches.length === 0 ? (
          <Card className="p-8 text-center bg-white rounded-lg shadow-md col-span-full">
            <MapPin className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-amber-900">{t.noBranches}</h3>
            <p className="text-gray-600 mt-2">
              {searchTerm || filterStatus !== 'all' ? t.noMatch : t.empty}
            </p>
            {user?.role === 'admin' && !searchTerm && filterStatus === 'all' && (
              <Button
                variant="primary"
                icon={Plus}
                onClick={openAddModal}
                className="mt-6 bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-6 py-3 shadow-md transition-transform transform hover:scale-105"
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
              <Card className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <Link to={`/branches/${branch._id}`} className="font-semibold text-lg text-amber-900 hover:underline truncate">
                      {isRtl ? branch.name : branch.nameEn || branch.name}
                    </Link>
                    <MapPin className="w-6 h-6 text-amber-600" />
                  </div>
                  <p className="text-sm text-gray-600 flex"><span className="w-24 font-medium">{t.code}:</span> <span>{branch.code}</span></p>
                  <p className="text-sm text-gray-600 flex"><span className="w-24 font-medium">{t.address}:</span> <span>{branch.address}</span></p>
                  <p className="text-sm text-gray-600 flex"><span className="w-24 font-medium">{t.city}:</span> <span>{isRtl ? branch.city : branch.cityEn || branch.city}</span></p>
                  <p className="text-sm text-gray-600 flex"><span className="w-24 font-medium">{t.phone}:</span> <span>{branch.phone || '-'}</span></p>
                  <p className={`text-sm flex ${branch.isActive ? 'text-green-600' : 'text-red-600'}`}>
                    <span className="w-24 font-medium">{t.status}:</span> <span>{branch.isActive ? t.active : t.inactive}</span>
                  </p>
                  {user?.role === 'admin' && (
                    <div className="flex gap-3 mt-4">
                      <Button
                        variant="outline"
                        icon={Edit2}
                        onClick={(e) => { e.stopPropagation(); openEditModal(branch); }}
                        className="text-amber-600 hover:text-amber-800 border-amber-600"
                      >
                        {t.edit}
                      </Button>
                      <Button
                        variant="outline"
                        icon={Key}
                        onClick={(e) => { e.stopPropagation(); openResetPasswordModal(branch); }}
                        className="text-blue-500 hover:text-blue-700 border-blue-500"
                      >
                        {t.resetPassword}
                      </Button>
                      <Button
                        variant="outline"
                        icon={Trash2}
                        onClick={(e) => { e.stopPropagation(); openDeleteModal(branch); }}
                        className="text-red-500 hover:text-red-700 border-red-500"
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
            className="grid grid-cols-1 sm:grid-cols-2 gap-6"
          >
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-amber-900">{t.branchDetails}</h3>
              <Input
                label={t.name}
                value={formData.name}
                onChange={(value) => setFormData({ ...formData, name: value })}
                placeholder={t.namePlaceholder}
                required
                error={formErrors.name}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t.nameEn}
                value={formData.nameEn}
                onChange={(value) => setFormData({ ...formData, nameEn: value })}
                placeholder={t.nameEnPlaceholder}
                required
                error={formErrors.nameEn}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t.code}
                value={formData.code}
                onChange={(value) => setFormData({ ...formData, code: value })}
                placeholder={t.codePlaceholder}
                required
                error={formErrors.code}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t.address}
                value={formData.address}
                onChange={(value) => setFormData({ ...formData, address: value })}
                placeholder={t.addressPlaceholder}
                required
                error={formErrors.address}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t.city}
                value={formData.city}
                onChange={(value) => setFormData({ ...formData, city: value })}
                placeholder={t.cityPlaceholder}
                required
                error={formErrors.city}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t.cityEn}
                value={formData.cityEn}
                onChange={(value) => setFormData({ ...formData, cityEn: value })}
                placeholder={t.cityEnPlaceholder}
                required
                error={formErrors.cityEn}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t.phone}
                value={formData.phone}
                onChange={(value) => setFormData({ ...formData, phone: value })}
                placeholder={t.phonePlaceholder}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Select
                label={t.status}
                options={[
                  { value: true, label: t.active },
                  { value: false, label: t.inactive },
                ]}
                value={formData.isActive}
                onChange={(value) => setFormData({ ...formData, isActive: value === 'true' })}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
            </div>
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-amber-900">{t.userDetails}</h3>
              <Input
                label={t.userName}
                value={formData.user.name}
                onChange={(value) => setFormData({ ...formData, user: { ...formData.user, name: value } })}
                placeholder={t.userNamePlaceholder}
                required={!isEditMode}
                error={formErrors.userName}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t.userNameEn}
                value={formData.user.nameEn}
                onChange={(value) => setFormData({ ...formData, user: { ...formData.user, nameEn: value } })}
                placeholder={t.userNameEnPlaceholder}
                required={!isEditMode}
                error={formErrors.userNameEn}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t.username}
                value={formData.user.username}
                onChange={(value) => setFormData({ ...formData, user: { ...formData.user, username: value } })}
                placeholder={t.usernamePlaceholder}
                required={!isEditMode}
                error={formErrors.username}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t.email}
                value={formData.user.email}
                onChange={(value) => setFormData({ ...formData, user: { ...formData.user, email: value } })}
                placeholder={t.emailPlaceholder}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t.userPhone}
                value={formData.user.phone}
                onChange={(value) => setFormData({ ...formData, user: { ...formData.user, phone: value } })}
                placeholder={t.userPhonePlaceholder}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Select
                label={t.userStatus}
                options={[
                  { value: true, label: t.active },
                  { value: false, label: t.inactive },
                ]}
                value={formData.user.isActive}
                onChange={(value) => setFormData({ ...formData, user: { ...formData.user, isActive: value === 'true' } })}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              {!isEditMode && (
                <Input
                  label={t.password}
                  value={formData.user.password}
                  onChange={(value) => setFormData({ ...formData, user: { ...formData.user, password: value } })}
                  placeholder={t.passwordPlaceholder}
                  type={showPassword['new'] ? 'text' : 'password'}
                  required
                  error={formErrors.password}
                  className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
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
                className="p-3 bg-red-100 border border-red-300 rounded-lg flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="text-red-600 font-medium">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex gap-4 mt-6">
            <Button
              type="submit"
              variant="primary"
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-6 py-3 shadow-md transition-transform transform hover:scale-105"
            >
              {isEditMode ? t.update : t.add}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-amber-900 rounded-lg px-6 py-3 shadow-md transition-transform transform hover:scale-105"
            >
              {t.cancel}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isResetPasswordModalOpen}
        onClose={() => setIsResetPasswordModalOpen(false)}
        title={t.resetPassword}
        size="sm"
      >
        <form onSubmit={handleResetPassword} className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <Input
              label={t.newPassword}
              value={resetPasswordData.password}
              onChange={(value) => setResetPasswordData({ ...resetPasswordData, password: value })}
              placeholder={t.newPasswordPlaceholder}
              type={showPassword['newPassword'] ? 'text' : 'password'}
              required
              className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
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
              className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              icon={showPassword['confirmPassword'] ? EyeOff : Eye}
              onIconClick={() => setShowPassword((prev) => ({ ...prev, confirmPassword: !prev.confirmPassword }))}
            />
          </motion.div>
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 bg-red-100 border border-red-300 rounded-lg flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="text-red-600 font-medium">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex gap-4 mt-6">
            <Button
              type="submit"
              variant="primary"
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-6 py-3 shadow-md transition-transform transform hover:scale-105"
            >
              {t.reset}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsResetPasswordModalOpen(false)}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-amber-900 rounded-lg px-6 py-3 shadow-md transition-transform transform hover:scale-105"
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
        <div className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
          <p className="text-gray-600">{t.deleteWarning}</p>
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 bg-red-100 border border-red-300 rounded-lg flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="text-red-600 font-medium">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex gap-4 mt-6">
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg px-6 py-3 shadow-md transition-transform transform hover:scale-105"
            >
              {t.delete}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsDeleteModalOpen(false)}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-amber-900 rounded-lg px-6 py-3 shadow-md transition-transform transform hover:scale-105"
            >
              {t.cancel}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// صفحة تفاصيل الفرع
const BranchProfile: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [branch, setBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const fetchBranch = async () => {
      if (!id) {
        setError(t.fetchError);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const response = await branchesAPI.getById(id);
        setBranch({ ...response, user: { ...response.user, password: '********' } });
        setError('');
      } catch (err: any) {
        setError(err.message || t.fetchError);
        toast.error(t.fetchError, { position: isRtl ? 'top-right' : 'top-left' });
      } finally {
        setLoading(false);
      }
    };
    fetchBranch();
  }, [id, t, isRtl]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !branch) {
    return (
      <div className={`mx-auto p-4 sm:p-6 min-h-screen bg-gray-100 ${isRtl ? 'rtl font-arabic' : 'ltr font-sans'}`}>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-100 border border-red-300 rounded-lg flex items-center gap-3 shadow-sm"
        >
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 font-medium">{error || t.fetchError}</span>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`mx-auto p-4 sm:p-6 min-h-screen bg-gray-100 ${isRtl ? 'rtl font-arabic' : 'ltr font-sans'}`}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-3xl mx-auto"
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <MapPin className="w-8 h-8 text-amber-600" />
            <h1 className="text-3xl font-bold text-amber-900">{isRtl ? branch.name : branch.nameEn || branch.name}</h1>
          </div>
          <Button
            variant="secondary"
            onClick={() => navigate('/branches')}
            className="bg-gray-200 hover:bg-gray-300 text-amber-900 rounded-lg px-6 py-3 shadow-md transition-transform transform hover:scale-105"
          >
            {t.backToBranches}
          </Button>
        </div>

        <Card className="bg-white rounded-lg shadow-md p-6">
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-amber-900">{t.branchDetails}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 font-medium">{t.code}</p>
                <p className="text-gray-800">{branch.code}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">{t.address}</p>
                <p className="text-gray-800">{branch.address}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">{t.city}</p>
                <p className="text-gray-800">{isRtl ? branch.city : branch.cityEn || branch.city}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">{t.phone}</p>
                <p className="text-gray-800">{branch.phone || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">{t.status}</p>
                <p className={`font-medium ${branch.isActive ? 'text-green-600' : 'text-red-600'}`}>
                  {branch.isActive ? t.active : t.inactive}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">{t.createdAt}</p>
                <p className="text-gray-800">{new Date(branch.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">{t.updatedAt}</p>
                <p className="text-gray-800">{new Date(branch.updatedAt).toLocaleString()}</p>
              </div>
              {branch.createdBy && (
                <div>
                  <p className="text-sm text-gray-600 font-medium">{t.createdBy}</p>
                  <p className="text-gray-800">{isRtl ? branch.createdBy.name : branch.createdBy.nameEn || branch.createdBy.name}</p>
                </div>
              )}
            </div>
            {branch.user && (
              <div className="border-t border-amber-100 pt-4">
                <h4 className="text-lg font-semibold text-amber-900 mb-3 flex items-center gap-2">
                  <User className="w-6 h-6 text-amber-600" />
                  {t.userDetails}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">{t.userName}</p>
                    <p className="text-gray-800">{isRtl ? branch.user.name : branch.user.nameEn || branch.user.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">{t.username}</p>
                    <p className="text-gray-800">{branch.user.username}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">{t.email}</p>
                    <p className="text-gray-800">{branch.user.email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">{t.userPhone}</p>
                    <p className="text-gray-800">{branch.user.phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">{t.userStatus}</p>
                    <p className={`font-medium ${branch.user.isActive ? 'text-green-600' : 'text-red-600'}`}>
                      {branch.user.isActive ? t.active : t.inactive}
                    </p>
                  </div>
                  {user?.role === 'admin' && branch.user.password && (
                    <div>
                      <p className="text-sm text-gray-600 font-medium">{t.currentPassword}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-gray-800">{showPassword ? branch.user.password : '********'}</p>
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

// مكون رئيسي لتصدير المسارات
const Branches: React.FC = () => {
  return (
    <>
      <BranchesList />
      {/* يتم التعامل مع صفحة التفاصيل عبر التوجيه في ملف الـ Router */}
    </>
  );
};

export default Branches;

export { BranchProfile };