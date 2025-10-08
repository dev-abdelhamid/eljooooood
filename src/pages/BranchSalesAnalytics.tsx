import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import { AlertCircle, Search, X, ChevronDown } from 'lucide-react';
import { formatDate } from '../utils/formatDate';

// Interfaces
interface SalesApiError {
  message: string;
  status?: number;
}

interface Branch {
  _id: string;
  name: string;
  nameEn?: string;
  displayName: string;
}

interface SalesTrend {
  period: string;
  totalSales: number;
  saleCount: number;
}

interface AnalyticsData {
  totalSales: number;
  totalCount: number;
  averageOrderValue: string;
  returnRate?: string;
  topProduct: {
    productId: string | null;
    productName: string;
    displayName: string;
    totalQuantity: number;
    totalRevenue: number;
  };
  branchSales?: Array<{
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
  salesTrends: SalesTrend[];
  topCustomers: Array<{
    customerName: string;
    customerPhone: string;
    totalSpent: number;
    purchaseCount: number;
  }>;
  returnStats?: Array<{
    status: string;
    count: number;
    totalQuantity: number;
  }>;
}

interface SaleData {
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  branch: string;
  notes?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  customerName?: string;
  customerPhone?: string;
}

interface AnalyticsParams {
  branch?: string;
  startDate?: string;
  endDate?: string;
}

// Translations
const translations = {
  ar: {
    title: 'إحصائيات الفروع',
    subtitle: 'تحليل أداء المبيعات حسب الفروع',
    branchFilter: 'اختر فرعًا',
    allBranches: 'جميع الفروع',
    searchPlaceholder: 'ابحث عن الفروع أو المنتجات...',
    filterBy: 'تصفية حسب',
    all: 'الكل',
    day: 'اليوم',
    week: 'الأسبوع',
    month: 'الشهر',
    custom: 'مخصص',
    salesTrends: 'اتجاهات المبيعات',
    totalSales: 'إجمالي المبيعات',
    totalOrders: 'عدد الطلبات',
    averageOrderValue: 'متوسط قيمة الطلب',
    returnRate: 'معدل الإرجاع',
    topProduct: 'أفضل منتج',
    topCustomers: 'أفضل العملاء',
    productSales: 'مبيعات المنتجات',
    departmentSales: 'مبيعات الأقسام',
    leastProductSales: 'أقل المنتجات مبيعًا',
    leastDepartmentSales: 'أقل الأقسام مبيعًا',
    quantity: 'الكمية',
    errors: {
      unauthorized_access: 'غير مصرح لك بالوصول',
      fetch_analytics: 'خطأ أثناء جلب الإحصائيات',
      fetch_branches: 'خطأ أثناء جلب الفروع',
      no_analytics: 'لا توجد إحصائيات متاحة',
    },
    currency: 'ريال',
  },
  en: {
    title: 'Branch Analytics',
    subtitle: 'Analyze sales performance by branch',
    branchFilter: 'Select Branch',
    allBranches: 'All Branches',
    searchPlaceholder: 'Search branches or products...',
    filterBy: 'Filter By',
    all: 'All',
    day: 'Day',
    week: 'Week',
    month: 'Month',
    custom: 'Custom',
    salesTrends: 'Sales Trends',
    totalSales: 'Total Sales',
    totalOrders: 'Total Orders',
    averageOrderValue: 'Average Order Value',
    returnRate: 'Return Rate',
    topProduct: 'Top Product',
    topCustomers: 'Top Customers',
    productSales: 'Product Sales',
    departmentSales: 'Department Sales',
    leastProductSales: 'Least Sold Products',
    leastDepartmentSales: 'Least Sold Departments',
    quantity: 'Quantity',
    errors: {
      unauthorized_access: 'You are not authorized to access',
      fetch_analytics: 'Error fetching analytics',
      fetch_branches: 'Error fetching branches',
      no_analytics: 'No analytics available',
    },
    currency: 'SAR',
  },
};

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';
const isRtl = localStorage.getItem('language') === 'ar';

const salesAxios = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Error Handling
const handleError = async (error: AxiosError, originalRequest: AxiosRequestConfig): Promise<never> => {
  const errorDetails = {
    url: error.config?.url,
    method: error.config?.method,
    status: error.response?.status,
    data: error.response?.data,
    message: error.message,
  };
  console.error(`[${new Date().toISOString()}] Sales API response error:`, errorDetails);
  let message = (error.response?.data as any)?.message || (isRtl ? 'خطأ غير متوقع' : 'Unexpected error');
  switch (error.response?.status) {
    case 400:
      message = (error.response?.data as any)?.message || (isRtl ? 'بيانات غير صالحة' : 'Invalid data');
      break;
    case 403:
      message = (error.response?.data as any)?.message || (isRtl ? 'عملية غير مصرح بها' : 'Unauthorized operation');
      break;
    case 404:
      message = (error.response?.data as any)?.message || (isRtl ? 'المبيعة غير موجودة' : 'Sale not found');
      break;
    case 429:
      message = isRtl ? 'طلبات كثيرة جدًا، حاول مرة أخرى لاحقًا' : 'Too many requests, try again later';
      break;
    default:
      if (!navigator.onLine) {
        message = isRtl ? 'لا يوجد اتصال بالإنترنت' : 'No internet connection';
      }
  }
  if (error.response?.status === 401 && !originalRequest._retry) {
    originalRequest._retry = true;
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        console.error(`[${new Date().toISOString()}] No refresh token available`);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        toast.error(isRtl ? 'التوكن منتهي الصلاحية، يرجى تسجيل الدخول مجددًا' : 'Token expired, please log in again', {
          position: isRtl ? 'top-right' : 'top-left',
          autoClose: 3000,
        });
        throw new Error(isRtl ? 'التوكن منتهي الصلاحية ولا يوجد توكن منعش' : 'Token expired and no refresh token available');
      }
      const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken });
      const { accessToken, refreshToken: newRefreshToken } = response.data;
      localStorage.setItem('token', accessToken);
      if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken);
      console.log(`[${new Date().toISOString()}] Token refreshed successfully`);
      originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${accessToken}` };
      return salesAxios(originalRequest);
    } catch (refreshError) {
      console.error(`[${new Date().toISOString()}] Refresh token failed:`, refreshError);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
      toast.error(isRtl ? 'فشل تجديد التوكن، يرجى تسجيل الدخول مجددًا' : 'Failed to refresh token, please log in again', {
        position: isRtl ? 'top-right' : 'top-left',
        autoClose: 3000,
      });
      throw new Error(isRtl ? 'فشل تجديد التوكن' : 'Failed to refresh token');
    }
  }
  toast.error(message, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
  throw { message, status: error.response?.status } as SalesApiError;
};

// Interceptors
salesAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    const language = localStorage.getItem('language') || 'en';
    config.params = { ...config.params, lang: language };
    console.log(`[${new Date().toISOString()}] Sales API request:`, {
      url: config.url,
      method: config.method,
      headers: config.headers,
      params: config.params,
    });
    return config;
  },
  (error) => {
    console.error(`[${new Date().toISOString()}] Sales API request error:`, error);
    return Promise.reject(error);
  }
);

salesAxios.interceptors.response.use(
  (response) => {
    if (!response.data) {
      console.error(`[${new Date().toISOString()}] Empty response data:`, response);
      throw new Error(isRtl ? 'استجابة فارغة من الخادم' : 'Empty response from server');
    }
    return response.data;
  },
  (error) => handleError(error, error.config)
);

// Validation Functions
const isValidObjectId = (id: string): boolean => /^[0-9a-fA-F]{24}$/.test(id);
const isValidPhone = (phone: string | undefined): boolean => !phone || /^\+?\d{7,15}$/.test(phone);
const isValidPaymentMethod = (method: string | undefined): boolean => !method || ['cash', 'credit_card', 'bank_transfer'].includes(method);
const isValidPaymentStatus = (status: string | undefined): boolean => !status || ['pending', 'completed', 'canceled'].includes(status);

// Sales API
export const salesAPI = {
  create: async (saleData: SaleData) => {
    console.log(`[${new Date().toISOString()}] salesAPI.create - Sending:`, saleData);
    if (!isValidObjectId(saleData.branch)) {
      console.error(`[${new Date().toISOString()}] salesAPI.create - Invalid branch ID:`, saleData.branch);
      throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
    }
    if (!saleData.items?.length || saleData.items.some((item) => !isValidObjectId(item.productId) || item.quantity < 1 || item.unitPrice < 0)) {
      console.error(`[${new Date().toISOString()}] salesAPI.create - Invalid items:`, saleData.items);
      throw new Error(isRtl ? 'بيانات المنتجات غير صالحة' : 'Invalid product data');
    }
    if (!isValidPhone(saleData.customerPhone)) {
      console.error(`[${new Date().toISOString()}] salesAPI.create - Invalid customer phone:`, saleData.customerPhone);
      throw new Error(isRtl ? 'رقم هاتف العميل غير صالح' : 'Invalid customer phone');
    }
    if (!isValidPaymentMethod(saleData.paymentMethod)) {
      console.error(`[${new Date().toISOString()}] salesAPI.create - Invalid payment method:`, saleData.paymentMethod);
      throw new Error(isRtl ? 'طريقة الدفع غير صالحة' : 'Invalid payment method');
    }
    if (!isValidPaymentStatus(saleData.paymentStatus)) {
      console.error(`[${new Date().toISOString()}] salesAPI.create - Invalid payment status:`, saleData.paymentStatus);
      throw new Error(isRtl ? Ascending
      const response = await salesAxios.post('/sales', saleData);
      console.log(`[${new Date().toISOString()}] salesAPI.create - Success:`, response);
      return response;
    },
    getAll: async (params: {
      page?: number;
      limit?: number;
      sort?: string;
      branch?: string;
      startDate?: string;
      endDate?: string;
    }) => {
      console.log(`[${new Date().toISOString()}] salesAPI.getAll - Sending:`, params);
      if (params.branch && !isValidObjectId(params.branch)) {
        console.error(`[${new Date().toISOString()}] salesAPI.getAll - Invalid branch ID:`, params.branch);
        throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
      }
      if (params.startDate && isNaN(new Date(params.startDate).getTime())) {
        console.error(`[${new Date().toISOString()}] salesAPI.getAll - Invalid start date:`, params.startDate);
        throw new Error(isRtl ? 'تاريخ البدء غير صالح' : 'Invalid start date');
      }
      if (params.endDate && isNaN(new Date(params.endDate).getTime())) {
        console.error(`[${new Date().toISOString()}] salesAPI.getAll - Invalid end date:`, params.endDate);
        throw new Error(isRtl ? 'تاريخ الانتهاء غير صالح' : 'Invalid end date');
      }
      const response = await salesAxios.get('/sales', { params });
      console.log(`[${new Date().toISOString()}] salesAPI.getAll - Success:`, {
        total: response.total,
        salesCount: response.sales?.length,
      });
      return response;
    },
    getById: async (id: string) => {
      console.log(`[${new Date().toISOString()}] salesAPI.getById - Sending:`, { id });
      if (!isValidObjectId(id)) {
        console.error(`[${new Date().toISOString()}] salesAPI.getById - Invalid sale ID:`, id);
        throw new Error(isRtl ? 'معرف المبيعة غير صالح' : 'Invalid sale ID');
      }
      const response = await salesAxios.get(`/sales/${id}`);
      console.log(`[${new Date().toISOString()}] salesAPI.getById - Success:`, response);
      return response.sale;
    },
    delete: async (id: string) => {
      console.log(`[${new Date().toISOString()}] salesAPI.delete - Sending:`, { id });
      if (!isValidObjectId(id)) {
        console.error(`[${new Date().toISOString()}] salesAPI.delete - Invalid sale ID:`, id);
        throw new Error(isRtl ? 'معرف المبيعة غير صالح' : 'Invalid sale ID');
      }
      const response = await salesAxios.delete(`/sales/${id}`);
      console.log(`[${new Date().toISOString()}] salesAPI.delete - Success:`, response);
      return response;
    },
    getAnalytics: async (params: AnalyticsParams) => {
      console.log(`[${new Date().toISOString()}] salesAPI.getAnalytics - Sending:`, params);
      if (params.branch && !isValidObjectId(params.branch)) {
        console.error(`[${new Date().toISOString()}] salesAPI.getAnalytics - Invalid branch ID:`, params.branch);
        throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
      }
      if (params.startDate && isNaN(new Date(params.startDate).getTime())) {
        console.error(`[${new Date().toISOString()}] salesAPI.getAnalytics - Invalid start date:`, params.startDate);
        throw new Error(isRtl ? 'تاريخ البدء غير صالح' : 'Invalid start date');
      }
      if (params.endDate && isNaN(new Date(params.endDate).getTime())) {
        console.error(`[${new Date().toISOString()}] salesAPI.getAnalytics - Invalid end date:`, params.endDate);
        throw new Error(isRtl ? 'تاريخ الانتهاء غير صالح' : 'Invalid end date');
      }
      const response = await salesAxios.get('/sales/analytics', { params });
      console.log(`[${new Date().toISOString()}] salesAPI.getAnalytics - Success:`, {
        totalSales: response.totalSales,
        totalCount: response.totalCount,
      });
      return response;
    },
    getBranchStats: async (params: AnalyticsParams) => {
      console.log(`[${new Date().toISOString()}] salesAPI.getBranchStats - Sending:`, params);
      if (params.branch && !isValidObjectId(params.branch)) {
        console.error(`[${new Date().toISOString()}] salesAPI.getBranchStats - Invalid branch ID:`, params.branch);
        throw new Error(isRtl ? 'معرف الفرع غير صالح' : 'Invalid branch ID');
      }
      if (params.startDate && isNaN(new Date(params.startDate).getTime())) {
        console.error(`[${new Date().toISOString()}] salesAPI.getBranchStats - Invalid start date:`, params.startDate);
        throw new Error(isRtl ? 'تاريخ البدء غير صالح' : 'Invalid start date');
      }
      if (params.endDate && isNaN(new Date(params.endDate).getTime())) {
        console.error(`[${new Date().toISOString()}] salesAPI.getBranchStats - Invalid end date:`, params.endDate);
        throw new Error(isRtl ? 'تاريخ الانتهاء غير صالح' : 'Invalid end date');
      }
      const response = await salesAxios.get('/sales/branch-stats', { params });
      console.log(`[${new Date().toISOString()}] salesAPI.getBranchStats - Success:`, {
        totalSales: response.totalSales,
        totalCount: response.totalCount,
      });
      return response;
    },

// Utility Function
const safeNumber = (value: any, defaultValue: number = 0): number => {
  return typeof value === 'number' && !isNaN(value) ? value : defaultValue;
};

// Search Input Component
const SearchInput = React.memo<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  ariaLabel: string;
}>(({ value, onChange, placeholder, ariaLabel }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="relative group">
      <Search
        className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors group-focus-within:text-amber-500 ${value ? 'opacity-0' : 'opacity-100'}`}
      />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full ${isRtl ? 'pl-12 pr-4' : 'pr-12 pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm placeholder-gray-400 font-alexandria`}
        aria-label={ariaLabel}
      />
      {value && (
        <button
          onClick={() => onChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>)}
          className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-gray-400 hover:text-amber-500 transition-colors`}
          aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
});

// Dropdown Component
const ProductDropdown = React.memo<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
  disabled?: boolean;
}>(({ value, onChange, options, ariaLabel, disabled = false }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((opt) => opt.value === value) || options[0] || { value: '', label: isRtl ? 'اختر' : 'Select' };
  return (
    <div className="relative group">
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

// Branch Filter Component
const BranchFilter = React.memo<{
  branches: Branch[];
  selectedBranch: string;
  onChange: (value: string) => void;
  placeholder: string;
  allBranchesLabel: string;
  disabled?: boolean;
}>(({ branches, selectedBranch, onChange, placeholder, allBranchesLabel, disabled = false }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="relative group">
      <select
        value={selectedBranch}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm font-alexandria ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={placeholder}
        disabled={disabled}
      >
        <option value="">{allBranchesLabel}</option>
        {branches.map((branch) => (
          <option key={branch._id} value={branch._id}>
            {branch.displayName}
          </option>
        ))}
      </select>
      <ChevronDown
        className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 group-focus-within:text-amber-500 ${disabled ? 'opacity-50' : ''}`}
      />
    </div>
  );
});

