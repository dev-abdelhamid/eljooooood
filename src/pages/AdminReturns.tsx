import React, { useReducer, useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useNotifications } from '../contexts/NotificationContext';
import { returnsAPI, notificationsAPI, branchesAPI } from '../services/api';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Package, AlertCircle, Grid, Table2, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import Filters from '../components/Returns/Filters';
import ReturnCard from '../components/Returns/ReturnCard';
import ReturnTable from '../components/Returns/ReturnTable';
import ReturnCardSkeleton from '../components/Returns/ReturnCardSkeleton';
import ReturnTableSkeleton from '../components/Returns/ReturnTableSkeleton';
import Pagination from '../components/Returns/Pagination';
import ReturnModal from '../components/Returns/ReturnModal';
import ActionModal from '../components/Returns/ActionModal';
import { formatDate } from '../utils/formatDate';
import { Return, Branch, ReturnStatus, State, Action } from '../types/types';

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_RETURNS':
      return { ...state, returns: action.payload.returns, totalCount: action.payload.totalCount };
    case 'ADD_RETURN':
      return { ...state, returns: [action.payload, ...state.returns], totalCount: state.totalCount + 1 };
    case 'SET_BRANCHES':
      return { ...state, branches: action.payload };
    case 'SET_SELECTED_RETURN':
      return { ...state, selectedReturn: action.payload };
    case 'SET_VIEW_MODAL':
      return { ...state, isViewModalOpen: action.isOpen ?? false };
    case 'SET_ACTION_MODAL':
      return { ...state, isActionModalOpen: action.isOpen ?? false };
    case 'SET_ACTION_TYPE':
      return { ...state, actionType: action.payload };
    case 'SET_ACTION_NOTES':
      return { ...state, actionNotes: action.payload };
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
    case 'UPDATE_RETURN_STATUS':
      return {
        ...state,
        returns: state.returns.map((r) =>
          r.id === action.returnId
            ? {
                ...r,
                status: action.status ?? r.status,
                reviewNotes: action.reviewNotes ?? r.reviewNotes ?? '',
                order: { ...r.order, totalAmount: action.adjustedTotal ?? r.order.totalAmount },
              }
            : r
        ),
        selectedReturn:
          state.selectedReturn?.id === action.returnId
            ? {
                ...state.selectedReturn,
                status: action.status ?? state.selectedReturn.status,
                reviewNotes: action.reviewNotes ?? state.selectedReturn.reviewNotes ?? '',
                order: {
                  ...state.selectedReturn.order,
                  totalAmount: action.adjustedTotal ?? state.selectedReturn.order.totalAmount,
                },
              }
            : state.selectedReturn,
      };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload, currentPage: 1 };
    default:
      return state;
  }
};

const initialState: State = {
  orders: [],
  selectedOrder: null,
  chefs: [],
  branches: [],
  returns: [],
  selectedReturn: null,
  isAssignModalOpen: false,
  isViewModalOpen: false,
  isConfirmDeliveryModalOpen: false,
  isReturnModalOpen: false,
  isActionModalOpen: false,
  actionType: null,
  actionNotes: '',
  filterStatus: '',
  filterBranch: '',
  searchQuery: '',
  sortBy: 'date',
  sortOrder: 'desc',
  currentPage: 1,
  totalCount: 0,
  loading: true,
  error: '',
  submitting: null,
  toasts: [],
  socketConnected: false,
  socketError: null,
  viewMode: 'card',
};

const RETURNS_PER_PAGE_CARD = 10;
const RETURNS_PER_PAGE_TABLE = 50;

