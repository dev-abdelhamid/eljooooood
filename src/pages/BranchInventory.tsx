import React, { useState, useMemo, useCallback, useEffect, useReducer } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Plus, X, Eye, Edit, AlertCircle, Search, Minus } from 'lucide-react';
import { returnsAPI, inventoryAPI } from '../services/api';
import { ProductSearchInput, ProductDropdown } from './NewOrder';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useNotifications } from '../contexts/NotificationContext';

// Enums for type safety
enum InventoryStatus {
  LOW = 'low',
  NORMAL = 'normal',
  FULL = 'full',
}

enum ReturnReason {
  DAMAGED_AR = 'تالف',
  WRONG_ITEM_AR = 'منتج خاطئ',
  EXCESS_QUANTITY_AR = 'كمية زائدة',
  OTHER_AR = 'أخرى',
  DAMAGED_EN = 'Damaged',
  WRONG_ITEM_EN = 'Wrong Item',
  EXCESS_QUANTITY_EN = 'Excess Quantity',
  OTHER_EN = 'Other',
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
  pendingReturnStock: number;
  damagedStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  status: InventoryStatus;
}

interface ReturnItem {
  product: string; // Changed from productId to product to match backend schema
  quantity: number;
  reason: string;
  reasonEn: string;
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
  referenceType?: 'return' | 'sale' | 'adjustment';
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
    pendingStock: 'المخزون المعلق للإرجاع',
    damagedStock: 'المخزون التالف',
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
    selectProduct: 'اختر منتج',
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
      invalidProductId: 'معرف المنتج غير صالح',
      insufficientQuantity: 'الكمية غير كافية للمنتج في المخزون',
      branchNotFound: 'الفرع غير موجود',
      productNotFound: 'المنتج غير موجود',
    },
    notifications: {
      returnApproved: 'تمت الموافقة على طلب الإرجاع',
      returnRejected: 'تم رفض طلب الإرجاع',
      returnCreated: 'تم إنشاء طلب الإرجاع بنجاح',
    },
  },
  en: {
    title: 'Inventory Management',
    description: 'Manage branch inventory and return requests',
    noItems: 'No items found in inventory',
    noHistory: 'No history available for this product',
    stock: 'Current Stock',
    pendingStock: 'Pending Return Stock',
    damagedStock: 'Damaged Stock',
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
    selectProduct: 'Select Product',
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
      invalidProductId: 'Invalid product ID',
      insufficientQuantity: 'Insufficient quantity for the product in inventory',
      branchNotFound: 'Branch not found',
      productNotFound: 'Product not found',
    },
    notifications: {
      returnApproved: 'Return request approved',
      returnRejected: 'Return request rejected',
      returnCreated: 'Return request created successfully',
    },
  },
};

// QuantityInput Component
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

