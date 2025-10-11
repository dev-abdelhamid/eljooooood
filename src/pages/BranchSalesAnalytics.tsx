import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { salesAPI } from '../services/salesAPI';
import { formatDate, formatCurrency } from '../utils/formatDate';
import { AlertCircle, Search, X, ChevronDown, User } from 'lucide-react';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend } from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { motion, AnimatePresence } from 'framer-motion';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend);

// Interfaces
interface SalesTrend {
  period: string;
  totalSales: number;
  saleCount: number;
}

interface ProductSales {
  productId: string;
  productName: string;
  productNameEn?: string | null;
  displayName: string;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
}

interface DepartmentSales {
  departmentId: string;
  departmentName: string;
  departmentNameEn?: string | null;
  displayName: string;
  totalRevenue: number;
  totalQuantity: number;
}

interface Customer {
  customerName: string;
  customerPhone: string;
  totalSpent: number;
  purchaseCount: number;
}

interface AnalyticsData {
  totalSales: number;
  totalCount: number;
  averageOrderValue: string;
  returnRate: string;
  topProduct: ProductSales;
  productSales: ProductSales[];
  leastProductSales: ProductSales[];
  departmentSales: DepartmentSales[];
  leastDepartmentSales: DepartmentSales[];
  salesTrends: SalesTrend[];
  topCustomers: Customer[];
  returnStats: Array<{ status: string; count: number; totalQuantity: number }>;
}

const translations = {
  ar: {
    title: 'إحصائيات الفرع',
    subtitle: 'تحليل شامل لأداء المبيعات',
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
    orderCount: 'عدد الطلبات',
    returnStats: 'إحصائيات الإرجاع',
    noAnalytics: 'لا توجد إحصائيات متاحة',
    noData: 'لا توجد بيانات',
    noCustomers: 'لا يوجد عملاء',
    percentageOfSales: 'نسبة المبيعات',
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
    subtitle: 'Comprehensive sales performance analysis',
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
    orderCount: 'Order Count',
    returnStats: 'Return Statistics',
    noAnalytics: 'No analytics available',
    noData: 'No data available',
    noCustomers: 'No customers',
    percentageOfSales: 'Percentage of Sales',
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
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="relative group"
    >
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
    </motion.div>
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
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="relative group"
    >
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 bg-gradient-to-r from-white to-gray-50 shadow-sm hover:shadow-md text-sm text-gray-700 ${isRtl ? 'text-right' : 'text-left'} flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={ariaLabel}
      >
        <span className="truncate">{selectedOption.label}</span>
        <ChevronDown
          className={`${isOpen ? 'rotate-180' : 'rotate-0'} transition-transform duration-200 w-5 h-5 text-gray-400 group-focus-within:text-amber-500`}
        />
      </button>
      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="absolute w-full mt-2 bg-white rounded-lg shadow-2xl border border-gray-100 z-20 max-h-60 overflow-y-auto scrollbar-none"
          >
            {options.length > 0 ? (
              options.map((option) => (
                <motion.div
                  key={option.value}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className="px-4 py-2.5 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-600 cursor-pointer transition-colors duration-200"
                >
                  {option.label}
                </motion.div>
              ))
            ) : (
              <div className="px-4 py-2.5 text-sm text-gray-500">{isRtl ? 'لا توجد خيارات متاحة' : 'No options available'}</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

const AnalyticsSkeletonCard = React.memo(() => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.5 }}
    className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse"
  >
    <div className="space-y-3">
      <div className="h-5 bg-gray-200 rounded w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      <div className="h-4 bg-gray-200 rounded w-1/3"></div>
    </div>
  </motion.div>
);

const NoDataMessage = React.memo<{ message: string }>(({ message }) => (
  <motion.p
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.3 }}
    className="text-center text-gray-500 py-4 text-sm font-alexandria"
  >
    {message}
  </motion.p>
));

