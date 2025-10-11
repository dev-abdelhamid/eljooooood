import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Calendar, AlertCircle, Package, Filter } from 'lucide-react';
import { returnsAPI } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useNotifications } from '../contexts/NotificationContext';
import { ProductDropdown } from './NewOrder';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

enum ReturnStatus {
  PENDING = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

interface StatsData {
  totalReturns: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  totalQuantity: number;
  totalValue: number;
  returnsByBranch: Array<{ branchId: string; branchName: string; count: number; totalQuantity: number; totalValue: number }>;
  statusDistribution: Array<{ name: string; value: number }>;
  reasonDistribution: Array<{ name: string; value: number }>;
  topProducts: Array<{ productId: string; productName: string; count: number; totalQuantity: number }>;
}

interface Return {
  _id: string;
  returnNumber: string;
  branch: { _id: string; name: string; nameEn: string; displayName: string } | null;
  items: Array<{
    product: { _id: string; price: number; name: string; nameEn: string };
    quantity: number;
    reason: string;
    reasonEn: string;
  }>;
  status: ReturnStatus;
  createdAt: string;
}

interface Branch {
  _id: string;
  displayName: string;
}

const translations = {
  ar: {
    title: 'إحصائيات المرتجعات',
    subtitle: 'عرض إحصائيات طلبات الإرجاع حسب الفرع والحالة والسبب',
    totalReturns: 'إجمالي المرتجعات',
    pending: 'قيد الانتظار',
    approved: 'موافق عليه',
    rejected: 'مرفوض',
    totalQuantity: 'إجمالي الكمية',
    totalValue: 'القيمة الإجمالية',
    statusDistribution: 'توزيع الحالات',
    reasonDistribution: 'توزيع الأسباب',
    topProducts: 'أكثر المنتجات إرجاعًا',
    returnsByBranch: 'المرتجعات حسب الفرع',
    filterByBranch: 'تصفية حسب الفرع',
    selectBranch: 'اختر الفرع',
    filterByDate: 'تصفية حسب التاريخ',
    filterByStatus: 'تصفية حسب الحالة',
    selectStatus: 'اختر الحالة',
    filterByReason: 'تصفية حسب السبب',
    selectReason: 'اختر السبب',
    clearFilters: 'مسح الفلاتر',
    noData: 'لا توجد بيانات متاحة',
    errors: {
      fetchStats: 'خطأ في جلب الإحصائيات',
      fetchBranches: 'خطأ في جلب الفروع',
      accessDenied: 'غير مصرح لك بالوصول إلى هذه الصفحة',
    },
    currency: 'ريال',
    reasons: {
      Damaged: 'تالف',
      'Wrong Item': 'منتج خاطئ',
      'Excess Quantity': 'كمية زائدة',
      Other: 'أخرى',
    },
  },
  en: {
    title: 'Returns Statistics',
    subtitle: 'View statistics of return requests by branch, status, and reason',
    totalReturns: 'Total Returns',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    totalQuantity: 'Total Quantity',
    totalValue: 'Total Value',
    statusDistribution: 'Status Distribution',
    reasonDistribution: 'Reason Distribution',
    topProducts: 'Top Returned Products',
    returnsByBranch: 'Returns by Branch',
    filterByBranch: 'Filter by Branch',
    selectBranch: 'Select Branch',
    filterByDate: 'Filter by Date',
    filterByStatus: 'Filter by Status',
    selectStatus: 'Select Status',
    filterByReason: 'Filter by Reason',
    selectReason: 'Select Reason',
    clearFilters: 'Clear Filters',
    noData: 'No data available',
    errors: {
      fetchStats: 'Error fetching statistics',
      fetchBranches: 'Error fetching branches',
      accessDenied: 'You are not authorized to access this page',
    },
    currency: 'SAR',
    reasons: {
      Damaged: 'Damaged',
      'Wrong Item': 'Wrong Item',
      'Excess Quantity': 'Excess Quantity',
      Other: 'Other',
    },
  },
};

const COLORS = ['#FFC107', '#4CAF50', '#F44336', '#2196F3', '#9C27B0'];
const STATUS_OPTIONS = [
  { value: '', label: 'اختر الحالة' },
  { value: ReturnStatus.PENDING, label: 'قيد الانتظار' },
  { value: ReturnStatus.APPROVED, label: 'موافق عليه' },
  { value: ReturnStatus.REJECTED, label: 'مرفوض' },
];
const STATUS_OPTIONS_EN = [
  { value: '', label: 'Select Status' },
  { value: ReturnStatus.PENDING, label: 'Pending' },
  { value: ReturnStatus.APPROVED, label: 'Approved' },
  { value: ReturnStatus.REJECTED, label: 'Rejected' },
];
const REASON_OPTIONS = [
  { value: '', label: 'اختر السبب' },
  { value: 'Damaged', label: 'تالف' },
  { value: 'Wrong Item', label: 'منتج خاطئ' },
  { value: 'Excess Quantity', label: 'كمية زائدة' },
  { value: 'Other', label: 'أخرى' },
];
const REASON_OPTIONS_EN = [
  { value: '', label: 'Select Reason' },
  { value: 'Damaged', label: 'Damaged' },
  { value: 'Wrong Item', label: 'Wrong Item' },
  { value: 'Excess Quantity', label: 'Excess Quantity' },
  { value: 'Other', label: 'Other' },
];

const StatsCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.FC;
  color: string;
  ariaLabel: string;
}> = React.memo(({ title, value, icon: Icon, color, ariaLabel }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.3 }}
    className={`p-5 bg-${color}-50 rounded-xl shadow-sm border border-${color}-100 hover:bg-${color}-100 transition-colors duration-200`}
    aria-label={ariaLabel}
  >
    <div className="flex items-center gap-3">
      <Icon className={`w-6 h-6 text-${color}-600`} />
      <div>
        <p className="text-xs text-gray-600">{title}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  </motion.div>
));

