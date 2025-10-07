import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { branchesAPI, inventoryAPI, salesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, DollarSign, Plus, Minus, Trash2, Package, Search, X, ChevronDown, Edit } from 'lucide-react';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import io from 'socket.io-client';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app';

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

interface SalesAnalytics {
  totalSales: number;
  totalCount: number;
  averageOrderValue: number;
  topProducts: Array<{
    productId: string;
    productName: string;
    productNameEn?: string;
    displayName: string;
    totalQuantity: number;
    totalRevenue: number;
  }>;
  salesTrends: Array<{ period: string; totalSales: number; saleCount: number }>;
}

interface EditSaleForm {
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  notes?: string;
  paymentMethod?: string;
  customerName?: string;
  customerPhone?: string;
}

const translations = {
  ar: {
    title: 'تقرير مبيعات الفرع',
    subtitle: 'إدارة المبيعات وإضافة مبيعات جديدة',
    filters: 'الفلاتر',
    availableProducts: 'المنتجات المتاحة',
    noProducts: 'لا توجد منتجات متاحة',
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
    newSale: 'مبيعة جديدة',
    previousSales: 'المبيعات السابقة',
    branchAnalytics: 'إحصائيات الفرع',
    noSales: 'لا توجد مبيعات',
    date: 'التاريخ',
    returns: 'المرتجعات',
    return: 'مرتجع',
    reason: 'السبب',
    quantity: 'الكمية',
    searchPlaceholder: 'ابحث باسم العميل، رقم الهاتف، التاريخ، أو اسم المنتج...',
    loadMore: 'تحميل المزيد',
    filterBy: 'تصفية حسب',
    customRange: 'نطاق مخصص',
    totalSales: 'إجمالي المبيعات',
    totalCount: 'عدد المبيعات',
    averageOrderValue: 'متوسط قيمة الطلب',
    topProducts: 'أكثر المنتجات مبيعًا',
    editSale: 'تعديل المبيعة',
    deleteSale: 'حذف المبيعة',
    confirmDelete: 'هل أنت متأكد من حذف هذه المبيعة؟',
    save: 'حفظ',
    cancel: 'إلغاء',
    errors: {
      unauthorized_access: 'غير مصرح لك بالوصول',
      no_branch_assigned: 'لم يتم تعيين فرع',
      fetch_sales: 'خطأ أثناء جلب المبيعات',
      fetch_branches: 'خطأ أثناء جلب الفروع',
      fetch_inventory: 'خطأ أثناء جلب المخزون',
      create_sale_failed: 'فشل إنشاء المبيعة',
      update_sale_failed: 'فشل تعديل المبيعة',
      delete_sale_failed: 'فشل حذف المبيعة',
      insufficient_stock: 'المخزون غير كافٍ',
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
    title: 'Branch Sales Report',
    subtitle: 'Manage sales and add new sales',
    filters: 'Filters',
    availableProducts: 'Available Products',
    noProducts: 'No products available',
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
    newSale: 'New Sale',
    previousSales: 'Previous Sales',
    branchAnalytics: 'Branch Analytics',
    noSales: 'No sales found',
    date: 'Date',
    returns: 'Returns',
    return: 'Return',
    reason: 'Reason',
    quantity: 'Quantity',
    searchPlaceholder: 'Search by customer name, phone, date, or product...',
    loadMore: 'Load More',
    filterBy: 'Filter By',
    customRange: 'Custom Range',
    totalSales: 'Total Sales',
    totalCount: 'Total Sale Count',
    averageOrderValue: 'Average Order Value',
    topProducts: 'Top Selling Products',
    editSale: 'Edit Sale',
    deleteSale: 'Delete Sale',
    confirmDelete: 'Are you sure you want to delete this sale?',
    save: 'Save',
    cancel: 'Cancel',
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
      <Search className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors group-focus-within:text-amber-600`} />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full ${isRtl ? 'pl-12 pr-4' : 'pr-12 pl-4'} py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm placeholder-gray-400 font-alexandria`}
        aria-label={ariaLabel}
      />
      {value && (
        <button
          onClick={() => onChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>)}
          className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-amber-600 transition-colors`}
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
  className?: string;
}>(({ value, onChange, options, ariaLabel, disabled = false, className }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className={`relative ${className || ''}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm appearance-none font-alexandria ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={ariaLabel}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5`} />
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
        className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors duration-200 flex items-center justify-center"
        aria-label={isRtl ? 'تقليل الكمية' : 'Decrease quantity'}
      >
        <Minus className="w-4 h-4 text-gray-600" />
      </button>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-12 h-8 text-center border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-600 focus:border-transparent bg-white shadow-sm transition-all duration-300 font-alexandria"
        style={{ appearance: 'none' }}
        aria-label={isRtl ? 'الكمية' : 'Quantity'}
      />
      <button
        onClick={onIncrement}
        className="w-8 h-8 bg-amber-600 hover:bg-amber-700 rounded-full transition-colors duration-200 flex items-center justify-center"
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
    <div className="p-5 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100">
      <div className="space-y-2">
        <h3 className="font-semibold text-gray-800 text-base truncate font-alexandria">{product.displayName}</h3>
        <p className="text-sm text-gray-600 font-alexandria">{t.availableStock}: {product.currentStock} {product.displayUnit || t.units.default}</p>
        <p className="font-semibold text-gray-800 text-sm font-alexandria">{t.unitPrice}: {product.product.price} {t.currency}</p>
      </div>
      <div className="mt-4 flex justify-end">
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
              className="w-8 h-8 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors duration-300 flex items-center justify-center"
              aria-label={isRtl ? 'إزالة المنتج' : 'Remove item'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onAdd}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm transition-colors duration-300 flex items-center gap-2 font-alexandria"
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

const SaleCard = React.memo<{ sale: Sale; onEdit: (sale: Sale) => void; onDelete: (id: string) => void }>(
  ({ sale, onEdit, onDelete }) => {
    const { language } = useLanguage();
    const isRtl = language === 'ar';
    const t = translations[isRtl ? 'ar' : 'en'];
    return (
      <div className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-800 text-lg font-alexandria">{sale.saleNumber}</h3>
            <span className="text-sm text-gray-500 font-alexandria">({sale.branch.displayName})</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onEdit(sale)} aria-label={t.editSale}>
              <Edit className="w-4 h-4 text-blue-500 hover:text-blue-700 transition-colors" />
            </button>
            <button onClick={() => onDelete(sale._id)} aria-label={t.deleteSale}>
              <Trash2 className="w-4 h-4 text-red-500 hover:text-red-700 transition-colors" />
            </button>
          </div>
        </div>
        <div className="space-y-3">
          <div className="space-y-1 text-sm text-gray-600 font-alexandria">
            {sale.customerName && <p>{t.customerName}: {sale.customerName}</p>}
            {sale.customerPhone && <p>{t.customerPhone}: {sale.customerPhone}</p>}
            <p>{t.date}: {sale.createdAt}</p>
            {sale.paymentMethod && (
              <p>{t.paymentMethod}: {t.paymentMethods[sale.paymentMethod as keyof typeof t.paymentMethods] || 'N/A'}</p>
            )}
            {sale.notes && <p className="italic">{t.notes}: {sale.notes}</p>}
          </div>
          <div className="border-t pt-3">
            {sale.items.map((item, index) => (
              <div key={index} className="flex justify-between text-sm text-gray-700 font-alexandria">
                <span className="truncate max-w-[60%]">{item.displayName || t.errors.deleted_product}</span>
                <span className="font-medium">{item.quantity} x {item.unitPrice} = {(item.quantity * item.unitPrice).toFixed(2)} {t.currency}</span>
              </div>
            ))}
            <div className="flex justify-between font-semibold text-gray-800 text-base mt-2 border-t pt-2 font-alexandria">
              <span>{t.total}:</span>
              <span className="text-amber-600">{sale.totalAmount.toFixed(2)} {t.currency}</span>
            </div>
          </div>
          {sale.returns && sale.returns.length > 0 && (
            <div className="mt-4 text-sm text-gray-600 font-alexandria">
              <p className="font-medium">{t.returns}:</p>
              <ul className="list-disc list-inside">
                {sale.returns.map((ret, index) => (
                  <li key={index}>
                    {t.return} #{ret.returnNumber} ({ret.status}) - {t.reason}: {ret.reason} ({t.date}: {ret.createdAt})
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
  }
);

const ProductSkeletonCard = React.memo(() => (
  <div className="p-5 bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse">
    <div className="space-y-2">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      <div className="h-3 bg-gray-200 rounded w-1/3"></div>
      <div className="mt-4 flex justify-end">
        <div className="h-8 bg-gray-200 rounded-xl w-24"></div>
      </div>
    </div>
  </div>
));

const SaleSkeletonCard = React.memo(() => (
  <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse">
    <div className="space-y-3">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      <div className="h-3 bg-gray-200 rounded w-1/3"></div>
    </div>
  </div>
));

const BranchSalesReport: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [activeTab, setActiveTab] = useState<'new' | 'previous' | 'analytics'>('new');
  const [sales, setSales] = useState<Sale[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [analytics, setAnalytics] = useState<SalesAnalytics>({
    totalSales: 0,
    totalCount: 0,
    averageOrderValue: 0,
    topProducts: [],
    salesTrends: [],
  });
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [salesLoading, setSalesLoading] = useState(false);
  const [error, setError] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState<string | undefined>(undefined);
  const [selectedBranch, setSelectedBranch] = useState(user?.role === 'branch' && user?.branchId ? user.branchId : '');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [editSale, setEditSale] = useState<Sale | null>(null);
  const [editForm, setEditForm] = useState<EditSaleForm>({ items: [] });

  const debouncedSearch = useCallback(debounce((value: string) => setSearchTerm(value.trim().toLowerCase()), 300), []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    debouncedSearch(e.target.value);
  };

  const filteredInventory = useMemo(() => {
    if (!searchTerm) return inventory;
    return inventory.filter((item) => item.displayName.toLowerCase().includes(searchTerm));
  }, [inventory, searchTerm]);

  const filteredSales = useMemo(() => {
    if (!searchTerm) return sales;
    return sales.filter((sale) =>
      [
        sale.customerName || '',
        sale.customerPhone || '',
        sale.createdAt.toLowerCase(),
        ...sale.items.map((item) => item.displayName || ''),
      ].some((value) => value.toLowerCase().includes(searchTerm))
    );
  }, [sales, searchTerm]);

  useEffect(() => {
    const socket = io(API_BASE_URL);
    socket.on('saleCreated', () => fetchData());
    socket.on('saleUpdated', () => fetchData());
    socket.on('saleDeleted', () => fetchData());
    socket.on('inventoryUpdated', () => fetchData());
    return () => {
      socket.disconnect();
    };
  }, [fetchData]);

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
      try {
        const salesParams: any = { page: pageNum, limit: 20, sort: '-createdAt', branch: effectiveBranch };
        if (filterPeriod === 'custom' && startDate && endDate) {
          salesParams.startDate = startDate;
          salesParams.endDate = endDate;
        }
        const inventoryParams: any = { lowStock: false, branch: effectiveBranch };
        const analyticsParams: any = { branch: effectiveBranch };
        if (filterPeriod === 'custom' && startDate && endDate) {
          analyticsParams.startDate = startDate;
          analyticsParams.endDate = endDate;
        }
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
            toast.error(t.errors.fetch_sales, { position: isRtl ? 'top-right' : 'top-left' });
            return {
              totalSales: 0,
              totalCount: 0,
              averageOrderValue: 0,
              topProducts: [],
              salesTrends: [],
            };
          }),
        ]);

        const returnsMap = new Map<string, Sale['returns']>();
        if (Array.isArray(salesResponse.returns)) {
          salesResponse.returns.forEach((ret: any) => {
            const saleId = ret.sale?._id || ret.sale;
            if (!returnsMap.has(saleId)) returnsMap.set(saleId, []);
            returnsMap.get(saleId)!.push({
              _id: ret._id,
              returnNumber: ret.returnNumber,
              status: ret.status,
              items: Array.isArray(ret.items)
                ? ret.items.map((item: any) => ({
                    productId: item.product?._id || item.productId,
                    productName: item.product?.name || t.departments.unknown,
                    productNameEn: item.product?.nameEn,
                    quantity: item.quantity,
                    reason: item.reason,
                  }))
                : [],
              reason: ret.reason,
              createdAt: formatDate(ret.createdAt, language),
            });
          });
        }

        const newSales = salesResponse.sales.map((sale: any) => ({
          _id: sale._id,
          saleNumber: sale.saleNumber || 'N/A',
          branch: {
            _id: sale.branch?._id || 'unknown',
            name: sale.branch?.name || t.branches.unknown,
            nameEn: sale.branch?.nameEn,
            displayName: isRtl
              ? sale.branch?.name
              : sale.branch?.nameEn || sale.branch?.name || t.branches.unknown,
          },
          items: Array.isArray(sale.items)
            ? sale.items.map((item: any) => ({
                productId: item.product?._id || item.productId,
                productName: item.product?.name || t.departments.unknown,
                productNameEn: item.product?.nameEn,
                unit: item.product?.unit,
                unitEn: item.product?.unitEn,
                displayName: isRtl
                  ? item.product?.name || t.departments.unknown
                  : item.product?.nameEn || item.product?.name || t.departments.unknown,
                displayUnit: isRtl
                  ? item.product?.unit || t.units.default
                  : item.product?.unitEn || item.product?.unit || t.units.default,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
              }))
            : [],
          totalAmount: sale.totalAmount || 0,
          createdAt: formatDate(sale.createdAt, language),
          notes: sale.notes,
          paymentMethod: sale.paymentMethod,
          customerName: sale.customerName,
          customerPhone: sale.customerPhone,
          returns: returnsMap.get(sale._id) || [],
        }));

        setSales((prev) => (append ? [...prev, ...newSales] : newSales));
        setHasMore(salesResponse.total > pageNum * 20);

        const fetchedBranches = Array.isArray(branchesResponse.branches)
          ? branchesResponse.branches.map((branch: any) => ({
              _id: branch._id,
              name: branch.name || t.branches.unknown,
              nameEn: branch.nameEn,
              displayName: isRtl ? branch.name : branch.nameEn || branch.name || t.branches.unknown,
            }))
          : [];
        setBranches(fetchedBranches);
        if (fetchedBranches.length === 0) {
          setError(t.errors.no_branches_available);
          toast.warn(t.errors.no_branches_available, { position: isRtl ? 'top-right' : 'top-left' });
        }

        const newInventory = Array.isArray(inventoryResponse)
          ? inventoryResponse
              .filter((item: any) => item.currentStock > 0 && item.product?._id)
              .map((item: any) => ({
                _id: item._id,
                product: {
                  _id: item.product?._id || 'unknown',
                  name: item.product?.name || t.departments.unknown,
                  nameEn: item.product?.nameEn,
                  unit: item.product?.unit,
                  unitEn: item.product?.unitEn,
                  price: item.product?.price || 0,
                  department: item.product?.department
                    ? {
                        _id: item.product.department._id || 'unknown',
                        name: item.product.department.name || t.departments.unknown,
                        nameEn: item.product.department.nameEn,
                        displayName: isRtl
                          ? item.product.department.name
                          : item.product.department.nameEn || item.product.department.name || t.departments.unknown,
                      }
                    : undefined,
                },
                currentStock: item.currentStock || 0,
                displayName: isRtl
                  ? item.product?.name || t.departments.unknown
                  : item.product?.nameEn || item.product?.name || t.departments.unknown,
                displayUnit: isRtl
                  ? item.product?.unit || t.units.default
                  : item.product?.unitEn || item.product?.unit || t.units.default,
              }))
          : [];
        setInventory(newInventory);

        setAnalytics({
          totalSales: analyticsResponse.totalSales || 0,
          totalCount: analyticsResponse.totalCount || 0,
          averageOrderValue: analyticsResponse.averageOrderValue || 0,
          topProducts: (analyticsResponse.productSales || []).map((ps: any) => ({
            productId: ps.productId,
            productName: ps.productName || t.departments.unknown,
            productNameEn: ps.productNameEn,
            displayName: isRtl
              ? ps.productName || t.departments.unknown
              : ps.productNameEn || ps.productName || t.departments.unknown,
            totalQuantity: ps.totalQuantity || 0,
            totalRevenue: ps.totalRevenue || 0,
          })),
          salesTrends: (analyticsResponse.salesTrends || []).map((trend: any) => ({
            period: trend.period,
            totalSales: trend.totalSales || 0,
            saleCount: trend.saleCount || 0,
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
      }
    },
    [user, selectedBranch, filterPeriod, startDate, endDate, isRtl, t, language]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
            displayName: isRtl
              ? product.product.name || t.departments.unknown
              : product.product.nameEn || product.product.name || t.departments.unknown,
            displayUnit: isRtl
              ? product.product.unit || t.units.default
              : product.product.unitEn || product.product.unit || t.units.default,
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
                displayName: isRtl
                  ? product.product.name || t.departments.unknown
                  : product.product.nameEn || product.product.name || t.departments.unknown,
                displayUnit: isRtl
                  ? product.product.unit || t.units.default
                  : product.product.unitEn || product.product.unit || t.units.default,
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
    if (paymentMethod && !['cash', 'credit_card', 'bank_transfer'].includes(paymentMethod)) {
      toast.error(t.errors.invalid_payment_method, { position: isRtl ? 'top-right' : 'top-left' });
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
      paymentMethod: paymentMethod || undefined,
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
      setPaymentMethod('cash');
      fetchData();
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Sale submission error:`, err);
      toast.error(err.message || t.errors.create_sale_failed, { position: isRtl ? 'top-right' : 'top-left' });
    }
  }, [cart, notes, paymentMethod, customerName, customerPhone, user, selectedBranch, inventory, t, isRtl, fetchData]);

  const handleEditSale = useCallback((sale: Sale) => {
    setEditSale(sale);
    setEditForm({
      items: sale.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      notes: sale.notes,
      paymentMethod: sale.paymentMethod,
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
    });
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editSale) return;
    if (editForm.items.length === 0) {
      toast.error(t.errors.empty_cart, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    if (editForm.customerPhone && !/^\+?\d{7,15}$/.test(editForm.customerPhone)) {
      toast.error(t.errors.invalid_customer_phone, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    if (editForm.paymentMethod && !['cash', 'credit_card', 'bank_transfer'].includes(editForm.paymentMethod)) {
      toast.error(t.errors.invalid_payment_method, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    for (const item of editForm.items) {
      const product = inventory.find((inv) => inv.product._id === item.productId);
      if (!product) {
        toast.error(t.errors.deleted_product, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      if (item.quantity > product.currentStock) {
        toast.error(`${t.errors.insufficient_stock}: ${product.displayName}`, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      if (item.quantity <= 0) {
        toast.error(`${t.errors.invalid_quantity}: ${product.displayName}`, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
    }
    try {
      await salesAPI.update(editSale._id, editForm);
      toast.success(t.editSale, { position: isRtl ? 'top-right' : 'top-left' });
      setEditSale(null);
      fetchData();
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Sale update error:`, err);
      toast.error(err.message || t.errors.update_sale_failed, { position: isRtl ? 'top-right' : 'top-left' });
    }
  }, [editSale, editForm, inventory, t, isRtl, fetchData]);

  const handleDeleteSale = useCallback(
    async (id: string) => {
      if (window.confirm(t.confirmDelete)) {
        try {
          await salesAPI.delete(id);
          toast.success(t.deleteSale, { position: isRtl ? 'top-right' : 'top-left' });
          fetchData();
        } catch (err: any) {
          console.error(`[${new Date().toISOString()}] Delete sale error:`, err);
          toast.error(err.message || t.errors.delete_sale_failed, { position: isRtl ? 'top-right' : 'top-left' });
        }
      }
    },
    [t, isRtl, fetchData]
  );

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

  const paymentMethodOptions = useMemo(
    () => [
      { value: 'cash', label: t.paymentMethods.cash },
      { value: 'credit_card', label: t.paymentMethods.credit_card },
      { value: 'bank_transfer', label: t.paymentMethods.bank_transfer },
    ],
    [t.paymentMethods]
  );

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

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div className={`min-h-screen bg-gray-50 px-4 sm:px-6 py-8 ${isRtl ? 'font-alexandria' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600&display=swap" rel="stylesheet" />
      <header className="mb-8">
        <div className="flex items-center gap-4 mb-6">
          <DollarSign className="w-8 h-8 text-amber-600" />
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-gray-800 font-alexandria">{t.title}</h1>
            <p className="text-gray-500 text-base font-alexandria">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex gap-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('new')}
            className={`px-4 py-2 text-base font-medium font-alexandria ${activeTab === 'new' ? 'border-b-2 border-amber-600 text-amber-600' : 'text-gray-500 hover:text-amber-600'}`}
          >
            {t.newSale}
          </button>
          <button
            onClick={() => setActiveTab('previous')}
            className={`px-4 py-2 text-base font-medium font-alexandria ${activeTab === 'previous' ? 'border-b-2 border-amber-600 text-amber-600' : 'text-gray-500 hover:text-amber-600'}`}
          >
            {t.previousSales}
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 text-base font-medium font-alexandria ${activeTab === 'analytics' ? 'border-b-2 border-amber-600 text-amber-600' : 'text-gray-500 hover:text-amber-600'}`}
          >
            {t.branchAnalytics}
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <span className="text-red-600 text-base font-medium font-alexandria">{error}</span>
        </div>
      )}

      {activeTab === 'new' && (
        <div className={`space-y-8 ${cart.length > 0 ? 'lg:grid lg:grid-cols-3 lg:gap-8 lg:space-y-0' : ''}`}>
          <section className={`${cart.length > 0 ? 'lg:col-span-2' : ''}`}>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-800 mb-6 font-alexandria">{t.availableProducts}</h2>
              {!user?.branchId && (
                <ProductDropdown
                  value={selectedBranch}
                  onChange={setSelectedBranch}
                  options={branchOptions}
                  ariaLabel={t.branches.select_branch}
                  disabled={!!user?.branchId}
                  className="mb-6"
                />
              )}
              <ProductSearchInput
                value={searchInput}
                onChange={handleSearchChange}
                placeholder={t.searchPlaceholder}
                ariaLabel={t.searchPlaceholder}
              />
              <div className="mt-4 text-center text-sm text-gray-600 font-medium font-alexandria">
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
                <p className="text-gray-600 text-base font-medium font-alexandria">{t.noProducts}</p>
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
            <aside className="lg:col-span-1 lg:sticky lg:top-8">
              <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-xl font-semibold text-gray-800 mb-6 font-alexandria">{t.cart}</h3>
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div key={item.productId} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800 text-sm font-alexandria">{item.displayName || t.errors.deleted_product}</p>
                        <p className="text-sm text-gray-600 font-alexandria">
                          {item.quantity} x {item.unitPrice} = {(item.quantity * item.unitPrice).toFixed(2)} {t.currency}
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
                          className="w-8 h-8 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors duration-300 flex items-center justify-center"
                          aria-label={isRtl ? 'إزالة المنتج' : 'Remove item'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="border-t pt-4">
                    <div className="flex justify-between font-semibold text-gray-800 text-base font-alexandria">
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
                      className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm font-alexandria`}
                      aria-label={t.customerName}
                    />
                    <input
                      type="text"
                      value={customerPhone || ''}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder={t.customerPhone}
                      className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm font-alexandria`}
                      aria-label={t.customerPhone}
                    />
                    <ProductDropdown
                      value={paymentMethod}
                      onChange={setPaymentMethod}
                      options={paymentMethodOptions}
                      ariaLabel={t.paymentMethod}
                    />
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={t.notes}
                      className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm font-alexandria resize-none h-24`}
                      aria-label={t.notes}
                    />
                  </div>
                  <button
                    onClick={handleSubmitSale}
                    className="w-full mt-4 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-base font-medium transition-colors duration-300 disabled:opacity-50 font-alexandria"
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
        <div className="space-y-8">
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-6 font-alexandria">{t.filters}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <ProductSearchInput
                value={searchInput}
                onChange={handleSearchChange}
                placeholder={t.searchPlaceholder}
                ariaLabel={t.searchPlaceholder}
              />
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
                    className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm font-alexandria`}
                    aria-label={t.date}
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm font-alexandria`}
                    aria-label={t.date}
                  />
                </>
              )}
            </div>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 gap-6">
              {[...Array(3)].map((_, index) => (
                <SaleSkeletonCard key={index} />
              ))}
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100">
              <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-base font-medium font-alexandria">{t.noSales}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6">
                {filteredSales.map((sale) => (
                  <SaleCard key={sale._id} sale={sale} onEdit={handleEditSale} onDelete={handleDeleteSale} />
                ))}
              </div>
              {hasMore && (
                <div className="flex justify-center mt-6">
                  <button
                    onClick={loadMoreSales}
                    className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-base font-medium transition-colors duration-300 disabled:opacity-50 font-alexandria"
                    disabled={salesLoading}
                  >
                    {salesLoading ? (
                      <svg className="animate-spin h-6 w-6 text-white mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-2 font-alexandria">{t.totalSales}</h3>
              <p className="text-2xl font-bold text-amber-600 font-alexandria">{analytics.totalSales.toFixed(2)} {t.currency}</p>
            </div>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-2 font-alexandria">{t.totalCount}</h3>
              <p className="text-2xl font-bold text-amber-600 font-alexandria">{analytics.totalCount}</p>
            </div>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-2 font-alexandria">{t.averageOrderValue}</h3>
              <p className="text-2xl font-bold text-amber-600 font-alexandria">{analytics.averageOrderValue.toFixed(2)} {t.currency}</p>
            </div>
          </div>
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 font-alexandria">{t.topProducts}</h2>
            <BarChart width={500} height={300} data={analytics.topProducts.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="displayName" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="totalRevenue" fill="#FBBF24" />
            </BarChart>
          </div>
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 font-alexandria">{t.salesTrends}</h2>
            <LineChart width={500} height={300} data={analytics.salesTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="totalSales" stroke="#8884d8" />
              <Line type="monotone" dataKey="saleCount" stroke="#82ca9d" />
            </LineChart>
          </div>
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 font-alexandria">{t.topProducts}</h2>
            <PieChart width={500} height={300}>
              <Pie
                data={analytics.topProducts.slice(0, 10)}
                dataKey="totalRevenue"
                nameKey="displayName"
                cx="50%"
                cy="50%"
                outerRadius={100}
                fill="#8884d8"
                label
              >
                {analytics.topProducts.slice(0, 10).map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </div>
        </div>
      )}

      {editSale && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 w-full max-w-lg">
            <h2 className="text-xl font-semibold text-gray-800 mb-6 font-alexandria">{t.editSale}</h2>
            <div className="space-y-4">
              <input
                type="text"
                value={editForm.customerName || ''}
                onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
                placeholder={t.customerName}
                className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm font-alexandria`}
                aria-label={t.customerName}
              />
              <input
                type="text"
                value={editForm.customerPhone || ''}
                onChange={(e) => setEditForm({ ...editForm, customerPhone: e.target.value })}
                placeholder={t.customerPhone}
                className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm font-alexandria`}
                aria-label={t.customerPhone}
              />
              <ProductDropdown
                value={editForm.paymentMethod || ''}
                onChange={(value) => setEditForm({ ...editForm, paymentMethod: value })}
                options={paymentMethodOptions}
                ariaLabel={t.paymentMethod}
              />
              <textarea
                value={editForm.notes || ''}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder={t.notes}
                className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-600 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm font-alexandria resize-none h-24`}
                aria-label={t.notes}
              />
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2 font-alexandria">{t.cart}</h3>
                {editForm.items.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={item.productId}
                      onChange={(e) => {
                        const newItems = [...editForm.items];
                        newItems[index].productId = e.target.value;
                        setEditForm({ ...editForm, items: newItems });
                      }}
                      placeholder={isRtl ? 'معرف المنتج' : 'Product ID'}
                      className={`flex-1 ${isRtl ? 'pr-4' : 'pl-4'} py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-600 focus:border-transparent bg-white shadow-sm text-sm font-alexandria`}
                      aria-label={isRtl ? 'معرف المنتج' : 'Product ID'}
                    />
                    <QuantityInput
                      value={item.quantity}
                      onChange={(val) => {
                        const newItems = [...editForm.items];
                        newItems[index].quantity = parseInt(val) || 0;
                        setEditForm({ ...editForm, items: newItems });
                      }}
                      onIncrement={() => {
                        const newItems = [...editForm.items];
                        newItems[index].quantity += 1;
                        setEditForm({ ...editForm, items: newItems });
                      }}
                      onDecrement={() => {
                        const newItems = [...editForm.items];
                        newItems[index].quantity = Math.max(0, newItems[index].quantity - 1);
                        setEditForm({ ...editForm, items: newItems });
                      }}
                    />
                    <input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) => {
                        const newItems = [...editForm.items];
                        newItems[index].unitPrice = parseFloat(e.target.value) || 0;
                        setEditForm({ ...editForm, items: newItems });
                      }}
                      placeholder={t.unitPrice}
                      className={`w-24 ${isRtl ? 'pr-4' : 'pl-4'} py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-600 focus:border-transparent bg-white shadow-sm text-sm font-alexandria`}
                      aria-label={t.unitPrice}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 flex gap-4">
              <button
                onClick={handleSaveEdit}
                className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-base font-medium transition-colors duration-300 font-alexandria"
                aria-label={t.save}
              >
                {t.save}
              </button>
              <button
                onClick={() => setEditSale(null)}
                className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-xl text-base font-medium transition-colors duration-300 font-alexandria"
                aria-label={t.cancel}
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(BranchSalesReport);