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
import { User, Search, AlertCircle, Plus, Edit2, Trash2, Key, Eye, EyeOff, MapPin } from 'lucide-react';
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
  branch?: {
    _id: string;
    name: string;
    nameEn?: string;
    address: string;
    city: string;
    cityEn?: string; // Added for English city name
    phone?: string;
  };
  department?: { _id: string; name: string };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  password?: string; // For admin viewing
}

interface Branch {
  _id: string;
  name: string;
  nameEn?: string;
  address: string;
  city: string;
  cityEn?: string; // Added for English city name
}

interface Department {
  _id: string;
  name: string;
}

const translations = {
  ar: {
    manage: 'إدارة المستخدمين',
    add: 'إضافة مستخدم',
    addFirst: 'إضافة أول مستخدم',
    noUsers: 'لا توجد مستخدمين',
    noMatch: 'لا توجد مستخدمين مطابقين',
    empty: 'لا توجد مستخدمين متاحين',
    searchPlaceholder: 'ابحث عن المستخدمين...',
    role: 'الدور',
    allRoles: 'جميع الأدوار',
    admin: 'مدير',
    branch: 'فرع',
    chef: 'شيف',
    production: 'إنتاج',
    previous: 'السابق',
    next: 'التالي',
    page: 'صفحة',
    of: 'من',
    username: 'اسم المستخدم',
    email: 'الإيميل',
    phone: 'الهاتف',
    department: 'القسم',
    createdAt: 'تاريخ الإنشاء',
    updatedAt: 'تاريخ التحديث',
    edit: 'تعديل',
    resetPassword: 'تغيير كلمة المرور',
    delete: 'حذف',
    name: 'اسم المستخدم (عربي)',
    nameEn: 'اسم المستخدم (إنجليزي)',
    nameRequired: 'اسم المستخدم مطلوب',
    nameEnRequired: 'اسم المستخدم بالإنجليزية مطلوب',
    usernameRequired: 'اسم المستخدم للدخول مطلوب',
    passwordRequired: 'كلمة المرور مطلوبة',
    branchRequired: 'الفرع مطلوب',
    departmentRequired: 'القسم مطلوب',
    namePlaceholder: 'أدخل اسم المستخدم',
    nameEnPlaceholder: 'أدخل اسم المستخدم بالإنجليزية',
    usernamePlaceholder: 'أدخل اسم المستخدم للدخول',
    emailPlaceholder: 'أدخل الإيميل',
    phonePlaceholder: 'أدخل رقم الهاتف',
    branchPlaceholder: 'اختر الفرع',
    departmentPlaceholder: 'اختر القسم',
    passwordPlaceholder: 'أدخل كلمة المرور',
    update: 'تحديث المستخدم',
    requiredFields: 'يرجى ملء جميع الحقول المطلوبة',
    usernameExists: 'اسم المستخدم مستخدم بالفعل، اختر اسمًا آخر',
    emailExists: 'الإيميل مستخدم بالفعل، اختر إيميل آخر',
    unauthorized: 'غير مصرح لك بالوصول',
    fetchError: 'حدث خطأ أثناء جلب البيانات',
    updateError: 'حدث خطأ أثناء تحديث المستخدم',
    createError: 'حدث خطأ أثناء إنشاء المستخدم',
    added: 'تم إضافة المستخدم بنجاح',
    updated: 'تم تحديث المستخدم بنجاح',
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
    confirmDelete: 'تأكيد حذف المستخدم',
    deleteWarning: 'هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع عن هذا الإجراء.',
    deleteError: 'حدث خطأ أثناء حذف المستخدم',
    deleted: 'تم حذف المستخدم بنجاح',
    profile: 'عرض التفاصيل',
    viewCurrentPassword: 'عرض كلمة المرور الحالية',
    currentPassword: 'كلمة المرور الحالية',
    status: 'الحالة',
    active: 'نشط',
    inactive: 'غير نشط',
    address: 'العنوان',
    city: 'المدينة',
    branchDetails: 'تفاصيل الفرع',
  },
  en: {
    manage: 'Manage Users',
    add: 'Add User',
    addFirst: 'Add First User',
    noUsers: 'No Users Found',
    noMatch: 'No Matching Users',
    empty: 'No Users Available',
    searchPlaceholder: 'Search users...',
    role: 'Role',
    allRoles: 'All Roles',
    admin: 'Admin',
    branch: 'Branch',
    chef: 'Chef',
    production: 'Production',
    previous: 'Previous',
    next: 'Next',
    page: 'Page',
    of: 'of',
    username: 'Username',
    email: 'Email',
    phone: 'Phone',
    department: 'Department',
    createdAt: 'Created At',
    updatedAt: 'Updated At',
    edit: 'Edit',
    resetPassword: 'Change Password',
    delete: 'Delete',
    name: 'User Name (Arabic)',
    nameEn: 'User Name (English)',
    nameRequired: 'User name is required',
    nameEnRequired: 'User name in English is required',
    usernameRequired: 'Username is required',
    passwordRequired: 'Password is required',
    branchRequired: 'Branch is required',
    departmentRequired: 'Department is required',
    namePlaceholder: 'Enter user name',
    nameEnPlaceholder: 'Enter user name in English',
    usernamePlaceholder: 'Enter username',
    emailPlaceholder: 'Enter email',
    phonePlaceholder: 'Enter phone number',
    branchPlaceholder: 'Select branch',
    departmentPlaceholder: 'Select department',
    passwordPlaceholder: 'Enter password',
    update: 'Update User',
    requiredFields: 'Please fill all required fields',
    usernameExists: 'Username is already in use, choose another',
    emailExists: 'Email is already in use, choose another',
    unauthorized: 'You are not authorized to access',
    fetchError: 'An error occurred while fetching data',
    updateError: 'An error occurred while updating the user',
    createError: 'An error occurred while creating the user',
    added: 'User added successfully',
    updated: 'User updated successfully',
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
    confirmDelete: 'Confirm User Deletion',
    deleteWarning: 'Are you sure you want to delete this user? This action cannot be undone.',
    deleteError: 'An error occurred while deleting the user',
    deleted: 'User deleted successfully',
    profile: 'View Details',
    viewCurrentPassword: 'View Current Password',
    currentPassword: 'Current Password',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    address: 'Address',
    city: 'City',
    branchDetails: 'Branch Details',
  },
};

