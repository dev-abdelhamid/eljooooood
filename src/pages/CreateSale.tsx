import React, { useState, useEffect, useCallback, useMemo, useReducer } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { inventoryAPI, salesAPI } from '../services/api';
import { AlertCircle, DollarSign, Plus, Minus, Trash2, Package, Search, X, ChevronDown } from 'lucide-react';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';

// TypeScript interfaces
interface InventoryItem {
  _id: string;
  product: {
    _id: string;
    name: string;
    nameEn?: string;
    unit?: string;
    unitEn?: string;
    price: number;
    department?: { _id: string; name: string; nameEn?: string; displayName: string };
  };
  currentStock: number;
  displayName: string;
  displayUnit: string;
}

interface CartItem {
  productId: string;
  productName: string;
  productNameEn?: string;
  unit?: string;
  unitEn?: string;
  displayName: string;
  displayUnit: string;
  quantity: number;
  unitPrice: number;
}

interface Department {
  _id: string;
  name: string;
  nameEn?: string;
  displayName: string;
}

interface CartState {
  items: CartItem[];
  notes: string;
  paymentMethod: string;
  customerName: string;
  customerPhone?: string;
}

const translations = {
  ar: {
    title: 'إنشاء مبيعة جديدة',
    subtitle: 'إضافة مبيعة جديدة أو تعديل مبيعة موجودة',
    availableProducts: 'المنتجات المتاحة',
    noProducts: 'لا توجد منتجات متاحة',
    department: 'القسم',
    allDepartments: 'كل الأقسام',
    availableStock: 'المخزون المتاح',
    unitPrice: 'سعر الوحدة',
    addToCart: 'إضافة إلى السلة',
    cart: 'سلة المبيعات',
    emptyCart: 'السلة فارغة',
    total: 'الإجمالي',
    notes: 'ملاحظات',
    paymentMethod: 'طريقة الدفع',
    customerName: 'اسم العميل',
    customerPhone: 'هاتف العميل',
    submitSale: 'إرسال المبيعة',
    updateSale: 'تحديث المبيعة',
    resetCart: 'إعادة تعيين السلة',
    searchPlaceholder: 'ابحث عن المنتجات...',
    errors: {
      unauthorized_access: 'غير مصرح لك بالوصول',
      no_branch_assigned: 'لم يتم تعيين فرع',
      fetch_inventory: 'خطأ أثناء جلب المخزون',
      fetch_sale: 'خطأ أثناء جلب المبيعة',
      create_sale_failed: 'فشل إنشاء المبيعة',
      update_sale_failed: 'فشل تحديث المبيعة',
      insufficient_stock: 'المخزون غير كافٍ',
      exceeds_max_quantity: 'الكمية تتجاوز الحد الأقصى',
      invalid_quantity: 'الكمية غير صالحة',
      empty_cart: 'السلة فارغة',
      deleted_product: 'منتج محذوف',
      invalid_customer_phone: 'رقم هاتف العميل غير صالح',
      invalid_payment_method: 'طريقة الدفع غير صالحة',
      cors_error: 'فشل الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت أو إعدادات CORS.',
    },
    currency: 'ريال',
    units: { default: 'غير محدد' },
    departments: { unknown: 'غير معروف' },
    paymentMethods: {
      cash: 'نقدي',
      credit_card: 'بطاقة ائتمان',
      bank_transfer: 'تحويل بنكي',
    },
    notifications: {
      saleCreated: 'تم إنشاء بيع جديد: {saleNumber}',
    },
  },
  en: {
    title: 'Create New Sale',
    subtitle: 'Add new sale or edit existing sale',
    availableProducts: 'Available Products',
    noProducts: 'No products available',
    department: 'Department',
    allDepartments: 'All Departments',
    availableStock: 'Available Stock',
    unitPrice: 'Unit Price',
    addToCart: 'Add to Cart',
    cart: 'Sales Cart',
    emptyCart: 'Cart is empty',
    total: 'Total',
    notes: 'Notes',
    paymentMethod: 'Payment Method',
    customerName: 'Customer Name',
    customerPhone: 'Customer Phone',
    submitSale: 'Submit Sale',
    updateSale: 'Update Sale',
    resetCart: 'Reset Cart',
    searchPlaceholder: 'Search products...',
    errors: {
      unauthorized_access: 'You are not authorized to access',
      no_branch_assigned: 'No branch assigned',
      fetch_inventory: 'Error fetching inventory',
      fetch_sale: 'Error fetching sale',
      create_sale_failed: 'Failed to create sale',
      update_sale_failed: 'Failed to update sale',
      insufficient_stock: 'Insufficient stock',
      exceeds_max_quantity: 'Quantity exceeds maximum available',
      invalid_quantity: 'Invalid quantity',
      empty_cart: 'Cart is empty',
      deleted_product: 'Deleted Product',
      invalid_customer_phone: 'Invalid customer phone',
      invalid_payment_method: 'Invalid payment method',
      cors_error: 'Failed to connect to the server. Please check your internet connection or CORS settings.',
    },
    currency: 'SAR',
    units: { default: 'N/A' },
    departments: { unknown: 'Unknown' },
    paymentMethods: {
      cash: 'Cash',
      credit_card: 'Credit Card',
      bank_transfer: 'Bank Transfer',
    },
    notifications: {
      saleCreated: 'New sale created: {saleNumber}',
    },
  },
};

