// Modified frontend code (SalesAnalytics.jsx)
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { salesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, BarChart2, Search } from 'lucide-react';
import { toast } from 'react-toastify';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { debounce } from 'lodash';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

interface SalesAnalytics {
  branchSales: Array<{
    branchId: string;
    branchName: string;
    branchNameEn?: string;
    displayName: string;
    totalSales: number;
    saleCount: number;
    averageOrderValue: number;
  }>;
  leastBranchSales: Array<{
    branchId: string;
    branchName: string;
    branchNameEn?: string;
    displayName: string;
    totalSales: number;
    saleCount: number;
    averageOrderValue: number;
  }>;
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
  totalSales: number;
  totalCount: number;
  averageOrderValue: number;
  topProduct: {
    productId: string | null;
    productName: string;
    productNameEn?: string;
    displayName: string;
    totalQuantity: number;
    totalRevenue: number;
  };
  salesTrends: Array<{ period: string; totalSales: number; saleCount: number }>;
  topCustomers: Array<{ customerName: string; customerPhone: string; totalSpent: number; purchaseCount: number }>;
}

const translations = {
  ar: {
    title: 'إحصائيات المبيعات',
    subtitle: 'تحليلات وإحصائيات المبيعات',
    totalSales: 'إجمالي المبيعات',
    totalCount: 'عدد المبيعات',
    averageOrderValue: 'متوسط قيمة الطلب',
    topProduct: 'المنتج الأكثر مبيعًا',
    productSales: 'مبيعات المنتجات',
    leastProductSales: 'أقل المنتجات مبيعًا',
    departmentSales: 'مبيعات الأقسام',
    leastDepartmentSales: 'أقل الأقسام مبيعًا',
    branchSales: 'مبيعات الفروع',
    leastBranchSales: 'أقل الفروع مبيعًا',
    salesTrends: 'اتجاهات المبيعات',
    topCustomers: 'أفضل العملاء',
    searchPlaceholder: 'ابحث عن منتجات أو أقسام...',
    noAnalytics: 'لا توجد إحصائيات متاحة',
    noData: 'لا توجد بيانات',
    noCustomers: 'لا توجد عملاء',
    startDate: 'تاريخ البدء',
    endDate: 'تاريخ الانتهاء',
    errors: {
      unauthorized_access: 'غير مصرح لك بالوصول',
      fetch_analytics: 'خطأ أثناء جلب الإحصائيات',
      network_error: 'خطأ في الاتصال بالشبكة',
      invalid_data: 'بيانات غير صالحة من الخادم',
      invalid_dates: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية',
    },
    currency: 'ريال',
  },
  en: {
    title: 'Sales Analytics',
    subtitle: 'Sales analytics and statistics',
    totalSales: 'Total Sales',
    totalCount: 'Total Sale Count',
    averageOrderValue: 'Average Order Value',
    topProduct: 'Top Selling Product',
    productSales: 'Product Sales',
    leastProductSales: 'Least Sold Products',
    departmentSales: 'Department Sales',
    leastDepartmentSales: 'Least Sold Departments',
    branchSales: 'Branch Sales',
    leastBranchSales: 'Least Sold Branches',
    salesTrends: 'Sales Trends',
    topCustomers: 'Top Customers',
    searchPlaceholder: 'Search products or departments...',
    noAnalytics: 'No analytics available',
    noData: 'No data available',
    noCustomers: 'No customers',
    startDate: 'Start Date',
    endDate: 'End Date',
    errors: {
      unauthorized_access: 'You are not authorized to access',
      fetch_analytics: 'Error fetching analytics',
      network_error: 'Network connection error',
      invalid_data: 'Invalid data from server',
      invalid_dates: 'Start date must be before end date',
    },
    currency: 'SAR',
  },
};

const safeNumber = (value: any, defaultValue: number = 0): number =>
  typeof value === 'number' && !isNaN(value) ? value : defaultValue;

const safeString = (value: any, defaultValue: string = ''): string =>
  typeof value === 'string' ? value : defaultValue;

const isValidDate = (date: string): boolean => !isNaN(new Date(date).getTime());

const AnalyticsSkeleton: React.FC = React.memo(() => (
  <div className="space-y-4 animate-pulse">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(3)].map((_, index) => (
        <div key={index} className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
          <div className="h-6 bg-gray-200 rounded w-1/2" />
        </div>
      ))}
    </div>
    <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
      <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
      <div className="h-40 bg-gray-200 rounded" />
    </div>
  </div>
));

