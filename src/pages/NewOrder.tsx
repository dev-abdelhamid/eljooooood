import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotifications } from '../contexts/NotificationContext';
import { productsAPI, ordersAPI, branchesAPI, departmentAPI } from '../services/api';
import { ShoppingCart, Plus, Minus, Trash2, Package, AlertCircle, Search, X, ChevronDown } from 'lucide-react';
import { io } from 'socket.io-client';
import { debounce } from 'lodash';
import { toast } from 'react-toastify';

interface Product {
  _id: string;
  name: string;
  nameEn?: string;
  code: string;
  price: number;
  unit?: string;
  unitEn?: string;
  department: { _id: string; name: string; nameEn?: string; displayName: string };
  displayName: string;
  displayUnit: string;
}

interface OrderItem {
  productId: string;
  product: Product;
  quantity: number;
  price: number;
}

interface Branch {
  _id: string;
  name: string;
  nameEn?: string;
  displayName: string;
}

interface Department {
  _id: string;
  name: string;
  nameEn?: string;
  displayName: string;
}

interface Translations {
  ar: {
    createOrder: string;
    addProducts: string;
    noProducts: string;
    noMatch: string;
    empty: string;
    searchPlaceholder: string;
    code: string;
    department: string;
    price: string;
    unit: string;
    addToCart: string;
    branch: string;
    branchPlaceholder: string;
    branchRequired: string;
    clearOrder: string;
    submitOrder: string;
    submitting: string;
    orderSummary: string;
    finalTotal: string;
    confirmOrder: string;
    confirmMessage: string;
    cancel: string;
    confirm: string;
    unauthorized: string;
    fetchError: string;
    createError: string;
    cartEmpty: string;
    orderCreated: string;
    orderCleared: string;
    scrollToSummary: string;
    currency: string;
    invalidQuantity: string;
  };
  en: {
    createOrder: string;
    addProducts: string;
    noProducts: string;
    noMatch: string;
    empty: string;
    searchPlaceholder: string;
    code: string;
    department: string;
    price: string;
    unit: string;
    addToCart: string;
    branch: string;
    branchPlaceholder: string;
    branchRequired: string;
    clearOrder: string;
    submitOrder: string;
    submitting: string;
    orderSummary: string;
    finalTotal: string;
    confirmOrder: string;
    confirmMessage: string;
    cancel: string;
    confirm: string;
    unauthorized: string;
    fetchError: string;
    createError: string;
    cartEmpty: string;
    orderCreated: string;
    orderCleared: string;
    scrollToSummary: string;
    currency: string;
    invalidQuantity: string;
  };
}

