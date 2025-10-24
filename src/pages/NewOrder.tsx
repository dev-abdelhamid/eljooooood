import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotifications } from '../contexts/NotificationContext';
import { productsAPI, ordersAPI, branchesAPI, departmentAPI } from '../services/api';
import { ShoppingCart, Package, AlertCircle, ChevronDown } from 'lucide-react';
import { io } from 'socket.io-client';
import { debounce } from 'lodash';
import { toast } from 'react-toastify';
import ProductSearchInput from './ProductSearchInput';
import ProductDropdown from './ProductDropdown';
import QuantityInput from './QuantityInput';
import ProductCard from './ProductCard';
import ProductSkeletonCard from './ProductSkeletonCard';
import OrderConfirmModal from './OrderConfirmModal';

interface Product {
  _id: string;
  name: string;
  nameEn?: string;
  code: string;
  price: number;
  unit?: string;
  unitEn?: string;
  department: { _id: string; name: string; nameEn?: string };
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
}

interface Department {
  _id: string;
  name: string;
  nameEn?: string;
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
    invalidQuantity: 'الكمية يجب أن تكون مضاعفات 0.5 كجم',
    currency: 'ريال',
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
    invalidQuantity: 'Quantity must be in increments of 0.5 kg',
    currency: 'SAR',
  },
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
    }, 300),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    if (value.length >= 2 || value === '') {
      debouncedSearch(value);
    }
  };

  const getDisplayName = (item: { name: string; nameEn?: string }) =>
    isRtl ? item.name : (item.nameEn || item.name);

  const getDisplayUnit = (item: { unit?: string; unitEn?: string }) =>
    isRtl ? (item.unit || 'غير محدد') : (item.unitEn || item.unit || 'N/A');

  const filteredProducts = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    const seenIds = new Set<string>();
    return products
      .filter((product) => {
        if (seenIds.has(product._id)) return false;
        seenIds.add(product._id);
        const name = getDisplayName(product).toLowerCase();
        const code = product.code.toLowerCase();
        return (
          (filterDepartment ? product.department._id === filterDepartment : true) &&
          (name.includes(lowerSearchTerm) || code.includes(lowerSearchTerm))
        );
      })
      .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)));
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

        setProducts(productsResponse.data);
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

  useEffect(() => {
    if (!user || !socket) return;

    socket.on('connect', () => {
      console.log(`[${new Date().toISOString()}] Connected to Socket.IO server`);
      if (user?.role === 'branch' && user?.branchId) {
        socket.emit('joinRoom', `branch-${user.branchId}`);
      } else if (user?.role === 'admin') {
        socket.emit('joinRoom', 'admin');
      } else if (user?.role === 'production') {
        socket.emit('joinRoom', 'production');
      }
    });

    socket.on('orderCreated', (orderData) => {
      if (!orderData?._id || !orderData.orderNumber || !orderData.branch) {
        console.warn(`[${new Date().toISOString()}] Invalid order created data:`, orderData);
        return;
      }
      const eventId = orderData.eventId || crypto.randomUUID();
      let message = languageT('notifications.order_created', {
        orderNumber: orderData.orderNumber,
        branchName: isRtl ? orderData.branch.name : (orderData.branch.nameEn || orderData.branch.name),
      });
      if (user.role === 'branch') {
        message = t.orderCreated;
      }
      addNotification({
        _id: eventId,
        type: 'success',
        message,
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
  }, [socket, languageT, isRtl, user, addNotification, t]);

  const addToOrder = useCallback((product: Product) => {
    setOrderItems((prev) => {
      const existingItem = prev.find((item) => item.productId === product._id);
      if (existingItem) {
        return prev.map((item) =>
          item.productId === product._id ? { ...item, quantity: item.quantity + 0.5 } : item
        );
      }
      return [
        ...prev,
        {
          productId: product._id,
          product,
          quantity: 0.5,
          price: product.price,
        },
      ];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity < 0.5) {
      removeFromOrder(productId);
      return;
    }
    if (quantity % 0.5 !== 0) {
      toast.error(t.invalidQuantity, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    setOrderItems((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, quantity } : item))
    );
  }, [t, isRtl]);

  const handleQuantityInput = useCallback(
    (productId: string, value: number) => {
      updateQuantity(productId, value);
    },
    [updateQuantity]
  );

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
      const invalidItems = orderItems.filter((item) => item.quantity < 0.5 || item.quantity % 0.5 !== 0);
      if (invalidItems.length > 0) {
        setError(t.invalidQuantity);
        toast.error(t.invalidQuantity, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      setShowConfirmModal(true);
    },
    [orderItems, branch, user, t, isRtl]
  );

  const confirmOrder = async () => {
    setSubmitting(true);
    try {
      const eventId = crypto.randomUUID();
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
        eventId,
      };
      const response = await ordersAPI.create(orderData, isRtl);
      const branchData = branches.find((b) => b._id === orderData.branchId);
      socket.emit('orderCreated', {
        _id: response.data.id,
        orderNumber: response.data.orderNumber,
        branch: branchData || { _id: orderData.branchId, name: t.branches?.unknown || 'Unknown', nameEn: t.branches?.unknown || 'Unknown' },
        items: response.data.items,
        eventId,
        isRtl,
      });
      addNotification({
        _id: eventId,
        type: 'success',
        message: t.orderCreated,
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
      toast.success(t.orderCreated, { position: isRtl ? 'top-right' : 'top-left', toastId: eventId });
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
    <div className={`mx-auto px-4 py-8 min-h-screen`} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center gap-3">
          <ShoppingCart className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.createOrder}</h1>
            <p className="text-gray-600 text-sm">{t.addProducts}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm font-medium">{error}</span>
        </div>
      )}

      {orderItems.length > 0 && (
        <div className={`lg:hidden fixed bottom-8 ${isRtl ? 'left-8' : 'right-8'} z-50`}>
          <button
            onClick={scrollToSummary}
            className="p-4 bg-amber-600 hover:bg-amber-700 text-white rounded-full shadow-lg transition-colors duration-200"
            aria-label={t.scrollToSummary}
          >
            <ChevronDown className="w-6 h-6" />
          </button>
        </div>
      )}

      <div className={`space-y-8 ${orderItems.length > 0 ? 'lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0' : ''}`}>
        <div className={`${orderItems.length > 0 ? 'lg:col-span-2 lg:overflow-y-auto lg:max-h-[calc(100vh-10rem)] scrollbar-none' : ''}`}>
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
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
                    label: getDisplayName(d),
                  })),
                ]}
                ariaLabel={t.department}
              />
            </div>
            <div className="mt-4 text-center text-sm text-gray-600 font-medium">
              {isRtl ? `عدد المنتجات: ${filteredProducts.length}` : `Products Count: ${filteredProducts.length}`}
            </div>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
              {[...Array(skeletonCount)].map((_, index) => (
                <div key={index}>
                  <ProductSkeletonCard />
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-sm font-medium">{searchTerm || filterDepartment ? t.noMatch : t.empty}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
              {filteredProducts.map((product) => {
                const cartItem = orderItems.find((item) => item.productId === product._id);
                return (
                  <div key={product._id}>
                    <ProductCard
                      product={product}
                      cartItem={cartItem}
                      onAdd={() => addToOrder(product)}
                      onUpdate={(quantity) => updateQuantity(product._id, quantity)}
                      onRemove={() => removeFromOrder(product._id)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {orderItems.length > 0 && (
          <div className="lg:col-span-1 lg:sticky lg:top-8 space-y-6 max-h-[calc(100vh-10rem)] overflow-y-auto scrollbar-none" ref={summaryRef}>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-6">{t.orderSummary}</h3>
              <div className="space-y-4">
                {orderItems.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-sm">{getDisplayName(item.product)}</p>
                      <p className="text-sm text-gray-600">
                        {item.price} {t.currency} / {getDisplayUnit(item.product)}
                      </p>
                      <p className="text-sm text-gray-600">
                        {isRtl ? 'الكمية' : 'Quantity'}: {item.quantity} {getDisplayUnit(item.product)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <QuantityInput
                        value={item.quantity}
                        onChange={(val) => handleQuantityInput(item.productId, val)}
                        onIncrement={() => updateQuantity(item.productId, item.quantity + 0.5)}
                        onDecrement={() => updateQuantity(item.productId, item.quantity - 0.5)}
                      />
                      <button
                        onClick={() => removeFromOrder(item.productId)}
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
                    <span>{t.finalTotal}:</span>
                    <span className="text-amber-600">
                      {getTotalAmount} {t.currency}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
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
                          label: getDisplayName(b),
                        })),
                      ]}
                      ariaLabel={t.branch}
                    />
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={clearOrder}
                    className="flex-1 px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors duration-200 shadow-sm"
                    disabled={submitting || orderItems.length === 0}
                    aria-label={t.clearOrder}
                  >
                    {t.clearOrder}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 shadow-sm"
                    disabled={orderItems.length === 0 || submitting}
                    aria-label={submitting ? t.submitting : t.submitOrder}
                    >
                    {submitting ? t.submitting : t.submitOrder}
                  </button>
                </div>
              </form>
            </div>
          </div>
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