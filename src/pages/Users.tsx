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
import { User, Search, AlertCircle, Plus, Edit2, Trash2, Key, Eye, EyeOff } from 'lucide-react';
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
  branch?: { _id: string; name: string; nameEn?: string; address?: string; addressEn?: string; city?: string; cityEn?: string };
  department?: { _id: string; name: string };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  password?: string;
}

interface Branch {
  _id: string;
  name: string;
  nameEn?: string;
  address?: string;
  addressEn?: string;
  city?: string;
  cityEn?: string;
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
    address: 'العنوان',
    addressEn: 'العنوان (إنجليزي)',
    city: 'المدينة',
    cityEn: 'المدينة (إنجليزي)',
    nameRequired: 'اسم المستخدم مطلوب',
    nameEnRequired: 'اسم المستخدم بالإنجليزية مطلوب',
    usernameRequired: 'اسم المستخدم للدخول مطلوب',
    passwordRequired: 'كلمة المرور مطلوبة',
    branchRequired: 'الفرع مطلوب',
    departmentRequired: 'القسم مطلوب',
    addressRequired: 'العنوان مطلوب',
    cityRequired: 'المدينة مطلوبة',
    namePlaceholder: 'أدخل اسم المستخدم',
    nameEnPlaceholder: 'أدخل اسم المستخدم بالإنجليزية',
    usernamePlaceholder: 'أدخل اسم المستخدم للدخول',
    emailPlaceholder: 'أدخل الإيميل',
    phonePlaceholder: 'أدخل رقم الهاتف',
    branchPlaceholder: 'اختر الفرع',
    departmentPlaceholder: 'اختر القسم',
    addressPlaceholder: 'أدخل العنوان',
    addressEnPlaceholder: 'أدخل العنوان بالإنجليزية',
    cityPlaceholder: 'أدخل المدينة',
    cityEnPlaceholder: 'أدخل المدينة بالإنجليزية',
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
    address: 'Address',
    addressEn: 'Address (English)',
    city: 'City',
    cityEn: 'City (English)',
    nameRequired: 'User name is required',
    nameEnRequired: 'User name in English is required',
    usernameRequired: 'Username is required',
    passwordRequired: 'Password is required',
    branchRequired: 'Branch is required',
    departmentRequired: 'Department is required',
    addressRequired: 'Address is required',
    cityRequired: 'City is required',
    namePlaceholder: 'Enter user name',
    nameEnPlaceholder: 'Enter user name in English',
    usernamePlaceholder: 'Enter username',
    emailPlaceholder: 'Enter email',
    phonePlaceholder: 'Enter phone number',
    branchPlaceholder: 'Select branch',
    departmentPlaceholder: 'Select department',
    addressPlaceholder: 'Enter address',
    addressEnPlaceholder: 'Enter address in English',
    cityPlaceholder: 'Enter city',
    cityEnPlaceholder: 'Enter city in English',
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
    address: '',
    addressEn: '',
    city: '',
    cityEn: '',
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
    if (formData.role === 'branch' && !formData.address) errors.address = t.addressRequired;
    if (formData.role === 'branch' && !formData.city) errors.city = t.cityRequired;
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
      address: '',
      addressEn: '',
      city: '',
      cityEn: '',
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
      address: user.branch?.address || '',
      addressEn: user.branch?.addressEn || '',
      city: user.branch?.city || '',
      cityEn: user.branch?.cityEn || '',
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

      const branchData = formData.role === 'branch' ? {
        address: formData.address.trim(),
        addressEn: formData.addressEn.trim() || undefined,
        city: formData.city.trim(),
        cityEn: formData.cityEn.trim() || undefined,
      } : {};

