import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useNotifications } from '../contexts/NotificationContext';
import { ShoppingCart, Clock, BarChart3, AlertCircle, Package, DollarSign, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import { ordersAPI, branchesAPI, returnsAPI, salesAPI, inventoryAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import {ProductDropdown} from './NewOrder';

// Interfaces
interface Stats {
  totalOrders: number;
  pendingOrders: number;
  inProductionOrders: number;
  inTransitOrders: number;
  deliveredOrders: number;
  totalOrderValue: number;
  totalReturns: number;
  pendingReturns: number;
  approvedReturns: number;
  rejectedReturns: number;
  averageOrderValue: number;
  totalSales: number;
  salesPoints: number;
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

interface BranchPerformance {
  branchName: string;
  branchNameEn?: string;
  performance: number;
  totalOrders: number;
  completedOrders: number;
}

interface FilterState {
  status: string;
  search: string;
  department: string;
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
const StatsCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.FC;
  color: string;
  ariaLabel: string;
}> = React.memo(({ title, value, icon: Icon, color, ariaLabel }) => (
  <motion.div
    className={`bg-white p-4 rounded-lg shadow-sm border flex items-center space-x-4 ${color}`}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    aria-label={ariaLabel}
  >
    <Icon className="w-8 h-8 text-gray-600" />
    <div>
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
    </div>
  </motion.div>
));

export const Dashboard: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const { addNotification, refreshTasks } = useNotifications();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [returns, setReturns] = useState<Return[]>([]);
  const [branches, setBranches] = useState<{ _id: string; name: string; nameEn?: string }[]>([]);
  const [branchPerformance, setBranchPerformance] = useState<BranchPerformance[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    pendingOrders: 0,
    inProductionOrders: 0,
    inTransitOrders: 0,
    deliveredOrders: 0,
    totalOrderValue: 0,
    totalReturns: 0,
    pendingReturns: 0,
    approvedReturns: 0,
    rejectedReturns: 0,
    averageOrderValue: 0,
    totalSales: 0,
    salesPoints: 0,
  });
  const [timeFilter, setTimeFilter] = useState<string>('week');
  const [filter, setFilter] = useState<FilterState>({ status: 'all', search: '', department: 'all' });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);

  const cache = useMemo(() => new Map<string, any>(), []);
  const cacheKey = useMemo(() => `${user?.id || user?._id}-${user?.role}-${timeFilter}-${filter.department}`, [user, timeFilter, filter.department]);

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
        setReturns(cachedData.returns);
        setBranches(cachedData.branches);
        setBranchPerformance(cachedData.branchPerformance);
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
          limit: 20,
        };

        if (user.role === 'branch') query.branch = user.id || user._id;
        if (user.role === 'production' && user.department) query.departmentId = user.department._id;
        if (filter.department !== 'all') query.department = filter.department;

        const promises = [
          ordersAPI.getAll(query).catch(() => []),
          ['admin', 'production', 'branch'].includes(user.role)
            ? returnsAPI.getAll(query).catch((err) => {
                console.warn(`[${new Date().toISOString()}] Error fetching returns:`, err);
                return { returns: [], total: 0 };
              })
            : Promise.resolve({ returns: [], total: 0 }),
          ['admin', 'production'].includes(user.role) ? branchesAPI.getAll().catch(() => []) : Promise.resolve([]),
          salesAPI.getAnalytics({ ...query, branch: user.role === 'branch' ? user.id || user._id : undefined }).catch(() => ({
            totalSales: 0,
            totalCount: 0,
            salesPoints: 0,
          })),
        ];

        const [ordersResponse, returnsResponse, branchesResponse, salesAnalytics] = await Promise.all(promises);

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
            department: item.product?.department || {
              _id: 'unknown',
              name: isRtl ? 'قسم غير معروف' : 'Unknown Department',
              nameEn: 'Unknown',
            },
            status: item.status || 'pending',
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
          return {
            branchName: branch.name,
            branchNameEn: branch.nameEn,
            performance: perf,
            totalOrders: total,
            completedOrders: completed,
          };
        }).filter((b: any) => b.totalOrders > 0);

        const totalOrders = mappedOrders.length;
        const pendingOrders = mappedOrders.filter((o) => o.status === 'pending').length;
        const inProductionOrders = mappedOrders.filter((o) => o.status === 'in_production').length;
        const inTransitOrders = mappedOrders.filter((o) => o.status === 'in_transit').length;
        const deliveredOrders = mappedOrders.filter((o) => o.status === 'delivered').length;
        const totalOrderValue = mappedOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
        const totalReturns = mappedReturns.length;
        const pendingReturns = mappedReturns.filter((r) => r.status === 'pending_approval').length;
        const approvedReturns = mappedReturns.filter((r) => r.status === 'approved').length;
        const rejectedReturns = mappedReturns.filter((r) => r.status === 'rejected').length;
        const averageOrderValue = totalOrders > 0 ? totalOrderValue / totalOrders : 0;
        const totalSales = salesAnalytics.totalSales || 0;
        const salesPoints = salesAnalytics.salesPoints || 0;

        const newData = {
          orders: mappedOrders,
          returns: mappedReturns,
          branches: mappedBranches,
          branchPerformance: branchPerf,
          stats: {
            totalOrders,
            pendingOrders,
            inProductionOrders,
            inTransitOrders,
            deliveredOrders,
            totalOrderValue,
            totalReturns,
            pendingReturns,
            approvedReturns,
            rejectedReturns,
            averageOrderValue,
            totalSales,
            salesPoints,
          },
        };

        cache.set(cacheKey, newData);
        setOrders(newData.orders);
        setReturns(newData.returns);
        setBranches(newData.branches);
        setBranchPerformance(newData.branchPerformance);
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
  }, [fetchDashboardData, timeFilter, filter.department]);

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

    socket.on('orderCompleted', (data: any) => {
      if (!data.orderId || !data.orderNumber || !data.branchName || !data.eventId) return;
      if (!['admin', 'branch', 'production'].includes(user.role)) return;
      addNotification({
        _id: data.eventId,
        type: 'success' as const,
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

    socket.on('returnCreated', (data: any) => {
      if (!data.returnId || !data.returnNumber || !data.branchId || !data.branchName || !data.items || !data.status || !data.eventId) {
        console.warn(`[${new Date().toISOString()}] Invalid return created data:`, data);
        return;
      }
      if (!['admin', 'production', 'branch'].includes(user.role) || (user.role === 'branch' && data.branchId !== user.branchId)) return;
      addNotification({
        _id: data.eventId,
        type: 'info',
        message: isRtl ? `تم إنشاء مرتجع جديد: ${data.returnNumber} من ${data.branchName}` : `New return created: ${data.returnNumber} from ${data.branchName}`,
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
          ret.id === data.returnId
            ? { ...ret, status: data.status, reviewNotes: data.reviewNotes || '', reviewNotesEn: data.reviewNotesEn || data.reviewNotes || '' }
            : ret
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
      socket.off('orderCompleted');
      socket.off('returnCreated');
      socket.on('returnStatusUpdated');
    };
  }, [socket, user, isRtl, language, addNotification, fetchDashboardData, isConnected]);

  const sortedPendingOrders = useMemo(() => {
    return [...orders]
      .filter((order) => (filter.status === 'all' ? ['pending', 'approved', 'in_production'].includes(order.status) : order.status === filter.status))
      .filter((order) =>
        order.orderNumber.toLowerCase().includes(filter.search.toLowerCase()) ||
        (isRtl ? order.branchName : order.branchNameEn || order.branchName).toLowerCase().includes(filter.search.toLowerCase())
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [orders, filter.status, filter.search, isRtl]);

  const sortedLatestReturns = useMemo(() => {
    return [...returns]
      .filter((ret) =>
        ret.returnNumber.toLowerCase().includes(filter.search.toLowerCase()) ||
        (isRtl ? ret.branchName : ret.branchNameEn || ret.branchName).toLowerCase().includes(filter.search.toLowerCase())
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [returns, filter.search, isRtl]);

  const renderStats = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatsCard
        title={isRtl ? 'إجمالي الطلبات' : 'Total Orders'}
        value={stats.totalOrders}
        icon={ShoppingCart}
        color="border-blue-100"
        ariaLabel={isRtl ? 'إجمالي الطلبات' : 'Total Orders'}
      />
      <StatsCard
        title={isRtl ? 'الطلبات المعلقة' : 'Pending Orders'}
        value={stats.pendingOrders}
        icon={Clock}
        color="border-yellow-100"
        ariaLabel={isRtl ? 'الطلبات المعلقة' : 'Pending Orders'}
      />
      <StatsCard
        title={isRtl ? 'إجمالي المبيعات' : 'Total Sales'}
        value={`$${stats.totalSales.toFixed(2)}`}
        icon={DollarSign}
        color="border-green-100"
        ariaLabel={isRtl ? 'إجمالي المبيعات' : 'Total Sales'}
      />
      <StatsCard
        title={isRtl ? 'نقاط المبيعات' : 'Sales Points'}
        value={stats.salesPoints}
        icon={BarChart3}
        color="border-purple-100"
        ariaLabel={isRtl ? 'نقاط المبيعات' : 'Sales Points'}
      />
      <StatsCard
        title={isRtl ? 'المرتجعات المعلقة' : 'Pending Returns'}
        value={stats.pendingReturns}
        icon={RotateCcw}
        color="border-red-100"
        ariaLabel={isRtl ? 'المرتجعات المعلقة' : 'Pending Returns'}
      />
      <StatsCard
        title={isRtl ? 'متوسط قيمة الطلب' : 'Average Order Value'}
        value={`$${stats.averageOrderValue.toFixed(2)}`}
        icon={DollarSign}
        color="border-indigo-100"
        ariaLabel={isRtl ? 'متوسط قيمة الطلب' : 'Average Order Value'}
      />
      <StatsCard
        title={isRtl ? 'الطلبات قيد الإنتاج' : 'In Production Orders'}
        value={stats.inProductionOrders}
        icon={Package}
        color="border-blue-100"
        ariaLabel={isRtl ? 'الطلبات قيد الإنتاج' : 'In Production Orders'}
      />
      <StatsCard
        title={isRtl ? 'الطلبات المسلمة' : 'Delivered Orders'}
        value={stats.deliveredOrders}
        icon={Package}
        color="border-green-100"
        ariaLabel={isRtl ? 'الطلبات المسلمة' : 'Delivered Orders'}
      />
    </div>
  );

  const renderBranchPerformance = () => (
    <div className="bg-white p-6 rounded-lg shadow-sm border mt-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center">
        <BarChart3 className={`w-5 h-5 ${isRtl ? 'ml-2' : 'mr-2'} text-amber-600`} />
        {isRtl ? 'أداء الفروع' : 'Branch Performance'}
      </h2>
      {branchPerformance.length === 0 ? (
        <p className="text-gray-500">{isRtl ? 'لا توجد بيانات أداء' : 'No performance data available'}</p>
      ) : (
        <div className="space-y-4">
          {branchPerformance.map((branch, index) => (
            <motion.div
              key={branch.branchName}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, delay: index * 0.1 }}
              className="flex items-center justify-between"
            >
              <div>
                <p className="font-medium">{isRtl ? branch.branchName : branch.branchNameEn || branch.branchName}</p>
                <p className="text-sm text-gray-500">
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
                <span className="text-sm text-gray-600">{branch.performance.toFixed(1)}%</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );

  const renderLatestReturns = () => (
    <div className="bg-white p-6 rounded-lg shadow-sm border mt-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center">
        <RotateCcw className={`w-5 h-5 ${isRtl ? 'ml-2' : 'mr-2'} text-amber-600`} />
        {isRtl ? 'أحدث المرتجعات' : 'Latest Returns'}
      </h2>
      {sortedLatestReturns.length === 0 ? (
        <p className="text-gray-500">{isRtl ? 'لا توجد مرتجعات' : 'No returns available'}</p>
      ) : (
        <div className="space-y-4">
          {sortedLatestReturns.map((ret) => (
            <motion.div
              key={ret.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer rounded"
              onClick={() => navigate(`/returns/${ret.id}`)}
            >
              <div>
                <p className="font-medium">{isRtl ? `مرتجع رقم ${ret.returnNumber}` : `Return #${ret.returnNumber}`}</p>
                <p className="text-sm text-gray-500">
                  {isRtl
                    ? ret.status === 'pending_approval'
                      ? 'معلق'
                      : ret.status === 'approved'
                      ? 'موافق عليه'
                      : 'مرفوض'
                    : ret.status.charAt(0).toUpperCase() + ret.status.slice(1)}
                </p>
                <p className="text-sm text-gray-500">{isRtl ? ret.branchName : ret.branchNameEn || ret.branchName}</p>
              </div>
              <p className="text-sm text-gray-500">{isRtl ? `تم الإنشاء في: ${ret.createdAt}` : `Created At: ${ret.createdAt}`}</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );

  const renderLatestOrders = () => (
    <div className="bg-white p-6 rounded-lg shadow-sm border mt-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center">
        <ShoppingCart className={`w-5 h-5 ${isRtl ? 'ml-2' : 'mr-2'} text-amber-600`} />
        {isRtl ? 'أحدث الطلبات' : 'Latest Orders'}
      </h2>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <select
          value={filter.status}
          onChange={(e) => setFilter((prev) => ({ ...prev, status: e.target.value }))}
          className="w-full sm:w-40 p-1.5 rounded-lg border border-gray-200 text-xs focus:ring-2 focus:ring-blue-500 bg-white"
          aria-label={isRtl ? 'حالة الطلب' : 'Order Status'}
        >
          <option value="all">{isRtl ? 'الكل' : 'All'}</option>
          <option value="pending">{isRtl ? 'معلق' : 'Pending'}</option>
          <option value="in_production">{isRtl ? 'قيد الإنتاج' : 'In Production'}</option>
          <option value="completed">{isRtl ? 'مكتمل' : 'Completed'}</option>
        </select>
        <ProductDropdown
          value={filter.department}
          onChange={(value) => setFilter((prev) => ({ ...prev, department: value }))}
          placeholder={isRtl ? 'اختر القسم' : 'Select Department'}
          apiMethod={() => departmentAPI.getAll({})}
          mapOptions={(item) => ({
            value: item._id,
            label: isRtl ? item.name : item.nameEn || item.name,
          })}
          className="w-full sm:w-40"
        />
        <input
          type="text"
          value={filter.search}
          onChange={(e) => setFilter((prev) => ({ ...prev, search: e.target.value }))}
          placeholder={isRtl ? 'ابحث عن رقم الطلب أو الفرع' : 'Search by order number or branch'}
          className="w-full sm:w-40 p-1.5 rounded-lg border border-gray-200 text-xs focus:ring-2 focus:ring-blue-500 bg-white"
          aria-label={isRtl ? 'البحث' : 'Search'}
        />
      </div>
      {sortedPendingOrders.length === 0 ? (
        <p className="text-gray-500">{isRtl ? 'لا توجد طلبات' : 'No orders available'}</p>
      ) : (
        <div className="space-y-4">
          {sortedPendingOrders.map((order) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer rounded"
              onClick={() => navigate(`/orders/${order.id}`)}
            >
              <div>
                <p className="font-medium">{isRtl ? `طلب رقم ${order.orderNumber}` : `Order #${order.orderNumber}`}</p>
                <p className="text-sm text-gray-500">
                  {isRtl
                    ? order.status === 'pending'
                      ? 'معلق'
                      : order.status === 'in_production'
                      ? 'قيد الإنتاج'
                      : 'مكتمل'
                    : order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </p>
                <p className="text-sm text-gray-500">{isRtl ? order.branchName : order.branchNameEn || order.branchName}</p>
              </div>
              <p className="text-sm text-gray-500">{isRtl ? `تم الإنشاء في: ${order.date}` : `Created At: ${order.date}`}</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );

  if (loading && isInitialLoad) return <Loader />;
  if (error) return <div className="text-center text-red-500 p-6">{error}</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-amber-600" />
          {isRtl ? 'لوحة التحكم' : 'Dashboard'}
        </h1>
        <ProductDropdown
          value={timeFilter}
          onChange={setTimeFilter}
          options={timeFilterOptions.map((option) => ({
            value: option.value,
            label: isRtl ? option.label : option.enLabel,
          }))}
          placeholder={isRtl ? 'اختر الفترة' : 'Select Period'}
          className="w-40"
        />
      </div>
      {renderStats()}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderLatestOrders()}
        {renderLatestReturns()}
      </div>
      {['admin', 'production'].includes(user.role) && renderBranchPerformance()}
    </div>
  );
};

export default Dashboard;
