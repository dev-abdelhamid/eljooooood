import React, { useState, useMemo, useCallback, useEffect, useReducer } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useNotifications } from '../contexts/NotificationContext';
import { ordersAPI, inventoryAPI } from '../services/api';
import { Package, AlertCircle, Search, RefreshCw, Edit, X, Plus, Eye, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// Enums for type safety
enum InventoryStatus {
  LOW = 'low',
  NORMAL = 'normal',
  FULL = 'full',
}

enum ReturnReason {
  QUALITY_ISSUE = 'quality_issue',
  WRONG_ITEM = 'wrong_item',
  EXCESS_QUANTITY = 'excess_quantity',
  OTHER = 'other',
}

enum PeriodFilter {
  ALL = '',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

// Interfaces aligned with backend
interface InventoryItem {
  _id: string;
  product: {
    _id: string;
    name: string;
    nameEn: string;
    code: string;
    unit: string;
    unitEn: string;
    department: { _id: string; name: string; nameEn: string } | null;
  } | null;
  branch: { _id: string; name: string; nameEn: string } | null;
  currentStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  status: InventoryStatus;
}

interface ReturnItem {
  itemId: string;
  productId: string;
  orderId: string;
  quantity: number;
  reason: string;
  maxQuantity: number;
}

interface ReturnFormState {
  reason: string;
  notes: string;
  items: ReturnItem[];
}

interface ProductHistoryEntry {
  _id: string;
  product: { _id: string; name: string; nameEn: string; unit: string; unitEn: string; department: { _id: string; name: string; nameEn: string } | null };
  branch: { _id: string; name: string; nameEn: string };
  action: 'restock' | 'adjustment' | 'settings_adjustment';
  quantity: number;
  reference: string;
  createdAt: string;
}

interface EditForm {
  minStockLevel: number;
  maxStockLevel: number;
}

interface AvailableItem {
  productId: string;
  productName: string;
  available: number;
  unit: string;
  departmentName: string;
  stock: number;
}

interface Order {
  _id: string;
  orderNumber: string;
  items: Array<{ itemId: string; productId: string; quantity: number; remainingQuantity: number }>;
}

// Reducer for return form
type ReturnFormAction =
  | { type: 'SET_REASON'; payload: string }
  | { type: 'SET_NOTES'; payload: string }
  | { type: 'ADD_ITEM'; payload: ReturnItem }
  | { type: 'UPDATE_ITEM'; payload: { index: number; field: keyof ReturnItem; value: string | number } }
  | { type: 'REMOVE_ITEM'; payload: number }
  | { type: 'RESET' };

const returnFormReducer = (state: ReturnFormState, action: ReturnFormAction): ReturnFormState => {
  switch (action.type) {
    case 'SET_REASON':
      return { ...state, reason: action.payload };
    case 'SET_NOTES':
      return { ...state, notes: action.payload };
    case 'ADD_ITEM':
      return { ...state, items: [...state.items, action.payload] };
    case 'UPDATE_ITEM':
      const newItems = [...state.items];
      newItems[action.payload.index] = { ...newItems[action.payload.index], [action.payload.field]: action.payload.value };
      return { ...state, items: newItems };
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter((_, i) => i !== action.payload) };
    case 'RESET':
      return { reason: '', notes: '', items: [] };
    default:
      return state;
  }
};

// Custom Components
interface CustomCardProps {
  className?: string;
  children: React.ReactNode;
}

interface CustomInputProps {
  label?: string;
  type?: string;
  min?: number;
  max?: number;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
}

interface CustomButtonProps {
  variant?: 'primary' | 'secondary' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
}

interface CustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

interface CustomSelectProps {
  label?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: Array<{ value: string; label: string }>;
  error?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

interface PaginationProps {
  totalPages: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  isRtl: boolean;
}

const ITEMS_PER_PAGE = 10;

const CustomCard: React.FC<CustomCardProps> = ({ className, children }) => (
  <div className={`bg-white shadow-md rounded-xl p-4 ${className}`} role="region" aria-label="Card">
    {children}
  </div>
);

const CustomInput: React.FC<CustomInputProps> = ({ label, type = 'text', min, max, value, onChange, error, className, placeholder, ariaLabel }) => (
  <div className="flex flex-col">
    {label && <label className="text-sm font-medium text-gray-700 mb-1">{label}</label>}
    <input
      type={type}
      min={min}
      max={max}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      aria-label={ariaLabel || label || placeholder}
      className={`px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm ${error ? 'border-red-500' : ''} ${className}`}
    />
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
);

const CustomButton: React.FC<CustomButtonProps> = ({ variant = 'primary', size = 'md', onClick, disabled, className, children, ariaLabel }) => {
  const baseClass = `px-4 py-2 rounded-lg transition-colors duration-200 font-medium ${
    size === 'sm' ? 'text-xs px-3 py-1' : size === 'lg' ? 'text-base px-6 py-3' : 'text-sm'
  }`;
  const variantClass =
    variant === 'secondary'
      ? 'bg-gray-100 hover:bg-gray-200 text-gray-800'
      : variant === 'destructive'
      ? 'text-red-600 hover:text-red-800'
      : 'bg-amber-600 text-white hover:bg-amber-700';
  const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : '';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`${baseClass} ${variantClass} ${disabledClass} ${className}`}
    >
      {children}
    </button>
  );
};