const translations: Translations = {
  ar: {
    createOrder: 'إنشاء طلب جديد',
    addProducts: 'قم بإضافة المنتجات وتأكيد الطلب لإرساله',
    noProducts: 'لا توجد منتجات',
    noMatch: 'لا توجد منتجات مطابقة',
    empty: 'لا توجد منتجات متاحة',
    searchPlaceholder: 'ابحث عن المنتجات...',
    code: 'الكود',
    department: 'القسم',
    price: 'السعر',
    unit: 'الوحدة',
    addToCart: 'إضافة إلى السلة',
    branch: 'الفرع',
    branchPlaceholder: 'اختر الفرع',
    branchRequired: 'الفرع مطلوب',
    clearOrder: 'مسح الطلب',
    submitOrder: 'إرسال الطلب',
    submitting: 'جاري الإرسال...',
    orderSummary: 'ملخص الطلب',
    finalTotal: 'الإجمالي النهائي',
    confirmOrder: 'تأكيد الطلب',
    confirmMessage: 'هل أنت متأكد من إرسال الطلب؟',
    cancel: 'إلغاء',
    confirm: 'تأكيد',
    unauthorized: 'غير مصرح لك بالوصول',
    fetchError: 'خطأ أثناء جلب البيانات',
    createError: 'خطأ في إنشاء الطلب',
    cartEmpty: 'السلة فارغة',
    orderCreated: 'تم إنشاء الطلب بنجاح',
    orderCleared: 'تم مسح الطلب',
    scrollToSummary: 'التمرير للملخص',
    currency: 'ريال',
    invalidQuantity: 'الكمية غير صحيحة. للكيلو: 0.25، 0.5، 0.75، 1.0، 1.25، 1.4، 1.7... | لغير الكيلو: عدد صحيح',
  },
  en: {
    createOrder: 'Create New Order',
    addProducts: 'Add products and confirm to submit your order',
    noProducts: 'No Products Found',
    noMatch: 'No Matching Products',
    empty: 'No Products Available',
    searchPlaceholder: 'Search products...',
    code: 'Code',
    department: 'Department',
    price: 'Price',
    unit: 'Unit',
    addToCart: 'Add to Cart',
    branch: 'Branch',
    branchPlaceholder: 'Select Branch',
    branchRequired: 'Branch is required',
    clearOrder: 'Clear Order',
    submitOrder: 'Submit Order',
    submitting: 'Submitting...',
    orderSummary: 'Order Summary',
    finalTotal: 'Final Total',
    confirmOrder: 'Confirm Order',
    confirmMessage: 'Are you sure you want to submit the order?',
    cancel: 'Cancel',
    confirm: 'Confirm',
    unauthorized: 'You are not authorized to access',
    fetchError: 'Error fetching data',
    createError: 'Error creating order',
    cartEmpty: 'Cart is empty',
    orderCreated: 'Order created successfully',
    orderCleared: 'Order cleared',
    scrollToSummary: 'Scroll to Summary',
    currency: 'SAR',
    invalidQuantity: 'Invalid quantity. For kg: 0.25, 0.5, 0.75, 1.0, 1.25, 1.4, 1.7... | For others: integer only',
  },
};

// === دالة التحقق من الكمية (تسمح بـ 0.25، 1.25، 1.4، 1.7...) ===
const isValidKgQuantity = (qty: number): boolean => {
  if (qty <= 0) return false;
  const multiplied = Math.round(qty * 100);
  return multiplied % 25 === 0;
};

const isValidQuantity = (quantity: number, unit: string): boolean => {
  const kgUnits = ['كيلو', 'Kilo', 'كجم', 'kg'];
  if (kgUnits.includes(unit)) {
    return isValidKgQuantity(quantity);
  }
  return Number.isInteger(quantity) && quantity >= 1;
};

// === مكون إدخال الكمية ===
const QuantityInput = ({
  value,
  onChange,
  onIncrement,
  onDecrement,
  unit,
}: {
  value: number;
  onChange: (val: number) => void;
  onIncrement: () => void;
  onDecrement: () => void;
  unit: string;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [inputValue, setInputValue] = useState<string>(value > 0 ? value.toString() : '');
  const kgUnits = ['كيلو', 'Kilo', 'كجم', 'kg'];
  const isKg = kgUnits.includes(unit);

  const validateAndSet = (val: string) => {
    const cleanVal = val.replace(',', '.').trim();
    const num = parseFloat(cleanVal);

    if (val === '' || isNaN(num)) {
      setInputValue('');
      onChange(0);
      return;
    }

    if (num <= 0) {
      toast.error(isRtl ? 'الكمية يجب أن تكون أكبر من 0' : 'Quantity must be > 0');
      setInputValue(value > 0 ? value.toString() : '');
      return;
    }

    if (isKg && !isValidKgQuantity(num)) {
      toast.error(isRtl ? 'للكيلو: يجب أن تكون مضاعفات 0.25 (مثل 1.25، 1.4، 1.7)' : 'For kg: must be 0.25 increments');
      setInputValue(value > 0 ? value.toString() : '');
      return;
    }

    if (!isKg && !Number.isInteger(num)) {
      toast.error(isRtl ? 'الكمية يجب أن تكون عددًا صحيحًا' : 'Quantity must be an integer');
      setInputValue(value > 0 ? value.toString() : '');
      return;
    }

    setInputValue(num.toString());
    onChange(num);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleBlur = () => validateAndSet(inputValue);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') validateAndSet(inputValue);
  };

  useEffect(() => {
    setInputValue(value > 0 ? value.toString() : '');
  }, [value]);

  const step = isKg ? 0.25 : 1;
  const min = isKg ? 0.25 : 1;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onDecrement}
        disabled={value <= min}
        className="w-8 h-8 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 rounded-full flex items-center justify-center transition-colors"
      >
        <Minus className="w-4 h-4" />
      </button>
      <input
        type="text"
        inputMode="decimal"
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-20 h-8 text-center border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 bg-white"
        placeholder={min.toString()}
      />
      <button
        onClick={onIncrement}
        className="w-8 h-8 bg-amber-600 hover:bg-amber-700 rounded-full flex items-center justify-center text-white transition-colors"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
};

