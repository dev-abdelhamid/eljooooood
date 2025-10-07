import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { salesAPI, branchesAPI, inventoryAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, DollarSign, Plus, Minus, Trash2, Package, Search, X, ChevronDown } from 'lucide-react';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import Papa from 'papaparse';

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
    export: 'تصدير التقرير',
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
      export_failed: 'فشل تصدير التقرير',
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
    export: 'Export Report',
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
      export_failed: 'Failed to export report',
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
}>(({ value, onChange, options, ariaLabel, disabled = false }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full ${isRtl ? 'text-right' : 'text-left'} py-2.5 px-4 border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300`}
        aria-label={ariaLabel}
      >
        <span>{options.find((opt) => opt.value === value)?.label || translations[language].paymentMethods.cash}</span>
        <ChevronDown className={`w-5 h-5 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && !disabled && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full ${isRtl ? 'text-right' : 'text-left'} px-4 py-2 hover:bg-amber-50 text-sm transition-colors`}
            >
              {option.label}
            </button>
          ))}
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
    <div className="p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-amber-200">
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

const SaleCard = React.memo<{ sale: Sale }>(({ sale }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  return (
    <div className="p-6 bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-amber-200">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900 text-xl">{sale.saleNumber}</h3>
          <span className="text-sm text-gray-500">({sale.branch.displayName})</span>
        </div>
        <div className="space-y-2">
          {sale.items.map((item, index) => (
            <div key={index} className="flex justify-between items-center text-sm text-gray-700">
              <span className="truncate max-w-[60%]">
                {item.quantity} {item.displayUnit || t.units.default} {item.displayName || t.errors.deleted_product}
              </span>
              <span className="font-semibold text-amber-600">
                {item.quantity}x{item.unitPrice} = {(item.quantity * item.unitPrice).toFixed(2)} {t.currency}
              </span>
            </div>
          ))}
          <div className="flex justify-between items-center font-bold text-gray-900 text-base border-t pt-2 mt-2">
            <span>{t.total}:</span>
            <span className="text-amber-600">{sale.totalAmount.toFixed(2)} {t.currency}</span>
          </div>
        </div>
        <div className="space-y-2 text-sm text-gray-600">
          <p>{t.date}: {formatDate(sale.createdAt, language)}</p>
          {sale.paymentMethod && (
            <p>{t.paymentMethod}: {t.paymentMethods[sale.paymentMethod as keyof typeof t.paymentMethods] || t.paymentMethods.cash}</p>
          )}
          {sale.customerName && <p>{t.customerName}: {sale.customerName}</p>}
          {sale.customerPhone && <p>{t.customerPhone}: {sale.customerPhone}</p>}
          {sale.notes && <p className="italic">{t.notes}: {sale.notes}</p>}
        </div>
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
        <div className="h-8 bg-gray-200 rounded-lg w-24"></div>
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
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [activeTab, setActiveTab] = useState<'new' | 'previous'>('new');
  const [sales, setSales] = useState<Sale[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
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
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const toastIdRef = React.useRef<string | number | null>(null);

  const showToast = useCallback((message: string, type: 'error' | 'success') => {
    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current);
    }
    toastIdRef.current = toast[type](message, { autoClose: 3000, position: isRtl ? 'top-right' : 'top-left' });
  }, [isRtl]);

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
        showToast(t.errors.unauthorized_access, 'error');
        setLoading(false);
        return;
      }

      const effectiveBranch = user.branchId;
      if (!effectiveBranch) {
        setError(t.errors.no_branch_assigned);
        showToast(t.errors.no_branch_assigned, 'error');
        setLoading(false);
        return;
      }

      setLoading(pageNum === 1);
      setSalesLoading(pageNum > 1);
      try {
        const salesParams: any = { page: pageNum, limit: 20, sort: '-createdAt', branch: effectiveBranch, lang: language };
        if (filterPeriod === 'custom' && startDate && endDate) {
          salesParams.startDate = startDate;
          salesParams.endDate = endDate;
        }

        const inventoryParams: any = { lowStock: false, branch: effectiveBranch };

        const [salesResponse, inventoryResponse, branchResponse] = await Promise.all([
          salesAPI.getAll(salesParams).catch((err) => {
            console.error(`[${new Date().toISOString()}] Sales fetch error:`, err);
            showToast(t.errors.fetch_sales, 'error');
            return { sales: [], total: 0, returns: [] };
          }),
          inventoryAPI.getInventory(inventoryParams).catch((err) => {
            console.error(`[${new Date().toISOString()}] Inventory fetch error:`, err);
            showToast(t.errors.fetch_inventory, 'error');
            return [];
          }),
          branchesAPI.getById(effectiveBranch).catch((err) => {
            console.error(`[${new Date().toISOString()}] Branch fetch error:`, err);
            return { _id: effectiveBranch, name: t.branches.unknown, displayName: t.branches.unknown };
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
                    productName: item.product?.name || t.errors.deleted_product,
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
            _id: branchResponse._id || effectiveBranch,
            name: branchResponse.name || t.branches.unknown,
            nameEn: branchResponse.nameEn,
            displayName: isRtl ? (branchResponse.name || t.branches.unknown) : (branchResponse.nameEn || branchResponse.name || t.branches.unknown),
          },
          items: Array.isArray(sale.items)
            ? sale.items.map((item: any) => ({
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
                      name: item.product.department.name || t.departments.unknown,
                      nameEn: item.product.department.nameEn,
                      displayName: isRtl
                        ? (item.product.department.name || t.departments.unknown)
                        : (item.product.department.nameEn || item.product.department.name || t.departments.unknown),
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

        const newInventory = Array.isArray(inventoryResponse)
          ? inventoryResponse
              .filter((item: any) => item.currentStock > 0 && item.product?._id)
              .map((item: any) => ({
                _id: item._id,
                product: {
                  _id: item.product?._id || item.productId,
                  name: item.product?.name || t.errors.deleted_product,
                  nameEn: item.product?.nameEn,
                  unit: item.product?.unit,
                  unitEn: item.product?.unitEn,
                  price: item.product?.price || 0,
                  department: item.product?.department
                    ? {
                        _id: item.product.department._id,
                        name: item.product.department.name || t.departments.unknown,
                        nameEn: item.product.department.nameEn,
                        displayName: isRtl
                          ? (item.product.department.name || t.departments.unknown)
                          : (item.product.department.nameEn || item.product.department.name || t.departments.unknown),
                      }
                    : undefined,
                },
                currentStock: item.currentStock || 0,
                displayName: isRtl ? (item.product?.name || t.errors.deleted_product) : (item.product?.nameEn || item.product?.name || t.errors.deleted_product),
                displayUnit: isRtl ? (item.product?.unit || t.units.default) : (item.product?.unitEn || item.product?.unit || t.units.default),
              }))
          : [];

        setInventory(newInventory);
        setError('');
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Fetch error:`, err);
        setError(t.errors.fetch_sales);
        showToast(t.errors.fetch_sales, 'error');
        setSales([]);
      } finally {
        setLoading(false);
        setSalesLoading(false);
      }
    },
    [user, t, isRtl, language, showToast, filterPeriod, startDate, endDate]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const loadMoreSales = useCallback(() => {
    setPage((prev) => prev + 1);
    fetchData(page + 1, true);
  }, [fetchData, page]);

  const handleAddToCart = useCallback(
    (product: InventoryItem) => {
      const stock = product.currentStock;
      if (stock < 1) {
        showToast(t.errors.insufficient_stock, 'error');
        return;
      }
      setCart((prev) => {
        const existingItem = prev.find((item) => item.productId === product.product._id);
        if (existingItem) {
          if (existingItem.quantity >= stock) {
            showToast(t.errors.exceeds_max_quantity, 'error');
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
    [t, showToast]
  );

  const handleUpdateCartQuantity = useCallback(
    (productId: string, quantity: number) => {
      const product = inventory.find((item) => item.product._id === productId);
      if (!product) {
        showToast(t.errors.deleted_product, 'error');
        return;
      }
      if (quantity < 1) {
        setCart((prev) => prev.filter((item) => item.productId !== productId));
        return;
      }
      if (quantity > product.currentStock) {
        showToast(t.errors.exceeds_max_quantity, 'error');
        return;
      }
      setCart((prev) =>
        prev.map((item) => (item.productId === productId ? { ...item, quantity } : item))
      );
    },
    [inventory, t, showToast]
  );

  const handleRemoveFromCart = useCallback(
    (productId: string) => {
      setCart((prev) => prev.filter((item) => item.productId !== productId));
    },
    []
  );

  const handleSubmitSale = useCallback(async () => {
    if (!user?.branchId) {
      showToast(t.errors.no_branch_assigned, 'error');
      return;
    }
    if (cart.length === 0) {
      showToast(t.errors.empty_cart, 'error');
      return;
    }
    if (customerPhone && !/^\+?\d{10,15}$/.test(customerPhone)) {
      showToast(t.errors.invalid_customer_phone, 'error');
      return;
    }
    if (!['cash', 'credit_card', 'bank_transfer'].includes(paymentMethod)) {
      showToast(t.errors.invalid_payment_method, 'error');
      return;
    }

    try {
      const saleData = {
        branch: user.branchId,
        items: cart.map((item) => ({
          product: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        totalAmount: cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
        notes: notes || undefined,
        paymentMethod,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
      };

      await salesAPI.create(saleData);
      showToast(t.submitSale, 'success');
      setCart([]);
      setNotes('');
      setCustomerName('');
      setCustomerPhone(undefined);
      setPaymentMethod('cash');
      fetchData(1, false); // Refresh sales
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Create sale error:`, err);
      showToast(t.errors.create_sale_failed, 'error');
    }
  }, [cart, notes, paymentMethod, customerName, customerPhone, user, t, showToast, fetchData]);

  const handleExport = useCallback(() => {
    try {
      const csvData = sales.map((sale) => ({
        SaleNumber: sale.saleNumber,
        Branch: sale.branch.displayName,
        TotalAmount: sale.totalAmount,
        CreatedAt: sale.createdAt,
        PaymentMethod: sale.paymentMethod ? t.paymentMethods[sale.paymentMethod as keyof typeof t.paymentMethods] : 'N/A',
        CustomerName: sale.customerName || 'N/A',
        CustomerPhone: sale.customerPhone || 'N/A',
        Items: sale.items
          .map((item) => `${item.displayName} (${item.quantity} ${item.displayUnit})`)
          .join('; '),
      }));
      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `branch_sales_report_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      showToast(t.export, 'success');
    } catch (err) {
      console.error('Export failed:', err);
      showToast(t.errors.export_failed, 'error');
    }
  }, [sales, t, showToast]);

  const totalCartAmount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toFixed(2),
    [cart]
  );

  if (!user?.role || user.role !== 'branch' || !user.branchId) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-teal-50 ${isRtl ? 'font-arabic' : 'font-sans'}`} dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="p-6 bg-red-100 border border-red-300 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <span className="text-red-600 text-base">{user?.branchId ? t.errors.unauthorized_access : t.errors.no_branch_assigned}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`container mx-auto px-4 py-6 min-h-screen bg-gradient-to-br from-amber-50 to-teal-50 ${isRtl ? 'font-arabic' : 'font-sans'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <header className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-amber-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t.title}</h1>
            <p className="text-gray-600 text-sm mt-1">{t.subtitle}</p>
          </div>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          <button
            onClick={() => setActiveTab('new')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === 'new' ? 'bg-amber-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            {t.newSale}
          </button>
          <button
            onClick={() => setActiveTab('previous')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === 'previous' ? 'bg-amber-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            {t.previousSales}
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg flex items-center gap-3 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600">{error}</span>
        </div>
      )}

      {activeTab === 'new' && (
        <div className="space-y-6">
          <div className="p-6 bg-white rounded-xl shadow-md border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t.availableProducts}</h2>
            <div className="mb-4">
              <ProductSearchInput
                value={searchInput}
                onChange={handleSearchChange}
                placeholder={t.searchPlaceholder}
                ariaLabel={t.searchPlaceholder}
              />
            </div>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, index) => (
                  <ProductSkeletonCard key={index} />
                ))}
              </div>
            ) : filteredInventory.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl shadow-md border border-gray-100">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">{t.noProducts}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredInventory.map((product) => (
                  <ProductCard
                    key={product._id}
                    product={product}
                    cartItem={cart.find((item) => item.productId === product.product._id)}
                    onAdd={() => handleAddToCart(product)}
                    onUpdate={(quantity) => handleUpdateCartQuantity(product.product._id, quantity)}
                    onRemove={() => handleRemoveFromCart(product.product._id)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="p-6 bg-white rounded-xl shadow-md border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t.cart}</h2>
            {cart.length === 0 ? (
              <div className="p-8 text-center">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">{t.emptyCart}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="space-y-1">
                      <p className="font-semibold text-gray-900">{item.displayName}</p>
                      <p className="text-sm text-gray-600">{item.quantity} {item.displayUnit} x {item.unitPrice} {t.currency}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <QuantityInput
                        value={item.quantity}
                        onChange={(val) => handleUpdateCartQuantity(item.productId, parseInt(val) || 0)}
                        onIncrement={() => handleUpdateCartQuantity(item.productId, item.quantity + 1)}
                        onDecrement={() => handleUpdateCartQuantity(item.productId, item.quantity - 1)}
                      />
                      <button
                        onClick={() => handleRemoveFromCart(item.productId)}
                        className="w-8 h-8 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors duration-200 flex items-center justify-center"
                        aria-label={isRtl ? 'إزالة المنتج' : 'Remove item'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center font-bold text-gray-900 text-base border-t pt-4">
                  <span>{t.total}:</span>
                  <span className="text-amber-600">{totalCartAmount} {t.currency}</span>
                </div>
                <div className="space-y-4">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t.notes}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm text-sm resize-none"
                    rows={4}
                    aria-label={t.notes}
                  />
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={t.customerName}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm text-sm"
                    aria-label={t.customerName}
                  />
                  <input
                    type="tel"
                    value={customerPhone || ''}
                    onChange={(e) => setCustomerPhone(e.target.value || undefined)}
                    placeholder={t.customerPhone}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm text-sm"
                    aria-label={t.customerPhone}
                  />
                  <ProductDropdown
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                    options={Object.entries(t.paymentMethods).map(([value, label]) => ({
                      value,
                      label,
                    }))}
                    ariaLabel={t.paymentMethod}
                  />
                  <button
                    onClick={handleSubmitSale}
                    className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm transition-colors duration-200"
                    aria-label={t.submitSale}
                  >
                    {t.submitSale}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'previous' && (
        <div className="space-y-6">
          <div className="p-6 bg-white rounded-xl shadow-md border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t.filters}</h2>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <ProductSearchInput
                  value={searchInput}
                  onChange={handleSearchChange}
                  placeholder={t.searchPlaceholder}
                  ariaLabel={t.searchPlaceholder}
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full sm:w-40 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm text-sm"
                  aria-label={t.date}
                  disabled={filterPeriod !== 'custom'}
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full sm:w-40 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm text-sm"
                  aria-label={t.date}
                  disabled={filterPeriod !== 'custom'}
                />
                <ProductDropdown
                  value={filterPeriod}
                  onChange={setFilterPeriod}
                  options={[
                    { value: 'all', label: t.branches.all_branches },
                    { value: 'custom', label: t.customRange },
                  ]}
                  ariaLabel={t.filterBy}
                />
              </div>
            </div>
            <button
              onClick={handleExport}
              className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm flex items-center gap-2 transition-colors"
            >
              <Download className="w-5 h-5" />
              {t.export}
            </button>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t.previousSales}</h2>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, index) => (
                  <SaleSkeletonCard key={index} />
                ))}
              </div>
            ) : sales.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl shadow-md border border-gray-100">
                <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">{t.noSales}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sales.map((sale) => (
                    <SaleCard key={sale._id} sale={sale} />
                  ))}
                </div>
                {hasMore && (
                  <button
                    onClick={loadMoreSales}
                    disabled={salesLoading}
                    className="mt-4 w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                  >
                    {salesLoading ? 'Loading...' : t.loadMore}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(BranchSalesReport);