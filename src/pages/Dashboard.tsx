import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { ShoppingCart, RotateCcw, Package, AlertCircle, CheckCircle, Calendar } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useNotifications } from '../contexts/NotificationContext';
import { ordersAPI, returnsAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ProductDropdown } from './NewOrder';

enum ReturnStatus {
  PENDING = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

interface Stats {
  totalReturns: number;
  pendingReturns: number;
  approvedReturns: number;
  rejectedReturns: number;
  totalQuantity: number;
  totalValue: number;
  statusDistribution: Array<{ name: string; value: number }>;
  returnsByBranch: Array<{ branchId: string; branchName: string; count: number; totalQuantity: number; totalValue: number }>;
}

interface Order {
  id: string;
  orderNumber: string;
  branchName: string;
  branchNameEn?: string;
  branchId: string;
  status: 'pending' | 'approved' | 'in_production' | 'completed' | 'in_transit' | 'delivered' | 'cancelled';
  totalAmount: number;
  date: string;
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
    price: number;
    reason: string;
    reasonEn?: string;
  }>;
  status: ReturnStatus;
  createdByName: string;
  createdByNameEn?: string;
  createdAt: string;
}

interface Branch {
  _id: string;
  name: string;
  nameEn?: string;
}

const translations = {
  ar: {
    title: 'لوحة التحكم',
    subtitle: 'إحصائيات المرتجعات والطلبات',
    totalReturns: 'إجمالي المرتجعات',
    pendingReturns: 'المرتجعات المعلقة',
    approvedReturns: 'المرتجعات الموافق عليها',
    rejectedReturns: 'المرتجعات المرفوضة',
    totalQuantity: 'إجمالي الكمية',
    totalValue: 'القيمة الإجمالية',
    statusDistribution: 'توزيع الحالات',
    returnsByBranch: 'المرتجعات حسب الفرع',
    latestOrders: 'أحدث الطلبات',
    latestReturns: 'أحدث المرتجعات',
    filterByBranch: 'تصفية حسب الفرع',
    selectBranch: 'اختر الفرع',
    filterByDate: 'تصفية حسب التاريخ',
    clearFilters: 'مسح الفلاتر',
    noData: 'لا توجد بيانات متاحة',
    errors: {
      fetchStats: 'خطأ في جلب الإحصائيات',
      accessDenied: 'غير مصرح لك بالوصول إلى هذه الصفحة',
    },
    currency: 'ريال',
  },
  en: {
    title: 'Dashboard',
    subtitle: 'Returns and Orders Statistics',
    totalReturns: 'Total Returns',
    pendingReturns: 'Pending Returns',
    approvedReturns: 'Approved Returns',
    rejectedReturns: 'Rejected Returns',
    totalQuantity: 'Total Quantity',
    totalValue: 'Total Value',
    statusDistribution: 'Status Distribution',
    returnsByBranch: 'Returns by Branch',
    latestOrders: 'Latest Orders',
    latestReturns: 'Latest Returns',
    filterByBranch: 'Filter by Branch',
    selectBranch: 'Select Branch',
    filterByDate: 'Filter by Date',
    clearFilters: 'Clear Filters',
    noData: 'No data available',
    errors: {
      fetchStats: 'Error fetching statistics',
      accessDenied: 'You are not authorized to access this page',
    },
    currency: 'SAR',
  },
};

const COLORS = ['#FFC107', '#4CAF50', '#F44336'];

const StatsCard: React.FC<{ title: string; value: string; icon: React.FC; color: string; ariaLabel: string }> = React.memo(
  ({ title, value, icon: Icon, color, ariaLabel }) => (
    <div
      className={`p-4 bg-${color}-50 rounded-lg border border-${color}-100 cursor-pointer hover:bg-${color}-100 transition-colors duration-200`}
      aria-label={ariaLabel}
    >
      <div className="flex items-center gap-3">
        <Icon className={`w-6 h-6 text-${color}-600`} />
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-lg font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  )
);

