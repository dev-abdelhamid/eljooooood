import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { salesAPI, branchesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, BarChart2, Search, ChevronDown } from 'lucide-react';
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

interface Branch {
  _id: string;
  name: string;
  nameEn?: string;
  displayName: string;
}

interface Department {
  _id: string;
  name: string;
  nameEn?: string;
  displayName: string;
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
    branchFilterPlaceholder: 'كل الفروع',
    departmentFilterPlaceholder: 'كل الأقسام',
    noAnalytics: 'لا توجد إحصائيات متاحة',
    noData: 'لا توجد بيانات',
    noCustomers: 'لا توجد عملاء',
    startDate: 'تاريخ البدء',
    endDate: 'تاريخ الانتهاء',
    resetFilters: 'إعادة تعيين الفلاتر',
    errors: {
      unauthorized_access: 'غير مصرح لك بالوصول',
      fetch_analytics: 'خطأ أثناء جلب الإحصائيات',
      network_error: 'خطأ في الاتصال بالشبكة',
      invalid_data: 'بيانات غير صالحة من الخادم',
      invalid_dates: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية',
      fetch_branches: 'خطأ أثناء جلب الفروع',
      fetch_departments: 'خطأ أثناء جلب الأقسام',
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
    branchFilterPlaceholder: 'All Branches',
    departmentFilterPlaceholder: 'All Departments',
    noAnalytics: 'No analytics available',
    noData: 'No data available',
    noCustomers: 'No customers',
    startDate: 'Start Date',
    endDate: 'End Date',
    resetFilters: 'Reset Filters',
    errors: {
      unauthorized_access: 'You are not authorized to access',
      fetch_analytics: 'Error fetching analytics',
      network_error: 'Network connection error',
      invalid_data: 'Invalid data from server',
      invalid_dates: 'Start date must be before end date',
      fetch_branches: 'Error fetching branches',
      fetch_departments: 'Error fetching departments',
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
  <div className="space-y-6 animate-pulse">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(3)].map((_, index) => (
        <div key={index} className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
          <div className="h-6 bg-gray-200 rounded w-1/2" />
        </div>
      ))}
    </div>
    <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
      <div className="h-64 bg-gray-200 rounded" />
    </div>
  </div>
));

const NoDataMessage: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-8 text-gray-500">
    <BarChart2 className="w-12 h-12 text-gray-400 mb-2" />
    <p className="text-sm font-alexandria">{message}</p>
  </div>
);

const SearchInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
}> = React.memo(({ value, onChange }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="relative w-full max-w-xs">
      <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400`} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={translations[language].searchPlaceholder}
        className={`w-full py-2.5 px-4 ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm transition-all duration-200 font-alexandria`}
      />
    </div>
  );
});

const Dropdown: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}> = React.memo(({ value, onChange, options, placeholder }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative w-full max-w-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full py-2.5 px-4 ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm transition-all duration-200 flex items-center justify-between font-alexandria`}
      >
        <span className="truncate">{value ? options.find((opt) => opt.value === value)?.label : placeholder}</span>
        <ChevronDown className="w-5 h-5 text-gray-400" />
      </button>
      {isOpen && (
        <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
          {options.map((option) => (
            <div
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className="px-4 py-2 text-sm cursor-pointer hover:bg-amber-100 transition-colors duration-150 font-alexandria"
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

const DataTable: React.FC<{
  title: string;
  data: any[];
  columns: { key: string; label: string; width?: string }[];
  isRtl: boolean;
  currency?: string;
}> = React.memo(({ title, data, columns, isRtl, currency }) => (
  <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
    <h3 className="text-base font-semibold text-gray-800 mb-4 font-alexandria">{title}</h3>
    {data.length > 0 ? (
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-max">
          <thead>
            <tr className="bg-gray-50">
              {columns.map((col) => (
                <th key={col.key} className={`p-3 ${isRtl ? 'text-right' : 'text-left'} ${col.width || ''} text-gray-600 font-medium font-alexandria`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index} className="border-t border-gray-100 hover:bg-gray-50 transition-colors duration-150">
                {columns.map((col) => (
                  <td key={col.key} className={`p-3 ${col.width || ''} font-alexandria`}>
                    {col.key === 'totalSales' || col.key === 'averageOrderValue' || col.key === 'totalRevenue'
                      ? `${safeNumber(item[col.key]).toFixed(2)} ${currency || ''}`
                      : safeNumber(item[col.key]) || item[col.key] || '-'}
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
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useCallback(debounce((value: string) => setSearchTerm(value.trim().toLowerCase()), 300), []);

  const fetchBranches = useCallback(async () => {
    try {
      const response = await branchesAPI.getAll();
      if (!response?.branches || !Array.isArray(response.branches)) {
        throw new Error(t.errors.invalid_data);
      }
      const branchList = response.branches.map((b: any) => ({
        _id: safeString(b._id),
        name: safeString(b.name),
        nameEn: safeString(b.nameEn),
        displayName: isRtl ? safeString(b.name, 'فرع غير معروف') : safeString(b.nameEn || b.name, 'Unknown Branch'),
      }));
      setBranches(branchList);
      if (branchList.length > 0 && !selectedBranch) {
        setSelectedBranch(branchList[0]._id);
      }
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Branch fetch error:`, { message: err.message, stack: err.stack });
      setError(t.errors.fetch_branches);
      toast.error(t.errors.fetch_branches, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
      setBranches([]);
    }
  }, [isRtl, t, selectedBranch]);

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await salesAPI.getDepartments(); // Assume API endpoint for departments
      if (!response?.departments || !Array.isArray(response.departments)) {
        throw new Error(t.errors.invalid_data);
      }
      const departmentList = response.departments.map((d: any) => ({
        _id: safeString(d._id),
        name: safeString(d.name),
        nameEn: safeString(d.nameEn),
        displayName: isRtl ? safeString(d.name, 'قسم غير معروف') : safeString(d.nameEn || d.name, 'Unknown Department'),
      }));
      setDepartments(departmentList);
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Department fetch error:`, { message: err.message, stack: err.stack });
      setError(t.errors.fetch_departments);
      toast.error(t.errors.fetch_departments, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
      setDepartments([]);
    }
  }, [isRtl, t]);

  useEffect(() => {
    fetchBranches();
    fetchDepartments();
  }, [fetchBranches, fetchDepartments]);

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
        branch: selectedBranch || undefined,
        department: selectedDepartment || undefined,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        lang: language,
        search: searchTerm || undefined,
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
        })).sort((a, b) => b.totalSales - a.totalSales),
        leastBranchSales: (response.leastBranchSales || []).map((bs: any) => ({
          branchId: safeString(bs.branchId),
          branchName: safeString(bs.branchName),
          branchNameEn: safeString(bs.branchNameEn),
          displayName: isRtl ? safeString(bs.branchName, 'فرع غير معروف') : safeString(bs.branchNameEn || bs.branchName, 'Unknown Branch'),
          totalSales: safeNumber(bs.totalSales),
          saleCount: safeNumber(bs.saleCount),
          averageOrderValue: safeNumber(bs.averageOrderValue),
        })).sort((a, b) => a.totalSales - b.totalSales),
        productSales: (response.productSales || []).map((ps: any) => ({
          productId: safeString(ps.productId),
          productName: safeString(ps.productName),
          productNameEn: safeString(ps.productNameEn),
          displayName: isRtl ? safeString(ps.productName, 'منتج محذوف') : safeString(ps.productNameEn || ps.productName, 'Deleted Product'),
          totalQuantity: safeNumber(ps.totalQuantity),
          totalRevenue: safeNumber(ps.totalRevenue),
        })).sort((a, b) => b.totalRevenue - a.totalRevenue),
        leastProductSales: (response.leastProductSales || []).map((ps: any) => ({
          productId: safeString(ps.productId),
          productName: safeString(ps.productName),
          productNameEn: safeString(ps.productNameEn),
          displayName: isRtl ? safeString(ps.productName, 'منتج محذوف') : safeString(ps.productNameEn || ps.productName, 'Deleted Product'),
          totalQuantity: safeNumber(ps.totalQuantity),
          totalRevenue: safeNumber(ps.totalRevenue),
        })).sort((a, b) => a.totalRevenue - b.totalRevenue),
        departmentSales: (response.departmentSales || []).map((ds: any) => ({
          departmentId: safeString(ds.departmentId),
          departmentName: safeString(ds.departmentName),
          departmentNameEn: safeString(ds.departmentNameEn),
          displayName: isRtl ? safeString(ds.departmentName, 'قسم غير معروف') : safeString(ds.departmentNameEn || ds.departmentName, 'Unknown Department'),
          totalRevenue: safeNumber(ds.totalRevenue),
          totalQuantity: safeNumber(ds.totalQuantity),
        })).sort((a, b) => b.totalRevenue - a.totalRevenue),
        leastDepartmentSales: (response.leastDepartmentSales || []).map((ds: any) => ({
          departmentId: safeString(ds.departmentId),
          departmentName: safeString(ds.departmentName),
          departmentNameEn: safeString(ds.departmentNameEn),
          displayName: isRtl ? safeString(ds.departmentName, 'قسم غير معروف') : safeString(ds.departmentNameEn || ds.departmentName, 'Unknown Department'),
          totalRevenue: safeNumber(ds.totalRevenue),
          totalQuantity: safeNumber(ds.totalQuantity),
        })).sort((a, b) => a.totalRevenue - b.totalRevenue),
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
  }, [user, t, isRtl, language, startDate, endDate, selectedBranch, selectedDepartment, searchTerm]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const resetFilters = useCallback(() => {
    setSelectedBranch('');
    setSelectedDepartment('');
    setSearchTerm('');
    setStartDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setEndDate(new Date().toISOString().split('T')[0]);
  }, []);

  const filteredData = useMemo(() => ({
    productSales: analytics.productSales.filter((ps) => ps.displayName.toLowerCase().includes(searchTerm) && (!selectedDepartment || ps.departmentId === selectedDepartment)),
    leastProductSales: analytics.leastProductSales.filter((ps) => ps.displayName.toLowerCase().includes(searchTerm) && (!selectedDepartment || ps.departmentId === selectedDepartment)),
    departmentSales: analytics.departmentSales.filter((ds) => ds.displayName.toLowerCase().includes(searchTerm)),
    leastDepartmentSales: analytics.leastDepartmentSales.filter((ds) => ds.displayName.toLowerCase().includes(searchTerm)),
    branchSales: analytics.branchSales.filter((bs) => bs.displayName.toLowerCase().includes(searchTerm) && (!selectedBranch || bs.branchId === selectedBranch)),
    leastBranchSales: analytics.leastBranchSales.filter((bs) => bs.displayName.toLowerCase().includes(searchTerm) && (!selectedBranch || bs.branchId === selectedBranch)),
  }), [analytics, searchTerm, selectedDepartment, selectedBranch]);

  const branchOptions = useMemo(
    () => [
      { value: '', label: t.branchFilterPlaceholder },
      ...branches.map((b) => ({ value: b._id, label: b.displayName })),
    ],
    [branches, t]
  );

  const departmentOptions = useMemo(
    () => [
      { value: '', label: t.departmentFilterPlaceholder },
      ...departments.map((d) => ({ value: d._id, label: d.displayName })),
    ],
    [departments, t]
  );

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const, labels: { font: { size: 12, family: 'Alexandria' } } },
      tooltip: { bodyFont: { size: 12, family: 'Alexandria' }, padding: 10 },
      title: { display: true, font: { size: 14, family: 'Alexandria' }, padding: 12 },
    },
    scales: {
      x: { ticks: { font: { size: 10, family: 'Alexandria' }, maxRotation: isRtl ? -45 : 45, autoSkip: true }, reverse: isRtl },
      y: { ticks: { font: { size: 10, family: 'Alexandria' } }, beginAtZero: true, reverse: isRtl },
    },
  }), [isRtl]);

  const chartData = useMemo(() => ({
    productSales: {
      labels: filteredData.productSales.slice(0, 5).map((p) => p.displayName),
      datasets: [{ label: `${t.totalSales} (${t.currency})`, data: filteredData.productSales.slice(0, 5).map((p) => safeNumber(p.totalRevenue)), backgroundColor: '#FBBF24', borderRadius: 4 }],
    },
    leastProductSales: {
      labels: filteredData.leastProductSales.slice(0, 5).map((p) => p.displayName),
      datasets: [{ label: `${t.totalSales} (${t.currency})`, data: filteredData.leastProductSales.slice(0, 5).map((p) => safeNumber(p.totalRevenue)), backgroundColor: '#3B82F6', borderRadius: 4 }],
    },
    departmentSales: {
      labels: filteredData.departmentSales.slice(0, 5).map((d) => d.displayName),
      datasets: [{ label: `${t.totalSales} (${t.currency})`, data: filteredData.departmentSales.slice(0, 5).map((d) => safeNumber(d.totalRevenue)), backgroundColor: '#FF6384', borderRadius: 4 }],
    },
    leastDepartmentSales: {
      labels: filteredData.leastDepartmentSales.slice(0, 5).map((d) => d.displayName),
      datasets: [{ label: `${t.totalSales} (${t.currency})`, data: filteredData.leastDepartmentSales.slice(0, 5).map((d) => safeNumber(d.totalRevenue)), backgroundColor: '#4BC0C0', borderRadius: 4 }],
    },
    branchSales: {
      labels: filteredData.branchSales.slice(0, 5).map((b) => b.displayName),
      datasets: [{ label: `${t.totalSales} (${t.currency})`, data: filteredData.branchSales.slice(0, 5).map((b) => safeNumber(b.totalSales)), backgroundColor: '#9966FF', borderRadius: 4 }],
    },
    leastBranchSales: {
      labels: filteredData.leastBranchSales.slice(0, 5).map((b) => b.displayName),
      datasets: [{ label: `${t.totalSales} (${t.currency})`, data: filteredData.leastBranchSales.slice(0, 5).map((b) => safeNumber(b.totalSales)), backgroundColor: '#FBBF24', borderRadius: 4 }],
    },
    salesTrends: {
      labels: analytics.salesTrends.slice(0, 10).map((trend) => trend.period),
      datasets: [
        { label: `${t.totalSales} (${t.currency})`, data: analytics.salesTrends.slice(0, 10).map((trend) => safeNumber(trend.totalSales)), borderColor: '#3B82F6', fill: false, tension: 0.4 },
        { label: t.totalCount, data: analytics.salesTrends.slice(0, 10).map((trend) => safeNumber(trend.saleCount)), borderColor: '#FBBF24', fill: false, tension: 0.4 },
      ],
    },
  }), [filteredData, t, analytics]);

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <span className="text-red-600 text-base font-alexandria">{t.errors.unauthorized_access}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50 font-alexandria" dir={isRtl ? 'rtl' : 'ltr'}>
      <link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600&display=swap" rel="stylesheet" />
      <header className="mb-6 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
        <div className="flex items-center gap-4">
          <BarChart2 className="w-8 h-8 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{t.title}</h1>
            <p className="text-sm text-gray-500">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
          <SearchInput value={searchTerm} onChange={debouncedSearch} />
          <div className="flex gap-4 flex-col sm:flex-row">
            <Dropdown value={selectedBranch} onChange={setSelectedBranch} options={branchOptions} placeholder={t.branchFilterPlaceholder} />
            <Dropdown value={selectedDepartment} onChange={setSelectedDepartment} options={departmentOptions} placeholder={t.departmentFilterPlaceholder} />
          </div>
          <div className="flex gap-4 flex-col sm:flex-row">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t.startDate}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full max-w-xs py-2.5 px-4 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm transition-all duration-200 font-alexandria"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t.endDate}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full max-w-xs py-2.5 px-4 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm transition-all duration-200 font-alexandria"
              />
            </div>
          </div>
          <button
            onClick={resetFilters}
            className="py-2.5 px-4 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors duration-200 font-alexandria"
          >
            {t.resetFilters}
          </button>
        </div>
      </header>
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <span className="text-base text-red-600 font-alexandria">{error}</span>
        </div>
      )}
      {loading ? (
        <AnalyticsSkeleton />
      ) : !analytics ? (
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 text-center">
          <NoDataMessage message={t.noAnalytics} />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-base font-semibold text-gray-800 mb-2 font-alexandria">{t.totalSales}</h3>
              <p className="text-2xl font-bold text-amber-600">{analytics.totalSales.toFixed(2)} {t.currency}</p>
              <p className="text-sm text-gray-500 mt-1">{t.totalCount}: {analytics.totalCount}</p>
            </div>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-base font-semibold text-gray-800 mb-2 font-alexandria">{t.averageOrderValue}</h3>
              <p className="text-2xl font-bold text-amber-600">{analytics.averageOrderValue.toFixed(2)} {t.currency}</p>
            </div>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-base font-semibold text-gray-800 mb-2 font-alexandria">{t.topProduct}</h3>
              {analytics.topProduct?.productId ? (
                <div className="mt-2 space-y-1">
                  <p className="text-base font-medium">{analytics.topProduct.displayName}</p>
                  <p className="text-sm text-gray-500">{t.totalSales}: {analytics.topProduct.totalRevenue.toFixed(2)} {t.currency}</p>
                  <p className="text-sm text-gray-500">{t.totalCount}: {analytics.topProduct.totalQuantity}</p>
                </div>
              ) : (
                <NoDataMessage message={t.noData} />
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-base font-semibold text-gray-800 mb-4 font-alexandria">{t.salesTrends}</h3>
              {analytics.salesTrends.length > 0 ? (
                <div className="h-80">
                  <Line data={chartData.salesTrends} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.salesTrends } } }} />
                </div>
              ) : (
                <NoDataMessage message={t.noData} />
              )}
            </div>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-base font-semibold text-gray-800 mb-4 font-alexandria">{t.topCustomers}</h3>
              {analytics.topCustomers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'} text-gray-600 font-medium font-alexandria`}>{t.topCustomers}</th>
                        <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'} text-gray-600 font-medium font-alexandria`}>{t.totalSales}</th>
                        <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'} text-gray-600 font-medium font-alexandria`}>{t.totalCount}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.topCustomers.map((customer, index) => (
                        <tr key={index} className="border-t border-gray-100 hover:bg-gray-50 transition-colors duration-150">
                          <td className="p-3 font-alexandria">{customer.customerName || t.noCustomers}</td>
                          <td className="p-3 font-alexandria">{customer.totalSpent.toFixed(2)} {t.currency}</td>
                          <td className="p-3 font-alexandria">{customer.purchaseCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <NoDataMessage message={t.noCustomers} />
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
                <h3 className="text-base font-semibold text-gray-800 mb-4 font-alexandria">{t.branchSales}</h3>
                {filteredData.branchSales.length > 0 ? (
                  <div className="h-64">
                    <Bar data={chartData.branchSales} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.branchSales } } }} />
                  </div>
                ) : (
                  <NoDataMessage message={t.noData} />
                )}
                <DataTable
                  title={t.branchSales}
                  data={filteredData.branchSales}
                  columns={[
                    { key: 'displayName', label: isRtl ? 'الفرع' : 'Branch', width: 'w-1/4' },
                    { key: 'totalSales', label: t.totalSales, width: 'w-1/4' },
                    { key: 'saleCount', label: t.totalCount, width: 'w-1/4' },
                    { key: 'averageOrderValue', label: t.averageOrderValue, width: 'w-1/4' },
                  ]}
                  isRtl={isRtl}
                  currency={t.currency}
                />
              </div>
              <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-base font-semibold text-gray-800 mb-4 font-alexandria">{t.leastBranchSales}</h3>
                {filteredData.leastBranchSales.length > 0 ? (
                  <div className="h-64">
                    <Bar data={chartData.leastBranchSales} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.leastBranchSales } } }} />
                  </div>
                ) : (
                  <NoDataMessage message={t.noData} />
                )}
                <DataTable
                  title={t.leastBranchSales}
                  data={filteredData.leastBranchSales}
                  columns={[
                    { key: 'displayName', label: isRtl ? 'الفرع' : 'Branch', width: 'w-1/4' },
                    { key: 'totalSales', label: t.totalSales, width: 'w-1/4' },
                    { key: 'saleCount', label: t.totalCount, width: 'w-1/4' },
                    { key: 'averageOrderValue', label: t.averageOrderValue, width: 'w-1/4' },
                  ]}
                  isRtl={isRtl}
                  currency={t.currency}
                />
              </div>
            </div>
            <div>
              <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
                <h3 className="text-base font-semibold text-gray-800 mb-4 font-alexandria">{t.departmentSales}</h3>
                {filteredData.departmentSales.length > 0 ? (
                  <div className="h-64">
                    <Bar data={chartData.departmentSales} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.departmentSales } } }} />
                  </div>
                ) : (
                  <NoDataMessage message={t.noData} />
                )}
                <DataTable
                  title={t.departmentSales}
                  data={filteredData.departmentSales}
                  columns={[
                    { key: 'displayName', label: isRtl ? 'القسم' : 'Department' },
                    { key: 'totalRevenue', label: t.totalSales, width: 'w-1/4' },
                    { key: 'totalQuantity', label: t.totalCount, width: 'w-1/4' },
                  ]}
                  isRtl={isRtl}
                  currency={t.currency}
                />
              </div>
              <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-base font-semibold text-gray-800 mb-4 font-alexandria">{t.leastDepartmentSales}</h3>
                {filteredData.leastDepartmentSales.length > 0 ? (
                  <div className="h-64">
                    <Bar data={chartData.leastDepartmentSales} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.leastDepartmentSales } } }} />
                  </div>
                ) : (
                  <NoDataMessage message={t.noData} />
                )}
                <DataTable
                  title={t.leastDepartmentSales}
                  data={filteredData.leastDepartmentSales}
                  columns={[
                    { key: 'displayName', label: isRtl ? 'القسم' : 'Department' },
                    { key: 'totalRevenue', label: t.totalSales, width: 'w-1/4' },
                    { key: 'totalQuantity', label: t.totalCount, width: 'w-1/4' },
                  ]}
                  isRtl={isRtl}
                  currency={t.currency}
                />
              </div>
            </div>
          </div>
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-base font-semibold text-gray-800 mb-4 font-alexandria">{t.productSales}</h3>
            {filteredData.productSales.length > 0 ? (
              <div className="h-64">
                <Bar data={chartData.productSales} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.productSales } } }} />
              </div>
            ) : (
              <NoDataMessage message={t.noData} />
            )}
            <DataTable
              title={t.productSales}
              data={filteredData.productSales}
              columns={[
                { key: 'displayName', label: isRtl ? 'المنتج' : 'Product' },
                { key: 'totalRevenue', label: t.totalSales, width: 'w-1/4' },
                { key: 'totalQuantity', label: t.totalCount, width: 'w-1/4' },
              ]}
              isRtl={isRtl}
              currency={t.currency}
            />
          </div>
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-base font-semibold text-gray-800 mb-4 font-alexandria">{t.leastProductSales}</h3>
            {filteredData.leastProductSales.length > 0 ? (
              <div className="h-64">
                <Bar data={chartData.leastProductSales} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.leastProductSales } } }} />
              </div>
            ) : (
              <NoDataMessage message={t.noData} />
            )}
            <DataTable
              title={t.leastProductSales}
              data={filteredData.leastProductSales}
              columns={[
                { key: 'displayName', label: isRtl ? 'المنتج' : 'Product' },
                { key: 'totalRevenue', label: t.totalSales, width: 'w-1/4' },
                { key: 'totalQuantity', label: t.totalCount, width: 'w-1/4' },
              ]}
              isRtl={isRtl}
              currency={t.currency}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(SalesAnalytics);