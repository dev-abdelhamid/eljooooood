import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { branchesAPI, inventoryAPI, salesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, DollarSign, Plus, Minus, Trash2, Package, Search, X, ChevronDown } from 'lucide-react';
import { toast } from 'react-toastify';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { debounce } from 'lodash';
import io from 'socket.io-client';

interface Sale {
  _id: string;
  saleNumber: string;
  branch: { _id: string; name: string; nameEn?: string; displayName: string };
  items: Array<{
    productId: string;
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
  returns?: Array<{
    _id: string;
    returnNumber: string;
    status: string;
    items: Array<{ productId: string; productName: string; productNameEn?: string; quantity: number; reason: string }>;
    reason: string;
    createdAt: string;
  }>;
}

interface Branch {
  _id: string;
  name: string;
  nameEn?: string;
  displayName: string;
}

interface InventoryItem {
  _id: string;
  product: {
    _id: string;
    name: string;
    nameEn?: string;
    unit?: string;
    unitEn?: string;
    price: number;
    department?: { _id: string; name: string; nameEn?: string; displayName: string };
  };
  currentStock: number;
  displayName: string;
  displayUnit: string;
}

interface CartItem {
  productId: string;
  productName: string;
  productNameEn?: string;
  unit?: string;
  unitEn?: string;
  displayName: string;
  displayUnit: string;
  quantity: number;
  unitPrice: number;
}

interface BranchAnalytics {
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
  returnRate: number;
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
  returnStats: Array<{ status: string; count: number; totalQuantity: number }>;
}

const translations = {
  ar: {
    title: 'تقرير المبيعات',
    subtitle: 'إدارة المبيعات وإضافة مبيعات جديدة',
    filters: 'الفلاتر',
    availableProducts: 'المنتجات المتاحة',
    noProducts: 'لا توجد منتجات متاحة',
    department: 'القسم',
    availableStock: 'المخزون المتاح',
    unitPrice: 'سعر الوحدة',
    addToCart: 'إضافة إلى السلة',
    cart: 'سلة المبيعات',
    emptyCart: 'السلة فارغة',
    total: 'الإجمالي',
    notes: 'ملاحظات',
    customerName: 'اسم العميل',
    customerPhone: 'هاتف العميل',
    submitSale: 'إرسال المبيعة',
    newSale: 'مبيعة جديدة',
    previousSales: 'المبيعات السابقة',
    analytics: 'إحصائيات المبيعات',
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
    branchStats: 'إحصائيات الفرع',
    branchSales: 'مبيعات الفروع',
    leastBranchSales: 'أقل الفروع مبيعًا',
    productSales: 'مبيعات المنتجات',
    leastProductSales: 'أقل المنتجات مبيعًا',
    departmentSales: 'مبيعات الأقسام',
    leastDepartmentSales: 'أقل الأقسام مبيعًا',
    totalSales: 'إجمالي المبيعات',
    totalCount: 'عدد المبيعات',
    averageOrderValue: 'متوسط قيمة المبيعة',
    returnRate: 'نسبة المرتجعات',
    topProduct: 'أكثر المنتجات مبيعًا',
    topCustomers: 'أفضل العملاء',
    errors: {
      unauthorized_access: 'غير مصرح لك بالوصول',
      no_branch_assigned: 'لم يتم تعيين فرع',
      fetch_sales: 'خطأ أثناء جلب المبيعات',
      fetch_branches: 'خطأ أثناء جلب الفروع',
      fetch_inventory: 'خطأ أثناء جلب المخزون',
      fetch_analytics: 'خطأ أثناء جلب الإحصائيات',
      create_sale_failed: 'فشل إنشاء المبيعة',
      insufficient_stock: 'المخزون غير كافٍ',
      exceeds_max_quantity: 'الكمية تتجاوز الحد الأقصى',
      invalid_quantity: 'الكمية غير صالحة',
      empty_cart: 'السلة فارغة',
      deleted_product: 'منتج محذوف',
      invalid_customer_phone: 'رقم هاتف العميل غير صالح',
      no_branches_available: 'لا توجد فروع متاحة',
    },
    currency: 'ريال',
    units: { default: 'غير محدد' },
    branches: { all_branches: 'كل الفروع', select_branch: 'اختر الفرع', unknown: 'غير معروف' },
    departments: { unknown: 'غير معروف' },
    paymentMethods: { cash: 'نقدي' },
    returns: { status: { pending: 'معلق', approved: 'مقبول', rejected: 'مرفوض' } },
  },
  en: {
    title: 'Sales Report',
    subtitle: 'Manage sales and add new sales',
    filters: 'Filters',
    availableProducts: 'Available Products',
    noProducts: 'No products available',
    department: 'Department',
    availableStock: 'Available Stock',
    unitPrice: 'Unit Price',
    addToCart: 'Add to Cart',
    cart: 'Sales Cart',
    emptyCart: 'Cart is empty',
    total: 'Total',
    notes: 'Notes',
    customerName: 'Customer Name',
    customerPhone: 'Customer Phone',
    submitSale: 'Submit Sale',
    newSale: 'New Sale',
    previousSales: 'Previous Sales',
    analytics: 'Sales Analytics',
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
    branchStats: 'Branch Statistics',
    branchSales: 'Branch Sales',
    leastBranchSales: 'Least Sold Branches',
    productSales: 'Product Sales',
    leastProductSales: 'Least Sold Products',
    departmentSales: 'Department Sales',
    leastDepartmentSales: 'Least Sold Departments',
    totalSales: 'Total Sales',
    totalCount: 'Total Sales Count',
    averageOrderValue: 'Average Order Value',
    returnRate: 'Return Rate',
    topProduct: 'Top Selling Product',
    topCustomers: 'Top Customers',
    errors: {
      unauthorized_access: 'You are not authorized to access',
      no_branch_assigned: 'No branch assigned',
      fetch_sales: 'Error fetching sales',
      fetch_branches: 'Error fetching branches',
      fetch_inventory: 'Error fetching inventory',
      fetch_analytics: 'Error fetching analytics',
      create_sale_failed: 'Failed to create sale',
      insufficient_stock: 'Insufficient stock',
      exceeds_max_quantity: 'Quantity exceeds maximum available',
      invalid_quantity: 'Invalid quantity',
      empty_cart: 'Cart is empty',
      deleted_product: 'Deleted Product',
      invalid_customer_phone: 'Invalid customer phone',
      no_branches_available: 'No branches available',
    },
    currency: 'SAR',
    units: { default: 'N/A' },
    branches: { all_branches: 'All Branches', select_branch: 'Select Branch', unknown: 'Unknown' },
    departments: { unknown: 'Unknown' },
    paymentMethods: { cash: 'Cash' },
    returns: { status: { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' } },
  },
};

// Memoized Components
const ProductSearchInput = React.memo<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  ariaLabel: string;
}>(({ value, onChange, placeholder, ariaLabel }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="relative group">
      <Search className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors group-focus-within:text-amber-500 ${value ? 'opacity-0' : 'opacity-100'}`} />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full ${isRtl ? 'pl-12 pr-4' : 'pr-12 pl-4'} py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={ariaLabel}
      />
      {value && (
        <button
          onClick={() => onChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>)}
          className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-amber-500 transition-colors`}
          aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
});

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
        className={`w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 bg-gradient-to-r from-white to-gray-50 shadow-sm hover:shadow-md text-sm text-gray-700 ${isRtl ? 'text-right' : 'text-left'} flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                className="px-4 py-2 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-600 cursor-pointer transition-colors duration-200"
              >
                {option.label}
              </div>
            ))
          ) : (
            <div className="px-4 py-2 text-sm text-gray-500">{isRtl ? 'لا توجد خيارات متاحة' : 'No options available'}</div>
          )}
        </div>
      )}
    </div>
  );
});

const QuantityInput = React.memo<{
  value: number;
  onChange: (val: string) => void;
  onIncrement: () => void;
  onDecrement: () => void;
}>(({ value, onChange, onIncrement, onDecrement }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onDecrement}
        className="w-7 h-7 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors duration-200 flex items-center justify-center"
        aria-label={isRtl ? 'تقليل الكمية' : 'Decrease quantity'}
      >
        <Minus className="w-4 h-4" />
      </button>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-7 text-center border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm transition-all duration-200"
        style={{ appearance: 'none' }}
        aria-label={isRtl ? 'الكمية' : 'Quantity'}
      />
      <button
        onClick={onIncrement}
        className="w-7 h-7 bg-amber-600 hover:bg-amber-700 rounded-full transition-colors duration-200 flex items-center justify-center"
        aria-label={isRtl ? 'زيادة الكمية' : 'Increase quantity'}
      >
        <Plus className="w-4 h-4 text-white" />
      </button>
    </div>
  );
});

const ProductCard = React.memo<{
  product: InventoryItem;
  cartItem?: CartItem;
  onAdd: () => void;
  onUpdate: (quantity: number) => void;
  onRemove: () => void;
}>(({ product, cartItem, onAdd, onUpdate, onRemove }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  return (
    <div className="h-[180px] p-4 bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-amber-200">
      <div className="space-y-2">
        <h3 className="font-bold text-gray-900 text-sm truncate">{product.displayName}</h3>
        <p className="text-xs text-amber-600">{t.department}: {product.product.department?.displayName || t.departments.unknown}</p>
        <p className="text-xs text-gray-600">{t.availableStock}: {product.currentStock} {product.displayUnit || t.units.default}</p>
        <p className="font-semibold text-gray-900 text-sm">{t.unitPrice}: {product.product.price} {t.currency}</p>
      </div>
      <div className="mt-3 flex justify-end">
        {cartItem ? (
          <div className="flex items-center gap-2">
            <QuantityInput
              value={cartItem.quantity}
              onChange={(val) => onUpdate(parseInt(val) || 0)}
              onIncrement={() => onUpdate(cartItem.quantity + 1)}
              onDecrement={() => onUpdate(cartItem.quantity - 1)}
            />
            <button
              onClick={onRemove}
              className="w-7 h-7 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors duration-200 flex items-center justify-center"
              aria-label={isRtl ? 'إزالة المنتج' : 'Remove item'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onAdd}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs transition-colors duration-200 flex items-center justify-center gap-1 shadow-sm"
            aria-label={t.addToCart}
            disabled={product.currentStock < 1}
          >
            <Plus className="w-4 h-4" />
            {t.addToCart}
          </button>
        )}
      </div>
    </div>
  );
});

const SaleCard = React.memo<{ sale: Sale }>(({ sale }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  return (
    <div className="p-4 bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-amber-200">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900 text-base">{sale.saleNumber}</h3>
          <span className="text-xs text-gray-500">({sale.branch.displayName})</span>
        </div>
        <div className="space-y-2">
          {sale.items.map((item, index) => (
            <div key={index} className="flex justify-between items-center text-xs text-gray-700">
              <span className="truncate max-w-[60%]">
                {item.quantity} {item.displayUnit || t.units.default} {item.displayName || t.errors.deleted_product}
              </span>
              <span className="font-semibold text-amber-600">
                {item.quantity}x{item.unitPrice} = {(item.quantity * item.unitPrice).toFixed(2)} {t.currency}
              </span>
            </div>
          ))}
          <div className="flex justify-between items-center font-bold text-gray-900 text-sm border-t pt-2 mt-2">
            <span>{t.total}:</span>
            <span className="text-amber-600">{sale.totalAmount.toFixed(2)} {t.currency}</span>
          </div>
        </div>
        <div className="space-y-1 text-xs text-gray-600">
          <p>{t.date}: {sale.createdAt || t.errors.unknown}</p>
          <p>{t.paymentMethod}: {t.paymentMethods.cash}</p>
          {sale.customerName && <p>{t.customerName}: {sale.customerName}</p>}
          {sale.customerPhone && <p>{t.customerPhone}: {sale.customerPhone}</p>}
          {sale.notes && <p className="italic">{t.notes}: {sale.notes}</p>}
        </div>
        {sale.returns && sale.returns.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-gray-700">{t.returns}:</p>
            <ul className="list-disc list-inside text-xs text-gray-600">
              {sale.returns.map((ret, index) => (
                <li key={index}>
                  {t.return} #{ret.returnNumber} ({t.returns.status[ret.status as keyof typeof t.returns.status]}) - {t.reason}: {ret.reason} ({t.date}: {ret.createdAt || t.errors.unknown})
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
    </div>
  );
});

const StatsCard = React.memo<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}>(({ title, value, icon, color }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full ${color}`}>{icon}</div>
        <div>
          <p className="text-xs text-gray-600">{title}</p>
          <p className="text-sm font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
});

