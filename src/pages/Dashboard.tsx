import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useNotifications } from '../contexts/NotificationContext';
import { ShoppingCart, Clock, BarChart3, CheckCircle, AlertCircle, Package, DollarSign, ChefHat, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { ordersAPI, productionAssignmentsAPI, chefsAPI, branchesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';

// تعريف الأنواع
interface Stats {
  totalOrders: number;
  pendingOrders: number;
  inProductionOrders: number;
  inTransitOrders: number;
  deliveredOrders: number;
  totalSales: number;
  completedTasks: number;
  inProgressTasks: number;
  returns: number;
  averageOrderValue: number;
}

interface Task {
  id: string;
  orderId: string;
  orderNumber: string;
  productName: string;
  quantity: number;
  unit: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed';
  branchName: string;
  createdAt: string;
}

interface BranchPerformance {
  branchName: string;
  performance: number;
  totalOrders: number;
  completedOrders: number;
}

interface ChefPerformance {
  chefName: string;
  performance: number;
  totalTasks: number;
  completedTasks: number;
}

interface Order {
  id: string;
  orderNumber: string;
  branchName: string;
  branchId: string;
  items: Array<{
    _id: string;
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    department: { _id: string; name: string };
    assignedTo?: { _id: string; username: string };
    status: 'pending' | 'assigned' | 'in_progress' | 'completed';
    returnedQuantity?: number;
    returnReason?: string;
  }>;
  returns?: Array<{
    returnId: string;
    status: 'pending_approval' | 'approved' | 'rejected' | 'processed';
    items: Array<{
      productId: string;
      quantity: number;
      reason: string;
    }>;
    reviewNotes?: string;
    createdAt: string;
  }>;
  status: 'pending' | 'approved' | 'in_production' | 'completed' | 'in_transit' | 'delivered' | 'cancelled';
  totalAmount: number;
  date: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdBy: string;
  createdAt: string;
}

interface Chef {
  _id: string;
  userId: string;
  username: string;
  name: string;
  department: { _id: string; name: string } | null;
}

interface FilterState {
  status: string;
  search: string;
  branch: string;
  priority: string;
}

const timeFilterOptions = [
  { value: 'day', label: 'اليوم', enLabel: 'Today' },
  { value: 'week', label: 'هذا الأسبوع', enLabel: 'This Week' },
  { value: 'month', label: 'هذا الشهر', enLabel: 'This Month' },
  { value: 'year', label: 'هذا العام', enLabel: 'This Year' },
];

// مكون مؤشر التحميل
const Loader: React.FC = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.3 }}
    className="flex justify-center items-center h-screen"
  >
    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-amber-500"></div>
  </motion.div>
);

// مكون Skeleton لبطاقة الإحصائيات
const StatsCardSkeleton: React.FC<{ isRtl: boolean }> = ({ isRtl }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className="p-4 bg-gray-100 rounded-lg border border-gray-200"
  >
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
      <div className="flex-1">
        <div className={`h-4 w-1/2 bg-gray-200 rounded animate-pulse ${isRtl ? 'mr-2' : 'ml-2'}`} />
        <div className={`h-5 w-1/3 bg-gray-200 rounded animate-pulse mt-2 ${isRtl ? 'mr-2' : 'ml-2'}`} />
      </div>
    </div>
  </motion.div>
);

// مكون بطاقة الإحصائيات
const StatsCard: React.FC<{ title: string; value: string; icon: React.FC; color: string; ariaLabel: string }> = React.memo(
  ({ title, value, icon: Icon, color, ariaLabel }) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`p-4 bg-${color}-50 rounded-xl border border-${color}-100 cursor-pointer hover:bg-${color}-100 transition-colors duration-200 shadow-sm`}
      aria-label={ariaLabel}
    >
      <div className="flex items-center gap-3">
        <Icon className={`w-6 h-6 text-${color}-600`} />
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-lg font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </motion.div>
  )
);

