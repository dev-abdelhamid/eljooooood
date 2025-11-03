import React, { useReducer, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useOrderNotifications } from '../hooks/useOrderNotifications';
import { productionAssignmentsAPI, chefsAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { ProductSearchInput, ProductDropdown } from './OrdersTablePage'; // تأكد من المسار
import { CheckCircle, Clock, Package, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { formatDate } from '../utils/formatDate';
import Pagination from '../components/Shared/Pagination';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';

interface ChefTask {
  itemId: string;
  orderId: string;
  orderNumber: string;
  productName: string;
  quantity: number;
  status: 'pending' | 'in_progress' | 'completed';
  progress: number;
  branchName: string;
  priority: string;
  updatedAt: string;
}

interface State {
  tasks: ChefTask[];
  chefId: string | null;
  loading: boolean;
  error: string;
  submitting: Set<string>;
  filterStatus: string;
  searchQuery: string;
  currentPage: number;
  totalPages: number;
}

type Action =
  | { type: 'SET_TASKS'; payload: ChefTask[] }
  | { type: 'SET_CHEF_ID'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'ADD_SUBMITTING'; payload: string }
  | { type: 'REMOVE_SUBMITTING'; payload: string }
  | { type: 'SET_FILTER_STATUS'; payload: string }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'UPDATE_TASK'; payload: { itemId: string; status: string; updatedAt: string } }
  | { type: 'ADD_TASK'; payload: ChefTask };

const initialState: State = {
  tasks: [],
  chefId: null,
  loading: true,
  error: '',
  submitting: new Set(),
  filterStatus: 'all',
  searchQuery: '',
  currentPage: 1,
  totalPages: 1,
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_TASKS':
      return { ...state, tasks: action.payload, loading: false, error: '' };
    case 'SET_CHEF_ID':
      return { ...state, chefId: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'ADD_SUBMITTING':
      return { ...state, submitting: new Set(state.submitting).add(action.payload) };
    case 'REMOVE_SUBMITTING':
      const newSet = new Set(state.submitting);
      newSet.delete(action.payload);
      return { ...state, submitting: newSet };
    case 'SET_FILTER_STATUS':
      return { ...state, filterStatus: action.payload, currentPage: 1 };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload, currentPage: 1 };
    case 'SET_PAGE':
      return { ...state, currentPage: action.payload };
    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(t =>
          t.itemId === action.payload.itemId
            ? {
                ...t,
                status: action.payload.status as any,
                progress: action.payload.status === 'completed' ? 100 : action.payload.status === 'in_progress' ? 65 : 30,
                updatedAt: action.payload.updatedAt,
              }
            : t
        ),
      };
    case 'ADD_TASK':
      return {
        ...state,
        tasks: [action.payload, ...state.tasks.filter(t => t.itemId !== action.payload.itemId)],
      };
    default:
      return state;
  }
};

const getStatusConfig = (status: string) => {
  const map = {
    pending: { color: 'bg-amber-100 text-amber-800', icon: Clock, label: 'item_pending' },
    in_progress: { color: 'bg-blue-100 text-blue-800', icon: Package, label: 'item_in_progress' },
    completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'item_completed' },
  };
  return map[status as keyof typeof map] || map.pending;
};

const TASKS_PER_PAGE = 12;

export function ChefTasks() {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useOrderNotifications(dispatch, stateRef, user);

  // جلب معرف الشيف
  const fetchChefId = useCallback(async () => {
    if (!user?.id) return navigate('/login');
    try {
      const chef = await chefsAPI.getByUserId(user.id);
      dispatch({ type: 'SET_CHEF_ID', payload: chef._id });
    } catch {
      toast.error(t('errors.unauthorized'));
      navigate('/');
    }
  }, [user, navigate, t]);

  // جلب المهام
  const fetchTasks = useCallback(async () => {
    if (!state.chefId) return;
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const res = await productionAssignmentsAPI.getChefTasks(state.chefId, { limit: 200 });
      const tasks: ChefTask[] = res.map((t: any) => ({
        itemId: t._id,
        orderId: t.order._id,
        orderNumber: t.order.orderNumber,
        productName: isRtl ? t.product.name : (t.product.nameEn || t.product.name),
        quantity: t.quantity,
        status: t.status,
        progress: 0,
        branchName: isRtl ? t.order.branch.name : (t.order.branch.nameEn || t.order.branch.name),
        priority: t.order.priority || 'medium',
        updatedAt: t.updatedAt,
      }));
      dispatch({ type: 'SET_TASKS', payload: tasks });
    } catch {
      dispatch({ type: 'SET_ERROR', payload: t('errors.task_fetch_failed') });
    }
  }, [state.chefId, isRtl, t]);

  // تحديث الحالة
  const completeTask = useCallback(async (task: ChefTask) => {
    if (state.submitting.has(task.itemId)) return;
    dispatch({ type: 'ADD_SUBMITTING', payload: task.itemId });

    const nextStatus = task.status === 'pending' ? 'in_progress' : 'completed';

    try {
      await productionAssignmentsAPI.updateTaskStatus(task.orderId, task.itemId, { status: nextStatus });
      
      dispatch({
        type: 'UPDATE_TASK',
        payload: { itemId: task.itemId, status: nextStatus, updatedAt: new Date().toISOString() },
      });

      socket?.emit('itemStatusUpdated', {
        orderId: task.orderId,
        itemId: task.itemId,
        status: nextStatus,
        chefId: state.chefId,
      });

      toast.success(t('orders.task_updated'), { position: isRtl ? 'top-left' : 'top-right' });
    } catch {
      toast.error(t('errors.task_update_failed'));
    } finally {
      dispatch({ type: 'REMOVE_SUBMITTING', payload: task.itemId });
    }
  }, [state.submitting, state.chefId, socket, isRtl, t]);

  // السوكت
  useEffect(() => {
    if (!socket || !state.chefId) return;

    const handleNewTask = (data: any) => {
      if (data.assignedTo?._id !== state.chefId) return;
      const task: ChefTask = {
        itemId: data._id,
        orderId: data.order._id,
        orderNumber: data.order.orderNumber,
        productName: isRtl ? data.product.name : data.product.nameEn,
        quantity: data.quantity,
        status: 'pending',
        progress: 30,
        branchName: isRtl ? data.order.branch.name : data.order.branch.nameEn,
        priority: data.order.priority,
        updatedAt: data.updatedAt,
      };
      dispatch({ type: 'ADD_TASK', payload: task });
      toast.info(`مهمة جديدة: ${task.productName}`, { position: isRtl ? 'top-left' : 'top-right' });
    };

    const handleStatusUpdate = (data: any) => {
      if (data.chefId !== state.chefId) return;
      dispatch({
        type: 'UPDATE_TASK',
        payload: { itemId: data.itemId, status: data.status, updatedAt: data.updatedAt },
      });
    };

    socket.on('taskAssigned', handleNewTask);
    socket.on('itemStatusUpdated', handleStatusUpdate);

    return () => {
      socket.off('taskAssigned', handleNewTask);
      socket.off('itemStatusUpdated', handleStatusUpdate);
    };
  }, [socket, state.chefId, isRtl]);

  useEffect(() => { fetchChefId(); }, [fetchChefId]);
  useEffect(() => { if (state.chefId) fetchTasks(); }, [state.chefId, fetchTasks]);

  // الفلترة والتقسيم
  const filteredTasks = useMemo(() => {
    return state.tasks
      .filter(t => state.filterStatus === 'all' || t.status === state.filterStatus)
      .filter(t =>
        t.orderNumber.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
        t.productName.toLowerCase().includes(state.searchQuery.toLowerCase())
      );
  }, [state.tasks, state.filterStatus, state.searchQuery]);

  const paginatedTasks = useMemo(() => {
    const start = (state.currentPage - 1) * TASKS_PER_PAGE;
    return filteredTasks.slice(start, start + TASKS_PER_PAGE);
  }, [filteredTasks, state.currentPage]);

  const totalPages = Math.ceil(filteredTasks.length / TASKS_PER_PAGE);

  if (state.loading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{state.error}</p>
          <Button onClick={() => { fetchChefId(); fetchTasks(); }}>
            {t('orders.retry')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* العنوان */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Package className="w-8 h-8 text-blue-600" />
              {t('orders.chef_tasks')}
            </h1>
            <div className="text-sm text-gray-600 bg-white px-4 py-2 rounded-full shadow">
              {filteredTasks.length} {t('orders.tasks')}
            </div>
          </div>

          {/* البحث والفلتر */}
          <Card className="p-5 mb-6 shadow-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ProductSearchInput
                value={state.searchQuery}
                onChange={(e) => dispatch({ type: 'SET_SEARCH_QUERY', payload: e.target.value })}
                placeholder={t('orders.search_placeholder')}
              />
              <ProductDropdown
                options={[
                  { value: 'all', label: t('orders.all_statuses') },
                  { value: 'pending', label: t('orders.item_pending') },
                  { value: 'in_progress', label: t('orders.item_in_progress') },
                  { value: 'completed', label: t('orders.item_completed') },
                ]}
                value={state.filterStatus}
                onChange={(v) => dispatch({ type: 'SET_FILTER_STATUS', payload: v })}
              />
            </div>
          </Card>

          {/* تنبيه السوكت */}
          {!isConnected && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <p className="text-yellow-700">{t('errors.socket_disconnected')}</p>
            </motion.div>
          )}

          {/* المهام */}
          <AnimatePresence>
            {paginatedTasks.length === 0 ? (
              <Card className="p-16 text-center">
                <Package className="w-20 h-20 text-gray-400 mx-auto mb-4" />
                <p className="text-xl text-gray-500">{t('orders.no_tasks')}</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {paginatedTasks.map((task) => {
                  const { color, icon: Icon, label } = getStatusConfig(task.status);
                  return (
                    <motion.div
                      key={task.itemId}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      whileHover={{ y: -4 }}
                      className="group"
                    >
                      <Card className="h-full p-5 bg-white border border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all">
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="font-bold text-lg text-gray-900 line-clamp-2">
                            {task.productName}
                          </h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${color} flex items-center gap-1`}>
                            <Icon className="w-4 h-4" />
                            {t(`orders.${label}`)}
                          </span>
                        </div>

                        <div className="space-y-2 text-sm text-gray-600 mb-4">
                          <p><strong>{t('orders.order_number')}:</strong> #{task.orderNumber}</p>
                          <p><strong>{t('orders.quantity')}:</strong> {task.quantity}</p>
                          <p><strong>{t('orders.branch')}:</strong> {task.branchName}</p>
                        </div>

                        <div className="mb-4">
                          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                            <motion.div
                              className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                              initial={{ width: 0 }}
                              animate={{ width: `${task.progress}%` }}
                              transition={{ duration: 0.6, ease: "easeOut" }}
                            />
                          </div>
                        </div>

                        {task.status !== 'completed' && (
                          <Button
                            onClick={() => completeTask(task)}
                            disabled={state.submitting.has(task.itemId)}
                            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
                          >
                            {state.submitting.has(task.itemId) ? (
                              <LoadingSpinner className="w-5 h-5" />
                            ) : (
                              <>
                                <CheckCircle className="w-5 h-5" />
                                {task.status === 'pending' ? t('orders.start_production') : t('orders.complete')}
                              </>
                            )}
                          </Button>
                        )}
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </AnimatePresence>

          {/* التنقل بين الصفحات */}
          {totalPages > 1 && (
            <div className="mt-10">
              <Pagination
                currentPage={state.currentPage}
                totalPages={totalPages}
                isRtl={isRtl}
                handlePageChange={(page) => dispatch({ type: 'SET_PAGE', payload: page })}
              />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default ChefTasks;