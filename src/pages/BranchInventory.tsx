import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { inventoryAPI, ordersAPI, returnsAPI } from '../services/api';
import { Package, AlertCircle, Search, RefreshCw, History as HistoryIcon, Edit, X, Plus, CheckCircle, AlertTriangle } from 'lucide-react';
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

export const CustomCard = ({ className, children }) => (
  <div className={`bg-white shadow-md rounded-xl overflow-hidden transition-shadow hover:shadow-lg ${className}`}>
    {children}
  </div>
);

export const CustomInput = ({ label, type = 'text', min, max, value, onChange, error, className, placeholder }) => (
  <div className="flex flex-col">
    {label && <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">{label}</label>}
    <input
      type={type}
      min={min}
      max={max}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all ${error ? 'border-red-500 animate-shake' : ''} ${className}`}
    />
    {error && <p className="text-red-500 text-sm mt-1 flex items-center gap-1"><AlertTriangle size={14} /> {error}</p>}
  </div>
);

export const CustomButton = ({ variant = 'primary', size = 'md', onClick, disabled, className, children }) => {
  let baseClass = 'px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 font-medium';
  if (variant === 'secondary') baseClass += ' bg-gray-200 hover:bg-gray-300 text-gray-800';
  else if (variant === 'destructive' || variant === 'danger') baseClass += ' bg-red-100 hover:bg-red-200 text-red-600';
  else baseClass += ' bg-amber-600 text-white hover:bg-amber-700';
  if (disabled) baseClass += ' opacity-50 cursor-not-allowed';
  return (
    <button onClick={onClick} disabled={disabled} className={`${baseClass} ${className}`}>
      {children}
    </button>
  );
};

export const CustomModal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white p-6 rounded-2xl shadow-2xl max-w-md w-full m-4"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
          <CustomButton variant="secondary" size="sm" onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </CustomButton>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
};

export const CustomSelect = ({ label, value, onChange, options, error, disabled }) => (
  <div className="flex flex-col">
    {label && <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">{label}</label>}
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={`px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all ${error ? 'border-red-500 animate-shake' : ''} ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
    {error && <p className="text-red-500 text-sm mt-1 flex items-center gap-1"><AlertTriangle size={14} /> {error}</p>}
  </div>
);

export const InventoryCardSkeleton = ({ isRtl }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className="p-6 mb-6 bg-white shadow-md rounded-2xl border border-gray-100 animate-pulse"
  >
    <div className="flex flex-col gap-4">
      <div className={`flex items-center ${isRtl ? 'justify-between flex-row-reverse' : 'justify-between'}`}>
        <div className="h-7 w-3/5 bg-gray-200 rounded-md" />
        <div className="h-6 w-24 bg-gray-200 rounded-full" />
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-5 w-1/2 bg-gray-200 rounded" />
      ))}
    </div>
  </motion.div>
);

