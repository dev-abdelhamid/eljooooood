import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { salesAPI, ordersAPI, returnsAPI, branchesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, BarChart2, ChevronDown, Search, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { ProductDropdown , ProductSearchInput } from './OrdersTablePage';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { motion } from 'framer-motion';
import { debounce } from 'lodash';

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
    topProduct: 'المنتج الأكثر مبيعًا',
    productSales: 'مبيعات المنتجات',
    leastProductSales: 'أقل المنتجات مبيعًا',
    departmentSales: 'مبيعات الأقسام',
    leastDepartmentSales: 'أقل الأقسام مبيعًا',
    branchSales: 'مبيعات الفروع',
    leastBranchSales: 'أقل الفروع مبيعًا',
    salesTrends: 'اتجاهات المبيعات',
    topCustomers: 'أفضل العملاء',
    ordersTab: 'الطلبات',
    returnsTab: 'المرتجعات',
    salesTab: 'المبيعات',
    searchPlaceholder: 'ابحث عن منتجات، أقسام، أو فروع...',
    branchFilterPlaceholder: 'اختر فرعًا',
    noAnalytics: 'لا توجد إحصائيات متاحة',
    noData: 'لا توجد بيانات',
    noCustomers: 'لا توجد عملاء',
    noOrders: 'لا توجد طلبات',
    noReturns: 'لا توجد مرتجعات',
    startDate: 'تاريخ البدء',
    endDate: 'تاريخ الانتهاء',
    errors: {
      unauthorized_access: 'غير مصرح لك بالوصول',
      fetch_analytics: 'خطأ أثناء جلب الإحصائيات',
      network_error: 'خطأ في الاتصال بالشبكة',
      invalid_data: 'بيانات غير صالحة من الخادم',
      invalid_dates: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية',
      fetch_branches: 'خطأ أثناء جلب الفروع',
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
    topProduct: 'Top Selling Product',
    productSales: 'Product Sales',
    leastProductSales: 'Least Sold Products',
    departmentSales: 'Department Sales',
    leastDepartmentSales: 'Least Sold Departments',
    branchSales: 'Branch Sales',
    leastBranchSales: 'Least Sold Branches',
    salesTrends: 'Sales Trends',
    topCustomers: 'Top Customers',
    ordersTab: 'Orders',
    returnsTab: 'Returns',
    salesTab: 'Sales',
    searchPlaceholder: 'Search products, departments, or branches...',
    branchFilterPlaceholder: 'Select a branch',
    noAnalytics: 'No analytics available',
    noData: 'No data available',
    noCustomers: 'No customers',
    noOrders: 'No orders',
    noReturns: 'No returns',
    startDate: 'Start Date',
    endDate: 'End Date',
    errors: {
      unauthorized_access: 'You are not authorized to access',
      fetch_analytics: 'Error fetching analytics',
      network_error: 'Network connection error',
      invalid_data: 'Invalid data from server',
      invalid_dates: 'Start date must be before end date',
      fetch_branches: 'Error fetching branches',
    },
    currency: 'SAR',
  },
};

const safeNumber = (value: any, defaultValue: number = 0): number =>
  typeof value === 'number' && !isNaN(value) ? value : defaultValue;

const safeString = (value: any, defaultValue: string = ''): string =>
  typeof value === 'string' ? value : defaultValue;

const isValidDate = (date: string): boolean => !isNaN(new Date(date).getTime());

const AnalyticsSkeleton: React.FC = () => (
  <div className="space-y-6 animate-pulse">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(3)].map((_, index) => (
        <div key={index} className="p-6 bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
          <div className="h-7 bg-gray-200 rounded w-1/2" />
        </div>
      ))}
    </div>
    <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-100">
      <div className="h-5 bg-gray-200 rounded w-1/2 mb-3" />
      <div className="h-48 bg-gray-200 rounded" />
    </div>
  </div>
);

const NoDataMessage: React.FC<{ message: string }> = ({ message }) => (
  <p className="text-center text-gray-500 py-4 text-sm font-alexandria">{message}</p>
);

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





