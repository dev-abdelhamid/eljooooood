import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useNotifications } from '../contexts/NotificationContext';
import { 
  ShoppingCart, 
  Clock, 
  BarChart3, 
  CheckCircle, 
  AlertCircle, 
  Package, 
  DollarSign, 
  ChefHat, 
  RotateCcw, 
  Timer, 
  Users,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Package2,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import { 
  ordersAPI, 
  productionAssignmentsAPI, 
  chefsAPI, 
  branchesAPI, 
  returnsAPI, 
  inventoryAPI 
} from '../services/api';
import { formatDate } from '../utils/formatDate';
import { ProductSearchInput, ProductDropdown } from './NewOrder';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';

// ========================================
// INTERFACES - كاملة ومفصلة
// ========================================
interface Stats {
  totalOrders: number;
  pendingOrders: number;
  inProductionOrders: number;
  inTransitOrders: number;
  deliveredOrders: number;
  totalOrderValue: number;
  completedTasks: number;
  inProgressTasks: number;
  totalReturns: number;
  pendingReturns: number;
  approvedReturns: number;
  rejectedReturns: number;
  averageOrderValue: number;
  totalInventoryValue?: number;
  lowStockItems?: number;
  averageProductionTime?: number;
  chefUtilizationRate?: number;
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
  branchId: string;
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
    returnedQuantity?: number;
    returnReason?: string;
    returnReasonEn?: string;
  }>;
  status: 'pending' | 'approved' | 'in_production' | 'completed' | 'in_transit' | 'delivered' | 'cancelled';
  totalAmount: number;
  date: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdBy: string;
  createdAt: string;
}

interface Return {
  id: string;
  returnNumber: string;
  branchName: string;
  branchNameEn?: string;
  branchId: string;
  items: Array<{
    productId: string;
    productName: string;
    productNameEn?: string;
    quantity: number;
    reason: string;
    reasonEn?: string;
  }>;
  status: 'pending_approval' | 'approved' | 'rejected';
  createdByName: string;
  createdByNameEn?: string;
  reviewNotes?: string;
  reviewNotesEn?: string;
  createdAt: string;
}

interface Chef {
  _id: string;
  userId: string;
  username: string;
  name: string;
  nameEn?: string;
  department: Array<{ _id: string; name: string; nameEn?: string }> | null;
}

interface InventoryItem {
  _id: string;
  product: {
    _id: string;
    name: string;
    nameEn: string;
    code: string;
    unit: string;
    unitEn: string;
    department: { _id: string; name: string; nameEn: string } | null;
    displayName: string;
    displayUnit: string;
    price: number;
  } | null;
  branch: { _id: string; name: string; nameEn: string; displayName: string } | null;
  currentStock: number;
  pendingReturnStock: number;
  damagedStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  status: 'low' | 'normal' | 'full';
}

interface ProductHistoryEntry {
  _id: string;
  date: string;
  type: 'delivery' | 'return_pending' | 'return_rejected' | 'return_approved' | 'sale' | 'adjustment';
  quantity: number;
  description: string;
  productName?: string;
  productNameEn?: string;
}

interface FilterState {
  search: string;
}

// ========================================
// خيارات الفلترة
// ========================================
const timeFilterOptions = [
  { value: 'day', label: 'اليوم', enLabel: 'Today' },
  { value: 'week', label: 'هذا الأسبوع', enLabel: 'This Week' },
  { value: 'month', label: 'هذا الشهر', enLabel: 'This Month' },
  { value: 'year', label: 'هذا العام', enLabel: 'This Year' },
];

// ========================================
// LOADER مع LoadingSpinner
// ========================================
const Loader: React.FC = () => (
  <div className="flex justify-center items-center h-screen bg-gradient-to-br from-amber-50 to-yellow-50">
    <div className="text-center">
      <LoadingSpinner size="large" />
      <p className="mt-4 text-sm font-medium text-amber-700">جاري تحميل لوحة التحكم...</p>
    </div>
  </div>
);

