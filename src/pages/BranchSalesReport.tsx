import React, { useState, useEffect, useCallback, useMemo, useReducer } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { inventoryAPI, salesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, DollarSign, Trash2, Search, X, ChevronDown, Edit2 } from 'lucide-react';
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
    title: 'تقرير المبيعات',
    subtitle: 'إدارة المبيعات ومتابعة المبيعات السابقة',
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
    editSale: 'تعديل المبيعة',
    deleteSale: 'حذف المبيعة',
    errors: {
      unauthorized_access: 'غير مصرح لك بالوصول',
      no_branch_assigned: 'لم يتم تعيين فرع',
      fetch_sales: 'خطأ أثناء جلب المبيعات',
      delete_sale_failed: 'فشل حذف المبيعة',
    },
    currency: 'ريال',
    branches: { all_branches: 'كل الفروع', select_branch: 'اختر الفرع', unknown: 'غير معروف' },
    departments: { unknown: 'غير معروف' },
    paymentMethods: {
      cash: 'نقدي',
      credit_card: 'بطاقة ائتمان',
      bank_transfer: 'تحويل بنكي',
    },
  },
  en: {
    title: 'Sales Report',
    subtitle: 'Manage and track previous sales',
    filters: 'Filters',
    previousSales: 'Previous Sales',
    noSales: 'No sales found',
    date: 'Date',
    returns: 'Returns',
    return: 'Return',
    reason: 'Reason',
    quantity: 'Quantity',
    searchPlaceholder: 'Search sales, customers or products...',
    loadMore: 'Load More',
    filterBy: 'Filter By',
    customRange: 'Custom Range',
    editSale: 'Edit Sale',
    deleteSale: 'Delete Sale',
    errors: {
      unauthorized_access: 'You are not authorized to access',
      no_branch_assigned: 'No branch assigned',
      fetch_sales: 'Error fetching sales',
      delete_sale_failed: 'Failed to delete sale',
    },
    currency: 'SAR',
    branches: { all_branches: 'All Branches', select_branch: 'Select Branch', unknown: 'Unknown' },
    departments: { unknown: 'Unknown' },
    paymentMethods: {
      cash: 'Cash',
      credit_card: 'Credit Card',
      bank_transfer: 'Bank Transfer',
    },
  },
};