      if (isEditMode && selectedUser) {
        await usersAPI.update(selectedUser._id, userData);
        if (formData.role === 'branch' && formData.branch) {
          await branchesAPI.update(formData.branch, branchData);
        }
        setUsers(users.map((u) => (u._id === selectedUser._id ? { ...u, ...userData, branch: { ...u.branch, ...branchData } } : u)));
        toast.success(t.updated, { position: isRtl ? 'top-right' : 'top-left' });
      } else {
        const response = await usersAPI.create(userData);
        if (formData.role === 'branch' && formData.branch) {
          await branchesAPI.update(formData.branch, branchData);
        }
        setUsers([...users, { ...response, password: '********', branch: { ...response.branch, ...branchData } }]);
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
    <div className={`mx-auto max-w-6xl p-4 sm:p-6 min-h-screen bg-gray-100 font-sans ${isRtl ? 'rtl font-arabic' : 'ltr'}`}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4"
      >
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <User className="w-5 h-5 text-amber-500" />
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
        <div className="flex flex-col sm:flex-row gap-3 items-center">
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
          <div className="flex-1 w-full sm:w-auto">
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
              className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 transition-colors bg-white text-sm"
              aria-label={t.role}
            />
          </div>
        </div>
      </Card>

      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ staggerChildren: 0.1 }}
      >
        {filteredUsers.length === 0 ? (
          <Card className="p-6 text-center bg-white rounded-2xl shadow-sm col-span-full">
            <User className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-800">{t.noUsers}</h3>
            <p className="text-gray-500 text-xs mt-2">
              {searchTerm || filterRole !== 'all' ? t.noMatch : t.empty}
            </p>
            {loggedInUser?.role === 'admin' && !searchTerm && filterRole === 'all' && (
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
          filteredUsers.map((user) => (
            <motion.div
              key={user._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer" onClick={() => openProfileModal(user)}>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm text-gray-800 truncate">{isRtl ? user.name : user.nameEn || user.name}</h3>
                    <User className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="text-gray-600 flex"><span className="w-16 font-medium">{t.username}:</span> <span className="truncate">{user.username}</span></p>
                    <p className="text-gray-600 flex"><span className="w-16 font-medium">{t.email}:</span> <span className="truncate">{user.email || '-'}</span></p>
                    <p className="text-gray-600 flex"><span className="w-16 font-medium">{t.phone}:</span> <span>{user.phone || '-'}</span></p>
                    <p className="text-gray-600 flex"><span className="w-16 font-medium">{t.role}:</span> <span>{t[user.role]}</span></p>
                    {user.role === 'branch' && (
                      <>
                        <p className="text-gray-600 flex"><span className="w-16 font-medium">{t.branch}:</span> <span>{user.branch ? (isRtl ? user.branch.name : user.branch.nameEn || user.branch.name) : '-'}</span></p>
                        <p className="text-gray-600 flex"><span className="w-16 font-medium">{t.address}:</span> <span>{user.branch ? (isRtl ? user.branch.address : user.branch.addressEn || user.branch.address) || '-' : '-'}</span></p>
                        <p className="text-gray-600 flex"><span className="w-16 font-medium">{t.city}:</span> <span>{user.branch ? (isRtl ? user.branch.city : user.branch.cityEn || user.branch.city) || '-' : '-'}</span></p>
                      </>
                    )}
                    {user.role === 'chef' && (
                      <p className="text-gray-600 flex"><span className="w-16 font-medium">{t.department}:</span> <span>{user.department?.name || '-'}</span></p>
                    )}
                    <p className={`flex ${user.isActive ? 'text-green-600' : 'text-red-600'}`}>
                      <span className="w-16 font-medium">{t.status}:</span> <span>{user.isActive ? t.active : t.inactive}</span>
                    </p>
                  </div>
                  {loggedInUser?.role === 'admin' && (
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="outline"
                        icon={Edit2}
                        onClick={(e) => { e.stopPropagation(); openEditModal(user); }}
                        className="text-amber-500 hover:text-amber-600 border-amber-500 rounded-full text-xs px-3 py-1"
                      >
                        {t.edit}
                      </Button>
                      <Button
                        variant="outline"
                        icon={Key}
                        onClick={(e) => { e.stopPropagation(); openResetPasswordModal(user); }}
                        className="text-blue-500 hover:text-blue-600 border-blue-500 rounded-full text-xs px-3 py-1"
                      >
                        {t.resetPassword}
                      </Button>
                      <Button
                        variant="outline"
                        icon={Trash2}
                        onClick={(e) => { e.stopPropagation(); openDeleteModal(user); }}
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
                label={t.username}
                value={formData.username}
                onChange={(value) => setFormData({ ...formData, username: value })}
                placeholder={t.usernamePlaceholder}
                required
                error={formErrors.username}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
              <Input
                label={t.email}
                value={formData.email}
                onChange={(value) => setFormData({ ...formData, email: value })}
                placeholder={t.emailPlaceholder}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
              <Input
                label={t.phone}
                value={formData.phone}
                onChange={(value) => setFormData({ ...formData, phone: value })}
                placeholder={t.phonePlaceholder}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
            </div>
            <div className="space-y-4">
              <Select
                label={t.role}
                options={[
                  { value: 'admin', label: t.admin },
                  { value: 'branch', label: t.branch },
                  { value: 'chef', label: t.chef },
                  { value: 'production', label: t.production },
                ]}
                value={formData.role}
                onChange={(value) => setFormData({ ...formData, role: value as 'admin' | 'branch' | 'chef' | 'production', branch: value === 'branch' ? formData.branch : '', department: value === 'chef' ? formData.department : '', address: value === 'branch' ? formData.address : '', addressEn: value === 'branch' ? formData.addressEn : '', city: value === 'branch' ? formData.city : '', cityEn: value === 'branch' ? formData.cityEn : '' })}
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
              />
              {formData.role === 'branch' && (
                <>
                  <Select
                    label={t.branch}
                    options={branches.map((branch) => ({ value: branch._id, label: isRtl ? branch.name : branch.nameEn || branch.name }))}
                    value={formData.branch}
                    onChange={(value) => setFormData({ ...formData, branch: value })}
                    placeholder={t.branchPlaceholder}
                    required
                    error={formErrors.branch}
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
                    label={t.addressEn}
                    value={formData.addressEn}
                    onChange={(value) => setFormData({ ...formData, addressEn: value })}
                    placeholder={t.addressEnPlaceholder}
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
                    label={t.cityEn}
                    value={formData.cityEn}
                    onChange={(value) => setFormData({ ...formData, cityEn: value })}
                    placeholder={t.cityEnPlaceholder}
                    className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
                  />
                </>
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
                  className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
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
                className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm transition-all duration-200"
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
        {selectedUser && (
          <div className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-semibold text-gray-800">{isRtl ? selectedUser.name : selectedUser.nameEn || selectedUser.name}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex flex-row items-center gap-2">
                <span className="w-20 font-medium text-gray-600">{t.username}:</span>
                <span className="text-gray-800 truncate">{comparedUser.username}</span>
              </div>
              <div className="flex flex-row items-center gap-2">
                <span className="w-20 font-medium text-gray-600">{t.email}:</span>
                <span className="text-gray-800 truncate">{selectedUser.email || '-'}</span>
              </div>
              <div className="flex flex-row items-center gap-2">
                <span className="w-20 font-medium text-gray-600">{t.phone}:</span>
                <span className="text-gray-800">{selectedUser.phone || '-'}</span>
              </div>
              <div className="flex flex-row items-center gap-2">
                <span className="w-20 font-medium text-gray-600">{t.role}:</span>
                <span className="text-gray-800">{t[selectedUser.role]}</span>
              </div>
              {selectedUser.role === 'branch' && (
                <>
                  <div className="flex flex-row items-center gap-2">
                    <span className="w-20 font-medium text-gray-600">{t.branch}:</span>
                    <span className="text-gray-800">{selectedUser.branch ? (isRtl ? selectedUser.branch.name : selectedUser.branch.nameEn || selectedUser.branch.name) : '-'}</span>
                  </div>
                  <div className="flex flex-row items-center gap-2">
                    <span className="w-20 font-medium text-gray-600">{t.address}:</span>
                    <span className="text-gray-800">{selectedUser.branch ? (isRtl ? selectedUser.branch.address : selectedUser.branch.addressEn || selectedUser.branch.address) || '-' : '-'}</span>
                  </div>
                  <div className="flex flex-row items-center gap-2">
                    <span className="w-20 font-medium text-gray-600">{t.city}:</span>
                    <span className="text-gray-800">{selectedUser.branch ? (isRtl ? selectedUser.branch.city : selectedUser.branch.cityEn || selectedUser.branch.city) || '-' : '-'}</span>
                  </div>
                </>
              )}
              {selectedUser.role === 'chef' && (
                <div className="flex flex-row items-center gap-2">
                  <span className="w-20 font-medium text-gray-600">{t.department}:</span>
                  <span className="text-gray-800">{selectedUser.department?.name || '-'}</span>
                </div>
              )}
              <div className="flex flex-row items-center gap-2">
                <span className="w-20 font-medium text-gray-600">{t.status}:</span>
                <span className={`font-medium ${selectedUser.isActive ? 'text-green-600' : 'text-red-600'}`}>
                  {selectedUser.isActive ? t.active : t.inactive}
                </span>
              </div>
              <div className="flex flex-row items-center gap-2">
                <span className="w-20 font-medium text-gray-600">{t.createdAt}:</span>
                <span className="text-gray-800">{new Date(selectedUser.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex flex-row items-center gap-2">
                <span className="w-20 font-medium text-gray-600">{t.updatedAt}:</span>
                <span className="text-gray-800">{new Date(selectedUser.updatedAt).toLocaleString()}</span>
              </div>
              {loggedInUser?.role === 'admin' && (
                <div className="flex flex-row items-center gap-2">
                  <span className="w-20 font-medium text-gray-600">{t.currentPassword}:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-800">{showPassword[selectedUser._id] ? selectedUser.password : '********'}</span>
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility(selectedUser._id)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      {showPassword[selectedUser._id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
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

export default Users;