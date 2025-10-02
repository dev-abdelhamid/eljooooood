import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { branchesAPI, inventoryAPI, returnsAPI } from '../services/api';
import salesAPI from '../services/salesAPI';
import { AlertCircle, DollarSign, Plus, Minus, Trash2, Package, Search, X, ChevronDown } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { debounce } from 'lodash';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface Sale {
  _id: string;
  orderNumber: string;
  branch: { _id: string; name: string; nameEn?: string; displayName: string };
  items: Array<{ product: string; productName: string; productNameEn?: string; quantity: number; unitPrice: number }>;
  totalAmount: number;
  createdAt: string;
  notes?: string;
  returns?: Array<{
    _id: string;
    returnNumber: string;
    status: string;
    items: Array<{ product: string; quantity: number; reason: string }>;
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
  product: { _id: string; name: string; nameEn?: string; price: number; department?: { _id: string; name: string; nameEn?: string; displayName: string } };
  currentStock: number;
  displayName: string;
}

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface SalesAnalytics {
  branchSales: Array<{ branchId: string; branchName: string; totalSales: number }>;
  productSales: Array<{ productId: string; productName: string; totalQuantity: number; totalRevenue: number }>;
  departmentSales: Array<{ departmentId: string; departmentName: string; totalRevenue: number }>;
  totalSales: number;
  topProduct: { productName: string; totalQuantity: number };
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
    submitSale: 'إرسال المبيعة',
    analytics: 'إحصائيات المبيعات',
    branchSales: 'مبيعات الفروع',
    productSales: 'مبيعات المنتجات',
    departmentSales: 'مبيعات الأقسام',
    totalSales: 'إجمالي المبيعات',
    topProduct: 'المنتج الأكثر مبيعًا',
    previousSales: 'المبيعات السابقة',
    noSales: 'لا توجد مبيعات',
    date: 'التاريخ',
    returns: 'المرتجعات',
    return: 'مرتجع',
    reason: 'السبب',
    quantity: 'الكمية',
    searchPlaceholder: 'ابحث عن المنتجات...',
    errors: {
      unauthorized_access: 'غير مصرح لك بالوصول',
      no_branch_assigned: 'لم يتم تعيين فرع',
      fetch_sales: 'خطأ أثناء جلب المبيعات',
      create_sale_failed: 'فشل إنشاء المبيعة',
      insufficient_stock: 'المخزون غير كافٍ',
      exceeds_max_quantity: 'الكمية تتجاوز الحد الأقصى',
      invalid_quantity: 'الكمية غير صالحة',
      empty_cart: 'السلة فارغة',
    },
    currency: 'ريال',
    units: { kg: 'كجم' },
    branches: { all_branches: 'كل الفروع', select_branch: 'اختر الفرع', unknown: 'غير معروف' },
    departments: { unknown: 'غير معروف' },
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
    submitSale: 'Submit Sale',
    analytics: 'Sales Analytics',
    branchSales: 'Branch Sales',
    productSales: 'Product Sales',
    departmentSales: 'Department Sales',
    totalSales: 'Total Sales',
    topProduct: 'Top Selling Product',
    previousSales: 'Previous Sales',
    noSales: 'No sales found',
    date: 'Date',
    returns: 'Returns',
    return: 'Return',
    reason: 'Reason',
    quantity: 'Quantity',
    searchPlaceholder: 'Search products...',
    errors: {
      unauthorized_access: 'You are not authorized to access',
      no_branch_assigned: 'No branch assigned',
      fetch_sales: 'Error fetching sales',
      create_sale_failed: 'Failed to create sale',
      insufficient_stock: 'Insufficient stock',
      exceeds_max_quantity: 'Quantity exceeds maximum available',
      invalid_quantity: 'Invalid quantity',
      empty_cart: 'Cart is empty',
    },
    currency: 'SAR',
    units: { kg: 'kg' },
    branches: { all_branches: 'All Branches', select_branch: 'Select Branch', unknown: 'Unknown' },
    departments: { unknown: 'Unknown' },
    returns: { status: { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' } },
  },
};

const ProductSearchInput: React.FC<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  ariaLabel: string;
}> = ({ value, onChange, placeholder, ariaLabel }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  return (
    <div className="relative group">
      <Search
        className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors group-focus-within:text-amber-500 ${value ? 'opacity-0' : 'opacity-100'}`}
      />
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
};

const ProductDropdown: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
  disabled?: boolean;
}> = ({ value, onChange, options, ariaLabel, disabled = false }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((opt) => opt.value === value) || options[0] || { label: isRtl ? 'اختر' : 'Select' };

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
          {options.map((option) => (
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
          ))}
        </div>
      )}
    </div>
  );
};

const QuantityInput: React.FC<{
  value: number;
  onChange: (val: string) => void;
  onIncrement: () => void;
  onDecrement: () => void;
}> = ({ value, onChange, onIncrement, onDecrement }) => {
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
};

const ProductCard: React.FC<{
  product: InventoryItem;
  cartItem?: CartItem;
  onAdd: () => void;
  onUpdate: (quantity: number) => void;
  onRemove: () => void;
}> = ({ product, cartItem, onAdd, onUpdate, onRemove }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  return (
    <div className="h-[200px] p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between border border-gray-100 hover:border-amber-200">
      <div className="space-y-2">
        <h3 className="font-bold text-gray-900 text-base truncate">{product.displayName}</h3>
        <p className="text-sm text-amber-600">{t.department}: {product.product.department?.displayName || t.departments.unknown}</p>
        <p className="text-sm text-gray-600">{t.availableStock}: {product.currentStock} {t.units.kg}</p>
        <p className="font-semibold text-gray-900 text-sm">{t.unitPrice}: {product.product.price} {t.currency}</p>
      </div>
      <div className="mt-4 flex justify-end">
        {cartItem ? (
          <QuantityInput
            value={cartItem.quantity}
            onChange={(val) => onUpdate(parseInt(val) || 0)}
            onIncrement={() => onUpdate(cartItem.quantity + 1)}
            onDecrement={() => onUpdate(cartItem.quantity - 1)}
          />
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
};

const SaleCard: React.FC<{ sale: Sale }> = ({ sale }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  return (
    <div className="h-[200px] p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-amber-200 overflow-y-auto">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-gray-900 text-base">{sale.orderNumber} - {sale.branch.displayName}</h3>
          <p className="text-sm text-gray-600">{t.date}: {sale.createdAt}</p>
          <p className="text-sm text-gray-600">{t.total}: {sale.totalAmount} {t.currency}</p>
          {sale.notes && <p className="text-sm text-gray-500">{t.notes}: {sale.notes}</p>}
          <ul className="list-disc list-inside text-sm text-gray-600 mt-2">
            {sale.items.map((item, index) => (
              <li key={index}>
                {isRtl ? item.productName : (item.productNameEn || item.productName)} - {t.quantity}: {item.quantity} {t.units.kg}, {t.unitPrice}: {item.unitPrice} {t.currency}
              </li>
            ))}
          </ul>
          {sale.returns && sale.returns.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700">{t.returns}:</p>
              <ul className="list-disc list-inside text-sm text-gray-600">
                {sale.returns.map((ret, index) => (
                  <li key={index}>
                    {t.return} #{ret.returnNumber} ({t.returns.status[ret.status]}) - {t.reason}: {ret.reason}
                    <ul className="list-circle list-inside ml-4">
                      {ret.items.map((item, i) => (
                        <li key={i}>
                          {t.quantity}: {item.quantity} {t.units.kg}, {t.reason}: {item.reason}
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
    </div>
  );
};

const ProductSkeletonCard: React.FC = () => (
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
);

export const SalesReport: React.FC = () => {
  const { t: languageT, language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [sales, setSales] = useState<Sale[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [analytics, setAnalytics] = useState<SalesAnalytics>({
    branchSales: [], productSales: [], departmentSales: [], totalSales: 0, topProduct: { productName: '', totalQuantity: 0 }
  });
  const [filterBranch, setFilterBranch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState('');
  const [selectedBranch, setSelectedBranch] = useState(user?.role === 'branch' && user?.branchId ? user.branchId : '');

  const debouncedSearch = useCallback(
    debounce((value: string) => setSearchTerm(value.trim()), 500),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    if (value.length >= 2 || value === '') {
      debouncedSearch(value);
    }
  };

  const filteredInventory = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return inventory.filter((item) => {
      const name = item.displayName.toLowerCase();
      return name.startsWith(lowerSearchTerm) || name.includes(lowerSearchTerm);
    });
  }, [inventory, searchTerm]);

  const fetchData = useCallback(async () => {
    if (!user?.role || !['branch', 'admin'].includes(user.role)) {
      setError(t.errors.unauthorized_access);
      toast.error(t.errors.unauthorized_access, { position: isRtl ? 'top-right' : 'top-left' });
      setLoading(false);
      return;
    }

    if (user.role === 'branch' && !user.branchId && !selectedBranch) {
      setError(t.errors.no_branch_assigned);
      toast.error(t.errors.no_branch_assigned, { position: isRtl ? 'top-right' : 'top-left' });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params: any = { page: 1, limit: 20, sort: '-createdAt' };
      if (user.role === 'branch') {
        params.branch = user.branchId || selectedBranch;
      } else if (filterBranch) {
        params.branch = filterBranch;
      }
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const [salesResponse, branchesResponse, inventoryResponse, returnsResponse, analyticsResponse] = await Promise.all([
        salesAPI.getAll(params),
        user.role === 'admin' ? branchesAPI.getAll() : Promise.resolve({ branches: [] }),
        inventoryAPI.getInventory({ branch: user.branchId || selectedBranch, lowStock: false }),
        returnsAPI.getAll(params),
        user.role === 'admin' ? salesAPI.getAnalytics(params) : Promise.resolve({ branchSales: [], productSales: [], departmentSales: [], totalSales: 0, topProduct: { productName: '', totalQuantity: 0 } }),
      ]);

      const returnsMap = new Map<string, Sale['returns']>();
      if (Array.isArray(returnsResponse.returns)) {
        returnsResponse.returns.forEach((ret: any) => {
          const orderId = ret.order?._id || ret.order;
          if (!returnsMap.has(orderId)) returnsMap.set(orderId, []);
          returnsMap.get(orderId)!.push({
            _id: ret._id,
            returnNumber: ret.returnNumber,
            status: ret.status,
            items: Array.isArray(ret.items)
              ? ret.items.map((item: any) => ({
                  product: item.product?._id || item.product,
                  quantity: item.quantity,
                  reason: item.reason,
                }))
              : [],
            reason: ret.reason,
            createdAt: new Date(ret.createdAt).toLocaleDateString(languageT('locale'), {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
          });
        });
      }

      setSales(
        salesResponse.sales.map((sale: any) => ({
          _id: sale._id,
          orderNumber: sale.orderNumber,
          branch: {
            _id: sale.branch?._id || 'unknown',
            name: sale.branch?.name || t.branches.unknown,
            nameEn: sale.branch?.nameEn,
            displayName: isRtl ? sale.branch?.name : (sale.branch?.nameEn || sale.branch?.name || t.branches.unknown),
          },
          items: Array.isArray(sale.items)
            ? sale.items.map((item: any) => ({
                product: item.product?._id || item.productId,
                productName: item.product?.name || item.productName || t.departments.unknown,
                productNameEn: item.product?.nameEn,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
              }))
            : [],
          totalAmount: sale.totalAmount || 0,
          createdAt: new Date(sale.createdAt).toLocaleDateString(languageT('locale'), {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          notes: sale.notes,
          returns: returnsMap.get(sale._id) || [],
        }))
      );

      setBranches(
        Array.isArray(branchesResponse.branches)
          ? branchesResponse.branches.map((branch: any) => ({
              _id: branch._id,
              name: branch.name,
              nameEn: branch.nameEn,
              displayName: isRtl ? branch.name : (branch.nameEn || branch.name),
            }))
          : []
      );

      setInventory(
        Array.isArray(inventoryResponse)
          ? inventoryResponse
              .filter((item: any) => item.currentStock > 0 && item.product?._id && item.product?.name)
              .map((item: any) => ({
                _id: item._id,
                product: {
                  _id: item.product?._id || 'unknown',
                  name: item.product?.name || t.departments.unknown,
                  nameEn: item.product?.nameEn,
                  price: item.product?.price || 0,
                  department: item.product?.department
                    ? {
                        _id: item.product.department._id,
                        name: item.product.department.name,
                        nameEn: item.product.department.nameEn,
                        displayName: isRtl ? item.product.department.name : (item.product.department.nameEn || item.product.department.name),
                      }
                    : { _id: 'unknown', name: t.departments.unknown, displayName: t.departments.unknown },
                },
                currentStock: item.currentStock || 0,
                displayName: isRtl ? item.product?.name : (item.product?.nameEn || item.product?.name || t.departments.unknown),
              }))
          : []
      );

      setAnalytics({
        branchSales: analyticsResponse.branchSales || [],
        productSales: analyticsResponse.productSales || [],
        departmentSales: analyticsResponse.departmentSales || [],
        totalSales: analyticsResponse.totalSales || 0,
        topProduct: analyticsResponse.topProduct || { productName: t.departments.unknown, totalQuantity: 0 },
      });

      setError('');
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Fetch error:`, err);
      setError(err.message || t.errors.fetch_sales);
      toast.error(err.message || t.errors.fetch_sales, { position: isRtl ? 'top-right' : 'top-left' });
      setSales([]);
    } finally {
      setLoading(false);
    }
  }, [filterBranch, startDate, endDate, selectedBranch, user, t, isRtl, languageT]);

  const addToCart = useCallback((product: InventoryItem) => {
    if (product.currentStock < 1) {
      setError(t.errors.insufficient_stock);
      toast.error(t.errors.insufficient_stock, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    setCart((prev) => {
      const existingItem = prev.find((item) => item.productId === product.product._id);
      if (existingItem) {
        if (existingItem.quantity >= product.currentStock) {
          setError(t.errors.exceeds_max_quantity);
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
          productName: isRtl ? product.product.name : (product.product.nameEn || product.product.name),
          quantity: 1,
          unitPrice: product.product.price,
        },
      ];
    });
    setError('');
  }, [isRtl, t]);

  const updateCartQuantity = useCallback((productId: string, quantity: number) => {
    const inventoryItem = inventory.find((item) => item.product._id === productId);
    if (!inventoryItem || quantity < 1 || quantity > inventoryItem.currentStock) {
      setError(quantity < 1 ? t.errors.invalid_quantity : t.errors.exceeds_max_quantity);
      toast.error(quantity < 1 ? t.errors.invalid_quantity : t.errors.exceeds_max_quantity, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, quantity } : item))
    );
    setError('');
  }, [inventory, t, isRtl]);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
    setError('');
  }, []);

  const handleAddSale = useCallback(async () => {
    if (user?.role === 'branch' && !user.branchId && !selectedBranch) {
      setError(t.errors.no_branch_assigned);
      toast.error(t.errors.no_branch_assigned, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }

    if (cart.length === 0) {
      setError(t.errors.empty_cart);
      toast.error(t.errors.empty_cart, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }

    try {
      const payload = {
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        branch: user?.role === 'branch' ? user.branchId || selectedBranch : selectedBranch,
        notes,
      };

      await salesAPI.create(payload);
      toast.success(t.submitSale, { position: isRtl ? 'top-right' : 'top-left' });
      setCart([]);
      setNotes('');
      setSelectedBranch(user?.role === 'branch' && user?.branchId ? user.branchId : '');
      await fetchData();
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Create error:`, err);
      setError(err.message || t.errors.create_sale_failed);
      toast.error(err.message || t.errors.create_sale_failed, { position: isRtl ? 'top-right' : 'top-left' });
    }
  }, [cart, notes, selectedBranch, user, t, isRtl, fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toFixed(2), [cart]);

  const branchSalesChartData = useMemo(() => ({
    labels: analytics.branchSales.map((b) => b.branchName),
    datasets: [
      {
        label: t.branchSales,
        data: analytics.branchSales.map((b) => b.totalSales),
        backgroundColor: 'rgba(251, 191, 36, 0.6)', // Amber color
        borderColor: 'rgba(251, 191, 36, 1)',
        borderWidth: 1,
      },
    ],
  }), [analytics.branchSales, t]);

  const productSalesChartData = useMemo(() => ({
    labels: analytics.productSales.slice(0, 5).map((p) => p.productName),
    datasets: [
      {
        label: t.productSales,
        data: analytics.productSales.slice(0, 5).map((p) => p.totalRevenue),
        backgroundColor: 'rgba(251, 191, 36, 0.6)',
        borderColor: 'rgba(251, 191, 36, 1)',
        borderWidth: 1,
      },
    ],
  }), [analytics.productSales, t]);

  const departmentSalesChartData = useMemo(() => ({
    labels: analytics.departmentSales.map((d) => d.departmentName),
    datasets: [
      {
        label: t.departmentSales,
        data: analytics.departmentSales.map((d) => d.totalRevenue),
        backgroundColor: 'rgba(251, 191, 36, 0.6)',
        borderColor: 'rgba(251, 191, 36, 1)',
        borderWidth: 1,
      },
    ],
  }), [analytics.departmentSales, t]);

  return (
    <div className={`mx-auto  px-4 sm:px-6  py-4 `}>
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

      {user?.role === 'admin' && (
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">{t.filters}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <ProductDropdown
              value={filterBranch}
              onChange={setFilterBranch}
              options={[{ value: '', label: t.branches.all_branches }, ...branches.map((branch) => ({
                value: branch._id,
                label: branch.displayName,
              }))]}
              ariaLabel={t.branches.select_branch}
            />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
              placeholder={t.date}
              aria-label={t.date}
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
              placeholder={t.date}
              aria-label={t.date}
            />
          </div>
        </div>
      )}

      {user?.role === 'branch' && (
        <div className={`space-y-8 ${cart.length > 0 ? 'lg:grid lg:grid-cols-3 lg:gap-8 lg:space-y-0' : ''}`}>
          <section className={`${cart.length > 0 ? 'lg:col-span-2 lg:overflow-y-auto lg:max-h-[calc(100vh-12rem)] scrollbar-none' : ''}`}>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-6">{t.availableProducts}</h2>
              {user.role === 'branch' && !user.branchId && (
                <ProductDropdown
                  value={selectedBranch}
                  onChange={setSelectedBranch}
                  options={[{ value: '', label: t.branches.select_branch }, ...branches.map((branch) => ({
                    value: branch._id,
                    label: branch.displayName,
                  }))]}
                  ariaLabel={t.branches.select_branch}
                  disabled={!!user.branchId}
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
                {[...Array(filteredInventory.length || 6)].map((_, index) => (
                  <ProductSkeletonCard key={index} />
                ))}
              </div>
            ) : filteredInventory.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 text-sm font-medium">{searchTerm ? t.noProducts : t.noProducts}</p>
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
                        <p className="font-semibold text-gray-900 text-sm">{item.productName}</p>
                        <p className="text-sm text-gray-600">
                          {item.unitPrice} {t.currency} / {t.units.kg}
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
                      <span className="text-amber-600">{cartTotal} {t.currency}</span>
                    </div>
                  </div>
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t.notes}
                  className={`w-full mt-4 p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                  rows={4}
                  aria-label={t.notes}
                />
                <button
                  onClick={handleAddSale}
                  className="w-full mt-4 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 shadow-sm disabled:opacity-50"
                  disabled={cart.length === 0 || (user?.role === 'branch' && !user.branchId && !selectedBranch)}
                  aria-label={t.submitSale}
                >
                  {t.submitSale}
                </button>
              </div>
            </aside>
          )}
        </div>
      )}

      {user?.role === 'admin' && (
        <div className="mt-8 space-y-8">
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-6">{t.analytics}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-sm font-medium text-gray-600">{t.totalSales}</p>
                <p className="text-2xl font-bold text-amber-600">{analytics.totalSales.toFixed(2)} {t.currency}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-sm font-medium text-gray-600">{t.topProduct}</p>
                <p className="text-2xl font-bold text-amber-600">{analytics.topProduct.productName} ({analytics.topProduct.totalQuantity} {t.units.kg})</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-medium text-gray-900 mb-4">{t.branchSales}</h3>
                <Bar
                  data={branchSalesChartData}
                  options={{
                    responsive: true,
                    plugins: { legend: { position: 'top' }, title: { display: true, text: t.branchSales } },
                  }}
                />
              </div>
              <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-medium text-gray-900 mb-4">{t.productSales}</h3>
                <Bar
                  data={productSalesChartData}
                  options={{
                    responsive: true,
                    plugins: { legend: { position: 'top' }, title: { display: true, text: t.productSales } },
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 space-y-4">
        <h2 className="text-xl font-bold text-gray-900">{t.previousSales}</h2>
        {loading ? (
          <div className="flex justify-center">
            <svg className="animate-spin h-8 w-8 text-amber-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : sales.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100">
            <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-sm font-medium">{t.noSales}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sales.map((sale) => (
              <SaleCard key={sale._id} sale={sale} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesReport;