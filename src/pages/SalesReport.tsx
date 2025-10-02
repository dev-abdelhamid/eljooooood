import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import salesAPI from '../services/salesAPI';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, Search, X, ChevronDown, Edit, Trash, Download } from 'lucide-react';
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
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { debounce } from 'lodash';
import Papa from 'papaparse';
import { branchesAPI } from '../services/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend);

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
  branchSales: Array<{ branchId: string; branchName: string; branchNameEn?: string; displayName: string; totalSales: number; saleCount: number }>;
  productSales: Array<{ productId: string; productName: string; productNameEn?: string; displayName: string; totalQuantity: number; totalRevenue: number }>;
  departmentSales: Array<{ departmentId: string; departmentName: string; departmentNameEn?: string; displayName: string; totalRevenue: number; totalQuantity: number }>;
  totalSales: number;
  totalCount: number;
  topProduct: { productId: string | null; productName: string; productNameEn?: string; displayName: string; totalQuantity: number; totalRevenue: number };
  salesTrends: Array<{ period: string; totalSales: number; saleCount: number }>;
  topCustomers: Array<{ customerName: string; customerPhone: string; totalSpent: number; purchaseCount: number }>;
  paymentMethods: Array<{ paymentMethod: string; totalAmount: number; count: number }>;
}

const translations = {
  ar: {
    title: 'تقرير المبيعات',
    subtitle: 'إدارة المبيعات وإضافة مبيعات جديدة',
    filters: 'الفلاتر',
    noSales: 'لا توجد مبيعات',
    department: 'القسم',
    unitPrice: 'سعر الوحدة',
    total: 'الإجمالي',
    notes: 'ملاحظات',
    paymentMethod: 'طريقة الدفع',
    customerName: 'اسم العميل',
    customerPhone: 'هاتف العميل',
    submitSale: 'إرسال المبيعة',
    analytics: 'إحصائيات المبيعات',
    branchSales: 'مبيعات الفروع',
    productSales: 'مبيعات المنتجات',
    departmentSales: 'مبيعات الأقسام',
    totalSales: 'إجمالي المبيعات',
    totalCount: 'عدد المبيعات',
    topProduct: 'المنتج الأكثر مبيعًا',
    salesTrends: 'اتجاهات المبيعات',
    topCustomers: 'أفضل العملاء',
    paymentMethodsLabel: 'طرق الدفع',
    noSales: 'لا توجد مبيعات',
    date: 'التاريخ',
    quantity: 'الكمية',
    searchPlaceholder: 'ابحث عن المبيعات...',
    loadMore: 'تحميل المزيد',
    editSale: 'تعديل المبيعة',
    deleteSale: 'حذف المبيعة',
    confirmDelete: 'هل أنت متأكد من حذف هذه المبيعة؟',
    errors: {
      unauthorized_access: 'غير مصرح لك بالوصول',
      fetch_sales: 'خطأ أثناء جلب المبيعات',
      fetch_branches: 'خطأ أثناء جلب الفروع',
      update_sale_failed: 'فشل تعديل المبيعة',
      delete_sale_failed: 'فشل حذف المبيعة',
      invalid_sale_id: 'معرف المبيعة غير صالح',
      deleted_product: 'منتج محذوف',
      departments: { unknown: 'غير معروف' },
    },
    currency: 'ريال',
    units: { default: 'غير محدد' },
    branches: { all_branches: 'كل الفروع', select_branch: 'اختر الفرع', unknown: 'غير معروف' },
    paymentMethods: {
      cash: 'نقدي',
      credit_card: 'بطاقة ائتمان',
      bank_transfer: 'تحويل بنكي',
    },
  },
  en: {
    title: 'Sales Report',
    subtitle: 'Manage sales and add new sales',
    filters: 'Filters',
    noSales: 'No sales found',
    department: 'Department',
    unitPrice: 'Unit Price',
    total: 'Total',
    notes: 'Notes',
    paymentMethod: 'Payment Method',
    customerName: 'Customer Name',
    customerPhone: 'Customer Phone',
    submitSale: 'Submit Sale',
    analytics: 'Sales Analytics',
    branchSales: 'Branch Sales',
    productSales: 'Product Sales',
    departmentSales: 'Department Sales',
    totalSales: 'Total Sales',
    totalCount: 'Total Sale Count',
    topProduct: 'Top Selling Product',
    salesTrends: 'Sales Trends',
    topCustomers: 'Top Customers',
    paymentMethodsLabel: 'Payment Methods',
    noSales: 'No sales found',
    date: 'Date',
    quantity: 'Quantity',
    searchPlaceholder: 'Search sales...',
    loadMore: 'Load More',
    editSale: 'Edit Sale',
    deleteSale: 'Delete Sale',
    confirmDelete: 'Are you sure you want to delete this sale?',
    errors: {
      unauthorized_access: 'You are not authorized to access',
      fetch_sales: 'Error fetching sales',
      fetch_branches: 'Error fetching branches',
      update_sale_failed: 'Failed to update sale',
      delete_sale_failed: 'Failed to delete sale',
      invalid_sale_id: 'Invalid sale ID',
      deleted_product: 'Deleted Product',
      departments: { unknown: 'Unknown' },
    },
    currency: 'SAR',
    units: { default: 'N/A' },
    branches: { all_branches: 'All Branches', select_branch: 'Select Branch', unknown: 'Unknown' },
    paymentMethods: {
      cash: 'Cash',
      credit_card: 'Credit Card',
      bank_transfer: 'Bank Transfer',
    },
  },
};

