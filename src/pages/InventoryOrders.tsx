import React, { useReducer, useEffect, useMemo, useCallback, useRef, Suspense, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Card } from '../components/UI/Card';
import { Select } from '../components/UI/Select';
import { Button } from '../components/UI/Button';
import { Modal } from '../components/UI/Modal';
import { ProductSearchInput } from './OrdersTablePage';
import { ShoppingCart, AlertCircle, PlusCircle, Table2, Grid, Plus, MinusCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { factoryOrdersAPI, chefsAPI, productsAPI, departmentAPI, factoryInventoryAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { useOrderNotifications } from '../hooks/useOrderNotifications';
import { FactoryOrder, Chef, AssignChefsForm, Product, FactoryOrderItem, User } from '../types/types';
import Pagination from '../components/Shared/Pagination';
import AssignChefsModal from '../components/production/AssignChefsModal';
import OrderTable from '../components/production/OrderTable';
import OrderCard from '../components/production/OrderCard';
import OrderCardSkeleton from '../components/Shared/OrderCardSkeleton';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';
const translateUnit = (unit: string, isRtl: boolean) => {
  const translations: Record<string, { ar: string; en: string }> = {
    'كيلو': { ar: 'كيلو', en: 'kg' },
    'قطعة': { ar: 'قطعة', en: 'piece' },
    'علبة': { ar: 'علبة', en: 'pack' },
    'صينية': { ar: 'صينية', en: 'tray' },
    'kg': { ar: 'كجم', en: 'kg' },
    'piece': { ar: 'قطعة', en: 'piece' },
    'pack': { ar: 'علبة', en: 'pack' },
    'tray': { ar: 'صينية', en: 'tray' },
  };
  return translations[unit] ? (isRtl ? translations[unit].ar : translations[unit].en) : isRtl ? 'وحدة' : 'unit';
};
// مكون لإدخال الكمية مع أزرار زيادة ونقصان
const QuantityInput = ({
  value,
  onChange,
  onIncrement,
  onDecrement,
  max,
}: {
  value: number;
  onChange: (val: string) => void;
  onIncrement: () => void;
  onDecrement: () => void;
  max?: number;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';

  const handleChange = (val: string) => {
    const num = parseInt(val, 10);
    if (val === '' || isNaN(num) || num < 1) {
      onChange('1');
      return;
    }
    if (max !== undefined && num > max) {
      onChange(max.toString());
      return;
    }
    onChange(val);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onDecrement}
        className="w-7 h-7 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors duration-200 flex items-center justify-center disabled:opacity-50"
        aria-label={isRtl ? 'تقليل الكمية' : 'Decrease quantity'}
        disabled={value <= 1}
      >
        <MinusCircle className="w-4 h-4" />
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        max={max}
        min={1}
        className="w-10 h-7 text-center border border-gray-200 rounded-md text-xs focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm"
        aria-label={isRtl ? 'الكمية' : 'Quantity'}
      />
      <button
        onClick={onIncrement}
        className="w-7 h-7 bg-amber-600 hover:bg-amber-700 rounded-full transition-colors duration-200 flex items-center justify-center disabled:opacity-50"
        aria-label={isRtl ? 'زيادة الكمية' : 'Increase quantity'}
        disabled={max !== undefined && value >= max}
      >
        <Plus className="w-4 h-4 text-white" />
      </button>
    </div>
  );
};

// دالة لتطبيع النصوص العربية للبحث
const normalizeText = (text: string) => {
  return text
    .normalize('NFD')
    .replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, '')
    .replace(/أ|إ|آ|ٱ/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .trim();
};

// واجهة الحالة لمكون InventoryOrders
interface State {
  orders: FactoryOrder[];
  selectedOrder: FactoryOrder | null;
  chefs: Chef[];
  products: Product[];
  departments: { _id: string; displayName: string }[];
  isAssignModalOpen: boolean;
  isCreateModalOpen: boolean;
  assignFormData: AssignChefsForm;
  createFormData: { notes: string; items: { productId: string; quantity: number; assignedTo?: string }[] };
  filterStatus: string;
  filterDepartment: string;
  searchQuery: string;
  debouncedSearchQuery: string;
  sortBy: 'date' | 'totalQuantity';
  sortOrder: 'asc' | 'desc';
  currentPage: number;
  loading: boolean;
  error: string;
  submitting: string | null;
  socketConnected: boolean;
  socketError: string | null;
  viewMode: 'card' | 'table';
  formErrors: Record<string, string>;
}

// الحالة الابتدائية
const initialState: State = {
  orders: [],
  selectedOrder: null,
  chefs: [],
  products: [],
  departments: [],
  isAssignModalOpen: false,
  isCreateModalOpen: false,
  assignFormData: { items: [] },
  createFormData: { notes: '', items: [{ productId: '', quantity: 1 }] },
  filterStatus: '',
  filterDepartment: '',
  searchQuery: '',
  debouncedSearchQuery: '',
  sortBy: 'date',
  sortOrder: 'desc',
  currentPage: 1,
  loading: true,
  error: '',
  submitting: null,
  socketConnected: false,
  socketError: null,
  viewMode: 'card',
  formErrors: {},
};

// المخفض (Reducer) لإدارة الحالة
const reducer = (state: State, action: any): State => {
  switch (action.type) {
    case 'SET_ORDERS':
      return { ...state, orders: action.payload || [], error: '', currentPage: 1 };
    case 'ADD_ORDER':
      return { ...state, orders: [action.payload, ...state.orders.filter((o) => o.id !== action.payload.id)] };
    case 'SET_SELECTED_ORDER':
      return { ...state, selectedOrder: action.payload };
    case 'SET_CHEFS':
      return { ...state, chefs: action.payload || [] };
    case 'SET_PRODUCTS':
      return { ...state, products: action.payload || [] };
    case 'SET_DEPARTMENTS':
      return { ...state, departments: action.payload || [] };
    case 'SET_ASSIGN_MODAL':
      return { ...state, isAssignModalOpen: action.isOpen ?? false };
    case 'SET_CREATE_MODAL':
      return { ...state, isCreateModalOpen: action.isOpen ?? false };
    case 'SET_ASSIGN_FORM':
      return { ...state, assignFormData: action.payload };
    case 'SET_CREATE_FORM':
      return { ...state, createFormData: action.payload };
    case 'SET_FORM_ERRORS':
      return { ...state, formErrors: action.payload };
    case 'SET_FILTER_STATUS':
      return { ...state, filterStatus: action.payload, currentPage: 1 };
    case 'SET_FILTER_DEPARTMENT':
      return { ...state, filterDepartment: action.payload, currentPage: 1 };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload, currentPage: 1 };
    case 'SET_DEBOUNCED_SEARCH':
      return { ...state, debouncedSearchQuery: action.payload };
    case 'SET_SORT':
      return { ...state, sortBy: action.by ?? 'date', sortOrder: action.order ?? 'desc', currentPage: 1 };
    case 'SET_PAGE':
      return { ...state, currentPage: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_SUBMITTING':
      return { ...state, submitting: action.payload };
    case 'SET_SOCKET_CONNECTED':
      return { ...state, socketConnected: action.payload };
    case 'SET_SOCKET_ERROR':
      return { ...state, socketError: action.payload };
    case 'UPDATE_ORDER_STATUS':
      return {
        ...state,
        orders: state.orders.map((o) =>
          o.id === action.orderId ? { ...o, status: action.status! } : o
        ),
        selectedOrder:
          state.selectedOrder && state.selectedOrder.id === action.orderId
            ? { ...state.selectedOrder, status: action.status! }
            : state.selectedOrder,
      };
    case 'UPDATE_ITEM_STATUS':
      return {
        ...state,
        orders: state.orders.map((order) =>
          order.id === action.orderId
            ? {
                ...order,
                items: order.items.map((item) =>
                  item._id === action.payload.itemId ? { ...item, status: action.payload.status } : item
                ),
                status:
                  order.items.every((i) => i.status === 'completed') && order.status !== 'completed'
                    ? 'completed'
                    : order.status,
              }
            : order
        ),
        selectedOrder:
          state.selectedOrder && state.selectedOrder.id === action.orderId
            ? {
                ...state.selectedOrder,
                items: state.selectedOrder.items.map((item) =>
                  item._id === action.payload.itemId ? { ...item, status: action.payload.status } : item
                ),
                status:
                  state.selectedOrder.items.every((i) => i.status === 'completed') &&
                  state.selectedOrder.status !== 'completed'
                    ? 'completed'
                    : state.selectedOrder.status,
              }
            : state.selectedOrder,
      };
    case 'TASK_ASSIGNED':
      return {
        ...state,
        orders: state.orders.map((order) =>
          order.id === action.orderId
            ? {
                ...order,
                items: order.items.map((i) => {
                  const assignment = action.items?.find((a) => a._id === i._id);
                  return assignment
                    ? {
                        ...i,
                        assignedTo: assignment.assignedTo
                          ? {
                              _id: assignment.assignedTo._id,
                              username: assignment.assignedTo.username,
                              name: assignment.assignedTo.name || (isRtl ? 'غير معروف' : 'Unknown'),
                              nameEn: assignment.assignedTo.nameEn,
                              displayName: assignment.assignedTo.displayName || (isRtl ? assignment.assignedTo.name : assignment.assignedTo.nameEn || assignment.assignedTo.name),
                              department: assignment.assignedTo.department || {
                                _id: 'no-department',
                                name: isRtl ? 'غير معروف' : 'Unknown',
                                displayName: isRtl ? 'غير معروف' : 'Unknown',
                              },
                            }
                          : undefined,
                        status: assignment.status || i.status,
                      }
                    : i
                }),
                status: order.items.every((i) => i.status === 'assigned') ? 'in_production' : order.status,
              }
            : order
        ),
        selectedOrder:
          state.selectedOrder && state.selectedOrder.id === action.orderId
            ? {
                ...state.selectedOrder,
                items: state.selectedOrder.items.map((i) => {
                  const assignment = action.items?.find((a) => a._id === i._id);
                  return assignment
                    ? {
                        ...i,
                        assignedTo: assignment.assignedTo
                          ? {
                              _id: assignment.assignedTo._id,
                              username: assignment.assignedTo.username,
                              name: assignment.assignedTo.name || (isRtl ? 'غير معروف' : 'Unknown'),
                              nameEn: assignment.assignedTo.nameEn,
                              displayName: assignment.assignedTo.displayName || (isRtl ? assignment.assignedTo.name : assignment.assignedTo.nameEn || assignment.assignedTo.name),
                              department: assignment.assignedTo.department || {
                                _id: 'no-department',
                                name: isRtl ? 'غير معروف' : 'Unknown',
                                displayName: isRtl ? 'غير معروف' : 'Unknown',
                              },
                            }
                          : undefined,
                        status: assignment.status || i.status,
                      }
                    : i
                }),
                status: state.selectedOrder.items.every((i) => i.status === 'assigned')
                  ? 'in_production'
                  : state.selectedOrder.status,
              }
            : state.selectedOrder,
      };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload, currentPage: 1 };
    default:
      return state;
  }
};

// عدد الطلبات لكل صفحة حسب وضع العرض
const ORDERS_PER_PAGE = { card: 12, table: 50 };

// الانتقالات الصالحة لحالات الطلب
const validTransitions: Record<FactoryOrder['status'], FactoryOrder['status'][]> = {
  requested: ['approved', 'cancelled'],
  pending: ['approved', 'cancelled'],
  approved: ['in_production', 'cancelled'],
  in_production: ['completed', 'cancelled'],
  completed: ['stocked'],
  stocked: [],
  cancelled: [],
};

// خيارات تصفية الحالة
const statusOptions = [
  { value: '', label: 'all_statuses' },
  { value: 'requested', label: 'requested' },
  { value: 'pending', label: 'pending' },
  { value: 'approved', label: 'approved' },
  { value: 'in_production', label: 'in_production' },
  { value: 'completed', label: 'completed' },
  { value: 'stocked', label: 'stocked' },
  { value: 'cancelled', label: 'cancelled' },
];

// خيارات الترتيب
const sortOptions = [
  { value: 'date', label: 'sort_date' },
  { value: 'totalQuantity', label: 'sort_total_quantity' },
];

export const InventoryOrders: React.FC = () => {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { socket, isConnected, emit } = useSocket();
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  const listRef = useRef<HTMLDivElement>(null);
  const playNotificationSound = useOrderNotifications(dispatch, stateRef, user);
  const [searchInput, setSearchInput] = useState('');

  // دالة مساعدة للترجمة مع قيمة احتياطية
  const translate = useCallback(
    (key: string, fallback?: string) => {
      if (typeof t !== 'function') {
        console.warn(`[Translation Warning] t is not a function for key: ${key}`);
        return fallback || key;
      }
      try {
        return t(key) || fallback || key;
      } catch (err) {
        console.error(`[Translation Error] Failed to translate key: ${key}`, err);
        return fallback || key;
      }
    },
    [t]
  );

  // تحديث البحث المتأخر
  useEffect(() => {
    const handler = setTimeout(() => {
      dispatch({ type: 'SET_DEBOUNCED_SEARCH', payload: searchInput });
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // تحديث مرجع الحالة
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // حساب الكمية الإجمالية للطلب
  const calculateTotalQuantity = useCallback((order: FactoryOrder) => {
    return order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }, []);

  // جلب البيانات (الطلبات، الشيفات، المنتجات، الأقسام)
  const fetchData = useCallback(
    async (retryCount = 0) => {
      if (!user || !['chef', 'production', 'admin'].includes(user.role)) {
        dispatch({ type: 'SET_ERROR', payload: translate('unauthorized_access', isRtl ? 'غير مصرح للوصول' : 'Unauthorized access') });
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const query: Record<string, any> = {
          sortBy: state.sortBy,
          sortOrder: state.sortOrder,
          search: state.debouncedSearchQuery || undefined,
          lang: language,
        };

        const [ordersResponse, chefsResponse, departmentsResponse] = await Promise.all([
          factoryOrdersAPI.getAll(query).catch((err) => {
            console.error('خطأ في جلب الطلبات:', err.message);
            throw err;
          }),
          chefsAPI.getAll({ lang: language }).catch((err) => {
            console.error('خطأ في جلب الشيفات:', err.message);
            throw err;
          }),
          departmentAPI.getAll({ lang: language }).catch((err) => {
            console.error('خطأ في جلب الأقسام:', err.message);
            throw err;
          }),
        ]);

        // جلب جميع المنتجات عبر تصفح الصفحات
        let allProducts: Product[] = [];
        let page = 1;
        let totalPages = 1;
        do {
          const productsResponse = await productsAPI.getAll({ lang: language, page, limit: 50 }).catch((err) => {
            console.error(`خطأ في جلب المنتجات (صفحة ${page}):`, err.message);
            throw err;
          });
          allProducts = [...allProducts, ...(productsResponse.data || [])];
          totalPages = productsResponse.totalPages || 1;
          page++;
        } while (page <= totalPages);

        const ordersData = Array.isArray(ordersResponse.data) ? ordersResponse.data : [];
        const mappedOrders: FactoryOrder[] = ordersData
          .filter((order: any) => order && order._id && order.orderNumber)
          .map((order: any) => ({
            id: order._id,
            orderNumber: order.orderNumber,
            items: Array.isArray(order.items)
              ? order.items.map((item: any) => ({
                  _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
                  productId: item.product?._id || 'unknown',
                  productName: item.product?.name || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
                  productNameEn: item.product?.nameEn,
                  displayProductName: item.product?.displayName || (isRtl ? item.product?.name : item.product?.nameEn || item.product?.name) || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
                  quantity: Number(item.quantity) || 1,
                  unit: item.product?.unit || 'unit',
                  unitEn: item.product?.unitEn,
                  displayUnit: translateUnit(item.product?.unit || 'unit', isRtl),
                  department: {
                    _id: item.product?.department?._id || 'no-department',
                    name: item.product?.department?.name || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: item.product?.department?.nameEn,
                    displayName: item.product?.department?.displayName || (isRtl ? item.product?.department?.name : item.product?.department?.nameEn || item.product?.department?.name) || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
                  },
                  assignedTo: item.assignedTo
                    ? {
                        _id: item.assignedTo._id,
                        username: item.assignedTo.username,
                        name: item.assignedTo.name || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
                        nameEn: item.assignedTo.nameEn,
                        displayName: item.assignedTo.displayName || (isRtl ? item.assignedTo.name : item.assignedTo.nameEn || item.assignedTo.name) || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
                        department: {
                          _id: item.assignedTo.department?._id || 'no-department',
                          name: item.assignedTo.department?.name || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
                          nameEn: item.assignedTo.department?.nameEn,
                          displayName: item.assignedTo.department?.displayName || (isRtl ? item.assignedTo.department?.name : item.assignedTo.department?.nameEn || item.assignedTo.department?.name) || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
                        },
                      }
                    : undefined,
                  status: item.status || 'pending',
                }))
              : [],
            status: order.status || (order.createdBy?.role === 'chef' ? 'requested' : 'approved'),
            date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
            notes: order.notes || '',
            priority: order.priority || 'medium',
            createdBy: order.createdBy?.displayName || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
            createdByRole: order.createdBy?.role || 'unknown',
          }));
        dispatch({ type: 'SET_ORDERS', payload: mappedOrders });
        dispatch({
          type: 'SET_CHEFS',
          payload: Array.isArray(chefsResponse.data)
            ? chefsResponse.data
                .filter((chef: any) => chef && chef.user?._id)
                .map((chef: any) => ({
                  _id: chef._id,
                  userId: chef.user._id,
                  name: chef.user?.name || chef.name || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
                  nameEn: chef.user?.nameEn || chef.nameEn,
                  displayName: chef.user?.displayName || (isRtl ? chef.user?.name || chef.name : chef.user?.nameEn || chef.nameEn || chef.user?.name || chef.name) || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
                  department: chef.department
                    ? {
                        _id: chef.department._id || 'no-department',
                        name: chef.department.name || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
                        nameEn: chef.department.nameEn,
                        displayName: chef.department.displayName || (isRtl ? chef.department.name : chef.department.nameEn || chef.department.name) || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
                      }
                    : { _id: 'no-department', name: translate('unknown', isRtl ? 'غير معروف' : 'Unknown'), displayName: translate('unknown', isRtl ? 'غير معروف' : 'Unknown') },
                  status: chef.status || 'active',
                }))
            : [],
        });
        dispatch({
          type: 'SET_PRODUCTS',
          payload: Array.isArray(allProducts)
            ? allProducts
                .filter((product: any) => product && product._id)
                .map((product: any) => ({
                  _id: product._id,
                  name: product.name || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
                  nameEn: product.nameEn,
                  displayName: product.displayName || (isRtl ? product.name : product.nameEn || product.name) || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
                  unit: product.unit || 'unit',
                  unitEn: product.unitEn,
                  displayUnit: translateUnit(product.unit || 'unit', isRtl),
                  department: {
                    _id: product.department?._id || 'no-department',
                    name: product.department?.name || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: product.department?.nameEn,
                    displayName: product.department?.displayName || (isRtl ? product.department?.name : product.department?.nameEn || product.department?.name) || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
                  },
                  maxStockLevel: product.maxStockLevel || 1000,
                }))
                .sort((a: Product, b: Product) => {
                  const nameA = isRtl ? a.displayName : a.nameEn || a.name;
                  const nameB = isRtl ? b.displayName : b.nameEn || b.name;
                  return nameA.localeCompare(nameB, language);
                })
            : [],
        });
        dispatch({
          type: 'SET_DEPARTMENTS',
          payload: Array.isArray(departmentsResponse.data)
            ? departmentsResponse.data.map((d: any) => ({
                _id: d._id,
                displayName: d.displayName || (isRtl ? d.name : d.nameEn || d.name) || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
              }))
            : [],
        });
        dispatch({ type: 'SET_ERROR', payload: '' });
      } catch (err: any) {
        console.error('خطأ في جلب البيانات:', err.message);
        if (retryCount < 3) {
          setTimeout(() => fetchData(retryCount + 1), 2000);
          return;
        }
        const errorMessage =
          err.response?.status === 404
            ? translate('no_orders_found', isRtl ? 'لم يتم العثور على طلبات' : 'No orders found')
            : translate('error_fetching_orders', isRtl ? `خطأ في جلب الطلبات: ${err.message}` : `Error fetching orders: ${err.message}`);
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [user, state.sortBy, state.sortOrder, state.debouncedSearchQuery, isRtl, language, translate]
  );

  // جلب البيانات عند تحميل المكون
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // إعداد WebSocket لتحديثات الوقت الحقيقي
  useEffect(() => {
    if (!user || !['chef', 'production', 'admin'].includes(user.role) || !socket) {
      dispatch({ type: 'SET_ERROR', payload: translate('unauthorized_access', isRtl ? 'غير مصرح للوصول' : 'Unauthorized access') });
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }

    const reconnectInterval = setInterval(() => {
      if (!isConnected && socket) {
        console.log('محاولة إعادة الاتصال بـ WebSocket...');
        socket.connect();
      }
    }, 5000);

    socket.on('connect', () => {
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: true });
      dispatch({ type: 'SET_SOCKET_ERROR', payload: null });
    });

    socket.on('connect_error', (err) => {
      console.error('خطأ في اتصال WebSocket:', err.message);
      dispatch({ type: 'SET_SOCKET_ERROR', payload: translate('connection_error', isRtl ? 'خطأ في الاتصال' : 'Connection error') });
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: false });
    });

    socket.on('newFactoryOrder', (order: any) => {
      if (!order || !order._id || !order.orderNumber) {
        console.warn('بيانات طلب إنتاج جديد غير صالحة:', order);
        return;
      }
      const mappedOrder: FactoryOrder = {
        id: order._id,
        orderNumber: order.orderNumber,
        items: Array.isArray(order.items)
          ? order.items.map((item: any) => ({
              _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
              productId: item.product?._id || 'unknown',
              productName: item.product?.name || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
              productNameEn: item.product?.nameEn,
              displayProductName: item.product?.displayName || (isRtl ? item.product?.name : item.product?.nameEn || item.product?.name) || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
              quantity: Number(item.quantity) || 1,
              unit: item.product?.unit || 'unit',
              unitEn: item.product?.unitEn,
              displayUnit: translateUnit(item.product?.unit || 'unit', isRtl),
              department: {
                _id: item.product?.department?._id || 'no-department',
                name: item.product?.department?.name || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
                nameEn: item.product?.department?.nameEn,
                displayName: item.product?.department?.displayName || (isRtl ? item.product?.department?.name : item.product?.department?.nameEn || item.product?.department?.name) || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
              },
              assignedTo: item.assignedTo
                ? {
                    _id: item.assignedTo._id,
                    username: item.assignedTo.username,
                    name: item.assignedTo.name || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: item.assignedTo.nameEn,
                    displayName: item.assignedTo.displayName || (isRtl ? item.assignedTo.name : item.assignedTo.nameEn || item.assignedTo.name) || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
                    department: {
                      _id: item.assignedTo.department?._id || 'no-department',
                      name: item.assignedTo.department?.name || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
                      nameEn: item.assignedTo.department?.nameEn,
                      displayName: item.assignedTo.department?.displayName || (isRtl ? item.assignedTo.department?.name : item.assignedTo.department?.nameEn || item.assignedTo.department?.name) || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
                    },
                  }
                : undefined,
              status: item.status || 'pending',
            }))
          : [],
        status: order.status || (order.createdBy?.role === 'chef' ? 'requested' : 'approved'),
        date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
        notes: order.notes || '',
        priority: order.priority || 'medium',
        createdBy: order.createdBy?.displayName || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
        createdByRole: order.createdBy?.role || 'unknown',
      };
      dispatch({ type: 'ADD_ORDER', payload: mappedOrder });
      playNotificationSound('/sounds/notification.mp3', [200, 100, 200]);
      toast.success(translate('new_order', isRtl ? `طلب إنتاج جديد: ${order.orderNumber}` : `New production order: ${order.orderNumber}`), {
        position: isRtl ? 'top-left' : 'top-right',
      });
    });

    socket.on('orderStatusUpdated', ({ orderId, status }: { orderId: string; status: FactoryOrder['status'] }) => {
      if (!orderId || !status) {
        console.warn('بيانات تحديث حالة الطلب غير صالحة:', { orderId, status });
        return;
      }
      dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status });
      toast.info(translate('status_updated', isRtl ? `تم تحديث حالة الطلب ${orderId} إلى ${status}` : `Order ${orderId} status updated to ${status}`), {
        position: isRtl ? 'top-left' : 'top-right',
      });
    });

    socket.on('itemStatusUpdated', ({ orderId, itemId, status }: { orderId: string; itemId: string; status: FactoryOrderItem['status'] }) => {
      if (!orderId || !itemId || !status) {
        console.warn('بيانات تحديث حالة العنصر غير صالحة:', { orderId, itemId, status });
        return;
      }
      dispatch({ type: 'UPDATE_ITEM_STATUS', orderId, payload: { itemId, status } });
      toast.info(translate('item_status_updated', isRtl ? `تم تحديث حالة العنصر في الطلب ${orderId}` : `Item status updated in order ${orderId}`), {
        position: isRtl ? 'top-left' : 'top-right',
      });
    });

    socket.on('taskAssigned', ({ orderId, items }: { orderId: string; items: any[] }) => {
      if (!orderId || !items) {
        console.warn('بيانات تعيين المهام غير صالحة:', { orderId, items });
        return;
      }
      dispatch({ type: 'TASK_ASSIGNED', orderId, items });
      toast.info(translate('chefs_assigned', isRtl ? 'تم تعيين الشيفات' : 'Chefs assigned'), { position: isRtl ? 'top-left' : 'top-right' });
    });

    return () => {
      clearInterval(reconnectInterval);
      socket.off('connect');
      socket.off('connect_error');
      socket.off('newFactoryOrder');
      socket.off('orderStatusUpdated');
      socket.off('itemStatusUpdated');
      socket.off('taskAssigned');
    };
  }, [user, socket, isConnected, emit, isRtl, language, playNotificationSound, translate]);

  // التحقق من صحة نموذج إنشاء الطلب
  const validateCreateForm = useCallback(() => {
    const errors: Record<string, string> = {};
    const tMessages = {
      productRequired: translate('product_required', isRtl ? 'المنتج مطلوب' : 'Product is required'),
      quantityRequired: translate('quantity_required', isRtl ? 'الكمية مطلوبة' : 'Quantity is required'),
      quantityInvalid: translate('quantity_invalid', isRtl ? 'الكمية يجب أن تكون أكبر من 0' : 'Quantity must be greater than 0'),
      chefRequired: translate('chef_required', isRtl ? 'الشيف مطلوب' : 'Chef is required'),
    };

    state.createFormData.items.forEach((item, index) => {
      if (!item.productId) {
        errors[`item_${index}_productId`] = tMessages.productRequired;
      }
      if (!item.quantity || item.quantity < 1) {
        errors[`item_${index}_quantity`] = item.quantity === 0 ? tMessages.quantityRequired : tMessages.quantityInvalid;
      }
      if (['admin', 'production'].includes(user.role) && !item.assignedTo) {
        errors[`item_${index}_assignedTo`] = tMessages.chefRequired;
      }
    });

    dispatch({ type: 'SET_FORM_ERRORS', payload: errors });
    return Object.keys(errors).length === 0;
  }, [state.createFormData, isRtl, user.role, translate]);

  // إنشاء طلب إنتاج جديد
  const createOrder = useCallback(async () => {
    if (!user?.id || !validateCreateForm()) {
      toast.error(translate('invalid_form', isRtl ? 'البيانات غير صالحة' : 'Invalid form data'), {
        position: isRtl ? 'top-left' : 'top-right',
      });
      return;
    }

    dispatch({ type: 'SET_SUBMITTING', payload: 'create' });
    try {
      const orderNumber = `ORD-${Date.now()}`;
      const isAdminOrProduction = ['admin', 'production'].includes(user.role);
      const initialStatus = isAdminOrProduction && state.createFormData.items.every(i => i.assignedTo) ? 'in_production' : isAdminOrProduction ? 'pending' : 'requested';
      const items = state.createFormData.items.map((i) => ({
        product: i.productId,
        quantity: i.quantity,
        assignedTo: user.role === 'chef' ? user.id : i.assignedTo,
      })).filter(i => i.product && i.quantity > 0); // التأكد من صحة العناصر

      if (items.length === 0) {
        throw new Error(translate('no_valid_items', isRtl ? 'لا توجد عناصر صالحة' : 'No valid items'));
      }

      const response = await factoryOrdersAPI.create({
        orderNumber,
        items,
        notes: state.createFormData.notes,
        priority: 'medium',
      });

      const newOrder: FactoryOrder = {
        id: response.data._id,
        orderNumber: response.data.orderNumber,
        items: response.data.items.map((item: any) => ({
          _id: item._id,
          productId: item.product._id,
          productName: item.product.name || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
          productNameEn: item.product.nameEn,
          displayProductName: item.product.displayName || (isRtl ? item.product.name : item.product.nameEn || item.product.name) || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
          quantity: Number(item.quantity),
          unit: item.product.unit || 'unit',
          unitEn: item.product.unitEn,
          displayUnit: translateUnit(item.product.unit || 'unit', isRtl),
          department: {
            _id: item.product.department?._id || 'no-department',
            name: item.product.department?.name || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
            nameEn: item.product.department?.nameEn,
            displayName: item.product.department?.displayName || (isRtl ? item.product.department?.name : item.product.department?.nameEn || item.product.department?.name) || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
          },
          assignedTo: item.assignedTo
            ? {
                _id: item.assignedTo._id,
                username: item.assignedTo.username,
                name: item.assignedTo.name || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
                nameEn: item.assignedTo.nameEn,
                displayName: item.assignedTo.displayName || (isRtl ? item.assignedTo.name : item.assignedTo.nameEn || item.assignedTo.name) || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
                department: {
                  _id: item.assignedTo.department?._id || 'no-department',
                  name: item.assignedTo.department?.name || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
                  nameEn: item.assignedTo.department?.nameEn,
                  displayName: item.assignedTo.department?.displayName || (isRtl ? item.assignedTo.department?.name : item.assignedTo.department?.nameEn || item.assignedTo.department?.name) || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
                },
              }
            : undefined,
          status: item.status || 'pending',
        })),
        status: response.data.status || initialStatus,
        date: formatDate(new Date(response.data.createdAt), language),
        notes: response.data.notes || '',
        priority: response.data.priority || 'medium',
        createdBy: response.data.createdBy?.displayName || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
        createdByRole: response.data.createdBy?.role || 'unknown',
      };

      dispatch({ type: 'ADD_ORDER', payload: newOrder });
      dispatch({ type: 'SET_CREATE_MODAL', isOpen: false });
      dispatch({ type: 'SET_CREATE_FORM', payload: { notes: '', items: [{ productId: '', quantity: 1 }] } });
      dispatch({ type: 'SET_FORM_ERRORS', payload: {} });

      if (socket && isConnected) {
        emit('newFactoryOrder', newOrder);
      }

      toast.success(translate('order_created', isRtl ? 'تم إنشاء طلب الإنتاج بنجاح' : 'Production order created successfully'), {
        position: isRtl ? 'top-left' : 'top-right',
      });

      if (isAdminOrProduction && state.createFormData.items.some(i => !i.assignedTo)) {
        dispatch({ type: 'SET_SELECTED_ORDER', payload: newOrder });
        dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: true });
      }
    } catch (err: any) {
      console.error('خطأ في إنشاء الطلب:', err.message);
      const errorMessage = translate('failed_to_create_order', isRtl ? `فشل في إنشاء الطلب: ${err.message}` : `Failed to create order: ${err.message}`);
      dispatch({ type: 'SET_FORM_ERRORS', payload: { form: errorMessage } });
      toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right' });
    } finally {
      dispatch({ type: 'SET_SUBMITTING', payload: null });
    }
  }, [user, state.createFormData, isRtl, socket, isConnected, emit, language, validateCreateForm, translate]);

  // تحديث حالة الطلب
  const updateOrderStatus = useCallback(
    async (orderId: string, newStatus: FactoryOrder['status']) => {
      const order = state.orders.find((o) => o.id === orderId);
      if (!order || !validTransitions[order.status].includes(newStatus)) {
        toast.error(translate('invalid_transition', isRtl ? 'انتقال غير صالح' : 'Invalid transition'), { position: isRtl ? 'top-left' : 'top-right' });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        await factoryOrdersAPI.updateStatus(orderId, { status: newStatus });
        if (newStatus === 'stocked') {
          const items = order.items.map((item) => ({
            productId: item.productId,
            currentStock: item.quantity,
          })).filter(i => i.productId && i.currentStock > 0); // التأكد من صحة العناصر
          if (items.length === 0) {
            throw new Error(translate('no_valid_items_for_stock', isRtl ? 'لا توجد عناصر صالحة للتخزين' : 'No valid items for stocking'));
          }
          await factoryInventoryAPI.bulkCreate({
            userId: user.id,
            orderId,
            items,
          });
        }
        dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status: newStatus });
        if (socket && isConnected) {
          emit('orderStatusUpdated', { orderId, status: newStatus });
        }
        toast.success(translate('status_updated_to', isRtl ? `تم تحديث الحالة إلى: ${newStatus}` : `Order status updated to: ${newStatus}`), {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error('خطأ في تحديث حالة الطلب:', err.message);
        toast.error(translate('failed_to_update_status', isRtl ? `فشل في تحديث الحالة: ${err.message}` : `Failed to update status: ${err.message}`), {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [state.orders, isRtl, socket, isConnected, emit, user, translate]
  );

  // تأكيد إكمال إنتاج عنصر
  const confirmItemCompletion = useCallback(
    async (orderId: string, itemId: string) => {
      if (!user?.id || user.role !== 'chef') {
        toast.error(translate('not_authorized_to_confirm', isRtl ? 'غير مصرح بتأكيد الإنتاج' : 'Not authorized to confirm production'), {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      const order = state.orders.find((o) => o.id === orderId);
      if (!order) {
        toast.error(translate('order_not_found', isRtl ? 'الطلب غير موجود' : 'Order not found'), { position: isRtl ? 'top-left' : 'top-right' });
        return;
      }
      const item = order.items.find((i) => i._id === itemId);
      if (!item || item.assignedTo?._id !== user.id) {
        toast.error(translate('not_authorized_for_item', isRtl ? 'غير مصرح بتأكيد هذا العنصر' : 'Not authorized to confirm this item'), {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: itemId });
      try {
        await factoryOrdersAPI.updateItemStatus(orderId, itemId, { status: 'completed' });
        dispatch({ type: 'UPDATE_ITEM_STATUS', orderId, payload: { itemId, status: 'completed' } });
        if (socket && isConnected) {
          emit('itemStatusUpdated', { orderId, itemId, status: 'completed' });
        }
        toast.success(translate('production_confirmed', isRtl ? 'تم تأكيد إكمال الإنتاج' : 'Production completion confirmed'), {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error('خطأ في تأكيد إكمال الإنتاج:', err.message);
        toast.error(translate('failed_to_confirm_production', isRtl ? `فشل في تأكيد الإنتاج: ${err.message}` : `Failed to confirm production: ${err.message}`), {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [user, state.orders, isRtl, socket, isConnected, emit, translate]
  );

  // تعيين الشيفات
  const assignChefs = useCallback(
    async (orderId: string) => {
      if (!user?.id || state.assignFormData.items.some((item) => !item.assignedTo)) {
        toast.error(translate('assign_chef_to_each_item', isRtl ? 'يرجى تعيين شيف لكل عنصر' : 'Please assign a chef to each item'), {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        await factoryOrdersAPI.assignChefs(orderId, state.assignFormData);
        const items = state.assignFormData.items.map((item) => ({
          _id: item.itemId,
          assignedTo: state.chefs.find((chef) => chef.userId === item.assignedTo) || {
            _id: item.assignedTo,
            username: 'unknown',
            name: translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
            displayName: translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
            department: {
              _id: 'no-department',
              name: translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
              displayName: translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
            },
          },
          status: 'assigned' as FactoryOrderItem['status'],
        }));
        dispatch({ type: 'TASK_ASSIGNED', orderId, items });
        dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: false });
        dispatch({ type: 'SET_ASSIGN_FORM', payload: { items: [] } });
        if (socket && isConnected) {
          emit('taskAssigned', { orderId, items });
        }
        toast.success(translate('chefs_assigned_success', isRtl ? 'تم تعيين الشيفات بنجاح' : 'Chefs assigned successfully'), {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error('خطأ في تعيين الشيفات:', err.message);
        toast.error(translate('failed_to_assign_chefs', isRtl ? `فشل في تعيين الشيفات: ${err.message}` : `Failed to assign chefs: ${err.message}`), {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [user, state.assignFormData, state.chefs, socket, isConnected, emit, isRtl, translate]
  );

  // فتح نافذة تعيين الشيفات
  const openAssignModal = useCallback(
    async (order: FactoryOrder) => {
      if (order.createdByRole === 'chef') {
        toast.info(
          translate('order_auto_assigned', isRtl ? 'الطلب مُسند تلقائيًا للشيف الذي أنشأه' : 'Order is automatically assigned to the chef who created it'),
          { position: isRtl ? 'top-left' : 'top-right' }
        );
        return;
      }
      if (order.status !== 'approved') {
        toast.error(translate('order_not_approved', isRtl ? 'الطلب لم يتم الموافقة عليه' : 'Order not approved'), {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }

      try {
        // استخراج معرفات الأقسام من العناصر غير المعينة
        const departmentIds = [
          ...new Set(
            order.items
              .filter((item) => !item.assignedTo && item.department?._id && item.department._id !== 'no-department')
              .map((item) => item.department._id)
          ),
        ];

        if (departmentIds.length === 0) {
          toast.error(translate('no_valid_departments', isRtl ? 'لا توجد أقسام صالحة للعناصر' : 'No valid departments for items'), {
            position: isRtl ? 'top-left' : 'top-right',
          });
          return;
        }

        // جلب الشيفات المتاحين لكل قسم
        const chefsPromises = departmentIds.map((departmentId) =>
          factoryOrdersAPI.getAvailableChefs(departmentId).catch((err) => {
            console.error(`خطأ في جلب الشيفات للقسم ${departmentId}:`, err.message);
            return [];
          })
        );
        const chefsResponses = await Promise.all(chefsPromises);
        const chefs = chefsResponses.flatMap((response) => response || []);

        dispatch({ type: 'SET_CHEFS', payload: chefs });
        dispatch({ type: 'SET_SELECTED_ORDER', payload: order });
        dispatch({
          type: 'SET_ASSIGN_FORM',
          payload: {
            items: order.items
              .filter((item) => !item.assignedTo && item.department?._id && item.department._id !== 'no-department')
              .map((item) => ({
                itemId: item._id,
                assignedTo: '',
                product: item.displayProductName || translate('unknown', isRtl ? 'غير معروف' : 'Unknown'),
                quantity: item.quantity,
                unit: translateUnit(item.unit || 'unit', isRtl),
                departmentId: item.department._id,
              })),
          },
        });
        dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: true });
      } catch (error: any) {
        console.error(`[${new Date().toISOString()}] openAssignModal - خطأ:`, error.message);
        toast.error(
          translate('failed_to_fetch_chefs', isRtl ? 'فشل في جلب الشيفات المتاحين' : 'Failed to fetch available chefs'),
          { position: isRtl ? 'top-left' : 'top-right' }
        );
      }
    },
    [isRtl, translate]
  );

  // التعامل مع تغيير الصفحة
  const handlePageChange = useCallback((page: number) => {
    dispatch({ type: 'SET_PAGE', payload: page });
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // تصفية الطلبات
  const filteredOrders = useMemo(() => {
    const normalizedQuery = normalizeText(state.debouncedSearchQuery);
    return state.orders
      .filter((order) => order)
      .filter(
        (order) =>
          normalizeText(order.orderNumber || '').includes(normalizedQuery) ||
          normalizeText(order.notes || '').includes(normalizedQuery) ||
          normalizeText(order.createdBy || '').includes(normalizedQuery) ||
          order.items.some((item) => normalizeText(item.displayProductName || '').includes(normalizedQuery))
      )
      .filter(
        (order) =>
          (!state.filterStatus || order.status === state.filterStatus) &&
          (!state.filterDepartment || order.items.some((item) => item.department._id === state.filterDepartment)) &&
          (user?.role === 'production' && user?.department
            ? order.items.some((item) => item.department._id === user.department._id)
            : true) &&
          (user?.role === 'chef' ? order.items.some((item) => item.assignedTo?._id === user.id) : true)
      );
  }, [state.orders, state.debouncedSearchQuery, state.filterStatus, state.filterDepartment, user]);

  // ترتيب الطلبات
  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      if (state.sortBy === 'date') {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return state.sortOrder === 'asc'
          ? dateA.getTime() - dateB.getTime()
          : dateB.getTime() - dateA.getTime();
      } else {
        const totalA = calculateTotalQuantity(a);
        const totalB = calculateTotalQuantity(b);
        return state.sortOrder === 'asc' ? totalA - totalB : totalB - totalA;
      }
    });
  }, [filteredOrders, state.sortBy, state.sortOrder, calculateTotalQuantity]);

  // تقسيم الطلبات إلى صفحات
  const totalPages = useMemo(
    () => Math.ceil(sortedOrders.length / ORDERS_PER_PAGE[state.viewMode]),
    [sortedOrders, state.viewMode]
  );

  const paginatedOrders = useMemo(() => {
    const start = (state.currentPage - 1) * ORDERS_PER_PAGE[state.viewMode];
    const end = start + ORDERS_PER_PAGE[state.viewMode];
    return sortedOrders.slice(start, end);
  }, [sortedOrders, state.currentPage, state.viewMode]);

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto">
      <Suspense fallback={<OrderTableSkeleton isRtl={isRtl} />}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="mb-8"
        >
          <div
            className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 ${
              isRtl ? 'flex-row-reverse' : ''
            }`}
          >
            <div className="w-full sm:w-auto text-center sm:text-start">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center justify-center sm:justify-start gap-2">
                <ShoppingCart className="w-6 h-6 text-amber-600" />
                {translate('production_orders', isRtl ? 'طلبات الإنتاج' : 'Production Orders')}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {translate('manage_inventory_orders', isRtl ? 'إدارة طلبات إنتاج المخزون' : 'Manage inventory production orders')}
              </p>
            </div>
            <div className="flex gap-3 flex-wrap justify-center sm:justify-end w-full sm:w-auto">
              <Button
                variant="primary"
                onClick={() => dispatch({ type: 'SET_CREATE_MODAL', isOpen: true })}
                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-4 py-2 text-sm font-medium shadow transition-all duration-300"
              >
                <PlusCircle className="w-5 h-5" />
                {translate('create_new_order', isRtl ? 'إنشاء طلب جديد' : 'Create New Order')}
              </Button>
            </div>
          </div>
          <Card className="p-6 bg-white shadow-md rounded-xl border border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label
                  className={`block text-sm font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}
                >
                  {translate('search', isRtl ? 'البحث' : 'Search')}
                </label>
                <input
                  type="text"
                  value={state.searchQuery}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    dispatch({ type: 'SET_SEARCH_QUERY', payload: e.target.value });
                  }}
                  placeholder={translate('search_placeholder', isRtl ? 'ابحث حسب رقم الطلب أو الملاحظات' : 'Search by order number or notes')}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label
                  className={`block text-sm font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}
                >
                  {translate('status', isRtl ? 'الحالة' : 'Status')}
                </label>
                <Select
                  options={statusOptions.map((opt) => ({
                    value: opt.value,
                    label: translate(opt.label, opt.label),
                  }))}
                  value={state.filterStatus}
                  onChange={(value) => dispatch({ type: 'SET_FILTER_STATUS', payload: value })}
                  ariaLabel={translate('filter_by_status', isRtl ? 'تصفية حسب الحالة' : 'Filter by status')}
                  className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm"
                />
              </div>
              <div>
                <label
                  className={`block text-sm font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}
                >
                  {translate('department', isRtl ? 'القسم' : 'Department')}
                </label>
                <Select
                  options={[
                    { value: '', label: translate('all_departments', isRtl ? 'جميع الأقسام' : 'All Departments') },
                    ...state.departments.map((dept) => ({
                      value: dept._id,
                      label: dept.displayName,
                    })),
                  ]}
                  value={state.filterDepartment}
                  onChange={(value) => dispatch({ type: 'SET_FILTER_DEPARTMENT', payload: value })}
                  ariaLabel={translate('filter_by_department', isRtl ? 'تصفية حسب القسم' : 'Filter by department')}
                  className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm"
                />
              </div>
              <div>
                <label
                  className={`block text-sm font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}
                >
                  {translate('sort_by', isRtl ? 'ترتيب حسب' : 'Sort By')}
                </label>
                <Select
                  options={sortOptions.map((opt) => ({
                    value: opt.value,
                    label: translate(opt.label, opt.label),
                  }))}
                  value={state.sortBy}
                  onChange={(value) =>
                    dispatch({ type: 'SET_SORT', by: value, order: state.sortOrder })
                  }
                  ariaLabel={translate('sort_by', isRtl ? 'ترتيب حسب' : 'Sort by')}
                  className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm"
                />
              </div>
            </div>
            <div className={`flex items-center gap-2 mt-4 ${isRtl ? 'justify-end' : 'justify-start'}`}>
              <Button
                variant={state.viewMode === 'card' ? 'primary' : 'secondary'}
                onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'card' })}
                className={`p-2 rounded-lg ${state.viewMode === 'card' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                aria-label={translate('card_view', isRtl ? 'عرض البطاقات' : 'Card view')}
              >
                <Grid className="w-5 h-5" />
              </Button>
              <Button
                variant={state.viewMode === 'table' ? 'primary' : 'secondary'}
                onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'table' })}
                className={`p-2 rounded-lg ${state.viewMode === 'table' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                aria-label={translate('table_view', isRtl ? 'عرض الجدول' : 'Table view')}
              >
                <Table2 className="w-5 h-5" />
              </Button>
            </div>
          </Card>
        </motion.div>

        {state.loading ? (
          state.viewMode === 'card' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: ORDERS_PER_PAGE.card }).map((_, i) => (
                <OrderCardSkeleton key={i} isRtl={isRtl} />
              ))}
            </div>
          ) : (
            <OrderTableSkeleton isRtl={isRtl} />
          )
        ) : state.error ? (
          <div className="flex items-center justify-center gap-2 text-red-600">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm font-medium">{state.error}</p>
          </div>
        ) : paginatedOrders.length === 0 ? (
          <p className="text-center text-gray-600">{translate('no_orders_found', isRtl ? 'لا توجد طلبات' : 'No orders found')}</p>
        ) : (
          <div ref={listRef}>
            {state.viewMode === 'card' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onAssign={() => openAssignModal(order)}
                    onUpdateStatus={updateOrderStatus}
                    onConfirmCompletion={confirmItemCompletion}
                    isRtl={isRtl}
                    user={user as User}
                    isSubmitting={state.submitting === order.id}
                  />
                ))}
              </div>
            ) : (
              <OrderTable
                orders={paginatedOrders}
                onAssign={openAssignModal}
                onUpdateStatus={updateOrderStatus}
                onConfirmCompletion={confirmItemCompletion}
                isRtl={isRtl}
                user={user as User}
                isSubmitting={state.submitting}
              />
            )}
            <Pagination
              currentPage={state.currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              isRtl={isRtl}
              className="mt-6"
            />
          </div>
        )}

        <Modal
          isOpen={state.isCreateModalOpen}
          onClose={() => {
            dispatch({ type: 'SET_CREATE_MODAL', isOpen: false });
            dispatch({ type: 'SET_CREATE_FORM', payload: { notes: '', items: [{ productId: '', quantity: 1 }] } });
            dispatch({ type: 'SET_FORM_ERRORS', payload: {} });
          }}
          title={translate('create_new_production_order', isRtl ? 'إنشاء طلب إنتاج جديد' : 'Create New Production Order')}
          size="lg"
          className="bg-white rounded-xl shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div>
              <label
                className={`block text-sm font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}
              >
                {translate('notes', isRtl ? 'الملاحظات' : 'Notes')}
              </label>
              <textarea
                value={state.createFormData.notes}
                onChange={(e) =>
                  dispatch({
                    type: 'SET_CREATE_FORM',
                    payload: { ...state.createFormData, notes: e.target.value },
                  })
                }
                placeholder={translate('enter_notes', isRtl ? 'أدخل ملاحظات الطلب (اختياري)' : 'Enter order notes (optional)')}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                rows={3}
              />
            </div>
            <div>
              <label
                className={`block text-sm font-medium text-gray-700 mb-2 ${isRtl ? 'text-right' : 'text-left'}`}
              >
                {translate('items', isRtl ? 'العناصر' : 'Items')}
              </label>
              {state.createFormData.items.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4 p-4 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <div className="flex-1">
                    <ProductSearchInput
                      products={state.products}
                      value={item.productId}
                      onChange={(productId) => {
                        const newItems = [...state.createFormData.items];
                        newItems[index] = { ...newItems[index], productId };
                        dispatch({ type: 'SET_CREATE_FORM', payload: { ...state.createFormData, items: newItems } });
                      }}
                      placeholder={translate('search_product', isRtl ? 'ابحث عن منتج' : 'Search for a product')}
                      isRtl={isRtl}
                      error={state.formErrors[`item_${index}_productId`]}
                    />
                    {state.formErrors[`item_${index}_productId`] && (
                      <p className="text-xs text-red-600 mt-1">{state.formErrors[`item_${index}_productId`]}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <QuantityInput
                      value={item.quantity}
                      onChange={(value) => {
                        const newItems = [...state.createFormData.items];
                        newItems[index] = { ...newItems[index], quantity: parseInt(value) || 1 };
                        dispatch({ type: 'SET_CREATE_FORM', payload: { ...state.createFormData, items: newItems } });
                      }}
                      onIncrement={() => {
                        const newItems = [...state.createFormData.items];
                        newItems[index] = { ...newItems[index], quantity: newItems[index].quantity + 1 };
                        dispatch({ type: 'SET_CREATE_FORM', payload: { ...state.createFormData, items: newItems } });
                      }}
                      onDecrement={() => {
                        const newItems = [...state.createFormData.items];
                        newItems[index] = { ...newItems[index], quantity: Math.max(1, newItems[index].quantity - 1) };
                        dispatch({ type: 'SET_CREATE_FORM', payload: { ...state.createFormData, items: newItems } });
                      }}
                      max={
                        state.products.find((p) => p._id === item.productId)?.maxStockLevel
                      }
                    />
                    {state.formErrors[`item_${index}_quantity`] && (
                      <p className="text-xs text-red-600 mt-1">{state.formErrors[`item_${index}_quantity`]}</p>
                    )}
                  </div>
                  {['admin', 'production'].includes(user.role) && (
                    <div className="flex-1">
                      <Select
                        options={[
                          { value: '', label: translate('select_chef', isRtl ? 'اختر شيف' : 'Select Chef') },
                          ...state.chefs
                            .filter(
                              (chef) =>
                                chef.department._id ===
                                state.products.find((p) => p._id === item.productId)?.department._id
                            )
                            .map((chef) => ({
                              value: chef.userId || chef._id,
                              label: chef.displayName,
                            })),
                        ]}
                        value={item.assignedTo || ''}
                        onChange={(value) => {
                          const newItems = [...state.createFormData.items];
                          newItems[index] = { ...newItems[index], assignedTo: value };
                          dispatch({ type: 'SET_CREATE_FORM', payload: { ...state.createFormData, items: newItems } });
                        }}
                        ariaLabel={translate('select_chef', isRtl ? 'اختر شيف' : 'Select Chef')}
                        className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm"
                      />
                      {state.formErrors[`item_${index}_assignedTo`] && (
                        <p className="text-xs text-red-600 mt-1">{state.formErrors[`item_${index}_assignedTo`]}</p>
                      )}
                    </div>
                  )}
                  {state.createFormData.items.length > 1 && (
                    <button
                      onClick={() => {
                        const newItems = state.createFormData.items.filter((_, i) => i !== index);
                        dispatch({ type: 'SET_CREATE_FORM', payload: { ...state.createFormData, items: newItems } });
                      }}
                      className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1"
                      aria-label={translate('remove_item', isRtl ? 'إزالة العنصر' : 'Remove item')}
                    >
                      <MinusCircle className="w-4 h-4" />
                      {translate('remove', isRtl ? 'إزالة' : 'Remove')}
                    </button>
                  )}
                </div>
              ))}
              <Button
                variant="secondary"
                onClick={() => {
                  const newItems = [...state.createFormData.items, { productId: '', quantity: 1 }];
                  dispatch({ type: 'SET_CREATE_FORM', payload: { ...state.createFormData, items: newItems } });
                }}
                className="mt-2 flex items-center gap-2 text-amber-600 hover:text-amber-700"
                aria-label={translate('add_item', isRtl ? 'إضافة عنصر' : 'Add item')}
              >
                <Plus className="w-4 h-4" />
                {translate('add_item', isRtl ? 'إضافة عنصر' : 'Add item')}
              </Button>
              {state.formErrors.form && (
                <p className="text-xs text-red-600 mt-2">{state.formErrors.form}</p>
              )}
            </div>
            <div className={`flex gap-3 ${isRtl ? 'justify-start' : 'justify-end'}`}>
              <Button
                variant="secondary"
                onClick={() => {
                  dispatch({ type: 'SET_CREATE_MODAL', isOpen: false });
                  dispatch({ type: 'SET_CREATE_FORM', payload: { notes: '', items: [{ productId: '', quantity: 1 }] } });
                  dispatch({ type: 'SET_FORM_ERRORS', payload: {} });
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                {translate('cancel', isRtl ? 'إلغاء' : 'Cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={createOrder}
                disabled={state.submitting === 'create'}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
              >
                {state.submitting === 'create'
                  ? translate('submitting', isRtl ? 'جارٍ الإرسال...' : 'Submitting...')
                  : translate('create_order', isRtl ? 'إنشاء الطلب' : 'Create Order')}
              </Button>
            </div>
          </motion.div>
        </Modal>

        <AssignChefsModal
          isOpen={state.isAssignModalOpen}
          onClose={() => {
            dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: false });
            dispatch({ type: 'SET_ASSIGN_FORM', payload: { items: [] } });
            dispatch({ type: 'SET_FORM_ERRORS', payload: {} });
          }}
          order={state.selectedOrder}
          formData={state.assignFormData}
          chefs={state.chefs}
          onSubmit={assignChefs}
          isSubmitting={state.submitting === state.selectedOrder?.id}
          isRtl={isRtl}
          translate={translate}
        />
      </Suspense>
    </div>
  );
};
