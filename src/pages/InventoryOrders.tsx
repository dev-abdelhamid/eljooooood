import React, { useReducer, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
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
import { factoryOrdersAPI, factoryInventoryAPI, chefsAPI, productsAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { useOrderNotifications } from '../hooks/useOrderNotifications';
import { FactoryOrder, Chef, AssignChefsForm, OrderStatus, Product } from '../types/types';
import Pagination from '../components/Shared/Pagination';
import AssignChefsModal from '../components/production/AssignChefsModal';
import OrderTable from '../components/production/OrderTable';
import OrderCard from '../components/production/OrderCard';
import OrderCardSkeleton from '../components/Shared/OrderCardSkeleton';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';
import { ProductSearchInput, ProductDropdown } from './OrdersTablePage';

interface InventoryItem {
  _id: string;
  productId: string;
  productName: string;
  currentStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  unit: string;
}

interface State {
  orders: FactoryOrder[];
  inventory: InventoryItem[];
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
  inventory: [],
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
  error: '',
  submitting: null,
  socketConnected: false,
  socketError: null,
  viewMode: 'card',
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_ORDERS':
      return { ...state, orders: action.payload || [], error: '', currentPage: 1 };
    case 'SET_INVENTORY':
      return { ...state, inventory: action.payload || [] };
    case 'ADD_ORDER':
      return { ...state, orders: [action.payload, ...state.orders.filter((o) => o.id !== action.payload.id)] };
    case 'SET_SELECTED_ORDER':
      return { ...state, selectedOrder: action.payload };
    case 'SET_CHEFS':
      return { ...state, chefs: action.payload || [] };
    case 'SET_PRODUCTS':
      return { ...state, products: action.payload || [] };
    case 'SET_ASSIGN_MODAL':
      return { ...state, isAssignModalOpen: action.isOpen ?? false };
    case 'SET_CREATE_MODAL':
      return { ...state, isCreateModalOpen: action.isOpen ?? false };
    case 'SET_ASSIGN_FORM':
      return { ...state, assignFormData: action.payload || { items: [] } };
    case 'SET_CREATE_FORM':
      return { ...state, createFormData: action.payload || { productId: '', quantity: '', notes: '' } };
    case 'SET_FILTER_STATUS':
      return { ...state, filterStatus: action.payload || '', currentPage: 1 };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload || '', currentPage: 1 };
    case 'SET_SORT':
      return { ...state, sortBy: action.by ?? 'date', sortOrder: action.order ?? 'desc', currentPage: 1 };
    case 'SET_PAGE':
      return { ...state, currentPage: action.payload || 1 };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload || '' };
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
                status:
                  order.items.every((i) => i.status === 'completed') && order.status !== 'completed'
                    ? 'completed'
                    : order.status,
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
                              displayName: isRtl
                                ? assignment.assignedTo.name
                                : assignment.assignedTo.nameEn || assignment.assignedTo.name,
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
                              displayName: isRtl
                                ? assignment.assignedTo.name
                                : assignment.assignedTo.nameEn || assignment.assignedTo.name,
                            }
                          : undefined,
                        status: assignment.status || i.status,
                      }
                    : i;
                }),
                status: state.selectedOrder.items.every((i) => i.status === 'assigned')
                  ? 'in_production'
                  : state.selectedOrder.status,
              }
            : state.selectedOrder,
      };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload || 'card', currentPage: 1 };
    default:
      return state;
  }
};