// Cart reducer actions
type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'UPDATE_QUANTITY'; payload: { productId: string; quantity: number } }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'SET_NOTES'; payload: string }
  | { type: 'SET_PAYMENT_METHOD'; payload: string }
  | { type: 'SET_CUSTOMER_NAME'; payload: string }
  | { type: 'SET_CUSTOMER_PHONE'; payload: string | undefined }
  | { type: 'RESET' }
  | { type: 'LOAD_SALE'; payload: CartState }
  | { type: 'UPDATE_DISPLAY'; payload: { productId: string; displayName: string; displayUnit: string } };

const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'ADD_ITEM':
      const existingItem = state.items.find((item) => item.productId === action.payload.productId);
      if (existingItem) {
        return {
          ...state,
          items: state.items.map((item) =>
            item.productId === action.payload.productId
              ? { ...item, quantity: item.quantity + action.payload.quantity }
              : item
          ),
        };
      }
      return { ...state, items: [...state.items, action.payload] };
    case 'UPDATE_QUANTITY':
      return {
        ...state,
        items: state.items
          .map((item) =>
            item.productId === action.payload.productId
              ? { ...item, quantity: action.payload.quantity }
              : item
          )
          .filter((item) => item.quantity > 0),
      };
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter((item) => item.productId !== action.payload) };
    case 'SET_NOTES':
      return { ...state, notes: action.payload };
    case 'SET_PAYMENT_METHOD':
      return { ...state, paymentMethod: action.payload };
    case 'SET_CUSTOMER_NAME':
      return { ...state, customerName: action.payload };
    case 'SET_CUSTOMER_PHONE':
      return { ...state, customerPhone: action.payload };
    case 'RESET':
      return { items: [], notes: '', paymentMethod: 'cash', customerName: '', customerPhone: undefined };
    case 'LOAD_SALE':
      return action.payload;
    case 'UPDATE_DISPLAY':
      return {
        ...state,
        items: state.items.map((item) =>
          item.productId === action.payload.productId
            ? { ...item, displayName: action.payload.displayName, displayUnit: action.payload.displayUnit }
            : item
        ),
      };
    default:
      return state;
  }
};

