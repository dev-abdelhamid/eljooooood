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
  isInitialLoad: boolean;
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
  loading: false,
  isInitialLoad: true,
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
      return { ...state, orders: action.payload, error: '', isInitialLoad: false };
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
      return { ...state, filterStatus: action.payload, currentPage: 1, loading: true };
    case 'SET_FILTER_BRANCH':
      return { ...state, filterBranch: action.payload, currentPage: 1, loading: true };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload, currentPage: 1, loading: true };
    case 'SET_SORT':
      return { ...state, sortBy: action.by ?? 'date', sortOrder: action.order ?? 'desc', currentPage: 1, loading: true };
    case 'SET_PAGE':
      return { ...state, currentPage: action.payload, loading: true };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_INITIAL_LOAD':
      return { ...state, isInitialLoad: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isInitialLoad: false };
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
        selectedOrder: state.selectedOrder && state.selectedOrder.id === action.orderId
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
        selectedOrder: state.selectedOrder && state.selectedOrder.id === action.orderId
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
        selectedOrder: state.selectedOrder && state.selectedOrder.id === action.orderId
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
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload, currentPage: 1, loading: true };
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
          {Array(11).fill(0).map((_, index) => (
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
            {Array(11).fill(0).map((_, cellIndex) => (
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
  const { language } = useLanguage();
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
      dispatch({ type: 'SET_ERROR', payload: isRtl ? 'غير مصرح للوصول' : 'Unauthorized access' });
      dispatch({ type: 'SET_LOADING', payload: false });
      dispatch({ type: 'SET_INITIAL_LOAD', payload: false });
      return;
    }

    if (!socket) return;

    socket.on('connect', () => {
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: true });
      dispatch({ type: 'SET_SOCKET_ERROR', payload: null });
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
        branchName: order.branch?.name || (isRtl ? 'غير معروف' : 'Unknown'),
        items: Array.isArray(order.items)
          ? order.items.map((item: any) => ({
              _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
              productId: item.product?._id || 'unknown',
              productName: item.product?.name || (isRtl ? 'غير معروف' : 'Unknown'),
              quantity: Number(item.quantity) || 1,
              price: Number(item.price) || 0,
              unit: item.product?.unit || 'unit',
              department: item.product?.department ? { _id: item.product.department._id, name: item.product.department.name || (isRtl ? 'غير معروف' : 'Unknown') } : { _id: 'unknown', name: isRtl ? 'غير معروف' : 'Unknown' },
              assignedTo: item.assignedTo ? { _id: item.assignedTo._id, name: item.assignedTo.name || (isRtl ? 'غير معروف' : 'Unknown'), department: item.assignedTo.department } : undefined,
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
              returnNumber: ret.returnNumber || (isRtl ? 'غير معروف' : 'Unknown'),
              items: Array.isArray(ret.items)
                ? ret.items.map((item: any) => ({
                    productId: item.product?._id || 'unknown',
                    productName: item.product?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    quantity: Number(item.quantity) || 0,
                    reason: item.reason || (isRtl ? 'غير محدد' : 'Unspecified'),
                    unit: item.product?.unit || 'unit',
                  }))
                : [],
              status: ret.status || 'pending',
              reviewNotes: ret.notes || '',
              createdAt: formatDate(ret.createdAt ? new Date(ret.createdAt) : new Date(), language),
              createdBy: ret.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
            }))
          : [],
        status: order.status || 'pending',
        totalAmount: Number(order.totalAmount) || 0,
        adjustedTotal: Number(order.totalAmount) || 0,
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
      toast.success(isRtl ? `طلب جديد: ${mappedOrder.orderNumber}` : `New order received: ${mappedOrder.orderNumber}`, {
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
      toast.info(isRtl ? `تم تحديث حالة الطلب إلى: ${isRtl ? {pending: 'قيد الانتظار', approved: 'تم الموافقة', in_production: 'في الإنتاج', completed: 'مكتمل', in_transit: 'في النقل', delivered: 'تم التسليم', cancelled: 'ملغى'}[status] : status}` : `Order status updated to: ${status}`, {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    });

    socket.on('itemStatusUpdated', ({ orderId, itemId, status }: { orderId: string; itemId: string; status: string }) => {
      if (!orderId || !itemId || !status) {
        console.warn('Invalid item status update data:', { orderId, itemId, status });
        return;
      }
      dispatch({ type: 'UPDATE_ITEM_STATUS', orderId, payload: { itemId, status } });
      toast.info(isRtl ? `تم تحديث حالة العنصر إلى: ${isRtl ? {pending: 'قيد الانتظار', assigned: 'معين', in_progress: 'قيد التقدم', completed: 'مكتمل'}[status] : status}` : `Item status updated to: ${status}`, {
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
      toast.info(isRtl ? `تم تحديث حالة الإرجاع إلى: ${isRtl ? {pending: 'قيد الانتظار', approved: 'تم الموافقة', rejected: 'مرفوض', processed: 'معالج'}[status] : status}` : `Return status updated to: ${status}`, {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    });

    socket.on('taskAssigned', ({ orderId, items }: { orderId: string; items: any[] }) => {
      if (!orderId || !items) {
        console.warn('Invalid task assigned data:', { orderId, items });
        return;
      }
      const mappedItems = items.map(item => ({
        _id: item._id,
        assignedTo: state.chefs.find(chef => chef.userId === item.assignedTo) || {
          _id: item.assignedTo,
          name: isRtl ? 'غير معروف' : 'Unknown',
          department: { _id: 'unknown', name: isRtl ? 'غير معروف' : 'Unknown' },
        },
        status: item.status || 'assigned',
      }));
      dispatch({ type: 'TASK_ASSIGNED', orderId, items: mappedItems });
      toast.info(isRtl ? 'تم تعيين الشيفات' : 'Chefs assigned', {
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
  }, [user, socket, isRtl, language, playNotificationSound, state.chefs]);

  // جلب البيانات مع آلية إعادة المحاولة
  const fetchData = useCallback(
    debounce(async (retryCount = 0) => {
      if (!user || !['admin', 'production'].includes(user.role)) {
        dispatch({ type: 'SET_ERROR', payload: isRtl ? 'غير مصرح للوصول' : 'Unauthorized access' });
        dispatch({ type: 'SET_LOADING', payload: false });
        dispatch({ type: 'SET_INITIAL_LOAD', payload: false });
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
            branchName: order.branch?.name || (isRtl ? 'غير معروف' : 'Unknown'),
            items: Array.isArray(order.items)
              ? order.items.map((item: any) => ({
                  _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
                  productId: item.product?._id || 'unknown',
                  productName: item.product?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                  quantity: Number(item.quantity) || 1,
                  price: Number(item.price) || 0,
                  unit: item.product?.unit || 'unit',
                  department: item.product?.department ? { _id: item.product.department._id, name: item.product.department.name || (isRtl ? 'غير معروف' : 'Unknown') } : { _id: 'unknown', name: isRtl ? 'غير معروف' : 'Unknown' },
                  assignedTo: item.assignedTo ? { _id: item.assignedTo._id, name: item.assignedTo.name || (isRtl ? 'غير معروف' : 'Unknown'), department: item.assignedTo.department } : undefined,
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
                  returnNumber: ret.returnNumber || (isRtl ? 'غير معروف' : 'Unknown'),
                  items: Array.isArray(ret.items)
                    ? ret.items.map((item: any) => ({
                        productId: item.product?._id || 'unknown',
                        productName: item.product?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                        quantity: Number(item.quantity) || 0,
                        reason: item.reason || (isRtl ? 'غير محدد' : 'Unspecified'),
                        unit: item.product?.unit || 'unit',
                      }))
                    : [],
                  status: ret.status || 'pending',
                  reviewNotes: ret.notes || '',
                  createdAt: formatDate(ret.createdAt ? new Date(ret.createdAt) : new Date(), language),
                  createdBy: ret.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                }))
              : [],
            status: order.status || 'pending',
            totalAmount: Number(order.totalAmount) || 0,
            adjustedTotal: Number(order.totalAmount) || 0,
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

        cacheRef.current.set(cacheKey, mappedOrders);
        dispatch({ type: 'SET_ORDERS', payload: mappedOrders });
        dispatch({
          type: 'SET_CHEFS',
          payload: chefsResponse
            .filter((chef: any) => chef && chef.user?._id)
            .map((chef: any) => ({
              _id: chef._id,
              userId: chef.user._id,
              name: chef.user?.name || chef.name || (isRtl ? 'غير معروف' : 'Unknown'),
              department: chef.department ? { _id: chef.department._id, name: chef.department.name || (isRtl ? 'غير معروف' : 'Unknown') } : null,
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
          ? isRtl ? 'لم يتم العثور على طلبات' : 'No orders found'
          : isRtl ? `خطأ في جلب الطلبات: ${err.message}` : `Error fetching orders: ${err.message}`;
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }, 300),
    [user, state.filterStatus, state.filterBranch, state.currentPage, state.viewMode, state.searchQuery, state.sortBy, state.sortOrder, isRtl, language]
  );

  // تصدير إلى Excel
  const exportToExcel = useCallback(() => {
    const headers = [
      isRtl ? 'رقم الطلب' : 'Order Number',
      isRtl ? 'الفرع' : 'Branch',
      isRtl ? 'الحالة' : 'Status',
      isRtl ? 'الأولوية' : 'Priority',
      isRtl ? 'إجمالي المبلغ' : 'Total Amount',
      isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
      isRtl ? 'التاريخ' : 'Date',
    ];
    const data = state.orders.map(order => ({
      [headers[0]]: order.orderNumber,
      [headers[1]]: order.branchName,
      [headers[2]]: isRtl ? {pending: 'قيد الانتظار', approved: 'تم الموافقة', in_production: 'في الإنتاج', completed: 'مكتمل', in_transit: 'في النقل', delivered: 'تم التسليم', cancelled: 'ملغى'}[order.status] : order.status,
      [headers[3]]: isRtl ? {urgent: 'عاجل', high: 'مرتفع', medium: 'متوسط', low: 'منخفض'}[order.priority] : order.priority,
      [headers[4]]: calculateAdjustedTotal(order),
      [headers[5]]: `${calculateTotalQuantity(order)} ${isRtl ? 'وحدة' : 'units'}`,
      [headers[6]]: order.date,
    }));
    const ws = XLSX.utils.json_to_sheet(isRtl ? data.map(row => Object.fromEntries(Object.entries(row).reverse())) : data, { header: headers });
    if (isRtl) ws['!views'] = [{ RTL: true }];
    ws['!cols'] = headers.map((_, i) => ({ wch: i === 2 ? 40 : 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isRtl ? 'الطلبات' : 'Orders');
    XLSX.writeFile(wb, 'Orders.xlsx');
    toast.success(isRtl ? 'تم تصدير الملف بنجاح' : 'Export successful', {
      position: isRtl ? 'top-left' : 'top-right',
      autoClose: 3000,
    });
  }, [state.orders, isRtl, calculateAdjustedTotal, calculateTotalQuantity]);

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
      doc.text(isRtl ? 'الطلبات' : 'Orders', isRtl ? doc.internal.pageSize.width - 20 : 20, 15, { align: isRtl ? 'right' : 'left' });

      const headers = [
        isRtl ? 'رقم الطلب' : 'Order Number',
        isRtl ? 'الفرع' : 'Branch',
        isRtl ? 'الحالة' : 'Status',
        isRtl ? 'الأولوية' : 'Priority',
        isRtl ? 'إجمالي المبلغ' : 'Total Amount',
        isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
        isRtl ? 'التاريخ' : 'Date',
      ];
      const data = state.orders.map(order => [
        order.orderNumber,
        order.branchName,
        isRtl ? {pending: 'قيد الانتظار', approved: 'تم الموافقة', in_production: 'في الإنتاج', completed: 'مكتمل', in_transit: 'في النقل', delivered: 'تم التسليم', cancelled: 'ملغى'}[order.status] : order.status,
        isRtl ? {urgent: 'عاجل', high: 'مرتفع', medium: 'متوسط', low: 'منخفض'}[order.priority] : order.priority,
        calculateAdjustedTotal(order),
        `${calculateTotalQuantity(order)} ${isRtl ? 'وحدة' : 'units'}`,
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
            isRtl ? `تم إنشاؤه في: ${formatDate(new Date(), language)}` : `Generated on: ${formatDate(new Date(), language)}`,
            isRtl ? doc.internal.pageSize.width - 10 : 10,
            doc.internal.pageSize.height - 10,
            { align: isRtl ? 'right' : 'left' }
          );
          doc.text(
            isRtl ? `الصفحة ${data.pageNumber}` : `Page ${data.pageNumber}`,
            isRtl ? 10 : doc.internal.pageSize.width - 30,
            doc.internal.pageSize.height - 10,
            { align: isRtl ? 'left' : 'right' }
          );
        },
        styles: { overflow: 'linebreak', font: fontName, fontSize: 8, cellPadding: 2, halign: isRtl ? 'right' : 'left' },
      });

      doc.save('Orders.pdf');
      toast.success(isRtl ? 'تم تصدير PDF بنجاح' : 'PDF export successful', {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    } catch (err: any) {
      console.error('PDF export error:', err.message);
      toast.error(isRtl ? 'خطأ في تصدير PDF' : 'PDF export error', {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    }
  }, [state.orders, isRtl, language, calculateAdjustedTotal, calculateTotalQuantity]);

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
          emit('orderStatusUpdated', { orderId, status: newStatus });
        }
        toast.success(isRtl ? `تم تحديث الحالة إلى ${newStatus}` : `Order status updated to: ${newStatus}`, {
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
        dispatch({ type: 'UPDATE_ITEM_STATUS', orderId, payload: { itemId, status } });
        if (socket && isConnected) {
          emit('itemStatusUpdated', { orderId, itemId, status });
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
        const items = state.assignFormData.items.map(item => {
          const chef = state.chefs.find(c => c.userId === item.assignedTo);
          return {
            _id: item.itemId,
            assignedTo: chef
              ? { _id: chef.userId, name: chef.name, department: chef.department }
              : { _id: item.assignedTo, name: isRtl ? 'غير معروف' : 'Unknown', department: { _id: 'unknown', name: isRtl ? 'غير معروف' : 'Unknown' } },
            status: 'assigned',
          };
        });
        dispatch({ type: 'TASK_ASSIGNED', orderId, items });
        dispatch({ type: 'SET_MODAL', modal: 'assign', isOpen: false });
        dispatch({ type: 'SET_ASSIGN_FORM', payload: { items: [] } });
        if (socket && isConnected) {
          emit('taskAssigned', { orderId, items });
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
        dispatch({ type:'SET_SUBMITTING', payload: null });
      }
    },
    [user, state.assignFormData, state.chefs, socket, isConnected, emit, isRtl]
  );

  // فتح نافذة تعيين الشيفات
  const onAssignChefs = useCallback(
    (order: Order) => {
      const unassignedItems = order.items
        .filter(item => !item.assignedTo && item.status !== 'completed')
        .map(item => ({
          itemId: item._id,
          productName: item.productName,
          quantity: item.quantity,
          unit: item.unit,
          assignedTo: '',
        }));
      dispatch({ type: 'SET_ASSIGN_FORM', payload: { items: unassignedItems } });
      dispatch({ type: 'SET_SELECTED_ORDER', payload: order });
      dispatch({ type: 'SET_MODAL', isOpen: true });
    },
    []
  );

  // تحديث بيانات التعيين
  const updateAssignForm = useCallback(
    (index: number, field: keyof AssignChefsForm['items'][0], value: string) => {
      const updatedItems = [...state.assignFormData.items];
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      dispatch({ type: 'SET_ASSIGN_FORM', payload: { items: updatedItems } });
    },
    [state.assignFormData]
  );

  // إغلاق النافذة
  const closeModal = useCallback(() => {
    dispatch({ type: 'SET_MODAL', isOpen: false });
    dispatch({ type: 'SET_ASSIGN_FORM', payload: { items: [] } });
    dispatch({ type: 'SET_SELECTED_ORDER', payload: null });
  }, []);

  // جلب البيانات عند التغيير
  useEffect(() => {
    fetchData();
    return () => {
      fetchData.cancel();
    };
  }, [fetchData]);

  // تحميل البيانات عند تغيير وضع العرض
  useEffect(() => {
    if (state.viewMode) {
      dispatch({ type: 'SET_PAGE', payload: 1 });
      fetchData();
    }
  }, [state.viewMode, fetchData]);

  // إذا لم يكن المستخدم مصرحًا
  if (!user || !['admin', 'production'].includes(user.role)) {
    return (
      <div className="p-4 text-center text-red-500">
        {isRtl ? 'غير مصرح للوصول إلى هذه الصفحة' : 'Unauthorized access to this page'}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`container mx-auto p-4 space-y-4 ${isRtl ? 'text-right' : 'text-left'}`}
      dir={isRtl ? 'rtl' : 'ltr'}
      role="main"
      aria-label={isRtl ? 'صفحة الطلبات' : 'Orders Page'}
    >
      {/* رأس الصفحة */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
          <ShoppingCart className="w-6 h-6" />
          {isRtl ? 'الطلبات' : 'Orders'}
        </h1>
        <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <Button
            variant="primary"
            size="sm"
            onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: state.viewMode === 'card' ? 'table' : 'card' })}
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-3 py-1.5 text-xs sm:text-sm"
            aria-label={isRtl ? `تبديل إلى عرض ${state.viewMode === 'card' ? 'الجدول' : 'البطاقات'}` : `Switch to ${state.viewMode === 'card' ? 'table' : 'card'} view`}
          >
            {state.viewMode === 'card' ? <Table2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <Grid className="w-4 h-4 sm:w-5 sm:h-5" />}
            {isRtl ? (state.viewMode === 'card' ? 'جدول' : 'بطاقات') : (state.viewMode === 'card' ? 'Table' : 'Cards')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={exportToExcel}
            className="bg-green-500 hover:bg-green-600 text-white rounded-md px-3 py-1.5 text-xs sm:text-sm"
            aria-label={isRtl ? 'تصدير إلى Excel' : 'Export to Excel'}
          >
            <Download className="w-4 h-4 sm:w-5 sm:h-5" />
            {isRtl ? 'Excel' : 'Excel'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={exportToPDF}
            className="bg-green-500 hover:bg-green-600 text-white rounded-md px-3 py-1.5 text-xs sm:text-sm"
            aria-label={isRtl ? 'تصدير إلى PDF' : 'Export to PDF'}
          >
            <Download className="w-4 h-4 sm:w-5 sm:h-5" />
            {isRtl ? 'PDF' : 'PDF'}
          </Button>
        </div>
      </div>

      {/* إشعار خطأ الاتصال */}
      {state.socketError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-md flex items-center gap-2"
          role="alert"
        >
          <AlertCircle className="w-5 h-5" />
          {state.socketError}
        </motion.div>
      )}

      {/* الفلاتر والبحث */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Select
          value={state.filterStatus}
          onChange={e => dispatch({ type: 'SET_FILTER_STATUS', payload: e.target.value })}
          options={statusOptions.map(option => ({
            value: option.value,
            label: isRtl
              ? { '': 'جميع الحالات', pending: 'قيد الانتظار', approved: 'تم الموافقة', in_production: 'في الإنتاج', completed: 'مكتمل', in_transit: 'في النقل', delivered: 'تم التسليم', cancelled: 'ملغى' }[option.value]
              : option.label,
          }))}
          className="w-full text-xs sm:text-sm"
          aria-label={isRtl ? 'تصفية حسب الحالة' : 'Filter by status'}
        />
        <Select
          value={state.filterBranch}
          onChange={e => dispatch({ type: 'SET_FILTER_BRANCH', payload: e.target.value })}
          options={[{ _id: '', name: isRtl ? 'جميع الفروع' : 'All Branches' }, ...state.branches].map(branch => ({
            value: branch._id,
            label: branch.name,
          }))}
          className="w-full text-xs sm:text-sm"
          aria-label={isRtl ? 'تصفية حسب الفرع' : 'Filter by branch'}
        />
        <div className="relative">
          <Input
            type="text"
            placeholder={isRtl ? 'ابحث عن الطلبات...' : 'Search orders...'}
            onChange={e => handleSearchChange(e.target.value)}
            className="pl-8 pr-3 py-1.5 w-full text-xs sm:text-sm"
            aria-label={isRtl ? 'بحث الطلبات' : 'Search orders'}
          />
          <Search className="absolute top-1/2 transform -translate-y-1/2 left-2 w-4 h-4 text-gray-400" />
        </div>
      </div>

      {/* الفرز */}
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <Select
          value={state.sortBy}
          onChange={e => dispatch({ type: 'SET_SORT', by: e.target.value as 'date' | 'totalAmount' | 'priority', order: state.sortOrder })}
          options={sortOptions.map(option => ({
            value: option.value,
            label: isRtl
              ? { sort_date: 'الفرز حسب التاريخ', sort_total_amount: 'الفرز حسب إجمالي المبلغ', sort_priority: 'الفرز حسب الأولوية' }[option.label]
              : option.label,
          }))}
          className="w-full sm:w-48 text-xs sm:text-sm"
          aria-label={isRtl ? 'الفرز حسب' : 'Sort by'}
        />
        <Button
          variant="primary"
          size="sm"
          onClick={() => dispatch({ type: 'SET_SORT', by: state.sortBy, order: state.sortOrder === 'asc' ? 'desc' : 'asc' })}
          className="bg-gray-500 hover:bg-gray-600 text-white rounded-md px-3 py-1.5 text-xs sm:text-sm"
          aria-label={isRtl ? `الفرز ${state.sortOrder === 'asc' ? 'تنازلي' : 'تصاعدي'}` : `Sort ${state.sortOrder === 'asc' ? 'descending' : 'ascending'}`}
        >
          {isRtl
            ? state.sortOrder === 'asc' ? 'تصاعدي' : 'تنازلي'
            : state.sortOrder === 'asc' ? 'Ascending' : 'Descending'}
        </Button>
      </div>

      {/* عرض الخطأ */}
      {state.error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-md flex items-center gap-2"
          role="alert"
        >
          <AlertCircle className="w-5 h-5" />
          {state.error}
        </motion.div>
      )}

      {/* عرض الطلبات */}
      <Suspense
        fallback={
          state.isInitialLoad ? (
            state.viewMode === 'card' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array(ORDERS_PER_PAGE.card).fill(0).map((_, index) => (
                  <OrderCardSkeleton key={index} isRtl={isRtl} />
                ))}
              </div>
            ) : (
              <OrderTableSkeleton isRtl={isRtl} />
            )
          ) : null
        }
      >
        <AnimatePresence>
          {state.loading && state.isInitialLoad ? (
            state.viewMode === 'card' ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {Array(ORDERS_PER_PAGE.card).fill(0).map((_, index) => (
                  <OrderCardSkeleton key={index} isRtl={isRtl} />
                ))}
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <OrderTableSkeleton isRtl={isRtl} />
              </motion.div>
            )
          ) : (
            paginatedOrders.length > 0 ? (
              state.viewMode === 'card' ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                  {paginatedOrders.map((order, index) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      calculateAdjustedTotal={calculateAdjustedTotal}
                      calculateTotalQuantity={calculateTotalQuantity}
                      translateUnit={translateUnit}
                      updateOrderStatus={updateOrderStatus}
                      updateItemStatus={updateItemStatus}
                      onAssignChefs={onAssignChefs}
                      submitting={state.submitting}
                      isRtl={isRtl}
                      startIndex={(state.currentPage - 1) * ORDERS_PER_PAGE.card + index + 1}
                    />
                  ))}
                </motion.div>
              ) : (
                <OrderTable
                  orders={paginatedOrders}
                  calculateAdjustedTotal={calculateAdjustedTotal}
                  calculateTotalQuantity={calculateTotalQuantity}
                  translateUnit={translateUnit}
                  updateOrderStatus={updateOrderStatus}
                  onAssignChefs={onAssignChefs}
                  submitting={state.submitting}
                  isRtl={isRtl}
                  loading={state.loading}
                  startIndex={(state.currentPage - 1) * ORDERS_PER_PAGE.table + 1}
                />
              )
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-4 text-gray-500"
              >
                {isRtl ? 'لا توجد طلبات' : 'No orders found'}
              </motion.div>
            )
          )}
        </AnimatePresence>
      </Suspense>

      {/* التصفح */}
      {sortedOrders.length > ORDERS_PER_PAGE[state.viewMode] && (
        <Suspense fallback={<Skeleton width={200} height={40} baseColor="#f3f4f6" highlightColor="#e5e7eb" />}>
          <Pagination
            currentPage={state.currentPage}
            totalItems={sortedOrders.length}
            itemsPerPage={ORDERS_PER_PAGE[state.viewMode]}
            onPageChange={(page: number) => dispatch({ type: 'SET_PAGE', payload: page })}
            isRtl={isRtl}
          />
        </Suspense>
      )}

      {/* نافذة تعيين الشيفات */}
      <Suspense fallback={<Skeleton width="100%" height={400} baseColor="#f3f4f6" highlightColor="#e5e7eb" />}>
        {state.isAssignModalOpen && state.selectedOrder && (
          <AssignChefsModal
            order={state.selectedOrder}
            formData={state.assignFormData}
            chefs={state.chefs}
            onChange={updateAssignForm}
            onSubmit={() => assignChefs(state.selectedOrder.id)}
            onClose={closeModal}
            submitting={state.submitting}
            isRtl={isRtl}
          />
        )}
      </Suspense>
    </motion.div>
  );
};

export default Orders;