export const ProductSearchInput = ({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  ariaLabel: string;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="relative group">
      <div className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors group-focus-within:text-amber-500 ${value ? 'opacity-0' : 'opacity-100'}`}>
        <Search className="w-4 h-4" />
      </div>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full ${isRtl ? 'pl-12 pr-4' : 'pr-12 pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white text-sm ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={ariaLabel}
      />
      {value && (
        <button
          onClick={() => onChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>)}
          className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-amber-500`}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export const ProductDropdown = ({
  value,
  onChange,
  options,
  ariaLabel,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
  disabled?: boolean;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find(o => o.value === value) || options[0];

  return (
    <div className="relative group">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white text-sm flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={ariaLabel}
      >
        <span className="truncate">{selected.label}</span>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && !disabled && (
        <div className="absolute w-full mt-2 bg-white rounded-lg shadow-lg border border-gray-100 z-20 max-h-60 overflow-y-auto">
          {options.map(option => (
            <div
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className="px-4 py-2.5 text-sm hover:bg-amber-50 cursor-pointer"
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ProductCard = ({
  product,
  cartItem,
  onAdd,
  onUpdate,
  translations,
}: {
  product: Product;
  cartItem?: OrderItem;
  onAdd: () => void;
  onUpdate: (quantity: number) => void;
  translations: Translations;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const kgUnits = ['كيلو', 'Kilo', 'كجم', 'kg'];
  const isKg = kgUnits.includes(product.displayUnit);
  const step = isKg ? 0.25 : 1;

  return (
    <div className="p-5 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="space-y-2">
        <div className="flex justify-between">
          <h3 className="font-bold text-gray-900 truncate">{product.displayName}</h3>
          <span className="text-sm text-gray-500">{product.code}</span>
        </div>
        <p className="text-sm text-amber-600">{t.department}: {product.department.displayName}</p>
        <p className="font-semibold text-sm">{product.price} {t.currency} / {product.displayUnit}</p>
      </div>
      <div className="mt-4 flex justify-end">
        {cartItem ? (
          <QuantityInput
            value={cartItem.quantity}
            onChange={onUpdate}
            onIncrement={() => onUpdate(cartItem.quantity + step)}
            onDecrement={() => onUpdate(Math.max(step, cartItem.quantity - step))}
            unit={product.displayUnit}
          />
        ) : (
          <button
            onClick={onAdd}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t.addToCart}
          </button>
        )}
      </div>
    </div>
  );
};

const ProductSkeletonCard = () => (
  <div className="p-5 bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse">
    <div className="space-y-3">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      <div className="h-3 bg-gray-200 rounded w-1/3"></div>
      <div className="mt-4 h-8 bg-gray-200 rounded-lg w-24"></div>
    </div>
  </div>
);

const OrderConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  submitting,
  t,
  isRtl,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  submitting: boolean;
  t: any;
  isRtl: boolean;
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h3 className="text-xl font-bold mb-4">{t.confirmOrder}</h3>
        <p className="text-sm text-gray-600 mb-6">{t.confirmMessage}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm">
            {t.cancel}
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm disabled:opacity-50"
          >
            {submitting ? t.submitting : t.confirm}
          </button>
        </div>
      </div>
    </div>
  );
};

// === المكون الرئيسي ===
export function NewOrder() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { addNotification } = useNotifications();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const summaryRef = useRef<HTMLDivElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [branch, setBranch] = useState<string>(user?.branchId?.toString() || '');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const socket = useMemo(() => io('https://eljoodia-server-production.up.railway.app'), []);

  const debouncedSearch = useCallback(debounce((value: string) => setSearchTerm(value.trim()), 500), []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    if (value.length >= 2 || value === '') debouncedSearch(value);
  };

  const filteredProducts = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    const seen = new Set<string>();
    return products
      .filter(p => {
        if (seen.has(p._id)) return false;
        seen.add(p._id);
        const name = p.displayName.toLowerCase();
        const code = p.code.toLowerCase();
        return (
          (!filterDepartment || p.department._id === filterDepartment) &&
          (name.startsWith(lower) || code.startsWith(lower) || name.includes(lower))
        );
      })
      .sort((a, b) => {
        const aName = a.displayName.toLowerCase();
        const bName = b.displayName.toLowerCase();
        if (aName.startsWith(lower) && !bName.startsWith(lower)) return -1;
        if (!aName.startsWith(lower) && bName.startsWith(lower)) return 1;
        return aName.localeCompare(bName);
      });
  }, [products, searchTerm, filterDepartment]);

  const skeletonCount = filteredProducts.length > 0 ? filteredProducts.length : 6;

  useEffect(() => {
    if (!user || !['admin', 'branch'].includes(user.role)) {
      setError(t.unauthorized);
      toast.error(t.unauthorized);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        const [prodRes, branchRes, deptRes] = await Promise.all([
          productsAPI.getAll({ department: filterDepartment, search: searchTerm, limit: 0 }),
          branchesAPI.getAll(),
          departmentAPI.getAll({ limit: 100 }),
        ]);

        const prods = (prodRes.data || []).map((p: any) => ({
          ...p,
          displayName: isRtl ? p.name : (p.nameEn || p.name),
          displayUnit: isRtl ? (p.unit || 'غير محدد') : (p.unitEn || p.unit || 'N/A'),
          department: {
            ...p.department,
            displayName: isRtl ? p.department.name : (p.nameEn || p.department.name),
          },
        }));
        setProducts(prods);

        setBranches((branchRes || []).map((b: any) => ({
          ...b,
          displayName: isRtl ? b.name : (b.nameEn || b.name),
        })));

        setDepartments((deptRes.data || []).map((d: any) => ({
          ...d,
          displayName: isRtl ? d.name : (d.nameEn || d.name),
        })));

        if (user.role === 'branch' && user.branchId) {
          setBranch(user.branchId.toString());
        }
      } catch (err: any) {
        setError(err.message || t.fetchError);
        toast.error(err.message || t.fetchError);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, isRtl, filterDepartment, searchTerm, t]);

  useEffect(() => {
    setProducts(prev => prev.map(p => ({
      ...p,
      displayName: isRtl ? p.name : (p.nameEn || p.name),
      displayUnit: isRtl ? (p.unit || 'غير محدد') : (p.unitEn || p.unit || 'N/A'),
      department: { ...p.department, displayName: isRtl ? p.department.name : (p.department.nameEn || p.department.name) },
    })));
    setOrderItems(prev => prev.map(item => ({
      ...item,
      product: {
        ...item.product,
        displayName: isRtl ? item.product.name : (item.product.nameEn || item.product.name),
        displayUnit: isRtl ? (item.product.unit || 'غير محدد') : (item.product.unitEn || item.product.unit || 'N/A'),
        department: { ...item.product.department, displayName: isRtl ? item.product.department.name : (item.product.department.nameEn || item.product.department.name) },
      },
    })));
  }, [isRtl]);

  useEffect(() => {
    if (!user || !socket) return;

    socket.on('connect', () => {
      if (user.role === 'branch' && user.branchId) {
        socket.emit('joinRoom', `branch-${user.branchId}`);
      } else if (['admin', 'production'].includes(user.role)) {
        socket.emit('joinRoom', user.role);
      }
    });

    socket.on('orderCreated', (data) => {
      if (!data?._id) return;
      const msg = user.role === 'branch' ? t.orderCreated : `طلب جديد: #${data.orderNumber}`;
    
    });

    return () => { socket.disconnect(); };
  }, [socket, user, addNotification, t]);

  const addToOrder = useCallback((product: Product) => {
    setOrderItems(prev => {
      const existing = prev.find(i => i.productId === product._id);
      const isKg = ['كيلو', 'Kilo', 'كجم', 'kg'].includes(product.displayUnit);
      const step = isKg ? 0.25 : 1;
      const qty = existing ? existing.quantity + step : step;

      if (!isValidQuantity(qty, product.displayUnit)) {
        toast.error(t.invalidQuantity);
        return prev;
      }

      if (existing) {
        return prev.map(i => i.productId === product._id ? { ...i, quantity: qty } : i);
      }

      return [...prev, { productId: product._id, product, quantity: step, price: product.price }];
    });
  }, [t]);

  const updateQuantity = useCallback((id: string, qty: number) => {
    const item = orderItems.find(i => i.productId === id);
    if (!item) return;
    const min = ['كيلو', 'Kilo', 'كجم', 'kg'].includes(item.product.displayUnit) ? 0.25 : 1;
    if (qty < min) {
      setOrderItems(prev => prev.filter(i => i.productId !== id));
      return;
    }
    if (!isValidQuantity(qty, item.product.displayUnit)) {
      toast.error(t.invalidQuantity);
      return;
    }
    setOrderItems(prev => prev.map(i => i.productId === id ? { ...i, quantity: qty } : i));
  }, [orderItems, t]);

  const removeFromOrder = useCallback((id: string) => {
    setOrderItems(prev => prev.filter(i => i.productId !== id));
  }, []);

  const clearOrder = useCallback(() => {
    setOrderItems([]);
    if (user?.role === 'admin') setBranch('');
    setSearchInput(''); setSearchTerm(''); setFilterDepartment('');
  }, [user, t]);

  const total = useMemo(() => orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0).toFixed(2), [orderItems]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderItems.length === 0) return toast.error(t.cartEmpty);
    if (user?.role === 'admin' && !branch) return toast.error(t.branchRequired);
    setShowConfirmModal(true);
  };

  const confirmOrder = async () => {
    setSubmitting(true);
    try {
      const eventId = crypto.randomUUID();
      const branchId = user?.role === 'branch' ? user.branchId : branch;
      const branchData = branches.find(b => b._id === branchId);

      const orderData = {
        orderNumber: `ORD-${Date.now()}`,
        branchId,
        items: orderItems.map(i => ({
          product: i.productId,
          quantity: i.quantity,
          price: i.price,
          productName: i.product.name,
          productNameEn: i.product.nameEn,
          unit: i.product.unit || 'غير محدد',
          unitEn: i.product.unitEn || 'N/A',
          department: i.product.department,
        })),
        status: 'pending',
        priority: 'medium',
        createdBy: user?.id || user?._id,
        isRtl,
        eventId,
      };

      const res = await ordersAPI.create(orderData, isRtl);
      socket.emit('orderCreated', {
        _id: res.data.id,
        orderNumber: res.data.orderNumber,
        branch: branchData || { name: 'غير معروف', nameEn: 'Unknown' },
        eventId,
        isRtl,
      });

      addNotification({ _id: eventId, type: 'success', message: t.orderCreated, data: { orderId: res.data.id }, read: false, createdAt: new Date().toISOString() });
      clearOrder();
      setShowConfirmModal(false);
    } catch (err: any) {
      toast.error(err.message || t.createError);
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToSummary = () => summaryRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="mx-auto px-4 py-8 min-h-screen" >
      <div className="mb-8 flex flex-col items-center md:items-start justify-center md:justify-start text-center">
        <div className="flex items-center md:items-start justify-center md:justify-start gap-3">
          <ShoppingCart className="w-7 h-7 text-amber-600" />
          <h1 className="text-2xl font-bold">{t.createOrder}</h1>
        </div>
        <p className="text-gray-600 text-sm">{t.addProducts}</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm">{error}</span>
        </div>
      )}

      {orderItems.length > 0 && (
        <button
          onClick={scrollToSummary}
          className="fixed bottom-8 right-8 p-4 bg-amber-600 text-white rounded-full shadow-lg z-40 lg:hidden"
        >
          <ChevronDown className="w-6 h-6" />
        </button>
      )}

      <div className={`space-y-8 ${orderItems.length > 0 ? 'lg:grid lg:grid-cols-3 lg:gap-6' : ''}`}>
        <div className={orderItems.length > 0 ? 'lg:col-span-2' : ''}>
          <div className="p-6 bg-white rounded-xl shadow-sm border">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <ProductSearchInput value={searchInput} onChange={handleSearchChange} placeholder={t.searchPlaceholder} ariaLabel={t.searchPlaceholder} />
              <ProductDropdown
                value={filterDepartment}
                onChange={setFilterDepartment}
                options={[{ value: '', label: isRtl ? 'كل الأقسام' : 'All Departments' }, ...departments.map(d => ({ value: d._id, label: d.displayName }))]}
                ariaLabel={t.department}
              />
            </div>
            <p className="mt-2 text-center text-sm text-gray-600">{filteredProducts.length} منتج</p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
              {Array.from({ length: skeletonCount }).map((_, i) => <ProductSkeletonCard key={i} />)}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl shadow-sm border mt-6">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">{searchTerm || filterDepartment ? t.noMatch : t.empty}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
              {filteredProducts.map(p => {
                const item = orderItems.find(i => i.productId === p._id);
                return (
                  <ProductCard
                    key={p._id}
                    product={p}
                    cartItem={item}
                    onAdd={() => addToOrder(p)}
                    onUpdate={qty => updateQuantity(p._id, qty)}
                    translations={translations}
                  />
                );
              })}
            </div>
          )}
        </div>

        {orderItems.length > 0 && (
          <div className="md:sticky lg:col-span-1 space-y-6" ref={summaryRef}>
            <div className="p-6 bg-white rounded-xl shadow-sm border">
              <h3 className="text-xl font-bold mb-4">{t.orderSummary}</h3>
              {orderItems.map(item => (
                <div key={item.productId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-3">
                  <div>
                    <p className="font-semibold text-sm">{item.product.displayName}</p>
                    <p className="text-xs text-gray-600">{item.price} {t.currency} / {item.product.displayUnit}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <QuantityInput
                      value={item.quantity}
                      onChange={q => updateQuantity(item.productId, q)}
                      onIncrement={() => updateQuantity(item.productId, item.quantity + (['كيلو', 'Kilo', 'كجم', 'kg'].includes(item.product.displayUnit) ? 0.25 : 1))}
                      onDecrement={() => updateQuantity(item.productId, Math.max(0, item.quantity - (['كيلو', 'Kilo', 'كجم', 'kg'].includes(item.product.displayUnit) ? 0.25 : 1)))}
                      unit={item.product.displayUnit}
                    />
                    <button onClick={() => removeFromOrder(item.productId)} className="w-8 h-8 bg-red-600 text-white rounded-full-full flex items-center justify-center">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="border-t pt-3 flex justify-between font-bold">
                <span>{t.finalTotal}:</span>
                <span className="text-amber-600">{total} {t.currency}</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 bg-white rounded-xl shadow-sm border space-y-4">
              {user?.role === 'admin' && (
                <ProductDropdown
                  value={branch}
                  onChange={setBranch}
                  options={[{ value: '', label: t.branchPlaceholder }, ...branches.map(b => ({ value: b._id, label: b.displayName }))]}
                  ariaLabel={t.branch}
                />
              )}
              <div className="flex gap-3">
                <button type="button" onClick={clearOrder} className="flex-1 py-2.5 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm" disabled={submitting}>
                  {t.clearOrder}
                </button>
                <button type="submit" className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm" disabled={submitting}>
                  {submitting ? t.submitting : t.submitOrder}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <OrderConfirmModal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} onConfirm={confirmOrder} submitting={submitting} t={t} isRtl={isRtl} />
    </div>
  );
}