export const Pagination = ({ totalPages, currentPage, setCurrentPage, isRtl }) => (
  totalPages > 1 && (
    <div className={`flex items-center justify-center gap-4 mt-8 ${isRtl ? 'flex-row-reverse' : ''}`}>
      <CustomButton
        variant="secondary"
        onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
        disabled={currentPage === 1}
        className="rounded-full px-5 py-2.5 shadow-sm hover:shadow-md"
      >
        {isRtl ? 'السابق' : 'Previous'}
      </CustomButton>
      <span className="text-gray-700 font-semibold bg-gray-100 px-5 py-2.5 rounded-full shadow-sm">
        {isRtl ? `الصفحة ${currentPage} من ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
      </span>
      <CustomButton
        variant="secondary"
        onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
        disabled={currentPage === totalPages}
        className="rounded-full px-5 py-2.5 shadow-sm hover:shadow-md"
      >
        {isRtl ? 'التالي' : 'Next'}
      </CustomButton>
    </div>
  )
);

const BranchInventory = () => {
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
    setReturnForm({ orderId: '', reason: '', notes: '', items: [] });
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
        reason: returnForm.reason,
        notes: returnForm.notes,
        items: returnForm.items.map((item) => ({
          itemId: item.itemId,
          product: item.productId,
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
      toast.success(t('returns.create_success'), { icon: <CheckCircle className="text-green-500" /> });
    },
    onError: (err: any) => {
      const errorMessage = err.response?.data?.message || err.message || t('errors.create_return');
      toast.error(errorMessage, { icon: <AlertCircle className="text-red-500" /> });
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
      toast.success(t('inventory.update_success'), { icon: <CheckCircle className="text-green-500" /> });
    },
    onError: (err: any) => {
      toast.error(err.message || t('errors.update_inventory'), { icon: <AlertCircle className="text-red-500" /> });
    },
  });

  const errorMessage = inventoryError?.message || historyError?.message || '';

  return (
    <div
      className="container mx-auto px-4 py-8 min-h-screen bg-gradient-to-br from-amber-50/80 to-teal-50/80 backdrop-blur-sm"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
          <Package className="w-10 h-10 text-amber-600 animate-pulse" />
          {isRtl ? 'المخزون' : 'Inventory'}
        </h1>
        <p className="text-gray-600 mt-2 text-lg">
          {isRtl ? 'إدارة مخزون الفرع بكفاءة' : 'Efficiently manage branch inventory'}
        </p>
      </div>

      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-6 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-4 shadow-md"
        >
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
          <span className="text-red-600 font-medium flex-1">{errorMessage}</span>
          <CustomButton
            onClick={() => refetchInventory()}
            className="bg-red-600 text-white px-5 py-2.5 rounded-full hover:bg-red-700 shadow-sm"
          >
            <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
            {isRtl ? 'إعادة المحاولة' : 'Retry'}
          </CustomButton>
        </motion.div>
      )}

      <div className="flex mb-6 overflow-hidden rounded-full bg-white shadow-lg divide-x divide-gray-200">
        <CustomButton
          onClick={() => setActiveTab('inventory')}
          className={`flex-1 py-3 font-semibold transition-all duration-300 text-lg ${
            activeTab === 'inventory' ? 'bg-amber-600 text-white' : 'text-gray-700 hover:bg-amber-50'
          }`}
        >
          {isRtl ? 'المخزون' : 'Inventory'}
        </CustomButton>
        <CustomButton
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-3 font-semibold transition-all duration-300 text-lg ${
            activeTab === 'history' ? 'bg-amber-600 text-white' : 'text-gray-700 hover:bg-amber-50'
          }`}
        >
          <HistoryIcon className="inline w-5 h-5 mr-2" />
          {isRtl ? 'سجل الحركات' : 'Movement History'}
        </CustomButton>
      </div>

      <CustomCard className="p-6 mb-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative">
            <Search
              className={`absolute top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 ${isRtl ? 'right-4' : 'left-4'}`}
            />
            <CustomInput
              placeholder={isRtl ? 'ابحث بالاسم أو الكود...' : 'Search by name or code...'}
              onChange={handleSearchChange}
              className={`pl-12 pr-4 py-3 border-gray-200 rounded-xl focus:border-amber-500 shadow-inner ${isRtl ? 'pr-12 pl-4' : ''}`}
            />
          </div>
          <CustomSelect
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
            }}
            options={statusOptions}
            label={isRtl ? 'تصفية حسب الحالة' : 'Filter by Status'}
            className="py-3 rounded-xl"
          />
        </div>
      </CustomCard>

      <AnimatePresence mode="wait">
        {activeTab === 'inventory' ? (
          <motion.div
            key="inventory"
            initial={{ opacity: 0, x: isRtl ? -50 : 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRtl ? 50 : -50 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            {inventoryLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <InventoryCardSkeleton key={i} isRtl={isRtl} />
                ))}
              </div>
            ) : paginatedInventory.length === 0 ? (
              <CustomCard className="p-12 text-center bg-white/80 rounded-2xl shadow-lg">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4 animate-bounce" />
                <p className="text-gray-500 text-lg font-medium">{isRtl ? 'لا توجد عناصر في المخزون' : 'No items in inventory'}</p>
              </CustomCard>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence>
                  {paginatedInventory.map((item) => (
                    <motion.div
                      key={item._id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <CustomCard className="p-6 bg-white/90 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300">
                        <div className="flex flex-col gap-3">
                          <div className="flex justify-between items-start">
                            <h3 className="font-bold text-xl text-gray-900 line-clamp-1">{isRtl ? item.product.name : item.product.nameEn}</h3>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              item.status === 'low' ? 'bg-red-100 text-red-600' : item.status === 'full' ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'
                            }`}>
                              {isRtl
                                ? item.status === 'low' ? 'منخفض' : item.status === 'full' ? 'ممتلئ' : 'عادي'
                                : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                            <div>
                              <p className="font-medium">{isRtl ? 'الكود' : 'Code'}</p>
                              <p>{item.product.code}</p>
                            </div>
                            <div>
                              <p className="font-medium">{isRtl ? 'المخزون' : 'Stock'}</p>
                              <p className="text-lg font-bold">{item.currentStock}</p>
                            </div>
                            <div>
                              <p className="font-medium">{isRtl ? 'الحد الأدنى' : 'Min'}</p>
                              <p>{item.minStockLevel}</p>
                            </div>
                            <div>
                              <p className="font-medium">{isRtl ? 'الحد الأقصى' : 'Max'}</p>
                              <p>{item.maxStockLevel}</p>
                            </div>
                            <div>
                              <p className="font-medium">{isRtl ? 'الوحدة' : 'Unit'}</p>
                              <p>{isRtl ? item.product.unit : item.product.unitEn}</p>
                            </div>
                            <div>
                              <p className="font-medium">{isRtl ? 'القسم' : 'Department'}</p>
                              <p>{isRtl ? item.product.department.name : item.product.department.nameEn}</p>
                            </div>
                          </div>
                          <div className="flex gap-3 mt-4">
                            <CustomButton
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOpenEditModal(item)}
                              className="flex-1 py-2.5 rounded-xl text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100"
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              {isRtl ? 'تعديل' : 'Edit'}
                            </CustomButton>
                            <CustomButton
                              variant="destructive"
                              size="sm"
                              disabled={item.currentStock <= 0}
                              onClick={() => handleOpenReturnModal(item)}
                              className="flex-1 py-2.5 rounded-xl text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 disabled:opacity-30"
                            >
                              <X className="w-4 h-4 mr-2" />
                              {isRtl ? 'إرجاع' : 'Return'}
                            </CustomButton>
                          </div>
                        </div>
                      </CustomCard>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
            <Pagination
              totalPages={totalInventoryPages}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              isRtl={isRtl}
            />
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
              <div className="text-center py-16">
                <RefreshCw className="w-16 h-16 text-amber-600 mx-auto animate-spin" />
                <p className="mt-4 text-gray-600">{isRtl ? 'جاري تحميل السجل...' : 'Loading history...'}</p>
              </div>
            ) : paginatedHistory.length === 0 ? (
              <CustomCard className="p-12 text-center bg-white/80 rounded-2xl shadow-lg">
                <HistoryIcon className="w-16 h-16 text-gray-300 mx-auto mb-4 animate-pulse" />
                <p className="text-gray-500 text-lg font-medium">{isRtl ? 'لا توجد حركات سابقة' : 'No previous movements'}</p>
              </CustomCard>
            ) : (
              <CustomCard className="overflow-x-auto bg-white/80 rounded-2xl shadow-lg">
                <table className="w-full text-sm min-w-max">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className={`p-4 text-left ${isRtl ? 'text-right' : ''} font-semibold text-gray-700`}>{isRtl ? 'التاريخ' : 'Date'}</th>
                      <th className={`p-4 text-left ${isRtl ? 'text-right' : ''} font-semibold text-gray-700`}>{isRtl ? 'الإجراء' : 'Action'}</th>
                      <th className={`p-4 text-left ${isRtl ? 'text-right' : ''} font-semibold text-gray-700`}>{isRtl ? 'الكمية' : 'Quantity'}</th>
                      <th className={`p-4 text-left ${isRtl ? 'text-right' : ''} font-semibold text-gray-700`}>{isRtl ? 'المرجع' : 'Reference'}</th>
                      <th className={`p-4 text-left ${isRtl ? 'text-right' : ''} font-semibold text-gray-700`}>{isRtl ? 'بواسطة' : 'By'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedHistory.map((entry: InventoryHistoryItem) => (
                      <tr key={entry._id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 text-gray-600">{new Date(entry.createdAt).toLocaleString()}</td>
                        <td className="p-4">
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-600">
                            {isRtl ? t(`history.${entry.action}`) : entry.action}
                          </span>
                        </td>
                        <td className="p-4 font-medium text-gray-800">{entry.quantity}</td>
                        <td className="p-4 text-gray-600 line-clamp-1">{entry.reference}</td>
                        <td className="p-4 text-gray-600">{entry.createdBy.username}</td>
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
              </CustomCard>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Return Modal */}
      <CustomModal
        isOpen={isReturnModalOpen}
        onClose={() => {
          setIsReturnModalOpen(false);
          setReturnForm({ orderId: '', reason: '', notes: '', items: [] });
          setReturnErrors({});
          setAvailableItems([]);
          setSelectedItem(null);
        }}
        title={isRtl ? 'إنشاء طلب إرجاع' : 'Create Return Request'}
      >
        <div className="flex flex-col gap-6">
          {selectedItem && (
            <div className="bg-amber-50 p-4 rounded-xl flex items-center gap-3">
              <Package className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-gray-700">
                {isRtl ? 'المنتج' : 'Product'}: <span className="font-medium">{isRtl ? selectedItem.product.name : selectedItem.product.nameEn}</span>
              </p>
            </div>
          )}
          <CustomSelect
            label={isRtl ? 'اختر الطلب' : 'Select Order'}
            value={returnForm.orderId}
            onChange={(e) => setReturnForm({ ...returnForm, orderId: e.target.value, items: [] })}
            options={[{ value: '', label: isRtl ? 'اختر طلبًا...' : 'Select an order...' }].concat(
              (ordersData || []).map((order: Order) => ({
                value: order._id,
                label: `${order.orderNumber} (${order.items.length} ${isRtl ? 'عناصر' : 'items'})`,
              }))
            )}
            error={returnErrors.orderId}
          />
          {ordersLoading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <p>{isRtl ? 'جاري تحميل الطلبات...' : 'Loading orders...'}</p>
            </div>
          ) : ordersData.length === 0 ? (
            <div className="bg-yellow-50 p-4 rounded-xl flex items-center gap-3 text-yellow-700">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{isRtl ? 'لا توجد طلبات متاحة للإرجاع' : 'No available orders for return'}</p>
            </div>
          ) : null}
          <CustomSelect
            label={isRtl ? 'سبب الإرجاع العام' : 'General Return Reason'}
            value={returnForm.reason}
            onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })}
            options={[{ value: '', label: isRtl ? 'اختر سبب...' : 'Select reason...' }, ...reasonOptions]}
            error={returnErrors.reason}
          />
          <CustomInput
            label={isRtl ? 'ملاحظات إضافية' : 'Additional Notes'}
            type="text"
            value={returnForm.notes}
            onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
            placeholder={isRtl ? 'أضف تفاصيل إضافية إذا لزم الأمر...' : 'Add extra details if needed...'}
          />
          <div className="bg-gray-50 p-4 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                {isRtl ? 'العناصر المرتجعة' : 'Returned Items'}
              </label>
              <CustomButton
                variant="secondary"
                size="sm"
                onClick={addItemToForm}
                disabled={availableItems.length === 0 || returnForm.orderId === ''}
                className="text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-full px-4 py-1.5"
              >
                <Plus className="w-4 h-4 mr-1" />
                {isRtl ? 'إضافة عنصر' : 'Add Item'}
              </CustomButton>
            </div>
            {returnForm.items.length === 0 && (
              <p className="text-center text-gray-500 py-4">{isRtl ? 'لا توجد عناصر بعد - أضف عنصرًا لبدء الإرجاع' : 'No items yet - add an item to start the return'}</p>
            )}
            <AnimatePresence>
              {returnForm.items.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex gap-3 mb-3 items-start bg-white p-3 rounded-lg shadow-sm"
                >
                  <CustomSelect
                    value={item.itemId}
                    onChange={(e) => updateItemInForm(index, 'itemId', e.target.value)}
                    options={[{ value: '', label: isRtl ? 'اختر عنصر...' : 'Select item...' }].concat(
                      availableItems.map((a) => ({
                        value: a.itemId,
                        label: `${a.productName} (${a.available} ${isRtl ? 'متاح' : 'available'}) - ${a.stock} ${isRtl ? 'في المخزون' : 'in stock'}`,
                      }))
                    )}
                    error={returnErrors[`item_${index}_itemId`]}
                    disabled={!returnForm.orderId}
                    className="flex-1"
                  />
                  <CustomInput
                    type="number"
                    min={1}
                    max={item.maxQuantity ?? 0}
                    value={item.quantity ?? ''}
                    onChange={(e) => updateItemInForm(index, 'quantity', Number(e.target.value))}
                    error={returnErrors[`item_${index}_quantity`]}
                    className="w-24"
                    placeholder={isRtl ? 'كمية' : 'Qty'}
                  />
                  <CustomSelect
                    value={item.reason}
                    onChange={(e) => updateItemInForm(index, 'reason', e.target.value)}
                    options={[{ value: '', label: isRtl ? 'سبب...' : 'Reason...' }, ...reasonOptions]}
                    error={returnErrors[`item_${index}_reason`]}
                    className="flex-1"
                  />
                  <CustomButton
                    variant="danger"
                    size="sm"
                    onClick={() => removeItemFromForm(index)}
                    className="text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 rounded-full p-2"
                  >
                    <X className="w-4 h-4" />
                  </CustomButton>
                </motion.div>
              ))}
            </AnimatePresence>
            {returnErrors.items && <p className="text-red-500 text-sm mt-2 flex items-center gap-1"><AlertTriangle size={14} /> {returnErrors.items}</p>}
          </div>
          <div className="flex justify-end gap-3">
            <CustomButton
              variant="secondary"
              onClick={() => setIsReturnModalOpen(false)}
              className="px-6 py-2.5 rounded-xl"
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </CustomButton>
            <CustomButton
              onClick={() => {
                if (validateReturnForm()) {
                  createReturnMutation.mutate();
                }
              }}
              disabled={createReturnMutation.isPending || availableItems.length === 0}
              className="px-6 py-2.5 rounded-xl flex items-center gap-2"
            >
              {createReturnMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {createReturnMutation.isPending ? (isRtl ? 'جاري الإرسال...' : 'Submitting...') : isRtl ? 'إرسال الطلب' : 'Submit Request'}
            </CustomButton>
          </div>
        </div>
      </CustomModal>

      {/* Edit Stock Levels Modal */}
      <CustomModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={isRtl ? 'تعديل حدود المخزون' : 'Edit Stock Limits'}
      >
        <div className="flex flex-col gap-6">
          {selectedItem && (
            <div className="bg-amber-50 p-4 rounded-xl flex items-center gap-3">
              <Package className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-gray-700">
                {isRtl ? 'المنتج' : 'Product'}: <span className="font-medium">{isRtl ? selectedItem.product.name : selectedItem.product.nameEn}</span>
              </p>
            </div>
          )}
          <CustomInput
            label={isRtl ? 'الحد الأدنى للمخزون' : 'Minimum Stock Level'}
            type="number"
            min={0}
            value={editForm.minStockLevel}
            onChange={(e) => setEditForm({ ...editForm, minStockLevel: Number(e.target.value) })}
            error={editErrors.minStockLevel}
          />
          <CustomInput
            label={isRtl ? 'الحد الأقصى للمخزون' : 'Maximum Stock Level'}
            type="number"
            min={0}
            value={editForm.maxStockLevel}
            onChange={(e) => setEditForm({ ...editForm, maxStockLevel: Number(e.target.value) })}
            error={editErrors.maxStockLevel}
          />
          <div className="flex justify-end gap-3">
            <CustomButton
              variant="secondary"
              onClick={() => setIsEditModalOpen(false)}
              className="px-6 py-2.5 rounded-xl"
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </CustomButton>
            <CustomButton
              onClick={() => {
                if (validateEditForm()) {
                  updateInventoryMutation.mutate();
                }
              }}
              disabled={updateInventoryMutation.isPending}
              className="px-6 py-2.5 rounded-xl flex items-center gap-2"
            >
              {updateInventoryMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {updateInventoryMutation.isPending ? (isRtl ? 'جاري الحفظ...' : 'Saving...') : isRtl ? 'حفظ التغييرات' : 'Save Changes'}
            </CustomButton>
          </div>
        </div>
      </CustomModal>
    </div>
  );
};

export default BranchInventory;