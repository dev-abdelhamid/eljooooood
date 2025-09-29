import React, { useState, useEffect, useCallback, useRef, useTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { departmentAPI } from '../services/api';
import { Layers, Plus, Edit2, Trash2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { debounce } from 'lodash';

interface Department {
  id: string;
  name: string;
  nameEn?: string;
  code: string;
  description?: string;
  isActive: boolean;
  displayName: string;
}

const translations = {
  ar: {
    manage: 'إدارة الأقسام',
    add: 'إضافة قسم',
    addFirst: 'إضافة أول قسم',
    noDepartments: 'لا توجد أقسام',
    noMatch: 'لا توجد أقسام مطابقة',
    empty: 'لا توجد أقسام متاحة',
    searchPlaceholder: 'ابحث عن الأقسام...',
    name: 'اسم القسم (عربي)',
    nameEn: 'اسم القسم (إنجليزي)',
    code: 'كود القسم',
    description: 'الوصف',
    status: 'الحالة',
    active: 'نشط',
    inactive: 'غير نشط',
    edit: 'تعديل',
    delete: 'حذف',
    nameRequired: 'اسم القسم مطلوب',
    codeRequired: 'كود القسم مطلوب',
    namePlaceholder: 'أدخل اسم القسم',
    nameEnPlaceholder: 'أدخل اسم القسم بالإنجليزية',
    codePlaceholder: 'أدخل كود القسم',
    descriptionPlaceholder: 'أدخل وصف القسم',
    update: 'تحديث القسم',
    requiredFields: 'يرجى ملء جميع الحقول المطلوبة',
    unauthorized: 'غير مصرح لك',
    fetchError: 'خطأ في جلب البيانات',
    saveError: 'خطأ في حفظ القسم',
    deleteError: 'خطأ في الحذف',
    added: 'تم إضافة القسم بنجاح',
    updated: 'تم تحديث القسم بنجاح',
    deleted: 'تم الحذف بنجاح',
    confirmDelete: 'تأكيد الحذف',
    deleteWarning: 'هل أنت متأكد من حذف هذا القسم؟',
    cancel: 'إلغاء',
    page: 'الصفحة',
    previous: 'السابق',
    next: 'التالي',
  },
  en: {
    manage: 'Manage Departments',
    add: 'Add Department',
    addFirst: 'Add First Department',
    noDepartments: 'No Departments Found',
    noMatch: 'No Matching Departments',
    empty: 'No Departments Available',
    searchPlaceholder: 'Search departments...',
    name: 'Department Name (Arabic)',
    nameEn: 'Department Name (English)',
    code: 'Department Code',
    description: 'Description',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    edit: 'Edit',
    delete: 'Delete',
    nameRequired: 'Department name is required',
    codeRequired: 'Department code is required',
    namePlaceholder: 'Enter department name',
    nameEnPlaceholder: 'Enter department name in English',
    codePlaceholder: 'Enter department code',
    descriptionPlaceholder: 'Enter department description',
    update: 'Update Department',
    requiredFields: 'Please fill all required fields',
    unauthorized: 'Unauthorized access',
    fetchError: 'Error fetching data',
    saveError: 'Error saving department',
    deleteError: 'Error deleting department',
    added: 'Department added successfully',
    updated: 'Department updated successfully',
    deleted: 'Deleted successfully',
    confirmDelete: 'Confirm Deletion',
    deleteWarning: 'Are you sure you want to delete this department?',
    cancel: 'Cancel',
    page: 'Page',
    previous: 'Previous',
    next: 'Next',
  },
};

const CustomInput = React.memo(
  ({
    value,
    onChange,
    placeholder,
    ariaLabel,
  }: {
    value: string;
    onChange: (value: string) => void;
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
          className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 transition-colors group-focus-within:text-amber-600 dark:text-gray-500 dark:group-focus-within:text-amber-400`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1116.65 16.65z" />
          </svg>
        </motion.div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full ${isRtl ? 'pl-10 pr-3' : 'pr-10 pl-3'} py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md text-sm placeholder-gray-400 dark:placeholder-gray-500 dark:text-gray-200 ${isRtl ? 'text-right' : 'text-left'}`}
          aria-label={ariaLabel}
        />
        <motion.div
          initial={{ opacity: value ? 1 : 0 }}
          animate={{ opacity: value ? 1 : 0 }}
          transition={{ duration: 0.15 }}
          className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-amber-600 dark:text-gray-500 dark:hover:text-amber-400 transition-colors`}
        >
          <button
            onClick={() => onChange('')}
            aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
            className="flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </motion.div>
      </div>
    );
  }
);

const CustomDropdown = React.memo(
  ({
    value,
    onChange,
    options,
    ariaLabel,
  }: {
    value: string | boolean;
    onChange: (value: string) => void;
    options: { value: string | boolean; label: string }[];
    ariaLabel: string;
  }) => {
    const { language } = useLanguage();
    const isRtl = language === 'ar';
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const selectedOption = options.find((opt) => opt.value === value) || options[0] || { label: isRtl ? 'اختر' : 'Select' };

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
      <div className="relative group" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
        <motion.button
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className={`w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md text-sm text-gray-700 dark:text-gray-200 ${isRtl ? 'text-right' : 'text-left'} flex justify-between items-center`}
          aria-label={ariaLabel}
        >
          <span className="truncate">{selectedOption.label}</span>
          <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <svg className="w-4 h-4 text-gray-400 group-focus-within:text-amber-600 dark:text-gray-500 dark:group-focus-within:text-amber-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
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
              className="absolute w-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-300 dark:border-gray-600 z-20 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-amber-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-700"
            >
              {options.map((option) => (
                <motion.div
                  key={String(option.value)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(String(option.value));
                    setIsOpen(false);
                  }}
                  className="px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-amber-50 dark:hover:bg-amber-900 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer transition-colors duration-200"
                  whileHover={{ backgroundColor: isRtl ? '#fef3c7' : '#fef3c7' }}
                >
                  {option.label}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

export function Departments() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    code: '',
    description: '',
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      startTransition(() => {
        setSearchTerm(value);
        setCurrentPage(1);
      });
    }, 300),
    []
  );

  const fetchData = useCallback(async () => {
    if (!user || !['admin', 'production'].includes(user.role)) {
      setError(t.unauthorized);
      setLoading(false);
      toast.error(t.unauthorized, { position: isRtl ? 'top-right' : 'top-left', theme: isRtl ? 'light' : 'dark' });
      return;
    }
    setLoading(true);
    try {
      const response = await departmentAPI.getAll({ page: currentPage, limit: 12, search: searchTerm, isRtl });
      const departmentsData = Array.isArray(response.data) ? response.data : [];
      setDepartments(
        departmentsData.map((dept: any) => ({
          id: dept._id,
          name: dept.name,
          nameEn: dept.nameEn,
          code: dept.code,
          description: dept.description,
          isActive: dept.isActive,
          displayName: isRtl ? dept.name : dept.nameEn || dept.name,
        }))
      );
      setTotalPages(response.totalPages || 1);
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Fetch error:`, err);
      setError(err.message || t.fetchError);
      toast.error(err.message || t.fetchError, { position: isRtl ? 'top-right' : 'top-left', theme: isRtl ? 'light' : 'dark' });
    } finally {
      setLoading(false);
    }
  }, [user, t, isRtl, currentPage, searchTerm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredDepartments = departments.filter(
    (department) =>
      department.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      department.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.name) errors.name = t.nameRequired;
    if (!formData.code) errors.code = t.codeRequired;
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openAddModal = () => {
    setFormData({
      name: '',
      nameEn: '',
      code: '',
      description: '',
      isActive: true,
    });
    setIsEditMode(false);
    setSelectedDepartment(null);
    setIsModalOpen(true);
    setFormErrors({});
    setError('');
  };

  const openEditModal = (department: Department) => {
    setFormData({
      name: department.name,
      nameEn: department.nameEn || '',
      code: department.code,
      description: department.description || '',
      isActive: department.isActive,
    });
    setIsEditMode(true);
    setSelectedDepartment(department);
    setIsModalOpen(true);
    setFormErrors({});
    setError('');
  };

  const openDeleteModal = (department: Department) => {
    setSelectedDepartment(department);
    setIsDeleteModalOpen(true);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error(t.requiredFields, { position: isRtl ? 'top-right' : 'top-left', theme: isRtl ? 'light' : 'dark' });
      return;
    }
    startTransition(async () => {
      try {
        const departmentData = {
          name: formData.name.trim(),
          nameEn: formData.nameEn?.trim() || undefined,
          code: formData.code.trim(),
          description: formData.description?.trim() || undefined,
          isActive: formData.isActive,
        };
        if (isEditMode && selectedDepartment) {
          const updatedDepartment = await departmentAPI.update(selectedDepartment.id, departmentData);
          setDepartments(
            departments.map((d) =>
              d.id === selectedDepartment.id
                ? {
                    ...updatedDepartment,
                    id: updatedDepartment._id,
                    displayName: isRtl ? updatedDepartment.name : updatedDepartment.nameEn || updatedDepartment.name,
                  }
                : d
            )
          );
          toast.success(t.updated, { position: isRtl ? 'top-right' : 'top-left', theme: isRtl ? 'light' : 'dark' });
        } else {
          const newDepartment = await departmentAPI.create(departmentData);
          setDepartments([
            ...departments,
            {
              ...newDepartment,
              id: newDepartment._id,
              displayName: isRtl ? newDepartment.name : newDepartment.nameEn || newDepartment.name,
            },
          ]);
          toast.success(t.added, { position: isRtl ? 'top-right' : 'top-left', theme: isRtl ? 'light' : 'dark' });
        }
        setIsModalOpen(false);
      } catch (err: any) {
        const errorMessage = err.message || t.saveError;
        setError(errorMessage);
        toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left', theme: isRtl ? 'light' : 'dark' });
      }
    });
  };

  const handleDelete = async () => {
    if (!selectedDepartment) return;
    startTransition(async () => {
      try {
        await departmentAPI.delete(selectedDepartment.id);
        setDepartments(departments.filter((d) => d.id !== selectedDepartment.id));
        toast.success(t.deleted, { position: isRtl ? 'top-right' : 'top-left', theme: isRtl ? 'light' : 'dark' });
        setIsDeleteModalOpen(false);
      } catch (err: any) {
        const errorMessage = err.message || t.deleteError;
        setError(errorMessage);
        toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left', theme: isRtl ? 'light' : 'dark' });
      }
    });
  };

  if (loading || isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl w-full px-4 sm:px-6 lg:px-8">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="p-5 bg-white dark:bg-gray-800 rounded-2xl shadow-sm">
              <div className="space-y-3 animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`mx-auto px-4 sm:px-6 lg:px-8 py-6 min-h-screen overflow-y-auto scrollbar-thin scrollbar-thumb-amber-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800 bg-gray-50 dark:bg-gray-900`}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl"
      >
        <div className="flex items-center flex-col sm:flex-row gap-3">
          <Layers className="w-8 h-8 text-amber-600 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-900/50 p-2 rounded-full" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{t.manage}</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">{isRtl ? 'إضافة، تعديل، أو حذف الأقسام' : 'Add, edit, or delete departments'}</p>
          </div>
        </div>
        {['admin', 'production'].includes(user?.role ?? '') && (
          <button
            onClick={openAddModal}
            className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
            aria-label={t.add}
          >
            <Plus className="w-4 h-4" />
            {t.add}
          </button>
        )}
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="mt-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-lg flex items-center gap-2 shadow-sm"
          >
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span className="text-red-600 dark:text-red-400 text-sm">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6 mt-6">
        <div className="p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <CustomInput
            value={searchInput}
            onChange={(value) => {
              setSearchInput(value);
              debouncedSearch(value);
            }}
            placeholder={t.searchPlaceholder}
            ariaLabel={t.searchPlaceholder}
          />
        </div>
        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
          {isRtl ? `عدد الأقسام: ${filteredDepartments.length}` : `Departments Count: ${filteredDepartments.length}`}
        </div>
        {filteredDepartments.length === 0 ? (
          <div className="p-6 sm:p-8 text-center bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <Layers className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400 text-sm">{searchTerm ? t.noMatch : t.empty}</p>
            {['admin', 'production'].includes(user?.role ?? '') && !searchTerm && (
              <button
                onClick={openAddModal}
                className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white rounded-lg text-sm transition-colors shadow-sm hover:shadow-md"
                aria-label={t.addFirst}
              >
                {t.addFirst}
              </button>
            )}
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.1 }}
          >
            {filteredDepartments.map((department) => (
              <motion.div
                key={department.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <div
                  className="p-5 sm:p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer border border-gray-100 dark:border-gray-700 max-w-sm mx-auto group relative overflow-hidden"
                  onClick={() => navigate(`/departments/${department.id}`)}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-100/50 to-amber-200/50 dark:from-amber-900/50 dark:to-amber-800/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base sm:text-lg truncate" style={{ whiteSpace: 'nowrap' }}>
                        {department.displayName}
                      </h3>
                      <Layers className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 overflow-hidden whitespace-nowrap">
                      <span className="min-w-[80px] font-medium flex-shrink-0">{t.code}:</span>
                      <span className="truncate overflow-hidden text-ellipsis flex-1">{department.code}</span>
                    </div>
                    {department.description && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 overflow-hidden whitespace-nowrap">
                        <span className="min-w-[80px] font-medium flex-shrink-0">{t.description}:</span>
                        <span className="truncate overflow-hidden text-ellipsis flex-1">{department.description}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="min-w-[80px] font-medium">{t.status}:</span>
                      <span className={`px-2 py-1 rounded-full text-xs ${department.isActive ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'}`}>
                        {department.isActive ? t.active : t.inactive}
                      </span>
                    </div>
                  </div>
                  {['admin', 'production'].includes(user?.role ?? '') && (
                    <div className="mt-4 flex items-center justify-end gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(department);
                        }}
                        className="p-2 w-10 h-10 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-full transition-colors flex items-center justify-center shadow-sm hover:shadow-md"
                        title={t.edit}
                        aria-label={t.edit}
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteModal(department);
                        }}
                        className="p-2 w-10 h-10 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white rounded-full transition-colors flex items-center justify-center shadow-sm hover:shadow-md"
                        title={t.delete}
                        aria-label={t.delete}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {filteredDepartments.length > 0 && (
        <div className="flex justify-center mt-6 gap-4 items-center">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm hover:shadow-md"
            aria-label={t.previous}
          >
            <ChevronLeft className="w-4 h-4" />
            {t.previous}
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {t.page} {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm hover:shadow-md"
            aria-label={t.next}
          >
            {t.next}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-full w-[90vw] sm:max-w-lg p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{isEditMode ? t.edit : t.add}</h3>
            <form onSubmit={handleSubmit} className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.name}</label>
                  <input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t.namePlaceholder}
                    className={`w-full px-3 py-3 border ${formErrors.name ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'} rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md text-sm dark:text-gray-200 ${isRtl ? 'text-right' : 'text-left'}`}
                    aria-invalid={!!formErrors.name}
                    aria-describedby={formErrors.name ? 'name-error' : undefined}
                  />
                  {formErrors.name && <p id="name-error" className="text-sm text-red-600 dark:text-red-400 mt-1">{formErrors.name}</p>}
                </div>
                <div>
                  <label htmlFor="nameEn" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.nameEn}</label>
                  <input
                    id="nameEn"
                    value={formData.nameEn}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    placeholder={t.nameEnPlaceholder}
                    className={`w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md text-sm dark:text-gray-200 ${isRtl ? 'text-right' : 'text-left'}`}
                  />
                </div>
                <div>
                  <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.code}</label>
                  <input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder={t.codePlaceholder}
                    className={`w-full px-3 py-3 border ${formErrors.code ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'} rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md text-sm dark:text-gray-200 ${isRtl ? 'text-right' : 'text-left'}`}
                    aria-invalid={!!formErrors.code}
                    aria-describedby={formErrors.code ? 'code-error' : undefined}
                  />
                  {formErrors.code && <p id="code-error" className="text-sm text-red-600 dark:text-red-400 mt-1">{formErrors.code}</p>}
                </div>
                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.status}</label>
                  <CustomDropdown
                    value={formData.isActive}
                    onChange={(value) => setFormData({ ...formData, isActive: value === 'true' })}
                    options={[
                      { value: true, label: t.active },
                      { value: false, label: t.inactive },
                    ]}
                    ariaLabel={t.status}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.description}</label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t.descriptionPlaceholder}
                    className={`w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md text-sm dark:text-gray-200 ${isRtl ? 'text-right' : 'text-left'}`}
                    rows={4}
                  />
                </div>
              </div>
              {error && (
                <div className="p-2 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span className="text-red-600 dark:text-red-400 text-sm">{error}</span>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm transition-colors shadow-sm hover:shadow-md"
                  aria-label={t.cancel}
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white rounded-lg text-sm transition-colors shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isPending}
                  aria-label={isEditMode ? t.update : t.add}
                >
                  {isPending ? (isRtl ? 'جاري...' : 'Processing...') : isEditMode ? t.update : t.add}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={(e) => { if (e.target === e.currentTarget) setIsDeleteModalOpen(false); }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-full w-[90vw] sm:max-w-sm p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{t.confirmDelete}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t.deleteWarning}</p>
            {error && (
              <div className="p-2 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-lg flex items-center gap-2 mb-4">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span className="text-red-600 dark:text-red-400 text-sm">{error}</span>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm transition-colors shadow-sm hover:shadow-md"
                aria-label={t.cancel}
              >
                {t.cancel}
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 text-white rounded-lg text-sm transition-colors shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isPending}
                aria-label={t.delete}
              >
                {isPending ? (isRtl ? 'جاري...' : 'Processing...') : t.delete}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}