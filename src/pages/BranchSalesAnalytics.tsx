import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { salesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line } from 'recharts';
import { AlertCircle, BarChart2, ChevronDown } from 'lucide-react';
import { toast } from 'react-toastify';


const translations = {
  ar: {
    title: 'تقرير المبيعات',
    subtitle: 'إدارة المبيعات وإضافة مبيعات جديدة',
    filters: 'الفلاتر',
    availableProducts: 'المنتجات المتاحة',
    noProducts: 'لا توجد منتجات متاحة',
    department: 'القسم',
    allDepartments: 'كل الأقسام',
    availableStock: 'المخزون المتاح',
    unitPrice: 'سعر الوحدة',
    addToCart: 'إضافة إلى السلة',
    cart: 'سلة المبيعات',
    emptyCart: 'السلة فارغة',
    total: 'الإجمالي',
    notes: 'ملاحظات',
    paymentMethod: 'طريقة الدفع',
    customerName: 'اسم العميل',
    customerPhone: 'هاتف العميل',
    submitSale: 'إرسال المبيعة',
    updateSale: 'تحديث المبيعة',
    deleteSale: 'حذف المبيعة',
    newSale: 'مبيعة جديدة',
    previousSales: 'المبيعات السابقة',
    noSales: 'لا توجد مبيعات',
    date: 'التاريخ',
    returns: 'المرتجعات',
    return: 'مرتجع',
    reason: 'السبب',
    quantity: 'الكمية',
    searchPlaceholder: 'ابحث عن المنتجات...',
    loadMore: 'تحميل المزيد',
    filterBy: 'تصفية حسب',
    customRange: 'نطاق مخصص',
    editSale: 'تعديل المبيعة',
    errors: {
      unauthorized_access: 'غير مصرح لك بالوصول',
      no_branch_assigned: 'لم يتم تعيين فرع',
      fetch_sales: 'خطأ أثناء جلب المبيعات',
      fetch_branches: 'خطأ أثناء جلب الفروع',
      fetch_inventory: 'خطأ أثناء جلب المخزون',
      create_sale_failed: 'فشل إنشاء المبيعة',
      update_sale_failed: 'فشل تحديث المبيعة',
      delete_sale_failed: 'فشل حذف المبيعة',
      insufficient_stock: 'المخزون غير كافٍ',
      sale_not_found: 'المبيعة غير موجودة',
      exceeds_max_quantity: 'الكمية تتجاوز الحد الأقصى',
      invalid_quantity: 'الكمية غير صالحة',
      empty_cart: 'السلة فارغة',
      deleted_product: 'منتج محذوف',
      invalid_customer_phone: 'رقم هاتف العميل غير صالح',
      invalid_payment_method: 'طريقة الدفع غير صالحة',
      no_branches_available: 'لا توجد فروع متاحة',
    },
    currency: 'ريال',
    units: { default: 'غير محدد' },
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
    subtitle: 'Manage sales and add new sales',
    filters: 'Filters',
    availableProducts: 'Available Products',
    noProducts: 'No products available',
    department: 'Department',
    allDepartments: 'All Departments',
    availableStock: 'Available Stock',
    unitPrice: 'Unit Price',
    addToCart: 'Add to Cart',
    cart: 'Sales Cart',
    emptyCart: 'Cart is empty',
    total: 'Total',
    notes: 'Notes',
    paymentMethod: 'Payment Method',
    customerName: 'Customer Name',
    customerPhone: 'Customer Phone',
    submitSale: 'Submit Sale',
    updateSale: 'Update Sale',
    deleteSale: 'Delete Sale',
    newSale: 'New Sale',
    previousSales: 'Previous Sales',
    noSales: 'No sales found',
    date: 'Date',
    returns: 'Returns',
    return: 'Return',
    reason: 'Reason',
    quantity: 'Quantity',
    searchPlaceholder: 'Search products...',
    loadMore: 'Load More',
    filterBy: 'Filter By',
    customRange: 'Custom Range',
    editSale: 'Edit Sale',
    errors: {
      unauthorized_access: 'You are not authorized to access',
      no_branch_assigned: 'No branch assigned',
      fetch_sales: 'Error fetching sales',
      fetch_branches: 'Error fetching branches',
      fetch_inventory: 'Error fetching inventory',
      create_sale_failed: 'Failed to create sale',
      update_sale_failed: 'Failed to update sale',
      delete_sale_failed: 'Failed to delete sale',
      insufficient_stock: 'Insufficient stock',
      sale_not_found: 'Sale not found',
      exceeds_max_quantity: 'Quantity exceeds maximum available',
      invalid_quantity: 'Invalid quantity',
      empty_cart: 'Cart is empty',
      deleted_product: 'Deleted Product',
      invalid_customer_phone: 'Invalid customer phone',
      invalid_payment_method: 'Invalid payment method',
      no_branches_available: 'No branches available',
    },
    currency: 'SAR',
    units: { default: 'N/A' },
    branches: { all_branches: 'All Branches', select_branch: 'Select Branch', unknown: 'Unknown' },
    departments: { unknown: 'Unknown' },
    paymentMethods: {
      cash: 'Cash',
      credit_card: 'Credit Card',
      bank_transfer: 'Bank Transfer',
    },
  },
};

