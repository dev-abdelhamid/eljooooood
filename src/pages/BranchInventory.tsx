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
    price: number;
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
  productId: string;
  quantity: number;
  reason: string;
  reasonEn: string;
  maxQuantity: number;
  price: number;
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
  price: number;
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
      invalidResponse: 'استجابة المخزون غير صالحة',
    },
    notifications: {
      returnApproved: 'تمت الموافقة على طلب الإرجاع',
      returnRejected: 'تم رفض طلب الإرجاع',
      returnCreated: 'تم إنشاء طلب الإرجاع بنجاح',
      lowStockWarning: 'تحذير: المخزون منخفض للمنتج {productName}',
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
      invalidResponse: 'Invalid inventory response',
    },
    notifications: {
      returnApproved: 'Return request approved',
      returnRejected: 'Return request rejected',
      returnCreated: 'Return request created successfully',
      lowStockWarning: 'Warning: Low stock for product {productName}',
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
        className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors duration-200 flex items-center justify-center disabled:opacity-50"
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
        className="w-12 h-8 text-center border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm min-w-[2.75rem] transition-all duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        aria-label={isRtl ? 'الكمية' : 'Quantity'}
      />
      <button
        onClick={onIncrement}
        className="w-8 h-8 bg-amber-600 hover:bg-amber-700 rounded-full transition-colors duration-200 flex items-center justify-center disabled:opacity-50"
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
    { items: InventoryItem[]; total: number; page: number; limit: number },
    Error
  >({
    queryKey: ['inventory', user?.branchId, debouncedSearchQuery, filterStatus, filterDepartment, currentPage, language],
    queryFn: async () => {
      if (!user?.branchId) throw new Error(t.errors.noBranch);
      const response = await inventoryAPI.getByBranch(user.branchId, {
        search: debouncedSearchQuery,
        status: filterStatus,
        department: filterDepartment,
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      });
      console.log(`[${new Date().toISOString()}] Inventory query response:`, response);
      if (!response.inventory) throw new Error(t.errors.invalidResponse);
      return {
        items: response.inventory, // Adjusted to use 'inventory' from API response
        total: response.inventory.length, // Adjust based on actual API response
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      };
    },
    enabled: !!user?.branchId,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    select: (data) => ({
      items: data.items.map((item: InventoryItem) => ({
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
      })),
      total: data.total,
      page: data.page,
      limit: data.limit,
    }),
    onError: (err) => {
      console.error(`[${new Date().toISOString()}] Inventory query error:`, err);
      toast.error(err.message || t.errors.fetchInventory, { position: isRtl ? 'top-right' : 'top-left' });
    },
  });

  // Product History Query
  const { data: productHistory, isLoading: historyLoading } = useQuery<ProductHistoryEntry[], Error>({
    queryKey: ['productHistory', selectedProductId, user?.branchId],
    queryFn: async () => {
      if (!selectedProductId || !user?.branchId) throw new Error(t.errors.noBranch);
      const response = await inventoryAPI.getHistory({ productId: selectedProductId, branchId: user.branchId });
      console.log(`[${new Date().toISOString()}] Product history response:`, response);
      return response.history;
    },
    enabled: isDetailsModalOpen && !!selectedProductId && !!user?.branchId,
    staleTime: 5 * 60 * 1000,
  });

  // Update available items
  useEffect(() => {
    if (inventoryData?.items) {
      const items: AvailableItem[] = inventoryData.items
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
          price: item.product!.price || 0,
        }));
      setAvailableItems(items);
    }
  }, [inventoryData, isRtl, t]);

  // Socket Events
  useEffect(() => {
    if (!socket || !user?.branchId) return;

    const handleInventoryUpdated = ({ branchId, productId, quantity }: { branchId: string; productId: string; quantity: number }) => {
      if (branchId === user.branchId) {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        toast.info(t.notifications.returnCreated, { position: isRtl ? 'top-right' : 'top-left' });
      }
    };

    const handleLowStockWarning = ({
      branchId,
      productId,
      productName,
      currentStock,
    }: {
      branchId: string;
      productId: string;
      productName: string;
      currentStock: number;
    }) => {
      if (branchId === user.branchId) {
        const audio = new Audio('/sounds/low-stock-warning.mp3');
        audio.play().catch((err) => console.error(`[${new Date().toISOString()}] Audio playback failed:`, err));
        addNotification({
          _id: crypto.randomUUID(),
          type: 'warning',
          message: t.notifications.lowStockWarning.replace('{productName}', productName),
          data: { productId, currentStock, eventId: crypto.randomUUID() },
          read: false,
          createdAt: new Date().toISOString(),
          sound: '/sounds/low-stock-warning.mp3',
          vibrate: [200, 100, 200],
        });
        toast.warn(t.notifications.lowStockWarning.replace('{productName}', productName), {
          position: isRtl ? 'top-right' : 'top-left',
        });
      }
    };

    const handleReturnStatusUpdated = ({ branchId, returnId, status }: { branchId: string; returnId: string; status: string }) => {
      if (branchId === user.branchId) {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        const audio = new Audio('/sounds/notification.mp3');
        audio.play().catch((err) => console.error(`[${new Date().toISOString()}] Audio playback failed:`, err));
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
    socket.on('lowStockWarning', handleLowStockWarning);
    socket.on('returnStatusUpdated', handleReturnStatusUpdated);

    return () => {
      socket.off('inventoryUpdated', handleInventoryUpdated);
      socket.off('lowStockWarning', handleLowStockWarning);
      socket.off('returnStatusUpdated', handleReturnStatusUpdated);
    };
  }, [socket, user, queryClient, addNotification, t, isRtl]);

  // Department options
  const departmentOptions = useMemo(() => {
    const depts = new Set<string>();
    const deptMap: Record<string, { _id: string; name: string }> = {};
    inventoryData?.items?.forEach((item) => {
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
      (inventoryData?.items || []).filter(
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

  const totalInventoryPages = Math.ceil((filteredInventory.length || 0) / ITEMS_PER_PAGE);

  // Create Return Mutation
  const createReturnMutation = useMutation({
    mutationFn: async () => {
      if (!user?.branchId) throw new Error(t.errors.noBranch);
      if (returnForm.items.length === 0) throw new Error(t.errors.noItemSelected);

      const errors: Record<string, string> = {};
      returnForm.items.forEach((item, index) => {
        if (!item.productId || !isValidObjectId(item.productId)) {
          errors[`items[${index}].productId`] = t.errors.invalidProductId;
        }
        if (item.quantity < 1) {
          errors[`items[${index}].quantity`] = t.errors.invalidQuantityMax.replace('{max}', item.maxQuantity.toString());
        }
        if (!item.reason) {
          errors[`items[${index}].reason`] = t.errors.required.replace('{field}', t.reason);
        }
        if (!item.reasonEn) {
          errors[`items[${index}].reasonEn`] = t.errors.required.replace('{field}', t.reason);
        }
        if (typeof item.price !== 'number' || item.price < 0) {
          errors[`items[${index}].price`] = t.errors.nonNegative.replace('{field}', 'Price');
        }
      });

      if (Object.keys(errors).length > 0) {
        setReturnErrors(errors);
        throw new Error(t.errors.invalidForm);
      }

      return await returnsAPI.createReturn({
        branchId: user.branchId,
        items: returnForm.items.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          reason: item.reason,
          reasonEn: item.reasonEn,
          price: item.price,
        })),
        notes: returnForm.notes || '',
      });
    },
    onSuccess: () => {
      dispatchReturnForm({ type: 'RESET' });
      setIsReturnModalOpen(false);
      setReturnErrors({});
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success(t.notifications.returnCreated, { position: isRtl ? 'top-right' : 'top-left' });
    },
    onError: (error: any) => {
      console.error(`[${new Date().toISOString()}] Create return error:`, error);
      toast.error(error.message || t.errors.createReturn, { position: isRtl ? 'top-right' : 'top-left' });
    },
  });

  // Update Inventory Mutation
  const updateInventoryMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem?._id || !user?.branchId) throw new Error(t.errors.noBranch);
      if (editForm.minStockLevel < 0 || editForm.maxStockLevel < 0) {
        throw new Error(t.errors.nonNegative.replace('{field}', t.minStock));
      }
      if (editForm.maxStockLevel <= editForm.minStockLevel) {
        throw new Error(t.errors.maxGreaterMin);
      }
      return await inventoryAPI.updateStock(selectedItem._id, {
        minStockLevel: editForm.minStockLevel,
        maxStockLevel: editForm.maxStockLevel,
        branchId: user.branchId,
      });
    },
    onSuccess: () => {
      setIsEditModalOpen(false);
      setEditErrors({});
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success(t.editStockLimits, { position: isRtl ? 'top-right' : 'top-left' });
    },
    onError: (error: any) => {
      console.error(`[${new Date().toISOString()}] Update inventory error:`, error);
      toast.error(error.message || t.errors.updateInventory, { position: isRtl ? 'top-right' : 'top-left' });
    },
  });

  // Handlers
  const handleOpenReturnModal = () => {
    setIsReturnModalOpen(true);
    dispatchReturnForm({ type: 'RESET' });
  };

  const handleOpenEditModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setEditForm({
      minStockLevel: item.minStockLevel,
      maxStockLevel: item.maxStockLevel,
    });
    setIsEditModalOpen(true);
  };

  const handleOpenDetailsModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setSelectedProductId(item.product?._id || '');
    setIsDetailsModalOpen(true);
  };

  const handleAddItem = () => {
    const selectedProduct = availableItems.find((item) => item.productId === selectedProductId);
    if (!selectedProductId || !selectedProduct) {
      setReturnErrors({ selectedProduct: t.errors.noItemSelected });
      return;
    }
    dispatchReturnForm({
      type: 'ADD_ITEM',
      payload: {
        productId: selectedProductId,
        quantity: 1,
        reason: '',
        reasonEn: '',
        maxQuantity: selectedProduct.available,
        price: selectedProduct.price,
      },
    });
    setSelectedProductId('');
    setReturnErrors({});
  };

  const handleUpdateItem = (index: number, field: keyof ReturnItem, value: string | number) => {
    dispatchReturnForm({ type: 'UPDATE_ITEM', payload: { index, field, value } });
    setReturnErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[`items[${index}].${field}`];
      return newErrors;
    });
  };

  const handleReasonChange = (index: number, value: string) => {
    const selectedReason = reasonOptions.find((opt) => opt.value === value);
    handleUpdateItem(index, 'reason', value);
    handleUpdateItem(index, 'reasonEn', selectedReason?.enValue || '');
  };

  const handleRemoveItem = (index: number) => {
    dispatchReturnForm({ type: 'REMOVE_ITEM', payload: index });
    setReturnErrors((prev) => {
      const newErrors = { ...prev };
      Object.keys(newErrors).forEach((key) => {
        if (key.startsWith(`items[${index}]`)) {
          delete newErrors[key];
        }
      });
      return newErrors;
    });
  };

  const handleSubmitReturn = () => {
    createReturnMutation.mutate();
  };

  const handleSubmitEdit = () => {
    const errors: Record<string, string> = {};
    if (editForm.minStockLevel < 0) {
      errors.minStockLevel = t.errors.nonNegative.replace('{field}', t.minStock);
    }
    if (editForm.maxStockLevel < 0) {
      errors.maxStockLevel = t.errors.nonNegative.replace('{field}', t.maxStock);
    }
    if (editForm.maxStockLevel <= editForm.minStockLevel) {
      errors.maxStockLevel = t.errors.maxGreaterMin;
    }
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }
    updateInventoryMutation.mutate();
  };

  // Pagination Handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Render
  return (
    <div className="container mx-auto p-4 md:p-6 bg-gray-50 min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-lg shadow-lg p-6 mb-6"
      >
        <h1 className="text-2xl font-bold text-gray-800 mb-2">{t.title}</h1>
        <p className="text-gray-600 mb-4">{t.description}</p>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <ProductSearchInput
              value={searchInput}
              onChange={setSearchInput}
              placeholder={t.search}
              isRtl={isRtl}
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as InventoryStatus | '')}
            className="w-full md:w-40 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            aria-label={t.filterByStatus}
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="w-full md:w-40 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            aria-label={t.filterByDepartment}
          >
            {departmentOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleOpenReturnModal}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            {t.create}
          </button>
        </div>

        {/* Inventory Table */}
        {inventoryLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-600"></div>
          </div>
        ) : inventoryError ? (
          <div className="flex flex-col items-center justify-center h-64 text-red-600">
            <AlertCircle className="w-8 h-8 mb-2" />
            <p>{inventoryError.message || t.errors.fetchInventory}</p>
            <button
              onClick={() => refetchInventory()}
              className="mt-4 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg"
            >
              {t.retry}
            </button>
          </div>
        ) : paginatedInventory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-600">
            <Package className="w-12 h-12 mb-2" />
            <p>{t.noItems}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-gray-800">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-3 text-left">{t.productDetails}</th>
                  <th className="p-3 text-left">{t.stock}</th>
                  <th className="p-3 text-left">{t.pendingStock}</th>
                  <th className="p-3 text-left">{t.damagedStock}</th>
                  <th className="p-3 text-left">{t.minStock}</th>
                  <th className="p-3 text-left">{t.maxStock}</th>
                  <th className="p-3 text-left">{t.unit}</th>
                  <th className="p-3 text-left">{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedInventory.map((item) => (
                  <tr key={item._id} className="border-b hover:bg-gray-50">
                    <td className="p-3">
                      {item.product?.displayName || 'N/A'}<br />
                      <span className="text-xs text-gray-500">{item.product?.code || 'N/A'}</span><br />
                      <span className="text-xs text-gray-500">{item.product?.department?.displayName || 'N/A'}</span>
                    </td>
                    <td className="p-3">
                      <span
                        className={
                          item.status === InventoryStatus.LOW
                            ? 'text-red-600'
                            : item.status === InventoryStatus.FULL
                            ? 'text-green-600'
                            : 'text-gray-800'
                        }
                      >
                        {item.currentStock}
                      </span>
                    </td>
                    <td className="p-3">{item.pendingReturnStock}</td>
                    <td className="p-3">{item.damagedStock}</td>
                    <td className="p-3">{item.minStockLevel}</td>
                    <td className="p-3">{item.maxStockLevel}</td>
                    <td className="p-3">{item.product?.displayUnit || 'N/A'}</td>
                    <td className="p-3 flex gap-2">
                      <button
                        onClick={() => handleOpenDetailsModal(item)}
                        className="text-amber-600 hover:text-amber-800"
                        aria-label={t.viewDetails}
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(item)}
                        className="text-amber-600 hover:text-amber-800"
                        aria-label={t.editStockLimits}
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalInventoryPages > 1 && (
          <div className="flex justify-center mt-4 gap-2">
            {Array.from({ length: totalInventoryPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-3 py-1 rounded-lg ${
                  currentPage === page ? 'bg-amber-600 text-white' : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {/* Return Modal */}
      <AnimatePresence>
        {isReturnModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white rounded-lg p-6 w-full max-w-lg"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{t.create}</h2>
                <button
                  onClick={() => setIsReturnModalOpen(false)}
                  className="text-gray-600 hover:text-gray-800"
                  aria-label={t.cancel}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t.selectProduct}</label>
                  <ProductDropdown
                    options={productOptions}
                    value={selectedProductId}
                    onChange={(val) => {
                      setSelectedProductId(val);
                      setReturnErrors((prev) => ({ ...prev, selectedProduct: '' }));
                    }}
                    isRtl={isRtl}
                  />
                  {returnErrors.selectedProduct && (
                    <p className="text-red-600 text-sm mt-1">{returnErrors.selectedProduct}</p>
                  )}
                  <button
                    onClick={handleAddItem}
                    className="mt-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    {t.addItem}
                  </button>
                </div>
                {returnForm.items.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium">{t.items}</h3>
                    {returnForm.items.map((item, index) => {
                      const product = availableItems.find((p) => p.productId === item.productId);
                      return (
                        <div key={index} className="border-t pt-2 mt-2 flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <span>{product?.productName || 'N/A'}</span>
                            <button
                              onClick={() => handleRemoveItem(index)}
                              className="text-red-600 hover:text-red-800"
                              aria-label={t.removeItem}
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">{t.quantity}</label>
                            <QuantityInput
                              value={item.quantity}
                              onChange={(val) => handleUpdateItem(index, 'quantity', parseInt(val, 10))}
                              onIncrement={() => handleUpdateItem(index, 'quantity', item.quantity + 1)}
                              onDecrement={() => handleUpdateItem(index, 'quantity', item.quantity - 1)}
                              max={item.maxQuantity}
                            />
                            {returnErrors[`items[${index}].quantity`] && (
                              <p className="text-red-600 text-sm mt-1">{returnErrors[`items[${index}].quantity`]}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">{t.reason}</label>
                            <select
                              value={item.reason}
                              onChange={(e) => handleReasonChange(index, e.target.value)}
                              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                            >
                              {reasonOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            {returnErrors[`items[${index}].reason`] && (
                              <p className="text-red-600 text-sm mt-1">{returnErrors[`items[${index}].reason`]}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Price</label>
                            <input
                              type="number"
                              value={item.price}
                              onChange={(e) => handleUpdateItem(index, 'price', parseFloat(e.target.value))}
                              min={0}
                              step="0.01"
                              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                            />
                            {returnErrors[`items[${index}].price`] && (
                              <p className="text-red-600 text-sm mt-1">{returnErrors[`items[${index}].price`]}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t.notes}</label>
                  <textarea
                    value={returnForm.notes}
                    onChange={(e) => dispatchReturnForm({ type: 'SET_NOTES', payload: e.target.value })}
                    placeholder={t.notesPlaceholder}
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsReturnModalOpen(false)}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={handleSubmitReturn}
                    disabled={createReturnMutation.isLoading}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50"
                  >
                    {createReturnMutation.isLoading ? t.submitting : t.submit}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Stock Limits Modal */}
      <AnimatePresence>
        {isEditModalOpen && selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white rounded-lg p-6 w-full max-w-md"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{t.editStockLimits}</h2>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-gray-600 hover:text-gray-800"
                  aria-label={t.cancel}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t.minStock}</label>
                  <input
                    type="number"
                    value={editForm.minStockLevel}
                    onChange={(e) => {
                      setEditForm({ ...editForm, minStockLevel: parseInt(e.target.value, 10) });
                      setEditErrors((prev) => ({ ...prev, minStockLevel: '' }));
                    }}
                    min={0}
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                  {editErrors.minStockLevel && (
                    <p className="text-red-600 text-sm mt-1">{editErrors.minStockLevel}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t.maxStock}</label>
                  <input
                    type="number"
                    value={editForm.maxStockLevel}
                    onChange={(e) => {
                      setEditForm({ ...editForm, maxStockLevel: parseInt(e.target.value, 10) });
                      setEditErrors((prev) => ({ ...prev, maxStockLevel: '' }));
                    }}
                    min={0}
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                  {editErrors.maxStockLevel && (
                    <p className="text-red-600 text-sm mt-1">{editErrors.maxStockLevel}</p>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={handleSubmitEdit}
                    disabled={updateInventoryMutation.isLoading}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50"
                  >
                    {updateInventoryMutation.isLoading ? t.saving : t.save}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product Details Modal */}
      <AnimatePresence>
        {isDetailsModalOpen && selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white rounded-lg p-6 w-full max-w-2xl"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{t.productDetails}</h2>
                <button
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="text-gray-600 hover:text-gray-800"
                  aria-label={t.cancel}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="space-y-4">
                <p>
                  <strong>{t.productDetails}:</strong> {selectedItem.product?.displayName || 'N/A'}
                </p>
                <p>
                  <strong>{t.unit}:</strong> {selectedItem.product?.displayUnit || 'N/A'}
                </p>
                <p>
                  <strong>{t.stock}:</strong> {selectedItem.currentStock}
                </p>
                <p>
                  <strong>{t.pendingStock}:</strong> {selectedItem.pendingReturnStock}
                </p>
                <p>
                  <strong>{t.damagedStock}:</strong> {selectedItem.damagedStock}
                </p>
                <p>
                  <strong>{t.minStock}:</strong> {selectedItem.minStockLevel}
                </p>
                <p>
                  <strong>{t.maxStock}:</strong> {selectedItem.maxStockLevel}
                </p>
                <h3 className="text-lg font-medium">{t.history}</h3>
                {historyLoading ? (
                  <div className="flex justify-center items-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-600"></div>
                  </div>
                ) : productHistory && productHistory.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-gray-800">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="p-2 text-left">{t.date}</th>
                          <th className="p-2 text-left">{t.type}</th>
                          <th className="p-2 text-left">{t.quantity}</th>
                          <th className="p-2 text-left">{t.description}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productHistory.map((entry) => (
                          <tr key={entry._id} className="border-b">
                            <td className="p-2">{new Date(entry.date).toLocaleDateString()}</td>
                            <td className="p-2">{t[entry.type]}</td>
                            <td className="p-2">{entry.quantity}</td>
                            <td className="p-2">{entry.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-600">{t.noHistory}</p>
                )}
                <div className="flex justify-end">
                  <button
                    onClick={() => setIsDetailsModalOpen(false)}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
                  >
                    {t.cancel}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BranchInventory;
