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
import { Order, State, Action, ReturnForm } from '../types/types';

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_ORDERS':
      return { ...state, orders: action.payload };
    case 'ADD_ORDER':
      return { ...state, orders: [action.payload, ...state.orders] };
    case 'SET_SELECTED_ORDER':
      return { ...state, selectedOrder: action.payload };
    case 'SET_MODAL':
      return {
        ...state,
        isViewModalOpen: action.modal === 'view' ? action.isOpen : state.isViewModalOpen,
        isConfirmDeliveryModalOpen: action.modal === 'confirmDelivery' ? action.isOpen : state.isConfirmDeliveryModalOpen,
        isReturnModalOpen: action.modal === 'return' ? action.isOpen : state.isReturnModalOpen,
      };
    case 'SET_RETURN_FORM':
      return { ...state, returnFormData: action.payload };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload, currentPage: 1 };
    case 'SET_FILTER_STATUS':
      return { ...state, filterStatus: action.payload, currentPage: 1 };
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
    case 'UPDATE_ORDER_STATUS':
      return {
        ...state,
        orders: state.orders.map((o) =>
          o.id === action.orderId ? { ...o, status: action.status, ...action.payload } : o
        ),
        selectedOrder: state.selectedOrder?.id === action.orderId ? { ...state.selectedOrder, status: action.status, ...action.payload } : state.selectedOrder,
      };
    case 'UPDATE_ITEM_STATUS':
      return {
        ...state,
        orders: state.orders.map((o) =>
          o.id === action.payload.orderId
            ? {
                ...o,
                items: o.items.map((i) =>
                  i.itemId === action.payload.itemId ? { ...i, status: action.payload.status } : i
                ),
              }
            : o
        ),
        selectedOrder:
          state.selectedOrder?.id === action.payload.orderId
            ? {
                ...state.selectedOrder,
                items: state.selectedOrder.items.map((i) =>
                  i.itemId === action.payload.itemId ? { ...i, status: action.payload.status } : i
                ),
              }
            : state.selectedOrder,
      };
    case 'ADD_RETURN':
      return {
        ...state,
        orders: state.orders.map((o) =>
          o.id === action.orderId ? { ...o, returns: [...(o.returns || []), action.returnData] } : o
        ),
        selectedOrder:
          state.selectedOrder?.id === action.orderId
            ? { ...state.selectedOrder, returns: [...(state.selectedOrder.returns || []), action.returnData] }
            : state.selectedOrder,
      };
    case 'UPDATE_RETURN_STATUS':
      return {
        ...state,
        orders: state.orders.map((o) =>
          o.id === action.orderId
            ? {
                ...o,
                returns: o.returns.map((r) =>
                  r.returnId === action.returnId ? { ...r, status: action.status } : r
                ),
              }
            : o
        ),
        selectedOrder:
          state.selectedOrder?.id === action.orderId
            ? {
                ...state.selectedOrder,
                returns: state.selectedOrder.returns.map((r) =>
                  r.returnId === action.returnId ? { ...r, status: action.status } : r
                ),
              }
            : state.selectedOrder,
      };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload, currentPage: 1 };
    case 'SET_INVENTORY':
      return { ...state, inventory: action.payload };
    case 'UPDATE_INVENTORY':
      return {
        ...state,
        inventory: state.inventory.map((item) =>
          item.productId === action.payload.productId ? { ...item, quantity: item.quantity + action.payload.quantity } : item
        ),
      };
    default:
      return state;
  }
};

const initialState: State = {
  orders: [],
  selectedOrder: null,
  isViewModalOpen: false,
  isConfirmDeliveryModalOpen: false,
  isReturnModalOpen: false,
  returnFormData: { itemId: '', quantity: 0, reason: '', reasonEn: '', notes: '', notesEn: '' },
  searchQuery: '',
  filterStatus: '',
  sortBy: 'date',
  sortOrder: 'desc',
  currentPage: 1,
  loading: true,
  error: '',
  submitting: null,
  socketConnected: false,
  socketError: null,
  viewMode: 'card',
  inventory: [],
  isRtl: true,
};

