import React, { useState, useEffect, useCallback, useReducer, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { branchesAPI } from '../services/api';
import { MapPin, Plus, Edit2, Trash2, Key, AlertCircle, Search, X, ChevronDown } from 'lucide-react';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import { motion, AnimatePresence } from 'framer-motion';

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
  isActive: boolean;
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
  createdAt: string;
  updatedAt: string;
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
    password: string;
    isActive: boolean;
  };
}

type FormAction =
  | { type: 'UPDATE_FIELD'; field: keyof FormState; value: any }
  | { type: 'UPDATE_USER_FIELD'; field: keyof FormState['user']; value: any }
  | { type: 'RESET' };

const formReducer = (state: FormState, action: FormAction): FormState => {
  switch (action.type) {
    case 'UPDATE_FIELD':
      return { ...state, [action.field]: action.value };
    case 'UPDATE_USER_FIELD':
      return { ...state, user: { ...state.user, [action.field]: action.value } };
    case 'RESET':
      return {
        name: '',
        nameEn: '',
        code: '',
        address: '',
        addressEn: '',
        city: '',
        cityEn: '',
        phone: '',
        isActive: true,
        user: { name: '', nameEn: '', username: '', email: '', phone: '', password: '', isActive: true },
      };
    default:
      return state;
  }
};

