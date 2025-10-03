import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useNotifications } from '../contexts/NotificationContext';
import { inventoryAPI, ordersAPI, returnsAPI } from '../services/api';
import { Package, AlertCircle, Search, RefreshCw, History as HistoryIcon, Edit, X, Plus } from 'lucide-react';
import { debounce } from 'lodash';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface Product {
  _id: string;
  name: string;
  nameEn: string;
  code: string;
  unit: string;
  unitEn: string;
  department: {
    _id: string;
    name: string;
    nameEn: string;
  };
}

interface InventoryItem {
  _id: string;
  product: Product;
  currentStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  status?: 'low' | 'normal' | 'full';
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

interface OrderItem {
  _id: string;
  product: Product;
  quantity: number;
  returnedQuantity?: number;
}

interface Order {
  _id: string;
  orderNumber: string;
  items: OrderItem[];
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

interface AvailableItem {
  itemId: string;
  productId: string;
  productName: string;
  available: number;
  unit: string;
  departmentName: string;
  stock: number;
}

interface CustomCardProps {
  className?: string;
  children: React.ReactNode;
}

interface CustomInputProps {
  label?: string;
  type?: string;
  min?: number;
  max?: number;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  className?: string;
  placeholder?: string;
}

interface CustomButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

interface CustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

interface CustomSelectProps {
  label?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  error?: string;
  disabled?: boolean;
}

interface PaginationProps {
  totalPages: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  isRtl: boolean;
}

const ITEMS_PER_PAGE = 10;

const CustomCard: React.FC<CustomCardProps> = ({ className, children }) => (
  <div className={`bg-white shadow-md rounded-lg ${className}`}>
    {children}
  </div>
);

const CustomInput: React.FC<CustomInputProps> = ({ label, type = 'text', min, max, value, onChange, error, className, placeholder }) => (
  <div className="flex flex-col">
    {label && <label className="text-sm font-medium text-gray-700 mb-1">{label}</label>}
    <input
      type={type}
      min={min}
      max={max}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 ${error ? 'border-red-500' : ''} ${className}`}
    />
    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
  </div>
);

const CustomButton: React.FC<CustomButtonProps> = ({ variant = 'primary', size = 'md', onClick, disabled, className, children }) => {
  let baseClass = 'px-4 py-2 rounded-lg transition-colors duration-200';
  if (variant === 'secondary') baseClass += ' bg-gray-100 hover:bg-gray-200 text-gray-800';
  else if (variant === 'danger') baseClass += ' text-red-600 hover:text-red-800';
  else baseClass += ' bg-amber-600 text-white hover:bg-amber-700';
  if (disabled) baseClass += ' opacity-50 cursor-not-allowed';
  return (
    <button onClick={onClick} disabled={disabled} className={`${baseClass} ${className}`}>
      {children}
    </button>
  );
};

const CustomModal: React.FC<CustomModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <CustomButton onClick={onClose}><X className="w-4 h-4" /></CustomButton>
        </div>
        {children}
      </div>
    </div>
  );
};

const CustomSelect: React.FC<CustomSelectProps> = ({ label, value, onChange, options, error, disabled }) => (
  <div className="flex flex-col">
    {label && <label className="text-sm font-medium text-gray-700 mb-1">{label}</label>}
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={`px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 ${error ? 'border-red-500' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
  </div>
);

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

const Pagination: React.FC<PaginationProps> = ({ totalPages, currentPage, setCurrentPage, isRtl }) => (
  totalPages > 1 && (
    <div className={`flex items-center justify-center gap-3 mt-6 ${isRtl ? 'flex-row-reverse' : ''}`}>
      <CustomButton
        variant="secondary"
        size="md"
        onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
        disabled={currentPage === 1}
        className="disabled:opacity-50 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full px-4 py-2 transition-colors duration-200"
      >
        {isRtl ? 'السابق' : 'Previous'}
      </CustomButton>
      <span className="text-gray-700 font-medium">
        {isRtl ? `الصفحة ${currentPage} من ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
      </span>
      <CustomButton
        variant="secondary"
        size="md"
        onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
        disabled={currentPage === totalPages}
        className="disabled:opacity-50 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full px-4 py-2 transition-colors duration-200"
      >
        {isRtl ? 'التالي' : 'Next'}
      </CustomButton>
    </div>
  )
);

export const BranchInventory: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { socket } = useSocket();
  const { addNotification } = useNotifications();
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
  const [returnErrors, setReturnErrors] = useState<Record<string, string>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);

  const { data: inventoryData, isLoading: inventoryLoading, error: inventoryError, refetch: refetchInventory } = useQuery<InventoryItem[], Error>({
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

  const { data: historyData, isLoading: historyLoading, error: historyError } = useQuery<InventoryHistoryItem[], Error>({
    queryKey: ['inventoryHistory', user?.branchId, language],
    queryFn: () => inventoryAPI.getHistory({ branchId: user?.branchId }),
    enabled: activeTab === 'history' && !!user?.branchId,
  });

  const { data: ordersData, isLoading: ordersLoading } = useQuery<Order[], Error>({
    queryKey: ['orders', user?.branchId, language],
    queryFn: () => ordersAPI.getAll({ branch: user?.branchId, status: 'delivered' }),
    enabled: !!user?.branchId,
    select: (response) => response?.orders || [],
  });

  const { data: selectedOrderData, isLoading: selectedOrderLoading } = useQuery<Order | null, Error>({
    queryKey: ['selectedOrder', returnForm.orderId, language],
    queryFn: () => {
      if (!returnForm.orderId) return Promise.resolve(null);
      return ordersAPI.getById(returnForm.orderId);
    },
    enabled: !!returnForm.orderId,
    onSuccess: (order) => {
      if (order) {
        const items: AvailableItem[] = order.items.map((i) => ({
          itemId: i._id,
          productId: i.product._id,
          productName: isRtl ? i.product.name : i.product.nameEn || i.product.name,
          available: i.quantity - (i.returnedQuantity || 0),
          unit: isRtl ? i.product.unit || t('products.unit_unknown') : i.product.unitEn || i.product.unit || 'N/A',
          departmentName: isRtl ? i.product.department.name : i.product.department.nameEn || i.product.department.name,
          stock: inventoryData?.find((inv) => inv.product._id === i.product._id)?.currentStock || 0,
        })).filter((i) => i.available > 0);
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
            setReturnForm((prev) => ({ ...prev, items: [] }));
            toast.error(isRtl ? 'المنتج غير موجود في الطلب' : 'Product not found in the order');
          }
        } else {
          setReturnForm((prev) => ({ ...prev, items: [] }));
        }
      } else {
        setAvailableItems([]);
        setReturnForm((prev) => ({ ...prev, items: [] }));
      }
    },
  });

  useEffect(() => {
    if (!socket) return;

    socket.on('connect', () => console.log('Socket connected'));
    socket.on('connect_error', (err) => console.error('Socket connect error:', err));
    socket.on('inventoryUpdated', ({ branchId }: { branchId: string }) => {
      if (branchId === user?.branchId) {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        queryClient.invalidateQueries({ queryKey: ['inventoryHistory'] });
      }
    });
    socket.on('returnCreated', ({ branchId, returnId, orderNumber, status }: { branchId: string; returnId: string; orderNumber: string; status: string }) => {
      if (branchId === user?.branchId) {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        queryClient.invalidateQueries({ queryKey: ['inventoryHistory'] });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        addNotification({
          _id: crypto.randomUUID(),
          type: 'success',
          message: t('notifications.return_created', {
            orderNumber,
            branchName: user?.branchId ? t('branches.current') : t('branches.unknown'),
          }),
          data: { returnId, orderId: returnForm.orderId, eventId: crypto.randomUUID() },
          read: false,
          createdAt: new Date().toISOString(),
          sound: '/sounds/notification.mp3',
          vibrate: [400, 100, 400],
        });
      }
    });
    socket.on('returnStatusUpdated', ({ branchId, returnId, status, orderNumber }: { branchId: string; returnId: string; status: string; orderNumber: string }) => {
      if (branchId === user?.branchId) {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        queryClient.invalidateQueries({ queryKey: ['inventoryHistory'] });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        addNotification({
          _id: crypto.randomUUID(),
          type: 'info',
          message: t('notifications.return_status_updated', {
            orderNumber,
            status: t(`returns.${status}`),
            branchName: user?.branchId ? t('branches.current') : t('branches.unknown'),
          }),
          data: { returnId, orderId: returnForm.orderId, eventId: crypto.randomUUID() },
          read: false,
          createdAt: new Date().toISOString(),
          sound: '/sounds/notification.mp3',
          vibrate: [200, 100, 200],
        });
      }
    });

    return () => {
      socket.off('connect');
      socket.off('connect_error');
      socket.off('inventoryUpdated');
      socket.off('returnCreated');
      socket.off('returnStatusUpdated');
    };
  }, [socket, user, queryClient, addNotification, t, returnForm.orderId]);

  const debouncedSearch = useCallback(
    debounce((value: string) => setSearchQuery(value.trim()), 300),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(e.target.value);
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

  const handleOpenReturnModal = (item?: InventoryItem) => {
    setSelectedItem(item || null);
    setReturnForm({ orderId: '', reason: '', notes: '', items: [] });
    setReturnErrors({});
    setAvailableItems([]);
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

  const updateItemInForm = (index: number, field: keyof ReturnItem, value: string | number) => {
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
    const errors: Record<string, string> = {};
    if (!returnForm.orderId) errors.orderId = t('errors.required', { field: t('returns.order') });
    if (!returnForm.reason) errors.reason = t('errors.required', { field: t('returns.reason') });
    if (returnForm.items.length === 0) errors.items = t('errors.required', { field: t('returns.items') });
    returnForm.items.forEach((item, index) => {
      if (!item.itemId) errors[`item_${index}_itemId`] = t('errors.required', { field: t('returns.item') });
      if (!item.reason) errors[`item_${index}_reason`] = t('errors.required', { field: t('returns.reason') });
      if (item.quantity < 1 || item.quantity > item.maxQuantity || isNaN(item.quantity)) {
        errors[`item_${index}_quantity`] = t('errors.invalid_quantity_max', { max: item.maxQuantity });
      }
    });
    setReturnErrors(errors);
    return Object.keys(errors).length === 0;
  }, [returnForm, t]);

  const validateEditForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (editForm.minStockLevel < 0) errors.minStockLevel = t('errors.non_negative', { field: t('inventory.min_stock') });
    if (editForm.maxStockLevel < 0) errors.maxStockLevel = t('errors.non_negative', { field: t('inventory.max_stock') });
    if (editForm.maxStockLevel <= editForm.minStockLevel) errors.maxStockLevel = t('errors.max_greater_min');
    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  }, [editForm, t]);

  const createReturnMutation = useMutation({
    mutationFn: async () => {
      if (!validateReturnForm()) throw new Error(t('errors.invalid_form'));
      const response = await returnsAPI.createReturn({
        orderId: returnForm.orderId,
        reason: returnForm.reason,
        notes: returnForm.notes,
        items: returnForm.items.map((item) => ({
          itemId: item.itemId,
          productId: item.productId,
          quantity: item.quantity,
          reason: item.reason,
        })),
      });
      return response;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryHistory'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setIsReturnModalOpen(false);
      setReturnForm({ orderId: '', reason: '', notes: '', items: [] });
      setReturnErrors({});
      setAvailableItems([]);
      setSelectedItem(null);
      toast.success(t('returns.create_success'));
      socket?.emit('returnCreated', {
        branchId: user?.branchId,
        returnId: response._id,
        orderNumber: ordersData?.find((o) => o._id === returnForm.orderId)?.orderNumber,
        status: 'pending',
        eventId: crypto.randomUUID(),
      });
    },
    onError: (err: any) => {
      const errorMessage = err.message || t('errors.create_return');
      toast.error(errorMessage);
      if (err.status === 400 && err.message.includes('Invalid')) {
        setReturnErrors({ general: errorMessage });
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
      socket?.emit('inventoryUpdated', { branchId: user?.branchId, eventId: crypto.randomUUID() });
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Package className="w-8 h-8 text-amber-600" />
              {isRtl ? 'المخزون' : 'Inventory'}
            </h1>
            <p className="text-gray-600 mt-2">
              {isRtl ? 'إدارة مخزون الفرع' : 'Manage branch inventory'}
            </p>
          </div>
          <CustomButton
            onClick={() => handleOpenReturnModal()}
            className="bg-amber-600 text-white hover:bg-amber-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {isRtl ? 'إنشاء مرتجع' : 'Create Return'}
          </CustomButton>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600">{errorMessage}</span>
          <CustomButton
            onClick={() => refetchInventory()}
            className="ml-4 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {isRtl ? 'إعادة المحاولة' : 'Retry'}
          </CustomButton>
        </div>
      )}

      <div className="flex mb-4 overflow-hidden rounded-full bg-white shadow-md">
        <CustomButton
          onClick={() => setActiveTab('inventory')}
          className={`flex-1 py-2 font-semibold transition-all duration-300 ${
            activeTab === 'inventory' ? 'bg-amber-600 text-white' : 'text-gray-700'
          }`}
        >
          {isRtl ? 'المخزون' : 'Inventory'}
        </CustomButton>
        <CustomButton
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 font-semibold transition-all duration-300 ${
            activeTab === 'history' ? 'bg-amber-600 text-white' : 'text-gray-700'
          }`}
        >
          <HistoryIcon className="inline w-4 h-4 mr-2" />
          {isRtl ? 'سجل الحركات' : 'Movement History'}
        </CustomButton>
      </div>

      <CustomCard className="p-6 mb-6 bg-white rounded-xl shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative">
            <Search
              className={`absolute top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 ${isRtl ? 'right-3' : 'left-3'}`}
            />
            <CustomInput
              placeholder={isRtl ? 'ابحث...' : 'Search...'}
              onChange={handleSearchChange}
              className={`pl-10 pr-4 py-2 border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 ${isRtl ? 'pr-10 pl-4' : ''}`}
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
            transition={{ duration: 0.3 }}
          >
            {inventoryLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <InventoryCardSkeleton key={i} isRtl={isRtl} />
                ))}
              </div>
            ) : paginatedInventory.length === 0 ? (
              <CustomCard className="p-8 text-center bg-white rounded-xl shadow-md">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">{isRtl ? 'لا توجد عناصر' : 'No items'}</p>
              </CustomCard>
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
                      <CustomCard className="p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-shadow">
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
                            <CustomButton
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOpenEditModal(item)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <Edit className="w-4 h-4" />
                            </CustomButton>
                            <CustomButton
                              variant="danger"
                              size="sm"
                              disabled={item.currentStock <= 0}
                              onClick={() => handleOpenReturnModal(item)}
                              className="text-red-600 hover:text-red-800 disabled:opacity-50"
                            >
                              {isRtl ? 'إرجاع' : 'Return'}
                            </CustomButton>
                          </div>
                        </div>
                      </CustomCard>
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
              <CustomCard className="p-8 text-center bg-white rounded-xl shadow-md">
                <HistoryIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">{isRtl ? 'لا توجد حركات' : 'No history'}</p>
              </CustomCard>
            ) : (
              <CustomCard className="p-4 bg-white rounded-xl shadow-md">
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
                    {paginatedHistory.map((entry) => (
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
              </CustomCard>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <CustomModal
        isOpen={isReturnModalOpen}
        onClose={() => {
          setIsReturnModalOpen(false);
          setReturnForm({ orderId: '', reason: '', notes: '', items: [] });
          setReturnErrors({});
          setAvailableItems([]);
          setSelectedItem(null);
        }}
        title={isRtl ? 'إنشاء مرتجع' : 'Create Return'}
      >
        <div className="flex flex-col gap-4">
          {selectedItem && (
            <p className="text-sm text-gray-600">
              {isRtl ? 'المنتج' : 'Product'}: {isRtl ? selectedItem.product.name : selectedItem.product.nameEn}
            </p>
          )}
          <CustomSelect
            label={isRtl ? 'الطلب' : 'Order'}
            value={returnForm.orderId}
            onChange={(e) => {
              setReturnForm({ ...returnForm, orderId: e.target.value, items: [] });
            }}
            options={[{ value: '', label: isRtl ? 'اختر طلبًا' : 'Select Order' }].concat(
              (ordersData || []).map((order) => ({
                value: order._id,
                label: `${order.orderNumber} (${isRtl ? 'تم التوصيل' : 'Delivered'})`,
              }))
            )}
            error={returnErrors.orderId}
            disabled={ordersLoading}
          />
          {selectedOrderLoading && <div className="text-center py-4"><div className="animate-spin rounded-full h-8 w-8 border-t-4 border-b-4 border-amber-600 mx-auto"></div></div>}
          <CustomSelect
            label={isRtl ? 'السبب' : 'Reason'}
            value={returnForm.reason}
            onChange={(e) => {
              setReturnForm({ ...returnForm, reason: e.target.value });
            }}
            options={reasonOptions}
            error={returnErrors.reason}
            disabled={!returnForm.orderId}
          />
          <CustomInput
            label={isRtl ? 'ملاحظات' : 'Notes'}
            value={returnForm.notes}
            onChange={(e) => {
              setReturnForm({ ...returnForm, notes: e.target.value });
            }}
            placeholder={isRtl ? 'أدخل ملاحظات إضافية' : 'Enter additional notes'}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'العناصر' : 'Items'}</label>
            {returnForm.items.map((item, index) => (
              <div key={index} className="flex gap-2 mb-2 items-center">
                <CustomSelect
                  value={item.itemId}
                  onChange={(e) => updateItemInForm(index, 'itemId', e.target.value)}
                  options={[{ value: '', label: isRtl ? 'اختر عنصرًا' : 'Select Item' }].concat(
                    availableItems
                      .filter((a) => !returnForm.items.some((i, idx) => i.itemId === a.itemId && idx !== index))
                      .map((a) => ({
                        value: a.itemId,
                        label: `${a.productName} (${a.available} ${isRtl ? 'متاح' : 'available'})`,
                      }))
                  )}
                  error={returnErrors[`item_${index}_itemId`]}
                  disabled={!returnForm.orderId || selectedOrderLoading}
                />
                <CustomInput
                  type="number"
                  min={1}
                  max={item.maxQuantity}
                  value={item.quantity}
                  onChange={(e) => updateItemInForm(index, 'quantity', Number(e.target.value))}
                  error={returnErrors[`item_${index}_quantity`]}
                  className="w-24"
                  disabled={!item.itemId}
                />
                <CustomSelect
                  value={item.reason}
                  onChange={(e) => updateItemInForm(index, 'reason', e.target.value)}
                  options={reasonOptions}
                  error={returnErrors[`item_${index}_reason`]}
                  disabled={!item.itemId}
                />
                <CustomButton
                  variant="danger"
                  size="sm"
                  onClick={() => removeItemFromForm(index)}
                  className="text-red-600 hover:text-red-800"
                >
                  <X className="w-4 h-4" />
                </CustomButton>
              </div>
            ))}
            {returnErrors.items && <p className="text-red-500 text-sm mt-1">{returnErrors.items}</p>}
            {returnErrors.general && <p className="text-red-500 text-sm mt-1">{returnErrors.general}</p>}
            <CustomButton
              variant="secondary"
              onClick={addItemToForm}
              className="mt-2 bg-gray-100 hover:bg-gray-200 text-gray-800"
              disabled={!returnForm.orderId || selectedOrderLoading || availableItems.length === 0 || availableItems.length === returnForm.items.length}
            >
              <Plus className="w-4 h-4 mr-2" />
              {isRtl ? 'إضافة عنصر' : 'Add Item'}
            </CustomButton>
          </div>
          <div className="flex justify-end gap-2">
            <CustomButton
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
            </CustomButton>
            <CustomButton
              onClick={() => createReturnMutation.mutate()}
              disabled={createReturnMutation.isPending || !returnForm.orderId || selectedOrderLoading}
              className="bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {createReturnMutation.isPending ? (isRtl ? 'جاري...' : 'Submitting...') : isRtl ? 'إرسال' : 'Submit'}
            </CustomButton>
          </div>
        </div>
      </CustomModal>

      <CustomModal
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
          <CustomInput
            label={isRtl ? 'الحد الأدنى للمخزون' : 'Minimum Stock Level'}
            type="number"
            min={0}
            value={editForm.minStockLevel}
            onChange={(e) => {
              setEditForm({ ...editForm, minStockLevel: Number(e.target.value) });
            }}
            error={editErrors.minStockLevel}
          />
          <CustomInput
            label={isRtl ? 'الحد الأقصى للمخزون' : 'Maximum Stock Level'}
            type="number"
            min={0}
            value={editForm.maxStockLevel}
            onChange={(e) => {
              setEditForm({ ...editForm, maxStockLevel: Number(e.target.value) });
            }}
            error={editErrors.maxStockLevel}
          />
          <div className="flex justify-end gap-2">
            <CustomButton
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
            </CustomButton>
            <CustomButton
              onClick={() => updateInventoryMutation.mutate()}
              disabled={updateInventoryMutation.isPending}
              className="bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {updateInventoryMutation.isPending ? (isRtl ? 'جاري...' : 'Saving...') : isRtl ? 'حفظ' : 'Save'}
            </CustomButton>
          </div>
        </div>
      </CustomModal>
    </div>
  );
};

export default BranchInventory;