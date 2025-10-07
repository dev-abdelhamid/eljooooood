import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import salesAPI from '../services/salesAPI';
import { branchesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, DollarSign, Search, X, ChevronDown, Edit, Trash } from 'lucide-react';
import { toast } from 'react-toastify';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend } from 'chart.js';
import { debounce } from 'lodash';
import Papa from 'papaparse';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

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
    searchPlaceholder: 'ابحث...',
    loadMore: 'تحميل المزيد',
    editSale: 'تعديل',
    deleteSale: 'حذف',
    confirmDelete: 'هل أنت متأكد؟',
    export: 'تصدير',
    customerNameLabel: 'اسم العميل',
    customerPhoneLabel: 'رقم الهاتف',
    errors: {
      unauthorized_access: 'غير مصرح',
      fetch_sales: 'خطأ في جلب المبيعات',
      fetch_branches: 'خطأ في جلب الفروع',
      delete_sale_failed: 'فشل الحذف',
      update_sale_failed: 'فشل التعديل',
      invalid_sale_id: 'معرف غير صالح',
      deleted_product: 'منتج محذوف',
      departments: { unknown: 'غير معروف' },
    },
    currency: 'ريال',
    units: { default: 'غير محدد' },
    paymentMethods: {
      cash: 'نقدي',
      card: 'بطاقة',
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
    totalCount: 'Sale Count',
    averageOrderValue: 'Avg Order Value',
    topProduct: 'Top Product',
    salesTrends: 'Sales Trends',
    topCustomers: 'Top Customers',
    unknownCustomers: 'Unknown Customers',
    noSales: 'No sales',
    date: 'Date',
    quantity: 'Qty',
    branchFilter: 'Select Branch',
    allBranches: 'All Branches',
    searchPlaceholder: 'Search...',
    loadMore: 'Load More',
    editSale: 'Edit',
    deleteSale: 'Delete',
    confirmDelete: 'Are you sure?',
    export: 'Export',
    customerNameLabel: 'Customer Name',
    customerPhoneLabel: 'Phone',
    errors: {
      unauthorized_access: 'Unauthorized',
      fetch_sales: 'Error fetching sales',
      fetch_branches: 'Error fetching branches',
      delete_sale_failed: 'Delete failed',
      update_sale_failed: 'Update failed',
      invalid_sale_id: 'Invalid ID',
      deleted_product: 'Deleted Product',
      departments: { unknown: 'Unknown' },
    },
    currency: 'SAR',
    units: { default: 'N/A' },
    paymentMethods: {
      cash: 'Cash',
      card: 'Card',
      credit: 'Credit',
    },
    paymentStatus: {
      pending: 'Pending',
      completed: 'Completed',
      canceled: 'Canceled',
    },
  },
};

const SearchInput = React.memo(({ value, onChange, placeholder }: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder: string }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="relative">
      <Search className={`absolute ${isRtl ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4`} />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full ${isRtl ? 'pl-8 pr-3' : 'pr-8 pl-3'} py-1.5 border border-gray-200 rounded-md focus:ring-amber-500 text-xs placeholder-gray-400 font-alexandria`}
      />
      {value && <X className={`absolute ${isRtl ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 cursor-pointer`} onClick={() => onChange({ target: { value: '' } } as any)} />}
    </div>
  );
});

const BranchFilter = React.memo(({ branches, selectedBranch, onChange, allBranchesLabel }: { branches: Branch[]; selectedBranch: string; onChange: (value: string) => void; allBranchesLabel: string }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="relative">
      <select
        value={selectedBranch}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full ${isRtl ? 'pr-8 pl-3' : 'pl-8 pr-3'} py-1.5 border border-gray-200 rounded-md focus:ring-amber-500 text-xs appearance-none font-alexandria`}
      >
        <option value="">{allBranchesLabel}</option>
        {branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.displayName}</option>)}
      </select>
      <ChevronDown className={`absolute ${isRtl ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4`} />
    </div>
  );
});

