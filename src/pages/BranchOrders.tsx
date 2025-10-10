import React, { useReducer, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { ordersAPI, inventoryAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { ProductSearchInput, ProductDropdown } from './NewOrder';
import { ShoppingCart, Upload, Table2, Grid, AlertCircle } from 'lucide-react';
import { debounce } from 'lodash';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { exportToPDF } from '../components/branch/PDFExporter'; // Import the new PDFExporter
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { useOrderNotifications } from '../hooks/useOrderNotifications';
import { Order, OrderStatus, ItemStatus } from '../components/branch/types';
import { formatDate } from '../utils/formatDate';
import OrderCardSkeleton from '../components/branch/OrderCardSkeleton';
import OrderTableSkeleton from '../components/branch/OrderTableSkeleton';

// Lazy-loaded components
const OrderTable = lazy(() => import('../components/branch/OrderTable'));
const OrderCard = lazy(() => import('../components/branch/OrderCard'));
const Pagination = lazy(() => import('../components/branch/Pagination'));
const ViewModal = lazy(() => import('../components/branch/ViewModal'));
const ConfirmDeliveryModal = lazy(() => import('../components/branch/ConfirmDeliveryModal'));

// State and Action interfaces
interface State {
  orders: Order[];
  selectedOrder: Order | null;
  isViewModalOpen: boolean;
  isConfirmDeliveryModalOpen: boolean;
  searchQuery: string;
  filterStatus: string;
  sortBy: 'date' | 'totalAmount';
  sortOrder: 'asc' | 'desc';
  currentPage: number;
  loading: boolean;
  error: string;
  submitting: string | null;
  socketConnected: boolean;
  socketError: string | null;
  viewMode: 'card' | 'table';
  inventory: any[];
}

interface Action {
  type: string;
  payload?: any;
  modal?: string;
  isOpen?: boolean;
  orderId?: string;
  status?: string;
  by?: 'date' | 'totalAmount';
  order?: 'asc' | 'desc';
}

// Initial state
const initialState: State = {
  orders: [],
  selectedOrder: null,
  isViewModalOpen: false,
  isConfirmDeliveryModalOpen: false,
  searchQuery: '',
  filterStatus: '',
  sortBy: 'date',
  sortOrder: 'desc',
  currentPage: 1,
  loading: true,
  error: '',
  submitting: null,
  socketConnected: false,
  socketError: null,
  viewMode: 'card',
  inventory: [],
};

// Reducer function
const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_ORDERS':
      return { ...state, orders: action.payload, error: '' };
    case 'SET_SELECTED_ORDER':
      return { ...state, selectedOrder: action.payload };
    case 'SET_MODAL':
      return { ...state, [`is${action.modal!.charAt(0).toUpperCase() + action.modal!.slice(1)}ModalOpen`]: action.isOpen };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload, currentPage: 1 };
    case 'SET_FILTER_STATUS':
      return { ...state, filterStatus: action.payload, currentPage: 1 };
    case 'SET_SORT':
      return { ...state, sortBy: action.by!, sortOrder: action.order!, currentPage: 1 };
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
    case 'ADD_ORDER':
      return { ...state, orders: [action.payload, ...state.orders.filter(o => o.id !== action.payload.id)] };
    case 'UPDATE_ORDER_STATUS':
      return {
        ...state,
        orders: state.orders.map(o => (o.id === action.orderId ? { ...o, ...action.payload, status: action.status as OrderStatus } : o)),
        selectedOrder: state.selectedOrder?.id === action.orderId ? { ...state.selectedOrder, ...action.payload, status: action.status as OrderStatus } : state.selectedOrder,
      };
    case 'UPDATE_ITEM_STATUS':
      return {
        ...state,
        orders: state.orders.map(order =>
          order.id === action.orderId
            ? {
                ...order,
                items: order.items.map(item =>
                  item.itemId === action.itemId ? { ...item, status: action.status as ItemStatus } : item
                ),
                status: order.items.every(i => i.status === ItemStatus.Completed) && order.status !== OrderStatus.Completed
                  ? OrderStatus.Completed
                  : order.status,
              }
            : order
        ),
        selectedOrder: state.selectedOrder?.id === action.orderId
          ? {
              ...state.selectedOrder,
              items: state.selectedOrder.items.map(item =>
                item.itemId === action.itemId ? { ...item, status: action.status as ItemStatus } : item
              ),
              status: state.selectedOrder.items.every(i => i.status === ItemStatus.Completed) && state.selectedOrder.status !== OrderStatus.Completed
                ? OrderStatus.Completed
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
                items: order.items.map(item =>
                  action.items!.some((task: any) => task._id === item.itemId)
                    ? { ...item, assignedTo: action.items!.find((task: any) => task._id === item.itemId)?.assignedTo, status: ItemStatus.Assigned }
                    : item
                ),
              }
            : order
        ),
      };
    case 'MISSING_ASSIGNMENTS':
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === action.orderId
            ? {
                ...o,
                items: o.items.map(i => (i.itemId === action.itemId ? { ...i, status: ItemStatus.Pending, assignedTo: undefined } : i)),
              }
            : o
        ),
      };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload, currentPage: 1 };
    case 'SET_INVENTORY':
      return { ...state, inventory: action.payload };
    case 'UPDATE_INVENTORY':
      return {
        ...state,
        inventory: state.inventory.map(item =>
          item.productId === action.payload.productId ? { ...item, currentStock: action.payload.quantity } : item
        ),
      };
    default:
      return state;
  }
};