const ORDERS_PER_PAGE = { card: 12, table: 50 };
const validTransitions: Record<OrderStatus, OrderStatus[]> = {
  pending: ['approved', 'cancelled'],
  approved: ['in_production', 'cancelled'],
  in_production: ['completed', 'cancelled'],
  completed: [],
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

const translateUnit = (unit: string = 'unit', isRtl: boolean): string => {
  const translations: Record<string, { ar: string; en: string }> = {
    كيلو: { ar: 'كيلو', en: 'kg' },
    قطعة: { ar: 'قطعة', en: 'piece' },
    علبة: { ar: 'علبة', en: 'pack' },
    صينية: { ar: 'صينية', en: 'tray' },
    kg: { ar: 'كجم', en: 'kg' },
    piece: { ar: 'قطعة', en: 'piece' },
    pack: { ar: 'علبة', en: 'pack' },
    tray: { ar: 'صينية', en: 'tray' },
  };
  return translations[unit] ? (isRtl ? translations[unit].ar : translations[unit].en) : isRtl ? 'وحدة' : 'unit';
};

const normalizeText = (text: string = ''): string => {
  return text
    .normalize('NFD')
    .replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, '')
    .replace(/أ|إ|آ|ٱ/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .trim();
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

  const calculateTotalQuantity = useCallback((order: FactoryOrder): number => {
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
    });

    socket.on('connect_error', (err: Error) => {
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
              displayProductName: isRtl ? item.product?.name : item.product?.nameEn || item.product?.name || 'Unknown',
              quantity: Number(item.quantity) || 1,
              unit: item.product?.unit || 'unit',
              unitEn: item.product?.unitEn,
              displayUnit: translateUnit(item.product?.unit || 'unit', isRtl),
              department: {
                _id: item.product?.department?._id || 'unknown',
                name: item.product?.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                nameEn: item.product?.department?.nameEn,
                displayName: isRtl
                  ? item.product?.department?.name
                  : item.product?.department?.nameEn || item.product?.department?.name || 'Unknown',
              },
              assignedTo: item.assignedTo
                ? {
                    _id: item.assignedTo._id,
                    username: item.assignedTo.username,
                    name: item.assignedTo.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: item.assignedTo.nameEn,
                    displayName: isRtl
                      ? item.assignedTo.name
                      : item.assignedTo.nameEn || item.assignedTo.name || 'Unknown',
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
      socket.off('newFactoryOrder');
      socket.off('orderStatusUpdated');
      socket.off('itemStatusUpdated');
      socket.off('taskAssigned');
    };
  }, [user, socket, isConnected, isRtl, language, playNotificationSound]);

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
          lang: language,
        };
        if (user.role === 'production' && user.department) query.department = user.department._id;
        const [ordersResponse, inventoryResponse, chefsResponse, productsResponse] = await Promise.all([
          factoryOrdersAPI.getAll(query),
          factoryInventoryAPI.getAll({ lang: language }),
          chefsAPI.getAll(),
          productsAPI.getAll(),
        ]);

        const mappedOrders: FactoryOrder[] = (ordersResponse || [])
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
                  displayProductName: isRtl ? item.product?.name : item.product?.nameEn || item.product?.name || 'Unknown',
                  quantity: Number(item.quantity) || 1,
                  unit: item.product?.unit || 'unit',
                  unitEn: item.product?.unitEn,
                  displayUnit: translateUnit(item.product?.unit || 'unit', isRtl),
                  department: {
                    _id: item.product?.department?._id || 'unknown',
                    name: item.product?.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: item.product?.department?.nameEn,
                    displayName: isRtl
                      ? item.product?.department?.name
                      : item.product?.department?.nameEn || item.product?.department?.name || 'Unknown',
                  },
                  assignedTo: item.assignedTo
                    ? {
                        _id: item.assignedTo._id,
                        username: item.assignedTo.username,
                        name: item.assignedTo.name || (isRtl ? 'غير معروف' : 'Unknown'),
                        nameEn: item.assignedTo.nameEn,
                        displayName: isRtl
                          ? item.assignedTo.name
                          : item.assignedTo.nameEn || item.assignedTo.name || 'Unknown',
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
        const mappedInventory: InventoryItem[] = (inventoryResponse || [])
          .filter((item: any) => item && item._id && item.productId)
          .map((item: any) => ({
            _id: item._id,
            productId: item.productId,
            productName: item.product?.name || (isRtl ? 'غير معروف' : 'Unknown'),
            currentStock: Number(item.currentStock) || 0,
            minStockLevel: Number(item.minStockLevel) || 0,
            maxStockLevel: Number(item.maxStockLevel) || 1000,
            unit: item.product?.unit || 'unit',
          }));
        dispatch({ type: 'SET_ORDERS', payload: mappedOrders });
        dispatch({ type: 'SET_INVENTORY', payload: mappedInventory });
        dispatch({
          type: 'SET_CHEFS',
          payload: (chefsResponse || [])
            .filter((chef: any) => chef && chef.user?._id)
            .map((chef: any) => ({
              _id: chef._id,
              userId: chef.user._id,
              name: chef.user?.name || chef.name || (isRtl ? 'غير معروف' : 'Unknown'),
              nameEn: chef.user?.nameEn || chef.nameEn,
              displayName: isRtl
                ? chef.user?.name || chef.name
                : chef.user?.nameEn || chef.nameEn || chef.user?.name || chef.name || 'Unknown',
              department: chef.department
                ? {
                    _id: chef.department._id,
                    name: chef.department.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: chef.department.nameEn,
                    displayName: isRtl
                      ? chef.department.name
                      : chef.department.nameEn || chef.department.name || 'Unknown',
                  }
                : null,
              status: chef.status || 'active',
            })),
        });
        dispatch({
          type: 'SET_PRODUCTS',
          payload: (productsResponse.data || [])
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
                displayName: isRtl
                  ? product.department?.name
                  : product.department?.nameEn || product.department?.name || 'Unknown',
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
        const errorMessage =
          err.response?.status === 404
            ? isRtl
              ? 'لم يتم العثور على طلبات'
              : 'No orders found'
            : isRtl
            ? `خطأ في جلب الطلبات: ${err.message}`
            : `Error fetching orders: ${err.message}`;
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
    return (state.orders || [])
      .filter((order) => order && order.orderNumber)
      .filter(
        (order) =>
          normalizeText(order.orderNumber).includes(normalizedQuery) ||
          normalizeText(order.notes).includes(normalizedQuery) ||
          normalizeText(order.createdBy).includes(normalizedQuery) ||
          order.items.some((item) => normalizeText(item.displayProductName).includes(normalizedQuery))
      )
      .filter(
        (order) =>
          (!state.filterStatus || order.status === state.filterStatus) &&
          (user?.role === 'production' && user?.department
            ? order.items.some((item) => item.department._id === user.department._id)
            : true)
      );
  }, [state.orders, state.searchQuery, state.filterStatus, user]);

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
    () =>
      sortedOrders.slice(
        (state.currentPage - 1) * ORDERS_PER_PAGE[state.viewMode],
        state.currentPage * ORDERS_PER_PAGE[state.viewMode]
      ),
    [sortedOrders, state.currentPage, state.viewMode]
  );

  const totalPages = useMemo(
    () => Math.ceil(sortedOrders.length / ORDERS_PER_PAGE[state.viewMode]),
    [sortedOrders, state.viewMode]
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, newStatus: OrderStatus) => {
      const order = state.orders.find((o) => o.id === orderId);
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
        toast.success(isRtl ? `تم تحديث الحالة إلى: ${newStatus}` : `Order status updated to: ${newStatus}`, {
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
    [state.orders, isRtl, socket, isConnected, emit]
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
        toast.success(isRtl ? `تم تحديث حالة العنصر إلى: ${status}` : `Item status updated to: ${status}`, {
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
    [isRtl, user, socket, isConnected, emit]
  );

  const assignChefs = useCallback(
    async (orderId: string) => {
      if (!user?.id || state.assignFormData.items.some((item) => !item.assignedTo)) {
        toast.error(isRtl ? 'يرجى تعيين شيف واحد على الأقل' : 'Please assign at least one chef', {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        await factoryOrdersAPI.assignChefs(orderId, { items: state.assignFormData.items });
        const items = state.assignFormData.items.map((item) => ({
          _id: item.itemId,
          assignedTo:
            state.chefs.find((chef) => chef.userId === item.assignedTo) || {
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
      if (!user?.id || !state.createFormData.productId || !state.createFormData.quantity) {
        toast.error(isRtl ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields', {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: 'create' });
      try {
        const orderNumber = `ORD-${Date.now()}`;
        const response = await factoryOrdersAPI.create({
          orderNumber,
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
        toast.error(isRtl ? `فشل في إنشاء الطلب...: ${err.message}` : `Failed to create order: ${err.message}`, {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [user, state.createFormData, socket, isConnected, emit, isRtl, language]
  );

  const openAssignModal = useCallback((order: FactoryOrder) => {
    dispatch({
      type: 'SET_SELECTED_ORDER',
      payload: order,
    });
    dispatch({
      type: 'SET_ASSIGN_FORM',
      payload: {
        items: order.items.map((item) => ({
          itemId: item._id,
          product: item.displayProductName,
          quantity: item.quantity,
          unit: item.displayUnit,
          assignedTo: item.assignedTo?._id || '',
        })),
      },
    });
    dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: true });
  }, []);

  const closeAssignModal = useCallback(() => {
    dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: false });
    dispatch({ type: 'SET_SELECTED_ORDER', payload: null });
    dispatch({ type: 'SET_ASSIGN_FORM', payload: { items: [] } });
  }, []);

  const openCreateModal = useCallback(() => {
    dispatch({ type: 'SET_CREATE_MODAL', isOpen: true });
  }, []);

  const closeCreateModal = useCallback(() => {
    dispatch({ type: 'SET_CREATE_MODAL', isOpen: false });
    dispatch({ type: 'SET_CREATE_FORM', payload: { productId: '', quantity: '', notes: '' } });
  }, []);

  const handleCreateFormChange = useCallback((field: keyof State['createFormData'], value: string) => {
    dispatch({
      type: 'SET_CREATE_FORM',
      payload: { ...state.createFormData, [field]: value },
    });
  }, [state.createFormData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePageChange = useCallback((page: number) => {
    dispatch({ type: 'SET_PAGE', payload: page });
    if (listRef.current) {
      listRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const calculateAdjustedTotal = useCallback((order: FactoryOrder): string => {
    const total = calculateTotalQuantity(order);
    return total.toLocaleString(language, { minimumFractionDigits: 0 });
  }, [calculateTotalQuantity, language]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = normalizeText(state.searchQuery);
    return state.products
      .filter((product) => {
        const name = normalizeText(isRtl ? product.name : product.nameEn || product.name);
        return !normalizedQuery || name.includes(normalizedQuery);
      })
      .sort((a, b) => {
        const nameA = isRtl ? a.name : a.nameEn || a.name;
        const nameB = isRtl ? b.name : b.nameEn || b.name;
        return nameA.localeCompare(nameB, language);
      });
  }, [state.products, state.searchQuery, isRtl, language]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-gray-800">
          {t('inventory_orders')}
        </h1>
        <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <Button
            variant="primary"
            onClick={openCreateModal}
            className="bg-amber-500 hover:bg-amber-600 text-white rounded-md px-4 py-2 text-sm shadow-sm"
            aria-label={t('create_order')}
          >
            <PlusCircle className="w-5 h-5 mr-2" />
            {t('create_order')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: state.viewMode === 'card' ? 'table' : 'card' })}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md px-4 py-2 text-sm shadow-sm"
            aria-label={state.viewMode === 'card' ? t('table_view') : t('card_view')}
          >
            {state.viewMode === 'card' ? <Table2 className="w-5 h-5" /> : <Grid className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <ProductSearchInput
          value={state.searchQuery}
          onChange={handleSearchChange}
          placeholder={t('search_orders')}
          isRtl={isRtl}
          className="flex-1"
        />
        <Select
          options={statusOptions.map((opt) => ({
            value: opt.value,
            label: t(opt.label),
          }))}
          value={state.filterStatus}
          onChange={(value) => dispatch({ type: 'SET_FILTER_STATUS', payload: value })}
          className="w-full md:w-40 rounded-md border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
          aria-label={t('filter_status')}
        />
        <Select
          options={sortOptions.map((opt) => ({
            value: opt.value,
            label: t(opt.label),
          }))}
          value={`${state.sortBy}-${state.sortOrder}`}
          onChange={(value) => {
            const [by, order] = value.split('-') as ['date' | 'totalQuantity', 'asc' | 'desc'];
            dispatch({ type: 'SET_SORT', by, order });
          }}
          className="w-full md:w-48 rounded-md border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
          aria-label={t('sort_by')}
        />
      </div>

      {state.error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}
        >
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm">{state.error}</span>
        </motion.div>
      )}

      <div ref={listRef}>
        {state.loading ? (
          <div className={state.viewMode === 'card' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
            {Array.from({ length: ORDERS_PER_PAGE[state.viewMode] }).map((_, i) =>
              state.viewMode === 'card' ? (
                <OrderCardSkeleton key={i} isRtl={isRtl} />
              ) : (
                <OrderTableSkeleton key={i} isRtl={isRtl} />
              )
            )}
          </div>
        ) : paginatedOrders.length === 0 ? (
          <div className="text-center py-8">
            <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">{t('no_orders')}</h3>
            <p className="mt-1 text-sm text-gray-500">{t('no_orders_description')}</p>
          </div>
        ) : (
          <Suspense fallback={<div>Loading view...</div>}>
            {state.viewMode === 'card' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {paginatedOrders.map((order) => (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <OrderCard
                        order={order}
                        calculateAdjustedTotal={calculateAdjustedTotal}
                        calculateTotalQuantity={calculateTotalQuantity}
                        translateUnit={translateUnit}
                        updateOrderStatus={updateOrderStatus}
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
                updateItemStatus={updateItemStatus}
                openAssignModal={openAssignModal}
                submitting={state.submitting}
                isRtl={isRtl}
              />
            )}
          </Suspense>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={state.currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          isRtl={isRtl}
        />
      )}

      <AssignChefsModal
        isOpen={state.isAssignModalOpen}
        onClose={closeAssignModal}
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
        onClose={closeCreateModal}
        title={t('create_order')}
        size="md"
        className="bg-white rounded-lg shadow-xl border border-gray-100"
      >
        <div className="space-y-4">
          <ProductDropdown
            products={filteredProducts}
            selectedProductId={state.createFormData.productId}
            onChange={(value) => handleCreateFormChange('productId', value)}
            isRtl={isRtl}
            placeholder={t('select_product')}
          />
          <Input
            type="number"
            value={state.createFormData.quantity}
            onChange={(e) => handleCreateFormChange('quantity', e.target.value)}
            placeholder={t('quantity')}
            className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
            aria-label={t('quantity')}
            min="1"
          />
          <Input
            type="text"
            value={state.createFormData.notes}
            onChange={(e) => handleCreateFormChange('notes', e.target.value)}
            placeholder={t('notes')}
            className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
            aria-label={t('notes')}
          />
          <div className={`flex justify-end gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <Button
              variant="secondary"
              onClick={closeCreateModal}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md px-4 py-2 text-sm shadow-sm"
              aria-label={t('cancel')}
            >
              {t('cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={createOrder}
              disabled={state.submitting === 'create' || !state.createFormData.productId || !state.createFormData.quantity}
              className="bg-amber-500 hover:bg-amber-600 text-white rounded-md px-4 py-2 text-sm shadow-sm disabled:opacity-50"
              aria-label={t('create')}
            >
              {state.submitting === 'create' ? t('creating') : t('create')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default InventoryOrders;
