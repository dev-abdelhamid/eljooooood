import React, { useState, useMemo, useCallback, useEffect, useReducer } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useNotifications } from '../contexts/NotificationContext';
import { inventoryAPI, returnsAPI } from '../services/api';
import { Package, AlertCircle, Search, RefreshCw, History as HistoryIcon, Edit, X, Plus } from 'lucide-react';
import { debounce } from 'lodash';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// Interfaces
interface InventoryItem {
  _id: string;
  product: {
    _id: string;
    name: string;
    nameEn: string;
    code: string;
    unit: string;
    unitEn: string;
    department: { name: string; nameEn: string; _id: string } | null;
  } | null;
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
  } | null;
  action: string;
  quantity: number;
  reference: string;
  createdBy: {
    username: string;
  };
  createdAt: string;
}

interface Return {
  _id: string;
  returnNumber: string;
  orderId?: string;
  branchId: string;
  items: Array<{
    product: {
      _id: string;
      name: string;
      nameEn: string;
    };
    quantity: number;
    reason: string;
    status?: 'approved' | 'rejected';
    reviewNotes?: string;
  }>;
  status: 'pending_approval' | 'approved' | 'rejected';
  reason: string;
  notes?: string;
  createdAt: string;
}

interface ReturnItem {
  productId: string;
  quantity: number;
  reason: string;
  maxQuantity: number;
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

// Reducer for Return Form
interface ReturnFormState {
  reason: string;
  notes: string;
  items: ReturnItem[];
}

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
    case 'UPDATE_ITEM': {
      const newItems = [...state.items];
      newItems[action.payload.index] = { ...newItems[action.payload.index], [action.payload.field]: action.payload.value };
      return { ...state, items: newItems };
    }
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter((_, i) => i !== action.payload) };
    case 'RESET':
      return { reason: '', notes: '', items: [] };
    default:
      return state;
  }
};

// Component Interfaces
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
}

