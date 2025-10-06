import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { Package, AlertCircle, Search, RefreshCw, Edit, X, Plus, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { inventoryAPI, returnAPI } from '../services/inventoryAPI';
import { isValidObjectId } from '../utils';

// واجهات البيانات
interface InventoryItem {
  _id: string;
  product: { _id: string; name: string; nameEn: string; code: string; unit: string; unitEn: string; department: { _id: string; name: string; nameEn: string } | null };
  branch: { _id: string; name: string; nameEn: string } | null;
  currentStock: number;
  damagedStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  status: 'low' | 'normal' | 'full';
}

interface ReturnForm {
  productId: string;
  quantity: number;
  reason: string;
  notes: string;
}

interface EditForm {
  minStockLevel: number;
  maxStockLevel: number;
}

interface ProductHistoryEntry {
  _id: string;
  date: string;
  type: 'addition' | 'return' | 'sale' | 'adjustment' | 'return_pending' | 'return_approved' | 'return_rejected';
  quantity: number;
  description: string;
}

// مكونات مخصصة
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
   const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { socket } = useSocket();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();

    const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [returnForm, setReturnForm] = useState<ReturnForm>({ productId: '', quantity: 1, reason: '', notes: '' });
  const [editForm, setEditForm] = useState<EditForm>({ minStockLevel: 0, maxStockLevel: 1000 });
  const [returnErrors, setReturnErrors] = useState<Record<string, string>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Debounce للبحث
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

  // جلب بيانات المخزون
  const { data: inventoryData, isLoading: inventoryLoading, error: inventoryError, refetch: refetchInventory } = useQuery<
    InventoryItem[],
    AxiosError
  >({
    queryKey: ['inventory', user?.branchId, debouncedSearchQuery, filterStatus, filterDepartment, currentPage],
    queryFn: async () => {
      if (!user?.branchId) throw new Error(t('errors.no_branch'));
      return inventoryAPI.getByBranch(user.branchId);
    },
    enabled: !!user?.branchId,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    select: (response) => {
      const inventoryData = Array.isArray(response) ? response : response?.data || [];
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
        branch: item.branch
          ? {
              _id: item.branch._id || '',
              name: item.branch.name || t('branches.unknown'),
              nameEn: item.branch.nameEn || item.branch.name || t('branches.unknown'),
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
    onError: (err) => {
      toast.error(err.message || t('errors.fetch_inventory'), { position: 'top-right', autoClose: 3000 });
    },
  });

  // جلب سجل المنتج
  const { data: productHistory, isLoading: historyLoading } = useQuery<ProductHistoryEntry[], AxiosError>({
    queryKey: ['productHistory', selectedProductId, user?.branchId],
    queryFn: async () => {
      if (!selectedProductId || !user?.branchId) throw new Error(t('errors.no_branch'));
      return inventoryAPI.getHistory({ productId: selectedProductId, branchId: user.branchId });
    },
    enabled: isDetailsModalOpen && !!selectedProductId && !!user?.branchId,
    staleTime: 5 * 60 * 1000,
  });

  // خيارات الأقسام
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

  // خيارات الحالة
  const statusOptions = useMemo(
    () => [
      { value: '', label: t('common.all_statuses') },
      { value: 'low', label: t('inventory.low_stock') },
      { value: 'normal', label: t('inventory.normal') },
      { value: 'full', label: t('inventory.full') },
    ],
    [t]
  );

  // خيارات أسباب الإرجاع
  const reasonOptions = useMemo(
    () => [
      { value: '', label: t('returns.select_reason') },
      { value: 'تالف', label: t('returns.quality_issue') },
      { value: 'منتج خاطئ', label: t('returns.wrong_item') },
      { value: 'كمية زائدة', label: t('returns.excess_quantity') },
      { value: 'أخرى', label: t('returns.other') },
    ],
    [t]
  );

  // تصفية المخزون
  const filteredInventory = useMemo(
    () =>
      (inventoryData || []).filter(
        (item) =>
          item.product &&
          (!filterStatus || item.status === filterStatus) &&
          (!filterDepartment || item.product.department?._id === filterDepartment) &&
          (item.product.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
            item.product.nameEn.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
            item.product.code.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
            item.product.department?.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
            item.product.department?.nameEn.toLowerCase().includes(debouncedSearchQuery.toLowerCase()))
      ),
    [inventoryData, debouncedSearchQuery, filterStatus, filterDepartment]
  );

  const paginatedInventory = useMemo(
    () => filteredInventory.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredInventory, currentPage]
  );

  const totalInventoryPages = Math.ceil(filteredInventory.length / ITEMS_PER_PAGE);

  // معالجة أحداث السوكت
  useEffect(() => {
    if (!socket || !user?.branchId) return;

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

  // دوال المساعدة
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    setCurrentPage(1);
  }, []);

  const handleOpenReturnModal = useCallback((item?: InventoryItem) => {
    setSelectedItem(item || null);
    setReturnForm({ productId: item?.product?._id || '', quantity: 1, reason: '', notes: '' });
    setReturnErrors({});
    setIsReturnModalOpen(true);
  }, []);

  const handleOpenEditModal = useCallback((item: InventoryItem) => {
    setSelectedItem(item);
    setEditForm({ minStockLevel: item.minStockLevel, maxStockLevel: item.maxStockLevel });
    setEditErrors({});
    setIsEditModalOpen(true);
  }, []);

  const handleOpenDetailsModal = useCallback((item: InventoryItem) => {
    if (item.product) {
      setSelectedProductId(item.product._id);
      setIsDetailsModalOpen(true);
    }
  }, []);

  const validateReturnForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!returnForm.productId) errors.productId = t('errors.required', { field: t('returns.item') });
    if (!returnForm.reason) errors.reason = t('errors.required', { field: t('returns.reason') });
    if (returnForm.quantity < 1 || isNaN(returnForm.quantity)) {
      errors.quantity = t('errors.invalid_quantity');
    }
    const selectedInventory = inventoryData?.find((item) => item.product?._id === returnForm.productId);
    if (selectedInventory && returnForm.quantity > selectedInventory.currentStock) {
      errors.quantity = t('errors.invalid_quantity_max', { max: selectedInventory.currentStock });
    }
    setReturnErrors(errors);
    return Object.keys(errors).length === 0;
  }, [returnForm, inventoryData, t]);

  const validateEditForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (editForm.minStockLevel < 0) errors.minStockLevel = t('errors.non_negative', { field: t('inventory.min_stock') });
    if (editForm.maxStockLevel < 0) errors.maxStockLevel = t('errors.non_negative', { field: t('inventory.max_stock') });
    if (editForm.maxStockLevel <= editForm.minStockLevel) errors.maxStockLevel = t('errors.max_greater_min');
    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  }, [editForm, t]);

  // الطفرات (Mutations)
  const createReturnMutation = useMutation<void, AxiosError>({
    mutationFn: async () => {
      if (!validateReturnForm()) throw new Error(t('errors.invalid_form'));
      if (!user?.branchId) throw new Error(t('errors.no_branch'));
      await returnAPI.createReturnRequest({
        branchId: user.branchId,
        items: [{ product: returnForm.productId, quantity: returnForm.quantity, reason: returnForm.reason, notes: returnForm.notes }],
        reason: returnForm.reason,
        notes: returnForm.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setIsReturnModalOpen(false);
      setReturnForm({ productId: '', quantity: 1, reason: '', notes: '' });
      setReturnErrors({});
      setSelectedItem(null);
      toast.success(t('returns.create_success'), { position: 'top-right', autoClose: 3000 });
      socket?.emit('returnCreated', {
        branchId: user?.branchId,
        returnId: crypto.randomUUID(),
        status: 'pending_approval',
        eventId: crypto.randomUUID(),
      });
    },
    onError: (err) => {
      console.error(`[${new Date().toISOString()}] Create return error:`, err);
      const errorMessage = err.response?.data?.message || t('errors.create_return');
      toast.error(errorMessage, { position: 'top-right', autoClose: 3000 });
      setReturnErrors({ form: errorMessage });
    },
  });

  const updateInventoryMutation = useMutation<void, AxiosError>({
    mutationFn: async () => {
      if (!validateEditForm()) throw new Error(t('errors.invalid_form'));
      if (!selectedItem) throw new Error(t('errors.no_item_selected'));
      if (!user?.branchId && !selectedItem.branch?._id) throw new Error(t('errors.no_branch'));
      await inventoryAPI.updateStock(selectedItem._id, {
        minStockLevel: editForm.minStockLevel,
        maxStockLevel: editForm.maxStockLevel,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setIsEditModalOpen(false);
      setEditForm({ minStockLevel: 0, maxStockLevel: 1000 });
      setEditErrors({});
      setSelectedItem(null);
      toast.success(t('inventory.update_success'), { position: 'top-right', autoClose: 3000 });
      socket?.emit('inventoryUpdated', {
        branchId: selectedItem?.branch?._id || user?.branchId,
        minStockLevel: editForm.minStockLevel,
        maxStockLevel: editForm.maxStockLevel,
        eventId: crypto.randomUUID(),
      });
    },
    onError: (err) => {
      console.error(`[${new Date().toISOString()}] Update inventory error:`, err);
      const errorMessage = err.response?.data?.message || t('errors.update_inventory');
      toast.error(errorMessage, { position: 'top-right', autoClose: 3000 });
      setEditErrors({ form: errorMessage });
    },
  });

  const errorMessage = inventoryError?.message || '';

  return (
    <div
      className="container mx-auto px-4 py-6 min-h-screen bg-gradient-to-br from-amber-50 to-teal-50"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Package className="w-8 h-8 text-amber-600" />
              {t('inventory.title')}
            </h1>
            <p className="text-gray-600 mt-2 text-sm sm:text-base">{t('inventory.description')}</p>
          </div>
          <div className="flex gap-2">
            <CustomButton
              onClick={() => handleOpenReturnModal()}
              className="bg-amber-600 text-white hover:bg-amber-700 flex items-center gap-2"
              ariaLabel={t('returns.create')}
            >
              <Plus className="w-4 h-4" />
              {t('returns.create')}
            </CustomButton>
            <CustomButton
              onClick={() => refetchInventory()}
              variant="secondary"
              className="flex items-center gap-2"
              ariaLabel={t('common.refresh')}
            >
              <RefreshCw className="w-4 h-4" />
              {t('common.refresh')}
            </CustomButton>
          </div>
        </div>
      </div>

      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm">{errorMessage}</span>
          <CustomButton
            onClick={() => refetchInventory()}
            className="ml-4 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700"
            ariaLabel={t('common.retry')}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('common.retry')}
          </CustomButton>
        </motion.div>
      )}

      <CustomCard className="p-4 sm:p-6 mb-6 bg-white rounded-xl shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="relative">
            <Search
              className={`absolute top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 ${isRtl ? 'right-3' : 'left-3'}`}
            />
            <CustomInput
              placeholder={t('common.search')}
              value={searchInput}
              onChange={handleSearchChange}
              className={`pl-10 pr-4 py-2 border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 ${isRtl ? 'pr-10 pl-4' : ''}`}
              ariaLabel={t('common.search')}
            />
          </div>
          <CustomSelect
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
            }}
            options={statusOptions}
            label={t('common.filter_by_status')}
            ariaLabel={t('common.filter_by_status')}
          />
          <CustomSelect
            value={filterDepartment}
            onChange={(e) => {
              setFilterDepartment(e.target.value);
              setCurrentPage(1);
            }}
            options={departmentOptions}
            label={t('common.filter_by_department')}
            ariaLabel={t('common.filter_by_department')}
          />
        </div>
      </CustomCard>

      <motion.div
        initial={{ opacity: 0, x: isRtl ? -50 : 50 }}
        animate={{ opacity: 1, x: 0 }}
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
            <p className="text-gray-600 text-sm">{t('inventory.no_items')}</p>
          </CustomCard>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {paginatedInventory.map((item) =>
                item.product ? (
                  <motion.div
                    key={item._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <CustomCard className="p-4 sm:p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-shadow">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                        <div className="sm:col-span-2">
                          <h3 className="font-semibold text-gray-900 text-base sm:text-lg">
                            {isRtl ? item.product.name : item.product.nameEn}
                          </h3>
                          <p className="text-sm text-gray-500">{t('products.code')}: {item.product.code}</p>
                          <p className="text-sm text-gray-600">{t('inventory.stock')}: {item.currentStock}</p>
                          <p className="text-sm text-gray-600">{t('inventory.damaged_stock')}: {item.damagedStock}</p>
                          <p className="text-sm text-gray-600">{t('inventory.min_stock')}: {item.minStockLevel}</p>
                          <p className="text-sm text-gray-600">{t('inventory.max_stock')}: {item.maxStockLevel}</p>
                          <p className="text-sm text-gray-600">{t('products.unit')}: {isRtl ? item.product.unit : item.product.unitEn}</p>
                          <p className="text-sm text-gray-600 font-bold flex items-center gap-1">
                            <span className="text-amber-600">📂</span> {t('departments.title')}: {isRtl ? item.product.department?.name : item.product.department?.nameEn}
                          </p>
                          <p
                            className={`text-sm font-medium ${
                              item.status === 'low'
                                ? 'text-red-600'
                                : item.status === 'full'
                                ? 'text-yellow-600'
                                : 'text-green-600'
                            }`}
                          >
                            {t(`inventory.${item.status}`)}
                          </p>
                        </div>
                        <div className="flex gap-2 justify-end sm:justify-start">
                          <CustomButton
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenDetailsModal(item)}
                            className="text-green-600 hover:text-green-800"
                            ariaLabel={t('inventory.view_details')}
                          >
                            <Eye className="w-4 h-4" />
                          </CustomButton>
                          <CustomButton
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenEditModal(item)}
                            className="text-blue-600 hover:text-blue-800"
                            ariaLabel={t('inventory.edit_stock_limits')}
                          >
                            <Edit className="w-4 h-4" />
                          </CustomButton>
                          <CustomButton
                            variant="destructive"
                            size="sm"
                            disabled={item.currentStock <= 0}
                            onClick={() => handleOpenReturnModal(item)}
                            className="text-red-600 hover:text-red-800 disabled:opacity-50"
                            ariaLabel={t('returns.create')}
                          >
                            {t('returns.create')}
                          </CustomButton>
                        </div>
                      </div>
                    </CustomCard>
                  </motion.div>
                ) : null
              )}
            </AnimatePresence>
            <Pagination totalPages={totalInventoryPages} currentPage={currentPage} setCurrentPage={setCurrentPage} isRtl={isRtl} />
          </div>
        )}
      </motion.div>

      <CustomModal
        isOpen={isReturnModalOpen}
        onClose={() => {
          setIsReturnModalOpen(false);
          setReturnForm({ productId: '', quantity: 1, reason: '', notes: '' });
          setReturnErrors({});
          setSelectedItem(null);
        }}
        title={t('returns.create')}
      >
        <div className="flex flex-col gap-4">
          {selectedItem?.product && (
            <p className="text-sm text-gray-600">
              {t('products.title')}: {isRtl ? selectedItem.product.name : selectedItem.product.nameEn}
            </p>
          )}
          <CustomSelect
            label={t('returns.item')}
            value={returnForm.productId}
            onChange={(e) => setReturnForm({ ...returnForm, productId: e.target.value })}
            options={[{ value: '', label: t('products.select') }].concat(
              inventoryData?.filter((item) => item.currentStock > 0 && item.product).map((item) => ({
                value: item.product!._id,
                label: `${isRtl ? item.product!.name : item.product!.nameEn} (${item.currentStock} ${t('common.available')}) - [${
                  isRtl ? item.product!.department?.name : item.product!.department?.nameEn
                }]`,
              })) || []
            )}
            error={returnErrors.productId}
            disabled={!!selectedItem}
            ariaLabel={t('returns.item')}
          />
          <CustomInput
            label={t('returns.quantity')}
            type="number"
            min={1}
            value={returnForm.quantity}
            onChange={(e) => setReturnForm({ ...returnForm, quantity: Number(e.target.value) })}
            error={returnErrors.quantity}
            className="w-20 sm:w-24"
            ariaLabel={t('returns.quantity')}
          />
          <CustomSelect
            label={t('returns.reason')}
            value={returnForm.reason}
            onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })}
            options={reasonOptions}
            error={returnErrors.reason}
            ariaLabel={t('returns.reason')}
          />
          <CustomInput
            label={t('returns.notes')}
            value={returnForm.notes}
            onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
            placeholder={t('returns.notes_placeholder')}
            ariaLabel={t('returns.notes')}
          />
          {returnErrors.form && <p className="text-red-500 text-xs">{returnErrors.form}</p>}
          <div className={`flex justify-end gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <CustomButton
              variant="secondary"
              onClick={() => {
                setIsReturnModalOpen(false);
                setReturnForm({ productId: '', quantity: 1, reason: '', notes: '' });
                setReturnErrors({});
                setSelectedItem(null);
              }}
              ariaLabel={t('common.cancel')}
            >
              {t('common.cancel')}
            </CustomButton>
            <CustomButton
              onClick={() => createReturnMutation.mutate()}
              disabled={createReturnMutation.isPending}
              className="relative disabled:opacity-50"
              ariaLabel={t('common.submit')}
            >
              {createReturnMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t('common.submitting')}
                </span>
              ) : (
                t('common.submit')
              )}
            </CustomButton>
          </div>
        </div>
      </CustomModal>

      <CustomModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditForm({ minStockLevel: 0, maxStockLevel: 1000 });
          setEditErrors({});
          setSelectedItem(null);
        }}
        title={t('inventory.edit_stock_limits')}
      >
        <div className="flex flex-col gap-4">
          {selectedItem?.product && (
            <p className="text-sm text-gray-600">
              {t('products.title')}: {isRtl ? selectedItem.product.name : selectedItem.product.nameEn}
            </p>
          )}
          <CustomInput
            label={t('inventory.min_stock')}
            type="number"
            min={0}
            value={editForm.minStockLevel}
            onChange={(e) => setEditForm({ ...editForm, minStockLevel: Number(e.target.value) })}
            error={editErrors.minStockLevel}
            ariaLabel={t('inventory.min_stock')}
          />
          <CustomInput
            label={t('inventory.max_stock')}
            type="number"
            min={0}
            value={editForm.maxStockLevel}
            onChange={(e) => setEditForm({ ...editForm, maxStockLevel: Number(e.target.value) })}
            error={editErrors.maxStockLevel}
            ariaLabel={t('inventory.max_stock')}
          />
          {editErrors.form && <p className="text-red-500 text-xs">{editErrors.form}</p>}
          <div className={`flex justify-end gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <CustomButton
              variant="secondary"
              onClick={() => {
                setIsEditModalOpen(false);
                setEditForm({ minStockLevel: 0, maxStockLevel: 1000 });
                setEditErrors({});
                setSelectedItem(null);
              }}
              ariaLabel={t('common.cancel')}
            >
              {t('common.cancel')}
            </CustomButton>
            <CustomButton
              onClick={() => updateInventoryMutation.mutate()}
              disabled={updateInventoryMutation.isPending}
              className="relative disabled:opacity-50"
              ariaLabel={t('common.save')}
            >
              {updateInventoryMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t('common.saving')}
                </span>
              ) : (
                t('common.save')
              )}
            </CustomButton>
          </div>
        </div>
      </CustomModal>

      <CustomModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedProductId('');
        }}
        title={t('inventory.product_details')}
      >
        <div className="flex flex-col gap-4">
          {historyLoading ? (
            <div className="text-center text-gray-600 flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5 text-gray-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {t('common.loading')}
            </div>
          ) : productHistory && productHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 text-left font-medium">{t('common.date')}</th>
                    <th className="p-2 text-left font-medium">{t('common.type')}</th>
                    <th className="p-2 text-left font-medium">{t('inventory.quantity')}</th>
                    <th className="p-2 text-left font-medium">{t('common.description')}</th>
                  </tr>
                </thead>
                <tbody>
                  {productHistory
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((entry) => (
                      <tr key={entry._id} className="border-b hover:bg-gray-50">
                        <td className="p-2">{new Date(entry.date).toLocaleString()}</td>
                        <td className="p-2">{t(`inventory.${entry.type}`)}</td>
                        <td className="p-2">{entry.quantity}</td>
                        <td className="p-2">{entry.description}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-600 text-sm">{t('inventory.no_history')}</p>
          )}
        </div>
      </CustomModal>
    </div>
  );
};

export default BranchInventory;
