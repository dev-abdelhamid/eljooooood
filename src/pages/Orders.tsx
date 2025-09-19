import React, { useReducer, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Select } from '../components/UI/Select';
import { Input } from '../components/UI/Input';
import { ShoppingCart, AlertCircle, Search, Table2, Grid, Upload, Download } from 'lucide-react';
import { debounce } from 'lodash';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { ordersAPI, chefsAPI, branchesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { useOrderNotifications } from '../hooks/useOrderNotifications';
import { Order, Chef, Branch, AssignChefsForm, OrderStatus } from '../types/types';

// Lazy-loaded components
const OrderCard = lazy(() => import('../components/Shared/OrderCard'));
const OrderTable = lazy(() => import('../components/Shared/OrderTable'));
const AssignChefsModal = lazy(() => import('../components/Shared/AssignChefsModal'));
const Pagination = lazy(() => import('../components/Shared/Pagination'));

// واجهة الحالة
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

// واجهة الإجراء
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

// الحالة الابتدائية
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

// دالة المختزل (Reducer)
const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_ORDERS':
      return { ...state, orders: action.payload, error: '' };
    case 'ADD_ORDER':
      return { ...state, orders: [action.payload, ...state.orders.filter(o => o.id !== action.payload.id)] };
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
        orders: state.orders.map(o =>
          o.id === action.orderId ? { ...o, status: action.status! } : o
        ),
        selectedOrder: state.selectedOrder?.id === action.orderId
          ? { ...state.selectedOrder, status: action.status! }
          : state.selectedOrder,
      };
    case 'UPDATE_ITEM_STATUS':
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
                  ? 'completed'
                  : order.status,
              }
            : order
        ),
        selectedOrder: state.selectedOrder?.id === action.orderId
          ? {
              ...state.selectedOrder,
              items: state.selectedOrder.items.map(item =>
                item._id === action.payload.itemId ? { ...item, status: action.payload.status } : item
              ),
              status: state.selectedOrder.items.every(i => i.status === 'completed') && state.selectedOrder.status !== 'completed'
                ? 'completed'
                : state.selectedOrder.status,
            }
          : state.selectedOrder,
      };
    case 'TASK_ASSIGNED':
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
                          ? { _id: assignment.assignedTo._id, name: assignment.assignedTo.name, department: assignment.assignedTo.department }
                          : undefined,
                        status: assignment.status || i.status,
                      }
                    : i;
                }),
                status: order.items.every(i => i.status === 'assigned') ? 'in_production' : order.status,
              }
            : order
        ),
        selectedOrder: state.selectedOrder?.id === action.orderId
          ? {
              ...state.selectedOrder,
              items: state.selectedOrder.items.map(i => {
                const assignment = action.items?.find(a => a._id === i._id);
                return assignment
                  ? {
                      ...i,
                      assignedTo: assignment.assignedTo
                        ? { _id: assignment.assignedTo._id, name: assignment.assignedTo.name, department: assignment.assignedTo.department }
                        : undefined,
                      status: assignment.status || i.status,
                    }
                  : i;
              }),
              status: state.selectedOrder.items.every(i => i.status === 'assigned')
                ? 'in_production'
                : state.selectedOrder.status,
            }
          : state.selectedOrder,
      };
    case 'RETURN_STATUS_UPDATED':
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
        selectedOrder: state.selectedOrder?.id === action.orderId
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
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload, currentPage: 1 };
    default:
      return state;
  }
};

// الثوابت
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

// دوال مساعدة
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

// ترجمة الوحدات
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

