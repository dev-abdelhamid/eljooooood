import React, { useReducer, useEffect, useMemo, useCallback, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useOrderNotifications } from '../hooks/useOrderNotifications';
import { productionAssignmentsAPI, chefsAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { CheckCircle, Clock, Package, AlertCircle, Timer } from 'lucide-react';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { formatDate } from '../utils/formatDate';

interface ChefTask {
  itemId: string;
  orderId: string;
  orderNumber: string;
  productName: string;
  quantity: number;
  status: 'pending' | 'in_progress' | 'completed';
  startedAt?: string;
  completedAt?: string;
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
  | { type: 'UPDATE_TASK'; payload: { itemId: string; status: string; startedAt?: string; completedAt?: string } }
  | { type: 'ADD_TASK'; payload: ChefTask };

const initialState: State = {
  tasks: [],
  chefId: null,
  loading: true,
  error: '',
  submitting: new Set(),
  filterStatus: 'all',
  searchQuery: '',
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_TASKS':
      return { ...state, tasks: action.payload, loading: false };
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
      return { ...state, filterStatus: action.payload };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };
    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(t =>
          t.itemId === action.payload.itemId
            ? {
                ...t,
                status: action.payload.status as any,
                startedAt: action.payload.startedAt || t.startedAt,
                completedAt: action.payload.completedAt || t.completedAt,
                updatedAt: new Date().toISOString(),
              }
            : t
        ),
      };
    case 'ADD_TASK':
      return { ...state, tasks: [action.payload, ...state.tasks] };
    default:
      return state;
  }
};

