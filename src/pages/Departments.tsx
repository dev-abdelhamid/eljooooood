import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { departmentAPI } from '../services/api';
import { Package, Plus, Edit2, Trash2, Search, AlertCircle, X, ChevronDown } from 'lucide-react';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import { motion, AnimatePresence } from 'framer-motion';

interface Department {
  _id: string;
  name: string;
  nameEn?: string;
  status: 'Active' | 'Inactive';
  displayName: string;
}

const translations = {
  ar: {
    manage: 'إدارة الأقسام',
    add: 'إضافة قسم جديد',
    addFirst: 'إضافة أول قسم',
    empty: 'لا توجد أقسام متاحة',
    noMatch: 'لا توجد أقسام مطابقة',
    searchPlaceholder: 'ابحث عن الأقسام...',
    name: 'اسم القسم',
    nameEn: 'الاسم بالإنجليزية',
    status: 'الحالة',
    edit: 'تعديل',
    delete: 'حذف',
    namePlaceholder: 'أدخل اسم القسم',
    nameEnPlaceholder: 'أدخل الاسم بالإنجليزية',
    statusPlaceholder: 'اختر الحالة',
    update: 'تحديث القسم',
    requiredFields: 'يرجى ملء جميع الحقول المطلوبة',
    invalidStatus: 'الحالة غير صالحة، اختر من القائمة',
    unauthorized: 'غير مصرح',
    fetchError: 'خطأ في جلب البيانات',
    saveError: 'خطأ في حفظ القسم',
    deleteError: 'خطأ في حذف القسم',
    added: 'تم إنشاء القسم بنجاح',
    updated: 'تم تحديث القسم بنجاح',
    deleted: 'تم حذف القسم بنجاح',
    confirmDelete: 'تأكيد الحذف',
    deleteWarning: 'هل أنت متأكد من حذف هذا القسم؟',
    cancel: 'إلغاء',
  },
  en: {
    manage: 'Manage Departments',
    add: 'Add New Department',
    addFirst: 'Add First Department',
    empty: 'No departments available',
    noMatch: 'No matching departments',
    searchPlaceholder: 'Search departments...',
    name: 'Department Name',
    nameEn: 'English Name',
    status: 'Status',
    edit: 'Edit',
    delete: 'Delete',
    namePlaceholder: 'Enter department name',
    nameEnPlaceholder: 'Enter English name',
    statusPlaceholder: 'Select Status',
    update: 'Update Department',
    requiredFields: 'Please fill all required fields',
    invalidStatus: 'Invalid status, please select from the list',
    unauthorized: 'Unauthorized',
    fetchError: 'Error fetching data',
    saveError: 'Error saving department',
    deleteError: 'Error deleting department',
    added: 'Department created successfully',
    updated: 'Department updated successfully',
    deleted: 'Department deleted successfully',
    confirmDelete: 'Confirm Deletion',
    deleteWarning: 'Are you sure you want to delete this department?',
    cancel: 'Cancel',
  },
};

const statusOptions = [
  { value: 'Active', labelAr: 'نشط', labelEn: 'Active' },
  { value: 'Inactive', labelAr: 'غير نشط', labelEn: 'Inactive' },
];

