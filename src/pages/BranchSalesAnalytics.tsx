import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { salesAPI } from '../services/salesAPI';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, Search, X, ChevronDown } from 'lucide-react';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';

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
    productName: string;
    productNameEn?: string | null;
    displayName: string;
    totalQuantity: number;
    totalRevenue: number;
  };
  productSales: Array<{
    productId: string;
    productName: string;
    productNameEn?: string | null;
    displayName: string;
    totalQuantity: number;
    totalRevenue: number;
  }>;
  leastProductSales: Array<{
    productId: string;
    productName: string;
    productNameEn?: string | null;
    displayName: string;
    totalQuantity: number;
    totalRevenue: number;
  }>;
  departmentSales: Array<{
    departmentId: string;
    departmentName: string;
    departmentNameEn?: string | null;
    displayName: string;
    totalRevenue: number;
    totalQuantity: number;
  }>;
  leastDepartmentSales: Array<{
    departmentId: string;
    departmentName: string;
    departmentNameEn?: string | null;
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
    subtitle: 'تحليل أداء المبيعات للفرع',
    filters: 'الفلاتر',
    searchPlaceholder: 'ابحث عن المنتجات أو الأقسام...',
    filterBy: 'تصفية حسب',
    all: 'الكل',
    day: 'اليوم',
    week: 'الأسبوع',
    month: 'الشهر',
    custom: 'مخصص',
    totalSales: 'إجمالي المبيعات',
    totalOrders: 'عدد الطلبات',
    averageOrderValue: 'متوسط قيمة الطلب',
    returnRate: 'معدل الإرجاع',
    topProduct: 'أفضل منتج',
    topCustomers: 'أفضل العملاء',
    productSales: 'مبيعات المنتجات',
    departmentSales: 'مبيعات الأقسام',
    leastProductSales: 'أقل المنتجات مبيعًا',
    leastDepartmentSales: 'أقل الأقسام مبيعًا',
    salesTrends: 'اتجاهات المبيعات',
    quantity: 'الكمية',
    noAnalytics: 'لا توجد إحصائيات متاحة',
    errors: {
      unauthorized_access: 'غير مخول لك بالوصول',
      no_branch_assigned: 'لا يوجد فرع مخصص',
      branch_not_found: 'الفرع غير موجود',
      fetch_analytics: 'خطأ أثناء جلب الإحصائيات',
      server_error: 'خطأ في السيرفر، حاول لاحقًا',
      method_not_found: 'خطأ في تهيئة النظام، يرجى التواصل مع الدعم',
      invalid_dates: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية',
    },
    currency: 'ريال',
  },
  en: {
    title: 'Branch Analytics',
    subtitle: 'Analyze sales performance for the branch',
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
    noAnalytics: 'No analytics available',
    errors: {
      unauthorized_access: 'You are not authorized to access',
      no_branch_assigned: 'No branch assigned',
      branch_not_found: 'Branch not found',
      fetch_analytics: 'Error fetching analytics',
      server_error: 'Server error, please try again later',
      method_not_found: 'System initialization error, please contact support',
      invalid_dates: 'Start date must be before end date',
    },
    currency: 'SAR',
  },
};

const safeNumber = (value: any, defaultValue: number = 0): number => {
  return typeof value === 'number' && !isNaN(value) ? value : defaultValue;
};

const safeString = (value: any, defaultValue: string = ''): string => {
  return typeof value === 'string' ? value : defaultValue;
};

// Reusable Components
const SearchInput = React.memo<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  ariaLabel: string;
}>(({ value, onChange, placeholder, ariaLabel }) => {
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
          aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
});

const ProductDropdown = React.memo<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
  disabled?: boolean;
}>(({ value, onChange, options, ariaLabel, disabled = false }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((opt) => opt.value === value) || options[0] || { value: '', label: isRtl ? 'اختر' : 'Select' };
  return (
    <div className="relative group">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 bg-gradient-to-r from-white to-gray-50 shadow-sm hover:shadow-md text-sm text-gray-700 ${isRtl ? 'text-right' : 'text-left'} flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={ariaLabel}
      >
        <span className="truncate">{selectedOption.label}</span>
        <ChevronDown className={`${isOpen ? 'rotate-180' : 'rotate-0'} transition-transform duration-200 w-5 h-5 text-gray-400 group-focus-within:text-amber-500`} />
      </button>
      {isOpen && !disabled && (
        <div className="absolute w-full mt-2 bg-white rounded-lg shadow-2xl border border-gray-100 z-20 max-h-60 overflow-y-auto scrollbar-none">
          {options.length > 0 ? (
            options.map((option) => (
              <div
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className="px-4 py-2.5 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-600 cursor-pointer transition-colors duration-200"
              >
                {option.label}
              </div>
            ))
          ) : (
            <div className="px-4 py-2.5 text-sm text-gray-500">{isRtl ? 'لا توجد خيارات متاحة' : 'No options available'}</div>
          )}
        </div>
      )}
    </div>
  );
});