const SortedList = React.memo<{
  title: string;
  data: any[];
  sortKey: string;
  displayKey: string;
  valueKey: string;
  quantityKey: string;
  orderCountKey: string;
  currency: string;
  t: any;
  isRtl: boolean;
}>(({ title, data, sortKey, displayKey, valueKey, quantityKey, orderCountKey, currency, t, isRtl }) => {
  const sortedData = useMemo(() => [...data].sort((a, b) => b[sortKey] - a[sortKey]), [data, sortKey]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="p-6 bg-white rounded-xl shadow-sm border border-gray-100"
    >
      <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{title}</h3>
      {sortedData.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-alexandria">
            <thead>
              <tr className="bg-gray-50">
                <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'الاسم' : 'Name'}</th>
                <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{t.totalSales} ({currency})</th>
                <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{t.quantity}</th>
                <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{t.orderCount}</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((item, index) => (
                <motion.tr
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="border-t"
                >
                  <td className="p-2">{item[displayKey]}</td>
                  <td className="p-2">{safeNumber(item[valueKey]).toFixed(2)}</td>
                  <td className="p-2">{safeNumber(item[quantityKey])}</td>
                  <td className="p-2">{safeNumber(item[orderCountKey])}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <NoDataMessage message={t.noData} />
      )}
    </motion.div>
  );
});

