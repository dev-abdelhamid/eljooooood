import React, { useState, useMemo, useCallback, useEffect, useReducer } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useNotifications } from '../contexts/NotificationContext';
import { inventoryAPI } from '../services/inventoryAPI';
import { returnsAPI } from '../services/returnsAPI';
import { ordersAPI } from '../services/api';
import { Package, AlertCircle, Search, RefreshCw, Edit, X, Plus, Eye } from 'lucide-react';
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
  branchId: string;
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
  date: string;
  type: 'addition' | 'return' | 'sale' | 'adjustment';
  quantity: number;
  description: string;
  orderId?: string;
  returnId?: string;
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
  <div className={`bg-white shadow-md rounded-lg p-4 ${className}`} role="region" aria-label="Card">
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
        className="bg-white p-6 rounded-lg shadow-xl max-w-[90vw] sm:max-w-2xl w-full max-h-[80vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <CustomButton onClick={onClose} variant="secondary" size="sm" ariaLabel="Close modal">
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
  const { user, isLoading: authLoading } = useAuth();
  const { socket } = useSocket();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<InventoryStatus | ''>('');
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

  // Custom debounce hook for search
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

  // Invalidate queries on language change
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
  }, [language, queryClient]);

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-6 min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-600">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          {t('common.loading')}
        </div>
      </div>
    );
  }

  if (!user || !user._id) {
    return (
      <div className="container mx-auto px-4 py-6 min-h-screen flex items-center justify-center">
        <p className="text-red-600">{t('errors.no_user')}</p>
      </div>
    );
  }

  const { data: inventoryData, isLoading: inventoryLoading, error: inventoryError, refetch: refetchInventory } = useQuery<
    InventoryItem[],
    Error
  >({
    queryKey: ['inventory', user.branchId, debouncedSearchQuery, filterStatus, currentPage, language],
    queryFn: async () => {
      if (!user.branchId) throw new Error(t('errors.no_branch'));
      return inventoryAPI.getByBranch(user.branchId, language);
    },
    enabled: !!user.branchId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    select: (response) => {
      const inventoryData = Array.isArray(response) ? response : response?.inventory || [];
      return inventoryData.map((item: InventoryItem) => ({
        ...item,
        branchId: item.branch?._id || item.branch,
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

  const { data: productHistory, isLoading: historyLoading } = useQuery<ProductHistoryEntry[], Error>({
    queryKey: ['productHistory', selectedProductId, user.branchId, language],
    queryFn: async () => {
      if (!selectedProductId || !user.branchId) throw new Error(t('errors.no_branch'));
      return inventoryAPI.getHistory({ productId: selectedProductId, branchId: user.branchId });
    },
    enabled: isDetailsModalOpen && !!selectedProductId && !!user.branchId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: ordersData } = useQuery<Order[], Error>({
    queryKey: ['orders', user.branchId, language],
    queryFn: async () => {
      if (!user.branchId) throw new Error(t('errors.no_branch'));
      return ordersAPI.getAll({ branch: user.branchId, status: 'completed' });
    },
    enabled: isReturnModalOpen && !!user.branchId,
    select: (response) => response.orders || [],
  });

  useEffect(() => {
    if (inventoryData) {
      const items: AvailableItem[] = inventoryData
        .filter((item) => item.currentStock > 0 && item.product)
        .map((item) => ({
          productId: item.product!._id,
          productName: isRtl ? item.product!.name : item.product!.nameEn || item.product!.name,
          available: item.currentStock,
          unit: isRtl ? item.product!.unit || t('products.unit_unknown') : item.product!.unitEn || item.product!.unit || 'N/A',
          departmentName: item.product!.department
            ? (isRtl ? item.product!.department.name : item.product!.department.nameEn || item.product!.department.name)
            : t('departments.unknown'),
          stock: item.currentStock,
        }));
      setAvailableItems(items);
    }
  }, [inventoryData, isRtl, t]);

  useEffect(() => {
    if (ordersData && isReturnModalOpen) {
      const newPossibleOrders: Record<string, { value: string; label: string; remaining: number; itemId: string }[]> = {};
      ordersData.forEach((order) => {
        order.items.forEach((item) => {
          if (item.remainingQuantity > 0) {
            if (!newPossibleOrders[item.productId]) {
              newPossibleOrders[item.productId] = [];
            }
            newPossibleOrders[item.productId].push({
              value: order._id,
              label: `${order.orderNumber} (${item.remainingQuantity} ${t('common.available')})`,
              remaining: item.remainingQuantity,
              itemId: item.itemId,
            });
          }
        });
      });
      setPossibleOrders(newPossibleOrders);
    }
  }, [ordersData, isReturnModalOpen, t]);

  useEffect(() => {
    if (!socket || !user.branchId) return;

    const handleInventoryUpdated = ({ branchId }: { branchId: string }) => {
      if (branchId === user.branchId) {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        toast.info(t('inventory.update_success'), { position: 'top-right', autoClose: 3000 });
      }
    };

    const handleReturnStatusUpdated = ({ branchId, returnId, status }: { branchId: string; returnId: string; status: string }) => {
      if (branchId === user.branchId && status === 'approved') {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        addNotification({
          _id: crypto.randomUUID(),
          type: 'info',
          message: t('notifications.return_approved'),
          data: { returnId, eventId: crypto.randomUUID() },
          read: false,
          createdAt: new Date().toISOString(),
          sound: '/sounds/notification.mp3',
          vibrate: [200, 100, 200],
        });
      }
    };

    socket.on('inventoryUpdated', handleInventoryUpdated);
    socket.on('returnStatusUpdated', handleReturnStatusUpdated);

    return () => {
      socket.off('inventoryUpdated', handleInventoryUpdated);
      socket.off('returnStatusUpdated', handleReturnStatusUpdated);
    };
  }, [socket, user, queryClient, addNotification, t]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    setCurrentPage(1);
  }, []);

  const statusOptions = useMemo(
    () => [
      { value: '', label: t('common.all_statuses') },
      { value: InventoryStatus.LOW, label: t('inventory.low_stock') },
      { value: InventoryStatus.NORMAL, label: t('inventory.normal') },
      { value: InventoryStatus.FULL, label: t('inventory.full') },
    ],
    [t]
  );

  const reasonOptions = useMemo(
    () => [
      { value: '', label: t('returns.select_reason') },
      { value: ReturnReason.QUALITY_ISSUE, label: t('returns.quality_issue') },
      { value: ReturnReason.WRONG_ITEM, label: t('returns.wrong_item') },
      { value: ReturnReason.EXCESS_QUANTITY, label: t('returns.excess_quantity') },
      { value: ReturnReason.OTHER, label: t('returns.other') },
    ],
    [t]
  );

  const filteredInventory = useMemo(
    () =>
      (inventoryData || []).filter(
        (item) =>
          item.product &&
          (!filterStatus || item.status === filterStatus) &&
          (item.product.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
            item.product.nameEn.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
            item.product.code.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
            (item.product.department?.name?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) || false) ||
            (item.product.department?.nameEn?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) || false))
      ),
    [inventoryData, debouncedSearchQuery, filterStatus]
  );

  const paginatedInventory = useMemo(
    () => filteredInventory.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredInventory, currentPage]
  );

  const totalInventoryPages = Math.ceil(filteredInventory.length / ITEMS_PER_PAGE);

  const handleOpenReturnModal = useCallback((item?: InventoryItem) => {
    setSelectedItem(item || null);
    dispatchReturnForm({ type: 'RESET' });
    if (item?.product) {
      dispatchReturnForm({
        type: 'ADD_ITEM',
        payload: { itemId: '', productId: item.product._id, orderId: '', quantity: 1, reason: '', maxQuantity: 0 },
      });
    }
    setReturnErrors({});
    setIsReturnModalOpen(true);
  }, []);

  const handleOpenEditModal = useCallback((item: InventoryItem) => {
    console.log('Opening edit modal with user:', user);
    setSelectedItem(item);
    setEditForm({ minStockLevel: item.minStockLevel, maxStockLevel: item.maxStockLevel });
    setEditErrors({});
    setIsEditModalOpen(true);
  }, [user]);

  const handleOpenDetailsModal = useCallback((item: InventoryItem) => {
    if (item.product) {
      setSelectedProductId(item.product._id);
      setIsDetailsModalOpen(true);
    }
  }, []);

  const addItemToForm = useCallback(() => {
    dispatchReturnForm({
      type: 'ADD_ITEM',
      payload: { itemId: '', productId: '', orderId: '', quantity: 1, reason: '', maxQuantity: 0 },
    });
  }, []);

  const handleProductChange = useCallback(
    (index: number, productId: string) => {
      dispatchReturnForm({ type: 'UPDATE_ITEM', payload: { index, field: 'productId', value: productId } });
      dispatchReturnForm({ type: 'UPDATE_ITEM', payload: { index, field: 'orderId', value: '' } });
      dispatchReturnForm({ type: 'UPDATE_ITEM', payload: { index, field: 'itemId', value: '' } });
      dispatchReturnForm({ type: 'UPDATE_ITEM', payload: { index, field: 'maxQuantity', value: 0 } });
    },
    []
  );

  const handleOrderChange = useCallback(
    (index: number, orderId: string) => {
      dispatchReturnForm({ type: 'UPDATE_ITEM', payload: { index, field: 'orderId', value: orderId } });
      const productId = returnForm.items[index]?.productId;
      if (productId && orderId) {
        const selectedOrder = possibleOrders[productId]?.find((o) => o.value === orderId);
        if (selectedOrder) {
          dispatchReturnForm({ type: 'UPDATE_ITEM', payload: { index, field: 'maxQuantity', value: selectedOrder.remaining } });
          dispatchReturnForm({ type: 'UPDATE_ITEM', payload: { index, field: 'itemId', value: selectedOrder.itemId } });
        }
      } else {
        dispatchReturnForm({ type: 'UPDATE_ITEM', payload: { index, field: 'maxQuantity', value: 0 } });
        dispatchReturnForm({ type: 'UPDATE_ITEM', payload: { index, field: 'itemId', value: '' } });
      }
    },
    [returnForm.items, possibleOrders]
  );

  const updateItemInForm = useCallback(
    (index: number, field: keyof ReturnItem, value: string | number) => {
      dispatchReturnForm({ type: 'UPDATE_ITEM', payload: { index, field, value } });
    },
    []
  );

  const removeItemFromForm = useCallback((index: number) => {
    dispatchReturnForm({ type: 'REMOVE_ITEM', payload: index });
  }, []);

  const validateReturnForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!returnForm.reason) errors.reason = t('errors.required', { field: t('returns.reason') });
    if (returnForm.items.length === 0) errors.items = t('errors.required', { field: t('returns.items') });
    returnForm.items.forEach((item, index) => {
      if (!item.productId) errors[`item_${index}_productId`] = t('errors.required', { field: t('returns.item') });
      if (!item.orderId) errors[`item_${index}_orderId`] = t('errors.required', { field: t('returns.order') });
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

  const createReturnMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      if (!user._id || !user.branchId) throw new Error(t('errors.no_user'));
      if (!validateReturnForm()) throw new Error(t('errors.invalid_form'));
      await returnsAPI.create({
        branchId: user.branchId,
        reason: returnForm.reason,
        notes: returnForm.notes,
        items: returnForm.items.map((item) => ({
          productId: item.productId,
          orderId: item.orderId,
          itemId: item.itemId,
          quantity: item.quantity,
          reason: item.reason,
        })),
        userId: user._id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setIsReturnModalOpen(false);
      dispatchReturnForm({ type: 'RESET' });
      toast.success(t('returns.create_success'), { position: 'top-right', autoClose: 3000 });
    },
    onError: (err) => {
      toast.error(err.message || t('errors.create_return'), { position: 'top-right', autoClose: 3000 });
    },
  });

  const updateStockMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      if (!selectedItem || !user._id || !user.branchId) throw new Error(t('errors.no_user'));
      if (!validateEditForm()) throw new Error(t('errors.invalid_form'));
      await inventoryAPI.updateStock({
        id: selectedItem._id,
        minStockLevel: editForm.minStockLevel,
        maxStockLevel: editForm.maxStockLevel,
        branchId: user.branchId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setIsEditModalOpen(false);
      setEditForm({ minStockLevel: 0, maxStockLevel: 0 });
      toast.success(t('inventory.update_success'), { position: 'top-right', autoClose: 3000 });
    },
    onError: (err) => {
      toast.error(err.message || t('errors.update_inventory'), { position: 'top-right', autoClose: 3000 });
    },
  });

  return (
    <div className="container mx-auto px-4 py-6 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('inventory.title')}</h1>

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <CustomInput
          value={searchInput}
          onChange={handleSearchChange}
          placeholder={t('inventory.search_placeholder')}
          className={`flex-1 ${isRtl ? 'text-right' : 'text-left'}`}
          ariaLabel={t('inventory.search_placeholder')}
        />
        <CustomSelect
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value as InventoryStatus | '');
            setCurrentPage(1);
          }}
          options={statusOptions}
          ariaLabel={t('inventory.filter_status')}
        />
        <CustomButton onClick={() => handleOpenReturnModal()} disabled={availableItems.length === 0} ariaLabel={t('returns.create')}>
          {t('returns.create')}
        </CustomButton>
        <CustomButton variant="secondary" onClick={() => refetchInventory()} ariaLabel={t('common.refresh')}>
          <RefreshCw className="w-4 h-4" />
        </CustomButton>
      </div>

      {inventoryError && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {inventoryError.message || t('errors.fetch_inventory')}
        </div>
      )}

      {inventoryLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <InventoryCardSkeleton key={i} isRtl={isRtl} />
          ))}
        </div>
      ) : filteredInventory.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <Package className="mx-auto w-12 h-12 mb-2 text-gray-400" />
          <p>{t('inventory.no_items')}</p>
        </div>
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
                className="p-4 bg-white shadow-md rounded-lg border border-gray-200"
              >
                <div className={`flex items-center ${isRtl ? 'justify-between flex-row-reverse' : 'justify-between'}`}>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {item.product ? (isRtl ? item.product.name : item.product.nameEn) : t('products.unknown')}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {t('products.code')}: {item.product?.code || 'N/A'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {t('departments.department')}: {item.product?.department ? (isRtl ? item.product.department.name : item.product.department.nameEn) : t('departments.unknown')}
                    </p>
                    <p className="text-sm text-gray-600">
                      {t('inventory.current_stock')}: {item.currentStock} {item.product ? (isRtl ? item.product.unit : item.product.unitEn) : 'N/A'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {t('inventory.min_stock')}: {item.minStockLevel} {item.product ? (isRtl ? item.product.unit : item.product.unitEn) : 'N/A'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {t('inventory.max_stock')}: {item.maxStockLevel} {item.product ? (isRtl ? item.product.unit : item.product.unitEn) : 'N/A'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        item.status === InventoryStatus.LOW
                          ? 'bg-red-100 text-red-600'
                          : item.status === InventoryStatus.FULL
                          ? 'bg-green-100 text-green-600'
                          : 'bg-amber-100 text-amber-600'
                      }`}
                    >
                      {t(`inventory.status.${item.status}`)}
                    </span>
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
                      disabled={item.currentStock === 0}
                      ariaLabel={t('returns.create')}
                    >
                      {t('returns.create')}
                    </CustomButton>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Pagination totalPages={totalInventoryPages} currentPage={currentPage} setCurrentPage={setCurrentPage} isRtl={isRtl} />

      <CustomModal isOpen={isReturnModalOpen} onClose={() => setIsReturnModalOpen(false)} title={t('returns.create')}>
        <div className="space-y-4">
          <CustomSelect
            label={t('returns.reason')}
            value={returnForm.reason}
            onChange={(e) => dispatchReturnForm({ type: 'SET_REASON', payload: e.target.value })}
            options={reasonOptions}
            error={returnErrors.reason}
            ariaLabel={t('returns.reason')}
          />
          <CustomInput
            label={t('returns.notes')}
            value={returnForm.notes}
            onChange={(e) => dispatchReturnForm({ type: 'SET_NOTES', payload: e.target.value })}
            error={returnErrors.notes}
            placeholder={t('returns.notes_placeholder')}
            ariaLabel={t('returns.notes')}
          />
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('returns.items')}</h3>
            {returnErrors.items && <p className="text-red-500 text-xs">{returnErrors.items}</p>}
            {returnForm.items.map((item, index) => (
              <div key={index} className="flex flex-col sm:flex-row gap-3 items-start border p-4 rounded-lg">
                <CustomSelect
                  label={t('returns.item')}
                  value={item.productId}
                  onChange={(e) => handleProductChange(index, e.target.value)}
                  options={[
                    { value: '', label: t('returns.select_item') },
                    ...availableItems.map((ai) => ({
                      value: ai.productId,
                      label: `${ai.productName} (${ai.available} ${ai.unit})`,
                    })),
                  ]}
                  disabled={!!selectedItem}
                  error={returnErrors[`item_${index}_productId`]}
                  ariaLabel={t('returns.item')}
                />
                <CustomSelect
                  label={t('returns.order')}
                  value={item.orderId}
                  onChange={(e) => handleOrderChange(index, e.target.value)}
                  options={[
                    { value: '', label: t('returns.select_order') },
                    ...(possibleOrders[item.productId] || []),
                  ]}
                  disabled={!item.productId}
                  error={returnErrors[`item_${index}_orderId`]}
                  ariaLabel={t('returns.order')}
                />
                <CustomSelect
                  label={t('returns.reason')}
                  value={item.reason}
                  onChange={(e) => updateItemInForm(index, 'reason', e.target.value)}
                  options={reasonOptions}
                  error={returnErrors[`item_${index}_reason`]}
                  ariaLabel={t('returns.reason')}
                />
                <CustomInput
                  label={t('returns.quantity')}
                  type="number"
                  min={1}
                  max={item.maxQuantity}
                  value={item.quantity}
                  onChange={(e) => updateItemInForm(index, 'quantity', parseInt(e.target.value) || 1)}
                  error={returnErrors[`item_${index}_quantity`]}
                  ariaLabel={t('returns.quantity')}
                />
                {!selectedItem && (
                  <CustomButton
                    variant="destructive"
                    size="sm"
                    onClick={() => removeItemFromForm(index)}
                    ariaLabel={t('returns.remove_item')}
                  >
                    <X className="w-4 h-4" />
                  </CustomButton>
                )}
              </div>
            ))}
            {!selectedItem && (
              <CustomButton onClick={addItemToForm} variant="secondary" size="sm" ariaLabel={t('returns.add_item')}>
                <Plus className="w-4 h-4 mr-2" /> {t('returns.add_item')}
              </CustomButton>
            )}
          </div>
          <div className="flex gap-3 justify-end">
            <CustomButton
              variant="secondary"
              onClick={() => setIsReturnModalOpen(false)}
              ariaLabel={t('common.cancel')}
            >
              {t('common.cancel')}
            </CustomButton>
            <CustomButton
              onClick={() => createReturnMutation.mutate()}
              disabled={createReturnMutation.isLoading}
              ariaLabel={t('returns.submit')}
            >
              {createReturnMutation.isLoading ? t('common.submitting') : t('returns.submit')}
            </CustomButton>
          </div>
        </div>
      </CustomModal>

      <CustomModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={t('inventory.edit')}>
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
          <div className="flex gap-3 justify-end">
            <CustomButton variant="secondary" onClick={() => setIsEditModalOpen(false)} ariaLabel={t('common.cancel')}>
              {t('common.cancel')}
            </CustomButton>
            <CustomButton
              onClick={() => updateStockMutation.mutate()}
              disabled={updateStockMutation.isLoading}
              ariaLabel={t('inventory.submit')}
            >
              {updateStockMutation.isLoading ? t('common.submitting') : t('inventory.submit')}
            </CustomButton>
          </div>
        </div>
      </CustomModal>

      <CustomModal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title={t('inventory.history')}>
        <div className="space-y-4">
          {historyLoading ? (
            <div className="text-center">
              <svg className="animate-spin h-5 w-5 mx-auto text-gray-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : productHistory && productHistory.length > 0 ? (
            <div className="space-y-2">
              {productHistory.map((entry) => (
                <div key={entry._id} className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    {t('inventory.date')}: {new Date(entry.date).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}
                  </p>
                  <p className="text-sm text-gray-600">
                    {t('inventory.type')}: {t(`inventory.history_types.${entry.type}`)}
                  </p>
                  <p className="text-sm text-gray-600">
                    {t('inventory.quantity')}: {entry.quantity}
                  </p>
                  <p className="text-sm text-gray-600">
                    {t('inventory.description')}: {entry.description}
                  </p>
                  {entry.orderId && (
                    <p className="text-sm text-gray-600">
                      {t('inventory.order')}: {entry.orderId}
                    </p>
                  )}
                  {entry.returnId && (
                    <p className="text-sm text-gray-600">
                      {t('inventory.return')}: {entry.returnId}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center">{t('inventory.no_history')}</p>
          )}
          <div className="flex justify-end">
            <CustomButton variant="secondary" onClick={() => setIsDetailsModalOpen(false)} ariaLabel={t('common.close')}>
              {t('common.close')}
            </CustomButton>
          </div>
        </div>
      </CustomModal>
    </div>
  );
};