import React, { useState, useEffect, useCallback, useReducer, useTransition  , useMemo} from 'react'; // أضفت useTransition لـ React 19 smooth
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { branchesAPI, ordersAPI, salesAPI } from '../services/api'; // مستورد salesAPI
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Edit2, Trash2, Key, AlertCircle, MapPin, ChevronDown } from 'lucide-react';

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

// افترض interfaces للـ Orders و Sales (عدل حسب API حقيقي)
interface Order {
  _id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
}

interface Sale {
  _id: string;
  saleNumber: string;
  total: number;
  createdAt: string;
}

interface FormState {
  name: string;
  nameEn: string;
  code: string;
  address: string;
  addressEn: string;
  city: string;
  cityEn: string;
  phone: string;
  isActive: boolean;
  user: {
    name: string;
    nameEn: string;
    username: string;
    email: string;
    phone: string;
    isActive: boolean;
  };
}

type FormAction =
  | { type: 'UPDATE_FIELD'; field: keyof FormState; value: any }
  | { type: 'UPDATE_USER_FIELD'; field: keyof FormState['user']; value: any }
  | { type: 'RESET'; data: Branch };

const formReducer = (state: FormState, action: FormAction): FormState => {
  switch (action.type) {
    case 'UPDATE_FIELD':
      return { ...state, [action.field]: action.value };
    case 'UPDATE_USER_FIELD':
      return { ...state, user: { ...state.user, [action.field]: action.value } };
    case 'RESET':
      return {
        name: action.data.name || '',
        nameEn: action.data.nameEn || '',
        code: action.data.code || '',
        address: action.data.address || '',
        addressEn: action.data.addressEn || '',
        city: action.data.city || '',
        cityEn: action.data.cityEn || '',
        phone: action.data.phone || '',
        isActive: action.data.isActive ?? true,
        user: {
          name: action.data.user?.name || '',
          nameEn: action.data.user?.nameEn || '',
          username: action.data.user?.username || '',
          email: action.data.user?.email || '',
          phone: action.data.user?.phone || '',
          isActive: action.data.user?.isActive ?? true,
        },
      };
    default:
      return state;
  }
};

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
    passwordPlaceholder: 'أدخل كلمة المرور الجديدة',
    confirmPasswordPlaceholder: 'تأكيد كلمة المرور',
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
    ordersTab: 'طلبات الفرع',
    salesTab: 'مبيعات الفرع',
    additionalDetailsTab: 'تفاصيل إضافية',
    noOrders: 'لا توجد طلبات',
    noSales: 'لا توجد مبيعات',
    orderNumber: 'رقم الطلب',
    status: 'الحالة',
    total: 'الإجمالي',
    saleNumber: 'رقم المبيعة',
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
    passwordPlaceholder: 'Enter new password',
    confirmPasswordPlaceholder: 'Confirm password',
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
    ordersTab: 'Branch Orders',
    salesTab: 'Branch Sales',
    additionalDetailsTab: 'Additional Details',
    noOrders: 'No orders available',
    noSales: 'No sales available',
    orderNumber: 'Order Number',
    status: 'Status',
    total: 'Total',
    saleNumber: 'Sale Number',
  },
};

const ProfileInput = ({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  required?: boolean;
  error?: string;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className={`w-full px-3 py-3 border ${error ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'}`} // تحسين: py-3, text-sm
        aria-label={label}
      />
      {error && <p className="text-red-600 text-sm mt-1">{error}</p>} // زد text-sm
    </div>
  );
};