interface CustomButtonProps {
  variant?: 'primary' | 'secondary' | 'destructive' | 'danger';
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
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: Array<{ value: string; label: string }>;
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
  else if (variant === 'destructive' || variant === 'danger') baseClass += ' text-red-600 hover:text-red-800';
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
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
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
  const [activeTab, setActiveTab] = useState<'inventory' | 'history' | 'returns'>('inventory');
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [returnForm, dispatchReturnForm] = useReducer(returnFormReducer, { reason: '', notes: '', items: [] });
  const [editForm, setEditForm] = useState<EditForm>({ minStockLevel: 0, maxStockLevel: 0 });
  const [returnErrors, setReturnErrors] = useState<Record<string, string>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);

  const { data: inventoryData, isLoading: inventoryLoading, error: inventoryError, refetch: refetchInventory } = useQuery<InventoryItem[], Error>({
    queryKey: ['inventory', user?.branchId, language],
    queryFn: () => inventoryAPI.getByBranch(user?.branchId || ''),
    enabled: !!user?.branchId,
    select: (response) => {
      const inventoryData = Array.isArray(response) ? response : response?.inventory || [];
      return inventoryData.map((item: InventoryItem) => ({
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
    select: (response) => (response?.history || []).map((entry: InventoryHistoryItem) => ({
      ...entry,
      product: entry.product
        ? {
            name: entry.product.name || t('products.unknown'),
            nameEn: entry.product.nameEn || entry.product.name || t('products.unknown'),
          }
        : null,
    })),
  });

  const { data: returnsData, isLoading: returnsLoading, error: returnsError } = useQuery<Return[], Error>({
    queryKey: ['returns', user?.branchId, language],
    queryFn: () => returnsAPI.getByBranch(user?.branchId || '', filterStatus, currentPage, ITEMS_PER_PAGE),
    enabled: activeTab === 'returns' && !!user?.branchId,
    select: (response) => (response || []).map((ret: Return) => ({
      ...ret,
      items: ret.items.map((item) => ({
        ...item,
        product: {
          _id: item.product._id,
          name: item.product.name || t('products.unknown'),
          nameEn: item.product.nameEn || item.product.name || t('products.unknown'),
        },
      })),
    })),
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
          departmentName: isRtl ? item.product!.department?.name || t('departments.unknown') : item.product!.department?.nameEn || item.product!.department?.name || t('departments.unknown'),
          stock: item.currentStock,
        }));
      setAvailableItems(items);
    }
  }, [inventoryData, isRtl, t]);

  useEffect(() => {
    if (!socket) return;

    socket.on('connect', () => console.log('Socket connected'));
    socket.on('connect_error', (err) => console.error('Socket connect error:', err));
    socket.on('inventoryUpdated', ({ branchId, minStockLevel, maxStockLevel }: { branchId: string; minStockLevel?: number; maxStockLevel?: number }) => {
      if (branchId === user?.branchId) {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        queryClient.invalidateQueries({ queryKey: ['inventoryHistory'] });
        if (minStockLevel !== undefined || maxStockLevel !== undefined) {
          toast.info(t('inventory.update_success'));
        }
      }
    });
    socket.on('returnCreated', ({ branchId, returnId, status }: { branchId: string; returnId: string; status: string }) => {
      if (branchId === user?.branchId) {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        queryClient.invalidateQueries({ queryKey: ['inventoryHistory'] });
        queryClient.invalidateQueries({ queryKey: ['returns'] });
        addNotification({
          _id: crypto.randomUUID(),
          type: 'success',
          message: t('notifications.return_created', {
            branchName: user?.branchId ? t('branches.current') : t('branches.unknown'),
          }),
          data: { returnId, eventId: crypto.randomUUID() },
          read: false,
          createdAt: new Date().toISOString(),
          sound: '/sounds/notification.mp3',
          vibrate: [400, 100, 400],
        });
      }
    });
    socket.on('returnStatusUpdated', ({ branchId, returnId, status }: { branchId: string; returnId: string; status: string }) => {
      if (branchId === user?.branchId) {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        queryClient.invalidateQueries({ queryKey: ['inventoryHistory'] });
        queryClient.invalidateQueries({ queryKey: ['returns'] });
        addNotification({
          _id: crypto.randomUUID(),
          type: 'info',
          message: t('notifications.return_status_updated', {
            status: t(`returns.${status}`),
            branchName: user?.branchId ? t('branches.current') : t('branches.unknown'),
          }),
          data: { returnId, eventId: crypto.randomUUID() },
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
  }, [socket, user, queryClient, addNotification, t]);

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

  const returnStatusOptions = useMemo(
    () => [
      { value: '', label: isRtl ? 'كل الحالات' : 'All Statuses' },
      { value: 'pending_approval', label: isRtl ? 'في انتظار الموافقة' : 'Pending Approval' },
      { value: 'approved', label: isRtl ? 'معتمد' : 'Approved' },
      { value: 'rejected', label: isRtl ? 'مرفوض' : 'Rejected' },
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
    () =>
      (inventoryData || []).filter(
        (item) =>
          item.product &&
          (!filterStatus || item.status === filterStatus) &&
          (item.product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.product.nameEn?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.product.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.product.department?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.product.department?.nameEn?.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
    [inventoryData, searchQuery, filterStatus]
  );

  const paginatedInventory = useMemo(
    () => filteredInventory.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredInventory, currentPage]
  );

  const totalInventoryPages = Math.ceil(filteredInventory.length / ITEMS_PER_PAGE);

  const filteredHistory = useMemo(
    () =>
      (historyData || []).filter(
        (entry) =>
          entry.product &&
          (entry.product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            entry.product.nameEn?.toLowerCase().includes(searchQuery.toLowerCase())) &&
          (!filterStatus || entry.action === filterStatus)
      ),
    [historyData, searchQuery, filterStatus]
  );

  const paginatedHistory = useMemo(
    () => filteredHistory.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredHistory, currentPage]
  );

  const totalHistoryPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);

  const filteredReturns = useMemo(
    () =>
      (returnsData || []).filter(
        (ret) =>
          (!filterStatus || ret.status === filterStatus) &&
          (ret.returnNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ret.items.some(
              (item) =>
                item.product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.product.nameEn?.toLowerCase().includes(searchQuery.toLowerCase())
            ))
      ),
    [returnsData, searchQuery, filterStatus]
  );

  const paginatedReturns = useMemo(
    () => filteredReturns.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredReturns, currentPage]
  );

  const totalReturnsPages = Math.ceil(filteredReturns.length / ITEMS_PER_PAGE);

  const handleOpenReturnModal = useCallback((item?: InventoryItem) => {
    setSelectedItem(item || null);
    dispatchReturnForm({ type: 'RESET' });
    if (item?.product) {
      dispatchReturnForm({
        type: 'ADD_ITEM',
        payload: { productId: item.product._id, quantity: 1, reason: '', maxQuantity: item.currentStock },
      });
    }
    setReturnErrors({});
    setIsReturnModalOpen(true);
  }, []);

  const handleOpenEditModal = useCallback((item: InventoryItem) => {
    setSelectedItem(item);
    setEditForm({ minStockLevel: item.minStockLevel, maxStockLevel: item.maxStockLevel });
    setEditErrors({});
    setIsEditModalOpen(true);
  }, []);

  const addItemToForm = useCallback(() => {
    dispatchReturnForm({
      type: 'ADD_ITEM',
      payload: { productId: '', quantity: 1, reason: '', maxQuantity: 0 },
    });
  }, []);

  const updateItemInForm = useCallback(
    (index: number, field: keyof ReturnItem, value: string | number) => {
      dispatchReturnForm({ type: 'UPDATE_ITEM', payload: { index, field, value } });
      if (field === 'productId') {
        const sel = availableItems.find((a) => a.productId === value);
        if (sel) {
          dispatchReturnForm({
            type: 'UPDATE_ITEM',
            payload: { index, field: 'maxQuantity', value: sel.stock },
          });
        }
      }
    },
    [availableItems]
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
      if (!item.reason) errors[`item_${index}_reason`] = t('errors.required', { field: t('returns.reason') });
      if (item.quantity < 1 || item.quantity > (item.maxQuantity ?? 0) || isNaN(item.quantity)) {
        errors[`item_${index}_quantity`] = t('errors.invalid_quantity_max', { max: item.maxQuantity ?? 0 });
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
      if (!validateReturnForm()) throw new Error(t('errors.invalid_form'));
      if (!user?.branchId) throw new Error(t('errors.no_branch'));
      await returnsAPI.createReturn({
        branchId: user.branchId,
        reason: returnForm.reason,
        notes: returnForm.notes,
        items: returnForm.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          reason: item.reason,
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryHistory'] });
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      setIsReturnModalOpen(false);
      dispatchReturnForm({ type: 'RESET' });
      setReturnErrors({});
      toast.success(t('returns.create_success'));
      socket?.emit('returnCreated', {
        branchId: user?.branchId,
        returnId: crypto.randomUUID(),
        status: 'pending_approval',
        eventId: crypto.randomUUID(),
      });
    },
    onError: (err) => {
      console.error('Create return error:', err);
      toast.error(err.message || t('errors.create_return'));
      if (err.message.includes('Invalid')) {
        setReturnErrors({ form: err.message });
      }
    },
  });

  const updateInventoryMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      if (!validateEditForm()) throw new Error(t('errors.invalid_form'));
      if (!selectedItem) throw new Error(t('errors.no_item_selected'));
      await inventoryAPI.updateStock(selectedItem._id, {
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
      socket?.emit('inventoryUpdated', {
        branchId: user?.branchId,
        minStockLevel: editForm.minStockLevel,
        maxStockLevel: editForm.maxStockLevel,
        eventId: crypto.randomUUID(),
      });
    },
    onError: (err) => {
      console.error('Update inventory error:', err);
      toast.error(err.message || t('errors.update_inventory'));
    },
  });

  const errorMessage = inventoryError?.message || historyError?.message || returnsError?.message || '';

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
        <CustomButton
          onClick={() => setActiveTab('returns')}
          className={`flex-1 py-2 font-semibold transition-all duration-300 ${
            activeTab === 'returns' ? 'bg-amber-600 text-white' : 'text-gray-700'
          }`}
        >
          {isRtl ? 'المرتجعات' : 'Returns'}
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
              value={searchQuery}
            />
          </div>
          <CustomSelect
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
            }}
            options={activeTab === 'returns' ? returnStatusOptions : statusOptions}
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
                    item.product && (
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
                              <p className="text-sm text-gray-600 font-medium">{isRtl ? 'القسم' : 'Department'}: {isRtl ? item.product.department?.name : item.product.department?.nameEn}</p>
                              <p
                                className={`text-sm font-medium ${
                                  item.status === 'low' ? 'text-red-600' : item.status === 'full' ? 'text-yellow-600' : 'text-green-600'
                                }`}
                              >
                                {isRtl
                                  ? item.status === 'low'
                                    ? 'منخفض'
                                    : item.status === 'full'
                                    ? 'ممتلئ'
                                    : 'عادي'
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
                                variant="destructive"
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
                    )
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
        ) : activeTab === 'history' ? (
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
                      entry.product && (
                        <tr key={entry._id} className="border-b">
                          <td className="p-2">{new Date(entry.createdAt).toLocaleString()}</td>
                          <td className="p-2">{isRtl ? t(`history.${entry.action}`) : entry.action}</td>
                          <td className="p-2">{entry.quantity}</td>
                          <td className="p-2">{entry.reference}</td>
                          <td className="p-2">{entry.createdBy.username}</td>
                        </tr>
                      )
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
        ) : (
          <motion.div
            key="returns"
            initial={{ opacity: 0, x: isRtl ? 50 : -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRtl ? -50 : 50 }}
            transition={{ duration: 0.3 }}
          >
            {returnsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-amber-600 mx-auto"></div>
              </div>
            ) : paginatedReturns.length === 0 ? (
              <CustomCard className="p-8 text-center bg-white rounded-xl shadow-md">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">{isRtl ? 'لا توجد مرتجعات' : 'No returns'}</p>
              </CustomCard>
            ) : (
              <div className="space-y-4">
                <AnimatePresence>
                  {paginatedReturns.map((ret) => (
                    <motion.div
                      key={ret._id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <CustomCard className="p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-shadow">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">{ret.returnNumber}</h3>
                            <p className="text-sm text-gray-600">{isRtl ? 'التاريخ' : 'Date'}: {new Date(ret.createdAt).toLocaleString()}</p>
                            <p className="text-sm text-gray-600">{isRtl ? 'الحالة' : 'Status'}: {isRtl ? t(`returns.${ret.status}`) : ret.status}</p>
                            <p className="text-sm text-gray-600">{isRtl ? 'السبب' : 'Reason'}: {ret.reason}</p>
                            <p className="text-sm text-gray-600">{isRtl ? 'الملاحظات' : 'Notes'}: {ret.notes || t('none')}</p>
                            <div className="mt-2">
                              <p className="text-sm font-medium text-gray-700">{isRtl ? 'العناصر' : 'Items'}:</p>
                              <ul className="list-disc pl-4">
                                {ret.items.map((item, i) => (
                                  <li key={i} className="text-sm text-gray-600">
                                    {isRtl ? item.product.name : item.product.nameEn} - {item.quantity} ({item.reason})
                                    {item.status && ` - ${isRtl ? t(`returns.${item.status}`) : item.status}`}
                                    {item.reviewNotes && ` (${item.reviewNotes})`}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </CustomCard>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <Pagination
                  totalPages={totalReturnsPages}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  isRtl={isRtl}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <CustomModal
        isOpen={isReturnModalOpen}
        onClose={() => {
          setIsReturnModalOpen(false);
          dispatchReturnForm({ type: 'RESET' });
          setReturnErrors({});
          setSelectedItem(null);
        }}
        title={isRtl ? 'إنشاء مرتجع' : 'Create Return'}
      >
        <div className="flex flex-col gap-4">
          {selectedItem?.product && (
            <p className="text-sm text-gray-600">
              {isRtl ? 'المنتج' : 'Product'}: {isRtl ? selectedItem.product.name : selectedItem.product.nameEn}
            </p>
          )}
          <CustomSelect
            label={isRtl ? 'السبب' : 'Reason'}
            value={returnForm.reason}
            onChange={(e) => dispatchReturnForm({ type: 'SET_REASON', payload: e.target.value })}
            options={reasonOptions}
            error={returnErrors.reason}
          />
          <CustomInput
            label={isRtl ? 'ملاحظات' : 'Notes'}
            value={returnForm.notes}
            onChange={(e) => dispatchReturnForm({ type: 'SET_NOTES', payload: e.target.value })}
            placeholder={isRtl ? 'أدخل ملاحظات إضافية' : 'Enter additional notes'}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'العناصر' : 'Items'}</label>
            {returnForm.items.map((item, index) => (
              <div key={index} className="flex gap-2 mb-2 items-center">
                <CustomSelect
                  value={item.productId}
                  onChange={(e) => updateItemInForm(index, 'productId', e.target.value)}
                  options={[{ value: '', label: isRtl ? 'اختر منتجًا' : 'Select Product' }].concat(
                    availableItems
                      .filter((a) => !returnForm.items.some((i, idx) => i.productId === a.productId && idx !== index))
                      .map((a) => ({
                        value: a.productId,
                        label: `${a.productName} (${a.stock} ${isRtl ? 'متاح' : 'available'}) - ${a.departmentName}`,
                      }))
                  )}
                  error={returnErrors[`item_${index}_productId`]}
                  disabled={!!selectedItem}
                />
                <CustomInput
                  type="number"
                  min={1}
                  max={item.maxQuantity}
                  value={item.quantity}
                  onChange={(e) => updateItemInForm(index, 'quantity', Number(e.target.value))}
                  error={returnErrors[`item_${index}_quantity`]}
                  className="w-24"
                />
                <CustomSelect
                  value={item.reason}
                  onChange={(e) => updateItemInForm(index, 'reason', e.target.value)}
                  options={reasonOptions}
                  error={returnErrors[`item_${index}_reason`]}
                />
                <CustomButton
                  variant="danger"
                  size="sm"
                  onClick={() => removeItemFromForm(index)}
                  className="text-red-600 hover:text-red-800"
                  disabled={!!selectedItem}
                >
                  <X className="w-4 h-4" />
                </CustomButton>
              </div>
            ))}
            {returnErrors.items && <p className="text-red-500 text-sm mt-1">{returnErrors.items}</p>}
            {!selectedItem && (
              <CustomButton
                variant="secondary"
                onClick={addItemToForm}
                className="mt-2 bg-gray-100 hover:bg-gray-200 text-gray-800"
                disabled={availableItems.length === 0 || availableItems.length === returnForm.items.length}
              >
                <Plus className="w-4 h-4 mr-2" />
                {isRtl ? 'إضافة عنصر' : 'Add Item'}
              </CustomButton>
            )}
          </div>
          {returnErrors.form && <p className="text-red-500 text-sm">{returnErrors.form}</p>}
          <div className="flex justify-end gap-2">
            <CustomButton
              variant="secondary"
              onClick={() => {
                setIsReturnModalOpen(false);
                dispatchReturnForm({ type: 'RESET' });
                setReturnErrors({});
                setSelectedItem(null);
              }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800"
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </CustomButton>
            <CustomButton
              onClick={() => createReturnMutation.mutate()}
              disabled={createReturnMutation.isPending}
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
          {selectedItem?.product && (
            <p className="text-sm text-gray-600">
              {isRtl ? 'المنتج' : 'Product'}: {isRtl ? selectedItem.product.name : selectedItem.product.nameEn}
            </p>
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