const CustomModal: React.FC<CustomModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-white p-6 rounded-xl shadow-xl max-w-[90vw] sm:max-w-2xl w-full max-h-[80vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <CustomButton onClick={onClose} variant="secondary" size="sm" ariaLabel={isRtl ? 'إغلاق النافذة' : 'Close modal'}>
            <X className="w-4 h-4" />
          </CustomButton>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
};

const CustomSelect: React.FC<CustomSelectProps> = ({ label, value, onChange, options, error, disabled, ariaLabel }) => (
  <div className="flex flex-col">
    {label && <label className="text-sm font-medium text-gray-700 mb-1">{label}</label>}
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      aria-label={ariaLabel || label}
      className={`px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm ${
        error ? 'border-red-500' : ''
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
);

const InventoryCardSkeleton: React.FC<{ isRtl: boolean }> = ({ isRtl }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className="p-4 mb-4 bg-white shadow-md rounded-xl border border-gray-200"
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
        ariaLabel={isRtl ? 'الصفحة السابقة' : 'Previous page'}
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
        ariaLabel={isRtl ? 'الصفحة التالية' : 'Next page'}
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
  const [filterStatus, setFilterStatus] = useState<InventoryStatus | ''>('');
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [filterPeriod, setFilterPeriod] = useState<PeriodFilter | ''>('');
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [returnForm, dispatchReturnForm] = useReducer(returnFormReducer, { reason: '', notes: '', items: [] });
  const [editForm, setEditForm] = useState<EditForm>({ minStockLevel: 0, maxStockLevel: 0 });
  const [returnErrors, setReturnErrors] = useState<Record<string, string>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [possibleOrders, setPossibleOrders] = useState<Record<string, { value: string; label: string; remaining: number; itemId: string }[]>>({});

  // Debounce search input
  const useDebouncedState = <T,>(initialValue: T, delay: number) => {
    const [value, setValue] = useState<T>(initialValue);
    const [debouncedValue, setDebouncedValue] = useState<T>(initialValue);
    useEffect(() => {
      const handler = setTimeout(() => setDebouncedValue(value), delay);
      return () => clearTimeout(handler);
    }, [value, delay]);
    return [value, setValue, debouncedValue] as const;
  };

  const [searchInput, setSearchInput, debouncedSearchQuery] = useDebouncedState<string>('', 300);

  // Fetch inventory data
  const { data: inventoryData, isLoading: inventoryLoading, error: inventoryError, refetch: refetchInventory } = useQuery<
    InventoryItem[],
    Error
  >({
    queryKey: ['inventory', user?.branchId, debouncedSearchQuery, filterStatus, filterDepartment, currentPage, language],
    queryFn: async () => {
      if (!user?.branchId) throw new Error(t('errors.no_branch'));
      const response = await inventoryAPI.getByBranch(user.branchId, { department: filterDepartment, search: debouncedSearchQuery });
      return response;
    },
    enabled: !!user?.branchId,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    select: (response) => {
      let inventory = Array.isArray(response) ? response : response?.inventory || [];
      if (debouncedSearchQuery) {
        inventory = inventory.filter((item: InventoryItem) =>
          item.product?.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
          item.product?.nameEn.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
          item.product?.code.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
        );
      }
      if (filterStatus) {
        inventory = inventory.filter((item: InventoryItem) => item.status === filterStatus);
      }
      return inventory.map((item: InventoryItem) => ({
        ...item,
        product: item.product
          ? {
              _id: item.product._id || '',
              name: item.product.name || t('products.unknown'),
              nameEn: item.product.nameEn || item.product.name || t('products.unknown'),
              code: item.product.code || 'N/A',
              unit: item.product.unit || t('products.unit_unknown'),
              unitEn: item.product.unitEn || item.product.unit || 'N/A',
              department: item.product.department
                ? {
                    _id: item.product.department._id || '',
                    name: item.product.department.name || t('departments.unknown'),
                    nameEn: item.product.department.nameEn || item.product.department.name || t('departments.unknown'),
                  }
                : null,
            }
          : null,
        branch: item.branch
          ? {
              _id: item.branch._id || '',
              name: item.branch.name || t('branches.unknown'),
              nameEn: item.branch.nameEn || item.branch.name || t('branches.unknown'),
            }
          : null,
        status:
          item.currentStock <= item.minStockLevel
            ? InventoryStatus.LOW
            : item.currentStock >= item.maxStockLevel
            ? InventoryStatus.FULL
            : InventoryStatus.NORMAL,
      }));
    },
    onError: (err) => {
      toast.error(err.message || t('errors.fetch_inventory'), { position: 'top-right', autoClose: 3000 });
    },
  });

  // Fetch product history
  const { data: productHistory, isLoading: historyLoading } = useQuery<ProductHistoryEntry[], Error>({
    queryKey: ['productHistory', selectedProductId, user?.branchId, filterPeriod, language],
    queryFn: async () => {
      if (!selectedProductId || !user?.branchId) throw new Error(t('errors.no_branch'));
      return inventoryAPI.getHistory({ productId: selectedProductId, branchId: user.branchId, period: filterPeriod });
    },
    enabled: isDetailsModalOpen && !!selectedProductId && !!user?.branchId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch orders for return form
  const { data: ordersData } = useQuery<Order[], Error>({
    queryKey: ['orders', user?.branchId, selectedItem?._id],
    queryFn: async () => {
      if (!user?.branchId || !selectedItem?.product?._id) return [];
      return ordersAPI.getAll({ branch: user.branchId, status: 'delivered' });
    },
    enabled: isReturnModalOpen && !!user?.branchId && !!selectedItem?.product?._id,
    select: (response) => {
      const orders = Array.isArray(response) ? response : response?.data || [];
      return orders.filter((order) =>
        order.items.some((item) => item.productId === selectedItem?.product?._id && item.remainingQuantity > 0)
      );
    },
  });

  // Department options
  const departmentOptions = useMemo(() => {
    const depts = new Set<string>();
    inventoryData?.forEach((item) => {
      if (item.product?.department?._id) {
        const dept = {
          _id: item.product.department._id,
          name: isRtl ? item.product.department.name : item.product.department.nameEn,
        };
        depts.add(JSON.stringify(dept));
      }
    });
    const uniqueDepts = Array.from(depts).map((d) => JSON.parse(d));
    return [
      { value: '', label: t('common.all_departments') },
      ...uniqueDepts.map((dept) => ({ value: dept._id, label: dept.name })),
    ];
  }, [inventoryData, isRtl, t]);

  // Period options
  const periodOptions = useMemo(
    () => [
      { value: PeriodFilter.ALL, label: t('common.all_periods') },
      { value: PeriodFilter.DAILY, label: t('common.daily') },
      { value: PeriodFilter.WEEKLY, label: t('common.weekly') },
      { value: PeriodFilter.MONTHLY, label: t('common.monthly') },
    ],
    [t]
  );

  // Status options
  const statusOptions = useMemo(
    () => [
      { value: '', label: t('common.all_statuses') },
      { value: InventoryStatus.LOW, label: t('inventory.low_stock') },
      { value: InventoryStatus.NORMAL, label: t('inventory.normal_stock') },
      { value: InventoryStatus.FULL, label: t('inventory.full_stock') },
    ],
    [t]
  );

  // Return reason options
  const returnReasonOptions = useMemo(
    () => [
      { value: ReturnReason.QUALITY_ISSUE, label: t('returns.quality_issue') },
      { value: ReturnReason.WRONG_ITEM, label: t('returns.wrong_item') },
      { value: ReturnReason.EXCESS_QUANTITY, label: t('returns.excess_quantity') },
      { value: ReturnReason.OTHER, label: t('returns.other') },
    ],
    [t]
  );

  // Update available items and possible orders
  useEffect(() => {
    if (isReturnModalOpen && selectedItem?.product?._id && ordersData) {
      const items: AvailableItem[] = [];
      const orderOptions: Record<string, { value: string; label: string; remaining: number; itemId: string }[]> = {};
      ordersData.forEach((order) => {
        order.items.forEach((item) => {
          if (item.productId === selectedItem.product?._id && item.remainingQuantity > 0) {
            items.push({
              productId: item.productId,
              productName: isRtl ? selectedItem.product?.name || '' : selectedItem.product?.nameEn || '',
              available: item.remainingQuantity,
              unit: isRtl ? selectedItem.product?.unit || '' : selectedItem.product?.unitEn || '',
              departmentName: isRtl
                ? selectedItem.product?.department?.name || ''
                : selectedItem.product?.department?.nameEn || '',
              stock: selectedItem.currentStock,
            });
            if (!orderOptions[item.productId]) {
              orderOptions[item.productId] = [];
            }
            orderOptions[item.productId].push({
              value: order._id,
              label: `${t('orders.order')} #${order.orderNumber}`,
              remaining: item.remainingQuantity,
              itemId: item.itemId,
            });
          }
        });
      });
      setAvailableItems(items);
      setPossibleOrders(orderOptions);
    }
  }, [isReturnModalOpen, selectedItem, ordersData, isRtl, t]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !user?.branchId) return;

    const handleInventoryUpdated = (data: { branchId: string; productId: string; quantity: number; type: string }) => {
      if (data.branchId === user.branchId) {
        queryClient.invalidateQueries(['inventory', user.branchId]);
        addNotification({
          id: `inventory-update-${data.productId}`,
          message: t('notifications.inventory_updated', { productId: data.productId, quantity: data.quantity }),
          type: 'info',
        });
      }
    };

    const handleRestockRequested = (data: { requestId: string; branchId: string; productId: string; requestedQuantity: number }) => {
      if (data.branchId === user.branchId) {
        addNotification({
          id: `restock-request-${data.requestId}`,
          message: t('notifications.restock_requested', { productId: data.productId, quantity: data.requestedQuantity }),
          type: 'info',
        });
      }
    };

    socket.on('inventoryUpdated', handleInventoryUpdated);
    socket.on('restockRequested', handleRestockRequested);

    return () => {
      socket.off('inventoryUpdated', handleInventoryUpdated);
      socket.off('restockRequested', handleRestockRequested);
    };
  }, [socket, user?.branchId, queryClient, addNotification, t]);

  // Mutations
  const updateStockMutation = useMutation({
    mutationFn: (data: { id: string; minStockLevel: number; maxStockLevel: number }) =>
      inventoryAPI.updateStock(data.id, { minStockLevel: data.minStockLevel, maxStockLevel: data.maxStockLevel }),
    onSuccess: () => {
      queryClient.invalidateQueries(['inventory', user?.branchId]);
      setIsEditModalOpen(false);
      setSelectedItem(null);
      setEditForm({ minStockLevel: 0, maxStockLevel: 0 });
      setEditErrors({});
      toast.success(t('inventory.update_success'), { position: 'top-right', autoClose: 3000 });
    },
    onError: (error: any) => {
      toast.error(error.message || t('errors.update_inventory'), { position: 'top-right', autoClose: 3000 });
    },
  });

  const createReturnMutation = useMutation({
    mutationFn: (data: { orderId: string; branchId: string; reason: string; items: ReturnItem[]; notes?: string }) =>
      inventoryAPI.createReturn(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['inventory', user?.branchId]);
      setIsReturnModalOpen(false);
      setSelectedItem(null);
      dispatchReturnForm({ type: 'RESET' });
      setReturnErrors({});
      toast.success(t('returns.create_success'), { position: 'top-right', autoClose: 3000 });
    },
    onError: (error: any) => {
      toast.error(error.message || t('errors.create_return'), { position: 'top-right', autoClose: 3000 });
    },
  });

  // Handlers
  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    setCurrentPage(1);
  }, []);

  const handleFilterStatus = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterStatus(e.target.value as InventoryStatus | '');
    setCurrentPage(1);
  }, []);

  const handleFilterDepartment = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterDepartment(e.target.value);
    setCurrentPage(1);
  }, []);

  const handleFilterPeriod = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterPeriod(e.target.value as PeriodFilter | '');
  }, []);

  const handleOpenReturnModal = useCallback((item: InventoryItem) => {
    setSelectedItem(item);
    setIsReturnModalOpen(true);
    dispatchReturnForm({ type: 'RESET' });
  }, []);

  const handleOpenEditModal = useCallback((item: InventoryItem) => {
    setSelectedItem(item);
    setEditForm({
      minStockLevel: item.minStockLevel,
      maxStockLevel: item.maxStockLevel,
    });
    setIsEditModalOpen(true);
  }, []);

  const handleOpenDetailsModal = useCallback((item: InventoryItem) => {
    setSelectedItem(item);
    setSelectedProductId(item.product?._id || '');
    setIsDetailsModalOpen(true);
  }, []);

  const handleAddReturnItem = useCallback(() => {
    if (!selectedItem?.product?._id) return;
    dispatchReturnForm({
      type: 'ADD_ITEM',
      payload: {
        itemId: '',
        productId: selectedItem.product._id,
        orderId: '',
        quantity: 1,
        reason: ReturnReason.QUALITY_ISSUE,
        maxQuantity: availableItems.find((item) => item.productId === selectedItem.product._id)?.available || 0,
      },
    });
  }, [selectedItem, availableItems]);

  const handleUpdateReturnItem = useCallback((index: number, field: keyof ReturnItem, value: string | number) => {
    dispatchReturnForm({ type: 'UPDATE_ITEM', payload: { index, field, value } });
  }, []);

  const handleRemoveReturnItem = useCallback((index: number) => {
    dispatchReturnForm({ type: 'REMOVE_ITEM', payload: index });
  }, []);

  const handleSubmitReturn = useCallback(() => {
    if (!selectedItem?.product?._id || !user?.branchId || !user?.id) return;

    const errors: Record<string, string> = {};
    if (!returnForm.reason) {
      errors.reason = t('returns.reason_required');
    }
    if (returnForm.items.length === 0) {
      errors.items = t('returns.items_required');
    }
    returnForm.items.forEach((item, index) => {
      if (!item.orderId) {
        errors[`orderId_${index}`] = t('returns.order_required');
      }
      if (item.quantity < 1 || item.quantity > item.maxQuantity) {
        errors[`quantity_${index}`] = t('returns.invalid_quantity');
      }
    });

    if (Object.keys(errors).length > 0) {
      setReturnErrors(errors);
      return;
    }

    createReturnMutation.mutate({
      orderId: returnForm.items[0].orderId,
      branchId: user.branchId,
      reason: returnForm.reason,
      items: returnForm.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        reason: item.reason,
      })),
      notes: returnForm.notes,
    });
  }, [returnForm, selectedItem, user, t, createReturnMutation]);

  const handleSubmitEdit = useCallback(() => {
    if (!selectedItem?._id) return;

    const errors: Record<string, string> = {};
    if (editForm.minStockLevel < 0) {
      errors.minStockLevel = t('inventory.min_stock_invalid');
    }
    if (editForm.maxStockLevel < editForm.minStockLevel) {
      errors.maxStockLevel = t('inventory.max_stock_invalid');
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    updateStockMutation.mutate({
      id: selectedItem._id,
      minStockLevel: editForm.minStockLevel,
      maxStockLevel: editForm.maxStockLevel,
    });
  }, [editForm, selectedItem, t, updateStockMutation]);

  // Pagination
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return inventoryData?.slice(start, end) || [];
  }, [inventoryData, currentPage]);

  const totalPages = useMemo(() => Math.ceil((inventoryData?.length || 0) / ITEMS_PER_PAGE), [inventoryData]);

  return (
    <div className={`container mx-auto p-4 ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('inventory.title')}</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <CustomInput
            placeholder={t('common.search')}
            value={searchInput}
            onChange={handleSearch}
            ariaLabel={t('common.search')}
            className="w-full"
            type="text"
          />
        </div>
        <CustomSelect
          value={filterStatus}
          onChange={handleFilterStatus}
          options={statusOptions}
          ariaLabel={t('inventory.filter_status')}
          className="w-full sm:w-48"
        />
        <CustomSelect
          value={filterDepartment}
          onChange={handleFilterDepartment}
          options={departmentOptions}
          ariaLabel={t('inventory.filter_department')}
          className="w-full sm:w-48"
        />
        <CustomButton
          variant="secondary"
          size="md"
          onClick={() => refetchInventory()}
          ariaLabel={t('common.refresh')}
        >
          <RefreshCw className="w-4 h-4" />
        </CustomButton>
      </div>

      {/* Inventory List */}
      {inventoryLoading ? (
        <div>
          {Array.from({ length: 5 }).map((_, index) => (
            <InventoryCardSkeleton key={index} isRtl={isRtl} />
          ))}
        </div>
      ) : inventoryError ? (
        <div className="text-red-500 text-center">{t('errors.fetch_inventory')}</div>
      ) : paginatedItems.length === 0 ? (
        <div className="text-center text-gray-500">{t('inventory.no_items')}</div>
      ) : (
        <AnimatePresence>
          {paginatedItems.map((item) => (
            <motion.div
              key={item._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <CustomCard className="mb-4">
                <div className={`flex ${isRtl ? 'flex-row-reverse' : ''} items-center justify-between`}>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {isRtl ? item.product?.name : item.product?.nameEn}
                    </h3>
                    <p className="text-sm text-gray-500">{t('inventory.code')}: {item.product?.code}</p>
                    <p className="text-sm text-gray-500">
                      {t('inventory.department')}: {isRtl ? item.product?.department?.name : item.product?.department?.nameEn}
                    </p>
                    <p className="text-sm text-gray-500">
                      {t('inventory.current_stock')}: {item.currentStock} {isRtl ? item.product?.unit : item.product?.unitEn}
                    </p>
                    <p className="text-sm text-gray-500">
                      {t('inventory.min_stock')}: {item.minStockLevel}
                    </p>
                    <p className="text-sm text-gray-500">
                      {t('inventory.max_stock')}: {item.maxStockLevel}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                        item.status === InventoryStatus.LOW
                          ? 'bg-red-100 text-red-800'
                          : item.status === InventoryStatus.FULL
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {t(`inventory.status_${item.status}`)}
                    </span>
                    <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <CustomButton
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenDetailsModal(item)}
                        ariaLabel={t('inventory.view_details')}
                      >
                        <Eye className="w-4 h-4" />
                      </CustomButton>
                      <CustomButton
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenEditModal(item)}
                        ariaLabel={t('inventory.edit')}
                      >
                        <Edit className="w-4 h-4" />
                      </CustomButton>
                      <CustomButton
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenReturnModal(item)}
                        ariaLabel={t('inventory.request_return')}
                      >
                        <Package className="w-4 h-4" />
                      </CustomButton>
                    </div>
                  </div>
                </div>
              </CustomCard>
            </motion.div>
          ))}
        </AnimatePresence>
      )}

      {/* Pagination */}
      <Pagination totalPages={totalPages} currentPage={currentPage} setCurrentPage={setCurrentPage} isRtl={isRtl} />

      {/* Return Modal */}
      <CustomModal
        isOpen={isReturnModalOpen}
        onClose={() => {
          setIsReturnModalOpen(false);
          setSelectedItem(null);
          dispatchReturnForm({ type: 'RESET' });
          setReturnErrors({});
        }}
        title={t('returns.create_title')}
      >
        <div className="space-y-4">
          <CustomSelect
            label={t('returns.reason')}
            value={returnForm.reason}
            onChange={(e) => dispatchReturnForm({ type: 'SET_REASON', payload: e.target.value })}
            options={returnReasonOptions}
            error={returnErrors.reason}
            ariaLabel={t('returns.reason')}
          />
          <CustomInput
            label={t('returns.notes')}
            value={returnForm.notes}
            onChange={(e) => dispatchReturnForm({ type: 'SET_NOTES', payload: e.target.value })}
            placeholder={t('returns.notes_placeholder')}
            ariaLabel={t('returns.notes')}
          />
          <div className="space-y-2">
            <h3 className="text-sm font-medium">{t('returns.items')}</h3>
            {returnForm.items.map((item, index) => (
              <div key={index} className={`flex gap-2 ${isRtl ? 'flex-row-reverse' : ''} items-center`}>
                <CustomSelect
                  value={item.orderId}
                  onChange={(e) => handleUpdateReturnItem(index, 'orderId', e.target.value)}
                  options={possibleOrders[selectedItem?.product?._id || ''] || []}
                  error={returnErrors[`orderId_${index}`]}
                  ariaLabel={t('returns.order')}
                  className="flex-1"
                />
                <CustomInput
                  type="number"
                  min={1}
                  max={item.maxQuantity}
                  value={item.quantity}
                  onChange={(e) => handleUpdateReturnItem(index, 'quantity', parseInt(e.target.value) || 1)}
                  error={returnErrors[`quantity_${index}`]}
                  ariaLabel={t('returns.quantity')}
                  className="w-24"
                />
                <CustomButton
                  variant="destructive"
                  size="sm"
                  onClick={() => handleRemoveReturnItem(index)}
                  ariaLabel={t('returns.remove_item')}
                >
                  <X className="w-4 h-4" />
                </CustomButton>
              </div>
            ))}
            <CustomButton
              variant="secondary"
              size="sm"
              onClick={handleAddReturnItem}
              disabled={!availableItems.length}
              ariaLabel={t('returns.add_item')}
            >
              <Plus className="w-4 h-4 mr-2" /> {t('returns.add_item')}
            </CustomButton>
            {returnErrors.items && <p className="text-red-500 text-xs">{returnErrors.items}</p>}
          </div>
          <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <CustomButton onClick={handleSubmitReturn} disabled={createReturnMutation.isLoading}>
              {t('common.submit')}
            </CustomButton>
            <CustomButton
              variant="secondary"
              onClick={() => {
                setIsReturnModalOpen(false);
                setSelectedItem(null);
                dispatchReturnForm({ type: 'RESET' });
                setReturnErrors({});
              }}
            >
              {t('common.cancel')}
            </CustomButton>
          </div>
        </div>
      </CustomModal>

      {/* Edit Modal */}
      <CustomModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedItem(null);
          setEditForm({ minStockLevel: 0, maxStockLevel: 0 });
          setEditErrors({});
        }}
        title={t('inventory.edit_title')}
      >
        <div className="space-y-4">
          <CustomInput
            label={t('inventory.min_stock')}
            type="number"
            min={0}
            value={editForm.minStockLevel}
            onChange={(e) => setEditForm({ ...editForm, minStockLevel: parseInt(e.target.value) || 0 })}
            error={editErrors.minStockLevel}
            ariaLabel={t('inventory.min_stock')}
          />
          <CustomInput
            label={t('inventory.max_stock')}
            type="number"
            min={0}
            value={editForm.maxStockLevel}
            onChange={(e) => setEditForm({ ...editForm, maxStockLevel: parseInt(e.target.value) || 0 })}
            error={editErrors.maxStockLevel}
            ariaLabel={t('inventory.max_stock')}
          />
          <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <CustomButton onClick={handleSubmitEdit} disabled={updateStockMutation.isLoading}>
              {t('common.submit')}
            </CustomButton>
            <CustomButton
              variant="secondary"
              onClick={() => {
                setIsEditModalOpen(false);
                setSelectedItem(null);
                setEditForm({ minStockLevel: 0, maxStockLevel: 0 });
                setEditErrors({});
              }}
            >
              {t('common.cancel')}
            </CustomButton>
          </div>
        </div>
      </CustomModal>

      {/* Details Modal */}
      <CustomModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedItem(null);
          setSelectedProductId('');
          setFilterPeriod('');
        }}
        title={t('inventory.history_title')}
      >
        <div className="space-y-4">
          <CustomSelect
            label={t('inventory.filter_period')}
            value={filterPeriod}
            onChange={handleFilterPeriod}
            options={periodOptions}
            ariaLabel={t('inventory.filter_period')}
          />
          {historyLoading ? (
            <div className="text-center">{t('common.loading')}</div>
          ) : productHistory?.length === 0 ? (
            <div className="text-center text-gray-500">{t('inventory.no_history')}</div>
          ) : (
            <div className="space-y-2">
              {productHistory?.map((entry) => (
                <CustomCard key={entry._id} className="p-3">
                  <div className={`flex ${isRtl ? 'flex-row-reverse' : ''} justify-between text-sm`}>
                    <div>
                      <p>
                        <strong>{t('inventory.date')}:</strong> {new Date(entry.createdAt).toLocaleString()}
                      </p>
                      <p>
                        <strong>{t('inventory.action')}:</strong> {t(`inventory.action_${entry.action}`)}
                      </p>
                      <p>
                        <strong>{t('inventory.quantity')}:</strong> {entry.quantity} {isRtl ? entry.product.unit : entry.product.unitEn}
                      </p>
                    </div>
                    <div>
                      <p>
                        <strong>{t('inventory.reference')}:</strong> {entry.reference}
                      </p>
                    </div>
                  </div>
                </CustomCard>
              ))}
            </div>
          )}
        </div>
      </CustomModal>
    </div>
  );
};