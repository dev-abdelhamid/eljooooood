import React, { useState, useEffect, useCallback, useMemo, useReducer } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { branchesAPI } from '../services/api';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Edit2, Trash2, Key, AlertCircle, MapPin } from 'lucide-react';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Modal } from '../components/UI/Modal';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';

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
  user?: {
    _id: string;
    name: string;
    nameEn?: string;
    username: string;
    email?: string;
    phone?: string;
    isActive: boolean;
    displayName: string;
  };
  createdBy?: {
    _id: string;
    name: string;
    nameEn?: string;
    username: string;
    displayName: string;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  displayName: string;
  displayAddress: string;
  displayCity: string;
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
    isActive: boolean;
  };
}

type FormAction =
  | { type: 'UPDATE_FIELD'; field: keyof FormState; value: any }
  | { type: 'UPDATE_USER_FIELD'; field: keyof FormState['user']; value: any }
  | { type: 'RESET'; data: Branch };

const formReducer = (state: FormState, action: FormAction): FormState => {
  switch (action.type) {
    case 'UPDATE_FIELD':
      return { ...state, [action.field]: action.value };
    case 'UPDATE_USER_FIELD':
      return { ...state, user: { ...state.user, [action.field]: action.value } };
    case 'RESET':
      return {
        name: action.data.name || '',
        nameEn: action.data.nameEn || '',
        code: action.data.code || '',
        address: action.data.address || '',
        addressEn: action.data.addressEn || '',
        city: action.data.city || '',
        cityEn: action.data.cityEn || '',
        phone: action.data.phone || '',
        isActive: action.data.isActive ?? true,
        user: {
          name: action.data.user?.name || '',
          nameEn: action.data.user?.nameEn || '',
          username: action.data.user?.username || '',
          email: action.data.user?.email || '',
          phone: action.data.user?.phone || '',
          isActive: action.data.user?.isActive ?? true,
        },
      };
    default:
      return state;
  }
};

const translations = {
  ar: {
    branchDetails: 'تفاصيل الفرع',
    name: 'اسم الفرع (عربي)',
    nameEn: 'اسم الفرع (إنجليزي)',
    code: 'الكود',
    address: 'العنوان',
    addressEn: 'العنوان (إنجليزي)',
    city: 'المدينة',
    cityEn: 'المدينة (إنجليزي)',
    phone: 'رقم الهاتف',
    user: 'المستخدم',
    userName: 'اسم المستخدم (عربي)',
    userNameEn: 'اسم المستخدم (إنجليزي)',
    username: 'اسم المستخدم',
    email: 'الإيميل',
    userPhone: 'هاتف المستخدم',
    userStatus: 'حالة المستخدم',
    isActive: 'الحالة',
    active: 'نشط',
    inactive: 'غير نشط',
    createdBy: 'تم الإنشاء بواسطة',
    createdAt: 'تاريخ الإنشاء',
    updatedAt: 'تاريخ التحديث',
    editBranch: 'تعديل الفرع',
    deleteBranch: 'حذف الفرع',
    resetPassword: 'إعادة تعيين كلمة المرور',
    save: 'حفظ',
    cancel: 'إلغاء',
    back: 'رجوع',
    newPassword: 'كلمة المرور الجديدة',
    confirmPassword: 'تأكيد كلمة المرور',
    passwordMismatch: 'كلمة المرور وتأكيدها غير متطابقتين',
    passwordTooShort: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
    passwordRequired: 'كلمة المرور مطلوبة',
    branchNotFound: 'الفرع غير موجود',
    serverError: 'خطأ في السيرفر',
    branchUpdated: 'تم تحديث الفرع بنجاح',
    branchDeleted: 'تم حذف الفرع بنجاح',
    passwordReset: 'تم إعادة تعيين كلمة المرور بنجاح',
    emailInUse: 'الإيميل مستخدم بالفعل، اختر إيميل آخر',
    usernameInUse: 'اسم المستخدم مستخدم بالفعل، اختر اسمًا آخر',
    codeInUse: 'كود الفرع مستخدم بالفعل، اختر كودًا آخر',
    requiredField: 'هذا الحقل مطلوب',
    deleteWarning: 'هل أنت متأكد من حذف هذا الفرع؟ لا يمكن التراجع عن هذا الإجراء.',
    deleteRestricted: 'لا يمكن حذف الفرع لوجود طلبات أو مخزون مرتبط',
    confirmDelete: 'تأكيد حذف الفرع',
  },
  en: {
    branchDetails: 'Branch Details',
    name: 'Branch Name (Arabic)',
    nameEn: 'Branch Name (English)',
    code: 'Code',
    address: 'Address',
    addressEn: 'Address (English)',
    city: 'City',
    cityEn: 'City (English)',
    phone: 'Phone',
    user: 'User',
    userName: 'User Name (Arabic)',
    userNameEn: 'User Name (English)',
    username: 'Username',
    email: 'Email',
    userPhone: 'User Phone',
    userStatus: 'User Status',
    isActive: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    createdBy: 'Created By',
    createdAt: 'Created At',
    updatedAt: 'Updated At',
    editBranch: 'Edit Branch',
    deleteBranch: 'Delete Branch',
    resetPassword: 'Reset Password',
    save: 'Save',
    cancel: 'Cancel',
    back: 'Back',
    newPassword: 'New Password',
    confirmPassword: 'Confirm Password',
    passwordMismatch: 'Passwords do not match',
    passwordTooShort: 'Password must be at least 6 characters',
    passwordRequired: 'Password is required',
    branchNotFound: 'Branch not found',
    serverError: 'Server error',
    branchUpdated: 'Branch updated successfully',
    branchDeleted: 'Branch deleted successfully',
    passwordReset: 'Password reset successfully',
    emailInUse: 'Email is already in use, choose another',
    usernameInUse: 'Username is already in use, choose another',
    codeInUse: 'Branch code is already in use, choose another',
    requiredField: 'This field is required',
    deleteWarning: 'Are you sure you want to delete this branch? This action cannot be undone.',
    deleteRestricted: 'Cannot delete branch with associated orders or inventory',
    confirmDelete: 'Confirm Branch Deletion',
  },
};