const ProductSkeletonCard = React.memo(() => (
  <div className="h-[180px] p-4 bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse">
    <div className="space-y-2">
      <div className="h-3 bg-gray-200 rounded w-3/4"></div>
      <div className="h-2 bg-gray-200 rounded w-1/2"></div>
      <div className="h-2 bg-gray-200 rounded w-1/3"></div>
      <div className="mt-3 flex justify-end">
        <div className="h-7 bg-gray-200 rounded-lg w-20"></div>
      </div>
    </div>
  </div>
));

const SaleSkeletonCard = React.memo(() => (
  <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse">
    <div className="space-y-2">
      <div className="h-3 bg-gray-200 rounded w-3/4"></div>
      <div className="h-2 bg-gray-200 rounded w-1/2"></div>
      <div className="h-2 bg-gray-200 rounded w-1/3"></div>
    </div>
  </div>
));

const StatsSkeletonCard = React.memo(() => (
  <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse">
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-full bg-gray-200 w-10 h-10"></div>
      <div className="space-y-2">
        <div className="h-2 bg-gray-200 rounded w-20"></div>
        <div className="h-3 bg-gray-200 rounded w-16"></div>
      </div>
    </div>
  </div>
));

export const BranchSalesReport: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [activeTab, setActiveTab] = useState<'new' | 'previous'>('new');
  const [sales, setSales] = useState<Sale[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [analytics, setAnalytics] = useState<BranchAnalytics>({
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
    returnStats: [],
  });
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [salesLoading, setSalesLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState<string | undefined>(undefined);
  const [selectedBranch, setSelectedBranch] = useState(user?.role === 'branch' && user?.branchId ? user.branchId : '');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const socket = useMemo(() => io('https://eljoodia-server-production.up.railway.app'), []);

  const debouncedSearch = useCallback(debounce((value: string) => setSearchTerm(value.trim()), 300), []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSearch(value);
  };

  const filteredInventory = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return inventory.filter((item) => item.displayName.toLowerCase().includes(lowerSearchTerm));
  }, [inventory, searchTerm]);

  const fetchData = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      if (!user?.role || user.role !== 'branch') {
        setError(t.errors.unauthorized_access);
        toast.error(t.errors.unauthorized_access, { position: isRtl ? 'top-right' : 'top-left' });
        setLoading(false);
        return;
      }

      const effectiveBranch = user.branchId || selectedBranch;
      if (!effectiveBranch) {
        setError(t.errors.no_branch_assigned);
        toast.error(t.errors.no_branch_assigned, { position: isRtl ? 'top-right' : 'top-left' });
        setLoading(false);
        return;
      }

      setLoading(pageNum === 1);
      setSalesLoading(pageNum > 1);
      setAnalyticsLoading(true);
      try {
        const salesParams: any = { page: pageNum, limit: 20, sort: '-createdAt', branch: effectiveBranch };
        if (filterPeriod === 'custom' && startDate && endDate) {
          salesParams.startDate = startDate;
          salesParams.endDate = endDate;
        }

        const analyticsParams: any = { branch: effectiveBranch };
        if (filterPeriod === 'custom' && startDate && endDate) {
          analyticsParams.startDate = startDate;
          analyticsParams.endDate = endDate;
        }

        const inventoryParams: any = { lowStock: false, branch: effectiveBranch };

        const [salesResponse, branchesResponse, inventoryResponse, analyticsResponse] = await Promise.all([
          salesAPI.getAll(salesParams).catch((err) => {
            console.error(`[${new Date().toISOString()}] Sales fetch error:`, err);
            toast.error(t.errors.fetch_sales, { position: isRtl ? 'top-right' : 'top-left' });
            return { sales: [], total: 0, returns: [] };
          }),
          branchesAPI.getAll().catch((err) => {
            console.error(`[${new Date().toISOString()}] Branch fetch error:`, err);
            toast.error(t.errors.fetch_branches, { position: isRtl ? 'top-right' : 'top-left' });
            return { branches: [] };
          }),
          inventoryAPI.getInventory(inventoryParams).catch((err) => {
            console.error(`[${new Date().toISOString()}] Inventory fetch error:`, err);
            toast.error(t.errors.fetch_inventory, { position: isRtl ? 'top-right' : 'top-left' });
            return [];
          }),
          salesAPI.getAnalytics(analyticsParams).catch((err) => {
            console.error(`[${new Date().toISOString()}] Analytics fetch error:`, err);
            toast.error(t.errors.fetch_analytics, { position: isRtl ? 'top-right' : 'top-left' });
            return {};
          }),
        ]);

        const returnsMap = new Map<string, Sale['returns']>();
        (salesResponse.returns || []).forEach((ret: any) => {
          const saleId = ret.sale?._id || ret.sale;
          if (!returnsMap.has(saleId)) returnsMap.set(saleId, []);
          returnsMap.get(saleId)!.push({
            _id: ret._id,
            returnNumber: ret.returnNumber,
            status: ret.status,
            items: (ret.items || []).map((item: any) => ({
              productId: item.product?._id || item.productId,
              productName: item.product?.name || t.errors.deleted_product,
              productNameEn: item.product?.nameEn,
              quantity: item.quantity,
              reason: item.reason,
            })),
            reason: ret.reason,
            createdAt: formatDate(ret.createdAt, language) || t.errors.unknown,
          });
        });

        const newSales = (salesResponse.sales || []).map((sale: any) => ({
          _id: sale._id,
          saleNumber: sale.saleNumber || 'N/A',
          branch: {
            _id: sale.branch?._id || 'unknown',
            name: sale.branch?.name || t.branches.unknown,
            nameEn: sale.branch?.nameEn,
            displayName: isRtl ? sale.branch?.name : (sale.branch?.nameEn || sale.branch?.name || t.branches.unknown),
          },
          items: (sale.items || []).map((item: any) => ({
            productId: item.product?._id || item.productId,
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
                  displayName: isRtl ? item.product.department.name : (item.product.department.nameEn || item.product.department.name || t.departments.unknown),
                }
              : undefined,
          })),
          totalAmount: sale.totalAmount || 0,
          createdAt: formatDate(sale.createdAt, language) || t.errors.unknown,
          notes: sale.notes,
          paymentMethod: sale.paymentMethod || 'cash',
          customerName: sale.customerName,
          customerPhone: sale.customerPhone,
          returns: returnsMap.get(sale._id) || [],
        }));

        setSales((prev) => (append ? [...prev, ...newSales] : newSales));
        setHasMore(salesResponse.total > pageNum * 20);

        setBranches(
          (branchesResponse.branches || []).map((branch: any) => ({
            _id: branch._id,
            name: branch.name || t.branches.unknown,
            nameEn: branch.nameEn,
            displayName: isRtl ? branch.name : (branch.nameEn || branch.name || t.branches.unknown),
          }))
        );

        setInventory(
          (inventoryResponse || [])
            .filter((item: any) => item.currentStock > 0 && item.product?._id)
            .map((item: any) => ({
              _id: item._id,
              product: {
                _id: item.product?._id || 'unknown',
                name: item.product?.name || t.errors.deleted_product,
                nameEn: item.product?.nameEn,
                unit: item.product?.unit,
                unitEn: item.product?.unitEn,
                price: item.product?.price || 0,
                department: item.product?.department
                  ? {
                      _id: item.product.department._id || 'unknown',
                      name: item.product.department.name || t.departments.unknown,
                      nameEn: item.product.department.nameEn,
                      displayName: isRtl ? (item.product.department.name || t.departments.unknown) : (item.product.department.nameEn || item.product.department.name || t.departments.unknown),
                    }
                  : undefined,
              },
              currentStock: item.currentStock || 0,
              displayName: isRtl ? (item.product?.name || t.errors.deleted_product) : (item.product?.nameEn || item.product?.name || t.errors.deleted_product),
              displayUnit: isRtl ? (item.product?.unit || t.units.default) : (item.product?.unitEn || item.product?.unit || t.units.default),
            }))
        );

        setAnalytics({
          branchSales: (analyticsResponse.branchSales || []).map((bs: any) => ({
            ...bs,
            displayName: isRtl ? bs.branchName : (bs.branchNameEn || bs.branchName || t.branches.unknown),
          })),
          leastBranchSales: (analyticsResponse.leastBranchSales || []).map((bs: any) => ({
            ...bs,
            displayName: isRtl ? bs.branchName : (bs.branchNameEn || bs.branchName || t.branches.unknown),
          })),
          productSales: (analyticsResponse.productSales || []).map((ps: any) => ({
            ...ps,
            displayName: isRtl ? (ps.productName || t.errors.deleted_product) : (ps.productNameEn || ps.productName || t.errors.deleted_product),
          })),
          leastProductSales: (analyticsResponse.leastProductSales || []).map((ps: any) => ({
            ...ps,
            displayName: isRtl ? (ps.productName || t.errors.deleted_product) : (ps.productNameEn || ps.productName || t.errors.deleted_product),
          })),
          departmentSales: (analyticsResponse.departmentSales || []).map((ds: any) => ({
            ...ds,
            displayName: isRtl ? (ds.departmentName || t.departments.unknown) : (ds.departmentNameEn || ds.departmentName || t.departments.unknown),
          })),
          leastDepartmentSales: (analyticsResponse.leastDepartmentSales || []).map((ds: any) => ({
            ...ds,
            displayName: isRtl ? (ds.departmentName || t.departments.unknown) : (ds.departmentNameEn || ds.departmentName || t.departments.unknown),
          })),
          totalSales: analyticsResponse.totalSales || 0,
          totalCount: analyticsResponse.totalCount || 0,
          averageOrderValue: analyticsResponse.averageOrderValue || 0,
          returnRate: analyticsResponse.returnRate || 0,
          topProduct: analyticsResponse.topProduct
            ? {
                ...analyticsResponse.topProduct,
                displayName: isRtl
                  ? analyticsResponse.topProduct.productName || t.errors.deleted_product
                  : analyticsResponse.topProduct.productNameEn || analyticsResponse.topProduct.productName || t.errors.deleted_product,
              }
            : { productId: null, productName: '', displayName: '', totalQuantity: 0, totalRevenue: 0 },
          salesTrends: (analyticsResponse.salesTrends || []).map((trend: any) => ({
            ...trend,
            period: formatDate(trend.period, language, 'month') || t.errors.unknown,
          })),
          topCustomers: (analyticsResponse.topCustomers || []).map((tc: any) => ({
            ...tc,
            customerName: tc.customerName || t.errors.unknown,
            customerPhone: tc.customerPhone || t.errors.unknown,
          })),
          returnStats: (analyticsResponse.returnStats || []).map((rs: any) => ({
            ...rs,
            status: t.returns.status[rs.status as keyof typeof t.returns.status] || rs.status,
          })),
        });

        setError('');
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Fetch error:`, err);
        setError(err.message || t.errors.fetch_sales);
        toast.error(err.message || t.errors.fetch_sales, { position: isRtl ? 'top-right' : 'top-left' });
        setSales([]);
        setInventory([]);
      } finally {
        setLoading(false);
        setSalesLoading(false);
        setAnalyticsLoading(false);
      }
    },
    [user, t, isRtl, language, selectedBranch, filterPeriod, startDate, endDate]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    socket.on('saleCreated', (data: any) => {
      if (data.branchId === selectedBranch) {
        toast.info(isRtl ? `تم إنشاء مبيعة جديدة: ${data.saleNumber}` : `New sale created: ${data.saleNumber}`, {
          position: isRtl ? 'top-right' : 'top-left',
        });
        fetchData();
      }
    });
    socket.on('saleDeleted', (data: any) => {
      if (data.branchId === selectedBranch) {
        toast.info(isRtl ? `تم حذف مبيعة: ${data.saleId}` : `Sale deleted: ${data.saleId}`, {
          position: isRtl ? 'top-right' : 'top-left',
        });
        fetchData();
      }
    });
    return () => {
      socket.off('saleCreated');
      socket.off('saleDeleted');
    };
  }, [socket, fetchData, selectedBranch, isRtl]);

  const loadMoreSales = useCallback(() => {
    setPage((prev) => prev + 1);
    fetchData(page + 1, true);
  }, [fetchData, page]);

  const addToCart = useCallback(
    (product: InventoryItem) => {
      if (product.currentStock < 1) {
        toast.error(t.errors.insufficient_stock, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      setCart((prev) => {
        const existingItem = prev.find((item) => item.productId === product.product._id);
        if (existingItem) {
          if (existingItem.quantity >= product.currentStock) {
            toast.error(t.errors.exceeds_max_quantity, { position: isRtl ? 'top-right' : 'top-left' });
            return prev;
          }
          return prev.map((item) =>
            item.productId === product.product._id ? { ...item, quantity: item.quantity + 1 } : item
          );
        }
        return [
          ...prev,
          {
            productId: product.product._id,
            productName: product.product.name,
            productNameEn: product.product.nameEn,
            unit: product.product.unit,
            unitEn: product.product.unitEn,
            displayName: isRtl ? (product.product.name || t.errors.deleted_product) : (product.product.nameEn || product.product.name || t.errors.deleted_product),
            displayUnit: isRtl ? (product.product.unit || t.units.default) : (product.product.unitEn || product.product.unit || t.units.default),
            quantity: 1,
            unitPrice: product.product.price,
          },
        ];
      });
    },
    [t, isRtl]
  );

  const updateCartQuantity = useCallback(
    (productId: string, quantity: number) => {
      const product = inventory.find((item) => item.product._id === productId);
      if (!product) {
        toast.error(t.errors.deleted_product, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      if (quantity > product.currentStock) {
        toast.error(t.errors.exceeds_max_quantity, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      if (quantity <= 0) {
        setCart((prev) => prev.filter((item) => item.productId !== productId));
        return;
      }
      setCart((prev) =>
        prev.map((item) =>
          item.productId === productId
            ? {
                ...item,
                quantity,
                displayName: isRtl ? (product.product.name || t.errors.deleted_product) : (product.product.nameEn || product.product.name || t.errors.deleted_product),
                displayUnit: isRtl ? (product.product.unit || t.units.default) : (product.product.unitEn || product.product.unit || t.units.default),
              }
            : item
        )
      );
    },
    [inventory, t, isRtl]
  );

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }, []);

  const handleSubmitSale = useCallback(async () => {
    if (cart.length === 0) {
      toast.error(t.errors.empty_cart, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }

    if (customerPhone && !/^\+?\d{7,15}$/.test(customerPhone)) {
      toast.error(t.errors.invalid_customer_phone, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }

    const effectiveBranch = user?.branchId || selectedBranch;
    if (!effectiveBranch) {
      toast.error(t.errors.no_branch_assigned, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }

    for (const item of cart) {
      const product = inventory.find((inv) => inv.product._id === item.productId);
      if (!product) {
        toast.error(t.errors.deleted_product, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      if (item.quantity > product.currentStock) {
        toast.error(`${t.errors.insufficient_stock}: ${item.displayName}`, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      if (item.quantity <= 0) {
        toast.error(`${t.errors.invalid_quantity}: ${item.displayName}`, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
    }

    const saleData = {
      branch: effectiveBranch,
      items: cart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      notes: notes.trim() || undefined,
      paymentMethod: 'cash',
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone?.trim() || undefined,
    };

    try {
      await salesAPI.create(saleData);
      toast.success(t.submitSale, { position: isRtl ? 'top-right' : 'top-left' });
      setCart([]);
      setNotes('');
      setCustomerName('');
      setCustomerPhone(undefined);
      fetchData();
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Sale submission error:`, err);
      toast.error(t.errors.create_sale_failed, { position: isRtl ? 'top-right' : 'top-left' });
    }
  }, [cart, notes, customerName, customerPhone, user, selectedBranch, inventory, t, isRtl, fetchData]);

  const branchOptions = useMemo(() => {
    if (user?.role === 'branch' && user?.branchId) {
      const branch = branches.find((b) => b._id === user.branchId);
      return branch ? [{ value: branch._id, label: branch.displayName }] : [];
    }
    return [
      { value: '', label: t.branches.select_branch },
      ...branches.map((branch) => ({ value: branch._id, label: branch.displayName })),
    ];
  }, [branches, t.branches, user]);

  const periodOptions = useMemo(
    () => [
      { value: 'all', label: isRtl ? 'الكل' : 'All' },
      { value: 'custom', label: t.customRange },
    ],
    [t, isRtl]
  );

  const totalCartAmount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toFixed(2);
  }, [cart]);

  const chartColors = ['#FBBF24', '#3B82F6', '#FF6384', '#4BC0C0', '#9966FF'];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 text-white p-2 rounded-lg shadow-lg opacity-90">
          <p className="font-bold text-xs">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {entry.name}: {entry.value} {entry.name.includes(t.currency) ? t.currency : ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const branchSalesChartData = analytics.branchSales.slice(0, 5).map((bs) => ({
    name: bs.displayName,
    [t.totalSales]: bs.totalSales,
    [t.totalCount]: bs.saleCount,
  }));

  const leastBranchSalesChartData = analytics.leastBranchSales.slice(0, 5).map((bs) => ({
    name: bs.displayName,
    [t.totalSales]: bs.totalSales,
    [t.totalCount]: bs.saleCount,
  }));

  const productSalesChartData = analytics.productSales.slice(0, 5).map((ps) => ({
    name: ps.displayName,
    [t.totalSales]: ps.totalRevenue,
    [t.quantity]: ps.totalQuantity,
  }));

  const leastProductSalesChartData = analytics.leastProductSales.slice(0, 5).map((ps) => ({
    name: ps.displayName,
    [t.totalSales]: ps.totalRevenue,
    [t.quantity]: ps.totalQuantity,
  }));

  const departmentSalesChartData = analytics.departmentSales.slice(0, 5).map((ds) => ({
    name: ds.displayName,
    [t.totalSales]: ds.totalRevenue,
    [t.quantity]: ds.totalQuantity,
  }));

  const leastDepartmentSalesChartData = analytics.leastDepartmentSales.slice(0, 5).map((ds) => ({
    name: ds.displayName,
    [t.totalSales]: ds.totalRevenue,
    [t.quantity]: ds.totalQuantity,
  }));

  const salesTrendsChartData = analytics.salesTrends.map((trend) => ({
    period: trend.period,
    [t.totalSales]: trend.totalSales,
    [t.totalCount]: trend.saleCount,
  }));

  const topCustomersChartData = analytics.topCustomers.slice(0, 5).map((tc) => ({
    name: tc.customerName,
    [t.totalSales]: tc.totalSpent,
    [t.totalCount]: tc.purchaseCount,
  }));

  const returnStatsChartData = analytics.returnStats.map((rs) => ({
    name: rs.status,
    value: rs.count,
  }));

  if (user?.role !== 'branch') {
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
    <div className={`mx-auto px-4 sm:px-6 py-8 min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans ${isRtl ? 'font-arabic' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <header className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center gap-3">
          <DollarSign className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
            <p className="text-gray-600 text-sm">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('new')}
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'new' ? 'border-b-2 border-amber-600 text-amber-600' : 'text-gray-500 hover:text-amber-600'} transition-colors duration-200`}
          >
            {t.newSale}
          </button>
          <button
            onClick={() => setActiveTab('previous')}
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'previous' ? 'border-b-2 border-amber-600 text-amber-600' : 'text-gray-500 hover:text-amber-600'} transition-colors duration-200`}
          >
            {t.previousSales}
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm font-medium">{error}</span>
        </div>
      )}

      {activeTab === 'new' && (
        <div className={`space-y-8 ${cart.length > 0 ? 'lg:grid lg:grid-cols-3 lg:gap-8 lg:space-y-0' : ''}`}>
          <section className={`${cart.length > 0 ? 'lg:col-span-2 lg:overflow-y-auto lg:max-h-[calc(100vh-12rem)] scrollbar-none' : ''}`}>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 mb-6">{t.availableProducts}</h2>
              {!user?.branchId && (
                <ProductDropdown
                  value={selectedBranch}
                  onChange={setSelectedBranch}
                  options={branchOptions}
                  ariaLabel={t.branches.select_branch}
                  disabled={!!user?.branchId}
                  className="mb-4"
                />
              )}
              <ProductSearchInput
                value={searchInput}
                onChange={handleSearchChange}
                placeholder={t.searchPlaceholder}
                ariaLabel={t.searchPlaceholder}
              />
              <div className="mt-4 text-center text-xs text-gray-600 font-medium">
                {isRtl ? `عدد المنتجات: ${filteredInventory.length}` : `Products Count: ${filteredInventory.length}`}
              </div>
            </div>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                {[...Array(6)].map((_, index) => (
                  <ProductSkeletonCard key={index} />
                ))}
              </div>
            ) : filteredInventory.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 text-sm font-medium">{t.noProducts}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                {filteredInventory.map((product) => (
                  <ProductCard
                    key={product._id}
                    product={product}
                    cartItem={cart.find((item) => item.productId === product.product._id)}
                    onAdd={() => addToCart(product)}
                    onUpdate={(quantity) => updateCartQuantity(product.product._id, quantity)}
                    onRemove={() => removeFromCart(product.product._id)}
                  />
                ))}
              </div>
            )}
          </section>

          {cart.length > 0 && (
            <aside className="lg:col-span-1 lg:sticky lg:top-8 space-y-6 max-h-[calc(100vh-12rem)] overflow-y-auto scrollbar-none">
              <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-6">{t.cart}</h3>
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div key={item.productId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{item.displayName || t.errors.deleted_product}</p>
                        <p className="text-xs text-gray-600">
                          {item.quantity} {item.displayUnit || t.units.default} | {item.unitPrice} {t.currency} = {(item.quantity * item.unitPrice).toFixed(2)} {t.currency}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <QuantityInput
                          value={item.quantity}
                          onChange={(val) => updateCartQuantity(item.productId, parseInt(val) || 0)}
                          onIncrement={() => updateCartQuantity(item.productId, item.quantity + 1)}
                          onDecrement={() => updateCartQuantity(item.productId, item.quantity - 1)}
                        />
                        <button
                          onClick={() => removeFromCart(item.productId)}
                          className="w-7 h-7 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors duration-200 flex items-center justify-center"
                          aria-label={isRtl ? 'إزالة المنتج' : 'Remove item'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="border-t pt-4">
                    <div className="flex justify-between font-bold text-gray-900 text-sm">
                      <span>{t.total}:</span>
                      <span className="text-amber-600">{totalCartAmount} {t.currency}</span>
                    </div>
                  </div>
                  <div className="mt-4 space-y-4">
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder={t.customerName}
                      className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                      aria-label={t.customerName}
                    />
                    <input
                      type="text"
                      value={customerPhone || ''}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder={t.customerPhone}
                      className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                      aria-label={t.customerPhone}
                    />
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={t.notes}
                      className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm resize-none h-20 ${isRtl ? 'text-right' : 'text-left'}`}
                      aria-label={t.notes}
                    />
                  </div>
                  <button
                    onClick={handleSubmitSale}
                    className="w-full mt-4 px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
                    disabled={cart.length === 0 || !selectedBranch}
                    aria-label={t.submitSale}
                  >
                    {t.submitSale}
                  </button>
                </div>
              </div>
            </aside>
          )}
        </div>
      )}

      {activeTab === 'previous' && (
        <div className="mt-8 space-y-8">
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-6">{t.filters}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {!user?.branchId && (
                <ProductDropdown
                  value={selectedBranch}
                  onChange={setSelectedBranch}
                  options={branchOptions}
                  ariaLabel={t.branches.select_branch}
                  disabled={!!user?.branchId}
                />
              )}
              <ProductDropdown value={filterPeriod} onChange={setFilterPeriod} options={periodOptions} ariaLabel={t.filterBy} />
              {filterPeriod === 'custom' && (
                <>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                    aria-label={t.date}
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                    aria-label={t.date}
                  />
                </>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-6">{t.analytics}</h2>
            {analyticsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, index) => (
                  <StatsSkeletonCard key={index} />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  <StatsCard
                    title={t.totalSales}
                    value={`${analytics.totalSales.toFixed(2)} ${t.currency}`}
                    icon={<DollarSign className="w-5 h-5 text-white" />}
                    color="bg-amber-600"
                  />
                  <StatsCard
                    title={t.totalCount}
                    value={analytics.totalCount}
                    icon={<Package className="w-5 h-5 text-white" />}
                    color="bg-blue-600"
                  />
                  <StatsCard
                    title={t.averageOrderValue}
                    value={`${analytics.averageOrderValue.toFixed(2)} ${t.currency}`}
                    icon={<DollarSign className="w-5 h-5 text-white" />}
                    color="bg-green-600"
                  />
                  <StatsCard
                    title={t.returnRate}
                    value={`${analytics.returnRate.toFixed(1)}%`}
                    icon={<AlertCircle className="w-5 h-5 text-white" />}
                    color="bg-red-600"
                  />
                  <StatsCard
                    title={t.topProduct}
                    value={analytics.topProduct.displayName || t.errors.deleted_product}
                    icon={<Package className="w-5 h-5 text-white" />}
                    color="bg-purple-600"
                  />
                  <StatsCard
                    title={t.topCustomers}
                    value={analytics.topCustomers[0]?.customerName || t.errors.unknown}
                    icon={<Package className="w-5 h-5 text-white" />}
                    color="bg-teal-600"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">{t.branchSales}</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={branchSalesChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" fontSize={10} angle={45} textAnchor="end" height={60} />
                        <YAxis fontSize={10} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" />
                        <Bar dataKey={t.totalSales} fill={chartColors[0]} radius={[4, 4, 0, 0]} />
                        <Bar dataKey={t.totalCount} fill={chartColors[1]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">{t.leastBranchSales}</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={leastBranchSalesChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" fontSize={10} angle={45} textAnchor="end" height={60} />
                        <YAxis fontSize={10} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" />
                        <Bar dataKey={t.totalSales} fill={chartColors[2]} radius={[4, 4, 0, 0]} />
                        <Bar dataKey={t.totalCount} fill={chartColors[3]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">{t.productSales}</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={productSalesChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" fontSize={10} angle={45} textAnchor="end" height={60} />
                        <YAxis fontSize={10} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" />
                        <Bar dataKey={t.totalSales} fill={chartColors[0]} radius={[4, 4, 0, 0]} />
                        <Bar dataKey={t.quantity} fill={chartColors[1]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">{t.leastProductSales}</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={leastProductSalesChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" fontSize={10} angle={45} textAnchor="end" height={60} />
                        <YAxis fontSize={10} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" />
                        <Bar dataKey={t.totalSales} fill={chartColors[2]} radius={[4, 4, 0, 0]} />
                        <Bar dataKey={t.quantity} fill={chartColors[3]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">{t.departmentSales}</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={departmentSalesChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" fontSize={10} angle={45} textAnchor="end" height={60} />
                        <YAxis fontSize={10} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" />
                        <Bar dataKey={t.totalSales} fill={chartColors[0]} radius={[4, 4, 0, 0]} />
                        <Bar dataKey={t.quantity} fill={chartColors[1]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">{t.leastDepartmentSales}</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={leastDepartmentSalesChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" fontSize={10} angle={45} textAnchor="end" height={60} />
                        <YAxis fontSize={10} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" />
                        <Bar dataKey={t.totalSales} fill={chartColors[2]} radius={[4, 4, 0, 0]} />
                        <Bar dataKey={t.quantity} fill={chartColors[3]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">{t.salesTrends}</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={salesTrendsChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" fontSize={10} angle={45} textAnchor="end" height={60} />
                        <YAxis fontSize={10} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" />
                        <Line type="monotone" dataKey={t.totalSales} stroke={chartColors[0]} strokeWidth={2} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey={t.totalCount} stroke={chartColors[1]} strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">{t.topCustomers}</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={topCustomersChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" fontSize={10} angle={45} textAnchor="end" height={60} />
                        <YAxis fontSize={10} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" />
                        <Bar dataKey={t.totalSales} fill={chartColors[2]} radius={[4, 4, 0, 0]} />
                        <Bar dataKey={t.totalCount} fill={chartColors[3]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">{t.returns}</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={returnStatsChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {returnStatsChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-6">{t.previousSales}</h2>
            {loading || salesLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, index) => (
                  <SaleSkeletonCard key={index} />
                ))}
              </div>
            ) : sales.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 text-sm font-medium">{t.noSales}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {sales.map((sale) => (
                  <SaleCard key={sale._id} sale={sale} />
                ))}
              </div>
            )}
            {hasMore && (
              <div className="mt-6 text-center">
                <button
                  onClick={loadMoreSales}
                  className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
                  disabled={salesLoading || !hasMore}
                  aria-label={t.loadMore}
                >
                  {salesLoading ? (isRtl ? 'جاري التحميل...' : 'Loading...') : t.loadMore}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchSalesReport;