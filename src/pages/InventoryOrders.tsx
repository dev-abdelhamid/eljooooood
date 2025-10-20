import React, { useState, useMemo, useCallback, useEffect, useReducer } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Plus, X, Eye, Edit, AlertCircle, Minus, Search, ChevronDown } from 'lucide-react';
import { factoryOrdersAPI, factoryInventoryAPI, chefsAPI, isValidObjectId } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { ProductSearchInput } from './NewOrder';
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
  } | null;
  currentStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  status: InventoryStatus;
  inProduction: boolean;
}

interface ProductionItem {
  product: string;
  quantity: number;
  assignedTo: string; // Chef ID
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
  minStockLevel: number;
  maxStockLevel: number;
}

interface AvailableProduct {
  productId: string;
  productName: string;
  unit: string;
  departmentName: string;
  departmentId: string;
}

interface FactoryOrder {
  _id: string;
  orderNumber: string;
  items: { productId: string; quantity: number; status: string; assignedTo?: string }[];
  status: 'pending' | 'in_production' | 'completed' | 'cancelled';
}

interface Chef {
  _id: string;
  user: {
    _id: string;
    name: string;
    nameEn?: string;
    username: string;
    email: string;
    phone: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
  department: { _id: string; name: string; nameEn?: string };
  createdAt: string;
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
    editStockLimits: 'تعديل حدود المخزون',
    search: 'البحث عن المنتجات...',
    selectProduct: 'اختر منتج',
    selectChef: 'اختر شيف',
    filterByStatus: 'تصفية حسب الحالة',
    filterByDepartment: 'تصفية حسب القسم',
    allStatuses: 'جميع الحالات',
    allDepartments: 'جميع الأقسام',
    notes: 'ملاحظات',
    notesPlaceholder: 'أدخل ملاحظات إضافية (اختياري)',
    items: 'العناصر',
    chef: 'الشيف',
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
    departmentMismatch: 'الشيف لا ينتمي إلى قسم المنتج',
    chefSelfAssigned: 'تم تعيينك تلقائياً كشيف',
    suggestedQuantity: 'الكمية المقترحة',
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
      invalidChefId: 'معرف الشيف غير صالح',
      productNotFound: 'المنتج غير موجود',
      tooManyRequests: 'طلبات كثيرة جداً، حاول مرة أخرى لاحقاً',
      duplicateProduct: 'لا يمكن إضافة نفس المنتج أكثر من مرة',
      departmentMismatch: 'يمكنك فقط طلب منتجات قسمك',
      chefDepartmentMismatch: 'الشيف المختار لا ينتمي لقسم المنتج',
      unauthorizedAccess: 'غير مصرح لك بالوصول لهذه البيانات',
      sessionExpired: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى',
      networkError: 'خطأ في الاتصال بالخادم',
    },
    notifications: {
      productionCreated: 'تم إنشاء طلب الإنتاج بنجاح',
      inventoryUpdated: 'تم تحديث المخزون بنجاح',
      taskAssigned: 'تم تعيين مهمة إنتاج جديدة لك',
      orderCompleted: 'تم إكمال طلب الإنتاج',
      realTimeUpdate: 'تم تحديث المخزون في الوقت الفعلي',
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
    editStockLimits: 'Edit Stock Limits',
    search: 'Search products...',
    selectProduct: 'Select Product',
    selectChef: 'Select Chef',
    filterByStatus: 'Filter by Status',
    filterByDepartment: 'Filter by Department',
    allStatuses: 'All Statuses',
    allDepartments: 'All Departments',
    notes: 'Notes',
    notesPlaceholder: 'Enter additional notes (optional)',
    items: 'Items',
    chef: 'Chef',
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
    departmentMismatch: 'Chef does not belong to the product department',
    chefSelfAssigned: 'You are automatically assigned as chef',
    suggestedQuantity: 'Suggested Quantity',
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
      invalidChefId: 'Invalid chef ID',
      productNotFound: 'Product not found',
      tooManyRequests: 'Too many requests, please try again later',
      duplicateProduct: 'Cannot add the same product multiple times',
      departmentMismatch: 'You can only request products from your department',
      chefDepartmentMismatch: 'Selected chef does not belong to product department',
      unauthorizedAccess: 'You are not authorized to access this data',
      sessionExpired: 'Session expired, please login again',
      networkError: 'Network connection error',
    },
    notifications: {
      productionCreated: 'Production order created successfully',
      inventoryUpdated: 'Inventory updated successfully',
      taskAssigned: 'New production task assigned to you',
      orderCompleted: 'Production order completed',
      realTimeUpdate: 'Inventory updated in real-time',
    },
  },
};

// **QuantityInput Component مع تحسينات**
const QuantityInput = React.memo(({
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

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // السماح بالإدخال الفارغ مؤقتاً
    if (inputValue === '') {
      onChange('');
      return;
    }

    // تحويل إلى رقم
    const numValue = parseInt(inputValue, 10);
    
    if (isNaN(numValue) || numValue < 1) {
      // إعادة تعيين للقيمة الحالية أو 1
      onChange(value.toString());
      return;
    }

    onChange(inputValue);
  }, [onChange, value]);

  const handleIncrement = useCallback(() => {
    onIncrement();
  }, [onIncrement]);

  const handleDecrement = useCallback(() => {
    onDecrement();
  }, [onDecrement]);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleDecrement}
        className="w-10 h-10 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-full transition-all duration-200 flex items-center justify-center text-gray-600 hover:text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-100"
        disabled={value <= 1}
        aria-label={isRtl ? 'تقليل الكمية' : 'Decrease quantity'}
      >
        <Minus className="w-4 h-4" />
      </button>
      
      <input
        type="number"
        value={value}
        onChange={handleChange}
        min={1}
        className="w-20 h-10 text-center border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white shadow-sm transition-all duration-200 hover:border-gray-300"
        style={{
          MozAppearance: 'textfield',
          WebkitAppearance: 'none',
          appearance: 'textfield',
        }}
        aria-label={isRtl ? 'الكمية' : 'Quantity'}
      />
      
      <button
        type="button"
        onClick={handleIncrement}
        className="w-10 h-10 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-full transition-all duration-200 flex items-center justify-center text-white shadow-sm hover:shadow-md"
        aria-label={isRtl ? 'زيادة الكمية' : 'Increase quantity'}
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
});

QuantityInput.displayName = 'QuantityInput';

