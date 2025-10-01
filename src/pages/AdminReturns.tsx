import React, { useReducer, useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useNotifications } from '../contexts/NotificationContext';
import { returnsAPI, notificationsAPI, branchesAPI, inventoryAPI } from '../services/api';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Package, AlertCircle, Grid, Table2, Download , Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Filters from '../components/Returns/Filters';
import ReturnCard from '../components/Returns/ReturnCard';
import ReturnTable from '../components/Returns/ReturnTable';
import ReturnCardSkeleton from '../components/Returns/ReturnCardSkeleton';
import ReturnTableSkeleton from '../components/Returns/ReturnTableSkeleton';
import Pagination from '../components/Returns/Pagination';
import ReturnModal from '../components/Returns/ReturnModal';
import ActionModal from '../components/Returns/ActionModal';
import { formatDate } from '../utils/formatDate';
import 'react-toastify/dist/ReactToastify.css';
import 'tailwindcss/tailwind.css';

const reducer = (state, action) => {
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

const initialState = {
  returns: [],
  selectedReturn: null,
  branches: [],
  isViewModalOpen: false,
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
  socketConnected: false,
  socketError: null,
  viewMode: 'card',
};

const RETURNS_PER_PAGE_CARD = 10;
const RETURNS_PER_PAGE_TABLE = 50;

const AdminReturns = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { socket } = useSocket();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  const [branchesLoading, setBranchesLoading] = useState(true);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const toastOptions = useMemo(
    () => ({
      position: isRtl ? 'top-left' : 'top-right',
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      className: 'bg-white text-gray-800 rounded-lg shadow-lg border border-gray-200 p-3',
      progressClassName: 'bg-amber-500',
    }),
    [isRtl]
  );

  const STATUS_COLORS = useMemo(
    () => ({
      pending: { color: 'bg-amber-100 text-amber-800', icon: AlertCircle, label: t('returns.status.pending') },
      approved: { color: 'bg-green-100 text-green-800', icon: Check, label: t('returns.status.approved') },
      rejected: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: t('returns.status.rejected') },
      processed: { color: 'bg-blue-100 text-blue-800', icon: Check, label: t('returns.status.processed') },
    }),
    [t]
  );

  const getStatusInfo = useCallback(
    (status) => STATUS_COLORS[status] || { color: 'bg-gray-100 text-gray-800', icon: AlertCircle, label: t('returns.status.unknown') },
    [STATUS_COLORS, t]
  );

  const arrayBufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const exportToExcel = useCallback(() => {
    const exportData = state.returns.map((ret) => ({
      [t('returns.return_number')]: ret.returnNumber,
      [t('returns.order_number')]: ret.order.orderNumber,
      [t('returns.status_label')]: getStatusInfo(ret.status).label,
      [t('returns.date')]: formatDate(ret.createdAt, language),
      [t('returns.items_count')]: ret.items.length,
      [t('returns.products')]: ret.items.map((item) => `${item.productName} (${item.quantity})`).join(', '),
      [t('returns.total_quantity')]: ret.items.reduce((sum, item) => sum + item.quantity, 0),
      [t('returns.branch')]: ret.branch.name,
      [t('returns.total_amount')]: `${ret.order.totalAmount.toFixed(2)} ${t('currency')}`,
      [t('returns.notes_label')]: ret.notes || t('returns.no_notes'),
      [t('returns.review_notes')]: ret.reviewNotes || t('returns.no_notes'),
    }));
    const ws = XLSX.utils.json_to_sheet(isRtl ? exportData.map((row) => Object.fromEntries(Object.entries(row).reverse())) : exportData);
    ws['!cols'] = Object.keys(exportData[0] || {}).map(() => ({ wpx: 120 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Returns');
    XLSX.writeFile(wb, `Returns_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(t('returns.export_success'), toastOptions);
  }, [state.returns, isRtl, getStatusInfo, language, t, toastOptions]);

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
        t('returns.return_number'),
        t('returns.order_number'),
        t('returns.status_label'),
        t('returns.date'),
        t('returns.items_count'),
        t('returns.products'),
        t('returns.total_quantity'),
        t('returns.branch'),
        t('returns.total_amount'),
        t('returns.notes_label'),
        t('returns.review_notes'),
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
        `${ret.order.totalAmount.toFixed(2)} ${t('currency')}`,
        ret.notes || t('returns.no_notes'),
        ret.reviewNotes || t('returns.no_notes'),
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
          doc.text(t('returns.title'), isRtl ? doc.internal.pageSize.width - data.settings.margin.right : data.settings.margin.left, 10, {
            align: isRtl ? 'right' : 'left',
          });
        },
      });
      doc.save(`Returns_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success(t('returns.pdf_export_success'), toastOptions);
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error(t('errors.pdf_export'), toastOptions);
    }
  }, [state.returns, isRtl, getStatusInfo, language, t, toastOptions]);

  const { data: branchesData, isLoading: isBranchesLoading, error: branchesError } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await branchesAPI.getAll();
      return response.map((branch) => ({
        _id: branch._id || 'unknown',
        name: isRtl ? branch.name : branch.nameEn || t('branches.unknown'),
      }));
    },
    onError: (err) => {
      toast.error(t('errors.fetch_branches'), toastOptions);
    },
    onSuccess: (data) => {
      dispatch({ type: 'SET_BRANCHES', payload: data });
      setBranchesLoading(false);
    },
  });

  const { data: returnsData, isLoading, error } = useQuery({
    queryKey: ['returns', state.filterStatus, state.filterBranch, state.searchQuery, state.sortBy, state.sortOrder, state.currentPage, state.viewMode],
    queryFn: async () => {
      if (!user) throw new Error(t('errors.unauthorized_access'));
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
      if (!Array.isArray(returnsData)) throw new Error('Invalid returns data format');
      return {
        returns: returnsData.map((ret) => ({
          id: ret._id || 'unknown',
          returnNumber: ret.returnNumber || t('returns.unknown'),
          order: {
            id: ret.order?._id || 'unknown',
            orderNumber: ret.order?.orderNumber || t('orders.unknown'),
            totalAmount: Number(ret.order?.totalAmount) || 0,
            createdAt: ret.order?.createdAt || new Date().toISOString(),
            branch: ret.order?.branch?._id || 'unknown',
            branchName: isRtl ? ret.order?.branch?.name : ret.order?.branch?.nameEn || t('branches.unknown'),
          },
          items: Array.isArray(ret.items)
            ? ret.items.map((item) => ({
                itemId: item.itemId || item._id || 'unknown',
                productId: item.product?._id || 'unknown',
                productName: isRtl ? item.product?.name : item.product?.nameEn || t('products.unknown'),
                quantity: Number(item.quantity) || 0,
                price: Number(item.product?.price) || 0,
                reason: isRtl ? item.reason : item.reasonEn || item.reason || t('returns.reason.unknown'),
                status: item.status || 'pending',
                reviewNotes: item.reviewNotes || '',
              }))
            : [],
          status: ret.status || 'pending',
          date: formatDate(ret.createdAt, language),
          createdAt: ret.createdAt || new Date().toISOString(),
          notes: isRtl ? ret.notes : ret.notesEn || ret.notes || '',
          reviewNotes: isRtl ? ret.reviewNotes : ret.reviewNotesEn || ret.reviewNotes || '',
          branch: {
            _id: ret.branch?._id || 'unknown',
            name: isRtl ? ret.branch?.name : ret.branch?.nameEn || t('branches.unknown'),
          },
          createdBy: {
            _id: ret.createdBy?._id || 'unknown',
            username: ret.createdBy?.username || t('users.unknown'),
          },
          reviewedBy: ret.reviewedBy
            ? { _id: ret.reviewedBy._id, username: ret.reviewedBy.username || t('users.unknown') }
            : undefined,
          statusHistory: Array.isArray(ret.statusHistory) ? ret.statusHistory : [],
        })),
        total,
      };
    },
    onSuccess: (data) => {
      dispatch({ type: 'SET_RETURNS', payload: { returns: data.returns, totalCount: data.total } });
      dispatch({ type: 'SET_ERROR', payload: '' });
      dispatch({ type: 'SET_LOADING', payload: false });
    },
    onError: (err) => {
      const errorMessage =
        err.status === 403
          ? t('errors.unauthorized_access')
          : err.status === 404
          ? t('errors.return_not_found')
          : err.message || t('errors.fetch_returns');
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      dispatch({ type: 'SET_LOADING', payload: false });
      toast.error(errorMessage, toastOptions);
    },
  });

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
      toast.info(t('socket.connected'), toastOptions);
    };
    const handleDisconnect = () => {
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: false });
      dispatch({ type: 'SET_SOCKET_ERROR', payload: t('socket.disconnected') });
      toast.warn(t('socket.disconnected'), toastOptions);
    };
    const handleConnectError = (error) => {
      dispatch({ type: 'SET_SOCKET_ERROR', payload: t('socket.connect_error', { message: error.message }) });
      toast.error(t('socket.connect_error', { message: error.message }), toastOptions);
    };
    const handleReturnCreated = (newReturn) => {
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
      const mappedReturn = {
        id: newReturn._id || 'unknown',
        returnNumber: newReturn.returnNumber || t('returns.unknown'),
        order: {
          id: newReturn.order?._id || 'unknown',
          orderNumber: newReturn.order?.orderNumber || t('orders.unknown'),
          totalAmount: Number(newReturn.order?.totalAmount) || 0,
          createdAt: newReturn.order?.createdAt || new Date().toISOString(),
          branch: newReturn.order?.branch?._id || 'unknown',
          branchName: isRtl ? newReturn.order?.branch?.name : newReturn.order?.branch?.nameEn || t('branches.unknown'),
        },
        items: Array.isArray(newReturn.items)
          ? newReturn.items.map((item) => ({
              itemId: item.itemId || item._id || 'unknown',
              productId: item.product?._id || 'unknown',
              productName: isRtl ? item.product?.name : item.product?.nameEn || t('products.unknown'),
              quantity: Number(item.quantity) || 0,
              price: Number(item.product?.price) || 0,
              reason: isRtl ? item.reason : item.reasonEn || item.reason || t('returns.reason.unknown'),
              status: item.status || 'pending',
              reviewNotes: item.reviewNotes || '',
            }))
          : [],
        status: newReturn.status || 'pending',
        date: formatDate(newReturn.createdAt, language),
        createdAt: newReturn.createdAt || new Date().toISOString(),
        notes: isRtl ? newReturn.notes : newReturn.notesEn || newReturn.notes || '',
        reviewNotes: isRtl ? newReturn.reviewNotes : newReturn.reviewNotesEn || newReturn.reviewNotes || '',
        branch: {
          _id: newReturn.branch?._id || 'unknown',
          name: isRtl ? newReturn.branch?.name : newReturn.branch?.nameEn || t('branches.unknown'),
        },
        createdBy: {
          _id: newReturn.createdBy?._id || 'unknown',
          username: newReturn.createdBy?.username || t('users.unknown'),
        },
        reviewedBy: newReturn.reviewedBy
          ? { _id: newReturn.reviewedBy._id, username: newReturn.reviewedBy.username || t('users.unknown') }
          : undefined,
        statusHistory: Array.isArray(newReturn.statusHistory) ? newReturn.statusHistory : [],
      };
      dispatch({ type: 'ADD_RETURN', payload: mappedReturn });
      if (document.hasFocus()) {
        addNotification({
          _id: `return-${newReturn._id}-${Date.now()}`,
          type: 'success',
          message: t('returns.new_return_notification', { returnNumber: newReturn.returnNumber }),
          data: { returnId: newReturn._id, orderId: newReturn.order?._id },
          read: false,
          createdAt: newReturn.createdAt,
        });
      }
    };
    const handleReturnStatusUpdated = ({ returnId, status, reviewNotes, branchId, adjustedTotal }) => {
      dispatch({
        type: 'UPDATE_RETURN_STATUS',
        returnId,
        status,
        reviewNotes,
        adjustedTotal,
      });
      if (document.hasFocus()) {
        addNotification({
          _id: `return-status-${returnId}-${Date.now()}`,
          type: 'info',
          message: t('socket.return_status_updated', { status: getStatusInfo(status).label, returnNumber: state.returns.find((r) => r.id === returnId)?.returnNumber || returnId }),
          data: { returnId },
          read: false,
          createdAt: new Date().toISOString(),
        });
      }
      if (status === 'approved') {
        socket.emit('inventoryUpdated', { branchId });
      }
    };
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('returnCreated', handleReturnCreated);
    socket.on('returnStatusUpdated', handleReturnStatusUpdated);
    socket.on('reconnect_attempt', () => {
      dispatch({ type: 'SET_SOCKET_ERROR', payload: t('socket.reconnecting') });
    });
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('returnCreated');
      socket.off('returnStatusUpdated');
      socket.off('reconnect_attempt');
    };
  }, [socket, user, addNotification, getStatusInfo, state.returns, t, toastOptions]);

  const handlePageChange = useCallback((page) => {
    dispatch({ type: 'SET_PAGE', payload: page });
  }, []);

  const viewReturn = useCallback((ret) => {
    dispatch({ type: 'SET_SELECTED_RETURN', payload: ret });
    dispatch({ type: 'SET_VIEW_MODAL', isOpen: true });
  }, []);

  const openActionModal = useCallback((ret, type) => {
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
        if (state.actionType === 'approved') {
          await inventoryAPI.processReturnItems(state.selectedReturn.id, {
            branchId: state.selectedReturn.branch._id,
            items: state.selectedReturn.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              status: state.actionType,
              reviewNotes: state.actionNotes,
            })),
          });
        }
        dispatch({
          type: 'UPDATE_RETURN_STATUS',
          returnId: state.selectedReturn.id,
          status: state.actionType,
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
          message: t('socket.return_status_updated', { status: t(`returns.status.${state.actionType}`), returnNumber: state.selectedReturn.returnNumber }),
          data: { returnId: state.selectedReturn.id, orderId: state.selectedReturn.order.id },
        });
        toast.success(t(`returns.${state.actionType}_success`), toastOptions);
        dispatch({ type: 'SET_ACTION_MODAL', isOpen: false });
        dispatch({ type: 'SET_ACTION_TYPE', payload: null });
        dispatch({ type: 'SET_ACTION_NOTES', payload: '' });
        dispatch({ type: 'SET_SELECTED_RETURN', payload: null });
      } catch (err) {
        const errorMessage = err.message || t(`errors.${state.actionType}_return`);
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, toastOptions);
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    }, 500),
    [state.selectedReturn, state.actionType, state.actionNotes, user, socket, t, toastOptions]
  );

  const handleSearchChange = useCallback((e) => {
    const value = e.target.value || '';
    dispatch({ type: 'SET_SEARCH_QUERY', payload: value });
  }, []);

  const handleFilterStatusChange = useCallback((value) => {
    dispatch({ type: 'SET_FILTER_STATUS', payload: value });
  }, []);

  const handleFilterBranchChange = useCallback((value) => {
    dispatch({ type: 'SET_FILTER_BRANCH', payload: value });
  }, []);

  const handleSortChange = useCallback((by, order) => {
    dispatch({ type: 'SET_SORT', by, order });
  }, []);

  const handleViewModeToggle = useCallback(() => {
    dispatch({ type: 'SET_VIEW_MODE', payload: state.viewMode === 'card' ? 'table' : 'card' });
  }, [state.viewMode]);

  const totalPages = useMemo(() => {
    return Math.ceil(state.totalCount / (state.viewMode === 'table' ? RETURNS_PER_PAGE_TABLE : RETURNS_PER_PAGE_CARD));
  }, [state.totalCount, state.viewMode]);

  const paginatedReturns = useMemo(() => {
    const start = (state.currentPage - 1) * (state.viewMode === 'table' ? RETURNS_PER_PAGE_TABLE : RETURNS_PER_PAGE_CARD);
    const end = start + (state.viewMode === 'table' ? RETURNS_PER_PAGE_TABLE : RETURNS_PER_PAGE_CARD);
    return state.returns.slice(start, end);
  }, [state.returns, state.currentPage, state.viewMode]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen bg-gray-50"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <AnimatePresence>
        {isLoading || branchesLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="min-h-screen flex items-center justify-center"
          >
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-amber-600"></div>
          </motion.div>
        ) : error || branchesError ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex justify-center"
          >
            <div className="p-6 max-w-md text-center bg-red-50 shadow-lg rounded-lg border border-red-200">
              <div className={`flex items-center justify-center gap-3 mb-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <AlertCircle className="w-8 h-8 text-red-600" />
                <p className="text-lg font-semibold text-red-600">{error || branchesError?.message || t('errors.fetch_returns')}</p>
              </div>
              <button
                onClick={() => queryClient.invalidateQueries(['returns', 'branches'])}
                className="bg-amber-600 hover:bg-amber-700 text-white rounded-full px-6 py-2 transition-colors duration-200"
                aria-label={t('common.retry')}
              >
                {t('common.retry')}
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-6">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="sticky top-0 z-10 bg-gray-50 py-4 border-b border-gray-100"
            >
              <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${isRtl ? 'sm:flex-row-reverse' : ''}`}>
                <div className="flex items-center gap-3">
                  <Package className="w-8 h-8 text-teal-600" />
                  <div>
                    <h1 className="text-2xl font-bold text-gray-800">{t('returns.title')}</h1>
                    <p className="text-sm text-gray-600">{t('returns.subtitle_admin')}</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={handleViewModeToggle}
                    className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 text-white rounded-full text-sm hover:bg-teal-700 transition-colors"
                    aria-label={t(`returns.${state.viewMode === 'card' ? 'table_view' : 'card_view'}`)}
                  >
                    {state.viewMode === 'card' ? <Table2 className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
                    {t(`returns.${state.viewMode === 'card' ? 'table' : 'cards'}`)}
                  </button>
                  <button
                    onClick={exportToExcel}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-full text-sm hover:bg-green-700 transition-colors"
                    aria-label={t('returns.export_excel')}
                  >
                    <Download className="w-4 h-4" />
                    {t('returns.excel')}
                  </button>
                  <button
                    onClick={exportToPDF}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-full text-sm hover:bg-blue-700 transition-colors"
                    aria-label={t('returns.export_pdf')}
                  >
                    <Download className="w-4 h-4" />
                    {t('returns.pdf')}
                  </button>
                </div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Filters
                filterStatus={state.filterStatus}
                filterBranch={state.filterBranch}
                searchQuery={state.searchQuery}
                sortBy={state.sortBy}
                sortOrder={state.sortOrder}
                branches={state.branches}
                onFilterStatusChange={handleFilterStatusChange}
                onFilterBranchChange={handleFilterBranchChange}
                onSearchChange={handleSearchChange}
                onSortChange={handleSortChange}
                isRtl={isRtl}
                t={t}
              />
              <div className="text-sm text-center text-gray-600 mt-3">{t('returns.returns_count', { count: state.returns.length })}</div>
            </motion.div>
            <div className="flex flex-col gap-4">
              {paginatedReturns.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="p-6 text-center bg-white shadow-lg rounded-lg border border-gray-200">
                    <Package className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('returns.no_returns')}</h3>
                    <p className="text-base text-gray-600">{state.filterStatus || state.filterBranch || state.searchQuery ? t('returns.no_matching_returns') : t('returns.no_returns_yet')}</p>
                  </div>
                </motion.div>
              ) : state.viewMode === 'card' ? (
                paginatedReturns.map((ret) => (
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
                ))
              ) : (
                <ReturnTable
                  returns={paginatedReturns}
                  isRtl={isRtl}
                  getStatusInfo={getStatusInfo}
                  viewReturn={viewReturn}
                  openActionModal={openActionModal}
                  submitting={state.submitting}
                  user={user}
                />
              )}
            </div>
            <Pagination
              currentPage={state.currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              isRtl={isRtl}
              t={t}
            />
            <AnimatePresence>
              {state.isViewModalOpen && state.selectedReturn && (
                <ReturnModal
                  isOpen={state.isViewModalOpen}
                  onClose={() => dispatch({ type: 'SET_VIEW_MODAL', isOpen: false })}
                  selectedReturn={state.selectedReturn}
                  isRtl={isRtl}
                  getStatusInfo={getStatusInfo}
                />
              )}
              {state.isActionModalOpen && state.selectedReturn && state.actionType && (
                <ActionModal
                  isOpen={state.isActionModalOpen}
                  onClose={() => dispatch({ type: 'SET_ACTION_MODAL', isOpen: false })}
                  selectedReturn={state.selectedReturn}
                  actionType={state.actionType}
                  actionNotes={state.actionNotes}
                  submitting={state.submitting}
                  isRtl={isRtl}
                  handleActionSubmit={handleActionSubmit}
                  setActionNotes={(notes) => dispatch({ type: 'SET_ACTION_NOTES', payload: notes })}
                />
              )}
            </AnimatePresence>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AdminReturns;
