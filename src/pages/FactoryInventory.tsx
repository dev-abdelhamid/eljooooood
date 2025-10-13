import React, { useState, useMemo, useCallback, useEffect, useReducer } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Plus, X, Eye, Edit, AlertCircle, Minus } from 'lucide-react';
import { factoryInventoryAPI, productionRequestsAPI, branchesAPI, productsAPI } from '../services/api';
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

enum ProductionType {
  BRANCH = 'branch',
  PRODUCTION = 'production',
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
  currentStock: number;
  pendingProductionStock: number;
  damagedStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  status: InventoryStatus;
}

interface ProductionItem {
  productId: string;
  quantity: number;
}

interface ProductionFormState {
  notes: string;
  items: ProductionItem[];
  type: ProductionType;
  branchId: string;
}

interface ProductHistoryEntry {
  _id: string;
  date: string;
  type: 'in' | 'out' | 'production';
  quantity: number;
  reference: string;
}

interface EditForm {
  currentStock: number;
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
    title: 'إدارة مخزون المصنع',
    description: 'إدارة مخزون المصنع وطلبات الإنتاج',
    noItems: 'لا توجد عناصر في المخزون',
    noHistory: 'لا يوجد سجل لهذا المنتج',
    stock: 'المخزون الحالي',
    pendingStock: 'المخزون المعلق للإنتاج',
    damagedStock: 'المخزون التالف',
    minStock: 'الحد الأدنى للمخزون',
    maxStock: 'الحد الأقصى للمخزون',
    unit: 'الوحدة',
    lowStock: 'مخزون منخفض',
    normal: 'عادي',
    full: 'مخزون ممتلئ',
    create: 'إنشاء طلب إنتاج',
    viewDetails: 'عرض التفاصيل',
    editStockLimits: 'تعديل حدود المخزون',
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
    in: 'دخول',
    out: 'خروج',
    production: 'إنتاج',
    available: 'متوفر',
    branch: 'فرع',
    productionType: 'إنتاج داخلي',
    selectType: 'اختر نوع الطلب',
    selectBranch: 'اختر فرع',
    errors: {
      noFactory: 'لم يتم العثور على مصنع',
      fetchInventory: 'خطأ في جلب بيانات المخزون',
      createRequest: 'خطأ في إنشاء طلب الإنتاج',
      updateInventory: 'خطأ في تحديث المخزون',
      invalidForm: 'البيانات المدخلة غير صالحة',
      required: 'حقل {field} مطلوب',
      nonNegative: 'يجب أن يكون {field} غير سالب',
      maxGreaterMin: 'الحد الأقصى للمخزون يجب أن يكون أكبر من الحد الأدنى',
      invalidQuantityMax: 'الكمية يجب أن تكون بين 1 و{max}',
      noItemSelected: 'لم يتم اختيار عنصر',
      invalidProductId: 'معرف المنتج غير صالح',
      insufficientQuantity: 'الكمية غير كافية للمنتج في المخزون',
      productNotFound: 'المنتج غير موجود',
      tooManyRequests: 'طلبات كثيرة جدًا، حاول مرة أخرى لاحقًا',
      duplicateProduct: 'لا يمكن إضافة نفس المنتج أكثر من مرة',
    },
    notifications: {
      requestCreated: 'تم إنشاء طلب الإنتاج بنجاح',
    },
  },
  en: {
    title: 'Factory Inventory Management',
    description: 'Manage factory inventory and production requests',
    noItems: 'No items found in inventory',
    noHistory: 'No history available for this product',
    stock: 'Current Stock',
    pendingStock: 'Pending Production Stock',
    damagedStock: 'Damaged Stock',
    minStock: 'Minimum Stock',
    maxStock: 'Maximum Stock',
    unit: 'Unit',
    lowStock: 'Low Stock',
    normal: 'Normal',
    full: 'Full Stock',
    create: 'Create Production Request',
    viewDetails: 'View Details',
    editStockLimits: 'Edit Stock Limits',
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
    in: 'In',
    out: 'Out',
    production: 'Production',
    available: 'Available',
    branch: 'Branch',
    productionType: 'Internal Production',
    selectType: 'Select Request Type',
    selectBranch: 'Select Branch',
    errors: {
      noFactory: 'No factory found',
      fetchInventory: 'Error fetching inventory data',
      createRequest: 'Error creating production request',
      updateInventory: 'Error updating inventory',
      invalidForm: 'Invalid form data',
      required: '{field} is required',
      nonNegative: '{field} must be non-negative',
      maxGreaterMin: 'Maximum stock must be greater than minimum stock',
      invalidQuantityMax: 'Quantity must be between 1 and {max}',
      noItemSelected: 'No item selected',
      invalidProductId: 'Invalid product ID',
      insufficientQuantity: 'Insufficient quantity for the product in inventory',
      productNotFound: 'Product not found',
      tooManyRequests: 'Too many requests, please try again later',
      duplicateProduct: 'Cannot add the same product multiple times',
    },
    notifications: {
      requestCreated: 'Production request created successfully',
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
        className="w-12 h-8 text-center border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm transition-all duration-200"
        style={{ appearance: 'none', MozAppearance: 'textfield' }}
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

// Reducer for production form (similar to return form)
type ProductionFormAction =
  | { type: 'SET_NOTES'; payload: string }
  | { type: 'ADD_ITEM'; payload: ProductionItem }
  | { type: 'UPDATE_ITEM'; payload: { index: number; field: keyof ProductionItem; value: string | number } }
  | { type: 'REMOVE_ITEM'; payload: number }
  | { type: 'SET_TYPE'; payload: ProductionType }
  | { type: 'SET_BRANCH'; payload: string }
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
    case 'SET_TYPE':
      return { ...state, type: action.payload };
    case 'SET_BRANCH':
      return { ...state, branchId: action.payload };
    case 'RESET':
      return { notes: '', items: [], type: ProductionType.BRANCH, branchId: '' };
    default:
      return state;
  }
};