// Sub-components (unchanged)
const ProductSearchInput = React.memo<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  ariaLabel: string;
}>(({ value, onChange, placeholder, ariaLabel }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="relative group">
      <Search
        className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors group-focus-within:text-amber-500 ${
          value ? 'opacity-0' : 'opacity-100'
        }`}
      />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full ${isRtl ? 'pl-12 pr-4' : 'pr-12 pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm placeholder-gray-400 ${
          isRtl ? 'text-right' : 'text-left'
        }`}
        aria-label={ariaLabel}
      />
      {value && (
        <button
          onClick={() => onChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>)}
          className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-amber-500 transition-colors`}
          aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
});

const ProductDropdown = React.memo<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}>(({ value, onChange, options, ariaLabel, disabled = false, className }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((opt) => opt.value === value) || options[0] || { value: '', label: isRtl ? 'اختر' : 'Select' };
  return (
    <div className={`relative group ${className || ''}`}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 bg-gradient-to-r from-white to-gray-50 shadow-sm hover:shadow-md text-sm text-gray-700 ${
          isRtl ? 'text-right' : 'text-left'
        } flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={ariaLabel}
      >
        <span className="truncate">{selectedOption.label}</span>
        <ChevronDown
          className={`${isOpen ? 'rotate-180' : 'rotate-0'} transition-transform duration-200 w-5 h-5 text-gray-400 group-focus-within:text-amber-500`}
        />
      </button>
      {isOpen && !disabled && (
        <div className="absolute w-full mt-2 bg-white rounded-lg shadow-2xl border border-gray-100 z-20 max-h-60 overflow-y-auto scrollbar-none">
          {options.length > 0 ? (
            options.map((option) => (
              <div
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className="px-4 py-2.5 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-600 cursor-pointer transition-colors duration-200"
              >
                {option.label}
              </div>
            ))
          ) : (
            <div className="px-4 py-2.5 text-sm text-gray-500">{isRtl ? 'لا توجد خيارات متاحة' : 'No options available'}</div>
          )}
        </div>
      )}
    </div>
  );
});

const QuantityInput = React.memo<{
  value: number;
  onChange: (val: string) => void;
  onIncrement: () => void;
  onDecrement: () => void;
}>(({ value, onChange, onIncrement, onDecrement }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onDecrement}
        className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors duration-200 flex items-center justify-center"
        aria-label={isRtl ? 'تقليل الكمية' : 'Decrease quantity'}
      >
        <Minus className="w-4 h-4" />
      </button>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-12 h-8 text-center border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm transition-all duration-200"
        style={{ appearance: 'none' }}
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
});

const ProductCard = React.memo<{
  product: InventoryItem;
  cartItem?: CartItem;
  onAdd: () => void;
  onUpdate: (quantity: number) => void;
  onRemove: () => void;
}>(({ product, cartItem, onAdd, onUpdate, onRemove }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  return (
    <div className="h-[200px] p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-amber-200">
      <div className="space-y-2">
        <h3 className="font-bold text-gray-900 text-base truncate">{product.displayName}</h3>
        <p className="text-sm text-amber-600">{t.department}: {product.product.department?.displayName || t.departments.unknown}</p>
        <p className="text-sm text-gray-600">
          {t.availableStock}: {product.currentStock} {product.displayUnit || t.units.default}
        </p>
        <p className="font-semibold text-gray-900 text-sm">
          {t.unitPrice}: {product.product.price} {t.currency}
        </p>
      </div>
      <div className="mt-4 flex justify-end">
        {cartItem ? (
          <div className="flex items-center gap-2">
            <QuantityInput
              value={cartItem.quantity}
              onChange={(val) => onUpdate(parseInt(val) || 0)}
              onIncrement={() => onUpdate(cartItem.quantity + 1)}
              onDecrement={() => onUpdate(cartItem.quantity - 1)}
            />
            <button
              onClick={onRemove}
              className="w-8 h-8 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors duration-200 flex items-center justify-center"
              aria-label={isRtl ? 'إزالة المنتج' : 'Remove item'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onAdd}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm transition-colors duration-200 flex items-center justify-center gap-2 shadow-sm"
            aria-label={t.addToCart}
            disabled={product.currentStock < 1}
          >
            <Plus className="w-4 h-4" />
            {t.addToCart}
          </button>
        )}
      </div>
    </div>
  );
});

const ProductSkeletonCard = React.memo(() => (
  <div className="h-[200px] p-5 bg-white rounded-xl shadow-sm border border-gray-100">
    <div className="space-y-3 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      <div className="h-3 bg-gray-200 rounded w-1/3"></div>
      <div className="mt-4 flex justify-end">
        <div className="h-8 bg-gray-200 rounded-lg w-24"></div>
      </div>
    </div>
  </div>
));

// Main CreateSale component
const CreateSale: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { id } = useParams<{ id?: string }>();
  const { subscribe, unsubscribe } = useNotifications();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'] || translations.en;

  const [cartState, dispatchCart] = useReducer(cartReducer, {
    items: [],
    notes: '',
    paymentMethod: 'cash',
    customerName: '',
    customerPhone: undefined,
  });
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [processedEventIds, setProcessedEventIds] = useState<string[]>([]);

  // Handle saleCreated notifications
  useEffect(() => {
    if (!subscribe) return;

    const handleSaleCreated = (data: {
      saleId: string;
      saleNumber: string;
      branchId: string;
      branchName: string;
      totalAmount: number;
      createdAt: string;
      eventId: string;
    }) => {
      if (processedEventIds.includes(data.eventId)) return;
      setProcessedEventIds((prev) => [...prev, data.eventId]);

      const message = t.notifications.saleCreated.replace('{saleNumber}', data.saleNumber);
      toast.info(message, {
        position: isRtl ? 'top-right' : 'top-left',
        autoClose: 5000,
      });

      const refreshEvent = new CustomEvent('saleCreated', {
        detail: { saleId: data.saleId, branchId: data.branchId },
      });
      window.dispatchEvent(refreshEvent);
    };

    subscribe('saleCreated', handleSaleCreated);

    return () => {
      unsubscribe('saleCreated', handleSaleCreated);
    };
  }, [subscribe, unsubscribe, t, isRtl, processedEventIds]);

  // Check authorization
  useEffect(() => {
    if (!user?.role || user.role !== 'branch') {
      setError(t.errors.unauthorized_access);
      toast.error(t.errors.unauthorized_access, { position: isRtl ? 'top-right' : 'top-left' });
    }
  }, [user, t, isRtl]);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((value: string) => setSearchTerm(value.trim()), 300),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSearch(value);
  };

  // Filter inventory
  const filteredInventory = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return inventory.filter((item) => {
      const matchesSearch = item.displayName.toLowerCase().includes(lowerSearchTerm);
      const matchesDepartment = !selectedDepartment || item.product.department?._id === selectedDepartment;
      return matchesSearch && matchesDepartment;
    });
  }, [inventory, searchTerm, selectedDepartment]);

  // Fetch inventory
  const fetchInventory = useCallback(async () => {
    if (!user?.branchId) {
      setError(t.errors.no_branch_assigned);
      toast.error(t.errors.no_branch_assigned, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }

    setLoading(true);

    try {
      const inventoryParams: any = { lowStock: false, branch: user.branchId };
      const inventoryResponse = await inventoryAPI.getInventory(inventoryParams).catch((err) => {
        console.error(`[${new Date().toISOString()}] Inventory fetch error:`, err);
        toast.error(t.errors.fetch_inventory, { position: isRtl ? 'top-right' : 'top-left' });
        return [];
      });

      const newInventory = Array.isArray(inventoryResponse)
        ? inventoryResponse
            .filter((item: any) => item.currentStock > 0 && item.product?._id)
            .map((item: any) => ({
              _id: item._id,
              product: {
                _id: item.product?._id || 'unknown',
                name: item.product?.name || t.departments.unknown,
                nameEn: item.product?.nameEn,
                unit: item.product?.unit,
                unitEn: item.product?.unitEn,
                price: item.product?.price || 0,
                department: item.product?.department
                  ? {
                      _id: item.product.department._id || 'unknown',
                      name: item.product.department.name || t.departments.unknown,
                      nameEn: item.product.department.nameEn,
                      displayName: isRtl
                        ? item.product.department.name || t.departments.unknown
                        : item.product.department.nameEn || item.product.department.name || t.departments.unknown,
                    }
                  : undefined,
              },
              currentStock: item.currentStock || 0,
              displayName: isRtl
                ? item.product?.name || t.departments.unknown
                : item.product?.nameEn || item.product?.name || t.departments.unknown,
              displayUnit: isRtl
                ? item.product?.unit || t.units.default
                : item.product?.unitEn || item.product?.unit || t.units.default,
            }))
        : [];

      setInventory(newInventory);

      const uniqueDepartments = Array.from(
        new Map(
          newInventory
            .filter((item: InventoryItem) => item.product.department)
            .map((item: InventoryItem) => [
              item.product.department!._id,
              {
                _id: item.product.department!._id,
                name: item.product.department!.name,
                nameEn: item.product.department!.nameEn,
                displayName: isRtl
                  ? item.product.department!.name || t.departments.unknown
                  : item.product.department!.nameEn || item.product.department!.name || t.departments.unknown,
              },
            ])
        ).values()
      );
      setDepartments(uniqueDepartments);

      if (newInventory.length === 0) {
        setError(t.noProducts);
        toast.warn(t.noProducts, { position: isRtl ? 'top-right' : 'top-left' });
      } else {
        setError('');
      }
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Fetch error:`, err);
      const errorMessage =
        err.response?.status === 403
          ? t.errors.unauthorized_access
          : err.message.includes('CORS')
          ? t.errors.cors_error
          : t.errors.fetch_inventory;
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
      setInventory([]);
    } finally {
      setLoading(false);
    }
  }, [user, t, isRtl]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Fetch sale data for editing
  useEffect(() => {
    if (id) {
      const fetchSale = async () => {
        try {
          const sale = await salesAPI.getById(id);
          dispatchCart({
            type: 'LOAD_SALE',
            payload: {
              items: sale.items.map((item: any) => ({
                productId: item.productId || item.product?._id,
                productName: item.product?.name || item.productName,
                productNameEn: item.product?.nameEn || item.productNameEn,
                unit: item.product?.unit || item.unit,
                unitEn: item.product?.unitEn || item.unitEn,
                displayName: isRtl
                  ? item.product?.name || item.productName || t.errors.deleted_product
                  : item.product?.nameEn || item.product?.name || item.productName || t.errors.deleted_product,
                displayUnit: isRtl
                  ? item.product?.unit || item.unit || t.units.default
                  : item.product?.unitEn || item.product?.unit || item.unitEn || item.unit || t.units.default,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
              })),
              notes: sale.notes || '',
              paymentMethod: sale.paymentMethod || 'cash',
              customerName: sale.customerName || '',
              customerPhone: sale.customerPhone || undefined,
            },
          });
        } catch (err: any) {
          console.error(`[${new Date().toISOString()}] Fetch sale error:`, err);
          const errorMessage = err.message.includes('CORS') ? t.errors.cors_error : t.errors.fetch_sale;
          toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
        }
      };
      fetchSale();
    }
  }, [id, t, isRtl]);

  // Update cart items' display on language change
  useEffect(() => {
    cartState.items.forEach((item) => {
      const newDisplayName = isRtl
        ? item.productName || t.errors.deleted_product
        : item.productNameEn || item.productName || t.errors.deleted_product;
      const newDisplayUnit = isRtl
        ? item.unit || t.units.default
        : item.unitEn || item.unit || t.units.default;
      if (item.displayName !== newDisplayName || item.displayUnit !== newDisplayUnit) {
        dispatchCart({
          type: 'UPDATE_DISPLAY',
          payload: {
            productId: item.productId,
            displayName: newDisplayName,
            displayUnit: newDisplayUnit,
          },
        });
      }
    });
  }, [language, cartState.items, isRtl, t]);

  // Add to cart
  const addToCart = useCallback(
    (product: InventoryItem) => {
      if (product.currentStock < 1) {
        toast.error(t.errors.insufficient_stock, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      const existingItem = cartState.items.find((item) => item.productId === product.product._id);
      if (existingItem && existingItem.quantity >= product.currentStock) {
        toast.error(t.errors.exceeds_max_quantity, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      dispatchCart({
        type: 'ADD_ITEM',
        payload: {
          productId: product.product._id,
          productName: product.product.name,
          productNameEn: product.product.nameEn,
          unit: product.product.unit,
          unitEn: product.product.unitEn,
          displayName: product.displayName,
          displayUnit: product.displayUnit,
          quantity: existingItem ? existingItem.quantity + 1 : 1,
          unitPrice: product.product.price,
        },
      });
    },
    [t, isRtl, cartState.items]
  );

  // Update cart quantity
  const updateCartQuantity = useCallback(
    (productId: string, quantity: number) => {
      const product = inventory.find((item) => item.product._id === productId);
      if (!product) {
        toast.error(t.errors.deleted_product, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      if (quantity > product.currentStock) {
        toast.error(t.errors.exceeds_max_quantity, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      if (quantity <= 0) {
        dispatchCart({ type: 'REMOVE_ITEM', payload: productId });
        return;
      }
      dispatchCart({
        type: 'UPDATE_QUANTITY',
        payload: { productId, quantity },
      });
    },
    [inventory, t, isRtl]
  );

  // Remove from cart
  const removeFromCart = useCallback((productId: string) => {
    dispatchCart({ type: 'REMOVE_ITEM', payload: productId });
  }, []);

  // Reset cart
  const handleResetCart = useCallback(() => {
    dispatchCart({ type: 'RESET' });
    toast.info(isRtl ? 'تم إعادة تعيين السلة' : 'Cart has been reset', {
      position: isRtl ? 'top-right' : 'top-left',
    });
  }, [isRtl]);

  // Submit or update sale
  const handleSubmitSale = useCallback(async () => {
    if (cartState.items.length === 0) {
      toast.error(t.errors.empty_cart, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    if (cartState.customerPhone && !/^\+?\d{9,15}$/.test(cartState.customerPhone)) {
      toast.error(t.errors.invalid_customer_phone, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    if (!['cash', 'credit_card', 'bank_transfer'].includes(cartState.paymentMethod)) {
      toast.error(t.errors.invalid_payment_method, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }

    const saleData = {
      branch: user?.branchId,
      items: cartState.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      notes: cartState.notes.trim() || undefined,
      paymentMethod: cartState.paymentMethod,
      customerName: cartState.customerName.trim() || undefined,
      customerPhone: cartState.customerPhone?.trim() || undefined,
      lang: language,
    };

    setSubmitting(true);
    try {
      if (id) {
        await salesAPI.update(id, saleData);
        toast.success(t.updateSale, { position: isRtl ? 'top-right' : 'top-left' });
      } else {
        const response = await salesAPI.create(saleData);
        toast.success(t.submitSale, { position: isRtl ? 'top-right' : 'top-left' });
        dispatchCart({ type: 'RESET' });
      }
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Sale ${id ? 'update' : 'submission'} error:`, err);
      const errorMessage =
        err.message.includes('CORS')
          ? t.errors.cors_error
          : err.message.includes('insufficient_stock')
          ? t.errors.insufficient_stock
          : id
          ? t.errors.update_sale_failed
          : t.errors.create_sale_failed;
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setSubmitting(false);
    }
  }, [cartState, user, t, isRtl, id, language]);

  // Department options
  const departmentOptions = useMemo(
    () => [
      { value: '', label: t.allDepartments },
      ...departments.map((dept) => ({ value: dept._id, label: dept.displayName })),
    ],
    [departments, t]
  );

  // Payment method options
  const paymentMethodOptions = useMemo(
    () => [
      { value: 'cash', label: t.paymentMethods.cash },
      { value: 'credit_card', label: t.paymentMethods.credit_card },
      { value: 'bank_transfer', label: t.paymentMethods.bank_transfer },
    ],
    [t.paymentMethods]
  );

  // Total cart amount
  const totalCartAmount = useMemo(() => {
    return cartState.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toFixed(2);
  }, [cartState.items]);

  return (
    <div className={`mx-auto px-4 py-8 min-h-screen ${isRtl ? 'font-arabic' : 'font-sans'}`}>
      <header className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center gap-3">
          <DollarSign className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
            <p className="text-gray-600 text-sm">{t.subtitle}</p>
          </div>
        </div>
      </header>
      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm font-medium">{error}</span>
        </div>
      )}
      <div className={`space-y-8 ${cartState.items.length > 0 ? 'lg:grid lg:grid-cols-3 lg:gap-8 lg:space-y-0' : ''}`}>
        <section className={`${cartState.items.length > 0 ? 'lg:col-span-2 lg:overflow-y-auto lg:max-h-[calc(100vh-12rem)] scrollbar-none' : ''}`}>
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-6">{t.availableProducts}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <ProductSearchInput
                value={searchInput}
                onChange={handleSearchChange}
                placeholder={t.searchPlaceholder}
                ariaLabel={t.searchPlaceholder}
              />
              <ProductDropdown
                value={selectedDepartment}
                onChange={setSelectedDepartment}
                options={departmentOptions}
                ariaLabel={t.department}
              />
            </div>
            <div className="mt-4 text-center text-sm text-gray-600 font-medium">
              {isRtl ? `عدد المنتجات: ${filteredInventory.length}` : `Products Count: ${filteredInventory.length}`}
            </div>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
              {[...Array(6)].map((_, index) => (
                <ProductSkeletonCard key={index} />
              ))}
            </div>
          ) : filteredInventory.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-sm font-medium">{t.noProducts}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
              {filteredInventory.map((product) => (
                <ProductCard
                  key={product._id}
                  product={product}
                  cartItem={cartState.items.find((item) => item.productId === product.product._id)}
                  onAdd={() => addToCart(product)}
                  onUpdate={(quantity) => updateCartQuantity(product.product._id, quantity)}
                  onRemove={() => removeFromCart(product.product._id)}
                />
              ))}
            </div>
          )}
        </section>
        {cartState.items.length > 0 && (
          <aside className="lg:col-span-1 lg:sticky lg:top-8 space-y-6 max-h-[calc(100vh-12rem)] overflow-y-auto scrollbar-none">
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-6">{t.cart}</h3>
              <div className="space-y-4">
                {cartState.items.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-sm">{item.displayName || t.errors.deleted_product}</p>
                      <p className="text-sm text-gray-600">
                        {item.quantity} × {item.unitPrice} {t.currency}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <QuantityInput
                        value={item.quantity}
                        onChange={(val) => updateCartQuantity(item.productId, parseInt(val) || 0)}
                        onIncrement={() => updateCartQuantity(item.productId, item.quantity + 1)}
                        onDecrement={() => updateCartQuantity(item.productId, item.quantity - 1)}
                      />
                      <button
                        onClick={() => removeFromCart(item.productId)}
                        className="w-8 h-8 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors duration-200 flex items-center justify-center"
                        aria-label={isRtl ? 'إزالة المنتج' : 'Remove item'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="border-t pt-4">
                  <div className="flex justify-between font-bold text-gray-900 text-sm">
                    <span>{t.total}:</span>
                    <span className="text-amber-600">
                      {totalCartAmount} {t.currency}
                    </span>
                  </div>
                </div>
                <div className="mt-4 space-y-4">
                  <input
                    type="text"
                    value={cartState.customerName}
                    onChange={(e) => dispatchCart({ type: 'SET_CUSTOMER_NAME', payload: e.target.value })}
                    placeholder={t.customerName}
                    className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${
                      isRtl ? 'text-right' : 'text-left'
                    }`}
                    aria-label={t.customerName}
                  />
                  <input
                    type="text"
                    value={cartState.customerPhone || ''}
                    onChange={(e) => dispatchCart({ type: 'SET_CUSTOMER_PHONE', payload: e.target.value })}
                    placeholder={t.customerPhone}
                    className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${
                      isRtl ? 'text-right' : 'text-left'
                    }`}
                    aria-label={t.customerPhone}
                  />
                  <ProductDropdown
                    value={cartState.paymentMethod}
                    onChange={(value) => dispatchCart({ type: 'SET_PAYMENT_METHOD', payload: value })}
                    options={paymentMethodOptions}
                    ariaLabel={t.paymentMethod}
                  />
                  <textarea
                    value={cartState.notes}
                    onChange={(e) => dispatchCart({ type: 'SET_NOTES', payload: e.target.value })}
                    placeholder={t.notes}
                    className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm resize-none h-24 ${
                      isRtl ? 'text-right' : 'text-left'
                    }`}
                    aria-label={t.notes}
                  />
                </div>
                <div className="flex gap-4 mt-4">
                  <button
                    onClick={handleResetCart}
                    className="flex-1 px-6 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors duration-200"
                    aria-label={t.resetCart}
                  >
                    {t.resetCart}
                  </button>
                  <button
                    onClick={handleSubmitSale}
                    className="flex-1 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={cartState.items.length === 0 || submitting}
                    aria-label={id ? t.updateSale : t.submitSale}
                  >
                    {submitting ? (isRtl ? 'جارٍ الإرسال...' : 'Submitting...') : id ? t.updateSale : t.submitSale}
                  </button>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default React.memo(CreateSale);