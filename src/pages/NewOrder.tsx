import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
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

const priorityOptions = [
  { value: 'low', labelAr: 'منخفض', labelEn: 'Low' },
  { value: 'medium', labelAr: 'متوسط', labelEn: 'Medium' },
  { value: 'high', labelAr: 'عالي', labelEn: 'High' },
  { value: 'urgent', labelAr: 'عاجل', labelEn: 'Urgent' },
];

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
  const [priority, setPriority] = useState('medium');
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
      setSearchTerm(value);
    }, 500),
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
    const quantity = parseInt(value, 10);
    if (value === '' || isNaN(quantity) || quantity <= 0) {
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
    setPriority('medium');
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
        priority,
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

  const CustomInput = ({ value, onChange, placeholder, ariaLabel }: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder: string; ariaLabel: string }) => (
    <div className="relative group">
      <button className={`absolute top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-amber-500 transition-colors w-4 h-4 ${isRtl ? 'left-3' : 'right-3'}`}>
        {value ? (
          <X onClick={() => {
            setSearchInput('');
            setSearchTerm('');
          }} aria-label={isRtl ? 'مسح البحث' : 'Clear search'} />
        ) : (
          <Search aria-hidden="true" />
        )}
      </button>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm text-xs placeholder-gray-400 ${isRtl ? 'pl-10 pr-4 text-right' : 'pr-10 pl-4 text-left'}`}
        aria-label={ariaLabel}
      />
    </div>
  );

  const CustomSelect = ({ value, onChange, children, ariaLabel, disabled = false }: { value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode; ariaLabel: string; disabled?: boolean }) => (
    <div className="relative group">
      <select
        value={value}
        onChange={onChange}
        className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm appearance-none text-xs text-gray-700 ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        {children}
      </select>
      <ChevronDown className={`absolute top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400 group-focus-within:text-amber-500 w-4 h-4 transition-colors ${isRtl ? 'left-3' : 'right-3'}`} />
    </div>
  );

  const CustomTextarea = ({ value, onChange, placeholder, ariaLabel }: { value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; placeholder: string; ariaLabel: string }) => (
    <div className="relative group">
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm resize-y text-xs placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}
        rows={4}
        aria-label={ariaLabel}
      />
    </div>
  );

  return (
    <div className="mx-auto px-4 py-6 min-h-screen overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="mb-4 flex flex-col items-center sm:flex-row sm:justify-start sm:items-center gap-2">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-6 h-6 text-amber-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">{isRtl ? 'إنشاء طلب جديد' : 'Create New Order'}</h1>
            <p className="text-gray-600 text-xs">
              {isRtl ? 'قم بإضافة المنتجات وتأكيد الطلب لإرساله' : 'Add products and confirm to submit your order'}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-red-600 text-xs">{error}</span>
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

      <div className={`space-y-3 ${orderItems.length > 0 ? 'lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0' : ''}`}>
        <div className={`${orderItems.length > 0 ? 'lg:col-span-2 lg:overflow-y-auto lg:max-h-[calc(100vh-4rem)] lg:scrollbar-hidden' : ''}`}>
          <div className="p-4 bg-white rounded-xl shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <CustomInput
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  debouncedSearch(e.target.value);
                }}
                placeholder={isRtl ? 'ابحث عن المنتجات...' : 'Search products...'}
                ariaLabel={isRtl ? 'ابحث عن المنتجات' : 'Search products'}
              />
              <CustomSelect
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                ariaLabel={isRtl ? 'تصفية حسب القسم' : 'Filter by department'}
              >
                <option value="">{isRtl ? 'كل الأقسام' : 'All Departments'}</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {isRtl ? d.name : (d.nameEn || d.name)}
                  </option>
                ))}
              </CustomSelect>
            </div>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="p-4 bg-white rounded-xl shadow-sm">
                  <div className="space-y-2 animate-pulse">
                    <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-2 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="p-6 text-center bg-white rounded-xl shadow-sm mt-3">
              <Package className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 text-xs">{isRtl ? 'لا توجد منتجات متاحة' : 'No products available'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
              {products.map((product) => {
                const cartItem = orderItems.find((item) => item.productId === product._id);
                return (
                  <div
                    key={product._id}
                    className="p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-semibold text-gray-900 text-sm truncate">
                          {product.displayName}
                        </h3>
                        <p className="text-xs text-gray-500">{product.code}</p>
                      </div>
                      <p className="text-xs text-amber-600">
                        {isRtl ? product.department.name : (product.department.nameEn || product.department.name)}
                      </p>
                      <p className="font-semibold text-gray-900 text-xs">
                        {product.price} {isRtl ? 'ريال' : 'SAR'} / {product.displayUnit}
                      </p>
                    </div>
                    <div className="mt-3 flex justify-end gap-1.5">
                      {cartItem ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updateQuantity(product._id, cartItem.quantity - 1)}
                            className="w-7 h-7 bg-gray-200 rounded-full hover:bg-gray-300 transition-colors flex items-center justify-center"
                            aria-label={isRtl ? 'تقليل الكمية' : 'Decrease quantity'}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            value={cartItem.quantity}
                            onChange={(e) => handleQuantityInput(product._id, e.target.value)}
                            className="w-10 h-7 text-center border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                            min="1"
                            aria-label={isRtl ? 'الكمية' : 'Quantity'}
                          />
                          <button
                            onClick={() => updateQuantity(product._id, cartItem.quantity + 1)}
                            className="w-7 h-7 bg-amber-600 rounded-full hover:bg-amber-700 transition-colors flex items-center justify-center"
                            aria-label={isRtl ? 'زيادة الكمية' : 'Increase quantity'}
                          >
                            <Plus className="w-3.5 h-3.5 text-white" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToOrder(product)}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors"
                          aria-label={isRtl ? 'إضافة إلى السلة' : 'Add to Cart'}
                        >
                          {isRtl ? 'إضافة إلى السلة' : 'Add to Cart'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {orderItems.length > 0 && (
          <div className="lg:col-span-1 lg:sticky lg:top-4 space-y-3 max-h-[calc(100vh-4rem)] overflow-y-auto scrollbar-hidden" ref={summaryRef}>
            <div className="p-4 bg-white rounded-xl shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-3">{isRtl ? 'ملخص الطلب' : 'Order Summary'}</h3>
              <div className="space-y-2">
                {orderItems.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-xs">
                        {item.product.displayName}
                      </p>
                      <p className="text-xs text-gray-600">
                        {item.price} {isRtl ? 'ريال' : 'SAR'} / {item.product.displayUnit}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        className="w-7 h-7 bg-gray-200 rounded-full hover:bg-gray-300 transition-colors flex items-center justify-center"
                        aria-label={isRtl ? 'تقليل الكمية' : 'Decrease quantity'}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleQuantityInput(item.productId, e.target.value)}
                        className="w-10 h-7 text-center border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        min="1"
                        aria-label={isRtl ? 'الكمية' : 'Quantity'}
                      />
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        className="w-7 h-7 bg-amber-600 rounded-full hover:bg-amber-700 transition-colors flex items-center justify-center"
                        aria-label={isRtl ? 'زيادة الكمية' : 'Increase quantity'}
                      >
                        <Plus className="w-3.5 h-3.5 text-white" />
                      </button>
                      <button
                        onClick={() => removeFromOrder(item.productId)}
                        className="w-7 h-7 bg-red-500 rounded-full hover:bg-red-600 transition-colors flex items-center justify-center"
                        aria-label={isRtl ? 'إزالة المنتج' : 'Remove item'}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="border-t pt-2">
                  <div className="flex justify-between font-semibold text-gray-900 text-xs">
                    <span>{isRtl ? 'الإجمالي النهائي' : 'Final Total'}:</span>
                    <span className="text-teal-600">
                      {getTotalAmount} {isRtl ? 'ريال' : 'SAR'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-white rounded-xl shadow-sm">
              <form onSubmit={handleSubmit} className="space-y-3">
                {user?.role === 'admin' && (
                  <div>
                    <label htmlFor="branch" className="block text-xs font-medium text-gray-700 mb-1">
                      {isRtl ? 'الفرع' : 'Branch'}
                    </label>
                    <CustomSelect
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      ariaLabel={isRtl ? 'الفرع' : 'Branch'}
                    >
                      <option value="">{isRtl ? 'اختر الفرع' : 'Select Branch'}</option>
                      {branches.map((b) => (
                        <option key={b._id} value={b._id}>
                          {isRtl ? b.name : (b.nameEn || b.name)}
                        </option>
                      ))}
                    </CustomSelect>
                  </div>
                )}
                <div>
                  <label htmlFor="priority" className="block text-xs font-medium text-gray-700 mb-1">
                    {isRtl ? 'الأولوية' : 'Priority'}
                  </label>
                  <CustomSelect
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    ariaLabel={isRtl ? 'الأولوية' : 'Priority'}
                  >
                    {priorityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {isRtl ? option.labelAr : option.labelEn}
                      </option>
                    ))}
                  </CustomSelect>
                </div>
                <div>
                  <label htmlFor="notes" className="block text-xs font-medium text-gray-700 mb-1">
                    {isRtl ? 'ملاحظات' : 'Notes'}
                  </label>
                  <CustomTextarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={isRtl ? 'أدخل ملاحظات الطلب...' : 'Enter order notes...'}
                    ariaLabel={isRtl ? 'ملاحظات' : 'Notes'}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={clearOrder}
                    className="flex-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs transition-colors"
                    disabled={submitting || orderItems.length === 0}
                    aria-label={isRtl ? 'مسح الطلب' : 'Clear Order'}
                  >
                    {isRtl ? 'مسح الطلب' : 'Clear Order'}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors"
                    disabled={orderItems.length === 0 || submitting}
                    aria-label={submitting ? (isRtl ? 'جاري الإرسال...' : 'Submitting...') : (isRtl ? 'إرسال الطلب' : 'Submit Order')}
                  >
                    {submitting ? (isRtl ? 'جاري الإرسال...' : 'Submitting...') : (isRtl ? 'إرسال الطلب' : 'Submit Order')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}