const translations = {
  ar: {
    manage: 'إدارة الفروع',
    addBranches: 'إدارة الفروع وإضافتها أو تعديلها',
    add: 'إضافة فرع',
    addFirst: 'إضافة أول فرع',
    noBranches: 'لا توجد فروع',
    noMatch: 'لا توجد فروع مطابقة',
    empty: 'لا توجد فروع متاحة',
    searchPlaceholder: 'ابحث عن فرع بالاسم أو الكود...',
    code: 'الكود',
    address: 'العنوان',
    addressEn: 'العنوان (إنجليزي)',
    city: 'المدينة',
    cityEn: 'المدينة (إنجليزي)',
    phone: 'الهاتف',
    status: 'الحالة',
    active: 'نشط',
    inactive: 'غير نشط',
    edit: 'تعديل',
    resetPassword: 'إعادة تعيين كلمة المرور',
    delete: 'حذف',
    name: 'اسم الفرع (عربي)',
    nameEn: 'اسم الفرع (إنجليزي)',
    nameRequired: 'اسم الفرع مطلوب',
    nameEnRequired: 'اسم الفرع بالإنجليزية مطلوب',
    codeRequired: 'كود الفرع مطلوب',
    addressRequired: 'العنوان مطلوب',
    addressEnRequired: 'العنوان بالإنجليزية مطلوب',
    cityRequired: 'المدينة مطلوبة',
    cityEnRequired: 'المدينة بالإنجليزية مطلوبة',
    userName: 'اسم المستخدم (عربي)',
    userNameEn: 'اسم المستخدم (إنجليزي)',
    userNameRequired: 'اسم المستخدم مطلوب',
    userNameEnRequired: 'اسم المستخدم بالإنجليزية مطلوب',
    username: 'اسم المستخدم',
    usernameRequired: 'اسم المستخدم للفرع مطلوب',
    passwordRequired: 'كلمة المرور مطلوبة',
    namePlaceholder: 'أدخل اسم الفرع',
    nameEnPlaceholder: 'أدخل اسم الفرع بالإنجليزية',
    codePlaceholder: 'أدخل كود الفرع',
    addressPlaceholder: 'أدخل العنوان',
    addressEnPlaceholder: 'أدخل العنوان بالإنجليزية',
    cityPlaceholder: 'أدخل المدينة',
    cityEnPlaceholder: 'أدخل المدينة بالإنجليزية',
    phonePlaceholder: 'أدخل رقم الهاتف',
    userNamePlaceholder: 'أدخل اسم المستخدم',
    userNameEnPlaceholder: 'أدخل اسم المستخدم بالإنجليزية',
    usernamePlaceholder: 'أدخل اسم المستخدم للفرع',
    emailPlaceholder: 'أدخل الإيميل',
    userPhonePlaceholder: 'أدخل رقم هاتف المستخدم',
    passwordPlaceholder: 'أدخل كلمة المرور',
    update: 'تحديث الفرع',
    requiredFields: 'يرجى ملء جميع الحقول المطلوبة',
    emailExists: 'الإيميل مستخدم بالفعل',
    codeExists: 'الكود مستخدم بالفعل',
    usernameExists: 'اسم المستخدم مستخدم بالفعل',
    unauthorized: 'غير مصرح لك بالوصول',
    fetchError: 'خطأ أثناء جلب البيانات',
    updateError: 'خطأ أثناء تحديث الفرع',
    createError: 'خطأ أثناء إنشاء الفرع',
    added: 'تم إضافة الفرع بنجاح',
    updated: 'تم تحديث الفرع بنجاح',
    newPassword: 'كلمة المرور الجديدة',
    confirmPassword: 'تأكيد كلمة المرور',
    newPasswordPlaceholder: 'أدخل كلمة المرور الجديدة',
    confirmPasswordPlaceholder: 'تأكيد كلمة المرور',
    passwordMismatch: 'كلمة المرور وتأكيدها غير متطابقتين',
    passwordTooShort: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
    passwordResetSuccess: 'تم إعادة تعيين كلمة المرور بنجاح',
    passwordResetError: 'خطأ أثناء إعادة تعيين كلمة المرور',
    reset: 'إعادة تعيين',
    cancel: 'إلغاء',
    confirmDelete: 'تأكيد الحذف',
    deleteWarning: 'هل أنت متأكد من حذف هذا الفرع؟',
    deleteRestricted: 'لا يمكن حذف الفرع لوجود طلبات أو مخزون مرتبط',
    deleteError: 'خطأ أثناء حذف الفرع',
    deleted: 'تم حذف الفرع بنجاح',
    scrollToForm: 'الذهاب إلى نموذج الإضافة',
    branchCount: 'عدد الفروع',
  },
  en: {
    manage: 'Manage Branches',
    addBranches: 'Manage, add, or edit branches',
    add: 'Add Branch',
    addFirst: 'Add First Branch',
    noBranches: 'No Branches Found',
    noMatch: 'No Matching Branches',
    empty: 'No Branches Available',
    searchPlaceholder: 'Search by branch name or code...',
    code: 'Code',
    address: 'Address',
    addressEn: 'Address (English)',
    city: 'City',
    cityEn: 'City (English)',
    phone: 'Phone',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    edit: 'Edit',
    resetPassword: 'Reset Password',
    delete: 'Delete',
    name: 'Branch Name (Arabic)',
    nameEn: 'Branch Name (English)',
    nameRequired: 'Branch name is required',
    nameEnRequired: 'Branch name in English is required',
    codeRequired: 'Branch code is required',
    addressRequired: 'Address is required',
    addressEnRequired: 'Address in English is required',
    cityRequired: 'City is required',
    cityEnRequired: 'City in English is required',
    userName: 'User Name (Arabic)',
    userNameEn: 'User Name (English)',
    userNameRequired: 'User name is required',
    userNameEnRequired: 'User name in English is required',
    username: 'Username',
    usernameRequired: 'Branch username is required',
    passwordRequired: 'Password is required',
    namePlaceholder: 'Enter branch name',
    nameEnPlaceholder: 'Enter branch name in English',
    codePlaceholder: 'Enter branch code',
    addressPlaceholder: 'Enter address',
    addressEnPlaceholder: 'Enter address in English',
    cityPlaceholder: 'Enter city',
    cityEnPlaceholder: 'Enter city in English',
    phonePlaceholder: 'Enter phone number',
    userNamePlaceholder: 'Enter user name',
    userNameEnPlaceholder: 'Enter user name in English',
    usernamePlaceholder: 'Enter branch username',
    emailPlaceholder: 'Enter email',
    userPhonePlaceholder: 'Enter user phone number',
    passwordPlaceholder: 'Enter password',
    update: 'Update Branch',
    requiredFields: 'Please fill all required fields',
    emailExists: 'Email is already in use',
    codeExists: 'Code is already in use',
    usernameExists: 'Username is already in use',
    unauthorized: 'You are not authorized to access',
    fetchError: 'Error fetching data',
    updateError: 'Error updating branch',
    createError: 'Error creating branch',
    added: 'Branch added successfully',
    updated: 'Branch updated successfully',
    newPassword: 'New Password',
    confirmPassword: 'Confirm Password',
    newPasswordPlaceholder: 'Enter new password',
    confirmPasswordPlaceholder: 'Confirm password',
    passwordMismatch: 'Passwords do not match',
    passwordTooShort: 'Password must be at least 6 characters',
    passwordResetSuccess: 'Password reset successfully',
    passwordResetError: 'Error resetting password',
    reset: 'Reset',
    cancel: 'Cancel',
    confirmDelete: 'Confirm Deletion',
    deleteWarning: 'Are you sure you want to delete this branch?',
    deleteRestricted: 'Cannot delete branch with associated orders or inventory',
    deleteError: 'Error deleting branch',
    deleted: 'Branch deleted successfully',
    scrollToForm: 'Go to Add Form',
    branchCount: 'Branches Count',
  },
};

const BranchInput = ({
  id,
  value,
  onChange,
  placeholder,
  ariaLabel,
  type = 'text',
  required = false,
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  ariaLabel: string;
  type?: string;
  required?: boolean;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}
      aria-label={ariaLabel}
    />
  );
};

