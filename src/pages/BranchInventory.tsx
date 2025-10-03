// src/pages/BranchInventory.tsx
import React, { useState, useMemo, useCallback ,useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { inventoryAPI  } from '../services/api'; // Removed returnsAPI since merged

import { Card } from '../components/UI/Card';
import { Input } from '../components/UI/Input';
import { Button } from '../components/UI/Button';
import { Modal } from '../components/UI/Modal';
import { Select } from '../components/UI/Select';
import { Package, AlertCircle, Search, RefreshCw, Edit, History as HistoryIcon } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { debounce } from 'lodash';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface InventoryItem {
  _id: string;
  product: {
    _id: string;
    name: string;
    nameEn: string;
    code: string;
    unit: string;
    unitEn: string;
    department: { name: string; nameEn: string; _id: string };
  };
  currentStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  status?: string;
}

interface InventoryHistoryItem {
  _id: string;
  product: {
    name: string;
    nameEn: string;
  };
  action: string;
  quantity: number;
  reference: string;
  createdBy: {
    username: string;
  };
  createdAt: string;
}

const InventoryCardSkeleton: React.FC<{ isRtl: boolean }> = ({ isRtl }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className="p-4 mb-4 bg-white shadow-md rounded-lg border border-gray-200"
  >
    <div className="flex flex-col gap-3">
      <div className={`flex items-center ${isRtl ? 'justify-between flex-row-reverse' : 'justify-between'}`}>
        <div className="h-6 w-1/2 bg-gray-200 rounded animate-pulse" />
        <div className="h-5 w-20 bg-gray-200 rounded-full animate-pulse" />
      </div>
      <div className="h-4 w-1/3 bg-gray-200 rounded animate-pulse" />
      <div className="h-4 w-1/4 bg-gray-200 rounded animate-pulse" />
      <div className="h-4 w-1/4 bg-gray-200 rounded animate-pulse" />
    </div>
  </motion.div>
);

export const BranchInventory: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [activeTab, setActiveTab] = useState<'inventory' | 'history'>('inventory');
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [returnForm, setReturnForm] = useState({
    productId: '',
    quantity: 1,
    reason: '',
    notes: '',
  });
  const [editForm, setEditForm] = useState({
    currentStock: 0,
    minStockLevel: 0,
    maxStockLevel: 0,
  });
  const [returnErrors, setReturnErrors] = useState({});
  const [editErrors, setEditErrors] = useState({});

  const socket = useMemo<Socket | null>(() => {
    const apiUrl = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app';
    try {
      return io(apiUrl, {
        auth: { token: localStorage.getItem('token') },
        transports: ['websocket'],
        path: '/socket.io',
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
    } catch (err) {
      console.error('Socket initialization error:', err);
      toast.error(isRtl ? 'فشل في تهيئة الاتصال' : 'Failed to initialize connection');
      return null;
    }
  }, [isRtl]);

  const { data: inventoryData, isLoading: inventoryLoading, error: inventoryError, refetch: refetchInventory } = useQuery({
    queryKey: ['inventory', user?.branchId],
    queryFn: () => inventoryAPI.getByBranch(user?.branchId || ''),
    enabled: !!user?.branchId,
    select: (response) => {
      const inventoryData = Array.isArray(response) ? response : response || [];
      return inventoryData.map((item: InventoryItem) => ({
        ...item,
        product: {
          _id: item.product?._id || '',
          name: item.product?.name || 'Unknown Product',
          nameEn: item.product?.nameEn || item.product?.name || 'Unknown Product',
          code: item.product?.code || 'N/A',
          unit: item.product?.unit || 'غير محدد',
          unitEn: item.product?.unitEn || item.product?.unit || 'N/A',
          department: {
            _id: item.product?.department?._id || '',
            name: item.product?.department?.name || 'غير معروف',
            nameEn: item.product?.department?.nameEn || item.product?.department?.name || 'Unknown',
          },
        },
        status:
          item.currentStock <= item.minStockLevel
            ? 'low'
            : item.currentStock >= item.maxStockLevel
            ? 'full'
            : 'normal',
      }));
    },
  });

  const { data: historyData, isLoading: historyLoading, error: historyError } = useQuery({
    queryKey: ['inventoryHistory', user?.branchId],
    queryFn: () => inventoryAPI.getHistory({ branchId: user?.branchId }),
    enabled: activeTab === 'history' && !!user?.branchId,
  });

  useEffect(() => {
    if (!socket) return;

    socket.on('connect', () => console.log('Socket connected'));
    socket.on('connect_error', (err) => console.error('Socket connect error:', err));
    socket.on('inventoryUpdated', ({ branchId }) => {
      if (branchId === user?.branchId) {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        queryClient.invalidateQueries({ queryKey: ['inventoryHistory'] });
      }
    });
    socket.on('returnCreated', ({ branchId }) => {
      if (branchId === user?.branchId) {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        queryClient.invalidateQueries({ queryKey: ['inventoryHistory'] });
      }
    });
    socket.on('returnStatusUpdated', ({ branchId }) => {
      if (branchId === user?.branchId) {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        queryClient.invalidateQueries({ queryKey: ['inventoryHistory'] });
      }
    });

    return () => {
      socket.off('connect');
      socket.off('connect_error');
      socket.off('inventoryUpdated');
      socket.off('returnCreated');
      socket.off('returnStatusUpdated');
      socket.disconnect();
    };
  }, [socket, user, queryClient]);

  const debouncedSearch = useCallback(
    debounce((value: string) => setSearchQuery(value.trim()), 300),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(e.target.value);
  };

  const statusOptions = useMemo(
    () => [
      { value: '', label: isRtl ? 'كل الحالات' : 'All Statuses' },
      { value: 'low', label: isRtl ? 'منخفض' : 'Low Stock' },
      { value: 'normal', label: isRtl ? 'عادي' : 'Normal' },
      { value: 'full', label: isRtl ? 'ممتلئ' : 'Full' },
    ],
    [isRtl]
  );

  const reasonOptions = useMemo(
    () => [
      { value: 'تالف', label: isRtl ? 'تالف' : 'Damaged' },
      { value: 'منتج خاطئ', label: isRtl ? 'منتج خاطئ' : 'Wrong Item' },
      { value: 'كمية زائدة', label: isRtl ? 'كمية زائدة' : 'Excess Quantity' },
      { value: 'أخرى', label: isRtl ? 'أخرى' : 'Other' },
    ],
    [isRtl]
  );

  const filteredInventory = useMemo(
    () => (inventoryData || []).filter(
      (item) =>
        (!filterStatus || item.status === filterStatus) &&
        (item.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.product.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.product.code.toLowerCase().includes(searchQuery.toLowerCase()))
    ),
    [inventoryData, searchQuery, filterStatus]
  );

  const validateReturnForm = useCallback(() => {
    const errors: any = {};
    if (!returnForm.reason) errors.reason = t('errors.required', { field: t('returns.reason') });
    if (returnForm.quantity < 1 || returnForm.quantity > selectedItem?.currentStock) {
      errors.quantity = t('errors.invalid_quantity_max', { max: selectedItem?.currentStock });
    }
    setReturnErrors(errors);
    return Object.keys(errors).length === 0;
  }, [returnForm, selectedItem, t]);

  const validateEditForm = useCallback(() => {
    const errors: any = {};
    if (editForm.currentStock < 0) errors.currentStock = t('errors.non_negative', { field: t('inventory.currentStock') });
    if (editForm.minStockLevel < 0) errors.minStockLevel = t('errors.non_negative', { field: t('inventory.minStockLevel') });
    if (editForm.maxStockLevel < 0) errors.maxStockLevel = t('errors.non_negative', { field: t('inventory.maxStockLevel') });
    if (editForm.maxStockLevel < editForm.minStockLevel) errors.maxStockLevel = t('errors.max_greater_min');
    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  }, [editForm, t]);

  const createReturnMutation = useMutation({
    mutationFn: async () => {
      if (!validateReturnForm()) throw new Error(t('errors.invalid_form'));
      return inventoryAPI.createReturn({
        branchId: user?.branchId,
        reason: returnForm.reason,
        notes: returnForm.notes,
        items: [{ productId: returnForm.productId, quantity: returnForm.quantity, reason: returnForm.reason }],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryHistory'] });
      setIsReturnModalOpen(false);
      setReturnForm({ productId: '', quantity: 1, reason: '', notes: '' });
      setReturnErrors({});
      setSelectedItem(null);
      toast.success(t('returns.create_success'));
    },
    onError: (err: any) => {
      toast.error(err.message || t('errors.create_return'));
    },
  });

  const updateStockMutation = useMutation({
    mutationFn: (data: { id: string; currentStock: number; minStockLevel: number; maxStockLevel: number }) => 
      inventoryAPI.updateStock(data.id, {
        currentStock: data.currentStock,
        minStockLevel: data.minStockLevel,
        maxStockLevel: data.maxStockLevel,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryHistory'] });
      setIsEditModalOpen(false);
      setEditForm({ currentStock: 0, minStockLevel: 0, maxStockLevel: 0 });
      setEditErrors({});
      setSelectedItem(null);
      toast.success(t('inventory.update_success'));
    },
    onError: (err: any) => {
      toast.error(err.message || t('errors.update_inventory'));
    },
  });

  const handleOpenReturnModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setReturnForm({ ...returnForm, productId: item.product._id, quantity: 1 });
    setIsReturnModalOpen(true);
  };

  const handleOpenEditModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setEditForm({
      currentStock: item.currentStock,
      minStockLevel: item.minStockLevel,
      maxStockLevel: item.maxStockLevel,
    });
    setIsEditModalOpen(true);
  };

  const handleCreateReturn = () => {
    createReturnMutation.mutate();
  };

  const handleUpdateStock = () => {
    if (selectedItem) {
      updateStockMutation.mutate({
        id: selectedItem._id,
        currentStock: editForm.currentStock,
        minStockLevel: editForm.minStockLevel,
        maxStockLevel: editForm.maxStockLevel,
      });
    }
  };

  const errorMessage = inventoryError?.message || historyError?.message || '';

  return (
    <div
      className="container mx-auto px-4 py-6 min-h-screen bg-gradient-to-br from-amber-50 to-teal-50"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Package className="w-8 h-8 text-amber-600" />
          {isRtl ? 'المخزون' : 'Inventory'}
        </h1>
        <p className="text-gray-600 mt-2">
          {isRtl ? 'إدارة مخزون الفرع' : 'Manage branch inventory'}
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600">{errorMessage}</span>
          <Button
            onClick={() => refetchInventory()}
            className="ml-4 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {isRtl ? 'إعادة المحاولة' : 'Retry'}
          </Button>
        </div>
      )}

      <div className="flex mb-4">
        <Button
          onClick={() => setActiveTab('inventory')}
          className={`flex-1 py-2 ${activeTab === 'inventory' ? 'bg-amber-600 text-white' : 'bg-white text-gray-700'} rounded-l-lg`}
        >
          {isRtl ? 'المخزون' : 'Inventory'}
        </Button>
        <Button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 ${activeTab === 'history' ? 'bg-amber-600 text-white' : 'bg-white text-gray-700'} rounded-r-lg`}
        >
          <HistoryIcon className="inline w-4 h-4 mr-2" />
          {isRtl ? 'سجل الحركات' : 'Movement History'}
        </Button>
      </div>

      <Card className="p-6 mb-6 bg-white rounded-xl shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative">
            <Search
              className={`absolute top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 ${isRtl ? 'right-3' : 'left-3'}`}
            />
            <Input
              placeholder={isRtl ? 'ابحث...' : 'Search...'}
              onChange={handleSearchChange}
              className={`pl-10 pr-4 py-2 border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 ${isRtl ? 'pr-10 pl-4' : ''}`}
            />
          </div>
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={statusOptions}
            label={isRtl ? 'تصفية حسب الحالة' : 'Filter by Status'}
          />
        </div>
      </Card>

      {activeTab === 'inventory' ? (
        inventoryLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <InventoryCardSkeleton key={i} isRtl={isRtl} />
            ))}
          </div>
        ) : filteredInventory.length === 0 ? (
          <Card className="p-8 text-center bg-white rounded-xl shadow-md">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">{isRtl ? 'لا توجد عناصر' : 'No items'}</p>
          </Card>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {filteredInventory.map((item) => (
                <motion.div
                  key={item._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{isRtl ? item.product.name : item.product.nameEn}</h3>
                        <p className="text-sm text-gray-500">{isRtl ? 'الكود' : 'Code'}: {item.product.code}</p>
                        <p className="text-sm text-gray-600">{isRtl ? 'المخزون' : 'Stock'}: {item.currentStock}</p>
                        <p className="text-sm text-gray-600">{isRtl ? 'الحد الأدنى' : 'Min'}: {item.minStockLevel}</p>
                        <p className="text-sm text-gray-600">{isRtl ? 'الحد الأقصى' : 'Max'}: {item.maxStockLevel}</p>
                        <p className="text-sm text-gray-600">{isRtl ? 'الوحدة' : 'Unit'}: {isRtl ? item.product.unit : item.product.unitEn}</p>
                        <p className="text-sm text-gray-600">{isRtl ? 'القسم' : 'Department'}: {isRtl ? item.product.department.name : item.product.department.nameEn}</p>
                        <p className={`text-sm font-medium ${
                          item.status === 'low' ? 'text-red-600' : item.status === 'full' ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {isRtl 
                            ? item.status === 'low' ? 'منخفض' : item.status === 'full' ? 'ممتلئ' : 'عادي'
                            : item.status}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenEditModal(item)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={item.currentStock <= 0}
                          onClick={() => handleOpenReturnModal(item)}
                          className="text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          {isRtl ? 'إرجاع' : 'Return'}
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )
      ) : (
        historyLoading ? (
          <div className="text-center py-8">{isRtl ? 'جاري التحميل...' : 'Loading...'}</div>
        ) : (historyData || []).length === 0 ? (
          <Card className="p-8 text-center">
            <HistoryIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">{isRtl ? 'لا توجد حركات' : 'No history'}</p>
          </Card>
        ) : (
          <Card className="p-4 bg-white rounded-xl shadow-md">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className={`p-2 text-left ${isRtl ? 'text-right' : ''}`}>{isRtl ? 'التاريخ' : 'Date'}</th>
                  <th className={`p-2 text-left ${isRtl ? 'text-right' : ''}`}>{isRtl ? 'الإجراء' : 'Action'}</th>
                  <th className={`p-2 text-left ${isRtl ? 'text-right' : ''}`}>{isRtl ? 'الكمية' : 'Quantity'}</th>
                  <th className={`p-2 text-left ${isRtl ? 'text-right' : ''}`}>{isRtl ? 'المرجع' : 'Reference'}</th>
                  <th className={`p-2 text-left ${isRtl ? 'text-right' : ''}`}>{isRtl ? 'بواسطة' : 'By'}</th>
                </tr>
              </thead>
              <tbody>
                {(historyData || []).map((entry: InventoryHistoryItem) => (
                  <tr key={entry._id} className="border-b">
                    <td className="p-2">{new Date(entry.createdAt).toLocaleString()}</td>
                    <td className="p-2">{entry.action}</td>
                    <td className="p-2">{entry.quantity}</td>
                    <td className="p-2">{entry.reference}</td>
                    <td className="p-2">{entry.createdBy.username}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      )}

      {/* Return Modal */}
      <Modal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        title={isRtl ? 'إنشاء إرجاع' : 'Create Return'}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            {isRtl ? 'المنتج' : 'Product'}: {isRtl ? selectedItem?.product.name : selectedItem?.product.nameEn}
          </p>
          <p className="text-sm text-gray-600">
            {isRtl ? 'الكمية المتاحة' : 'Available'}: {selectedItem?.currentStock}
          </p>
          <Input
            label={isRtl ? 'الكمية' : 'Quantity'}
            type="number"
            min={1}
            max={selectedItem?.currentStock}
            value={returnForm.quantity}
            onChange={(e) => setReturnForm({ ...returnForm, quantity: Number(e.target.value) })}
            error={returnErrors.quantity}
          />
          <Select
            label={isRtl ? 'السبب' : 'Reason'}
            value={returnForm.reason}
            onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })}
            options={reasonOptions}
            error={returnErrors.reason}
          />
          <Input
            label={isRtl ? 'ملاحظات' : 'Notes'}
            value={returnForm.notes}
            onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
          />
          <Button
            onClick={handleCreateReturn}
            disabled={createReturnMutation.isPending}
            className="bg-amber-600 text-white hover:bg-amber-700"
          >
            {createReturnMutation.isPending ? (isRtl ? 'جاري...' : 'Submitting...') : isRtl ? 'إرسال' : 'Submit'}
          </Button>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={isRtl ? 'تحرير المخزون' : 'Edit Inventory'}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            {isRtl ? 'المنتج' : 'Product'}: {isRtl ? selectedItem?.product.name : selectedItem?.product.nameEn}
          </p>
          <Input
            label={isRtl ? 'المخزون الحالي' : 'Current Stock'}
            type="number"
            min={0}
            value={editForm.currentStock}
            onChange={(e) => setEditForm({ ...editForm, currentStock: Number(e.target.value) })}
            error={editErrors.currentStock}
          />
          <Input
            label={isRtl ? 'الحد الأدنى' : 'Min Level'}
            type="number"
            min={0}
            value={editForm.minStockLevel}
            onChange={(e) => setEditForm({ ...editForm, minStockLevel: Number(e.target.value) })}
            error={editErrors.minStockLevel}
          />
          <Input
            label={isRtl ? 'الحد الأقصى' : 'Max Level'}
            type="number"
            min={0}
            value={editForm.maxStockLevel}
            onChange={(e) => setEditForm({ ...editForm, maxStockLevel: Number(e.target.value) })}
            error={editErrors.maxStockLevel}
          />
          <Button
            onClick={handleUpdateStock}
            disabled={updateStockMutation.isPending}
            className="bg-amber-600 text-white hover:bg-amber-700"
          >
            {updateStockMutation.isPending ? (isRtl ? 'جاري...' : 'Updating...') : isRtl ? 'تحديث' : 'Update'}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default BranchInventory;