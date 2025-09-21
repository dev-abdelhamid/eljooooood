import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { usersAPI, branchesAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Modal } from '../components/UI/Modal';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import {user, Search, AlertCircle, Plus, Edit2, Trash2, ChevronDown, Key } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';

interface Branch {
  _id: string;
  name: string;
  nameEn?: string;
  displayName: string;
  code: string;
}

interface User {
  _id: string;
  name: string;
  nameEn?: string;
  displayName: string;
  username: string;
  email?: string;
  phone?: string;
  role: 'admin' | 'branch' | 'chef' | 'production';
  branch?: Branch;
  isActive: boolean;
}

export function Users() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [resetPasswordData, setResetPasswordData] = useState({ password: '', confirmPassword: '' });

  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    username: '',
    email: '',
    phone: '',
    role: 'branch' as User['role'],
    branch: '',
    password: '',
    isActive: true,
  });

  const fetchData = useCallback(async () => {
    if (!user || user.role !== 'admin') {
      setError(t('users.unauthorized') || 'غير مصرح لك بالوصول');
      setLoading(false);
      toast.error(t('users.unauthorized'), { position: isRtl ? 'top-left' : 'top-right' });
      return;
    }

    setLoading(true);
    try {
      const [usersResponse, branchesResponse] = await Promise.all([
        usersAPI.getAll({ isRtl: isRtl.toString() }),
        branchesAPI.getAll({ isRtl: isRtl.toString() }),
      ]);
      setUsers(Array.isArray(usersResponse) ? usersResponse : []);
      setBranches(Array.isArray(branchesResponse) ? branchesResponse : []);
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Fetch error:`, err);
      setError(err.response?.data?.message || t('users.fetchError') || 'حدث خطأ أثناء جلب البيانات');
      toast.error(t('users.fetchError'), { position: isRtl ? 'top-left' : 'top-right' });
    } finally {
      setLoading(false);
    }
  }, [t, user, isRtl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredUsers = users.filter(
    (user) =>
      user &&
      (user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filterRole === 'all' || user.role === filterRole) &&
      (filterStatus === 'all' || (filterStatus === 'active' && user.isActive) || (filterStatus === 'inactive' && !user.isActive))
  );

  const checkEmailAvailability = async (email: string, userId?: string) => {
    try {
      const response = await usersAPI.checkEmail(email, userId);
      return response.available;
    } catch {
      return false;
    }
  };

  const openAddModal = () => {
    setFormData({
      name: '',
      nameEn: '',
      username: '',
      email: '',
      phone: '',
      role: 'branch',
      branch: '',
      password: '',
      isActive: true,
    });
    setIsEditMode(false);
    setSelectedUserId(null);
    setIsModalOpen(true);
    setError('');
  };

  const openEditModal = (user: User) => {
    setFormData({
      name: user.name,
      nameEn: user.nameEn || '',
      username: user.username,
      email: user.email || '',
      phone: user.phone || '',
      role: user.role,
      branch: user.branch?._id || '',
      password: '',
      isActive: user.isActive,
    });
    setIsEditMode(true);
    setSelectedUserId(user._id);
    setIsModalOpen(true);
    setError('');
  };

  const openResetPasswordModal = (user: User) => {
    setSelectedUserId(user._id);
    setResetPasswordData({ password: '', confirmPassword: '' });
    setIsResetPasswordModalOpen(true);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.username || (!isEditMode && !formData.password) || (formData.role === 'branch' && !formData.branch)) {
      setError(
        isEditMode
          ? t('users.requiredFieldsEdit') || 'الاسم واسم المستخدم مطلوبان'
          : t('users.requiredFields') || 'الاسم واسم المستخدم وكلمة المرور مطلوبة، والفرع مطلوب لدور الفرع'
      );
      toast.error(t('users.requiredFields'), { position: isRtl ? 'top-left' : 'top-right' });
      return;
    }

    if (formData.email) {
      const isEmailAvailable = await checkEmailAvailability(formData.email, isEditMode ? selectedUserId : undefined);
      if (!isEmailAvailable) {
        setError(t('users.emailExists') || 'الإيميل مستخدم بالفعل، اختر إيميل آخر');
        toast.error(t('users.emailExists'), { position: isRtl ? 'top-left' : 'top-right' });
        return;
      }
    }

    try {
      const userData = {
        name: formData.name.trim(),
        nameEn: formData.nameEn.trim() || undefined,
        username: formData.username.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        role: formData.role,
        branch: formData.role === 'branch' ? formData.branch : undefined,
        isActive: formData.isActive,
        ...(isEditMode ? {} : { password: formData.password }),
      };

      if (isEditMode && selectedUserId) {
        const updatedUserResponse = await usersAPI.update(selectedUserId, userData);
        const updatedUser = updatedUserResponse.data ? updatedUserResponse.data : updatedUserResponse;
        setUsers(users.map((u) => (u._id === selectedUserId ? { ...u, ...updatedUser } : u)));
        toast.success(t('users.updated') || 'تم تحديث المستخدم بنجاح', {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } else {
        const response = await usersAPI.create(userData);
        const newUser = response.data ? response.data : response;
        if (
          newUser &&
          typeof newUser === 'object' &&
          newUser._id &&
          newUser.name &&
          newUser.username &&
          newUser.role
        ) {
          setUsers([...users, newUser as User]);
          toast.success(t('users.added') || 'تم إضافة المستخدم بنجاح', {
            position: isRtl ? 'top-left' : 'top-right',
          });
        } else {
          setError(t('users.createError') || 'حدث خطأ أثناء إضافة المستخدم');
          toast.error(t('users.createError'), { position: isRtl ? 'top-left' : 'top-right' });
        }
      }
      setIsModalOpen(false);
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Submit error:`, err);
      let errorMessage = t(isEditMode ? 'users.updateError' : 'users.createError') || 'حدث خطأ أثناء معالجة المستخدم';
      if (err.response?.data?.message) {
        const message = err.response.data.message;
        errorMessage =
          message === 'Username already exists'
            ? t('users.usernameExists') || 'اسم المستخدم مستخدم بالفعل، اختر اسمًا آخر'
            : message.includes('الإيميل')
            ? t('users.emailExists') || 'الإيميل مستخدم بالفعل، اختر إيميل آخر'
            : message || errorMessage;
      }
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right' });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordData.password || !resetPasswordData.confirmPassword) {
      setError(t('users.passwordRequired') || 'كلمة المرور وتأكيدها مطلوبان');
      toast.error(t('users.passwordRequired'), { position: isRtl ? 'top-left' : 'top-right' });
      return;
    }
    if (resetPasswordData.password !== resetPasswordData.confirmPassword) {
      setError(t('users.passwordMismatch') || 'كلمة المرور وتأكيدها غير متطابقتين');
      toast.error(t('users.passwordMismatch'), { position: isRtl ? 'top-left' : 'top-right' });
      return;
    }
    if (resetPasswordData.password.length < 6) {
      setError(t('users.passwordTooShort') || 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      toast.error(t('users.passwordTooShort'), { position: isRtl ? 'top-left' : 'top-right' });
      return;
    }

    try {
      await usersAPI.resetPassword(selectedUserId!, { password: resetPasswordData.password });
      setIsResetPasswordModalOpen(false);
      setResetPasswordData({ password: '', confirmPassword: '' });
      toast.success(t('users.passwordResetSuccess') || 'تم إعادة تعيين كلمة المرور بنجاح', {
        position: isRtl ? 'top-left' : 'top-right',
      });
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Reset password error:`, err);
      const errorMessage = err.response?.data?.message || t('users.passwordResetError') || 'حدث خطأ أثناء إعادة تعيين كلمة المرور';
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right' });
    }
  };

  const handleDelete = async (userId: string) => {
    if (!window.confirm(t('users.confirmDelete') || 'هل أنت متأكد من حذف هذا المستخدم؟')) return;
    try {
      await usersAPI.delete(userId);
      setUsers(users.filter((u) => u._id !== userId));
      toast.success(t('users.deleted') || 'تم حذف المستخدم بنجاح', {
        position: isRtl ? 'top-left' : 'top-right',
      });
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Delete error:`, err);
      let errorMessage = t('users.deleteError') || 'حدث خطأ أثناء حذف المستخدم';
      if (err.response?.data?.message) {
        errorMessage =
          err.response.data.message === 'Cannot delete user with associated branch orders or inventory'
            ? t('users.deleteRestricted') || 'لا يمكن حذف المستخدم لوجود طلبات أو مخزون مرتبط بالفرع'
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
          <Users className="w-8 h-8 text-amber-600" />
          {t('users.manage') || 'إدارة المستخدمين'}
        </h1>
        {user?.role === 'admin' && (
          <Button
            variant="primary"
            icon={Plus}
            onClick={openAddModal}
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-6 py-3 shadow-md transition-transform transform hover:scale-105"
          >
            {t('users.add') || 'إضافة مستخدم'}
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
              placeholder={t('users.searchPlaceholder') || 'ابحث عن المستخدمين...'}
              className={`pl-10 pr-4 py-2 border border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 transition-colors bg-amber-50 ${isRtl ? 'text-right' : 'text-left'}`}
              aria-label={t('users.searchPlaceholder') || 'ابحث عن المستخدمين'}
            />
          </div>
          <div className="relative flex-1">
            <Select
              label={t('users.role') || 'الدور'}
              options={[
                { value: 'all', label: t('users.allRoles') || 'جميع الأدوار' },
                { value: 'admin', label: t('users.admin') || 'مدير' },
                { value: 'branch', label: t('users.branch') || 'فرع' },
                { value: 'chef', label: t('users.chef') || 'شيف' },
                { value: 'production', label: t('users.production') || 'إنتاج' },
              ]}
              value={filterRole}
              onChange={(value) => setFilterRole(value)}
              className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 transition-colors bg-amber-50"
              aria-label={t('users.role') || 'الدور'}
            />
          </div>
          <div className="relative flex-1">
            <Select
              label={t('users.status') || 'الحالة'}
              options={[
                { value: 'all', label: t('users.allStatuses') || 'جميع الحالات' },
                { value: 'active', label: t('users.active') || 'نشط' },
                { value: 'inactive', label: t('users.inactive') || 'غير نشط' },
              ]}
              value={filterStatus}
              onChange={(value) => setFilterStatus(value)}
              className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 transition-colors bg-amber-50"
              aria-label={t('users.status') || 'الحالة'}
            />
          </div>
          <Button
            variant="outline"
            icon={ChevronDown}
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="sm:hidden bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-lg px-4 py-2"
          >
            {t('users.filters') || 'الفلاتر'}
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
                label={t('users.role') || 'الدور'}
                options={[
                  { value: 'all', label: t('users.allRoles') || 'جميع الأدوار' },
                  { value: 'admin', label: t('users.admin') || 'مدير' },
                  { value: 'branch', label: t('users.branch') || 'فرع' },
                  { value: 'chef', label: t('users.chef') || 'شيف' },
                  { value: 'production', label: t('users.production') || 'إنتاج' },
                ]}
                value={filterRole}
                onChange={(value) => setFilterRole(value)}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 transition-colors bg-amber-50"
                aria-label={t('users.role') || 'الدور'}
              />
              <Select
                label={t('users.status') || 'الحالة'}
                options={[
                  { value: 'all', label: t('users.allStatuses') || 'جميع الحالات' },
                  { value: 'active', label: t('users.active') || 'نشط' },
                  { value: 'inactive', label: t('users.inactive') || 'غير نشط' },
                ]}
                value={filterStatus}
                onChange={(value) => setFilterStatus(value)}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 transition-colors bg-amber-50"
                aria-label={t('users.status') || 'الحالة'}
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
        {filteredUsers.length === 0 ? (
          <Card className="p-8 text-center bg-white rounded-lg shadow-md col-span-full">
            <Users className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-amber-900">{t('users.noUsers') || 'لا توجد مستخدمين'}</h3>
            <p className="text-gray-600 mt-2">
              {searchTerm || filterRole !== 'all' || filterStatus !== 'all'
                ? t('users.noMatch') || 'لا توجد مستخدمين مطابقين'
                : t('users.empty') || 'لا توجد مستخدمين متاحين'}
            </p>
            {user?.role === 'admin' && !searchTerm && filterRole === 'all' && filterStatus === 'all' && (
              <Button
                variant="primary"
                icon={Plus}
                onClick={openAddModal}
                className="mt-6 bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-6 py-3 shadow-md transition-transform transform hover:scale-105"
              >
                {t('users.addFirst') || 'إضافة أول مستخدم'}
              </Button>
            )}
          </Card>
        ) : (
          filteredUsers.map((user) => (
            <motion.div
              key={user._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-lg text-amber-900 truncate">{user.displayName}</h3>
                  </div>
                  <p className="text-sm text-gray-600">{t('users.username') || 'اسم المستخدم'}: {user.username}</p>
                  <p className="text-sm text-gray-600">{t('users.email') || 'الإيميل'}: {user.email || '-'}</p>
                  <p className="text-sm text-gray-600">{t('users.phone') || 'الهاتف'}: {user.phone || '-'}</p>
                  <p className="text-sm text-gray-600">{t('users.role') || 'الدور'}: {t(`users.${user.role}`) || user.role}</p>
                  {user.branch && (
                    <p className="text-sm text-gray-600">{t('users.branch') || 'الفرع'}: {user.branch.displayName}</p>
                  )}
                  <p className={`text-sm font-medium ${user.isActive ? 'text-green-600' : 'text-red-600'}`}>
                    {t('users.status') || 'الحالة'}: {user.isActive ? t('users.active') || 'نشط' : t('users.inactive') || 'غير نشط'}
                  </p>
                  {user?.role !== 'admin' && (
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => openEditModal(user)}
                        className="text-amber-600 hover:text-amber-800 transition-colors"
                        title={t('users.edit') || 'تعديل المستخدم'}
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => openResetPasswordModal(user)}
                        className="text-blue-500 hover:text-blue-700 transition-colors"
                        title={t('users.resetPassword') || 'إعادة تعيين كلمة المرور'}
                      >
                        <Key className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(user._id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        title={t('users.delete') || 'حذف المستخدم'}
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
        title={isEditMode ? t('users.edit') || 'تعديل المستخدم' : t('users.add') || 'إضافة مستخدم'}
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
              <h3 className="text-lg font-semibold text-amber-900">{t('users.userDetails') || 'تفاصيل المستخدم'}</h3>
              <Input
                label={t('users.name') || 'الاسم'}
                value={formData.name}
                onChange={(value) => setFormData({ ...formData, name: value })}
                placeholder={t('users.namePlaceholder') || 'أدخل الاسم'}
                required
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t('users.nameEn') || 'الاسم (إنجليزي)'}
                value={formData.nameEn}
                onChange={(value) => setFormData({ ...formData, nameEn: value })}
                placeholder={t('users.nameEnPlaceholder') || 'Enter name (English)'}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t('users.username') || 'اسم المستخدم'}
                value={formData.username}
                onChange={(value) => setFormData({ ...formData, username: value })}
                placeholder={t('users.usernamePlaceholder') || 'أدخل اسم المستخدم'}
                required
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t('users.email') || 'الإيميل'}
                value={formData.email}
                onChange={(value) => setFormData({ ...formData, email: value })}
                placeholder={t('users.emailPlaceholder') || 'أدخل الإيميل'}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
            </div>
            <div className="space-y-6">
              <Input
                label={t('users.phone') || 'الهاتف'}
                value={formData.phone}
                onChange={(value) => setFormData({ ...formData, phone: value })}
                placeholder={t('users.phonePlaceholder') || 'أدخل رقم الهاتف'}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Select
                label={t('users.role') || 'الدور'}
                options={[
                  { value: 'admin', label: t('users.admin') || 'مدير' },
                  { value: 'branch', label: t('users.branch') || 'فرع' },
                  { value: 'chef', label: t('users.chef') || 'شيف' },
                  { value: 'production', label: t('users.production') || 'إنتاج' },
                ]}
                value={formData.role}
                onChange={(value) => setFormData({ ...formData, role: value as User['role'], branch: value === 'branch' ? formData.branch : '' })}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              {formData.role === 'branch' && (
                <Select
                  label={t('users.branch') || 'الفرع'}
                  options={[
                    { value: '', label: t('users.selectBranch') || 'اختر فرعًا' },
                    ...branches.map((branch) => ({
                      value: branch._id,
                      label: branch.displayName,
                    })),
                  ]}
                  value={formData.branch}
                  onChange={(value) => setFormData({ ...formData, branch: value })}
                  className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
                  required
                />
              )}
              <Select
                label={t('users.status') || 'الحالة'}
                options={[
                  { value: true, label: t('users.active') || 'نشط' },
                  { value: false, label: t('users.inactive') || 'غير نشط' },
                ]}
                value={formData.isActive}
                onChange={(value) => setFormData({ ...formData, isActive: value === 'true' })}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              {!isEditMode && (
                <Input
                  label={t('users.password') || 'كلمة المرور'}
                  value={formData.password}
                  onChange={(value) => setFormData({ ...formData, password: value })}
                  placeholder={t('users.passwordPlaceholder') || 'أدخل كلمة المرور'}
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
              {isEditMode ? t('users.update') || 'تحديث المستخدم' : t('users.add') || 'إضافة المستخدم'}
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
        title={t('users.resetPassword') || 'إعادة تعيين كلمة المرور'}
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
              label={t('users.newPassword') || 'كلمة المرور الجديدة'}
              value={resetPasswordData.password}
              onChange={(value) => setResetPasswordData({ ...resetPasswordData, password: value })}
              placeholder={t('users.newPasswordPlaceholder') || 'أدخل كلمة المرور الجديدة'}
              type="password"
              required
              className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
            />
            <Input
              label={t('users.confirmPassword') || 'تأكيد كلمة المرور'}
              value={resetPasswordData.confirmPassword}
              onChange={(value) => setResetPasswordData({ ...resetPasswordData, confirmPassword: value })}
              placeholder={t('users.confirmPasswordPlaceholder') || 'أدخل تأكيد كلمة المرور'}
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
              {t('users.reset') || 'إعادة تعيين'}
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