import React, { useReducer, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Select } from '../components/UI/Select';
import { Input } from '../components/UI/Input';
import { ShoppingCart, AlertCircle, Search, Table2, Grid, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { ordersAPI, chefsAPI, branchesAPI } from '../services/api';
import {formatDate} from '../utils/formatDate';
import {  exportToExcel, normalizeText, translateUnit } from '../utils/utils';
import { useOrderNotifications } from '../hooks/useOrderNotifications';
import { Order, Chef, Branch, AssignChefsForm, OrderStatus } from '../types/types';
import { useNavigate } from 'react-router-dom';
import { OrderCardSkeleton, OrderTableSkeleton } from '../components/Shared/OrderSkeletons';
import Pagination from '../components/Shared/Pagination';
import AssignChefsModal from '../components/Shared/AssignChefsModal';
import OrderTable from '../components/Shared/OrderTable';
import OrderCard from '../components/Shared/OrderCard';

interface Action {
  type: string;
  payload?: any;
  orderId?: string;
  status?: Order['status'];
  items?: any[];
  by?: 'date' | 'totalAmount' | 'priority';
  order?: 'asc' | 'desc';
  isOpen?: boolean;
}

const initialState: State = {
  orders: [],
  selectedOrder: null,
  chefs: [],
  branches: [],
  isAssignModalOpen: false,
  assignFormData: { items: [] },
  filterStatus: '',
  filterBranch: '',
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
    case 'SET_ORDERS':
      return { ...state, orders: action.payload, error: '', currentPage: 1 };
    case 'ADD_ORDER':
      return { ...state, orders: [action.payload, ...state.orders.filter((o) => o.id !== action.payload.id)] };
    case 'SET_SELECTED_ORDER':
      return { ...state, selectedOrder: action.payload };
    case 'SET_CHEFS':
      return { ...state, chefs: action.payload };
    case 'SET_BRANCHES':
      return { ...state, branches: action.payload };
    case 'SET_MODAL':
      return { ...state, isAssignModalOpen: action.isOpen ?? false };
    case 'SET_ASSIGN_FORM':
      return { ...state, assignFormData: action.payload };
    case 'SET_FILTER_STATUS':
      return { ...state, filterStatus: action.payload, currentPage: 1 };
    case 'SET_FILTER_BRANCH':
      return { ...state, filterBranch: action.payload, currentPage: 1 };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload, currentPage: 1 };
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
        orders: state.orders.map((o) => (o.id === action.orderId ? { ...o, status: action.status! } : o)),
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
                status: order.items.every((i) => i.status === 'completed') && order.status !== 'completed' ? 'completed' : order.status,
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
                  state.selectedOrder.items.every((i) => i.status === 'completed') && state.selectedOrder.status !== 'completed'
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
                              ...assignment.assignedTo,
                              displayName: state.isRtl ? assignment.assignedTo.name : assignment.assignedTo.nameEn || assignment.assignedTo.name,
                            }
                          : undefined,
                        status: assignment.status || i.status,
                      }
                    : i;
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
                              ...assignment.assignedTo,
                              displayName: state.isRtl ? assignment.assignedTo.name : assignment.assignedTo.nameEn || assignment.assignedTo.name,
                            }
                          : undefined,
                        status: assignment.status || i.status,
                      }
                    : i;
                }),
                status: state.selectedOrder.items.every((i) => i.status === 'assigned') ? 'in_production' : state.selectedOrder.status,
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
const validTransitions: Record<OrderStatus, OrderStatus[]> = {
  pending: ['approved', 'cancelled'],
  approved: ['in_production', 'cancelled'],
  in_production: ['completed', 'cancelled'],
  completed: ['in_transit'],
  in_transit: ['delivered'],
  delivered: [],
  cancelled: [],
};
const statusOptions = [
  { value: '', label: 'all_statuses' },
  { value: 'pending', label: 'pending' },
  { value: 'approved', label: 'approved' },
  { value: 'in_production', label: 'in_production' },
  { value: 'completed', label: 'completed' },
  { value: 'in_transit', label: 'in_transit' },
  { value: 'delivered', label: 'delivered' },
  { value: 'cancelled', label: 'cancelled' },
];
const sortOptions = [
  { value: 'date', label: 'sort_date' },
  { value: 'totalAmount', label: 'sort_total_amount' },
  { value: 'priority', label: 'sort_priority' },
];

