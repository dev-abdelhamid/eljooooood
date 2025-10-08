import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { salesAPI, branchesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, DollarSign, Search, X, ChevronDown, Edit, Trash, BarChart2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import Papa from 'papaparse';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Sale {
  _id: string;
  orderNumber: string;
  branch: { _id: string; name: string; nameEn?: string; displayName: string };
  items: Array<{
    product: string;
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

interface SalesTrend {
  period: string;
  totalSales: number;
}

const translations = {
  ar: {
    title: 'تقرير المبيعات',
    subtitle: 'متابعة وتحليل المبيعات السابقة',
    previousSales: 'المبيعات السابقة',
    noSales: 'لا توجد مبيعات',
    date: 'التاريخ',
    branch: 'الفرع',
    quantity: 'الكمية',
    branchFilter: 'اختر فرعًا',
    allBranches: 'جميع الفروع',
    searchPlaceholder: 'ابحث عن المبيعات، العملاء، أو المنتجات...',
    loadMore: 'تحميل المزيد',
    editSale: 'تعديل المبيعة',
    deleteSale: 'حذف المبيعة',
    confirmDelete: 'هل أنت متأكد من حذف هذه المبيعة؟',
    export: 'تصدير إلى CSV',
    filterBy: 'تصفية حسب',
    all: 'الكل',
    day: 'اليوم',
    week: 'الأسبوع',
    month: 'الشهر',
    custom: 'مخصص',
    salesTrends: 'اتجاهات المبيعات',
    totalSales: 'إجمالي المبيعات',
    customerNameLabel: 'اسم العميل',
    customerPhoneLabel: 'رقم الهاتف',
    paymentMethodLabel: 'طريقة الدفع',
    errors: {
      unauthorized_access: 'غير مصرح لك بالوصول',
      fetch_sales: 'خطأ أثناء جلب المبيعات',
      fetch_branches: 'خطأ أثناء جلب الفروع',
      delete_sale_failed: 'فشل حذف المبيعة',
      departments: { unknown: 'غير معروف' },
      deleted_product: 'منتج محذوف',
      no_analytics: 'لا توجد إحصائيات متاحة',
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
    subtitle: 'Track and analyze previous sales',
    previousSales: 'Previous Sales',
    noSales: 'No sales found',
    date: 'Date',
    branch: 'Branch',
    quantity: 'Quantity',
    branchFilter: 'Select Branch',
    allBranches: 'All Branches',
    searchPlaceholder: 'Search sales, customers, or products...',
    loadMore: 'Load More',
    editSale: 'Edit Sale',
    deleteSale: 'Delete Sale',
    confirmDelete: 'Are you sure you want to delete this sale?',
    export: 'Export to CSV',
    filterBy: 'Filter By',
    all: 'All',
    day: 'Day',
    week: 'Week',
    month: 'Month',
    custom: 'Custom',
    salesTrends: 'Sales Trends',
    totalSales: 'Total Sales',
    customerNameLabel: 'Customer Name',
    customerPhoneLabel: 'Phone Number',
    paymentMethodLabel: 'Payment Method',
    errors: {
      unauthorized_access: 'You are not authorized to access',
      fetch_sales: 'Error fetching sales',
      fetch_branches: 'Error fetching branches',
      delete_sale_failed: 'Failed to delete sale',
      departments: { unknown: 'Unknown' },
      deleted_product: 'Deleted Product',
      no_analytics: 'No analytics available',
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

// دالة مساعدة للتأكد من أن القيمة عدد صالح
const safeNumber = (value: any, defaultValue: number = 0): number => {
  return typeof value === 'number' && !isNaN(value) ? value : defaultValue;
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
    </div>
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
    <div className="relative group">
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

const BranchFilter = React.memo<{
  branches: Branch[];
  selectedBranch: string;
  onChange: (value: string) => void;
  placeholder: string;
  allBranchesLabel: string;
}>(({ branches, selectedBranch, onChange, placeholder, allBranchesLabel }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="relative group">
      <select
        value={selectedBranch}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm font-alexandria`}
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
        className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 group-focus-within:text-amber-500`}
      />
    </div>
  );
});

const SaleCard = React.memo<{ sale: Sale; onEdit: (sale: Sale) => void; onDelete: (id: string) => void }>(
  ({ sale, onEdit, onDelete }) => {
    const { language } = useLanguage();
    const isRtl = language === 'ar';
    const t = translations[isRtl ? 'ar' : 'en'];
    return (
      <div className="p-6 bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-amber-200">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div className="space-y-3 w-full">
            <h3 className="font-bold text-gray-900 text-xl font-alexandria">{sale.orderNumber}</h3>
            <p className="text-sm text-gray-600 font-alexandria">{t.date}: {sale.createdAt}</p>
            <p className="text-sm text-gray-600 font-alexandria">{t.branch}: {sale.branch?.displayName || t.errors.departments.unknown}</p>
            <p className="text-sm text-gray-600 font-alexandria">{t.totalSales}: {safeNumber(sale.totalAmount).toFixed(2)} {t.currency}</p>
            {sale.paymentMethod && (
              <p className="text-sm text-gray-600 font-alexandria">
                <span className="font-medium">{t.paymentMethodLabel}: </span>
                {t.paymentMethods[sale.paymentMethod as keyof typeof t.paymentMethods] || 'N/A'}
              </p>
            )}
            {sale.customerName && (
              <p className="text-sm text-gray-600 font-alexandria">
                <span className="font-medium">{t.customerNameLabel}: </span>{sale.customerName}
              </p>
            )}
            {sale.customerPhone && (
              <p className="text-sm text-gray-600 font-alexandria">
                <span className="font-medium">{t.customerPhoneLabel}: </span>{sale.customerPhone}
              </p>
            )}
            {sale.notes && <p className="text-sm text-gray-500 italic font-alexandria">{t.notes}: {sale.notes}</p>}
            <ul className="space-y-2 text-sm text-gray-700">
              {sale.items.map((item, index) => (
                <li key={index} className="border-t border-gray-100 pt-2 font-alexandria">
                  {item.displayName || t.errors.deleted_product} ({item.department?.displayName || t.errors.departments.unknown}) - {t.quantity}: {safeNumber(item.quantity)} {item.displayUnit || t.units.default}, {t.totalSales}: {safeNumber(item.unitPrice).toFixed(2)} {t.currency}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-3">
            <button onClick={() => onEdit(sale)} aria-label={t.editSale} className="p-2.5 rounded-full hover:bg-gray-100 transition-colors duration-200">
              <Edit className="w-5 h-5 text-blue-600 hover:text-blue-800" />
            </button>
            <button onClick={() => onDelete(sale._id)} aria-label={t.deleteSale} className="p-2.5 rounded-full hover:bg-gray-100 transition-colors duration-200">
              <Trash className="w-5 h-5 text-red-600 hover:text-red-800" />
            </button>
          </div>
        </div>
      </div>
    );
  }
);

const SaleSkeletonCard = React.memo(() => (
  <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse">
    <div className="space-y-3">
      <div className="h-5 bg-gray-200 rounded w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      <div className="h-4 bg-gray-200 rounded w-1/3"></div>
      <div className="h-4 bg-gray-200 rounded w-2/3"></div>
    </div>
  </div>
));

const SalesReport: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { socket, emit, isConnected } = useSocket();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [sales, setSales] = useState<Sale[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [salesTrends, setSalesTrends] = useState<SalesTrend[]>([]);
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [salesLoading, setSalesLoading] = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const debouncedSearch = useCallback(debounce((value: string) => setSearchTerm(value.trim()), 300), []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSearch(value);
  };

  // حساب التواريخ بناءً على الفترة
  useEffect(() => {
    const today = new Date();
    let newStartDate = '';
    let newEndDate = today.toISOString().split('T')[0];

    if (filterPeriod === 'day') {
      newStartDate = newEndDate;
    } else if (filterPeriod === 'week') {
      const firstDayOfWeek = new Date(today);
      firstDayOfWeek.setDate(today.getDate() - today.getDay() + 1);
      newStartDate = firstDayOfWeek.toISOString().split('T')[0];
    } else if (filterPeriod === 'month') {
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      newStartDate = firstDayOfMonth.toISOString().split('T')[0];
    } else if (filterPeriod === 'custom') {
      return;
    } else {
      newStartDate = '';
      newEndDate = '';
    }

    setFilterStartDate(newStartDate);
    setFilterEndDate(newEndDate);
  }, [filterPeriod]);

  const fetchBranches = useCallback(async () => {
    if (user?.role !== 'admin') return;
    setBranchesLoading(true);
    try {
      const response = await branchesAPI.getAll();
      console.log(`[${new Date().toISOString()}] Branches response:`, response);
      setBranches(
        response.map((branch: any) => ({
          _id: branch._id,
          name: branch.name || t.errors.departments.unknown,
          nameEn: branch.nameEn,
          displayName: isRtl ? (branch.name || t.errors.departments.unknown) : (branch.nameEn || branch.name || t.errors.departments.unknown),
        }))
      );
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Fetch branches error:`, { message: err.message, stack: err.stack });
      setError(t.errors.fetch_branches);
      toast.error(t.errors.fetch_branches, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
    } finally {
      setBranchesLoading(false);
    }
  }, [user, isRtl, t]);

  const fetchSales = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      if (user?.role !== 'admin') {
        setError(t.errors.unauthorized_access);
        toast.error(t.errors.unauthorized_access, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
        setLoading(false);
        return;
      }
      setLoading(pageNum === 1);
      setSalesLoading(pageNum > 1);
      try {
        const salesParams: any = { page: pageNum, limit: 20, sort: '-createdAt', branch: filterBranch };
        if (filterPeriod !== 'all' && filterStartDate && filterEndDate) {
          salesParams.startDate = filterStartDate;
          salesParams.endDate = filterEndDate;
        }
        const salesResponse = await salesAPI.getAll(salesParams);
        console.log(`[${new Date().toISOString()}] Sales response:`, salesResponse);

        const newSales = (salesResponse.sales || []).map((sale: any) => ({
          _id: sale._id,
          orderNumber: sale.saleNumber || sale.orderNumber || 'N/A',
          branch: sale.branch
            ? {
                _id: sale.branch._id,
                name: sale.branch.name || t.errors.departments.unknown,
                nameEn: sale.branch.nameEn,
                displayName: isRtl ? (sale.branch.name || t.errors.departments.unknown) : (sale.branch.nameEn || sale.branch.name || t.errors.departments.unknown),
              }
            : { _id: '', name: '', displayName: t.errors.departments.unknown },
          items: (sale.items || []).map((item: any) => ({
            product: item.product?._id || item.productId || '',
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
            quantity: safeNumber(item.quantity),
            unitPrice: safeNumber(item.unitPrice),
            department: item.product?.department
              ? {
                  _id: item.product.department._id,
                  name: item.product.department.name || t.errors.departments.unknown,
                  nameEn: item.product.department.nameEn,
                  displayName: isRtl
                    ? (item.product.department.name || t.errors.departments.unknown)
                    : (item.product.department.nameEn || item.product.department.name || t.errors.departments.unknown),
                }
              : undefined,
          })),
          totalAmount: safeNumber(sale.totalAmount),
          createdAt: formatDate(new Date(sale.createdAt), language),
          notes: sale.notes,
          paymentMethod: sale.paymentMethod,
          customerName: sale.customerName || t.errors.departments.unknown,
          customerPhone: sale.customerPhone,
        }));
        setSales((prev) => (append ? [...prev, ...newSales] : newSales));
        setHasMore(salesResponse.total > pageNum * 20);

        // جلب اتجاهات المبيعات
        const analyticsParams = { ...salesParams, groupBy: 'day' };
        const analyticsResponse = await salesAPI.getAnalytics(analyticsParams);
        console.log(`[${new Date().toISOString()}] Analytics response:`, analyticsResponse);
        setSalesTrends(
          (analyticsResponse.salesTrends || []).map((trend: any) => ({
            period: formatDate(new Date(trend.period), language),
            totalSales: safeNumber(trend.totalSales),
          }))
        );

        setError('');
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Fetch sales error:`, { message: err.message, stack: err.stack });
        setError(t.errors.fetch_sales);
        toast.error(t.errors.fetch_sales, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
        setSales([]);
        setSalesTrends([]);
      } finally {
        setLoading(false);
        setSalesLoading(false);
      }
    },
    [user, t, isRtl, language, filterBranch, filterPeriod, filterStartDate, filterEndDate]
  );

  useEffect(() => {
    fetchBranches();
    fetchSales();
  }, [fetchBranches, fetchSales]);

  useEffect(() => {
    if (!socket || !isConnected) return;
    socket.on('saleCreated', (data: any) => {
      toast.info(isRtl ? `تم إنشاء مبيعة جديدة: ${data.saleNumber}` : `New sale created: ${data.saleNumber}`, {
        position: isRtl ? 'top-right' : 'top-left',
        autoClose: 3000,
      });
      if (!filterBranch || data.branchId === filterBranch) {
        fetchSales();
      }
    });
    socket.on('saleDeleted', (data: any) => {
      toast.info(isRtl ? `تم حذف مبيعة: ${data.saleId}` : `Sale deleted: ${data.saleId}`, {
        position: isRtl ? 'top-right' : 'top-left',
        autoClose: 3000,
      });
      if (!filterBranch || data.branchId === filterBranch) {
        fetchSales();
      }
    });
    return () => {
      socket.off('saleCreated');
      socket.off('saleDeleted');
    };
  }, [socket, isConnected, fetchSales, filterBranch, isRtl]);

  const loadMoreSales = useCallback(() => {
    setPage((prev) => prev + 1);
    fetchSales(page + 1, true);
  }, [fetchSales, page]);

  const handleEditSale = useCallback((sale: Sale) => {
    toast.info(t.editSale, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
  }, [t, isRtl]);

  const handleDeleteSale = useCallback(
    async (id: string) => {
      if (window.confirm(t.confirmDelete)) {
        try {
          await salesAPI.delete(id);
          toast.success(t.deleteSale, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
          emit('saleDeleted', { saleId: id, branchId: filterBranch });
          fetchSales();
        } catch (err: any) {
          console.error(`[${new Date().toISOString()}] Delete error:`, { message: err.message, stack: err.stack });
          setError(t.errors.delete_sale_failed);
          toast.error(t.errors.delete_sale_failed, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
        }
      }
    },
    [t, emit, fetchSales, isRtl, filterBranch]
  );

  const handleExport = useCallback(() => {
    const csvData = sales.map((sale) => ({
      OrderNumber: sale.orderNumber,
      Branch: sale.branch?.displayName || t.errors.departments.unknown,
      TotalAmount: safeNumber(sale.totalAmount).toFixed(2),
      CreatedAt: sale.createdAt,
      PaymentMethod: sale.paymentMethod ? t.paymentMethods[sale.paymentMethod as keyof typeof t.paymentMethods] : 'N/A',
      CustomerName: sale.customerName || 'N/A',
      CustomerPhone: sale.customerPhone || 'N/A',
      Items: sale.items
        .map((item) => `${item.displayName} (${safeNumber(item.quantity)} x ${safeNumber(item.unitPrice).toFixed(2)} ${t.currency})`)
        .join('; '),
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sales_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }, [sales, t]);

  const filteredSales = useMemo(
    () =>
      sales.filter((sale) => {
        const term = searchTerm.toLowerCase();
        return (
          sale.orderNumber.toLowerCase().includes(term) ||
          (sale.customerName?.toLowerCase().includes(term) ?? false) ||
          (sale.customerPhone?.toLowerCase().includes(term) ?? false) ||
          sale.items.some((item) => item.displayName.toLowerCase().includes(term))
        );
      }),
    [sales, searchTerm]
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

  const chartColors = useMemo(() => ['#FFBB28', '#FF8042', '#0088FE', '#00C49F', '#FF4444'], []);

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4 font-alexandria" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <span className="text-red-600 text-base font-medium font-alexandria">{t.errors.unauthorized_access}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 sm:px-6 py-8 bg-gradient-to-br from-gray-50 to-gray-100 font-alexandria" dir={isRtl ? 'rtl' : 'ltr'}>
      <link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600&display=swap" rel="stylesheet" />
      <header className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center gap-3">
          <DollarSign className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-alexandria">{t.title}</h1>
            <p className="text-gray-600 text-sm font-alexandria">{t.subtitle}</p>
          </div>
        </div>
      </header>
      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm font-medium font-alexandria">{error}</span>
        </div>
      )}
      <div className="space-y-8">
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.filterBy}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm font-alexandria`}
                  aria-label={t.date}
                />
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm font-alexandria`}
                  aria-label={t.date}
                />
              </>
            )}
            <BranchFilter
              branches={branches}
              selectedBranch={filterBranch}
              onChange={setFilterBranch}
              placeholder={t.branchFilter}
              allBranchesLabel={t.allBranches}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 font-alexandria"
              aria-label={t.export}
            >
              {t.export}
            </button>
          </div>
        </div>
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.salesTrends}</h3>
          {salesTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="totalSales" stroke={chartColors[0]} name={t.totalSales} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-gray-500 font-alexandria">{t.errors.no_analytics}</div>
          )}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.previousSales}</h2>
          {loading || branchesLoading ? (
            <div className="grid grid-cols-1 gap-6">
              {[...Array(6)].map((_, index) => (
                <SaleSkeletonCard key={index} />
              ))}
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100">
              <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-sm font-medium font-alexandria">{t.noSales}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6">
                {filteredSales.map((sale) => (
                  <SaleCard key={sale._id} sale={sale} onEdit={handleEditSale} onDelete={handleDeleteSale} />
                ))}
              </div>
              {hasMore && (
                <div className="flex justify-center mt-6">
                  <button
                    onClick={loadMoreSales}
                    className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50 font-alexandria"
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
      </div>
    </div>
  );
};