// واجهات TypeScript
interface AnalyticsData {
  totalSales: number;
  totalCount: number;
  averageOrderValue: number;
  topProduct: {
    productId: string | null;
    productName: string;
    displayName: string;
    totalQuantity: number;
    totalRevenue: number;
  };
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
  salesTrends: Array<{
    period: string;
    totalSales: number;
    saleCount: number;
  }>;
  topCustomers: Array<{
    customerName: string;
    customerPhone: string;
    totalSpent: number;
    purchaseCount: number;
  }>;
}

interface Branch {
  _id: string;
  name: string;
  nameEn?: string;
  displayName: string;
}

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

const AnalyticsSkeleton = React.memo(() => (
  <div className="space-y-6 animate-pulse">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      {[...Array(3)].map((_, index) => (
        <div key={index} className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        </div>
      ))}
    </div>
    <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
      <div className="h-64 bg-gray-200 rounded"></div>
    </div>
  </div>
));

// المكون الرئيسي
export const BranchSalesAnalytics: React.FC = () => {
  const { t: languageT, language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'] || translations.en;

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // التحقق من الصلاحيات
  useEffect(() => {
    if (!user?.role || (user.role !== 'branch' && user.role !== 'admin')) {
      setError(t.errors.unauthorized_access);
      toast.error(t.errors.unauthorized_access, { position: isRtl ? 'top-right' : 'top-left' });
      navigate('/unauthorized');
    }
  }, [user, t, isRtl, navigate]);

  // جلب البيانات التحليلية
  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (user?.role === 'branch') {
        params.branch = user.branchId;
      } else if (selectedBranch) {
        params.branch = selectedBranch;
      }
      if (filterPeriod === 'custom' && startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }

      const response = await salesAPI.getAnalytics(params);
      setAnalytics({
        ...response,
        salesTrends: response.salesTrends.map((trend: any) => ({
          ...trend,
          period: formatDate(new Date(trend.period), isRtl ? 'ar' : 'en'),
        })),
      });
      setBranches(
        response.branchSales.map((b: any) => ({
          _id: b.branchId,
          name: b.branchName,
          nameEn: b.branchNameEn,
          displayName: isRtl ? b.branchName : (b.branchNameEn || b.branchName),
        }))
      );
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Analytics fetch error:`, err);
      const errorMessage = err.status === 403 ? t.errors.unauthorized_access : t.errors.fetch_analytics;
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [filterPeriod, startDate, endDate, user, t, isRtl, selectedBranch]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // خيارات الفروع
  const branchOptions = useMemo(() => {
    return [
      { value: '', label: t.allBranches },
      ...branches.map((branch) => ({ value: branch._id, label: branch.displayName })),
    ];
  }, [branches, t]);

  // خيارات التصفية
  const periodOptions = useMemo(
    () => [
      { value: 'all', label: isRtl ? 'الكل' : 'All' },
      { value: 'custom', label: t.customRange },
    ],
    [t, isRtl]
  );

  // ألوان الرسوم البيانية
  const COLORS = ['#FFBB28', '#FF8042', '#0088FE', '#00C49F', '#FF4444'];

  return (
    <div className={`mx-auto px-4 sm:px-6 py-8 min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans ${isRtl ? 'font-arabic' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <header className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center gap-3">
          <BarChart2 className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.analyticsTitle}</h1>
            <p className="text-gray-600 text-sm">{t.analyticsSubtitle}</p>
          </div>
        </div>
      </header>
      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm font-medium">{error}</span>
        </div>
      )}
      <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">{t.filters}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {user?.role === 'admin' && (
            <ProductDropdown
              value={selectedBranch}
              onChange={setSelectedBranch}
              options={branchOptions}
              ariaLabel={t.branch}
            />
          )}
          <ProductDropdown
            value={filterPeriod}
            onChange={setFilterPeriod}
            options={periodOptions}
            ariaLabel={t.filterBy}
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
        </div>
      </div>
      {loading ? (
        <AnalyticsSkeleton />
      ) : !analytics ? (
        <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100">
          <BarChart2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-sm font-medium">{t.noAnalytics}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* الإحصائيات الأساسية */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">{t.totalSales}</h3>
              <p className="text-2xl font-bold text-amber-600 mt-2">{analytics.totalSales.toFixed(2)} {t.currency}</p>
            </div>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">{t.totalCount}</h3>
              <p className="text-2xl font-bold text-amber-600 mt-2">{analytics.totalCount}</p>
            </div>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">{t.averageOrderValue}</h3>
              <p className="text-2xl font-bold text-amber-600 mt-2">{analytics.averageOrderValue.toFixed(2)} {t.currency}</p>
            </div>
          </div>

          {/* اتجاهات المبيعات */}
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.salesTrends}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.salesTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="totalSales" stroke="#FFBB28" name={t.totalSales} />
                <Line type="monotone" dataKey="saleCount" stroke="#0088FE" name={t.totalCount} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* مبيعات المنتجات الأعلى */}
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.topProducts}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.productSales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="displayName" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="totalRevenue" fill="#FFBB28" name={t.totalRevenue} />
                <Bar dataKey="totalQuantity" fill="#0088FE" name={t.totalQuantity} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* مبيعات المنتجات الأقل */}
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.leastProducts}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.leastProductSales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="displayName" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="totalRevenue" fill="#FF4444" name={t.totalRevenue} />
                <Bar dataKey="totalQuantity" fill="#00C49F" name={t.totalQuantity} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* مبيعات الأقسام */}
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.departmentSales}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.departmentSales}
                  dataKey="totalRevenue"
                  nameKey="displayName"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  label
                >
                  {analytics.departmentSales.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* أقل الأقسام مبيعًا */}
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.leastDepartmentSales}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.leastDepartmentSales}
                  dataKey="totalRevenue"
                  nameKey="displayName"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  label
                >
                  {analytics.leastDepartmentSales.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* أعلى الفروع مبيعًا (للأدمن فقط) */}
          {user?.role === 'admin' && (
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.topBranches}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.branchSales}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="displayName" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="totalSales" fill="#FFBB28" name={t.totalSales} />
                  <Bar dataKey="saleCount" fill="#0088FE" name={t.totalCount} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* أقل الفروع مبيعًا (للأدمن فقط) */}
          {user?.role === 'admin' && (
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.leastBranches}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.leastBranchSales}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="displayName" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="totalSales" fill="#FF4444" name={t.totalSales} />
                  <Bar dataKey="saleCount" fill="#00C49F" name={t.totalCount} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* أفضل العملاء */}
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.topCustomers}</h3>
            {analytics.topCustomers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-gray-700">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className={`px-4 py-2 text-${isRtl ? 'right' : 'left'} font-semibold`}>{t.customerName}</th>
                      <th className={`px-4 py-2 text-${isRtl ? 'right' : 'left'} font-semibold`}>{t.customerPhone}</th>
                      <th className={`px-4 py-2 text-${isRtl ? 'right' : 'left'} font-semibold`}>{t.totalSpent}</th>
                      <th className={`px-4 py-2 text-${isRtl ? 'right' : 'left'} font-semibold`}>{t.purchaseCount}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.topCustomers.map((customer, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2">{customer.customerName || t.unknown}</td>
                        <td className="px-4 py-2">{customer.customerPhone || t.unknown}</td>
                        <td className="px-4 py-2">{customer.totalSpent.toFixed(2)} {t.currency}</td>
                        <td className="px-4 py-2">{customer.purchaseCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-600 text-sm">{t.noCustomers}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(BranchSalesAnalytics);
