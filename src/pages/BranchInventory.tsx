import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { inventoryAPI, ordersAPI, returnsAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Input } from '../components/UI/Input';
import { Button } from '../components/UI/Button';
import { Modal } from '../components/UI/Modal';
import { Select } from '../components/UI/Select';
import { Package, AlertCircle, Search, RefreshCw, History as HistoryIcon, Edit, X, Plus } from 'lucide-react';
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

interface Order {
  _id: string;
  orderNumber: string;
  items: Array<{
    _id: string;
    product: {
      _id: string;
      name: string;
      nameEn: string;
    };
    quantity: number;
    returnedQuantity?: number;
  }>;
  status: string;
}

interface ReturnItem {
  itemId: string;
  productId: string;
  quantity: number;
  reason: string;
  maxQuantity: number;
}

interface ReturnForm {
  orderId: string;
  reason: string;
  notes: string;
  items: ReturnItem[];
}

interface EditForm {
  minStockLevel: number;
  maxStockLevel: number;
}

const ITEMS_PER_PAGE = 10;

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

const Pagination: React.FC<{ totalPages: number; currentPage: number; setCurrentPage: (page: number) => void; isRtl: boolean }> = ({ totalPages, currentPage, setCurrentPage, isRtl }) => (
  totalPages > 1 && (
    <div className={`flex items-center justify-center gap-3 mt-6 ${isRtl ? 'flex-row-reverse' : ''}`}>
      <Button
        variant="secondary"
        size="md"
        onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
        disabled={currentPage === 1}
        className="disabled:opacity-50 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full px-4 py-2 transition-colors duration-200"
      >
        {isRtl ? 'السابق' : 'Previous'}
      </Button>
      <span className="text-gray-700 font-medium">
        {isRtl ? `الصفحة ${currentPage} من ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
      </span>
      <Button
        variant="secondary"
        size="md"
        onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
        disabled={currentPage === totalPages}
        className="disabled:opacity-50 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full px-4 py-2 transition-colors duration-200"
      >
        {isRtl ? 'التالي' : 'Next'}
      </Button>
    </div>
  )
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
  const [currentPage, setCurrentPage] = useState(1);
  const [returnForm, setReturnForm] = useState<ReturnForm>({
    orderId: '',
    reason: '',
    notes: '',
    items: [],
  });
  const [editForm, setEditForm] = useState<EditForm>({
    minStockLevel: 0,
    maxStockLevel: 0,
  });
  const [returnErrors, setReturnErrors] = useState({});
  const [editErrors, setEditErrors] = useState({});
  const [availableItems, setAvailableItems] = useState<any[]>([]);

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
    queryKey: ['inventory', user?.branchId, language],
    queryFn: () => inventoryAPI.getByBranch(user?.branchId || ''),
    enabled: !!user?.branchId,
    select: (response) => {
      const inventoryData = Array.isArray(response) ? response : response?.data || [];
      return inventoryData.map((item: InventoryItem) => ({
        ...item,
        product: {
          _id: item.product?._id || '',
          name: item.product?.name || t('products.unknown'),
          nameEn: item.product?.nameEn || item.product?.name || t('products.unknown'),
          code: item.product?.code || 'N/A',
          unit: item.product?.unit || t('products.unit_unknown'),
          unitEn: item.product?.unitEn || item.product?.unit || 'N/A',
          department: {
            _id: item.product?.department?._id || '',
            name: item.product?.department?.name || t('departments.unknown'),
            nameEn: item.product?.department?.nameEn || item.product?.department?.name || t('departments.unknown'),
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
    queryKey: ['inventoryHistory', user?.branchId, language],
    queryFn: () => inventoryAPI.getHistory({ branchId: user?.branchId }),
    enabled: activeTab === 'history' && !!user?.branchId,
  });

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', user?.branchId, language],
    queryFn: () => ordersAPI.getAll({ branch: user?.branchId, status: 'delivered' }),
    enabled: !!user?.branchId,
    select: (response) => response?.orders || [],
  });

  const { data: selectedOrderData } = useQuery({
    queryKey: ['selectedOrder', returnForm.orderId, language],
    queryFn: () => {
      if (!returnForm.orderId) return null;
      return ordersAPI.getById(returnForm.orderId);
    },
    enabled: !!returnForm.orderId,
    onSuccess: (order) => {
      if (order) {
        const items = order.items.map((i: any) => ({
          itemId: i._id,
          productId: i.product._id,
          productName: isRtl ? i.product.name : i.product.nameEn || i.product.name,
          available: i.quantity - (i.returnedQuantity || 0),
          unit: isRtl ? i.product.unit || t('products.unit_unknown') : i.product.unitEn || i.product.unit || 'N/A',
          departmentName: isRtl ? i.product.department.name : i.product.department.nameEn || i.product.department.name,
          stock: inventoryData?.find((inv: any) => inv.product._id === i.product._id)?.currentStock || 0,
        }));
        setAvailableItems(items);
        // If selectedItem is set, auto-add the item if it's in the order
        if (selectedItem) {
          const matchingItem = items.find((a) => a.productId === selectedItem.product._id);
          if (matchingItem) {
            setReturnForm((prev) => ({
              ...prev,
              items: [{
                itemId: matchingItem.itemId,
                productId: matchingItem.productId,
                quantity: 1,
                reason: '',
                maxQuantity: Math.min(matchingItem.available, matchingItem.stock),
              }],
            }));
          } else {
            toast.error(isRtl ? 'المنتج غير موجود في الطلب' : 'Product not found in the order');
          }
        }
      } else {
        setAvailableItems([]);
      }
    },
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
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      }
    });
    socket.on('returnStatusUpdated', ({ branchId }) => {
      if (branchId === user?.branchId) {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        queryClient.invalidateQueries({ queryKey: ['inventoryHistory'] });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
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
    debouncedSearch(e?.target?.value || '');
    setCurrentPage(1);
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

  const paginatedInventory = useMemo(
    () => filteredInventory.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredInventory, currentPage]
  );

  const totalInventoryPages = Math.ceil(filteredInventory.length / ITEMS_PER_PAGE);

  const filteredHistory = useMemo(
    () => (historyData || []).filter(
      (entry) =>
        (entry.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          entry.product.nameEn.toLowerCase().includes(searchQuery.toLowerCase())) &&
        (!filterStatus || entry.action === filterStatus)
    ),
    [historyData, searchQuery, filterStatus]
  );

  const paginatedHistory = useMemo(
    () => filteredHistory.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredHistory, currentPage]
  );

  const totalHistoryPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);

  const handleOpenReturnModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setReturnForm({ orderId: '', reason: '', notes: '', items: [] });  // Reset items, will add after order select
    setReturnErrors({});
    setIsReturnModalOpen(true);
  };

  const handleOpenEditModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setEditForm({ minStockLevel: item.minStockLevel, maxStockLevel: item.maxStockLevel });
    setEditErrors({});
    setIsEditModalOpen(true);
  };

  const addItemToForm = () => {
    setReturnForm((prev) => ({
      ...prev,
      items: [...prev.items, { itemId: '', productId: '', quantity: 1, reason: '', maxQuantity: 0 }],
    }));
  };

  const updateItemInForm = (index: number, field: string, value: any) => {
    setReturnForm((prev) => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      if (field === 'itemId') {
        const sel = availableItems.find((a) => a.itemId === value);
        if (sel) {
          newItems[index].productId = sel.productId;
          newItems[index].maxQuantity = Math.min(sel.available, sel.stock);
        } else {
          newItems[index].productId = '';
          newItems[index].maxQuantity = 0;
        }
      }
      return { ...prev, items: newItems };
    });
  };

  const removeItemFromForm = (index: number) => {
    setReturnForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const validateReturnForm = useCallback(() => {
    const errors: any = {};
    if (!returnForm.orderId) errors.orderId = t('errors.required', { field: t('returns.order') });
    if (!returnForm.reason) errors.reason = t('errors.required', { field: t('returns.reason') });
    if (returnForm.items.length === 0) errors.items = t('errors.required', { field: t('returns.items') });
    returnForm.items.forEach((item, index) => {
      if (!item.itemId) errors[`item_${index}_itemId`] = t('errors.required', { field: t('returns.item') });
      if (!item.reason) errors[`item_${index}_reason`] = t('errors.required', { field: t('returns.reason') });
      if (item.quantity < 1 || item.quantity > (item.maxQuantity ?? 0) || isNaN(item.quantity)) {
        errors[`item_${index}_quantity`] = t('errors.invalid_quantity_max', { max: item.maxQuantity ?? 0 });
      }
    });
    setReturnErrors(errors);
    return Object.keys(errors).length === 0;
  }, [returnForm, t]);

  const validateEditForm = useCallback(() => {
    const errors: any = {};
    if (editForm.minStockLevel < 0) errors.minStockLevel = t('errors.non_negative', { field: t('inventory.min_stock') });
    if (editForm.maxStockLevel < 0) errors.maxStockLevel = t('errors.non_negative', { field: t('inventory.max_stock') });
    if (editForm.maxStockLevel <= editForm.minStockLevel) errors.maxStockLevel = t('errors.max_greater_min');
    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  }, [editForm, t]);

  const createReturnMutation = useMutation({
    mutationFn: async () => {
      if (!validateReturnForm()) throw new Error(t('errors.invalid_form'));
      return returnsAPI.createReturn({
        orderId: returnForm.orderId,
        branchId: user?.branchId,
        reason: returnForm.reason,
        notes: returnForm.notes,
        items: returnForm.items.map((item) => ({
          itemId: item.itemId,
          productId: item.productId,
          quantity: item.quantity,
          reason: item.reason,
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryHistory'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setIsReturnModalOpen(false);
      setReturnForm({ orderId: '', reason: '', notes: '', items: [] });
      setReturnErrors({});
      setAvailableItems([]);
      setSelectedItem(null);
      toast.success(t('returns.create_success'));
    },
    onError: (err: any) => {
      const errorMessage = err.response?.data?.message || err.message || t('errors.create_return');
      toast.error(errorMessage);
      if (err.response?.data?.errors) {
        const backendErrors = err.response.data.errors.reduce((acc: any, error: any) => {
          acc[error.path] = error.msg;
          return acc;
        }, {});
        setReturnErrors(backendErrors);
      }
    },
  });

  const updateInventoryMutation = useMutation({
    mutationFn: async () => {
      if (!validateEditForm()) throw new Error(t('errors.invalid_form'));
      if (!selectedItem) throw new Error(t('errors.no_item_selected'));
      return inventoryAPI.update(selectedItem._id, {
        minStockLevel: editForm.minStockLevel,
        maxStockLevel: editForm.maxStockLevel,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setIsEditModalOpen(false);
      setEditForm({ minStockLevel: 0, maxStockLevel: 0 });
      setEditErrors({});
      setSelectedItem(null);
      toast.success(t('inventory.update_success'));
    },
    onError: (err: any) => {
      toast.error(err.message || t('errors.update_inventory'));
    },
  });

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

      <div className="flex mb-4 overflow-hidden rounded-full bg-white shadow-md">
        <Button
          onClick={() => setActiveTab('inventory')}
          className={`flex-1 py-2 font-semibold transition-all duration-300 ${
            activeTab === 'inventory' ? 'bg-amber-600 text-white' : 'text-gray-700'
          }`}
        >
          {isRtl ? 'المخزون' : 'Inventory'}
        </Button>
        <Button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 font-semibold transition-all duration-300 ${
            activeTab === 'history' ? 'bg-amber-600 text-white' : 'text-gray-700'
          }`}
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
            onChange={(e) => {
              const value = e?.target?.value || '';
              setFilterStatus(value);
              setCurrentPage(1);
            }}
            options={statusOptions}
            label={isRtl ? 'تصفية حسب الحالة' : 'Filter by Status'}
          />
        </div>
      </Card>

      <AnimatePresence mode="wait">
        {activeTab === 'inventory' ? (
          <motion.div
            key="inventory"
            initial={{ opacity: 0, x: isRtl ? -50 : 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRtl ? 50 : -50 }}
            transition={{ duration: 0.3 }}
          >
            {inventoryLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <InventoryCardSkeleton key={i} isRtl={isRtl} />
                ))}
              </div>
            ) : paginatedInventory.length === 0 ? (
              <Card className="p-8 text-center bg-white rounded-xl shadow-md">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">{isRtl ? 'لا توجد عناصر' : 'No items'}</p>
              </Card>
            ) : (
              <div className="space-y-4">
                <AnimatePresence>
                  {paginatedInventory.map((item) => (
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
                <Pagination
                  totalPages={totalInventoryPages}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  isRtl={isRtl}
                />
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="history"
            initial={{ opacity: 0, x: isRtl ? 50 : -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRtl ? -50 : 50 }}
            transition={{ duration: 0.3 }}
          >
            {historyLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-amber-600 mx-auto"></div>
              </div>
            ) : paginatedHistory.length === 0 ? (
              <Card className="p-8 text-center bg-white rounded-xl shadow-md">
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
                    {paginatedHistory.map((entry: InventoryHistoryItem) => (
                      <tr key={entry._id} className="border-b">
                        <td className="p-2">{new Date(entry.createdAt).toLocaleString()}</td>
                        <td className="p-2">{isRtl ? t(`history.${entry.action}`) : entry.action}</td>
                        <td className="p-2">{entry.quantity}</td>
                        <td className="p-2">{entry.reference}</td>
                        <td className="p-2">{entry.createdBy.username}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination
                  totalPages={totalHistoryPages}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  isRtl={isRtl}
                />
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Return Modal */}
      <Modal
        isOpen={isReturnModalOpen}
        onClose={() => {
          setIsReturnModalOpen(false);
          setReturnForm({ orderId: '', reason: '', notes: '', items: [] });
          setReturnErrors({});
          setAvailableItems([]);
          setSelectedItem(null);
        }}
        title={isRtl ? 'إنشاء إرجاع' : 'Create Return'}
      >
        <div className="flex flex-col gap-4">
          {selectedItem && (
            <p className="text-sm text-gray-600">
              {isRtl ? 'المنتج' : 'Product'}: {isRtl ? selectedItem.product.name : selectedItem.product.nameEn}
            </p>
          )}
          <Select
            label={isRtl ? 'الطلب' : 'Order'}
            value={returnForm.orderId}
            onChange={(e) => {
              const value = e?.target?.value || '';
              setReturnForm({ ...returnForm, orderId: value, items: [] });
            }}
            options={[{ value: '', label: isRtl ? 'اختر طلبًا' : 'Select Order' }].concat(
              (ordersData || []).map((order: Order) => ({
                value: order._id,
                label: `${order.orderNumber}`,
              }))
            )}
            error={returnErrors.orderId}
          />
          <Select
            label={isRtl ? 'السبب' : 'Reason'}
            value={returnForm.reason}
            onChange={(e) => {
              const value = e?.target?.value || '';
              setReturnForm({ ...returnForm, reason: value });
            }}
            options={reasonOptions}
            error={returnErrors.reason}
          />
          <Input
            label={isRtl ? 'ملاحظات' : 'Notes'}
            value={returnForm.notes}
            onChange={(e) => {
              const value = e?.target?.value || '';
              setReturnForm({ ...returnForm, notes: value });
            }}
            placeholder={isRtl ? 'أدخل ملاحظات إضافية' : 'Enter additional notes'}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'العناصر' : 'Items'}</label>
            {returnForm.items.map((item, index) => (
              <div key={index} className="flex gap-2 mb-2 items-center">
                <Select
                  value={item.itemId}
                  onChange={(e) => {
                    const value = e?.target?.value || '';
                    updateItemInForm(index, 'itemId', value);
                  }}
                  options={[{ value: '', label: isRtl ? 'اختر عنصرًا' : 'Select Item' }].concat(
                    availableItems.map((a) => ({
                      value: a.itemId,
                      label: `${a.productName} (${a.available} ${isRtl ? 'متاح' : 'available'})`,
                    }))
                  )}
                  error={returnErrors[`item_${index}_itemId`]}
                  disabled={!returnForm.orderId}
                />
                <Input
                  type="number"
                  min={1}
                  max={item.maxQuantity ?? 0}
                  value={item.quantity ?? ''}
                  onChange={(e) => {
                    const value = Number(e?.target?.value || 0);
                    updateItemInForm(index, 'quantity', value);
                  }}
                  error={returnErrors[`item_${index}_quantity`]}
                  className="w-24"
                />
                <Select
                  value={item.reason}
                  onChange={(e) => {
                    const value = e?.target?.value || '';
                    updateItemInForm(index, 'reason', value);
                  }}
                  options={reasonOptions}
                  error={returnErrors[`item_${index}_reason`]}
                />
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => removeItemFromForm(index)}
                  className="text-red-600 hover:text-red-800"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {returnErrors.items && <p className="text-red-500 text-sm mt-1">{returnErrors.items}</p>}
            <Button
              variant="secondary"
              onClick={addItemToForm}
              className="mt-2 bg-gray-100 hover:bg-gray-200 text-gray-800"
              disabled={availableItems.length === 0}
            >
              <Plus className="w-4 h-4 mr-2" />
              {isRtl ? 'إضافة عنصر' : 'Add Item'}
            </Button>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setIsReturnModalOpen(false);
                setReturnForm({ orderId: '', reason: '', notes: '', items: [] });
                setReturnErrors({});
                setAvailableItems([]);
                setSelectedItem(null);
              }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800"
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              onClick={() => createReturnMutation.mutate()}
              disabled={createReturnMutation.isPending}
              className="bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {createReturnMutation.isPending ? (isRtl ? 'جاري...' : 'Submitting...') : isRtl ? 'إرسال' : 'Submit'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Stock Levels Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditForm({ minStockLevel: 0, maxStockLevel: 0 });
          setEditErrors({});
          setSelectedItem(null);
        }}
        title={isRtl ? 'تعديل حدود المخزون' : 'Edit Stock Limits'}
      >
        <div className="flex flex-col gap-4">
          {selectedItem && (
            <p className="text-sm text-gray-600">
              {isRtl ? 'المنتج' : 'Product'}: {isRtl ? selectedItem.product.name : selectedItem.product.nameEn}
            </p>
          )}
          <Input
            label={isRtl ? 'الحد الأدنى للمخزون' : 'Minimum Stock Level'}
            type="number"
            min={0}
            value={editForm.minStockLevel ?? ''}
            onChange={(e) => {
              const value = Number(e?.target?.value || 0);
              setEditForm({ ...editForm, minStockLevel: value });
            }}
            error={editErrors.minStockLevel}
          />
          <Input
            label={isRtl ? 'الحد الأقصى للمخزون' : 'Maximum Stock Level'}
            type="number"
            min={0}
            value={editForm.maxStockLevel ?? ''}
            onChange={(e) => {
              const value = Number(e?.target?.value || 0);
              setEditForm({ ...editForm, maxStockLevel: value });
            }}
            error={editErrors.maxStockLevel}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setIsEditModalOpen(false);
                setEditForm({ minStockLevel: 0, maxStockLevel: 0 });
                setEditErrors({});
                setSelectedItem(null);
              }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800"
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              onClick={() => updateInventoryMutation.mutate()}
              disabled={updateInventoryMutation.isPending}
              className="bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {updateInventoryMutation.isPending ? (isRtl ? 'جاري...' : 'Saving...') : isRtl ? 'حفظ' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default BranchInventory;