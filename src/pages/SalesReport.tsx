import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { branchesAPI, salesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, DollarSign, Search, ChevronDown, Trash, Download } from 'lucide-react';
import { toast } from 'react-toastify';
import { Bar, Pie, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { debounce } from 'lodash';
import Papa from 'papaparse';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, ArcElement, Title, Tooltip, Legend);

interface Sale {
  _id: string;
  orderNumber: string;
  branch: { _id: string; displayName: string };
  items: Array<{ displayName: string; quantity: number; unitPrice: number; displayUnit: string }>;
  totalAmount: number;
  createdAt: string;
  paymentMethod?: string;
  customerName?: string;
  customerPhone?: string;
}

interface Branch {
  _id: string;
  displayName: string;
}

interface SalesAnalytics {
  branchSales: Array<{ branchId: string; displayName: string; totalSales: number; saleCount: number }>;
  productSales: Array<{ displayName: string; totalQuantity: number; totalRevenue: number }>;
  departmentSales: Array<{ displayName: string; totalRevenue: number; totalQuantity: number }>;
  totalSales: number;
  totalCount: number;
  topProduct: { displayName: string; totalQuantity: number };
  salesTrends: Array<{ period: string; totalSales: number }>;
  paymentMethods: Array<{ paymentMethod: string; totalAmount: number }>;
}

const translations = {
  ar: {
    title: 'تقرير المبيعات',
    salesTab: 'المبيعات',
    analyticsTab: 'الإحصائيات',
    filters: 'الفلاتر',
    searchPlaceholder: 'ابحث عن المبيعات...',
    exportCSV: 'تصدير CSV',
    branch: 'الفرع',
    allBranches: 'كل الفروع',
    noSales: 'لا توجد مبيعات',
    totalSales: 'إجمالي المبيعات',
    totalCount: 'عدد المبيعات',
    branchSales: 'مبيعات الفروع',
    productSales: 'مبيعات المنتجات',
    departmentSales: 'مبيعات الأقسام',
    salesTrends: 'اتجاهات المبيعات',
    paymentMethodsLabel: 'طرق الدفع',
    errors: {
      unauthorized_access: 'غير مصرح لك',
      fetch_sales: 'خطأ أثناء جلب المبيعات',
      delete_sale_failed: 'فشل حذف المبيعة',
    },
    currency: 'ريال',
    paymentMethods: { cash: 'نقدي', credit_card: 'بطاقة', bank_transfer: 'تحويل' },
  },
};

