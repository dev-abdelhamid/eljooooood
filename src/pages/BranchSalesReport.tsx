import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { branchesAPI, inventoryAPI, salesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, DollarSign, Plus, Minus, Trash2, Package, Search, X, ChevronDown, Edit, Trash } from 'lucide-react';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';

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
  returns?: Array<{
    _id: string;
    returnNumber: string;
    status: string;
    items: Array<{ product: string; productName: string; productNameEn?: string; quantity: number; reason: string }>;
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
    paymentMethod: 'طريقة الدفع',
    customerName: 'اسم العميل',
    customerPhone: 'هاتف العميل',
    submitSale: 'إرسال المبيعة',
    previousSales: 'المبيعات السابقة',
    noSales: 'لا توجد مبيعات',
    date: 'التاريخ',
    returns: 'المرتجعات',
    return: 'مرتجع',
    reason: 'السبب',
    quantity: 'الكمية',
    searchPlaceholder: 'ابحث عن المنتجات...',
    loadMore: 'تحميل المزيد',
    editSale: 'تعديل المبيعة',
    deleteSale: 'حذف المبيعة',
    confirmDelete: 'هل أنت متأكد من حذف هذه المبيعة؟',
    filterBy: 'تصفية حسب',
    day: 'يوم',
    week: 'أسبوع',
    month: 'شهر',
    customRange: 'نطاق مخصص',
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
      invalid_sale_id: 'معرف المبيعة غير صالح',
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
    paymentMethod: 'Payment Method',
    customerName: 'Customer Name',
    customerPhone: 'Customer Phone',
    submitSale: 'Submit Sale',
    previousSales: 'Previous Sales',
    noSales: 'No sales found',
    date: 'Date',
    returns: 'Returns',
    return: 'Return',
    reason: 'Reason',
    quantity: 'Quantity',
    searchPlaceholder: 'Search products...',
    loadMore: 'Load More',
    editSale: 'Edit Sale',
    deleteSale: 'Delete Sale',
    confirmDelete: 'Are you sure you want to delete this sale?',
    filterBy: 'Filter By',
    day: 'Day',
    week: 'Week',
    month: 'Month',
    customRange: 'Custom Range',
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
      invalid_sale_id: 'Invalid sale ID',
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
    returns: { status: { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' } },
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
        className={`w-full ${isRtl ? 'pl-12 pr-4' : 'pr-12 pl-4'} py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}
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
        className={`w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 bg-gradient-to-r from-white to-gray-50 shadow-sm hover:shadow-md text-sm text-gray-700 ${isRtl ? 'text-right' : 'text-left'} flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={ariaLabel}
      >
        <span className="truncate">{selectedOption.label}</span>
        <ChevronDown className={`${isOpen ? 'rotate-180' : 'rotate-0'} transition-transform duration-200 w-5 h-5 text-gray-400 group-focus-within:text-amber-500`} />
      </button>
      {isOpen && !disabled && (
        <div className="absolute w-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 z-20 max-h-60 overflow-y-auto scrollbar-none">
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
        className="w-12 h-8 text-center border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm transition-all duration-200"
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
        <p className="text-sm text-amber-600">{t.department}: {product.product.department?.displayName || t.departments.unknown}</p>
        <p className="text-sm text-gray-600">{t.availableStock}: {product.currentStock} {product.displayUnit || t.units.default}</p>
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
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm transition-colors duration-200 flex items-center justify-center gap-2 shadow-sm"
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

const SaleCard = React.memo<{ sale: Sale; onEdit: (sale: Sale) => void; onDelete: (id: string) => void }>(({ sale, onEdit, onDelete }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  return (
    <div className="p-6 bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-amber-200">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-gray-900 text-base">{sale.orderNumber} - {sale.branch.displayName}</h3>
          <p className="text-sm text-gray-600">{t.date}: {formatDate(sale.createdAt, language)}</p>
          <p className="text-sm text-gray-600">{t.total}: {sale.totalAmount} {t.currency}</p>
          {sale.paymentMethod && <p className="text-sm text-gray-600">{t.paymentMethod}: {t.paymentMethods[sale.paymentMethod as keyof typeof t.paymentMethods]}</p>}
          {sale.customerName && <p className="text-sm text-gray-600">{t.customerName}: {sale.customerName}</p>}
          {sale.customerPhone && <p className="text-sm text-gray-600">{t.customerPhone}: {sale.customerPhone}</p>}
          {sale.notes && <p className="text-sm text-gray-500">{t.notes}: {sale.notes}</p>}
          <ul className="list-disc list-inside text-sm text-gray-600 mt-2">
            {sale.items.map((item, index) => (
              <li key={index}>
                {item.displayName || t.errors.deleted_product} ({item.department?.displayName || t.departments.unknown}) - {t.quantity}: {item.quantity} {item.displayUnit || t.units.default}, {t.unitPrice}: {item.unitPrice} {t.currency}
              </li>
            ))}
          </ul>
          {sale.returns && sale.returns.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700">{t.returns}:</p>
              <ul className="list-disc list-inside text-sm text-gray-600">
                {sale.returns.map((ret, index) => (
                  <li key={index}>
                    {t.return} #{ret.returnNumber} ({t.returns.status[ret.status as keyof typeof t.returns.status]}) - {t.reason}: {ret.reason} ({t.date}: {formatDate(ret.createdAt, language)})
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
        <div className="flex gap-2">
          <button onClick={() => onEdit(sale)} aria-label={t.editSale}>
            <Edit className="w-5 h-5 text-blue-600 hover:text-blue-800 transition-colors" />
          </button>
          <button onClick={() => onDelete(sale._id)} aria-label={t.deleteSale}>
            <Trash className="w-5 h-5 text-red-600 hover:text-red-800 transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
});

const ProductSkeletonCard = React.memo(() => (
  <div className="h-[200px] p-5 bg-white rounded-xl shadow-sm border border-gray-100">
    <div className="space-y-3 animate-pulse">
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
  <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
    <div className="space-y-3 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      <div className="h-3 bg-gray-200 rounded w-1/3"></div>
    </div>
  </div>
));

const BranchSalesReport: React.FC = () => {
  const { t: languageT, language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [sales, setSales] = useState<Sale[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [filterPeriod, setFilterPeriod] = useState('day');
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
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedBranch, setSelectedBranch] = useState(user?.role === 'branch' && user?.branchId ? user.branchId : '');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);

  const debouncedSearch = useCallback(
    debounce((value: string) => setSearchTerm(value.trim()), 300),
    []
  );

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

      if (!user.branchId && !selectedBranch) {
        setError(t.errors.no_branch_assigned);
        toast.error(t.errors.no_branch_assigned, { position: isRtl ? 'top-right' : 'top-left' });
        setLoading(false);
        return;
      }

      setLoading(pageNum === 1);
      setSalesLoading(pageNum > 1);
      try {
        const salesParams: any = { page: pageNum, limit: 20, sort: '-createdAt', branch: user.branchId || selectedBranch };
        if (filterPeriod === 'day') {
          const today = new Date().toISOString().split('T')[0];
          salesParams.startDate = today;
          salesParams.endDate = today;
        } else if (filterPeriod === 'week') {
          const start = new Date();
          start.setDate(start.getDate() - 7);
          salesParams.startDate = start.toISOString().split('T')[0];
          salesParams.endDate = new Date().toISOString().split('T')[0];
        } else if (filterPeriod === 'month') {
          const start = new Date();
          start.setMonth(start.getMonth() - 1);
          salesParams.startDate = start.toISOString().split('T')[0];
          salesParams.endDate = new Date().toISOString().split('T')[0];
        } else if (filterPeriod === 'custom' && startDate && endDate) {
          salesParams.startDate = startDate;
          salesParams.endDate = endDate;
        }

        const inventoryParams: any = { lowStock: false, branch: user.branchId || selectedBranch };

        const [salesResponse, branchesResponse, inventoryResponse] = await Promise.all([
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
          inventoryAPI.getAll(inventoryParams).catch((err) => {
            console.error(`[${new Date().toISOString()}] Inventory fetch error:`, err);
            toast.error(t.errors.fetch_inventory, { position: isRtl ? 'top-right' : 'top-left' });
            return { inventory: [] };
          }),
        ]);

        const returnsMap = new Map<string, Sale['returns']>();
        if (Array.isArray(salesResponse.returns)) {
          salesResponse.returns.forEach((ret: any) => {
            const orderId = ret.order?._id || ret.order;
            if (!returnsMap.has(orderId)) returnsMap.set(orderId, []);
            returnsMap.get(orderId)!.push({
              _id: ret._id,
              returnNumber: ret.returnNumber,
              status: ret.status,
              items: Array.isArray(ret.items)
                ? ret.items.map((item: any) => ({
                    product: item.product?._id || item.product,
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
          orderNumber: sale.saleNumber || sale.orderNumber,
          branch: {
            _id: sale.branch?._id || 'unknown',
            name: sale.branch?.name || t.branches.unknown,
            nameEn: sale.branch?.nameEn,
            displayName: isRtl ? sale.branch?.name : (sale.branch?.nameEn || sale.branch?.name || t.branches.unknown),
          },
          items: Array.isArray(sale.items)
            ? sale.items.map((item: any) => ({
                product: item.product?._id || item.productId,
                productName: item.product?.name || t.departments.unknown,
                productNameEn: item.product?.nameEn,
                unit: item.product?.unit,
                unitEn: item.product?.unitEn,
                displayName: isRtl ? (item.product?.name || t.departments.unknown) : (item.product?.nameEn || item.product?.name || t.departments.unknown),
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

        if (fetchedBranches.length === 0) {
          setError(t.errors.no_branches_available);
          toast.warn(t.errors.no_branches_available, { position: isRtl ? 'top-right' : 'top-left' });
        }

        const newInventory = Array.isArray(inventoryResponse.inventory)
          ? inventoryResponse.inventory.map((item: any) => ({
              _id: item._id,
              product: {
                _id: item.product?._id || item.productId,
                name: item.product?.name || t.departments.unknown,
                nameEn: item.product?.nameEn,
                unit: item.product?.unit,
                unitEn: item.product?.unitEn,
                price: item.product?.price || 0,
                department: item.product?.department
                  ? {
                      _id: item.product.department._id,
                      name: item.product.department.name,
                      nameEn: item.product.department.nameEn,
                      displayName: isRtl ? item.product.department.name : (item.product.department.nameEn || item.product.department.name || t.departments.unknown),
                    }
                  : undefined,
              },
              currentStock: item.currentStock || 0,
              displayName: isRtl ? (item.product?.name || t.departments.unknown) : (item.product?.nameEn || item.product?.name || t.departments.unknown),
              displayUnit: isRtl ? (item.product?.unit || t.units.default) : (item.product?.unitEn || item.product?.unit || t.units.default),
            }))
          : [];
        setInventory(newInventory);

        setError('');
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Fetch error:`, err);
        setError(err.message === 'Invalid sale ID' ? t.errors.invalid_sale_id : (err.message || t.errors.fetch_sales));
        toast.error(err.message === 'Invalid sale ID' ? t.errors.invalid_sale_id : (err.message || t.errors.fetch_sales), { position: isRtl ? 'top-right' : 'top-left' });
        setSales([]);
        setInventory([]);
      } finally {
        setLoading(false);
        setSalesLoading(false);
      }
    },
    [filterPeriod, startDate, endDate, user, t, isRtl, language, selectedBranch]
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
            displayName: product.displayName,
            displayUnit: product.displayUnit,
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
        prev.map((item) => (item.productId === productId ? { ...item, quantity } : item))
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

    if (customerPhone && !/^\+?\d{10,15}$/.test(customerPhone)) {
      toast.error(t.errors.invalid_customer_phone, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }

    if (!['cash', 'credit_card', 'bank_transfer'].includes(paymentMethod)) {
      toast.error(t.errors.invalid_payment_method, { position: isRtl ? 'top-right' : 'top-left' });
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
      branch: user?.branchId || selectedBranch,
      items: cart.map((item) => ({
        product: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      totalAmount: cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
      notes: notes.trim() || undefined,
      paymentMethod: paymentMethod || undefined,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
    };

    try {
      if (editingSale) {
        await salesAPI.update(editingSale._id, saleData);
        toast.success(t.editSale, { position: isRtl ? 'top-right' : 'top-left' });
      } else {
        await salesAPI.create(saleData);
        toast.success(t.submitSale, { position: isRtl ? 'top-right' : 'top-left' });
      }
      setCart([]);
      setNotes('');
      setCustomerName('');
      setCustomerPhone('');
      setPaymentMethod('cash');
      setEditingSale(null);
      fetchData();
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Sale submission error:`, err);
      toast.error(editingSale ? t.errors.update_sale_failed : t.errors.create_sale_failed, { position: isRtl ? 'top-right' : 'top-left' });
    }
  }, [cart, notes, paymentMethod, customerName, customerPhone, user, selectedBranch, inventory, t, isRtl, editingSale, fetchData]);

  const handleEditSale = useCallback(
    (sale: Sale) => {
      setEditingSale(sale);
      setCart(
        sale.items.map((item) => ({
          productId: item.product,
          productName: item.productName,
          productNameEn: item.productNameEn,
          unit: item.unit,
          unitEn: item.unitEn,
          displayName: item.displayName,
          displayUnit: item.displayUnit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }))
      );
      setNotes(sale.notes || '');
      setPaymentMethod(sale.paymentMethod || 'cash');
      setCustomerName(sale.customerName || '');
      setCustomerPhone(sale.customerPhone || '');
    },
    []
  );

  const handleDeleteSale = useCallback(
    async (id: string) => {
      if (window.confirm(t.confirmDelete)) {
        try {
          await salesAPI.delete(id);
          toast.success(t.deleteSale, { position: isRtl ? 'top-right' : 'top-left' });
          fetchData();
        } catch (err: any) {
          console.error(`[${new Date().toISOString()}] Delete error:`, err);
          setError(t.errors.delete_sale_failed);
          toast.error(t.errors.delete_sale_failed, { position: isRtl ? 'top-right' : 'top-left' });
        }
      }
    },
    [t, fetchData, isRtl]
  );

  const branchOptions = useMemo(
    () => [
      { value: '', label: t.branches.select_branch },
      ...branches.map((branch) => ({
        value: branch._id,
        label: branch.displayName,
      })),
    ],
    [branches, t.branches]
  );

  const periodOptions = useMemo(
    () => [
      { value: 'day', label: t.day },
      { value: 'week', label: t.week },
      { value: 'month', label: t.month },
      { value: 'custom', label: t.customRange },
    ],
    [t]
  );

  const paymentMethodOptions = useMemo(
    () => [
      { value: 'cash', label: t.paymentMethods.cash },
      { value: 'credit_card', label: t.paymentMethods.credit_card },
      { value: 'bank_transfer', label: t.paymentMethods.bank_transfer },
    ],
    [t.paymentMethods]
  );

  const totalCartAmount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  }, [cart]);

  return (
    <div className={`mx-auto px-4 sm:px-6 py-8 min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans ${isRtl ? 'font-arabic' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <header className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-amber-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t.title}</h1>
            <p className="text-gray-600 text-sm">{t.subtitle}</p>
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 animate-pulse">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm font-medium">{error}</span>
        </div>
      )}

      <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">{t.filters}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          <ProductDropdown
            value={selectedBranch}
            onChange={setSelectedBranch}
            options={branchOptions}
            ariaLabel={t.branches.select_branch}
            disabled={!!user?.branchId}
          />
          <ProductDropdown value={filterPeriod} onChange={setFilterPeriod} options={periodOptions} ariaLabel={t.filterBy} />
          {filterPeriod === 'custom' && (
            <>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                aria-label={t.date}
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                aria-label={t.date}
              />
            </>
          )}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">{t.availableProducts}</h2>
        <div className="mb-6">
          <ProductSearchInput value={searchInput} onChange={handleSearchChange} placeholder={t.searchPlaceholder} ariaLabel={t.searchPlaceholder} />
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, index) => (
              <ProductSkeletonCard key={index} />
            ))}
          </div>
        ) : filteredInventory.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-sm font-medium">{t.noProducts}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
      </div>

      <div className="mb-8 p-6 bg-white rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6">{t.cart}</h2>
        {cart.length === 0 ? (
          <div className="p-8 text-center bg-gray-50 rounded-xl border border-gray-100">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-sm font-medium">{t.emptyCart}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {cart.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{item.displayName}</p>
                  <p className="text-sm text-gray-600">{t.unitPrice}: {item.unitPrice} {t.currency}</p>
                  <p className="text-sm text-gray-600">{t.quantity}: {item.quantity} {item.displayUnit}</p>
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
            <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-lg font-semibold text-gray-900">{t.total}: {totalCartAmount} {t.currency}</p>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={t.customerName}
                  className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                  aria-label={t.customerName}
                />
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder={t.customerPhone}
                  className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                  aria-label={t.customerPhone}
                />
                <ProductDropdown value={paymentMethod} onChange={setPaymentMethod} options={paymentMethodOptions} ariaLabel={t.paymentMethod} />
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t.notes}
                  className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                  aria-label={t.notes}
                  rows={3}
                />
              </div>
              <button
                onClick={handleSubmitSale}
                className="mt-4 w-full px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-2 shadow-sm"
                aria-label={editingSale ? t.editSale : t.submitSale}
              >
                <DollarSign className="w-5 h-5" />
                {editingSale ? t.editSale : t.submitSale}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">{t.previousSales}</h2>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, index) => (
              <SaleSkeletonCard key={index} />
            ))}
          </div>
        ) : sales.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100">
            <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-sm font-medium">{t.noSales}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {sales.map((sale) => (
                <SaleCard key={sale._id} sale={sale} onEdit={handleEditSale} onDelete={handleDeleteSale} />
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={loadMoreSales}
                  className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-medium transition-colors duration-200 disabled:opacity-50"
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
    </div>
  );
};

export default React.memo(BranchSalesReport);
