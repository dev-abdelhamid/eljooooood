import React, { useReducer, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Modal } from '../components/UI/Modal';
import { Select } from '../components/UI/Select';
import { Input } from '../components/UI/Input';
import { ShoppingCart, AlertCircle, PlusCircle, Table2, Grid, CheckCircle, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { factoryOrdersAPI, chefsAPI, productsAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { useOrderNotifications } from '../hooks/useOrderNotifications';
import { FactoryOrder, Chef, AssignChefsForm, OrderStatus } from '../types/types';
import Pagination from '../components/Shared/Pagination';
import AssignChefsModal from '../components/production/AssignChefsModal';
import OrderTable from '../components/production/OrderTable';
import OrderCard from '../components/production/OrderCard';
import OrderCardSkeleton from '../components/Shared/OrderCardSkeleton';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';
import { ProductSearchInput, ProductDropdown } from './OrdersTablePage';

// دالة لتطبيع النصوص
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
    case 'SET_ORDERS': return { ...state, orders: action.payload, error: '', currentPage: 1 };
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
  const stateRef = useRef(state);
  const listRef = useRef<HTMLDivElement>(null);
  const playNotificationSound = useOrderNotifications(dispatch, stateRef, user);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const calculateTotalQuantity = useCallback((order: FactoryOrder) => {
    return order.items?.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) || 0;
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
              displayProductName: isRtl ? item.product?.name : item.product?.nameEn || item.product?.name || 'Unknown',
              quantity: Number(item.quantity) || 1,
              unit: item.product?.unit || 'unit',
              unitEn: item.product?.unitEn,
              displayUnit: translateUnit(item.product?.unit || 'unit', isRtl),
              department: {
                _id: item.product?.department?._id || 'unknown',
                name: item.product?.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                nameEn: item.product?.department?.nameEn,
                displayName: isRtl ? item.product?.department?.name : item.product?.department?.nameEn || item.product?.department?.name || 'Unknown',
              },
              assignedTo: item.assignedTo
                ? {
                    _id: item.assignedTo._id,
                    username: item.assignedTo.username,
                    name: item.assignedTo.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: item.assignedTo.nameEn,
                    displayName: isRtl ? item.assignedTo.name : item.assignedTo.nameEn || item.assignedTo.name || 'Unknown',
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
        };
        if (user.role === 'production' && user.department) query.department = user.department._id;
        
        // جلب البيانات
        const [ordersResponse, chefsResponse, productsResponse] = await Promise.all([
          factoryOrdersAPI.getAll(query),
          chefsAPI.getAll(),
          productsAPI.getAll(),
        ]);

        // التحقق من صحة البيانات
        if (!ordersResponse || !Array.isArray(ordersResponse)) {
          throw new Error('Invalid orders response');
        }

        const mappedOrders: FactoryOrder[] = ordersResponse
          .filter((order: any) => order && order._id && order.orderNumber)
          .map((order: any) => ({
            id: order._id,
            orderNumber: order.orderNumber || 'Unknown',
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
                    displayName: isRtl ? item.product?.department?.name : item.product?.department?.nameEn || item.product?.department?.name || 'Unknown',
                  },
                  assignedTo: item.assignedTo
                    ? {
                        _id: item.assignedTo._id,
                        username: item.assignedTo.username || 'Unknown',
                        name: item.assignedTo.name || (isRtl ? 'غير معروف' : 'Unknown'),
                        nameEn: item.assignedTo.nameEn,
                        displayName: isRtl ? item.assignedTo.name : item.assignedTo.nameEn || item.assignedTo.name || 'Unknown',
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
        dispatch({ type: 'SET_ERROR', payload: '' });
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
    fetchData();
  }, [fetchData]);

  const handleCreateOrder = useCallback(
    async () => {
      if (!user || state.submitting === 'create') return;
      dispatch({ type: 'SET_SUBMITTING', payload: 'create' });
      try {
        const { productId, quantity, notes } = state.createFormData;
        if (!productId || !quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) {
          toast.error(isRtl ? 'يرجى ملء جميع الحقول بشكل صحيح' : 'Please fill all fields correctly', {
            position: isRtl ? 'top-left' : 'top-right',
          });
          return;
        }

        const orderNumber = `ORD-${Date.now()}`;
        const response = await factoryOrdersAPI.create({
          orderNumber,
          items: [{ product: productId, quantity: Number(quantity) }],
          notes,
          priority: 'medium',
        });

        dispatch({ type: 'ADD_ORDER', payload: {
          id: response.data._id,
          orderNumber: response.data.orderNumber,
          items: response.data.items.map((item: any) => ({
            _id: item._id,
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
              displayName: isRtl ? item.product?.department?.name : item.product?.department?.nameEn || item.product?.department?.name || 'Unknown',
            },
            assignedTo: item.assignedTo
              ? {
                  _id: item.assignedTo._id,
                  username: item.assignedTo.username,
                  name: item.assignedTo.name || (isRtl ? 'غير معروف' : 'Unknown'),
                  nameEn: item.assignedTo.nameEn,
                  displayName: isRtl ? item.assignedTo.name : item.assignedTo.nameEn || item.assignedTo.name || 'Unknown',
                  department: item.assignedTo.department,
                }
              : undefined,
            status: item.status || 'pending',
          })),
          status: response.data.status || 'pending',
          date: formatDate(response.data.createdAt ? new Date(response.data.createdAt) : new Date(), language),
          notes: response.data.notes || '',
          priority: response.data.priority || 'medium',
          createdBy: response.data.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
        }});
        dispatch({ type: 'SET_CREATE_MODAL', isOpen: false });
        dispatch({ type: 'SET_CREATE_FORM', payload: { productId: '', quantity: '', notes: '' } });
        toast.success(isRtl ? 'تم إنشاء الطلب بنجاح' : 'Order created successfully', {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error('Create order error:', err.message);
        toast.error(isRtl ? `خطأ في إنشاء الطلب: ${err.message}` : `Error creating order: ${err.message}`, {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [user, state.createFormData, isRtl, language]
  );

  const handleAssignChefs = useCallback(
    async () => {
      if (!user || !state.selectedOrder || state.submitting === 'assign') return;
      dispatch({ type: 'SET_SUBMITTING', payload: 'assign' });
      try {
        const { items } = state.assignFormData;
        if (!items.length || items.some(i => !i.assignedTo || !i.itemId)) {
          toast.error(isRtl ? 'يرجى تعيين شيف لكل عنصر' : 'Please assign a chef to each item', {
            position: isRtl ? 'top-left' : 'top-right',
          });
          return;
        }

        await factoryOrdersAPI.assignChefs(state.selectedOrder.id, { items });
        dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: false });
        dispatch({ type: 'SET_ASSIGN_FORM', payload: { items: [] } });
        dispatch({ type: 'SET_SELECTED_ORDER', payload: null });
        toast.success(isRtl ? 'تم تعيين الشيفات بنجاح' : 'Chefs assigned successfully', {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error('Assign chefs error:', err.message);
        toast.error(isRtl ? `خطأ في تعيين الشيفات: ${err.message}` : `Error assigning chefs: ${err.message}`, {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [user, state.selectedOrder, state.assignFormData, isRtl]
  );

  const handleUpdateStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      if (!user || state.submitting === `status-${orderId}`) return;
      dispatch({ type: 'SET_SUBMITTING', payload: `status-${orderId}` });
      try {
        await factoryOrdersAPI.updateStatus(orderId, { status });
        dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status });
        toast.success(isRtl ? `تم تحديث الحالة إلى ${status}` : `Status updated to ${status}`, {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error('Update status error:', err.message);
        toast.error(isRtl ? `خطأ في تحديث الحالة: ${err.message}` : `Error updating status: ${err.message}`, {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [user, isRtl]
  );

  const filteredOrders = useMemo(() => {
    let result = [...state.orders];
    if (state.filterStatus) {
      result = result.filter(order => order.status === state.filterStatus);
    }
    if (state.searchQuery) {
      const query = normalizeText(state.searchQuery);
      result = result.filter(order =>
        normalizeText(order.orderNumber).includes(query) ||
        order.items.some(item => normalizeText(item.displayProductName).includes(query))
      );
    }
    result.sort((a, b) => {
      const multiplier = state.sortOrder === 'asc' ? 1 : -1;
      if (state.sortBy === 'date') {
        return multiplier * (new Date(a.date).getTime() - new Date(b.date).getTime());
      }
      return multiplier * (calculateTotalQuantity(a) - calculateTotalQuantity(b));
    });
    return result;
  }, [state.orders, state.filterStatus, state.searchQuery, state.sortBy, state.sortOrder, calculateTotalQuantity]);

  const paginatedOrders = useMemo(() => {
    const start = (state.currentPage - 1) * ORDERS_PER_PAGE[state.viewMode];
    const end = start + ORDERS_PER_PAGE[state.viewMode];
    return filteredOrders.slice(start, end);
  }, [filteredOrders, state.currentPage, state.viewMode]);

  const totalPages = Math.ceil(filteredOrders.length / ORDERS_PER_PAGE[state.viewMode]);

  return (
    <div className="px-2 py-4">
      <Suspense fallback={<OrderTableSkeleton isRtl={isRtl} />}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }} className="mb-6">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div className="w-full sm:w-auto text-center sm:text-start">
              <h1 className="text-xl font-bold text-gray-900 flex items-center justify-center sm:justify-start gap-2">
                <ShoppingCart className="w-5 h-5 text-amber-700" />
                {isRtl ? 'طلبات الإنتاج' : 'Production Orders'}
              </h1>
              <p className="text-xs text-gray-600 mt-1">{isRtl ? 'إدارة طلبات إنتاج المخزون' : 'Manage inventory production orders'}</p>
            </div>
            <div className="flex gap-2 flex-wrap justify-center sm:justify-end w-full sm:w-auto">
              <Button
                variant="primary"
                onClick={() => dispatch({ type: 'SET_CREATE_MODAL', isOpen: true })}
                className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white rounded-full px-3 py-1.5 text-xs shadow transition-all duration-300"
              >
                <PlusCircle className="w-4 h-4" />
                {isRtl ? 'إنشاء طلب جديد' : 'Create New Order'}
              </Button>
            </div>
          </div>
          <Card className="p-3 mt-6 bg-white shadow-md rounded-xl border border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{isRtl ? 'بحث' : 'Search'}</label>
                <ProductSearchInput
                  value={state.searchQuery}
                  onChange={(e) => dispatch({ type: 'SET_SEARCH_QUERY', payload: e.target.value })}
                  placeholder={isRtl ? 'ابحث حسب رقم الطلب أو المنتج...' : 'Search by order number or product...'}
                  ariaLabel={isRtl ? 'بحث' : 'Search'}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{isRtl ? 'تصفية حسب الحالة' : 'Filter by Status'}</label>
                <ProductDropdown
                  options={statusOptions.map(opt => ({
                    value: opt.value,
                    label: isRtl ? { '': 'كل الحالات', pending: 'قيد الانتظار', approved: 'تم الموافقة', in_production: 'في الإنتاج', completed: 'مكتمل', cancelled: 'ملغى' }[opt.value] : opt.label,
                  }))}
                  value={state.filterStatus}
                  onChange={(value) => dispatch({ type: 'SET_FILTER_STATUS', payload: value })}
                  ariaLabel={isRtl ? 'تصفية حسب الحالة' : 'Filter by Status'}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{isRtl ? 'ترتيب حسب' : 'Sort By'}</label>
                <ProductDropdown
                  options={sortOptions.map(opt => ({
                    value: opt.value,
                    label: isRtl ? { date: 'التاريخ', totalQuantity: 'الكمية الإجمالية' }[opt.value] : opt.label,
                  }))}
                  value={state.sortBy}
                  onChange={(value) => dispatch({ type: 'SET_SORT', by: value as any, order: state.sortOrder })}
                  ariaLabel={isRtl ? 'ترتيب حسب' : 'Sort By'}
                  className="w-full"
                />
              </div>
            </div>
            <div className={`flex flex-col sm:flex-row justify-between items-center gap-3 mt-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div className="text-xs text-center text-gray-600">
                {isRtl ? `عدد الطلبات: ${state.orders.length}` : `Orders count: ${state.orders.length}`}
              </div>
              <Button
                variant="secondary"
                onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: state.viewMode === 'card' ? 'table' : 'card' })}
                className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full px-3 py-1.5 text-xs shadow transition-all duration-300"
              >
                {state.viewMode === 'card' ? <Table2 className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
                {state.viewMode === 'card' ? (isRtl ? 'عرض كجدول' : 'View as Table') : (isRtl ? 'عرض كبطاقات' : 'View as Cards')}
              </Button>
            </div>
          </Card>
          <div ref={listRef} className="mt-6 min-h-[300px]">
            <AnimatePresence>
              {state.loading ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-1"
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
                  <Card className="p-5 max-w-md mx-auto text-center bg-red-50 shadow-md rounded-xl border border-red-100">
                    <div className={`flex items-center justify-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <p className="text-xs font-medium text-red-600">{state.error}</p>
                    </div>
                    <Button
                      variant="primary"
                      onClick={() => fetchData()}
                      className="mt-3 bg-amber-600 hover:bg-amber-700 text-white rounded-full px-3 py-1.5 text-xs shadow transition-all duration-300"
                    >
                      {isRtl ? 'إعادة المحاولة' : 'Retry'}
                    </Button>
                  </Card>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-3"
                >
                  {paginatedOrders.length === 0 ? (
                    <Card className="p-6 text-center bg-white shadow-md rounded-xl border border-gray-200">
                      <ShoppingCart className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                      <h3 className="text-base font-medium text-gray-800 mb-1">{isRtl ? 'لا توجد طلبات' : 'No Orders'}</h3>
                      <p className="text-xs text-gray-500">
                        {state.filterStatus || state.searchQuery
                          ? isRtl ? 'لا توجد طلبات مطابقة' : 'No matching orders'
                          : isRtl ? 'لا توجد طلبات بعد' : 'No orders yet'}
                      </p>
                    </Card>
                  ) : (
                    <>
                      {state.viewMode === 'table' ? (
                        <OrderTable
                          orders={paginatedOrders}
                          calculateAdjustedTotal={calculateTotalQuantity}
                          isRtl={isRtl}
                          onAssign={(order) => {
                            dispatch({ type: 'SET_SELECTED_ORDER', payload: order });
                            dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: true });
                            dispatch({
                              type: 'SET_ASSIGN_FORM',
                              payload: {
                                items: order.items.map(item => ({
                                  itemId: item._id,
                                  assignedTo: item.assignedTo?._id || '',
                                })),
                              },
                            });
                          }}
                          onUpdateStatus={handleUpdateStatus}
                          validTransitions={validTransitions}
                          user={user}
                          submitting={state.submitting}
                        />
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {paginatedOrders.map((order, index) => (
                            <motion.div
                              key={order.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.3, delay: index * 0.05 }}
                            >
                              <OrderCard
                                order={order}
                                calculateAdjustedTotal={calculateTotalQuantity}
                                isRtl={isRtl}
                                onAssign={() => {
                                  dispatch({ type: 'SET_SELECTED_ORDER', payload: order });
                                  dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: true });
                                  dispatch({
                                    type: 'SET_ASSIGN_FORM',
                                    payload: {
                                      items: order.items.map(item => ({
                                        itemId: item._id,
                                        assignedTo: item.assignedTo?._id || '',
                                      })),
                                    },
                                  });
                                }}
                                onUpdateStatus={(status) => handleUpdateStatus(order.id, status)}
                                validTransitions={validTransitions}
                                user={user}
                                submitting={state.submitting === `status-${order.id}`}
                              />
                            </motion.div>
                          ))}
                        </div>
                      )}
                      <Pagination
                        currentPage={state.currentPage}
                        totalPages={totalPages}
                        onPageChange={(page) => dispatch({ type: 'SET_PAGE', payload: page })}
                        isRtl={isRtl}
                      />
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
        <Modal
          isOpen={state.isCreateModalOpen}
          onClose={() => dispatch({ type: 'SET_CREATE_MODAL', isOpen: false })}
          title={isRtl ? 'إنشاء طلب إنتاج جديد' : 'Create New Production Order'}
          className={isRtl ? 'text-right' : 'text-left'}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{isRtl ? 'المنتج' : 'Product'}</label>
              <Select
                options={state.products.map(product => ({
                  value: product._id,
                  label: isRtl ? product.name : product.nameEn || product.name,
                }))}
                value={state.createFormData.productId}
                onChange={(value) => dispatch({
                  type: 'SET_CREATE_FORM',
                  payload: { ...state.createFormData, productId: value },
                })}
                placeholder={isRtl ? 'اختر المنتج' : 'Select Product'}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{isRtl ? 'الكمية' : 'Quantity'}</label>
              <Input
                type="number"
                value={state.createFormData.quantity}
                onChange={(e) => dispatch({
                  type: 'SET_CREATE_FORM',
                  payload: { ...state.createFormData, quantity: e.target.value },
                })}
                placeholder={isRtl ? 'أدخل الكمية' : 'Enter Quantity'}
                className="w-full"
                min="1"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{isRtl ? 'ملاحظات' : 'Notes'}</label>
              <Input
                type="text"
                value={state.createFormData.notes}
                onChange={(e) => dispatch({
                  type: 'SET_CREATE_FORM',
                  payload: { ...state.createFormData, notes: e.target.value },
                })}
                placeholder={isRtl ? 'أدخل الملاحظات (اختياري)' : 'Enter Notes (Optional)'}
                className="w-full"
              />
            </div>
            <div className={`flex justify-end gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <Button
                variant="secondary"
                onClick={() => dispatch({ type: 'SET_CREATE_MODAL', isOpen: false })}
                className="px-3 py-1.5 text-xs"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateOrder}
                disabled={state.submitting === 'create'}
                className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white"
              >
                {state.submitting === 'create' ? (isRtl ? 'جارٍ الإنشاء...' : 'Creating...') : (isRtl ? 'إنشاء' : 'Create')}
              </Button>
            </div>
          </div>
        </Modal>
        <AssignChefsModal
          isOpen={state.isAssignModalOpen}
          onClose={() => {
            dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: false });
            dispatch({ type: 'SET_SELECTED_ORDER', payload: null });
          }}
          order={state.selectedOrder}
          chefs={state.chefs}
          assignFormData={state.assignFormData}
          setAssignFormData={(data) => dispatch({ type: 'SET_ASSIGN_FORM', payload: data })}
          onSubmit={handleAssignChefs}
          isSubmitting={state.submitting === 'assign'}
          isRtl={isRtl}
        />
      </Suspense>
    </div>
  );
};


export default InventoryOrders;