import { useState, useEffect, useCallback, useMemo, useReducer } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Plus, X, AlertCircle, Minus, Search, ChevronDown, CheckCircle } from 'lucide-react';
import {factoryOrdersAPI, chefsAPI, productsAPI, isValidObjectId } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { ProductSearchInput } from './NewOrder';
import { useNotifications } from '../contexts/NotificationContext';

// Enums for type safety
enum OrderStatus {
  REQUESTED = 'requested',
  PENDING = 'pending',
  APPROVED = 'approved',
  IN_PRODUCTION = 'in_production',
  COMPLETED = 'completed',
  STORED = 'stored',
  CANCELLED = 'cancelled',
}

// Interfaces aligned with backend
interface FactoryOrder {
  _id: string;
  orderNumber: string;
  items: {
    _id: string;
    product: {
      _id: string;
      name: string;
      nameEn: string;
      unit: string;
      unitEn: string;
      department: { _id: string; name: string; nameEn: string; displayName: string } | null;
      displayName: string;
      displayUnit: string;
    } | null;
    quantity: number;
    assignedTo: {
      _id: string;
      name: string;
      nameEn: string;
      displayName: string;
    } | null;
    status: 'pending' | 'assigned' | 'in_production' | 'completed';
  }[];
  status: OrderStatus;
  notes: string;
  createdAt: string;
  createdBy: {
    _id: string;
    name: string;
    nameEn: string;
    displayName: string;
    role: string;
  };
}

