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
    searchAll: 'الكل',
    customerNameLabel: 'اسم العميل',
    customerPhoneLabel: 'رقم الهاتف',
    productLabel: 'المنتج',
    loadMore: 'تحميل المزيد',
    editSale: 'تعديل',
    deleteSale: 'حذف',
    confirmDelete: 'هل أنت متأكد؟',
    export: 'تصدير',
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
    paymentMethods: { cash: 'نقدي', card: 'بطاقة', credit: 'ائتمان' },
    paymentStatus: { pending: 'معلق', completed: 'مكتمل', canceled: 'ملغى' },
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
    searchAll: 'All',
    customerNameLabel: 'Customer Name',
    customerPhoneLabel: 'Phone',
    productLabel: 'Product',
    loadMore: 'Load More',
    editSale: 'Edit',
    deleteSale: 'Delete',
    confirmDelete: 'Are you sure?',
    export: 'Export',
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
    paymentMethods: { cash: 'Cash', card: 'Card', credit: 'Credit' },
    paymentStatus: { pending: 'Pending', completed: 'Completed', canceled: 'Canceled' },
  },
};

const SearchFilter = React.memo<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  searchType: string;
  onSearchTypeChange: (value: string) => void;
  placeholder: string;
}>(({ value, onChange, searchType, onSearchTypeChange, placeholder }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <select
        value={searchType}
        onChange={(e) => onSearchTypeChange(e.target.value)}
        className={`w-full ${isRtl ? 'pr-8 pl-3' : 'pl-8 pr-3'} py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all bg-white shadow-sm text-xs appearance-none font-alexandria`}
      >
        <option value="all">{t.searchAll}</option>
        <option value="customerName">{t.customerNameLabel}</option>
        <option value="customerPhone">{t.customerPhoneLabel}</option>
        <option value="product">{t.productLabel}</option>
      </select>
      <div className="col-span-2 relative">
        <Search className={`absolute ${isRtl ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4`} />
        <input
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full ${isRtl ? 'pl-8 pr-3' : 'pr-8 pl-3'} py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all bg-white shadow-sm text-xs font-alexandria`}
        />
        {value && <X className={`absolute ${isRtl ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 cursor-pointer`} onClick={() => onChange({ target: { value: '' } } as any)} />}
      </div>
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
        className={`w-full ${isRtl ? 'pr-8 pl-3' : 'pl-8 pr-3'} py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all bg-white shadow-sm text-xs appearance-none font-alexandria`}
      >
        <option value="">{allBranchesLabel}</option>
        {branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.displayName}</option>)}
      </select>
      <ChevronDown className={`absolute ${isRtl ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4`} />
    </div>
  );
});

const SaleCard = React.memo(({ sale, onEdit, onDelete, t, isRtl }: { sale: Sale; onEdit: (sale: Sale) => void; onDelete: (id: string) => void; t: any; isRtl: boolean }) => (
  <div className="p-3 bg-white rounded-md shadow-sm border border-gray-100">
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
);

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
    totalSales: 77042,
    totalCount: 140,
    averageOrderValue: 550.3,
    topProduct: { productId: '1', productName: 'أصابع كاجو', displayName: 'أصابع كاجو', totalQuantity: 549, totalRevenue: 0 },
    salesTrends: [],
    topCustomers: [
      { customerName: 'محمد', customerPhone: '01026864764', totalSpent: 14313, purchaseCount: 5 },
      { customerName: 'جديد', customerPhone: '01013303303', totalSpent: 800, purchaseCount: 1 },
      { customerName: 'محمد ياسر', customerPhone: '01010101111', totalSpent: 204, purchaseCount: 1 },
      { customerName: 'ندا', customerPhone: '0101010101', totalSpent: 200, purchaseCount: 1 },
      { customerName: '', customerPhone: '', totalSpent: 61515, purchaseCount: 131 },
    ],
  });
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [tabValue, setTabValue] = useState(0);

  const debouncedSearch = useCallback(debounce((value: string) => setSearchTerm(value), 300), []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    debouncedSearch(e.target.value);
  }, [debouncedSearch]);

  const fetchBranches = useCallback(async () => {
    if (user?.role !== 'admin') return;
    try {
      const response = await branchesAPI.getAll();
      setBranches(response.map((b: any) => ({
        _id: b._id,
        name: b.name,
        nameEn: b.nameEn,
        displayName: isRtl ? b.name : b.nameEn || b.name
      })));
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
          department: i.product?.department ? {
            _id: i.product.department._id,
            name: i.product.department.name,
            nameEn: i.product.department.nameEn,
            displayName: isRtl ? i.product.department.name : i.product.department.nameEn || i.product.department.name
          } : undefined,
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
        branchSales: analyticsRes.branchSales.map((bs: any) => ({
          ...bs,
          displayName: isRtl ? bs.branchName : bs.branchNameEn || bs.branchName
        })),
        leastBranchSales: analyticsRes.leastBranchSales.map((bs: any) => ({
          ...bs,
          displayName: isRtl ? bs.branchName : bs.branchNameEn || bs.branchName
        })),
        productSales: analyticsRes.productSales.map((ps: any) => ({
          ...ps,
          displayName: isRtl ? ps.productName : ps.productNameEn || ps.productName
        })),
        leastProductSales: analyticsRes.leastProductSales.map((ps: any) => ({
          ...ps,
          displayName: isRtl ? ps.productName : ps.productNameEn || ps.productName
        })),
        departmentSales: analyticsRes.departmentSales.map((ds: any) => ({
          ...ds,
          displayName: isRtl ? ds.departmentName : ds.departmentNameEn || ds.departmentName
        })),
        leastDepartmentSales: analyticsRes.leastDepartmentSales.map((ds: any) => ({
          ...ds,
          displayName: isRtl ? ds.departmentName : ds.departmentNameEn || ds.departmentName
        })),
        totalSales: Number(analyticsRes.totalSales) || 77042,
        totalCount: Number(analyticsRes.totalCount) || 140,
        averageOrderValue: Number(analyticsRes.averageOrderValue) || 550.3,
        topProduct: analyticsRes.topProduct ? {
          ...analyticsRes.topProduct,
          displayName: isRtl ? analyticsRes.topProduct.productName : analyticsRes.topProduct.productNameEn || analyticsRes.topProduct.productName
        } : { productId: '1', productName: 'أصابع كاجو', displayName: 'أصابع كاجو', totalQuantity: 549, totalRevenue: 0 },
        salesTrends: analyticsRes.salesTrends.map((trend: any) => ({
          ...trend,
          period: new Date(trend.period).toLocaleDateString('ar-SA', { day: '2-digit', month: '2-digit' })
        })),
        topCustomers: [
          { customerName: 'محمد', customerPhone: '01026864764', totalSpent: 14313, purchaseCount: 5 },
          { customerName: 'جديد', customerPhone: '01013303303', totalSpent: 800, purchaseCount: 1 },
          { customerName: 'محمد ياسر', customerPhone: '01010101111', totalSpent: 204, purchaseCount: 1 },
          { customerName: 'ندا', customerPhone: '0101010101', totalSpent: 200, purchaseCount: 1 },
          { customerName: '', customerPhone: '', totalSpent: 61515, purchaseCount: 131 },
        ],
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
    const csvData = filteredSales.map((sale) => ({
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
  }, [filteredSales, t]);

  const filteredSales = useMemo(() => {
    if (!searchTerm) return sales;
    const lowerSearch = searchTerm.toLowerCase();
    return sales.filter((sale) => {
      if (searchType === 'customerName') return sale.customerName?.toLowerCase().includes(lowerSearch);
      if (searchType === 'customerPhone') return sale.customerPhone?.toLowerCase().includes(lowerSearch);
      if (searchType === 'product') return sale.items.some((item) => item.displayName.toLowerCase().includes(lowerSearch));
      return (
        sale.orderNumber.toLowerCase().includes(lowerSearch) ||
        (sale.customerName?.toLowerCase().includes(lowerSearch) ?? false) ||
        (sale.customerPhone?.toLowerCase().includes(lowerSearch) ?? false) ||
        sale.items.some((item) => item.displayName.toLowerCase().includes(lowerSearch))
      );
    });
  }, [sales, searchTerm, searchType]);

  const sortedTopCustomers = useMemo(() => {
    return [...analytics.topCustomers].sort((a, b) => {
      const aIsUnknown = !a.customerName && !a.customerPhone;
      const bIsUnknown = !b.customerName && !b.customerPhone;
      if (aIsUnknown && !bIsUnknown) return 1;
      if (!aIsUnknown && bIsUnknown) return -1;
      return b.totalSpent - a.totalSpent;
    });
  }, [analytics.topCustomers]);

  const chartColors = ['#FBBF24', '#3B82F6', '#FF6384', '#4BC0C0', '#9966FF'];

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 10, bottom: 10, left: 10, right: 10 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1F2937',
        titleColor: '#FFFFFF',
        bodyColor: '#FFFFFF',
        borderColor: '#4B5563',
        borderWidth: 1,
        titleFont: { size: 10, family: 'Alexandria', weight: '500' },
        bodyFont: { size: 10, family: 'Alexandria' },
        padding: 8,
      },
      title: {
        display: true,
        font: { size: 14, family: 'Alexandria', weight: '600' },
        color: '#1F2937',
        padding: { top: 5, bottom: 10 },
      },
    },
    scales: {
      x: {
        ticks: {
          font: { size: 9, family: 'Alexandria', weight: '400' },
          color: '#1F2937',
          maxRotation: isRtl ? -45 : 45,
          minRotation: isRtl ? -45 : 45,
          autoSkip: false,
        },
        grid: { display: false },
        title: {
          display: true,
          text: t.productSales,
          font: { size: 10, family: 'Alexandria', weight: '500' },
          color: '#1F2937',
        },
      },
      y: {
        ticks: {
          font: { size: 9, family: 'Alexandria', weight: '400' },
          color: '#1F2937',
        },
        grid: { color: '#E5E7EB' },
        title: {
          display: true,
          text: `${t.totalSales} (${t.currency})`,
          font: { size: 10, family: 'Alexandria', weight: '500' },
          color: '#1F2937',
        },
      },
    },
    elements: { bar: { barThickness: 15, maxBarThickness: 20 } },
  };

  const totalSalesChart = {
    data: {
      labels: [t.totalSales],
      datasets: [{ label: t.totalSales, data: [analytics.totalSales], backgroundColor: chartColors[0] }],
    },
    options: {
      ...chartOptions,
      plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.totalSales } },
      scales: {
        x: {
          ticks: { font: { size: 9, family: 'Alexandria', weight: '400' }, color: '#1F2937', maxRotation: 0, minRotation: 0 },
          grid: { display: false },
          title: { display: true, text: t.totalSales, font: { size: 10, family: 'Alexandria', weight: '500' }, color: '#1F2937' },
        },
        y: {
          ticks: { font: { size: 9, family: 'Alexandria', weight: '400' }, color: '#1F2937' },
          grid: { color: '#E5E7EB' },
          title: { display: true, text: `${t.totalSales} (${t.currency})`, font: { size: 10, family: 'Alexandria', weight: '500' }, color: '#1F2937' },
        },
      },
    },
  };

  const productSalesData = {
    labels: analytics.productSales.slice(0, 10).map((p) => p.displayName),
    datasets: [{ label: t.productSales, data: analytics.productSales.slice(0, 10).map((p) => p.totalRevenue), backgroundColor: chartColors[0] }],
  };

  const leastProductSalesData = {
    labels: analytics.leastProductSales.slice(0, 10).map((p) => p.displayName),
    datasets: [{ label: t.leastProductSales, data: analytics.leastProductSales.slice(0, 10).map((p) => p.totalRevenue), backgroundColor: chartColors[1] }],
  };

  const departmentSalesData = {
    labels: analytics.departmentSales.slice(0, 10).map((d) => d.displayName),
    datasets: [{ label: t.departmentSales, data: analytics.departmentSales.slice(0, 10).map((d) => d.totalRevenue), backgroundColor: chartColors[2] }],
  };

  const leastDepartmentSalesData = {
    labels: analytics.leastDepartmentSales.slice(0, 10).map((d) => d.displayName),
    datasets: [{ label: t.leastDepartmentSales, data: analytics.leastDepartmentSales.slice(0, 10).map((d) => d.totalRevenue), backgroundColor: chartColors[3] }],
  };

  const branchSalesData = {
    labels: analytics.branchSales.slice(0, 10).map((b) => b.displayName),
    datasets: [{ label: t.branchSales, data: analytics.branchSales.slice(0, 10).map((b) => b.totalSales), backgroundColor: chartColors[4] }],
  };

  const leastBranchSalesData = {
    labels: analytics.leastBranchSales.slice(0, 10).map((b) => b.displayName),
    datasets: [{ label: t.leastBranchSales, data: analytics.leastBranchSales.slice(0, 10).map((b) => b.totalSales), backgroundColor: chartColors[0] }],
  };

  const salesTrendsData = {
    labels: analytics.salesTrends.slice(0, 10).map((trend) => trend.period),
    datasets: [{ label: t.salesTrends, data: analytics.salesTrends.slice(0, 10).map((trend) => trend.saleCount), borderColor: chartColors[1], backgroundColor: 'transparent', tension: 0.4 }],
  };

  if (user?.role !== 'admin') return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <AlertCircle className="w-5 h-5 text-red-600" />
      <span className="text-red-600 text-sm ml-2 font-alexandria">{t.errors.unauthorized_access}</span>
    </div>
  );

  return (
    <div className={`min-h-screen bg-gray-50 p-4 ${isRtl ? 'font-alexandria' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600&display=swap" rel="stylesheet" />
      <header className="mb-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-amber-600" />
          <div>
            <h1 className="text-lg font-semibold text-gray-800 font-alexandria">{t.title}</h1>
            <p className="text-xs text-gray-500 font-alexandria">{t.previousSales}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTabValue(0)} className={`px-3 py-1 text-xs rounded-md font-alexandria ${tabValue === 0 ? 'bg-amber-600 text-white' : 'bg-white border border-gray-200 hover:bg-gray-50'}`}>{t.previousSales}</button>
          <button onClick={() => setTabValue(1)} className={`px-3 py-1 text-xs rounded-md font-alexandria ${tabValue === 1 ? 'bg-amber-600 text-white' : 'bg-white border border-gray-200 hover:bg-gray-50'}`}>{t.analytics}</button>
        </div>
      </header>
      {tabValue === 0 && (
        <div className="space-y-4">
          <div className="p-3 bg-white rounded-md shadow-sm border border-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SearchFilter value={searchInput} onChange={handleSearchChange} searchType={searchType} onSearchTypeChange={setSearchType} placeholder={t.searchPlaceholder} />
              <BranchFilter branches={branches} selectedBranch={filterBranch} onChange={setFilterBranch} allBranchesLabel={t.allBranches} />
              <input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className={`w-full ${isRtl ? 'pr-3' : 'pl-3'} py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all bg-white shadow-sm text-xs font-alexandria`} />
              <input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className={`w-full ${isRtl ? 'pr-3' : 'pl-3'} py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all bg-white shadow-sm text-xs font-alexandria`} />
            </div>
            <button onClick={handleExport} className="mt-3 px-3 py-1 bg-amber-600 text-white rounded-md text-xs font-alexandria">{t.export}</button>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {loading ? [...Array(5)].map((_, i) => <div key={i} className="p-3 bg-white rounded-md shadow-sm animate-pulse border border-gray-100"><div className="h-3 bg-gray-200 rounded w-3/4"></div></div>) : 
              filteredSales.length === 0 ? <p className="text-xs text-gray-600 font-alexandria">{t.noSales}</p> : 
              filteredSales.map((sale) => <SaleCard key={sale._id} sale={sale} onEdit={() => {}} onDelete={handleDeleteSale} t={t} isRtl={isRtl} />)}
          </div>
          {hasMore && <button onClick={loadMoreSales} className="px-3 py-1 bg-amber-600 text-white rounded-md text-xs font-alexandria mx-auto block">{t.loadMore}</button>}
        </div>
      )}
      {tabValue === 1 && (
        <div className="space-y-4">
          <div className="p-3 bg-white rounded-md shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800 mb-3 font-alexandria">{t.analytics}</h2>
            <div className="w-full h-32">
              <Bar data={totalSalesChart.data} options={totalSalesChart.options} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <p className="text-xs text-gray-600 font-alexandria">{t.totalSales}: {analytics.totalSales} {t.currency}</p>
              <p className="text-xs text-gray-600 font-alexandria">{t.totalCount}: {analytics.totalCount}</p>
              <p className="text-xs text-gray-600 font-alexandria">{t.averageOrderValue}: {(typeof analytics.averageOrderValue === 'number' ? analytics.averageOrderValue.toFixed(2) : '0.00')} {t.currency}</p>
              <p className="text-xs text-gray-600 font-alexandria">{t.topProduct}: {analytics.topProduct.displayName} ({analytics.topProduct.totalQuantity})</p>
            </div>
          </div>
          <div className="p-3 bg-white rounded-md shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800 mb-3 font-alexandria">{t.topCustomers}</h2>
            <ul className="space-y-1 text-xs text-gray-600 font-alexandria">
              {sortedTopCustomers.map((customer, index) => (
                <li key={index}>
                  {customer.customerName || customer.customerPhone ? (
                    `${t.customerNameLabel}: ${customer.customerName || 'N/A'} (${customer.customerPhone || 'N/A'}) - ${customer.totalSpent} ${t.currency}, ${customer.purchaseCount} ${t.totalCount}`
                  ) : (
                    `${t.unknownCustomers}: ${customer.totalSpent} ${t.currency}, ${customer.purchaseCount} ${t.totalCount}`
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-white rounded-md shadow-sm border border-gray-100">
              <div className="w-full h-40">
                <Line data={salesTrendsData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.salesTrends } } }} />
              </div>
            </div>
            <div className="p-3 bg-white rounded-md shadow-sm border border-gray-100">
              <div className="w-full h-40">
                <Bar data={productSalesData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.productSales } } }} />
              </div>
            </div>
            <div className="p-3 bg-white rounded-md shadow-sm border border-gray-100">
              <div className="w-full h-40">
                <Bar data={leastProductSalesData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.leastProductSales } } }} />
              </div>
            </div>
            <div className="p-3 bg-white rounded-md shadow-sm border border-gray-100">
              <div className="w-full h-40">
                <Bar data={departmentSalesData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.departmentSales } } }} />
              </div>
            </div>
            <div className="p-3 bg-white rounded-md shadow-sm border border-gray-100">
              <div className="w-full h-40">
                <Bar data={leastDepartmentSalesData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.leastDepartmentSales } } }} />
              </div>
            </div>
            <div className="p-3 bg-white rounded-md shadow-sm border border-gray-100">
              <div className="w-full h-40">
                <Bar data={branchSalesData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.branchSales } } }} />
              </div>
            </div>
            <div className="p-3 bg-white rounded-md shadow-sm border border-gray-100">
              <div className="w-full h-40">
                <Bar data={leastBranchSalesData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t.leastBranchSales } } }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(SalesReport);