// Memoized SaleCard
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
            <p className="text-sm text-gray-600">{t.total}: {sale.totalAmount} {t.currency}</p>
            {sale.paymentMethod && <p className="text-sm text-gray-600">{t.paymentMethod}: {t.paymentMethods[sale.paymentMethod as keyof typeof t.paymentMethods]}</p>}
            {sale.customerName && <p className="text-sm text-gray-600">{t.customerName}: {sale.customerName}</p>}
            {sale.customerPhone && <p className="text-sm text-gray-600">{t.customerPhone}: {sale.customerPhone}</p>}
            {sale.notes && <p className="text-sm text-gray-500">{t.notes}: {sale.notes}</p>}
            <ul className="list-disc list-inside text-sm text-gray-600 mt-2">
              {sale.items.map((item, index) => (
                <li key={index}>
                  {item.displayName || t.errors.deleted_product} ({item.department?.displayName || t.errors.departments.unknown}) - {t.quantity}: {item.quantity} {item.displayUnit || t.units.default}, {t.unitPrice}: {item.unitPrice} {t.currency}
                </li>
              ))}
            </ul>
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
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [salesLoading, setSalesLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const debouncedSearch = useCallback(debounce((value: string) => setSearchTerm(value.trim()), 300), []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSearch(value);
  };

  const fetchBranches = useCallback(async () => {
    try {
      const response = await branchesAPI.getAll();
      const fetchedBranches = Array.isArray(response.branches)
        ? response.branches.map((branch: any) => ({
            _id: branch._id,
            name: branch.name || t.branches.unknown,
            nameEn: branch.nameEn,
            displayName: isRtl ? branch.name : (branch.nameEn || branch.name || t.branches.unknown),
          }))
        : [];
      setBranches(fetchedBranches);
      if (fetchedBranches.length === 0) {
        toast.warn(t.errors.no_branches_available, { position: isRtl ? 'top-right' : 'top-left' });
      }
    } catch (err) {
      toast.error(t.errors.fetch_branches, { position: isRtl ? 'top-right' : 'top-left' });
    }
  }, [t, isRtl]);

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
          salesAPI.getAll(salesParams),
          salesAPI.getAnalytics(analyticsParams),
        ]);

        const newSales = salesResponse.sales.map((sale: any) => ({
          _id: sale._id,
          orderNumber: sale.saleNumber || sale.orderNumber,
          branch: {
            _id: sale.branch?._id || 'unknown',
            name: sale.branch?.name || t.branches.unknown,
            nameEn: sale.branch?.nameEn,
            displayName: isRtl ? sale.branch?.name : (sale.branch?.nameEn || sale.branch?.name || t.branches.unknown),
          },
          items: Array.isArray(sale.items)
            ? sale.items.map((item: any) => ({
                product: item.product?._id || item.productId,
                productName: item.product?.name || t.errors.deleted_product,
                productNameEn: item.product?.nameEn,
                unit: item.product?.unit,
                unitEn: item.product?.unitEn,
                displayName: isRtl ? (item.product?.name || t.errors.deleted_product) : (item.product?.nameEn || item.product?.name || t.errors.deleted_product),
                displayUnit: isRtl ? (item.product?.unit || t.units.default) : (item.product?.unitEn || item.product?.unit || t.units.default),
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                department: item.product?.department
                  ? {
                      _id: item.product.department._id,
                      name: item.product.department.name,
                      nameEn: item.product.department.nameEn,
                      displayName: isRtl ? item.product.department.name : (item.product.department.nameEn || item.product.department.name || t.errors.departments.unknown),
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
          branchSales: Array.isArray(analyticsResponse.branchSales)
            ? analyticsResponse.branchSales.map((bs: any) => ({
                ...bs,
                displayName: isRtl ? bs.branchName : (bs.branchNameEn || bs.branchName),
              }))
            : [],
          productSales: Array.isArray(analyticsResponse.productSales)
            ? analyticsResponse.productSales.map((ps: any) => ({
                ...ps,
                displayName: isRtl ? (ps.productName || t.errors.deleted_product) : (ps.productNameEn || ps.productName || t.errors.deleted_product),
              }))
            : [],
          departmentSales: Array.isArray(analyticsResponse.departmentSales)
            ? analyticsResponse.departmentSales.map((ds: any) => ({
                ...ds,
                displayName: isRtl ? ds.departmentName : (ds.departmentNameEn || ds.departmentName || t.errors.departments.unknown),
              }))
            : [],
          totalSales: analyticsResponse.totalSales || 0,
          totalCount: analyticsResponse.totalCount || 0,
          topProduct: analyticsResponse.topProduct
            ? {
                ...analyticsResponse.topProduct,
                displayName: isRtl ? (analyticsResponse.topProduct.productName || t.errors.deleted_product) : (analyticsResponse.topProduct.productNameEn || analyticsResponse.topProduct.productName || t.errors.deleted_product),
              }
            : { productId: null, productName: t.errors.departments.unknown, displayName: t.errors.departments.unknown, totalQuantity: 0, totalRevenue: 0 },
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
        });

        setError('');
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Fetch error:`, err);
        setError(err.message || t.errors.fetch_sales);
        toast.error(err.message || t.errors.fetch_sales, { position: isRtl ? 'top-right' : 'top-left' });
      } finally {
        setLoading(false);
        setSalesLoading(false);
      }
    },
    [filterBranch, filterStartDate, filterEndDate, user, t, isRtl, language]
  );

  useEffect(() => {
    fetchBranches();
    fetchData();
  }, [fetchBranches, fetchData]);

  const loadMoreSales = useCallback(() => {
    setPage((prev) => prev + 1);
    fetchData(page + 1, true);
  }, [fetchData, page]);

  const handleEditSale = useCallback((sale: Sale) => {
    setEditingSale(sale);
    setNotes(sale.notes || '');
    setPaymentMethod(sale.paymentMethod || 'cash');
    setCustomerName(sale.customerName || '');
    setCustomerPhone(sale.customerPhone || '');
  }, []);

  const handleUpdateSale = useCallback(async () => {
    if (!editingSale) return;
    if (customerPhone && !/^\+?\d{7,15}$/.test(customerPhone)) {
      setError(t.errors.invalid_customer_phone);
      toast.error(t.errors.invalid_customer_phone, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    if (!['cash', 'credit_card', 'bank_transfer'].includes(paymentMethod)) {
      setError(t.errors.invalid_payment_method);
      toast.error(t.errors.invalid_payment_method, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    try {
      const payload = {
        notes,
        paymentMethod,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
      };
      await salesAPI.update(editingSale._id, payload);
      toast.success(t.editSale, { position: isRtl ? 'top-right' : 'top-left' });
      setNotes('');
      setPaymentMethod('cash');
      setCustomerName('');
      setCustomerPhone('');
      setEditingSale(null);
      await fetchData();
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Update error:`, err);
      setError(err.message || t.errors.update_sale_failed);
      toast.error(err.message || t.errors.update_sale_failed, { position: isRtl ? 'top-right' : 'top-left' });
    }
  }, [editingSale, notes, paymentMethod, customerName, customerPhone, t, isRtl, fetchData]);

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

  const branchOptions = useMemo(() => [
    { value: '', label: t.branches.all_branches },
    ...branches.map((branch) => ({
      value: branch._id,
      label: branch.displayName,
    })),
  ], [branches, t.branches]);

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      if (filterBranch && sale.branch._id !== filterBranch) return false;
      const lowerSearch = searchTerm.toLowerCase();
      return sale.orderNumber.toLowerCase().includes(lowerSearch) || sale.customerName?.toLowerCase().includes(lowerSearch) || sale.customerPhone?.toLowerCase().includes(lowerSearch);
    });
  }, [sales, filterBranch, searchTerm]);

  const branchSalesChartData = useMemo(() => ({
    labels: analytics.branchSales.map((b) => b.displayName),
    datasets: [
      {
        label: t.branchSales,
        data: analytics.branchSales.map((b) => b.totalSales),
        backgroundColor: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
        borderColor: 'rgba(251, 191, 36, 1)',
        borderWidth: 1,
        hoverBackgroundColor: 'rgba(251, 191, 36, 0.8)',
      },
      {
        label: t.totalCount,
        data: analytics.branchSales.map((b) => b.saleCount),
        backgroundColor: 'linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
        hoverBackgroundColor: 'rgba(59, 130, 246, 0.8)',
      },
    ],
  }), [analytics.branchSales, t]);

  // Similar enhancements for other charts with gradients and hover effects
  const productSalesChartData = useMemo(() => ({
    labels: analytics.productSales.slice(0, 5).map((p) => p.displayName),
    datasets: [
      {
        label: t.productSales,
        data: analytics.productSales.slice(0, 5).map((p) => p.totalRevenue),
        backgroundColor: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
        borderColor: 'rgba(251, 191, 36, 1)',
        borderWidth: 1,
        hoverBackgroundColor: 'rgba(251, 191, 36, 0.8)',
      },
      {
        label: t.quantity,
        data: analytics.productSales.slice(0, 5).map((p) => p.totalQuantity),
        backgroundColor: 'linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
        hoverBackgroundColor: 'rgba(59, 130, 246, 0.8)',
      },
    ],
  }), [analytics.productSales, t]);

  const departmentSalesChartData = useMemo(() => ({
    labels: analytics.departmentSales.map((d) => d.displayName),
    datasets: [
      {
        label: t.departmentSales,
        data: analytics.departmentSales.map((d) => d.totalRevenue),
        backgroundColor: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
        borderColor: 'rgba(251, 191, 36, 1)',
        borderWidth: 1,
        hoverBackgroundColor: 'rgba(251, 191, 36, 0.8)',
      },
      {
        label: t.quantity,
        data: analytics.departmentSales.map((d) => d.totalQuantity),
        backgroundColor: 'linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
        hoverBackgroundColor: 'rgba(59, 130, 246, 0.8)',
      },
    ],
  }), [analytics.departmentSales, t]);

  const salesTrendsChartData = useMemo(() => ({
    labels: analytics.salesTrends.map((t) => t.period),
    datasets: [
      {
        label: t.salesTrends,
        data: analytics.salesTrends.map((t) => t.totalSales),
        fill: true,
        backgroundColor: 'rgba(251, 191, 36, 0.2)',
        borderColor: 'rgba(251, 191, 36, 1)',
        tension: 0.4,
        pointBackgroundColor: 'rgba(251, 191, 36, 1)',
        pointHoverBackgroundColor: 'rgba(251, 191, 36, 0.8)',
      },
      {
        label: t.totalCount,
        data: analytics.salesTrends.map((t) => t.saleCount),
        fill: true,
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgba(59, 130, 246, 1)',
        tension: 0.4,
        pointBackgroundColor: 'rgba(59, 130, 246, 1)',
        pointHoverBackgroundColor: 'rgba(59, 130, 246, 0.8)',
      },
    ],
  }), [analytics.salesTrends, t]);

  const paymentMethodsChartData = useMemo(() => ({
    labels: analytics.paymentMethods.map((pm) => pm.paymentMethod),
    datasets: [
      {
        label: t.paymentMethodsLabel,
        data: analytics.paymentMethods.map((pm) => pm.totalAmount),
        backgroundColor: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
        borderColor: 'rgba(251, 191, 36, 1)',
        borderWidth: 1,
        hoverBackgroundColor: 'rgba(251, 191, 36, 0.8)',
      },
      {
        label: t.totalCount,
        data: analytics.paymentMethods.map((pm) => pm.count),
        backgroundColor: 'linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
        hoverBackgroundColor: 'rgba(59, 130, 246, 0.8)',
      },
    ],
  }), [analytics.paymentMethods, t]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const },
      title: { display: true },
      tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', titleColor: 'white', bodyColor: 'white' },
    },
    scales: {
      y: { beginAtZero: true },
    },
  };

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
      <header className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center gap-3">
          <DollarSign className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
            <p className="text-gray-600 text-sm">{t.subtitle}</p>
          </div>
        </div>
      </header>

      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setTabValue(0)}
          className={`px-6 py-2 font-medium text-sm transition-colors ${tabValue === 0 ? 'border-b-2 border-amber-600 text-amber-600' : 'text-gray-600 hover:text-amber-600'}`}
        >
          {t.previousSales}
        </button>
        <button
          onClick={() => setTabValue(1)}
          className={`px-6 py-2 font-medium text-sm transition-colors ${tabValue === 1 ? 'border-b-2 border-amber-600 text-amber-600' : 'text-gray-600 hover:text-amber-600'}`}
        >
          {t.analytics}
        </button>
      </div>

      {tabValue === 0 && (
        <div className="mt-6">
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">{t.filters}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <ProductDropdown
                value={filterBranch}
                onChange={setFilterBranch}
                options={branchOptions}
                ariaLabel={t.branches.select_branch}
              />
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                placeholder={t.date}
                aria-label={t.date}
              />
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                placeholder={t.date}
                aria-label={t.date}
              />
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={fetchData}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 mr-2"
              >
                {isRtl ? 'تطبيق' : 'Apply'}
              </button>
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                {t.export}
              </button>
            </div>
            <SearchInput
              value={searchInput}
              onChange={handleSearchChange}
              placeholder={t.searchPlaceholder}
              ariaLabel={t.searchPlaceholder}
            />
          </div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="h-[200px] p-5 bg-white rounded-xl shadow-sm border border-gray-100">
                  <div className="space-y-3 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100">
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

      {tabValue === 1 && (
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-6">{t.analytics}</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">{t.branchSales}</h3>
              <div className="h-64">
                <Bar data={branchSalesChartData} options={chartOptions} />
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">{t.productSales}</h3>
              <div className="h-64">
                <Bar data={productSalesChartData} options={chartOptions} />
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">{t.departmentSales}</h3>
              <div className="h-64">
                <Bar data={departmentSalesChartData} options={chartOptions} />
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">{t.salesTrends}</h3>
              <div className="h-64">
                <Line data={salesTrendsChartData} options={chartOptions} />
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">{t.paymentMethodsLabel}</h3>
              <div className="h-64">
                <Doughnut data={paymentMethodsChartData} options={chartOptions} />
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.totalSales}</h3>
              <p className="text-2xl font-bold text-amber-600">{analytics.totalSales} {t.currency}</p>
              <p className="text-sm text-gray-600 mt-2">{t.totalCount}: {analytics.totalCount}</p>
              <p className="text-sm text-gray-600 mt-2">{t.topProduct}: {analytics.topProduct.displayName} ({analytics.topProduct.totalQuantity})</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.topCustomers}</h3>
              {analytics.topCustomers.length > 0 ? (
                <ul className="space-y-2">
                  {analytics.topCustomers.map((customer, index) => (
                    <li key={index} className="text-sm text-gray-600">
                      {customer.customerName || 'N/A'} ({customer.customerPhone || 'N/A'}) - {customer.totalSpent} {t.currency}, {customer.purchaseCount} {t.totalCount}
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
      {editingSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t.editSale}</h2>
            <div className="space-y-4">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={t.customerName}
                className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                aria-label={t.customerName}
              />
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder={t.customerPhone}
                className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                aria-label={t.customerPhone}
              />
              <Dropdown
                value={paymentMethod}
                onChange={setPaymentMethod}
                options={paymentMethodOptions}
                ariaLabel={t.paymentMethod}
              />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.notes}
                className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm resize-none h-24 ${isRtl ? 'text-right' : 'text-left'}`}
                aria-label={t.notes}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleUpdateSale}
                  className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200"
                >
                  {t.editSale}
                </button>
                <button
                  onClick={() => setEditingSale(null)}
                  className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors duration-200"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(SalesReport);