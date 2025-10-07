import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { branchesAPI, salesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, DollarSign, Search, X, ChevronDown } from 'lucide-react';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import ReactECharts from 'echarts-for-react';
import Papa from 'papaparse';

interface Sale {
  _id: string;
  orderNumber: string;
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
}

interface Branch {
  _id: string;
  name: string;
  nameEn?: string;
  displayName: string;
}

interface SalesAnalytics {
  branchSales: Array<{
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
  departmentSales: Array<{
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
  paymentMethods: Array<{ paymentMethod: string; totalAmount: number; count: number }>;
}

const translations = {
  ar: {
    title: 'تقرير المبيعات',
    previousSales: 'المبيعات السابقة',
    analytics: 'إحصائيات المبيعات',
    productSales: 'مبيعات المنتجات',
    departmentSales: 'مبيعات الأقسام',
    branchSales: 'مبيعات الفروع',
    totalSales: 'إجمالي المبيعات',
    totalCount: 'عدد المبيعات',
    averageOrderValue: 'متوسط قيمة الطلب',
    topProduct: 'المنتج الأكثر مبيعًا',
    salesTrends: 'اتجاهات المبيعات',
    paymentMethodsLabel: 'طرق الدفع',
    noSales: 'لا توجد مبيعات',
    date: 'التاريخ',
    branchFilter: 'اختر فرعًا',
    allBranches: 'جميع الفروع',
    searchPlaceholder: 'ابحث عن المبيعات...',
    loadMore: 'تحميل المزيد',
    export: 'تصدير',
    errors: {
      unauthorized_access: 'غير مصرح لك بالوصول',
      fetch_sales: 'خطأ أثناء جلب المبيعات',
      fetch_branches: 'خطأ أثناء جلب الفروع',
      deleted_product: 'منتج محذوف',
      departments: { unknown: 'غير معروف' },
    },
    currency: 'ريال',
    units: { default: 'غير محدد' },
    paymentMethods: {
      cash: 'نقدي',
      card: 'بطاقة ائتمان',
      credit: 'ائتمان',
    },
  },
  en: {
    title: 'Sales Report',
    previousSales: 'Previous Sales',
    analytics: 'Sales Analytics',
    productSales: 'Product Sales',
    departmentSales: 'Department Sales',
    branchSales: 'Branch Sales',
    totalSales: 'Total Sales',
    totalCount: 'Total Sale Count',
    averageOrderValue: 'Average Order Value',
    topProduct: 'Top Selling Product',
    salesTrends: 'Sales Trends',
    paymentMethodsLabel: 'Payment Methods',
    noSales: 'No sales found',
    date: 'Date',
    branchFilter: 'Select Branch',
    allBranches: 'All Branches',
    searchPlaceholder: 'Search sales...',
    loadMore: 'Load More',
    export: 'Export',
    errors: {
      unauthorized_access: 'You are not authorized to access',
      fetch_sales: 'Error fetching sales',
      fetch_branches: 'Error fetching branches',
      deleted_product: 'Deleted Product',
      departments: { unknown: 'Unknown' },
    },
    currency: 'SAR',
    units: { default: 'N/A' },
    paymentMethods: {
      cash: 'Cash',
      card: 'Credit Card',
      credit: 'Credit',
    },
  },
};

const SearchInput: React.FC<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
}> = React.memo(({ value, onChange, placeholder }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="relative">
      <Search
        className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 transition-colors group-focus-within:text-gray-600`}
      />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full ${isRtl ? 'pl-10 pr-4' : 'pr-10 pl-4'} py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-all duration-200 bg-white text-sm placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={placeholder}
      />
      {value && (
        <button
          onClick={() => onChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>)}
          className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors`}
          aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
});

