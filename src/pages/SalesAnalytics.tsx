import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { salesAPI, ordersAPI, returnsAPI, branchesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, BarChart2, ChevronDown, Search, X, Download } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { debounce } from 'lodash';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, Title } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, Title);

interface SalesAnalytics {
  branchSales: Array<{
    branchId: string;
    branchName: string;
    branchNameEn?: string;
    displayName: string;
    totalSales: number;
    saleCount: number;
    averageOrderValue: number;
    totalOrders: number;
    totalReturns: number;
  }>;
  leastBranchSales: Array<{
    branchId: string;
    branchName: string;
    branchNameEn?: string;
    displayName: string;
    totalSales: number;
    saleCount: number;
    averageOrderValue: number;
    totalOrders: number;
    totalReturns: number;
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

interface OrderAnalytics {
  branchOrders: Array<{
    branchId: string;
    branchName: string;
    branchNameEn?: string;
    displayName: string;
    totalOrders: number;
    totalValue: number;
    averageOrderValue: number;
  }>;
  leastBranchOrders: Array<{
    branchId: string;
    branchName: string;
    branchNameEn?: string;
    displayName: string;
    totalOrders: number;
    totalValue: number;
    averageOrderValue: number;
  }>;
  orderTrends: Array<{ period: string; totalOrders: number; totalValue: number }>;
  totalOrders: number;
  totalValue: number;
  averageOrderValue: number;
}

interface ReturnAnalytics {
  branchReturns: Array<{
    branchId: string;
    branchName: string;
    branchNameEn?: string;
    displayName: string;
    totalReturns: number;
    totalValue: number;
    averageReturnValue: number;
  }>;
  leastBranchReturns: Array<{
    branchId: string;
    branchName: string;
    branchNameEn?: string;
    displayName: string;
    totalReturns: number;
    totalValue: number;
    averageReturnValue: number;
  }>;
  returnTrends: Array<{ period: string; totalReturns: number; totalValue: number }>;
  totalReturns: number;
  totalValue: number;
  averageReturnValue: number;
}

interface Order {
  _id: string;
  orderNumber: string;
  date: string;
  total: number;
  status: string;
  branchName: string;
  branch: any;
  totalAmount: number;
  createdAt: string;
}

interface ReturnItem {
  _id: string;
  returnNumber: string;
  date: string;
  total: number;
  status: string;
  branchName: string;
  branch: any;
  totalAmount: number;
  createdAt: string;
  items?: Array<{ quantity: number; price: number }>;
}

interface Branch {
  _id: string;
  name: string;
  nameEn?: string;
  displayName: string;
}

const translations = {
  ar: {
    title: 'تقارير وإحصائيات',
    subtitle: 'تحليلات المبيعات، الطلبات، والمرتجعات',
    totalSales: 'إجمالي المبيعات',
    totalCount: 'عدد المبيعات',
    averageOrderValue: 'متوسط قيمة الطلب',
    totalOrders: 'إجمالي الطلبات',
    totalReturns: 'إجمالي المرتجعات',
    totalValue: 'القيمة الإجمالية',
    averageReturnValue: 'متوسط قيمة المرتجع',
    topProduct: 'المنتج الأكثر مبيعًا',
    productSales: 'مبيعات المنتجات',
    leastProductSales: 'أقل المنتجات مبيعًا',
    departmentSales: 'مبيعات الأقسام',
    leastDepartmentSales: 'أقل الأقسام مبيعًا',
    branchSales: 'مبيعات الفروع',
    leastBranchSales: 'أقل الفروع مبيعًا',
    branchOrders: 'طلبات الفروع',
    leastBranchOrders: 'أقل الفروع طلبات',
    branchReturns: 'مرتجعات الفروع',
    leastBranchReturns: 'أقل الفروع مرتجعات',
    salesTrends: 'اتجاهات المبيعات',
    orderTrends: 'اتجاهات الطلبات',
    returnTrends: 'اتجاهات المرتجعات',
    topCustomers: 'أفضل العملاء',
    ordersTab: 'الطلبات',
    returnsTab: 'المرتجعات',
    salesTab: 'المبيعات',
    searchPlaceholder: 'ابحث عن منتجات، أقسام، فروع، طلبات، أو مرتجعات...',
    branchFilterPlaceholder: 'اختر فرعًا',
    noAnalytics: 'لا توجد إحصائيات متاحة',
    noData: 'لا توجد بيانات',
    noCustomers: 'لا توجد عملاء',
    noOrders: 'لا توجد طلبات',
    noReturns: 'لا توجد مرتجعات',
    startDate: 'تاريخ البدء',
    endDate: 'تاريخ الانتهاء',
    export: 'تصدير البيانات',
    errors: {
      unauthorized_access: 'غير مصرح لك بالوصول',
      fetch_analytics: 'خطأ أثناء جلب الإحصائيات',
      network_error: 'خطأ في الاتصال بالشبكة',
      invalid_data: 'بيانات غير صالحة من الخادم',
      invalid_dates: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية',
      fetch_branches: 'خطأ أثناء جلب الفروع',
      export_failed: 'فشل تصدير البيانات',
    },
    currency: 'ريال',
  },
  en: {
    title: 'Reports & Analytics',
    subtitle: 'Sales, Orders, and Returns Analytics',
    totalSales: 'Total Sales',
    totalCount: 'Total Sale Count',
    averageOrderValue: 'Average Order Value',
    totalOrders: 'Total Orders',
    totalReturns: 'Total Returns',
    totalValue: 'Total Value',
    averageReturnValue: 'Average Return Value',
    topProduct: 'Top Selling Product',
    productSales: 'Product Sales',
    leastProductSales: 'Least Sold Products',
    departmentSales: 'Department Sales',
    leastDepartmentSales: 'Least Sold Departments',
    branchSales: 'Branch Sales',
    leastBranchSales: 'Least Sold Branches',
    branchOrders: 'Branch Orders',
    leastBranchOrders: 'Least Ordered Branches',
    branchReturns: 'Branch Returns',
    leastBranchReturns: 'Least Returned Branches',
    salesTrends: 'Sales Trends',
    orderTrends: 'Order Trends',
    returnTrends: 'Return Trends',
    topCustomers: 'Top Customers',
    ordersTab: 'Orders',
    returnsTab: 'Returns',
    salesTab: 'Sales',
    searchPlaceholder: 'Search products, departments, branches, orders, or returns...',
    branchFilterPlaceholder: 'Select a branch',
    noAnalytics: 'No analytics available',
    noData: 'No data available',
    noCustomers: 'No customers',
    noOrders: 'No orders',
    noReturns: 'No returns',
    startDate: 'Start Date',
    endDate: 'End Date',
    export: 'Export Data',
    errors: {
      unauthorized_access: 'You are not authorized to access',
      fetch_analytics: 'Error fetching analytics',
      network_error: 'Network connection error',
      invalid_data: 'Invalid data from server',
      invalid_dates: 'Start date must be before end date',
      fetch_branches: 'Error fetching branches',
      export_failed: 'Failed to export data',
    },
    currency: 'SAR',
  },
};

const safeNumber = (value: any, defaultValue: number = 0): number =>
  typeof value === 'number' && !isNaN(value) ? value : defaultValue;

const safeString = (value: any, defaultValue: string = ''): string =>
  typeof value === 'string' ? value : defaultValue;

const isValidDate = (date: string): boolean => !isNaN(new Date(date).getTime());

const exportToCSV = (data: any[], filename: string, columns: { key: string; label: string }[], isRtl: boolean, currency: string) => {
  try {
    const headers = columns.map(col => `"${col.label.replace(/"/g, '""')}"`).join(',');
    const rows = data.map(item =>
      columns.map(col => {
        const value = col.key.includes('total') || col.key === 'averageOrderValue' || col.key === 'averageReturnValue' || col.key === 'totalRevenue' || col.key === 'totalSpent' || col.key === 'totalQuantity' || col.key === 'saleCount' || col.key === 'totalOrders' || col.key === 'totalReturns' || col.key === 'totalValue'
          ? `"${safeNumber(item[col.key]).toFixed(2)} ${currency}"`
          : `"${safeString(item[col.key]).replace(/"/g, '""')}"`
      }).join(',')
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([isRtl ? '\uFEFF' + csv : csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Export CSV error:`, err);
    throw new Error(translations[isRtl ? 'ar' : 'en'].errors.export_failed);
  }
};

const AnalyticsSkeleton: React.FC = () => (
  <div className="space-y-6 animate-pulse">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, index) => (
        <div key={index} className="p-4 bg-white rounded-xl shadow-md border border-gray-100">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
          <div className="h-8 bg-gray-200 rounded w-1/2" />
        </div>
      ))}
    </div>
    <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100">
      <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
      <div className="h-64 bg-gray-200 rounded" />
    </div>
  </div>
);

const NoDataMessage: React.FC<{ message: string }> = ({ message }) => (
  <p className="text-center text-gray-500 py-4 text-sm font-alexandria">{message}</p>
);

const ProductSearchInput: React.FC<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  ariaLabel: string;
  className?: string;
}> = ({ value, onChange, placeholder, ariaLabel, className }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';

  const handleClear = () => {
    onChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>);
  };

  return (
    <div className={`relative group w-full ${className}`}>
      <motion.div
        className={`absolute inset-y-0 ${isRtl ? 'right-3' : 'left-3'} flex items-center text-gray-400 transition-colors group-focus-within:text-amber-500`}
        initial={false}
        animate={{ opacity: value ? 0 : 1, scale: value ? 0.8 : 1 }}
        transition={{ duration: 0.2 }}
      >
        <Search className="w-5 h-5" />
      </motion.div>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full ${isRtl ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm hover:shadow-md placeholder-gray-400 transition-all duration-300 font-alexandria ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={ariaLabel}
      />
      {value && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          onClick={handleClear}
          className={`absolute inset-y-0 ${isRtl ? 'left-3' : 'right-3'} flex items-center text-gray-400 hover:text-amber-500 transition-colors focus:outline-none`}
          aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
        >
          <X className="w-5 h-5" />
        </motion.button>
      )}
    </div>
  );
};

const ProductDropdown: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}> = ({ value, onChange, options, ariaLabel, disabled = false, className }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((opt) => opt.value === value) || options[0] || { label: isRtl ? 'اختر' : 'Select', value: '' };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative group w-full ${className}`} ref={dropdownRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full py-2.5 px-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm hover:shadow-md text-sm font-alexandria text-gray-700 flex justify-between items-center transition-all duration-300 ${isRtl ? 'text-right' : 'text-left'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={ariaLabel}
      >
        <span className="truncate">{selectedOption.label}</span>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && !disabled && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={`absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-amber-500 scrollbar-track-gray-100 font-alexandria ${isRtl ? 'text-right' : 'text-left'}`}
        >
          {options.map((option) => (
            <button
              key={option.value}
              dir={isRtl ? 'rtl' : 'ltr'}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-500 transition-colors"
            >
              {option.label}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
};

const DataTable: React.FC<{
  title: string;
  data: any[];
  columns: { key: string; label: string; width?: string }[];
  isRtl: boolean;
  currency?: string;
  className?: string;
}> = React.memo(({ title, data, columns, isRtl, currency, className }) => (
  <div className={`p-4 bg-white rounded-xl shadow-md border border-gray-100 mt-4 ${className}`}>
    <div className="flex justify-between items-center mb-3">
      <h3 className="text-sm font-semibold text-gray-800 font-alexandria">{title}</h3>
      {data.length > 0 && (
        <button
          onClick={() => exportToCSV(data, title, columns, isRtl, currency || '')}
          className="flex items-center gap-2 text-sm text-amber-500 hover:text-amber-600 transition-colors"
        >
          <Download className="w-5 h-5" />
          {translations[isRtl ? 'ar' : 'en'].export}
        </button>
      )}
    </div>
    {data.length > 0 ? (
      <div className="overflow-x-auto overflow-y-auto max-h-[400px] scrollbar-thin scrollbar-thumb-amber-500 scrollbar-track-gray-100">
        <table className="w-full text-sm min-w-max table-auto">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`p-3 ${isRtl ? 'text-right' : 'text-left'} ${col.width || 'w-auto'} font-alexandria font-semibold text-gray-600`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index} className="border-t hover:bg-amber-50 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className={`p-3 ${col.width || 'w-auto'} font-alexandria text-gray-700 truncate`}>
                    {col.key.includes('total') || col.key === 'averageOrderValue' || col.key === 'averageReturnValue' || col.key === 'totalRevenue' || col.key === 'totalSpent' || col.key === 'totalQuantity' || col.key === 'saleCount' || col.key === 'totalOrders' || col.key === 'totalReturns' || col.key === 'totalValue'
                      ? `${safeNumber(item[col.key]).toFixed(2)} ${currency || ''}`
                      : safeString(item[col.key], '-') || '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <NoDataMessage message={translations[isRtl ? 'ar' : 'en'].noData} />
    )}
  </div>
));

const OrdersTable: React.FC<{
  orders: Order[];
  isRtl: boolean;
  currency: string;
  language: string;
  className?: string;
}> = React.memo(({ orders, isRtl, currency, language, className }) => (
  <div className={`p-4 bg-white rounded-xl shadow-md border border-gray-100 ${className}`}>
    <div className="flex justify-between items-center mb-3">
      <h3 className="text-sm font-semibold text-gray-800 font-alexandria">{translations[isRtl ? 'ar' : 'en'].ordersTab}</h3>
      {orders.length > 0 && (
        <button
          onClick={() => exportToCSV(orders, 'orders', [
            { key: 'orderNumber', label: isRtl ? 'رقم الطلب' : 'Order Number' },
            { key: 'date', label: isRtl ? 'التاريخ' : 'Date' },
            { key: 'total', label: isRtl ? 'الإجمالي' : 'Total' },
            { key: 'status', label: isRtl ? 'الحالة' : 'Status' },
            { key: 'branchName', label: isRtl ? 'الفرع' : 'Branch' },
          ], isRtl, currency)}
          className="flex items-center gap-2 text-sm text-amber-500 hover:text-amber-600 transition-colors"
        >
          <Download className="w-5 h-5" />
          {translations[isRtl ? 'ar' : 'en'].export}
        </button>
      )}
    </div>
    {orders.length > 0 ? (
      <div className="overflow-x-auto overflow-y-auto max-h-[400px] scrollbar-thin scrollbar-thumb-amber-500 scrollbar-track-gray-100">
        <table className="w-full text-sm min-w-max table-auto">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'} font-alexandria font-semibold text-gray-600`}>{isRtl ? 'رقم الطلب' : 'Order Number'}</th>
              <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'} font-alexandria font-semibold text-gray-600`}>{isRtl ? 'التاريخ' : 'Date'}</th>
              <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'} font-alexandria font-semibold text-gray-600`}>{isRtl ? 'الإجمالي' : 'Total'}</th>
              <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'} font-alexandria font-semibold text-gray-600`}>{isRtl ? 'الحالة' : 'Status'}</th>
              <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'} font-alexandria font-semibold text-gray-600`}>{isRtl ? 'الفرع' : 'Branch'}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order._id} className="border-t hover:bg-amber-50 transition-colors">
                <td className="p-3 font-alexandria text-gray-700 truncate">{safeString(order.orderNumber, 'N/A')}</td>
                <td className="p-3 font-alexandria text-gray-700 truncate">{formatDate(new Date(order.date), language)}</td>
                <td className="p-3 font-alexandria text-gray-700 truncate">{safeNumber(order.total).toFixed(2)} {currency}</td>
                <td className="p-3 font-alexandria text-gray-700 truncate">{safeString(order.status, 'Unknown')}</td>
                <td className="p-3 font-alexandria text-gray-700 truncate">{safeString(order.branchName, 'Unknown')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <NoDataMessage message={translations[isRtl ? 'ar' : 'en'].noOrders} />
    )}
  </div>
));

const ReturnsTable: React.FC<{
  returns: ReturnItem[];
  isRtl: boolean;
  currency: string;
  language: string;
  className?: string;
}> = React.memo(({ returns, isRtl, currency, language, className }) => (
  <div className={`p-4 bg-white rounded-xl shadow-md border border-gray-100 ${className}`}>
    <div className="flex justify-between items-center mb-3">
      <h3 className="text-sm font-semibold text-gray-800 font-alexandria">{translations[isRtl ? 'ar' : 'en'].returnsTab}</h3>
      {returns.length > 0 && (
        <button
          onClick={() => exportToCSV(returns, 'returns', [
            { key: 'returnNumber', label: isRtl ? 'رقم المرتجع' : 'Return Number' },
            { key: 'date', label: isRtl ? 'التاريخ' : 'Date' },
            { key: 'total', label: isRtl ? 'الإجمالي' : 'Total' },
            { key: 'status', label: isRtl ? 'الحالة' : 'Status' },
            { key: 'branchName', label: isRtl ? 'الفرع' : 'Branch' },
          ], isRtl, currency)}
          className="flex items-center gap-2 text-sm text-amber-500 hover:text-amber-600 transition-colors"
        >
          <Download className="w-5 h-5" />
          {translations[isRtl ? 'ar' : 'en'].export}
        </button>
      )}
    </div>
    {returns.length > 0 ? (
      <div className="overflow-x-auto overflow-y-auto max-h-[400px] scrollbar-thin scrollbar-thumb-amber-500 scrollbar-track-gray-100">
        <table className="w-full text-sm min-w-max table-auto">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'} font-alexandria font-semibold text-gray-600`}>{isRtl ? 'رقم المرتجع' : 'Return Number'}</th>
              <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'} font-alexandria font-semibold text-gray-600`}>{isRtl ? 'التاريخ' : 'Date'}</th>
              <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'} font-alexandria font-semibold text-gray-600`}>{isRtl ? 'الإجمالي' : 'Total'}</th>
              <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'} font-alexandria font-semibold text-gray-600`}>{isRtl ? 'الحالة' : 'Status'}</th>
              <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'} font-alexandria font-semibold text-gray-600`}>{isRtl ? 'الفرع' : 'Branch'}</th>
            </tr>
          </thead>
          <tbody>
            {returns.map((returnItem) => (
              <tr key={returnItem._id} className="border-t hover:bg-amber-50 transition-colors">
                <td className="p-3 font-alexandria text-gray-700 truncate">{safeString(returnItem.returnNumber, 'N/A')}</td>
                <td className="p-3 font-alexandria text-gray-700 truncate">{formatDate(new Date(returnItem.date), language)}</td>
                <td className="p-3 font-alexandria text-gray-700 truncate">{safeNumber(returnItem.total).toFixed(2)} {currency}</td>
                <td className="p-3 font-alexandria text-gray-700 truncate">{safeString(returnItem.status, 'Unknown')}</td>
                <td className="p-3 font-alexandria text-gray-700 truncate">{safeString(returnItem.branchName, 'Unknown')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <NoDataMessage message={translations[isRtl ? 'ar' : 'en'].noReturns} />
    )}
  </div>
));

const calculateBranchAnalytics = (list: any[], isRtl: boolean, field: string) => {
  const branchMap = new Map<string, { branchId: string; displayName: string; count: number; total: number; average: number }>();
  list.forEach(item => {
    const branchId = item.branch?._id || 'unknown';
    const branchName = item.branchName;
    let entry = branchMap.get(branchId);
    if (!entry) {
      entry = { branchId, displayName: branchName, count: 0, total: 0, average: 0 };
      branchMap.set(branchId, entry);
    }
    entry.count += 1;
    entry.total += item[field] || 0;
  });
  const branches = Array.from(branchMap.values());
  branches.forEach(b => b.average = b.count > 0 ? b.total / b.count : 0);
  return branches.sort((a, b) => b.total - a.total);
};

const calculateLeastBranchAnalytics = (list: any[], isRtl: boolean, field: string) => {
  return calculateBranchAnalytics(list, isRtl, field).sort((a, b) => a.total - b.total);
};

const calculateTrends = (list: any[], dateField: string, valueField: string, countField: string, start: string, end: string, lang: string) => {
  const trends = [];
  const startD = new Date(start);
  const endD = new Date(end);
  for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
    const period = formatDate(d, lang);
    const dayList = list.filter(item => new Date(item[dateField]).toDateString() === d.toDateString());
    const totalValue = dayList.reduce((sum, item) => sum + (item.total || 0), 0);
    const totalCount = dayList.length;
    trends.push({ period, [valueField]: totalValue, [countField]: totalCount });
  }
  return trends;
};

const ReportsAnalytics: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
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
  const [orderAnalytics, setOrderAnalytics] = useState<OrderAnalytics>({
    branchOrders: [],
    leastBranchOrders: [],
    orderTrends: [],
    totalOrders: 0,
    totalValue: 0,
    averageOrderValue: 0,
  });
  const [returnAnalytics, setReturnAnalytics] = useState<ReturnAnalytics>({
    branchReturns: [],
    leastBranchReturns: [],
    returnTrends: [],
    totalReturns: 0,
    totalValue: 0,
    averageReturnValue: 0,
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [returns, setReturns] = useState<ReturnItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'sales' | 'orders' | 'returns'>('sales');
  const debouncedSearch = useCallback(debounce((value: string) => setSearchTerm(value.trim().toLowerCase()), 300), []);

  const fetchBranches = useCallback(async () => {
    try {
      const response = await branchesAPI.getAll();
      const branchesData = Array.isArray(response) ? response : response.branches || [];
      setBranches(branchesData.map((b: any) => ({
        _id: safeString(b._id),
        name: safeString(b.name),
        nameEn: safeString(b.nameEn),
        displayName: isRtl ? safeString(b.name, 'فرع غير معروف') : safeString(b.nameEn || b.name, 'Unknown Branch'),
      })));
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Fetch branches error:`, err);
      toast.error(t.errors.fetch_branches, { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
    }
  }, [isRtl, t]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const fetchData = useCallback(async (type: 'sales' | 'orders' | 'returns') => {
    if (user?.role !== 'admin') {
      setError(t.errors.unauthorized_access);
      toast.error(t.errors.unauthorized_access, { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
      setLoading(false);
      return;
    }

    if (!isValidDate(startDate) || !isValidDate(endDate) || new Date(startDate) > new Date(endDate)) {
      setError(t.errors.invalid_dates);
      toast.error(t.errors.invalid_dates, { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params: any = {
        branch: selectedBranch,
        startDate: new Date(startDate).toISOString().split('T')[0],
        endDate: new Date(endDate).toISOString().split('T')[0],
        lang: language,
      };
      let response;
      if (type === 'sales') {
        response = await salesAPI.getAnalytics(params);
        if (!response || typeof response !== 'object') {
          throw new Error(t.errors.invalid_data);
        }
        setAnalytics({
          branchSales: (response.branchSales || []).map((bs: any) => ({
            branchId: safeString(bs.branchId),
            branchName: safeString(bs.branchName),
            branchNameEn: safeString(bs.branchNameEn),
            displayName: isRtl ? safeString(bs.branchName, 'فرع غير معروف') : safeString(bs.branchNameEn || bs.branchName, 'Unknown Branch'),
            totalSales: safeNumber(bs.totalSales),
            saleCount: safeNumber(bs.saleCount),
            averageOrderValue: safeNumber(bs.averageOrderValue),
            totalOrders: safeNumber(bs.totalOrders),
            totalReturns: safeNumber(bs.totalReturns),
          })).sort((a, b) => b.totalSales - a.totalSales).slice(0, 6),
          leastBranchSales: (response.leastBranchSales || []).map((bs: any) => ({
            branchId: safeString(bs.branchId),
            branchName: safeString(bs.branchName),
            branchNameEn: safeString(bs.branchNameEn),
            displayName: isRtl ? safeString(bs.branchName, 'فرع غير معروف') : safeString(bs.branchNameEn || bs.branchName, 'Unknown Branch'),
            totalSales: safeNumber(bs.totalSales),
            saleCount: safeNumber(bs.saleCount),
            averageOrderValue: safeNumber(bs.averageOrderValue),
            totalOrders: safeNumber(bs.totalOrders),
            totalReturns: safeNumber(bs.totalReturns),
          })).sort((a, b) => a.totalSales - b.totalSales).slice(0, 6),
          productSales: (response.productSales || []).map((ps: any) => ({
            productId: safeString(ps.productId),
            productName: safeString(ps.productName),
            productNameEn: safeString(ps.productNameEn),
            displayName: isRtl ? safeString(ps.productName, 'منتج محذوف') : safeString(ps.productNameEn || ps.productName, 'Deleted Product'),
            totalQuantity: safeNumber(ps.totalQuantity),
            totalRevenue: safeNumber(ps.totalRevenue),
          })).sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 6),
          leastProductSales: (response.leastProductSales || []).map((ps: any) => ({
            productId: safeString(ps.productId),
            productName: safeString(ps.productName),
            productNameEn: safeString(ps.productNameEn),
            displayName: isRtl ? safeString(ps.productName, 'منتج محذوف') : safeString(ps.productNameEn || ps.productName, 'Deleted Product'),
            totalQuantity: safeNumber(ps.totalQuantity),
            totalRevenue: safeNumber(ps.totalRevenue),
          })).sort((a, b) => a.totalRevenue - b.totalRevenue).slice(0, 6),
          departmentSales: (response.departmentSales || []).map((ds: any) => ({
            departmentId: safeString(ds.departmentId),
            departmentName: safeString(ds.departmentName),
            departmentNameEn: safeString(ds.departmentNameEn),
            displayName: isRtl ? safeString(ds.departmentName, 'قسم غير معروف') : safeString(ds.departmentNameEn || ds.departmentName, 'Unknown Department'),
            totalRevenue: safeNumber(ds.totalRevenue),
            totalQuantity: safeNumber(ds.totalQuantity),
          })).sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 6),
          leastDepartmentSales: (response.leastDepartmentSales || []).map((ds: any) => ({
            departmentId: safeString(ds.departmentId),
            departmentName: safeString(ds.departmentName),
            departmentNameEn: safeString(ds.departmentNameEn),
            displayName: isRtl ? safeString(ds.departmentName, 'قسم غير معروف') : safeString(ds.departmentNameEn || ds.departmentName, 'Unknown Department'),
            totalRevenue: safeNumber(ds.totalRevenue),
            totalQuantity: safeNumber(ds.totalQuantity),
          })).sort((a, b) => a.totalRevenue - b.totalRevenue).slice(0, 6),
          totalSales: safeNumber(response.totalSales),
          totalCount: safeNumber(response.totalCount),
          averageOrderValue: safeNumber(response.averageOrderValue),
          topProduct: response.topProduct
            ? {
                productId: safeString(response.topProduct.productId),
                productName: safeString(response.topProduct.productName),
                productNameEn: safeString(response.topProduct.productNameEn),
                displayName: isRtl ? safeString(response.topProduct.productName, 'منتج محذوف') : safeString(response.topProduct.productNameEn || response.topProduct.productName, 'Deleted Product'),
                totalQuantity: safeNumber(response.topProduct.totalQuantity),
                totalRevenue: safeNumber(response.topProduct.totalRevenue),
              }
            : { productId: null, productName: '', displayName: '', totalQuantity: 0, totalRevenue: 0 },
          salesTrends: (response.salesTrends || []).map((trend: any) => ({
            period: formatDate(new Date(safeString(trend.period)), language),
            totalSales: safeNumber(trend.totalSales),
            saleCount: safeNumber(trend.saleCount),
          })).slice(0, 12),
          topCustomers: (response.topCustomers || []).map((customer: any) => ({
            customerName: safeString(customer.customerName, t.noCustomers),
            customerPhone: safeString(customer.customerPhone, ''),
            totalSpent: safeNumber(customer.totalSpent),
            purchaseCount: safeNumber(customer.purchaseCount),
          })).slice(0, 5),
        });
      } else if (type === 'orders') {
        response = await ordersAPI.getAll(params);
        const rawResponse = Array.isArray(response) ? response : response.orders || [];
        if (!Array.isArray(rawResponse)) {
          throw new Error(t.errors.invalid_data);
        }
        const orderList = rawResponse.map((order: any) => ({
          _id: safeString(order._id),
          orderNumber: safeString(order.orderNumber, 'N/A'),
          date: safeString(order.createdAt),
          total: safeNumber(order.totalAmount),
          status: safeString(order.status, 'Unknown'),
          branchName: isRtl ? safeString(order.branch?.name, 'Unknown') : safeString(order.branch?.nameEn || order.branch?.name, 'Unknown'),
          branch: order.branch || {},
          totalAmount: safeNumber(order.totalAmount),
          createdAt: safeString(order.createdAt),
        }));
        setOrders(orderList);
        const totalOrders = orderList.length;
        const totalValue = orderList.reduce((sum, o) => sum + o.total, 0);
        const averageOrderValue = totalOrders > 0 ? totalValue / totalOrders : 0;
        const branchOrders = calculateBranchAnalytics(orderList, isRtl, 'total');
        const leastBranchOrders = calculateLeastBranchAnalytics(orderList, isRtl, 'total');
        const orderTrends = calculateTrends(orderList, 'createdAt', 'totalValue', 'totalOrders', startDate, endDate, language);
        setOrderAnalytics({
          branchOrders: branchOrders.map(b => ({ branchId: b.branchId, branchName: '', displayName: b.displayName, totalOrders: b.count, totalValue: b.total, averageOrderValue: b.average })),
          leastBranchOrders: leastBranchOrders.map(b => ({ branchId: b.branchId, branchName: '', displayName: b.displayName, totalOrders: b.count, totalValue: b.total, averageOrderValue: b.average })),
          orderTrends,
          totalOrders,
          totalValue,
          averageOrderValue,
        });
      } else if (type === 'returns') {
        response = await returnsAPI.getAll(params);
        const rawResponse = Array.isArray(response) ? response : response.returns || [];
        if (!Array.isArray(rawResponse)) {
          throw new Error(t.errors.invalid_data);
        }
        const returnList = rawResponse.map((ret: any) => ({
          _id: safeString(ret._id),
          returnNumber: safeString(ret.returnNumber, 'N/A'),
          date: safeString(ret.createdAt),
          total: safeNumber(ret.totalAmount || ret.items?.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0) || 0),
          status: safeString(ret.status, 'Unknown'),
          branchName: isRtl ? safeString(ret.branch?.name, 'Unknown') : safeString(ret.branch?.nameEn || ret.branch?.name, 'Unknown'),
          branch: ret.branch || {},
          totalAmount: safeNumber(ret.totalAmount || ret.items?.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0) || 0),
          createdAt: safeString(ret.createdAt),
        }));
        setReturns(returnList);
        const totalReturns = returnList.length;
        const totalValue = returnList.reduce((sum, r) => sum + r.total, 0);
        const averageReturnValue = totalReturns > 0 ? totalValue / totalReturns : 0;
        const branchReturns = calculateBranchAnalytics(returnList, isRtl, 'total');
        const leastBranchReturns = calculateLeastBranchAnalytics(returnList, isRtl, 'total');
        const returnTrends = calculateTrends(returnList, 'createdAt', 'totalValue', 'totalReturns', startDate, endDate, language);
        setReturnAnalytics({
          branchReturns: branchReturns.map(b => ({ branchId: b.branchId, branchName: '', displayName: b.displayName, totalReturns: b.count, totalValue: b.total, averageReturnValue: b.average })),
          leastBranchReturns: leastBranchReturns.map(b => ({ branchId: b.branchId, branchName: '', displayName: b.displayName, totalReturns: b.count, totalValue: b.total, averageReturnValue: b.average })),
          returnTrends,
          totalReturns,
          totalValue,
          averageReturnValue,
        });
      }
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] ${type} fetch error:`, { message: err.message, status: err.status, stack: err.stack });
      const errorMessage =
        err.status === 403 ? t.errors.unauthorized_access :
        err.status === 400 ? t.errors.invalid_dates :
        err.status === 0 ? t.errors.network_error :
        t.errors.fetch_analytics;
      setError(errorMessage);
      toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
      if (type === 'sales') {
        setAnalytics({
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
      } else if (type === 'orders') {
        setOrderAnalytics({
          branchOrders: [],
          leastBranchOrders: [],
          orderTrends: [],
          totalOrders: 0,
          totalValue: 0,
          averageOrderValue: 0,
        });
        setOrders([]);
      } else if (type === 'returns') {
        setReturnAnalytics({
          branchReturns: [],
          leastBranchReturns: [],
          returnTrends: [],
          totalReturns: 0,
          totalValue: 0,
          averageReturnValue: 0,
        });
        setReturns([]);
      }
    } finally {
      setLoading(false);
    }
  }, [user, t, isRtl, language, startDate, endDate, selectedBranch]);

  useEffect(() => {
    fetchData(activeTab);
  }, [fetchData, activeTab, selectedBranch, startDate, endDate]);

  const filteredData = useMemo(() => ({
    productSales: analytics.productSales.filter((ps) => ps.displayName.toLowerCase().includes(searchTerm)),
    leastProductSales: analytics.leastProductSales.filter((ps) => ps.displayName.toLowerCase().includes(searchTerm)),
    departmentSales: analytics.departmentSales.filter((ds) => ds.displayName.toLowerCase().includes(searchTerm)),
    leastDepartmentSales: analytics.leastDepartmentSales.filter((ds) => ds.displayName.toLowerCase().includes(searchTerm)),
    branchSales: analytics.branchSales.filter((bs) => bs.displayName.toLowerCase().includes(searchTerm)),
    leastBranchSales: analytics.leastBranchSales.filter((bs) => bs.displayName.toLowerCase().includes(searchTerm)),
    branchOrders: orderAnalytics.branchOrders.filter((bo) => bo.displayName.toLowerCase().includes(searchTerm)),
    leastBranchOrders: orderAnalytics.leastBranchOrders.filter((bo) => bo.displayName.toLowerCase().includes(searchTerm)),
    branchReturns: returnAnalytics.branchReturns.filter((br) => br.displayName.toLowerCase().includes(searchTerm)),
    leastBranchReturns: returnAnalytics.leastBranchReturns.filter((br) => br.displayName.toLowerCase().includes(searchTerm)),
    orders: orders.filter((order) => 
      order.branchName.toLowerCase().includes(searchTerm) || 
      order.orderNumber.toLowerCase().includes(searchTerm) ||
      order.status.toLowerCase().includes(searchTerm)
    ),
    returns: returns.filter((ret) => 
      ret.branchName.toLowerCase().includes(searchTerm) || 
      ret.returnNumber.toLowerCase().includes(searchTerm) ||
      ret.status.toLowerCase().includes(searchTerm)
    ),
  }), [analytics, orderAnalytics, returnAnalytics, orders, returns, searchTerm]);

  const branchOptions = useMemo(
    () => [
      { value: '', label: t.branchFilterPlaceholder },
      ...branches.map((b) => ({ value: b._id, label: b.displayName })),
    ],
    [branches, t]
  );

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: 'bottom' as const, 
        labels: { 
          font: { size: 12, family: 'Alexandria' }, 
          color: '#374151',
          padding: 16,
          usePointStyle: true,
          pointStyle: 'circle',
        } 
      },
      tooltip: { 
        bodyFont: { size: 12, family: 'Alexandria' }, 
        padding: 12, 
        backgroundColor: 'rgba(31, 41, 55, 0.95)',
        titleFont: { size: 14, family: 'Alexandria' },
        cornerRadius: 8,
        boxPadding: 6,
      },
      title: { 
        display: true, 
        font: { size: 14, family: 'Alexandria', weight: '600' }, 
        color: '#1F2937', 
        padding: { top: 16, bottom: 16 } 
      },
    },
    scales: {
      x: { 
        ticks: { 
          font: { size: 12, family: 'Alexandria' }, 
          color: '#4B5563', 
          maxRotation: isRtl ? -45 : 45, 
          autoSkip: true,
          padding: 8,
        }, 
        reverse: isRtl,
        grid: { display: false, drawBorder: false },
      },
      y: { 
        ticks: { 
          font: { size: 12, family: 'Alexandria' }, 
          color: '#4B5563',
          callback: (value: number) => value.toLocaleString(language),
          padding: 8,
        }, 
        beginAtZero: true,
        grid: { color: 'rgba(209, 213, 219, 0.5)', drawBorder: false },
      },
    },
    elements: {
      bar: { borderRadius: 6, borderWidth: 0 },
      line: { tension: 0.4, borderWidth: 3 },
      point: { radius: 4, hoverRadius: 6, hitRadius: 4 },
    },
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
  }), [isRtl, language]);

  const chartData = useMemo(() => {
    const createGradient = (ctx: CanvasRenderingContext2D, chartArea: any, start: string, end: string) => {
      const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
      gradient.addColorStop(0, start);
      gradient.addColorStop(1, end);
      return gradient;
    };

    return {
      productSales: {
        labels: filteredData.productSales.map((p) => p.displayName),
        datasets: [
          {
            label: `${t.totalSales} (${t.currency})`,
            data: filteredData.productSales.map((p) => safeNumber(p.totalRevenue)),
            backgroundColor: '#FBBF24',
            hoverBackgroundColor: '#F59E0B',
            barThickness: 'flex',
          },
        ],
      },
      leastProductSales: {
        labels: filteredData.leastProductSales.map((p) => p.displayName),
        datasets: [
          {
            label: `${t.totalSales} (${t.currency})`,
            data: filteredData.leastProductSales.map((p) => safeNumber(p.totalRevenue)),
            backgroundColor: '#3B82F6',
            hoverBackgroundColor: '#2563EB',
            barThickness: 'flex',
          },
        ],
      },
      departmentSales: {
        labels: filteredData.departmentSales.map((d) => d.displayName),
        datasets: [
          {
            label: `${t.totalSales} (${t.currency})`,
            data: filteredData.departmentSales.map((d) => safeNumber(d.totalRevenue)),
            backgroundColor: '#FF6384',
            hoverBackgroundColor: '#F43F5E',
            barThickness: 'flex',
          },
        ],
      },
      leastDepartmentSales: {
        labels: filteredData.leastDepartmentSales.map((d) => d.displayName),
        datasets: [
          {
            label: `${t.totalSales} (${t.currency})`,
            data: filteredData.leastDepartmentSales.map((d) => safeNumber(d.totalRevenue)),
            backgroundColor: '#4BC0C0',
            hoverBackgroundColor: '#2D9CDB',
            barThickness: 'flex',
          },
        ],
      },
      branchSales: {
        labels: filteredData.branchSales.map((b) => b.displayName),
        datasets: [
          {
            label: `${t.totalSales} (${t.currency})`,
            data: filteredData.branchSales.map((b) => safeNumber(b.totalSales)),
            backgroundColor: '#9966FF',
            hoverBackgroundColor: '#7C3AED',
            barThickness: 'flex',
          },
          {
            label: `${t.totalOrders}`,
            data: filteredData.branchSales.map((b) => safeNumber(b.totalOrders)),
            backgroundColor: '#36A2EB',
            hoverBackgroundColor: '#1D4ED8',
            barThickness: 'flex',
          },
          {
            label: `${t.totalReturns}`,
            data: filteredData.branchSales.map((b) => safeNumber(b.totalReturns)),
            backgroundColor: '#FF6384',
            hoverBackgroundColor: '#F43F5E',
            barThickness: 'flex',
          },
        ],
      },
      leastBranchSales: {
        labels: filteredData.leastBranchSales.map((b) => b.displayName),
        datasets: [
          {
            label: `${t.totalSales} (${t.currency})`,
            data: filteredData.leastBranchSales.map((b) => safeNumber(b.totalSales)),
            backgroundColor: '#FBBF24',
            hoverBackgroundColor: '#F59E0B',
            barThickness: 'flex',
          },
          {
            label: `${t.totalOrders}`,
            data: filteredData.leastBranchSales.map((b) => safeNumber(b.totalOrders)),
            backgroundColor: '#36A2EB',
            hoverBackgroundColor: '#1D4ED8',
            barThickness: 'flex',
          },
          {
            label: `${t.totalReturns}`,
            data: filteredData.leastBranchSales.map((b) => safeNumber(b.totalReturns)),
            backgroundColor: '#FF6384',
            hoverBackgroundColor: '#F43F5E',
            barThickness: 'flex',
          },
        ],
      },
      branchOrders: {
        labels: filteredData.branchOrders.map((b) => b.displayName),
        datasets: [
          {
            label: `${t.totalOrders}`,
            data: filteredData.branchOrders.map((b) => safeNumber(b.totalOrders)),
            backgroundColor: '#36A2EB',
            hoverBackgroundColor: '#1D4ED8',
            barThickness: 'flex',
          },
          {
            label: `${t.totalValue} (${t.currency})`,
            data: filteredData.branchOrders.map((b) => safeNumber(b.totalValue)),
            backgroundColor: '#9966FF',
            hoverBackgroundColor: '#7C3AED',
            barThickness: 'flex',
          },
        ],
      },
      leastBranchOrders: {
        labels: filteredData.leastBranchOrders.map((b) => b.displayName),
        datasets: [
          {
            label: `${t.totalOrders}`,
            data: filteredData.leastBranchOrders.map((b) => safeNumber(b.totalOrders)),
            backgroundColor: '#FBBF24',
            hoverBackgroundColor: '#F59E0B',
            barThickness: 'flex',
          },
          {
            label: `${t.totalValue} (${t.currency})`,
            data: filteredData.leastBranchOrders.map((b) => safeNumber(b.totalValue)),
            backgroundColor: '#36A2EB',
            hoverBackgroundColor: '#1D4ED8',
            barThickness: 'flex',
          },
        ],
      },
      branchReturns: {
        labels: filteredData.branchReturns.map((b) => b.displayName),
        datasets: [
          {
            label: `${t.totalReturns}`,
            data: filteredData.branchReturns.map((b) => safeNumber(b.totalReturns)),
            backgroundColor: '#FF6384',
            hoverBackgroundColor: '#F43F5E',
            barThickness: 'flex',
          },
          {
            label: `${t.totalValue} (${t.currency})`,
            data: filteredData.branchReturns.map((b) => safeNumber(b.totalValue)),
            backgroundColor: '#4BC0C0',
            hoverBackgroundColor: '#2D9CDB',
            barThickness: 'flex',
          },
        ],
      },
      leastBranchReturns: {
        labels: filteredData.leastBranchReturns.map((b) => b.displayName),
        datasets: [
          {
            label: `${t.totalReturns}`,
            data: filteredData.leastBranchReturns.map((b) => safeNumber(b.totalReturns)),
            backgroundColor: '#FBBF24',
            hoverBackgroundColor: '#F59E0B',
            barThickness: 'flex',
          },
          {
            label: `${t.totalValue} (${t.currency})`,
            data: filteredData.leastBranchReturns.map((b) => safeNumber(b.totalValue)),
            backgroundColor: '#36A2EB',
            hoverBackgroundColor: '#1D4ED8',
            barThickness: 'flex',
          },
        ],
      },
      salesTrends: {
        labels: analytics.salesTrends.map((trend) => trend.period),
        datasets: [
          {
            label: `${t.totalSales} (${t.currency})`,
            data: analytics.salesTrends.map((trend) => safeNumber(trend.totalSales)),
            borderColor: '#3B82F6',
            backgroundColor: (context: any) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return '#3B82F6';
              return createGradient(ctx, chartArea, 'rgba(59, 130, 246, 0.1)', 'rgba(59, 130, 246, 0.6)');
            },
            fill: true,
          },
          {
            label: `${t.totalCount}`,
            data: analytics.salesTrends.map((trend) => safeNumber(trend.saleCount)),
            borderColor: '#FF6384',
            backgroundColor: (context: any) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return 'rgba(255, 99, 132, 0.1)';
              return createGradient(ctx, chartArea, 'rgba(255, 99, 132, 0.1)', 'rgba(255, 99, 132, 0.6)');
            },
            fill: true,
          },
        ],
      },
      orderTrends: {
        labels: orderAnalytics.orderTrends.map((trend) => trend.period),
        datasets: [
          {
            label: `${t.totalOrders}`,
            data: orderAnalytics.orderTrends.map((trend) => safeNumber(trend.totalOrders)),
            borderColor: '#36A2EB',
            backgroundColor: (context: any) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return 'rgba(54, 162, 235, 0.1)';
              return createGradient(ctx, chartArea, 'rgba(54, 162, 235, 0.1)', 'rgba(54, 162, 235, 0.6)');
            },
            fill: true,
          },
          {
            label: `${t.totalValue} (${t.currency})`,
            data: orderAnalytics.orderTrends.map((trend) => safeNumber(trend.totalValue)),
            borderColor: '#9966FF',
            backgroundColor: (context: any) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return 'rgba(153, 102, 255, 0.1)';
              return createGradient(ctx, chartArea, 'rgba(153, 102, 255, 0.1)', 'rgba(153, 102, 255, 0.6)');
            },
            fill: true,
          },
        ],
      },
      returnTrends: {
        labels: returnAnalytics.returnTrends.map((trend) => trend.period),
        datasets: [
          {
            label: `${t.totalReturns}`,
            data: returnAnalytics.returnTrends.map((trend) => safeNumber(trend.totalReturns)),
            borderColor: '#FF6384',
            backgroundColor: (context: any) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return 'rgba(255, 99, 132, 0.1)';
              return createGradient(ctx, chartArea, 'rgba(255, 99, 132, 0.1)', 'rgba(255, 99, 132, 0.6)');
            },
            fill: true,
          },
          {
            label: `${t.totalValue} (${t.currency})`,
            data: returnAnalytics.returnTrends.map((trend) => safeNumber(trend.totalValue)),
            borderColor: '#4BC0C0',
            backgroundColor: (context: any) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return 'rgba(75, 192, 192, 0.1)';
              return createGradient(ctx, chartArea, 'rgba(75, 192, 192, 0.1)', 'rgba(75, 192, 192, 0.6)');
            },
            fill: true,
          },
        ],
      },
    };
  }, [filteredData, t, analytics, orderAnalytics, returnAnalytics]);

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 shadow-md">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <span className="text-sm text-red-600 font-alexandria">{t.errors.unauthorized_access}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50 font-alexandria" dir={isRtl ? 'rtl' : 'ltr'}>
      <link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <header className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BarChart2 className="w-6 h-6 text-amber-500" />
          <div>
            <h1 className="text-xl font-bold text-gray-800">{t.title}</h1>
            <p className="text-sm text-gray-500">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="flex-1 min-w-[200px]">
            <ProductSearchInput
              value={searchTerm}
              onChange={(e) => debouncedSearch(e.target.value)}
              placeholder={t.searchPlaceholder}
              ariaLabel={t.searchPlaceholder}
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <ProductDropdown
              value={selectedBranch}
              onChange={setSelectedBranch}
              options={branchOptions}
              ariaLabel={t.branchFilterPlaceholder}
            />
          </div>
          <div className="flex flex-row gap-4 flex-1 min-w-[320px]">
            <div className="flex-1">
              <label className="block text-sm text-gray-700 font-alexandria mb-1">{t.startDate}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full py-2.5 px-4 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm hover:shadow-md transition-all duration-300 font-alexandria"
                aria-label={t.startDate}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-700 font-alexandria mb-1">{t.endDate}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full py-2.5 px-4 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm hover:shadow-md transition-all duration-300 font-alexandria"
                aria-label={t.endDate}
              />
            </div>
          </div>
        </div>
      </header>
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 shadow-md"
        >
          <AlertCircle className="w-6 h-6 text-red-600" />
          <span className="text-sm text-red-600 font-alexandria">{error}</span>
        </motion.div>
      )}
      <div className="flex mb-6 border-b border-gray-200">
        {['sales', 'orders', 'returns'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as 'sales' | 'orders' | 'returns')}
            className={`py-3 px-5 text-sm font-medium ${activeTab === tab ? 'border-b-2 border-amber-500 text-amber-500' : 'text-gray-600 hover:text-amber-500'} transition-colors duration-200 font-alexandria`}
          >
            {t[`${tab}Tab`]}
          </button>
        ))}
      </div>
      {loading ? (
        <AnalyticsSkeleton />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {activeTab === 'sales' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100 flex flex-col">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">{t.totalSales}</h4>
                  <p className="text-2xl font-bold text-amber-500">{analytics.totalSales.toFixed(2)} {t.currency}</p>
                </div>
                <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100 flex flex-col">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">{t.totalCount}</h4>
                  <p className="text-2xl font-bold text-amber-500">{analytics.totalCount}</p>
                </div>
                <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100 flex flex-col">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">{t.averageOrderValue}</h4>
                  <p className="text-2xl font-bold text-amber-500">{analytics.averageOrderValue.toFixed(2)} {t.currency}</p>
                </div>
                <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100 flex flex-col">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">{t.topProduct}</h4>
                  <p className="text-lg font-bold text-amber-500 truncate">{analytics.topProduct.displayName || t.noData}</p>
                  <p className="text-sm text-gray-500">{t.totalSales}: {analytics.topProduct.totalRevenue.toFixed(2)} {t.currency}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.salesTrends}</h3>
                  {analytics.salesTrends.length > 0 ? (
                    <div className="relative h-64">
                      <Line data={chartData.salesTrends} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.salesTrends } } }} />
                    </div>
                  ) : (
                    <NoDataMessage message={t.noData} />
                  )}
                </div>
                <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.productSales}</h3>
                  {filteredData.productSales.length > 0 ? (
                    <div className="relative h-64">
                      <Bar data={chartData.productSales} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.productSales } } }} />
                    </div>
                  ) : (
                    <NoDataMessage message={t.noData} />
                  )}
                  <DataTable
                    title={t.productSales}
                    data={filteredData.productSales}
                    columns={[
                      { key: 'displayName', label: isRtl ? 'المنتج' : 'Product' },
                      { key: 'totalRevenue', label: t.totalSales },
                      { key: 'totalQuantity', label: t.totalCount },
                    ]}
                    isRtl={isRtl}
                    currency={t.currency}
                  />
                </div>
                <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.leastProductSales}</h3>
                  {filteredData.leastProductSales.length > 0 ? (
                    <div className="relative h-64">
                      <Bar data={chartData.leastProductSales} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.leastProductSales } } }} />
                    </div>
                  ) : (
                    <NoDataMessage message={t.noData} />
                  )}
                  <DataTable
                    title={t.leastProductSales}
                    data={filteredData.leastProductSales}
                    columns={[
                      { key: 'displayName', label: isRtl ? 'المنتج' : 'Product' },
                      { key: 'totalRevenue', label: t.totalSales },
                      { key: 'totalQuantity', label: t.totalCount },
                    ]}
                    isRtl={isRtl}
                    currency={t.currency}
                  />
                </div>
                <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.departmentSales}</h3>
                  {filteredData.departmentSales.length > 0 ? (
                    <div className="relative h-64">
                      <Bar data={chartData.departmentSales} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.departmentSales } } }} />
                    </div>
                  ) : (
                    <NoDataMessage message={t.noData} />
                  )}
                  <DataTable
                    title={t.departmentSales}
                    data={filteredData.departmentSales}
                    columns={[
                      { key: 'displayName', label: isRtl ? 'القسم' : 'Department' },
                      { key: 'totalRevenue', label: t.totalSales },
                      { key: 'totalQuantity', label: t.totalCount },
                    ]}
                    isRtl={isRtl}
                    currency={t.currency}
                  />
                </div>
                <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.leastDepartmentSales}</h3>
                  {filteredData.leastDepartmentSales.length > 0 ? (
                    <div className="relative h-64">
                      <Bar data={chartData.leastDepartmentSales} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.leastDepartmentSales } } }} />
                    </div>
                  ) : (
                    <NoDataMessage message={t.noData} />
                  )}
                  <DataTable
                    title={t.leastDepartmentSales}
                    data={filteredData.leastDepartmentSales}
                    columns={[
                      { key: 'displayName', label: isRtl ? 'القسم' : 'Department' },
                      { key: 'totalRevenue', label: t.totalSales },
                      { key: 'totalQuantity', label: t.totalCount },
                    ]}
                    isRtl={isRtl}
                    currency={t.currency}
                  />
                </div>
                <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.branchSales}</h3>
                  {filteredData.branchSales.length > 0 ? (
                    <div className="relative h-64">
                      <Bar data={chartData.branchSales} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.branchSales } } }} />
                    </div>
                  ) : (
                    <NoDataMessage message={t.noData} />
                  )}
                  <DataTable
                    title={t.branchSales}
                    data={filteredData.branchSales}
                    columns={[
                      { key: 'displayName', label: isRtl ? 'الفرع' : 'Branch' },
                      { key: 'totalSales', label: t.totalSales },
                      { key: 'saleCount', label: t.totalCount },
                      { key: 'totalOrders', label: t.totalOrders },
                      { key: 'totalReturns', label: t.totalReturns },
                      { key: 'averageOrderValue', label: t.averageOrderValue },
                    ]}
                    isRtl={isRtl}
                    currency={t.currency}
                  />
                </div>
                <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.leastBranchSales}</h3>
                  {filteredData.leastBranchSales.length > 0 ? (
                    <div className="relative h-64">
                      <Bar data={chartData.leastBranchSales} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.leastBranchSales } } }} />
                    </div>
                  ) : (
                    <NoDataMessage message={t.noData} />
                  )}
                  <DataTable
                    title={t.leastBranchSales}
                    data={filteredData.leastBranchSales}
                    columns={[
                      { key: 'displayName', label: isRtl ? 'الفرع' : 'Branch' },
                      { key: 'totalSales', label: t.totalSales },
                      { key: 'saleCount', label: t.totalCount },
                      { key: 'totalOrders', label: t.totalOrders },
                      { key: 'totalReturns', label: t.totalReturns },
                      { key: 'averageOrderValue', label: t.averageOrderValue },
                    ]}
                    isRtl={isRtl}
                    currency={t.currency}
                  />
                </div>
                <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.topCustomers}</h3>
                  <DataTable
                    title={t.topCustomers}
                    data={analytics.topCustomers}
                    columns={[
                      { key: 'customerName', label: isRtl ? 'اسم العميل' : 'Customer Name' },
                      { key: 'customerPhone', label: isRtl ? 'رقم الهاتف' : 'Phone' },
                      { key: 'totalSpent', label: t.totalSales },
                      { key: 'purchaseCount', label: isRtl ? 'عدد المشتريات' : 'Purchases' },
                    ]}
                    isRtl={isRtl}
                    currency={t.currency}
                  />
                </div>
              </div>
            </>
          )}
          {activeTab === 'orders' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100 flex flex-col">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">{t.totalOrders}</h4>
                  <p className="text-2xl font-bold text-amber-500">{orderAnalytics.totalOrders}</p>
                </div>
                <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100 flex flex-col">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">{t.totalValue}</h4>
                  <p className="text-2xl font-bold text-amber-500">{orderAnalytics.totalValue.toFixed(2)} {t.currency}</p>
                </div>
                <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100 flex flex-col">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">{t.averageOrderValue}</h4>
                  <p className="text-2xl font-bold text-amber-500">{orderAnalytics.averageOrderValue.toFixed(2)} {t.currency}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.orderTrends}</h3>
                  {orderAnalytics.orderTrends.length > 0 ? (
                    <div className="relative h-64">
                      <Line data={chartData.orderTrends} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.orderTrends } } }} />
                    </div>
                  ) : (
                    <NoDataMessage message={t.noData} />
                  )}
                </div>
                <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.branchOrders}</h3>
                  {filteredData.branchOrders.length > 0 ? (
                    <div className="relative h-64">
                      <Bar data={chartData.branchOrders} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.branchOrders } } }} />
                    </div>
                  ) : (
                    <NoDataMessage message={t.noData} />
                  )}
                  <DataTable
                    title={t.branchOrders}
                    data={filteredData.branchOrders}
                    columns={[
                      { key: 'displayName', label: isRtl ? 'الفرع' : 'Branch' },
                      { key: 'totalOrders', label: t.totalOrders },
                      { key: 'totalValue', label: t.totalValue },
                      { key: 'averageOrderValue', label: t.averageOrderValue },
                    ]}
                    isRtl={isRtl}
                    currency={t.currency}
                  />
                </div>
                <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.leastBranchOrders}</h3>
                  {filteredData.leastBranchOrders.length > 0 ? (
                    <div className="relative h-64">
                      <Bar data={chartData.leastBranchOrders} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.leastBranchOrders } } }} />
                    </div>
                  ) : (
                    <NoDataMessage message={t.noData} />
                  )}
                  <DataTable
                    title={t.leastBranchOrders}
                    data={filteredData.leastBranchOrders}
                    columns={[
                      { key: 'displayName', label: isRtl ? 'الفرع' : 'Branch' },
                      { key: 'totalOrders', label: t.totalOrders },
                      { key: 'totalValue', label: t.totalValue },
                      { key: 'averageOrderValue', label: t.averageOrderValue },
                    ]}
                    isRtl={isRtl}
                    currency={t.currency}
                  />
                </div>
                <div className="col-span-1 lg:col-span-2">
                  <OrdersTable orders={filteredData.orders} isRtl={isRtl} currency={t.currency} language={language} />
                </div>
              </div>
            </>
          )}
          {activeTab === 'returns' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100 flex flex-col">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">{t.totalReturns}</h4>
                  <p className="text-2xl font-bold text-amber-500">{returnAnalytics.totalReturns}</p>
                </div>
                <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100 flex flex-col">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">{t.totalValue}</h4>
                  <p className="text-2xl font-bold text-amber-500">{returnAnalytics.totalValue.toFixed(2)} {t.currency}</p>
                </div>
                <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100 flex flex-col">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">{t.averageReturnValue}</h4>
                  <p className="text-2xl font-bold text-amber-500">{returnAnalytics.averageReturnValue.toFixed(2)} {t.currency}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.returnTrends}</h3>
                  {returnAnalytics.returnTrends.length > 0 ? (
                    <div className="relative h-64">
                      <Line data={chartData.returnTrends} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.returnTrends } } }} />
                    </div>
                  ) : (
                    <NoDataMessage message={t.noData} />
                  )}
                </div>
                <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.branchReturns}</h3>
                  {filteredData.branchReturns.length > 0 ? (
                    <div className="relative h-64">
                      <Bar data={chartData.branchReturns} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.branchReturns } } }} />
                    </div>
                  ) : (
                    <NoDataMessage message={t.noData} />
                  )}
                  <DataTable
                    title={t.branchReturns}
                    data={filteredData.branchReturns}
                    columns={[
                      { key: 'displayName', label: isRtl ? 'الفرع' : 'Branch' },
                      { key: 'totalReturns', label: t.totalReturns },
                      { key: 'totalValue', label: t.totalValue },
                      { key: 'averageReturnValue', label: t.averageReturnValue },
                    ]}
                    isRtl={isRtl}
                    currency={t.currency}
                  />
                </div>
                <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.leastBranchReturns}</h3>
                  {filteredData.leastBranchReturns.length > 0 ? (
                    <div className="relative h-64">
                      <Bar data={chartData.leastBranchReturns} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.leastBranchReturns } } }} />
                    </div>
                  ) : (
                    <NoDataMessage message={t.noData} />
                  )}
                  <DataTable
                    title={t.leastBranchReturns}
                    data={filteredData.leastBranchReturns}
                    columns={[
                      { key: 'displayName', label: isRtl ? 'الفرع' : 'Branch' },
                      { key: 'totalReturns', label: t.totalReturns },
                      { key: 'totalValue', label: t.totalValue },
                      { key: 'averageReturnValue', label: t.averageReturnValue },
                    ]}
                    isRtl={isRtl}
                    currency={t.currency}
                  />
                </div>
                <div className="col-span-1 lg:col-span-2">
                  <ReturnsTable returns={filteredData.returns} isRtl={isRtl} currency={t.currency} language={language} />
                </div>
              </div>
            </>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default ReportsAnalytics;