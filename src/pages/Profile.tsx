import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { Modal } from '../components/UI/Modal';
import { AlertCircle, Edit2, Key, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';

interface ProfileData {
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
  createdAt: string;
  updatedAt: string;
}

const translations = {
  ar: {
    profile: 'الملف الشخصي',
    name: 'الاسم (عربي)',
    nameEn: 'الاسم (إنجليزي)',
    username: 'اسم المستخدم',
    email: 'الإيميل',
    phone: 'الهاتف',
    role: 'الدور',
    branch: 'الفرع',
    department: 'القسم',
    status: 'الحالة',
    active: 'نشط',
    inactive: 'غير نشط',
    createdAt: 'تاريخ الإنشاء',
    updatedAt: 'تاريخ التحديث',
    editProfile: 'تعديل الملف',
    changePassword: 'تغيير كلمة المرور',
    newPassword: 'كلمة المرور الجديدة',
    confirmPassword: 'تأكيد كلمة المرور',
    updateSuccess: 'تم التحديث بنجاح',
    updateError: 'خطأ في التحديث',
    passwordMismatch: 'كلمات المرور غير متطابقة',
    passwordTooShort: 'كلمة المرور قصيرة جدًا (6 أحرف على الأقل)',
    passwordRequired: 'كلمة المرور مطلوبة',
    cancel: 'إلغاء',
    save: 'حفظ',
  },
  en: {
    profile: 'Profile',
    name: 'Name (Arabic)',
    nameEn: 'Name (English)',
    username: 'Username',
    email: 'Email',
    phone: 'Phone',
    role: 'Role',
    branch: 'Branch',
    department: 'Department',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    createdAt: 'Created At',
    updatedAt: 'Updated At',
    editProfile: 'Edit Profile',
    changePassword: 'Change Password',
    newPassword: 'New Password',
    confirmPassword: 'Confirm Password',
    updateSuccess: 'Updated successfully',
    updateError: 'Error updating',
    passwordMismatch: 'Passwords do not match',
    passwordTooShort: 'Password too short (at least 6 characters)',
    passwordRequired: 'Password is required',
    cancel: 'Cancel',
    save: 'Save',
  },
};

export function Profile() {
  const { language } = useLanguage();
  const { user: loggedInUser, updateUser } = useAuth();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', nameEn: '' });
  const [passwordData, setPasswordData] = useState({ password: '', confirmPassword: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState({ password: false, confirmPassword: false });

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const response = await authAPI.getProfile();
        setProfile(response.user);
        setFormData({ name: response.user.name, nameEn: response.user.nameEn || '' });
        setError('');
      } catch (err: any) {
        setError(err.message || 'خطأ في جلب الملف الشخصي');
        toast.error('خطأ في جلب الملف الشخصي', { position: isRtl ? 'top-right' : 'top-left' });
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [isRtl]);

  const validateNameForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.name) errors.name = t.nameRequired || 'Name is required';
    if (!formData.nameEn) errors.nameEn = t.nameEnRequired || 'English name is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validatePasswordForm = () => {
    const errors: Record<string, string> = {};
    if (!passwordData.password) errors.password = t.passwordRequired;
    if (!passwordData.confirmPassword) errors.confirmPassword = t.passwordRequired;
    if (passwordData.password !== passwordData.confirmPassword) errors.confirmPassword = t.passwordMismatch;
    if (passwordData.password.length < 6) errors.password = t.passwordTooShort;
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateNameForm()) return;
    try {
      const response = await authAPI.updateProfile({ name: formData.name, nameEn: formData.nameEn });
      setProfile(response.user);
      updateUser(response.user); // Update auth context
      setIsEditModalOpen(false);
      toast.success(t.updateSuccess, { position: isRtl ? 'top-right' : 'top-left' });
    } catch (err: any) {
      setError(err.message || t.updateError);
      toast.error(t.updateError, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePasswordForm()) return;
    try {
      await authAPI.updateProfile({ password: passwordData.password });
      setIsChangePasswordModalOpen(false);
      setPasswordData({ password: '', confirmPassword: '' });
      toast.success(t.updateSuccess, { position: isRtl ? 'top-right' : 'top-left' });
    } catch (err: any) {
      setError(err.message || t.updateError);
      toast.error(t.updateError, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <p className="text-red-500">{error || 'No profile data'}</p>
      </div>
    );
  }

  return (
    <div className={`mx-auto max-w-6xl p-4 sm:p-6 bg-gray-100 ${isRtl ? 'rtl font-arabic' : 'ltr font-sans'}`}>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t.profile}</h1>

      <Card className="p-6 bg-white rounded-2xl shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium text-gray-600">{t.name}</p>
            <p className="text-gray-800">{profile.name}</p>
          </div>
          <div>
            <p className="font-medium text-gray-600">{t.nameEn}</p>
            <p className="text-gray-800">{profile.nameEn || '-'}</p>
          </div>
          <div>
            <p className="font-medium text-gray-600">{t.username}</p>
            <p className="text-gray-800">{profile.username}</p>
          </div>
          <div>
            <p className="font-medium text-gray-600">{t.email}</p>
            <p className="text-gray-800">{profile.email || '-'}</p>
          </div>
          <div>
            <p className="font-medium text-gray-600">{t.phone}</p>
            <p className="text-gray-800">{profile.phone || '-'}</p>
          </div>
          <div>
            <p className="font-medium text-gray-600">{t.role}</p>
            <p className="text-gray-800">{t[profile.role]}</p>
          </div>
          {profile.role === 'branch' && (
            <div>
              <p className="font-medium text-gray-600">{t.branch}</p>
              <p className="text-gray-800">{profile.branch ? (isRtl ? profile.branch.name : profile.branch.nameEn || profile.branch.name) : '-'}</p>
            </div>
          )}
          {profile.role === 'chef' && (
            <div>
              <p className="font-medium text-gray-600">{t.department}</p>
              <p className="text-gray-800">{profile.department?.name || '-'}</p>
            </div>
          )}
          <div>
            <p className="font-medium text-gray-600">{t.status}</p>
            <p className={`font-medium ${profile.isActive ? 'text-green-600' : 'text-red-600'}`}>
              {profile.isActive ? t.active : t.inactive}
            </p>
          </div>
          <div>
            <p className="font-medium text-gray-600">{t.createdAt}</p>
            <p className="text-gray-800">{new Date(profile.createdAt).toLocaleString()}</p>
          </div>
          <div>
            <p className="font-medium text-gray-600">{t.updatedAt}</p>
            <p className="text-gray-800">{new Date(profile.updatedAt).toLocaleString()}</p>
          </div>
        </div>
        <div className="flex gap-4 mt-6">
          <Button
            variant="outline"
            icon={Edit2}
            onClick={() => setIsEditModalOpen(true)}
            className="flex-1 text-amber-500 hover:text-amber-600 border-amber-500 rounded-full text-sm px-4 py-2"
          >
            {t.editProfile}
          </Button>
          <Button
            variant="outline"
            icon={Key}
            onClick={() => setIsChangePasswordModalOpen(true)}
            className="flex-1 text-blue-500 hover:text-blue-600 border-blue-500 rounded-full text-sm px-4 py-2"
          >
            {t.changePassword}
          </Button>
        </div>
      </Card>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={t.editProfile}
        size="md"
      >
        <form onSubmit={handleUpdateName} className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <Input
            label={t.name}
            value={formData.name}
            onChange={(value) => setFormData({ ...formData, name: value })}
            required
            error={formErrors.name}
            className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm"
          />
          <Input
            label={t.nameEn}
            value={formData.nameEn}
            onChange={(value) => setFormData({ ...formData, nameEn: value })}
            required
            error={formErrors.nameEn}
            className="border-gray-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-sm"
          />
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-red-500 text-sm">{error}</span>
            </div>
          )}
          <div className="flex gap-3">
            <Button type="submit" variant="primary" className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-full px-4 py-2 text-sm">
              {t.save}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsEditModalOpen(false)}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full px-4 py-2 text-sm"
            >
              {t.cancel}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
        title={t.changePassword}
        size="md"
      >
        <form onSubmit={handleChangePassword} className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <Input
            label={t.newPassword}
            value={passwordData.password}
            onChange={(value) => setPasswordData({ ...passwordData, password: value })}
            type={showPassword.password ? 'text' : 'password'}
            required
            error={formErrors.password}
            className="border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
            icon={showPassword.password ? EyeOff : Eye}
            onIconClick={() => setShowPassword({ ...showPassword, password: !showPassword.password })}
          />
          <Input
            label={t.confirmPassword}
            value={passwordData.confirmPassword}
            onChange={(value) => setPasswordData({ ...passwordData, confirmPassword: value })}
            type={showPassword.confirmPassword ? 'text' : 'password'}
            required
            error={formErrors.confirmPassword}
            className="border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
            icon={showPassword.confirmPassword ? EyeOff : Eye}
            onIconClick={() => setShowPassword({ ...showPassword, confirmPassword: !showPassword.confirmPassword })}
          />
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-red-500 text-sm">{error}</span>
            </div>
          )}
          <div className="flex gap-3">
            <Button type="submit" variant="primary" className="flex-1 bg-blue-500 hover:bg-blue-600 text-white rounded-full px-4 py-2 text-sm">
              {t.save}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsChangePasswordModalOpen(false)}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full px-4 py-2 text-sm"
            >
              {t.cancel}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}