// **ProductDropdown Component مع دعم البحث الداخلي**
export const ProductDropdown = React.memo(({
  value,
  onChange,
  options,
  ariaLabel,
  disabled = false,
  placeholder,
  searchEnabled = true,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
  disabled?: boolean;
  placeholder?: string;
  searchEnabled?: boolean;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // فلترة الخيارات حسب البحث
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    
    const query = searchQuery.toLowerCase();
    return options.filter(option =>
      option.label.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  // العثور على الخيار المحدد
  const selectedOption = useMemo(() => {
    const option = options.find(opt => opt.value === value);
    return option || { value: '', label: placeholder || (isRtl ? 'اختر منتج' : 'Select product') };
  }, [options, value, placeholder, isRtl]);

  // إغلاق القائمة عند النقر خارجها
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // إغلاق عند الضغط على Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleSelect = useCallback((optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery('');
  }, [onChange]);

  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen(prev => !prev);
      if (!isOpen) {
        setSearchQuery('');
      }
    }
  }, [disabled, isOpen]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`
          w-full px-4 py-3 border-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-between
          ${disabled 
            ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed' 
            : value 
              ? 'border-amber-200 bg-amber-50 text-gray-900 hover:border-amber-300 hover:bg-amber-50' 
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
          }
          focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none shadow-sm hover:shadow-md
          ${isRtl ? 'text-right' : 'text-left'}
        `}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
      >
        <span className="truncate max-w-[calc(100%-2rem)]" title={selectedOption.label}>
          {selectedOption.label}
        </span>
        <div className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          <ChevronDown className="w-5 h-5 flex-shrink-0" />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute w-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-40 max-h-80 overflow-hidden"
          >
            {/* شريط البحث */}
            {searchEnabled && (
              <div className="p-3 border-b border-gray-100 bg-gray-50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder={isRtl ? 'ابحث في المنتجات...' : 'Search products...'}
                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white transition-all duration-200"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* قائمة الخيارات */}
            <div className="max-h-60 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <Package className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">
                    {isRtl ? 'لا توجد نتائج مطابقة' : 'No matching results'}
                  </p>
                </div>
              ) : (
                filteredOptions.map((option, index) => (
                  <motion.div
                    key={`${option.value}-${index}`}
                    initial={{ opacity: 0, x: isRtl ? 10 : -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="px-4 py-3 text-sm border-b border-gray-50 last:border-b-0 hover:bg-amber-50 hover:text-amber-700 cursor-pointer transition-all duration-200 flex items-center justify-between"
                    onClick={() => handleSelect(option.value)}
                  >
                    <span className="truncate" title={option.label}>
                      {option.label}
                    </span>
                    {option.value === value && (
                      <div className="w-5 h-5 text-amber-600 flex-shrink-0">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

ProductDropdown.displayName = 'ProductDropdown';

// **Reducer لنموذج الإنتاج مع منع التكرار**
type ProductionFormAction =
  | { type: 'SET_NOTES'; payload: string }
  | { type: 'ADD_ITEM'; payload: ProductionItem }
  | { type: 'UPDATE_ITEM'; payload: { index: number; field: keyof ProductionItem; value: string | number } }
  | { type: 'REMOVE_ITEM'; payload: number }
  | { type: 'RESET' };

const productionFormReducer = (state: ProductionFormState, action: ProductionFormAction): ProductionFormState => {
  switch (action.type) {
    case 'SET_NOTES':
      return { ...state, notes: action.payload || '' };

    case 'ADD_ITEM': {
      // منع إضافة منتج مكرر
      const hasDuplicate = state.items.some(item => 
        item.product === action.payload.product && action.payload.product !== ''
      );
      
      if (hasDuplicate) {
        throw new Error('duplicate_product');
      }
      
      return { 
        ...state, 
        items: [...state.items, { 
          ...action.payload, 
          quantity: Math.max(1, action.payload.quantity || 1) 
        }] 
      };
    }

    case 'UPDATE_ITEM': {
      const newItems = [...state.items];
      const currentItem = newItems[action.payload.index];
      
      if (!currentItem) return state;
      
      let newValue = action.payload.value;
      
      // تحسين قيمة الكمية
      if (action.payload.field === 'quantity') {
        const numValue = typeof newValue === 'string' ? parseInt(newValue, 10) : newValue;
        newValue = Math.max(1, isNaN(numValue) ? 1 : numValue);
      }
      
      newItems[action.payload.index] = { 
        ...currentItem, 
        [action.payload.field]: newValue 
      };
      
      return { ...state, items: newItems };
    }

    case 'REMOVE_ITEM':
      return { 
        ...state, 
        items: state.items.filter((_, i) => i !== action.payload) 
      };

    case 'RESET':
      return { notes: '', items: [] };

    default:
      return state;
  }
};

// **دالة تجميع العناصر مع تحسين التحقق**
const aggregateItemsByProduct = useCallback((items: ProductionItem[]): ProductionItem[] => {
  const aggregated: Record<string, ProductionItem> = {};
  
  items.forEach((item) => {
    // تخطي العناصر غير الصالحة
    if (!item.product || !isValidObjectId(item.product)) return;
    if (!item.assignedTo || !isValidObjectId(item.assignedTo)) return;
    if (item.quantity < 1) return;
    
    const key = `${item.product}_${item.assignedTo}`;
    
    if (!aggregated[key]) {
      aggregated[key] = {
        product: item.product,
        quantity: 0,
        assignedTo: item.assignedTo,
      };
    }
    
    aggregated[key].quantity += item.quantity;
  });
  
  return Object.values(aggregated).filter(item => 
    item.quantity > 0 && isValidObjectId(item.product) && isValidObjectId(item.assignedTo)
  );
}, []);

// **المكون الرئيسي**
export const FactoryInventory: React.FC = () => {
  const { t: languageT, language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();

  // **المتغيرات الحالة**
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<InventoryStatus | ''>('');
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [isProductionModalOpen, setIsProductionModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FactoryInventoryItem | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  
  const [productionForm, dispatchProductionForm] = useReducer(productionFormReducer, { 
    notes: '', 
    items: [] 
  });
  const [editForm, setEditForm] = useState<EditForm>({ minStockLevel: 0, maxStockLevel: 0 });
  const [productionErrors, setProductionErrors] = useState<Record<string, string>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [availableProducts, setAvailableProducts] = useState<AvailableProduct[]>([]);

  const ITEMS_PER_PAGE = 12;
  const isChef = user?.role === 'chef';
  const userDepartmentId = user?.department?._id || '';
  const userId = user?._id || '';

  // **Custom debounce hook مع تحسين**
  const useDebouncedState = <T,>(initialValue: T, delay: number): [T, React.Dispatch<React.SetStateAction<T>>, T] => {
    const [value, setValue] = useState<T>(initialValue);
    const [debouncedValue, setDebouncedValue] = useState<T>(initialValue);
    
    useEffect(() => {
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);
      
      return () => {
        if (handler) clearTimeout(handler);
      };
    }, [value, delay]);
    
    return [value, setValue, debouncedValue] as const;
  };

  const [searchInput, setSearchInput, debouncedSearchQuery] = useDebouncedState<string>('', 400);

  // **استعلام المخزون مع تصفية القسم**
  const { 
    data: inventoryData = [], 
    isLoading: inventoryLoading, 
    error: inventoryError,
    refetch: refetchInventory 
  } = useQuery<
    FactoryInventoryItem[],
    Error
  >({
    queryKey: ['factoryInventory', debouncedSearchQuery, filterStatus, filterDepartment, userDepartmentId, language],
    queryFn: async () => {
      const params: Record<string, any> = {
        product: debouncedSearchQuery || undefined,
        stockStatus: filterStatus || undefined,
        lang: language,
      };

      // **إضافة قسم المستخدم للشيفات**
      if (isChef && userDepartmentId) {
        params.department = userDepartmentId;
      } else if (filterDepartment) {
        params.department = filterDepartment;
      }

      console.log(`[${new Date().toISOString()}] Fetching inventory with params:`, params);
      
      try {
        const response = await factoryInventoryAPI.getAll(params);
        console.log(`[${new Date().toISOString()}] Inventory API response:`, response);
        
        // **معالجة الاستجابة بمرونة**
        let data: FactoryInventoryItem[] = [];
        
        if (Array.isArray(response)) {
          data = response;
        } else if (response?.data?.inventory) {
          data = response.data.inventory;
        } else if (response?.inventory) {
          data = response.inventory;
        } else if (response?.data) {
          data = response.data;
        }
        
        if (!Array.isArray(data)) {
          console.warn(`Invalid inventory data format:`, data);
          return [];
        }

        // **تصفية البيانات وإضافة الحقول المطلوبة**
        return data
          .filter((item): item is FactoryInventoryItem => {
            return item && 
                   item._id && 
                   isValidObjectId(item._id) && 
                   item.product && 
                   item.product._id && 
                   isValidObjectId(item.product._id);
          })
          .map((item: FactoryInventoryItem) => ({
            ...item,
            product: {
              ...item.product,
              displayName: isRtl ? item.product.name : (item.product.nameEn || item.product.name),
              displayUnit: isRtl ? (item.product.unit || 'وحدة') : (item.product.unitEn || item.product.unit || 'Unit'),
              department: item.product.department ? {
                ...item.product.department,
                displayName: isRtl 
                  ? item.product.department.name 
                  : (item.product.department.nameEn || item.product.department.name),
              } : null,
            },
            status: item.currentStock <= item.minStockLevel
              ? InventoryStatus.LOW
              : item.currentStock >= item.maxStockLevel
              ? InventoryStatus.FULL
              : InventoryStatus.NORMAL,
            inProduction: false, // سيتم تحديثه لاحقاً من factoryOrdersData
          }));
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Inventory fetch error:`, error);
        throw error;
      }
    },
    enabled: !!user?.role && ['production', 'admin', 'chef'].includes(user.role),
    staleTime: 2 * 60 * 1000, // 2 دقائق
    gcTime: 5 * 60 * 1000, // 5 دقائق
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: (failureCount: number, error: Error) => {
      // عدم إعادة المحاولة لأخطاء الصلاحيات
      if (error.message.includes('غير مصرح') || error.message.includes('Unauthorized')) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex: number) => {
      return Math.min(1000 * 2 ** attemptIndex, 10000);
    },
  });

  // **استعلام الشيفات**
  const { 
    data: chefsData = [], 
    isLoading: chefsLoading 
  } = useQuery<Chef[], Error>({
    queryKey: ['chefs', language, userDepartmentId],
    queryFn: async () => {
      const params: Record<string, any> = { lang: language };
      
      // للشيفات، جلب شيفات قسم المستخدم فقط
      if (isChef && userDepartmentId) {
        params.department = userDepartmentId;
      }

      const response = await chefsAPI.getAll(params);
      console.log(`[${new Date().toISOString()}] Chefs API response:`, response);
      
      let data: Chef[] = [];
      
      if (Array.isArray(response)) {
        data = response;
      } else if (response?.data?.chefs) {
        data = response.data.chefs;
      } else if (response?.chefs) {
        data = response.chefs;
      } else if (response?.data) {
        data = response.data;
      }
      
      if (!Array.isArray(data)) {
        console.warn(`Invalid chefs data format:`, data);
        return [];
      }
      
      // تصفية الشيفات النشطة فقط
      return data.filter(chef => chef.user?.isActive !== false);
    },
    enabled: isProductionModalOpen && !!user?.role && ['production', 'admin'].includes(user.role),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // **استعلام تاريخ المنتج**
  const { 
    data: productHistory = [], 
    isLoading: historyLoading 
  } = useQuery<ProductHistoryEntry[], Error>({
    queryKey: ['factoryProductHistory', selectedProductId, language, userDepartmentId],
    queryFn: async () => {
      if (!selectedProductId || !isValidObjectId(selectedProductId)) {
        return [];
      }

      const params: Record<string, any> = {
        productId: selectedProductId,
        lang: language,
      };

      // إضافة قسم المستخدم للشيفات
      if (isChef && userDepartmentId) {
        params.department = userDepartmentId;
      }

      const response = await factoryInventoryAPI.getHistory(params);
      console.log(`[${new Date().toISOString()}] Product history response:`, response);
      
      let data: ProductHistoryEntry[] = [];
      
      if (Array.isArray(response)) {
        data = response;
      } else if (response?.data?.history) {
        data = response.data.history;
      } else if (response?.history) {
        data = response.history;
      } else if (response?.data) {
        data = response.data;
      }
      
      return Array.isArray(data) ? data : [];
    },
    enabled: isDetailsModalOpen && !!selectedProductId && isValidObjectId(selectedProductId),
    staleTime: 5 * 60 * 1000,
  });

  // **استعلام طلبات المصنع لتحديد العناصر في الإنتاج**
  const { data: factoryOrdersData = [] } = useQuery<FactoryOrder[], Error>({
    queryKey: ['factoryOrders', language, userDepartmentId],
    queryFn: async () => {
      const params: Record<string, any> = { lang: language };
      
      if (isChef && userDepartmentId) {
        params.department = userDepartmentId;
      }

      const response = await factoryOrdersAPI.getAll(params);
      console.log(`[${new Date().toISOString()}] Factory orders response:`, response);
      
      let data: FactoryOrder[] = [];
      
      if (Array.isArray(response)) {
        data = response;
      } else if (response?.data) {
        data = response.data;
      }
      
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user?.role && ['production', 'admin', 'chef'].includes(user.role),
    staleTime: 1 * 60 * 1000, // تحديث كل دقيقة
  });

  // **تحديث حالة inProduction**
  const inventoryWithProductionStatus = useMemo(() => {
    if (!inventoryData.length || !factoryOrdersData.length) return inventoryData;
    
    return inventoryData.map(item => ({
      ...item,
      inProduction: factoryOrdersData.some(order =>
        (order.status === 'pending' || order.status === 'in_production') &&
        order.items.some(orderItem => 
          orderItem.productId === item.product?._id
        )
      ),
    }));
  }, [inventoryData, factoryOrdersData]);

  // **جلب المنتجات المتاحة مع تصفية القسم**
  useEffect(() => {
    let isMounted = true;

    const fetchAvailableProducts = async () => {
      try {
        const params: Record<string, any> = { lang: language };
        
        // **تصفية حسب قسم الشيف**
        if (isChef && userDepartmentId) {
          params.department = userDepartmentId;
        }

        console.log(`[${new Date().toISOString()}] Fetching available products with params:`, params);
        
        const response = await factoryInventoryAPI.getAvailableProducts(params);
        console.log(`[${new Date().toISOString()}] Available products response:`, response);
        
        let products: any[] = [];
        
        if (Array.isArray(response)) {
          products = response;
        } else if (response?.data) {
          products = response.data;
        } else if (response?.products) {
          products = response.products;
        }
        
        if (!Array.isArray(products)) {
          console.warn(`Invalid products data format:`, products);
          if (isMounted) setAvailableProducts([]);
          return;
        }

        // **تحويل وتصفية المنتجات**
        const filteredProducts: AvailableProduct[] = products
          .filter(product => 
            product && 
            product._id && 
            isValidObjectId(product._id)
          )
          .map(product => ({
            productId: product._id,
            productName: isRtl 
              ? (product.name || product.nameEn || 'منتج غير معروف') 
              : (product.nameEn || product.name || 'Unknown Product'),
            unit: isRtl 
              ? (product.unit || product.unitEn || t.unit) 
              : (product.unitEn || product.unit || 'Unit'),
            departmentName: isRtl
              ? (product.department?.name || t.allDepartments)
              : (product.department?.nameEn || product.department?.name || 'Unknown Department'),
            departmentId: product.department?._id || '',
          }));

        // **تصفية إضافية للشيفات**
        const finalProducts = isChef && userDepartmentId
          ? filteredProducts.filter(p => p.departmentId === userDepartmentId)
          : filteredProducts;

        if (isMounted) {
          setAvailableProducts(finalProducts);
          console.log(`[${new Date().toISOString()}] Available products loaded: ${finalProducts.length}`);
        }
      } catch (error: any) {
        console.error(`[${new Date().toISOString()}] Error fetching available products:`, error);
        
        let errorMessage = t.errors.productNotFound;
        
        if (error.response?.status === 403 && isChef) {
          errorMessage = t.errors.departmentMismatch;
        } else if (error.response?.status === 401) {
          errorMessage = t.errors.sessionExpired;
        } else if (!navigator.onLine) {
          errorMessage = t.errors.networkError;
        }

        toast.error(errorMessage, {
          position: isRtl ? 'top-right' : 'top-left',
          toastId: 'available-products-error',
        });

        if (isMounted) {
          setAvailableProducts([]);
        }
      }
    };

    if (user?.role) {
      fetchAvailableProducts();
    }

    return () => {
      isMounted = false;
    };
  }, [language, isRtl, t, isChef, userDepartmentId, user?.role]);

  // **Socket Events مع معالجة شاملة**
  useEffect(() => {
    if (!socket || !isConnected || !user?.role) return;

    // **معالجات الأحداث**
    const eventHandlers: Record<string, (data: any) => void> = {
      factoryInventoryUpdated: ({ productId }: { productId: string }) => {
        if (!isValidObjectId(productId)) {
          console.warn(`Invalid productId in factoryInventoryUpdated: ${productId}`);
          return;
        }

        // إعادة تحميل البيانات
        queryClient.invalidateQueries({ queryKey: ['factoryInventory'] });
        
        if (selectedProductId === productId) {
          queryClient.invalidateQueries({ queryKey: ['factoryProductHistory'] });
        }

        // إشعار المستخدم
        toast.success(t.notifications.realTimeUpdate, {
          position: isRtl ? 'top-right' : 'top-left',
          toastId: `inventory-updated-${productId}`,
        });

        // إضافة إشعار
        addNotification({
          _id: crypto.randomUUID(),
          type: 'success',
          message: t.notifications.inventoryUpdated,
          data: { 
            productId, 
            eventId: crypto.randomUUID(), 
            isRtl 
          },
          read: false,
          createdAt: new Date().toISOString(),
          sound: '/sounds/notification.mp3',
          vibrate: [200, 100, 200],
        });
      },

      factoryOrderCreated: ({ orderId, orderNumber, branchId }: { 
        orderId: string; 
        orderNumber: string; 
        branchId?: string; 
      }) => {
        if (!isValidObjectId(orderId)) {
          console.warn(`Invalid orderId in factoryOrderCreated: ${orderId}`);
          return;
        }

        // تشغيل صوت الإشعار
        const playNotificationSound = async () => {
          try {
            const audio = new Audio('/sounds/notification.mp3');
            await audio.play();
          } catch (error) {
            console.warn('Notification sound failed to play:', error);
          }
        };

        playNotificationSound();

        // إشعار Toast
        toast.success(`${t.notifications.productionCreated} #${orderNumber}`, {
          position: isRtl ? 'top-right' : 'top-left',
          toastId: `order-created-${orderId}`,
        });

        // إشعار النظام
        addNotification({
          _id: crypto.randomUUID(),
          type: 'success',
          message: `${t.notifications.productionCreated} #${orderNumber}`,
          data: { 
            orderId, 
            orderNumber, 
            branchId, 
            eventId: crypto.randomUUID(), 
            isRtl 
          },
          read: false,
          createdAt: new Date().toISOString(),
          sound: '/sounds/notification.mp3',
          vibrate: [200, 100, 200],
        });

        // إعادة تحميل البيانات
        queryClient.invalidateQueries({ queryKey: ['factoryInventory'] });
        queryClient.invalidateQueries({ queryKey: ['factoryOrders'] });
      },

      factoryTaskAssigned: ({
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
        // عرض الإشعار للشيف المُعيَّن فقط
        if (userId !== chefId) return;

        const playNotificationSound = async () => {
          try {
            const audio = new Audio('/sounds/notification.mp3');
            await audio.play();
          } catch (error) {
            console.warn('Task notification sound failed:', error);
          }
        };

        playNotificationSound();

        toast.info(`${t.notifications.taskAssigned}: ${productName}`, {
          position: isRtl ? 'top-right' : 'top-left',
          toastId: `task-assigned-${taskId}`,
        });

        addNotification({
          _id: crypto.randomUUID(),
          type: 'info',
          message: `${t.notifications.taskAssigned}: ${productName}`,
          data: { 
            factoryOrderId, 
            taskId, 
            chefId, 
            productName, 
            eventId: crypto.randomUUID(), 
            isRtl 
          },
          read: false,
          createdAt: new Date().toISOString(),
          sound: '/sounds/notification.mp3',
          vibrate: [300, 100, 300],
        });
      },

      factoryOrderCompleted: ({ 
        factoryOrderId, 
        orderNumber 
      }: { 
        factoryOrderId: string; 
        orderNumber: string; 
      }) => {
        if (!isValidObjectId(factoryOrderId)) return;

        const playNotificationSound = async () => {
          try {
            const audio = new Audio('/sounds/notification.mp3');
            await audio.play();
          } catch (error) {
            console.warn('Order completion sound failed:', error);
          }
        };

        playNotificationSound();

        toast.success(`${t.notifications.orderCompleted} #${orderNumber}`, {
          position: isRtl ? 'top-right' : 'top-left',
          toastId: `order-completed-${factoryOrderId}`,
        });

        addNotification({
          _id: crypto.randomUUID(),
          type: 'success',
          message: `${t.notifications.orderCompleted} #${orderNumber}`,
          data: { 
            factoryOrderId, 
            orderNumber, 
            eventId: crypto.randomUUID(), 
            isRtl 
          },
          read: false,
          createdAt: new Date().toISOString(),
          sound: '/sounds/notification.mp3',
          vibrate: [200, 100, 200],
        });

        queryClient.invalidateQueries({ queryKey: ['factoryInventory'] });
        queryClient.invalidateQueries({ queryKey: ['factoryOrders'] });
      },
    };

    // **تسجيل المعالجات**
    Object.entries(eventHandlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    // **إعادة الاتصال التلقائي**
    const reconnectInterval = setInterval(() => {
      if (!isConnected && socket) {
        console.log(`[${new Date().toISOString()}] Attempting WebSocket reconnection...`);
        socket.connect();
      }
    }, 10000); // كل 10 ثوان

    return () => {
      // **إلغاء التسجيل**
      Object.entries(eventHandlers).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
      
      clearInterval(reconnectInterval);
    };
  }, [
    socket, 
    isConnected, 
    user?.role, 
    userId, 
    queryClient, 
    addNotification, 
    t, 
    isRtl, 
    selectedProductId, 
    language 
  ]);

  // **خيارات الأقسام**
  const departmentOptions = useMemo(() => {
    const deptMap = new Map<string, { value: string; label: string }>();
    
    // من المخزون
    inventoryWithProductionStatus.forEach((item) => {
      const dept = item.product?.department;
      if (dept?._id && !deptMap.has(dept._id)) {
        deptMap.set(dept._id, {
          value: dept._id,
          label: dept.displayName || (isRtl ? dept.name : (dept.nameEn || dept.name || 'غير معروف')),
        });
      }
    });

    // من المنتجات المتاحة
    availableProducts.forEach((product) => {
      if (product.departmentId && !deptMap.has(product.departmentId)) {
        deptMap.set(product.departmentId, {
          value: product.departmentId,
          label: product.departmentName,
        });
      }
    });

    const options = [
      { value: '', label: t.allDepartments },
      ...Array.from(deptMap.values()).sort((a, b) => 
        a.label.localeCompare(b.label, language, { sensitivity: 'base' })
      ),
    ];

    // **للشيف، إظهار قسمه فقط**
    if (isChef && userDepartmentId) {
      const userDept = options.find(opt => opt.value === userDepartmentId);
      if (userDept) {
        return [
          { value: '', label: t.allDepartments },
          userDept,
        ];
      }
    }

    return options;
  }, [inventoryWithProductionStatus, availableProducts, t, isRtl, language, isChef, userDepartmentId]);

  // **خيارات الحالة**
  const statusOptions = useMemo(() => [
    { value: '', label: t.allStatuses },
    { value: InventoryStatus.LOW, label: t.lowStock },
    { value: InventoryStatus.NORMAL, label: t.normal },
    { value: InventoryStatus.FULL, label: t.full },
  ], [t]);

  // **خيارات المنتجات**
  const productOptions = useMemo(() => [
    { value: '', label: t.selectProduct },
    ...availableProducts.map((product) => ({
      value: product.productId,
      label: `${product.productName} (${t.unit}: ${product.unit}) - ${product.departmentName}`,
    })),
  ], [availableProducts, t]);

  // **خريطة قسم المنتج**
  const productDepartmentMap = useMemo(() => {
    const map: Record<string, string> = {};
    availableProducts.forEach((prod) => {
      if (prod.productId && prod.departmentId) {
        map[prod.productId] = prod.departmentId;
      }
    });
    return map;
  }, [availableProducts]);

  // **الحصول على خيارات الشيفات**
  const getChefOptions = useCallback((departmentId?: string): { value: string; label: string }[] => {
    if (isChef) {
      // **للشيف، عرض نفسه فقط**
      return [
        { 
          value: userId, 
          label: isRtl 
            ? (user?.name || 'أنت') 
            : (user?.nameEn || user?.name || 'You') 
        },
      ];
    }

    const options: { value: string; label: string }[] = [
      { value: '', label: t.selectChef },
    ];

    chefsData.forEach((chef) => {
      // **تصفية حسب القسم إذا تم تحديده**
      if (departmentId && chef.department?._id !== departmentId) {
        return;
      }

      options.push({
        value: chef._id,
        label: isRtl
          ? (chef.user.name || chef.user.nameEn || `شيف بدون اسم (${chef._id.slice(-4)})` )
          : (chef.user.nameEn || chef.user.name || `Chef (${chef._id.slice(-4)})`),
      });
    });

    return options;
  }, [chefsData, isChef, userId, user?.name, user?.nameEn, isRtl, t.selectChef]);

  // **تصفية وترتيب المخزون**
  const filteredInventory = useMemo(() => {
    return (inventoryWithProductionStatus || [])
      .filter((item) => {
        if (!item.product) return false;

        // **البحث**
        const searchLower = debouncedSearchQuery.toLowerCase();
        const matchesSearch = 
          item.product.displayName.toLowerCase().includes(searchLower) ||
          item.product.code.toLowerCase().includes(searchLower) ||
          (item.product.department?.displayName?.toLowerCase().includes(searchLower) ?? false);

        // **تصفية الحالة**
        const matchesStatus = !filterStatus || item.status === filterStatus;

        // **تصفية القسم**
        const matchesDepartment = !filterDepartment || 
          item.product.department?._id === filterDepartment;

        return matchesSearch && matchesStatus && matchesDepartment;
      })
      .sort((a, b) => {
        // **المخزون المنخفض أولاً**
        if (a.status === InventoryStatus.LOW && b.status !== InventoryStatus.LOW) return -1;
        if (b.status === InventoryStatus.LOW && a.status !== InventoryStatus.LOW) return 1;
        
        // **ثم حسب الكمية الصاعدة**
        return a.currentStock - b.currentStock;
      });
  }, [inventoryWithProductionStatus, debouncedSearchQuery, filterStatus, filterDepartment]);

  const paginatedInventory = useMemo(() => 
    filteredInventory.slice(
      (currentPage - 1) * ITEMS_PER_PAGE, 
      currentPage * ITEMS_PER_PAGE
    ), 
    [filteredInventory, currentPage]
  );

  const totalInventoryPages = Math.ceil(filteredInventory.length / ITEMS_PER_PAGE);

  // **المعالجات**
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    setCurrentPage(1);
  }, [setSearchInput]);

  const handleFilterStatusChange = useCallback((status: string) => {
    setFilterStatus(status as InventoryStatus | '');
    setCurrentPage(1);
  }, []);

  const handleFilterDepartmentChange = useCallback((department: string) => {
    setFilterDepartment(department);
    setCurrentPage(1);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(Math.max(1, page));
  }, []);

  const handleOpenProductionModal = useCallback((item?: FactoryInventoryItem) => {
    try {
      dispatchProductionForm({ type: 'RESET' });
      setProductionErrors({});

      let initialItem: ProductionItem = {
        product: '',
        quantity: 1,
        assignedTo: isChef ? userId : '',
      };

      // **إذا تم تمرير عنصر، اقتراح كمية منطقية**
      if (item?.product?._id) {
        const suggestedQuantity = Math.max(
          1, 
          item.minStockLevel - item.currentStock
        );
        
        initialItem = {
          product: item.product._id,
          quantity: suggestedQuantity,
          assignedTo: isChef ? userId : '',
        };
      }

      dispatchProductionForm({
        type: 'ADD_ITEM',
        payload: initialItem,
      });

      setIsProductionModalOpen(true);
    } catch (error) {
      if (error instanceof Error && error.message === 'duplicate_product') {
        toast.error(t.errors.duplicateProduct, {
          position: isRtl ? 'top-right' : 'top-left',
        });
      } else {
        console.error('Error opening production modal:', error);
      }
    }
  }, [isChef, userId, t.errors.duplicateProduct, isRtl, t]);

  const handleOpenEditModal = useCallback((item: FactoryInventoryItem) => {
    if (!item._id || !isValidObjectId(item._id)) {
      toast.error(t.errors.invalidProductId, {
        position: isRtl ? 'top-right' : 'top-left',
      });
      return;
    }

    setSelectedItem(item);
    setEditForm({ 
      minStockLevel: Math.max(0, item.minStockLevel), 
      maxStockLevel: Math.max(item.minStockLevel + 1, item.maxStockLevel) 
    });
    setEditErrors({});
    setIsEditModalOpen(true);
  }, [t.errors.invalidProductId, isRtl, t]);

  const handleOpenDetailsModal = useCallback((item: FactoryInventoryItem) => {
    if (!item.product?._id || !isValidObjectId(item.product._id)) {
      toast.error(t.errors.invalidProductId, {
        position: isRtl ? 'top-right' : 'top-left',
      });
      return;
    }

    setSelectedProductId(item.product._id);
    setIsDetailsModalOpen(true);
  }, [t.errors.invalidProductId, isRtl, t]);

  // **معالجات النموذج مع التحقق من القسم**
  const addItemToForm = useCallback(() => {
    try {
      dispatchProductionForm({
        type: 'ADD_ITEM',
        payload: { 
          product: '', 
          quantity: 1, 
          assignedTo: isChef ? userId : '' 
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'duplicate_product') {
        toast.error(t.errors.duplicateProduct, {
          position: isRtl ? 'top-right' : 'top-left',
        });
      }
    }
  }, [isChef, userId, t.errors.duplicateProduct, isRtl, t]);

  const updateItemInForm = useCallback((
    index: number, 
    field: keyof ProductionItem, 
    value: string | number
  ) => {
    // **التحقق من صحة الفهرس**
    if (index < 0 || index >= productionForm.items.length) {
      console.warn(`Invalid item index: ${index}`);
      return;
    }

    let validatedValue = value;

    // **التحقق من الكمية**
    if (field === 'quantity' && typeof value === 'string') {
      const numValue = parseInt(value, 10);
      validatedValue = isNaN(numValue) || numValue < 1 ? 1 : numValue;
    }

    dispatchProductionForm({ 
      type: 'UPDATE_ITEM', 
      payload: { index, field, value: validatedValue } 
    });

    // **مسح أخطاء الحقل**
    setProductionErrors(prev => {
      const newErrors = { ...prev };
      const errorKey = `item_${index}_${field}`;
      delete newErrors[errorKey];
      return newErrors;
    });
  }, [productionForm.items.length]);

  const handleProductChange = useCallback((index: number, productId: string) => {
    // **التحقق من الفهرس**
    if (index < 0 || index >= productionForm.items.length) return;

    // **التحقق من صحة معرف المنتج**
    if (!isValidObjectId(productId)) {
      setProductionErrors(prev => ({
        ...prev,
        [`item_${index}_product`]: t.errors.invalidProductId,
      }));
      return;
    }

    // **التحقق من التكرار**
    const hasDuplicate = productionForm.items.some((item, i) => 
      i !== index && item.product === productId
    );
    
    if (hasDuplicate) {
      setProductionErrors(prev => ({
        ...prev,
        [`item_${index}_product`]: t.errors.duplicateProduct,
      }));
      return;
    }

    // **التحقق من توافق القسم للشيف**
    if (isChef) {
      const productDeptId = productDepartmentMap[productId];
      if (userDepartmentId && productDeptId && productDeptId !== userDepartmentId) {
        setProductionErrors(prev => ({
          ...prev,
          [`item_${index}_product`]: t.errors.departmentMismatch,
        }));
        return;
      }
    }

    dispatchProductionForm({
      type: 'UPDATE_ITEM',
      payload: { index, field: 'product', value: productId },
    });

    // **مسح أخطاء الشيف لأن القسم قد تغير**
    setProductionErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[`item_${index}_assignedTo`];
      delete newErrors[`item_${index}_product`];
      return newErrors;
    });
  }, [
    productionForm.items, 
    t.errors, 
    productDepartmentMap, 
    isChef, 
    userDepartmentId 
  ]);

  const handleChefChange = useCallback((index: number, chefId: string) => {
    // **التحقق من الفهرس**
    if (index < 0 || index >= productionForm.items.length) return;

    // **التحقق من صحة معرف الشيف**
    if (!isValidObjectId(chefId)) {
      setProductionErrors(prev => ({
        ...prev,
        [`item_${index}_assignedTo`]: t.errors.invalidChefId,
      }));
      return;
    }

    const currentItem = productionForm.items[index];
    if (!currentItem.product) {
      setProductionErrors(prev => ({
        ...prev,
        [`item_${index}_assignedTo`]: t.errors.required.replace('{field}', t.selectProduct),
      }));
      return;
    }

    // **التحقق من توافق قسم الشيف مع قسم المنتج**
    const productDeptId = productDepartmentMap[currentItem.product];
    const selectedChef = chefsData.find(chef => chef._id === chefId);
    
    if (productDeptId && selectedChef && selectedChef.department?._id !== productDeptId) {
      setProductionErrors(prev => ({
        ...prev,
        [`item_${index}_assignedTo`]: t.errors.chefDepartmentMismatch,
      }));
      return;
    }

    dispatchProductionForm({
      type: 'UPDATE_ITEM',
      payload: { index, field: 'assignedTo', value: chefId },
    });

    // **مسح أخطاء الشيف**
    setProductionErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[`item_${index}_assignedTo`];
      return newErrors;
    });
  }, [
    productionForm.items, 
    productDepartmentMap, 
    chefsData, 
    t.errors
  ]);

  const removeItemFromForm = useCallback((index: number) => {
    if (index < 0 || index >= productionForm.items.length) return;
    
    dispatchProductionForm({ type: 'REMOVE_ITEM', payload: index });
    
    // **مسح جميع أخطاء هذا العنصر**
    setProductionErrors(prev => {
      const newErrors = { ...prev };
      Object.keys(newErrors).forEach(key => {
        if (key.startsWith(`item_${index}_`)) {
          delete newErrors[key];
        }
      });
      return newErrors;
    });
  }, [productionForm.items.length]);

  // **التحقق من صحة النموذج**
  const validateProductionForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    // **التحقق من وجود عناصر**
    if (productionForm.items.length === 0) {
      errors.form = t.errors.noItemSelected;
    }

    productionForm.items.forEach((item, index) => {
      // **التحقق من المنتج**
      if (!item.product) {
        errors[`item_${index}_product`] = t.errors.required.replace('{field}', t.selectProduct);
      } else if (!isValidObjectId(item.product)) {
        errors[`item_${index}_product`] = t.errors.invalidProductId;
      } else {
        // **التحقق من توافق القسم للشيف**
        if (isChef) {
          const productDeptId = productDepartmentMap[item.product];
          if (userDepartmentId && productDeptId && productDeptId !== userDepartmentId) {
            errors[`item_${index}_product`] = t.errors.departmentMismatch;
          }
        }
      }

      // **التحقق من الشيف**
      if (!item.assignedTo) {
        errors[`item_${index}_assignedTo`] = t.errors.required.replace('{field}', t.chef);
      } else if (!isValidObjectId(item.assignedTo)) {
        errors[`item_${index}_assignedTo`] = t.errors.invalidChefId;
      } else {
        // **التحقق من توافق قسم الشيف**
        if (!isChef) {
          const productDeptId = productDepartmentMap[item.product];
          const selectedChef = chefsData.find(chef => chef._id === item.assignedTo);
          if (productDeptId && selectedChef && selectedChef.department?._id !== productDeptId) {
            errors[`item_${index}_assignedTo`] = t.errors.chefDepartmentMismatch;
          }
        }
      }

      // **التحقق من الكمية**
      if (!Number.isFinite(item.quantity) || item.quantity < 1) {
        errors[`item_${index}_quantity`] = t.errors.invalidQuantityMax;
      }
    });

    setProductionErrors(errors);
    return Object.keys(errors).length === 0;
  }, [productionForm, t.errors, isChef, productDepartmentMap, userDepartmentId, chefsData]);

  // **التحقق من صحة نموذج التعديل**
  const validateEditForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!Number.isFinite(editForm.minStockLevel) || editForm.minStockLevel < 0) {
      errors.minStockLevel = t.errors.nonNegative.replace('{field}', t.minStock);
    }

    if (!Number.isFinite(editForm.maxStockLevel) || editForm.maxStockLevel < 0) {
      errors.maxStockLevel = t.errors.nonNegative.replace('{field}', t.maxStock);
    }

    if (editForm.maxStockLevel <= editForm.minStockLevel) {
      errors.maxStockLevel = t.errors.maxGreaterMin;
    }

    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  }, [editForm, t.errors]);

  // **Mutation لإنشاء طلب الإنتاج**
  const createProductionMutation = useMutation<
    { orderId: string; orderNumber: string }, 
    Error, 
    void
  >({
    mutationFn: async () => {
      // **التحقق من صحة النموذج**
      if (!validateProductionForm()) {
        throw new Error(t.errors.invalidForm);
      }

      if (!userId) {
        throw new Error(t.errors.sessionExpired);
      }

      // **تجميع العناصر**
      const aggregatedItems = aggregateItemsByProduct(productionForm.items);
      
      if (aggregatedItems.length === 0) {
        throw new Error(t.errors.noItemSelected);
      }

      // **إعداد البيانات للإرسال**
      const payload = {
        orderNumber: `PROD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        items: aggregatedItems.map(item => ({
          productId: item.product, // **تأكد من استخدام productId**
          quantity: item.quantity,
          assignedTo: item.assignedTo,
        })),
        notes: productionForm.notes.trim() || '',
        priority: 'medium' as const,
        departmentId: isChef ? userDepartmentId : undefined, // **إضافة قسم الشيف**
      };

      console.log(`[${new Date().toISOString()}] Creating production order:`, payload);

      const response = await factoryOrdersAPI.create(payload);
      
      if (!response?._id || !isValidObjectId(response._id)) {
        throw new Error(t.errors.createProduction);
      }

      return {
        orderId: response._id,
        orderNumber: response.orderNumber || payload.orderNumber,
      };
    },
    onMutate: async () => {
      // **إلغاء الاستعلامات المعلقة**
      await queryClient.cancelQueries({ queryKey: ['factoryInventory'] });
      await queryClient.cancelQueries({ queryKey: ['factoryOrders'] });
    },
    onSuccess: (data) => {
      // **إعادة تحميل البيانات**
      queryClient.invalidateQueries({ queryKey: ['factoryInventory'] });
      queryClient.invalidateQueries({ queryKey: ['factoryOrders'] });
      queryClient.invalidateQueries({ queryKey: ['chefs'] });

      // **إغلاق النموذج وإعادة تعيين الحالة**
      setIsProductionModalOpen(false);
      dispatchProductionForm({ type: 'RESET' });
      setProductionErrors({});

      // **إشعار النجاح**
      toast.success(`${t.notifications.productionCreated} #${data.orderNumber}`, {
        position: isRtl ? 'top-right' : 'top-left',
        toastId: `production-success-${data.orderId}`,
      });

      // **إرسال حدث Socket**
      if (socket && isConnected) {
        socket.emit('factoryOrderCreated', {
          orderId: data.orderId,
          orderNumber: data.orderNumber,
          branchId: user?.branch?._id,
          departmentId: userDepartmentId,
          createdBy: userId,
          eventId: crypto.randomUUID(),
          isRtl,
        });
      }
    },
    onError: (error: Error, variables: void, context?: any) => {
      console.error(`[${new Date().toISOString()}] Production creation error:`, error);

      let errorMessage = error.message || t.errors.createProduction;

      // **معالجة أخطاء الـ Backend**
      if (error.message.includes('Network')) {
        errorMessage = t.errors.networkError;
      } else if (error.response?.status === 400) {
        const responseData = (error as any).response?.data;
        
        if (responseData?.message?.includes('البيانات غير صالحة') || 
            responseData?.message?.includes('Invalid data')) {
          errorMessage = t.errors.invalidForm;
        } else if (responseData?.errors) {
          // **معالجة أخطاء التحقق**
          const validationErrors = responseData.errors.map((e: any) => e.msg).join(', ');
          errorMessage = validationErrors || t.errors.invalidForm;
          
          // **تحديث أخطاء النموذج**
          responseData.errors.forEach((e: any) => {
            if (e.path && e.path.length >= 2 && e.path[0] === 'items') {
              const itemIndex = parseInt(e.path[1]?.replace(/[\[\]]/g, '') || '0');
              const field = e.path[2] || 'unknown';
              setProductionErrors(prev => ({
                ...prev,
                [`item_${itemIndex}_${field}`]: e.msg,
              }));
            }
          });
        }
      } else if (error.response?.status === 403) {
        errorMessage = isChef 
          ? t.errors.departmentMismatch 
          : t.errors.unauthorizedAccess;
      } else if (error.response?.status === 401) {
        errorMessage = t.errors.sessionExpired;
      } else if (error.response?.status === 429) {
        errorMessage = t.errors.tooManyRequests;
      }

      toast.error(errorMessage, {
        position: isRtl ? 'top-right' : 'top-left',
        toastId: 'production-creation-error',
      });

      // **استعادة البيانات في حالة الخطأ**
      if (context?.previousInventory) {
        queryClient.setQueryData(['factoryInventory'], context.previousInventory);
      }
      if (context?.previousOrders) {
        queryClient.setQueryData(['factoryOrders'], context.previousOrders);
      }
    },
    onSettled: () => {
      // **إعادة تحميل البيانات في النهاية**
      queryClient.invalidateQueries({ queryKey: ['factoryInventory'] });
      queryClient.invalidateQueries({ queryKey: ['factoryOrders'] });
    },
  });

  // **Mutation لتحديث حدود المخزون**
  const updateInventoryMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      if (!validateEditForm()) {
        throw new Error(t.errors.invalidForm);
      }

      if (!selectedItem?._id || !isValidObjectId(selectedItem._id)) {
        throw new Error(t.errors.noItemSelected);
      }

      const payload = {
        minStockLevel: Math.max(0, editForm.minStockLevel),
        maxStockLevel: Math.max(editForm.minStockLevel + 1, editForm.maxStockLevel),
      };

      console.log(`[${new Date().toISOString()}] Updating inventory limits:`, {
        id: selectedItem._id,
        ...payload,
      });

      await factoryInventoryAPI.updateStock(selectedItem._id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factoryInventory'] });
      
      setIsEditModalOpen(false);
      setEditForm({ minStockLevel: 0, maxStockLevel: 0 });
      setEditErrors({});
      setSelectedItem(null);

      toast.success(t.notifications.inventoryUpdated, {
        position: isRtl ? 'top-right' : 'top-left',
        toastId: 'inventory-update-success',
      });

      // **إرسال حدث Socket**
      if (socket && isConnected && selectedItem?.product?._id) {
        socket.emit('factoryInventoryUpdated', {
          productId: selectedItem.product._id,
          updatedBy: userId,
          eventId: crypto.randomUUID(),
          isRtl,
        });
      }
    },
    onError: (error: Error) => {
      console.error(`[${new Date().toISOString()}] Inventory update error:`, error);
      
      let errorMessage = error.message || t.errors.updateInventory;
      
      if (error.response?.status === 403) {
        errorMessage = t.errors.unauthorizedAccess;
      } else if (error.response?.status === 429) {
        errorMessage = t.errors.tooManyRequests;
      }

      toast.error(errorMessage, {
        position: isRtl ? 'top-right' : 'top-left',
        toastId: 'inventory-update-error',
      });

      setEditErrors(prev => ({ ...prev, form: errorMessage }));
    },
  });

  // **معالجات إغلاق النماذج**
  const handleCloseProductionModal = useCallback(() => {
    setIsProductionModalOpen(false);
    dispatchProductionForm({ type: 'RESET' });
    setProductionErrors({});
  }, []);

  const handleCloseEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setEditErrors({});
    setSelectedItem(null);
    setEditForm({ minStockLevel: 0, maxStockLevel: 0 });
  }, []);

  const handleCloseDetailsModal = useCallback(() => {
    setIsDetailsModalOpen(false);
    setSelectedProductId('');
  }, []);

  // **معالج إغلاق النماذج عند الضغط على Escape**
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isProductionModalOpen) handleCloseProductionModal();
        if (isEditModalOpen) handleCloseEditModal();
        if (isDetailsModalOpen) handleCloseDetailsModal();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isProductionModalOpen, isEditModalOpen, isDetailsModalOpen]);

  // **معالج النقر خارج النماذج**
  useEffect(() => {
    const handleBackdropClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      if (target.classList.contains('modal-backdrop')) {
        if (isProductionModalOpen) handleCloseProductionModal();
        if (isEditModalOpen) handleCloseEditModal();
        if (isDetailsModalOpen) handleCloseDetailsModal();
      }
    };

    document.addEventListener('click', handleBackdropClick);
    return () => document.removeEventListener('click', handleBackdropClick);
  }, [isProductionModalOpen, isEditModalOpen, isDetailsModalOpen]);

  // **رسالة الخطأ**
  const errorMessage = useMemo(() => {
    if (!inventoryError) return '';
    
    if (inventoryError.message.includes('غير مصرح') || 
        inventoryError.message.includes('Unauthorized')) {
      return isChef ? t.errors.departmentMismatch : t.errors.unauthorizedAccess;
    }
    
    if (inventoryError.message.includes('Network')) {
      return t.errors.networkError;
    }
    
    return inventoryError.message || t.errors.fetchInventory;
  }, [inventoryError, isChef, t]);

  // **عرض حالة التحميل**
  if (inventoryLoading && inventoryData.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{isRtl ? 'جاري تحميل المخزون...' : 'Loading inventory...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isRtl ? 'rtl' : 'ltr'} mx-auto px-4 py-6 max-w-7xl`}>
      {/* **الرأس الرئيسي** */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-50 rounded-2xl">
            <Package className="w-8 h-8 text-amber-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">{t.title}</h1>
            <p className="text-gray-600">{t.description}</p>
            {isChef && (
              <p className="text-sm text-amber-600 mt-1 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {t.departmentMismatch}
              </p>
            )}
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleOpenProductionModal()}
          className="px-6 py-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
          aria-label={t.create}
        >
          <Plus className="w-4 h-4" />
          {t.create}
        </motion.button>
      </div>

      {/* **رسالة الخطأ** */}
      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-red-800 font-medium">{errorMessage}</p>
            <button
              onClick={() => refetchInventory()}
              className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
            >
              {isRtl ? 'إعادة المحاولة' : 'Retry'}
            </button>
          </div>
        </motion.div>
      )}

      {/* **أدوات التصفية** */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8"
      >
        <div className={`grid grid-cols-1 ${isRtl ? 'lg:grid-cols-4' : 'lg:grid-cols-4'} gap-4 items-end`}>
          {/* **البحث** */}
          <div className="lg:col-span-2">
            <ProductSearchInput
              value={searchInput}
              onChange={handleSearchChange}
              placeholder={t.search}
              ariaLabel={t.search}
            />
          </div>

          {/* **تصفية الحالة** */}
          <ProductDropdown
            value={filterStatus}
            onChange={handleFilterStatusChange}
            options={statusOptions}
            ariaLabel={t.filterByStatus}
            placeholder={t.filterByStatus}
          />

          {/* **تصفية القسم** */}
          <ProductDropdown
            value={filterDepartment}
            onChange={handleFilterDepartmentChange}
            options={departmentOptions}
            ariaLabel={t.filterByDepartment}
            placeholder={t.filterByDepartment}
          />
        </div>

        {/* **إحصائيات العرض** */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-sm text-gray-600">
          <span>
            {filteredInventory.length} {t.items} {isRtl ? 'مُعروضة من أصل' : 'displayed of'} {inventoryWithProductionStatus.length}
          </span>
          {filteredInventory.length > 0 && (
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
              {isRtl ? `الصفحة ${currentPage} من ${totalInventoryPages}` : `Page ${currentPage} of ${totalInventoryPages}`}
            </span>
          )}
        </div>
      </motion.div>

      {/* **حالة عدم وجود بيانات** */}
      {(!inventoryLoading && paginatedInventory.length === 0) ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100"
        >
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-6" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t.noItems}
          </h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            {isRtl 
              ? 'لم يتم العثور على عناصر في مخزون المصنع. يمكنك إنشاء طلب إنتاج جديد لبدء العمل.'
              : 'No items found in factory inventory. You can create a new production order to get started.'
            }
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleOpenProductionModal()}
            className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            {t.create}
          </motion.button>
        </motion.div>
      ) : (
        /* **شبكة العناصر** */
        <AnimatePresence mode="popLayout">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
            {paginatedInventory.map((item, index) => (
              item.product ? (
                <motion.div
                  key={`${item._id}-${index}`}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  layout
                  className={`
                    group relative p-6 bg-white rounded-2xl shadow-sm hover:shadow-xl border border-gray-100 hover:border-amber-200
                    transition-all duration-300 overflow-hidden
                    ${item.status === InventoryStatus.LOW 
                      ? 'ring-2 ring-red-100 border-red-200' 
                      : item.status === InventoryStatus.FULL 
                      ? 'ring-2 ring-yellow-100 border-yellow-200' 
                      : 'hover:border-amber-300'
                    }
                  `}
                >
                  {/* **مؤشر الحالة** */}
                  <div className={`
                    absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                    ${item.status === InventoryStatus.LOW 
                      ? 'bg-red-500 text-white' 
                      : item.status === InventoryStatus.FULL 
                      ? 'bg-yellow-500 text-white' 
                      : 'bg-green-500 text-white'
                    }
                  `}>
                    {item.status === InventoryStatus.LOW ? '!' : 
                     item.status === InventoryStatus.FULL ? 'F' : '✓'}
                  </div>

                  {/* **حالة الإنتاج** */}
                  {item.inProduction && (
                    <div className="absolute -top-2 -left-2 bg-blue-100 text-blue-800 px-2 py-1 rounded-br-lg text-xs font-medium flex items-center gap-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      {t.inProduction}
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* **اسم المنتج والكود** */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <h3 
                          className="font-bold text-gray-900 text-base leading-tight line-clamp-2 group-hover:text-amber-700 transition-colors"
                          title={item.product.displayName}
                        >
                          {item.product.displayName}
                        </h3>
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-mono rounded">
                          {item.product.code}
                        </span>
                      </div>
                      
                      {/* **القسم** */}
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                        {t.filterByDepartment}: 
                        <span className="font-medium text-gray-700 truncate" title={item.product.department?.displayName}>
                          {item.product.department?.displayName || 'غير محدد'}
                        </span>
                      </div>
                    </div>

                    {/* **بيانات المخزون** */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-right">
                          <span className="text-gray-500">{t.stock}:</span>
                          <div className="font-semibold text-gray-900">
                            {item.currentStock}
                            <span className="text-gray-500 ml-1">{item.product.displayUnit}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-gray-500">{t.minStock}:</span>
                          <div className="font-semibold text-gray-900">{item.minStockLevel}</div>
                        </div>
                      </div>
                      <div className="pt-2">
                        <span className="text-gray-500 text-xs">{t.maxStock}:</span>
                        <div className="font-semibold text-gray-900">{item.maxStockLevel}</div>
                      </div>
                    </div>

                    {/* **الوحدة** */}
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>{t.unit}: {item.product.displayUnit}</span>
                    </div>

                    {/* **حالة المخزون** */}
                    <div className={`
                      px-3 py-1 rounded-full text-sm font-semibold text-center transition-all duration-200
                      ${item.status === InventoryStatus.LOW 
                        ? 'bg-red-50 text-red-700 border border-red-200' 
                        : item.status === InventoryStatus.FULL 
                        ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' 
                        : 'bg-green-50 text-green-700 border border-green-200'
                      }
                    `}>
                      {item.status === InventoryStatus.LOW ? t.lowStock :
                       item.status === InventoryStatus.FULL ? t.full : t.normal}
                    </div>
                  </div>

                  {/* **الأزرار** */}
                  <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end gap-2">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleOpenDetailsModal(item)}
                      className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-xl transition-all duration-200"
                      aria-label={t.viewDetails}
                      title={t.viewDetails}
                    >
                      <Eye className="w-4 h-4" />
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleOpenEditModal(item)}
                      className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-all duration-200"
                      aria-label={t.editStockLimits}
                      title={t.editStockLimits}
                      disabled={['chef'].includes(user?.role || '')}
                    >
                      <Edit className="w-4 h-4" />
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleOpenProductionModal(item)}
                      className="p-3 bg-amber-100 hover:bg-amber-200 text-amber-700 hover:text-amber-800 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
                      aria-label={t.create}
                      title={t.create}
                    >
                      <Plus className="w-4 h-4" />
                    </motion.button>
                  </div>
                </motion.div>
              ) : null
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* **التصفح** */}
      {totalInventoryPages > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-4 px-4 py-6 bg-white rounded-2xl shadow-sm border border-gray-100"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all duration-200 font-medium"
          >
            {isRtl ? 'السابق' : 'Previous'}
          </motion.button>

          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <span>{isRtl ? `الصفحة ${currentPage}` : `Page ${currentPage}`}</span>
            <span className="text-gray-500">/</span>
            <span>{totalInventoryPages}</span>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalInventoryPages}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all duration-200 font-medium"
          >
            {isRtl ? 'التالي' : 'Next'}
          </motion.button>
        </motion.div>
      )}

      {/* **نموذج إنشاء طلب الإنتاج** */}
      <AnimatePresence>
        {isProductionModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-y-auto"
            aria-modal="true"
            role="dialog"
          >
            {/* **الخلفية** */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={handleCloseProductionModal}
            />

            {/* **النموذج** */}
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.95, y: 30, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 30, opacity: 0 }}
                className="w-full max-w-4xl max-h-[95vh] bg-white rounded-3xl shadow-2xl overflow-hidden"
              >
                {/* **رأس النموذج** */}
                <div className="sticky top-0 bg-white border-b border-gray-100 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">{t.create}</h2>
                      <p className="text-gray-600">
                        {productionForm.items.length} {t.items}
                        {isChef && (
                          <>
                            <span className="mx-2">•</span>
                            <span className="text-amber-600">{t.chefSelfAssigned}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={handleCloseProductionModal}
                      className="p-2 hover:bg-gray-100 rounded-xl transition-all duration-200"
                    >
                      <X className="w-6 h-6 text-gray-500" />
                    </motion.button>
                  </div>
                </div>

                {/* **محتوى النموذج** */}
                <div className="p-6 overflow-y-auto max-h-[calc(95vh-8rem)]">
                  {chefsLoading && !isChef ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
                      <span className="ml-3 text-gray-600">{isRtl ? 'جاري تحميل الشيفات...' : 'Loading chefs...'}</span>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* **الملاحظات** */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          {t.notes}
                        </label>
                        <textarea
                          value={productionForm.notes}
                          onChange={(e) => dispatchProductionForm({ 
                            type: 'SET_NOTES', 
                            payload: e.target.value 
                          })}
                          placeholder={t.notesPlaceholder}
                          rows={3}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-200"
                        />
                      </div>

                      {/* **العناصر** */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <label className="block text-sm font-semibold text-gray-700">
                            {t.items} ({productionForm.items.length})
                          </label>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={addItemToForm}
                            className="flex items-center gap-2 px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl transition-all duration-200 font-medium"
                          >
                            <Plus className="w-4 h-4" />
                            {t.addItem}
                          </motion.button>
                        </div>

                        {productionFormErrors.items && (
                          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                            <p className="text-red-700 text-sm">{productionFormErrors.items}</p>
                          </div>
                        )}

                        {/* **قائمة العناصر** */}
                        <AnimatePresence>
                          {productionForm.items.map((item, index) => {
                            const itemDeptId = productDepartmentMap[item.product] || '';
                            const chefOptions = getChefOptions(itemDeptId);
                            const itemErrors = {
                              product: productionErrors[`item_${index}_product`],
                                                            assignedTo: productionErrors[`item_${index}_assignedTo`],
                              quantity: productionErrors[`item_${index}_quantity`],
                            };

                            return (
                              <motion.div
                                key={`${item.product}-${index}`}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3 }}
                                className="group/item relative p-4 bg-gray-50 rounded-2xl border border-gray-200 hover:border-amber-300 transition-all duration-200 mb-3"
                              >
                                {/* **زر الحذف** */}
                                <motion.button
                                  whileHover={{ scale: 1.1, rotate: 90 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => removeItemFromForm(index)}
                                  className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 z-10"
                                  aria-label={t.removeItem}
                                  title={t.removeItem}
                                >
                                  <X className="w-4 h-4" />
                                </motion.button>

                                {/* **أخطاء العنصر** */}
                                {Object.values(itemErrors).some(Boolean) && (
                                  <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg">
                                    <AlertCircle className="w-4 h-4 text-red-500 inline ml-1" />
                                    <span className="text-sm text-red-700">
                                      {Object.values(itemErrors).filter(Boolean).join(', ')}
                                    </span>
                                  </div>
                                )}

                                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
                                  {/* **اختيار المنتج** */}
                                  <div className="lg:col-span-2">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      {t.selectProduct} *
                                    </label>
                                    <ProductDropdown
                                      value={item.product}
                                      onChange={(value) => handleProductChange(index, value)}
                                      options={productOptions}
                                      ariaLabel={`${t.selectProduct} ${index + 1}`}
                                      searchEnabled={true}
                                      disabled={createProductionMutation.isPending}
                                    />
                                    {itemErrors.product && (
                                      <p className="mt-1 text-xs text-red-600">{itemErrors.product}</p>
                                    )}
                                  </div>

                                  {/* **اختيار الشيف** */}
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      {t.selectChef} *
                                    </label>
                                    <ProductDropdown
                                      value={item.assignedTo}
                                      onChange={(value) => handleChefChange(index, value)}
                                      options={chefOptions}
                                      ariaLabel={`${t.selectChef} ${index + 1}`}
                                      searchEnabled={false}
                                      disabled={createProductionMutation.isPending || !item.product}
                                    />
                                    {itemErrors.assignedTo && (
                                      <p className="mt-1 text-xs text-red-600">{itemErrors.assignedTo}</p>
                                    )}
                                  </div>

                                  {/* **الكمية** */}
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      {t.quantity} *
                                    </label>
                                    <QuantityInput
                                      value={item.quantity}
                                      onChange={(value) => updateItemInForm(index, 'quantity', value)}
                                      onIncrement={() => updateItemInForm(index, 'quantity', item.quantity + 1)}
                                      onDecrement={() => updateItemInForm(index, 'quantity', Math.max(1, item.quantity - 1))}
                                    />
                                    {itemErrors.quantity && (
                                      <p className="mt-1 text-xs text-red-600">{itemErrors.quantity}</p>
                                    )}
                                  </div>
                                </div>

                                {/* **معلومات المنتج المختار** */}
                                {item.product && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="mt-3 pt-3 border-t border-gray-200 bg-white rounded-lg p-3"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-gray-600">
                                      <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                          <Package className="w-4 h-4 text-amber-600" />
                                          <span className="font-medium">
                                            {availableProducts.find(p => p.productId === item.product)?.productName || 'غير معروف'}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                          <span>
                                            {availableProducts.find(p => p.productId === item.product)?.departmentName || 'غير محدد'}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span>{item.quantity}</span>
                                        <span className="text-gray-500">
                                          {availableProducts.find(p => p.productId === item.product)?.unit || t.unit}
                                        </span>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>

                        {productionForm.items.length === 0 && (
                          <div className="text-center py-8 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300">
                            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500 mb-4">{isRtl ? 'لا توجد عناصر مضافة' : 'No items added'}</p>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={addItemToForm}
                              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-medium transition-all duration-200"
                            >
                              <Plus className="w-4 h-4 inline mr-2" />
                              {t.addItem}
                            </motion.button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* **أزرار الإجراءات** */}
                <div className="sticky bottom-0 bg-white border-t border-gray-100 p-6">
                  <div className="flex flex-col sm:flex-row gap-3 justify-end items-center">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleCloseProductionModal}
                      disabled={createProductionMutation.isPending}
                      className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all duration-200 flex-1 sm:flex-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t.cancel}
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => createProductionMutation.mutate()}
                      disabled={createProductionMutation.isPending || productionForm.items.length === 0}
                      className="px-8 py-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 disabled:cursor-not-allowed"
                    >
                      {createProductionMutation.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          {t.submitting}
                        </>
                      ) : (
                        <>
                          <Package className="w-4 h-4" />
                          {t.submit}
                        </>
                      )}
                    </motion.button>
                  </div>

                  {productionErrors.form && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                      <p className="text-sm text-red-700">{productionErrors.form}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* **نموذج تعديل حدود المخزون** */}
      <AnimatePresence>
        {isEditModalOpen && selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-y-auto"
            aria-modal="true"
            role="dialog"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={handleCloseEditModal}
            />

            <div className="fixed inset-0 flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.95, y: 30, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 30, opacity: 0 }}
                className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="sticky top-0 bg-white border-b border-gray-100 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{t.editStockLimits}</h2>
                      <p className="text-sm text-gray-600">
                        {selectedItem.product?.displayName}
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={handleCloseEditModal}
                      className="p-2 hover:bg-gray-100 rounded-xl transition-all duration-200"
                    >
                      <X className="w-6 h-6 text-gray-500" />
                    </motion.button>
                  </div>
                </div>

                <div className="p-6">
                  <div className="space-y-6">
                    {/* **الحد الأدنى** */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t.minStock}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editForm.minStockLevel}
                        onChange={(e) => setEditForm(prev => ({
                          ...prev,
                          minStockLevel: parseInt(e.target.value) || 0
                        }))}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-200"
                        disabled={updateInventoryMutation.isPending}
                      />
                      {editErrors.minStockLevel && (
                        <p className="mt-1 text-xs text-red-600">{editErrors.minStockLevel}</p>
                      )}
                    </div>

                    {/* **الحد الأقصى** */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t.maxStock}
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={editForm.maxStockLevel}
                        onChange={(e) => setEditForm(prev => ({
                          ...prev,
                          maxStockLevel: Math.max(prev.minStockLevel + 1, parseInt(e.target.value) || 0)
                        }))}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-200"
                        disabled={updateInventoryMutation.isPending}
                      />
                      {editErrors.maxStockLevel && (
                        <p className="mt-1 text-xs text-red-600">{editErrors.maxStockLevel}</p>
                      )}
                    </div>

                    {/* **معاينة الحالة** */}
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        {isRtl ? 'معاينة الحالة:' : 'Status preview:'}
                      </p>
                      <div className={`
                        px-3 py-2 rounded-full text-sm font-semibold text-center transition-all duration-200 inline-block
                        ${selectedItem.currentStock <= editForm.minStockLevel 
                          ? 'bg-red-50 text-red-700 border border-red-200' 
                          : selectedItem.currentStock >= editForm.maxStockLevel
                          ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' 
                          : 'bg-green-50 text-green-700 border border-green-200'
                        }
                      `}>
                        {selectedItem.currentStock <= editForm.minStockLevel ? t.lowStock :
                         selectedItem.currentStock >= editForm.maxStockLevel ? t.full : t.normal}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-gray-100">
                  <div className="flex gap-3 justify-end">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleCloseEditModal}
                      disabled={updateInventoryMutation.isPending}
                      className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all duration-200 flex-1 sm:flex-none disabled:opacity-50"
                    >
                      {t.cancel}
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => updateInventoryMutation.mutate()}
                      disabled={updateInventoryMutation.isPending}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:cursor-not-allowed"
                    >
                      {updateInventoryMutation.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                          {t.saving}
                        </>
                      ) : (
                        t.save
                      )}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* **نموذج تفاصيل المنتج** */}
      <AnimatePresence>
        {isDetailsModalOpen && selectedProductId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-y-auto"
            aria-modal="true"
            role="dialog"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={handleCloseDetailsModal}
            />

            <div className="fixed inset-0 flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.95, y: 30, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 30, opacity: 0 }}
                className="w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="sticky top-0 bg-white border-b border-gray-100 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">{t.productDetails}</h2>
                      <p className="text-sm text-gray-600">
                        {isRtl ? 'سجل حركة المنتج' : 'Product movement history'}
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={handleCloseDetailsModal}
                      className="p-2 hover:bg-gray-100 rounded-xl transition-all duration-200"
                    >
                      <X className="w-6 h-6 text-gray-500" />
                    </motion.button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  {historyLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mr-3"></div>
                      <span className="text-gray-600">
                        {isRtl ? 'جاري تحميل السجل...' : 'Loading history...'}
                      </span>
                    </div>
                  ) : productHistory.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="w-16 h-16 text-gray-300 mx-auto mb-6" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{t.noHistory}</h3>
                      <p className="text-gray-500 max-w-md mx-auto">
                        {isRtl 
                          ? 'لا يوجد سجل حركة لهذا المنتج حتى الآن'
                          : 'No movement history available for this product yet'
                        }
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* **جدول السجل** */}
                      <div className="overflow-x-auto rounded-2xl border border-gray-200">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className={`px-6 py-4 text-right ${isRtl ? 'text-left' : 'text-right'}`}>
                                {t.date}
                              </th>
                              <th className={`px-6 py-4 text-right ${isRtl ? 'text-left' : 'text-right'}`}>
                                {t.type}
                              </th>
                              <th className={`px-6 py-4 text-right ${isRtl ? 'text-left' : 'text-right'}`}>
                                {t.quantity}
                              </th>
                              <th className={`px-6 py-4 text-right ${isRtl ? 'text-left' : 'text-right'}`}>
                                {t.reference}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {productHistory.map((entry, index) => (
                              <motion.tr
                                key={`${entry._id}-${index}`}
                                initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="hover:bg-gray-50 transition-colors"
                              >
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {new Date(entry.date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`
                                    px-2 py-1 rounded-full text-xs font-medium
                                    ${entry.type === 'produced_stock' 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-blue-100 text-blue-800'
                                    }
                                  `}>
                                    {entry.type === 'produced_stock' ? t.produced_stock : t.adjustment}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  <span className={`
                                    ${entry.quantity > 0 ? 'text-green-600' : 'text-red-600'}
                                  `}>
                                    {entry.quantity > 0 ? `+${entry.quantity}` : entry.quantity}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={entry.reference}>
                                  {entry.reference || '-'}
                                </td>
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* **إحصائيات السجل** */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 rounded-2xl p-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">{productHistory.filter(e => e.quantity > 0).length}</div>
                          <div className="text-sm text-gray-600 mt-1">{isRtl ? 'إنتاجات' : 'Productions'}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {productHistory.reduce((sum, e) => sum + Math.abs(e.quantity), 0)}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">{isRtl ? 'إجمالي الحركة' : 'Total Movement'}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">
                            {productHistory.length}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">{isRtl ? 'إجمالي السجلات' : 'Total Records'}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* **التوثيق للمطورين** */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 bg-black/90 text-white text-xs p-2 rounded-lg backdrop-blur-sm z-40 max-w-sm">
          <details className="cursor-pointer">
            <summary className="font-medium">Factory Inventory Debug</summary>
            <pre className="mt-2 text-xs overflow-auto max-h-40">
              {JSON.stringify({
                inventoryCount: inventoryWithProductionStatus.length,
                filteredCount: filteredInventory.length,
                currentPage,
                totalPages: totalInventoryPages,
                isConnected: socket?.connected,
                userRole: user?.role,
                isChef,
                productionItems: productionForm.items.length,
                availableProducts: availableProducts.length,
                chefsCount: chefsData.length,
              }, null, 2)}
            </pre>
          </details>
        </div>
      )}

      <style jsx>{`
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>
    </div>
  );
};

export default FactoryInventory;