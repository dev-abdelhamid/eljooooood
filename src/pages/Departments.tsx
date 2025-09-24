import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { departmentAPI } from '../services/api';
import { Layers, Plus, Edit2, Trash2, Search, AlertCircle, X, ChevronDown } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { debounce } from 'lodash';

interface Department {
  _id: string;
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
    namePlaceholder: 'أدخل اسم القسم',
    nameEnPlaceholder: 'أدخل اسم القسم بالإنجليزية',
    codePlaceholder: 'أدخل كود القسم',
    descriptionPlaceholder: 'أدخل وصف القسم',
    edit: 'تعديل',
    delete: 'حذف',
    update: 'تحديث القسم',
    saveError: 'خطأ في حفظ القسم',
    fetchError: 'خطأ في جلب البيانات',
    deleteError: 'خطأ في الحذف',
    unauthorized: 'غير مصرح لك',
    cancel: 'إلغاء',
    confirmDelete: 'تأكيد الحذف',
    deleteConfirm: 'هل أنت متأكد من حذف هذا القسم؟',
    deleted: 'تم الحذف بنجاح',
    added: 'تم إضافة القسم بنجاح',
    updated: 'تم تحديث القسم بنجاح',
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
    code: 'Code',
    description: 'Description',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    namePlaceholder: 'Enter department name',
    nameEnPlaceholder: 'Enter department name in English',
    codePlaceholder: 'Enter department code',
    descriptionPlaceholder: 'Enter department description',
    edit: 'Edit',
    delete: 'Delete',
    update: 'Update Department',
    saveError: 'Error saving department',
    fetchError: 'Error fetching data',
    deleteError: 'Error deleting department',
    unauthorized: 'Unauthorized access',
    cancel: 'Cancel',
    confirmDelete: 'Confirm Deletion',
    deleteConfirm: 'Are you sure you want to delete this department?',
    deleted: 'Deleted successfully',
    added: 'Department added successfully',
    updated: 'Department updated successfully',
  },
};

const CustomInput = ({
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
        className={`absolute ${isRtl ? 'left-3' : 'right-3'} flex items-center justify-center align-center  top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 transition-colors group-focus-within:text-amber-500`}
      >
        <Search className="w-4 h-4" />
      </motion.div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full ${isRtl ? 'pl-10 pr-2' : 'pr-10 pl-2'}  py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={ariaLabel}
      />
      <motion.div
        initial={{ opacity: value ? 1 : 0 }}
        animate={{ opacity: value ? 1 : 0 }}
        transition={{ duration: 0.15 }}
        className={`absolute ${isRtl ? 'left-3' : 'right-3'} flex items-center justify-center align-center top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-amber-500 transition-colors`}
      >
        <button
          onClick={() => onChange('')}
          aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
          className="flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </div>
  );
};

