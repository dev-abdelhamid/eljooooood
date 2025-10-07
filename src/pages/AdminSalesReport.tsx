import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { branchesAPI, salesAPI, inventoryAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, DollarSign, Trash, Edit, Search, X, ChevronDown, Download } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { debounce } from 'lodash';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend);

interface Sale {
  _id: string;
  saleNumber: string;
  branch: { _id: string; name: string; nameEn?: string; displayName: string };
  items: Array<{
    productId: string;
    productName: string;
    productNameEn?: string;
    unit?: string;
    unitEn?: string;
    quantity: number;
    unitPrice: number;
    displayName: string;
    displayUnit: string;
    department?: { _id: string; name: string; nameEn?: string; displayName: string };
  }>;
  totalAmount: number;
  createdAt: string;
  notes?: string;
  paymentMethod?: string;
  customerName?: string;
  customerPhone?: string;
  returns?: Array<{
    _id: string;
    returnNumber: string;
    status: string;
    items: Array<{ productId: string; productName: string; productNameEn?: string; quantity: number; reason: string }>;
    reason: string;
    createdAt: string;
  }>;
}

interface Branch {
  _id: string;
  name: string;
  nameEn?: string;
  displayName: string;
}

interface InventoryItem {
  _id: string;
  productId: string;
  productName: string;
  productNameEn?: string;
  currentStock: number;
  branchId: string;
}

interface SalesAnalytics {
  branchSales: Array<{ branchId: string; branchName: string; branchNameEn?: string; displayName: string; totalSales: number; saleCount: number }>;
  productSales: Array<{ productId: string; productName: string; productNameEn?: string; displayName: string; totalQuantity: number; totalRevenue: number }>;
  departmentSales: Array<{ departmentId: string; departmentName: string; departmentNameEn?: string; displayName: string; totalRevenue: number; totalQuantity: number }>;
  totalSales: number;
  totalCount: number;
  topProduct: { productId: string | null; productName: string; productNameEn?: string; displayName: string; totalQuantity: number; totalRevenue: number };
  salesTrends: Array<{ period: string; totalSales: number; saleCount: number }>;
  topCustomers: Array<{ customerName: string; customerPhone: string; totalSpent: number; purchaseCount: number }>;
  paymentMethods: Array<{ paymentMethod: string; totalAmount: number; count: number }>;
  returnStats: Array<{ status: string; count: number; totalQuantity: number }>;
}