const SaleCard = React.memo(({ sale, onEdit, onDelete, t, isRtl }: { sale: Sale; onEdit: (sale: Sale) => void; onDelete: (id: string) => void; t: any; isRtl: boolean }) => (
  <div className="p-3 bg-white rounded-md shadow border border-gray-100">
    <div className="flex flex-col space-y-2">
      <h3 className="font-semibold text-sm text-gray-800">{sale.orderNumber}</h3>
      <p className="text-xs text-gray-500">{t.date}: {sale.createdAt}</p>
      <p className="text-xs text-gray-500">{sale.branch.displayName}</p>
      <p className="text-xs text-gray-500">{sale.totalAmount} {t.currency}</p>
      {sale.customerName && <p className="text-xs text-gray-500">{t.customerNameLabel}: {sale.customerName}</p>}
      {sale.customerPhone && <p className="text-xs text-gray-500">{t.customerPhoneLabel}: {sale.customerPhone}</p>}
      <ul className="space-y-1 text-xs text-gray-600">
        {sale.items.map((item, idx) => (
          <li key={idx}>{item.displayName} - {item.quantity} {item.displayUnit}, {item.unitPrice} {t.currency}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Edit className="w-4 h-4 text-blue-500 cursor-pointer" onClick={() => onEdit(sale)} />
        <Trash className="w-4 h-4 text-red-500 cursor-pointer" onClick={() => onDelete(sale._id)} />
      </div>
    </div>
  </div>
));

export const SalesReport: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
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
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [tabValue, setTabValue] = useState(0);

  const debouncedSearch = useCallback(debounce((value: string) => setSearchTerm(value.trim().toLowerCase()), 300), []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    debouncedSearch(e.target.value);
  };

  const fetchBranches = useCallback(async () => {
    if (user?.role !== 'admin') return;
    try {
      const response = await branchesAPI.getAll();
      setBranches(response.map((b: any) => ({ _id: b._id, name: b.name, nameEn: b.nameEn, displayName: isRtl ? b.name : b.nameEn || b.name })));
    } catch (err) {
      toast.error(t.errors.fetch_branches);
    }
  }, [user, isRtl, t]);

  const fetchData = useCallback(async (pageNum = 1, append = false) => {
    if (user?.role !== 'admin') return;
    setLoading(pageNum === 1);
    try {
      const salesParams = { page: pageNum, limit: 20, sort: '-createdAt', branch: filterBranch, startDate: filterStartDate, endDate: filterEndDate };
      const analyticsParams = { branch: filterBranch, startDate: filterStartDate, endDate: filterEndDate };
      const [salesRes, analyticsRes] = await Promise.all([salesAPI.getAll(salesParams), salesAPI.getAnalytics(analyticsParams)]);
      const newSales = salesRes.sales.map((s: any) => ({
        _id: s._id,
        orderNumber: s.orderNumber || 'N/A',
        branch: { _id: s.branch._id, name: s.branch.name, nameEn: s.branch.nameEn, displayName: isRtl ? s.branch.name : s.branch.nameEn || s.branch.name },
        items: s.items.map((i: any) => ({
          product: i.product?._id,
          productName: i.product?.name,
          productNameEn: i.product?.nameEn,
          unit: i.product?.unit,
          unitEn: i.product?.unitEn,
          displayName: isRtl ? i.product?.name : i.product?.nameEn || i.product?.name,
          displayUnit: isRtl ? i.product?.unit : i.product?.unitEn || i.product?.unit,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          department: i.product?.department ? { _id: i.product.department._id, name: i.product.department.name, nameEn: i.product.department.nameEn, displayName: isRtl ? i.product.department.name : i.product.department.nameEn || i.product.department.name } : undefined,
        })),
        totalAmount: s.totalAmount,
        createdAt: formatDate(s.createdAt, language),
        notes: s.notes,
        paymentMethod: s.paymentMethod,
        customerName: s.customerName,
        customerPhone: s.customerPhone,
      }));
      setSales(append ? (prev) => [...prev, ...newSales] : newSales);
      setHasMore(salesRes.total > pageNum * 20);
      setAnalytics({
        branchSales: analyticsRes.branchSales.map((bs: any) => ({ ...bs, displayName: isRtl ? bs.branchName : bs.branchNameEn || bs.branchName })),
        leastBranchSales: analyticsRes.leastBranchSales.map((bs: any) => ({ ...bs, displayName: isRtl ? bs.branchName : bs.branchNameEn || bs.branchName })),
        productSales: analyticsRes.productSales.map((ps: any) => ({ ...ps, displayName: isRtl ? ps.productName : ps.productNameEn || ps.productName })),
        leastProductSales: analyticsRes.leastProductSales.map((ps: any) => ({ ...ps, displayName: isRtl ? ps.productName : ps.productNameEn || ps.productName })),
        departmentSales: analyticsRes.departmentSales.map((ds: any) => ({ ...ds, displayName: isRtl ? ds.departmentName : ds.departmentNameEn || ds.departmentName })),
        leastDepartmentSales: analyticsRes.leastDepartmentSales.map((ds: any) => ({ ...ds, displayName: isRtl ? ds.departmentName : ds.departmentNameEn || ds.departmentName })),
        totalSales: Number(analyticsRes.totalSales) || 0,
        totalCount: Number(analyticsRes.totalCount) || 0,
        averageOrderValue: Number(analyticsRes.averageOrderValue) || 0,
        topProduct: analyticsRes.topProduct ? { ...analyticsRes.topProduct, displayName: isRtl ? analyticsRes.topProduct.productName : analyticsRes.topProduct.productNameEn || analyticsRes.topProduct.productName } : { productId: null, productName: '', displayName: '', totalQuantity: 0, totalRevenue: 0 },
        salesTrends: analyticsRes.salesTrends.map((trend: any) => ({ ...trend, period: new Date(trend.period).toLocaleDateString('ar-SA', { day: '2-digit', month: '2-digit' }) })),
        topCustomers: analyticsRes.topCustomers || [],
      });
    } catch (err) {
      toast.error(t.errors.fetch_sales);
    } finally {
      setLoading(false);
    }
  }, [user, t, isRtl, language, filterBranch, filterStartDate, filterEndDate]);

  useEffect(() => {
    fetchBranches();
    fetchData();
  }, [fetchBranches, fetchData]);

  useEffect(() => {
    if (!socket || !isConnected) return;
    socket.on('saleCreated', () => fetchData());
    socket.on('saleDeleted', () => fetchData());
    return () => {
      socket.off('saleCreated');
      socket.off('saleDeleted');
    };
  }, [socket, isConnected, fetchData]);

  const loadMoreSales = useCallback(() => {
    setPage((prev) => prev + 1);
    fetchData(page + 1, true);
  }, [fetchData, page]);

  const handleDeleteSale = useCallback(async (id: string) => {
    if (window.confirm(t.confirmDelete)) {
      try {
        await salesAPI.delete(id);
        toast.success(t.deleteSale);
        fetchData();
      } catch (err) {
        toast.error(t.errors.delete_sale_failed);
      }
    }
  }, [t, fetchData]);

  const handleExport = useCallback(() => {
    const csvData = sales.map((sale) => ({
      OrderNumber: sale.orderNumber,
      Branch: sale.branch.displayName,
      TotalAmount: sale.totalAmount,
      CreatedAt: sale.createdAt,
      CustomerName: sale.customerName || 'N/A',
      CustomerPhone: sale.customerPhone || 'N/A',
      Items: sale.items.map((item) => `${item.displayName} (${item.quantity} x ${item.unitPrice})`).join('; '),
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'sales.csv';
    link.click();
  }, [sales, t]);

  const filteredSales = useMemo(() => sales.filter((sale) => 
    sale.orderNumber.toLowerCase().includes(searchTerm) ||
    (sale.customerName?.toLowerCase().includes(searchTerm)) ||
    (sale.customerPhone?.toLowerCase().includes(searchTerm)) ||
    sale.items.some((item) => item.displayName.toLowerCase().includes(searchTerm))
  ), [sales, searchTerm]);

  const sortedTopCustomers = useMemo(() => [...analytics.topCustomers].sort((a, b) => {
    const aUnknown = !a.customerName && !a.customerPhone;
    const bUnknown = !b.customerName && !b.customerPhone;
    return aUnknown ? 1 : bUnknown ? -1 : b.totalSpent - a.totalSpent;
  }), [analytics.topCustomers]);

  const chartColors = ['#FBBF24', '#3B82F6', '#FF6384', '#4BC0C0', '#9966FF'];

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { font: { size: 10 } } },
      tooltip: { titleFont: { size: 10 }, bodyFont: { size: 10 } },
      title: { display: true, font: { size: 14 } },
    },
    scales: {
      x: { ticks: { font: { size: 9 }, maxRotation: 45 }, title: { display: true, font: { size: 10 } } },
      y: { ticks: { font: { size: 9 } }, title: { display: true, font: { size: 10 } } },
    },
    elements: { bar: { barThickness: 15 } },
  };

  const productSalesData = {
    labels: analytics.productSales.slice(0, 5).map((p) => p.displayName),
    datasets: [{ label: t.totalSales, data: analytics.productSales.slice(0, 5).map((p) => p.totalRevenue), backgroundColor: chartColors[0] }],
  };

  // Similar data definitions for other charts, shortened for brevity

  const totalSalesData = {
    labels: [t.totalSales],
    datasets: [{ label: t.totalSales, data: [analytics.totalSales], backgroundColor: chartColors[0] }],
  };

  if (user?.role !== 'admin') return <div className="flex items-center justify-center h-screen bg-gray-50"><AlertCircle className="w-6 h-6 text-red-600" /> <span className="text-red-600 text-sm ml-2">{t.errors.unauthorized_access}</span></div>;

  return (
    <div className={`min-h-screen bg-gray-50 p-4 ${isRtl ? 'font-alexandria' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <header className="mb-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-amber-600" />
          <h1 className="text-lg font-semibold text-gray-800">{t.title}</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTabValue(0)} className={`px-3 py-1 text-xs rounded-md ${tabValue === 0 ? 'bg-amber-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>{t.previousSales}</button>
          <button onClick={() => setTabValue(1)} className={`px-3 py-1 text-xs rounded-md ${tabValue === 1 ? 'bg-amber-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>{t.analytics}</button>
        </div>
      </header>
      {tabValue === 0 && (
        <div className="space-y-4">
          <div className="p-3 bg-white rounded-md shadow border">
            <div className="grid grid-cols-2 gap-3">
              <SearchInput value={searchInput} onChange={handleSearchChange} placeholder={t.searchPlaceholder} />
              <input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="py-1.5 border rounded-md text-xs font-alexandria" />
              <input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="py-1.5 border rounded-md text-xs font-alexandria" />
              <BranchFilter branches={branches} selectedBranch={filterBranch} onChange={setFilterBranch} allBranchesLabel={t.allBranches} />
            </div>
            <button onClick={handleExport} className="mt-3 px-3 py-1 bg-amber-600 text-white rounded-md text-xs">{t.export}</button>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {loading ? [...Array(5)].map((_, i) => <div key={i} className="p-3 bg-white rounded-md shadow animate-pulse"><div className="h-3 bg-gray-200 rounded w-3/4"></div></div>) : filteredSales.map((sale) => <SaleCard key={sale._id} sale={sale} onEdit={() => {}} onDelete={handleDeleteSale} t={t} isRtl={isRtl} />)}
          </div>
          {hasMore && <button onClick={loadMoreSales} className="px-3 py-1 bg-amber-600 text-white rounded-md text-xs mx-auto block">{t.loadMore}</button>}
        </div>
      )}
      {tabValue === 1 && (
        <div className="p-3 bg-white rounded-md shadow border space-y-4">
          <div className="h-40"><Bar data={totalSalesData} options={{ ...chartOptions, plugins: { title: { text: t.totalSales } } }} /></div>
          <div className="h-40"><Line data={salesTrendsData} options={{ ...chartOptions, plugins: { title: { text: t.salesTrends } } }} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="h-40"><Bar data={productSalesData} options={{ ...chartOptions, plugins: { title: { text: t.productSales } } }} /></div>
            {/* Add other charts similarly, shortened */}
          </div>
          <div className="p-3 bg-gray-50 rounded-md space-y-1 text-xs">
            <p>{t.totalSales}: {analytics.totalSales} {t.currency}</p>
            <p>{t.totalCount}: {analytics.totalCount}</p>
            <p>{t.averageOrderValue}: {(typeof analytics.averageOrderValue === 'number' ? analytics.averageOrderValue.toFixed(2) : '0')} {t.currency}</p>
            <p>{t.topProduct}: {analytics.topProduct.displayName} ({analytics.topProduct.totalQuantity})</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-md space-y-1 text-xs">
            <h3>{t.topCustomers}</h3>
            <ul>
              {sortedTopCustomers.map((c, i) => <li key={i}>{c.customerName || c.customerPhone || t.errors.departments.unknown} - {c.totalSpent} {t.currency}, {c.purchaseCount}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(SalesReport);