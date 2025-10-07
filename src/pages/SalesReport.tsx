import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import salesAPI from '../services/salesAPI';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, DollarSign, Search, X, ChevronDown, Edit, Trash } from 'lucide-react';
import { toast } from 'react-toastify';
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
  ArcElement,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { debounce } from 'lodash';
import Papa from 'papaparse';
import io from 'socket.io-client';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend);

const socket = io('https://eljoodia-server-production.up.railway.app');

const translations = {
  ar: {
    title: 'تقرير المبيعات',
    previousSales: 'المبيعات السابقة',
    analytics: 'إحصائيات المبيعات',
    productSales: 'مبيعات المنتجات',
    departmentSales: 'مبيعات الأقسام',
    branchSales: 'مبيعات الفروع',
    leastProductSales: 'أقل المنتجات مبيعًا',
    leastDepartmentSales: 'أقل الأقسام مبيعًا',
    leastBranchSales: 'أقل الفروع أداءً',
    totalSales: 'إجمالي المبيعات',
    totalCount: 'عدد المبيعات',
    averageOrderValue: 'متوسط قيمة الطلب',
    returnRate: 'نسبة المرتجعات',
    topProduct: 'المنتج الأكثر مبيعًا',
    salesTrends: 'اتجاهات المبيعات',
    topCustomers: 'أفضل العملاء',
    paymentMethodsLabel: 'طرق الدفع',
    returnStats: 'إحصائيات المرتجعات',
    orderTracking: 'تتبع الطلبات',
    noSales: 'لا توجد مبيعات',
    date: 'التاريخ',
    returns: 'المرتجعات',
    return: 'مرتجع',
    reason: 'السبب',
    quantity: 'الكمية',
    branch: 'الفرع',
    status: 'الحالة',
    searchPlaceholder: 'ابحث عن المبيعات...',
    loadMore: 'تحميل المزيد',
    editSale: 'تعديل المبيعة',
    deleteSale: 'حذف المبيعة',
    confirmDelete: 'هل أنت متأكد من حذف هذه المبيعة؟',
    export: 'تصدير',
    errors: {
      unauthorized_access: 'غير مصرح لك بالوصول',
      fetch_sales: 'خطأ أثناء جلب المبيعات',
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
    branchSales: 'Branch Sales',
    leastProductSales: 'Least Sold Products',
    leastDepartmentSales: 'Least Sold Departments',
    leastBranchSales: 'Least Performing Branches',
    totalSales: 'Total Sales',
    totalCount: 'Total Sale Count',
    averageOrderValue: 'Average Order Value',
    returnRate: 'Return Rate',
    topProduct: 'Top Selling Product',
    salesTrends: 'Sales Trends',
    topCustomers: 'Top Customers',
    paymentMethodsLabel: 'Payment Methods',
    returnStats: 'Return Statistics',
    orderTracking: 'Order Tracking',
    noSales: 'No sales found',
    date: 'Date',
    returns: 'Returns',
    return: 'Return',
    reason: 'Reason',
    quantity: 'Quantity',
    branch: 'Branch',
    status: 'Status',
    searchPlaceholder: 'Search sales...',
    loadMore: 'Load More',
    editSale: 'Edit Sale',
    deleteSale: 'Delete Sale',
    confirmDelete: 'Are you sure you want to delete this sale?',
    export: 'Export',
    errors: {
      unauthorized_access: 'You are not authorized to access',
      fetch_sales: 'Error fetching sales',
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
      credit_card: 'Credit Card',
      bank_transfer: 'Bank Transfer',
    },
    returns: { status: { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' } },
  },
};

const SearchInput = React.memo(({ value, onChange, placeholder }) => {
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
          onClick={() => onChange({ target: { value: '' } })}
          className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-amber-500 transition-colors`}
          aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
});

const SaleCard = React.memo(({ sale, onEdit, onDelete }) => {
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
          {sale.paymentMethod && (
            <p className="text-sm text-gray-600">
              {t.paymentMethodsLabel}: {t.paymentMethods[sale.paymentMethod]}
            </p>
          )}
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
          {sale.returns?.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700">{t.returns}:</p>
              <ul className="list-disc list-inside text-sm text-gray-600">
                {sale.returns.map((ret, index) => (
                  <li key={index}>
                    {t.return} #{ret.returnNumber} ({t.returns.status[ret.status]}) - {t.reason}: {ret.reason} ({t.date}: {ret.createdAt})
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
});

const MetricCard = ({ title, value, icon, color }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className={`bg-white shadow-lg rounded-lg p-6 flex items-center ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`text-3xl mr-4 ${color}`}>{icon}</div>
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-2xl">{value}</p>
      </div>
    </div>
  );
};

const OrderTrackingTable = ({ orders, t, isRtl }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full bg-white shadow-md rounded-lg">
      <thead>
        <tr className="bg-gray-100">
          <th className="px-4 py-2">{t.orderNumber}</th>
          <th className="px-4 py-2">{t.branch}</th>
          <th className="px-4 py-2">{t.status}</th>
          <th className="px-4 py-2">{t.total}</th>
          <th className="px-4 py-2">{t.actions}</th>
        </tr>
      </thead>
      <tbody>
        {orders.map(order => (
          <tr key={order._id} className="border-b">
            <td className="px-4 py-2">{order.orderNumber}</td>
            <td className="px-4 py-2">{order.branch?.displayName || t.errors.departments.unknown}</td>
            <td className="px-4 py-2">{t.returns.status[order.status] || order.status}</td>
            <td className="px-4 py-2">{order.totalAmount} {t.currency}</td>
            <td className="px-4 py-2">
              <button className="text-blue-500">{t.view}</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const SalesReport = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [sales, setSales] = useState([]);
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState({
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
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [salesLoading, setSalesLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [tabValue, setTabValue] = useState(0);

  const debouncedSearch = useCallback(debounce((value) => setSearchTerm(value.trim()), 300), []);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSearch(value);
  };

  const fetchData = useCallback(async (pageNum = 1, append = false) => {
    if (user?.role !== 'admin') {
      setError(t.errors.unauthorized_access);
      toast.error(t.errors.unauthorized_access, { position: isRtl ? 'top-right' : 'top-left' });
      setLoading(false);
      return;
    }

    setLoading(pageNum === 1);
    setSalesLoading(pageNum > 1);
    try {
      const salesParams = { page: pageNum, limit: 20, sort: '-createdAt', startDate: filterStartDate, endDate: filterEndDate };
      const analyticsParams = { startDate: filterStartDate, endDate: filterEndDate };

      const [salesResponse, analyticsResponse] = await Promise.all([
        salesAPI.getAll(salesParams),
        salesAPI.getAnalytics(analyticsParams),
      ]);

      const returnsMap = new Map();
      (salesResponse.returns || []).forEach(ret => {
        const orderId = ret.order?._id || ret.order;
        if (!returnsMap.has(orderId)) returnsMap.set(orderId, []);
        returnsMap.get(orderId).push({
          _id: ret._id,
          returnNumber: ret.returnNumber,
          status: ret.status,
          items: (ret.items || []).map(item => ({
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

      const newSales = (salesResponse.sales || []).map(sale => ({
        _id: sale._id,
        orderNumber: sale.saleNumber || sale.orderNumber,
        items: (sale.items || []).map(item => ({
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
        customerName: sale.customerName,
        customerPhone: sale.customerPhone,
        returns: returnsMap.get(sale._id) || [],
        branch: sale.branch
          ? {
              _id: sale.branch._id,
              name: sale.branch.name,
              nameEn: sale.branch.nameEn,
              displayName: isRtl
                ? sale.branch.name
                : sale.branch.nameEn || sale.branch.name || t.errors.departments.unknown,
            }
          : undefined,
      }));

      setSales(prev => (append ? [...prev, ...newSales] : newSales));
      setOrders(prev => (append ? [...prev, ...newSales] : newSales));
      setHasMore(salesResponse.total > pageNum * 20);

      setAnalytics({
        branchSales: (analyticsResponse.branchSales || []).map(bs => ({
          ...bs,
          displayName: isRtl ? bs.branchName : bs.branchNameEn || bs.branchName,
        })),
        leastBranchSales: (analyticsResponse.leastBranchSales || []).map(bs => ({
          ...bs,
          displayName: isRtl ? bs.branchName : bs.branchNameEn || bs.branchName,
        })),
        productSales: (analyticsResponse.productSales || []).map(ps => ({
          ...ps,
          displayName: isRtl ? ps.productName : ps.productNameEn || ps.productName,
        })),
        leastProductSales: (analyticsResponse.leastProductSales || []).map(ps => ({
          ...ps,
          displayName: isRtl ? ps.productName : ps.productNameEn || ps.productName,
        })),
        departmentSales: (analyticsResponse.departmentSales || []).map(ds => ({
          ...ds,
          displayName: isRtl ? ds.departmentName : ds.departmentNameEn || ds.departmentName,
        })),
        leastDepartmentSales: (analyticsResponse.leastDepartmentSales || []).map(ds => ({
          ...ds,
          displayName: isRtl ? ds.departmentName : ds.departmentNameEn || ds.departmentName,
        })),
        totalSales: analyticsResponse.totalSales || 0,
        totalCount: analyticsResponse.totalCount || 0,
        averageOrderValue: analyticsResponse.averageOrderValue || 0,
        returnRate: analyticsResponse.returnRate || 0,
        topProduct: analyticsResponse.topProduct
          ? {
              ...analyticsResponse.topProduct,
              displayName: isRtl
                ? analyticsResponse.topProduct.productName
                : analyticsResponse.topProduct.productNameEn || analyticsResponse.topProduct.productName,
            }
          : { productId: null, productName: '', displayName: '', totalQuantity: 0, totalRevenue: 0 },
        salesTrends: (analyticsResponse.salesTrends || []).map(trend => ({
          ...trend,
          period: formatDate(trend.period, language),
        })),
        topCustomers: analyticsResponse.topCustomers || [],
        paymentMethods: (analyticsResponse.paymentMethods || []).map(pm => ({
          ...pm,
          paymentMethod: t.paymentMethods[pm.paymentMethod] || pm.paymentMethod,
        })),
        returnStats: (analyticsResponse.returnStats || []).map(rs => ({
          ...rs,
          status: t.returns.status[rs.status] || rs.status,
        })),
      });

      setError('');
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Fetch error:`, err);
      setError(err.message === 'Invalid sale ID' ? t.errors.invalid_sale_id : t.errors.fetch_sales);
      toast.error(err.message === 'Invalid sale ID' ? t.errors.invalid_sale_id : t.errors.fetch_sales, {
        position: isRtl ? 'top-right' : 'top-left',
      });
      setSales([]);
      setOrders([]);
    } finally {
      setLoading(false);
      setSalesLoading(false);
    }
  }, [filterStartDate, filterEndDate, user, t, isRtl, language]);

  useEffect(() => {
    fetchData();
    socket.on('saleCreated', (data) => {
      setSales(prev => [data, ...prev]);
      setOrders(prev => [data, ...prev]);
    });
    socket.on('saleDeleted', ({ saleId }) => {
      setSales(prev => prev.filter(sale => sale._id !== saleId));
      setOrders(prev => prev.filter(order => order._id !== saleId));
    });
    return () => {
      socket.off('saleCreated');
      socket.off('saleDeleted');
    };
  }, [fetchData]);

  const loadMoreSales = useCallback(() => {
    setPage(prev => prev + 1);
    fetchData(page + 1, true);
  }, [fetchData, page]);

  const handleEditSale = useCallback((sale) => {
    toast.info(t.editSale, { position: isRtl ? 'top-right' : 'top-left' });
  }, [t, isRtl]);

  const handleDeleteSale = useCallback(async (id) => {
    if (window.confirm(t.confirmDelete)) {
      try {
        await salesAPI.delete(id);
        toast.success(t.deleteSale, { position: isRtl ? 'top-right' : 'top-left' });
      } catch (err) {
        console.error(`[${new Date().toISOString()}] Delete error:`, err);
        setError(t.errors.delete_sale_failed);
        toast.error(t.errors.delete_sale_failed, { position: isRtl ? 'top-right' : 'top-left' });
      }
    }
  }, [t, isRtl]);

  const handleExport = useCallback(() => {
    const csvData = sales.map(sale => ({
      OrderNumber: sale.orderNumber,
      TotalAmount: sale.totalAmount,
      CreatedAt: sale.createdAt,
      PaymentMethod: sale.paymentMethod ? t.paymentMethods[sale.paymentMethod] : 'N/A',
      CustomerName: sale.customerName || 'N/A',
      CustomerPhone: sale.customerPhone || 'N/A',
      Items: sale.items.map(item => `${item.displayName} (${item.quantity} x ${item.unitPrice} ${t.currency})`).join('; '),
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'sales_report.csv';
    link.click();
  }, [sales, t]);

  const filteredSales = useMemo(() => sales.filter(sale => sale.orderNumber.toLowerCase().includes(searchTerm.toLowerCase())), [sales, searchTerm]);

  const chartColors = {
    primary: 'rgba(251, 191, 36, 0.6)',
    primaryBorder: 'rgba(251, 191, 36, 1)',
    secondary: 'rgba(59, 130, 246, 0.6)',
    secondaryBorder: 'rgba(59, 130, 246, 1)',
    accent: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'],
    success: ['#4CAF50', '#66BB6A', '#81C784', '#A5D6A7'],
    danger: ['#EF5350', '#F44336', '#E57373', '#FF8A80'],
  };

  const productSalesChartData = useMemo(() => ({
    labels: [...analytics.productSales.slice(0, 5).map(p => p.displayName), ...analytics.leastProductSales.slice(0, 5).map(p => p.displayName)],
    datasets: [
      {
        label: t.quantity,
        data: [...analytics.productSales.slice(0, 5).map(p => p.totalQuantity), ...analytics.leastProductSales.slice(0, 5).map(p => p.totalQuantity)],
        backgroundColor: [...chartColors.success, ...chartColors.danger],
        borderColor: [...chartColors.success.map(c => c.replace('0.6', '1')), ...chartColors.danger.map(c => c.replace('0.6', '1'))],
        borderWidth: 1,
      },
    ],
  }), [analytics.productSales, analytics.leastProductSales, t]);

  const departmentSalesChartData = useMemo(() => ({
    labels: [...analytics.departmentSales.map(d => d.displayName), ...analytics.leastDepartmentSales.map(d => d.displayName)],
    datasets: [
      {
        label: t.departmentSales,
        data: [...analytics.departmentSales.map(d => d.totalRevenue), ...analytics.leastDepartmentSales.map(d => d.totalRevenue)],
        backgroundColor: [...chartColors.accent, ...chartColors.accent.slice(0, analytics.leastDepartmentSales.length)],
        borderColor: [...chartColors.accent.map(c => c.replace('0.6', '1')), ...chartColors.accent.slice(0, analytics.leastDepartmentSales.length).map(c => c.replace('0.6', '1'))],
        borderWidth: 2,
      },
    ],
  }), [analytics.departmentSales, analytics.leastDepartmentSales, t]);

  const branchSalesChartData = useMemo(() => ({
    labels: [...analytics.branchSales.slice(0, 5).map(b => b.displayName), ...analytics.leastBranchSales.slice(0, 5).map(b => b.displayName)],
    datasets: [
      {
        label: t.branchSales,
        data: [...analytics.branchSales.slice(0, 5).map(b => b.totalSales), ...analytics.leastBranchSales.slice(0, 5).map(b => b.totalSales)],
        backgroundColor: [...chartColors.success, ...chartColors.danger],
        borderColor: [...chartColors.success.map(c => c.replace('0.6', '1')), ...chartColors.danger.map(c => c.replace('0.6', '1'))],
        borderWidth: 1,
      },
    ],
  }), [analytics.branchSales, analytics.leastBranchSales, t]);

  const salesTrendsChartData = useMemo(() => ({
    labels: analytics.salesTrends.map(t => t.period),
    datasets: [
      {
        label: t.salesTrends,
        data: analytics.salesTrends.map(t => t.totalSales),
        fill: true,
        backgroundColor: 'rgba(251, 191, 36, 0.2)',
        borderColor: chartColors.primaryBorder,
        tension: 0.3,
      },
      {
        label: t.totalCount,
        data: analytics.salesTrends.map(t => t.saleCount),
        fill: true,
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: chartColors.secondaryBorder,
        tension: 0.3,
      },
    ],
  }), [analytics.salesTrends, t]);

  const paymentMethodsChartData = useMemo(() => ({
    labels: analytics.paymentMethods.map(pm => pm.paymentMethod),
    datasets: [
      {
        label: t.paymentMethodsLabel,
        data: analytics.paymentMethods.map(pm => pm.totalAmount),
        backgroundColor: chartColors.accent,
        borderColor: chartColors.accent.map(c => c.replace('0.6', '1')),
        borderWidth: 2,
      },
    ],
  }), [analytics.paymentMethods, t]);

  const returnStatsChartData = useMemo(() => ({
    labels: analytics.returnStats.map(rs => rs.status),
    datasets: [
      {
        label: t.returnStats,
        data: analytics.returnStats.map(rs => rs.count),
        backgroundColor: chartColors.accent,
        borderColor: chartColors.accent.map(c => c.replace('0.6', '1')),
        borderWidth: 1,
      },
    ],
  }), [analytics.returnStats, t]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { font: { size: 12 } } },
      title: { display: true, font: { size: 16 } },
      tooltip: { backgroundColor: '#1F2937', bodyFont: { size: 12 }, titleFont: { size: 14 } },
    },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(0, 0, 0, 0.05)' }, title: { display: true, text: t.quantity } },
      x: { grid: { display: false }, title: { display: true, text: t.name } },
    },
    animation: { duration: 1000, easing: 'easeOutQuart' },
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
          <button
            onClick={() => setTabValue(2)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${tabValue === 2 ? 'bg-amber-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            {t.orderTracking}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100">
                <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 text-sm font-medium">{t.noSales}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredSales.map(sale => (
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
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              title={t.totalSales}
              value={`${analytics.totalSales} ${t.currency}`}
              icon="💰"
              color="text-green-500"
            />
            <MetricCard
              title={t.averageOrderValue}
              value={`${analytics.averageOrderValue} ${t.currency}`}
              icon="📊"
              color="text-blue-500"
            />
            <MetricCard
              title={t.topProduct}
              value={analytics.topProduct.displayName}
              icon="🏆"
              color="text-yellow-500"
            />
          </div>
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
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
                <h3 className="text-lg font-semibold text-gray-900">{t.branchSales}</h3>
                <div className="h-80">
                  <Bar
                    data={branchSalesChartData}
                    options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.branchSales } } }}
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
            </div>
          </div>
        </div>
      )}

      {tabValue === 2 && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t.orderTracking}</h2>
          <OrderTrackingTable orders={orders} t={t} isRtl={isRtl} />
        </div>
      )}
    </div>
  );
};

export default React.memo(SalesReport);