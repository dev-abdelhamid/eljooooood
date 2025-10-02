import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { branchesAPI, inventoryAPI, returnsAPI } from '../services/api';
import salesAPI from '../services/salesAPI';
import { AlertCircle, DollarSign, Plus, Minus, Trash2, Package, Search, X, ChevronDown, Edit, Download } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { debounce } from 'lodash';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

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
  status: string;
  paymentMethod: string;
  customerName?: string;
  customerPhone?: string;
  createdAt: string;
  notes?: string;
  returns?: Array<{
    _id: string;
    returnNumber: string;
    status: string;
    items: Array<{ product: string; productName: string; quantity: number; reason: string }>;
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
  branchSales: Array<{ branchId: string; branchName: string; branchNameEn?: string; displayName: string; totalSales: number }>;
  productSales: Array<{ productId: string; productName: string; productNameEn?: string; displayName: string; totalQuantity: number; totalRevenue: number }>;
  departmentSales: Array<{ departmentId: string; departmentName: string; departmentNameEn?: string; displayName: string; totalRevenue: number }>;
  totalSales: number;
  topProduct: { productName: string; productNameEn?: string; displayName: string; totalQuantity: number };
  salesTrend?: Array<{ date: string; totalSales: number }>;
}

interface ReturnForm {
  saleId: string;
  items: Array<{ product: string; quantity: number; reason: string }>;
  reason: string;
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
    customerPhone: 'رقم هاتف العميل',
    paymentMethod: 'طريقة الدفع',
    paymentStatus: 'حالة الدفع',
    paymentMethods: {
      cash: 'نقدًا',
      card: 'بطاقة',
      credit: 'آجل',
    },
    paymentStatuses: {
      completed: 'مكتمل',
      pending: 'معلق',
      canceled: 'ملغى',
    },
    submitSale: 'إرسال المبيعة',
    analytics: 'إحصائيات المبيعات',
    branchSales: 'مبيعات الفروع',
    productSales: 'مبيعات المنتجات',
    departmentSales: 'مبيعات الأقسام',
    totalSales: 'إجمالي المبيعات',
    topProduct: 'المنتج الأكثر مبيعًا',
    previousSales: 'المبيعات السابقة',
    noSales: 'لا توجد طلبات',
    date: 'التاريخ',
    returns: 'المرتجعات',
    return: 'مرتجع',
    reason: 'السبب',
    quantity: 'الكمية',
    searchPlaceholder: 'ابحث عن المنتجات...',
    editSale: 'تعديل المبيعة',
    deleteSale: 'حذف المبيعة',
    createReturn: 'إنشاء مرتجع',
    loadMore: 'تحميل المزيد',
    exportReport: 'تصدير التقرير',
    errors: {
      unauthorized_access: 'غير مصرح لك بالوصول',
      no_branch_assigned: 'لم يتم تعيين فرع',
      fetch_sales: 'خطأ أثناء جلب المبيعات',
      create_sale_failed: 'فشل إنشاء المبيعة',
      update_sale_failed: 'فشل تحديث المبيعة',
      delete_sale_failed: 'فشل حذف المبيعة',
      create_return_failed: 'فشل إنشاء المرتجع',
      export_failed: 'فشل تصدير التقرير',
      insufficient_stock: 'المخزون غير كافٍ',
      exceeds_max_quantity: 'الكمية تتجاوز الحد الأقصى',
      invalid_quantity: 'الكمية غير صالحة',
      empty_cart: 'السلة فارغة',
      deleted_product: 'منتج محذوف',
    },
    currency: 'ريال',
    units: { default: 'غير محدد' },
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
    customerName: 'Customer Name',
    customerPhone: 'Customer Phone',
    paymentMethod: 'Payment Method',
    paymentStatus: 'Payment Status',
    paymentMethods: {
      cash: 'Cash',
      card: 'Card',
      credit: 'Credit',
    },
    paymentStatuses: {
      completed: 'Completed',
      pending: 'Pending',
      canceled: 'Canceled',
    },
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
    editSale: 'Edit Sale',
    deleteSale: 'Delete Sale',
    createReturn: 'Create Return',
    loadMore: 'Load More',
    exportReport: 'Export Report',
    errors: {
      unauthorized_access: 'You are not authorized to access',
      no_branch_assigned: 'No branch assigned',
      fetch_sales: 'Error fetching sales',
      create_sale_failed: 'Failed to create sale',
      update_sale_failed: 'Failed to update sale',
      delete_sale_failed: 'Failed to delete sale',
      create_return_failed: 'Failed to create return',
      export_failed: 'Failed to export report',
      insufficient_stock: 'Insufficient stock',
      exceeds_max_quantity: 'Quantity exceeds maximum available',
      invalid_quantity: 'Invalid quantity',
      empty_cart: 'Cart is empty',
      deleted_product: 'Deleted Product',
    },
    currency: 'SAR',
    units: { default: 'N/A' },
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
  className?: string;
}> = ({ value, onChange, options, ariaLabel, disabled = false, className }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((opt) => opt.value === value) || options[0] || { label: isRtl ? 'اختر' : 'Select' };

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
    <div className="h-[200px] p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-amber-200">
      <div className="space-y-2">
        <h3 className="font-bold text-gray-900 text-base truncate">{product.displayName}</h3>
        <p className="text-sm text-amber-600">{t.department}: {product.product.department?.displayName || t.departments.unknown}</p>
        <p className="text-sm text-gray-600">{t.availableStock}: {product.currentStock} {product.displayUnit}</p>
        <p className="font-semibold text-gray-900 text-sm">{t.unitPrice}: {product.product.price} {t.currency}</p>
      </div>
      <div className="mt-4 flex justify-end">
        {cartItem ? (
          <div className="flex items-center gap-2">
            <QuantityInput
              value={cartItem.quantity}
              onChange={(val) => onUpdate(parseInt(val) || 0)}
              onIncrement={() => onUpdate(cartItem.quantity + 1)}
              onDecrement={() => cartItem.quantity > 1 ? onUpdate(cartItem.quantity - 1) : onRemove()}
            />
            <button
              onClick={onRemove}
              className="w-8 h-8 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors duration-200 flex items-center justify-center"
              aria-label={isRtl ? 'إزالة من السلة' : 'Remove from cart'}
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
};

const SaleCard: React.FC<{
  sale: Sale;
  onEdit: () => void;
  onDelete: () => void;
  onCreateReturn: () => void;
}> = ({ sale, onEdit, onDelete, onCreateReturn }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  return (
    <div className="p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-amber-200">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-gray-900 text-base">{sale.orderNumber} - {sale.branch.displayName}</h3>
          <p className="text-sm text-gray-600">{t.date}: {sale.createdAt}</p>
          <p className="text-sm text-gray-600">{t.total}: {sale.totalAmount} {t.currency}</p>
          {sale.customerName && <p className="text-sm text-gray-600">{t.customerName}: {sale.customerName}</p>}
          {sale.customerPhone && <p className="text-sm text-gray-600">{t.customerPhone}: {sale.customerPhone}</p>}
          {sale.notes && <p className="text-sm text-gray-500">{t.notes}: {sale.notes}</p>}
          <ul className="list-disc list-inside text-sm text-gray-600 mt-2">
            {sale.items.map((item, index) => (
              <li key={index}>
                {item.displayName} ({item.department?.displayName || t.departments.unknown}) - {t.quantity}: {item.quantity} {item.displayUnit}, {t.unitPrice}: {item.unitPrice} {t.currency}
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
        <div className="flex flex-col gap-2">
          <button onClick={onEdit} className="w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors duration-200 flex items-center justify-center" aria-label={t.editSale}>
            <Edit className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="w-8 h-8 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors duration-200 flex items-center justify-center" aria-label={t.deleteSale}>
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={onCreateReturn} className="w-8 h-8 bg-amber-600 hover:bg-amber-700 text-white rounded-full transition-colors duration-200 flex items-center justify-center" aria-label={t.createReturn}>
            <Plus className="w-4 h-4" />
          </button>
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

const SaleModal: React.FC<{
  sale: Sale | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (saleData: Partial<Sale>) => void;
  isEditMode: boolean;
}> = ({ sale, isOpen, onClose, onSave, isEditMode }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [formData, setFormData] = useState<Partial<Sale>>({
    items: [],
    totalAmount: 0,
    status: 'completed',
    paymentMethod: 'cash',
    customerName: '',
    customerPhone: '',
    notes: '',
  });

  useEffect(() => {
    if (sale && isOpen) {
      setFormData({
        items: sale.items,
        totalAmount: sale.totalAmount,
        status: sale.status,
        paymentMethod: sale.paymentMethod,
        customerName: sale.customerName,
        customerPhone: sale.customerPhone,
        notes: sale.notes,
      });
    } else {
      setFormData({
        items: [],
        totalAmount: 0,
        status: 'completed',
        paymentMethod: 'cash',
        customerName: '',
        customerPhone: '',
        notes: '',
      });
    }
  }, [sale, isOpen]);

  const handleChange = (field: keyof Sale, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    onSave(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full">
        <h2 className="text-xl font-bold mb-4">{isEditMode ? t.editSale : t.submitSale}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t.status}</label>
            <ProductDropdown
              value={formData.status || 'completed'}
              onChange={(value) => handleChange('status', value)}
              options={Object.keys(t.paymentStatuses).map((key) => ({
                value: key,
                label: t.paymentStatuses[key as keyof typeof t.paymentStatuses],
              }))}
              ariaLabel={t.paymentStatus}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t.paymentMethod}</label>
            <ProductDropdown
              value={formData.paymentMethod || 'cash'}
              onChange={(value) => handleChange('paymentMethod', value)}
              options={Object.keys(t.paymentMethods).map((key) => ({
                value: key,
                label: t.paymentMethods[key as keyof typeof t.paymentMethods],
              }))}
              ariaLabel={t.paymentMethod}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t.customerName}</label>
            <input
              type="text"
              value={formData.customerName || ''}
              onChange={(e) => handleChange('customerName', e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t.customerPhone}</label>
            <input
              type="text"
              value={formData.customerPhone || ''}
              onChange={(e) => handleChange('customerPhone', e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t.notes}</label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg"
              rows={4}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
            >
              {isRtl ? 'حفظ' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ReturnModal: React.FC<{
  sale: Sale | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (returnData: ReturnForm) => void;
}> = ({ sale, isOpen, onClose, onSave }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [returnItems, setReturnItems] = useState<Array<{ product: string; quantity: number; reason: string }>>([]);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (sale && isOpen) {
      setReturnItems(sale.items.map(item => ({
        product: item.product,
        quantity: 0,
        reason: '',
      })));
      setReason('');
    }
  }, [sale, isOpen]);

  const handleQuantityChange = (productId: string, quantity: number) => {
    setReturnItems(prev => prev.map(item =>
      item.product === productId ? { ...item, quantity: Math.max(0, Math.min(quantity, sale?.items.find(i => i.product === productId)?.quantity || 0)) } : item
    ));
  };

  const handleReasonChange = (productId: string, reason: string) => {
    setReturnItems(prev => prev.map(item =>
      item.product === productId ? { ...item, reason } : item
    ));
  };

  const handleSubmit = () => {
    const validItems = returnItems.filter(item => item.quantity > 0 && item.reason.trim());
    if (validItems.length === 0 || !reason.trim()) {
      toast.error(isRtl ? 'يرجى تحديد كمية وسبب للمرتجع' : 'Please specify quantity and reason for return');
      return;
    }
    onSave({
      saleId: sale?._id || '',
      items: validItems,
      reason,
    });
    onClose();
  };

  if (!isOpen || !sale) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full">
        <h2 className="text-xl font-bold mb-4">{t.createReturn}</h2>
        <div className="space-y-4">
          {sale.items.map((item, index) => (
            <div key={index} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{item.displayName}</p>
                <p className="text-sm text-gray-600">{t.quantity}: {item.quantity} {item.displayUnit}</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max={item.quantity}
                  value={returnItems.find(r => r.product === item.product)?.quantity || 0}
                  onChange={(e) => handleQuantityChange(item.product, parseInt(e.target.value) || 0)}
                  className="w-16 p-2 border border-gray-200 rounded-lg"
                />
                <input
                  type="text"
                  placeholder={t.reason}
                  value={returnItems.find(r => r.product === item.product)?.reason || ''}
                  onChange={(e) => handleReasonChange(item.product, e.target.value)}
                  className="w-32 p-2 border border-gray-200 rounded-lg"
                />
              </div>
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700">{t.reason}</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg"
              rows={4}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
            >
              {isRtl ? 'إرسال' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SalesReport: React.FC = () => {
  const { t: languageT, language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const [sales, setSales] = useState<Sale[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [analytics, setAnalytics] = useState<SalesAnalytics>({
    branchSales: [],
    productSales: [],
    departmentSales: [],
    totalSales: 0,
    topProduct: { productName: t.departments.unknown, displayName: t.departments.unknown, totalQuantity: 0 },
    salesTrend: [],
  });
  const [filterBranch, setFilterBranch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [salesLoading, setSalesLoading] = useState(false);
  const [error, setError] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentStatus, setPaymentStatus] = useState('completed');
  const [selectedBranch, setSelectedBranch] = useState(user?.role === 'branch' && user?.branchId ? user.branchId : '');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);

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

  const fetchData = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    if (!user?.role || !['branch', 'admin', 'production'].includes(user.role)) {
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

    setLoading(pageNum === 1);
    setSalesLoading(pageNum > 1);
    try {
      const params: any = { page: pageNum, limit: 20, sort: '-createdAt', lang: language };
      if (user.role === 'branch' || user.role === 'production') {
        params.branch = user.branchId || selectedBranch;
      } else if (filterBranch) {
        params.branch = filterBranch;
      }
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const [salesResponse, branchesResponse, inventoryResponse, analyticsResponse] = await Promise.all([
        salesAPI.getAll(params),
        user.role === 'admin' ? branchesAPI.getAll() : Promise.resolve({ branches: [] }),
        inventoryAPI.getInventory({ branch: user.branchId || selectedBranch, lowStock: false }),
        user.role === 'admin' ? salesAPI.getAnalytics(params) : Promise.resolve({
          branchSales: [],
          productSales: [],
          departmentSales: [],
          totalSales: 0,
          topProduct: { productName: t.departments.unknown, displayName: t.departments.unknown, totalQuantity: 0 },
          salesTrend: [],
        }),
      ]);

      setSales(append ? (prev) => [...prev, ...salesResponse.sales] : salesResponse.sales);
      setBranches(branchesResponse.branches);
      setInventory(inventoryResponse.inventory);
      setAnalytics(analyticsResponse);
      setHasMore(salesResponse.sales.length === 20);
      setLoading(false);
      setSalesLoading(false);
    } catch (err: any) {
      setError(t.errors.fetch_sales);
      toast.error(t.errors.fetch_sales, { position: isRtl ? 'top-right' : 'top-left' });
      setLoading(false);
      setSalesLoading(false);
    }
  }, [user, selectedBranch, filterBranch, startDate, endDate, language, isRtl, t]);

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  const handleAddToCart = (product: InventoryItem) => {
    if (product.currentStock < 1) {
      toast.error(t.errors.insufficient_stock, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.product._id);
      if (existing) {
        if (existing.quantity >= product.currentStock) {
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
  };

  const handleUpdateCart = (productId: string, quantity: number) => {
    const product = inventory.find((item) => item.product._id === productId);
    if (!product) {
      toast.error(t.errors.deleted_product, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    if (quantity > product.currentStock) {
      toast.error(t.errors.exceeds_max_quantity, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    if (quantity < 0) {
      toast.error(t.errors.invalid_quantity, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    if (quantity === 0) {
      setCart((prev) => prev.filter((item) => item.productId !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, quantity } : item))
    );
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const handleSubmitSale = async () => {
    if (cart.length === 0) {
      toast.error(t.errors.empty_cart, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    if (!selectedBranch) {
      toast.error(t.errors.no_branch_assigned, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    try {
      const totalAmount = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      await salesAPI.create({
        branch: selectedBranch,
        items: cart.map((item) => ({
          product: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        totalAmount,
        status: paymentStatus,
        paymentMethod,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        notes: notes.trim() || undefined,
        lang: language,
      });
      setCart([]);
      setNotes('');
      setCustomerName('');
      setCustomerPhone('');
      setPaymentMethod('cash');
      setPaymentStatus('completed');
      toast.success(t.submitSale, { position: isRtl ? 'top-right' : 'top-left' });
      fetchData(1);
    } catch (err: any) {
      toast.error(t.errors.create_sale_failed, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  const handleEditSale = async (saleData: Partial<Sale>) => {
    if (!selectedSale) return;
    try {
      await salesAPI.update(selectedSale._id, {
        ...saleData,
        lang: language,
      });
      toast.success(t.editSale, { position: isRtl ? 'top-right' : 'top-left' });
      fetchData(1);
    } catch (err: any) {
      toast.error(t.errors.update_sale_failed, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  const handleDeleteSale = async (saleId: string) => {
    try {
      await salesAPI.delete(saleId);
      toast.success(t.deleteSale, { position: isRtl ? 'top-right' : 'top-left' });
      fetchData(1);
    } catch (err: any) {
      toast.error(t.errors.delete_sale_failed, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  const handleCreateReturn = async (returnData: ReturnForm) => {
    try {
      await returnsAPI.create(returnData);
      toast.success(t.createReturn, { position: isRtl ? 'top-right' : 'top-left' });
      fetchData(1);
    } catch (err: any) {
      toast.error(t.errors.create_return_failed, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  const handleExportReport = async () => {
    try {
      const params: any = { format: 'csv', lang: language };
      if (filterBranch) params.branch = filterBranch;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const response = await salesAPI.exportReport(params);
      const blob = new Blob([response], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sales_report.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success(t.exportReport, { position: isRtl ? 'top-right' : 'top-left' });
    } catch (err: any) {
      toast.error(t.errors.export_failed, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  const branchSalesChartData = {
    labels: analytics.branchSales.map((bs) => bs.displayName),
    datasets: [
      {
        label: t.branchSales,
        data: analytics.branchSales.map((bs) => bs.totalSales),
        backgroundColor: 'rgba(245, 158, 11, 0.6)',
        borderColor: 'rgba(245, 158, 11, 1)',
        borderWidth: 1,
      },
    ],
  };

  const productSalesChartData = {
    labels: analytics.productSales.map((ps) => ps.displayName),
    datasets: [
      {
        label: t.productSales,
        data: analytics.productSales.map((ps) => ps.totalQuantity),
        backgroundColor: 'rgba(245, 158, 11, 0.6)',
        borderColor: 'rgba(245, 158, 11, 1)',
        borderWidth: 1,
      },
    ],
  };

  const salesTrendChartData = {
    labels: analytics.salesTrend?.map((st) => st.date) || [],
    datasets: [
      {
        label: t.totalSales,
        data: analytics.salesTrend?.map((st) => st.totalSales) || [],
        fill: false,
        borderColor: 'rgba(245, 158, 11, 1)',
        tension: 0.1,
      },
    ],
  };

  return (
    <div className={`min-h-screen bg-gray-50 p-4 md:p-8 ${isRtl ? 'font-arabic' : 'font-sans'}`}>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t.title}</h1>
        <p className="text-gray-600 mb-6">{t.subtitle}</p>

        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {(user?.role === 'branch' || user?.role === 'admin') && (
          <>
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{t.availableProducts}</h2>
              <div className="mb-4">
                <ProductSearchInput
                  value={searchInput}
                  onChange={handleSearchChange}
                  placeholder={t.searchPlaceholder}
                  ariaLabel={t.searchPlaceholder}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                  Array.from({ length: 6 }).map((_, index) => <ProductSkeletonCard key={index} />)
                ) : filteredInventory.length === 0 ? (
                  <p className="col-span-full text-center text-gray-500">{t.noProducts}</p>
                ) : (
                  filteredInventory.map((product) => (
                    <ProductCard
                      key={product._id}
                      product={product}
                      cartItem={cart.find((item) => item.productId === product.product._id)}
                      onAdd={() => handleAddToCart(product)}
                      onUpdate={(quantity) => handleUpdateCart(product.product._id, quantity)}
                      onRemove={() => handleRemoveFromCart(product.product._id)}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{t.cart}</h2>
              <div className="bg-white rounded-xl shadow-sm p-6">
                {cart.length === 0 ? (
                  <p className="text-gray-500 text-center">{t.emptyCart}</p>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item, index) => (
                      <div key={index} className="flex items-center justify-between border-b pb-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.displayName}</p>
                          <p className="text-sm text-gray-600">{t.quantity}: {item.quantity} {item.displayUnit}</p>
                          <p className="text-sm text-gray-600">{t.unitPrice}: {item.unitPrice} {t.currency}</p>
                        </div>
                        <QuantityInput
                          value={item.quantity}
                          onChange={(val) => handleUpdateCart(item.productId, parseInt(val) || 0)}
                          onIncrement={() => handleUpdateCart(item.productId, item.quantity + 1)}
                          onDecrement={() => handleUpdateCart(item.productId, item.quantity - 1)}
                        />
                      </div>
                    ))}
                    <div className="flex justify-between items-center">
                      <p className="text-lg font-semibold text-gray-900">
                        {t.total}: {cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)} {t.currency}
                      </p>
                    </div>
                  </div>
                )}
                <div className="mt-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t.notes}</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full p-2 border border-gray-200 rounded-lg"
                      rows={4}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t.customerName}</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full p-2 border border-gray-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t.customerPhone}</label>
                    <input
                      type="text"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full p-2 border border-gray-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t.paymentMethod}</label>
                    <ProductDropdown
                      value={paymentMethod}
                      onChange={setPaymentMethod}
                      options={Object.keys(t.paymentMethods).map((key) => ({
                        value: key,
                        label: t.paymentMethods[key as keyof typeof t.paymentMethods],
                      }))}
                      ariaLabel={t.paymentMethod}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t.paymentStatus}</label>
                    <ProductDropdown
                      value={paymentStatus}
                      onChange={setPaymentStatus}
                      options={Object.keys(t.paymentStatuses).map((key) => ({
                        value: key,
                        label: t.paymentStatuses[key as keyof typeof t.paymentStatuses],
                      }))}
                      ariaLabel={t.paymentStatus}
                    />
                  </div>
                  {user?.role === 'admin' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t.branches.select_branch}</label>
                      <ProductDropdown
                        value={selectedBranch}
                        onChange={setSelectedBranch}
                        options={[
                          { value: '', label: t.branches.select_branch },
                          ...branches.map((branch) => ({
                            value: branch._id,
                            label: branch.displayName,
                          })),
                        ]}
                        ariaLabel={t.branches.select_branch}
                      />
                    </div>
                  )}
                  <button
                    onClick={handleSubmitSale}
                    className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center justify-center gap-2"
                    disabled={cart.length === 0 || !selectedBranch}
                  >
                    <DollarSign className="w-5 h-5" />
                    {t.submitSale}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {user?.role === 'admin' && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{t.analytics}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.branchSales}</h3>
                <Bar
                  data={branchSalesChartData}
                  options={{
                    responsive: true,
                    plugins: { legend: { position: 'top' }, title: { display: true, text: t.branchSales } },
                  }}
                />
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.productSales}</h3>
                <Bar
                  data={productSalesChartData}
                  options={{
                    responsive: true,
                    plugins: { legend: { position: 'top' }, title: { display: true, text: t.productSales } },
                  }}
                />
              </div>
              {analytics.salesTrend && analytics.salesTrend.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6 col-span-full">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.totalSales}</h3>
                  <Line
                    data={salesTrendChartData}
                    options={{
                      responsive: true,
                      plugins: { legend: { position: 'top' }, title: { display: true, text: t.totalSales } },
                    }}
                  />
                </div>
              )}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.totalSales}</h3>
                <p className="text-2xl font-bold text-amber-600">{analytics.totalSales} {t.currency}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.topProduct}</h3>
                <p className="text-lg text-gray-700">{analytics.topProduct.displayName} ({analytics.topProduct.totalQuantity} {t.units.default})</p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t.previousSales}</h2>
          <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {user?.role === 'admin' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">{t.branches.select_branch}</label>
                <ProductDropdown
                  value={filterBranch}
                  onChange={(value) => {
                    setFilterBranch(value);
                    fetchData(1);
                  }}
                  options={[
                    { value: '', label: t.branches.all_branches },
                    ...branches.map((branch) => ({
                      value: branch._id,
                      label: branch.displayName,
                    })),
                  ]}
                  ariaLabel={t.branches.select_branch}
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">{t.date}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  fetchData(1);
                }}
                className="w-full p-2 border border-gray-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t.date}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  fetchData(1);
                }}
                className="w-full p-2 border border-gray-200 rounded-lg"
              />
            </div>
          </div>
          {user?.role === 'admin' && (
            <button
              onClick={handleExportReport}
              className="mb-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              {t.exportReport}
            </button>
          )}
          <div className="space-y-6">
            {sales.length === 0 && !loading ? (
              <p className="text-gray-500 text-center">{t.noSales}</p>
            ) : (
              sales.map((sale) => (
                <SaleCard
                  key={sale._id}
                  sale={sale}
                  onEdit={() => {
                    setSelectedSale(sale);
                    setIsEdit(true);
                    setIsModalOpen(true);
                  }}
                  onDelete={() => handleDeleteSale(sale._id)}
                  onCreateReturn={() => {
                    setSelectedSale(sale);
                    setIsReturnOpen(true);
                  }}
                />
              ))
            )}
            {salesLoading && (
              <div className="space-y-6">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="p-5 bg-white rounded-xl shadow-sm border border-gray-100">
                    <div className="space-y-3 animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {hasMore && (
              <button
                onClick={() => fetchData(page + 1, true).then(() => setPage(page + 1))}
                className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
                disabled={salesLoading}
              >
                {t.loadMore}
              </button>
            )}
          </div>
        </div>
      </div>
      <SaleModal
        sale={selectedSale}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedSale(null);
          setIsEdit(false);
        }}
        onSave={handleEditSale}
        isEditMode={isEdit}
      />
      <ReturnModal
        sale={selectedSale}
        isOpen={isReturnOpen}
        onClose={() => {
          setIsReturnOpen(false);
          setSelectedSale(null);
        }}
        onSave={handleCreateReturn}
      />
    </div>
  );
};

export default SalesReport;