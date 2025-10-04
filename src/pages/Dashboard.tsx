import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useNotifications } from '../contexts/NotificationContext';
import { ShoppingCart, Clock, BarChart3, CheckCircle, AlertCircle, Package, DollarSign, ChefHat } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { ordersAPI, productionAssignmentsAPI, chefsAPI, branchesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { useQuery, useQueryClient, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

// Query Client
const queryClient = new QueryClient();

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
  _id: string;
  orderId: string;
  orderNumber: string;
  productName: string;
  productNameEn?: string;
  quantity: number;
  unit: string;
  unitEn?: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed';
  branchName: string;
  branchNameEn?: string;
  chefId?: string;
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
  chefName: string;
  chefNameEn?: string;
  performance: number;
  totalTasks: number;
  completedTasks: number;
}

interface Order {
  _id: string;
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
    department: { _id: string; displayName: string };
    assignedTo?: { _id: string; username: string; displayName: string };
    status: 'pending' | 'assigned' | 'in_progress' | 'completed';
    returnedQuantity?: number;
    returnReason?: string;
    returnReasonEn?: string;
  }>;
  returns?: Array<{
    _id: string;
    status: 'pending_approval' | 'approved' | 'rejected';
    items: Array<{
      productId: string;
      quantity: number;
      reason: string;
      reasonEn?: string;
    }>;
    reviewNotes?: string;
    reviewNotesEn?: string;
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
  displayName: string;
  nameEn?: string;
  department: { _id: string; displayName: string } | null;
}

interface FilterState {
  status: 'all' | 'pending' | 'assigned' | 'in_progress' | 'completed';
  search: string;
  page: number; // إضافة للـ pagination
}

const timeFilterOptions = [
  { value: 'day', label: 'اليوم', enLabel: 'Today' },
  { value: 'week', label: 'هذا الأسبوع', enLabel: 'This Week' },
  { value: 'month', label: 'هذا الشهر', enLabel: 'This Month' },
  { value: 'year', label: 'هذا العام', enLabel: 'This Year' },
];

// Loading Skeleton
const Skeleton: React.FC<{ lines?: number }> = ({ lines = 4 }) => (
  <div className="space-y-2 animate-pulse">
    {[...Array(lines)].map((_, i) => (
      <div key={i} className="h-4 bg-gray-200 rounded"></div>
    ))}
  </div>
);

// StatsCard
const StatsCard: React.FC<{ title: string; value: string; icon: React.FC; color: string; ariaLabel: string }> = React.memo(
  ({ title, value, icon: Icon, color, ariaLabel }) => (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`p-4 bg-${color}-50 rounded-lg border border-${color}-100 cursor-pointer hover:bg-${color}-100 transition-colors duration-200`}
      role="button"
      aria-label={ariaLabel}
      tabIndex={0}
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

// Performance Charts
const ChefPerformanceChart: React.FC<{ data: ChefPerformance[]; isRtl: boolean }> = ({ data, isRtl }) => (
  <ResponsiveContainer width="100%" height={200}>
    <BarChart data={data} layout={isRtl ? 'vertical' : 'horizontal'} dir={isRtl ? 'rtl' : 'ltr'}>
      <XAxis dataKey={isRtl ? 'chefName' : 'chefNameEn'} type="category" hide />
      <YAxis type="number" domain={[0, 100]} hide />
      <Tooltip formatter={(value) => [`${value.toFixed(1)}%`, isRtl ? 'الأداء' : 'Performance']} />
      <Bar dataKey="performance" fill="#10B981" radius={[4, 4, 0, 0]} />
    </BarChart>
  </ResponsiveContainer>
);

const BranchPerformanceChart: React.FC<{ data: BranchPerformance[]; isRtl: boolean }> = ({ data, isRtl }) => (
  <ResponsiveContainer width="100%" height={200}>
    <BarChart data={data} layout={isRtl ? 'vertical' : 'horizontal'} dir={isRtl ? 'rtl' : 'ltr'}>
      <XAxis dataKey={isRtl ? 'branchName' : 'branchNameEn'} type="category" hide />
      <YAxis type="number" domain={[0, 100]} hide />
      <Tooltip formatter={(value) => [`${value.toFixed(1)}%`, isRtl ? 'الأداء' : 'Performance']} />
      <Bar dataKey="performance" fill="#F59E0B" radius={[4, 4, 0, 0]} />
    </BarChart>
  </ResponsiveContainer>
);

// ChefDashboard
const ChefDashboard: React.FC<{
  stats: Stats;
  tasks: Task[];
  chefs: Chef[];
  chefPerformance: ChefPerformance[];
  isRtl: boolean;
  language: string;
  handleStartTask: (taskId: string, orderId: string) => void;
  handleCompleteTask: (taskId: string, orderId: string) => void;
}> = React.memo(({ stats, tasks, chefs, chefPerformance, isRtl, language, handleStartTask, handleCompleteTask }) => {
  const [filter, setFilter] = useState<FilterState>({ status: 'all', search: '', page: 1 });
  const tasksPerPage = 10;

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

  const paginatedTasks = useMemo(() => 
    filteredTasks.slice((filter.page - 1) * tasksPerPage, filter.page * tasksPerPage),
    [filteredTasks, filter.page]
  );

  const chefPerfData = useMemo(() => 
    chefPerformance.map((p) => ({ ...p, chefName: isRtl ? p.chefName : p.chefNameEn || p.chefName })),
    [chefPerformance, isRtl]
  );

  return (
    <div className={`space-y-4 ${isRtl ? 'text-right' : 'text-left'}`}>
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
        <StatsCard
          title={isRtl ? 'إجمالي المهام' : 'Total Tasks'}
          value={(stats.completedTasks + stats.inProgressTasks + tasks.filter(t => t.status === 'pending' || t.status === 'assigned').length).toString()}
          icon={ShoppingCart}
          color="amber"
          ariaLabel={isRtl ? 'إجمالي المهام' : 'Total Tasks'}
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
          title={isRtl ? 'المهام المعلقة' : 'Pending Tasks'}
          value={tasks.filter(t => t.status === 'pending' || t.status === 'assigned').length.toString()}
          icon={AlertCircle}
          color="red"
          ariaLabel={isRtl ? 'المهام المعلقة' : 'Pending Tasks'}
        />
      </div>

      {chefPerfData.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <h3 className={`text-lg font-semibold mb-3 flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
            <span className="flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-green-600" />
              {isRtl ? 'أداء الشيفات' : 'Chef Performance'}
            </span>
          </h3>
          <ChefPerformanceChart data={chefPerfData} isRtl={isRtl} />
        </div>
      )}

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div className={`flex flex-col sm:flex-row items-center justify-between mb-4 gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <h3 className={`text-lg font-semibold text-gray-800 flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <ChefHat className="w-5 h-5 text-amber-600" />
            {isRtl ? 'المهام الخاصة بك' : 'Your Tasks'}
          </h3>
          <div className={`flex items-center gap-3 w-full sm:w-auto ${isRtl ? 'flex-row-reverse' : ''}`}>
            <select
              value={filter.status}
              onChange={(e) => setFilter((prev) => ({ ...prev, status: e.target.value as FilterState['status'], page: 1 }))}
              className="w-full sm:w-48 p-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
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
              onChange={(e) => setFilter((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
              placeholder={isRtl ? 'ابحث عن اسم المنتج أو رقم الطلب' : 'Search by product name or order number'}
              className="w-full sm:w-48 p-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
              aria-label={isRtl ? 'البحث' : 'Search'}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className={`px-3 py-2 text-xs font-medium text-gray-500 ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'رقم الطلب' : 'Order #'}</th>
                <th className={`px-3 py-2 text-xs font-medium text-gray-500 ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'المنتج' : 'Product'}</th>
                <th className={`px-3 py-2 text-xs font-medium text-gray-500 ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'الكمية' : 'Quantity'}</th>
                <th className={`px-3 py-2 text-xs font-medium text-gray-500 ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'الحالة' : 'Status'}</th>
                <th className={`px-3 py-2 text-xs font-medium text-gray-500 ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'التاريخ' : 'Date'}</th>
                <th className={`px-3 py-2 text-xs font-medium text-gray-500 ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <AnimatePresence>
                {paginatedTasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-gray-500 text-sm">{isRtl ? 'لا توجد مهام' : 'No tasks available'}</td>
                  </tr>
                ) : (
                  paginatedTasks.map((task) => (
                    <motion.tr
                      key={task._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-3 py-4 text-sm text-gray-900">{task.orderNumber}</td>
                      <td className="px-3 py-4 text-sm text-gray-900">{isRtl ? task.productName : task.productNameEn || task.productName}</td>
                      <td className="px-3 py-4 text-sm text-gray-900">{task.quantity} {isRtl ? task.unit : task.unitEn || task.unit}</td>
                      <td className="px-3 py-4">
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
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500">{task.createdAt}</td>
                      <td className="px-3 py-4">
                        <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                          {(task.status === 'pending' || task.status === 'assigned') && (
                            <button
                              onClick={() => handleStartTask(task._id, task.orderId)}
                              className="bg-amber-600 text-white px-3 py-1 rounded text-xs hover:bg-amber-700 transition-colors"
                              aria-label={isRtl ? 'بدء المهمة' : 'Start Task'}
                            >
                              {isRtl ? 'بدء' : 'Start'}
                            </button>
                          )}
                          {task.status === 'in_progress' && (
                            <button
                              onClick={() => handleCompleteTask(task._id, task.orderId)}
                              className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 transition-colors"
                              aria-label={isRtl ? 'إكمال المهمة' : 'Complete Task'}
                            >
                              {isRtl ? 'إكمال' : 'Complete'}
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
        {filteredTasks.length > tasksPerPage && (
          <div className={`flex justify-between mt-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <button
              disabled={filter.page === 1}
              onClick={() => setFilter((prev) => ({ ...prev, page: prev.page - 1 }))}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded disabled:opacity-50"
            >
              {isRtl ? 'التالي' : 'Previous'}
            </button>
            <span className="text-sm text-gray-600">
              {isRtl ? `صفحة ${filter.page} من ${Math.ceil(filteredTasks.length / tasksPerPage)}` : `Page ${filter.page} of ${Math.ceil(filteredTasks.length / tasksPerPage)}`}
            </span>
            <button
              disabled={filter.page >= Math.ceil(filteredTasks.length / tasksPerPage)}
              onClick={() => setFilter((prev) => ({ ...prev, page: prev.page + 1 }))}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded disabled:opacity-50"
            >
              {isRtl ? 'السابق' : 'Next'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

// Dashboard الرئيسي
const Dashboard: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  const [timeFilter, setTimeFilter] = useState('week');
  const queryClient = useQueryClient();

  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['dashboard', user?._id, user?.role, timeFilter],
    queryFn: async () => {
      if (!user?._id) throw new Error(isRtl ? 'لا يوجد معرف مستخدم' : 'No user ID');
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
          startDate = new Date(now.setDate(now.getDate() - 7));
      }
      const query = { startDate: startDate.toISOString(), endDate: now.toISOString(), limit: 20 };

      let ordersResponse: any[] = [], tasksResponse: any[] = [], chefsResponse: any[] = [], branchesResponse: any[] = [];
      if (user.role === 'chef') {
        const chefProfile = await chefsAPI.getByUserId(user._id);
        if (!chefProfile?._id) throw new Error(isRtl ? 'بيانات الشيف غير صالحة' : 'Invalid chef data');
        tasksResponse = await productionAssignmentsAPI.getChefTasks(chefProfile._id, query);
      } else {
        if (user.role === 'branch') query.branch = user._id;
        if (user.role === 'production' && user.department) query.departmentId = user.department._id;
        [ordersResponse, tasksResponse, chefsResponse, branchesResponse] = await Promise.all([
          ordersAPI.getAll(query).catch(() => []),
          productionAssignmentsAPI.getAllTasks(query).catch(() => []),
          ['admin', 'production'].includes(user.role) ? chefsAPI.getAll().catch(() => []) : [],
          ['admin', 'production'].includes(user.role) ? branchesAPI.getAll().catch(() => []) : [],
        ]);
      }

      const mappedOrders: Order[] = ordersResponse.map((order: any) => ({
        _id: order._id,
        orderNumber: order.orderNumber || (isRtl ? 'غير معروف' : 'Unknown'),
        branchName: order.branch?.displayName || order.branch?.name || (isRtl ? 'فرع غير معروف' : 'Unknown Branch'),
        branchNameEn: order.branch?.nameEn,
        branchId: order.branch?._id,
        items: (order.items || []).map((item: any) => ({
          _id: item._id,
          productId: item.product?._id,
          productName: item.product?.displayName || item.product?.name || (isRtl ? 'منتج غير معروف' : 'Unknown Product'),
          productNameEn: item.product?.nameEn,
          quantity: Number(item.quantity) || 1,
          price: Number(item.price) || 0,
          department: {
            _id: item.product?.department?._id || 'unknown',
            displayName: item.product?.department?.displayName || item.product?.department?.name || (isRtl ? 'قسم غير معروف' : 'Unknown Department')
          },
          status: item.status || 'pending',
          assignedTo: item.assignedTo ? {
            _id: item.assignedTo._id,
            username: item.assignedTo.username,
            displayName: item.assignedTo.displayName || item.assignedTo.name || (isRtl ? 'شيف غير معروف' : 'Unknown Chef')
          } : undefined,
          returnedQuantity: Number(item.returnedQuantity) || 0,
          returnReason: item.returnReason || '',
          returnReasonEn: item.returnReasonEn || '',
        })),
        status: order.status || 'pending',
        totalAmount: Number(order.adjustedTotal || order.totalAmount) || 0,
        date: formatDate(order.createdAt, language),
        priority: order.priority || 'medium',
        createdBy: order.createdBy?.displayName || (isRtl ? 'غير معروف' : 'Unknown'),
        createdAt: order.createdAt,
        returns: (order.returns || []).map((ret: any) => ({
          _id: ret._id,
          status: ret.status || 'pending_approval',
          items: (ret.items || []).map((item: any) => ({
            productId: item.product?._id,
            quantity: Number(item.quantity) || 0,
            reason: item.displayReason || item.reason || '',
            reasonEn: item.reasonEn,
          })),
          reviewNotes: ret.reviewNotes || '',
          reviewNotesEn: ret.reviewNotesEn,
          createdAt: formatDate(ret.createdAt, language),
        })),
      }));

      const mappedTasks: Task[] = tasksResponse.map((task: any) => ({
        _id: task._id,
        orderId: task.order?._id,
        orderNumber: task.order?.orderNumber || (isRtl ? 'غير معروف' : 'Unknown'),
        productName: task.product?.displayName || task.product?.name || (isRtl ? 'منتج غير معروف' : 'Unknown Product'),
        productNameEn: task.product?.nameEn,
        quantity: Number(task.quantity) || 0,
        unit: task.product?.displayUnit || task.product?.unit || 'unit',
        unitEn: task.product?.unitEn,
        status: task.status || 'pending',
        branchName: task.order?.branch?.displayName || task.order?.branch?.name || (isRtl ? 'فرع غير معروف' : 'Unknown Branch'),
        branchNameEn: task.order?.branch?.nameEn,
        chefId: task.chef?._id,
        createdAt: formatDate(task.createdAt, language),
      }));

      const mappedChefs: Chef[] = chefsResponse.map((chef: any) => ({
        _id: chef._id,
        userId: chef.user?._id || chef._id,
        username: chef.user?.username || (isRtl ? 'شيف غير معروف' : 'Unknown Chef'),
        displayName: chef.user?.displayName || chef.user?.name || (isRtl ? 'شيف غير معروف' : 'Unknown Chef'),
        nameEn: chef.user?.nameEn,
        department: chef.department ? { _id: chef.department._id, displayName: chef.department.displayName || chef.department.name } : null,
      }));

      const mappedBranches = branchesResponse
        .map((branch: any) => ({
          _id: branch._id,
          name: branch.displayName || branch.name || (isRtl ? 'فرع غير معروف' : 'Unknown Branch'),
          nameEn: branch.nameEn,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const branchPerf: BranchPerformance[] = mappedBranches.map((branch) => {
        const branchOrders = mappedOrders.filter((o) => o.branchId === branch._id);
        const total = branchOrders.length;
        const completed = branchOrders.filter((o) => o.status === 'completed' || o.status === 'delivered').length;
        const perf = total > 0 ? (completed / total) * 100 : 0;
        return { branchName: branch.name, branchNameEn: branch.nameEn, performance: perf, totalOrders: total, completedOrders: completed };
      }).filter((b) => b.totalOrders > 0);

      const chefPerf: ChefPerformance[] = mappedChefs.map((chef) => {
        const chefTasks = mappedTasks.filter((task) => task.chefId === chef._id);
        const total = chefTasks.length;
        const completed = chefTasks.filter((t) => t.status === 'completed').length;
        const perf = total > 0 ? (completed / total) * 100 : 0;
        return { chefName: chef.displayName, chefNameEn: chef.nameEn, performance: perf, totalTasks: total, completedTasks: completed };
      }).filter((c) => c.totalTasks > 0);

      const totalOrders = user.role === 'chef' ? mappedTasks.length : mappedOrders.length;
      const pendingOrders = user.role === 'chef' ? mappedTasks.filter((t) => t.status === 'pending' || t.status === 'assigned').length : mappedOrders.filter((o) => o.status === 'pending').length;
      const inProductionOrders = mappedOrders.filter((o) => o.status === 'in_production').length;
      const inTransitOrders = mappedOrders.filter((o) => o.status === 'in_transit').length;
      const deliveredOrders = mappedOrders.filter((o) => o.status === 'delivered').length;
      const totalSales = mappedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      const completedTasks = mappedTasks.filter((t) => t.status === 'completed').length;
      const inProgressTasks = mappedTasks.filter((t) => t.status === 'in_progress').length;
      const returns = mappedOrders.reduce((sum, o) => sum + (o.returns?.length || 0), 0);
      const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

      return {
        orders: mappedOrders,
        tasks: mappedTasks,
        chefs: mappedChefs,
        branches: mappedBranches,
        branchPerformance: branchPerf,
        chefPerformance: chefPerf,
        stats: { totalOrders, pendingOrders, inProductionOrders, inTransitOrders, deliveredOrders, totalSales, completedTasks, inProgressTasks, returns, averageOrderValue },
      };
    },
    enabled: !!user?._id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const dashboard = dashboardData || {
    orders: [], tasks: [], chefs: [], branches: [], branchPerformance: [], chefPerformance: [],
    stats: { totalOrders: 0, pendingOrders: 0, inProductionOrders: 0, inTransitOrders: 0, deliveredOrders: 0, totalSales: 0, completedTasks: 0, inProgressTasks: 0, returns: 0, averageOrderValue: 0 }
  };

  // Socket listeners
  useEffect(() => {
    if (!socket || !isConnected || !user) return;

    const handleTaskAssigned = (data: any) => {
      if (!data.taskId || !data.orderId || !data.chefId) return;
      if (data.chefId === user._id || ['admin', 'production'].includes(user.role)) {
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        if (user.role === 'chef') {
          dashboard.tasks.unshift({
            _id: data.taskId,
            orderId: data.orderId,
            orderNumber: data.orderNumber || (isRtl ? 'غير معروف' : 'Unknown'),
            productName: data.productName || (isRtl ? 'منتج غير معروف' : 'Unknown Product'),
            productNameEn: data.productNameEn,
            quantity: Number(data.quantity) || 0,
            unit: data.unit || 'unit',
            unitEn: data.unitEn,
            status: 'assigned',
            branchName: data.branchName || (isRtl ? 'فرع غير معروف' : 'Unknown Branch'),
            branchNameEn: data.branchNameEn,
            chefId: data.chefId,
            createdAt: formatDate(new Date(), language),
          });
        }
        addNotification({
          _id: `task-${data.taskId}`,
          type: 'info',
          message: isRtl ? `تم تعيين مهمة: ${data.productName}` : `Task assigned: ${data.productName}`,
          read: false,
          createdAt: formatDate(new Date(), language),
          data: { orderId: data.orderId, taskId: data.taskId },
          sound: '/sounds/task-assigned.mp3',
          vibrate: [400, 100, 400],
          path: '/dashboard',
        });
      }
    };

    const handleItemStatusUpdated = (data: any) => {
      if (!data.itemId || !data.orderId || !data.status) return;
      dashboard.tasks = dashboard.tasks.map((task) => task._id === data.itemId ? { ...task, status: data.status } : task);
      addNotification({
        _id: `status-${data.itemId}`,
        type: 'info',
        message: isRtl ? `تحديث حالة: ${data.status === 'in_progress' ? 'قيد التنفيذ' : 'مكتمل'}` : `Status updated: ${data.status}`,
        read: false,
        createdAt: formatDate(new Date(), language),
        path: '/dashboard',
      });
    };

    socket.on('taskAssigned', handleTaskAssigned);
    socket.on('itemStatusUpdated', handleItemStatusUpdated);
    socket.on('orderCompleted', () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }));

    return () => {
      socket.off('taskAssigned', handleTaskAssigned);
      socket.off('itemStatusUpdated', handleItemStatusUpdated);
      socket.off('orderCompleted');
    };
  }, [socket, isConnected, user, queryClient, dashboard.tasks, addNotification, isRtl, language]);

  const handleStartTask = useCallback(async (taskId: string, orderId: string) => {
    if (!isConnected) {
      toast.error(isRtl ? 'الاتصال بالسوكت غير متاح' : 'Socket disconnected');
      return;
    }
    try {
      await productionAssignmentsAPI.updateTaskStatus(orderId, taskId, { status: 'in_progress' });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      socket.emit('itemStatusUpdated', {
        orderId,
        itemId: taskId,
        status: 'in_progress',
        chefId: user?._id,
        orderNumber: dashboard.tasks.find(t => t._id === taskId)?.orderNumber,
        branchName: dashboard.tasks.find(t => t._id === taskId)?.branchName,
        productName: dashboard.tasks.find(t => t._id === taskId)?.productName,
        quantity: dashboard.tasks.find(t => t._id === taskId)?.quantity,
        unit: dashboard.tasks.find(t => t._id === taskId)?.unit,
      });
      toast.success(isRtl ? 'تم بدء المهمة' : 'Task started');
    } catch (err: any) {
      toast.error(err.message || (isRtl ? 'فشل في بدء المهمة' : 'Failed to start task'));
    }
  }, [queryClient, socket, isConnected, user, isRtl, dashboard.tasks]);

  const handleCompleteTask = useCallback(async (taskId: string, orderId: string) => {
    if (!isConnected) {
      toast.error(isRtl ? 'الاتصال بالسوكت غير متاح' : 'Socket disconnected');
      return;
    }
    try {
      await productionAssignmentsAPI.updateTaskStatus(orderId, taskId, { status: 'completed' });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      socket.emit('itemStatusUpdated', {
        orderId,
        itemId: taskId,
        status: 'completed',
        chefId: user?._id,
        orderNumber: dashboard.tasks.find(t => t._id === taskId)?.orderNumber,
        branchName: dashboard.tasks.find(t => t._id === taskId)?.branchName,
        productName: dashboard.tasks.find(t => t._id === taskId)?.productName,
        quantity: dashboard.tasks.find(t => t._id === taskId)?.quantity,
        unit: dashboard.tasks.find(t => t._id === taskId)?.unit,
      });
      toast.success(isRtl ? 'تم إكمال المهمة' : 'Task completed');
    } catch (err: any) {
      toast.error(err.message || (isRtl ? 'فشل في إكمال المهمة' : 'Failed to complete task'));
    }
  }, [queryClient, socket, isConnected, user, isRtl, dashboard.tasks]);

  const sortedPendingOrders = useMemo(() => 
    dashboard.orders
      .filter((order) => ['pending', 'approved', 'in_production'].includes(order.status))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8),
    [dashboard.orders]
  );

  const renderStats = useCallback(() => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-4 ${isRtl ? 'flex-row-reverse' : ''}`}
    >
      <StatsCard title={isRtl ? 'إجمالي الطلبات' : 'Total Orders'} value={dashboard.stats.totalOrders.toString()} icon={ShoppingCart} color="amber" ariaLabel={isRtl ? 'إجمالي الطلبات' : 'Total Orders'} />
      <StatsCard title={isRtl ? 'الطلبات المعلقة' : 'Pending Orders'} value={dashboard.stats.pendingOrders.toString()} icon={AlertCircle} color="red" ariaLabel={isRtl ? 'الطلبات المعلقة' : 'Pending Orders'} />
      <StatsCard title={isRtl ? 'قيد الإنتاج' : 'In Production'} value={dashboard.stats.inProductionOrders.toString()} icon={BarChart3} color="blue" ariaLabel={isRtl ? 'قيد الإنتاج' : 'In Production'} />
      <StatsCard title={isRtl ? 'قيد النقل' : 'In Transit'} value={dashboard.stats.inTransitOrders.toString()} icon={Package} color="teal" ariaLabel={isRtl ? 'قيد النقل' : 'In Transit'} />
      <StatsCard title={isRtl ? 'المسلمة' : 'Delivered'} value={dashboard.stats.deliveredOrders.toString()} icon={CheckCircle} color="green" ariaLabel={isRtl ? 'المسلمة' : 'Delivered'} />
      <StatsCard title={isRtl ? 'المبيعات' : 'Sales'} value={dashboard.stats.totalSales.toLocaleString(language, { style: 'currency', currency: 'SAR' })} icon={DollarSign} color="purple" ariaLabel={isRtl ? 'المبيعات' : 'Sales'} />
      <StatsCard title={isRtl ? 'المرتجعات' : 'Returns'} value={dashboard.stats.returns.toString()} icon={AlertCircle} color="pink" ariaLabel={isRtl ? 'المرتجعات' : 'Returns'} />
      <StatsCard title={isRtl ? 'متوسط الطلب' : 'Avg Order'} value={dashboard.stats.averageOrderValue.toLocaleString(language, { style: 'currency', currency: 'SAR' })} icon={DollarSign} color="amber" ariaLabel={isRtl ? 'متوسط الطلب' : 'Avg Order'} />
    </motion.div>
  ), [dashboard.stats, isRtl, language]);

  const renderPendingItems = useCallback(() => (
    <div className="bg-white p-4 rounded-lg shadow-sm mb-4 border border-gray-100">
      <h3 className={`text-lg font-semibold mb-3 flex items-center gap-2 text-gray-800 ${isRtl ? 'flex-row-reverse' : ''}`}>
        <Clock className="w-5 h-5 text-gray-600" />
        {isRtl ? 'أحدث الطلبات المعلقة' : 'Latest Pending Orders'}
      </h3>
      {isLoading ? <Skeleton lines={4} /> : (
        <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
          {sortedPendingOrders.length === 0 ? (
            <p className="text-center text-gray-600 col-span-full text-sm">{isRtl ? 'لا توجد طلبات معلقة' : 'No pending orders'}</p>
          ) : (
            <AnimatePresence>
              {sortedPendingOrders.map((order, index) => (
                <motion.div
                  key={order._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => navigate(`/orders/${order._id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/orders/${order._id}`)}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors shadow-sm"
                  role="button"
                  tabIndex={0}
                >
                  <h4 className="font-semibold text-sm text-gray-800 mb-2 truncate">
                    {order.orderNumber} - {isRtl ? order.branchName : order.branchNameEn || order.branchName}
                  </h4>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      order.status === 'pending' ? 'bg-amber-100 text-amber-800' : order.status === 'approved' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {isRtl
                      ? order.status === 'pending' ? 'معلق' : order.status === 'approved' ? 'معتمد' : 'قيد الإنتاج'
                      : order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>
                  <p className="text-sm text-gray-600 mt-2">{isRtl ? 'الإجمالي' : 'Total'}: {order.totalAmount.toLocaleString(language, { style: 'currency', currency: 'SAR' })}</p>
                  <p className="text-xs text-gray-500 mt-1">{isRtl ? 'المنتجات' : 'Items'}: {order.items.reduce((sum, i) => sum + i.quantity, 0)}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}
    </div>
  ), [sortedPendingOrders, isLoading, isRtl, language, navigate]);

  const renderBranchPerformance = useCallback(() => (
    <div className="bg-white p-4 rounded-lg shadow-sm mb-4 border border-gray-100">
      <h3 className={`text-lg font-semibold mb-3 flex items-center gap-2 text-gray-800 ${isRtl ? 'flex-row-reverse' : ''}`}>
        <BarChart3 className="w-5 h-5 text-gray-600" />
        {isRtl ? 'أداء الفروع' : 'Branch Performance'}
      </h3>
      {isLoading ? <Skeleton lines={3} /> : (
        <BranchPerformanceChart data={dashboard.branchPerformance} isRtl={isRtl} />
      )}
    </div>
  ), [dashboard.branchPerformance, isLoading, isRtl]);

  const renderChefPerformance = useCallback(() => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
      <h3 className={`text-lg font-semibold mb-3 flex items-center gap-2 text-gray-800 ${isRtl ? 'flex-row-reverse' : ''}`}>
        <BarChart3 className="w-5 h-5 text-gray-600" />
        {isRtl ? 'أداء الشيفات' : 'Chef Performance'}
      </h3>
      {isLoading ? <Skeleton lines={3} /> : (
        <ChefPerformanceChart data={dashboard.chefPerformance} isRtl={isRtl} />
      )}
    </div>
  ), [dashboard.chefPerformance, isLoading, isRtl]);

  const renderContent = useCallback(() => {
    if (error) {
      return (
        <div className="p-4 text-center bg-red-50 rounded-lg shadow-sm border border-red-100">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
          <p className="text-red-600 text-lg font-medium mb-4">{error.message || (isRtl ? 'خطأ في التحميل' : 'Loading error')}</p>
          <button
            onClick={() => { localStorage.clear(); navigate('/login'); }}
            className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 text-sm transition-colors"
          >
            {isRtl ? 'إعادة تسجيل الدخول' : 'Re-login'}
          </button>
        </div>
      );
    }

    if (isLoading) return <div className="flex justify-center items-center h-64"><Skeleton lines={4} /></div>;

    switch (user?.role) {
      case 'chef':
        return (
          <ChefDashboard
            stats={dashboard.stats}
            tasks={dashboard.tasks}
            chefs={dashboard.chefs}
            chefPerformance={dashboard.chefPerformance}
            isRtl={isRtl}
            language={language}
            handleStartTask={handleStartTask}
            handleCompleteTask={handleCompleteTask}
          />
        );
      case 'branch':
        return (
          <>
            {renderStats()}
            {renderPendingItems()}
          </>
        );
      default:
        return (
          <>
            {renderStats()}
            {renderPendingItems()}
            {user?.role === 'admin' && renderBranchPerformance()}
            {['admin', 'production'].includes(user?.role || '') && renderChefPerformance()}
          </>
        );
    }
  }, [error, isLoading, user?.role, dashboard, isRtl, language, renderStats, renderPendingItems, renderBranchPerformance, renderChefPerformance, handleStartTask, handleCompleteTask]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className={`mx-auto px-2 sm:px-3 lg:px-4 py-3 min-h-screen`} dir={isRtl ? 'rtl' : 'ltr'}>
        <div className={`flex justify-end mb-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="w-full sm:w-36 p-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-amber-500 bg-white"
            aria-label={isRtl ? 'الفترة الزمنية' : 'Time Period'}
          >
            {timeFilterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {isRtl ? opt.label : opt.enLabel}
              </option>
            ))}
          </select>
        </div>
        {renderContent()}
      </div>
    </QueryClientProvider>
  );
};

export default Dashboard;