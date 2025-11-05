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
  inventoryAPI,
} from '../services/api';
import { formatDate } from '../utils/formatDate';
import { ProductSearchInput, ProductDropdown } from './NewOrder';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';

// ==================== Interfaces ====================

export interface Chef {
  _id: string;
  userId: string;
  name: string;
  nameEn?: string;
  displayName: string;
  department: Array<{
    id: string;
    _id?: string;
    name: string;
    nameEn?: string;
    displayName?: string;
  }>;
  status?: 'active' | 'inactive';
}

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
  productName: string; // اسم المنتج
  productNameEn?: string;
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

// ==================== StatsCard ====================

const StatsCard: React.FC<{ title: string; value: string; icon: any; color: string }> = React.memo(
  ({ title, value, icon: Icon, color }) => (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: 1.03 }}
      className={`p-3 bg-gradient-to-br from-${color}-50 to-${color}-100 rounded-lg border border-${color}-200 shadow-sm cursor-pointer transition-all duration-200`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 text-${color}-600`} />
        <div>
          <p className="text-xs text-gray-600 font-medium">{title}</p>
          <p className="text-base font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </motion.div>
  )
);

// ==================== ChefDashboard ====================

const ChefDashboard: React.FC<{
  stats: Stats;
  tasks: Task[];
  isRtl: boolean;
  language: string;
  handleStartTask: (taskId: string, orderId: string) => void;
  handleCompleteTask: (taskId: string, orderId: string) => void;
}> = React.memo(({ stats, tasks, isRtl, language, handleStartTask, handleCompleteTask }) => {
  const [search, setSearch] = useState('');

  const filteredTasks = useMemo(() => {
    const term = search.toLowerCase();
    return tasks
      .filter(
        (t) =>
          (isRtl ? t.productName : t.productNameEn || t.productName)
            .toLowerCase()
            .includes(term) || t.orderNumber.includes(term)
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);
  }, [tasks, search, isRtl]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard title={isRtl ? 'إجمالي الطلبات' : 'Total Orders'} value={stats.totalOrders.toString()} icon={ShoppingCart} color="amber" />
        <StatsCard title={isRtl ? 'المهام المكتملة' : 'Completed'} value={stats.completedTasks.toString()} icon={CheckCircle} color="green" />
        <StatsCard title={isRtl ? 'قيد التنفيذ' : 'In Progress'} value={stats.inProgressTasks.toString()} icon={Clock} color="blue" />
        <StatsCard title={isRtl ? 'معلقة' : 'Pending'} value={stats.pendingOrders.toString()} icon={AlertCircle} color="red" />
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-3 gap-2">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <ChefHat className="w-4 h-4 text-amber-600" />
            {isRtl ? 'أحدث المهام' : 'Latest Tasks'}
          </h3>
          <ProductSearchInput
            value={search}
            onChange={setSearch}
            placeholder={isRtl ? 'ابحث في المهام...' : 'Search tasks...'}
            className="w-full sm:w-48"
          />
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {filteredTasks.length === 0 ? (
              <motion.p layout className="text-gray-500 text-xs text-center py-4">
                {isRtl ? 'لا توجد مهام' : 'No tasks'}
              </motion.p>
            ) : (
              filteredTasks.map((task) => (
                <motion.div
                  layout
                  key={task.id}
                  initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: isRtl ? -20 : 20 }}
                  className="p-3 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                >
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-medium text-xs">#{task.orderNumber}</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        task.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : task.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {isRtl
                        ? task.status === 'completed'
                          ? 'مكتمل'
                          : task.status === 'in_progress'
                          ? 'قيد التنفيذ'
                          : 'معلق'
                        : task.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    {task.quantity} {isRtl ? task.productName : task.productNameEn || task.productName}
                  </p>
                  <p className="text-xs text-gray-500">{formatDate(task.createdAt, language)}</p>
                  <div className="flex gap-2 mt-2">
                    {['pending', 'assigned'].includes(task.status) && (
                      <button
                        onClick={() => handleStartTask(task.id, task.orderId)}
                        className="text-xs px-2 py-1 bg-amber-600 text-white rounded hover:bg-amber-700"
                      >
                        {isRtl ? 'بدء' : 'Start'}
                      </button>
                    )}
                    {task.status === 'in_progress' && (
                      <button
                        onClick={() => handleCompleteTask(task.id, task.orderId)}
                        className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
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

// ==================== Dashboard Component ====================

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
  const [branches, setBranches] = useState<any[]>([]);
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
  const [inventorySearch, setInventorySearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const cache = useMemo(() => new Map<string, any>(), []);
  const cacheKey = useMemo(() => `${user?._id}-${user?.role}-${timeFilter}`, [user, timeFilter]);

  // ==================== Fetch Data ====================

  const fetchDashboardData = useCallback(
    debounce(async (forceRefresh = false) => {
      if (!user?._id) {
        setError(isRtl ? 'الوصول غير مصرح' : 'Unauthorized');
        setLoading(false);
        return;
      }

      if (!forceRefresh && cache.has(cacheKey)) {
        const data = cache.get(cacheKey);
        setOrders(data.orders);
        setTasks(data.tasks);
        setChefs(data.chefs);
        setBranches(data.branches);
        setReturns(data.returns);
        setInventory(data.inventory);
        setHistory(data.history);
        setBranchPerformance(data.branchPerformance);
        setChefPerformance(data.chefPerformance);
        setStats(data.stats);
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

        const query: any = { startDate: startDate.toISOString(), endDate: new Date().toISOString(), limit: 20 };

        let ordersResponse: any[] = [];
        let tasksResponse: any[] = [];
        let chefsResponse: any[] = [];
        let branchesResponse: any[] = [];
        let returnsResponse: any = { returns: [], total: 0 };
        let inventoryResponse: any[] = [];
        let historyResponse: any[] = [];

        if (user.role === 'chef') {
          const chefProfile = await chefsAPI.getByUserId(user._id);
          const chefId = chefProfile?._id;
          if (!chefId) throw new Error('Invalid chef');
          tasksResponse = await productionAssignmentsAPI.getChefTasks(chefId, { limit: 20 });
        } else {
          if (user.role === 'branch') query.branch = user._id;
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
            promises.push(inventoryAPI.getByBranch(user._id).catch(() => []));
            promises.push(inventoryAPI.getHistory({ branchId: user._id, limit: 20 }).catch(() => []));
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

        // Mapping
        const mappedOrders = ordersResponse.map((o: any) => ({
          id: o._id,
          orderNumber: o.orderNumber || 'Unknown',
          branchName: o.branch?.name || 'Unknown',
          branchNameEn: o.branch?.nameEn || o.branch?.name,
          branchId: o.branch?._id,
          items: (o.items || []).map((i: any) => ({
            _id: i._id,
            productId: i.product?._id,
            productName: i.product?.name,
            productNameEn: i.product?.nameEn,
            quantity: i.quantity,
            price: i.price,
            department: i.product?.department || { _id: 'unknown', name: 'Unknown' },
            assignedTo: i.assignedTo
              ? { _id: i.assignedTo._id, username: i.assignedTo.username, name: i.assignedTo.name, nameEn: i.assignedTo.nameEn }
              : undefined,
            status: i.status,
          })),
          status: o.status,
          totalAmount: o.totalAmount || 0,
          date: formatDate(o.createdAt, language),
          priority: o.priority || 'medium',
          createdBy: o.createdBy?.username || 'Unknown',
          createdAt: formatDate(o.createdAt, language),
        }));

        const mappedTasks = tasksResponse.map((t: any) => ({
          id: t._id,
          orderId: t.order?._id,
          orderNumber: t.order?.orderNumber,
          productId: t.product?._id,
          productName: t.product?.name,
          productNameEn: t.product?.nameEn,
          quantity: t.quantity,
          unit: t.product?.unit || 'N/A',
          unitEn: t.product?.unitEn || t.product?.unit,
          status: t.status,
          branchName: t.order?.branch?.name,
          branchNameEn: t.order?.branch?.nameEn,
          createdAt: formatDate(t.createdAt, language),
        }));

        const mappedChefs = chefsResponse.map((c: any) => ({
          _id: c._id,
          userId: c.user?._id,
          name: c.user?.name || c.name,
          nameEn: c.user?.nameEn || c.name,
          displayName: isRtl ? (c.user?.name || c.name) : (c.user?.nameEn || c.name),
          department: c.department ? [c.department] : [],
        }));

        const mappedBranches = branchesResponse.map((b: any) => ({
          _id: b._id,
          name: b.name,
          nameEn: b.nameEn,
        }));

        const mappedReturns = (returnsResponse.returns || []).map((r: any) => ({
          id: r._id,
          returnNumber: r.returnNumber,
          branchName: r.branch?.name,
          branchNameEn: r.branch?.nameEn,
          branchId: r.branch?._id,
          items: (r.items || []).map((i: any) => ({
            productId: i.product?._id,
            productName: i.product?.name,
            productNameEn: i.product?.nameEn,
            quantity: i.quantity,
            reason: i.reason,
            reasonEn: i.reasonEn,
          })),
          status: r.status,
          createdByName: r.createdBy?.name,
          createdByNameEn: r.createdBy?.nameEn,
          createdAt: formatDate(r.createdAt, language),
        }));

        const mappedInventory = inventoryResponse.map((i: any) => ({
          _id: i._id,
          product: i.product ? {
            _id: i.product._id,
            name: i.product.name,
            nameEn: i.product.nameEn,
            displayName: isRtl ? i.product.name : i.product.nameEn || i.product.name,
            displayUnit: isRtl ? i.product.unit : i.product.unitEn || i.product.unit,
            price: i.product.price,
          } : null,
          currentStock: i.currentStock,
          minStockLevel: i.minStockLevel,
        }));

        // سجل المخزون: "2 بسبوسة"
        const mappedHistory = historyResponse.map((h: any) => ({
          _id: h._id,
          date: formatDate(h.date || h.createdAt, language),
          type: h.type,
          quantity: h.quantity,
          productName: h.product?.name || 'منتج',
          productNameEn: h.product?.nameEn || h.product?.name,
        }));

        // Performance
        const branchPerf = mappedBranches.map((b: any) => {
          const branchOrders = mappedOrders.filter((o) => o.branchId === b._id);
          const total = branchOrders.length;
          const completed = branchOrders.filter((o) => ['completed', 'delivered'].includes(o.status)).length;
          return {
            branchName: b.name,
            branchNameEn: b.nameEn,
            branchId: b._id,
            performance: total > 0 ? (completed / total) * 100 : 0,
            totalOrders: total,
            completedOrders: completed,
          };
        }).filter((b) => b.totalOrders > 0);

        const chefPerf = mappedChefs.map((c: any) => {
          const chefTasks = mappedTasks.filter((t) => {
            const order = mappedOrders.find((o) => o.id === t.orderId);
            return order?.items.find((i) => i.assignedTo?._id === c._id);
          });
          const total = chefTasks.length;
          const completed = chefTasks.filter((t) => t.status === 'completed').length;
          return {
            chefId: c._id,
            chefName: c.name,
            chefNameEn: c.nameEn,
            performance: total > 0 ? (completed / total) * 100 : 0,
            totalTasks: total,
            completedTasks: completed,
          };
        }).filter((c) => c.totalTasks > 0);

        // Stats
        const totalOrders = user.role === 'chef' ? mappedTasks.length : mappedOrders.length;
        const pendingOrders = user.role === 'chef'
          ? mappedTasks.filter((t) => ['pending', 'assigned'].includes(t.status)).length
          : mappedOrders.filter((o) => o.status === 'pending').length;

        const statsData: Stats = {
          totalOrders,
          pendingOrders,
          inProductionOrders: mappedOrders.filter((o) => o.status === 'in_production').length,
          inTransitOrders: mappedOrders.filter((o) => o.status === 'in_transit').length,
          deliveredOrders: mappedOrders.filter((o) => o.status === 'delivered').length,
          totalOrderValue: mappedOrders.reduce((s, o) => s + o.totalAmount, 0),
          completedTasks: mappedTasks.filter((t) => t.status === 'completed').length,
          inProgressTasks: mappedTasks.filter((t) => t.status === 'in_progress').length,
          totalReturns: mappedReturns.length,
          pendingReturns: mappedReturns.filter((r) => r.status === 'pending_approval').length,
          approvedReturns: mappedReturns.filter((r) => r.status === 'approved').length,
          rejectedReturns: mappedReturns.filter((r) => r.status === 'rejected').length,
          averageOrderValue: totalOrders > 0 ? mappedOrders.reduce((s, o) => s + o.totalAmount, 0) / totalOrders : 0,
          totalInventoryValue: user.role === 'branch' ? mappedInventory.reduce((s, i) => s + (i.currentStock * (i.product?.price || 0)), 0) : 0,
          lowStockItems: user.role === 'branch' ? mappedInventory.filter((i) => i.currentStock <= i.minStockLevel).length : 0,
          averageProductionTime: 0,
          chefUtilizationRate: 0,
        };

        const cached = { orders: mappedOrders, tasks: mappedTasks, chefs: mappedChefs, branches: mappedBranches, returns: mappedReturns, inventory: mappedInventory, history: mappedHistory, branchPerformance: branchPerf, chefPerformance: chefPerf, stats: statsData };
        cache.set(cacheKey, cached);

        setOrders(mappedOrders);
        setTasks(mappedTasks);
        setChefs(mappedChefs);
        setBranches(mappedBranches);
        setReturns(mappedReturns);
        setInventory(mappedInventory);
        setHistory(mappedHistory);
        setBranchPerformance(branchPerf);
        setChefPerformance(chefPerf);
        setStats(statsData);
        setError('');
        setIsInitialLoad(false);
      } catch (err: any) {
        setError(isRtl ? 'فشل تحميل البيانات' : 'Failed to load data');
        toast.error(err.message || 'Error');
      } finally {
        setLoading(false);
      }
    }, 100),
    [user, timeFilter, cacheKey, isRtl, language]
  );

  useEffect(() => {
    fetchDashboardData();
    return () => fetchDashboardData.cancel();
  }, [fetchDashboardData]);

  // ==================== Socket Events ====================

  useEffect(() => {
    if (!socket || !isConnected || !user) return;

    const handlers = {
      taskAssigned: (data: any) => {
        if (data.chefId !== user._id && !['admin', 'production'].includes(user.role)) return;
        addNotification({ /* ... */ });
        fetchDashboardData(true);
      },
      // ... باقي الحدث
    };

    Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler));
    return () => Object.keys(handlers).forEach((e) => socket.off(e));
  }, [socket, isConnected, user, addNotification, fetchDashboardData]);

  // ==================== Handlers ====================

  const handleStartTask = useCallback(async (taskId: string, orderId: string) => {
    try {
      await productionAssignmentsAPI.updateTaskStatus(orderId, taskId, { status: 'in_progress' });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: 'in_progress' } : t)));
    } catch (err) {
      toast.error(isRtl ? 'فشل بدء المهمة' : 'Failed to start task');
    }
  }, []);

  const handleCompleteTask = useCallback(async (taskId: string, orderId: string) => {
    try {
      await productionAssignmentsAPI.updateTaskStatus(orderId, taskId, { status: 'completed' });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: 'completed' } : t)));
    } catch (err) {
      toast.error(isRtl ? 'فشل إكمال المهمة' : 'Failed to complete task');
    }
  }, []);

  // ==================== Render Sections ====================

  const renderInventoryHistory = () => (
    <motion.div layout className="bg-white p-4 rounded-lg shadow-sm border">
      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <Clock className="w-4 h-4 text-amber-600" />
        {isRtl ? 'سجل المخزون' : 'Inventory History'}
      </h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        <AnimatePresence>
          {history.slice(0, 8).map((entry) => (
            <motion.div
              layout
              key={entry._id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex justify-between text-xs p-2 border-b"
            >
              <div>
                <p className="font-medium">
                  {entry.quantity} {isRtl ? entry.productName : entry.productNameEn || entry.productName}
                </p>
                <p className="text-gray-500">{entry.type}</p>
              </div>
              <p className="text-gray-500">{entry.date}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );

  // ==================== Main Render ====================

  if (loading && isInitialLoad) return <LoadingSpinner />;
  if (error) return <div className="text-red-600 text-center p-4">{error}</div>;

  return (
    <div className={`max-w-7xl mx-auto px-4 py-6 ${isRtl ? 'rtl' : 'ltr'}`}>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-amber-600" />
          {isRtl ? 'لوحة التحكم' : 'Dashboard'}
        </h1>
        <ProductDropdown
          value={timeFilter}
          onChange={setTimeFilter}
          options={timeFilterOptions.map((o) => ({ value: o.value, label: isRtl ? o.label : o.enLabel }))}
          className="w-40"
        />
      </div>

      {user?.role === 'chef' ? (
        <ChefDashboard
          stats={stats}
          tasks={tasks}
          isRtl={isRtl}
          language={language}
          handleStartTask={handleStartTask}
          handleCompleteTask={handleCompleteTask}
        />
      ) : (
        <div className="space-y-6">
          <motion.div layout className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Stats Cards */}
          </motion.div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {renderInventoryHistory()}
            {/* باقي الأقسام */}
          </div>
        </div>
      )}
    </div>
  );
};