const BranchSearchInput = ({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  ariaLabel: string;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="relative group">
      <Search className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 transition-colors group-focus-within:text-amber-500`} />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full ${isRtl ? 'pl-10 pr-2' : 'pr-10 pl-2'} py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={ariaLabel}
      />
      {value && (
        <button
          onClick={() => onChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>)}
          className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-amber-500 transition-colors`}
          aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

const BranchSelect = ({
  id,
  value,
  onChange,
  options,
  ariaLabel,
  required = false,
}: {
  id: string;
  value: string | boolean;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string | boolean; label: string }[];
  ariaLabel: string;
  required?: boolean;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="relative group">
      <select
        id={id}
        value={value}
        onChange={onChange}
        required={required}
        className={`w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-colors duration-200 bg-white shadow-sm appearance-none text-xs text-gray-700 font-medium ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={ariaLabel}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400 group-focus-within:text-amber-500 w-4 h-4 transition-colors`}
      />
    </div>
  );
};

const BranchCard = ({ branch, onEdit, onResetPassword, onDelete, onClick }: {
  branch: Branch;
  onEdit: (e: React.MouseEvent) => void;
  onResetPassword: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onClick: () => void;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between border border-gray-100 hover:border-amber-200 cursor-pointer"
      onClick={onClick}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-gray-900 text-sm truncate">
            {isRtl ? branch.name : branch.nameEn || branch.name}
          </h3>
          <MapPin className="w-5 h-5 text-amber-600" />
        </div>
        <p className="text-xs text-gray-500">{t.code}: {branch.code}</p>
        <p className="text-xs text-gray-600 truncate">{t.address}: {isRtl ? branch.address : branch.addressEn || branch.address}</p>
        <p className="text-xs text-gray-600 truncate">{t.city}: {isRtl ? branch.city : branch.cityEn || branch.city}</p>
        <p className="text-xs text-gray-600 truncate">{t.phone}: {branch.phone || '-'}</p>
        <p className={`text-xs font-medium ${branch.isActive ? 'text-teal-600' : 'text-red-600'}`}>
          {t.status}: {branch.isActive ? t.active : t.inactive}
        </p>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <motion.button
          onClick={onEdit}
          className="p-2 w-8 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors duration-200 flex items-center justify-center"
          title={t.edit}
          whileHover={{ scale: 1.05 }}
        >
          <Edit2 className="w-4 h-4" />
        </motion.button>
        <motion.button
          onClick={onResetPassword}
          className="p-2 w-8 h-8 bg-amber-600 hover:bg-amber-700 text-white rounded-full transition-colors duration-200 flex items-center justify-center"
          title={t.resetPassword}
          whileHover={{ scale: 1.05 }}
        >
          <Key className="w-4 h-4" />
        </motion.button>
        <motion.button
          onClick={onDelete}
          className="p-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors duration-200 flex items-center justify-center"
          title={t.delete}
          whileHover={{ scale: 1.05 }}
        >
          <Trash2 className="w-4 h-4" />
        </motion.button>
      </div>
    </motion.div>
  );
};

const BranchSkeletonCard = () => (
  <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
    <div className="space-y-2 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-3 bg-gray-200 rounded w-3/4"></div>
        <div className="w-5 h-5 bg-gray-200 rounded-full"></div>
      </div>
      <div className="h-2 bg-gray-200 rounded w-1/4"></div>
      <div className="h-2 bg-gray-200 rounded w-1/2"></div>
      <div className="h-2 bg-gray-200 rounded w-1/3"></div>
      <div className="h-2 bg-gray-200 rounded w-1/4"></div>
      <div className="h-2 bg-gray-200 rounded w-1/5"></div>
    </div>
  </div>
);

