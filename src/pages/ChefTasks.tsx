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
import { AlertCircle, CheckCircle, Clock, Package, Search, ChevronLeft, ChevronRight } from 'lucide-react';
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
  createdAt: string;
  updatedAt: string;
  progress: number;
  branchName: string;
  priority: string;
}

interface State {
  tasks: ChefTask[];
  chefId: string | null;
  loading: boolean;
  error: string;
  submitting: Set<string>; // دعم عدة مهام في نفس الوقت
  socketConnected: boolean;
  filter: { status: string; search: string };
  currentIndex: number; // بطاقة واحدة في الصف
}

type Action =
  | { type: 'SET_TASKS'; payload: ChefTask[] }
  | { type: 'SET_CHEF_ID'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'ADD_SUBMITTING'; payload: string }
  | { type: 'REMOVE_SUBMITTING'; payload: string }
  | { type: 'SET_SOCKET_CONNECTED'; payload: boolean }
  | { type: 'SET_FILTER'; payload: { status: string; search: string } }
  | { type: 'SET_INDEX'; payload: number }
  | { type: 'UPDATE_TASK'; payload: { itemId: string; status: string; updatedAt: string } }
  | { type: 'ADD_TASK'; payload: ChefTask };

const initialState: State = {
  tasks: [],
  chefId: null,
  loading: true,
  error: '',
  submitting: new Set(),
  socketConnected: false,
  filter: { status: 'all', search: '' },
  currentIndex: 0,
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
    case 'SET_SOCKET_CONNECTED':
      return { ...state, socketConnected: action.payload };
    case 'SET_FILTER':
      return { ...state, filter: action.payload, currentIndex: 0 };
    case 'SET_INDEX':
      return { ...state, currentIndex: action.payload };
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

const getStatusInfo = (status: string, t: any) => {
  const map = {
    pending: { color: 'bg-amber-100 text-amber-800', icon: Clock, label: t('orders.item_pending') },
    in_progress: { color: 'bg-blue-100 text-blue-800', icon: Package, label: t('orders.item_in_progress') },
    completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: t('orders.item_completed') },
  };
  return map[status as keyof typeof map] || map.pending;
};

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

  const fetchChefId = useCallback(async () => {
    const userId = user?.id || user?._id;
    if (!userId) return navigate('/login');
    if (user?.role !== 'chef') return navigate('/');
    try {
      const chef = await chefsAPI.getByUserId(userId);
      dispatch({ type: 'SET_CHEF_ID', payload: chef._id });
    } catch {
      dispatch({ type: 'SET_ERROR', payload: t('errors.unauthorized') });
    }
  }, [user, navigate, t]);

  const fetchTasks = useCallback(async () => {
    if (!state.chefId) return;
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const res = await productionAssignmentsAPI.getChefTasks(state.chefId, { limit: 200 });
      const tasks: ChefTask[] = res.map((t: any) => ({
        itemId: t._id,
        orderId: t.order._id,
        orderNumber: t.order.orderNumber,
        productName: language === 'ar' ? t.product.name : (t.product.nameEn || t.product.name),
        quantity: t.quantity,
        status: t.status || 'pending',
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        progress: t.status === 'completed' ? 100 : t.status === 'in_progress' ? 70 : 30,
        branchName: language === 'ar' ? t.order.branch.name : (t.order.branch.nameEn || t.order.branch.name),
        priority: t.order.priority || 'medium',
      }));
      dispatch({ type: 'SET_TASKS', payload: tasks });
    } catch {
      dispatch({ type: 'SET_ERROR', payload: t('errors.task_fetch_failed') });
    }
  }, [state.chefId, language, t]);

  const updateTask = async (task: ChefTask) => {
    if (state.submitting.has(task.itemId)) return;
    dispatch({ type: 'ADD_SUBMITTING', payload: task.itemId });

    const next = task.status === 'pending' ? 'in_progress' : 'completed';

    try {
      await productionAssignmentsAPI.updateTaskStatus(task.orderId, task.itemId, { status: next });
      dispatch({ type: 'UPDATE_TASK', payload: { itemId: task.itemId, status: next, updatedAt: new Date().toISOString() } });

      socket?.emit('itemStatusUpdated', {
        orderId: task.orderId,
        itemId: task.itemId,
        status: next,
        chefId: state.chefId,
      });

      toast.success(t('orders.task_updated'), { position: isRtl ? 'top-left' : 'top-right' });
    } catch {
      toast.error(t('errors.task_update_failed'));
    } finally {
      dispatch({ type: 'REMOVE_SUBMITTING', payload: task.itemId });
    }
  };

  useEffect(() => { fetchChefId(); }, [fetchChefId]);
  useEffect(() => { if (state.chefId) fetchTasks(); }, [state.chefId, fetchTasks]);
  useEffect(() => { dispatch({ type: 'SET_SOCKET_CONNECTED', payload: isConnected }); }, [isConnected]);

  // فلترة المهام
  const filteredTasks = useMemo(() => {
    return state.tasks
      .filter(t => state.filter.status === 'all' || t.status === state.filter.status)
      .filter(t =>
        t.orderNumber.toLowerCase().includes(state.filter.search.toLowerCase()) ||
        t.productName.toLowerCase().includes(state.filter.search.toLowerCase()) ||
        t.branchName.toLowerCase().includes(state.filter.search.toLowerCase())
      );
  }, [state.tasks, state.filter]);

  const currentTask = filteredTasks[state.currentIndex];
  const hasNext = state.currentIndex < filteredTasks.length - 1;
  const hasPrev = state.currentIndex > 0;

  if (state.loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6 flex items-center justify-center">
        <Card className="max-w-3xl w-full p-12 animate-pulse">
          <div className="space-y-6">
            <div className="h-10 bg-gray-300 rounded-2xl"></div>
            <div className="grid grid-cols-2 gap-6">
              <div className="h-32 bg-gray-200 rounded-2xl"></div>
              <div className="h-32 bg-gray-200 rounded-2xl"></div>
            </div>
            <div className="h-16 bg-gray-300 rounded-full"></div>
          </div>
        </Card>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-6">
        <Card className="max-w-md p-10 text-center shadow-2xl">
          <AlertCircle className="w-20 h-20 text-red-500 mx-auto mb-6" />
          <p className="text-2xl font-bold text-red-700 mb-4">{state.error}</p>
          <Button onClick={() => { fetchChefId(); fetchTasks(); }} className="bg-red-600 hover:bg-red-700">
            {t('orders.retry')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 ${isRtl ? 'font-arabic' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

          {/* العنوان */}
          <div className="text-center mb-10">
            <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-700 flex items-center justify-center gap-4">
              <Package className="w-14 h-14" />
              {t('orders.chef_tasks')}
            </h1>
            <p className="text-xl text-gray-600 mt-3">
              {filteredTasks.length} {t('orders.tasks_available')} • {t('orders.page', { current: state.currentIndex + 1, total: filteredTasks.length || 1 })}
            </p>
          </div>

          {/* البحث والفلتر */}
          <Card className="mb-8 shadow-2xl bg-white/95 backdrop-blur-lg border-0">
            <div className="p-6">
              <div className="relative mb-6">
                <Search className={`absolute top-4 ${isRtl ? 'right-4' : 'left-4'} w-6 h-6 text-gray-500`} />
                <Input
                  type="text"
                  value={state.filter.search}
                  onChange={e => dispatch({ type: 'SET_FILTER', payload: { ...state.filter, search: e.target.value } })}
                  placeholder={t('orders.search_placeholder')}
                  className="w-full pl-14 pr-6 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {['all', 'pending', 'in_progress', 'completed'].map(status => (
                  <button
                    key={status}
                    onClick={() => dispatch({ type: 'SET_FILTER', payload: { ...state.filter, status } })}
                    className={`px-6 py-3 rounded-full font-bold text-lg transition-all transform hover:scale-105 ${
                      state.filter.status === status
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-xl'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {status === 'all' ? t('orders.all') : t(`orders.item_${status}`)}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* تنبيه السوكت */}
          {!state.socketConnected && (
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="mb-6 p-5 bg-yellow-100 border-2 border-yellow-400 rounded-2xl flex items-center gap-4 shadow-lg"
            >
              <AlertCircle className="w-8 h-8 text-yellow-700" />
              <p className="text-lg font-bold text-yellow-800">{t('errors.socket_disconnected')}</p>
            </motion.div>
          )}

          {/* البطاقة الواحدة */}
          <div className="grid grid-cols-1">
            <AnimatePresence mode="wait">
              {currentTask ? (
                <motion.div
                  key={currentTask.itemId}
                  initial={{ opacity: 0, scale: 0.95, y: 50 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -50 }}
                  transition={{ duration: 0.4, type: "spring" }}
                >
                  <Card className="overflow-hidden shadow-3xl hover:shadow-4xl transition-all duration-500 bg-gradient-to-br from-white to-blue-50 border-0">
                    <div className="p-10">
                      <div className="flex justify-between items-start mb-8">
                        <div>
                          <h2 className="text-4xl font-extrabold text-gray-900 mb-2">{currentTask.productName}</h2>
                          <p className="text-2xl text-gray-600">
                            {t('orders.order')}: <span className="font-bold text-blue-600">#{currentTask.orderNumber}</span>
                          </p>
                        </div>
                        <span className={`px-6 py-3 rounded-full text-2xl font-bold flex items-center gap-3 ${getStatusInfo(currentTask.status, t).color}`}>
                          {getStatusInfo(currentTask.status, t).label}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-3xl">
                          <p className="text-blue-700 font-bold text-lg">{t('orders.quantity')}</p>
                          <p className="text-5xl font-extrabold text-blue-900">{currentTask.quantity}</p>
                        </div>
                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-3xl">
                          <p className="text-purple-700 font-bold text-lg">{t('orders.branch')}</p>
                          <p className="text-2xl font-extrabold text-purple-900">{currentTask.branchName}</p>
                        </div>
                        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-3xl">
                          <p className="text-orange-700 font-bold text-lg">{t('orders.priority')}</p>
                          <p className="text-2xl font-extrabold text-orange-900">{t(`orders.priority_${currentTask.priority}`)}</p>
                        </div>
                      </div>

                      <div className="mb-10">
                        <div className="flex justify-between text-lg mb-3">
                          <span className="font-bold text-gray-700">{t('orders.progress')}</span>
                          <span className="font-bold text-blue-600">{currentTask.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden shadow-inner">
                          <motion.div
                            className="h-full bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-700"
                            initial={{ width: 0 }}
                            animate={{ width: `${currentTask.progress}%` }}
                            transition={{ duration: 1.2, ease: "easeOut" }}
                          />
                        </div>
                      </div>

                      {currentTask.status !== 'completed' && (
                        <Button
                          onClick={() => updateTask(currentTask)}
                          disabled={state.submitting.has(currentTask.itemId)}
                          className="w-full bg-gradient-to-r from-blue-600 to-indigo-800 hover:from-blue-700 hover:to-indigo-900 text-white font-extrabold text-3xl py-8 rounded-3xl shadow-2xl transform hover:scale-105 transition-all duration-300 flex items-center justify-center gap-4"
                        >
                          {state.submitting.has(currentTask.itemId) ? (
                            <LoadingSpinner className="w-12 h-12" />
                          ) : (
                            <>
                              <CheckCircle className="w-12 h-12" />
                              {currentTask.status === 'pending' ? t('orders.start_now') : t('orders.mark_as_done')}
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </Card>
                </motion.div>
              ) : (
                <Card className="p-20 text-center shadow-2xl">
                  <Package className="w-32 h-32 text-gray-400 mx-auto mb-8" />
                  <p className="text-3xl font-bold text-gray-500">{t('orders.no_tasks_found')}</p>
                </Card>
              )}
            </AnimatePresence>
          </div>

          {/* التنقل */}
          {filteredTasks.length > 1 && (
            <div className="flex justify-center items-center gap-8 mt-12">
              <Button
                onClick={() => dispatch({ type: 'SET_INDEX', payload: state.currentIndex - 1 })}
                disabled={!hasPrev}
                className="bg-white hover:bg-gray-100 p-6 rounded-full shadow-2xl disabled:opacity-50"
              >
                <ChevronLeft className={`w-10 h-10 ${isRtl ? 'rotate-180' : ''}`} />
              </Button>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-800">
                  {state.currentIndex + 1} / {filteredTasks.length}
                </p>
                <p className="text-lg text-gray-600">{t('orders.of_total_tasks')}</p>
              </div>
              <Button
                onClick={() => dispatch({ type: 'SET_INDEX', payload: state.currentIndex + 1 })}
                disabled={!hasNext}
                className="bg-white hover:bg-gray-100 p-6 rounded-full shadow-2xl disabled:opacity-50"
              >
                <ChevronRight className={`w-10 h-10 ${isRtl ? 'rotate-180' : ''}`} />
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default ChefTasks;