import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage, Language } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { branchesAPI, inventoryAPI, salesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, DollarSign, Plus, Minus, Trash2, Package, Search, X, ChevronDown, Edit } from 'lucide-react';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

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

interface AnalyticsData {
  totalSales: number;
  totalCount: number;
  averageOrderValue: number;
  topProduct: { name: string; quantity: number };
}

const translations = {
  ar: {
    title: 'تقرير المبيعات',
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
    analytics: 'إحصائيات الفرع',
    noSales: 'لا توجد مبيعات',
    date: 'التاريخ',
    returns: 'المرتجعات',
    return: 'مرتجع',
    reason: 'السبب',
    quantity: 'الكمية',
    searchPlaceholder: 'ابحث عن اسم العميل أو رقم أو تاريخ أو منتج...',
    loadMore: 'تحميل المزيد',
    filterBy: 'تصفية حسب',
    customRange: 'نطاق مخصص',
    deleteSale: 'حذف المبيعة',
    editSale: 'تعديل المبيعة',
    confirmDelete: 'هل أنت متأكد من حذف هذه المبيعة؟',
    updateSale: 'تحديث المبيعة',
    errors: {
      unauthorized_access: 'غير مصرح لك بالوصول',
      no_branch_assigned: 'لم يتم تعيين فرع',
      fetch_sales: 'خطأ أثناء جلب المبيعات',
      fetch_branches: 'خطأ أثناء جلب الفروع',
      fetch_inventory: 'خطأ أثناء جلب المخزون',
      create_sale_failed: 'فشل إنشاء المبيعة',
      insufficient_stock: 'المخزون غير كافٍ',
      exceeds_max_quantity: 'الكمية تتجاوز الحد الأقصى',
      invalid_quantity: 'الكمية غير صالحة',
      empty_cart: 'السلة فارغة',
      deleted_product: 'منتج محذوف',
      invalid_customer_phone: 'رقم هاتف العميل غير صالح',
      invalid_payment_method: 'طريقة الدفع غير صالحة',
      no_branches_available: 'لا توجد فروع متاحة',
      delete_sale_failed: 'فشل حذف المبيعة',
      update_sale_failed: 'فشل تحديث المبيعة',
      fetch_analytics: 'خطأ أثناء جلب الإحصائيات',
    },
    currency: 'ريال',
    units: { default: 'غير محدد' },
    branches: { all_branches: 'كل الفروع', select_branch: 'اختر الفرع', unknown: 'غير معروف' },
    paymentMethods: {
      cash: 'نقدي',
      credit_card: 'بطاقة ائتمان',
      bank_transfer: 'تحويل بنكي',
    },
    analyticsLabels: {
      totalSales: 'إجمالي المبيعات',
      totalCount: 'عدد المبيعات',
      averageOrderValue: 'متوسط قيمة الطلب',
      topProduct: 'المنتج الأكثر مبيعاً',
    },
  },
  en: {
    title: 'Sales Report',
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
    analytics: 'Branch Analytics',
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
    deleteSale: 'Delete Sale',
    editSale: 'Edit Sale',
    confirmDelete: 'Are you sure you want to delete this sale?',
    updateSale: 'Update Sale',
    errors: {
      unauthorized_access: 'You are not authorized to access',
      no_branch_assigned: 'No branch assigned',
      fetch_sales: 'Error fetching sales',
      fetch_branches: 'Error fetching branches',
      fetch_inventory: 'Error fetching inventory',
      create_sale_failed: 'Failed to create sale',
      insufficient_stock: 'Insufficient stock',
      exceeds_max_quantity: 'Quantity exceeds maximum available',
      invalid_quantity: 'Invalid quantity',
      empty_cart: 'Cart is empty',
      deleted_product: 'Deleted Product',
      invalid_customer_phone: 'Invalid customer phone',
      invalid_payment_method: 'Invalid payment method',
      no_branches_available: 'No branches available',
      delete_sale_failed: 'Failed to delete sale',
      update_sale_failed: 'Failed to update sale',
      fetch_analytics: 'Error fetching analytics',
    },
    currency: 'SAR',
    units: { default: 'N/A' },
    branches: { all_branches: 'All Branches', select_branch: 'Select Branch', unknown: 'Unknown' },
    paymentMethods: {
      cash: 'Cash',
      credit_card: 'Credit Card',
      bank_transfer: 'Bank Transfer',
    },
    analyticsLabels: {
      totalSales: 'Total Sales',
      totalCount: 'Sales Count',
      averageOrderValue: 'Average Order Value',
      topProduct: 'Top Selling Product',
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
      <Search className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors group-focus-within:text-amber-500 ${value ? 'opacity-0' : 'opacity-100'}`} />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full ${isRtl ? 'pl-12 pr-4' : 'pr-12 pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}
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
        <Minus className="w-4 h-4" />
      </button>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-12 h-8 text-center border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm transition-all duration-200"
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
    <div className="h-[200px] p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-amber-200">
      <div className="space-y-2">
        <h3 className="font-bold text-gray-900 text-base truncate">{product.displayName}</h3>
        <p className="text-sm text-amber-600">{t.availableStock}: {product.currentStock} {product.displayUnit || t.units.default}</p>
        <p className="font-semibold text-gray-900 text-sm">{t.unitPrice}: {product.product.price} {t.currency}</p>
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
              className="w-8 h-8 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors duration-200 flex items-center justify-center"
              aria-label={isRtl ? 'إزالة المنتج' : 'Remove item'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onAdd}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm transition-colors duration-200 flex items-center justify-center gap-2 shadow-sm"
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
      <div className="p-3 bg-white rounded-md shadow-sm border border-gray-100">
        <div className="flex flex-col space-y-2">
          <div className="flex justify-between">
            <h3 className="font-semibold text-sm text-gray-800">{sale.saleNumber}</h3>
            <div className="flex gap-2">
              <Edit className="w-4 h-4 text-blue-500 cursor-pointer" onClick={() => onEdit(sale)} />
              <Trash2 className="w-4 h-4 text-red-500 cursor-pointer" onClick={() => onDelete(sale._id)} />
            </div>
          </div>
          <p className="text-xs text-gray-500">{t.date}: {sale.createdAt}</p>
          <p className="text-xs text-gray-500">{sale.branch.displayName}</p>
          {sale.customerName && <p className="text-xs text-gray-500">{t.customerName}: {sale.customerName}</p>}
          {sale.customerPhone && <p className="text-xs text-gray-500">{t.customerPhone}: {sale.customerPhone}</p>}
          {sale.paymentMethod && (
            <p className="text-xs text-gray-500">{t.paymentMethod}: {t.paymentMethods[sale.paymentMethod as keyof typeof t.paymentMethods]}</p>
          )}
          {sale.notes && <p className="text-xs text-gray-500">{t.notes}: {sale.notes}</p>}
          <ul className="space-y-1 text-xs text-gray-600">
            {sale.items.map((item, idx) => (
              <li key={idx}>
                {item.quantity} x {item.unitPrice} {t.currency}
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500 font-semibold">{t.total}: {sale.totalAmount} {t.currency}</p>
        </div>
      </div>
    );
  }
);

const ProductSkeletonCard = React.memo(() => (
  <div className="h-[200px] p-5 bg-white rounded-xl shadow-sm border border-gray-100">
    <div className="space-y-3 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      <div className="h-3 bg-gray-200 rounded w-1/3"></div>
      <div className="mt-4 flex justify-end">
        <div className="h-8 bg-gray-200 rounded-lg w-24"></div>
      </div>
    </div>
  </div>
));

const SaleSkeletonCard = React.memo(() => (
  <div className="p-3 bg-white rounded-md shadow-sm border border-gray-100">
    <div className="space-y-3 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      <div className="h-3 bg-gray-200 rounded w-1/3"></div>
    </div>
  </div>
));

const EditSaleModal = React.memo(({ sale, onClose, onSave, t, isRtl }: { sale: Sale; onClose: () => void; onSave: (updatedSale: Partial<Sale>) => void; t: any; isRtl: boolean }) => {
  const [updatedNotes, setUpdatedNotes] = useState(sale.notes || '');
  const [updatedPaymentMethod, setUpdatedPaymentMethod] = useState(sale.paymentMethod || 'cash');
  const [updatedCustomerName, setUpdatedCustomerName] = useState(sale.customerName || '');
  const [updatedCustomerPhone, setUpdatedCustomerPhone] = useState(sale.customerPhone || '');

  const paymentMethodOptions = useMemo(
    () => [
      { value: 'cash', label: t.paymentMethods.cash },
      { value: 'credit_card', label: t.paymentMethods.credit_card },
      { value: 'bank_transfer', label: t.paymentMethods.bank_transfer },
    ],
    [t.paymentMethods]
  );

  const handleSave = () => {
    onSave({
      notes: updatedNotes.trim() || undefined,
      paymentMethod: updatedPaymentMethod || undefined,
      customerName: updatedCustomerName.trim() || undefined,
      customerPhone: updatedCustomerPhone.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
        <h3 className="text-lg font-semibold mb-4">{t.editSale}</h3>
        <input
          type="text"
          value={updatedCustomerName}
          onChange={(e) => setUpdatedCustomerName(e.target.value)}
          placeholder={t.customerName}
          className="w-full mb-4 p-2 border rounded text-sm"
        />
        <input
          type="text"
          value={updatedCustomerPhone}
          onChange={(e) => setUpdatedCustomerPhone(e.target.value)}
          placeholder={t.customerPhone}
          className="w-full mb-4 p-2 border rounded text-sm"
        />
        <ProductDropdown
          value={updatedPaymentMethod}
          onChange={setUpdatedPaymentMethod}
          options={paymentMethodOptions}
          ariaLabel={t.paymentMethod}
          className="mb-4"
        />
        <textarea
          value={updatedNotes}
          onChange={(e) => setUpdatedNotes(e.target.value)}
          placeholder={t.notes}
          className="w-full mb-4 p-2 border rounded h-24 text-sm"
        />
        <div className="flex gap-2">
          <button onClick={handleSave} className="px-4 py-2 bg-amber-600 text-white rounded text-sm">{t.updateSale}</button>
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded text-sm">{isRtl ? 'إلغاء' : 'Cancel'}</button>
        </div>
      </div>
    </div>
  );
});

export const BranchSalesReport: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [activeTab, setActiveTab] = useState<'new' | 'previous' | 'analytics'>('new');
  const [sales, setSales] = useState<Sale[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [salesLoading, setSalesLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState<string | undefined>(undefined);
  const [selectedBranch, setSelectedBranch] = useState(user?.role === 'branch' && user?.branchId ? user.branchId : '');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);

  const debouncedSearch = useCallback(debounce((value: string) => setSearchTerm(value.trim()), 300), []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    debouncedSearch(e.target.value);
  };

  const filteredInventory = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return inventory.filter((item) => item.displayName.toLowerCase().includes(lowerSearchTerm));
  }, [inventory, searchTerm]);

  // تحديث displayName و displayUnit عند تغيير اللغة
  useEffect(() => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        const product = inventory.find((inv) => inv.product._id === item.productId);
        return {
          ...item,
          displayName: product
            ? isRtl
              ? product.product.name || t.departments.unknown
              : product.product.nameEn || product.product.name || t.departments.unknown
            : item.displayName,
          displayUnit: product
            ? isRtl
              ? product.product.unit || t.units.default
              : product.product.unitEn || product.product.unit || t.units.default
            : item.displayUnit,
        };
      })
    );

    setInventory((prevInventory) =>
      prevInventory.map((item) => ({
        ...item,
        displayName: isRtl
          ? item.product.name || t.departments.unknown
          : item.product.nameEn || item.product.name || t.departments.unknown,
        displayUnit: isRtl
          ? item.product.unit || t.units.default
          : item.product.unitEn || item.product.unit || t.units.default,
      }))
    );

    setSales((prevSales) =>
      prevSales.map((sale) => ({
        ...sale,
        branch: {
          ...sale.branch,
          displayName: isRtl ? sale.branch.name : (sale.branch.nameEn || sale.branch.name || t.branches.unknown),
        },
        items: sale.items.map((item) => ({
          ...item,
          displayName: isRtl
            ? item.productName || t.departments.unknown
            : item.productNameEn || item.productName || t.departments.unknown,
          displayUnit: isRtl
            ? item.unit || t.units.default
            : item.unitEn || item.unit || t.units.default,
        })),
      }))
    );
  }, [language, inventory, isRtl, t]);

  // جلب البيانات (مبيعات، فروع، مخزون)
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

        const [salesResponse, branchesResponse, inventoryResponse] = await Promise.all([
          salesAPI.getAll(salesParams).catch((err) => {
            toast.error(t.errors.fetch_sales, { position: isRtl ? 'top-right' : 'top-left' });
            return { sales: [], total: 0, returns: [] };
          }),
          branchesAPI.getAll().catch((err) => {
            toast.error(t.errors.fetch_branches, { position: isRtl ? 'top-right' : 'top-left' });
            return { branches: [] };
          }),
          inventoryAPI.getInventory(inventoryParams).catch((err) => {
            toast.error(t.errors.fetch_inventory, { position: isRtl ? 'top-right' : 'top-left' });
            return [];
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
            displayName: isRtl ? sale.branch?.name : (sale.branch?.nameEn || sale.branch?.name || t.branches.unknown),
          },
          items: Array.isArray(sale.items)
            ? sale.items.map((item: any) => ({
                productId: item.product?._id || item.productId,
                productName: item.product?.name || t.departments.unknown,
                productNameEn: item.product?.nameEn,
                unit: item.product?.unit,
                unitEn: item.product?.unitEn,
                displayName: isRtl ? (item.product?.name || t.departments.unknown) : (item.product?.nameEn || item.product?.name || t.departments.unknown),
                displayUnit: isRtl ? (item.product?.unit || t.units.default) : (item.product?.unitEn || item.product?.unit || t.units.default),
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
              displayName: isRtl ? branch.name : (branch.nameEn || branch.name || t.branches.unknown),
            }))
          : [];
        setBranches(fetchedBranches);

        if (fetchedBranches.length === 0 && !user?.branchId) {
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
                        displayName: isRtl ? (item.product.department.name || t.departments.unknown) : (item.product.department.nameEn || item.product.department.name || t.departments.unknown),
                      }
                    : undefined,
                },
                currentStock: item.currentStock || 0,
                displayName: isRtl ? (item.product?.name || t.departments.unknown) : (item.product?.nameEn || item.product?.name || t.departments.unknown),
                displayUnit: isRtl ? (item.product?.unit || t.units.default) : (item.product?.unitEn || item.product?.unit || t.units.default),
              }))
          : [];
        setInventory(newInventory);

        if (newInventory.length === 0) {
          setError(t.noProducts);
          toast.warn(t.noProducts, { position: isRtl ? 'top-right' : 'top-left' });
        } else {
          setError('');
        }
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
    [filterPeriod, startDate, endDate, user, t, isRtl, language, selectedBranch]
  );

  // جلب بيانات الإحصائيات
  const fetchAnalytics = useCallback(async () => {
    if (!user?.branchId) {
      setError(t.errors.no_branch_assigned);
      toast.error(t.errors.no_branch_assigned, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    setAnalyticsLoading(true);
    try {
      const analyticsResponse = await salesAPI.getAnalytics({ branch: user.branchId });
      setAnalytics({
        totalSales: analyticsResponse.totalSales || 0,
        totalCount: analyticsResponse.totalCount || 0,
        averageOrderValue: analyticsResponse.averageOrderValue || 0,
        topProduct: analyticsResponse.topProduct || { name: t.branches.unknown, quantity: 0 },
      });
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Analytics fetch error:`, err);
      setError(t.errors.fetch_analytics);
      toast.error(t.errors.fetch_analytics, { position: isRtl ? 'top-right' : 'top-left' });
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [user, t, isRtl]);

  useEffect(() => {
    if (!inventory.length && !error) {
      fetchData();
    }
    if (activeTab === 'analytics' && !analytics) {
      fetchAnalytics();
    }
  }, [fetchData, fetchAnalytics, inventory, error, activeTab, analytics]);

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
            displayName: isRtl ? (product.product.name || t.departments.unknown) : (product.product.nameEn || product.product.name || t.departments.unknown),
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
                displayName: isRtl ? (product.product.name || t.departments.unknown) : (product.product.nameEn || product.product.name || t.departments.unknown),
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

    if (paymentMethod && !['cash', 'credit_card', 'bank_transfer'].includes(paymentMethod)) {
      toast.error(t.errors.invalid_payment_method, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }

    const effectiveBranch = user?.branchId || selectedBranch;
    if (!effectiveBranch) {
      toast.error(t.errors.no_branch_assigned, { position: isRtl ? 'top-right' : 'top-left' });
      return;
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
      toast.error(t.errors.create_sale_failed, { position: isRtl ? 'top-right' : 'top-left' });
    }
  }, [cart, notes, paymentMethod, customerName, customerPhone, user, selectedBranch, t, isRtl, fetchData]);

  const handleDeleteSale = useCallback(
    async (id: string) => {
      if (window.confirm(t.confirmDelete)) {
        try {
          await salesAPI.delete(id);
          toast.success(t.deleteSale, { position: isRtl ? 'top-right' : 'top-left' });
          fetchData();
        } catch (err) {
          toast.error(t.errors.delete_sale_failed, { position: isRtl ? 'top-right' : 'top-left' });
        }
      }
    },
    [t, fetchData, isRtl]
  );

  const handleUpdateSale = useCallback(
    async (id: string, updatedData: Partial<Sale>) => {
      try {
        await salesAPI.update(id, updatedData);
        toast.success(t.updateSale, { position: isRtl ? 'top-right' : 'top-left' });
        fetchData();
        setEditingSale(null);
      } catch (err) {
        toast.error(t.errors.update_sale_failed, { position: isRtl ? 'top-right' : 'top-left' });
      }
    },
    [t, fetchData, isRtl]
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

  const searchTypeOptions = useMemo(
    () => [
      { value: 'all', label: isRtl ? 'الكل' : 'All' },
      { value: 'customerName', label: t.customerName },
      { value: 'customerPhone', label: t.customerPhone },
      { value: 'date', label: t.date },
      { value: 'product', label: isRtl ? 'المنتج' : 'Product' },
    ],
    [t, isRtl]
  );

  const totalCartAmount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toFixed(2);
  }, [cart]);

  const filteredSales = useMemo(() => {
    if (!searchTerm) return sales;
    const lowerSearch = searchTerm.toLowerCase();
    return sales.filter((sale) => {
      if (searchType === 'customerName') return sale.customerName?.toLowerCase().includes(lowerSearch);
      if (searchType === 'customerPhone') return sale.customerPhone?.toLowerCase().includes(lowerSearch);
      if (searchType === 'date') return sale.createdAt.toLowerCase().includes(lowerSearch);
      if (searchType === 'product') return sale.items.some((item) => item.displayName.toLowerCase().includes(lowerSearch));
      return (
        sale.saleNumber.toLowerCase().includes(lowerSearch) ||
        sale.customerName?.toLowerCase().includes(lowerSearch) ||
        sale.customerPhone?.toLowerCase().includes(lowerSearch) ||
        sale.createdAt.toLowerCase().includes(lowerSearch) ||
        sale.items.some((item) => item.displayName.toLowerCase().includes(lowerSearch))
      );
    });
  }, [sales, searchTerm, searchType]);

  // بيانات الرسوم البيانية
  const chartColors = ['#FBBF24', '#3B82F6', '#FF6384', '#4BC0C0'];
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1F2937',
        titleColor: '#FFFFFF',
        bodyColor: '#FFFFFF',
        borderColor: '#4B5563',
        borderWidth: 1,
        titleFont: { size: 10, family: 'sans-serif' },
        bodyFont: { size: 10, family: 'sans-serif' },
        padding: 8,
      },
    },
    scales: {
      x: {
        ticks: { font: { size: 9, family: 'sans-serif' }, color: '#1F2937' },
        grid: { display: false },
      },
      y: {
        ticks: { font: { size: 9, family: 'sans-serif' }, color: '#1F2937' },
        grid: { color: '#E5E7EB' },
        title: {
          display: true,
          text: t.currency,
          font: { size: 10, family: 'sans-serif' },
          color: '#1F2937',
        },
      },
    },
    barPercentage: 0.3,
    categoryPercentage: 0.35,
  };

  const totalSalesChart = useMemo(
    () => ({
      labels: [t.analyticsLabels.totalSales],
      datasets: [{ label: t.analyticsLabels.totalSales, data: [analytics?.totalSales || 0], backgroundColor: chartColors[0] }],
    }),
    [analytics, t]
  );

  const totalCountChart = useMemo(
    () => ({
      labels: [t.analyticsLabels.totalCount],
      datasets: [{ label: t.analyticsLabels.totalCount, data: [analytics?.totalCount || 0], backgroundColor: chartColors[1] }],
    }),
    [analytics, t]
  );

  const averageOrderValueChart = useMemo(
    () => ({
      labels: [t.analyticsLabels.averageOrderValue],
      datasets: [{ label: t.analyticsLabels.averageOrderValue, data: [analytics?.averageOrderValue || 0], backgroundColor: chartColors[2] }],
    }),
    [analytics, t]
  );

  const topProductChart = useMemo(
    () => ({
      labels: [analytics?.topProduct.name || t.branches.unknown],
      datasets: [{ label: t.analyticsLabels.topProduct, data: [analytics?.topProduct.quantity || 0], backgroundColor: chartColors[3] }],
    }),
    [analytics, t]
  );

  if (user?.role !== 'branch') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <AlertCircle className="w-5 h-5 text-red-600" />
        <span className="text-red-600 text-sm ml-2">{t.errors.unauthorized_access}</span>
      </div>
    );
  }

  return (
    <div className={`mx-auto px-4 sm:px-6 py-8 min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 ${isRtl ? 'font-arabic' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <header className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center gap-3">
          <DollarSign className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
            <p className="text-gray-600 text-sm">{t.subtitle}</p>
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm font-medium">{error}</span>
        </div>
      )}

      <div className="mb-8">
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
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'analytics' ? 'border-b-2 border-amber-600 text-amber-600' : 'text-gray-500 hover:text-amber-600'} transition-colors duration-200`}
          >
            {t.analytics}
          </button>
        </div>
      </div>

      {activeTab === 'new' && (
        <div className={`space-y-8 ${cart.length > 0 ? 'lg:grid lg:grid-cols-3 lg:gap-8 lg:space-y-0' : ''}`}>
          <section className={`${cart.length > 0 ? 'lg:col-span-2 lg:overflow-y-auto lg:max-h-[calc(100vh-12rem)] scrollbar-none' : ''}`}>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-6">{t.availableProducts}</h2>
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
              <div className="mt-4 text-center text-sm text-gray-600 font-medium">
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
                <h3 className="text-xl font-bold text-gray-900 mb-6">{t.cart}</h3>
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div key={item.productId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{item.displayName || t.errors.deleted_product}</p>
                        <p className="text-sm text-gray-600">
                          {item.quantity} x {item.unitPrice} {t.currency} = {(item.quantity * item.unitPrice).toFixed(2)} {t.currency}
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
                          className="w-8 h-8 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors duration-200 flex items-center justify-center"
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
                      className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                      aria-label={t.customerName}
                    />
                    <input
                      type="text"
                      value={customerPhone || ''}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder={t.customerPhone}
                      className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
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
                      className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm resize-none h-24 ${isRtl ? 'text-right' : 'text-left'}`}
                      aria-label={t.notes}
                    />
                  </div>
                  <button
                    onClick={handleSubmitSale}
                    className="w-full mt-4 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
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
        <div className="mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">{t.previousSales}</h2>
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">{t.filters}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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
              <ProductDropdown value={searchType} onChange={setSearchType} options={searchTypeOptions} ariaLabel={t.filterBy} />
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
              <ProductSearchInput
                value={searchInput}
                onChange={handleSearchChange}
                placeholder={t.searchPlaceholder}
                ariaLabel={t.searchPlaceholder}
              />
            </div>
          </div>
          {loading ? (
            <div className="space-y-6">
              {[...Array(3)].map((_, index) => (
                <SaleSkeletonCard key={index} />
              ))}
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100">
              <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-sm font-medium">{t.noSales}</p>
            </div>
          ) : (
            <>
              <div className="space-y-6">
                {filteredSales.map((sale) => (
                  <SaleCard
                    key={sale._id}
                    sale={sale}
                    onEdit={() => setEditingSale(sale)}
                    onDelete={() => handleDeleteSale(sale._id)}
                  />
                ))}
              </div>
              {hasMore && (
                <div className="flex justify-center mt-6">
                  <button
                    onClick={loadMoreSales}
                    className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
                    disabled={salesLoading}
                  >
                    {salesLoading ? (
                      <svg className="animate-spin h-5 w-5 text-white mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
        <div className="mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">{t.analytics}</h2>
          {analyticsLoading ? (
            <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100">
              <svg className="animate-spin h-12 w-12 text-gray-400 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-gray-600 text-sm font-medium">{isRtl ? 'جارٍ تحميل الإحصائيات...' : 'Loading analytics...'}</p>
            </div>
          ) : !analytics ? (
            <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-sm font-medium">{t.errors.fetch_analytics}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-3 bg-white rounded-md shadow-sm border border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.analyticsLabels.totalSales}</h3>
                <div className="w-full h-32">
                  <Bar data={totalSalesChart} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { display: true, text: t.analyticsLabels.totalSales } } }} />
                </div>
              </div>
              <div className="p-3 bg-white rounded-md shadow-sm border border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.analyticsLabels.totalCount}</h3>
                <div className="w-full h-32">
                  <Bar data={totalCountChart} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { display: true, text: t.analyticsLabels.totalCount } } }} />
                </div>
              </div>
              <div className="p-3 bg-white rounded-md shadow-sm border border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.analyticsLabels.averageOrderValue}</h3>
                <div className="w-full h-32">
                  <Bar data={averageOrderValueChart} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { display: true, text: t.analyticsLabels.averageOrderValue } } }} />
                </div>
              </div>
              <div className="p-3 bg-white rounded-md shadow-sm border border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">{t.analyticsLabels.topProduct}</h3>
                <div className="w-full h-32">
                  <Bar data={topProductChart} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { display: true, text: t.analyticsLabels.topProduct } } }} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {editingSale && (
        <EditSaleModal
          sale={editingSale}
          onClose={() => setEditingSale(null)}
          onSave={(updatedData) => handleUpdateSale(editingSale._id, updatedData)}
          t={t}
          isRtl={isRtl}
        />
      )}
    </div>
  );
};

export default React.memo(BranchSalesReport);