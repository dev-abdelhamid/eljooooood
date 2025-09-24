// في src/components/NewOrder.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getUnitOptions, getDisplayUnit } from '../utils/units'; // استيراد الدوال الجديدة
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
  department: { _id: string; name: string; nameEn?: string };
  price: number;
  unit?: string;
  unitEn?: string;
  description?: string;
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
  unit: string; // الوحدة المختارة
}

interface Toast {
  message: string;
  type: 'success' | 'error';
}

export function NewOrder() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const navigate = useNavigate();
  const summaryRef = useRef<HTMLDivElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [branch, setBranch] = useState<string>(user?.branchId?.toString() || '');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState('medium');
  const [loading, setLoading] = useState({ products: false, branches: false, departments: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [toastState, setToastState] = useState<Toast | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const priorityOptions = useMemo(
    () => [
      { value: 'low', label: isRtl ? 'منخفض' : 'Low' },
      { value: 'medium', label: isRtl ? 'متوسط' : 'Medium' },
      { value: 'high', label: isRtl ? 'عالي' : 'High' },
      { value: 'urgent', label: isRtl ? 'عاجل' : 'Urgent' },
    ],
    [isRtl]
  );

  const socket = useMemo(() => io('https://eljoodia-server-production.up.railway.app'), []);

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchTerm(value);
      setCurrentPage(1);
    }, 300),
    []
  );

  useEffect(() => {
    if (!user || !['admin', 'branch'].includes(user.role)) {
      setError(isRtl ? 'غير مصرح' : 'Unauthorized');
      navigate('/branch-orders');
      return;
    }

    const loadData = async () => {
      try {
        setLoading((prev) => ({ ...prev, products: true, branches: true, departments: true }));
        const [productsResponse, branchesResponse, departmentsResponse] = await Promise.all([
          productsAPI.getAll({ limit: 12, page: currentPage, department: filterDepartment, search: searchTerm }).finally(() =>
            setLoading((prev) => ({ ...prev, products: false }))
          ),
          branchesAPI.getAll().finally(() => setLoading((prev) => ({ ...prev, branches: false }))),
          departmentAPI.getAll({ limit: 100 }).finally(() => setLoading((prev) => ({ ...prev, departments: false }))),
        ]);

        const productsWithDisplay = productsResponse.data.map((product: Product) => ({
          ...product,
          displayName: language === 'ar' ? product.name : (product.nameEn || product.name),
          displayUnit: language === 'ar' ? product.unit : product.unitEn, // نستخدم unit مباشرة
        }));
        setProducts(productsWithDisplay);
        setTotalPages(productsResponse.totalPages);
        setBranches(Array.isArray(branchesResponse) ? branchesResponse : []);
        setDepartments(Array.isArray(departmentsResponse.data) ? departmentsResponse.data : []);
        if (user?.role === 'branch' && user?.branchId) {
          setBranch(user.branchId.toString());
        }
        setError('');
      } catch (err: any) {
        setError(err.message || (isRtl ? 'خطأ في جلب البيانات' : 'Error fetching data'));
      }
    };
    loadData();
  }, [isRtl, user, navigate, filterDepartment, searchTerm, currentPage, language]);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to Socket.IO server');
    });
    socket.on('orderCreated', () => {
      setToastState({ message: isRtl ? 'تم إنشاء الطلب بنجاح' : 'Order created successfully', type: 'success' });
    });
    return () => {
      socket.disconnect();
    };
  }, [isRtl, socket]);

  useEffect(() => {
    if (toastState) {
      toast[toastState.type](toastState.message, { autoClose: 3000 });
      setTimeout(() => setToastState(null), 3000);
    }
  }, [toastState]);

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          ((language === 'ar' ? product.name : product.nameEn || product.name).toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.code.toLowerCase().includes(searchTerm.toLowerCase())) &&
          (filterDepartment === '' || product.department._id === filterDepartment)
      ),
    [products, searchTerm, filterDepartment, language]
  );

  const addToOrder = useCallback((product: Product) => {
    setOrderItems((prev) => {
      const existingItem = prev.find((item) => item.productId === product._id);
      if (existingItem) {
        return prev.map((item) =>
          item.productId === product._id
            ? { ...item, quantity: item.quantity + 1, unit: item.unit || product.unit || 'قطعة' }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product._id,
          product,
          quantity: 1,
          price: product.price,
          unit: product.unit || 'قطعة', // الوحدة الافتراضية
        },
      ];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromOrder(productId);
      return;
    }
    setOrderItems((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          // التحقق من الوحدات المتاحة بناءً على الكمية الجديدة
          const availableUnits = getUnitOptions(products, language, quantity).map((u) => u.value);
          const newUnit = availableUnits.includes(item.unit) ? item.unit : availableUnits[0] || 'قطعة';
          return { ...item, quantity, unit: newUnit };
        }
        return item;
      })
    );
  }, [products, language]);

  const updateUnit = useCallback((productId: string, unit: string) => {
    setOrderItems((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, unit } : item))
    );
  }, []);

  const removeFromOrder = useCallback((productId: string) => {
    setOrderItems((prev) => prev.filter((item) => item.productId !== productId));
  }, []);

  const clearOrder = useCallback(() => {
    setOrderItems([]);
    setNotes('');
    setPriority('medium');
    if (user?.role === 'admin') setBranch('');
    setToastState({ message: isRtl ? 'تم مسح الطلب' : 'Order cleared', type: 'success' });
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
          unit: item.unit, // إضافة الوحدة
        })),
        status: 'pending',
        notes: notes.trim() || undefined,
        priority,
        requestedDeliveryDate: new Date().toISOString(),
      };
      const response = await ordersAPI.create(orderData);
      socket.emit('newOrderFromBranch', response);
      setToastState({ message: isRtl ? 'تم إنشاء الطلب بنجاح' : 'Order created successfully', type: 'success' });
      setTimeout(() => navigate('/orders'), 1000);
    } catch (err: any) {
      setError(err.message || (isRtl ? 'خطأ في إنشاء الطلب' : 'Error creating order'));
      setToastState({ message: err.message || (isRtl ? 'خطأ في إنشاء الطلب' : 'Error creating order'), type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToSummary = () => {
    summaryRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (loading.products || loading.branches || loading.departments) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div
      className="mx-auto px-4 py-8 min-h-screen h-screen overflow-auto"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {toastState && (
        <div
          className={`fixed top-4 ${isRtl ? 'right-4' : 'left-4'} z-50 p-4 rounded-lg shadow-lg transition-all duration-300 ${
            toastState.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}
          role="alert"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">{toastState.message}</span>
            <button
              onClick={() => setToastState(null)}
              aria-label={isRtl ? 'إغلاق' : 'Close'}
              className="hover:opacity-80"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{isRtl ? 'تأكيد الطلب' : 'Confirm Order'}</h3>
            <p className="text-gray-600 text-sm mb-4">
              {isRtl ? 'هل أنت متأكد من إرسال الطلب؟' : 'Are you sure you want to submit the order?'}
            </p>
            <div className="max-h-64 overflow-y-auto space-y-3">
              <h4 className="font-semibold text-gray-800 text-sm">{isRtl ? 'ملخص الطلب' : 'Order Summary'}</h4>
              <ul className="space-y-2">
                {orderItems.map((item) => (
                  <li key={item.productId} className="flex justify-between text-sm text-gray-700">
                    <span>
                      {item.product.displayName} (x{item.quantity}) {item.unit ? ` - ${getDisplayUnit(item.unit, item.quantity, language)}` : ''}
                    </span>
                    <span>
                      {(item.price * item.quantity).toFixed(2)} {isRtl ? 'ريال' : 'SAR'}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 font-semibold text-gray-800 text-sm">
                <span>{isRtl ? 'الإجمالي النهائي' : 'Final Total'}: </span>
                <span className="text-teal-600">
                  {getTotalAmount} {isRtl ? 'ريال' : 'SAR'}
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full transition-colors text-sm"
                aria-label={isRtl ? 'إلغاء' : 'Cancel'}
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={confirmOrder}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-full transition-colors text-sm"
                disabled={submitting}
                aria-label={submitting ? (isRtl ? 'جاري الإرسال...' : 'Submitting...') : (isRtl ? 'تأكيد' : 'Confirm')}
              >
                {submitting ? (isRtl ? 'جاري الإرسال...' : 'Submitting...') : (isRtl ? 'تأكيد' : 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <ShoppingCart className="w-8 h-8 text-amber-600" />
          {isRtl ? 'إنشاء طلب جديد' : 'Create New Order'}
        </h1>
        <p className="text-gray-600 mt-2 text-sm">
          {isRtl ? 'قم بإضافة المنتجات وتأكيد الطلب لإرساله' : 'Add products and confirm to submit your order'}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 animate-pulse">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm">{error}</span>
        </div>
      )}

      {orderItems.length > 0 && (
        <div className={`lg:hidden fixed bottom-6 ${isRtl ? 'left-6' : 'right-6'} z-50`}>
          <button
            onClick={scrollToSummary}
            className="p-3 bg-amber-600 hover:bg-amber-700 text-white rounded-full shadow-lg transition-transform transform hover:scale-105"
            aria-label={isRtl ? 'التمرير للملخص' : 'Scroll to Summary'}
          >
            <ChevronDown className="w-6 h-6" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="p-6 bg-white rounded-2xl shadow-md">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder={isRtl ? 'ابحث عن المنتجات...' : 'Search products...'}
                  onChange={(e) => debouncedSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors text-sm"
                  aria-label={isRtl ? 'ابحث عن المنتجات' : 'Search products'}
                />
              </div>
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="w-full px-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors text-sm"
                aria-label={isRtl ? 'تصفية حسب القسم' : 'Filter by department'}
              >
                <option value="">{isRtl ? 'كل الأقسام' : 'All Departments'}</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {isRtl ? d.name : (d.nameEn || d.name)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {loading.products ? (
            <div className="p-6 text-center bg-white rounded-2xl shadow-md">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-600 mx-auto"></div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl shadow-md">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-sm">{isRtl ? 'لا توجد منتجات متاحة' : 'No products available'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((product) => {
                const cartItem = orderItems.find((item) => item.productId === product._id);
                // جلب الوحدات المتاحة بناءً على الكمية
                const unitOptions = getUnitOptions(products, language, cartItem?.quantity || 1);
                return (
                  <div
                    key={product._id}
                    className="p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-200"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="font-semibold text-gray-900 text-base truncate">
                          {product.displayName} {/* الاسم بيظهر باللغة الصحيحة */}
                        </h3>
                        <p className="text-xs text-gray-500">{product.code}</p>
                      </div>
                      <p className="text-sm text-amber-600">
                        {isRtl ? product.department.name : (product.department.nameEn || product.department.name)}
                      </p>
                      <p className="font-semibold text-gray-900 text-sm">
                        {product.price} {isRtl ? 'ريال' : 'SAR'} / {getDisplayUnit(product.unit || 'قطعة', cartItem?.quantity || 1, language)}
                      </p>
                      {product.description && (
                        <p className="text-xs text-gray-600 line-clamp-2">{product.description}</p>
                      )}
                      <div className="flex flex-col gap-2">
                        {cartItem ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateQuantity(product._id, cartItem.quantity - 1)}
                                className="w-8 h-8 bg-gray-200 rounded-full hover:bg-gray-300 transition-colors flex items-center justify-center"
                                aria-label={isRtl ? 'تقليل الكمية' : 'Decrease quantity'}
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="w-8 text-center font-medium text-md">{cartItem.quantity}</span>
                              <button
                                onClick={() => updateQuantity(product._id, cartItem.quantity + 1)}
                                className="w-8 h-8 bg-amber-600 rounded-full hover:bg-amber-700 transition-colors flex items-center justify-center"
                                aria-label={isRtl ? 'زيادة الكمية' : 'Increase quantity'}
                              >
                                <Plus className="w-4 h-4 text-white" />
                              </button>
                            </div>
                            <select
                              value={cartItem.unit}
                              onChange={(e) => updateUnit(product._id, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors text-sm"
                              aria-label={isRtl ? 'اختيار الوحدة' : 'Select unit'}
                            >
                              {unitOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToOrder(product)}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-full text-sm transition-colors"
                            aria-label={isRtl ? 'إضافة إلى السلة' : 'Add to Cart'}
                          >
                            {isRtl ? 'إضافة إلى السلة' : 'Add to Cart'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="mx-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full transition-colors text-sm"
                aria-label={isRtl ? 'السابق' : 'Previous'}
              >
                {isRtl ? 'السابق' : 'Previous'}
              </button>
              <span className="mx-4 self-center text-sm">
                {isRtl ? `الصفحة ${currentPage} من ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
              </span>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="mx-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full transition-colors text-sm"
                aria-label={isRtl ? 'التالي' : 'Next'}
              >
                {isRtl ? 'التالي' : 'Next'}
              </button>
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-8 space-y-4 max-h-[calc(100vh-2rem)] overflow-y-auto" ref={summaryRef}>
          <div className="p-6 bg-white rounded-2xl shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{isRtl ? 'ملخص الطلب' : 'Order Summary'}</h3>
            {orderItems.length === 0 ? (
              <p className="text-gray-600 text-center py-4 text-sm">{isRtl ? 'السلة فارغة' : 'Cart is empty'}</p>
            ) : (
              <div className="space-y-3">
                {orderItems.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">
                        {item.product.displayName}
                      </p>
                      <p className="text-xs text-gray-600">
                        {item.price} {isRtl ? 'ريال' : 'SAR'} / {getDisplayUnit(item.unit, item.quantity, language)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        className="w-8 h-8 bg-gray-200 rounded-full hover:bg-gray-300 transition-colors flex items-center justify-center"
                        aria-label={isRtl ? 'تقليل الكمية' : 'Decrease quantity'}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-medium text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        className="w-8 h-8 bg-amber-600 rounded-full hover:bg-amber-700 transition-colors flex items-center justify-center"
                        aria-label={isRtl ? 'زيادة الكمية' : 'Increase quantity'}
                      >
                        <Plus className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={() => removeFromOrder(item.productId)}
                        className="w-8 h-8 bg-red-500 rounded-full hover:bg-red-600 transition-colors flex items-center justify-center"
                        aria-label={isRtl ? 'إزالة المنتج' : 'Remove item'}
                      >
                        <Trash2 className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="border-t pt-3">
                  <div className="flex justify-between font-semibold text-gray-900 text-sm">
                    <span>{isRtl ? 'الإجمالي النهائي' : 'Final Total'}:</span>
                    <span className="text-teal-600">
                      {getTotalAmount} {isRtl ? 'ريال' : 'SAR'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="p-6 bg-white rounded-2xl shadow-md">
            <form onSubmit={handleSubmit} className="space-y-4">
              {user?.role === 'admin' && (
                <div>
                  <label htmlFor="branch" className="block text-sm font-medium text-gray-700 mb-1">
                    {isRtl ? 'الفرع' : 'Branch'}
                  </label>
                  <select
                    id="branch"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full px-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors text-sm"
                    aria-label={isRtl ? 'الفرع' : 'Branch'}
                    disabled={loading.branches}
                  >
                    <option value="">{isRtl ? 'اختر الفرع' : 'Select Branch'}</option>
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {isRtl ? b.name : (b.nameEn || b.name)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                  {isRtl ? 'الأولوية' : 'Priority'}
                </label>
                <select
                  id="priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors text-sm"
                  aria-label={isRtl ? 'الأولوية' : 'Priority'}
                >
                  {priorityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                  {isRtl ? 'ملاحظات' : 'Notes'}
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={isRtl ? 'أدخل ملاحظات الطلب...' : 'Enter order notes...'}
                  className="w-full px-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-y text-sm"
                  rows={4}
                  aria-label={isRtl ? 'ملاحظات' : 'Notes'}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={clearOrder}
                  className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full transition-colors text-sm"
                  disabled={submitting || orderItems.length === 0}
                  aria-label={isRtl ? 'مسح الطلب' : 'Clear Order'}
                >
                  {isRtl ? 'مسح الطلب' : 'Clear Order'}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-full transition-colors text-sm"
                  disabled={orderItems.length === 0 || submitting}
                  aria-label={submitting ? (isRtl ? 'جاري الإرسال...' : 'Submitting...') : (isRtl ? 'إرسال الطلب' : 'Submit Order')}
                >
                  {submitting ? (isRtl ? 'جاري الإرسال...' : 'Submitting...') : (isRtl ? 'إرسال الطلب' : 'Submit Order')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}