const BranchModal = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  dispatchForm,
  editingBranch,
  formErrors,
  error,
  t,
  isRtl,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formData: FormState;
  dispatchForm: React.Dispatch<FormAction>;
  editingBranch: Branch | null;
  formErrors: Record<string, string>;
  error: string;
  t: typeof translations['ar' | 'en'];
  isRtl: boolean;
}) => {
  if (!isOpen) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="bg-white rounded-lg shadow-xl max-w-full w-[90vw] sm:max-w-2xl p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{editingBranch ? t.edit : t.add}</h3>
        <form onSubmit={onSubmit} className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-xs font-medium text-gray-700 mb-1">
                  {t.name}
                </label>
                <BranchInput
                  id="name"
                  value={formData.name}
                  onChange={(e) => dispatchForm({ type: 'UPDATE_FIELD', field: 'name', value: e.target.value })}
                  placeholder={t.namePlaceholder}
                  ariaLabel={t.name}
                  required
                />
                {formErrors.name && <p className="text-red-600 text-xs mt-1">{formErrors.name}</p>}
              </div>
              <div>
                <label htmlFor="nameEn" className="block text-xs font-medium text-gray-700 mb-1">
                  {t.nameEn}
                </label>
                <BranchInput
                  id="nameEn"
                  value={formData.nameEn}
                  onChange={(e) => dispatchForm({ type: 'UPDATE_FIELD', field: 'nameEn', value: e.target.value })}
                  placeholder={t.nameEnPlaceholder}
                  ariaLabel={t.nameEn}
                  required
                />
                {formErrors.nameEn && <p className="text-red-600 text-xs mt-1">{formErrors.nameEn}</p>}
              </div>
              <div>
                <label htmlFor="code" className="block text-xs font-medium text-gray-700 mb-1">
                  {t.code}
                </label>
                <BranchInput
                  id="code"
                  value={formData.code}
                  onChange={(e) => dispatchForm({ type: 'UPDATE_FIELD', field: 'code', value: e.target.value })}
                  placeholder={t.codePlaceholder}
                  ariaLabel={t.code}
                  required
                />
                {formErrors.code && <p className="text-red-600 text-xs mt-1">{formErrors.code}</p>}
              </div>
              <div>
                <label htmlFor="address" className="block text-xs font-medium text-gray-700 mb-1">
                  {t.address}
                </label>
                <BranchInput
                  id="address"
                  value={formData.address}
                  onChange={(e) => dispatchForm({ type: 'UPDATE_FIELD', field: 'address', value: e.target.value })}
                  placeholder={t.addressPlaceholder}
                  ariaLabel={t.address}
                  required
                />
                {formErrors.address && <p className="text-red-600 text-xs mt-1">{formErrors.address}</p>}
              </div>
              <div>
                <label htmlFor="addressEn" className="block text-xs font-medium text-gray-700 mb-1">
                  {t.addressEn}
                </label>
                <BranchInput
                  id="addressEn"
                  value={formData.addressEn}
                  onChange={(e) => dispatchForm({ type: 'UPDATE_FIELD', field: 'addressEn', value: e.target.value })}
                  placeholder={t.addressEnPlaceholder}
                  ariaLabel={t.addressEn}
                  required
                />
                {formErrors.addressEn && <p className="text-red-600 text-xs mt-1">{formErrors.addressEn}</p>}
              </div>
              <div>
                <label htmlFor="city" className="block text-xs font-medium text-gray-700 mb-1">
                  {t.city}
                </label>
                <BranchInput
                  id="city"
                  value={formData.city}
                  onChange={(e) => dispatchForm({ type: 'UPDATE_FIELD', field: 'city', value: e.target.value })}
                  placeholder={t.cityPlaceholder}
                  ariaLabel={t.city}
                  required
                />
                {formErrors.city && <p className="text-red-600 text-xs mt-1">{formErrors.city}</p>}
              </div>
              <div>
                <label htmlFor="cityEn" className="block text-xs font-medium text-gray-700 mb-1">
                  {t.cityEn}
                </label>
                <BranchInput
                  id="cityEn"
                  value={formData.cityEn}
                  onChange={(e) => dispatchForm({ type: 'UPDATE_FIELD', field: 'cityEn', value: e.target.value })}
                  placeholder={t.cityEnPlaceholder}
                  ariaLabel={t.cityEn}
                  required
                />
                {formErrors.cityEn && <p className="text-red-600 text-xs mt-1">{formErrors.cityEn}</p>}
              </div>
              <div>
                <label htmlFor="phone" className="block text-xs font-medium text-gray-700 mb-1">
                  {t.phone}
                </label>
                <BranchInput
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => dispatchForm({ type: 'UPDATE_FIELD', field: 'phone', value: e.target.value })}
                  placeholder={t.phonePlaceholder}
                  ariaLabel={t.phone}
                />
              </div>
              <div>
                <label htmlFor="isActive" className="block text-xs font-medium text-gray-700 mb-1">
                  {t.status}
                </label>
                <BranchSelect
                  id="isActive"
                  value={formData.isActive}
                  onChange={(e) => dispatchForm({ type: 'UPDATE_FIELD', field: 'isActive', value: e.target.value === 'true' })}
                  options={[
                    { value: true, label: t.active },
                    { value: false, label: t.inactive },
                  ]}
                  ariaLabel={t.status}
                />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="userName" className="block text-xs font-medium text-gray-700 mb-1">
                  {t.userName}
                </label>
                <BranchInput
                  id="userName"
                  value={formData.user.name}
                  onChange={(e) => dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'name', value: e.target.value })}
                  placeholder={t.userNamePlaceholder}
                  ariaLabel={t.userName}
                  required={!editingBranch}
                />
                {formErrors.userName && <p className="text-red-600 text-xs mt-1">{formErrors.userName}</p>}
              </div>
              <div>
                <label htmlFor="userNameEn" className="block text-xs font-medium text-gray-700 mb-1">
                  {t.userNameEn}
                </label>
                <BranchInput
                  id="userNameEn"
                  value={formData.user.nameEn}
                  onChange={(e) => dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'nameEn', value: e.target.value })}
                  placeholder={t.userNameEnPlaceholder}
                  ariaLabel={t.userNameEn}
                  required={!editingBranch}
                />
                {formErrors.userNameEn && <p className="text-red-600 text-xs mt-1">{formErrors.userNameEn}</p>}
              </div>
              <div>
                <label htmlFor="username" className="block text-xs font-medium text-gray-700 mb-1">
                  {t.username}
                </label>
                <BranchInput
                  id="username"
                  value={formData.user.username}
                  onChange={(e) => dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'username', value: e.target.value })}
                  placeholder={t.usernamePlaceholder}
                  ariaLabel={t.username}
                  required={!editingBranch}
                />
                {formErrors.username && <p className="text-red-600 text-xs mt-1">{formErrors.username}</p>}
              </div>
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1">
                  {t.email}
                </label>
                <BranchInput
                  id="email"
                  value={formData.user.email}
                  onChange={(e) => dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'email', value: e.target.value })}
                  placeholder={t.emailPlaceholder}
                  ariaLabel={t.email}
                />
                {formErrors.email && <p className="text-red-600 text-xs mt-1">{formErrors.email}</p>}
              </div>
              <div>
                <label htmlFor="userPhone" className="block text-xs font-medium text-gray-700 mb-1">
                  {t.userPhone}
                </label>
                <BranchInput
                  id="userPhone"
                  value={formData.user.phone}
                  onChange={(e) => dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'phone', value: e.target.value })}
                  placeholder={t.userPhonePlaceholder}
                  ariaLabel={t.userPhone}
                />
              </div>
              <div>
                <label htmlFor="userIsActive" className="block text-xs font-medium text-gray-700 mb-1">
                  {t.status}
                </label>
                <BranchSelect
                  id="userIsActive"
                  value={formData.user.isActive}
                  onChange={(e) => dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'isActive', value: e.target.value === 'true' })}
                  options={[
                    { value: true, label: t.active },
                    { value: false, label: t.inactive },
                  ]}
                  ariaLabel={t.status}
                />
              </div>
              {!editingBranch && (
                <div>
                  <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1">
                    {t.password}
                  </label>
                  <BranchInput
                    id="password"
                    type="password"
                    value={formData.user.password}
                    onChange={(e) => dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'password', value: e.target.value })}
                    placeholder={t.passwordPlaceholder}
                    ariaLabel={t.password}
                    required
                  />
                  {formErrors.password && <p className="text-red-600 text-xs mt-1">{formErrors.password}</p>}
                </div>
              )}
            </div>
          </div>
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-red-600 text-xs">{error}</span>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <motion.button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs transition-colors duration-200"
              aria-label={t.cancel}
              whileHover={{ scale: 1.05 }}
            >
              {t.cancel}
            </motion.button>
            <motion.button
              type="submit"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors duration-200"
              aria-label={editingBranch ? t.update : t.add}
              whileHover={{ scale: 1.05 }}
            >
              {editingBranch ? t.update : t.add}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

