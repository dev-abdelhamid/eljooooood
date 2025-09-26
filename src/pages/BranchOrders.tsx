import React, { useReducer, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { ordersAPI, inventoryAPI, returnsAPI, chefsAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Select } from '../components/UI/Select';
import SearchInput from '../components/UI/SearchInput';
import { ShoppingCart, Download, Upload, Table2, Grid, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { debounce } from 'lodash';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { useOrderNotifications } from '../hooks/useOrderNotifications';
import { Order, ReturnForm, AssignChefsForm, OrderStatus, ItemStatus, ReturnStatus, Priority, Branch, Chef } from '../../types/types';
import { formatDate } from '../utils/formatDate';
import OrderCardSkeleton from '../components/branch/OrderCardSkeleton';
import OrderTableSkeleton from '../components/branch/OrderTableSkeleton';

// Lazy-loaded components
const OrderTable = lazy(() => import('../components/branch/OrderTable'));
const OrderCard = lazy(() => import('../components/branch/OrderCard'));
const Pagination = lazy(() => import('../components/branch/Pagination'));
const ViewModal = lazy(() => import('../components/branch/ViewModal'));
const AssignChefsModal = lazy(() => import('../components/branch/AssignChefsModal'));
const ActionModal = lazy(() => import('../components/branch/ActionModal'));
const ReturnModal = lazy(() => import('../components/branch/ReturnModal'));

// State and Action interfaces
interface State {
  orders: Order[];
  selectedOrder: Order | null;
  chefs: Chef[];
  branches: Branch[];
  isViewModalOpen: boolean;
  isAssignModalOpen: boolean;
  isActionModalOpen: boolean;
  isReturnModalOpen: boolean;
  actionType: 'approve' | 'reject' | null;
  actionNotes: string;
  assignFormData: AssignChefsForm;
  returnFormData: ReturnForm;
  searchQuery: string;
  filterStatus: string;
  filterBranch: string;
  sortBy: 'date' | 'totalAmount' | 'priority' | 'orderNumber';
  sortOrder: 'asc' | 'desc';
  currentPage: number;
  totalCount: number;
  loading: boolean;
  error: string;
  submitting: string | null;
  socketConnected: boolean;
  socketError: string | null;
  viewMode: 'card' | 'table';
}

// Initial state
const initialState: State = {
  orders: [],
  selectedOrder: null,
  chefs: [],
  branches: [],
  isViewModalOpen: false,
  isAssignModalOpen: false,
  isActionModalOpen: false,
  isReturnModalOpen: false,
  actionType: null,
  actionNotes: '',
  assignFormData: { items: [] },
  returnFormData: { itemId: '', quantity: 0, reason: '', notes: '' },
  searchQuery: '',
  filterStatus: '',
  filterBranch: '',
  sortBy: 'date',
  sortOrder: 'desc',
  currentPage: 1,
  totalCount: 0,
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
      return { ...state, orders: action.payload, totalCount: action.payload.length, error: '' };
    case 'ADD_ORDER':
      return { ...state, orders: [action.payload, ...state.orders.filter(o => o.id !== action.payload.id)] };
    case 'SET_SELECTED_ORDER':
      return { ...state, selectedOrder: action.payload };
    case 'SET_CHEFS':
      return { ...state, chefs: action.payload };
    case 'SET_BRANCHES':
      return { ...state, branches: action.payload };
    case 'SET_MODAL':
      return { ...state, [`is${action.modal!.charAt(0).toUpperCase() + action.modal!.slice(1)}ModalOpen`]: action.isOpen };
    case 'SET_ASSIGN_FORM':
      return { ...state, assignFormData: action.payload };
    case 'SET_RETURN_FORM':
      return { ...state, returnFormData: action.payload };
    case 'SET_FILTER_STATUS':
      return { ...state, filterStatus: action.payload, currentPage: 1 };
    case 'SET_FILTER_BRANCH':
      return { ...state, filterBranch: action.payload, currentPage: 1 };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload, currentPage: 1 };
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
    case 'UPDATE_ORDER_STATUS':
      return {
        ...state,
        orders: state.orders.map(o => (o.id === action.orderId ? { ...o, status: action.status } : o)),
        selectedOrder: state.selectedOrder?.id === action.orderId ? { ...state.selectedOrder, status: action.status } : state.selectedOrder,
      };
    case 'UPDATE_ITEM_STATUS':
      return {
        ...state,
        orders: state.orders.map(order =>
          order.id === action.orderId
            ? {
                ...order,
                items: order.items.map(item =>
                  item.itemId === action.payload.itemId ? { ...item, status: action.payload.status } : item
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
                item.itemId === action.payload.itemId ? { ...item, status: action.payload.status } : item
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
                  action.items.some((task: any) => task._id === item.itemId)
                    ? {
                        ...item,
                        assignedTo: action.items.find((task: any) => task._id === item.itemId)?.assignedTo,
                        status: ItemStatus.Assigned,
                      }
                    : item
                ),
              }
            : order
        ),
      };
    case 'ADD_RETURN':
      return {
        ...state,
        orders: state.orders.map(o => (o.id === action.orderId ? { ...o, returns: [...(o.returns || []), action.returnData] } : o)),
        selectedOrder: state.selectedOrder?.id === action.orderId ? { ...state.selectedOrder, returns: [...(state.selectedOrder.returns || []), action.returnData] } : state.selectedOrder,
      };
    case 'UPDATE_RETURN_STATUS':
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === action.orderId
            ? {
                ...o,
                returns: o.returns?.map(r => (r.returnId === action.returnId ? { ...r, status: action.status, reviewNotes: action.reviewNotes } : r)) || [],
                adjustedTotal: action.adjustedTotal ?? o.adjustedTotal,
              }
            : o
        ),
        selectedOrder: state.selectedOrder?.id === action.orderId
          ? {
              ...state.selectedOrder,
              returns: state.selectedOrder.returns?.map(r => (r.returnId === action.returnId ? { ...r, status: action.status, reviewNotes: action.reviewNotes } : r)) || [],
              adjustedTotal: action.adjustedTotal ?? state.selectedOrder.adjustedTotal,
            }
          : state.selectedOrder,
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
    case 'SET_ACTION_MODAL':
      return { ...state, isActionModalOpen: action.isOpen };
    case 'SET_ACTION_TYPE':
      return { ...state, actionType: action.payload };
    case 'SET_ACTION_NOTES':
      return { ...state, actionNotes: action.payload };
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
  { value: 'priority', label: 'sort_priority' },
  { value: 'orderNumber', label: 'sort_order_number' },
];

