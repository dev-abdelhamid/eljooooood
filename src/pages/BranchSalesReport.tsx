import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { salesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, DollarSign, Trash2, Search, X, ChevronDown, Eye } from 'lucide-react';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';

// واجهات TypeScript
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

interface FilterState {
  searchTerm: string;
  paymentMethod: string;
  minTotal: number | null;
  maxTotal: number | null;
}

const translations = {
  ar: {
    title: 'تقرير المبيعات',
    subtitle: 'متابعة المبيعات السابقة',
    filters: 'الفلاتر',
    previousSales: 'المبيعات السابقة',
    noSales: 'لا توجد مبيعات',
    date: 'التاريخ',
    returns: 'المرتجعات',
    return: 'مرتجع',
    reason: 'السبب',
    quantity: 'الكمية',
    searchPlaceholder: 'ابحث عن المبيعات أو العملاء أو المنتجات...',
    loadMore: 'تحميل المزيد',
    filterBy: 'تصفية حسب',
    customRange: 'نطاق مخصص',
    allPaymentMethods: 'كل الطرق',
    paymentMethod: 'طريقة الدفع',
    totalRange: 'نطاق الإجمالي',
    deleteSale: 'حذف المبيعة',
    viewDetails: 'عرض التفاصيل',
    exportCSV: 'تصدير كـ CSV',
    errors: {
      unauthorized_access: 'غير مصرح لك بالوصول',
      no_branch_assigned: 'لم يتم تعيين فرع',
      fetch_sales: 'خطأ أثناء جلب المبيعات',
      delete_sale_failed: 'فشل حذف المبيعة',
      sale_not_found: 'المبيعة غير موجودة',
    },
    currency: 'ريال',
    branches: { all_branches: 'كل الفروع', select_branch: 'اختر الفرع', unknown: 'غير معروف' },
    departments: { unknown: 'غير معروف' },
    paymentMethods: {
      cash: 'نقدي',
      credit_card: 'بطاقة ائتمان',
      bank_transfer: 'تحويل بنكي',
    },
    customerName: 'اسم العميل',
    customerPhone: 'هاتف العميل',
    total: 'الإجمالي',
    notes: 'ملاحظات',
    units: { default: 'غير محدد' },
  },
  en: {
    title: 'Sales Report',
    subtitle: 'Track previous sales',
    filters: 'Filters',
    previousSales: 'Previous Sales',
    noSales: 'No sales found',
    date: 'Date',
    returns: 'Returns',
    return: 'Return',
    reason: 'Reason',
    quantity: 'Quantity',
    searchPlaceholder: 'Search sales, customers, or products...',
    loadMore: 'Load More',
    filterBy: 'Filter By',
    customRange: 'Custom Range',
    allPaymentMethods: 'All Methods',
    paymentMethod: 'Payment Method',
    totalRange: 'Total Range',
    deleteSale: 'Delete Sale',
    viewDetails: 'View Details',
    exportCSV: 'Export as CSV',
    errors: {
      unauthorized_access: 'You are not authorized to access',
      no_branch_assigned: 'No branch assigned',
      fetch_sales: 'Error fetching sales',
      delete_sale_failed: 'Failed to delete sale',
      sale_not_found: 'Sale not found',
    },
    currency: 'SAR',
    branches: { all_branches: 'All Branches', select_branch: 'Select Branch', unknown: 'Unknown' },
    departments: { unknown: 'Unknown' },
    paymentMethods: {
      cash: 'Cash',
      credit_card: 'Credit Card',
      bank_transfer: 'Bank Transfer',
    },
    customerName: 'Customer Name',
    customerPhone: 'Customer Phone',
    total: 'Total',
    notes: 'Notes',
    units: { default: 'N/A' },
  },
};

// مكونات فرعية
// مكون البحث
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

