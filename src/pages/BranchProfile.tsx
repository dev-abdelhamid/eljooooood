import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { branchesAPI } from '../services/api';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Edit2, Trash2, Key, AlertCircle } from 'lucide-react';
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

const BranchProfile: React.FC = () => {
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
  const [formData, setFormData] = useState({
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
  const [passwordData, setPasswordData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchBranch = async () => {
      if (!id) {
        toast.error(t.branchNotFound, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      try {
        setLoading(true);
        const response = await branchesAPI.getById(id, { isRtl });
        setBranch(response.data);
        setFormData({
          name: response.data.name || '',
          nameEn: response.data.nameEn || '',
          code: response.data.code || '',
          address: response.data.address || '',
          addressEn: response.data.addressEn || '',
          city: response.data.city || '',
          cityEn: response.data.cityEn || '',
          phone: response.data.phone || '',
          isActive: response.data.isActive ?? true,
          user: {
            name: response.data.user?.name || '',
            nameEn: response.data.user?.nameEn || '',
            username: response.data.user?.username || '',
            email: response.data.user?.email || '',
            phone: response.data.user?.phone || '',
            isActive: response.data.user?.isActive ?? true,
          },
        });
        setError('');
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Fetch branch error:`, err);
        setError(err.response?.data?.message || t.branchNotFound);
        toast.error(t.branchNotFound, { position: isRtl ? 'top-right' : 'top-left' });
      } finally {
        setLoading(false);
      }
    };
    fetchBranch();
  }, [id, isRtl, t]);

  const checkEmailAvailability = async (email: string) => {
    try {
      const response = await branchesAPI.checkEmail(email);
      return response.data.available;
    } catch {
      return false;
    }
  };

  const validateForm = async () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.name.trim()) newErrors.name = t.requiredField;
    if (!formData.code.trim()) newErrors.code = t.requiredField;
    if (!formData.address.trim()) newErrors.address = t.requiredField;
    if (!formData.city.trim()) newErrors.city = t.requiredField;
    if (!formData.user.name.trim()) newErrors['user.name'] = t.requiredField;
    if (!formData.user.username.trim()) newErrors['user.username'] = t.requiredField;

    if (formData.user.email.trim()) {
      const isEmailAvailable = await checkEmailAvailability(formData.user.email);
      if (!isEmailAvailable) newErrors['user.email'] = t.emailInUse;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    field: string,
    isUserField: boolean = false
  ) => {
    const { value, type, checked } = e.target;
    if (isUserField) {
      setFormData((prev) => ({
        ...prev,
        user: { ...prev.user, [field]: type === 'checkbox' ? checked : value },
      }));
      setErrors((prev) => ({ ...prev, [`user.${field}`]: '' }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: type === 'checkbox' ? checked : value }));
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
      const response = await branchesAPI.update(id!, branchData, { isRtl });
      setBranch(response.data);
      setIsEditModalOpen(false);
      setErrors({});
      setError('');
      toast.success(t.branchUpdated, { position: isRtl ? 'top-right' : 'top-left' });
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Update branch error:`, err);
      let errorMessage = t.serverError;
      if (err.response?.data?.message) {
        const message = err.response.data.message;
        if (message.includes('اسم المستخدم') || message.includes('Username')) {
          setErrors({ 'user.username': t.usernameInUse });
          errorMessage = t.usernameInUse;
        } else if (message.includes('الإيميل') || message.includes('Email')) {
          setErrors({ 'user.email': t.emailInUse });
          errorMessage = t.emailInUse;
        } else if (message.includes('كود الفرع') || message.includes('Branch code')) {
          setErrors({ code: t.codeInUse });
          errorMessage = t.codeInUse;
        } else {
          errorMessage = message;
        }
      }
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
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
      await branchesAPI.resetPassword(id!, passwordData.password, { isRtl });
      setIsResetPasswordModalOpen(false);
      setPasswordData({ password: '', confirmPassword: '' });
      setError('');
      toast.success(t.passwordReset, { position: isRtl ? 'top-right' : 'top-left' });
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Reset password error:`, err);
      const errorMessage = err.response?.data?.message || t.serverError;
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      await branchesAPI.delete(id!);
      setIsDeleteModalOpen(false);
      toast.success(t.branchDeleted, { position: isRtl ? 'top-right' : 'top-left' });
      navigate('/branches');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Delete branch error:`, err);
      let errorMessage = t.deleteError;
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message.includes('طلبات أو مخزون') || err.response.data.message.includes('orders or inventory') ?
          t.deleteRestricted : err.response.data.message;
      }
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Card className="p-6 text-center bg-white rounded-2xl shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800">{t.branchNotFound}</h3>
        </Card>
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
          <User className="w-5 h-5 text-amber-500" />
          {t.branchDetails}
        </h1>
        <Button
          variant="outline"
          icon={ArrowLeft}
          onClick={() => navigate('/branches')}
          className="bg-white text-gray-600 hover:text-amber-600 border-gray-200 rounded-full px-4 py-2 text-sm shadow-md transition-all duration-300 hover:shadow-lg"
        >
          {t.back}
        </Button>
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

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="p-4 sm:p-6 bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <span className="block text-xs font-medium text-gray-600">{t.name}</span>
                <p className="text-sm text-gray-800">{isRtl ? branch.name : branch.displayName}</p>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-600">{t.nameEn}</span>
                <p className="text-sm text-gray-800">{branch.nameEn || branch.name}</p>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-600">{t.code}</span>
                <p className="text-sm text-gray-800">{branch.code}</p>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-600">{t.address}</span>
                <p className="text-sm text-gray-800">{isRtl ? branch.address : branch.displayAddress}</p>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-600">{t.addressEn}</span>
                <p className="text-sm text-gray-800">{branch.addressEn || branch.address}</p>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-600">{t.city}</span>
                <p className="text-sm text-gray-800">{isRtl ? branch.city : branch.displayCity}</p>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-600">{t.cityEn}</span>
                <p className="text-sm text-gray-800">{branch.cityEn || branch.city}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <span className="block text-xs font-medium text-gray-600">{t.phone}</span>
                <p className="text-sm text-gray-800">{branch.phone || '-'}</p>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-600">{t.user}</span>
                <p className="text-sm text-gray-800">{branch.user ? (isRtl ? branch.user.name : branch.user.displayName) : '-'}</p>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-600">{t.username}</span>
                <p className="text-sm text-gray-800">{branch.user?.username || '-'}</p>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-600">{t.email}</span>
                <p className="text-sm text-gray-800">{branch.user?.email || '-'}</p>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-600">{t.userPhone}</span>
                <p className="text-sm text-gray-800">{branch.user?.phone || '-'}</p>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-600">{t.userStatus}</span>
                <p className={`text-sm ${branch.user?.isActive ? 'text-green-600' : 'text-red-600'}`}>
                  {branch.user?.isActive ? t.active : t.inactive}
                </p>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-600">{t.createdBy}</span>
                <p className="text-sm text-gray-800">{branch.createdBy ? (isRtl ? branch.createdBy.name : branch.createdBy.displayName) : '-'}</p>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-600">{t.createdAt}</span>
                <p className="text-sm text-gray-800">{new Date(branch.createdAt).toLocaleString(language)}</p>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-600">{t.updatedAt}</span>
                <p className="text-sm text-gray-800">{new Date(branch.updatedAt).toLocaleString(language)}</p>
              </div>
            </div>
          </div>
          {user?.role === 'admin' && (
            <div className="flex flex-wrap gap-3 mt-6">
              <Button
                variant="outline"
                icon={Edit2}
                onClick={() => setIsEditModalOpen(true)}
                className="flex-1 text-amber-500 hover:text-amber-600 border-amber-500 rounded-full text-xs px-4 py-2 shadow-md transition-all duration-300 hover:shadow-lg"
              >
                {t.editBranch}
              </Button>
              <Button
                variant="outline"
                icon={Trash2}
                onClick={() => setIsDeleteModalOpen(true)}
                className="flex-1 text-red-500 hover:text-red-600 border-red-500 rounded-full text-xs px-4 py-2 shadow-md transition-all duration-300 hover:shadow-lg"
              >
                {t.deleteBranch}
              </Button>
              {branch.user && (
                <Button
                  variant="outline"
                  icon={Key}
                  onClick={() => setIsResetPasswordModalOpen(true)}
                  className="flex-1 text-blue-500 hover:text-blue-600 border-blue-500 rounded-full text-xs px-4 py-2 shadow-md transition-all duration-300 hover:shadow-lg"
                >
                  {t.resetPassword}
                </Button>
              )}
            </div>
          )}
        </Card>
      </motion.div>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={t.editBranch}
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
              <h3 className="text-sm font-semibold text-gray-800">{t.branchDetails}</h3>
              <Input
                label={t.name}
                value={formData.name}
                onChange={(value) => handleInputChange({ target: { value, name: 'name' } } as any, 'name')}
                placeholder={t.name}
                required
                error={errors.name}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
              <Input
                label={t.nameEn}
                value={formData.nameEn}
                onChange={(value) => handleInputChange({ target: { value, name: 'nameEn' } } as any, 'nameEn')}
                placeholder={t.nameEn}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
              <Input
                label={t.code}
                value={formData.code}
                onChange={(value) => handleInputChange({ target: { value, name: 'code' } } as any, 'code')}
                placeholder={t.code}
                required
                error={errors.code}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
              <Input
                label={t.address}
                value={formData.address}
                onChange={(value) => handleInputChange({ target: { value, name: 'address' } } as any, 'address')}
                placeholder={t.address}
                required
                error={errors.address}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
              <Input
                label={t.addressEn}
                value={formData.addressEn}
                onChange={(value) => handleInputChange({ target: { value, name: 'addressEn' } } as any, 'addressEn')}
                placeholder={t.addressEn}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
              <Input
                label={t.city}
                value={formData.city}
                onChange={(value) => handleInputChange({ target: { value, name: 'city' } } as any, 'city')}
                placeholder={t.city}
                required
                error={errors.city}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
              <Input
                label={t.cityEn}
                value={formData.cityEn}
                onChange={(value) => handleInputChange({ target: { value, name: 'cityEn' } } as any, 'cityEn')}
                placeholder={t.cityEn}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
              <Input
                label={t.phone}
                value={formData.phone}
                onChange={(value) => handleInputChange({ target: { value, name: 'phone' } } as any, 'phone')}
                placeholder={t.phone}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
              <Select
                label={t.isActive}
                options={[
                  { value: true, label: t.active },
                  { value: false, label: t.inactive },
                ]}
                value={formData.isActive}
                onChange={(value) => handleInputChange({ target: { value: value.toString(), name: 'isActive' } } as any, 'isActive')}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
            </div>
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-800">{t.user}</h3>
              <Input
                label={t.userName}
                value={formData.user.name}
                onChange={(value) => handleInputChange({ target: { value, name: 'user.name' } } as any, 'name', true)}
                placeholder={t.userName}
                required
                error={errors['user.name']}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
              <Input
                label={t.userNameEn}
                value={formData.user.nameEn}
                onChange={(value) => handleInputChange({ target: { value, name: 'user.nameEn' } } as any, 'nameEn', true)}
                placeholder={t.userNameEn}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
              <Input
                label={t.username}
                value={formData.user.username}
                onChange={(value) => handleInputChange({ target: { value, name: 'user.username' } } as any, 'username', true)}
                placeholder={t.username}
                required
                error={errors['user.username']}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
              <Input
                label={t.email}
                value={formData.user.email}
                onChange={(value) => handleInputChange({ target: { value, name: 'user.email' } } as any, 'email', true)}
                placeholder={t.email}
                error={errors['user.email']}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
              <Input
                label={t.userPhone}
                value={formData.user.phone}
                onChange={(value) => handleInputChange({ target: { value, name: 'user.phone' } } as any, 'phone', true)}
                placeholder={t.userPhone}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
              <Select
                label={t.userStatus}
                options={[
                  { value: true, label: t.active },
                  { value: false, label: t.inactive },
                ]}
                value={formData.user.isActive}
                onChange={(value) => handleInputChange({ target: { value: value.toString(), name: 'user.isActive' } } as any, 'isActive', true)}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
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
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-full px-4 py-2 text-sm shadow-md transition-all duration-300 hover:shadow-lg"
              disabled={loading}
            >
              {t.save}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsEditModalOpen(false)}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full px-4 py-2 text-sm shadow-md transition-all duration-300 hover:shadow-lg"
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
        <form onSubmit={handleResetPassword} className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <Input
              label={t.newPassword}
              value={passwordData.password}
              onChange={(value) => setPasswordData({ ...passwordData, password: value })}
              placeholder={t.newPassword}
              type="password"
              required
              className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
            />
            <Input
              label={t.confirmPassword}
              value={passwordData.confirmPassword}
              onChange={(value) => setPasswordData({ ...passwordData, confirmPassword: value })}
              placeholder={t.confirmPassword}
              type="password"
              required
              className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
            />
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
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-full px-4 py-2 text-sm shadow-md transition-all duration-300 hover:shadow-lg"
              disabled={loading}
            >
              {t.resetPassword}
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
              type="button"
              variant="danger"
              onClick={handleDelete}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-full px-4 py-2 text-sm shadow-md transition-all duration-300 hover:shadow-lg"
              disabled={loading}
            >
              {t.deleteBranch}
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
};

export default BranchProfile;
