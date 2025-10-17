
// FactoryInventory Component (Frontend)
import React, { useState, useMemo, useCallback, useEffect, useReducer } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Plus, X, Eye, Edit, AlertCircle, Minus } from 'lucide-react';
import { factoryOrdersAPI, factoryInventoryAPI, isValidObjectId } from '../services/api';
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
// Interfaces aligned with backend
interface FactoryInventoryItem {
  _id: string;
  product: {
    _id: string;
    name: string;
    nameEn: string;
    code: string;
    unit: string;
    unitEn: string;
    department: { _id: string; name: string; nameEn: string; displayName: string } | null;
    displayName: string;
    displayUnit: string;
  };
  currentStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  status: InventoryStatus;
  pendingQuantity: number;
  inProduction: boolean;
}
interface ProductionItem {
  product: string;
  quantity: number;
}
interface ProductionFormState {
  notes: string;
  items: ProductionItem[];
}
interface ProductHistoryEntry {
  _id: string;
  date: string;
  type: 'produced_stock' | 'adjustment';
  quantity: number;
  reference: string;
}
interface EditForm {
  currentStock: number;
  minStockLevel: number;
  maxStockLevel: number;
}
interface AvailableProduct {
  productId: string;
  productName: string;
  unit: string;
  departmentName: string;
}
interface FactoryOrder {
  _id: string;
  orderNumber: string;
  items: { productId: string; quantity: number; status: string }[];
  status: 'pending' | 'in_production' | 'completed' | 'cancelled';
}
// Translations
const translations = {
  ar: {
    title: 'إدارة مخزون المصنع',
    description: 'إدارة مخزون المصنع وطلبات الإنتاج',
    noItems: 'لا توجد عناصر في مخزون المصنع',
    noHistory: 'لا يوجد سجل لهذا المنتج',
    stock: 'المخزون الحالي',
    minStock: 'الحد الأدنى للمخزون',
    maxStock: 'الحد الأقصى للمخزون',
    unit: 'الوحدة',
    lowStock: 'مخزون منخفض',
    normal: 'عادي',
    full: 'مخزون ممتلئ',
    create: 'إنشاء طلب إنتاج',
    viewDetails: 'عرض التفاصيل',
    editStockLimits: 'تعديل المخزون والحدود',
    search: 'البحث عن المنتجات...',
    selectProduct: 'اختر منتج',
    filterByStatus: 'تصفية حسب الحالة',
    filterByDepartment: 'تصفية حسب القسم',
    allStatuses: 'جميع الحالات',
    allDepartments: 'جميع الأقسام',
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
    productDetails: 'تفاصيل المنتج',
    date: 'التاريخ',
    type: 'النوع',
    quantity: 'الكمية',
    reference: 'المرجع',
    produced_stock: 'إنتاج مخزون',
    adjustment: 'تعديل',
    inProduction: 'في الإنتاج',
    pendingQuantity: 'كمية الإنتاج المعلق',
    errors: {
      fetchInventory: 'خطأ في جلب بيانات مخزون المصنع',
      createProduction: 'خطأ في إنشاء طلب الإنتاج',
      updateInventory: 'خطأ في تحديث المخزون',
      invalidForm: 'البيانات المدخلة غير صالحة',
      required: 'حقل {field} مطلوب',
      nonNegative: 'يجب أن يكون {field} غير سالب',
      maxGreaterMin: 'الحد الأقصى للمخزون يجب أن يكون أكبر من الحد الأدنى',
      invalidQuantityMax: 'الكمية يجب أن تكون أكبر من 0',
      noItemSelected: 'لم يتم اختيار عنصر',
      invalidProductId: 'معرف المنتج غير صالح',
      productNotFound: 'المنتج غير موجود',
      tooManyRequests: 'طلبات كثيرة جدًا، حاول مرة أخرى لاحقًا',
      duplicateProduct: 'لا يمكن إضافة نفس المنتج أكثر من مرة',
    },
    notifications: {
      productionCreated: 'تم إنشاء طلب الإنتاج بنجاح',
      inventoryUpdated: 'تم تحديث المخزون بنجاح',
      taskAssigned: 'تم تعيين مهمة إنتاج جديدة',
      orderCompleted: 'تم إكمال طلب الإنتاج',
    },
  },
  en: {
    title: 'Factory Inventory Management',
    description: 'Manage factory inventory and production orders',
    noItems: 'No items found in factory inventory',
    noHistory: 'No history available for this product',
    stock: 'Current Stock',
    minStock: 'Minimum Stock',
    maxStock: 'Maximum Stock',
    unit: 'Unit',
    lowStock: 'Low Stock',
    normal: 'Normal',
    full: 'Full Stock',
    create: 'Create Production Order',
    viewDetails: 'View Details',
    editStockLimits: 'Edit Stock and Limits',
    search: 'Search products...',
    selectProduct: 'Select Product',
    filterByStatus: 'Filter by Status',
    filterByDepartment: 'Filter by Department',
    allStatuses: 'All Statuses',
    allDepartments: 'All Departments',
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
    productDetails: 'Product Details',
    date: 'Date',
    type: 'Type',
    quantity: 'Quantity',
    reference: 'Reference',
    produced_stock: 'Produced Stock',
    adjustment: 'Adjustment',
    inProduction: 'In Production',
    pendingQuantity: 'Pending Production Quantity',
    errors: {
      fetchInventory: 'Error fetching factory inventory data',
      createProduction: 'Error creating production order',
      updateInventory: 'Error updating inventory',
      invalidForm: 'Invalid form data',
      required: '{field} is required',
      nonNegative: '{field} must be non-negative',
      maxGreaterMin: 'Maximum stock must be greater than minimum stock',
      invalidQuantityMax: 'Quantity must be greater than 0',
      noItemSelected: 'No item selected',
      invalidProductId: 'Invalid product ID',
      productNotFound: 'Product not found',
      tooManyRequests: 'Too many requests, please try again later',
      duplicateProduct: 'Cannot add the same product multiple times',
    },
    notifications: {
      productionCreated: 'Production order created successfully',
      inventoryUpdated: 'Inventory updated successfully',
      taskAssigned: 'New production task assigned',
      orderCompleted: 'Production order completed',
    },
  },
};
// QuantityInput Component
const QuantityInput = ({
  value,
  onChange,
  onIncrement,
  onDecrement,
}: {
  value: number;
  onChange: (val: string) => void;
  onIncrement: () => void;
  onDecrement: () => void;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const handleChange = (val: string) => {
    const num = parseInt(val, 10);
    if (val === '' || isNaN(num) || num < 1) {
      onChange('1');
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
        min={1}
        className="w-12 h-8 text-center border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm transition-all duration-200"
        style={{ appearance: 'none', MozAppearance: 'textfield' }}
        aria-label={isRtl ? 'الكمية' : 'Quantity'}
      />
      <button
        onClick={onIncrement}
        className="w-8 h-8 bg-amber-600 hover:bg-amber-700 rounded-full transition-colors duration-200 flex items-center justify-center"
        aria-label={isRtl ? 'زيادة الكمية' : 'Increase quantity'}
      >
        <Plus className="w-4 h-4 text-white" />
      </button>
    </div>
  );
};
// Reducer for production form
type ProductionFormAction =
  | { type: 'SET_NOTES'; payload: string }
  | { type: 'ADD_ITEM'; payload: ProductionItem }
  | { type: 'UPDATE_ITEM'; payload: { index: number; field: keyof ProductionItem; value: string | number } }
  | { type: 'REMOVE_ITEM'; payload: number }
  | { type: 'RESET' };
const productionFormReducer = (state: ProductionFormState, action: ProductionFormAction): ProductionFormState => {
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
// Aggregate items by product
const aggregateItemsByProduct = (items: ProductionItem[]): ProductionItem[] => {
  const aggregated: Record<string, ProductionItem> = {};
  items.forEach((item) => {
    if (!aggregated[item.product]) {
      aggregated[item.product] = {
        product: item.product,
        quantity: 0,
      };
    }
    aggregated[item.product].quantity += item.quantity;
  });
  return Object.values(aggregated).filter((item) => item.product && isValidObjectId(item.product));
};
export const FactoryInventory: React.FC = () => {
  const { t: languageT, language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<InventoryStatus | ''>('');
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [isProductionModalOpen, setIsProductionModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FactoryInventoryItem | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [productionForm, dispatchProductionForm] = useReducer(productionFormReducer, { notes: '', items: [] });
  const [editForm, setEditForm] = useState<EditForm>({ currentStock: 0, minStockLevel: 0, maxStockLevel: 0 });
  const [productionErrors, setProductionErrors] = useState<Record<string, string>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [availableProducts, setAvailableProducts] = useState<AvailableProduct[]>([]);
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
  const { data: inventoryData, isLoading: inventoryLoading, error: inventoryError } = useQuery<
    FactoryInventoryItem[],
    Error
  >({
    queryKey: ['factoryInventory', debouncedSearchQuery, filterStatus, filterDepartment, currentPage, language],
    queryFn: async () => {
      const params = {
        product: debouncedSearchQuery || undefined,
        department: filterDepartment || undefined,
        stockStatus: filterStatus || undefined,
        lang: language,
      };
      const data = await factoryInventoryAPI.getAll(params);
      console.log(`[${new Date().toISOString()}] factoryInventoryAPI.getAll - Data:`, data);
      return data;
    },
    enabled: !!user?.role && ['production', 'admin'].includes(user.role),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    select: (data) => {
      return data
        .filter((item): item is FactoryInventoryItem => !!item && !!item.product && isValidObjectId(item.product._id))
        .map((item: FactoryInventoryItem) => ({
          ...item,
          product: {
            ...item.product,
            displayName: isRtl ? item.product.name : item.product.nameEn || item.product.name,
            displayUnit: isRtl ? (item.product.unit || t.unit) : item.product.unitEn || item.product.unit || 'N/A',
            department: item.product.department
              ? {
                  ...item.product.department,
                  displayName: isRtl
                    ? item.product.department.name
                    : item.product.department.nameEn || item.product.department.name,
                }
              : null,
          },
          status:
            item.currentStock <= item.minStockLevel
              ? InventoryStatus.LOW
              : item.currentStock >= item.maxStockLevel
              ? InventoryStatus.FULL
              : InventoryStatus.NORMAL,
          pendingQuantity: 0, // Will be calculated later
          inProduction: false, // Will be calculated later
        }));
    },
    onError: (err) => {
      console.error(`[${new Date().toISOString()}] Inventory query error:`, err.message);
      toast.error(err.message || t.errors.fetchInventory, { position: isRtl ? 'top-right' : 'top-left' });
    },
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
  });
  // Product History Query
  const { data: productHistory, isLoading: historyLoading } = useQuery<ProductHistoryEntry[], Error>({
    queryKey: ['factoryProductHistory', selectedProductId, language],
    queryFn: async () => {
      if (!selectedProductId || !isValidObjectId(selectedProductId)) {
        throw new Error(t.errors.invalidProductId);
      }
      const data = await factoryInventoryAPI.getHistory({ productId: selectedProductId, lang: language });
      console.log(`[${new Date().toISOString()}] factoryInventoryAPI.getHistory - Data:`, data);
      return data;
    },
    enabled: isDetailsModalOpen && !!selectedProductId && isValidObjectId(selectedProductId),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    onError: (err) => {
      console.error(`[${new Date().toISOString()}] Product history query error:`, err.message);
      toast.error(err.message || t.errors.productNotFound, { position: isRtl ? 'top-right' : 'top-left' });
    },
  });
  // Factory Orders Query for pending quantities
  const { data: factoryOrdersData } = useQuery<FactoryOrder[], Error>({
    queryKey: ['factoryOrders', language],
    queryFn: async () => {
      const data = await factoryOrdersAPI.getAll();
      console.log(`[${new Date().toISOString()}] factoryOrdersAPI.getAll - Data:`, data);
      return data;
    },
    enabled: !!user?.role && ['production', 'admin'].includes(user.role),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    onError: (err) => {
      console.error(`[${new Date().toISOString()}] Factory orders query error:`, err.message);
      toast.error(err.message || t.errors.fetchInventory, { position: isRtl ? 'top-right' : 'top-left' });
    },
  });
  // Calculate pending quantities
  const pendingQuantities = useMemo(() => {
    const map: Record<string, number> = {};
    factoryOrdersData?.forEach((order) => {
      if (['pending', 'in_production'].includes(order.status)) {
        order.items.forEach((i) => {
          if (!map[i.productId]) map[i.productId] = 0;
          map[i.productId] += i.quantity;
        });
      }
    });
    return map;
  }, [factoryOrdersData]);
  // Available products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await factoryInventoryAPI.getAvailableProducts();
        console.log(`[${new Date().toISOString()}] factoryInventoryAPI.getAvailableProducts - Data:`, data);
        setAvailableProducts(
          data
            .filter((product: any) => product && product._id && isValidObjectId(product._id))
            .map((product: any) => ({
              productId: product._id,
              productName: isRtl ? product.name : product.nameEn || product.name,
              unit: isRtl ? (product.unit || t.unit) : product.unitEn || product.unit || 'N/A',
              departmentName: isRtl
                ? product.department?.name || t.allDepartments
                : product.department?.nameEn || product.department?.name || 'Unknown',
            }))
        );
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Error fetching products:`, err.message);
        toast.error(err.message || t.errors.productNotFound, { position: isRtl ? 'top-right' : 'top-left' });
      }
    };
    fetchProducts();
  }, [isRtl, t]);
  // Socket Events
  useEffect(() => {
    if (!socket || !user?.role || !isConnected) return;
    const handleFactoryInventoryUpdated = ({ productId }: { productId: string }) => {
      if (!isValidObjectId(productId)) {
        console.warn(`[${new Date().toISOString()}] Invalid productId in factoryInventoryUpdated:`, productId);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['factoryInventory'] });
      if (selectedProductId === productId) {
        queryClient.invalidateQueries({ queryKey: ['factoryProductHistory'] });
      }
      toast.success(t.notifications.inventoryUpdated, { position: isRtl ? 'top-right' : 'top-left' });
      addNotification({
        _id: crypto.randomUUID(),
        type: 'success',
        message: t.notifications.inventoryUpdated,
        data: { productId, eventId: crypto.randomUUID(), isRtl },
        read: false,
        createdAt: new Date().toISOString(),
        sound: 'https://eljoodia-client.vercel.app/sounds/notification.mp3',
        vibrate: [200, 100, 200],
      });
    };
    const handleFactoryOrderCreated = ({ orderId, orderNumber, branchId }: { orderId: string; orderNumber: string; branchId?: string }) => {
      if (!isValidObjectId(orderId)) {
        console.warn(`[${new Date().toISOString()}] Invalid orderId in factoryOrderCreated:`, orderId);
        return;
      }
      const audio = new Audio('https://eljoodia-client.vercel.app/sounds/notification.mp3');
      audio.play().catch((err) => console.error(`[${new Date().toISOString()}] Audio playback failed:`, err));
      addNotification({
        _id: crypto.randomUUID(),
        type: 'success',
        message: t.notifications.productionCreated,
        data: { orderId, orderNumber, branchId, eventId: crypto.randomUUID(), isRtl },
        read: false,
        createdAt: new Date().toISOString(),
        sound: 'https://eljoodia-client.vercel.app/sounds/notification.mp3',
        vibrate: [200, 100, 200],
      });
      toast.success(t.notifications.productionCreated, { position: isRtl ? 'top-right' : 'top-left' });
      queryClient.invalidateQueries({ queryKey: ['factoryInventory'] });
      queryClient.invalidateQueries({ queryKey: ['factoryOrders'] });
    };
    const handleFactoryTaskAssigned = ({
      factoryOrderId,
      taskId,
      chefId,
      productName,
    }: {
      factoryOrderId: string;
      taskId: string;
      chefId: string;
      productName: string;
    }) => {
      if (!isValidObjectId(factoryOrderId) || !isValidObjectId(chefId)) {
        console.warn(`[${new Date().toISOString()}] Invalid factoryOrderId or chefId in factoryTaskAssigned:`, { factoryOrderId, chefId });
        return;
      }
      if (user._id === chefId) {
        const audio = new Audio('https://eljoodia-client.vercel.app/sounds/notification.mp3');
        audio.play().catch((err) => console.error(`[${new Date().toISOString()}] Audio playback failed:`, err));
        addNotification({
          _id: crypto.randomUUID(),
          type: 'info',
          message: t.notifications.taskAssigned,
          data: { factoryOrderId, taskId, chefId, productName, eventId: crypto.randomUUID(), isRtl },
          read: false,
          createdAt: new Date().toISOString(),
          sound: 'https://eljoodia-client.vercel.app/sounds/notification.mp3',
          vibrate: [200, 100, 200],
        });
        toast.info(t.notifications.taskAssigned, { position: isRtl ? 'top-right' : 'top-left' });
      }
    };
    const handleFactoryOrderCompleted = ({ factoryOrderId, orderNumber }: { factoryOrderId: string; orderNumber: string }) => {
      if (!isValidObjectId(factoryOrderId)) {
        console.warn(`[${new Date().toISOString()}] Invalid factoryOrderId in factoryOrderCompleted:`, factoryOrderId);
        return;
      }
      const audio = new Audio('https://eljoodia-client.vercel.app/sounds/notification.mp3');
      audio.play().catch((err) => console.error(`[${new Date().toISOString()}] Audio playback failed:`, err));
      addNotification({
        _id: crypto.randomUUID(),
        type: 'success',
        message: t.notifications.orderCompleted,
        data: { factoryOrderId, orderNumber, eventId: crypto.randomUUID(), isRtl },
        read: false,
        createdAt: new Date().toISOString(),
        sound: 'https://eljoodia-client.vercel.app/sounds/notification.mp3',
        vibrate: [200, 100, 200],
      });
      toast.success(t.notifications.orderCompleted, { position: isRtl ? 'top-right' : 'top-left' });
      queryClient.invalidateQueries({ queryKey: ['factoryInventory'] });
      queryClient.invalidateQueries({ queryKey: ['factoryOrders'] });
    };
    socket.on('factoryInventoryUpdated', handleFactoryInventoryUpdated);
    socket.on('factoryOrderCreated', handleFactoryOrderCreated);
    socket.on('factoryTaskAssigned', handleFactoryTaskAssigned);
    socket.on('factoryOrderCompleted', handleFactoryOrderCompleted);
    // WebSocket reconnection logic
    const reconnectInterval = setInterval(() => {
      if (!isConnected && socket) {
        console.log(`[${new Date().toISOString()}] Attempting to reconnect WebSocket...`);
        socket.connect();
      }
    }, 5000);
    return () => {
      socket.off('factoryInventoryUpdated', handleFactoryInventoryUpdated);
      socket.off('factoryOrderCreated', handleFactoryOrderCreated);
      socket.off('factoryTaskAssigned', handleFactoryTaskAssigned);
      socket.off('factoryOrderCompleted', handleFactoryOrderCompleted);
      clearInterval(reconnectInterval);
    };
  }, [socket, user, isConnected, queryClient, addNotification, t, isRtl, selectedProductId]);
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
        label: dept.name || t.allDepartments,
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
  // Product options
  const productOptions = useMemo(
    () => [
      { value: '', label: t.selectProduct },
      ...availableProducts.map((product) => ({
        value: product.productId,
        label: `${product.productName} (${t.unit}: ${product.unit}) - ${product.departmentName}`,
      })),
    ],
    [availableProducts, t]
  );
  // Filtered and paginated inventory with pending quantities
  const filteredInventory = useMemo(
    () =>
      (inventoryData || []).map((item) => ({
        ...item,
        pendingQuantity: pendingQuantities[item.product._id] || 0,
        inProduction: (pendingQuantities[item.product._id] || 0) > 0,
      })).filter(
        (item) =>
          (!filterStatus || item.status === filterStatus) &&
          (!filterDepartment || item.product.department?._id === filterDepartment) &&
          (item.product.displayName.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
            item.product.code.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
            (item.product.department?.displayName?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ?? false))
      ),
    [inventoryData, debouncedSearchQuery, filterStatus, filterDepartment, pendingQuantities]
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
  const handleOpenProductionModal = useCallback((item?: FactoryInventoryItem) => {
    setSelectedItem(item || null);
    dispatchProductionForm({ type: 'RESET' });
    if (item?.product) {
      dispatchProductionForm({
        type: 'ADD_ITEM',
        payload: {
          product: item.product._id,
          quantity: 1,
        },
      });
    } else {
      dispatchProductionForm({
        type: 'ADD_ITEM',
        payload: { product: '', quantity: 1 },
      });
    }
    setProductionErrors({});
    setIsProductionModalOpen(true);
  }, []);
  const handleOpenEditModal = useCallback((item: FactoryInventoryItem) => {
    setSelectedItem(item);
    setEditForm({ currentStock: item.currentStock, minStockLevel: item.minStockLevel, maxStockLevel: item.maxStockLevel });
    setEditErrors({});
    setIsEditModalOpen(true);
  }, []);
  const handleOpenDetailsModal = useCallback((item: FactoryInventoryItem) => {
    if (item.product && isValidObjectId(item.product._id)) {
      setSelectedProductId(item.product._id);
      setIsDetailsModalOpen(true);
    } else {
      toast.error(t.errors.invalidProductId, { position: isRtl ? 'top-right' : 'top-left' });
    }
  }, [t, isRtl]);
  const addItemToForm = useCallback(() => {
    dispatchProductionForm({
      type: 'ADD_ITEM',
      payload: { product: '', quantity: 1 },
    });
  }, []);
  const updateItemInForm = useCallback((index: number, field: keyof ProductionItem, value: string | number) => {
    if (field === 'quantity' && typeof value === 'string') {
      const numValue = parseInt(value, 10);
      if (isNaN(numValue) || numValue < 1) {
        setProductionErrors((prev) => ({
          ...prev,
          [`item_${index}_quantity`]: t.errors.invalidQuantityMax,
        }));
        return;
      }
      value = numValue;
    }
    dispatchProductionForm({ type: 'UPDATE_ITEM', payload: { index, field, value } });

  const handleProductChange = useCallback(
    (index: number, productId: string) => {
      if (!isValidObjectId(productId)) {
        setProductionErrors((prev) => ({
          ...prev,
          [`item_${index}_product`]: t.errors.invalidProductId,
        }));
        return;
      }
      if (productionForm.items.some((item, i) => i !== index && item.product === productId)) {
        setProductionErrors((prev) => ({
          ...prev,
          [`item_${index}_product`]: t.errors.duplicateProduct,
        }));
        return;
      }
      dispatchProductionForm({
        type: 'UPDATE_ITEM',
        payload: { index, field: 'product', value: productId },
      });
 
    [t, productionForm.items]
  );
  const removeItemFromForm = useCallback((index: number) => {
    dispatchProductionForm({ type: 'REMOVE_ITEM', payload: index });
    setProductionErrors((prev) => {
      const newErrors = { ...prev };
      Object.keys(newErrors).forEach((key) => {
        if (key.startsWith(`item_${index}_`)) delete newErrors[key];
      });
      return newErrors;
    });
  }, []);
  const validateProductionForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (productionForm.items.length === 0) {
      errors.items = t.errors.required.replace('{field}', t.items);
    }
    productionForm.items.forEach((item, index) => {
      if (!item.product) {
        errors[`item_${index}_product`] = t.errors.required.replace('{field}', t.items);
      } else if (!isValidObjectId(item.product)) {
        errors[`item_${index}_product`] = t.errors.invalidProductId;
      }
      if (item.quantity < 1 || isNaN(item.quantity)) {
        errors[`item_${index}_quantity`] = t.errors.invalidQuantityMax;
      }
    });
    setProductionErrors(errors);
    return Object.keys(errors).length === 0;
  }, [productionForm, t]);
  const validateEditForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (editForm.currentStock < 0) {
      errors.currentStock = t.errors.nonNegative.replace('{field}', t.stock);
    }
    if (editForm.minStockLevel < 0) {
      errors.minStockLevel = t.errors.nonNegative.replace('{field}', t.minStock);
    }
    if (editForm.maxStockLevel < 0) {
      errors.maxStockLevel = t.errors.nonNegative.replace('{field}', t.maxStock);
    }
    if (editForm.maxStockLevel <= editForm.minStockLevel) {
      errors.maxStockLevel = t.errors.maxGreaterMin;
    }
    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  }, [editForm, t]);
  const createProductionMutation = useMutation<{ orderId: string; orderNumber: string }, Error, void>({
    mutationFn: async () => {
      if (!validateProductionForm()) {
        throw new Error(t.errors.invalidForm);
      }
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      const aggregatedItems = aggregateItemsByProduct(productionForm.items);
      if (aggregatedItems.length === 0) {
        throw new Error(t.errors.noItemSelected);
      }
      const data = {
        orderNumber: `PROD-${Date.now()}-${Math.random().toString(36).slice(-6)}`,
        items: aggregatedItems,
        notes: productionForm.notes || undefined,
        priority: 'medium',
      };
      console.log(`[${new Date().toISOString()}] Creating production order:`, data);
      const response = await factoryOrdersAPI.create(data);
      console.log(`[${new Date().toISOString()}] factoryOrdersAPI.create - Response:`, response);
      return {
        orderId: response?._id || crypto.randomUUID(),
        orderNumber: response?.orderNumber || data.orderNumber,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['factoryInventory'] });
      queryClient.invalidateQueries({ queryKey: ['factoryOrders'] });
      setIsProductionModalOpen(false);
      dispatchProductionForm({ type: 'RESET' });
      setProductionErrors({});
      setSelectedItem(null);
      toast.success(t.notifications.productionCreated, { position: isRtl ? 'top-right' : 'top-left' });
      if (socket && isConnected) {
        socket.emit('factoryOrderCreated', {
          orderId: data.orderId,
          orderNumber: data.orderNumber,
          branchId: user?.branch?._id,
          eventId: crypto.randomUUID(),
          isRtl,
        });
      }
    },
    onError: (err: any) => {
      console.error(`[${new Date().toISOString()}] Create production order error:`, err.message);
      let errorMessage = err.message || t.errors.createProduction;
      if (err.response?.status === 429) {
        errorMessage = t.errors.tooManyRequests;
      } else if (err.response?.data?.errors?.length > 0) {
        errorMessage = err.response.data.errors.map((e: any) => e.msg).join(', ');
        err.response.data.errors.forEach((e: any, index: number) => {
          setProductionErrors((prev) => ({
            ...prev,
            [`item_${index}_${e.path}`]: e.msg,
          }));
        });
      } else if (err.message.includes('معرف المنتج غير صالح') || err.message.includes('Invalid product ID')) {
        errorMessage = t.errors.invalidProductId;
      } else if (err.message.includes('المنتج غير موجود') || err.message.includes('Product not found')) {
        errorMessage = t.errors.productNotFound;
      }
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
      setProductionErrors((prev) => ({ ...prev, form: errorMessage }));
    },
  });
  const updateInventoryMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      if (!validateEditForm()) {
        throw new Error(t.errors.invalidForm);
      }
      if (!selectedItem || !isValidObjectId(selectedItem._id)) {
        throw new Error(t.errors.noItemSelected);
      }
      console.log(`[${new Date().toISOString()}] Updating inventory:`, {
        id: selectedItem._id,
        currentStock: editForm.currentStock,
        minStockLevel: editForm.minStockLevel,
        maxStockLevel: editForm.maxStockLevel,
      });
      await factoryInventoryAPI.updateStock(selectedItem._id, {
        currentStock: editForm.currentStock,
        minStockLevel: editForm.minStockLevel,
        maxStockLevel: editForm.maxStockLevel,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factoryInventory'] });
      setIsEditModalOpen(false);
      setEditForm({ currentStock: 0, minStockLevel: 0, maxStockLevel: 0 });
      setEditErrors({});
      setSelectedItem(null);
      toast.success(t.notifications.inventoryUpdated, { position: isRtl ? 'top-right' : 'top-left' });
      if (socket && isConnected) {
        socket.emit('factoryInventoryUpdated', {
          productId: selectedItem?.product?._id,
          eventId: crypto.randomUUID(),
          isRtl,
        });
      }
    },
    onError: (err) => {
      console.error(`[${new Date().toISOString()}] Update inventory error:`, err.message);
      const errorMessage = err.response?.status === 429 ? t.errors.tooManyRequests : err.message || t.errors.updateInventory;
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
      setEditErrors({ form: errorMessage });
    },
  });
  const errorMessage = inventoryError?.message || '';
  return (
    <div className="mx-auto px-4 py-4 max-w-7xl">
      <div className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center gap-3">
          <Package className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
            <p className="text-gray-600 text-sm">{t.description}</p>
          </div>
        </div>
        <button
          onClick={() => handleOpenProductionModal()}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2"
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
        </motion.div>
      )}
      <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-1">
            <ProductSearchInput
              value={searchInput}
              onChange={handleSearchChange}
              placeholder={t.search}
              ariaLabel={t.search}
              className="w-full"
            />
          </div>
          <div className="md:col-span-1 flex flex-col sm:flex-row gap-4">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
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
            onClick={() => handleOpenProductionModal()}
            className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200"
            aria-label={t.create}
          >
            {t.create}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {paginatedInventory.map((item) => (
              <motion.div
                key={item._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 hover:border-amber-200"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-bold text-gray-900 text-base truncate" style={{ fontWeight: 700 }}>
                      {item.product.displayName}
                    </h3>
                    <p className="text-sm text-gray-500">{item.product.code}</p>
                  </div>
                  <p className="text-sm text-amber-600">
                    {t.filterByDepartment}: {item.product.department?.displayName || 'N/A'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {t.stock}: {item.currentStock}
                  </p>
                  <p className="text-sm text-gray-600">
                    {t.minStock}: {item.minStockLevel}
                  </p>
                  <p className="text-sm text-gray-600">
                    {t.maxStock}: {item.maxStockLevel}
                  </p>
                  <p className="text-sm text-gray-600">
                    {t.unit}: {item.product.displayUnit}
                  </p>
                  <p
                    className={`text-sm font-medium ${
                      item.status === InventoryStatus.LOW
                        ? 'text-red-600'
                        : item.status === InventoryStatus.FULL
                        ? 'text-yellow-600'
                        : 'text-green-600'
                    }`}
                  >
                    {item.status === InventoryStatus.LOW
                      ? t.lowStock
                      : item.status === InventoryStatus.FULL
                      ? t.full
                      : t.normal}
                  </p>
                  {item.pendingQuantity > 0 && (
                    <p className="text-sm text-blue-600 flex items-center gap-1">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                        />
                      </svg>
                      {t.pendingQuantity}: {item.pendingQuantity}
                    </p>
                  )}
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={() => handleOpenDetailsModal(item)}
                    className="p-2 text-green-600 hover:text-green-800 rounded-lg text-sm transition-colors duration-200"
                    aria-label={t.viewDetails}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOpenEditModal(item)}
                    className="p-2 text-blue-600 hover:text-blue-800 rounded-lg text-sm transition-colors duration-200"
                    aria-label={t.editStockLimits}
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOpenProductionModal(item)}
                    className="p-2 text-amber-600 hover:text-amber-800 rounded-lg text-sm transition-colors duration-200"
                    aria-label={t.create}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      {totalInventoryPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isProductionModalOpen ? 1 : 0 }}
        className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 ${
          isProductionModalOpen ? '' : 'pointer-events-none'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={t.create}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: isProductionModalOpen ? 1 : 0.95, y: isProductionModalOpen ? 0 : 20 }}
          className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">{t.create}</h2>
            <button
              onClick={() => {
                setIsProductionModalOpen(false);
                dispatchProductionForm({ type: 'RESET' });
                setProductionErrors({});
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
                {t.items}: {isRtl ? selectedItem.product.name : selectedItem.product.nameEn}
              </p>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.notes}</label>
              <textarea
                value={productionForm.notes}
                onChange={(e) => dispatchProductionForm({ type: 'SET_NOTES', payload: e.target.value })}
                placeholder={t.notesPlaceholder}
                className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm resize-none"
                rows={3}
                aria-label={t.notes}
              />
              {productionErrors.form && <p className="text-red-600 text-xs mt-1">{productionErrors.form}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.items}</label>
              {productionForm.items.map((item, index) => (
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
                  {productionErrors[`item_${index}_product`] && (
                    <p className="text-red-600 text-xs">{productionErrors[`item_${index}_product`]}</p>
                  )}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t.quantity}</label>
                      <QuantityInput
                        value={item.quantity}
                        onChange={(val) => updateItemInForm(index, 'quantity', val)}
                        onIncrement={() => updateItemInForm(index, 'quantity', item.quantity + 1)}
                        onDecrement={() => updateItemInForm(index, 'quantity', Math.max(item.quantity - 1, 1))}
                      />
                      {productionErrors[`item_${index}_quantity`] && (
                        <p className="text-red-600 text-xs mt-1">{productionErrors[`item_${index}_quantity`]}</p>
                      )}
                    </div>
                    {!selectedItem && productionForm.items.length > 1 && (
                      <button
                        onClick={() => removeItemFromForm(index)}
                        className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors duration-200 self-start sm:self-end"
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
              {productionErrors.items && <p className="text-red-600 text-xs">{productionErrors.items}</p>}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsProductionModalOpen(false);
                  dispatchProductionForm({ type: 'RESET' });
                  setProductionErrors({});
                  setSelectedItem(null);
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors duration-200"
                aria-label={t.cancel}
              >
                {t.cancel}
              </button>
              <button
                onClick={() => createProductionMutation.mutate()}
                disabled={createProductionMutation.isLoading}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
                aria-label={createProductionMutation.isLoading ? t.submitting : t.submit}
              >
                {createProductionMutation.isLoading ? t.submitting : t.submit}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isEditModalOpen ? 1 : 0 }}
        className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 ${
          isEditModalOpen ? '' : 'pointer-events-none'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={t.editStockLimits}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: isEditModalOpen ? 1 : 0.95, y: isEditModalOpen ? 0 : 20 }}
          className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        >
          <div className="flex justify-between items-center mb-4">
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
            {selectedItem?.product && (
              <p className="text-sm text-gray-600">
                {t.productDetails}: {isRtl ? selectedItem.product.name : selectedItem.product.nameEn}
              </p>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.stock}</label>
              <input
                type="number"
                value={editForm.currentStock}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  setEditForm((prev) => ({ ...prev, currentStock: isNaN(value) ? 0 : value }));
                  setEditErrors((prev) => ({ ...prev, currentStock: undefined }));
                }}
                min={0}
                className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm transition-all duration-200"
                aria-label={t.stock}
              />
              {editErrors.currentStock && (
                <p className="text-red-600 text-xs mt-1">{editErrors.currentStock}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.minStock}</label>
              <input
                type="number"
                value={editForm.minStockLevel}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  setEditForm((prev) => ({ ...prev, minStockLevel: isNaN(value) ? 0 : value }));
                  setEditErrors((prev) => ({ ...prev, minStockLevel: undefined }));
                }}
                min={0}
                className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm transition-all duration-200"
                aria-label={t.minStock}
              />
              {editErrors.minStockLevel && (
                <p className="text-red-600 text-xs mt-1">{editErrors.minStockLevel}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.maxStock}</label>
              <input
                type="number"
                value={editForm.maxStockLevel}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  setEditForm((prev) => ({ ...prev, maxStockLevel: isNaN(value) ? 0 : value }));
                  setEditErrors((prev) => ({ ...prev, maxStockLevel: undefined }));
                }}
                min={0}
                className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm transition-all duration-200"
                aria-label={t.maxStock}
              />
              {editErrors.maxStockLevel && (
                <p className="text-red-600 text-xs mt-1">{editErrors.maxStockLevel}</p>
              )}
            </div>
            {editErrors.form && <p className="text-red-600 text-xs">{editErrors.form}</p>}
            <div className="flex justify-end gap-3">
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
        className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 ${
          isDetailsModalOpen ? '' : 'pointer-events-none'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={t.productDetails}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: isDetailsModalOpen ? 1 : 0.95, y: isDetailsModalOpen ? 0 : 20 }}
          className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        >
          <div className="flex justify-between items-center mb-4">
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
                <table className="w-full text-sm text-gray-600">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-2 px-4 text-left font-medium">{t.date}</th>
                      <th className="py-2 px-4 text-left font-medium">{t.type}</th>
                      <th className="py-2 px-4 text-left font-medium">{t.quantity}</th>
                      <th className="py-2 px-4 text-left font-medium">{t.reference}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productHistory.map((entry) => (
                      <tr key={entry._id} className="border-b border-gray-100">
                        <td className="py-2 px-4">{new Date(entry.date).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}</td>
                        <td className="py-2 px-4">{t[entry.type]}</td>
                        <td className="py-2 px-4">{entry.quantity}</td>
                        <td className="py-2 px-4">{entry.reference || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-600 text-sm">{t.noHistory}</p>
            )}
            <div className="flex justify-end">
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