const translations = {
  ar: {
    title: 'تقرير المبيعات',
    subtitle: 'إدارة المبيعات وتحليل الأداء',
    filters: 'الفلاتر',
    salesTab: 'المبيعات',
    analyticsTab: 'الإحصائيات',
    branchSales: 'مبيعات الفروع',
    productSales: 'مبيعات المنتجات',
    departmentSales: 'مبيعات الأقسام',
    totalSales: 'إجمالي المبيعات',
    totalCount: 'عدد المبيعات',
    topProduct: 'المنتج الأكثر مبيعًا',
    salesTrends: 'اتجاهات المبيعات',
    topCustomers: 'أفضل العملاء',
    paymentMethodsLabel: 'طرق الدفع',
    returnStats: 'إحصائيات المرتجعات',
    previousSales: 'المبيعات السابقة',
    noSales: 'لا توجد مبيعات',
    date: 'التاريخ',
    returns: 'المرتجعات',
    return: 'مرتجع',
    reason: 'السبب',
    quantity: 'الكمية',
    stock: 'المخزون الحالي',
    searchPlaceholder: 'ابحث عن المبيعات...',
    loadMore: 'تحميل المزيد',
    editSale: 'تعديل المبيعة',
    deleteSale: 'حذف المبيعة',
    confirmDelete: 'هل أنت متأكد من حذف هذه المبيعة؟',
    filterBy: 'تصفية حسب',
    day: 'يوم',
    week: 'أسبوع',
    month: 'شهر',
    customRange: 'نطاق مخصص',
    exportReport: 'تصدير التقرير',
    errors: {
      unauthorized_access: 'غير مصرح لك بالوصول',
      fetch_sales: 'خطأ أثناء جلب المبيعات',
      fetch_branches: 'خطأ أثناء جلب الفروع',
      fetch_inventory: 'خطأ أثناء جلب المخزون',
      delete_sale_failed: 'فشل حذف المبيعة',
      invalid_sale_id: 'معرف المبيعة غير صالح',
      invalid_branch_id: 'معرف الفرع غير صالح',
      no_branches_available: 'لا توجد فروع متاحة',
      export_failed: 'فشل تصدير التقرير',
      path_not_found: 'المسار غير موجود',
    },
    currency: 'ريال',
    units: { default: 'غير محدد' },
    branches: { all_branches: 'كل الفروع', select_branch: 'اختر الفرع', unknown: 'غير معروف' },
    departments: { unknown: 'غير معروف' },
    paymentMethods: {
      cash: 'نقدي',
      card: 'بطاقة ائتمان',
      credit: 'آجل',
    },
    returns: { status: { pending: 'معلق', approved: 'مقبول', rejected: 'مرفوض' } },
  },
  en: {
    title: 'Sales Report',
    subtitle: 'Manage Sales and Analyze Performance',
    filters: 'Filters',
    salesTab: 'Sales',
    analyticsTab: 'Analytics',
    branchSales: 'Branch Sales',
    productSales: 'Product Sales',
    departmentSales: 'Department Sales',
    totalSales: 'Total Sales',
    totalCount: 'Total Sale Count',
    topProduct: 'Top Selling Product',
    salesTrends: 'Sales Trends',
    topCustomers: 'Top Customers',
    paymentMethodsLabel: 'Payment Methods',
    returnStats: 'Return Statistics',
    previousSales: 'Previous Sales',
    noSales: 'No sales found',
    date: 'Date',
    returns: 'Returns',
    return: 'Return',
    reason: 'Reason',
    quantity: 'Quantity',
    stock: 'Current Stock',
    searchPlaceholder: 'Search sales...',
    loadMore: 'Load More',
    editSale: 'Edit Sale',
    deleteSale: 'Delete Sale',
    confirmDelete: 'Are you sure you want to delete this sale?',
    filterBy: 'Filter By',
    day: 'Day',
    week: 'Week',
    month: 'Month',
    customRange: 'Custom Range',
    exportReport: 'Export Report',
    errors: {
      unauthorized_access: 'You are not authorized to access',
      fetch_sales: 'Error fetching sales',
      fetch_branches: 'Error fetching branches',
      fetch_inventory: 'Error fetching inventory',
      delete_sale_failed: 'Failed to delete sale',
      invalid_sale_id: 'Invalid sale ID',
      invalid_branch_id: 'Invalid branch ID',
      no_branches_available: 'No branches available',
      export_failed: 'Failed to export report',
      path_not_found: 'Path not found',
    },
    currency: 'SAR',
    units: { default: 'N/A' },
    branches: { all_branches: 'All Branches', select_branch: 'Select Branch', unknown: 'Unknown' },
    departments: { unknown: 'Unknown' },
    paymentMethods: {
      cash: 'Cash',
      card: 'Credit Card',
      credit: 'Credit',
    },
    returns: { status: { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' } },
  },
};

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
      <Search className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors group-focus-within:text-amber-500 ${value ? 'opacity-0' : 'opacity-100'}`} />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full ${isRtl ? 'pl-12 pr-4' : 'pr-12 pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={ariaLabel}
      />
      {value && (
        <button
          onClick={() => onChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>)}
          className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-amber-500 transition-colors`}
          aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
});

