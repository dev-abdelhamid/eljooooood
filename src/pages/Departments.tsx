import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { departmentAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { Modal } from '../components/UI/Modal';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { Layers, Plus, Edit2, Trash2, Search, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';

interface Department {
  id: string;
  name: string;
  nameEn?: string;
  code: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
    namePlaceholder: 'أدخل اسم القسم',
    nameEnPlaceholder: 'أدخل اسم القسم بالإنجليزية',
    codePlaceholder: 'أدخل كود القسم',
    descriptionPlaceholder: 'أدخل الوصف',
    edit: 'تعديل القسم',
    update: 'تحديث',
    saveError: 'خطأ في حفظ القسم',
    delete: 'حذف',
    deleteConfirm: 'هل أنت متأكد من حذف هذا القسم؟',
    deleteError: 'خطأ في الحذف: لا يمكن حذف قسم مرتبط بمنتجات أو شيفات نشطة',
    deleted: 'تم الحذف بنجاح',
    unauthorized: 'غير مصرح لك',
    fetchError: 'خطأ في جلب البيانات',
    active: 'نشط',
    inactive: 'غير نشط',
    status: 'الحالة',
    createdAt: 'تاريخ الإنشاء',
    updatedAt: 'تاريخ التحديث',
    cancel: 'إلغاء',
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
    namePlaceholder: 'Enter department name',
    nameEnPlaceholder: 'Enter department name in English',
    codePlaceholder: 'Enter department code',
    descriptionPlaceholder: 'Enter description',
    edit: 'Edit Department',
    update: 'Update',
    saveError: 'Error saving department',
    delete: 'Delete',
    deleteConfirm: 'Are you sure you want to delete this department?',
    deleteError: 'Error deleting: Cannot delete department linked to active products or chefs',
    deleted: 'Deleted successfully',
    unauthorized: 'Unauthorized access',
    fetchError: 'Error fetching data',
    active: 'Active',
    inactive: 'Inactive',
    status: 'Status',
    createdAt: 'Created At',
    updatedAt: 'Updated At',
    cancel: 'Cancel',
  },
};

export function Departments() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    code: '',
    description: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !['admin'].includes(user.role)) {
        setError(t.unauthorized);
        toast.error(t.unauthorized, { position: isRtl ? 'top-right' : 'top-left' });
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        console.log(`[${new Date().toISOString()}] Fetching departments with params:`, { searchTerm, isRtl });
        const departmentsResponse = await departmentAPI.getAll({ isRtl });
        console.log(`[${new Date().toISOString()}] Departments response:`, departmentsResponse);
        const data = Array.isArray(departmentsResponse.data) ? departmentsResponse.data : departmentsResponse.data || [];
        setDepartments(data.map((dept: any) => ({
          id: dept._id,
          name: dept.name,
          nameEn: dept.nameEn,
          code: dept.code,
          description: dept.description,
          isActive: dept.isActive,
          createdAt: dept.createdAt,
          updatedAt: dept.updatedAt,
          displayName: dept.displayName || (isRtl ? dept.name : dept.nameEn || dept.name),
        })));
        setError('');
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Fetch error:`, err);
        console.error('Error details:', {
          status: err.status,
          message: err.message,
          url: err.config?.url,
        });
        setError(err.message || t.fetchError);
        toast.error(err.message || t.fetchError, { position: isRtl ? 'top-right' : 'top-left' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [t, user, isRtl]);

  const filteredDepartments = departments.filter(
    (department) =>
      department.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      department.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openModal = (department?: Department) => {
    if (!user || !['admin'].includes(user.role)) {
      setError(t.unauthorized);
      toast.error(t.unauthorized, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    if (department) {
      setEditingDepartment(department);
      setFormData({
        name: department.name,
        nameEn: department.nameEn || '',
        code: department.code,
        description: department.description || '',
      });
    } else {
      setEditingDepartment(null);
      setFormData({
        name: '',
        nameEn: '',
        code: '',
        description: '',
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDepartment(null);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const departmentData = {
        name: formData.name.trim(),
        nameEn: formData.nameEn.trim() || undefined,
        code: formData.code.trim(),
        description: formData.description.trim() || undefined,
      };
      console.log(`[${new Date().toISOString()}] Submitting department:`, departmentData);
      if (editingDepartment) {
        const updatedDepartment = await departmentAPI.update(editingDepartment.id, departmentData);
        setDepartments(
          departments.map((d) => (d.id === editingDepartment.id ? {
            ...d,
            ...updatedDepartment,
            id: updatedDepartment._id,
            createdAt: updatedDepartment.createdAt,
            updatedAt: updatedDepartment.updatedAt,
            displayName: updatedDepartment.displayName || (isRtl ? updatedDepartment.name : updatedDepartment.nameEn || updatedDepartment.name),
          } : d))
        );
        toast.success(t.update, { position: isRtl ? 'top-right' : 'top-left' });
      } else {
        const newDepartment = await departmentAPI.create(departmentData);
        setDepartments([...departments, {
          ...newDepartment,
          id: newDepartment._id,
          createdAt: newDepartment.createdAt,
          updatedAt: newDepartment.updatedAt,
          displayName: newDepartment.displayName || (isRtl ? newDepartment.name : newDepartment.nameEn || newDepartment.name),
        }]);
        toast.success(t.add, { position: isRtl ? 'top-right' : 'top-left' });
      }
      closeModal();
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Submit error:`, err);
      setError(err.message || t.saveError);
      toast.error(err.message || t.saveError, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  const deleteDepartment = async (id: string) => {
    if (!user || !['admin'].includes(user.role)) {
      setError(t.unauthorized);
      toast.error(t.unauthorized, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    if (confirm(t.deleteConfirm)) {
      try {
        await departmentAPI.delete(id);
        setDepartments(departments.filter((d) => d.id !== id));
        toast.success(t.deleted, { position: isRtl ? 'top-right' : 'top-left' });
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Delete error:`, err);
        setError(err.message || t.deleteError);
        toast.error(err.message || t.deleteError, { position: isRtl ? 'top-right' : 'top-left' });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 min-h-screen bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
          <Layers className="w-6 h-6 text-blue-500" />
          {t.manage}
        </h1>
        {user?.role === 'admin' && (
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => openModal()}
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-4 py-2"
          >
            {t.add}
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-md flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600">{error}</span>
        </div>
      )}

      <Card className="p-4 mb-6 bg-white rounded-md shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            value={searchTerm}
            onChange={(value) => setSearchTerm(value)}
            placeholder={t.searchPlaceholder}
            className="pl-10 border-gray-300 rounded-md focus:ring-blue-500"
            aria-label={t.searchPlaceholder}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDepartments.length === 0 ? (
          <Card className="p-6 text-center bg-white rounded-md shadow-sm">
            <Layers className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-800">{t.noDepartments}</h3>
            <p className="text-gray-500">{searchTerm ? t.noMatch : t.empty}</p>
            {user?.role === 'admin' && !searchTerm && (
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => openModal()}
                className="mt-4 bg-blue-500 hover:bg-blue-600 text-white rounded-md px-4 py-2"
              >
                {t.addFirst}
              </Button>
            )}
          </Card>
        ) : (
          filteredDepartments.map((department) => (
            <Card key={department.id} className="bg-white rounded-md shadow-sm hover:shadow-md transition-shadow">
              <div className="p-4">
                <h3 className="font-medium text-gray-800">{department.displayName}</h3>
                <p className="text-sm text-gray-500">{t.code}: {department.code}</p>
                {department.description && <p className="text-xs text-gray-400 mt-1">{department.description}</p>}
                <p className="text-sm text-blue-500">
                  {t.status}: {department.isActive ? t.active : t.inactive}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {t.createdAt}: {new Date(department.createdAt).toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {t.updatedAt}: {new Date(department.updatedAt).toLocaleString()}
                </p>
                {user?.role === 'admin' && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => openModal(department)}
                      className="text-blue-500 hover:text-blue-700"
                      title={t.edit}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteDepartment(department.id)}
                      className="text-red-500 hover:text-red-700"
                      title={t.delete}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingDepartment ? t.edit : t.add}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="grid grid-cols-1 gap-4">
            <Input
              label={t.name}
              value={formData.name}
              onChange={(value) => setFormData({ ...formData, name: value })}
              placeholder={t.namePlaceholder}
              required
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <Input
              label={t.nameEn}
              value={formData.nameEn}
              onChange={(value) => setFormData({ ...formData, nameEn: value })}
              placeholder={t.nameEnPlaceholder}
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <Input
              label={t.code}
              value={formData.code}
              onChange={(value) => setFormData({ ...formData, code: value })}
              placeholder={t.codePlaceholder}
              required
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.description}</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t.descriptionPlaceholder}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                rows={3}
              />
            </div>
          </div>
          {error && (
            <div className="p-2 bg-red-100 border border-red-300 rounded-md flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-red-600">{error}</span>
            </div>
          )}
          <div className="flex gap-3">
            <Button type="submit" variant="primary" className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-4 py-2">
              {editingDepartment ? t.update : t.add}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={closeModal}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md px-4 py-2"
            >
              {t.cancel}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}