// Main Component
export const BranchSalesAnalytics: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterBranch, setFilterBranch] = useState(user?.role === 'branch' && user?.branchId ? user.branchId : '');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Debounced Search
  const debouncedSearch = useCallback(debounce((value: string) => setSearchTerm(value.trim()), 300), []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSearch(value);
  };

  // Date Calculation
  useEffect(() => {
    const today = new Date();
    let newStartDate = '';
    let newEndDate = today.toISOString().split('T')[0];
    if (filterPeriod === 'day') {
      newStartDate = newEndDate;
    } else if (filterPeriod === 'week') {
      const firstDayOfWeek = new Date(today);
      firstDayOfWeek.setDate(today.getDate() - today.getDay() + 1);
      newStartDate = firstDayOfWeek.toISOString().split('T')[0];
    } else if (filterPeriod === 'month') {
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      newStartDate = firstDayOfMonth.toISOString().split('T')[0];
    } else if (filterPeriod === 'custom') {
      return;
    } else {
      newStartDate = '';
      newEndDate = '';
    }
    setFilterStartDate(newStartDate);
    setFilterEndDate(newEndDate);
  }, [filterPeriod]);

  // Fetch Branches
  const fetchBranches = useCallback(async () => {
    if (user?.role !== 'admin') return;
    try {
      const response = await branchesAPI.getAll();
      console.log(`[${new Date().toISOString()}] Fetch branches:`, response);
      setBranches(
        response.map((branch: any) => ({
          _id: branch._id,
          name: branch.name || 'غير معروف',
          nameEn: branch.nameEn,
          displayName: isRtl ? (branch.name || 'غير معروف') : (branch.nameEn || branch.name || 'Unknown'),
        }))
      );
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Error fetching branches:`, { message: err.message, stack: err.stack });
      setError(t.errors.fetch_branches);
      toast.error(t.errors.fetch_branches, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
    }
  }, [user, isRtl, t]);

  // Fetch Analytics
  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params: AnalyticsParams = { lang: language };
      if (filterPeriod !== 'all' && filterStartDate && filterEndDate) {
        params.startDate = filterStartDate;
        params.endDate = filterEndDate;
      }
      if (filterBranch) {
        params.branch = filterBranch;
      }
      const apiMethod = user?.role === 'branch' ? salesAPI.getBranchStats : salesAPI.getAnalytics;
      const response = await apiMethod(params);
      console.log(`[${new Date().toISOString()}] Fetch analytics:`, response);
      setAnalytics({
        totalSales: safeNumber(response.totalSales),
        totalCount: safeNumber(response.totalCount),
        averageOrderValue: response.averageOrderValue || '0.00',
        returnRate: response.returnRate || '0.00',
        topProduct: response.topProduct || {
          productId: null,
          productName: 'غير معروف',
          displayName: isRtl ? 'غير معروف' : 'Unknown',
          totalQuantity: 0,
          totalRevenue: 0,
        },
        branchSales: (response.branchSales || []).map((bs: any) => ({
          branchId: bs.branchId,
          branchName: bs.branchName || 'غير معروف',
          branchNameEn: bs.branchNameEn,
          displayName: isRtl ? (bs.branchName || 'غير معروف') : (bs.branchNameEn || bs.branchName || 'Unknown'),
          totalSales: safeNumber(bs.totalSales),
          saleCount: safeNumber(bs.saleCount),
        })),
        productSales: (response.productSales || []).map((ps: any) => ({
          productId: ps.productId,
          productName: ps.productName || 'غير معروف',
          productNameEn: ps.productNameEn,
          displayName: isRtl ? (ps.productName || 'غير معروف') : (ps.productNameEn || ps.productName || 'Unknown'),
          totalQuantity: safeNumber(ps.totalQuantity),
          totalRevenue: safeNumber(ps.totalRevenue),
        })),
        leastProductSales: (response.leastProductSales || []).map((ps: any) => ({
          productId: ps.productId,
          productName: ps.productName || 'غير معروف',
          productNameEn: ps.productNameEn,
          displayName: isRtl ? (ps.productName || 'غير معروف') : (ps.productNameEn || ps.productName || 'Unknown'),
          totalQuantity: safeNumber(ps.totalQuantity),
          totalRevenue: safeNumber(ps.totalRevenue),
        })),
        departmentSales: (response.departmentSales || []).map((ds: any) => ({
          departmentId: ds.departmentId,
          departmentName: ds.departmentName || 'غير معروف',
          departmentNameEn: ds.departmentNameEn,
          displayName: isRtl ? (ds.departmentName || 'غير معروف') : (ds.departmentNameEn || ds.departmentName || 'Unknown'),
          totalRevenue: safeNumber(ds.totalRevenue),
          totalQuantity: safeNumber(ds.totalQuantity),
        })),
        leastDepartmentSales: (response.leastDepartmentSales || []).map((ds: any) => ({
          departmentId: ds.departmentId,
          departmentName: ds.departmentName || 'غير معروف',
          departmentNameEn: ds.departmentNameEn,
          displayName: isRtl ? (ds.departmentName || 'غير معروف') : (ds.departmentNameEn || ds.departmentName || 'Unknown'),
          totalRevenue: safeNumber(ds.totalRevenue),
          totalQuantity: safeNumber(ds.totalQuantity),
        })),
        salesTrends: (response.salesTrends || []).map((trend: any) => ({
          period: formatDate(new Date(trend.period), language),
          totalSales: safeNumber(trend.totalSales),
          saleCount: safeNumber(trend.saleCount),
        })),
        topCustomers: (response.topCustomers || []).map((tc: any) => ({
          customerName: tc.customerName || 'غير معروف',
          customerPhone: tc.customerPhone || '',
          totalSpent: safeNumber(tc.totalSpent),
          purchaseCount: safeNumber(tc.purchaseCount),
        })),
        returnStats: (response.returnStats || []).map((rs: any) => ({
          status: rs.status || 'unknown',
          count: safeNumber(rs.count),
          totalQuantity: safeNumber(rs.totalQuantity),
        })),
      });
      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Error fetching analytics:`, { message: err.message, stack: err.stack });
      setError(t.errors.fetch_analytics);
      toast.error(t.errors.fetch_analytics, { position: isRtl ? 'top-right' : 'top-left', autoClose: 3000 });
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [user, language, isRtl, t, filterPeriod, filterStartDate, filterEndDate, filterBranch]);

  // Initial Data Fetch
  useEffect(() => {
    if (user?.role === 'admin') {
      fetchBranches();
    }
    fetchAnalytics();
  }, [fetchBranches, fetchAnalytics]);

  // Filtered Data
  const filteredBranchSales = useMemo(
    () =>
      analytics?.branchSales?.filter((bs) => {
        const term = searchTerm.toLowerCase();
        return bs.displayName.toLowerCase().includes(term);
      }) || [],
    [analytics, searchTerm]
  );

  const filteredProductSales = useMemo(
    () =>
      analytics?.productSales.filter((ps) => {
        const term = searchTerm.toLowerCase();
        return ps.displayName.toLowerCase().includes(term);
      }) || [],
    [analytics, searchTerm]
  );

  const filteredLeastProductSales = useMemo(
    () =>
      analytics?.leastProductSales.filter((ps) => {
        const term = searchTerm.toLowerCase();
        return ps.displayName.toLowerCase().includes(term);
      }) || [],
    [analytics, searchTerm]
  );

  const filteredDepartmentSales = useMemo(
    () =>
      analytics?.departmentSales.filter((ds) => {
        const term = searchTerm.toLowerCase();
        return ds.displayName.toLowerCase().includes(term);
      }) || [],
    [analytics, searchTerm]
  );

  const filteredLeastDepartmentSales = useMemo(
    () =>
      analytics?.leastDepartmentSales.filter((ds) => {
        const term = searchTerm.toLowerCase();
        return ds.displayName.toLowerCase().includes(term);
      }) || [],
    [analytics, searchTerm]
  );

  // Period Options
  const periodOptions = useMemo(
    () => [
      { value: 'all', label: t.all },
      { value: 'day', label: t.day },
      { value: 'week', label: t.week },
      { value: 'month', label: t.month },
      { value: 'custom', label: t.custom },
    ],
    [t]
  );

  // Sales Trends Chart
  const salesTrendsChart = analytics?.salesTrends && analytics.salesTrends.length > 0 ? (
    ```chartjs
    {
      "type": "line",
      "data": {
        "labels": ${JSON.stringify(analytics.salesTrends.map((trend) => trend.period))},
        "datasets": [
          {
            "label": "${t.totalSales}",
            "data": ${JSON.stringify(analytics.salesTrends.map((trend) => trend.totalSales))},
            "borderColor": "#F59E0B",
            "backgroundColor": "rgba(245, 158, 11, 0.2)",
            "fill": true,
            "tension": 0.4
          },
          {
            "label": "${t.totalOrders}",
            "data": ${JSON.stringify(analytics.salesTrends.map((trend) => trend.saleCount))},
            "borderColor": "#10B981",
            "backgroundColor": "rgba(16, 185, 129, 0.2)",
            "fill": true,
            "tension": 0.4
          }
        ]
      },
      "options": {
        "responsive": true,
        "plugins": {
          "legend": {
            "position": "top",
            "labels": {
              "font": {
                "family": "'Alexandria', sans-serif",
                "size": 14
              }
            }
          },
          "title": {
            "display": true,
            "text": "${t.salesTrends}",
            "font": {
              "family": "'Alexandria', sans-serif",
              "size": 18
            }
          }
        },
        "scales": {
          "x": {
            "title": {
              "display": true,
              "text": "${t.filterBy}",
              "font": {
                "family": "'Alexandria', sans-serif"
              }
            }
          },
          "y": {
            "title": {
              "display": true,
              "text": "${t.totalSales} (${t.currency})",
              "font": {
                "family": "'Alexandria', sans-serif"
              }
            },
            "beginAtZero": true
          }
        }
      }
    }
    ```
  ) : null;

  // Top Products Chart
  const topProductsChart = analytics?.productSales && analytics.productSales.length > 0 ? (
    ```chartjs
    {
      "type": "bar",
      "data": {
        "labels": ${JSON.stringify(analytics.productSales.map((ps) => ps.displayName))},
        "datasets": [
          {
            "label": "${t.totalSales}",
            "data": ${JSON.stringify(analytics.productSales.map((ps) => ps.totalRevenue))},
            "backgroundColor": "#F59E0B"
          },
          {
            "label": "${t.quantity}",
            "data": ${JSON.stringify(analytics.productSales.map((ps) => ps.totalQuantity))},
            "backgroundColor": "#10B981"
          }
        ]
      },
      "options": {
        "responsive": true,
        "plugins": {
          "legend": {
            "position": "top",
            "labels": {
              "font": {
                "family": "'Alexandria', sans-serif",
                "size": 14
              }
            }
          },
          "title": {
            "display": true,
            "text": "${t.productSales}",
            "font": {
              "family": "'Alexandria', sans-serif",
              "size": 18
            }
          }
        },
        "scales": {
          "x": {
            "title": {
              "display": true,
              "text": "${t.productSales}",
              "font": {
                "family": "'Alexandria', sans-serif"
              }
            }
          },
          "y": {
            "title": {
              "display": true,
              "text": "${t.totalSales} (${t.currency})",
              "font": {
                "family": "'Alexandria', sans-serif"
              }
            },
            "beginAtZero": true
          }
        }
      }
    }
    ```
  ) : null;

  // Authorization Check
  if (!user || (user.role !== 'admin' && user.role !== 'branch')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4 font-alexandria" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <span className="text-red-600 text-base font-medium font-alexandria">{t.errors.unauthorized_access}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 sm:px-6 py-8 bg-gradient-to-br from-gray-50 to-gray-100 font-alexandria" dir={isRtl ? 'rtl' : 'ltr'}>
      <link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600&display=swap" rel="stylesheet" />
      <header className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-alexandria">{t.title}</h1>
            <p className="text-gray-600 text-sm font-alexandria">{t.subtitle}</p>
          </div>
        </div>
      </header>
      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm font-medium font-alexandria">{error}</span>
        </div>
      )}
      <div className="space-y-8">
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.filterBy}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <SearchInput
              value={searchInput}
              onChange={handleSearchChange}
              placeholder={t.searchPlaceholder}
              ariaLabel={t.searchPlaceholder}
            />
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
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm font-alexandria`}
                  aria-label={t.filterBy}
                />
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm font-alexandria`}
                  aria-label={t.filterBy}
                />
              </>
            )}
            <BranchFilter
              branches={branches}
              selectedBranch={filterBranch}
              onChange={setFilterBranch}
              placeholder={t.branchFilter}
              allBranchesLabel={t.allBranches}
              disabled={user?.role === 'branch'}
            />
          </div>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 gap-6">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse">
                <div className="space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : !analytics ? (
          <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100">
            <p className="text-gray-600 text-sm font-medium font-alexandria">{t.errors.no_analytics}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.totalSales}</h3>
                <p className="text-2xl font-bold text-amber-600 font-alexandria">{safeNumber(analytics.totalSales).toFixed(2)} {t.currency}</p>
              </div>
              <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.totalOrders}</h3>
                <p className="text-2xl font-bold text-amber-600 font-alexandria">{safeNumber(analytics.totalCount)}</p>
              </div>
              <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.averageOrderValue}</h3>
                <p className="text-2xl font-bold text-amber-600 font-alexandria">{analytics.averageOrderValue} {t.currency}</p>
              </div>
              {user?.role === 'admin' && analytics.returnRate && (
                <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.returnRate}</h3>
                  <p className="text-2xl font-bold text-amber-600 font-alexandria">{analytics.returnRate}%</p>
                </div>
              )}
              <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.topProduct}</h3>
                <p className="text-sm text-gray-600 font-alexandria">{analytics.topProduct.displayName}</p>
                <p className="text-sm text-gray-600 font-alexandria">{t.totalSales}: {safeNumber(analytics.topProduct.totalRevenue).toFixed(2)} {t.currency}</p>
                <p className="text-sm text-gray-600 font-alexandria">{t.quantity}: {safeNumber(analytics.topProduct.totalQuantity)}</p>
              </div>
            </div>
            {salesTrendsChart && (
              <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                {salesTrendsChart}
              </div>
            )}
            {topProductsChart && (
              <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                {topProductsChart}
              </div>
            )}
            {user?.role === 'admin' && (
              <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.branchFilter}</h3>
                <ul className="space-y-2">
                  {filteredBranchSales.length > 0 ? (
                    filteredBranchSales.map((bs) => (
                      <li key={bs.branchId} className="border-t border-gray-100 pt-2 font-alexandria">
                        {bs.displayName} - {t.totalSales}: {safeNumber(bs.totalSales).toFixed(2)} {t.currency}, {t.totalOrders}: {safeNumber(bs.saleCount)}
                      </li>
                    ))
                  ) : (
                    <li className="text-gray-500 font-alexandria">{t.errors.no_analytics}</li>
                  )}
                </ul>
              </div>
            )}
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.productSales}</h3>
              <ul className="space-y-2">
                {filteredProductSales.length > 0 ? (
                  filteredProductSales.map((ps) => (
                    <li key={ps.productId} className="border-t border-gray-100 pt-2 font-alexandria">
                      {ps.displayName} - {t.totalSales}: {safeNumber(ps.totalRevenue).toFixed(2)} {t.currency}, {t.quantity}: {safeNumber(ps.totalQuantity)}
                    </li>
                  ))
                ) : (
                  <li className="text-gray-500 font-alexandria">{t.errors.no_analytics}</li>
                )}
              </ul>
            </div>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.leastProductSales}</h3>
              <ul className="space-y-2">
                {filteredLeastProductSales.length > 0 ? (
                  filteredLeastProductSales.map((ps) => (
                    <li key={ps.productId} className="border-t border-gray-100 pt-2 font-alexandria">
                      {ps.displayName} - {t.totalSales}: {safeNumber(ps.totalRevenue).toFixed(2)} {t.currency}, {t.quantity}: {safeNumber(ps.totalQuantity)}
                    </li>
                  ))
                ) : (
                  <li className="text-gray-500 font-alexandria">{t.errors.no_analytics}</li>
                )}
              </ul>
            </div>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.departmentSales}</h3>
              <ul className="space-y-2">
                {filteredDepartmentSales.length > 0 ? (
                  filteredDepartmentSales.map((ds) => (
                    <li key={ds.departmentId} className="border-t border-gray-100 pt-2 font-alexandria">
                      {ds.displayName} - {t.totalSales}: {safeNumber(ds.totalRevenue).toFixed(2)} {t.currency}, {t.quantity}: {safeNumber(ds.totalQuantity)}
                    </li>
                  ))
                ) : (
                  <li className="text-gray-500 font-alexandria">{t.errors.no_analytics}</li>
                )}
              </ul>
            </div>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.leastDepartmentSales}</h3>
              <ul className="space-y-2">
                {filteredLeastDepartmentSales.length > 0 ? (
                  filteredLeastDepartmentSales.map((ds) => (
                    <li key={ds.departmentId} className="border-t border-gray-100 pt-2 font-alexandria">
                      {ds.displayName} - {t.totalSales}: {safeNumber(ds.totalRevenue).toFixed(2)} {t.currency}, {t.quantity}: {safeNumber(ds.totalQuantity)}
                    </li>
                  ))
                ) : (
                  <li className="text-gray-500 font-alexandria">{t.errors.no_analytics}</li>
                )}
              </ul>
            </div>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 font-alexandria">{t.topCustomers}</h3>
              <ul className="space-y-2">
                {analytics.topCustomers.length > 0 ? (
                  analytics.topCustomers.map((tc) => (
                    <li key={`${tc.customerName}-${tc.customerPhone}`} className="border-t border-gray-100 pt-2 font-alexandria">
                      {tc.customerName} ({tc.customerPhone}) - {t.totalSales}: {safeNumber(tc.totalSpent).toFixed(2)} {t.currency}, {t.totalOrders}: {safeNumber(tc.purchaseCount)}
                    </li>
                  ))
                ) : (
                  <li className="text-gray-500 font-alexandria">{t.errors.no_analytics}</li>
                )}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BranchSalesAnalytics;