export const BranchProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];

  const [branch, setBranch] = useState<Branch | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [passwordData, setPasswordData] = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    user: {
      name: '',
      nameEn: '',
      username: '',
      email: '',
      phone: '',
      isActive: true,
    },
  });

  const fetchBranch = useCallback(async () => {
    if (!id) {
      toast.error(t.branchNotFound, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    try {
      setLoading(true);
      const response = await branchesAPI.getById(id);
      const data = {
        ...response,
        displayName: isRtl ? response.name : response.nameEn || response.name,
        displayAddress: isRtl ? response.address : response.addressEn || response.address,
        displayCity: isRtl ? response.city : response.cityEn || response.city,
        user: response.user
          ? {
              ...response.user,
              displayName: isRtl ? response.user.name : response.user.nameEn || response.user.name,
            }
          : undefined,
        createdBy: response.createdBy
          ? {
              ...response.createdBy,
              displayName: isRtl ? response.createdBy.name : response.createdBy.nameEn || response.createdBy.name,
            }
          : undefined,
      };
      setBranch(data);
      dispatchForm({ type: 'RESET', data });
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Fetch branch error:`, err);
      setError(err.response?.data?.message || t.branchNotFound);
      toast.error(t.branchNotFound, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setLoading(false);
    }
  }, [id, isRtl, t]);

  useEffect(() => {
    fetchBranch();
  }, [fetchBranch]);

  const checkEmailAvailability = useCallback(async (email: string) => {
    try {
      const response = await branchesAPI.checkEmail(email);
      return response.available;
    } catch {
      return false;
    }
  }, []);

  const validateForm = useCallback(async () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.name.trim()) newErrors.name = t.requiredField;
    if (!formData.nameEn.trim()) newErrors.nameEn = t.requiredField;
    if (!formData.code.trim()) newErrors.code = t.requiredField;
    if (!formData.address.trim()) newErrors.address = t.requiredField;
    if (!formData.addressEn.trim()) newErrors.addressEn = t.requiredField;
    if (!formData.city.trim()) newErrors.city = t.requiredField;
    if (!formData.cityEn.trim()) newErrors.cityEn = t.requiredField;
    if (!formData.user.name.trim()) newErrors['user.name'] = t.requiredField;
    if (!formData.user.nameEn.trim()) newErrors['user.nameEn'] = t.requiredField;
    if (!formData.user.username.trim()) newErrors['user.username'] = t.requiredField;
    if (formData.user.email.trim()) {
      const isEmailAvailable = await checkEmailAvailability(formData.user.email);
      if (!isEmailAvailable && formData.user.email !== branch?.user?.email) {
        newErrors['user.email'] = t.emailInUse;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, checkEmailAvailability, t, branch]);

  const handleInputChange = useCallback(
    (value: string | boolean, field: string, isUserField: boolean = false) => {
      if (isUserField) {
        dispatchForm({ type: 'UPDATE_USER_FIELD', field: field as keyof FormState['user'], value });
        setErrors((prev) => ({ ...prev, [`user.${field}`]: '' }));
      } else {
        dispatchForm({ type: 'UPDATE_FIELD', field: field as keyof FormState, value });
        setErrors((prev) => ({ ...prev, [field]: '' }));
      }
    },
    []
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!(await validateForm())) {
        toast.error(t.requiredField, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      try {
        setLoading(true);
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
          user: {
            name: formData.user.name.trim(),
            nameEn: formData.user.nameEn.trim() || undefined,
            username: formData.user.username.trim(),
            email: formData.user.email.trim() || undefined,
            phone: formData.user.phone.trim() || undefined,
            isActive: formData.user.isActive,
          },
        };
        await branchesAPI.update(id!, branchData);
        setBranch((prev) =>
          prev
            ? {
                ...prev,
                ...branchData,
                displayName: isRtl ? branchData.name : branchData.nameEn || branchData.name,
                displayAddress: isRtl ? branchData.address : branchData.addressEn || branchData.address,
                displayCity: isRtl ? branchData.city : branchData.cityEn || branchData.city,
                user: {
                  ...prev.user,
                  ...branchData.user,
                  displayName: isRtl ? branchData.user.name : branchData.user.nameEn || branchData.user.name,
                },
              }
            : null
        );
        toast.success(t.branchUpdated, { position: isRtl ? 'top-right' : 'top-left' });
        setIsEditModalOpen(false);
        setError('');
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Update branch error:`, err);
        let errorMessage = t.serverError;
        if (err.response?.data?.message) {
          const message = err.response.data.message;
          errorMessage =
            message === 'Branch code already exists'
              ? t.codeInUse
              : message === 'Username already exists'
              ? t.usernameInUse
              : message.includes('الإيميل') || message.includes('email')
              ? t.emailInUse
              : message;
        }
        setError(errorMessage);
        toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
      } finally {
        setLoading(false);
      }
    },
    [formData, id, isRtl, t]
  );

  const handleResetPassword = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!passwordData.password || !passwordData.confirmPassword) {
        setError(t.passwordRequired);
        toast.error(t.passwordRequired, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      if (passwordData.password !== passwordData.confirmPassword) {
        setError(t.passwordMismatch);
        toast.error(t.passwordMismatch, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      if (passwordData.password.length < 6) {
        setError(t.passwordTooShort);
        toast.error(t.passwordTooShort, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      try {
        setLoading(true);
        await branchesAPI.resetPassword(id!, passwordData.password);
        toast.success(t.passwordReset, { position: isRtl ? 'top-right' : 'top-left' });
        setIsResetPasswordModalOpen(false);
        setPasswordData({ password: '', confirmPassword: '' });
        setError('');
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Reset password error:`, err);
        const errorMessage = err.response?.data?.message || t.serverError;
        setError(errorMessage);
        toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
      } finally {
        setLoading(false);
      }
    },
    [passwordData, id, t, isRtl]
  );

  const handleDelete = useCallback(async () => {
    try {
      setLoading(true);
      await branchesAPI.delete(id!);
      toast.success(t.branchDeleted, { position: isRtl ? 'top-right' : 'top-left' });
      navigate('/branches');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Delete branch error:`, err);
      let errorMessage = t.serverError;
      if (err.response?.data?.message) {
        errorMessage =
          err.response.data.message === 'Cannot delete branch with associated orders or inventory'
            ? t.deleteRestricted
            : err.response.data.message;
      }
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setLoading(false);
    }
  }, [id, navigate, t, isRtl]);

  const openEditModal = useCallback(() => {
    if (branch) {
      dispatchForm({ type: 'RESET', data: branch });
      setIsEditModalOpen(true);
      setErrors({});
      setError('');
    }
  }, [branch]);

  const openResetPasswordModal = useCallback(() => {
    setPasswordData({ password: '', confirmPassword: '' });
    setIsResetPasswordModalOpen(true);
    setError('');
  }, []);

  const openDeleteModal = useCallback(() => {
    setIsDeleteModalOpen(true);
    setError('');
  }, []);

  const branchDetails = useMemo(
    () => [
      { label: t.name, value: branch?.name },
      { label: t.nameEn, value: branch?.nameEn || branch?.name },
      { label: t.code, value: branch?.code },
      { label: t.address, value: branch?.displayAddress },
      { label: t.addressEn, value: branch?.addressEn || branch?.address },
      { label: t.city, value: branch?.displayCity },
      { label: t.cityEn, value: branch?.cityEn || branch?.city },
      { label: t.phone, value: branch?.phone || '-' },
      {
        label: t.isActive,
        value: branch?.isActive ? t.active : t.inactive,
        className: branch?.isActive ? 'text-green-600' : 'text-red-600',
      },
      { label: t.createdAt, value: branch ? new Date(branch.createdAt).toLocaleString() : '-' },
      { label: t.updatedAt, value: branch ? new Date(branch.updatedAt).toLocaleString() : '-' },
      { label: t.createdBy, value: branch?.createdBy?.displayName || '-' },
    ],
    [branch, t]
  );

  const userDetails = useMemo(
    () =>
      branch?.user
        ? [
            { label: t.userName, value: branch.user.displayName },
            { label: t.userNameEn, value: branch.user.nameEn || branch.user.name },
            { label: t.username, value: branch.user.username },
            { label: t.email, value: branch.user.email || '-' },
            { label: t.userPhone, value: branch.user.phone || '-' },
            {
              label: t.userStatus,
              value: branch.user.isActive ? t.active : t.inactive,
              className: branch.user.isActive ? 'text-green-600' : 'text-red-600',
            },
          ]
        : [],
    [branch, t]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!branch) {
    return (
      <div className={`mx-auto p-4 sm:p-6 min-h-screen bg-gray-50 ${isRtl ? 'rtl font-arabic' : 'ltr font-sans'}`}>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-2xl font-semibold text-amber-900">{t.branchNotFound}</h2>
          <Button
            variant="primary"
            icon={ArrowLeft}
            onClick={() => navigate('/branches')}
            className="mt-4 bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-6 py-3 shadow-md transition-transform transform hover:scale-105"
          >
            {t.back}
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`mx-auto max-w-7xl p-4 sm:p-6 min-h-screen bg-gray-50 ${isRtl ? 'rtl font-arabic' : 'ltr font-sans'}`}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4"
      >
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            icon={ArrowLeft}
            onClick={() => navigate('/branches')}
            className="bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-lg px-4 py-2 transition-transform transform hover:scale-105"
          >
            {t.back}
          </Button>
          <h1 className="text-3xl sm:text-4xl font-bold text-amber-900 flex items-center gap-2">
            <MapPin className="w-8 h-8 text-amber-600" />
            {branch.displayName}
          </h1>
        </div>
        {user?.role === 'admin' && (
          <div className="flex gap-3">
            <Button
              variant="outline"
              icon={Edit2}
              onClick={openEditModal}
              className="text-amber-600 hover:text-amber-800 border-amber-600 rounded-lg px-4 py-2 transition-transform transform hover:scale-105"
            >
              {t.editBranch}
            </Button>
            <Button
              variant="outline"
              icon={Key}
              onClick={openResetPasswordModal}
              className="text-blue-500 hover:text-blue-700 border-blue-500 rounded-lg px-4 py-2 transition-transform transform hover:scale-105"
            >
              {t.resetPassword}
            </Button>
            <Button
              variant="outline"
              icon={Trash2}
              onClick={openDeleteModal}
              className="text-red-500 hover:text-red-700 border-red-500 rounded-lg px-4 py-2 transition-transform transform hover:scale-105"
            >
              {t.deleteBranch}
            </Button>
          </div>
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
      <Card className="p-6 bg-white rounded-lg shadow-md">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          <div>
            <h3 className="text-lg font-semibold text-amber-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-600" />
              {t.branchDetails}
            </h3>
            <div className="space-y-4">
              {branchDetails.map((detail, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <p className="text-sm text-gray-600 font-medium">{detail.label}</p>
                  <p className={`text-gray-800 ${detail.className || ''}`}>{detail.value}</p>
                </motion.div>
              ))}
            </div>
          </div>
          {branch.user && (
            <div>
              <h3 className="text-lg font-semibold text-amber-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-amber-600" />
                {t.user}
              </h3>
              <div className="space-y-4">
                {userDetails.map((detail, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <p className="text-sm text-gray-600 font-medium">{detail.label}</p>
                    <p className={`text-gray-800 ${detail.className || ''}`}>{detail.value}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </Card>
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={t.editBranch}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-amber-900">{t.branchDetails}</h3>
              <Input
                label={t.name}
                value={formData.name}
                onChange={(value) => handleInputChange(value, 'name')}
                placeholder={t.name}
                required
                error={errors.name}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t.nameEn}
                value={formData.nameEn}
                onChange={(value) => handleInputChange(value, 'nameEn')}
                placeholder={t.nameEn}
                required
                error={errors.nameEn}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t.code}
                value={formData.code}
                onChange={(value) => handleInputChange(value, 'code')}
                placeholder={t.code}
                required
                error={errors.code}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t.address}
                value={formData.address}
                onChange={(value) => handleInputChange(value, 'address')}
                placeholder={t.address}
                required
                error={errors.address}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t.addressEn}
                value={formData.addressEn}
                onChange={(value) => handleInputChange(value, 'addressEn')}
                placeholder={t.addressEn}
                required
                error={errors.addressEn}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t.city}
                value={formData.city}
                onChange={(value) => handleInputChange(value, 'city')}
                placeholder={t.city}
                required
                error={errors.city}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t.cityEn}
                value={formData.cityEn}
                onChange={(value) => handleInputChange(value, 'cityEn')}
                placeholder={t.cityEn}
                required
                error={errors.cityEn}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t.phone}
                value={formData.phone}
                onChange={(value) => handleInputChange(value, 'phone')}
                placeholder={t.phone}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Select
                label={t.isActive}
                options={[
                  { value: true, label: t.active },
                  { value: false, label: t.inactive },
                ]}
                value={formData.isActive}
                onChange={(value) => handleInputChange(value === 'true', 'isActive')}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
            </div>
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-amber-900">{t.user}</h3>
              <Input
                label={t.userName}
                value={formData.user.name}
                onChange={(value) => handleInputChange(value, 'name', true)}
                placeholder={t.userName}
                required
                error={errors['user.name']}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t.userNameEn}
                value={formData.user.nameEn}
                onChange={(value) => handleInputChange(value, 'nameEn', true)}
                placeholder={t.userNameEn}
                required
                error={errors['user.nameEn']}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t.username}
                value={formData.user.username}
                onChange={(value) => handleInputChange(value, 'username', true)}
                placeholder={t.username}
                required
                error={errors['user.username']}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t.email}
                value={formData.user.email}
                onChange={(value) => handleInputChange(value, 'email', true)}
                placeholder={t.email}
                error={errors['user.email']}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t.userPhone}
                value={formData.user.phone}
                onChange={(value) => handleInputChange(value, 'phone', true)}
                placeholder={t.userPhone}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Select
                label={t.userStatus}
                options=[
                  { value: true, label: t.active },
                  { value: false, label: t.inactive },
                ]
                value={formData.user.isActive}
                onChange={(value) => handleInputChange(value === 'true', 'isActive', true)}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
            </div>
          </motion.div>
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 bg-red-100 border border-red-300 rounded-lg flex items-center gap-3 shadow-sm"
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
              disabled={loading}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-6 py-3 shadow-md transition-transform transform hover:scale-105 disabled:opacity-50"
            >
              {t.save}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsEditModalOpen(false)}
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
              value={passwordData.password}
              onChange={(value) => setPasswordData({ ...passwordData, password: value })}
              placeholder={t.newPassword}
              type="password"
              required
              className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
            />
            <Input
              label={t.confirmPassword}
              value={passwordData.confirmPassword}
              onChange={(value) => setPasswordData({ ...passwordData, confirmPassword: value })}
              placeholder={t.confirmPassword}
              type="password"
              required
              className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
            />
          </motion.div>
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 bg-red-100 border border-red-300 rounded-lg flex items-center gap-3 shadow-sm"
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
              disabled={loading}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-6 py-3 shadow-md transition-transform transform hover:scale-105 disabled:opacity-50"
            >
              {t.save}
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
                className="p-4 bg-red-100 border border-red-300 rounded-lg flex items-center gap-3 shadow-sm"
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
              disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg px-6 py-3 shadow-md transition-transform transform hover:scale-105 disabled:opacity-50"
            >
              {t.deleteBranch}
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

export default BranchProfile;