const AnalyticsSkeletonCard = React.memo(() => (
  <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse">
    <div className="space-y-3">
      <div className="h-5 bg-gray-200 rounded w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      <div className="h-4 bg-gray-200 rounded w-1/3"></div>
    </div>
  </div>
));

export const BranchSalesAnalytics: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const debouncedSearch = useCallback(debounce((value: string) => setSearchTerm(value.trim()), 300), []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSearch(value);
  };

  useEffect(() => {
    if (!user?.role || user.role !== 'branch' || !user.branchId) {
      const errorMessage = user?.branchId ? t.errors.unauthorized_access : t.errors.no_branch_assigned;
      console.error(`[${new Date().toISOString()}] Authentication error:`, { user, errorMessage });
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
      navigate('/unauthorized');
      return;
    }
  }, [user, t, isRtl, navigate]);

  useEffect(() => {
    const today = new Date();
    let newStartDate = '';
    let newEndDate = today.toISOString().split('T')[0];
    if (filterPeriod === 'day') {
      newStartDate = newEndDate;
    } else if (filterPeriod === 'week') {
      const firstDayOfWeek = new Date(today);
      firstDayOfWeek.setDate(today.getDate() - today.getDay());
      newStartDate = firstDayOfWeek.toISOString().split('T')[0];
    } else if (filterPeriod === 'month') {
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      newStartDate = firstDayOfMonth.toISOString().split('T')[0];
    } else if (filterPeriod === 'custom') {
      newStartDate = startDate || newEndDate;
      newEndDate = endDate || newEndDate;
    } else {
      newStartDate = '';
      newEndDate = '';
    }
    setStartDate(newStartDate);
    setEndDate(newEndDate);
  }, [filterPeriod, startDate, endDate]);

  const fetchAnalytics = useCallback(async () => {
    if (!user?.branchId) {
      console.error(`[${new Date().toISOString()}] No branchId in user object`);
      setError(t.errors.no_branch_assigned);
      toast.error(t.errors.no_branch_assigned, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
      setLoading(false);
      return;
    }

    if (filterPeriod === 'custom' && startDate && endDate && new Date(startDate) > new Date(endDate)) {
      console.error(`[${new Date().toISOString()}] Invalid date range:`, { startDate, endDate });
      setError(t.errors.invalid_dates);
      toast.error(t.errors.invalid_dates, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params: any = { lang: language };
      if (filterPeriod !== 'all' && startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }
      console.log(`[${new Date().toISOString()}] Fetching analytics with params:`, params);
      const response = await salesAPI.getBranchAnalytics(params);
      if (!response || !response.success) {
        throw new Error(response?.message || t.errors.server_error);
      }
      console.log(`[${new Date().toISOString()}] Fetch analytics success:`, {
        totalSales: response.totalSales,
        totalCount: response.totalCount,
        productSalesCount: response.productSales?.length,
        departmentSalesCount: response.departmentSales?.length,
      });
      setAnalytics({
        totalSales: safeNumber(response.totalSales),
        totalCount: safeNumber(response.totalCount),
        averageOrderValue: safeString(response.averageOrderValue, '0.00'),
        returnRate: safeString(response.returnRate, '0.00'),
        topProduct: {
          productId: response.topProduct?.productId || null,
          productName: safeString(response.topProduct?.productName, t.noAnalytics),
          productNameEn: response.topProduct?.productNameEn || null,
          displayName: safeString(response.topProduct?.displayName, t.noAnalytics),
          totalQuantity: safeNumber(response.topProduct?.totalQuantity),
          totalRevenue: safeNumber(response.topProduct?.totalRevenue),
        },
        productSales: (response.productSales || []).map((ps: any) => ({
          productId: ps.productId,
          productName: safeString(ps.productName, t.noAnalytics),
          productNameEn: ps.productNameEn || null,
          displayName: safeString(ps.displayName, t.noAnalytics),
          totalQuantity: safeNumber(ps.totalQuantity),
          totalRevenue: safeNumber(ps.totalRevenue),
        })),
        leastProductSales: (response.leastProductSales || []).map((ps: any) => ({
          productId: ps.productId,
          productName: safeString(ps.productName, t.noAnalytics),
          productNameEn: ps.productNameEn || null,
          displayName: safeString(ps.displayName, t.noAnalytics),
          totalQuantity: safeNumber(ps.totalQuantity),
          totalRevenue: safeNumber(ps.totalRevenue),
        })),
        departmentSales: (response.departmentSales || []).map((ds: any) => ({
          departmentId: ds.departmentId,
          departmentName: safeString(ds.departmentName, t.noAnalytics),
          departmentNameEn: ds.departmentNameEn || null,
          displayName: safeString(ds.displayName, t.noAnalytics),
          totalRevenue: safeNumber(ds.totalRevenue),
          totalQuantity: safeNumber(ds.totalQuantity),
        })),
        leastDepartmentSales: (response.leastDepartmentSales || []).map((ds: any) => ({
          departmentId: ds.departmentId,
          departmentName: safeString(ds.departmentName, t.noAnalytics),
          departmentNameEn: ds.departmentNameEn || null,
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
      console.error(`[${new Date().toISOString()}] Fetch analytics error:`, { message: err.message, status: err.status, stack: err.stack });
      const errorMessage =
        err.status === 403 ? t.errors.unauthorized_access :
        err.status === 404 ? t.errors.branch_not_found :
        err.status === 500 ? t.errors.server_error :
        t.errors.fetch_analytics;
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [user, language, isRtl, t, filterPeriod, startDate, endDate]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const filteredProductSales = useMemo(
    () => analytics?.productSales.filter((ps) => ps.displayName.toLowerCase().includes(searchTerm.toLowerCase())) || [],
    [analytics, searchTerm]
  );

  const filteredLeastProductSales = useMemo(
    () => analytics?.leastProductSales.filter((ps) => ps.displayName.toLowerCase().includes(searchTerm.toLowerCase())) || [],
    [analytics, searchTerm]
  );

  const filteredDepartmentSales = useMemo(
    () => analytics?.departmentSales.filter((ds) => ds.displayName.toLowerCase().includes(searchTerm.toLowerCase())) || [],
    [analytics, searchTerm]
  );

  const filteredLeastDepartmentSales = useMemo(
    () => analytics?.leastDepartmentSales.filter((ds) => ds.displayName.toLowerCase().includes(searchTerm.toLowerCase())) || [],
    [analytics, searchTerm]
  );

  const periodOptions = useMemo(
    () => [
      { value: 'all', label: t.all },
      { value: 'day', label: t.day },
      { value: 'week', label: t.week },
      { value: 'month', label: t.month },
      { value: 'custom', label: t.custom },
    ],
    [t]
  );

  // Chart for Sales Trends
  const salesTrendsChart = analytics?.salesTrends?.length > 0 ? {
    type: 'line',
    data: {
      labels: analytics.salesTrends.map((trend) => trend.period),
      datasets: [
        {
          label: t.totalSales,
          data: analytics.salesTrends.map((trend) => trend.totalSales),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.2)',
          fill: true,
          tension: 0.4,
        },
        {
          label: t.totalOrders,
          data: analytics.salesTrends.map((trend) => trend.saleCount),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          fill: true,
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top', labels: { font: { family: 'Alexandria', size: 12 } } },
        title: { display: true, text: t.salesTrends, font: { family: 'Alexandria', size: 16 } },
      },
      scales: {
        x: { title: { display: true, text: t.filterBy, font: { family: 'Alexandria' } } },
        y: { beginAtZero: true, title: { display: true, text: t.currency, font: { family: 'Alexandria' } } },
      },
    },
  } : null;

  return (
    <div className="min-h-screen px-4 py-8 bg-gradient-to-br from-gray-50 to-gray-100 font-alexandria" dir={isRtl ? 'rtl' : 'ltr'}>
      <link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600&display=swap" rel="stylesheet" />
      <header className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-alexandria">{t.title}</h1>
            <p className="text-gray-600 text-sm font-alexandria">{t.subtitle}</p>
          </div>
        </div>
      </header>
      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm font-medium font-alexandria">{error}</span>
        </div>
      )}
      <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.filters}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SearchInput
            value={searchInput}
            onChange={handleSearchChange}
            placeholder={t.searchPlaceholder}
            ariaLabel={t.searchPlaceholder}
          />
          <ProductDropdown
            value={filterPeriod}
            onChange={setFilterPeriod}
            options={periodOptions}
            ariaLabel={t.filterBy}
          />
          {filterPeriod === 'custom' && (
            <>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm font-alexandria`}
                aria-label={t.filterBy}
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm font-alexandria`}
                aria-label={t.filterBy}
              />
            </>
          )}
        </div>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(4)].map((_, index) => (
            <AnalyticsSkeletonCard key={index} />
          ))}
        </div>
      ) : !analytics || analytics.totalCount === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm font-medium font-alexandria">{t.noAnalytics}</p>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.totalSales}</h3>
              <p className="text-2xl font-bold text-amber-600 font-alexandria">{safeNumber(analytics.totalSales).toFixed(2)} {t.currency}</p>
            </div>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.totalOrders}</h3>
              <p className="text-2xl font-bold text-amber-600 font-alexandria">{safeNumber(analytics.totalCount)}</p>
            </div>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.averageOrderValue}</h3>
              <p className="text-2xl font-bold text-amber-600 font-alexandria">{analytics.averageOrderValue} {t.currency}</p>
            </div>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.returnRate}</h3>
              <p className="text-2xl font-bold text-amber-600 font-alexandria">{analytics.returnRate}%</p>
            </div>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.topProduct}</h3>
              <p className="text-sm text-gray-600 font-alexandria">{analytics.topProduct.displayName}</p>
              <p className="text-sm text-gray-600 font-alexandria">{t.totalSales}: {safeNumber(analytics.topProduct.totalRevenue).toFixed(2)} {t.currency}</p>
              <p className="text-sm text-gray-600 font-alexandria">{t.quantity}: {safeNumber(analytics.topProduct.totalQuantity)}</p>
            </div>
          </div>
          {salesTrendsChart && (
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.salesTrends}</h3>
              ```chartjs
              {salesTrendsChart}
              ```
            </div>
          )}
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.productSales}</h3>
            <ul className="space-y-2">
              {filteredProductSales.length > 0 ? (
                filteredProductSales.map((ps) => (
                  <li key={ps.productId} className="border-t border-gray-100 pt-2 font-alexandria">
                    {ps.displayName} - {t.totalSales}: {safeNumber(ps.totalRevenue).toFixed(2)} {t.currency}, {t.quantity}: {safeNumber(ps.totalQuantity)}
                  </li>
                ))
              ) : (
                <li className="text-gray-500 font-alexandria">{t.noAnalytics}</li>
              )}
            </ul>
          </div>
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.leastProductSales}</h3>
            <ul className="space-y-2">
              {filteredLeastProductSales.length > 0 ? (
                filteredLeastProductSales.map((ps) => (
                  <li key={ps.productId} className="border-t border-gray-100 pt-2 font-alexandria">
                    {ps.displayName} - {t.totalSales}: {safeNumber(ps.totalRevenue).toFixed(2)} {t.currency}, {t.quantity}: {safeNumber(ps.totalQuantity)}
                  </li>
                ))
              ) : (
                <li className="text-gray-500 font-alexandria">{t.noAnalytics}</li>
              )}
            </ul>
          </div>
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.departmentSales}</h3>
            <ul className="space-y-2">
              {filteredDepartmentSales.length > 0 ? (
                filteredDepartmentSales.map((ds) => (
                  <li key={ds.departmentId} className="border-t border-gray-100 pt-2 font-alexandria">
                    {ds.displayName} - {t.totalSales}: {safeNumber(ds.totalRevenue).toFixed(2)} {t.currency}, {t.quantity}: {safeNumber(ds.totalQuantity)}
                  </li>
                ))
              ) : (
                <li className="text-gray-500 font-alexandria">{t.noAnalytics}</li>
              )}
            </ul>
          </div>
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.leastDepartmentSales}</h3>
            <ul className="space-y-2">
              {filteredLeastDepartmentSales.length > 0 ? (
                filteredLeastDepartmentSales.map((ds) => (
                  <li key={ds.departmentId} className="border-t border-gray-100 pt-2 font-alexandria">
                    {ds.displayName} - {t.totalSales}: {safeNumber(ds.totalRevenue).toFixed(2)} {t.currency}, {t.quantity}: {safeNumber(ds.totalQuantity)}
                  </li>
                ))
              ) : (
                <li className="text-gray-500 font-alexandria">{t.noAnalytics}</li>
              )}
            </ul>
          </div>
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.topCustomers}</h3>
            <ul className="space-y-2">
              {analytics.topCustomers.length > 0 ? (
                analytics.topCustomers.map((tc) => (
                  <li key={`${tc.customerName}-${tc.customerPhone}`} className="border-t border-gray-100 pt-2 font-alexandria">
                    {tc.customerName} ({tc.customerPhone || 'N/A'}) - {t.totalSales}: {safeNumber(tc.totalSpent).toFixed(2)} {t.currency}, {t.totalOrders}: {safeNumber(tc.purchaseCount)}
                  </li>
                ))
              ) : (
                <li className="text-gray-500 font-alexandria">{t.noAnalytics}</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(BranchSalesAnalytics);