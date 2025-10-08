import React, { useState, useMemo, useCallback, useEffect, useReducer } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useNotifications } from '../contexts/NotificationContext';
import { returnsAPI, inventoryAPI } from '../services/api';
import { Package, AlertCircle, Search, Edit, X, Plus, Eye, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ProductSearchInput, ProductDropdown } from './NewOrder'; // Reused components

// Enums for type safety
enum InventoryStatus {
  LOW = 'low',
  NORMAL = 'normal',
  FULL = 'full',
}

enum ReturnReason {
  DAMAGED = 'تالف',
  WRONG_ITEM = 'منتج خاطئ',
  EXCESS_QUANTITY = 'كمية زائدة',
  OTHER = 'أخرى',
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
    displayName: string;
    displayUnit: string;
  } | null;
  branch: { _id: string; name: string; nameEn: string; displayName: string } | null;
  currentStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  status: InventoryStatus;
}

interface ReturnItem {
  productId: string;
  quantity: number;
  reason: string;
  maxQuantity: number;
}

interface ReturnFormState {
  notes: string;
  items: ReturnItem[];
}

interface ProductHistoryEntry {
  _id: string;
  date: string;
  type: 'delivery' | 'return_pending' | 'return_rejected' | 'return_approved' | 'sale' | 'adjustment';
  quantity: number;
  description: string;
  referenceType?: 'order' | 'return' | 'sale' | 'adjustment';
  referenceId?: string;
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

// Translations
const translations = {
  ar: {
    title: 'إدارة المخزون',
    description: 'إدارة مخزون الفرع وطلبات الإرجاع',
    noItems: 'لا توجد عناصر في المخزون',
    noHistory: 'لا يوجد سجل لهذا المنتج',
    stock: 'المخزون الحالي',
    minStock: 'الحد الأدنى للمخزون',
    maxStock: 'الحد الأقصى للمخزون',
    unit: 'الوحدة',
    lowStock: 'مخزون منخفض',
    normal: 'عادي',
    full: 'مخزون ممتلئ',
    create: 'إنشاء طلب إرجاع',
    viewDetails: 'عرض التفاصيل',
    editStockLimits: 'تعديل حدود المخزون',
    search: 'البحث عن المنتجات...',
    filterByStatus: 'تصفية حسب الحالة',
    filterByDepartment: 'تصفية حسب القسم',
    allStatuses: 'جميع الحالات',
    allDepartments: 'جميع الأقسام',
    reason: 'سبب الإرجاع',
    selectReason: 'اختر السبب',
    damaged: 'تالف',
    wrongItem: 'منتج خاطئ',
    excessQuantity: 'كمية زائدة',
    other: 'أخرى',
    notes: 'ملاحظات',
    notesPlaceholder: 'أدخل ملاحظات إضافية (اختياري)',
    items: 'العناصر',
    addItem: 'إضافة عنصر',
    removeItem: 'إزالة العنصر',
    submit: 'إرسال',
    submitting: 'جاري الإرسال...',
    cancel: 'إلغاء',
    save: 'حفظ',
    saving: 'جاري الحفظ...',
    retry: 'إعادة المحاولة',
    productDetails: 'تفاصيل المنتج',
    date: 'التاريخ',
    type: 'النوع',
    quantity: 'الكمية',
    description: 'الوصف',
    delivery: 'تسليم',
    return_pending: 'إرجاع قيد الانتظار',
    return_rejected: 'إرجاع مرفوض',
    return_approved: 'إرجاع موافق عليه',
    sale: 'بيع',
    adjustment: 'تعديل',
    available: 'متوفر',
    errors: {
      noBranch: 'لم يتم العثور على فرع',
      fetchInventory: 'خطأ في جلب بيانات المخزون',
      createReturn: 'خطأ في إنشاء طلب الإرجاع',
      updateInventory: 'خطأ في تحديث المخزون',
      invalidForm: 'البيانات المدخلة غير صالحة',
      required: 'حقل {field} مطلوب',
      nonNegative: 'يجب أن يكون {field} غير سالب',
      maxGreaterMin: 'الحد الأقصى للمخزون يجب أن يكون أكبر من الحد الأدنى',
      invalidQuantityMax: 'الكمية يجب أن تكون بين 1 و{max}',
      noItemSelected: 'لم يتم اختيار عنصر',
      insufficientQuantity: 'الكمية غير كافية للمنتج في المخزون',
    },
    notifications: {
      returnApproved: 'تمت الموافقة على طلب الإرجاع',
      returnRejected: 'تم رفض طلب الإرجاع',
    },
  },
  en: {
    title: 'Inventory Management',
    description: 'Manage branch inventory and return requests',
    noItems: 'No items found in inventory',
    noHistory: 'No history available for this product',
    stock: 'Current Stock',
    minStock: 'Minimum Stock',
    maxStock: 'Maximum Stock',
    unit: 'Unit',
    lowStock: 'Low Stock',
    normal: 'Normal',
    full: 'Full Stock',
    create: 'Create Return Request',
    viewDetails: 'View Details',
    editStockLimits: 'Edit Stock Limits',
    search: 'Search products...',
    filterByStatus: 'Filter by Status',
    filterByDepartment: 'Filter by Department',
    allStatuses: 'All Statuses',
    allDepartments: 'All Departments',
    reason: 'Return Reason',
    selectReason: 'Select Reason',
    damaged: 'Damaged',
    wrongItem: 'Wrong Item',
    excessQuantity: 'Excess Quantity',
    other: 'Other',
    notes: 'Notes',
    notesPlaceholder: 'Enter additional notes (optional)',
    items: 'Items',
    addItem: 'Add Item',
    removeItem: 'Remove Item',
    submit: 'Submit',
    submitting: 'Submitting...',
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving...',
    retry: 'Retry',
    productDetails: 'Product Details',
    date: 'Date',
    type: 'Type',
    quantity: 'Quantity',
    description: 'Description',
    delivery: 'Delivery',
    return_pending: 'Return Pending',
    return_rejected: 'Return Rejected',
    return_approved: 'Return Approved',
    sale: 'Sale',
    adjustment: 'Adjustment',
    available: 'Available',
    errors: {
      noBranch: 'No branch found',
      fetchInventory: 'Error fetching inventory data',
      createReturn: 'Error creating return request',
      updateInventory: 'Error updating inventory',
      invalidForm: 'Invalid form data',
      required: '{field} is required',
      nonNegative: '{field} must be non-negative',
      maxGreaterMin: 'Maximum stock must be greater than minimum stock',
      invalidQuantityMax: 'Quantity must be between 1 and {max}',
      noItemSelected: 'No item selected',
      insufficientQuantity: 'Insufficient quantity for the product in inventory',
    },
    notifications: {
      returnApproved: 'Return request approved',
      returnRejected: 'Return request rejected',
    },
  },
};

// QuantityInput Component (Fixed decrement icon to Minus and handled invalid inputs)
const QuantityInput = ({
  value,
  onChange,
  onIncrement,
  onDecrement,
  max,
}: {
  value: number;
  onChange: (val: string) => void;
  onIncrement: () => void;
  onDecrement: () => void;
  max?: number;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const handleChange = (val: string) => {
    const num = parseInt(val, 10);
    if (val === '' || isNaN(num) || num < 1) {
      onChange('1');
      return;
    }
    if (max !== undefined && num > max) {
      onChange(max.toString());
      return;
    }
    onChange(val);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onDecrement}
        className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors duration-200 flex items-center justify-center"
        aria-label={isRtl ? 'تقليل الكمية' : 'Decrease quantity'}
        disabled={value <= 1}
      >
        <Minus className="w-4 h-4" />
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        max={max}
        min={1}
        className="w-12 h-8 text-center border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm min-w-[2.75rem] transition-all duration-200"
        style={{ appearance: 'none' }}
        aria-label={isRtl ? 'الكمية' : 'Quantity'}
      />
      <button
        onClick={onIncrement}
        className="w-8 h-8 bg-amber-600 hover:bg-amber-700 rounded-full transition-colors duration-200 flex items-center justify-center"
        aria-label={isRtl ? 'زيادة الكمية' : 'Increase quantity'}
        disabled={max !== undefined && value >= max}
      >
        <Plus className="w-4 h-4 text-white" />
      </button>
    </div>
  );
};

// Reducer for return form
type ReturnFormAction =
  | { type: 'SET_NOTES'; payload: string }
  | { type: 'ADD_ITEM'; payload: ReturnItem }
  | { type: 'UPDATE_ITEM'; payload: { index: number; field: keyof ReturnItem; value: string | number } }
  | { type: 'REMOVE_ITEM'; payload: number }
  | { type: 'RESET' };

const returnFormReducer = (state: ReturnFormState, action: ReturnFormAction): ReturnFormState => {
  switch (action.type) {
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
      return { notes: '', items: [] };
    default:
      return state;
  }
};

export const BranchInventory: React.FC = () => {
  const { t: languageT, language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const { user } = useAuth();
  const { socket } = useSocket();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<InventoryStatus | ''>('');
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [returnForm, dispatchReturnForm] = useReducer(returnFormReducer, { notes: '', items: [] });
  const [editForm, setEditForm] = useState<EditForm>({ minStockLevel: 0, maxStockLevel: 0 });
  const [returnErrors, setReturnErrors] = useState<Record<string, string>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);

  const ITEMS_PER_PAGE = 10;

  // Custom debounce hook
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

  // Inventory Query
  const { data: inventoryData, isLoading: inventoryLoading, error: inventoryError, refetch: refetchInventory } = useQuery<
    InventoryItem[],
    Error
  >({
    queryKey: ['inventory', user?.branchId, debouncedSearchQuery, filterStatus, filterDepartment, currentPage, language],
    queryFn: async () => {
      if (!user?.branchId) throw new Error(t.errors.noBranch);
      const response = await inventoryAPI.getByBranch(user.branchId);
      return response;
    },
    enabled: !!user?.branchId,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    select: (response) => {
      const inventoryData = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
        ? response.data
        : response?.data?.inventory || [];
      return inventoryData.map((item: InventoryItem) => ({
        ...item,
        product: item.product
          ? {
              ...item.product,
              displayName: isRtl ? item.product.name : item.product.nameEn || item.product.name,
              displayUnit: isRtl ? (item.product.unit || 'غير محدد') : item.product.unitEn || item.product.unit || 'N/A',
              department: item.product.department
                ? {
                    ...item.product.department,
                    displayName: isRtl ? item.product.department.name : item.product.department.nameEn || item.product.department.name,
                  }
                : null,
            }
          : null,
        branch: item.branch
          ? {
              ...item.branch,
              displayName: isRtl ? item.branch.name : item.branch.nameEn || item.branch.name,
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
      toast.error(err.message || t.errors.fetchInventory, { position: isRtl ? 'top-right' : 'top-left' });
    },
  });

  // Product History Query
  const { data: productHistory, isLoading: historyLoading } = useQuery<ProductHistoryEntry[], Error>({
    queryKey: ['productHistory', selectedProductId, user?.branchId],
    queryFn: async () => {
      if (!selectedProductId || !user?.branchId) throw new Error(t.errors.noBranch);
      const response = await inventoryAPI.getHistory({ productId: selectedProductId, branchId: user.branchId });
      return response;
    },
    enabled: isDetailsModalOpen && !!selectedProductId && !!user?.branchId,
    staleTime: 5 * 60 * 1000,
  });

  // Update available items
  useEffect(() => {
    if (inventoryData) {
      const items: AvailableItem[] = inventoryData
        .filter((item) => item.currentStock > 0 && item.product)
        .map((item) => ({
          productId: item.product!._id,
          productName: isRtl ? item.product!.name : item.product!.nameEn || item.product!.name,
          available: item.currentStock,
          unit: isRtl ? item.product!.unit || t.unit : item.product!.unitEn || item.product!.unit || 'N/A',
          departmentName: isRtl
            ? item.product!.department?.name || t.departments?.unknown || 'Unknown'
            : item.product!.department?.nameEn || item.product!.department?.name || t.departments?.unknown || 'Unknown',
          stock: item.currentStock,
        }));
      setAvailableItems(items);
    }
  }, [inventoryData, isRtl, t]);

  // Socket Events
  useEffect(() => {
    if (!socket || !user?.branchId) return;

    const handleInventoryUpdated = ({ branchId }: { branchId: string }) => {
      if (branchId === user.branchId) {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
      }
    };

    const handleReturnStatusUpdated = ({ branchId, returnId, status }: { branchId: string; returnId: string; status: string }) => {
      if (branchId === user.branchId) {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        addNotification({
          _id: crypto.randomUUID(),
          type: status === 'approved' ? 'success' : 'error',
          message: status === 'approved' ? t.notifications.returnApproved : t.notifications.returnRejected,
          data: { returnId, eventId: crypto.randomUUID() },
          read: false,
          createdAt: new Date().toISOString(),
          sound: '/sounds/notification.mp3',
          vibrate: [200, 100, 200],
        });
        toast[status === 'approved' ? 'success' : 'error'](
          status === 'approved' ? t.notifications.returnApproved : t.notifications.returnRejected,
          { position: isRtl ? 'top-right' : 'top-left' }
        );
      }
    };

    socket.on('inventoryUpdated', handleInventoryUpdated);
    socket.on('returnStatusUpdated', handleReturnStatusUpdated);

    return () => {
      socket.off('inventoryUpdated', handleInventoryUpdated);
      socket.off('returnStatusUpdated', handleReturnStatusUpdated);
    };
  }, [socket, user, queryClient, addNotification, t, isRtl]);

  // Department options
  const departmentOptions = useMemo(() => {
    const depts = new Set<string>();
    const deptMap: Record<string, { _id: string; name: string }> = {};
    inventoryData?.forEach((item) => {
      if (item.product?.department?._id) {
        const deptKey = item.product.department._id;
        if (!deptMap[deptKey]) {
          deptMap[deptKey] = {
            _id: deptKey,
            name: isRtl ? item.product.department.name : item.product.department.nameEn || item.product.department.name,
          };
          depts.add(deptKey);
        }
      }
    });
    const uniqueDepts = Array.from(depts).map((deptId) => deptMap[deptId]);
    return [
      { value: '', label: t.allDepartments },
      ...uniqueDepts.map((dept) => ({
        value: dept._id,
        label: dept.name || t.departments?.unknown || 'Unknown',
      })),
    ];
  }, [inventoryData, isRtl, t]);

  // Status options
  const statusOptions = useMemo(
    () => [
      { value: '', label: t.allStatuses },
      { value: InventoryStatus.LOW, label: t.lowStock },
      { value: InventoryStatus.NORMAL, label: t.normal },
      { value: InventoryStatus.FULL, label: t.full },
    ],
    [t]
  );

  // Reason options
  const reasonOptions = useMemo(
    () => [
      { value: '', label: t.selectReason },
      { value: ReturnReason.DAMAGED, label: t.damaged },
      { value: ReturnReason.WRONG_ITEM, label: t.wrongItem },
      { value: ReturnReason.EXCESS_QUANTITY, label: t.excessQuantity },
      { value: ReturnReason.OTHER, label: t.other },
    ],
    [t]
  );

  // Filtered and paginated inventory
  const filteredInventory = useMemo(
    () =>
      (inventoryData || []).filter(
        (item) =>
          item.product &&
          (!filterStatus || item.status === filterStatus) &&
          (!filterDepartment || item.product.department?._id === filterDepartment) &&
          (item.product.displayName.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
            item.product.code.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
            (item.product.department?.displayName?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ?? false))
      ),
    [inventoryData, debouncedSearchQuery, filterStatus, filterDepartment]
  );

  const paginatedInventory = useMemo(
    () => filteredInventory.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredInventory, currentPage]
  );

  const totalInventoryPages = Math.ceil(filteredInventory.length / ITEMS_PER_PAGE);

  // Handlers
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    setCurrentPage(1);
  }, []);

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

  const handleOpenDetailsModal = useCallback((item: InventoryItem) => {
    if (item.product) {
      setSelectedProductId(item.product._id);
      setIsDetailsModalOpen(true);
    }
  }, []);

  const addItemToForm = useCallback(() => {
    dispatchReturnForm({
      type: 'ADD_ITEM',
      payload: { productId: '', quantity: 1, reason: '', maxQuantity: 0 },
    });
  }, []);

  const updateItemInForm = useCallback(
    (index: number, field: keyof ReturnItem, value: string | number) => {
      if (field === 'quantity' && typeof value === 'string') {
        const numValue = parseInt(value);
        if (isNaN(numValue) || numValue < 1) return; // Prevent invalid or negative quantities
        value = numValue;
      }
      dispatchReturnForm({ type: 'UPDATE_ITEM', payload: { index, field, value } });
    },
    []
  );

  const handleProductChange = useCallback(
    (index: number, productId: string) => {
      const inventoryItem = inventoryData?.find((inv) => inv.product?._id === productId);
      dispatchReturnForm({
        type: 'UPDATE_ITEM',
        payload: { index, field: 'productId', value: productId },
      });
      dispatchReturnForm({
        type: 'UPDATE_ITEM',
        payload: { index, field: 'maxQuantity', value: inventoryItem?.currentStock || 0 },
      });
    },
    [inventoryData]
  );

  const removeItemFromForm = useCallback((index: number) => {
    dispatchReturnForm({ type: 'REMOVE_ITEM', payload: index });
  }, []);

  const validateReturnForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (returnForm.items.length === 0) errors.items = t.errors.required.replace('{field}', t.items);
    returnForm.items.forEach((item, index) => {
      if (!item.productId) errors[`item_${index}_productId`] = t.errors.required.replace('{field}', t.items);
      if (!item.reason) errors[`item_${index}_reason`] = t.errors.required.replace('{field}', t.reason);
      if (item.quantity < 1 || item.quantity > item.maxQuantity || isNaN(item.quantity)) {
        errors[`item_${index}_quantity`] = t.errors.invalidQuantityMax.replace('{max}', item.maxQuantity.toString());
      }
      const inventoryItem = inventoryData?.find((inv) => inv.product?._id === item.productId);
      if (inventoryItem && item.quantity > inventoryItem.currentStock) {
        errors[`item_${index}_quantity`] = t.errors.insufficientQuantity;
      }
    });
    setReturnErrors(errors);
    return Object.keys(errors).length === 0;
  }, [returnForm, t, inventoryData]);

