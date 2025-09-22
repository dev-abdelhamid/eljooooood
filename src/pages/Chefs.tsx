import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { chefsAPI, departmentAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Modal } from '../components/UI/Modal';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { ChefHat, Search, AlertCircle, Plus } from 'lucide-react';

interface Chef {
  _id: string;
  user: {
    _id: string;
    name: string;
    username: string;
    email: string;
    phone: string;
  } | null;
  department: { _id: string; name: string } | null;
}

interface Department {
  _id: string;
  name: string;
}

export function Chefs() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    department: '',
    password: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !['admin'].includes(user.role)) {
        setError(t('chefs.unauthorized'));
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        console.log('API URL:', import.meta.env.VITE_API_URL);
        const [chefsResponse, departmentsResponse] = await Promise.all([
          chefsAPI.getAll().catch((err) => {
            console.error('Chefs API error:', err.response?.data || err);
            throw err;
          }),
          departmentAPI.getAll().catch((err) => {
            console.error('Departments API error:', err.response?.data || err);
            throw err;
          }),
        ]);
        console.log('Chefs response:', JSON.stringify(chefsResponse, null, 2));
        console.log('Departments response:', JSON.stringify(departmentsResponse, null, 2));
        
        setChefs(Array.isArray(chefsResponse) ? chefsResponse.map(chef => ({
          ...chef,
          department: chef.department ? { _id: chef.department._id, name: chef.department.name } : null,
        })) : []);
        setDepartments(Array.isArray(departmentsResponse) ? departmentsResponse : []);
        if (!departmentsResponse.length) {
          setError(t('chefs.noDepartments') || 'No departments available');
        }
        setError('');
      } catch (err: any) {
        console.error('Fetch error:', err);
        setError(err.response?.data?.message || t('chefs.fetchError'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [t, user]);

  const filteredChefs = chefs.filter(
    (chef) =>
      chef.user && (
        chef.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chef.user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chef.user.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  const openModal = () => {
    if (departments.length === 0) {
      setError(t('chefs.noDepartments') || 'Cannot add chef: No departments available');
      return;
    }
    setFormData({
      name: '',
      username: '',
      email: '',
      phone: '',
      department: departments[0]?._id || '',
      password: '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.department) {
      setError(t('chefs.departmentRequired') || 'Department is required');
      return;
    }
    try {
      const chefData = {
        user: {
          name: formData.name,
          username: formData.username,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          role: 'chef',
        },
        department: formData.department,
      };
      console.log('Submitting chef:', JSON.stringify(chefData, null, 2));
      const newChef = await chefsAPI.create(chefData);
      setChefs([...chefs, {
        ...newChef,
        department: departments.find(d => d._id === formData.department) || null,
      }]);
      setIsModalOpen(false);
      setError('');
    } catch (err: any) {
      console.error('Create chef error:', err.response?.data || err);
      setError(err.response?.data?.message || t('chefs.createError'));
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
          <ChefHat className="w-6 h-6 text-blue-500" />
          {t('chefs.manage')}
        </h1>
        {user?.role === 'admin' && (
          <Button
            variant="primary"
            icon={Plus}
            onClick={openModal}
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-4 py-2"
          >
            {t('chefs.add')}
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
            placeholder={t('chefs.searchPlaceholder')}
            className="pl-10 border-gray-300 rounded-md focus:ring-blue-500"
            aria-label={t('chefs.searchPlaceholder')}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredChefs.length === 0 ? (
          <Card className="p-6 text-center bg-white rounded-md shadow-sm">
            <ChefHat className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-800">{t('chefs.noChefs')}</h3>
            <p className="text-gray-500">{searchTerm ? t('chefs.noMatch') : t('chefs.empty')}</p>
          </Card>
        ) : (
          filteredChefs.map((chef) => (
            <Card key={chef._id} className="bg-white rounded-md shadow-sm hover:shadow-md transition-shadow">
              <div className="p-4">
                {chef.user ? (
                  <>
                    <h3 className="font-medium text-gray-800">{chef.user.name}</h3>
                    <p className="text-sm text-gray-500">{t('chefs.username')}: {chef.user.username}</p>
                    <p className="text-sm text-gray-500">{t('chefs.email')}: {chef.user.email}</p>
                    <p className="text-sm text-gray-500">{t('chefs.phone')}: {chef.user.phone}</p>
                  </>
                ) : (
                  <p className="text-sm text-red-500">{t('chefs.invalidUser')}</p>
                )}
                <p className="text-sm text-blue-500">
                  {t('chefs.department')}: {chef.department?.name || t('chefs.noDepartment')}
                </p>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('chefs.add')}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t('chefs.name')}
            value={formData.name}
            onChange={(value) => setFormData({ ...formData, name: value })}
            placeholder={t('chefs.namePlaceholder')}
            required
            className="border-gray-300 rounded-md focus:ring-blue-500"
          />
          <Input
            label={t('chefs.username')}
            value={formData.username}
            onChange={(value) => setFormData({ ...formData, username: value })}
            placeholder={t('chefs.usernamePlaceholder')}
            required
            className="border-gray-300 rounded-md focus:ring-blue-500"
          />
          <Input
            label={t('chefs.email')}
            type="email"
            value={formData.email}
            onChange={(value) => setFormData({ ...formData, email: value })}
            placeholder={t('chefs.emailPlaceholder')}
            required
            className="border-gray-300 rounded-md focus:ring-blue-500"
          />
          <Input
            label={t('chefs.phone')}
            value={formData.phone}
            onChange={(value) => setFormData({ ...formData, phone: value })}
            placeholder={t('chefs.phonePlaceholder')}
            className="border-gray-300 rounded-md focus:ring-blue-500"
          />
          <Select
            label={t('chefs.department')}
            options={departments.length ? [
              { value: '', label: t('chefs.selectDepartment') },
              ...departments.map((d) => ({ value: d._id, label: d.name }))
            ] : [{ value: '', label: t('chefs.noDepartments') }]}
            value={formData.department}
            onChange={(value) => setFormData({ ...formData, department: value })}
            required
            className="border-gray-300 rounded-md focus:ring-blue-500"
          />
          <Input
            label={t('chefs.password')}
            type="password"
            value={formData.password}
            onChange={(value) => setFormData({ ...formData, password: value })}
            placeholder={t('chefs.passwordPlaceholder')}
            required
            className="border-gray-300 rounded-md focus:ring-blue-500"
          />
          {error && (
            <div className="p-2 bg-red-100 border border-red-300 rounded-md flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-red-600">{error}</span>
            </div>
          )}
          <div className="flex gap-3">
            <Button type="submit" variant="primary" className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-4 py-2">
              {t('chefs.add')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
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