const NoDataMessage: React.FC<{ message: string }> = ({ message }) => (
  <p className="text-center text-gray-500 py-4 text-sm font-alexandria">{message}</p>
);

const SearchInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
}> = React.memo(({ value, onChange }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="relative">
      <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400`} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={translations[language].searchPlaceholder}
        className={`w-full py-2 ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm transition-all`}
      />
    </div>
  );
});

const BranchTable: React.FC<{ data: SalesAnalytics['branchSales']; title: string; language: string; currency: string }> = React.memo(({ data, title, language, currency }) => {
  const isRtl = language === 'ar';
  return (
    <div className="overflow-x-auto mt-4">
      <h4 className="text-sm font-medium text-gray-700 mb-2">{title}</h4>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{translations[language].branchSales}</th>
            <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{translations[language].totalSales} ({currency})</th>
            <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{translations[language].totalCount}</th>
            <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{translations[language].averageOrderValue} ({currency})</th>
          </tr>
        </thead>
        <tbody>
          {data.map((branch, index) => (
            <tr key={index} className="border-t">
              <td className="p-2">{branch.displayName}</td>
              <td className="p-2">{safeNumber(branch.totalSales).toFixed(2)}</td>
              <td className="p-2">{safeNumber(branch.saleCount)}</td>
              <td className="p-2">{safeNumber(branch.averageOrderValue).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

const SalesAnalytics: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [analytics, setAnalytics] = useState<SalesAnalytics>({
    branchSales: [],
    leastBranchSales: [],
    productSales: [],
    leastProductSales: [],
    departmentSales: [],
    leastDepartmentSales: [],
    totalSales: 0,
    totalCount: 0,
    averageOrderValue: 0,
    topProduct: { productId: null, productName: '', displayName: '', totalQuantity: 0, totalRevenue: 0 },
    salesTrends: [],
    topCustomers: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useCallback(debounce((value: string) => setSearchTerm(value.trim().toLowerCase()), 300), []);

  const fetchAnalytics = useCallback(async () => {
    if (user?.role !== 'admin') {
      setError(t.errors.unauthorized_access);
      toast.error(t.errors.unauthorized_access, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
      setLoading(false);
      return;
    }

    if (!isValidDate(startDate) || !isValidDate(endDate) || new Date(startDate) > new Date(endDate)) {
      setError(t.errors.invalid_dates);
      toast.error(t.errors.invalid_dates, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params: any = {
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        lang: language,
      };
      console.log(`[${new Date().toISOString()}] Fetching analytics with params:`, params);
      const response = await salesAPI.getAnalytics(params);
      console.log(`[${new Date().toISOString()}] Response:`, response);
      if (!response || typeof response !== 'object') {
        throw new Error(t.errors.invalid_data);
      }
      setAnalytics({
        branchSales: (response.branchSales || []).map((bs: any) => ({
          branchId: safeString(bs.branchId),
          branchName: safeString(bs.branchName),
          branchNameEn: safeString(bs.branchNameEn),
          displayName: isRtl ? safeString(bs.branchName, 'فرع غير معروف') : safeString(bs.branchNameEn || bs.branchName, 'Unknown Branch'),
          totalSales: safeNumber(bs.totalSales),
          saleCount: safeNumber(bs.saleCount),
          averageOrderValue: safeNumber(bs.averageOrderValue),
        })),
        leastBranchSales: (response.leastBranchSales || []).map((bs: any) => ({
          branchId: safeString(bs.branchId),
          branchName: safeString(bs.branchName),
          branchNameEn: safeString(bs.branchNameEn),
          displayName: isRtl ? safeString(bs.branchName, 'فرع غير معروف') : safeString(bs.branchNameEn || bs.branchName, 'Unknown Branch'),
          totalSales: safeNumber(bs.totalSales),
          saleCount: safeNumber(bs.saleCount),
          averageOrderValue: safeNumber(bs.averageOrderValue),
        })),
        productSales: (response.productSales || []).map((ps: any) => ({
          productId: safeString(ps.productId),
          productName: safeString(ps.productName),
          productNameEn: safeString(ps.productNameEn),
          displayName: isRtl ? safeString(ps.productName, 'منتج محذوف') : safeString(ps.productNameEn || ps.productName, 'Deleted Product'),
          totalQuantity: safeNumber(ps.totalQuantity),
          totalRevenue: safeNumber(ps.totalRevenue),
        })),
        leastProductSales: (response.leastProductSales || []).map((ps: any) => ({
          productId: safeString(ps.productId),
          productName: safeString(ps.productName),
          productNameEn: safeString(ps.productNameEn),
          displayName: isRtl ? safeString(ps.productName, 'منتج محذوف') : safeString(ps.productNameEn || ps.productName, 'Deleted Product'),
          totalQuantity: safeNumber(ps.totalQuantity),
          totalRevenue: safeNumber(ps.totalRevenue),
        })),
        departmentSales: (response.departmentSales || []).map((ds: any) => ({
          departmentId: safeString(ds.departmentId),
          departmentName: safeString(ds.departmentName),
          departmentNameEn: safeString(ds.departmentNameEn),
          displayName: isRtl ? safeString(ds.departmentName, 'قسم غير معروف') : safeString(ds.departmentNameEn || ds.departmentName, 'Unknown Department'),
          totalRevenue: safeNumber(ds.totalRevenue),
          totalQuantity: safeNumber(ds.totalQuantity),
        })),
        leastDepartmentSales: (response.leastDepartmentSales || []).map((ds: any) => ({
          departmentId: safeString(ds.departmentId),
          departmentName: safeString(ds.departmentName),
          departmentNameEn: safeString(ds.departmentNameEn),
          displayName: isRtl ? safeString(ds.departmentName, 'قسم غير معروف') : safeString(ds.departmentNameEn || ds.departmentName, 'Unknown Department'),
          totalRevenue: safeNumber(ds.totalRevenue),
          totalQuantity: safeNumber(ds.totalQuantity),
        })),
        totalSales: safeNumber(response.totalSales),
        totalCount: safeNumber(response.totalCount),
        averageOrderValue: safeNumber(response.averageOrderValue),
        topProduct: response.topProduct
          ? {
              productId: safeString(response.topProduct.productId),
              productName: safeString(response.topProduct.productName),
              productNameEn: safeString(response.topProduct.productNameEn),
              displayName: isRtl ? safeString(response.topProduct.productName, 'منتج محذوف') : safeString(response.topProduct.productNameEn || response.topProduct.productName, 'Deleted Product'),
              totalQuantity: safeNumber(response.topProduct.totalQuantity),
              totalRevenue: safeNumber(response.topProduct.totalRevenue),
            }
          : { productId: null, productName: '', displayName: '', totalQuantity: 0, totalRevenue: 0 },
        salesTrends: (response.salesTrends || []).map((trend: any) => ({
          period: formatDate(new Date(trend.period), language),
          totalSales: safeNumber(trend.totalSales),
          saleCount: safeNumber(trend.saleCount),
        })),
        topCustomers: (response.topCustomers || []).map((customer: any) => ({
          customerName: safeString(customer.customerName, t.noCustomers),
          customerPhone: safeString(customer.customerPhone, ''),
          totalSpent: safeNumber(customer.totalSpent),
          purchaseCount: safeNumber(customer.purchaseCount),
        })),
      });
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Analytics fetch error:`, { message: err.message, status: err.status, stack: err.stack });
      const errorMessage =
        err.status === 403 ? t.errors.unauthorized_access :
        err.status === 400 ? t.errors.invalid_dates :
        err.status === 0 ? t.errors.network_error :
        t.errors.fetch_analytics;
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
      setAnalytics({
        branchSales: [],
        leastBranchSales: [],
        productSales: [],
        leastProductSales: [],
        departmentSales: [],
        leastDepartmentSales: [],
        totalSales: 0,
        totalCount: 0,
        averageOrderValue: 0,
        topProduct: { productId: null, productName: '', displayName: '', totalQuantity: 0, totalRevenue: 0 },
        salesTrends: [],
        topCustomers: [],
      });
    } finally {
      setLoading(false);
    }
  }, [user, t, isRtl, language, startDate, endDate]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const filteredData = useMemo(() => ({
    productSales: analytics.productSales.filter((ps) => ps.displayName.toLowerCase().includes(searchTerm)),
    leastProductSales: analytics.leastProductSales.filter((ps) => ps.displayName.toLowerCase().includes(searchTerm)),
    departmentSales: analytics.departmentSales.filter((ds) => ds.displayName.toLowerCase().includes(searchTerm)),
    leastDepartmentSales: analytics.leastDepartmentSales.filter((ds) => ds.displayName.toLowerCase().includes(searchTerm)),
    branchSales: analytics.branchSales.filter((bs) => bs.displayName.toLowerCase().includes(searchTerm)),
    leastBranchSales: analytics.leastBranchSales.filter((bs) => bs.displayName.toLowerCase().includes(searchTerm)),
  }), [analytics, searchTerm]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const, labels: { font: { size: 10, family: 'Alexandria' } } },
      tooltip: { bodyFont: { size: 10, family: 'Alexandria' }, padding: 8 },
      title: { display: true, font: { size: 12, family: 'Alexandria' }, padding: 10 },
    },
    scales: {
      x: { ticks: { font: { size: 9, family: 'Alexandria' }, maxRotation: isRtl ? -45 : 45, autoSkip: true } },
      y: { ticks: { font: { size: 9, family: 'Alexandria' } }, beginAtZero: true },
    },
  }), [isRtl]);

  const chartData = useMemo(() => ({
    productSales: {
      labels: filteredData.productSales.slice(0, 5).map((p) => p.displayName),
      datasets: [{ label: `${t.totalSales} (${t.currency})`, data: filteredData.productSales.slice(0, 5).map((p) => p.totalRevenue), backgroundColor: '#FBBF24' }],
    },
    leastProductSales: {
      labels: filteredData.leastProductSales.slice(0, 5).map((p) => p.displayName),
      datasets: [{ label: `${t.totalSales} (${t.currency})`, data: filteredData.leastProductSales.slice(0, 5).map((p) => p.totalRevenue), backgroundColor: '#3B82F6' }],
    },
    departmentSales: {
      labels: filteredData.departmentSales.slice(0, 5).map((d) => d.displayName),
      datasets: [{ label: `${t.totalSales} (${t.currency})`, data: filteredData.departmentSales.slice(0, 5).map((d) => d.totalRevenue), backgroundColor: '#FF6384' }],
    },
    leastDepartmentSales: {
      labels: filteredData.leastDepartmentSales.slice(0, 5).map((d) => d.displayName),
      datasets: [{ label: `${t.totalSales} (${t.currency})`, data: filteredData.leastDepartmentSales.slice(0, 5).map((d) => d.totalRevenue), backgroundColor: '#4BC0C0' }],
    },
    branchSales: {
      labels: filteredData.branchSales.slice(0, 5).map((b) => b.displayName),
      datasets: [{ label: `${t.totalSales} (${t.currency})`, data: filteredData.branchSales.slice(0, 5).map((b) => b.totalSales), backgroundColor: '#9966FF' }],
    },
    leastBranchSales: {
      labels: filteredData.leastBranchSales.slice(0, 5).map((b) => b.displayName),
      datasets: [{ label: `${t.totalSales} (${t.currency})`, data: filteredData.leastBranchSales.slice(0, 5).map((b) => b.totalSales), backgroundColor: '#FBBF24' }],
    },
    salesTrends: {
      labels: analytics.salesTrends.slice(0, 10).map((trend) => trend.period),
      datasets: [
        { label: t.totalCount, data: analytics.salesTrends.slice(0, 10).map((trend) => trend.saleCount), borderColor: '#3B82F6', fill: false, tension: 0.4 },
      ],
    },
  }), [filteredData, t, analytics]);

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm font-alexandria">{t.errors.unauthorized_access}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 bg-gray-50 font-alexandria" dir={isRtl ? 'rtl' : 'ltr'}>
      <link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600&display=swap" rel="stylesheet" />
      <header className="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <BarChart2 className="w-5 h-5 text-amber-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-800">{t.title}</h1>
            <p className="text-sm text-gray-500">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchInput value={searchTerm} onChange={debouncedSearch} />
          <div className="flex gap-3">
            <div>
              <label className="block text-sm text-gray-700">{t.startDate}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700">{t.endDate}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm"
              />
            </div>
          </div>
        </div>
      </header>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-sm text-red-600">{error}</span>
        </div>
      )}
      {loading ? (
        <AnalyticsSkeleton />
      ) : !analytics ? (
        <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100 text-center">
          <BarChart2 className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <NoDataMessage message={t.noAnalytics} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-medium text-gray-700">{t.totalSales}</h3>
              <p className="text-lg font-bold text-amber-600">{analytics.totalSales.toFixed(2)} {t.currency}</p>
              <p className="text-xs text-gray-500">{t.totalCount}: {analytics.totalCount}</p>
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-medium text-gray-700">{t.averageOrderValue}</h3>
              <p className="text-lg font-bold text-amber-600">{analytics.averageOrderValue.toFixed(2)} {t.currency}</p>
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-medium text-gray-700">{t.topProduct}</h3>
              {analytics.topProduct?.productId ? (
                <div className="mt-2 space-y-1">
                  <p className="text-sm">{analytics.topProduct.displayName}</p>
                  <p className="text-xs text-gray-500">{t.totalSales}: {analytics.topProduct.totalRevenue.toFixed(2)} {t.currency}</p>
                  <p className="text-xs text-gray-500">{t.totalCount}: {analytics.topProduct.totalQuantity}</p>
                </div>
              ) : (
                <NoDataMessage message={t.noData} />
              )}
            </div>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
            <h3 className="text-sm font-medium text-gray-700 mb-3">{t.topCustomers}</h3>
            {analytics.topCustomers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{t.topCustomers}</th>
                      <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{t.totalSales}</th>
                      <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{t.totalCount}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.topCustomers.map((customer, index) => (
                      <tr key={index} className="border-t">
                        <td className="p-2">{customer.customerName || t.noCustomers}</td>
                        <td className="p-2">{customer.totalSpent.toFixed(2)} {t.currency}</td>
                        <td className="p-2">{customer.purchaseCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <NoDataMessage message={t.noCustomers} />
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-medium text-gray-700 mb-3">{t.salesTrends}</h3>
              {analytics.salesTrends.length > 0 ? (
                <div className="h-48">
                  <Line data={chartData.salesTrends} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.salesTrends } } }} />
                </div>
              ) : (
                <NoDataMessage message={t.noData} />
              )}
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-medium text-gray-700 mb-3">{t.productSales}</h3>
              {filteredData.productSales.length > 0 ? (
                <div className="h-48">
                  <Bar data={chartData.productSales} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.productSales } } }} />
                </div>
              ) : (
                <NoDataMessage message={t.noData} />
              )}
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-medium text-gray-700 mb-3">{t.leastProductSales}</h3>
              {filteredData.leastProductSales.length > 0 ? (
                <div className="h-48">
                  <Bar data={chartData.leastProductSales} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.leastProductSales } } }} />
                </div>
              ) : (
                <NoDataMessage message={t.noData} />
              )}
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-medium text-gray-700 mb-3">{t.departmentSales}</h3>
              {filteredData.departmentSales.length > 0 ? (
                <div className="h-48">
                  <Bar data={chartData.departmentSales} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.departmentSales } } }} />
                </div>
              ) : (
                <NoDataMessage message={t.noData} />
              )}
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-medium text-gray-700 mb-3">{t.leastDepartmentSales}</h3>
              {filteredData.leastDepartmentSales.length > 0 ? (
                <div className="h-48">
                  <Bar data={chartData.leastDepartmentSales} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.leastDepartmentSales } } }} />
                </div>
              ) : (
                <NoDataMessage message={t.noData} />
              )}
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-medium text-gray-700 mb-3">{t.branchSales}</h3>
              {filteredData.branchSales.length > 0 ? (
                <>
                  <div className="h-48">
                    <Bar data={chartData.branchSales} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.branchSales } } }} />
                  </div>
                  <BranchTable data={filteredData.branchSales} title={t.branchSales} language={language} currency={t.currency} />
                </>
              ) : (
                <NoDataMessage message={t.noData} />
              )}
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-medium text-gray-700 mb-3">{t.leastBranchSales}</h3>
              {filteredData.leastBranchSales.length > 0 ? (
                <>
                  <div className="h-48">
                    <Bar data={chartData.leastBranchSales} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.leastBranchSales } } }} />
                  </div>
                  <BranchTable data={filteredData.leastBranchSales} title={t.leastBranchSales} language={language} currency={t.currency} />
                </>
              ) : (
                <NoDataMessage message={t.noData} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(SalesAnalytics);