// مكونات الهيكل العظمي (Skeleton)
const OrderTableSkeleton: React.FC<{ isRtl: boolean }> = ({ isRtl }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className="overflow-x-auto bg-white shadow-md rounded-lg border border-gray-100"
  >
    <table className="min-w-full">
      <thead>
        <tr className={isRtl ? 'flex-row-reverse' : ''}>
          {Array(7).fill(0).map((_, index) => (
            <th key={index} className="px-3 py-2">
              <Skeleton width={80} height={14} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array(5).fill(0).map((_, rowIndex) => (
          <tr
            key={rowIndex}
            className={`hover:bg-gray-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}
          >
            {Array(7).fill(0).map((_, cellIndex) => (
              <td key={cellIndex} className="px-3 py-2">
                <Skeleton width={100} height={14} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </motion.div>
);

const OrderCardSkeleton: React.FC<{ isRtl: boolean }> = ({ isRtl }) => (
  <Card className="p-3 mb-3 bg-white shadow-md rounded-lg border border-gray-100 hover:shadow-lg transition-shadow">
    <div className="flex flex-col gap-2">
      <div className={`flex items-center ${isRtl ? 'justify-end' : 'justify-between'}`}>
        <Skeleton width={160} height={18} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
        <Skeleton width={70} height={18} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
      </div>
      <Skeleton width="100%" height={5} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {Array(4).fill(0).map((_, index) => (
          <div key={index}>
            <Skeleton width={60} height={12} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
            <Skeleton width={90} height={16} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
          </div>
        ))}
      </div>
      <Skeleton width="100%" height={28} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
      <div className={`flex gap-2 ${isRtl ? 'justify-end' : 'justify-start'}`}>
        {Array(2).fill(0).map((_, index) => (
          <Skeleton key={index} width={70} height={24} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
        ))}
      </div>
    </div>
  </Card>
);

// المكون الرئيسي
export const Orders: React.FC = () => {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { socket, isConnected, emit } = useSocket();
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  const cacheRef = useRef<Map<string, Order[]>>(new Map());
  const playNotificationSound = useOrderNotifications(dispatch, stateRef, user);

  // تحديث مرجع الحالة
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // حساب إجمالي الكمية
  const calculateTotalQuantity = useCallback((order: Order) => {
    return order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }, []);

  // حساب المبلغ المعدل
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
      return (order.adjustedTotal || order.totalAmount - approvedReturnsTotal).toLocaleString(isRtl ? 'ar-SA' : 'en-US', {
        style: 'currency',
        currency: 'SAR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    },
    [isRtl]
  );

  // مستمعات WebSocket
  useEffect(() => {
    if (!user || !['admin', 'production'].includes(user.role)) {
      dispatch({ type: 'SET_ERROR', payload: t('errors.unauthorized_access') });
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
      dispatch({ type: 'SET_SOCKET_ERROR', payload: t('errors.connection_error') });
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
        branchName: order.branch?.name || t('common.unknown'),
        items: Array.isArray(order.items)
          ? order.items.map((item: any) => ({
              _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
              productId: item.product?._id || 'unknown',
              productName: item.product?.name || t('common.unknown'),
              quantity: Number(item.quantity) || 1,
              price: Number(item.price) || 0,
              unit: item.product?.unit || 'unit',
              department: item.product?.department ? { _id: item.product.department._id, name: item.product.department.name || t('common.unknown') } : { _id: 'unknown', name: t('common.unknown') },
              assignedTo: item.assignedTo ? { _id: item.assignedTo._id, name: item.assignedTo.name || t('common.unknown'), department: item.assignedTo.department || { _id: 'unknown', name: t('common.unknown') } } : undefined,
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
                    productName: item.product?.name || t('common.unknown'),
                    quantity: Number(item.quantity) || 0,
                    reason: item.reason || t('common.unspecified'),
                    unit: item.product?.unit || 'unit',
                  }))
                : [],
              status: ret.status || 'pending',
              reviewNotes: ret.notes || '',
              createdAt: formatDate(ret.createdAt ? new Date(ret.createdAt) : new Date(), language),
              createdBy: ret.createdBy?.name || t('common.unknown'),
            }))
          : [],
        status: order.status || 'pending',
        totalAmount: Number(order.totalAmount) || 0,
        adjustedTotal: Number(order.adjustedTotal) || 0,
        date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
        requestedDeliveryDate: order.requestedDeliveryDate ? new Date(order.requestedDeliveryDate) : undefined,
        notes: order.notes || '',
        priority: order.priority || 'medium',
        createdBy: order.createdBy?.name || t('common.unknown'),
        approvedBy: order.approvedBy ? { _id: order.approvedBy._id, name: order.approvedBy.name || t('common.unknown') } : undefined,
        approvedAt: order.approvedAt ? new Date(order.approvedAt) : undefined,
        deliveredAt: order.deliveredAt ? new Date(order.deliveredAt) : undefined,
        transitStartedAt: order.transitStartedAt ? new Date(order.transitStartedAt) : undefined,
        statusHistory: Array.isArray(order.statusHistory)
          ? order.statusHistory.map((history: any) => ({
              status: history.status || 'pending',
              changedBy: history.changedBy?.name || t('common.unknown'),
              changedAt: formatDate(history.changedAt ? new Date(history.changedAt) : new Date(), language),
              notes: history.notes || '',
            }))
          : [],
      };
      dispatch({ type: 'ADD_ORDER', payload: mappedOrder });
      playNotificationSound('/sounds/new-order.mp3', [200, 100, 200]);
      toast.success(t('orders.new_order_received', { orderNumber: mappedOrder.orderNumber }), {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    });

    socket.on('orderStatusUpdated', ({ orderId, status }: { orderId: string; status: Order['status'] }) => {
      if (!orderId || !status) {
        console.warn('Invalid order status update data:', { orderId, status });
        return;
      }
      dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status });
      toast.info(t('orders.order_status_updated', { status: t(`orders.statuses.${status}`) }), {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    });

    socket.on('returnStatusUpdated', ({ orderId, returnId, status }: { orderId: string; returnId: string; status: string }) => {
      if (!orderId || !returnId || !status) {
        console.warn('Invalid return status update data:', { orderId, returnId, status });
        return;
      }
      dispatch({ type: 'RETURN_STATUS_UPDATED', orderId, returnId, status });
      toast.info(t('orders.return_status_updated', { status: t(`orders.return_statuses.${status}`) }), {
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
      socket.off('returnStatusUpdated');
      socket.off('taskAssigned');
    };
  }, [user, socket, isRtl, language, playNotificationSound, t]);

  // جلب البيانات مع آلية إعادة المحاولة
  const fetchData = useCallback(
    async (retryCount = 0) => {
      if (!user || !['admin', 'production'].includes(user.role)) {
        dispatch({ type: 'SET_ERROR', payload: t('errors.unauthorized_access') });
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      dispatch({ type: 'SET_LOADING', payload: true });
      const cacheKey = `${user.id}-${state.filterStatus}-${state.filterBranch}-${state.currentPage}-${state.viewMode}-${state.searchQuery}`;
      if (cacheRef.current.has(cacheKey)) {
        dispatch({ type: 'SET_ORDERS', payload: cacheRef.current.get(cacheKey)! });
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      try {
        const query: Record<string, any> = {
          page: state.currentPage,
          limit: ORDERS_PER_PAGE[state.viewMode],
          sortBy: state.sortBy,
          sortOrder: state.sortOrder,
        };
        if (state.filterStatus) query.status = state.filterStatus;
        if (state.filterBranch) query.branch = state.filterBranch;
        if (state.searchQuery) query.search = state.searchQuery;
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
            branchName: order.branch?.name || t('common.unknown'),
            items: Array.isArray(order.items)
              ? order.items.map((item: any) => ({
                  _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
                  productId: item.product?._id || 'unknown',
                  productName: item.product?.name || t('common.unknown'),
                  quantity: Number(item.quantity) || 1,
                  price: Number(item.price) || 0,
                  unit: item.product?.unit || 'unit',
                  department: item.product?.department ? { _id: item.product.department._id, name: item.product.department.name || t('common.unknown') } : { _id: 'unknown', name: t('common.unknown') },
                  assignedTo: item.assignedTo ? { _id: item.assignedTo._id, name: item.assignedTo.name || t('common.unknown'), department: item.assignedTo.department || { _id: 'unknown', name: t('common.unknown') } } : undefined,
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
                        productName: item.product?.name || t('common.unknown'),
                        quantity: Number(item.quantity) || 0,
                        reason: item.reason || t('common.unspecified'),
                        unit: item.product?.unit || 'unit',
                      }))
                    : [],
                  status: ret.status || 'pending',
                  reviewNotes: ret.notes || '',
                  createdAt: formatDate(ret.createdAt ? new Date(ret.createdAt) : new Date(), language),
                  createdBy: ret.createdBy?.name || t('common.unknown'),
                }))
              : [],
            status: order.status || 'pending',
            totalAmount: Number(order.totalAmount) || 0,
            adjustedTotal: Number(order.adjustedTotal) || 0,
            date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
            requestedDeliveryDate: order.requestedDeliveryDate ? new Date(order.requestedDeliveryDate) : undefined,
            notes: order.notes || '',
            priority: order.priority || 'medium',
            createdBy: order.createdBy?.name || t('common.unknown'),
            approvedBy: order.approvedBy ? { _id: order.approvedBy._id, name: order.approvedBy.name || t('common.unknown') } : undefined,
            approvedAt: order.approvedAt ? new Date(order.approvedAt) : undefined,
            deliveredAt: order.deliveredAt ? new Date(order.deliveredAt) : undefined,
            transitStartedAt: order.transitStartedAt ? new Date(order.transitStartedAt) : undefined,
            statusHistory: Array.isArray(order.statusHistory)
              ? order.statusHistory.map((history: any) => ({
                  status: history.status || 'pending',
                  changedBy: history.changedBy?.name || t('common.unknown'),
                  changedAt: formatDate(history.changedAt ? new Date(history.changedAt) : new Date(), language),
                  notes: history.notes || '',
                }))
              : [],
          }));

        cacheRef.current.set(cacheKey, mappedOrders);
        dispatch({ type: 'SET_ORDERS', payload: mappedOrders });
        dispatch({
          type: 'SET_CHEFS',
          payload: chefsResponse
            .filter((chef: any) => chef && chef.user?._id)
            .map((chef: any) => ({
              _id: chef._id,
              userId: chef.user._id,
              name: chef.user?.name || chef.name || t('common.unknown'),
              department: chef.department ? { _id: chef.department._id, name: chef.department.name || t('common.unknown') } : null,
              status: chef.status || 'active',
            })),
        });
        dispatch({
          type: 'SET_BRANCHES',
          payload: branchesResponse
            .filter((branch: any) => branch && branch._id)
            .map((branch:any) => ({
              _id: branch._id,
              name: branch.name || t('common.unknown'),
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
          : t('errors.fetch_orders_error', { message: err.message });
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [user, state.filterStatus, state.filterBranch, state.currentPage, state.viewMode, state.searchQuery, state.sortBy, state.sortOrder, isRtl, language, t]
  );

  // تصدير إلى Excel
  const exportToExcel = useCallback(() => {
    const headers = [
      t('orders.order_number'),
      t('orders.branch'),
      t('orders.status'),
      t('orders.priority'),
      t('orders.total_amount'),
      t('orders.total_quantity'),
      t('orders.date'),
    ];
    const data = state.orders.map(order => ({
      [headers[0]]: order.orderNumber,
      [headers[1]]: order.branchName,
      [headers[2]]: t(`orders.statuses.${order.status}`),
      [headers[3]]: t(`orders.priorities.${order.priority}`),
      [headers[4]]: calculateAdjustedTotal(order),
      [headers[5]]: `${calculateTotalQuantity(order)} ${t('common.units')}`,
      [headers[6]]: order.date,
    }));
    const ws = XLSX.utils.json_to_sheet(isRtl ? data.map(row => Object.fromEntries(Object.entries(row).reverse())) : data, { header: headers });
    if (isRtl) ws['!views'] = [{ RTL: true }];
    ws['!cols'] = headers.map((_, i) => ({ wch: i === 2 ? 40 : 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('orders.orders'));
    XLSX.writeFile(wb, 'Orders.xlsx');
    toast.success(t('orders.export_success'), {
      position: isRtl ? 'top-left' : 'top-right',
      autoClose: 3000,
    });
  }, [state.orders, isRtl, calculateAdjustedTotal, calculateTotalQuantity, t]);

  // تصدير إلى PDF
  const exportToPDF = useCallback(async () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
      doc.setLanguage(isRtl ? 'ar' : 'en');

      const fontUrl = '/fonts/Amiri-Regular.ttf';
      const fontName = 'Amiri';
      const fontBytes = await fetch(fontUrl).then(res => {
        if (!res.ok) throw new Error('Failed to fetch font');
        return res.arrayBuffer();
      });
      doc.addFileToVFS(`${fontName}-Regular.ttf`, arrayBufferToBase64(fontBytes));
      doc.addFont(`${fontName}-Regular.ttf`, fontName, 'normal');
      doc.setFont(fontName);

      doc.setFontSize(16);
      doc.text(t('orders.orders'), isRtl ? doc.internal.pageSize.width - 20 : 20, 15, { align: isRtl ? 'right' : 'left' });

      const headers = [
        t('orders.order_number'),
        t('orders.branch'),
        t('orders.status'),
        t('orders.priority'),
        t('orders.total_amount'),
        t('orders.total_quantity'),
        t('orders.date'),
      ];
      const data = state.orders.map(order => [
        order.orderNumber,
        order.branchName,
        t(`orders.statuses.${order.status}`),
        t(`orders.priorities.${order.priority}`),
        calculateAdjustedTotal(order),
        `${calculateTotalQuantity(order)} ${t('common.units')}`,
        order.date,
      ]);

      autoTable(doc, {
        head: [isRtl ? headers.reverse() : headers],
        body: isRtl ? data.map(row => row.reverse()) : data,
        theme: 'grid',
        headStyles: {
          fillColor: [255, 193, 7],
          textColor: 255,
          fontSize: 10,
          halign: isRtl ? 'right' : 'left',
          font: fontName,
          cellPadding: 2,
        },
        bodyStyles: {
          fontSize: 8,
          halign: isRtl ? 'right' : 'left',
          font: fontName,
          cellPadding: 2,
          textColor: [33, 33, 33],
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 30 },
          2: { cellWidth: 20 },
          3: { cellWidth: 20 },
          4: { cellWidth: 25 },
          5: { cellWidth: 15 },
          6: { cellWidth: 30 },
        },
        margin: { top: 25, left: 10, right: 10 },
        didParseCell: data => {
          if (data.section === 'body' && data.column.index === 4 && isRtl) {
            data.cell.text = [data.cell.raw.toString().replace(/(\d+\.\d{2})/, ' $1 ر.س')];
          }
        },
        didDrawPage: data => {
          doc.setFont(fontName);
          doc.setFontSize(8);
          doc.text(
            t('orders.generated_on', { date: formatDate(new Date(), language) }),
            isRtl ? doc.internal.pageSize.width - 10 : 10,
            doc.internal.pageSize.height - 10,
            { align: isRtl ? 'right' : 'left' }
          );
          doc.text(
            t('orders.page', { page: data.pageNumber }),
            isRtl ? 10 : doc.internal.pageSize.width - 30,
            doc.internal.pageSize.height - 10,
            { align: isRtl ? 'left' : 'right' }
          );
        },
        styles: { overflow: 'linebreak', font: fontName, fontSize: 8, cellPadding: 2, halign: isRtl ? 'right' : 'left' },
      });

      doc.save('Orders.pdf');
      toast.success(t('orders.pdf_export_success'), {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    } catch (err: any) {
      console.error('PDF export error:', err.message);
      toast.error(t('orders.pdf_export_error'), {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    }
  }, [state.orders, isRtl, language, calculateAdjustedTotal, calculateTotalQuantity, t]);

  // التعامل مع البحث
  const handleSearchChange = useMemo(
    () =>
      debounce((value: string) => {
        dispatch({ type: 'SET_SEARCH_QUERY', payload: value });
      }, 300),
    []
  );

  // تصفية وترتيب وتجزئة الطلبات
  const filteredOrders = useMemo(
    () =>
      state.orders
        .filter(
          order =>
            order.orderNumber.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
            order.branchName.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
            (order.notes || '').toLowerCase().includes(state.searchQuery.toLowerCase()) ||
            order.createdBy.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
            order.items.some(item => item.productName.toLowerCase().includes(state.searchQuery.toLowerCase()))
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

  // إجراءات الطلب
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
        toast.success(t('orders.order_status_updated', { status: t(`orders.statuses.${newStatus}`) }), {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } catch (err: any) {
        console.error('Update order status error:', err.message);
        toast.error(t('errors.update_status_failed', { message: err.message }), {
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
        toast.error(t('errors.no_user_associated'), {
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
        toast.success(t('orders.item_status_updated', { status: t(`orders.item_statuses.${status}`) }), {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } catch (err: any) {
        console.error('Update item status error:', err.message);
        toast.error(t('errors.update_item_status_failed', { message: err.message }), {
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
        toast.error(t('errors.assign_chef_required'), {
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
          assignedTo: state.chefs.find(chef => chef._id === item.assignedTo) || { _id: item.assignedTo, name: t('common.unknown'), department: { _id: 'unknown', name: t('common.unknown') } },
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
        toast.error(t('errors.assign_chefs_failed', { message: err.message }), {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [user, state.assignFormData, state.chefs, socket, isConnected, emit, isRtl, t]
  );

  const openAssignModal = useCallback(
    (order: Order | null) => {
      console.log('Opening assign modal for order:', order?.id || 'null');
      if (!order || !Array.isArray(order.items)) {
        console.error('Invalid order or items:', order);
        dispatch({ type: 'SET_ERROR', payload: t('errors.invalid_order') });
        toast.error(t('errors.invalid_order').substring(0, 100), {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
          className: 'text-sm max-w-xs truncate',
        });
        return;
      }
      if (order.status !== 'approved') {
        console.log('Order not approved:', order.status);
        dispatch({ type: 'SET_ERROR', payload: t('errors.order_not_approved') });
        toast.error(t('errors.order_not_approved').substring(0, 100), {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
          className: 'text-sm max-w-xs truncate',
        });
        return;
      }
      dispatch({ type: 'SET_SELECTED_ORDER', payload: order });
      dispatch({
        type: 'SET_ASSIGN_FORM',
        payload: {
          items: order.items
            .filter((item) => item && !item.assignedTo)
            .map((item) => {
              const availableChefs = state.chefs.filter((chef) => chef.department?._id === item.department._id);
              const defaultChefId = availableChefs.length === 1 ? availableChefs[0].userId : '';
              return {
                itemId: item._id,
                assignedTo: defaultChefId,
                product: item.productName,
                quantity: Number(item.quantity) || 1,
                unit: item.unit || 'unit',
              };
            }),
        },
      });
      dispatch({ type: 'SET_MODAL', modal: 'assign', isOpen: true });
    },
    [isRtl, state.chefs, t]
  );

  // جلب البيانات عند التحميل أو تغيير الفلاتر
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // التصيير
  return (
    <div className="px-2 py-4 min-h-screen bg-gray-50">
      <Suspense fallback={<OrderTableSkeleton isRtl={isRtl} />}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-6">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${isRtl ? 'flex-row' : ''}`}>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
                <ShoppingCart className="w-6 h-6 text-amber-600" />
                {t('orders.orders')}
              </h1>
              <p className="text-xs text-gray-500 mt-1">{t('orders.manage_production_orders')}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={state.orders.length > 0 ? 'primary' : 'secondary'}
                onClick={state.orders.length > 0 ? exportToExcel : undefined}
                className={`flex items-center gap-1.5 ${
                  state.orders.length > 0 ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                } rounded-md px-3 py-1.5 text-xs shadow-sm`}
                disabled={state.orders.length === 0}
                aria-label={t('orders.export_to_excel')}
              >
                <Download className="w-4 h-4" />
                {t('orders.export_to_excel')}
              </Button>
              <Button
                variant={state.orders.length > 0 ? 'primary' : 'secondary'}
                onClick={state.orders.length > 0 ? exportToPDF : undefined}
                className={`flex items-center gap-1.5 ${
                  state.orders.length > 0 ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                } rounded-md px-3 py-1.5 text-xs shadow-sm`}
                disabled={state.orders.length === 0}
                aria-label={t('orders.export_to_pdf')}
              >
                <Upload className="w-4 h-4" />
                {t('orders.export_to_pdf')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: state.viewMode === 'card' ? 'table' : 'card' })}
                className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md px-3 py-1.5 text-xs shadow-sm"
                aria-label={state.viewMode === 'card' ? t('orders.view_as_table') : t('orders.view_as_cards')}
              >
                {state.viewMode === 'card' ? <Table2 className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
                {state.viewMode === 'card' ? t('orders.view_as_table') : t('orders.view_as_cards')}
              </Button>
            </div>
          </div>
          <Card className="p-3 sm:p-4 mt-4 bg-white shadow-md rounded-md border border-gray-100">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('orders.search')}</label>
                <div className="relative">
                  <Search className={`w-4 h-4 text-gray-500 absolute top-2.5 ${isRtl ? 'right-3' : 'left-3'}`} />
                  <Input
                    value={state.searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder={t('orders.search_placeholder')}
                    className={`w-full ${isRtl ? 'pr-10' : 'pl-10'} rounded-md border-gray-200 focus:ring-amber-500 text-xs shadow-sm`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('orders.filter_by_status')}</label>
                <Select
                  options={statusOptions.map(opt => ({
                    value: opt.value,
                    label: t(`orders.statuses.${opt.label}`) || t('orders.all_statuses'),
                  }))}
                  value={state.filterStatus}
                  onChange={(value) => dispatch({ type: 'SET_FILTER_STATUS', payload: value })}
                  className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-xs shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('orders.filter_by_branch')}</label>
                <Select
                  options={[{ value: '', label: t('orders.all_branches') }, ...state.branches.map(b => ({ value: b._id, label: b.name }))]}
                  value={state.filterBranch}
                  onChange={(value) => dispatch({ type: 'SET_FILTER_BRANCH', payload: value })}
                  className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-xs shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('orders.sort_by')}</label>
                <Select
                  options={sortOptions.map(opt => ({
                    value: opt.value,
                    label: t(`orders.sort_options.${opt.label}`),
                  }))}
                  value={state.sortBy}
                  onChange={(value) => dispatch({ type: 'SET_SORT', by: value as any, order: state.sortOrder })}
                  className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-xs shadow-sm"
                />
              </div>
            </div>
            <div className="text-xs text-center text-gray-500 mt-3">
              {t('orders.orders_count', { count: filteredOrders.length })}
            </div>
          </Card>
          {state.loading ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-3 mt-4">
              {state.viewMode === 'card' ? (
                Array(6).fill(null).map((_, i) => <OrderCardSkeleton key={i} isRtl={isRtl} />)
              ) : (
                <OrderTableSkeleton isRtl={isRtl} />
              )}
            </motion.div>
          ) : state.error ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="mt-4">
              <Card className="p-4 max-w-md mx-auto text-center bg-red-50 shadow-md rounded-md border border-red-100">
                <div className={`flex items-center justify-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-sm font-medium text-red-600">{state.error}</p>
                </div>
                               <Button
                  variant="primary"
                  onClick={() => fetchData()}
                  className="mt-3 bg-amber-500 hover:bg-amber-600 text-white rounded-md px-3 py-1.5 text-xs shadow-sm"
                  aria-label={t('orders.retry')}
                >
                  {t('orders.retry')}
                </Button>
              </Card>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="mt-4">
              {state.viewMode === 'card' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <AnimatePresence>
                    {paginatedOrders.map((order) => (
                      <motion.div
                        key={order.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                      >
                        <OrderCard
                          order={order}
                          calculateAdjustedTotal={calculateAdjustedTotal}
                          calculateTotalQuantity={calculateTotalQuantity}
                          translateUnit={translateUnit}
                          updateOrderStatus={updateOrderStatus}
                          updateItemStatus={updateItemStatus}
                          openAssignModal={openAssignModal}
                          submitting={state.submitting}
                          isRtl={isRtl}
                        />
                      </motion.div>
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
                  startIndex={(state.currentPage - 1) * ORDERS_PER_PAGE[state.viewMode] + 1}
                  submitting={state.submitting}
                  isRtl={isRtl}
                />
              )}
            </motion.div>
          )}
          {filteredOrders.length > ORDERS_PER_PAGE[state.viewMode] && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="mt-4"
            >
              <Pagination
                currentPage={state.currentPage}
                totalItems={filteredOrders.length}
                itemsPerPage={ORDERS_PER_PAGE[state.viewMode]}
                onPageChange={(page) => dispatch({ type: 'SET_PAGE', payload: page })}
                isRtl={isRtl}
              />
            </motion.div>
          )}
        </motion.div>
        <AnimatePresence>
          {state.isAssignModalOpen && state.selectedOrder && (
            <AssignChefsModal
              order={state.selectedOrder}
              formData={state.assignFormData}
              setFormData={(data) => dispatch({ type: 'SET_ASSIGN_FORM', payload: data })}
              onSubmit={assignChefs}
              onClose={() => dispatch({ type: 'SET_MODAL', modal: 'assign', isOpen: false })}
              chefs={state.chefs}
              submitting={state.submitting}
              isRtl={isRtl}
            />
          )}
        </AnimatePresence>
      </Suspense>
    </div>
  );
};

export default Orders;