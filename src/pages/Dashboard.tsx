import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useNotifications } from '../contexts/NotificationContext';
import { ShoppingCart, Clock, BarChart3, CheckCircle, AlertCircle, Package, DollarSign, ChefHat, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import { ordersAPI, productionAssignmentsAPI, chefsAPI, branchesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// In-memory cache
const cache = new Map<string, any>();

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
  branchId: string;
  createdAt: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
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
    unit: string;
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
  priority: string;
  branchId: string;
}

const timeFilterOptions = [
  { value: 'day', label: 'اليوم', enLabel: 'Today' },
  { value: 'week', label: 'هذا الأسبوع', enLabel: 'This Week' },
  { value: 'month', label: 'هذا الشهر', enLabel: 'This Month' },
  { value: 'year', label: 'هذا العام', enLabel: 'This Year' },
];

const priorityOptions = [
  { value: 'all', label: 'الكل', enLabel: 'All' },
  { value: 'low', label: 'منخفض', enLabel: 'Low' },
  { value: 'medium', label: 'متوسط', enLabel: 'Medium' },
  { value: 'high', label: 'مرتفع', enLabel: 'High' },
  { value: 'urgent', label: 'عاجل', enLabel: 'Urgent' },
];

// مكون مؤشر التحميل
const Loader: React.FC = () => (
  <div className="flex justify-center items-center h-24">
    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
  </div>
);

// مكون بطاقة الإحصائيات
const StatsCard: React.FC<{ title: string; value: string; icon: React.FC; color: string; ariaLabel: string }> = React.memo(
  ({ title, value, icon: Icon, color, ariaLabel }) => (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={`p-4 bg-${color}-50 rounded-xl border border-${color}-100 shadow-sm hover:bg-${color}-100 transition-colors duration-200`}
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
  branches: { _id: string; name: string }[];
  isRtl: boolean;
  language: string;
  handleStartTask: (taskId: string, orderId: string) => void;
  handleCompleteTask: (taskId: string, orderId: string) => void;
}> = ({ stats, tasks, branches, isRtl, language, handleStartTask, handleCompleteTask }) => {
  const [filter, setFilter] = useState<FilterState>({ status: 'all', search: '', priority: 'all', branchId: 'all' });
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => filter.status === 'all' || task.status === filter.status)
      .filter((task) => filter.priority === 'all' || task.priority === filter.priority)
      .filter((task) => filter.branchId === 'all' || task.branchId === filter.branchId)
      .filter(
        (task) =>
          task.productName.toLowerCase().includes(filter.search.toLowerCase()) ||
          task.orderNumber.toLowerCase().includes(filter.search.toLowerCase())
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [tasks, filter]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title={isRtl ? 'إجمالي الطلبات' : 'Total Orders'}
          value={stats.totalOrders.toString()}
          icon={ShoppingCart}
          color="blue"
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
          color="yellow"
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
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-3">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <ChefHat className={`w-5 h-5 ${isRtl ? 'ml-2' : 'mr-2'} text-amber-600`} />
            {isRtl ? 'أحدث المهام' : 'Latest Tasks'}
          </h3>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <select
              value={filter.status}
              onChange={(e) => setFilter((prev) => ({ ...prev, status: e.target.value }))}
              className="w-full sm:w-40 p-2 rounded-md border border-gray-300 text-sm focus:ring-2 focus:ring-blue-400 bg-white"
              aria-label={isRtl ? 'حالة المهمة' : 'Task Status'}
            >
              <option value="all">{isRtl ? 'الكل' : 'All'}</option>
              <option value="pending">{isRtl ? 'معلق' : 'Pending'}</option>
              <option value="assigned">{isRtl ? 'معين' : 'Assigned'}</option>
              <option value="in_progress">{isRtl ? 'قيد التنفيذ' : 'In Progress'}</option>
              <option value="completed">{isRtl ? 'مكتمل' : 'Completed'}</option>
            </select>
            <select
              value={filter.priority}
              onChange={(e) => setFilter((prev) => ({ ...prev, priority: e.target.value }))}
              className="w-full sm:w-40 p-2 rounded-md border border-gray-300 text-sm focus:ring-2 focus:ring-blue-400 bg-white"
              aria-label={isRtl ? 'الأولوية' : 'Priority'}
            >
              {priorityOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {isRtl ? opt.label : opt.enLabel}
                </option>
              ))}
            </select>
            <select
              value={filter.branchId}
              onChange={(e) => setFilter((prev) => ({ ...prev, branchId: e.target.value }))}
              className="w-full sm:w-40 p-2 rounded-md border border-gray-300 text-sm focus:ring-2 focus:ring-blue-400 bg-white"
              aria-label={isRtl ? 'الفرع' : 'Branch'}
            >
              <option value="all">{isRtl ? 'كل الفروع' : 'All Branches'}</option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={filter.search}
              onChange={(e) => setFilter((prev) => ({ ...prev, search: e.target.value }))}
              placeholder={isRtl ? 'البحث' : 'Search'}
              className="w-full sm:w-40 p-2 rounded-md border border-gray-300 text-sm focus:ring-2 focus:ring-blue-400 bg-white"
              aria-label={isRtl ? 'البحث' : 'Search'}
            />
          </div>
        </div>
        {isLoadingTasks ? (
          <Loader />
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            <AnimatePresence>
              {filteredTasks.length === 0 ? (
                <p className="text-gray-500 text-sm">{isRtl ? 'لا توجد مهام' : 'No tasks available'}</p>
              ) : (
                filteredTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="border border-amber-200 rounded-lg p-3 bg-amber-50 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm text-gray-800 truncate">
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
                    <p className="text-sm text-gray-600 mb-1 truncate">{`${task.quantity} ${task.unit} ${task.productName}`}</p>
                    <p className="text-xs text-gray-500 mb-1">{isRtl ? `الفرع: ${task.branchName}` : `Branch: ${task.branchName}`}</p>
                    <p className="text-xs text-gray-500 mb-2">
                      {isRtl ? `الأولوية: ${priorityOptions.find((opt) => opt.value === task.priority)?.label || 'متوسط'}` : `Priority: ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}`}
                    </p>
                    <p className="text-xs text-gray-500 mb-2">{isRtl ? `تم الإنشاء في: ${task.createdAt}` : `Created At: ${task.createdAt}`}</p>
                    <div className="flex items-center gap-2">
                      {(task.status === 'pending' || task.status === 'assigned') && (
                        <button
                          onClick={() => handleStartTask(task.id, task.orderId)}
                          className="bg-blue-500 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-600 transition-colors"
                          aria-label={isRtl ? 'بدء المهمة' : 'Start Task'}
                        >
                          {isRtl ? 'بدء' : 'Start'}
                        </button>
                      )}
                      {task.status === 'in_progress' && (
                        <button
                          onClick={() => handleCompleteTask(task.id, task.orderId)}
                          className="bg-green-500 text-white px-3 py-1.5 rounded text-sm hover:bg-green-600 transition-colors"
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
        )}
      </div>
    </div>
  );
};

// مكون لوحة التحكم الرئيسية
export const Dashboard: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [branches, setBranches] = useState<{ _id: string; name: string }[]>([]);
  const [branchPerformance, setBranchPerformance] = useState<BranchPerformance[]>([]);
  const [chefPerformance, setChefPerformance] = useState<ChefPerformance[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    pendingOrders: 0,
    inProductionOrders: 0,
    inTransitOrders: 0,
    deliveredOrders: 0,
    totalSales: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    returns: 0,
    averageOrderValue: 0,
  });
  const [timeFilter, setTimeFilter] = useState('week');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const cacheKey = useMemo(() => `${user?.id || user?._id}-${user?.role}-${timeFilter}`, [user, timeFilter]);

  const fetchOrderDetails = useCallback(async (orderId: string) => {
    try {
      const order = await ordersAPI.getById(orderId);
      if (!order || !order._id) {
        console.error(`[${new Date().toISOString()}] Failed to fetch order:`, orderId);
        return null;
      }
      return order;
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Failed to fetch order:`, err);
      return null;
    }
  }, []);

  const fetchDashboardData = useCallback(
    debounce(async (forceRefresh = false) => {
      if (!user?.id && !user?._id) {
        const errorMessage = isRtl ? 'الوصول غير مصرح به' : 'Unauthorized access';
        setError(errorMessage);
        setLoading(false);
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right', autoClose: 2000 });
        addNotification({
          _id: `error-noUserId-${Date.now()}`,
          type: 'error',
          message: errorMessage,
          read: false,
          createdAt: formatDate(new Date(), language),
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

        const query: Record<string, any> = { startDate: startDate.toISOString(), endDate: now.toISOString(), limit: 50 };
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
          tasksResponse = await productionAssignmentsAPI.getChefTasks(chefId, { limit: 50 });
        } else {
          if (user.role === 'branch') query.branch = user.id || user._id;
          if (user.role === 'production' && user.department) query.departmentId = user.department._id;
          [ordersResponse, tasksResponse, chefsResponse, branchesResponse] = await Promise.all([
            ordersAPI.getAll(query).catch(() => []),
            productionAssignmentsAPI.getAllTasks(query).catch(() => []),
            ['admin', 'production'].includes(user.role) ? chefsAPI.getAll().catch(() => []) : Promise.resolve([]),
            ['admin', 'production'].includes(user.role) ? branchesAPI.getAll().catch(() => []) : Promise.resolve([]),
          ]);
        }

        const mappedOrders = ordersResponse.map((order: any) => ({
          id: order._id || crypto.randomUUID(),
          orderNumber: order.orderNumber || (isRtl ? 'غير معروف' : 'Unknown'),
          branchName: order.branch?.name || (isRtl ? 'فرع غير معروف' : 'Unknown Branch'),
          branchId: order.branch?._id || 'unknown',
          items: (order.items || []).map((item: any) => ({
            _id: item._id || crypto.randomUUID(),
            productId: item.product?._id || 'unknown',
            productName: item.product?.name || (isRtl ? 'منتج غير معروف' : 'Unknown Product'),
            quantity: Number(item.quantity) || 1,
            price: Number(item.price) || 0,
            unit: item.unit || (isRtl ? 'وحدة' : 'unit'),
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
          unit: task.product?.unit || (isRtl ? 'وحدة' : 'unit'),
          status: task.status || 'pending',
          branchName: task.order?.branch?.name || (isRtl ? 'فرع غير معروف' : 'Unknown Branch'),
          branchId: task.order?.branch?._id || 'unknown',
          createdAt: formatDate(task.createdAt || new Date(), language),
          priority: task.order?.priority || 'medium',
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
            name: branch.name || (isRtl ? 'فرع غير معروف' : 'Unknown Branch'),
          }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name, language));

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
            totalSales,
            completedTasks,
            inProgressTasks,
            returns,
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
      } catch (err: any) {
        const errorMessage = err.status === 403 ? (isRtl ? 'الوصول غير مصرح به' : 'Unauthorized access') : (isRtl ? 'خطأ في الخادم' : 'Server error');
        setError(errorMessage);
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right', autoClose: 2000 });
        addNotification({
          _id: `error-fetch-${Date.now()}`,
          type: 'error',
          message: errorMessage,
          read: false,
          createdAt: formatDate(new Date(), language),
        });
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    }, 300),
    [user, isRtl, language, cacheKey, addNotification, fetchOrderDetails]
  );

  useEffect(() => {
    fetchDashboardData();
    return () => fetchDashboardData.cancel();
  }, [fetchDashboardData, timeFilter]);

  useEffect(() => {
    if (!socket || !user || !isConnected) return;

    socket.emit('joinRoom', {
      role: user.role,
      branchId: user.branchId,
      chefId: user.role === 'chef' ? user._id : undefined,
      departmentId: user.role === 'production' ? user.department?._id : undefined,
      userId: user._id,
    });

    socket.on('connect_error', () => {
      const errorMessage = isRtl ? 'خطأ في الاتصال بالسوكت' : 'Socket connection error';
      addNotification({
        _id: `socket-error-${Date.now()}`,
        type: 'error',
        message: errorMessage,
        read: false,
        createdAt: formatDate(new Date(), language),
      });
    });

    socket.on('taskAssigned', async (data: any) => {
      if (!data.taskId || !data.orderId || !data.eventId) {
        console.warn(`[${new Date().toISOString()}] Invalid task assigned data:`, data);
        return;
      }

      if (data.chefId !== (user?.id || user?._id) && !['admin', 'production'].includes(user.role)) return;

      let orderNumber = data.orderNumber;
      let branchName = data.branchName;
      let branchId = data.branchId;
      let productName = data.productName;
      let quantity = Number(data.quantity) || 0;
      let unit = data.unit || (isRtl ? 'وحدة' : 'unit');
      let priority = data.priority || 'medium';

      if (!orderNumber || !branchName || !branchId || !productName) {
        const order = await fetchOrderDetails(data.orderId);
        if (!order) return;
        orderNumber = orderNumber || order.orderNumber || (isRtl ? 'غير معروف' : 'Unknown');
        branchName = branchName || order.branch?.name || (isRtl ? 'فرع غير معروف' : 'Unknown Branch');
        branchId = branchId || order.branch?._id || 'unknown';
        const item = order.items.find((i: any) => i._id === data.taskId);
        productName = productName || item?.product?.name || (isRtl ? 'منتج غير معروف' : 'Unknown Product');
        quantity = quantity || Number(item?.quantity) || 0;
        unit = unit || item?.unit || (isRtl ? 'وحدة' : 'unit');
        priority = priority || order.priority || 'medium';
      }

      fetchDashboardData(true);
      const notification = {
        _id: data.taskId,
        type: 'info' as const,
        message: isRtl
          ? `تم تعيين مهمة: ${productName} (${quantity} ${unit}) للطلب ${orderNumber} - ${branchName}`
          : `Task assigned: ${productName} (${quantity} ${unit}) for order ${orderNumber} - ${branchName}`,
        data: {
          orderId: data.orderId,
          taskId: data.taskId,
          chefId: data.chefId,
          eventId: data.eventId,
          orderNumber,
          branchName,
          productName,
          quantity,
          unit,
        },
        read: false,
        createdAt: formatDate(new Date(), language),
        sound: '/sounds/task-assigned.mp3',
        vibrate: [400, 100, 400],
      };
      addNotification(notification);
      if (user.role === 'chef') {
        setTasks((prev) => [
          {
            id: data.taskId,
            orderId: data.orderId,
            orderNumber,
            productName,
            quantity,
            unit,
            status: data.status || 'assigned',
            branchName,
            branchId,
            createdAt: formatDate(new Date(), language),
            priority,
          },
          ...prev.filter((t) => t.id !== data.taskId),
        ].slice(0, 50));
      }
    });

    socket.on('orderCompleted', (data: any) => {
      if (!data.orderId || !data.eventId) return;

      if (['admin', 'branch', 'production'].includes(user.role)) {
        fetchDashboardData(true);
        addNotification({
          _id: data._id || crypto.randomUUID(),
          type: 'success' as const,
          message: isRtl ? `تم إكمال الطلب ${data.orderNumber} - ${data.branchName}` : `Order completed: ${data.orderNumber} - ${data.branchName}`,
          data: {
            orderId: data.orderId,
            eventId: data.eventId,
            orderNumber: data.orderNumber,
            branchName: data.branchName,
          },
          read: false,
          createdAt: formatDate(new Date(), language),
          sound: '/sounds/order-completed.mp3',
          vibrate: [400, 100, 400],
        });
      }
    });

    socket.on('itemStatusUpdated', async (data: any) => {
      if (!data.orderId || !data.itemId || !data.status || !data.eventId) return;

      if (data.chefId !== (user?.id || user?._id) && !['admin', 'production'].includes(user.role)) return;

      let orderNumber = data.orderNumber;
      let branchName = data.branchName;
      let productName = data.productName;
      let quantity = Number(data.quantity) || 0;
      let unit = data.unit || (isRtl ? 'وحدة' : 'unit');

      if (!orderNumber || !branchName || !productName) {
        const order = await fetchOrderDetails(data.orderId);
        if (!order) return;
        orderNumber = orderNumber || order.orderNumber || (isRtl ? 'غير معروف' : 'Unknown');
        branchName = branchName || order.branch?.name || (isRtl ? 'فرع غير معروف' : 'Unknown Branch');
        const item = order.items.find((i: any) => i._id === data.itemId);
        productName = productName || item?.product?.name || (isRtl ? 'منتج غير معروف' : 'Unknown Product');
        quantity = quantity || Number(item?.quantity) || 0;
        unit = unit || item?.unit || (isRtl ? 'وحدة' : 'unit');
      }

      setTasks((prev) =>
        prev.map((task) =>
          task.id === data.itemId && task.orderId === data.orderId ? { ...task, status: data.status } : task
        )
      );
      addNotification({
        _id: data.eventId,
        type: 'info',
        message: isRtl
          ? `تم تحديث حالة المهمة: ${productName} (${quantity} ${unit}) للطلب ${orderNumber} إلى ${data.status === 'in_progress' ? 'قيد التنفيذ' : 'مكتمل'}`
          : `Task status updated: ${productName} (${quantity} ${unit}) for order ${orderNumber} to ${data.status}`,
        data: {
          orderId: data.orderId,
          itemId: data.itemId,
          eventId: data.eventId,
          orderNumber,
          branchName,
          productName,
          quantity,
          unit,
        },
        read: false,
        createdAt: formatDate(new Date(), language),
      });
    });

    return () => {
      socket.off('connect_error');
      socket.off('taskAssigned');
      socket.off('orderCompleted');
      socket.off('itemStatusUpdated');
    };
  }, [socket, user, isRtl, language, isConnected, addNotification, fetchDashboardData, fetchOrderDetails]);

  const handleStartTask = useCallback(
    async (taskId: string, orderId: string) => {
      if (!isConnected) {
        addNotification({
          _id: `warn-socket-${Date.now()}`,
          type: 'warning',
          message: isRtl ? 'الاتصال بالسوكت غير متاح' : 'Socket disconnected',
          read: false,
          createdAt: formatDate(new Date(), language),
        });
        return;
      }

      try {
        await productionAssignmentsAPI.updateTaskStatus(orderId, taskId, { status: 'in_progress' });
        setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, status: 'in_progress' } : task)));
        const task = tasks.find((t) => t.id === taskId);
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
          unit: task?.unit || (isRtl ? 'وحدة' : 'unit'),
        });
        addNotification({
          _id: `success-task-${taskId}-${Date.now()}`,
          type: 'success',
          message: isRtl ? 'تم بدء المهمة' : 'Task started',
          read: false,
          createdAt: formatDate(new Date(), language),
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
          createdAt: formatDate(new Date(), language),
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
          createdAt: formatDate(new Date(), language),
        });
        return;
      }

      try {
        await productionAssignmentsAPI.updateTaskStatus(orderId, taskId, { status: 'completed' });
        setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, status: 'completed' } : task)));
        const task = tasks.find((t) => t.id === taskId);
        const eventId = crypto.randomUUID();
        socket.emit('itemStatusUpdated', {
          orderId,
          itemId: taskId,
          status: 'completed',
          chefId: user?.id || user?._id,
          eventId,
          orderNumber: task?.orderNumber || (isRtl ? 'غير معروف' : 'Unknown'),
          branchName: task?.branchName || (isRtl ? 'فرع غير معروف' : 'Unknown Branch'),
          productName: task?.productName || (isRtl ? 'منتج غير معروف' : 'Unknown Product'),
          quantity: task?.quantity || 0,
          unit: task?.unit || (isRtl ? 'وحدة' : 'unit'),
        });
        addNotification({
          _id: `success-complete-${taskId}-${Date.now()}`,
          type: 'success',
          message: isRtl ? 'تم إكمال المهمة' : 'Task completed',
          read: false,
          createdAt: formatDate(new Date(), language),
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
          createdAt: formatDate(new Date(), language),
        });
      }
    },
    [socket, user, isRtl, isConnected, tasks, language, addNotification]
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchDashboardData(true);
  }, [fetchDashboardData]);

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
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4"
    >
      <StatsCard
        title={isRtl ? 'إجمالي الطلبات' : 'Total Orders'}
        value={stats.totalOrders.toString()}
        icon={ShoppingCart}
        color="blue"
        ariaLabel={isRtl ? 'إجمالي الطلبات' : 'Total Orders'}
      />
      <StatsCard
        title={isRtl ? 'الطلبات المعلقة' : 'Pending Orders'}
        value={stats.pendingOrders.toString()}
        icon={AlertCircle}
        color="yellow"
        ariaLabel={isRtl ? 'الطلبات المعلقة' : 'Pending Orders'}
      />
      <StatsCard
        title={isRtl ? 'الطلبات قيد الإنتاج' : 'In Production'}
        value={stats.inProductionOrders.toString()}
        icon={BarChart3}
        color="purple"
        ariaLabel={isRtl ? 'الطلبات قيد الإنتاج' : 'In Production'}
      />
      <StatsCard
        title={isRtl ? 'الطلبات قيد النقل' : 'In Transit'}
        value={stats.inTransitOrders.toString()}
        icon={Package}
        color="blue"
        ariaLabel={isRtl ? 'الطلبات قيد النقل' : 'In Transit'}
      />
      <StatsCard
        title={isRtl ? 'الطلبات المسلمة' : 'Delivered Orders'}
        value={stats.deliveredOrders.toString()}
        icon={ShoppingCart}
        color="teal"
        ariaLabel={isRtl ? 'الطلبات المسلمة' : 'Delivered Orders'}
      />
      <StatsCard
        title={isRtl ? 'إجمالي المبيعات' : 'Total Sales'}
        value={stats.totalSales.toLocaleString(language, { style: 'currency', currency: 'SAR' })}
        icon={DollarSign}
        color="green"
        ariaLabel={isRtl ? 'إجمالي المبيعات' : 'Total Sales'}
      />
      <StatsCard
        title={isRtl ? 'المرتجعات' : 'Returns'}
        value={stats.returns.toString()}
        icon={AlertCircle}
        color="pink"
        ariaLabel={isRtl ? 'المرتجعات' : 'Returns'}
      />
      <StatsCard
        title={isRtl ? 'متوسط قيمة الطلب' : 'Avg Order Value'}
        value={stats.averageOrderValue.toLocaleString(language, { style: 'currency', currency: 'SAR' })}
        icon={DollarSign}
        color="blue"
        ariaLabel={isRtl ? 'متوسط قيمة الطلب' : 'Avg Order Value'}
      />
    </motion.div>
  );

  const renderPendingItems = () => (
    <div className="bg-white p-4 rounded-xl shadow-sm mb-4 border border-gray-200">
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-gray-800">
        <Clock className="w-5 h-5 text-gray-600" />
        {isRtl ? 'أحدث الطلبات المعلقة' : 'Latest Pending Orders'}
      </h3>
      {loading ? (
        <Loader />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {sortedPendingOrders.length === 0 && (
            <p className="text-center text-gray-600 col-span-full text-sm">{isRtl ? 'لا توجد طلبات معلقة' : 'No pending orders'}</p>
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
                className="p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <h4 className="font-medium text-sm text-gray-800 mb-1 truncate">{order.orderNumber} - {order.branchName}</h4>
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
                <p className="text-sm text-gray-600 mt-1">
                  {isRtl ? 'الإجمالي' : 'Total'}: {order.totalAmount.toLocaleString(language, { style: 'currency', currency: 'SAR' })}
                </p>
                <p className="text-sm text-gray-600">{isRtl ? 'المنتجات' : 'Products'}: {order.items.reduce((sum, item) => sum + item.quantity, 0)}</p>
                <p className="text-xs text-gray-500 mt-1">{isRtl ? 'تاريخ الإنشاء' : 'Created At'}: {order.date}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );

  const renderBranchPerformance = () => (
    <div className="bg-white p-4 rounded-xl shadow-sm mb-4 border border-gray-200">
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-gray-800">
        <BarChart3 className="w-5 h-5 text-gray-600" />
        {isRtl ? 'أداء الفروع' : 'Branch Performance'}
      </h3>
      {loading ? (
        <Loader />
      ) : (
        <>
          <div className="h-64 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={branchPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="branchName" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => `${value.toFixed(0)}%`} />
                <Line type="monotone" dataKey="performance" stroke="#3B82F6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {branchPerformance.map((branch, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="w-24 text-sm font-medium text-gray-700 truncate">{branch.branchName}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                  <motion.div
                    className="bg-blue-500 h-2.5 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${branch.performance}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
                <span className="w-20 text-right text-sm text-gray-600">
                  {branch.performance.toFixed(0)}% ({branch.completedOrders}/{branch.totalOrders})
                </span>
              </div>
            ))}
            {branchPerformance.length === 0 && <p className="text-center text-gray-600 text-sm">{isRtl ? 'لا توجد بيانات' : 'No data available'}</p>}
          </div>
        </>
      )}
    </div>
  );

  const renderChefPerformance = () => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-gray-800">
        <BarChart3 className="w-5 h-5 text-gray-600" />
        {isRtl ? 'أداء الطهاة' : 'Chef Performance'}
      </h3>
      {loading ? (
        <Loader />
      ) : (
        <>
          <div className="h-64 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chefPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="chefName" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => `${value.toFixed(0)}%`} />
                <Line type="monotone" dataKey="performance" stroke="#10B981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {chefPerformance.map((chef, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="w-24 text-sm font-medium text-gray-700 truncate">{chef.chefName}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                  <motion.div
                    className="bg-green-500 h-2.5 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${chef.performance}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
                <span className="w-20 text-right text-sm text-gray-600">
                  {chef.performance.toFixed(0)}% ({chef.completedTasks}/{chef.totalTasks})
                </span>
              </div>
            ))}
            {chefPerformance.length === 0 && <p className="text-center text-gray-600 text-sm">{isRtl ? 'لا توجد بيانات' : 'No data available'}</p>}
          </div>
        </>
      )}
    </div>
  );

  const renderContent = () => {
    if (loading && !isRefreshing) {
      return (
        <div className="flex justify-center items-center h-screen">
          <Loader />
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-4 text-center bg-red-50 rounded-xl shadow-sm border border-red-200">
          <div className="flex items-center justify-center gap-2 mb-4">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <p className="text-red-600 text-lg font-medium">{error}</p>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('refreshToken');
              window.location.href = '/login';
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm shadow-sm transition-colors"
          >
            {isRtl ? 'تسجيل الخروج' : 'Log Out'}
          </button>
        </div>
      );
    }

    switch (user?.role) {
      case 'chef':
        return (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
              <h2 className="text-xl font-bold text-gray-800">{isRtl ? 'لوحة تحكم الشيف' : 'Chef Dashboard'}</h2>
              <div className="flex items-center gap-3">
                <select
                  className="w-full sm:w-40 p-2 rounded-md border border-blue-300 text-sm focus:ring-2 focus:ring-blue-400 bg-white"
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
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isRefreshing ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                  aria-label={isRtl ? 'تحديث البيانات' : 'Refresh Data'}
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRtl ? 'تحديث' : 'Refresh'}
                </button>
              </div>
            </div>
            <ChefDashboard
              stats={stats}
              tasks={tasks}
              branches={branches}
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
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
              <h2 className="text-xl font-bold text-gray-800">{isRtl ? 'لوحة تحكم الفرع' : 'Branch Dashboard'}</h2>
              <div className="flex items-center gap-3">
                <select
                  className="w-full sm:w-40 p-2 rounded-md border border-blue-300 text-sm focus:ring-2 focus:ring-blue-400 bg-white"
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
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isRefreshing ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                  aria-label={isRtl ? 'تحديث البيانات' : 'Refresh Data'}
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRtl ? 'تحديث' : 'Refresh'}
                </button>
              </div>
            </div>
            {renderStats()}
            {renderPendingItems()}
          </div>
        );
      default:
        return (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
              <h2 className="text-xl font-bold text-gray-800">{isRtl ? 'لوحة التحكم الرئيسية' : 'Main Dashboard'}</h2>
              <div className="flex items-center gap-3">
                <select
                  className="w-full sm:w-40 p-2 rounded-md border border-blue-300 text-sm focus:ring-2 focus:ring-blue-400 bg-white"
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
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isRefreshing ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                  aria-label={isRtl ? 'تحديث البيانات' : 'Refresh Data'}
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRtl ? 'تحديث' : 'Refresh'}
                </button>
              </div>
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
    <div className="mx-auto px-4 sm:px-6 lg:px-8 py-4 min-h-screen" dir={isRtl ? 'rtl' : 'ltr'}>
      {renderContent()}
    </div>
  );
};

export default Dashboard;