import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import salesAPI from '../services/salesAPI';
import { branchesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, DollarSign, Search, X, ChevronDown, Edit, Trash, TrendingUp, Package, Building, Layers } from 'lucide-react';
import { toast } from 'react-toastify';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend } from 'chart.js';
import { debounce } from 'lodash';
import Papa from 'papaparse';

// تسجيل مكونات Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

// تعريف الأنواع
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

// الترجمات
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
    topProduct: 'المنتج الأكثر مبيعًا',
    salesTrends: 'اتجاهات المبيعات',
    topCustomers: 'أفضل العملاء',
    unknownCustomers: 'عملاء غير معروفين',
    noSales: 'لا توجد مبيعات',
    date: 'التاريخ',
    quantity: 'الكمية',
    branchFilter: 'اختر فرعًا',
    allBranches: 'جميع الفروع',
    searchPlaceholder: 'ابحث عن المبيعات...',
    loadMore: 'تحميل المزيد',
    editSale: 'تعديل المبيعة',
    deleteSale: 'حذف المبيعة',
    confirmDelete: 'هل أنت متأكد من حذف هذه المبيعة؟',
    export: 'تصدير',
    customerNameLabel: 'اسم العميل',
    customerPhoneLabel: 'رقم الهاتف',
    paymentMethodLabel: 'طريقة الدفع',
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
    topProduct: 'Top Selling Product',
    salesTrends: 'Sales Trends',
    topCustomers: 'Top Customers',
    unknownCustomers: 'Unknown Customers',
    noSales: 'No sales found',
    date: 'Date',
    quantity: 'Quantity',
    branchFilter: 'Select Branch',
    allBranches: 'All Branches',
    searchPlaceholder: 'Search sales...',
    loadMore: 'Load More',
    editSale: 'Edit Sale',
    deleteSale: 'Delete Sale',
    confirmDelete: 'Are you sure you want to delete this sale?',
    export: 'Export',
    customerNameLabel: 'Customer Name',
    customerPhoneLabel: 'Phone Number',
    paymentMethodLabel: 'Payment Method',
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
  },
};

// مكون البحث
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
        className={`w-full ${isRtl ? 'pl-12 pr-4' : 'pr-12 pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'} font-alexandria`}
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

// مكون فلتر الفروع
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
        className={`w-full ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm appearance-none ${isRtl ? 'text-right' : 'text-left'} font-alexandria`}
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