  const validateEditForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (editForm.minStockLevel < 0) errors.minStockLevel = t.errors.nonNegative.replace('{field}', t.minStock);
    if (editForm.maxStockLevel < 0) errors.maxStockLevel = t.errors.nonNegative.replace('{field}', t.maxStock);
    if (editForm.maxStockLevel <= editForm.minStockLevel) errors.maxStockLevel = t.errors.maxGreaterMin;
    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  }, [editForm, t]);

  const createReturnMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      if (!validateReturnForm()) throw new Error(t.errors.invalidForm);
      if (!user?.branchId) throw new Error(t.errors.noBranch);
      const data = {
        branchId: user.branchId,
        items: returnForm.items.map((item) => ({
          product: item.productId,
          quantity: item.quantity,
          reason: item.reason,
        })),
        notes: returnForm.notes || undefined,
      };
      await returnsAPI.createReturn(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setIsReturnModalOpen(false);
      dispatchReturnForm({ type: 'RESET' });
      setReturnErrors({});
      setSelectedItem(null);
      toast.success(t.create, { position: isRtl ? 'top-right' : 'top-left' });
      socket?.emit('returnCreated', {
        branchId: user?.branchId,
        returnId: crypto.randomUUID(),
        status: 'pending_approval',
        eventId: crypto.randomUUID(),
      });
    },
    onError: (err) => {
      let errorMessage = err.message || t.errors.createReturn;
      if (err.message.includes('الفرع غير موجود')) errorMessage = t.errors.noBranch;
      if (err.message.includes('الكمية غير كافية')) errorMessage = t.errors.insufficientQuantity;
      if (err.message.includes('بيانات العنصر غير صالحة')) errorMessage = t.errors.invalidForm;
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
      setReturnErrors({ form: errorMessage });
    },
  });

  const updateInventoryMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      if (!validateEditForm()) throw new Error(t.errors.invalidForm);
      if (!selectedItem) throw new Error(t.errors.noItemSelected);
      if (!user?.branchId && !selectedItem.branch?._id) throw new Error(t.errors.noBranch);
      await inventoryAPI.updateStock(selectedItem._id, {
        minStockLevel: editForm.minStockLevel,
        maxStockLevel: editForm.maxStockLevel,
        branchId: selectedItem.branch?._id || user?.branchId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setIsEditModalOpen(false);
      setEditForm({ minStockLevel: 0, maxStockLevel: 0 });
      setEditErrors({});
      setSelectedItem(null);
      toast.success(t.save, { position: isRtl ? 'top-right' : 'top-left' });
      socket?.emit('inventoryUpdated', {
        branchId: selectedItem?.branch?._id || user?.branchId,
        productId: selectedItem?.product?._id,
        minStockLevel: editForm.minStockLevel,
        maxStockLevel: editForm.maxStockLevel,
        eventId: crypto.randomUUID(),
      });
    },
    onError: (err) => {
      const errorMessage = err.message || t.errors.updateInventory;
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
      setEditErrors({ form: errorMessage });
    },
  });

  const errorMessage = inventoryError?.message || '';

  return (
    <div
      className="container mx-auto px-4 py-8 min-h-screen bg-gradient-to-br from-amber-50 to-gray-50"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center gap-3">
          <Package className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
            <p className="text-gray-600 text-sm">{t.description}</p>
          </div>
        </div>
        <button
          onClick={() => handleOpenReturnModal()}
          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2 shadow-sm"
          aria-label={t.create}
        >
          <Plus className="w-4 h-4" />
          {t.create}
        </button>
      </div>

      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm font-medium">{errorMessage}</span>
          <button
            onClick={() => refetchInventory()}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200"
            aria-label={t.retry}
          >
            {t.retry}
          </button>
        </motion.div>
      )}

      <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          <ProductSearchInput
            value={searchInput}
            onChange={handleSearchChange}
            placeholder={t.search}
            ariaLabel={t.search}
            className="w-full"
          />
          <ProductDropdown
            value={filterStatus}
            onChange={(value) => {
              setFilterStatus(value as InventoryStatus | '');
              setCurrentPage(1);
            }}
            options={statusOptions}
            ariaLabel={t.filterByStatus}
            className="w-full"
          />
          <ProductDropdown
            value={filterDepartment}
            onChange={(value) => {
              setFilterDepartment(value);
              setCurrentPage(1);
            }}
            options={departmentOptions}
            ariaLabel={t.filterByDepartment}
            className="w-full"
          />
        </div>
        <div className="mt-4 text-center text-sm text-gray-600 font-medium">
          {isRtl ? `عدد العناصر: ${filteredInventory.length}` : `Items Count: ${filteredInventory.length}`}
        </div>
      </div>

      {inventoryLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-5 bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="space-y-3 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                </div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                <div className="mt-4 flex justify-end">
                  <div className="h-8 bg-gray-200 rounded-lg w-24"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : paginatedInventory.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-sm font-medium">{t.noItems}</p>
          <button
            onClick={() => handleOpenReturnModal()}
            className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200"
            aria-label={t.create}
          >
            {t.create}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {paginatedInventory.map((item) =>
              item.product ? (
                <motion.div
                  key={item._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-amber-200"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-bold text-gray-900 text-base truncate" style={{ fontWeight: 700 }}>
                        {item.product.displayName}
                      </h3>
                      <p className="text-sm text-gray-500">{item.product.code}</p>
                    </div>
                    <p className="text-sm text-amber-600">{t.filterByDepartment}: {item.product.department?.displayName || 'N/A'}</p>
                    <p className="text-sm text-gray-600">{t.stock}: {item.currentStock}</p>
                    <p className="text-sm text-gray-600">{t.minStock}: {item.minStockLevel}</p>
                    <p className="text-sm text-gray-600">{t.maxStock}: {item.maxStockLevel}</p>
                    <p className="text-sm text-gray-600">{t.unit}: {item.product.displayUnit}</p>
                    <p
                      className={`text-sm font-medium ${
                        item.status === InventoryStatus.LOW
                          ? 'text-red-600'
                          : item.status === InventoryStatus.FULL
                          ? 'text-yellow-600'
                          : 'text-green-600'
                      }`}
                    >
                      {t[item.status]}
                    </p>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      onClick={() => handleOpenDetailsModal(item)}
                      className="px-3 py-1.5 text-green-600 hover:text-green-800 rounded-lg text-sm transition-colors duration-200"
                      aria-label={t.viewDetails}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenEditModal(item)}
                      className="px-3 py-1.5 text-blue-600 hover:text-blue-800 rounded-lg text-sm transition-colors duration-200"
                      aria-label={t.editStockLimits}
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenReturnModal(item)}
                      disabled={item.currentStock <= 0}
                      className="px-3 py-1.5 text-red-600 hover:text-red-800 rounded-lg text-sm transition-colors duration-200 disabled:opacity-50"
                      aria-label={t.create}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ) : null
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="mt-6">
        {totalInventoryPages > 1 && (
          <div className={`flex items-center justify-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <button
              onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
              disabled={currentPage === 1}
              aria-label={isRtl ? 'الصفحة السابقة' : 'Previous page'}
            >
              {isRtl ? 'السابق' : 'Previous'}
            </button>
            <span className="text-gray-700 font-medium">
              {isRtl ? `الصفحة ${currentPage} من ${totalInventoryPages}` : `Page ${currentPage} of ${totalInventoryPages}`}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(currentPage + 1, totalInventoryPages))}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
              disabled={currentPage === totalInventoryPages}
              aria-label={isRtl ? 'الصفحة التالية' : 'Next page'}
            >
              {isRtl ? 'التالي' : 'Next'}
            </button>
          </div>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isReturnModalOpen ? 1 : 0 }}
        className={`fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 ${isReturnModalOpen ? '' : 'pointer-events-none'}`}
        role="dialog"
        aria-modal="true"
        aria-label={t.create}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: isReturnModalOpen ? 1 : 0.95, y: isReturnModalOpen ? 0 : 20 }}
          className="bg-white p-6 rounded-xl shadow-2xl max-w-[95vw] sm:max-w-lg w-full"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">{t.create}</h2>
            <button
              onClick={() => {
                setIsReturnModalOpen(false);
                dispatchReturnForm({ type: 'RESET' });
                setReturnErrors({});
                setSelectedItem(null);
              }}
              className="p-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors duration-200"
              aria-label={t.cancel}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-4">
            {selectedItem?.product && (
              <p className="text-sm text-gray-600">
                {t.products?.title || 'Product'}: {isRtl ? selectedItem.product.name : selectedItem.product.nameEn}
              </p>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.notes}</label>
              <textarea
                value={returnForm.notes}
                onChange={(e) => dispatchReturnForm({ type: 'SET_NOTES', payload: e.target.value })}
                placeholder={t.notesPlaceholder}
                className={`w-full ${isRtl ? 'text-right' : 'text-left'} p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 bg-white shadow-sm h-24 resize-none`}
                aria-label={t.notes}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.items}</label>
              {returnForm.items.map((item, index) => (
                <div
                  key={index}
                  className={`flex flex-col sm:flex-row gap-3 mb-4 items-start sm:items-center flex-wrap ${isRtl ? 'sm:flex-row-reverse' : ''}`}
                >
                  <ProductDropdown
                    value={item.productId}
                    onChange={(value) => handleProductChange(index, value)}
                    options={[{ value: '', label: t.products?.select || 'Select Product' }].concat(
                      availableItems.map((a) => ({
                        value: a.productId,
                        label: `${a.productName} (${a.stock} ${t.available}) - [${a.departmentName}]`,
                      }))
                    )}
                    disabled={!!selectedItem}
                    ariaLabel={t.products?.select || 'Select Product'}
                    className="w-full sm:w-auto"
                  />
                  {returnErrors[`item_${index}_productId`] && (
                    <p className="text-red-500 text-xs">{returnErrors[`item_${index}_productId`]}</p>
                  )}
                  <QuantityInput
                    value={item.quantity}
                    onChange={(val) => updateItemInForm(index, 'quantity', val)}
                    onIncrement={() => updateItemInForm(index, 'quantity', item.quantity + 1)}
                    onDecrement={() => updateItemInForm(index, 'quantity', item.quantity - 1)}
                    max={item.maxQuantity}
                  />
                  {returnErrors[`item_${index}_quantity`] && (
                    <p className="text-red-500 text-xs">{returnErrors[`item_${index}_quantity`]}</p>
                  )}
                  <ProductDropdown
                    value={item.reason}
                    onChange={(value) => updateItemInForm(index, 'reason', value)}
                    options={reasonOptions}
                    ariaLabel={t.reason}
                    className="w-full sm:w-auto"
                  />
                  {returnErrors[`item_${index}_reason`] && (
                    <p className="text-red-500 text-xs">{returnErrors[`item_${index}_reason`]}</p>
                  )}
                  <button
                    onClick={() => removeItemFromForm(index)}
                    disabled={!!selectedItem && returnForm.items.length === 1}
                    className="w-8 h-8 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors duration-200 flex items-center justify-center disabled:opacity-50"
                    aria-label={t.removeItem}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {returnErrors.items && <p className="text-red-500 text-xs">{returnErrors.items}</p>}
              {!selectedItem && (
                <button
                  onClick={addItemToForm}
                  disabled={availableItems.length === 0}
                  className="mt-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2 disabled:opacity-50"
                  aria-label={t.addItem}
                >
                  <Plus className="w-4 h-4" />
                  {t.addItem}
                </button>
              )}
            </div>
            {returnErrors.form && <p className="text-red-500 text-xs">{returnErrors.form}</p>}
            <div className={`flex justify-end gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <button
                onClick={() => {
                  setIsReturnModalOpen(false);
                  dispatchReturnForm({ type: 'RESET' });
                  setReturnErrors({});
                  setSelectedItem(null);
                }}
                className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors duration-200"
                aria-label={t.cancel}
              >
                {t.cancel}
              </button>
              <button
                onClick={() => createReturnMutation.mutate()}
                disabled={createReturnMutation.isPending}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
                aria-label={createReturnMutation.isPending ? t.submitting : t.submit}
              >
                {createReturnMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {t.submitting}
                  </span>
                ) : (
                  t.submit
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isEditModalOpen ? 1 : 0 }}
        className={`fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 ${isEditModalOpen ? '' : 'pointer-events-none'}`}
        role="dialog"
        aria-modal="true"
        aria-label={t.editStockLimits}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: isEditModalOpen ? 1 : 0.95, y: isEditModalOpen ? 0 : 20 }}
          className="bg-white p-6 rounded-xl shadow-2xl max-w-[95vw] sm:max-w-md w-full"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">{t.editStockLimits}</h2>
            <button
              onClick={() => {
                setIsEditModalOpen(false);
                setEditForm({ minStockLevel: 0, maxStockLevel: 0 });
                setEditErrors({});
                setSelectedItem(null);
              }}
              className="p-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors duration-200"
              aria-label={t.cancel}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-4">
            {selectedItem?.product && (
              <p className="text-sm text-gray-600">
                {t.products?.title || 'Product'}: {isRtl ? selectedItem.product.name : selectedItem.product.nameEn}
              </p>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.minStock}</label>
              <input
                type="number"
                min={0}
                value={editForm.minStockLevel}
                onChange={(e) => setEditForm({ ...editForm, minStockLevel: Number(e.target.value) })}
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm transition-all duration-200"
                aria-label={t.minStock}
              />
              {editErrors.minStockLevel && <p className="text-red-500 text-xs mt-1">{editErrors.minStockLevel}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.maxStock}</label>
              <input
                type="number"
                min={0}
                value={editForm.maxStockLevel}
                onChange={(e) => setEditForm({ ...editForm, maxStockLevel: Number(e.target.value) })}
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm transition-all duration-200"
                aria-label={t.maxStock}
              />
              {editErrors.maxStockLevel && <p className="text-red-500 text-xs mt-1">{editErrors.maxStockLevel}</p>}
            </div>
            {editErrors.form && <p className="text-red-500 text-xs">{editErrors.form}</p>}
            <div className={`flex justify-end gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditForm({ minStockLevel: 0, maxStockLevel: 0 });
                  setEditErrors({});
                  setSelectedItem(null);
                }}
                className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors duration-200"
                aria-label={t.cancel}
              >
                {t.cancel}
              </button>
              <button
                onClick={() => updateInventoryMutation.mutate()}
                disabled={updateInventoryMutation.isPending}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
                aria-label={updateInventoryMutation.isPending ? t.saving : t.save}
              >
                {updateInventoryMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {t.saving}
                  </span>
                ) : (
                  t.save
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isDetailsModalOpen ? 1 : 0 }}
        className={`fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 ${isDetailsModalOpen ? '' : 'pointer-events-none'}`}
        role="dialog"
        aria-modal="true"
        aria-label={t.productDetails}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: isDetailsModalOpen ? 1 : 0.95, y: isDetailsModalOpen ? 0 : 20 }}
          className="bg-white p-6 rounded-xl shadow-2xl max-w-[95vw] sm:max-w-2xl w-full max-h-[80vh] overflow-y-auto scrollbar-none"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">{t.productDetails}</h2>
            <button
              onClick={() => {
                setIsDetailsModalOpen(false);
                setSelectedProductId('');
              }}
              className="p-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors duration-200"
              aria-label={t.cancel}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {historyLoading ? (
            <div className="text-center text-gray-600 flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5 text-gray-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              {t.common?.loading || 'Loading...'}
            </div>
          ) : productHistory && productHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'} font-medium`}>{t.date}</th>
                    <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'} font-medium`}>{t.type}</th>
                    <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'} font-medium`}>{t.quantity}</th>
                    <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'} font-medium`}>{t.description}</th>
                  </tr>
                </thead>
                <tbody>
                  {productHistory
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((entry) => (
                      <tr key={entry._id} className="border-b hover:bg-gray-50">
                        <td className="p-3">{new Date(entry.date).toLocaleString()}</td>
                        <td className="p-3">{t[entry.type]}</td>
                        <td className="p-3">{entry.quantity}</td>
                        <td className="p-3">{entry.description}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-600 text-sm">{t.noHistory}</p>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default BranchInventory;