// Constants
const ORDERS_PER_PAGE = { card: 12, table: 50 };

const statusOptions = [
  { value: '', label: 'all_statuses' },
  { value: OrderStatus.Pending, label: 'pending' },
  { value: OrderStatus.Approved, label: 'approved' },
  { value: OrderStatus.InProduction, label: 'in_production' },
  { value: OrderStatus.Completed, label: 'completed' },
  { value: OrderStatus.InTransit, label: 'in_transit' },
  { value: OrderStatus.Delivered, label: 'delivered' },
  { value: OrderStatus.Cancelled, label: 'cancelled' },
];

const sortOptions = [
  { value: 'date', label: 'sort_date' },
  { value: 'totalAmount', label: 'sort_total_amount' },
];

// Utility functions
const getDisplayName = (name: string | undefined | null, nameEn: string | undefined | null, isRtl: boolean): string => {
  if (isRtl) return name || 'غير معروف';
  return nameEn || name || 'Unknown';
};



// Main component
export const BranchOrders: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { socket, isConnected, emit } = useSocket();
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  const cacheRef = useRef<Map<string, Order[]>>(new Map());
  const playNotificationSound = useOrderNotifications(dispatch, stateRef, user);

  // Update stateRef when state changes
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Initialize WebSocket listeners
  useEffect(() => {
    if (!user?.branchId || user.role !== 'branch') {
      dispatch({ type: 'SET_ERROR', payload: isRtl ? 'لا يوجد فرع مرتبط' : 'No branch associated' });
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
      if (!order || !order._id || !order.branch || !order.branch._id) {
        console.warn('Invalid new order data:', order);
        return;
      }
      const mappedOrder: Order = {
        id: order._id,
        orderNumber: order.orderNumber || 'N/A',
        branchId: order.branch?._id || 'unknown',
        branch: {
          _id: order.branch?._id || 'unknown',
          name: order.branch?.name || (isRtl ? 'غير معروف' : 'Unknown'),
          nameEn: order.branch?.nameEn,
          displayName: getDisplayName(order.branch?.name, order.branch?.nameEn, isRtl),
        },
        items: Array.isArray(order.items)
          ? order.items
              .filter((item: any) => item && item.product && item.product._id)
              .map((item: any) => ({
                itemId: item._id || `temp-${Math.random().toString(36).substring(2)}`,
                productId: item.product._id,
                productName: getDisplayName(item.product?.name, item.product?.nameEn, isRtl),
                quantity: Number(item.quantity) || 0,
                price: Number(item.price) || 0,
                department: {
                  _id: item.product?.department?._id || 'unknown',
                  name: getDisplayName(item.product?.department?.name, item.product?.department?.nameEn, isRtl),
                },
                status: item.status || ItemStatus.Pending,
                unit: getDisplayName(item.product?.unit, item.product?.unitEn, isRtl),
                assignedTo: item.assignedTo ? { _id: item.assignedTo._id, username: item.assignedTo.username } : undefined,
              }))
          : [],
        status: order.status || OrderStatus.Pending,
        totalAmount: Number(order.totalAmount) || 0,
        date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
        notes: order.notes || '',
        priority: order.priority || 'medium',
        createdBy: order.createdBy?.username || (isRtl ? 'غير معروف' : 'Unknown'),
        statusHistory: Array.isArray(order.statusHistory)
          ? order.statusHistory.map((history: any) => ({
              status: history.status || OrderStatus.Pending,
              changedBy: history.changedBy || 'unknown',
              changedAt: formatDate(history.changedAt ? new Date(history.changedAt) : new Date(), language),
              notes: history.notes || '',
            }))
          : [],
      };
      dispatch({ type: 'ADD_ORDER', payload: mappedOrder });
      playNotificationSound('/sounds/new-order.mp3', [200, 100, 200]);
      toast.success(
        isRtl ? `تم استلام طلب جديد: ${order.orderNumber}` : `New order received: ${order.orderNumber}`,
        { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 }
      );
    });

    socket.on('orderStatusUpdated', async ({ orderId, status }: { orderId: string; status: OrderStatus }) => {
      if (!orderId || !status) {
        console.warn('Invalid order status update data:', { orderId, status });
        return;
      }
      try {
        const updatedOrder = await ordersAPI.getById(orderId);
        if (updatedOrder && updatedOrder._id && updatedOrder.branch && updatedOrder.branch._id) {
          const mappedOrder: Order = {
            id: updatedOrder._id,
            orderNumber: updatedOrder.orderNumber || 'N/A',
            branchId: updatedOrder.branch?._id || 'unknown',
            branch: {
              _id: updatedOrder.branch?._id || 'unknown',
              name: updatedOrder.branch?.name || (isRtl ? 'غير معروف' : 'Unknown'),
              nameEn: updatedOrder.branch?.nameEn,
              displayName: getDisplayName(updatedOrder.branch?.name, updatedOrder.branch?.nameEn, isRtl),
            },
            items: Array.isArray(updatedOrder.items)
              ? updatedOrder.items
                  .filter((item: any) => item && item.product && item.product._id)
                  .map((item: any) => ({
                    itemId: item._id || `temp-${Math.random().toString(36).substring(2)}`,
                    productId: item.product._id,
                    productName: getDisplayName(item.product?.name, item.product?.nameEn, isRtl),
                    quantity: Number(item.quantity) || 0,
                    price: Number(item.price) || 0,
                    department: {
                      _id: item.product?.department?._id || 'unknown',
                      name: getDisplayName(item.product?.department?.name, item.product?.department?.nameEn, isRtl),
                    },
                    status: item.status || ItemStatus.Pending,
                    unit: getDisplayName(item.product?.unit, item.product?.unitEn, isRtl),
                    assignedTo: item.assignedTo ? { _id: item.assignedTo._id, username: item.assignedTo.username } : undefined,
                  }))
              : [],
            status: updatedOrder.status || status,
            totalAmount: Number(updatedOrder.totalAmount) || 0,
            date: formatDate(updatedOrder.createdAt ? new Date(updatedOrder.createdAt) : new Date(), language),
            notes: updatedOrder.notes || '',
            priority: updatedOrder.priority || 'medium',
            createdBy: updatedOrder.createdBy?.username || (isRtl ? 'غير معروف' : 'Unknown'),
            statusHistory: Array.isArray(updatedOrder.statusHistory)
              ? updatedOrder.statusHistory.map((history: any) => ({
                  status: history.status || OrderStatus.Pending,
                  changedBy: history.changedBy || 'unknown',
                  changedAt: formatDate(history.changedAt ? new Date(history.changedAt) : new Date(), language),
                  notes: history.notes || '',
                }))
              : [],
          };
          dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status, payload: mappedOrder });
        } else {
          console.warn('Invalid updated order data:', updatedOrder);
          dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status });
        }
        toast.info(
          isRtl ? `تم تحديث حالة الطلب إلى: ${t(`orders.status_${status}`)}` : `Order status updated to: ${t(`orders.status_${status}`)}`,
          { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 }
        );
      } catch (err) {
        console.error('Failed to fetch updated order:', err);
        dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status });
      }
    });

    socket.on('taskAssigned', ({ orderId, items }: { orderId: string; items: { _id: string; assignedTo: { _id: string; username: string } }[] }) => {
      dispatch({ type: 'TASK_ASSIGNED', orderId, items });
      toast.info(isRtl ? 'تم تعيين المهام' : 'Tasks assigned', { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
    });

    socket.on('missingAssignments', ({ orderId, itemId, productName }: { orderId: string; itemId: string; productName: string }) => {
      dispatch({ type: 'MISSING_ASSIGNMENTS', orderId, itemId });
      toast.warn(
        isRtl ? `المنتج ${getDisplayName(productName, productName, isRtl)} بحاجة إلى تعيين` : `Product ${getDisplayName(productName, productName, isRtl)} needs assignment`,
        { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 }
      );
    });

    socket.on('inventoryUpdated', ({ branchId, productId, quantity, type }) => {
      if (branchId === user?.branchId) {
        dispatch({ type: 'UPDATE_INVENTORY', payload: { productId, quantity, type } });
        toast.info(
          isRtl ? `تم تحديث المخزون للمنتج ${productId} بكمية ${quantity}` : `Inventory updated for product ${productId} with quantity ${quantity}`,
          { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 }
        );
      }
    });

    socket.on('restockApproved', ({ requestId, branchId, productId, quantity }) => {
      if (branchId === user?.branchId) {
        dispatch({ type: 'UPDATE_INVENTORY', payload: { productId, quantity, type: 'restock' } });
        toast.success(
          isRtl ? `تمت الموافقة على طلب إعادة التخزين ${requestId}` : `Restock request ${requestId} approved`,
          { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 }
        );
      }
    });

    return () => {
      socket.off('connect');
      socket.off('connect_error');
      socket.off('newOrder');
      socket.off('orderStatusUpdated');
      socket.off('taskAssigned');
      socket.off('missingAssignments');
      socket.off('inventoryUpdated');
      socket.off('restockApproved');
    };
  }, [user, t, isRtl, language, socket, emit, playNotificationSound]);

  // Fetch orders with caching
  const fetchData = useCallback(
    async (retryCount = 0) => {
      if (!user?.branchId || user.role !== 'branch') {
        const errorMessage = isRtl ? 'لا يوجد فرع مرتبط' : 'No branch associated';
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      dispatch({ type: 'SET_LOADING', payload: true });
      const cacheKey = `${user.branchId}-${state.filterStatus}-${state.currentPage}-${state.viewMode}`;
      if (cacheRef.current.has(cacheKey)) {
        dispatch({ type: 'SET_ORDERS', payload: cacheRef.current.get(cacheKey)! });
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      try {
        const response = await ordersAPI.getAll({
          branch: user.branchId,
          status: state.filterStatus || undefined,
          page: state.currentPage,
          limit: ORDERS_PER_PAGE[state.viewMode],
          search: state.searchQuery || undefined,
          sortBy: state.sortBy,
          sortOrder: state.sortOrder,
        });
        if (!Array.isArray(response)) throw new Error('Invalid response format');
        const mappedOrders: Order[] = response
          .filter((order: any) => order && order._id && order.branch && order.branch._id)
          .map((order: any) => ({
            id: order._id,
            orderNumber: order.orderNumber || 'N/A',
            branchId: order.branch?._id || 'unknown',
            branch: {
              _id: order.branch?._id || 'unknown',
              name: order.branch?.name || (isRtl ? 'غير معروف' : 'Unknown'),
              nameEn: order.branch?.nameEn,
              displayName: getDisplayName(order.branch?.name, order.branch?.nameEn, isRtl),
            },
            items: Array.isArray(order.items)
              ? order.items
                  .filter((item: any) => item && item.product && item.product._id)
                  .map((item: any) => ({
                    itemId: item._id || `temp-${Math.random().toString(36).substring(2)}`,
                    productId: item.product._id,
                    productName: getDisplayName(item.product?.name, item.product?.nameEn, isRtl),
                    quantity: Number(item.quantity) || 0,
                    price: Number(item.price) || 0,
                    department: {
                      _id: item.product?.department?._id || 'unknown',
                      name: getDisplayName(item.product?.department?.name, item.product?.department?.nameEn, isRtl),
                    },
                    status: item.status || ItemStatus.Pending,
                    unit: getDisplayName(item.product?.unit, item.product?.unitEn, isRtl),
                    assignedTo: item.assignedTo ? { _id: item.assignedTo._id, username: item.assignedTo.username } : undefined,
                  }))
              : [],
            status: order.status || OrderStatus.Pending,
            totalAmount: Number(order.totalAmount) || 0,
            date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
            notes: order.notes || '',
            priority: order.priority || 'medium',
            createdBy: order.createdBy?.username || (isRtl ? 'غير معروف' : 'Unknown'),
            statusHistory: Array.isArray(order.statusHistory)
              ? order.statusHistory.map((history: any) => ({
                  status: history.status || OrderStatus.Pending,
                  changedBy: history.changedBy || 'unknown',
                  changedAt: formatDate(history.changedAt ? new Date(history.changedAt) : new Date(), language),
                  notes: history.notes || '',
                }))
              : [],
          }));
        cacheRef.current.set(cacheKey, mappedOrders);
        dispatch({ type: 'SET_ORDERS', payload: mappedOrders });
        dispatch({ type: 'SET_ERROR', payload: '' });
      } catch (err: any) {
        console.error('Fetch orders error:', err.message, err.response?.data);
        if (retryCount < 2) {
          console.log(`Retrying fetchData (attempt ${retryCount + 1})`);
          setTimeout(() => fetchData(retryCount + 1), 1000);
          return;
        }
        const errorMessage = err.response?.status === 404 ? (isRtl ? 'لم يتم العثور على طلبات' : 'No orders found') : (isRtl ? `خطأ في جلب الطلبات: ${err.message}` : `Error fetching orders: ${err.message}`);
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [user, state.filterStatus, state.currentPage, state.viewMode, state.searchQuery, state.sortBy, state.sortOrder, isRtl, t, language]
  );

  // Calculate total quantity for an order
  const calculateTotalQuantity = useCallback((order: Order) => {
    return order.items.reduce((sum, item) => sum + item.quantity, 0);
  }, []);

  // Search handling
  const handleSearchChange = useCallback(
    debounce((value: string) => {
      dispatch({ type: 'SET_SEARCH_QUERY', payload: value });
    }, 300),
    []
  );

  // Filtered, sorted, and paginated orders
  const filteredOrders = useMemo(
    () =>
      state.orders.filter(
        order =>
          order.branch &&
          order.branch._id &&
          (order.orderNumber.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
            order.branch.displayName.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
            (order.notes || '').toLowerCase().includes(state.searchQuery.toLowerCase()) ||
            order.items.some(item => item.productName.toLowerCase().includes(state.searchQuery.toLowerCase()))) &&
          (!state.filterStatus || order.status === state.filterStatus)
      ),
    [state.orders, state.searchQuery, state.filterStatus]
  );

  const sortedOrders = useMemo(
    () =>
      [...filteredOrders].sort((a, b) => {
        if (state.sortBy === 'date') {
          return state.sortOrder === 'asc'
            ? new Date(a.date).getTime() - new Date(b.date).getTime()
            : new Date(b.date).getTime() - new Date(a.date).getTime();
        }
        return state.sortOrder === 'asc' ? a.totalAmount - b.totalAmount : b.totalAmount - a.totalAmount;
      }),
    [filteredOrders, state.sortBy, state.sortOrder]
  );

  const paginatedOrders = useMemo(
    () => sortedOrders.slice((state.currentPage - 1) * ORDERS_PER_PAGE[state.viewMode], state.currentPage * ORDERS_PER_PAGE[state.viewMode]),
    [sortedOrders, state.currentPage, state.viewMode]
  );

  // Order actions
  const viewOrder = useCallback((order: Order) => {
    dispatch({ type: 'SET_SELECTED_ORDER', payload: order });
    dispatch({ type: 'SET_MODAL', modal: 'view', isOpen: true });
  }, []);

  const openConfirmDeliveryModal = useCallback((order: Order) => {
    dispatch({ type: 'SET_SELECTED_ORDER', payload: order });
    dispatch({ type: 'SET_MODAL', modal: 'confirmDelivery', isOpen: true });
  }, []);

  const confirmDelivery = useCallback(
    async (orderId: string) => {
      if (!user?.branchId || !user?.id) {
        console.log('Confirm delivery - Missing user or branch:', { user });
        toast.error(isRtl ? 'لا يوجد فرع أو مستخدم مرتبط' : 'No branch or user associated', { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        const order = await ordersAPI.getById(orderId);
        if (!order || !Array.isArray(order.items)) {
          throw new Error(isRtl ? 'بيانات الطلب غير صالحة' : 'Invalid order data');
        }

        // Validate product IDs
        const invalidItems = order.items.filter(item => !item.product?._id);
        if (invalidItems.length > 0) {
          throw new Error(isRtl ? 'بعض العناصر تحتوي على معرفات منتجات غير صالحة' : 'Some items have invalid product IDs');
        }

        // Confirm delivery
        await ordersAPI.confirmDelivery(orderId, user.id);

        // Update inventory using bulkCreate
        const inventoryItems = order.items.map(item => ({
          productId: item.product._id,
          currentStock: item.quantity,
          minStockLevel: 0,
          maxStockLevel: 1000,
        }));

        try {
          await inventoryAPI.bulkCreate({
            branchId: user.branchId,
            userId: user.id,
            orderId,
            items: inventoryItems,
          });
        } catch (bulkError: any) {
          console.warn(`Bulk create failed: ${bulkError.message}. Falling back to individual updates.`);
          for (const item of order.items) {
            try {
              let inventoryItem;
              try {
                const inventory = await inventoryAPI.getByBranch(user.branchId);
                inventoryItem = inventory.find((inv: any) => inv.productId === item.product._id);
              } catch (getError: any) {
                if (getError.status === 403) {
                  console.warn(`Permission denied for getting inventory for branch ${user.branchId}. Proceeding to create new inventory entry.`);
                  inventoryItem = null;
                } else {
                  throw getError;
                }
              }

              if (inventoryItem) {
                try {
                  await inventoryAPI.updateStock(inventoryItem._id, {
                    currentStock: (inventoryItem.currentStock || 0) + item.quantity,
                  });
                } catch (updateError: any) {
                  if (updateError.status === 403) {
                    console.warn(`Permission denied for updating inventory item ${inventoryItem._id}. Creating new inventory entry.`);
                    await inventoryAPI.create({
                      branchId: user.branchId,
                      productId: item.product._id,
                      currentStock: item.quantity,
                      minStockLevel: 0,
                      maxStockLevel: 1000,
                      userId: user.id,
                      orderId,
                    });
                  } else {
                    throw updateError;
                  }
                }
              } else {
                await inventoryAPI.create({
                  branchId: user.branchId,
                  productId: item.product._id,
                  currentStock: item.quantity,
                  minStockLevel: 0,
                  maxStockLevel: 1000,
                  userId: user.id,
                  orderId,
                });
              }
            } catch (itemError: any) {
              console.warn(`Failed to update inventory for product ${item.product._id}:`, itemError.message);
              toast.warn(
                isRtl ? `فشل تحديث المخزون للمنتج ${getDisplayName(item.productName, item.productName, isRtl)}: ${itemError.message}` : `Failed to update inventory for product ${getDisplayName(item.productName, item.productName, isRtl)}: ${itemError.message}`,
                { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 }
              );
              continue;
            }
          }
        }

        dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status: OrderStatus.Delivered });
        if (socket && isConnected) {
          emit('orderStatusUpdated', { orderId, status: OrderStatus.Delivered });
        }
        dispatch({ type: 'SET_MODAL', modal: 'confirmDelivery', isOpen: false });
        playNotificationSound('/sounds/order-delivered.mp3', [400, 100, 400]);
        toast.success(isRtl ? 'تم تأكيد التسليم' : 'Delivery confirmed successfully', { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
      } catch (err: any) {
        console.error('Confirm delivery error:', err.message, err.response?.data);
        toast.error(isRtl ? `فشل في تأكيد التسليم: ${err.message}` : `Failed to confirm delivery: ${err.message}`, { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [t, isRtl, playNotificationSound, user, socket, isConnected, emit]
  );

  // Update order status
  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      if (!user?.branchId) {
        toast.error(isRtl ? 'لا يوجد فرع مرتبط' : 'No branch associated', { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        await ordersAPI.updateStatus(orderId, { status });
        dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status });
        if (socket && isConnected) {
          emit('orderStatusUpdated', { orderId, status });
        }
        toast.success(
          isRtl ? `تم تحديث حالة الطلب إلى: ${t(`orders.status_${status}`)}` : `Order status updated to: ${t(`orders.status_${status}`)}`,
          { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 }
        );
      } catch (err: any) {
        console.error('Update order status error:', err.message, err.response?.data);
        toast.error(isRtl ? `فشل في تحديث الحالة: ${err.message}` : `Failed to update status: ${err.message}`, { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [t, isRtl, user, socket, isConnected, emit]
  );

  // Clear cache on user or branch change
  useEffect(() => {
    cacheRef.current.clear();
    fetchData();
  }, [user?.branchId, fetchData]);

  // Render
  return (
    <div className="px-4 py-6 min-h-screen" dir={isRtl ? 'rtl' : 'ltr'}>
      <Suspense fallback={<LoadingSpinner size="lg" />}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-8">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-3">
                <ShoppingCart className="w-8 h-8 text-amber-600" />
                {isRtl ? 'الطلبات' : 'Orders'}
              </h1>
              <p className="text-sm text-gray-500 mt-1">{isRtl ? 'إدارة طلبات الفرع' : 'Manage branch orders'}</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Button
                variant={state.orders.length > 0 ? 'primary' : 'secondary'}
                onClick={state.orders.length > 0 ? () => exportToPDF(state.orders, t, isRtl, language, calculateTotalQuantity) : undefined}
                className={`flex items-center gap-2 ${
                  state.orders.length > 0 ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                } rounded-lg px-4 py-2 text-sm shadow-sm`}
                disabled={state.orders.length === 0}
              >
                <Upload className="w-5 h-5" />
                {isRtl ? 'تصدير إلى PDF' : 'Export to PDF'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: state.viewMode === 'card' ? 'table' : 'card' })}
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg px-4 py-2 text-sm shadow-sm"
              >
                {state.viewMode === 'card' ? <Table2 className="w-5 h-5" /> : <Grid className="w-5 h-5" />}
                {isRtl ? (state.viewMode === 'card' ? 'عرض كجدول' : 'عرض كبطاقات') : state.viewMode === 'card' ? 'View as Table' : 'View as Cards'}
              </Button>
            </div>
          </div>
          <Card className="p-4 sm:p-6 mt-6 bg-white shadow-lg rounded-lg border border-gray-100">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'بحث' : 'Search'}</label>
                <ProductSearchInput
                  value={state.searchQuery}
                  onChange={handleSearchChange}
                  placeholder={isRtl ? 'ابحث حسب رقم الطلب أو المنتج...' : 'Search by order number or product...'}
                  className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'تصفية حسب الحالة' : 'Filter by Status'}</label>
                  <ProductDropdown
                    options={statusOptions.map(opt => ({
                      value: opt.value,
                      label: opt.value ? t(`orders.status_${opt.value}`) : t('orders.all_statuses'),
                    }))}
                    value={state.filterStatus || ''}
                    onChange={(value: string) => dispatch({ type: 'SET_FILTER_STATUS', payload: value })}
                    className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'ترتيب حسب' : 'Sort By'}</label>
                  <ProductDropdown
                    options={sortOptions.map(opt => ({
                      value: opt.value,
                      label: t(`orders.${opt.label}`) || opt.label,
                    }))}
                    value={state.sortBy}
                    onChange={(value: string) => dispatch({ type: 'SET_SORT', by: value as any, order: state.sortOrder })}
                    className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
                  />
                </div>
              </div>
            </div>
            <div className="text-sm text-center text-gray-500 mt-4">
              {isRtl ? `عدد الطلبات: ${filteredOrders.length}` : `Orders count: ${filteredOrders.length}`}
            </div>
          </Card>
          {state.loading ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-4 mt-6">
              {state.viewMode === 'card' ? (
                Array(6).fill(null).map((_, i) => <OrderCardSkeleton key={i} isRtl={isRtl} />)
              ) : (
                <OrderTableSkeleton isRtl={isRtl} />
              )}
            </motion.div>
          ) : state.error && state.orders.length === 0 ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="mt-6">
              <Card className="p-6 max-w-md mx-auto text-center bg-red-50 shadow-lg rounded-lg border border-red-100">
                <div className={`flex items-center justify-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <AlertCircle className="w-6 h-6 text-red-600" />
                  <p className="text-lg font-medium text-red-600">{state.error}</p>
                </div>
                <Button
                  variant="primary"
                  onClick={() => fetchData()}
                  className="mt-4 bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-6 py-2 text-sm shadow-sm"
                >
                  {isRtl ? 'إعادة المحاولة' : 'Retry'}
                </Button>
              </Card>
            </motion.div>
          ) : (
            <AnimatePresence>
              {paginatedOrders.length === 0 ? (
                <motion.div key="no-orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="mt-6">
                  <Card className="p-8 sm:p-12 text-center bg-white shadow-lg rounded-lg border border-gray-100">
                    <ShoppingCart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-800 mb-2">{isRtl ? 'لا توجد طلبات' : 'No Orders'}</h3>
                    <p className="text-sm text-gray-500">
                      {state.filterStatus || state.searchQuery
                        ? isRtl
                          ? 'لا توجد طلبات مطابقة'
                          : 'No matching orders'
                        : isRtl
                        ? 'لا توجد طلبات بعد'
                        : 'No orders yet'}
                    </p>
                  </Card>
                </motion.div>
              ) : state.viewMode === 'table' ? (
                <motion.div key="table-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="mt-6">
                  <OrderTable
                    orders={paginatedOrders.filter(o => o && o.id && o.branch && o.branch._id)}
                    t={t}
                    isRtl={isRtl}
                    calculateTotalQuantity={calculateTotalQuantity}
                    startIndex={(state.currentPage - 1) * ORDERS_PER_PAGE[state.viewMode] + 1}
                    viewOrder={viewOrder}
                    openConfirmDeliveryModal={openConfirmDeliveryModal}
                    user={user}
                    submitting={state.submitting}
                  />
                </motion.div>
              ) : (
                <motion.div key="card-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="space-y-4 mt-6">
                  {paginatedOrders.filter(o => o && o.id && o.branch && o.branch._id).map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      t={t}
                      isRtl={isRtl}
                      calculateTotalQuantity={calculateTotalQuantity}
                      viewOrder={viewOrder}
                      openConfirmDeliveryModal={openConfirmDeliveryModal}
                      user={user}
                      submitting={state.submitting}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          )}
          {paginatedOrders.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="mt-6">
              <Pagination
                currentPage={state.currentPage}
                totalPages={Math.ceil(sortedOrders.length / ORDERS_PER_PAGE[state.viewMode])}
                t={t}
                isRtl={isRtl}
                handlePageChange={page => dispatch({ type: 'SET_PAGE', payload: page })}
              />
            </motion.div>
          )}
          <ViewModal
            isOpen={state.isViewModalOpen}
            onClose={() => {
              dispatch({ type: 'SET_MODAL', modal: 'view', isOpen: false });
              dispatch({ type: 'SET_SELECTED_ORDER', payload: null });
            }}
            order={state.selectedOrder}
            t={t}
            isRtl={isRtl}
          />
          <ConfirmDeliveryModal
            isOpen={state.isConfirmDeliveryModalOpen}
            onClose={() => {
              dispatch({ type: 'SET_MODAL', modal: 'confirmDelivery', isOpen: false });
              dispatch({ type: 'SET_SELECTED_ORDER', payload: null });
            }}
            order={state.selectedOrder}
            t={t}
            isRtl={isRtl}
            confirmDelivery={confirmDelivery}
            submitting={state.submitting}
          />
        </motion.div>
      </Suspense>
    </div>
  );
};

export default BranchOrders;