const CustomTextarea = ({
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
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs ${isRtl ? 'text-right' : 'text-left'}`}
      aria-label={ariaLabel}
      rows={3}
    />
  );
};

export function Departments() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [deletingDepartment, setDeletingDepartment] = useState<Department | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    code: '',
    description: '',
    isActive: true,
  });

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchTerm(value);
    }, 500),
    []
  );

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !['admin'].includes(user.role)) {
        setError(t('departments.unauthorized'));
        setLoading(false);
        toast.error(t('departments.unauthorized'), { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }

      setLoading(true);
      try {
        console.log('Fetching departments with params:', { limit: 0, search: searchTerm });
        console.log('API URL:', import.meta.env.VITE_API_URL);
        const departmentsResponse = await departmentAPI.getAll({ limit: 0, search: searchTerm });
        console.log('Departments response:', departmentsResponse);

        const departmentsWithDisplayName = departmentsResponse.data.map((dept: Department) => ({
          ...dept,
          displayName: language === 'ar' ? dept.name : (dept.nameEn || dept.name),
        }));
        setDepartments(departmentsWithDisplayName);
        setError('');
      } catch (err: any) {
        console.error('Fetch error:', err);
        console.error('Error details:', {
          status: err.status,
          message: err.message,
          url: err.config?.url,
        });
        setError(err.message || t('departments.fetchError'));
        toast.error(err.message || t('departments.fetchError'), { position: isRtl ? 'top-right' : 'top-left' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [t, user, searchTerm]);

  const filteredDepartments = departments.filter(
    (department) =>
      department.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      department.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openModal = (department?: Department) => {
    if (!user || !['admin'].includes(user.role)) {
      setError(t('departments.unauthorized'));
      toast.error(t('departments.unauthorized'), { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    if (department) {
      setEditingDepartment(department);
      setFormData({
        name: department.name,
        nameEn: department.nameEn || '',
        code: department.code,
        description: department.description || '',
        isActive: department.isActive,
      });
    } else {
      setEditingDepartment(null);
      setFormData({
        name: '',
        nameEn: '',
        code: '',
        description: '',
        isActive: true,
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDepartment(null);
    setError('');
  };

  const openDeleteModal = (department: Department) => {
    if (!user || !['admin'].includes(user.role)) {
      setError(t('departments.unauthorized'));
      toast.error(t('departments.unauthorized'), { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    setDeletingDepartment(department);
    setIsDeleteModalOpen(true);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const departmentData = {
        name: formData.name,
        nameEn: formData.nameEn || undefined,
        code: formData.code,
        description: formData.description || undefined,
        isActive: formData.isActive,
      };
      console.log('Submitting department:', departmentData);
      if (editingDepartment) {
        const updatedDepartment = await departmentAPI.update(editingDepartment._id, departmentData);
        setDepartments(
          departments.map((d) =>
            d._id === editingDepartment._id
              ? { ...updatedDepartment, displayName: language === 'ar' ? updatedDepartment.name : (updatedDepartment.nameEn || updatedDepartment.name) }
              : d
          )
        );
        toast.success(t('departments.updated'), { position: isRtl ? 'top-right' : 'top-left' });
      } else {
        const newDepartment = await departmentAPI.create(departmentData);
        setDepartments([
          ...departments,
          { ...newDepartment, displayName: language === 'ar' ? newDepartment.name : (newDepartment.nameEn || newDepartment.name) },
        ]);
        toast.success(t('departments.added'), { position: isRtl ? 'top-right' : 'top-left' });
      }
      closeModal();
    } catch (err: any) {
      console.error('Submit error:', err);
      const errorMessage = err.message || t('departments.saveError');
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  const handleDelete = async () => {
    if (!deletingDepartment) return;
    try {
      await departmentAPI.delete(deletingDepartment._id);
      setDepartments(departments.filter((d) => d._id !== deletingDepartment._id));
      toast.success(t('departments.deleted'), { position: isRtl ? 'top-right' : 'top-left' });
      setIsDeleteModalOpen(false);
      setError('');
    } catch (err: any) {
      console.error('Delete error:', err);
      const errorMessage = err.message || t('departments.deleteError');
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-6xl w-full px-4">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="p-4 bg-white rounded-xl shadow-sm">
              <div className="space-y-2 animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                <div className="h-2 bg-gray-200 rounded w-1/4"></div>
                <div className="h-2 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`mx-auto max-w-6xl px-4 py-6 min-h-screen overflow-y-auto scrollbar-none bg-gray-100 font-sans ${isRtl ? 'rtl font-arabic' : 'ltr'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-3"
      >
        <div className="flex items-center gap-2">
          <Layers className="w-6 h-6 text-amber-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t('departments.manage')}</h1>
            <p className="text-gray-600 text-xs">{isRtl ? 'إضافة، تعديل، أو حذف الأقسام' : 'Add, edit, or delete departments'}</p>
          </div>
        </div>
        {user?.role === 'admin' && (
          <button
            onClick={() => openModal()}
            className="w-full sm:w-auto px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md"
            aria-label={t('departments.add')}
          >
            <Plus className="w-3.5 h-3.5" />
            {t('departments.add')}
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
            className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 shadow-sm"
          >
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-red-600 text-xs">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        <div className="p-4 bg-white rounded-xl shadow-sm">
          <CustomInput
            value={searchInput}
            onChange={(value) => {
              setSearchInput(value);
              debouncedSearch(value);
            }}
            placeholder={t('departments.searchPlaceholder')}
            ariaLabel={t('departments.searchPlaceholder')}
          />
        </div>
        <div className="text-center text-xs text-gray-600">
          {isRtl ? `عدد الأقسام: ${filteredDepartments.length}` : `Departments Count: ${filteredDepartments.length}`}
        </div>

        {filteredDepartments.length === 0 ? (
          <div className="p-6 text-center bg-white rounded-xl shadow-sm">
            <Layers className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 text-xs">{searchTerm ? t('departments.noMatch') : t('departments.empty')}</p>
            {user?.role === 'admin' && !searchTerm && (
              <button
                onClick={() => openModal()}
                className="mt-3 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors shadow-sm hover:shadow-md"
                aria-label={t('departments.addFirst')}
              >
                {t('departments.addFirst')}
              </button>
            )}
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto scrollbar-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.1 }}
          >
            {filteredDepartments.map((department) => (
              <motion.div
                key={department._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div
                  className="p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold text-gray-900 text-sm truncate">{department.displayName}</h3>
                      <Layers className="w-4 h-4 text-amber-600" />
                    </div>
                    <p className="text-xs text-gray-600 flex"><span className="w-16 font-medium">{t('departments.code')}:</span> <span>{department.code}</span></p>
                    {department.description && <p className="text-xs text-gray-600 flex"><span className="w-16 font-medium">{t('departments.description')}:</span> <span className="truncate">{department.description}</span></p>}
                    <p className={`text-xs flex ${department.isActive ? 'text-green-600' : 'text-red-600'}`}>
                      <span className="w-16 font-medium">{t('departments.status')}:</span> <span>{department.isActive ? t('departments.active') : t('departments.inactive')}</span>
                    </p>
                  </div>
                  {user?.role === 'admin' && (
                    <div className="mt-3 flex items-center justify-end gap-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); openModal(department); }}
                        className="p-1.5 w-7 h-7 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors flex items-center justify-center"
                        title={t('departments.edit')}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); openDeleteModal(department); }}
                        className="p-1.5 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors flex items-center justify-center"
                        title={t('departments.delete')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-xl shadow-xl max-w-full w-[90vw] sm:max-w-md p-5"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{editingDepartment ? t('departments.edit') : t('departments.add')}</h3>
            <form onSubmit={handleSubmit} className="space-y-3" dir={isRtl ? 'rtl' : 'ltr'}>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label htmlFor="name" className="block text-xs font-medium text-gray-700 mb-1">{t('departments.name')}</label>
                  <input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t('departments.namePlaceholder')}
                    required
                    className={`w-full px-3 py-2 border ${error && !formData.name ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs ${isRtl ? 'text-right' : 'text-left'}`}
                  />
                </div>
                <div>
                  <label htmlFor="nameEn" className="block text-xs font-medium text-gray-700 mb-1">{t('departments.nameEn')}</label>
                  <input
                    id="nameEn"
                    value={formData.nameEn}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    placeholder={t('departments.nameEnPlaceholder')}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs ${isRtl ? 'text-right' : 'text-left'}`}
                  />
                </div>
                <div>
                  <label htmlFor="code" className="block text-xs font-medium text-gray-700 mb-1">{t('departments.code')}</label>
                  <input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder={t('departments.codePlaceholder')}
                    required
                    className={`w-full px-3 py-2 border ${error && !formData.code ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs ${isRtl ? 'text-right' : 'text-left'}`}
                  />
                </div>
                <div>
                  <label htmlFor="description" className="block text-xs font-medium text-gray-700 mb-1">{t('departments.description')}</label>
                  <CustomTextarea
                    value={formData.description}
                    onChange={(value) => setFormData({ ...formData, description: value })}
                    placeholder={t('departments.descriptionPlaceholder')}
                    ariaLabel={t('departments.description')}
                  />
                </div>
                <div>
                  <label htmlFor="status" className="block text-xs font-medium text-gray-700 mb-1">{t('departments.status')}</label>
                  <CustomDropdown
                    value={formData.isActive}
                    onChange={(value) => setFormData({ ...formData, isActive: value === 'true' })}
                    options={[
                      { value: true, label: t('departments.active') },
                      { value: false, label: t('departments.inactive') },
                    ]}
                    ariaLabel={t('departments.status')}
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
                  className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs transition-colors shadow-sm hover:shadow-md"
                >
                  {t('departments.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors shadow-sm hover:shadow-md"
                >
                  {editingDepartment ? t('departments.update') : t('departments.add')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-xl shadow-xl max-w-full w-[90vw] sm:max-w-sm p-5"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('departments.confirmDelete')}</h3>
            <div className="space-y-3" dir={isRtl ? 'rtl' : 'ltr'}>
              <p className="text-gray-600 text-xs">{t('departments.deleteConfirm')}</p>
              {error && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span className="text-red-600 text-xs">{error}</span>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs transition-colors shadow-sm hover:shadow-md"
                >
                  {t('departments.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs transition-colors shadow-sm hover:shadow-md"
                >
                  {t('departments.delete')}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
