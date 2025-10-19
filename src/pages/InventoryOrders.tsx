import React, { useReducer, useEffect, useMemo, useCallback, useRef, Suspense, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Card } from '../components/UI/Card';
import { Select } from '../components/UI/Select';
import { Button } from '../components/UI/Button';
import { Modal } from '../components/UI/Modal';
import { ProductSearchInput, ProductDropdown } from './OrdersTablePage';
import { ShoppingCart, AlertCircle, PlusCircle, Table2, Grid, Plus, MinusCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { factoryOrdersAPI, productsAPI, departmentAPI, factoryInventoryAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { useOrderNotifications } from '../hooks/useOrderNotifications';
import { FactoryOrder, Chef, AssignChefsForm, Product, FactoryOrderItem, User } from '../types/types';
import Pagination from '../components/Shared/Pagination';
import AssignChefsModal from '../components/production/AssignChefsModal';
import OrderTable from '../components/production/OrderTable';
import OrderCard from '../components/production/OrderCard';
import OrderCardSkeleton from '../components/Shared/OrderCardSkeleton';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';
import { isValidObjectId } from '../services/api';

const QuantityInput: React.FC<{
  value: number;
  onChange: (val: string) => void;
  onIncrement: () => void;
  onDecrement: () => void;
  max?: number;
}> = ({ value, onChange, onIncrement, onDecrement, max }) => {
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

const normalizeText = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, '')
    .replace(/أ|إ|آ|ٱ/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .trim();
};

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
    case 'SET_PRODUCT':
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
                  const assignment = action.items?.find((a: any) => a._id === i._id);
                  return assignment
                    ? {
                        ...i,
                        assignedTo: assignment.assignedTo
                          ? {
                              _id: assignment.assignedTo._id,
                              username: assignment.assignedTo.username,
                              name: assignment.assignedTo.name,
                              nameEn: assignment.assignedTo.nameEn,
                              displayName: state.isRtl
                                ? assignment.assignedTo.name
                                : assignment.assignedTo.nameEn || assignment.assignedTo.name,
                              department: assignment.assignedTo.department,
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
                  const assignment = action.items?.find((a: any) => a._id === i._id);
                  return assignment
                    ? {
                        ...i,
                        assignedTo: assignment.assignedTo
                          ? {
                              _id: assignment.assignedTo._id,
                              username: assignment.assignedTo.username,
                              name: assignment.assignedTo.name,
                              nameEn: assignment.assignedTo.nameEn,
                              displayName: state.isRtl
                                ? assignment.assignedTo.name
                                : assignment.assignedTo.nameEn || assignment.assignedTo.name,
                              department: assignment.assignedTo.department,
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

const ORDERS_PER_PAGE = { card: 12, table: 50 };

const validTransitions: Record<FactoryOrder['status'], FactoryOrder['status'][]> = {
  requested: ['approved', 'cancelled'],
  pending: ['approved', 'cancelled'],
  approved: ['in_production', 'cancelled'],
  in_production: ['completed', 'cancelled'],
  completed: ['stocked'],
  stocked: [],
  cancelled: [],
};

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

const sortOptions = [
  { value: 'date', label: 'sort_date' },
  { value: 'totalQuantity', label: 'sort_total_quantity' },
];

const translateUnit = (unit: string, isRtl: boolean): string => {
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

const InventoryOrders: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { socket, isConnected, emit } = useSocket();
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef<State>(state);
  const listRef = useRef<HTMLDivElement>(null);
  const playNotificationSound = useOrderNotifications(dispatch, stateRef, user);
  const [searchInput, setSearchInput] = useState<string>('');

  useEffect(() => {
    const handler = setTimeout(() => {
      dispatch({ type: 'SET_DEBOUNCED_SEARCH', payload: searchInput });
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const calculateTotalQuantity = useCallback((order: FactoryOrder): number => {
    return order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }, []);

  const fetchData = useCallback(
    async (retryCount = 0) => {
      if (!user || !['chef', 'production', 'admin'].includes(user.role)) {
        dispatch({ type: 'SET_ERROR', payload: isRtl ? 'غير مصرح للوصول' : 'Unauthorized access' });
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

        const departmentId = user.department?._id || state.selectedOrder?.items[0]?.department?._id;
        const [ordersResponse, departmentsResponse, chefsResponse] = await Promise.all([
          factoryOrdersAPI.getAll(query),
          departmentAPI.getAll({ lang: language }),
          departmentId && isValidObjectId(departmentId)
            ? factoryOrdersAPI.getAvailableChefs(departmentId)
            : factoryOrdersAPI.getAvailableChefs(),
        ]);

        let allProducts: any[] = [];
        let page = 1;
        let totalPages = 1;
        do {
          const productsResponse = await productsAPI.getAll({ lang: language, page, limit: 50 });
          allProducts = [...allProducts, ...productsResponse.data];
          totalPages = productsResponse.totalPages;
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
                  productName: item.product?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                  productNameEn: item.product?.nameEn,
                  displayProductName: item.product?.displayName || (isRtl ? item.product?.name : item.product?.nameEn || item.product?.name),
                  quantity: Number(item.quantity) || 1,
                  unit: item.product?.unit || 'unit',
                  unitEn: item.product?.unitEn,
                  displayUnit: translateUnit(item.product?.unit || 'unit', isRtl),
                  department: {
                    _id: item.product?.department?._id || 'no-department',
                    name: item.product?.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: item.product?.department?.nameEn,
                    displayName: item.product?.department?.displayName || (isRtl ? item.product?.department?.name : item.product?.department?.nameEn || item.product?.department?.name),
                  },
                  assignedTo: item.assignedTo
                    ? {
                        _id: item.assignedTo._id,
                        username: item.assignedTo.username,
                        name: item.assignedTo.name || (isRtl ? 'غير معروف' : 'Unknown'),
                        nameEn: item.assignedTo.nameEn,
                        displayName: item.assignedTo.displayName || (isRtl ? item.assignedTo.name : item.assignedTo.nameEn || item.assignedTo.name),
                        department: {
                          _id: item.assignedTo.department?._id || 'no-department',
                          name: item.assignedTo.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                          nameEn: item.assignedTo.department?.nameEn,
                          displayName: item.assignedTo.department?.displayName || (isRtl ? item.assignedTo.department?.name : item.assignedTo.department?.nameEn || item.assignedTo.department?.name),
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
            createdBy: order.createdBy?.displayName || (isRtl ? 'غير معروف' : 'Unknown'),
            createdByRole: order.createdBy?.role || 'unknown',
          }));
        dispatch({ type: 'SET_ORDERS', payload: mappedOrders });
        dispatch({
          type: 'SET_CHEFS',
          payload: Array.isArray(chefsResponse)
            ? chefsResponse
                .filter((chef: any) => chef && chef._id)
                .map((chef: any) => ({
                  _id: chef._id,
                  userId: chef._id,
                  name: chef.name || (isRtl ? 'غير معروف' : 'Unknown'),
                  nameEn: chef.nameEn,
                  displayName: chef.displayName || (isRtl ? chef.name : chef.nameEn || chef.name),
                  department: chef.department
                    ? {
                        _id: chef.department._id || 'no-department',
                        name: chef.department.name || (isRtl ? 'غير معروف' : 'Unknown'),
                        nameEn: chef.department.nameEn,
                        displayName: chef.department.displayName || (isRtl ? chef.department.name : chef.department.nameEn || chef.department.name),
                      }
                    : { _id: 'no-department', name: isRtl ? 'غير معروف' : 'Unknown', displayName: isRtl ? 'غير معروف' : 'Unknown' },
                  status: chef.status || 'active',
                }))
            : [],
        });
        dispatch({
          type: 'SET_PRODUCT',
          payload: Array.isArray(allProducts)
            ? allProducts
                .filter((product: any) => product && product._id)
                .map((product: any) => ({
                  _id: product._id,
                  name: product.name || (isRtl ? 'غير معروف' : 'Unknown'),
                  nameEn: product.nameEn,
                  displayName: product.displayName || (isRtl ? product.name : product.nameEn || product.name),
                  unit: product.unit || 'unit',
                  unitEn: product.unitEn,
                  displayUnit: translateUnit(product.unit || 'unit', isRtl),
                  department: {
                    _id: product.department?._id || 'no-department',
                    name: product.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: product.department?.nameEn,
                    displayName: product.department?.displayName || (isRtl ? product.department?.name : product.department?.nameEn || product.department?.name),
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
                displayName: d.displayName || (isRtl ? d.name : d.nameEn || d.name),
              }))
            : [],
        });
        dispatch({ type: 'SET_ERROR', payload: '' });
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Fetch data error:`, err.message);
        if (retryCount < 3) {
          setTimeout(() => fetchData(retryCount + 1), 2000);
          return;
        }
        const errorMessage =
          err.response?.status === 404
            ? isRtl
              ? 'لم يتم العثور على طلبات'
              : 'No orders found'
            : isRtl
            ? `خطأ في جلب الطلبات: ${err.message}`
            : `Error fetching orders: ${err.message}`;
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [user, state.sortBy, state.sortOrder, state.debouncedSearchQuery, isRtl, language, state.selectedOrder]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!user || !['chef', 'production', 'admin'].includes(user.role) || !socket) {
      dispatch({ type: 'SET_ERROR', payload: isRtl ? 'غير مصرح للوصول' : 'Unauthorized access' });
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }

    const reconnectInterval = setInterval(() => {
      if (!isConnected && socket) {
        console.log(`[${new Date().toISOString()}] Attempting to reconnect WebSocket...`);
        socket.connect();
      }
    }, 5000);

    socket.on('connect', () => {
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: true });
      dispatch({ type: 'SET_SOCKET_ERROR', payload: null });
    });

    socket.on('connect_error', (err) => {
      console.error(`[${new Date().toISOString()}] Socket connect error:`, err.message);
      dispatch({ type: 'SET_SOCKET_ERROR', payload: isRtl ? 'خطأ في الاتصال' : 'Connection error' });
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: false });
    });

    socket.on('newFactoryOrder', (order: any) => {
      if (!order || !order._id || !order.orderNumber) {
        console.warn(`[${new Date().toISOString()}] Invalid new factory order data:`, order);
        return;
      }
      const mappedOrder: FactoryOrder = {
        id: order._id,
        orderNumber: order.orderNumber,
        items: Array.isArray(order.items)
          ? order.items.map((item: any) => ({
              _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
              productId: item.product?._id || 'unknown',
              productName: item.product?.name || (isRtl ? 'غير معروف' : 'Unknown'),
              productNameEn: item.product?.nameEn,
              displayProductName: item.product?.displayName || (isRtl ? item.product?.name : item.product?.nameEn || item.product?.name),
              quantity: Number(item.quantity) || 1,
              unit: item.product?.unit || 'unit',
              unitEn: item.product?.unitEn,
              displayUnit: translateUnit(item.product?.unit || 'unit', isRtl),
              department: {
                _id: item.product?.department?._id || 'no-department',
                name: item.product?.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                nameEn: item.product?.department?.nameEn,
                displayName: item.product?.department?.displayName || (isRtl ? item.product?.department?.name : item.product?.department?.nameEn || item.product?.department?.name),
              },
              assignedTo: item.assignedTo
                ? {
                    _id: item.assignedTo._id,
                    username: item.assignedTo.username,
                    name: item.assignedTo.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: item.assignedTo.nameEn,
                    displayName: item.assignedTo.displayName || (isRtl ? item.assignedTo.name : item.assignedTo.nameEn || item.assignedTo.name),
                    department: {
                      _id: item.assignedTo.department?._id || 'no-department',
                      name: item.assignedTo.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                      nameEn: item.assignedTo.department?.nameEn,
                      displayName: item.assignedTo.department?.displayName || (isRtl ? item.assignedTo.department?.name : item.assignedTo.department?.nameEn || item.assignedTo.department?.name),
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
        createdBy: order.createdBy?.displayName || (isRtl ? 'غير معروف' : 'Unknown'),
        createdByRole: order.createdBy?.role || 'unknown',
      };
      dispatch({ type: 'ADD_ORDER', payload: mappedOrder });
      playNotificationSound('/sounds/notification.mp3', [200, 100, 200]);
      toast.success(isRtl ? `طلب إنتاج جديد: ${order.orderNumber}` : `New production order: ${order.orderNumber}`, {
        position: isRtl ? 'top-left' : 'top-right',
      });
    });

    socket.on('orderStatusUpdated', ({ orderId, status }: { orderId: string; status: FactoryOrder['status'] }) => {
      if (!orderId || !status) {
        console.warn(`[${new Date().toISOString()}] Invalid order status update data:`, { orderId, status });
        return;
      }
      dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status });
      toast.info(isRtl ? `تم تحديث حالة الطلب ${orderId} إلى ${status}` : `Order ${orderId} status updated to ${status}`, {
        position: isRtl ? 'top-left' : 'top-right',
      });
    });

    socket.on('itemStatusUpdated', ({ orderId, itemId, status }: { orderId: string; itemId: string; status: FactoryOrderItem['status'] }) => {
      if (!orderId || !itemId || !status) {
        console.warn(`[${new Date().toISOString()}] Invalid item status update data:`, { orderId, itemId, status });
        return;
      }
      dispatch({ type: 'UPDATE_ITEM_STATUS', orderId, payload: { itemId, status } });
      toast.info(isRtl ? `تم تحديث حالة العنصر في الطلب ${orderId}` : `Item status updated in order ${orderId}`, {
        position: isRtl ? 'top-left' : 'top-right',
      });
    });

    socket.on('taskAssigned', ({ orderId, items }: { orderId: string; items: any[] }) => {
      if (!orderId || !items) {
        console.warn(`[${new Date().toISOString()}] Invalid task assigned data:`, { orderId, items });
        return;
      }
      dispatch({ type: 'TASK_ASSIGNED', orderId, items });
      toast.info(isRtl ? 'تم تعيين الشيفات' : 'Chefs assigned', { position: isRtl ? 'top-left' : 'top-right' });
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
  }, [user, socket, isConnected, isRtl, language, playNotificationSound]);

  const validateCreateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    const t = isRtl
      ? {
          productRequired: 'المنتج مطلوب',
          quantityRequired: 'الكمية مطلوبة',
          quantityInvalid: 'الكمية يجب أن تكون أكبر من 0',
          chefRequired: 'الشيف مطلوب',
        }
      : {
          productRequired: 'Product is required',
          quantityRequired: 'Quantity is required',
          quantityInvalid: 'Quantity must be greater than 0',
          chefRequired: 'Chef is required',
        };

    state.createFormData.items.forEach((item, index) => {
      if (!item.productId) {
        errors[`item_${index}_productId`] = t.productRequired;
      }
      if (!item.quantity || item.quantity < 1) {
        errors[`item_${index}_quantity`] = item.quantity === 0 ? t.quantityRequired : t.quantityInvalid;
      }
      if (['admin', 'production'].includes(user.role) && !item.assignedTo) {
        errors[`item_${index}_assignedTo`] = t.chefRequired;
      }
    });

    dispatch({ type: 'SET_FORM_ERRORS', payload: errors });
    return Object.keys(errors).length === 0;
  }, [state.createFormData, isRtl, user.role]);

  const createOrder = useCallback(async () => {
    if (!user?.id || !validateCreateForm()) {
      return;
    }

    dispatch({ type: 'SET_SUBMITTING', payload: 'create' });
    try {
      const orderNumber = `ORD-${Date.now()}`;
      const isAdminOrProduction = ['admin', 'production'].includes(user.role);
      const initialStatus = isAdminOrProduction && state.createFormData.items.every((i) => i.assignedTo) ? 'in_production' : isAdminOrProduction ? 'pending' : 'requested';
      const items = state.createFormData.items.map((i) => ({
        product: i.productId,
        quantity: i.quantity,
        assignedTo: user.role === 'chef' ? user.id : i.assignedTo,
      }));

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
          productName: item.product.name,
          productNameEn: item.product.nameEn,
          displayProductName: item.product.displayName || (isRtl ? item.product.name : item.product.nameEn || item.product.name),
          quantity: Number(item.quantity),
          unit: item.product.unit,
          unitEn: item.product.unitEn,
          displayUnit: translateUnit(item.product.unit, isRtl),
          department: {
            _id: item.product.department._id,
            name: item.product.department.name,
            nameEn: item.product.department.nameEn,
            displayName: item.product.department.displayName || (isRtl ? item.product.department.name : item.product.department.nameEn || item.product.department.name),
          },
          assignedTo: item.assignedTo
            ? {
                _id: item.assignedTo._id,
                username: item.assignedTo.username,
                name: item.assignedTo.name,
                nameEn: item.assignedTo.nameEn,
                displayName: item.assignedTo.displayName || (isRtl ? item.assignedTo.name : item.assignedTo.nameEn || item.assignedTo.name),
                department: {
                  _id: item.assignedTo.department._id,
                  name: item.assignedTo.department.name,
                  nameEn: item.assignedTo.department.nameEn,
                  displayName: item.assignedTo.department.displayName || (isRtl ? item.assignedTo.department.name : item.assignedTo.department.nameEn || item.assignedTo.department.name),
                },
              }
            : undefined,
          status: item.status || 'pending',
        })),
        status: response.data.status || initialStatus,
        date: formatDate(new Date(response.data.createdAt), language),
        notes: response.data.notes || '',
        priority: response.data.priority || 'medium',
        createdBy: response.data.createdBy?.displayName || (isRtl ? 'غير معروف' : 'Unknown'),
        createdByRole: response.data.createdBy?.role || 'unknown',
      };

      dispatch({ type: 'ADD_ORDER', payload: newOrder });
      dispatch({ type: 'SET_CREATE_MODAL', isOpen: false });
      dispatch({ type: 'SET_CREATE_FORM', payload: { notes: '', items: [{ productId: '', quantity: 1 }] } });
      dispatch({ type: 'SET_FORM_ERRORS', payload: {} });

      if (socket && isConnected) {
        emit('newFactoryOrder', newOrder);
      }

      toast.success(isRtl ? 'تم إنشاء طلب الإنتاج بنجاح' : 'Production order created successfully', {
        position: isRtl ? 'top-left' : 'top-right',
      });

      if (isAdminOrProduction && state.createFormData.items.some((i) => !i.assignedTo)) {
        dispatch({ type: 'SET_SELECTED_ORDER', payload: newOrder });
        dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: true });
      }
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Create order error:`, err.message);
      const errorMessage = isRtl ? `فشل في إنشاء الطلب: ${err.message}` : `Failed to create order: ${err.message}`;
      dispatch({ type: 'SET_FORM_ERRORS', payload: { form: errorMessage } });
      toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right' });
    } finally {
      dispatch({ type: 'SET_SUBMITTING', payload: null });
    }
  }, [user, state.createFormData, isRtl, socket, isConnected, emit, language, validateCreateForm]);

  const updateOrderStatus = useCallback(
    async (orderId: string, newStatus: FactoryOrder['status']) => {
      const order = state.orders.find((o) => o.id === orderId);
      if (!order || !validTransitions[order.status].includes(newStatus)) {
        toast.error(isRtl ? 'انتقال غير صالح' : 'Invalid transition', { position: isRtl ? 'top-left' : 'top-right' });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        await factoryOrdersAPI.updateStatus(orderId, { status: newStatus });
        if (newStatus === 'stocked') {
          const items = order.items.map((item) => ({
            productId: item.productId,
            currentStock: item.quantity,
          }));
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
        toast.success(isRtl ? `تم تحديث الحالة إلى: ${newStatus}` : `Order status updated to: ${newStatus}`, {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Update order status error:`, err.message);
        toast.error(isRtl ? `فشل في تحديث الحالة: ${err.message}` : `Failed to update status: ${err.message}`, {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [state.orders, isRtl, socket, isConnected, emit, user]
  );

  const confirmItemCompletion = useCallback(
    async (orderId: string, itemId: string) => {
      if (!user?.id || user.role !== 'chef') {
        toast.error(isRtl ? 'غير مصرح بتأكيد الإنتاج' : 'Not authorized to confirm production', {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      const order = state.orders.find((o) => o.id === orderId);
      if (!order) {
        toast.error(isRtl ? 'الطلب غير موجود' : 'Order not found', { position: isRtl ? 'top-left' : 'top-right' });
        return;
      }
      const item = order.items.find((i) => i._id === itemId);
      if (!item || item.assignedTo?._id !== user.id) {
        toast.error(isRtl ? 'غير مصرح بتأكيد هذا العنصر' : 'Not authorized to confirm this item', {
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
        toast.success(isRtl ? 'تم تأكيد إكمال الإنتاج' : 'Production completion confirmed', {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Confirm item completion error:`, err.message);
        toast.error(isRtl ? `فشل في تأكيد الإنتاج: ${err.message}` : `Failed to confirm production: ${err.message}`, {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [user, state.orders, isRtl, socket, isConnected, emit]
  );

  const assignChefs = useCallback(
    async (orderId: string) => {
      if (!user?.id || !state.selectedOrder || state.assignFormData.items.some((item) => !item.assignedTo)) {
        toast.error(isRtl ? 'يرجى تعيين شيف لكل عنصر' : 'Please assign a chef to each item', {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        const payload = {
          items: state.assignFormData.items.map((item) => ({
            itemId: item.itemId,
            assignedTo: item.assignedTo,
          })),
        };
        await factoryOrdersAPI.assignChefs(orderId, payload);
        const items = state.assignFormData.items.map((item) => ({
          _id: item.itemId,
          assignedTo: state.chefs.find((chef) => chef.userId === item.assignedTo) || {
            _id: item.assignedTo,
            username: 'unknown',
            name: isRtl ? 'غير معروف' : 'Unknown',
            displayName: isRtl ? 'غير معروف' : 'Unknown',
            department: {
              _id: 'no-department',
              name: isRtl ? 'غير معروف' : 'Unknown',
              displayName: isRtl ? 'غير معروف' : 'Unknown',
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
        toast.success(isRtl ? 'تم تعيين الشيفات بنجاح' : 'Chefs assigned successfully', {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Assign chefs error:`, err.message);
        toast.error(isRtl ? `فشل في تعيين الشيفات: ${err.message}` : `Failed to assign chefs: ${err.message}`, {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [user, state.assignFormData, state.chefs, socket, isConnected, emit, isRtl, state.selectedOrder]
  );

  const openAssignModal = useCallback(
    async (order: FactoryOrder) => {
      if (!order || !order.items || order.items.length === 0) {
        toast.error(isRtl ? 'لا توجد عناصر لتعيين الشيفات' : 'No items available for chef assignment', {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      if (order.createdByRole === 'chef') {
        toast.info(isRtl ? 'الطلب مُسند تلقائيًا للشيف الذي أنشأه' : 'Order is automatically assigned to the chef who created it', {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      if (order.status !== 'approved') {
        toast.error(isRtl ? 'الطلب لم يتم الموافقة عليه' : 'Order not approved', {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      const departmentIds = Array.from(
        new Set(
          order.items
            .map((item) => item.department?._id)
            .filter((id): id is string => !!id && id !== 'no-department' && isValidObjectId(id))
        )
      );
      if (departmentIds.length === 0) {
        toast.error(isRtl ? 'لا يوجد أقسام مُعرفة للعناصر' : 'No departments defined for items', {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const responses = await Promise.all(
          departmentIds.map((deptId) =>
            factoryOrdersAPI.getAvailableChefs(deptId).catch((err) => {
              console.error(`[${new Date().toISOString()}] Error fetching chefs for department ${deptId}:`, err.message);
              return { data: [] };
            })
          )
        );
        const allChefs = responses.flatMap((res) => res.data || []);
        dispatch({
          type: 'SET_CHEFS',
          payload: allChefs
            .filter((chef: any) => chef && chef._id)
            .map((chef: any) => ({
              _id: chef._id,
              userId: chef._id,
              name: chef.name || (isRtl ? 'غير معروف' : 'Unknown'),
              nameEn: chef.nameEn,
              displayName: chef.displayName || (isRtl ? chef.name : chef.nameEn || chef.name),
              department: chef.department
                ? {
                    _id: chef.department._id || 'no-department',
                    name: chef.department.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: chef.department.nameEn,
                    displayName: chef.department.displayName || (isRtl ? chef.department.name : chef.department.nameEn || chef.department.name),
                  }
                : { _id: 'no-department', name: isRtl ? 'غير معروف' : 'Unknown', displayName: isRtl ? 'غير معروف' : 'Unknown' },
              status: chef.status || 'active',
            })),
        });
        dispatch({ type: 'SET_SELECTED_ORDER', payload: order });
        dispatch({
          type: 'SET_ASSIGN_FORM',
          payload: {
            items: order.items
              .filter((item) => !item.assignedTo && item.department?._id && item.department._id !== 'no-department')
              .map((item) => ({
                itemId: item._id,
                assignedTo: '',
                product: item.displayProductName,
                quantity: item.quantity,
                unit: translateUnit(item.unit, isRtl),
                departmentId: item.department._id,
              })),
          },
        });
        dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: true });
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Error fetching chefs for departments:`, err.message);
        toast.error(isRtl ? `فشل في جلب الشيفات: ${err.message}` : `Failed to fetch chefs: ${err.message}`, {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [isRtl, language]
  );

  const handlePageChange = useCallback((page: number) => {
    dispatch({ type: 'SET_PAGE', payload: page });
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

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

  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      if (state.sortBy === 'date') {
        return state.sortOrder === 'asc'
          ? new Date(a.date).getTime() - new Date(b.date).getTime()
          : new Date(b.date).getTime() - new Date(a.date).getTime();
      } else {
        const totalA = calculateTotalQuantity(a);
        const totalB = calculateTotalQuantity(b);
        return state.sortOrder === 'asc' ? totalA - totalB : totalB - totalA;
      }
    });
  }, [filteredOrders, state.sortBy, state.sortOrder, calculateTotalQuantity]);

  const paginatedOrders = useMemo(
    () =>
      sortedOrders.slice(
        (state.currentPage - 1) * ORDERS_PER_PAGE[state.viewMode],
        state.currentPage * ORDERS_PER_PAGE[state.viewMode]
      ),
    [sortedOrders, state.currentPage, state.viewMode]
  );

  const totalPages = useMemo(
    () => Math.ceil(sortedOrders.length / ORDERS_PER_PAGE[state.viewMode]),
    [sortedOrders, state.viewMode]
  );

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto">
      <Suspense fallback={<OrderTableSkeleton isRtl={isRtl} />}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }} className="mb-8">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div className="w-full sm:w-auto text-center sm:text-start">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center justify-center sm:justify-start gap-2">
                <ShoppingCart className="w-6 h-6 text-amber-600" />
                {isRtl ? 'طلبات الإنتاج' : 'Production Orders'}
              </h1>
              <p className="text-sm text-gray-600 mt-1">{isRtl ? 'إدارة طلبات إنتاج المخزون' : 'Manage inventory production orders'}</p>
            </div>
            <div className="flex gap-3 flex-wrap justify-center sm:justify-end w-full sm:w-auto">
              <Button
                variant="primary"
                onClick={() => dispatch({ type: 'SET_CREATE_MODAL', isOpen: true })}
                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-4 py-2 text-sm font-medium shadow transition-all duration-300"
              >
                <PlusCircle className="w-5 h-5" />
                {isRtl ? 'إنشاء طلب جديد' : 'Create New Order'}
              </Button>
            </div>
          </div>
          <Card className="p-6 bg-white shadow-md rounded-xl border border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className={`block text-sm font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}>
                  {isRtl ? 'بحث' : 'Search'}
                </label>
                <ProductSearchInput
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={isRtl ? 'ابحث حسب رقم الطلب أو المنتج...' : 'Search by order number or product...'}
                  ariaLabel={isRtl ? 'بحث' : 'Search'}
                  className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm transition-all duration-200"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}>
                  {isRtl ? 'تصفية حسب الحالة' : 'Filter by Status'}
                </label>
                <ProductDropdown
                  options={statusOptions.map((opt) => ({
                    value: opt.value,
                    label: isRtl
                      ? {
                          '': 'كل الحالات',
                          requested: 'مطلوب',
                          pending: 'قيد الانتظار',
                          approved: 'تم الموافقة',
                          in_production: 'في الإنتاج',
                          completed: 'مكتمل',
                          stocked: 'مخزن',
                          cancelled: 'ملغى',
                        }[opt.value]
                      : opt.label,
                  }))}
                  value={state.filterStatus}
                  onChange={(value) => dispatch({ type: 'SET_FILTER_STATUS', payload: value })}
                  ariaLabel={isRtl ? 'تصفية حسب الحالة' : 'Filter by Status'}
                  className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm transition-all duration-200"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}>
                  {isRtl ? 'تصفية حسب القسم' : 'Filter by Department'}
                </label>
                <ProductDropdown
                  options={[
                    { value: '', label: isRtl ? 'كل الأقسام' : 'All Departments' },
                    ...state.departments.map((dept) => ({
                      value: dept._id,
                      label: dept.displayName,
                    })),
                  ]}
                  value={state.filterDepartment}
                  onChange={(value) => dispatch({ type: 'SET_FILTER_DEPARTMENT', payload: value })}
                  ariaLabel={isRtl ? 'تصفية حسب القسم' : 'Filter by Department'}
                  className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm transition-all duration-200"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}>
                  {isRtl ? 'ترتيب حسب' : 'Sort By'}
                </label>
                <ProductDropdown
                  options={sortOptions.map((opt) => ({
                    value: opt.value,
                    label: isRtl ? { date: 'التاريخ', totalQuantity: 'الكمية الإجمالية' }[opt.value] : opt.label,
                  }))}
                  value={state.sortBy}
                  onChange={(value) => dispatch({ type: 'SET_SORT', by: value, order: state.sortOrder })}
                  ariaLabel={isRtl ? 'ترتيب حسب' : 'Sort By'}
                  className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm transition-all duration-200"
                />
              </div>
            </div>
            <div className={`flex flex-col sm:flex-row justify-between items-center gap-4 mt-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div className="text-sm text-gray-600 font-medium">
                {isRtl ? `عدد الطلبات: ${filteredOrders.length}` : `Orders count: ${filteredOrders.length}`}
              </div>
              <Button
                variant="secondary"
                onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: state.viewMode === 'card' ? 'table' : 'card' })}
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg px-4 py-2 text-sm font-medium shadow transition-all duration-200"
              >
                {state.viewMode === 'card' ? <Table2 className="w-5 h-5" /> : <Grid className="w-5 h-5" />}
                {state.viewMode === 'card' ? (isRtl ? 'عرض كجدول' : 'View as Table') : (isRtl ? 'عرض كبطاقات' : 'View as Cards')}
              </Button>
            </div>
          </Card>
          <div ref={listRef} className="mt-8 min-h-[400px]">
            <AnimatePresence>
              {state.loading ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  {state.viewMode === 'card' ? (
                    <div className="grid grid-cols-1 gap-4">
                      {Array.from({ length: ORDERS_PER_PAGE.card }, (_, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3, delay: i * 0.05 }}
                        >
                          <OrderCardSkeleton isRtl={isRtl} />
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <OrderTableSkeleton isRtl={isRtl} rows={ORDERS_PER_PAGE.table} />
                    </motion.div>
                  )}
                </motion.div>
              ) : state.error ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="mt-8"
                >
                  <Card className="p-6 max-w-md mx-auto text-center bg-red-50 shadow-md rounded-xl border border-red-100">
                    <div className={`flex items-center justify-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <p className="text-sm font-medium text-red-600">{state.error}</p>
                    </div>
                    <Button
                      variant="primary"
                      onClick={() => fetchData()}
                      className="mt-4 bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-4 py-2 text-sm font-medium shadow transition-all duration-200"
                      aria-label={isRtl ? 'إعادة المحاولة' : 'Retry'}
                    >
                      {isRtl ? 'إعادة المحاولة' : 'Retry'}
                    </Button>
                  </Card>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-4"
                >
                  {paginatedOrders.length === 0 ? (
                    <Card className="p-8 text-center bg-white shadow-md rounded-xl border border-gray-200">
                      <ShoppingCart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-700 mb-2">
                        {isRtl ? 'لا توجد طلبات' : 'No Orders'}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {state.filterStatus || state.debouncedSearchQuery
                          ? isRtl
                            ? 'لا توجد طلبات مطابقة'
                            : 'No matching orders'
                          : isRtl
                          ? 'لا توجد طلبات بعد'
                          : 'No orders yet'}
                      </p>
                    </Card>
                  ) : (
                    <>
                      {state.viewMode === 'table' ? (
                        <OrderTable
                          orders={paginatedOrders}
                          calculateTotalQuantity={calculateTotalQuantity}
                          translateUnit={translateUnit}
                          updateOrderStatus={updateOrderStatus}
                          confirmItemCompletion={confirmItemCompletion}
                          openAssignModal={openAssignModal}
                          submitting={state.submitting}
                          isRtl={isRtl}
                          startIndex={(state.currentPage - 1) * ORDERS_PER_PAGE[state.viewMode] + 1}
                          currentUserRole={user.role}
                        />
                      ) : (
                        <div className="grid grid-cols-1 gap-4">
                          {paginatedOrders.map((order) => (
                            <motion.div
                              key={order.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.3 }}
                            >
                              <OrderCard
                                order={order}
                                calculateTotalQuantity={calculateTotalQuantity}
                                translateUnit={translateUnit}
                                updateOrderStatus={updateOrderStatus}
                                confirmItemCompletion={confirmItemCompletion}
                                openAssignModal={openAssignModal}
                                confirmFactoryProduction={(orderId) => updateOrderStatus(orderId, 'stocked')}
                                submitting={state.submitting}
                                isRtl={isRtl}
                                currentUserRole={user.role}
                              />
                            </motion.div>
                          ))}
                        </div>
                      )}
                      {totalPages > 1 && (
                        <Pagination
                          currentPage={state.currentPage}
                          totalPages={totalPages}
                          isRtl={isRtl}
                          handlePageChange={handlePageChange}
                        />
                      )}
                    </>
                  )}
                  <AssignChefsModal
                    isOpen={state.isAssignModalOpen}
                    onClose={() => {
                      dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: false });
                      dispatch({ type: 'SET_ASSIGN_FORM', payload: { items: [] } });
                      dispatch({ type: 'SET_SELECTED_ORDER', payload: null });
                    }}
                    selectedOrder={state.selectedOrder}
                    chefs={state.chefs}
                    assignFormData={state.assignFormData}
                    setAssignForm={(data) => dispatch({ type: 'SET_ASSIGN_FORM', payload: data })}
                    assignChefs={assignChefs}
                    error={state.error}
                    submitting={state.submitting}
                    loading={state.loading}
                  />
                  <Modal
                    isOpen={state.isCreateModalOpen}
                    onClose={() => {
                      dispatch({ type: 'SET_CREATE_MODAL', isOpen: false });
                      dispatch({
                        type: 'SET_CREATE_FORM',
                        payload: { notes: '', items: [{ productId: '', quantity: 1 }] },
                      });
                      dispatch({ type: 'SET_FORM_ERRORS', payload: {} });
                    }}
                    title={isRtl ? 'إنشاء طلب إنتاج جديد' : 'Create New Production Order'}
                    size="md"
                    className="bg-white rounded-xl shadow-xl border border-gray-100 max-h-[90vh] overflow-y-auto"
                  >
                    <div className="space-y-6">
                      <div>
                        <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRtl ? 'text-right' : 'text-left'}`}>
                          {isRtl ? 'ملاحظات' : 'Notes'}
                        </label>
                        <textarea
                          value={state.createFormData.notes}
                          onChange={(e) =>
                            dispatch({ type: 'SET_CREATE_FORM', payload: { ...state.createFormData, notes: e.target.value } })
                          }
                          placeholder={isRtl ? 'أدخل ملاحظات (اختياري)' : 'Enter notes (optional)'}
                          className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm resize-none"
                          rows={3}
                          aria-label={isRtl ? 'ملاحظات' : 'Notes'}
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRtl ? 'text-right' : 'text-left'}`}>
                          {isRtl ? 'العناصر' : 'Items'}
                        </label>
                        {state.createFormData.items.map((item, index) => (
                          <div key={index} className="flex flex-col gap-4 mb-4 p-4 bg-gray-50 rounded-lg border border-gray-100 shadow-sm">
                            <ProductDropdown
                              options={[
                                { value: '', label: isRtl ? 'اختر منتج' : 'Select Product' },
                                ...state.products.map((product) => ({
                                  value: product._id,
                                  label: `${product.displayName} (${product.displayUnit})`,
                                })),
                              ]}
                              value={item.productId}
                              onChange={(value) =>
                                dispatch({
                                  type: 'SET_CREATE_FORM',
                                  payload: {
                                    ...state.createFormData,
                                    items: state.createFormData.items.map((it, i) =>
                                      i === index ? { ...it, productId: value, assignedTo: undefined } : it
                                    ),
                                  },
                                })
                              }
                              ariaLabel={isRtl ? 'اختر منتج' : 'Select Product'}
                              className={`w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm transition-all duration-200 ${
                                state.formErrors[`item_${index}_productId`] ? 'border-red-500' : ''
                              }`}
                            />
                            {state.formErrors[`item_${index}_productId`] && (
                              <p className="text-xs text-red-600 mt-1">
                                {state.formErrors[`item_${index}_productId`]}
                              </p>
                            )}
                            <div className="flex items-center gap-4">
                              <div className="flex-1">
                                <label
                                  className={`block text-sm font-medium text-gray-700 mb-1 ${
                                    isRtl ? 'text-right' : 'text-left'
                                  }`}
                                >
                                  {isRtl ? 'الكمية' : 'Quantity'}
                                </label>
                                <QuantityInput
                                  value={item.quantity}
                                  onChange={(val) =>
                                    dispatch({
                                      type: 'SET_CREATE_FORM',
                                      payload: {
                                        ...state.createFormData,
                                        items: state.createFormData.items.map((it, i) =>
                                          i === index ? { ...it, quantity: parseInt(val) || 1 } : it
                                        ),
                                      },
                                    })
                                  }
                                  onIncrement={() =>
                                    dispatch({
                                      type: 'SET_CREATE_FORM',
                                      payload: {
                                        ...state.createFormData,
                                        items: state.createFormData.items.map((it, i) =>
                                          i === index
                                            ? {
                                                ...it,
                                                quantity: Math.min(
                                                  it.quantity + 1,
                                                  state.products.find((p) => p._id === it.productId)
                                                    ?.maxStockLevel || 1000
                                                ),
                                              }
                                            : it
                                        ),
                                      },
                                    })
                                  }
                                  onDecrement={() =>
                                    dispatch({
                                      type: 'SET_CREATE_FORM',
                                      payload: {
                                        ...state.createFormData,
                                        items: state.createFormData.items.map((it, i) =>
                                          i === index ? { ...it, quantity: Math.max(it.quantity - 1, 1) } : it
                                        ),
                                      },
                                    })
                                  }
                                  max={state.products.find((p) => p._id === item.productId)?.maxStockLevel}
                                />
                                {state.formErrors[`item_${index}_quantity`] && (
                                  <p className="text-xs text-red-600 mt-1">
                                    {state.formErrors[`item_${index}_quantity`]}
                                  </p>
                                )}
                              </div>
                              {['admin', 'production'].includes(user.role) && (
                                <div className="flex-1">
                                  <label
                                    className={`block text-sm font-medium text-gray-700 mb-1 ${
                                      isRtl ? 'text-right' : 'text-left'
                                    }`}
                                  >
                                    {isRtl ? 'تعيين إلى' : 'Assign To'}
                                  </label>
                                  <ProductDropdown
                                    options={[
                                      { value: '', label: isRtl ? 'اختر شيف' : 'Select Chef' },
                                      ...state.chefs
                                        .filter((chef) => {
                                          const selectedProduct = state.products.find(
                                            (p) => p._id === item.productId
                                          );
                                          return (
                                            selectedProduct?.department?._id === chef.department?._id
                                          );
                                        })
                                        .map((chef) => ({
                                          value: chef.userId,
                                          label: chef.displayName,
                                        })),
                                    ]}
                                    value={item.assignedTo || ''}
                                    onChange={(value) =>
                                      dispatch({
                                        type: 'SET_CREATE_FORM',
                                        payload: {
                                          ...state.createFormData,
                                          items: state.createFormData.items.map((it, i) =>
                                            i === index ? { ...it, assignedTo: value } : it
                                          ),
                                        },
                                      })
                                    }
                                    ariaLabel={isRtl ? 'تعيين شيف' : 'Assign Chef'}
                                    className={`w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm transition-all duration-200 ${
                                      state.formErrors[`item_${index}_assignedTo`] ? 'border-red-500' : ''
                                    }`}
                                  />
                                  {state.formErrors[`item_${index}_assignedTo`]                                   && (
                                    <p className="text-xs text-red-600 mt-1">
                                      {state.formErrors[`item_${index}_assignedTo`]}
                                    </p>
                                  )}
                                </div>
                              )}
                              <Button
                                variant="danger"
                                onClick={() =>
                                  dispatch({
                                    type: 'SET_CREATE_FORM',
                                    payload: {
                                      ...state.createFormData,
                                      items: state.createFormData.items.filter((_, i) => i !== index),
                                    },
                                  })
                                }
                                className="mt-6 bg-red-600 hover:bg-red-700 text-white rounded-lg px-3 py-1 text-xs font-medium shadow transition-all duration-200"
                                disabled={state.createFormData.items.length === 1}
                                aria-label={isRtl ? 'إزالة العنصر' : 'Remove Item'}
                              >
                                {isRtl ? 'إزالة' : 'Remove'}
                              </Button>
                            </div>
                          </div>
                        ))}
                        <Button
                          variant="secondary"
                          onClick={() =>
                            dispatch({
                              type: 'SET_CREATE_FORM',
                              payload: {
                                ...state.createFormData,
                                items: [...state.createFormData.items, { productId: '', quantity: 1 }],
                              },
                            })
                          }
                          className="mt-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg px-4 py-2 text-sm font-medium shadow transition-all duration-200 w-full sm:w-auto"
                          aria-label={isRtl ? 'إضافة عنصر آخر' : 'Add Another Item'}
                        >
                          {isRtl ? 'إضافة عنصر آخر' : 'Add Another Item'}
                        </Button>
                      </div>
                      {state.formErrors.form && (
                        <p className="text-sm text-red-600 mt-2">{state.formErrors.form}</p>
                      )}
                      <div className={`flex justify-end gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            dispatch({ type: 'SET_CREATE_MODAL', isOpen: false });
                            dispatch({
                              type: 'SET_CREATE_FORM',
                              payload: { notes: '', items: [{ productId: '', quantity: 1 }] },
                            });
                            dispatch({ type: 'SET_FORM_ERRORS', payload: {} });
                          }}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg px-4 py-2 text-sm font-medium shadow transition-all duration-200"
                          aria-label={isRtl ? 'إلغاء' : 'Cancel'}
                        >
                          {isRtl ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button
                          variant="primary"
                          onClick={createOrder}
                          disabled={state.submitting === 'create' || state.createFormData.items.length === 0}
                          className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-4 py-2 text-sm font-medium shadow transition-all duration-200 disabled:opacity-50"
                          aria-label={isRtl ? 'إنشاء الطلب' : 'Create Order'}
                        >
                          {state.submitting === 'create'
                            ? isRtl
                              ? 'جارٍ الإنشاء...'
                              : 'Creating...'
                            : isRtl
                            ? 'إنشاء الطلب'
                            : 'Create Order'}
                        </Button>
                      </div>
                    </div>
                  </Modal>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </Suspense>
    </div>
  );
};

export default InventoryOrders;