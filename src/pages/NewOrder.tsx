import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { productsAPI, ordersAPI, branchesAPI, departmentAPI } from '../services/api';
import { ShoppingCart, Plus, Minus, Trash2, Package, AlertCircle, Search, X, ChevronDown } from 'lucide-react';
import { io } from 'socket.io-client';
import { debounce } from 'lodash';
import { toast } from 'react-toastify';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Modal } from '../components/UI/Modal';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { motion } from 'framer-motion';

interface Product {
  _id: string;
  name: string;
  nameEn?: string;
  code: string;
  department: { _id: string; name: string; nameEn?: string };
  price: number;
  unit: string;
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
      { value: 'low', label: t('orders.priority.low') },
      { value: 'medium', label: t('orders.priority.medium') },
      { value: 'high', label: t('orders.priority.high') },
      { value: 'urgent', label: t('orders.priority.urgent') },
    ],
    [t]
  );

  const socket = useMemo(() => io('https://eljoodia-server-production.up.railway.app'), []);

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchTerm(value);
      setCurrentPage(1); // Reset to first page on new search
    }, 300),
    []
  );

  useEffect(() => {
    if (!user || !['admin', 'branch'].includes(user.role)) {
      setError(t('orders.unauthorized'));
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
          displayUnit: language === 'ar' ? product.unit : (product.unitEn || product.unit),
        }));
        setProducts(productsWithDisplay);
        setTotalPages(productsResponse.totalPages);
        setBranches(
          Array.isArray(branchesResponse)
            ? branchesResponse.map((branch) => ({
                ...branch,
                displayName: language === 'ar' ? branch.name : (branch.nameEn || branch.name),
              }))
            : []
        );
        setDepartments(
          Array.isArray(departmentsResponse.data)
            ? departmentsResponse.data.map((dept) => ({
                ...dept,
                displayName: language === 'ar' ? dept.name : (dept.nameEn || dept.name),
              }))
            : []
        );
        if (user?.role === 'branch' && user?.branchId) {
          setBranch(user.branchId.toString());
        }
        setError('');
      } catch (err: any) {
        setError(err.message || t('orders.fetchError'));
      }
    };

    loadData();
  }, [t, user, navigate, filterDepartment, searchTerm, currentPage, language]);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to Socket.IO server');
    });
    socket.on('orderCreated', () => {
      setToastState({ message: t('orders.createdSuccess'), type: 'success' });
    });
    return () => {
      socket.disconnect();
    };
  }, [t, socket]);

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
          (product.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.code.toLowerCase().includes(searchTerm.toLowerCase())) &&
          (filterDepartment === '' || product.department._id === filterDepartment)
      ),
    [products, searchTerm, filterDepartment]
  );

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

  const removeFromOrder = useCallback((productId: string) => {
    setOrderItems((prev) => prev.filter((item) => item.productId !== productId));
  }, []);

  const clearOrder = useCallback(() => {
    setOrderItems([]);
    setNotes('');
    setPriority('medium');
    if (user?.role === 'admin') setBranch('');
    setToastState({ message: t('orders.cleared'), type: 'success' });
  }, [t, user]);

  const getTotalAmount = useMemo(
    () => orderItems.reduce((total, item) => total + item.price * item.quantity, 0).toFixed(2),
    [orderItems]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (orderItems.length === 0) {
        setError(t('orders.cartEmpty'));
        return;
      }
      if (!branch && user?.role === 'admin') {
        setError(t('orders.branchRequired'));
        return;
      }
      setShowConfirmModal(true);
    },
    [orderItems, branch, user, t]
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
      setToastState({ message: t('orders.createdSuccess'), type: 'success' });
      setTimeout(() => navigate('/orders'), 1000);
    } catch (err: any) {
      setError(err.message || t('orders.createError'));
      setToastState({ message: err.message || t('orders.createError'), type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToSummary = () => {
    summaryRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (loading.products || loading.branches || loading.departments) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div
      className="container mx-auto px-4 py-6 min-h-screen bg-gray-50"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Toast Notification */}
      {toastState && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`fixed top-4 ${isRtl ? 'right-4' : 'left-4'} z-50 p-4 rounded-lg shadow-lg transition-all duration-300 ${
            toastState.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}
          role="alert"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">{toastState.message}</span>
            <button
              onClick={() => setToastState(null)}
              aria-label={t('close')}
              className="hover:opacity-80"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Confirm Modal */}
      {showConfirmModal && (
        <Modal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          title={t('orders.confirmOrder')}
          size="md"
        >
          <p className="text-gray-600 text-sm mb-4">{t('orders.confirmMessage')}</p>
          <div className="max-h-64 overflow-y-auto space-y-3">
            <h4 className="font-semibold text-gray-800 text-sm">{t('orders.summary')}</h4>
            <ul className="space-y-2">
              {orderItems.map((item) => (
                <li key={item.productId} className="flex justify-between text-sm text-gray-700">
                  <span>
                    {item.product.displayName} (x{item.quantity})
                  </span>
                  <span>
                    {(item.price * item.quantity).toFixed(2)} {t('currency')}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 font-semibold text-gray-800 text-sm">
              <span>{t('orders.finalTotal')}: </span>
              <span className="text-teal-600">
                {getTotalAmount} {t('currency')}
              </span>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="secondary"
              onClick={() => setShowConfirmModal(false)}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md"
            >
              {t('cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={confirmOrder}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md"
              disabled={submitting}
            >
              {submitting ? t('orders.submitting') : t('confirm')}
            </Button>
          </div>
        </Modal>
      )}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <h1 className="text-3xl sm:text-4xl font-bold text-amber-900 flex items-center justify-center sm:justify-start gap-3">
          <ShoppingCart className="w-8 h-8 text-amber-600" />
          {t('orders.createNew')}
        </h1>
        {orderItems.length > 0 && (
          <Button
            variant="primary"
            onClick={scrollToSummary}
            className="lg:hidden bg-amber-600 hover:bg-amber-700 text-white rounded-md px-4 py-2 shadow-md transition-transform transform hover:scale-105"
          >
            {t('orders.scrollToSummary')}
          </Button>
        )}
      </motion.div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6 p-4 bg-red-100 border border-red-300 rounded-md flex items-center gap-2"
        >
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600">{error}</span>
        </motion.div>
      )}

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products Section */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4 bg-white rounded-md shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  value={searchTerm}
                  onChange={(value) => debouncedSearch(value)}
                  placeholder={t('products.searchPlaceholder')}
                  className="pl-10 border-gray-300 rounded-md focus:ring-amber-500"
                  aria-label={t('products.searchPlaceholder')}
                />
              </div>
              <Select
                label={t('products.department')}
                options={[{ value: '', label: t('products.allDepartments') }, ...departments.map((d) => ({ value: d._id, label: d.displayName }))]}
                value={filterDepartment}
                onChange={setFilterDepartment}
                className="border-gray-300 rounded-md focus:ring-amber-500"
                aria-label={t('products.department')}
              />
            </div>
          </Card>

          {loading.products ? (
            <Card className="p-6 text-center bg-white rounded-md shadow-sm">
              <LoadingSpinner size="md" />
            </Card>
          ) : filteredProducts.length === 0 ? (
            <Card className="p-6 text-center bg-white rounded-md shadow-sm">
              <Package className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-800">{t('products.noProducts')}</h3>
              <p className="text-gray-500">{t('products.noMatch')}</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((product) => {
                const cartItem = orderItems.find((item) => item.productId === product._id);
                return (
                  <Card key={product._id} className="bg-white rounded-md shadow-sm hover:shadow-md transition-shadow">
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="font-medium text-gray-800 text-base truncate">{product.displayName}</h3>
                        <p className="text-xs text-gray-500">{product.code}</p>
                      </div>
                      <p className="text-sm text-amber-600">{product.department.displayName}</p>
                      <p className="font-semibold text-gray-900 text-sm">
                        {product.price} {t('currency')} / {product.displayUnit}
                      </p>
                      {product.description && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{product.description}</p>
                      )}
                      <div className="flex justify-end gap-2 mt-3">
                        {cartItem ? (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => updateQuantity(product._id, cartItem.quantity - 1)}
                              className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center"
                              aria-label={t('orders.decreaseQuantity')}
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                            <span className="w-8 text-center font-medium text-sm">{cartItem.quantity}</span>
                            <Button
                              variant="primary"
                              onClick={() => updateQuantity(product._id, cartItem.quantity + 1)}
                              className="w-8 h-8 bg-amber-600 hover:bg-amber-700 rounded-full flex items-center justify-center"
                              aria-label={t('orders.increaseQuantity')}
                            >
                              <Plus className="w-4 h-4 text-white" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="primary"
                            onClick={() => addToOrder(product)}
                            className="bg-amber-600 hover:bg-amber-700 text-white rounded-md px-4 py-2"
                            aria-label={t('orders.addToCart')}
                          >
                            {t('orders.addToCart')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <Button
                variant="secondary"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="mx-2"
              >
                {t('previous')}
              </Button>
              <span className="mx-4 self-center">{t('page')} {currentPage} / {totalPages}</span>
              <Button
                variant="secondary"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="mx-2"
              >
                {t('next')}
              </Button>
            </div>
          )}
        </div>

        {/* Order Summary and Form (Sticky on Large Screens) */}
        <div className="lg:sticky lg:top-8 space-y-4 max-h-[calc(100vh-2rem)] overflow-y-auto" ref={summaryRef}>
          <Card className="p-6 bg-white rounded-md shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('orders.summary')}</h3>
            {orderItems.length === 0 ? (
              <p className="text-gray-600 text-center py-4 text-sm">{t('orders.cartEmpty')}</p>
            ) : (
              <div className="space-y-3">
                {orderItems.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">{item.product.displayName}</p>
                      <p className="text-xs text-gray-600">
                        {item.price} {t('currency')} / {item.product.displayUnit}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center"
                        aria-label={t('orders.decreaseQuantity')}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-8 text-center font-medium text-sm">{item.quantity}</span>
                      <Button
                        variant="primary"
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        className="w-8 h-8 bg-amber-600 hover:bg-amber-700 rounded-full flex items-center justify-center"
                        aria-label={t('orders.increaseQuantity')}
                      >
                        <Plus className="w-4 h-4 text-white" />
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => removeFromOrder(item.productId)}
                        className="w-8 h-8 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center"
                        aria-label={t('orders.removeItem')}
                      >
                        <Trash2 className="w-4 h-4 text-white" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="border-t pt-3">
                  <div className="flex justify-between font-semibold text-gray-900 text-sm">
                    <span>{t('orders.finalTotal')}:</span>
                    <span className="text-teal-600">
                      {getTotalAmount} {t('currency')}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-6 bg-white rounded-md shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              {user?.role === 'admin' && (
                <Select
                  label={t('orders.branch')}
                  options={[{ value: '', label: t('orders.selectBranch') }, ...branches.map((b) => ({ value: b._id, label: b.displayName }))]}
                  value={branch}
                  onChange={setBranch}
                  className="border-gray-300 rounded-md focus:ring-amber-500"
                  disabled={loading.branches}
                  aria-label={t('orders.branch')}
                />
              )}
              <Select
                label={t('orders.priority')}
                options={priorityOptions}
                value={priority}
                onChange={setPriority}
                className="border-gray-300 rounded-md focus:ring-amber-500"
                aria-label={t('orders.priority')}
              />
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('orders.notes')}
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('orders.notesPlaceholder')}
                  className="w-full px-3 py-3 border border-gray-200 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-y text-sm"
                  rows={4}
                  aria-label={t('orders.notes')}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={clearOrder}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md"
                  disabled={submitting || orderItems.length === 0}
                  aria-label={t('orders.clearOrder')}
                >
                  {t('orders.clearOrder')}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md"
                  disabled={orderItems.length === 0 || submitting}
                  aria-label={submitting ? t('orders.submitting') : t('orders.submitOrder')}
                >
                  {submitting ? t('orders.submitting') : t('orders.submitOrder')}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}