// تايمر حقيقي 100%
const useProductionTimer = (startedAt?: string) => {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!startedAt) return setSeconds(0);
    const start = new Date(startedAt).getTime();
    const interval = setInterval(() => {
      setSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
};

const getStatusConfig = (status: string, t: any) => {
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

  useOrderNotifications(dispatch, null, user);

  const fetchChefId = useCallback(async () => {
    if (!user?.id) return;
    try {
      const chef = await chefsAPI.getByUserId(user.id);
      dispatch({ type: 'SET_CHEF_ID', payload: chef._id });
    } catch {
      dispatch({ type: 'SET_ERROR', payload: t('errors.unauthorized') });
    }
  }, [user, t]);

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
        status: t.status || 'pending',
        startedAt: t.startedAt,
        completedAt: t.completedAt,
        branchName: isRtl ? t.order.branch.name : (t.order.branch.nameEn || t.order.branch.name),
        priority: t.order.priority || 'medium',
        updatedAt: t.updatedAt,
      }));
      dispatch({ type: 'SET_TASKS', payload: tasks });
    } catch {
      dispatch({ type: 'SET_ERROR', payload: t('errors.task_fetch_failed') });
    }
  }, [state.chefId, isRtl, t]);

  const updateTask = async (task: ChefTask) => {
    if (state.submitting.has(task.itemId)) return;
    dispatch({ type: 'ADD_SUBMITTING', payload: task.itemId });

    const next = task.status === 'pending' ? 'in_progress' : 'completed';
    const now = new Date().toISOString();

    try {
      await productionAssignmentsAPI.updateTaskStatus(task.orderId, task.itemId, {
        status: next,
        startedAt: next === 'in_progress' ? now : task.startedAt,
        completedAt: next === 'completed' ? now : task.completedAt,
      });

      dispatch({
        type: 'UPDATE_TASK',
        payload: {
          itemId: task.itemId,
          status: next,
          startedAt: next === 'in_progress' ? now : task.startedAt,
          completedAt: next === 'completed' ? now : task.completedAt,
        },
      });

      socket?.emit('itemStatusUpdated', { itemId: task.itemId, status: next });
      toast.success(t('orders.task_updated'), { position: isRtl ? 'top-left' : 'top-right' });
    } catch {
      toast.error(t('errors.task_update_failed'));
    } finally {
      dispatch({ type: 'REMOVE_SUBMITTING', payload: task.itemId });
    }
  };

  useEffect(() => { fetchChefId(); }, [fetchChefId]);
  useEffect(() => { if (state.chefId) fetchTasks(); }, [state.chefId, fetchTasks]);

  const filteredTasks = useMemo(() => {
    return state.tasks
      .filter(t => state.filterStatus === 'all' || t.status === state.filterStatus)
      .filter(t =>
        t.orderNumber.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
        t.productName.toLowerCase().includes(state.searchQuery.toLowerCase())
      );
  }, [state.tasks, state.filterStatus, state.searchQuery]);

  const SkeletonCard = () => (
    <Card className="p-8 bg-white/80 backdrop-blur animate-pulse shadow-2xl rounded-2xl border-0">
      <div className="space-y-6">
        <div className="h-10 bg-gray-200 rounded-2xl"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-20 bg-gray-200 rounded-2xl"></div>
          <div className="h-20 bg-gray-200 rounded-2xl"></div>
        </div>
        <div className="h-16 bg-gray-300 rounded-full"></div>
      </div>
    </Card>
  );

  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 ${isRtl ? 'font-arabic' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">

        {/* الفلتر ثابت فوق */}
        <Card className="mb-8 shadow-2xl bg-white/95 backdrop-blur-lg border-0 sticky top-4 z-50">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                type="text"
                value={state.searchQuery}
                onChange={e => dispatch({ type: 'SET_SEARCH_QUERY', payload: e.target.value })}
                placeholder={t('orders.search_placeholder')}
                className="w-full px-6 py-4 text-lg rounded-2xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none"
              />
              <div className="flex gap-3 flex-wrap justify-center md:justify-end">
                {['all', 'pending', 'in_progress', 'completed'].map(s => (
                  <button
                    key={s}
                    onClick={() => dispatch({ type: 'SET_FILTER_STATUS', payload: s })}
                    className={`px-6 py-3 rounded-full font-bold text-lg transition-all transform hover:scale-105 shadow-md ${
                      state.filterStatus === s
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {t(`orders.${s === 'all' ? 'all_statuses' : `item_${s}`}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* السكيلتون تحت */}
        {state.loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(12)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* المهام – 10 في الصفحة */}
        <AnimatePresence mode="wait">
          {!state.loading && filteredTasks.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="p-20 text-center shadow-2xl bg-white/90">
                <Package className="w-32 h-32 text-gray-400 mx-auto mb-8" />
                <p className="text-3xl font-bold text-gray-500">{t('orders.no_tasks_found')}</p>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              layout
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
              {filteredTasks.map(task => {
                const timer = useProductionTimer(task.startedAt);
                const { color, icon: Icon, label } = getStatusConfig(task.status, t);

                return (
                  <motion.div
                    key={task.itemId}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                    className="h-full"
                  >
                    <Card className="h-full overflow-hidden shadow-2xl hover:shadow-3xl transition-all duration-500 bg-gradient-to-br from-white to-blue-50 border-0 flex flex-col">
                      <div className="p-6 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="text-xl font-bold text-gray-900 line-clamp-2">{task.productName}</h3>
                          <span className={`px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 ${color}`}>
                            <Icon className="w-5 h-5" />
                            {t(`orders.${label}`)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                          <div className="bg-blue-50 p-3 rounded-xl">
                            <p className="text-blue-600 font-medium text-xs">{t('orders.order_number')}</p>
                            <p className="font-bold text-blue-900">#{task.orderNumber}</p>
                          </div>
                          <div className="bg-green-50 p-3 rounded-xl">
                            <p className="text-green-600 font-medium text-xs">{t('orders.quantity')}</p>
                            <p className="font-bold text-green-900">{task.quantity}</p>
                          </div>
                        </div>

                        {task.startedAt && (
                          <div className="mb-4 p-3 bg-orange-50 border-2 border-orange-300 rounded-2xl flex items-center gap-3">
                            <Timer className="w-7 h-7 text-orange-700" />
                            <div>
                              <p className="text-orange-700 font-bold text-lg">{timer}</p>
                              {task.completedAt && (
                                <p className="text-xs text-orange-600">
                                  {t('orders.completed_at')}: {formatDate(task.completedAt, language, 'short')}
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="mt-auto">
                          {task.status !== 'completed' && (
                            <Button
                              onClick={() => updateTask(task)}
                              disabled={state.submitting.has(task.itemId)}
                              className="w-full bg-gradient-to-r from-blue-600 to-indigo-800 hover:from-blue-700 hover:to-indigo-900 text-white font-bold text-lg py-4 rounded-2xl shadow-xl transform hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2"
                            >
                              {state.submitting.has(task.itemId) ? (
                                <LoadingSpinner className="w-6 h-6" />
                              ) : (
                                <>
                                  <CheckCircle className="w-6 h-6" />
                                  {task.status === 'pending' ? t('orders.start_now') : t('orders.complete')}
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* تنبيه السوكت */}
        {!isConnected && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-96 p-5 bg-yellow-100 border-2 border-yellow-400 rounded-2xl shadow-2xl flex items-center gap-4 z-50"
          >
            <AlertCircle className="w-10 h-10 text-yellow-700 flex-shrink-0" />
            <p className="text-lg font-bold text-yellow-800">{t('errors.socket_disconnected')}</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default ChefTasks;