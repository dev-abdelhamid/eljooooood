
import React, { useState, useEffect, useCallback, useMemo, useReducer } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { departmentAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { Modal } from '../components/UI/Modal';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { Layers, Search, AlertCircle, Plus, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';

interface Department {
  _id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
}

interface FormState {
  name: string;
  code: string;
  description: string;
}

type FormAction =
  | { type: 'UPDATE_FIELD'; field: keyof FormState; value: any }
  | { type: 'RESET' };

const formReducer = (state: FormState, action: FormAction): FormState => {
  switch (action.type) {
    case 'UPDATE_FIELD':
      return { ...state, [action.field]: action.value };
    case 'RESET':
      return {
        name: '',
        code: '',
        description: '',
      };
    default:
      return state;
  }
};

const translations = {
  ar: {
    manage: 'إدارة الأقسام',
    add: 'إضافة قسم',
    addFirst: 'إضافة أول قسم',
    noDepartments: 'لا توجد أقسام',
    noMatch: 'لا توجد أقسام مطابقة',
    empty: 'لا توجد أقسام متاحة',
    searchPlaceholder: 'ابحث عن قسم بالاسم أو الكود...',
    code: 'الكود',
    description: 'الوصف',
    status: 'الحالة',
    active: 'نشط',
    inactive: 'غير نشط',
    edit: 'تعديل',
    delete: 'حذف',
    name: 'اسم القسم',
    nameRequired: 'اسم القسم مطلوب',
    codeRequired: 'كود القسم مطلوب',
    namePlaceholder: 'أدخل اسم القسم',
    codePlaceholder: 'أدخل كود القسم',
    descriptionPlaceholder: 'أدخل وصف القسم (اختياري)',
    update: 'تحديث القسم',
    requiredFields: 'يرجى ملء جميع الحقول المطلوبة',
    codeExists: 'الكود مستخدم بالفعل',
    unauthorized: 'غير مصرح لك بالوصول',
    fetchError: 'خطأ أثناء جلب البيانات',
    saveError: 'خطأ أثناء حفظ القسم',
    added: 'تم إضافة القسم بنجاح',
    updated: 'تم تحديث القسم بنجاح',
    deleteConfirm: 'هل أنت متأكد من حذف هذا القسم؟',
    deleteError: 'خطأ أثناء حذف القسم',
    deleted: 'تم حذف القسم بنجاح',
  },
  en: {
    manage: 'Manage Departments',
    add: 'Add Department',
    addFirst: 'Add First Department',
    noDepartments: 'No Departments Found',
    noMatch: 'No Matching Departments',
    empty: 'No Departments Available',
    searchPlaceholder: 'Search by department name or code...',
    code: 'Code',
    description: 'Description',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    edit: 'Edit',
    delete: 'Delete',
    name: 'Department Name',
    nameRequired: 'Department name is required',
    codeRequired: 'Department code is required',
    namePlaceholder: 'Enter department name',
    codePlaceholder: 'Enter department code',
    descriptionPlaceholder: 'Enter department description (optional)',
    update: 'Update Department',
    requiredFields: 'Please fill all required fields',
    codeExists: 'Code is already in use',
    unauthorized: 'You are not authorized to access',
    fetchError: 'Error fetching data',
    saveError: 'Error saving department',
    added: 'Department added successfully',
    updated: 'Department updated successfully',
    deleteConfirm: 'Are you sure you want to delete this department?',
    deleteError: 'Error deleting department',
    deleted: 'Department deleted successfully',
  },
};

export const Departments: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];

  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [formData, dispatchForm] = useReducer(formReducer, {
    name: '',
    code: '',
    description: '',
  });

  const fetchData = useCallback(async () => {
    if (!user || user.role !== 'admin') {
      setError(t.unauthorized);
      setLoading(false);
      toast.error(t.unauthorized, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    setLoading(true);
    try {
      const response = await departmentAPI.getAll({ page, limit: 12, search: searchTerm });
      const data = Array.isArray(response.data) ? response.data : response;
      setDepartments(data);
      setTotalPages(response.totalPages || Math.ceil(data.length / 12));
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Fetch error:`, err);
      setError(err.response?.data?.message || t.fetchError);
      toast.error(t.fetchError, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setLoading(false);
    }
  }, [user, page, searchTerm, t, isRtl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredDepartments = useMemo(() => {
    return departments.filter(
      (department) =>
        department &&
        (department.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          department.code?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [departments, searchTerm]);

  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = t.nameRequired;
    if (!formData.code.trim()) errors.code = t.codeRequired;
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, t]);

  const openAddModal = useCallback(() => {
    dispatchForm({ type: 'RESET' });
    setIsEditMode(false);
    setSelectedDepartment(null);
    setIsModalOpen(true);
    setFormErrors({});
    setError('');
  }, []);

  const openEditModal = useCallback((department: Department, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatchForm({ type: 'RESET' });
    dispatchForm({ type: 'UPDATE_FIELD', field: 'name', value: department.name });
    dispatchForm({ type: 'UPDATE_FIELD', field: 'code', value: department.code });
    dispatchForm({ type: 'UPDATE_FIELD', field: 'description', value: department.description || '' });
    setIsEditMode(true);
    setSelectedDepartment(department);
    setIsModalOpen(true);
    setFormErrors({});
    setError('');
  }, []);

  const openDeleteModal = useCallback((department: Department, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDepartment(department);
    setIsDeleteModalOpen(true);
    setError('');
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validateForm()) {
        toast.error(t.requiredFields, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      try {
        const departmentData = {
          name: formData.name.trim(),
          code: formData.code.trim(),
          description: formData.description.trim() || undefined,
        };
        if (isEditMode && selectedDepartment) {
          const updatedDepartment = await departmentAPI.update(selectedDepartment._id, departmentData);
          setDepartments(departments.map((d) => (d._id === selectedDepartment._id ? updatedDepartment : d)));
          toast.success(t.updated, { position: isRtl ? 'top-right' : 'top-left' });
        } else {
          const newDepartment = await departmentAPI.create(departmentData);
          setDepartments([...departments, newDepartment]);
          toast.success(t.added, { position: isRtl ? 'top-right' : 'top-left' });
        }
        setIsModalOpen(false);
        setError('');
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Submit error:`, err);
        const errorMessage = err.response?.data?.message === 'Code already exists' ? t.codeExists : t.saveError;
        setError(errorMessage);
        toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
      }
    },
    [formData, isEditMode, selectedDepartment, departments, t, isRtl]
  );

  const handleDelete = useCallback(async () => {
    if (!selectedDepartment) return;
    try {
      await departmentAPI.delete(selectedDepartment._id);
      setDepartments(departments.filter((d) => d._id !== selectedDepartment._id));
      toast.success(t.deleted, { position: isRtl ? 'top-right' : 'top-left' });
      setIsDeleteModalOpen(false);
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Delete error:`, err);
      const errorMessage = err.response?.data?.message || t.deleteError;
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    }
  }, [selectedDepartment, departments, t, isRtl]);

  const handleCardClick = useCallback((departmentId: string) => {
    navigate(`/departments/${departmentId}`);
  }, [navigate]);

  const renderPagination = useMemo(() => {
    const pages = [];
    const maxPagesToShow = 5;
    const startPage = Math.max(1, page - Math.floor(maxPagesToShow / 2));
    const endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <Button
          key={i}
          variant={page === i ? 'primary' : 'outline'}
          onClick={() => setPage(i)}
          className={`w-10 h-10 text-sm font-medium rounded-full ${page === i ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'} transition-colors`}
        >
          {i}
        </Button>
      );
    }

    return (
      <div className="flex justify-center items-center mt-6 gap-2">
        <Button
          variant="outline"
          onClick={() => setPage((p) => Math.max(p - 1, 1))}
          disabled={page === 1}
          className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 disabled:opacity-50 transition-colors"
        >
          &larr;
        </Button>
        {pages}
        <Button
          variant="outline"
          onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
          disabled={page === totalPages}
          className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 disabled:opacity-50 transition-colors"
        >
          &rarr;
        </Button>
      </div>
    );
  }, [page, totalPages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className={`mx-auto max-w-7xl p-4 sm:p-6 min-h-screen bg-gray-100 ${isRtl ? 'rtl font-arabic' : 'ltr font-sans'}`}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4"
      >
        <h1 className="text-2xl sm:text-3xl font-bold text-amber-900 flex items-center justify-center sm:justify-start gap-2">
          <Layers className="w-6 h-6 text-amber-600" />
          {t.manage}
        </h1>
        {user?.role === 'admin' && (
          <Button
            variant="primary"
            icon={Plus}
            onClick={openAddModal}
            className="text-sm px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-full shadow-md transition-transform transform hover:scale-105"
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
            className="mb-6 p-3 bg-red-100 border border-red-300 rounded-lg flex items-center gap-2 shadow-sm"
          >
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-red-600 text-sm font-medium">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
      <Card className="p-4 mb-6 bg-white rounded-lg shadow-md">
        <div className="relative">
          <Search
            className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 text-amber-500 w-5 h-5`}
          />
          <Input
            value={searchTerm}
            onChange={(value) => setSearchTerm(value)}
            placeholder={t.searchPlaceholder}
            className={`w-full pl-10 pr-4 py-2 text-sm border border-amber-300 rounded-full focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors bg-amber-50 ${isRtl ? 'text-right' : 'text-left'}`}
            aria-label={t.searchPlaceholder}
          />
        </div>
      </Card>
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ staggerChildren: 0.1 }}
      >
        {filteredDepartments.length === 0 ? (
          <Card className="p-6 text-center bg-white rounded-lg shadow-md col-span-full">
            <Layers className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-amber-900">{t.noDepartments}</h3>
            <p className="text-sm text-gray-600 mt-1">
              {searchTerm ? t.noMatch : t.empty}
            </p>
            {user?.role === 'admin' && !searchTerm && (
              <Button
                variant="primary"
                icon={Plus}
                onClick={openAddModal}
                className="mt-4 text-sm px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-full shadow-md transition-transform transform hover:scale-105"
              >
                {t.addFirst}
              </Button>
            )}
          </Card>
        ) : (
          filteredDepartments.map((department) => (
            <motion.div
              key={department._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card
                className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer overflow-hidden"
                onClick={() => handleCardClick(department._id)}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-semibold text-amber-900 truncate max-w-[80%]">
                      {department.name}
                    </h3>
                    <Layers className="w-5 h-5 text-amber-600" />
                  </div>
                  <p className="text-xs text-gray-600 truncate">{t.code}: {department.code}</p>
                  {department.description && (
                    <p className="text-xs text-gray-600 truncate">{t.description}: {department.description}</p>
                  )}
                  <p className={`text-xs font-medium ${department.isActive ? 'text-green-600' : 'text-red-600'}`}>
                    {t.status}: {department.isActive ? t.active : t.inactive}
                  </p>
                  {user?.role === 'admin' && (
                    <div className="flex gap-2 mt-3 justify-end">
                      <Button
                        variant="outline"
                        icon={Edit2}
                        onClick={(e) => openEditModal(department, e)}
                        className="text-xs p-1.5 w-8 h-8 rounded-full text-amber-600 hover:text-amber-800 border-amber-600 hover:bg-amber-50"
                        aria-label={t.edit}
                      />
                      <Button
                        variant="outline"
                        icon={Trash2}
                        onClick={(e) => openDeleteModal(department, e)}
                        className="text-xs p-1.5 w-8 h-8 rounded-full text-red-500 hover:text-red-700 border-red-500 hover:bg-red-50"
                        aria-label={t.delete}
                      />
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </motion.div>
      {filteredDepartments.length > 0 && renderPagination}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditMode ? t.edit : t.add}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 gap-4"
          >
            <Input
              label={t.name}
              value={formData.name}
              onChange={(value) => dispatchForm({ type: 'UPDATE_FIELD', field: 'name', value })}
              placeholder={t.namePlaceholder}
              required
              error={formErrors.name}
              className="text-sm border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
            />
            <Input
              label={t.code}
              value={formData.code}
              onChange={(value) => dispatchForm({ type: 'UPDATE_FIELD', field: 'code', value })}
              placeholder={t.codePlaceholder}
              required
              error={formErrors.code}
              className="text-sm border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
            />
            <div>
              <label className="block text-sm font-medium text-amber-900 mb-1">{t.description}</label>
              <textarea
                value={formData.description}
                onChange={(e) => dispatchForm({ type: 'UPDATE_FIELD', field: 'description', value: e.target.value })}
                placeholder={t.descriptionPlaceholder}
                className="w-full px-3 py-2 text-sm border border-amber-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-amber-50 transition-colors"
                rows={3}
              />
            </div>
          </motion.div>
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 bg-red-100 border border-red-300 rounded-lg flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-red-600 text-sm font-medium">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex gap-3 mt-6">
            <Button
              type="submit"
              variant="primary"
              className="flex-1 text-sm px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-md transition-transform transform hover:scale-105"
            >
              {isEditMode ? t.update : t.add}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 text-sm px-4 py-2 bg-gray-200 hover:bg-gray-300 text-amber-900 rounded-lg shadow-md transition-transform transform hover:scale-105"
            >
              {t.cancel}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={t.deleteConfirm}
        size="sm"
      >
        <div className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <p className="text-sm text-gray-600">{t.deleteConfirm}</p>
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 bg-red-100 border border-red-300 rounded-lg flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-red-600 text-sm font-medium">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex gap-3 mt-4">
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              className="flex-1 text-sm px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md transition-transform transform hover:scale-105"
            >
              {t.delete}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsDeleteModalOpen(false)}
              className="flex-1 text-sm px-4 py-2 bg-gray-200 hover:bg-gray-300 text-amber-900 rounded-lg shadow-md transition-transform transform hover:scale-105"
            >
              {t.cancel}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Departments;
