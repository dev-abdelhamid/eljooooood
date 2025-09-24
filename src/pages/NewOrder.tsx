import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { productsAPI, ordersAPI, branchesAPI, departmentAPI } from '../services/api';
import { ShoppingCart, Plus, Minus, Trash2, Package, AlertCircle, Search, X, ChevronDown } from 'lucide-react';
import { io } from 'socket.io-client';
import { debounce } from 'lodash';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';

interface Product {
  _id: string;
  name: string;
  nameEn?: string;
  code: string;
  department: { _id: string; name: string; nameEn?: string };
  price: number;
  unit?: string;
  unitEn?: string;
  displayName: string;
  displayUnit: string;
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

interface OrderItem {
  productId: string;
  product: Product;
  quantity: number;
  price: number;
}

export function NewOrder() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const navigate = useNavigate();
  const summaryRef = useRef<HTMLDivElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [branch, setBranch] = useState<string>(user?.branchId?.toString() || '');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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

  useEffect(() => {
    if (!user || !['admin', 'branch'].includes(user.role)) {
      setError(isRtl ? 'غير مصرح' : 'Unauthorized');
      navigate('/branch-orders');
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
        }));
        setProducts(productsWithDisplay);
        setBranches(Array.isArray(branchesResponse) ? branchesResponse : []);
        setDepartments(Array.isArray(departmentsResponse.data) ? departmentsResponse.data : []);
        if (user?.role === 'branch' && user?.branchId) {
          setBranch(user.branchId.toString());
        }
        setError('');
      } catch (err: any) {
        setError(err.message || (isRtl ? 'خطأ في جلب البيانات' : 'Error fetching data'));
        toast.error(err.message || (isRtl ? 'خطأ في جلب البيانات' : 'Error fetching data'));
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [isRtl, user, navigate, filterDepartment, searchTerm]);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to Socket.IO server');
    });
    socket.on('orderCreated', () => {
      toast.success(isRtl ? 'تم إنشاء الطلب بنجاح' : 'Order created successfully');
    });
    return () => {
      socket.disconnect();
    };
  }, [isRtl, socket]);

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
    setNotes('');
    if (user?.role === 'admin') setBranch('');
    toast.success(isRtl ? 'تم مسح الطلب' : 'Order cleared');
  }, [isRtl, user]);

  const getTotalAmount = useMemo(
    () => orderItems.reduce((total, item) => total + item.price * item.quantity, 0).toFixed(2),
    [orderItems]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (orderItems.length === 0) {
        setError(isRtl ? 'السلة فارغة' : 'Cart is empty');
        return;
      }
      if (!branch && user?.role === 'admin') {
        setError(isRtl ? 'الفرع مطلوب' : 'Branch is required');
        return;
      }
      setShowConfirmModal(true);
    },
    [orderItems, branch, user, isRtl]
  );

  const confirmOrder = async () => {
    setSubmitting(true);
    setShowConfirmModal(false);
    try {
      const orderData = {
        orderNumber: `ORD-${Date.now()}`,
        branchId: user?.role === 'branch' ? user?.branchId?.toString() : branch,
        items: orderItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
        status: 'pending',
        notes: notes.trim() || undefined,
        requestedDeliveryDate: new Date().toISOString(),
      };
      const response = await ordersAPI.create(orderData);
      socket.emit('newOrderFromBranch', response);
      toast.success(isRtl ? 'تم إنشاء الطلب بنجاح' : 'Order created successfully');
      setTimeout(() => navigate('/orders'), 1000);
    } catch (err: any) {
      setError(err.message || (isRtl ? 'خطأ في إنشاء الطلب' : 'Error creating order'));
      toast.error(err.message || (isRtl ? 'خطأ في إنشاء الطلب' : 'Error creating order'));
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToSummary = () => {
    summaryRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="mx-auto px-4 py-8 min-h-screen overflow-y-auto scrollbar-thin" dir={isRtl ? 'rtl' : 'ltr'}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6 flex flex-col items-center sm:flex-row sm:justify-between sm:items-center gap-4"
      >
        <div className="flex items-center gap-3">
          <ShoppingCart className="w-8 h-8 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{isRtl ? 'إنشاء طلب جديد' : 'Create New Order'}</h1>
            <p className="text-gray-600 text-sm">
              {isRtl ? 'قم بإضافة المنتجات وتأكيد الطلب لإرساله' : 'Add products and confirm to submit your order'}
            </p>
          </div>
        </div>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm">{error}</span>
        </motion.div>
      )}

      {orderItems.length > 0 && (
        <div className={`lg:hidden fixed bottom-6 ${isRtl ? 'left-6' : 'right-6'} z-50`}>
          <motion.button
            onClick={scrollToSummary}
            className="p-3 bg-amber-600 hover:bg-amber-700 text-white rounded-full shadow-lg transition-colors duration-200"
            aria-label={isRtl ? 'التمرير للملخص' : 'Scroll to Summary'}
          >
            <ChevronDown className="w-6 h-6" />
          </motion.button>
        </div>
      )}

      <div className={`space-y-4 ${orderItems.length > 0 ? 'lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0' : ''}`}>
        <div className={`${orderItems.length > 0 ? 'lg:col-span-2 lg:overflow-y-auto lg:max-h-[calc(100vh-8rem)] scrollbar-thin' : ''}`}>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="p-5 bg-gradient-to-r from-white to-gray-50 rounded-xl shadow-lg"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <OrderInput
                id="search"
                value={searchInput}
                onChange={handleSearchChange}
                placeholder={isRtl ? 'ابحث عن المنتجات...' : 'Search products...'}
                ariaLabel={isRtl ? 'ابحث عن المنتجات' : 'Search products'}
                onClear={handleClearSearch}
              />
              <OrderDropdown
                id="department"
                value={filterDepartment}
                onChange={setFilterDepartment}
                options={[
                  { value: '', label: isRtl ? 'كل الأقسام' : 'All Departments' },
                  ...departments.map((d) => ({
                    value: d._id,
                    label: isRtl ? d.name : (d.nameEn || d.name),
                  })),
                ]}
                ariaLabel={isRtl ? 'تصفية حسب القسم' : 'Filter by department'}
              />
            </div>
          </motion.div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {[...Array(6)].map((_, index) => (
                <OrderSkeletonCard key={index} />
              ))}
            </div>
          ) : products.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="p-8 text-center bg-gradient-to-r from-white to-gray-50 rounded-xl shadow-lg mt-4"
            >
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-sm">{isRtl ? 'لا توجد منتجات متاحة' : 'No products available'}</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              <AnimatePresence>
                {products.map((product, index) => {
                  const cartItem = orderItems.find((item) => item.productId === product._id);
                  return (
                    <motion.div
                      key={product._id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="p-5 bg-gradient-to-r from-white to-gray-50 rounded-xl shadow-lg transition-colors duration-200 flex flex-col justify-between border border-gray-100 hover:border-amber-200"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-bold text-gray-900 text-base truncate" style={{ fontWeight: 700 }}>
                            {product.displayName}
                          </h3>
                          <p className="text-sm text-gray-500">{product.code}</p>
                        </div>
                        <p className="text-sm text-amber-600">
                          {isRtl ? product.department.name : (product.department.nameEn || product.department.name)}
                        </p>
                        <p className="font-semibold text-gray-900 text-sm">
                          {product.price} {isRtl ? 'ريال' : 'SAR'} / {product.displayUnit}
                        </p>
                      </div>
                      <div className="mt-4 flex justify-end">
                        {cartItem ? (
                          <OrderQuantityInput
                            value={cartItem.quantity}
                            onChange={(val) => handleQuantityInput(product._id, val)}
                            onIncrement={() => updateQuantity(product._id, cartItem.quantity + 1)}
                            onDecrement={() => updateQuantity(product._id, cartItem.quantity - 1)}
                          />
                        ) : (
                          <motion.button
                            onClick={() => addToOrder(product)}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm transition-colors duration-200 flex items-center justify-center gap-2 shadow-sm"
                            aria-label={isRtl ? 'إضافة إلى السلة' : 'Add to Cart'}
                          >
                            <Plus className="w-4 h-4" />
                            {isRtl ? 'إضافة إلى السلة' : 'Add to Cart'}
                          </motion.button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {orderItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:col-span-1 lg:sticky lg:top-8 space-y-4 max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-thin"
            ref={summaryRef}
          >
            <div className="p-5 bg-gradient-to-r from-white to-gray-50 rounded-xl shadow-lg border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">{isRtl ? 'ملخص الطلب' : 'Order Summary'}</h3>
              <div className="space-y-3">
                <AnimatePresence>
                  {orderItems.map((item, index) => (
                    <motion.div
                      key={item.productId}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-gray-100 hover:border-amber-200 transition-all duration-200"
                    >
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 text-sm">{item.product.displayName}</p>
                        <p className="text-xs text-gray-600">
                          {item.price} {isRtl ? 'ريال' : 'SAR'} / {item.product.displayUnit}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <OrderQuantityInput
                          value={item.quantity}
                          onChange={(val) => handleQuantityInput(item.productId, val)}
                          onIncrement={() => updateQuantity(item.productId, item.quantity + 1)}
                          onDecrement={() => updateQuantity(item.productId, item.quantity - 1)}
                        />
                        <motion.button
                          onClick={() => removeFromOrder(item.productId)}
                          className="w-8 h-8 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200 flex items-center justify-center shadow-sm"
                          aria-label={isRtl ? 'إزالة المنتج' : 'Remove item'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div className="border-t pt-3">
                  <div className="flex justify-between font-bold text-gray-900 text-sm">
                    <span>{isRtl ? 'الإجمالي النهائي' : 'Final Total'}:</span>
                    <span className="text-teal-600">
                      {getTotalAmount} {isRtl ? 'ريال' : 'SAR'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="p-5 bg-gradient-to-r from-white to-gray-50 rounded-xl shadow-lg border border-gray-100"
            >
              <form onSubmit={handleSubmit} className="space-y-4">
                {user?.role === 'admin' && (
                  <div>
                    <label htmlFor="branch" className="block text-sm font-medium text-gray-700 mb-2">
                      {isRtl ? 'الفرع' : 'Branch'}
                    </label>
                    <OrderDropdown
                      id="branch"
                      value={branch}
                      onChange={setBranch}
                      options={[
                        { value: '', label: isRtl ? 'اختر الفرع' : 'Select Branch' },
                        ...branches.map((b) => ({
                          value: b._id,
                          label: isRtl ? b.name : (b.nameEn || b.name),
                        })),
                      ]}
                      ariaLabel={isRtl ? 'الفرع' : 'Branch'}
                    />
                  </div>
                )}
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                    {isRtl ? 'ملاحظات' : 'Notes'}
                  </label>
                  <OrderTextarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={isRtl ? 'أدخل ملاحظات الطلب...' : 'Enter order notes...'}
                    ariaLabel={isRtl ? 'ملاحظات' : 'Notes'}
                  />
                </div>
                <div className="flex gap-3">
                  <motion.button
                    onClick={clearOrder}
                    className="flex-1 px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-sm transition-colors duration-200 shadow-sm"
                    disabled={submitting || orderItems.length === 0}
                    aria-label={isRtl ? 'مسح الطلب' : 'Clear Order'}
                  >
                    {isRtl ? 'مسح الطلب' : 'Clear Order'}
                  </motion.button>
                  <motion.button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm transition-colors duration-200 shadow-lg"
                    disabled={orderItems.length === 0 || submitting}
                    aria-label={submitting ? (isRtl ? 'جاري الإرسال...' : 'Submitting...') : (isRtl ? 'إرسال الطلب' : 'Submit Order')}
                  >
                    {submitting ? (isRtl ? 'جاري الإرسال...' : 'Submitting...') : (isRtl ? 'إرسال الطلب' : 'Submit Order')}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showConfirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-xl shadow-2xl max-w-md p-6 w-[90vw]"
            >
              <h3 className="text-lg font-bold text-gray-900 mb-4">{isRtl ? 'تأكيد الطلب' : 'Confirm Order'}</h3>
              <p className="text-sm text-gray-600 mb-6">{isRtl ? 'هل أنت متأكد من إرسال الطلب؟' : 'Are you sure you want to submit the order?'}</p>
              <div className="flex justify-end gap-3">
                <motion.button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-sm transition-colors duration-200"
                  aria-label={isRtl ? 'إلغاء' : 'Cancel'}
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </motion.button>
                <motion.button
                  onClick={confirmOrder}
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm transition-colors duration-200 disabled:opacity-50"
                  aria-label={submitting ? (isRtl ? 'جاري الإرسال...' : 'Submitting...') : (isRtl ? 'تأكيد' : 'Confirm')}
                >
                  {submitting ? (isRtl ? 'جاري الإرسال...' : 'Submitting...') : (isRtl ? 'تأكيد' : 'Confirm')}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}