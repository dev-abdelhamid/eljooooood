import React, { useReducer, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Select } from '../components/UI/Select';
import { Input } from '../components/UI/Input';
import { ShoppingCart, AlertCircle, Search, Table2, Grid, Download } from 'lucide-react';
import { debounce } from 'lodash';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { ordersAPI, chefsAPI, branchesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { useOrderNotifications } from '../hooks/useOrderNotifications';
import { Order, Chef, Branch, AssignChefsForm } from '../types/types';
import { useNavigate } from 'react-router-dom';
import { exportToPDF } from '../components/Shared/PDFExporter';
import { OrderCardSkeleton, OrderTableSkeleton } from '../components/Shared/OrderSkeletons';
import Pagination from '../components/Shared/Pagination';

const OrderCard = lazy(() => import('../components/Shared/OrderCard'));
const OrderTable = lazy(() => import('../components/Shared/OrderTable'));
const AssignChefsModal = lazy(() => import('../components/Shared/AssignChefsModal'));

interface State {
  orders: Order[];
  selectedOrder: Order | null;
  chefs: Chef[];
  branches: Branch[];
  isAssignModalOpen: boolean;
  assignFormData: AssignChefsForm;
  filterStatus: string;
  filterBranch: string;
  searchQuery: string;
  sortBy: 'date' | 'totalAmount' | 'priority';
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
  status?: Order['status'];
  returnId?: string;
  items?: any[];
  by?: 'date' | 'totalAmount' | 'priority';
  order?: 'asc' | 'desc';
  isOpen?: boolean;
  modal?: string;
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
    case 'SET_ORDERS': return { ...state, orders: action.payload, error: '', currentPage: 1 };
    case 'ADD_ORDER': return { ...state, orders: [action.payload, ...state.orders.filter(o => o.id !== action.payload.id)] };
    case 'SET_SELECTED_ORDER': return { ...state, selectedOrder: action.payload };
    case 'SET_CHEFS': return { ...state, chefs: action.payload };
    case 'SET_BRANCHES': return { ...state, branches: action.payload };
    case 'SET_MODAL': return { ...state, isAssignModalOpen: action.isOpen ?? false };
    case 'SET_ASSIGN_FORM': return { ...state, assignFormData: action.payload };
    case 'SET_FILTER_STATUS': return { ...state, filterStatus: action.payload, currentPage: 1 };
    case 'SET_FILTER_BRANCH': return { ...state, filterBranch: action.payload, currentPage: 1 };
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
                        ? { _id: assignment.assignedTo._id, name: assignment.assignedTo.displayName || assignment.assignedTo.name || (state.language === 'ar' ? 'غير معروف' : 'Unknown'), department: assignment.assignedTo.department }
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
                      ? { _id: assignment.assignedTo._id, name: assignment.assignedTo.displayName || assignment.assignedTo.name || (state.language === 'ar' ? 'غير معروف' : 'Unknown'), department: assignment.assignedTo.department }
                      : undefined,
                    status: assignment.status || i.status,
                  }
                : i;
            }),
            status: state.selectedOrder.items.every(i => i.status === 'assigned')
              ? 'in_production' : state.selectedOrder.status,
          }
        : state.selectedOrder,
    };
    case 'RETURN_STATUS_UPDATED': return {
      ...state,
      orders: state.orders.map(order =>
        order.id === action.orderId
          ? {
              ...order,
              returns: order.returns.map(ret =>
                ret.returnId === action.returnId ? { ...ret, status: action.status! } : ret
              ),
              adjustedTotal: action.status === 'approved'
                ? order.adjustedTotal - (order.returns.find(r => r.returnId === action.returnId)?.items.reduce((sum, item) => {
                    const orderItem = order.items.find(i => i.productId === item.productId);
                    return sum + (orderItem ? orderItem.price * item.quantity : 0);
                  }, 0) || 0)
                : order.adjustedTotal,
            }
          : order
      ),
      selectedOrder: state.selectedOrder && state.selectedOrder.id === action.orderId
        ? {
            ...state.selectedOrder,
            returns: state.selectedOrder.returns.map(ret =>
              ret.returnId === action.returnId ? { ...ret, status: action.status! } : ret
            ),
            adjustedTotal: action.status === 'approved'
              ? state.selectedOrder.adjustedTotal - (state.selectedOrder.returns.find(r => r.returnId === action.returnId)?.items.reduce((sum, item) => {
                  const orderItem = state.selectedOrder.items.find(i => i.productId === item.productId);
                  return sum + (orderItem ? orderItem.price * item.quantity : 0);
                }, 0) || 0)
              : state.selectedOrder.adjustedTotal,
          }
        : state.selectedOrder,
    };
    case 'SET_VIEW_MODE': return { ...state, viewMode: action.payload, currentPage: 1 };
    default: return state;
  }
};