const BranchFilter: React.FC<{
  branches: Branch[];
  selectedBranch: string;
  onChange: (value: string) => void;
  placeholder: string;
  allBranchesLabel: string;
}> = React.memo(({ branches, selectedBranch, onChange, placeholder, allBranchesLabel }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="relative">
      <select
        value={selectedBranch}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-all duration-200 bg-white text-sm appearance-none ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={placeholder}
      >
        <option value="">{allBranchesLabel}</option>
        {branches.map((branch) => (
          <option key={branch._id} value={branch._id}>
            {branch.displayName}
          </option>
        ))}
      </select>
      <ChevronDown
        className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4`}
      />
    </div>
  );
});

const SaleCard: React.FC<{ sale: Sale }> = React.memo(({ sale }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  return (
    <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100 hover:border-gray-300 transition-all duration-200 w-full max-w-3xl mx-auto">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-sm">{sale.orderNumber}</h3>
          <span className="text-xs text-gray-500">{sale.branch?.displayName || t.errors.departments.unknown}</span>
        </div>
        <p className="text-xs text-gray-600">{t.date}: {sale.createdAt}</p>
        <ul className="list-disc list-inside text-xs text-gray-600">
          {sale.items.map((item, index) => (
            <li key={index}>
              {item.displayName || t.errors.deleted_product} ({item.department?.displayName || t.errors.departments.unknown}) - {t.quantity}: {item.quantity} {item.displayUnit || t.units.default}, {item.unitPrice} {t.currency}
            </li>
          ))}
        </ul>
        <div className="flex justify-between items-center pt-2 border-t border-gray-100">
          <span className="font-semibold text-gray-800 text-sm">{t.totalSales}:</span>
          <span className="text-gray-800 text-sm">{sale.totalAmount} {t.currency}</span>
        </div>
        {sale.notes && <p className="text-xs text-gray-500 italic">{t.notes}: {sale.notes}</p>}
        {sale.paymentMethod && (
          <p className="text-xs text-gray-600">
            {t.paymentMethodsLabel}: {t.paymentMethods[sale.paymentMethod as keyof typeof t.paymentMethods] || 'N/A'}
          </p>
        )}
        {sale.customerName && <p className="text-xs text-gray-600">{t.customerName}: {sale.customerName}</p>}
        {sale.customerPhone && <p className="text-xs text-gray-600">{t.customerPhone}: {sale.customerPhone}</p>}
      </div>
    </div>
  );
});

const SaleSkeletonCard: React.FC = React.memo(() => (
  <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100 w-full max-w-3xl mx-auto animate-pulse">
    <div className="space-y-2">
      <div className="h-3 bg-gray-200 rounded w-1/4"></div>
      <div className="h-2 bg-gray-200 rounded w-1/2"></div>
      <div className="h-2 bg-gray-200 rounded w-3/4"></div>
      <div className="h-2 bg-gray-200 rounded w-1/3"></div>
    </div>
  </div>
));

const SalesReport: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [sales, setSales] = useState<Sale[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [analytics, setAnalytics] = useState<SalesAnalytics>({
    branchSales: [],
    productSales: [],
    departmentSales: [],
    totalSales: 0,
    totalCount: 0,
    averageOrderValue: 0,
    topProduct: { productId: null, productName: '', displayName: '', totalQuantity: 0, totalRevenue: 0 },
    salesTrends: [],
    paymentMethods: [],
  });
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [salesLoading, setSalesLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [tabValue, setTabValue] = useState(0);

  const debouncedSearch = useCallback(debounce((value: string) => setSearchTerm(value.trim()), 300), []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSearch(value);
  };

  const fetchBranches = useCallback(async () => {
    if (user?.role !== 'admin') return;
    try {
      const response = await branchesAPI.getAll();
      const fetchedBranches = response.branches.map((branch: any) => ({
        _id: branch._id,
        name: branch.name || t.errors.departments.unknown,
        nameEn: branch.nameEn,
        displayName: isRtl ? branch.name : (branch.nameEn || branch.name || t.errors.departments.unknown),
      }));
      setBranches(fetchedBranches);
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Fetch branches error:`, err);
      setError(t.errors.fetch_branches);
      toast.error(t.errors.fetch_branches, { position: isRtl ? 'top-right' : 'top-left' });
    }
  }, [user, isRtl, t]);

  const fetchData = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      if (user?.role !== 'admin') {
        setError(t.errors.unauthorized_access);
        toast.error(t.errors.unauthorized_access, { position: isRtl ? 'top-right' : 'top-left' });
        setLoading(false);
        return;
      }

      setLoading(pageNum === 1);
      setSalesLoading(pageNum > 1);
      try {
        const salesParams: any = { page: pageNum, limit: 20, sort: '-createdAt' };
        if (filterBranch) salesParams.branch = filterBranch;
        if (filterStartDate) salesParams.startDate = filterStartDate;
        if (filterEndDate) salesParams.endDate = filterEndDate;

        const analyticsParams: any = {};
        if (filterBranch) analyticsParams.branch = filterBranch;
        if (filterStartDate) analyticsParams.startDate = filterStartDate;
        if (filterEndDate) analyticsParams.endDate = filterEndDate;

        const [salesResponse, analyticsResponse] = await Promise.all([
          salesAPI.getAll(salesParams).catch((err) => {
            throw new Error(t.errors.fetch_sales);
          }),
          salesAPI.getAnalytics(analyticsParams).catch((err) => {
            throw new Error(t.errors.fetch_sales);
          }),
        ]);

        const newSales = salesResponse.sales.map((sale: any) => ({
          _id: sale._id,
          orderNumber: sale.orderNumber || sale.saleNumber || 'N/A',
          branch: sale.branch
            ? {
                _id: sale.branch._id,
                name: sale.branch.name || t.errors.departments.unknown,
                nameEn: sale.branch.nameEn,
                displayName: isRtl ? sale.branch.name : (sale.branch.nameEn || sale.branch.name || t.errors.departments.unknown),
              }
            : { _id: '', name: '', displayName: t.errors.departments.unknown },
          items: Array.isArray(sale.items)
            ? sale.items.map((item: any) => ({
                productId: item.product?._id || item.productId,
                productName: item.product?.name || t.errors.deleted_product,
                productNameEn: item.product?.nameEn,
                unit: item.product?.unit,
                unitEn: item.product?.unitEn,
                displayName: isRtl
                  ? (item.product?.name || t.errors.deleted_product)
                  : (item.product?.nameEn || item.product?.name || t.errors.deleted_product),
                displayUnit: isRtl
                  ? (item.product?.unit || t.units.default)
                  : (item.product?.unitEn || item.product?.unit || t.units.default),
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                department: item.product?.department
                  ? {
                      _id: item.product.department._id,
                      name: item.product.department.name || t.errors.departments.unknown,
                      nameEn: item.product.department.nameEn,
                      displayName: isRtl
                        ? item.product.department.name
                        : (item.product.department.nameEn || item.product.department.name || t.errors.departments.unknown),
                    }
                  : undefined,
              }))
            : [],
          totalAmount: sale.totalAmount || 0,
          createdAt: formatDate(sale.createdAt, language),
          notes: sale.notes,
          paymentMethod: sale.paymentMethod,
          customerName: sale.customerName,
          customerPhone: sale.customerPhone,
        }));

        setSales((prev) => (append ? [...prev, ...newSales] : newSales));
        setHasMore(salesResponse.total > pageNum * 20);

        setAnalytics({
          branchSales: (analyticsResponse.branchSales || []).map((bs: any) => ({
            branchId: bs.branchId,
            branchName: bs.branchName || t.errors.departments.unknown,
            branchNameEn: bs.branchNameEn,
            displayName: isRtl ? bs.branchName : (bs.branchNameEn || bs.branchName || t.errors.departments.unknown),
            totalSales: bs.totalSales,
            saleCount: bs.saleCount,
          })),
          productSales: (analyticsResponse.productSales || []).map((ps: any) => ({
            productId: ps.productId,
            productName: ps.productName || t.errors.deleted_product,
            productNameEn: ps.productNameEn,
            displayName: isRtl
              ? (ps.productName || t.errors.deleted_product)
              : (ps.productNameEn || ps.productName || t.errors.deleted_product),
            totalQuantity: ps.totalQuantity,
            totalRevenue: ps.totalRevenue,
          })),
          departmentSales: (analyticsResponse.departmentSales || []).map((ds: any) => ({
            departmentId: ds.departmentId,
            departmentName: ds.departmentName || t.errors.departments.unknown,
            departmentNameEn: ds.departmentNameEn,
            displayName: isRtl
              ? ds.departmentName
              : (ds.departmentNameEn || ds.departmentName || t.errors.departments.unknown),
            totalRevenue: ds.totalRevenue,
            totalQuantity: ds.totalQuantity,
          })),
          totalSales: analyticsResponse.totalSales || 0,
          totalCount: analyticsResponse.totalCount || 0,
          averageOrderValue: analyticsResponse.averageOrderValue || 0,
          topProduct: analyticsResponse.topProduct
            ? {
                productId: analyticsResponse.topProduct.productId,
                productName: analyticsResponse.topProduct.productName || t.errors.deleted_product,
                productNameEn: analyticsResponse.topProduct.productNameEn,
                displayName: isRtl
                  ? (analyticsResponse.topProduct.productName || t.errors.deleted_product)
                  : (analyticsResponse.topProduct.productNameEn ||
                    analyticsResponse.topProduct.productName ||
                    t.errors.deleted_product),
                totalQuantity: analyticsResponse.topProduct.totalQuantity,
                totalRevenue: analyticsResponse.topProduct.totalRevenue,
              }
            : { productId: null, productName: '', displayName: '', totalQuantity: 0, totalRevenue: 0 },
          salesTrends: (analyticsResponse.salesTrends || []).map((trend: any) => ({
            period: formatDate(trend.period, language),
            totalSales: trend.totalSales,
            saleCount: trend.saleCount,
          })),
          paymentMethods: (analyticsResponse.paymentMethods || []).map((pm: any) => ({
            paymentMethod: t.paymentMethods[pm.paymentMethod as keyof typeof t.paymentMethods] || pm.paymentMethod,
            totalAmount: pm.totalAmount,
            count: pm.count,
          })),
        });

        setError('');
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Fetch error:`, err);
        setError(t.errors.fetch_sales);
        toast.error(t.errors.fetch_sales, { position: isRtl ? 'top-right' : 'top-left' });
        setSales([]);
      } finally {
        setLoading(false);
        setSalesLoading(false);
      }
    },
    [user, t, isRtl, language, filterBranch, filterStartDate, filterEndDate]
  );

  useEffect(() => {
    fetchBranches();
    fetchData();
  }, [fetchBranches, fetchData]);

  const loadMoreSales = useCallback(() => {
    setPage((prev) => prev + 1);
    fetchData(page + 1, true);
  }, [fetchData, page]);

  const handleExport = useCallback(() => {
    const csvData = sales.map((sale) => ({
      OrderNumber: sale.orderNumber,
      Branch: sale.branch?.displayName || t.errors.departments.unknown,
      TotalAmount: sale.totalAmount,
      CreatedAt: sale.createdAt,
      PaymentMethod: sale.paymentMethod ? t.paymentMethods[sale.paymentMethod as keyof typeof t.paymentMethods] : 'N/A',
      CustomerName: sale.customerName || 'N/A',
      CustomerPhone: sale.customerPhone || 'N/A',
      Items: sale.items
        .map((item) => `${item.displayName} (${item.quantity} x ${item.unitPrice} ${t.currency})`)
        .join('; '),
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'sales_report.csv';
    link.click();
  }, [sales, t]);

  const filteredSales = useMemo(
    () => sales.filter((sale) => sale.orderNumber.toLowerCase().includes(searchTerm.toLowerCase())),
    [sales, searchTerm]
  );

  const chartTextStyle = {
    fontSize: 12,
    fontFamily: isRtl ? "'Noto Sans Arabic', sans-serif" : "'Inter', sans-serif",
  };

  const chartOptions = useMemo(
    () => ({
      productSales: {
        title: { text: t.productSales, left: isRtl ? 'right' : 'left', textStyle: chartTextStyle },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '5%', right: '5%', bottom: '15%', containLabel: true },
        xAxis: {
          type: 'category',
          data: analytics.productSales.slice(0, 5).map((p) => p.displayName),
          axisLabel: { rotate: 45, ...chartTextStyle, interval: 0 },
          axisTick: { alignWithLabel: true },
        },
        yAxis: { type: 'value', axisLabel: chartTextStyle },
        series: [
          {
            name: `${t.totalSales} (${t.currency})`,
            type: 'bar',
            barWidth: '40%',
            data: analytics.productSales.slice(0, 5).map((p) => p.totalRevenue),
            itemStyle: { color: '#6B7280', borderRadius: [4, 4, 0, 0] },
          },
        ],
        media: [
          {
            query: { maxWidth: 600 },
            option: {
              grid: { bottom: '20%' },
              xAxis: { axisLabel: { rotate: 60, fontSize: 10 } },
              series: [{ barWidth: '30%' }],
            },
          },
        ],
      },
      departmentSales: {
        title: { text: t.departmentSales, left: isRtl ? 'right' : 'left', textStyle: chartTextStyle },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '5%', right: '5%', bottom: '15%', containLabel: true },
        xAxis: {
          type: 'category',
          data: analytics.departmentSales.slice(0, 5).map((d) => d.displayName),
          axisLabel: { rotate: 45, ...chartTextStyle, interval: 0 },
          axisTick: { alignWithLabel: true },
        },
        yAxis: { type: 'value', axisLabel: chartTextStyle },
        series: [
          {
            name: `${t.totalSales} (${t.currency})`,
            type: 'bar',
            barWidth: '40%',
            data: analytics.departmentSales.slice(0, 5).map((d) => d.totalRevenue),
            itemStyle: { color: '#6B7280', borderRadius: [4, 4, 0, 0] },
          },
        ],
        media: [
          {
            query: { maxWidth: 600 },
            option: {
              grid: { bottom: '20%' },
              xAxis: { axisLabel: { rotate: 60, fontSize: 10 } },
              series: [{ barWidth: '30%' }],
            },
          },
        ],
      },
      branchSales: {
        title: { text: t.branchSales, left: isRtl ? 'right' : 'left', textStyle: chartTextStyle },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '5%', right: '5%', bottom: '15%', containLabel: true },
        xAxis: {
          type: 'category',
          data: analytics.branchSales.slice(0, 5).map((b) => b.displayName),
          axisLabel: { rotate: 45, ...chartTextStyle, interval: 0 },
          axisTick: { alignWithLabel: true },
        },
        yAxis: { type: 'value', axisLabel: chartTextStyle },
        series: [
          {
            name: `${t.totalSales} (${t.currency})`,
            type: 'bar',
            barWidth: '40%',
            data: analytics.branchSales.slice(0, 5).map((b) => b.totalSales),
            itemStyle: { color: '#6B7280', borderRadius: [4, 4, 0, 0] },
          },
        ],
        media: [
          {
            query: { maxWidth: 600 },
            option: {
              grid: { bottom: '20%' },
              xAxis: { axisLabel: { rotate: 60, fontSize: 10 } },
              series: [{ barWidth: '30%' }],
            },
          },
        ],
      },
      salesTrends: {
        title: { text: t.salesTrends, left: isRtl ? 'right' : 'left', textStyle: chartTextStyle },
        tooltip: { trigger: 'axis' },
        grid: { left: '5%', right: '5%', bottom: '15%', containLabel: true },
        xAxis: {
          type: 'category',
          data: analytics.salesTrends.map((t) => t.period),
          axisLabel: { ...chartTextStyle, interval: 0 },
        },
        yAxis: { type: 'value', axisLabel: chartTextStyle },
        series: [
          {
            name: `${t.totalSales} (${t.currency})`,
            type: 'line',
            data: analytics.salesTrends.map((t) => t.totalSales),
            itemStyle: { color: '#6B7280' },
            lineStyle: { width: 2 },
            symbol: 'circle',
            symbolSize: 6,
          },
        ],
        media: [
          {
            query: { maxWidth: 600 },
            option: {
              grid: { bottom: '20%' },
              xAxis: { axisLabel: { fontSize: 10 } },
            },
          },
        ],
      },
      paymentMethods: {
        title: { text: t.paymentMethodsLabel, left: isRtl ? 'right' : 'left', textStyle: chartTextStyle },
        tooltip: { trigger: 'item' },
        series: [
          {
            name: t.paymentMethodsLabel,
            type: 'pie',
            radius: ['40%', '60%'],
            center: ['50%', '50%'],
            data: analytics.paymentMethods.map((pm) => ({
              value: pm.totalAmount,
              name: pm.paymentMethod,
            })),
            label: { ...chartTextStyle, position: 'outer', alignTo: 'labelLine', margin: 20 },
            itemStyle: { color: '#6B7280' },
          },
        ],
        media: [
          {
            query: { maxWidth: 600 },
            option: {
              series: [{ radius: ['30%', '50%'], label: { fontSize: 10 } }],
            },
          },
        ],
      },
    }),
    [analytics, t, isRtl]
  );

  if (user?.role !== 'admin') {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-gray-50 ${isRtl ? 'font-arabic' : 'font-sans'}`} dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm font-medium">{t.errors.unauthorized_access}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 p-4 font-sans ${isRtl ? 'font-arabic' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <header className="mb-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-gray-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-800">{t.title}</h1>
            <p className="text-xs text-gray-500">{t.previousSales}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTabValue(0)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${tabValue === 0 ? 'bg-gray-200 text-gray-800' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            {t.previousSales}
          </button>
          <button
            onClick={() => setTabValue(1)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${tabValue === 1 ? 'bg-gray-200 text-gray-800' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            {t.analytics}
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-red-600 text-xs font-medium">{error}</span>
        </div>
      )}

      {tabValue === 0 && (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">{t.filters}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <SearchInput value={searchInput} onChange={handleSearchChange} placeholder={t.searchPlaceholder} />
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-all duration-200 bg-white text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                aria-label={t.date}
              />
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-all duration-200 bg-white text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                aria-label={t.date}
              />
              <BranchFilter
                branches={branches}
                selectedBranch={filterBranch}
                onChange={setFilterBranch}
                placeholder={t.branchFilter}
                allBranchesLabel={t.allBranches}
              />
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={handleExport}
                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs font-medium transition-colors duration-200"
                aria-label={t.export}
              >
                {t.export}
              </button>
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800 mb-3">{t.previousSales}</h2>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, index) => (
                  <SaleSkeletonCard key={index} />
                ))}
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="p-6 text-center bg-white rounded-lg shadow-sm border border-gray-100">
                <DollarSign className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600 text-xs font-medium">{t.noSales}</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {filteredSales.map((sale) => (
                    <SaleCard key={sale._id} sale={sale} />
                  ))}
                </div>
                {hasMore && (
                  <div className="flex justify-center mt-4">
                    <button
                      onClick={loadMoreSales}
                      className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs font-medium transition-colors duration-200 disabled:opacity-50"
                      disabled={salesLoading}
                    >
                      {salesLoading ? (
                        <svg
                          className="animate-spin h-4 w-4 text-gray-800 mx-auto"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                      ) : (
                        t.loadMore
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {tabValue === 1 && (
        <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800">{t.analytics}</h2>
          <div className="space-y-4">
            <div className="w-full max-w-3xl mx-auto h-64">
              <ReactECharts option={chartOptions.productSales} style={{ height: '100%', width: '100%' }} />
            </div>
            <div className="w-full max-w-3xl mx-auto h-64">
              <ReactECharts option={chartOptions.departmentSales} style={{ height: '100%', width: '100%' }} />
            </div>
            <div className="w-full max-w-3xl mx-auto h-64">
              <ReactECharts option={chartOptions.branchSales} style={{ height: '100%', width: '100%' }} />
            </div>
            <div className="w-full max-w-3xl mx-auto h-64">
              <ReactECharts option={chartOptions.salesTrends} style={{ height: '100%', width: '100%' }} />
            </div>
            <div className="w-full max-w-3xl mx-auto h-64">
              <ReactECharts option={chartOptions.paymentMethods} style={{ height: '100%', width: '100%' }} />
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 w-full max-w-3xl mx-auto">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">{t.totalSales}</h3>
              <p className="text-lg font-semibold text-gray-800">{analytics.totalSales} {t.currency}</p>
              <p className="text-xs text-gray-600 mt-1">{t.totalCount}: {analytics.totalCount}</p>
              <p className="text-xs text-gray-600 mt-1">{t.averageOrderValue}: {analytics.averageOrderValue} {t.currency}</p>
              <p className="text-xs text-gray-600 mt-1">{t.topProduct}: {analytics.topProduct.displayName} ({analytics.topProduct.totalQuantity})</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(SalesReport);