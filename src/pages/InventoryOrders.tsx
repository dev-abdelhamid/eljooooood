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
                status: order.items.every((i) => i.assignedTo) ? 'in_production' : order.status,
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
                status: state.selectedOrder.items.every((i) => i.assignedTo)
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

export const InventoryOrders: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { socket, isConnected, emit } = useSocket();
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  const listRef = useRef<HTMLDivElement>(null);
  const playNotificationSound = useOrderNotifications(dispatch, stateRef, user);
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      dispatch({ type: 'SET_DEBOUNCED_SEARCH', payload: searchInput });
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const calculateTotalQuantity = useCallback((order: FactoryOrder) => {
    return order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }, []);

  const fetchData = useCallback(
    async (retryCount = 0) => {
      if (!user || !['chef', 'production', 'admin'].includes(user.role)) {
        dispatch({ type: 'SET_ERROR', payload: t('unauthorized_access') });
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

        if (user.role === 'production' && user.department?._id) {
          query.departmentId = user.department._id;
        }

        const [ordersResponse, chefsResponse, productsResponse, departmentsResponse] = await Promise.all([
          factoryOrdersAPI.getAll(query),
          factoryOrdersAPI.getAvailableChefs(user.role === 'chef' ? user.department?._id : undefined, language),
          factoryOrdersAPI.getAvailableProducts(language),
          departmentAPI.getAll({ lang: language }),
        ]);

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
                  productName: item.product?.name || t('unknown'),
                  productNameEn: item.product?.nameEn,
                  displayProductName: item.product?.displayName || (isRtl ? item.product?.name : item.product?.nameEn || item.product?.name) || t('unknown'),
                  quantity: Number(item.quantity) || 1,
                  unit: item.product?.unit || 'unit',
                  unitEn: item.product?.unitEn,
                  displayUnit: translateUnit(item.product?.unit || 'unit', isRtl),
                  department: {
                    _id: item.product?.department?._id || 'no-department',
                    name: item.product?.department?.name || t('unknown'),
                    nameEn: item.product?.department?.nameEn,
                    displayName: item.product?.department?.displayName || (isRtl ? item.product?.department?.name : item.product?.department?.nameEn || item.product?.department?.name) || t('unknown'),
                  },
                  assignedTo: item.assignedTo
                    ? {
                        _id: item.assignedTo._id,
                        username: item.assignedTo.username,
                        name: item.assignedTo.name || t('unknown'),
                        nameEn: item.assignedTo.nameEn,
                        displayName: item.assignedTo.displayName || (isRtl ? item.assignedTo.name : item.assignedTo.nameEn || item.assignedTo.name) || t('unknown'),
                        department: {
                          _id: item.assignedTo.department?._id || 'no-department',
                          name: item.assignedTo.department?.name || t('unknown'),
                          nameEn: item.assignedTo.department?.nameEn,
                          displayName: item.assignedTo.department?.displayName || (isRtl ? item.assignedTo.department?.name : item.assignedTo.department?.nameEn || item.assignedTo.department?.name) || t('unknown'),
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
            createdBy: order.createdBy?.displayName || t('unknown'),
            createdByRole: order.createdBy?.role || 'unknown',
            inventoryProcessed: order.inventoryProcessed || false,
          }));
        dispatch({ type: 'SET_ORDERS', payload: mappedOrders });
        dispatch({
          type: 'SET_CHEFS',
          payload: Array.isArray(chefsResponse)
            ? chefsResponse
                .filter((chef: any) => chef && chef.userId)
                .map((chef: any) => ({
                  _id: chef._id,
                  userId: chef.userId,
                  name: chef.name || t('unknown'),
                  nameEn: chef.nameEn,
                  displayName: chef.displayName || (isRtl ? chef.name : chef.nameEn || chef.name) || t('unknown'),
                  department: chef.department
                    ? {
                        _id: chef.department._id || 'no-department',
                        name: chef.department.name || t('unknown'),
                        nameEn: chef.department.nameEn,
                        displayName: chef.department.displayName || (isRtl ? chef.department.name : chef.department.nameEn || chef.department.name) || t('unknown'),
                      }
                    : { _id: 'no-department', name: t('unknown'), displayName: t('unknown') },
                  status: chef.status || 'active',
                }))
            : [],
        });
        dispatch({
          type: 'SET_PRODUCTS',
          payload: Array.isArray(productsResponse)
            ? productsResponse
                .filter((product: any) => product && product._id)
                .map((product: any) => ({
                  _id: product._id,
                  name: product.name || t('unknown'),
                  nameEn: product.nameEn,
                  displayName: product.displayName || (isRtl ? product.name : product.nameEn || product.name) || t('unknown'),
                  unit: product.unit || 'unit',
                  unitEn: product.unitEn,
                  displayUnit: translateUnit(product.unit || 'unit', isRtl),
                  department: {
                    _id: product.department?._id || 'no-department',
                    name: product.department?.name || t('unknown'),
                    nameEn: product.department?.nameEn,
                    displayName: product.department?.displayName || (isRtl ? product.department?.name : product.department?.nameEn || product.department?.name) || t('unknown'),
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
                displayName: d.displayName || (isRtl ? d.name : d.nameEn || d.name) || t('unknown'),
              }))
            : [],
        });
        dispatch({ type: 'SET_ERROR', payload: '' });
      } catch (err: any) {
        console.error('Fetch data error:', err.message);
        if (retryCount < 3) {
          setTimeout(() => fetchData(retryCount + 1), 2000);
          return;
        }
        const errorMessage =
          err.response?.status === 404
            ? t('no_orders_found')
            : t('error_fetching_orders', { message: err.message });
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [user, state.sortBy, state.sortOrder, state.debouncedSearchQuery, isRtl, language, t]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!user || !['chef', 'production', 'admin'].includes(user.role) || !socket) {
      dispatch({ type: 'SET_ERROR', payload: t('unauthorized_access') });
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }

    const reconnectInterval = setInterval(() => {
      if (!isConnected && socket) {
        console.log('Attempting to reconnect WebSocket...');
        socket.connect();
      }
    }, 5000);

    socket.on('connect', () => {
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: true });
      dispatch({ type: 'SET_SOCKET_ERROR', payload: null });
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connect error:', err.message);
      dispatch({ type: 'SET_SOCKET_ERROR', payload: t('connection_error') });
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: false });
    });

    socket.on('newFactoryOrder', (order: any) => {
      if (!order || !order._id || !order.orderNumber) {
        console.warn('Invalid new factory order data:', order);
        return;
      }
      const mappedOrder: FactoryOrder = {
        id: order._id,
        orderNumber: order.orderNumber,
        items: Array.isArray(order.items)
          ? order.items.map((item: any) => ({
              _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
              productId: item.product?._id || 'unknown',
              productName: item.product?.name || t('unknown'),
              productNameEn: item.product?.nameEn,
              displayProductName: item.product?.displayName || (isRtl ? item.product?.name : item.product?.nameEn || item.product?.name) || t('unknown'),
              quantity: Number(item.quantity) || 1,
              unit: item.product?.unit || 'unit',
              unitEn: item.product?.unitEn,
              displayUnit: translateUnit(item.product?.unit || 'unit', isRtl),
              department: {
                _id: item.product?.department?._id || 'no-department',
                name: item.product?.department?.name || t('unknown'),
                nameEn: item.product?.department?.nameEn,
                displayName: item.product?.department?.displayName || (isRtl ? item.product?.department?.name : item.product?.department?.nameEn || item.product?.department?.name) || t('unknown'),
              },
              assignedTo: item.assignedTo
                ? {
                    _id: item.assignedTo._id,
                    username: item.assignedTo.username,
                    name: item.assignedTo.name || t('unknown'),
                    nameEn: item.assignedTo.nameEn,
                    displayName: item.assignedTo.displayName || (isRtl ? item.assignedTo.name : item.assignedTo.nameEn || item.assignedTo.name) || t('unknown'),
                    department: {
                      _id: item.assignedTo.department?._id || 'no-department',
                      name: item.assignedTo.department?.name || t('unknown'),
                      nameEn: item.assignedTo.department?.nameEn,
                      displayName: item.assignedTo.department?.displayName || (isRtl ? item.assignedTo.department?.name : item.assignedTo.department?.nameEn || item.assignedTo.department?.name) || t('unknown'),
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
        createdBy: order.createdBy?.displayName || t('unknown'),
        createdByRole: order.createdBy?.role || 'unknown',
        inventoryProcessed: order.inventoryProcessed || false,
      };
      dispatch({ type: 'ADD_ORDER', payload: mappedOrder });
      playNotificationSound('/sounds/notification.mp3', [200, 100, 200]);
      toast.success(t('new_production_order', { orderNumber: order.orderNumber }), {
        position: isRtl ? 'top-left' : 'top-right',
      });
    });

    socket.on('orderStatusUpdated', ({ orderId, status }: { orderId: string; status: FactoryOrder['status'] }) => {
      if (!orderId || !status) {
        console.warn('Invalid order status update data:', { orderId, status });
        return;
      }
      dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status });
      toast.info(t('order_status_updated', { orderId, status }), {
        position: isRtl ? 'top-left' : 'top-right',
      });
    });

    socket.on('itemStatusUpdated', ({ orderId, itemId, status }: { orderId: string; itemId: string; status: FactoryOrderItem['status'] }) => {
      if (!orderId || !itemId || !status) {
        console.warn('Invalid item status update data:', { orderId, itemId, status });
        return;
      }
      dispatch({ type: 'UPDATE_ITEM_STATUS', orderId, payload: { itemId, status } });
      toast.info(t('item_status_updated', { orderId }), {
        position: isRtl ? 'top-left' : 'top-right',
      });
    });

    socket.on('taskAssigned', ({ orderId, items }: { orderId: string; items: any[] }) => {
      if (!orderId || !items) {
        console.warn('Invalid task assigned data:', { orderId, items });
        return;
      }
      dispatch({ type: 'TASK_ASSIGNED', orderId, items });
      toast.info(t('chefs_assigned'), { position: isRtl ? 'top-left' : 'top-right' });
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
  }, [user, socket, isConnected, isRtl, language, playNotificationSound, t]);

  const validateCreateForm = useCallback(() => {
    const errors: Record<string, string> = {};
    const tMessages = {
      productRequired: t('product_required'),
      quantityRequired: t('quantity_required'),
      quantityInvalid: t('quantity_invalid'),
      chefRequired: t('chef_required'),
      noChefsAvailable: t('no_chefs_available'),
    };

    state.createFormData.items.forEach((item, index) => {
      if (!item.productId) {
        errors[`item_${index}_productId`] = tMessages.productRequired;
      }
      if (!item.quantity || item.quantity < 1) {
        errors[`item_${index}_quantity`] = item.quantity === 0 ? tMessages.quantityRequired : tMessages.quantityInvalid;
      }
      if (['admin', 'production'].includes(user.role)) {
        const product = state.products.find(p => p._id === item.productId);
        const availableChefs = state.chefs.filter(chef => chef.department._id === product?.department._id);
        if (product && !availableChefs.length) {
          errors[`item_${index}_assignedTo`] = tMessages.noChefsAvailable;
        } else if (!item.assignedTo && availableChefs.length > 0) {
          errors[`item_${index}_assignedTo`] = tMessages.chefRequired;
        }
      }
    });

    dispatch({ type: 'SET_FORM_ERRORS', payload: errors });
    return Object.keys(errors).length === 0;
  }, [state.createFormData, t, user.role, state.products, state.chefs]);

  const createOrder = useCallback(async () => {
    if (!user?.id || !validateCreateForm()) {
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
      }));

      const response = await factoryOrdersAPI.create({
        orderNumber,
        items,
        notes: state.createFormData.notes,
        priority: 'medium',
      }, language);

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
        createdBy: response.data.createdBy?.displayName || t('unknown'),
        createdByRole: response.data.createdBy?.role || 'unknown',
        inventoryProcessed: response.data.inventoryProcessed || false,
      };

      dispatch({ type: 'ADD_ORDER', payload: newOrder });
      dispatch({ type: 'SET_CREATE_MODAL', isOpen: false });
      dispatch({ type: 'SET_CREATE_FORM', payload: { notes: '', items: [{ productId: '', quantity: 1 }] } });
      dispatch({ type: 'SET_FORM_ERRORS', payload: {} });

      if (socket && isConnected) {
        emit('newFactoryOrder', newOrder);
      }

      toast.success(t('order_created_success'), {
        position: isRtl ? 'top-left' : 'top-right',
      });

      if (isAdminOrProduction && state.createFormData.items.some(i => !i.assignedTo)) {
        dispatch({ type: 'SET_SELECTED_ORDER', payload: newOrder });
        dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: true });
      }
    } catch (err: any) {
      console.error('Create order error:', err.message);
      const errorMessage = t('error_creating_order', { message: err.message });
      dispatch({ type: 'SET_FORM_ERRORS', payload: { form: errorMessage } });
      toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right' });
    } finally {
      dispatch({ type: 'SET_SUBMITTING', payload: null });
    }
  }, [user, state.createFormData, isRtl, socket, isConnected, emit, language, validateCreateForm, t]);

  const updateOrderStatus = useCallback(
    async (orderId: string, newStatus: FactoryOrder['status']) => {
      const order = state.orders.find((o) => o.id === orderId);
      if (!order || !validTransitions[order.status].includes(newStatus)) {
        toast.error(t('invalid_transition'), { position: isRtl ? 'top-left' : 'top-right' });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        await factoryOrdersAPI.updateStatus(orderId, { status: newStatus }, language);
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
        toast.success(t('status_updated', { status: newStatus }), {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error('Update order status error:', err.message);
        toast.error(t('error_updating_status', { message: err.message }), {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [state.orders, isRtl, socket, isConnected, emit, user, t, language]
  );

  const confirmItemCompletion = useCallback(
    async (orderId: string, itemId: string) => {
      if (!user?.id || user.role !== 'chef') {
        toast.error(t('unauthorized_confirm_production'), {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      const order = state.orders.find((o) => o.id === orderId);
      if (!order) {
        toast.error(t('order_not_found'), { position: isRtl ? 'top-left' : 'top-right' });
        return;
      }
      const item = order.items.find((i) => i._id === itemId);
      if (!item || item.assignedTo?._id !== user.id) {
        toast.error(t('unauthorized_confirm_item'), {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: itemId });
      try {
        await factoryOrdersAPI.updateItemStatus(orderId, itemId, { status: 'completed' }, language);
        dispatch({ type: 'UPDATE_ITEM_STATUS', orderId, payload: { itemId, status: 'completed' } });
        if (socket && isConnected) {
          emit('itemStatusUpdated', { orderId, itemId, status: 'completed' });
        }
        toast.success(t('production_completion_confirmed'), {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error('Confirm item completion error:', err.message);
        toast.error(t('error_confirming_production', { message: err.message }), {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [user, state.orders, isRtl, socket, isConnected, emit, t, language]
  );

  const assignChefs = useCallback(
    async (orderId: string) => {
      if (!user?.id || state.assignFormData.items.some((item) => !item.assignedTo)) {
        toast.error(t('assign_chef_required'), {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        await factoryOrdersAPI.assignChefs(orderId, state.assignFormData, language);
        const items = state.assignFormData.items.map((item) => ({
          _id: item.itemId,
          assignedTo: state.chefs.find((chef) => chef.userId === item.assignedTo) || {
            _id: item.assignedTo,
            username: 'unknown',
            name: t('unknown'),
            displayName: t('unknown'),
            department: {
              _id: 'no-department',
              name: t('unknown'),
              displayName: t('unknown'),
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
        toast.success(t('chefs_assigned_success'), {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error('Assign chefs error:', err.message);
        toast.error(t('error_assigning_chefs', { message: err.message }), {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [user, state.assignFormData, state.chefs, socket, isConnected, emit, isRtl, t, language]
  );

  const openAssignModal = useCallback(
    (order: FactoryOrder) => {
      if (order.createdByRole === 'chef') {
        toast.info(t('order_auto_assigned'), {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      if (order.status !== 'approved') {
        toast.error(t('order_not_approved'), {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      dispatch({ type: 'SET_SELECTED_ORDER', payload: order });
      dispatch({
        type: 'SET_ASSIGN_FORM',
        payload: {
          items: order.items
            .filter((item) => !item.assignedTo)
            .map((item) => ({
              itemId: item._id,
              assignedTo: '',
              product: item.displayProductName,
              quantity: item.quantity,
              unit: translateUnit(item.unit, isRtl),
            })),
        },
      });
      dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: true });
    },
    [isRtl, t]
  );

  const handlePageChange = useCallback((page: number) => {
    dispatch({ type: 'SET_PAGE', payload: page });
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

 
    const filteredOrders = useMemo(() => {
    const normalizedQuery = normalizeText(state.debouncedSearchQuery);
    return state.orders
      .filter((order) => order) // التأكد من أن الطلب ليس null أو undefined
      .filter(
        (order) =>
          normalizeText(order.orderNumber || '').includes(normalizedQuery) ||
          normalizeText(order.notes || '').includes(normalizedQuery) ||
          normalizeText(order.createdBy || '').includes(normalizedQuery) ||
          order.items.some((item) =>
            normalizeText(item.displayProductName || '').includes(normalizedQuery)
          )
      )
      .filter(
        (order) =>
          (!state.filterStatus || order.status === state.filterStatus) &&
          (!state.filterDepartment ||
            order.items.some((item) => item.department?._id === state.filterDepartment))
      )
      .sort((a, b) => {
        const multiplier = state.sortOrder === 'asc' ? 1 : -1;
        if (state.sortBy === 'date') {
          return multiplier * (new Date(a.date).getTime() - new Date(b.date).getTime());
        } else {
          return multiplier * (calculateTotalQuantity(a) - calculateTotalQuantity(b));
        }
      });
  }, [state.orders, state.filterStatus, state.filterDepartment, state.debouncedSearchQuery, state.sortBy, state.sortOrder, calculateTotalQuantity]);

  const paginatedOrders = useMemo(() => {
    const start = (state.currentPage - 1) * ORDERS_PER_PAGE[state.viewMode];
    const end = start + ORDERS_PER_PAGE[state.viewMode];
    return filteredOrders.slice(start, end);
  }, [filteredOrders, state.currentPage, state.viewMode]);

  const totalPages = Math.ceil(filteredOrders.length / ORDERS_PER_PAGE[state.viewMode]);

  const approveOrder = useCallback(
    async (orderId: string) => {
      await updateOrderStatus(orderId, 'approved');
    },
    [updateOrderStatus]
  );

  const confirmFactoryProduction = useCallback(
    async (orderId: string) => {
      await updateOrderStatus(orderId, 'stocked');
    },
    [updateOrderStatus]
  );

  const addItemToForm = useCallback(() => {
    dispatch({
      type: 'SET_CREATE_FORM',
      payload: {
        ...state.createFormData,
        items: [...state.createFormData.items, { productId: '', quantity: 1 }],
      },
    });
  }, [state.createFormData]);

  const removeItemFromForm = useCallback(
    (index: number) => {
      dispatch({
        type: 'SET_CREATE_FORM',
        payload: {
          ...state.createFormData,
          items: state.createFormData.items.filter((_, i) => i !== index),
        },
      });
      dispatch({
        type: 'SET_FORM_ERRORS',
        payload: {
          ...state.formErrors,
          [`item_${index}_productId`]: undefined,
          [`item_${index}_quantity`]: undefined,
          [`item_${index}_assignedTo`]: undefined,
        },
      });
    },
    [state.createFormData, state.formErrors]
  );

  const updateCreateFormItem = useCallback(
    (index: number, field: keyof State['createFormData']['items'][0], value: string | number) => {
      const updatedItems = state.createFormData.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      );
      dispatch({
        type: 'SET_CREATE_FORM',
        payload: { ...state.createFormData, items: updatedItems },
      });

      // إعادة تعيين الشيف إذا تغير المنتج
      if (field === 'productId' && ['admin', 'production'].includes(user.role)) {
        const product = state.products.find((p) => p._id === value);
        const availableChefs = state.chefs.filter(
          (chef) => chef.department._id === product?.department._id
        );
        if (availableChefs.length === 1) {
          updatedItems[index].assignedTo = availableChefs[0].userId;
        } else {
          updatedItems[index].assignedTo = '';
        }
        dispatch({
          type: 'SET_CREATE_FORM',
          payload: { ...state.createFormData, items: updatedItems },
        });
      }
    },
    [state.createFormData, state.products, state.chefs, user.role]
  );

  const departmentOptions = useMemo(
    () => [
      { value: '', label: t('all_departments') },
      ...state.departments.map((dept) => ({
        value: dept._id,
        label: dept.displayName,
      })),
    ],
    [state.departments, t]
  );

  const productOptions = useMemo(
    () =>
      state.products
        .filter(
          (product) =>
            !state.filterDepartment || product.department._id === state.filterDepartment
        )
        .map((product) => ({
          value: product._id,
          label: `${product.displayName} (${product.displayUnit})`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, language)),
    [state.products, state.filterDepartment, language]
  );

  const priorityOptions = useMemo(
    () => [
      { value: 'low', label: t('low') },
      { value: 'medium', label: t('medium') },
      { value: 'high', label: t('high') },
      { value: 'urgent', label: t('urgent') },
    ],
    [t]
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className={`text-xl font-bold text-gray-800 ${isRtl ? 'text-right' : 'text-left'}`}>
          {t('inventory_orders')}
        </h1>
        <div className={`flex gap-2 items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
          <Button
            variant="primary"
            onClick={() => dispatch({ type: 'SET_CREATE_MODAL', isOpen: true })}
            className="bg-amber-500 hover:bg-amber-600 text-white rounded-md px-3 py-2 text-xs shadow-sm flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            {t('create_order')}
          </Button>
          <div className="flex gap-2">
            <Button
              variant={state.viewMode === 'card' ? 'primary' : 'secondary'}
              onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'card' })}
              className="p-2 rounded-md text-xs"
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={state.viewMode === 'table' ? 'primary' : 'secondary'}
              onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'table' })}
              className="p-2 rounded-md text-xs"
            >
              <Table2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <ProductSearchInput
            value={searchInput}
            onChange={(value) => setSearchInput(value)}
            placeholder={t('search_orders')}
            className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-xs shadow-sm"
          />
        </div>
        <div className="flex gap-2">
          <Select
            options={statusOptions}
            value={state.filterStatus}
            onChange={(value) => dispatch({ type: 'SET_FILTER_STATUS', payload: value })}
            className="w-40 rounded-md border-gray-200 focus:ring-amber-500 text-xs shadow-sm"
            aria-label={t('filter_status')}
          />
          <Select
            options={departmentOptions}
            value={state.filterDepartment}
            onChange={(value) => dispatch({ type: 'SET_FILTER_DEPARTMENT', payload: value })}
            className="w-40 rounded-md border-gray-200 focus:ring-amber-500 text-xs shadow-sm"
            aria-label={t('filter_department')}
          />
          <Select
            options={sortOptions}
            value={state.sortBy}
            onChange={(value) =>
              dispatch({ type: 'SET_SORT', by: value, order: state.sortOrder })
            }
            className="w-40 rounded-md border-gray-200 focus:ring-amber-500 text-xs shadow-sm"
            aria-label={t('sort_by')}
          />
          <Select
            options={[
              { value: 'asc', label: t('ascending') },
              { value: 'desc', label: t('descending') },
            ]}
            value={state.sortOrder}
            onChange={(value) =>
              dispatch({ type: 'SET_SORT', by: state.sortBy, order: value })
            }
            className="w-32 rounded-md border-gray-200 focus:ring-amber-500 text-xs shadow-sm"
            aria-label={t('sort_order')}
          />
        </div>
      </div>

      {state.error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}
        >
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-red-600 text-xs">{state.error}</span>
        </motion.div>
      )}

      {state.socketError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`p-3 bg-yellow-50 border border-yellow-200 rounded-md flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}
        >
          <AlertCircle className="w-4 h-4 text-yellow-600" />
          <span className="text-yellow-600 text-xs">{state.socketError}</span>
        </motion.div>
      )}

      <div ref={listRef}>
        <Suspense fallback={<OrderCardSkeleton count={ORDERS_PER_PAGE[state.viewMode]} />}>
          {state.loading ? (
            state.viewMode === 'card' ? (
              <OrderCardSkeleton count={ORDERS_PER_PAGE.card} />
            ) : (
              <OrderTableSkeleton count={ORDERS_PER_PAGE.table} />
            )
          ) : paginatedOrders.length === 0 ? (
            <Card className="p-4 text-center">
              <ShoppingCart className="mx-auto w-12 h-12 text-gray-400 mb-2" />
              <p className="text-gray-600 text-xs">{t('no_orders_found')}</p>
            </Card>
          ) : state.viewMode === 'card' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {paginatedOrders.map((order) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <OrderCard
                      order={order}
                      calculateTotalQuantity={calculateTotalQuantity}
                      translateUnit={translateUnit}
                      updateOrderStatus={updateOrderStatus}
                      confirmItemCompletion={confirmItemCompletion}
                      openAssignModal={openAssignModal}
                      confirmFactoryProduction={confirmFactoryProduction}
                      submitting={state.submitting}
                      currentUserRole={user.role}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <OrderTable
              orders={paginatedOrders}
              calculateTotalQuantity={calculateTotalQuantity}
              translateUnit={translateUnit}
              approveOrder={approveOrder}
              updateOrderStatus={updateOrderStatus}
              confirmItemCompletion={confirmItemCompletion}
              openAssignModal={openAssignModal}
              confirmFactoryProduction={confirmFactoryProduction}
              submitting={state.submitting}
              startIndex={(state.currentPage - 1) * ORDERS_PER_PAGE.table + 1}
              currentUserRole={user.role}
            />
          )}
        </Suspense>
      </div>

      <Pagination
        currentPage={state.currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        isRtl={isRtl}
      />

      <Modal
        isOpen={state.isCreateModalOpen}
        onClose={() => {
          dispatch({ type: 'SET_CREATE_MODAL', isOpen: false });
          dispatch({
            type: 'SET_CREATE_FORM',
            payload: { notes: '', items: [{ productId: '', quantity: 1 }], priority: 'medium' },
          });
          dispatch({ type: 'SET_FORM_ERRORS', payload: {} });
        }}
        title={t('create_production_order')}
        size="lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createOrder();
          }}
          className="space-y-4"
        >
          <div>
            <label
              className={`block text-xs font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}
            >
              {t('notes')}
            </label>
            <textarea
              value={state.createFormData.notes}
              onChange={(e) =>
                dispatch({
                  type: 'SET_CREATE_FORM',
                  payload: { ...state.createFormData, notes: e.target.value },
                })
              }
              className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-xs shadow-sm"
              rows={3}
              placeholder={t('enter_notes')}
            />
          </div>
          <div>
            <label
              className={`block text-xs font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}
            >
              {t('priority')}
            </label>
            <Select
              options={priorityOptions}
              value={state.createFormData.priority}
              onChange={(value) =>
                dispatch({
                  type: 'SET_CREATE_FORM',
                  payload: { ...state.createFormData, priority: value as 'low' | 'medium' | 'high' | 'urgent' },
                })
              }
              className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-xs shadow-sm"
              aria-label={t('priority')}
            />
          </div>
          <div>
            <label
              className={`block text-xs font-medium text-gray-700 mb-2 ${isRtl ? 'text-right' : 'text-left'}`}
            >
              {t('items')}
            </label>
            <AnimatePresence>
              {state.createFormData.items.map((item, index) => {
                const product = state.products.find((p) => p._id === item.productId);
                const availableChefs = product
                  ? state.chefs.filter((chef) => chef.department._id === product.department._id)
                  : [];
                const chefOptions = [
                  { value: '', label: t('select_chef') },
                  ...availableChefs
                    .sort((a, b) => a.displayName.localeCompare(b.displayName))
                    .map((chef) => ({
                      value: chef.userId,
                      label: `${chef.displayName} (${chef.department.displayName})`,
                    })),
                ];

                return (
                  <motion.div
                    key={`item-${index}`}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-start gap-2 mb-3 p-2 border border-gray-200 rounded-md bg-gray-50"
                  >
                    <div className="flex-1">
                      <label
                        className={`block text-xs font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}
                      >
                        {t('product')}
                      </label>
                      <ProductDropdown
                        options={productOptions}
                        value={item.productId}
                        onChange={(value) => updateCreateFormItem(index, 'productId', value)}
                        placeholder={t('select_product')}
                        className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-xs shadow-sm"
                      />
                      {state.formErrors[`item_${index}_productId`] && (
                        <p className="text-red-600 text-xs mt-1">
                          {state.formErrors[`item_${index}_productId`]}
                        </p>
                      )}
                    </div>
                    <div className="w-32">
                      <label
                        className={`block text-xs font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}
                      >
                        {t('quantity')}
                      </label>
                      <QuantityInput
                        value={item.quantity}
                        onChange={(value) => updateCreateFormItem(index, 'quantity', parseInt(value) || 1)}
                        onIncrement={() => updateCreateFormItem(index, 'quantity', item.quantity + 1)}
                        onDecrement={() => updateCreateFormItem(index, 'quantity', Math.max(1, item.quantity - 1))}
                        max={product?.maxStockLevel}
                      />
                      {state.formErrors[`item_${index}_quantity`] && (
                        <p className="text-red-600 text-xs mt-1">
                          {state.formErrors[`item_${index}_quantity`]}
                        </p>
                      )}
                    </div>
                    {['admin', 'production'].includes(user.role) && (
                      <div className="flex-1">
                        <label
                          className={`block text-xs font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}
                        >
                          {t('assign_chef')}
                        </label>
                        <Select
                          options={chefOptions}
                          value={item.assignedTo || ''}
                          onChange={(value) => updateCreateFormItem(index, 'assignedTo', value)}
                          className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-xs shadow-sm"
                          aria-label={t('select_chef')}
                          disabled={!item.productId || availableChefs.length === 0}
                        />
                        {state.formErrors[`item_${index}_assignedTo`] && (
                          <p className="text-red-600 text-xs mt-1">
                            {state.formErrors[`item_${index}_assignedTo`]}
                          </p>
                        )}
                      </div>
                    )}
                    {state.createFormData.items.length > 1 && (
                      <button
                        onClick={() => removeItemFromForm(index)}
                        className="mt-6 text-red-600 hover:text-red-800 text-xs"
                        aria-label={t('remove_item')}
                      >
                        <MinusCircle className="w-5 h-5" />
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <Button
              variant="secondary"
              onClick={addItemToForm}
              className="mt-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md px-3 py-1 text-xs shadow-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {t('add_item')}
            </Button>
          </div>
          {state.formErrors.form && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}
            >
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-red-600 text-xs">{state.formErrors.form}</span>
            </motion.div>
          )}
          <div className={`flex justify-end gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <Button
              variant="secondary"
              onClick={() => {
                dispatch({ type: 'SET_CREATE_MODAL', isOpen: false });
                dispatch({
                  type: 'SET_CREATE_FORM',
                  payload: { notes: '', items: [{ productId: '', quantity: 1 }], priority: 'medium' },
                });
                dispatch({ type: 'SET_FORM_ERRORS', payload: {} });
              }}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md px-3 py-1 text-xs shadow-sm"
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={state.submitting === 'create'}
              className="bg-amber-500 hover:bg-amber-600 text-white rounded-md px-3 py-1 text-xs shadow-sm disabled:opacity-50"
            >
              {state.submitting === 'create' ? t('creating') : t('create')}
            </Button>
          </div>
        </form>
      </Modal>

      <AssignChefsModal
        isOpen={state.isAssignModalOpen}
        onClose={() => {
          dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: false });
          dispatch({ type: 'SET_ASSIGN_FORM', payload: { items: [] } });
        }}
        selectedOrder={state.selectedOrder}
        assignFormData={state.assignFormData}
        chefs={state.chefs}
        error={state.error}
        submitting={state.submitting}
        assignChefs={assignChefs}
        setAssignForm={(formData) => dispatch({ type: 'SET_ASSIGN_FORM', payload: formData })}
        loading={state.loading}
      />
    </div>
  );
};

export default InventoryOrders;