const ORDERS_PER_PAGE_CARD = 10;
const ORDERS_PER_PAGE_TABLE = 50;

export const AdminOrders: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { socket } = useSocket();
  const { addNotification } = useNotifications();
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  const [hasInteracted, setHasInteracted] = useState(false);

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

  const fetchOrders = useCallback(async () => {
    if (!user) {
      dispatch({ type: 'SET_ERROR', payload: isRtl ? 'الوصول غير مصرح به' : 'Unauthorized access' });
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const query = {
        status: state.filterStatus,
        search: state.searchQuery,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        page: state.currentPage,
        limit: state.viewMode === 'table' ? ORDERS_PER_PAGE_TABLE : ORDERS_PER_PAGE_CARD,
      };
      const response = await returnsAPI.getAll(query); // يجب تعديل هذا ليتوافق مع API للطلبات
      const formattedOrders = response.orders.map((order: any) => ({
        id: order._id,
        orderNumber: order.orderNumber,
        branchId: order.branch?._id || 'unknown',
        branchName: isRtl ? order.branch?.name : order.branch?.nameEn || order.branch?.name || 'Unknown',
        branch: {
          _id: order.branch?._id || 'unknown',
          name: order.branch?.name || 'Unknown',
          nameEn: order.branch?.nameEn,
          displayName: isRtl ? order.branch?.name : order.branch?.nameEn || order.branch?.name || 'Unknown',
        },
        items: order.items.map((item: any) => ({
          itemId: item._id,
          productId: item.productId,
          productName: item.productName,
          productNameEn: item.productNameEn,
          quantity: item.quantity,
          price: item.price,
          department: item.department,
          status: item.status,
          unit: item.unit,
          unitEn: item.unitEn,
          displayUnit: isRtl ? item.unit : item.unitEn || item.unit || 'N/A',
          returnedQuantity: item.returnedQuantity,
          returnReason: item.returnReason,
          returnReasonEn: item.returnReasonEn,
          displayReturnReason: isRtl ? item.returnReason : item.returnReasonEn || item.returnReason || 'N/A',
          assignedTo: item.assignedTo,
          startedAt: item.startedAt,
          completedAt: item.completedAt,
          isCompleted: item.isCompleted,
        })),
        returns: order.returns || [],
        status: order.status,
        totalAmount: order.totalAmount,
        adjustedTotal: order.adjustedTotal,
        date: formatDate(order.createdAt, language),
        requestedDeliveryDate: order.requestedDeliveryDate,
        notes: order.notes,
        notesEn: order.notesEn,
        displayNotes: isRtl ? order.notes : order.notesEn || order.notes || 'N/A',
        priority: order.priority,
        createdBy: order.createdBy,
        createdByName: isRtl ? order.createdBy?.name : order.createdBy?.nameEn || order.createdBy?.name || 'Unknown',
        statusHistory: order.statusHistory || [],
        approvedAt: order.approvedAt,
        transitStartedAt: order.transitStartedAt,
        deliveredAt: order.deliveredAt,
        confirmedAt: order.confirmedAt,
        confirmedBy: order.confirmedBy,
        isRtl,
      }));
      dispatch({ type: 'SET_ORDERS', payload: formattedOrders });
      dispatch({ type: 'SET_ERROR', payload: '' });
    } catch (err: any) {
      const errorMessage =
        err.status === 403
          ? isRtl ? 'الوصول غير مصرح به' : 'Unauthorized access'
          : err.status === 404
          ? isRtl ? 'لم يتم العثور على الطلبات' : 'Orders not found'
          : err.message || (isRtl ? 'خطأ في جلب الطلبات' : 'Error fetching orders');
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.filterStatus, state.searchQuery, state.sortBy, state.sortOrder, state.currentPage, state.viewMode, user, isRtl, language]);

  const debouncedFetchOrders = useCallback(debounce(fetchOrders, 300), [fetchOrders]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: e.target.value });
  }, []);

  const handleSubmitReturn = useCallback(
    async (e: React.FormEvent, order: Order | null, returnFormData: ReturnForm) => {
      e.preventDefault();
      if (!order || !user) return;
      dispatch({ type: 'SET_SUBMITTING', payload: order.id });
      try {
        const selectedItem = order.items.find((item) => item.itemId === returnFormData.itemId);
        if (!selectedItem) throw new Error(isRtl ? 'العنصر غير موجود' : 'Item not found');
        if (returnFormData.quantity > (selectedItem.quantity - (selectedItem.returnedQuantity || 0))) {
          throw new Error(isRtl ? 'الكمية المطلوب إرجاعها تتجاوز الكمية المتاحة' : 'Return quantity exceeds available quantity');
        }
        const response = await returnsAPI.createReturn({
          orderId: order.id,
          branchId: order.branchId,
          reason: returnFormData.reason,
          items: [
            {
              product: selectedItem.productId,
              quantity: returnFormData.quantity,
              reason: returnFormData.reason,
            },
          ],
          notes: returnFormData.notes,
        });
        dispatch({
          type: 'ADD_RETURN',
          orderId: order.id,
          returnData: {
            returnId: response.data._id,
            items: response.data.items,
            status: response.data.status,
            reviewNotes: response.data.reviewNotes,
            createdAt: response.data.createdAt,
          },
        });
        socket?.emit('returnCreated', {
          returnId: response.data._id,
          orderId: order.id,
          branchId: order.branchId,
          returnNumber: response.data.returnNumber,
          status: response.data.status,
          reason: returnFormData.reason,
          returnItems: response.data.items,
          createdAt: response.data.createdAt,
        });
        await notificationsAPI.create({
          user: user.id,
          type: 'return_created',
          message: isRtl
            ? `تم إنشاء طلب إرجاع جديد: ${response.data.returnNumber}`
            : `New return request created: ${response.data.returnNumber}`,
          data: { returnId: response.data._id, orderId: order.id },
        });
        toast.success(isRtl ? 'تم إنشاء طلب الإرجاع بنجاح' : 'Return request created successfully', {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
        dispatch({ type: 'SET_MODAL', modal: 'return', isOpen: false });
        dispatch({ type: 'SET_RETURN_FORM', payload: { itemId: '', quantity: 0, reason: '', reasonEn: '', notes: '', notesEn: '' } });
      } catch (err: any) {
        const errorMessage = err.message || (isRtl ? 'فشل إنشاء طلب الإرجاع' : 'Failed to create return request');
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [user, socket, isRtl]
  );

  useEffect(() => {
    debouncedFetchOrders();
    return () => debouncedFetchOrders.cancel();
  }, [state.filterStatus, state.searchQuery, state.sortBy, state.sortOrder, state.currentPage, state.viewMode, debouncedFetchOrders]);

  useEffect(() => {
    if (!socket || !user) return;
    const handleConnect = () => {
      socket.emit('joinRoom', {
        role: user.role,
        branchId: user.branchId,
        userId: user.id,
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
      if (currentState.searchQuery && !newReturn.orderNumber.toLowerCase().includes(currentState.searchQuery.toLowerCase())) return;
      dispatch({
        type: 'ADD_RETURN',
        orderId: newReturn.orderId,
        returnData: {
          returnId: newReturn._id,
          items: newReturn.items,
          status: newReturn.status,
          createdAt: newReturn.createdAt,
        },
      });
      if (document.hasFocus()) {
        addNotification({
          _id: `return-${newReturn._id}-${Date.now()}`,
          type: 'success',
          message: isRtl ? `تم إنشاء طلب إرجاع جديد: ${newReturn.returnNumber}` : `New return request created: ${newReturn.returnNumber}`,
          data: { returnId: newReturn._id, orderId: newReturn.orderId },
          read: false,
          createdAt: newReturn.createdAt,
        });
        playNotificationSound();
      }
    };
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('returnCreated', handleReturnCreated);
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('returnCreated', handleReturnCreated);
    };
  }, [socket, user, isRtl, addNotification, playNotificationSound]);

  const totalPages = useMemo(() => {
    return Math.ceil(state.orders.length / (state.viewMode === 'table' ? ORDERS_PER_PAGE_TABLE : ORDERS_PER_PAGE_CARD));
  }, [state.orders.length, state.viewMode]);

  const handleViewModeToggle = useCallback(() => {
    dispatch({ type: 'SET_VIEW_MODE', payload: state.viewMode === 'card' ? 'table' : 'card' });
  }, [state.viewMode]);

  return (
    <div className="mx-auto px-4 py-8 min-h-screen" dir={isRtl ? 'rtl' : 'ltr'}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <Package className="w-8 h-8 text-teal-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{isRtl ? 'إدارة الطلبات' : 'Orders Management'}</h1>
            <p className="text-sm text-gray-600">{isRtl ? 'إدارة ومراجعة الطلبات بكفاءة' : 'Manage and review orders efficiently'}</p>
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
      <div className="mb-6">
        <Filters
          state={state}
          dispatch={dispatch}
          isRtl={isRtl}
          branches={[]} // يجب استبدال هذا بجلب الفروع من API
          onSearchChange={handleSearchChange}
        />
      </div>
      {state.loading ? (
        <div className="space-y-4">
          {state.viewMode === 'table' ? (
            <ReturnTableSkeleton isRtl={isRtl} />
          ) : (
            Array(5).fill(0).map((_, index) => <ReturnCardSkeleton key={index} />)
          )}
        </div>
      ) : state.orders.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="p-8 text-center bg-white rounded-xl shadow-md">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-sm text-gray-600">{isRtl ? 'لا توجد طلبات' : 'No orders available'}</p>
          </div>
        </motion.div>
      ) : (
        <>
          {state.viewMode === 'card' ? (
            <div className="grid grid-cols-1 gap-4">
              {state.orders.map((order) => (
                <ReturnCard
                  key={order.id}
                  ret={order} // يجب تعديل ReturnCard لدعم Order بدلاً من Return
                  isRtl={isRtl}
                  getStatusInfo={(status: string) => ({
                    color: 'bg-amber-100 text-amber-800',
                    icon: AlertCircle,
                    label: isRtl ? status : status,
                  })}
                  viewReturn={(order: Order) => dispatch({ type: 'SET_SELECTED_ORDER', payload: order })}
                  openActionModal={() => {}} // يحتاج إلى تعديل لدعم الإرجاع
                  submitting={state.submitting}
                  user={user}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <ReturnTable
                returns={state.orders} // يجب تعديل ReturnTable لدعم Order بدلاً من Return
                isRtl={isRtl}
                getStatusInfo={(status: string) => ({
                  color: 'bg-amber-100 text-amber-800',
                  icon: AlertCircle,
                  label: isRtl ? status : status,
                })}
                viewReturn={(order: Order) => dispatch({ type: 'SET_SELECTED_ORDER', payload: order })}
                openActionModal={() => {}} // يحتاج إلى تعديل لدعم الإرجاع
                submitting={state.submitting}
                user={user}
              />
            </div>
          )}
          {totalPages > 1 && (
            <Pagination
              handlePageChange={(page: number) => dispatch({ type: 'SET_PAGE', payload: page })}
              currentPage={state.currentPage}
              totalPages={totalPages}
              isRtl={isRtl}
            />
          )}
        </>
      )}
      <ReturnModal
        isOpen={state.isReturnModalOpen}
        onClose={() => {
          dispatch({ type: 'SET_MODAL', modal: 'return', isOpen: false });
          dispatch({ type: 'SET_SELECTED_ORDER', payload: null });
        }}
        order={state.selectedOrder}
        returnFormData={state.returnFormData}
        setReturnFormData={(data: ReturnForm) => dispatch({ type: 'SET_RETURN_FORM', payload: data })}
        t={(key: string) => key} // يجب استبدال هذا بدالة ترجمة فعلية
        isRtl={isRtl}
        onSubmit={handleSubmitReturn}
        submitting={state.submitting}
      />
    </div>
  );
};

export default AdminOrders;