const Dropdown = React.memo<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}>(({ value, onChange, options, ariaLabel, disabled = false, className }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full ${isRtl ? 'text-right' : 'text-left'} py-2.5 px-4 border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300`}
        aria-label={ariaLabel}
      >
        <span>{options.find((opt) => opt.value === value)?.label || translations[language].branches.select_branch}</span>
        <ChevronDown className={`w-5 h-5 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full ${isRtl ? 'text-right' : 'text-left'} px-4 py-2 hover:bg-amber-50 text-sm transition-colors`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

const AdminSalesReport: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const t = translations[language];

  const [sales, setSales] = useState<Sale[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [analytics, setAnalytics] = useState<SalesAnalytics | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [filterPeriod, setFilterPeriod] = useState<string>('month');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalSales, setTotalSales] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'sales' | 'analytics'>('sales');

  const fetchBranches = useCallback(async () => {
    try {
      const response = await branchesAPI.getAll();
      const branchOptions = response.branches.map((branch: Branch) => ({
        ...branch,
        displayName: isRtl ? branch.name : (branch.nameEn || branch.name),
      }));
      setBranches([{ _id: '', name: t.branches.all_branches, displayName: t.branches.all_branches }, ...branchOptions]);
    } catch (err) {
      toast.error(t.errors.fetch_branches);
      console.error('Error fetching branches:', err);
    }
  }, [isRtl, t]);

  const fetchSales = useCallback(async (resetPage = false) => {
    setIsLoading(true);
    try {
      const currentPage = resetPage ? 1 : page;
      const params: any = { page: currentPage, limit: 20 };
      if (selectedBranch) params.branch = selectedBranch;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (searchQuery) params.search = searchQuery;
      params.lang = language;

      const response = await salesAPI.getAll(params);
      setSales((prev) => (resetPage ? response.sales : [...prev, ...response.sales]));
      setTotalSales(response.total);
      setPage(currentPage + 1);
    } catch (err) {
      toast.error(t.errors.fetch_sales);
      console.error('Error fetching sales:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranch, startDate, endDate, searchQuery, page, language, t]);

  const fetchInventory = useCallback(async () => {
    try {
      const params: any = {};
      if (selectedBranch) params.branch = selectedBranch;
      const response = await inventoryAPI.getAll(params);
      setInventory(response.inventory);
    } catch (err) {
      toast.error(t.errors.fetch_inventory);
      console.error('Error fetching inventory:', err);
    }
  }, [selectedBranch, t]);

  const fetchAnalytics = useCallback(async () => {
    if (user?.role !== 'admin') return;
    try {
      const params: any = {};
      if (selectedBranch) params.branch = selectedBranch;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      params.lang = language;

      const response = await salesAPI.getAnalytics(params);
      setAnalytics(response);
    } catch (err) {
      toast.error(t.errors.fetch_sales);
      console.error('Error fetching analytics:', err);
    }
  }, [selectedBranch, startDate, endDate, language, user?.role, t]);

  const debouncedFetchSales = useMemo(() => debounce(fetchSales, 300), [fetchSales]);

  useEffect(() => {
    fetchBranches();
    fetchInventory();
    if (user?.role === 'admin') fetchAnalytics();
  }, [fetchBranches, fetchInventory, fetchAnalytics, user?.role]);

  useEffect(() => {
    debouncedFetchSales(true);
  }, [selectedBranch, startDate, endDate, searchQuery, debouncedFetchSales]);

  const handleDeleteSale = useCallback(async (saleId: string) => {
    if (!window.confirm(t.confirmDelete)) return;
    try {
      await salesAPI.delete(saleId);
      setSales((prev) => prev.filter((sale) => sale._id !== saleId));
      toast.success(t.deleteSale);
      fetchInventory();
      if (user?.role === 'admin') fetchAnalytics();
    } catch (err) {
      toast.error(t.errors.delete_sale_failed);
      console.error('Error deleting sale:', err);
    }
  }, [t, fetchInventory, fetchAnalytics, user?.role]);

  const handleExportReport = useCallback(() => {
    try {
      const csvContent = [
        ['Sale Number', 'Branch', 'Date', 'Total Amount', 'Items', 'Customer Name', 'Customer Phone', 'Payment Method', 'Notes'],
        ...sales.map((sale) => [
          sale.saleNumber,
          sale.branch.displayName,
          sale.createdAt,
          sale.totalAmount,
          sale.items.map((item) => `${item.displayName} (${item.quantity} ${item.displayUnit})`).join('; '),
          sale.customerName || '',
          sale.customerPhone || '',
          t.paymentMethods[sale.paymentMethod as keyof typeof t.paymentMethods] || sale.paymentMethod,
          sale.notes || '',
        ]),
      ]
        .map((row) => row.map((cell) => `"${cell}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `sales_report_${new Date().toISOString().slice(0, 10)}.csv`);
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(t.errors.export_failed);
      console.error('Error exporting report:', err);
    }
  }, [sales, t]);

  const branchSalesData = useMemo(() => ({
    labels: analytics?.branchSales.map((bs) => bs.displayName) || [],
    datasets: [{
      label: t.totalSales,
      data: analytics?.branchSales.map((bs) => bs.totalSales) || [],
      backgroundColor: 'rgba(255, 167, 38, 0.6)',
      borderColor: 'rgba(255, 167, 38, 1)',
      borderWidth: 1,
    }],
  }), [analytics, t]);

  const productSalesData = useMemo(() => ({
    labels: analytics?.productSales.map((ps) => ps.displayName) || [],
    datasets: [{
      label: t.quantity,
      data: analytics?.productSales.map((ps) => ps.totalQuantity) || [],
      backgroundColor: 'rgba(255, 167, 38, 0.6)',
      borderColor: 'rgba(255, 167, 38, 1)',
      borderWidth: 1,
    }],
  }), [analytics, t]);

  const salesTrendsData = useMemo(() => ({
    labels: analytics?.salesTrends.map((st) => st.period) || [],
    datasets: [
      {
        label: t.totalSales,
        data: analytics?.salesTrends.map((st) => st.totalSales) || [],
        fill: false,
        borderColor: 'rgba(255, 167, 38, 1)',
        tension: 0.1,
      },
    ],
  }), [analytics, t]);

  const paymentMethodsData = useMemo(() => ({
    labels: analytics?.paymentMethods.map((pm) => t.paymentMethods[pm.paymentMethod as keyof typeof t.paymentMethods] || pm.paymentMethod) || [],
    datasets: [{
      data: analytics?.paymentMethods.map((pm) => pm.totalAmount) || [],
      backgroundColor: ['rgba(255, 167, 38, 0.6)', 'rgba(255, 99, 132, 0.6)', 'rgba(54, 162, 235, 0.6)'],
    }],
  }), [analytics, t]);

  return (
    <div className={`container mx-auto p-6 ${isRtl ? 'font-arabic' : 'font-sans'}`}>
      <h1 className="text-3xl font-bold mb-2">{t.title}</h1>
      <p className="text-gray-600 mb-6">{t.subtitle}</p>

      <div className="mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <Dropdown
            value={selectedBranch}
            onChange={setSelectedBranch}
            options={branches.map((b) => ({ value: b._id, label: b.displayName }))}
            ariaLabel={t.branches.select_branch}
            className="flex-1"
          />
          <select
            value={filterPeriod}
            onChange={(e) => {
              setFilterPeriod(e.target.value);
              const today = new Date();
              if (e.target.value === 'day') {
                setStartDate(today.toISOString().slice(0, 10));
                setEndDate(today.toISOString().slice(0, 10));
              } else if (e.target.value === 'week') {
                const weekAgo = new Date(today.setDate(today.getDate() - 7));
                setStartDate(weekAgo.toISOString().slice(0, 10));
                setEndDate(new Date().toISOString().slice(0, 10));
              } else if (e.target.value === 'month') {
                const monthAgo = new Date(today.setMonth(today.getMonth() - 1));
                setStartDate(monthAgo.toISOString().slice(0, 10));
                setEndDate(new Date().toISOString().slice(0, 10));
              } else {
                setStartDate('');
                setEndDate('');
              }
            }}
            className="flex-1 py-2.5 px-4 border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md"
          >
            <option value="day">{t.day}</option>
            <option value="week">{t.week}</option>
            <option value="month">{t.month}</option>
            <option value="custom">{t.customRange}</option>
          </select>
          {filterPeriod === 'custom' && (
            <>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 py-2.5 px-4 border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 py-2.5 px-4 border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md"
              />
            </>
          )}
        </div>
        <div className="mt-4">
          <SearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            ariaLabel={t.searchPlaceholder}
          />
        </div>
      </div>

      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('sales')}
          className={`px-4 py-2 ${activeTab === 'sales' ? 'border-b-2 border-amber-500 text-amber-500' : 'text-gray-600'} font-medium`}
        >
          {t.salesTab}
        </button>
        {user?.role === 'admin' && (
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 ${activeTab === 'analytics' ? 'border-b-2 border-amber-500 text-amber-500' : 'text-gray-600'} font-medium`}
          >
            {t.analyticsTab}
          </button>
        )}
      </div>

      {activeTab === 'sales' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">{t.previousSales}</h2>
            <button
              onClick={handleExportReport}
              className="flex items-center px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
            >
              <Download className="w-5 h-5 mr-2" />
              {t.exportReport}
            </button>
          </div>
          {sales.length === 0 && !isLoading ? (
            <p className="text-gray-600">{t.noSales}</p>
          ) : (
            <div className="space-y-4">
              {sales.map((sale) => (
                <div key={sale._id} className="border rounded-lg p-4 bg-white shadow-sm">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-semibold">{sale.saleNumber}</h3>
                      <p className="text-gray-600">{t.date}: {sale.createdAt}</p>
                      <p className="text-gray-600">{sale.branch.displayName}</p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => console.log('Edit sale:', sale._id)}
                        className="p-2 text-amber-500 hover:text-amber-600"
                        aria-label={t.editSale}
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      {user?.role === 'admin' && (
                        <button
                          onClick={() => handleDeleteSale(sale._id)}
                          className="p-2 text-red-500 hover:text-red-600"
                          aria-label={t.deleteSale}
                        >
                          <Trash className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-gray-600">
                      {t.totalSales}: {sale.totalAmount} {t.currency}
                    </p>
                    <p className="text-gray-600">{t.paymentMethods[sale.paymentMethod as keyof typeof t.paymentMethods] || sale.paymentMethod}</p>
                    {sale.customerName && <p className="text-gray-600">{t.customerName}: {sale.customerName}</p>}
                    {sale.customerPhone && <p className="text-gray-600">{t.customerPhone}: {sale.customerPhone}</p>}
                    {sale.notes && <p className="text-gray-600">{t.notes}: {sale.notes}</p>}
                  </div>
                  <div className="mt-4">
                    <h4 className="font-medium">{t.items}</h4>
                    <ul className="list-disc list-inside">
                      {sale.items.map((item, index) => (
                        <li key={index}>
                          {item.displayName} - {item.quantity} {item.displayUnit} @ {item.unitPrice} {t.currency}
                          <span className="ml-2 text-gray-600">
                            ({t.stock}: {inventory.find((inv) => inv.productId === item.productId && inv.branchId === sale.branch._id)?.currentStock || 'N/A'})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {sale.returns && sale.returns.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium">{t.returns}</h4>
                      <ul className="list-disc list-inside">
                        {sale.returns.map((ret) => (
                          <li key={ret._id}>
                            {ret.returnNumber} - {t.returns.status[ret.status as keyof typeof t.returns.status]}: {ret.items.map((item) => `${item.productName} (${item.quantity})`).join(', ')} ({t.reason}: {ret.reason})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {sales.length < totalSales && (
            <button
              onClick={() => fetchSales()}
              disabled={isLoading}
              className="mt-4 w-full py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Loading...' : t.loadMore}
            </button>
          )}
        </div>
      )}

      {activeTab === 'analytics' && user?.role === 'admin' && analytics && (
        <div className="space-y-8">
          <div>
            <h2 className="text-xl font-semibold mb-4">{t.branchSales}</h2>
            <Bar data={branchSalesData} options={{ responsive: true, plugins: { legend: { position: 'top' } } }} />
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-4">{t.productSales}</h2>
            <Bar data={productSalesData} options={{ responsive: true, plugins: { legend: { position: 'top' } } }} />
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-4">{t.salesTrends}</h2>
            <Line data={salesTrendsData} options={{ responsive: true, plugins: { legend: { position: 'top' } } }} />
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-4">{t.paymentMethodsLabel}</h2>
            <Pie data={paymentMethodsData} options={{ responsive: true, plugins: { legend: { position: 'top' } } }} />
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-4">{t.topProduct}</h2>
            <p>{analytics.topProduct.displayName}: {analytics.topProduct.totalQuantity} {t.units.default}, {analytics.topProduct.totalRevenue} {t.currency}</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-4">{t.topCustomers}</h2>
            <ul className="list-disc list-inside">
              {analytics.topCustomers.map((customer, index) => (
                <li key={index}>
                  {customer.customerName} ({customer.customerPhone}): {customer.totalSpent} {t.currency}, {customer.purchaseCount} {t.totalCount}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-4">{t.returnStats}</h2>
            <ul className="list-disc list-inside">
              {analytics.returnStats.map((stat, index) => (
                <li key={index}>
                  {t.returns.status[stat.status as keyof typeof t.returns.status]}: {stat.count} {t.totalCount}, {stat.totalQuantity} {t.quantity}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSalesReport;