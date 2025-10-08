import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { salesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, BarChart2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

interface SalesAnalytics {
  branchSales: Array<{
    branchId: string;
    branchName: string;
    branchNameEn?: string;
    displayName: string;
    totalSales: number;
    saleCount: number;
  }>;
  leastBranchSales: Array<{
    branchId: string;
    branchName: string;
    branchNameEn?: string;
    displayName: string;
    totalSales: number;
    saleCount: number;
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
    unknownCustomers: 'عملاء غير معروفين',
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
    unknownCustomers: 'Unknown Customers',
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
    },
    currency: 'SAR',
  },
};

const AnalyticsSkeleton = React.memo(() => (
  <div className="space-y-6 animate-pulse">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[...Array(3)].map((_, index) => (
        <div key={index} className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
        </div>
      ))}
    </div>
    <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
      <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
      <div className="h-48 bg-gray-200 rounded"></div>
    </div>
  </div>
));

const NoDataMessage = ({ message }: { message: string }) => (
  <p className="text-center text-gray-500 py-6 text-sm font-alexandria">{message}</p>
);

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

  const fetchAnalytics = useCallback(async () => {
    if (user?.role !== 'admin') {
      setError(t.errors.unauthorized_access);
      toast.error(t.errors.unauthorized_access, { position: isRtl ? 'top-right' : 'top-left' });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params: any = { startDate, endDate };
      const response = await salesAPI.getAnalytics(params);
      console.log(`[${new Date().toISOString()}] Full response from salesAPI.getAnalytics:`, response);
      if (!response || typeof response !== 'object') {
        throw new Error(t.errors.invalid_data);
      }
      setAnalytics({
        branchSales: (response.branchSales || []).map((bs: any) => ({
          ...bs,
          displayName: isRtl ? bs.branchName : bs.branchNameEn || bs.branchName || t.errors.departments.unknown,
        })),
        leastBranchSales: (response.leastBranchSales || []).map((bs: any) => ({
          ...bs,
          displayName: isRtl ? bs.branchName : bs.branchNameEn || bs.branchName || t.errors.departments.unknown,
        })),
        productSales: (response.productSales || []).map((ps: any) => ({
          ...ps,
          displayName: isRtl
            ? ps.productName || t.errors.deleted_product
            : ps.productNameEn || ps.productName || t.errors.deleted_product,
        })),
        leastProductSales: (response.leastProductSales || []).map((ps: any) => ({
          ...ps,
          displayName: isRtl
            ? ps.productName || t.errors.deleted_product
            : ps.productNameEn || ps.productName || t.errors.deleted_product,
        })),
        departmentSales: (response.departmentSales || []).map((ds: any) => ({
          ...ds,
          displayName: isRtl
            ? ds.departmentName
            : ds.departmentNameEn || ds.departmentName || t.errors.departments.unknown,
        })),
        leastDepartmentSales: (response.leastDepartmentSales || []).map((ds: any) => ({
          ...ds,
          displayName: isRtl
            ? ds.departmentName
            : ds.departmentNameEn || ds.departmentName || t.errors.departments.unknown,
        })),
        totalSales: response.totalSales || 0,
        totalCount: response.totalCount || 0,
        averageOrderValue: response.averageOrderValue || 0,
        topProduct: response.topProduct
          ? {
              ...response.topProduct,
              displayName: isRtl
                ? response.topProduct.productName || t.errors.deleted_product
                : response.topProduct.productNameEn ||
                  response.topProduct.productName ||
                  t.errors.deleted_product,
            }
          : { productId: null, productName: '', displayName: '', totalQuantity: 0, totalRevenue: 0 },
        salesTrends: (response.salesTrends || []).map((trend: any) => ({
          ...trend,
          period: formatDate(new Date(trend.period), language),
        })),
        topCustomers: (response.topCustomers || []),
      });
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Analytics fetch error:`, { message: err.message, stack: err.stack });
      const errorMessage = err.status === 403 ? t.errors.unauthorized_access : err.status === 0 ? t.errors.network_error : t.errors.fetch_analytics;
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
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

  const processedTopCustomers = useMemo(() => {
    const customers = analytics.topCustomers.map((customer) => {
      if (!customer.customerName && !customer.customerPhone) {
        return { ...customer, customerName: t.unknownCustomers, customerPhone: '' };
      }
      return customer;
    });
    return customers.sort((a, b) => {
      if (a.customerName === t.unknownCustomers) return 1;
      if (b.customerName === t.unknownCustomers) return -1;
      return b.totalSpent - a.totalSpent;
    });
  }, [analytics.topCustomers, t]);

  const chartColors = useMemo(() => ['#FBBF24', '#3B82F6', '#FF6384', '#4BC0C0', '#9966FF'], []);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom' as const,
          labels: { font: { size: 10, family: 'Alexandria', weight: '500' }, color: '#1F2937' },
        },
        tooltip: {
          backgroundColor: '#1F2937',
          titleColor: '#FFFFFF',
          bodyColor: '#FFFFFF',
          borderColor: '#4B5563',
          borderWidth: 1,
          titleFont: { size: 10, family: 'Alexandria', weight: '500' },
          bodyFont: { size: 10, family: 'Alexandria' },
          padding: 8,
        },
        title: {
          display: true,
          font: { size: 12, family: 'Alexandria', weight: '600' },
          color: '#1F2937',
          position: 'top' as const,
          padding: { top: 8, bottom: 20 },
        },
      },
      scales: {
        x: {
          ticks: {
            font: { size: 9, family: 'Alexandria', weight: '400' },
            color: '#1F2937',
            maxRotation: isRtl ? -45 : 45,
            minRotation: isRtl ? -45 : 45,
            autoSkip: true,
            maxTicksLimit: 10,
          },
          grid: { display: false },
          title: {
            display: true,
            text: t.totalSales,
            font: { size: 10, family: 'Alexandria', weight: '500' },
            color: '#1F2937',
            padding: { top: 10, bottom: 8 },
          },
        },
        y: {
          ticks: { font: { size: 9, family: 'Alexandria', weight: '400' }, color: '#1F2937' },
          grid: { color: '#E5E7EB' },
        },
      },
      elements: {
        bar: {
          barThickness: 10, // عرض أصغر للأعمدة
        },
        line: {
          borderWidth: 2, // خطوط أنحف
        },
      },
    }),
    [isRtl, t]
  );

  const productSalesData = {
    labels: analytics.productSales.slice(0, 8).map((p) => p.displayName),
    datasets: [
      {
        label: `${t.totalSales} (${t.currency})`,
        data: analytics.productSales.slice(0, 8).map((p) => p.totalRevenue),
        backgroundColor: chartColors[0],
        borderWidth: 0,
      },
    ],
  };

  const leastProductSalesData = {
    labels: analytics.leastProductSales.slice(0, 8).map((p) => p.displayName),
    datasets: [
      {
        label: `${t.totalSales} (${t.currency})`,
        data: analytics.leastProductSales.slice(0, 8).map((p) => p.totalRevenue),
        backgroundColor: chartColors[1],
        borderWidth: 0,
      },
    ],
  };

  const departmentSalesData = {
    labels: analytics.departmentSales.slice(0, 8).map((d) => d.displayName),
    datasets: [
      {
        label: `${t.totalSales} (${t.currency})`,
        data: analytics.departmentSales.slice(0, 8).map((d) => d.totalRevenue),
        backgroundColor: chartColors[2],
        borderWidth: 0,
      },
    ],
  };

  const leastDepartmentSalesData = {
    labels: analytics.leastDepartmentSales.slice(0, 8).map((d) => d.displayName),
    datasets: [
      {
        label: `${t.totalSales} (${t.currency})`,
        data: analytics.leastDepartmentSales.slice(0, 8).map((d) => d.totalRevenue),
        backgroundColor: chartColors[3],
        borderWidth: 0,
      },
    ],
  };

  const branchSalesData = {
    labels: analytics.branchSales.slice(0, 8).map((b) => b.displayName),
    datasets: [
      {
        label: `${t.totalSales} (${t.currency})`,
        data: analytics.branchSales.slice(0, 8).map((b) => b.totalSales),
        backgroundColor: chartColors[4],
        borderWidth: 0,
      },
    ],
  };

  const leastBranchSalesData = {
    labels: analytics.leastBranchSales.slice(0, 8).map((b) => b.displayName),
    datasets: [
      {
        label: `${t.totalSales} (${t.currency})`,
        data: analytics.leastBranchSales.slice(0, 8).map((b) => b.totalSales),
        backgroundColor: chartColors[0],
        borderWidth: 0,
      },
    ],
  };

  const salesTrendsData = {
    labels: analytics.salesTrends.slice(0, 10).map((trend) => trend.period),
    datasets: [
      {
        label: t.totalCount,
        data: analytics.salesTrends.slice(0, 10).map((trend) => trend.saleCount),
        borderColor: chartColors[1],
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.4,
      },
    ],
  };

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <span className="text-red-600 text-base font-medium font-alexandria">{t.errors.unauthorized_access}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 bg-gradient-to-br from-gray-50 to-gray-100 font-alexandria" dir={isRtl ? 'rtl' : 'ltr'}>
      <link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600&display=swap" rel="stylesheet" />
      <header className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <BarChart2 className="w-6 h-6 text-amber-600" />
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">{t.title}</h1>
            <p className="text-gray-500 text-sm">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t.startDate}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full py-2 px-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all bg-white shadow-sm hover:shadow-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t.endDate}</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full py-2 px-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all bg-white shadow-sm hover:shadow-md text-sm"
            />
          </div>
        </div>
      </header>
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm font-medium">{error}</span>
        </div>
      )}
      {loading ? (
        <AnalyticsSkeleton />
      ) : !analytics ? (
        <div className="p-6 text-center bg-white rounded-lg shadow-sm border border-gray-100">
          <BarChart2 className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 text-sm font-medium">{t.noAnalytics}</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">{t.totalSales}</h3>
              <p className="text-lg font-bold text-amber-600 mt-2">{analytics.totalSales.toFixed(2)} {t.currency}</p>
              <p className="text-xs text-gray-500">{t.totalCount}: {analytics.totalCount}</p>
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">{t.averageOrderValue}</h3>
              <p className="text-lg font-bold text-amber-600 mt-2">{analytics.averageOrderValue.toFixed(2)} {t.currency}</p>
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">{t.topProduct}</h3>
              {analytics.topProduct?.productId ? (
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-medium">{analytics.topProduct.displayName}</p>
                  <p className="text-xs text-gray-500">{t.totalSales}: {analytics.topProduct.totalRevenue.toFixed(2)} {t.currency}</p>
                  <p className="text-xs text-gray-500">{t.totalCount}: {analytics.topProduct.totalQuantity}</p>
                </div>
              ) : (
                <NoDataMessage message={t.noData} />
              )}
            </div>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.topCustomers}</h3>
            {processedTopCustomers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-gray-700">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className={`px-4 py-2 text-${isRtl ? 'right' : 'left'} font-semibold text-xs`}>{t.customerName}</th>
                      <th className={`px-4 py-2 text-${isRtl ? 'right' : 'left'} font-semibold text-xs`}>{t.customerPhone}</th>
                      <th className={`px-4 py-2 text-${isRtl ? 'right' : 'left'} font-semibold text-xs`}>{t.totalSales}</th>
                      <th className={`px-4 py-2 text-${isRtl ? 'right' : 'left'} font-semibold text-xs`}>{t.totalCount}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedTopCustomers.map((customer, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2 text-xs">{customer.customerName || t.unknownCustomers}</td>
                        <td className="px-4 py-2 text-xs">{customer.customerPhone || 'N/A'}</td>
                        <td className="px-4 py-2 text-xs">{customer.totalSpent.toFixed(2)} {t.currency}</td>
                        <td className="px-4 py-2 text-xs">{customer.purchaseCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <NoDataMessage message={t.noCustomers} />
            )}
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.salesTrends}</h3>
            {analytics.salesTrends.length > 0 ? (
              <div className="h-64">
                <Line
                  data={salesTrendsData}
                  options={{
                    ...chartOptions,
                    plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.salesTrends } },
                  }}
                />
              </div>
            ) : (
              <NoDataMessage message={t.noData} />
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.productSales}</h3>
              {analytics.productSales.length > 0 ? (
                <div className="h-48">
                  <Bar
                    data={productSalesData}
                    options={{
                      ...chartOptions,
                      plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.productSales } },
                    }}
                  />
                </div>
              ) : (
                <NoDataMessage message={t.noData} />
              )}
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.leastProductSales}</h3>
              {analytics.leastProductSales.length > 0 ? (
                <div className="h-48">
                  <Bar
                    data={leastProductSalesData}
                    options={{
                      ...chartOptions,
                      plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.leastProductSales } },
                    }}
                  />
                </div>
              ) : (
                <NoDataMessage message={t.noData} />
              )}
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.departmentSales}</h3>
              {analytics.departmentSales.length > 0 ? (
                <div className="h-48">
                  <Bar
                    data={departmentSalesData}
                    options={{
                      ...chartOptions,
                      plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.departmentSales } },
                    }}
                  />
                </div>
              ) : (
                <NoDataMessage message={t.noData} />
              )}
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.leastDepartmentSales}</h3>
              {analytics.leastDepartmentSales.length > 0 ? (
                <div className="h-48">
                  <Bar
                    data={leastDepartmentSalesData}
                    options={{
                      ...chartOptions,
                      plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.leastDepartmentSales } },
                    }}
                  />
                </div>
              ) : (
                <NoDataMessage message={t.noData} />
              )}
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.branchSales}</h3>
              {analytics.branchSales.length > 0 ? (
                <div className="h-48">
                  <Bar
                    data={branchSalesData}
                    options={{
                      ...chartOptions,
                      plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.branchSales } },
                    }}
                  />
                </div>
              ) : (
                <NoDataMessage message={t.noData} />
              )}
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.leastBranchSales}</h3>
              {analytics.leastBranchSales.length > 0 ? (
                <div className="h-48">
                  <Bar
                    data={leastBranchSalesData}
                    options={{
                      ...chartOptions,
                      plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.leastBranchSales } },
                    }}
                  />
                </div>
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

export default React.memo(SalesAnalytics);import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { salesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, BarChart2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

interface SalesAnalytics {
  branchSales: Array<{
    branchId: string;
    branchName: string;
    branchNameEn?: string;
    displayName: string;
    totalSales: number;
    saleCount: number;
  }>;
  leastBranchSales: Array<{
    branchId: string;
    branchName: string;
    branchNameEn?: string;
    displayName: string;
    totalSales: number;
    saleCount: number;
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
    unknownCustomers: 'عملاء غير معروفين',
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
    unknownCustomers: 'Unknown Customers',
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
    },
    currency: 'SAR',
  },
};

const AnalyticsSkeleton = React.memo(() => (
  <div className="space-y-6 animate-pulse">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[...Array(3)].map((_, index) => (
        <div key={index} className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
        </div>
      ))}
    </div>
    <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
      <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
      <div className="h-48 bg-gray-200 rounded"></div>
    </div>
  </div>
));

const NoDataMessage = ({ message }: { message: string }) => (
  <p className="text-center text-gray-500 py-6 text-sm font-alexandria">{message}</p>
);

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

  const fetchAnalytics = useCallback(async () => {
    if (user?.role !== 'admin') {
      setError(t.errors.unauthorized_access);
      toast.error(t.errors.unauthorized_access, { position: isRtl ? 'top-right' : 'top-left' });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params: any = { startDate, endDate };
      const response = await salesAPI.getAnalytics(params);
      console.log(`[${new Date().toISOString()}] Full response from salesAPI.getAnalytics:`, response);
      if (!response || typeof response !== 'object') {
        throw new Error(t.errors.invalid_data);
      }
      setAnalytics({
        branchSales: (response.branchSales || []).map((bs: any) => ({
          ...bs,
          displayName: isRtl ? bs.branchName : bs.branchNameEn || bs.branchName || t.errors.departments.unknown,
        })),
        leastBranchSales: (response.leastBranchSales || []).map((bs: any) => ({
          ...bs,
          displayName: isRtl ? bs.branchName : bs.branchNameEn || bs.branchName || t.errors.departments.unknown,
        })),
        productSales: (response.productSales || []).map((ps: any) => ({
          ...ps,
          displayName: isRtl
            ? ps.productName || t.errors.deleted_product
            : ps.productNameEn || ps.productName || t.errors.deleted_product,
        })),
        leastProductSales: (response.leastProductSales || []).map((ps: any) => ({
          ...ps,
          displayName: isRtl
            ? ps.productName || t.errors.deleted_product
            : ps.productNameEn || ps.productName || t.errors.deleted_product,
        })),
        departmentSales: (response.departmentSales || []).map((ds: any) => ({
          ...ds,
          displayName: isRtl
            ? ds.departmentName
            : ds.departmentNameEn || ds.departmentName || t.errors.departments.unknown,
        })),
        leastDepartmentSales: (response.leastDepartmentSales || []).map((ds: any) => ({
          ...ds,
          displayName: isRtl
            ? ds.departmentName
            : ds.departmentNameEn || ds.departmentName || t.errors.departments.unknown,
        })),
        totalSales: response.totalSales || 0,
        totalCount: response.totalCount || 0,
        averageOrderValue: response.averageOrderValue || 0,
        topProduct: response.topProduct
          ? {
              ...response.topProduct,
              displayName: isRtl
                ? response.topProduct.productName || t.errors.deleted_product
                : response.topProduct.productNameEn ||
                  response.topProduct.productName ||
                  t.errors.deleted_product,
            }
          : { productId: null, productName: '', displayName: '', totalQuantity: 0, totalRevenue: 0 },
        salesTrends: (response.salesTrends || []).map((trend: any) => ({
          ...trend,
          period: formatDate(new Date(trend.period), language),
        })),
        topCustomers: (response.topCustomers || []),
      });
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Analytics fetch error:`, { message: err.message, stack: err.stack });
      const errorMessage = err.status === 403 ? t.errors.unauthorized_access : err.status === 0 ? t.errors.network_error : t.errors.fetch_analytics;
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
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

  const processedTopCustomers = useMemo(() => {
    const customers = analytics.topCustomers.map((customer) => {
      if (!customer.customerName && !customer.customerPhone) {
        return { ...customer, customerName: t.unknownCustomers, customerPhone: '' };
      }
      return customer;
    });
    return customers.sort((a, b) => {
      if (a.customerName === t.unknownCustomers) return 1;
      if (b.customerName === t.unknownCustomers) return -1;
      return b.totalSpent - a.totalSpent;
    });
  }, [analytics.topCustomers, t]);

  const chartColors = useMemo(() => ['#FBBF24', '#3B82F6', '#FF6384', '#4BC0C0', '#9966FF'], []);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom' as const,
          labels: { font: { size: 10, family: 'Alexandria', weight: '500' }, color: '#1F2937' },
        },
        tooltip: {
          backgroundColor: '#1F2937',
          titleColor: '#FFFFFF',
          bodyColor: '#FFFFFF',
          borderColor: '#4B5563',
          borderWidth: 1,
          titleFont: { size: 10, family: 'Alexandria', weight: '500' },
          bodyFont: { size: 10, family: 'Alexandria' },
          padding: 8,
        },
        title: {
          display: true,
          font: { size: 12, family: 'Alexandria', weight: '600' },
          color: '#1F2937',
          position: 'top' as const,
          padding: { top: 8, bottom: 20 },
        },
      },
      scales: {
        x: {
          ticks: {
            font: { size: 9, family: 'Alexandria', weight: '400' },
            color: '#1F2937',
            maxRotation: isRtl ? -45 : 45,
            minRotation: isRtl ? -45 : 45,
            autoSkip: true,
            maxTicksLimit: 10,
          },
          grid: { display: false },
          title: {
            display: true,
            text: t.totalSales,
            font: { size: 10, family: 'Alexandria', weight: '500' },
            color: '#1F2937',
            padding: { top: 10, bottom: 8 },
          },
        },
        y: {
          ticks: { font: { size: 9, family: 'Alexandria', weight: '400' }, color: '#1F2937' },
          grid: { color: '#E5E7EB' },
        },
      },
      elements: {
        bar: {
          barThickness: 10, // عرض أصغر للأعمدة
        },
        line: {
          borderWidth: 2, // خطوط أنحف
        },
      },
    }),
    [isRtl, t]
  );

  const productSalesData = {
    labels: analytics.productSales.slice(0, 8).map((p) => p.displayName),
    datasets: [
      {
        label: `${t.totalSales} (${t.currency})`,
        data: analytics.productSales.slice(0, 8).map((p) => p.totalRevenue),
        backgroundColor: chartColors[0],
        borderWidth: 0,
      },
    ],
  };

  const leastProductSalesData = {
    labels: analytics.leastProductSales.slice(0, 8).map((p) => p.displayName),
    datasets: [
      {
        label: `${t.totalSales} (${t.currency})`,
        data: analytics.leastProductSales.slice(0, 8).map((p) => p.totalRevenue),
        backgroundColor: chartColors[1],
        borderWidth: 0,
      },
    ],
  };

  const departmentSalesData = {
    labels: analytics.departmentSales.slice(0, 8).map((d) => d.displayName),
    datasets: [
      {
        label: `${t.totalSales} (${t.currency})`,
        data: analytics.departmentSales.slice(0, 8).map((d) => d.totalRevenue),
        backgroundColor: chartColors[2],
        borderWidth: 0,
      },
    ],
  };

  const leastDepartmentSalesData = {
    labels: analytics.leastDepartmentSales.slice(0, 8).map((d) => d.displayName),
    datasets: [
      {
        label: `${t.totalSales} (${t.currency})`,
        data: analytics.leastDepartmentSales.slice(0, 8).map((d) => d.totalRevenue),
        backgroundColor: chartColors[3],
        borderWidth: 0,
      },
    ],
  };

  const branchSalesData = {
    labels: analytics.branchSales.slice(0, 8).map((b) => b.displayName),
    datasets: [
      {
        label: `${t.totalSales} (${t.currency})`,
        data: analytics.branchSales.slice(0, 8).map((b) => b.totalSales),
        backgroundColor: chartColors[4],
        borderWidth: 0,
      },
    ],
  };

  const leastBranchSalesData = {
    labels: analytics.leastBranchSales.slice(0, 8).map((b) => b.displayName),
    datasets: [
      {
        label: `${t.totalSales} (${t.currency})`,
        data: analytics.leastBranchSales.slice(0, 8).map((b) => b.totalSales),
        backgroundColor: chartColors[0],
        borderWidth: 0,
      },
    ],
  };

  const salesTrendsData = {
    labels: analytics.salesTrends.slice(0, 10).map((trend) => trend.period),
    datasets: [
      {
        label: t.totalCount,
        data: analytics.salesTrends.slice(0, 10).map((trend) => trend.saleCount),
        borderColor: chartColors[1],
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.4,
      },
    ],
  };

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <span className="text-red-600 text-base font-medium font-alexandria">{t.errors.unauthorized_access}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 bg-gradient-to-br from-gray-50 to-gray-100 font-alexandria" dir={isRtl ? 'rtl' : 'ltr'}>
      <link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600&display=swap" rel="stylesheet" />
      <header className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <BarChart2 className="w-6 h-6 text-amber-600" />
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">{t.title}</h1>
            <p className="text-gray-500 text-sm">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t.startDate}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full py-2 px-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all bg-white shadow-sm hover:shadow-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t.endDate}</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full py-2 px-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all bg-white shadow-sm hover:shadow-md text-sm"
            />
          </div>
        </div>
      </header>
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm font-medium">{error}</span>
        </div>
      )}
      {loading ? (
        <AnalyticsSkeleton />
      ) : !analytics ? (
        <div className="p-6 text-center bg-white rounded-lg shadow-sm border border-gray-100">
          <BarChart2 className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 text-sm font-medium">{t.noAnalytics}</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">{t.totalSales}</h3>
              <p className="text-lg font-bold text-amber-600 mt-2">{analytics.totalSales.toFixed(2)} {t.currency}</p>
              <p className="text-xs text-gray-500">{t.totalCount}: {analytics.totalCount}</p>
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">{t.averageOrderValue}</h3>
              <p className="text-lg font-bold text-amber-600 mt-2">{analytics.averageOrderValue.toFixed(2)} {t.currency}</p>
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">{t.topProduct}</h3>
              {analytics.topProduct?.productId ? (
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-medium">{analytics.topProduct.displayName}</p>
                  <p className="text-xs text-gray-500">{t.totalSales}: {analytics.topProduct.totalRevenue.toFixed(2)} {t.currency}</p>
                  <p className="text-xs text-gray-500">{t.totalCount}: {analytics.topProduct.totalQuantity}</p>
                </div>
              ) : (
                <NoDataMessage message={t.noData} />
              )}
            </div>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.topCustomers}</h3>
            {processedTopCustomers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-gray-700">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className={`px-4 py-2 text-${isRtl ? 'right' : 'left'} font-semibold text-xs`}>{t.customerName}</th>
                      <th className={`px-4 py-2 text-${isRtl ? 'right' : 'left'} font-semibold text-xs`}>{t.customerPhone}</th>
                      <th className={`px-4 py-2 text-${isRtl ? 'right' : 'left'} font-semibold text-xs`}>{t.totalSales}</th>
                      <th className={`px-4 py-2 text-${isRtl ? 'right' : 'left'} font-semibold text-xs`}>{t.totalCount}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedTopCustomers.map((customer, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2 text-xs">{customer.customerName || t.unknownCustomers}</td>
                        <td className="px-4 py-2 text-xs">{customer.customerPhone || 'N/A'}</td>
                        <td className="px-4 py-2 text-xs">{customer.totalSpent.toFixed(2)} {t.currency}</td>
                        <td className="px-4 py-2 text-xs">{customer.purchaseCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <NoDataMessage message={t.noCustomers} />
            )}
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.salesTrends}</h3>
            {analytics.salesTrends.length > 0 ? (
              <div className="h-64">
                <Line
                  data={salesTrendsData}
                  options={{
                    ...chartOptions,
                    plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.salesTrends } },
                  }}
                />
              </div>
            ) : (
              <NoDataMessage message={t.noData} />
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.productSales}</h3>
              {analytics.productSales.length > 0 ? (
                <div className="h-48">
                  <Bar
                    data={productSalesData}
                    options={{
                      ...chartOptions,
                      plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.productSales } },
                    }}
                  />
                </div>
              ) : (
                <NoDataMessage message={t.noData} />
              )}
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.leastProductSales}</h3>
              {analytics.leastProductSales.length > 0 ? (
                <div className="h-48">
                  <Bar
                    data={leastProductSalesData}
                    options={{
                      ...chartOptions,
                      plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.leastProductSales } },
                    }}
                  />
                </div>
              ) : (
                <NoDataMessage message={t.noData} />
              )}
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.departmentSales}</h3>
              {analytics.departmentSales.length > 0 ? (
                <div className="h-48">
                  <Bar
                    data={departmentSalesData}
                    options={{
                      ...chartOptions,
                      plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.departmentSales } },
                    }}
                  />
                </div>
              ) : (
                <NoDataMessage message={t.noData} />
              )}
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.leastDepartmentSales}</h3>
              {analytics.leastDepartmentSales.length > 0 ? (
                <div className="h-48">
                  <Bar
                    data={leastDepartmentSalesData}
                    options={{
                      ...chartOptions,
                      plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.leastDepartmentSales } },
                    }}
                  />
                </div>
              ) : (
                <NoDataMessage message={t.noData} />
              )}
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.branchSales}</h3>
              {analytics.branchSales.length > 0 ? (
                <div className="h-48">
                  <Bar
                    data={branchSalesData}
                    options={{
                      ...chartOptions,
                      plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.branchSales } },
                    }}
                  />
                </div>
              ) : (
                <NoDataMessage message={t.noData} />
              )}
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.leastBranchSales}</h3>
              {analytics.leastBranchSales.length > 0 ? (
                <div className="h-48">
                  <Bar
                    data={leastBranchSalesData}
                    options={{
                      ...chartOptions,
                      plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.leastBranchSales } },
                    }}
                  />
                </div>
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