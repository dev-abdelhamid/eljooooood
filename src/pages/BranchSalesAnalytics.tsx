import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { salesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line } from 'recharts';
import { AlertCircle, BarChart2 } from 'lucide-react';
import { toast } from 'react-toastify';

const translations = {
  ar: {
    title: 'إحصائيات المبيعات',
    subtitle: 'تحليلات وإحصائيات المبيعات لفرعك',
    totalSales: 'إجمالي المبيعات',
    totalCount: 'عدد المبيعات',
    averageOrderValue: 'متوسط قيمة الطلب',
    topProducts: 'المنتجات الأعلى مبيعًا',
    leastProducts: 'المنتجات الأقل مبيعًا',
    departmentSales: 'مبيعات الأقسام',
    leastDepartmentSales: 'الأقسام الأقل مبيعًا',
    salesTrends: 'اتجاهات المبيعات',
    topCustomers: 'أفضل العملاء',
    noAnalytics: 'لا توجد إحصائيات متاحة',
    noCustomers: 'لا توجد عملاء',
    totalRevenue: 'إجمالي الإيرادات',
    totalQuantity: 'إجمالي الكمية',
    totalSpent: 'إجمالي الإنفاق',
    purchaseCount: 'عدد الشراء',
    unknown: 'غير معروف',
    errors: {
      unauthorized_access: 'غير مصرح لك بالوصول',
      no_branch_assigned: 'لم يتم تعيين فرع',
      fetch_analytics: 'خطأ أثناء جلب الإحصائيات',
      network_error: 'خطأ في الاتصال بالشبكة',
    },
    currency: 'ريال',
  },
  en: {
    title: 'Sales Analytics',
    subtitle: 'Sales analytics and statistics for your branch',
    totalSales: 'Total Sales',
    totalCount: 'Total Count',
    averageOrderValue: 'Average Order Value',
    topProducts: 'Top Products',
    leastProducts: 'Least Products',
    departmentSales: 'Department Sales',
    leastDepartmentSales: 'Least Department Sales',
    salesTrends: 'Sales Trends',
    topCustomers: 'Top Customers',
    noAnalytics: 'No analytics available',
    noCustomers: 'No customers',
    totalRevenue: 'Total Revenue',
    totalQuantity: 'Total Quantity',
    totalSpent: 'Total Spent',
    purchaseCount: 'Purchase Count',
    unknown: 'Unknown',
    errors: {
      unauthorized_access: 'You are not authorized to access',
      no_branch_assigned: 'No branch assigned',
      fetch_analytics: 'Error fetching analytics',
      network_error: 'Network connection error',
    },
    currency: 'SAR',
  },
};

// واجهات TypeScript
interface AnalyticsData {
  totalSales: number;
  totalCount: number;
  averageOrderValue: number;
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
}

// مكونات فرعية
const AnalyticsSkeleton = React.memo(() => (
  <div className="space-y-6 animate-pulse">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      {[...Array(3)].map((_, index) => (
        <div key={index} className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        </div>
      ))}
    </div>
    <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
      <div className="h-64 bg-gray-200 rounded"></div>
    </div>
  </div>
));

