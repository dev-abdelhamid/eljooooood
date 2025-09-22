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
import { MapPin, Search, AlertCircle, Plus, Edit2, Trash2, Key, Eye, EyeOff, User } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';

interface Branch {
  _id: string;
  name: string;
  nameEn?: string;
  code: string;
  address: string;
  city: string;
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
    password?: string; // For admin view
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
    previous: 'السابق',
    next: 'التالي',
    page: 'صفحة',
    of: 'من',
    code: 'الكود',
    address: 'العنوان',
    city: 'المدينة',
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
    currentPassword: 'كلمة المرور الحالية',
    status: 'الحالة',
    active: 'نشط',
    inactive: 'غير نشط',
  },
  en: {
    // Same as before, no changes needed
  },
};

export const Branches: React.FC = () => {
  const { language } = useLanguage();
  const { user: loggedInUser } = useAuth();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
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
    phone: '',
    isActive: true,
    user: { name: '', nameEn: '', username: '', email: '', phone: '', password: '', isActive: true },
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
      const response = await branchesAPI.getAll({ page, limit: 10 });
      const fetchedBranches = Array.isArray(response.data) ? response.data : response;
      setBranches(fetchedBranches.map((branch: Branch) => ({
        ...branch,
        user: branch.user ? { ...branch.user, password: '********' } : undefined,
      })));
      setTotalPages(response.totalPages || Math.ceil(fetchedBranches.length / 10));
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

  const filteredBranches = branches.filter(
    (branch) =>
      (isRtl ? branch.name : branch.nameEn || branch.name)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      branch.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      branch.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.name) errors.name = t.nameRequired;
    if (!formData.nameEn) errors.nameEn = t.nameEnRequired;
    if (!formData.code) errors.code = t.codeRequired;
    if (!formData.address) errors.address = t.addressRequired;
    if (!formData.city) errors.city = t.cityRequired;
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

  const openProfileModal = (branch: Branch) => {
    setSelectedBranch(branch);
    setIsProfileModalOpen(true);
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

    try {
      const branchData = {
        name: formData.name.trim(),
        nameEn: formData.nameEn.trim(),
        code: formData.code.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
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
        const updatedBranch = await branchesAPI.update(selectedBranch._id, branchData);
        setBranches(branches.map((b) => (b._id === selectedBranch._id ? { ...updatedBranch, user: { ...updatedBranch.user, password: '********' } } : b)));
        toast.success(t.updated, { position: isRtl ? 'top-right' : 'top-left' });
      } else {
        const newBranch = await branchesAPI.create(branchData);
        setBranches([...branches, { ...newBranch, user: { ...newBranch.user, password: '********' } }]);
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
      await branchesAPI.resetBranchPassword(selectedBranch!._id, { password: resetPasswordData.password });
      setBranches(branches.map((b) => (b._id === selectedBranch!._id ? { ...b, user: { ...b.user, password: '********' } } : b)));
      setIsResetPasswordModalOpen(false);
      toast.success(t.passwordResetSuccess, { position: isRtl ? 'top-right' : 'top-left' });
    } catch (err: any) {
      setError(err.message || t.passwordResetError);
      toast.error(t.passwordResetError, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  const handleDelete = async () => {
    if (!selectedBranch) return;
    try {
      await branchesAPI.delete(selectedBranch._id);
      setBranches(branches.filter((b) => b._id !== selectedBranch._id));
      setIsDeleteModalOpen(false);
      toast.success(t.deleted, { position: isRtl ? 'top-right' : 'top-left' });
    } catch (err: any) {
      let errorMessage = t.deleteError;
      if (err.response?.data?.message === 'Cannot delete branch with associated orders or inventory') {
        errorMessage = t.deleteRestricted;
      }
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
          <MapPin className="w-5 h-5 text-amber-500" />
          {t.manage}
        </h1>
        {loggedInUser?.role === 'admin' && (
          <Button
            variant="primary"
            icon={Plus}
            onClick={openAddModal}
            className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-full px-4 py-2 shadow-md transition-all duration-300 hover:shadow-lg"
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
            className={`pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 transition-colors bg-white text-sm ${isRtl ? 'text-right' : 'text-left'}`}
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
        {filteredBranches.length === 0 ? (
          <Card className="p-6 text-center bg-white rounded-2xl shadow-sm col-span-full">
            <MapPin className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-800">{t.noBranches}</h3>
            <p className="text-gray-500 text-xs mt-2">
              {searchTerm ? t.noMatch : t.empty}
            </p>
            {loggedInUser?.role === 'admin' && !searchTerm && (
              <Button
                variant="primary"
                icon={Plus}
                onClick={openAddModal}
                className="mt-4 bg-amber-500 hover:bg-amber-600 text-white rounded-full px-4 py-2 text-sm shadow-md transition-all duration-300 hover:shadow-lg"
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
              <Card className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer" onClick={() => openProfileModal(branch)}>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm text-gray-800 truncate">{isRtl ? branch.name : branch.nameEn || branch.name}</h3>
                    <MapPin className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="text-gray-600 flex"><span className="w-16 font-medium">{t.code}:</span> <span className="truncate">{branch.code}</span></p>
                    <p className="text-gray-600 flex"><span className="w-16 font-medium">{t.address}:</span> <span className="truncate">{branch.address}</span></p>
                    <p className="text-gray-600 flex"><span className="w-16 font-medium">{t.city}:</span> <span>{branch.city}</span></p>
                    <p className="text-gray-600 flex"><span className="w-16 font-medium">{t.phone}:</span> <span>{branch.phone || '-'}</span></p>
                    <p className={`flex ${branch.isActive ? 'text-green-600' : 'text-red-600'}`}>
                      <span className="w-16 font-medium">{t.status}:</span> <span>{branch.isActive ? t.active : t.inactive}</span>
                    </p>
                  </div>
                  {loggedInUser?.role === 'admin' && (
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="outline"
                        icon={Edit2}
                        onClick={(e) => { e.stopPropagation(); openEditModal(branch); }}
                        className="text-amber-500 hover:text-amber-600 border-amber-500 rounded-full text-xs px-3 py-1"
                      >
                        {t.edit}
                      </Button>
                      <Button
                        variant="outline"
                        icon={Key}
                        onClick={(e) => { e.stopPropagation(); openResetPasswordModal(branch); }}
                        className="text-blue-500 hover:text-blue-600 border-blue-500 rounded-full text-xs px-3 py-1"
                      >
                        {t.resetPassword}
                      </Button>
                      <Button
                        variant="outline"
                        icon={Trash2}
                        onClick={(e) => { e.stopPropagation(); openDeleteModal(branch); }}
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
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
              <Input
                label={t.nameEn}
                value={formData.nameEn}
                onChange={(value) => setFormData({ ...formData, nameEn: value })}
                placeholder={t.nameEnPlaceholder}
                required
                error={formErrors.nameEn}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
              <Input
                label={t.code}
                value={formData.code}
                onChange={(value) => setFormData({ ...formData, code: value })}
                placeholder={t.codePlaceholder}
                required
                error={formErrors.code}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
              <Input
                label={t.address}
                value={formData.address}
                onChange={(value) => setFormData({ ...formData, address: value })}
                placeholder={t.addressPlaceholder}
                required
                error={formErrors.address}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
              <Input
                label={t.city}
                value={formData.city}
                onChange={(value) => setFormData({ ...formData, city: value })}
                placeholder={t.cityPlaceholder}
                required
                error={formErrors.city}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
              <Input
                label={t.phone}
                value={formData.phone}
                onChange={(value) => setFormData({ ...formData, phone: value })}
                placeholder={t.phonePlaceholder}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
              <Select
                label={t.status}
                options={[
                  { value: true, label: t.active },
                  { value: false, label: t.inactive },
                ]}
                value={formData.isActive}
                onChange={(value) => setFormData({ ...formData, isActive: value === 'true' })}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
            </div>
            <div className="space-y-4">
              <Input
                label={t.userName}
                value={formData.user.name}
                onChange={(value) => setFormData({ ...formData, user: { ...formData.user, name: value } })}
                placeholder={t.userNamePlaceholder}
                required={!isEditMode}
                error={formErrors.userName}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
              <Input
                label={t.userNameEn}
                value={formData.user.nameEn}
                onChange={(value) => setFormData({ ...formData, user: { ...formData.user, nameEn: value } })}
                placeholder={t.userNameEnPlaceholder}
                required={!isEditMode}
                error={formErrors.userNameEn}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
              <Input
                label={t.username}
                value={formData.user.username}
                onChange={(value) => setFormData({ ...formData, user: { ...formData.user, username: value } })}
                placeholder={t.usernamePlaceholder}
                required={!isEditMode}
                error={formErrors.username}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
              <Input
                label={t.email}
                value={formData.user.email}
                onChange={(value) => setFormData({ ...formData, user: { ...formData.user, email: value } })}
                placeholder={t.emailPlaceholder}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
              <Input
                label={t.userPhone}
                value={formData.user.phone}
                onChange={(value) => setFormData({ ...formData, user: { ...formData.user, phone: value } })}
                placeholder={t.userPhonePlaceholder}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
              <Select
                label={t.userStatus}
                options={[
                  { value: true, label: t.active },
                  { value: false, label: t.inactive },
                ]}
                value={formData.user.isActive}
                onChange={(value) => setFormData({ ...formData, user: { ...formData.user, isActive: value === 'true' } })}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
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
                  className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
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
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-full px-4 py-2 text-sm shadow-md transition-all duration-300 hover:shadow-lg"
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
        {selectedBranch && (
          <div className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-semibold text-gray-800">{isRtl ? selectedBranch.name : selectedBranch.nameEn || selectedBranch.name}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex flex-row items-center gap-2">
                <span className="w-20 font-medium text-gray-600">{t.code}:</span>
                <span className="text-gray-800 truncate">{selectedBranch.code}</span>
              </div>
              <div className="flex flex-row items-center gap-2">
                <span className="w-20 font-medium text-gray-600">{t.address}:</span>
                <span className="text-gray-800 truncate">{selectedBranch.address}</span>
              </div>
              <div className="flex flex-row items-center gap-2">
                <span className="w-20 font-medium text-gray-600">{t.city}:</span>
                <span className="text-gray-800">{selectedBranch.city}</span>
              </div>
              <div className="flex flex-row items-center gap-2">
                <span className="w-20 font-medium text-gray-600">{t.phone}:</span>
                <span className="text-gray-800">{selectedBranch.phone || '-'}</span>
              </div>
              <div className="flex flex-row items-center gap-2">
                <span className="w-20 font-medium text-gray-600">{t.status}:</span>
                <span className={`font-medium ${selectedBranch.isActive ? 'text-green-600' : 'text-red-600'}`}>
                  {selectedBranch.isActive ? t.active : t.inactive}
                </span>
              </div>
              <div className="flex flex-row items-center gap-2">
                <span className="w-20 font-medium text-gray-600">{t.createdAt}:</span>
                <span className="text-gray-800">{new Date(selectedBranch.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex flex-row items-center gap-2">
                <span className="w-20 font-medium text-gray-600">{t.updatedAt}:</span>
                <span className="text-gray-800">{new Date(selectedBranch.updatedAt).toLocaleString()}</span>
              </div>
              {selectedBranch.createdBy && (
                <div className="flex flex-row items-center gap-2">
                  <span className="w-20 font-medium text-gray-600">{t.createdBy}:</span>
                  <span className="text-gray-800">{isRtl ? selectedBranch.createdBy.name : selectedBranch.createdBy.nameEn || selectedBranch.createdBy.name}</span>
                </div>
              )}
              {selectedBranch.user && (
                <>
                  <div className="col-span-2 border-t pt-2 mt-2">
                    <h4 className="text-sm font-medium text-gray-600">{t.user}</h4>
                  </div>
                  <div className="flex flex-row items-center gap-2">
                    <span className="w-20 font-medium text-gray-600">{t.username}:</span>
                    <span className="text-gray-800">{selectedBranch.user.username}</span>
                  </div>
                  <div className="flex flex-row items-center gap-2">
                    <span className="w-20 font-medium text-gray-600">{t.email}:</span>
                    <span className="text-gray-800">{selectedBranch.user.email || '-'}</span>
                  </div>
                  <div className="flex flex-row items-center gap-2">
                    <span className="w-20 font-medium text-gray-600">{t.userPhone}:</span>
                    <span className="text-gray-800">{selectedBranch.user.phone || '-'}</span>
                  </div>
                  <div className="flex flex-row items-center gap-2">
                    <span className="w-20 font-medium text-gray-600">{t.userStatus}:</span>
                    <span className={`font-medium ${selectedBranch.user.isActive ? 'text-green-600' : 'text-red-600'}`}>
                      {selectedBranch.user.isActive ? t.active : t.inactive}
                    </span>
                  </div>
                  {loggedInUser?.role === 'admin' && (
                    <div className="flex flex-row items-center gap-2">
                      <span className="w-20 font-medium text-gray-600">{t.currentPassword}:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-800">{showPassword[selectedBranch._id] ? selectedBranch.user.password : '********'}</span>
                        <button type="button" onClick={() => togglePasswordVisibility(selectedBranch._id)} className="text-gray-500 hover:text-gray-700">
                          {showPassword[selectedBranch._id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </>
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
            className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
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
            className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
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
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-full px-4 py-2 text-sm shadow-md transition-all duration-300 hover:shadow-lg"
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
};

export default Branches;