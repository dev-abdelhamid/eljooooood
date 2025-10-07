import React, { useState, useEffect, useCallback, useMemo, useReducer } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage, Language } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { inventoryAPI, salesAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { AlertCircle, DollarSign, Plus, Minus, Trash2, Package, Search, X, ChevronDown, Edit2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';

// واجهات TypeScript
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

interface Department {
  _id: string;
  name: string;
  nameEn?: string;
  displayName: string;
}

// واجهة لحالة السلة
interface CartState {
  items: CartItem[];
  notes: string;
  paymentMethod: string;
  customerName: string;
  customerPhone?: string;
}

// إجراءات السلة
type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'UPDATE_QUANTITY'; payload: { productId: string; quantity: number } }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'SET_NOTES'; payload: string }
  | { type: 'SET_PAYMENT_METHOD'; payload: string }
  | { type: 'SET_CUSTOMER_NAME'; payload: string }
  | { type: 'SET_CUSTOMER_PHONE'; payload: string | undefined }
  | { type: 'RESET' };

// دالة Reducer لإدارة السلة
const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'ADD_ITEM':
      const existingItem = state.items.find((item) => item.productId === action.payload.productId);
      if (existingItem) {
        return {
          ...state,
          items: state.items.map((item) =>
            item.productId === action.payload.productId
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ),
        };
      }
      return { ...state, items: [...state.items, action.payload] };
    case 'UPDATE_QUANTITY':
      return {
        ...state,
        items: state.items.map((item) =>
          item.productId === action.payload.productId
            ? { ...item, quantity: action.payload.quantity }
            : item
        ).filter((item) => item.quantity > 0),
      };
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter((item) => item.productId !== action.payload) };
    case 'SET_NOTES':
      return { ...state, notes: action.payload };
    case 'SET_PAYMENT_METHOD':
      return { ...state, paymentMethod: action.payload };
    case 'SET_CUSTOMER_NAME':
      return { ...state, customerName: action.payload };
    case 'SET_CUSTOMER_PHONE':
      return { ...state, customerPhone: action.payload };
    case 'RESET':
      return { items: [], notes: '', paymentMethod: 'cash', customerName: '', customerPhone: undefined };
    default:
      return state;
  }
};

// مكونات فرعية
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

