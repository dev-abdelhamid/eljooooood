import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { salesAPI, ordersAPI, returnsAPI, branchesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, BarChart2, ChevronDown, Search, X, Download } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { debounce } from 'lodash';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, Title } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, Title);

interface SalesAnalytics {
  branchSales: Array<{
    branchId: string;
    branchName: string;
    branchNameEn?: string;
    displayName: string;
    totalSales: number;
    saleCount: number;
    averageOrderValue: number;
    totalOrders: number;
    totalReturns: number;
  }>;
  leastBranchSales: Array<{
    branchId: string;
    branchName: string;
    branchNameEn?: string;
    displayName: string;
    totalSales: number;
    saleCount: number;
    averageOrderValue: number;
    totalOrders: number;
    totalReturns: number;
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

interface OrderAnalytics {
  branchOrders: Array<{
    branchId: string;
    branchName: string;
    branchNameEn?: string;
    displayName: string;
    totalOrders: number;
    totalValue: number;
    averageOrderValue: number;
  }>;
  leastBranchOrders: Array<{
    branchId: string;
    branchName: string;
    branchNameEn?: string;
    displayName: string;
    totalOrders: number;
    totalValue: number;
    averageOrderValue: number;
  }>;
  orderTrends: Array<{ period: string; totalOrders: number; totalValue: number }>;
  totalOrders: number;
  totalValue: number;
  averageOrderValue: number;
}

interface ReturnAnalytics {
  branchReturns: Array<{
    branchId: string;
    branchName: string;
    branchNameEn?: string;
    displayName: string;
    totalReturns: number;
    totalValue: number;
    averageReturnValue: number;
  }>;
  leastBranchReturns: Array<{
    branchId: string;
    branchName: string;
    branchNameEn?: string;
    displayName: string;
    totalReturns: number;
    totalValue: number;
    averageReturnValue: number;
  }>;
  returnTrends: Array<{ period: string; totalReturns: number; totalValue: number }>;
  totalReturns: number;
  totalValue: number;
  averageReturnValue: number;
}

interface Branch {
  _id: string;
  name: string;
  nameEn?: string;
  displayName: string;
}

const translations = {
  ar: {
    title: 'تقارير وإحصائيات',
    subtitle: 'تحليلات المبيعات، الطلبات، والمرتجعات',
    totalSales: 'إجمالي المبيعات',
    totalCount: 'عدد المبيعات',
    averageOrderValue: 'متوسط قيمة الطلب',
    totalOrders: 'إجمالي الطلبات',
    totalReturns: 'إجمالي المرتجعات',
    totalValue: 'القيمة الإجمالية',
    averageReturnValue: 'متوسط قيمة المرتجع',
    topProduct: 'المنتج الأكثر مبيعًا',
    productSales: 'مبيعات المنتجات',
    leastProductSales: 'أقل المنتجات مبيعًا',
    departmentSales: 'مبيعات الأقسام',
    leastDepartmentSales: 'أقل الأقسام مبيعًا',
    branchSales: 'مبيعات الفروع',
    leastBranchSales: 'أقل الفروع مبيعًا',
    branchOrders: 'طلبات الفروع',
    leastBranchOrders: 'أقل الفروع طلبات',
    branchReturns: 'مرتجعات الفروع',
    leastBranchReturns: 'أقل الفروع مرتجعات',
    salesTrends: 'اتجاهات المبيعات',
    orderTrends: 'اتجاهات الطلبات',
    returnTrends: 'اتجاهات المرتجعات',
    topCustomers: 'أفضل العملاء',
    ordersTab: 'الطلبات',
    returnsTab: 'المرتجعات',
    salesTab: 'المبيعات',
    trendsTab: 'الاتجاهات',
    searchPlaceholder: 'ابحث عن منتجات، أقسام، فروع، طلبات، أو مرتجعات...',
    branchFilterPlaceholder: 'اختر فرعًا',
    noAnalytics: 'لا توجد إحصائيات متاحة',
    noData: 'لا توجد بيانات',
    noCustomers: 'لا توجد عملاء',
    noOrders: 'لا توجد طلبات',
    noReturns: 'لا توجد مرتجعات',
    startDate: 'تاريخ البدء',
    endDate: 'تاريخ الانتهاء',
    export: 'تصدير البيانات',
    errors: {
      unauthorized_access: 'غير مصرح لك بالوصول',
      fetch_analytics: 'خطأ أثناء جلب الإحصائيات',
      network_error: 'خطأ في الاتصال بالشبكة',
      invalid_data: 'بيانات غير صالحة من الخادم',
      invalid_dates: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية',
      fetch_branches: 'خطأ أثناء جلب الفروع',
      export_failed: 'فشل تصدير البيانات',
    },
    currency: 'ريال',
    comparisons: 'المقارنات',
    totalSalesVsOrders: 'المبيعات مقابل الطلبات',
    salesVsReturns: 'المبيعات مقابل المرتجعات',
    ordersVsReturns: 'الطلبات مقابل المرتجعات',
  },
  en: {
    title: 'Reports & Analytics',
    subtitle: 'Sales, Orders, and Returns Analytics',
    totalSales: 'Total Sales',
    totalCount: 'Total Sale Count',
    averageOrderValue: 'Average Order Value',
    totalOrders: 'Total Orders',
    totalReturns: 'Total Returns',
    totalValue: 'Total Value',
    averageReturnValue: 'Average Return Value',
    topProduct: 'Top Selling Product',
    productSales: 'Product Sales',
    leastProductSales: 'Least Sold Products',
    departmentSales: 'Department Sales',
    leastDepartmentSales: 'Least Sold Departments',
    branchSales: 'Branch Sales',
    leastBranchSales: 'Least Sold Branches',
    branchOrders: 'Branch Orders',
    leastBranchOrders: 'Least Ordered Branches',
    branchReturns: 'Branch Returns',
    leastBranchReturns: 'Least Returned Branches',
    salesTrends: 'Sales Trends',
    orderTrends: 'Order Trends',
    returnTrends: 'Return Trends',
    topCustomers: 'Top Customers',
    ordersTab: 'Orders',
    returnsTab: 'Returns',
    salesTab: 'Sales',
    trendsTab: 'Trends',
    searchPlaceholder: 'Search products, departments, branches, orders, or returns...',
    branchFilterPlaceholder: 'Select a branch',
    noAnalytics: 'No analytics available',
    noData: 'No data available',
    noCustomers: 'No customers',
    noOrders: 'No orders',
    noReturns: 'No returns',
    startDate: 'Start Date',
    endDate: 'End Date',
    export: 'Export Data',
    errors: {
      unauthorized_access: 'You are not authorized to access',
      fetch_analytics: 'Error fetching analytics',
      network_error: 'Network connection error',
      invalid_data: 'Invalid data from server',
      invalid_dates: 'Start date must be before end date',
      fetch_branches: 'Error fetching branches',
      export_failed: 'Failed to export data',
    },
    currency: 'SAR',
    comparisons: 'Comparisons',
    totalSalesVsOrders: 'Sales vs Orders',
    salesVsReturns: 'Sales vs Returns',
    ordersVsReturns: 'Orders vs Returns',
  },
};

const safeNumber = (value: any, defaultValue: number = 0): number =>
  typeof value === 'number' && !isNaN(value) ? value : defaultValue;

const safeString = (value: any, defaultValue: string = ''): string =>
  typeof value === 'string' ? value : defaultValue;

const isValidDate = (date: string): boolean => !isNaN(new Date(date).getTime());

const exportToCSV = (data: any[], filename: string, columns: { key: string; label: string }[], isRtl: boolean, currency: string) => {
  try {
    const headers = columns.map(col => `"${col.label.replace(/"/g, '""')}"`).join(',');
    const rows = data.map(item =>
      columns.map(col => {
        const value = col.key.includes('total') || col.key === 'averageOrderValue' || col.key === 'averageReturnValue' || col.key === 'totalRevenue' || col.key === 'totalSpent' || col.key === 'totalQuantity' || col.key === 'saleCount' || col.key === 'totalOrders' || col.key === 'totalReturns' || col.key === 'totalValue'
          ? `"${safeNumber(item[col.key]).toFixed(2)} ${currency}"`
          : `"${safeString(item[col.key]).replace(/"/g, '""')}"`
      }).join(',')
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([isRtl ? '\uFEFF' + csv : csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Export CSV error:`, err);
    throw new Error(translations[isRtl ? 'ar' : 'en'].errors.export_failed);
  }
};

const AnalyticsSkeleton: React.FC = () => (
  <div className="space-y-4 animate-pulse">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
      {[...Array(4)].map((_, index) => (
        <div key={index} className="p-3 bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
          <div className="h-6 bg-gray-200 rounded w-1/2" />
        </div>
      ))}
    </div>
    <div className="p-3 bg-white rounded-lg shadow-sm border border-gray-100">
      <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
      <div className="h-56 bg-gray-200 rounded" />
    </div>
  </div>
);

const NoDataMessage: React.FC<{ message: string }> = ({ message }) => (
  <p className="text-center text-gray-500 py-3 text-xs font-alexandria">{message}</p>
);

const ProductSearchInput: React.FC<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  ariaLabel: string;
  className?: string;
}> = ({ value, onChange, placeholder, ariaLabel, className }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';

  const handleClear = () => {
    onChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>);
  };

  return (
    <div className={`relative group w-full ${className}`}>
      <motion.div
        className={`absolute inset-y-0 ${isRtl ? 'right-3' : 'left-3'} flex items-center text-gray-400 transition-colors group-focus-within:text-amber-600`}
        initial={false}
        animate={{ opacity: value ? 0 : 1, scale: value ? 0.8 : 1 }}
        transition={{ duration: 0.2 }}
      >
        <Search className="w-4 h-4" />
      </motion.div>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full ${isRtl ? 'pr-10 pl-3' : 'pl-10 pr-3'} py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent bg-white shadow-sm hover:shadow-md placeholder-gray-400 transition-all duration-300 font-alexandria ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={ariaLabel}
      />
      {value && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          onClick={handleClear}
          className={`absolute inset-y-0 ${isRtl ? 'left-3' : 'right-3'} flex items-center text-gray-400 hover:text-amber-600 transition-colors focus:outline-none`}
          aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
        >
          <X className="w-4 h-4" />
        </motion.button>
      )}
    </div>
  );
};

const ProductDropdown: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}> = ({ value, onChange, options, ariaLabel, disabled = false, className }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((opt) => opt.value === value) || options[0] || { label: isRtl ? 'اختر' : 'Select', value: '' };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative group w-full ${className}`} ref={dropdownRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full py-1.5 px-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent bg-white shadow-sm hover:shadow-md text-xs font-alexandria text-gray-700 flex justify-between items-center transition-all duration-300 ${isRtl ? 'text-right' : 'text-left'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={ariaLabel}
      >
        <span className="truncate">{selectedOption.label}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && !disabled && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={`absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-amber-600 scrollbar-track-gray-100 font-alexandria ${isRtl ? 'text-right' : 'text-left'}`}
        >
          {options.map((option) => (
            <button
              key={option.value}
              dir={isRtl ? 'rtl' : 'ltr'}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 text-xs text-gray-700 hover:bg-amber-100 hover:text-amber-600 transition-colors"
            >
              {option.label}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
};

const DataTable: React.FC<{
  title: string;
  data: any[];
  columns: { key: string; label: string; width?: string }[];
  isRtl: boolean;
  currency?: string;
  className?: string;
}> = React.memo(({ title, data, columns, isRtl, currency, className }) => (
  <div className={`p-3 bg-white rounded-lg shadow-sm border border-gray-100 mt-3 ${className}`}>
    <div className="flex justify-between items-center mb-2">
      <h3 className="text-xs font-medium text-gray-700 font-alexandria">{title}</h3>
      {data.length > 0 && (
        <button
          onClick={() => exportToCSV(data, title, columns, isRtl, currency || '')}
          className="flex items-center gap-2 text-xs text-amber-600 hover:text-amber-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          {translations[isRtl ? 'ar' : 'en'].export}
        </button>
      )}
    </div>
    {data.length > 0 ? (
      <div className="overflow-x-auto overflow-y-auto max-h-[300px] scrollbar-thin scrollbar-thumb-amber-600 scrollbar-track-gray-100">
        <table className="w-full text-xs min-w-max">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`p-2 ${isRtl ? 'text-right' : 'text-left'} ${col.width || 'w-auto'} font-alexandria font-medium text-gray-600`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index} className="border-t hover:bg-gray-50 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className={`p-2 ${col.width || 'w-auto'} font-alexandria text-gray-700`}>
                    {col.key.includes('total') || col.key === 'averageOrderValue' || col.key === 'averageReturnValue' || col.key === 'totalRevenue' || col.key === 'totalSpent' || col.key === 'totalQuantity' || col.key === 'saleCount' || col.key === 'totalOrders' || col.key === 'totalReturns' || col.key === 'totalValue'
                      ? `${safeNumber(item[col.key]).toFixed(2)} ${currency || ''}`
                      : safeString(item[col.key], '-') || '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <NoDataMessage message={translations[isRtl ? 'ar' : 'en'].noData} />
    )}
  </div>
));

const calculateBranchAnalytics = (list: any[], isRtl: boolean, field: string) => {
  const branchMap = new Map<string, { branchId: string; displayName: string; count: number; total: number; average: number }>();
  list.forEach(item => {
    const branchId = item.branch?._id || 'unknown';
    const branchName = item.branchName;
    let entry = branchMap.get(branchId);
    if (!entry) {
      entry = { branchId, displayName: branchName, count: 0, total: 0, average: 0 };
      branchMap.set(branchId, entry);
    }
    entry.count += 1;
    entry.total += item[field] || 0;
  });
  const branches = Array.from(branchMap.values());
  branches.forEach(b => b.average = b.count > 0 ? b.total / b.count : 0);
  return branches.sort((a, b) => b.total - a.total);
};

const calculateLeastBranchAnalytics = (list: any[], isRtl: boolean, field: string) => {
  return calculateBranchAnalytics(list, isRtl, field).sort((a, b) => a.total - b.total);
};

const calculateTrends = (list: any[], dateField: string, valueField: string, countField: string, start: string, end: string, lang: string) => {
  const trends = [];
  const startD = new Date(start);
  const endD = new Date(end);
  for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
    const period = `${d.getDate()}/${d.getMonth() + 1}`;
    const dayList = list.filter(item => new Date(item[dateField]).toDateString() === d.toDateString());
    const totalValue = dayList.reduce((sum, item) => sum + (item.total || 0), 0);
    const totalCount = dayList.length;
    trends.push({ period, [valueField]: totalValue, [countField]: totalCount });
  }
  return trends;
};

const ReportsAnalytics: React.FC = () => {
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
  const [orderAnalytics, setOrderAnalytics] = useState<OrderAnalytics>({
    branchOrders: [],
    leastBranchOrders: [],
    orderTrends: [],
    totalOrders: 0,
    totalValue: 0,
    averageOrderValue: 0,
  });
  const [returnAnalytics, setReturnAnalytics] = useState<ReturnAnalytics>({
    branchReturns: [],
    leastBranchReturns: [],
    returnTrends: [],
    totalReturns: 0,
    totalValue: 0,
    averageReturnValue: 0,
  });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'sales' | 'orders' | 'returns' | 'trends'>('sales');
  const debouncedSearch = useCallback(debounce((value: string) => setSearchTerm(value.trim().toLowerCase()), 300), []);

  const fetchBranches = useCallback(async () => {
    try {
      const response = await branchesAPI.getAll();
      const branchesData = Array.isArray(response) ? response : response.branches || [];
      setBranches(branchesData.map((b: any) => ({
        _id: safeString(b._id),
        name: safeString(b.name),
        nameEn: safeString(b.nameEn),
        displayName: isRtl ? safeString(b.name, 'فرع غير معروف') : safeString(b.nameEn || b.name, 'Unknown Branch'),
      })));
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Fetch branches error:`, err);
      toast.error(t.errors.fetch_branches, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
    }
  }, [isRtl, t]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchData('sales'),
        fetchData('orders'),
        fetchData('returns')
      ]);
    } catch (err) {
      // Errors handled in fetchData
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedBranch, language, user, t, isRtl]);

  const fetchData = useCallback(async (type: 'sales' | 'orders' | 'returns') => {
    if (user?.role !== 'admin' && user?.role !== 'production') {
      setError(t.errors.unauthorized_access);
      toast.error(t.errors.unauthorized_access, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
      return;
    }

    if (!isValidDate(startDate) || !isValidDate(endDate) || new Date(startDate) > new Date(endDate)) {
      setError(t.errors.invalid_dates);
      toast.error(t.errors.invalid_dates, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
      return;
    }

    try {
      const params: any = {
        branch: selectedBranch,
        startDate: new Date(startDate).toISOString().split('T')[0],
        endDate: new Date(endDate).toISOString().split('T')[0],
        lang: language,
      };
      let response;
      if (type === 'sales') {
        response = await salesAPI.getAnalytics(params);
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
            totalOrders: safeNumber(bs.totalOrders),
            totalReturns: safeNumber(bs.totalReturns),
          })).sort((a, b) => b.totalSales - a.totalSales).slice(0, 6),
          leastBranchSales: (response.leastBranchSales || []).map((bs: any) => ({
            branchId: safeString(bs.branchId),
            branchName: safeString(bs.branchName),
            branchNameEn: safeString(bs.branchNameEn),
            displayName: isRtl ? safeString(bs.branchName, 'فرع غير معروف') : safeString(bs.branchNameEn || bs.branchName, 'Unknown Branch'),
            totalSales: safeNumber(bs.totalSales),
            saleCount: safeNumber(bs.saleCount),
            averageOrderValue: safeNumber(bs.averageOrderValue),
            totalOrders: safeNumber(bs.totalOrders),
            totalReturns: safeNumber(bs.totalReturns),
          })).sort((a, b) => a.totalSales - b.totalSales).slice(0, 6),
          productSales: (response.productSales || []).map((ps: any) => ({
            productId: safeString(ps.productId),
            productName: safeString(ps.productName),
            productNameEn: safeString(ps.productNameEn),
            displayName: isRtl ? safeString(ps.productName, 'منتج محذوف') : safeString(ps.productNameEn || ps.productName, 'Deleted Product'),
            totalQuantity: safeNumber(ps.totalQuantity),
            totalRevenue: safeNumber(ps.totalRevenue),
          })).sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 6),
          leastProductSales: (response.leastProductSales || []).map((ps: any) => ({
            productId: safeString(ps.productId),
            productName: safeString(ps.productName),
            productNameEn: safeString(ps.productNameEn),
            displayName: isRtl ? safeString(ps.productName, 'منتج محذوف') : safeString(ps.productNameEn || ps.productName, 'Deleted Product'),
            totalQuantity: safeNumber(ps.totalQuantity),
            totalRevenue: safeNumber(ps.totalRevenue),
          })).sort((a, b) => a.totalRevenue - b.totalRevenue).slice(0, 6),
          departmentSales: (response.departmentSales || []).map((ds: any) => ({
            departmentId: safeString(ds.departmentId),
            departmentName: safeString(ds.departmentName),
            departmentNameEn: safeString(ds.departmentNameEn),
            displayName: isRtl ? safeString(ds.departmentName, 'قسم غير معروف') : safeString(ds.departmentNameEn || ds.departmentName, 'Unknown Department'),
            totalRevenue: safeNumber(ds.totalRevenue),
            totalQuantity: safeNumber(ds.totalQuantity),
          })).sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 6),
          leastDepartmentSales: (response.leastDepartmentSales || []).map((ds: any) => ({
            departmentId: safeString(ds.departmentId),
            departmentName: safeString(ds.departmentName),
            departmentNameEn: safeString(ds.departmentNameEn),
            displayName: isRtl ? safeString(ds.departmentName, 'قسم غير معروف') : safeString(ds.departmentNameEn || ds.departmentName, 'Unknown Department'),
            totalRevenue: safeNumber(ds.totalRevenue),
            totalQuantity: safeNumber(ds.totalQuantity),
          })).sort((a, b) => a.totalRevenue - b.totalRevenue).slice(0, 6),
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
            period: formatDate(new Date(safeString(trend.period)), language),
            totalSales: safeNumber(trend.totalSales),
            saleCount: safeNumber(trend.saleCount),
          })).slice(0, 12),
          topCustomers: (response.topCustomers || []).map((customer: any) => ({
            customerName: safeString(customer.customerName, t.noCustomers),
            customerPhone: safeString(customer.customerPhone, ''),
            totalSpent: safeNumber(customer.totalSpent),
            purchaseCount: safeNumber(customer.purchaseCount),
          })).slice(0, 5),
        });
      } else if (type === 'orders') {
        response = await ordersAPI.getAll(params);
        const rawResponse = Array.isArray(response) ? response : response.orders || [];
        if (!Array.isArray(rawResponse)) {
          throw new Error(t.errors.invalid_data);
        }
        const orderList = rawResponse.map((order: any) => ({
          _id: safeString(order._id),
          orderNumber: safeString(order.orderNumber, 'N/A'),
          date: safeString(order.createdAt),
          total: safeNumber(order.totalAmount),
          status: safeString(order.status, 'Unknown'),
          branchName: isRtl ? safeString(order.branch?.name, 'Unknown') : safeString(order.branch?.nameEn || order.branch?.name, 'Unknown'),
          branch: order.branch || {},
          totalAmount: safeNumber(order.totalAmount),
          createdAt: safeString(order.createdAt),
        }));
        const totalOrders = orderList.length;
        const totalValue = orderList.reduce((sum, o) => sum + o.total, 0);
        const averageOrderValue = totalOrders > 0 ? totalValue / totalOrders : 0;
        const branchOrders = calculateBranchAnalytics(orderList, isRtl, 'total');
        const leastBranchOrders = calculateLeastBranchAnalytics(orderList, isRtl, 'total');
        const orderTrends = calculateTrends(orderList, 'createdAt', 'totalValue', 'totalOrders', startDate, endDate, language);
        setOrderAnalytics({
          branchOrders: branchOrders.map(b => ({ branchId: b.branchId, branchName: '', displayName: b.displayName, totalOrders: b.count, totalValue: b.total, averageOrderValue: b.average })),
          leastBranchOrders: leastBranchOrders.map(b => ({ branchId: b.branchId, branchName: '', displayName: b.displayName, totalOrders: b.count, totalValue: b.total, averageOrderValue: b.average })),
          orderTrends,
          totalOrders,
          totalValue,
          averageOrderValue,
        });
      } else if (type === 'returns') {
        response = await returnsAPI.getAll(params);
        const rawResponse = Array.isArray(response) ? response : response.returns || [];
        if (!Array.isArray(rawResponse)) {
          throw new Error(t.errors.invalid_data);
        }
        const returnList = rawResponse.map((ret: any) => ({
          _id: safeString(ret._id),
          returnNumber: safeString(ret.returnNumber, 'N/A'),
          date: safeString(ret.createdAt),
          total: safeNumber(ret.totalAmount || ret.items?.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0) || 0),
          status: safeString(ret.status, 'Unknown'),
          branchName: isRtl ? safeString(ret.branch?.name, 'Unknown') : safeString(ret.branch?.nameEn || ret.branch?.name, 'Unknown'),
          branch: ret.branch || {},
          totalAmount: safeNumber(ret.totalAmount || ret.items?.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0) || 0),
          createdAt: safeString(ret.createdAt),
        }));
        const totalReturns = returnList.length;
        const totalValue = returnList.reduce((sum, r) => sum + r.total, 0);
        const averageReturnValue = totalReturns > 0 ? totalValue / totalReturns : 0;
        const branchReturns = calculateBranchAnalytics(returnList, isRtl, 'total');
        const leastBranchReturns = calculateLeastBranchAnalytics(returnList, isRtl, 'total');
        const returnTrends = calculateTrends(returnList, 'createdAt', 'totalValue', 'totalReturns', startDate, endDate, language);
        setReturnAnalytics({
          branchReturns: branchReturns.map(b => ({ branchId: b.branchId, branchName: '', displayName: b.displayName, totalReturns: b.count, totalValue: b.total, averageReturnValue: b.average })),
          leastBranchReturns: leastBranchReturns.map(b => ({ branchId: b.branchId, branchName: '', displayName: b.displayName, totalReturns: b.count, totalValue: b.total, averageReturnValue: b.average })),
          returnTrends,
          totalReturns,
          totalValue,
          averageReturnValue,
        });
      }
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] ${type} fetch error:`, { message: err.message, status: err.status, stack: err.stack });
      const errorMessage =
        err.status === 403 ? t.errors.unauthorized_access :
        err.status === 400 ? t.errors.invalid_dates :
        err.status === 0 ? t.errors.network_error :
        t.errors.fetch_analytics;
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
      if (type === 'sales') {
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
      } else if (type === 'orders') {
        setOrderAnalytics({
          branchOrders: [],
          leastBranchOrders: [],
          orderTrends: [],
          totalOrders: 0,
          totalValue: 0,
          averageOrderValue: 0,
        });
      } else if (type === 'returns') {
        setReturnAnalytics({
          branchReturns: [],
          leastBranchReturns: [],
          returnTrends: [],
          totalReturns: 0,
          totalValue: 0,
          averageReturnValue: 0,
        });
      }
    }
  }, [user, t, isRtl, language, startDate, endDate, selectedBranch]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const filteredData = useMemo(() => ({
    productSales: analytics.productSales.filter((ps) => ps.displayName.toLowerCase().includes(searchTerm)),
    leastProductSales: analytics.leastProductSales.filter((ps) => ps.displayName.toLowerCase().includes(searchTerm)),
    departmentSales: analytics.departmentSales.filter((ds) => ds.displayName.toLowerCase().includes(searchTerm)),
    leastDepartmentSales: analytics.leastDepartmentSales.filter((ds) => ds.displayName.toLowerCase().includes(searchTerm)),
    branchSales: analytics.branchSales.filter((bs) => bs.displayName.toLowerCase().includes(searchTerm)),
    leastBranchSales: analytics.leastBranchSales.filter((bs) => bs.displayName.toLowerCase().includes(searchTerm)),
    branchOrders: orderAnalytics.branchOrders.filter((bo) => bo.displayName.toLowerCase().includes(searchTerm)),
    leastBranchOrders: orderAnalytics.leastBranchOrders.filter((bo) => bo.displayName.toLowerCase().includes(searchTerm)),
    branchReturns: returnAnalytics.branchReturns.filter((br) => br.displayName.toLowerCase().includes(searchTerm)),
    leastBranchReturns: returnAnalytics.leastBranchReturns.filter((br) => br.displayName.toLowerCase().includes(searchTerm)),
  }), [analytics, orderAnalytics, returnAnalytics, searchTerm]);

  const branchOptions = useMemo(
    () => [
      { value: '', label: t.branchFilterPlaceholder },
      ...branches.map((b) => ({ value: b._id, label: b.displayName })),
    ],
    [branches, t]
  );

  const getChartOptions = (isLine: boolean = false) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: 'bottom' as const, 
        labels: { 
          font: { size: 10, family: 'Alexandria' }, 
          color: '#4B5563',
          padding: 12,
          usePointStyle: true,
        } 
      },
      tooltip: { 
        bodyFont: { size: 10, family: 'Alexandria' }, 
        padding: 8, 
        backgroundColor: 'rgba(31, 41, 55, 0.9)',
        titleFont: { size: 12, family: 'Alexandria' },
        cornerRadius: 6,
      },
      title: { 
        display: true, 
        font: { size: 12, family: 'Alexandria' }, 
        color: '#1F2937', 
        padding: { top: 10, bottom: 10 } 
      },
    },
    scales: {
      x: { 
        ticks: { 
          font: { size: 10, family: 'Alexandria' }, 
          color: '#4B5563', 
          maxRotation: 45, 
          autoSkip: true 
        }, 
        reverse: isRtl && !isLine, // Don't reverse for line charts (trends)
        grid: { display: false },
      },
      y: { 
        ticks: { 
          font: { size: 10, family: 'Alexandria' }, 
          color: '#4B5563',
          callback: (value: number) => value.toLocaleString(language),
        }, 
        beginAtZero: true,
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
      },
    },
    elements: {
      bar: { borderRadius: 4 },
      line: { tension: 0.4 },
    },
  });

  const chartData = useMemo(() => {
    const createGradient = (ctx: CanvasRenderingContext2D, chartArea: any, start: string, end: string) => {
      const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
      gradient.addColorStop(0, start);
      gradient.addColorStop(1, end);
      return gradient;
    };

    return {
      productSales: {
        labels: filteredData.productSales.map((p) => p.displayName),
        datasets: [
          {
            label: `${t.totalSales} (${t.currency})`,
            data: filteredData.productSales.map((p) => safeNumber(p.totalRevenue)),
            backgroundColor: '#FBBF24',
            hoverBackgroundColor: '#F59E0B',
            borderRadius: 4,
            barThickness: 20,
          },
        ],
      },
      leastProductSales: {
        labels: filteredData.leastProductSales.map((p) => p.displayName),
        datasets: [
          {
            label: `${t.totalSales} (${t.currency})`,
            data: filteredData.leastProductSales.map((p) => safeNumber(p.totalRevenue)),
            backgroundColor: '#3B82F6',
            hoverBackgroundColor: '#2563EB',
            borderRadius: 4,
            barThickness: 20,
          },
        ],
      },
      departmentSales: {
        labels: filteredData.departmentSales.map((d) => d.displayName),
        datasets: [
          {
            label: `${t.totalSales} (${t.currency})`,
            data: filteredData.departmentSales.map((d) => safeNumber(d.totalRevenue)),
            backgroundColor: '#FF6384',
            hoverBackgroundColor: '#F43F5E',
            borderRadius: 4,
            barThickness: 20,
          },
        ],
      },
      leastDepartmentSales: {
        labels: filteredData.leastDepartmentSales.map((d) => d.displayName),
        datasets: [
          {
            label: `${t.totalSales} (${t.currency})`,
            data: filteredData.leastDepartmentSales.map((d) => safeNumber(d.totalRevenue)),
            backgroundColor: '#4BC0C0',
            hoverBackgroundColor: '#2D9CDB',
            borderRadius: 4,
            barThickness: 20,
          },
        ],
      },
      branchSales: {
        labels: filteredData.branchSales.map((b) => b.displayName),
        datasets: [
          {
            label: `${t.totalSales} (${t.currency})`,
            data: filteredData.branchSales.map((b) => safeNumber(b.totalSales)),
            backgroundColor: '#9966FF',
            hoverBackgroundColor: '#7C3AED',
            barThickness: 20,
          },
          {
            label: `${t.totalOrders}`,
            data: filteredData.branchSales.map((b) => safeNumber(b.totalOrders)),
            backgroundColor: '#36A2EB',
            hoverBackgroundColor: '#1D4ED8',
            barThickness: 20,
          },
          {
            label: `${t.totalReturns}`,
            data: filteredData.branchSales.map((b) => safeNumber(b.totalReturns)),
            backgroundColor: '#FF6384',
            hoverBackgroundColor: '#F43F5E',
            barThickness: 20,
          },
        ],
      },
      leastBranchSales: {
        labels: filteredData.leastBranchSales.map((b) => b.displayName),
        datasets: [
          {
            label: `${t.totalSales} (${t.currency})`,
            data: filteredData.leastBranchSales.map((b) => safeNumber(b.totalSales)),
            backgroundColor: '#FBBF24',
            hoverBackgroundColor: '#F59E0B',
            barThickness: 20,
          },
          {
            label: `${t.totalOrders}`,
            data: filteredData.leastBranchSales.map((b) => safeNumber(b.totalOrders)),
            backgroundColor: '#36A2EB',
            hoverBackgroundColor: '#1D4ED8',
            barThickness: 20,
          },
          {
            label: `${t.totalReturns}`,
            data: filteredData.leastBranchSales.map((b) => safeNumber(b.totalReturns)),
            backgroundColor: '#FF6384',
            hoverBackgroundColor: '#F43F5E',
            barThickness: 20,
          },
        ],
      },
      branchOrders: {
        labels: filteredData.branchOrders.map((b) => b.displayName),
        datasets: [
          {
            label: `${t.totalOrders}`,
            data: filteredData.branchOrders.map((b) => safeNumber(b.totalOrders)),
            backgroundColor: '#36A2EB',
            hoverBackgroundColor: '#1D4ED8',
            barThickness: 20,
          },
          {
            label: `${t.totalValue} (${t.currency})`,
            data: filteredData.branchOrders.map((b) => safeNumber(b.totalValue)),
            backgroundColor: '#9966FF',
            hoverBackgroundColor: '#7C3AED',
            barThickness: 20,
          },
        ],
      },
      leastBranchOrders: {
        labels: filteredData.leastBranchOrders.map((b) => b.displayName),
        datasets: [
          {
            label: `${t.totalOrders}`,
            data: filteredData.leastBranchOrders.map((b) => safeNumber(b.totalOrders)),
            backgroundColor: '#FBBF24',
            hoverBackgroundColor: '#F59E0B',
            barThickness: 20,
          },
          {
            label: `${t.totalValue} (${t.currency})`,
            data: filteredData.leastBranchOrders.map((b) => safeNumber(b.totalValue)),
            backgroundColor: '#36A2EB',
            hoverBackgroundColor: '#1D4ED8',
            barThickness: 20,
          },
        ],
      },
      branchReturns: {
        labels: filteredData.branchReturns.map((b) => b.displayName),
        datasets: [
          {
            label: `${t.totalReturns}`,
            data: filteredData.branchReturns.map((b) => safeNumber(b.totalReturns)),
            backgroundColor: '#FF6384',
            hoverBackgroundColor: '#F43F5E',
            barThickness: 20,
          },
          {
            label: `${t.totalValue} (${t.currency})`,
            data: filteredData.branchReturns.map((b) => safeNumber(b.totalValue)),
            backgroundColor: '#4BC0C0',
            hoverBackgroundColor: '#2D9CDB',
            barThickness: 20,
          },
        ],
      },
      leastBranchReturns: {
        labels: filteredData.leastBranchReturns.map((b) => b.displayName),
        datasets: [
          {
            label: `${t.totalReturns}`,
            data: filteredData.leastBranchReturns.map((b) => safeNumber(b.totalReturns)),
            backgroundColor: '#FBBF24',
            hoverBackgroundColor: '#F59E0B',
            barThickness: 20,
          },
          {
            label: `${t.totalValue} (${t.currency})`,
            data: filteredData.leastBranchReturns.map((b) => safeNumber(b.totalValue)),
            backgroundColor: '#36A2EB',
            hoverBackgroundColor: '#1D4ED8',
            barThickness: 20,
          },
        ],
      },
      salesTrends: {
        labels: analytics.salesTrends.map((trend) => trend.period),
        datasets: [
          {
            label: `${t.totalSales} (${t.currency})`,
            data: analytics.salesTrends.map((trend) => safeNumber(trend.totalSales)),
            borderColor: '#3B82F6',
            backgroundColor: (context: any) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return '#3B82F6';
              return createGradient(ctx, chartArea, 'rgba(59, 130, 246, 0.2)', 'rgba(59, 130, 246, 0.8)');
            },
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          {
            label: `${t.totalCount}`,
            data: analytics.salesTrends.map((trend) => safeNumber(trend.saleCount)),
            borderColor: '#FF6384',
            backgroundColor: (context: any) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return 'rgba(255, 99, 132, 0.1)';
              return createGradient(ctx, chartArea, 'rgba(255, 99, 132, 0.2)', 'rgba(255, 99, 132, 0.8)');
            },
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      orderTrends: {
        labels: orderAnalytics.orderTrends.map((trend) => trend.period),
        datasets: [
          {
            label: `${t.totalOrders}`,
            data: orderAnalytics.orderTrends.map((trend) => safeNumber(trend.totalOrders)),
            borderColor: '#36A2EB',
            backgroundColor: (context: any) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return 'rgba(54, 162, 235, 0.1)';
              return createGradient(ctx, chartArea, 'rgba(54, 162, 235, 0.2)', 'rgba(54, 162, 235, 0.8)');
            },
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          {
            label: `${t.totalValue} (${t.currency})`,
            data: orderAnalytics.orderTrends.map((trend) => safeNumber(trend.totalValue)),
            borderColor: '#9966FF',
            backgroundColor: (context: any) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return 'rgba(153, 102, 255, 0.1)';
              return createGradient(ctx, chartArea, 'rgba(153, 102, 255, 0.2)', 'rgba(153, 102, 255, 0.8)');
            },
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      returnTrends: {
        labels: returnAnalytics.returnTrends.map((trend) => trend.period),
        datasets: [
          {
            label: `${t.totalReturns}`,
            data: returnAnalytics.returnTrends.map((trend) => safeNumber(trend.totalReturns)),
            borderColor: '#FF6384',
            backgroundColor: (context: any) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return 'rgba(255, 99, 132, 0.1)';
              return createGradient(ctx, chartArea, 'rgba(255, 99, 132, 0.2)', 'rgba(255, 99, 132, 0.8)');
            },
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          {
            label: `${t.totalValue} (${t.currency})`,
            data: returnAnalytics.returnTrends.map((trend) => safeNumber(trend.totalValue)),
            borderColor: '#4BC0C0',
            backgroundColor: (context: any) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return 'rgba(75, 192, 192, 0.1)';
              return createGradient(ctx, chartArea, 'rgba(75, 192, 192, 0.2)', 'rgba(75, 192, 192, 0.8)');
            },
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      combinedTrends: {
        labels: analytics.salesTrends.map((trend) => trend.period),
        datasets: [
          {
            label: `${t.salesTrends} (${t.totalSales})`,
            data: analytics.salesTrends.map((trend) => safeNumber(trend.totalSales)),
            borderColor: '#3B82F6',
            backgroundColor: (context: any) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return '#3B82F6';
              return createGradient(ctx, chartArea, 'rgba(59, 130, 246, 0.2)', 'rgba(59, 130, 246, 0.8)');
            },
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          {
            label: `${t.orderTrends} (${t.totalValue})`,
            data: orderAnalytics.orderTrends.map((trend) => safeNumber(trend.totalValue)),
            borderColor: '#36A2EB',
            backgroundColor: (context: any) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return 'rgba(54, 162, 235, 0.1)';
              return createGradient(ctx, chartArea, 'rgba(54, 162, 235, 0.2)', 'rgba(54, 162, 235, 0.8)');
            },
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          {
            label: `${t.returnTrends} (${t.totalValue})`,
            data: returnAnalytics.returnTrends.map((trend) => safeNumber(trend.totalValue)),
            borderColor: '#FF6384',
            backgroundColor: (context: any) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return 'rgba(255, 99, 132, 0.1)';
              return createGradient(ctx, chartArea, 'rgba(255, 99, 132, 0.2)', 'rgba(255, 99, 132, 0.8)');
            },
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      salesVsOrders: {
        labels: analytics.salesTrends.map((trend) => trend.period),
        datasets: [
          {
            label: `${t.totalSales} (${t.currency})`,
            data: analytics.salesTrends.map((trend) => safeNumber(trend.totalSales)),
            borderColor: '#3B82F6',
            fill: false,
            tension: 0.4,
          },
          {
            label: `${t.totalOrders} (${t.totalValue})`,
            data: orderAnalytics.orderTrends.map((trend) => safeNumber(trend.totalValue)),
            borderColor: '#36A2EB',
            fill: false,
            tension: 0.4,
          },
        ],
      },
      salesVsReturns: {
        labels: analytics.salesTrends.map((trend) => trend.period),
        datasets: [
          {
            label: `${t.totalSales} (${t.currency})`,
            data: analytics.salesTrends.map((trend) => safeNumber(trend.totalSales)),
            borderColor: '#3B82F6',
            fill: false,
            tension: 0.4,
          },
          {
            label: `${t.totalReturns} (${t.totalValue})`,
            data: returnAnalytics.returnTrends.map((trend) => safeNumber(trend.totalValue)),
            borderColor: '#FF6384',
            fill: false,
            tension: 0.4,
          },
        ],
      },
      ordersVsReturns: {
        labels: orderAnalytics.orderTrends.map((trend) => trend.period),
        datasets: [
          {
            label: `${t.totalOrders} (${t.totalValue})`,
            data: orderAnalytics.orderTrends.map((trend) => safeNumber(trend.totalValue)),
            borderColor: '#36A2EB',
            fill: false,
            tension: 0.4,
          },
          {
            label: `${t.totalReturns} (${t.totalValue})`,
            data: returnAnalytics.returnTrends.map((trend) => safeNumber(trend.totalValue)),
            borderColor: '#FF6384',
            fill: false,
            tension: 0.4,
          },
        ],
      },
    };
  }, [filteredData, t, analytics, orderAnalytics, returnAnalytics]);

  if (user?.role !== 'admin' && user?.role !== 'production') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-xs text-red-600 font-alexandria">{t.errors.unauthorized_access}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 font-alexandria  mx-auto" >
      <link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <header className="mb-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-5 h-5 text-amber-600" />
          <div>
            <h1 className="text-lg font-semibold text-gray-800">{t.title}</h1>
            <p className="text-xs text-gray-500">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row justify-center  align-center items-center gap-3">
          <ProductSearchInput
            value={searchTerm}
            onChange={(e) => debouncedSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            ariaLabel={t.searchPlaceholder}
          />
          <ProductDropdown
            value={selectedBranch}
            onChange={setSelectedBranch}
            options={branchOptions}
            ariaLabel={t.branchFilterPlaceholder}
          />
          <div className=" flex flex-col md:flex-row justify-center  align-center items-center ">
            <label className="block text-xs text-gray-700 font-alexandria mb-1">{t.startDate}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full py-1.5 px-3 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent bg-white shadow-sm hover:shadow-md transition-all duration-300 font-alexandria"
              aria-label={t.startDate}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-700 font-alexandria mb-1">{t.endDate}</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full py-1.5 px-3 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent bg-white shadow-sm hover:shadow-md transition-all duration-300 font-alexandria"
              aria-label={t.endDate}
            />
          </div>
        </div>
      </header>
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-xs text-red-600 font-alexandria">{error}</span>
        </motion.div>
      )}
      <div className="flex mb-4 border-b  flex-row  justify-center md:justify-start  align-center items-center md:items-start   border-gray-200">
        {['sales', 'orders', 'returns', 'trends'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as 'sales' | 'orders' | 'returns' | 'trends')}
            className={`py-2 px-4 text-sm font-medium ${activeTab === tab ? 'border-b-2 border-amber-600 text-amber-600' : 'text-gray-600 hover:text-amber-600'} transition-colors duration-200 font-alexandria`}
          >
            {t[`${tab}Tab`]}
          </button>
        ))}
      </div>
      {loading ? (
        <AnalyticsSkeleton />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {activeTab === 'sales' && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 ">
              <div className="grid  gap-4 col-span-2 lg:col-span-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                  <h4 className="text-xs text-gray-600 mb-1 font-alexandria">{t.totalSales}</h4>
                  <p className="text-lg font-bold font-alexandria">{analytics.totalSales.toFixed(2)} {t.currency}</p>
                </div>
                <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                  <h4 className="text-xs text-gray-600 mb-1 font-alexandria">{t.totalCount}</h4>
                  <p className="text-lg font-bold font-alexandria">{analytics.totalCount}</p>
                </div>
                <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                  <h4 className="text-xs text-gray-600 mb-1 font-alexandria">{t.averageOrderValue}</h4>
                  <p className="text-lg font-bold font-alexandria">{analytics.averageOrderValue.toFixed(2)} {t.currency}</p>
                </div>
                <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                  <h4 className="text-xs text-gray-600 mb-1 font-alexandria">{t.topProduct}</h4>
                  <p className="text-lg font-bold font-alexandria">{analytics.topProduct.displayName}</p>
                </div>
              </div>
              <div className="col-span-1 md:col-span-2 p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.salesTrends}</h3>
                {analytics.salesTrends.length > 0 ? (
                  <div className="h-64">
                    <Line data={chartData.salesTrends} options={{ ...getChartOptions(true), plugins: { ...getChartOptions(true).plugins, title: { text: t.salesTrends } } }} />
                  </div>
                ) : (
                  <NoDataMessage message={t.noData} />
                )}
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.productSales}</h3>
                {filteredData.productSales.length > 0 ? (
                  <div className="h-64">
                    <Bar data={chartData.productSales} options={{ ...getChartOptions(), plugins: { ...getChartOptions().plugins, title: { text: t.productSales } } }} />
                  </div>
                ) : (
                  <NoDataMessage message={t.noData} />
                )}
                <DataTable
                  title={t.productSales}
                  data={filteredData.productSales}
                  columns={[
                    { key: 'displayName', label: isRtl ? 'المنتج' : 'Product', width: 'w-2/5' },
                    { key: 'totalRevenue', label: t.totalSales, width: 'w-1/5' },
                    { key: 'totalQuantity', label: t.totalCount, width: 'w-1/5' },
                  ]}
                  isRtl={isRtl}
                  currency={t.currency}
                  className="text-xs mt-4"
                />
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.leastProductSales}</h3>
                {filteredData.leastProductSales.length > 0 ? (
                  <div className="h-64">
                    <Bar data={chartData.leastProductSales} options={{ ...getChartOptions(), plugins: { ...getChartOptions().plugins, title: { text: t.leastProductSales } } }} />
                  </div>
                ) : (
                  <NoDataMessage message={t.noData} />
                )}
                <DataTable
                  title={t.leastProductSales}
                  data={filteredData.leastProductSales}
                  columns={[
                    { key: 'displayName', label: isRtl ? 'المنتج' : 'Product', width: 'w-2/5' },
                    { key: 'totalRevenue', label: t.totalSales, width: 'w-1/5' },
                    { key: 'totalQuantity', label: t.totalCount, width: 'w-1/5' },
                  ]}
                  isRtl={isRtl}
                  currency={t.currency}
                  className="text-xs mt-4"
                />
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.departmentSales}</h3>
                {filteredData.departmentSales.length > 0 ? (
                  <div className="h-64">
                    <Bar data={chartData.departmentSales} options={{ ...getChartOptions(), plugins: { ...getChartOptions().plugins, title: { text: t.departmentSales } } }} />
                  </div>
                ) : (
                  <NoDataMessage message={t.noData} />
                )}
                <DataTable
                  title={t.departmentSales}
                  data={filteredData.departmentSales}
                  columns={[
                    { key: 'displayName', label: isRtl ? 'القسم' : 'Department', width: 'w-2/5' },
                    { key: 'totalRevenue', label: t.totalSales, width: 'w-1/5' },
                    { key: 'totalQuantity', label: t.totalCount, width: 'w-1/5' },
                  ]}
                  isRtl={isRtl}
                  currency={t.currency}
                  className="text-xs mt-4"
                />
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.leastDepartmentSales}</h3>
                {filteredData.leastDepartmentSales.length > 0 ? (
                  <div className="h-64">
                    <Bar data={chartData.leastDepartmentSales} options={{ ...getChartOptions(), plugins: { ...getChartOptions().plugins, title: { text: t.leastDepartmentSales } } }} />
                  </div>
                ) : (
                  <NoDataMessage message={t.noData} />
                )}
                <DataTable
                  title={t.leastDepartmentSales}
                  data={filteredData.leastDepartmentSales}
                  columns={[
                    { key: 'displayName', label: isRtl ? 'القسم' : 'Department', width: 'w-2/5' },
                    { key: 'totalRevenue', label: t.totalSales, width: 'w-1/5' },
                    { key: 'totalQuantity', label: t.totalCount, width: 'w-1/5' },
                  ]}
                  isRtl={isRtl}
                  currency={t.currency}
                  className="text-xs mt-4"
                />
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.branchSales}</h3>
                {filteredData.branchSales.length > 0 ? (
                  <div className="h-64">
                    <Bar data={chartData.branchSales} options={{ ...getChartOptions(), plugins: { ...getChartOptions().plugins, title: { text: t.branchSales } } }} />
                  </div>
                ) : (
                  <NoDataMessage message={t.noData} />
                )}
                <DataTable
                  title={t.branchSales}
                  data={filteredData.branchSales}
                  columns={[
                    { key: 'displayName', label: isRtl ? 'الفرع' : 'Branch', width: 'w-1/6' },
                    { key: 'totalSales', label: t.totalSales, width: 'w-1/6' },
                    { key: 'saleCount', label: t.totalCount, width: 'w-1/6' },
                    { key: 'totalOrders', label: t.totalOrders, width: 'w-1/6' },
                    { key: 'totalReturns', label: t.totalReturns, width: 'w-1/6' },
                    { key: 'averageOrderValue', label: t.averageOrderValue, width: 'w-1/6' },
                  ]}
                  isRtl={isRtl}
                  currency={t.currency}
                  className="text-xs mt-4"
                />
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.leastBranchSales}</h3>
                {filteredData.leastBranchSales.length > 0 ? (
                  <div className="h-64">
                    <Bar data={chartData.leastBranchSales} options={{ ...getChartOptions(), plugins: { ...getChartOptions().plugins, title: { text: t.leastBranchSales } } }} />
                  </div>
                ) : (
                  <NoDataMessage message={t.noData} />
                )}
                <DataTable
                  title={t.leastBranchSales}
                  data={filteredData.leastBranchSales}
                  columns={[
                    { key: 'displayName', label: isRtl ? 'الفرع' : 'Branch', width: 'w-1/6' },
                    { key: 'totalSales', label: t.totalSales, width: 'w-1/6' },
                    { key: 'saleCount', label: t.totalCount, width: 'w-1/6' },
                    { key: 'totalOrders', label: t.totalOrders, width: 'w-1/6' },
                    { key: 'totalReturns', label: t.totalReturns, width: 'w-1/6' },
                    { key: 'averageOrderValue', label: t.averageOrderValue, width: 'w-1/6' },
                  ]}
                  isRtl={isRtl}
                  currency={t.currency}
                  className="text-xs mt-4"
                />
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100 col-span-1 md:col-span-2 lg:col-span-3">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.topCustomers}</h3>
                <DataTable
                  title={t.topCustomers}
                  data={analytics.topCustomers}
                  columns={[
                    { key: 'customerName', label: isRtl ? 'اسم العميل' : 'Customer Name', width: 'w-2/5' },
                    { key: 'customerPhone', label: isRtl ? 'رقم الهاتف' : 'Phone', width: 'w-1/5' },
                    { key: 'totalSpent', label: t.totalSales, width: 'w-1/5' },
                    { key: 'purchaseCount', label: isRtl ? 'عدد المشتريات' : 'Purchases', width: 'w-1/5' },
                  ]}
                  isRtl={isRtl}
                  currency={t.currency}
                  className="text-xs"
                />
              </div>
            </div>
          )}
          {activeTab === 'orders' && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="grid  gap-4 col-span-2 lg:col-span-3 sm:grid-cols-3">
                <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                  <h4 className="text-xs text-gray-600 mb-1 font-alexandria">{t.totalOrders}</h4>
                  <p className="text-lg font-bold font-alexandria">{orderAnalytics.totalOrders}</p>
                </div>
                <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                  <h4 className="text-xs text-gray-600 mb-1 font-alexandria">{t.totalValue}</h4>
                  <p className="text-lg font-bold font-alexandria">{orderAnalytics.totalValue.toFixed(2)} {t.currency}</p>
                </div>
                <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                  <h4 className="text-xs text-gray-600 mb-1 font-alexandria">{t.averageOrderValue}</h4>
                  <p className="text-lg font-bold font-alexandria">{orderAnalytics.averageOrderValue.toFixed(2)} {t.currency}</p>
                </div>
              </div>
              <div className="col-span-1 md:col-span-2  p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.orderTrends}</h3>
                {orderAnalytics.orderTrends.length > 0 ? (
                  <div className="h-64">
                    <Line data={chartData.orderTrends} options={{ ...getChartOptions(true), plugins: { ...getChartOptions(true).plugins, title: { text: t.orderTrends } } }} />
                  </div>
                ) : (
                  <NoDataMessage message={t.noData} />
                )}
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.branchOrders}</h3>
                {filteredData.branchOrders.length > 0 ? (
                  <div className="h-64">
                    <Bar data={chartData.branchOrders} options={{ ...getChartOptions(), plugins: { ...getChartOptions().plugins, title: { text: t.branchOrders } } }} />
                  </div>
                ) : (
                  <NoDataMessage message={t.noData} />
                )}
                <DataTable
                  title={t.branchOrders}
                  data={filteredData.branchOrders}
                  columns={[
                    { key: 'displayName', label: isRtl ? 'الفرع' : 'Branch', width: 'w-1/4' },
                    { key: 'totalOrders', label: t.totalOrders, width: 'w-1/4' },
                    { key: 'totalValue', label: t.totalValue, width: 'w-1/4' },
                    { key: 'averageOrderValue', label: t.averageOrderValue, width: 'w-1/4' },
                  ]}
                  isRtl={isRtl}
                  currency={t.currency}
                  className="text-xs mt-4"
                />
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.leastBranchOrders}</h3>
                {filteredData.leastBranchOrders.length > 0 ? (
                  <div className="h-64">
                    <Bar data={chartData.leastBranchOrders} options={{ ...getChartOptions(), plugins: { ...getChartOptions().plugins, title: { text: t.leastBranchOrders } } }} />
                  </div>
                ) : (
                  <NoDataMessage message={t.noData} />
                )}
                <DataTable
                  title={t.leastBranchOrders}
                  data={filteredData.leastBranchOrders}
                  columns={[
                    { key: 'displayName', label: isRtl ? 'الفرع' : 'Branch', width: 'w-1/4' },
                    { key: 'totalOrders', label: t.totalOrders, width: 'w-1/4' },
                    { key: 'totalValue', label: t.totalValue, width: 'w-1/4' },
                    { key: 'averageOrderValue', label: t.averageOrderValue, width: 'w-1/4' },
                  ]}
                  isRtl={isRtl}
                  currency={t.currency}
                  className="text-xs mt-4"
                />
              </div>
            </div>
          )}
          {activeTab === 'returns' && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 ">
              <div className="grid  gap-4 col-span-2 lg:col-span-3 sm:grid-cols-3">
                <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                  <h4 className="text-xs text-gray-600 mb-1 font-alexandria">{t.totalReturns}</h4>
                  <p className="text-lg font-bold font-alexandria">{returnAnalytics.totalReturns}</p>
                </div>
                <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                  <h4 className="text-xs text-gray-600 mb-1 font-alexandria">{t.totalValue}</h4>
                  <p className="text-lg font-bold font-alexandria">{returnAnalytics.totalValue.toFixed(2)} {t.currency}</p>
                </div>
                <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                  <h4 className="text-xs text-gray-600 mb-1 font-alexandria">{t.averageReturnValue}</h4>
                  <p className="text-lg font-bold font-alexandria">{returnAnalytics.averageReturnValue.toFixed(2)} {t.currency}</p>
                </div>
              </div>
              <div className="col-span-1 md:col-span-2 lg:col-span-3 p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.returnTrends}</h3>
                {returnAnalytics.returnTrends.length > 0 ? (
                  <div className="h-64">
                    <Line data={chartData.returnTrends} options={{ ...getChartOptions(true), plugins: { ...getChartOptions(true).plugins, title: { text: t.returnTrends } } }} />
                  </div>
                ) : (
                  <NoDataMessage message={t.noData} />
                )}
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.branchReturns}</h3>
                {filteredData.branchReturns.length > 0 ? (
                  <div className="h-64">
                    <Bar data={chartData.branchReturns} options={{ ...getChartOptions(), plugins: { ...getChartOptions().plugins, title: { text: t.branchReturns } } }} />
                  </div>
                ) : (
                  <NoDataMessage message={t.noData} />
                )}
                <DataTable
                  title={t.branchReturns}
                  data={filteredData.branchReturns}
                  columns={[
                    { key: 'displayName', label: isRtl ? 'الفرع' : 'Branch', width: 'w-1/4' },
                    { key: 'totalReturns', label: t.totalReturns, width: 'w-1/4' },
                    { key: 'totalValue', label: t.totalValue, width: 'w-1/4' },
                    { key: 'averageReturnValue', label: t.averageReturnValue, width: 'w-1/4' },
                  ]}
                  isRtl={isRtl}
                  currency={t.currency}
                  className="text-xs mt-4"
                />
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.leastBranchReturns}</h3>
                {filteredData.leastBranchReturns.length > 0 ? (
                  <div className="h-64">
                    <Bar data={chartData.leastBranchReturns} options={{ ...getChartOptions(), plugins: { ...getChartOptions().plugins, title: { text: t.leastBranchReturns } } }} />
                  </div>
                ) : (
                  <NoDataMessage message={t.noData} />
                )}
                <DataTable
                  title={t.leastBranchReturns}
                  data={filteredData.leastBranchReturns}
                  columns={[
                    { key: 'displayName', label: isRtl ? 'الفرع' : 'Branch', width: 'w-1/4' },
                    { key: 'totalReturns', label: t.totalReturns, width: 'w-1/4' },
                    { key: 'totalValue', label: t.totalValue, width: 'w-1/4' },
                    { key: 'averageReturnValue', label: t.averageReturnValue, width: 'w-1/4' },
                  ]}
                  isRtl={isRtl}
                  currency={t.currency}
                  className="text-xs mt-4"
                />
              </div>
            </div>
          )}
          {activeTab === 'trends' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-1">
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.salesTrends}</h3>
                {analytics.salesTrends.length > 0 ? (
                  <div className="h-64">
                    <Line data={chartData.salesTrends} options={{ ...getChartOptions(true), plugins: { ...getChartOptions(true).plugins, title: { text: t.salesTrends } } }} />
                  </div>
                ) : (
                  <NoDataMessage message={t.noData} />
                )}
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.orderTrends}</h3>
                {orderAnalytics.orderTrends.length > 0 ? (
                  <div className="h-64">
                    <Line data={chartData.orderTrends} options={{ ...getChartOptions(true), plugins: { ...getChartOptions(true).plugins, title: { text: t.orderTrends } } }} />
                  </div>
                ) : (
                  <NoDataMessage message={t.noData} />
                )}
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.returnTrends}</h3>
                {returnAnalytics.returnTrends.length > 0 ? (
                  <div className="h-64">
                    <Line data={chartData.returnTrends} options={{ ...getChartOptions(true), plugins: { ...getChartOptions(true).plugins, title: { text: t.returnTrends } } }} />
                  </div>
                ) : (
                  <NoDataMessage message={t.noData} />
                )}
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.comparisons}</h3>
                {analytics.salesTrends.length > 0 ? (
                  <div className="h-64">
                    <Line data={chartData.combinedTrends} options={{ ...getChartOptions(true), plugins: { ...getChartOptions(true).plugins, title: { text: t.comparisons } } }} />
                  </div>
                ) : (
                  <NoDataMessage message={t.noData} />
                )}
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 ">
                <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                  <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.totalSalesVsOrders}</h3>
                  {analytics.salesTrends.length > 0 ? (
                    <div className="h-64">
                      <Line data={chartData.salesVsOrders} options={{ ...getChartOptions(true), plugins: { ...getChartOptions(true).plugins, title: { text: t.totalSalesVsOrders } } }} />
                    </div>
                  ) : (
                    <NoDataMessage message={t.noData} />
                  )}
                </div>
                <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                  <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.salesVsReturns}</h3>
                  {analytics.salesTrends.length > 0 ? (
                    <div className="h-64">
                      <Line data={chartData.salesVsReturns} options={{ ...getChartOptions(true), plugins: { ...getChartOptions(true).plugins, title: { text: t.salesVsReturns } } }} />
                    </div>
                  ) : (
                    <NoDataMessage message={t.noData} />
                  )}
                </div>
                <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                  <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.ordersVsReturns}</h3>
                  {orderAnalytics.orderTrends.length > 0 ? (
                    <div className="h-64">
                      <Line data={chartData.ordersVsReturns} options={{ ...getChartOptions(true), plugins: { ...getChartOptions(true).plugins, title: { text: t.ordersVsReturns } } }} />
                    </div>
                  ) : (
                    <NoDataMessage message={t.noData} />
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default ReportsAnalytics;