const ORDERS_PER_PAGE = { card: 12, table: 50 };
const validTransitions: Record<Order['status'], Order['status'][]> = {
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

const exportToExcel = (orders: Order[], isRtl: boolean, calculateAdjustedTotal: (order: Order) => string, calculateTotalQuantity: (order: Order) => number, translateUnit: (unit: string, isRtl: boolean) => string, t: (key: string) => string) => {
  const headers = [
    t('orders.order_number'),
    t('orders.branch'),
    t('orders.status'),
    t('orders.products'),
    t('orders.total_amount'),
    t('orders.total_quantity'),
    t('orders.date'),
  ];
  const data = orders.map(order => {
    const productsStr = order.items.map(i => `${i.displayName || i.productName} (${i.quantity.toLocaleString(isRtl ? 'ar-SA' : 'en-US')} ${translateUnit(i.unit, isRtl)})`).join(', ');
    const totalAmount = calculateAdjustedTotal(order);
    const totalQuantity = `${calculateTotalQuantity(order).toLocaleString(isRtl ? 'ar-SA' : 'en-US')} ${t('orders.units')}`;
    const statusLabel = t(`orders.status_${order.status}`);
    return {
      [headers[0]]: order.orderNumber.toLocaleString(isRtl ? 'ar-SA' : 'en-US'),
      [headers[1]]: order.displayBranchName || order.branchName,
      [headers[2]]: statusLabel,
      [headers[3]]: productsStr,
      [headers[4]]: totalAmount,
      [headers[5]]: totalQuantity,
      [headers[6]]: order.date,
    };
  });
  const ws = XLSX.utils.json_to_sheet(isRtl ? data.map(row => Object.fromEntries(Object.entries(row).reverse())) : data, { header: headers });
  if (isRtl) ws['!views'] = [{ RTL: true }];
  ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 50 }, { wch: 20 }, { wch: 15 }, { wch: 20 }];
  const range = XLSX.utils.decode_range(ws['!ref']!);
  for (let C = range.s.c; C <= range.e.c; ++C) {
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell) cell.s = { alignment: { horizontal: 'center', vertical: 'center' } };
    }
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, t('orders.title'));
  XLSX.writeFile(wb, 'Orders.xlsx');
  toast.success(t('orders.export_success'), {
    position: isRtl ? 'top-left' : 'top-right',
    autoClose: 3000,
  });
};

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
    (order: Order) => {
      const approvedReturnsTotal = order.returns
        .filter(ret => ret.status === 'approved')
        .reduce((sum, ret) => {
          const returnTotal = ret.items.reduce((retSum, item) => {
            const orderItem = order.items.find(i => i.productId === item.productId);
            return retSum + (orderItem ? orderItem.price * item.quantity : 0);
          }, 0);
          return sum + returnTotal;
        }, 0);
      const adjusted = (order.adjustedTotal || order.totalAmount || 0) - approvedReturnsTotal;
      return adjusted.toLocaleString(isRtl ? 'ar-SA' : 'en-US', {
        style: 'currency',
        currency: 'SAR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    },
    [isRtl]
  );

  const handleNavigateToDetails = useCallback((orderId: string) => {
    navigate(`/orders/${orderId}`);
    window.scrollTo(0, 0);
  }, [navigate]);

  useEffect(() => {
    if (!user || !['admin', 'production'].includes(user.role)) {
      dispatch({ type: 'SET_ERROR', payload: t('errors.unauthorized') });
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }
    if (!socket) return;
    socket.on('connect', () => {
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: true });
      dispatch({ type: 'SET_SOCKET_ERROR', payload: null });
    });
    socket.on('connect_error', (err) => {
      console.error('Socket connect error:', err.message);
      dispatch({ type: 'SET_SOCKET_ERROR', payload: t('errors.socket_connect') });
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: false });
    });
    socket.on('reconnect', (attempt) => {
      console.log(`[${new Date().toISOString()}] Socket reconnected after ${attempt} attempts`);
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: true });
    });
    socket.on('disconnect', (reason) => {
      console.log(`[${new Date().toISOString()}] Socket disconnected: ${reason}`);
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
        branchName: order.displayBranchName || order.branch?.name || t('common.unknown'),
        items: Array.isArray(order.items)
          ? order.items.map((item: any) => ({
              _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
              productId: item.product?._id || 'unknown',
              productName: item.product?.displayName || item.product?.name || t('common.unknown'),
              quantity: Number(item.quantity) || 1,
              price: Number(item.price) || 0,
              unit: item.product?.displayUnit || item.product?.unit || 'unit',
              department: item.product?.department ? { _id: item.product.department._id, name: item.product.department.displayName || item.product.department.name || t('common.unknown') } : { _id: 'unknown', name: t('common.unknown') },
              assignedTo: item.assignedTo ? { _id: item.assignedTo._id, name: item.assignedTo.displayName || item.assignedTo.name || t('common.unknown'), department: item.assignedTo.department } : undefined,
              status: item.status || 'pending',
              returnedQuantity: Number(item.returnedQuantity) || 0,
              returnReason: item.returnReason || '',
              startedAt: item.startedAt ? new Date(item.startedAt) : undefined,
              completedAt: item.completedAt ? new Date(item.completedAt) : undefined,
            }))
          : [],
        returns: Array.isArray(order.returns)
          ? order.returns.map((ret: any) => ({
              returnId: ret._id || `temp-${Math.random().toString(36).substring(2)}`,
              returnNumber: ret.returnNumber || t('common.unknown'),
              items: Array.isArray(ret.items)
                ? ret.items.map((item: any) => ({
                    productId: item.product?._id || 'unknown',
                    productName: item.product?.displayName || item.product?.name || t('common.unknown'),
                    quantity: Number(item.quantity) || 0,
                    reason: item.reason || t('common.unspecified'),
                    unit: item.product?.displayUnit || item.product?.unit || 'unit',
                  }))
                : [],
              status: ret.status || 'pending',
              reviewNotes: ret.notes || '',
              createdAt: formatDate(ret.createdAt ? new Date(ret.createdAt) : new Date(), language),
              createdBy: ret.createdBy?.displayName || ret.createdBy?.name || t('common.unknown'),
            }))
          : [],
        status: order.status || 'pending',
        totalAmount: Number(order.totalAmount) || 0,
        adjustedTotal: Number(order.adjustedTotal) || 0,
        date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
        requestedDeliveryDate: order.requestedDeliveryDate ? new Date(order.requestedDeliveryDate) : undefined,
        notes: order.displayNotes || order.notes || '',
        priority: order.priority || 'medium',
        createdBy: order.createdBy?.displayName || order.createdBy?.name || t('common.unknown'),
        approvedBy: order.approvedBy ? { _id: order.approvedBy._id, name: order.approvedBy.displayName || order.approvedBy.name || t('common.unknown') } : undefined,
        approvedAt: order.approvedAt ? new Date(order.approvedAt) : undefined,
        deliveredAt: order.deliveredAt ? new Date(order.deliveredAt) : undefined,
        transitStartedAt: order.transitStartedAt ? new Date(order.transitStartedAt) : undefined,
        statusHistory: Array.isArray(order.statusHistory)
          ? order.statusHistory.map((history: any) => ({
              status: history.status || 'pending',
              changedBy: history.changedBy?.displayName || history.changedBy?.name || t('common.unknown'),
              changedAt: formatDate(history.changedAt ? new Date(history.changedAt) : new Date(), language),
              notes: history.displayNotes || history.notes || '',
            }))
          : [],
      };
      dispatch({ type: 'ADD_ORDER', payload: mappedOrder });
      playNotificationSound('/sounds/new-order.mp3', [200, 100, 200]);
    });
    socket.on('orderStatusUpdated', ({ orderId, status }: { orderId: string; status: Order['status'] }) => {
      if (!orderId || !status) {
        console.warn('Invalid order status update data:', { orderId, status });
        return;
      }
      dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status });
    });
    socket.on('itemStatusUpdated', ({ orderId, itemId, status }: { orderId: string; itemId: string; status: string }) => {
      if (!orderId || !itemId || !status) {
        console.warn('Invalid item status update data:', { orderId, itemId, status });
        return;
      }
      dispatch({ type: 'UPDATE_ITEM_STATUS', orderId, payload: { itemId, status } });
    });
    socket.on('returnStatusUpdated', ({ orderId, returnId, status }: { orderId: string; returnId: string; status: string }) => {
      if (!orderId || !returnId || !status) {
        console.warn('Invalid return status update data:', { orderId, returnId, status });
        return;
      }
      dispatch({ type: 'RETURN_STATUS_UPDATED', orderId, returnId, status });
      toast.info(t('orders.return_status_updated', { status: t(`orders.status_${status}`) }), {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    });
    socket.on('taskAssigned', ({ orderId, items }: { orderId: string; items: any[] }) => {
      if (!orderId || !items) {
        console.warn('Invalid task assigned data:', { orderId, items });
        return;
      }
      dispatch({ type: 'TASK_ASSIGNED', orderId, items });
      toast.info(t('orders.chefs_assigned'), {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    });
    return () => {
      socket.off('connect');
      socket.off('connect_error');
      socket.off('newOrder');
      socket.off('orderStatusUpdated');
      socket.off('itemStatusUpdated');
      socket.off('returnStatusUpdated');
      socket.off('taskAssigned');
    };
  }, [user, socket, isRtl, language, playNotificationSound, t]);

  const fetchData = useCallback(
    async (retryCount = 0) => {
      if (!user || !['admin', 'production'].includes(user.role)) {
        dispatch({ type: 'SET_ERROR', payload: t('errors.unauthorized') });
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
            branchName: order.displayBranchName || order.branch?.name || t('common.unknown'),
            items: Array.isArray(order.items)
              ? order.items.map((item: any) => ({
                  _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
                  productId: item.product?._id || 'unknown',
                  productName: item.product?.displayName || item.product?.name || t('common.unknown'),
                  quantity: Number(item.quantity) || 1,
                  price: Number(item.price) || 0,
                  unit: item.product?.displayUnit || item.product?.unit || 'unit',
                  department: item.product?.department ? { _id: item.product.department._id, name: item.product.department.displayName || item.product.department.name || t('common.unknown') } : { _id: 'unknown', name: t('common.unknown') },
                  assignedTo: item.assignedTo ? { _id: item.assignedTo._id, name: item.assignedTo.displayName || item.assignedTo.name || t('common.unknown'), department: item.assignedTo.department } : undefined,
                  status: item.status || 'pending',
                  returnedQuantity: Number(item.returnedQuantity) || 0,
                  returnReason: item.returnReason || '',
                  startedAt: item.startedAt ? new Date(item.startedAt) : undefined,
                  completedAt: item.completedAt ? new Date(item.completedAt) : undefined,
                }))
              : [],
            returns: Array.isArray(order.returns)
              ? order.returns.map((ret: any) => ({
                  returnId: ret._id || `temp-${Math.random().toString(36).substring(2)}`,
                  returnNumber: ret.returnNumber || t('common.unknown'),
                  items: Array.isArray(ret.items)
                    ? ret.items.map((item: any) => ({
                        productId: item.product?._id || 'unknown',
                        productName: item.product?.displayName || item.product?.name || t('common.unknown'),
                        quantity: Number(item.quantity) || 0,
                        reason: item.reason || t('common.unspecified'),
                        unit: item.product?.displayUnit || item.product?.unit || 'unit',
                      }))
                    : [],
                  status: ret.status || 'pending',
                  reviewNotes: ret.displayNotes || ret.notes || '',
                  createdAt: formatDate(ret.createdAt ? new Date(ret.createdAt) : new Date(), language),
                  createdBy: ret.createdBy?.displayName || ret.createdBy?.name || t('common.unknown'),
                }))
              : [],
            status: order.status || 'pending',
            totalAmount: Number(order.totalAmount) || 0,
            adjustedTotal: Number(order.adjustedTotal) || 0,
            date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
            requestedDeliveryDate: order.requestedDeliveryDate ? new Date(order.requestedDeliveryDate) : undefined,
            notes: order.displayNotes || order.notes || '',
            priority: order.priority || 'medium',
            createdBy: order.createdBy?.displayName || order.createdBy?.name || t('common.unknown'),
            approvedBy: order.approvedBy ? { _id: order.approvedBy._id, name: order.approvedBy.displayName || order.approvedBy.name || t('common.unknown') } : undefined,
            approvedAt: order.approvedAt ? new Date(order.approvedAt) : undefined,
            deliveredAt: order.deliveredAt ? new Date(order.deliveredAt) : undefined,
            transitStartedAt: order.transitStartedAt ? new Date(order.transitStartedAt) : undefined,
            statusHistory: Array.isArray(order.statusHistory)
              ? order.statusHistory.map((history: any) => ({
                  status: history.status || 'pending',
                  changedBy: history.changedBy?.displayName || history.changedBy?.name || t('common.unknown'),
                  changedAt: formatDate(history.changedAt ? new Date(history.changedAt) : new Date(), language),
                  notes: history.displayNotes || history.notes || '',
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
              name: chef.user?.displayName || chef.user?.name || chef.name || t('common.unknown'),
              department: chef.department ? { _id: chef.department._id, name: chef.department.displayName || chef.department.name || t('common.unknown') } : null,
              status: chef.status || 'active',
            })),
        });
        dispatch({
          type: 'SET_BRANCHES',
          payload: branchesResponse
            .filter((branch: any) => branch && branch._id)
            .map((branch: any) => ({
              _id: branch._id,
              name: branch.displayName || branch.name || t('common.unknown'),
            }))
            .sort((a: Branch, b: Branch) => a.name.localeCompare(b.name, language)),
        });
        dispatch({ type: 'SET_ERROR', payload: '' });
      } catch (err: any) {
        console.error('Fetch data error:', err.message);
        if (retryCount < 2) {
          setTimeout(() => fetchData(retryCount + 1), 1000);
          return;
        }
        const errorMessage = err.response?.status === 404
          ? t('errors.no_orders_found')
          : t('errors.fetch_orders_failed', { error: err.message });
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [user, state.sortBy, state.sortOrder, isRtl, language, t]
  );

  const handleSearchChange = useMemo(
    () =>
      debounce((value: string) => {
        dispatch({ type: 'SET_SEARCH_QUERY', payload: value });
      }, 300),
    []
  );

  const filteredOrders = useMemo(
    () =>
      state.orders
        .filter(
          order =>
            order.orderNumber.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
            (order.displayBranchName || order.branchName).toLowerCase().includes(state.searchQuery.toLowerCase()) ||
            (order.notes || '').toLowerCase().includes(state.searchQuery.toLowerCase()) ||
            (order.createdBy || '').toLowerCase().includes(state.searchQuery.toLowerCase()) ||
            order.items.some(item => (item.displayName || item.productName).toLowerCase().includes(state.searchQuery.toLowerCase()))
        )
        .filter(
          order =>
            (!state.filterStatus || order.status === state.filterStatus) &&
            (!state.filterBranch || order.branchId === state.filterBranch) &&
            (user?.role === 'production' && user?.department
              ? order.items.some(item => item.department._id === user.department._id)
              : true)
        ),
    [state.orders, state.searchQuery, state.filterStatus, state.filterBranch, user]
  );

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

  const totalPages = useMemo(
    () => Math.ceil(sortedOrders.length / ORDERS_PER_PAGE[state.viewMode]),
    [sortedOrders, state.viewMode]
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, newStatus: Order['status']) => {
      const order = state.orders.find(o => o.id === orderId);
      if (!order || !validTransitions[order.status].includes(newStatus)) {
        toast.error(t('errors.invalid_transition'), {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        await ordersAPI.updateStatus(orderId, { status: newStatus });
        dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status: newStatus });
        if (socket && isConnected) {
          emit('orderStatusUpdated', { orderId, status: newStatus });
        }
        toast.success(t('orders.status_updated', { status: t(`orders.status_${newStatus}`) }), {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } catch (err: any) {
        console.error('Update order status error:', err.message);
        toast.error(t('errors.update_status_failed', { error: err.message }), {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [state.orders, isRtl, socket, isConnected, emit, t]
  );

  const updateItemStatus = useCallback(
    async (orderId: string, itemId: string, status: Order['items'][0]['status']) => {
      if (!user?.id) {
        toast.error(t('errors.no_user'), {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        await ordersAPI.updateItemStatus(orderId, itemId, { status });
        dispatch({ type: 'UPDATE_ITEM_STATUS', orderId, payload: { itemId, status } });
        if (socket && isConnected) {
          emit('itemStatusUpdated', { orderId, itemId, status });
        }
        toast.success(t('orders.item_status_updated', { status: t(`orders.item_status_${status}`) }), {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } catch (err: any) {
        console.error('Update item status error:', err.message);
        toast.error(t('errors.update_item_status_failed', { error: err.message }), {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
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
        toast.error(t('errors.assign_chefs_required'), {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        await ordersAPI.assignChef(orderId, { items: state.assignFormData.items });
        const items = state.assignFormData.items.map(item => ({
          _id: item.itemId,
          assignedTo: state.chefs.find(chef => chef.userId === item.assignedTo) || { _id: item.assignedTo, name: t('common.unknown'), department: { _id: 'unknown', name: t('common.unknown') } },
          status: 'assigned',
        }));
        dispatch({ type: 'TASK_ASSIGNED', orderId, items });
        dispatch({ type: 'SET_MODAL', modal: 'assign', isOpen: false });
        dispatch({ type: 'SET_ASSIGN_FORM', payload: { items: [] } });
        if (socket && isConnected) {
          emit('taskAssigned', { orderId, items });
        }
        toast.success(t('orders.chefs_assigned_success'), {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } catch (err: any) {
        console.error('Assign chefs error:', err.message);
        toast.error(t('errors.assign_chefs_failed', { error: err.message }), {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [user, state.assignFormData, state.chefs, socket, isConnected, emit, t, isRtl]
  );

  const openAssignModal = useCallback(
    (order: Order) => {
      if (order.status !== 'approved') {
        toast.error(t('errors.order_not_approved'), {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
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
              product: item.displayName || item.productName,
              quantity: item.quantity,
              unit: item.unit || 'unit',
            })),
        },
      });
      dispatch({ type: 'SET_MODAL', modal: 'assign', isOpen: true });
    },
    [isRtl, t]
  );

  const handlePageChange = useCallback((page: number) => {
    dispatch({ type: 'SET_PAGE', payload: page });
    if (listRef.current) {
      listRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="px-2 py-4" dir={isRtl ? 'rtl' : 'ltr'}>
      <Suspense fallback={<OrderTableSkeleton isRtl={isRtl} />}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }} className="mb-6">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div className="w-full sm:w-auto text-center sm:text-start">
              <h1 className="text-xl font-bold text-gray-900 flex items-center justify-center sm:justify-start gap-2">
                <ShoppingCart className="w-5 h-5 text-amber-700" />
                {t('orders.title')}
              </h1>
              <p className="text-xs text-gray-600 mt-1">{t('orders.subtitle')}</p>
            </div>
            <div className="flex gap-2 flex-wrap justify-center sm:justify-end w-full sm:w-auto">
              <Button
                variant={state.orders.length > 0 ? 'primary' : 'secondary'}
                onClick={state.orders.length > 0 ? () => exportToExcel(filteredOrders, isRtl, calculateAdjustedTotal, calculateTotalQuantity, translateUnit, t) : undefined}
                className={`flex items-center gap-1 ${
                  state.orders.length > 0 ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                } rounded-full px-3 py-1.5 text-xs shadow transition-all duration-300`}
                disabled={state.orders.length === 0}
                aria-label={t('orders.export_excel')}
              >
                <Download className="w-4 h-4" />
                {t('orders.export_excel')}
              </Button>
              <Button
                variant={state.orders.length > 0 ? 'primary' : 'secondary'}
                onClick={state.orders.length > 0 ? () => {
                  const filterBranchName = state.branches.find(b => b._id === state.filterBranch)?.name || '';
                  exportToPDF(filteredOrders, isRtl, calculateAdjustedTotal, calculateTotalQuantity, translateUnit, state.filterStatus, filterBranchName, t);
                } : undefined}
                className={`flex items-center gap-1 ${
                  state.orders.length > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                } rounded-full px-3 py-1.5 text-xs shadow transition-all duration-300`}
                disabled={state.orders.length === 0}
                aria-label={t('orders.export_pdf')}
              >
                <Download className="w-4 h-4" />
                {t('orders.export_pdf')}
              </Button>
            </div>
          </div>
          <Card className="p-3 mt-6 bg-white shadow-md border border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('orders.search')}</label>
                <div className="relative">
                  <Search className={`w-4 h-4 text-gray-500 absolute top-2 ${isRtl ? 'left-2' : 'right-2'}`} />
                  <Input
                    value={state.searchQuery}
                    onChange={(e) => handleSearchChange(e?.target?.value || '')}
                    placeholder={t('orders.search_placeholder')}
                    className={`w-full ${isRtl ? 'pl-8' : 'pr-8'} rounded-full border-gray-200 focus:ring-amber-500 text-xs shadow-sm transition-all duration-200`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('orders.filter_status')}</label>
                <Select
                  options={statusOptions.map(opt => ({
                    value: opt.value,
                    label: t(`orders.status_${opt.value}`) || opt.label,
                  }))}
                  value={state.filterStatus}
                  onChange={(value) => dispatch({ type: 'SET_FILTER_STATUS', payload: value })}
                  className="w-full rounded-full border-gray-200 focus:ring-amber-500 text-xs shadow-sm transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('orders.filter_branch')}</label>
                <Select
                  options={[{ value: '', label: t('orders.all_branches') }, ...state.branches.map(b => ({ value: b._id, label: b.name }))]}
                  value={state.filterBranch}
                  onChange={(value) => dispatch({ type: 'SET_FILTER_BRANCH', payload: value })}
                  className="w-full rounded-full border-gray-200 focus:ring-amber-500 text-xs shadow-sm transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('orders.sort_by')}</label>
                <Select
                  options={sortOptions.map(opt => ({
                    value: opt.value,
                    label: t(`orders.${opt.label}`),
                  }))}
                  value={state.sortBy}
                  onChange={(value) => dispatch({ type: 'SET_SORT', by: value as any, order: state.sortOrder })}
                  className="w-full rounded-full border-gray-200 focus:ring-amber-500 text-xs shadow-sm transition-all duration-200"
                />
              </div>
            </div>
            <div className={`flex flex-col sm:flex-row justify-between items-center gap-3 mt-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div className="text-xs text-center text-gray-600">
                {t('orders.count', { count: filteredOrders.length.toLocaleString(isRtl ? 'ar-SA' : 'en-US') })}
              </div>
              <Button
                variant="secondary"
                onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: state.viewMode === 'card' ? 'table' : 'card' })}
                className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full px-3 py-1.5 text-xs shadow transition-all duration-300"
                aria-label={state.viewMode === 'card' ? t('orders.view_table') : t('orders.view_cards')}
              >
                {state.viewMode === 'card' ? <Table2 className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
                {state.viewMode === 'card' ? t('orders.view_table') : t('orders.view_cards')}
              </Button>
            </div>
          </Card>
          <div ref={listRef} className="mt-6 min-h-[300px]">
            {state.loading ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-1">
                {state.viewMode === 'card' ? (
                  <div className="grid grid-cols-1 gap-1">
                    {Array.from({ length: ORDERS_PER_PAGE.card }, (_, i) => <OrderCardSkeleton key={i} isRtl={isRtl} />)}
                  </div>
                ) : (
                  <OrderTableSkeleton isRtl={isRtl} rows={ORDERS_PER_PAGE.table} />
                )}
              </motion.div>
            ) : state.error ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="mt-6">
                <Card className="p-5 max-w-md mx-auto text-center bg-red-50 shadow-md rounded-xl border border-red-100">
                  <div className={`flex items-center justify-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <p className="text-xs font-medium text-red-600">{state.error}</p>
                  </div>
                  <Button
                    variant="primary"
                    onClick={() => fetchData()}
                    className="mt-3 bg-amber-600 hover:bg-amber-700 text-white rounded-full px-3 py-1.5 text-xs shadow transition-all duration-300"
                    aria-label={t('common.retry')}
                  >
                    {t('common.retry')}
                  </Button>
                </Card>
              </motion.div>
            ) : (
              <AnimatePresence mode="wait">
                {paginatedOrders.length === 0 ? (
                  <motion.div key="no-orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="mt-6">
                    <Card className="p-6 text-center bg-white shadow-md rounded-xl border border-gray-100">
                      <ShoppingCart className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                      <h3 className="text-base font-medium text-gray-800 mb-1">{t('orders.no_orders')}</h3>
                      <p className="text-xs text-gray-500">
                        {state.filterStatus || state.filterBranch || state.searchQuery
                          ? t('orders.no_matching_orders')
                          : t('orders.no_orders_yet')}
                      </p>
                    </Card>
                  </motion.div>
                ) : (
                  <motion.div key="orders-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="space-y-3">
                    {state.viewMode === 'table' ? (
                      <OrderTable
                        orders={paginatedOrders.filter(o => o && o.id && o.branchId && o.orderNumber)}
                        isRtl={isRtl}
                        t={t}
                        calculateAdjustedTotal={calculateAdjustedTotal}
                        calculateTotalQuantity={calculateTotalQuantity}
                        translateUnit={translateUnit}
                        updateOrderStatus={updateOrderStatus}
                        openAssignModal={openAssignModal}
                        startIndex={(state.currentPage - 1) * ORDERS_PER_PAGE[state.viewMode] + 1}
                        user={user}
                        submitting={state.submitting}
                        onNavigateToDetails={handleNavigateToDetails}
                      />
                    ) : (
                      <div className="grid grid-cols-1 gap-1">
                        {paginatedOrders.filter(o => o && o.id && o.branchId && o.orderNumber).map(order => (
                          <OrderCard
                            key={order.id}
                            order={order}
                            isRtl={isRtl}
                            calculateAdjustedTotal={calculateAdjustedTotal}
                            calculateTotalQuantity={calculateTotalQuantity}
                            translateUnit={translateUnit}
                            updateOrderStatus={updateOrderStatus}
                            openAssignModal={openAssignModal}
                            submitting={state.submitting}
                            onNavigateToDetails={handleNavigateToDetails}
                            t={t}
                          />
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
                  </motion.div>
                )}
                <AssignChefsModal
                  isOpen={state.isAssignModalOpen}
                  onClose={() => {
                    dispatch({ type: 'SET_MODAL', modal: 'assign', isOpen: false });
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
                  t={t}
                />
              </AnimatePresence>
            )}
          </div>
        </motion.div>
      </Suspense>
    </div>
  );
};

export default Orders;