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
import { MapPin, Search, AlertCircle, Plus, Edit2, Trash2, ChevronDown, Key } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';

interface Branch {
  _id: string;
  name: string;
  nameEn?: string;
  displayName: string;
  code: string;
  address: string;
  city: string;
  phone?: string;
  isActive: boolean;
  user?: {
    _id: string;
    name: string;
    nameEn?: string;
    displayName: string;
    username: string;
    email?: string;
    phone?: string;
    isActive: boolean;
    branch: string;
  };
  createdBy?: {
    _id: string;
    name: string;
    nameEn?: string;
    displayName: string;
    username: string;
  };
}

export function Branches() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [resetPasswordData, setResetPasswordData] = useState({ password: '', confirmPassword: '' });

  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    code: '',
    address: '',
    city: '',
    phone: '',
    isActive: true,
    user: {
      name: '',
      nameEn: '',
      username: '',
      email: '',
      phone: '',
      password: '',
      isActive: true,
    },
  });

  const fetchData = useCallback(async () => {
    if (!user || user.role !== 'admin') {
      setError(t('branches.unauthorized') || 'غير مصرح لك بالوصول');
      setLoading(false);
      toast.error(t('branches.unauthorized'), { position: isRtl ? 'top-left' : 'top-right' });
      return;
    }

    setLoading(true);
    try {
      const branches = await branchesAPI.getAll({ status: filterStatus === 'all' ? undefined : filterStatus, isRtl: isRtl.toString() });
      setBranches(Array.isArray(branches) ? branches : []);
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Fetch error:`, err);
      setError(err.response?.data?.message || t('branches.fetchError') || 'حدث خطأ أثناء جلب البيانات');
      toast.error(t('branches.fetchError'), { position: isRtl ? 'top-left' : 'top-right' });
    } finally {
      setLoading(false);
    }
  }, [t, user, filterStatus, isRtl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredBranches = branches.filter(
    (branch) =>
      branch &&
      (branch.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.city?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const checkEmailAvailability = async (email: string) => {
    try {
      const response = await branchesAPI.checkEmail(email);
      return response.available;
    } catch {
      return false;
    }
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
      user: {
        name: '',
        nameEn: '',
        username: '',
        email: '',
        phone: '',
        password: '',
        isActive: true,
      },
    });
    setIsEditMode(false);
    setSelectedBranchId(null);
    setIsModalOpen(true);
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
    setSelectedBranchId(branch._id);
    setIsModalOpen(true);
    setError('');
  };

  const openResetPasswordModal = (branch: Branch) => {
    setSelectedBranchId(branch._id);
    setResetPasswordData({ password: '', confirmPassword: '' });
    setIsResetPasswordModalOpen(true);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code || !formData.address || !formData.city || (!isEditMode && (!formData.user.username || !formData.user.name || !formData.user.password))) {
      setError(
        isEditMode
          ? t('branches.requiredFieldsEdit') || 'الاسم، الكود، العنوان، والمدينة مطلوبة'
          : t('branches.requiredFields') || 'الاسم، الكود، العنوان، المدينة، اسم المستخدم، واسم المستخدم للفرع، وكلمة المرور مطلوبة'
      );
      toast.error(t('branches.requiredFields'), { position: isRtl ? 'top-left' : 'top-right' });
      return;
    }

    if (!isEditMode && formData.user.email) {
      const isEmailAvailable = await checkEmailAvailability(formData.user.email);
      if (!isEmailAvailable) {
        setError(t('branches.emailExists') || 'الإيميل مستخدم بالفعل، اختر إيميل آخر');
        toast.error(t('branches.emailExists'), { position: isRtl ? 'top-left' : 'top-right' });
        return;
      }
    }

    try {
      const branchData = {
        name: formData.name.trim(),
        nameEn: formData.nameEn.trim() || undefined,
        code: formData.code.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        phone: formData.phone.trim() || undefined,
        isActive: formData.isActive,
        user: {
          name: formData.user.name.trim(),
          nameEn: formData.user.nameEn.trim() || undefined,
          username: formData.user.username.trim(),
          email: formData.user.email.trim() || undefined,
          phone: formData.user.phone.trim() || undefined,
          isActive: formData.user.isActive,
          ...(isEditMode ? {} : { password: formData.user.password }),
        },
      };

      if (isEditMode && selectedBranchId) {
        const updatedBranchResponse = await branchesAPI.update(selectedBranchId, branchData);
        const updatedBranch = updatedBranchResponse.data ? updatedBranchResponse.data : updatedBranchResponse;
        setBranches(branches.map((b) => (b._id === selectedBranchId ? { ...b, ...updatedBranch } : b)));
        toast.success(t('branches.updated') || 'تم تحديث الفرع بنجاح', {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } else {
        const response = await branchesAPI.create(branchData);
        const newBranch = response.data ? response.data : response;
        if (
          newBranch &&
          typeof newBranch === 'object' &&
          newBranch._id &&
          newBranch.name &&
          newBranch.code &&
          newBranch.address &&
          newBranch.city &&
          typeof newBranch.isActive === 'boolean'
        ) {
          setBranches([...branches, newBranch as Branch]);
          toast.success(t('branches.added') || 'تم إضافة الفرع بنجاح', {
            position: isRtl ? 'top-left' : 'top-right',
          });
        } else {
          setError(t('branches.createError') || 'حدث خطأ أثناء إضافة الفرع');
          toast.error(t('branches.createError'), { position: isRtl ? 'top-left' : 'top-right' });
        }
      }
      setIsModalOpen(false);
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Submit error:`, err);
      let errorMessage = t(isEditMode ? 'branches.updateError' : 'branches.createError') || 'حدث خطأ أثناء معالجة الفرع';
      if (err.response?.data?.message) {
        const message = err.response.data.message;
        errorMessage =
          message === 'Branch code already exists'
            ? t('branches.codeExists') || 'هذا الكود مستخدم بالفعل، اختر كودًا آخر'
            : message === 'Username already exists'
            ? t('branches.usernameExists') || 'اسم المستخدم مستخدم بالفعل، اختر اسمًا آخر'
            : message.includes('الإيميل')
            ? t('branches.emailExists') || 'الإيميل مستخدم بالفعل، اختر إيميل آخر'
            : message || errorMessage;
      }
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right' });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordData.password || !resetPasswordData.confirmPassword) {
      setError(t('branches.passwordRequired') || 'كلمة المرور وتأكيدها مطلوبان');
      toast.error(t('branches.passwordRequired'), { position: isRtl ? 'top-left' : 'top-right' });
      return;
    }
    if (resetPasswordData.password !== resetPasswordData.confirmPassword) {
      setError(t('branches.passwordMismatch') || 'كلمة المرور وتأكيدها غير متطابقتين');
      toast.error(t('branches.passwordMismatch'), { position: isRtl ? 'top-left' : 'top-right' });
      return;
    }
    if (resetPasswordData.password.length < 6) {
      setError(t('branches.passwordTooShort') || 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      toast.error(t('branches.passwordTooShort'), { position: isRtl ? 'top-left' : 'top-right' });
      return;
    }

    try {
      await branchesAPI.resetBranchPassword(selectedBranchId!, { password: resetPasswordData.password });
      setIsResetPasswordModalOpen(false);
      setResetPasswordData({ password: '', confirmPassword: '' });
      toast.success(t('branches.passwordResetSuccess') || 'تم إعادة تعيين كلمة المرور بنجاح', {
        position: isRtl ? 'top-left' : 'top-right',
      });
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Reset password error:`, err);
      const errorMessage = err.response?.data?.message || t('branches.passwordResetError') || 'حدث خطأ أثناء إعادة تعيين كلمة المرور';
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right' });
    }
  };

  const handleDelete = async (branchId: string) => {
    if (!window.confirm(t('branches.confirmDelete') || 'هل أنت متأكد من حذف هذا الفرع؟')) return;
    try {
      await branchesAPI.delete(branchId);
      setBranches(branches.filter((b) => b._id !== branchId));
      toast.success(t('branches.deleted') || 'تم حذف الفرع بنجاح', {
        position: isRtl ? 'top-left' : 'top-right',
      });
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Delete error:`, err);
      let errorMessage = t('branches.deleteError') || 'حدث خطأ أثناء حذف الفرع';
      if (err.response?.data?.message) {
        errorMessage =
          err.response.data.message === 'Cannot delete branch with associated orders or inventory'
            ? t('branches.deleteRestricted') || 'لا يمكن حذف الفرع لوجود طلبات أو مخزون مرتبط'
            : err.response.data.message || errorMessage;
      }
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className={`mx-auto min-h-screen ${isRtl ? 'rtl' : 'ltr'}`}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4"
      >
        <h1 className="text-3xl sm:text-4xl font-bold text-amber-900 flex items-center justify-center sm:justify-start gap-3">
          <MapPin className="w-8 h-8 text-amber-600" />
          {t('branches.manage') || 'إدارة الفروع'}
        </h1>
        {user?.role === 'admin' && (
          <Button
            variant="primary"
            icon={Plus}
            onClick={openAddModal}
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-6 py-3 shadow-md transition-transform transform hover:scale-105"
          >
            {t('branches.add') || 'إضافة فرع'}
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
              placeholder={t('branches.searchPlaceholder') || 'ابحث عن الفروع...'}
              className={`pl-10 pr-4 py-2 border border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 transition-colors bg-amber-50 ${isRtl ? 'text-right' : 'text-left'}`}
              aria-label={t('branches.searchPlaceholder') || 'ابحث عن الفروع'}
            />
          </div>
          <div className="relative flex-1">
            <Select
              label={t('branches.status') || 'الحالة'}
              options={[
                { value: 'all', label: t('branches.allStatuses') || 'جميع الحالات' },
                { value: 'active', label: t('branches.active') || 'نشط' },
                { value: 'inactive', label: t('branches.inactive') || 'غير نشط' },
              ]}
              value={filterStatus}
              onChange={(value) => setFilterStatus(value)}
              className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 transition-colors bg-amber-50"
              aria-label={t('branches.status') || 'الحالة'}
            />
          </div>
          <Button
            variant="outline"
            icon={ChevronDown}
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="sm:hidden bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-lg px-4 py-2"
          >
            {t('branches.filters') || 'الفلاتر'}
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
                label={t('branches.status') || 'الحالة'}
                options={[
                  { value: 'all', label: t('branches.allStatuses') || 'جميع الحالات' },
                  { value: 'active', label: t('branches.active') || 'نشط' },
                  { value: 'inactive', label: t('branches.inactive') || 'غير نشط' },
                ]}
                value={filterStatus}
                onChange={(value) => setFilterStatus(value)}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 transition-colors bg-amber-50"
                aria-label={t('branches.status') || 'الحالة'}
              />
            </motion.div>
          )}
        </AnimatePresence>
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
            <h3 className="text-xl font-semibold text-amber-900">{t('branches.noBranches') || 'لا توجد فروع'}</h3>
            <p className="text-gray-600 mt-2">
              {searchTerm || filterStatus !== 'all'
                ? t('branches.noMatch') || 'لا توجد فروع مطابقة'
                : t('branches.empty') || 'لا توجد فروع متاحة'}
            </p>
            {user?.role === 'admin' && !searchTerm && filterStatus === 'all' && (
              <Button
                variant="primary"
                icon={Plus}
                onClick={openAddModal}
                className="mt-6 bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-6 py-3 shadow-md transition-transform transform hover:scale-105"
              >
                {t('branches.addFirst') || 'إضافة أول فرع'}
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
                    <h3 className="font-semibold text-lg text-amber-900 truncate">{branch.displayName}</h3>
                    <MapPin className="w-6 h-6 text-amber-600" />
                  </div>
                  <p className="text-sm text-gray-600">{t('branches.code') || 'الكود'}: {branch.code}</p>
                  <p className="text-sm text-gray-600">{t('branches.address') || 'العنوان'}: {branch.address}</p>
                  <p className="text-sm text-gray-600">{t('branches.city') || 'المدينة'}: {branch.city}</p>
                  <p className="text-sm text-gray-600">{t('branches.phone') || 'الهاتف'}: {branch.phone || '-'}</p>
                  <p className={`text-sm font-medium ${branch.isActive ? 'text-green-600' : 'text-red-600'}`}>
                    {t('branches.status') || 'الحالة'}: {branch.isActive ? t('branches.active') || 'نشط' : t('branches.inactive') || 'غير نشط'}
                  </p>
                  {branch.user && (
                    <div className="mt-3 pt-3 border-t border-amber-100">
                      <p className="text-sm text-gray-600">{t('branches.user') || 'المستخدم'}: {branch.user.displayName}</p>
                      <p className="text-sm text-gray-600">{t('branches.username') || 'اسم المستخدم'}: {branch.user.username}</p>
                      <p className="text-sm text-gray-600">{t('branches.email') || 'الإيميل'}: {branch.user.email || '-'}</p>
                      <p className="text-sm text-gray-600">{t('branches.userPhone') || 'هاتف المستخدم'}: {branch.user.phone || '-'}</p>
                      <p className={`text-sm font-medium ${branch.user.isActive ? 'text-green-600' : 'text-red-600'}`}>
                        {t('branches.userStatus') || 'حالة المستخدم'}: {branch.user.isActive ? t('branches.active') || 'نشط' : t('branches.inactive') || 'غير نشط'}
                      </p>
                    </div>
                  )}
                  {branch.createdBy && (
                    <p className="text-sm text-gray-600 mt-2">
                      {t('branches.createdBy') || 'تم الإنشاء بواسطة'}: {branch.createdBy.displayName}
                    </p>
                  )}
                  {user?.role === 'admin' && (
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => openEditModal(branch)}
                        className="text-amber-600 hover:text-amber-800 transition-colors"
                        title={t('branches.edit') || 'تعديل الفرع'}
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => openResetPasswordModal(branch)}
                        className="text-blue-500 hover:text-blue-700 transition-colors"
                        title={t('branches.resetPassword') || 'إعادة تعيين كلمة المرور'}
                      >
                        <Key className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(branch._id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        title={t('branches.delete') || 'حذف الفرع'}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
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
        title={isEditMode ? t('branches.edit') || 'تعديل الفرع' : t('branches.add') || 'إضافة فرع'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-6"
          >
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-amber-900">{t('branches.branchDetails') || 'تفاصيل الفرع'}</h3>
              <Input
                label={t('branches.name') || 'اسم الفرع'}
                value={formData.name}
                onChange={(value) => setFormData({ ...formData, name: value })}
                placeholder={t('branches.namePlaceholder') || 'أدخل اسم الفرع'}
                required
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t('branches.nameEn') || 'اسم الفرع (إنجليزي)'}
                value={formData.nameEn}
                onChange={(value) => setFormData({ ...formData, nameEn: value })}
                placeholder={t('branches.nameEnPlaceholder') || 'Enter branch name (English)'}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t('branches.code') || 'كود الفرع'}
                value={formData.code}
                onChange={(value) => setFormData({ ...formData, code: value })}
                placeholder={t('branches.codePlaceholder') || 'أدخل كود الفرع'}
                required
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t('branches.address') || 'العنوان'}
                value={formData.address}
                onChange={(value) => setFormData({ ...formData, address: value })}
                placeholder={t('branches.addressPlaceholder') || 'أدخل العنوان'}
                required
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t('branches.city') || 'المدينة'}
                value={formData.city}
                onChange={(value) => setFormData({ ...formData, city: value })}
                placeholder={t('branches.cityPlaceholder') || 'أدخل المدينة'}
                required
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t('branches.phone') || 'الهاتف'}
                value={formData.phone}
                onChange={(value) => setFormData({ ...formData, phone: value })}
                placeholder={t('branches.phonePlaceholder') || 'أدخل رقم الهاتف'}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Select
                label={t('branches.status') || 'الحالة'}
                options={[
                  { value: true, label: t('branches.active') || 'نشط' },
                  { value: false, label: t('branches.inactive') || 'غير نشط' },
                ]}
                value={formData.isActive}
                onChange={(value) => setFormData({ ...formData, isActive: value === 'true' })}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
            </div>
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-amber-900">{t('branches.userDetails') || 'تفاصيل المستخدم'}</h3>
              <Input
                label={t('branches.userName') || 'اسم المستخدم'}
                value={formData.user.name}
                onChange={(value) => setFormData({ ...formData, user: { ...formData.user, name: value } })}
                placeholder={t('branches.userNamePlaceholder') || 'أدخل اسم المستخدم'}
                required={!isEditMode}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t('branches.userNameEn') || 'اسم المستخدم (إنجليزي)'}
                value={formData.user.nameEn}
                onChange={(value) => setFormData({ ...formData, user: { ...formData.user, nameEn: value } })}
                placeholder={t('branches.userNameEnPlaceholder') || 'Enter user name (English)'}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t('branches.username') || 'اسم المستخدم للفرع'}
                value={formData.user.username}
                onChange={(value) => setFormData({ ...formData, user: { ...formData.user, username: value } })}
                placeholder={t('branches.usernamePlaceholder') || 'أدخل اسم المستخدم للفرع'}
                required={!isEditMode}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t('branches.email') || 'الإيميل'}
                value={formData.user.email}
                onChange={(value) => setFormData({ ...formData, user: { ...formData.user, email: value } })}
                placeholder={t('branches.emailPlaceholder') || 'أدخل الإيميل'}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t('branches.userPhone') || 'هاتف المستخدم'}
                value={formData.user.phone}
                onChange={(value) => setFormData({ ...formData, user: { ...formData.user, phone: value } })}
                placeholder={t('branches.userPhonePlaceholder') || 'أدخل رقم هاتف المستخدم'}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Select
                label={t('branches.userStatus') || 'حالة المستخدم'}
                options={[
                  { value: true, label: t('branches.active') || 'نشط' },
                  { value: false, label: t('branches.inactive') || 'غير نشط' },
                ]}
                value={formData.user.isActive}
                onChange={(value) => setFormData({ ...formData, user: { ...formData.user, isActive: value === 'true' } })}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              {!isEditMode && (
                <Input
                  label={t('branches.password') || 'كلمة المرور للفرع'}
                  value={formData.user.password}
                  onChange={(value) => setFormData({ ...formData, user: { ...formData.user, password: value } })}
                  placeholder={t('branches.passwordPlaceholder') || 'أدخل كلمة المرور للفرع'}
                  type="password"
                  required
                  className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
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
              {isEditMode ? t('branches.update') || 'تحديث الفرع' : t('branches.add') || 'إضافة الفرع'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-amber-900 rounded-lg px-6 py-3 shadow-md transition-transform transform hover:scale-105"
            >
              {t('cancel') || 'إلغاء'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isResetPasswordModalOpen}
        onClose={() => setIsResetPasswordModalOpen(false)}
        title={t('branches.resetPassword') || 'إعادة تعيين كلمة المرور'}
        size="sm"
      >
        <form onSubmit={handleResetPassword} className="space-y-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <Input
              label={t('branches.newPassword') || 'كلمة المرور الجديدة'}
              value={resetPasswordData.password}
              onChange={(value) => setResetPasswordData({ ...resetPasswordData, password: value })}
              placeholder={t('branches.newPasswordPlaceholder') || 'أدخل كلمة المرور الجديدة'}
              type="password"
              required
              className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
            />
            <Input
              label={t('branches.confirmPassword') || 'تأكيد كلمة المرور'}
              value={resetPasswordData.confirmPassword}
              onChange={(value) => setResetPasswordData({ ...resetPasswordData, confirmPassword: value })}
              placeholder={t('branches.confirmPasswordPlaceholder') || 'أدخل تأكيد كلمة المرور'}
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
              {t('branches.reset') || 'إعادة تعيين'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsResetPasswordModalOpen(false)}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-amber-900 rounded-lg px-6 py-3 shadow-md transition-transform transform hover:scale-105"
            >
              {t('cancel') || 'إلغاء'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}