// مكون القائمة المنسدلة
const Dropdown = React.memo<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
}>(({ value, onChange, options, ariaLabel }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((opt) => opt.value === value) || options[0] || { value: '', label: isRtl ? 'اختر' : 'Select' };
  return (
    <div className="relative group">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 bg-gradient-to-r from-white to-gray-50 shadow-sm hover:shadow-md text-sm text-gray-700 ${isRtl ? 'text-right' : 'text-left'} flex justify-between items-center`}
        aria-label={ariaLabel}
      >
        <span className="truncate">{selectedOption.label}</span>
        <ChevronDown className={`${isOpen ? 'rotate-180' : 'rotate-0'} transition-transform duration-200 w-5 h-5 text-gray-400 group-focus-within:text-amber-500`} />
      </button>
      {isOpen && (
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

// مكون عرض تفاصيل المبيعة
const SaleModal = React.memo<{
  sale: Sale | null;
  onClose: () => void;
}>(({ sale, onClose }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  if (!sale) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto scrollbar-none">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-900">{t.title} #{sale.saleNumber}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-amber-600">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="space-y-4">
          <p><strong>{t.customerName}:</strong> {sale.customerName || 'N/A'}</p>
          <p><strong>{t.customerPhone}:</strong> {sale.customerPhone || 'N/A'}</p>
          <p><strong>{t.paymentMethod}:</strong> {t.paymentMethods[sale.paymentMethod as keyof typeof t.paymentMethods] || 'N/A'}</p>
          <p><strong>{t.total}:</strong> {sale.totalAmount.toFixed(2)} {t.currency}</p>
          <p><strong>{t.date}:</strong> {sale.createdAt}</p>
          <p><strong>{t.notes}:</strong> {sale.notes || 'N/A'}</p>
          <div>
            <h4 className="font-semibold text-gray-900">{t.previousSales}:</h4>
            <ul className="mt-2 space-y-2">
              {sale.items.map((item, index) => (
                <li key={index} className="border-b pb-2">
                  <p><strong>{t.previousSales}:</strong> {item.displayName || t.departments.unknown}</p>
                  <p><strong>{t.quantity}:</strong> {item.quantity}</p>
                  <p><strong>{t.unitPrice}:</strong> {item.unitPrice}</p>
                  <p><strong>{t.units.default}:</strong> {item.displayUnit || t.units.default}</p>
                </li>
              ))}
            </ul>
          </div>
          {sale.returns && sale.returns.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900">{t.returns}:</h4>
              <ul className="mt-2 space-y-2">
                {sale.returns.map((ret, index) => (
                  <li key={index} className="border-b pb-2">
                    <p><strong>{t.return} #{ret.returnNumber} ({ret.status})</strong></p>
                    <p><strong>{t.reason}:</strong> {ret.reason}</p>
                    <p><strong>{t.date}:</strong> {ret.createdAt}</p>
                    <ul className="list-disc list-inside ml-4">
                      {ret.items.map((item, i) => (
                        <li key={i}>
                          {item.productName || t.departments.unknown} - {t.quantity}: {item.quantity}, {t.reason}: {item.reason}
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

// المكون الرئيسي
export const BranchSalesReport: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'] || translations.en;

  const [sales, setSales] = useState<Sale[]>([]);
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterState, setFilterState] = useState<FilterState>({
    searchTerm: '',
    paymentMethod: '',
    minTotal: null,
    maxTotal: null,
  });
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [salesLoading, setSalesLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [sortField, setSortField] = useState<'createdAt' | 'totalAmount'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  // التحقق من الصلاحيات
  useEffect(() => {
    if (!user?.role || user.role !== 'branch') {
      setError(t.errors.unauthorized_access);
      toast.error(t.errors.unauthorized_access, { position: isRtl ? 'top-right' : 'top-left' });
      navigate('/unauthorized');
    }
  }, [user, t, isRtl, navigate]);

  // البحث المؤخر
  const debouncedSearch = useCallback(
    debounce((value: string) => setFilterState((prev) => ({ ...prev, searchTerm: value.trim() })), 300),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSearch(value);
  };

  // جلب البيانات
  const fetchData = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      if (!user?.branchId) {
        setError(t.errors.no_branch_assigned);
        toast.error(t.errors.no_branch_assigned, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }

      setLoading(pageNum === 1);
      setSalesLoading(pageNum > 1);

      try {
        const salesParams: any = { page: pageNum, limit: 20, sort: '-createdAt', branch: user.branchId };
        if (filterPeriod === 'custom' && startDate && endDate) {
          salesParams.startDate = startDate;
          salesParams.endDate = endDate;
        }

        const salesResponse = await salesAPI.getAll(salesParams).catch((err) => {
          console.error(`[${new Date().toISOString()}] Sales fetch error:`, err);
          toast.error(t.errors.fetch_sales, { position: isRtl ? 'top-right' : 'top-left' });
          return { sales: [], total: 0, returns: [] };
        });

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
                    productId: item.product?._id || item.productId,
                    productName: item.product?.name || t.departments.unknown,
                    productNameEn: item.product?.nameEn,
                    quantity: item.quantity,
                    reason: item.reason,
                  }))
                : [],
              reason: ret.reason,
              createdAt: formatDate(new Date(ret.createdAt), isRtl ? 'ar' : 'en'),
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
                productId: item.product?._id || item.productId,
                productName: item.product?.name || t.departments.unknown,
                productNameEn: item.product?.nameEn,
                unit: item.product?.unit,
                unitEn: item.product?.unitEn,
                displayName: isRtl ? (item.product?.name || t.departments.unknown) : (item.product?.nameEn || item.product?.name || t.departments.unknown),
                displayUnit: isRtl ? (item.product?.unit || t.units.default) : (item.product?.unitEn || item.product?.unit || t.units.default),
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                department: item.product?.department
                  ? {
                      _id: item.product.department._id,
                      name: item.product.department.name,
                      nameEn: item.product.department.nameEn,
                      displayName: isRtl ? (item.product.department.name || t.departments.unknown) : (item.product.department.nameEn || item.product.department.name || t.departments.unknown),
                    }
                  : undefined,
              }))
            : [],
          totalAmount: sale.totalAmount || sale.items.reduce((sum: number, item: any) => sum + item.quantity * item.unitPrice, 0),
          createdAt: formatDate(new Date(sale.createdAt), isRtl ? 'ar' : 'en'),
          notes: sale.notes,
          paymentMethod: sale.paymentMethod,
          customerName: sale.customerName,
          customerPhone: sale.customerPhone,
          returns: returnsMap.get(sale._id) || [],
        }));

        setSales((prev) => (append ? [...prev, ...newSales] : newSales));
        setHasMore(salesResponse.total > pageNum * 20);
        if (newSales.length === 0 && pageNum === 1) {
          setError(t.noSales);
          toast.warn(t.noSales, { position: isRtl ? 'top-right' : 'top-left' });
        } else {
          setError('');
        }
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Fetch error:`, err);
        const errorMessage = err.response?.status === 403 ? t.errors.unauthorized_access : err.message || t.errors.fetch_sales;
        setError(errorMessage);
        toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
        setSales([]);
      } finally {
        setLoading(false);
        setSalesLoading(false);
      }
    },
    [filterPeriod, startDate, endDate, user, t, isRtl]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // تحميل المزيد
  const loadMoreSales = useCallback(() => {
    setPage((prev) => prev + 1);
    fetchData(page + 1, true);
  }, [fetchData, page]);

  // تصفية وفرز المبيعات
  const filteredSales = useMemo(() => {
    return sales
      .filter((sale) => {
        const lowerSearchTerm = filterState.searchTerm.toLowerCase();
        const matchesCustomerName = sale.customerName?.toLowerCase().includes(lowerSearchTerm);
        const matchesCustomerPhone = sale.customerPhone?.toLowerCase().includes(lowerSearchTerm);
        const matchesProducts = sale.items.some((item) => item.displayName.toLowerCase().includes(lowerSearchTerm));
        const matchesSaleNumber = sale.saleNumber.toLowerCase().includes(lowerSearchTerm);
        const matchesPaymentMethod = !filterState.paymentMethod || sale.paymentMethod === filterState.paymentMethod;
        const matchesMinTotal = filterState.minTotal === null || sale.totalAmount >= filterState.minTotal;
        const matchesMaxTotal = filterState.maxTotal === null || sale.totalAmount <= filterState.maxTotal;
        return (matchesCustomerName || matchesCustomerPhone || matchesProducts || matchesSaleNumber) && matchesPaymentMethod && matchesMinTotal && matchesMaxTotal;
      })
      .sort((a, b) => {
        if (sortField === 'createdAt') {
          return sortOrder === 'asc'
            ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        } else {
          return sortOrder === 'asc' ? a.totalAmount - b.totalAmount : b.totalAmount - a.totalAmount;
        }
      });
  }, [sales, filterState, sortField, sortOrder]);

  // حذف المبيعة
  const handleDeleteSale = useCallback(
    async (id: string) => {
      try {
        const sale = await salesAPI.getById(id);
        if (!sale) {
          toast.error(t.errors.sale_not_found, { position: isRtl ? 'top-right' : 'top-left' });
          return;
        }
        if (user?.role === 'branch' && sale.branch._id !== user.branchId) {
          toast.error(t.errors.unauthorized_access, { position: isRtl ? 'top-right' : 'top-left' });
          return;
        }
        if (window.confirm(isRtl ? 'هل أنت متأكد من حذف هذه المبيعة؟' : 'Are you sure you want to delete this sale?')) {
          await salesAPI.delete(id);
          toast.success(t.deleteSale, { position: isRtl ? 'top-right' : 'top-left' });
          setSales((prev) => prev.filter((sale) => sale._id !== id));
        }
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Sale deletion error:`, err);
        const errorMessage = err.response?.status === 403 ? t.errors.unauthorized_access : t.errors.delete_sale_failed;
        toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
      }
    },
    [t, isRtl, user]
  );

  // تصدير كـ CSV بدون file-saver
  const handleExportCSV = useCallback(() => {
    const headers = [
      'Sale Number',
      t.customerName,
      t.customerPhone,
      t.paymentMethod,
      t.total,
      t.notes,
      t.date,
      t.previousSales,
      t.returns,
    ];
    const csvContent = [
      headers.join(','),
      ...filteredSales.map((sale) =>
        [
          sale.saleNumber,
          `"${sale.customerName || 'N/A'}"`,
          `"${sale.customerPhone || 'N/A'}"`,
          t.paymentMethods[sale.paymentMethod as keyof typeof t.paymentMethods] || 'N/A',
          sale.totalAmount.toFixed(2),
          `"${sale.notes || 'N/A'}"`,
          sale.createdAt,
          `"${sale.items.map((item) => `${item.displayName || t.departments.unknown}: ${item.quantity} x ${item.unitPrice}`).join('; ')}"`,
          `"${sale.returns?.map((ret) => `${ret.returnNumber}: ${ret.reason} (${ret.createdAt})`).join('; ') || 'N/A'}"`,
        ].join(',')
      ),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sales_report.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  }, [filteredSales, t]);

  // خيارات التصفية
  const periodOptions = useMemo(
    () => [
      { value: 'all', label: isRtl ? 'الكل' : 'All' },
      { value: 'custom', label: t.customRange },
    ],
    [t, isRtl]
  );

  const paymentMethodOptions = useMemo(
    () => [
      { value: '', label: t.allPaymentMethods },
      { value: 'cash', label: t.paymentMethods.cash },
      { value: 'credit_card', label: t.paymentMethods.credit_card },
      { value: 'bank_transfer', label: t.paymentMethods.bank_transfer },
    ],
    [t]
  );

  return (
    <div className={`mx-auto px-4 sm:px-6 py-8 min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans ${isRtl ? 'font-arabic' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <header className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center gap-3">
          <DollarSign className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
            <p className="text-gray-600 text-sm">{t.subtitle}</p>
          </div>
        </div>
        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm flex items-center gap-2"
        >
          <Download className="w-5 h-5" />
          {t.exportCSV}
        </button>
      </header>
      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm font-medium">{error}</span>
        </div>
      )}
      <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">{t.filters}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <SearchInput
            value={searchInput}
            onChange={handleSearchChange}
            placeholder={t.searchPlaceholder}
            ariaLabel={t.searchPlaceholder}
          />
          <Dropdown
            value={filterPeriod}
            onChange={setFilterPeriod}
            options={periodOptions}
            ariaLabel={t.filterBy}
          />
          <Dropdown
            value={filterState.paymentMethod}
            onChange={(value) => setFilterState((prev) => ({ ...prev, paymentMethod: value }))}
            options={paymentMethodOptions}
            ariaLabel={t.paymentMethod}
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
          <input
            type="number"
            value={filterState.minTotal || ''}
            onChange={(e) => setFilterState((prev) => ({ ...prev, minTotal: e.target.value ? parseFloat(e.target.value) : null }))}
            placeholder={t.totalRange + ' (Min)'}
            className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
            aria-label={t.totalRange + ' Min'}
          />
          <input
            type="number"
            value={filterState.maxTotal || ''}
            onChange={(e) => setFilterState((prev) => ({ ...prev, maxTotal: e.target.value ? parseFloat(e.target.value) : null }))}
            placeholder={t.totalRange + ' (Max)'}
            className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
            aria-label={t.totalRange + ' Max'}
          />
        </div>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 gap-6">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      ) : filteredSales.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100">
          <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-sm font-medium">{t.noSales}</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm text-gray-900">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    className="px-6 py-3 text-left font-medium cursor-pointer"
                    onClick={() => {
                      setSortField('createdAt');
                      setSortOrder(sortField === 'createdAt' && sortOrder === 'asc' ? 'desc' : 'asc');
                    }}
                  >
                    {t.date} {sortField === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-3 text-left font-medium">{t.customerName}</th>
                  <th className="px-6 py-3 text-left font-medium">{t.customerPhone}</th>
                  <th className="px-6 py-3 text-left font-medium">{t.paymentMethod}</th>
                  <th
                    className="px-6 py-3 text-left font-medium cursor-pointer"
                    onClick={() => {
                      setSortField('totalAmount');
                      setSortOrder(sortField === 'totalAmount' && sortOrder === 'asc' ? 'desc' : 'asc');
                    }}
                  >
                    {t.total} {sortField === 'totalAmount' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale) => (
                  <tr key={sale._id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4">{sale.createdAt}</td>
                    <td className="px-6 py-4">{sale.customerName || 'N/A'}</td>
                    <td className="px-6 py-4">{sale.customerPhone || 'N/A'}</td>
                    <td className="px-6 py-4">{t.paymentMethods[sale.paymentMethod as keyof typeof t.paymentMethods] || 'N/A'}</td>
                    <td className="px-6 py-4">{sale.totalAmount.toFixed(2)} {t.currency}</td>
                    <td className="px-6 py-4 flex gap-2">
                      <button
                        onClick={() => setSelectedSale(sale)}
                        className="p-2 bg-amber-600 hover:bg-amber-700 text-white rounded-full"
                        aria-label={t.viewDetails}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSale(sale._id)}
                        className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-full"
                        aria-label={t.deleteSale}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
      <SaleModal sale={selectedSale} onClose={() => setSelectedSale(null)} />
    </div>
  );
};

export default React.memo(BranchSalesReport);
