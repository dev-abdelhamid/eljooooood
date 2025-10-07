import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { salesAPI, branchesAPI, inventoryAPI, productsAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, DollarSign, Search, X, ChevronDown, Download } from 'lucide-react';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import Papa from 'papaparse';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

interface Sale {
  _id: string;
  saleNumber: string;
  branch: { _id: string; name: string; nameEn?: string; displayName: string };
  items: Array<{
    product: { _id: string; name: string; nameEn?: string; unit?: string; unitEn?: string; department?: { name: string; nameEn?: string; displayName: string } };
    quantity: number;
    unitPrice: number;
    productName: string;
    productNameEn?: string;
    displayName: string;
    displayUnit: string;
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
    items: Array<{ product: string; productName: string; productNameEn?: string; quantity: number; reason: string }>;
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

interface Product {
  _id: string;
  name: string;
  nameEn?: string;
  price: number;
}

interface SalesAnalytics {
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
  paymentMethods: Array<{ paymentMethod: string; totalAmount: number; count: number }>;
  returnStats: Array<{ status: string; count: number; totalQuantity: number }>;
}

const translations = {
  ar: {
    title: 'تقرير المبيعات',
    previousSales: 'المبيعات السابقة',
    analytics: 'إحصائيات المبيعات',
    productSales: 'مبيعات المنتجات',
    departmentSales: 'مبيعات الأقسام',
    totalSales: 'إجمالي المبيعات',
    totalCount: 'عدد المبيعات',
    topProduct: 'المنتج الأكثر مبيعًا',
    salesTrends: 'اتجاهات المبيعات',
    topCustomers: 'أفضل العملاء',
    paymentMethodsLabel: 'طرق الدفع',
    returnStats: 'إحصائيات المرتجعات',
    noSales: 'لا توجد مبيعات',
    date: 'التاريخ',
    returns: 'المرتجعات',
    return: 'مرتجع',
    reason: 'السبب',
    quantity: 'الكمية',
    unitPrice: 'سعر الوحدة',
    searchPlaceholder: 'ابحث عن المبيعات...',
    selectBranch: 'اختر الفرع',
    selectProduct: 'اختر المنتج',
    loadMore: 'تحميل المزيد',
    export: 'تصدير التقرير',
    errors: {
      unauthorized_access: 'غير مصرح لك بالوصول',
      fetch_sales: 'خطأ أثناء جلب المبيعات',
      fetch_branches: 'خطأ أثناء جلب الفروع',
      fetch_inventory: 'خطأ أثناء جلب المخزون',
      fetch_products: 'خطأ أثناء جلب المنتجات',
      fetch_analytics: 'خطأ أثناء جلب الإحصائيات',
      export_failed: 'فشل تصدير التقرير',
      deleted_product: 'منتج محذوف',
      departments: { unknown: 'غير معروف' },
    },
    currency: 'ريال',
    units: { default: 'غير محدد' },
    branches: { all_branches: 'كل الفروع', unknown: 'غير معروف' },
    paymentMethods: {
      cash: 'نقدي',
      credit_card: 'بطاقة ائتمان',
      bank_transfer: 'تحويل بنكي',
    },
    returns: { status: { pending: 'معلق', approved: 'مقبول', rejected: 'مرفوض' } },
  },
  en: {
    title: 'Sales Report',
    previousSales: 'Previous Sales',
    analytics: 'Sales Analytics',
    productSales: 'Product Sales',
    departmentSales: 'Department Sales',
    totalSales: 'Total Sales',
    totalCount: 'Total Sale Count',
    topProduct: 'Top Selling Product',
    salesTrends: 'Sales Trends',
    topCustomers: 'Top Customers',
    paymentMethodsLabel: 'Payment Methods',
    returnStats: 'Return Statistics',
    noSales: 'No sales found',
    date: 'Date',
    returns: 'Returns',
    return: 'Return',
    reason: 'Reason',
    quantity: 'Quantity',
    unitPrice: 'Unit Price',
    searchPlaceholder: 'Search sales...',
    selectBranch: 'Select Branch',
    selectProduct: 'Select Product',
    loadMore: 'Load More',
    export: 'Export Report',
    errors: {
      unauthorized_access: 'You are not authorized to access',
      fetch_sales: 'Error fetching sales',
      fetch_branches: 'Error fetching branches',
      fetch_inventory: 'Error fetching inventory',
      fetch_products: 'Error fetching products',
      fetch_analytics: 'Error fetching analytics',
      export_failed: 'Failed to export report',
      deleted_product: 'Deleted Product',
      departments: { unknown: 'Unknown' },
    },
    currency: 'SAR',
    units: { default: 'N/A' },
    branches: { all_branches: 'All Branches', unknown: 'Unknown' },
    paymentMethods: {
      cash: 'Cash',
      credit_card: 'Credit Card',
      bank_transfer: 'Bank Transfer',
    },
    returns: { status: { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' } },
  },
};

// Memoized Components
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
}>(({ value, onChange, options, ariaLabel, disabled = false }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
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

const SaleCard = React.memo<{ sale: Sale }>(({ sale }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  return (
    <div className="p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-gray-900 text-base">{sale.saleNumber}</h3>
          <p className="text-sm text-gray-600">{t.date}: {sale.createdAt}</p>
          <p className="text-sm text-gray-600">{t.branches.unknown}: {sale.branch.displayName}</p>
          <p className="text-sm text-gray-600">{t.total}: {sale.totalAmount} {t.currency}</p>
          {sale.paymentMethod && (
            <p className="text-sm text-gray-600">
              {t.paymentMethodsLabel}: {t.paymentMethods[sale.paymentMethod as keyof typeof t.paymentMethods] || sale.paymentMethod}
            </p>
          )}
          {sale.customerName && <p className="text-sm text-gray-600">{t.customerName}: {sale.customerName}</p>}
          {sale.customerPhone && <p className="text-sm text-gray-600">{t.customerPhone}: {sale.customerPhone}</p>}
          {sale.notes && <p className="text-sm text-gray-500">{t.notes}: {sale.notes}</p>}
          <ul className="list-disc list-inside text-sm text-gray-600 mt-2">
            {sale.items.map((item, index) => (
              <li key={index}>
                {item.displayName || t.errors.deleted_product} - {t.quantity}: {item.quantity} {item.displayUnit || t.units.default}, {t.unitPrice}: {item.unitPrice} {t.currency}
              </li>
            ))}
          </ul>
          {sale.returns && sale.returns.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700">{t.returns}:</p>
              <ul className="list-disc list-inside text-sm text-gray-600">
                {sale.returns.map((ret, index) => (
                  <li key={index}>
                    {t.return} #{ret.returnNumber} ({t.returns.status[ret.status as keyof typeof t.returns.status]}) - {t.reason}: {ret.reason} ({t.date}: {ret.createdAt})
                    <ul className="list-circle list-inside ml-4">
                      {ret.items.map((item, i) => (
                        <li key={i}>
                          {item.productName || t.errors.deleted_product} - {t.quantity}: {item.quantity}, {t.reason}: {item.reason}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

const SalesReport: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [sales, setSales] = useState<Sale[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<SalesAnalytics>({
    productSales: [],
    departmentSales: [],
    totalSales: 0,
    totalCount: 0,
    topProduct: { productId: null, productName: '', displayName: '', totalQuantity: 0, totalRevenue: 0 },
    salesTrends: [],
    topCustomers: [],
    paymentMethods: [],
    returnStats: [],
  });
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [salesLoading, setSalesLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const toastIdRef = React.useRef<string | number | null>(null);

  const showToast = useCallback((message: string, type: 'error' | 'success') => {
    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current);
    }
    toastIdRef.current = toast[type](message, { autoClose: 3000, position: isRtl ? 'top-right' : 'top-left' });
  }, [isRtl]);

  const debouncedSearch = useCallback(debounce((value: string) => setSearchTerm(value.trim()), 300), []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSearch(value);
  };

  const fetchData = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      if (user?.role !== 'admin') {
        setError(t.errors.unauthorized_access);
        showToast(t.errors.unauthorized_access, 'error');
        setLoading(false);
        return;
      }

      setLoading(pageNum === 1);
      setSalesLoading(pageNum > 1);
      try {
        const salesParams: any = { page: pageNum, limit: 20, sort: '-createdAt', lang: language };
        if (filterStartDate) salesParams.startDate = filterStartDate;
        if (filterEndDate) salesParams.endDate = filterEndDate;
        if (filterBranch) salesParams.branch = filterBranch;
        if (filterProduct) salesParams.product = filterProduct;
        if (searchTerm) salesParams.search = searchTerm;

        const analyticsParams: any = {};
        if (filterStartDate) analyticsParams.startDate = filterStartDate;
        if (filterEndDate) analyticsParams.endDate = filterEndDate;
        if (filterBranch) analyticsParams.branch = filterBranch;

        const [salesResponse, branchesResponse, inventoryResponse, productsResponse, analyticsResponse] = await Promise.all([
          salesAPI.getAll(salesParams),
          branchesAPI.getAll(),
          inventoryAPI.getAll({ branch: filterBranch || undefined }),
          productsAPI.getAll(),
          salesAPI.getAnalytics(analyticsParams),
        ]);

        const returnsMap = new Map<string, Sale['returns']>();
        if (Array.isArray(salesResponse.returns)) {
          salesResponse.returns.forEach((ret: any) => {
            const saleId = ret.sale?._id || ret.sale;
            if (!returnsMap.has(saleId)) returnsMap.set(saleId, []);
            returnsMap.get(saleId)!.push({
              _id: ret._id,
              returnNumber: ret.returnNumber,
              status: ret.status,
              items: Array.isArray(ret.items)
                ? ret.items.map((item: any) => ({
                    product: item.product?._id || item.productId,
                    productName: item.product?.name || t.errors.deleted_product,
                    productNameEn: item.product?.nameEn,
                    quantity: item.quantity,
                    reason: item.reason,
                  }))
                : [],
              reason: ret.reason,
              createdAt: formatDate(ret.createdAt, language),
            });
          });
        }

        const newSales = salesResponse.sales.map((sale: any) => ({
          _id: sale._id,
          saleNumber: sale.saleNumber || 'N/A',
          branch: {
            _id: sale.branch?._id || 'unknown',
            name: sale.branch?.name || t.branches.unknown,
            nameEn: sale.branch?.nameEn,
            displayName: isRtl ? (sale.branch?.name || t.branches.unknown) : (sale.branch?.nameEn || sale.branch?.name || t.branches.unknown),
          },
          items: Array.isArray(sale.items)
            ? sale.items.map((item: any) => ({
                product: {
                  _id: item.product?._id || item.productId,
                  name: item.product?.name || t.errors.deleted_product,
                  nameEn: item.product?.nameEn,
                  unit: item.product?.unit,
                  unitEn: item.product?.unitEn,
                  department: item.product?.department
                    ? {
                        name: item.product.department.name || t.errors.departments.unknown,
                        nameEn: item.product.department.nameEn,
                        displayName: isRtl
                          ? (item.product.department.name || t.errors.departments.unknown)
                          : (item.product.department.nameEn || item.product.department.name || t.errors.departments.unknown),
                      }
                    : undefined,
                },
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                productName: item.product?.name || t.errors.deleted_product,
                productNameEn: item.product?.nameEn,
                displayName: isRtl ? (item.product?.name || t.errors.deleted_product) : (item.product?.nameEn || item.product?.name || t.errors.deleted_product),
                displayUnit: isRtl ? (item.product?.unit || t.units.default) : (item.product?.unitEn || item.product?.unit || t.units.default),
              }))
            : [],
          totalAmount: sale.totalAmount || 0,
          createdAt: formatDate(sale.createdAt, language),
          notes: sale.notes,
          paymentMethod: sale.paymentMethod,
          customerName: sale.customerName,
          customerPhone: sale.customerPhone,
          returns: returnsMap.get(sale._id) || [],
        }));

        setSales((prev) => (append ? [...prev, ...newSales] : newSales));
        setHasMore(salesResponse.total > pageNum * 20);

        setBranches([
          { _id: '', name: t.branches.all_branches, displayName: t.branches.all_branches },
          ...branchesResponse.branches.map((branch: any) => ({
            _id: branch._id,
            name: branch.name || t.branches.unknown,
            nameEn: branch.nameEn,
            displayName: isRtl ? (branch.name || t.branches.unknown) : (branch.nameEn || branch.name || t.branches.unknown),
          })),
        ]);

        setInventory(
          Array.isArray(inventoryResponse)
            ? inventoryResponse.map((item: any) => ({
                _id: item._id,
                productId: item.product?._id || item.productId,
                productName: item.product?.name || t.errors.deleted_product,
                productNameEn: item.product?.nameEn,
                currentStock: item.currentStock || 0,
                branchId: item.branch?._id || item.branchId,
              }))
            : []
        );

        setProducts(
          Array.isArray(productsResponse)
            ? productsResponse.map((product: any) => ({
                _id: product._id,
                name: product.name || t.errors.deleted_product,
                nameEn: product.nameEn,
                price: product.price || 0,
              }))
            : []
        );

        setAnalytics({
          productSales: Array.isArray(analyticsResponse.productSales)
            ? analyticsResponse.productSales.map((ps: any) => ({
                ...ps,
                displayName: isRtl
                  ? (ps.productName || t.errors.deleted_product)
                  : (ps.productNameEn || ps.productName || t.errors.deleted_product),
              }))
            : [],
          departmentSales: Array.isArray(analyticsResponse.departmentSales)
            ? analyticsResponse.departmentSales.map((ds: any) => ({
                ...ds,
                displayName: isRtl
                  ? (ds.departmentName || t.errors.departments.unknown)
                  : (ds.departmentNameEn || ds.departmentName || t.errors.departments.unknown),
              }))
            : [],
          totalSales: analyticsResponse.totalSales || 0,
          totalCount: analyticsResponse.totalCount || 0,
          topProduct: analyticsResponse.topProduct
            ? {
                ...analyticsResponse.topProduct,
                displayName: isRtl
                  ? (analyticsResponse.topProduct.productName || t.errors.deleted_product)
                  : (analyticsResponse.topProduct.productNameEn || analyticsResponse.topProduct.productName || t.errors.deleted_product),
              }
            : { productId: null, productName: '', displayName: '', totalQuantity: 0, totalRevenue: 0 },
          salesTrends: Array.isArray(analyticsResponse.salesTrends)
            ? analyticsResponse.salesTrends.map((trend: any) => ({
                ...trend,
                period: formatDate(trend.period, language),
              }))
            : [],
          topCustomers: Array.isArray(analyticsResponse.topCustomers) ? analyticsResponse.topCustomers : [],
          paymentMethods: Array.isArray(analyticsResponse.paymentMethods)
            ? analyticsResponse.paymentMethods.map((pm: any) => ({
                ...pm,
                paymentMethod: t.paymentMethods[pm.paymentMethod as keyof typeof t.paymentMethods] || pm.paymentMethod,
              }))
            : [],
          returnStats: Array.isArray(analyticsResponse.returnStats)
            ? analyticsResponse.returnStats.map((rs: any) => ({
                ...rs,
                status: t.returns.status[rs.status as keyof typeof t.returns.status] || rs.status,
              }))
            : [],
        });

        setError('');
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Fetch error:`, err);
        setError(t.errors.fetch_sales);
        showToast(t.errors.fetch_sales, 'error');
        setSales([]);
      } finally {
        setLoading(false);
        setSalesLoading(false);
      }
    },
    [filterStartDate, filterEndDate, filterBranch, filterProduct, searchTerm, user, t, isRtl, language, showToast]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const loadMoreSales = useCallback(() => {
    setPage((prev) => prev + 1);
    fetchData(page + 1, true);
  }, [fetchData, page]);

  const handleExport = useCallback(() => {
    try {
      const csvData = sales.map((sale) => ({
        SaleNumber: sale.saleNumber,
        Branch: sale.branch.displayName,
        TotalAmount: sale.totalAmount,
        CreatedAt: sale.createdAt,
        PaymentMethod: sale.paymentMethod ? t.paymentMethods[sale.paymentMethod as keyof typeof t.paymentMethods] : 'N/A',
        CustomerName: sale.customerName || 'N/A',
        CustomerPhone: sale.customerPhone || 'N/A',
        Items: sale.items
          .map((item) => `${item.displayName} (${item.quantity} ${item.displayUnit})`)
          .join('; '),
      }));
      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `sales_report_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      showToast(t.export, 'success');
    } catch (err) {
      console.error('Export failed:', err);
      showToast(t.errors.export_failed, 'error');
    }
  }, [sales, t, showToast]);

  const filteredSales = useMemo(
    () => sales.filter((sale) => sale.saleNumber.toLowerCase().includes(searchTerm.toLowerCase())),
    [sales, searchTerm]
  );

  const chartColors = {
    primary: 'rgba(251, 191, 36, 0.6)',
    primaryBorder: 'rgba(251, 191, 36, 1)',
    secondary: 'rgba(59, 130, 246, 0.6)',
    secondaryBorder: 'rgba(59, 130, 246, 1)',
    accent: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'],
  };

  const productSalesChartData = useMemo(
    () => ({
      labels: analytics.productSales.slice(0, 5).map((p) => p.displayName),
      datasets: [
        {
          label: t.productSales,
          data: analytics.productSales.slice(0, 5).map((p) => p.totalRevenue),
          backgroundColor: chartColors.primary,
          borderColor: chartColors.primaryBorder,
          borderWidth: 1,
        },
        {
          label: t.quantity,
          data: analytics.productSales.slice(0, 5).map((p) => p.totalQuantity),
          backgroundColor: chartColors.secondary,
          borderColor: chartColors.secondaryBorder,
          borderWidth: 1,
        },
      ],
    }),
    [analytics.productSales, t]
  );

  const departmentSalesChartData = useMemo(
    () => ({
      labels: analytics.departmentSales.map((d) => d.displayName),
      datasets: [
        {
          label: t.departmentSales,
          data: analytics.departmentSales.map((d) => d.totalRevenue),
          backgroundColor: chartColors.accent,
          borderColor: chartColors.accent.map((color) => color.replace('0.6', '1')),
          borderWidth: 1,
        },
      ],
    }),
    [analytics.departmentSales, t]
  );

  const salesTrendsChartData = useMemo(
    () => ({
      labels: analytics.salesTrends.map((t) => t.period),
      datasets: [
        {
          label: t.salesTrends,
          data: analytics.salesTrends.map((t) => t.totalSales),
          fill: true,
          backgroundColor: 'rgba(251, 191, 36, 0.2)',
          borderColor: chartColors.primaryBorder,
          tension: 0.3,
        },
        {
          label: t.totalCount,
          data: analytics.salesTrends.map((t) => t.saleCount),
          fill: true,
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderColor: chartColors.secondaryBorder,
          tension: 0.3,
        },
      ],
    }),
    [analytics.salesTrends, t]
  );

  const paymentMethodsChartData = useMemo(
    () => ({
      labels: analytics.paymentMethods.map((pm) => pm.paymentMethod),
      datasets: [
        {
          label: t.paymentMethodsLabel,
          data: analytics.paymentMethods.map((pm) => pm.totalAmount),
          backgroundColor: chartColors.accent,
          borderColor: chartColors.accent.map((color) => color.replace('0.6', '1')),
          borderWidth: 1,
        },
      ],
    }),
    [analytics.paymentMethods, t]
  );

  const returnStatsChartData = useMemo(
    () => ({
      labels: analytics.returnStats.map((rs) => rs.status),
      datasets: [
        {
          label: t.returnStats,
          data: analytics.returnStats.map((rs) => rs.count),
          backgroundColor: chartColors.accent,
          borderColor: chartColors.accent.map((color) => color.replace('0.6', '1')),
          borderWidth: 1,
        },
      ],
    }),
    [analytics.returnStats, t]
  );

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const, labels: { font: { size: 12 } } },
      title: { display: true, font: { size: 16 } },
      tooltip: { backgroundColor: '#1F2937', bodyFont: { size: 12 }, titleFont: { size: 14 } },
    },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(0, 0, 0, 0.05)' } },
      x: { grid: { display: false } },
    },
    animation: { duration: 1000, easing: 'easeOutQuart' as const },
  };

  if (user?.role !== 'admin') {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-teal-50 ${isRtl ? 'font-arabic' : 'font-sans'}`} dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="p-6 bg-red-100 border border-red-300 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <span className="text-red-600 text-base">{t.errors.unauthorized_access}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`container mx-auto px-4 py-6 min-h-screen bg-gradient-to-br from-amber-50 to-teal-50 ${isRtl ? 'font-arabic' : 'font-sans'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <header className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-amber-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t.title}</h1>
            <p className="text-gray-600 text-sm mt-1">{t.previousSales}</p>
          </div>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          <button
            onClick={() => setTabValue(0)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${tabValue === 0 ? 'bg-amber-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            {t.previousSales}
          </button>
          <button
            onClick={() => setTabValue(1)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${tabValue === 1 ? 'bg-amber-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            {t.analytics}
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg flex items-center gap-3 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600">{error}</span>
        </div>
      )}

      {tabValue === 0 && (
        <div className="space-y-6">
          <div className="p-6 bg-white rounded-xl shadow-md border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t.filters}</h2>
            <div className="flex flex-col sm:flex-row gap-4">
              <SearchInput
                value={searchInput}
                onChange={handleSearchChange}
                placeholder={t.searchPlaceholder}
                ariaLabel={t.searchPlaceholder}
              />
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="w-full sm:w-40 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm"
                aria-label={t.date}
              />
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="w-full sm:w-40 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm"
                aria-label={t.date}
              />
              <Dropdown
                value={filterBranch}
                onChange={setFilterBranch}
                options={branches.map((branch) => ({
                  value: branch._id,
                  label: branch.displayName,
                }))}
                ariaLabel={t.selectBranch}
                disabled={branches.length === 0}
              />
              <Dropdown
                value={filterProduct}
                onChange={setFilterProduct}
                options={[
                  { value: '', label: t.selectProduct },
                  ...products.map((product) => ({
                    value: product._id,
                    label: isRtl ? (product.name || t.errors.deleted_product) : (product.nameEn || product.name || t.errors.deleted_product),
                  })),
                ]}
                ariaLabel={t.selectProduct}
                disabled={products.length === 0}
              />
            </div>
            <button
              onClick={handleExport}
              className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm flex items-center gap-2 transition-colors"
            >
              <Download className="w-5 h-5" />
              {t.export}
            </button>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t.previousSales}</h2>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, index) => (
                  <div key={index} className="p-5 bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse">
                    <div className="space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl shadow-md border border-gray-100">
                <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">{t.noSales}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredSales.map((sale) => (
                    <SaleCard key={sale._id} sale={sale} />
                  ))}
                </div>
                {hasMore && (
                  <button
                    onClick={loadMoreSales}
                    disabled={salesLoading}
                    className="mt-4 w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                  >
                    {salesLoading ? 'Loading...' : t.loadMore}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {tabValue === 1 && (
        <div className="p-6 bg-white rounded-xl shadow-md border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-6">{t.analytics}</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">{t.productSales}</h3>
              <div className="h-80">
                <Bar
                  data={productSalesChartData}
                  options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.productSales } } }}
                />
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">{t.departmentSales}</h3>
              <div className="h-80">
                <Doughnut
                  data={departmentSalesChartData}
                  options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.departmentSales } } }}
                />
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">{t.salesTrends}</h3>
              <div className="h-80">
                <Line
                  data={salesTrendsChartData}
                  options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.salesTrends } } }}
                />
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">{t.paymentMethodsLabel}</h3>
              <div className="h-80">
                <Doughnut
                  data={paymentMethodsChartData}
                  options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.paymentMethodsLabel } } }}
                />
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">{t.returnStats}</h3>
              <div className="h-80">
                <Bar
                  data={returnStatsChartData}
                  options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.returnStats } } }}
                />
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">{t.topCustomers}</h3>
              {analytics.topCustomers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{t.customerName}</th>
                        <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{t.customerPhone}</th>
                        <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{t.totalSales}</th>
                        <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{t.totalCount}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.topCustomers.map((customer, index) => (
                        <tr key={index} className="border-b hover:bg-amber-50">
                          <td className="p-3">{customer.customerName || 'N/A'}</td>
                          <td className="p-3">{customer.customerPhone || 'N/A'}</td>
                          <td className="p-3">{customer.totalSpent} {t.currency}</td>
                          <td className="p-3">{customer.purchaseCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-600">{t.noSales}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(SalesReport);