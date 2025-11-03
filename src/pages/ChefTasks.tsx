import React, { useReducer, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useOrderNotifications } from '../hooks/useOrderNotifications';
import { productionAssignmentsAPI, chefsAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { CheckCircle, Clock, Package, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { formatDate } from '../utils/formatDate';
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
                progress: action.payload.status === 'completed' ? 100 : action.payload.status === 'in_progress' ? 70 : 30,
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

export function ChefTasks() {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useOrderNotifications(dispatch, stateRef, user);

  // جلب الشيف
  const fetchChefId = useCallback(async () => {
    if (!user?.id) return;
    try {
      const chef = await chefsAPI.getByUserId(user.id);
      dispatch({ type: 'SET_CHEF_ID', payload: chef._id });
    } catch {
      dispatch({ type: 'SET_ERROR', payload: t('errors.unauthorized') });
    }
  }, [user, t]);

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

  // إكمال مهمة (يدعم عدة مهام في نفس الوقت)
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

  // إكمال كل المهام المختارة
  const completeAllPending = async () => {
    const pending = state.tasks.filter(t => t.status !== 'completed');
    if (pending.length === 0) return;

    toast.info(`جاري إكمال ${pending.length} مهمة...`, { autoClose: false });

    const promises = pending.map(task => completeTask(task));
    await Promise.allSettled(promises);

    toast.dismiss();
    toast.success(`تم إكمال ${pending.length} مهمة بنجاح!`);
  };

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
      toast.info(`مهمة جديدة: ${task.productName}`);
    };

    socket.on('taskAssigned', handleNewTask);
    socket.on('itemStatusUpdated', (data: any) => {
      if (data.chefId !== state.chefId) return;
      dispatch({
        type: 'UPDATE_TASK',
        payload: { itemId: data.itemId, status: data.status, updatedAt: data.updatedAt },
      });
    });

    return () => {
      socket.off('taskAssigned', handleNewTask);
      socket.off('itemStatusUpdated');
    };
  }, [socket, state.chefId, isRtl]);

  useEffect(() => { fetchChefId(); }, [fetchChefId]);
  useEffect(() => { if (state.chefId) fetchTasks(); }, [state.chefId, fetchTasks]);

  // الفلترة
  const filteredTasks = useMemo(() => {
    return state.tasks
      .filter(t => state.filterStatus === 'all' || t.status === state.filterStatus)
      .filter(t =>
        t.orderNumber.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
        t.productName.toLowerCase().includes(state.searchQuery.toLowerCase())
      );
  }, [state.tasks, state.filterStatus, state.searchQuery]);

  const currentTask = filteredTasks[state.currentPage - 1];

  if (state.loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <Card className="max-w-2xl mx-auto p-10 animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-6"></div>
          <div className="space-y-4">
            <div className="h-6 bg-gray-200 rounded"></div>
            <div className="h-6 bg-gray-200 rounded w-3/4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </Card>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <Card className="max-w-md p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-xl text-red-600 mb-4">{state.error}</p>
          <Button onClick={() => { fetchChefId(); fetchTasks(); }}>
            {t('orders.retry')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          
          {/* العنوان */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 flex items-center justify-center gap-3">
              <Package className="w-10 h-10 text-blue-600" />
              {t('orders.chef_tasks')}
            </h1>
            <p className="text-lg text-gray-600 mt-2">
              {filteredTasks.length} {t('orders.tasks')} • {t('orders.page', { current: state.currentPage, total: filteredTasks.length || 1 })}
            </p>
          </div>

          {/* البحث والفلتر */}
          <Card className="mb-6 shadow-xl bg-white/90 backdrop-blur">
            <div className="p-5">
              <input
                type="text"
                value={state.searchQuery}
                onChange={e => dispatch({ type: 'SET_SEARCH_QUERY', payload: e.target.value })}
                placeholder={t('orders.search_placeholder')}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-4 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-lg"
              />
              <div className="mt-4 flex gap-3">
                {['all', 'pending', 'in_progress', 'completed'].map(status => (
                  <button
                    key={status}
                    onClick={() => dispatch({ type: 'SET_FILTER_STATUS', payload: status })}
                    className={`px-5 py-2 rounded-full font-medium transition-all ${
                      state.filterStatus === status
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {t(`orders.${status === 'all' ? 'all_statuses' : `item_${status}`}`)}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* تنبيه السوكت */}
          {!isConnected && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-yellow-100 border border-yellow-300 rounded-xl flex items-center gap-3"
            >
              <AlertCircle className="w-6 h-6 text-yellow-700" />
              <p className="text-yellow-800 font-medium">{t('errors.socket_disconnected')}</p>
            </motion.div>
          )}

          {/* البطاقة الواحدة */}
          <AnimatePresence mode="wait">
            {currentTask ? (
              <motion.div
                key={currentTask.itemId}
                initial={{ opacity: 0, scale: 0.95, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -50 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <Card className="overflow-hidden shadow-2xl hover:shadow-3xl transition-all duration-500 bg-gradient-to-br from-white to-blue-50 border-0">
                  <div className="p-8">
                    {/* الحالة */}
                    <div className="flex justify-between items-start mb-6">
                      <h2 className="text-3xl font-bold text-gray-900">
                        {currentTask.productName}
                      </h2>
                      <span className={`px-4 py-2 rounded-full text-lg font-bold flex items-center gap-2 ${getStatusConfig(currentTask.status).color}`}>
                        <getStatusConfig(currentTask.status).icon className="w-6 h-6" />
                        {t(`orders.${getStatusConfig(currentTask.status).label}`)}
                      </span>
                    </div>

                    {/* التفاصيل */}
                    <div className="grid grid-cols-2 gap-6 mb-8 text-lg">
                      <div className="bg-blue-50 p-4 rounded-xl">
                        <p className="text-blue-600 font-medium">{t('orders.order_number')}</p>
                        <p className="text-2xl font-bold text-blue-900">#{currentTask.orderNumber}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-xl">
                        <p className="text-green-600 font-medium">{t('orders.quantity')}</p>
                        <p className="text-2xl font-bold text-green-900">{currentTask.quantity}</p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-xl">
                        <p className="text-purple-600 font-medium">{t('orders.branch')}</p>
                        <p className="text-xl font-bold text-purple-900">{currentTask.branchName}</p>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-xl">
                        <p className="text-orange-600 font-medium">{t('orders.priority')}</p>
                        <p className="text-xl font-bold text-orange-900">{t(`orders.priority_${currentTask.priority}`)}</p>
                      </div>
                    </div>

                    {/* شريط التقدم */}
                    <div className="mb-8">
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>{t('orders.progress')}</span>
                        <span>{currentTask.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-300 rounded-full h-6 overflow-hidden shadow-inner">
                        <motion.div
                          className="h-full bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-700 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${currentTask.progress}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                        />
                      </div>
                    </div>

                    {/* زر الإكمال */}
                    {currentTask.status !== 'completed' && (
                      <div className="flex gap-4">
                        <Button
                          onClick={() => completeTask(currentTask)}
                          disabled={state.submitting.has(currentTask.itemId)}
                          className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold text-xl py-5 rounded-2xl shadow-2xl transform hover:scale-105 transition-all duration-300 flex items-center justify-center gap-3"
                        >
                          {state.submitting.has(currentTask.itemId) ? (
                            <LoadingSpinner className="w-8 h-8" />
                          ) : (
                            <>
                              <CheckCircle className="w-8 h-8" />
                              {currentTask.status === 'pending' ? t('orders.start_production') : t('orders.complete')}
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            ) : (
              <Card className="p-16 text-center">
                <Package className="w-24 h-24 text-gray-400 mx-auto mb-6" />
                <p className="text-2xl text-gray-500">{t('orders.no_tasks')}</p>
              </Card>
            )}
          </AnimatePresence>

          {/* التنقل */}
          {filteredTasks.length > 1 && (
            <div className="flex justify-center gap-6 mt-10">
              <Button
                onClick={() => dispatch({ type: 'SET_PAGE', payload: Math.max(1, state.currentPage - 1) })}
                disabled={state.currentPage === 1}
                className="bg-white hover:bg-gray-100 text-gray-800 px-8 py-4 rounded-full shadow-xl text-xl font-bold"
              >
                {t('orders.previous')}
              </Button>
              <Button
                onClick={() => dispatch({ type: 'SET_PAGE', payload: Math.min(filteredTasks.length, state.currentPage + 1) })}
                disabled={state.currentPage === filteredTasks.length}
                className="bg-white hover:bg-gray-100 text-gray-800 px-8 py-4 rounded-full shadow-xl text-xl font-bold"
              >
                {t('orders.next')}
              </Button>
            </div>
          )}

          {/* زر إكمال الكل */}
          {filteredTasks.some(t => t.status !== 'completed') && (
            <div className="text-center mt-8">
              <Button
                onClick={completeAllPending}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-xl px-12 py-5 rounded-full shadow-2xl"
              >
                إكمال جميع المهام
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default ChefTasks;