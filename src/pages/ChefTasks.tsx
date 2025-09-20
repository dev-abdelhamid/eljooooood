import React, { useReducer, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useOrderNotifications } from '../hooks/useOrderNotifications';
import { productionAssignmentsAPI, chefsAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Select } from '../components/UI/Select';
import { Input } from '../components/UI/Input';
import { AlertCircle, CheckCircle, Clock, Package, Search } from 'lucide-react';
import { debounce } from 'lodash';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { formatDate } from '../utils/formatDate';

interface ChefTask {
  itemId: string;
  orderId: string;
  orderNumber: string;
  productId: string;
  productName: string;
  quantity: number;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: string;
  updatedAt: string;
  progress?: number;
  branchName?: string;
  branchId?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  department?: { _id: string; name: string };
  assignedTo?: { _id: string};
}

interface State {
  tasks: ChefTask[];
  chefId: string | null;
  loading: boolean;
  error: string;
  submitting: string | null;
  socketConnected: boolean;
  filter: { status: string; search: string };
  page: number;
  totalPages: number;
}

type Action =
  | { type: 'SET_TASKS'; payload: { tasks: ChefTask[]; totalPages: number } }
  | { type: 'SET_CHEF_ID'; payload: string | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_SUBMITTING'; payload: string | null }
  | { type: 'SET_SOCKET_CONNECTED'; payload: boolean }
  | { type: 'SET_FILTER'; payload: { status: string; search: string } }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'TASK_ASSIGNED'; payload: { orderId: string; items: any[]; orderNumber: string; branchName: string } }
  | { type: 'UPDATE_ITEM_STATUS'; payload: { orderId: string; itemId: string; status: string; updatedAt: string } }
  | { type: 'UPDATE_ORDER_STATUS'; orderId: string; status: string };

const initialState: State = {
  tasks: [],
  chefId: null,
  loading: true,
  error: '',
  submitting: null,
  socketConnected: false,
  filter: { status: 'all', search: '' },
  page: 1,
  totalPages: 1,
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { data: ChefTask[]; timestamp: number }>();

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_TASKS':
      return { ...state, tasks: action.payload.tasks, totalPages: action.payload.totalPages, loading: false };
    case 'SET_CHEF_ID':
      return { ...state, chefId: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'SET_SUBMITTING':
      return { ...state, submitting: action.payload };
    case 'SET_SOCKET_CONNECTED':
      return { ...state, socketConnected: action.payload };
    case 'SET_FILTER':
      return { ...state, filter: action.payload, page: 1 };
    case 'SET_PAGE':
      return { ...state, page: action.payload };
    case 'TASK_ASSIGNED': {
      const items = Array.isArray(action.payload.items) ? action.payload.items : [];
      if (!items.length || !action.payload.orderId || !action.payload.orderNumber || !action.payload.branchName) {
        console.warn(`[${new Date().toISOString()}] Invalid task assigned data:`, action.payload);
        return state;
      }
      const newTasks = items
        .filter((item) => item.assignedTo?._id === state.chefId)
        .map((item) => ({
          itemId: item.itemId || 'unknown',
          orderId: action.payload.orderId || 'unknown',
          orderNumber: action.payload.orderNumber || 'N/A',
          productId: item.productId || 'unknown',
          productName: item.productName || 'Unknown Product',
          quantity: Number(item.quantity) || 1,
          status: item.status || 'pending',
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: item.updatedAt || new Date().toISOString(),
          progress: getStatusInfo(item.status || 'pending').progress,
          branchName: action.payload.branchName || 'Unknown Branch',
          branchId: item.branchId || 'unknown',
          priority: item.priority || 'medium',
          department: item.department || { _id: 'unknown', name: 'Unknown Department' },
          assignedTo: item.assignedTo || { _id: 'unknown', username: 'Unknown Chef' },
        }));
      const updatedTasks = [...state.tasks.filter((t) => !newTasks.some((nt) => nt.itemId === t.itemId)), ...newTasks];
      return {
        ...state,
        tasks: updatedTasks,
        totalPages: Math.ceil(updatedTasks.length / 10) || 1,
      };
    }
    case 'UPDATE_ITEM_STATUS':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.itemId === action.payload.itemId && task.orderId === action.payload.orderId
            ? { ...task, status: action.payload.status, updatedAt: action.payload.updatedAt, progress: getStatusInfo(action.payload.status).progress }
            : task
        ),
      };
    case 'UPDATE_ORDER_STATUS':
      return {
        ...state,
        tasks: action.status === 'completed' || action.status === 'cancelled'
          ? state.tasks.filter((task) => task.orderId !== action.orderId)
          : state.tasks,
      };
    default:
      return state;
  }
};