export const AdminReturns: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { socket } = useSocket();
  const { addNotification } = useNotifications();
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(true);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const playNotificationSound = useCallback(() => {
    if (hasInteracted) {
      const audio = new Audio('/sounds/notification.mp3');
      audio.play().catch((err) => console.error('Audio play failed:', err));
    }
  }, [hasInteracted]);

  useEffect(() => {
    const handleUserInteraction = () => {
      setHasInteracted(true);
      const audio = new Audio('/sounds/notification.mp3');
      audio.play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
        })
        .catch((err) => console.error('Audio context initialization failed:', err));
      document.removeEventListener('click', handleUserInteraction);
    };
    document.addEventListener('click', handleUserInteraction, { once: true });
    return () => document.removeEventListener('click', handleUserInteraction);
  }, []);

  const STATUS_COLORS = useMemo(
    () => ({
      pending_approval: { color: 'bg-amber-100 text-amber-800', icon: AlertCircle, label: isRtl ? 'في انتظار الموافقة' : 'Pending Approval' },
      approved: { color: 'bg-green-100 text-green-800', icon: AlertCircle, label: isRtl ? 'تمت الموافقة' : 'Approved' },
      rejected: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: isRtl ? 'مرفوض' : 'Rejected' },
      processed: { color: 'bg-blue-100 text-blue-800', icon: AlertCircle, label: isRtl ? 'تمت المعالجة' : 'Processed' },
    }),
    [isRtl]
  );

  const getStatusInfo = useCallback(
    (status: ReturnStatus) => STATUS_COLORS[status] || { color: 'bg-gray-100 text-gray-800', icon: AlertCircle, label: isRtl ? 'غير معروف' : 'Unknown' },
    [STATUS_COLORS, isRtl]
  );

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const exportToExcel = useCallback(() => {
    const exportData = state.returns.map((ret) => ({
      [isRtl ? 'رقم الإرجاع' : 'Return Number']: ret.returnNumber,
      [isRtl ? 'رقم الطلب' : 'Order Number']: ret.order.orderNumber,
      [isRtl ? 'الحالة' : 'Status']: getStatusInfo(ret.status).label,
      [isRtl ? 'التاريخ' : 'Date']: formatDate(ret.createdAt, language),
      [isRtl ? 'عدد العناصر' : 'Items Count']: ret.items.length,
      [isRtl ? 'المنتجات' : 'Products']: ret.items.map((item) => `${item.productName} (${item.quantity})`).join(', '),
      [isRtl ? 'الكمية الإجمالية' : 'Total Quantity']: ret.items.reduce((sum, item) => sum + item.quantity, 0),
      [isRtl ? 'الفرع' : 'Branch']: ret.branch.name,
      [isRtl ? 'الإجمالي' : 'Total Amount']: `${ret.order.totalAmount.toFixed(2)} ${isRtl ? 'ريال' : 'SAR'}`,
      [isRtl ? 'ملاحظات' : 'Notes']: ret.notes || (isRtl ? 'لا توجد ملاحظات' : 'No notes'),
      [isRtl ? 'ملاحظات المراجعة' : 'Review Notes']: ret.reviewNotes || (isRtl ? 'لا توجد ملاحظات' : 'No notes'),
    }));
    const ws = XLSX.utils.json_to_sheet(isRtl ? exportData.map((row) => Object.fromEntries(Object.entries(row).reverse())) : exportData);
    ws['!cols'] = Object.keys(exportData[0] || {}).map(() => ({ wpx: 120 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Returns');
    XLSX.writeFile(wb, `Returns_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(isRtl ? 'تم تصدير البيانات بنجاح' : 'Data exported successfully', { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
  }, [state.returns, isRtl, getStatusInfo, language]);

  const exportToPDF = useCallback(async () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setLanguage(isRtl ? 'ar' : 'en');
      const fontUrl = '/fonts/Amiri-Regular.ttf';
      const fontName = 'Amiri';
      const fontBytes = await fetch(fontUrl).then((res) => {
        if (!res.ok) throw new Error('Failed to fetch font');
        return res.arrayBuffer();
      });
      const base64Font = arrayBufferToBase64(fontBytes);
      doc.addFileToVFS(`${fontName}-Regular.ttf`, base64Font);
      doc.addFont(`${fontName}-Regular.ttf`, fontName, 'normal');
      doc.setFont(fontName);
      const headers = [
        isRtl ? 'رقم الإرجاع' : 'Return Number',
        isRtl ? 'رقم الطلب' : 'Order Number',
        isRtl ? 'الحالة' : 'Status',
        isRtl ? 'التاريخ' : 'Date',
        isRtl ? 'عدد العناصر' : 'Items Count',
        isRtl ? 'المنتجات' : 'Products',
        isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
        isRtl ? 'الفرع' : 'Branch',
        isRtl ? 'الإجمالي' : 'Total Amount',
        isRtl ? 'ملاحظات' : 'Notes',
        isRtl ? 'ملاحظات المراجعة' : 'Review Notes',
      ];
      const data = state.returns.map((ret) => [
        ret.returnNumber,
        ret.order.orderNumber,
        getStatusInfo(ret.status).label,
        formatDate(ret.createdAt, language),
        ret.items.length.toString(),
        ret.items.map((item) => `${item.productName} (${item.quantity})`).join(', '),
        ret.items.reduce((sum, item) => sum + item.quantity, 0).toString(),
        ret.branch.name,
        `${ret.order.totalAmount.toFixed(2)} ${isRtl ? 'ريال' : 'SAR'}`,
        ret.notes || (isRtl ? 'لا توجد ملاحظات' : 'No notes'),
        ret.reviewNotes || (isRtl ? 'لا توجد ملاحظات' : 'No notes'),
      ]);
      const finalHeaders = isRtl ? headers.reverse() : headers;
      const finalData = isRtl ? data.map((row) => row.reverse()) : data;
      autoTable(doc, {
        head: [finalHeaders],
        body: finalData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 10, halign: isRtl ? 'right' : 'left', font: fontName },
        bodyStyles: { fontSize: 9, halign: isRtl ? 'right' : 'left', font: fontName, cellPadding: 4 },
        columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 30 }, 5: { cellWidth: 50 } },
        margin: { top: 20 },
        didDrawPage: (data) => {
          doc.setFont(fontName);
          doc.text(isRtl ? 'إدارة المرتجعات' : 'Returns Management', isRtl ? doc.internal.pageSize.width - data.settings.margin.right : data.settings.margin.left, 10, {
            align: isRtl ? 'right' : 'left',
          });
        },
      });
      doc.save(`Returns_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success(isRtl ? 'تم تصدير PDF بنجاح' : 'PDF exported successfully', { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error(isRtl ? 'خطأ في تصدير PDF' : 'PDF export error', { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
    }
  }, [state.returns, isRtl, getStatusInfo, language]);

  const fetchBranches = useCallback(async () => {
    setBranchesLoading(true);
    try {
      const response = await branchesAPI.getAll();
      const branches = Array.isArray(response)
        ? response.map((branch: any) => ({
            _id: branch._id || 'unknown',
            name: branch.name || (isRtl ? 'فرع غير معروف' : 'Unknown branch'),
          }))
        : [];
      dispatch({ type: 'SET_BRANCHES', payload: branches });
      if (branches.length === 0) {
        toast.warn(isRtl ? 'لا توجد فروع متاحة' : 'No branches available', { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
      }
    } catch (err: any) {
      console.error('Error fetching branches:', err);
      toast.error(isRtl ? 'خطأ في جلب الفروع' : 'Error fetching branches', { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
    } finally {
      setBranchesLoading(false);
    }
  }, [isRtl]);

  const fetchData = useCallback(async () => {
    if (!user) {
      dispatch({ type: 'SET_ERROR', payload: isRtl ? 'الوصول غير مصرح به' : 'Unauthorized access' });
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const query = {
        status: state.filterStatus,
        branch: state.filterBranch,
        search: state.searchQuery,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        page: state.currentPage,
        limit: state.viewMode === 'table' ? RETURNS_PER_PAGE_TABLE : RETURNS_PER_PAGE_CARD,
      };
      const { returns: returnsData, total } = await returnsAPI.getAll(query);
      if (!Array.isArray(returnsData)) {
        throw new Error('Invalid returns data format');
      }
      const formattedReturns = returnsData.map((ret: any) => ({
        id: ret._id || 'unknown',
        returnNumber: ret.returnNumber || (isRtl ? 'رقم غير معروف' : 'Unknown number'),
        order: {
          id: ret.order?._id || 'unknown',
          orderNumber: ret.order?.orderNumber || (isRtl ? 'طلب غير معروف' : 'Unknown order'),
          totalAmount: Number(ret.order?.totalAmount) || 0,
          createdAt: ret.order?.createdAt || new Date().toISOString(),
          branch: ret.order?.branch?._id || 'unknown',
          branchName: ret.order?.branch?.name || (isRtl ? 'فرع غير معروف' : 'Unknown branch'),
        },
        items: Array.isArray(ret.items)
          ? ret.items.map((item: any) => ({
              itemId: item.itemId || item._id || 'unknown',
              productId: item.product?._id || 'unknown',
              productName: item.product?.name || (isRtl ? 'منتج غير معروف' : 'Unknown product'),
              quantity: Number(item.quantity) || 0,
              price: Number(item.product?.price) || 0,
              reason: item.reason || (isRtl ? 'سبب غير معروف' : 'Unknown reason'),
              status: item.status || ReturnStatus.PendingApproval,
              reviewNotes: item.reviewNotes || '',
            }))
          : [],
        status: ret.status === 'pending' ? ReturnStatus.PendingApproval : ret.status || ReturnStatus.PendingApproval,
        date: formatDate(ret.createdAt, language),
        createdAt: ret.createdAt || new Date().toISOString(),
        notes: ret.notes || '',
        reviewNotes: ret.reviewNotes || '',
        branch: {
          _id: ret.branch?._id || 'unknown',
          name: ret.branch?.name || (isRtl ? 'فرع غير معروف' : 'Unknown branch'),
        },
        createdBy: {
          _id: ret.createdBy?._id || 'unknown',
          username: ret.createdBy?.username || (isRtl ? 'مستخدم غير معروف' : 'Unknown user'),
        },
        reviewedBy: ret.reviewedBy
          ? { _id: ret.reviewedBy._id, username: ret.reviewedBy.username || (isRtl ? 'مستخدم غير معروف' : 'Unknown user') }
          : undefined,
        statusHistory: Array.isArray(ret.statusHistory) ? ret.statusHistory : [],
      }));
      dispatch({ type: 'SET_RETURNS', payload: { returns: formattedReturns, totalCount: total } });
      dispatch({ type: 'SET_ERROR', payload: '' });
    } catch (err: any) {
      const errorMessage =
        err.status === 403
          ? isRtl ? 'الوصول غير مصرح به' : 'Unauthorized access'
          : err.status === 404
          ? isRtl ? 'لم يتم العثور على المرتجع' : 'Return not found'
          : err.message || (isRtl ? 'خطأ في جلب المرتجعات' : 'Error fetching returns');
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.filterStatus, state.filterBranch, state.searchQuery, state.sortBy, state.sortOrder, state.currentPage, state.viewMode, user, isRtl, language]);

  const debouncedFetchData = useCallback(debounce(fetchData, 300), [fetchData]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value || '';
      dispatch({ type: 'SET_SEARCH_QUERY', payload: value });
    },
    []
  );

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    debouncedFetchData();
    return () => debouncedFetchData.cancel();
  }, [state.filterStatus, state.filterBranch, state.searchQuery, state.sortBy, state.sortOrder, state.currentPage, state.viewMode, debouncedFetchData]);

  useEffect(() => {
    if (!socket || !user) return;
    const handleConnect = () => {
      socket.emit('joinRoom', {
        role: user.role,
        branchId: user.branchId,
        userId: user._id,
      });
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: true });
      dispatch({ type: 'SET_SOCKET_ERROR', payload: null });
    };
    const handleDisconnect = () => {
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: false });
      dispatch({ type: 'SET_SOCKET_ERROR', payload: isRtl ? 'تم قطع الاتصال' : 'Disconnected' });
    };
    const handleConnectError = (error: Error) => {
      dispatch({ type: 'SET_SOCKET_ERROR', payload: isRtl ? `خطأ في الاتصال: ${error.message}` : `Connection error: ${error.message}` });
      toast.error(isRtl ? `خطأ في الاتصال: ${error.message}` : `Connection error: ${error.message}`, { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
    };
    const handleReturnCreated = (newReturn: any) => {
      const currentState = stateRef.current;
      if (currentState.filterStatus && newReturn.status !== currentState.filterStatus) return;
      if (currentState.filterBranch && newReturn.branch?._id !== currentState.filterBranch) return;
      if (
        currentState.searchQuery &&
        !newReturn.returnNumber.toLowerCase().includes(currentState.searchQuery.toLowerCase()) &&
        !newReturn.order?.orderNumber.toLowerCase().includes(currentState.searchQuery.toLowerCase())
      ) {
        return;
      }
      const mappedReturn: Return = {
        id: newReturn._id || 'unknown',
        returnNumber: newReturn.returnNumber || (isRtl ? 'رقم غير معروف' : 'Unknown number'),
        order: {
          id: newReturn.order?._id || 'unknown',
          orderNumber: newReturn.order?.orderNumber || (isRtl ? 'طلب غير معروف' : 'Unknown order'),
          totalAmount: Number(newReturn.order?.totalAmount) || 0,
          createdAt: newReturn.order?.createdAt || new Date().toISOString(),
          branch: newReturn.order?.branch?._id || 'unknown',
          branchName: newReturn.order?.branch?.name || (isRtl ? 'فرع غير معروف' : 'Unknown branch'),
        },
        items: Array.isArray(newReturn.items)
          ? newReturn.items.map((item: any) => ({
              itemId: item.itemId || item._id || 'unknown',
              productId: item.product?._id || 'unknown',
              productName: item.product?.name || (isRtl ? 'منتج غير معروف' : 'Unknown product'),
              quantity: Number(item.quantity) || 0,
              price: Number(item.product?.price) || 0,
              reason: item.reason || (isRtl ? 'سبب غير معروف' : 'Unknown reason'),
              status: item.status || ReturnStatus.PendingApproval,
              reviewNotes: item.reviewNotes || '',
            }))
          : [],
        status: newReturn.status === 'pending' ? ReturnStatus.PendingApproval : newReturn.status || ReturnStatus.PendingApproval,
        date: formatDate(newReturn.createdAt, language),
        createdAt: newReturn.createdAt || new Date().toISOString(),
        notes: newReturn.notes || '',
        reviewNotes: newReturn.reviewNotes || '',
        branch: {
          _id: newReturn.branch?._id || 'unknown',
          name: newReturn.branch?.name || (isRtl ? 'فرع غير معروف' : 'Unknown branch'),
        },
        createdBy: {
          _id: newReturn.createdBy?._id || 'unknown',
          username: newReturn.createdBy?.username || (isRtl ? 'مستخدم غير معروف' : 'Unknown user'),
        },
        reviewedBy: newReturn.reviewedBy
          ? { _id: newReturn.reviewedBy._id, username: newReturn.reviewedBy.username || (isRtl ? 'مستخدم غير معروف' : 'Unknown user') }
          : undefined,
        statusHistory: Array.isArray(newReturn.statusHistory) ? newReturn.statusHistory : [],
      };
      dispatch({ type: 'ADD_RETURN', payload: mappedReturn });
      if (document.hasFocus()) {
        addNotification({
          _id: `return-${newReturn._id}-${Date.now()}`,
          type: 'success',
          message: isRtl ? `تم إنشاء مرتجع جديد: ${newReturn.returnNumber}` : `New return created: ${newReturn.returnNumber}`,
          data: { returnId: newReturn._id, orderId: newReturn.order?._id },
          read: false,
          createdAt: newReturn.createdAt,
        });
        playNotificationSound();
      }
    };
    const handleReturnStatusUpdated = ({
      returnId,
      status,
      reviewNotes,
      branchId,
      adjustedTotal,
    }: {
      returnId: string;
      status: ReturnStatus;
      reviewNotes?: string;
      branchId: string;
      adjustedTotal?: number;
    }) => {
      dispatch({
        type: 'UPDATE_RETURN_STATUS',
        returnId,
        status: status === 'pending' ? ReturnStatus.PendingApproval : status,
        reviewNotes,
        adjustedTotal,
      });
      if (document.hasFocus()) {
        addNotification({
          _id: `return-status-${returnId}-${Date.now()}`,
          type: 'info',
          message: isRtl
            ? `تم تحديث حالة المرتجع إلى ${getStatusInfo(status).label}: ${state.returns.find((r) => r.id === returnId)?.returnNumber || returnId}`
            : `Return status updated to ${getStatusInfo(status).label}: ${state.returns.find((r) => r.id === returnId)?.returnNumber || returnId}`,
          data: { returnId },
          read: false,
          createdAt: new Date().toISOString(),
        });
        playNotificationSound();
      }
      if (status === 'rejected') {
        socket.emit('inventoryUpdated', { branchId });
      }
    };
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('returnCreated', handleReturnCreated);
    socket.on('returnStatusUpdated', handleReturnStatusUpdated);
    socket.on('reconnect_attempt', () => {
      dispatch({ type: 'SET_SOCKET_ERROR', payload: isRtl ? 'جاري إعادة الاتصال' : 'Reconnecting' });
    });
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('returnCreated', handleReturnCreated);
      socket.off('returnStatusUpdated', handleReturnStatusUpdated);
      socket.off('reconnect_attempt');
    };
  }, [socket, user, isRtl, addNotification, playNotificationSound, state.returns, getStatusInfo, language]);

  const handlePageChange = useCallback((page: number) => {
    dispatch({ type: 'SET_PAGE', payload: page });
  }, []);

  const viewReturn = useCallback((ret: Return) => {
    dispatch({ type: 'SET_SELECTED_RETURN', payload: ret });
    dispatch({ type: 'SET_VIEW_MODAL', isOpen: true });
  }, []);

  const openActionModal = useCallback((ret: Return, type: 'approve' | 'reject') => {
    dispatch({ type: 'SET_SELECTED_RETURN', payload: ret });
    dispatch({ type: 'SET_ACTION_TYPE', payload: type });
    dispatch({ type: 'SET_ACTION_MODAL', isOpen: true });
  }, []);

  const handleActionSubmit = useCallback(
    debounce(async () => {
      if (!state.selectedReturn || !state.actionType || !user?._id) return;
      dispatch({ type: 'SET_SUBMITTING', payload: state.selectedReturn.id });
      try {
        const data = {
          items: state.selectedReturn.items.map((item) => ({
            itemId: item.itemId,
            productId: item.productId,
            status: state.actionType,
            reviewNotes: state.actionNotes || undefined,
          })),
          reviewNotes: state.actionNotes || undefined,
        };
        const response = await returnsAPI.updateReturnStatus(state.selectedReturn.id, data);
        dispatch({
          type: 'UPDATE_RETURN_STATUS',
          returnId: state.selectedReturn.id,
          status: state.actionType === 'approve' ? ReturnStatus.Approved : ReturnStatus.Rejected,
          reviewNotes: state.actionNotes,
          adjustedTotal: response.adjustedTotal,
        });
        socket.emit('returnStatusUpdated', {
          returnId: state.selectedReturn.id,
          status: state.actionType,
          reviewNotes: state.actionNotes,
          branchId: state.selectedReturn.branch._id,
          adjustedTotal: response.adjustedTotal,
        });
        await notificationsAPI.create({
          user: user._id,
          type: 'return_status_updated',
          message: isRtl
            ? `تم تحديث حالة المرتجع إلى ${state.actionType === 'approve' ? 'تمت الموافقة' : 'مرفوض'}: ${state.selectedReturn.returnNumber}`
            : `Return status updated to ${state.actionType === 'approve' ? 'approved' : 'rejected'}: ${state.selectedReturn.returnNumber}`,
          data: { returnId: state.selectedReturn.id, orderId: state.selectedReturn.order.id },
        });
        toast.success(isRtl ? `تم ${state.actionType === 'approve' ? 'الموافقة' : 'الرفض'} بنجاح` : `${state.actionType === 'approve' ? 'Approval' : 'Rejection'} successful`, {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
        dispatch({ type: 'SET_ACTION_MODAL', isOpen: false });
        dispatch({ type: 'SET_ACTION_TYPE', payload: null });
        dispatch({ type: 'SET_ACTION_NOTES', payload: '' });
        dispatch({ type: 'SET_SELECTED_RETURN', payload: null });
      } catch (err: any) {
        const errorMessage = err.message || (isRtl ? `فشل ${state.actionType === 'approve' ? 'الموافقة' : 'الرفض'} على المرتجع` : `Failed to ${state.actionType === 'approve' ? 'approve' : 'reject'} return`);
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    }, 500),
    [state.selectedReturn, state.actionType, state.actionNotes, user, isRtl, socket]
  );

  const totalPages = useMemo(() => {
    return Math.ceil(state.totalCount / (state.viewMode === 'table' ? RETURNS_PER_PAGE_TABLE : RETURNS_PER_PAGE_CARD));
  }, [state.totalCount, state.viewMode]);

  const handleViewModeToggle = useCallback(() => {
    dispatch({ type: 'SET_VIEW_MODE', payload: state.viewMode === 'card' ? 'table' : 'card' });
  }, [state.viewMode]);

  return (
    <div className=" mx-auto px-4 py-8 min-h-screen " dir={isRtl ? 'rtl' : 'ltr'}>
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Package className="w-8 h-8 text-teal-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{isRtl ? 'إدارة المرتجعات' : 'Returns Management'}</h1>
            <p className="text-sm text-gray-600">{isRtl ? 'إدارة ومراجعة طلبات المرتجعات بكفاءة' : 'Manage and review return requests efficiently'}</p>
          </div>
        </div>
        <div className={`flex ${isRtl ? 'flex-row-reverse' : 'flex-row'} gap-2 flex-wrap`}>
          <button
            onClick={handleViewModeToggle}
            className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 text-white rounded-full text-sm hover:bg-teal-700 transition-colors"
            aria-label={isRtl ? (state.viewMode === 'card' ? 'عرض الجدول' : 'عرض البطاقات') : (state.viewMode === 'card' ? 'Table View' : 'Card View')}
          >
            {state.viewMode === 'card' ? <Table2 className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
            {isRtl ? (state.viewMode === 'card' ? 'جدوال' : 'بطاقات') : (state.viewMode === 'card' ? 'Table' : 'Cards')}
          </button>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-full text-sm hover:bg-green-700 transition-colors"
            aria-label={isRtl ? 'تصدير إلى Excel' : 'Export to Excel'}
          >
            <Download className="w-4 h-4" />
            {isRtl ? 'Excel' : 'Excel'}
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-full text-sm hover:bg-blue-700 transition-colors"
            aria-label={isRtl ? 'تصدير إلى PDF' : 'Export to PDF'}
          >
            <Download className="w-4 h-4" />
            {isRtl ? 'PDF' : 'PDF'}
          </button>
        </div>
      </motion.div>
      {state.error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`mb-6 p-4 bg-red-100 border border-red-200 rounded-lg flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}
        >
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-sm text-red-600">{state.error}</span>
        </motion.div>
      )}
      {!state.socketConnected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`mb-6 p-4 bg-yellow-100 border border-yellow-200 rounded-lg flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}
        >
          <AlertCircle className="w-5 h-5 text-yellow-600" />
          <span className="text-sm text-yellow-600">{state.socketError || (isRtl ? 'تم قطع الاتصال' : 'Disconnected')}</span>
        </motion.div>
      )}
      {branchesLoading ? (
        <div className="mb-6 p-4 bg-gray-100 rounded-lg text-center text-sm text-gray-600">
        </div>
      ) : (
        <div className="mb-6">
          <Filters
            state={state}
            dispatch={dispatch}
            isRtl={isRtl}
            branches={state.branches}
            onSearchChange={handleSearchChange}
          />
        </div>
      )}
      {state.loading ? (
        <div className="space-y-4">
          {state.viewMode === 'table' ? (
            <ReturnTableSkeleton isRtl={isRtl} />
          ) : (
            Array(5).fill(0).map((_, index) => <ReturnCardSkeleton key={index} />)
          )}
        </div>
      ) : state.returns.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="p-8 text-center bg-white rounded-xl shadow-md">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-sm text-gray-600">{isRtl ? 'لا توجد مرتجعات' : 'No returns available'}</p>
          </div>
        </motion.div>
      ) : (
        <>
          {state.viewMode === 'card' ? (
            <div className="grid grid-cols-1 gap-4">
              {state.returns.map((ret) => (
                <ReturnCard
                  key={ret.id}
                  ret={ret}
                  isRtl={isRtl}
                  getStatusInfo={getStatusInfo}
                  viewReturn={viewReturn}
                  openActionModal={openActionModal}
                  submitting={state.submitting}
                  user={user}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <ReturnTable
                returns={state.returns}
                isRtl={isRtl}
                getStatusInfo={getStatusInfo}
                viewReturn={viewReturn}
                openActionModal={openActionModal}
                submitting={state.submitting}
                user={user}
              />
            </div>
          )}
          {totalPages > 1 && (
            <Pagination
              handlePageChange={handlePageChange}
              currentPage={state.currentPage}
              totalPages={totalPages}
              isRtl={isRtl}
            />
          )}
        </>
      )}
      <ReturnModal
        isOpen={state.isViewModalOpen}
        onClose={() => {
          dispatch({ type: 'SET_VIEW_MODAL', isOpen: false });
          dispatch({ type: 'SET_SELECTED_RETURN', payload: null });
        }}
        selectedReturn={state.selectedReturn}
        isRtl={isRtl}
        getStatusInfo={getStatusInfo}
      />
      <ActionModal
        isOpen={state.isActionModalOpen}
        onClose={() => {
          dispatch({ type: 'SET_ACTION_MODAL', isOpen: false });
          dispatch({ type: 'SET_ACTION_TYPE', payload: null });
          dispatch({ type: 'SET_ACTION_NOTES', payload: '' });
        }}
        selectedReturn={state.selectedReturn}
        actionType={state.actionType}
        actionNotes={state.actionNotes}
        submitting={state.submitting}
        isRtl={isRtl}
        handleActionSubmit={handleActionSubmit}
        setActionNotes={(notes) => dispatch({ type: 'SET_ACTION_NOTES', payload: notes })}
      />
    </div>
  );
};

export default AdminReturns;