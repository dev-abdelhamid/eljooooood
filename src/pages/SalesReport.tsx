import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { salesAPI, branchesAPI, inventoryAPI, productsAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { AlertCircle, DollarSign, Search, Download, X, ChevronDown } from 'lucide-react';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import { formatDate } from '../utils/formatDate';

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
  returns: Array<{
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

interface TopCustomer {
  customerName: string;
  customerPhone: string;
  totalSpent: number;
  purchaseCount: number;
}

interface AnalyticsResponse {
  topCustomers: TopCustomer[];
}

const translations = {
  ar: {
    title: 'تقرير المبيعات',
    subtitle: 'عرض وإدارة المبيعات',
    filters: 'الفلاتر',
    startDate: 'تاريخ البداية',
    endDate: 'تاريخ النهاية',
    selectBranch: 'اختر الفرع',
    selectProduct: 'اختر المنتج',
    noSales: 'لا توجد مبيعات',
    date: 'التاريخ',
    total: 'الإجمالي',
    quantity: 'الكمية',
    unitPrice: 'سعر الوحدة',
    notes: 'ملاحظات',
    items: 'العناصر',
    stock: 'المخزون الحالي',
    searchPlaceholder: 'ابحث عن المبيعات...',
    exportReport: 'تصدير التقرير',
    topCustomers: 'أفضل العملاء',
    customerName: 'اسم العميل',
    customerPhone: 'رقم الهاتف',
    totalSpent: 'إجمالي الإنفاق',
    purchaseCount: 'عدد المشتريات',
    returns: 'المرتجعات',
    return: 'مرتجع',
    reason: 'السبب',
    paymentMethod: 'طريقة الدفع',
    errors: {
      unauthorized_access: 'غير مصرح لك بالوصول',
      fetch_sales: 'خطأ أثناء جلب المبيعات',
      fetch_branches: 'خطأ أثناء جلب الفروع',
      fetch_inventory: 'خطأ أثناء جلب المخزون',
      fetch_products: 'خطأ أثناء جلب المنتجات',
      fetch_analytics: 'خطأ أثناء جلب الإحصائيات',
      export_failed: 'فشل تصدير التقرير',
    },
    currency: 'ريال',
    branches: { all_branches: 'كل الفروع', select_branch: 'اختر الفرع', unknown: 'غير معروف' },
    products: { select_product: 'اختر المنتج', unknown: 'غير معروف' },
    paymentMethods: {
      cash: 'نقدي',
      card: 'بطاقة ائتمان',
      credit: 'آجل',
    },
    returns: {
      status: { pending: 'معلق', approved: 'مقبول', rejected: 'مرفوض' },
    },
  },
  en: {
    title: 'Sales Report',
    subtitle: 'View and Manage Sales',
    filters: 'Filters',
    startDate: 'Start Date',
    endDate: 'End Date',
    selectBranch: 'Select Branch',
    selectProduct: 'Select Product',
    noSales: 'No sales found',
    date: 'Date',
    total: 'Total',
    quantity: 'Quantity',
    unitPrice: 'Unit Price',
    notes: 'Notes',
    items: 'Items',
    stock: 'Current Stock',
    searchPlaceholder: 'Search sales...',
    exportReport: 'Export Report',
    topCustomers: 'Top Customers',
    customerName: 'Customer Name',
    customerPhone: 'Phone Number',
    totalSpent: 'Total Spent',
    purchaseCount: 'Purchase Count',
    returns: 'Returns',
    return: 'Return',
    reason: 'Reason',
    paymentMethod: 'Payment Method',
    errors: {
      unauthorized_access: 'Unauthorized access',
      fetch_sales: 'Error fetching sales',
      fetch_branches: 'Error fetching branches',
      fetch_inventory: 'Error fetching inventory',
      fetch_products: 'Error fetching products',
      fetch_analytics: 'Error fetching analytics',
      export_failed: 'Failed to export report',
    },
    currency: 'SAR',
    branches: { all_branches: 'All Branches', select_branch: 'Select Branch', unknown: 'Unknown' },
    products: { select_product: 'Select Product', unknown: 'Unknown' },
    paymentMethods: {
      cash: 'Cash',
      card: 'Credit Card',
      credit: 'Credit',
    },
    returns: {
      status: { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' },
    },
  },
};

// Memoized SearchInput component to prevent unnecessary re-renders
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

// Memoized Dropdown component for branch and product selection
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

export const SalesReport: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [filterBranch, setFilterBranch] = useState<string>('');
  const [filterProduct, setFilterProduct] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalSales, setTotalSales] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Toast deduplication
  const toastIdRef = React.useRef<string | number | null>(null);

  const showToast = useCallback((message: string, type: 'error' | 'success') => {
    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current);
    }
    toastIdRef.current = toast[type](message, { autoClose: 3000 });
  }, []);

  const fetchData = useCallback(async (resetPage = false) => {
    if (!user?.role || !['branch', 'admin'].includes(user.role)) {
      console.error('fetchData - Unauthorized access:', { user });
      showToast(t.errors.unauthorized_access, 'error');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const currentPage = resetPage ? 1 : page;
      const params: any = { page: currentPage, limit: 20, lang: language };
      if (user.role === 'branch' && user.branchId) {
        params.branch = user.branchId;
      } else if (filterBranch) {
        params.branch = filterBranch;
      }
      if (filterProduct) {
        params.product = filterProduct;
      }
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (searchQuery) params.search = searchQuery;

      const [salesResponse, branchesResponse, inventoryResponse, productsResponse, analyticsResponse] = await Promise.all([
        salesAPI.getAll(params),
        user.role === 'admin' ? branchesAPI.getAll() : Promise.resolve({ branches: [] }),
        inventoryAPI.getAll({ branch: user.role === 'branch' ? user.branchId : filterBranch }),
        productsAPI.getAll(),
        user.role === 'admin' ? salesAPI.getAnalytics(params) : Promise.resolve({ topCustomers: [] }),
      ]);

      setSales((prev) => (resetPage ? salesResponse.sales : [...prev, ...salesResponse.sales]));
      setTotalSales(salesResponse.total || 0);
      setBranches([{ _id: '', name: t.branches.all_branches, displayName: t.branches.all_branches }, ...branchesResponse.branches]);
      setInventory(inventoryResponse || []);
      setProducts(productsResponse || []);
      setTopCustomers(analyticsResponse.topCustomers || []);
      setPage(currentPage + 1);

      // Reset filters if invalid
      if (filterBranch && !branchesResponse.branches.find((b: Branch) => b._id === filterBranch)) {
        setFilterBranch('');
      }
      if (filterProduct && !productsResponse.find((p: Product) => p._id === filterProduct)) {
        setFilterProduct('');
      }

      setError('');
    } catch (err: any) {
      console.error('fetchData - Error:', err.message, err.stack);
      showToast(err.message || t.errors.fetch_sales, 'error');
      setSales([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, filterBranch, filterProduct, searchQuery, page, user, language, t, showToast]);

  const debouncedFetchData = useMemo(() => debounce(fetchData, 300), [fetchData]);

  useEffect(() => {
    debouncedFetchData(true);
  }, [debouncedFetchData, startDate, endDate, filterBranch, filterProduct, searchQuery]);

  const handleExportReport = useCallback(() => {
    try {
      const csvContent = [
        [t.saleNumber, t.branch, t.date, t.total, t.items, t.customerName, t.customerPhone, t.paymentMethod, t.notes],
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
      showToast(t.exportReport, 'success');
    } catch (err) {
      console.error('Export failed:', err);
      showToast(t.errors.export_failed, 'error');
    }
  }, [sales, t, showToast]);

  if (loading && page === 1) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-amber-50 to-teal-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div
      className={`container mx-auto px-4 py-6 min-h-screen bg-gradient-to-br from-amber-50 to-teal-50 ${isRtl ? 'font-arabic' : 'font-sans'}`}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-amber-600" />
          {t.title}
        </h1>
        <p className="text-gray-600 mt-2">{t.subtitle}</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg flex items-center gap-3 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600">{error}</span>
        </div>
      )}

      <Card className="p-6 mb-6 bg-white rounded-xl shadow-md">
        <div className="flex flex-col sm:flex-row gap-4">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full sm:w-40"
            aria-label={t.startDate}
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full sm:w-40"
            aria-label={t.endDate}
          />
          {user?.role === 'admin' && (
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
          )}
          <Dropdown
            value={filterProduct}
            onChange={setFilterProduct}
            options={[
              { value: '', label: t.products.select_product },
              ...products.map((product) => ({
                value: product._id,
                label: isRtl ? product.name : (product.nameEn || product.name),
              })),
            ]}
            ariaLabel={t.selectProduct}
            disabled={products.length === 0}
          />
          <SearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            ariaLabel={t.searchPlaceholder}
          />
        </div>
      </Card>

      {user?.role === 'admin' && topCustomers.length > 0 && (
        <Card className="p-6 mb-6 bg-white rounded-xl shadow-md">
          <h2 className="text-xl font-semibold mb-4">{t.topCustomers}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{t.customerName}</th>
                  <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{t.customerPhone}</th>
                  <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{t.totalSpent}</th>
                  <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{t.purchaseCount}</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((customer, index) => (
                  <tr key={index} className="border-b hover:bg-amber-50">
                    <td className="p-3">{customer.customerName}</td>
                    <td className="p-3">{customer.customerPhone}</td>
                    <td className="p-3">{customer.totalSpent} {t.currency}</td>
                    <td className="p-3">{customer.purchaseCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {sales.length === 0 ? (
          <Card className="p-8 text-center bg-white rounded-xl shadow-md">
            <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">{t.noSales}</p>
          </Card>
        ) : (
          sales.map((sale) => (
            <Card
              key={sale._id}
              className="p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-shadow duration-200"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{sale.saleNumber}</h3>
                  <p className="text-sm text-gray-600">{t.date}: {sale.createdAt}</p>
                  <p className="text-sm text-gray-600">{t.branch}: {sale.branch.displayName}</p>
                  <p className="text-sm text-gray-600">{t.total}: {sale.totalAmount} {t.currency}</p>
                  <p className="text-sm text-gray-600">{t.paymentMethod}: {t.paymentMethods[sale.paymentMethod as keyof typeof t.paymentMethods] || sale.paymentMethod}</p>
                  {sale.customerName && <p className="text-sm text-gray-600">{t.customerName}: {sale.customerName}</p>}
                  {sale.customerPhone && <p className="text-sm text-gray-600">{t.customerPhone}: {sale.customerPhone}</p>}
                  {sale.notes && <p className="text-sm text-gray-500">{t.notes}: {sale.notes}</p>}
                  <div className="mt-2">
                    <p className="text-sm font-medium text-gray-700">{t.items}:</p>
                    <ul className="list-disc list-inside text-sm text-gray-600">
                      {sale.items.map((item, index) => (
                        <li key={index}>
                          {item.displayName} - {t.quantity}: {item.quantity}, {t.unitPrice}: {item.unitPrice} {t.currency}
                          <span className="ml-2 text-gray-600">
                            ({t.stock}: {inventory.find((inv) => inv.productId === item.product._id && inv.branchId === sale.branch._id)?.currentStock || 'N/A'})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {sale.returns && sale.returns.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-700">{t.returns}:</p>
                      <ul className="list-disc list-inside text-sm text-gray-600">
                        {sale.returns.map((ret) => (
                          <li key={ret._id}>
                            {ret.returnNumber} - {t.returns.status[ret.status as keyof typeof t.returns.status]}: {ret.items.map((item) => `${item.productName} (${item.quantity})`).join(', ')} ({t.reason}: {ret.reason})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {sales.length < totalSales && (
        <button
          onClick={() => fetchData()}
          disabled={loading}
          className="mt-4 w-full py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Loading...' : t.loadMore}
        </button>
      )}

      <button
        onClick={handleExportReport}
        className="mt-4 w-full py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 flex items-center justify-center gap-2 transition-colors"
      >
        <Download className="w-5 h-5" />
        {t.exportReport}
      </button>
    </div>
  );
};

export default SalesReport;