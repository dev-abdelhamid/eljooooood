import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { salesAPI } from '../services/salesAPI';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, Search, X, ChevronDown } from 'lucide-react';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import { Chart as ChartJS, CategoryScale, LinearScale, LineElement, BarElement, PointElement, Title, Tooltip, Legend } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, LineElement, BarElement, PointElement, Title, Tooltip, Legend);

// Interfaces
interface SalesTrend {
  period: string;
  totalSales: number;
  saleCount: number;
}

interface AnalyticsData {
  totalSales: number;
  totalCount: number;
  averageOrderValue: string;
  returnRate: string;
  topProduct: {
    productId: string | null;
    displayName: string;
    totalQuantity: number;
    totalRevenue: number;
  };
  productSales: Array<{
    productId: string;
    displayName: string;
    totalQuantity: number;
    totalRevenue: number;
  }>;
  leastProductSales: Array<{
    productId: string;
    displayName: string;
    totalQuantity: number;
    totalRevenue: number;
  }>;
  departmentSales: Array<{
    departmentId: string;
    displayName: string;
    totalRevenue: number;
    totalQuantity: number;
  }>;
  leastDepartmentSales: Array<{
    departmentId: string;
    displayName: string;
    totalRevenue: number;
    totalQuantity: number;
  }>;
  salesTrends: SalesTrend[];
  topCustomers: Array<{
    customerName: string;
    customerPhone: string;
    totalSpent: number;
    purchaseCount: number;
  }>;
  returnStats: Array<{
    status: string;
    count: number;
    totalQuantity: number;
  }>;
}

const translations = {
  ar: {
    title: 'إحصائيات الفرع',
    subtitle: 'تحليل أداء المبيعات',
    filters: 'الفلاتر',
    searchPlaceholder: 'ابحث عن منتج أو قسم...',
    filterBy: 'تصفية حسب',
    all: 'الكل',
    day: 'يوم',
    week: 'أسبوع',
    month: 'شهر',
    custom: 'مخصص',
    totalSales: 'إجمالي المبيعات',
    totalOrders: 'عدد الطلبات',
    averageOrderValue: 'متوسط قيمة الطلب',
    returnRate: 'معدل الإرجاع',
    topProduct: 'أفضل منتج',
    topCustomers: 'أفضل العملاء',
    productSales: 'مبيعات المنتجات',
    departmentSales: 'مبيعات الأقسام',
    leastProductSales: 'أقل المنتجات',
    leastDepartmentSales: 'أقل الأقسام',
    salesTrends: 'اتجاهات المبيعات',
    quantity: 'الكمية',
    noAnalytics: 'لا توجد بيانات متاحة',
    errors: {
      unauthorized_access: 'غير مخول للوصول',
      no_branch_assigned: 'لا يوجد فرع مخصص',
      branch_not_found: 'الفرع غير موجود',
      fetch_analytics: 'خطأ في جلب البيانات',
      server_error: 'خطأ في الخادم',
      invalid_dates: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية',
    },
    currency: 'ريال',
  },
  en: {
    title: 'Branch Analytics',
    subtitle: 'Sales Performance Analysis',
    filters: 'Filters',
    searchPlaceholder: 'Search products or departments...',
    filterBy: 'Filter By',
    all: 'All',
    day: 'Day',
    week: 'Week',
    month: 'Month',
    custom: 'Custom',
    totalSales: 'Total Sales',
    totalOrders: 'Total Orders',
    averageOrderValue: 'Average Order Value',
    returnRate: 'Return Rate',
    topProduct: 'Top Product',
    topCustomers: 'Top Customers',
    productSales: 'Product Sales',
    departmentSales: 'Department Sales',
    leastProductSales: 'Least Sold Products',
    leastDepartmentSales: 'Least Sold Departments',
    salesTrends: 'Sales Trends',
    quantity: 'Quantity',
    noAnalytics: 'No data available',
    errors: {
      unauthorized_access: 'Unauthorized access',
      no_branch_assigned: 'No branch assigned',
      branch_not_found: 'Branch not found',
      fetch_analytics: 'Error fetching data',
      server_error: 'Server error',
      invalid_dates: 'Start date must be before end date',
    },
    currency: 'SAR',
  },
};

