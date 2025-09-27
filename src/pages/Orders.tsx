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
import { Order, Chef, Branch, AssignChefsForm, OrderStatus } from '../types/types';
import { useNavigate } from 'react-router-dom';
import { exportToPDF } from '../components/Shared/PDFExporter';
import { OrderCardSkeleton } from '../components/Shared/OrderSkeletons';
import { OrderTableSkeleton } from '../components/Shared/OrderSkeletons';
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
                        ? { 
                            ...assignment.assignedTo, 
                            displayName: state.isRtl ? assignment.assignedTo.name : assignment.assignedTo.nameEn || assignment.assignedTo.name 
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
                          displayName: state.isRtl ? assignment.assignedTo.name : assignment.assignedTo.nameEn || assignment.assignedTo.name 
                        }
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

const exportToExcel = (orders: Order[], isRtl: boolean, calculateAdjustedTotal: (order: Order) => string, calculateTotalQuantity: (order: Order) => number, translateUnit: (unit: string, isRtl: boolean) => string) => {
  const headers = [
    isRtl ? 'رقم الطلب' : 'Order Number',
    isRtl ? 'الفرع' : 'Branch',
    isRtl ? 'الحالة' : 'Status',
    isRtl ? 'المنتجات' : 'Products',
    isRtl ? 'إجمالي المبلغ' : 'Total Amount',
    isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
    isRtl ? 'التاريخ' : 'Date',
  ];
  const data = orders.map(order => {
    const productsStr = order.items.map(i => `${i.displayProductName} (${i.quantity} ${i.displayUnit})`).join(', ');
    const totalAmount = calculateAdjustedTotal(order);
    const totalQuantity = `${calculateTotalQuantity(order)} ${isRtl ? 'وحدة' : 'units'}`;
    const statusLabel = isRtl ? {pending: 'قيد الانتظار', approved: 'تم الموافقة', in_production: 'في الإنتاج', completed: 'مكتمل', in_transit: 'في النقل', delivered: 'تم التسليم', cancelled: 'ملغى'}[order.status] : order.status;
    return {
      [headers[0]]: order.orderNumber,
      [headers[1]]: order.branch.displayName,
      [headers[2]]: statusLabel,
      [headers[3]]: productsStr,
      [headers[4]]: totalAmount + (isRtl ? ' ر.س' : ''),
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
  XLSX.utils.book_append_sheet(wb, ws, isRtl ? 'الطلبات' : 'Orders');
  XLSX.writeFile(wb, 'Orders.xlsx');
  toast.success(isRtl ? 'تم تصدير الملف بنجاح' : 'Export successful', {
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
  const processedEventIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // تحديث displayUnit عند تغيير اللغة
  useEffect(() => {
    dispatch({
      type: 'SET_ORDERS',
      payload: state.orders.map(order => ({
        ...order,
        items: order.items.map(item => ({
          ...item,
          displayUnit: isRtl ? (item.unit || 'وحدة') : (item.unitEn || item.unit || 'unit'),
          displayProductName: isRtl ? item.productName : (item.productNameEn || item.productName),
          department: {
            ...item.department,
            displayName: isRtl ? item.department.name : (item.department.nameEn || item.department.name),
          },
        })),
        branch: {
          ...order.branch,
          displayName: isRtl ? order.branch.name : (order.branch.nameEn || order.branch.name),
        },
      })),
    });
    if (state.selectedOrder) {
      dispatch({
        type: 'SET_SELECTED_ORDER',
        payload: {
          ...state.selectedOrder,
          items: state.selectedOrder.items.map(item => ({
            ...item,
            displayUnit: isRtl ? (item.unit || 'وحدة') : (item.unitEn || item.unit || 'unit'),
            displayProductName: isRtl ? item.productName : (item.productNameEn || item.productName),
            department: {
              ...item.department,
              displayName: isRtl ? item.department.name : (item.department.nameEn || item.department.name),
            },
          })),
          branch: {
            ...state.selectedOrder.branch,
            displayName: isRtl ? state.selectedOrder.branch.name : (state.selectedOrder.branch.nameEn || state.selectedOrder.branch.name),
          },
        },
      });
    }
  }, [isRtl]);

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
      const formatted = adjusted.toLocaleString(isRtl ? 'ar-SA' : 'en-US', {
        style: 'currency',
        currency: 'SAR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return formatted;
    },
    [isRtl]
  );

  const handleNavigateToDetails = useCallback((orderId: string) => {
    navigate(`/orders/${orderId}`);
    window.scrollTo(0, 0);
  }, [navigate]);

  useEffect(() => {
    if (!user || !['admin', 'production'].includes(user.role)) {
      dispatch({ type: 'SET_ERROR', payload: isRtl ? 'غير مصرح للوصول' : 'Unauthorized access' });
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }
    if (!socket) return;
    socket.on('connect', () => {
      console.log(`[${new Date().toISOString()}] Socket connected`);
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: true });
      dispatch({ type: 'SET_SOCKET_ERROR', payload: null });
      if (user.role === 'admin') {
        socket.emit('joinRoom', 'admin');
      } else if (user.role === 'production' && user.department) {
        socket.emit('joinRoom', `production-${user.department._id}`);
        socket.emit('joinRoom', `branch-${user.branchId}`);
      }
    });
    socket.on('connect_error', (err) => {
      console.error(`[${new Date().toISOString()}] Socket connect error:`, err.message);
      dispatch({ type: 'SET_SOCKET_ERROR', payload: isRtl ? 'خطأ في الاتصال' : 'Connection error' });
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
    socket.on('newOrder', (order: any, eventId: string) => {
      if (!order || !order._id || !order.orderNumber || processedEventIds.current.has(eventId)) {
        console.warn(`[${new Date().toISOString()}] Invalid or duplicate new order data:`, { order, eventId });
        return;
      }
      processedEventIds.current.add(eventId);
      console.log(`[${new Date().toISOString()}] Received newOrder:`, { orderId: order._id, eventId });
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
              displayUnit: isRtl ? (item.product?.unit || 'وحدة') : (item.product?.unitEn || item.product?.unit || 'unit'),
              department: {
                _id: item.product?.department?._id || 'unknown',
                name: item.product?.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                nameEn: item.product?.department?.nameEn,
                displayName: isRtl ? item.product?.department?.name : item.product?.department?.nameEn || item.product?.department?.name,
              },
              assignedTo: item.assignedTo ? { 
                _id: item.assignedTo._id, 
                username: item.assignedTo.username, 
                name: item.assignedTo.name || item.assignedTo.username || (isRtl ? 'غير معروف' : 'Unknown'), 
                nameEn: item.assignedTo.nameEn,
                displayName: isRtl ? item.assignedTo.name : item.assignedTo.nameEn || item.assignedTo.name,
                department: item.assignedTo.department 
              } : undefined,
              status: item.status || 'pending',
              returnedQuantity: Number(item.returnedQuantity) || 0,
              returnReason: item.returnReason || '',
            }))
          : [],
        returns: Array.isArray(order.returns)
          ? order.returns.map((ret: any) => ({
              returnId: ret._id || `temp-${Math.random().toString(36).substring(2)}`,
              returnNumber: ret.returnNumber || (isRtl ? 'غير معروف' : 'Unknown'),
              items: Array.isArray(ret.items)
                ? ret.items.map((item: any) => ({
                    productId: item.product?._id || 'unknown',
                    productName: item.product?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    productNameEn: item.product?.nameEn,
                    quantity: Number(item.quantity) || 0,
                    reason: item.reason || (isRtl ? 'غير محدد' : 'Unspecified'),
                    unit: item.product?.unit || 'unit',
                    unitEn: item.product?.unitEn,
                    displayUnit: isRtl ? (item.product?.unit || 'وحدة') : (item.product?.unitEn || item.product?.unit || 'unit'),
                  }))
                : [],
              status: ret.status || 'pending',
              reviewNotes: ret.notes || '',
              createdAt: formatDate(ret.createdAt ? new Date(ret.createdAt) : new Date(), language),
              createdBy: {
                _id: ret.createdBy?._id,
                username: ret.createdBy?.username,
                name: ret.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                nameEn: ret.createdBy?.nameEn,
                displayName: isRtl ? ret.createdBy?.name : ret.createdBy?.nameEn || ret.createdBy?.name,
              },
            }))
          : [],
        status: order.status || 'pending',
        totalAmount: Number(order.totalAmount) || 0,
        adjustedTotal: Number(order.adjustedTotal) || 0,
        date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
        requestedDeliveryDate: order.requestedDeliveryDate ? new Date(order.requestedDeliveryDate) : undefined,
        notes: order.notes || '',
        priority: order.priority || 'medium',
        createdBy: order.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
        approvedBy: order.approvedBy ? { _id: order.approvedBy._id, name: order.approvedBy.name || (isRtl ? 'غير معروف' : 'Unknown') } : undefined,
        approvedAt: order.approvedAt ? new Date(order.approvedAt) : undefined,
        deliveredAt: order.deliveredAt ? new Date(order.deliveredAt) : undefined,
        transitStartedAt: order.transitStartedAt ? new Date(order.transitStartedAt) : undefined,
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
      playNotificationSound('/sounds/new-order.mp3', [200, 100, 200]);
    });
    socket.on('orderStatusUpdated', ({ orderId, status, eventId }: { orderId: string; status: Order['status']; eventId: string }) => {
      if (!orderId || !status || processedEventIds.current.has(eventId)) {
        console.warn(`[${new Date().toISOString()}] Invalid or duplicate order status update:`, { orderId, status, eventId });
        return;
      }
      processedEventIds.current.add(eventId);
      console.log(`[${new Date().toISOString()}] Received orderStatusUpdated:`, { orderId, status, eventId });
      dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status });
    });
    socket.on('itemStatusUpdated', ({ orderId, itemId, status, eventId }: { orderId: string; itemId: string; status: string; eventId: string }) => {
      if (!orderId || !itemId || !status || processedEventIds.current.has(eventId)) {
        console.warn(`[${new Date().toISOString()}] Invalid or duplicate item status update:`, { orderId, itemId, status, eventId });
        return;
      }
      processedEventIds.current.add(eventId);
      console.log(`[${new Date().toISOString()}] Received itemStatusUpdated:`, { orderId, itemId, status, eventId });
      dispatch({ type: 'UPDATE_ITEM_STATUS', orderId, payload: { itemId, status } });
    });
    socket.on('returnStatusUpdated', ({ orderId, returnId, status, eventId }: { orderId: string; returnId: string; status: string; eventId: string }) => {
      if (!orderId || !returnId || !status || processedEventIds.current.has(eventId)) {
        console.warn(`[${new Date().toISOString()}] Invalid or duplicate return status update:`, { orderId, returnId, status, eventId });
        return;
      }
      processedEventIds.current.add(eventId);
      console.log(`[${new Date().toISOString()}] Received returnStatusUpdated:`, { orderId, returnId, status, eventId });
      dispatch({ type: 'RETURN_STATUS_UPDATED', orderId, returnId, status });
      toast.info(isRtl ? `تم تحديث حالة الإرجاع إلى: ${isRtl ? {pending: 'قيد الانتظار', approved: 'تم الموافقة', rejected: 'مرفوض', processed: 'معالج'}[status] : status}` : `Return status updated to: ${status}`, {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    });
    socket.on('taskAssigned', ({ orderId, items, eventId }: { orderId: string; items: any[]; eventId: string }) => {
      if (!orderId || !items || processedEventIds.current.has(eventId)) {
        console.warn(`[${new Date().toISOString()}] Invalid or duplicate task assigned data:`, { orderId, items, eventId });
        return;
      }
      processedEventIds.current.add(eventId);
      console.log(`[${new Date().toISOString()}] Received taskAssigned:`, { orderId, items, eventId });
      dispatch({ type: 'TASK_ASSIGNED', orderId, items });
      toast.info(isRtl ? 'تم تعيين الشيفات' : 'Chefs assigned', {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    });
    return () => {
      socket.off('connect');
      socket.off('connect_error');
      socket.off('reconnect');
      socket.off('disconnect');
      socket.off('newOrder');
      socket.off('orderStatusUpdated');
      socket.off('itemStatusUpdated');
      socket.off('returnStatusUpdated');
      socket.off('taskAssigned');
    };
  }, [user, socket, isRtl, language, playNotificationSound]);

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
                  displayUnit: isRtl ? (item.product?.unit || 'وحدة') : (item.product?.unitEn || item.product?.unit || 'unit'),
                  department: {
                    _id: item.product?.department?._id || 'unknown',
                    name: item.product?.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: item.product?.department?.nameEn,
                    displayName: isRtl ? item.product?.department?.name : item.product?.department?.nameEn || item.product?.department?.name,
                  },
                  assignedTo: item.assignedTo ? { 
                    _id: item.assignedTo._id, 
                    username: item.assignedTo.username, 
                    name: item.assignedTo.name || item.assignedTo.username || (isRtl ? 'غير معروف' : 'Unknown'), 
                    nameEn: item.assignedTo.nameEn,
                    displayName: isRtl ? item.assignedTo.name : item.assignedTo.nameEn || item.assignedTo.name,
                    department: item.assignedTo.department 
                  } : undefined,
                  status: item.status || 'pending',
                  returnedQuantity: Number(item.returnedQuantity) || 0,
                  returnReason: item.returnReason || '',
                }))
              : [],
            returns: Array.isArray(order.returns)
              ? order.returns.map((ret: any) => ({
                  returnId: ret._id || `temp-${Math.random().toString(36).substring(2)}`,
                  returnNumber: ret.returnNumber || (isRtl ? 'غير معروف' : 'Unknown'),
                  items: Array.isArray(ret.items)
                    ? ret.items.map((item: any) => ({
                        productId: item.product?._id || 'unknown',
                        productName: item.product?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                        productNameEn: item.product?.nameEn,
                        quantity: Number(item.quantity) || 0,
                        reason: item.reason || (isRtl ? 'غير محدد' : 'Unspecified'),
                        unit: item.product?.unit || 'unit',
                        unitEn: item.product?.unitEn,
                        displayUnit: isRtl ? (item.product?.unit || 'وحدة') : (item.product?.unitEn || item.product?.unit || 'unit'),
                      }))
                    : [],
                  status: ret.status || 'pending',
                  reviewNotes: ret.notes || '',
                  createdAt: formatDate(ret.createdAt ? new Date(ret.createdAt) : new Date(), language),
                  createdBy: {
                    _id: ret.createdBy?._id,
                    username: ret.createdBy?.username,
                    name: ret.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: ret.createdBy?.nameEn,
                    displayName: isRtl ? ret.createdBy?.name : ret.createdBy?.nameEn || ret.createdBy?.name,
                  },
                }))
              : [],
            status: order.status || 'pending',
            totalAmount: Number(order.totalAmount) || 0,
            adjustedTotal: Number(order.adjustedTotal) || 0,
            date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
            requestedDeliveryDate: order.requestedDeliveryDate ? new Date(order.requestedDeliveryDate) : undefined,
            notes: order.notes || '',
            priority: order.priority || 'medium',
            createdBy: order.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
            approvedBy: order.approvedBy ? { _id: order.approvedBy._id, name: order.approvedBy.name || (isRtl ? 'غير معروف' : 'Unknown') } : undefined,
            approvedAt: order.approvedAt ? new Date(order.appliedAt) : undefined,
            deliveredAt: order.deliveredAt ? new Date(order.deliveredAt) : undefined,
            transitStartedAt: order.transitStartedAt ? new Date(order.transitStartedAt) : undefined,
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
              department: chef.department ? { 
                _id: chef.department._id, 
                name: chef.department.name || (isRtl ? 'غير معروف' : 'Unknown'),
                nameEn: chef.department.nameEn,
                displayName: isRtl ? chef.department.name : (chef.department.nameEn || chef.department.name) 
              } : null,
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
        console.error(`[${new Date().toISOString()}] Fetch data error:`, err.message);
        if (retryCount < 2) {
          setTimeout(() => fetchData(retryCount + 1), 1000);
          return;
        }
        const errorMessage = err.response?.status === 404
          ? isRtl ? 'لم يتم العثور على طلبات' : 'No orders found'
          : isRtl ? `خطأ في جلب الطلبات: ${err.message}` : `Error fetching orders: ${err.message}`;
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [user, state.sortBy, state.sortOrder, isRtl, language]
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
            order.branch.displayName.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
            (order.notes || '').toLowerCase().includes(state.searchQuery.toLowerCase()) ||
            order.createdBy.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
            order.items.some(item => item.displayProductName.toLowerCase().includes(state.searchQuery.toLowerCase()))
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
    async (orderId: string, newStatus: OrderStatus) => {
      const order = state.orders.find(o => o.id === orderId);
      if (!order || !validTransitions[order.status].includes(newStatus)) {
        toast.error(isRtl ? 'انتقال غير صالح' : 'Invalid transition', {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        await ordersAPI.updateStatus(orderId, { status: newStatus });
        const eventId = crypto.randomUUID();
        dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status: newStatus });
        if (socket && isConnected) {
          emit('orderStatusUpdated', { orderId, status: newStatus, eventId });
        }
        toast.success(isRtl ? `تم تحديث الحالة إلى ${newStatus}` : `Order status updated to: ${newStatus}`, {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Update order status error:`, err.message);
        toast.error(isRtl ? `فشل في تحديث الحالة: ${err.message}` : `Failed to update status: ${err.message}`, {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [state.orders, isRtl, socket, isConnected, emit]
  );

  const updateItemStatus = useCallback(
    async (orderId: string, itemId: string, status: Order['items'][0]['status']) => {
      if (!user?.id) {
        toast.error(isRtl ? 'لا يوجد مستخدم مرتبط' : 'No user associated', {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        await ordersAPI.updateItemStatus(orderId, itemId, { status });
        const eventId = crypto.randomUUID();
        dispatch({ type: 'UPDATE_ITEM_STATUS', orderId, payload: { itemId, status } });
        if (socket && isConnected) {
          emit('itemStatusUpdated', { orderId, itemId, status, eventId });
        }
        toast.success(isRtl ? `تم تحديث حالة العنصر إلى: ${status}` : `Item status updated to: ${status}`, {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Update item status error:`, err.message);
        toast.error(isRtl ? `فشل في تحديث حالة العنصر: ${err.message}` : `Failed to update item status: ${err.message}`, {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [isRtl, user, socket, isConnected, emit]
  );

  const assignChefs = useCallback(
    async (orderId: string) => {
      if (!user?.id || state.assignFormData.items.some(item => !item.assignedTo)) {
        toast.error(isRtl ? 'يرجى تعيين شيف واحد على الأقل' : 'Please assign at least one chef', {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        await ordersAPI.assignChef(orderId, { items: state.assignFormData.items });
        const eventId = crypto.randomUUID();
        const items = state.assignFormData.items.map(item => ({
          _id: item.itemId,
          assignedTo: state.chefs.find(chef => chef.userId === item.assignedTo) || { _id: item.assignedTo, name: isRtl ? 'غير معروف' : 'Unknown', department: { _id: 'unknown', name: isRtl ? 'غير معروف' : 'Unknown' } },
          status: 'assigned',
        }));
        dispatch({ type: 'TASK_ASSIGNED', orderId, items });
        dispatch({ type: 'SET_MODAL', modal: 'assign', isOpen: false });
        dispatch({ type: 'SET_ASSIGN_FORM', payload: { items: [] } });
        if (socket && isConnected) {
          emit('taskAssigned', { orderId, items, eventId });
        }
        toast.success(isRtl ? 'تم تعيين الشيفات بنجاح' : 'Chefs assigned successfully', {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Assign chefs error:`, err.message);
        toast.error(isRtl ? `فشل في تعيين الشيفات: ${err.message}` : `Failed to assign chefs: ${err.message}`, {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [user, state.assignFormData, state.chefs, socket, isConnected, emit, isRtl]
  );

  const openAssignModal = useCallback(
    (order: Order) => {
      if (order.status !== 'approved') {
        toast.error(isRtl ? 'الطلب لم يتم الموافقة عليه' : 'Order not approved', {
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
              product: item.displayProductName,
              quantity: item.quantity,
              unit: item.displayUnit,
            })),
        },
      });
      dispatch({ type: 'SET_MODAL', modal: 'assign', isOpen: true });
    },
    [[isRtl]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExportPDF = useCallback(() => {
    exportToPDF({
      title: isRtl ? 'تقرير الطلبات' : 'Orders Report',
      headers: [
        isRtl ? 'رقم الطلب' : 'Order Number',
        isRtl ? 'الفرع' : 'Branch',
        isRtl ? 'الحالة' : 'Status',
        isRtl ? 'المنتجات' : 'Products',
        isRtl ? 'إجمالي المبلغ' : 'Total Amount',
        isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
        isRtl ? 'التاريخ' : 'Date',
      ],
      data: filteredOrders.map(order => [
        order.orderNumber,
        order.branch.displayName,
        isRtl ? {pending: 'قيد الانتظار', approved: 'تم الموافقة', in_production: 'في الإنتاج', completed: 'مكتمل', in_transit: 'في النقل', delivered: 'تم التسليم', cancelled: 'ملغى'}[order.status] : order.status,
        order.items.map(i => `${i.displayProductName} (${i.quantity} ${i.displayUnit})`).join(', '),
        calculateAdjustedTotal(order) + (isRtl ? ' ر.س' : ''),
        `${calculateTotalQuantity(order)} ${isRtl ? 'وحدة' : 'units'}`,
        order.date,
      ]),
      fileName: 'Orders.pdf',
      isRtl,
    });
    toast.success(isRtl ? 'تم تصدير PDF بنجاح' : 'PDF exported successfully', {
      position: isRtl ? 'top-left' : 'top-right',
      autoClose: 3000,
    });
  }, [filteredOrders, isRtl, calculateAdjustedTotal, calculateTotalQuantity]);

  return (
    <div className={`min-h-screen bg-gray-100 ${isRtl ? 'font-arabic' : 'font-sans'}`}>
      <div className="container mx-auto p-4 sm:p-6">
        <Card className="mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4">
            <h1 className="text-2xl font-bold text-gray-800">
              {isRtl ? 'الطلبات' : 'Orders'}
            </h1>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={Grid}
                  onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'card' })}
                  className={`p-2 ${state.viewMode === 'card' ? 'bg-blue-100' : ''}`}
                  aria-label={isRtl ? 'عرض البطاقات' : 'Card view'}
                />
                <Button
                  variant="outline"
                  size="sm"
                  icon={Table2}
                  onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'table' })}
                  className={`p-2 ${state.viewMode === 'table' ? 'bg-blue-100' : ''}`}
                  aria-label={isRtl ? 'عرض الجدول' : 'Table view'}
                />
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={Download}
                onClick={() => exportToExcel(sortedOrders, isRtl, calculateAdjustedTotal, calculateTotalQuantity, translateUnit)}
                className="bg-green-500 hover:bg-green-600 text-white"
                aria-label={isRtl ? 'تصدير إلى Excel' : 'Export to Excel'}
              >
                {isRtl ? 'تصدير Excel' : 'Export Excel'}
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Download}
                onClick={handleExportPDF}
                className="bg-blue-500 hover:bg-blue-600 text-white"
                aria-label={isRtl ? 'تصدير إلى PDF' : 'Export to PDF'}
              >
                {isRtl ? 'تصدير PDF' : 'Export PDF'}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="mb-6">
          <div className="flex flex-col sm:flex-row gap-4 p-4">
            <div className="flex-1">
              <Input
                type="text"
                placeholder={isRtl ? 'ابحث بالرقم، الفرع، أو الملاحظات...' : 'Search by number, branch, or notes...'}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full"
                icon={Search}
                aria-label={isRtl ? 'البحث في الطلبات' : 'Search orders'}
              />
            </div>
            <Select
              options={[{ value: '', label: isRtl ? 'جميع الفروع' : 'All Branches' }, ...state.branches.map(branch => ({
                value: branch._id,
                label: branch.displayName,
              }))]}
              value={state.filterBranch}
              onChange={(value) => dispatch({ type: 'SET_FILTER_BRANCH', payload: value })}
              placeholder={isRtl ? 'اختر الفرع' : 'Select Branch'}
              className="w-full sm:w-48"
              aria-label={isRtl ? 'تصفية حسب الفرع' : 'Filter by branch'}
            />
            <Select
              options={statusOptions.map(opt => ({
                value: opt.value,
                label: isRtl ? { 
                  '': 'جميع الحالات', 
                  pending: 'قيد الانتظار', 
                  approved: 'تم الموافقة', 
                  in_production: 'في الإنتاج', 
                  completed: 'مكتمل', 
                  in_transit: 'في النقل', 
                  delivered: 'تم التسليم', 
                  cancelled: 'ملغى' 
                }[opt.value] : t(opt.label),
              }))}
              value={state.filterStatus}
              onChange={(value) => dispatch({ type: 'SET_FILTER_STATUS', payload: value })}
              placeholder={isRtl ? 'اختر الحالة' : 'Select Status'}
              className="w-full sm:w-48"
              aria-label={isRtl ? 'تصفية حسب الحالة' : 'Filter by status'}
            />
            <Select
              options={sortOptions.map(opt => ({
                value: opt.value,
                label: isRtl ? { sort_date: 'حسب التاريخ', sort_total_amount: 'حسب إجمالي المبلغ', sort_priority: 'حسب الأولوية' }[opt.label] : t(opt.label),
              }))}
              value={state.sortBy}
              onChange={(value) => dispatch({ type: 'SET_SORT', by: value as 'date' | 'totalAmount' | 'priority', order: state.sortOrder })}
              placeholder={isRtl ? 'الترتيب حسب' : 'Sort By'}
              className="w-full sm:w-48"
              aria-label={isRtl ? 'الترتيب حسب' : 'Sort by'}
            />
            <Select
              options={[
                { value: 'asc', label: isRtl ? 'تصاعدي' : 'Ascending' },
                { value: 'desc', label: isRtl ? 'تنازلي' : 'Descending' },
              ]}
              value={state.sortOrder}
              onChange={(value) => dispatch({ type: 'SET_SORT', by: state.sortBy, order: value as 'asc' | 'desc' })}
              placeholder={isRtl ? 'ترتيب' : 'Order'}
              className="w-full sm:w-48"
              aria-label={isRtl ? 'ترتيب الطلبات' : 'Order direction'}
            />
          </div>
        </Card>

        {state.loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {state.viewMode === 'card' ? (
              Array.from({ length: ORDERS_PER_PAGE.card }).map((_, i) => (
                <OrderCardSkeleton key={i} />
              ))
            ) : (
              <OrderTableSkeleton />
            )}
          </div>
        ) : state.error ? (
          <div className="text-center py-10">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-lg text-gray-700">{state.error}</p>
          </div>
        ) : paginatedOrders.length === 0 ? (
          <div className="text-center py-10">
            <ShoppingCart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg text-gray-700">{isRtl ? 'لا توجد طلبات' : 'No orders found'}</p>
          </div>
        ) : (
          <Suspense fallback={<OrderCardSkeleton />}>
            <div ref={listRef} className={state.viewMode === 'card' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : ''}>
              {state.viewMode === 'card' ? (
                paginatedOrders.map(order => (
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
                ))
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
                  onNavigate={handleNavigateToDetails}
                />
              )}
            </div>
          </Suspense>
        )}

        {totalPages > 1 && (
          <Pagination
            currentPage={state.currentPage}
            totalPages={totalPages}
            onPageChange={(page) => dispatch({ type: 'SET_PAGE', payload: page })}
            isRtl={isRtl}
          />
        )}

        <AnimatePresence>
          {state.isAssignModalOpen && state.selectedOrder && (
            <Suspense fallback={<div>Loading...</div>}>
              <AssignChefsModal
                isOpen={state.isAssignModalOpen}
                onClose={() => dispatch({ type: 'SET_MODAL', modal: 'assign', isOpen: false })}
                order={state.selectedOrder}
                chefs={state.chefs}
                assignFormData={state.assignFormData}
                setAssignFormData={(data) => dispatch({ type: 'SET_ASSIGN_FORM', payload: data })}
                onSubmit={() => assignChefs(state.selectedOrder!.id)}
                submitting={state.submitting === state.selectedOrder.id}
                isRtl={isRtl}
              />
            </Suspense>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Orders;