const DataTable: React.FC<{
  title: string;
  data: any[];
  columns: { key: string; label: string; width?: string }[];
  isRtl: boolean;
  currency?: string;
}> = React.memo(({ title, data, columns, isRtl, currency }) => (
  <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
    <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{title}</h3>
    {data.length > 0 ? (
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-max">
          <thead>
            <tr className="bg-gray-50">
              {columns.map((col) => (
                <th key={col.key} className={`p-2 ${isRtl ? 'text-right' : 'text-left'} ${col.width || ''} font-alexandria`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index} className="border-t">
                {columns.map((col) => (
                  <td key={col.key} className={`p-2 ${col.width || ''} font-alexandria`}>
                    {col.key === 'totalSales' || col.key === 'averageOrderValue' || col.key === 'totalRevenue' || col.key === 'total'
                      ? safeNumber(item[col.key]).toFixed(2) + (currency ? ` ${currency}` : '')
                      : safeNumber(item[col.key]) || item[col.key] || '-'}
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
}> = React.memo(({ orders, isRtl, currency }) => (
  <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
    <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{translations[isRtl ? 'ar' : 'en'].ordersTab}</h3>
    {orders.length > 0 ? (
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-max">
          <thead>
            <tr className="bg-gray-50">
              <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'} font-alexandria`}>{isRtl ? 'رقم الطلب' : 'Order Number'}</th>
              <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'} font-alexandria`}>{isRtl ? 'التاريخ' : 'Date'}</th>
              <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'} font-alexandria`}>{isRtl ? 'الإجمالي' : 'Total'}</th>
              <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'} font-alexandria`}>{isRtl ? 'الحالة' : 'Status'}</th>
              <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'} font-alexandria`}>{isRtl ? 'الفرع' : 'Branch'}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order._id} className="border-t">
                <td className="p-2 font-alexandria">{order.orderNumber}</td>
                <td className="p-2 font-alexandria">{formatDate(new Date(order.date), language)}</td>
                <td className="p-2 font-alexandria">{safeNumber(order.total).toFixed(2)} {currency}</td>
                <td className="p-2 font-alexandria">{order.status}</td>
                <td className="p-2 font-alexandria">{order.branchName}</td>
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
}> = React.memo(({ returns, isRtl, currency }) => (
  <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
    <h3 className="text-sm font-medium text-gray-700 mb-3 font-alexandria">{translations[isRtl ? 'ar' : 'en'].returnsTab}</h3>
    {returns.length > 0 ? (
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-max">
          <thead>
            <tr className="bg-gray-50">
              <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'} font-alexandria`}>{isRtl ? 'رقم المرتجع' : 'Return Number'}</th>
              <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'} font-alexandria`}>{isRtl ? 'التاريخ' : 'Date'}</th>
              <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'} font-alexandria`}>{isRtl ? 'الإجمالي' : 'Total'}</th>
              <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'} font-alexandria`}>{isRtl ? 'الحالة' : 'Status'}</th>
              <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'} font-alexandria`}>{isRtl ? 'الفرع' : 'Branch'}</th>
            </tr>
          </thead>
          <tbody>
            {returns.map((returnItem) => (
              <tr key={returnItem._id} className="border-t">
                <td className="p-2 font-alexandria">{returnItem.returnNumber}</td>
                <td className="p-2 font-alexandria">{formatDate(new Date(returnItem.date), language)}</td>
                <td className="p-2 font-alexandria">{safeNumber(returnItem.total).toFixed(2)} {currency}</td>
                <td className="p-2 font-alexandria">{returnItem.status}</td>
                <td className="p-2 font-alexandria">{returnItem.branchName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <NoDataMessage message={translations[isRtl ? 'ar' : 'en'].noReturns} />
    )}
  </div>
));  const fetchBranches = useCallback(async () => {
    try {
      const response = await branchesAPI.getAll();
      const branchesData = response.map((b: any) => ({
        _id: b._id,
        name: b.name,
        nameEn: b.nameEn,
        displayName: isRtl ? b.name : (b.nameEn || b.name),
      }));
      setBranches(branchesData);
    } catch (err) {
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
            period: formatDate(new Date(trend.period), language),
            totalSales: safeNumber(trend.totalSales),
            saleCount: safeNumber(trend.saleCount),
          })),
          topCustomers: (response.topCustomers || []).map((customer: any) => ({
            customerName: safeString(customer.customerName, t.noCustomers),
            customerPhone: safeString(customer.customerPhone, ''),
            totalSpent: safeNumber(customer.totalSpent),
            purchaseCount: safeNumber(customer.purchaseCount)
          }))
        });
      } else if (type === 'orders') {
        response = await ordersAPI.getAll(params);
        setOrders(response.orders ? response.orders.map((order: any) => ({
          _id: safeString(order._id),
          orderNumber: safeString(order.orderNumber),
          date: safeString(order.date),
          total: safeNumber(order.total),
          status: safeString(order.status),
          branchName: safeString(order.branchName, t.noData),
        })) : []);
      } else if (type === 'returns') {
        response = await returnsAPI.getAll(params);
        setReturns(response.returns ? response.returns.map((returnItem: any) => ({
          _id: safeString(returnItem._id),
          returnNumber: safeString(returnItem.returnNumber),
          date: safeString(returnItem.date),
          total: safeNumber(returnItem.total),
          status: safeString(returnItem.status),
          branchName: safeString(returnItem.branchName, t.noData),
        })) : []);
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
        setOrders([]);
      } else if (type === 'returns') {
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
    orders: orders.filter((order) => order.branchName.toLowerCase().includes(searchTerm) || order.orderNumber.toLowerCase().includes(searchTerm)),
    returns: returns.filter((ret) => ret.branchName.toLowerCase().includes(searchTerm) || ret.returnNumber.toLowerCase().includes(searchTerm)),
  }), [analytics, orders, returns, searchTerm]);

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
      legend: { position: 'bottom' as const, labels: { font: { size: 10, family: 'Alexandria' } } },
      tooltip: { bodyFont: { size: 10, family: 'Alexandria' }, padding: 8 },
      title: { display: true, font: { size: 12, family: 'Alexandria' }, padding: 10 },
    },
    scales: {
      x: { ticks: { font: { size: 9, family: 'Alexandria' }, maxRotation: isRtl ? -45 : 45, autoSkip: true }, reverse: isRtl },
      y: { ticks: { font: { size: 9, family: 'Alexandria' } }, beginAtZero: true },
    },
    elements: {
      bar: {
        barThickness: 15, // Narrower bars for branch charts
      },
    },
  }), [isRtl]);

  const chartData = useMemo(() => ({
    productSales: {
      labels: filteredData.productSales.slice(0, 5).map((p) => p.displayName),
      datasets: [
        {
          label: `${t.totalSales} (${t.currency})`,
          data: filteredData.productSales.slice(0, 5).map((p) => safeNumber(p.totalRevenue)),
          backgroundColor: '#FBBF24',
        },
      ],
    },
    leastProductSales: {
      labels: filteredData.leastProductSales.slice(0, 5).map((p) => p.displayName),
      datasets: [
        {
          label: `${t.totalSales} (${t.currency})`,
          data: filteredData.leastProductSales.slice(0, 5).map((p) => safeNumber(p.totalRevenue)),
          backgroundColor: '#3B82F6',
        },
      ],
    },
    departmentSales: {
      labels: filteredData.departmentSales.slice(0, 5).map((d) => d.displayName),
      datasets: [
        {
          label: `${t.totalSales} (${t.currency})`,
          data: filteredData.departmentSales.slice(0, 5).map((d) => safeNumber(d.totalRevenue)),
          backgroundColor: '#FF6384',
        },
      ],
    },
    leastDepartmentSales: {
      labels: filteredData.leastDepartmentSales.slice(0, 5).map((d) => d.displayName),
      datasets: [
        {
          label: `${t.totalSales} (${t.currency})`,
          data: filteredData.leastDepartmentSales.slice(0, 5).map((d) => safeNumber(d.totalRevenue)),
          backgroundColor: '#4BC0C0',
        },
      ],
    },
    branchSales: {
      labels: filteredData.branchSales.slice(0, 5).map((b) => b.displayName),
      datasets: [
        {
          label: `${t.totalSales} (${t.currency})`,
          data: filteredData.branchSales.slice(0, 5).map((b) => safeNumber(b.totalSales)),
          backgroundColor: '#9966FF',
          barThickness: 12,
        },
        {
          label: `${t.totalOrders}`,
          data: filteredData.branchSales.slice(0, 5).map((b) => safeNumber(b.totalOrders)),
          backgroundColor: '#36A2EB',
          barThickness: 12,
        },
        {
          label: `${t.totalReturns}`,
          data: filteredData.branchSales.slice(0, 5).map((b) => safeNumber(b.totalReturns)),
          backgroundColor: '#FF6384',
          barThickness: 12,
        },
      ],
    },
    leastBranchSales: {
      labels: filteredData.leastBranchSales.slice(0, 5).map((b) => b.displayName),
      datasets: [
        {
          label: `${t.totalSales} (${t.currency})`,
          data: filteredData.leastBranchSales.slice(0, 5).map((b) => safeNumber(b.totalSales)),
          backgroundColor: '#FBBF24',
          barThickness: 12,
        },
        {
          label: `${t.totalOrders}`,
          data: filteredData.leastBranchSales.slice(0, 5).map((b) => safeNumber(b.totalOrders)),
          backgroundColor: '#36A2EB',
          barThickness: 12,
        },
        {
          label: `${t.totalReturns}`,
          data: filteredData.leastBranchSales.slice(0, 5).map((b) => safeNumber(b.totalReturns)),
          backgroundColor: '#FF6384',
          barThickness: 12,
        },
      ],
    },
    salesTrends: {
      labels: analytics.salesTrends.slice(0, 10).map((trend) => trend.period),
      datasets: [
        {
          label: `${t.totalSales} (${t.currency})`,
          data: analytics.salesTrends.slice(0, 10).map((trend) => safeNumber(trend.totalSales)),
          borderColor: '#3B82F6',
          fill: false,
          tension: 0.4,
        },
        {
          label: `${t.totalCount}`,
          data: analytics.salesTrends.slice(0, 10).map((trend) => safeNumber(trend.saleCount)),
          borderColor: '#FF6384',
          fill: false,
          tension: 0.4,
        },
      ],
    },
  }), [filteredData, t, analytics]);

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm font-alexandria">{t.errors.unauthorized_access}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 font-alexandria" dir={isRtl ? 'rtl' : 'ltr'}>
      <link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600&display=swap" rel="stylesheet" />
      <header className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <BarChart2 className="w-6 h-6 text-amber-600" />
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">{t.title}</h1>
            <p className="text-sm text-gray-500">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
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
          <div className="flex gap-4">
            <div>
              <label className="block text-sm text-gray-700">{t.startDate}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent bg-white shadow-sm transition-all duration-300"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700">{t.endDate}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent bg-white shadow-sm transition-all duration-300"
              />
            </div>
          </div>
        </div>
      </header>
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-sm text-red-600">{error}</span>
        </div>
      )}
      <div className="flex mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('sales')}
          className={`py-3 px-6 text-sm font-medium ${activeTab === 'sales' ? 'border-b-2 border-amber-600 text-amber-600' : 'text-gray-600 hover:text-amber-600'} transition-colors`}
        >
          {t.salesTab}
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`py-3 px-6 text-sm font-medium ${activeTab === 'orders' ? 'border-b-2 border-amber-600 text-amber-600' : 'text-gray-600 hover:text-amber-600'} transition-colors`}
        >
          {t.ordersTab}
        </button>
        <button
          onClick={() => setActiveTab('returns')}
          className={`py-3 px-6 text-sm font-medium ${activeTab === 'returns' ? 'border-b-2 border-amber-600 text-amber-600' : 'text-gray-600 hover:text-amber-600'} transition-colors`}
        >
          {t.returnsTab}
        </button>
      </div>
      {loading ? (
        <AnalyticsSkeleton />
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeTab === 'sales' && (
            <>
              <div className="col-span-1 md:col-span-2 lg:col-span-3 p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3">{t.salesTrends}</h3>
                {analytics.salesTrends.length > 0 ? (
                  <div className="h-64">
                    <Line data={chartData.salesTrends} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: t.salesTrends } } }} />
                  </div>
                ) : (
                  <NoDataMessage message={t.noData} />
                )}
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3">{t.productSales}</h3>
                {filteredData.productSales.length > 0 ? (
                  <div className="h-64">
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
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3">{t.leastProductSales}</h3>
                {filteredData.leastProductSales.length > 0 ? (
                  <div className="h-64">
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
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3">{t.departmentSales}</h3>
                {filteredData.departmentSales.length > 0 ? (
                  <div className="h-64">
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
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3">{t.leastDepartmentSales}</h3>
                {filteredData.leastDepartmentSales.length > 0 ? (
                  <div className="h-64">
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
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3">{t.branchSales}</h3>
                {filteredData.branchSales.length > 0 ? (
                  <div className="h-64">
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
              <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3">{t.leastBranchSales}</h3>
                {filteredData.leastBranchSales.length > 0 ? (
                  <div className="h-64">
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
              <div className="col-span-1 md:col-span-2 lg:col-span-3 p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3">{t.topCustomers}</h3>
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
            </>
          )}
          {activeTab === 'orders' && (
            <div className="col-span-1 md:col-span-2 lg:col-span-3 p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <OrdersTable orders={filteredData.orders} isRtl={isRtl} currency={t.currency} language={language} />
            </div>
          )}
          {activeTab === 'returns' && (
            <div className="col-span-1 md:col-span-2 lg:col-span-3 p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <ReturnsTable returns={filteredData.returns} isRtl={isRtl} currency={t.currency} language={language} />
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default ReportsAnalytics;