// Utility functions
const getDisplayName = (name: string | undefined | null, nameEn: string | undefined | null, isRtl: boolean): string => {
  return isRtl ? name || 'غير معروف' : nameEn || name || 'Unknown';
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

// Main component
const BranchOrders: React.FC = () => {
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
    if (!user?.role || !['admin', 'production'].includes(user.role)) {
      dispatch({ type: 'SET_ERROR', payload: isRtl ? 'صلاحيات غير كافية' : 'Insufficient permissions' });
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

    socket.on('newOrderFromBranch', (order: any) => {
      if (!order || !order._id || !order.branch || !order.branch._id) {
        console.warn('Invalid new order data:', order);
        return;
      }
      const mappedOrder: Order = {
        id: order._id,
        orderNumber: order.orderNumber || 'N/A',
        branchId: order.branch._id,
        branchName: order.branch.name || (isRtl ? 'غير معروف' : 'Unknown'),
        branchNameEn: order.branch.nameEn,
        branch: {
          _id: order.branch._id,
          name: order.branch.name || (isRtl ? 'غير معروف' : 'Unknown'),
          nameEn: order.branch.nameEn,
          displayName: getDisplayName(order.branch.name, order.branch.nameEn, isRtl),
        },
        items: Array.isArray(order.items)
          ? order.items
              .filter((item: any) => item && item.product && item.product._id)
              .map((item: any) => ({
                _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
                itemId: item._id || `temp-${Math.random().toString(36).substring(2)}`,
                productId: item.product._id,
                productName: getDisplayName(item.product.name, item.product.nameEn, isRtl),
                productNameEn: item.product.nameEn,
                quantity: Number(item.quantity) || 0,
                price: Number(item.price) || 0,
                unit: item.product.unit || 'unit',
                unitEn: item.product.unitEn,
                displayUnit: getDisplayName(item.product.unit, item.product.unitEn, isRtl),
                department: {
                  _id: item.product.department?._id || 'unknown',
                  name: item.product.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                  nameEn: item.product.department?.nameEn,
                  displayName: getDisplayName(item.product.department?.name, item.product.department?.nameEn, isRtl),
                },
                status: item.status || ItemStatus.Pending,
                returnedQuantity: Number(item.returnedQuantity) || 0,
                returnReason: item.returnReason || '',
                returnReasonEn: item.returnReasonEn,
                displayReturnReason: getDisplayName(item.returnReason, item.returnReasonEn, isRtl),
                assignedTo: item.assignedTo
                  ? {
                      _id: item.assignedTo._id,
                      username: item.assignedTo.username,
                      name: item.assignedTo.name,
                      nameEn: item.assignedTo.nameEn,
                      displayName: getDisplayName(item.assignedTo.name, item.assignedTo.nameEn, isRtl),
                      department: {
                        _id: item.assignedTo.department?._id || 'unknown',
                        name: item.assignedTo.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                        nameEn: item.assignedTo.department?.nameEn,
                        displayName: getDisplayName(item.assignedTo.department?.name, item.assignedTo.department?.nameEn, isRtl),
                      },
                    }
                  : undefined,
                startedAt: item.startedAt ? formatDate(new Date(item.startedAt), language) : undefined,
                completedAt: item.completedAt ? formatDate(new Date(item.completedAt), language) : undefined,
              }))
          : [],
        returns: Array.isArray(order.returns)
          ? order.returns.map((ret: any) => ({
              returnId: ret._id || `temp-${Math.random().toString(36).substring(2)}`,
              returnNumber: ret.returnNumber || `RET-${Math.random().toString(36).substring(2, 8)}`,
              items: Array.isArray(ret.items)
                ? ret.items
                    .filter((item: any) => item && item.product && item.product._id)
                    .map((item: any) => ({
                      productId: item.product._id,
                      productName: getDisplayName(item.product.name, item.product.nameEn, isRtl),
                      productNameEn: item.product.nameEn,
                      quantity: Number(item.quantity) || 0,
                      unit: item.product.unit || 'unit',
                      unitEn: item.product.unitEn,
                      displayUnit: getDisplayName(item.product.unit, item.product.unitEn, isRtl),
                      reason: item.reason || 'unknown',
                      reasonEn: item.reasonEn,
                      displayReason: getDisplayName(item.reason, item.reasonEn, isRtl),
                      status: item.status || ReturnStatus.PendingApproval,
                      reviewNotes: item.reviewNotes || '',
                      reviewNotesEn: item.reviewNotesEn,
                      displayReviewNotes: getDisplayName(item.reviewNotes, item.reviewNotesEn, isRtl),
                    }))
                : [],
              status: ret.status || ReturnStatus.PendingApproval,
              reviewNotes: ret.reviewNotes || '',
              reviewNotesEn: ret.reviewNotesEn,
              displayReviewNotes: getDisplayName(ret.reviewNotes, ret.reviewNotesEn, isRtl),
              createdAt: formatDate(ret.createdAt ? new Date(ret.createdAt) : new Date(), language),
              createdBy: {
                _id: ret.createdBy?._id || 'unknown',
                username: ret.createdBy?.username || 'unknown',
                name: ret.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                nameEn: ret.createdBy?.nameEn,
                displayName: getDisplayName(ret.createdBy?.name, ret.createdBy?.nameEn, isRtl),
              },
              reviewedBy: ret.reviewedBy
                ? {
                    _id: ret.reviewedBy._id,
                    username: ret.reviewedBy.username,
                    name: ret.reviewedBy.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: ret.reviewedBy.nameEn,
                    displayName: getDisplayName(ret.reviewedBy.name, ret.reviewedBy.nameEn, isRtl),
                  }
                : undefined,
            }))
          : [],
        status: order.status || OrderStatus.Pending,
        totalAmount: Number(order.totalAmount) || 0,
        adjustedTotal: Number(order.totalAmount) || 0,
        date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
        requestedDeliveryDate: formatDate(order.requestedDeliveryDate ? new Date(order.requestedDeliveryDate) : new Date(), language),
        notes: order.notes || '',
        notesEn: order.notesEn,
        displayNotes: getDisplayName(order.notes, order.notesEn, isRtl),
        priority: order.priority || Priority.Medium,
        createdBy: order.createdBy?.username || (isRtl ? 'غير معروف' : 'Unknown'),
        createdByName: getDisplayName(order.createdBy?.name, order.createdBy?.nameEn, isRtl),
        statusHistory: Array.isArray(order.statusHistory)
          ? order.statusHistory.map((history: any) => ({
              status: history.status || OrderStatus.Pending,
              changedBy: history.changedBy || 'unknown',
              changedByName: getDisplayName(history.changedByName, history.changedByNameEn, isRtl),
              changedAt: formatDate(history.changedAt ? new Date(history.changedAt) : new Date(), language),
              notes: history.notes || '',
              notesEn: history.notesEn,
              displayNotes: getDisplayName(history.notes, history.notesEn, isRtl),
            }))
          : [],
        approvedBy: order.approvedBy
          ? {
              _id: order.approvedBy._id,
              name: order.approvedBy.name || (isRtl ? 'غير معروف' : 'Unknown'),
              nameEn: order.approvedBy.nameEn,
              displayName: getDisplayName(order.approvedBy.name, order.approvedBy.nameEn, isRtl),
            }
          : undefined,
        approvedAt: order.approvedAt ? formatDate(new Date(order.approvedAt), language) : undefined,
        deliveredAt: order.deliveredAt ? formatDate(new Date(order.deliveredAt), language) : undefined,
        transitStartedAt: order.transitStartedAt ? formatDate(new Date(order.transitStartedAt), language) : undefined,
        isRtl,
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
            branchId: updatedOrder.branch._id,
            branchName: updatedOrder.branch.name || (isRtl ? 'غير معروف' : 'Unknown'),
            branchNameEn: updatedOrder.branch.nameEn,
            branch: {
              _id: updatedOrder.branch._id,
              name: updatedOrder.branch.name || (isRtl ? 'غير معروف' : 'Unknown'),
              nameEn: updatedOrder.branch.nameEn,
              displayName: getDisplayName(updatedOrder.branch.name, updatedOrder.branch.nameEn, isRtl),
            },
            items: Array.isArray(updatedOrder.items)
              ? updatedOrder.items
                  .filter((item: any) => item && item.product && item.product._id)
                  .map((item: any) => ({
                    _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
                    itemId: item._id || `temp-${Math.random().toString(36).substring(2)}`,
                    productId: item.product._id,
                    productName: getDisplayName(item.product.name, item.product.nameEn, isRtl),
                    productNameEn: item.product.nameEn,
                    quantity: Number(item.quantity) || 0,
                    price: Number(item.price) || 0,
                    unit: item.product.unit || 'unit',
                    unitEn: item.product.unitEn,
                    displayUnit: getDisplayName(item.product.unit, item.product.unitEn, isRtl),
                    department: {
                      _id: item.product.department?._id || 'unknown',
                      name: item.product.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                      nameEn: item.product.department?.nameEn,
                      displayName: getDisplayName(item.product.department?.name, item.product.department?.nameEn, isRtl),
                    },
                    status: item.status || ItemStatus.Pending,
                    returnedQuantity: Number(item.returnedQuantity) || 0,
                    returnReason: item.returnReason || '',
                    returnReasonEn: item.returnReasonEn,
                    displayReturnReason: getDisplayName(item.returnReason, item.returnReasonEn, isRtl),
                    assignedTo: item.assignedTo
                      ? {
                          _id: item.assignedTo._id,
                          username: item.assignedTo.username,
                          name: item.assignedTo.name,
                          nameEn: item.assignedTo.nameEn,
                          displayName: getDisplayName(item.assignedTo.name, item.assignedTo.nameEn, isRtl),
                          department: {
                            _id: item.assignedTo.department?._id || 'unknown',
                            name: item.assignedTo.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                            nameEn: item.assignedTo.department?.nameEn,
                            displayName: getDisplayName(item.assignedTo.department?.name, item.assignedTo.department?.nameEn, isRtl),
                          },
                        }
                      : undefined,
                    startedAt: item.startedAt ? formatDate(new Date(item.startedAt), language) : undefined,
                    completedAt: item.completedAt ? formatDate(new Date(item.completedAt), language) : undefined,
                  }))
              : [],
            returns: Array.isArray(updatedOrder.returns)
              ? updatedOrder.returns.map((ret: any) => ({
                  returnId: ret._id || `temp-${Math.random().toString(36).substring(2)}`,
                  returnNumber: ret.returnNumber || `RET-${Math.random().toString(36).substring(2, 8)}`,
                  items: Array.isArray(ret.items)
                    ? ret.items
                        .filter((item: any) => item && item.product && item.product._id)
                        .map((item: any) => ({
                          productId: item.product._id,
                          productName: getDisplayName(item.product.name, item.product.nameEn, isRtl),
                          productNameEn: item.product.nameEn,
                          quantity: Number(item.quantity) || 0,
                          unit: item.product.unit || 'unit',
                          unitEn: item.product.unitEn,
                          displayUnit: getDisplayName(item.product.unit, item.product.unitEn, isRtl),
                          reason: item.reason || 'unknown',
                          reasonEn: item.reasonEn,
                          displayReason: getDisplayName(item.reason, item.reasonEn, isRtl),
                          status: item.status || ReturnStatus.PendingApproval,
                          reviewNotes: item.reviewNotes || '',
                          reviewNotesEn: item.reviewNotesEn,
                          displayReviewNotes: getDisplayName(item.reviewNotes, item.reviewNotesEn, isRtl),
                        }))
                    : [],
                  status: ret.status || ReturnStatus.PendingApproval,
                  reviewNotes: ret.reviewNotes || '',
                  reviewNotesEn: ret.reviewNotesEn,
                  displayReviewNotes: getDisplayName(ret.reviewNotes, ret.reviewNotesEn, isRtl),
                  createdAt: formatDate(ret.createdAt ? new Date(ret.createdAt) : new Date(), language),
                  createdBy: {
                    _id: ret.createdBy?._id || 'unknown',
                    username: ret.createdBy?.username || 'unknown',
                    name: ret.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: ret.createdBy?.nameEn,
                    displayName: getDisplayName(ret.createdBy?.name, ret.createdBy?.nameEn, isRtl),
                  },
                  reviewedBy: ret.reviewedBy
                    ? {
                        _id: ret.reviewedBy._id,
                        username: ret.reviewedBy.username,
                        name: ret.reviewedBy.name || (isRtl ? 'غير معروف' : 'Unknown'),
                        nameEn: ret.reviewedBy.nameEn,
                        displayName: getDisplayName(ret.reviewedBy.name, ret.reviewedBy.nameEn, isRtl),
                      }
                    : undefined,
                }))
              : [],
            status: updatedOrder.status || status,
            totalAmount: Number(updatedOrder.totalAmount) || 0,
            adjustedTotal: Number(updatedOrder.totalAmount) || 0,
            date: formatDate(updatedOrder.createdAt ? new Date(updatedOrder.createdAt) : new Date(), language),
            requestedDeliveryDate: formatDate(updatedOrder.requestedDeliveryDate ? new Date(updatedOrder.requestedDeliveryDate) : new Date(), language),
            notes: updatedOrder.notes || '',
            notesEn: updatedOrder.notesEn,
            displayNotes: getDisplayName(updatedOrder.notes, updatedOrder.notesEn, isRtl),
            priority: updatedOrder.priority || Priority.Medium,
            createdBy: updatedOrder.createdBy?.username || (isRtl ? 'غير معروف' : 'Unknown'),
            createdByName: getDisplayName(updatedOrder.createdBy?.name, updatedOrder.createdBy?.nameEn, isRtl),
            statusHistory: Array.isArray(updatedOrder.statusHistory)
              ? updatedOrder.statusHistory.map((history: any) => ({
                  status: history.status || OrderStatus.Pending,
                  changedBy: history.changedBy || 'unknown',
                  changedByName: getDisplayName(history.changedByName, history.changedByNameEn, isRtl),
                  changedAt: formatDate(history.changedAt ? new Date(history.changedAt) : new Date(), language),
                  notes: history.notes || '',
                  notesEn: history.notesEn,
                  displayNotes: getDisplayName(history.notes, history.notesEn, isRtl),
                }))
              : [],
            approvedBy: updatedOrder.approvedBy
              ? {
                  _id: updatedOrder.approvedBy._id,
                  name: updatedOrder.approvedBy.name || (isRtl ? 'غير معروف' : 'Unknown'),
                  nameEn: updatedOrder.approvedBy.nameEn,
                  displayName: getDisplayName(updatedOrder.approvedBy.name, updatedOrder.approvedBy.nameEn, isRtl),
                }
              : undefined,
            approvedAt: updatedOrder.approvedAt ? formatDate(new Date(updatedOrder.approvedAt), language) : undefined,
            deliveredAt: updatedOrder.deliveredAt ? formatDate(new Date(updatedOrder.deliveredAt), language) : undefined,
            transitStartedAt: updatedOrder.transitStartedAt ? formatDate(new Date(updatedOrder.transitStartedAt), language) : undefined,
            isRtl,
          };
          dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status });
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

    socket.on('returnStatusUpdated', async ({ returnId, orderId, status, reviewNotes }: { returnId: string; orderId: string; status: ReturnStatus; reviewNotes?: string }) => {
      if (!returnId || !orderId || !status) {
        console.warn('Invalid return status update data:', { returnId, orderId, status });
        return;
      }
      try {
        const order = state.orders.find(o => o.id === orderId);
        if (status === ReturnStatus.Approved && order?.returns && user?.id) {
          const returnData = order.returns.find(r => r.returnId === returnId);
          if (returnData && returnData.items) {
            await inventoryAPI.processReturnItems(returnId, {
              branchId: order.branchId,
              items: returnData.items.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                status: ReturnStatus.Approved,
                reviewNotes: item.reviewNotes || '',
              })),
            });
            const adjustedTotal = order.adjustedTotal - returnData.items.reduce((sum, item) => {
              const orderItem = order.items.find(i => i.productId === item.productId);
              return sum + (orderItem ? orderItem.price * item.quantity : 0);
            }, 0);
            dispatch({ type: 'UPDATE_RETURN_STATUS', orderId, returnId, status, reviewNotes, adjustedTotal });
            toast.success(
              isRtl ? 'تمت معالجة الإرجاع وتحديث المخزون' : 'Return processed and inventory updated',
              { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 }
            );
          }
        } else {
          dispatch({ type: 'UPDATE_RETURN_STATUS', orderId, returnId, status, reviewNotes });
        }
        toast.info(
          isRtl ? `تم تحديث حالة الإرجاع إلى: ${t(`orders.return_status_${status}`)}` : `Return status updated to: ${t(`orders.return_status_${status}`)}`,
          { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 }
        );
      } catch (err: any) {
        console.error('Failed to process return:', err);
        toast.error(
          isRtl ? `فشل في معالجة الإرجاع: ${err.message}` : `Failed to process return: ${err.message}`,
          { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 }
        );
      }
    });

    socket.on('taskAssigned', ({ orderId, items }: { orderId: string; items: any[] }) => {
      dispatch({ type: 'TASK_ASSIGNED', orderId, items });
      toast.info(isRtl ? 'تم تعيين المهام' : 'Tasks assigned', { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
    });

    socket.on('missingAssignments', ({ orderId, itemId, productName }: { orderId: string; itemId: string; productName: string }) => {
      dispatch({ type: 'MISSING_ASSIGNMENTS', orderId, itemId, productName });
      toast.warn(
        isRtl ? `المنتج ${getDisplayName(productName, productName, isRtl)} بحاجة إلى تعيين` : `Product ${getDisplayName(productName, productName, isRtl)} needs assignment`,
        { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 }
      );
    });

    return () => {
      socket.off('connect');
      socket.off('connect_error');
      socket.off('newOrderFromBranch');
      socket.off('orderStatusUpdated');
      socket.off('returnStatusUpdated');
      socket.off('taskAssigned');
      socket.off('missingAssignments');
    };
  }, [user, t, isRtl, language, socket, emit, playNotificationSound]);

  // Fetch orders, chefs, and branches
  const fetchData = useCallback(
    async (retryCount = 0) => {
      if (!user?.role || !['admin', 'production'].includes(user.role)) {
        const errorMessage = isRtl ? 'صلاحيات غير كافية' : 'Insufficient permissions';
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      dispatch({ type: 'SET_LOADING', payload: true });
      const cacheKey = `${state.filterStatus}-${state.filterBranch}-${state.currentPage}-${state.viewMode}`;
      if (cacheRef.current.has(cacheKey)) {
        dispatch({ type: 'SET_ORDERS', payload: cacheRef.current.get(cacheKey)! });
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      try {
        const [ordersResponse, chefsResponse, branchesResponse] = await Promise.all([
          ordersAPI.getAll({
            status: state.filterStatus || undefined,
            branch: state.filterBranch || undefined,
            page: state.currentPage,
            limit: ORDERS_PER_PAGE[state.viewMode],
            search: state.searchQuery || undefined,
            sortBy: state.sortBy,
            sortOrder: state.sortOrder,
          }),
          chefsAPI.getAll(),
          ordersAPI.getBranches(),
        ]);

        if (!Array.isArray(ordersResponse)) throw new Error('Invalid orders response format');
        if (!Array.isArray(chefsResponse)) throw new Error('Invalid chefs response format');
        if (!Array.isArray(branchesResponse)) throw new Error('Invalid branches response format');

        const mappedOrders: Order[] = ordersResponse
          .filter((order: any) => order && order._id && order.branch && order.branch._id)
          .map((order: any) => ({
            id: order._id,
            orderNumber: order.orderNumber || 'N/A',
            branchId: order.branch._id,
            branchName: order.branch.name || (isRtl ? 'غير معروف' : 'Unknown'),
            branchNameEn: order.branch.nameEn,
            branch: {
              _id: order.branch._id,
              name: order.branch.name || (isRtl ? 'غير معروف' : 'Unknown'),
              nameEn: order.branch.nameEn,
              displayName: getDisplayName(order.branch.name, order.branch.nameEn, isRtl),
            },
            items: Array.isArray(order.items)
              ? order.items
                  .filter((item: any) => item && item.product && item.product._id)
                  .map((item: any) => ({
                    _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
                    itemId: item._id || `temp-${Math.random().toString(36).substring(2)}`,
                    productId: item.product._id,
                    productName: getDisplayName(item.product.name, item.product.nameEn, isRtl),
                    productNameEn: item.product.nameEn,
                    quantity: Number(item.quantity) || 0,
                    price: Number(item.price) || 0,
                    unit: item.product.unit || 'unit',
                    unitEn: item.product.unitEn,
                    displayUnit: getDisplayName(item.product.unit, item.product.unitEn, isRtl),
                    department: {
                      _id: item.product.department?._id || 'unknown',
                      name: item.product.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                      nameEn: item.product.department?.nameEn,
                      displayName: getDisplayName(item.product.department?.name, item.product.department?.nameEn, isRtl),
                    },
                    status: item.status || ItemStatus.Pending,
                    returnedQuantity: Number(item.returnedQuantity) || 0,
                    returnReason: item.returnReason || '',
                    returnReasonEn: item.returnReasonEn,
                    displayReturnReason: getDisplayName(item.returnReason, item.returnReasonEn, isRtl),
                    assignedTo: item.assignedTo
                      ? {
                          _id: item.assignedTo._id,
                          username: item.assignedTo.username,
                          name: item.assignedTo.name,
                          nameEn: item.assignedTo.nameEn,
                          displayName: getDisplayName(item.assignedTo.name, item.assignedTo.nameEn, isRtl),
                          department: {
                            _id: item.assignedTo.department?._id || 'unknown',
                            name: item.assignedTo.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                            nameEn: item.assignedTo.department?.nameEn,
                            displayName: getDisplayName(item.assignedTo.department?.name, item.assignedTo.department?.nameEn, isRtl),
                          },
                        }
                      : undefined,
                    startedAt: item.startedAt ? formatDate(new Date(item.startedAt), language) : undefined,
                    completedAt: item.completedAt ? formatDate(new Date(item.completedAt), language) : undefined,
                  }))
              : [],
            returns: Array.isArray(order.returns)
              ? order.returns.map((ret: any) => ({
                  returnId: ret._id || `temp-${Math.random().toString(36).substring(2)}`,
                  returnNumber: ret.returnNumber || `RET-${Math.random().toString(36).substring(2, 8)}`,
                  items: Array.isArray(ret.items)
                    ? ret.items
                        .filter((item: any) => item && item.product && item.product._id)
                        .map((item: any) => ({
                          productId: item.product._id,
                          productName: getDisplayName(item.product.name, item.product.nameEn, isRtl),
                          productNameEn: item.product.nameEn,
                          quantity: Number(item.quantity) || 0,
                          unit: item.product.unit || 'unit',
                          unitEn: item.product.unitEn,
                          displayUnit: getDisplayName(item.product.unit, item.product.unitEn, isRtl),
                          reason: item.reason || 'unknown',
                          reasonEn: item.reasonEn,
                          displayReason: getDisplayName(item.reason, item.reasonEn, isRtl),
                          status: item.status || ReturnStatus.PendingApproval,
                          reviewNotes: item.reviewNotes || '',
                          reviewNotesEn: item.reviewNotesEn,
                          displayReviewNotes: getDisplayName(item.reviewNotes, item.reviewNotesEn, isRtl),
                        }))
                    : [],
                  status: ret.status || ReturnStatus.PendingApproval,
                  reviewNotes: ret.reviewNotes || '',
                  reviewNotesEn: ret.reviewNotesEn,
                  displayReviewNotes: getDisplayName(ret.reviewNotes, ret.reviewNotesEn, isRtl),
                  createdAt: formatDate(ret.createdAt ? new Date(ret.createdAt) : new Date(), language),
                  createdBy: {
                    _id: ret.createdBy?._id || 'unknown',
                    username: ret.createdBy?.username || 'unknown',
                    name: ret.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: ret.createdBy?.nameEn,
                    displayName: getDisplayName(ret.createdBy?.name, ret.createdBy?.nameEn, isRtl),
                  },
                  reviewedBy: ret.reviewedBy
                    ? {
                        _id: ret.reviewedBy._id,
                        username: ret.reviewedBy.username,
                        name: ret.reviewedBy.name || (isRtl ? 'غير معروف' : 'Unknown'),
                        nameEn: ret.reviewedBy.nameEn,
                        displayName: getDisplayName(ret.reviewedBy.name, ret.reviewedBy.nameEn, isRtl),
                      }
                    : undefined,
                }))
              : [],
            status: order.status || OrderStatus.Pending,
            totalAmount: Number(order.totalAmount) || 0,
            adjustedTotal: Number(order.totalAmount) || 0,
            date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
            requestedDeliveryDate: formatDate(order.requestedDeliveryDate ? new Date(order.requestedDeliveryDate) : new Date(), language),
            notes: order.notes || '',
            notesEn: order.notesEn,
            displayNotes: getDisplayName(order.notes, order.notesEn, isRtl),
            priority: order.priority || Priority.Medium,
            createdBy: order.createdBy?.username || (isRtl ? 'غير معروف' : 'Unknown'),
            createdByName: getDisplayName(order.createdBy?.name, order.createdBy?.nameEn, isRtl),
            statusHistory: Array.isArray(order.statusHistory)
              ? order.statusHistory.map((history: any) => ({
                  status: history.status || OrderStatus.Pending,
                  changedBy: history.changedBy || 'unknown',
                  changedByName: getDisplayName(history.changedByName, history.changedByNameEn, isRtl),
                  changedAt: formatDate(history.changedAt ? new Date(history.changedAt) : new Date(), language),
                  notes: history.notes || '',
                  notesEn: history.notesEn,
                  displayNotes: getDisplayName(history.notes, history.notesEn, isRtl),
                }))
              : [],
            approvedBy: order.approvedBy
              ? {
                  _id: order.approvedBy._id,
                  name: order.approvedBy.name || (isRtl ? 'غير معروف' : 'Unknown'),
                  nameEn: order.approvedBy.nameEn,
                  displayName: getDisplayName(order.approvedBy.name, order.appliedBy.nameEn, isRtl),
                }
              : undefined,
            approvedAt: order.approvedAt ? formatDate(new Date(order.approvedAt), language) : undefined,
            deliveredAt: order.deliveredAt ? formatDate(new Date(order.deliveredAt), language) : undefined,
            transitStartedAt: order.transitStartedAt ? formatDate(new Date(order.transitStartedAt), language) : undefined,
            isRtl,
          }));
        cacheRef.current.set(cacheKey, mappedOrders);
        dispatch({ type: 'SET_ORDERS', payload: mappedOrders });
        dispatch({ type: 'SET_CHEFS', payload: chefsResponse });
        dispatch({ type: 'SET_BRANCHES', payload: branchesResponse });
        dispatch({ type: 'SET_ERROR', payload: '' });
      } catch (err: any) {
        console.error('Fetch data error:', err.message, err.response?.data);
        if (retryCount < 2) {
          console.log(`Retrying fetchData (attempt ${retryCount + 1})`);
          setTimeout(() => fetchData(retryCount + 1), 1000);
          return;
        }
        const errorMessage = err.response?.status === 404 ? (isRtl ? 'لم يتم العثور على طلبات' : 'No orders found') : (isRtl ? `خطأ في جلب البيانات: ${err.message}` : `Error fetching data: ${err.message}`);
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [user, state.filterStatus, state.filterBranch, state.currentPage, state.viewMode, state.searchQuery, state.sortBy, state.sortOrder, isRtl, t, language]
  );

  // Calculate adjusted total for an order
  const calculateAdjustedTotal = useCallback((order: Order) => {
    const approvedReturnsTotal = (order.returns || []).filter(ret => ret.status === ReturnStatus.Approved).reduce((sum, ret) => {
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
  }, [isRtl]);

  // Calculate total quantity for an order
  const calculateTotalQuantity = useCallback((order: Order) => {
    return order.items.reduce((sum, item) => sum + item.quantity, 0);
  }, []);

  // Export to Excel
  const exportToExcel = useCallback(() => {
    const headers = [
      isRtl ? 'رقم الطلب' : 'Order Number',
      isRtl ? 'الحالة' : 'Status',
      isRtl ? 'الفرع' : 'Branch',
      isRtl ? 'المنتجات' : 'Products',
      isRtl ? 'إجمالي المبلغ' : 'Total Amount',
      isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
      isRtl ? 'التاريخ' : 'Date',
      isRtl ? 'الأولوية' : 'ofday',
    ];
    const data = state.orders.map(order => ({
      [headers[0]]: order.orderNumber,
      [headers[1]]: t(`orders.status_${order.status}`) || order.status,
      [headers[2]]: order.branch.displayName,
      [headers[3]]: order.items.map(item => `(${item.quantity} ${t(`units.${item.unit}`) || item.displayUnit} × ${item.productName})`).join(' + '),
      [headers[4]]: calculateAdjustedTotal(order),
      [headers[5]]: calculateTotalQuantity(order),
      [headers[6]]: order.date,
      [headers[7]]: t(`orders.priority_${order.priority}`) || order.priority,
    }));
    const ws = XLSX.utils.json_to_sheet(isRtl ? data.map(row => Object.fromEntries(Object.entries(row).reverse())) : data, { header: headers });
    if (isRtl) ws['!views'] = [{ RTL: true }];
    ws['!cols'] = [
      { wch: 15 }, // Order Number
      { wch: 15 }, // Status
      { wch: 20 }, // Branch
      { wch: 40 }, // Products
      { wch: 20 }, // Total Amount
      { wch: 15 }, // Total Quantity
      { wch: 20 }, // Date
      { wch: 15 }, // Priority
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isRtl ? 'الطلبات' : 'Orders');
    XLSX.writeFile(wb, 'AdminOrders.xlsx');
    toast.success(isRtl ? 'تم تصدير الملف بنجاح' : 'Export successful', { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
  }, [state.orders, t, isRtl, calculateAdjustedTotal, calculateTotalQuantity]);

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
      const base64Font = arrayBufferToBase64(fontBytes);
      doc.addFileToVFS(`${fontName}-Regular.ttf`, base64Font);
      doc.addFont(`${fontName}-Regular.ttf`, fontName, 'normal');
      doc.setFont(fontName);

      doc.setFontSize(16);
      doc.text(isRtl ? 'الطلبات' : 'Orders', isRtl ? doc.internal.pageSize.width - 20 : 20, 15, { align: isRtl ? 'right' : 'left' });

      const headers = [
        isRtl ? 'رقم الطلب' : 'Order Number',
        isRtl ? 'الحالة' : 'Status',
        isRtl ? 'الفرع' : 'Branch',
        isRtl ? 'المنتجات' : 'Products',
        isRtl ? 'إجمالي المبلغ' : 'Total Amount',
        isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
        isRtl ? 'التاريخ' : 'Date',
        isRtl ? 'الأولوية' : 'Priority',
      ];

      const data = state.orders.map(order => [
        order.orderNumber,
        t(`orders.status_${order.status}`) || order.status,
        order.branch.displayName,
        order.items.map(item => `(${item.quantity} ${t(`units.${item.unit}`) || item.displayUnit} × ${item.productName})`).join(' + '),
        calculateAdjustedTotal(order),
        calculateTotalQuantity(order).toString(),
        order.date,
        t(`orders.priority_${order.priority}`) || order.priority,
      ]);

      autoTable(doc, {
        head: [isRtl ? headers.reverse() : headers],
        body: isRtl ? data.map(row => row.reverse()) : data,
        theme: 'grid',
        headStyles: { fillColor: [255, 193, 7], textColor: 255, fontSize: 10, halign: isRtl ? 'right' : 'left', font: fontName, cellPadding: 3 },
        bodyStyles: { fontSize: 8, halign: isRtl ? 'right' : 'left', font: fontName, cellPadding: 3, textColor: [33, 33, 33] },
        margin: { top: 25, left: 10, right: 10 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 20 },
          2: { cellWidth: 30 },
          3: { cellWidth: 80 },
          4: { cellWidth: 25 },
          5: { cellWidth: 20 },
          6: { cellWidth: 30 },
          7: { cellWidth: 20 },
        },
        didParseCell: data => {
          if (data.section === 'body' && data.column.index === 4 && isRtl) {
            data.cell.text = [data.cell.raw.toString().replace(/(\d+\.\d{2})/, ' $1 ر.س')];
          }
        },
        didDrawPage: data => {
          doc.setFont(fontName);
          doc.setFontSize(8);
          doc.text(
            isRtl ? `تم الإنشاء في: ${formatDate(new Date(), language)}` : `Generated on: ${formatDate(new Date(), language)}`,
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
        styles: { overflow: 'linebreak', font: fontName, fontSize: 8, cellPadding: 3, halign: isRtl ? 'right' : 'left' },
      });

      doc.save('AdminOrders.pdf');
      toast.success(isRtl ? 'تم تصدير PDF بنجاح' : 'PDF export successful', { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error(isRtl ? 'خطأ في تصدير PDF' : 'PDF export error', { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
    }
  }, [state.orders, t, isRtl, language, calculateAdjustedTotal, calculateTotalQuantity]);

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
          (!state.filterStatus || order.status === state.filterStatus) &&
          (!state.filterBranch || order.branchId === state.filterBranch)
      ),
    [state.orders, state.searchQuery, state.filterStatus, state.filterBranch]
  );

  const sortedOrders = useMemo(
    () =>
      [...filteredOrders].sort((a, b) => {
        if (state.sortBy === 'date') {
          return state.sortOrder === 'asc'
            ? new Date(a.date).getTime() - new Date(b.date).getTime()
            : new Date(b.date).getTime() - new Date(a.date).getTime();
        } else if (state.sortBy === 'totalAmount') {
          return state.sortOrder === 'asc' ? a.adjustedTotal - b.adjustedTotal : b.adjustedTotal - a.adjustedTotal;
        } else if (state.sortBy === 'priority') {
          const priorityOrder = [Priority.Urgent, Priority.High, Priority.Medium, Priority.Low];
          return state.sortOrder === 'asc'
            ? priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority)
            : priorityOrder.indexOf(b.priority) - priorityOrder.indexOf(a.priority);
        } else if (state.sortBy === 'orderNumber') {
          return state.sortOrder === 'asc'
            ? a.orderNumber.localeCompare(b.orderNumber)
            : b.orderNumber.localeCompare(a.orderNumber);
        }
        return 0;
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

  const openAssignChefsModal = useCallback((order: Order) => {
    dispatch({ type: 'SET_SELECTED_ORDER', payload: order });
    dispatch({ type: 'SET_ASSIGN_FORM', payload: { items: order.items.map(item => ({ itemId: item.itemId!, assignedTo: item.assignedTo?._id || '', product: item.productId, productNameEn: item.productNameEn, quantity: item.quantity, unit: item.unit, unitEn: item.unitEn, displayUnit: item.displayUnit })) } });
    dispatch({ type: 'SET_MODAL', modal: 'assign', isOpen: true });
  }, []);

  const openActionModal = useCallback((order: Order, actionType: 'approve' | 'reject') => {
    dispatch({ type: 'SET_SELECTED_ORDER', payload: order });
    dispatch({ type: 'SET_ACTION_TYPE', payload: actionType });
    dispatch({ type: 'SET_ACTION_NOTES', payload: '' });
    dispatch({ type: 'SET_MODAL', modal: 'action', isOpen: true });
  }, []);

  const openReturnModal = useCallback((order: Order, itemId: string) => {
    const item = order.items.find(i => i.itemId === itemId);
    dispatch({ type: 'SET_SELECTED_ORDER', payload: order });
    dispatch({ type: 'SET_RETURN_FORM', payload: { itemId, quantity: item?.quantity || 1, reason: '', notes: '' } });
    dispatch({ type: 'SET_MODAL', modal: 'return', isOpen: true });
  }, []);

  const handleAssignChefs = useCallback(
    async (e: React.FormEvent, order: Order | null, assignFormData: AssignChefsForm) => {
      e.preventDefault();
      if (!order || !user?.id || !assignFormData.items.length || state.submitting) {
        toast.error(isRtl ? 'يرجى تحديد الطلب والطهاة' : 'Please select order and chefs', { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: order.id });
      try {
        await ordersAPI.assignTasks(order.id, assignFormData);
        dispatch({
          type: 'TASK_ASSIGNED',
          orderId: order.id,
          items: assignFormData.items.map(item => ({
            _id: item.itemId,
            assignedTo: state.chefs.find(chef => chef._id === item.assignedTo),
          })),
        });
        if (socket && isConnected) {
          emit('taskAssigned', { orderId: order.id, items: assignFormData.items });
        }
        dispatch({ type: 'SET_MODAL', modal: 'assign', isOpen: false });
        dispatch({ type: 'SET_ASSIGN_FORM', payload: { items: [] } });
        playNotificationSound('/sounds/task-assigned.mp3', [200, 100, 200]);
        toast.success(isRtl ? 'تم تعيين المهام بنجاح' : 'Tasks assigned successfully', { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
      } catch (err: any) {
        console.error('Assign chefs error:', err.message, err.response?.data);
        toast.error(isRtl ? `فشل في تعيين المهام: ${err.message}` : `Failed to assign tasks: ${err.message}`, { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [user, t, isRtl, socket, isConnected, emit, playNotificationSound, state.chefs, state.submitting]
  );

  const handleAction = useCallback(
    async (e: React.FormEvent, order: Order | null, actionType: 'approve' | 'reject' | null, notes: string) => {
      e.preventDefault();
      if (!order || !user?.id || !actionType || state.submitting) {
        toast.error(isRtl ? 'يرجى تحديد الطلب والإجراء' : 'Please select order and action', { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: order.id });
      try {
        const status = actionType === 'approve' ? OrderStatus.Approved : OrderStatus.Cancelled;
        await ordersAPI.updateStatus(order.id, { status, notes, approvedBy: user.id });
        dispatch({ type: 'UPDATE_ORDER_STATUS', orderId: order.id, status });
        if (socket && isConnected) {
          emit('orderStatusUpdated', { orderId: order.id, status });
        }
        dispatch({ type: 'SET_MODAL', modal: 'action', isOpen: false });
        dispatch({ type: 'SET_ACTION_TYPE', payload: null });
        dispatch({ type: 'SET_ACTION_NOTES', payload: '' });
        playNotificationSound('/sounds/order-action.mp3', [200, 100, 200]);
        toast.success(
          isRtl ? `تم ${actionType === 'approve' ? 'الموافقة على' : 'رفض'} الطلب #${order.orderNumber}` : `${actionType === 'approve' ? 'Approved' : 'Rejected'} order #${order.orderNumber}`,
          { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 }
        );
      } catch (err: any) {
        console.error('Action error:', err.message, err.response?.data);
        toast.error(isRtl ? `فشل في ${actionType === 'approve' ? 'الموافقة على' : 'رفض'} الطلب: ${err.message}` : `Failed to ${actionType === 'approve' ? 'approve' : 'reject'} order: ${err.message}`, { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [user, t, isRtl, socket, isConnected, emit, playNotificationSound, state.submitting]
  );

  const handleReturnItem = useCallback(
    async (e: React.FormEvent, order: Order | null, returnFormData: ReturnForm) => {
      e.preventDefault();
      if (!order || !user?.id || !returnFormData.itemId || returnFormData.quantity < 1 || !returnFormData.reason || state.submitting) {
        toast.error(isRtl ? 'يرجى ملء جميع الحقول' : 'Please fill all fields', { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: order.id });
      try {
        const item = order.items.find(i => i.itemId === returnFormData.itemId);
        if (!item || !item.productId) {
          throw new Error(isRtl ? 'معرف المنتج غير صالح' : 'Invalid product ID');
        }
        const response = await returnsAPI.createReturn({
          orderId: order.id,
          branchId: order.branchId,
          reason: returnFormData.reason,
          items: [{ product: item.productId, quantity: returnFormData.quantity, reason: returnFormData.reason }],
          notes: returnFormData.notes,
        });
        const returnData: OrderReturn = {
          returnId: response._id,
          returnNumber: response.returnNumber || `RET-${Math.random().toString(36).substring(2, 8)}`,
          items: [{
            productId: item.productId,
            productName: item.productName,
            productNameEn: item.productNameEn,
            quantity: returnFormData.quantity,
            unit: item.unit,
            unitEn: item.unitEn,
            displayUnit: item.displayUnit,
            reason: returnFormData.reason,
            reasonEn: returnFormData.reasonEn,
            displayReason: getDisplayName(returnFormData.reason, returnFormData.reasonEn, isRtl),
            status: ReturnStatus.PendingApproval,
            reviewNotes: returnFormData.notes,
            reviewNotesEn: returnFormData.notesEn,
            displayReviewNotes: getDisplayName(returnFormData.notes, returnFormData.notesEn, isRtl),
          }],
          status: ReturnStatus.PendingApproval,
          reviewNotes: returnFormData.notes,
          reviewNotesEn: returnFormData.notesEn,
          displayReviewNotes: getDisplayName(returnFormData.notes, returnFormData.notesEn, isRtl),
          createdAt: formatDate(new Date(), language),
          createdBy: {
            _id: user.id,
            username: user.username,
            name: user.name,
            nameEn: user.nameEn,
            displayName: user.displayName,
          },
        };
        dispatch({ type: 'ADD_RETURN', orderId: order.id, returnData });
        dispatch({ type: 'SET_MODAL', modal: 'return', isOpen: false });
        dispatch({ type: 'SET_RETURN_FORM', payload: { itemId: '', quantity: 0, reason: '', notes: '' } });
        if (socket && isConnected) {
          emit('returnCreated', { orderId: order.id, returnId: response._id });
        }
        playNotificationSound('/sounds/return-created.mp3', [200, 100, 200]);
        toast.success(isRtl ? 'تم تقديم طلب الإرجاع' : 'Return submitted successfully', { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
      } catch (err: any) {
        console.error('Return item error:', err.message, err.response?.data);
        toast.error(isRtl ? `فشل في تقديم طلب الإرجاع: ${err.message}` : `Failed to submit return: ${err.message}`, { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [user, t, isRtl, language, socket, isConnected, emit, playNotificationSound, state.submitting]
  );

  // Clear cache on user change
  useEffect(() => {
    cacheRef.current.clear();
    fetchData();
  }, [user?.id, fetchData]);

  // Render
  return (
    <div className="px-4 py-6 min-h-screen" dir={isRtl ? 'rtl' : 'ltr'}>
      <Suspense fallback={<LoadingSpinner size="lg" />}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-8">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-3">
                <ShoppingCart className="w-8 h-8 text-amber-600" />
                {isRtl ? 'إدارة الطلبات' : 'Manage Orders'}
              </h1>
              <p className="text-sm text-gray-500 mt-1">{isRtl ? 'إدارة طلبات الإنتاج والموافقة' : 'Manage production and approval orders'}</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Button
                variant={state.orders.length > 0 ? 'primary' : 'secondary'}
                onClick={state.orders.length > 0 ? exportToExcel : undefined}
                className={`flex items-center gap-2 ${
                  state.orders.length > 0 ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                } rounded-lg px-4 py-2 text-sm shadow-sm`}
                disabled={state.orders.length === 0}
              >
                <Download className="w-5 h-5" />
                {isRtl ? 'تصدير إلى Excel' : 'Export to Excel'}
              </Button>
              <Button
                variant={state.orders.length > 0 ? 'primary' : 'secondary'}
                onClick={state.orders.length > 0 ? exportToPDF : undefined}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'بحث' : 'Search'}</label>
                <SearchInput
                  value={state.searchQuery}
                  onChange={handleSearchChange}
                  placeholder={isRtl ? 'ابحث حسب رقم الطلب أو المنتج...' : 'Search by order number or product...'}
                  className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'الحالة' : 'Status'}</label>
                <Select
                  options={statusOptions.map(opt => ({
                    value: opt.value,
                    label: t(`orders.${opt.label}`),
                  }))}
                  value={state.filterStatus}
                  onChange={value => dispatch({ type: 'SET_FILTER_STATUS', payload: value })}
                  className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'الفرع' : 'Branch'}</label>
                <Select
                  options={[{ value: '', label: t('orders.all_branches') }, ...state.branches.map(branch => ({
                    value: branch._id,
                    label: branch.displayName,
                  }))]}
                  value={state.filterBranch}
                  onChange={value => dispatch({ type: 'SET_FILTER_BRANCH', payload: value })}
                  className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'ترتيب حسب' : 'Sort By'}</label>
                <Select
                  options={sortOptions.map(opt => ({
                    value: opt.value,
                    label: t(`orders.${opt.label}`),
                  }))}
                  value={state.sortBy}
                  onChange={value => dispatch({ type: 'SET_SORT', by: value as 'date' | 'totalAmount' | 'priority' | 'orderNumber', order: state.sortOrder })}
                  className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
                />
              </div>
            </div>
          </Card>
        </motion.div>

        {state.error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg flex items-center gap-2"
          >
            <AlertCircle className="w-5 h-5" />
            {state.error}
          </motion.div>
        )}

        {state.socketError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 p-4 bg-yellow-100 text-yellow-700 rounded-lg flex items-center gap-2"
          >
            <AlertCircle className="w-5 h-5" />
            {state.socketError}
          </motion.div>
        )}

        {state.loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {state.viewMode === 'card'
              ? Array.from({ length: ORDERS_PER_PAGE.card }).map((_, index) => (
                  <OrderCardSkeleton key={index} />
                ))
              : <OrderTableSkeleton />}
          </div>
        ) : paginatedOrders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-10 text-gray-500"
          >
            {isRtl ? 'لا توجد طلبات متاحة' : 'No orders available'}
          </motion.div>
        ) : (
          <AnimatePresence>
            {state.viewMode === 'card' ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {paginatedOrders.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onView={() => viewOrder(order)}
                    onAssign={() => openAssignChefsModal(order)}
                    onApprove={() => openActionModal(order, 'approve')}
                    onReject={() => openActionModal(order, 'reject')}
                    onReturn={openReturnModal}
                    calculateAdjustedTotal={calculateAdjustedTotal}
                    calculateTotalQuantity={calculateTotalQuantity}
                    userRole={user?.role}
                    isRtl={isRtl}
                    t={t}
                  />
                ))}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="overflow-x-auto"
              >
                <OrderTable
                  orders={paginatedOrders}
                  onView={viewOrder}
                  onAssign={openAssignChefsModal}
                  onApprove={order => openActionModal(order, 'approve')}
                  onReject={order => openActionModal(order, 'reject')}
                  onReturn={openReturnModal}
                  calculateAdjustedTotal={calculateAdjustedTotal}
                  calculateTotalQuantity={calculateTotalQuantity}
                  userRole={user?.role}
                  isRtl={isRtl}
                  t={t}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {state.totalCount > ORDERS_PER_PAGE[state.viewMode] && (
          <Suspense fallback={<LoadingSpinner size="sm" />}>
            <Pagination
              currentPage={state.currentPage}
              totalCount={state.totalCount}
              pageSize={ORDERS_PER_PAGE[state.viewMode]}
              onPageChange={page => dispatch({ type: 'SET_PAGE', payload: page })}
              isRtl={isRtl}
            />
          </Suspense>
        )}

        <Suspense fallback={<LoadingSpinner size="lg" />}>
          <ViewModal
            isOpen={state.isViewModalOpen}
            onClose={() => dispatch({ type: 'SET_MODAL', modal: 'view', isOpen: false })}
            order={state.selectedOrder}
            isRtl={isRtl}
            t={t}
          />
          <AssignChefsModal
            isOpen={state.isAssignModalOpen}
            onClose={() => dispatch({ type: 'SET_MODAL', modal: 'assign', isOpen: false })}
            order={state.selectedOrder}
            chefs={state.chefs}
            assignFormData={state.assignFormData}
            setAssignFormData={data => dispatch({ type: 'SET_ASSIGN_FORM', payload: data })}
            onSubmit={handleAssignChefs}
            submitting={state.submitting}
            isRtl={isRtl}
            t={t}
          />
          <ActionModal
            isOpen={state.isActionModalOpen}
            onClose={() => dispatch({ type: 'SET_MODAL', modal: 'action', isOpen: false })}
            order={state.selectedOrder}
            actionType={state.actionType}
            actionNotes={state.actionNotes}
            setActionNotes={notes => dispatch({ type: 'SET_ACTION_NOTES', payload: notes })}
            onSubmit={handleAction}
            submitting={state.submitting}
            isRtl={isRtl}
            t={t}
          />
          <ReturnModal
            isOpen={state.isReturnModalOpen}
            onClose={() => dispatch({ type: 'SET_MODAL', modal: 'return', isOpen: false })}
            order={state.selectedOrder}
            returnFormData={state.returnFormData}
            setReturnFormData={data => dispatch({ type: 'SET_RETURN_FORM', payload: data })}
            onSubmit={handleReturnItem}
            submitting={state.submitting}
            isRtl={isRtl}
            t={t}
          />
        </Suspense>
      </Suspense>
    </div>
  );
};

// Display name for debugging
BranchOrders.displayName = 'BranchOrders';

export default BranchOrders;
