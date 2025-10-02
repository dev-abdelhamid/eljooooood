import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { branchesAPI, salesAPI } from '../services/api';
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
      credit_card: 'بطاقة ائتمان',
      bank_transfer: 'تحويل بنكي',
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
      credit_card: 'Credit Card',
      bank_transfer: 'Bank Transfer',
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
  const selectedOption = options.find((opt) => opt.value === value) || options[0] || { value: '', label: isRtl ? 'اختر' : 'Select' };

  return (
    <div className={`relative group ${className || ''}`}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 bg-gradient-to-r from-white to-gray-50 shadow-sm hover:shadow-md text-sm text-gray-700 ${isRtl ? 'text-right' : 'text-left'} flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={ariaLabel}
      >
        <span className="truncate">{selectedOption.label}</span>
        <ChevronDown className={`${isOpen ? 'rotate-180' : 'rotate-0'} transition-transform duration-200 w-5 h-5 text-gray-400 group-focus-within:text-amber-500`} />
      </button>
      {isOpen && !disabled && (
        <div className="absolute w-full mt-2 bg-white rounded-lg shadow-2xl border border-gray-100 z-20 max-h-60 overflow-y-auto scrollbar-none">
          {options.length > 0 ? (
            options.map((option) => (
              <div
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className="px-4 py-2.5 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-600 cursor-pointer transition-colors duration-200"
              >
                {option.label}
              </div>
            ))
          ) : (
            <div className="px-4 py-2.5 text-sm text-gray-500">{isRtl ? 'لا توجد خيارات متاحة' : 'No options available'}</div>
          )}
        </div>
      )}
    </div>
  );
});

