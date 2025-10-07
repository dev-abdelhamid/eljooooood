import React, { useState, useEffect, useCallback, useMemo, useTransition } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { branchesAPI, inventoryAPI, salesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, DollarSign, Plus, Minus, Trash2, Package, Search, X, ChevronDown } from 'lucide-react';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';

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
        className={`w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 bg-white shadow-sm hover:shadow-md text-sm text-gray-700 ${isRtl ? 'text-right' : 'text-left'} flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={ariaLabel}
      >
        <span className="truncate">{selectedOption.label}</span>
        <ChevronDown className={`${isOpen ? 'rotate-180' : 'rotate-0'} transition-transform duration-200 w-5 h-5 text-gray-400 group-focus-within:text-amber-500`} />
      </button>
      {isOpen && !disabled && (
        <div className="absolute w-full mt-2 bg-white rounded-lg shadow-lg border border-gray-100 z-20 max-h-60 overflow-y-auto">
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
    <div className="p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100">
      <div className="space-y-1 text-sm">
        <h3 className="font-medium text-gray-800 truncate">{product.displayName}</h3>
        <p className="text-gray-600">{t.department}: {product.product.department?.displayName || t.departments.unknown}</p>
        <p className="text-gray-600">{t.availableStock}: {product.currentStock} {product.displayUnit || t.units.default}</p>
        <p className="font-medium text-gray-800">{t.unitPrice}: {product.product.price} {t.currency}</p>
      </div>
      <div className="mt-3">
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
              className="p-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
              aria-label={isRtl ? 'إزالة' : 'Remove'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onAdd}
            className="w-full py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors disabled:opacity-50"
            disabled={product.currentStock < 1}
            aria-label={t.addToCart}
          >
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
    <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
      <div className="space-y-1 text-sm">
        <h3 className="font-medium text-gray-800">{sale.saleNumber}</h3>
        <p className="text-gray-600">{t.date}: {formatDate(sale.createdAt, language)}</p>
        <p className="text-gray-600">{t.branchSales}: {sale.branch.displayName}</p>
        <p className="font-medium text-gray-800">{t.total}: {sale.totalAmount} {t.currency}</p>
        {sale.paymentMethod && <p className="text-gray-600">{t.paymentMethod}: {t.paymentMethods[sale.paymentMethod as keyof typeof t.paymentMethods]}</p>}
        {sale.customerName && <p className="text-gray-600">{t.customerName}: {sale.customerName}</p>}
        {sale.customerPhone && <p className="text-gray-600">{t.customerPhone}: {sale.customerPhone}</p>}
        {sale.notes && <p className="text-gray-600">{t.notes}: {sale.notes}</p>}
        <ul className="space-y-1 mt-2">
          {sale.items.map((item, index) => (
            <li key={index} className="text-gray-600">
              {item.quantity} {item.displayUnit} {item.displayName} - {item.unitPrice} {t.currency}
            </li>
          ))}
        </ul>
        {sale.returns && sale.returns.length > 0 && (
          <div className="mt-2">
            <p className="font-medium text-gray-800">{t.returns}:</p>
            <ul className="space-y-1 text-gray-600">
              {sale.returns.map((ret, index) => (
                <li key={index}>
                  {t.return} #{ret.returnNumber} - {t.reason}: {ret.reason}
                  <ul className="ml-4 space-y-1">
                    {ret.items.map((item, i) => (
                      <li key={i}>
                        {item.quantity} {item.productName}
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
  <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100 animate-pulse">
    <div className="space-y-1">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      <div className="h-3 bg-gray-200 rounded w-1/3"></div>
      <div className="mt-3 h-8 bg-gray-200 rounded-md"></div>
    </div>
  </div>
));

const SaleSkeletonCard = React.memo(() => (
  <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100 animate-pulse">
    <div className="space-y-1">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      <div className="h-3 bg-gray-200 rounded w-1/3"></div>
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
  const [isPending, startTransition] = useTransition();

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

  useEffect(() => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        const product = inventory.find((inv) => inv.product._id === item.productId);
        return {
          ...item,
          displayName: product ? (isRtl ? product.product.name || t.departments.unknown : product.product.nameEn || product.product.name || t.departments.unknown) : item.displayName,
          displayUnit: product ? (isRtl ? product.product.unit || t.units.default : product.product.unitEn || product.product.unit || t.units.default) : item.displayUnit,
        };
      })
    );
  }, [language, inventory, isRtl, t]);

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

        const inventoryParams: any = { lowStock: false };
        if (effectiveBranch) inventoryParams.branch = effectiveBranch;

        const [salesResponse, branchesResponse, inventoryResponse] = await Promise.all([
          salesAPI.getAll(salesParams),
          branchesAPI.getAll(),
          inventoryAPI.getInventory(inventoryParams),
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
              productName: item.product?.name || t.departments.unknown,
              productNameEn: item.product?.nameEn,
              quantity: item.quantity,
              reason: item.reason,
            })),
            reason: ret.reason,
            createdAt: formatDate(ret.createdAt, language),
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
          })),
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

        setBranches(
          branchesResponse.branches.map((branch: any) => ({
            _id: branch._id,
            name: branch.name || t.branches.unknown,
            nameEn: branch.nameEn,
            displayName: isRtl ? branch.name : (branch.nameEn || branch.name || t.branches.unknown),
          }))
        );

        setInventory(
          inventoryResponse.filter((item: any) => item.currentStock > 0).map((item: any) => ({
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
        );

        setError('');
      } catch (err: any) {
        setError(t.errors.fetch_sales);
        toast.error(t.errors.fetch_sales, { position: isRtl ? 'top-right' : 'top-left' });
      } finally {
        setLoading(false);
        setSalesLoading(false);
      }
    },
    [user, t, isRtl, language, selectedBranch, filterPeriod, startDate, endDate]
  );

  useEffect(() => {
    startTransition(() => {
      fetchData();
    });
  }, [fetchData]);

  const loadMoreSales = useCallback(() => {
    startTransition(() => {
      setPage((prev) => prev + 1);
      fetchData(page + 1, true);
    });
  }, [fetchData, page]);

  const addToCart = useCallback((product: InventoryItem) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.product._id);
      if (existing) {
        if (existing.quantity + 1 > product.currentStock) return prev;
        return prev.map((item) => item.productId === product.product._id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, {
        productId: product.product._id,
        productName: product.product.name,
        productNameEn: product.product.nameEn,
        unit: product.product.unit,
        unitEn: product.product.unitEn,
        displayName: product.displayName,
        displayUnit: product.displayUnit,
        quantity: 1,
        unitPrice: product.product.price,
      }];
    });
  }, []);

  const updateCartQuantity = useCallback((productId: string, quantity: number) => {
    const product = inventory.find((item) => item.product._id === productId);
    if (!product || quantity > product.currentStock || quantity < 1) return;
    setCart((prev) => prev.map((item) => item.productId === productId ? { ...item, quantity } : item));
  }, [inventory]);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }, []);

  const handleSubmitSale = useCallback(() => {
    startTransition(() => {
      const saleData = {
        items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice })),
        branch: user?.branchId || selectedBranch,
        notes: notes || undefined,
        paymentMethod: paymentMethod || undefined,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
      };
      salesAPI.create(saleData).then(() => {
        setCart([]);
        setNotes('');
        setPaymentMethod('cash');
        setCustomerName('');
        setCustomerPhone(undefined);
        fetchData();
      }).catch(() => toast.error(t.errors.create_sale_failed));
    });
  }, [cart, notes, paymentMethod, customerName, customerPhone, user, selectedBranch, t, fetchData]);

  const totalCartAmount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0), [cart]);

  return (
    <div className={`min-h-screen bg-gray-50 p-4 ${isRtl ? 'font-arabic' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <header className="mb-4">
        <h1 className="text-xl font-bold text-gray-800">{t.title}</h1>
        <p className="text-sm text-gray-600">{t.subtitle}</p>
      </header>

      {error && <div className="mb-4 p-2 bg-red-100 text-red-600 rounded">{error}</div>}

      <div className="flex mb-4">
        <button onClick={() => setActiveTab('new')} className={`flex-1 p-2 ${activeTab === 'new' ? 'bg-amber-500 text-white' : 'bg-white text-gray-800'}`}>{t.newSale}</button>
        <button onClick={() => setActiveTab('previous')} className={`flex-1 p-2 ${activeTab === 'previous' ? 'bg-amber-500 text-white' : 'bg-white text-gray-800'}`}>{t.previousSales}</button>
      </div>

      {activeTab === 'new' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded shadow">
            <h2 className="text-lg font-bold mb-2">{t.availableProducts}</h2>
            <ProductSearchInput value={searchInput} onChange={handleSearchChange} placeholder={t.searchPlaceholder} ariaLabel={t.searchPlaceholder} />
            <div className="grid grid-cols-1 gap-4 mt-4">
              {filteredInventory.map((product) => (
                <ProductCard key={product._id} product={product} cartItem={cart.find((item) => item.productId === product.product._id)} onAdd={() => addToCart(product)} onUpdate={(q) => updateCartQuantity(product.product._id, q)} onRemove={() => removeFromCart(product.product._id)} />
              ))}
            </div>
            {cart.length > 0 && (
              <div className="mt-4 bg-white p-4 rounded shadow">
                <h3 className="text-lg font-bold mb-2">{t.cart}</h3>
                {cart.map((item) => (
                  <div key={item.productId} className="flex justify-between mb-2">
                    <span>{item.displayName} x {item.quantity}</span>
                    <button onClick={() => removeFromCart(item.productId)} className="text-red-500"><Trash2 size={16} /></button>
                  </div>
                ))}
                <p className="font-bold">{t.total}: {totalCartAmount} {t.currency}</p>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t.notes} className="w-full p-2 border rounded mb-2" />
                <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder={t.customerName} className="w-full p-2 border rounded mb-2" />
                <input type="text" value={customerPhone || ''} onChange={(e) => setCustomerPhone(e.target.value)} placeholder={t.customerPhone} className="w-full p-2 border rounded mb-2" />
                <ProductDropdown value={paymentMethod} onChange={setPaymentMethod} options={paymentMethodOptions} ariaLabel={t.paymentMethod} />
                <button onClick={handleSubmitSale} className="w-full p-2 bg-amber-500 text-white rounded mt-2">{t.submitSale}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'previous' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {sales.map((sale) => (
              <SaleCard key={sale._id} sale={sale} />
            ))}
          </div>
          {hasMore && <button onClick={loadMoreSales} className="w-full p-2 bg-amber-500 text-white rounded">{t.loadMore}</button>}
        </div>
      )}
    </div>
  );
};

export default React.memo(BranchSalesReport);