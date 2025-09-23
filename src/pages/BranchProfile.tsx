import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LanguageContext } from '../contexts/LanguageContext';
import { branchesAPI } from '../services/api';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftIcon, PencilIcon, TrashIcon, KeyIcon } from '@heroicons/react/24/outline';

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
  };
  createdBy?: {
    _id: string;
    name: string;
    nameEn?: string;
    username: string;
  };
  isActive: boolean;
  displayName: string;
  displayAddress: string;
  displayCity: string;
}

const translations = {
  ar: {
    branchDetails: 'تفاصيل الفرع',
    name: 'الاسم',
    nameEn: 'الاسم بالإنجليزية',
    code: 'الكود',
    address: 'العنوان',
    addressEn: 'العنوان بالإنجليزية',
    city: 'المدينة',
    cityEn: 'المدينة بالإنجليزية',
    phone: 'رقم الهاتف',
    user: 'المستخدم',
    username: 'اسم المستخدم',
    email: 'الإيميل',
    isActive: 'مفعل',
    createdBy: 'تم الإنشاء بواسطة',
    editBranch: 'تعديل الفرع',
    deleteBranch: 'حذف الفرع',
    resetPassword: 'إعادة تعيين كلمة المرور',
    save: 'حفظ',
    cancel: 'إلغاء',
    back: 'رجوع',
    newPassword: 'كلمة المرور الجديدة',
    confirmPassword: 'تأكيد كلمة المرور',
    passwordMismatch: 'كلمة المرور غير متطابقة',
    passwordTooShort: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
    branchNotFound: 'الفرع غير موجود',
    serverError: 'خطأ في السيرفر',
    branchUpdated: 'تم تحديث الفرع بنجاح',
    branchDeleted: 'تم حذف الفرع بنجاح',
    passwordReset: 'تم إعادة تعيين كلمة المرور بنجاح',
    emailInUse: 'الإيميل مستخدم بالفعل',
    usernameInUse: 'اسم المستخدم مستخدم بالفعل',
    codeInUse: 'كود الفرع مستخدم بالفعل',
    requiredField: 'هذا الحقل مطلوب',
  },
  en: {
    branchDetails: 'Branch Details',
    name: 'Name',
    nameEn: 'Name (English)',
    code: 'Code',
    address: 'Address',
    addressEn: 'Address (English)',
    city: 'City',
    cityEn: 'City (English)',
    phone: 'Phone',
    user: 'User',
    username: 'Username',
    email: 'Email',
    isActive: 'Active',
    createdBy: 'Created By',
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
    branchNotFound: 'Branch not found',
    serverError: 'Server error',
    branchUpdated: 'Branch updated successfully',
    branchDeleted: 'Branch deleted successfully',
    passwordReset: 'Password reset successfully',
    emailInUse: 'Email is already in use',
    usernameInUse: 'Username is already in use',
    codeInUse: 'Branch code is already in use',
    requiredField: 'This field is required',
  },
};

const BranchProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isRtl } = useContext(LanguageContext);
  const t = translations[isRtl ? 'ar' : 'en'];
  const [branch, setBranch] = useState<Branch | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    code: '',
    address: '',
    addressEn: '',
    city: '',
    cityEn: '',
    phone: '',
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

  useEffect(() => {
    const fetchBranch = async () => {
      try {
        setLoading(true);
        const response = await branchesAPI.getById(id!, { isRtl });
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
          user: {
            name: response.data.user?.name || '',
            nameEn: response.data.user?.nameEn || '',
            username: response.data.user?.username || '',
            email: response.data.user?.email || '',
            phone: response.data.user?.phone || '',
            isActive: response.data.user?.isActive ?? true,
          },
        });
      } catch (err: any) {
        toast.error(t.branchNotFound);
        console.error('Fetch branch error:', err);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchBranch();
  }, [id, isRtl, t]);

  const validateForm = async () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.name) newErrors.name = t.requiredField;
    if (!formData.code) newErrors.code = t.requiredField;
    if (!formData.address) newErrors.address = t.requiredField;
    if (!formData.city) newErrors.city = t.requiredField;
    if (!formData.user.name) newErrors['user.name'] = t.requiredField;
    if (!formData.user.username) newErrors['user.username'] = t.requiredField;

    if (formData.user.email) {
      try {
        const response = await branchesAPI.checkEmail(formData.user.email);
        if (!response.data.available) {
          newErrors['user.email'] = t.emailInUse;
        }
      } catch (err) {
        newErrors['user.email'] = t.serverError;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target;
    if (name.startsWith('user.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        user: { ...prev.user, [field]: type === 'checkbox' ? checked : value },
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(await validateForm())) return;

    try {
      setLoading(true);
      await branchesAPI.update(id!, formData, { isRtl });
      toast.success(t.branchUpdated);
      setIsEditModalOpen(false);
      const response = await branchesAPI.getById(id!, { isRtl });
      setBranch(response.data);
    } catch (err: any) {
      if (err.response?.data?.message) {
        if (err.response.data.message.includes('اسم المستخدم') || err.response.data.message.includes('Username')) {
          setErrors({ 'user.username': t.usernameInUse });
        } else if (err.response.data.message.includes('الإيميل') || err.response.data.message.includes('Email')) {
          setErrors({ 'user.email': t.emailInUse });
        } else if (err.response.data.message.includes('كود الفرع') || err.response.data.message.includes('Branch code')) {
          setErrors({ code: t.codeInUse });
        } else {
          toast.error(t.serverError);
        }
      } else {
        toast.error(t.serverError);
      }
      console.error('Update branch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(isRtl ? 'هل أنت متأكد من حذف الفرع؟' : 'Are you sure you want to delete the branch?')) {
      try {
        setLoading(true);
        await branchesAPI.delete(id!);
        toast.success(t.branchDeleted);
        navigate('/branches');
      } catch (err: any) {
        toast.error(err.response?.data?.message || t.serverError);
        console.error('Delete branch error:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.password.length < 6) {
      toast.error(t.passwordTooShort);
      return;
    }
    if (passwordData.password !== passwordData.confirmPassword) {
      toast.error(t.passwordMismatch);
      return;
    }
    try {
      setLoading(true);
      await branchesAPI.resetPassword(id!, { password: passwordData.password });
      toast.success(t.passwordReset);
      setIsResetPasswordModalOpen(false);
      setPasswordData({ password: '', confirmPassword: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || t.serverError);
      console.error('Reset password error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>{isRtl ? 'جاري التحميل...' : 'Loading...'}</div>;
  if (!branch) return <div>{t.branchNotFound}</div>;

  return (
    <div className={`max-w-4xl mx-auto p-6 ${isRtl ? 'rtl' : 'ltr'}`}>
      <button
        onClick={() => navigate('/branches')}
        className="flex items-center text-amber-600 hover:text-amber-800 mb-6"
      >
        <ArrowLeftIcon className="w-5 h-5 mr-2" />
        {t.back}
      </button>
      <h1 className="text-2xl font-bold mb-6">{t.branchDetails}</h1>
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="font-semibold">{t.name}</label>
            <p>{branch.displayName}</p>
          </div>
          <div>
            <label className="font-semibold">{t.nameEn}</label>
            <p>{branch.nameEn || branch.name}</p>
          </div>
          <div>
            <label className="font-semibold">{t.code}</label>
            <p>{branch.code}</p>
          </div>
          <div>
            <label className="font-semibold">{t.address}</label>
            <p>{branch.displayAddress}</p>
          </div>
          <div>
            <label className="font-semibold">{t.addressEn}</label>
            <p>{branch.addressEn || branch.address}</p>
          </div>
          <div>
            <label className="font-semibold">{t.city}</label>
            <p>{branch.displayCity}</p>
          </div>
          <div>
            <label className="font-semibold">{t.cityEn}</label>
            <p>{branch.cityEn || branch.city}</p>
          </div>
          <div>
            <label className="font-semibold">{t.phone}</label>
            <p>{branch.phone || '-'}</p>
          </div>
          <div>
            <label className="font-semibold">{t.user}</label>
            <p>{branch.user ? branch.user.displayName : '-'}</p>
          </div>
          <div>
            <label className="font-semibold">{t.username}</label>
            <p>{branch.user?.username || '-'}</p>
          </div>
          <div>
            <label className="font-semibold">{t.email}</label>
            <p>{branch.user?.email || '-'}</p>
          </div>
          <div>
            <label className="font-semibold">{t.isActive}</label>
            <p>{branch.user?.isActive ? (isRtl ? 'نعم' : 'Yes') : (isRtl ? 'لا' : 'No')}</p>
          </div>
          <div>
            <label className="font-semibold">{t.createdBy}</label>
            <p>{branch.createdBy ? branch.createdBy.displayName : '-'}</p>
          </div>
        </div>
        <div className="mt-6 flex space-x-4">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700"
          >
            <PencilIcon className="w-5 h-5 mr-2" />
            {t.editBranch}
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            <TrashIcon className="w-5 h-5 mr-2" />
            {t.deleteBranch}
          </button>
          {branch.user && (
            <button
              onClick={() => setIsResetPasswordModalOpen(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <KeyIcon className="w-5 h-5 mr-2" />
              {t.resetPassword}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isEditModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white rounded-lg p-6 w-full max-w-md"
            >
              <h2 className="text-xl font-bold mb-4">{t.editBranch}</h2>
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block font-semibold">{t.name}</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={`w-full p-2 border rounded ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {errors.name && <p className="text-red-500 text-sm">{errors.name}</p>}
                </div>
                <div className="mb-4">
                  <label className="block font-semibold">{t.nameEn}</label>
                  <input
                    type="text"
                    name="nameEn"
                    value={formData.nameEn}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded border-gray-300"
                  />
                </div>
                <div className="mb-4">
                  <label className="block font-semibold">{t.code}</label>
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleInputChange}
                    className={`w-full p-2 border rounded ${errors.code ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {errors.code && <p className="text-red-500 text-sm">{errors.code}</p>}
                </div>
                <div className="mb-4">
                  <label className="block font-semibold">{t.address}</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className={`w-full p-2 border rounded ${errors.address ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {errors.address && <p className="text-red-500 text-sm">{errors.address}</p>}
                </div>
                <div className="mb-4">
                  <label className="block font-semibold">{t.addressEn}</label>
                  <input
                    type="text"
                    name="addressEn"
                    value={formData.addressEn}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded border-gray-300"
                  />
                </div>
                <div className="mb-4">
                  <label className="block font-semibold">{t.city}</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    className={`w-full p-2 border rounded ${errors.city ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {errors.city && <p className="text-red-500 text-sm">{errors.city}</p>}
                </div>
                <div className="mb-4">
                  <label className="block font-semibold">{t.cityEn}</label>
                  <input
                    type="text"
                    name="cityEn"
                    value={formData.cityEn}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded border-gray-300"
                  />
                </div>
                <div className="mb-4">
                  <label className="block font-semibold">{t.phone}</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded border-gray-300"
                  />
                </div>
                <div className="mb-4">
                  <label className="block font-semibold">{t.user}</label>
                  <input
                    type="text"
                    name="user.name"
                    value={formData.user.name}
                    onChange={handleInputChange}
                    className={`w-full p-2 border rounded ${errors['user.name'] ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {errors['user.name'] && <p className="text-red-500 text-sm">{errors['user.name']}</p>}
                </div>
                <div className="mb-4">
                  <label className="block font-semibold">{t.nameEn}</label>
                  <input
                    type="text"
                    name="user.nameEn"
                    value={formData.user.nameEn}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded border-gray-300"
                  />
                </div>
                <div className="mb-4">
                  <label className="block font-semibold">{t.username}</label>
                  <input
                    type="text"
                    name="user.username"
                    value={formData.user.username}
                    onChange={handleInputChange}
                    className={`w-full p-2 border rounded ${errors['user.username'] ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {errors['user.username'] && <p className="text-red-500 text-sm">{errors['user.username']}</p>}
                </div>
                <div className="mb-4">
                  <label className="block font-semibold">{t.email}</label>
                  <input
                    type="email"
                    name="user.email"
                    value={formData.user.email}
                    onChange={handleInputChange}
                    className={`w-full p-2 border rounded ${errors['user.email'] ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {errors['user.email'] && <p className="text-red-500 text-sm">{errors['user.email']}</p>}
                </div>
                <div className="mb-4">
                  <label className="block font-semibold">{t.phone}</label>
                  <input
                    type="text"
                    name="user.phone"
                    value={formData.user.phone}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded border-gray-300"
                  />
                </div>
                <div className="mb-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="user.isActive"
                      checked={formData.user.isActive}
                      onChange={handleInputChange}
                      className="mr-2"
                    />
                    {t.isActive}
                  </label>
                </div>
                <div className="flex space-x-4">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700"
                    disabled={loading}
                  >
                    {loading ? (isRtl ? 'جاري الحفظ...' : 'Saving...') : t.save}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
                  >
                    {t.cancel}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
        {isResetPasswordModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white rounded-lg p-6 w-full max-w-md"
            >
              <h2 className="text-xl font-bold mb-4">{t.resetPassword}</h2>
              <form onSubmit={handleResetPassword}>
                <div className="mb-4">
                  <label className="block font-semibold">{t.newPassword}</label>
                  <input
                    type="password"
                    value={passwordData.password}
                    onChange={(e) => setPasswordData({ ...passwordData, password: e.target.value })}
                    className="w-full p-2 border rounded border-gray-300"
                  />
                </div>
                <div className="mb-4">
                  <label className="block font-semibold">{t.confirmPassword}</label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full p-2 border rounded border-gray-300"
                  />
                </div>
                <div className="flex space-x-4">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    disabled={loading}
                  >
                    {loading ? (isRtl ? 'جاري الحفظ...' : 'Saving...') : t.save}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsResetPasswordModalOpen(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
                  >
                    {t.cancel}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BranchProfile;