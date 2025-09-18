import React, { useReducer, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { ordersAPI, chefsAPI, returnsAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Select } from '../components/UI/Select';
import SearchInput from '../components/UI/SearchInput';
import { ShoppingCart, Download, Upload, Table2, Grid, AlertCircle } from 'lucide-react';
import { debounce } from 'lodash';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { useOrderNotifications } from '../hooks/useOrderNotifications';
import { Order, Chef, AssignChefsForm, OrderStatus, ItemStatus, Priority } from '../types/types';
import { formatDate } from '../utils/formatDate';
import OrderCardSkeleton from '../components/Shared/OrderCardSkeleton';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';

// Lazy-loaded components
const OrderTable = lazy(() => import('../components/Shared/OrderTable'));
const OrderCard = lazy(() => import('../components/Shared/OrderCard'));
const Pagination = lazy(() => import('../components/Shared/Pagination'));
const AssignChefsModal = lazy(() => import('../components/Shared/AssignChefsModal'));
// State interface
interface State {
  orders: Order[];
  selectedOrder: Order | null;
  chefs: Chef[];
  branches: { _id: string; name: string }[];
  isAssignModalOpen: boolean;
  assignFormData: AssignChefsForm;
  searchQuery: string;
  filterStatus: string;
  filterBranch: string;
  sortBy: 'date' | 'totalAmount' | 'priority' | 'orderNumber';
  sortOrder: 'asc' | 'desc';
  currentPage: number;
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
  isAssignModalOpen: false,
  assignFormData: { items: [] },
  searchQuery: '',
  filterStatus: '',
  filterBranch: '',
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
const reducer = (state: State, action: any): State => {
  switch (action.type) {
    case 'SET_ORDERS':
      return { ...state, orders: action.payload, error: '' };
    case 'SET_SELECTED_ORDER':
      return { ...state, selectedOrder: action.payload };
    case 'SET_CHEFS':
      return { ...state, chefs: action.payload };
    case 'SET_BRANCHES':
      return { ...state, branches: action.payload };
    case 'SET_MODAL':
      return { ...state, isAssignModalOpen: action.isOpen };
    case 'SET_ASSIGN_FORM':
      return { ...state, assignFormData: action.payload };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload, currentPage: 1 };
    case 'SET_FILTER_STATUS':
      return { ...state, filterStatus: action.payload, currentPage: 1 };
    case 'SET_FILTER_BRANCH':
      return { ...state, filterBranch: action.payload, currentPage: 1 };
    case 'SET_SORT':
      return { ...state, sortBy: action.by, sortOrder: action.order, currentPage: 1 };
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
        orders: state.orders.map(o =>
          o.id === action.orderId ? { ...o, status: action.status } : o
        ),
        selectedOrder: state.selectedOrder?.id === action.orderId
          ? { ...state.selectedOrder, status: action.status }
          : state.selectedOrder,
      };
    case 'UPDATE_ITEM_STATUS':
      return {
        ...state,
        orders: state.orders.map(order =>
          order.id === action.payload.orderId
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
        selectedOrder: state.selectedOrder?.id === action.payload.orderId
          ? {
              ...state.selectedOrder,
              items: state.selectedOrder.items.map(item =>
                item._id === action.payload.itemId ? { ...item, status: action.payload.status } : item
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
                  action.items.some((task: any) => task.itemId === item._id)
                    ? {
                        ...item,
                        assignedTo: action.items.find((task: any) => task.itemId === item._id)?.assignedTo,
                        status: ItemStatus.Assigned,
                      }
                    : item
                ),
              }
            : order
        ),
      };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload, currentPage: 1 };
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
const getFirstTwoWords = (name: string | undefined | null): string => {
  if (!name) return 'غير معروف';
  const words = name.trim().split(' ');
  return words.slice(0, 2).join(' ');
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
export const Orders: React.FC = () => {
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
      dispatch({ type: 'SET_ERROR', payload: isRtl ? 'غير مصرح لك بالوصول' : 'Not authorized' });
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
      if (!order || !order._id || !order.branch || !order.branch._id) return;
      const mappedOrder: Order = {
        id: order._id,
        orderNumber: order.orderNumber || 'N/A',
        branchId: order.branch?._id || 'unknown',
        branchName: order.branch?.name || (isRtl ? 'غير معروف' : 'Unknown'),
        branch: order.branch || { _id: 'unknown', name: isRtl ? 'غير معروف' : 'Unknown' },
        items: Array.isArray(order.items)
          ? order.items.map((item: any) => ({
              _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
              productId: item.product._id,
              productName: item.product?.name || (isRtl ? 'غير معروف' : 'Unknown'),
              quantity: Number(item.quantity) || 0,
              price: Number(item.price) || 0,
              department: item.product?.department || { _id: 'unknown', name: isRtl ? 'غير معروف' : 'Unknown' },
              status: item.status || ItemStatus.Pending,
              unit: item.unit || 'unit',
              returnedQuantity: Number(item.returnedQuantity) || 0,
              returnReason: item.returnReason || '',
              assignedTo: item.assignedTo ? { _id: item.assignedTo._id, name: item.assignedTo.name || item.assignedTo.username || 'غير معروف' } : undefined,
            }))
          : [],
        returns: Array.isArray(order.returns)
          ? order.returns.map((ret: any) => ({
              returnId: ret._id,
              items: Array.isArray(ret.items)
                ? ret.items.map((item: any) => ({
                    productId: item.product._id,
                    productName: item.product?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    quantity: Number(item.quantity) || 0,
                    reason: item.reason || '',
                    status: item.status || ReturnStatus.PendingApproval,
                    reviewNotes: item.reviewNotes || '',
                  }))
                : [],
              status: ret.status || ReturnStatus.PendingApproval,
              reviewNotes: ret.reviewNotes || '',
              createdAt: formatDate(ret.createdAt ? new Date(ret.createdAt) : new Date(), language),
              createdBy: ret.createdBy || { _id: 'unknown', username: isRtl ? 'غير معروف' : 'Unknown' },
            }))
          : [],
        status: order.status || OrderStatus.Pending,
        totalAmount: Number(order.totalAmount) || 0,
        date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
        notes: order.notes || '',
        priority: order.priority || Priority.Medium,
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
        isRtl ? `طلب جديد: ${order.orderNumber}` : `New order: ${order.orderNumber}`,
        { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 }
      );
    });

    socket.on('orderStatusUpdated', ({ orderId, status }: { orderId: string; status: OrderStatus }) => {
      dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status });
      toast.info(
        isRtl ? `تم تحديث حالة الطلب إلى: ${t(`orders.status_${status}`)}` : `Order status updated to: ${t(`orders.status_${status}`)}`,
        { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 }
      );
    });

    socket.on('taskAssigned', ({ orderId, items }: { orderId: string; items: { itemId: string; assignedTo: { _id: string; name: string } }[] }) => {
      dispatch({ type: 'TASK_ASSIGNED', orderId, items });
      toast.info(isRtl ? 'تم تعيين المهام' : 'Tasks assigned', { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
    });

    return () => {
      socket.off('connect');
      socket.off('connect_error');
      socket.off('newOrder');
      socket.off('orderStatusUpdated');
      socket.off('taskAssigned');
    };
  }, [user, t, isRtl, language, socket, emit, playNotificationSound]);

  // Fetch data
  const fetchData = useCallback(
    async (retryCount = 0) => {
      if (!user?.role || !['admin', 'production'].includes(user.role)) {
        dispatch({ type: 'SET_ERROR', payload: isRtl ? 'غير مصرح لك بالوصول' : 'Not authorized' });
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

        const mappedOrders: Order[] = ordersResponse
          .filter((order: any) => order && order._id && order.branch && order.branch._id)
          .map((order: any) => ({
            id: order._id,
            orderNumber: order.orderNumber || 'N/A',
            branchId: order.branch?._id || 'unknown',
            branchName: order.branch?.name || (isRtl ? 'غير معروف' : 'Unknown'),
            branch: order.branch || { _id: 'unknown', name: isRtl ? 'غير معروف' : 'Unknown' },
            items: Array.isArray(order.items)
              ? order.items.map((item: any) => ({
                  _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
                  productId: item.product._id,
                  productName: item.product?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                  quantity: Number(item.quantity) || 0,
                  price: Number(item.price) || 0,
                  department: item.product?.department || { _id: 'unknown', name: isRtl ? 'غير معروف' : 'Unknown' },
                  status: item.status || ItemStatus.Pending,
                  unit: item.unit || 'unit',
                  returnedQuantity: Number(item.returnedQuantity) || 0,
                  returnReason: item.returnReason || '',
                  assignedTo: item.assignedTo ? { _id: item.assignedTo._id, name: item.assignedTo.name || item.assignedTo.username || 'غير معروف' } : undefined,
                }))
              : [],
            returns: Array.isArray(order.returns)
              ? order.returns.map((ret: any) => ({
                  returnId: ret._id,
                  items: Array.isArray(ret.items)
                    ? ret.items.map((item: any) => ({
                        productId: item.product._id,
                        productName: item.product?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                        quantity: Number(item.quantity) || 0,
                        reason: item.reason || '',
                        status: item.status || ReturnStatus.PendingApproval,
                        reviewNotes: item.reviewNotes || '',
                      }))
                    : [],
                  status: ret.status || ReturnStatus.PendingApproval,
                  reviewNotes: ret.reviewNotes || '',
                  createdAt: formatDate(ret.createdAt ? new Date(ret.createdAt) : new Date(), language),
                  createdBy: ret.createdBy || { _id: 'unknown', username: isRtl ? 'غير معروف' : 'Unknown' },
                }))
              : [],
            status: order.status || OrderStatus.Pending,
            totalAmount: Number(order.totalAmount) || 0,
            date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
            notes: order.notes || '',
            priority: order.priority || Priority.Medium,
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
        const mappedChefs: Chef[] = chefsResponse.map((chef: any) => ({
          _id: chef._id,
          userId: chef.userId || chef._id,
          name: chef.name || chef.username || (isRtl ? 'غير معروف' : 'Unknown'),
          department: chef.department || null,
        }));
        const mappedBranches = branchesResponse.map((branch: any) => ({
          _id: branch._id,
          name: branch.name || (isRtl ? 'غير معروف' : 'Unknown'),
        }));

        cacheRef.current.set(cacheKey, mappedOrders);
        dispatch({ type: 'SET_ORDERS', payload: mappedOrders });
        dispatch({ type: 'SET_CHEFS', payload: mappedChefs });
        dispatch({ type: 'SET_BRANCHES', payload: mappedBranches });
        dispatch({ type: 'SET_ERROR', payload: '' });
      } catch (err: any) {
        console.error('Fetch data error:', err.message);
        if (retryCount < 2) {
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

  // Calculate adjusted total
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

  // Export to Excel
  const exportToExcel = useCallback(() => {
    const headers = [
      isRtl ? 'رقم الطلب' : 'Order Number',
      isRtl ? 'الفرع' : 'Branch',
      isRtl ? 'الحالة' : 'Status',
      isRtl ? 'المنتجات' : 'Products',
      isRtl ? 'إجمالي المبلغ' : 'Total Amount',
      isRtl ? 'الأولوية' : 'Priority',
      isRtl ? 'التاريخ' : 'Date',
    ];
    const data = state.orders.map(order => ({
      [headers[0]]: order.orderNumber,
      [headers[1]]: order.branchName,
      [headers[2]]: t(`orders.status_${order.status}`) || order.status,
      [headers[3]]: order.items.map(item => `${item.quantity} ${t(`units.${item.unit || 'unit'}`)} ${getFirstTwoWords(item.productName)}`).join(' + '),
      [headers[4]]: calculateAdjustedTotal(order),
      [headers[5]]: t(`orders.priority_${order.priority}`) || order.priority,
      [headers[6]]: order.date,
    }));
    const ws = XLSX.utils.json_to_sheet(isRtl ? data.map(row => Object.fromEntries(Object.entries(row).reverse())) : data, { header: headers });
    if (isRtl) ws['!views'] = [{ RTL: true }];
    ws['!cols'] = [
      { wch: 15 }, // Order Number
      { wch: 20 }, // Branch
      { wch: 15 }, // Status
      { wch: 40 }, // Products
      { wch: 20 }, // Total Amount
      { wch: 15 }, // Priority
      { wch: 20 }, // Date
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isRtl ? 'الطلبات' : 'Orders');
    XLSX.writeFile(wb, 'Orders.xlsx');
    toast.success(isRtl ? 'تم تصدير الملف بنجاح' : 'Export successful', { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
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
      const base64Font = arrayBufferToBase64(fontBytes);
      doc.addFileToVFS(`${fontName}-Regular.ttf`, base64Font);
      doc.addFont(`${fontName}-Regular.ttf`, fontName, 'normal');
      doc.setFont(fontName);

      doc.setFontSize(16);
      doc.text(isRtl ? 'الطلبات' : 'Orders', isRtl ? doc.internal.pageSize.width - 20 : 20, 15, { align: isRtl ? 'right' : 'left' });

      const headers = [
        isRtl ? 'رقم الطلب' : 'Order Number',
        isRtl ? 'الفرع' : 'Branch',
        isRtl ? 'الحالة' : 'Status',
        isRtl ? 'المنتجات' : 'Products',
        isRtl ? 'إجمالي المبلغ' : 'Total Amount',
        isRtl ? 'الأولوية' : 'Priority',
        isRtl ? 'التاريخ' : 'Date',
      ];

      const data = state.orders.map(order => [
        order.orderNumber,
        order.branchName,
        t(`orders.status_${order.status}`) || order.status,
        order.items.map(item => `${item.quantity} ${t(`units.${item.unit || 'unit'}`)} ${getFirstTwoWords(item.productName)}`).join(' + '),
        calculateAdjustedTotal(order),
        t(`orders.priority_${order.priority}`) || order.priority,
        order.date,
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
          1: { cellWidth: 30 },
          2: { cellWidth: 20 },
          3: { cellWidth: 80 },
          4: { cellWidth: 25 },
          5: { cellWidth: 20 },
          6: { cellWidth: 30 },
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

      doc.save('Orders.pdf');
      toast.success(isRtl ? 'تم تصدير PDF بنجاح' : 'PDF export successful', { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error(isRtl ? 'خطأ في تصدير PDF' : 'PDF export error', { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
    }
  }, [state.orders, t, isRtl, language, calculateAdjustedTotal]);

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
            order.branchName.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
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
          return state.sortOrder === 'asc' ? a.totalAmount - b.totalAmount : b.totalAmount - a.totalAmount;
        } else if (state.sortBy === 'priority') {
          const priorityOrder = { [Priority.Urgent]: 4, [Priority.High]: 3, [Priority.Medium]: 2, [Priority.Low]: 1 };
          return state.sortOrder === 'asc'
            ? priorityOrder[a.priority] - priorityOrder[b.priority]
            : priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return state.sortOrder === 'asc'
          ? a.orderNumber.localeCompare(b.orderNumber)
          : b.orderNumber.localeCompare(a.orderNumber);
      }),
    [filteredOrders, state.sortBy, state.sortOrder]
  );

  const paginatedOrders = useMemo(
    () => sortedOrders.slice((state.currentPage - 1) * ORDERS_PER_PAGE[state.viewMode], state.currentPage * ORDERS_PER_PAGE[state.viewMode]),
    [sortedOrders, state.currentPage, state.viewMode]
  );

  // Order actions
  const openAssignModal = useCallback((order: Order) => {
    dispatch({ type: 'SET_SELECTED_ORDER', payload: order });
    dispatch({ type: 'SET_MODAL', isOpen: true });
    dispatch({
      type: 'SET_ASSIGN_FORM',
      payload: {
        items: order.items.map(item => ({
          itemId: item._id,
          assignedTo: item.assignedTo?._id || '',
          product: item.productName,
          quantity: item.quantity,
        })),
      },
    });
  }, []);

  const assignChefs = useCallback(
    async (orderId: string, formData: AssignChefsForm) => {
      if (!formData.items.length || state.submitting) return;
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        const response = await ordersAPI.assignChefs(orderId, {
          items: formData.items.map(item => ({
            itemId: item.itemId,
            assignedTo: item.assignedTo,
          })),
        });
        dispatch({
          type: 'TASK_ASSIGNED',
          orderId,
          items: response.items.map((item: any) => ({
            itemId: item.itemId,
            assignedTo: { _id: item.assignedTo._id, name: item.assignedTo.name || item.assignedTo.username || 'غير معروف' },
          })),
        });
        dispatch({ type: 'SET_MODAL', isOpen: false });
        dispatch({ type: 'SET_ASSIGN_FORM', payload: { items: [] } });
        dispatch({ type: 'SET_SELECTED_ORDER', payload: null });
        if (socket && isConnected) {
          emit('taskAssigned', { orderId, items: response.items });
        }
        toast.success(isRtl ? 'تم تعيين الشيفات بنجاح' : 'Chefs assigned successfully', { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
      } catch (err: any) {
        console.error('Assign chefs error:', err.message);
        toast.error(isRtl ? `فشل في تعيين الشيفات: ${err.message}` : `Failed to assign chefs: ${err.message}`, { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [isRtl, socket, isConnected, emit, state.submitting]
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
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
        console.error('Update order status error:', err.message);
        toast.error(isRtl ? `فشل في تحديث الحالة: ${err.message}` : `Failed to update status: ${err.message}`, { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [t, isRtl, socket, isConnected, emit]
  );

  // Clear cache on user change
  useEffect(() => {
    cacheRef.current.clear();
    fetchData();
  }, [fetchData]);

  // Render
  return (
    <div className="px-4 py-6 min-h-screen bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
      <Suspense fallback={<LoadingSpinner size="lg" />}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-8">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-3">
                <ShoppingCart className="w-8 h-8 text-amber-600" />
                {isRtl ? 'الطلبات' : 'Orders'}
              </h1>
              <p className="text-sm text-gray-500 mt-1">{isRtl ? 'إدارة طلبات الإنتاج' : 'Manage production orders'}</p>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'تصفية حسب الحالة' : 'Filter by Status'}</label>
                <Select
                  options={statusOptions.map(opt => ({
                    value: opt.value,
                    label: t(`orders.status_${opt.value}`) || (isRtl ? 'كل الحالات' : 'All Statuses'),
                  }))}
                  value={state.filterStatus || ''}
                  onChange={(value: string) => dispatch({ type: 'SET_FILTER_STATUS', payload: value })}
                  className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'تصفية حسب الفرع' : 'Filter by Branch'}</label>
                <Select
                  options={[{ value: '', label: isRtl ? 'كل الفروع' : 'All Branches' }, ...state.branches.map(b => ({ value: b._id, label: b.name }))]}
                  value={state.filterBranch || ''}
                  onChange={(value: string) => dispatch({ type: 'SET_FILTER_BRANCH', payload: value })}
                  className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'ترتيب حسب' : 'Sort By'}</label>
                <Select
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
                      {state.filterStatus || state.filterBranch || state.searchQuery
                        ? isRtl ? 'لا توجد طلبات مطابقة' : 'No matching orders'
                        : isRtl ? 'لا توجد طلبات بعد' : 'No orders yet'}
                    </p>
                  </Card>
                </motion.div>
              ) : state.viewMode === 'table' ? (
                <motion.div key="table-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="mt-6">
                  <OrderTable
                    orders={paginatedOrders.filter(o => o && o.id && o.branch && o.branch._id)}
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
                <motion.div key="card-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="space-y-4 mt-6">
                  {paginatedOrders.filter(o => o && o.id && o.branch && o.branch._id).map(order => (
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
          <AssignChefsModal
            isOpen={state.isAssignModalOpen}
            onClose={() => {
              dispatch({ type: 'SET_MODAL', isOpen: false });
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
        </motion.div>
      </Suspense>
    </div>
  );
};

export default Orders;