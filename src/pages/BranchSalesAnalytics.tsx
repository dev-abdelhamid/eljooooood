import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { salesAPI, branchesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, Search, X, ChevronDown } from 'lucide-react';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';

// واجهات البيانات
export interface Branch {
  _id: string;
  name: string;
  nameEn?: string;
  displayName: string;
}

export interface SalesTrend {
  period: string;
  totalSales: number;
  saleCount: number;
}

export interface AnalyticsData {
  totalSales: number;
  totalCount: number;
  averageOrderValue: string;
  returnRate: string;
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
    productNameEn?: string;
    displayName: string;
    totalQuantity: number;
    totalRevenue: number;
  }>;
  leastProductSales: Array<{
    productId: string;
    productName: string;
    productNameEn?: string;
    displayName: string;
    totalQuantity: number;
    totalRevenue: number;
  }>;
  departmentSales: Array<{
    departmentId: string;
    departmentName: string;
    departmentNameEn?: string;
    displayName: string;
    totalRevenue: number;
    totalQuantity: number;
  }>;
  leastDepartmentSales: Array<{
    departmentId: string;
    departmentName: string;
    departmentNameEn?: string;
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

// ترجمات الواجهة
export const translations = {
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
    salesTrends: 'اتجاهات المبيعات',
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
    quantity: 'الكمية',
    errors: {
      unauthorized_access: 'غير مصرح لك بالوصول',
      fetch_analytics: 'خطأ أثناء جلب الإحصائيات',
      fetch_branches: 'خطأ أثناء جلب الفروع',
      no_analytics: 'لا توجد إحصائيات متاحة لهذا الفرع في الفترة المحددة',
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
    salesTrends: 'Sales Trends',
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
    quantity: 'Quantity',
    errors: {
      unauthorized_access: 'You are not authorized to access',
      fetch_analytics: 'Error fetching analytics',
      fetch_branches: 'Error fetching branches',
      no_analytics: 'No analytics available for this branch in the selected period',
    },
    currency: 'SAR',
  },
};

// دالة للتحقق من القيم العددية
export const safeNumber = (value: any, defaultValue: number = 0): number => {
  return typeof value === 'number' && !isNaN(value) ? value : defaultValue;
};

// مكون البحث
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
        aria-label={ariaLabel}
        className={`w-full ${isRtl ? 'pr-10 pl-3' : 'pl-10 pr-3'} py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400`}
      />
      {value && (
        <button
          onClick={() => onChange({ target: { value: '' } } as any)}
          className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400 hover:text-amber-500`}
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
});

// مكون اختيار التاريخ
const DateRangePicker = React.memo<{
  startDate: string | null;
  endDate: string | null;
  onChange: (start: string | null, end: string | null) => void;
}>(({ startDate, endDate, onChange }) => {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="flex space-x-2 space-x-reverse">
      <input
        type="date"
        value={startDate || ''}
        onChange={(e) => onChange(e.target.value, endDate)}
        className={`w-full py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={t('filterBy') + ': ' + t('custom') + ' - ' + t('startDate')}
      />
      <input
        type="date"
        value={endDate || ''}
        onChange={(e) => onChange(startDate, e.target.value)}
        className={`w-full py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={t('filterBy') + ': ' + t('custom') + ' - ' + t('endDate')}
      />
    </div>
  );
});

// مكون إحصائيات الفروع
const BranchSalesAnalytics: React.FC = () => {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'day' | 'week' | 'month' | 'custom'>('month');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // جلب الفروع
  const fetchBranches = useCallback(async () => {
    try {
      const response = await branchesAPI.getAll();
      if (response.success) {
        const transformedBranches = response.branches.map((branch: any) => ({
          ...branch,
          displayName: language === 'ar' ? branch.name : (branch.nameEn || branch.name),
        }));
        setBranches(transformedBranches);
      } else {
        toast.error(t('errors.fetch_branches'));
      }
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Error fetching branches:`, err);
      toast.error(t('errors.fetch_branches'));
    }
  }, [language, t]);

  // جلب الإحصائيات
  const fetchAnalytics = useCallback(
    debounce(async (branchId: string | null, start: string | null, end: string | null) => {
      setIsLoading(true);
      setError(null);
      try {
        console.log(`[${new Date().toISOString()}] Fetching analytics for branch:`, {
          branchId,
          startDate: start,
          endDate: end,
          userBranchId: user?.branchId,
        });
        const response = await salesAPI.getBranchAnalytics({
          branch: branchId || user?.branchId,
          startDate: start,
          endDate: end,
          lang: language,
        });
        if (response.success) {
          setAnalyticsData(response);
        } else {
          setError(response.message || t('errors.no_analytics'));
          setAnalyticsData(null);
          toast.error(response.message || t('errors.no_analytics'));
        }
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Error fetching analytics:`, err);
        setError(t('errors.fetch_analytics'));
        setAnalyticsData(null);
        toast.error(t('errors.fetch_analytics'));
      } finally {
        setIsLoading(false);
      }
    }, 500),
    [language, t, user?.branchId]
  );

  // تحديث التواريخ بناءً على الفلتر
  const updateDateRange = useCallback((filterType: 'all' | 'day' | 'week' | 'month' | 'custom') => {
    const today = new Date();
    let start: string | null = null;
    let end: string | null = formatDate(today);
    switch (filterType) {
      case 'day':
        start = formatDate(today);
        break;
      case 'week':
        start = formatDate(new Date(today.setDate(today.getDate() - 7)));
        break;
      case 'month':
        start = formatDate(new Date(today.setFullYear(today.getFullYear(), today.getMonth() - 1, today.getDate())));
        break;
      case 'custom':
        start = startDate;
        end = endDate;
        break;
      case 'all':
        start = null;
        end = null;
        break;
    }
    setFilter(filterType);
    setStartDate(start);
    setEndDate(end);
    fetchAnalytics(user?.branchId || selectedBranch, start, end);
  }, [fetchAnalytics, startDate, endDate, user?.branchId, selectedBranch]);

  // جلب البيانات عند تحميل المكون
  useEffect(() => {
    if (user?.role === 'admin') {
      fetchBranches();
    } else if (user?.role === 'branch' && user?.branchId) {
      setSelectedBranch(user.branchId);
      updateDateRange('month');
    }
  }, [user, fetchBranches, updateDateRange]);

  // معالجة البحث
  const filteredProductSales = useMemo(() => {
    if (!analyticsData?.productSales) return [];
    if (!searchQuery) return analyticsData.productSales;
    return analyticsData.productSales.filter((product) =>
      product.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [analyticsData, searchQuery]);

  // عرض رسالة تحميل أو خطأ
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-amber-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <p className="mt-4 text-lg text-gray-900 dark:text-gray-100">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 ${isRtl ? 'text-right' : 'text-left'}`}>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">{t('subtitle')}</p>

      {/* فلاتر */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {user?.role === 'admin' && (
          <div className="relative">
            <select
              value={selectedBranch || ''}
              onChange={(e) => {
                setSelectedBranch(e.target.value || null);
                fetchAnalytics(e.target.value || null, startDate, endDate);
              }}
              className="w-full py-2 px-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 appearance-none"
            >
              <option value="">{t('allBranches')}</option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.displayName}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        )}
        <div className="relative">
          <select
            value={filter}
            onChange={(e) => updateDateRange(e.target.value as any)}
            className="w-full py-2 px-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 appearance-none"
          >
            <option value="all">{t('all')}</option>
            <option value="day">{t('day')}</option>
            <option value="week">{t('week')}</option>
            <option value="month">{t('month')}</option>
            <option value="custom">{t('custom')}</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
        {filter === 'custom' && (
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
              fetchAnalytics(user?.branchId || selectedBranch, start, end);
            }}
          />
        )}
        <SearchInput
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          ariaLabel={t('searchPlaceholder')}
        />
      </div>

      {/* عرض الإحصائيات */}
      {analyticsData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('totalSales')}</h3>
            <p className="text-2xl font-bold text-amber-500">{safeNumber(analyticsData.totalSales).toLocaleString()} {t('currency')}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('totalOrders')}</h3>
            <p className="text-2xl font-bold text-amber-500">{safeNumber(analyticsData.totalCount).toLocaleString()}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('averageOrderValue')}</h3>
            <p className="text-2xl font-bold text-amber-500">{safeNumber(parseFloat(analyticsData.averageOrderValue)).toLocaleString()} {t('currency')}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('returnRate')}</h3>
            <p className="text-2xl font-bold text-amber-500">{safeNumber(parseFloat(analyticsData.returnRate)).toFixed(2)}%</p>
          </div>
        </div>
      )}

      {/* أفضل منتج */}
      {analyticsData?.topProduct && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('topProduct')}</h3>
          <p className="text-gray-600 dark:text-gray-400">
            {analyticsData.topProduct.displayName} ({analyticsData.topProduct.totalQuantity} {t('quantity')}, {analyticsData.topProduct.totalRevenue.toLocaleString()} {t('currency')})
          </p>
        </div>
      )}

      {/* مبيعات المنتجات */}
      {filteredProductSales.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('productSales')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-gray-900 dark:text-gray-100">
              <thead>
                <tr className="border-b dark:border-gray-600">
                  <th className={`py-2 px-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t('productSales')}</th>
                  <th className={`py-2 px-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t('quantity')}</th>
                  <th className={`py-2 px-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t('totalSales')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredProductSales.map((product) => (
                  <tr key={product.productId} className="border-b dark:border-gray-600">
                    <td className="py-2 px-4">{product.displayName}</td>
                    <td className="py-2 px-4">{product.totalQuantity.toLocaleString()}</td>
                    <td className="py-2 px-4">{product.totalRevenue.toLocaleString()} {t('currency')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* مبيعات الأقسام */}
      {analyticsData?.departmentSales.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('departmentSales')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-gray-900 dark:text-gray-100">
              <thead>
                <tr className="border-b dark:border-gray-600">
                  <th className={`py-2 px-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t('departmentSales')}</th>
                  <th className={`py-2 px-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t('quantity')}</th>
                  <th className={`py-2 px-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t('totalSales')}</th>
                </tr>
              </thead>
              <tbody>
                {analyticsData.departmentSales.map((department) => (
                  <tr key={department.departmentId} className="border-b dark:border-gray-600">
                    <td className="py-2 px-4">{department.displayName}</td>
                    <td className="py-2 px-4">{department.totalQuantity.toLocaleString()}</td>
                    <td className="py-2 px-4">{department.totalRevenue.toLocaleString()} {t('currency')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchSalesAnalytics;