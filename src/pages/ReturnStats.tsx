import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Calendar, AlertCircle, Package } from 'lucide-react';
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
}

interface Return {
  _id: string;
  returnNumber: string;
  branch: { _id: string; name: string; nameEn: string; displayName: string } | null;
  items: Array<{
    product: { _id: string; price: number };
    quantity: number;
  }>;
  status: ReturnStatus;
}

const translations = {
  ar: {
    title: 'إحصائيات المرتجعات',
    subtitle: 'عرض إحصائيات طلبات الإرجاع حسب الفرع والحالة',
    totalReturns: 'إجمالي المرتجعات',
    pending: 'قيد الانتظار',
    approved: 'موافق عليه',
    rejected: 'مرفوض',
    totalQuantity: 'إجمالي الكمية',
    totalValue: 'القيمة الإجمالية',
    statusDistribution: 'توزيع الحالات',
    returnsByBranch: 'المرتجعات حسب الفرع',
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
    title: 'Returns Statistics',
    subtitle: 'View statistics of return requests by branch and status',
    totalReturns: 'Total Returns',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    totalQuantity: 'Total Quantity',
    totalValue: 'Total Value',
    statusDistribution: 'Status Distribution',
    returnsByBranch: 'Returns by Branch',
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

export const ReturnStats: React.FC = () => {
  const { t: languageT, language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const { addNotification } = useNotifications();
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

  const { data: branchesData, isLoading: branchesLoading } = useQuery<
    Array<{ _id: string; displayName: string }>,
    Error
  >({
    queryKey: ['branches', language],
    queryFn: async () => {
      const response = await returnsAPI.getBranches();
      return response.branches.map((branch: any) => ({
        _id: branch._id,
        displayName: isRtl ? (branch.name || 'Unknown') : (branch.nameEn || branch.name || 'Unknown'),
      }));
    },
    enabled: user.role === 'admin',
    staleTime: 10 * 60 * 1000,
  });

  const { data: statsData, isLoading: statsLoading, error: statsError } = useQuery<StatsData, Error>({
    queryKey: ['returnStats', user?.branchId, selectedBranch, startDate, endDate, language],
    queryFn: async () => {
      const query: any = {};
      if (user.role === 'branch' && user.branchId) {
        query.branch = user.branchId;
      } else if (selectedBranch) {
        query.branch = selectedBranch;
      }
      if (startDate) query.startDate = startDate.toISOString();
      if (endDate) query.endDate = endDate.toISOString();

      const response = await returnsAPI.getAll({ ...query, limit: 1000 });
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
      };

      if (user.role === 'admin') {
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

      return stats;
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
          ?.replace('{status}', t.status?.[data.status as keyof typeof t.status] || data.status)
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

  const handleClearFilters = useCallback(() => {
    setSelectedBranch('');
    setDateRange([null, null]);
  }, []);

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
      ) : !statsData || statsData.totalReturns === 0 ? (
        <div className="p-6 text-center bg-white rounded-xl shadow-sm">
          <p className="text-gray-500 text-xs">{t.noData}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="p-5 bg-white rounded-xl shadow-sm">
              <p className="text-xs text-gray-500">{t.totalReturns}</p>
              <p className="text-2xl font-bold text-gray-900">{statsData.totalReturns}</p>
            </div>
            <div className="p-5 bg-white rounded-xl shadow-sm">
              <p className="text-xs text-gray-500">{t.totalQuantity}</p>
              <p className="text-2xl font-bold text-gray-900">{statsData.totalQuantity}</p>
            </div>
            <div className="p-5 bg-white rounded-xl shadow-sm">
              <p className="text-xs text-gray-500">{t.totalValue}</p>
              <p className="text-2xl font-bold text-gray-900">{statsData.totalValue.toFixed(2)} {t.currency}</p>
            </div>
            <div className="p-5 bg-white rounded-xl shadow-sm">
              <p className="text-xs text-gray-500">{t.statusDistribution}</p>
              <div className="flex gap-2 mt-1">
                <span className="text-xs text-amber-600">{t.pending}: {statsData.pendingCount}</span>
                <span className="text-xs text-green-600">{t.approved}: {statsData.approvedCount}</span>
                <span className="text-xs text-red-600">{t.rejected}: {statsData.rejectedCount}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 bg-white rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.statusDistribution}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statsData.statusDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {statsData.statusDistribution.map((entry, index) => (
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
                <BarChart data={statsData.returnsByBranch}>
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
        </>
      )}
    </div>
  );
};

export default ReturnStats;