const CustomInput = React.memo(
  ({
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
        <motion.div
          initial={{ opacity: value ? 0 : 1 }}
          animate={{ opacity: value ? 0 : 1 }}
          transition={{ duration: 0.15 }}
          className={`absolute ${isRtl ? 'left-3' : 'right-3'} flex items-center justify-center align-center top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 transition-colors group-focus-within:text-amber-500`}
        >
          <Search className="w-4 h-4" />
        </motion.div>
        <input
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full ${isRtl ? 'pl-10 pr-2' : 'pr-10 pl-2'} py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}
          aria-label={ariaLabel}
        />
        <motion.div
          initial={{ opacity: value ? 1 : 0 }}
          animate={{ opacity: value ? 1 : 0 }}
          transition={{ duration: 0.15 }}
          className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 flex items-center justify-center align-center transform -translate-y-1/2 text-gray-400 hover:text-amber-500 transition-colors`}
        >
          <button
            onClick={() => onChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>)}
            aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
            className="flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      </div>
    );
  }
);

const CustomDropdown = ({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((opt) => opt.value === value) || { value: '', label: isRtl ? 'اختر' : 'Select' };

  return (
    <div className="relative group" onClick={(e) => e.stopPropagation()}>
      <motion.button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs text-gray-700 ${isRtl ? 'text-right' : 'text-left'} flex justify-between items-center`}
        aria-label={ariaLabel}
      >
        <span className="truncate">{selectedOption.label}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
        </motion.div>
      </motion.button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-300 z-20 max-h-48 overflow-y-auto scrollbar-none"
          >
            {options.map((option) => (
              <motion.div
                key={option.value}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className="px-3 py-2 text-xs text-gray-700 hover:bg-amber-50 hover:text-amber-600 cursor-pointer transition-colors duration-200"
                whileHover={{ backgroundColor: '#fef3c7' }}
              >
                {option.label}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export function Departments() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingDepartmentId, setDeletingDepartmentId] = useState<string | null>(null);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchTerm(value);
    }, 500),
    []
  );

  useEffect(() => {
    if (!user || !['admin', 'production'].includes(user.role)) {
      setError(t.unauthorized);
      setLoading(false);
      toast.error(t.unauthorized);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await departmentAPI.getAll({ search: searchTerm, limit: 100 });
        const departmentsWithDisplay = response.data.map((department: Department) => ({
          ...department,
          displayName: isRtl ? department.name : (department.nameEn || department.name),
        }));
        setDepartments(departmentsWithDisplay);
        setError('');
      } catch (err: any) {
        console.error('Fetch error:', err);
        setError(err.response?.data?.message || t.fetchError);
        toast.error(err.response?.data?.message || t.fetchError);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isRtl, user, searchTerm, t]);

  const openModal = (department?: Department) => {
    if (!user || !['admin', 'production'].includes(user.role)) {
      setError(t.unauthorized);
      toast.error(t.unauthorized);
      return;
    }
    if (department) {
      setEditingDepartment(department);
      setFormData({
        name: department.name,
        nameEn: department.nameEn || '',
        status: department.status || 'Active',
      });
    } else {
      setEditingDepartment(null);
      setFormData({
        name: '',
        nameEn: '',
        status: 'Active',
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDepartment(null);
    setError('');
  };

  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    status: 'Active' as 'Active' | 'Inactive',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      setError(t.requiredFields);
      toast.error(t.requiredFields);
      return;
    }
    if (!statusOptions.some((opt) => opt.value === formData.status)) {
      setError(t.invalidStatus);
      toast.error(t.invalidStatus);
      return;
    }
    try {
      const departmentData = {
        name: formData.name.trim(),
        nameEn: formData.nameEn?.trim() || undefined,
        status: formData.status,
      };
      if (editingDepartment) {
        const updatedDepartment = await departmentAPI.update(editingDepartment._id, departmentData);
        setDepartments(
          departments.map((d) =>
            d._id === editingDepartment._id
              ? {
                  ...updatedDepartment,
                  displayName: isRtl ? updatedDepartment.name : (updatedDepartment.nameEn || updatedDepartment.name),
                }
              : d
          )
        );
        toast.success(t.updated);
      } else {
        const newDepartment = await departmentAPI.create(departmentData);
        setDepartments([
          ...departments,
          {
            ...newDepartment,
            displayName: isRtl ? newDepartment.name : (newDepartment.nameEn || newDepartment.name),
          },
        ]);
        toast.success(t.added);
      }
      closeModal();
    } catch (err: any) {
      console.error('Submit error:', err);
      setError(err.response?.data?.message || t.saveError);
      toast.error(err.response?.data?.message || t.saveError);
    }
  };

  const openDeleteModal = (id: string) => {
    setDeletingDepartmentId(id);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setDeletingDepartmentId(null);
  };

  const confirmDelete = async () => {
    if (!deletingDepartmentId) return;
    if (!user || !['admin', 'production'].includes(user.role)) {
      setError(t.unauthorized);
      toast.error(t.unauthorized);
      return;
    }
    try {
      await departmentAPI.delete(deletingDepartmentId);
      setDepartments(departments.filter((d) => d._id !== deletingDepartmentId));
      toast.success(t.deleted);
      closeDeleteModal();
    } catch (err: any) {
      console.error('Delete error:', err);
      setError(err.response?.data?.message || t.deleteError);
      toast.error(err.response?.data?.message || t.deleteError);
    }
  };

  return (
    <div className="mx-auto px-4 py-6 min-h-screen overflow-y-auto scrollbar-none" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="mb-4 flex flex-col items-center sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <Package className="w-6 h-6 text-amber-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t.manage}</h1>
            <p className="text-gray-600 text-xs">{isRtl ? 'قم بإضافة الأقسام أو تعديلها أو حذفها' : 'Add, edit, or delete departments'}</p>
          </div>
        </div>
        {['admin', 'production'].includes(user?.role ?? '') && (
          <button
            onClick={() => openModal()}
            className="w-full sm:w-auto px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            aria-label={t.add}
          >
            <Plus className="w-3.5 h-3.5" />
            {t.add}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-red-600 text-xs">{error}</span>
        </div>
      )}

      <div className="space-y-3">
        <div className="p-4 bg-white rounded-xl shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CustomInput
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                debouncedSearch(e.target.value);
              }}
              placeholder={t.searchPlaceholder}
              ariaLabel={t.searchPlaceholder}
            />
          </div>
        </div>
        <div className="text-center text-xs text-gray-600">
          {isRtl ? `عدد الأقسام: ${departments.length}` : `Departments Count: ${departments.length}`}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto scrollbar-none">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="p-4 bg-white rounded-xl shadow-sm">
                <div className="space-y-2 animate-pulse">
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : departments.length === 0 ? (
          <div className="p-6 text-center bg-white rounded-xl shadow-sm">
            <Package className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 text-xs">{searchTerm ? t.noMatch : t.empty}</p>
            {['admin', 'production'].includes(user?.role ?? '') && !searchTerm && (
              <button
                onClick={() => openModal()}
                className="mt-3 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors"
                aria-label={t.addFirst}
              >
                {t.addFirst}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto scrollbar-none">
            {departments.map((department) => (
              <div
                key={department._id}
                className="p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <h3 className="font-semibold text-gray-900 text-sm truncate">{department.displayName}</h3>
                  <p className="text-xs text-amber-600">{isRtl ? (department.status === 'Active' ? 'نشط' : 'غير نشط') : department.status}</p>
                </div>
                {['admin', 'production'].includes(user?.role ?? '') && (
                  <div className="mt-3 flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => openModal(department)}
                      className="p-1.5 w-7 h-7 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors flex items-center justify-center"
                      title={t.edit}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openDeleteModal(department._id)}
                      className="p-1.5 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors flex items-center justify-center"
                      title={t.delete}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="bg-white rounded-xl shadow-xl max-w-full w-[90vw] sm:max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{editingDepartment ? t.edit : t.add}</h3>
            <form onSubmit={handleSubmit} className="space-y-3" dir={isRtl ? 'rtl' : 'ltr'}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="name" className="block text-xs font-medium text-gray-700 mb-1">{t.name}</label>
                  <input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t.namePlaceholder}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="nameEn" className="block text-xs font-medium text-gray-700 mb-1">{t.nameEn}</label>
                  <input
                    id="nameEn"
                    value={formData.nameEn}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    placeholder={t.nameEnPlaceholder}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="status" className="block text-xs font-medium text-gray-700 mb-1">{t.status}</label>
                  <CustomDropdown
                    value={formData.status}
                    onChange={(value) => setFormData({ ...formData, status: value as 'Active' | 'Inactive' })}
                    options={statusOptions.map((opt) => ({
                      value: opt.value,
                      label: isRtl ? opt.labelAr : opt.labelEn,
                    }))}
                    ariaLabel={t.status}
                  />
                </div>
              </div>
              {error && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span className="text-red-600 text-xs">{error}</span>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs transition-colors"
                  aria-label={t.cancel}
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors"
                  aria-label={editingDepartment ? t.update : t.add}
                >
                  {editingDepartment ? t.update : t.add}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={(e) => { if (e.target === e.currentTarget) closeDeleteModal(); }}>
          <div className="bg-white rounded-xl shadow-xl max-w-full w-[90vw] sm:max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{t.confirmDelete}</h3>
            <p className="text-xs text-gray-600 mb-4">{t.deleteWarning}</p>
            {error && (
              <div className="p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 mb-4">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-red-600 text-xs">{error}</span>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={closeDeleteModal}
                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs transition-colors"
                aria-label={t.cancel}
              >
                {t.cancel}
              </button>
              <button
                onClick={confirmDelete}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs transition-colors"
                aria-label={t.delete}
              >
                {t.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}