// ========================================
// STATS CARD
// ========================================
const StatsCard: React.FC<{ 
  title: string; 
  value: string; 
  icon: React.FC<any>; 
  color: string; 
  ariaLabel: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}> = React.memo(({ 
  title, 
  value, 
  icon: Icon, 
  color, 
  ariaLabel,
  trend,
  trendValue
}) => (
  <motion.div
    whileHover={{ scale: 1.03, y: -2 }}
    className={`relative p-4 bg-gradient-to-br from-${color}-50 via-${color}-50 to-${color}-100 rounded-xl border border-${color}-200 cursor-pointer hover:shadow-lg transition-all duration-300 shadow-md overflow-hidden`}
    aria-label={ariaLabel}
  >
    <div className="absolute inset-0 bg-gradient-to-tr from-white/50 to-transparent opacity-70"></div>
    <div className="relative z-10 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-${color}-100`}>
          <Icon className={`w-6 h-6 text-${color}-600`} />
        </div>
        <div>
          <p className="text-xs text-gray-600 font-medium leading-tight">{title}</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-bold ${
          trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'
        }`}>
          {trend === 'up' && <TrendingUp className="w-4 h-4" />}
          {trend === 'down' && <TrendingDown className="w-4 h-4" />}
          {trend === 'neutral' && <RefreshCw className="w-4 h-4" />}
          <span>{trendValue}</span>
        </div>
      )}
    </div>
  </motion.div>
));

// ========================================
// CHEF DASHBOARD - كامل ومُحسّن
// ========================================
const ChefDashboard: React.FC<{
  stats: Stats;
  tasks: Task[];
  isRtl: boolean;
  language: string;
  handleStartTask: (taskId: string, orderId: string) => void;
  handleCompleteTask: (taskId: string, orderId: string) => void;
}> = React.memo(({ stats, tasks, isRtl, language, handleStartTask, handleCompleteTask }) => {
  const [filter, setFilter] = useState<FilterState>({ search: '' });
  
  const filteredTasks = useMemo(() => {
    const searchTerm = filter.search.toLowerCase();
    return tasks
      .filter((task) => {
        const productName = isRtl ? task.productName : (task.productNameEn || task.productName);
        const orderNumber = task.orderNumber.toLowerCase();
        return productName?.toLowerCase().includes(searchTerm) || 
               orderNumber.includes(searchTerm);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [tasks, filter.search, isRtl]);

  return (
    <div className="space-y-6">
      {/* الإحصائيات */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard 
          title={isRtl ? "إجمالي الطلبات" : "Total Orders"} 
          value={stats.totalOrders.toString()} 
          icon={ShoppingCart} 
          color="amber" 
          ariaLabel="total-orders"
          trend="neutral"
          trendValue="اليوم"
        />
        <StatsCard 
          title={isRtl ? "المهام المكتملة" : "Completed Tasks"} 
          value={stats.completedTasks.toString()} 
          icon={CheckCircle} 
          color="green" 
          ariaLabel="completed-tasks"
          trend="up"
          trendValue="+12%"
        />
        <StatsCard 
          title={isRtl ? "قيد التنفيذ" : "In Progress"} 
          value={stats.inProgressTasks.toString()} 
          icon={Clock} 
          color="blue" 
          ariaLabel="in-progress-tasks"
        />
        <StatsCard 
          title={isRtl ? "معلقة" : "Pending"} 
          value={stats.pendingOrders.toString()} 
          icon={AlertCircle} 
          color="red" 
          ariaLabel="pending-orders"
        />
      </div>

      {/* قائمة المهام */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
        <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-3">
            <ChefHat className={`w-6 h-6 text-amber-600`} />
            {isRtl ? "مهامي الحالية" : "My Current Tasks"}
          </h3>
          <ProductSearchInput
            value={filter.search}
            onChange={(value) => setFilter({ search: value })}
            placeholder={isRtl ? "ابحث في مهامك..." : "Search your tasks..."}
            className="w-full md:w-80 rounded-xl border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          />
        </div>

        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
          <AnimatePresence>
            {filteredTasks.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-12"
              >
                <Package2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">
                  {isRtl ? "لا توجد مهام حالية" : "No current tasks"}
                </p>
              </motion.div>
            ) : (
              filteredTasks.map((task, index) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: isRtl ? 100 : -100 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: isRtl ? 100 : -100 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="group border-2 border-amber-200 rounded-2xl p-5 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 hover:shadow-xl hover:border-amber-400 transition-all duration-300"
                >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-bold text-lg text-amber-900">
                          {isRtl ? `طلب رقم ${task.orderNumber}` : `Order #${task.orderNumber}`}
                        </h4>
                        <span className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider ${
                          task.status === 'pending' ? 'bg-gray-100 text-gray-700' :
                          task.status === 'assigned' ? 'bg-amber-100 text-amber-700' :
                          task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {isRtl 
                            ? task.status === 'pending' ? 'معلق' :
                              task.status === 'assigned' ? 'معين لك' :
                              task.status === 'in_progress' ? 'قيد التنفيذ' : 'مكتمل'
                            : task.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
                          }
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                        <span className="text-2xl text-amber-600">{task.quantity}</span>
                        <span>×</span>
                        <span className="text-amber-800">
                          {isRtl ? task.productName : (task.productNameEn || task.productName)}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          {isRtl ? task.branchName : (task.branchNameEn || task.branchName)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {task.createdAt}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      {(task.status === 'pending' || task.status === 'assigned') && (
                        <button
                          onClick={() => handleStartTask(task.id, task.orderId)}
                          className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:from-amber-600 hover:to-amber-700 transform hover:scale-105 transition-all duration-200 shadow-md"
                        >
                          {isRtl ? "بدء التحضير" : "Start"}
                        </button>
                      )}
                      {task.status === 'in_progress' && (
                        <button
                          onClick={() => handleCompleteTask(task.id, task.orderId)}
                          className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:from-green-600 hover:to-green-700 transform hover:scale-105 transition-all duration-200 shadow-md"
                        >
                          {isRtl ? "تم التحضير" : "Complete"}
                        </button>
                      )}
                    </div>
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

// ========================================
// DASHBOARD COMPONENT - الكامل
// ========================================
export const Dashboard: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const { addNotification, refreshTasks } = useNotifications();
  const navigate = useNavigate();

  // الحالات
  const [orders, setOrders] = useState<Order[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [branches, setBranches] = useState<Array<{ _id: string; name: string; nameEn?: string }>>([]);
  const [returns, setReturns] = useState<Return[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [history, setHistory] = useState<ProductHistoryEntry[]>([]);
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
    totalReturns: 0,
    pendingReturns: 0,
    approvedReturns: 0,
    rejectedReturns: 0,
    averageOrderValue: 0,
    totalInventoryValue: 0,
    lowStockItems: 0,
    averageProductionTime: 0,
    chefUtilizationRate: 0,
  });

  const [timeFilter, setTimeFilter] = useState('week');
  const [inventoryFilter, setInventoryFilter] = useState<FilterState>({ search: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // الكاش لتحسين الأداء
  const cache = useMemo(() => new Map<string, any>(), []);
  const cacheKey = useMemo(() => `${user?.id || user?._id}-${user?.role}-${timeFilter}`, [user, timeFilter]);

  // جلب البيانات
  const fetchDashboardData = useCallback(
    debounce(async (forceRefresh = false) => {
      if (!user?.id && !user?._id) {
        const errorMessage = isRtl ? 'الوصول غير مصرح به' : 'Unauthorized access';
        setError(errorMessage);
        setLoading(false);
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
        return;
      }

      if (!forceRefresh && cache.has(cacheKey)) {
        const cachedData = cache.get(cacheKey);
        setOrders(cachedData.orders);
        setTasks(cachedData.tasks);
        setChefs(cachedData.chefs);
        setBranches(cachedData.branches);
        setReturns(cachedData.returns);
        setInventory(cachedData.inventory || []);
        setHistory(cachedData.history || []);
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

        const query: Record<string, any> = { 
          startDate: startDate.toISOString(), 
          endDate: now.toISOString(), 
          limit: 100 
        };

        let ordersResponse: any[] = [];
        let tasksResponse: any[] = [];
        let chefsResponse: any[] = [];
        let branchesResponse: any[] = [];
        let returnsResponse: any = { returns: [], total: 0 };
        let inventoryResponse: any[] = [];
        let historyResponse: any[] = [];

        if (user.role === 'chef') {
          const chefProfile = await chefsAPI.getByUserId(user.id || user._id);
          const chefId = chefProfile?._id;
          if (!chefId || !/^[0-9a-fA-F]{24}$/.test(chefId)) {
            throw new Error(isRtl ? 'بيانات الشيف غير صالحة' : 'Invalid chef data');
          }
          tasksResponse = await productionAssignmentsAPI.getChefTasks(chefId, { limit: 100 });
        } else {
          if (user.role === 'branch') query.branch = user.id || user._id;
          if (user.role === 'production' && user.department) query.departmentId = user.department._id;

          const promises = [
            ordersAPI.getAll(query).catch(() => []),
            user.role !== 'branch' ? productionAssignmentsAPI.getAllTasks(query).catch(() => []) : Promise.resolve([]),
            ['admin', 'production'].includes(user.role) ? chefsAPI.getAll().catch(() => []) : Promise.resolve([]),
            ['admin', 'production'].includes(user.role) ? branchesAPI.getAll().catch(() => []) : Promise.resolve([]),
            ['admin', 'production', 'branch'].includes(user.role) 
              ? returnsAPI.getAll(query).catch(() => ({ returns: [], total: 0 })) 
              : Promise.resolve({ returns: [], total: 0 }),
          ];

          if (user.role === 'branch') {
            promises.push(inventoryAPI.getByBranch(user.branchId || user._id).catch(() => []));
            promises.push(inventoryAPI.getHistory({ branchId: user.branchId || user._id, limit: 50 }).catch(() => []));
          }

          const results = await Promise.all(promises);
          ordersResponse = results[0];
          tasksResponse = results[1];
          chefsResponse = results[2];
          branchesResponse = results[3];
          returnsResponse = results[4];
          
          if (user.role === 'branch') {
            inventoryResponse = results[5];
            historyResponse = results[6];
          }
        }

        // تحويل البيانات
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
            returnedQuantity: Number(item.returnedQuantity) || 0,
            returnReason: item.returnReason || '',
            returnReasonEn: item.returnReasonEn || item.returnReason || '',
          })),
          status: order.status || 'pending',
          totalAmount: Number(order.totalAmount || order.totalPrice) || 0,
          date: formatDate(order.createdAt || new Date(), language),
          priority: order.priority || 'medium',
          createdBy: order.createdBy?.username || (isRtl ? 'غير معروف' : 'Unknown'),
          createdAt: formatDate(order.createdAt || new Date(), language),
        }));

        const mappedTasks = tasksResponse.map((task: any) => ({
          id: task._id || crypto.randomUUID(),
          orderId: task.order?._id || 'unknown',
          orderNumber: task.order?.orderNumber || (isRtl ? 'غير معروف' : 'Unknown'),
          productId: task.product?._id || 'unknown',
          productName: task.product?.name || (isRtl ? 'منتج غير معروف' : 'Unknown Product'),
          productNameEn: task.product?.nameEn || task.product?.name || 'Unknown',
          quantity: Number(task.quantity) || 0,
          unit: task.product?.unit || 'غير محدد',
          unitEn: task.product?.unitEn || task.product?.unit || 'N/A',
          status: task.status || 'pending',
          branchName: task.order?.branch?.name || (isRtl ? 'فرع غير معروف' : 'Unknown Branch'),
          branchNameEn: task.order?.branch?.nameEn || task.order?.branch?.name || 'Unknown',
          createdAt: formatDate(task.createdAt || new Date(), language),
        }));

        // دعم Array للـ department في الشيفات
        const mappedChefs = chefsResponse.map((chef: any) => ({
          _id: chef._id || crypto.randomUUID(),
          userId: chef.user?._id || chef._id,
          username: chef.user?.username || chef.username || (isRtl ? 'شيف غير معروف' : 'Unknown Chef'),
          name: chef.user?.name || chef.name || (isRtl ? 'شيف غير معروف' : 'Unknown Chef'),
          nameEn: chef.user?.nameEn || chef.name || 'Unknown',
          department: Array.isArray(chef.department) 
            ? chef.department 
            : chef.department ? [chef.department] : null,
        }));

        const mappedBranches = branchesResponse
          .map((branch: any) => ({
            _id: branch._id || crypto.randomUUID(),
            name: branch.name || (isRtl ? 'فرع غير معروف' : 'Unknown Branch'),
            nameEn: branch.nameEn || branch.name || 'Unknown',
          }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name));

        const mappedReturns = (returnsResponse.returns || []).map((ret: any) => ({
          id: ret._id || crypto.randomUUID(),
          returnNumber: ret.returnNumber || (isRtl ? 'غير معروف' : 'Unknown'),
          branchName: ret.branch?.name || (isRtl ? 'فرع غير معروف' : 'Unknown Branch'),
          branchNameEn: ret.branch?.nameEn || ret.branch?.name || 'Unknown',
          branchId: ret.branch?._id || 'unknown',
          items: (ret.items || []).map((item: any) => ({
            productId: item.product?._id || 'unknown',
            productName: item.product?.name || (isRtl ? 'منتج غير معروف' : 'Unknown Product'),
            productNameEn: item.product?.nameEn || item.product?.name || 'Unknown',
            quantity: Number(item.quantity) || 0,
            reason: item.reason || '',
            reasonEn: item.reasonEn || item.reason || '',
          })),
          status: ret.status || 'pending_approval',
          createdByName: ret.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
          createdByNameEn: ret.createdBy?.nameEn || ret.createdBy?.name || 'Unknown',
          reviewNotes: ret.reviewNotes || '',
          reviewNotesEn: ret.reviewNotesEn || ret.reviewNotes || '',
          createdAt: formatDate(ret.createdAt || new Date(), language),
        }));

        // سجل المخزون مع إظهار اسم المنتج بوضوح
        let mappedInventory: InventoryItem[] = [];
        let mappedHistory: ProductHistoryEntry[] = [];
        
        if (user.role === 'branch') {
          mappedInventory = inventoryResponse.map((item: any) => ({
            _id: item._id,
            product: item.product ? {
              _id: item.product._id,
              name: item.product.name,
              nameEn: item.product.nameEn || item.product.name,
              code: item.product.code,
              unit: item.product.unit,
              unitEn: item.product.unitEn || item.product.unit,
              department: item.product.department,
              displayName: isRtl ? item.product.name : (item.product.nameEn || item.product.name),
              displayUnit: isRtl ? (item.product.unit || 'غير محدد') : (item.product.unitEn || item.product.unit || 'N/A'),
              price: Number(item.product.price) || 0,
            } : null,
            branch: item.branch,
            currentStock: Number(item.currentStock) || 0,
            pendingReturnStock: Number(item.pendingReturnStock) || 0,
            damagedStock: Number(item.damagedStock) || 0,
            minStockLevel: Number(item.minStockLevel) || 0,
            maxStockLevel: Number(item.maxStockLevel) || 0,
            status: item.status || 'normal',
          }));

          mappedHistory = historyResponse.map((entry: any) => ({
            _id: entry._id,
            date: formatDate(entry.date || new Date(), language),
            type: entry.type,
            quantity: Number(entry.quantity) || 0,
            description: entry.description || '',
            productName: entry.product?.name || entry.productName || (isRtl ? 'منتج غير معروف' : 'Unknown Product'),
            productNameEn: entry.product?.nameEn || entry.productNameEn || entry.productName || 'Unknown',
          }));
        }

        // الحسابات
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
        const totalReturns = mappedReturns.length;
        const pendingReturns = mappedReturns.filter((r) => r.status === 'pending_approval').length;
        const approvedReturns = mappedReturns.filter((r) => r.status === 'approved').length;
        const rejectedReturns = mappedReturns.filter((r) => r.status === 'rejected').length;
        const averageOrderValue = totalOrders > 0 ? totalOrderValue / totalOrders : 0;

        let totalInventoryValue = 0;
        let lowStockItems = 0;
        if (user.role === 'branch') {
          totalInventoryValue = mappedInventory.reduce((sum, item) => sum + (item.currentStock * (item.product?.price || 0)), 0);
          lowStockItems = mappedInventory.filter((item) => item.currentStock <= item.minStockLevel).length;
        }

        const newStats: Stats = {
          totalOrders,
          pendingOrders,
          inProductionOrders,
          inTransitOrders,
          deliveredOrders,
          totalOrderValue,
          completedTasks,
          inProgressTasks,
          totalReturns,
          pendingReturns,
          approvedReturns,
          rejectedReturns,
          averageOrderValue,
          totalInventoryValue,
          lowStockItems,
          averageProductionTime: 0,
          chefUtilizationRate: 0,
        };

        const newData = {
          orders: mappedOrders,
          tasks: mappedTasks,
          chefs: mappedChefs,
          branches: mappedBranches,
          returns: mappedReturns,
          inventory: mappedInventory,
          history: mappedHistory,
          branchPerformance: [],
          chefPerformance: [],
          stats: newStats,
        };

        cache.set(cacheKey, newData);
        setOrders(newData.orders);
        setTasks(newData.tasks);
        setChefs(newData.chefs);
        setBranches(newData.branches);
        setReturns(newData.returns);
        setInventory(newData.inventory);
        setHistory(newData.history);
        setStats(newData.stats);
        setError('');
        setIsInitialLoad(false);
      } catch (err: any) {
        const errorMessage = isRtl ? 'فشل تحميل البيانات' : 'Failed to load data';
        setError(errorMessage);
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right', autoClose: 4000 });
      } finally {
        setLoading(false);
      }
    }, 200),
    [user, isRtl, language, cacheKey, addNotification]
  );

  // Effects
  useEffect(() => {
    fetchDashboardData();
    return () => fetchDashboardData.cancel();
  }, [fetchDashboardData, timeFilter]);

  useEffect(() => {
    if (refreshTasks) {
      fetchDashboardData(true);
    }
  }, [refreshTasks, fetchDashboardData]);

  // Socket Events
  useEffect(() => {
    if (!socket || !user || !isConnected) return;

    const handleTaskAssigned = (data: any) => {
      if (!data.taskId || !data.orderId || !data.productName || !data.orderNumber || !data.branchName || !data.quantity || !data.eventId) return;
      if (data.chefId !== (user?.id || user?._id) || !['admin', 'production', 'chef'].includes(user.role)) return;

      const notification = {
        _id: data.eventId,
        type: 'info' as const,
        message: isRtl
          ? `تم تعيين مهمة: ${data.productName} (${data.quantity} ${data.unit}) للطلب ${data.orderNumber} - ${data.branchName}`
          : `Task assigned: ${data.productName} (${data.quantity} ${data.unit}) for order ${data.orderNumber} - ${data.branchName}`,
        data: { orderId: data.orderId, taskId: data.taskId, chefId: data.chefId, eventId: data.eventId },
        read: false,
        createdAt: formatDate(new Date(), language),
        sound: '/sounds/task-assigned.mp3',
        vibrate: [400, 100, 400],
        path: '/dashboard',
      };
      addNotification(notification);

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
            unit: data.unit || 'غير محدد',
            unitEn: data.unitEn || data.unit || 'N/A',
            status: data.status || 'assigned',
            branchName: data.branchName,
            branchNameEn: data.branchNameEn || data.branchName,
            createdAt: formatDate(new Date(), language),
          },
          ...prev.filter((t) => t.id !== data.taskId),
        ]);
      }
      fetchDashboardData(true);
    };

    socket.on('taskAssigned', handleTaskAssigned);
    return () => socket.off('taskAssigned', handleTaskAssigned);
  }, [socket, user, isRtl, language, addNotification, fetchDashboardData, isConnected]);

  // Task Handlers
  const handleStartTask = useCallback(
    async (taskId: string, orderId: string) => {
      if (!isConnected) {
        toast.warning(isRtl ? 'الاتصال غير متاح' : 'Connection unavailable');
        return;
      }
      try {
        await productionAssignmentsAPI.updateTaskStatus(orderId, taskId, { status: 'in_progress' });
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'in_progress' } : t));
        toast.success(isRtl ? 'تم بدء المهمة' : 'Task started');
      } catch (err) {
        toast.error(isRtl ? 'فشل بدء المهمة' : 'Failed to start task');
      }
    },
    [isConnected]
  );

  const handleCompleteTask = useCallback(
    async (taskId: string, orderId: string) => {
      if (!isConnected) {
        toast.warning(isRtl ? 'الاتصال غير متاح' : 'Connection unavailable');
        return;
      }
      try {
        await productionAssignmentsAPI.updateTaskStatus(orderId, taskId, { status: 'completed' });
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed' } : t));
        toast.success(isRtl ? 'تم إكمال المهمة' : 'Task completed');
      } catch (err) {
        toast.error(isRtl ? 'فشل إكمال المهمة' : 'Failed to complete task');
      }
    },
    [isConnected]
  );

  // سجل المخزون مع إظهار "2 × بسبوسة"
  const renderRecentInventoryHistory = () => (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
      <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-3">
        <Clock className="w-6 h-6 text-amber-600" />
        {isRtl ? 'سجل المخزون الأخير' : 'Recent Inventory History'}
      </h3>
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {history.length === 0 ? (
          <p className="text-center text-gray-500 py-8">{isRtl ? 'لا توجد سجلات' : 'No records'}</p>
        ) : (
          history.map((entry) => (
            <div key={entry._id} className="flex justify-between items-center p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl hover:shadow-md transition-all">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-amber-100 rounded-lg">
                  {entry.type === 'sale' ? <TrendingDown className="w-5 h-5 text-red-600" /> :
                   entry.type === 'delivery' ? <Package className="w-5 h-5 text-green-600" /> :
                   <RotateCcw className="w-5 h-5 text-amber-600" />}
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-800">
                    {isRtl ? entry.productName : (entry.productNameEn || entry.productName)}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">{entry.description}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-bold text-lg ${entry.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {entry.quantity > 0 ? '+' : ''}{entry.quantity}
                </p>
                <p className="text-xs text-gray-500">{entry.date}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // التحقق من التحميل
  if (loading && isInitialLoad) return <Loader />;
  if (error) return <div className="text-center text-red-600 p-8 text-lg font-bold">{error}</div>;

  return (
    <div className={`min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-50 ${isRtl ? 'rtl' : 'ltr'}`}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* العنوان */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
          <h1 className="text-4xl font-bold text-gray-800 flex items-center gap-4">
            <BarChart3 className="w-10 h-10 text-amber-600" />
            {isRtl ? 'لوحة التحكم' : 'Dashboard'}
          </h1>
          <ProductDropdown
            value={timeFilter}
            onChange={(value) => setTimeFilter(value)}
            options={timeFilterOptions.map(option => ({
              value: option.value,
              label: isRtl ? option.label : option.enLabel
            }))}
            className="w-full md:w-64 rounded-xl border-gray-300 focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* عرض حسب الدور */}
        {user.role === 'chef' ? (
          <ChefDashboard
            stats={stats}
            tasks={tasks}
            isRtl={isRtl}
            language={language}
            handleStartTask={handleStartTask}
            handleCompleteTask={handleCompleteTask}
          />
        ) : (
          <div className="space-y-8">
            {/* الإحصائيات */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatsCard title="الطلبات" value={stats.totalOrders.toString()} icon={ShoppingCart} color="amber" ariaLabel="total-orders" />
              <StatsCard title="معلقة" value={stats.pendingOrders.toString()} icon={AlertCircle} color="red" ariaLabel="pending-orders" />
              <StatsCard title="قيد الإنتاج" value={stats.inProductionOrders.toString()} icon={Package} color="blue" ariaLabel="in-production" />
              <StatsCard title="في الطريق" value={stats.inTransitOrders.toString()} icon={Timer} color="purple" ariaLabel="in-transit" />
              <StatsCard title="مسلمة" value={stats.deliveredOrders.toString()} icon={CheckCircle} color="green" ariaLabel="delivered" />
              <StatsCard title="قيمة الطلبات" value={`$${stats.totalOrderValue.toFixed(0)}`} icon={DollarSign} color="emerald" ariaLabel="total-value" />
            </div>

            {/* الأقسام */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {renderRecentInventoryHistory()}
              {/* أضف باقي الأقسام هنا */}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};