const Dashboard: React.FC = () => {
  const { language, t: languageT } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [startDate, endDate] = dateRange;

  // Check if user is authorized
  if (!user || user.role === 'chef') {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="p-6 bg-red-50 rounded-xl shadow-sm border border-red-200">
          <p className="text-red-600 text-sm font-medium">{t.errors.accessDenied}</p>
        </div>
      </div>
    );
  }

  // Fetch branches for admin
  const { data: branchesData, isLoading: branchesLoading } = useQuery<Branch[], Error>({
    queryKey: ['branches', language],
    queryFn: async () => {
      const response = await returnsAPI.getBranches();
      return response.branches.map((branch: any) => ({
        _id: branch._id,
        name: branch.name || 'Unknown',
        nameEn: branch.nameEn || branch.name || 'Unknown',
      }));
    },
    enabled: user.role === 'admin',
    staleTime: 10 * 60 * 1000,
  });

  // Fetch dashboard data (orders and returns)
  const { data: dashboardData, isLoading: statsLoading, error: statsError } = useQuery<
    { orders: Order[]; returns: Return[]; stats: Stats },
    Error
  >({
    queryKey: ['dashboardStats', user?.branchId, selectedBranch, startDate, endDate, language],
    queryFn: async () => {
      const query: any = { limit: 8 };
      if (user.role === 'branch' && user.branchId) {
        query.branch = user.branchId;
      } else if (selectedBranch) {
        query.branch = selectedBranch;
      }
      if (startDate) query.startDate = startDate.toISOString();
      if (endDate) query.endDate = endDate.toISOString();

      const [ordersResponse, returnsResponse] = await Promise.all([
        ordersAPI.getAll(query).catch(() => []),
        returnsAPI.getAll({ ...query, limit: 1000 }),
      ]);

      const mappedOrders: Order[] = ordersResponse.map((order: any) => ({
        id: order._id || crypto.randomUUID(),
        orderNumber: order.orderNumber || (isRtl ? 'غير معروف' : 'Unknown'),
        branchName: order.branch?.name || (isRtl ? 'فرع غير معروف' : 'Unknown Branch'),
        branchNameEn: order.branch?.nameEn || order.branch?.name || 'Unknown',
        branchId: order.branch?._id || 'unknown',
        status: order.status || 'pending',
        totalAmount: Number(order.totalAmount || order.totalPrice) || 0,
        date: formatDate(order.createdAt || new Date(), language),
        createdAt: order.createdAt || new Date().toISOString(),
      }));

      const mappedReturns: Return[] = returnsResponse.returns.map((ret: any) => ({
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
          price: Number(item.product?.price) || 0,
          reason: item.reason || '',
          reasonEn: item.reasonEn || item.reason || '',
        })),
        status: ret.status || ReturnStatus.PENDING,
        createdByName: ret.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
        createdByNameEn: ret.createdBy?.nameEn || ret.createdBy?.name || 'Unknown',
        createdAt: formatDate(ret.createdAt || new Date(), language),
      }));

      const stats: Stats = {
        totalReturns: mappedReturns.length,
        pendingReturns: mappedReturns.filter((r) => r.status === ReturnStatus.PENDING).length,
        approvedReturns: mappedReturns.filter((r) => r.status === ReturnStatus.APPROVED).length,
        rejectedReturns: mappedReturns.filter((r) => r.status === ReturnStatus.REJECTED).length,
        totalQuantity: mappedReturns.reduce((sum, r) => sum + r.items.reduce((s, i) => s + i.quantity, 0), 0),
        totalValue: mappedReturns
          .filter((r) => r.status === ReturnStatus.APPROVED)
          .reduce((sum, r) => sum + r.items.reduce((s, i) => s + i.quantity * i.price, 0), 0),
        statusDistribution: [
          { name: t.pendingReturns, value: mappedReturns.filter((r) => r.status === ReturnStatus.PENDING).length },
          { name: t.approvedReturns, value: mappedReturns.filter((r) => r.status === ReturnStatus.APPROVED).length },
          { name: t.rejectedReturns, value: mappedReturns.filter((r) => r.status === ReturnStatus.REJECTED).length },
        ],
        returnsByBranch: [],
      };

      if (user.role === 'admin') {
        const branchMap = new Map<string, { branchId: string; branchName: string; count: number; totalQuantity: number; totalValue: number }>();
        mappedReturns.forEach((ret) => {
          if (ret.branchId) {
            const branchId = ret.branchId;
            const existing = branchMap.get(branchId) || {
              branchId,
              branchName: ret.branchName,
              count: 0,
              totalQuantity: 0,
              totalValue: 0,
            };
            existing.count += 1;
            existing.totalQuantity += ret.items.reduce((sum, item) => sum + item.quantity, 0);
            if (ret.status === ReturnStatus.APPROVED) {
              existing.totalValue += ret.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
            }
            branchMap.set(branchId, existing);
          }
        });
        stats.returnsByBranch = Array.from(branchMap.values());
      } else if (user.branchId) {
        stats.returnsByBranch = [
          {
            branchId: user.branchId,
            branchName: user.branch?.name || (isRtl ? 'فرع غير معروف' : 'Unknown Branch'),
            count: stats.totalReturns,
            totalQuantity: stats.totalQuantity,
            totalValue: stats.totalValue,
          },
        ];
      }

      return { orders: mappedOrders, returns: mappedReturns, stats };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    onError: (err) => {
      toast.error(err.message || t.errors.fetchStats, {
        position: isRtl ? 'top-right' : 'top-left',
        toastId: `fetch-stats-${Date.now()}`,
      });
    },
  });

  // Socket events for real-time updates
  useEffect(() => {
    if (!socket || !user || !isConnected) return;

    socket.emit('joinRoom', {
      role: user.role,
      branchId: user.branchId,
      userId: user._id,
    });

    const handleReturnCreated = (data: {
      branchId: string;
      returnId: string;
      returnNumber: string;
      branchName?: string;
      eventId: string;
    }) => {
      if (user.role === 'branch' && data.branchId !== user.branchId) return;
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      addNotification({
        _id: data.eventId,
        type: 'success',
        message: t.notifications?.return_created
          ?.replace('{returnNumber}', data.returnNumber)
          ?.replace('{branchName}', data.branchName || t.branch) || `New return ${data.returnNumber}`,
        data: { returnId: data.returnId, branchId: data.branchId, eventId: data.eventId },
        read: false,
        createdAt: formatDate(new Date(), language),
        sound: '/sounds/notification.mp3',
        vibrate: [200, 100, 200],
        path: '/returns',
      });
    };

    const handleReturnStatusUpdated = (data: {
      branchId: string;
      returnId: string;
      status: string;
      returnNumber: string;
      branchName?: string;
      eventId: string;
    }) => {
      if (user.role === 'branch' && data.branchId !== user.branchId) return;
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      addNotification({
        _id: data.eventId,
        type: 'info',
        message: t.notifications?.return_status_updated
          ?.replace('{returnNumber}', data.returnNumber)
          ?.replace('{status}', t.status?.[data.status as keyof typeof t.status] || data.status)
          ?.replace('{branchName}', data.branchName || t.branch) || `Return ${data.returnNumber} updated`,
        data: { returnId: data.returnId, branchId: data.branchId, eventId: data.eventId },
        read: false,
        createdAt: formatDate(new Date(), language),
        sound: '/sounds/notification.mp3',
        vibrate: [200, 100, 200],
        path: '/returns',
      });
    };

    const handleOrderCompleted = (data: any) => {
      if (!data.orderId || !data.orderNumber || !data.branchName || !data.eventId) return;
      if (!['admin', 'branch', 'production'].includes(user.role)) return;
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
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
    };

    socket.on('returnCreated', handleReturnCreated);
    socket.on('returnStatusUpdated', handleReturnStatusUpdated);
    socket.on('orderCompleted', handleOrderCompleted);

    return () => {
      socket.off('returnCreated', handleReturnCreated);
      socket.off('returnStatusUpdated', handleReturnStatusUpdated);
      socket.off('orderCompleted', handleOrderCompleted);
    };
  }, [socket, user, isConnected, queryClient, t, isRtl, addNotification, language]);

  const branchOptions = useMemo(
    () => [
      { value: '', label: t.selectBranch },
      ...(branchesData?.map((branch) => ({ value: branch._id, label: isRtl ? branch.name : branch.nameEn || branch.name })) || []),
    ],
    [branchesData, t, isRtl]
  );

  const handleClearFilters = useCallback(() => {
    setSelectedBranch('');
    setDateRange([null, null]);
  }, []);

  const sortedOrders = useMemo(
    () =>
      dashboardData?.orders
        .filter((order) => ['pending', 'approved', 'in_production'].includes(order.status))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8) || [],
    [dashboardData?.orders]
  );

  const sortedReturns = useMemo(
    () =>
      dashboardData?.returns
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8) || [],
    [dashboardData?.returns]
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Package className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
            <p className="text-gray-600 text-xs">{t.subtitle}</p>
          </div>
        </div>
      </div>

      {statsError && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3"
        >
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-red-600 text-xs font-medium">{statsError.message}</span>
        </motion.div>
      )}

      <div className="p-5 bg-white rounded-xl shadow-sm mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {user.role === 'admin' && (
            <ProductDropdown
              value={selectedBranch}
              onChange={(value) => setSelectedBranch(value)}
              options={branchOptions}
              placeholder={t.filterByBranch}
              className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-xs"
              disabled={branchesLoading}
            />
          )}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-600" />
            <DatePicker
              selectsRange
              startDate={startDate}
              endDate={endDate}
              onChange={(update: [Date | null, Date | null]) => setDateRange(update)}
              placeholderText={t.filterByDate}
              className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-xs"
              dateFormat={isRtl ? 'dd/MM/yyyy' : 'MM/dd/yyyy'}
            />
          </div>
          <button
            onClick={handleClearFilters}
            className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded-md text-xs font-medium transition-colors duration-200"
          >
            {t.clearFilters}
          </button>
        </div>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-5 bg-white rounded-xl shadow-sm animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
              <div className="h-6 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : !dashboardData || (dashboardData.orders.length === 0 && dashboardData.returns.length === 0) ? (
        <div className="p-6 text-center bg-white rounded-xl shadow-sm">
          <p className="text-gray-500 text-xs">{t.noData}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatsCard
              title={t.totalReturns}
              value={dashboardData.stats.totalReturns.toString()}
              icon={RotateCcw}
              color="amber"
              ariaLabel={t.totalReturns}
            />
            <StatsCard
              title={t.totalQuantity}
              value={dashboardData.stats.totalQuantity.toString()}
              icon={Package}
              color="blue"
              ariaLabel={t.totalQuantity}
            />
            <StatsCard
              title={t.totalValue}
              value={`${dashboardData.stats.totalValue.toFixed(2)} ${t.currency}`}
              icon={CheckCircle}
              color="green"
              ariaLabel={t.totalValue}
            />
            <StatsCard
              title={t.statusDistribution}
              value={`${t.pendingReturns}: ${dashboardData.stats.pendingReturns} | ${t.approvedReturns}: ${dashboardData.stats.approvedReturns} | ${t.rejectedReturns}: ${dashboardData.stats.rejectedReturns}`}
              icon={AlertCircle}
              color="red"
              ariaLabel={t.statusDistribution}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="p-5 bg-white rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.statusDistribution}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={dashboardData.stats.statusDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {dashboardData.stats.statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="p-5 bg-white rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.returnsByBranch}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dashboardData.stats.returnsByBranch}>
                  <XAxis dataKey="branchName" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#FFC107" name={isRtl ? 'عدد المرتجعات' : 'Number of Returns'} />
                  <Bar dataKey="totalQuantity" fill="#4CAF50" name={isRtl ? 'إجمالي الكمية' : 'Total Quantity'} />
                  <Bar dataKey="totalValue" fill="#2196F3" name={isRtl ? 'القيمة الإجمالية' : 'Total Value'} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <ShoppingCart className={`w-5 h-5 ${isRtl ? 'ml-2' : 'mr-2'} text-amber-600`} />
                {t.latestOrders}
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                <AnimatePresence>
                  {sortedOrders.length === 0 ? (
                    <p className="text-gray-500 text-sm">{t.noData}</p>
                  ) : (
                    sortedOrders.map((order) => (
                      <motion.div
                        key={order.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="border border-amber-100 rounded-lg p-3 bg-amber-50 shadow-sm cursor-pointer hover:bg-amber-100 transition-colors duration-200"
                        onClick={() => navigate(`/orders/${order.id}`)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-sm text-gray-800 truncate">
                            {isRtl ? `طلب رقم ${order.orderNumber}` : `Order #${order.orderNumber}`}
                          </h4>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
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
                        <p className="text-sm text-gray-600 mb-2 truncate">
                          {isRtl ? order.branchName : order.branchNameEn || order.branchName}
                        </p>
                        <p className="text-xs text-gray-500">{isRtl ? `تم الإنشاء في: ${order.date}` : `Created At: ${order.date}`}</p>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <RotateCcw className={`w-5 h-5 ${isRtl ? 'ml-2' : 'mr-2'} text-amber-600`} />
                {t.latestReturns}
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                <AnimatePresence>
                  {sortedReturns.length === 0 ? (
                    <p className="text-gray-500 text-sm">{t.noData}</p>
                  ) : (
                    sortedReturns.map((ret) => (
                      <motion.div
                        key={ret.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="border border-amber-100 rounded-lg p-3 bg-amber-50 shadow-sm cursor-pointer hover:bg-amber-100 transition-colors duration-200"
                        onClick={() => navigate(`/returns/${ret.id}`)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-sm text-gray-800 truncate">
                            {isRtl ? `مرتجع رقم ${ret.returnNumber}` : `Return #${ret.returnNumber}`}
                          </h4>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              ret.status === ReturnStatus.PENDING
                                ? 'bg-amber-100 text-amber-800'
                                : ret.status === ReturnStatus.APPROVED
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {isRtl
                              ? ret.status === ReturnStatus.PENDING
                                ? 'معلق'
                                : ret.status === ReturnStatus.APPROVED
                                ? 'موافق عليه'
                                : 'مرفوض'
                              : ret.status.charAt(0).toUpperCase() + ret.status.slice(1)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2 truncate">
                          {isRtl ? ret.branchName : ret.branchNameEn || ret.branchName}
                        </p>
                        <p className="text-xs text-gray-500">{isRtl ? `تم الإنشاء في: ${ret.createdAt}` : `Created At: ${ret.createdAt}`}</p>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;