const getStatusInfo = (status: ChefTask['status']) => {
  const statusMap: Record<ChefTask['status'], { label: string; color: string; icon: React.FC<{ className?: string }>; progress: number }> = {
    pending: { label: 'item_pending', color: 'bg-amber-100 text-amber-800', icon: Clock, progress: 0 },
    in_progress: { label: 'item_in_progress', color: 'bg-blue-100 text-blue-800', icon: Package, progress: 50 },
    completed: { label: 'item_completed', color: 'bg-green-100 text-green-800', icon: CheckCircle, progress: 100 },
  };
  return statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-700', icon: Clock, progress: 0 };
};

const getNextStatus = (currentStatus: string) => {
  const statusTransitions: Record<string, string> = {
    pending: 'in_progress',
    in_progress: 'completed',
    completed: 'completed',
  };
  return statusTransitions[currentStatus] || currentStatus;
};

export function ChefTasks() {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, { ...initialState, socketConnected: isConnected });
  const stateRef = useRef(state);
  stateRef.current = state;
  const tasksPerPage = 10;

  useOrderNotifications(dispatch, stateRef, user);

  const cacheKey = useMemo(
    () => `${state.chefId}-${state.page}-${state.filter.status}-${state.filter.search}`,
    [state.chefId, state.page, state.filter]
  );

  const fetchChefProfile = useCallback(async () => {
    const userId = user?.id || user?._id;
    if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
      dispatch({ type: 'SET_ERROR', payload: t('errors.unauthorized') });
      toast.error(t('errors.unauthorized'), { toastId: `error-noUserId-${Date.now()}`, position: isRtl ? 'top-left' : 'top-right' });
      navigate('/login');
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }
    if (user?.role !== 'chef') {
      dispatch({ type: 'SET_ERROR', payload: t('errors.unauthorized') });
      toast.error(t('errors.unauthorized'), { toastId: `error-notChef-${Date.now()}`, position: isRtl ? 'top-left' : 'top-right' });
      navigate('/');
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }
    try {
      const chefProfile = await chefsAPI.getByUserId(userId);
      if (!chefProfile || !chefProfile._id || !/^[0-9a-fA-F]{24}$/.test(chefProfile._id)) {
        dispatch({ type: 'SET_ERROR', payload: t('errors.invalid_chef_data') });
        toast.error(t('errors.invalid_chef_data'), { toastId: `error-noChefProfile-${Date.now()}`, position: isRtl ? 'top-left' : 'top-right' });
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }
      dispatch({ type: 'SET_CHEF_ID', payload: chefProfile._id });
    } catch (err: any) {
      const errorMessage = err.message || t('errors.chef_fetch_failed');
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      toast.error(errorMessage, { toastId: `error-chefProfile-${Date.now()}`, position: isRtl ? 'top-left' : 'top-right' });
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [user, t, isRtl, navigate]);

  const fetchTasks = useCallback(
    debounce(async (forceRefresh = false) => {
      if (!state.chefId || !/^[0-9a-fA-F]{24}$/.test(state.chefId)) {
        dispatch({ type: 'SET_ERROR', payload: t('errors.no_chef_id') });
        toast.error(t('errors.no_chef_id'), { toastId: `error-noChefId-${Date.now()}`, position: isRtl ? 'top-left' : 'top-right' });
        return;
      }
      const cached = cache.get(cacheKey);
      if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
        dispatch({ type: 'SET_TASKS', payload: { tasks: cached.data, totalPages: Math.ceil(cached.data.length / tasksPerPage) || 1 } });
        return;
      }
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const query = { page: state.page, limit: tasksPerPage };
        if (state.filter.status && state.filter.status !== 'all') query.status = state.filter.status;
        if (state.filter.search) query.search = state.filter.search;
        const response = await productionAssignmentsAPI.getChefTasks(state.chefId, query);
        if (!Array.isArray(response)) {
          throw new Error(t('errors.invalid_response'));
        }
        const mappedTasks: ChefTask[] = response
          .filter((task: any) => {
            if (!task._id || !task.order?._id || !task.product?._id || !task.chef?._id || !/^[0-9a-fA-F]{24}$/.test(task._id)) {
              console.warn(`[${new Date().toISOString()}] Invalid task data:`, task);
              toast.warn(t('errors.invalid_task_data'), { toastId: `error-task-${task?._id || 'unknown'}-${Date.now()}`, position: isRtl ? 'top-left' : 'top-right' });
              return false;
            }
            if (!task.quantity || task.quantity <= 0) {
              console.warn(`[${new Date().toISOString()}] Invalid quantity for task ${task._id}:`, task.quantity);
              toast.warn(t('errors.invalid_task_quantity'), { toastId: `error-task-quantity-${task?._id || 'unknown'}-${Date.now()}`, position: isRtl ? 'top-left' : 'top-right' });
              return false;
            }
            return true;
          })
          .map((task: any) => ({
            itemId: task._id,
            orderId: task.order._id || 'unknown',
            orderNumber: task.order.orderNumber || t('orders.unknown'),
            productId: task.product._id || 'unknown',
            productName: task.product.name || t('orders.unknown_product'),
            quantity: Number(task.quantity) || 1,
            status: task.status || 'pending',
            createdAt: task.createdAt || new Date().toISOString(),
            updatedAt: task.updatedAt || new Date().toISOString(),
            progress: getStatusInfo(task.status || 'pending').progress,
            branchName: task.order?.branch?.name || t('orders.unknown_branch'),
            branchId: task.order?.branch?._id || 'unknown',
            priority: task.order?.priority || 'medium',
            department: task.product?.department || { _id: 'unknown', name: t('orders.unknown_department') },
            assignedTo: task.chef ? { _id: task.chef._id } : undefined,
          }));
        cache.set(cacheKey, { data: mappedTasks, timestamp: Date.now() });
        dispatch({ type: 'SET_TASKS', payload: { tasks: mappedTasks, totalPages: Math.ceil(response.length / tasksPerPage) || 1 } });
        if (mappedTasks.length === 0 && response.length > 0) {
          dispatch({ type: 'SET_ERROR', payload: t('errors.all_tasks_filtered') });
          toast.warn(t('errors.all_tasks_filtered'), { toastId: `error-invalidTasks-${Date.now()}`, position: isRtl ? 'top-left' : 'top-right' });
        } else {
          dispatch({ type: 'SET_ERROR', payload: '' });
        }
      } catch (err: any) {
        const errorMessage = err.message || t('errors.task_fetch_failed');
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { toastId: `error-fetchTasks-${Date.now()}`, position: isRtl ? 'top-left' : 'top-right' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }, 300),
    [state.chefId, state.page, state.filter, cacheKey, t, isRtl]
  );

  const handleUpdateTaskStatus = useCallback(
    debounce(async (taskId: string, orderId: string, newStatus: string) => {
      if (state.submitting === taskId) return;
      if (!state.chefId || !/^[0-9a-fA-F]{24}$/.test(state.chefId)) {
        dispatch({ type: 'SET_ERROR', payload: t('errors.no_chef_id') });
        toast.error(t('errors.no_chef_id'), { toastId: `error-noChefId-${Date.now()}`, position: isRtl ? 'top-left' : 'top-right' });
        return;
      }
      if (!user?.id && !user?._id) {
        dispatch({ type: 'SET_ERROR', payload: t('errors.unauthorized') });
        toast.error(t('errors.unauthorized'), { toastId: `error-noUserId-${Date.now()}`, position: isRtl ? 'top-left' : 'top-right' });
        return;
      }
      if (!/^[0-9a-fA-F]{24}$/.test(orderId) || !/^[0-9a-fA-F]{24}$/.test(taskId)) {
        dispatch({ type: 'SET_ERROR', payload: t('errors.invalid_task_data') });
        toast.error(t('errors.invalid_task_data'), { toastId: `error-invalidTaskIds-${Date.now()}`, position: isRtl ? 'top-left' : 'top-right' });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: taskId });
      try {
        const response = await productionAssignmentsAPI.updateTaskStatus(orderId, taskId, { status: newStatus });
        dispatch({
          type: 'UPDATE_ITEM_STATUS',
          payload: { orderId, itemId: taskId, status: response.task.status, updatedAt: new Date().toISOString() },
        });
        const task = state.tasks.find((t) => t.itemId === taskId);
        if (task && state.socketConnected) {
          socket.emit('itemStatusUpdated', {
            orderId,
            itemId: taskId,
            status: newStatus,
            chefId: state.chefId,
            productName: task.productName,
            orderNumber: task.orderNumber,
            branchName: task.branchName,
            quantity: task.quantity,
            unit: task.unit || 'unit',
            eventId: crypto.randomUUID(),
          });
        }
        toast.success(t('orders.task_updated', { status: t(`orders.item_${newStatus}`) }), {
          toastId: `success-taskStatus-${taskId}-${Date.now()}`,
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        const errorMessage = err.message || t('errors.task_update_failed');
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { toastId: `error-taskUpdate-${taskId}-${Date.now()}`, position: isRtl ? 'top-left' : 'top-right' });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    }, 500),
    [t, state.tasks, state.chefId, user, socket, state.socketConnected, isRtl]
  );

  useEffect(() => {
    fetchChefProfile();
  }, [fetchChefProfile]);

  useEffect(() => {
    if (state.chefId) {
      fetchTasks();
    }
  }, [state.chefId, fetchTasks]);

  useEffect(() => {
    dispatch({ type: 'SET_SOCKET_CONNECTED', payload: isConnected });
  }, [isConnected]);

  const filteredTasks = useMemo(() => {
    return state.tasks
      .filter((task) => state.filter.status === 'all' || task.status === state.filter.status)
      .filter(
        (task) =>
          task.orderNumber.toLowerCase().includes(state.filter.search.toLowerCase()) ||
          task.productName.toLowerCase().includes(state.filter.search.toLowerCase()) ||
          task.branchName?.toLowerCase().includes(state.filter.search.toLowerCase())
      );
  }, [state.tasks, state.filter]);

  const paginatedTasks = useMemo(() => {
    const start = (state.page - 1) * tasksPerPage;
    return filteredTasks.slice(start, start + tasksPerPage);
  }, [filteredTasks, state.page]);

  const statusOptions = [
    { value: 'all', label: t('orders.all_statuses') },
    { value: 'pending', label: t('orders.item_pending') },
    { value: 'in_progress', label: t('orders.item_in_progress') },
    { value: 'completed', label: t('orders.item_completed') },
  ];

  const SkeletonCard = () => (
    <Card className="p-6 bg-white shadow-lg rounded-xl border border-gray-100 animate-pulse">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-3">
            <div className="h-6 bg-gray-200 rounded w-3/4"></div>
            <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="mt-4 h-3 bg-gray-200 rounded w-full"></div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 bg-gray-200 rounded w-28"></div>
        </div>
      </div>
    </Card>
  );

  return (
    <div className={`mx-auto px-4 sm:px-6 lg:px-8 py-6 min-h-screen ${isRtl ? 'font-arabic' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {state.loading ? (
        <div className="flex flex-col gap-4">
          {[...Array(3)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : state.error ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="max-w-md mx-auto">
          <Card className="p-6 text-center bg-red-50 shadow-lg rounded-xl border border-red-200">
            <div className="flex items-center justify-center gap-2 mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <p className="text-base font-medium text-red-600">{state.error}</p>
            </div>
            <Button
              variant="primary"
              onClick={() => {
                cache.delete(cacheKey);
                fetchChefProfile();
                if (state.chefId) fetchTasks(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-2.5 text-sm shadow-md transition-all"
              aria-label={t('orders.retry')}
            >
              {t('orders.retry')}
            </Button>
          </Card>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Package className="w-6 h-6 text-blue-600" />
              {t('orders.chef_tasks')}
            </h1>
          </div>
          <Card className="p-6 mb-8 bg-white shadow-lg rounded-xl border border-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="relative">
                <label className="block text-sm font-semibold text-gray-800 mb-2">{t('orders.search')}</label>
                <div className="flex items-center rounded-lg border border-gray-300 bg-white shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                  <Search className={`w-5 h-5 text-gray-500 absolute ${isRtl ? 'right-3' : 'left-3'}`} />
                  <Input
                    type="text"
                    value={state.filter.search}
                    onChange={(e) => dispatch({ type: 'SET_FILTER', payload: { ...state.filter, search: e.target.value } })}
                    placeholder={t('orders.search_placeholder')}
                    className={`w-full ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2.5 rounded-lg bg-transparent text-sm text-gray-900 border-0 focus:outline-none`}
                    aria-label={t('orders.search')}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">{t('orders.filter_by_status')}</label>
                <Select
                  options={statusOptions}
                  value={state.filter.status}
                  onChange={(value) => dispatch({ type: 'SET_FILTER', payload: { ...state.filter, status: value } })}
                  className="w-full rounded-lg border-gray-300 focus:ring-blue-500 text-sm shadow-sm transition-all bg-white"
                  aria-label={t('orders.filter_by_status')}
                />
              </div>
            </div>
          </Card>
          {!state.socketConnected && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg shadow-sm flex items-center gap-2"
            >
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <p className="text-sm text-yellow-700">{t('errors.socket_disconnected')}</p>
            </motion.div>
          )}
          <AnimatePresence>
            {paginatedTasks.length === 0 ? (
              <Card className="p-8 text-center bg-white shadow-lg rounded-xl border border-gray-100">
                <p className="text-base text-gray-600">{t('orders.no_tasks')}</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {paginatedTasks.map((task) => {
                  const { label, color, icon: StatusIcon, progress } = getStatusInfo(task.status);
                  return (
                    <motion.div
                      key={task.itemId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card className="p-6 bg-white shadow-lg rounded-xl border border-gray-100 hover:shadow-xl transition-all hover:-translate-y-1">
                        <div className="flex flex-col justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-lg font-bold text-gray-900 truncate">{task.productName}</h3>
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${color} flex items-center gap-1`}>
                                <StatusIcon className="w-5 h-5" />
                                {t(`orders.${label}`)}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
                              <p>
                                <span className="font-semibold">{t('orders.order_number')}:</span> {task.orderNumber}
                              </p>
                              <p>
                                <span className="font-semibold">{t('orders.quantity')}:</span> {task.quantity}
                              </p>
                              <p>
                                <span className="font-semibold">{t('orders.created_at')}:</span>{' '}
                                {formatDate(task.createdAt, language, 'Europe/Athens')}
                              </p>
                              <p>
                                <span className="font-semibold">{t('orders.updated_at')}:</span>{' '}
                                {formatDate(task.updatedAt, language, 'Europe/Athens')}
                              </p>
                            </div>
                            <div className="mt-4">
                              <div className="w-full bg-gray-200 rounded-full h-3">
                                <div
                                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                                  style={{ width: `${progress}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                          <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                            {task.status !== 'completed' && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleUpdateTaskStatus(task.itemId, task.orderId, getNextStatus(task.status))}
                                disabled={state.submitting === task.itemId || !state.socketConnected}
                                className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-5 py-2.5 text-sm shadow-md transition-all disabled:opacity-50"
                                aria-label={t('orders.update_status')}
                              >
                                {state.submitting === task.itemId ? (
                                  <LoadingSpinner className="w-5 h-5" />
                                ) : (
                                  <>
                                    <CheckCircle className={`w-5 h-5 ${isRtl ? 'ml-2' : 'mr-2'}`} />
                                    {t(`orders.item_${getNextStatus(task.status)}`)}
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </AnimatePresence>
          {state.totalPages > 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="flex justify-center items-center gap-4 mt-8"
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={() => dispatch({ type: 'SET_PAGE', payload: state.page - 1 })}
                disabled={state.page === 1}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg px-5 py-2.5 text-sm shadow-sm transition-all disabled:opacity-50"
                aria-label={t('orders.previous')}
              >
                {t('orders.previous')}
              </Button>
              <span className="text-gray-700 text-sm font-semibold">
                {t('orders.page', { current: state.page, total: state.totalPages })}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => dispatch({ type: 'SET_PAGE', payload: state.page + 1 })}
                disabled={state.page === state.totalPages}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg px-5 py-2.5 text-sm shadow-sm transition-all disabled:opacity-50"
                aria-label={t('orders.next')}
              >
                {t('orders.next')}
              </Button>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}

export default ChefTasks;