export const Users: React.FC = () => {
  const { language } = useLanguage();
  const { user: loggedInUser } = useAuth();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
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
      const [usersResponse, branchesResponse, departmentsResponse] = await Promise.all([
        usersAPI.getAll({ role: filterRole === 'all' ? undefined : filterRole, page, limit: 10 }),
        branchesAPI.getAll(),
        departmentAPI.getAll(),
      ]);
      const fetchedUsers = Array.isArray(usersResponse.data) ? usersResponse.data : usersResponse;
      setUsers(fetchedUsers.map((user: User) => ({ ...user, password: '********' })));
      setBranches(Array.isArray(branchesResponse.data) ? branchesResponse.data : branchesResponse);
      setDepartments(Array.isArray(departmentsResponse.data) ? departmentsResponse.data : departmentsResponse);
      setTotalPages(usersResponse.totalPages || Math.ceil(fetchedUsers.length / 10));
      setError('');
    } catch (err: any) {
      setError(err.message || t.fetchError);
      toast.error(t.fetchError, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setLoading(false);
    }
  }, [loggedInUser, filterRole, page, t, isRtl]);

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
    if (!formData.name) errors.name = t.nameRequired;
    if (!formData.nameEn) errors.nameEn = t.nameEnRequired;
    if (!formData.username) errors.username = t.usernameRequired;
    if (!isEditMode && !formData.password) errors.password = t.passwordRequired;
    if (formData.role === 'branch' && !formData.branch) errors.branch = t.branchRequired;
    if (formData.role === 'chef' && !formData.department) errors.department = t.departmentRequired;
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
    setSelectedUser(null);
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
    setSelectedUser(user);
    setIsModalOpen(true);
    setFormErrors({});
    setError('');
  };

  const openProfileModal = (user: User) => {
    setSelectedUser(user);
    setIsProfileModalOpen(true);
  };

  const openResetPasswordModal = (user: User) => {
    setSelectedUser(user);
    setResetPasswordData({ password: '', confirmPassword: '' });
    setIsResetPasswordModalOpen(true);
    setError('');
  };

  const openDeleteModal = (user: User) => {
    setSelectedUser(user);
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
      if (isEditMode && selectedUser) {
        await usersAPI.update(selectedUser._id, userData);
        setUsers(users.map((u) => (u._id === selectedUser._id ? { ...u, ...userData } : u)));
        toast.success(t.updated, { position: isRtl ? 'top-right' : 'top-left' });
      } else {
        const response = await usersAPI.create(userData);
        setUsers([...users, { ...response, password: '********' }]);
        toast.success(t.added, { position: isRtl ? 'top-right' : 'top-left' });
      }
      setIsModalOpen(false);
      setError('');
      fetchData();
    } catch (err: any) {
      let errorMessage = isEditMode ? t.updateError : t.createError;
      if (err.response?.data?.message) {
        const message = err.response.data.message;
        errorMessage =
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
      await usersAPI.resetPassword(selectedUser!._id, resetPasswordData.password);
      setUsers(users.map((u) => (u._id === selectedUser!._id ? { ...u, password: '********' } : u)));
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
    if (!selectedUser) return;
    try {
      await usersAPI.delete(selectedUser._id);
      setUsers(users.filter((u) => u._id !== selectedUser._id));
      toast.success(t.deleted, { position: isRtl ? 'top-right' : 'top-left' });
      setIsDeleteModalOpen(false);
      setError('');
    } catch (err: any) {
      const errorMessage = err.message || t.deleteError;
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  const togglePasswordVisibility = (userId: string) => {
    setShowPassword((prev) => ({ ...prev, [userId]: !prev[userId] }));
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
          <User className="w-8 h-8 text-amber-600" />
          {t.manage}
        </h1>
        {loggedInUser?.role === 'admin' && (
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
              label={t.role}
              options={[
                { value: 'all', label: t.allRoles },
                { value: 'admin', label: t.admin },
                { value: 'branch', label: t.branch },
                { value: 'chef', label: t.chef },
                { value: 'production', label: t.production },
              ]}
              value={filterRole}
              onChange={(value) => setFilterRole(value)}
              className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 transition-colors bg-amber-50"
              aria-label={t.role}
            />
          </div>
        </div>
        {totalPages > 1 && (
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
        )}
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
            <h3 className="text-xl font-semibold text-amber-900">{t.noUsers}</h3>
            <p className="text-gray-600 mt-2">
              {searchTerm || filterRole !== 'all' ? t.noMatch : t.empty}
            </p>
            {loggedInUser?.role === 'admin' && !searchTerm && filterRole === 'all' && (
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
          filteredUsers.map((user) => (
            <motion.div
              key={user._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer" onClick={() => openProfileModal(user)}>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-lg text-amber-900 truncate">{isRtl ? user.name : user.nameEn || user.name}</h3>
                    <User className="w-6 h-6 text-amber-600" />
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="text-gray-600 flex"><span className="w-24 font-medium">{t.username}:</span> <span className="truncate">{user.username}</span></p>
                    <p className="text-gray-600 flex"><span className="w-24 font-medium">{t.email}:</span> <span className="truncate">{user.email || '-'}</span></p>
                    <p className="text-gray-600 flex"><span className="w-24 font-medium">{t.phone}:</span> <span>{user.phone || '-'}</span></p>
                    <p className="text-gray-600 flex"><span className="w-24 font-medium">{t.role}:</span> <span>{t[user.role]}</span></p>
                    {user.role === 'branch' && user.branch && (
                      <>
                        <p className="text-gray-600 flex"><span className="w-24 font-medium">{t.branch}:</span> <span>{isRtl ? user.branch.name : user.branch.nameEn || user.branch.name}</span></p>
                        <p className="text-gray-600 flex"><span className="w-24 font-medium">{t.address}:</span> <span>{user.branch.address}</span></p>
                        <p className="text-gray-600 flex"><span className="w-24 font-medium">{t.city}:</span> <span>{isRtl ? user.branch.city : user.branch.cityEn || user.branch.city}</span></p>
                      </>
                    )}
                    {user.role === 'chef' && (
                      <p className="text-gray-600 flex"><span className="w-24 font-medium">{t.department}:</span> <span>{user.department?.name || '-'}</span></p>
                    )}
                    <p className={`flex ${user.isActive ? 'text-green-600' : 'text-red-600'}`}>
                      <span className="w-24 font-medium">{t.status}:</span> <span>{user.isActive ? t.active : t.inactive}</span>
                    </p>
                  </div>
                  {loggedInUser?.role === 'admin' && (
                    <div className="flex gap-3 mt-4">
                      <Button
                        variant="outline"
                        icon={Edit2}
                        onClick={(e) => { e.stopPropagation(); openEditModal(user); }}
                        className="text-amber-600 hover:text-amber-800 border-amber-600"
                      >
                        {t.edit}
                      </Button>
                      <Button
                        variant="outline"
                        icon={Key}
                        onClick={(e) => { e.stopPropagation(); openResetPasswordModal(user); }}
                        className="text-blue-500 hover:text-blue-700 border-blue-500"
                      >
                        {t.resetPassword}
                      </Button>
                      <Button
                        variant="outline"
                        icon={Trash2}
                        onClick={(e) => { e.stopPropagation(); openDeleteModal(user); }}
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
                label={t.username}
                value={formData.username}
                onChange={(value) => setFormData({ ...formData, username: value })}
                placeholder={t.usernamePlaceholder}
                required
                error={formErrors.username}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t.email}
                value={formData.email}
                onChange={(value) => setFormData({ ...formData, email: value })}
                placeholder={t.emailPlaceholder}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              <Input
                label={t.phone}
                value={formData.phone}
                onChange={(value) => setFormData({ ...formData, phone: value })}
                placeholder={t.phonePlaceholder}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
            </div>
            <div className="space-y-6">
              <Select
                label={t.role}
                options={[
                  { value: 'admin', label: t.admin },
                  { value: 'branch', label: t.branch },
                  { value: 'chef', label: t.chef },
                  { value: 'production', label: t.production },
                ]}
                value={formData.role}
                onChange={(value) => setFormData({ ...formData, role: value as 'admin' | 'branch' | 'chef' | 'production', branch: value === 'branch' ? formData.branch : '', department: value === 'chef' ? formData.department : '' })}
                className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
              />
              {formData.role === 'branch' && (
                <Select
                  label={t.branch}
                  options={branches.map((branch) => ({ value: branch._id, label: isRtl ? branch.name : branch.nameEn || branch.name }))}
                  value={formData.branch}
                  onChange={(value) => setFormData({ ...formData, branch: value })}
                  placeholder={t.branchPlaceholder}
                  required
                  error={formErrors.branch}
                  className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
                />
              )}
              {formData.role === 'chef' && (
                <Select
                  label={t.department}
                  options={departments.map((dept) => ({ value: dept._id, label: dept.name }))}
                  value={formData.department}
                  onChange={(value) => setFormData({ ...formData, department: value })}
                  placeholder={t.departmentPlaceholder}
                  required
                  error={formErrors.department}
                  className="border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
                />
              )}
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
              {!isEditMode && (
                <Input
                  label={t.password}
                  value={formData.password}
                  onChange={(value) => setFormData({ ...formData, password: value })}
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
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        title={t.profile}
        size="lg"
      >
        {selectedUser && (
          <div className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="flex items-center gap-3">
              <User className="w-8 h-8 text-amber-600" />
              <h3 className="text-xl font-semibold text-amber-900">{isRtl ? selectedUser.name : selectedUser.nameEn || selectedUser.name}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 font-medium">{t.username}</p>
                <p className="text-gray-800">{selectedUser.username}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">{t.email}</p>
                <p className="text-gray-800">{selectedUser.email || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">{t.phone}</p>
                <p className="text-gray-800">{selectedUser.phone || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">{t.role}</p>
                <p className="text-gray-800">{t[selectedUser.role]}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">{t.status}</p>
                <p className={`font-medium ${selectedUser.isActive ? 'text-green-600' : 'text-red-600'}`}>
                  {selectedUser.isActive ? t.active : t.inactive}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">{t.createdAt}</p>
                <p className="text-gray-800">{new Date(selectedUser.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">{t.updatedAt}</p>
                <p className="text-gray-800">{new Date(selectedUser.updatedAt).toLocaleString()}</p>
              </div>
              {loggedInUser?.role === 'admin' && (
                <div>
                  <p className="text-sm text-gray-600 font-medium">{t.currentPassword}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-gray-800">{showPassword[selectedUser._id] ? selectedUser.password : '********'}</p>
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility(selectedUser._id)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      {showPassword[selectedUser._id] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
            {selectedUser.role === 'branch' && selectedUser.branch && (
              <div className="border-t border-amber-100 pt-4">
                <h4 className="text-lg font-semibold text-amber-900 mb-3 flex items-center gap-2">
                  <MapPin className="w-6 h-6 text-amber-600" />
                  {t.branchDetails}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">{t.branch}</p>
                    <p className="text-gray-800">{isRtl ? selectedUser.branch.name : selectedUser.branch.nameEn || selectedUser.branch.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">{t.address}</p>
                    <p className="text-gray-800">{selectedUser.branch.address}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">{t.city}</p>
                    <p className="text-gray-800">{isRtl ? selectedUser.branch.city : selectedUser.branch.cityEn || selectedUser.branch.city}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">{t.phone}</p>
                    <p className="text-gray-800">{selectedUser.branch.phone || '-'}</p>
                  </div>
                </div>
              </div>
            )}
            {selectedUser.role === 'chef' && selectedUser.department && (
              <div className="border-t border-amber-100 pt-4">
                <h4 className="text-lg font-semibold text-amber-900 mb-3">{t.department}</h4>
                <p className="text-gray-800">{selectedUser.department.name}</p>
              </div>
            )}
            <Button
              variant="secondary"
              onClick={() => setIsProfileModalOpen(false)}
              className="mt-6 w-full bg-gray-200 hover:bg-gray-300 text-amber-900 rounded-lg px-6 py-3 shadow-md transition-transform transform hover:scale-105"
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
              className="flex-1 bg-gray-200 hover:bg-amber-300 text-amber-900 rounded-lg px-6 py-3 shadow-md transition-transform transform hover:scale-105"
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

export default Users;