import React, { useReducer, useEffect, useMemo, useCallback, useRef, Suspense, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Card } from '../components/UI/Card';
import { Select } from '../components/UI/Select';
import { Button } from '../components/UI/Button';
import { Modal } from '../components/UI/Modal';
import { ProductSearchInput, ProductDropdown } from './OrdersTablePage';
import { ShoppingCart, AlertCircle, PlusCircle, Table2, Grid, Plus, MinusCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { factoryOrdersAPI, chefsAPI, productsAPI, departmentAPI, factoryInventoryAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { useOrderNotifications } from '../hooks/useOrderNotifications';
import { FactoryOrder, Chef, AssignChefsForm, Product, FactoryOrderItem, User } from '../types/types';
import Pagination from '../components/Shared/Pagination';
import AssignChefsModal from '../components/production/AssignChefsModal';
import OrderTable from '../components/production/OrderTable';
import OrderCard from '../components/production/OrderCard';
import OrderCardSkeleton from '../components/Shared/OrderCardSkeleton';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';

const QuantityInput: React.FC<{
  value: number;
  onChange: (val: string) => void;
  onIncrement: () => void;
  onDecrement: () => void;
  max?: number;
}> = ({ value, onChange, onIncrement, onDecrement, max }) => {
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

const normalizeText = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, '')
    .replace(/أ|إ|آ|ٱ/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .trim();
};

interface State {
  orders: FactoryOrder[];
  selectedOrder: FactoryOrder | null;
  chefs: Chef[];
  products: Product[];
  departments: { _id: string; displayName: string }[];
  isAssignModalOpen: boolean;
  isCreateModalOpen: boolean;
  assignFormData: AssignChefsForm;
  createFormData: { notes: string; items: { productId: string; quantity: number; assignedTo?: string }[] };
  filterStatus: string;
  filterDepartment: string;
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

const initialState: State = {
  orders: [],
  selectedOrder: null,
  chefs: [],
  products: [],
  departments: [],
  isAssignModalOpen: false,
  isCreateModalOpen: false,
  assignFormData: { items: [] },
  createFormData: { notes: '', items: [{ productId: '', quantity: 1 }] },
  filterStatus: '',
  filterDepartment: '',
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

const reducer = (state: State, action: any): State => {
  switch (action.type) {
    case 'SET_ORDERS':
      return { ...state, orders: action.payload || [], error: '', currentPage: 1 };
    case 'ADD_ORDER':
      return { ...state, orders: [action.payload, ...state.orders.filter((o) => o.id !== action.payload.id)] };
    case 'SET_SELECTED_ORDER':
      return { ...state, selectedOrder: action.payload };
    case 'SET_CHEFS':
      return { ...state, chefs: action.payload || [] };
    case 'SET_PRODUCT':
      return { ...state, products: action.payload || [] };
    case 'SET_DEPARTMENTS':
      return { ...state, departments: action.payload || [] };
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
    case 'SET_FILTER_DEPARTMENT':
      return { ...state, filterDepartment: action.payload, currentPage: 1 };
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
        orders: state.orders.map((o) =>
          o.id === action.orderId ? { ...o, status: action.status! } : o
        ),
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
                  state.selectedOrder.items.every((i) => i.status === 'completed') &&
                  state.selectedOrder.status !== 'completed'
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
                              _id: assignment.assignedTo._id,
                              username: assignment.assignedTo.username,
                              name: assignment.assignedTo.name,
                              nameEn: assignment.assignedTo.nameEn,
                              displayName: state.isRtl
                                ? assignment.assignedTo.name
                                : assignment.assignedTo.nameEn || assignment.assignedTo.name,
                              department: assignment.assignedTo.department,
                            }
                          : undefined,
                        status: assignment.status || i.status,
                      }
                    : i
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
                              _id: assignment.assignedTo._id,
                              username: assignment.assignedTo.username,
                              name: assignment.assignedTo.name,
                              nameEn: assignment.assignedTo.nameEn,
                              displayName: state.isRtl
                                ? assignment.assignedTo.name
                                : assignment.assignedTo.nameEn || assignment.assignedTo.name,
                              department: assignment.assignedTo.department,
                            }
                          : undefined,
                        status: assignment.status || i.status,
                      }
                    : i
                }),
                status: state.selectedOrder.items.every((i) => i.status === 'assigned')
                  ? 'in_production'
                  : state.selectedOrder.status,
              }
            : state.selectedOrder,
      };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload, currentPage: 1 };
    default:
      return state;
  }
};

const ORDERS_PER_PAGE = { card: 12, table: 50 };