const SaleCard = React.memo<{ sale: Sale; onEdit: (sale: Sale) => void; onDelete: (id: string) => void }>(({ sale, onEdit, onDelete }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  return (
    <div className="h-[200px] p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-amber-200">
      <div className="flex flex-col h-full">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-gray-900 text-base truncate">{sale.saleNumber} - {sale.branch.displayName}</h3>
            <p className="text-sm text-gray-600">{t.date}: {sale.createdAt}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onEdit(sale)} aria-label={t.editSale} className="w-8 h-8 bg-blue-100 hover:bg-blue-200 rounded-full transition-colors duration-200 flex items-center justify-center">
              <Edit className="w-4 h-4 text-blue-600" />
            </button>
            <button onClick={() => onDelete(sale._id)} aria-label={t.deleteSale} className="w-8 h-8 bg-red-100 hover:bg-red-200 rounded-full transition-colors duration-200 flex items-center justify-center">
              <Trash className="w-4 h-4 text-red-600" />
            </button>
          </div>
        </div>
        <div className="mt-2 flex-1 overflow-y-auto scrollbar-none">
          <ul className="list-disc list-inside text-sm text-gray-600">
            {sale.items.map((item, index) => (
              <li key={index} className="truncate">
                {item.displayName || t.departments.unknown} ({item.department?.displayName || t.departments.unknown}) - {t.quantity}: {item.quantity} {item.displayUnit || t.units.default}, {t.unitPrice}: {item.unitPrice} {t.currency}
              </li>
            ))}
          </ul>
          {sale.returns && sale.returns.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium text-gray-700">{t.returns}:</p>
              <ul className="list-disc list-inside text-sm text-gray-600">
                {sale.returns.map((ret, index) => (
                  <li key={index} className="truncate">
                    {t.return} #{ret.returnNumber} ({t.returns.status[ret.status as keyof typeof t.returns.status]})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="mt-2 flex justify-between items-center font-bold text-gray-900 text-sm">
          <span>{t.total}:</span>
          <span className="text-amber-600">{sale.totalAmount.toFixed(2)} {t.currency}</span>
        </div>
      </div>
    </div>
  );
});

const SaleSkeletonCard = React.memo(() => (
  <div className="h-[200px] p-5 bg-white rounded-xl shadow-sm border border-gray-100">
    <div className="space-y-3 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      <div className="h-3 bg-gray-200 rounded w-1/3"></div>
      <div className="mt-4 flex justify-end">
        <div className="h-8 bg-gray-200 rounded-lg w-24"></div>
      </div>
    </div>
  </div>
));

const formatNumber = (num: number) => num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Validate MongoDB ObjectId
const isValidObjectId = (id: string) => /^[0-9a-fA-F]{24}$/.test(id);

const AdminSalesReport: React.FC = () => {
  const { t: languageT, language } = useLanguage();
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
    topProduct: { productId: null, productName: '', displayName: '', totalQuantity: 0, totalRevenue: 0 },
    salesTrends: [],
    topCustomers: [],
    paymentMethods: [],
    returnStats: [],
  });
  const [filterBranch, setFilterBranch] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('day');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [salesLoading, setSalesLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState<'sales' | 'analytics'>('sales');

  const debouncedSearch = useCallback(
    debounce((value: string) => setSearchTerm(value.trim()), 300),
    []
  );

  const debouncedFetch = useCallback(
    debounce((pageNum: number, append: boolean) => fetchData(pageNum, append), 500),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSearch(value);
  };

  const filteredSales = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return sales.filter(
      (sale) =>
        sale.saleNumber.toLowerCase().includes(lowerSearchTerm) ||
        sale.branch.displayName.toLowerCase().includes(lowerSearchTerm) ||
        sale.customerName?.toLowerCase().includes(lowerSearchTerm) ||
        sale.customerPhone?.toLowerCase().includes(lowerSearchTerm)
    );
  }, [sales, searchTerm]);

  const fetchData = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      if (!user || user.role !== 'admin') {
        setError(t.errors.unauthorized_access);
        toast.error(t.errors.unauthorized_access, { position: isRtl ? 'top-right' : 'top-left' });
        setLoading(false);
        return;
      }

      setLoading(pageNum === 1);
      setSalesLoading(pageNum > 1);
      try {
        // Validate branch ID
        if (filterBranch && !isValidObjectId(filterBranch)) {
          throw new Error(t.errors.invalid_branch_id);
        }

        const salesParams: any = { page: pageNum, limit: 20, sort: '-createdAt', role: 'admin' };
        if (filterBranch) salesParams.branch = filterBranch;
        if (filterPeriod === 'day') {
          const today = new Date();
          salesParams.startDate = formatDate(today);
          salesParams.endDate = formatDate(today);
        } else if (filterPeriod === 'week') {
          const start = new Date();
          start.setDate(start.getDate() - 7);
          salesParams.startDate = formatDate(start);
          salesParams.endDate = formatDate(new Date());
        } else if (filterPeriod === 'month') {
          const start = new Date();
          start.setMonth(start.getMonth() - 1);
          salesParams.startDate = formatDate(start);
          salesParams.endDate = formatDate(new Date());
        } else if (filterPeriod === 'custom' && startDate && endDate) {
          salesParams.startDate = startDate;
          salesParams.endDate = endDate;
        }

        const analyticsParams: any = { role: 'admin' };
        if (filterBranch) analyticsParams.branch = filterBranch;
        if (filterPeriod === 'day') {
          const today = new Date();
          analyticsParams.startDate = formatDate(today);
          analyticsParams.endDate = formatDate(today);
        } else if (filterPeriod === 'week') {
          const start = new Date();
          start.setDate(start.getDate() - 7);
          analyticsParams.startDate = formatDate(start);
          analyticsParams.endDate = formatDate(new Date());
        } else if (filterPeriod === 'month') {
          const start = new Date();
          start.setMonth(start.getMonth() - 1);
          analyticsParams.startDate = formatDate(start);
          analyticsParams.endDate = formatDate(new Date());
        } else if (filterPeriod === 'custom' && startDate && endDate) {
          analyticsParams.startDate = startDate;
          analyticsParams.endDate = endDate;
        }

        const [salesResponse, branchesResponse, analyticsResponse] = await Promise.all([
          salesAPI.getAll(salesParams).catch((err) => {
            console.error(`[${new Date().toISOString()}] Sales fetch error:`, err);
            throw new Error(err.response?.status === 404 ? t.errors.path_not_found : t.errors.fetch_sales);
          }),
          branchesAPI.getAll().catch((err) => {
            console.error(`[${new Date().toISOString()}] Branch fetch error:`, err);
            throw new Error(err.response?.status === 404 ? t.errors.path_not_found : t.errors.fetch_branches);
          }),
          salesAPI.getAnalytics(analyticsParams).catch((err) => {
            console.error(`[${new Date().toISOString()}] Analytics fetch error:`, err);
            throw new Error(err.response?.status === 404 ? t.errors.path_not_found : t.errors.fetch_sales);
          }),
        ]);

        const returnsMap = new Map<string, Sale['returns']>();
        if (Array.isArray(salesResponse.returns)) {
          salesResponse.returns.forEach((ret: any) => {
            const saleId = ret.sale?._id || ret.sale;
            if (!isValidObjectId(saleId)) return;
            if (!returnsMap.has(saleId)) returnsMap.set(saleId, []);
            returnsMap.get(saleId)!.push({
              _id: ret._id || 'unknown',
              returnNumber: ret.returnNumber || 'N/A',
              status: ret.status || 'unknown',
              items: Array.isArray(ret.items)
                ? ret.items.map((item: any) => ({
                    productId: item.product?._id || item.productId || 'unknown',
                    productName: item.product?.name || t.departments.unknown,
                    productNameEn: item.product?.nameEn,
                    quantity: item.quantity || 0,
                    reason: item.reason || 'N/A',
                  }))
                : [],
              reason: ret.reason || 'N/A',
              createdAt: formatDate(ret.createdAt, language) || 'N/A',
            });
          });
        }

        const newSales = salesResponse.sales.map((sale: any) => {
          if (!isValidObjectId(sale._id)) {
            console.warn(`Invalid sale ID: ${sale._id}`);
            return null;
          }
          return {
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
                  productId: item.product?._id || item.productId || 'unknown',
                  productName: item.product?.name || t.departments.unknown,
                  productNameEn: item.product?.nameEn,
                  unit: item.product?.unit,
                  unitEn: item.product?.unitEn,
                  displayName: isRtl ? (item.product?.name || t.departments.unknown) : (item.product?.nameEn || item.product?.name || t.departments.unknown),
                  displayUnit: isRtl ? (item.product?.unit || t.units.default) : (item.product?.unitEn || item.product?.unit || t.units.default),
                  quantity: item.quantity || 0,
                  unitPrice: item.unitPrice || 0,
                  department: item.product?.department
                    ? {
                        _id: item.product.department._id || 'unknown',
                        name: item.product.department.name || t.departments.unknown,
                        nameEn: item.product.department.nameEn,
                        displayName: isRtl ? (item.product.department.name || t.departments.unknown) : (item.product.department.nameEn || item.product.department.name || t.departments.unknown),
                      }
                    : undefined,
                }))
              : [],
            totalAmount: sale.totalAmount || 0,
            createdAt: formatDate(sale.createdAt, language) || 'N/A',
            notes: sale.notes,
            paymentMethod: sale.paymentMethod,
            customerName: sale.customerName,
            customerPhone: sale.customerPhone,
            returns: returnsMap.get(sale._id) || [],
          };
        }).filter((sale: any) => sale !== null);

        setSales((prev) => (append ? [...prev, ...newSales] : newSales));
        setHasMore(salesResponse.total > pageNum * 20);

        const fetchedBranches = Array.isArray(branchesResponse.branches)
          ? branchesResponse.branches
              .filter((branch: any) => isValidObjectId(branch._id))
              .map((branch: any) => ({
                _id: branch._id,
                name: branch.name || t.branches.unknown,
                nameEn: branch.nameEn,
                displayName: isRtl ? (branch.name || t.branches.unknown) : (branch.nameEn || branch.name || t.branches.unknown),
              }))
          : [];
        setBranches(fetchedBranches);

        if (fetchedBranches.length === 0) {
          setError(t.errors.no_branches_available);
          toast.warn(t.errors.no_branches_available, { position: isRtl ? 'top-right' : 'top-left' });
        } else if (!filterBranch && fetchedBranches.length > 0) {
          setFilterBranch(fetchedBranches[0]._id);
        }

        setAnalytics({
          branchSales: Array.isArray(analyticsResponse.branchSales)
            ? analyticsResponse.branchSales.map((bs: any) => ({
                branchId: bs.branchId || 'unknown',
                branchName: bs.branchName || t.branches.unknown,
                branchNameEn: bs.branchNameEn,
                displayName: isRtl ? (bs.branchName || t.branches.unknown) : (bs.branchNameEn || bs.branchName || t.branches.unknown),
                totalSales: bs.totalSales || 0,
                saleCount: bs.saleCount || 0,
              }))
            : [],
          productSales: Array.isArray(analyticsResponse.productSales)
            ? analyticsResponse.productSales.map((ps: any) => ({
                productId: ps.productId || 'unknown',
                productName: ps.productName || t.departments.unknown,
                productNameEn: ps.productNameEn,
                displayName: isRtl ? (ps.productName || t.departments.unknown) : (ps.productNameEn || ps.productName || t.departments.unknown),
                totalQuantity: ps.totalQuantity || 0,
                totalRevenue: ps.totalRevenue || 0,
              }))
            : [],
          departmentSales: Array.isArray(analyticsResponse.departmentSales)
            ? analyticsResponse.departmentSales.map((ds: any) => ({
                departmentId: ds.departmentId || 'unknown',
                departmentName: ds.departmentName || t.departments.unknown,
                departmentNameEn: ds.departmentNameEn,
                displayName: isRtl ? (ds.departmentName || t.departments.unknown) : (ds.departmentNameEn || ds.departmentName || t.departments.unknown),
                totalRevenue: ds.totalRevenue || 0,
                totalQuantity: ds.totalQuantity || 0,
              }))
            : [],
          totalSales: analyticsResponse.totalSales || 0,
          totalCount: analyticsResponse.totalCount || 0,
          topProduct: analyticsResponse.topProduct
            ? {
                productId: analyticsResponse.topProduct.productId || null,
                productName: analyticsResponse.topProduct.productName || t.departments.unknown,
                productNameEn: analyticsResponse.topProduct.productNameEn,
                displayName: isRtl ? (analyticsResponse.topProduct.productName || t.departments.unknown) : (analyticsResponse.topProduct.productNameEn || analyticsResponse.topProduct.productName || t.departments.unknown),
                totalQuantity: analyticsResponse.topProduct.totalQuantity || 0,
                totalRevenue: analyticsResponse.topProduct.totalRevenue || 0,
              }
            : { productId: null, productName: t.departments.unknown, displayName: t.departments.unknown, totalQuantity: 0, totalRevenue: 0 },
          salesTrends: Array.isArray(analyticsResponse.salesTrends)
            ? analyticsResponse.salesTrends.map((trend: any) => ({
                period: formatDate(trend.period, language) || 'N/A',
                totalSales: trend.totalSales || 0,
                saleCount: trend.saleCount || 0,
              }))
            : [],
          topCustomers: Array.isArray(analyticsResponse.topCustomers)
            ? analyticsResponse.topCustomers.map((customer: any) => ({
                customerName: customer.customerName || 'N/A',
                customerPhone: customer.customerPhone || 'N/A',
                totalSpent: customer.totalSpent || 0,
                purchaseCount: customer.purchaseCount || 0,
              }))
            : [],
          paymentMethods: Array.isArray(analyticsResponse.paymentMethods)
            ? analyticsResponse.paymentMethods.map((pm: any) => ({
                paymentMethod: t.paymentMethods[pm.paymentMethod as keyof typeof t.paymentMethods] || pm.paymentMethod || 'Unknown',
                totalAmount: pm.totalAmount || 0,
                count: pm.count || 0,
              }))
            : [],
          returnStats: Array.isArray(analyticsResponse.returnStats)
            ? analyticsResponse.returnStats.map((rs: any) => ({
                status: t.returns.status[rs.status as keyof typeof t.returns.status] || rs.status || 'Unknown',
                count: rs.count || 0,
                totalQuantity: rs.totalQuantity || 0,
              }))
            : [],
        });

        setError('');
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Fetch error:`, err);
        const errorMessage =
          err.message.includes('Invalid sale ID') ? t.errors.invalid_sale_id :
          err.message.includes('Invalid branch ID') ? t.errors.invalid_branch_id :
          err.message.includes('not found') ? t.errors.path_not_found :
          err.message || t.errors.fetch_sales;
        setError(errorMessage);
        toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
        setSales([]);
      } finally {
        setLoading(false);
        setSalesLoading(false);
      }
    },
    [filterBranch, filterPeriod, startDate, endDate, user, t, isRtl, language]
  );

  useEffect(() => {
    if (!user || !user.token) {
      setError(t.errors.unauthorized_access);
      toast.error(t.errors.unauthorized_access, { position: isRtl ? 'top-right' : 'top-left' });
      setLoading(false);
      return;
    }
    if (filterPeriod !== 'custom' || (startDate && endDate)) {
      debouncedFetch(1, false);
    }
  }, [filterBranch, filterPeriod, startDate, endDate, debouncedFetch, user, t, isRtl]);

  const loadMoreSales = useCallback(() => {
    setPage((prev) => prev + 1);
    debouncedFetch(page + 1, true);
  }, [debouncedFetch, page]);

  const handleDeleteSale = useCallback(
    async (id: string) => {
      if (!isValidObjectId(id)) {
        toast.error(t.errors.invalid_sale_id, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      if (window.confirm(t.confirmDelete)) {
        try {
          await salesAPI.delete(id);
          toast.success(t.deleteSale, { position: isRtl ? 'top-right' : 'top-left' });
          debouncedFetch(1, false);
        } catch (err: any) {
          console.error(`[${new Date().toISOString()}] Delete error:`, err);
          const errorMessage = err.response?.status === 404 ? t.errors.path_not_found : t.errors.delete_sale_failed;
          setError(errorMessage);
          toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
        }
      }
    },
    [t, debouncedFetch, isRtl]
  );

  const handleExportReport = useCallback(async () => {
    try {
      const params: any = { format: 'csv', role: 'admin' };
      if (filterBranch && isValidObjectId(filterBranch)) params.branch = filterBranch;
      if (filterPeriod === 'day') {
        const today = new Date();
        params.startDate = formatDate(today);
        params.endDate = formatDate(today);
      } else if (filterPeriod === 'week') {
        const start = new Date();
        start.setDate(start.getDate() - 7);
        params.startDate = formatDate(start);
        params.endDate = formatDate(new Date());
      } else if (filterPeriod === 'month') {
        const start = new Date();
        start.setMonth(start.getMonth() - 1);
        params.startDate = formatDate(start);
        params.endDate = formatDate(new Date());
      } else if (filterPeriod === 'custom' && startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }
      await salesAPI.exportReport(params);
      toast.success(t.exportReport, { position: isRtl ? 'top-right' : 'top-left' });
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Export error:`, err);
      const errorMessage = err.response?.status === 404 ? t.errors.path_not_found : t.errors.export_failed;
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    }
  }, [filterBranch, filterPeriod, startDate, endDate, t, isRtl]);

  const branchOptions = useMemo(
    () => [
      { value: '', label: t.branches.all_branches },
      ...branches.map((branch) => ({
        value: branch._id,
        label: branch.displayName,
      })),
    ],
    [branches, t.branches]
  );

  const periodOptions = useMemo(
    () => [
      { value: 'day', label: t.day },
      { value: 'week', label: t.week },
      { value: 'month', label: t.month },
      { value: 'custom', label: t.customRange },
    ],
    [t]
  );

  const branchSalesChartData = useMemo(
    () => ({
      labels: analytics.branchSales.map((b) => b.displayName),
      datasets: [
        {
          label: t.branchSales,
          data: analytics.branchSales.map((b) => b.totalSales),
          backgroundColor: 'rgba(251, 191, 36, 0.6)',
          borderColor: 'rgba(251, 191, 36, 1)',
          borderWidth: 1,
        },
        {
          label: t.totalCount,
          data: analytics.branchSales.map((b) => b.saleCount),
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1,
        },
      ],
    }),
    [analytics.branchSales, t]
  );

  const productSalesChartData = useMemo(
    () => ({
      labels: analytics.productSales.slice(0, 5).map((p) => p.displayName),
      datasets: [
        {
          label: t.productSales,
          data: analytics.productSales.slice(0, 5).map((p) => p.totalRevenue),
          backgroundColor: 'rgba(251, 191, 36, 0.6)',
          borderColor: 'rgba(251, 191, 36, 1)',
          borderWidth: 1,
        },
        {
          label: t.quantity,
          data: analytics.productSales.slice(0, 5).map((p) => p.totalQuantity),
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
          borderColor: 'rgba(59, 130, 246, 1)',
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
          backgroundColor: 'rgba(251, 191, 36, 0.6)',
          borderColor: 'rgba(251, 191, 36, 1)',
          borderWidth: 1,
        },
        {
          label: t.quantity,
          data: analytics.departmentSales.map((d) => d.totalQuantity),
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
          borderColor: 'rgba(59, 130, 246, 1)',
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
          fill: false,
          borderColor: 'rgba(251, 191, 36, 1)',
          tension: 0.1,
        },
        {
          label: t.totalCount,
          data: analytics.salesTrends.map((t) => t.saleCount),
          fill: false,
          borderColor: 'rgba(59, 130, 246, 1)',
          tension: 0.1,
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
          backgroundColor: ['rgba(251, 191, 36, 0.6)', 'rgba(59, 130, 246, 0.6)', 'rgba(34, 197, 94, 0.6)'],
          borderColor: ['rgba(251, 191, 36, 1)', 'rgba(59, 130, 246, 1)', 'rgba(34, 197, 94, 1)'],
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
          backgroundColor: 'rgba(251, 191, 36, 0.6)',
          borderColor: 'rgba(251, 191, 36, 1)',
          borderWidth: 1,
        },
        {
          label: t.quantity,
          data: analytics.returnStats.map((rs) => rs.totalQuantity),
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1,
        },
      ],
    }),
    [analytics.returnStats, t]
  );

  return (
    <div className={`mx-auto px-4 sm:px-6 py-4 min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans ${isRtl ? 'font-arabic' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <header className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center gap-3">
          <DollarSign className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
            <p className="text-gray-600 text-sm">{t.subtitle}</p>
          </div>
        </div>
        <button
          onClick={handleExportReport}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 shadow-sm"
          aria-label={t.exportReport}
        >
          <Download className="w-4 h-4" />
          {t.exportReport}
        </button>
      </header>

      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm font-medium">{error}</span>
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-4 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('sales')}
          className={`px-6 py-2 rounded-t-lg text-sm font-medium transition-all duration-200 ${activeTab === 'sales' ? 'bg-amber-600 text-white shadow-md' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}
        >
          {t.salesTab}
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-6 py-2 rounded-t-lg text-sm font-medium transition-all duration-200 ${activeTab === 'analytics' ? 'bg-amber-600 text-white shadow-md' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}
        >
          {t.analyticsTab}
        </button>
      </div>

      <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">{t.filters}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Dropdown value={filterBranch} onChange={setFilterBranch} options={branchOptions} ariaLabel={t.branches.select_branch} disabled={branches.length === 0} />
          <Dropdown
            value={filterPeriod}
            onChange={(value) => {
              setFilterPeriod(value);
              if (value !== 'custom') {
                setStartDate('');
                setEndDate('');
              }
            }}
            options={periodOptions}
            ariaLabel={t.filterBy}
          />
          {filterPeriod === 'custom' && (
            <>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                aria-label={t.date}
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                aria-label={t.date}
              />
            </>
          )}
          <SearchInput value={searchInput} onChange={handleSearchChange} placeholder={t.searchPlaceholder} ariaLabel={t.searchPlaceholder} />
        </div>
      </div>

      {activeTab === 'sales' && (
        <div className="mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">{t.previousSales}</h2>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, index) => (
                <SaleSkeletonCard key={index} />
              ))}
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100">
              <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-sm font-medium">{t.noSales}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSales.map((sale) => (
                  <SaleCard key={sale._id} sale={sale} onEdit={() => {}} onDelete={handleDeleteSale} />
                ))}
              </div>
              {hasMore && (
                <div className="flex justify-center mt-6">
                  <button
                    onClick={loadMoreSales}
                    className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
                    disabled={salesLoading}
                  >
                    {salesLoading ? (
                      <svg className="animate-spin h-5 w-5 text-white mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
      )}

      {activeTab === 'analytics' && (
        <div className="mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">{t.analyticsTab}</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.branchSales}</h3>
              <div className="h-64">
                <Bar
                  data={branchSalesChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'top', labels: { font: { size: 12 } } },
                      title: { display: true, text: t.branchSales, font: { size: 16 } },
                      tooltip: {
                        callbacks: {
                          label: (context) => `${context.dataset.label}: ${formatNumber(context.parsed.y)} ${context.dataset.label === t.totalCount ? '' : t.currency}`,
                        },
                      },
                    },
                    scales: {
                      y: { beginAtZero: true, ticks: { callback: (value) => formatNumber(value) } },
                      x: { ticks: { maxRotation: 45, minRotation: 0 } },
                    },
                  }}
                />
              </div>
            </div>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.productSales}</h3>
              <div className="h-64">
                <Bar
                  data={productSalesChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'top', labels: { font: { size: 12 } } },
                      title: { display: true, text: t.productSales, font: { size: 16 } },
                      tooltip: {
                        callbacks: {
                          label: (context) => `${context.dataset.label}: ${formatNumber(context.parsed.y)} ${context.dataset.label === t.quantity ? '' : t.currency}`,
                        },
                      },
                    },
                    scales: {
                      y: { beginAtZero: true, ticks: { callback: (value) => formatNumber(value) } },
                      x: { ticks: { maxRotation: 45, minRotation: 0 } },
                    },
                  }}
                />
              </div>
            </div>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.departmentSales}</h3>
              <div className="h-64">
                <Bar
                  data={departmentSalesChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'top', labels: { font: { size: 12 } } },
                      title: { display: true, text: t.departmentSales, font: { size: 16 } },
                      tooltip: {
                        callbacks: {
                          label: (context) => `${context.dataset.label}: ${formatNumber(context.parsed.y)} ${context.dataset.label === t.quantity ? '' : t.currency}`,
                        },
                      },
                    },
                    scales: {
                      y: { beginAtZero: true, ticks: { callback: (value) => formatNumber(value) } },
                      x: { ticks: { maxRotation: 45, minRotation: 0 } },
                    },
                  }}
                />
              </div>
            </div>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.salesTrends}</h3>
              <div className="h-64">
                <Line
                  data={salesTrendsChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'top', labels: { font: { size: 12 } } },
                      title: { display: true, text: t.salesTrends, font: { size: 16 } },
                      tooltip: {
                        callbacks: {
                          label: (context) => `${context.dataset.label}: ${formatNumber(context.parsed.y)} ${context.dataset.label === t.totalCount ? '' : t.currency}`,
                        },
                      },
                    },
                    scales: {
                      y: { beginAtZero: true, ticks: { callback: (value) => formatNumber(value) } },
                      x: { ticks: { maxRotation: 45, minRotation: 0 } },
                    },
                  }}
                />
              </div>
            </div>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.paymentMethodsLabel}</h3>
              <div className="h-64">
                <Pie
                  data={paymentMethodsChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'top', labels: { font: { size: 12 } } },
                      title: { display: true, text: t.paymentMethodsLabel, font: { size: 16 } },
                      tooltip: {
                        callbacks: {
                          label: (context) => `${context.label}: ${formatNumber(context.parsed)} ${t.currency}`,
                        },
                      },
                    },
                  }}
                />
              </div>
            </div>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.returnStats}</h3>
              <div className="h-64">
                <Bar
                  data={returnStatsChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'top', labels: { font: { size: 12 } } },
                      title: { display: true, text: t.returnStats, font: { size: 16 } },
                      tooltip: {
                        callbacks: {
                          label: (context) => `${context.dataset.label}: ${formatNumber(context.parsed.y)}`,
                        },
                      },
                    },
                    scales: {
                      y: { beginAtZero: true, ticks: { callback: (value) => formatNumber(value) } },
                      x: { ticks: { maxRotation: 45, minRotation: 0 } },
                    },
                  }}
                />
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.totalSales}</h3>
              <p className="text-2xl font-bold text-amber-600">{formatNumber(analytics.totalSales)} {t.currency}</p>
              <p className="text-sm text-gray-600 mt-2">{t.totalCount}: {analytics.totalCount}</p>
              <p className="text-sm text-gray-600 mt-2">{t.topProduct}: {analytics.topProduct.displayName} ({analytics.topProduct.totalQuantity})</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.topCustomers}</h3>
              {analytics.topCustomers.length > 0 ? (
                <ul className="space-y-2">
                  {analytics.topCustomers.map((customer, index) => (
                    <li key={index} className="text-sm text-gray-600">
                      {customer.customerName || t.branches.unknown} ({customer.customerPhone || 'N/A'}) - {formatNumber(customer.totalSpent)} {t.currency}, {customer.purchaseCount} {t.totalCount}
                    </li>
                  ))}
                </ul>
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

export default React.memo(AdminSalesReport);