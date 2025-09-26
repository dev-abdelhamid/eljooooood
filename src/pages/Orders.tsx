// src/pages/Orders.tsx
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
import { Order, Chef, Branch, AssignChefsForm, OrderStatus, ItemStatus, ReturnStatus, Priority } from '../types/types';
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
  totalOrders: number;
  loading: boolean;
  error: string;
  submitting: string | null;
  socketConnected: boolean;
  socketError: string | null;
  viewMode: 'card' | 'table';
  isRtl: boolean;
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
  totalOrders: 0,
  loading: true,
  error: '',
  submitting: null,
  socketConnected: false,
  socketError: null,
  viewMode: 'card',
  isRtl: false,
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_ORDERS':
      return { ...state, orders: action.payload, error: '', currentPage: 1 };
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
        orders: state.orders.map(o => o.id === action.orderId ? { ...o, status: action.status! } : o),
        selectedOrder:
          state.selectedOrder && state.selectedOrder.id === action.orderId
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
                status: order.items.every(i => i.status === ItemStatus.Completed) && order.status !== OrderStatus.Completed
                  ? OrderStatus.Completed
                  : order.status,
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
                status: state.selectedOrder.items.every(i => i.status === ItemStatus.Completed) &&
                  state.selectedOrder.status !== OrderStatus.Completed
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
                items: order.items.map(i => {
                  const assignment = action.items?.find(a => a._id === i._id);
                  return assignment
                    ? {
                        ...i,
                        assignedTo: assignment.assignedTo
                          ? {
                              _id: assignment.assignedTo._id,
                              username: assignment.assignedTo.username || 'unknown',
                              name: assignment.assignedTo.name || 'unknown',
                              nameEn: assignment.assignedTo.nameEn,
                              displayName: state.isRtl ? assignment.assignedTo.name : (assignment.assignedTo.nameEn || assignment.assignedTo.name),
                              department: assignment.assignedTo.department
                            }
                          : undefined,
                        status: assignment.status || i.status,
                      }
                    : i;
                }),
                status: order.items.every(i => i.status === ItemStatus.Assigned) ? OrderStatus.InProduction : order.status,
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
                              username: assignment.assignedTo.username || 'unknown',
                              name: assignment.assignedTo.name || 'unknown',
                              nameEn: assignment.assignedTo.nameEn,
                              displayName: state.isRtl ? assignment.assignedTo.name : (assignment.assignedTo.nameEn || assignment.assignedTo.name),
                              department: assignment.assignedTo.department
                            }
                          : undefined,
                        status: assignment.status || i.status,
                      }
                    : i;
                }),
                status: state.selectedOrder.items.every(i => i.status === ItemStatus.Assigned)
                  ? OrderStatus.InProduction
                  : state.selectedOrder.status,
              }
            : state.selectedOrder,
      };
    case 'UPDATE_RETURN_STATUS':
      return {
        ...state,
        orders: state.orders.map(order =>
          order.id === action.orderId
            ? {
                ...order,
                returns: order.returns.map(ret =>
                  ret.returnId === action.returnId ? { ...ret, status: action.status! } : ret
                ),
                adjustedTotal: action.status === ReturnStatus.Approved
                  ? order.adjustedTotal - (order.returns.find(r => r.returnId === action.returnId)?.items.reduce((sum, item) => {
                      const orderItem = order.items.find(i => i.productId === item.productId);
                      return sum + (orderItem ? orderItem.price * item.quantity : 0);
                    }, 0) || 0)
                  : order.adjustedTotal,
              }
            : order
        ),
        selectedOrder:
          state.selectedOrder && state.selectedOrder.id === action.orderId
            ? {
                ...state.selectedOrder,
                returns: state.selectedOrder.returns.map(ret =>
                  ret.returnId === action.returnId ? { ...ret, status: action.status! } : ret
                ),
                adjustedTotal: action.status === ReturnStatus.Approved
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
    case 'SET_IS_RTL':
      return { ...state, isRtl: action.payload };
    case 'SET_TOTAL_ORDERS':
      return { ...state, totalOrders: action.payload };
    default:
      return state;
  }
};

const ORDERS_PER_PAGE = { card: 12, table: 50 };