const CustomerTable = React.memo<{
  title: string;
  data: Customer[];
  totalSales: number;
  t: any;
  currency: string;
  isRtl: boolean;
}>(({ title, data, totalSales, t, currency, isRtl }) => {
  const navigate = useNavigate();

  const handleCustomerClick = (customer: Customer) => {
    // Replace with actual navigation or modal logic for customer details
    toast.info(`${isRtl ? 'عرض تفاصيل العميل' : 'View customer details'}: ${customer.customerName}`, {
      position: isRtl ? 'top-right' : 'top-left',
      autoClose: 3000,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="p-6 bg-white rounded-xl shadow-sm border border-gray-100"
    >
      <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{title}</h3>
      {data.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-alexandria">
            <thead>
              <tr className="bg-gray-50">
                <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{t.topCustomers}</th>
                <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{t.totalSales} ({currency})</th>
                <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{t.percentageOfSales}</th>
                <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{t.totalOrders}</th>
                <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}></th>
              </tr>
            </thead>
            <tbody>
              {data.map((customer, index) => (
                <motion.tr
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="border-t hover:bg-amber-50 cursor-pointer"
                  onClick={() => handleCustomerClick(customer)}
                >
                  <td className="p-2 flex items-center gap-2">
                    <User className="w-4 h-4 text-amber-600" />
                    {customer.customerName || t.noCustomers} ({customer.customerPhone || 'N/A'})
                  </td>
                  <td className="p-2">{formatCurrency(safeNumber(customer.totalSpent), currency)}</td>
                  <td className="p-2">{totalSales ? ((safeNumber(customer.totalSpent) / totalSales) * 100).toFixed(2) : 0}%</td>
                  <td className="p-2">{safeNumber(customer.purchaseCount)}</td>
                  <td className="p-2">
                    <button
                      className="text-amber-600 hover:text-amber-800"
                      aria-label={isRtl ? 'عرض التفاصيل' : 'View Details'}
                    >
                      {isRtl ? 'تفاصيل' : 'Details'}
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <NoDataMessage message={t.noCustomers} />
      )}
    </motion.div>
  );
});

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

  const debouncedSearch = useCallback(debounce((value: string) => setSearchTerm(value.trim().toLowerCase()), 300), []);

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
  }, [filterPeriod]);

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
          productName: safeString(response.topProduct?.productName, t.noData),
          productNameEn: response.topProduct?.productNameEn || null,
          displayName: safeString(response.topProduct?.displayName, t.noData),
          totalQuantity: safeNumber(response.topProduct?.totalQuantity),
          totalRevenue: safeNumber(response.topProduct?.totalRevenue),
          orderCount: safeNumber(response.topProduct?.orderCount),
        },
        productSales: (response.productSales || []).map((ps: any) => ({
          productId: ps.productId,
          productName: safeString(ps.productName, t.noData),
          productNameEn: ps.productNameEn || null,
          displayName: safeString(ps.displayName, t.noData),
          totalQuantity: safeNumber(ps.totalQuantity),
          totalRevenue: safeNumber(ps.totalRevenue),
          orderCount: safeNumber(ps.orderCount),
        })),
        leastProductSales: (response.leastProductSales || []).map((ps: any) => ({
          productId: ps.productId,
          productName: safeString(ps.productName, t.noData),
          productNameEn: ps.productNameEn || null,
          displayName: safeString(ps.displayName, t.noData),
          totalQuantity: safeNumber(ps.totalQuantity),
          totalRevenue: safeNumber(ps.totalRevenue),
          orderCount: safeNumber(ps.orderCount),
        })),
        departmentSales: (response.departmentSales || []).map((ds: any) => ({
          departmentId: ds.departmentId,
          departmentName: safeString(ds.departmentName, t.noData),
          departmentNameEn: ds.departmentNameEn || null,
          displayName: safeString(ds.displayName, t.noData),
          totalRevenue: safeNumber(ds.totalRevenue),
          totalQuantity: safeNumber(ds.totalQuantity),
        })),
        leastDepartmentSales: (response.leastDepartmentSales || []).map((ds: any) => ({
          departmentId: ds.departmentId,
          departmentName: safeString(ds.departmentName, t.noData),
          departmentNameEn: ds.departmentNameEn || null,
          displayName: safeString(ds.displayName, t.noData),
          totalRevenue: safeNumber(ds.totalRevenue),
          totalQuantity: safeNumber(ds.totalQuantity),
        })),
        salesTrends: (response.salesTrends || []).map((trend: any) => ({
          period: formatDate(new Date(trend.period), language),
          totalSales: safeNumber(trend.totalSales),
          saleCount: safeNumber(trend.saleCount),
        })),
        topCustomers: (response.topCustomers || []).map((tc: any) => ({
          customerName: safeString(tc.customerName, t.noCustomers),
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
        err.status === 403
          ? t.errors.unauthorized_access
          : err.status === 404
          ? t.errors.branch_not_found
          : err.status === 500
          ? t.errors.server_error
          : t.errors.fetch_analytics;
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
    () => analytics?.productSales.filter((ps) => ps.displayName.toLowerCase().includes(searchTerm)) || [],
    [analytics, searchTerm]
  );

  const filteredLeastProductSales = useMemo(
    () => analytics?.leastProductSales.filter((ps) => ps.displayName.toLowerCase().includes(searchTerm)) || [],
    [analytics, searchTerm]
  );

  const filteredDepartmentSales = useMemo(
    () => analytics?.departmentSales.filter((ds) => ds.displayName.toLowerCase().includes(searchTerm)) || [],
    [analytics, searchTerm]
  );

  const filteredLeastDepartmentSales = useMemo(
    () => analytics?.leastDepartmentSales.filter((ds) => ds.displayName.toLowerCase().includes(searchTerm)) || [],
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

  const createGradient = (ctx: CanvasRenderingContext2D, chartArea: any) => {
    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
    gradient.addColorStop(0, 'rgba(245, 158, 11, 0.2)');
    gradient.addColorStop(1, 'rgba(245, 158, 11, 0.8)');
    return gradient;
  };

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom' as const,
          labels: {
            font: { size: 12, family: 'Alexandria' },
            color: '#374151',
            padding: 20,
            usePointStyle: true,
          },
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleFont: { size: 14, family: 'Alexandria' },
          bodyFont: { size: 12, family: 'Alexandria' },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (context: any) => {
              const label = context.dataset.label || '';
              const value = context.parsed.y || context.parsed;
              return `${label}: ${formatCurrency(value, t.currency)}`;
            },
          },
        },
        title: {
          display: true,
          font: { size: 16, family: 'Alexandria', weight: '600' },
          color: '#1F2937',
          padding: { top: 10, bottom: 20 },
        },
      },
      scales: {
        x: {
          reverse: isRtl,
          ticks: { font: { size: 12, family: 'Alexandria' }, color: '#6B7280', maxRotation: isRtl ? -45 : 45, autoSkip: true },
          grid: { display: false },
        },
        y: {
          reverse: isRtl,
          ticks: { font: { size: 12, family: 'Alexandria' }, color: '#6B7280', beginAtZero: true },
          grid: { color: '#E5E7EB' },
        },
      },
      animation: {
        duration: 1000,
        easing: 'easeOutQuart',
      },
    }),
    [isRtl, t.currency]
  );

  const chartData = useMemo(() => {
    const top5Products = filteredProductSales.slice(0, 5);
    const top5LeastProducts = filteredLeastProductSales.slice(0, 5);
    const top5Departments = filteredDepartmentSales.slice(0, 5);
    const top5LeastDepartments = filteredLeastDepartmentSales.slice(0, 5);

    return {
      productSales: {
        labels: top5Products.map((p) => p.displayName),
        datasets: [
          {
            label: `${t.totalSales} (${t.currency})`,
            data: top5Products.map((p) => safeNumber(p.totalRevenue)),
            backgroundColor: (context: any) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return '#FBBF24';
              return createGradient(ctx, chartArea);
            },
            borderColor: '#F59E0B',
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      leastProductSales: {
        labels: top5LeastProducts.map((p) => p.displayName),
        datasets: [
          {
            label: `${t.totalSales} (${t.currency})`,
            data: top5LeastProducts.map((p) => safeNumber(p.totalRevenue)),
            backgroundColor: '#3B82F6',
            borderColor: '#2563EB',
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      departmentSales: {
        labels: top5Departments.map((d) => d.displayName),
        datasets: [
          {
            label: `${t.totalSales} (${t.currency})`,
            data: top5Departments.map((d) => safeNumber(d.totalRevenue)),
            backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'],
            borderColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'],
            borderWidth: 1,
          },
        ],
      },
      salesTrends: {
        labels: analytics?.salesTrends.slice(0, 10).map((trend) => trend.period) || [],
        datasets: [
          {
            label: t.totalSales,
            data: analytics?.salesTrends.slice(0, 10).map((trend) => safeNumber(trend.totalSales)) || [],
            borderColor: '#F59E0B',
            backgroundColor: (context: any) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return 'rgba(245, 158, 11, 0.2)';
              return createGradient(ctx, chartArea);
            },
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointHoverRadius: 8,
          },
          {
            label: t.totalOrders,
            data: analytics?.salesTrends.slice(0, 10).map((trend) => safeNumber(trend.saleCount)) || [],
            borderColor: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointHoverRadius: 8,
          },
        ],
      },
      returnStatsPie: {
        labels: analytics?.returnStats.map((stat) => stat.status) || [],
        datasets: [
          {
            data: analytics?.returnStats.map((stat) => safeNumber(stat.count)) || [],
            backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'],
            borderColor: ['#fff', '#fff', '#fff', '#fff', '#fff'],
            borderWidth: 2,
          },
        ],
      },
    };
  }, [filteredProductSales, filteredLeastProductSales, filteredDepartmentSales, filteredLeastDepartmentSales, analytics, t]);

  return (
    <div className="min-h-screen px-4 py-8 bg-gradient-to-br from-gray-50 to-gray-100 font-alexandria" dir={isRtl ? 'rtl' : 'ltr'}>
      <link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600&display=swap" rel="stylesheet" />
      <header className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-2xl font-bold text-gray-900 font-alexandria">{t.title}</h1>
            <p className="text-gray-600 text-sm font-alexandria">{t.subtitle}</p>
          </motion.div>
        </div>
      </header>
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm font-medium font-alexandria">{error}</span>
        </motion.div>
      )}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 mb-8"
      >
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
              <motion.input
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm font-alexandria`}
                aria-label={t.filterBy}
              />
              <motion.input
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm font-alexandria`}
                aria-label={t.filterBy}
              />
            </>
          )}
        </div>
      </motion.div>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, index) => (
            <AnalyticsSkeletonCard key={index} />
          ))}
        </div>
      ) : !analytics || analytics.totalCount === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100"
        >
          <NoDataMessage message={t.noAnalytics} />
        </motion.div>
      ) : (
        <AnimatePresence>
          <motion.div
            className="space-y-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3 }}
                className="p-6 bg-white rounded-xl shadow-sm border border-gray-100"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.totalSales}</h3>
                <p className="text-2xl font-bold text-amber-600 font-alexandria">{formatCurrency(analytics.totalSales, t.currency)}</p>
              </motion.div>
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="p-6 bg-white rounded-xl shadow-sm border border-gray-100"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.totalOrders}</h3>
                <p className="text-2xl font-bold text-amber-600 font-alexandria">{analytics.totalCount}</p>
              </motion.div>
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="p-6 bg-white rounded-xl shadow-sm border border-gray-100"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.averageOrderValue}</h3>
                <p className="text-2xl font-bold text-amber-600 font-alexandria">{formatCurrency(parseFloat(analytics.averageOrderValue), t.currency)}</p>
              </motion.div>
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, delay: 0.3 }}
                className="p-6 bg-white rounded-xl shadow-sm border border-gray-100"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.returnRate}</h3>
                <p className="text-2xl font-bold text-amber-600 font-alexandria">{analytics.returnRate}%</p>
              </motion.div>
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="p-6 bg-white rounded-xl shadow-sm border border-gray-100"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.topProduct}</h3>
              {analytics.topProduct.productId ? (
                <div className="space-y-1">
                  <p className="text-sm text-gray-600 font-alexandria">{analytics.topProduct.displayName}</p>
                  <p className="text-sm text-gray-600 font-alexandria">{t.totalSales}: {formatCurrency(analytics.topProduct.totalRevenue, t.currency)}</p>
                  <p className="text-sm text-gray-600 font-alexandria">{t.quantity}: {analytics.topProduct.totalQuantity}</p>
                  <p className="text-sm text-gray-600 font-alexandria">{t.orderCount}: {analytics.topProduct.orderCount}</p>
                </div>
              ) : (
                <NoDataMessage message={t.noData} />
              )}
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="p-6 bg-white rounded-xl shadow-sm border border-gray-100"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.salesTrends}</h3>
              {analytics.salesTrends.length > 0 ? (
                <div className="h-64">
                  <Line
                    data={chartData.salesTrends}
                    options={{
                      ...chartOptions,
                      plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.salesTrends } },
                    }}
                  />
                </div>
              ) : (
                <NoDataMessage message={t.noData} />
              )}
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="p-6 bg-white rounded-xl shadow-sm border border-gray-100"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.productSales}</h3>
              {chartData.productSales.labels.length > 0 ? (
                <div className="h-64">
                  <Bar
                    data={chartData.productSales}
                    options={{
                      ...chartOptions,
                      plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.productSales } },
                    }}
                  />
                </div>
              ) : (
                <NoDataMessage message={t.noData} />
              )}
            </motion.div>
            <SortedList
              title={t.productSales}
              data={filteredProductSales}
              sortKey="totalRevenue"
              displayKey="displayName"
              valueKey="totalRevenue"
              quantityKey="totalQuantity"
              orderCountKey="orderCount"
              currency={t.currency}
              t={t}
              isRtl={isRtl}
            />
            <SortedList
              title={t.leastProductSales}
              data={filteredLeastProductSales}
              sortKey="totalRevenue"
              displayKey="displayName"
              valueKey="totalRevenue"
              quantityKey="totalQuantity"
              orderCountKey="orderCount"
              currency={t.currency}
              t={t}
              isRtl={isRtl}
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="p-6 bg-white rounded-xl shadow-sm border border-gray-100"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.departmentSales}</h3>
              {chartData.departmentSales.labels.length > 0 ? (
                <div className="h-64">
                  <Pie
                    data={chartData.departmentSales}
                    options={{
                      ...chartOptions,
                      plugins: {
                        ...chartOptions.plugins,
                        title: { ...chartOptions.plugins.title, text: t.departmentSales },
                        legend: { position: 'right' as const },
                      },
                    }}
                  />
                </div>
              ) : (
                <NoDataMessage message={t.noData} />
              )}
            </motion.div>
            <SortedList
              title={t.departmentSales}
              data={filteredDepartmentSales}
              sortKey="totalRevenue"
              displayKey="displayName"
              valueKey="totalRevenue"
              quantityKey="totalQuantity"
              orderCountKey="totalQuantity" // Departments may not have orderCount
              currency={t.currency}
              t={t}
              isRtl={isRtl}
            />
            <SortedList
              title={t.leastDepartmentSales}
              data={filteredLeastDepartmentSales}
              sortKey="totalRevenue"
              displayKey="displayName"
              valueKey="totalRevenue"
              quantityKey="totalQuantity"
              orderCountKey="totalQuantity"
              currency={t.currency}
              t={t}
              isRtl={isRtl}
            />
            <CustomerTable
              title={t.topCustomers}
              data={analytics.topCustomers}
              totalSales={analytics.totalSales}
              t={t}
              currency={t.currency}
              isRtl={isRtl}
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              className="p-6 bg-white rounded-xl shadow-sm border border-gray-100"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.returnStats}</h3>
              {chartData.returnStatsPie.labels.length > 0 ? (
                <div className="h-64">
                  <Pie
                    data={chartData.returnStatsPie}
                    options={{
                      ...chartOptions,
                      plugins: {
                        ...chartOptions.plugins,
                        title: { ...chartOptions.plugins.title, text: t.returnStats },
                        legend: { position: 'right' as const },
                      },
                    }}
                  />
                </div>
              ) : (
                <NoDataMessage message={t.noData} />
              )}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};

export default React.memo(BranchSalesAnalytics);