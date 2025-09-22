import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { usersAPI, branchesAPI, departmentAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Modal } from '../components/UI/Modal';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { User, Search, AlertCircle, Plus, Edit2, Trash2, ChevronDown, Key } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';

interface User {
  _id: string;
  name: string;
  nameEn?: string;
  username: string;
  email?: string;
  phone?: string;
  role: 'admin' | 'branch' | 'chef' | 'production';
  branch?: { _id: string; name: string; nameEn?: string };
  department?: { _id: string; name: string };
  isActive: boolean;
}

interface Branch {
  _id: string;
  name: string;
  nameEn?: string;
}

interface Department {
  _id: string;
  name: string;
}

export const Users: React.FC = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [resetPasswordData, setResetPasswordData] = useState({ password: '', confirmPassword: '' });
  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    username: '',
    email: '',
    phone: '',
    role: 'admin' as 'admin' | 'branch' | 'chef' | 'production',
    branch: '',
    department: '',
    password: '',
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    if (!user || user.role !== 'admin') {
      setError(t('users.unauthorized') || 'غير مصرح لك بالوصول');
      setLoading(false);
      toast.error(t('users.unauthorized'), { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }

    setLoading(true);
    try {
      const [usersResponse, branchesResponse, departmentsResponse] = await Promise.all([
        usersAPI.getAll({ status: filterStatus === 'all' ? undefined : filterStatus, role: filterRole === 'all' ? undefined : filterRole, page, limit: 10 }),
        branchesAPI.getAll(),
        departmentAPI.getAll(),
      ]);
      setUsers(Array.isArray(usersResponse.data) ? usersResponse.data : []);
      setBranches(Array.isArray(branchesResponse.data) ? branchesResponse.data : []);
      setDepartments(Array.isArray(departmentsResponse.data) ? departmentsResponse.data : []);
      setTotalPages(usersResponse.totalPages || 1);
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Fetch error:`, err);
      setError(err.response?.data?.message || t('users.fetchError') || 'حدث خطأ أثناء جلب البيانات');
      toast.error(t('users.fetchError'), { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setLoading(false);
    }
  }, [t, user, filterStatus, filterRole, page, isRtl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredUsers = users.filter(
    (user) =>
      user &&
      ((isRtl ? user.name : user.nameEn || user.name)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.name) errors.name = t('users.nameRequired') || 'اسم المستخدم مطلوب';
    if (!formData.nameEn) errors.nameEn = t('users.nameEnRequired') || 'اسم المستخدم بالإنجليزية مطلوب';
    if (!formData.username) errors.username = t('users.usernameRequired') || 'اسم المستخدم للدخول مطلوب';
    if (!isEditMode && !formData.password) errors.password = t('users.passwordRequired') || 'كلمة المرور مطلوبة';
    if (formData.role === 'branch' && !formData.branch) errors.branch = t('users.branchRequired') || 'الفرع مطلوب';
    if (formData.role === 'chef' && !formData.department) errors.department = t('users.departmentRequired') || 'القسم مطلوب';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openAddModal = () => {
    setFormData({
      name: '',
      nameEn: '',
      username: '',
      email: '',
      phone: '',
      role: 'admin',
      branch: '',
      department: '',
      password: '',
      isActive: true,
    });
    setIsEditMode(false);
    setSelectedUserId(null);
    setIsModalOpen(true);
    setFormErrors({});
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
      department: user.department?._id || '',
      password: '',
      isActive: user.isActive,
    });
    setIsEditMode(true);
    setSelectedUserId(user._id);
    setIsModalOpen(true);
    setFormErrors({});
    setError('');
  };

  const openResetPasswordModal = (user: User) => {
    setSelectedUserId(user._id);
    setResetPasswordData({ password: '', confirmPassword: '' });
    setIsResetPasswordModalOpen(true);
    setError('');
  };

  const openDeleteModal = (userId: string) => {
    setSelectedUserId(userId);
    setIsDeleteModalOpen(true);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error(t('users.requiredFields') || 'يرجى ملء جميع الحقول المطلوبة', { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }

    try {
      const userData = {
        name: formData.name.trim(),
        nameEn: formData.nameEn.trim(),
        username: formData.username.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        role: formData.role,
        branch: formData.role === 'branch' ? formData.branch : undefined,
        department: formData.role === 'chef' ? formData.department : undefined,
        isActive: formData.isActive,
        ...(isEditMode ? {} : { password: formData.password.trim() }),
      };

      if (isEditMode && selectedUserId) {
        await usersAPI.update(selectedUserId, userData);
        setUsers(users.map((u) => (u._id === selectedUserId ? { ...u, ...userData } : u)));
        toast.success(t('users.updated') || 'تم تحديث المستخدم بنجاح', { position: isRtl ? 'top-right' : 'top-left' });
      } else {
        const response = await usersAPI.create(userData);
        setUsers([...users, response]);
        toast.success(t('users.added') || 'تم إضافة المستخدم بنجاح', { position: isRtl ? 'top-right' : 'top-left' });
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
            : message;
      }
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordData.password || !resetPasswordData.confirmPassword) {
      setError(t('users.passwordRequired') || 'كلمة المرور وتأكيدها مطلوبان');
      toast.error(t('users.passwordRequired'), { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    if (resetPasswordData.password !== resetPasswordData.confirmPassword) {
      setError(t('users.passwordMismatch') || 'كلمة المرور وتأكيدها غير متطابقتين');
      toast.error(t('users.passwordMismatch'), { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    if (resetPasswordData.password.length < 6) {
      setError(t('users.passwordTooShort') || 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      toast.error(t('users.passwordTooShort'), { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }

    try {
      await usersAPI.resetPassword(selectedUserId!, { password: resetPasswordData.password });
      setIsResetPasswordModalOpen(false);
      setResetPasswordData({ password: '', confirmPassword: '' });
      toast.success(t('users.passwordResetSuccess') || 'تم إعادة تعيين كلمة المرور بنجاح', {
        position: isRtl ? 'top-right' : 'top-left',
      });
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Reset password error:`, err);
      const errorMessage = err.response?.data?.message || t('users.passwordResetError') || 'حدث خطأ أثناء إعادة تعيين كلمة المرور';
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  const handleDelete = async () => {
    if (!selectedUserId) return;
    try {
      await usersAPI.delete(selectedUserId);
      setUsers(users.filter((u) => u._id !== selectedUserId));
      toast.success(t('users.deleted') || 'تم حذف المستخدم بنجاح', { position: isRtl ? 'top-right' : 'top-left' });
      setIsDeleteModalOpen(false);
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Delete error:`, err);
      const errorMessage = err.response?.data?.message || t('users.deleteError') || 'حدث خطأ أثناء حذف المستخدم';
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
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
    <div className={`mx-auto p-4 sm:p-6 min-h-screen ${isRtl ? 'rtl' : 'ltr'}`}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4"
      >
        <h1 className="text-3xl sm:text-4xl font-bold text-amber-900 flex items-center justify-center sm:justify-start gap-3">
          <User className="w-8 h-8 text-amber-600" />
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
              className="mt-4 sm:hidden space-y-4"
            >
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
            {t('users.previous') || 'السابق'}
          </Button>
          <span className="px-4 py-2 text-amber-900">
            {t('users.page') || 'صفحة'} {page} {t('users.of') || 'من'} {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            disabled={page === totalPages}
            className="mx-2 px-4 py-2 bg-amber-100 text-amber-800 disabled:opacity-50"
          >
            {t('users.next') || 'التالي'}
          </Button>
        </div>
      </Card>

      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ staggerChildren: 0.1 }}
      >
        {filteredUsers.length === 0 ? (
          <Card className="p-8 text-center bg-white rounded-lg shadow-md col-span-full">
            <User className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-amber-900">{t('users.noUsers') || 'لا توجد مستخدمين'}</h3>
            <p className="text-gray-600 mt-2">
              {searchTerm || filterStatus !== 'all' || filterRole !== 'all'
                ? t('users.noMatch') || 'لا توجد مستخدمين مطابقين'
                : t('users.empty') || 'لا توجد مستخدمين متاحين'}
            </p>
            {user?.role === 'admin' && !searchTerm && filterStatus === 'all' && filterRole === 'all' && (
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
                    <h3 className="font-semibold text-lg text-amber-900 truncate">{isRtl ? user.name : user.nameEn || user.name}</h3>
                    <User className="w-6 h-6 text-amber-600" />
                  </div>
                  <p className="text-sm text-gray-600">{t('users.username') || 'اسم المستخدم'}: {user.username}</p>
                  <p className="text-sm text-gray-600">{t('users.email') || 'الإيميل'}: {user.email || '-'}</p>
                  <p className="text-sm text-gray-600">{t('users.phone') || 'الهاتف'}: {user.phone || '-'}</p>
                  <p className="text-sm text-gray-600">{t('users.role') || 'الدور'}: {t(`users.${user.role}`) || user.role}</p>
                  {user.branch && (
                    <p className="text-sm text-gray-600">{t('users.branch') || 'الفرع'}: {isRtl ? user.branch.name : user.branch.nameEn || user.branch.name}</p>
                  )}
                  {user.department && (
                    <p className="text-sm text-gray-600">{t('users.department') || 'القسم'}: {user.department.name}</p>
                  )}
                  <p className={`text-sm font-medium ${user.isActive ? 'text-green-600' : 'text-red-600'}`}>
                    {t('users.status') || 'الحالة'}: {user.isActive ? t('users.active') || 'نشط' : t('users.inactive') || 'غير نشط'}
                  </p>
                  {user?.role === 'admin' && (
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => openEditModal(user)}
                        className="text-amber-600 hover:text-amber-800 transition-colors"
                        data-tooltip-id={`edit-${user._id}`}
                        data-tooltip-content={t('users.edit') || 'تعديل المستخدم'}
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => openResetPasswordModal(user)}
                        className="text-blue-500 hover:text-blue-700 transition-colors"
                        data-tooltip-id={`reset-${user._id}`}
                        data-tooltip-content={t('users.resetPassword') || 'إعادة تعيين كلمة المرور'}
                      >
                        <Key className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(user._id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        data-tooltip-id={`delete-${user._id}`}
                        data-tooltip-content={t('users.delete') || 'حذف المستخدم'}
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
        <form onSubmit={handleSubmit} className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-6"
          >
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-amber-900">{t('users.userDetails') || 'تفاصيل المستخدم'}</h3>
              <Input
                label={t('users.name') || 'اسم المستخدم (عربي)'}
                value={formData.name}
                onChange={(value) => setFormData({ ...formData, name: value })}
                placeholder={t('users.namePlaceholder') || 'أدخل اسم المستخدم'}
                required
                error={formErrors.name}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t('users.nameEn') || 'اسم المستخدم (إنجليزي)'}
                value={formData.nameEn}
                onChange={(value) => setFormData({ ...formData, nameEn: value })}
                placeholder={t('users.nameEnPlaceholder') || 'أدخل اسم المستخدم بالإنجليزية'}
                required
                error={formErrors.nameEn}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t('users.username') || 'اسم المستخدم للدخول'}
                value={formData.username}
                onChange={(value) => setFormData({ ...formData, username: value })}
                placeholder={t('users.usernamePlaceholder') || 'أدخل اسم المستخدم للدخول'}
                required
                error={formErrors.username}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t('users.email') || 'الإيميل'}
                value={formData.email}
                onChange={(value) => setFormData({ ...formData, email: value })}
                placeholder={t('users.emailPlaceholder') || 'أدخل الإيميل'}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t('users.phone') || 'الهاتف'}
                value={formData.phone}
                onChange={(value) => setFormData({ ...formData, phone: value })}
                placeholder={t('users.phonePlaceholder') || 'أدخل رقم الهاتف'}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
            </div>
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-amber-900">{t('users.roleDetails') || 'تفاصيل الدور'}</h3>
              <Select
                label={t('users.role') || 'الدور'}
                options={[
                  { value: 'admin', label: t('users.admin') || 'مدير' },
                  { value: 'branch', label: t('users.branch') || 'فرع' },
                  { value: 'chef', label: t('users.chef') || 'شيف' },
                  { value: 'production', label: t('users.production') || 'إنتاج' },
                ]}
                value={formData.role}
                onChange={(value) => setFormData({ ...formData, role: value as 'admin' | 'branch' | 'chef' | 'production', branch: '', department: '' })}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              {formData.role === 'branch' && (
                <Select
                  label={t('users.branch') || 'الفرع'}
                  options={branches.map((branch) => ({
                    value: branch._id,
                    label: isRtl ? branch.name : branch.nameEn || branch.name,
                  }))}
                  value={formData.branch}
                  onChange={(value) => setFormData({ ...formData, branch: value })}
                  placeholder={t('users.branchPlaceholder') || 'اختر الفرع'}
                  required
                  error={formErrors.branch}
                  className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
                />
              )}
              {formData.role === 'chef' && (
                <Select
                  label={t('users.department') || 'القسم'}
                  options={departments.map((dept) => ({
                    value: dept._id,
                    label: dept.name,
                  }))}
                  value={formData.department}
                  onChange={(value) => setFormData({ ...formData, department: value })}
                  placeholder={t('users.departmentPlaceholder') || 'اختر القسم'}
                  required
                  error={formErrors.department}
                  className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
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
                  error={formErrors.password}
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
        <form onSubmit={handleResetPassword} className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
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

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={t('users.confirmDelete') || 'تأكيد حذف المستخدم'}
        size="sm"
      >
        <div className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
          <p className="text-gray-600">{t('users.deleteWarning') || 'هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع عن هذا الإجراء.'}</p>
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
              {t('users.delete') || 'حذف'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsDeleteModalOpen(false)}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-amber-900 rounded-lg px-6 py-3 shadow-md transition-transform transform hover:scale-105"
            >
              {t('cancel') || 'إلغاء'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Users;