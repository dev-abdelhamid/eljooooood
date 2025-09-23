import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { departmentAPI, usersAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Modal } from '../components/UI/Modal';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { Layers, Plus, Edit2, Trash2, Search, AlertCircle } from 'lucide-react';

interface Department {
  _id: string;
  name: string;
  nameEn?: string;
  code: string;
  description?: string;
  chef?: { _id: string; name: string };
  isActive: boolean;
  displayName: string;
}

interface User {
  _id: string;
  name: string;
  role: string;
}

export function Departments() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [chefs, setChefs] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    code: '',
    description: '',
    chef: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !['admin'].includes(user.role)) {
        setError(t('departments.unauthorized'));
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        console.log('Fetching departments with params:', { page: currentPage, limit: 12, search: searchTerm });
        console.log('API URL:', import.meta.env.VITE_API_URL);
        const [departmentsResponse, chefsResponse] = await Promise.all([
          departmentAPI.getAll({ page: currentPage, limit: 12, search: searchTerm }).catch((err) => {
            console.error('Departments API error:', err);
            throw err;
          }),
          usersAPI.getAll().catch((err) => {
            console.error('Users API error:', err);
            throw err;
          }),
        ]);
        console.log('Departments response:', departmentsResponse);
        console.log('Chefs response:', chefsResponse);

        const departmentsWithDisplayName = departmentsResponse.data.map((dept: Department) => ({
          ...dept,
          displayName: language === 'ar' ? dept.name : (dept.nameEn || dept.name),
        }));
        setDepartments(departmentsWithDisplayName);
        setTotalPages(departmentsResponse.totalPages);
        setChefs(chefsResponse.filter((user: User) => user.role === 'chef'));
        setError('');
      } catch (err: any) {
        console.error('Fetch error:', err);
        console.error('Error details:', {
          status: err.status,
          message: err.message,
          url: err.config?.url,
        });
        setError(err.message || t('departments.fetchError'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [t, user, searchTerm, currentPage]);

  const filteredDepartments = departments.filter(
    (department) =>
      department.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      department.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openModal = (department?: Department) => {
    if (!user || !['admin'].includes(user.role)) {
      setError(t('departments.unauthorized'));
      return;
    }
    if (department) {
      setEditingDepartment(department);
      setFormData({
        name: department.name,
        nameEn: department.nameEn || '',
        code: department.code,
        description: department.description || '',
        chef: department.chef?._id || '',
      });
    } else {
      setEditingDepartment(null);
      setFormData({
        name: '',
        nameEn: '',
        code: '',
        description: '',
        chef: '',
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
        name: formData.name,
        nameEn: formData.nameEn || undefined,
        code: formData.code,
        description: formData.description || undefined,
        chef: formData.chef || undefined,
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
      } else {
        const newDepartment = await departmentAPI.create(departmentData);
        setDepartments([
          ...departments,
          { ...newDepartment, displayName: language === 'ar' ? newDepartment.name : (newDepartment.nameEn || newDepartment.name) },
        ]);
      }
      closeModal();
    } catch (err: any) {
      console.error('Submit error:', err);
      setError(err.message || t('departments.saveError'));
    }
  };

  const deleteDepartment = async (id: string) => {
    if (!user || !['admin'].includes(user.role)) {
      setError(t('departments.unauthorized'));
      return;
    }
    if (confirm(t('departments.deleteConfirm'))) {
      try {
        await departmentAPI.delete(id);
        setDepartments(departments.filter((d) => d._id !== id));
      } catch (err: any) {
        console.error('Delete error:', err);
        setError(err.message || t('departments.deleteError'));
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
    <div className="container mx-auto px-4 py-6 min-h-screen bg-gray-50" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
          <Layers className="w-6 h-6 text-blue-500" />
          {t('departments.manage')}
        </h1>
        {user?.role === 'admin' && (
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => openModal()}
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-4 py-2"
          >
            {t('departments.add')}
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
            onChange={setSearchTerm}
            placeholder={t('departments.searchPlaceholder')}
            className="pl-10 border-gray-300 rounded-md focus:ring-blue-500"
            aria-label={t('departments.searchPlaceholder')}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDepartments.length === 0 ? (
          <Card className="p-6 text-center bg-white rounded-md shadow-sm">
            <Layers className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-800">{t('departments.noDepartments')}</h3>
            <p className="text-gray-500">{searchTerm ? t('departments.noMatch') : t('departments.empty')}</p>
            {user?.role === 'admin' && !searchTerm && (
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => openModal()}
                className="mt-4 bg-blue-500 hover:bg-blue-600 text-white rounded-md px-4 py-2"
              >
                {t('departments.addFirst')}
              </Button>
            )}
          </Card>
        ) : (
          filteredDepartments.map((department) => (
            <Card key={department._id} className="bg-white rounded-md shadow-sm hover:shadow-md transition-shadow">
              <div className="p-4">
                <h3 className="font-medium text-gray-800">{department.displayName}</h3>
                <p className="text-sm text-gray-500">{t('departments.code')}: {department.code}</p>
                {department.description && <p className="text-xs text-gray-400 mt-1">{department.description}</p>}
                <p className="text-sm text-gray-500">{t('departments.chef')}: {department.chef?.name || '-'}</p>
                <p className="text-sm text-blue-500">
                  {t('departments.status')}: {department.isActive ? t('departments.active') : t('departments.inactive')}
                </p>
                {user?.role === 'admin' && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => openModal(department)}
                      className="text-blue-500 hover:text-blue-700"
                      title={t('departments.edit')}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteDepartment(department._id)}
                      className="text-red-500 hover:text-red-700"
                      title={t('departments.delete')}
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

      <div className="flex justify-center mt-6">
        <Button
          variant="secondary"
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="mx-2"
        >
          {t('previous')}
        </Button>
        <span className="mx-4 self-center">{t('page')} {currentPage} / {totalPages}</span>
        <Button
          variant="secondary"
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="mx-2"
        >
          {t('next')}
        </Button>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingDepartment ? t('departments.edit') : t('departments.add')}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <Input
              label={t('departments.name')}
              value={formData.name}
              onChange={(value) => setFormData({ ...formData, name: value })}
              placeholder={t('departments.namePlaceholder')}
              required
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <Input
              label={t('departments.nameEn')}
              value={formData.nameEn}
              onChange={(value) => setFormData({ ...formData, nameEn: value })}
              placeholder={t('departments.nameEnPlaceholder')}
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <Input
              label={t('departments.code')}
              value={formData.code}
              onChange={(value) => setFormData({ ...formData, code: value })}
              placeholder={t('departments.codePlaceholder')}
              required
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <Select
              label={t('departments.chef')}
              options={[{ value: '', label: t('departments.selectChef') }, ...chefs.map((c) => ({ value: c._id, label: c.name }))]}
              value={formData.chef}
              onChange={(value) => setFormData({ ...formData, chef: value })}
              className="border-gray-300 rounded-md focus:ring-blue-500"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('departments.description')}</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('departments.descriptionPlaceholder')}
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
              {editingDepartment ? t('departments.update') : t('departments.add')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={closeModal}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md px-4 py-2"
            >
              {t('cancel')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}