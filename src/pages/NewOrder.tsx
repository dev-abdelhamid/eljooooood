import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotifications } from '../contexts/NotificationContext';
import { productsAPI, ordersAPI, branchesAPI, departmentAPI } from '../services/api';
import { ShoppingCart, Plus, Minus, Trash2, Package, AlertCircle, Search, X, ChevronDown } from 'lucide-react';
import { io } from 'socket.io-client';
import { debounce } from 'lodash';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';

interface OrderItem {
  productId: string;
  product: Product;
  quantity: number;
  price: number;
}

const translations = {
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
  },
};

const ProductSearchInput = ({
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
      <motion.div
        initial={{ opacity: value ? 0 : 1 }}
        animate={{ opacity: value ? 0 : 1 }}
        transition={{ duration: 0.15 }}
        className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors group-focus-within:text-amber-500`}
      >
        <Search />
      </motion.div>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full ${isRtl ? 'pl-12 pr-4' : 'pr-12 pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={ariaLabel}
      />
      <motion.div
        initial={{ opacity: value ? 1 : 0 }}
        animate={{ opacity: value ? 1 : 0 }}
        transition={{ duration: 0.15 }}
        className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-amber-500 transition-colors`}
      >
        <button
          onClick={() => onChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>)}
          aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
        >
          <X className="w-5 h-5" />
        </button>
      </motion.div>
    </div>
  );
};