// مكونات فرعية
const ProductDropdown = React.memo<{
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

const SaleCard = React.memo<{
  sale: Sale;
  onEdit: (sale: Sale) => void;
  onDelete: (id: string) => void;
}>(({ sale, onEdit, onDelete }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  return (
    <div className="p-6 bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-amber-200">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-900 text-xl">{sale.saleNumber}</h3>
            <span className="text-sm text-gray-500">({sale.branch.displayName})</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(sale)}
              className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors duration-200"
              aria-label={t.editSale}
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(sale._id)}
              className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors duration-200"
              aria-label={t.deleteSale}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {sale.items.map((item, index) => (
            <div key={index} className="flex justify-between items-center text-sm text-gray-700">
              <span className="truncate max-w-[60%]">
                {item.quantity} {item.displayUnit || t.units.default} {item.displayName || t.errors.deleted_product}
              </span>
              <span className="font-semibold text-amber-600">
                {item.quantity} × {item.unitPrice} {t.currency}
              </span>
            </div>
          ))}
          <div className="flex justify-between items-center font-bold text-gray-900 text-base border-t pt-2 mt-2">
            <span>{t.total}:</span>
            <span className="text-amber-600">{sale.totalAmount.toFixed(2)} {t.currency}</span>
          </div>
        </div>
        <div className="space-y-2 text-sm text-gray-600">
          <p>{t.date}: {sale.createdAt}</p>
          {sale.paymentMethod && (
            <p>{t.paymentMethod}: {t.paymentMethods[sale.paymentMethod as keyof typeof t.paymentMethods] || t.paymentMethods.cash}</p>
          )}
          {sale.customerName && <p>{t.customerName}: {sale.customerName}</p>}
          {sale.customerPhone && <p>{t.customerPhone}: {sale.customerPhone}</p>}
          {sale.notes && <p className="italic">{t.notes}: {sale.notes}</p>}
        </div>
        {sale.returns && sale.returns.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700">{t.returns}:</p>
            <ul className="list-disc list-inside text-sm text-gray-600">
              {sale.returns.map((ret, index) => (
                <li key={index}>
                  {t.return} #{ret.returnNumber} ({ret.status}) - {t.reason}: {ret.reason} ({t.date}: {ret.createdAt})
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
  );
});

const SaleSkeletonCard = React.memo(() => (
  <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
    <div className="space-y-3 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      <div className="h-3 bg-gray-200 rounded w-1/3"></div>
    </div>
  </div>
));

// المكون الرئيسي لصفحة المبيعات الرسمية (متابعة المبيعات مع بحث)
export const BranchSalesList: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'] || translations.en;

  const [sales, setSales] = useState<Sale[]>([]);
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [salesLoading, setSalesLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

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
    debounce((value: string) => setSearchTerm(value.trim()), 300),
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
            displayName: isRtl ? sale.branch?.name : (sale.branch?.nameEn || sale.branch?.name || t.branches.unknown),
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
                      displayName: isRtl ? item.product.department.name : (item.product.department.nameEn || item.product.department.name || t.departments.unknown),
                    }
                  : undefined,
              }))
            : [],
          totalAmount: sale.totalAmount || 0,
          createdAt: formatDate(new Date(sale.createdAt), isRtl ? 'ar' : 'en'),
          notes: sale.notes,
          paymentMethod: sale.paymentMethod,
          customerName: sale.customerName,
          customerPhone: sale.customerPhone,
          returns: returnsMap.get(sale._id) || [],
        }));

        setSales((prev) => (append ? [...prev, ...newSales] : newSales));
        setHasMore(salesResponse.total > pageNum * 20);
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

  // تصفية المبيعات بناءً على البحث
  const filteredSales = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return sales.filter((sale) => {
      const matchesCustomerName = sale.customerName?.toLowerCase().includes(lowerSearchTerm);
      const matchesCustomerPhone = sale.customerPhone?.toLowerCase().includes(lowerSearchTerm);
      const matchesProducts = sale.items.some((item) => item.displayName.toLowerCase().includes(lowerSearchTerm));
      const matchesSaleNumber = sale.saleNumber.toLowerCase().includes(lowerSearchTerm);
      return matchesCustomerName || matchesCustomerPhone || matchesProducts || matchesSaleNumber;
    });
  }, [sales, searchTerm]);

  // خيارات التصفية
  const periodOptions = useMemo(
    () => [
      { value: 'all', label: isRtl ? 'الكل' : 'All' },
      { value: 'custom', label: t.customRange },
    ],
    [t, isRtl]
  );

  // تعديل المبيعة (توجيه إلى صفحة الإنشاء مع id)
  const handleEditSale = useCallback((sale: Sale) => {
    navigate(`/sales/create/${sale._id}`); // افترض أن الروت هو /sales/create/:id للتعديل
  }, [navigate]);

  // حذف المبيعة
  const handleDeleteSale = useCallback(
    async (id: string) => {
      if (window.confirm(isRtl ? 'هل أنت متأكد من حذف هذه المبيعة؟' : 'Are you sure you want to delete this sale?')) {
        try {
          await salesAPI.delete(id);
          toast.success(t.deleteSale, { position: isRtl ? 'top-right' : 'top-left' });
          fetchData();
        } catch (err: any) {
          console.error(`[${new Date().toISOString()}] Sale deletion error:`, err);
          const errorMessage = err.response?.status === 403 ? t.errors.unauthorized_access : t.errors.delete_sale_failed;
          toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
        }
      }
    },
    [fetchData, t, isRtl]
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
      </header>
      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm font-medium">{error}</span>
        </div>
      )}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">{t.previousSales}</h2>
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">{t.filters}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
            <ProductDropdown value={filterPeriod} onChange={setFilterPeriod} options={periodOptions} ariaLabel={t.filterBy} />
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
          </div>
          <div className="relative group">
            <Search className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors group-focus-within:text-amber-500 ${searchInput ? 'opacity-0' : 'opacity-100'}`} />
            <input
              type="text"
              value={searchInput}
              onChange={handleSearchChange}
              placeholder={t.searchPlaceholder}
              className={`w-full ${isRtl ? 'pl-12 pr-4' : 'pr-12 pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}
              aria-label={t.searchPlaceholder}
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(''); setSearchTerm(''); }}
                className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-amber-500 transition-colors`}
                aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
        {loading ? (
          <div className="space-y-6">
            {[...Array(3)].map((_, index) => (
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
            <div className="space-y-6">
              {filteredSales.map((sale) => (
                <SaleCard key={sale._id} sale={sale} onEdit={handleEditSale} onDelete={handleDeleteSale} />
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
    </div>
  );
};

export default React.memo(BranchSalesList);