const BranchResetPasswordModal = ({
  isOpen,
  onClose,
  onSubmit,
  resetPasswordData,
  setResetPasswordData,
  error,
  t,
  isRtl,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  resetPasswordData: { password: string; confirmPassword: string };
  setResetPasswordData: React.Dispatch<React.SetStateAction<{ password: string; confirmPassword: string }>>;
  error: string;
  t: typeof translations['ar' | 'en'];
  isRtl: boolean;
}) => {
  if (!isOpen) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="bg-white rounded-lg shadow-xl max-w-full w-[90vw] sm:max-w-md p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.resetPassword}</h3>
        <form onSubmit={onSubmit} className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <div>
            <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1">
              {t.newPassword}
            </label>
            <BranchInput
              id="password"
              type="password"
              value={resetPasswordData.password}
              onChange={(e) => setResetPasswordData({ ...resetPasswordData, password: e.target.value })}
              placeholder={t.newPasswordPlaceholder}
              ariaLabel={t.newPassword}
              required
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-xs font-medium text-gray-700 mb-1">
              {t.confirmPassword}
            </label>
            <BranchInput
              id="confirmPassword"
              type="password"
              value={resetPasswordData.confirmPassword}
              onChange={(e) => setResetPasswordData({ ...resetPasswordData, confirmPassword: e.target.value })}
              placeholder={t.confirmPasswordPlaceholder}
              ariaLabel={t.confirmPassword}
              required
            />
          </div>
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-red-600 text-xs">{error}</span>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <motion.button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs transition-colors duration-200"
              aria-label={t.cancel}
              whileHover={{ scale: 1.05 }}
            >
              {t.cancel}
            </motion.button>
            <motion.button
              type="submit"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors duration-200"
              aria-label={t.reset}
              whileHover={{ scale: 1.05 }}
            >
              {t.reset}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

const BranchDeleteModal = ({
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="bg-white rounded-lg shadow-xl max-w-full w-[90vw] sm:max-w-md p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.confirmDelete}</h3>
        <p className="text-xs text-gray-600 mb-4">{t.deleteWarning}</p>
        {error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-red-600 text-xs">{error}</span>
          </div>
        )}
        <div className="flex justify-end gap-3">
          <motion.button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs transition-colors duration-200"
            aria-label={t.cancel}
            whileHover={{ scale: 1.05 }}
          >
            {t.cancel}
          </motion.button>
          <motion.button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs transition-colors duration-200"
            aria-label={t.delete}
            whileHover={{ scale: 1.05 }}
          >
            {t.delete}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export const Branches: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const formRef = useRef<HTMLDivElement>(null);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [resetPasswordData, setResetPasswordData] = useState({ password: '', confirmPassword: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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
    user: { name: '', nameEn: '', username: '', email: '', phone: '', password: '', isActive: true },
  });

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchTerm(value.trim());
    }, 300),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSearch(value);
  };

  const fetchData = useCallback(async () => {
    if (!user || user.role !== 'admin') {
      setError(t.unauthorized);
      setLoading(false);
      toast.error(t.unauthorized, { position: isRtl ? 'top-right' : 'top-left' });
      navigate('/dashboard');
      return;
    }
    setLoading(true);
    try {
      const response = await branchesAPI.getAll({ limit: 0 });
      const data = Array.isArray(response.data) ? response.data : response;
      setBranches(data);
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Fetch error:`, err);
      setError(err.message || t.fetchError);
      toast.error(t.fetchError, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setLoading(false);
    }
  }, [user, t, isRtl, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredBranches = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return branches
      .filter((branch) => {
        const name = (isRtl ? branch.name : branch.nameEn || branch.name).toLowerCase();
        const code = branch.code.toLowerCase();
        return name.startsWith(lowerSearchTerm) || code.startsWith(lowerSearchTerm) || name.includes(lowerSearchTerm);
      })
      .sort((a, b) => {
        const aName = (isRtl ? a.name : a.nameEn || a.name).toLowerCase();
        const bName = (isRtl ? b.name : b.nameEn || b.name).toLowerCase();
        const aCode = a.code.toLowerCase();
        const bCode = b.code.toLowerCase();
        if (aName.startsWith(lowerSearchTerm) && !bName.startsWith(lowerSearchTerm)) return -1;
        if (!aName.startsWith(lowerSearchTerm) && bName.startsWith(lowerSearchTerm)) return 1;
        if (aCode.startsWith(lowerSearchTerm) && !bCode.startsWith(lowerSearchTerm)) return -1;
        if (!aCode.startsWith(lowerSearchTerm) && bCode.startsWith(lowerSearchTerm)) return 1;
        return aName.localeCompare(bName);
      });
  }, [branches, searchTerm, isRtl]);

  const checkEmailAvailability = useCallback(async (email: string) => {
    try {
      const response = await branchesAPI.checkEmail(email);
      return response.available;
    } catch {
      return false;
    }
  }, []);

  const validateForm = useCallback(async () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = t.nameRequired;
    if (!formData.nameEn.trim()) errors.nameEn = t.nameEnRequired;
    if (!formData.code.trim()) errors.code = t.codeRequired;
    if (!formData.address.trim()) errors.address = t.addressRequired;
    if (!formData.addressEn.trim()) errors.addressEn = t.addressEnRequired;
    if (!formData.city.trim()) errors.city = t.cityRequired;
    if (!formData.cityEn.trim()) errors.cityEn = t.cityEnRequired;
    if (!showEditModal) {
      if (!formData.user.name.trim()) errors.userName = t.userNameRequired;
      if (!formData.user.nameEn.trim()) errors.userNameEn = t.userNameEnRequired;
      if (!formData.user.username.trim()) errors.username = t.usernameRequired;
      if (!formData.user.password.trim()) errors.password = t.passwordRequired;
      if (formData.user.email.trim()) {
        const isEmailAvailable = await checkEmailAvailability(formData.user.email);
        if (!isEmailAvailable && (!selectedBranch || formData.user.email !== selectedBranch.user?.email)) {
          errors.email = t.emailExists;
        }
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, showEditModal, t, checkEmailAvailability, selectedBranch]);

  const openAddModal = useCallback(() => {
    dispatchForm({ type: 'RESET' });
    setShowAddModal(true);
    setShowEditModal(false);
    setSelectedBranch(null);
    setFormErrors({});
    setError('');
    scrollToForm();
  }, []);

  const openEditModal = useCallback((branch: Branch, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatchForm({ type: 'RESET' });
    dispatchForm({ type: 'UPDATE_FIELD', field: 'name', value: branch.name });
    dispatchForm({ type: 'UPDATE_FIELD', field: 'nameEn', value: branch.nameEn || '' });
    dispatchForm({ type: 'UPDATE_FIELD', field: 'code', value: branch.code });
    dispatchForm({ type: 'UPDATE_FIELD', field: 'address', value: branch.address });
    dispatchForm({ type: 'UPDATE_FIELD', field: 'addressEn', value: branch.addressEn || '' });
    dispatchForm({ type: 'UPDATE_FIELD', field: 'city', value: branch.city });
    dispatchForm({ type: 'UPDATE_FIELD', field: 'cityEn', value: branch.cityEn || '' });
    dispatchForm({ type: 'UPDATE_FIELD', field: 'phone', value: branch.phone || '' });
    dispatchForm({ type: 'UPDATE_FIELD', field: 'isActive', value: branch.isActive });
    dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'name', value: branch.user?.name || '' });
    dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'nameEn', value: branch.user?.nameEn || '' });
    dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'username', value: branch.user?.username || '' });
    dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'email', value: branch.user?.email || '' });
    dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'phone', value: branch.user?.phone || '' });
    dispatchForm({ type: 'UPDATE_USER_FIELD', field: 'isActive', value: branch.user?.isActive ?? true });
    setShowEditModal(true);
    setShowAddModal(false);
    setSelectedBranch(branch);
    setFormErrors({});
    setError('');
    scrollToForm();
  }, []);

  const openResetPasswordModal = useCallback((branch: Branch, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBranch(branch);
    setResetPasswordData({ password: '', confirmPassword: '' });
    setShowResetPasswordModal(true);
    setError('');
  }, []);

  const openDeleteModal = useCallback((branch: Branch, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBranch(branch);
    setShowDeleteModal(true);
    setError('');
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!(await validateForm())) {
        toast.error(t.requiredFields, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      try {
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
          user: showEditModal
            ? {
                name: formData.user.name.trim(),
                nameEn: formData.user.nameEn.trim() || undefined,
                username: formData.user.username.trim(),
                email: formData.user.email.trim() || undefined,
                phone: formData.user.phone.trim() || undefined,
                isActive: formData.user.isActive,
              }
            : {
                name: formData.user.name.trim(),
                nameEn: formData.user.nameEn.trim() || undefined,
                username: formData.user.username.trim(),
                email: formData.user.email.trim() || undefined,
                phone: formData.user.phone.trim() || undefined,
                password: formData.user.password.trim(),
                isActive: formData.user.isActive,
              },
        };
        if (showEditModal && selectedBranch) {
          await branchesAPI.update(selectedBranch._id, branchData);
          setBranches(branches.map((b) => (b._id === selectedBranch._id ? { ...b, ...branchData } : b)));
          toast.success(t.updated, { position: isRtl ? 'top-right' : 'top-left' });
        } else {
          const response = await branchesAPI.create(branchData);
          setBranches([...branches, response]);
          toast.success(t.added, { position: isRtl ? 'top-right' : 'top-left' });
        }
        setShowAddModal(false);
        setShowEditModal(false);
        setError('');
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Submit error:`, err);
        let errorMessage = showEditModal ? t.updateError : t.createError;
        if (err.response?.data?.message) {
          const message = err.response.data.message;
          errorMessage =
            message === 'Branch code already exists' ? t.codeExists :
            message === 'Username already exists' ? t.usernameExists :
            message.includes('الإيميل') || message.includes('email') ? t.emailExists :
            message;
        }
        setError(errorMessage);
        toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
      }
    },
    [formData, showEditModal, selectedBranch, branches, t, isRtl]
  );

  const handleResetPassword = useCallback(
    async (e: React.FormEvent) => {
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
        await branchesAPI.resetPassword(selectedBranch!._id, resetPasswordData.password);
        setShowResetPasswordModal(false);
        setResetPasswordData({ password: '', confirmPassword: '' });
        toast.success(t.passwordResetSuccess, { position: isRtl ? 'top-right' : 'top-left' });
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Reset password error:`, err);
        const errorMessage = err.message || t.passwordResetError;
        setError(errorMessage);
        toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
      }
    },
    [resetPasswordData, selectedBranch, t, isRtl]
  );

  const handleDelete = useCallback(async () => {
    if (!selectedBranch) return;
    try {
      await branchesAPI.delete(selectedBranch._id);
      setBranches(branches.filter((b) => b._id !== selectedBranch._id));
      toast.success(t.deleted, { position: isRtl ? 'top-right' : 'top-left' });
      setShowDeleteModal(false);
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Delete error:`, err);
      let errorMessage = t.deleteError;
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message === 'Cannot delete branch with associated orders or inventory' ?
          t.deleteRestricted : err.response.data.message;
      }
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    }
  }, [selectedBranch, branches, t, isRtl]);

  const handleCardClick = useCallback((branchId: string) => {
    navigate(`/branches/${branchId}`);
  }, [navigate]);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className={`mx-auto  px-4 sm:px-6 lg:px-8 py-8 min-h-screen overflow-y-auto scrollbar-thin`}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="mb-6 flex flex-col items-center gap-4"
      >
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between sm:items-center w-full">
          <div className="flex  flex-col items-start gap-3 sm:flex-row sm:items-center gap-3">
            <MapPin className="w-6 h-6 text-amber-600" />
            <div className="text-center sm:text-left">
              <h1 className="text-xl font-bold text-gray-900">{t.manage}</h1>
              <p className="text-gray-600 text-xs">{t.addBranches}</p>
            </div>
          </div>
          {user?.role === 'admin' && (
            <motion.button
              onClick={openAddModal}
              className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors duration-200 flex items-center justify-center gap-2 shadow-sm"
              aria-label={t.add}
              whileHover={{ scale: 1.05 }}
            >
              <Plus className="w-4 h-4" />
              {t.add}
            </motion.button>
          )}
        </div>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-red-600 text-xs">{error}</span>
        </motion.div>
      )}

      {user?.role === 'admin' && (
        <div className={`lg:hidden fixed bottom-6 ${isRtl ? 'left-6' : 'right-6'} z-50`}>
          <motion.button
            onClick={openAddModal}
            className="p-3 bg-amber-600 hover:bg-amber-700 text-white rounded-full shadow-lg transition-colors duration-200"
            aria-label={t.scrollToForm}
            whileHover={{ scale: 1.05 }}
          >
            <Plus className="w-5 h-5" />
          </motion.button>
        </div>
      )}

      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="p-4 bg-white rounded-lg shadow-sm border border-gray-100"
        >
          <BranchSearchInput
            value={searchInput}
            onChange={handleSearchChange}
            placeholder={t.searchPlaceholder}
            ariaLabel={t.searchPlaceholder}
          />
          <div className="mt-3 text-center text-xs text-gray-600 font-medium">
            {isRtl ? `${t.branchCount}: ${filteredBranches.length}` : `${t.branchCount}: ${filteredBranches.length}`}
          </div>
        </motion.div>

        <div ref={formRef} className="lg:overflow-y-auto lg:max-h-[calc(100vh-12rem)] scrollbar-thin">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, index) => (
                <BranchSkeletonCard key={index} />
              ))}
            </div>
          ) : filteredBranches.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="p-6 text-center bg-white rounded-lg shadow-sm border border-gray-100"
            >
              <MapPin className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 text-xs">{searchTerm ? t.noMatch : t.empty}</p>
              {user?.role === 'admin' && !searchTerm && (
                <motion.button
                  onClick={openAddModal}
                  className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors duration-200"
                  aria-label={t.addFirst}
                  whileHover={{ scale: 1.05 }}
                >
                  {t.addFirst}
                </motion.button>
              )}
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {filteredBranches.map((branch, index) => (
                  <motion.div
                    key={branch._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2, ease: 'easeOut', delay: index * 0.05 }}
                  >
                    <BranchCard
                      branch={branch}
                      onEdit={(e) => openEditModal(branch, e)}
                      onResetPassword={(e) => openResetPasswordModal(branch, e)}
                      onDelete={(e) => openDeleteModal(branch, e)}
                      onClick={() => handleCardClick(branch._id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <BranchModal
        isOpen={showAddModal || showEditModal}
        onClose={() => {
          setShowAddModal(false);
          setShowEditModal(false);
        }}
        onSubmit={handleSubmit}
        formData={formData}
        dispatchForm={dispatchForm}
        editingBranch={showEditModal ? selectedBranch : null}
        formErrors={formErrors}
        error={error}
        t={t}
        isRtl={isRtl}
      />

      <BranchResetPasswordModal
        isOpen={showResetPasswordModal}
        onClose={() => setShowResetPasswordModal(false)}
        onSubmit={handleResetPassword}
        resetPasswordData={resetPasswordData}
        setResetPasswordData={setResetPasswordData}
        error={error}
        t={t}
        isRtl={isRtl}
      />

      <BranchDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        error={error}
        t={t}
        isRtl={isRtl}
      />
    </div>
  );
};

export default Branches;