const Dropdown = React.memo<{ value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }>(
  ({ value, onChange, options }) => {
    const { language } = useLanguage();
    const isRtl = language === 'ar';
    const [isOpen, setIsOpen] = useState(false);
    const selected = options.find(opt => opt.value === value) || options[0] || { value: '', label: 'اختر' };
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-sm flex justify-between items-center ${isRtl ? 'text-right' : 'text-left'}`}
        >
          <span>{selected.label}</span>
          <ChevronDown className={`${isOpen ? 'rotate-180' : ''} w-4 h-4`} />
        </button>
        {isOpen && (
          <div className="absolute w-full mt-1 bg-white rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
            {options.map(opt => (
              <div
                key={opt.value}
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                className="px-4 py-2 text-sm hover:bg-amber-50 cursor-pointer"
              >
                {opt.label}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);

const SalesReport: React.FC = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const [activeTab, setActiveTab] = useState<'sales' | 'analytics'>('sales');
  const [sales, setSales] = useState<Sale[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [analytics, setAnalytics] = useState<SalesAnalytics>({
    branchSales: [], productSales: [], departmentSales: [], totalSales: 0, totalCount: 0,
    topProduct: { displayName: '', totalQuantity: 0 }, salesTrends: [], paymentMethods: []
  });
  const [filterBranch, setFilterBranch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useCallback(debounce((value: string) => setSearchTerm(value.trim()), 300), []);

  const fetchData = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    if (user?.role !== 'admin') {
      setError(t.errors.unauthorized_access);
      toast.error(t.errors.unauthorized_access, { position: isRtl ? 'top-right' : 'top-left' });
      setLoading(false);
      return;
    }
    setLoading(pageNum === 1);
    try {
      const params: any = { page: pageNum, limit: 20, sort: '-createdAt', branch: filterBranch, startDate, endDate };
      const [salesResponse, branchesResponse, analyticsResponse] = await Promise.all([
        salesAPI.getAll(params),
        branchesAPI.getAll(),
        salesAPI.getAnalytics(params),
      ]);
      setSales(prev => append ? [...prev, ...salesResponse.sales.map((sale: any) => ({
        ...sale,
        branch: { ...sale.branch, displayName: isRtl ? sale.branch.name : (sale.branch.nameEn || sale.branch.name) },
        items: sale.items.map((item: any) => ({
          ...item,
          displayName: isRtl ? item.product.name : (item.product.nameEn || item.product.name),
          displayUnit: isRtl ? (item.product.unit || t.units?.default || 'غير محدد') : (item.product.unitEn || item.product.unit || t.units?.default || 'N/A'),
        })),
        createdAt: formatDate(sale.createdAt, language),
      }))] : salesResponse.sales.map((sale: any) => ({
        ...sale,
        branch: { ...sale.branch, displayName: isRtl ? sale.branch.name : (sale.branch.nameEn || sale.branch.name) },
        items: sale.items.map((item: any) => ({
          ...item,
          displayName: isRtl ? item.product.name : (item.product.nameEn || item.product.name),
          displayUnit: isRtl ? (item.product.unit || t.units?.default || 'غير محدد') : (item.product.unitEn || item.product.unit || t.units?.default || 'N/A'),
        })),
        createdAt: formatDate(sale.createdAt, language),
      })));
      setBranches(branchesResponse.branches.map((b: any) => ({
        _id: b._id,
        displayName: isRtl ? b.name : (b.nameEn || b.name),
      })));
      setAnalytics({
        ...analyticsResponse,
        branchSales: analyticsResponse.branchSales.map((bs: any) => ({
          ...bs,
          displayName: isRtl ? bs.branchName : (bs.branchNameEn || bs.branchName),
        })),
        productSales: analyticsResponse.productSales.map((ps: any) => ({
          ...ps,
          displayName: isRtl ? ps.productName : (ps.productNameEn || ps.productName),
        })),
        departmentSales: analyticsResponse.departmentSales.map((ds: any) => ({
          ...ds,
          displayName: isRtl ? ds.departmentName : (ds.departmentNameEn || ds.departmentName),
        })),
        topProduct: { ...analyticsResponse.topProduct, displayName: isRtl ? analyticsResponse.topProduct.productName : (analyticsResponse.topProduct.productNameEn || analyticsResponse.topProduct.productName) },
        salesTrends: analyticsResponse.salesTrends.map((t: any) => ({ ...t, period: formatDate(t.period, language) })),
        paymentMethods: analyticsResponse.paymentMethods.map((pm: any) => ({ ...pm, paymentMethod: t.paymentMethods[pm.paymentMethod] || pm.paymentMethod })),
      });
      setError('');
    } catch {
      setError(t.errors.fetch_sales);
      toast.error(t.errors.fetch_sales, { position: isRtl ? 'top-right' : 'top-left' });
    } finally {
      setLoading(false);
    }
  }, [filterBranch, startDate, endDate, user, t, isRtl, language]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportToCSV = useCallback(() => {
    const csvData = sales.map(sale => ({
      orderNumber: sale.orderNumber,
      branch: sale.branch.displayName,
      totalAmount: sale.totalAmount,
      date: sale.createdAt,
      items: sale.items.map(item => `${item.displayName} (${item.quantity})`).join(', '),
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sales_report.csv';
    link.click();
  }, [sales]);

  const filteredSales = useMemo(() =>
    sales.filter(sale =>
      sale.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.branch.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.items.some(item => item.displayName.toLowerCase().includes(searchTerm.toLowerCase()))
    ), [sales, searchTerm]);

  const branchOptions = useMemo(() => [
    { value: '', label: t.allBranches },
    ...branches.map(b => ({ value: b._id, label: b.displayName })),
  ], [branches, t]);

  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' as const } }, scales: { y: { beginAtZero: true } } };
  const colors = ['#FBBF24', '#3B82F6', '#EF4444'];

  return (
    <div className={`min-h-screen bg-gray-50 p-4 ${isRtl ? 'font-arabic' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <header className="mb-6 flex flex-col sm:flex-row justify-between items-center">
        <div className="flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-amber-600" />
          <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
        </div>
        <div className="flex gap-2 mt-4 sm:mt-0">
          <button
            onClick={() => setActiveTab('sales')}
            className={`px-3 py-1.5 rounded-lg text-sm ${activeTab === 'sales' ? 'bg-amber-600 text-white' : 'bg-white border border-gray-200'}`}
          >
            {t.salesTab}
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3 py-1.5 rounded-lg text-sm ${activeTab === 'analytics' ? 'bg-amber-600 text-white' : 'bg-white border border-gray-200'}`}
          >
            {t.analyticsTab}
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-red-600 text-sm">{error}</span>
        </div>
      )}

      <div className="p-4 bg-white rounded-lg shadow-sm mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Dropdown value={filterBranch} onChange={setFilterBranch} options={branchOptions} />
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm"
          />
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm"
          />
        </div>
        <div className="mt-4 relative">
          <Search className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`} />
          <input
            type="text"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); debouncedSearch(e.target.value); }}
            placeholder={t.searchPlaceholder}
            className={`w-full ${isRtl ? 'pr-10 pl-3' : 'pl-10 pr-3'} py-2 border border-gray-200 rounded-lg bg-white text-sm`}
          />
        </div>
      </div>

      {activeTab === 'sales' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">{t.salesTab}</h2>
            <button onClick={exportToCSV} className="px-3 py-1.5 bg-amber-600 text-white rounded-lg flex items-center gap-1 text-sm">
              <Download className="w-4 h-4" /> {t.exportCSV}
            </button>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="p-4 bg-white rounded-lg shadow-sm animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="p-6 text-center bg-white rounded-lg shadow-sm">
              <DollarSign className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600 text-sm">{t.noSales}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSales.map(sale => (
                <div key={sale._id} className="p-4 bg-white rounded-lg shadow-sm">
                  <div className="flex justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900">{sale.orderNumber} - {sale.branch.displayName}</h3>
                      <p className="text-sm text-gray-600">{sale.createdAt}</p>
                      <p className="text-sm text-gray-600">{t.total}: {sale.totalAmount} {t.currency}</p>
                      {sale.paymentMethod && <p className="text-sm text-gray-600">{t.paymentMethods[sale.paymentMethod]}</p>}
                      {sale.items.map((item, i) => (
                        <p key={i} className="text-sm text-gray-600">
                          {item.displayName} ({item.quantity} {item.displayUnit})
                        </p>
                      ))}
                    </div>
                    <button onClick={() => window.confirm(t.confirmDelete) && salesAPI.delete(sale._id).then(() => fetchData()).catch(() => toast.error(t.errors.delete_sale_failed))}>
                      <Trash className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold mb-2">{t.branchSales}</h3>
            <div className="h-[250px]">
              <Bar
                data={{ labels: analytics.branchSales.map(b => b.displayName), datasets: [{ label: t.totalSales, data: analytics.branchSales.map(b => b.totalSales), backgroundColor: colors[0] }] }}
                options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { display: true, text: t.branchSales } } }}
              />
            </div>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold mb-2">{t.productSales}</h3>
            <div className="h-[250px]">
              <Pie
                data={{ labels: analytics.productSales.slice(0, 5).map(p => p.displayName), datasets: [{ data: analytics.productSales.slice(0, 5).map(p => p.totalRevenue), backgroundColor: colors }] }}
                options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { display: true, text: t.productSales } } }}
              />
            </div>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold mb-2">{t.departmentSales}</h3>
            <div className="h-[250px]">
              <Bar
                data={{ labels: analytics.departmentSales.map(d => d.displayName), datasets: [{ label: t.totalSales, data: analytics.departmentSales.map(d => d.totalRevenue), backgroundColor: colors[0] }] }}
                options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { display: true, text: t.departmentSales } } }}
              />
            </div>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold mb-2">{t.salesTrends}</h3>
            <div className="h-[250px]">
              <Line
                data={{ labels: analytics.salesTrends.map(t => t.period), datasets: [{ label: t.totalSales, data: analytics.salesTrends.map(t => t.totalSales), borderColor: colors[0], fill: false }] }}
                options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { display: true, text: t.salesTrends } } }}
              />
            </div>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold mb-2">{t.totalSales}</h3>
            <p className="text-xl font-bold text-amber-600">{analytics.totalSales} {t.currency}</p>
            <p className="text-sm text-gray-600">{t.totalCount}: {analytics.totalCount}</p>
            <p className="text-sm text-gray-600">{t.topProduct}: {analytics.topProduct.displayName} ({analytics.topProduct.totalQuantity})</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(SalesReport);