const ProductDropdown = ({
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
  const selectedOption = options.find((opt) => opt.value === value) || options[0] || { label: isRtl ? 'اختر' : 'Select' };

  return (
    <div className="relative group">
      <motion.button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 bg-gradient-to-r from-white to-gray-50 shadow-sm hover:shadow-md text-sm text-gray-700 ${isRtl ? 'text-right' : 'text-left'} flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={ariaLabel}
        whileHover={{ scale: disabled ? 1 : 1.05 }}
        whileTap={{ scale: disabled ? 1 : 0.95 }}
      >
        <span className="truncate">{selectedOption.label}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-5 h-5 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
        </motion.div>
      </motion.button>
      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute w-full mt-2 bg-white rounded-lg shadow-2xl border border-gray-100 z-20 max-h-60 overflow-y-auto scrollbar-none"
          >
            {options.map((option) => (
              <motion.div
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className="px-4 py-2.5 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-600 cursor-pointer transition-colors duration-200"
                whileHover={{ backgroundColor: '#fef3c7' }}
              >
                {option.label}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

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
  return (
    <div className="flex items-center gap-2">
      <motion.button
        onClick={onDecrement}
        className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors duration-200 flex items-center justify-center"
        aria-label={isRtl ? 'تقليل الكمية' : 'Decrease quantity'}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <Minus className="w-4 h-4" />
      </motion.button>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-12 h-8 text-center border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm min-w-[2.75rem] transition-all duration-200"
        style={{ appearance: 'none' }}
        aria-label={isRtl ? 'الكمية' : 'Quantity'}
      />
      <motion.button
        onClick={onIncrement}
        className="w-8 h-8 bg-amber-600 hover:bg-amber-700 rounded-full transition-colors duration-200 flex items-center justify-center"
        aria-label={isRtl ? 'زيادة الكمية' : 'Increase quantity'}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <Plus className="w-4 h-4 text-white" />
      </motion.button>
    </div>
  );
};

const ProductCard = ({ product, cartItem, onAdd, onUpdate, onRemove }: {
  product: Product;
  cartItem?: OrderItem;
  onAdd: () => void;
  onUpdate: (quantity: number) => void;
  onRemove: () => void;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between border border-gray-100 hover:border-amber-200"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-gray-900 text-base truncate" style={{ fontWeight: 700 }}>{product.displayName}</h3>
          <p className="text-sm text-gray-500">{product.code}</p>
        </div>
        <p className="text-sm text-amber-600">{t.department}: {product.department.displayName}</p>
        <p className="font-semibold text-gray-900 text-sm">{t.price}: {product.price} {isRtl ? 'ريال' : 'SAR'} / {product.displayUnit}</p>
      </div>
      <div className="mt-4 flex justify-end">
        {cartItem ? (
          <QuantityInput
            value={cartItem.quantity}
            onChange={(val) => onUpdate(parseInt(val) || 0)}
            onIncrement={() => onUpdate(cartItem.quantity + 1)}
            onDecrement={() => onUpdate(cartItem.quantity - 1)}
          />
        ) : (
          <motion.button
            onClick={onAdd}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm transition-colors duration-200 flex items-center justify-center gap-2 shadow-sm"
            aria-label={t.addToCart}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Plus className="w-4 h-4" />
            {t.addToCart}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};

const ProductSkeletonCard = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.3 }}
    className="p-5 bg-white rounded-xl shadow-sm border border-gray-100"
  >
    <div className="space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-3 bg-gray-200 rounded w-1/4"></div>
      </div>
      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      <div className="h-3 bg-gray-200 rounded w-1/3"></div>
      <div className="mt-4 flex justify-end">
        <div className="h-8 bg-gray-200 rounded-lg w-24"></div>
      </div>
    </div>
  </motion.div>
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
  t: typeof translations['ar' | 'en'];
  isRtl: boolean;
}) => {
  if (!isOpen) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="bg-white rounded-xl shadow-2xl max-w-full w-[95vw] sm:max-w-md p-8"
      >
        <h3 className="text-xl font-bold text-gray-900 mb-6">{t.confirmOrder}</h3>
        <p className="text-sm text-gray-600 mb-6">{t.confirmMessage}</p>
        <div className="flex justify-end gap-3">
          <motion.button
            onClick={onClose}
            className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors duration-200"
            aria-label={t.cancel}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {t.cancel}
          </motion.button>
          <motion.button
            onClick={onConfirm}
            disabled={submitting}
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
            aria-label={submitting ? t.submitting : t.confirm}
            whileHover={{ scale: submitting ? 1 : 1.05 }}
            whileTap={{ scale: submitting ? 1 : 0.95 }}
          >
            {submitting ? t.submitting : t.confirm}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export function NewOrder() {
  const { user } = useAuth();
  const { language, t: languageT } = useLanguage();
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

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchTerm(value.trim());
    }, 500),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    if (value.length >= 2 || value === '') {
      debouncedSearch(value);
    }
  };

  const filteredProducts = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    const seenIds = new Set<string>();
    return products
      .filter((product) => {
        if (seenIds.has(product._id)) return false;
        seenIds.add(product._id);
        const name = product.displayName.toLowerCase();
        const code = product.code.toLowerCase();
        return (
          (filterDepartment ? product.department._id === filterDepartment : true) &&
          (name.startsWith(lowerSearchTerm) || code.startsWith(lowerSearchTerm) || name.includes(lowerSearchTerm))
        );
      })
      .sort((a, b) => {
        const aName = a.displayName.toLowerCase();
        const bName = b.displayName.toLowerCase();
        const aCode = a.code.toLowerCase();
        const bCode = b.code.toLowerCase();
        if (aName.startsWith(lowerSearchTerm) && !bName.startsWith(lowerSearchTerm)) return -1;
        if (!aName.startsWith(lowerSearchTerm) && bName.startsWith(lowerSearchTerm)) return 1;
        if (aCode.startsWith(lowerSearchTerm) && !bCode.startsWith(lowerSearchTerm)) return -1;
        if (!aCode.startsWith(lowerSearchTerm) && bCode.startsWith(lowerSearchTerm)) return 1;
        return aName.localeCompare(bName);
      });
  }, [products, searchTerm, filterDepartment]);

  const skeletonCount = useMemo(() => {
    return filteredProducts.length > 0 ? filteredProducts.length : 6;
  }, [filteredProducts]);

  useEffect(() => {
    if (!user || !['admin', 'branch'].includes(user.role)) {
      setError(t.unauthorized);
      toast.error(t.unauthorized, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        const [productsResponse, branchesResponse, departmentsResponse] = await Promise.all([
          productsAPI.getAll({ department: filterDepartment, search: searchTerm, limit: 0 }),
          branchesAPI.getAll(),
          departmentAPI.getAll({ limit: 100 }),
        ]);

        const productsWithDisplay = productsResponse.data.map((product: Product) => ({
          ...product,
          displayName: isRtl ? product.name : (product.nameEn || product.name),
          displayUnit: isRtl ? (product.unit || 'غير محدد') : (product.unitEn || product.unit || 'N/A'),
          department: {
            ...product.department,
            displayName: isRtl ? product.department.name : (product.department.nameEn || product.department.name),
          },
        }));
        setProducts(productsWithDisplay);
        setBranches(Array.isArray(branchesResponse) ? branchesResponse : []);
        setDepartments(Array.isArray(departmentsResponse.data) ? departmentsResponse.data : []);
        if (user?.role === 'branch' && user?.branchId) {
          setBranch(user.branchId.toString());
        }
        setError('');
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Fetch error:`, err);
        setError(err.message || t.fetchError);
        toast.error(err.message || t.fetchError, { position: isRtl ? 'top-right' : 'top-left' });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user, t, isRtl, filterDepartment, searchTerm]);

  // تحديث displayName و displayUnit للمنتجات عند تغيير اللغة
  useEffect(() => {
    setProducts((prev) =>
      prev.map((product) => ({
        ...product,
        displayName: isRtl ? product.name : (product.nameEn || product.name),
        displayUnit: isRtl ? (product.unit || 'غير محدد') : (product.unitEn || product.unit || 'N/A'),
        department: {
          ...product.department,
          displayName: isRtl ? product.department.name : (product.department.nameEn || product.department.name),
        },
      }))
    );
    // تحديث orderItems عند تغيير اللغة
    setOrderItems((prev) =>
      prev.map((item) => ({
        ...item,
        product: {
          ...item.product,
          displayName: isRtl ? item.product.name : (item.product.nameEn || item.product.name),
          displayUnit: isRtl ? (item.product.unit || 'غير محدد') : (item.product.unitEn || item.product.unit || 'N/A'),
          department: {
            ...item.product.department,
            displayName: isRtl ? item.product.department.name : (item.product.department.nameEn || item.product.department.name),
          },
        },
      }))
    );
  }, [isRtl]);

  useEffect(() => {
    if (!user || !socket) return;

    socket.on('connect', () => {
      console.log(`[${new Date().toISOString()}] Connected to Socket.IO server`);
      if (user?.role === 'branch' && user?.branchId) {
        socket.emit('joinRoom', `branch-${user.branchId}`);
      } else if (user?.role === 'admin') {
        socket.emit('joinRoom', 'admin');
      }
    });

    socket.on('orderCreated', (orderData) => {
      if (!orderData?._id || !orderData.orderNumber || !orderData.branch) {
        console.warn(`[${new Date().toISOString()}] Invalid order created data:`, orderData);
        return;
      }
      const eventId = orderData.eventId || crypto.randomUUID();
      addNotification({
        _id: eventId,
        type: 'success',
        message: languageT('notifications.order_created', {
          orderNumber: orderData.orderNumber,
          branchName: isRtl ? orderData.branch.name : (orderData.branch.nameEn || orderData.branch.name),
        }),
        data: { orderId: orderData._id, eventId },
        read: false,
        createdAt: new Date().toISOString(),
        sound: '/sounds/notification.mp3',
        vibrate: [200, 100, 200],
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [socket, languageT, isRtl, user, addNotification]);

  const addToOrder = useCallback((product: Product) => {
    setOrderItems((prev) => {
      const existingItem = prev.find((item) => item.productId === product._id);
      if (existingItem) {
        return prev.map((item) =>
          item.productId === product._id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { productId: product._id, product, quantity: 1, price: product.price }];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromOrder(productId);
      return;
    }
    setOrderItems((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, quantity } : item))
    );
  }, []);

  const handleQuantityInput = useCallback((productId: string, value: string) => {
    const quantity = parseInt(value) || 0;
    if (value === '' || quantity <= 0) {
      updateQuantity(productId, 0);
      return;
    }
    updateQuantity(productId, quantity);
  }, [updateQuantity]);

  const removeFromOrder = useCallback((productId: string) => {
    setOrderItems((prev) => prev.filter((item) => item.productId !== productId));
  }, []);

  const clearOrder = useCallback(() => {
    setOrderItems([]);
    if (user?.role === 'admin') setBranch('');
    setSearchInput('');
    setSearchTerm('');
    setFilterDepartment('');
    toast.success(t.orderCleared, { position: isRtl ? 'top-right' : 'top-left' });
  }, [user, t, isRtl]);

  const getTotalAmount = useMemo(
    () => orderItems.reduce((total, item) => total + item.price * item.quantity, 0).toFixed(2),
    [orderItems]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (orderItems.length === 0) {
        setError(t.cartEmpty);
        toast.error(t.cartEmpty, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      if (!branch && user?.role === 'admin') {
        setError(t.branchRequired);
        toast.error(t.branchRequired, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      setShowConfirmModal(true);
    },
    [orderItems, branch, user, t, isRtl]
  );

  const confirmOrder = async () => {
    setSubmitting(true);
    try {
      const orderData = {
        orderNumber: `ORD-${Date.now()}`,
        branchId: user?.role === 'branch' ? user?.branchId?.toString() : branch,
        items: orderItems.map((item) => ({
          product: item.productId,
          quantity: item.quantity,
          price: item.price,
          productName: item.product.name,
          productNameEn: item.product.nameEn,
          unit: item.product.unit,
          unitEn: item.product.unitEn,
          department: item.product.department,
        })),
        status: 'pending',
        priority: 'medium',
        createdBy: user?.id || user?._id,
        isRtl,
      };
      const response = await ordersAPI.create(orderData, isRtl);
      const eventId = crypto.randomUUID();
      socket.emit('orderCreated', {
        _id: response.data.id,
        orderNumber: response.data.orderNumber,
        branch: response.data.branch,
        items: response.data.items,
        eventId,
        isRtl,
      });
      addNotification({
        _id: eventId,
        type: 'success',
        message: languageT('notifications.order_created', {
          orderNumber: response.data.orderNumber,
          branchName: isRtl ? response.data.branch.name : (response.data.branch.nameEn || response.data.branch.name),
        }),
        data: { orderId: response.data.id, eventId },
        read: false,
        createdAt: new Date().toISOString(),
        sound: '/sounds/notification.mp3',
        vibrate: [200, 100, 200],
      });
      setOrderItems([]);
      if (user?.role === 'admin') setBranch('');
      setSearchInput('');
      setSearchTerm('');
      setFilterDepartment('');
      setShowConfirmModal(false);
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Create error:`, err);
      setError(err.message || t.createError);
      toast.error(err.message || t.createError, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToSummary = () => {
    summaryRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className={`mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans ${isRtl ? 'font-arabic' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:items-center"
      >
        <div className="flex items-center gap-3">
          <ShoppingCart className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.createOrder}</h1>
            <p className="text-gray-600 text-sm">{t.addProducts}</p>
          </div>
        </div>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm font-medium">{error}</span>
        </motion.div>
      )}

      {orderItems.length > 0 && (
        <div className={`lg:hidden fixed bottom-8 ${isRtl ? 'left-8' : 'right-8'} z-50`}>
          <motion.button
            onClick={scrollToSummary}
            className="p-4 bg-amber-600 hover:bg-amber-700 text-white rounded-full shadow-lg transition-colors duration-200"
            aria-label={t.scrollToSummary}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <ChevronDown className="w-6 h-6" />
          </motion.button>
        </div>
      )}

      <div className={`space-y-8 ${orderItems.length > 0 ? 'lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0' : ''}`}>
        <div className={`${orderItems.length > 0 ? 'lg:col-span-2 lg:overflow-y-auto lg:max-h-[calc(100vh-10rem)] scrollbar-none' : ''}`}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="p-6 bg-white rounded-xl shadow-sm border border-gray-100"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <ProductSearchInput
                value={searchInput}
                onChange={handleSearchChange}
                placeholder={t.searchPlaceholder}
                ariaLabel={t.searchPlaceholder}
              />
              <ProductDropdown
                value={filterDepartment}
                onChange={setFilterDepartment}
                options={[
                  { value: '', label: isRtl ? 'كل الأقسام' : 'All Departments' },
                  ...departments.map((d) => ({
                    value: d._id,
                    label: d.displayName,
                  })),
                ]}
                ariaLabel={t.department}
              />
            </div>
            <div className="mt-4 text-center text-sm text-gray-600 font-medium">
              {isRtl ? `عدد المنتجات: ${filteredProducts.length}` : `Products Count: ${filteredProducts.length}`}
            </div>
          </motion.div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
              <AnimatePresence>
                {[...Array(skeletonCount)].map((_, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <ProductSkeletonCard />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : filteredProducts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100 mt-6"
            >
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-sm font-medium">{searchTerm || filterDepartment ? t.noMatch : t.empty}</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
              <AnimatePresence>
                {filteredProducts.map((product, index) => {
                  const cartItem = orderItems.find((item) => item.productId === product._id);
                  return (
                    <motion.div
                      key={product._id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3, ease: 'easeOut', delay: index * 0.05 }}
                    >
                      <ProductCard
                        product={product}
                        cartItem={cartItem}
                        onAdd={() => addToOrder(product)}
                        onUpdate={(quantity) => updateQuantity(product._id, quantity)}
                        onRemove={() => removeFromOrder(product._id)}
                      />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {orderItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: isRtl ? -10 : 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="lg:col-span-1 lg:sticky lg:top-8 space-y-6 max-h-[calc(100vh-10rem)] overflow-y-auto scrollbar-none"
            ref={summaryRef}
          >
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-6">{t.orderSummary}</h3>
              <div className="space-y-4">
                <AnimatePresence>
                  {orderItems.map((item, index) => (
                    <motion.div
                      key={item.productId}
                      initial={{ opacity: 0, x: isRtl ? -5 : 5 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: isRtl ? 5 : -5 }}
                      transition={{ duration: 0.15, delay: index * 0.02 }}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{item.product.displayName}</p>
                        <p className="text-sm text-gray-600">
                          {item.price} {isRtl ? 'ريال' : 'SAR'} / {item.product.displayUnit}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <QuantityInput
                          value={item.quantity}
                          onChange={(val) => handleQuantityInput(item.productId, val)}
                          onIncrement={() => updateQuantity(item.productId, item.quantity + 1)}
                          onDecrement={() => updateQuantity(item.productId, item.quantity - 1)}
                        />
                        <motion.button
                          onClick={() => removeFromOrder(item.productId)}
                          className="w-8 h-8 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors duration-200 flex items-center justify-center"
                          aria-label={isRtl ? 'إزالة المنتج' : 'Remove item'}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div className="border-t pt-4">
                  <div className="flex justify-between font-bold text-gray-900 text-sm">
                    <span>{t.finalTotal}:</span>
                    <span className="text-amber-600">
                      {getTotalAmount} {isRtl ? 'ريال' : 'SAR'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="p-6 bg-white rounded-xl shadow-sm border border-gray-100"
            >
              <form onSubmit={handleSubmit} className="space-y-6">
                {user?.role === 'admin' && (
                  <div>
                    <label htmlFor="branch" className="block text-sm font-medium text-gray-700 mb-2">
                      {t.branch}
                    </label>
                    <ProductDropdown
                      value={branch}
                      onChange={setBranch}
                      options={[
                        { value: '', label: t.branchPlaceholder },
                        ...branches.map((b) => ({
                          value: b._id,
                          label: b.displayName,
                        })),
                      ]}
                      ariaLabel={t.branch}
                    />
                  </div>
                )}
                <div className="flex gap-3">
                  <motion.button
                    onClick={clearOrder}
                    className="flex-1 px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors duration-200 shadow-sm"
                    disabled={submitting || orderItems.length === 0}
                    aria-label={t.clearOrder}
                    whileHover={{ scale: submitting || orderItems.length === 0 ? 1 : 1.05 }}
                    whileTap={{ scale: submitting || orderItems.length === 0 ? 1 : 0.95 }}
                  >
                    {t.clearOrder}
                  </motion.button>
                  <motion.button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 shadow-sm"
                    disabled={orderItems.length === 0 || submitting}
                    aria-label={submitting ? t.submitting : t.submitOrder}
                    whileHover={{ scale: orderItems.length === 0 || submitting ? 1 : 1.05 }}
                    whileTap={{ scale: orderItems.length === 0 || submitting ? 1 : 0.95 }}
                  >
                    {submitting ? t.submitting : t.submitOrder}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </div>

      <OrderConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={confirmOrder}
        submitting={submitting}
        t={t}
        isRtl={isRtl}
      />
    </div>
  );
}