// مكون بطاقة المبيعة
const SaleCard = React.memo<{ sale: Sale; onEdit: (sale: Sale) => void; onDelete: (id: string) => void }>(
  ({ sale, onEdit, onDelete }) => {
    const { language } = useLanguage();
    const isRtl = language === 'ar';
    const t = translations[isRtl ? 'ar' : 'en'];
    return (
      <div className="p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100">
        <div className="flex flex-col sm:flex-row items-start justify-between space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="space-y-3 w-full">
            <h3 className="font-semibold text-gray-800 text-lg font-alexandria">{sale.orderNumber}</h3>
            <p className="text-sm text-gray-500 font-alexandria">{t.date}: {sale.createdAt}</p>
            <p className="text-sm text-gray-500 font-alexandria">{t.branchSales}: {sale.branch?.displayName || t.errors.departments.unknown}</p>
            <p className="text-sm text-gray-500 font-alexandria">{t.totalSales}: {sale.totalAmount} {t.currency}</p>
            {sale.paymentMethod && (
              <p className="text-sm text-gray-500 font-alexandria">
                <span className="font-medium">{t.paymentMethodLabel}: </span>{t.paymentMethods[sale.paymentMethod as keyof typeof t.paymentMethods] || 'N/A'}
              </p>
            )}
            {sale.customerName && (
              <p className="text-sm text-gray-500 font-alexandria">
                <span className="font-medium">{t.customerNameLabel}: </span>{sale.customerName}
              </p>
            )}
            {sale.customerPhone && (
              <p className="text-sm text-gray-500 font-alexandria">
                <span className="font-medium">{t.customerPhoneLabel}: </span>{sale.customerPhone}
              </p>
            )}
            {sale.notes && <p className="text-sm text-gray-400 italic font-alexandria">{t.notes}: {sale.notes}</p>}
            <ul className="space-y-2 text-sm text-gray-600">
              {sale.items.map((item, index) => (
                <li key={index} className="border-t border-gray-100 pt-2 font-alexandria">
                  {item.displayName || t.errors.deleted_product} ({item.department?.displayName || t.errors.departments.unknown}) - {t.quantity}: {item.quantity} {item.displayUnit || t.units.default}, {t.totalSales}: {item.unitPrice} {t.currency}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-3">
            <button onClick={() => onEdit(sale)} aria-label={t.editSale}>
              <Edit className="w-5 h-5 text-blue-500 hover:text-blue-700 transition-colors" />
            </button>
            <button onClick={() => onDelete(sale._id)} aria-label={t.deleteSale}>
              <Trash className="w-5 h-5 text-red-500 hover:text-red-700 transition-colors" />
            </button>
          </div>
        </div>
      </div>
    );
  }
);

// مكون الرسم البياني المخصص
const ChartContainer: React.FC<{
  title: string;
  data: any;
  type: 'bar' | 'line';
  height: string;
  options: any;
  icon: React.ReactNode;
}> = ({ title, data, type, height, options, icon }) => (
  <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden transform hover:scale-[1.01] transition-transform duration-300">
    <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200 flex items-center gap-3">
      {icon}
      <h3 className="text-lg font-bold text-blue-900 font-alexandria">{title}</h3>
    </div>
    <div className={`w-full ${height} p-4`}>
      {type === 'bar' ? <Bar data={data} options={options} /> : <Line data={data} options={options} />}
    </div>
  </div>
);

// المكون الرئيسي
export const SalesReport: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { socket, emit, isConnected } = useSocket();
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
    topProduct: { productId: null, productName: '', displayName: '', totalQuantity: 0, totalRevenue: 0 },
    salesTrends: [],
    topCustomers: [],
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
      setBranches(
        response.map((branch: any) => ({
          _id: branch._id,
          name: branch.name,
          nameEn: branch.nameEn,
          displayName: isRtl ? branch.name : branch.nameEn || branch.name || t.errors.departments.unknown,
        }))
      );
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Fetch branches error:`, err.message, err.stack);
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
        const newSales = (salesResponse.sales || []).map((sale: any) => ({
          _id: sale._id,
          orderNumber: sale.saleNumber || sale.orderNumber || 'N/A',
          branch: sale.branch
            ? {
                _id: sale.branch._id,
                name: sale.branch.name,
                nameEn: sale.branch.nameEn,
                displayName: isRtl ? sale.branch.name : sale.branch.nameEn || sale.branch.name || t.errors.departments.unknown,
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
            quantity: item.quantity || 0,
            unitPrice: item.unitPrice || 0,
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
          customerName: sale.customerName,
          customerPhone: sale.customerPhone,
        }));
        setSales((prev) => (append ? [...prev, ...newSales] : newSales));
        setHasMore(salesResponse.total > pageNum * 20);
        setAnalytics({
          branchSales: (analyticsResponse.branchSales || []).map((bs: any) => ({
            ...bs,
            displayName: isRtl ? bs.branchName : bs.branchNameEn || bs.branchName || t.errors.departments.unknown,
          })),
          leastBranchSales: (analyticsResponse.leastBranchSales || []).map((bs: any) => ({
            ...bs,
            displayName: isRtl ? bs.branchName : bs.branchNameEn || bs.branchName || t.errors.departments.unknown,
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
            ...bs,
            displayName: isRtl
              ? ds.departmentName
              : ds.departmentNameEn || ds.departmentName || t.errors.departments.unknown,
          })),
          totalSales: analyticsResponse.totalSales || 0,
          totalCount: analyticsResponse.totalCount || 0,
          averageOrderValue: analyticsResponse.averageOrderValue || 0,
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
            period: new Date(trend.period).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', { day: '2-digit', month: '2-digit' }),
          })),
          topCustomers: (analyticsResponse.topCustomers || []),
        });
        setError('');
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Fetch error:`, err.message, err.stack);
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
  }, [fetchBranches, fetchData, filterBranch]);

  useEffect(() => {
    if (!socket || !isConnected) return;
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
  }, [socket, isConnected, fetchData, filterBranch, isRtl]);

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
          emit('saleDeleted', { saleId: id, branchId: filterBranch });
          fetchData();
        } catch (err: any) {
          console.error(`[${new Date().toISOString()}] Delete error:`, err);
          setError(t.errors.delete_sale_failed);
          toast.error(t.errors.delete_sale_failed, { position: isRtl ? 'top-right' : 'top-left' });
        }
      }
    },
    [t, emit, fetchData, isRtl, filterBranch]
  );

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
    () => sales.filter((sale) => {
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

  const processedTopCustomers = useMemo(() => {
    const customers = analytics.topCustomers.map((customer) => {
      if (!customer.customerName && !customer.customerPhone) {
        return { ...customer, customerName: t.unknownCustomers, customerPhone: '' };
      }
      return customer;
    });
    return customers.sort((a, b) => {
      if (a.customerName === t.unknownCustomers) return 1;
      if (b.customerName === t.unknownCustomers) return -1;
      return b.totalSpent - a.totalSpent;
    });
  }, [analytics.topCustomers, t]);

  // ألوان الرسوم
  const chartColors = ['#FBBF24', '#3B82F6', '#FF6384', '#4BC0C0', '#9966FF'];

  // إنشاء التدرج اللوني
  const createGradient = (ctx: any, color: string) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, `${color}D9`);
    gradient.addColorStop(1, `${color}4D`);
    return gradient;
  };

  // خيارات الرسوم المحسنة
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          font: { size: 12, family: 'Alexandria', weight: '500' },
          color: '#1F2937',
          padding: 20,
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(31, 41, 55, 0.9)',
        titleColor: '#FFFFFF',
        bodyColor: '#FFFFFF',
        borderColor: '#FBBF24',
        borderWidth: 1,
        titleFont: { size: 14, family: 'Alexandria', weight: '600' },
        bodyFont: { size: 12, family: 'Alexandria', weight: '400' },
        padding: 12,
        cornerRadius: 6,
        boxPadding: 6,
      },
      title: {
        display: false, // العنوان يظهر في ChartContainer
      },
    },
    scales: {
      x: {
        ticks: {
          font: { size: 11, family: 'Alexandria', weight: '400' },
          color: '#4B5563',
          maxRotation: isRtl ? 0 : 45,
          minRotation: isRtl ? 0 : 45,
          autoSkip: true,
          maxTicksLimit: 20,
          padding: 10,
        },
        grid: { display: false },
        title: {
          display: true,
          text: isRtl ? 'الفئات' : 'Categories',
          font: { size: 12, family: 'Alexandria', weight: '600' },
          color: '#1F2937',
          padding: { top: 10, bottom: 10 },
        },
      },
      y: {
        ticks: {
          font: { size: 11, family: 'Alexandria', weight: '400' },
          color: '#4B5563',
          callback: (value: any) => `${value} ${t.currency}`,
        },
        grid: { color: 'rgba(229, 231, 235, 0.3)', drawBorder: false },
        title: {
          display: true,
          text: t.totalSales,
          font: { size: 12, family: 'Alexandria', weight: '600' },
          color: '#1F2937',
          padding: { top: 10, bottom: 10 },
        },
      },
    },
    elements: {
      bar: {
        borderRadius: 6,
        borderSkipped: false,
        barThickness: 10, // عرض أصغر للأعمدة
      },
      line: {
        tension: 0.5,
      },
      point: {
        radius: 5,
        hoverRadius: 7,
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
      },
    },
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    layout: {
      padding: 10,
    },
  }), [isRtl, t]);

  // بيانات الرسوم
  const productSalesData = useMemo(() => ({
    labels: analytics.productSales.map((p) => p.displayName),
    datasets: [
      {
        label: t.totalSales,
        data: analytics.productSales.map((p) => p.totalRevenue),
        backgroundColor: (ctx: any) => createGradient(ctx.chart.ctx, chartColors[0]),
        borderColor: chartColors[0],
        borderWidth: 1,
      },
    ],
  }), [analytics.productSales, t]);

  const leastProductSalesData = useMemo(() => ({
    labels: analytics.leastProductSales.map((p) => p.displayName),
    datasets: [
      {
        label: t.totalSales,
        data: analytics.leastProductSales.map((p) => p.totalRevenue),
        backgroundColor: (ctx: any) => createGradient(ctx.chart.ctx, chartColors[1]),
        borderColor: chartColors[1],
        borderWidth: 1,
      },
    ],
  }), [analytics.leastProductSales, t]);

  const departmentSalesData = useMemo(() => ({
    labels: analytics.departmentSales.map((d) => d.displayName),
    datasets: [
      {
        label: t.totalSales,
        data: analytics.departmentSales.map((d) => d.totalRevenue),
        backgroundColor: (ctx: any) => createGradient(ctx.chart.ctx, chartColors[2]),
        borderColor: chartColors[2],
        borderWidth: 1,
      },
    ],
  }), [analytics.departmentSales, t]);

  const leastDepartmentSalesData = useMemo(() => ({
    labels: analytics.leastDepartmentSales.map((d) => d.displayName),
    datasets: [
      {
        label: t.totalSales,
        data: analytics.leastDepartmentSales.map((d) => d.totalRevenue),
        backgroundColor: (ctx: any) => createGradient(ctx.chart.ctx, chartColors[3]),
        borderColor: chartColors[3],
        borderWidth: 1,
      },
    ],
  }), [analytics.leastDepartmentSales, t]);

  const branchSalesData = useMemo(() => ({
    labels: analytics.branchSales.map((b) => b.displayName),
    datasets: [
      {
        label: t.totalSales,
        data: analytics.branchSales.map((b) => b.totalSales),
        backgroundColor: (ctx: any) => createGradient(ctx.chart.ctx, chartColors[4]),
        borderColor: chartColors[4],
        borderWidth: 1,
        barThickness: 8, // عرض أصغر للفروع
      },
    ],
  }), [analytics.branchSales, t]);

  const leastBranchSalesData = useMemo(() => ({
    labels: analytics.leastBranchSales.map((b) => b.displayName),
    datasets: [
      {
        label: t.totalSales,
        data: analytics.leastBranchSales.map((b) => b.totalSales),
        backgroundColor: (ctx: any) => createGradient(ctx.chart.ctx, chartColors[0]),
        borderColor: chartColors[0],
        borderWidth: 1,
        barThickness: 8,
      },
    ],
  }), [analytics.leastBranchSales, t]);

  const salesTrendsData = useMemo(() => ({
    labels: analytics.salesTrends.map((trend) => trend.period),
    datasets: [
      {
        label: t.totalCount,
        data: analytics.salesTrends.map((trend) => trend.saleCount),
        borderColor: chartColors[1],
        backgroundColor: (ctx: any) => createGradient(ctx.chart.ctx, chartColors[1]),
        fill: true,
        tension: 0.5,
        pointBackgroundColor: '#FFFFFF',
        pointBorderColor: chartColors[1],
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
      },
    ],
  }), [analytics.salesTrends, t]);

  if (user?.role !== 'admin') {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-gray-50 ${isRtl ? 'font-alexandria' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <span className="text-red-600 text-base font-medium font-alexandria">{t.errors.unauthorized_access}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 p-4 md:p-8 ${isRtl ? 'font-alexandria' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <header className="mb-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <DollarSign className="w-6 h-6 text-amber-600" />
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 font-alexandria">{t.title}</h1>
            <p className="text-gray-500 text-sm font-alexandria">{t.previousSales}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setTabValue(0)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all font-alexandria ${tabValue === 0 ? 'bg-amber-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            {t.previousSales}
          </button>
          <button
            onClick={() => setTabValue(1)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all font-alexandria ${tabValue === 1 ? 'bg-amber-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            {t.analytics}
          </button>
        </div>
      </header>
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-sm font-alexandria">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 font-medium">{error}</span>
        </div>
      )}
      {tabValue === 0 && (
        <div className="space-y-6">
          <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 font-alexandria">{t.filters}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <SearchInput value={searchInput} onChange={handleSearchChange} placeholder={t.searchPlaceholder} />
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'} font-alexandria`}
                aria-label={t.date}
              />
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'} font-alexandria`}
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
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors font-alexandria"
                aria-label={t.export}
              >
                {t.export}
              </button>
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-3 font-alexandria">{t.previousSales}</h2>
            {loading || branchesLoading ? (
              <div className="grid grid-cols-1 gap-4">
                {[...Array(6)].map((_, index) => (
                  <div key={index} className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse">
                    <div className="space-y-3">
                      <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="p-6 text-center bg-white rounded-xl shadow-sm border border-gray-100">
                <DollarSign className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 text-sm font-medium font-alexandria">{t.noSales}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4">
                  {filteredSales.map((sale) => (
                    <SaleCard key={sale._id} sale={sale} onEdit={handleEditSale} onDelete={handleDeleteSale} />
                  ))}
                </div>
                {hasMore && (
                  <div className="flex justify-center mt-4">
                    <button
                      onClick={loadMoreSales}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 font-alexandria"
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
      )}
      {tabValue === 1 && (
        <div className="space-y-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 font-alexandria">{t.analytics}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-2 text-sm font-alexandria">
              <h3 className="font-semibold text-gray-800">{t.totalSales}</h3>
              <p className="font-bold text-amber-600 text-lg">{analytics.totalSales} {t.currency}</p>
              <p className="text-gray-600">{t.totalCount}: {analytics.totalCount}</p>
              <p className="text-gray-600">{t.averageOrderValue}: {analytics.averageOrderValue} {t.currency}</p>
              <p className="text-gray-600">{t.topProduct}: {analytics.topProduct.displayName} ({analytics.topProduct.totalQuantity})</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-2 text-sm font-alexandria">
              <h3 className="font-semibold text-gray-800">{t.topCustomers}</h3>
              {processedTopCustomers.length > 0 ? (
                <ul className="space-y-2 text-gray-600">
                  {processedTopCustomers.map((customer, index) => (
                    <li key={index}>
                      <span className="font-medium">{t.customerNameLabel}: </span>{customer.customerName} ({customer.customerPhone}) - {customer.totalSpent} {t.currency}, {customer.purchaseCount} {t.totalCount}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-600">{t.noSales}</p>
              )}
            </div>
          </div>
          <ChartContainer
            title={t.salesTrends}
            data={salesTrendsData}
            type="line"
            height="h-72 sm:h-80"
            options={chartOptions}
            icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10">
            <ChartContainer
              title={t.productSales}
              data={productSalesData}
              type="bar"
              height="h-64 sm:h-72"
              options={{ ...chartOptions, elements: { bar: { barThickness: 10 } } }}
              icon={<Package className="w-5 h-5 text-amber-600" />}
            />
            <ChartContainer
              title={t.leastProductSales}
              data={leastProductSalesData}
              type="bar"
              height="h-64 sm:h-72"
              options={{ ...chartOptions, elements: { bar: { barThickness: 10 } } }}
              icon={<Package className="w-5 h-5 text-red-600" />}
            />
            <ChartContainer
              title={t.departmentSales}
              data={departmentSalesData}
              type="bar"
              height="h-64 sm:h-72"
              options={{ ...chartOptions, elements: { bar: { barThickness: 10 } } }}
              icon={<Layers className="w-5 h-5 text-purple-600" />}
            />
            <ChartContainer
              title={t.leastDepartmentSales}
              data={leastDepartmentSalesData}
              type="bar"
              height="h-64 sm:h-72"
              options={{ ...chartOptions, elements: { bar: { barThickness: 10 } } }}
              icon={<Layers className="w-5 h-5 text-pink-600" />}
            />
            <ChartContainer
              title={t.branchSales}
              data={branchSalesData}
              type="bar"
              height="h-72 sm:h-80"
              options={{ ...chartOptions, elements: { bar: { barThickness: 8 } } }}
              icon={<Building className="w-5 h-5 text-green-600" />}
            />
            <ChartContainer
              title={t.leastBranchSales}
              data={leastBranchSalesData}
              type="bar"
              height="h-72 sm:h-80"
              options={{ ...chartOptions, elements: { bar: { barThickness: 8 } } }}
              icon={<Building className="w-5 h-5 text-orange-600" />}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(SalesReport);