const validTransitions: Record<FactoryOrder['status'], FactoryOrder['status'][]> = {
  requested: ['approved', 'cancelled'],
  pending: ['approved', 'cancelled'],
  approved: ['in_production', 'cancelled'],
  in_production: ['completed', 'cancelled'],
  completed: ['stocked'],
  stocked: [],
  cancelled: [],
};

const statusOptions = [
  { value: '', label: 'all_statuses' },
  { value: 'requested', label: 'requested' },
  { value: 'pending', label: 'pending' },
  { value: 'approved', label: 'approved' },
  { value: 'in_production', label: 'in_production' },
  { value: 'completed', label: 'completed' },
  { value: 'stocked', label: 'stocked' },
  { value: 'cancelled', label: 'cancelled' },
];

const sortOptions = [
  { value: 'date', label: 'sort_date' },
  { value: 'totalQuantity', label: 'sort_total_quantity' },
];

const translateUnit = (unit: string, isRtl: boolean): string => {
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

  const calculateTotalQuantity = useCallback((order: FactoryOrder): number => {
    return order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }, []);

  const fetchData = useCallback(
    async (retryCount = 0) => {
      if (!user || !['chef', 'production', 'admin'].includes(user.role)) {
        dispatch({ type: 'SET_ERROR', payload: isRtl ? 'غير مصرح للوصول' : 'Unauthorized access' });
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const query: Record<string, any> = {
          sortBy: state.sortBy,
          sortOrder: state.sortOrder,
          search: state.debouncedSearchQuery || undefined,
          lang: language,
        };

        if (state.filterStatus) query.status = state.filterStatus;
        if (state.filterDepartment) query.department = state.filterDepartment;

        const [ordersResponse, chefsResponse, departmentsResponse] = await Promise.all([
          factoryOrdersAPI.getAll(query),
          chefsAPI.getAll({ lang: language }),
          departmentAPI.getAll({ lang: language }),
        ]);

        let allProducts: Product[] = [];
        let page = 1;
        let totalPages = 1;
        do {
          const productsResponse = await productsAPI.getAll({ lang: language, page, limit: 50 });
          allProducts = [...allProducts, ...productsResponse.data];
          totalPages = productsResponse.totalPages;
          page++;
        } while (page <= totalPages);

        const departmentMap = new Map(departmentsResponse.data.map((d: any) => [d._id, d]));

        const ordersData = Array.isArray(ordersResponse.data) ? ordersResponse.data : [];
        const mappedOrders: FactoryOrder[] = ordersData
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
                  displayProductName: item.product?.displayName || (isRtl ? item.product?.name : item.product?.nameEn || item.product?.name),
                  quantity: Number(item.quantity) || 1,
                  unit: item.product?.unit || 'unit',
                  unitEn: item.product?.unitEn,
                  displayUnit: translateUnit(item.product?.unit || 'unit', isRtl),
                  department: (typeof item.product?.department === 'string'
                    ? (departmentMap.get(item.product.department) || { _id: item.product.department, name: isRtl ? 'غير معروف' : 'Unknown', nameEn: isRtl ? 'غير معروف' : 'Unknown', displayName: isRtl ? 'غير معروف' : 'Unknown' })
                    : item.product?.department || { _id: 'no-department', name: isRtl ? 'غير معروف' : 'Unknown', nameEn: isRtl ? 'غير معروف' : 'Unknown', displayName: isRtl ? 'غير معروف' : 'Unknown' }),
                  assignedTo: item.assignedTo
                    ? {
                        _id: item.assignedTo._id,
                        username: item.assignedTo.username,
                        name: item.assignedTo.name || (isRtl ? 'غير معروف' : 'Unknown'),
                        nameEn: item.assignedTo.nameEn,
                        displayName: item.assignedTo.displayName || (isRtl ? item.assignedTo.name : item.assignedTo.nameEn || item.assignedTo.name),
                        department: (typeof item.assignedTo.department === 'string'
                          ? (departmentMap.get(item.assignedTo.department) || { _id: item.assignedTo.department, name: isRtl ? 'غير معروف' : 'Unknown', nameEn: isRtl ? 'غير معروف' : 'Unknown', displayName: isRtl ? 'غير معروف' : 'Unknown' })
                          : item.assignedTo.department || { _id: 'no-department', name: isRtl ? 'غير معروف' : 'Unknown', nameEn: isRtl ? 'غير معروف' : 'Unknown', displayName: isRtl ? 'غير معروف' : 'Unknown' }),
                      }
                    : undefined,
                  status: item.status || 'pending',
                }))
              : [],
            status: order.status || (order.createdBy?.role === 'chef' ? 'requested' : 'approved'),
            date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
            notes: order.notes || '',
            priority: order.priority || 'medium',
            createdBy: order.createdBy?.displayName || (isRtl ? 'غير معروف' : 'Unknown'),
            createdByRole: order.createdBy?.role || 'unknown',
            inventoryProcessed: order.inventoryProcessed || false,
          }));
        dispatch({ type: 'SET_ORDERS', payload: mappedOrders });
        dispatch({
          type: 'SET_CHEFS',
          payload: Array.isArray(chefsResponse.data)
            ? chefsResponse.data
                .filter((chef: any) => chef && chef.user?._id)
                .map((chef: any) => ({
                  _id: chef._id,
                  userId: chef.user._id,
                  name: chef.user?.name || chef.name || (isRtl ? 'غير معروف' : 'Unknown'),
                  nameEn: chef.user?.nameEn || chef.nameEn,
                  displayName: chef.user?.displayName || (isRtl ? chef.user?.name || chef.name : chef.user?.nameEn || chef.nameEn || chef.user?.name || chef.name),
                  department: (typeof chef.department === 'string'
                    ? (departmentMap.get(chef.department) || { _id: chef.department, name: isRtl ? 'غير معروف' : 'Unknown', nameEn: isRtl ? 'غير معروف' : 'Unknown', displayName: isRtl ? 'غير معروف' : 'Unknown' })
                    : chef.department || { _id: 'no-department', name: isRtl ? 'غير معروف' : 'Unknown', nameEn: isRtl ? 'غير معروف' : 'Unknown', displayName: isRtl ? 'غير معروف' : 'Unknown' }),
                  status: chef.status || 'active',
                }))
            : [],
        });
        dispatch({
          type: 'SET_PRODUCT',
          payload: Array.isArray(allProducts)
            ? allProducts
                .filter((product: any) => product && product._id)
                .map((product: any) => ({
                  _id: product._id,
                  name: product.name || (isRtl ? 'غير معروف' : 'Unknown'),
                  nameEn: product.nameEn,
                  displayName: product.displayName || (isRtl ? product.name : product.nameEn || product.name),
                  unit: product.unit || 'unit',
                  unitEn: product.unitEn,
                  displayUnit: translateUnit(product.unit || 'unit', isRtl),
                  department: (typeof product.department === 'string'
                    ? (departmentMap.get(product.department) || { _id: product.department, name: isRtl ? 'غير معروف' : 'Unknown', nameEn: isRtl ? 'غير معروف' : 'Unknown', displayName: isRtl ? 'غير معروف' : 'Unknown' })
                    : product.department || { _id: 'no-department', name: isRtl ? 'غير معروف' : 'Unknown', nameEn: isRtl ? 'غير معروف' : 'Unknown', displayName: isRtl ? 'غير معروف' : 'Unknown' }),
                  maxStockLevel: product.maxStockLevel || 1000,
                }))
                .sort((a: Product, b: Product) => {
                  const nameA = isRtl ? a.displayName : a.nameEn || a.name;
                  const nameB = isRtl ? b.displayName : b.nameEn || b.name;
                  return nameA.localeCompare(nameB, language);
                })
            : [],
        });
        dispatch({
          type: 'SET_DEPARTMENTS',
          payload: Array.isArray(departmentsResponse.data)
            ? departmentsResponse.data.map((d: any) => ({
                _id: d._id,
                displayName: d.displayName || (isRtl ? d.name : d.nameEn || d.name),
              }))
            : [],
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
    [user, state.sortBy, state.sortOrder, state.debouncedSearchQuery, state.filterStatus, state.filterDepartment, isRtl, language]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!user || !['chef', 'production', 'admin'].includes(user.role) || !socket) {
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
              displayProductName: item.product?.displayName || (isRtl ? item.product?.name : item.product?.nameEn || item.product?.name),
              quantity: Number(item.quantity) || 1,
              unit: item.product?.unit || 'unit',
              unitEn: item.product?.unitEn,
              displayUnit: translateUnit(item.product?.unit || 'unit', isRtl),
              department: {
                _id: item.product?.department?._id || 'no-department',
                name: item.product?.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                nameEn: item.product?.department?.nameEn,
                displayName: item.product?.department?.displayName || (isRtl ? item.product?.department?.name : item.product?.department?.nameEn || item.product?.department?.name),
              },
              assignedTo: item.assignedTo
                ? {
                    _id: item.assignedTo._id,
                    username: item.assignedTo.username,
                    name: item.assignedTo.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: item.assignedTo.nameEn,
                    displayName: item.assignedTo.displayName || (isRtl ? item.assignedTo.name : item.assignedTo.nameEn || item.assignedTo.name),
                    department: {
                      _id: item.assignedTo.department?._id || 'no-department',
                      name: item.assignedTo.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                      nameEn: item.assignedTo.department?.nameEn,
                      displayName: item.assignedTo.department?.displayName || (isRtl ? item.assignedTo.department?.name : item.assignedTo.department?.nameEn || item.assignedTo.department?.name),
                    },
                  }
                : undefined,
              status: item.status || 'pending',
            }))
          : [],
        status: order.status || (order.createdBy?.role === 'chef' ? 'requested' : 'approved'),
        date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
        notes: order.notes || '',
        priority: order.priority || 'medium',
        createdBy: order.createdBy?.displayName || (isRtl ? 'غير معروف' : 'Unknown'),
        createdByRole: order.createdBy?.role || 'unknown',
        inventoryProcessed: order.inventoryProcessed || false,
      };
      dispatch({ type: 'ADD_ORDER', payload: mappedOrder });
      playNotificationSound('/sounds/notification.mp3', [200, 100, 200]);
      toast.success(isRtl ? `طلب إنتاج جديد: ${order.orderNumber}` : `New production order: ${order.orderNumber}`, {
        position: isRtl ? 'top-left' : 'top-right',
      });
    });

    socket.on('orderStatusUpdated', ({ orderId, status }: { orderId: string; status: FactoryOrder['status'] }) => {
      if (!orderId || !status) {
        console.warn('Invalid order status update data:', { orderId, status });
        return;
      }
      dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status });
      toast.info(isRtl ? `تم تحديث حالة الطلب ${orderId} إلى ${status}` : `Order ${orderId} status updated to ${status}`, {
        position: isRtl ? 'top-left' : 'top-right',
      });
    });

    socket.on('itemStatusUpdated', ({ orderId, itemId, status }: { orderId: string; itemId: string; status: FactoryOrderItem['status'] }) => {
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

  const validateCreateForm = useCallback(() => {
    const errors: Record<string, string> = {};
    const t = isRtl
      ? {
          productRequired: 'المنتج مطلوب',
          quantityRequired: 'الكمية مطلوبة',
          quantityInvalid: 'الكمية يجب أن تكون أكبر من 0',
          chefRequired: 'الشيف مطلوب',
        }
      : {
          productRequired: 'Product is required',
          quantityRequired: 'Quantity is required',
          quantityInvalid: 'Quantity must be greater than 0',
          chefRequired: 'Chef is required',
        };

    state.createFormData.items.forEach((item, index) => {
      if (!item.productId) {
        errors[`item_${index}_productId`] = t.productRequired;
      }
      if (!item.quantity || item.quantity < 1) {
        errors[`item_${index}_quantity`] = item.quantity === 0 ? t.quantityRequired : t.quantityInvalid;
      }
      if (['admin', 'production'].includes(user?.role) && !item.assignedTo) {
        errors[`item_${index}_assignedTo`] = t.chefRequired;
      }
    });

    dispatch({ type: 'SET_FORM_ERRORS', payload: errors });
    return Object.keys(errors).length === 0;
  }, [state.createFormData.items, user?.role, isRtl]);

  const handleCreateOrder = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validateCreateForm()) {
        toast.error(isRtl ? 'يرجى تصحيح الأخطاء في النموذج' : 'Please fix form errors', {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }

      dispatch({ type: 'SET_SUBMITTING', payload: 'create' });
      try {
        const orderNumber = `FO-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const data = {
          orderNumber,
          items: state.createFormData.items.map((item) => ({
            product: item.productId,
            quantity: item.quantity,
            assignedTo: item.assignedTo || undefined,
          })),
          notes: state.createFormData.notes.trim(),
          priority: 'medium',
        };

        await factoryOrdersAPI.create(data);
        dispatch({ type: 'SET_CREATE_MODAL', isOpen: false });
        dispatch({
          type: 'SET_CREATE_FORM',
          payload: { notes: '', items: [{ productId: '', quantity: 1 }] },
        });
        dispatch({ type: 'SET_FORM_ERRORS', payload: {} });
        toast.success(isRtl ? 'تم إنشاء الطلب بنجاح' : 'Order created successfully', {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error('Create order error:', err.message);
        const errorMessage = isRtl ? `خطأ في إنشاء الطلب: ${err.message}` : `Error creating order: ${err.message}`;
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right' });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [state.createFormData, isRtl, validateCreateForm]
  );

  const handleApproveOrder = useCallback(
    async (orderId: string) => {
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        await factoryOrdersAPI.approve(orderId);
        dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status: 'approved' });
        toast.success(isRtl ? 'تمت الموافقة على الطلب' : 'Order approved successfully', {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error('Approve order error:', err.message);
        const errorMessage = isRtl ? `خطأ في الموافقة على الطلب: ${err.message}` : `Error approving order: ${err.message}`;
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right' });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [isRtl]
  );

  const handleUpdateOrderStatus = useCallback(
    async (orderId: string, status: FactoryOrder['status']) => {
      if (!validTransitions[state.orders.find((o) => o.id === orderId)?.status || 'requested'].includes(status)) {
        toast.error(isRtl ? 'انتقال الحالة غير صالح' : 'Invalid status transition', {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }

      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        await factoryOrdersAPI.updateStatus(orderId, { status });
        dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status });
        toast.success(isRtl ? `تم تحديث حالة الطلب إلى ${status}` : `Order status updated to ${status}`, {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error('Update order status error:', err.message);
        const errorMessage = isRtl ? `خطأ في تحديث حالة الطلب: ${err.message}` : `Error updating order status: ${err.message}`;
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right' });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [isRtl, state.orders]
  );

  const handleConfirmItemCompletion = useCallback(
    async (orderId: string, itemId: string) => {
      dispatch({ type: 'SET_SUBMITTING', payload: itemId });
      try {
        await factoryOrdersAPI.updateItemStatus(orderId, itemId, { status: 'completed' });
        dispatch({ type: 'UPDATE_ITEM_STATUS', orderId, payload: { itemId, status: 'completed' } });
        toast.success(isRtl ? 'تم إكمال العنصر' : 'Item completed successfully', {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error('Confirm item completion error:', err.message);
        const errorMessage = isRtl ? `خطأ في إكمال العنصر: ${err.message}` : `Error completing item: ${err.message}`;
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right' });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [isRtl]
  );

  const handleAssignChefs = useCallback(
    async (orderId: string) => {
      const errors: Record<string, string> = {};
      state.assignFormData.items.forEach((item, index) => {
        if (!item.assignedTo) {
          errors[`item_${index}_assignedTo`] = isRtl ? 'الشيف مطلوب' : 'Chef is required';
        }
      });

      if (Object.keys(errors).length > 0) {
        dispatch({ type: 'SET_FORM_ERRORS', payload: errors });
        toast.error(isRtl ? 'يرجى تعيين شيف لجميع العناصر' : 'Please assign a chef to all items', {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }

      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        await factoryOrdersAPI.assignChefs(orderId, {
          items: state.assignFormData.items.map((item) => ({
            itemId: item.itemId,
            assignedTo: item.assignedTo,
          })),
        });
        dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: false });
        dispatch({ type: 'SET_ASSIGN_FORM', payload: { items: [] } });
        dispatch({ type: 'SET_FORM_ERRORS', payload: {} });
        toast.success(isRtl ? 'تم تعيين الشيفات بنجاح' : 'Chefs assigned successfully', {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error('Assign chefs error:', err.message);
        const errorMessage = isRtl ? `خطأ في تعيين الشيفات: ${err.message}` : `Error assigning chefs: ${err.message}`;
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right' });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [state.assignFormData, isRtl]
  );

  const handleConfirmFactoryProduction = useCallback(
    async (orderId: string) => {
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        await factoryOrdersAPI.confirmProduction(orderId);
        dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status: 'stocked' });
        toast.success(isRtl ? 'تم تأكيد الإضافة إلى المخزون' : 'Inventory addition confirmed', {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error('Confirm production error:', err.message);
        const errorMessage = isRtl ? `خطأ في تأكيد الإنتاج: ${err.message}` : `Error confirming production: ${err.message}`;
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right' });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [isRtl]
  );

  const handleOpenAssignModal = useCallback((order: FactoryOrder) => {
    dispatch({ type: 'SET_SELECTED_ORDER', payload: order });
    dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: true });
  }, []);

  const filteredOrders = useMemo(() => {
    let result = [...state.orders];

    if (state.filterStatus) {
      result = result.filter((order) => order.status === state.filterStatus);
    }

    if (state.filterDepartment) {
      result = result.filter((order) =>
        order.items.some((item) => item.department._id === state.filterDepartment)
      );
    }

    if (state.debouncedSearchQuery) {
      const query = normalizeText(state.debouncedSearchQuery);
      result = result.filter((order) =>
        normalizeText(order.orderNumber).includes(query) ||
        order.items.some((item) => normalizeText(item.displayProductName).includes(query))
      );
    }

    if (user?.role === 'chef') {
      result = result.filter((order) =>
        order.items.some((item) => item.assignedTo?._id === user.id)
      );
    }

    result.sort((a, b) => {
      const multiplier = state.sortOrder === 'asc' ? 1 : -1;
      if (state.sortBy === 'date') {
        return multiplier * (new Date(a.date).getTime() - new Date(b.date).getTime());
      } else {
        return multiplier * (calculateTotalQuantity(a) - calculateTotalQuantity(b));
      }
    });

    return result;
  }, [
    state.orders,
    state.filterStatus,
    state.filterDepartment,
    state.debouncedSearchQuery,
    state.sortBy,
    state.sortOrder,
    user?.role,
    user?.id,
    calculateTotalQuantity,
  ]);

  const paginatedOrders = useMemo(() => {
    const startIndex = (state.currentPage - 1) * ORDERS_PER_PAGE[state.viewMode];
    return filteredOrders.slice(startIndex, startIndex + ORDERS_PER_PAGE[state.viewMode]);
  }, [filteredOrders, state.currentPage, state.viewMode]);

  const totalPages = Math.ceil(filteredOrders.length / ORDERS_PER_PAGE[state.viewMode]);

  const handleAddItem = useCallback(() => {
    dispatch({
      type: 'SET_CREATE_FORM',
      payload: {
        ...state.createFormData,
        items: [...state.createFormData.items, { productId: '', quantity: 1 }],
      },
    });
  }, [state.createFormData]);

  const handleRemoveItem = useCallback(
    (index: number) => {
      dispatch({
        type: 'SET_CREATE_FORM',
        payload: {
          ...state.createFormData,
          items: state.createFormData.items.filter((_, i) => i !== index),
        },
      });
      const newErrors = { ...state.formErrors };
      Object.keys(newErrors).forEach((key) => {
        if (key.startsWith(`item_${index}_`)) {
          delete newErrors[key];
        }
      });
      dispatch({ type: 'SET_FORM_ERRORS', payload: newErrors });
    },
    [state.createFormData, state.formErrors]
  );

  const handleUpdateItem = useCallback(
    (index: number, field: 'productId' | 'quantity' | 'assignedTo', value: string | number) => {
      const newItems = [...state.createFormData.items];
      newItems[index] = { ...newItems[index], [field]: value };
      dispatch({ type: 'SET_CREATE_FORM', payload: { ...state.createFormData, items: newItems } });

      const newErrors = { ...state.formErrors };
      delete newErrors[`item_${index}_${field}`];
      dispatch({ type: 'SET_FORM_ERRORS', payload: newErrors });
    },
    [state.createFormData, state.formErrors]
  );

  const departmentOptions = useMemo(
    () => [
      { value: '', label: isRtl ? 'جميع الأقسام' : 'All Departments' },
      ...state.departments.map((dept) => ({
        value: dept._id,
        label: dept.displayName,
      })),
    ],
    [state.departments, isRtl]
  );

  const translations = {
    ar: {
      title: 'طلبات الإنتاج',
      createOrder: 'إنشاء طلب جديد',
      searchPlaceholder: 'ابحث حسب رقم الطلب أو المنتج',
      status: 'الحالة',
      department: 'القسم',
      sortBy: 'ترتيب حسب',
      sortOrder: 'ترتيب',
      ascending: 'تصاعدي',
      ascendingShort: '↑',
      descending: 'تنازلي',
      descendingShort: '↓',
      viewMode: 'وضع العرض',
      cardView: 'عرض البطاقات',
      tableView: 'عرض الجدول',
      noOrders: 'لا توجد طلبات متاحة',
      loading: 'جارٍ التحميل...',
      error: 'حدث خطأ أثناء جلب البيانات',
      createOrderTitle: 'إنشاء طلب إنتاج جديد',
      notes: 'ملاحظات',
      addItem: 'إضافة عنصر',
      submit: 'إنشاء الطلب',
      cancel: 'إلغاء',
      items: 'العناصر',
      selectProduct: 'اختر منتج',
      quantity: 'الكمية',
      assignChef: 'تعيين شيف',
      selectChef: 'اختر شيف',
    },
    en: {
      title: 'Production Orders',
      createOrder: 'Create New Order',
      searchPlaceholder: 'Search by order number or product',
      status: 'Status',
      department: 'Department',
      sortBy: 'Sort By',
      sortOrder: 'Sort Order',
      ascending: 'Ascending',
      ascendingShort: '↑',
      descending: 'Descending',
      descendingShort: '↓',
      viewMode: 'View Mode',
      cardView: 'Card View',
      tableView: 'Table View',
      noOrders: 'No orders available',
      loading: 'Loading...',
      error: 'An error occurred while fetching data',
      createOrderTitle: 'Create New Production Order',
      notes: 'Notes',
      addItem: 'Add Item',
      submit: 'Create Order',
      cancel: 'Cancel',
      items: 'Items',
      selectProduct: 'Select Product',
      quantity: 'Quantity',
      assignChef: 'Assign Chef',
      selectChef: 'Select Chef',
    },
  };


  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-gray-800">{t.title}</h1>
        <Button
          variant="primary"
          onClick={() => dispatch({ type: 'SET_CREATE_MODAL', isOpen: true })}
          className="bg-amber-500 hover:bg-amber-600 text-white rounded-md px-4 py-2 text-sm shadow-sm"
        >
          <PlusCircle className="w-4 h-4 mr-2" />
          {t.createOrder}
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <ProductSearchInput
            value={searchInput}
            onChange={(value) => setSearchInput(value)}
            placeholder={t.searchPlaceholder}
            className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
          />
        </div>
        <div className="flex gap-4">
          <Select
            options={statusOptions.map((opt) => ({
              value: opt.value,
              label: t[opt.label as keyof typeof t] || opt.label,
            }))}
            value={state.filterStatus}
            onChange={(value) => dispatch({ type: 'SET_FILTER_STATUS', payload: value })}
            className="w-40 rounded-md border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
            aria-label={t.status}
          />
          <Select
            options={departmentOptions}
            value={state.filterDepartment}
            onChange={(value) => dispatch({ type: 'SET_FILTER_DEPARTMENT', payload: value })}
            className="w-40 rounded-md border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
            aria-label={t.department}
          />
          <Select
            options={sortOptions.map((opt) => ({
              value: opt.value,
              label: t[opt.label as keyof typeof t] || opt.label,
            }))}
            value={state.sortBy}
            onChange={(value) => dispatch({ type: 'SET_SORT', by: value })}
            className="w-40 rounded-md border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
            aria-label={t.sortBy}
          />
          <Select
            options={[
              { value: 'asc', label: `${t.ascending} ${t.ascendingShort}` },
              { value: 'desc', label: `${t.descending} ${t.descendingShort}` },
            ]}
            value={state.sortOrder}
            onChange={(value) => dispatch({ type: 'SET_SORT', order: value })}
            className="w-32 rounded-md border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
            aria-label={t.sortOrder}
          />
          <Select
            options={[
              { value: 'card', label: t.cardView },
              { value: 'table', label: t.tableView },
            ]}
            value={state.viewMode}
            onChange={(value) => dispatch({ type: 'SET_VIEW_MODE', payload: value })}
            className="w-32 rounded-md border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
            aria-label={t.viewMode}
          />
        </div>
      </div>

      {state.error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm">{state.error}</span>
        </div>
      )}

      {state.loading ? (
        state.viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: ORDERS_PER_PAGE.card }).map((_, index) => (
              <OrderCardSkeleton key={index} />
            ))}
          </div>
        ) : (
          <OrderTableSkeleton />
        )
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-10">
          <ShoppingCart className="mx-auto w-12 h-12 text-gray-400" />
          <p className="mt-2 text-gray-600 text-sm">{t.noOrders}</p>
        </div>
      ) : (
        <>
          <div ref={listRef}>
            {state.viewMode === 'card' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                        updateOrderStatus={handleUpdateOrderStatus}
                        confirmItemCompletion={handleConfirmItemCompletion}
                        openAssignModal={handleOpenAssignModal}
                        confirmFactoryProduction={handleConfirmFactoryProduction}
                        submitting={state.submitting}
                        isRtl={isRtl}
                        currentUserRole={user?.role as UserRole}
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
                approveOrder={handleApproveOrder}
                updateOrderStatus={handleUpdateOrderStatus}
                confirmItemCompletion={handleConfirmItemCompletion}
                openAssignModal={handleOpenAssignModal}
                confirmFactoryProduction={handleConfirmFactoryProduction}
                submitting={state.submitting}
                isRtl={isRtl}
                startIndex={(state.currentPage - 1) * ORDERS_PER_PAGE.table + 1}
                currentUserRole={user?.role as UserRole}
              />
            )}
          </div>
          <Pagination
            currentPage={state.currentPage}
            totalPages={totalPages}
            onPageChange={(page) => dispatch({ type: 'SET_PAGE', payload: page })}
            isRtl={isRtl}
          />
        </>
      )}

      <AssignChefsModal
        isOpen={state.isAssignModalOpen}
        onClose={() => dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: false })}
        selectedOrder={state.selectedOrder}
        assignFormData={state.assignFormData}
        chefs={state.chefs}
        error={state.error}
        submitting={state.submitting}
        assignChefs={handleAssignChefs}
        setAssignForm={(formData) => dispatch({ type: 'SET_ASSIGN_FORM', payload: formData })}
        isRtl={isRtl}
        loading={state.loading}
      />

      <Modal
        isOpen={state.isCreateModalOpen}
        onClose={() => {
          dispatch({ type: 'SET_CREATE_MODAL', isOpen: false });
          dispatch({
            type: 'SET_CREATE_FORM',
            payload: { notes: '', items: [{ productId: '', quantity: 1 }] },
          });
          dispatch({ type: 'SET_FORM_ERRORS', payload: {} });
        }}
        title={t.createOrderTitle}
        size="lg"
      >
        <form onSubmit={handleCreateOrder} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium text-gray-900 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}>
              {t.notes}
            </label>
            <textarea
              value={state.createFormData.notes}
              onChange={(e) =>
                dispatch({
                  type: 'SET_CREATE_FORM',
                  payload: { ...state.createFormData, notes: e.target.value },
                })
              }
              className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
              rows={4}
              aria-label={t.notes}
            />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">{t.items}</h3>
            {state.createFormData.items.map((item, index) => {
              const product = state.products.find((p) => p._id === item.productId);
              const availableChefs = state.chefs.filter(
                (chef) =>
                  chef.department._id ===
                  (typeof product?.department === 'string' ? product.department : product?.department?._id || 'no-department')
              );

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-3 mb-4 p-4 bg-gray-50 rounded-md"
                >
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <label
                        className={`block text-xs font-medium text-gray-900 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}
                        htmlFor={`product-${index}`}
                      >
                        {t.selectProduct}
                      </label>
                      <ProductDropdown
                        products={state.products}
                        value={item.productId}
                        onChange={(value) => handleUpdateItem(index, 'productId', value)}
                        placeholder={t.selectProduct}
                        className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-xs shadow-sm"
                        isRtl={isRtl}
                      />
                      {state.formErrors[`item_${index}_productId`] && (
                        <p className="text-red-600 text-xs mt-1">{state.formErrors[`item_${index}_productId`]}</p>
                      )}
                    </div>
                    <div className="w-40">
                      <label
                        className={`block text-xs font-medium text-gray-900 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}
                        htmlFor={`quantity-${index}`}
                      >
                        {t.quantity}
                      </label>
                      <QuantityInput
                        value={item.quantity}
                        onChange={(value) => handleUpdateItem(index, 'quantity', parseInt(value) || 1)}
                        onIncrement={() => handleUpdateItem(index, 'quantity', item.quantity + 1)}
                        onDecrement={() => handleUpdateItem(index, 'quantity', Math.max(1, item.quantity - 1))}
                        max={product?.maxStockLevel}
                      />
                      {state.formErrors[`item_${index}_quantity`] && (
                        <p className="text-red-600 text-xs mt-1">{state.formErrors[`item_${index}_quantity`]}</p>
                      )}
                    </div>
                    {['admin', 'production'].includes(user?.role) && (
                      <div className="w-40">
                        <label
                          className={`block text-xs font-medium text-gray-900 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}
                          htmlFor={`chef-${index}`}
                        >
                          {t.assignChef}
                        </label>
                        <Select
                          id={`chef-${index}`}
                          options={[
                            { value: '', label: t.selectChef },
                            ...availableChefs.map((chef) => ({
                              value: chef.userId,
                              label: chef.displayName,
                            })),
                          ]}
                          value={item.assignedTo || ''}
                          onChange={(value) => handleUpdateItem(index, 'assignedTo', value)}
                          className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-xs shadow-sm"
                          aria-label={t.assignChef}
                          disabled={!product}
                        />
                        {state.formErrors[`item_${index}_assignedTo`] && (
                          <p className="text-red-600 text-xs mt-1">{state.formErrors[`item_${index}_assignedTo`]}</p>
                        )}
                      </div>
                    )}
                    {state.createFormData.items.length > 1 && (
                      <button
                        onClick={() => handleRemoveItem(index)}
                        className="text-red-600 hover:text-red-800 text-xs mt-6"
                        aria-label={isRtl ? 'إزالة العنصر' : 'Remove item'}
                      >
                        <MinusCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
            <Button
              variant="secondary"
              onClick={handleAddItem}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md px-3 py-1 text-xs shadow-sm"
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              {t.addItem}
            </Button>
          </div>
          <div className={`flex justify-end gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <Button
              variant="secondary"
              onClick={() => {
                dispatch({ type: 'SET_CREATE_MODAL', isOpen: false });
                dispatch({
                  type: 'SET_CREATE_FORM',
                  payload: { notes: '', items: [{ productId: '', quantity: 1 }] },
                });
                dispatch({ type: 'SET_FORM_ERRORS', payload: {} });
              }}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md px-3 py-1 text-xs shadow-sm"
            >
              {t.cancel}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={state.submitting === 'create'}
              className="bg-amber-500 hover:bg-amber-600 text-white rounded-md px-3 py-1 text-xs shadow-sm disabled:opacity-50"
            >
              {state.submitting === 'create' ? (isRtl ? 'جارٍ الإنشاء...' : 'Creating...') : t.submit}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default InventoryOrders;