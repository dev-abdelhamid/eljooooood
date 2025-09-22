import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { branchesAPI } from '../services/api';
import { Card, Button, Input, Select, Modal, LoadingSpinner } from '../components/UI';
import { Search, AlertCircle, Plus, Edit2, Trash2, ChevronDown, Key } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';

interface Branch {
  _id: string;
  name: string;
  nameEn?: string;
  displayName: string;
  code: string;
  address: string;
  city: string;
  phone?: string;
  user?: {
    _id: string;
    name: string;
    nameEn?: string;
    displayName: string;
    username: string;
    email?: string;
    phone?: string;
    isActive: boolean;
  };
  createdBy: { _id: string; name: string; nameEn?: string; displayName: string; username: string };
  isActive: boolean;
}

export function Branches() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isRtl = i18n.language === 'ar';
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [resetPasswordData, setResetPasswordData] = useState({ password: '', confirmPassword: '' });

  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    code: '',
    address: '',
    city: '',
    phone: '',
    user: {
      name: '',
      nameEn: '',
      username: '',
      email: '',
      phone: '',
      isActive: true,
      password: '',
    },
  });

  const fetchData = useCallback(async (signal: AbortSignal) => {
    if (!user || user.role !== 'admin') {
      setError(t('branches.unauthorized'));
      setLoading(false);
      toast.error(t('branches.unauthorized'), { position: isRtl ? 'top-left' : 'top-right' });
      return;
    }

    setLoading(true);
    try {
      const response = await branchesAPI.getAll({ signal });
      setBranches(Array.isArray(response) ? response : []);
      setError('');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Fetch aborted');
        return;
      }
      console.error(`[${new Date().toISOString()}] Fetch error:`, err);
      setError(err.response?.data?.message || t('branches.fetchError'));
      toast.error(t('branches.fetchError'), { position: isRtl ? 'top-left' : 'top-right' });
    } finally {
      setLoading(false);
    }
  }, [t, user, isRtl]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const handleAddEditBranch = async () => {
    if (!formData.name || !formData.code || !formData.address || !formData.city || !formData.user.name || !formData.user.username || (!isEditMode && !formData.user.password)) {
      toast.error(t('branches.requiredFields'), { position: isRtl ? 'top-left' : 'top-right' });
      return;
    }

    if (!isEditMode && formData.user.password !== formData.user.confirmPassword) {
      toast.error(t('branches.passwordMismatch'), { position: isRtl ? 'top-left' : 'top-right' });
      return;
    }

    try {
      const branchData = {
        name: formData.name,
        nameEn: formData.nameEn || undefined,
        code: formData.code,
        address: formData.address,
        city: formData.city,
        phone: formData.phone || undefined,
        user: {
          name: formData.user.name,
          nameEn: formData.user.nameEn || undefined,
          username: formData.user.username,
          email: formData.user.email || undefined,
          phone: formData.user.phone || undefined,
          isActive: formData.user.isActive,
          password: formData.user.password || undefined,
        },
      };

      if (isEditMode && selectedBranchId) {
        await branchesAPI.update(selectedBranchId, branchData);
        toast.success(t('branches.updated'), { position: isRtl ? 'top-left' : 'top-right' });
      } else {
        await branchesAPI.create(branchData);
        toast.success(t('branches.added'), { position: isRtl ? 'top-left' : 'top-right' });
      }

      setIsModalOpen(false);
      setFormData({
        name: '',
        nameEn: '',
        code: '',
        address: '',
        city: '',
        phone: '',
        user: { name: '', nameEn: '', username: '', email: '', phone: '', isActive: true, password: '' },
      });
      fetchData(new AbortController().signal);
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Add/Edit branch error:`, err);
      toast.error(err.response?.data?.message || t(isEditMode ? 'branches.updateError' : 'branches.createError'), {
        position: isRtl ? 'top-left' : 'top-right',
      });
    }
  };

  const handleDeleteBranch = async (id: string) => {
    if (!window.confirm(t('branches.confirmDelete'))) return;

    try {
      await branchesAPI.delete(id);
      toast.success(t('branches.deleted'), { position: isRtl ? 'top-left' : 'top-right' });
      fetchData(new AbortController().signal);
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Delete branch error:`, err);
      toast.error(err.response?.data?.message || t('branches.deleteError'), {
        position: isRtl ? 'top-left' : 'top-right',
      });
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordData.password || resetPasswordData.password !== resetPasswordData.confirmPassword) {
      toast.error(t('branches.passwordMismatch'), { position: isRtl ? 'top-left' : 'top-right' });
      return;
    }

    try {
      await branchesAPI.resetPassword(selectedBranchId!, { password: resetPasswordData.password });
      toast.success(t('branches.passwordResetSuccess'), { position: isRtl ? 'top-left' : 'top-right' });
      setIsResetPasswordModalOpen(false);
      setResetPasswordData({ password: '', confirmPassword: '' });
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Reset password error:`, err);
      toast.error(err.response?.data?.message || t('branches.passwordResetError'), {
        position: isRtl ? 'top-left' : 'top-right',
      });
    }
  };

  const filteredBranches = branches.filter(
    (branch) =>
      (branch.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.user?.displayName.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filterStatus === 'all' || (filterStatus === 'active' && branch.isActive) || (filterStatus === 'inactive' && !branch.isActive))
  );

  return (
    <motion.div className="p-6 bg-gray-100 min-h-screen" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t('branches.title')}</h1>
        <Button
          onClick={() => {
            setIsModalOpen(true);
            setIsEditMode(false);
            setFormData({
              name: '',
              nameEn: '',
              code: '',
              address: '',
              city: '',
              phone: '',
              user: { name: '', nameEn: '', username: '', email: '', phone: '', isActive: true, password: '' },
            });
          }}
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          <Plus className="w-5 h-5 mr-2" /> {t('branches.add')}
        </Button>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute top-3 left-3 w-5 h-5 text-gray-400" />
          <Input
            placeholder={t('branches.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setIsFilterOpen(!isFilterOpen)} className="bg-gray-200 hover:bg-gray-300">
          {t('branches.filters')} <ChevronDown className="w-5 h-5 ml-2" />
        </Button>
      </div>

      <AnimatePresence>
        {isFilterOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-4"
          >
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              options={[
                { value: 'all', label: t('branches.allStatuses') },
                { value: 'active', label: t('branches.active') },
                { value: 'inactive', label: t('branches.inactive') },
              ]}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {loading && <LoadingSpinner size="lg" />}
      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded mb-4 flex items-center">
          <AlertCircle className="w-5 h-5 mr-2" /> {error}
        </div>
      )}

      {filteredBranches.length === 0 && !loading && (
        <div className="text-center py-10">
          <p className="text-gray-500">{t('branches.empty')}</p>
          <Button
            onClick={() => setIsModalOpen(true)}
            className="mt-4 bg-blue-600 text-white hover:bg-blue-700"
          >
            {t('branches.addFirst')}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBranches.map((branch) => (
          <Card key={branch._id} className="p-4">
            <h2 className="text-lg font-semibold">{branch.displayName}</h2>
            <p>{t('branches.code')}: {branch.code}</p>
            <p>{t('branches.address')}: {branch.address}</p>
            <p>{t('branches.city')}: {branch.city}</p>
            {branch.phone && <p>{t('branches.phone')}: {branch.phone}</p>}
            {branch.user && (
              <>
                <p>{t('branches.user')}: {branch.user.displayName}</p>
                {branch.user.email && <p>{t('branches.email')}: {branch.user.email}</p>}
                {branch.user.phone && <p>{t('branches.userPhone')}: {branch.user.phone}</p>}
                <p>{t('branches.userStatus')}: {branch.user.isActive ? t('branches.active') : t('branches.inactive')}</p>
              </>
            )}
            <p>{t('branches.createdBy')}: {branch.createdBy.displayName}</p>
            <div className="mt-4 flex gap-2">
              <Button
                onClick={() => {
                  setIsModalOpen(true);
                  setIsEditMode(true);
                  setSelectedBranchId(branch._id);
                  setFormData({
                    name: branch.name,
                    nameEn: branch.nameEn || '',
                    code: branch.code,
                    address: branch.address,
                    city: branch.city,
                    phone: branch.phone || '',
                    user: {
                      name: branch.user?.name || '',
                      nameEn: branch.user?.nameEn || '',
                      username: branch.user?.username || '',
                      email: branch.user?.email || '',
                      phone: branch.user?.phone || '',
                      isActive: branch.user?.isActive ?? true,
                      password: '',
                    },
                  });
                }}
                className="bg-yellow-500 text-white hover:bg-yellow-600"
              >
                <Edit2 className="w-5 h-5 mr-2" /> {t('branches.edit')}
              </Button>
              <Button
                onClick={() => {
                  setSelectedBranchId(branch._id);
                  setIsResetPasswordModalOpen(true);
                }}
                className="bg-purple-500 text-white hover:bg-purple-600"
              >
                <Key className="w-5 h-5 mr-2" /> {t('branches.resetPassword')}
              </Button>
              <Button
                onClick={() => handleDeleteBranch(branch._id)}
                className="bg-red-500 text-white hover:bg-red-600"
              >
                <Trash2 className="w-5 h-5 mr-2" /> {t('branches.delete')}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditMode ? t('branches.edit') : t('branches.add')}
      >
        <div className="space-y-4">
          <Input
            label={t('branches.namePlaceholder')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label={t('branches.nameEnPlaceholder')}
            value={formData.nameEn}
            onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
          />
          <Input
            label={t('branches.codePlaceholder')}
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            required
          />
          <Input
            label={t('branches.addressPlaceholder')}
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            required
          />
          <Input
            label={t('branches.cityPlaceholder')}
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            required
          />
          <Input
            label={t('branches.phonePlaceholder')}
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <h3 className="font-semibold mt-4">{t('branches.user')}</h3>
          <Input
            label={t('branches.userNamePlaceholder')}
            value={formData.user.name}
            onChange={(e) => setFormData({ ...formData, user: { ...formData.user, name: e.target.value } })}
            required
          />
          <Input
            label={t('branches.userNameEnPlaceholder')}
            value={formData.user.nameEn}
            onChange={(e) => setFormData({ ...formData, user: { ...formData.user, nameEn: e.target.value } })}
          />
          <Input
            label={t('branches.usernamePlaceholder')}
            value={formData.user.username}
            onChange={(e) => setFormData({ ...formData, user: { ...formData.user, username: e.target.value } })}
            required
          />
          <Input
            label={t('branches.emailPlaceholder')}
            value={formData.user.email}
            onChange={(e) => setFormData({ ...formData, user: { ...formData.user, email: e.target.value } })}
            type="email"
          />
          <Input
            label={t('branches.userPhonePlaceholder')}
            value={formData.user.phone}
            onChange={(e) => setFormData({ ...formData, user: { ...formData.user, phone: e.target.value } })}
          />
          <Select
            label={t('branches.userStatus')}
            value={formData.user.isActive ? 'active' : 'inactive'}
            onChange={(e) =>
              setFormData({ ...formData, user: { ...formData.user, isActive: e.target.value === 'active' } })
            }
            options={[
              { value: 'active', label: t('branches.active') },
              { value: 'inactive', label: t('branches.inactive') },
            ]}
          />
          {!isEditMode && (
            <>
              <Input
                label={t('branches.passwordPlaceholder')}
                value={formData.user.password}
                onChange={(e) => setFormData({ ...formData, user: { ...formData.user, password: e.target.value } })}
                type="password"
                required
              />
              <Input
                label={t('branches.confirmPasswordPlaceholder')}
                value={formData.user.confirmPassword || ''}
                onChange={(e) => setFormData({ ...formData, user: { ...formData.user, confirmPassword: e.target.value } })}
                type="password"
                required
              />
            </>
          )}
          <div className="flex gap-4 mt-4">
            <Button onClick={handleAddEditBranch} className="bg-blue-600 text-white hover:bg-blue-700">
              {isEditMode ? t('branches.update') : t('branches.add')}
            </Button>
            <Button onClick={() => setIsModalOpen(false)} className="bg-gray-300 hover:bg-gray-400">
              {t('branches.cancel')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isResetPasswordModalOpen}
        onClose={() => setIsResetPasswordModalOpen(false)}
        title={t('branches.resetPassword')}
      >
        <div className="space-y-4">
          <Input
            label={t('branches.newPasswordPlaceholder')}
            value={resetPasswordData.password}
            onChange={(e) => setResetPasswordData({ ...resetPasswordData, password: e.target.value })}
            type="password"
            required
          />
          <Input
            label={t('branches.confirmPasswordPlaceholder')}
            value={resetPasswordData.confirmPassword}
            onChange={(e) => setResetPasswordData({ ...resetPasswordData, confirmPassword: e.target.value })}
            type="password"
            required
          />
          <div className="flex gap-4 mt-4">
            <Button onClick={handleResetPassword} className="bg-blue-600 text-white hover:bg-blue-700">
              {t('branches.reset')}
            </Button>
            <Button
              onClick={() => setIsResetPasswordModalOpen(false)}
              className="bg-gray-300 hover:bg-gray-400"
            >
              {t('branches.cancel')}
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}