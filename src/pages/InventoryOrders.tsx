import React, { useReducer, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Modal } from '../components/UI/Modal';
import { Select } from '../components/UI/Select';
import { Input } from '../components/UI/Input';
import { ShoppingCart, AlertCircle, PlusCircle, Table2, Grid, CheckCircle, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { factoryOrdersAPI, chefsAPI, productsAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { useOrderNotifications } from '../hooks/useOrderNotifications';
import { FactoryOrder, Chef, AssignChefsForm, OrderStatus } from '../types/types';
import Pagination from '../components/Shared/Pagination';
import AssignChefsModal from '../components/production/AssignChefsModal';
import OrderTable from '../components/production/OrderTable';
import OrderCard from '../components/production/OrderCard';
import OrderCardSkeleton from '../components/Shared/OrderCardSkeleton';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';
import { ProductSearchInput, ProductDropdown } from './OrdersTablePage';
import { CreateFactoryOrderRequest } from '../types/types';

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

interface Product {
  _id: string;
  name: string;
  nameEn?: string;
  unit: string;
  unitEn?: string;
  department: { _id: string; name: string; nameEn?: string; code?: string };
}

interface State {
  orders: FactoryOrder[];
  selectedOrder: FactoryOrder | null;
  chefs: Chef[];
  products: Product[];
  isAssignModalOpen: boolean;
  isCreateModalOpen: boolean;
  assignFormData: AssignChefsForm;
  createFormData: { productId: string; quantity: string; notes: string; priority: string };
  filterStatus: string;
  searchQuery: string;
  sortBy: 'date' | 'totalQuantity';
  sortOrder: 'asc' | 'desc';
  currentPage: number;
  loading: boolean;
  error: string;
  submitting: string | null;
  socketConnected: boolean;
  socketError: string | null;
  viewMode: 'card' | 'table';
}

interface Action {
  type: string;
  payload?: any;
  orderId?: string;
  status?: FactoryOrder['status'];
  items?: any[];
  by?: 'date' | 'totalQuantity';
  order?: 'asc' | 'desc';
  isOpen?: boolean;
}

const initialState: State = {
  orders: [],
  selectedOrder: null,
  chefs: [],
  products: [],
  isAssignModalOpen: false,
  isCreateModalOpen: false,
  assignFormData: { items: [] },
  createFormData: { productId: '', quantity: '', notes: '', priority: 'medium' },
  filterStatus: '',
  searchQuery: '',
  sortBy: 'date',
  sortOrder: 'desc',
  currentPage: 1,
  loading: true,
  error: '',
  submitting: null,
  socketConnected: false,
  socketError: null,
  viewMode: 'card',
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_ORDERS': return { ...state, orders: action.payload, error: '', currentPage: 1 };
    case 'ADD_ORDER': return { ...state, orders: [action.payload, ...state.orders.filter(o => o._id !== action.payload._id)] };
    case 'SET_SELECTED_ORDER': return { ...state, selectedOrder: action.payload };
    case 'SET_CHEFS': return { ...state, chefs: action.payload };
    case 'SET_PRODUCTS': return { ...state, products: action.payload };
    case 'SET_ASSIGN_MODAL': return { ...state, isAssignModalOpen: action.isOpen ?? false };
    case 'SET_CREATE_MODAL': return { ...state, isCreateModalOpen: action.isOpen ?? false };
    case 'SET_ASSIGN_FORM': return { ...state, assignFormData: action.payload };
    case 'SET_CREATE_FORM': return { ...state, createFormData: action.payload };
    case 'SET_FILTER_STATUS': return { ...state, filterStatus: action.payload, currentPage: 1 };
    case 'SET_SEARCH_QUERY': return { ...state, searchQuery: action.payload, currentPage: 1 };
    case 'SET_SORT': return { ...state, sortBy: action.by ?? 'date', sortOrder: action.order ?? 'desc', currentPage: 1 };
    case 'SET_PAGE': return { ...state, currentPage: action.payload };
    case 'SET_LOADING': return { ...state, loading: action.payload };
    case 'SET_ERROR': return { ...state, error: action.payload };
    case 'SET_SUBMITTING': return { ...state, submitting: action.payload };
    case 'SET_SOCKET_CONNECTED': return { ...state, socketConnected: action.payload };
    case 'SET_SOCKET_ERROR': return { ...state, socketError: action.payload };
    case 'UPDATE_ORDER_STATUS': return {
      ...state,
      orders: state.orders.map(o => o._id === action.orderId ? { ...o, status: action.status! } : o),
      selectedOrder: state.selectedOrder && state.selectedOrder._id === action.orderId
        ? { ...state.selectedOrder, status: action.status! } : state.selectedOrder,
    };
    case 'UPDATE_ITEM_STATUS': return {
      ...state,
      orders: state.orders.map(order =>
        order._id === action.orderId
          ? {
              ...order,
              items: order.items.map(item =>
                item._id === action.payload.itemId ? { ...item, status: action.payload.status } : item
              ),
              status: order.items.every(i => i.status === 'completed') && order.status !== 'completed'
                ? 'completed' : order.status,
            }
          : order
      ),
      selectedOrder: state.selectedOrder && state.selectedOrder._id === action.orderId
        ? {
            ...state.selectedOrder,
            items: state.selectedOrder.items.map(item =>
              item._id === action.payload.itemId ? { ...item, status: action.payload.status } : item
            ),
            status: state.selectedOrder.items.every(i => i.status === 'completed') && state.selectedOrder.status !== 'completed'
              ? 'completed' : state.selectedOrder.status,
          }
        : state.selectedOrder,
    };
    case 'TASK_ASSIGNED': return {
      ...state,
      orders: state.orders.map(order =>
        order._id === action.orderId
          ? {
              ...order,
              items: order.items.map(i => {
                const assignment = action.items?.find(a => a.itemId === i._id);
                return assignment
                  ? {
                      ...i,
                      assignedTo: assignment.assignedTo
                        ? {
                            _id: assignment.assignedTo,
                            name: state.chefs.find(c => c._id === assignment.assignedTo)?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                            nameEn: state.chefs.find(c => c._id === assignment.assignedTo)?.nameEn,
                          }
                        : undefined,
                      status: assignment.status || i.status,
                    }
                  : i;
              }),
              status: order.items.every(i => i.status === 'assigned') ? 'in_production' : order.status,
            }
          : order
      ),
      selectedOrder: state.selectedOrder && state.selectedOrder._id === action.orderId
        ? {
            ...state.selectedOrder,
            items: state.selectedOrder.items.map(i => {
              const assignment = action.items?.find(a => a.itemId === i._id);
              return assignment
                ? {
                    ...i,
                    assignedTo: assignment.assignedTo
                      ? {
                          _id: assignment.assignedTo,
                          name: state.chefs.find(c => c._id === assignment.assignedTo)?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                          nameEn: state.chefs.find(c => c._id === assignment.assignedTo)?.nameEn,
                        }
                      : undefined,
                    status: assignment.status || i.status,
                  }
                : i;
            }),
            status: state.selectedOrder.items.every(i => i.status === 'assigned') ? 'in_production' : state.selectedOrder.status,
          }
        : state.selectedOrder,
    };
    case 'SET_VIEW_MODE': return { ...state, viewMode: action.payload, currentPage: 1 };
    default: return state;
  }
};

const ORDERS_PER_PAGE = { card: 12, table: 50 };
const validTransitions: Record<OrderStatus, OrderStatus[]> = {
  pending: ['in_production', 'cancelled'],
  in_production: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};
const statusOptions = [
  { value: '', label: 'all_statuses' },
  { value: 'pending', label: 'pending' },
  { value: 'in_production', label: 'in_production' },
  { value: 'completed', label: 'completed' },
  { value: 'cancelled', label: 'cancelled' },
];
const sortOptions = [
  { value: 'date', label: 'sort_date' },
  { value: 'totalQuantity', label: 'sort_total_quantity' },
];
const priorityOptions = [
  { value: 'low', label: 'low' },
  { value: 'medium', label: 'medium' },
  { value: 'high', label: 'high' },
  { value: 'urgent', label: 'urgent' },
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

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const calculateTotalQuantity = useCallback((order: FactoryOrder) => {
    return order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }, []);

  useEffect(() => {
    if (!user || !['admin', 'production'].includes(user.role) || !socket) {
      dispatch({ type: 'SET_ERROR', payload: isRtl ? 'غير مصرح للوصول' : 'Unauthorized access' });
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
      console.log('WebSocket connected');
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connect error:', err.message);
      dispatch({ type: 'SET_SOCKET_ERROR', payload: isRtl ? 'خطأ في الاتصال' : 'Connection error' });
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: false });
    });

    socket.on('newFactoryOrder', (order: any) => {
      if (!order || !order._id || !order.orderNumber) {
        console.warn('Invalid new factory order data:', order);
        return;
      }
      const mappedOrder: FactoryOrder = {
        _id: order._id,
        orderNumber: order.orderNumber,
        items: Array.isArray(order.items)
          ? order.items.map((item: any) => ({
              _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
              product: {
                _id: item.product?._id || 'unknown',
                name: item.product?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                nameEn: item.product?.nameEn,
                unit: item.product?.unit || 'unit',
                unitEn: item.product?.unitEn,
                department: {
                  _id: item.product?.department?._id || 'unknown',
                  name: item.product?.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                  nameEn: item.product?.department?.nameEn,
                  code: item.product?.department?.code || '',
                },
              },
              quantity: Number(item.quantity) || 1,
              status: item.status || 'pending',
              assignedTo: item.assignedTo
                ? {
                    _id: item.assignedTo._id,
                    name: item.assignedTo.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: item.assignedTo.nameEn,
                  }
                : undefined,
              startedAt: item.startedAt ? new Date(item.startedAt).toISOString() : null,
              completedAt: item.completedAt ? new Date(item.completedAt).toISOString() : null,
            }))
          : [],
        status: order.status || 'pending',
        notes: order.notes || '',
        priority: order.priority || 'medium',
        createdBy: {
          _id: order.createdBy?._id || 'unknown',
          name: order.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
          nameEn: order.createdBy?.nameEn,
        },
        createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : new Date().toISOString(),
        approvedAt: order.approvedAt ? new Date(order.approvedAt).toISOString() : null,
        statusHistory: order.statusHistory || [],
      };
      dispatch({ type: 'ADD_ORDER', payload: mappedOrder });
      playNotificationSound('/sounds/notification.mp3', [200, 100, 200]);
      toast.success(isRtl ? `طلب إنتاج جديد: ${order.orderNumber}` : `New production order: ${order.orderNumber}`, {
        position: isRtl ? 'top-left' : 'top-right',
      });
    });

    socket.on('orderStatusUpdated', ({ orderId, status }: { orderId: string; status: OrderStatus }) => {
      if (!orderId || !status) {
        console.warn('Invalid order status update data:', { orderId, status });
        return;
      }
      dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status });
      toast.info(isRtl ? `تم تحديث حالة الطلب ${orderId} إلى ${t(status)}` : `Order ${orderId} status updated to ${t(status)}`, {
        position: isRtl ? 'top-left' : 'top-right',
      });
    });

    socket.on('itemStatusUpdated', ({ orderId, itemId, status }: { orderId: string; itemId: string; status: string }) => {
      if (!orderId || !itemId || !status) {
        console.warn('Invalid item status update data:', { orderId, itemId, status });
        return;
      }
      dispatch({ type: 'UPDATE_ITEM_STATUS', orderId, payload: { itemId, status } });
      toast.info(isRtl ? `تم تحديث حالة العنصر في الطلب ${orderId}` : `Item status updated in order ${orderId}`, {
        position: isRtl ? 'top-left' : 'top-right',
      });
    });

    socket.on('taskAssigned', ({ orderId, items }: { orderId: string; items: any[] }) => {
      if (!orderId || !items) {
        console.warn('Invalid task assigned data:', { orderId, items });
        return;
      }
      dispatch({ type: 'TASK_ASSIGNED', orderId, items });
      toast.info(isRtl ? 'تم تعيين الشيفات' : 'Chefs assigned', { position: isRtl ? 'top-left' : 'top-right' });
    });

    socket.on('factoryOrderCompleted', ({ orderId, orderNumber }: { orderId: string; orderNumber: string }) => {
      dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status: 'completed' });
      toast.success(isRtl ? `تم إكمال طلب الإنتاج ${orderNumber}` : `Factory order ${orderNumber} completed`, {
        position: isRtl ? 'top-left' : 'top-right',
      });
    });

    return () => {
      clearInterval(reconnectInterval);
      socket.off('connect');
      socket.off('connect_error');
      socket.off('newFactoryOrder');
      socket.off('orderStatusUpdated');
      socket.off('itemStatusUpdated');
      socket.off('taskAssigned');
      socket.off('factoryOrderCompleted');
    };
  }, [user, socket, isConnected, isRtl, t, playNotificationSound]);

  const fetchData = useCallback(
    async (retryCount = 0) => {
      if (!user || !['admin', 'production'].includes(user.role)) {
        dispatch({ type: 'SET_ERROR', payload: isRtl ? 'غير مصرح للوصول' : 'Unauthorized access' });
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const query: Record<string, any> = {
          status: state.filterStatus || undefined,
          lang: isRtl ? 'ar' : 'en',
        };
        if (user.role === 'production' && user.department) {
          query.department = user.department._id;
        }
        const [ordersResponse, chefsResponse, productsResponse] = await Promise.all([
          factoryOrdersAPI.getAll(),
          chefsAPI.getAll(),
          productsAPI.getAll(),
        ]);

        const mappedOrders: FactoryOrder[] = ordersResponse.data
          .filter((order: any) => order && order._id && order.orderNumber)
          .map((order: any) => ({
            _id: order._id,
            orderNumber: order.orderNumber,
            items: Array.isArray(order.items)
              ? order.items.map((item: any) => ({
                  _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
                  product: {
                    _id: item.product?._id || 'unknown',
                    name: item.product?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: item.product?.nameEn,
                    unit: item.product?.unit || 'unit',
                    unitEn: item.product?.unitEn,
                    department: {
                      _id: item.product?.department?._id || 'unknown',
                      name: item.product?.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                      nameEn: item.product?.department?.nameEn,
                      code: item.product?.department?.code || '',
                    },
                  },
                  quantity: Number(item.quantity) || 1,
                  status: item.status || 'pending',
                  assignedTo: item.assignedTo
                    ? {
                        _id: item.assignedTo._id,
                        name: item.assignedTo.name || (isRtl ? 'غير معروف' : 'Unknown'),
                        nameEn: item.assignedTo.nameEn,
                      }
                    : undefined,
                  startedAt: item.startedAt ? new Date(item.startedAt).toISOString() : null,
                  completedAt: item.completedAt ? new Date(item.completedAt).toISOString() : null,
                }))
              : [],
            status: order.status || 'pending',
            notes: order.notes || '',
            priority: order.priority || 'medium',
            createdBy: {
              _id: order.createdBy?._id || 'unknown',
              name: order.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
              nameEn: order.createdBy?.nameEn,
            },
            createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : new Date().toISOString(),
            approvedAt: order.approvedAt ? new Date(order.approvedAt).toISOString() : null,
            statusHistory: order.statusHistory || [],
          }));

        dispatch({ type: 'SET_ORDERS', payload: mappedOrders });
        dispatch({
          type: 'SET_CHEFS',
          payload: chefsResponse.data
            .filter((chef: any) => chef && chef.user?._id)
            .map((chef: any) => ({
              _id: chef._id,
              userId: chef.user._id,
              name: chef.user?.name || chef.name || (isRtl ? 'غير معروف' : 'Unknown'),
              nameEn: chef.user?.nameEn || chef.nameEn,
              department: chef.department
                ? {
                    _id: chef.department._id,
                    name: chef.department.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: chef.department.nameEn,
                    code: chef.department.code || '',
                  }
                : null,
              status: chef.status || 'active',
            })),
        });
        dispatch({
          type: 'SET_PRODUCTS',
          payload: productsResponse.data
            .filter((product: any) => product && product._id)
            .map((product: any) => ({
              _id: product._id,
              name: product.name || (isRtl ? 'غير معروف' : 'Unknown'),
              nameEn: product.nameEn,
              unit: product.unit || 'unit',
              unitEn: product.unitEn,
              department: {
                _id: product.department?._id || 'unknown',
                name: product.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                nameEn: product.department?.nameEn,
                code: product.department?.code || '',
              },
            }))
            .sort((a: Product, b: Product) => {
              const nameA = isRtl ? a.name : a.nameEn || a.name;
              const nameB = isRtl ? b.name : b.nameEn || b.name;
              return nameA.localeCompare(nameB, language);
            }),
        });
        dispatch({ type: 'SET_ERROR', payload: '' });
      } catch (err: any) {
        console.error('Fetch data error:', err.message);
        if (retryCount < 3) {
          setTimeout(() => fetchData(retryCount + 1), 2000);
          return;
        }
        const errorMessage = err.status === 404
          ? isRtl ? 'لم يتم العثور على طلبات' : 'No orders found'
          : err.message || (isRtl ? 'خطأ في جلب الطلبات' : 'Error fetching orders');
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [user, state.filterStatus, isRtl, language]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearchChange = useCallback((value: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: value });
  }, []);

  const filteredOrders = useMemo(
    () => {
      const normalizedQuery = normalizeText(state.searchQuery);
      return state.orders
        .filter(order => order)
        .filter(
          order =>
            normalizeText(order.orderNumber || '').includes(normalizedQuery) ||
            normalizeText(order.notes || '').includes(normalizedQuery) ||
            normalizeText(order.createdBy?.name || '').includes(normalizedQuery) ||
            order.items.some(item =>
              normalizeText(item.product?.name || '').includes(normalizedQuery)
            )
        )
        .filter(
          order =>
            (!state.filterStatus || order.status === state.filterStatus) &&
            (user?.role === 'production' && user?.department
              ? order.items.some(item => item.product?.department?._id === user.department._id)
              : true)
        );
    },
    [state.orders, state.searchQuery, state.filterStatus, user]
  );

  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      if (state.sortBy === 'date') {
        return state.sortOrder === 'asc'
          ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else {
        const totalA = calculateTotalQuantity(a);
        const totalB = calculateTotalQuantity(b);
        return state.sortOrder === 'asc' ? totalA - totalB : totalB - totalA;
      }
    });
  }, [filteredOrders, state.sortBy, state.sortOrder, calculateTotalQuantity]);

  const paginatedOrders = useMemo(
    () => sortedOrders.slice((state.currentPage - 1) * ORDERS_PER_PAGE[state.viewMode], state.currentPage * ORDERS_PER_PAGE[state.viewMode]),
    [sortedOrders, state.currentPage, state.viewMode]
  );

  const totalPages = useMemo(
    () => Math.ceil(sortedOrders.length / ORDERS_PER_PAGE[state.viewMode]),
    [sortedOrders, state.viewMode]
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, newStatus: OrderStatus) => {
      const order = state.orders.find(o => o._id === orderId);
      if (!order || !validTransitions[order.status].includes(newStatus)) {
        toast.error(isRtl ? 'انتقال غير صالح' : 'Invalid transition', { position: isRtl ? 'top-left' : 'top-right' });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        const response = await factoryOrdersAPI.updateStatus(orderId, { status: newStatus });
        dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status: newStatus });
        if (socket && isConnected) {
          emit('orderStatusUpdated', { orderId, status: newStatus });
        }
        toast.success(isRtl ? 'تم تحديث حالة الطلب بنجاح' : 'Order status updated successfully', {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error('Update order status error:', err.message);
        toast.error(err.message || (isRtl ? 'فشل في تحديث الحالة' : 'Failed to update status'), {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [state.orders, isRtl, socket, isConnected, emit]
  );

  const confirmProduction = useCallback(
    async (orderId: string) => {
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        const response = await factoryOrdersAPI.confirmProduction(orderId);
        dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status: 'completed' });
        if (socket && isConnected) {
          emit('factoryOrderCompleted', { orderId, orderNumber: state.orders.find(o => o._id === orderId)?.orderNumber });
        }
        toast.success(isRtl ? 'تم تأكيد الإنتاج بنجاح' : 'Production confirmed successfully', {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error('Confirm production error:', err.message);
        toast.error(err.message || (isRtl ? 'فشل في تأكيد الإنتاج' : 'Failed to confirm production'), {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [state.orders, isRtl, socket, isConnected, emit]
  );

  const handleAssignChefs = useCallback(
    async (orderId: string, formData: AssignChefsForm) => {
      if (!formData.items.length || formData.items.some(item => !item.itemId || !item.assignedTo)) {
        toast.error(isRtl ? 'بيانات التعيين غير صالحة' : 'Invalid assignment data', {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        const response = await factoryOrdersAPI.assignChefs(orderId, formData);
        dispatch({ type: 'TASK_ASSIGNED', orderId, items: formData.items });
        dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: false });
        dispatch({ type: 'SET_ASSIGN_FORM', payload: { items: [] } });
        if (socket && isConnected) {
          emit('taskAssigned', { orderId, items: formData.items });
        }
        toast.success(isRtl ? 'تم تعيين الشيفات بنجاح' : 'Chefs assigned successfully', {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error('Assign chefs error:', err.message);
        toast.error(err.message || (isRtl ? 'فشل في تعيين الشيفات' : 'Failed to assign chefs'), {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [isRtl, socket, isConnected, emit]
  );

  const handleCreateOrder = useCallback(
    async () => {
      const { productId, quantity, notes, priority } = state.createFormData;
      if (!productId || !quantity || !Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
        toast.error(isRtl ? 'يرجى إدخال بيانات صالحة للمنتج والكمية' : 'Please enter valid product and quantity', {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      const orderNumber = `ORD-${Date.now()}`;
      const data: CreateFactoryOrderRequest = {
        orderNumber,
        items: [{ product: productId, quantity: Number(quantity) }],
        notes: notes.trim(),
        priority: priority || 'medium',
      };
      dispatch({ type: 'SET_SUBMITTING', payload: 'create' });
      try {
        const response = await factoryOrdersAPI.create(data);
        dispatch({ type: 'ADD_ORDER', payload: response.data });
        dispatch({ type: 'SET_CREATE_MODAL', isOpen: false });
        dispatch({ type: 'SET_CREATE_FORM', payload: { productId: '', quantity: '', notes: '', priority: 'medium' } });
        if (socket && isConnected) {
          emit('newFactoryOrder', response.data);
        }
        toast.success(isRtl ? 'تم إنشاء الطلب بنجاح' : 'Order created successfully', {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error('Create order error:', err.message);
        toast.error(err.message || (isRtl ? 'فشل في إنشاء الطلب' : 'Failed to create order'), {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [state.createFormData, isRtl, socket, isConnected, emit]
  );

  const handleViewModeToggle = useCallback(() => {
    dispatch({ type: 'SET_VIEW_MODE', payload: state.viewMode === 'card' ? 'table' : 'card' });
  }, [state.viewMode]);

  const handlePageChange = useCallback((page: number) => {
    dispatch({ type: 'SET_PAGE', payload: page });
    if (listRef.current) {
      listRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const handleSortChange = useCallback((value: string) => {
    dispatch({ type: 'SET_SORT', by: value as 'date' | 'totalQuantity', order: state.sortOrder });
  }, [state.sortOrder]);

  const handleSortOrderToggle = useCallback(() => {
    dispatch({ type: 'SET_SORT', by: state.sortBy, order: state.sortOrder === 'asc' ? 'desc' : 'asc' });
  }, [state.sortBy, state.sortOrder]);

  const openAssignModal = useCallback((order: FactoryOrder) => {
    dispatch({ type: 'SET_SELECTED_ORDER', payload: order });
    dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: true });
    dispatch({ type: 'SET_ASSIGN_FORM', payload: { items: order.items.map(item => ({ itemId: item._id, assignedTo: item.assignedTo?._id || '' })) } });
  }, []);

  const renderOrderItem = useCallback(
    (item: FactoryOrder['items'][0]) => {
      const productName = isRtl ? item.product.name : (item.product.nameEn || item.product.name);
      const unit = translateUnit(item.product.unit, isRtl);
      return (
        <div key={item._id} className="flex justify-between py-1">
          <span>{productName}</span>
          <span>
            {item.quantity} {unit}
          </span>
        </div>
      );
    },
    [isRtl]
  );

  const renderSkeleton = useCallback(
    () =>
      state.viewMode === 'card' ? (
        Array.from({ length: ORDERS_PER_PAGE.card }).map((_, i) => <OrderCardSkeleton key={i} />)
      ) : (
        <OrderTableSkeleton />
      ),
    [state.viewMode]
  );

  return (
    <div className={`container mx-auto p-4 ${isRtl ? 'text-right' : 'text-left'}`}>
      <h1 className="text-2xl font-bold mb-4">{t('inventory_orders')}</h1>

      {/* Filters and Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <ProductSearchInput
            value={state.searchQuery}
            onChange={handleSearchChange}
            placeholder={t('search_orders')}
            isRtl={isRtl}
          />
          <Select
            options={statusOptions.map(opt => ({ ...opt, label: t(opt.label) }))}
            value={state.filterStatus}
            onChange={(value) => dispatch({ type: 'SET_FILTER_STATUS', payload: value })}
            placeholder={t('filter_by_status')}
            className="w-40"
          />
          <Select
            options={sortOptions.map(opt => ({ ...opt, label: t(opt.label) }))}
            value={state.sortBy}
            onChange={handleSortChange}
            placeholder={t('sort_by')}
            className="w-40"
          />
          <Button
            variant="outline"
            onClick={handleSortOrderToggle}
            className="px-2"
            title={state.sortOrder === 'asc' ? t('sort_ascending') : t('sort_descending')}
          >
            {state.sortOrder === 'asc' ? '↑' : '↓'}
          </Button>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={handleViewModeToggle}
            className="px-2"
            title={state.viewMode === 'card' ? t('table_view') : t('card_view')}
          >
            {state.viewMode === 'card' ? <Table2 size={20} /> : <Grid size={20} />}
          </Button>
          {user?.role === 'admin' && (
            <Button
              onClick={() => dispatch({ type: 'SET_CREATE_MODAL', isOpen: true })}
              className="flex items-center gap-2"
            >
              <PlusCircle size={20} />
              {t('create_order')}
            </Button>
          )}
        </div>
      </div>

      {/* Error and Socket Status */}
      {state.error && (
        <div className="bg-red-100 text-red-700 p-4 rounded mb-4 flex items-center gap-2">
          <AlertCircle size={20} />
          {state.error}
        </div>
      )}
      {!state.socketConnected && state.socketError && (
        <div className="bg-yellow-100 text-yellow-700 p-4 rounded mb-4 flex items-center gap-2">
          <AlertCircle size={20} />
          {state.socketError}
        </div>
      )}

      {/* Orders Display */}
      <Suspense fallback={renderSkeleton()}>
        {state.loading ? (
          renderSkeleton()
        ) : paginatedOrders.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            {t('no_orders_found')}
          </div>
        ) : (
          <motion.div
            ref={listRef}
            className={state.viewMode === 'card' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'w-full'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {state.viewMode === 'card' ? (
              paginatedOrders.map(order => (
                <OrderCard
                  key={order._id}
                  order={order}
                  isRtl={isRtl}
                  translateUnit={translateUnit}
                  onStatusUpdate={updateOrderStatus}
                  onConfirmProduction={confirmProduction}
                  onAssignChefs={openAssignModal}
                  isSubmitting={state.submitting === order._id}
                  userRole={user?.role}
                  renderOrderItem={renderOrderItem}
                />
              ))
            ) : (
              <OrderTable
                orders={paginatedOrders}
                isRtl={isRtl}
                translateUnit={translateUnit}
                onStatusUpdate={updateOrderStatus}
                onConfirmProduction={confirmProduction}
                onAssignChefs={openAssignModal}
                isSubmitting={state.submitting}
                userRole={user?.role}
              />
            )}
          </motion.div>
        )}
      </Suspense>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination
            currentPage={state.currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            isRtl={isRtl}
          />
        </div>
      )}

      {/* Create Order Modal */}
      <Modal
        isOpen={state.isCreateModalOpen}
        onClose={() => dispatch({ type: 'SET_CREATE_MODAL', isOpen: false })}
        title={t('create_order')}
        isRtl={isRtl}
      >
        <div className="space-y-4">
          <Input
            label={t('order_number')}
            value={`ORD-${Date.now()}`}
            disabled
            isRtl={isRtl}
          />
          <ProductDropdown
            products={state.products}
            value={state.createFormData.productId}
            onChange={(value) =>
              dispatch({ type: 'SET_CREATE_FORM', payload: { ...state.createFormData, productId: value } })
            }
            placeholder={t('select_product')}
            isRtl={isRtl}
          />
          <Input
            label={t('quantity')}
            type="number"
            value={state.createFormData.quantity}
            onChange={(e) =>
              dispatch({ type: 'SET_CREATE_FORM', payload: { ...state.createFormData, quantity: e.target.value } })
            }
            placeholder={t('enter_quantity')}
            min="1"
            isRtl={isRtl}
          />
          <Select
            options={priorityOptions.map(opt => ({ ...opt, label: t(opt.label) }))}
            value={state.createFormData.priority}
            onChange={(value) =>
              dispatch({ type: 'SET_CREATE_FORM', payload: { ...state.createFormData, priority: value } })
            }
            placeholder={t('select_priority')}
            isRtl={isRtl}
          />
          <Input
            label={t('notes')}
            value={state.createFormData.notes}
            onChange={(e) =>
              dispatch({ type: 'SET_CREATE_FORM', payload: { ...state.createFormData, notes: e.target.value } })
            }
            placeholder={t('enter_notes')}
            isRtl={isRtl}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => dispatch({ type: 'SET_CREATE_MODAL', isOpen: false })}
              disabled={state.submitting === 'create'}
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handleCreateOrder}
              disabled={state.submitting === 'create'}
              className="flex items-center gap-2"
            >
              {state.submitting === 'create' ? t('submitting') : t('create')}
              {state.submitting === 'create' && <div className="animate-spin h-5 w-5 border-2 border-t-transparent rounded-full" />}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Assign Chefs Modal */}
      <AssignChefsModal
        isOpen={state.isAssignModalOpen}
        onClose={() => dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: false })}
        order={state.selectedOrder}
        chefs={state.chefs}
        formData={state.assignFormData}
        onSubmit={(formData) => handleAssignChefs(state.selectedOrder?._id || '', formData)}
        isSubmitting={state.submitting === state.selectedOrder?._id}
        isRtl={isRtl}
      />
    </div>
  );
};