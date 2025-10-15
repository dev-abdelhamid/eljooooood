import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useNotifications } from '../contexts/NotificationContext';
import { ShoppingCart, Clock, BarChart3, CheckCircle, AlertCircle, Package, DollarSign, ChefHat, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import { ordersAPI, productionAssignmentsAPI, chefsAPI, branchesAPI, returnsAPI, inventoryAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { ProductSearchInput, ProductDropdown } from './NewOrder';

// Interfaces (unchanged from previous)
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
  department: { _id: string; name: string; nameEn?: string } | null;
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
}

interface FilterState {
  search: string;
}

const timeFilterOptions = [
  { value: 'day', label: 'اليوم', enLabel: 'Today' },
  { value: 'week', label: 'هذا الأسبوع', enLabel: 'This Week' },
  { value: 'month', label: 'هذا الشهر', enLabel: 'This Month' },
  { value: 'year', label: 'هذا العام', enLabel: 'This Year' },
];

// Loader Component
const Loader: React.FC = () => (
  <div className="flex justify-center items-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-600"></div>
  </div>
);

// StatsCard Component
const StatsCard: React.FC<{ title: string; value: string; icon: React.FC; color: string; ariaLabel: string }> = React.memo(
  ({ title, value, icon: Icon, color, ariaLabel }) => (
    <motion.div
      whileHover={{ scale: 1.02, boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}
      className={`p-4 bg-gradient-to-br from-${color}-50 to-${color}-100 rounded-xl border border-${color}-200 cursor-pointer hover:bg-${color}-100 transition-all duration-200 shadow-sm`}
      aria-label={ariaLabel}
    >
      <div className="flex items-center gap-3">
        <Icon className={`w-6 h-6 text-${color}-600`} />
        <div>
          <p className="text-sm text-gray-600 font-medium">{title}</p>
          <p className="text-lg font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </motion.div>
  )
);

// ChefDashboard Component
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
    const searchTerm = typeof filter.search === 'string' ? filter.search.toLowerCase() : '';
    return tasks
      .filter(
        (task) =>
          (isRtl ? task.productName : task.productNameEn || task.productName)
            ?.toLowerCase()
            .includes(searchTerm) ||
          task.orderNumber.toLowerCase().includes(searchTerm)
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);
  }, [tasks, filter.search, isRtl]);

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
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-3">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <ChefHat className={`w-5 h-5 ${isRtl ? 'ml-2' : 'mr-2'} text-amber-600`} />
            {isRtl ? 'أحدث الطلبات قيد الإنتاج' : 'Latest In Production'}
          </h3>
       
        </div>
        <div className="space-y-3 overflow-y-auto max-h-80">
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
                  className="border border-amber-100 rounded-lg p-3 bg-amber-50/50 shadow-sm hover:bg-amber-100 transition-all duration-200"
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
                  <p className="text-sm text-gray-600 mb-2 truncate">
                    {`${task.quantity} ${isRtl ? task.productName : task.productNameEn || task.productName} `}
                  </p>
                  <p className="text-sm text-gray-500 mb-2">{isRtl ? `تم الإنشاء في: ${task.createdAt}` : `Created At: ${task.createdAt}`}</p>
                  <div className="flex items-center gap-2">
                    {(task.status === 'pending' || task.status === 'assigned') && (
                      <button
                        onClick={() => handleStartTask(task.id, task.orderId)}
                        className="bg-amber-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-amber-700 transition-all duration-200"
                        aria-label={isRtl ? 'بدء المهمة' : 'Start Task'}
                      >
                        {isRtl ? 'بدء' : 'Start'}
                      </button>
                    )}
                    {task.status === 'in_progress' && (
                      <button
                        onClick={() => handleCompleteTask(task.id, task.orderId)}
                        className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-700 transition-all duration-200"
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
  });
  const [timeFilter, setTimeFilter] = useState('week');
  const [inventoryFilter, setInventoryFilter] = useState<FilterState>({ search: '' });
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
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right', autoClose: 2000 });
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
        const query: Record<string, any> = { startDate: startDate.toISOString(), endDate: now.toISOString(), limit: 20 };
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
          tasksResponse = await productionAssignmentsAPI.getChefTasks(chefId, { limit: 20 });
        } else {
          if (user.role === 'branch') query.branch = user.id || user._id;
          if (user.role === 'production' && user.department) query.departmentId = user.department._id;
          const promises = [
            ordersAPI.getAll(query).catch((err) => {
              console.error(err);
              return [];
            }),
            user.role !== 'branch' ? productionAssignmentsAPI.getAllTasks(query).catch((err) => {
              console.error(err);
              return [];
            }) : Promise.resolve([]),
            ['admin', 'production'].includes(user.role) ? chefsAPI.getAll().catch((err) => {
              console.error(err);
              return [];
            }) : Promise.resolve([]),
            ['admin', 'production'].includes(user.role) ? branchesAPI.getAll().catch((err) => {
              console.error(err);
              return [];
            }) : Promise.resolve([]),
            ['admin', 'production', 'branch'].includes(user.role)
              ? returnsAPI.getAll(query).catch((err) => {
                  console.error(`Error fetching returns:`, err);
                  return { returns: [], total: 0 };
                })
              : Promise.resolve({ returns: [], total: 0 }),
          ];
          if (user.role === 'branch') {
            promises.push(inventoryAPI.getByBranch(user.branchId || user._id).catch((err) => {
              console.error(err);
              return [];
            }));
            promises.push(inventoryAPI.getHistory({ branchId: user.branchId || user._id, limit: 10 }).catch((err) => {
              console.error(err);
              return [];
            }));
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
        const mappedReturns = returnsResponse.returns.map((ret: any) => ({
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
        let mappedInventory: InventoryItem[] = [];
        let mappedHistory: ProductHistoryEntry[] = [];
        if (user.role === 'branch') {
          mappedInventory = inventoryResponse.map((item: any) => ({
            _id: item._id,
            product: item.product ? {
              _id: item.product._id,
              name: item.product.name,
              nameEn: item.product.nameEn,
              code: item.product.code,
              unit: item.product.unit,
              unitEn: item.product.unitEn,
              department: item.product.department,
              displayName: isRtl ? item.product.name : item.product.nameEn || item.product.name,
              displayUnit: isRtl ? (item.product.unit || 'غير محدد') : item.product.unitEn || item.product.unit || 'N/A',
              price: item.product.price || 0,
            } : null,
            branch: item.branch,
            currentStock: item.currentStock,
            pendingReturnStock: item.pendingReturnStock,
            damagedStock: item.damagedStock,
            minStockLevel: item.minStockLevel,
            maxStockLevel: item.maxStockLevel,
            status: item.status,
          }));
          mappedHistory = historyResponse.map((entry: any) => ({
            _id: entry._id,
            date: formatDate(entry.date || new Date(), language),
            type: entry.type,
            quantity: entry.quantity,
            description: entry.description,
          }));
        }
        const branchPerf = mappedBranches.map((branch: any) => {
          const branchOrders = mappedOrders.filter((o) => o.branchId === branch._id);
          const total = branchOrders.length;
          const completed = branchOrders.filter((o) => o.status === 'completed' || o.status === 'delivered').length;
          const perf = total > 0 ? (completed / total) * 100 : 0;
          return {
            branchName: branch.name,
            branchNameEn: branch.nameEn,
            branchId: branch._id,
            performance: perf,
            totalOrders: total,
            completedOrders: completed,
          };
        }).filter((b: any) => b.totalOrders > 0);
        const chefPerf = mappedChefs.map((chef: any) => {
          const chefTasks = mappedTasks.filter((task) => {
            const order = mappedOrders.find((o) => o.id === task.orderId);
            const item = order?.items.find((i) => i.productId === task.productId);
            return item ? item.assignedTo?._id === chef.userId : false;
          });
          const total = chefTasks.length;
          const completed = chefTasks.filter((t) => t.status === 'completed').length;
          const perf = total > 0 ? (completed / total) * 100 : 0;
          return {
            chefId: chef._id,
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
        const newData = {
          orders: mappedOrders,
          tasks: mappedTasks,
          chefs: mappedChefs,
          branches: mappedBranches,
          returns: mappedReturns,
          inventory: mappedInventory,
          history: mappedHistory,
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
            totalReturns,
            pendingReturns,
            approvedReturns,
            rejectedReturns,
            averageOrderValue,
            totalInventoryValue,
            lowStockItems,
          },
        };
        cache.set(cacheKey, newData);
        setOrders(newData.orders);
        setTasks(newData.tasks);
        setChefs(newData.chefs);
        setBranches(newData.branches);
        setReturns(newData.returns);
        setInventory(newData.inventory);
        setHistory(newData.history);
        setBranchPerformance(newData.branchPerformance);
        setChefPerformance(newData.chefPerformance);
        setStats(newData.stats);
        setError('');
        setIsInitialLoad(false);
      } catch (err: any) {
        const errorMessage = err.status === 403 ? (isRtl ? 'الوصول غير مصرح به' : 'Unauthorized access') : (isRtl ? 'خطأ في الخادم' : 'Server error');
        setError(errorMessage);
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right', autoClose: 2000 });
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
        createdAt: formatDate(new Date(), language),
        path: '/dashboard',
      });
    });
    socket.on('taskAssigned', (data: any) => {
      if (!data.taskId || !data.orderId || !data.productName || !data.orderNumber || !data.branchName || !data.quantity || !data.eventId) {
        console.warn(`[${new Date().toISOString()} ] Invalid task assigned data:`, data);
        return;
      }
      if (data.chefId !== (user?.id || user?._id) || !['admin', 'production', 'chef'].includes(user.role)) return;
      const notification = {
        _id: data.eventId,
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
    });
    socket.on('orderCompleted', (data: any) => {
      if (!data.orderId || !data.orderNumber || !data.branchName || !data.eventId) return;
      if (!['admin', 'branch', 'production'].includes(user.role)) return;
      addNotification({
        _id: data.eventId,
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
      fetchDashboardData(true);
    });
    socket.on('itemStatusUpdated', (data: any) => {
      if (!data.orderId || !data.itemId || !data.status || !data.orderNumber || !data.branchName || !data.productName || !data.eventId) {
        console.warn(`[${new Date().toISOString()} ] Invalid item status update data:`, data);
        return;
      }
      if (!['admin', 'production', 'chef'].includes(user.role) || (user.role === 'chef' && data.chefId !== user._id)) return;
      setTasks((prev) =>
        prev.map((task) =>
          task.id === data.itemId && task.orderId === data.orderId ? { ...task, status: data.status } : task
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
    socket.on('returnCreated', (data: any) => {
      if (!data.returnId || !data.returnNumber || !data.branchId || !data.branchName || !data.items || !data.status || !data.eventId) {
        console.warn(`[${new Date().toISOString()} ] Invalid return created data:`, data);
        return;
      }
      if (!['admin', 'production', 'branch'].includes(user.role) || (user.role === 'branch' && data.branchId !== user.branchId)) return;
      addNotification({
        _id: data.eventId,
        type: 'info',
        message: isRtl
          ? `تم إنشاء مرتجع جديد: ${data.returnNumber} من ${data.branchName}`
          : `New return created: ${data.returnNumber} from ${data.branchName}`,
        data: { returnId: data.returnId, branchId: data.branchId, eventId: data.eventId },
        read: false,
        createdAt: formatDate(new Date(), language),
        sound: '/sounds/return-created.mp3',
        vibrate: [300, 100, 300],
        path: '/returns',
      });
      fetchDashboardData(true);
    });
    socket.on('returnStatusUpdated', (data: any) => {
      if (!data.returnId || !data.returnNumber || !data.status || !data.branchId || !data.branchName || !data.eventId) {
        console.warn(`[${new Date().toISOString()} ] Invalid return status update data:`, data);
        return;
      }
      if (!['admin', 'production', 'branch'].includes(user.role) || (user.role === 'branch' && data.branchId !== user.branchId)) return;
      setReturns((prev) =>
        prev.map((ret) =>
          ret.id === data.returnId ? { ...ret, status: data.status, reviewNotes: data.reviewNotes || '', reviewNotesEn: data.reviewNotesEn || data.reviewNotes || '' } : ret
        )
      );
      addNotification({
        _id: data.eventId,
        type: 'info',
        message: isRtl
          ? `تم تحديث حالة المرتجع ${data.returnNumber} إلى ${data.status === 'approved' ? 'موافق عليه' : 'مرفوض'}`
          : `Return ${data.returnNumber} status updated to ${data.status}`,
        data: { returnId: data.returnId, branchId: data.branchId, eventId: data.eventId },
        read: false,
        createdAt: formatDate(new Date(), language),
        path: '/returns',
        sound: '/sounds/return-status-updated.mp3',
        vibrate: [200, 100, 200],
      });
      fetchDashboardData(true);
    });
    socket.on('inventoryUpdated', (data: any) => {
      if (user.role === 'branch' && data.branchId === user.branchId) {
        fetchDashboardData(true);
      }
    });
    return () => {
      socket.off('connect_error');
      socket.off('taskAssigned');
      socket.off('orderCompleted');
      socket.off('itemStatusUpdated');
      socket.off('returnCreated');
      socket.off('returnStatusUpdated');
      socket.off('inventoryUpdated');
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
          createdAt: formatDate(new Date(), language),
          path: '/dashboard',
        });
        return;
      }
      try {
        await productionAssignmentsAPI.updateTaskStatus(orderId, taskId, { status: 'in_progress' });
        const task = tasks.find((t) => t.id === taskId);
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: 'in_progress' } : t)));
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
          unit: task?.unit || 'غير محدد',
          unitEn: task?.unitEn || task?.unit || 'N/A',
        });
        addNotification({
          _id: `success-task-${taskId}-${Date.now()}`,
          type: 'success',
          message: isRtl ? 'تم بدء المهمة' : 'Task started',
          read: false,
          createdAt: formatDate(new Date(), language),
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
          createdAt: formatDate(new Date(), language),
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
          createdAt: formatDate(new Date(), language),
          path: '/dashboard',
        });
        return;
      }
      try {
        await productionAssignmentsAPI.updateTaskStatus(orderId, taskId, { status: 'completed' });
        const task = tasks.find((t) => t.id === taskId);
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: 'completed' } : t)));
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
          unit: task?.unit || 'غير محدد',
          unitEn: task?.unitEn || task?.unit || 'N/A',
        });
        addNotification({
          _id: `success-complete-${taskId}-${Date.now()}`,
          type: 'success',
          message: isRtl ? 'تم إكمال المهمة' : 'Task completed',
          read: false,
          createdAt: formatDate(new Date(), language),
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
          createdAt: formatDate(new Date(), language),
          path: '/dashboard',
        });
      }
    },
    [socket, user, isRtl, isConnected, tasks, language, addNotification]
  );

  const handleConfirmDelivery = useCallback(
    async (orderId: string, branchId: string) => {
      if (!isConnected) {
        toast.error(isRtl ? 'الاتصال بالسوكت غير متاح' : 'Socket disconnected');
        return;
      }
      try {
        await ordersAPI.confirmDelivery(orderId);
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: 'delivered' } : o)));
        const eventId = crypto.randomUUID();
        socket.emit('inventoryUpdated', {
          branchId,
          eventId,
        });
        toast.success(isRtl ? 'تم تأكيد التسليم ونقل المخزون' : 'Delivery confirmed and inventory transferred');
      } catch (err: any) {
        toast.error(err.message || (isRtl ? 'فشل تأكيد التسليم' : 'Failed to confirm delivery'));
      }
    },
    [isConnected, socket, isRtl]
  );

  const filteredInventory = useMemo(() => {
    const searchTerm = typeof inventoryFilter.search === 'string' ? inventoryFilter.search.toLowerCase() : '';
    return inventory.filter((item) => {
      const name = isRtl ? item.product?.name : item.product?.nameEn || item.product?.name;
      return name?.toLowerCase().includes(searchTerm);
    });
  }, [inventory, inventoryFilter.search, isRtl]);

  const lowStockItems = useMemo(() => filteredInventory.filter((item) => item.currentStock <= item.minStockLevel).slice(0, 8), [filteredInventory]);

  const recentHistory = useMemo(() => history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8), [history]);

  const sortedPendingOrders = useMemo(() => {
    return [...orders]
      .filter((order) => ['pending', 'approved', 'in_production', 'in_transit'].includes(order.status))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [orders]);

  const sortedLatestReturns = useMemo(() => {
    return [...returns]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [returns]);

  const renderStats = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6"
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
      {['admin', 'production', 'branch'].includes(user.role) && (
        <>
       
          <StatsCard
            title={isRtl ? 'إجمالي المرتجعات' : 'Total Returns'}
            value={stats.totalReturns.toString()}
            icon={RotateCcw}
            color="orange"
            ariaLabel={isRtl ? 'إجمالي المرتجعات' : 'Total Returns'}
      />
          <StatsCard
            title={isRtl ? 'المرتجعات المعلقة' : 'Pending Returns'}
            value={stats.pendingReturns.toString()}
            icon={AlertCircle}
            color="red"
            ariaLabel={isRtl ? 'المرتجعات المعلقة' : 'Pending Returns'}
          />
          <StatsCard
            title={isRtl ? 'المرتجعات الموافق عليها' : 'Approved Returns'}
            value={stats.approvedReturns.toString()}
            icon={CheckCircle}
            color="green"
            ariaLabel={isRtl ? 'المرتجعات الموافق عليها' : 'Approved Returns'}
          />
          <StatsCard
            title={isRtl ? 'المرتجعات المرفوضة' : 'Rejected Returns'}
            value={stats.rejectedReturns.toString()}
            icon={AlertCircle}
            color="red"
            ariaLabel={isRtl ? 'المرتجعات المرفوضة' : 'Rejected Returns'}
          />
        </>
      )}
      {user.role === 'branch' && (
        <>
          <StatsCard
            title={isRtl ? 'قيمة المخزون' : 'Inventory Value'}
            value={stats.totalInventoryValue?.toFixed(2) || '0'}
            icon={Package}
            color="purple"
            ariaLabel={isRtl ? 'قيمة المخزون' : 'Inventory Value'}
          />
          <StatsCard
            title={isRtl ? 'منتجات تحتاج تجديد' : 'Low Stock Items'}
            value={stats.lowStockItems?.toString() || '0'}
            icon={AlertCircle}
            color="red"
            ariaLabel={isRtl ? 'منتجات تحتاج تجديد' : 'Low Stock Items'}
          />
        </>
      )}
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
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mt-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
        <BarChart3 className={`w-5 h-5 ${isRtl ? 'ml-2' : 'mr-2'} text-amber-600`} />
        {isRtl ? 'أداء الفروع' : 'Branch Performance'}
      </h3>
      <div className="space-y-3 max-h-64 overflow-y-auto">
        <AnimatePresence>
          {branchPerformance.length === 0 ? (
            <p className="text-gray-500 text-sm">{isRtl ? 'لا توجد بيانات أداء' : 'No performance data available'}</p>
          ) : (
            branchPerformance.map((branch, index) => (
              <motion.div
                key={branch.branchId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, delay: index * 0.1 }}
                className="flex items-center justify-between p-3 border-b border-gray-100 cursor-pointer hover:bg-amber-50/50 transition-all duration-200"
                onClick={() => navigate(`/branches/${branch.branchId}`)}
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{isRtl ? branch.branchName : branch.branchNameEn || branch.branchName}</p>
                  <p className="text-sm text-gray-500">
                    {isRtl ? `${branch.totalOrders} طلبات` : `${branch.totalOrders} Orders`} -{' '}
                    {isRtl ? `${branch.completedOrders} مكتمل` : `${branch.completedOrders} Completed`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-amber-600 h-2 rounded-full"
                      style={{ width: `${Math.min(branch.performance, 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600">{branch.performance.toFixed(1)}%</span>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  const renderChefPerformance = () => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mt-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
        <ChefHat className={`w-5 h-5 ${isRtl ? 'ml-2' : 'mr-2'} text-amber-600`} />
        {isRtl ? 'أداء الطهاة' : 'Chef Performance'}
      </h3>
      <div className="space-y-3 max-h-64 overflow-y-auto">
        <AnimatePresence>
          {chefPerformance.length === 0 ? (
            <p className="text-gray-500 text-sm">{isRtl ? 'لا توجد بيانات أداء' : 'No performance data available'}</p>
          ) : (
            chefPerformance.map((chef, index) => (
              <motion.div
                key={chef.chefId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, delay: index * 0.1 }}
                className="flex items-center justify-between p-3 border-b border-gray-100 cursor-pointer hover:bg-amber-50/50 transition-all duration-200"
                onClick={() => navigate(`/chefs/${chef.chefId}`)}
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{isRtl ? chef.chefName : chef.chefNameEn || chef.chefName}</p>
                  <p className="text-sm text-gray-500">
                    {isRtl ? `${chef.totalTasks} مهام` : `${chef.totalTasks} Tasks`} -{' '}
                    {isRtl ? `${chef.completedTasks} مكتمل` : `${chef.completedTasks} Completed`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-amber-600 h-2 rounded-full"
                      style={{ width: `${Math.min(chef.performance, 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600">{chef.performance.toFixed(1)}%</span>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  const renderLatestReturns = () => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
        <RotateCcw className={`w-5 h-5 ${isRtl ? 'ml-2' : 'mr-2'} text-amber-600`} />
        {isRtl ? 'أحدث المرتجعات' : 'Latest Returns'}
      </h3>
      <div className="space-y-3 max-h-80 overflow-y-auto">
        <AnimatePresence>
          {sortedLatestReturns.length === 0 ? (
            <p className="text-gray-500 text-sm">{isRtl ? 'لا توجد مرتجعات' : 'No returns available'}</p>
          ) : (
            sortedLatestReturns.map((ret) => (
              <motion.div
                key={ret.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="border border-amber-100 rounded-lg p-3 bg-amber-50/50 shadow-sm cursor-pointer hover:bg-amber-100 transition-all duration-200"
                onClick={() => navigate(`/returns/${ret.id}`)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm text-gray-800 truncate">
                    {isRtl ? `مرتجع رقم ${ret.returnNumber}` : `Return #${ret.returnNumber}`}
                  </h4>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      ret.status === 'pending_approval'
                        ? 'bg-amber-100 text-amber-800'
                        : ret.status === 'approved'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {isRtl
                      ? ret.status === 'pending_approval'
                        ? 'معلق'
                        : ret.status === 'approved'
                        ? 'موافق عليه'
                        : 'مرفوض'
                      : ret.status.charAt(0).toUpperCase() + ret.status.slice(1)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2 truncate">{isRtl ? ret.branchName : ret.branchNameEn || ret.branchName}</p>
                <p className="text-sm text-gray-500">{isRtl ? `تم الإنشاء في: ${ret.createdAt}` : `Created At: ${ret.createdAt}`}</p>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  const renderLowStockItems = () => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mt-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
        <AlertCircle className={`w-5 h-5 ${isRtl ? 'ml-2' : 'mr-2'} text-red-600`} />
        {isRtl ? 'منتجات تحتاج تجديد' : 'Low Stock Products'}
      </h3>
    
      <div className="space-y-3 max-h-64 overflow-y-auto">
        <AnimatePresence>
          {lowStockItems.length === 0 ? (
            <p className="text-gray-500 text-sm">{isRtl ? 'لا توجد منتجات منخفضة المخزون' : 'No low stock products'}</p>
          ) : (
            lowStockItems.map((item, index) => (
              <motion.div
                key={item._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, delay: index * 0.1 }}
                className="flex items-center justify-between p-3 border-b border-gray-100 hover:bg-amber-50/50 transition-all duration-200"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.product?.displayName}</p>
                  <p className="text-sm text-gray-500">
                    {isRtl ? 'المخزون الحالي' : 'Current Stock'}: {item.currentStock} {item.product?.displayUnit}
                  </p>
                </div>
                <span className="text-sm text-red-600">{isRtl ? 'منخفض' : 'Low'}</span>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  const renderRecentInventoryHistory = () => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mt-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
        <Clock className={`w-5 h-5 ${isRtl ? 'ml-2' : 'mr-2'} text-amber-600`} />
        {isRtl ? 'أحدث سجل المخزون' : 'Recent Inventory History'}
      </h3>
      <div className="space-y-3 max-h-64 overflow-y-auto">
        <AnimatePresence>
          {recentHistory.length === 0 ? (
            <p className="text-gray-500 text-sm">{isRtl ? 'لا توجد سجلات' : 'No history available'}</p>
          ) : (
            recentHistory.map((entry, index) => (
              <motion.div
                key={entry._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, delay: index * 0.1 }}
                className="flex items-center justify-between p-3 border-b border-gray-100 hover:bg-amber-50/50 transition-all duration-200"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{isRtl ? entry.type : entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}</p>
                  <p className="text-sm text-gray-500">{entry.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">{entry.quantity}</p>
                  <p className="text-sm text-gray-500">{entry.date}</p>
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
  <div className={`py-8 px-6 mx-auto  ${isRtl ? 'rtl' : 'ltr'}`}>
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-3">
        <BarChart3 className="w-6 h-6 text-amber-600" />
        {isRtl ? 'لوحة التحكم' : 'Dashboard'}
      </h1>
      <ProductDropdown
        value={timeFilter}
        onChange={(value) => setTimeFilter(value)}
        options={timeFilterOptions.map((option) => ({
          value: option.value,
          label: isRtl ? option.label : option.enLabel,
        }))}
        ariaLabel={isRtl ? 'تصفية حسب الوقت' : 'Time Filter'}
        className="w-48 rounded-lg border-gray-200 focus:ring-amber-500"
      />
    </div>

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
      <>
        {renderStats()}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <ShoppingCart className={`w-5 h-5 ${isRtl ? 'ml-2' : 'mr-2'} text-amber-600`} />
                {isRtl ? 'أحدث الطلبات' : 'Latest Orders'}
              </h3>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                <AnimatePresence>
                  {sortedPendingOrders.length === 0 ? (
                    <p className="text-gray-500 text-sm">{isRtl ? 'لا توجد طلبات' : 'No orders available'}</p>
                  ) : (
                    sortedPendingOrders.map((order) => (
                      <motion.div
                        key={order.id}
                    
                        className="border border-amber-100 rounded-lg p-3 bg-amber-50/50 shadow-sm cursor-pointer hover:bg-amber-100 transition-all duration-200"
                        onClick={() => navigate(`/orders/${order.id}`)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-sm text-gray-800 truncate">
                            {isRtl ? `طلب رقم ${order.orderNumber}` : `Order #${order.orderNumber}`}
                          </h4>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              order.status === 'pending' || order.status === 'approved'
                                ? 'bg-amber-100 text-amber-800'
                                : order.status === 'in_production'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {isRtl
                              ? order.status === 'pending'
                                ? 'معلق'
                                : order.status === 'approved'
                                ? 'موافق عليه'
                                : order.status === 'in_production'
                                ? 'قيد الإنتاج'
                                : 'في الطريق'
                              : order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2 truncate">
                          {isRtl ? order.branchName : order.branchNameEn || order.branchName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {isRtl
                            ? `تم الإنشاء في: ${order.createdAt}`
                            : `Created At: ${order.createdAt}`}
                        </p>
                        {order.status === 'in_transit' && user.role === 'branch' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConfirmDelivery(order.id, order.branchId);
                            }}
                            className="mt-2 bg-green-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-700 transition-all duration-200"
                            aria-label={isRtl ? 'تأكيد التسليم' : 'Confirm Delivery'}
                          >
                            {isRtl ? 'تأكيد التسليم' : 'Confirm Delivery'}
                          </button>
                        )}
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div> 
            </div>
           
           
           
                                             

             </div>
             {['admin', 'production', 'branch'].includes(user.role) && renderLatestReturns()}


             

        
          <div>
                   {['admin', 'production'].includes(user.role) && renderBranchPerformance()}
                  {['admin', 'production'].includes(user.role) && renderChefPerformance()}
          </div>

                    

        </div>

        
              <div >
                          {user.role === 'branch' && renderLowStockItems()}
                          {user.role === 'branch' && renderRecentInventoryHistory()}
              </div>
      </>
    )}
  </div>
);
};

export default Dashboard;