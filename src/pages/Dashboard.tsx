import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useNotifications } from '../contexts/NotificationContext';
import { ShoppingCart, Clock, BarChart3, CheckCircle, AlertCircle, Package, DollarSign, ChefHat } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import { ordersAPI, productionAssignmentsAPI, chefsAPI, branchesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';

// تعريف الواجهات
interface Stats {
  totalOrders: number;
  pendingOrders: number;
  inProductionOrders: number;
  inTransitOrders: number;
  deliveredOrders: number;
  totalOrderValue: number;
  completedTasks: number;
  inProgressTasks: number;
  averageOrderValue: number;
}

interface Task {
  id: string;
  orderId: string;
  orderNumber: string;
  productId: string;
  productName: string;
  productNameEn?: string;
  quantity: number;
  unit: string;
  unitEn?: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed';
  branchName: string;
  branchNameEn?: string;
  createdAt: string;
}

interface BranchPerformance {
  branchName: string;
  branchNameEn?: string;
  performance: number;
  totalOrders: number;
  completedOrders: number;
}

interface ChefPerformance {
  chefId: string;
  chefName: string;
  chefNameEn?: string;
  performance: number;
  totalTasks: number;
  completedTasks: number;
}

interface Order {
  id: string;
  orderNumber: string;
  branchName: string;
  branchNameEn?: string;
  branchId: string;
  items: Array<{
    _id: string;
    productId: string;
    productName: string;
    productNameEn?: string;
    quantity: number;
    price: number;
    department: { _id: string; name: string; nameEn?: string };
    assignedTo?: { _id: string; username: string; name: string; nameEn?: string };
    status: 'pending' | 'assigned' | 'in_progress' | 'completed';
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
  nameEn?: string;
  department: { _id: string; name: string; nameEn?: string } | null;
}

interface FilterState {
  status: string;
  search: string;
}

const timeFilterOptions = [
  { value: 'day', label: 'اليوم', enLabel: 'Today' },
  { value: 'week', label: 'هذا الأسبوع', enLabel: 'This Week' },
  { value: 'month', label: 'هذا الشهر', enLabel: 'This Month' },
  { value: 'year', label: 'هذا العام', enLabel: 'This Year' },
];

const Loader: React.FC = () => (
  <div className="flex justify-center items-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-600"></div>
  </div>
);

const StatsCard: React.FC<{ title: string; value: string; icon: React.FC; color: string; ariaLabel: string }> = React.memo(
  ({ title, value, icon: Icon, color, ariaLabel }) => (
    <div
      className={`p-3 bg-gradient-to-r from-${color}-50 to-${color}-100 rounded-lg border border-${color}-200 cursor-pointer hover:bg-${color}-200 transition-colors duration-200`}
      aria-label={ariaLabel}
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 text-${color}-600`} />
        <div>
          <p className="text-xs text-gray-600">{title}</p>
          <p className="text-sm font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  )
);

const ChefDashboard: React.FC<{
  stats: Stats;
  tasks: Task[];
  orders: Order[];
  isRtl: boolean;
  language: string;
  handleStartTask: (taskId: string, orderId: string) => void;
  handleCompleteTask: (taskId: string, orderId: string) => void;
}> = React.memo(({ stats, tasks, orders, isRtl, language, handleStartTask, handleCompleteTask }) => {
  const [filter, setFilter] = useState<FilterState>({ status: 'all', search: '' });
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => filter.status === 'all' || task.status === filter.status)
      .filter(
        (task) =>
          (isRtl ? task.productName : task.productNameEn || task.productName).toLowerCase().includes(filter.search.toLowerCase()) ||
          task.orderNumber.toLowerCase().includes(filter.search.toLowerCase())
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [tasks, filter.status, filter.search, isRtl]);

  const toggleExpandTask = (taskId: string) => {
    setExpandedTaskId(expandedTaskId === taskId ? null : taskId);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
      <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row items-center justify-between mb-3 gap-3">
          <h3 className="text-base font-semibold text-gray-800 flex items-center">
            <ChefHat className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'} text-amber-600`} />
            {isRtl ? 'أحدث الطلبات قيد الإنتاج' : 'Latest In Production'}
          </h3>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={filter.status}
              onChange={(e) => setFilter((prev) => ({ ...prev, status: e.target.value }))}
              className="w-full sm:w-40 p-1.5 rounded-lg border border-gray-200 text-xs focus:ring-2 focus:ring-blue-500 bg-white"
              aria-label={isRtl ? 'حالة المهمة' : 'Task Status'}
            >
              <option value="all">{isRtl ? 'الكل' : 'All'}</option>
              <option value="pending">{isRtl ? 'معلق' : 'Pending'}</option>
              <option value="assigned">{isRtl ? 'معين' : 'Assigned'}</option>
              <option value="in_progress">{isRtl ? 'قيد التنفيذ' : 'In Progress'}</option>
              <option value="completed">{isRtl ? 'مكتمل' : 'Completed'}</option>
            </select>
            <input
              type="text"
              value={filter.search}
              onChange={(e) => setFilter((prev) => ({ ...prev, search: e.target.value }))}
              placeholder={isRtl ? 'ابحث عن اسم المنتج أو رقم الطلب' : 'Search by product name or order number'}
              className="w-full sm:w-40 p-1.5 rounded-lg border border-gray-200 text-xs focus:ring-2 focus:ring-blue-500 bg-white"
              aria-label={isRtl ? 'البحث' : 'Search'}
            />
          </div>
        </div>
        <div className="space-y-2 overflow-y-auto max-h-80">
          <AnimatePresence>
            {filteredTasks.length === 0 ? (
              <p className="text-gray-500 text-xs">{isRtl ? 'لا توجد مهام' : 'No tasks available'}</p>
            ) : (
              filteredTasks.map((task) => {
                const order = orders.find((o) => o.id === task.orderId);
                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="border border-amber-100 rounded-lg p-2 bg-amber-50 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-2 cursor-pointer" onClick={() => toggleExpandTask(task.id)}>
                      <h4 className="font-semibold text-xs text-gray-800 truncate">
                        {isRtl ? `طلب رقم ${task.orderNumber}` : `Order #${task.orderNumber}`}
                      </h4>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
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
                    <p className="text-xs text-gray-600 mb-2 truncate">
                      {`${task.quantity} ${isRtl ? task.productName : task.productNameEn || task.productName} (${isRtl ? task.unit : task.unitEn || task.unit})`}
                    </p>
                    <p className="text-xs text-gray-500 mb-2">{isRtl ? `تم الإنشاء في: ${task.createdAt}` : `Created At: ${task.createdAt}`}</p>
                    <AnimatePresence>
                      {expandedTaskId === task.id && order && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <p className="text-xs text-gray-700 mb-1">{isRtl ? 'تفاصيل الطلب:' : 'Order Details:'}</p>
                          <ul className="text-xs text-gray-600 list-disc pl-4">
                            {order.items.map((item) => (
                              <li key={item._id}>
                                {isRtl
                                  ? `${item.quantity} ${item.productName} (${item.unit})`
                                  : `${item.quantity} ${item.productNameEn || item.productName} (${item.unitEn || item.unit})`}
                              </li>
                            ))}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div className="flex items-center gap-2 mt-2">
                      {(task.status === 'pending' || task.status === 'assigned') && (
                        <button
                          onClick={() => handleStartTask(task.id, task.orderId)}
                          className="bg-amber-600 text-white px-2 py-1 rounded text-xs hover:bg-amber-700 transition-colors duration-200"
                          aria-label={isRtl ? 'بدء المهمة' : 'Start Task'}
                        >
                          {isRtl ? 'بدء' : 'Start'}
                        </button>
                      )}
                      {task.status === 'in_progress' && (
                        <button
                          onClick={() => handleCompleteTask(task.id, task.orderId)}
                          className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700 transition-colors duration-200"
                          aria-label={isRtl ? 'إكمال المهمة' : 'Complete Task'}
                        >
                          {isRtl ? 'إكمال' : 'Complete'}
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
});

export const Dashboard: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const { addNotification, refreshTasks } = useNotifications();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [branches, setBranches] = useState<{ _id: string; name: string; nameEn?: string }[]>([]);
  const [branchPerformance, setBranchPerformance] = useState<BranchPerformance[]>([]);
  const [chefPerformance, setChefPerformance] = useState<ChefPerformance[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    pendingOrders: 0,
    inProductionOrders: 0,
    inTransitOrders: 0,
    deliveredOrders: 0,
    totalOrderValue: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    averageOrderValue: 0,
  });
  const [timeFilter, setTimeFilter] = useState('week');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const cache = useMemo(() => new Map<string, any>(), []);

  const cacheKey = useMemo(() => `${user?.id || user?._id}-${user?.role}-${timeFilter}`, [user, timeFilter]);

  const fetchDashboardData = useCallback(
    debounce(async (forceRefresh = false) => {
      if (!user?.id && !user?._id) {
        const errorMessage = isRtl ? 'الوصول غير مصرح به' : 'Unauthorized access';
        setError(errorMessage);
        setLoading(false);
        toast.error(errorMessage, { toastId: 'auth-error', position: isRtl ? 'top-left' : 'top-right', autoClose: 2000 });
        addNotification({
          _id: `error-noUserId-${Date.now()}`,
          type: 'error',
          message: errorMessage,
          read: false,
          createdAt: new Date().toLocaleString(language),
          path: '/dashboard',
        });
        return;
      }

      if (!forceRefresh && cache.has(cacheKey)) {
        const cachedData = cache.get(cacheKey);
        setOrders(cachedData.orders);
        setTasks(cachedData.tasks);
        setChefs(cachedData.chefs);
        setBranches(cachedData.branches);
        setBranchPerformance(cachedData.branchPerformance);
        setChefPerformance(cachedData.chefPerformance);
        setStats(cachedData.stats);
        setLoading(false);
        setIsInitialLoad(false);
        return;
      }

      setLoading(true);
      try {
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

        const query: Record<string, any> = { startDate: startDate.toISOString(), endDate: now.toISOString(), limit: 20 };
        let ordersResponse: any[] = [];
        let tasksResponse: any[] = [];
        let chefsResponse: any[] = [];
        let branchesResponse: any[] = [];

        if (user.role === 'chef') {
          const chefProfile = await chefsAPI.getByUserId(user.id || user._id);
          const chefId = chefProfile?._id;
          if (!chefId || !/^[0-9a-fA-F]{24}$/.test(chefId)) {
            throw new Error(isRtl ? 'بيانات الشيف غير صالحة' : 'Invalid chef data');
          }
          tasksResponse = await productionAssignmentsAPI.getChefTasks(chefId, { limit: 20 });
        } else {
          if (user.role === 'branch') query.branch = user.id || user._id;
          if (user.role === 'production' && user.department) query.departmentId = user.department._id;
          const promises = [
            ordersAPI.getAll(query).catch(() => []),
            user.role !== 'branch' ? productionAssignmentsAPI.getAllTasks(query).catch(() => []) : Promise.resolve([]),
            ['admin', 'production'].includes(user.role) ? chefsAPI.getAll().catch(() => []) : Promise.resolve([]),
            ['admin', 'production'].includes(user.role) ? branchesAPI.getAll().catch(() => []) : Promise.resolve([]),
          ];
          [ordersResponse, tasksResponse, chefsResponse, branchesResponse] = await Promise.all(promises);
        }

        const mappedOrders = ordersResponse.map((order: any) => ({
          id: order._id || crypto.randomUUID(),
          orderNumber: order.orderNumber || (isRtl ? 'غير معروف' : 'Unknown'),
          branchName: order.branch?.name || (isRtl ? 'فرع غير معروف' : 'Unknown Branch'),
          branchNameEn: order.branch?.nameEn || order.branch?.name || 'Unknown',
          branchId: order.branch?._id || 'unknown',
          items: (order.items || []).map((item: any) => ({
            _id: item._id || crypto.randomUUID(),
            productId: item.product?._id || 'unknown',
            productName: item.product?.name || (isRtl ? 'منتج غير معروف' : 'Unknown Product'),
            productNameEn: item.product?.nameEn || item.product?.name || 'Unknown',
            quantity: Number(item.quantity) || 1,
            price: Number(item.price) || 0,
            department: item.product?.department || { _id: 'unknown', name: isRtl ? 'قسم غير معروف' : 'Unknown Department', nameEn: 'Unknown' },
            status: item.status || 'pending',
            assignedTo: item.assignedTo
              ? { _id: item.assignedTo._id, username: item.assignedTo.username, name: item.assignedTo.name || (isRtl ? 'شيف غير معروف' : 'Unknown Chef'), nameEn: item.assignedTo.nameEn || item.assignedTo.name || 'Unknown' }
              : undefined,
          })),
          status: order.status || 'pending',
          totalAmount: Number(order.totalAmount || order.totalPrice) || 0,
          date: formatDate(order.createdAt || new Date(), language),
          priority: order.priority || 'medium',
          createdBy: order.createdBy?.username || (isRtl ? 'غير معروف' : 'Unknown'),
          createdAt: order.createdAt || new Date().toISOString(),
        }));

        const mappedTasks = tasksResponse.map((task: any) => ({
          id: task._id || crypto.randomUUID(),
          orderId: task.order?._id || 'unknown',
          orderNumber: task.order?.orderNumber || (isRtl ? 'غير معروف' : 'Unknown'),
          productId: task.product?._id || 'unknown',
          productName: task.product?.name || (isRtl ? 'منتج غير معروف' : 'Unknown Product'),
          productNameEn: task.product?.nameEn || task.product?.name || 'Unknown',
          quantity: Number(task.quantity) || 0,
          unit: task.product?.unit || 'unit',
          unitEn: task.product?.unitEn || task.product?.unit || 'unit',
          status: task.status || 'pending',
          branchName: task.order?.branch?.name || (isRtl ? 'فرع غير معروف' : 'Unknown Branch'),
          branchNameEn: task.order?.branch?.nameEn || task.order?.branch?.name || 'Unknown',
          createdAt: formatDate(task.createdAt || new Date(), language),
        }));

        const mappedChefs = chefsResponse.map((chef: any) => ({
          _id: chef._id || crypto.randomUUID(),
          userId: chef.user?._id || chef._id,
          username: chef.user?.username || chef.username || (isRtl ? 'شيف غير معروف' : 'Unknown Chef'),
          name: chef.user?.name || chef.name || (isRtl ? 'شيف غير معروف' : 'Unknown Chef'),
          nameEn: chef.user?.nameEn || chef.name || 'Unknown',
          department: chef.department || null,
        }));

        const mappedBranches = branchesResponse
          .map((branch: any) => ({
            _id: branch._id || crypto.randomUUID(),
            name: branch.name || (isRtl ? 'فرع غير معروف' : 'Unknown Branch'),
            nameEn: branch.nameEn || branch.name || 'Unknown',
          }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name));

        const branchPerf = mappedBranches.map((branch: any) => {
          const branchOrders = mappedOrders.filter((o) => o.branchId === branch._id);
          const total = branchOrders.length;
          const completed = branchOrders.filter((o) => o.status === 'completed' || o.status === 'delivered').length;
          const perf = total > 0 ? (completed / total) * 100 : 0;
          return { branchName: branch.name, branchNameEn: branch.nameEn, performance: perf, totalOrders: total, completedOrders: completed };
        }).filter((b: any) => b.totalOrders > 0);

        const chefPerf = mappedChefs.map((chef: any) => {
          const chefTasks = mappedTasks.filter((task) => {
            const order = mappedOrders.find((o) => o.id === task.orderId);
            const item = order?.items.find((i) => i.productId === task.productId);
            return item?.assignedTo?._id === chef.userId;
          });
          const total = chefTasks.length;
          const completed = chefTasks.filter((t) => t.status === 'completed').length;
          const perf = total > 0 ? (completed / total) * 100 : 0;
          return {
            chefId: chef.userId,
            chefName: chef.name,
            chefNameEn: chef.nameEn,
            performance: perf,
            totalTasks: total,
            completedTasks: completed,
          };
        }).filter((c: any) => c.totalTasks > 0);

        const totalOrders = user.role === 'chef' ? mappedTasks.length : mappedOrders.length;
        const pendingOrders = user.role === 'chef'
          ? mappedTasks.filter((task) => task.status === 'pending' || task.status === 'assigned').length
          : mappedOrders.filter((o) => o.status === 'pending').length;
        const inProductionOrders = mappedOrders.filter((o) => o.status === 'in_production').length;
        const inTransitOrders = mappedOrders.filter((o) => o.status === 'in_transit').length;
        const deliveredOrders = mappedOrders.filter((o) => o.status === 'delivered').length;
        const totalOrderValue = mappedOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
        const completedTasks = mappedTasks.filter((task) => task.status === 'completed').length;
        const inProgressTasks = mappedTasks.filter((task) => task.status === 'in_progress').length;
        const averageOrderValue = totalOrders > 0 ? totalOrderValue / totalOrders : 0;

        const newData = {
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
            totalOrderValue,
            completedTasks,
            inProgressTasks,
            averageOrderValue,
          },
        };

        cache.set(cacheKey, newData);
        setOrders(newData.orders);
        setTasks(newData.tasks);
        setChefs(newData.chefs);
        setBranches(newData.branches);
        setBranchPerformance(newData.branchPerformance);
        setChefPerformance(newData.chefPerformance);
        setStats(newData.stats);
        setError('');
        setIsInitialLoad(false);
      } catch (err: any) {
        const errorMessage = err.status === 403 ? (isRtl ? 'الوصول غير مصرح به' : 'Unauthorized access') : (isRtl ? 'خطأ في الخادم' : 'Server error');
        setError(errorMessage);
        toast.error(errorMessage, { toastId: 'server-error', position: isRtl ? 'top-left' : 'top-right', autoClose: 2000 });
        addNotification({
          _id: `error-fetch-${Date.now()}`,
          type: 'error',
          message: errorMessage,
          read: false,
          createdAt: new Date().toLocaleString(language),
          path: '/dashboard',
        });
      } finally {
        setLoading(false);
      }
    }, 100),
    [user, isRtl, language, cacheKey, addNotification]
  );

  useEffect(() => {
    fetchDashboardData();
    return () => fetchDashboardData.cancel();
  }, [fetchDashboardData, timeFilter]);

  useEffect(() => {
    if (refreshTasks) {
      fetchDashboardData(true);
    }
  }, [refreshTasks, fetchDashboardData]);

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

    socket.on('orderCreated', (data: any) => {
      if (!data.orderId || !data.orderNumber || !data.branchName || !data.eventId) return;
      if (!['admin', 'production', 'branch'].includes(user.role) || (user.role === 'branch' && data.branchId !== user.branchId)) return;

      addNotification({
        _id: data.eventId,
        type: 'info',
        message: isRtl ? `طلب جديد: ${data.orderNumber} - ${data.branchName}` : `New order: ${data.orderNumber} - ${data.branchName}`,
        data: { orderId: data.orderId, eventId: data.eventId },
        read: false,
        createdAt: formatDate(new Date(), language),
        sound: '/sounds/order-created.mp3',
        vibrate: [300, 100, 300],
        path: '/dashboard',
      });
      fetchDashboardData(true);
    });

    socket.on('orderApproved', (data: any) => {
      if (!data.orderId || !data.orderNumber || !data.branchName || !data.eventId) return;
      if (!['admin', 'production', 'branch'].includes(user.role) || (user.role === 'branch' && data.branchId !== user.branchId)) return;

      setOrders((prev) =>
        prev.map((order) => (order.id === data.orderId ? { ...order, status: 'approved' } : order))
      );
      addNotification({
        _id: data.eventId,
        type: 'success',
        message: isRtl ? `تم الموافقة على الطلب ${data.orderNumber} - ${data.branchName}` : `Order approved: ${data.orderNumber} - ${data.branchName}`,
        data: { orderId: data.orderId, eventId: data.eventId },
        read: false,
        createdAt: formatDate(new Date(), language),
        sound: '/sounds/order-approved.mp3',
        vibrate: [200, 100, 200],
        path: '/dashboard',
      });
      fetchDashboardData(true);
    });

    socket.on('orderRejected', (data: any) => {
      if (!data.orderId || !data.orderNumber || !data.branchName || !data.eventId) return;
      if (!['admin', 'production', 'branch'].includes(user.role) || (user.role === 'branch' && data.branchId !== user.branchId)) return;

      setOrders((prev) =>
        prev.map((order) => (order.id === data.orderId ? { ...order, status: 'cancelled' } : order))
      );
      addNotification({
        _id: data.eventId,
        type: 'error',
        message: isRtl ? `تم رفض الطلب ${data.orderNumber} - ${data.branchName}` : `Order rejected: ${data.orderNumber} - ${data.branchName}`,
        data: { orderId: data.orderId, eventId: data.eventId },
        read: false,
        createdAt: formatDate(new Date(), language),
        sound: '/sounds/order-rejected.mp3',
        vibrate: [200, 100, 200],
        path: '/dashboard',
      });
      fetchDashboardData(true);
    });

    socket.on('taskAssigned', (data: any) => {
      if (!data.taskId || !data.orderId || !data.productName || !data.orderNumber || !data.branchName || !data.quantity || !data.eventId) {
        console.warn(`[${new Date().toISOString()}] Invalid task assigned data:`, data);
        return;
      }
      if (!['admin', 'production', 'chef'].includes(user.role) || (user.role === 'chef' && data.chefId !== user._id)) return;

      const notification = {
        _id: data.eventId,
        type: 'info',
        message: isRtl
          ? `تم تعيين مهمة: ${data.productName} (${data.quantity} ${isRtl ? data.unit : data.unitEn || data.unit}) للطلب ${data.orderNumber} - ${data.branchName}`
          : `Task assigned: ${data.productName} (${data.quantity} ${isRtl ? data.unit : data.unitEn || data.unit}) for order ${data.orderNumber} - ${data.branchName}`,
        data: { orderId: data.orderId, taskId: data.taskId, chefId: data.chefId, eventId: data.eventId },
        read: false,
        createdAt: formatDate(new Date(), language),
        sound: '/sounds/task-assigned.mp3',
        vibrate: [400, 100, 400],
        path: '/dashboard',
      };
      addNotification({
        _id: data.eventId,
        type: 'info',
        message: notification.message,
        data: notification.data,
        read: false,
        createdAt: notification.createdAt,
        sound: notification.sound,
        vibrate: notification.vibrate,
        path: notification.path,
      });
      if (user.role === 'chef') {
        setTasks((prev) => [
          {
            id: data.taskId,
            orderId: data.orderId,
            orderNumber: data.orderNumber,
            productId: data.productId || 'unknown',
            productName: data.productName,
            productNameEn: data.productNameEn || data.productName,
            quantity: Number(data.quantity) || 0,
            unit: data.unit || 'unit',
            unitEn: data.unitEn || data.unit || 'unit',
            status: data.status || 'assigned',
            branchName: data.branchName,
            branchNameEn: data.branchNameEn || data.branchName,
            createdAt: formatDate(new Date(), language),
          },
          ...prev.filter((t) => t.id !== data.taskId),
        ]);
      }
      fetchDashboardData(true);
    });

    socket.on('itemStatusUpdated', (data: any) => {
      if (!data.orderId || !data.itemId || !data.status || !data.orderNumber || !data.branchName || !data.productName || !data.eventId) {
        console.warn(`[${new Date().toISOString()}] Invalid item status update data:`, data);
        return;
      }
      if (!['admin', 'production', 'chef'].includes(user.role) || (user.role === 'chef' && data.chefId !== user._id)) return;

      setTasks((prev) =>
        prev.map((task) =>
          task.id === data.itemId && task.orderId === data.orderId ? { ...task, status: data.status } : task
        )
      );
      setOrders((prev) =>
        prev.map((order) =>
          order.id === data.orderId
            ? {
                ...order,
                items: order.items.map((item) =>
                  item._id === data.itemId ? { ...item, status: data.status } : item
                ),
              }
            : order
        )
      );
      addNotification({
        _id: data.eventId,
        type: 'info',
        message: isRtl
          ? `تم تحديث حالة المهمة: ${data.productName} للطلب ${data.orderNumber} إلى ${data.status === 'in_progress' ? 'قيد التنفيذ' : 'مكتمل'}`
          : `Task status updated: ${data.productName} for order ${data.orderNumber} to ${data.status}`,
        data: { orderId: data.orderId, taskId: data.itemId, eventId: data.eventId, chefId: data.chefId },
        read: false,
        createdAt: formatDate(new Date(), language),
        path: '/dashboard',
        sound: '/sounds/task-status-updated.mp3',
        vibrate: [200, 100, 200],
      });
      fetchDashboardData(true);
    });

    socket.on('orderCompleted', (data: any) => {
      if (!data.orderId || !data.orderNumber || !data.branchName || !data.eventId) return;
      if (!['admin', 'production'].includes(user.role)) return;

      setOrders((prev) =>
        prev.map((order) => (order.id === data.orderId ? { ...order, status: 'completed' } : order))
      );
      addNotification({
        _id: data.eventId,
        type: 'success',
        message: isRtl ? `تم إكمال الطلب ${data.orderNumber} - ${data.branchName}` : `Order completed: ${data.orderNumber} - ${data.branchName}`,
        data: { orderId: data.orderId, eventId: data.eventId },
        read: false,
        createdAt: formatDate(new Date(), language),
        sound: '/sounds/order-completed.mp3',
        vibrate: [400, 100, 400],
        path: '/dashboard',
      });
      fetchDashboardData(true);
    });

    socket.on('orderInTransit', (data: any) => {
      if (!data.orderId || !data.orderNumber || !data.branchName || !data.eventId) return;
      if (!['admin', 'production', 'branch'].includes(user.role) || (user.role === 'branch' && data.branchId !== user.branchId)) return;

      setOrders((prev) =>
        prev.map((order) => (order.id === data.orderId ? { ...order, status: 'in_transit' } : order))
      );
      addNotification({
        _id: data.eventId,
        type: 'info',
        message: isRtl ? `الطلب ${data.orderNumber} في الطريق إلى ${data.branchName}` : `Order ${data.orderNumber} is in transit to ${data.branchName}`,
        data: { orderId: data.orderId, eventId: data.eventId },
        read: false,
        createdAt: formatDate(new Date(), language),
        sound: '/sounds/order-in-transit.mp3',
        vibrate: [300, 100, 300],
        path: '/dashboard',
      });
      fetchDashboardData(true);
    });

    socket.on('orderDelivered', (data: any) => {
      if (!data.orderId || !data.orderNumber || !data.branchName || !data.eventId) return;
      if (!['admin', 'production', 'branch'].includes(user.role) || (user.role === 'branch' && data.branchId !== user.branchId)) return;

      setOrders((prev) =>
        prev.map((order) => (order.id === data.orderId ? { ...order, status: 'delivered' } : order))
      );
      addNotification({
        _id: data.eventId,
        type: 'success',
        message: isRtl ? `تم تسليم الطلب ${data.orderNumber} إلى ${data.branchName}` : `Order ${data.orderNumber} delivered to ${data.branchName}`,
        data: { orderId: data.orderId, eventId: data.eventId },
        read: false,
        createdAt: formatDate(new Date(), language),
        sound: '/sounds/order-delivered.mp3',
        vibrate: [400, 100, 400],
        path: '/dashboard',
      });
      fetchDashboardData(true);
    });

    return () => {
      socket.off('connect_error');
      socket.off('orderCreated');
      socket.off('orderApproved');
      socket.off('orderRejected');
      socket.off('taskAssigned');
      socket.off('itemStatusUpdated');
      socket.off('orderCompleted');
      socket.off('orderInTransit');
      socket.off('orderDelivered');
    };
  }, [socket, user, isRtl, language, addNotification, fetchDashboardData, isConnected]);

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
        const task = tasks.find((t) => t.id === taskId);
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: 'in_progress' } : t)));
        setOrders((prev) =>
          prev.map((order) =>
            order.id === orderId
              ? {
                  ...order,
                  items: order.items.map((item) =>
                    item._id === taskId ? { ...item, status: 'in_progress' } : item
                  ),
                }
              : order
          )
        );
        const eventId = crypto.randomUUID();
        socket.emit('itemStatusUpdated', {
          orderId,
          itemId: taskId,
          status: 'in_progress',
          chefId: user?.id || user?._id,
          eventId,
          orderNumber: task?.orderNumber || (isRtl ? 'غير معروف' : 'Unknown'),
          branchName: task?.branchName || (isRtl ? 'فرع غير معروف' : 'Unknown Branch'),
          branchNameEn: task?.branchNameEn || task?.branchName || 'Unknown',
          productName: task?.productName || (isRtl ? 'منتج غير معروف' : 'Unknown Product'),
          productNameEn: task?.productNameEn || task?.productName || 'Unknown',
          quantity: task?.quantity || 0,
          unit: task?.unit || 'unit',
          unitEn: task?.unitEn || task?.unit || 'unit',
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
        toast.error(errorMessage, { toastId: `error-task-${taskId}`, position: isRtl ? 'top-left' : 'top-right', autoClose: 2000 });
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
    [socket, user, isRtl, isConnected, tasks, language, addNotification]
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
        const task = tasks.find((t) => t.id === taskId);
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: 'completed' } : t)));
        setOrders((prev) =>
          prev.map((order) =>
            order.id === orderId
              ? {
                  ...order,
                  items: order.items.map((item) =>
                    item._id === taskId ? { ...item, status: 'completed' } : item
                  ),
                }
              : order
          )
        );
        const eventId = crypto.randomUUID();
        socket.emit('itemStatusUpdated', {
          orderId,
          itemId: taskId,
          status: 'completed',
          chefId: user?.id || user?._id,
          eventId,
          orderNumber: task?.orderNumber || (isRtl ? 'غير معروف' : 'Unknown'),
          branchName: task?.branchName || (isRtl ? 'فرع غير معروف' : 'Unknown Branch'),
          branchNameEn: task?.branchNameEn || task?.branchName || 'Unknown',
          productName: task?.productName || (isRtl ? 'منتج غير معروف' : 'Unknown Product'),
          productNameEn: task?.productNameEn || task?.productName || 'Unknown',
          quantity: task?.quantity || 0,
          unit: task?.unit || 'unit',
          unitEn: task?.unitEn || task?.unit || 'unit',
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
        toast.error(errorMessage, { toastId: `error-complete-${taskId}`, position: isRtl ? 'top-left' : 'top-right', autoClose: 2000 });
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
    [socket, user, isRtl, isConnected, tasks, language, addNotification]
  );

  const sortedPendingOrders = useMemo(() => {
    return [...orders]
      .filter((order) => ['pending', 'approved', 'in_production'].includes(order.status))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [orders]);

  const renderStats = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4"
    >
      <StatsCard
        title={isRtl ? 'إجمالي الطلبات' : 'Total Orders'}
        value={stats.totalOrders.toString()}
        icon={ShoppingCart}
        color="amber"
        ariaLabel={isRtl ? 'إجمالي الطلبات' : 'Total Orders'}
      />
      <StatsCard
        title={isRtl ? 'الطلبات المعلقة' : 'Pending Orders'}
        value={stats.pendingOrders.toString()}
        icon={AlertCircle}
        color="red"
        ariaLabel={isRtl ? 'الطلبات المعلقة' : 'Pending Orders'}
      />
      <StatsCard
        title={isRtl ? 'الطلبات قيد الإنتاج' : 'In Production'}
        value={stats.inProductionOrders.toString()}
        icon={Package}
        color="blue"
        ariaLabel={isRtl ? 'الطلبات قيد الإنتاج' : 'In Production'}
      />
      <StatsCard
        title={isRtl ? 'الطلبات المسلمة' : 'Delivered Orders'}
        value={stats.deliveredOrders.toString()}
        icon={CheckCircle}
        color="green"
        ariaLabel={isRtl ? 'الطلبات المسلمة' : 'Delivered Orders'}
      />
      <StatsCard
        title={isRtl ? 'إجمالي قيمة المخزون' : 'Total Inventory Value'}
        value={stats.totalOrderValue.toFixed(2)}
        icon={DollarSign}
        color="purple"
        ariaLabel={isRtl ? 'إجمالي قيمة المخزون' : 'Total Inventory Value'}
      />
      {['admin', 'production'].includes(user.role) && (
        <>
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
        </>
      )}
    </motion.div>
  );

  const renderBranchPerformance = () => (
    <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 mt-4">
      <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center">
        <BarChart3 className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'} text-amber-600`} />
        {isRtl ? 'أداء الفروع' : 'Branch Performance'}
      </h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        <AnimatePresence>
          {branchPerformance.length === 0 ? (
            <p className="text-gray-500 text-xs">{isRtl ? 'لا توجد بيانات أداء' : 'No performance data available'}</p>
          ) : (
            branchPerformance.map((branch, index) => (
              <motion.div
                key={branch.branchName}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, delay: index * 0.1 }}
                className="flex items-center justify-between p-2 border-b border-gray-100"
              >
                <div>
                  <p className="text-xs font-medium text-gray-800">{isRtl ? branch.branchName : branch.branchNameEn || branch.branchName}</p>
                  <p className="text-xs text-gray-500">
                    {isRtl ? `${branch.totalOrders} طلبات` : `${branch.totalOrders} Orders`} -{' '}
                    {isRtl ? `${branch.completedOrders} مكتمل` : `${branch.completedOrders} Completed`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-amber-600 h-1.5 rounded-full"
                      style={{ width: `${Math.min(branch.performance, 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-600">{branch.performance.toFixed(1)}%</span>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  const renderChefPerformance = () => (
    <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 mt-4">
      <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center">
        <ChefHat className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'} text-amber-600`} />
        {isRtl ? 'أداء الطهاة' : 'Chef Performance'}
      </h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        <AnimatePresence>
          {chefPerformance.length === 0 ? (
            <p className="text-gray-500 text-xs">{isRtl ? 'لا توجد بيانات أداء' : 'No performance data available'}</p>
          ) : (
            chefPerformance.map((chef, index) => (
              <motion.div
                key={chef.chefId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, delay: index * 0.1 }}
                className="flex items-center justify-between p-2 border-b border-gray-100"
              >
                <div>
                  <p className="text-xs font-medium text-gray-800">{isRtl ? chef.chefName : chef.chefNameEn || chef.chefName}</p>
                  <p className="text-xs text-gray-500">
                    {isRtl ? `${chef.totalTasks} مهام` : `${chef.totalTasks} Tasks`} -{' '}
                    {isRtl ? `${chef.completedTasks} مكتمل` : `${chef.completedTasks} Completed`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-amber-600 h-1.5 rounded-full"
                      style={{ width: `${Math.min(chef.performance, 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-600">{chef.performance.toFixed(1)}%</span>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  if (loading && isInitialLoad) return <Loader />;
  if (error) return <div className="text-center text-red-600 p-4">{error}</div>;

  return (
    <div className={`py-6 px-4 mx-auto max-w-7xl`}>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-amber-600" />
          {isRtl ? 'لوحة التحكم' : 'Dashboard'}
        </h1>
        <select
          value={timeFilter}
          onChange={(e) => setTimeFilter(e.target.value)}
          className="p-1.5 rounded-lg border border-gray-200 text-xs focus:ring-2 focus:ring-blue-500 bg-white"
          aria-label={isRtl ? 'تصفية حسب الوقت' : 'Time Filter'}
        >
          {timeFilterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {isRtl ? option.label : option.enLabel}
            </option>
          ))}
        </select>
      </div>
      {user.role === 'chef' ? (
        <ChefDashboard
          stats={stats}
          tasks={tasks}
          orders={orders}
          isRtl={isRtl}
          language={language}
          handleStartTask={handleStartTask}
          handleCompleteTask={handleCompleteTask}
        />
      ) : (
        <>
          {renderStats()}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-3">
              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center">
                  <ShoppingCart className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'} text-amber-600`} />
                  {isRtl ? 'أحدث الطلبات' : 'Latest Orders'}
                </h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  <AnimatePresence>
                    {sortedPendingOrders.length === 0 ? (
                      <p className="text-gray-500 text-xs">{isRtl ? 'لا توجد طلبات' : 'No orders available'}</p>
                    ) : (
                      sortedPendingOrders.map((order) => (
                        <motion.div
                          key={order.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="border border-amber-100 rounded-lg p-2 bg-amber-50 shadow-sm cursor-pointer hover:bg-amber-100 transition-colors duration-200"
                          onClick={() => navigate(`/orders/${order.id}`)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-xs text-gray-800 truncate">
                              {isRtl ? `طلب رقم ${order.orderNumber}` : `Order #${order.orderNumber}`}
                            </h4>
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                                order.status === 'pending'
                                  ? 'bg-amber-100 text-amber-800'
                                  : order.status === 'in_production'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-green-100 text-green-800'
                              }`}
                            >
                              {isRtl
                                ? order.status === 'pending'
                                  ? 'معلق'
                                  : order.status === 'in_production'
                                  ? 'قيد الإنتاج'
                                  : 'مكتمل'
                                : order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mb-2 truncate">{isRtl ? order.branchName : order.branchNameEn || order.branchName}</p>
                          <p className="text-xs text-gray-500">{isRtl ? `تم الإنشاء في: ${order.date}` : `Created At: ${order.date}`}</p>
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
            {['admin', 'production'].includes(user.role) && (
              <>
                {renderBranchPerformance()}
                {renderChefPerformance()}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;