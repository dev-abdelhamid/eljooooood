import React, { useReducer, useEffect, useMemo, useCallback, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Modal } from '../components/UI/Modal';
import { ProductSearchInput, ProductDropdown } from './OrdersTablePage';
import { ShoppingCart, AlertCircle, PlusCircle, Table2, Grid, Plus, MinusCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { factoryOrdersAPI, chefsAPI, productsAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { useOrderNotifications } from '../hooks/useOrderNotifications';
import { FactoryOrder, Chef, AssignChefsForm, Product, FactoryOrderItem } from '../types/types';
import Pagination from '../components/Shared/Pagination';
import {AssignChefsModal} from '../components/production/AssignChefsModal';
import OrderTable from '../components/production/OrderTable';
import {OrderCard} from '../components/production/OrderCard';
import OrderCardSkeleton from '../components/Shared/OrderCardSkeleton';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';

// مكون QuantityInput
const QuantityInput = ({
  value,
  onChange,
  onIncrement,
  onDecrement,
  max,
}: {
  value: number;
  onChange: (value: string) => void;
  onIncrement: () => void;
  onDecrement: () => void;
  max?: number;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const handleChange = (val: string) => {
    const num = parseInt(val, 10);
    if (val === '' || isNaN(num) || num < 1) {
      onChange('1');
      return;
    }
    if (max !== undefined && num > max) {
      onChange(max.toString());
      return;
    }
    onChange(val);
  };
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onDecrement}
        className="w-7 h-7 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors duration-200 flex items-center justify-center disabled:opacity-50"
        aria-label={isRtl ? 'تقليل الكمية' : 'Decrease quantity'}
        disabled={value <= 1}
      >
        <MinusCircle className="w-4 h-4" />
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        max={max}
        min={1}
        className="w-10 h-7 text-center border border-gray-200 rounded-md text-xs focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm"
        aria-label={isRtl ? 'الكمية' : 'Quantity'}
      />
      <button
        onClick={onIncrement}
        className="w-7 h-7 bg-amber-600 hover:bg-amber-700 rounded-full transition-colors duration-200 flex items-center justify-center disabled:opacity-50"
        aria-label={isRtl ? 'زيادة الكمية' : 'Increase quantity'}
        disabled={max !== undefined && value >= max}
      >
        <Plus className="w-4 h-4 text-white" />
      </button>
    </div>
  );
};

// دالة normalizeText
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

// واجهة الحالة
interface State {
  orders: FactoryOrder[];
  selectedOrder: FactoryOrder | null;
  chefs: Chef[];
  products: Product[];
  isAssignModalOpen: boolean;
  isCreateModalOpen: boolean;
  assignFormData: AssignChefsForm;
  createFormData: { notes: string; items: { productId: string; quantity: number; assignedTo?: string }[] };
  filterStatus: string;
  searchQuery: string;
  debouncedSearchQuery: string;
  sortBy: 'date' | 'totalQuantity';
  sortOrder: 'asc' | 'desc';
  currentPage: number;
  loading: boolean;
  error: string;
  submitting: string | null;
  socketConnected: boolean;
  socketError: string | null;
  viewMode: 'card' | 'table';
  formErrors: Record<string, string>;
}

// الـ initialState
const initialState: State = {
  orders: [],
  selectedOrder: null,
  chefs: [],
  products: [],
  isAssignModalOpen: false,
  isCreateModalOpen: false,
  assignFormData: { items: [] },
  createFormData: { notes: '', items: [{ productId: '', quantity: 1 }] },
  filterStatus: '',
  searchQuery: '',
  debouncedSearchQuery: '',
  sortBy: 'date',
  sortOrder: 'desc',
  currentPage: 1,
  loading: true,
  error: '',
  submitting: null,
  socketConnected: false,
  socketError: null,
  viewMode: 'card',
  formErrors: {},
};

// دالة reducer
const reducer = (state: State, action: any): State => {
  switch (action.type) {
    case 'SET_ORDERS':
      return { ...state, orders: action.payload || [], error: '', currentPage: 1 };
    case 'ADD_ORDER':
      return { ...state, orders: [action.payload, ...state.orders.filter(o => o.id !== action.payload.id)] };
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
      return { ...state, assignFormData: action.payload };
    case 'SET_CREATE_FORM':
      return { ...state, createFormData: action.payload };
    case 'SET_FORM_ERRORS':
      return { ...state, formErrors: action.payload };
    case 'SET_FILTER_STATUS':
      return { ...state, filterStatus: action.payload, currentPage: 1 };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload, currentPage: 1 };
    case 'SET_DEBOUNCED_SEARCH':
      return { ...state, debouncedSearchQuery: action.payload };
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
        orders: state.orders.map(o => (o.id === action.orderId ? { ...o, status: action.status } : o)),
        selectedOrder:
          state.selectedOrder && state.selectedOrder.id === action.orderId
            ? { ...state.selectedOrder, status: action.status }
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
                status: order.items.every(i => i.status === 'completed') && order.status !== 'completed' ? 'completed' : order.status,
              }
            : order
        ),
        selectedOrder:
          state.selectedOrder && state.selectedOrder.id === action.orderId
            ? {
                ...state.selectedOrder,
                items: state.selectedOrder.items.map(item =>
                  item._id === action.payload.itemId ? { ...item, status: action.payload.status } : item
                ),
                status:
                  state.selectedOrder.items.every(i => i.status === 'completed') && state.selectedOrder.status !== 'completed'
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
                          ? {
                              _id: assignment.assignedTo._id,
                              username: assignment.assignedTo.username,
                              name: assignment.assignedTo.name,
                              nameEn: assignment.assignedTo.nameEn,
                              displayName: isRtl ? assignment.assignedTo.name : assignment.assignedTo.nameEn || assignment.assignedTo.name,
                              department: assignment.assignedTo.department,
                            }
                          : undefined,
                        status: assignment.status || i.status,
                      }
                    : i
                ),
                status: order.items.every(i => i.status === 'assigned') ? 'in_production' : order.status,
              }
            : order
        ),
        selectedOrder:
          state.selectedOrder && state.selectedOrder.id === action.orderId
            ? {
                ...state.selectedOrder,
                items: state.selectedOrder.items.map(i => {
                  const assignment = action.items?.find(a => a._id === i._id);
                  return assignment
                    ? {
                        ...i,
                        assignedTo: assignment.assignedTo
                          ? {
                              _id: assignment.assignedTo._id,
                              username: assignment.assignedTo.username,
                              name: assignment.assignedTo.name,
                              nameEn: assignment.assignedTo.nameEn,
                              displayName: isRtl ? assignment.assignedTo.name : assignment.assignedTo.nameEn || assignment.assignedTo.name,
                              department: assignment.assignedTo.department,
                            }
                          : undefined,
                        status: assignment.status || i.status,
                      }
                    : i
                ),
                status: state.selectedOrder.items.every(i => i.status === 'assigned') ? 'in_production' : state.selectedOrder.status,
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
const validTransitions = {
  requested: ['approved', 'cancelled'],
  pending: ['approved', 'cancelled'],
  approved: ['in_production', 'cancelled'],
  in_production: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};
const statusOptions = [
  { value: '', label: 'all_statuses' },
  { value: 'requested', label: 'requested' },
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

// ترجمة الوحدات
const translateUnit = (unit: string, isRtl: boolean) => {
  const translations = {
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

// مكون InventoryOrders
export const InventoryOrders = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { socket, isConnected, emit } = useSocket();
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  const listRef = useRef<HTMLDivElement>(null);
  const playNotificationSound = useOrderNotifications(dispatch, stateRef, user);

  // Debounce للبحث
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const handler = setTimeout(() => {
      dispatch({ type: 'SET_DEBOUNCED_SEARCH', payload: searchInput });
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const calculateTotalQuantity = (order: FactoryOrder) => {
    return order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  };

  // جلب البيانات
  const fetchData = useCallback(
    async (retryCount = 0) => {
      if (!user || !['chef', 'production', 'admin'].includes(user.role)) {
        dispatch({ type: 'SET_ERROR', payload: isRtl ? 'غير مصرح للوصول' : 'Unauthorized access' });
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const query: any = {
          status: state.filterStatus || undefined,
          sortBy: state.sortBy,
          sortOrder: state.sortOrder,
          search: state.debouncedSearchQuery || undefined,
        };
        if (user.role === 'chef') {
          query.createdBy = user.id;
          if (user.department) query.department = user.department._id;
        }
        const [ordersResponse, chefsResponse, productsResponse] = await Promise.all([
          factoryOrdersAPI.getAll(query),
          chefsAPI.getAll(),
          productsAPI.getAll({ department: user.role === 'chef' ? user.department?._id : undefined }),
        ]);
        const ordersData = Array.isArray(ordersResponse.data) ? ordersResponse.data : [];
        const mappedOrders: FactoryOrder[] = ordersData
          .filter((order) => order && order._id && order.orderNumber)
          .map((order) => ({
            id: order._id,
            orderNumber: order.orderNumber,
            items: Array.isArray(order.items)
              ? order.items.map((item: any): FactoryOrderItem => ({
                  _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
                  productId: item.product?._id || 'unknown',
                  productName: item.product?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                  productNameEn: item.product?.nameEn,
                  displayProductName: isRtl ? item.product?.name : item.product?.nameEn || item.product?.name,
                  quantity: Number(item.quantity) || 1,
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
                        department: {
                          _id: item.assignedTo.department?._id || 'unknown',
                          name: item.assignedTo.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                          nameEn: item.assignedTo.department?.nameEn,
                          displayName: isRtl ? item.assignedTo.department?.name : item.assignedTo.department?.nameEn || item.assignedTo.department?.name,
                        },
                      }
                    : undefined,
                  status: item.status || 'pending',
                  progress: item.progress || 0,
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
          payload: Array.isArray(chefsResponse.data)
            ? chefsResponse.data
                .filter((chef) => chef && chef.user?._id)
                .map((chef): Chef => ({
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
                }))
            : [],
        });
        dispatch({
          type: 'SET_PRODUCTS',
          payload: Array.isArray(productsResponse.data)
            ? productsResponse.data
                .filter((product) => product && product._id)
                .map((product): Product => ({
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
                  maxStockLevel: product.maxStockLevel || 1000,
                }))
                .sort((a, b) => {
                  const nameA = isRtl ? a.name : a.nameEn || a.name;
                  const nameB = isRtl ? b.name : b.nameEn || b.name;
                  return nameA.localeCompare(nameB, language);
                })
            : [],
        });
        dispatch({ type: 'SET_ERROR', payload: '' });
      } catch (err) {
        console.error(`[${new Date().toISOString()}] Fetch data error:`, err.message);
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
    [user, state.filterStatus, state.sortBy, state.sortOrder, state.debouncedSearchQuery, isRtl, language]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // إعداد WebSocket
  useEffect(() => {
    if (!socket || !user) return;

    const rooms = ['admin', 'production'];
    if (user.role === 'chef') rooms.push(`chef-${user.id}`);

    const handleConnect = () => {
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: true });
      dispatch({ type: 'SET_SOCKET_ERROR', payload: null });
      rooms.forEach((room) => emit('joinRoom', room));
    };

    const handleDisconnect = () => {
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: false });
      dispatch({ type: 'SET_SOCKET_ERROR', payload: isRtl ? 'تم قطع اتصال السوكت' : 'Socket disconnected' });
    };

    const handleOrderStatusUpdated = (data: any) => {
      if (validTransitions[stateRef.current.selectedOrder?.status || '']?.includes(data.status)) {
        dispatch({ type: 'UPDATE_ORDER_STATUS', orderId: data.orderId, status: data.status });
        playNotificationSound(data);
      }
    };

    const handleTaskAssigned = (data: any) => {
      dispatch({
        type: 'TASK_ASSIGNED',
        orderId: data.orderId,
        items: data.data.items,
      });
      playNotificationSound(data);
    };

    const handleItemStatusUpdated = (data: any) => {
      dispatch({
        type: 'UPDATE_ITEM_STATUS',
        orderId: data.orderId,
        payload: { itemId: data.itemId, status: data.status },
      });
      playNotificationSound(data);
    };

    const handleOrderCompleted = (data: any) => {
      dispatch({ type: 'UPDATE_ORDER_STATUS', orderId: data.orderId, status: 'completed' });
      playNotificationSound(data);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('orderStatusUpdated', handleOrderStatusUpdated);
    socket.on('taskAssigned', handleTaskAssigned);
    socket.on('itemStatusUpdated', handleItemStatusUpdated);
    socket.on('orderCompleted', handleOrderCompleted);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('orderStatusUpdated', handleOrderStatusUpdated);
      socket.off('taskAssigned', handleTaskAssigned);
      socket.off('itemStatusUpdated', handleItemStatusUpdated);
      socket.off('orderCompleted', handleOrderCompleted);
      rooms.forEach((room) => socket.emit('leaveRoom', room));
    };
  }, [socket, user, isRtl, emit, playNotificationSound]);

  // تحديث حالة الطلب
  const updateOrderStatus = useCallback(
    async (orderId: string, status: FactoryOrder['status']) => {
      if (!validTransitions[state.orders.find(o => o.id === orderId)?.status || '']?.includes(status)) {
        toast.error(isRtl ? 'تغيير الحالة غير صالح' : 'Invalid status transition', {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        await factoryOrdersAPI.updateStatus(orderId, { status });
        dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status });
        toast.success(
          isRtl ? `تم تحديث حالة الطلب ${orderId} إلى ${status}` : `Order ${orderId} status updated to ${status}`,
          { position: isRtl ? 'top-left' : 'top-right' }
        );
      } catch (err) {
        console.error(`[${new Date().toISOString()}] Error updating order status:`, err);
        const errorMessage = isRtl ? `خطأ في تحديث الحالة: ${err.message}` : `Error updating status: ${err.message}`;
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right' });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [isRtl, state.orders]
  );

  // فتح نافذة تعيين الشيفات
  const openAssignModal = useCallback(
    (order: FactoryOrder) => {
      dispatch({
        type: 'SET_ASSIGN_FORM',
        payload: {
          items: order.items.map((item) => ({
            itemId: item._id,
            assignedTo: item.assignedTo?._id || '',
            unit: item.displayUnit,
          })),
        },
      });
      dispatch({ type: 'SET_SELECTED_ORDER', payload: order });
      dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: true });
    },
    []
  );

  // تعيين الشيفات
  const assignChefs = useCallback(
    async (orderId: string) => {
      const items = state.assignFormData.items;
      if (items.some((item) => !item.assignedTo)) {
        dispatch({
          type: 'SET_ERROR',
          payload: isRtl ? 'يرجى اختيار شيف لكل عنصر' : 'Please select a chef for each item',
        });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        const response = await factoryOrdersAPI.assignChefs(orderId, { items });
        dispatch({
          type: 'TASK_ASSIGNED',
          orderId,
          items: response.data.items,
        });
        dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: false });
        toast.success(isRtl ? 'تم تعيين الشيفات بنجاح' : 'Chefs assigned successfully', {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err) {
        console.error(`[${new Date().toISOString()}] Error assigning chefs:`, err);
        const errorMessage = isRtl ? `خطأ في تعيين الشيفات: ${err.message}` : `Error assigning chefs: ${err.message}`;
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right' });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [state.assignFormData, isRtl]
  );

  // إنشاء طلب جديد
  const createOrder = useCallback(
    async () => {
      const { notes, items } = state.createFormData;
      const formErrors: Record<string, string> = {};
      if (!items.length || items.some((item) => !item.productId)) {
        formErrors.items = isRtl ? 'يجب إضافة عنصر واحد على الأقل' : 'At least one item is required';
      }
      if (items.some((item) => item.quantity < 1)) {
        formErrors.quantity = isRtl ? 'الكمية يجب أن تكون أكبر من 0' : 'Quantity must be greater than 0';
      }
      if (Object.keys(formErrors).length) {
        dispatch({ type: 'SET_FORM_ERRORS', payload: formErrors });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: 'creating' });
      try {
        const orderNumber = `FO-${Date.now()}`;
        const response = await factoryOrdersAPI.create({
          orderNumber,
          items: items.map((item) => ({
            product: item.productId,
            quantity: item.quantity,
          })),
          notes: notes.trim() || undefined,
          priority: 'medium',
        });
        dispatch({
          type: 'ADD_ORDER',
          payload: {
            id: response.data._id,
            orderNumber: response.data.orderNumber,
            items: response.data.items.map((item: any) => ({
              _id: item._id,
              productId: item.product?._id || 'unknown',
              productName: item.product?.name || (isRtl ? 'غير معروف' : 'Unknown'),
              productNameEn: item.product?.nameEn,
              displayProductName: isRtl ? item.product?.name : item.product?.nameEn || item.product?.name,
              quantity: Number(item.quantity) || 1,
              unit: item.product?.unit || 'unit',
              unitEn: item.product?.unitEn,
              displayUnit: translateUnit(item.product?.unit || 'unit', isRtl),
              department: {
                _id: item.product?.department?._id || 'unknown',
                name: item.product?.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                nameEn: item.product?.department?.nameEn,
                displayName: isRtl ? item.product?.department?.name : item.product?.department?.nameEn || item.product?.department?.name,
              },
              status: item.status || 'pending',
            })),
            status: response.data.status || 'pending',
            date: formatDate(new Date(response.data.createdAt), language),
            notes: response.data.notes || '',
            priority: response.data.priority || 'medium',
            createdBy: user?.name || (isRtl ? 'غير معروف' : 'Unknown'),
          },
        });
        dispatch({ type: 'SET_CREATE_MODAL', isOpen: false });
        dispatch({ type: 'SET_CREATE_FORM', payload: { notes: '', items: [{ productId: '', quantity: 1 }] } });
        dispatch({ type: 'SET_FORM_ERRORS', payload: {} });
        toast.success(isRtl ? 'تم إنشاء الطلب بنجاح' : 'Order created successfully', {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err) {
        console.error(`[${new Date().toISOString()}] Error creating order:`, err);
        const errorMessage = isRtl ? `خطأ في إنشاء الطلب: ${err.message}` : `Error creating order: ${err.message}`;
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right' });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [state.createFormData, isRtl, user, language]
  );

  // تصفية وفرز الطلبات
  const filteredAndSortedOrders = useMemo(() => {
    let result = [...state.orders];
    if (state.filterStatus) {
      result = result.filter((order) => order.status === state.filterStatus);
    }
    if (state.debouncedSearchQuery) {
      const query = normalizeText(state.debouncedSearchQuery);
      result = result.filter((order) =>
        normalizeText(order.orderNumber).includes(query) ||
        order.items.some((item) => normalizeText(item.displayProductName).includes(query)) ||
        normalizeText(order.createdBy).includes(query)
      );
    }
    result.sort((a, b) => {
      const multiplier = state.sortOrder === 'asc' ? 1 : -1;
      if (state.sortBy === 'date') {
        return multiplier * (new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime());
      }
      return multiplier * (calculateTotalQuantity(a) - calculateTotalQuantity(b));
    });
    return result;
  }, [state.orders, state.filterStatus, state.debouncedSearchQuery, state.sortBy, state.sortOrder]);

  // تقسيم الصفحات
  const paginatedOrders = useMemo(() => {
    const startIndex = (state.currentPage - 1) * ORDERS_PER_PAGE[state.viewMode];
    return filteredAndSortedOrders.slice(startIndex, startIndex + ORDERS_PER_PAGE[state.viewMode]);
  }, [filteredAndSortedOrders, state.currentPage, state.viewMode]);

  const totalPages = Math.ceil(filteredAndSortedOrders.length / ORDERS_PER_PAGE[state.viewMode]);

  // التعامل مع تغييرات النموذج
  const handleCreateFormChange = useCallback(
    (index: number, field: string, value: any) => {
      const newItems = [...state.createFormData.items];
      if (field === 'productId') {
        newItems[index].productId = value;
      } else if (field === 'quantity') {
        newItems[index].quantity = parseInt(value, 10) || 1;
      }
      dispatch({ type: 'SET_CREATE_FORM', payload: { ...state.createFormData, items: newItems } });
    },
    [state.createFormData]
  );

  const addItem = useCallback(() => {
    dispatch({
      type: 'SET_CREATE_FORM',
      payload: {
        ...state.createFormData,
        items: [...state.createFormData.items, { productId: '', quantity: 1 }],
      },
    });
  }, [state.createFormData]);

  const removeItem = useCallback(
    (index: number) => {
      if (state.createFormData.items.length > 1) {
        const newItems = state.createFormData.items.filter((_, i) => i !== index);
        dispatch({ type: 'SET_CREATE_FORM', payload: { ...state.createFormData, items: newItems } });
      }
    },
    [state.createFormData]
  );

  return (
    <div className="p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <h1 className="text-xl font-semibold text-gray-800">
          {isRtl ? 'طلبات المخزون' : 'Inventory Orders'}
        </h1>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="primary"
            onClick={() => dispatch({ type: 'SET_CREATE_MODAL', isOpen: true })}
            className="bg-amber-500 hover:bg-amber-600 text-white rounded-md px-3 py-1 text-sm shadow-sm"
            aria-label={isRtl ? 'إنشاء طلب جديد' : 'Create New Order'}
          >
            <PlusCircle className="w-4 h-4 mr-1" />
            {isRtl ? 'إنشاء طلب جديد' : 'Create New Order'}
          </Button>
          <Button
            variant={state.viewMode === 'card' ? 'primary' : 'secondary'}
            onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'card' })}
            className={`${state.viewMode === 'card' ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'} rounded-md px-3 py-1 text-sm shadow-sm`}
            aria-label={isRtl ? 'عرض البطاقات' : 'Card View'}
          >
            <Grid className="w-4 h-4 mr-1" />
            {isRtl ? 'بطاقات' : 'Cards'}
          </Button>
          <Button
            variant={state.viewMode === 'table' ? 'primary' : 'secondary'}
            onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'table' })}
            className={`${state.viewMode === 'table' ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'} rounded-md px-3 py-1 text-sm shadow-sm`}
            aria-label={isRtl ? 'عرض الجدول' : 'Table View'}
          >
            <Table2 className="w-4 h-4 mr-1" />
            {isRtl ? 'جدول' : 'Table'}
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <ProductSearchInput
          value={state.searchQuery}
          onChange={(e) => {
            setSearchInput(e.target.value);
            dispatch({ type: 'SET_SEARCH_QUERY', payload: e.target.value });
          }}
          placeholder={isRtl ? 'ابحث حسب رقم الطلب أو المنتج' : 'Search by order number or product'}
          className="flex-1"
        />
        <select
          value={state.filterStatus}
          onChange={(e) => dispatch({ type: 'SET_FILTER_STATUS', payload: e.target.value })}
          className="border border-gray-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm"
          aria-label={isRtl ? 'تصفية حسب الحالة' : 'Filter by status'}
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.label)}
            </option>
          ))}
        </select>
        <select
          value={`${state.sortBy}:${state.sortOrder}`}
          onChange={(e) => {
            const [by, order] = e.target.value.split(':');
            dispatch({ type: 'SET_SORT', by, order });
          }}
          className="border border-gray-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm"
          aria-label={isRtl ? 'ترتيب حسب' : 'Sort by'}
        >
          {sortOptions.map((option) =>
            ['asc', 'desc'].map((order) => (
              <option key={`${option.value}:${order}`} value={`${option.value}:${order}`}>
                {t(option.label)} ({order === 'asc' ? (isRtl ? 'تصاعدي' : 'Ascending') : (isRtl ? 'تنازلي' : 'Descending')})
              </option>
            ))
          )}
        </select>
      </div>

      {state.error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 mb-4"
        >
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm">{state.error}</span>
        </motion.div>
      )}

      {state.loading ? (
        state.viewMode === 'card' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: ORDERS_PER_PAGE.card }).map((_, i) => (
              <OrderCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <OrderTableSkeleton />
        )
      ) : paginatedOrders.length === 0 ? (
        <Card className="p-4 text-center text-gray-600">
          {isRtl ? 'لا توجد طلبات لعرضها' : 'No orders to display'}
        </Card>
      ) : state.viewMode === 'card' ? (
        <div ref={listRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          calculateTotalQuantity={calculateTotalQuantity}
          translateUnit={translateUnit}
          updateOrderStatus={updateOrderStatus}
          openAssignModal={openAssignModal}
          submitting={state.submitting}
          isRtl={isRtl}
        />
      )}

      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination
            currentPage={state.currentPage}
            totalPages={totalPages}
            onPageChange={(page) => dispatch({ type: 'SET_PAGE', payload: page })}
            isRtl={isRtl}
          />
        </div>
      )}

      <AssignChefsModal
        isOpen={state.isAssignModalOpen}
        onClose={() => dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: false })}
        selectedOrder={state.selectedOrder}
        assignFormData={state.assignFormData}
        chefs={state.chefs}
        error={state.error}
        submitting={state.submitting}
        assignChefs={assignChefs}
        setAssignForm={(form) => dispatch({ type: 'SET_ASSIGN_FORM', payload: form })}
        isRtl={isRtl}
      />

      <Modal
        isOpen={state.isCreateModalOpen}
        onClose={() => {
          dispatch({ type: 'SET_CREATE_MODAL', isOpen: false });
          dispatch({ type: 'SET_FORM_ERRORS', payload: {} });
        }}
        title={isRtl ? 'إنشاء طلب مخزون جديد' : 'Create New Inventory Order'}
        size="lg"
        className="bg-white rounded-lg shadow-xl border border-gray-100"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createOrder();
          }}
          className="space-y-4"
        >
          <div>
            <label className={`block text-sm font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}>
              {isRtl ? 'المنتجات' : 'Products'}
            </label>
            {state.createFormData.items.map((item, index) => (
              <div key={index} className="flex items-center gap-2 mb-2">
                <ProductDropdown
                  products={state.products.filter(
                    (product) => user.role === 'chef' ? product.department._id === user.department?._id : true
                  )}
                  value={item.productId}
                  onChange={(value) => handleCreateFormChange(index, 'productId', value)}
                  isRtl={isRtl}
                  placeholder={isRtl ? 'اختر المنتج' : 'Select Product'}
                  className="flex-1"
                />
                <QuantityInput
                  value={item.quantity}
                  onChange={(value) => handleCreateFormChange(index, 'quantity', value)}
                  onIncrement={() => handleCreateFormChange(index, 'quantity', (item.quantity + 1).toString())}
                  onDecrement={() => handleCreateFormChange(index, 'quantity', Math.max(1, item.quantity - 1).toString())}
                  max={state.products.find((p) => p._id === item.productId)?.maxStockLevel}
                />
                {state.createFormData.items.length > 1 && (
                  <button
                    onClick={() => removeItem(index)}
                    className="text-red-600 hover:text-red-800"
                    aria-label={isRtl ? 'إزالة العنصر' : 'Remove Item'}
                  >
                    <MinusCircle className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
            {state.formErrors.items && (
              <p className="text-red-600 text-xs mt-1">{state.formErrors.items}</p>
            )}
            {state.formErrors.quantity && (
              <p className="text-red-600 text-xs mt-1">{state.formErrors.quantity}</p>
            )}
            <Button
              variant="secondary"
              onClick={addItem}
              className="mt-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md px-3 py-1 text-sm shadow-sm"
              aria-label={isRtl ? 'إضافة عنصر آخر' : 'Add Another Item'}
            >
              <PlusCircle className="w-4 h-4 mr-1" />
              {isRtl ? 'إضافة عنصر آخر' : 'Add Another Item'}
            </Button>
          </div>
          <div>
            <label className={`block text-sm font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}>
              {isRtl ? 'ملاحظات' : 'Notes'}
            </label>
            <textarea
              value={state.createFormData.notes}
              onChange={(e) =>
                dispatch({
                  type: 'SET_CREATE_FORM',
                  payload: { ...state.createFormData, notes: e.target.value },
                })
              }
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm"
              rows={4}
              placeholder={isRtl ? 'أدخل ملاحظات الطلب (اختياري)' : 'Enter order notes (optional)'}
            />
          </div>
          {state.error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2"
            >
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-red-600 text-sm">{state.error}</span>
            </motion.div>
          )}
          <div className={`flex justify-end gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <Button
              variant="secondary"
              onClick={() => {
                dispatch({ type: 'SET_CREATE_MODAL', isOpen: false });
                dispatch({ type: 'SET_FORM_ERRORS', payload: {} });
              }}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md px-4 py-2 text-sm shadow-sm"
              aria-label={isRtl ? 'إلغاء' : 'Cancel'}
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={state.submitting === 'creating'}
              className="bg-amber-500 hover:bg-amber-600 text-white rounded-md px-4 py-2 text-sm shadow-sm"
              aria-label={isRtl ? 'إنشاء الطلب' : 'Create Order'}
            >
              {state.submitting === 'creating' ? (isRtl ? 'جارٍ الإنشاء' : 'Creating') : (isRtl ? 'إنشاء الطلب' : 'Create Order')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default InventoryOrders;