export const Orders: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { socket, isConnected, emit } = useSocket();
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  const listRef = useRef<HTMLDivElement>(null);
  const playNotificationSound = useOrderNotifications(dispatch, stateRef, user);
  const navigate = useNavigate();

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const calculateTotalQuantity = useCallback((order: Order) => {
    return order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }, []);

  const calculateAdjustedTotal = useCallback(
    (order: Order) =>
      (order.adjustedTotal || order.totalAmount || 0).toLocaleString(isRtl ? 'ar-SA' : 'en-US', {
        style: 'currency',
        currency: 'SAR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [isRtl]
  );

  const handleNavigateToDetails = useCallback(
    (orderId: string) => {
      navigate(`/orders/${orderId}`);
      window.scrollTo(0, 0);
    },
    [navigate]
  );

  // Enhanced WebSocket handling with reconnection logic
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
      emit('joinRoom', user.role === 'admin' ? 'admin' : `production:${user.departmentId}`);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connect error:', err.message);
      dispatch({ type: 'SET_SOCKET_ERROR', payload: isRtl ? 'خطأ في الاتصال' : 'Connection error' });
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: false });
    });

    socket.on('newOrder', (order: any) => {
      if (!order || !order._id || !order.orderNumber) {
        console.warn('Invalid new order data:', order);
        return;
      }
      const mappedOrder: Order = {
        id: order._id,
        orderNumber: order.orderNumber,
        branchId: order.branch?._id || 'unknown',
        branch: {
          _id: order.branch?._id || 'unknown',
          name: order.branch?.name || (isRtl ? 'غير معروف' : 'Unknown'),
          nameEn: order.branch?.nameEn,
          displayName: isRtl ? order.branch?.name : order.branch?.nameEn || order.branch?.name,
        },
        items: Array.isArray(order.items)
          ? order.items.map((item: any) => ({
              _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
              productId: item.product?._id || 'unknown',
              productName: item.product?.name || (isRtl ? 'غير معروف' : 'Unknown'),
              productNameEn: item.product?.nameEn,
              displayProductName: isRtl ? item.product?.name : item.product?.nameEn || item.product?.name,
              quantity: Number(item.quantity) || 1,
              price: Number(item.price) || 0,
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
        totalAmount: Number(order.totalAmount) || 0,
        adjustedTotal: Number(order.adjustedTotal) || 0,
        date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
        requestedDeliveryDate: order.requestedDeliveryDate ? formatDate(new Date(order.requestedDeliveryDate), language) : undefined,
        notes: order.notes || '',
        priority: order.priority || 'medium',
        createdBy: order.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
        approvedBy: order.approvedBy
          ? { _id: order.approvedBy._id, name: order.approvedBy.name || (isRtl ? 'غير معروف' : 'Unknown'), nameEn: order.approvedBy.nameEn, displayName: isRtl ? order.approvedBy.name : order.approvedBy.nameEn || order.approvedBy.name }
          : undefined,
        approvedAt: order.approvedAt ? formatDate(new Date(order.approvedAt), language) : undefined,
        deliveredAt: order.deliveredAt ? formatDate(new Date(order.deliveredAt), language) : undefined,
        transitStartedAt: order.transitStartedAt ? formatDate(new Date(order.transitStartedAt), language) : undefined,
        statusHistory: Array.isArray(order.statusHistory)
          ? order.statusHistory.map((history: any) => ({
              status: history.status || 'pending',
              changedBy: history.changedBy?.name || 'unknown',
              changedAt: formatDate(history.changedAt ? new Date(history.changedAt) : new Date(), language),
              notes: history.notes || '',
            }))
          : [],
      };
      dispatch({ type: 'ADD_ORDER', payload: mappedOrder });
      playNotificationSound('/sounds/notification.mp3', [200, 100, 200]);
      toast.success(isRtl ? `طلب جديد: ${order.orderNumber}` : `New order: ${order.orderNumber}`, {
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
      if (!orderId || !items) {
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
      socket.off('newOrder');
      socket.off('orderStatusUpdated');
      socket.off('itemStatusUpdated');
      socket.off('taskAssigned');
    };
  }, [user, socket, isConnected, isRtl, language, playNotificationSound, emit]);

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
          isRtl,
        };
        if (user.role === 'production' && user.department) query.department = user.department._id;
        const [ordersResponse, chefsResponse, branchesResponse] = await Promise.all([
          ordersAPI.getAll(query),
          chefsAPI.getAll(),
          branchesAPI.getAll(),
        ]);
        const mappedOrders: Order[] = ordersResponse
          .filter((order: any) => order && order._id && order.orderNumber)
          .map((order: any) => ({
            id: order._id,
            orderNumber: order.orderNumber,
            branchId: order.branch?._id || 'unknown',
            branch: {
              _id: order.branch?._id || 'unknown',
              name: order.branch?.name || (isRtl ? 'غير معروف' : 'Unknown'),
              nameEn: order.branch?.nameEn,
              displayName: isRtl ? order.branch?.name : order.branch?.nameEn || order.branch?.name,
            },
            items: Array.isArray(order.items)
              ? order.items.map((item: any) => ({
                  _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
                  productId: item.product?._id || 'unknown',
                  productName: item.product?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                  productNameEn: item.product?.nameEn,
                  displayProductName: isRtl ? item.product?.name : item.product?.nameEn || item.product?.name,
                  quantity: Number(item.quantity) || 1,
                  price: Number(item.price) || 0,
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
            totalAmount: Number(order.totalAmount) || 0,
            adjustedTotal: Number(order.adjustedTotal) || 0,
            date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
            requestedDeliveryDate: order.requestedDeliveryDate ? formatDate(new Date(order.requestedDeliveryDate), language) : undefined,
            notes: order.notes || '',
            priority: order.priority || 'medium',
            createdBy: order.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
            approvedBy: order.approvedBy
              ? { _id: order.approvedBy._id, name: order.approvedBy.name || (isRtl ? 'غير معروف' : 'Unknown'), nameEn: order.approvedBy.nameEn, displayName: isRtl ? order.approvedBy.name : order.approvedBy.nameEn || order.approvedBy.name }
              : undefined,
            approvedAt: order.approvedAt ? formatDate(new Date(order.approvedAt), language) : undefined,
            deliveredAt: order.deliveredAt ? formatDate(new Date(order.deliveredAt), language) : undefined,
            transitStartedAt: order.transitStartedAt ? formatDate(new Date(order.transitStartedAt), language) : undefined,
            statusHistory: Array.isArray(order.statusHistory)
              ? order.statusHistory.map((history: any) => ({
                  status: history.status || 'pending',
                  changedBy: history.changedBy?.name || 'unknown',
                  changedAt: formatDate(history.changedAt ? new Date(history.changedAt) : new Date(), language),
                  notes: history.notes || '',
                }))
              : [],
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
                    displayName: isRtl ? chef.department.name : chef.department.nameEn || chef.department.name,
                  }
                : undefined,
              status: chef.status || 'active',
            })),
        });
        dispatch({
          type: 'SET_BRANCHES',
          payload: branchesResponse
            .filter((branch: any) => branch && branch._id)
            .map((branch: any) => ({
              _id: branch._id,
              name: branch.name || (isRtl ? 'غير معروف' : 'Unknown'),
              nameEn: branch.nameEn,
              displayName: isRtl ? branch.name : branch.nameEn || branch.name,
            }))
            .sort((a: Branch, b: Branch) => a.displayName.localeCompare(b.displayName, language)),
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

  const handleSearchChange = useCallback((value: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: value });
  }, []);

  const filteredOrders = useMemo(() => {
    const normalizedQuery = normalizeText(state.searchQuery);
    return state.orders
      .filter((order) => order)
      .filter(
        (order) =>
          normalizeText(order.orderNumber || '').includes(normalizedQuery) ||
          normalizeText(order.branch.displayName || '').includes(normalizedQuery) ||
          normalizeText(order.notes || '').includes(normalizedQuery) ||
          normalizeText(order.createdBy || '').includes(normalizedQuery) ||
          order.items.some((item) => normalizeText(item.displayProductName || '').includes(normalizedQuery))
      )
      .filter(
        (order) =>
          (!state.filterStatus || order.status === state.filterStatus) &&
          (!state.filterBranch || order.branchId === state.filterBranch) &&
          (user?.role === 'production' && user?.department
            ? order.items.some((item) => item.department._id === user.department._id)
            : true)
      );
  }, [state.orders, state.searchQuery, state.filterStatus, state.filterBranch, user]);

  const sortedOrders = useMemo(() => {
    const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
    return [...filteredOrders].sort((a, b) => {
      if (state.sortBy === 'date') {
        return state.sortOrder === 'asc'
          ? new Date(a.date).getTime() - new Date(b.date).getTime()
          : new Date(b.date).getTime() - new Date(a.date).getTime();
      } else if (state.sortBy === 'totalAmount') {
        return state.sortOrder === 'asc' ? a.adjustedTotal - b.adjustedTotal : b.adjustedTotal - a.adjustedTotal;
      } else {
        return state.sortOrder === 'asc'
          ? priorityOrder[a.priority] - priorityOrder[b.priority]
          : priorityOrder[b.priority] - priorityOrder[a.priority];
      }
    });
  }, [filteredOrders, state.sortBy, state.sortOrder]);

  const paginatedOrders = useMemo(
    () => sortedOrders.slice((state.currentPage - 1) * ORDERS_PER_PAGE[state.viewMode], state.currentPage * ORDERS_PER_PAGE[state.viewMode]),
    [sortedOrders, state.currentPage, state.viewMode]
  );

  const totalPages = useMemo(() => Math.ceil(sortedOrders.length / ORDERS_PER_PAGE[state.viewMode]), [sortedOrders, state.viewMode]);

  const updateOrderStatus = useCallback(
    async (orderId: string, newStatus: OrderStatus) => {
      const order = state.orders.find((o) => o.id === orderId);
      if (!order || !validTransitions[order.status].includes(newStatus)) {
        toast.error(isRtl ? 'انتقال غير صالح' : 'Invalid transition', { position: isRtl ? 'top-left' : 'top-right' });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        const response = await ordersAPI.updateStatus(orderId, { status: newStatus });
        if (response.success) {
          dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status: newStatus });
          if (socket && isConnected) {
            emit('orderStatusUpdated', { orderId, status: newStatus });
          }
          toast.success(isRtl ? `تم تحديث الحالة إلى: ${newStatus}` : `Order status updated to: ${newStatus}`, {
            position: isRtl ? 'top-left' : 'top-right',
          });
        } else {
          throw new Error('Failed to update status');
        }
      } catch (err: any) {
        console.error('Update status error:', err.message);
        toast.error(isRtl ? `خطأ في تحديث الحالة: ${err.message}` : `Error updating status: ${err.message}`, {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [state.orders, socket, isConnected, isRtl, emit]
  );

  const openAssignModal = useCallback(
    (order: Order) => {
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
              unit: item.displayUnit,
            })),
        },
      });
      dispatch({ type: 'SET_SELECTED_ORDER', payload: order });
      dispatch({ type: 'SET_MODAL', isOpen: true });
    },
    []
  );

  const handleAssignChefs = useCallback(
    async (formData: AssignChefsForm) => {
      if (!state.selectedOrder) return;
      dispatch({ type: 'SET_SUBMITTING', payload: state.selectedOrder.id });
      try {
        const response = await ordersAPI.assignChef(state.selectedOrder.id, {
          items: formData.items.map((item) => ({
            itemId: item.itemId,
            assignedTo: item.assignedTo,
          })),
        });
        if (response.success) {
          const assignedItems = state.selectedOrder.items
            .filter((item) => formData.items.some((f) => f.itemId === item._id))
            .map((item) => ({
              _id: item._id,
              assignedTo: state.chefs.find((chef) => chef._id === formData.items.find((f) => f.itemId === item._id)?.assignedTo),
              status: 'assigned' as ItemStatus,
            }));
          dispatch({ type: 'TASK_ASSIGNED', orderId: state.selectedOrder.id, items: assignedItems });
          if (socket && isConnected) {
            emit('taskAssigned', { orderId: state.selectedOrder.id, items: assignedItems });
          }
          toast.success(isRtl ? 'تم تعيين الشيفات بنجاح' : 'Chefs assigned successfully', {
            position: isRtl ? 'top-left' : 'top-right',
          });
          dispatch({ type: 'SET_MODAL', isOpen: false });
          dispatch({ type: 'SET_ASSIGN_FORM', payload: { items: [] } });
          dispatch({ type: 'SET_SELECTED_ORDER', payload: null });
        } else {
          throw new Error('Failed to assign chefs');
        }
      } catch (err: any) {
        console.error('Assign chefs error:', err.message);
        toast.error(isRtl ? `خطأ في تعيين الشيفات: ${err.message}` : `Error assigning chefs: ${err.message}`, {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [state.selectedOrder, state.chefs, socket, isConnected, isRtl, emit]
  );

  const handleExport = useCallback(() => {
    exportToExcel(sortedOrders, isRtl, calculateAdjustedTotal, calculateTotalQuantity, translateUnit);
    toast.success(isRtl ? 'تم تصدير الطلبات إلى Excel' : 'Orders exported to Excel', {
      position: isRtl ? 'top-left' : 'top-right',
    });
  }, [sortedOrders, isRtl, calculateAdjustedTotal, calculateTotalQuantity]);

  const handleSortChange = useCallback((by: 'date' | 'totalAmount' | 'priority', order: 'asc' | 'desc') => {
    dispatch({ type: 'SET_SORT', by, order });
  }, []);

  const handleViewModeChange = useCallback((mode: 'card' | 'table') => {
    dispatch({ type: 'SET_VIEW_MODE', payload: mode });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="container mx-auto p-4"
      dir={isRtl ? 'rtl' : 'ltr'}
      role="main"
      aria-label={isRtl ? 'إدارة الطلبات' : 'Order Management'}
    >
      <Card className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            {isRtl ? 'الطلبات' : 'Orders'}
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={state.viewMode === 'card' ? 'primary' : 'outline'}
              size="sm"
              icon={Grid}
              onClick={() => handleViewModeChange('card')}
              aria-label={isRtl ? 'عرض على شكل بطاقات' : 'Card view'}
            >
              {isRtl ? 'بطاقات' : 'Cards'}
            </Button>
            <Button
              variant={state.viewMode === 'table' ? 'primary' : 'outline'}
              size="sm"
              icon={Table2}
              onClick={() => handleViewModeChange('table')}
              aria-label={isRtl ? 'عرض على شكل جدول' : 'Table view'}
            >
              {isRtl ? 'جدول' : 'Table'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={Download}
              onClick={handleExport}
              aria-label={isRtl ? 'تصدير إلى Excel' : 'Export to Excel'}
            >
              {isRtl ? 'تصدير' : 'Export'}
            </Button>
          </div>
        </div>
      </Card>

      {state.error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 bg-red-50 border border-red-100 rounded-md flex items-center gap-2"
          role="alert"
        >
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-sm text-red-600">{state.error}</span>
        </motion.div>
      )}

      <Card className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            placeholder={isRtl ? 'ابحث في الطلبات...' : 'Search orders...'}
            value={state.searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            icon={Search}
            className="w-full"
            aria-label={isRtl ? 'البحث في الطلبات' : 'Search orders'}
          />
          <Select
            options={[{ value: '', label: isRtl ? 'كل الفروع' : 'All Branches' }, ...state.branches.map((b) => ({ value: b._id, label: b.displayName }))]}
            value={state.filterBranch}
            onChange={(value) => dispatch({ type: 'SET_FILTER_BRANCH', payload: value })}
            placeholder={isRtl ? 'اختر الفرع' : 'Select Branch'}
            className="w-full"
            aria-label={isRtl ? 'تصفية حسب الفرع' : 'Filter by branch'}
          />
          <Select
            options={statusOptions.map((opt) => ({
              value: opt.value,
              label: isRtl
                ? {
                    '': 'كل الحالات',
                    pending: 'قيد الانتظار',
                    approved: 'تم الموافقة',
                    in_production: 'في الإنتاج',
                    completed: 'مكتمل',
                    in_transit: 'في النقل',
                    delivered: 'تم التسليم',
                    cancelled: 'ملغى',
                  }[opt.value]
                : t(opt.label),
            }))}
            value={state.filterStatus}
            onChange={(value) => dispatch({ type: 'SET_FILTER_STATUS', payload: value })}
            placeholder={isRtl ? 'اختر الحالة' : 'Select Status'}
            className="w-full"
            aria-label={isRtl ? 'تصفية حسب الحالة' : 'Filter by status'}
          />
        </div>
      </Card>

      {state.loading ? (
        state.viewMode === 'card' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array(6)
              .fill(0)
              .map((_, index) => (
                <OrderCardSkeleton key={index} isRtl={isRtl} />
              ))}
          </div>
        ) : (
          <OrderTableSkeleton isRtl={isRtl} />
        )
      ) : (
        <>
          <div ref={listRef}>
            {state.viewMode === 'card' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {paginatedOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      calculateAdjustedTotal={calculateAdjustedTotal}
                      calculateTotalQuantity={calculateTotalQuantity}
                      translateUnit={translateUnit}
                      updateOrderStatus={updateOrderStatus}
                      openAssignModal={openAssignModal}
                      submitting={state.submitting}
                      isRtl={isRtl}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <OrderTable
                orders={paginatedOrders}
                calculateAdjustedTotal={calculateAdjustedTotal}
                calculateTotalQuantity={calculateTotalQuantity}
                translateUnit={translateUnit}
                updateOrderStatus={updateOrderStatus}
                openAssignModal={openAssignModal}
                submitting={state.submitting}
                isRtl={isRtl}
                startIndex={(state.currentPage - 1) * ORDERS_PER_PAGE.table + 1}
              />
            )}
          </div>

          {totalPages > 1 && (
            <Pagination
              currentPage={state.currentPage}
              totalPages={totalPages}
              onPageChange={(page) => dispatch({ type: 'SET_PAGE', payload: page })}
              isRtl={isRtl}
            />
          )}
        </>
      )}

      <AssignChefsModal
        isOpen={state.isAssignModalOpen}
        onClose={() => dispatch({ type: 'SET_MODAL', isOpen: false })}
        chefs={state.chefs}
        formData={state.assignFormData}
        onSubmit={handleAssignChefs}
        submitting={!!state.submitting}
        isRtl={isRtl}
      />
    </motion.div>
  );
};

export default Orders;