// Validate ObjectId
const isValidObjectId = (id: string): boolean => /^[0-9a-fA-F]{24}$/.test(id);

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
            ? item.product!.department?.name || 'غير معروف'
            : item.product!.department?.nameEn || item.product!.department?.name || 'Unknown',
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
        const audio = new Audio('https://eljoodia-client.vercel.app/sounds/notification.mp3');
        audio.play().catch((err) => console.error(`[${new Date().toISOString()}] Audio playback failed:`, err));
        addNotification({
          _id: crypto.randomUUID(),
          type: status === 'approved' ? 'success' : 'error',
          message: status === 'approved' ? t.notifications.returnApproved : t.notifications.returnRejected,
          data: { returnId, eventId: crypto.randomUUID() },
          read: false,
          createdAt: new Date().toISOString(),
          sound: 'https://eljoodia-client.vercel.app/sounds/notification.mp3',
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
        label: dept.name || 'غير معروف',
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

  // Reason options with fixed reasonEn mapping
  const reasonOptions = useMemo(
    () => [
      { value: '', label: t.selectReason, enValue: '' },
      { value: ReturnReason.DAMAGED_AR, label: t.damaged, enValue: ReturnReason.DAMAGED_EN },
      { value: ReturnReason.WRONG_ITEM_AR, label: t.wrongItem, enValue: ReturnReason.WRONG_ITEM_EN },
      { value: ReturnReason.EXCESS_QUANTITY_AR, label: t.excessQuantity, enValue: ReturnReason.EXCESS_QUANTITY_EN },
      { value: ReturnReason.OTHER_AR, label: t.other, enValue: ReturnReason.OTHER_EN },
    ],
    [t]
  );

  // Product options with default "Select Product"
  const productOptions = useMemo(
    () => [
      { value: '', label: t.selectProduct },
      ...availableItems.map((availItem) => ({
        value: availItem.productId,
        label: `${availItem.productName} (${t.available}: ${availItem.available} ${availItem.unit})`,
      })),
    ],
    [availableItems, t]
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
    refetchInventory().then(() => {
      setSelectedItem(item || null);
      dispatchReturnForm({ type: 'RESET' });
      if (item?.product) {
        dispatchReturnForm({
          type: 'ADD_ITEM',
          payload: {
            product: item.product._id, // Changed from productId to product
            quantity: 1,
            reason: '',
            reasonEn: '',
            maxQuantity: item.currentStock,
          },
        });
      } else {
        dispatchReturnForm({
          type: 'ADD_ITEM',
          payload: { product: '', quantity: 1, reason: '', reasonEn: '', maxQuantity: 0 },
        });
      }
      setReturnErrors({});
      setIsReturnModalOpen(true);
    });
  }, [refetchInventory]);

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
      payload: { product: '', quantity: 1, reason: '', reasonEn: '', maxQuantity: 0 },
    });
  }, []);

  const updateItemInForm = useCallback(
    (index: number, field: keyof ReturnItem, value: string | number) => {
      if (field === 'quantity' && typeof value === 'string') {
        const numValue = parseInt(value);
        if (isNaN(numValue) || numValue < 1) return;
        value = numValue;
      }
      if (field === 'reason') {
        const selectedReason = reasonOptions.find((opt) => opt.value === value);
        dispatchReturnForm({
          type: 'UPDATE_ITEM',
          payload: { index, field: 'reason', value },
        });
        dispatchReturnForm({
          type: 'UPDATE_ITEM',
          payload: { index, field: 'reasonEn', value: selectedReason?.enValue || '' },
        });
      } else {
        dispatchReturnForm({ type: 'UPDATE_ITEM', payload: { index, field, value } });
      }
    },
    [reasonOptions]
  );

  const handleProductChange = useCallback(
    (index: number, productId: string) => {
      if (!isValidObjectId(productId)) {
        setReturnErrors((prev) => ({
          ...prev,
          [`item_${index}_product`]: t.errors.invalidProductId,
        }));
        return;
      }
      const inventoryItem = inventoryData?.find((inv) => inv.product?._id === productId);
      if (!inventoryItem) {
        setReturnErrors((prev) => ({
          ...prev,
          [`item_${index}_product`]: t.errors.productNotFound,
        }));
        return;
      }
      dispatchReturnForm({
        type: 'UPDATE_ITEM',
        payload: { index, field: 'product', value: productId }, // Changed from productId to product
      });
      dispatchReturnForm({
        type: 'UPDATE_ITEM',
        payload: { index, field: 'maxQuantity', value: inventoryItem.currentStock },
      });
      dispatchReturnForm({
        type: 'UPDATE_ITEM',
        payload: { index, field: 'quantity', value: 1 },
      });
    },
    [inventoryData, t]
  );

  const removeItemFromForm = useCallback((index: number) => {
    dispatchReturnForm({ type: 'REMOVE_ITEM', payload: index });
  }, []);

  const validateReturnForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!user?.branchId || !isValidObjectId(user.branchId)) {
      errors.form = t.errors.noBranch;
    }
    if (returnForm.items.length === 0) {
      errors.items = t.errors.required.replace('{field}', t.items);
    }
    returnForm.items.forEach((item, index) => {
      if (!item.product) {
        errors[`item_${index}_product`] = t.errors.required.replace('{field}', t.items);
      } else if (!isValidObjectId(item.product)) {
        errors[`item_${index}_product`] = t.errors.invalidProductId;
      }
      if (!item.reason) {
        errors[`item_${index}_reason`] = t.errors.required.replace('{field}', t.reason);
      }
      if (!item.reasonEn) {
        errors[`item_${index}_reasonEn`] = t.errors.required.replace('{field}', t.reason);
      }
      const reasonMap = {
        [ReturnReason.DAMAGED_AR]: ReturnReason.DAMAGED_EN,
        [ReturnReason.WRONG_ITEM_AR]: ReturnReason.WRONG_ITEM_EN,
        [ReturnReason.EXCESS_QUANTITY_AR]: ReturnReason.EXCESS_QUANTITY_EN,
        [ReturnReason.OTHER_AR]: ReturnReason.OTHER_EN,
      };
      if (item.reason && reasonMap[item.reason] !== item.reasonEn) {
        errors[`item_${index}_reasonEn`] = isRtl ? 'سبب الإرجاع بالإنجليزية غير متطابق' : 'English reason does not match Arabic reason';
      }
      if (item.quantity < 1 || item.quantity > item.maxQuantity || isNaN(item.quantity)) {
        errors[`item_${index}_quantity`] = t.errors.invalidQuantityMax.replace('{max}', item.maxQuantity.toString());
      }
      const inventoryItem = inventoryData?.find((inv) => inv.product?._id === item.product);
      if (!inventoryItem) {
        errors[`item_${index}_product`] = t.errors.productNotFound;
      } else if (item.quantity > inventoryItem.currentStock) {
        errors[`item_${index}_quantity`] = t.errors.insufficientQuantity;
      }
    });
    setReturnErrors(errors);
    return Object.keys(errors).length === 0;
  }, [returnForm, t, inventoryData, user, isRtl]);

  const validateEditForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (editForm.minStockLevel < 0) errors.minStockLevel = t.errors.nonNegative.replace('{field}', t.minStock);
    if (editForm.maxStockLevel < 0) errors.maxStockLevel = t.errors.nonNegative.replace('{field}', t.maxStock);
    if (editForm.maxStockLevel <= editForm.minStockLevel) errors.maxStockLevel = t.errors.maxGreaterMin;
    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  }, [editForm, t]);

  const createReturnMutation = useMutation<{ returnId: string }, Error, void>({
    mutationFn: async () => {
      if (!validateReturnForm()) throw new Error(t.errors.invalidForm);
      if (!user?.branchId) throw new Error(t.errors.noBranch);
      const data = {
        branchId: user.branchId,
        items: returnForm.items.map((item) => ({
          product: item.product, // Changed from productId to product
          quantity: item.quantity,
          reason: item.reason,
          reasonEn: item.reasonEn,
          price: 0, // Backend requires price; set to 0 as per schema
        })),
        notes: returnForm.notes || undefined,
      };
      for (const [index, item] of data.items.entries()) {
        if (!isValidObjectId(item.product)) {
          throw new Error(t.errors.invalidProductId + ` at item ${index + 1}`);
        }
      }
      const response = await returnsAPI.createReturn(data);
      return { returnId: response?.returnRequest?._id || crypto.randomUUID() };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setIsReturnModalOpen(false);
      dispatchReturnForm({ type: 'RESET' });
      setReturnErrors({});
      setSelectedItem(null);
      toast.success(t.notifications.returnCreated, { position: isRtl ? 'top-right' : 'top-left' });
      socket?.emit('returnCreated', {
        branchId: user?.branchId,
        returnId: data.returnId,
        status: 'pending_approval',
        eventId: crypto.randomUUID(),
      });
    },
    onError: (err: any) => {
      let errorMessage = err.message || t.errors.createReturn;
      const errors = err.errors || [];
      if (errors.length > 0) {
        const errorDetails = errors.map((e: any) => e.msg).join(', ');
        errorMessage = errorDetails;
        errors.forEach((e: any, index: number) => {
          setReturnErrors((prev) => ({
            ...prev,
            [`item_${index}_${e.path}`]: e.msg,
          }));
        });
      } else if (err.message.includes('الفرع غير موجود') || err.message.includes('Branch not found')) {
        errorMessage = t.errors.noBranch;
      } else if (err.message.includes('الكمية غير كافية') || err.message.includes('Insufficient quantity')) {
        errorMessage = t.errors.insufficientQuantity;
      } else if (err.message.includes('بيانات العنصر غير صالحة') || err.message.includes('Invalid item data')) {
        errorMessage = t.errors.invalidForm;
      } else if (err.message.includes('معرف المنتج غير صالح') || err.message.includes('Invalid product ID')) {
        errorMessage = t.errors.invalidProductId;
      } else if (err.message.includes('المنتج غير موجود') || err.message.includes('Product not found')) {
        errorMessage = t.errors.productNotFound;
      }
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
      setReturnErrors((prev) => ({ ...prev, form: errorMessage }));
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
    <div className="mx-auto px-4 py-8 min-h-screen">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="lg:col-span-1">
            <ProductSearchInput
              value={searchInput}
              onChange={handleSearchChange}
              placeholder={t.search}
              ariaLabel={t.search}
              className="w-full"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:col-span-1">
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
                    {item.pendingReturnStock > 0 && (
                      <p className="text-sm text-gray-600">{t.pendingStock}: {item.pendingReturnStock}</p>
                    )}
                    {item.damagedStock > 0 && (
                      <p className="text-sm text-red-300">{t.damagedStock}: {item.damagedStock}</p>
                    )}
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
          <div className={`flex items-center justify-center gap-3 ${isRtl ? 'flex-row' : ''}`}>
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
                className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm resize-none"
                rows={3}
                aria-label={t.notes}
              />
              {returnErrors.form && <p className="text-red-600 text-xs mt-1">{returnErrors.form}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.items}</label>
              {returnForm.items.map((item, index) => (
                <div key={index} className="flex flex-col gap-4 mb-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                  {!selectedItem && (
                    <ProductDropdown
                      value={item.product}
                      onChange={(value) => handleProductChange(index, value)}
                      options={productOptions}
                      ariaLabel={`${t.items} ${index + 1}`}
                      placeholder={t.selectProduct}
                      className="w-full"
                    />
                  )}
                  {returnErrors[`item_${index}_product`] && (
                    <p className="text-red-600 text-xs">{returnErrors[`item_${index}_product`]}</p>
                  )}
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t.quantity}</label>
                      <QuantityInput
                        value={item.quantity}
                        onChange={(val) => updateItemInForm(index, 'quantity', val)}
                        onIncrement={() => updateItemInForm(index, 'quantity', item.quantity + 1)}
                        onDecrement={() => updateItemInForm(index, 'quantity', item.quantity - 1)}
                        max={item.maxQuantity}
                      />
                      {returnErrors[`item_${index}_quantity`] && (
                        <p className="text-red-600 text-xs mt-1">{returnErrors[`item_${index}_quantity`]}</p>
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t.reason}</label>
                      <ProductDropdown
                        value={item.reason}
                        onChange={(value) => updateItemInForm(index, 'reason', value)}
                        options={reasonOptions}
                        ariaLabel={`${t.reason} ${index + 1}`}
                        className="w-full"
                      />
                      {returnErrors[`item_${index}_reason`] && (
                        <p className="text-red-600 text-xs mt-1">{returnErrors[`item_${index}_reason`]}</p>
                      )}
                      {returnErrors[`item_${index}_reasonEn`] && (
                        <p className="text-red-600 text-xs mt-1">{returnErrors[`item_${index}_reasonEn`]}</p>
                      )}
                    </div>
                    {!selectedItem && returnForm.items.length > 1 && (
                      <button
                        onClick={() => removeItemFromForm(index)}
                        className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors duration-200 mt-6"
                        aria-label={t.removeItem}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {!selectedItem && (
                <button
                  onClick={addItemToForm}
                  className="flex items-center gap-2 text-amber-600 hover:text-amber-800 text-sm font-medium"
                  aria-label={t.addItem}
                >
                  <Plus className="w-4 h-4" />
                  {t.addItem}
                </button>
              )}
              {returnErrors.items && <p className="text-red-600 text-xs">{returnErrors.items}</p>}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setIsReturnModalOpen(false);
                  dispatchReturnForm({ type: 'RESET' });
                  setReturnErrors({});
                  setSelectedItem(null);
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors duration-200"
                aria-label={t.cancel}
              >
                {t.cancel}
              </button>
              <button
                onClick={() => createReturnMutation.mutate()}
                disabled={createReturnMutation.isLoading}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
                aria-label={createReturnMutation.isLoading ? t.submitting : t.submit}
              >
                {createReturnMutation.isLoading ? t.submitting : t.submit}
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
          className="bg-white p-6 rounded-xl shadow-2xl max-w-[95vw] sm:max-w-lg w-full"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">{t.editStockLimits}</h2>
            <button
              onClick={() => {
                setIsEditModalOpen(false);
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.minStock}</label>
              <input
                type="number"
                value={editForm.minStockLevel}
                onChange={(e) => setEditForm({ ...editForm, minStockLevel: parseInt(e.target.value) || 0 })}
                min={0}
                className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm"
                aria-label={t.minStock}
              />
              {editErrors.minStockLevel && <p className="text-red-600 text-xs mt-1">{editErrors.minStockLevel}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.maxStock}</label>
              <input
                type="number"
                value={editForm.maxStockLevel}
                onChange={(e) => setEditForm({ ...editForm, maxStockLevel: parseInt(e.target.value) || 0 })}
                min={0}
                className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm"
                aria-label={t.maxStock}
              />
              {editErrors.maxStockLevel && <p className="text-red-600 text-xs mt-1">{editErrors.maxStockLevel}</p>}
            </div>
            {editErrors.form && <p className="text-red-600 text-xs">{editErrors.form}</p>}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditErrors({});
                  setSelectedItem(null);
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors duration-200"
                aria-label={t.cancel}
              >
                {t.cancel}
              </button>
              <button
                onClick={() => updateInventoryMutation.mutate()}
                disabled={updateInventoryMutation.isLoading}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
                aria-label={updateInventoryMutation.isLoading ? t.saving : t.save}
              >
                {updateInventoryMutation.isLoading ? t.saving : t.save}
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
          className="bg-white p-6 rounded-xl shadow-2xl max-w-[95vw] sm:max-w-2xl w-full"
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
          <div className="space-y-4">
            {historyLoading ? (
              <div className="space-y-3 animate-pulse">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded w-full"></div>
                ))}
              </div>
            ) : productHistory && productHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-gray-700">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-2 px-4 text-left font-medium">{t.date}</th>
                      <th className="py-2 px-4 text-left font-medium">{t.type}</th>
                      <th className="py-2 px-4 text-left font-medium">{t.quantity}</th>
                      <th className="py-2 px-4 text-left font-medium">{t.description}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productHistory.map((entry) => (
                      <tr key={entry._id} className="border-b border-gray-100">
                        <td className="py-2 px-4">{new Date(entry.date).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}</td>
                        <td className="py-2 px-4">{t[entry.type]}</td>
                        <td className="py-2 px-4">{entry.quantity}</td>
                        <td className="py-2 px-4">{entry.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-600 text-sm font-medium">{t.noHistory}</p>
            )}
            <div className="flex justify-end mt-6">
              <button
                onClick={() => {
                  setIsDetailsModalOpen(false);
                  setSelectedProductId('');
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors duration-200"
                aria-label={t.cancel}
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};