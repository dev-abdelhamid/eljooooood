import React, { useReducer, useEffect, useMemo, Suspense, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Modal } from '../components/UI/Modal';
import { Select } from '../components/UI/Select';
import { Input } from '../components/UI/Input';
import { ShoppingCart, AlertCircle, PlusCircle, Table2, Grid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { factoryOrdersAPI, chefsAPI, productsAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { useOrderNotifications } from '../hooks/useOrderNotifications';
import { FactoryOrder, Chef, AssignChefsForm, OrderStatus } from '../types/types';
import Pagination from '../components/Shared/Pagination';
import AssignChefsModal from '../components/Shared/AssignChefsModal';
import OrderTable from '../components/Shared/OrderTable';
import OrderCard from '../components/Shared/OrderCard';
import OrderCardSkeleton from '../components/Shared/OrderCardSkeleton';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';
import { ProductSearchInput, ProductDropdown } from './OrdersTablePage';

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
  department: { _id: string; name: string; nameEn?: string };
}

interface State {
  orders: FactoryOrder[];
  selectedOrder: FactoryOrder | null;
  chefs: Chef[];
  products: Product[];
  isAssignModalOpen: boolean;
  isCreateModalOpen: boolean;
  assignFormData: AssignChefsForm;
  createFormData: { productId: string; quantity: string; notes: string };
  filterStatus: string;
  searchQuery: string;
  sortBy: 'date' | 'totalQuantity';
  sortOrder: 'asc' | 'desc';
  currentPage: number;
  loading: boolean;
  error: string | null;
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
  createFormData: { productId: '', quantity: '', notes: '' },
  filterStatus: '',
  searchQuery: '',
  sortBy: 'date',
  sortOrder: 'desc',
  currentPage: 1,
  loading: true,
  error: null,
  submitting: null,
  socketConnected: false,
  socketError: null,
  viewMode: 'card',
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_ORDERS': return { ...state, orders: action.payload, error: null, currentPage: 1 };
    case 'ADD_ORDER': return { ...state, orders: [action.payload, ...state.orders.filter(o => o.id !== action.payload.id)] };
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
      orders: state.orders.map(o => o.id === action.orderId ? { ...o, status: action.status! } : o),
      selectedOrder: state.selectedOrder && state.selectedOrder.id === action.orderId
        ? { ...state.selectedOrder, status: action.status! } : state.selectedOrder,
    };
    case 'UPDATE_ITEM_STATUS': return {
      ...state,
      orders: state.orders.map(order =>
        order.id === action.orderId
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
      selectedOrder: state.selectedOrder && state.selectedOrder.id === action.orderId
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
        order.id === action.orderId
          ? {
              ...order,
              items: order.items.map(i => {
                const assignment = action.items?.find(a => a._id === i._id);
                return assignment
                  ? {
                      ...i,
                      assignedTo: assignment.assignedTo
                        ? {
                            ...assignment.assignedTo,
                            displayName: state.isRtl ? assignment.assignedTo.name : assignment.assignedTo.nameEn || assignment.assignedTo.name,
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
      selectedOrder: state.selectedOrder && state.selectedOrder.id === action.orderId
        ? {
            ...state.selectedOrder,
            items: state.selectedOrder.items.map(i => {
              const assignment = action.items?.find(a => a._id === i._id);
              return assignment
                ? {
                    ...i,
                    assignedTo: assignment.assignedTo
                      ? {
                          ...assignment.assignedTo,
                          displayName: state.isRtl ? assignment.assignedTo.name : assignment.assignedTo.nameEn || assignment.assignedTo.name,
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
  pending: ['approved', 'cancelled'],
  approved: ['in_production', 'cancelled'],
  in_production: ['completed', 'cancelled'],
  completed: [],
  in_transit: [],
  delivered: [],
  cancelled: [],
};
const statusOptions = [
  { value: '', label: 'all_statuses' },
  { value: 'pending', label: 'pending' },
  { value: 'approved', label: 'approved' },
  { value: 'in_production', label: 'in_production' },
  { value: 'completed', label: 'completed' },
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
  const playNotificationSound = useOrderNotifications(dispatch, { current: state }, user);

  const calculateTotalQuantity = useCallback((order: FactoryOrder) => {
    return order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }, []);

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
          sortBy: state.sortBy,
          sortOrder: state.sortOrder,
        };
        if (user.role === 'production' && user.department) query.department = user.department._id;
        const [ordersResponse, chefsResponse, productsResponse] = await Promise.all([
          factoryOrdersAPI.getAll(query),
          chefsAPI.getAll(),
          productsAPI.getAll(),
        ]);

        if (!Array.isArray(ordersResponse)) {
          throw new Error('Invalid orders response: Expected an array');
        }
        if (!Array.isArray(chefsResponse)) {
          throw new Error('Invalid chefs response: Expected an array');
        }
        if (!Array.isArray(productsResponse)) {
          throw new Error('Invalid products response: Expected an array');
        }

        const mappedOrders: FactoryOrder[] = ordersResponse
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
                  displayProductName: isRtl ? item.product?.name : item.product?.nameEn || item.product?.name,
                  quantity: Number(item.quantity) || 1,
                  unit: item.product?.unit || 'unit',
                  unitEn: item.product?.unitEn,
                  displayUnit: translateUnit(item.product?.unit || 'unit', isRtl),
                  department: {
                    _id: item.product?.department?._id || 'unknown',
                    name: item.product?.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: item.product?.department?.nameEn,
                    displayName: isRtl ? item.product?.department?.name : item.product?.department?.nameEn || item.product?.department?.name,
                  },
                  assignedTo: item.assignedTo
                    ? {
                        _id: item.assignedTo._id,
                        username: item.assignedTo.username,
                        name: item.assignedTo.name || (isRtl ? 'غير معروف' : 'Unknown'),
                        nameEn: item.assignedTo.nameEn,
                        displayName: isRtl ? item.assignedTo.name : item.assignedTo.nameEn || item.assignedTo.name,
                        department: item.assignedTo.department,
                      }
                    : undefined,
                  status: item.status || 'pending',
                }))
              : [],
            status: order.status || 'pending',
            date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
            notes: order.notes || '',
            priority: order.priority || 'medium',
            createdBy: order.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
          }));

        dispatch({ type: 'SET_ORDERS', payload: mappedOrders });
        dispatch({
          type: 'SET_CHEFS',
          payload: chefsResponse
            .filter((chef: any) => chef && chef.user?._id)
            .map((chef: any) => ({
              _id: chef._id,
              userId: chef.user._id,
              name: chef.user?.name || chef.name || (isRtl ? 'غير معروف' : 'Unknown'),
              nameEn: chef.user?.nameEn || chef.nameEn,
              displayName: isRtl ? (chef.user?.name || chef.name) : (chef.user?.nameEn || chef.nameEn || chef.user?.name || chef.name),
              department: chef.department
                ? {
                    _id: chef.department._id,
                    name: chef.department.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: chef.department.nameEn,
                    displayName: isRtl ? chef.department.name : (chef.department.nameEn || chef.department.name),
                  }
                : null,
              status: chef.status || 'active',
            })),
        });
        dispatch({
          type: 'SET_PRODUCTS',
          payload: productsResponse
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
                displayName: isRtl ? product.department?.name : product.department?.nameEn || product.department?.name,
              },
            }))
            .sort((a: Product, b: Product) => {
              const nameA = isRtl ? a.name : a.nameEn || a.name;
              const nameB = isRtl ? b.name : b.nameEn || b.name;
              return nameA.localeCompare(nameB, language);
            }),
        });
        dispatch({ type: 'SET_ERROR', payload: null });
      } catch (err: any) {
        console.error('Fetch data error:', err.message);
        if (retryCount < 3) {
          setTimeout(() => fetchData(retryCount + 1), 2000);
          return;
        }
        const errorMessage = err.response?.status === 404
          ? isRtl ? 'لم يتم العثور على طلبات' : 'No orders found'
          : isRtl ? `خطأ في جلب الطلبات: ${err.message}` : `Error fetching orders: ${err.message}`;
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [user, state.sortBy, state.sortOrder, isRtl, language]
  );

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
        id: order._id,
        orderNumber: order.orderNumber,
        items: Array.isArray(order.items)
          ? order.items.map((item: any) => ({
              _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
              productId: item.product?._id || 'unknown',
              productName: item.product?.name || (isRtl ? 'غير معروف' : 'Unknown'),
              productNameEn: item.product?.nameEn,
              displayProductName: isRtl ? item.product?.name : item.product?.nameEn || item.product?.name,
              quantity: Number(item.quantity) || 1,
              unit: item.product?.unit || 'unit',
              unitEn: item.product?.unitEn,
              displayUnit: translateUnit(item.product?.unit || 'unit', isRtl),
              department: {
                _id: item.product?.department?._id || 'unknown',
                name: item.product?.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                nameEn: item.product?.department?.nameEn,
                displayName: isRtl ? item.product?.department?.name : item.product?.department?.nameEn || item.product?.department?.name,
              },
              assignedTo: item.assignedTo
                ? {
                    _id: item.assignedTo._id,
                    username: item.assignedTo.username,
                    name: item.assignedTo.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: item.assignedTo.nameEn,
                    displayName: isRtl ? item.assignedTo.name : item.assignedTo.nameEn || item.assignedTo.name,
                    department: item.assignedTo.department,
                  }
                : undefined,
              status: item.status || 'pending',
            }))
          : [],
        status: order.status || 'pending',
        date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
        notes: order.notes || '',
        priority: order.priority || 'medium',
        createdBy: order.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
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
      toast.info(isRtl ? `تم تحديث حالة الطلب ${orderId} إلى ${status}` : `Order ${orderId} status updated to ${status}`, {
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
      if (!orderId || !Array.isArray(items)) {
        console.warn('Invalid task assigned data:', { orderId, items });
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
        .filter(order => order && order.id && order.orderNumber)
        .filter(
          order =>
            normalizeText(order.orderNumber || '').includes(normalizedQuery) ||
            normalizeText(order.notes || '').includes(normalizedQuery) ||
            normalizeText(order.createdBy || '').includes(normalizedQuery) ||
            order.items.some(item =>
              normalizeText(item.displayProductName || '').includes(normalizedQuery)
            )
        )
        .filter(
          order =>
            (!state.filterStatus || order.status === state.filterStatus) &&
            (user?.role === 'production' && user?.department
              ? order.items.some(item => item.department._id === user.department._id)
              : true)
        );
    },
    [state.orders, state.searchQuery, state.filterStatus, user]
  );

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
    () => sortedOrders.slice((state.currentPage - 1) * ORDERS_PER_PAGE[state.viewMode], state.currentPage * ORDERS_PER_PAGE[state.viewMode]),
    [sortedOrders, state.currentPage, state.viewMode]
  );

  const totalPages = useMemo(
    () => Math.ceil(sortedOrders.length / ORDERS_PER_PAGE[state.viewMode]),
    [sortedOrders, state.viewMode]
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, newStatus: OrderStatus) => {
      const order = state.orders.find(o => o.id === orderId);
      if (!order || !validTransitions[order.status].includes(newStatus)) {
        toast.error(isRtl ? 'انتقال غير صالح' : 'Invalid transition', { position: isRtl ? 'top-left' : 'top-right' });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        await factoryOrdersAPI.updateStatus(orderId, { status: newStatus });
        dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status: newStatus });
        if (socket && isConnected) {
          emit('orderStatusUpdated', { orderId, status: newStatus });
        }
        toast.success(isRtl ? `تم تحديث الحالة إلى: ${t[newStatus]}` : `Order status updated to: ${t[newStatus]}`, {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error('Update order status error:', err.message);
        toast.error(isRtl ? `فشل في تحديث الحالة: ${err.message}` : `Failed to update status: ${err.message}`, {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [state.orders, isRtl, socket, isConnected, emit, t]
  );

  const updateItemStatus = useCallback(
    async (orderId: string, itemId: string, status: FactoryOrder['items'][0]['status']) => {
      if (!user?.id) {
        toast.error(isRtl ? 'لا يوجد مستخدم مرتبط' : 'No user associated', { position: isRtl ? 'top-left' : 'top-right' });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        await factoryOrdersAPI.updateItemStatus(orderId, itemId, { status });
        dispatch({ type: 'UPDATE_ITEM_STATUS', orderId, payload: { itemId, status } });
        if (socket && isConnected) {
          emit('itemStatusUpdated', { orderId, itemId, status });
        }
        toast.success(isRtl ? `تم تحديث حالة العنصر إلى: ${t[status]}` : `Item status updated to: ${t[status]}`, {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error('Update item status error:', err.message);
        toast.error(isRtl ? `فشل في تحديث حالة العنصر: ${err.message}` : `Failed to update item status: ${err.message}`, {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [isRtl, user, socket, isConnected, emit, t]
  );

  const assignChefs = useCallback(
    async (orderId: string) => {
      if (!user?.id || state.assignFormData.items.some(item => !item.assignedTo)) {
        toast.error(isRtl ? 'يرجى تعيين شيف واحد على الأقل' : 'Please assign at least one chef', {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        await factoryOrdersAPI.assignChef(orderId, { items: state.assignFormData.items });
        const items = state.assignFormData.items.map(item => ({
          _id: item.itemId,
          assignedTo: state.chefs.find(chef => chef.userId === item.assignedTo) || {
            _id: item.assignedTo,
            name: isRtl ? 'غير معروف' : 'Unknown',
            department: { _id: 'unknown', name: isRtl ? 'غير معروف' : 'Unknown' },
          },
          status: 'assigned',
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
        console.error('Assign chefs error:', err.message);
        toast.error(isRtl ? `فشل في تعيين الشيفات: ${err.message}` : `Failed to assign chefs: ${err.message}`, {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [user, state.assignFormData, state.chefs, socket, isConnected, emit, isRtl]
  );

  const createOrder = useCallback(
    async () => {
      if (!user?.id || !state.createFormData.productId || !state.createFormData.quantity || Number(state.createFormData.quantity) <= 0) {
        toast.error(isRtl ? 'يرجى ملء جميع الحقول المطلوبة بقيم صحيحة' : 'Please fill all required fields with valid values', {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: 'create' });
      try {
        const response = await factoryOrdersAPI.create({
          items: [
            {
              product: state.createFormData.productId,
              quantity: Number(state.createFormData.quantity),
            },
          ],
          notes: state.createFormData.notes,
          priority: 'medium',
        });
        const newOrder: FactoryOrder = {
          id: response._id,
          orderNumber: response.orderNumber,
          items: response.items.map((item: any) => ({
            _id: item._id,
            productId: item.product._id,
            productName: item.product.name,
            productNameEn: item.product.nameEn,
            displayProductName: isRtl ? item.product.name : item.product.nameEn || item.product.name,
            quantity: Number(item.quantity),
            unit: item.product.unit,
            unitEn: item.product.unitEn,
            displayUnit: translateUnit(item.product.unit, isRtl),
            department: {
              _id: item.product.department._id,
              name: item.product.department.name,
              nameEn: item.product.department.nameEn,
              displayName: isRtl ? item.product.department.name : item.product.department.nameEn || item.product.department.name,
            },
            status: item.status || 'pending',
          })),
          status: response.status || 'pending',
          date: formatDate(new Date(response.createdAt), language),
          notes: response.notes || '',
          priority: response.priority || 'medium',
          createdBy: user.name || (isRtl ? 'غير معروف' : 'Unknown'),
        };
        dispatch({ type: 'ADD_ORDER', payload: newOrder });
        dispatch({ type: 'SET_CREATE_MODAL', isOpen: false });
        dispatch({ type: 'SET_CREATE_FORM', payload: { productId: '', quantity: '', notes: '' } });
        if (socket && isConnected) {
          emit('newFactoryOrder', newOrder);
        }
        toast.success(isRtl ? 'تم إنشاء طلب الإنتاج بنجاح' : 'Production order created successfully', {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error('Create order error:', err.message);
        toast.error(isRtl ? `فشل في إنشاء الطلب: ${err.message}` : `Failed to create order: ${err.message}`, {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [user, state.createFormData, isRtl, socket, isConnected, emit, language]
  );

  const openAssignModal = useCallback(
    (order: FactoryOrder) => {
      if (order.status !== 'approved') {
        toast.error(isRtl ? 'الطلب لم يتم الموافقة عليه' : 'Order not approved', {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      dispatch({ type: 'SET_SELECTED_ORDER', payload: order });
      dispatch({
        type: 'SET_ASSIGN_FORM',
        payload: {
          items: order.items
            .filter(item => !item.assignedTo)
            .map(item => ({
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
    [isRtl]
  );

  const handlePageChange = useCallback((page: number) => {
    dispatch({ type: 'SET_PAGE', payload: page });
  }, []);

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto">
      <Suspense fallback={<OrderTableSkeleton isRtl={isRtl} />}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }} className="mb-6">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div className="w-full sm:w-auto text-center sm:text-start">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center justify-center sm:justify-start gap-2">
                <ShoppingCart className="w-6 h-6 text-amber-700" />
                {t.productionOrders}
              </h1>
              <p className="text-sm text-gray-600 mt-1">{t.manageProductionOrders}</p>
            </div>
            <div className="flex gap-3 flex-wrap justify-center sm:justify-end w-full sm:w-auto">
              <Button
                variant="primary"
                onClick={() => dispatch({ type: 'SET_CREATE_MODAL', isOpen: true })}
                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white rounded-full px-4 py-2 text-sm shadow transition-all duration-300"
              >
                <PlusCircle className="w-5 h-5" />
                {t.createNewOrder}
              </Button>
              <Button
                variant="secondary"
                onClick={() => fetchData()}
                className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full px-4 py-2 text-sm shadow transition-all duration-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {t.refresh}
              </Button>
            </div>
          </div>
          <Card className="p-4 bg-white shadow-md rounded-xl border border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.search}</label>
                <ProductSearchInput
                  value={state.searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  ariaLabel={t.search}
                  className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.filterByStatus}</label>
                <ProductDropdown
                  options={statusOptions.map(opt => ({
                    value: opt.value,
                    label: t[opt.label],
                  }))}
                  value={state.filterStatus}
                  onChange={(value) => dispatch({ type: 'SET_FILTER_STATUS', payload: value })}
                  ariaLabel={t.filterByStatus}
                  className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.sortBy}</label>
                <ProductDropdown
                  options={sortOptions.map(opt => ({
                    value: opt.value,
                    label: t[opt.label],
                  }))}
                  value={state.sortBy}
                  onChange={(value) => dispatch({ type: 'SET_SORT', by: value as any, order: state.sortOrder })}
                  ariaLabel={t.sortBy}
                  className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.sortOrder}</label>
                <ProductDropdown
                  options={[
                    { value: 'asc', label: t.ascending },
                    { value: 'desc', label: t.descending },
                  ]}
                  value={state.sortOrder}
                  onChange={(value) => dispatch({ type: 'SET_SORT', by: state.sortBy, order: value as any })}
                  ariaLabel={t.sortOrder}
                  className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
                />
              </div>
            </div>
            <div className={`flex flex-col sm:flex-row justify-between items-center gap-4 mt-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div className="text-sm text-gray-600">
                {t.ordersCount}: {filteredOrders.length}
              </div>
              <Button
                variant="secondary"
                onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: state.viewMode === 'card' ? 'table' : 'card' })}
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full px-4 py-2 text-sm shadow transition-all duration-300"
              >
                {state.viewMode === 'card' ? <Table2 className="w-5 h-5" /> : <Grid className="w-5 h-5" />}
                {state.viewMode === 'card' ? t.viewAsTable : t.viewAsCards}
              </Button>
            </div>
          </Card>
          <div className="mt-6 min-h-[400px]">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  className="mt-6"
                >
                  <Card className="p-6 max-w-md mx-auto text-center bg-red-50 shadow-md rounded-xl border border-red-100">
                    <div className={`flex items-center justify-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <AlertCircle className="w-6 h-6 text-red-600" />
                      <p className="text-sm font-medium text-red-600">{state.error}</p>
                    </div>
                    <Button
                      variant="primary"
                      onClick={() => fetchData()}
                      className="mt-4 bg-amber-600 hover:bg-amber-700 text-white rounded-full px-4 py-2 text-sm shadow transition-all duration-300"
                    >
                      {t.retry}
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
                      <h3 className="text-lg font-medium text-gray-800 mb-2">{t.noOrders}</h3>
                      <p className="text-sm text-gray-500">
                        {state.filterStatus || state.searchQuery ? t.noMatchingOrders : t.noOrdersYet}
                      </p>
                    </Card>
                  ) : (
                    <>
                      {state.viewMode === 'table' ? (
                        <OrderTable
                          orders={paginatedOrders}
                          calculateAdjustedTotal={() => ''} // No total amount for factory orders
                          calculateTotalQuantity={calculateTotalQuantity}
                          translateUnit={translateUnit}
                          updateOrderStatus={updateOrderStatus}
                          openAssignModal={openAssignModal}
                          submitting={state.submitting}
                          isRtl={isRtl}
                          startIndex={(state.currentPage - 1) * ORDERS_PER_PAGE[state.viewMode] + 1}
                        />
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {paginatedOrders.map(order => (
                            <motion.div
                              key={order.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.3 }}
                            >
                              <OrderCard
                                order={order}
                                calculateAdjustedTotal={() => ''} // No total amount for factory orders
                                calculateTotalQuantity={calculateTotalQuantity}
                                translateUnit={translateUnit}
                                updateOrderStatus={updateOrderStatus}
                                openAssignModal={openAssignModal}
                                submitting={state.submitting}
                                isRtl={isRtl}
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
                    isRtl={isRtl}
                  />
                  <Modal
                    isOpen={state.isCreateModalOpen}
                    onClose={() => {
                      dispatch({ type: 'SET_CREATE_MODAL', isOpen: false });
                      dispatch({ type: 'SET_CREATE_FORM', payload: { productId: '', quantity: '', notes: '' } });
                    }}
                    title={t.createNewProductionOrder}
                    size="md"
                    className="bg-white rounded-xl shadow-xl border border-gray-100"
                  >
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        createOrder();
                      }}
                      className="space-y-6"
                    >
                      <div>
                        <label className={`block text-sm font-medium text-gray-900 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}>
                          {t.product}
                        </label>
                        <Select
                          id="product-select"
                          options={[
                            { value: '', label: t.selectProduct },
                            ...state.products.map(product => ({
                              value: product._id,
                              label: isRtl ? product.name : product.nameEn || product.name,
                            })),
                          ]}
                          value={state.createFormData.productId}
                          onChange={(value) => dispatch({ type: 'SET_CREATE_FORM', payload: { ...state.createFormData, productId: value } })}
                          className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
                          aria-label={t.selectProduct}
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium text-gray-900 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}>
                          {t.quantity}
                        </label>
                        <Input
                          type="number"
                          value={state.createFormData.quantity}
                          onChange={(e) => dispatch({ type: 'SET_CREATE_FORM', payload: { ...state.createFormData, quantity: e.target.value } })}
                          placeholder={t.enterQuantity}
                          className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
                          aria-label={t.quantity}
                          min="1"
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium text-gray-900 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}>
                          {t.notes}
                        </label>
                        <Input
                          type="text"
                          value={state.createFormData.notes}
                          onChange={(e) => dispatch({ type: 'SET_CREATE_FORM', payload: { ...state.createFormData, notes: e.target.value } })}
                          placeholder={t.enterNotes}
                          className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
                          aria-label={t.notes}
                        />
                      </div>
                      {state.error && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={`p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}
                        >
                          <AlertCircle className="w-5 h-5 text-red-600" />
                          <span className="text-red-600 text-sm">{state.error}</span>
                        </motion.div>
                      )}
                      <div className={`flex justify-end gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            dispatch({ type: 'SET_CREATE_MODAL', isOpen: false });
                            dispatch({ type: 'SET_CREATE_FORM', payload: { productId: '', quantity: '', notes: '' } });
                          }}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg px-4 py-2 text-sm shadow-sm"
                          aria-label={t.cancel}
                        >
                          {t.cancel}
                        </Button>
                        <Button
                          type="submit"
                          variant="primary"
                          disabled={state.submitting !== null}
                          className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-4 py-2 text-sm shadow-sm"
                          aria-label={t.createOrder}
                        >
                          {state.submitting ? t.loading : t.createOrder}
                        </Button>
                      </div>
                    </form>
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
