import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Chart as ChartJS, ArcElement, LineElement, BarElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend } from 'chart.js';
import { Doughnut, Line, Bar } from 'react-chartjs-2';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { useNotifications } from '../contexts/NotificationContext';
import { productionAssignmentsAPI, chefsAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Select } from '../components/UI/Select';
import { Input } from '../components/UI/Input';
import { AlertCircle, Bell, CheckCircle, Clock, Package, Check, Search, Calendar } from 'lucide-react';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { Modal } from '../components/UI/Modal';
import { motion, AnimatePresence } from 'framer-motion';
import { toast, ToastContainer } from 'react-toastify';
import { debounce } from 'lodash';
import 'react-toastify/dist/ReactToastify.css';
import 'tailwindcss/tailwind.css';

ChartJS.register(ArcElement, LineElement, BarElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend);

interface Notification {
  _id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  data?: {
    orderId?: string;
    itemId?: string;
    taskId?: string;
    chefId?: string;
    eventId: string;
  };
  read: boolean;
  createdAt: string;
  sound?: string;
  vibrate?: number[];
}

interface ChefTask {
  id: string;
  orderId: string;
  orderNumber: string;
  productId: string;
  productName: string;
  quantity: number;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed';
  createdAt: string;
  updatedAt: string;
  progress?: number;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  productType?: string;
  branchName: string;
}

interface ChefProfile {
  _id: string;
  userId: string;
  name: string;
  branchId?: string;
}

interface Stats {
  pending: number;
  inProgress: number;
  completed: number;
  avgCompletionTime: number;
  dailyCompletions: { date: string; count: number }[];
  topProducts: { productName: string; count: number }[];
  productTypes: { type: string; count: number }[];
  performanceScore: number;
}

interface FilterOptions {
  status: string;
  searchQuery: string;
  dateRange: { start: string; end: string };
  productType: string;
  sortBy: 'updatedAt' | 'quantity' | 'priority';
  sortOrder: 'asc' | 'desc';
  branch: string;
}

const getStatusInfo = (status: ChefTask['status']) => {
  const statusMap: Record<ChefTask['status'], { label: string; color: string; icon: React.FC; progress: number }> = {
    pending: { label: 'item_pending', color: 'bg-gray-100 text-gray-700', icon: Clock, progress: 0 },
    assigned: { label: 'item_assigned', color: 'bg-blue-100 text-blue-700', icon: Clock, progress: 25 },
    in_progress: { label: 'item_in_progress', color: 'bg-yellow-100 text-yellow-700', icon: Package, progress: 50 },
    completed: { label: 'item_completed', color: 'bg-green-100 text-green-700', icon: Check, progress: 100 },
  };
  return statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-700', icon: Clock, progress: 0 };
};


const StatsSection: React.FC<{ statsData: Stats | undefined; t: (key: string, params?: Record<string, string | number>) => string }> = ({ statsData, t }) => {
  return statsData ? (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 shadow-md rounded-lg border border-blue-200 hover:shadow-lg transition-shadow">
        <h3 className="text-lg font-semibold text-blue-800">{t('tasks.pending')}</h3>
        <p className="text-2xl font-bold text-blue-600">{statsData.pending}</p>
      </Card>
      <Card className="p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 shadow-md rounded-lg border border-yellow-200 hover:shadow-lg transition-shadow">
        <h3 className="text-lg font-semibold text-yellow-800">{t('tasks.in_progress')}</h3>
        <p className="text-2xl font-bold text-yellow-600">{statsData.inProgress}</p>
      </Card>
      <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 shadow-md rounded-lg border border-green-200 hover:shadow-lg transition-shadow">
        <h3 className="text-lg font-semibold text-green-800">{t('tasks.completed')}</h3>
        <p className="text-2xl font-bold text-green-600">{statsData.completed}</p>
      </Card>
      <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 shadow-md rounded-lg border border-purple-200 hover:shadow-lg transition-shadow">
        <h3 className="text-lg font-semibold text-purple-800">{t('tasks.performance_score')}</h3>
        <p className="text-2xl font-bold text-purple-600">{statsData.performanceScore.toFixed(1)}%</p>
      </Card>
    </motion.div>
  ) : null;
};