// مكون لوحة تحكم الشيف
const ChefDashboard: React.FC<{
  stats: Stats;
  tasks: Task[];
  isRtl: boolean;
  language: string;
  handleStartTask: (taskId: string, orderId: string) => void;
  handleCompleteTask: (taskId: string, orderId: string) => void;
}> = React.memo(({ stats, tasks, isRtl, language, handleStartTask, handleCompleteTask }) => {
  const [filter, setFilter] = useState<FilterState>({ status: 'all', search: '', branch: '', priority: '' });
  const [debouncedSearch] = useDebounce(filter.search, 300);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => filter.status === 'all' || task.status === filter.status)
      .filter((task) => filter.branch === '' || task.branchName === filter.branch)
      .filter(
        (task) =>
          task.productName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          task.orderNumber.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);
  }, [tasks, filter.status, filter.branch, debouncedSearch]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title={isRtl ? 'إجمالي الطلبات' : 'Total Orders'}
          value={stats.totalOrders.toString()}
          icon={ShoppingCart}
          color="amber"
          ariaLabel={isRtl ? 'إجمالي الطلبات' : 'Total Orders'}
        />
        <StatsCard
          title={isRtl ? 'المهام المكتملة' : 'Completed Tasks'}
          value={stats.completedTasks.toString()}
          icon={CheckCircle}
          color="green"
          ariaLabel={isRtl ? 'المهام المكتملة' : 'Completed Tasks'}
        />
        <StatsCard
          title={isRtl ? 'المهام قيد التنفيذ' : 'In Progress Tasks'}
          value={stats.inProgressTasks.toString()}
          icon={Clock}
          color="blue"
          ariaLabel={isRtl ? 'المهام قيد التنفيذ' : 'In Progress Tasks'}
        />
        <StatsCard
          title={isRtl ? 'الطلبات المعلقة' : 'Pending Orders'}
          value={stats.pendingOrders.toString()}
          icon={AlertCircle}
          color="red"
          ariaLabel={isRtl ? 'الطلبات المعلقة' : 'Pending Orders'}
        />
      </div>
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
        <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <ChefHat className={`w-5 h-5 ${isRtl ? 'ml-2' : 'mr-2'} text-amber-600`} />
            {isRtl ? 'أحدث الطلبات قيد الإنتاج' : 'Latest In Production'}
          </h3>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-48">
              <Search className={`absolute top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 ${isRtl ? 'right-3' : 'left-3'}`} />
              <input
                type="text"
                value={filter.search}
                onChange={(e) => setFilter((prev) => ({ ...prev, search: e.target.value }))}
                placeholder={isRtl ? 'ابحث حسب المنتج أو رقم الطلب' : 'Search by product or order number'}
                className={`w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 text-sm ${isRtl ? 'pr-10 pl-4' : ''}`}
                aria-label={isRtl ? 'البحث' : 'Search'}
              />
            </div>
            <select
              value={filter.status}
              onChange={(e) => setFilter((prev) => ({ ...prev, status: e.target.value }))}
              className="w-full sm:w-32 p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 text-sm"
              aria-label={isRtl ? 'حالة المهمة' : 'Task Status'}
            >
              <option value="all">{isRtl ? 'الكل' : 'All'}</option>
              <option value="pending">{isRtl ? 'معلق' : 'Pending'}</option>
              <option value="assigned">{isRtl ? 'معين' : 'Assigned'}</option>
              <option value="in_progress">{isRtl ? 'قيد التنفيذ' : 'In Progress'}</option>
              <option value="completed">{isRtl ? 'مكتمل' : 'Completed'}</option>
            </select>
          </div>
        </div>
        <div className="space-y-3">
          <AnimatePresence>
            {filteredTasks.length === 0 ? (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="text-gray-500 text-sm text-center"
              >
                {isRtl ? 'لا توجد مهام' : 'No tasks available'}
              </motion.p>
            ) : (
              filteredTasks.map((task) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="border border-amber-100 rounded-lg p-4 bg-amber-50 shadow-sm hover:shadow-md transition-shadow duration-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm text-gray-800 truncate">
                      {isRtl ? `طلب رقم ${task.orderNumber}` : `Order #${task.orderNumber}`}
                    </h4>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        task.status === 'pending' || task.status === 'assigned'
                          ? 'bg-amber-100 text-amber-800'
                          : task.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {isRtl
                        ? task.status === 'pending'
                          ? 'معلق'
                          : task.status === 'assigned'
                          ? 'معين'
                          : task.status === 'in_progress'
                          ? 'قيد التنفيذ'
                          : 'مكتمل'
                        : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2 truncate">{`${task.quantity} ${task.productName}`}</p>
                  <p className="text-sm text-gray-500 mb-3">{isRtl ? `تم الإنشاء في: ${task.createdAt}` : `Created At: ${task.createdAt}`}</p>
                  <div className="flex items-center gap-3">
                    {(task.status === 'pending' || task.status === 'assigned') && (
                      <button
                        onClick={() => handleStartTask(task.id, task.orderId)}
                        className="bg-amber-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-amber-700 transition-colors duration-200"
                        aria-label={isRtl ? 'بدء المهمة' : 'Start Task'}
                      >
                        {isRtl ? 'بدء' : 'Start'}
                      </button>
                    )}
                    {task.status === 'in_progress' && (
                      <button
                        onClick={() => handleCompleteTask(task.id, task.orderId)}
                        className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-green-700 transition-colors duration-200"
                        aria-label={isRtl ? 'إكمال المهمة' : 'Complete Task'}
                      >
                        {isRtl ? 'إكمال' : 'Complete'}
                      </button>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
});

// مكون لوحة التحكم الرئيسية
export const Dashboard: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [timeFilter, setTimeFilter] = useState('week');
  const [filter, setFilter] = useState<FilterState>({ status: 'all', search: '', branch: '', priority: '' });
  const [debouncedSearch] = useDebounce(filter.search, 300);

  const getTimeRange = useCallback(() => {
    const now = new Date();
    let startDate: Date;
    switch (timeFilter) {
      case 'day':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
    }
    return { startDate: startDate.toISOString(), endDate: now.toISOString() };
  }, [timeFilter]);

  const fetchDashboardData = useCallback(async () => {
    if (!user?.id && !user?._id) {
      throw new Error(isRtl ? 'الوصول غير مصرح به' : 'Unauthorized access');
    }

    const { startDate, endDate } = getTimeRange();
    const query: Record<string, any> = { startDate, endDate, limit: 20 };

    if (user.role === 'branch') query.branch = user.id || user._id;
    if (user.role === 'production' && user.department) query.departmentId = user.department._id;

    const results = await Promise.allSettled([
      user.role === 'chef' ? chefsAPI.getByUserId(user.id || user._id) : Promise.resolve(null),
      ordersAPI.getAll(query),
      productionAssignmentsAPI.getAllTasks(query),
      ['admin', 'production'].includes(user.role) ? chefsAPI.getAll() : Promise.resolve([]),
      ['admin', 'production'].includes(user.role) ? branchesAPI.getAll() : Promise.resolve([]),
    ]);

    const [chefResult, ordersResult, tasksResult, chefsResult, branchesResult] = results;

    const chefProfile = chefResult.status === 'fulfilled' ? chefResult.value : null;
    const ordersResponse = ordersResult.status === 'fulfilled' ? ordersResult.value : [];
    const tasksResponse = tasksResult.status === 'fulfilled' ? tasksResult.value : [];
    const chefsResponse = chefsResult.status === 'fulfilled' ? chefsResult.value : [];
    const branchesResponse = branchesResult.status === 'fulfilled' ? branchesResult.value : [];

    const mappedOrders = ordersResponse.map((order: any) => ({
      id: order._id || crypto.randomUUID(),
      orderNumber: order.orderNumber || (isRtl ? 'غير معروف' : 'Unknown'),
      branchName: order.branch?.displayName || order.branch?.name || (isRtl ? 'فرع غير معروف' : 'Unknown Branch'),
      branchId: order.branch?._id || 'unknown',
      items: (order.items || []).map((item: any) => ({
        _id: item._id || crypto.randomUUID(),
        productId: item.product?._id || 'unknown',
        productName: item.product?.name || (isRtl ? 'منتج غير معروف' : 'Unknown Product'),
        quantity: Number(item.quantity) || 1,
        price: Number(item.price) || 0,
        department: item.product?.department || { _id: 'unknown', name: isRtl ? 'قسم غير معروف' : 'Unknown Department' },
        status: item.status || 'pending',
        assignedTo: item.assignedTo
          ? { _id: item.assignedTo._id, username: item.assignedTo.username || (isRtl ? 'شيف غير معروف' : 'Unknown Chef') }
          : undefined,
        returnedQuantity: Number(item.returnedQuantity) || 0,
        returnReason: item.returnReason || '',
      })),
      status: order.status || 'pending',
      totalAmount: Number(order.totalAmount || order.totalPrice) || 0,
      date: formatDate(order.createdAt || new Date(), language),
      priority: order.priority || 'medium',
      createdBy: order.createdBy?.username || (isRtl ? 'غير معروف' : 'Unknown'),
      createdAt: order.createdAt || new Date().toISOString(),
      returns: (order.returns || []).map((ret: any) => ({
        returnId: ret._id || crypto.randomUUID(),
        items: (ret.items || []).map((item: any) => ({
          productId: item.product?._id || 'unknown',
          quantity: Number(item.quantity) || 0,
          reason: item.reason || '',
        })),
        status: ret.status || 'pending_approval',
        reviewNotes: ret.reviewNotes || '',
        createdAt: formatDate(ret.createdAt || new Date(), language),
      })),
    }));

    const mappedTasks = tasksResponse.map((task: any) => ({
      id: task._id || crypto.randomUUID(),
      orderId: task.order?._id || 'unknown',
      orderNumber: task.order?.orderNumber || (isRtl ? 'غير معروف' : 'Unknown'),
      productName: task.product?.name || (isRtl ? 'منتج غير معروف' : 'Unknown Product'),
      quantity: Number(task.quantity) || 0,
      unit: task.product?.unit || 'unit',
      status: task.status || 'pending',
      branchName: task.order?.branch?.displayName || task.order?.branch?.name || (isRtl ? 'فرع غير معروف' : 'Unknown Branch'),
      createdAt: formatDate(task.createdAt || new Date(), language),
    }));

    const mappedChefs = chefsResponse.map((chef: any) => ({
      _id: chef._id || crypto.randomUUID(),
      userId: chef.user?._id || chef._id,
      username: chef.user?.username || chef.username || (isRtl ? 'شيف غير معروف' : 'Unknown Chef'),
      name: chef.user?.name || chef.name || (isRtl ? 'شيف غير معروف' : 'Unknown Chef'),
      department: chef.department || null,
    }));

    const mappedBranches = branchesResponse
      .map((branch: any) => ({
        _id: branch._id || crypto.randomUUID(),
        name: branch.displayName || branch.name || (isRtl ? 'فرع غير معروف' : 'Unknown Branch'),
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    const branchPerf = mappedBranches.map((branch: any) => {
      const branchOrders = mappedOrders.filter((o) => o.branchId === branch._id);
      const total = branchOrders.length;
      const completed = branchOrders.filter((o) => o.status === 'completed' || o.status === 'delivered').length;
      const perf = total > 0 ? (completed / total) * 100 : 0;
      return { branchName: branch.name, performance: perf, totalOrders: total, completedOrders: completed };
    }).filter((b: any) => b.totalOrders > 0);

    const chefPerf = mappedChefs.map((chef: any) => {
      const chefTasks = mappedTasks.filter((task) => {
        const order = mappedOrders.find((o) => o.id === task.orderId);
        return order?.items.some((i) => i.assignedTo?._id === chef.userId);
      });
      const total = chefTasks.length;
      const completed = chefTasks.filter((t) => t.status === 'completed').length;
      const perf = total > 0 ? (completed / total) * 100 : 0;
      return { chefName: chef.name, performance: perf, totalTasks: total, completedTasks: completed };
    }).filter((c: any) => c.totalTasks > 0);

    const totalOrders = user.role === 'chef' ? mappedTasks.length : mappedOrders.length;
    const pendingOrders = user.role === 'chef'
      ? mappedTasks.filter((task) => task.status === 'pending' || task.status === 'assigned').length
      : mappedOrders.filter((o) => o.status === 'pending').length;
    const inProductionOrders = mappedOrders.filter((o) => o.status === 'in_production').length;
    const inTransitOrders = mappedOrders.filter((o) => o.status === 'in_transit').length;
    const deliveredOrders = mappedOrders.filter((o) => o.status === 'delivered').length;
    const totalSales = mappedOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const completedTasks = mappedTasks.filter((task) => task.status === 'completed').length;
    const inProgressTasks = mappedTasks.filter((task) => task.status === 'in_progress').length;
    const returns = mappedOrders.reduce((sum, o) => sum + (o.returns ? o.returns.length : 0), 0);
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    return {
      orders: mappedOrders,
      tasks: mappedTasks,
      chefs: mappedChefs,
      branches: mappedBranches,
      branchPerformance: branchPerf,
      chefPerformance: chefPerf,
      stats: {
        totalOrders,
        pendingOrders,
        inProductionOrders,
        inTransitOrders,
        deliveredOrders,
        totalSales,
        completedTasks,
        inProgressTasks,
        returns,
        averageOrderValue,
      },
    };
  }, [user, isRtl, language, getTimeRange]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', user?.id || user?._id, user?.role, timeFilter],
    queryFn: fetchDashboardData,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    cacheTime: 10 * 60 * 1000, // 10 minutes cache
    retry: 2,
    retryDelay: 1000,
  });

  useEffect(() => {
    if (!socket || !user || !isConnected) return;

    socket.on('connect_error', () => {
      const errorMessage = isRtl ? 'خطأ في الاتصال بالسوكت' : 'Socket connection error';
      addNotification({
        _id: `socket-error-${Date.now()}`,
        type: 'error',
        message: errorMessage,
        read: false,
        createdAt: new Date().toLocaleString(language),
        path: '/dashboard',
      });
    });

    socket.on('taskAssigned', (data: any) => {
      if (!data.taskId || !data.orderId || !data.productName || !data.orderNumber || !data.branchName || !data.quantity || !data.eventId) return;

      if (data.chefId === (user?.id || user?._id) || ['admin', 'production'].includes(user.role)) {
        queryClient.invalidateQueries(['dashboard']);
        const notification = {
          _id: data.taskId,
          type: 'info' as const,
          message: isRtl
            ? `تم تعيين مهمة: ${data.productName} (${data.quantity} ${data.unit}) للطلب ${data.orderNumber} - ${data.branchName}`
            : `Task assigned: ${data.productName} (${data.quantity} ${data.unit}) for order ${data.orderNumber} - ${data.branchName}`,
          data: {
            orderId: data.orderId,
            taskId: data.taskId,
            chefId: data.chefId,
            eventId: data.eventId,
          },
          read: false,
          createdAt: formatDate(new Date(), language),
          sound: '/sounds/task-assigned.mp3',
          vibrate: [400, 100, 400],
          path: '/dashboard',
        };
        addNotification(notification);
      }
    });

    socket.on('orderCompleted', (data: any) => {
      if (!data.orderId || !data.orderNumber || !data.branchName || !data.eventId) return;

      if (['admin', 'branch', 'production'].includes(user.role)) {
        queryClient.invalidateQueries(['dashboard']);
        addNotification({
          _id: data._id || crypto.randomUUID(),
          type: 'success' as const,
          message: isRtl ? `تم إكمال الطلب ${data.orderNumber} - ${data.branchName}` : `Order completed: ${data.orderNumber} - ${data.branchName}`,
          data: {
            orderId: data.orderId,
            eventId: data.eventId,
          },
          read: false,
          createdAt: formatDate(new Date(), language),
          sound: '/sounds/order-completed.mp3',
          vibrate: [400, 100, 400],
          path: '/dashboard',
        });
      }
    });

    socket.on('itemStatusUpdated', (data: any) => {
      if (!data.orderId || !data.itemId || !data.status || !data.eventId) return;

      queryClient.setQueryData(['dashboard', user?.id || user?._id, user?.role, timeFilter], (oldData: any) => ({
        ...oldData,
        tasks: oldData.tasks.map((task: Task) =>
          task.id === data.itemId && task.orderId === data.orderId ? { ...task, status: data.status } : task
        ),
      }));
      addNotification({
        _id: data.eventId,
        type: 'info',
        message: isRtl
          ? `تم تحديث حالة المهمة: ${data.productName} للطلب ${data.orderNumber} إلى ${data.status === 'in_progress' ? 'قيد التنفيذ' : 'مكتمل'}`
          : `Task status updated: ${data.productName} for order ${data.orderNumber} to ${data.status}`,
        read: false,
        createdAt: formatDate(new Date(), language),
        path: '/dashboard',
      });
    });

    return () => {
      socket.off('connect_error');
      socket.off('taskAssigned');
      socket.off('orderCompleted');
      socket.off('itemStatusUpdated');
    };
  }, [socket, user, isRtl, language, addNotification, queryClient, timeFilter]);

  const handleStartTask = useCallback(
    async (taskId: string, orderId: string) => {
      if (!isConnected) {
        addNotification({
          _id: `warn-socket-${Date.now()}`,
          type: 'warning',
          message: isRtl ? 'الاتصال بالسوكت غير متاح' : 'Socket disconnected',
          read: false,
          createdAt: new Date().toLocaleString(language),
          path: '/dashboard',
        });
        return;
      }

      try {
        await productionAssignmentsAPI.updateTaskStatus(orderId, taskId, { status: 'in_progress' });
        queryClient.setQueryData(['dashboard', user?.id || user?._id, user?.role, timeFilter], (oldData: any) => ({
          ...oldData,
          tasks: oldData.tasks.map((task: Task) => (task.id === taskId ? { ...task, status: 'in_progress' } : task)),
        }));
        const task = data?.tasks.find((t: Task) => t.id === taskId);
        const eventId = crypto.randomUUID();
        socket.emit('itemStatusUpdated', {
          orderId,
          itemId: taskId,
          status: 'in_progress',
          chefId: user?.id || user?._id,
          eventId,
          orderNumber: task?.orderNumber || (isRtl ? 'غير معروف' : 'Unknown'),
          branchName: task?.branchName || (isRtl ? 'فرع غير معروف' : 'Unknown Branch'),
          productName: task?.productName || (isRtl ? 'منتج غير معروف' : 'Unknown Product'),
          quantity: task?.quantity || 0,
          unit: task?.unit || 'unit',
        });
        addNotification({
          _id: `success-task-${taskId}-${Date.now()}`,
          type: 'success',
          message: isRtl ? 'تم بدء المهمة' : 'Task started',
          read: false,
          createdAt: new Date().toLocaleString(language),
          path: '/dashboard',
          sound: '/sounds/task-status-updated.mp3',
          vibrate: [200, 100, 200],
        });
      } catch (err: any) {
        const errorMessage = err.message || (isRtl ? 'فشل تحديث المهمة' : 'Failed to update task');
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right', autoClose: 2000 });
        addNotification({
          _id: `error-task-${taskId}-${Date.now()}`,
          type: 'error',
          message: errorMessage,
          read: false,
          createdAt: new Date().toLocaleString(language),
          path: '/dashboard',
        });
      }
    },
    [socket, user, isRtl, isConnected, data, language, addNotification, queryClient, timeFilter]
  );

  const handleCompleteTask = useCallback(
    async (taskId: string, orderId: string) => {
      if (!isConnected) {
        addNotification({
          _id: `warn-socket-${Date.now()}`,
          type: 'warning',
          message: isRtl ? 'الاتصال بالسوكت غير متاح' : 'Socket disconnected',
          read: false,
          createdAt: new Date().toLocaleString(language),
          path: '/dashboard',
        });
        return;
      }

      try {
        await productionAssignmentsAPI.updateTaskStatus(orderId, taskId, { status: 'completed' });
        queryClient.setQueryData(['dashboard', user?.id || user?._id, user?.role, timeFilter], (oldData: any) => ({
          ...oldData,
          tasks: oldData.tasks.map((task: Task) => (task.id === taskId ? { ...task, status: 'completed' } : task)),
        }));
        const task = data?.tasks.find((t: Task) => t.id === taskId);
        const eventId = crypto.randomUUID();
        socket.emit('itemStatusUpdated', {
          orderId,
          itemId: tourderId,
          status: 'completed',
          chefId: user?.id || user?._id,
          eventId,
          orderNumber: task?.orderNumber || (isRtl ? 'غير معروف' : 'Unknown'),
          branchName: task?.branchName || (isRtl ? 'فرع غير معروف' : 'Unknown Branch'),
          productName: task?.productName || (isRtl ? 'منتج غير معروف' : 'Unknown Product'),
          quantity: task?.quantity || 0,
          unit: task?.unit || 'unit',
        });
        addNotification({
          _id: `success-complete-${taskId}-${Date.now()}`,
          type: 'success',
          message: isRtl ? 'تم إكمال المهمة' : 'Task completed',
          read: false,
          createdAt: new Date().toLocaleString(language),
          path: '/dashboard',
          sound: '/sounds/task-completed.mp3',
          vibrate: [400, 100, 400],
        });
      } catch (err: any) {
        const errorMessage = err.message || (isRtl ? 'فشل تحديث المهمة' : 'Failed to update task');
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right', autoClose: 2000 });
        addNotification({
          _id: `error-complete-${taskId}-${Date.now()}`,
          type: 'error',
          message: errorMessage,
          read: false,
          createdAt: new Date().toLocaleString(language),
          path: '/dashboard',
        });
      }
    },
    [socket, user, isRtl, isConnected, data, language, addNotification, queryClient, timeFilter]
  );

  const sortedPendingOrders = useMemo(() => {
    return (data?.orders || [])
      .filter(
        (order) =>
          ['pending', 'approved', 'in_production'].includes(order.status) &&
          (filter.status === 'all' || order.status === filter.status) &&
          (filter.branch === '' || order.branchId === filter.branch) &&
          (filter.priority === '' || order.priority === filter.priority) &&
          (order.orderNumber.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            order.branchName.toLowerCase().includes(debouncedSearch.toLowerCase()))
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [data?.orders, filter.status, filter.branch, filter.priority, debouncedSearch]);

  const renderStats = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-4"
    >
      {isLoading ? (
        Array(8)
          .fill(null)
          .map((_, i) => <StatsCardSkeleton key={i} isRtl={isRtl} />)
      ) : (
        <>
          <StatsCard
            title={isRtl ? 'إجمالي الطلبات' : 'Total Orders'}
            value={data?.stats.totalOrders.toString() || '0'}
            icon={ShoppingCart}
            color="amber"
            ariaLabel={isRtl ? 'إجمالي الطلبات' : 'Total Orders'}
          />
          <StatsCard
            title={isRtl ? 'الطلبات المعلقة' : 'Pending Orders'}
            value={data?.stats.pendingOrders.toString() || '0'}
            icon={AlertCircle}
            color="yellow"
            ariaLabel={isRtl ? 'الطلبات المعلقة' : 'Pending Orders'}
          />
          <StatsCard
            title={isRtl ? 'الطلبات قيد الإنتاج' : 'In Production'}
            value={data?.stats.inProductionOrders.toString() || '0'}
            icon={BarChart3}
            color="purple"
            ariaLabel={isRtl ? 'الطلبات قيد الإنتاج' : 'In Production'}
          />
          <StatsCard
            title={isRtl ? 'الطلبات قيد النقل' : 'In Transit'}
            value={data?.stats.inTransitOrders.toString() || '0'}
            icon={Package}
            color="blue"
            ariaLabel={isRtl ? 'الطلبات قيد النقل' : 'In Transit'}
          />
          <StatsCard
            title={isRtl ? 'الطلبات المسلمة' : 'Delivered Orders'}
            value={data?.stats.deliveredOrders.toString() || '0'}
            icon={ShoppingCart}
            color="teal"
            ariaLabel={isRtl ? 'الطلبات المسلمة' : 'Delivered Orders'}
          />
          <StatsCard
            title={isRtl ? 'إجمالي المبيعات' : 'Total Sales'}
            value={data?.stats.totalSales.toLocaleString(language, { style: 'currency', currency: 'SAR' }) || '0'}
            icon={DollarSign}
            color="green"
            ariaLabel={isRtl ? 'إجمالي المبيعات' : 'Total Sales'}
          />
          <StatsCard
            title={isRtl ? 'المرتجعات' : 'Returns'}
            value={data?.stats.returns.toString() || '0'}
            icon={AlertCircle}
            color="pink"
            ariaLabel={isRtl ? 'المرتجعات' : 'Returns'}
          />
          <StatsCard
            title={isRtl ? 'متوسط قيمة الطلب' : 'Avg Order Value'}
            value={data?.stats.averageOrderValue.toLocaleString(language, { style: 'currency', currency: 'SAR' }) || '0'}
            icon={DollarSign}
            color="blue"
            ariaLabel={isRtl ? 'متوسط قيمة الطلب' : 'Avg Order Value'}
          />
        </>
      )}
    </motion.div>
  );

  const renderPendingItems = () => (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 mb-4">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-600" />
          {isRtl ? 'أحدث الطلبات المعلقة' : 'Latest Pending Orders'}
        </h3>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-48">
            <Search className={`absolute top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 ${isRtl ? 'right-3' : 'left-3'}`} />
            <input
              type="text"
              value={filter.search}
              onChange={(e) => setFilter((prev) => ({ ...prev, search: e.target.value }))}
              placeholder={isRtl ? 'ابحث حسب رقم الطلب أو الفرع' : 'Search by order number or branch'}
              className={`w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 text-sm ${isRtl ? 'pr-10 pl-4' : ''}`}
              aria-label={isRtl ? 'البحث' : 'Search'}
            />
          </div>
          <select
            value={filter.status}
            onChange={(e) => setFilter((prev) => ({ ...prev, status: e.target.value }))}
            className="w-full sm:w-32 p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 text-sm"
            aria-label={isRtl ? 'حالة الطلب' : 'Order Status'}
          >
            <option value="all">{isRtl ? 'الكل' : 'All'}</option>
            <option value="pending">{isRtl ? 'معلق' : 'Pending'}</option>
            <option value="approved">{isRtl ? 'معتمد' : 'Approved'}</option>
            <option value="in_production">{isRtl ? 'قيد الإنتاج' : 'In Production'}</option>
          </select>
          <select
            value={filter.branch}
            onChange={(e) => setFilter((prev) => ({ ...prev, branch: e.target.value }))}
            className="w-full sm:w-32 p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 text-sm"
            aria-label={isRtl ? 'الفرع' : 'Branch'}
          >
            <option value="">{isRtl ? 'كل الفروع' : 'All Branches'}</option>
            {data?.branches.map((branch: any) => (
              <option key={branch._id} value={branch._id}>
                {branch.name}
              </option>
            ))}
          </select>
          <select
            value={filter.priority}
            onChange={(e) => setFilter((prev) => ({ ...prev, priority: e.target.value }))}
            className="w-full sm:w-32 p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 text-sm"
            aria-label={isRtl ? 'الأولوية' : 'Priority'}
          >
            <option value="">{isRtl ? 'كل الأولويات' : 'All Priorities'}</option>
            <option value="low">{isRtl ? 'منخفض' : 'Low'}</option>
            <option value="medium">{isRtl ? 'متوسط' : 'Medium'}</option>
            <option value="high">{isRtl ? 'عالي' : 'High'}</option>
            <option value="urgent">{isRtl ? 'عاجل' : 'Urgent'}</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {sortedPendingOrders.length === 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-gray-500 text-sm text-center col-span-full"
          >
            {isRtl ? 'لا توجد طلبات معلقة' : 'No pending orders'}
          </motion.p>
        )}
        <AnimatePresence>
          {sortedPendingOrders.map((order, index) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => navigate(`/orders/${order.id}`)}
              className="p-4 bg-gray-50 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors duration-200 shadow-sm"
            >
              <h4 className="font-semibold text-sm text-gray-800 mb-2 truncate">{order.orderNumber} - {order.branchName}</h4>
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  order.status === 'pending'
                    ? 'bg-amber-100 text-amber-800'
                    : order.status === 'approved'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-purple-100 text-purple-800'
                }`}
              >
                {isRtl
                  ? order.status === 'pending'
                    ? 'معلق'
                    : order.status === 'approved'
                    ? 'معتمد'
                    : 'قيد الإنتاج'
                  : order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </span>
              <p className="text-sm text-gray-600 mt-2">
                {isRtl ? 'الإجمالي' : 'Total'}: {order.totalAmount.toLocaleString(language, { style: 'currency', currency: 'SAR' })}
              </p>
              <p className="text-sm text-gray-600">{isRtl ? 'المنتجات' : 'Products'}: {order.items.reduce((sum, item) => sum + item.quantity, 0)}</p>
              <p className="text-sm text-gray-500 mt-2">{isRtl ? 'تاريخ الإنشاء' : 'Created At'}: {order.date}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );

  const renderBranchPerformance = () => (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 mb-4">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
        <BarChart3 className="w-5 h-5 text-gray-600" />
        {isRtl ? 'أداء الفروع' : 'Branch Performance'}
      </h3>
      <div className="space-y-3">
        {data?.branchPerformance.length === 0 ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-gray-500 text-sm text-center"
          >
            {isRtl ? 'لا توجد بيانات' : 'No data available'}
          </motion.p>
        ) : (
          data?.branchPerformance.map((branch: any, index: number) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: isRtl ? -10 : 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="flex items-center gap-3"
            >
              <span className="w-28 text-sm font-medium text-gray-700 truncate">{branch.branchName}</span>
              <div className="flex-1 bg-gray-200 rounded-full h-3">
                <motion.div
                  className="bg-amber-500 h-3 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${branch.performance}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
              <span className="w-20 text-right text-sm text-gray-600">
                {branch.performance.toFixed(0)}% ({branch.completedOrders}/{branch.totalOrders})
              </span>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );

  const renderChefPerformance = () => (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
        <BarChart3 className="w-5 h-5 text-gray-600" />
        {isRtl ? 'أداء الطهاة' : 'Chef Performance'}
      </h3>
      <div className="space-y-3">
        {data?.chefPerformance.length === 0 ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-gray-500 text-sm text-center"
          >
            {isRtl ? 'لا توجد بيانات' : 'No data available'}
          </motion.p>
        ) : (
          data?.chefPerformance.map((chef: any, index: number) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: isRtl ? -10 : 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="flex items-center gap-3"
            >
              <span className="w-28 text-sm font-medium text-gray-700 truncate">{chef.chefName}</span>
              <div className="flex-1 bg-gray-200 rounded-full h-3">
                <motion.div
                  className="bg-green-500 h-3 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${chef.performance}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
              <span className="w-20 text-right text-sm text-gray-600">
                {chef.performance.toFixed(0)}% ({chef.completedTasks}/{chef.totalTasks})
              </span>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );

  const renderContent = () => {
    if (isLoading) {
      return <Loader />;
    }

    if (error) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="p-6 text-center bg-red-50 rounded-xl shadow-md border border-red-200"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <p className="text-red-600 text-lg font-medium">{error.message}</p>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('refreshToken');
              window.location.href = '/login';
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-4 py-2 text-sm shadow-sm transition-colors duration-200"
          >
            {isRtl ? 'تسجيل الدخول' : 'Log In'}
          </button>
        </motion.div>
      );
    }

    switch (user?.role) {
      case 'chef':
        return (
          <div className="space-y-4">
            <div className="flex justify-end mb-4">
              <select
                className="w-full sm:w-36 p-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-amber-500 bg-white"
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                aria-label={isRtl ? 'الفترة الزمنية' : 'Time Period'}
              >
                {timeFilterOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {isRtl ? opt.label : opt.enLabel}
                  </option>
                ))}
              </select>
            </div>
            <ChefDashboard
              stats={data?.stats || {}}
              tasks={data?.tasks || []}
              isRtl={isRtl}
              language={language}
              handleStartTask={handleStartTask}
              handleCompleteTask={handleCompleteTask}
            />
          </div>
        );
      case 'branch':
        return (
          <div className="space-y-4">
            <div className="flex justify-end mb-4">
              <select
                className="w-full sm:w-36 p-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-amber-500 bg-white"
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                aria-label={isRtl ? 'الفترة الزمنية' : 'Time Period'}
              >
                {timeFilterOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {isRtl ? opt.label : opt.enLabel}
                  </option>
                ))}
              </select>
            </div>
            {renderStats()}
            {renderPendingItems()}
          </div>
        );
      default:
        return (
          <div className="space-y-4">
            <div className="flex justify-end mb-4">
              <select
                className="w-full sm:w-36 p-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-amber-500 bg-white"
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                aria-label={isRtl ? 'الفترة الزمنية' : 'Time Period'}
              >
                {timeFilterOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {isRtl ? opt.label : opt.enLabel}
                  </option>
                ))}
              </select>
            </div>
            {renderStats()}
            {renderPendingItems()}
            {['admin'].includes(user?.role) && renderBranchPerformance()}
            {['admin', 'production'].includes(user?.role) && renderChefPerformance()}
          </div>
        );
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 min-h-screen bg-gradient-to-br from-amber-50 to-teal-50" dir={isRtl ? 'rtl' : 'ltr'}>
      {renderContent()}
    </div>
  );
};

export default Dashboard;