// Validate ObjectId
const isValidObjectId = (id: string): boolean => /^[0-9a-fA-F]{24}$/.test(id);

export const FactoryInventory = () => {
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
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ProductionRequest | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [productionForm, dispatchProductionForm] = useReducer(productionFormReducer, { notes: '', items: [], type: ProductionType.BRANCH, branchId: '' });
  const [editForm, setEditForm] = useState<EditForm>({ currentStock: 0, minStockLevel: 0, maxStockLevel: 0 });
  const [productionErrors, setProductionErrors] = useState<Record<string, string>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [branches, setBranches] = useState([]);
  const [chefs, setChefs] = useState([]);
  const [productionRequests, setProductionRequests] = useState([]);

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
  const { data: inventoryData, isLoading: inventoryLoading, error: inventoryError } = useQuery({
    queryKey: ['factoryInventory', debouncedSearchQuery, filterStatus, filterDepartment, currentPage, language],
    queryFn: async () => {
      const response = await factoryInventoryAPI.getFactoryInventory();
      return response.map(item => ({
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
        status:
          item.currentStock <= item.minStockLevel
            ? InventoryStatus.LOW
            : item.currentStock >= item.maxStockLevel
            ? InventoryStatus.FULL
            : InventoryStatus.NORMAL,
      }));
    },
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    onError: (err) => {
      toast.error(err.message || t.errors.fetchInventory, { position: isRtl ? 'top-left' : 'top-right' });
    },
  });

  // Branches Query
  const { data: branchesData } = useQuery({
    queryKey: ['branches', language],
    queryFn: async () => {
      const response = await branchesAPI.getAll();
      return response;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Chefs Query
  const { data: chefsData } = useQuery({
    queryKey: ['chefs', language],
    queryFn: async () => {
      const response = await chefsAPI.getAll();
      return response;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Production Requests Query
  const { data: productionRequestsData } = useQuery({
    queryKey: ['productionRequests', language],
    queryFn: async () => {
      const response = await productionRequestsAPI.getFactoryProductionRequests();
      return response;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Product History Query
  const { data: productHistory, isLoading: historyLoading } = useQuery<ProductHistoryEntry[], Error>({
    queryKey: ['productHistory', selectedProductId],
    queryFn: async () => {
      if (!selectedProductId) throw new Error(t.errors.noItemSelected);
      const response = await factoryInventoryAPI.getFactoryInventoryHistory({ productId: selectedProductId });
      return response;
    },
    enabled: isDetailsModalOpen && !!selectedProductId,
    staleTime: 5 * 60 * 1000,
  });

  // Update available items
  useEffect(() => {
    if (inventoryData) {
      const items = inventoryData
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
    if (!socket) return;

    const handleInventoryUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['factoryInventory'] });
    };

    const handleRequestUpdated = ({ requestId, status }) => {
      queryClient.invalidateQueries({ queryKey: ['productionRequests'] });
      addNotification({
        _id: crypto.randomUUID(),
        type: 'success',
        message: `Production request ${requestId} updated to ${status}`,
        read: false,
        createdAt: new Date().toISOString(),
      });
      toast.success(`Production request updated to ${status}`, { position: isRtl ? 'top-left' : 'top-right' });
    };

    socket.on('inventoryUpdated', handleInventoryUpdated);
    socket.on('requestUpdated', handleRequestUpdated);

    return () => {
      socket.off('inventoryUpdated', handleInventoryUpdated);
      socket.off('requestUpdated', handleRequestUpdated);
    };
  }, [socket, queryClient, addNotification, isRtl]);

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

  // Product options
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

  const handleOpenRequestModal = useCallback((item?: InventoryItem) => {
    setSelectedItem(item || null);
    dispatchProductionForm({ type: 'RESET' });
    if (item?.product) {
      dispatchProductionForm({
        type: 'ADD_ITEM',
        payload: {
          productId: item.product._id,
          quantity: 1,
        },
      });
    } else {
      dispatchProductionForm({
        type: 'ADD_ITEM',
        payload: { productId: '', quantity: 1 },
      });
    }
    setProductionErrors({});
    setIsRequestModalOpen(true);
  }, []);

  const handleOpenEditModal = useCallback((item: InventoryItem) => {
    setSelectedItem(item);
    setEditForm({ currentStock: item.currentStock, minStockLevel: item.minStockLevel, maxStockLevel: item.maxStockLevel });
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
    dispatchProductionForm({
      type: 'ADD_ITEM',
      payload: { productId: '', quantity: 1 },
    });
  }, []);

  const updateItemInForm = useCallback(
    (index: number, field: keyof ProductionItem, value: string | number) => {
      if (field === 'quantity' && typeof value === 'string') {
        const numValue = parseInt(value);
        if (isNaN(numValue) || numValue < 1) return;
        value = numValue;
      }
      dispatchProductionForm({ type: 'UPDATE_ITEM', payload: { index, field, value } });
    },
    []
  );

  const handleProductChange = useCallback(
    (index: number, productId: string) => {
      if (!isValidObjectId(productId)) {
        setProductionErrors((prev) => ({
          ...prev,
          [`item_${index}_product`]: t.errors.invalidProductId,
        }));
        return;
      }
      if (productionForm.items.some((item, i) => i !== index && item.productId === productId)) {
        setProductionErrors((prev) => ({
          ...prev,
          [`item_${index}_product`]: t.errors.duplicateProduct,
        }));
        return;
      }
      dispatchProductionForm({
        type: 'UPDATE_ITEM',
        payload: { index, field: 'productId', value: productId },
      });
      dispatchProductionForm({
        type: 'UPDATE_ITEM',
        payload: { index, field: 'quantity', value: 1 },
      });
    },
    [productionForm.items, t]
  );

  const removeItemFromForm = useCallback((index: number) => {
    dispatchProductionForm({ type: 'REMOVE_ITEM', payload: index });
  }, []);

  const validateProductionForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (productionForm.type === ProductionType.BRANCH && !productionForm.branchId) {
      errors.branchId = t.errors.required.replace('{field}', t.selectBranch);
    }
    if (productionForm.items.length === 0) {
      errors.items = t.errors.required.replace('{field}', t.items);
    }
    productionForm.items.forEach((item, index) => {
      if (!item.productId) {
        errors[`item_${index}_productId`] = t.errors.required.replace('{field}', t.selectProduct);
      } else if (!isValidObjectId(item.productId)) {
        errors[`item_${index}_productId`] = t.errors.invalidProductId;
      }
      if (item.quantity < 1 || isNaN(item.quantity)) {
        errors[`item_${index}_quantity`] = t.errors.nonNegative.replace('{field}', t.quantity);
      }
    });
    setProductionErrors(errors);
    return Object.keys(errors).length === 0;
  }, [productionForm, t]);

  const validateEditForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (editForm.currentStock < 0) errors.currentStock = t.errors.nonNegative.replace('{field}', t.stock);
    if (editForm.minStockLevel < 0) errors.minStockLevel = t.errors.nonNegative.replace('{field}', t.minStock);
    if (editForm.maxStockLevel < 0) errors.maxStockLevel = t.errors.nonNegative.replace('{field}', t.maxStock);
    if (editForm.maxStockLevel <= editForm.minStockLevel) errors.maxStockLevel = t.errors.maxGreaterMin;
    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  }, [editForm, t]);

  const createRequestMutation = useMutation({
    mutationFn: async () => {
      if (!validateProductionForm()) throw new Error(t.errors.invalidForm);
      const data = {
        type: productionForm.type,
        branchId: productionForm.type === ProductionType.BRANCH ? productionForm.branchId : null,
        items: productionForm.items,
        notes: productionForm.notes,
      };
      return await factoryInventoryAPI.createFactoryProductionRequest(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factoryInventory'] });
      queryClient.invalidateQueries({ queryKey: ['productionRequests'] });
      setIsRequestModalOpen(false);
      dispatchProductionForm({ type: 'RESET' });
      setProductionErrors({});
      setSelectedItem(null);
      toast.success(t.notifications.requestCreated, { position: isRtl ? 'top-left' : 'top-right' });
    },
    onError: (err) => {
      toast.error(err.message || t.errors.createRequest, { position: isRtl ? 'top-left' : 'top-right' });
    },
  });

  const updateInventoryMutation = useMutation({
    mutationFn: async () => {
      if (!validateEditForm()) throw new Error(t.errors.invalidForm);
      if (!selectedItem) throw new Error(t.errors.noItemSelected);
      await factoryInventoryAPI.updateFactoryInventory(selectedItem._id, editForm);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factoryInventory'] });
      setIsEditModalOpen(false);
      setEditForm({ currentStock: 0, minStockLevel: 0, maxStockLevel: 0 });
      setEditErrors({});
      setSelectedItem(null);
      toast.success(t.save, { position: isRtl ? 'top-left' : 'top-right' });
      socket?.emit('inventoryUpdated', {
        productId: selectedItem?.product?._id,
        eventId: crypto.randomUUID(),
      });
    },
    onError: (err) => {
      toast.error(err.message || t.errors.updateInventory, { position: isRtl ? 'top-left' : 'top-right' });
      setEditErrors({ form: err.message });
    },
  });

  const assignChefMutation = useMutation({
    mutationFn: async (chefId) => {
      if (!selectedRequest) throw new Error('No request selected');
      await factoryInventoryAPI.assignChefToRequest({
        requestId: selectedRequest._id,
        chefId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productionRequests'] });
      setIsAssignModalOpen(false);
      setSelectedRequest(null);
      toast.success('Chef assigned successfully');
      socket?.emit('requestUpdated', { requestId: selectedRequest?._id, status: 'assigned' });
    },
    onError: (err) => toast.error(err.message || 'Failed to assign chef'),
  });

  const completeRequestMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRequest) throw new Error('No request selected');
      await factoryInventoryAPI.completeProductionRequest(selectedRequest._id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productionRequests'] });
      queryClient.invalidateQueries({ queryKey: ['factoryInventory'] });
      toast.success('Request completed successfully');
      socket?.emit('requestUpdated', { requestId: selectedRequest?._id, status: 'completed' });
    },
    onError: (err) => toast.error(err.message || 'Failed to complete request'),
  });

  const errorMessage = inventoryError?.message || '';

  return (
    <div className=" mx-auto px-4 py-4">
      <div className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center gap-3">
          <Package className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
            <p className="text-gray-600 text-sm">{t.description}</p>
          </div>
        </div>
        <button
          onClick={() => handleOpenRequestModal()}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <ProductSearchInput
              value={searchInput}
              onChange={handleSearchChange}
              placeholder={t.search}
              ariaLabel={t.search}
              className="w-full"
            />
          </div>
          <div>
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
          </div>
          <div>
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
            onClick={() => handleOpenRequestModal()}
            className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200"
            aria-label={t.create}
          >
            {t.create}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {paginatedInventory.map((item) =>
              item.product ? (
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
                    <p className="text-sm text-amber-600">{t.filterByDepartment}: {item.product.department?.displayName || 'N/A'}</p>
                    <p className="text-sm text-gray-600">{t.stock}: {item.currentStock}</p>
                    {item.pendingReturnStock > 0 && (
                      <p className="text-sm text-gray-600">{t.pendingStock}: {item.pendingReturnStock}</p>
                    )}
                    {item.damagedStock > 0 && (
                      <p className="text-sm text-red-600">{t.damagedStock}: {item.damagedStock}</p>
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
                      onClick={() => handleOpenRequestModal(item)}
                      disabled={item.currentStock <= 0}
                      className="p-2 text-red-600 hover:text-red-800 rounded-lg text-sm transition-colors duration-200 disabled:opacity-50"
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
        animate={{ opacity: isRequestModalOpen ? 1 : 0 }}
        className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 ${
          isRequestModalOpen ? '' : 'pointer-events-none'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={t.create}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: isRequestModalOpen ? 1 : 0.95, y: isRequestModalOpen ? 0 : 20 }}
          className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">{t.create}</h2>
            <button
              onClick={() => {
                setIsRequestModalOpen(false);
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.selectType}</label>
              <ProductDropdown
                value={productionForm.type}
                onChange={(value) => dispatchProductionForm({ type: 'SET_TYPE', payload: value })}
                options={[
                  { value: ProductionType.BRANCH, label: t.branch },
                  { value: ProductionType.PRODUCTION, label: t.productionType },
                ]}
                ariaLabel={t.selectType}
                className="w-full"
              />
            </div>
            {productionForm.type === ProductionType.BRANCH && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t.selectBranch}</label>
                <ProductDropdown
                  value={productionForm.branchId}
                  onChange={(value) => dispatchProductionForm({ type: 'SET_BRANCH', payload: value })}
                  options={[
                    { value: '', label: t.selectBranch },
                    ...branches.map(b => ({ value: b._id, label: b.displayName })),
                  ]}
                  ariaLabel={t.selectBranch}
                  className="w-full"
                />
                {productionErrors.branchId && <p className="text-red-600 text-xs mt-1">{productionErrors.branchId}</p>}
              </div>
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
                  <ProductDropdown
                    value={item.productId}
                    onChange={(value) => handleProductChange(index, value)}
                    options={productOptions}
                    ariaLabel={`${t.items} ${index + 1}`}
                    placeholder={t.selectProduct}
                    className="w-full"
                  />
                  {productionErrors[`item_${index}_productId`] && (
                    <p className="text-red-600 text-xs">{productionErrors[`item_${index}_productId`]}</p>
                  )}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t.quantity}</label>
                      <QuantityInput
                        value={item.quantity}
                        onChange={(val) => updateItemInForm(index, 'quantity', val)}
                        onIncrement={() => updateItemInForm(index, 'quantity', item.quantity + 1)}
                        onDecrement={() => updateItemInForm(index, 'quantity', item.quantity - 1)}
                        max={item.maxQuantity}
                      />
                      {productionErrors[`item_${index}_quantity`] && (
                        <p className="text-red-600 text-xs mt-1">{productionErrors[`item_${index}_quantity`]}</p>
                      )}
                    </div>
                    {productionForm.items.length > 1 && (
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
              <button
                onClick={addItemToForm}
                className="flex items-center gap-2 text-amber-600 hover:text-amber-800 text-sm font-medium"
                aria-label={t.addItem}
              >
                <Plus className="w-4 h-4" />
                {t.addItem}
              </button>
              {productionErrors.items && <p className="text-red-600 text-xs">{productionErrors.items}</p>}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsRequestModalOpen(false);
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
                onClick={() => createRequestMutation.mutate()}
                disabled={createRequestMutation.isLoading}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
                aria-label={createRequestMutation.isLoading ? t.submitting : t.submit}
              >
                {createRequestMutation.isLoading ? t.submitting : t.submit}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isAssignModalOpen ? 1 : 0 }}
        className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 ${
          isAssignModalOpen ? '' : 'pointer-events-none'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Assign Chef"
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: isAssignModalOpen ? 1 : 0.95, y: isAssignModalOpen ? 0 : 20 }}
          className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Assign Chef</h2>
            <button
              onClick={() => {
                setIsAssignModalOpen(false);
                setSelectedRequest(null);
              }}
              className="p-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors duration-200"
              aria-label={t.cancel}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-4">
            <ProductDropdown
              value={selectedRequest?.assignedChef || ''}
              onChange={(value) => assignChefMutation.mutate(value)}
              options={[
                { value: '', label: 'Select Chef' },
                ...chefs.map(chef => ({ value: chef._id, label: chef.displayName })),
              ]}
              ariaLabel="Assign Chef"
              className="w-full"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsAssignModalOpen(false);
                  setSelectedRequest(null);
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

      {/* Section for Production Requests */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Production Requests</h2>
        <div className="overflow-x-auto rounded-xl shadow-sm border border-gray-100 bg-white">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Branch</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Items</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Created By</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Assigned Chef</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {productionRequests.map((request) => (
                <tr key={request._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{request.type}</td>
                  <td className="px-4 py-3">{request.branchName || 'N/A'}</td>
                  <td className="px-4 py-3">{request.status}</td>
                  <td className="px-4 py-3">
                    {request.items.map((item, i) => (
                      <div key={i}>{item.productName}: {item.quantity}</div>
                    ))}
                  </td>
                  <td className="px-4 py-3">{request.createdBy}</td>
                  <td className="px-4 py-3">{request.assignedChef || 'Not Assigned'}</td>
                  <td className="px-4 py-3">
                    {request.status === 'pending' && (
                      <button
                        onClick={() => {
                          setSelectedRequest(request);
                          setIsAssignModalOpen(true);
                        }}
                        className="px-3 py-1 bg-blue-600 text-white rounded-md text-xs"
                      >
                        Assign Chef
                      </button>
                    )}
                    {request.status === 'assigned' && (
                      <button
                        onClick={() => productionRequestsAPI.updateProductionRequestStatus(request._id, { status: 'in_progress' })}
                        className="px-3 py-1 bg-yellow-600 text-white rounded-md text-xs"
                      >
                        Start Production
                      </button>
                    )}
                    {request.status === 'in_progress' && (
                      <button
                        onClick={() => completeRequestMutation.mutate()}
                        className="px-3 py-1 bg-green-600 text-white rounded-md text-xs"
                      >
                        Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FactoryInventory;