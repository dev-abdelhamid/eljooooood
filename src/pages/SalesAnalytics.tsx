import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { salesAPI, ordersAPI, returnsAPI, branchesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, BarChart2, ChevronDown, Search, X, Download } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { debounce } from 'lodash';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

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
}

interface Return {
  _id: string;
  returnNumber: string;
  date: string;
  total: number;
  status: string;
  branchName: string;
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
        const value = col.key.includes('total') || col.key === 'averageOrderValue' || col.key === 'totalRevenue' || col.key === 'totalSpent' || col.key === 'totalQuantity' || col.key === 'saleCount' || col.key === 'totalOrders' || col.key === 'totalReturns' || col.key === 'totalValue' || col.key === 'averageReturnValue'
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
      {[...Array(4)].map((_, index) => (
        <div key={index} className="p-6 bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
          <div className="h-7 bg-gray-200 rounded w-1/2" />
        </div>
      ))}
    </div>
    <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-100">
      <div className="h-5 bg-gray-200 rounded w-1/2 mb-3" />
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
        className={`absolute inset-y-0 ${isRtl ? 'right-3' : 'left-3'} flex items-center text-gray-400 transition-colors group-focus-within:text-amber-600`}
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
        className={`w-full ${isRtl ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent bg-white shadow-sm hover:shadow-md placeholder-gray-400 transition-all duration-300 font-alexandria ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={ariaLabel}
      />
      {value && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          onClick={handleClear}
          className={`absolute inset-y-0 ${isRtl ? 'left-3' : 'right-3'} flex items-center text-gray-400 hover:text-amber-600 transition-colors focus:outline-none`}
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
        className={`w-full py-2.5 px-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent bg-white shadow-sm hover:shadow-md text-sm font-alexandria text-gray-700 flex justify-between items-center transition-all duration-300 ${isRtl ? 'text-right' : 'text-left'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
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
          className={`absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto font-alexandria ${isRtl ? 'text-right' : 'text-left'}`}
        >
          {options.map((option) => (
            <button
              key={option.value}
              dir={isRtl ? 'rtl' : 'ltr'}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-amber-100 hover:text-amber-600 transition-colors"
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
}> = React.memo(({ title, data, columns, isRtl, currency }) => (
  <div className="p-4 sm:p-6 bg-white rounded-lg shadow-sm border border-gray-100 mt-4">
    <div className="flex justify-between items-center mb-3">
      <h3 className="text-sm font-medium text-gray-700 font-alexandria">{title}</h3>
      {data.length > 0 && (
        <button
          onClick={() => exportToCSV(data, title, columns, isRtl, currency || '')}
          className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          {translations[isRtl ? 'ar' : 'en'].export}
        </button>
      )}
    </div>
    {data.length > 0 ? (
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-max">
          <thead>
            <tr className="bg-gray-50">
              {columns.map((col) => (
                <th key={col.key} className={`p-2 ${isRtl ? 'text-right' : 'text-left'} ${col.width || ''} font-alexandria font-medium text-gray-600`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index} className="border-t hover:bg-gray-50 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className={`p-2 ${col.width || ''} font-alexandria text-gray-700`}>
                    {col.key === 'totalSales' || col.key === 'averageOrderValue' || col.key === 'totalRevenue' || col.key === 'total' || col.key === 'totalSpent' || col.key === 'totalQuantity' || col.key === 'saleCount' || col.key === 'totalOrders' || col.key === 'totalReturns' || col.key === 'totalValue' || col.key === 'averageReturnValue'
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
}> = React.memo(({ orders, isRtl, currency, language }) => (
  <div className="p-4 sm:p-6 bg-white rounded-lg shadow-sm border border-gray-100">
    <div className="flex justify-between items-center mb-3">
      <h3 className="text-sm font-medium text-gray-700 font-alexandria">{translations[isRtl ? 'ar' : 'en'].ordersTab}</h3>
      {orders.length > 0 && (
        <button
          onClick={() => exportToCSV(orders, 'orders', [
            { key: 'orderNumber', label: isRtl ? 'رقم الطلب' : 'Order Number' },
            { key: 'date', label: isRtl ? 'التاريخ' : 'Date' },
            { key: 'total', label: isRtl ? 'الإجمالي' : 'Total' },
            { key: 'status', label: isRtl ? 'الحالة' : 'Status' },
            { key: 'branchName', label: isRtl ? 'الفرع' : 'Branch' },
          ], isRtl, currency)}
          className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          {translations[isRtl ? 'ar' : 'en'].export}
        </button>
      )}
    </div>
    {orders.length > 0 ? (
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-max">
          <thead>
            <tr className="bg-gray-50">
              <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'} font-alexandria font-medium text-gray-600`}>{isRtl ? 'رقم الطلب' : 'Order Number'}</th>
              <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'} font-alexandria font-medium text-gray-600`}>{isRtl ? 'التاريخ' : 'Date'}</th>
              <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'} font-alexandria font-medium text-gray-600`}>{isRtl ? 'الإجمالي' : 'Total'}</th>
              <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'} font-alexandria font-medium text-gray-600`}>{isRtl ? 'الحالة' : 'Status'}</th>
              <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'} font-alexandria font-medium text-gray-600`}>{isRtl ? 'الفرع' : 'Branch'}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order._id} className="border-t hover:bg-gray-50 transition-colors">
                <td className="p-2 font-alexandria text-gray-700">{safeString(order.orderNumber, 'N/A')}</td>
                <td className="p-2 font-alexandria text-gray-700">{formatDate(new Date(order.date), language)}</td>
                <td className="p-2 font-alexandria text-gray-700">{safeNumber(order.total).toFixed(2)} {currency}</td>
                <td className="p-2 font-alexandria text-gray-700">{safeString(order.status, 'Unknown')}</td>
                <td className="p-2 font-alexandria text-gray-700">{safeString(order.branchName, 'Unknown')}</td>
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
  returns: Return[];
  isRtl: boolean;
  currency: string;
  language: string;
}> = React.memo(({ returns, isRtl, currency, language }) => (
  <div className="p-4 sm:p-6 bg-white rounded-lg shadow-sm border border-gray-100">
    <div className="flex justify-between items-center mb-3">
      <h3 className="text-sm font-medium text-gray-700 font-alexandria">{translations[isRtl ? 'ar' : 'en'].returnsTab}</h3>
      {returns.length > 0 && (
        <button
          onClick={() => exportToCSV(returns, 'returns', [
            { key: 'returnNumber', label: isRtl ? 'رقم المرتجع' : 'Return Number' },
            { key: 'date', label: isRtl ? 'التاريخ' : 'Date' },
            { key: 'total', label: isRtl ? 'الإجمالي' : 'Total' },
            { key: 'status', label: isRtl ? 'الحالة' : 'Status' },
            { key: 'branchName', label: isRtl ? 'الفرع' : 'Branch' },
          ], isRtl, currency)}
          className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          {translations[isRtl ? 'ar' : 'en'].export}
        </button>
      )}
    </div>
    {returns.length > 0 ? (
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-max">
          <thead>
            <tr className="bg-gray-50">
              <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'} font-alexandria font-medium text-gray-600`}>{isRtl ? 'رقم المرتجع' : 'Return Number'}</th>
              <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'} font-alexandria font-medium text-gray-600`}>{isRtl ? 'التاريخ' : 'Date'}</th>
              <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'} font-alexandria font-medium text-gray-600`}>{isRtl ? 'الإجمالي' : 'Total'}</th>
              <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'} font-alexandria font-medium text-gray-600`}>{isRtl ? 'الحالة' : 'Status'}</th>
              <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'} font-alexandria font-medium text-gray-600`}>{isRtl ? 'الفرع' : 'Branch'}</th>
            </tr>
          </thead>
          <tbody>
            {returns.map((returnItem) => (
              <tr key={returnItem._id} className="border-t hover:bg-gray-50 transition-colors">
                <td className="p-2 font-alexandria text-gray-700">{safeString(returnItem.returnNumber, 'N/A')}</td>
                <td className="p-2 font-alexandria text-gray-700">{formatDate(new Date(returnItem.date), language)}</td>
                <td className="p-2 font-alexandria text-gray-700">{safeNumber(returnItem.total).toFixed(2)} {currency}</td>
                <td className="p-2 font-alexandria text-gray-700">{safeString(returnItem.status, 'Unknown')}</td>
                <td className="p-2 font-alexandria text-gray-700">{safeString(returnItem.branchName, 'Unknown')}</td>
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
  const [returns, setReturns] = useState<Return[]>([]);
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
      toast.error(t.errors.fetch_branches, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
    }
  }, [isRtl, t]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const fetchData = useCallback(async (type: 'sales' | 'orders' | 'returns') => {
    if (user?.role !== 'admin') {
      setError(t.errors.unauthorized_access);
      toast.error(t.errors.unauthorized_access, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
      setLoading(false);
      return;
    }

    if (!isValidDate(startDate) || !isValidDate(endDate) || new Date(startDate) > new Date(endDate)) {
      setError(t.errors.invalid_dates);
      toast.error(t.errors.invalid_dates, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params: any = {
        branch: selectedBranch,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        lang: language,
      };
      console.log(`[${new Date().toISOString()}] Fetching ${type} with params:`, params);
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
          })).sort((a, b) => b.totalSales - a.totalSales),
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
          })).sort((a, b) => a.totalSales - b.totalSales),
          productSales: (response.productSales || []).map((ps: any) => ({
            productId: safeString(ps.productId),
            productName: safeString(ps.productName),
            productNameEn: safeString(ps.productNameEn),
            displayName: isRtl ? safeString(ps.productName, 'منتج محذوف') : safeString(ps.productNameEn || ps.productName, 'Deleted Product'),
            totalQuantity: safeNumber(ps.totalQuantity),
            totalRevenue: safeNumber(ps.totalRevenue),
          })).sort((a, b) => b.totalRevenue - a.totalRevenue),
          leastProductSales: (response.leastProductSales || []).map((ps: any) => ({
            productId: safeString(ps.productId),
            productName: safeString(ps.productName),
            productNameEn: safeString(ps.productNameEn),
            displayName: isRtl ? safeString(ps.productName, 'منتج محذوف') : safeString(ps.productNameEn || ps.productName, 'Deleted Product'),
            totalQuantity: safeNumber(ps.totalQuantity),
            totalRevenue: safeNumber(ps.totalRevenue),
          })).sort((a, b) => a.totalRevenue - b.totalRevenue),
          departmentSales: (response.departmentSales || []).map((ds: any) => ({
            departmentId: safeString(ds.departmentId),
            departmentName: safeString(ds.departmentName),
            departmentNameEn: safeString(ds.departmentNameEn),
            displayName: isRtl ? safeString(ds.departmentName, 'قسم غير معروف') : safeString(ds.departmentNameEn || ds.departmentName, 'Unknown Department'),
            totalRevenue: safeNumber(ds.totalRevenue),
            totalQuantity: safeNumber(ds.totalQuantity),
          })).sort((a, b) => b.totalRevenue - a.totalRevenue),
          leastDepartmentSales: (response.leastDepartmentSales || []).map((ds: any) => ({
            departmentId: safeString(ds.departmentId),
            departmentName: safeString(ds.departmentName),
            departmentNameEn: safeString(ds.departmentNameEn),
            displayName: isRtl ? safeString(ds.departmentName, 'قسم غير معروف') : safeString(ds.departmentNameEn || ds.departmentName, 'Unknown Department'),
            totalRevenue: safeNumber(ds.totalRevenue),
            totalQuantity: safeNumber(ds.totalQuantity),
          })).sort((a, b) => a.totalRevenue - b.totalRevenue),
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
          })),
          topCustomers: (response.topCustomers || []).map((customer: any) => ({
            customerName: safeString(customer.customerName, t.noCustomers),
            customerPhone: safeString(customer.customerPhone, ''),
            totalSpent: safeNumber(customer.totalSpent),
            purchaseCount: safeNumber(customer.purchaseCount),
          })),
        });
      } else if (type === 'orders') {
        response = await ordersAPI.getAnalytics(params);
        if (!response || typeof response !== 'object') {
          throw new Error(t.errors.invalid_data);
        }
        setOrderAnalytics({
          branchOrders: (response.branchOrders || []).map((bo: any) => ({
            branchId: safeString(bo.branchId),
            branchName: safeString(bo.branchName),
            branchNameEn: safeString(bo.branchNameEn),
            displayName: isRtl ? safeString(bo.branchName, 'فرع غير معروف') : safeString(bo.branchNameEn || bo.branchName, 'Unknown Branch'),
            totalOrders: safeNumber(bo.totalOrders),
            totalValue: safeNumber(bo.totalValue),
            averageOrderValue: safeNumber(bo.averageOrderValue),
          })).sort((a, b) => b.totalOrders - a.totalOrders),
          leastBranchOrders: (response.leastBranchOrders || []).map((bo: any) => ({
            branchId: safeString(bo.branchId),
            branchName: safeString(bo.branchName),
            branchNameEn: safeString(bo.branchNameEn),
            displayName: isRtl ? safeString(bo.branchName, 'فرع غير معروف') : safeString(bo.branchNameEn || bo.branchName, 'Unknown Branch'),
            totalOrders: safeNumber(bo.totalOrders),
            totalValue: safeNumber(bo.totalValue),
            averageOrderValue: safeNumber(bo.averageOrderValue),
          })).sort((a, b) => a.totalOrders - b.totalOrders),
          orderTrends: (response.orderTrends || []).map((trend: any) => ({
            period: formatDate(new Date(safeString(trend.period)), language),
            totalOrders: safeNumber(trend.totalOrders),
            totalValue: safeNumber(trend.totalValue),
          })),
          totalOrders: safeNumber(response.totalOrders),
          totalValue: safeNumber(response.totalValue),
          averageOrderValue: safeNumber(response.averageOrderValue),
        });
        const orderResponse = await ordersAPI.getAll(params);
        if (!orderResponse || !Array.isArray(orderResponse.orders)) {
          throw new Error(t.errors.invalid_data);
        }
        setOrders(orderResponse.orders.map((order: any) => ({
          _id: safeString(order._id),
          orderNumber: safeString(order.orderNumber, 'N/A'),
          date: safeString(order.date),
          total: safeNumber(order.total),
          status: safeString(order.status, 'Unknown'),
          branchName: safeString(order.branchName, t.noData),
        })));
      } else if (type === 'returns') {
        response = await returnsAPI.getAnalytics(params);
        if (!response || typeof response !== 'object') {
          throw new Error(t.errors.invalid_data);
        }
        setReturnAnalytics({
          branchReturns: (response.branchReturns || []).map((br: any) => ({
            branchId: safeString(br.branchId),
            branchName: safeString(br.branchName),
            branchNameEn: safeString(br.branchNameEn),
            displayName: isRtl ? safeString(br.branchName, 'فرع غير معروف') : safeString(br.branchNameEn || br.branchName, 'Unknown Branch'),
            totalReturns: safeNumber(br.totalReturns),
            totalValue: safeNumber(br.totalValue),
            averageReturnValue: safeNumber(br.averageReturnValue),
          })).sort((a, b) => b.totalReturns - a.totalReturns),
          leastBranchReturns: (response.leastBranchReturns || []).map((br: any) => ({
            branchId: safeString(br.branchId),
            branchName: safeString(br.branchName),
            branchNameEn: safeString(br.branchNameEn),
            displayName: isRtl ? safeString(br.branchName, 'فرع غير معروف') : safeString(br.branchNameEn || br.branchName, 'Unknown Branch'),
            totalReturns: safeNumber(br.totalReturns),
            totalValue: safeNumber(br.totalValue),
            averageReturnValue: safeNumber(br.averageReturnValue),
          })).sort((a, b) => a.totalReturns - b.totalReturns),
          returnTrends: (response.returnTrends || []).map((trend: any) => ({
            period: formatDate(new Date(safeString(trend.period)), language),
            totalReturns: safeNumber(trend.totalReturns),
            totalValue: safeNumber(trend.totalValue),
          })),
          totalReturns: safeNumber(response.totalReturns),
          totalValue: safeNumber(response.totalValue),
          averageReturnValue: safeNumber(response.averageReturnValue),
        });
        const returnResponse = await returnsAPI.getAll(params);
        if (!returnResponse || !Array.isArray(returnResponse.returns)) {
          throw new Error(t.errors.invalid_data);
        }
        setReturns(returnResponse.returns.map((returnItem: any) => ({
          _id: safeString(returnItem._id),
          returnNumber: safeString(returnItem.returnNumber, 'N/A'),
          date: safeString(returnItem.date),
          total: safeNumber(returnItem.total),
          status: safeString(returnItem.status, 'Unknown'),
          branchName: safeString(returnItem.branchName, t.noData),
        })));
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
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
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
          color: '#4B5563',
          padding: 15,
          usePointStyle: true,
        } 
      },
      tooltip: { 
        bodyFont: { size: 12, family: 'Alexandria' }, 
        padding: 10, 
        backgroundColor: 'rgba(31, 41, 55, 0.9)',
        titleFont: { size: 14, family: 'Alexandria' },
        cornerRadius: 6,
      },
      title: { 
        display: true, 
        font: { size: 16, family: 'Alexandria' }, 
        color: '#1F2937', 
        padding: { top: 12, bottom: 12 } 
      },
    },
    scales: {
      x: { 
        ticks: { 
          font: { size: 11, family: 'Alexandria' }, 
          color: '#4B5563', 
          maxRotation: isRtl ? -45 : 45, 
          autoSkip: true 
        }, 
        reverse: isRtl,
        grid: { display: false },
      },
      y: { 
        ticks: { 
          font: { size: 11, family: 'Alexandria' }, 
          color: '#4B5563',
          callback: (value: number) => value.toLocaleString(language),
        }, 
        beginAtZero: true,
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
      },
    },
    elements: {
      bar: { borderRadius: 4 },
      line: { tension: 0.4 },
    },
  }), [isRtl, language]);

  const chartData = useMemo(() => {
    const createGradient = (ctx: CanvasRenderingContext2D, chartArea: any) => {
      const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
      gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
      gradient.addColorStop(1, 'rgba(59, 130, 246, 0.8)');
      return gradient;
    };

    return {
      productSales: {
        labels: filteredData.productSales.slice(0, 6).map((p) => p.displayName),
        datasets: [
          {
            label: `${t.totalSales} (${t.currency})`,
            data: filteredData.productSales.slice(0, 6).map((p) => safeNumber(p.totalRevenue)),
            backgroundColor: '#FBBF24',
            hoverBackgroundColor: '#F59E0B',
            borderRadius: 4,
          },
        ],
      },
      leastProductSales: {
        labels: filteredData.leastProductSales.slice(0, 6).map((p) => p.displayName),
        datasets: [
          {
            label: `${t.totalSales} (${t.currency})`,
            data: filteredData.leastProductSales.slice(0, 6).map((p) => safeNumber(p.totalRevenue)),
            backgroundColor: '#3B82F6',
            hoverBackgroundColor: '#2563EB',
            borderRadius: 4,
          },
        ],
      },
      departmentSales: {
        labels: filteredData.departmentSales.slice(0, 6).map((d) => d.displayName),
        datasets: [
          {
            label: `${t.totalSales} (${t.currency})`,
            data: filteredData.departmentSales.slice(0, 6).map((d) => safeNumber(d.totalRevenue)),
            backgroundColor: '#FF6384',
            hoverBackgroundColor: '#F43F5E',
            borderRadius: 4,
          },
        ],
      },
      leastDepartmentSales: {
        labels: filteredData.leastDepartmentSales.slice(0, 6).map((d) => d.displayName),
        datasets: [
          {
            label: `${t.totalSales} (${t.currency})`,
            data: filteredData.leastDepartmentSales.slice(0, 6).map((d) => safeNumber(d.totalRevenue)),
            backgroundColor: '#4BC0C0',
            hoverBackgroundColor: '#2D9CDB',
            borderRadius: 4,
          },
        ],
      },
      branchSales: {
        labels: filteredData.branchSales.slice(0, 6).map((b) => b.displayName),
        datasets: [
          {
            label: `${t.totalSales} (${t.currency})`,
            data: filteredData.branchSales.slice(0, 6).map((b) => safeNumber(b.totalSales)),
            backgroundColor: '#9966FF',
            hoverBackgroundColor: '#7C3AED',
            barThickness: 10,
          },
          {
            label: `${t.totalOrders}`,
            data: filteredData.branchSales.slice(0, 6).map((b) => safeNumber(b.totalOrders)),
            backgroundColor: '#36A2EB',
            hoverBackgroundColor: '#1D4ED8',
            barThickness: 10,
          },
          {
            label: `${t.totalReturns}`,
            data: filteredData.branchSales.slice(0, 6).map((b) => safeNumber(b.totalReturns)),
            backgroundColor: '#FF6384',
            hoverBackgroundColor: '#F43F5E',
            barThickness: 10,
          },
        ],
      },
      leastBranchSales: {
        labels: filteredData.leastBranchSales.slice(0, 6).map((b) => b.displayName),
        datasets: [
          {
            label: `${t.totalSales} (${t.currency})`,
            data: filteredData.leastBranchSales.slice(0, 6).map((b) => safeNumber(b.totalSales)),
            backgroundColor: '#FBBF24',
            hoverBackgroundColor: '#F59E0B',
            barThickness: 10,
          },
          {
            label: `${t.totalOrders}`,
            data: filteredData.leastBranchSales.slice(0, 6).map((b) => safeNumber(b.totalOrders)),
            backgroundColor: '#36A2EB',
            hoverBackgroundColor: '#1D4ED8',
            barThickness: 10,
          },
          {
            label: `${t.totalReturns}`,
            data: filteredData.leastBranchSales.slice(0, 6).map((b) => safeNumber(b.totalReturns)),
            backgroundColor: '#FF6384',
            hoverBackgroundColor: '#F43F5E',
            barThickness: 10,
          },
        ],
      },
      branchOrders: {
        labels: filteredData.branchOrders.slice(0, 6).map((b) => b.displayName),
        datasets: [
          {
            label: `${t.totalOrders}`,
            data: filteredData.branchOrders.slice(0, 6).map((b) => safeNumber(b.totalOrders)),
            backgroundColor: '#36A2EB',
            hoverBackgroundColor: '#1D4ED8',
            barThickness: 10,
          },
          {
            label: `${t.totalValue} (${t.currency})`,
            data: filteredData.branchOrders.slice(0, 6).map((b) => safeNumber(b.totalValue)),
            backgroundColor: '#9966FF',
            hoverBackgroundColor: '#7C3AED',
            barThickness: 10,
          },
        ],
      },
      leastBranchOrders: {
        labels: filteredData.leastBranchOrders.slice(0, 6).map((b) => b.displayName),
        datasets: [
          {
            label: `${t.totalOrders}`,
            data: filteredData.leastBranchOrders.slice(0, 6).map((b) => safeNumber(b.totalOrders)),
            backgroundColor: '#FBBF24',
            hoverBackgroundColor: '#F59E0B',
            barThickness: 10,
          },
          {
            label: `${t.totalValue} (${t.currency})`,
            data: filteredData.leastBranchOrders.slice(0, 6).map((b) => safeNumber(b.totalValue)),
            backgroundColor: '#36A2EB',
            hoverBackgroundColor: '#1D4ED8',
            barThickness: 10,
          },
        ],
      },
      branchReturns: {
        labels: filteredData.branchReturns.slice(0, 6).map((b) => b.displayName),
        datasets: [
          {
            label: `${t.totalReturns}`,
            data: filteredData.branchReturns.slice(0, 6).map((b) => safeNumber(b.totalReturns)),
            backgroundColor: '#FF6384',
            hoverBackgroundColor: '#F43F5E',
            barThickness: 10,
          },
          {
            label: `${t.totalValue} (${t.currency})`,
            data: filteredData.branchReturns.slice(0, 6).map((b) => safeNumber(b.totalValue)),
            backgroundColor: '#4BC0C0',
            hoverBackgroundColor: '#2D9CDB',
            barThickness: 10,
          },
        ],
      },
      leastBranchReturns: {
        labels: filteredData.leastBranchReturns.slice(0, 6).map((b) => b.displayName),
        datasets: [
          {
            label: `${t.totalReturns}`,
            data: filteredData.leastBranchReturns.slice(0, 6).map((b) => safeNumber(b.totalReturns)),
            backgroundColor: '#FBBF24',
            hoverBackgroundColor: '#F59E0B',
            barThickness: 10,
          },
          {
            label: `${t.totalValue} (${t.currency})`,
            data: filteredData.leastBranchReturns.slice(0, 6).map((b) => safeNumber(b.totalValue)),
            backgroundColor: '#36A2EB',
            hoverBackgroundColor: '#1D4ED8',
            barThickness: 10,
          },
        ],
      },
      salesTrends: {
        labels: analytics.salesTrends.slice(0, 12).map((trend) => trend.period),
        datasets: [
          {
            label: `${t.totalSales} (${t.currency})`,
            data: analytics.salesTrends.slice(0, 12).map((trend) => safeNumber(trend.totalSales)),
            borderColor: '#3B82F6',
            backgroundColor: (context: any) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return '#3B82F6';
              return createGradient(ctx, chartArea);
            },
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          {
            label: `${t.totalCount}`,
            data: analytics.salesTrends.slice(0, 12).map((trend) => safeNumber(trend.saleCount)),
            borderColor: '#FF6384',
            backgroundColor: (context: any) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return 'rgba(255, 99, 132, 0.1)';
              const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
              gradient.addColorStop(0, 'rgba(255, 99, 132, 0.2)');
              gradient.addColorStop(1, 'rgba(255, 99, 132, 0.8)');
              return gradient;
            },
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      orderTrends: {
        labels: orderAnalytics.orderTrends.slice(0, 12).map((trend) => trend.period),
        datasets: [
          {
            label: `${t.totalOrders}`,
            data: orderAnalytics.orderTrends.slice(0, 12).map((trend) => safeNumber(trend.totalOrders)),
            borderColor: '#36A2EB',
            backgroundColor: (context: any) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return 'rgba(54, 162, 235, 0.1)';
              const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
              gradient.addColorStop(0, 'rgba(54, 162, 235, 0.2)');
              gradient.addColorStop(1, 'rgba(54, 162, 235, 0.8)');
              return gradient;
            },
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          {
            label: `${t.totalValue} (${t.currency})`,
            data: orderAnalytics.orderTrends.slice(0, 12).map((trend) => safeNumber(trend.totalValue)),
            borderColor: '#9966FF',
            backgroundColor: (context: any) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return 'rgba(153, 102, 255, 0.1)';
              const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
              gradient.addColorStop(0, 'rgba(153, 102, 255, 0.2)');
              gradient.addColorStop(1, 'rgba(153, 102, 255, 0.8)');
              return gradient;
            },
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      returnTrends: {
        labels: returnAnalytics.returnTrends.slice(0, 12).map((trend) => trend.period),
        datasets: [
          {
            label: `${t.totalReturns}`,
            data: returnAnalytics.returnTrends.slice(0, 12).map((trend) => safeNumber(trend.totalReturns)),
            borderColor: '#FF6384',
            backgroundColor: (context: any) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return 'rgba(255, 99, 132, 0.1)';
              const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
              gradient.addColorStop(0, 'rgba(255, 99, 132, 0.2)');
              gradient.addColorStop(1, 'rgba(255, 99, 132, 0.8)');
              return gradient;
            },
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          {
            label: `${t.totalValue} (${t.currency})`,
            data: returnAnalytics.returnTrends.slice(0, 12).map((trend) => safeNumber(trend.totalValue)),
            borderColor: '#4BC0C0',
            backgroundColor: (context: any) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return 'rgba(75, 192, 192, 0.1)';
              const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
              gradient.addColorStop(0, 'rgba(75, 192, 192, 0.2)');
              gradient.addColorStop(1, 'rgba(75, 192, 192, 0.8)');
              return gradient;
            },
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
    };
  }, [filteredData, t, analytics, orderAnalytics, returnAnalytics]);

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gray-50">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm font-alexandria">{t.errors.unauthorized_access}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 font-alexandria bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
      <link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <header className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <BarChart2 className="w-6 h-6 text-amber-600" />
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">{t.title}</h1>
            <p className="text-sm text-gray-500">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-center">
          <ProductSearchInput
            value={searchTerm}
            onChange={(e) => debouncedSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            ariaLabel={t.searchPlaceholder}
            className="w-full sm:w-64"
          />
          <ProductDropdown
            value={selectedBranch}
            onChange={setSelectedBranch}
            options={branchOptions}
            ariaLabel={t.branchFilterPlaceholder}
            className="w-full sm:w-48"
          />
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
            <div>
              <label className="block text-sm text-gray-700 font-alexandria">{t.startDate}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent bg-white shadow-sm hover:shadow-md transition-all duration-300 font-alexandria"
                aria-label={t.startDate}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 font-alexandria">{t.endDate}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent bg-white shadow-sm hover:shadow-md transition-all duration-300 font-alexandria"
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
          className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2"
        >
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-sm text-red-600 font-alexandria">{error}</span>
        </motion.div>
      )}
      <div className="flex mb-6 border-b border-gray-200">
        {['sales', 'orders', 'returns'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as 'sales' | 'orders' | 'returns')}
            className={`py-3 px-4 sm:px-6 text-sm font-medium ${activeTab === tab ? 'border-b-2 border-amber-600 text-amber-600' : 'text-gray-600 hover:text-amber-600'} transition-colors duration-200 font-alexandria`}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="col-span-1 sm:col-span-2 p-4 sm:p-6 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.salesTrends}</h3>
                {analytics.salesTrends.length > 0 ? (
                  <div className="h-64 sm:h-80">
                    <Line data={chartData.salesTrends} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.salesTrends } } }} />
                  </div>
                ) : (
                  <NoDataMessage message={t.noData} />
                )}
              </div>
              <div className="p-4 sm:p-6 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.productSales}</h3>
                {filteredData.productSales.length > 0 ? (
                  <div className="h-64 sm:h-72">
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
                    { key: 'totalRevenue', label: t.totalSales, width: 'w-1/4' },
                    { key: 'totalQuantity', label: t.totalCount, width: 'w-1/4' },
                  ]}
                  isRtl={isRtl}
                  currency={t.currency}
                />
              </div>
              <div className="p-4 sm:p-6 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.leastProductSales}</h3>
                {filteredData.leastProductSales.length > 0 ? (
                  <div className="h-64 sm:h-72">
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
                    { key: 'totalRevenue', label: t.totalSales, width: 'w-1/4' },
                    { key: 'totalQuantity', label: t.totalCount, width: 'w-1/4' },
                  ]}
                  isRtl={isRtl}
                  currency={t.currency}
                />
              </div>
              <div className="p-4 sm:p-6 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.departmentSales}</h3>
                {filteredData.departmentSales.length > 0 ? (
                              <div className="h-64 sm:h-72">
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
                    { key: 'totalRevenue', label: t.totalSales, width: 'w-1/4' },
                    { key: 'totalQuantity', label: t.totalCount, width: 'w-1/4' },
                  ]}
                  isRtl={isRtl}
                  currency={t.currency}
                />
              </div>
              <div className="p-4 sm:p-6 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.leastDepartmentSales}</h3>
                {filteredData.leastDepartmentSales.length > 0 ? (
                  <div className="h-64 sm:h-72">
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
                    { key: 'totalRevenue', label: t.totalSales, width: 'w-1/4' },
                    { key: 'totalQuantity', label: t.totalCount, width: 'w-1/4' },
                  ]}
                  isRtl={isRtl}
                  currency={t.currency}
                />
              </div>
              <div className="p-4 sm:p-6 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.branchSales}</h3>
                {filteredData.branchSales.length > 0 ? (
                  <div className="h-64 sm:h-72">
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
                    { key: 'totalSales', label: t.totalSales, width: 'w-1/5' },
                    { key: 'saleCount', label: t.totalCount, width: 'w-1/5' },
                    { key: 'averageOrderValue', label: t.averageOrderValue, width: 'w-1/5' },
                    { key: 'totalOrders', label: t.totalOrders, width: 'w-1/5' },
                    { key: 'totalReturns', label: t.totalReturns, width: 'w-1/5' },
                  ]}
                  isRtl={isRtl}
                  currency={t.currency}
                />
              </div>
              <div className="p-4 sm:p-6 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.leastBranchSales}</h3>
                {filteredData.leastBranchSales.length > 0 ? (
                  <div className="h-64 sm:h-72">
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
                    { key: 'totalSales', label: t.totalSales, width: 'w-1/5' },
                    { key: 'saleCount', label: t.totalCount, width: 'w-1/5' },
                    { key: 'averageOrderValue', label: t.averageOrderValue, width: 'w-1/5' },
                    { key: 'totalOrders', label: t.totalOrders, width: 'w-1/5' },
                    { key: 'totalReturns', label: t.totalReturns, width: 'w-1/5' },
                  ]}
                  isRtl={isRtl}
                  currency={t.currency}
                />
              </div>
              <div className="col-span-1 sm:col-span-2 p-4 sm:p-6 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.topCustomers}</h3>
                {analytics.topCustomers.length > 0 ? (
                  <DataTable
                    title={t.topCustomers}
                    data={analytics.topCustomers}
                    columns={[
                      { key: 'customerName', label: isRtl ? 'اسم العميل' : 'Customer Name' },
                      { key: 'customerPhone', label: isRtl ? 'رقم الهاتف' : 'Phone' },
                      { key: 'totalSpent', label: isRtl ? 'الإنفاق الإجمالي' : 'Total Spent', width: 'w-1/4' },
                      { key: 'purchaseCount', label: isRtl ? 'عدد الشراءات' : 'Purchases', width: 'w-1/4' },
                    ]}
                    isRtl={isRtl}
                    currency={t.currency}
                  />
                ) : (
                  <NoDataMessage message={t.noCustomers} />
                )}
              </div>
            </div>
          )}
          {activeTab === 'orders' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="col-span-1 sm:col-span-2 p-4 sm:p-6 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.orderTrends}</h3>
                {orderAnalytics.orderTrends.length > 0 ? (
                  <div className="h-64 sm:h-80">
                    <Line data={chartData.orderTrends} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.orderTrends } } }} />
                  </div>
                ) : (
                  <NoDataMessage message={t.noData} />
                )}
              </div>
              <div className="p-4 sm:p-6 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.branchOrders}</h3>
                {filteredData.branchOrders.length > 0 ? (
                  <div className="h-64 sm:h-72">
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
                    { key: 'totalOrders', label: t.totalOrders, width: 'w-1/4' },
                    { key: 'totalValue', label: t.totalValue, width: 'w-1/4' },
                    { key: 'averageOrderValue', label: t.averageOrderValue, width: 'w-1/4' },
                  ]}
                  isRtl={isRtl}
                  currency={t.currency}
                />
              </div>
              <div className="p-4 sm:p-6 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.leastBranchOrders}</h3>
                {filteredData.leastBranchOrders.length > 0 ? (
                  <div className="h-64 sm:h-72">
                    <Bar data={chartData.leastBranchOrders} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.leastBranchOrders } } }} />
                  </div>
                ) : (
                  <NoDataMessage message={t.noData} />
                )}
                <DataTable
                  title={t.leastBranchOrders}
                  data={filteredData.leastBranchOrders}
                  columns=[
                    { key: 'displayName', label: isRtl ? 'الفرع' : 'Branch' },
                    { key: 'totalOrders', label: t.totalOrders, width: 'w-1/4' },
                    { key: 'totalValue', label: t.totalValue, width: 'w-1/4' },
                    { key: 'averageOrderValue', label: t.averageOrderValue, width: 'w-1/4' },
                  ]
                  isRtl={isRtl}
                  currency={t.currency}
                />
              </div>
              <div className="col-span-1 sm:col-span-2 p-4 sm:p-6 bg-white rounded-lg shadow-sm border border-gray-100">
                <OrdersTable orders={filteredData.orders} isRtl={isRtl} currency={t.currency} language={language} />
              </div>
            </div>
          )}
          {activeTab === 'returns' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="col-span-1 sm:col-span-2 p-4 sm:p-6 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.returnTrends}</h3>
                {returnAnalytics.returnTrends.length > 0 ? (
                  <div className="h-64 sm:h-80">
                    <Line data={chartData.returnTrends} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.returnTrends } } }} />
                  </div>
                ) : (
                  <NoDataMessage message={t.noData} />
                )}
              </div>
              <div className="p-4 sm:p-6 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.branchReturns}</h3>
                {filteredData.branchReturns.length > 0 ? (
                  <div className="h-64 sm:h-72">
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
                    { key: 'totalReturns', label: t.totalReturns, width: 'w-1/4' },
                    { key: 'totalValue', label: t.totalValue, width: 'w-1/4' },
                    { key: 'averageReturnValue', label: t.averageReturnValue, width: 'w-1/4' },
                  ]}
                  isRtl={isRtl}
                  currency={t.currency}
                />
              </div>
              <div className="p-4 sm:p-6 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{t.leastBranchReturns}</h3>
                {filteredData.leastBranchReturns.length > 0 ? (
                  <div className="h-64 sm:h-72">
                    <Bar data={chartData.leastBranchReturns} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.leastBranchReturns } } }} />
                  </div>
                ) : (
                  <NoDataMessage message={t.noData} />
                )}
                <DataTable
                  title={t.leastBranchReturns}
                  data={filteredData.leastBranchReturns}
                  columns=[
                    { key: 'displayName', label: isRtl ? 'الفرع' : 'Branch' },
                    { key: 'totalReturns', label: t.totalReturns, width: 'w-1/4' },
                    { key: 'totalValue', label: t.totalValue, width: 'w-1/4' },
                    { key: 'averageReturnValue', label: t.averageReturnValue, width: 'w-1/4' },
                  ]
                  isRtl={isRtl}
                  currency={t.currency}
                />
              </div>
              <div className="col-span-1 sm:col-span-2 p-4 sm:p-6 bg-white rounded-lg shadow-sm border border-gray-100">
                <ReturnsTable returns={filteredData.returns} isRtl={isRtl} currency={t.currency} language={language} />
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default ReportsAnalytics;