interface Chef {
  _id: string;
  user: {
    _id: string;
    name: string;
    nameEn?: string;
    username: string;
    email: string;
    phone: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
  department: { _id: string; name: string; nameEn?: string };
  createdAt: string;
}

interface ProductionItem {
  product: string;
  quantity: number;
  assignedTo?: string; // Chef ID
}

interface ProductionFormState {
  notes: string;
  items: ProductionItem[];
}

interface AvailableProduct {
  productId: string;
  productName: string;
  unit: string;
  departmentName: string;
  departmentId: string;
}

// Translations
const translations = {
  ar: {
    title: 'طلبات الإنتاج',
    description: 'إدارة طلبات إنتاج المخزون',
    noOrders: 'لا توجد طلبات إنتاج',
    create: 'إنشاء طلب جديد',
    search: 'ابحث حسب رقم الطلب أو المنتج...',
    filterByStatus: 'تصفية حسب الحالة',
    allStatuses: 'كل الحالات',
    filterByDepartment: 'تصفية حسب القسم',
    allDepartments: 'كل الأقسام',
    sortBy: 'ترتيب حسب',
    sortDate: 'التاريخ',
    sortTotalQuantity: 'الكمية الإجمالية',
    notes: 'ملاحظات',
    notesPlaceholder: 'أدخل ملاحظات (اختياري)',
    items: 'العناصر',
    chef: 'الشيف',
    addItem: 'إضافة عنصر',
    removeItem: 'إزالة العنصر',
    submit: 'إرسال',
    submitting: 'جاري الإرسال...',
    cancel: 'إلغاء',
    orderNumber: 'رقم الطلب',
    date: 'التاريخ',
    quantity: 'الكمية',
    status: 'الحالة',
    priority: 'الأولوية',
    createdBy: 'تم الإنشاء بواسطة',
    approve: 'الموافقة',
    complete: 'إكمال',
    cancelOrder: 'إلغاء',
    assign: 'تعيين شيفات',
    confirmStorage: 'تأكيد التخزين',
    storing: 'جاري التخزين...',
    stored: 'مخزن',
    requested: 'مطلوب',
    pending: 'قيد الانتظار',
    approved: 'تم الموافقة',
    in_production: 'في الإنتاج',
    completed: 'مكتمل',
    stored: 'مخزن',
    cancelled: 'ملغى',
    low: 'منخفض',
    medium: 'متوسط',
    high: 'مرتفع',
    urgent: 'عاجل',
    errors: {
      fetchOrders: 'خطأ في جلب طلبات الإنتاج',
      createOrder: 'خطأ في إنشاء الطلب',
      updateStatus: 'خطأ في تحديث الحالة',
      assignChefs: 'خطأ في تعيين الشيفات',
      completeItem: 'خطأ في إكمال العنصر',
      storeOrder: 'خطأ في تخزين الطلب',
      invalidForm: 'البيانات غير صالحة',
      required: '{field} مطلوب',
      nonNegative: '{field} يجب أن يكون غير سالب',
      invalidQuantity: 'الكمية يجب أن تكون أكبر من 0',
      invalidProductId: 'معرف المنتج غير صالح',
      invalidChefId: 'معرف الشيف غير صالح',
      duplicateProduct: 'لا يمكن إضافة نفس المنتج أكثر من مرة',
    },
    notifications: {
      orderCreated: 'تم إنشاء الطلب بنجاح',
      statusUpdated: 'تم تحديث حالة الطلب بنجاح',
      chefsAssigned: 'تم تعيين الشيفات بنجاح',
      itemCompleted: 'تم إكمال العنصر بنجاح',
      orderStored: 'تم تخزين الطلب بنجاح',
    },
  },
  en: {
    title: 'Production Orders',
    description: 'Manage inventory production orders',
    noOrders: 'No production orders found',
    create: 'Create New Order',
    search: 'Search by order number or product...',
    filterByStatus: 'Filter by Status',
    allStatuses: 'All Statuses',
    filterByDepartment: 'Filter by Department',
    allDepartments: 'All Departments',
    sortBy: 'Sort By',
    sortDate: 'Date',
    sortTotalQuantity: 'Total Quantity',
    notes: 'Notes',
    notesPlaceholder: 'Enter notes (optional)',
    items: 'Items',
    chef: 'Chef',
    addItem: 'Add Item',
    removeItem: 'Remove Item',
    submit: 'Submit',
    submitting: 'Submitting...',
    cancel: 'Cancel',
    orderNumber: 'Order Number',
    date: 'Date',
    quantity: 'Quantity',
    status: 'Status',
    priority: 'Priority',
    createdBy: 'Created By',
    approve: 'Approve',
    complete: 'Complete',
    cancelOrder: 'Cancel',
    assign: 'Assign Chefs',
    confirmStorage: 'Confirm Storage',
    storing: 'Storing...',
    stored: 'Stored',
    requested: 'Requested',
    pending: 'Pending',
    approved: 'Approved',
    in_production: 'In Production',
    completed: 'Completed',
    stored: 'Stored',
    cancelled: 'Cancelled',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    urgent: 'Urgent',
    errors: {
      fetchOrders: 'Error fetching production orders',
      createOrder: 'Error creating order',
      updateStatus: 'Error updating status',
      assignChefs: 'Error assigning chefs',
      completeItem: 'Error completing item',
      storeOrder: 'Error storing order',
      invalidForm: 'Invalid form data',
      required: '{field} is required',
      nonNegative: '{field} must be non-negative',
      invalidQuantity: 'Quantity must be greater than 0',
      invalidProductId: 'Invalid product ID',
      invalidChefId: 'Invalid chef ID',
      duplicateProduct: 'Cannot add the same product multiple times',
    },
    notifications: {
      orderCreated: 'Order created successfully',
      statusUpdated: 'Order status updated successfully',
      chefsAssigned: 'Chefs assigned successfully',
      itemCompleted: 'Item completed successfully',
      orderStored: 'Order stored successfully',
    },
  },
};

// QuantityInput Component
const QuantityInput = ({
  value,
  onChange,
  onIncrement,
  onDecrement,
}: {
  value: number;
  onChange: (val: string) => void;
  onIncrement: () => void;
  onDecrement: () => void;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const handleChange = (val: string) => {
    const num = parseInt(val, 10);
    if (val === '' || isNaN(num) || num < 1) {
      onChange('1');
      return;
    }
    onChange(val);
  };
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onDecrement}
        className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors duration-200 flex items-center justify-center disabled:opacity-50"
        aria-label={isRtl ? 'تقليل الكمية' : 'Decrease quantity'}
        disabled={value <= 1}
      >
        <Minus className="w-4 h-4" />
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        min={1}
        className="w-12 h-8 text-center border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm transition-all duration-200"
        style={{ appearance: 'none', MozAppearance: 'textfield' }}
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

export const ProductDropdown = ({
  value,
  onChange,
  options,
  ariaLabel,
  disabled = false,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
  disabled?: boolean;
  placeholder?: string;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption =
    options.find((opt) => opt.value === value) ||
    { value: '', label: placeholder || (isRtl ? 'اختر' : 'Select') };
  return (
    <div className="relative group">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 bg-gradient-to-r from-white to-gray-50 shadow-sm hover:shadow-md text-sm text-gray-700 ${isRtl ? 'text-right' : 'text-left'} flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={ariaLabel}
      >
        <span className="truncate">{selectedOption.label || (isRtl ? 'غير معروف' : 'Unknown')}</span>
        <div className={`${isOpen ? 'rotate-180' : 'rotate-0'} transition-transform duration-200`}>
          <ChevronDown className="w-5 h-5 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
        </div>
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
              {option.label || (isRtl ? 'غير معروف' : 'Unknown')}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Reducer for production form
type ProductionFormAction =
  | { type: 'SET_NOTES'; payload: string }
  | { type: 'ADD_ITEM'; payload: ProductionItem }
  | { type: 'UPDATE_ITEM'; payload: { index: number; field: keyof ProductionItem; value: string | number } }
  | { type: 'REMOVE_ITEM'; payload: number }
  | { type: 'RESET' }
  | { type: 'INITIALIZE_ITEMS'; payload: ProductionItem[] };

const productionFormReducer = (state: ProductionFormState, action: ProductionFormAction): ProductionFormState => {
  switch (action.type) {
    case 'SET_NOTES':
      return { ...state, notes: action.payload };
    case 'ADD_ITEM':
      return { ...state, items: [...state.items, action.payload] };
    case 'UPDATE_ITEM':
      const newItems = [...state.items];
      newItems[action.payload.index] = { ...newItems[action.payload.index], [action.payload.field]: action.payload.value };
      return { ...state, items: newItems };
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter((_, i) => i !== action.payload) };
    case 'INITIALIZE_ITEMS':
      return { ...state, items: action.payload };
    case 'RESET':
      return { notes: '', items: [] };
    default:
      return state;
  }
};

// Aggregate items by product and chef
const aggregateItemsByProduct = (items: ProductionItem[]): ProductionItem[] => {
  const aggregated: Record<string, ProductionItem> = {};
  items.forEach((item) => {
    const key = `${item.product}_${item.assignedTo}`;
    if (!aggregated[key]) {
      aggregated[key] = {
        product: item.product,
        quantity: 0,
        assignedTo: item.assignedTo,
      };
    }
    aggregated[key].quantity += item.quantity;
  });
  return Object.values(aggregated).filter(
    (item) => item.product && isValidObjectId(item.product) && item.assignedTo && isValidObjectId(item.assignedTo)
  );
};

// ProductionOrderForm for creating orders
export const ProductionOrderForm: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  availableProducts: AvailableProduct[];
  chefsData: Chef[];
  isChef: boolean;
  user: any;
  productDepartmentMap: Record<string, string>;
  createMutation: any;
  t: any;
  isRtl: boolean;
  socket: any;
  isConnected: boolean;
}> = ({
  isOpen,
  onClose,
  availableProducts,
  chefsData,
  isChef,
  user,
  productDepartmentMap,
  createMutation,
  t,
  isRtl,
  socket,
  isConnected,
}) => {
  const [productionForm, dispatchProductionForm] = useReducer(productionFormReducer, { notes: '', items: [{ product: '', quantity: 1, assignedTo: isChef ? user?._id || '' : '' }] });
  const [productionErrors, setProductionErrors] = useState<Record<string, string>>({});

  const productOptions = useMemo(() => {
    let filtered = availableProducts;
    if (isChef && user?.department?._id) {
      filtered = filtered.filter((p) => p.departmentId === user.department._id);
    }
    return [
      { value: '', label: t.selectProduct },
      ...filtered.map((product) => ({
        value: product.productId,
        label: `${product.productName} (${t.unit}: ${product.unit}) - ${product.departmentName}`,
      })),
    ];
  }, [availableProducts, isChef, user, t]);

  const getChefOptions = useCallback(
    (departmentId: string) => {
      const options = [
        { value: '', label: t.selectChef },
        ...chefsData
          .filter((chef) => chef.department?._id === departmentId)
          .map((chef) => ({
            value: chef._id,
            label: isRtl ? chef.user.name : chef.user.nameEn || chef.user.name,
          })),
      ];
      return options;
    },
    [chefsData, isRtl, t]
  );

  const addItemToForm = useCallback(() => {
    dispatchProductionForm({
      type: 'ADD_ITEM',
      payload: { product: '', quantity: 1, assignedTo: isChef ? user?._id || '' : '' },
    });
  }, [isChef, user]);

  const updateItemInForm = useCallback((index: number, field: keyof ProductionItem, value: string | number) => {
    if (field === 'quantity' && typeof value === 'string') {
      const numValue = parseInt(value, 10);
      if (isNaN(numValue) || numValue < 1) {
        setProductionErrors((prev) => ({
          ...prev,
          [`item_${index}_quantity`]: t.errors.invalidQuantity,
        }));
        return;
      }
      value = numValue;
    }
    dispatchProductionForm({ type: 'UPDATE_ITEM', payload: { index, field, value } });
  }, [t]);

  const handleProductChange = useCallback(
    (index: number, productId: string) => {
      if (!isValidObjectId(productId)) {
        setProductionErrors((prev) => ({
          ...prev,
          [`item_${index}_product`]: t.errors.invalidProductId,
        }));
        return;
      }
      if (productionForm.items.some((item, i) => i !== index && item.product === productId)) {
        setProductionErrors((prev) => ({
          ...prev,
          [`item_${index}_product`]: t.errors.duplicateProduct,
        }));
        return;
      }
      const deptId = productDepartmentMap[productId];
      if (isChef && deptId && deptId !== user.department._id) {
        setProductionErrors((prev) => ({
          ...prev,
          [`item_${index}_product`]: t.errors.productNotFound,
        }));
        return;
      }
      dispatchProductionForm({
        type: 'UPDATE_ITEM',
        payload: { index, field: 'product', value: productId },
      });
      dispatchProductionForm({
        type: 'UPDATE_ITEM',
        payload: { index, field: 'assignedTo', value: '' },
      });
    },
    [t, productionForm.items, isChef, user, productDepartmentMap]
  );

  const handleChefChange = useCallback(
    (index: number, chefId: string) => {
      if (!isValidObjectId(chefId)) {
        setProductionErrors((prev) => ({
          ...prev,
          [`item_${index}_assignedTo`]: t.errors.invalidChefId,
        }));
        return;
      }
      dispatchProductionForm({
        type: 'UPDATE_ITEM',
        payload: { index, field: 'assignedTo', value: chefId },
      });
    },
    [t]
  );

  const removeItemFromForm = useCallback((index: number) => {
    dispatchProductionForm({ type: 'REMOVE_ITEM', payload: index });
    setProductionErrors((prev) => {
      const newErrors = { ...prev };
      Object.keys(newErrors).forEach((key) => {
        if (key.startsWith(`item_${index}_`)) delete newErrors[key];
      });
      return newErrors;
    });
  }, []);

  const validateProductionForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (productionForm.items.length === 0) {
      errors.items = t.errors.required.replace('{field}', t.items);
    }
    productionForm.items.forEach((item, index) => {
      if (!item.product) {
        errors[`item_${index}_product`] = t.errors.required.replace('{field}', t.selectProduct);
      } else if (!isValidObjectId(item.product)) {
        errors[`item_${index}_product`] = t.errors.invalidProductId;
      }
      const deptId = productDepartmentMap[item.product];
      if (isChef && deptId && deptId !== user.department._id) {
        errors[`item_${index}_product`] = t.errors.productNotFound;
      }
      if (!isChef) {
        if (!item.assignedTo) {
          errors[`item_${index}_assignedTo`] = t.errors.required.replace('{field}', t.chef);
        } else if (!isValidObjectId(item.assignedTo)) {
          errors[`item_${index}_assignedTo`] = t.errors.invalidChefId;
        }
      }
      if (item.quantity < 1 || isNaN(item.quantity)) {
        errors[`item_${index}_quantity`] = t.errors.invalidQuantity;
      }
    });
    setProductionErrors(errors);
    return Object.keys(errors).length === 0;
  }, [productionForm, t, isChef, user, productDepartmentMap]);

  const handleSubmit = () => {
    if (!validateProductionForm()) return;
    createMutation.mutate(
      {
        productionForm,
        user,
        socket,
        isConnected,
        isRtl,
        t,
      },
      {
        onSuccess: () => {
          onClose();
          dispatchProductionForm({ type: 'RESET' });
          setProductionErrors({});
        },
      }
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isOpen ? 1 : 0 }}
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 ${
        isOpen ? '' : 'pointer-events-none'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={t.create}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: isOpen ? 1 : 0.95, y: isOpen ? 0 : 20 }}
        className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">{t.create}</h2>
          <button
            onClick={onClose}
            className="p-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors duration-200"
            aria-label={t.cancel}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t.notes}</label>
            <textarea
              value={productionForm.notes}
              onChange={(e) => dispatchProductionForm({ type: 'SET_NOTES', payload: e.target.value })}
              placeholder={t.notesPlaceholder}
              className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm resize-none"
              rows={3}
              aria-label={t.notes}
            />
            {productionErrors.form && <p className="text-red-600 text-xs mt-1">{productionErrors.form}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t.items}</label>
            {productionForm.items.map((item, index) => {
              const itemDeptId = productDepartmentMap[item.product] || '';
              const itemChefOptions = getChefOptions(itemDeptId);
              return (
                <div key={index} className="flex flex-col gap-4 mb-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <ProductDropdown
                    value={item.product}
                    onChange={(value) => handleProductChange(index, value)}
                    options={productOptions}
                    ariaLabel={`${t.items} ${index + 1}`}
                    placeholder={t.selectProduct}
                  />
                  {productionErrors[`item_${index}_product`] && (
                    <p className="text-red-600 text-xs">{productionErrors[`item_${index}_product`]}</p>
                  )}
                  {!isChef && (
                    <>
                      <ProductDropdown
                        value={item.assignedTo}
                        onChange={(value) => handleChefChange(index, value)}
                        options={itemChefOptions}
                        ariaLabel={`${t.items} ${index + 1} ${t.chef}`}
                        placeholder={t.selectChef}
                      />
                      {productionErrors[`item_${index}_assignedTo`] && (
                        <p className="text-red-600 text-xs">{productionErrors[`item_${index}_assignedTo`]}</p>
                      )}
                    </>
                  )}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t.quantity}</label>
                      <QuantityInput
                        value={item.quantity}
                        onChange={(val) => updateItemInForm(index, 'quantity', val)}
                        onIncrement={() => updateItemInForm(index, 'quantity', item.quantity + 1)}
                        onDecrement={() => updateItemInForm(index, 'quantity', Math.max(item.quantity - 1, 1))}
                      />
                      {productionErrors[`item_${index}_quantity`] && (
                        <p className="text-red-600 text-xs mt-1">{productionErrors[`item_${index}_quantity`]}</p>
                      )}
                    </div>
                    {productionForm.items.length > 1 && (
                      <button
                        onClick={() => removeItemFromForm(index)}
                        className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors duration-200 self-start sm:self-end"
                        aria-label={t.removeItem}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <button
              onClick={addItemToForm}
              className="flex items-center gap-2 text-amber-600 hover:text-amber-800 text-sm font-medium"
              aria-label={t.addItem}
            >
              <Plus className="w-4 h-4" />
              {t.addItem}
            </button>
            {productionErrors.items && <p className="text-red-600 text-xs">{productionErrors.items}</p>}
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors duration-200"
              aria-label={t.cancel}
            >
              {t.cancel}
            </button>
            <button
              onClick={handleSubmit}
              disabled={createMutation.isLoading}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
              aria-label={createMutation.isLoading ? t.submitting : t.submit}
            >
              {createMutation.isLoading ? t.submitting : t.submit}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// AssignChefsForm similar to ProductionOrderForm
export const AssignChefsForm: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  selectedOrder: FactoryOrder | null;
  chefsData: Chef[];
  productDepartmentMap: Record<string, string>;
  assignMutation: any;
  t: any;
  isRtl: boolean;
  socket: any;
  isConnected: boolean;
}> = ({
  isOpen,
  onClose,
  selectedOrder,
  chefsData,
  productDepartmentMap,
  assignMutation,
  t,
  isRtl,
  socket,
  isConnected,
}) => {
  const [assignForm, dispatchAssignForm] = useReducer(productionFormReducer, { notes: '', items: [] });
  const [assignErrors, setAssignErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (selectedOrder) {
      dispatchAssignForm({
        type: 'INITIALIZE_ITEMS',
        payload: selectedOrder.items.filter(item => !item.assignedTo).map(item => ({
          product: item.product?._id || '',
          quantity: item.quantity,
          assignedTo: '',
        })),
      });
    }
  }, [selectedOrder]);

  const getChefOptions = useCallback(
    (departmentId: string) => {
      return [
        { value: '', label: t.selectChef },
        ...chefsData.filter(chef => chef.department._id === departmentId).map(chef => ({
          value: chef._id,
          label: isRtl ? chef.user.name : chef.user.nameEn || chef.user.name,
        })),
      ];
    },
    [chefsData, isRtl, t]
  );

  const handleChefChange = useCallback(
    (index: number, chefId: string) => {
      if (!isValidObjectId(chefId)) {
        setAssignErrors((prev) => ({
          ...prev,
          [`item_${index}_assignedTo`]: t.errors.invalidChefId,
        }));
        return;
      }
      dispatchAssignForm({
        type: 'UPDATE_ITEM',
        payload: { index, field: 'assignedTo', value: chefId },
      });
    },
    [t]
  );

  const validateAssignForm = useCallback(() => {
    const errors: Record<string, string> = {};
    assignForm.items.forEach((item, index) => {
      if (!item.assignedTo) {
        errors[`item_${index}_assignedTo`] = t.errors.required.replace('{field}', t.chef);
      } else if (!isValidObjectId(item.assignedTo)) {
        errors[`item_${index}_assignedTo`] = t.errors.invalidChefId;
      }
    });
    setAssignErrors(errors);
    return Object.keys(errors).length === 0;
  }, [assignForm, t]);

  const handleSubmit = () => {
    if (!validateAssignForm() || !selectedOrder) return;
    assignMutation.mutate({
      orderId: selectedOrder._id,
      assignForm,
      socket,
      isConnected,
      isRtl,
      t,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isOpen ? 1 : 0 }}
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 ${
        isOpen ? '' : 'pointer-events-none'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={t.assign}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: isOpen ? 1 : 0.95, y: isOpen ? 0 : 20 }}
        className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">{t.assign}</h2>
          <button
            onClick={onClose}
            className="p-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors duration-200"
            aria-label={t.cancel}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          {selectedOrder && selectedOrder.items.filter(item => !item.assignedTo).map((orderItem, index) => {
            const deptId = productDepartmentMap[orderItem.product?._id || ''] || '';
            const chefOptions = getChefOptions(deptId);
            return (
              <div key={index} className="flex flex-col gap-4 mb-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-sm text-gray-700">{orderItem.product?.displayName} ({orderItem.quantity} {orderItem.product?.displayUnit})</p>
                <ProductDropdown
                  value={assignForm.items[index]?.assignedTo || ''}
                  onChange={(value) => handleChefChange(index, value)}
                  options={chefOptions}
                  ariaLabel={t.selectChef}
                  placeholder={t.selectChef}
                />
                {assignErrors[`item_${index}_assignedTo`] && (
                  <p className="text-red-600 text-xs">{assignErrors[`item_${index}_assignedTo`]}</p>
                )}
              </div>
            );
          })}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors duration-200"
              aria-label={t.cancel}
            >
              {t.cancel}
            </button>
            <button
              onClick={handleSubmit}
              disabled={assignMutation.isLoading}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
              aria-label={assignMutation.isLoading ? t.submitting : t.submit}
            >
              {assignMutation.isLoading ? t.submitting : t.submit}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Main component
export const InventoryOrders: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<OrderStatus | ''>('');
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<FactoryOrder | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [availableProducts, setAvailableProducts] = useState<AvailableProduct[]>([]);
  const ITEMS_PER_PAGE = 10;
  const isChef = user?.role === 'chef';

  const [searchInput, setSearchInput, debouncedSearchQuery] = useDebouncedState<string>('', 300);

  const { data: ordersData, isLoading: ordersLoading } = useQuery<FactoryOrder[], Error>({
    queryKey: ['factoryOrders', debouncedSearchQuery, filterStatus, filterDepartment, currentPage, language],
    queryFn: async () => {
      const params = {
        search: debouncedSearchQuery || undefined,
        status: filterStatus || undefined,
        department: filterDepartment || undefined,
        lang: language,
      };
      const response = await factoryOrdersAPI.getAll(params);
      const data = Array.isArray(response) ? response : response?.data || [];
      return data;
    },
    enabled: !!user?.role && ['production', 'admin', 'chef'].includes(user.role),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    select: (data) => data.map((order) => ({
      ...order,
      items: order.items.map((item) => ({
        ...item,
        product: item.product ? {
          ...item.product,
          displayName: isRtl ? item.product.name : item.product.nameEn || item.product.name,
          displayUnit: isRtl ? item.product.unit : item.product.unitEn || item.product.unit,
          department: item.product.department ? {
            ...item.product.department,
            displayName: isRtl ? item.product.department.name : item.product.department.nameEn || item.product.department.name,
          } : null,
        } : null,
        assignedTo: item.assignedTo ? {
          ...item.assignedTo,
          displayName: isRtl ? item.assignedTo.name : item.assignedTo.nameEn || item.assignedTo.name,
        } : null,
      })),
      createdBy: order.createdBy ? {
        ...order.createdBy,
        displayName: isRtl ? order.createdBy.name : order.createdBy.nameEn || order.createdBy.name,
      } : null,
      status: order.status,
    })),
    onError: (err) => toast.error(t.errors.fetchOrders, { position: isRtl ? 'top-right' : 'top-left' }),
  });

  const { data: chefsData, isLoading: chefsLoading } = useQuery<Chef[], Error>({
    queryKey: ['chefs', language],
    queryFn: async () => {
      const response = await chefsAPI.getAll();
      const data = Array.isArray(response) ? response : response?.data?.chefs || [];
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await productsAPI.getAll({ limit: 0 });
        const products = response.data || [];
        let filteredProducts = products.map((product: any) => ({
          productId: product._id,
          productName: isRtl ? product.name : product.nameEn || product.name,
          unit: isRtl ? (product.unit || t.unit) : product.unitEn || product.unit || 'N/A',
          departmentName: isRtl ? product.department?.name || t.allDepartments : product.department?.nameEn || product.department?.name || 'Unknown',
          departmentId: product.department?._id || '',
        }));
        if (isChef && user?.department?._id) {
          filteredProducts = filteredProducts.filter((p) => p.departmentId === user.department._id);
        }
        setAvailableProducts(filteredProducts);
      } catch (err) {
        toast.error(t.errors.fetchInventory, { position: isRtl ? 'top-right' : 'top-left' });
      }
    };
    fetchProducts();
  }, [isRtl, t, isChef, user]);

  const productDepartmentMap = useMemo(() => {
    const map: Record<string, string> = {};
    availableProducts.forEach((prod) => {
      if (prod.productId && prod.departmentId) {
        map[prod.productId] = prod.departmentId;
      }
    });
    return map;
  }, [availableProducts]);

  const departmentOptions = useMemo(() => {
    const depts = new Set<string>();
    const deptMap: Record<string, { _id: string; name: string }> = {};
    ordersData?.forEach((order) => {
      order.items.forEach((item) => {
        if (item.product?.department?._id) {
          const deptKey = item.product.department._id;
          if (!deptMap[deptKey]) {
            deptMap[deptKey] = {
              _id: deptKey,
              name: item.product.department.displayName,
            };
            depts.add(deptKey);
          }
        }
      });
    });
    const uniqueDepts = Array.from(depts).map((deptId) => deptMap[deptId]);
    return [
      { value: '', label: t.allDepartments },
      ...uniqueDepts.map((dept) => ({
        value: dept._id,
        label: dept.name || t.allDepartments,
      })),
    ];
  }, [ordersData, t]);

  const statusOptions = useMemo(
    () => [
      { value: '', label: t.allStatuses },
      { value: OrderStatus.REQUESTED, label: t.requested },
      { value: OrderStatus.PENDING, label: t.pending },
      { value: OrderStatus.APPROVED, label: t.approved },
      { value: OrderStatus.IN_PRODUCTION, label: t.in_production },
      { value: OrderStatus.COMPLETED, label: t.completed },
      { value: OrderStatus.STORED, label: t.stored },
      { value: OrderStatus.CANCELLED, label: t.cancelled },
    ],
    [t]
  );

  const filteredOrders = useMemo(() => ordersData || [], [ordersData]);
  const paginatedOrders = useMemo(
    () => filteredOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredOrders, currentPage]
  );

  const createMutation = useMutation({
    mutationFn: async ({ productionForm }: { productionForm: ProductionFormState }) => {
      const aggregatedItems = aggregateItemsByProduct(productionForm.items);
      const data = {
        orderNumber: `PROD-${Date.now()}`,
        items: aggregatedItems.map((item) => ({
          product: item.product,
          quantity: item.quantity,
          assignedTo: item.assignedTo,
        })),
        notes: productionForm.notes,
      };
      const response = await factoryOrdersAPI.create(data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factoryOrders'] });
      toast.success(t.notifications.orderCreated);
    },
    onError: (err: any) => toast.error(t.errors.createOrder),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: OrderStatus }) => {
      await factoryOrdersAPI.updateStatus(orderId, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factoryOrders'] });
      toast.success(t.notifications.statusUpdated);
    },
    onError: (err: any) => toast.error(t.errors.updateStatus),
  });

  const completeItemMutation = useMutation({
    mutationFn: async ({ orderId, itemId }: { orderId: string; itemId: string }) => {
      await factoryOrdersAPI.updateItemStatus(orderId, itemId, { status: 'completed' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factoryOrders'] });
      toast.success(t.notifications.itemCompleted);
    },
    onError: (err: any) => toast.error(t.errors.completeItem),
  });

  const assignMutation = useMutation({
    mutationFn: async ({ orderId, assignForm }: { orderId: string; assignForm: ProductionFormState }) => {
      const data = {
        items: assignForm.items.map((item) => ({
          itemId: item.product, // adjust based on actual itemId
          assignedTo: item.assignedTo,
        })),
      };
      await factoryOrdersAPI.assignChefs(orderId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factoryOrders'] });
      toast.success(t.notifications.chefsAssigned);
    },
    onError: (err: any) => toast.error(t.errors.assignChefs),
  });

  const storeMutation = useMutation({
    mutationFn: async ({ orderId }: { orderId: string }) => {
      await factoryOrdersAPI.updateStatus(orderId, { status: 'stored' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factoryOrders'] });
      toast.success(t.notifications.orderStored);
    },
    onError: (err: any) => toast.error(t.errors.storeOrder),
  });

  return (
    <div className="mx-auto px-4 py-4 max-w-7xl">
      <div className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center gap-3">
          <Package className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
            <p className="text-gray-600 text-sm">{t.description}</p>
          </div>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2"
          aria-label={t.create}
        >
          <Plus className="w-4 h-4" />
          {t.create}
        </button>
      </div>
      <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="w-full lg:w-1/2">
            <ProductSearchInput
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t.search}
              ariaLabel={t.search}
            />
          </div>
          <div className="w-full lg:w-1/2 flex flex-col sm:flex-row gap-4">
            <ProductDropdown
              value={filterStatus}
              onChange={setFilterStatus}
              options={statusOptions}
              ariaLabel={t.filterByStatus}
            />
            <ProductDropdown
              value={filterDepartment}
              onChange={setFilterDepartment}
              options={departmentOptions}
              ariaLabel={t.filterByDepartment}
            />
          </div>
        </div>
      </div>
      {ordersLoading ? 'Loading...' : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedOrders.map((order) => (
            <motion.div key={order._id}>
              <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold">{order.orderNumber}</h3>
                <p>{t.status}: {order.status}</p>
                <ul>
                  {order.items.map((item) => (
                    <li key={item._id}>
                      {item.product?.displayName} ({item.quantity} {item.product?.displayUnit})
                      {item.assignedTo && ` - ${t.chef}: ${item.assignedTo.displayName}`}
                      <p>{item.status}</p>
                      {item.status === 'assigned' && isChef && item.assignedTo?._id === user?._id && (
                        <button onClick={() => completeItemMutation.mutate({ orderId: order._id, itemId: item._id })}>
                          {t.complete}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {order.status === OrderStatus.COMPLETED && (
                  <button onClick={() => storeMutation.mutate({ orderId: order._id })}>
                    {t.confirmStorage}
                  </button>
                )}
                <button onClick={() => {
                  setSelectedOrder(order);
                  setIsAssignModalOpen(true);
                }}>
                  {t.assign}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      <ProductionOrderForm
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        availableProducts={availableProducts}
        chefsData={chefsData || []}
        isChef={isChef}
        user={user}
        productDepartmentMap={productDepartmentMap}
        createProductionMutation={createMutation}
        t={t}
        isRtl={isRtl}
        socket={socket}
        isConnected={isConnected}
      />
      <AssignChefsForm
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        selectedOrder={selectedOrder}
        chefsData={chefsData || []}
        productDepartmentMap={productDepartmentMap}
        assignMutation={assignMutation}
        t={t}
        isRtl={isRtl}
        socket={socket}
        isConnected={isConnected}
      />
    </div>
  );
};

export default InventoryOrders;