const ChartsSection: React.FC<{ statsData: Stats | undefined; t: (key: string, params?: Record<string, string | number>) => string; language: string }> = ({ statsData, t, language }) => {
  const isRtl = language === 'ar';

  const doughnutData = {
    labels: [t('orders.item_pending'), t('orders.item_in_progress'), t('orders.item_completed')],
    datasets: [
      {
        label: t('tasks.distribution'),
        data: [statsData?.pending || 0, statsData?.inProgress || 0, statsData?.completed || 0],
        backgroundColor: ['#f59e0b', '#3b82f6', '#10b981'],
        borderColor: ['#d97706', '#2563eb', '#059669'],
        borderWidth: 1,
      },
    ],
  };

  const lineData = {
    labels: statsData?.dailyCompletions.map((d) => new Date(d.date).toLocaleDateString(language)) || [],
    datasets: [
      {
        label: t('tasks.completed'),
        data: statsData?.dailyCompletions.map((d) => d.count) || [],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const barData = {
    labels: statsData?.topProducts.map((p) => p.productName) || [],
    datasets: [
      {
        label: t('tasks.top_products'),
        data: statsData?.topProducts.map((p) => p.count) || [],
        backgroundColor: '#3b82f6',
        borderColor: '#2563eb',
        borderWidth: 1,
      },
    ],
  };

  const typeDoughnutData = {
    labels: statsData?.productTypes.map((p) => p.type) || [],
    datasets: [
      {
        label: t('tasks.product_types'),
        data: statsData?.productTypes.map((p) => p.count) || [],
        backgroundColor: ['#ef4444', '#eab308', '#22c55e', '#3b82f6', '#a855f7'],
        borderColor: ['#dc2626', '#ca8a04', '#16a34a', '#2563eb', '#9333ea'],
        borderWidth: 1,
      },
    ],
  };

  return statsData ? (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <Card className="p-4 bg-white shadow-md rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">{t('tasks.distribution')}</h3>
        <div className="relative h-64">
          <Doughnut
            data={doughnutData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: isRtl ? 'right' : 'left', labels: { font: { size: 14, family: isRtl ? 'Tajawal, sans-serif' : 'inherit' } } },
                tooltip: { enabled: true, backgroundColor: '#fff', titleFont: { family: isRtl ? 'Tajawal, sans-serif' : 'inherit' }, bodyFont: { family: isRtl ? 'Tajawal, sans-serif' : 'inherit' } },
              },
              animation: { duration: 1000, easing: 'easeOutQuart' },
            }}
          />
        </div>
      </Card>
      <Card className="p-4 bg-white shadow-md rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">{t('tasks.progress')}</h3>
        <div className="relative h-64">
          <Line
            data={lineData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'top', labels: { font: { size: 14, family: isRtl ? 'Tajawal, sans-serif' : 'inherit' } } },
                tooltip: { enabled: true, backgroundColor: '#fff', titleFont: { family: isRtl ? 'Tajawal, sans-serif' : 'inherit' }, bodyFont: { family: isRtl ? 'Tajawal, sans-serif' : 'inherit' } },
              },
              scales: {
                y: { beginAtZero: true, title: { display: true, text: t('tasks.count'), font: { family: isRtl ? 'Tajawal, sans-serif' : 'inherit' } } },
                x: { title: { display: true, text: t('common.date'), font: { family: isRtl ? 'Tajawal, sans-serif' : 'inherit' } } },
              },
              animation: { duration: 1000, easing: 'easeOutQuart' },
            }}
          />
        </div>
      </Card>
      <Card className="p-4 bg-white shadow-md rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">{t('tasks.top_products')}</h3>
        <div className="relative h-64">
          <Bar
            data={barData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'top', labels: { font: { size: 14, family: isRtl ? 'Tajawal, sans-serif' : 'inherit' } } },
                tooltip: { enabled: true, backgroundColor: '#fff', titleFont: { family: isRtl ? 'Tajawal, sans-serif' : 'inherit' }, bodyFont: { family: isRtl ? 'Tajawal, sans-serif' : 'inherit' } },
              },
              scales: {
                y: { beginAtZero: true, title: { display: true, text: t('tasks.count'), font: { family: isRtl ? 'Tajawal, sans-serif' : 'inherit' } } },
                x: { title: { display: true, text: t('products.name'), font: { family: isRtl ? 'Tajawal, sans-serif' : 'inherit' } } },
              },
              animation: { duration: 1000, easing: 'easeOutQuart' },
            }}
          />
        </div>
      </Card>
      <Card className="p-4 bg-white shadow-md rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">{t('tasks.product_types_distribution')}</h3>
        <div className="relative h-64">
          <Doughnut
            data={typeDoughnutData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: isRtl ? 'right' : 'left', labels: { font: { size: 14, family: isRtl ? 'Tajawal, sans-serif' : 'inherit' } } },
                tooltip: { enabled: true, backgroundColor: '#fff', titleFont: { family: isRtl ? 'Tajawal, sans-serif' : 'inherit' }, bodyFont: { family: isRtl ? 'Tajawal, sans-serif' : 'inherit' } },
              },
              animation: { duration: 1000, easing: 'easeOutQuart' },
            }}
          />
        </div>
      </Card>
    </div>
  ) : null;
};


