import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  useLanguage,
} from '../contexts/LanguageContext'; // Adjust paths to your context files
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import   { useAuth } from '../contexts/AuthContext';
import {
  AlertCircle,
  Search,
  X,
  ChevronDown,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { salesAPI, AnalyticsData, BranchStatsParams, AnalyticsParams } from '../services/salesAPI'; // Adjust path to SalesAPI.ts
import { branchesAPI } from '../services/api'; // Adjust path to your main API file for branchesAPI

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Translations
const translations = {
  ar: {
    title: 'إحصائيات الفروع',
    subtitle: 'تحليل أداء المبيعات حسب الفروع',
    branchFilter: 'اختر فرعًا',
    allBranches: 'جميع الفروع',
    searchPlaceholder: 'ابحث عن الفروع أو المنتجات...',
    filterBy: 'تصفية حسب',
    all: 'الكل',
    day: 'اليوم',
    week: 'الأسبوع',
    month: 'الشهر',
    custom: 'مخصص',
    startDate: 'تاريخ البدء',
    endDate: 'تاريخ الانتهاء',
    salesTrends: 'اتجاهات المبيعات',
    totalSales: 'إجمالي المبيعات',
    totalOrders: 'عدد الطلبات',
    averageOrderValue: 'متوسط قيمة الطلب',
    topProduct: 'أفضل منتج',
    topCustomers: 'أفضل العملاء',
    productSales: 'مبيعات المنتجات',
    departmentSales: 'مبيعات الأقسام',
    leastProductSales: 'أقل المنتجات مبيعًا',
    leastDepartmentSales: 'أقل الأقسام مبيعًا',
    quantity: 'الكمية',
    revenue: 'الإيرادات',
    errors: {
      unauthorized_access: 'غير مصرح لك بالوصول',
      fetch_analytics: 'خطأ أثناء جلب الإحصائيات',
      fetch_branches: 'خطأ أثناء جلب الفروع',
      no_analytics: 'لا توجد إحصائيات متاحة',
    },
    currency: 'ريال',
  },
  en: {
    title: 'Branch Analytics',
    subtitle: 'Analyze sales performance by branch',
    branchFilter: 'Select Branch',
    allBranches: 'All Branches',
    searchPlaceholder: 'Search branches or products...',
    filterBy: 'Filter By',
    all: 'All',
    day: 'Day',
    week: 'Week',
    month: 'Month',
    custom: 'Custom',
    startDate: 'Start Date',
    endDate: 'End Date',
    salesTrends: 'Sales Trends',
    totalSales: 'Total Sales',
    totalOrders: 'Total Orders',
    averageOrderValue: 'Average Order Value',
    topProduct: 'Top Product',
    topCustomers: 'Top Customers',
    productSales: 'Product Sales',
    departmentSales: 'Department Sales',
    leastProductSales: 'Least Sold Products',
    leastDepartmentSales: 'Least Sold Departments',
    quantity: 'Quantity',
    revenue: 'Revenue',
    errors: {
      unauthorized_access: 'You are not authorized to access',
      fetch_analytics: 'Error fetching analytics',
      fetch_branches: 'Error fetching branches',
      no_analytics: 'No analytics available',
    },
    currency: 'SAR',
  },
};

// Interfaces (assumed to be in SalesAPI.ts for consistency)
interface Branch {
  _id: string;
  name: string;
  nameEn?: string;
  displayName: string;
}

interface AnalyticsData {
  totalSales: number;
  totalCount: number;
  averageOrderValue: string;
  topProduct: {
    productId: string | null;
    productName: string;
    displayName: string;
    totalQuantity: number;
    totalRevenue: number;
  };
  productSales: Array<{
    productId: string;
    productName: string;
    displayName: string;
    totalQuantity: number;
    totalRevenue: number;
  }>;
  leastProductSales: Array<{
    productId: string;
    productName: string;
    displayName: string;
    totalQuantity: number;
    totalRevenue: number;
  }>;
  departmentSales: Array<{
    departmentId: string;
    departmentName: string;
    displayName: string;
    totalQuantity: number;
    totalRevenue: number;
  }>;
  leastDepartmentSales: Array<{
    departmentId: string;
    departmentName: string;
    displayName: string;
    totalQuantity: number;
    totalRevenue: number;
  }>;
  salesTrends: Array<{
    period: string;
    totalSales: number;
    saleCount: number;
  }>;
  topCustomers: Array<{
    customerName: string;
    customerPhone: string;
    totalSpent: number;
    purchaseCount: number;
  }>;
  returnStats?: Array<{
    status: string;
    count: number;
    totalQuantity: number;
  }>;
  returnRate?: string;
}

// Utility to format numbers
const formatNumber = (num: number, language: string): string => {
  return num.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US');
};

// Search Input Component
const SearchInput: React.FC<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  ariaLabel: string;
}> = React.memo(({ value, onChange, placeholder, ariaLabel }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="relative group">
      <Search
        className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors group-focus-within:text-amber-500 ${value ? 'opacity-0' : 'opacity-100'}`}
      />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full ${isRtl ? 'pl-12 pr-4' : 'pr-12 pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm placeholder-gray-400 font-alexandria`}
        aria-label={ariaLabel}
      />
      {value && (
        <button
          onClick={() => onChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>)}
          className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-gray-400 hover:text-amber-500 transition-colors`}
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
});

// Dropdown Component
const Dropdown: React.FC<{
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}> = ({ label, options, value, onChange }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 font-alexandria mb-1">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm font-alexandria appearance-none`}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5`}
        />
      </div>
    </div>
  );
};

// Main Component
const BranchSalesAnalytics: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const t = translations[language || 'en'];

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Fetch branches (for admin only)
  const fetchBranches = useCallback(async () => {
    if (user?.role !== 'admin') return;
    try {
      const response = await branchesAPI.getAll({ page: 1, limit: 100 });
      setBranches([{ _id: '', name: t.allBranches, displayName: t.allBranches }, ...response.branches]);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error fetching branches:`, error);
      toast.error(t.errors.fetch_branches, {
        position: isRtl ? 'top-right' : 'top-left',
        autoClose: 3000,
      });
    }
  }, [user?.role, t, isRtl]);

  // Calculate date range based on filter type
  const getDateRange = useCallback(() => {
    const today = new Date();
    let start: Date | undefined;
    let end: Date | undefined;

    switch (filterType) {
      case 'day':
        start = new Date(today);
        end = new Date(today);
        break;
      case 'week':
        start = new Date(today);
        start.setDate(today.getDate() - 7);
        end = new Date(today);
        break;
      case 'month':
        start = new Date(today);
        start.setMonth(today.getMonth() - 1);
        end = new Date(today);
        break;
      case 'custom':
        if (startDate && endDate) {
          start = new Date(startDate);
          end = new Date(endDate);
        }
        break;
      default:
        start = undefined;
        end = undefined;
    }

    return {
      startDate: start ? start.toISOString().split('T')[0] : undefined,
      endDate: end ? end.toISOString().split('T')[0] : undefined,
    };
  }, [filterType, startDate, endDate]);

  // Fetch analytics data
  const fetchAnalytics = useCallback(
    debounce(async (params: AnalyticsParams | BranchStatsParams) => {
      setIsLoading(true);
      try {
        const response = user?.role === 'admin'
          ? await salesAPI.getAnalytics(params as AnalyticsParams)
          : await salesAPI.getBranchStats(params as BranchStatsParams);
        setAnalytics(response);
      } catch (error: any) {
        console.error(`[${new Date().toISOString()}] Error fetching analytics:`, error);
        toast.error(error.message || t.errors.fetch_analytics, {
          position: isRtl ? 'top-right' : 'top-left',
          autoClose: 3000,
        });
        setAnalytics(null);
      } finally {
        setIsLoading(false);
      }
    }, 500),
    [user?.role, t, isRtl]
  );

  // Handle search and filters
  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleFilterChange = useCallback((value: string) => {
    setFilterType(value);
    if (value !== 'custom') {
      setStartDate('');
      setEndDate('');
    }
  }, []);

  // Fetch data on mount and when filters change
  useEffect(() => {
    if (user?.role === 'admin') {
      fetchBranches();
    }
  }, [fetchBranches, user?.role]);

  useEffect(() => {
    const { startDate, endDate } = getDateRange();
    const params: AnalyticsParams | BranchStatsParams = {
      ...(user?.role === 'admin' && selectedBranch ? { branch: selectedBranch } : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    };
    fetchAnalytics(params);
  }, [selectedBranch, filterType, startDate, endDate, fetchAnalytics, user?.role]);

  // Filtered lists based on search query
  const filteredProductSales = useMemo(() => {
    if (!analytics?.productSales) return [];
    return analytics.productSales.filter((item) =>
      item.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [analytics, searchQuery]);

  const filteredDepartmentSales = useMemo(() => {
    if (!analytics?.departmentSales) return [];
    return analytics.departmentSales.filter((item) =>
      item.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [analytics, searchQuery]);

  const filteredLeastProductSales = useMemo(() => {
    if (!analytics?.leastProductSales) return [];
    return analytics.leastProductSales.filter((item) =>
      item.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [analytics, searchQuery]);

  const filteredLeastDepartmentSales = useMemo(() => {
    if (!analytics?.leastDepartmentSales) return [];
    return analytics.leastDepartmentSales.filter((item) =>
      item.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [analytics, searchQuery]);

  // Chart data for sales trends
  const salesTrendsChart = useMemo(() => {
    if (!analytics?.salesTrends?.length) return null;
    return {
      type: 'line',
      data: {
        labels: analytics.salesTrends.map((trend) => trend.period),
        datasets: [
          {
            label: t.salesTrends,
            data: analytics.salesTrends.map((trend) => trend.totalSales),
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.2)',
            tension: 0.4,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'Alexandria' } } },
          title: { display: true, text: t.salesTrends, font: { family: 'Alexandria', size: 16 } },
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: `${t.revenue} (${t.currency})` } },
          x: { title: { display: true, text: t.filterBy } },
        },
      },
    };
  }, [analytics, t]);

  // Chart data for top products
  const productSalesChart = useMemo(() => {
    if (!filteredProductSales.length) return null;
    return {
      type: 'bar',
      data: {
        labels: filteredProductSales.map((item) => item.displayName),
        datasets: [
          {
            label: t.quantity,
            data: filteredProductSales.map((item) => item.totalQuantity),
            backgroundColor: '#f59e0b',
          },
          {
            label: t.revenue,
            data: filteredProductSales.map((item) => item.totalRevenue),
            backgroundColor: '#3b82f6',
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'Alexandria' } } },
          title: { display: true, text: t.productSales, font: { family: 'Alexandria', size: 16 } },
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: t.quantity } },
          x: { title: { display: true, text: t.productSales } },
        },
      },
    };
  }, [filteredProductSales, t]);

  // Filter options
  const filterOptions = useMemo(
    () => [
      { value: 'all', label: t.all },
      { value: 'day', label: t.day },
      { value: 'week', label: t.week },
      { value: 'month', label: t.month },
      { value: 'custom', label: t.custom },
    ],
    [t]
  );

  return (
    <div className={`p-6 ${isRtl ? 'text-right' : 'text-left'} font-alexandria bg-gray-50 min-h-screen`}>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">{t.title}</h1>
      <p className="text-gray-600 mb-6">{t.subtitle}</p>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {user?.role === 'admin' && (
          <div className="w-full md:w-1/4">
            <Dropdown
              label={t.branchFilter}
              options={branches.map((branch) => ({
                value: branch._id,
                label: branch.displayName,
              }))}
              value={selectedBranch}
              onChange={setSelectedBranch}
            />
          </div>
        )}
        <div className="w-full md:w-1/4">
          <Dropdown
            label={t.filterBy}
            options={filterOptions}
            value={filterType}
            onChange={handleFilterChange}
          />
        </div>
        {filterType === 'custom' && (
          <>
            <div className="w-full md:w-1/4">
              <label className="block text-sm font-medium text-gray-700 font-alexandria mb-1">{t.startDate}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full py-2.5 px-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm font-alexandria"
              />
            </div>
            <div className="w-full md:w-1/4">
              <label className="block text-sm font-medium text-gray-700 font-alexandria mb-1">{t.endDate}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full py-2.5 px-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm font-alexandria"
              />
            </div>
          </>
        )}
      </div>

      {/* Search */}
      <div className="mb-6">
        <SearchInput
          value={searchQuery}
          onChange={handleSearch}
          placeholder={t.searchPlaceholder}
          ariaLabel={t.searchPlaceholder}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
        </div>
      ) : !analytics || analytics.totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <AlertCircle className="w-12 h-12 mb-2" />
          <p>{t.errors.no_analytics}</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-600">{t.totalSales}</h3>
              <p className="text-2xl font-bold text-amber-500">
                {formatNumber(analytics.totalSales, language)} {t.currency}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-600">{t.totalOrders}</h3>
              <p className="text-2xl font-bold text-amber-500">{formatNumber(analytics.totalCount, language)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-600">{t.averageOrderValue}</h3>
              <p className="text-2xl font-bold text-amber-500">
                {formatNumber(parseFloat(analytics.averageOrderValue), language)} {t.currency}
              </p>
            </div>
            {user?.role === 'admin' && analytics.returnRate && (
              <div className="bg-white p-4 rounded-lg shadow-md">
                <h3 className="text-sm font-medium text-gray-600">{t.returnRate}</h3>
                <p className="text-2xl font-bold text-amber-500">{analytics.returnRate}%</p>
              </div>
            )}
          </div>

          {/* Top Product */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">{t.topProduct}</h3>
            <p className="text-gray-600">
              {analytics.topProduct.displayName} ({formatNumber(analytics.topProduct.totalQuantity, language)} {t.quantity},{' '}
              {formatNumber(analytics.topProduct.totalRevenue, language)} {t.currency})
            </p>
          </div>

          {/* Charts */}
          {salesTrendsChart && (
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <Line data={salesTrendsChart.data} options={salesTrendsChart.options} />
            </div>
          )}
          {productSalesChart && (
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <Bar data={productSalesChart.data} options={productSalesChart.options} />
            </div>
          )}

          {/* Lists */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Product Sales */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">{t.productSales}</h3>
              {filteredProductSales.length ? (
                <ul className="space-y-2">
                  {filteredProductSales.map((item) => (
                    <li key={item.productId} className="flex justify-between text-sm text-gray-600">
                      <span>{item.displayName}</span>
                      <span>
                        {formatNumber(item.totalQuantity, language)} {t.quantity},{' '}
                        {formatNumber(item.totalRevenue, language)} {t.currency}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">{t.errors.no_analytics}</p>
              )}
            </div>

            {/* Department Sales */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">{t.departmentSales}</h3>
              {filteredDepartmentSales.length ? (
                <ul className="space-y-2">
                  {filteredDepartmentSales.map((item) => (
                    <li key={item.departmentId} className="flex justify-between text-sm text-gray-600">
                      <span>{item.displayName}</span>
                      <span>
                        {formatNumber(item.totalQuantity, language)} {t.quantity},{' '}
                        {formatNumber(item.totalRevenue, language)} {t.currency}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">{t.errors.no_analytics}</p>
              )}
            </div>

            {/* Least Product Sales */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">{t.leastProductSales}</h3>
              {filteredLeastProductSales.length ? (
                <ul className="space-y-2">
                  {filteredLeastProductSales.map((item) => (
                    <li key={item.productId} className="flex justify-between text-sm text-gray-600">
                      <span>{item.displayName}</span>
                      <span>
                        {formatNumber(item.totalQuantity, language)} {t.quantity},{' '}
                        {formatNumber(item.totalRevenue, language)} {t.currency}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">{t.errors.no_analytics}</p>
              )}
            </div>

            {/* Least Department Sales */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">{t.leastDepartmentSales}</h3>
              {filteredLeastDepartmentSales.length ? (
                <ul className="space-y-2">
                  {filteredLeastDepartmentSales.map((item) => (
                    <li key={item.departmentId} className="flex justify-between text-sm text-gray-600">
                      <span>{item.displayName}</span>
                      <span>
                        {formatNumber(item.totalQuantity, language)} {t.quantity},{' '}
                        {formatNumber(item.totalRevenue, language)} {t.currency}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">{t.errors.no_analytics}</p>
              )}
            </div>

            {/* Top Customers */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">{t.topCustomers}</h3>
              {analytics.topCustomers.length ? (
                <ul className="space-y-2">
                  {analytics.topCustomers
                    .filter((customer) =>
                      customer.customerName.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((customer, index) => (
                      <li key={index} className="flex justify-between text-sm text-gray-600">
                        <span>{customer.customerName} ({customer.customerPhone})</span>
                        <span>
                          {formatNumber(customer.purchaseCount, language)} {t.totalOrders},{' '}
                          {formatNumber(customer.totalSpent, language)} {t.currency}
                        </span>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="text-gray-500">{t.errors.no_analytics}</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BranchSalesAnalytics;