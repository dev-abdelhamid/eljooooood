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

// Lazy-loaded components
const OrderCard = lazy(() => import('../components/Shared/OrderCard'));
const OrderTable = lazy(() => import('../components/Shared/OrderTable'));
const AssignChefsModal = lazy(() => import('../components/Shared/AssignChefsModal'));
const Pagination = lazy(() => import('../components/Shared/Pagination'));

// TypeScript interfaces
interface Order {
  id: string;
  orderNumber: string;
  branchId: string;
  branchName: string;
  items: Array<{
    _id: string;
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    unit: string;
    department: { _id: string; name: string };
    assignedTo?: { _id: string; name: string };
    status: 'pending' | 'assigned' | 'in_progress' | 'completed';
    returnedQuantity: number;
    returnReason: string;
  }>;
  returns: Array<{
    returnId: string;
    status: 'pending_approval' | 'approved' | 'rejected';
    items: Array<{ productId: string; quantity: number; reason: string; unit: string }>;
    reviewNotes: string;
    createdAt: string;
  }>;
  status: 'pending' | 'approved' | 'in_production' | 'completed' | 'in_transit' | 'delivered' | 'cancelled';
  totalAmount: number;
  date: string;
  notes: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  createdBy: string;
  statusHistory: Array<{ status: string; changedBy: string; changedAt: string; notes: string }>;
}

interface Chef {
  _id: string;
  userId: string;
  name: string;
  department: { _id: string; name: string } | null;
}

interface Branch {
  _id: string;
  name: string;
}

interface AssignChefsForm {
  items: Array<{ itemId: string; assignedTo: string; product: string; quantity: number; unit: string }>;
}

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

// Initial state
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

// Reducer function
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
                          ? { _id: assignment.assignedTo._id, name: assignment.assignedTo.name }
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
                        ? { _id: assignment.assignedTo._id, name: assignment.assignedTo.name }
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
                totalAmount: action.status === 'approved'
                  ? order.totalAmount - (order.returns.find(r => r.returnId === action.returnId)?.items.reduce((sum, item) => {
                      const orderItem = order.items.find(i => i.productId === item.productId);
                      return sum + (orderItem ? orderItem.price * item.quantity : 0);
                    }, 0) || 0)
                  : order.totalAmount,
              }
            : order
        ),
        selectedOrder: state.selectedOrder?.id === action.orderId
          ? {
              ...state.selectedOrder,
              returns: state.selectedOrder.returns.map(ret =>
                ret.returnId === action.returnId ? { ...ret, status: action.status! } : ret
              ),
              totalAmount: action.status === 'approved'
                ? state.selectedOrder.totalAmount - (state.selectedOrder.returns.find(r => r.returnId === action.returnId)?.items.reduce((sum, item) => {
                    const orderItem = state.selectedOrder.items.find(i => i.productId === item.productId);
                    return sum + (orderItem ? orderItem.price * item.quantity : 0);
                  }, 0) || 0)
                : state.selectedOrder.totalAmount,
            }
          : state.selectedOrder,
      };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload, currentPage: 1 };
    default:
      return state;
  }
};

// Constants
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

// Utility functions
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

// Skeleton components
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