const SaleCard = React.memo<{
  sale: Sale;
  onEdit: (sale: Sale) => void;
  onDelete: (id: string) => void;
}>(({ sale, onEdit, onDelete }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  return (
    <div className="p-6 bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-amber-200">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-900 text-xl">{sale.saleNumber}</h3>
            <span className="text-sm text-gray-500">({sale.branch.displayName})</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(sale)}
              className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors duration-200"
              aria-label={t.editSale}
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(sale._id)}
              className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors duration-200"
              aria-label={t.deleteSale}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {sale.items.map((item, index) => (
            <div key={index} className="flex justify-between items-center text-sm text-gray-700">
              <span className="truncate max-w-[60%]">
                {item.quantity} {item.displayUnit || t.units.default} {item.displayName || t.errors.deleted_product}
              </span>
              <span className="font-semibold text-amber-600">
                {item.quantity} × {item.unitPrice} {t.currency}
              </span>
            </div>
          ))}
          <div className="flex justify-between items-center font-bold text-gray-900 text-base border-t pt-2 mt-2">
            <span>{t.total}:</span>
            <span className="text-amber-600">{sale.totalAmount.toFixed(2)} {t.currency}</span>
          </div>
        </div>
        <div className="space-y-2 text-sm text-gray-600">
          <p>{t.date}: {sale.createdAt}</p>
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

// المكون الرئيسي
export const BranchSalesReport: React.FC = () => {
  const { t: languageT, language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'] || translations.en;

  // إدارة حالة السلة باستخدام useReducer
  const [cartState, dispatchCart] = useReducer(cartReducer, {
    items: [],
    notes: '',
    paymentMethod: 'cash',
    customerName: '',
    customerPhone: undefined,
  });

  const [activeTab, setActiveTab] = useState<'new' | 'previous'>('new');
  const [sales, setSales] = useState<Sale[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [loading, setLoading] = useState(true);
  const [salesLoading, setSalesLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);

  // التحقق من الصلاحيات عند تحميل المكون
  useEffect(() => {
    if (!user?.role || user.role !== 'branch') {
      setError(t.errors.unauthorized_access);
      toast.error(t.errors.unauthorized_access, { position: isRtl ? 'top-right' : 'top-left' });
      navigate('/unauthorized');
    }
  }, [user, t, isRtl, navigate]);

  // البحث المؤخر
  const debouncedSearch = useCallback(
    debounce((value: string) => setSearchTerm(value.trim()), 300),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSearch(value);
  };

  // تصفية المخزون
  const filteredInventory = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return inventory.filter((item) => {
      const matchesSearch = item.displayName.toLowerCase().includes(lowerSearchTerm);
      const matchesDepartment = !selectedDepartment || item.product.department?._id === selectedDepartment;
      return matchesSearch && matchesDepartment;
    });
  }, [inventory, searchTerm, selectedDepartment]);

  // تحديث عرض السلة عند تغيير اللغة
  useEffect(() => {
    dispatchCart({
      type: 'UPDATE_QUANTITY',
      payload: {
        productId: '',
        quantity: 0,
      },
    });
    dispatchCart({
      type: 'ADD_ITEM',
      payload: {
        productId: '',
        productName: '',
        displayName: '',
        displayUnit: '',
        quantity: 0,
        unitPrice: 0,
      },
    });
    cartState.items.forEach((item) => {
      const product = inventory.find((inv) => inv.product._id === item.productId);
      if (product) {
        dispatchCart({
          type: 'UPDATE_QUANTITY',
          payload: {
            productId: item.productId,
            quantity: item.quantity,
          },
        });
      }
    });
  }, [language, inventory, isRtl, t]);

  // جلب البيانات
  const fetchData = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      if (!user?.branchId) {
        setError(t.errors.no_branch_assigned);
        toast.error(t.errors.no_branch_assigned, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }

      setLoading(pageNum === 1);
      setSalesLoading(pageNum > 1);

      try {
        const salesParams: any = { page: pageNum, limit: 20, sort: '-createdAt', branch: user.branchId };
        if (filterPeriod === 'custom' && startDate && endDate) {
          salesParams.startDate = startDate;
          salesParams.endDate = endDate;
        }

        const inventoryParams: any = { lowStock: false, branch: user.branchId };

        const [salesResponse, inventoryResponse] = await Promise.all([
          salesAPI.getAll(salesParams).catch((err) => {
            console.error(`[${new Date().toISOString()}] Sales fetch error:`, err);
            toast.error(t.errors.fetch_sales, { position: isRtl ? 'top-right' : 'top-left' });
            return { sales: [], total: 0, returns: [] };
          }),
          inventoryAPI.getInventory(inventoryParams).catch((err) => {
            console.error(`[${new Date().toISOString()}] Inventory fetch error:`, err);
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
              createdAt: formatDate(new Date(ret.createdAt), isRtl ? 'ar' : 'en'),
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
          createdAt: formatDate(new Date(sale.createdAt), isRtl ? 'ar' : 'en'),
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

        // استخراج الأقسام الفريدة
        const uniqueDepartments = Array.from(
          new Map(
            newInventory
              .filter((item: InventoryItem) => item.product.department)
              .map((item: InventoryItem) => [
                item.product.department!._id,
                {
                  _id: item.product.department!._id,
                  name: item.product.department!.name,
                  nameEn: item.product.department!.nameEn,
                  displayName: item.product.department!.displayName,
                },
              ])
          ).values()
        );
        setDepartments(uniqueDepartments);

        if (newInventory.length === 0) {
          setError(t.noProducts);
          toast.warn(t.noProducts, { position: isRtl ? 'top-right' : 'top-left' });
        } else {
          setError('');
        }
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Fetch error:`, err);
        const errorMessage = err.response?.status === 403 ? t.errors.unauthorized_access : err.message || t.errors.fetch_sales;
        setError(errorMessage);
        toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
        setSales([]);
        setInventory([]);
      } finally {
        setLoading(false);
        setSalesLoading(false);
      }
    },
    [filterPeriod, startDate, endDate, user, t, isRtl, language]
  );

  // جلب البيانات عند التحميل الأولي
  useEffect(() => {
    if (!inventory.length && !error) {
      fetchData();
    }
  }, [fetchData, inventory, error]);

  // تحميل المزيد من المبيعات
  const loadMoreSales = useCallback(() => {
    setPage((prev) => prev + 1);
    fetchData(page + 1, true);
  }, [fetchData, page]);

  // إضافة إلى السلة
  const addToCart = useCallback(
    (product: InventoryItem) => {
      if (product.currentStock < 1) {
        toast.error(t.errors.insufficient_stock, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      const existingItem = cartState.items.find((item) => item.productId === product.product._id);
      if (existingItem && existingItem.quantity >= product.currentStock) {
        toast.error(t.errors.exceeds_max_quantity, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      dispatchCart({
        type: 'ADD_ITEM',
        payload: {
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
      });
    },
    [t, isRtl, cartState.items]
  );

  // تحديث كمية المنتج
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
      dispatchCart({
        type: 'UPDATE_QUANTITY',
        payload: { productId, quantity },
      });
    },
    [inventory, t, isRtl]
  );

  // إزالة من السلة
  const removeFromCart = useCallback((productId: string) => {
    dispatchCart({ type: 'REMOVE_ITEM', payload: productId });
  }, []);

  // إرسال أو تحديث المبيعة
  const handleSubmitSale = useCallback(async () => {
    if (cartState.items.length === 0) {
      toast.error(t.errors.empty_cart, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    if (cartState.customerPhone && !/^\+?\d{7,15}$/.test(cartState.customerPhone)) {
      toast.error(t.errors.invalid_customer_phone, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    if (cartState.paymentMethod && !['cash', 'credit_card', 'bank_transfer'].includes(cartState.paymentMethod)) {
      toast.error(t.errors.invalid_payment_method, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }

    const saleData = {
      branch: user?.branchId,
      items: cartState.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      notes: cartState.notes.trim() || undefined,
      paymentMethod: cartState.paymentMethod || undefined,
      customerName: cartState.customerName.trim() || undefined,
      customerPhone: cartState.customerPhone?.trim() || undefined,
    };

    try {
      if (editingSaleId) {
        await salesAPI.update(editingSaleId, saleData);
        toast.success(t.updateSale, { position: isRtl ? 'top-right' : 'top-left' });
      } else {
        await salesAPI.create(saleData);
        toast.success(t.submitSale, { position: isRtl ? 'top-right' : 'top-left' });
      }
      dispatchCart({ type: 'RESET' });
      setEditingSaleId(null);
      fetchData();
    } catch (err: any) {
      console.error(`[${new Date().toISOString()}] Sale ${editingSaleId ? 'update' : 'submission'} error:`, err);
      const errorMessage = err.response?.status === 403 ? t.errors.unauthorized_access : (editingSaleId ? t.errors.update_sale_failed : t.errors.create_sale_failed);
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    }
  }, [cartState, user, t, isRtl, fetchData, editingSaleId]);

  // تعديل المبيعة
  const handleEditSale = useCallback((sale: Sale) => {
    setEditingSaleId(sale._id);
    dispatchCart({ type: 'RESET' });
    sale.items.forEach((item) => {
      dispatchCart({
        type: 'ADD_ITEM',
        payload: {
          productId: item.productId,
          productName: item.productName,
          productNameEn: item.productNameEn,
          unit: item.unit,
          unitEn: item.unitEn,
          displayName: item.displayName,
          displayUnit: item.displayUnit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        },
      });
    });
    dispatchCart({ type: 'SET_NOTES', payload: sale.notes || '' });
    dispatchCart({ type: 'SET_CUSTOMER_NAME', payload: sale.customerName || '' });
    dispatchCart({ type: 'SET_CUSTOMER_PHONE', payload: sale.customerPhone || undefined });
    dispatchCart({ type: 'SET_PAYMENT_METHOD', payload: sale.paymentMethod || 'cash' });
    setActiveTab('new');
  }, []);

  // حذف المبيعة
  const handleDeleteSale = useCallback(
    async (id: string) => {
      if (window.confirm(isRtl ? 'هل أنت متأكد من حذف هذه المبيعة؟' : 'Are you sure you want to delete this sale?')) {
        try {
          await salesAPI.delete(id);
          toast.success(t.deleteSale, { position: isRtl ? 'top-right' : 'top-left' });
          fetchData();
        } catch (err: any) {
          console.error(`[${new Date().toISOString()}] Sale deletion error:`, err);
          const errorMessage = err.response?.status === 403 ? t.errors.unauthorized_access : t.errors.delete_sale_failed;
          toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
        }
      }
    },
    [fetchData, t, isRtl]
  );

  // خيارات الفروع
  const branchOptions = useMemo(() => {
    return branches.map((branch) => ({ value: branch._id, label: branch.displayName }));
  }, [branches]);

  // خيارات الأقسام
  const departmentOptions = useMemo(
    () => [
      { value: '', label: t.allDepartments },
      ...departments.map((dept) => ({ value: dept._id, label: dept.displayName })),
    ],
    [departments, t]
  );

  // خيارات طرق الدفع
  const paymentMethodOptions = useMemo(
    () => [
      { value: 'cash', label: t.paymentMethods.cash },
      { value: 'credit_card', label: t.paymentMethods.credit_card },
      { value: 'bank_transfer', label: t.paymentMethods.bank_transfer },
    ],
    [t.paymentMethods]
  );

  // خيارات التصفية
  const periodOptions = useMemo(
    () => [
      { value: 'all', label: isRtl ? 'الكل' : 'All' },
      { value: 'custom', label: t.customRange },
    ],
    [t, isRtl]
  );

  // إجمالي السلة
  const totalCartAmount = useMemo(() => {
    return cartState.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toFixed(2);
  }, [cartState.items]);

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
            onClick={() => {
              setActiveTab('new');
              setEditingSaleId(null);
              dispatchCart({ type: 'RESET' });
            }}
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
      </div>
      {activeTab === 'new' && (
        <div className={`space-y-8 ${cartState.items.length > 0 ? 'lg:grid lg:grid-cols-3 lg:gap-8 lg:space-y-0' : ''}`}>
          <section className={`${cartState.items.length > 0 ? 'lg:col-span-2 lg:overflow-y-auto lg:max-h-[calc(100vh-12rem)] scrollbar-none' : ''}`}>
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-6">{t.availableProducts}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <ProductSearchInput
                  value={searchInput}
                  onChange={handleSearchChange}
                  placeholder={t.searchPlaceholder}
                  ariaLabel={t.searchPlaceholder}
                />
                <ProductDropdown
                  value={selectedDepartment}
                  onChange={setSelectedDepartment}
                  options={departmentOptions}
                  ariaLabel={t.department}
                />
              </div>
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
                    cartItem={cartState.items.find((item) => item.productId === product.product._id)}
                    onAdd={() => addToCart(product)}
                    onUpdate={(quantity) => updateCartQuantity(product.product._id, quantity)}
                    onRemove={() => removeFromCart(product.product._id)}
                  />
                ))}
              </div>
            )}
          </section>
          {cartState.items.length > 0 && (
            <aside className="lg:col-span-1 lg:sticky lg:top-8 space-y-6 max-h-[calc(100vh-12rem)] overflow-y-auto scrollbar-none">
              <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-6">{t.cart}</h3>
                <div className="space-y-4">
                  {cartState.items.map((item) => (
                    <div key={item.productId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{item.displayName || t.errors.deleted_product}</p>
                        <p className="text-sm text-gray-600">
                          {item.quantity} × {item.unitPrice} {t.currency}
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
                      value={cartState.customerName}
                      onChange={(e) => dispatchCart({ type: 'SET_CUSTOMER_NAME', payload: e.target.value })}
                      placeholder={t.customerName}
                      className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                      aria-label={t.customerName}
                    />
                    <input
                      type="text"
                      value={cartState.customerPhone || ''}
                      onChange={(e) => dispatchCart({ type: 'SET_CUSTOMER_PHONE', payload: e.target.value })}
                      placeholder={t.customerPhone}
                      className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                      aria-label={t.customerPhone}
                    />
                    <ProductDropdown
                      value={cartState.paymentMethod}
                      onChange={(value) => dispatchCart({ type: 'SET_PAYMENT_METHOD', payload: value })}
                      options={paymentMethodOptions}
                      ariaLabel={t.paymentMethod}
                    />
                    <textarea
                      value={cartState.notes}
                      onChange={(e) => dispatchCart({ type: 'SET_NOTES', payload: e.target.value })}
                      placeholder={t.notes}
                      className={`w-full ${isRtl ? 'pr-4' : 'pl-4'} py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm resize-none h-24 ${isRtl ? 'text-right' : 'text-left'}`}
                      aria-label={t.notes}
                    />
                  </div>
                  <button
                    onClick={handleSubmitSale}
                    className="w-full mt-4 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
                    disabled={cartState.items.length === 0}
                    aria-label={editingSaleId ? t.updateSale : t.submitSale}
                  >
                    {editingSaleId ? t.updateSale : t.submitSale}
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
              <ProductDropdown value={filterPeriod} onChange={setFilterPeriod} options={periodOptions} ariaLabel={t.filterBy} />
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
            </div>
          </div>
          {loading ? (
            <div className="space-y-6">
              {[...Array(3)].map((_, index) => (
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
              <div className="space-y-6">
                {sales.map((sale) => (
                  <SaleCard key={sale._id} sale={sale} onEdit={handleEditSale} onDelete={handleDeleteSale} />
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
    </div>
  );
};

export default React.memo(BranchSalesReport);