export const ReturnStats: React.FC = () => {
  const { language, t: languageT } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedReason, setSelectedReason] = useState<string>('');
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
  const { data: branchesData, isLoading: branchesLoading, error: branchesError } = useQuery<
    Branch[],
    Error
  >({
    queryKey: ['branches', language],
    queryFn: async () => {
      try {
        const response = await returnsAPI.getBranches();
        return response.branches.map((branch: any) => ({
          _id: branch._id,
          displayName: isRtl ? (branch.name || 'غير معروف') : (branch.nameEn || branch.name || 'Unknown'),
        }));
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Error fetching branches:`, err);
        toast.error(t.errors.fetchBranches, {
          position: isRtl ? 'top-right' : 'top-left',
          toastId: `fetch-branches-${Date.now()}`,
        });
        throw err;
      }
    },
    enabled: user.role === 'admin',
    staleTime: 10 * 60 * 1000,
  });

  // Fetch stats data
  const { data: statsData, isLoading: statsLoading, error: statsError } = useQuery<StatsData, Error>({
    queryKey: ['returnStats', user?.branchId, selectedBranch, selectedStatus, selectedReason, startDate, endDate, language],
    queryFn: async () => {
      const query: any = { limit: 1000 };
      if (user.role === 'branch' && user.branchId) {
        query.branch = user.branchId;
      } else if (selectedBranch) {
        query.branch = selectedBranch;
      }
      if (selectedStatus) query.status = selectedStatus;
      if (selectedReason) query['items.reasonEn'] = selectedReason;
      if (startDate) query.startDate = startDate.toISOString();
      if (endDate) query.endDate = endDate.toISOString();

      const response = await returnsAPI.getAll(query);
      const returns = response.returns as Return[];

      const stats: StatsData = {
        totalReturns: returns.length,
        pendingCount: returns.filter((r) => r.status === ReturnStatus.PENDING).length,
        approvedCount: returns.filter((r) => r.status === ReturnStatus.APPROVED).length,
        rejectedCount: returns.filter((r) => r.status === ReturnStatus.REJECTED).length,
        totalQuantity: returns.reduce((sum, r) => sum + r.items.reduce((s, i) => s + i.quantity, 0), 0),
        totalValue: returns
          .filter((r) => r.status === ReturnStatus.APPROVED)
          .reduce((sum, r) => sum + r.items.reduce((s, i) => s + i.quantity * i.product.price, 0), 0),
        returnsByBranch: [],
        statusDistribution: [
          { name: t.pending, value: returns.filter((r) => r.status === ReturnStatus.PENDING).length },
          { name: t.approved, value: returns.filter((r) => r.status === ReturnStatus.APPROVED).length },
          { name: t.rejected, value: returns.filter((r) => r.status === ReturnStatus.REJECTED).length },
        ],
        reasonDistribution: [
          { name: t.reasons.Damaged, value: returns.filter((r) => r.items.some((i) => i.reasonEn === 'Damaged')).length },
          { name: t.reasons['Wrong Item'], value: returns.filter((r) => r.items.some((i) => i.reasonEn === 'Wrong Item')).length },
          { name: t.reasons['Excess Quantity'], value: returns.filter((r) => r.items.some((i) => i.reasonEn === 'Excess Quantity')).length },
          { name: t.reasons.Other, value: returns.filter((r) => r.items.some((i) => i.reasonEn === 'Other')).length },
        ],
        topProducts: [],
      };

      // Calculate returns by branch
      if (user.role === 'admin' || user.role === 'production') {
        const branchMap = new Map<string, { branchId: string; branchName: string; count: number; totalQuantity: number; totalValue: number }>();
        returns.forEach((ret) => {
          if (ret.branch) {
            const branchId = ret.branch._id;
            const existing = branchMap.get(branchId) || {
              branchId,
              branchName: ret.branch.displayName,
              count: 0,
              totalQuantity: 0,
              totalValue: 0,
            };
            existing.count += 1;
            existing.totalQuantity += ret.items.reduce((sum, item) => sum + item.quantity, 0);
            if (ret.status === ReturnStatus.APPROVED) {
              existing.totalValue += ret.items.reduce((sum, item) => sum + item.quantity * item.product.price, 0);
            }
            branchMap.set(branchId, existing);
          }
        });
        stats.returnsByBranch = Array.from(branchMap.values());
      } else if (user.branch) {
        stats.returnsByBranch = [
          {
            branchId: user.branchId,
            branchName: user.branch.displayName,
            count: stats.totalReturns,
            totalQuantity: stats.totalQuantity,
            totalValue: stats.totalValue,
          },
        ];
      }

      // Calculate top 5 returned products
      const productMap = new Map<string, { productId: string; productName: string; count: number; totalQuantity: number }>();
      returns.forEach((ret) => {
        ret.items.forEach((item) => {
          const productId = item.product._id;
          const existing = productMap.get(productId) || {
            productId,
            productName: isRtl ? (item.product.name || 'غير معروف') : (item.product.nameEn || item.product.name || 'Unknown'),
            count: 0,
            totalQuantity: 0,
          };
          existing.count += 1;
          existing.totalQuantity += item.quantity;
          productMap.set(productId, existing);
        });
      });
      stats.topProducts = Array.from(productMap.values())
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, 5);

      return stats;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    onError: (err) => {
      console.error(`[${new Date().toISOString()}] Error fetching stats:`, err);
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
      queryClient.invalidateQueries({ queryKey: ['returnStats'] });
      addNotification({
        _id: data.eventId,
        type: 'success',
        message: t.notifications?.return_created
          ?.replace('{returnNumber}', data.returnNumber)
          ?.replace('{branchName}', data.branchName || t.branch) || `New return ${data.returnNumber}`,
        data: { returnId: data.returnId, branchId: data.branchId, eventId: data.eventId },
        read: false,
        createdAt: new Date().toISOString(),
        sound: '/sounds/notification.mp3',
        vibrate: [200, 100, 200],
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
      queryClient.invalidateQueries({ queryKey: ['returnStats'] });
      addNotification({
        _id: data.eventId,
        type: 'info',
        message: t.notifications?.return_status_updated
          ?.replace('{returnNumber}', data.returnNumber)
          ?.replace('{status}', t.reasons[data.status as keyof typeof t.reasons] || data.status)
          ?.replace('{branchName}', data.branchName || t.branch) || `Return ${data.returnNumber} updated`,
        data: { returnId: data.returnId, branchId: data.branchId, eventId: data.eventId },
        read: false,
        createdAt: new Date().toISOString(),
        sound: '/sounds/notification.mp3',
        vibrate: [200, 100, 200],
      });
    };

    socket.on('returnCreated', handleReturnCreated);
    socket.on('returnStatusUpdated', handleReturnStatusUpdated);

    return () => {
      socket.off('returnCreated', handleReturnCreated);
      socket.off('returnStatusUpdated', handleReturnStatusUpdated);
    };
  }, [socket, user, isConnected, queryClient, t, isRtl, addNotification]);

  const branchOptions = useMemo(
    () => [
      { value: '', label: t.selectBranch },
      ...(branchesData?.map((branch) => ({ value: branch._id, label: branch.displayName })) || []),
    ],
    [branchesData, t]
  );

  const statusOptions = useMemo(
    () => (isRtl ? STATUS_OPTIONS : STATUS_OPTIONS_EN),
    [isRtl]
  );

  const reasonOptions = useMemo(
    () => (isRtl ? REASON_OPTIONS : REASON_OPTIONS_EN),
    [isRtl]
  );

  const handleClearFilters = useCallback(() => {
    setSelectedBranch('');
    setSelectedStatus('');
    setSelectedReason('');
    setDateRange([null, null]);
  }, []);

  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
          <p className="text-sm font-medium text-gray-900">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Package className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
            <p className="text-gray-600 text-xs">{t.subtitle}</p>
          </div>
        </div>
      </div>

      {(statsError || branchesError) && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3"
        >
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-red-600 text-xs font-medium">
            {statsError?.message || branchesError?.message || t.errors.fetchStats}
          </span>
        </motion.div>
      )}

      <div className="p-5 bg-white rounded-xl shadow-sm mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {user.role === 'admin' && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-600" />
              <ProductDropdown
                value={selectedBranch}
                onChange={(value) => setSelectedBranch(value)}
                options={branchOptions}
                placeholder={t.filterByBranch}
                className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-xs"
                disabled={branchesLoading}
                aria-label={t.filterByBranch}
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <ProductDropdown
              value={selectedStatus}
              onChange={(value) => setSelectedStatus(value)}
              options={statusOptions}
              placeholder={t.filterByStatus}
              className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-xs"
              aria-label={t.filterByStatus}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <ProductDropdown
              value={selectedReason}
              onChange={(value) => setSelectedReason(value)}
              options={reasonOptions}
              placeholder={t.filterByReason}
              className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-xs"
              aria-label={t.filterByReason}
            />
          </div>
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
              aria-label={t.filterByDate}
            />
          </div>
          <button
            onClick={handleClearFilters}
            className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded-md text-xs font-medium transition-colors duration-200 col-span-1 sm:col-span-2 lg:col-span-4"
            aria-label={t.clearFilters}
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
      ) : !statsData || statsData.totalReturns === 0 ? (
        <div className="p-6 text-center bg-white rounded-xl shadow-sm">
          <p className="text-gray-500 text-xs">{t.noData}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatsCard
              title={t.totalReturns}
              value={statsData.totalReturns}
              icon={Package}
              color="amber"
              ariaLabel={t.totalReturns}
            />
            <StatsCard
              title={t.totalQuantity}
              value={statsData.totalQuantity}
              icon={Package}
              color="blue"
              ariaLabel={t.totalQuantity}
            />
            <StatsCard
              title={t.totalValue}
              value={`${statsData.totalValue.toFixed(2)} ${t.currency}`}
              icon={Package}
              color="green"
              ariaLabel={t.totalValue}
            />
            <StatsCard
              title={t.statusDistribution}
              value={`${t.pending}: ${statsData.pendingCount} | ${t.approved}: ${statsData.approvedCount} | ${t.rejected}: ${statsData.rejectedCount}`}
              icon={AlertCircle}
              color="purple"
              ariaLabel={t.statusDistribution}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="p-5 bg-white rounded-xl shadow-sm"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.statusDistribution}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statsData.statusDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={true}
                    paddingAngle={5}
                  >
                    {statsData.statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={customTooltip} />
                  <Legend align={isRtl ? 'right' : 'left'} verticalAlign="middle" layout="vertical" />
                </PieChart>
              </ResponsiveContainer>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="p-5 bg-white rounded-xl shadow-sm"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.reasonDistribution}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statsData.reasonDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={true}
                    paddingAngle={5}
                  >
                    {statsData.reasonDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={customTooltip} />
                  <Legend align={isRtl ? 'right' : 'left'} verticalAlign="middle" layout="vertical" />
                </PieChart>
              </ResponsiveContainer>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="p-5 bg-white rounded-xl shadow-sm"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.returnsByBranch}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={statsData.returnsByBranch} layout={isRtl ? 'vertical' : 'horizontal'}>
                  <XAxis
                    type={isRtl ? 'category' : 'category'}
                    dataKey="branchName"
                    angle={isRtl ? 45 : -45}
                    textAnchor={isRtl ? 'start' : 'end'}
                    height={60}
                  />
                  <YAxis type={isRtl ? 'number' : 'number'} />
                  <Tooltip content={customTooltip} />
                  <Legend />
                  <Bar
                    dataKey="count"
                    fill="#FFC107"
                    name={isRtl ? 'عدد المرتجعات' : 'Number of Returns'}
                    barSize={30}
                  />
                  <Bar
                    dataKey="totalQuantity"
                    fill="#4CAF50"
                    name={isRtl ? 'إجمالي الكمية' : 'Total Quantity'}
                    barSize={30}
                  />
                  <Bar
                    dataKey="totalValue"
                    fill="#2196F3"
                    name={isRtl ? 'القيمة الإجمالية' : 'Total Value'}
                    barSize={30}
                  />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="p-5 bg-white rounded-xl shadow-sm"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.topProducts}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={statsData.topProducts} layout={isRtl ? 'vertical' : 'horizontal'}>
                  <XAxis
                    type={isRtl ? 'category' : 'category'}
                    dataKey="productName"
                    angle={isRtl ? 45 : -45}
                    textAnchor={isRtl ? 'start' : 'end'}
                    height={60}
                  />
                  <YAxis type={isRtl ? 'number' : 'number'} />
                  <Tooltip content={customTooltip} />
                  <Legend />
                  <Bar
                    dataKey="totalQuantity"
                    fill="#9C27B0"
                    name={isRtl ? 'إجمالي الكمية' : 'Total Quantity'}
                    barSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReturnStats;