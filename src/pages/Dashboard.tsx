import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useNotifications } from '../contexts/NotificationContext';
import { ShoppingCart, Clock, BarChart3, CheckCircle, AlertCircle, Package, DollarSign, ChefHat, RotateCcw, ChevronDown, BarChart, Table } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import { ordersAPI, productionAssignmentsAPI, chefsAPI, branchesAPI, returnsAPI, inventoryAPI, salesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

// Interfaces
interface Stats {
  totalOrders: number;
  pendingOrders: number;
  inProductionOrders: number;
  inTransitOrders: number;
  deliveredOrders: number;
  totalInventoryValue: number;
  completedTasks: number;
  inProgressTasks: number;
  totalReturns: number;
  pendingReturns: number;
  approvedReturns: number;
  rejectedReturns: number;
  averageOrderValue: number;
}

interface Task {
  id: string;
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

interface SalesAnalytics {
  totalSales: number;
  totalCount: number;
  averageOrderValue: number;
  returnRate: string;
  topProduct: {
    productId: string | null;
    productName: string;
    productNameEn?: string;
    displayName: string;
    totalQuantity: number;
    totalRevenue: number;
  };
  productSales: Array<{
    productId: string;
    productName: string;
    productNameEn?: string;
    displayName: string;
    totalQuantity: number;
    totalRevenue: number;
  }>;
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

const translations = {
  ar: {
    dashboard: 'لوحة التحكم',
    totalOrders: 'إجمالي الطلبات',
    pendingOrders: 'الطلبات المعلقة',
    inProduction: 'الطلبات قيد الإنتاج',
    deliveredOrders: 'الطلبات المسلمة',
    totalInventoryValue: 'إجمالي قيمة المخزون',
    completedTasks: 'المهام المكتملة',
    inProgressTasks: 'المهام قيد التنفيذ',
    totalReturns: 'إجمالي المرتجعات',
    pendingReturns: 'المرتجعات المعلقة',
    approvedReturns: 'المرتجعات الموافق عليها',
    rejectedReturns: 'المرتجعات المرفوضة',
    latestOrders: 'أحدث الطلبات',
    latestReturns: 'أحدث المرتجعات',
    branchPerformance: 'أداء الفروع',
    chefPerformance: 'أداء الطهاة',
    noData: 'لا توجد بيانات',
    noTasks: 'لا توجد مهام',
    noReturns: 'لا توجد مرتجعات',
    timeFilter: 'تصفية حسب الوقت',
    salesSummary: 'ملخص المبيعات',
    totalSales: 'إجمالي المبيعات',
    averageOrderValue: 'متوسط قيمة الطلب',
    returnRate: 'نسبة الإرجاع',
    topProduct: 'المنتج الأكثر مبيعًا',
    viewTable: 'عرض الجدول',
    viewChart: 'عرض الرسم البياني',
    errors: {
      unauthorized: 'الوصول غير مصرح به',
      serverError: 'خطأ في الخادم',
      socketError: 'خطأ في الاتصال بالسوكت',
      invalidChef: 'بيانات الشيف غير صالحة',
      fetchSales: 'خطأ أثناء جلب إحصائيات المبيعات',
    },
    currency: 'ريال',
  },
  en: {
    dashboard: 'Dashboard',
    totalOrders: 'Total Orders',
    pendingOrders: 'Pending Orders',
    inProduction: 'In Production',
    deliveredOrders: 'Delivered Orders',
    totalInventoryValue: 'Total Inventory Value',
    completedTasks: 'Completed Tasks',
    inProgressTasks: 'In Progress Tasks',
    totalReturns: 'Total Returns',
    pendingReturns: 'Pending Returns',
    approvedReturns: 'Approved Returns',
    rejectedReturns: 'Rejected Returns',
    latestOrders: 'Latest Orders',
    latestReturns: 'Latest Returns',
    branchPerformance: 'Branch Performance',
    chefPerformance: 'Chef Performance',
    noData: 'No data available',
    noTasks: 'No tasks available',
    noReturns: 'No returns available',
    timeFilter: 'Time Filter',
    salesSummary: 'Sales Summary',
    totalSales: 'Total Sales',
    averageOrderValue: 'Average Order Value',
    returnRate: 'Return Rate',
    topProduct: 'Top Selling Product',
    viewTable: 'View Table',
    viewChart: 'View Chart',
    errors: {
      unauthorized: 'Unauthorized access',
      serverError: 'Server error',
      socketError: 'Socket connection error',
      invalidChef: 'Invalid chef data',
      fetchSales: 'Error fetching sales analytics',
    },
    currency: 'SAR',
  },
};

// Loader Component
const Loader: React.FC = React.memo(() => (
  <div className="flex justify-center items-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-600"></div>
  </div>
));

// StatsCard Component
const StatsCard: React.FC<{ title: string; value: string; icon: React.FC; color: string; ariaLabel: string }> = React.memo(
  ({ title, value, icon: Icon, color, ariaLabel }) => (
    <div
      className={`p-3 bg-${color}-50 rounded-lg border border-${color}-100 cursor-pointer hover:bg-${color}-100 transition-colors duration-200 font-alexandria`}
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

// TimeFilterDropdown Component
const TimeFilterDropdown: React.FC<{
  value: string;
  onChange: (value: string) => void;
  isRtl: boolean;
}> = React.memo(({ value, onChange, isRtl }) => {
  const t = translations[isRtl ? 'ar' : 'en'];
  const [isOpen, setIsOpen] = useState(false);

  const options = useMemo(
    () => timeFilterOptions.map((opt) => ({ value: opt.value, label: isRtl ? opt.label : opt.enLabel })),
    [isRtl]
  );

  return (
    <div className="relative w-40">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-2.5 px-4 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm transition-all duration-200 flex items-center justify-between font-alexandria text-gray-700 hover:bg-gray-50"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="truncate">{options.find((opt) => opt.value === value)?.label || t.timeFilter}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
          {options.map((option) => (
            <div
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`p-2 text-sm cursor-pointer hover:bg-amber-100 font-alexandria ${isRtl ? 'text-right' : 'text-left'} ${option.value === value ? 'bg-amber-50 text-amber-700' : ''}`}
              role="option"
              aria-selected={option.value === value}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// SalesSummary Component
const SalesSummary: React.FC<{
  sales: SalesAnalytics;
  isRtl: boolean;
  language: string;
  viewMode: 'chart' | 'table';
  toggleViewMode: () => void;
}> = React.memo(({ sales, isRtl, language, viewMode, toggleViewMode }) => {
  const t = translations[language];

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' as const, labels: { font: { size: 10, family: 'Alexandria' }, color: '#4B5563' } },
        tooltip: { bodyFont: { size: 10, family: 'Alexandria' }, padding: 8, backgroundColor: '#1F2937', titleColor: '#FFF', bodyColor: '#FFF' },
        title: { display: true, text: t.salesSummary, font: { size: 12, family: 'Alexandria' }, color: '#1F2937' },
      },
      scales: {
        x: { ticks: { font: { size: 9, family: 'Alexandria' }, color: '#4B5563', maxRotation: isRtl ? -45 : 45, autoSkip: true }, reverse: isRtl, grid: { display: false } },
        y: { ticks: { font: { size: 9, family: 'Alexandria' }, color: '#4B5563' }, beginAtZero: true, grid: { color: '#E5E7EB' } },
      },
    }),
    [isRtl, t]
  );

  const chartData = useMemo(
    () => ({
      labels: sales.productSales.slice(0, 5).map((p) => p.displayName),
      datasets: [
        {
          label: `${t.totalSales} (${t.currency})`,
          data: sales.productSales.slice(0, 5).map((p) => p.totalRevenue),
          backgroundColor: '#FBBF24',
          borderRadius: 4,
        },
      ],
    }),
    [sales, t]
  );

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mt-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-base font-semibold text-gray-800 flex items-center">
          <BarChart3 className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'} text-amber-600`} />
          {t.salesSummary}
        </h3>
        <button
          onClick={toggleViewMode}
          className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all duration-200 flex items-center gap-2 font-alexandria"
        >
          {viewMode === 'chart' ? <Table className="w-4 h-4" /> : <BarChart className="w-4 h-4" />}
          {viewMode === 'chart' ? t.viewTable : t.viewChart}
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatsCard
          title={t.totalSales}
          value={`${sales.totalSales.toFixed(2)} ${t.currency}`}
          icon={DollarSign}
          color="purple"
          ariaLabel={t.totalSales}
        />
        <StatsCard
          title={t.averageOrderValue}
          value={`${sales.averageOrderValue.toFixed(2)} ${t.currency}`}
          icon={BarChart3}
          color="blue"
          ariaLabel={t.averageOrderValue}
        />
        <StatsCard
          title={t.returnRate}
          value={`${sales.returnRate}%`}
          icon={RotateCcw}
          color="orange"
          ariaLabel={t.returnRate}
        />
        <StatsCard
          title={t.topProduct}
          value={sales.topProduct.displayName || t.noData}
          icon={Package}
          color="green"
          ariaLabel={t.topProduct}
        />
      </div>
      {viewMode === 'chart' ? (
        sales.productSales.length > 0 ? (
          <div className="h-64">
            <Bar data={chartData} options={chartOptions} />
          </div>
        ) : (
          <p className="text-gray-500 text-xs text-center">{t.noData}</p>
        )
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-max">
            <thead>
              <tr className="bg-gray-50">
                <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'} font-alexandria text-gray-600`}>{isRtl ? 'المنتج' : 'Product'}</th>
                <th className={`p-2 w-1/4 font-alexandria text-gray-600`}>{t.totalSales}</th>
                <th className={`p-2 w-1/4 font-alexandria text-gray-600`}>{t.totalCount}</th>
              </tr>
            </thead>
            <tbody>
              {sales.productSales.slice(0, 5).map((item) => (
                <tr key={item.productId} className="border-t hover:bg-gray-50">
                  <td className="p-2 font-alexandria text-gray-700">{item.displayName}</td>
                  <td className="p-2 font-alexandria text-gray-700">{item.totalRevenue.toFixed(2)} {t.currency}</td>
                  <td className="p-2 font-alexandria text-gray-700">{item.totalQuantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});

// ChefDashboard Component
const ChefDashboard: React.FC<{
  stats: Stats;
  tasks: Task[];
  isRtl: boolean;
  language: string;
  handleStartTask: (taskId: string, orderId: string) => void;
  handleCompleteTask: (taskId: string, orderId: string) => void;
}> = React.memo(({ stats, tasks, isRtl, language, handleStartTask, handleCompleteTask }) => {
  const t = translations[language];
  const [filter, setFilter] = useState<FilterState>({ status: 'all', search: '' });
  const debouncedSearch = useCallback(debounce((value: string) => setFilter((prev) => ({ ...prev, search: value.trim().toLowerCase() })), 300), []);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => filter.status === 'all' || task.status === filter.status)
      .filter(
        (task) =>
          (isRtl ? task.productName : task.productNameEn || task.productName).toLowerCase().includes(filter.search.toLowerCase()) ||
          task.orderNumber.toLowerCase().includes(filter.search.toLowerCase())
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);
  }, [tasks, filter.status, filter.search, isRtl]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard
          title={t.totalOrders}
          value={stats.totalOrders.toString()}
          icon={ShoppingCart}
          color="amber"
          ariaLabel={t.totalOrders}
        />
        <StatsCard
          title={t.completedTasks}
          value={stats.completedTasks.toString()}
          icon={CheckCircle}
          color="green"
          ariaLabel={t.completedTasks}
        />
        <StatsCard
          title={t.inProgressTasks}
          value={stats.inProgressTasks.toString()}
          icon={Clock}
          color="blue"
          ariaLabel={t.inProgressTasks}
        />
        <StatsCard
          title={t.pendingOrders}
          value={stats.pendingOrders.toString()}
          icon={AlertCircle}
          color="red"
          ariaLabel={t.pendingOrders}
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
              className="w-full sm:w-40 p-1.5 rounded-lg border border-gray-200 text-xs focus:ring-2 focus:ring-amber-500 bg-white font-alexandria"
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
              onChange={(e) => debouncedSearch(e.target.value)}
              placeholder={isRtl ? 'ابحث عن اسم المنتج أو رقم الطلب' : 'Search by product name or order number'}
              className="w-full sm:w-40 p-1.5 rounded-lg border border-gray-200 text-xs focus:ring-2 focus:ring-amber-500 bg-white font-alexandria"
              aria-label={t.searchPlaceholder}
            />
          </div>
        </div>
        <div className="space-y-2 overflow-y-auto max-h-80">
          <AnimatePresence>
            {filteredTasks.length === 0 ? (
              <p className="text-gray-500 text-xs font-alexandria">{t.noTasks}</p>
            ) : (
              filteredTasks.map((task) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="border border-amber-100 rounded-lg p-2 bg-amber-50 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-xs text-gray-800 truncate font-alexandria">
                      {isRtl ? `طلب رقم ${task.orderNumber}` : `Order #${task.orderNumber}`}
                    </h4>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-xs font-medium font-alexandria ${
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
                  <p className="text-xs text-gray-600 mb-2 truncate font-alexandria">
                    {`${task.quantity} ${isRtl ? task.productName : task.productNameEn || task.productName} (${isRtl ? task.unit : task.unitEn || task.unit})`}
                  </p>
                  <p className="text-xs text-gray-500 mb-2 font-alexandria">{isRtl ? `تم الإنشاء في: ${task.createdAt}` : `Created At: ${task.createdAt}`}</p>
                  <div className="flex items-center gap-2">
                    {(task.status === 'pending' || task.status === 'assigned') && (
                      <button
                        onClick={() => handleStartTask(task.id, task.orderId)}
                        className="bg-amber-600 text-white px-2 py-1 rounded text-xs hover:bg-amber-700 transition-colors duration-200 font-alexandria"
                        aria-label={isRtl ? 'بدء المهمة' : 'Start Task'}
                      >
                        {isRtl ? 'بدء' : 'Start'}
                      </button>
                    )}
                    {task.status === 'in_progress' && (
                      <button
                        onClick={() => handleCompleteTask(task.id, task.orderId)}
                        className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700 transition-colors duration-200 font-alexandria"
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

// Main Dashboard Component
export const Dashboard: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[language];
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const { addNotification, refreshTasks } = useNotifications();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [branches, setBranches] = useState<{ _id: string; name: string; nameEn?: string }[]>([]);
  const [returns, setReturns] = useState<Return[]>([]);
  const [branchPerformance, setBranchPerformance] = useState<BranchPerformance[]>([]);
  const [chefPerformance, setChefPerformance] = useState<ChefPerformance[]>([]);
  const [sales, setSales] = useState<SalesAnalytics>({
    totalSales: 0,
    totalCount: 0,
    averageOrderValue: 0,
    returnRate: '0.00',
    topProduct: { productId: null, productName: '', displayName: '', totalQuantity: 0, totalRevenue: 0 },
    productSales: [],
  });
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    pendingOrders: 0,
    inProductionOrders: 0,
    inTransitOrders: 0,
    deliveredOrders: 0,
    totalInventoryValue: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    totalReturns: 0,
    pendingReturns: 0,
    approvedReturns: 0,
    rejectedReturns: 0,
    averageOrderValue: 0,
  });
  const [timeFilter, setTimeFilter] = useState('week');
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const cache = useMemo(() => new Map<string, any>(), []);

  const cacheKey = useMemo(() => `${user?.id || user?._id}-${user?.role}-${timeFilter}`, [user, timeFilter]);

  const fetchDashboardData = useCallback(
    debounce(async (forceRefresh = false) => {
      if (!user?.id && !user?._id) {
        const errorMessage = t.errors.unauthorized;
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
        setBranchPerformance(cachedData.branchPerformance);
        setChefPerformance(cachedData.chefPerformance);
        setSales(cachedData.sales);
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

        const query: Record<string, any> = { startDate: startDate.toISOString(), endDate: now.toISOString(), limit: 20, lang: language };
        let ordersResponse: any[] = [];
        let tasksResponse: any[] = [];
        let chefsResponse: any[] = [];
        let branchesResponse: any[] = [];
        let returnsResponse: any = { returns: [], total: 0 };
        let salesResponse: any = {};
        let inventoryValue: number = 0;

        if (user.role === 'chef') {
          const chefProfile = await chefsAPI.getByUserId(user.id || user._id);
          const chefId = chefProfile?._id;
          if (!chefId || !/^[0-9a-fA-F]{24}$/.test(chefId)) {
            throw new Error(t.errors.invalidChef);
          }
          tasksResponse = await productionAssignmentsAPI.getChefTasks(chefId, { limit: 20 });
        } else {
          if (user.role === 'branch') query.branch = user.id || user._id;
          if (user.role === 'production' && user.department) query.departmentId = user.department._id;
          const promises = [
            ordersAPI.getAll(query).catch(() => []),
            productionAssignmentsAPI.getAllTasks(query).catch(() => []),
            ['admin', 'production'].includes(user.role) ? chefsAPI.getAll().catch(() => []) : Promise.resolve([]),
            ['admin', 'production'].includes(user.role) ? branchesAPI.getAll().catch(() => []) : Promise.resolve([]),
            ['admin', 'production', 'branch'].includes(user.role)
              ? returnsAPI.getAll(query).catch((err) => {
                  console.warn(`[${new Date().toISOString()}] Error fetching returns:`, err);
                  return { returns: [], total: 0 };
                })
              : Promise.resolve({ returns: [], total: 0 }),
            ['admin', 'production'].includes(user.role)
              ? salesAPI.getAnalytics(query).catch((err) => {
                  console.warn(`[${new Date().toISOString()}] Error fetching sales analytics:`, err);
                  // Return fallback data for 403 or other errors
                  return {
                    totalSales: 0,
                    totalCount: 0,
                    averageOrderValue: 0,
                    returnRate: '0.00',
                    topProduct: { productId: null, productName: '', displayName: '', totalQuantity: 0, totalRevenue: 0 },
                    productSales: [],
                  };
                })
              : Promise.resolve({
                  totalSales: 0,
                  totalCount: 0,
                  averageOrderValue: 0,
                  returnRate: '0.00',
                  topProduct: { productId: null, productName: '', displayName: '', totalQuantity: 0, totalRevenue: 0 },
                  productSales: [],
                }),
            inventoryAPI.getTotalValue(query).catch(() => 0),
          ];
          [ordersResponse, tasksResponse, chefsResponse, branchesResponse, returnsResponse, salesResponse, inventoryValue] = await Promise.all(promises);
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
          createdAt: order.createdAt || new Date().toISOString(),
        }));

        const uniqueTasks = Array.from(
          new Map(
            tasksResponse.map((task: any) => [
              task._id,
              {
                id: task._id || crypto.randomUUID(),
                orderId: task.order?._id || 'unknown',
                orderNumber: task.order?.orderNumber || (isRtl ? 'غير معروف' : 'Unknown'),
                productName: task.product?.name || (isRtl ? 'منتج غير معروف' : 'Unknown Product'),
                productNameEn: task.product?.nameEn || task.product?.name || 'Unknown',
                quantity: Number(task.quantity) || 0,
                unit: task.product?.unit || 'unit',
                unitEn: task.product?.unitEn || task.product?.unit || 'unit',
                status: task.status || 'pending',
                branchName: task.order?.branch?.name || (isRtl ? 'فرع غير معروف' : 'Unknown Branch'),
                branchNameEn: task.order?.branch?.nameEn || task.order?.branch?.name || 'Unknown',
                createdAt: formatDate(task.createdAt || new Date(), language),
              },
            ])
          )
        ).values();

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

        const branchPerf = mappedBranches
          .map((branch: any) => {
            const branchOrders = mappedOrders.filter((o) => o.branchId === branch._id);
            const total = branchOrders.length;
            const completed = branchOrders.filter((o) => o.status === 'completed' || o.status === 'delivered').length;
            const perf = total > 0 ? (completed / total) * 100 : 0;
            return { branchName: branch.name, branchNameEn: branch.nameEn, performance: perf, totalOrders: total, completedOrders: completed };
          })
          .filter((b: any) => b.totalOrders > 0);

        const chefPerf = mappedChefs
          .map((chef: any) => {
            const chefTasks = uniqueTasks.filter((task) => {
              const order = mappedOrders.find((o) => o.id === task.orderId);
              return order?.items.some((i) => i.assignedTo?._id === chef.userId);
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
          })
          .filter((c: any) => c.totalTasks > 0);

        const completedTasks = uniqueTasks.filter((t: any) => t.status === 'completed').length;
        const inProgressTasks = uniqueTasks.filter((t: any) => t.status === 'in_progress').length;

        const totalOrders = user.role === 'chef' ? uniqueTasks.length : mappedOrders.length;
        const pendingOrders = user.role === 'chef'
          ? uniqueTasks.filter((task: any) => task.status === 'pending' || task.status === 'assigned').length
          : mappedOrders.filter((o) => o.status === 'pending').length;
        const inProductionOrders = mappedOrders.filter((o) => o.status === 'in_production').length;
        const inTransitOrders = mappedOrders.filter((o) => o.status === 'in_transit').length;
        const deliveredOrders = mappedOrders.filter((o) => o.status === 'delivered').length;
        const totalReturns = mappedReturns.length;
        const pendingReturns = mappedReturns.filter((r) => r.status === 'pending_approval').length;
        const approvedReturns = mappedReturns.filter((r) => r.status === 'approved').length;
        const rejectedReturns = mappedReturns.filter((r) => r.status === 'rejected').length;
        const averageOrderValue = totalOrders > 0 ? (salesResponse.totalSales || 0) / totalOrders : 0;

        const mappedSales = {
          totalSales: Number(salesResponse.totalSales) || 0,
          totalCount: Number(salesResponse.totalCount) || 0,
          averageOrderValue: Number(salesResponse.averageOrderValue) || 0,
          returnRate: String(salesResponse.returnRate || '0.00'),
          topProduct: salesResponse.topProduct
            ? {
                productId: salesResponse.topProduct.productId || null,
                productName: salesResponse.topProduct.productName || '',
                productNameEn: salesResponse.topProduct.productNameEn || salesResponse.topProduct.productName || '',
                displayName: isRtl ? (salesResponse.topProduct.productName || 'منتج محذوف') : (salesResponse.topProduct.productNameEn || salesResponse.topProduct.productName || 'Deleted Product'),
                totalQuantity: Number(salesResponse.topProduct.totalQuantity) || 0,
                totalRevenue: Number(salesResponse.topProduct.totalRevenue) || 0,
              }
            : { productId: null, productName: '', displayName: '', totalQuantity: 0, totalRevenue: 0 },
          productSales: (salesResponse.productSales || []).map((ps: any) => ({
            productId: ps.productId || '',
            productName: ps.productName || '',
            productNameEn: ps.productNameEn || ps.productName || '',
            displayName: isRtl ? (ps.productName || 'منتج محذوف') : (ps.productNameEn || ps.productName || 'Deleted Product'),
            totalQuantity: Number(ps.totalQuantity) || 0,
            totalRevenue: Number(ps.totalRevenue) || 0,
          })).sort((a: any, b: any) => b.totalRevenue - a.totalRevenue),
        };

        const newData = {
          orders: mappedOrders,
          tasks: uniqueTasks,
          chefs: mappedChefs,
          branches: mappedBranches,
          returns: mappedReturns,
          branchPerformance: branchPerf,
          chefPerformance: chefPerf,
          sales: mappedSales,
          stats: {
            totalOrders,
            pendingOrders,
            inProductionOrders,
            inTransitOrders,
            deliveredOrders,
            totalInventoryValue: Number(inventoryValue) || 0,
            completedTasks,
            inProgressTasks,
            totalReturns,
            pendingReturns,
            approvedReturns,
            rejectedReturns,
            averageOrderValue,
          },
        };

        cache.set(cacheKey, newData);
        setOrders(newData.orders);
        setTasks(newData.tasks);
        setChefs(newData.chefs);
        setBranches(newData.branches);
        setReturns(newData.returns);
        setBranchPerformance(newData.branchPerformance);
        setChefPerformance(newData.chefPerformance);
        setSales(newData.sales);
        setStats(newData.stats);
        setError('');
        setIsInitialLoad(false);
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Error in fetchDashboardData:`, err);
        const errorMessage = err.status === 403 ? t.errors.unauthorized : t.errors.serverError;
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
    [user, isRtl, language, cacheKey, addNotification, t]
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
      const errorMessage = t.errors.socketError;
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
      if (!data.taskId || !data.orderId || !data.productName || !data.orderNumber || !data.branchName || !data.quantity || !data.eventId) {
        console.warn(`[${new Date().toISOString()}] Invalid task assigned data:`, data);
        return;
      }
      if (data.chefId !== (user?.id || user?._id) || !['admin', 'production', 'chef'].includes(user.role)) return;

      const newTask = {
        id: data.taskId,
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        productName: data.productName,
        productNameEn: data.productNameEn || data.productName,
        quantity: Number(data.quantity) || 0,
        unit: data.unit || 'unit',
        unitEn: data.unitEn || data.unit || 'unit',
        status: data.status || 'assigned',
        branchName: data.branchName,
        branchNameEn: data.branchNameEn || data.branchName,
        createdAt: formatDate(new Date(), language),
      };

      setTasks((prev) => {
        const taskExists = prev.some((t) => t.id === newTask.id);
        if (taskExists) return prev;
        return [newTask, ...prev];
      });

      addNotification({
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
      });
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
        console.warn(`[${new Date().toISOString()}] Invalid item status update data:`, data);
        return;
      }
      if (!['admin', 'production', 'chef'].includes(user.role) || (user.role === 'chef' && data.chefId !== user._id)) return;

      setTasks((prev) =>
        prev
          .map((task) => (task.id === data.itemId && task.orderId === data.orderId ? { ...task, status: data.status } : task))
          .filter((task, index, self) => index === self.findIndex((t) => t.id === task.id))
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
        console.warn(`[${new Date().toISOString()}] Invalid return created data:`, data);
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
        console.warn(`[${new Date().toISOString()}] Invalid return status update data:`, data);
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

    return () => {
      socket.off('connect_error');
      socket.off('taskAssigned');
      socket.off('orderCompleted');
      socket.off('itemStatusUpdated');
      socket.off('returnCreated');
      socket.off('returnStatusUpdated');
    };
  }, [socket, user, isRtl, language, addNotification, fetchDashboardData, isConnected, t]);

  const handleStartTask = useCallback(
    async (taskId: string, orderId: string) => {
      if (!isConnected) {
        addNotification({
          _id: `warn-socket-${Date.now()}`,
          type: 'warning',
          message: t.errors.socketError,
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
    [socket, user, isRtl, isConnected, tasks, language, addNotification, t]
  );

  const handleCompleteTask = useCallback(
    async (taskId: string, orderId: string) => {
      if (!isConnected) {
        addNotification({
          _id: `warn-socket-${Date.now()}`,
          type: 'warning',
          message: t.errors.socketError,
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
    [socket, user, isRtl, isConnected, tasks, language, addNotification, t]
  );

  const sortedPendingOrders = useMemo(() => {
    return [...orders]
      .filter((order) => ['pending', 'approved', 'in_production'].includes(order.status))
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
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4"
    >
      <StatsCard
        title={t.totalOrders}
        value={stats.totalOrders.toString()}
        icon={ShoppingCart}
        color="amber"
        ariaLabel={t.totalOrders}
      />
      <StatsCard
        title={t.pendingOrders}
        value={stats.pendingOrders.toString()}
        icon={AlertCircle}
        color="red"
        ariaLabel={t.pendingOrders}
      />
      <StatsCard
        title={t.inProduction}
        value={stats.inProductionOrders.toString()}
        icon={Package}
        color="blue"
        ariaLabel={t.inProduction}
      />
      <StatsCard
        title={t.deliveredOrders}
        value={stats.deliveredOrders.toString()}
        icon={CheckCircle}
        color="green"
        ariaLabel={t.deliveredOrders}
      />
      {['admin', 'production', 'branch'].includes(user.role) && (
        <>
          <StatsCard
            title={t.totalInventoryValue}
            value={`${stats.totalInventoryValue.toFixed(2)} ${t.currency}`}
            icon={DollarSign}
            color="purple"
            ariaLabel={t.totalInventoryValue}
          />
          {user.role !== 'branch' && (
            <>
              <StatsCard
                title={t.completedTasks}
                value={stats.completedTasks.toString()}
                icon={CheckCircle}
                color="green"
                ariaLabel={t.completedTasks}
              />
              <StatsCard
                title={t.inProgressTasks}
                value={stats.inProgressTasks.toString()}
                icon={Clock}
                color="blue"
                ariaLabel={t.inProgressTasks}
              />
            </>
          )}
          <StatsCard
            title={t.totalReturns}
            value={stats.totalReturns.toString()}
            icon={RotateCcw}
            color="orange"
            ariaLabel={t.totalReturns}
          />
          <StatsCard
            title={t.pendingReturns}
            value={stats.pendingReturns.toString()}
            icon={AlertCircle}
            color="red"
            ariaLabel={t.pendingReturns}
          />
          <StatsCard
            title={t.approvedReturns}
            value={stats.approvedReturns.toString()}
            icon={CheckCircle}
            color="green"
            ariaLabel={t.approvedReturns}
          />
          <StatsCard
            title={t.rejectedReturns}
            value={stats.rejectedReturns.toString()}
            icon={AlertCircle}
            color="red"
            ariaLabel={t.rejectedReturns}
          />
        </>
      )}
    </motion.div>
  );

  const renderBranchPerformance = () => (
    <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 mt-4">
      <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center font-alexandria">
        <BarChart3 className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'} text-amber-600`} />
        {t.branchPerformance}
      </h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        <AnimatePresence>
          {branchPerformance.length === 0 ? (
            <p className="text-gray-500 text-xs font-alexandria">{t.noData}</p>
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
                  <p className="text-xs font-medium text-gray-800 font-alexandria">{isRtl ? branch.branchName : branch.branchNameEn || branch.branchName}</p>
                  <p className="text-xs text-gray-500 font-alexandria">
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
                  <span className="text-xs text-gray-600 font-alexandria">{branch.performance.toFixed(1)}%</span>
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
      <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center font-alexandria">
        <ChefHat className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'} text-amber-600`} />
        {t.chefPerformance}
      </h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        <AnimatePresence>
          {chefPerformance.length === 0 ? (
            <p className="text-gray-500 text-xs font-alexandria">{t.noData}</p>
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
                  <p className="text-xs font-medium text-gray-800 font-alexandria">{isRtl ? chef.chefName : chef.chefNameEn || chef.chefName}</p>
                  <p className="text-xs text-gray-500 font-alexandria">
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
                  <span className="text-xs text-gray-600 font-alexandria">{chef.performance.toFixed(1)}%</span>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  const renderLatestReturns = () => (
    <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
      <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center font-alexandria">
        <RotateCcw className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'} text-amber-600`} />
        {t.latestReturns}
      </h3>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        <AnimatePresence>
          {sortedLatestReturns.length === 0 ? (
            <p className="text-gray-500 text-xs font-alexandria">{t.noReturns}</p>
          ) : (
            sortedLatestReturns.map((ret) => (
              <motion.div
                key={ret.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="border border-amber-100 rounded-lg p-2 bg-amber-50 shadow-sm cursor-pointer hover:bg-amber-100 transition-colors duration-200"
                onClick={() => navigate(`/returns/${ret.id}`)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-xs text-gray-800 truncate font-alexandria">
                    {isRtl ? `مرتجع رقم ${ret.returnNumber}` : `Return #${ret.returnNumber}`}
                  </h4>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-xs font-medium font-alexandria ${
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
                <p className="text-xs text-gray-600 mb-2 truncate font-alexandria">{isRtl ? ret.branchName : ret.branchNameEn || ret.branchName}</p>
                <p className="text-xs text-gray-500 font-alexandria">{isRtl ? `تم الإنشاء في: ${ret.createdAt}` : `Created At: ${ret.createdAt}`}</p>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  const renderLatestOrders = () => (
    <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
      <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center font-alexandria">
        <ShoppingCart className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'} text-amber-600`} />
        {t.latestOrders}
      </h3>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        <AnimatePresence>
          {sortedPendingOrders.length === 0 ? (
            <p className="text-gray-500 text-xs font-alexandria">{t.noData}</p>
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
                  <h4 className="font-semibold text-xs text-gray-800 truncate font-alexandria">
                    {isRtl ? `طلب رقم ${order.orderNumber}` : `Order #${order.orderNumber}`}
                  </h4>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-xs font-medium font-alexandria ${
                      order.status === 'pending' || order.status === 'approved'
                        ? 'bg-amber-100 text-amber-800'
                        : order.status === 'in_production'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {isRtl
                      ? order.status === 'pending'
                        ? 'معلق'
                        : order.status === 'approved'
                        ? 'موافق عليه'
                        : order.status === 'in_production'
                        ? 'قيد الإنتاج'
                        : order.status === 'in_transit'
                        ? 'في الطريق'
                        : 'مكتمل'
                      : order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mb-2 truncate font-alexandria">{isRtl ? order.branchName : order.branchNameEn || order.branchName}</p>
                <p className="text-xs text-gray-500 font-alexandria">{isRtl ? `تم الإنشاء في: ${order.createdAt}` : `Created At: ${order.createdAt}`}</p>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  const toggleViewMode = useCallback(() => setViewMode((prev) => (prev === 'chart' ? 'table' : 'chart')), []);

  if (loading && isInitialLoad) return <Loader />;
  if (error) return <div className="text-center text-red-600 p-4 font-alexandria">{error}</div>;

  return (
    <div className={`py-6 px-4 mx-auto font-alexandria ${isRtl ? 'rtl' : 'ltr'}`}>
      <link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet" />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-amber-600" />
          {t.dashboard}
        </h1>
        <TimeFilterDropdown value={timeFilter} onChange={setTimeFilter} isRtl={isRtl} />
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center font-alexandria">
                  <ShoppingCart className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'} text-amber-600`} />
                  {t.latestOrders}
                </h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  <AnimatePresence>
                    {sortedPendingOrders.length === 0 ? (
                      <p className="text-gray-500 text-xs font-alexandria">{t.noOrders}</p>
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
                            <h4 className="font-semibold text-xs text-gray-800 truncate font-alexandria">
                              {isRtl ? `طلب رقم ${order.orderNumber}` : `Order #${order.orderNumber}`}
                            </h4>
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-xs font-medium font-alexandria ${
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
                          <p className="text-xs text-gray-600 mb-2 truncate font-alexandria">{isRtl ? order.branchName : order.branchNameEn || order.branchName}</p>
                          <p className="text-xs text-gray-500 font-alexandria">{isRtl ? `تم الإنشاء في: ${order.date}` : `Created At: ${order.date}`}</p>
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>
              {['admin', 'production'].includes(user.role) && (
                <SalesSummary
                  sales={sales}
                  isRtl={isRtl}
                  language={language}
                  viewMode={viewMode}
                  toggleViewMode={toggleViewMode}
                />
              )}
            </div>
            {renderLatestReturns()}
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