// Main component
export const Orders: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { socket, isConnected, emit } = useSocket();
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  const cacheRef = useRef<Map<string, Order[]>>(new Map());
  const playNotificationSound = useOrderNotifications(dispatch, stateRef, user);

  // Update stateRef
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // WebSocket listeners
  useEffect(() => {
    if (!user || !['admin', 'production'].includes(user.role)) {
      dispatch({ type: 'SET_ERROR', payload: t('errors.unauthorized_access') || (isRtl ? 'غير مصرح للوصول' : 'Unauthorized access') });
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
      dispatch({ type: 'SET_SOCKET_ERROR', payload: t('socket.connection_error') || (isRtl ? 'خطأ في الاتصال' : 'Connection error') });
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: false });
    });

    socket.on('newOrder', (order: any) => {
      if (!order || !order._id) {
        console.warn('Invalid new order data:', order);
        return;
      }
      const mappedOrder: Order = {
        id: order._id,
        orderNumber: order.orderNumber || 'N/A',
        branchId: order.branch?._id || 'unknown',
        branchName: order.branch?.name || (isRtl ? 'غير معروف' : 'Unknown'),
        items: Array.isArray(order.items)
          ? order.items.map((item: any) => ({
              _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
              productId: item.product?._id || 'unknown',
              productName: item.product?.name || (isRtl ? 'غير معروف' : 'Unknown'),
              quantity: Number(item.quantity) || 1,
              price: Number(item.price) || 0,
              unit: item.unit || 'unit',
              department: item.product?.department || { _id: 'unknown', name: isRtl ? 'غير معروف' : 'Unknown' },
              assignedTo: item.assignedTo ? { _id: item.assignedTo._id, name: item.assignedTo.name || (isRtl ? 'غير معروف' : 'Unknown') } : undefined,
              status: item.status || 'pending',
              returnedQuantity: Number(item.returnedQuantity) || 0,
              returnReason: item.returnReason || '',
            }))
          : [],
        returns: Array.isArray(order.returns)
          ? order.returns.map((ret: any) => ({
              returnId: ret._id || `temp-${Math.random().toString(36).substring(2)}`,
              items: Array.isArray(ret.items)
                ? ret.items.map((item: any) => ({
                    productId: item.product?._id || 'unknown',
                    quantity: Number(item.quantity) || 0,
                    reason: item.reason || '',
                    unit: item.unit || 'unit',
                  }))
                : [],
              status: ret.status || 'pending_approval',
              reviewNotes: ret.reviewNotes || '',
              createdAt: formatDate(ret.createdAt ? new Date(ret.createdAt) : new Date(), language),
            }))
          : [],
        status: order.status || 'pending',
        totalAmount: Number(order.totalAmount) || 0,
        date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
        notes: order.notes || '',
        priority: order.priority || 'medium',
        createdBy: order.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
        statusHistory: Array.isArray(order.statusHistory)
          ? order.statusHistory.map((history: any) => ({
              status: history.status || 'pending',
              changedBy: history.changedBy || 'unknown',
              changedAt: formatDate(history.changedAt ? new Date(history.changedAt) : new Date(), language),
              notes: history.notes || '',
            }))
          : [],
      };
      dispatch({ type: 'ADD_ORDER', payload: mappedOrder });
      playNotificationSound('/sounds/new-order.mp3', [200, 100, 200]);
      toast.success(t('orders.new_order', { orderNumber: order.orderNumber }) || `New order received: ${order.orderNumber}`, {
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
      toast.info(t('orders.status_updated', { status: t(`orders.status_${status}`) }) || `Order status updated to: ${status}`, {
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
      toast.info(t('orders.return_status_updated', { status: t(`orders.return_status_${status}`) }) || `Return status updated to: ${status}`, {
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
      toast.info(t('orders.chefs_assigned') || 'Chefs assigned', {
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
  }, [user, socket, t, isRtl, language, playNotificationSound]);

  // Fetch data with retry mechanism
  const fetchData = useCallback(
    async (retryCount = 0) => {
      if (!user || !['admin', 'production'].includes(user.role)) {
        dispatch({ type: 'SET_ERROR', payload: t('errors.unauthorized_access') || (isRtl ? 'غير مصرح للوصول' : 'Unauthorized access') });
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
          .filter((order: any) => order && order._id)
          .map((order: any) => ({
            id: order._id,
            orderNumber: order.orderNumber || 'N/A',
            branchId: order.branch?._id || 'unknown',
            branchName: order.branch?.name || (isRtl ? 'غير معروف' : 'Unknown'),
            items: Array.isArray(order.items)
              ? order.items.map((item: any) => ({
                  _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
                  productId: item.product?._id || 'unknown',
                  productName: item.product?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                  quantity: Number(item.quantity) || 1,
                  price: Number(item.price) || 0,
                  unit: item.unit || 'unit',
                  department: item.product?.department || { _id: 'unknown', name: isRtl ? 'غير معروف' : 'Unknown' },
                  assignedTo: item.assignedTo ? { _id: item.assignedTo._id, name: item.assignedTo.name || (isRtl ? 'غير معروف' : 'Unknown') } : undefined,
                  status: item.status || 'pending',
                  returnedQuantity: Number(item.returnedQuantity) || 0,
                  returnReason: item.returnReason || '',
                }))
              : [],
            returns: Array.isArray(order.returns)
              ? order.returns.map((ret: any) => ({
                  returnId: ret._id || `temp-${Math.random().toString(36).substring(2)}`,
                  items: Array.isArray(ret.items)
                    ? ret.items.map((item: any) => ({
                        productId: item.product?._id || 'unknown',
                        quantity: Number(item.quantity) || 0,
                        reason: item.reason || '',
                        unit: item.unit || 'unit',
                      }))
                    : [],
                  status: ret.status || 'pending_approval',
                  reviewNotes: ret.reviewNotes || '',
                  createdAt: formatDate(ret.createdAt ? new Date(ret.createdAt) : new Date(), language),
                }))
              : [],
            status: order.status || 'pending',
            totalAmount: Number(order.totalAmount) || 0,
            date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
            notes: order.notes || '',
            priority: order.priority || 'medium',
            createdBy: order.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
            statusHistory: Array.isArray(order.statusHistory)
              ? order.statusHistory.map((history: any) => ({
                  status: history.status || 'pending',
                  changedBy: history.changedBy || 'unknown',
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
              department: chef.department || null,
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
          ? t('errors.no_orders_found') || (isRtl ? 'لم يتم العثور على طلبات' : 'No orders found')
          : t('errors.fetch_orders', { message: err.message }) || (isRtl ? `خطأ في جلب الطلبات: ${err.message}` : `Error fetching orders: ${err.message}`);
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [user, state.filterStatus, state.filterBranch, state.currentPage, state.viewMode, state.searchQuery, state.sortBy, state.sortOrder, t, isRtl, language]
  );

  // Calculate adjusted total
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
      return (order.totalAmount - approvedReturnsTotal).toLocaleString(isRtl ? 'ar-SA' : 'en-US', {
        style: 'currency',
        currency: 'SAR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    },
    [isRtl]
  );

  // Export to Excel
  const exportToExcel = useCallback(() => {
    const headers = [
      t('orders.orderNumber') || 'Order Number',
      t('orders.branchName') || 'Branch',
      t('orders.status') || 'Status',
      t('orders.priority') || 'Priority',
      t('orders.totalAmount') || 'Total Amount',
      t('orders.items_count') || 'Items Count',
      t('orders.date') || 'Date',
    ];
    const data = state.orders.map(order => ({
      [headers[0]]: order.orderNumber,
      [headers[1]]: order.branchName,
      [headers[2]]: t(`orders.status_${order.status}`) || order.status,
      [headers[3]]: t(`orders.priority_${order.priority}`) || order.priority,
      [headers[4]]: calculateAdjustedTotal(order),
      [headers[5]]: order.items.reduce((sum, item) => sum + item.quantity, 0),
      [headers[6]]: order.date,
    }));
    const ws = XLSX.utils.json_to_sheet(isRtl ? data.map(row => Object.fromEntries(Object.entries(row).reverse())) : data, { header: headers });
    if (isRtl) ws['!views'] = [{ RTL: true }];
    ws['!cols'] = headers.map((_, i) => ({ wch: i === 2 ? 40 : 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('orders.title') || 'Orders');
    XLSX.writeFile(wb, 'Orders.xlsx');
    toast.success(t('orders.export_success') || (isRtl ? 'تم تصدير الملف بنجاح' : 'Export successful'), {
      position: isRtl ? 'top-left' : 'top-right',
      autoClose: 3000,
    });
  }, [state.orders, t, isRtl, calculateAdjustedTotal]);

  // Export to PDF
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
      doc.text(t('orders.title') || 'Orders', isRtl ? doc.internal.pageSize.width - 20 : 20, 15, { align: isRtl ? 'right' : 'left' });

      const headers = [
        t('orders.orderNumber') || 'Order Number',
        t('orders.branchName') || 'Branch',
        t('orders.status') || 'Status',
        t('orders.priority') || 'Priority',
        t('orders.totalAmount') || 'Total Amount',
        t('orders.items_count') || 'Items Count',
        t('orders.date') || 'Date',
      ];
      const data = state.orders.map(order => [
        order.orderNumber,
        order.branchName,
        t(`orders.status_${order.status}`) || order.status,
        t(`orders.priority_${order.priority}`) || order.priority,
        calculateAdjustedTotal(order),
        order.items.reduce((sum, item) => sum + item.quantity, 0).toString(),
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
            t('orders.generated_on', { date: formatDate(new Date(), language) }) || `Generated on: ${formatDate(new Date(), language)}`,
            isRtl ? doc.internal.pageSize.width - 10 : 10,
            doc.internal.pageSize.height - 10,
            { align: isRtl ? 'right' : 'left' }
          );
          doc.text(
            t('pagination.page', { current: data.pageNumber, total: '' }) || `Page ${data.pageNumber}`,
            isRtl ? 10 : doc.internal.pageSize.width - 30,
            doc.internal.pageSize.height - 10,
            { align: isRtl ? 'left' : 'right' }
          );
        },
        styles: { overflow: 'linebreak', font: fontName, fontSize: 8, cellPadding: 2, halign: isRtl ? 'right' : 'left' },
      });

      doc.save('Orders.pdf');
      toast.success(t('orders.export_pdf_success') || (isRtl ? 'تم تصدير PDF بنجاح' : 'PDF export successful'), {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    } catch (err: any) {
      console.error('PDF export error:', err.message);
      toast.error(t('orders.export_pdf_error') || (isRtl ? 'خطأ في تصدير PDF' : 'PDF export error'), {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    }
  }, [state.orders, t, isRtl, language, calculateAdjustedTotal]);

  // Search handling
  const handleSearchChange = useMemo(
    () =>
      debounce((value: string) => {
        dispatch({ type: 'SET_SEARCH_QUERY', payload: value });
      }, 300),
    []
  );

  // Filtered, sorted, and paginated orders
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
        return state.sortOrder === 'asc' ? a.totalAmount - b.totalAmount : b.totalAmount - a.totalAmount;
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

  // Order actions
  const updateOrderStatus = useCallback(
    async (orderId: string, newStatus: Order['status']) => {
      const order = state.orders.find(o => o.id === orderId);
      if (!order || !validTransitions[order.status].includes(newStatus)) {
        toast.error(t('errors.invalid_transition') || (isRtl ? 'انتقال غير صالح' : 'Invalid transition'), {
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
        toast.success(t('orders.status_updated', { status: t(`orders.status_${newStatus}`) }) || `Order status updated to: ${newStatus}`, {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } catch (err: any) {
        console.error('Update order status error:', err.message);
        toast.error(t('errors.update_order_status', { message: err.message }) || `Failed to update status: ${err.message}`, {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [state.orders, t, isRtl, socket, isConnected, emit]
  );

  const updateItemStatus = useCallback(
    async (orderId: string, itemId: string, status: Order['items'][0]['status']) => {
      if (!user?.id) {
        toast.error(t('errors.no_user') || (isRtl ? 'لا يوجد مستخدم مرتبط' : 'No user associated'), {
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
        toast.success(t('orders.item_status_updated', { status: t(`orders.item_${status}`) }) || `Item status updated to: ${status}`, {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } catch (err: any) {
        console.error('Update item status error:', err.message);
        toast.error(t('errors.update_item_status', { message: err.message }) || `Failed to update item status: ${err.message}`, {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [t, isRtl, user, socket, isConnected, emit]
  );

  const assignChefs = useCallback(
    async (orderId: string) => {
      if (!user?.id || state.assignFormData.items.some(item => !item.assignedTo)) {
        toast.error(t('orders.assign_error') || (isRtl ? 'يرجى تعيين شيف واحد على الأقل' : 'Please assign at least one chef'), {
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
          assignedTo: state.chefs.find(chef => chef.userId === item.assignedTo) || { _id: item.assignedTo, name: isRtl ? 'غير معروف' : 'Unknown' },
          status: 'assigned',
        }));
        dispatch({ type: 'TASK_ASSIGNED', orderId, items });
        dispatch({ type: 'SET_MODAL', modal: 'assign', isOpen: false });
        dispatch({ type: 'SET_ASSIGN_FORM', payload: { items: [] } });
        if (socket && isConnected) {
          emit('taskAssigned', { orderId, items });
        }
        toast.success(t('orders.chefs_assigned') || (isRtl ? 'تم تعيين الشيفات بنجاح' : 'Chefs assigned successfully'), {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } catch (err: any) {
        console.error('Assign chefs error:', err.message);
        toast.error(t('errors.assign_chef', { message: err.message }) || `Failed to assign chefs: ${err.message}`, {
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
        toast.error(t('errors.order_not_approved') || (isRtl ? 'الطلب لم يتم الموافقة عليه' : 'Order not approved'), {
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
              product: item.productName,
              quantity: item.quantity,
              unit: item.unit || 'unit',
            })),
        },
      });
      dispatch({ type: 'SET_MODAL', modal: 'assign', isOpen: true });
    },
    [t, isRtl]
  );

  // Fetch data on mount or when filters change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Render
  return (
    <div className="px-2 py-4 min-h-screen bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
      <Suspense fallback={<OrderTableSkeleton isRtl={isRtl} />}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-6">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
                <ShoppingCart className="w-6 h-6 text-amber-600" />
                {t('orders.title') || (isRtl ? 'الطلبات' : 'Orders')}
              </h1>
              <p className="text-xs text-gray-500 mt-1">{t('orders.subtitle') || (isRtl ? 'إدارة طلبات الإنتاج' : 'Manage production orders')}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={state.orders.length > 0 ? 'primary' : 'secondary'}
                onClick={state.orders.length > 0 ? exportToExcel : undefined}
                className={`flex items-center gap-1.5 ${
                  state.orders.length > 0 ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                } rounded-md px-3 py-1.5 text-xs shadow-sm`}
                disabled={state.orders.length === 0}
                aria-label={t('orders.export_excel') || (isRtl ? 'تصدير إلى Excel' : 'Export to Excel')}
              >
                <Download className="w-4 h-4" />
                {t('orders.export_excel') || (isRtl ? 'تصدير إلى Excel' : 'Export to Excel')}
              </Button>
              <Button
                variant={state.orders.length > 0 ? 'primary' : 'secondary'}
                onClick={state.orders.length > 0 ? exportToPDF : undefined}
                className={`flex items-center gap-1.5 ${
                  state.orders.length > 0 ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                } rounded-md px-3 py-1.5 text-xs shadow-sm`}
                disabled={state.orders.length === 0}
                aria-label={t('orders.export_pdf') || (isRtl ? 'تصدير إلى PDF' : 'Export to PDF')}
              >
                <Upload className="w-4 h-4" />
                {t('orders.export_pdf') || (isRtl ? 'تصدير إلى PDF' : 'Export to PDF')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: state.viewMode === 'card' ? 'table' : 'card' })}
                className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md px-3 py-1.5 text-xs shadow-sm"
                aria-label={t(state.viewMode === 'card' ? 'orders.view_table' : 'orders.view_card') || (isRtl ? (state.viewMode === 'card' ? 'عرض كجدول' : 'عرض كبطاقات') : (state.viewMode === 'card' ? 'View as Table' : 'View as Cards'))}
              >
                {state.viewMode === 'card' ? <Table2 className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
                {t(state.viewMode === 'card' ? 'orders.view_table' : 'orders.view_card') || (isRtl ? (state.viewMode === 'card' ? 'عرض كجدول' : 'عرض كبطاقات') : (state.viewMode === 'card' ? 'View as Table' : 'View as Cards'))}
              </Button>
            </div>
          </div>
          <Card className="p-3 sm:p-4 mt-4 bg-white shadow-md rounded-md border border-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('common.search') || (isRtl ? 'بحث' : 'Search')}</label>
                <div className="relative">
                  <Search className={`w-4 h-4 text-gray-500 absolute top-2.5 ${isRtl ? 'right-3' : 'left-3'}`} />
                  <Input
                    value={state.searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder={t('orders.search_placeholder') || (isRtl ? 'ابحث حسب رقم الطلب أو المنتج...' : 'Search by order number or product...')}
                    className={`w-full ${isRtl ? 'pr-10' : 'pl-10'} rounded-md border-gray-200 focus:ring-amber-500 text-xs shadow-sm`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('orders.filter_by_status') || (isRtl ? 'تصفية حسب الحالة' : 'Filter by Status')}</label>
                <Select
                  options={statusOptions.map(opt => ({
                    value: opt.value,
                    label: t(`orders.status_${opt.value}`) || (isRtl ? 'كل الحالات' : 'All Statuses'),
                  }))}
                  value={state.filterStatus}
                  onChange={(value) => dispatch({ type: 'SET_FILTER_STATUS', payload: value })}
                  className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-xs shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('orders.filter_by_branch') || (isRtl ? 'تصفية حسب الفرع' : 'Filter by Branch')}</label>
                <Select
                  options={[{ value: '', label: t('branches.all') || (isRtl ? 'جميع الفروع' : 'All Branches') }, ...state.branches.map(b => ({ value: b._id, label: b.name }))]}
                  value={state.filterBranch}
                  onChange={(value) => dispatch({ type: 'SET_FILTER_BRANCH', payload: value })}
                  className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-xs shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('orders.sort_by') || (isRtl ? 'ترتيب حسب' : 'Sort By')}</label>
                <Select
                  options={sortOptions.map(opt => ({
                    value: opt.value,
                    label: t(`orders.${opt.label}`) || opt.label,
                  }))}
                  value={state.sortBy}
                  onChange={(value) => dispatch({ type: 'SET_SORT', by: value as any, order: state.sortOrder })}
                  className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-xs shadow-sm"
                />
              </div>
            </div>
            <div className="text-xs text-center text-gray-500 mt-3">
              {t('orders.orders_count', { count: filteredOrders.length }) || (isRtl ? `عدد الطلبات: ${filteredOrders.length}` : `Orders count: ${filteredOrders.length}`)}
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
                  className="mt-3 bg-amber-500 hover:bg-amber-600 text-white rounded-md px-4 py-1.5 text-xs shadow-sm"
                  aria-label={t('common.retry') || (isRtl ? 'إعادة المحاولة' : 'Retry')}
                >
                  {t('common.retry') || (isRtl ? 'إعادة المحاولة' : 'Retry')}
                </Button>
              </Card>
            </motion.div>
          ) : (
            <AnimatePresence>
              {paginatedOrders.length === 0 ? (
                <motion.div key="no-orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="mt-4">
                  <Card className="p-6 sm:p-8 text-center bg-white shadow-md rounded-md border border-gray-100">
                    <ShoppingCart className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-sm font-medium text-gray-800 mb-2">{t('orders.no_orders') || (isRtl ? 'لا توجد طلبات' : 'No Orders')}</h3>
                    <p className="text-xs text-gray-500">
                      {state.filterStatus || state.filterBranch || state.searchQuery
                        ? t('orders.no_matching_orders') || (isRtl ? 'لا توجد طلبات مطابقة' : 'No matching orders')
                        : t('orders.no_orders_yet') || (isRtl ? 'لا توجد طلبات بعد' : 'No orders yet')}
                    </p>
                  </Card>
                </motion.div>
              ) : state.viewMode === 'table' ? (
                <motion.div key="table-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="mt-4">
                  <OrderTable
                    orders={paginatedOrders.filter(o => o && o.id && o.branchId)}
                    t={t}
                    isRtl={isRtl}
                    calculateAdjustedTotal={calculateAdjustedTotal}
                    updateOrderStatus={updateOrderStatus}
                    openAssignModal={openAssignModal}
                    startIndex={(state.currentPage - 1) * ORDERS_PER_PAGE[state.viewMode] + 1}
                    submitting={state.submitting}
                  />
                </motion.div>
              ) : (
                <motion.div key="card-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="space-y-3 mt-4">
                  {paginatedOrders.filter(o => o && o.id && o.branchId).map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      t={t}
                      isRtl={isRtl}
                      calculateAdjustedTotal={calculateAdjustedTotal}
                      updateOrderStatus={updateOrderStatus}
                      openAssignModal={openAssignModal}
                      submitting={state.submitting}
                    />
                  ))}
                </motion.div>
              )}
              {paginatedOrders.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="mt-4">
                  <Pagination
                    currentPage={state.currentPage}
                    totalPages={Math.ceil(sortedOrders.length / ORDERS_PER_PAGE[state.viewMode])}
                    t={t}
                    isRtl={isRtl}
                    handlePageChange={(page) => dispatch({ type: 'SET_PAGE', payload: page })}
                  />
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
                t={t}
                isRtl={isRtl}
              />
            </AnimatePresence>
          )}
        </motion.div>
      </Suspense>
    </div>
  );
};

export default Orders;