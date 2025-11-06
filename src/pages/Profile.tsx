import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { Modal } from '../components/UI/Modal';
import { AlertCircle, Edit2, Key, Eye, EyeOff, Save, X, Check } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';

interface Department {
  _id: string;
  name: string;
  nameEn?: string;
  code: string;
  description?: string;
}

interface Branch {
  _id: string;
  name: string;
  nameEn?: string;
  code: string;
  address: string;
  city: string;
  phone?: string;
}

interface ChefProfile {
  _id: string;
  status: 'active' | 'inactive';
  department?: Department;
}

interface ProfileData {
  _id: string;
  name: string;
  nameEn?: string;
  username: string;
  email?: string;
  phone?: string;
  role: 'admin' | 'branch' | 'chef' | 'production';
  branch?: Branch;
  department?: Department;
  chefProfile?: ChefProfile;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  permissions: string[];
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
    branchCode: 'كود الفرع',
    branchAddress: 'عنوان الفرع',
    branchCity: 'المدينة',
    department: 'القسم',
    departmentCode: 'كود القسم',
    departmentDescription: 'وصف القسم',
    chefStatus: 'حالة الشيف',
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
    nameRequired: 'الاسم مطلوب',
    nameEnRequired: 'الاسم الإنجليزي مطلوب',
    cancel: 'إلغاء',
    save: 'حفظ',
    editing: 'جاري التعديل...',
    saved: 'تم الحفظ',
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
    branchCode: 'Branch Code',
    branchAddress: 'Branch Address',
    branchCity: 'City',
    department: 'Department',
    departmentCode: 'Department Code',
    departmentDescription: 'Department Description',
    chefStatus: 'Chef Status',
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
    nameRequired: 'Name is required',
    nameEnRequired: 'English name is required',
    cancel: 'Cancel',
    save: 'Save',
    editing: 'Editing...',
    saved: 'Saved',
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
  const [isEditMode, setIsEditMode] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', nameEn: '', phone: '', email: '' });
  const [passwordData, setPasswordData] = useState({ password: '', confirmPassword: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState({ password: false, confirmPassword: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const response = await authAPI.getProfile();
        setProfile(response.user);
        setFormData({
          name: response.user.name,
          nameEn: response.user.nameEn || '',
          phone: response.user.phone || '',
          email: response.user.email || '',
        });
        setError('');
      } catch (err: any) {
        setError(err.message || t.updateError);
        toast.error(t.updateError, { position: isRtl ? 'top-right' : 'top-left' });
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [isRtl, t.updateError]);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = t.nameRequired;
    if (!formData.nameEn.trim()) errors.nameEn = t.nameEnRequired;
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validatePasswordForm = () => {
    const errors: Record<string, string> = {};
    if (!passwordData.password) errors.password = t.passwordRequired;
    if (!passwordData.confirmPassword) errors.confirmPassword = t.passwordRequired;
    if (passwordData.password !== passwordData.confirmPassword) errors.confirmPassword = t.passwordMismatch;
    if (passwordData.password && passwordData.password.length < 6) errors.password = t.passwordTooShort;
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      const response = await authAPI.updateProfile({
        name: formData.name,
        nameEn: formData.nameEn,
        phone: formData.phone,
        email: formData.email,
      });
      setProfile(response.user);
      updateUser(response.user);
      setIsEditMode(false);
      toast.success(t.updateSuccess, { position: isRtl ? 'top-right' : 'top-left' });
    } catch (err: any) {
      setError(err.message || t.updateError);
      toast.error(t.updateError, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePasswordForm()) return;
    try {
      const response = await authAPI.updateProfile({ password: passwordData.password });
      setProfile(response.user);
      updateUser(response.user);
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
      <div className="flex items-center justify-center min-h-screen">
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
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8" dir={isRtl ? 'rtl' : 'ltr'}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-amber-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <Edit2 className="w-5 h-5 text-amber-700" />
            </div>
            {t.profile}
          </h1>
          {!isEditMode && (
            <Button
              variant="outline"
              icon={Edit2}
              onClick={() => setIsEditMode(true)}
              className="bg-white border-amber-400 text-amber-700 hover:bg-amber-50 rounded-full shadow-sm transition-all hover:shadow-md"
            >
              {t.editProfile}
            </Button>
          )}
        </div>

        <Card className="p-6 lg:p-8 bg-gradient-to-br from-amber-50 to-white rounded-3xl shadow-lg border border-amber-100">
          <AnimatePresence mode="wait">
            {isEditMode ? (
              <motion.div
                key="edit"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Input
                    label={t.name}
                    value={formData.name}
                    onChange={(value) => setFormData({ ...formData, name: value })}
                    required
                    error={formErrors.name}
                    className="bg-white border-amber-200 focus:border-amber-500 focus:ring-amber-500 rounded-xl text-base"
                    placeholder="أدخل الاسم بالعربي"
                  />
                  <Input
                    label={t.nameEn}
                    value={formData.nameEn}
                    onChange={(value) => setFormData({ ...formData, nameEn: value })}
                    required
                    error={formErrors.nameEn}
                    className="bg-white border-amber-200 focus:border-amber-500 focus:ring-amber-500 rounded-xl text-base"
                    placeholder="Enter English name"
                  />
                  <Input
                    label={t.email}
                    value={formData.email}
                    onChange={(value) => setFormData({ ...formData, email: value })}
                    type="email"
                    className="bg-white border-amber-200 focus:border-amber-500 focus:ring-amber-500 rounded-xl text-base"
                    placeholder="email@example.com"
                  />
                  <Input
                    label={t.phone}
                    value={formData.phone}
                    onChange={(value) => setFormData({ ...formData, phone: value })}
                    className="bg-white border-amber-200 focus:border-amber-500 focus:ring-amber-500 rounded-xl text-base"
                    placeholder="+201xxxxxxxxx"
                  />
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700"
                  >
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm">{error}</span>
                  </motion.div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-full px-6 py-3 font-medium shadow-md transition-all hover:shadow-lg flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {t.editing}
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        {t.save}
                      </>
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setIsEditMode(false)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full px-6 py-3 font-medium transition-all flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    {t.cancel}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 text-sm">
                  <InfoItem label={t.name} value={profile.name} />
                  <InfoItem label={t.nameEn} value={profile.nameEn || '—'} />
                  <InfoItem label={t.username} value={profile.username} />
                  <InfoItem label={t.email} value={profile.email || '—'} />
                  <InfoItem label={t.phone} value={profile.phone || '—'} />
                  <InfoItem label={t.role} value={t[profile.role] || profile.role} highlight />

                  {profile.branch && (
                    <>
                      <InfoItem label={t.branch} value={isRtl ? profile.branch.name : profile.branch.nameEn || profile.branch.name} />
                      <InfoItem label={t.branchCode} value={profile.branch.code} />
                      <InfoItem label={t.branchAddress} value={profile.branch.address} />
                      <InfoItem label={t.branchCity} value={profile.branch.city} />
                    </>
                  )}

                  {profile.department && (
                    <>
                      <InfoItem label={t.department} value={isRtl ? profile.department.name : profile.department.nameEn || profile.department.name} />
                      <InfoItem label={t.departmentCode} value={profile.department.code} />
                      <InfoItem label={t.departmentDescription} value={profile.department.description || '—'} />
                    </>
                  )}

                  {profile.chefProfile && (
                    <InfoItem
                      label={t.chefStatus}
                      value={profile.chefProfile.status === 'active' ? t.active : t.inactive}
                      status={profile.chefProfile.status}
                    />
                  )}

                  <InfoItem
                    label={t.status}
                    value={profile.isActive ? t.active : t.inactive}
                    status={profile.isActive ? 'active' : 'inactive'}
                  />

                  <InfoItem label={t.createdAt} value={new Date(profile.createdAt).toLocaleString()} />
                  <InfoItem label={t.updatedAt} value={new Date(profile.updatedAt).toLocaleString()} />
                </div>

                <div className="flex gap-3 pt-4 border-t border-amber-100">
                  <Button
                    variant="outline"
                    icon={Key}
                    onClick={() => setIsChangePasswordModalOpen(true)}
                    className="flex-1 bg-white border-blue-400 text-blue-600 hover:bg-blue-50 rounded-full shadow-sm transition-all hover:shadow-md"
                  >
                    {t.changePassword}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>

      {/* Password Modal */}
      <Modal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
        title={t.changePassword}
        size="md"
      >
        <form onSubmit={handleChangePassword} className="space-y-5">
          <Input
            label={t.newPassword}
            value={passwordData.password}
            onChange={(value) => setPasswordData({ ...passwordData, password: value })}
            type={showPassword.password ? 'text' : 'password'}
            required
            error={formErrors.password}
            className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
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
            className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
            icon={showPassword.confirmPassword ? EyeOff : Eye}
            onIconClick={() => setShowPassword({ ...showPassword, confirmPassword: !showPassword.confirmPassword })}
          />
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          <div className="flex gap-3">
            <Button
              type="submit"
              variant="primary"
              className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-full px-6 py-3 shadow-md transition-all hover:shadow-lg"
            >
              {t.save}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsChangePasswordModalOpen(false)}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full px-6 py-3"
            >
              {t.cancel}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// مكون فرعي لعرض الحقول بشكل جميل
const InfoItem: React.FC<{
  label: string;
  value: string;
  highlight?:.boolean;
  status?: 'active' | 'inactive';
}> = ({ label, value, highlight, status }) => {
  const statusColor = status === 'active' ? 'text-green-600' : status === 'inactive' ? 'text-red-600' : 'text-gray-800';
  const bgColor = highlight ? 'bg-amber-50' : 'bg-white';

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`p-4 rounded-2xl border ${highlight ? 'border-amber-300' : 'border-gray-100'} ${bgColor} transition-all`}
    >
      <p className="text-xs font-medium text-amber-700 mb-1">{label}</p>
      <p className={`font-semibold ${statusColor}`}>{value}</p>
    </motion.div>
  );
};