const ProfileSelect = ({
  id,
  label,
  value,
  onChange,
  options,
  required = false,
}: {
  id: string;
  label: string;
  value: string | boolean;
  onChange: (value: string) => void;
  options: { value: string | boolean; label: string }[];
  required?: boolean;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative group">
        <select
          id={id}
          value={value.toString()}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className={`w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md appearance-none text-sm text-gray-700 ${isRtl ? 'text-right' : 'text-left'}`} // py-3, text-sm
          aria-label={label}
        >
          {options.map((option) => (
            <option key={String(option.value)} value={option.value.toString()}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400 group-focus-within:text-amber-500 w-4 h-4 transition-colors`}
        />
      </div>
    </div>
  );
};

const ProfileCard = ({ title, details }: { title: string; details: { label: string; value: string; className?: string }[] }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="p-6 bg-white rounded-2xl shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200" // تحسين: rounded-2xl, shadow-md to lg
    >
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <MapPin className="w-5 h-5 text-amber-600" />
        {title}
      </h3>
      <div className="space-y-4">
        {details.map((detail, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <p className="text-sm text-gray-600 font-medium">{detail.label}</p>
            <p className={`text-sm text-gray-800 overflow-hidden whitespace-nowrap text-ellipsis ${detail.className || ''}`}>{detail.value}</p> // nowrap + ellipsis
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

const ProfileSkeletonCard = () => (
  <div className="p-6 bg-white rounded-2xl shadow-md border border-gray-100">
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 bg-gray-200 rounded-full"></div>
        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
      </div>
      {[...Array(6)].map((_, index) => (
        <div key={index} className="space-y-2">
          <div className="h-3 bg-gray-200 rounded w-1/3"></div>
          <div className="h-3 bg-gray-200 rounded w-2/3"></div>
        </div>
      ))}
    </div>
  </div>
);

const ProfileModal = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  dispatchForm,
  errors,
  error,
  t,
  isRtl,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formData: FormState;
  dispatchForm: React.Dispatch<FormAction>;
  errors: { [key: string]: string };
  error: string;
  t: typeof translations['ar' | 'en'];
  isRtl: boolean;
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-2xl shadow-xl max-w-full w-[90vw] sm:max-w-2xl p-6 overflow-y-auto max-h-[90vh]"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.editBranch}</h3>
        <form onSubmit={onSubmit} className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-900">{t.branchDetails}</h4>
              <ProfileInput
                id="name"
                label={t.name}
                value={formData.name}
                onChange={(value) => dispatchForm({ type: 'UPDATE_FIELD', field: 'name', value })}
                placeholder={t.name}
                required
                error={errors.name}
              />
              <ProfileInput
                id="nameEn"
                label={t.nameEn}
                value={formData.nameEn}
                onChange={(value) => dispatchForm({ type: 'UPDATE_FIELD', field: 'nameEn', value })}
                placeholder={t.nameEn}
                required
                error={errors.nameEn}
              />
              <ProfileInput
                id="code"
                label={t.code}
                value={formData.code}
                onChange={(value) => dispatchForm({ type: 'UPDATE_FIELD', field: 'code', value })}
                placeholder={t.code}
                required
                error={errors.code}
              />
              <ProfileInput
                id="address"
                label={t.address}
                value={formData.address}
                onChange={(value) => dispatchForm({ type: 'UPDATE_FIELD', field: 'address', value })}
                placeholder={t.address}
                required
                error={errors.address}
              />
              <ProfileInput
                id="addressEn"
                label={t.addressEn}
                value={formData.addressEn}
                onChange={(value) => dispatchForm({ type: 'UPDATE_FIELD', field: 'addressEn', value })}
                placeholder={t.addressEn}
                required
                error={errors.addressEn}
              />
              <ProfileInput
                id="city"
                label={t.city}
                value={formData.city}
                onChange={(value) => dispatchForm({ type: 'UPDATE_FIELD', field: 'city', value })}
                placeholder={t.city}
                required
                error={errors.city}
              />
              <ProfileInput
                id="cityEn"
                label={t.cityEn}
                value={formData.cityEn}
                onChange={(value) => dispatchForm({ type: 'UPDATE_FIELD', field: 'cityEn', value })}
                placeholder={t.cityEn}
                required
                error={errors.cityEn}
              />
              <ProfileInput
                id="phone"
                label={t.phone}
                value={formData.phone}
                onChange={(value) => dispatchForm({ type: 'UPDATE_FIELD', field: 'phone', value })}
                placeholder={t.phone}
              />
              <ProfileSelect
                id="isActive"
                label={t.isActive}
                value={formData.isActive}
                onChange={(value) => dispatchForm({ type: 'UPDATE_FIELD', field: 'isActive', value: value === 'true' })}
                options={[
                  { value: true, label: t.active },
                  { value: false, label: t.inactive },
                ]}
              />
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-900">{t.user}</h4>
              <ProfileInput
                id="userName"
                label={t.userName}
                value={formData.user.name}
                onChange={(value) => dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'name', value })}
                placeholder={t.userName}
                required
                error={errors['user.name']}
              />
              <ProfileInput
                id="userNameEn"
                label={t.userNameEn}
                value={formData.user.nameEn}
                onChange={(value) => dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'nameEn', value })}
                placeholder={t.userNameEn}
                required
                error={errors['user.nameEn']}
              />
              <ProfileInput
                id="username"
                label={t.username}
                value={formData.user.username}
                onChange={(value) => dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'username', value })}
                placeholder={t.username}
                required
                error={errors['user.username']}
              />
              <ProfileInput
                id="email"
                label={t.email}
                value={formData.user.email}
                onChange={(value) => dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'email', value })}
                placeholder={t.email}
                error={errors['user.email']}
              />
              <ProfileInput
                id="userPhone"
                label={t.userPhone}
                value={formData.user.phone}
                onChange={(value) => dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'phone', value })}
                placeholder={t.userPhone}
              />
              <ProfileSelect
                id="userIsActive"
                label={t.userStatus}
                value={formData.user.isActive}
                onChange={(value) => dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'isActive', value: value === 'true' })}
                options={[
                  { value: true, label: t.active },
                  { value: false, label: t.inactive },
                ]}
              />
            </div>
          </div>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-red-600 text-sm">{error}</span> // text-sm
            </motion.div>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm transition-colors shadow-sm"
              aria-label={t.cancel}
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm transition-colors shadow-sm"
              aria-label={t.save}
            >
              {t.save}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const ProfileResetPasswordModal = ({
  isOpen,
  onClose,
  onSubmit,
  passwordData,
  setPasswordData,
  error,
  t,
  isRtl,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  passwordData: { password: string; confirmPassword: string };
  setPasswordData: React.Dispatch<React.SetStateAction<{ password: string; confirmPassword: string }>>;
  error: string;
  t: typeof translations['ar' | 'en'];
  isRtl: boolean;
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-2xl shadow-xl max-w-full w-[90vw] sm:max-w-md p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.resetPassword}</h3>
        <form onSubmit={onSubmit} className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="relative">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              {t.newPassword}
            </label>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={passwordData.password}
              onChange={(e) => setPasswordData({ ...passwordData, password: e.target.value })}
              placeholder={t.passwordPlaceholder}
              className={`w-full px-3 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className={`absolute inset-y-0 ${isRtl ? 'left-0 pl-3' : 'right-0 pr-3'} flex items-center mt-7 text-gray-400 hover:text-amber-600 transition-colors`}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="relative">
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              {t.confirmPassword}
            </label>
            <input
              id="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              placeholder={t.confirmPasswordPlaceholder}
              className={`w-full px-3 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className={`absolute inset-y-0 ${isRtl ? 'left-0 pl-3' : 'right-0 pr-3'} flex items-center mt-7 text-gray-400 hover:text-amber-600 transition-colors`}
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-red-600 text-sm">{error}</span>
            </motion.div>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm transition-colors shadow-sm"
              aria-label={t.cancel}
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm transition-colors shadow-sm"
              aria-label={t.save}
            >
              {t.save}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const ProfileDeleteModal = ({
  isOpen,
  onClose,
  onConfirm,
  error,
  t,
  isRtl,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  error: string;
  t: typeof translations['ar' | 'en'];
  isRtl: boolean;
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-2xl shadow-xl max-w-full w-[90vw] sm:max-w-md p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.confirmDelete}</h3>
        <p className="text-sm text-gray-600 mb-4">{t.deleteWarning}</p>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 mb-4"
          >
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-red-600 text-sm">{error}</span>
          </motion.div>
        )}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm transition-colors shadow-sm"
            aria-label={t.cancel}
          >
            {t.cancel}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors shadow-sm"
            aria-label={t.deleteBranch}
          >
            {t.deleteBranch}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export const BranchProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];

  const [branch, setBranch] = useState<Branch | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [activeTab, setActiveTab] = useState('info');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [passwordData, setPasswordData] = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [salesLoading, setSalesLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition(); // React 19 لـ smooth tab switch

  const [formData, dispatchForm] = useReducer(formReducer, {
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

  const fetchBranch = useCallback(async () => {
    if (!id) {
      toast.error(t.branchNotFound, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    try {
      setLoading(true);
      const response = await branchesAPI.getById(id);
      const data = {
        ...response,
        displayName: isRtl ? response.name : response.nameEn || response.name,
        displayAddress: isRtl ? response.address : response.addressEn || response.address,
        displayCity: isRtl ? response.city : response.cityEn || response.city,
        user: response.user
          ? {
              ...response.user,
              displayName: isRtl ? response.user.name : response.user.nameEn || response.user.name,
            }
          : undefined,
        createdBy: response.createdBy
          ? {
              ...response.createdBy,
              displayName: isRtl ? response.createdBy.name : response.createdBy.nameEn || response.createdBy.name,
            }
          : undefined,
      };
      setBranch(data);
      dispatchForm({ type: 'RESET', data });
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Fetch branch error:`, err);
      setError(err.response?.data?.message || t.branchNotFound);
      toast.error(t.branchNotFound, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setLoading(false);
    }
  }, [id, isRtl, t]);

  const fetchOrders = useCallback(async () => {
    if (!id) return;
    setOrdersLoading(true);
    try {
      const response = await ordersAPI.getAll({ branch: id });
      setOrders(response.data || []); // افترض response { data: [], totalPages, ... }
    } catch (err: any) {
      toast.error('خطأ في جلب الطلبات', { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setOrdersLoading(false);
    }
  }, [id, isRtl]);

  const fetchSales = useCallback(async () => {
    if (!id) return;
    setSalesLoading(true);
    try {
      // افترض salesAPI.getByBranch(id) أو getAll({ branch: id })
      const response = await salesAPI.getAll({ branch: id }); // عدل لو الـ endpoint مختلف
      setSales(response.data || []);
    } catch (err: any) {
      toast.error('خطأ في جلب المبيعات', { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setSalesLoading(false);
    }
  }, [id, isRtl]);

  useEffect(() => {
    fetchBranch();
  }, [fetchBranch]);

  const checkEmailAvailability = useCallback(async (email: string) => {
    try {
      const response = await branchesAPI.checkEmail(email);
      return response.available;
    } catch {
      return false;
    }
  }, []);

  const validateForm = useCallback(async () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.name.trim()) newErrors.name = t.requiredField;
    if (!formData.nameEn.trim()) newErrors.nameEn = t.requiredField;
    if (!formData.code.trim()) newErrors.code = t.requiredField;
    if (!formData.address.trim()) newErrors.address = t.requiredField;
    if (!formData.addressEn.trim()) newErrors.addressEn = t.requiredField;
    if (!formData.city.trim()) newErrors.city = t.requiredField;
    if (!formData.cityEn.trim()) newErrors.cityEn = t.requiredField;
    if (!formData.user.name.trim()) newErrors['user.name'] = t.requiredField;
    if (!formData.user.nameEn.trim()) newErrors['user.nameEn'] = t.requiredField;
    if (!formData.user.username.trim()) newErrors['user.username'] = t.requiredField;
    if (formData.user.email.trim()) {
      const isEmailAvailable = await checkEmailAvailability(formData.user.email);
      if (!isEmailAvailable && formData.user.email !== branch?.user?.email) {
        newErrors['user.email'] = t.emailInUse;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, checkEmailAvailability, t, branch]);

  const handleInputChange = useCallback(
    (value: string | boolean, field: string, isUserField: boolean = false) => {
      if (isUserField) {
        dispatchForm({ type: 'UPDATE_USER_FIELD', field: field as keyof FormState['user'], value });
        setErrors((prev) => ({ ...prev, [`user.${field}`]: '' }));
      } else {
        dispatchForm({ type: 'UPDATE_FIELD', field: field as keyof FormState, value });
        setErrors((prev) => ({ ...prev, [field]: '' }));
      }
    },
    []
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
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
        await branchesAPI.update(id!, branchData);
        setBranch((prev) =>
          prev
            ? {
                ...prev,
                ...branchData,
                displayName: isRtl ? branchData.name : branchData.nameEn || branchData.name,
                displayAddress: isRtl ? branchData.address : branchData.addressEn || branchData.address,
                displayCity: isRtl ? branchData.city : branchData.cityEn || branchData.city,
                user: {
                  ...prev.user,
                  ...branchData.user,
                  displayName: isRtl ? branchData.user.name : branchData.user.nameEn || branchData.user.name,
                },
              }
            : null
        );
        toast.success(t.branchUpdated, { position: isRtl ? 'top-right' : 'top-left' });
        setIsEditModalOpen(false);
        setError('');
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Update branch error:`, err);
        let errorMessage = t.serverError;
        if (err.response?.data?.message) {
          const message = err.response.data.message;
          errorMessage =
            message === 'Branch code already exists'
              ? t.codeInUse
              : message === 'Username already exists'
              ? t.usernameInUse
              : message.includes('الإيميل') || message.includes('email')
              ? t.emailInUse
              : message;
        }
        setError(errorMessage);
        toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
      } finally {
        setLoading(false);
      }
    },
    [formData, id, isRtl, t]
  );

  const handleResetPassword = useCallback(
    async (e: React.FormEvent) => {
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
        await branchesAPI.resetPassword(id!, passwordData.password);
        toast.success(t.passwordReset, { position: isRtl ? 'top-right' : 'top-left' });
        setIsResetPasswordModalOpen(false);
        setPasswordData({ password: '', confirmPassword: '' });
        setError('');
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Reset password error:`, err);
        const errorMessage = err.response?.data?.message || t.serverError;
        setError(errorMessage);
        toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
      } finally {
        setLoading(false);
      }
    },
    [passwordData, id, t, isRtl]
  );

  const handleDelete = useCallback(async () => {
    try {
      setLoading(true);
      await branchesAPI.delete(id!);
      toast.success(t.branchDeleted, { position: isRtl ? 'top-right' : 'top-left' });
      navigate('/branches');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Delete branch error:`, err);
      let errorMessage = t.serverError;
      if (err.response?.data?.message) {
        errorMessage =
          err.response.data.message === 'Cannot delete branch with associated orders or inventory'
            ? t.deleteRestricted
            : err.response.data.message;
      }
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setLoading(false);
    }
  }, [id, navigate, t, isRtl]);

  const openEditModal = useCallback(() => {
    if (branch) {
      dispatchForm({ type: 'RESET', data: branch });
      setIsEditModalOpen(true);
      setErrors({});
      setError('');
    }
  }, [branch]);

  const openResetPasswordModal = useCallback(() => {
    setPasswordData({ password: '', confirmPassword: '' });
    setIsResetPasswordModalOpen(true);
    setError('');
  }, []);

  const openDeleteModal = useCallback(() => {
    setIsDeleteModalOpen(true);
    setError('');
  }, []);

  const branchDetails = useMemo(
    () => [
      { label: t.name, value: branch?.name || '-' },
      { label: t.nameEn, value: branch?.nameEn || branch?.name || '-' },
      { label: t.code, value: branch?.code || '-' },
      { label: t.address, value: branch?.displayAddress || '-' },
      { label: t.addressEn, value: branch?.addressEn || branch?.address || '-' },
      { label: t.city, value: branch?.displayCity || '-' },
      { label: t.cityEn, value: branch?.cityEn || branch?.city || '-' },
      { label: t.phone, value: branch?.phone || '-' },
      {
        label: t.isActive,
        value: branch?.isActive ? t.active : t.inactive,
        className: branch?.isActive ? 'text-teal-600' : 'text-red-600',
      },
      { label: t.createdAt, value: branch ? new Date(branch.createdAt).toLocaleString() : '-' },
      { label: t.updatedAt, value: branch ? new Date(branch.updatedAt).toLocaleString() : '-' },
      { label: t.createdBy, value: branch?.createdBy?.displayName || '-' },
    ],
    [branch, t]
  );

  const userDetails = useMemo(
    () =>
      branch?.user
        ? [
            { label: t.userName, value: branch.user.displayName },
            { label: t.userNameEn, value: branch.user.nameEn || branch.user.name },
            { label: t.username, value: branch.user.username },
            { label: t.email, value: branch.user.email || '-' },
            { label: t.userPhone, value: branch.user.phone || '-' },
            {
              label: t.userStatus,
              value: branch.user.isActive ? t.active : t.inactive,
              className: branch.user.isActive ? 'text-teal-600' : 'text-red-600',
            },
          ]
        : [],
    [branch, t]
  );

  if (loading) {
    return (
      <div className={`flex items-center justify-center min-h-screen bg-gray-50 ${isRtl ? 'font-arabic' : 'font-sans'}`}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="p-6 bg-white rounded-2xl shadow-md"
        >
          <ProfileSkeletonCard />
        </motion.div>
      </div>
    );
  }

  if (!branch) {
    return (
      <div className={`mx-auto p-4 sm:p-6 min-h-screen bg-gray-50 ${isRtl ? 'font-arabic' : 'font-sans'}`} dir={isRtl ? 'rtl' : 'ltr'}>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-center p-6 bg-white rounded-2xl shadow-md border border-gray-100"
        >
          <MapPin className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t.branchNotFound}</h2>
          <button
            onClick={() => navigate('/branches')}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm transition-colors shadow-sm flex items-center gap-2 mx-auto"
            aria-label={t.back}
          >
            <ArrowLeft className="w-4 h-4" />
            {t.back}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`mx-auto max-w-7xl p-4 sm:p-6 min-h-screen bg-gray-50 ${isRtl ? 'font-arabic' : 'font-sans'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4 shadow-sm bg-white p-4 rounded-2xl"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/branches')}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm transition-colors shadow-sm flex items-center gap-2"
            aria-label={t.back}
          >
            <ArrowLeft className="w-4 h-4" />
            {t.back}
          </button>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="w-6 h-6 text-amber-600" />
            {branch.displayName}
          </h1>
        </div>
        {user?.role === 'admin' && (
          <div className="flex gap-3">
            <button
              onClick={openEditModal}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors shadow-sm flex items-center gap-2"
              aria-label={t.editBranch}
            >
              <Edit2 className="w-4 h-4" />
              {t.editBranch}
            </button>
            <button
              onClick={openResetPasswordModal}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm transition-colors shadow-sm flex items-center gap-2"
              aria-label={t.resetPassword}
            >
              <Key className="w-4 h-4" />
              {t.resetPassword}
            </button>
            <button
              onClick={openDeleteModal}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition-colors shadow-sm flex items-center gap-2"
              aria-label={t.deleteBranch}
            >
              <Trash2 className="w-4 h-4" />
              {t.deleteBranch}
            </button>
          </div>
        )}
      </motion.div>
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-8 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 shadow-sm"
          >
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-600 text-sm font-medium">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => startTransition(() => setActiveTab('info'))}
          className={`px-4 py-2 text-sm font-medium ${activeTab === 'info' ? 'border-b-2 border-amber-600 text-amber-600' : 'text-gray-600'} transition-colors`}
        >
          {t.infoTab}
        </button>
        <button
          onClick={() => startTransition(() => setActiveTab('orders'))}
          className={`px-4 py-2 text-sm font-medium ${activeTab === 'orders' ? 'border-b-2 border-amber-600 text-amber-600' : 'text-gray-600'} transition-colors`}
        >
          {t.ordersTab}
        </button>
        <button
          onClick={() => startTransition(() => setActiveTab('sales'))}
          className={`px-4 py-2 text-sm font-medium ${activeTab === 'sales' ? 'border-b-2 border-amber-600 text-amber-600' : 'text-gray-600'} transition-colors`}
        >
          {t.salesTab}
        </button>
        <button
          onClick={() => startTransition(() => setActiveTab('additional'))}
          className={`px-4 py-2 text-sm font-medium ${activeTab === 'additional' ? 'border-b-2 border-amber-600 text-amber-600' : 'text-gray-600'} transition-colors`}
        >
          {t.additionalDetailsTab}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'info' ? (
          <motion.div
            key="info"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <ProfileCard title={t.branchDetails} details={branchDetails} />
            {branch.user && <ProfileCard title={t.user} details={userDetails} />}
          </motion.div>
        ) : activeTab === 'orders' ? (
          <motion.div
            key="orders"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-gray-900">{t.ordersTab}</h2>
            {ordersLoading ? (
              <div className="text-center text-sm text-gray-600">جاري التحميل...</div>
            ) : orders.length === 0 ? (
              <div className="text-center text-sm text-gray-600">{t.noOrders}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.orderNumber}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.status}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.total}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.createdAt}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {orders.map((order) => (
                      <tr key={order._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.orderNumber}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{order.status}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{order.total}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{new Date(order.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        ) : activeTab === 'sales' ? (
          <motion.div
            key="sales"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-gray-900">{t.salesTab}</h2>
            {salesLoading ? (
              <div className="text-center text-sm text-gray-600">جاري التحميل...</div>
            ) : sales.length === 0 ? (
              <div className="text-center text-sm text-gray-600">{t.noSales}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.saleNumber}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.total}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.createdAt}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sales.map((sale) => (
                      <tr key={sale._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sale.saleNumber}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{sale.total}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{new Date(sale.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="additional"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-gray-900">{t.additionalDetailsTab}</h2>
            {/* هنا أضف stats أو inventory, e.g. fetch from inventoryAPI.getByBranch(id) */}
            <p className="text-sm text-gray-600">عدد الطلبات: {orders.length}</p>
            <p className="text-sm text-gray-600">إجمالي المبيعات: {sales.reduce((sum, sale) => sum + sale.total, 0)}</p>
            {/* أضف المزيد لو في API */}
          </motion.div>
        )}
      </AnimatePresence>

      <ProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleSubmit}
        formData={formData}
        dispatchForm={dispatchForm}
        errors={errors}
        error={error}
        t={t}
        isRtl={isRtl}
      />
      <ProfileResetPasswordModal
        isOpen={isResetPasswordModalOpen}
        onClose={() => setIsResetPasswordModalOpen(false)}
        onSubmit={handleResetPassword}
        passwordData={passwordData}
        setPasswordData={setPasswordData}
        error={error}
        t={t}
        isRtl={isRtl}
      />
      <ProfileDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        error={error}
        t={t}
        isRtl={isRtl}
      />
    </div>
  );
};

export default BranchProfile;