// المكون الرئيسي
export const BranchSalesAnalytics: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'] || translations.en;

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // التحقق من الصلاحيات ومعرف الفرع
  useEffect(() => {
    if (!user?.role || user.role !== 'branch' || !user.branchId) {
      const errorMessage = !user?.branchId ? t.errors.no_branch_assigned : t.errors.unauthorized_access;
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
      navigate('/unauthorized');
    }
  }, [user, t, isRtl, navigate]);

  // جلب البيانات التحليلية
  const fetchAnalytics = useCallback(async () => {
    if (!user?.branchId) return;
    setLoading(true);
    try {
      const params = { branch: user.branchId };
      const response = await salesAPI.getAnalytics(params);
      setAnalytics({
        ...response,
        salesTrends: response.salesTrends.map((trend: any) => ({
          ...trend,
          period: formatDate(new Date(trend.period), isRtl ? 'ar' : 'en'),
        })),
      });
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Analytics fetch error:`, err);
      const errorMessage = err.status === 403 ? t.errors.unauthorized_access : err.status === 0 ? t.errors.network_error : t.errors.fetch_analytics;
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [user, t, isRtl]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // تحسين الأداء باستخدام useMemo
  const chartColors = useMemo(() => ['#FFBB28', '#FF8042', '#0088FE', '#00C49F', '#FF4444'], []);

  return (
    <div className={`mx-auto px-4 sm:px-6 py-8 min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans ${isRtl ? 'font-arabic' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <header className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center gap-3">
          <BarChart2 className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
            <p className="text-gray-600 text-sm">{t.subtitle}</p>
          </div>
        </div>
      </header>
      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm font-medium">{error}</span>
        </div>
      )}
      {loading ? (
        <AnalyticsSkeleton />
      ) : !analytics ? (
        <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100">
          <BarChart2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-sm font-medium">{t.noAnalytics}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* الإحصائيات الأساسية */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">{t.totalSales}</h3>
              <p className="text-2xl font-bold text-amber-600 mt-2">{analytics.totalSales.toFixed(2)} {t.currency}</p>
            </div>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">{t.totalCount}</h3>
              <p className="text-2xl font-bold text-amber-600 mt-2">{analytics.totalCount}</p>
            </div>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">{t.averageOrderValue}</h3>
              <p className="text-2xl font-bold text-amber-600 mt-2">{analytics.averageOrderValue.toFixed(2)} {t.currency}</p>
            </div>
          </div>

          {/* اتجاهات المبيعات */}
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.salesTrends}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.salesTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="totalSales" stroke={chartColors[0]} name={t.totalSales} />
                <Line type="monotone" dataKey="saleCount" stroke={chartColors[2]} name={t.totalCount} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* مبيعات المنتجات الأعلى */}
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.topProducts}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.productSales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="displayName" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="totalRevenue" fill={chartColors[0]} name={t.totalRevenue} />
                <Bar dataKey="totalQuantity" fill={chartColors[2]} name={t.totalQuantity} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* مبيعات المنتجات الأقل */}
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.leastProducts}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.leastProductSales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="displayName" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="totalRevenue" fill={chartColors[4]} name={t.totalRevenue} />
                <Bar dataKey="totalQuantity" fill={chartColors[3]} name={t.totalQuantity} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* مبيعات الأقسام */}
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.departmentSales}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.departmentSales}
                  dataKey="totalRevenue"
                  nameKey="displayName"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  label
                >
                  {analytics.departmentSales.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* أقل الأقسام مبيعًا */}
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.leastDepartmentSales}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.leastDepartmentSales}
                  dataKey="totalRevenue"
                  nameKey="displayName"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  label
                >
                  {analytics.leastDepartmentSales.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* أفضل العملاء */}
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.topCustomers}</h3>
            {analytics.topCustomers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-gray-700">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className={`px-4 py-2 text-${isRtl ? 'right' : 'left'} font-semibold`}>{t.customerName}</th>
                      <th className={`px-4 py-2 text-${isRtl ? 'right' : 'left'} font-semibold`}>{t.customerPhone}</th>
                      <th className={`px-4 py-2 text-${isRtl ? 'right' : 'left'} font-semibold`}>{t.totalSpent}</th>
                      <th className={`px-4 py-2 text-${isRtl ? 'right' : 'left'} font-semibold`}>{t.purchaseCount}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.topCustomers.map((customer, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2">{customer.customerName || t.unknown}</td>
                        <td className="px-4 py-2">{customer.customerPhone || t.unknown}</td>
                        <td className="px-4 py-2">{customer.totalSpent.toFixed(2)} {t.currency}</td>
                        <td className="px-4 py-2">{customer.purchaseCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-600 text-sm">{t.noCustomers}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(BranchSalesAnalytics);