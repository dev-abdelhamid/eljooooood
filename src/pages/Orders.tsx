import React, { useReducer, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import Select from 'react-select';
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
  lastEventId: string | null;
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
  eventId?: string;
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
  lastEventId: null,
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_ORDERS': return { ...state, orders: action.payload, error: '', currentPage: 1 };
    case 'ADD_ORDER': {
      if (action.eventId && state.lastEventId === action.eventId) return state;
      return {
        ...state,
        orders: [action.payload, ...state.orders.filter(o => o.id !== action.payload.id)],
        lastEventId: action.eventId || state.lastEventId,
      };
    }
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
    case 'UPDATE_ORDER_STATUS': {
      if (action.eventId && state.lastEventId === action.eventId) return state;
      return {
        ...state,
        orders: state.orders.map(o => o.id === action.orderId ? { ...o, status: action.status! } : o),
        selectedOrder: state.selectedOrder && state.selectedOrder.id === action.orderId
          ? { ...state.selectedOrder, status: action.status! } : state.selectedOrder,
        lastEventId: action.eventId || state.lastEventId,
      };
    }
    case 'UPDATE_ITEM_STATUS': {
      if (action.eventId && state.lastEventId === action.eventId) return state;
      return {
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
        lastEventId: action.eventId || state.lastEventId,
      };
    }
    case 'TASK_ASSIGNED': {
      if (action.eventId && state.lastEventId === action.eventId) return state;
      return {
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
        lastEventId: action.eventId || state.lastEventId,
      };
    }
    case 'RETURN_STATUS_UPDATED': {
      if (action.eventId && state.lastEventId === action.eventId) return state;
      return {
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
        lastEventId: action.eventId || state.lastEventId,
      };
    }
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
    const productsStr = order.items.map(i => `${i.displayProductName} (${i.quantity} ${translateUnit(i.displayUnit, isRtl)})`).join(', ');
    const totalAmount = calculateAdjustedTotal(order);
    const totalQuantity = `${calculateTotalQuantity(order)} ${isRtl ? 'وحدة' : 'units'}`;
    const statusLabel = isRtl ? {pending: 'قيد الانتظار', approved: 'تم الموافقة', in_production: 'في الإنتاج', completed: 'مكتمل', in_transit: 'في النقل', delivered: 'تم التسليم', cancelled: 'ملغى'}[order.status] : order.status;
    return {
      [headers[0]]: order.orderNumber,
      [headers[1]]: order.branch.displayName,
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
      dispatch({ type: 'SET_ERROR', payload: isRtl ? 'غير مصرح للوصول' : 'Unauthorized access' });
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }
    if (!socket) return;

    const handleConnect = () => {
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: true });
      dispatch({ type: 'SET_SOCKET_ERROR', payload: null });
      emit('joinRoom', { role: user.role, branchId: user.branch?._id, departmentId: user.department?._id });
    };

    const handleConnectError = (err: Error) => {
      console.error('Socket connect error:', err.message);
      dispatch({ type: 'SET_SOCKET_ERROR', payload: isRtl ? 'خطأ في الاتصال بالسيرفر' : 'Server connection error' });
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: false });
    };

    const handleReconnect = (attempt: number) => {
      console.log(`[${new Date().toISOString()}] Socket reconnected after ${attempt} attempts`);
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: true });
      emit('joinRoom', { role: user.role, branchId: user.branch?._id, departmentId: user.department?._id });
    };

    const handleDisconnect = (reason: string) => {
      console.log(`[${new Date().toISOString()}] Socket disconnected: ${reason}`);
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: false });
    };

    const handleNewOrder = (data: any) => {
      if (!data || !data._id || !data.orderNumber || !data.eventId) {
        console.warn('Invalid new order data:', data);
        return;
      }
      if (data.eventId === stateRef.current.lastEventId) return;
      const mappedOrder: Order = {
        id: data._id,
        orderNumber: data.orderNumber,
        branchId: data.branch?._id || 'unknown',
        branch: {
          _id: data.branch?._id || 'unknown',
          name: data.branch?.name || (isRtl ? 'غير معروف' : 'Unknown'),
          nameEn: data.branch?.nameEn,
          displayName: isRtl ? data.branch?.name : data.branch?.nameEn || data.branch?.name,
        },
        items: Array.isArray(data.items)
          ? data.items.map((item: any) => ({
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
        returns: Array.isArray(data.returns)
          ? data.returns.map((ret: any) => ({
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
                    displayUnit: translateUnit(item.product?.unit || 'unit', isRtl),
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
        status: data.status || 'pending',
        totalAmount: Number(data.totalAmount) || 0,
        adjustedTotal: Number(data.adjustedTotal) || 0,
        date: formatDate(data.createdAt ? new Date(data.createdAt) : new Date(), language),
        requestedDeliveryDate: data.requestedDeliveryDate ? new Date(data.requestedDeliveryDate) : undefined,
        notes: data.notes || '',
        priority: data.priority || 'medium',
        createdBy: data.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
        approvedBy: data.approvedBy ? { _id: data.approvedBy._id, name: data.approvedBy.name || (isRtl ? 'غير معروف' : 'Unknown') } : undefined,
        approvedAt: data.approvedAt ? new Date(data.approvedAt) : undefined,
        deliveredAt: data.deliveredAt ? new Date(data.deliveredAt) : undefined,
        transitStartedAt: data.transitStartedAt ? new Date(data.transitStartedAt) : undefined,
        statusHistory: Array.isArray(data.statusHistory)
          ? data.statusHistory.map((history: any) => ({
              status: history.status || 'pending',
              changedBy: history.changedBy?.name || 'unknown',
              changedAt: formatDate(history.changedAt ? new Date(history.changedAt) : new Date(), language),
              notes: history.notes || '',
            }))
          : [],
      };
      dispatch({ type: 'ADD_ORDER', payload: mappedOrder, eventId: data.eventId });
      playNotificationSound('/sounds/new-order.mp3', [200, 100, 200]);
    };

    const handleOrderStatusUpdated = ({ orderId, status, eventId }: { orderId: string; status: Order['status']; eventId: string }) => {
      if (!orderId || !status || !eventId || eventId === stateRef.current.lastEventId) return;
      dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status, eventId });
      toast.info(isRtl ? `تم تحديث حالة الطلب إلى: ${status}` : `Order status updated to: ${status}`, {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    };

    const handleItemStatusUpdated = ({ orderId, itemId, status, eventId }: { orderId: string; itemId: string; status: string; eventId: string }) => {
      if (!orderId || !itemId || !status || !eventId || eventId === stateRef.current.lastEventId) return;
      dispatch({ type: 'UPDATE_ITEM_STATUS', orderId, payload: { itemId, status }, eventId });
      toast.info(isRtl ? `تم تحديث حالة العنصر إلى: ${status}` : `Item status updated to: ${status}`, {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    };

    const handleReturnStatusUpdated = ({ orderId, returnId, status, eventId }: { orderId: string; returnId: string; status: string; eventId: string }) => {
      if (!orderId || !returnId || !status || !eventId || eventId === stateRef.current.lastEventId) return;
      dispatch({ type: 'RETURN_STATUS_UPDATED', orderId, returnId, status, eventId });
      toast.info(isRtl ? `تم تحديث حالة الإرجاع إلى: ${status}` : `Return status updated to: ${status}`, {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    };

    const handleTaskAssigned = ({ orderId, items, eventId }: { orderId: string; items: any[]; eventId: string }) => {
      if (!orderId || !items || !eventId || eventId === stateRef.current.lastEventId) return;
      dispatch({ type: 'TASK_ASSIGNED', orderId, items, eventId });
      toast.info(isRtl ? 'تم تعيين الشيفات' : 'Chefs assigned', {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    };

    const handleNewNotification = (notification: any) => {
      if (!notification || !notification.eventId || notification.eventId === stateRef.current.lastEventId) return;
      if (
        (user?.role === 'admin') ||
        (user?.role === 'production' && notification.departmentId === user?.department?._id) ||
        (user?.role === 'branch' && notification.branchId === user?.branch?._id)
      ) {
        playNotificationSound(notification.sound || '/sounds/notification.mp3', notification.vibrate || [200, 100, 200]);
        toast.info(notification.message[isRtl ? 'ar' : 'en'] || (isRtl ? 'إشعار جديد' : 'New notification'), {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      }
    };

    socket.on('connect', handleConnect);
    socket.on('connect_error', handleConnectError);
    socket.on('reconnect', handleReconnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('newOrder', handleNewOrder);
    socket.on('orderStatusUpdated', handleOrderStatusUpdated);
    socket.on('itemStatusUpdated', handleItemStatusUpdated);
    socket.on('returnStatusUpdated', handleReturnStatusUpdated);
    socket.on('taskAssigned', handleTaskAssigned);
    socket.on('newNotification', handleNewNotification);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
      socket.off('reconnect', handleReconnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('newOrder', handleNewOrder);
      socket.off('orderStatusUpdated', handleOrderStatusUpdated);
      socket.off('itemStatusUpdated', handleItemStatusUpdated);
      socket.off('returnStatusUpdated', handleReturnStatusUpdated);
      socket.off('taskAssigned', handleTaskAssigned);
      socket.off('newNotification', handleNewNotification);
    };
  }, [user, socket, isRtl, language, emit, playNotificationSound]);

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
          search: state.searchQuery,
          status: state.filterStatus,
          branch: state.filterBranch,
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
                        displayUnit: translateUnit(item.product?.unit || 'unit', isRtl),
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
              displayName: isRtl ? branch.name : (branch.nameEn || branch.name),
            }))
            .sort((a: Branch, b: Branch) => a.displayName.localeCompare(b.displayName, language)),
        });
        dispatch({ type: 'SET_ERROR', payload: '' });
      } catch (err: any) {
        console.error('Fetch data error:', err.message);
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
    [user, state.sortBy, state.sortOrder, state.searchQuery, state.filterStatus, state.filterBranch, isRtl, language]
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
            order.items.some(
              item =>
                item.displayProductName.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
                (item.returnReason || '').toLowerCase().includes(state.searchQuery.toLowerCase())
            )
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
        dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status: newStatus });
        if (socket && isConnected) {
          emit('orderStatusUpdated', { orderId, status: newStatus, eventId: crypto.randomUUID() });
        }
        toast.success(isRtl ? `تم تحديث الحالة إلى: ${newStatus}` : `Order status updated to: ${newStatus}`, {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } catch (err: any) {
        console.error('Update order status error:', err.message);
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
        dispatch({ type: 'UPDATE_ITEM_STATUS', orderId, payload: { itemId, status }, eventId: crypto.randomUUID() });
        if (socket && isConnected) {
          emit('itemStatusUpdated', { orderId, itemId, status, eventId: crypto.randomUUID() });
        }
        toast.success(isRtl ? `تم تحديث حالة العنصر إلى: ${status}` : `Item status updated to: ${status}`, {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } catch (err: any) {
        console.error('Update item status error:', err.message);
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
        const items = state.assignFormData.items.map(item => ({
          _id: item.itemId,
          assignedTo: state.chefs.find(chef => chef.userId === item.assignedTo) || { 
            _id: item.assignedTo, 
            name: isRtl ? 'غير معروف' : 'Unknown', 
            department: { _id: 'unknown', name: isRtl ? 'غير معروف' : 'Unknown' } 
          },
          status: 'assigned',
        }));
        dispatch({ type: 'TASK_ASSIGNED', orderId, items, eventId: crypto.randomUUID() });
        dispatch({ type: 'SET_MODAL', modal: 'assign', isOpen: false });
        dispatch({ type: 'SET_ASSIGN_FORM', payload: { items: [] } });
        if (socket && isConnected) {
          emit('taskAssigned', { orderId, items, eventId: crypto.randomUUID() });
        }
        toast.success(isRtl ? 'تم تعيين الشيفات بنجاح' : 'Chefs assigned successfully', {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } catch (err: any) {
        console.error('Assign chefs error:', err.message);
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
    [isRtl]
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

  const selectStyles = {
    control: (provided: any) => ({
      ...provided,
      borderRadius: '9999px',
      borderColor: '#e5e7eb',
      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      padding: '0.25rem',
      fontSize: '0.75rem',
      lineHeight: '1rem',
      backgroundColor: '#fff',
      transition: 'all 0.2s',
      '&:hover': { borderColor: '#d97706' },
      '&:focus-within': { borderColor: '#d97706', boxShadow: '0 0 0 2px rgba(217,119,6,0.2)' },
    }),
    menu: (provided: any) => ({
      ...provided,
      borderRadius: '0.5rem',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      zIndex: 20,
      fontSize: '0.75rem',
    }),
    option: (provided: any, state: any) => ({
      ...provided,
      backgroundColor: state.isSelected ? '#d97706' : state.isFocused ? '#fef3c7' : '#fff',
      color: state.isSelected ? '#fff' : '#1f2937',
      padding: '0.5rem 1rem',
      cursor: 'pointer',
      '&:hover': { backgroundColor: '#fef3c7' },
    }),
    singleValue: (provided: any) => ({
      ...provided,
      color: '#1f2937',
    }),
    placeholder: (provided: any) => ({
      ...provided,
      color: '#9ca3af',
    }),
    input: (provided: any) => ({
      ...provided,
      color: '#1f2937',
    }),
  };

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto">
      <Suspense fallback={<OrderTableSkeleton isRtl={isRtl} />}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }} className="mb-8">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div className="w-full sm:w-auto text-center sm:text-start">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center justify-center sm:justify-start gap-3">
                <ShoppingCart className="w-6 h-6 text-amber-600" />
                {isRtl ? 'الطلبات' : 'Orders'}
              </h1>
              <p className="text-sm text-gray-600 mt-2">{isRtl ? 'إدارة طلبات الإنتاج بكفاءة' : 'Efficiently manage production orders'}</p>
            </div>
            <div className="flex gap-3 flex-wrap justify-center sm:justify-end w-full sm:w-auto">
              <Button
                variant={state.orders.length > 0 ? 'primary' : 'secondary'}
                onClick={state.orders.length > 0 ? () => exportToExcel(filteredOrders, isRtl, calculateAdjustedTotal, calculateTotalQuantity, translateUnit) : undefined}
                className={`flex items-center gap-2 ${
                  state.orders.length > 0 ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                } rounded-full px-4 py-2 text-sm shadow-md transition-all duration-300`}
                disabled={state.orders.length === 0}
                aria-label={isRtl ? 'تصدير إلى Excel' : 'Export to Excel'}
              >
                <Download className="w-5 h-5" />
                {isRtl ? 'تصدير Excel' : 'Export Excel'}
              </Button>
              <Button
                variant={state.orders.length > 0 ? 'primary' : 'secondary'}
                onClick={state.orders.length > 0 ? () => {
                  const filterBranchName = state.branches.find(b => b._id === state.filterBranch)?.displayName || '';
                  exportToPDF(filteredOrders, isRtl, calculateAdjustedTotal, calculateTotalQuantity, translateUnit, state.filterStatus, filterBranchName);
                } : undefined}
                className={`flex items-center gap-2 ${
                  state.orders.length > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                } rounded-full px-4 py-2 text-sm shadow-md transition-all duration-300`}
                disabled={state.orders.length === 0}
                aria-label={isRtl ? 'تصدير إلى PDF' : 'Export to PDF'}
              >
                <Download className="w-5 h-5" />
                {isRtl ? 'تصدير PDF' : 'Export PDF'}
              </Button>
            </div>
          </div>
          <Card className="p-4 mt-6 bg-white shadow-lg rounded-xl border border-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'بحث' : 'Search'}</label>
                <div className="relative">
                  <Search className={`w-5 h-5 text-gray-400 absolute top-3 ${isRtl ? 'left-3' : 'right-3'}`} />
                  <Input
                    value={state.searchQuery}
                    onChange={(e) => handleSearchChange(e?.target?.value || '')}
                    placeholder={isRtl ? 'ابحث حسب رقم الطلب، المنتج، الملاحظات...' : 'Search by order number, product, notes...'}
                    className={`w-full ${isRtl ? 'pl-10' : 'pr-10'} rounded-full border-gray-200 focus:ring-amber-500 text-sm shadow-sm transition-all duration-200 py-2.5`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'تصفية حسب الحالة' : 'Filter by Status'}</label>
                <Select
                  options={statusOptions.map(opt => ({
                    value: opt.value,
                    label: isRtl ? { '': 'كل الحالات', pending: 'قيد الانتظار', approved: 'تم الموافقة', in_production: 'في الإنتاج', completed: 'مكتمل', in_transit: 'في النقل', delivered: 'تم التسليم', cancelled: 'ملغى' }[opt.value] : t(opt.label),
                  }))}
                  value={statusOptions.find(opt => opt.value === state.filterStatus)}
                  onChange={(option) => dispatch({ type: 'SET_FILTER_STATUS', payload: option?.value || '' })}
                  styles={selectStyles}
                  placeholder={isRtl ? 'اختر الحالة' : 'Select Status'}
                  isRtl={isRtl}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'تصفية حسب الفرع' : 'Filter by Branch'}</label>
                <Select
                  options={[{ value: '', label: isRtl ? 'جميع الفروع' : 'All Branches' }, ...state.branches.map(b => ({ value: b._id, label: b.displayName }))]}
                  value={[{ value: '', label: isRtl ? 'جميع الفروع' : 'All Branches' }, ...state.branches].find(b => b.value === state.filterBranch)}
                  onChange={(option) => dispatch({ type: 'SET_FILTER_BRANCH', payload: option?.value || '' })}
                  styles={selectStyles}
                  placeholder={isRtl ? 'اختر الفرع' : 'Select Branch'}
                  isRtl={isRtl}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'ترتيب حسب' : 'Sort By'}</label>
                <Select
                  options={sortOptions.map(opt => ({
                    value: opt.value,
                    label: isRtl ? { date: 'التاريخ', totalAmount: 'إجمالي المبلغ', priority: 'الأولوية' }[opt.value] : t(opt.label),
                  }))}
                  value={sortOptions.find(opt => opt.value === state.sortBy)}
                  onChange={(option) => dispatch({ type: 'SET_SORT', by: option?.value as any, order: state.sortOrder })}
                  styles={selectStyles}
                  placeholder={isRtl ? 'اختر الترتيب' : 'Select Sort'}
                  isRtl={isRtl}
                />
              </div>
            </div>
            <div className={`flex flex-col sm:flex-row justify-between items-center gap-4 mt-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div className="text-sm text-gray-600">
                {isRtl ? `عدد الطلبات: ${filteredOrders.length}` : `Orders count: ${filteredOrders.length}`}
              </div>
              <Button
                variant="secondary"
                onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: state.viewMode === 'card' ? 'table' : 'card' })}
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full px-4 py-2 text-sm shadow transition-all duration-300"
                aria-label={state.viewMode === 'card' ? (isRtl ? 'عرض كجدول' : 'View as Table') : (isRtl ? 'عرض كبطاقات' : 'View as Cards')}
              >
                {state.viewMode === 'card' ? <Table2 className="w-5 h-5" /> : <Grid className="w-5 h-5" />}
                {state.viewMode === 'card' ? (isRtl ? 'عرض كجدول' : 'View as Table') : (isRtl ? 'عرض كبطاقات' : 'View as Cards')}
              </Button>
            </div>
          </Card>
          <div ref={listRef} className="mt-8 min-h-[400px]">
            <AnimatePresence mode="wait">
              {state.loading ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="space-y-2">
                  {state.viewMode === 'card' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Array.from({ length: ORDERS_PER_PAGE.card }, (_, i) => <OrderCardSkeleton key={i} isRtl={isRtl} />)}
                    </div>
                  ) : (
                    <OrderTableSkeleton isRtl={isRtl} rows={ORDERS_PER_PAGE.table} />
                  )}
                </motion.div>
              ) : state.error ? (
                <motion.div key="error" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="mt-8">
                  <Card className="p-6 max-w-md mx-auto text-center bg-red-50 shadow-lg rounded-xl border border-red-100">
                    <div className={`flex items-center justify-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <AlertCircle className="w-6 h-6 text-red-600" />
                      <p className="text-sm font-medium text-red-600">{state.error}</p>
                    </div>
                    <Button
                      variant="primary"
                      onClick={() => fetchData()}
                      className="mt-4 bg-amber-600 hover:bg-amber-700 text-white rounded-full px-4 py-2 text-sm shadow transition-all duration-300"
                      aria-label={isRtl ? 'إعادة المحاولة' : 'Retry'}
                    >
                      {isRtl ? 'إعادة المحاولة' : 'Retry'}
                    </Button>
                  </Card>
                </motion.div>
              ) : (
                <AnimatePresence mode="wait">
                  {paginatedOrders.length === 0 ? (
                    <motion.div key="no-orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="mt-8">
                      <Card className="p-8 text-center bg-white shadow-lg rounded-xl border border-gray-100">
                        <ShoppingCart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-800 mb-2">{isRtl ? 'لا توجد طلبات' : 'No Orders'}</h3>
                        <p className="text-sm text-gray-500">
                          {state.filterStatus || state.filterBranch || state.searchQuery
                            ? isRtl ? 'لا توجد طلبات مطابقة' : 'No matching orders'
                            : isRtl ? 'لا توجد طلبات بعد' : 'No orders yet'}
                        </p>
                      </Card>
                    </motion.div>
                  ) : (
                    <motion.div key="orders-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="space-y-4">
                      {state.viewMode === 'table' ? (
                        <OrderTable
                          orders={paginatedOrders.filter(o => o && o.id && o.branchId && o.orderNumber)}
                          calculateAdjustedTotal={calculateAdjustedTotal}
                          calculateTotalQuantity={calculateTotalQuantity}
                          translateUnit={translateUnit}
                          updateOrderStatus={updateOrderStatus}
                          openAssignModal={openAssignModal}
                          submitting={state.submitting}
                          isRtl={isRtl}
                          startIndex={(state.currentPage - 1) * ORDERS_PER_PAGE[state.viewMode] + 1}
                          onRowClick={handleNavigateToDetails}
                        />
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {paginatedOrders.filter(o => o && o.id && o.branchId && o.orderNumber).map(order => (
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
                              onClick={() => handleNavigateToDetails(order.id)}
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
                  />
                </AnimatePresence>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </Suspense>
    </div>
  );
};

export default Orders;