const validTransitions: Record<Order['status'], Order['status'][]> = {
  pending: [OrderStatus.Approved, OrderStatus.Cancelled],
  approved: [OrderStatus.InProduction, OrderStatus.Cancelled],
  in_production: [OrderStatus.Completed, OrderStatus.Cancelled],
  completed: [OrderStatus.InTransit],
  in_transit: [OrderStatus.Delivered],
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
    const statusLabel = isRtl ? {
      pending: 'قيد الانتظار',
      approved: 'تم الموافقة',
      in_production: 'في الإنتاج',
      completed: 'مكتمل',
      in_transit: 'في النقل',
      delivered: 'تم التسليم',
      cancelled: 'ملغى'
    }[order.status] : order.status;
    return {
      [headers[0]]: order.orderNumber,
      [headers[1]]: order.branch.displayName,
      [headers[2]]: statusLabel,
      [headers[3]]: productsStr,
      [headers[4]]: isRtl ? `${totalAmount} ر.س` : totalAmount,
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
        .filter(ret => ret.status === ReturnStatus.Approved)
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
    socket.on('connect', () => {
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: true });
      dispatch({ type: 'SET_SOCKET_ERROR', payload: null });
    });
    socket.on('connect_error', (err) => {
      console.error(`[${new Date().toISOString()}] Socket connect error:`, err.message);
      dispatch({ type: 'SET_SOCKET_ERROR', payload: isRtl ? 'خطأ في الاتصال' : 'Connection error' });
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: false });
    });
    socket.on('reconnect', (attempt) => {
      console.log(`[${new Date().toISOString()}] Socket reconnected after ${attempt} attempts`);
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: true });
    });
    socket.on('disconnect', (reason) => {
      console.log(`[${new Date().toISOString()}] Socket disconnected: ${reason}`);
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
        branchNameEn: order.branch?.nameEn,
        branch: {
          _id: order.branch?._id || 'unknown',
          name: order.branch?.name || (isRtl ? 'غير معروف' : 'Unknown'),
          nameEn: order.branch?.nameEn,
          displayName: isRtl ? order.branch?.name : (order.branch?.nameEn || order.branch?.name || (isRtl ? 'غير معروف' : 'Unknown')),
        },
        items: Array.isArray(order.items)
          ? order.items.map((item: any) => ({
              _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
              itemId: item.itemId || `temp-${Math.random().toString(36).substring(2)}`,
              productId: item.product?._id || 'unknown',
              productName: item.product?.name || (isRtl ? 'غير معروف' : 'Unknown'),
              productNameEn: item.product?.nameEn,
              displayProductName: isRtl ? item.product?.name : (item.product?.nameEn || item.product?.name || (isRtl ? 'غير معروف' : 'Unknown')),
              quantity: Number(item.quantity) || 1,
              price: Number(item.price) || 0,
              unit: item.product?.unit || 'unit',
              unitEn: item.product?.unitEn,
              displayUnit: translateUnit(item.product?.unit || 'unit', isRtl),
              department: item.product?.department
                ? {
                    _id: item.product.department._id,
                    name: item.product.department.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: item.product.department.nameEn,
                    displayName: isRtl ? item.product.department.name : (item.product.department.nameEn || item.product.department.name || (isRtl ? 'غير معروف' : 'Unknown')),
                  }
                : { _id: 'unknown', name: isRtl ? 'غير معروف' : 'Unknown', displayName: isRtl ? 'غير معروف' : 'Unknown' },
              assignedTo: item.assignedTo
                ? {
                    _id: item.assignedTo._id,
                    username: item.assignedTo.username || 'unknown',
                    name: item.assignedTo.name || 'unknown',
                    nameEn: item.assignedTo.nameEn,
                    displayName: isRtl ? item.assignedTo.name : (item.assignedTo.nameEn || item.assignedTo.name || (isRtl ? 'غير معروف' : 'Unknown')),
                    department: item.assignedTo.department
                      ? {
                          _id: item.assignedTo.department._id,
                          name: item.assignedTo.department.name || (isRtl ? 'غير معروف' : 'Unknown'),
                          nameEn: item.assignedTo.department.nameEn,
                          displayName: isRtl ? item.assignedTo.department.name : (item.assignedTo.department.nameEn || item.assignedTo.department.name || (isRtl ? 'غير معروف' : 'Unknown')),
                        }
                      : { _id: 'unknown', name: isRtl ? 'غير معروف' : 'Unknown', displayName: isRtl ? 'غير معروف' : 'Unknown' },
                  }
                : undefined,
              status: item.status || ItemStatus.Pending,
              returnedQuantity: Number(item.returnedQuantity) || 0,
              returnReason: item.returnReason || '',
              returnReasonEn: item.returnReasonEn,
              displayReturnReason: isRtl ? item.returnReason : (item.returnReasonEn || item.returnReason || ''),
              startedAt: item.startedAt,
              completedAt: item.completedAt,
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
                    displayProductName: isRtl ? item.product?.name : (item.product?.nameEn || item.product?.name || (isRtl ? 'غير معروف' : 'Unknown')),
                    quantity: Number(item.quantity) || 0,
                    unit: item.product?.unit || 'unit',
                    unitEn: item.product?.unitEn,
                    displayUnit: translateUnit(item.product?.unit || 'unit', isRtl),
                    reason: item.reason || (isRtl ? 'غير محدد' : 'Unspecified'),
                    reasonEn: item.reasonEn,
                    displayReason: isRtl ? item.reason : (item.reasonEn || item.reason || (isRtl ? 'غير محدد' : 'Unspecified')),
                    status: item.status || ReturnStatus.PendingApproval,
                    reviewNotes: item.reviewNotes || '',
                    reviewNotesEn: item.reviewNotesEn,
                    displayReviewNotes: isRtl ? item.reviewNotes : (item.reviewNotesEn || item.reviewNotes || ''),
                  }))
                : [],
              status: ret.status || ReturnStatus.PendingApproval,
              reviewNotes: ret.reviewNotes || '',
              reviewNotesEn: ret.reviewNotesEn,
              displayReviewNotes: isRtl ? ret.reviewNotes : (ret.reviewNotesEn || ret.reviewNotes || ''),
              createdAt: formatDate(ret.createdAt ? new Date(ret.createdAt) : new Date(), language),
              createdBy: {
                _id: ret.createdBy?._id || 'unknown',
                username: ret.createdBy?.username || 'unknown',
                name: ret.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                nameEn: ret.createdBy?.nameEn,
                displayName: isRtl ? ret.createdBy?.name : (ret.createdBy?.nameEn || ret.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown')),
              },
              reviewedBy: ret.reviewedBy
                ? {
                    _id: ret.reviewedBy._id,
                    username: ret.reviewedBy.username || 'unknown',
                    name: ret.reviewedBy.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: ret.reviewedBy.nameEn,
                    displayName: isRtl ? ret.reviewedBy.name : (ret.reviewedBy.nameEn || ret.reviewedBy.name || (isRtl ? 'غير معروف' : 'Unknown')),
                  }
                : undefined,
            }))
          : [],
        status: order.status || OrderStatus.Pending,
        totalAmount: Number(order.totalAmount) || 0,
        adjustedTotal: Number(order.adjustedTotal) || 0,
        date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
        requestedDeliveryDate: order.requestedDeliveryDate || new Date().toISOString(),
        notes: order.notes || '',
        notesEn: order.notesEn,
        displayNotes: isRtl ? order.notes : (order.notesEn || order.notes || ''),
        priority: order.priority || Priority.Medium,
        createdBy: order.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
        createdByName: isRtl ? order.createdBy?.name : (order.createdBy?.nameEn || order.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown')),
        approvedBy: order.approvedBy
          ? {
              _id: order.approvedBy._id,
              name: order.approvedBy.name || (isRtl ? 'غير معروف' : 'Unknown'),
              nameEn: order.approvedBy.nameEn,
              displayName: isRtl ? order.approvedBy.name : (order.approvedBy.nameEn || order.approvedBy.name || (isRtl ? 'غير معروف' : 'Unknown')),
            }
          : undefined,
        approvedAt: order.approvedAt,
        deliveredAt: order.deliveredAt,
        transitStartedAt: order.transitStartedAt,
        statusHistory: Array.isArray(order.statusHistory)
          ? order.statusHistory.map((history: any) => ({
              status: history.status || OrderStatus.Pending,
              changedBy: history.changedBy?._id || 'unknown',
              changedByName: isRtl ? history.changedBy?.name : (history.changedBy?.nameEn || history.changedBy?.name || (isRtl ? 'غير معروف' : 'Unknown')),
              changedAt: formatDate(history.changedAt ? new Date(history.changedAt) : new Date(), language),
              notes: history.notes || '',
              notesEn: history.notesEn,
              displayNotes: isRtl ? history.notes : (history.notesEn || history.notes || ''),
            }))
          : [],
        isRtl,
      };
      dispatch({ type: 'ADD_ORDER', payload: mappedOrder });
      playNotificationSound('/sounds/new-order.mp3', [200, 100, 200]);
      fetchData(); // Re-fetch to update pagination
    });
    socket.on('orderStatusUpdated', ({ orderId, status }: { orderId: string; status: Order['status'] }) => {
      if (!orderId || !status) {
        console.warn('Invalid order status update data:', { orderId, status });
        return;
      }
      dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status });
      fetchData(); // Re-fetch to update pagination
    });
    socket.on('itemStatusUpdated', ({ orderId, itemId, status }: { orderId: string; itemId: string; status: string }) => {
      if (!orderId || !itemId || !status) {
        console.warn('Invalid item status update data:', { orderId, itemId, status });
        return;
      }
      dispatch({ type: 'UPDATE_ITEM_STATUS', orderId, payload: { itemId, status } });
      fetchData(); // Re-fetch to update pagination
    });
    socket.on('returnStatusUpdated', ({ orderId, returnId, status }: { orderId: string; returnId: string; status: string }) => {
      if (!orderId || !returnId || !status) {
        console.warn('Invalid return status update data:', { orderId, returnId, status });
        return;
      }
      dispatch({ type: 'UPDATE_RETURN_STATUS', orderId, returnId, status });
      toast.info(isRtl ? `تم تحديث حالة الإرجاع إلى: ${{
        [ReturnStatus.PendingApproval]: 'قيد الانتظار',
        [ReturnStatus.Approved]: 'تم الموافقة',
        [ReturnStatus.Rejected]: 'مرفوض',
        [ReturnStatus.Processed]: 'معالج'
      }[status]}` : `Return status updated to: ${status}`, {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
      fetchData(); // Re-fetch to update pagination
    });
    socket.on('taskAssigned', ({ orderId, items }: { orderId: string; items: any[] }) => {
      if (!orderId || !items) {
        console.warn('Invalid task assigned data:', { orderId, items });
        return;
      }
      dispatch({ type: 'TASK_ASSIGNED', orderId, items });
      toast.info(isRtl ? 'تم تعيين الشيفات' : 'Chefs assigned', {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
      fetchData(); // Re-fetch to update pagination
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
    };
  }, [user, socket, isRtl, language, playNotificationSound, fetchData]);

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
          isRtl,
          page: state.currentPage,
          limit: ORDERS_PER_PAGE[state.viewMode],
          filterStatus: state.filterStatus,
          filterBranch: state.filterBranch,
          searchQuery: state.searchQuery,
        };
        if (user.role === 'production' && user.department) query.department = user.department._id;
        const [ordersResponse, chefsResponse, branchesResponse] = await Promise.all([
          ordersAPI.getAll(query),
          chefsAPI.getAll({ isRtl }),
          branchesAPI.getAll({ isRtl }),
        ]);
        const mappedOrders: Order[] = ordersResponse.orders
          .filter((order: any) => order && order._id && order.orderNumber)
          .map((order: any) => ({
            id: order._id,
            orderNumber: order.orderNumber,
            branchId: order.branch?._id || 'unknown',
            branchName: order.branch?.name || (isRtl ? 'غير معروف' : 'Unknown'),
            branchNameEn: order.branch?.nameEn,
            branch: {
              _id: order.branch?._id || 'unknown',
              name: order.branch?.name || (isRtl ? 'غير معروف' : 'Unknown'),
              nameEn: order.branch?.nameEn,
              displayName: isRtl ? order.branch?.name : (order.branch?.nameEn || order.branch?.name || (isRtl ? 'غير معروف' : 'Unknown')),
            },
            items: Array.isArray(order.items)
              ? order.items.map((item: any) => ({
                  _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
                  itemId: item.itemId || `temp-${Math.random().toString(36).substring(2)}`,
                  productId: item.product?._id || 'unknown',
                  productName: item.product?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                  productNameEn: item.product?.nameEn,
                  displayProductName: isRtl ? item.product?.name : (item.product?.nameEn || item.product?.name || (isRtl ? 'غير معروف' : 'Unknown')),
                  quantity: Number(item.quantity) || 1,
                  price: Number(item.price) || 0,
                  unit: item.product?.unit || 'unit',
                  unitEn: item.product?.unitEn,
                  displayUnit: translateUnit(item.product?.unit || 'unit', isRtl),
                  department: item.product?.department
                    ? {
                        _id: item.product.department._id,
                        name: item.product.department.name || (isRtl ? 'غير معروف' : 'Unknown'),
                        nameEn: item.product.department.nameEn,
                        displayName: isRtl ? item.product.department.name : (item.product.department.nameEn || item.product.department.name || (isRtl ? 'غير معروف' : 'Unknown')),
                      }
                    : { _id: 'unknown', name: isRtl ? 'غير معروف' : 'Unknown', displayName: isRtl ? 'غير معروف' : 'Unknown' },
                  assignedTo: item.assignedTo
                    ? {
                        _id: item.assignedTo._id,
                        username: item.assignedTo.username || 'unknown',
                        name: item.assignedTo.name || 'unknown',
                        nameEn: item.assignedTo.nameEn,
                        displayName: isRtl ? item.assignedTo.name : (item.assignedTo.nameEn || item.assignedTo.name || (isRtl ? 'غير معروف' : 'Unknown')),
                        department: item.assignedTo.department
                          ? {
                              _id: item.assignedTo.department._id,
                              name: item.assignedTo.department.name || (isRtl ? 'غير معروف' : 'Unknown'),
                              nameEn: item.assignedTo.department.nameEn,
                              displayName: isRtl ? item.assignedTo.department.name : (item.assignedTo.department.nameEn || item.assignedTo.department.name || (isRtl ? 'غير معروف' : 'Unknown')),
                            }
                          : { _id: 'unknown', name: isRtl ? 'غير معروف' : 'Unknown', displayName: isRtl ? 'غير معروف' : 'Unknown' },
                      }
                    : undefined,
                  status: item.status || ItemStatus.Pending,
                  returnedQuantity: Number(item.returnedQuantity) || 0,
                  returnReason: item.returnReason || '',
                  returnReasonEn: item.returnReasonEn,
                  displayReturnReason: isRtl ? item.returnReason : (item.returnReasonEn || item.returnReason || ''),
                  startedAt: item.startedAt,
                  completedAt: item.completedAt,
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
                        displayProductName: isRtl ? item.product?.name : (item.product?.nameEn || item.product?.name || (isRtl ? 'غير معروف' : 'Unknown')),
                        quantity: Number(item.quantity) || 0,
                        unit: item.product?.unit || 'unit',
                        unitEn: item.product?.unitEn,
                        displayUnit: translateUnit(item.product?.unit || 'unit', isRtl),
                        reason: item.reason || (isRtl ? 'غير محدد' : 'Unspecified'),
                        reasonEn: item.reasonEn,
                        displayReason: isRtl ? item.reason : (item.reasonEn || item.reason || (isRtl ? 'غير محدد' : 'Unspecified')),
                        status: item.status || ReturnStatus.PendingApproval,
                        reviewNotes: item.reviewNotes || '',
                        reviewNotesEn: item.reviewNotesEn,
                        displayReviewNotes: isRtl ? item.reviewNotes : (item.reviewNotesEn || item.reviewNotes || ''),
                      }))
                    : [],
                  status: ret.status || ReturnStatus.PendingApproval,
                  reviewNotes: ret.reviewNotes || '',
                  reviewNotesEn: ret.reviewNotesEn,
                  displayReviewNotes: isRtl ? ret.reviewNotes : (ret.reviewNotesEn || ret.reviewNotes || ''),
                  createdAt: formatDate(ret.createdAt ? new Date(ret.createdAt) : new Date(), language),
                  createdBy: {
                    _id: ret.createdBy?._id || 'unknown',
                    username: ret.createdBy?.username || 'unknown',
                    name: ret.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: ret.createdBy?.nameEn,
                    displayName: isRtl ? ret.createdBy?.name : (ret.createdBy?.nameEn || ret.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown')),
                  },
                  reviewedBy: ret.reviewedBy
                    ? {
                        _id: ret.reviewedBy._id,
                        username: ret.reviewedBy.username || 'unknown',
                        name: ret.reviewedBy.name || (isRtl ? 'غير معروف' : 'Unknown'),
                        nameEn: ret.reviewedBy.nameEn,
                        displayName: isRtl ? ret.reviewedBy.name : (ret.reviewedBy.nameEn || ret.reviewedBy.name || (isRtl ? 'غير معروف' : 'Unknown')),
                      }
                    : undefined,
                }))
              : [],
            status: order.status || OrderStatus.Pending,
            totalAmount: Number(order.totalAmount) || 0,
            adjustedTotal: Number(order.adjustedTotal) || 0,
            date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
            requestedDeliveryDate: order.requestedDeliveryDate || new Date().toISOString(),
            notes: order.notes || '',
            notesEn: order.notesEn,
            displayNotes: isRtl ? order.notes : (order.notesEn || order.notes || ''),
            priority: order.priority || Priority.Medium,
            createdBy: order.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
            createdByName: isRtl ? order.createdBy?.name : (order.createdBy?.nameEn || order.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown')),
            approvedBy: order.approvedBy
              ? {
                  _id: order.approvedBy._id,
                  name: order.approvedBy.name || (isRtl ? 'غير معروف' : 'Unknown'),
                  nameEn: order.approvedBy.nameEn,
                  displayName: isRtl ? order.approvedBy.name : (order.approvedBy.nameEn || order.approvedBy.name || (isRtl ? 'غير معروف' : 'Unknown')),
                }
              : undefined,
            approvedAt: order.approvedAt,
            deliveredAt: order.deliveredAt,
            transitStartedAt: order.transitStartedAt,
            statusHistory: Array.isArray(order.statusHistory)
              ? order.statusHistory.map((history: any) => ({
                  status: history.status || OrderStatus.Pending,
                  changedBy: history.changedBy?._id || 'unknown',
                  changedByName: isRtl ? history.changedBy?.name : (history.changedBy?.nameEn || history.changedBy?.name || (isRtl ? 'غير معروف' : 'Unknown')),
                  changedAt: formatDate(history.changedAt ? new Date(history.changedAt) : new Date(), language),
                  notes: history.notes || '',
                  notesEn: history.notesEn,
                  displayNotes: isRtl ? history.notes : (history.notesEn || history.notes || ''),
                }))
              : [],
            isRtl,
          }));
        dispatch({ type: 'SET_ORDERS', payload: mappedOrders });
        dispatch({ type: 'SET_TOTAL_ORDERS', payload: ordersResponse.total });
        dispatch({
          type: 'SET_CHEFS',
          payload: chefsResponse
            .filter((chef: any) => chef && chef.user?._id)
            .map((chef: any) => ({
              _id: chef._id,
              userId: chef.user._id,
              name: chef.user?.name || chef.name || (isRtl ? 'غير معروف' : 'Unknown'),
              nameEn: chef.user?.nameEn || chef.nameEn,
              displayName: isRtl ? (chef.user?.name || chef.name) : (chef.user?.nameEn || chef.nameEn || chef.user?.name || chef.name || (isRtl ? 'غير معروف' : 'Unknown')),
              department: chef.department
                ? {
                    _id: chef.department._id,
                    name: chef.department.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: chef.department.nameEn,
                    displayName: isRtl ? chef.department.name : (chef.department.nameEn || chef.department.name || (isRtl ? 'غير معروف' : 'Unknown')),
                  }
                : { _id: 'unknown', name: isRtl ? 'غير معروف' : 'Unknown', displayName: isRtl ? 'غير معروف' : 'Unknown' },
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
              displayName: isRtl ? branch.name : (branch.nameEn || branch.name || (isRtl ? 'غير معروف' : 'Unknown')),
            }))
            .sort((a: Branch, b: Branch) => a.displayName.localeCompare(b.displayName, language)),
        });
        dispatch({ type: 'SET_ERROR', payload: '' });
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Fetch data error:`, err.message);
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
    [user, state.sortBy, state.sortOrder, state.currentPage, state.viewMode, state.filterStatus, state.filterBranch, state.searchQuery, isRtl, language]
  );

  const handleSearchChange = useMemo(
    () =>
      debounce((value: string) => {
        dispatch({ type: 'SET_SEARCH_QUERY', payload: value });
      }, 300),
    []
  );

  const totalPages = useMemo(
    () => Math.ceil(state.totalOrders / ORDERS_PER_PAGE[state.viewMode]),
    [state.totalOrders, state.viewMode]
  );

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
        await ordersAPI.updateStatus(orderId, { status: newStatus, isRtl });
        dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status: newStatus });
        if (socket && isConnected) {
          emit('orderStatusUpdated', { orderId, status: newStatus });
        }
        toast.success(isRtl ? `تم تحديث الحالة إلى ${{
          [OrderStatus.Pending]: 'قيد الانتظار',
          [OrderStatus.Approved]: 'تم الموافقة',
          [OrderStatus.InProduction]: 'في الإنتاج',
          [OrderStatus.Completed]: 'مكتمل',
          [OrderStatus.InTransit]: 'في النقل',
          [OrderStatus.Delivered]: 'تم التسليم',
          [OrderStatus.Cancelled]: 'ملغى'
        }[newStatus]}` : `Order status updated to: ${newStatus}`, {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Update order status error:`, err.message);
        toast.error(isRtl ? `فشل في تحديث الحالة: ${err.message}` : `Failed to update status: ${err.message}`, {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
        fetchData(); // Re-fetch after update
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
        await ordersAPI.updateItemStatus(orderId, itemId, { status, isRtl });
        dispatch({ type: 'UPDATE_ITEM_STATUS', orderId, payload: { itemId, status } });
        if (socket && isConnected) {
          emit('itemStatusUpdated', { orderId, itemId, status });
        }
        toast.success(isRtl ? `تم تحديث حالة العنصر إلى: ${{
          [ItemStatus.Pending]: 'قيد الانتظار',
          [ItemStatus.Assigned]: 'معين',
          [ItemStatus.InProgress]: 'قيد التنفيذ',
          [ItemStatus.Completed]: 'مكتمل',
          [ItemStatus.Cancelled]: 'ملغى'
        }[status]}` : `Item status updated to: ${status}`, {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Update item status error:`, err.message);
        toast.error(isRtl ? `فشل في تحديث حالة العنصر: ${err.message}` : `Failed to update item status: ${err.message}`, {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
        fetchData(); // Re-fetch after update
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
        await ordersAPI.assignChef(orderId, { items: state.assignFormData.items, isRtl });
        const items = state.assignFormData.items.map(item => ({
          _id: item.itemId,
          assignedTo: state.chefs.find(chef => chef.userId === item.assignedTo) || {
            _id: item.assignedTo,
            username: 'unknown',
            name: isRtl ? 'غير معروف' : 'Unknown',
            nameEn: undefined,
            displayName: isRtl ? 'غير معروف' : 'Unknown',
            department: { _id: 'unknown', name: isRtl ? 'غير معروف' : 'Unknown', nameEn: undefined, displayName: isRtl ? 'غير معروف' : 'Unknown' },
          },
          status: ItemStatus.Assigned,
        }));
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
        console.error(`[${new Date().toISOString()}] Assign chefs error:`, err.message);
        toast.error(isRtl ? `فشل في تعيين الشيفات: ${err.message}` : `Failed to assign chefs: ${err.message}`, {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
        fetchData(); // Re-fetch after update
      }
    },
    [user, state.assignFormData, state.chefs, socket, isConnected, emit, isRtl]
  );

  const openAssignModal = useCallback(
    (order: Order) => {
      if (order.status !== OrderStatus.Approved) {
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
              product: item.productName,
              productNameEn: item.productNameEn,
              quantity: item.quantity,
              unit: item.unit,
              unitEn: item.unitEn,
              displayUnit: item.displayUnit,
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
      listRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const handleViewModeChange = useCallback((mode: 'card' | 'table') => {
    dispatch({ type: 'SET_VIEW_MODE', payload: mode });
  }, []);

  const handleExportToPDF = useCallback(() => {
    exportToPDF(state.orders, isRtl, calculateAdjustedTotal, calculateTotalQuantity, translateUnit, state.filterStatus, state.branches.find(b => b._id === state.filterBranch)?.displayName || '');
  }, [state.orders, isRtl, calculateAdjustedTotal, calculateTotalQuantity, state.filterStatus, state.filterBranch, state.branches]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    dispatch({ type: 'SET_IS_RTL', payload: isRtl });
  }, [isRtl]);

  return (
    <div className={`p-4 md:p-6 max-w-7xl mx-auto ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        <ShoppingCart className="w-6 h-6" />
        {isRtl ? 'إدارة الطلبات' : 'Order Management'}
      </h1>
      {state.socketError && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {state.socketError}
        </div>
      )}
      <Card className="mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-4">
          <div className="flex items-center gap-2 w-full md:w-1/3">
            <Search className="w-5 h-5 text-gray-500" />
            <Input
              type="text"
              placeholder={isRtl ? 'ابحث برقم الطلب أو الفرع...' : 'Search by order number or branch...'}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full"
              aria-label={isRtl ? 'بحث الطلبات' : 'Search orders'}
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Select
              options={[{ value: '', label: isRtl ? 'جميع الفروع' : 'All Branches' }, ...state.branches.map(b => ({ value: b._id, label: b.displayName }))]}
              value={state.filterBranch}
              onChange={(value) => dispatch({ type: 'SET_FILTER_BRANCH', payload: value })}
              className="w-full md:w-40"
              aria-label={isRtl ? 'تصفية حسب الفرع' : 'Filter by branch'}
            />
            <Select
              options={statusOptions.map(opt => ({
                value: opt.value,
                label: isRtl ? {
                  '': 'جميع الحالات',
                  pending: 'قيد الانتظار',
                  approved: 'تم الموافقة',
                  in_production: 'في الإنتاج',
                  completed: 'مكتمل',
                  in_transit: 'في النقل',
                  delivered: 'تم التسليم',
                  cancelled: 'ملغى'
                }[opt.value] : t(opt.label),
              }))}
              value={state.filterStatus}
              onChange={(value) => dispatch({ type: 'SET_FILTER_STATUS', payload: value })}
              className="w-full md:w-40"
              aria-label={isRtl ? 'تصفية حسب الحالة' : 'Filter by status'}
            />
            <Select
              options={sortOptions.map(opt => ({
                value: opt.value,
                label: isRtl ? {
                  date: 'التاريخ',
                  totalAmount: 'إجمالي المبلغ',
                  priority: 'الأولوية'
                }[opt.value] : t(opt.label),
              }))}
              value={state.sortBy}
              onChange={(value) => dispatch({ type: 'SET_SORT', by: value as any, order: state.sortOrder })}
              className="w-full md:w-40"
              aria-label={isRtl ? 'فرز حسب' : 'Sort by'}
            />
            <Button
              variant="outline"
              onClick={() => dispatch({ type: 'SET_SORT', by: state.sortBy, order: state.sortOrder === 'asc' ? 'desc' : 'asc' })}
              className="px-2"
              aria-label={isRtl ? `فرز ${state.sortOrder === 'asc' ? 'تنازلي' : 'تصاعدي'}` : `Sort ${state.sortOrder === 'asc' ? 'descending' : 'ascending'}`}
            >
              {state.sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleViewModeChange('card')}
              className={`p-2 ${state.viewMode === 'card' ? 'bg-gray-200' : ''}`}
              aria-label={isRtl ? 'عرض البطاقات' : 'Card view'}
            >
              <Grid className="w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              onClick={() => handleViewModeChange('table')}
              className={`p-2 ${state.viewMode === 'table' ? 'bg-gray-200' : ''}`}
              aria-label={isRtl ? 'عرض الجدول' : 'Table view'}
            >
              <Table2 className="w-5 h-5" />
            </Button>
            <Button
              variant="primary"
              onClick={() => exportToExcel(state.orders, isRtl, calculateAdjustedTotal, calculateTotalQuantity, translateUnit)}
              className="flex items-center gap-2"
              aria-label={isRtl ? 'تصدير إلى Excel' : 'Export to Excel'}
            >
              <Download className="w-5 h-5" />
              {isRtl ? 'Excel' : 'Excel'}
            </Button>
            <Button
              variant="primary"
              onClick={handleExportToPDF}
              className="flex items-center gap-2"
              aria-label={isRtl ? 'تصدير إلى PDF' : 'Export to PDF'}
            >
              <Download className="w-5 h-5" />
              {isRtl ? 'PDF' : 'PDF'}
            </Button>
          </div>
        </div>
      </Card>

      {state.error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {state.error}
        </div>
      )}

      <div ref={listRef}>
        <Suspense fallback={<OrderCardSkeleton isRtl={isRtl} />}>
          {state.loading ? (
            state.viewMode === 'card' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: ORDERS_PER_PAGE.card }).map((_, i) => (
                  <OrderCardSkeleton key={i} isRtl={isRtl} />
                ))}
              </div>
            ) : (
              <OrderTableSkeleton isRtl={isRtl} />
            )
          ) : state.orders.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-gray-500">{isRtl ? 'لا توجد طلبات' : 'No orders found'}</p>
            </Card>
          ) : state.viewMode === 'card' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {state.orders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  updateOrderStatus={updateOrderStatus}
                  openAssignModal={openAssignModal}
                  calculateAdjustedTotal={calculateAdjustedTotal}
                  calculateTotalQuantity={calculateTotalQuantity}
                  translateUnit={translateUnit}
                  submitting={state.submitting}
                  isRtl={isRtl}
                />
              ))}
            </div>
          ) : (
            <OrderTable
              orders={state.orders}
              calculateAdjustedTotal={calculateAdjustedTotal}
              calculateTotalQuantity={calculateTotalQuantity}
              translateUnit={translateUnit}
              updateOrderStatus={updateOrderStatus}
              openAssignModal={openAssignModal}
              submitting={state.submitting}
              isRtl={isRtl}
              startIndex={(state.currentPage - 1) * ORDERS_PER_PAGE.table + 1}
            />
          )}
        </Suspense>
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={state.currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          isRtl={isRtl}
        />
      )}

      <AnimatePresence>
        {state.isAssignModalOpen && state.selectedOrder && (
          <Suspense fallback={<div>Loading modal...</div>}>
            <AssignChefsModal
              order={state.selectedOrder}
              chefs={state.chefs}
              assignFormData={state.assignFormData}
              setAssignFormData={(data) => dispatch({ type: 'SET_ASSIGN_FORM', payload: data })}
              onAssign={() => assignChefs(state.selectedOrder!.id)}
              onClose={() => dispatch({ type: 'SET_MODAL', modal: 'assign', isOpen: false })}
              isSubmitting={state.submitting === state.selectedOrder.id}
              isRtl={isRtl}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
};