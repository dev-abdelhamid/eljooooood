import React, { useState, useMemo, useCallback, useEffect, useReducer } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useNotifications } from '../contexts/NotificationContext';
import { returnsAPI, ordersAPI, inventoryAPI } from '../services/api';
import { Package, AlertCircle, Search, RefreshCw, Edit2, Trash2, X, Plus, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';

// Translations object
const translations = {
  ar: {
    inventory: {
      title: 'مخزون الفرع',
      description: 'إدارة مخزون الفرع وطلبات إعادة التخزين',
      no_items: 'لا توجد عناصر مخزون متاحة',
      no_history: 'لا يوجد سجل لهذا المنتج',
      low_stock: 'مخزون منخفض',
      normal: 'مخزون طبيعي',
      full: 'مخزون ممتلئ',
      stock: 'الكمية',
      min_stock: 'الحد الأدنى للمخزون',
      max_stock: 'الحد الأقصى للمخزون',
      edit_stock_limits: 'تعديل حدود المخزون',
      product_details: 'تفاصيل المنتج',
      update_success: 'تم تحديث المخزون بنجاح',
      adjustment: 'تعديل',
      restock: 'إعادة تخزين',
      settings_adjustment: 'تعديل الإعدادات',
    },
    products: {
      title: 'المنتج',
      code: 'رمز المنتج',
      unit: 'الوحدة',
      unit_unknown: 'غير معروف',
      select: 'اختر المنتج',
      unknown: 'غير معروف',
    },
    returns: {
      create: 'إنشاء طلب إرجاع',
      create_success: 'تم إنشاء طلب الإرجاع بنجاح',
      reason: 'السبب',
      select_reason: 'اختر السبب',
      quality_issue: 'مشكلة جودة',
      wrong_item: 'منتج خاطئ',
      excess_quantity: 'كمية زائدة',
      other: 'أخرى',
      notes: 'الملاحظات',
      notes_placeholder: 'أدخل ملاحظات إضافية (اختياري)',
      items: 'العناصر',
      add_item: 'إضافة عنصر',
      remove_item: 'إزالة العنصر',
      select_order: 'اختر الطلبية',
      quantity: 'الكمية',
    },
    common: {
      search: 'بحث',
      refresh: 'تحديث',
      retry: 'إعادة المحاولة',
      cancel: 'إلغاء',
      submit: 'إرسال',
      save: 'حفظ',
      submitting: 'جاري الإرسال...',
      saving: 'جاري الحفظ...',
      loading: 'جاري التحميل...',
      all_statuses: 'كل الحالات',
      all_departments: 'كل الأقسام',
      filter_by_status: 'تصفية حسب الحالة',
      filter_by_department: 'تصفية حسب القسم',
      available: 'متوفر',
      date: 'التاريخ',
      type: 'النوع',
      description: 'الوصف',
    },
    errors: {
      no_branch: 'لم يتم العثور على معرف الفرع',
      fetch_inventory: 'خطأ في جلب المخزون',
      create_return: 'خطأ في إنشاء طلب الإرجاع',
      update_inventory: 'خطأ في تحديث المخزون',
      invalid_form: 'النموذج غير صالح، يرجى التحقق من الحقول',
      required: '{field} مطلوب',
      non_negative: '{field} يجب أن يكون غير سالب',
      max_greater_min: 'الحد الأقصى يجب أن يكون أكبر من الحد الأدنى',
      invalid_quantity_max: 'الكمية غير صالحة، الحد الأقصى هو {max}',
      no_item_selected: 'لم يتم تحديد عنصر مخزون',
    },
    notifications: {
      return_approved: 'تمت الموافقة على طلب الإرجاع الخاص بك',
    },
    departments: {
      title: 'القسم',
      unknown: 'غير معروف',
    },
    branches: {
      unknown: 'فرع غير معروف',
    },
  },
  en: {
    inventory: {
      title: 'Branch Inventory',
      description: 'Manage branch inventory and restock requests',
      no_items: 'No inventory items available',
      no_history: 'No history available for this product',
      low_stock: 'Low Stock',
      normal: 'Normal',
      full: 'Full',
      stock: 'Stock',
      min_stock: 'Minimum Stock',
      max_stock: 'Maximum Stock',
      edit_stock_limits: 'Edit Stock Limits',
      product_details: 'Product Details',
      update_success: 'Inventory updated successfully',
      adjustment: 'Adjustment',
      restock: 'Restock',
      settings_adjustment: 'Settings Adjustment',
    },
    products: {
      title: 'Product',
      code: 'Product Code',
      unit: 'Unit',
      unit_unknown: 'Unknown',
      select: 'Select Product',
      unknown: 'Unknown',
    },
    returns: {
      create: 'Create Return Request',
      create_success: 'Return request created successfully',
      reason: 'Reason',
      select_reason: 'Select Reason',
      quality_issue: 'Quality Issue',
      wrong_item: 'Wrong Item',
      excess_quantity: 'Excess Quantity',
      other: 'Other',
      notes: 'Notes',
      notes_placeholder: 'Enter additional notes (optional)',
      items: 'Items',
      add_item: 'Add Item',
      remove_item: 'Remove Item',
      select_order: 'Select Order',
      quantity: 'Quantity',
    },
    common: {
      search: 'Search',
      refresh: 'Refresh',
      retry: 'Retry',
      cancel: 'Cancel',
      submit: 'Submit',
      save: 'Save',
      submitting: 'Submitting...',
      saving: 'Saving...',
      loading: 'Loading...',
      all_statuses: 'All Statuses',
      all_departments: 'All Departments',
      filter_by_status: 'Filter by Status',
      filter_by_department: 'Filter by Department',
      available: 'Available',
      date: 'Date',
      type: 'Type',
      description: 'Description',
    },
    errors: {
      no_branch: 'No branch ID found',
      fetch_inventory: 'Error fetching inventory',
      create_return: 'Error creating return request',
      update_inventory: 'Error updating inventory',
      invalid_form: 'Form is invalid, please check the fields',
      required: '{field} is required',
      non_negative: '{field} must be non-negative',
      max_greater_min: 'Maximum must be greater than minimum',
      invalid_quantity_max: 'Invalid quantity, maximum is {max}',
      no_item_selected: 'No inventory item selected',
    },
    notifications: {
      return_approved: 'Your return request has been approved',
    },
    departments: {
      title: 'Department',
      unknown: 'Unknown',
    },
    branches: {
      unknown: 'Unknown Branch',
    },
  },
};

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

const CustomInput: React.FC<CustomInputProps> = ({ label, type = 'text', min, max, value, onChange, error, className, placeholder, ariaLabel }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="flex flex-col">
      {label && <label className="text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="relative">
        <Search
          className={`absolute top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 ${isRtl ? 'right-3' : 'left-3'}`}
        />
        <input
          type={type}
          min={min}
          max={max}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          aria-label={ariaLabel || label || placeholder}
          className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm ${error ? 'border-red-500' : ''} ${className} ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'}`}
        />
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
};

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
  const { language } = useLanguage();
  const isRtl = language === 'ar';
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
        <div className={`flex ${isRtl ? 'flex-row-reverse' : ''} justify-between items-center mb-4`}>
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

const CustomSelect: React.FC<CustomSelectProps> = ({ label, value, onChange, options, error, disabled, ariaLabel }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="flex flex-col">
      {label && <label className="text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          disabled={disabled}
          aria-label={ariaLabel || label}
          className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm appearance-none ${error ? 'border-red-500' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${isRtl ? 'text-right' : 'text-left'}`}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className={`absolute top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 ${isRtl ? 'left-3' : 'right-3'}`} />
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
};

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

  const { data: inventoryData, isLoading: inventoryLoading, error: inventoryError, refetch: refetchInventory } = useQuery<
    InventoryItem[],
    AxiosError
  >({
    queryKey: ['inventory', user?.branchId, debouncedSearchQuery, filterStatus, filterDepartment, currentPage, language],
    queryFn: async () => {
      if (!user?.branchId) throw new Error(t('errors.no_branch'));
      return inventoryAPI.getByBranch(user.branchId, { department: filterDepartment, search: debouncedSearchQuery });
    },
    enabled: !!user?.branchId,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    select: (response) => {
      const inventoryData = Array.isArray(response.inventory) ? response.inventory : response?.data?.inventory || [];
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

  const { data: productHistory, isLoading: historyLoading } = useQuery<ProductHistoryEntry[], AxiosError>({
    queryKey: ['productHistory', selectedProductId, user?.branchId],
    queryFn: async () => {
      if (!selectedProductId || !user?.branchId) throw new Error(t('errors.no_branch'));
      return inventoryAPI.getHistory({ productId: selectedProductId, branchId: user.branchId });
    },
    enabled: isDetailsModalOpen && !!selectedProductId && !!user?.branchId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: ordersData } = useQuery<Order[], AxiosError>({
    queryKey: ['orders', user?.branchId, language],
    queryFn: async () => {
      if (!user?.branchId) throw new Error(t('errors.no_branch'));
      return ordersAPI.getAll({ branch: user.branchId, status: 'completed' });
    },
    enabled: isReturnModalOpen && !!user?.branchId,
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
          departmentName: isRtl
            ? item.product!.department?.name || t('departments.unknown')
            : item.product!.department?.nameEn || item.product!.department?.name || t('departments.unknown'),
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

  const handleOpenReturnModal = useCallback((item?: InventoryItem) => {
    if (!user || user.role !== 'branch') {
      toast.error(t('errors.no_branch'), { position: 'top-right', autoClose: 3000 });
      return;
    }
    if (item) {
      setSelectedItem(item);
      dispatchReturnForm({
        type: 'ADD_ITEM',
        payload: {
          itemId: item._id,
          productId: item.product?._id || '',
          orderId: '',
          quantity: 1,
          reason: '',
          maxQuantity: item.currentStock,
        },
      });
    } else {
      dispatchReturnForm({ type: 'RESET' });
    }
    setIsReturnModalOpen(true);
    setReturnErrors({});
  }, [user, t]);

  const handleCloseReturnModal = useCallback(() => {
    setIsReturnModalOpen(false);
    setSelectedItem(null);
    dispatchReturnForm({ type: 'RESET' });
    setReturnErrors({});
  }, []);

  const handleOpenEditModal = useCallback((item: InventoryItem) => {
    if (!user || user.role !== 'branch') {
      toast.error(t('errors.no_branch'), { position: 'top-right', autoClose: 3000 });
      return;
    }
    setSelectedItem(item);
    setEditForm({
      minStockLevel: item.minStockLevel,
      maxStockLevel: item.maxStockLevel,
    });
    setIsEditModalOpen(true);
    setEditErrors({});
  }, [user, t]);

  const handleCloseEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setSelectedItem(null);
    setEditForm({ minStockLevel: 0, maxStockLevel: 0 });
    setEditErrors({});
  }, []);

  const handleOpenDetailsModal = useCallback((item: InventoryItem) => {
    if (!user || user.role !== 'branch') {
      toast.error(t('errors.no_branch'), { position: 'top-right', autoClose: 3000 });
      return;
    }
    setSelectedItem(item);
    setSelectedProductId(item.product?._id || '');
    setIsDetailsModalOpen(true);
  }, [user, t]);

  const handleCloseDetailsModal = useCallback(() => {
    setIsDetailsModalOpen(false);
    setSelectedItem(null);
    setSelectedProductId('');
  }, []);

  const validateReturnForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!returnForm.reason) {
      errors.reason = t('errors.required', { field: t('returns.reason') });
    }
    returnForm.items.forEach((item, index) => {
      if (!item.productId) {
        errors[`items[${index}].productId`] = t('errors.required', { field: t('products.select') });
      }
      if (!item.orderId) {
        errors[`items[${index}].orderId`] = t('errors.required', { field: t('returns.select_order') });
      }
      if (!item.quantity || item.quantity <= 0) {
        errors[`items[${index}].quantity`] = t('errors.non_negative', { field: t('returns.quantity') });
      } else if (item.quantity > item.maxQuantity) {
        errors[`items[${index}].quantity`] = t('errors.invalid_quantity_max', { max: item.maxQuantity });
      }
      if (!item.reason) {
        errors[`items[${index}].reason`] = t('errors.required', { field: t('returns.reason') });
      }
    });
    setReturnErrors(errors);
    return Object.keys(errors).length === 0;
  }, [returnForm, t]);

  const validateEditForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (editForm.minStockLevel < 0) {
      errors.minStockLevel = t('errors.non_negative', { field: t('inventory.min_stock') });
    }
    if (editForm.maxStockLevel < 0) {
      errors.maxStockLevel = t('errors.non_negative', { field: t('inventory.max_stock') });
    }
    if (editForm.maxStockLevel <= editForm.minStockLevel) {
      errors.maxStockLevel = t('errors.max_greater_min');
    }
    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  }, [editForm, t]);

  const createReturnMutation = useMutation({
    mutationFn: async () => {
      if (!user?.branchId || !selectedItem) {
        throw new Error(t('errors.no_branch'));
      }
      return returnsAPI.create({
        branchId: user.branchId,
        items: returnForm.items.map((item) => ({
          inventoryId: item.itemId,
          productId: item.productId,
          orderId: item.orderId,
          quantity: item.quantity,
          reason: item.reason,
        })),
        reason: returnForm.reason,
        notes: returnForm.notes,
      });
    },
    onSuccess: () => {
      toast.success(t('returns.create_success'), { position: 'top-right', autoClose: 3000 });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      handleCloseReturnModal();
    },
    onError: (err: AxiosError) => {
      toast.error(err.response?.data?.message || t('errors.create_return'), { position: 'top-right', autoClose: 3000 });
    },
  });

  const updateInventoryMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem) {
        throw new Error(t('errors.no_item_selected'));
      }
      return inventoryAPI.update(selectedItem._id, {
        minStockLevel: editForm.minStockLevel,
        maxStockLevel: editForm.maxStockLevel,
      });
    },
    onSuccess: () => {
      toast.success(t('inventory.update_success'), { position: 'top-right', autoClose: 3000 });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      handleCloseEditModal();
    },
    onError: (err: AxiosError) => {
      toast.error(err.response?.data?.message || t('errors.update_inventory'), { position: 'top-right', autoClose: 3000 });
    },
  });

  const handleAddReturnItem = useCallback(() => {
    dispatchReturnForm({
      type: 'ADD_ITEM',
      payload: {
        itemId: '',
        productId: '',
        orderId: '',
        quantity: 1,
        reason: '',
        maxQuantity: 0,
      },
    });
  }, []);

  const handleSubmitReturn = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (validateReturnForm()) {
        createReturnMutation.mutate();
      } else {
        toast.error(t('errors.invalid_form'), { position: 'top-right', autoClose: 3000 });
      }
    },
    [validateReturnForm, createReturnMutation, t]
  );

  const handleSubmitEdit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (validateEditForm()) {
        updateInventoryMutation.mutate();
      } else {
        toast.error(t('errors.invalid_form'), { position: 'top-right', autoClose: 3000 });
      }
    },
    [validateEditForm, updateInventoryMutation, t]
  );

  const handleRefresh = useCallback(() => {
    refetchInventory();
    setSearchInput('');
    setFilterStatus('');
    setFilterDepartment('');
    setCurrentPage(1);
    toast.info(t('common.refresh'), { position: 'top-right', autoClose: 2000 });
  }, [refetchInventory, t]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8 px-4 sm:px-6 lg:px-8" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('inventory.title')}</h1>
            <p className="text-sm text-gray-600">{t('inventory.description')}</p>
          </div>
          <div className="mt-4 sm:mt-0 flex gap-2">
            <CustomButton onClick={handleRefresh} variant="secondary" size="md" ariaLabel={t('common.refresh')}>
              <RefreshCw className="w-4 h-4 mr-2" />
              {t('common.refresh')}
            </CustomButton>
            <CustomButton onClick={() => handleOpenReturnModal()} variant="primary" size="md" ariaLabel={t('returns.create')}>
              <Plus className="w-4 h-4 mr-2" />
              {t('returns.create')}
            </CustomButton>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <CustomInput
            label={t('common.search')}
            value={searchInput}
            onChange={handleSearchChange}
            placeholder={t('common.search')}
            ariaLabel={t('common.search')}
          />
          <CustomSelect
            label={t('common.filter_by_status')}
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value as InventoryStatus | '');
              setCurrentPage(1);
            }}
            options={statusOptions}
            ariaLabel={t('common.filter_by_status')}
          />
          <CustomSelect
            label={t('common.filter_by_department')}
            value={filterDepartment}
            onChange={(e) => {
              setFilterDepartment(e.target.value);
              setCurrentPage(1);
            }}
            options={departmentOptions}
            ariaLabel={t('common.filter_by_department')}
          />
        </div>

        {inventoryError && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>{inventoryError.message || t('errors.fetch_inventory')}</span>
            <CustomButton
              variant="secondary"
              size="sm"
              onClick={() => refetchInventory()}
              className="ml-4"
              ariaLabel={t('common.retry')}
            >
              {t('common.retry')}
            </CustomButton>
          </div>
        )}

        {inventoryLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <InventoryCardSkeleton key={index} isRtl={isRtl} />
            ))}
          </div>
        ) : paginatedInventory.length === 0 ? (
          <div className="text-center py-8">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">{t('inventory.no_items')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {paginatedInventory.map((item) => (
                <motion.div
                  key={item._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <CustomCard>
                    <div className={`flex items-center ${isRtl ? 'justify-between flex-row-reverse' : 'justify-between'}`}>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {isRtl ? item.product?.name : item.product?.nameEn || item.product?.name}
                      </h3>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          item.status === InventoryStatus.LOW
                            ? 'bg-red-100 text-red-600'
                            : item.status === InventoryStatus.FULL
                            ? 'bg-green-100 text-green-600'
                            : 'bg-blue-100 text-blue-600'
                        }`}
                      >
                        {t(`inventory.${item.status}`)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{t('products.code')}: {item.product?.code || 'N/A'}</p>
                    <p className="text-sm text-gray-600">
                      {t('departments.title')}: {isRtl ? item.product?.department?.name : item.product?.department?.nameEn || t('departments.unknown')}
                    </p>
                    <p className="text-sm text-gray-600">
                      {t('inventory.stock')}: {item.currentStock} {isRtl ? item.product?.unit : item.product?.unitEn || 'N/A'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {t('inventory.min_stock')}: {item.minStockLevel}
                    </p>
                    <p className="text-sm text-gray-600">
                      {t('inventory.max_stock')}: {item.maxStockLevel}
                    </p>
                    <div className={`flex gap-2 mt-4 ${isRtl ? 'justify-end' : ''}`}>
                      <CustomButton
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenDetailsModal(item)}
                        ariaLabel={t('inventory.product_details')}
                      >
                        <Eye className="w-4 h-4" />
                      </CustomButton>
                      <CustomButton
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenEditModal(item)}
                        ariaLabel={t('inventory.edit_stock_limits')}
                      >
                        <Edit2 className="w-4 h-4" />
                      </CustomButton>
                      <CustomButton
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenReturnModal(item)}
                        ariaLabel={t('returns.create')}
                      >
                        <Plus className="w-4 h-4" />
                      </CustomButton>
                    </div>
                  </CustomCard>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        <Pagination
          totalPages={totalInventoryPages}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          isRtl={isRtl}
        />

        <CustomModal isOpen={isReturnModalOpen} onClose={handleCloseReturnModal} title={t('returns.create')}>
          <form onSubmit={handleSubmitReturn} className="space-y-6">
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
              placeholder={t('returns.notes_placeholder')}
              ariaLabel={t('returns.notes')}
            />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('returns.items')}</h3>
              {returnForm.items.map((item, index) => (
                <div key={index} className="border p-4 rounded-lg mb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <CustomSelect
                      label={t('products.select')}
                      value={item.productId}
                      onChange={(e) => {
                        const productId = e.target.value;
                        const maxQuantity = availableItems.find((ai) => ai.productId === productId)?.available || 0;
                        dispatchReturnForm({
                          type: 'UPDATE_ITEM',
                          payload: { index, field: 'productId', value: productId },
                        });
                        dispatchReturnForm({
                          type: 'UPDATE_ITEM',
                          payload: { index, field: 'maxQuantity', value: maxQuantity },
                        });
                        dispatchReturnForm({
                          type: 'UPDATE_ITEM',
                          payload: { index, field: 'orderId', value: '' },
                        });
                      }}
                      options={[
                        { value: '', label: t('products.select') },
                        ...availableItems.map((ai) => ({ value: ai.productId, label: `${ai.productName} (${ai.departmentName})` })),
                      ]}
                      error={returnErrors[`items[${index}].productId`]}
                      ariaLabel={t('products.select')}
                    />
                    <CustomSelect
                      label={t('returns.select_order')}
                      value={item.orderId}
                      onChange={(e) =>
                        dispatchReturnForm({
                          type: 'UPDATE_ITEM',
                          payload: { index, field: 'orderId', value: e.target.value },
                        })
                      }
                      options={[{ value: '', label: t('returns.select_order') }, ...(possibleOrders[item.productId] || [])]}
                      error={returnErrors[`items[${index}].orderId`]}
                      disabled={!item.productId}
                      ariaLabel={t('returns.select_order')}
                    />
                    <CustomInput
                      label={t('returns.quantity')}
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        dispatchReturnForm({
                          type: 'UPDATE_ITEM',
                          payload: { index, field: 'quantity', value: Number(e.target.value) },
                        })
                      }
                      error={returnErrors[`items[${index}].quantity`]}
                      ariaLabel={t('returns.quantity')}
                    />
                    <CustomSelect
                      label={t('returns.reason')}
                      value={item.reason}
                      onChange={(e) =>
                        dispatchReturnForm({
                          type: 'UPDATE_ITEM',
                          payload: { index, field: 'reason', value: e.target.value },
                        })
                      }
                      options={reasonOptions}
                      error={returnErrors[`items[${index}].reason`]}
                      ariaLabel={t('returns.reason')}
                    />
                  </div>
                  {returnForm.items.length > 1 && (
                    <CustomButton
                      variant="destructive"
                      size="sm"
                      onClick={() => dispatchReturnForm({ type: 'REMOVE_ITEM', payload: index })}
                      className="mt-2"
                      ariaLabel={t('returns.remove_item')}
                    >
                      {t('returns.remove_item')}
                    </CustomButton>
                  )}
                </div>
              ))}
              <CustomButton
                variant="secondary"
                size="sm"
                onClick={handleAddReturnItem}
                className="mt-2"
                ariaLabel={t('returns.add_item')}
              >
                {t('returns.add_item')}
              </CustomButton>
            </div>
            <div className={`flex gap-2 ${isRtl ? 'justify-end' : ''}`}>
              <CustomButton
                variant="secondary"
                onClick={handleCloseReturnModal}
                ariaLabel={t('common.cancel')}
              >
                {t('common.cancel')}
              </CustomButton>
              <CustomButton
                type="submit"
                disabled={createReturnMutation.isLoading}
                ariaLabel={t('common.submit')}
              >
                {createReturnMutation.isLoading ? t('common.submitting') : t('common.submit')}
              </CustomButton>
            </div>
          </form>
        </CustomModal>

        <CustomModal isOpen={isEditModalOpen} onClose={handleCloseEditModal} title={t('inventory.edit_stock_limits')}>
          <form onSubmit={handleSubmitEdit} className="space-y-6">
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
            <div className={`flex gap-2 ${isRtl ? 'justify-end' : ''}`}>
              <CustomButton
                variant="secondary"
                onClick={handleCloseEditModal}
                ariaLabel={t('common.cancel')}
              >
                {t('common.cancel')}
              </CustomButton>
              <CustomButton
                type="submit"
                disabled={updateInventoryMutation.isLoading}
                ariaLabel={t('common.save')}
              >
                {updateInventoryMutation.isLoading ? t('common.saving') : t('common.save')}
              </CustomButton>
            </div>
          </form>
        </CustomModal>

        <CustomModal isOpen={isDetailsModalOpen} onClose={handleCloseDetailsModal} title={t('inventory.product_details')}>
          {historyLoading ? (
            <div className="text-center py-4">{t('common.loading')}</div>
          ) : !productHistory || productHistory.length === 0 ? (
            <div className="text-center py-4">{t('inventory.no_history')}</div>
          ) : (
            <div className="space-y-4">
              {productHistory.map((entry) => (
                <CustomCard key={entry._id}>
                  <p className="text-sm text-gray-600">
                    {t('common.date')}: {new Date(entry.date).toLocaleDateString(language)}
                  </p>
                  <p className="text-sm text-gray-600">
                    {t('common.type')}: {t(`inventory.${entry.type}`)}
                  </p>
                  <p className="text-sm text-gray-600">
                    {t('returns.quantity')}: {entry.quantity}
                  </p>
                  <p className="text-sm text-gray-600">
                    {t('common.description')}: {entry.description}
                  </p>
                </CustomCard>
              ))}
            </div>
          )}
          <div className={`flex justify-end mt-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <CustomButton
              variant="secondary"
              onClick={handleCloseDetailsModal}
              ariaLabel={t('common.cancel')}
            >
              {t('common.cancel')}
            </CustomButton>
          </div>
        </CustomModal>
      </div>
    </div>
  );
};