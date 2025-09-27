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
      orders: state.orders.map(o => o.id === action.orderId ? { ...o, status: action.status!, ...(action.payload || {}) } : o),
      selectedOrder: state.selectedOrder && state.selectedOrder.id === action.orderId
        ? { ...state.selectedOrder, status: action.status!, ...(action.payload || {}) } : state.selectedOrder,
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
    case 'MISSING_ASSIGNMENTS': return {
      ...state,
      orders: state.orders.map(order =>
        order.id === action.orderId
          ? {
              ...order,
              items: order.items.map(item =>
                item._id === action.payload.itemId
                  ? { ...item, status: 'pending', assignedTo: undefined }
                  : item
              ),
            }
          : order
      ),
      selectedOrder: state.selectedOrder && state.selectedOrder.id === action.orderId
        ? {
            ...state.selectedOrder,
            items: state.selectedOrder.items.map(item =>
              item._id === action.payload.itemId
                ? { ...item, status: 'pending', assignedTo: undefined }
                : item
            ),
          }
        : state.selectedOrder,
    };
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
  const [state, dispatch] = useReducer(reducer, { ...initialState, isRtl });
  const stateRef = useRef(state);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { playNotificationSound } = useOrderNotifications(dispatch, stateRef, user, (notification) => {
    toast[notification.type](notification.message, {
      position: isRtl ? 'top-left' : 'top-right',
      autoClose: 3000,
    });
  });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const calculateTotalQuantity = useCallback((order: Order) => {
    return order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }, []);

  const calculateAdjustedTotal = useCallback((order: Order) => {
    return (order.adjustedTotal || order.totalAmount || 0).toLocaleString(language, {
      style: 'currency',
      currency: 'SAR',
    });
  }, [language]);

  const fetchData = useCallback(async (retryCount = 0) => {
    if (!user) {
      dispatch({ type: 'SET_ERROR', payload: t('errors.unauthorized') });
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const [ordersResponse, chefsResponse, branchesResponse] = await Promise.all([
        ordersAPI.getAll({ status: state.filterStatus, branch: state.filterBranch, search: state.searchQuery }),
        user.role === 'production' || user.role === 'admin' ? chefsAPI.getAll() : Promise.resolve([]),
        user.role === 'admin' ? branchesAPI.getAll() : Promise.resolve([]),
      ]);

      if (!Array.isArray(ordersResponse)) {
        throw new Error(t('errors.invalid_response'));
      }

      const orders: Order[] = ordersResponse.map((order: any) => ({
        id: order._id || crypto.randomUUID(),
        orderNumber: order.orderNumber || t('orders.unknown'),
        branchId: order.branch?._id || 'unknown',
        branch: {
          _id: order.branch?._id || 'unknown',
          name: order.branch?.name || t('branches.unknown'),
          nameEn: order.branch?.nameEn,
          displayName: isRtl ? order.branch?.name : (order.branch?.nameEn || order.branch?.name || t('branches.unknown')),
        },
        items: Array.isArray(order.items) ? order.items.map((item: any) => ({
          _id: item._id || crypto.randomUUID(),
          productId: item.product?._id || 'unknown',
          productName: item.product?.name || t('products.unknown'),
          productNameEn: item.product?.nameEn,
          displayProductName: isRtl ? item.product?.name : (item.product?.nameEn || item.product?.name || t('products.unknown')),
          quantity: Number(item.quantity) || 1,
          price: Number(item.price) || 0,
          unit: item.product?.unit || 'unit',
          unitEn: item.product?.unitEn,
          displayUnit: translateUnit(item.product?.unit || 'unit', isRtl),
          department: {
            _id: item.product?.department?._id || 'unknown',
            name: item.product?.department?.name || t('departments.unknown'),
            nameEn: item.product?.department?.nameEn,
            displayName: isRtl ? item.product?.department?.name : (item.product?.department?.nameEn || item.product?.department?.name || t('departments.unknown')),
          },
          assignedTo: item.assignedTo ? {
            _id: item.assignedTo._id,
            username: item.assignedTo.username,
            name: item.assignedTo.name || item.assignedTo.username || t('users.unknown'),
            nameEn: item.assignedTo.nameEn,
            displayName: isRtl ? item.assignedTo.name : (item.assignedTo.nameEn || item.assignedTo.name || t('users.unknown')),
            department: item.assignedTo.department,
          } : undefined,
          status: item.status || 'pending',
          returnedQuantity: Number(item.returnedQuantity) || 0,
          returnReason: item.returnReason || '',
        })) : [],
        returns: Array.isArray(order.returns) ? order.returns.map((ret: any) => ({
          returnId: ret._id || crypto.randomUUID(),
          returnNumber: ret.returnNumber || t('returns.unknown'),
          items: Array.isArray(ret.items) ? ret.items.map((item: any) => ({
            productId: item.product?._id || 'unknown',
            productName: item.product?.name || t('products.unknown'),
            productNameEn: item.product?.nameEn,
            quantity: Number(item.quantity) || 0,
            reason: item.reason || t('returns.unspecified'),
            unit: item.product?.unit || 'unit',
            unitEn: item.product?.unitEn,
            displayUnit: translateUnit(item.product?.unit || 'unit', isRtl),
          })) : [],
          status: ret.status || 'pending',
          reviewNotes: ret.notes || '',
          createdAt: formatDate(ret.createdAt ? new Date(ret.createdAt) : new Date(), language),
          createdBy: {
            _id: ret.createdBy?._id,
            username: ret.createdBy?.username,
            name: ret.createdBy?.name || t('users.unknown'),
            nameEn: ret.createdBy?.nameEn,
            displayName: isRtl ? ret.createdBy?.name : (ret.createdBy?.nameEn || ret.createdBy?.name || t('users.unknown')),
          },
        })) : [],
        status: order.status || 'pending',
        totalAmount: Number(order.totalAmount) || 0,
        adjustedTotal: Number(order.adjustedTotal) || Number(order.totalAmount) || 0,
        date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
        requestedDeliveryDate: order.requestedDeliveryDate ? new Date(order.requestedDeliveryDate) : undefined,
        notes: order.notes || '',
        priority: order.priority || 'medium',
        createdBy: order.createdBy?.name || t('users.unknown'),
        approvedBy: order.approvedBy ? { _id: order.approvedBy._id, name: order.approvedBy.name || t('users.unknown') } : undefined,
        approvedAt: order.approvedAt ? new Date(order.approvedAt) : undefined,
        deliveredAt: order.deliveredAt ? new Date(order.deliveredAt) : undefined,
        transitStartedAt: order.transitStartedAt ? new Date(order.transitStartedAt) : undefined,
        statusHistory: Array.isArray(order.statusHistory) ? order.statusHistory.map((history: any) => ({
          status: history.status || 'pending',
          changedBy: history.changedBy?.name || t('users.unknown'),
          changedAt: formatDate(history.changedAt ? new Date(history.changedAt) : new Date(), language),
          notes: history.notes || '',
        })) : [],
      }));

      const chefs: Chef[] = Array.isArray(chefsResponse) ? chefsResponse.map((chef: any) => ({
        userId: chef._id || crypto.randomUUID(),
        username: chef.username || t('users.unknown'),
        name: chef.name || t('users.unknown'),
        nameEn: chef.nameEn,
        displayName: isRtl ? chef.name : (chef.nameEn || chef.name || t('users.unknown')),
        department: chef.department ? {
          _id: chef.department._id || 'unknown',
          name: chef.department.name || t('departments.unknown'),
          nameEn: chef.department.nameEn,
          displayName: isRtl ? chef.department.name : (chef.department.nameEn || chef.department.name || t('departments.unknown')),
        } : undefined,
      })) : [];

      const branches: Branch[] = Array.isArray(branchesResponse) ? branchesResponse.map((branch: any) => ({
        _id: branch._id || 'unknown',
        name: branch.name || t('branches.unknown'),
        nameEn: branch.nameEn,
        displayName: isRtl ? branch.name : (branch.nameEn || branch.name || t('branches.unknown')),
      })) : [];

      dispatch({ type: 'SET_ORDERS', payload: orders });
      dispatch({ type: 'SET_CHEFS', payload: chefs });
      dispatch({ type: 'SET_BRANCHES', payload: branches });
      dispatch({ type: 'SET_ERROR', payload: '' });
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Fetch error:`, error);
      if (retryCount < 3) {
        setTimeout(() => fetchData(retryCount + 1), (retryCount + 1) * 1000);
      } else {
        dispatch({ type: 'SET_ERROR', payload: t('errors.fetch_failed', { message: error.message }) });
        toast.error(t('errors.fetch_failed', { message: error.message }), {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [user, state.filterStatus, state.filterBranch, state.searchQuery, isRtl, t]);

  const debouncedFetchData = useMemo(() => debounce(fetchData, 300), [fetchData]);

  useEffect(() => {
    debouncedFetchData();
    return () => debouncedFetchData.cancel();
  }, [debouncedFetchData]);

  useEffect(() => {
    if (!socket) return;

    socket.on('connect', () => {
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: true });
      dispatch({ type: 'SET_SOCKET_ERROR', payload: null });
    });

    socket.on('connect_error', (err) => {
      console.error(`[${new Date().toISOString()}] Socket connect error:`, err.message);
      dispatch({ type: 'SET_SOCKET_ERROR', payload: t('errors.socket_connection_failed') });
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: false });
    });

    socket.on('reconnect', (attempt) => {
      console.log(`[${new Date().toISOString()}] Socket reconnected after ${attempt} attempts`);
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: true });
      dispatch({ type: 'SET_SOCKET_ERROR', payload: null });
    });

    socket.on('disconnect', (reason) => {
      console.log(`[${new Date().toISOString()}] Socket disconnected: ${reason}`);
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: false });
      dispatch({ type: 'SET_SOCKET_ERROR', payload: t('errors.socket_disconnected') });
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
        branch: {
          _id: order.branch?._id || 'unknown',
          name: order.branch?.name || t('branches.unknown'),
          nameEn: order.branch?.nameEn,
          displayName: isRtl ? order.branch?.name : (order.branch?.nameEn || order.branch?.name || t('branches.unknown')),
        },
        items: Array.isArray(order.items)
          ? order.items.map((item: any) => ({
              _id: item._id || crypto.randomUUID(),
              productId: item.product?._id || 'unknown',
              productName: item.product?.name || t('products.unknown'),
              productNameEn: item.product?.nameEn,
              displayProductName: isRtl ? item.product?.name : (item.product?.nameEn || item.product?.name || t('products.unknown')),
              quantity: Number(item.quantity) || 1,
              price: Number(item.price) || 0,
              unit: item.product?.unit || 'unit',
              unitEn: item.product?.unitEn,
              displayUnit: translateUnit(item.product?.unit || 'unit', isRtl),
              department: {
                _id: item.product?.department?._id || 'unknown',
                name: item.product?.department?.name || t('departments.unknown'),
                nameEn: item.product?.department?.nameEn,
                displayName: isRtl ? item.product?.department?.name : (item.product?.department?.nameEn || item.product?.department?.name || t('departments.unknown')),
              },
              assignedTo: item.assignedTo ? {
                _id: item.assignedTo._id,
                username: item.assignedTo.username,
                name: item.assignedTo.name || item.assignedTo.username || t('users.unknown'),
                nameEn: item.assignedTo.nameEn,
                displayName: isRtl ? item.assignedTo.name : (item.assignedTo.nameEn || item.assignedTo.name || t('users.unknown')),
                department: item.assignedTo.department,
              } : undefined,
              status: item.status || 'pending',
              returnedQuantity: Number(item.returnedQuantity) || 0,
              returnReason: item.returnReason || '',
            }))
          : [],
        returns: Array.isArray(order.returns)
          ? order.returns.map((ret: any) => ({
              returnId: ret._id || crypto.randomUUID(),
              returnNumber: ret.returnNumber || t('returns.unknown'),
              items: Array.isArray(ret.items)
                ? ret.items.map((item: any) => ({
                    productId: item.product?._id || 'unknown',
                    productName: item.product?.name || t('products.unknown'),
                    productNameEn: item.product?.nameEn,
                    quantity: Number(item.quantity) || 0,
                    reason: item.reason || t('returns.unspecified'),
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
                name: ret.createdBy?.name || t('users.unknown'),
                nameEn: ret.createdBy?.nameEn,
                displayName: isRtl ? ret.createdBy?.name : (ret.createdBy?.nameEn || ret.createdBy?.name || t('users.unknown')),
              },
            }))
          : [],
        status: order.status || 'pending',
        totalAmount: Number(order.totalAmount) || 0,
        adjustedTotal: Number(order.adjustedTotal) || Number(order.totalAmount) || 0,
        date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
        requestedDeliveryDate: order.requestedDeliveryDate ? new Date(order.requestedDeliveryDate) : undefined,
        notes: order.notes || '',
        priority: order.priority || 'medium',
        createdBy: order.createdBy?.name || t('users.unknown'),
        approvedBy: order.approvedBy ? { _id: order.approvedBy._id, name: order.approvedBy.name || t('users.unknown') } : undefined,
        approvedAt: order.approvedAt ? new Date(order.approvedAt) : undefined,
        deliveredAt: order.deliveredAt ? new Date(order.deliveredAt) : undefined,
        transitStartedAt: order.transitStartedAt ? new Date(order.transitStartedAt) : undefined,
        statusHistory: Array.isArray(order.statusHistory)
          ? order.statusHistory.map((history: any) => ({
              status: history.status || 'pending',
              changedBy: history.changedBy?.name || t('users.unknown'),
              changedAt: formatDate(history.changedAt ? new Date(history.changedAt) : new Date(), language),
              notes: history.notes || '',
            }))
          : [],
      };
      dispatch({ type: 'ADD_ORDER', payload: mappedOrder });
      playNotificationSound('/sounds/new-order.mp3', [200, 100, 200]);
      toast.success(t('notifications.new_order', { orderNumber: mappedOrder.orderNumber }), {
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
      toast.info(t('notifications.order_status_updated', { status: t(`order_status.${status}`) }), {
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
      toast.info(t('notifications.item_status_updated', { status: t(`item_status.${status}`) }), {
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
      toast.info(t('notifications.return_status_updated', { status: t(`return_status.${status}`) }), {
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
      toast.success(t('notifications.chefs_assigned'), {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    });

    socket.on('missingAssignments', ({ orderId, itemId }: { orderId: string; itemId: string }) => {
      if (!orderId || !itemId) {
        console.warn('Invalid missing assignments data:', { orderId, itemId });
        return;
      }
      dispatch({ type: 'MISSING_ASSIGNMENTS', orderId, payload: { itemId } });
      toast.warn(t('notifications.missing_assignments'), {
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
      socket.off('missingAssignments');
    };
  }, [socket, isRtl, t, playNotificationSound]);

  const handleStatusChange = useCallback(async (orderId: string, newStatus: OrderStatus) => {
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
      await ordersAPI.updateStatus(orderId, newStatus);
      dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status: newStatus });
      toast.success(t('orders.status_updated', { status: t(`order_status.${newStatus}`) }), {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
      if (socket && isConnected) {
        emit('orderStatusUpdated', { orderId, status: newStatus });
      }
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Status update error:`, error);
      toast.error(t('errors.status_update_failed', { message: error.message }), {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    } finally {
      dispatch({ type: 'SET_SUBMITTING', payload: null });
    }
  }, [state.orders, t, isRtl, socket, isConnected, emit]);

  const handleItemStatusChange = useCallback(async (orderId: string, itemId: string, status: Order['items'][0]['status']) => {
    if (!user?._id) {
      toast.error(t('errors.no_user'), {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
      return;
    }
    dispatch({ type: 'SET_SUBMITTING', payload: orderId });
    try {
      await ordersAPI.updateItemStatus(orderId, itemId, { status });
      dispatch({ type: 'UPDATE_ITEM_STATUS', orderId, payload: { itemId, status } });
      toast.success(t('orders.item_status_updated', { status: t(`item_status.${status}`) }), {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
      if (socket && isConnected) {
        emit('itemStatusUpdated', { orderId, itemId, status });
      }
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Item status update error:`, error);
      toast.error(t('errors.item_status_update_failed', { message: error.message }), {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    } finally {
      dispatch({ type: 'SET_SUBMITTING', payload: null });
    }
  }, [user, t, isRtl, socket, isConnected, emit]);

  const handleAssignChefs = useCallback(async (orderId: string) => {
    if (!user?._id || state.assignFormData.items.some(item => !item.assignedTo)) {
      toast.error(t('errors.assign_chef_required'), {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
      return;
    }
    dispatch({ type: 'SET_SUBMITTING', payload: orderId });
    try {
      const assignments = state.assignFormData.items.map(item => ({
        itemId: item.itemId,
        assignedTo: item.assignedTo,
      }));
      await ordersAPI.assignChefs(orderId, assignments);
      const items = assignments.map(assignment => ({
        _id: assignment.itemId,
        assignedTo: state.chefs.find(chef => chef.userId === assignment.assignedTo),
        status: 'assigned',
      }));
      dispatch({ type: 'TASK_ASSIGNED', orderId, items });
      dispatch({ type: 'SET_MODAL', isOpen: false });
      dispatch({ type: 'SET_ASSIGN_FORM', payload: { items: [] } });
      dispatch({ type: 'SET_SELECTED_ORDER', payload: null });
      toast.success(t('orders.chefs_assigned'), {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
      if (socket && isConnected) {
        emit('taskAssigned', { orderId, items });
      }
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Assign chefs error:`, error);
      toast.error(t('errors.assign_chefs_failed', { message: error.message }), {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    } finally {
      dispatch({ type: 'SET_SUBMITTING', payload: null });
    }
  }, [user, state.assignFormData, state.chefs, t, isRtl, socket, isConnected, emit]);

  const handleOpenAssignModal = useCallback((order: Order) => {
    if (order.status !== 'approved') {
      toast.error(t('errors.order_not_approved'), {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
      return;
    }
    dispatch({
      type: 'SET_SELECTED_ORDER',
      payload: order,
    });
    dispatch({
      type: 'SET_ASSIGN_FORM',
      payload: {
        items: order.items.map(item => ({
          itemId: item._id,
          quantity: item.quantity,
          unit: translateUnit(item.unit || 'unit', isRtl),
          assignedTo: item.assignedTo?._id || '',
        })),
      },
    });
    dispatch({ type: 'SET_MODAL', isOpen: true });
  }, [isRtl, t]);

  const handleExportPDF = useCallback(() => {
    const filterBranchName = state.branches.find(b => b._id === state.filterBranch)?.displayName || t('branches.all');
    exportToPDF(state.orders, {
      title: t('orders.title'),
      headers: [
        t('orders.order_number'),
        t('orders.branch'),
        t('orders.status'),
        t('orders.products'),
        t('orders.total_amount'),
        t('orders.total_quantity'),
        t('orders.date'),
      ],
      data: state.orders.map(order => [
        order.orderNumber,
        order.branch.displayName,
        t(`order_status.${order.status}`),
        order.items.map(i => `${i.displayProductName} (${i.quantity} ${i.displayUnit})`).join(', '),
        calculateAdjustedTotal(order),
        `${calculateTotalQuantity(order)} ${t('orders.units')}`,
        order.date,
      ]),
      isRtl,
      fileName: 'Orders.pdf',
      filterStatus: state.filterStatus ? t(`order_status.${state.filterStatus}`) : t('order_status.all_statuses'),
      filterBranch: filterBranchName,
    });
    toast.success(t('orders.export_success'), {
      position: isRtl ? 'top-left' : 'top-right',
      autoClose: 3000,
    });
  }, [state.orders, state.branches, state.filterBranch, state.filterStatus, t, isRtl, calculateAdjustedTotal, calculateTotalQuantity]);

  const filteredAndSortedOrders = useMemo(() => {
    let result = [...state.orders];

    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      result = result.filter(order =>
        order.orderNumber.toLowerCase().includes(query) ||
        order.branch.displayName.toLowerCase().includes(query) ||
        order.notes?.toLowerCase().includes(query) ||
        order.createdBy.toLowerCase().includes(query) ||
        order.items.some(item => item.displayProductName.toLowerCase().includes(query))
      );
    }

    if (state.filterStatus) {
      result = result.filter(order => order.status === state.filterStatus);
    }

    if (state.filterBranch && user.role === 'admin') {
      result = result.filter(order => order.branchId === state.filterBranch);
    } else if (user.role === 'branch') {
      result = result.filter(order => order.branchId === user.branchId);
    }

    if (user.role === 'production' && user.department) {
      result = result.filter(order =>
        order.items.some(item => item.department._id === user.department._id)
      );
    } else if (user.role === 'chef' && user._id) {
      result = result.filter(order =>
        order.items.some(item => item.assignedTo?._id === user._id)
      );
    }

    result.sort((a, b) => {
      let valueA: any, valueB: any;
      if (state.sortBy === 'date') {
        valueA = a.date ? new Date(a.date).getTime() : 0;
        valueB = b.date ? new Date(b.date).getTime() : 0;
      } else if (state.sortBy === 'totalAmount') {
        valueA = a.adjustedTotal || a.totalAmount;
        valueB = b.adjustedTotal || b.totalAmount;
      } else {
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
        valueA = priorityOrder[a.priority] || 2;
        valueB = priorityOrder[b.priority] || 2;
      }
      return state.sortOrder === 'asc'
        ? valueA > valueB ? 1 : -1
        : valueA < valueB ? 1 : -1;
    });

    return result;
  }, [state.orders, state.searchQuery, state.filterStatus, state.filterBranch, state.sortBy, state.sortOrder, user]);

  const paginatedOrders = useMemo(() => {
    const startIndex = (state.currentPage - 1) * ORDERS_PER_PAGE[state.viewMode];
    return filteredAndSortedOrders.slice(startIndex, startIndex + ORDERS_PER_PAGE[state.viewMode]);
  }, [filteredAndSortedOrders, state.currentPage, state.viewMode]);

  const totalPages = Math.ceil(filteredAndSortedOrders.length / ORDERS_PER_PAGE[state.viewMode]);

  const branchOptions = useMemo(() => [
    { value: '', label: t('branches.all') },
    ...state.branches.map(branch => ({
      value: branch._id,
      label: branch.displayName,
    })),
  ], [state.branches, t]);

  const handleNavigateToDetails = useCallback((orderId: string) => {
    navigate(`/orders/${orderId}`);
    window.scrollTo(0, 0);
  }, [navigate]);

  return (
    <div className={`container mx-auto p-4 sm:p-6 ${isRtl ? 'font-arabic' : 'font-sans'}`}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {t('orders.title')}
          </h1>
          <span className="text-sm text-gray-600">
            ({filteredAndSortedOrders.length} {t('orders.count')})
          </span>
        </div>
        <div className={`flex flex-col sm:flex-row gap-2 sm:gap-4 ${isRtl ? 'sm:flex-row-reverse' : ''}`}>
          <Button
            variant="primary"
            onClick={() => navigate('/orders/create')}
            className="bg-amber-500 hover:bg-amber-600 text-white rounded-md px-4 py-2 text-sm shadow-sm"
          >
            <ShoppingCart className="w-4 h-4 inline-block mr-2" />
            {t('orders.create_order')}
          </Button>
          <Button
            variant={state.orders.length > 0 ? 'secondary' : 'disabled'}
            onClick={state.orders.length > 0 ? () => exportToExcel(filteredAndSortedOrders, isRtl, calculateAdjustedTotal, calculateTotalQuantity, translateUnit) : undefined}
            className={`bg-gray-200 text-gray-800 rounded-md px-4 py-2 text-sm shadow-sm ${state.orders.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300'}`}
            disabled={state.orders.length === 0}
          >
            <Download className="w-4 h-4 inline-block mr-2" />
            {t('orders.export_excel')}
          </Button>
          <Button
            variant={state.orders.length > 0 ? 'secondary' : 'disabled'}
            onClick={state.orders.length > 0 ? handleExportPDF : undefined}
            className={`bg-gray-200 text-gray-800 rounded-md px-4 py-2 text-sm shadow-sm ${state.orders.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300'}`}
            disabled={state.orders.length === 0}
          >
            <Download className="w-4 h-4 inline-block mr-2" />
            {t('orders.export_pdf')}
          </Button>
        </div>
      </motion.div>

      <Card className="mb-6 p-4 sm:p-6 bg-white rounded-lg shadow-md border border-gray-200">
        <div className={`flex flex-col sm:flex-row gap-4 ${isRtl ? 'sm:flex-row-reverse' : ''}`}>
          <div className="flex-1">
            <Input
              type="text"
              placeholder={t('orders.search_placeholder')}
              value={state.searchQuery}
              onChange={(e) => dispatch({ type: 'SET_SEARCH_QUERY', payload: e.target.value })}
              className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
              icon={<Search className="w-4 h-4 text-gray-400" />}
            />
          </div>
          <div className="flex-1">
            <Select
              options={statusOptions.map(opt => ({ ...opt, label: t(`order_status.${opt.label}`) }))}
              value={state.filterStatus}
              onChange={(value) => dispatch({ type: 'SET_FILTER_STATUS', payload: value })}
              className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
              placeholder={t('orders.filter_status')}
            />
          </div>
          {user.role === 'admin' && (
            <div className="flex-1">
              <Select
                options={branchOptions}
                value={state.filterBranch}
                onChange={(value) => dispatch({ type: 'SET_FILTER_BRANCH', payload: value })}
                className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
                placeholder={t('branches.select')}
              />
            </div>
          )}
          <div className="flex-1">
            <Select
              options={sortOptions.map(opt => ({ ...opt, label: t(opt.label) }))}
              value={state.sortBy}
              onChange={(value) => dispatch({ type: 'SET_SORT', by: value as any, order: state.sortOrder })}
              className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
              placeholder={t('orders.sort_by')}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={state.viewMode === 'card' ? 'primary' : 'secondary'}
              onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'card' })}
              className="p-2 rounded-md"
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={state.viewMode === 'table' ? 'primary' : 'secondary'}
              onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'table' })}
              className="p-2 rounded-md"
            >
              <Table2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {state.error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 mb-6 ${isRtl ? 'flex-row-reverse' : ''}`}
        >
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm">{state.error}</span>
          <Button
            variant="primary"
            onClick={() => fetchData()}
            className="ml-auto bg-amber-500 hover:bg-amber-600 text-white rounded-md px-3 py-1 text-sm"
          >
            {t('common.retry')}
          </Button>
        </motion.div>
      )}

      {!state.socketConnected && state.socketError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`p-3 bg-yellow-50 border border-yellow-200 rounded-md flex items-center gap-2 mb-6 ${isRtl ? 'flex-row-reverse' : ''}`}
        >
          <AlertCircle className="w-5 h-5 text-yellow-600" />
          <span className="text-yellow-600 text-sm">{state.socketError}</span>
        </motion.div>
      )}

      <Suspense fallback={state.viewMode === 'card' ? <OrderCardSkeleton count={ORDERS_PER_PAGE.card} /> : <OrderTableSkeleton count={ORDERS_PER_PAGE.table} />}>
        <div ref={listRef}>
          {state.viewMode === 'card' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {paginatedOrders.map(order => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <OrderCard
                      order={order}
                      onStatusChange={handleStatusChange}
                      onItemStatusChange={handleItemStatusChange}
                      onAssignChefs={['admin', 'production'].includes(user.role) ? () => handleOpenAssignModal(order) : undefined}
                      onViewDetails={() => handleNavigateToDetails(order.id)}
                      validTransitions={validTransitions}
                      isRtl={isRtl}
                      t={t}
                      submitting={state.submitting === order.id}
                      user={user}
                      calculateTotalQuantity={calculateTotalQuantity}
                      calculateAdjustedTotal={calculateAdjustedTotal}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <OrderTable
              orders={paginatedOrders}
              onStatusChange={handleStatusChange}
              onItemStatusChange={handleItemStatusChange}
              onAssignChefs={['admin', 'production'].includes(user.role) ? handleOpenAssignModal : undefined}
              onViewDetails={handleNavigateToDetails}
              validTransitions={validTransitions}
              isRtl={isRtl}
              t={t}
              submitting={state.submitting}
              user={user}
              calculateTotalQuantity={calculateTotalQuantity}
              calculateAdjustedTotal={calculateAdjustedTotal}
              startIndex={(state.currentPage - 1) * ORDERS_PER_PAGE[state.viewMode] + 1}
            />
          )}
        </div>
      </Suspense>

      {paginatedOrders.length === 0 && !state.loading && (
        <div className="text-center py-10">
          <ShoppingCart className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">{t('orders.no_orders_found')}</p>
        </div>
      )}

      {totalPages > 1 && (
        <Pagination
          currentPage={state.currentPage}
          totalPages={totalPages}
          onPageChange={(page) => {
            dispatch({ type: 'SET_PAGE', payload: page });
            if (listRef.current) {
              listRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }}
          isRtl={isRtl}
        />
      )}

      <Suspense fallback={<div>{t('common.loading')}</div>}>
        {state.isAssignModalOpen && state.selectedOrder && (
          <AssignChefsModal
            isOpen={state.isAssignModalOpen}
            onClose={() => {
              dispatch({ type: 'SET_MODAL', isOpen: false });
              dispatch({ type: 'SET_ASSIGN_FORM', payload: { items: [] } });
              dispatch({ type: 'SET_SELECTED_ORDER', payload: null });
            }}
            selectedOrder={state.selectedOrder}
            assignFormData={state.assignFormData}
            chefs={state.chefs}
            error={state.error}
            submitting={state.submitting}
            assignChefs={handleAssignChefs}
            setAssignForm={(formData) => dispatch({ type: 'SET_ASSIGN_FORM', payload: formData })}
            isRtl={isRtl}
            t={t}
          />
        )}
      </Suspense>
    </div>
  );
};

export default Orders;