// Helper Functions
const safeNumber = (value: any, defaultValue: number = 0): number =>
  typeof value === 'number' && !isNaN(value) ? value : defaultValue;

const safeString = (value: any, defaultValue: string = ''): string =>
  typeof value === 'string' ? value : defaultValue;

const isValidDate = (date: string): boolean => !isNaN(new Date(date).getTime());

// Components
const SearchInput: React.FC<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
}> = React.memo(({ value, onChange, placeholder }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="relative">
      <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400`} />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full py-2 ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm transition-all`}
      />
      {value && (
        <button
          onClick={() => onChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>)}
          className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-amber-500`}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
});

const FilterDropdown: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}> = React.memo(({ value, onChange, options }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find((opt) => opt.value === value) || options[0];
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full py-2 px-4 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm flex justify-between items-center ${isRtl ? 'text-right' : 'text-left'}`}
      >
        <span>{selected?.label}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className="px-4 py-2 text-sm hover:bg-amber-50 cursor-pointer"
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

const AnalyticsSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {[...Array(3)].map((_, i) => (
      <div key={i} className="p-4 bg-white rounded-lg shadow-sm border border-gray-100 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
        <div className="h-6 bg-gray-200 rounded w-1/2" />
      </div>
    ))}
  </div>
);

const BranchSalesAnalytics: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [filterPeriod, setFilterPeriod] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const debouncedSearch = useCallback(debounce((value: string) => setSearchTerm(value.trim().toLowerCase()), 300), []);

  // Authentication Check
  useEffect(() => {
    if (!user?.role || user.role !== 'branch' || !user.branchId) {
      const errorMsg = user?.branchId ? t.errors.unauthorized_access : t.errors.no_branch_assigned;
      setError(errorMsg);
      toast.error(errorMsg, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
      navigate('/unauthorized');
    }
  }, [user, t, isRtl, navigate]);

  // Date Range Calculation
  useEffect(() => {
    const today = new Date();
    let newStartDate = '';
    let newEndDate = today.toISOString().split('T')[0];
    if (filterPeriod === 'day') {
      newStartDate = newEndDate;
    } else if (filterPeriod === 'week') {
      newStartDate = new Date(today.setDate(today.getDate() - 7)).toISOString().split('T')[0];
    } else if (filterPeriod === 'month') {
      newStartDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    } else if (filterPeriod === 'custom') {
      newStartDate = startDate || newEndDate;
      newEndDate = endDate || newEndDate;
    }
    setStartDate(newStartDate);
    setEndDate(newEndDate);
  }, [filterPeriod, startDate, endDate]);

  // Fetch Analytics
  const fetchAnalytics = useCallback(async () => {
    if (!user?.branchId) {
      setError(t.errors.no_branch_assigned);
      setLoading(false);
      return;
    }

    if (filterPeriod === 'custom' && startDate && endDate) {
      if (!isValidDate(startDate) || !isValidDate(endDate) || new Date(startDate) > new Date(endDate)) {
        setError(t.errors.invalid_dates);
        toast.error(t.errors.invalid_dates, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      const params: any = { lang: language, branch: user.branchId };
      if (filterPeriod !== 'all' && startDate && endDate) {
        params.startDate = new Date(startDate).toISOString();
        params.endDate = new Date(endDate).toISOString();
      }
      const response = await salesAPI.getBranchAnalytics(params);
      setAnalytics({
        totalSales: safeNumber(response.totalSales),
        totalCount: safeNumber(response.totalCount),
        averageOrderValue: safeString(response.averageOrderValue, '0.00'),
        returnRate: safeString(response.returnRate, '0.00'),
        topProduct: {
          productId: response.topProduct?.productId || null,
          displayName: safeString(response.topProduct?.displayName, t.noAnalytics),
          totalQuantity: safeNumber(response.topProduct?.totalQuantity),
          totalRevenue: safeNumber(response.topProduct?.totalRevenue),
        },
        productSales: (response.productSales || []).map((ps: any) => ({
          productId: ps.productId,
          displayName: safeString(ps.displayName, t.noAnalytics),
          totalQuantity: safeNumber(ps.totalQuantity),
          totalRevenue: safeNumber(ps.totalRevenue),
        })),
        leastProductSales: (response.leastProductSales || []).map((ps: any) => ({
          productId: ps.productId,
          displayName: safeString(ps.displayName, t.noAnalytics),
          totalQuantity: safeNumber(ps.totalQuantity),
          totalRevenue: safeNumber(ps.totalRevenue),
        })),
        departmentSales: (response.departmentSales || []).map((ds: any) => ({
          departmentId: ds.departmentId,
          displayName: safeString(ds.displayName, t.noAnalytics),
          totalRevenue: safeNumber(ds.totalRevenue),
          totalQuantity: safeNumber(ds.totalQuantity),
        })),
        leastDepartmentSales: (response.leastDepartmentSales || []).map((ds: any) => ({
          departmentId: ds.departmentId,
          displayName: safeString(ds.displayName, t.noAnalytics),
          totalRevenue: safeNumber(ds.totalRevenue),
          totalQuantity: safeNumber(ds.totalQuantity),
        })),
        salesTrends: (response.salesTrends || []).map((trend: any) => ({
          period: formatDate(new Date(trend.period), language),
          totalSales: safeNumber(trend.totalSales),
          saleCount: safeNumber(trend.saleCount),
        })),
        topCustomers: (response.topCustomers || []).map((tc: any) => ({
          customerName: safeString(tc.customerName, t.noAnalytics),
          customerPhone: safeString(tc.customerPhone, ''),
          totalSpent: safeNumber(tc.totalSpent),
          purchaseCount: safeNumber(tc.purchaseCount),
        })),
        returnStats: (response.returnStats || []).map((rs: any) => ({
          status: safeString(rs.status, 'unknown'),
          count: safeNumber(rs.count),
          totalQuantity: safeNumber(rs.totalQuantity),
        })),
      });
      setError('');
    } catch (err: any) {
      const errorMsg =
        err.status === 400 ? t.errors.invalid_dates :
        err.status === 403 ? t.errors.unauthorized_access :
        err.status === 404 ? t.errors.branch_not_found :
        t.errors.fetch_analytics;
      setError(errorMsg);
      toast.error(errorMsg, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [user, language, t, filterPeriod, startDate, endDate]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Filtered Data
  const filteredData = useMemo(() => ({
    productSales: analytics?.productSales.filter((ps) => ps.displayName.toLowerCase().includes(searchTerm)) || [],
    leastProductSales: analytics?.leastProductSales.filter((ps) => ps.displayName.toLowerCase().includes(searchTerm)) || [],
    departmentSales: analytics?.departmentSales.filter((ds) => ds.displayName.toLowerCase().includes(searchTerm)) || [],
    leastDepartmentSales: analytics?.leastDepartmentSales.filter((ds) => ds.displayName.toLowerCase().includes(searchTerm)) || [],
    topCustomers: analytics?.topCustomers || [],
  }), [analytics, searchTerm]);

  // Chart Configuration
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const, labels: { font: { size: 10, family: 'Alexandria' } } },
      title: { display: true, font: { size: 14, family: 'Alexandria' }, padding: 10 },
      tooltip: { bodyFont: { size: 10, family: 'Alexandria' }, padding: 8 },
    },
    scales: {
      x: { ticks: { font: { size: 9, family: 'Alexandria' }, maxRotation: isRtl ? 45 : -45, autoSkip: true } },
      y: { beginAtZero: true, ticks: { font: { size: 9, family: 'Alexandria' } } },
    },
  }), [isRtl]);

  const salesTrendsData = useMemo(() => ({
    labels: analytics?.salesTrends.slice(0, 10).map((t) => t.period) || [],
    datasets: [
      {
        label: t.totalSales,
        data: analytics?.salesTrends.slice(0, 10).map((t) => t.totalSales) || [],
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        fill: true,
        tension: 0.4,
      },
    ],
  }), [analytics, t]);

  const productSalesData = useMemo(() => ({
    labels: filteredData.productSales.slice(0, 5).map((p) => p.displayName),
    datasets: [{
      label: t.totalSales,
      data: filteredData.productSales.slice(0, 5).map((p) => p.totalRevenue),
      backgroundColor: '#10b981',
    }],
  }), [filteredData, t]);

  const departmentSalesData = useMemo(() => ({
    labels: filteredData.departmentSales.slice(0, 5).map((d) => d.displayName),
    datasets: [{
      label: t.totalSales,
      data: filteredData.departmentSales.slice(0, 5).map((d) => d.totalRevenue),
      backgroundColor: '#3b82f6',
    }],
  }), [filteredData, t]);

  const periodOptions = useMemo(() => [
    { value: 'all', label: t.all },
    { value: 'day', label: t.day },
    { value: 'week', label: t.week },
    { value: 'month', label: t.month },
    { value: 'custom', label: t.custom },
  ], [t]);

  return (
    <div className="min-h-screen p-4 bg-gray-50 font-alexandria" dir={isRtl ? 'rtl' : 'ltr'}>
      <link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600&display=swap" rel="stylesheet" />
      <header className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">{t.title}</h1>
          <p className="text-sm text-gray-500">{t.subtitle}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <SearchInput
            value={searchTerm}
            onChange={(e) => debouncedSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
          />
          <FilterDropdown value={filterPeriod} onChange={setFilterPeriod} options={periodOptions} />
        </div>
      </header>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-sm text-red-600">{error}</span>
        </div>
      )}

      {filterPeriod === 'custom' && (
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm"
          />
        </div>
      )}

      {loading ? (
        <AnalyticsSkeleton />
      ) : !analytics ? (
        <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100 text-center text-sm text-gray-500">
          {t.noAnalytics}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-medium text-gray-700">{t.totalSales}</h3>
              <p className="text-lg font-bold text-amber-600">{safeNumber(analytics.totalSales).toFixed(2)} {t.currency}</p>
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-medium text-gray-700">{t.totalOrders}</h3>
              <p className="text-lg font-bold text-amber-600">{safeNumber(analytics.totalCount)}</p>
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-medium text-gray-700">{t.averageOrderValue}</h3>
              <p className="text-lg font-bold text-amber-600">{analytics.averageOrderValue} {t.currency}</p>
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-medium text-gray-700">{t.returnRate}</h3>
              <p className="text-lg font-bold text-amber-600">{analytics.returnRate}%</p>
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-medium text-gray-700">{t.topProduct}</h3>
              <p className="text-sm">{analytics.topProduct.displayName}</p>
              <p className="text-sm text-gray-500">{t.quantity}: {safeNumber(analytics.topProduct.totalQuantity)}</p>
            </div>
          </div>

          <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
            <h3 className="text-sm font-medium text-gray-700 mb-4">{t.salesTrends}</h3>
            <div className="h-64">
              <Line data={salesTrendsData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.salesTrends } } }} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-medium text-gray-700 mb-4">{t.productSales}</h3>
              <div className="h-48">
                <Bar data={productSalesData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.productSales } } }} />
              </div>
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-medium text-gray-700 mb-4">{t.departmentSales}</h3>
              <div className="h-48">
                <Bar data={departmentSalesData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.departmentSales } } }} />
              </div>
            </div>
          </div>

          <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
            <h3 className="text-sm font-medium text-gray-700 mb-4">{t.topCustomers}</h3>
            {filteredData.topCustomers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{t.topCustomers}</th>
                      <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{t.totalSales}</th>
                      <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{t.totalOrders}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.topCustomers.map((tc) => (
                      <tr key={`${tc.customerName}-${tc.customerPhone}`} className="border-t">
                        <td className="p-2">{tc.customerName || 'N/A'}</td>
                        <td className="p-2">{safeNumber(tc.totalSpent).toFixed(2)} {t.currency}</td>
                        <td className="p-2">{safeNumber(tc.purchaseCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">{t.noAnalytics}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-medium text-gray-700 mb-4">{t.leastProductSales}</h3>
              {filteredData.leastProductSales.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {filteredData.leastProductSales.map((ps) => (
                    <li key={ps.productId}>
                      {ps.displayName} - {safeNumber(ps.totalRevenue).toFixed(2)} {t.currency}, {t.quantity}: {ps.totalQuantity}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">{t.noAnalytics}</p>
              )}
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-medium text-gray-700 mb-4">{t.leastDepartmentSales}</h3>
              {filteredData.leastDepartmentSales.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {filteredData.leastDepartmentSales.map((ds) => (
                    <li key={ds.departmentId}>
                      {ds.displayName} - {safeNumber(ds.totalRevenue).toFixed(2)} {t.currency}, {t.quantity}: {ds.totalQuantity}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">{t.noAnalytics}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(BranchSalesAnalytics);