const TopProductsTable: React.FC<{ topProducts: Stats['topProducts']; t: (key: string) => string }> = ({ topProducts, t }) => (
  <Card className="p-4 mb-6 bg-white shadow-md rounded-lg border border-gray-200">
    <h3 className="text-lg font-semibold mb-4">{t('tasks.top_products_table')}</h3>
    <table className="w-full table-auto">
      <thead>
        <tr className="bg-gray-100">
          <th className="px-4 py-2 text-left">{t('products.name')}</th>
          <th className="px-4 py-2 text-left">{t('tasks.count')}</th>
        </tr>
      </thead>
      <tbody>
        {topProducts.map((product, index) => (
          <tr key={index} className="border-b">
            <td className="px-4 py-2">{product.productName}</td>
            <td className="px-4 py-2">{product.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </Card>
);


export const Chefstatics: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const navigate = useNavigate();
  const { socket, emit, isConnected } = useSocket();
  const { notifications, addNotification, markAsRead, markAllAsRead } = useNotifications();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<FilterOptions>({
    status: '',
    searchQuery: '',
    dateRange: { start: '', end: '' },
    productType: '',
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    branch: '',
  });
  const [page, setPage] = useState<number>(1);
  const [showConfirmModal, setShowConfirmModal] = useState<{ taskId: string; orderId: string; status: string } | null>(null);
  const tasksPerPage = 10;

  // Fetch Chef Profile
  const { data: chefProfile, error: chefError } = useQuery<ChefProfile, Error>({
    queryKey: ['chefProfile', user?.id || user?._id],
    queryFn: () => chefsAPI.getByUserId(user?.id || user?._id || ''),
    enabled: !!user && !!/^[0-9a-fA-F]{24}$/.test(user?.id || user?._id || ''),
    onError: () => {
      toast.error(t('errors.chefProfileError'), { toastId: `error-chefProfile-${Date.now()}`, position: isRtl ? 'top-right' : 'top-left' });
      navigate('/login');
    },
  });

  // Fetch Tasks
  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', chefProfile?._id, page, filters],
    queryFn: () => productionAssignmentsAPI.getChefTasks(chefProfile?._id || '', { page, limit: tasksPerPage, ...filters }),
    enabled: !!chefProfile?._id,
    select: (response) => {
      const validTasks = response
        .filter((task: any) => task._id && task.order?._id && task.product?._id && task.quantity > 0)
        .map((task: any) => ({
          id: task._id,
          orderId: task.order._id || 'unknown',
          orderNumber: task.order.orderNumber || 'N/A',
          productId: task.product._id || 'unknown',
          productName: task.product.name || t('products.unknown'),
          quantity: task.quantity,
          status: task.status as ChefTask['status'],
          createdAt: task.createdAt || new Date().toISOString(),
          updatedAt: task.updatedAt || new Date().toISOString(),
          progress: getStatusInfo(task.status as ChefTask['status']).progress,
          priority: task.priority || 'medium',
          productType: task.product.type || 'unknown',
          branchName: task.order.branch?.name || t('branches.unknown'),
        })) as ChefTask[];
      return {
        tasks: validTasks,
        totalPages: Math.ceil(response.total / tasksPerPage) || 1, // Assume API returns total
      };
    },
    onError: () => {
      toast.error(t('errors.fetch_tasks'), { toastId: `error-fetchTasks-${Date.now()}`, position: isRtl ? 'top-right' : 'top-left' });
    },
  });

  // Fetch Stats
  const { data: statsData, isLoading: statsLoading } = useQuery<Stats | undefined>({
    queryKey: ['stats', chefProfile?._id],
    queryFn: async () => {
      const response = await productionAssignmentsAPI.getChefTasks(chefProfile?._id || '', { limit: 1000 });
      const tasks: ChefTask[] = response
        .filter((task: any) => task._id && task.order?._id && task.product?._id && task.quantity > 0)
        .map((task: any) => ({
          id: task._id,
          orderId: task.order._id || 'unknown',
          orderNumber: task.order.orderNumber || 'N/A',
          productId: task.product._id || 'unknown',
          productName: task.product.name || t('products.unknown'),
          quantity: task.quantity,
          status: task.status as ChefTask['status'],
          createdAt: task.createdAt || new Date().toISOString(),
          updatedAt: task.updatedAt || new Date().toISOString(),
          progress: getStatusInfo(task.status as ChefTask['status']).progress,
          priority: task.priority || 'medium',
          productType: task.product.type || 'unknown',
          branchName: task.order.branch?.name || t('branches.unknown'),
        }));

      const pending = tasks.filter((t) => t.status === 'pending' || t.status === 'assigned').length;
      const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
      const completed = tasks.filter((t) => t.status === 'completed').length;
      const total = tasks.length;
      const performanceScore = total > 0 ? (completed / total) * 100 : 0;
      const avgCompletionTime = tasks
        .filter((t) => t.status === 'completed' && t.createdAt && t.updatedAt)
        .reduce((acc, t) => acc + (new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / 1000 / 60, 0) / (completed || 1);
      const dailyCompletions = tasks
        .filter((t) => t.status === 'completed')
        .reduce((acc, t) => {
          const date = new Date(t.updatedAt).toISOString().split('T')[0];
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      const dailyCompletionsArray = Object.entries(dailyCompletions)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-7);
      const topProducts = tasks
        .filter((t) => t.status === 'completed')
        .reduce((acc, t) => {
          acc[t.productName] = (acc[t.productName] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      const topProductsArray = Object.entries(topProducts)
        .map(([productName, count]) => ({ productName, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      const productTypes = tasks
        .filter((t) => t.status === 'completed')
        .reduce((acc, t) => {
          const type = t.productType || 'unknown';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      const productTypesArray = Object.entries(productTypes)
        .map(([type, count]) => ({ type, count }));

      return { pending, inProgress, completed, avgCompletionTime, dailyCompletions: dailyCompletionsArray, topProducts: topProductsArray, productTypes: productTypesArray, performanceScore };
    },
    enabled: !!chefProfile?._id,
    onError: () => {
      toast.error(t('errors.fetch_stats'), { toastId: `error-fetchStats-${Date.now()}`, position: isRtl ? 'top-right' : 'top-left' });
    },
  });

  // Update Task Status Mutation
  const updateTaskMutation = useMutation({
    mutationFn: ({ orderId, taskId, status }: { orderId: string; taskId: string; status: string }) =>
      productionAssignmentsAPI.updateTaskStatus(orderId, taskId, { status }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['tasks']);
      queryClient.invalidateQueries(['stats']);
      emit('itemStatusUpdated', {
        orderId: variables.orderId,
        itemId: variables.taskId,
        status: variables.status,
        chefId: chefProfile?._id,
        productName: tasksData?.tasks.find((t) => t.id === variables.taskId)?.productName || t('products.unknown'),
        orderNumber: tasksData?.tasks.find((t) => t.id === variables.taskId)?.orderNumber || 'N/A',
        eventId: `${variables.taskId}-taskStatusUpdated-${variables.status}`,
      });
      toast.success(t('orders.status_updated', { status: t(`orders.item_${variables.status}`) }), {
        position: isRtl ? 'top-right' : 'top-left',
      });
    },
    onError: () => {
      toast.error(t('errors.update_task_status'), { position: isRtl ? 'top-right' : 'top-left' });
    },
  });

  // Handle Socket Events
  useEffect(() => {
    if (!socket || !chefProfile?._id || !user || !isConnected) return;

    const handleTaskAssigned = (data: any) => {
      if (data.chefId === chefProfile._id && data.orderId && data.taskId && data.productName) {
        const notification: Notification = {
          _id: crypto.randomUUID(),
          type: 'info',
          message: t('socket.task_assigned', {
            productName: data.productName,
            orderNumber: data.orderNumber,
          }),
          data: {
            orderId: data.orderId,
            taskId: data.taskId,
            chefId: data.chefId,
            eventId: data.eventId,
          },
          read: false,
          createdAt: new Date().toLocaleString(language),
          sound: '/sounds/task-assigned.mp3',
          vibrate: [200, 100, 200],
        };
        addNotification(notification);
        queryClient.invalidateQueries(['tasks']);
        queryClient.invalidateQueries(['stats']);
      }
    };

    const handleItemStatusUpdated = (data: any) => {
      if (data.chefId === chefProfile._id && data.orderId && data.itemId && data.status) {
        queryClient.invalidateQueries(['tasks']);
        queryClient.invalidateQueries(['stats']);
        const notification: Notification = {
          _id: crypto.randomUUID(),
          type: 'info',
          message: t('orders.status_updated', { status: t(`orders.item_${data.status}`) }),
          data: { orderId: data.orderId, taskId: data.itemId, chefId: data.chefId, eventId: data.eventId },
          read: false,
          createdAt: new Date().toLocaleString(language),
          sound: '/sounds/status-updated.mp3',
          vibrate: [200, 100, 200],
        };
        addNotification(notification);
      }
    };

    const handleTaskCompleted = (data: any) => {
      if (data.chefId === chefProfile._id && data.orderId && data.taskId) {
        queryClient.invalidateQueries(['tasks']);
        queryClient.invalidateQueries(['stats']);
        const notification: Notification = {
          _id: crypto.randomUUID(),
          type: 'success',
          message: t('socket.task_completed', {
            product: data.productName,
            order: data.orderNumber,
          }),
          data: { orderId: data.orderId, taskId: data.taskId, chefId: data.chefId, eventId: data.eventId },
          read: false,
          createdAt: new Date().toLocaleString(language),
          sound: '/sounds/task-completed.mp3',
          vibrate: [400, 100, 400],
        };
        addNotification(notification);
      }
    };

    const handleOrderCompleted = (data: any) => {
      if (data.orderId && tasksData?.tasks.some((task) => task.orderId === data.orderId)) {
        queryClient.invalidateQueries(['tasks']);
        queryClient.invalidateQueries(['stats']);
        const notification: Notification = {
          _id: crypto.randomUUID(),
          type: 'success',
          message: t('socket.order_completed', { orderNumber: data.orderNumber }),
          data: { orderId: data.orderId, eventId: data.eventId },
          read: false,
          createdAt: new Date().toLocaleString(language),
          sound: '/sounds/order-completed.mp3',
          vibrate: [400, 100, 400],
        };
        addNotification(notification);
      }
    };

    socket.on('taskAssigned', handleTaskAssigned);
    socket.on('itemStatusUpdated', handleItemStatusUpdated);
    socket.on('taskCompleted', handleTaskCompleted);
    socket.on('orderCompleted', handleOrderCompleted);

    return () => {
      socket.off('taskAssigned', handleTaskAssigned);
      socket.off('itemStatusUpdated', handleItemStatusUpdated);
      socket.off('taskCompleted', handleTaskCompleted);
      socket.off('orderCompleted', handleOrderCompleted);
    };
  }, [socket, isConnected, chefProfile?._id, user, t, language, addNotification, queryClient, tasksData]);

  const debouncedSearch = useMemo(
    () => debounce((value: string) => setFilters((prev) => ({ ...prev, searchQuery: value })), 300),
    []
  );

  const branches = useMemo(() => [...new Set(tasksData?.tasks.map((t) => t.branchName) || [])], [tasksData]);

  const filteredTasks = useMemo(() => {
    return (tasksData?.tasks || []).filter((task: ChefTask) =>
      (filters.status ? task.status === filters.status : true) &&
      (filters.searchQuery
        ? task.orderNumber.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
          task.productName.toLowerCase().includes(filters.searchQuery.toLowerCase())
        : true) &&
      (filters.dateRange.start && filters.dateRange.end
        ? new Date(task.createdAt) >= new Date(filters.dateRange.start) && new Date(task.createdAt) <= new Date(filters.dateRange.end)
        : true) &&
      (filters.productType ? task.productType === filters.productType : true) &&
      (filters.branch ? task.branchName === filters.branch : true)
    ).sort((a, b) => {
      if (filters.sortBy === 'updatedAt') {
        return filters.sortOrder === 'asc'
          ? new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
          : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      } else if (filters.sortBy === 'quantity') {
        return filters.sortOrder === 'asc' ? a.quantity - b.quantity : b.quantity - a.quantity;
      } else if (filters.sortBy === 'priority') {
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
        return filters.sortOrder === 'asc'
          ? (priorityOrder[a.priority || 'medium'] - priorityOrder[b.priority || 'medium'])
          : (priorityOrder[b.priority || 'medium'] - priorityOrder[a.priority || 'medium']);
      }
      return 0;
    });
  }, [tasksData?.tasks, filters]);

  const paginatedTasks = useMemo(() => filteredTasks.slice((page - 1) * tasksPerPage, page * tasksPerPage), [filteredTasks, page, tasksPerPage]);

  const totalPages = Math.ceil(filteredTasks.length / tasksPerPage);

  const handleStatusChange = useCallback((taskId: string, orderId: string, newStatus: string) => {
    setShowConfirmModal({ taskId, orderId, status: newStatus });
  }, []);

  const confirmStatusChange = useCallback(() => {
    if (showConfirmModal) {
      updateTaskMutation.mutate({
        orderId: showConfirmModal.orderId,
        taskId: showConfirmModal.taskId,
        status: showConfirmModal.status,
      });
      setShowConfirmModal(null);
    }
  }, [showConfirmModal, updateTaskMutation]);

  return (
    <div className={`mx-auto  px-3 sm:px-5 py-6 min-h-screen ${isRtl ? 'rtl' : 'ltr'}`}>
      <ToastContainer position={isRtl ? 'top-right' : 'top-left'} autoClose={4000} />
      {chefError ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
          <p className="mt-2 text-red-500">{t('errors.chefProfileError')}</p>
          <Button onClick={() => navigate('/login')} className="mt-4">
            {t('login')}
          </Button>
        </motion.div>
      ) : tasksLoading || statsLoading ? (
        <LoadingSpinner className="mx-auto" />
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h1 className="text-2xl font-bold mb-6">{t('chefDashboard.title')}</h1>
          <StatsSection statsData={statsData} t={t} />
          <ChartsSection statsData={statsData} t={t} language={language} />
          <TopProductsTable topProducts={statsData?.topProducts || []} t={t} />

        </motion.div>
      )}
    </div>
  );
};

export default Chefstatics;