import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import salesAPI from '../services/salesAPI';
import { branchesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, DollarSign, Search, X, ChevronDown, Edit, Trash } from 'lucide-react';
import { toast } from 'react-toastify';
import ReactECharts from 'echarts-for-react';
import { debounce } from 'lodash';
import Papa from 'papaparse';
import io from 'socket.io-client';

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

interface SalesAnalytics {
  branchSales: Array<{
    branchId: string;
    branchName: string;
    branchNameEn?: string;
    displayName: string;
    totalSales: number;
    saleCount: number;
  }>;
  leastBranchSales: Array<{
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
  returnRate: number;
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
    leastProductSales: 'أقل المنتجات مبيعًا',
    departmentSales: 'مبيعات الأقسام',
    leastDepartmentSales: 'أقل الأقسام مبيعًا',
    branchSales: 'مبيعات الفروع',
    leastBranchSales: 'أقل الفروع مبيعًا',
    totalSales: 'إجمالي المبيعات',
    totalCount: 'عدد المبيعات',
    averageOrderValue: 'متوسط قيمة الطلب',
    returnRate: 'نسبة المرتجعات',
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
    branchFilter: 'اختر فرعًا',
    allBranches: 'جميع الفروع',
    searchPlaceholder: 'ابحث عن المبيعات...',
    loadMore: 'تحميل المزيد',
    editSale: 'تعديل المبيعة',
    deleteSale: 'حذف المبيعة',
    confirmDelete: 'هل أنت متأكد من حذف هذه المبيعة؟',
    export: 'تصدير',
    errors: {
      unauthorized_access: 'غير مصرح لك بالوصول',
      fetch_sales: 'خطأ أثناء جلب المبيعات',
      fetch_branches: 'خطأ أثناء جلب الفروع',
      delete_sale_failed: 'فشل حذف المبيعة',
      update_sale_failed: 'فشل تعديل المبيعة',
      invalid_sale_id: 'معرف المبيعة غير صالح',
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
    paymentStatus: {
      pending: 'معلق',
      completed: 'مكتمل',
      canceled: 'ملغى',
    },
    returns: { status: { pending: 'معلق', approved: 'مقبول', rejected: 'مرفوض' } },
  },
  en: {
    title: 'Sales Report',
    previousSales: 'Previous Sales',
    analytics: 'Sales Analytics',
    productSales: 'Product Sales',
    leastProductSales: 'Least Sold Products',
    departmentSales: 'Department Sales',
    leastDepartmentSales: 'Least Sold Departments',
    branchSales: 'Branch Sales',
    leastBranchSales: 'Least Sold Branches',
    totalSales: 'Total Sales',
    totalCount: 'Total Sale Count',
    averageOrderValue: 'Average Order Value',
    returnRate: 'Return Rate',
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
    branchFilter: 'Select Branch',
    allBranches: 'All Branches',
    searchPlaceholder: 'Search sales...',
    loadMore: 'Load More',
    editSale: 'Edit Sale',
    deleteSale: 'Delete Sale',
    confirmDelete: 'Are you sure you want to delete this sale?',
    export: 'Export',
    errors: {
      unauthorized_access: 'You are not authorized to access',
      fetch_sales: 'Error fetching sales',
      fetch_branches: 'Error fetching branches',
      delete_sale_failed: 'Failed to delete sale',
      update_sale_failed: 'Failed to update sale',
      invalid_sale_id: 'Invalid sale ID',
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
    paymentStatus: {
      pending: 'Pending',
      completed: 'Completed',
      canceled: 'Canceled',
    },
    returns: { status: { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' } },
  },
};

// Memoized Components
const SearchInput = React.memo<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
}>(({ value, onChange, placeholder }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="relative group">
      <Search
        className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors group-focus-within:text-amber-500 ${value ? 'opacity-0' : 'opacity-100'}`}
      />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full ${isRtl ? 'pl-12 pr-4' : 'pr-12 pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={placeholder}
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
    <div className="relative">
      <select
        value={selectedBranch}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm appearance-none ${isRtl ? 'text-right' : 'text-left'}`}
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
        className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5`}
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
      <div className="p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-amber-200">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-gray-900 text-base">{sale.orderNumber}</h3>
            <p className="text-sm text-gray-600">{t.date}: {sale.createdAt}</p>
            <p className="text-sm text-gray-600">{t.branchSales}: {sale.branch?.displayName || t.errors.departments.unknown}</p>
            <p className="text-sm text-gray-600">{t.totalSales}: {sale.totalAmount} {t.currency}</p>
            {sale.paymentMethod && (
              <p className="text-sm text-gray-600">
                {t.paymentMethodsLabel}: {t.paymentMethods[sale.paymentMethod as keyof typeof t.paymentMethods]}
              </p>
            )}
            {sale.customerName && <p className="text-sm text-gray-600">{t.customerName}: {sale.customerName}</p>}
            {sale.customerPhone && <p className="text-sm text-gray-600">{t.customerPhone}: {sale.customerPhone}</p>}
            {sale.notes && <p className="text-sm text-gray-500">{t.notes}: {sale.notes}</p>}
            <ul className="list-disc list-inside text-sm text-gray-600 mt-2">
              {sale.items.map((item, index) => (
                <li key={index}>
                  {item.displayName || t.errors.deleted_product} ({item.department?.displayName || t.errors.departments.unknown}) - {t.quantity}: {item.quantity} {item.displayUnit || t.units.default}, {t.totalSales}: {item.unitPrice} {t.currency}
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
          <div className="flex gap-2">
            <button onClick={() => onEdit(sale)} aria-label={t.editSale}>
              <Edit className="w-5 h-5 text-blue-600 hover:text-blue-800 transition-colors" />
            </button>
            <button onClick={() => onDelete(sale._id)} aria-label={t.deleteSale}>
              <Trash className="w-5 h-5 text-red-600 hover:text-red-800 transition-colors" />
            </button>
          </div>
        </div>
      </div>
    );
  }
);

const SalesReport: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [sales, setSales] = useState<Sale[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
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
    returnRate: 0,
    topProduct: { productId: null, productName: '', displayName: '', totalQuantity: 0, totalRevenue: 0 },
    salesTrends: [],
    topCustomers: [],
    paymentMethods: [],
    returnStats: [],
  });
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
  const [tabValue, setTabValue] = useState(0);

  const socket = useMemo(() => io('https://eljoodia-server-production.up.railway.app'), []);

  const debouncedSearch = useCallback(debounce((value: string) => setSearchTerm(value.trim()), 300), []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSearch(value);
  };

  const fetchBranches = useCallback(async () => {
    if (user?.role !== 'admin') return;
    setBranchesLoading(true);
    try {
      const response = await branchesAPI.getAll();
      setBranches(response.map((branch: any) => ({
        _id: branch._id,
        name: branch.name,
        nameEn: branch.nameEn,
        displayName: isRtl ? branch.name : (branch.nameEn || branch.name || t.errors.departments.unknown),
      })));
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Fetch branches error:`, err);
      setError(t.errors.fetch_branches);
      toast.error(t.errors.fetch_branches, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setBranchesLoading(false);
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
        const salesParams: any = { page: pageNum, limit: 20, sort: '-createdAt', branch: filterBranch };
        if (filterStartDate) salesParams.startDate = filterStartDate;
        if (filterEndDate) salesParams.endDate = filterEndDate;

        const analyticsParams: any = { branch: filterBranch };
        if (filterStartDate) analyticsParams.startDate = filterStartDate;
        if (filterEndDate) analyticsParams.endDate = filterEndDate;

        const [salesResponse, analyticsResponse] = await Promise.all([
          salesAPI.getAll(salesParams),
          salesAPI.getAnalytics(analyticsParams),
        ]);

        const returnsMap = new Map<string, Sale['returns']>();
        (salesResponse.returns || []).forEach((ret: any) => {
          const orderId = ret.order?._id || ret.order;
          if (!returnsMap.has(orderId)) returnsMap.set(orderId, []);
          returnsMap.get(orderId)!.push({
            _id: ret._id,
            returnNumber: ret.returnNumber,
            status: ret.status,
            items: (ret.items || []).map((item: any) => ({
              product: item.product?._id || item.product,
              productName: item.product?.name || t.errors.deleted_product,
              productNameEn: item.product?.nameEn,
              quantity: item.quantity,
              reason: item.reason,
            })),
            reason: ret.reason,
            createdAt: formatDate(ret.createdAt, language),
          });
        });

        const newSales = (salesResponse.sales || []).map((sale: any) => ({
          _id: sale._id,
          orderNumber: sale.saleNumber || sale.orderNumber,
          branch: sale.branch
            ? {
                _id: sale.branch._id,
                name: sale.branch.name,
                nameEn: sale.branch.nameEn,
                displayName: isRtl ? sale.branch.name : (sale.branch.nameEn || sale.branch.name || t.errors.departments.unknown),
              }
            : { _id: '', name: '', displayName: t.errors.departments.unknown },
          items: (sale.items || []).map((item: any) => ({
            product: item.product?._id || item.productId,
            productName: item.product?.name || t.errors.deleted_product,
            productNameEn: item.product?.nameEn,
            unit: item.product?.unit,
            unitEn: item.product?.unitEn,
            displayName: isRtl
              ? item.product?.name || t.errors.deleted_product
              : item.product?.nameEn || item.product?.name || t.errors.deleted_product,
            displayUnit: isRtl
              ? item.product?.unit || t.units.default
              : item.product?.unitEn || item.product?.unit || t.units.default,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            department: item.product?.department
              ? {
                  _id: item.product.department._id,
                  name: item.product.department.name,
                  nameEn: item.product.department.nameEn,
                  displayName: isRtl
                    ? item.product.department.name
                    : item.product.department.nameEn || item.product.department.name || t.errors.departments.unknown,
                }
              : undefined,
          })),
          totalAmount: sale.totalAmount || 0,
          createdAt: formatDate(sale.createdAt, language),
          notes: sale.notes,
          paymentMethod: sale.paymentMethod,
          paymentStatus: sale.paymentStatus,
          customerName: sale.customerName,
          customerPhone: sale.customerPhone,
          returns: returnsMap.get(sale._id) || [],
        }));

        setSales((prev) => (append ? [...prev, ...newSales] : newSales));
        setHasMore(salesResponse.total > pageNum * 20);

        setAnalytics({
          branchSales: (analyticsResponse.branchSales || []).map((bs: any) => ({
            ...bs,
            displayName: isRtl ? bs.branchName : (bs.branchNameEn || bs.branchName || t.errors.departments.unknown),
          })),
          leastBranchSales: (analyticsResponse.leastBranchSales || []).map((bs: any) => ({
            ...bs,
            displayName: isRtl ? bs.branchName : (bs.branchNameEn || bs.branchName || t.errors.departments.unknown),
          })),
          productSales: (analyticsResponse.productSales || []).map((ps: any) => ({
            ...ps,
            displayName: isRtl
              ? ps.productName || t.errors.deleted_product
              : ps.productNameEn || ps.productName || t.errors.deleted_product,
          })),
          leastProductSales: (analyticsResponse.leastProductSales || []).map((ps: any) => ({
            ...ps,
            displayName: isRtl
              ? ps.productName || t.errors.deleted_product
              : ps.productNameEn || ps.productName || t.errors.deleted_product,
          })),
          departmentSales: (analyticsResponse.departmentSales || []).map((ds: any) => ({
            ...ds,
            displayName: isRtl
              ? ds.departmentName
              : ds.departmentNameEn || ds.departmentName || t.errors.departments.unknown,
          })),
          leastDepartmentSales: (analyticsResponse.leastDepartmentSales || []).map((ds: any) => ({
            ...ds,
            displayName: isRtl
              ? ds.departmentName
              : ds.departmentNameEn || ds.departmentName || t.errors.departments.unknown,
          })),
          totalSales: analyticsResponse.totalSales || 0,
          totalCount: analyticsResponse.totalCount || 0,
          averageOrderValue: analyticsResponse.averageOrderValue || 0,
          returnRate: analyticsResponse.returnRate || 0,
          topProduct: analyticsResponse.topProduct
            ? {
                ...analyticsResponse.topProduct,
                displayName: isRtl
                  ? analyticsResponse.topProduct.productName || t.errors.deleted_product
                  : analyticsResponse.topProduct.productNameEn ||
                    analyticsResponse.topProduct.productName ||
                    t.errors.deleted_product,
              }
            : { productId: null, productName: '', displayName: '', totalQuantity: 0, totalRevenue: 0 },
          salesTrends: (analyticsResponse.salesTrends || []).map((trend: any) => ({
            ...trend,
            period: formatDate(trend.period, language),
          })),
          topCustomers: analyticsResponse.topCustomers || [],
          paymentMethods: (analyticsResponse.paymentMethods || []).map((pm: any) => ({
            ...pm,
            paymentMethod: t.paymentMethods[pm.paymentMethod as keyof typeof t.paymentMethods] || pm.paymentMethod,
          })),
          returnStats: (analyticsResponse.returnStats || []).map((rs: any) => ({
            ...rs,
            status: t.returns.status[rs.status as keyof typeof t.returns.status] || rs.status,
          })),
        });

        setError('');
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Fetch error:`, err);
        setError(err.message === 'Invalid sale ID' ? t.errors.invalid_sale_id : t.errors.fetch_sales);
        toast.error(err.message === 'Invalid sale ID' ? t.errors.invalid_sale_id : t.errors.fetch_sales, {
          position: isRtl ? 'top-right' : 'top-left',
        });
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

  useEffect(() => {
    socket.on('saleCreated', (data: any) => {
      toast.info(isRtl ? `تم إنشاء مبيعة جديدة: ${data.saleNumber}` : `New sale created: ${data.saleNumber}`, {
        position: isRtl ? 'top-right' : 'top-left',
      });
      if (!filterBranch || data.branchId === filterBranch) {
        fetchData();
      }
    });
    socket.on('saleDeleted', (data: any) => {
      toast.info(isRtl ? `تم حذف مبيعة: ${data.saleId}` : `Sale deleted: ${data.saleId}`, {
        position: isRtl ? 'top-right' : 'top-left',
      });
      if (!filterBranch || data.branchId === filterBranch) {
        fetchData();
      }
    });
    return () => {
      socket.off('saleCreated');
      socket.off('saleDeleted');
    };
  }, [socket, fetchData, filterBranch, isRtl]);

  const loadMoreSales = useCallback(() => {
    setPage((prev) => prev + 1);
    fetchData(page + 1, true);
  }, [fetchData, page]);

  const handleEditSale = useCallback((sale: Sale) => {
    toast.info(t.editSale, { position: isRtl ? 'top-right' : 'top-left' });
  }, [t, isRtl]);

  const handleDeleteSale = useCallback(
    async (id: string) => {
      if (window.confirm(t.confirmDelete)) {
        try {
          await salesAPI.delete(id);
          toast.success(t.deleteSale, { position: isRtl ? 'top-right' : 'top-left' });
          fetchData();
        } catch (err: any) {
          console.error(`[${new Date().toISOString()}] Delete error:`, err);
          setError(t.errors.delete_sale_failed);
          toast.error(t.errors.delete_sale_failed, { position: isRtl ? 'top-right' : 'top-left' });
        }
      }
    },
    [t, fetchData, isRtl]
  );

  const handleExport = useCallback(() => {
    const csvData = sales.map((sale) => ({
      OrderNumber: sale.orderNumber,
      Branch: sale.branch?.displayName || t.errors.departments.unknown,
      TotalAmount: sale.totalAmount,
      CreatedAt: sale.createdAt,
      PaymentMethod: sale.paymentMethod ? t.paymentMethods[sale.paymentMethod as keyof typeof t.paymentMethods] : 'N/A',
      PaymentStatus: sale.paymentStatus ? t.paymentStatus[sale.paymentStatus as keyof typeof t.paymentStatus] : 'N/A',
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

  const chartColors = ['#FBBF24', '#3B82F6', '#FF6384', '#4BC0C0', '#9966FF'];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 text-white p-3 rounded-lg shadow-lg opacity-90">
          <p className="font-bold">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value} {entry.name.includes(t.currency) ? t.currency : ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const productSalesOption = {
    title: {
      text: t.productSales,
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold',
      },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
        shadowStyle: {
          color: 'rgba(251, 191, 36, 0.2)',
          shadowBlur: 10,
        },
      },
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderColor: '#ddd',
      borderWidth: 1,
      padding: 10,
      textStyle: {
        color: '#333',
        fontSize: 12,
      },
    },
    legend: {
      top: 'bottom',
      itemGap: 10,
      textStyle: {
        fontSize: 12,
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true,
    },
    xAxis: [
      {
        type: 'category',
        data: analytics.productSales.slice(0, 5).map((p) => p.displayName),
        axisTick: {
          alignWithLabel: true,
        },
        axisLabel: {
          rotate: 45,
          fontSize: 10,
        },
      },
    ],
    yAxis: [
      {
        type: 'value',
        axisLabel: {
          fontSize: 10,
        },
      },
    ],
    series: [
      {
        name: `${t.totalSales} (${t.currency})`,
        type: 'bar',
        barWidth: '40%',
        data: analytics.productSales.slice(0, 5).map((p) => p.totalRevenue),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#FBBF24' },
              { offset: 1, color: '#D97706' },
            ],
          },
          shadowColor: 'rgba(0,0,0,0.2)',
          shadowBlur: 5,
          shadowOffsetY: 2,
          barBorderRadius: [5, 5, 0, 0],
        },
      },
      {
        name: t.quantity,
        type: 'bar',
        barWidth: '40%',
        data: analytics.productSales.slice(0, 5).map((p) => p.totalQuantity),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#3B82F6' },
              { offset: 1, color: '#1D4ED8' },
            ],
          },
          shadowColor: 'rgba(0,0,0,0.2)',
          shadowBlur: 5,
          shadowOffsetY: 2,
          barBorderRadius: [5, 5, 0, 0],
        },
      },
    ],
    media: [
      {
        query: { maxWidth: 600 },
        option: {
          legend: {
            orient: 'horizontal',
            bottom: 0,
            itemGap: 5,
            textStyle: { fontSize: 10 },
          },
          grid: { bottom: '20%', containLabel: true },
          xAxis: [{ axisLabel: { rotate: 60, fontSize: 8 } }],
          yAxis: [{ axisLabel: { fontSize: 8 } }],
          series: [{ barWidth: '30%' }, { barWidth: '30%' }],
        },
      },
    ],
  };

  // Similar options for other charts, with gradients, shadows, and media queries for small screens
  // For example, leastProductSalesOption, departmentSalesOption, etc., with different colors and shapes (e.g., rounded bars, lines with dots).

  const leastProductSalesOption = {
    title: {
      text: t.leastProductSales,
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold',
      },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
        shadowStyle: {
          color: 'rgba(251, 191, 36, 0.2)',
          shadowBlur: 10,
        },
      },
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderColor: '#ddd',
      borderWidth: 1,
      padding: 10,
      textStyle: {
        color: '#333',
        fontSize: 12,
      },
    },
    legend: {
      top: 'bottom',
      itemGap: 10,
      textStyle: {
        fontSize: 12,
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true,
    },
    xAxis: [
      {
        type: 'category',
        data: analytics.leastProductSales.slice(0, 5).map((p) => p.displayName),
        axisTick: {
          alignWithLabel: true,
        },
        axisLabel: {
          rotate: 45,
          fontSize: 10,
        },
      },
    ],
    yAxis: [
      {
        type: 'value',
        axisLabel: {
          fontSize: 10,
        },
      },
    ],
    series: [
      {
        name: `${t.totalSales} (${t.currency})`,
        type: 'bar',
        barWidth: '40%',
        data: analytics.leastProductSales.slice(0, 5).map((p) => p.totalRevenue),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#FF6384' },
              { offset: 1, color: '#E11D48' },
            ],
          },
          shadowColor: 'rgba(0,0,0,0.2)',
          shadowBlur: 5,
          shadowOffsetY: 2,
          barBorderRadius: [5, 5, 0, 0],
        },
      },
      {
        name: t.quantity,
        type: 'bar',
        barWidth: '40%',
        data: analytics.leastProductSales.slice(0, 5).map((p) => p.totalQuantity),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#4BC0C0' },
              { offset: 1, color: '#0E7490' },
            ],
          },
          shadowColor: 'rgba(0,0,0,0.2)',
          shadowBlur: 5,
          shadowOffsetY: 2,
          barBorderRadius: [5, 5, 0, 0],
        },
      },
    ],
    media: [
      {
        query: { maxWidth: 600 },
        option: {
          legend: {
            orient: 'horizontal',
            bottom: 0,
            itemGap: 5,
            textStyle: { fontSize: 10 },
          },
          grid: { bottom: '20%', containLabel: true },
          xAxis: [{ axisLabel: { rotate: 60, fontSize: 8 } }],
          yAxis: [{ axisLabel: { fontSize: 8 } }],
          series: [{ barWidth: '30%' }, { barWidth: '30%' }],
        },
      },
    ],
  };

  // Define similar options for departmentSalesOption, leastDepartmentSalesOption, branchSalesOption, leastBranchSalesOption, salesTrendsOption, paymentMethodsOption, returnStatsOption
  // Use different colors, line styles (dashed for least), and shapes (e.g., circle dots for lines).

  if (user?.role !== 'admin') {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-gray-50 ${isRtl ? 'font-arabic' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <span className="text-red-600 text-base font-medium">{t.errors.unauthorized_access}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 font-sans ${isRtl ? 'font-arabic' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <header className="mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center">
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
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm font-medium">{error}</span>
        </div>
      )}

      {tabValue === 0 && (
        <div className="space-y-6">
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-6">{t.filters}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <SearchInput value={searchInput} onChange={handleSearchChange} placeholder={t.searchPlaceholder} />
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                aria-label={t.date}
              />
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
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
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200"
                aria-label={t.export}
              >
                {t.export}
              </button>
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t.previousSales}</h2>
            {loading || branchesLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, index) => (
                  <div
                    key={index}
                    className="p-5 bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse"
                  >
                    <div className="space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                    </div>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
                        <svg
                          className="animate-spin h-5 w-5 text-white mx-auto"
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
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-6">{t.analytics}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="w-full h-64">
              <ReactECharts option={productSalesOption} style={{ height: '100%', width: '100%' }} />
            </div>
            <div className="w-full h-64">
              <ReactECharts option={leastProductSalesOption} style={{ height: '100%', width: '100%' }} />
            </div>
            <div className="w-full h-64">
              <ReactECharts option={departmentSalesOption} style={{ height: '100%', width: '100%' }} />
            </div>
            <div className="w-full h-64">
              <ReactECharts option={leastDepartmentSalesOption} style={{ height: '100%', width: '100%' }} />
            </div>
            <div className="w-full h-64">
              <ReactECharts option={branchSalesOption} style={{ height: '100%', width: '100%' }} />
            </div>
            <div className="w-full h-64">
              <ReactECharts option={leastBranchSalesOption} style={{ height: '100%', width: '100%' }} />
            </div>
            <div className="w-full h-64">
              <ReactECharts option={salesTrendsOption} style={{ height: '100%', width: '100%' }} />
            </div>
            <div className="w-full h-64">
              <ReactECharts option={paymentMethodsOption} style={{ height: '100%', width: '100%' }} />
            </div>
            <div className="w-full h-64">
              <ReactECharts option={returnStatsOption} style={{ height: '100%', width: '100%' } } />
            </div>
            <div className="p-6 bg-gray-50 rounded-lg border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.totalSales}</h3>
              <p className="text-3xl font-bold text-amber-600">{analytics.totalSales} {t.currency}</p>
              <p className="text-sm text-gray-600 mt-2">{t.totalCount}: {analytics.totalCount}</p>
              <p className="text-sm text-gray-600 mt-2">{t.averageOrderValue}: {analytics.averageOrderValue} {t.currency}</p>
              <p className="text-sm text-gray-600 mt-2">{t.returnRate}: {analytics.returnRate}%</p>
              <p className="text-sm text-gray-600 mt-2">
                {t.topProduct}: {analytics.topProduct.displayName} ({analytics.topProduct.totalQuantity})
              </p>
            </div>
            <div className="p-6 bg-gray-50 rounded-lg border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.topCustomers}</h3>
              {analytics.topCustomers.length > 0 ? (
                <ul className="space-y-2">
                  {analytics.topCustomers.map((customer, index) => (
                    <li key={index} className="text-sm text-gray-600">
                      {customer.customerName} ({customer.customerPhone}) - {customer.totalSpent} {t.currency}, {customer.purchaseCount} {t.totalCount}
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

export default React.memo(SalesReport);