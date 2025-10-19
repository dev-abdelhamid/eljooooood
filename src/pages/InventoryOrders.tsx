import React, { useState, useMemo, useCallback, useEffect, useReducer } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Plus, X, Eye, Edit, AlertCircle, MinusCircle } from 'lucide-react';
import { factoryOrdersAPI, factoryInventoryAPI, chefsAPI, isValidObjectId } from '../services/api';
import { ProductSearchInput, ProductDropdown } from './NewOrder';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Button } from '../components/UI/Button';
import { Select } from '../components/UI/Select';

// Enums and Interfaces
enum InventoryStatus {
  LOW = 'low',
  NORMAL = 'normal',
  FULL = 'full',
}

interface FactoryInventoryItem {
  _id: string;
  product: {
    _id: string;
    name: string;
    nameEn: string;
    code: string;
    unit: string;
    unitEn: string;
    department: { _id: string; name: string; nameEn: string; displayName: string } | null;
    displayName: string;
    displayUnit: string;
  } | null;
  currentStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  status: InventoryStatus;
  inProduction: boolean;
}

interface Chef {
  _id: string;
  user: {
    name: string;
    nameEn?: string;
    username: string;
  };
  department: string;
}

interface ProductionItem {
  product: string;
  quantity: number;
  assignedTo?: string;
}

interface ProductionFormState {
  notes: string;
  items: ProductionItem[];
}

interface ProductHistoryEntry {
  _id: string;
  date: string;
  type: 'produced_stock' | 'adjustment';
  quantity: number;
  reference: string;
}

interface EditForm {
  minStockLevel: number;
  maxStockLevel: number;
}

interface AvailableProduct {
  productId: string;
  productName: string;
  unit: string;
  departmentId: string;
  departmentName: string;
}

interface FactoryOrder {
  _id: string;
  orderNumber: string;
  items: { productId: string; quantity: number; status: string; assignedTo?: string }[];
  status: 'pending' | 'in_production' | 'completed' | 'cancelled';
}

// Translations
const translations = {
  ar: {
    title: 'إدارة مخزون المصنع',
    description: 'إدارة مخزون المصنع وطلبات الإنتاج',
    noItems: 'لا توجد عناصر في مخزون المصنع',
    noHistory: 'لا يوجد سجل لهذا المنتج',
    stock: 'المخزون الحالي',
    minStock: 'الحد الأدنى للمخزون',
    maxStock: 'الحد الأقصى للمخزون',
    unit: 'الوحدة',
    lowStock: 'مخزون منخفض',
    normal: 'عادي',
    full: 'مخزون ممتلئ',
    create: 'إنشاء طلب إنتاج',
    viewDetails: 'عرض التفاصيل',
    editStockLimits: 'تعديل حدود المخزون',
    search: 'البحث عن المنتجات...',
    selectProduct: 'اختر منتج',
    selectChef: 'اختر شيف',
    filterByStatus: 'تصفية حسب الحالة',
    filterByDepartment: 'تصفية حسب القسم',
    allStatuses: 'جميع الحالات',
    allDepartments: 'جميع الأقسام',
    notes: 'ملاحظات',
    notesPlaceholder: 'أدخل ملاحظات إضافية (اختياري)',
    items: 'العناصر',
    addItem: 'إضافة عنصر',
    remove: 'إزالة',
    submit: 'إرسال',
    submitting: 'جارٍ الإرسال...',
    cancel: 'إلغاء',
    save: 'حفظ',
    saving: 'جاري الحفظ...',
    productDetails: 'تفاصيل المنتج',
    date: 'التاريخ',
    type: 'النوع',
    quantity: 'الكمية',
    reference: 'المرجع',
    produced_stock: 'إنتاج مخزون',
    adjustment: 'تعديل',
    inProduction: 'في الإنتاج',
    availableProducts: 'المنتجات المتوفرة',
    errors: {
      fetchInventory: 'خطأ في جلب بيانات مخزون المصنع',
      fetchChefs: 'خطأ في جلب بيانات الشيفات',
      createProduction: 'خطأ في إنشاء طلب الإنتاج',
      updateInventory: 'خطأ في تحديث المخزون',
      invalidForm: 'البيانات المدخلة غير صالحة',
      required: 'حقل {field} مطلوب',
      nonNegative: 'يجب أن يكون {field} غير سالب',
      maxGreaterMin: 'الحد الأقصى للمخزون يجب أن يكون أكبر من الحد الأدنى',
      invalidQuantityMax: 'الكمية يجب أن تكون أكبر من 0',
      noItemSelected: 'لم يتم اختيار عنصر',
      invalidProductId: 'معرف المنتج غير صالح',
      productNotFound: 'المنتج غير موجود',
      tooManyRequests: 'طلبات كثيرة جدًا، حاول مرة أخرى لاحقًا',
      duplicateProduct: 'لا يمكن إضافة نفس المنتج أكثر من مرة',
      noChefSelected: 'لم يتم اختيار شيف',
    },
    notifications: {
      productionCreated: 'تم إنشاء طلب الإنتاج بنجاح',
      inventoryUpdated: 'تم تحديث المخزون بنجاح',
      taskAssigned: 'تم تعيين مهمة إنتاج جديدة',
      orderCompleted: 'تم إكمال طلب الإنتاج',
    },
  },
  en: {
    title: 'Factory Inventory Management',
    description: 'Manage factory inventory and production orders',
    noItems: 'No items found in factory inventory',
    noHistory: 'No history available for this product',
    stock: 'Current Stock',
    minStock: 'Minimum Stock',
    maxStock: 'Maximum Stock',
    unit: 'Unit',
    lowStock: 'Low Stock',
    normal: 'Normal',
    full: 'Full Stock',
    create: 'Create Production Order',
    viewDetails: 'View Details',
    editStockLimits: 'Edit Stock Limits',
    search: 'Search products...',
    selectProduct: 'Select Product',
    selectChef: 'Select Chef',
    filterByStatus: 'Filter by Status',
    filterByDepartment: 'Filter by Department',
    allStatuses: 'All Statuses',
    allDepartments: 'All Departments',
    notes: 'Notes',
    notesPlaceholder: 'Enter additional notes (optional)',
    items: 'Items',
    addItem: 'Add Item',
    remove: 'Remove',
    submit: 'Submit',
    submitting: 'Submitting...',
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving...',
    productDetails: 'Product Details',
    date: 'Date',
    type: 'Type',
    quantity: 'Quantity',
    reference: 'Reference',
    produced_stock: 'Produced Stock',
    adjustment: 'Adjustment',
    inProduction: 'In Production',
    availableProducts: 'Available Products',
    errors: {
      fetchInventory: 'Error fetching factory inventory data',
      fetchChefs: 'Error fetching chefs data',
      createProduction: 'Error creating production order',
      updateInventory: 'Error updating inventory',
      invalidForm: 'Invalid form data',
      required: '{field} is required',
      nonNegative: '{field} must be non-negative',
      maxGreaterMin: 'Maximum stock must be greater than minimum stock',
      invalidQuantityMax: 'Quantity must be greater than 0',
      noItemSelected: 'No item selected',
      invalidProductId: 'Invalid product ID',
      productNotFound: 'Product not found',
      tooManyRequests: 'Too many requests, please try again later',
      duplicateProduct: 'Cannot add the same product multiple times',
      noChefSelected: 'No chef selected',
    },
    notifications: {
      productionCreated: 'Production order created successfully',
      inventoryUpdated: 'Inventory updated successfully',
      taskAssigned: 'New production task assigned',
      orderCompleted: 'Production order completed',
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
    onChange(isNaN(num) || num < 1 ? '1' : val);
  };
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        onClick={onDecrement}
        disabled={value <= 1}
        className="w-8 h-8 rounded-full disabled:opacity-50"
        aria-label={isRtl ? 'تقليل الكمية' : 'Decrease quantity'}
      >
        <MinusCircle className="w-4 h-4" />
      </Button>
      <input
        type="number"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        min={1}
        className="w-12 h-8 text-center border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm"
        style={{ appearance: 'none', MozAppearance: 'textfield' }}
        aria-label={t.quantity}
      />
      <Button
        variant="primary"
        onClick={onIncrement}
        className="w-8 h-8 bg-amber-600 hover:bg-amber-700 rounded-full"
        aria-label={isRtl ? 'زيادة الكمية' : 'Increase quantity'}
      >
        <Plus className="w-4 h-4 text-white" />
      </Button>
    </div>
  );
};

// InventoryCard Component
const InventoryCard = ({
  item,
  onOpenProductionModal,
  onOpenEditModal,
  onOpenDetailsModal,
  isRtl,
  t,
}: {
  item: FactoryInventoryItem;
  onOpenProductionModal: (item: FactoryInventoryItem) => void;
  onOpenEditModal: (item: FactoryInventoryItem) => void;
  onOpenDetailsModal: (item: FactoryInventoryItem) => void;
  isRtl: boolean;
  t: typeof translations['ar'] | typeof translations['en'];
}) => {
  if (!item.product) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="p-4 bg-white rounded-lg shadow-sm hover:shadow-md border border-gray-100 hover:border-amber-200 transition-all duration-200"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-gray-900 text-sm truncate">{item.product.displayName}</h3>
          <p className="text-xs text-gray-500">{item.product.code}</p>
        </div>
        <p className="text-xs text-amber-600">
          {t.filterByDepartment}: {item.product.department?.displayName || 'N/A'}
        </p>
        <p className="text-xs text-gray-600">{t.stock}: {item.currentStock}</p>
        <p className="text-xs text-gray-600">{t.minStock}: {item.minStockLevel}</p>
        <p className="text-xs text-gray-600">{t.maxStock}: {item.maxStockLevel}</p>
        <p className="text-xs text-gray-600">{t.unit}: {item.product.displayUnit}</p>
        <p
          className={`text-xs font-medium ${
            item.status === InventoryStatus.LOW ? 'text-red-600' :
            item.status === InventoryStatus.FULL ? 'text-yellow-600' : 'text-green-600'
          }`}
        >
          {item.status === InventoryStatus.LOW ? t.lowStock :
           item.status === InventoryStatus.FULL ? t.full : t.normal}
        </p>
        {item.inProduction && (
          <p className="text-xs text-blue-600 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            {t.inProduction}
          </p>
        )}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button
          variant="secondary"
          onClick={() => onOpenDetailsModal(item)}
          className="p-1.5 text-green-600 hover:text-green-800"
          aria-label={t.viewDetails}
        >
          <Eye className="w-3 h-3" />
        </Button>
        <Button
          variant="secondary"
          onClick={() => onOpenEditModal(item)}
          className="p-1.5 text-blue-600 hover:text-blue-800"
          aria-label={t.editStockLimits}
        >
          <Edit className="w-3 h-3" />
        </Button>
        <Button
          variant="secondary"
          onClick={() => onOpenProductionModal(item)}
          className="p-1.5 text-amber-600 hover:text-amber-800"
          aria-label={t.create}
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </motion.div>
  );
};

// ProductionModal Component
const ProductionModal = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  errors,
  setErrors,
  products,
  chefs,
  isSubmitting,
  isRtl,
  t,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  formData: ProductionFormState;
  setFormData: React.Dispatch<ProductionFormAction>;
  errors: Record<string, string>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  products: AvailableProduct[];
  chefs: Chef[];
  isSubmitting: boolean;
  isRtl: boolean;
  t: typeof translations['ar'] | typeof translations['en'];
}) => {
  const productOptions = useMemo(
    () => [
      { value: '', label: t.selectProduct },
      ...products.map((product) => ({
        value: product.productId,
        label: `${product.productName} (${t.unit}: ${product.unit}) - ${product.departmentName}`,
      })),
    ],
    [products, t]
  );

  const handleProductChange = (index: number, productId: string) => {
    if (!isValidObjectId(productId)) {
      setErrors((prev) => ({ ...prev, [`item_${index}_product`]: t.errors.invalidProductId }));
      return;
    }
    if (formData.items.some((item, i) => i !== index && item.product === productId)) {
      setErrors((prev) => ({ ...prev, [`item_${index}_product`]: t.errors.duplicateProduct }));
      return;
    }
    setFormData({ type: 'UPDATE_ITEM', payload: { index, field: 'product', value: productId } });
    setErrors((prev) => ({ ...prev, [`item_${index}_product`]: '' }));
  };

  const handleQuantityChange = (index: number, value: string) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 1) {
      setErrors((prev) => ({ ...prev, [`item_${index}_quantity`]: t.errors.invalidQuantityMax }));
      return;
    }
    setFormData({ type: 'UPDATE_ITEM', payload: { index, field: 'quantity', value: numValue } });
    setErrors((prev) => ({ ...prev, [`item_${index}_quantity`]: '' }));
  };

  const handleChefChange = (index: number, chefId: string) => {
    if (!isValidObjectId(chefId)) {
      setErrors((prev) => ({ ...prev, [`item_${index}_assignedTo`]: t.errors.noChefSelected }));
      return;
    }
    setFormData({ type: 'UPDATE_ITEM', payload: { index, field: 'assignedTo', value: chefId } });
    setErrors((prev) => ({ ...prev, [`item_${index}_assignedTo`]: '' }));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isOpen ? 1 : 0 }}
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 ${isOpen ? '' : 'pointer-events-none'}`}
      role="dialog"
      aria-modal="true"
      aria-label={t.create}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: isOpen ? 1 : 0.95, y: isOpen ? 0 : 20 }}
        className="bg-white p-5 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold text-gray-900">{t.create}</h2>
          <Button
            variant="secondary"
            onClick={onClose}
            className="p-1.5"
            aria-label={t.cancel}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t.notes}</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ type: 'SET_NOTES', payload: e.target.value })}
              placeholder={t.notesPlaceholder}
              className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm resize-none"
              rows={3}
              aria-label={t.notes}
            />
            {errors.form && <p className="text-red-600 text-xs mt-1">{errors.form}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t.items}</label>
            {formData.items.map((item, index) => {
              const selectedProduct = products.find((p) => p.productId === item.product);
              const itemChefOptions = [
                { value: '', label: t.selectChef },
                ...chefs
                  .filter((chef) => chef.department === selectedProduct?.departmentId)
                  .map((chef) => ({
                    value: chef._id,
                    label: isRtl ? chef.user.name : chef.user.nameEn || chef.user.name,
                  })),
              ];
              return (
                <div key={index} className="flex flex-col gap-3 mb-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <Select
                    value={item.product}
                    options={productOptions}
                    onChange={(value) => handleProductChange(index, value)}
                    placeholder={t.selectProduct}
                    ariaLabel={`${t.items} ${index + 1}`}
                    className="w-full text-sm"
                  />
                  {errors[`item_${index}_product`] && (
                    <p className="text-red-600 text-xs">{errors[`item_${index}_product`]}</p>
                  )}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-700 mb-1">{t.quantity}</label>
                      <QuantityInput
                        value={item.quantity}
                        onChange={(val) => handleQuantityChange(index, val)}
                        onIncrement={() =>
                          setFormData({
                            type: 'UPDATE_ITEM',
                            payload: { index, field: 'quantity', value: item.quantity + 1 },
                          })
                        }
                        onDecrement={() =>
                          setFormData({
                            type: 'UPDATE_ITEM',
                            payload: { index, field: 'quantity', value: Math.max(item.quantity - 1, 1) },
                          })
                        }
                      />
                      {errors[`item_${index}_quantity`] && (
                        <p className="text-red-600 text-xs mt-1">{errors[`item_${index}_quantity`]}</p>
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-700 mb-1">{t.selectChef}</label>
                      <Select
                        value={item.assignedTo || ''}
                        options={itemChefOptions}
                        onChange={(value) => handleChefChange(index, value)}
                        placeholder={t.selectChef}
                        ariaLabel={`${t.selectChef} ${index + 1}`}
                        className="w-full text-sm"
                      />
                      {errors[`item_${index}_assignedTo`] && (
                        <p className="text-red-600 text-xs mt-1">{errors[`item_${index}_assignedTo`]}</p>
                      )}
                    </div>
                  </div>
                  {formData.items.length > 1 && (
                    <Button
                      variant="secondary"
                      onClick={() => setFormData({ type: 'REMOVE_ITEM', payload: index })}
                      className="text-red-600 hover:text-red-800 flex items-center gap-1 text-xs"
                      aria-label={t.remove}
                    >
                      <MinusCircle className="w-3 h-3" />
                      {t.remove}
                    </Button>
                  )}
                </div>
              );
            })}
            <Button
              variant="secondary"
              onClick={() => setFormData({ type: 'ADD_ITEM', payload: { product: '', quantity: 1, assignedTo: '' } })}
              className="flex items-center gap-1 text-amber-600 hover:text-amber-800 text-xs"
              aria-label={t.addItem}
            >
              <Plus className="w-3 h-3" />
              {t.addItem}
            </Button>
            {errors.items && <p className="text-red-600 text-xs">{errors.items}</p>}
          </div>
          <div className={`flex gap-2 ${isRtl ? 'justify-start' : 'justify-end'}`}>
            <Button variant="secondary" onClick={onClose} className="px-3 py-1.5 text-sm" aria-label={t.cancel}>
              {t.cancel}
            </Button>
            <Button
              variant="primary"
              onClick={onSubmit}
              disabled={isSubmitting}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm"
              aria-label={isSubmitting ? t.submitting : t.submit}
            >
              {isSubmitting ? t.submitting : t.submit}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// EditModal Component
const EditModal = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  errors,
  isSubmitting,
  isRtl,
  t,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  formData: EditForm;
  setFormData: React.Dispatch<React.SetStateAction<EditForm>>;
  errors: Record<string, string>;
  isSubmitting: boolean;
  isRtl: boolean;
  t: typeof translations['ar'] | typeof translations['en'];
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isOpen ? 1 : 0 }}
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 ${isOpen ? '' : 'pointer-events-none'}`}
      role="dialog"
      aria-modal="true"
      aria-label={t.editStockLimits}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: isOpen ? 1 : 0.95, y: isOpen ? 0 : 20 }}
        className="bg-white p-5 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold text-gray-900">{t.editStockLimits}</h2>
          <Button variant="secondary" onClick={onClose} className="p-1.5" aria-label={t.cancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t.minStock}</label>
            <input
              type="number"
              value={formData.minStockLevel}
              onChange={(e) => setFormData({ ...formData, minStockLevel: parseInt(e.target.value) || 0 })}
              min={0}
              className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm"
              aria-label={t.minStock}
            />
            {errors.minStockLevel && <p className="text-red-600 text-xs mt-1">{errors.minStockLevel}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t.maxStock}</label>
            <input
              type="number"
              value={formData.maxStockLevel}
              onChange={(e) => setFormData({ ...formData, maxStockLevel: parseInt(e.target.value) || 0 })}
              min={0}
              className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm"
              aria-label={t.maxStock}
            />
            {errors.maxStockLevel && <p className="text-red-600 text-xs mt-1">{errors.maxStockLevel}</p>}
          </div>
          {errors.form && <p className="text-red-600 text-xs">{errors.form}</p>}
          <div className={`flex gap-2 ${isRtl ? 'justify-start' : 'justify-end'}`}>
            <Button variant="secondary" onClick={onClose} className="px-3 py-1.5 text-sm" aria-label={t.cancel}>
              {t.cancel}
            </Button>
            <Button
              variant="primary"
              onClick={onSubmit}
              disabled={isSubmitting}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm"
              aria-label={isSubmitting ? t.saving : t.save}
            >
              {isSubmitting ? t.saving : t.save}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// DetailsModal Component
const DetailsModal = ({
  isOpen,
  onClose,
  history,
  isLoading,
  isRtl,
  t,
}: {
  isOpen: boolean;
  onClose: () => void;
  history: ProductHistoryEntry[];
  isLoading: boolean;
  isRtl: boolean;
  t: typeof translations['ar'] | typeof translations['en'];
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isOpen ? 1 : 0 }}
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 ${isOpen ? '' : 'pointer-events-none'}`}
      role="dialog"
      aria-modal="true"
      aria-label={t.productDetails}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: isOpen ? 1 : 0.95, y: isOpen ? 0 : 20 }}
        className="bg-white p-5 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold text-gray-900">{t.productDetails}</h2>
          <Button variant="secondary" onClick={onClose} className="p-1.5" aria-label={t.cancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-8 bg-gray-200 rounded"></div>
            ))}
          </div>
        ) : history.length === 0 ? (
          <p className="text-gray-600 text-sm">{t.noHistory}</p>
        ) : (
          <div className="space-y-3">
            {history.map((entry) => (
              <div key={entry._id} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-xs text-gray-600">
                  {t.date}: {new Date(entry.date).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}
                </p>
                <p className="text-xs text-gray-600">
                  {t.type}: {entry.type === 'produced_stock' ? t.produced_stock : t.adjustment}
                </p>
                <p className="text-xs text-gray-600">{t.quantity}: {entry.quantity}</p>
                <p className="text-xs text-gray-600">{t.reference}: {entry.reference}</p>
              </div>
            ))}
          </div>
        )}
        <div className={`mt-3 flex ${isRtl ? 'justify-start' : 'justify-end'}`}>
          <Button variant="secondary" onClick={onClose} className="px-3 py-1.5 text-sm" aria-label={t.cancel}>
            {t.cancel}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Reducer for production form
type ProductionFormAction =
  | { type: 'SET_NOTES'; payload: string }
  | { type: 'ADD_ITEM'; payload: ProductionItem }
  | { type: 'UPDATE_ITEM'; payload: { index: number; field: keyof ProductionItem; value: string | number } }
  | { type: 'REMOVE_ITEM'; payload: number }
  | { type: 'RESET' };

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
    case 'RESET':
      return { notes: '', items: [{ product: '', quantity: 1, assignedTo: '' }] };
    default:
      return state;
  }
};

// Aggregate items by product
const aggregateItemsByProduct = (items: ProductionItem[]): ProductionItem[] => {
  const aggregated: Record<string, ProductionItem> = {};
  items.forEach((item) => {
    if (!aggregated[item.product]) {
      aggregated[item.product] = { product: item.product, quantity: 0, assignedTo: item.assignedTo };
    }
    aggregated[item.product].quantity += item.quantity;
  });
  return Object.values(aggregated).filter((item) => item.product && isValidObjectId(item.product));
};

export const FactoryInventory: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<InventoryStatus | ''>('');
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [isProductionModalOpen, setIsProductionModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FactoryInventoryItem | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [productionForm, dispatchProductionForm] = useReducer(productionFormReducer, {
    notes: '',
    items: [{ product: '', quantity: 1, assignedTo: '' }],
  });
  const [editForm, setEditForm] = useState<EditForm>({ minStockLevel: 0, maxStockLevel: 0 });
  const [productionErrors, setProductionErrors] = useState<Record<string, string>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<AvailableProduct[]>([]);
  const [searchInput, setSearchInput] = useState<string>('');
  const ITEMS_PER_PAGE = 10;

  // Custom debounce hook
  const useDebouncedState = <T,>(initialValue: T, delay: number) => {
    const [value, setValue] = useState<T>(initialValue);
    const [debouncedValue, setDebouncedValue] = useState<T>(initialValue);
    useEffect(() => {
      const handler = setTimeout(() => setDebouncedValue(value), delay);
      return () => clearTimeout(handler);
    }, [value, delay]);
    return [value, setValue, debouncedValue] as const;
  };
  const [, setSearchInputState, debouncedSearchQuery] = useDebouncedState<string>(searchInput, 300);

  // Chefs Query
  const { data: chefsData, error: chefsError } = useQuery<Chef[], Error>({
    queryKey: ['chefs', language],
    queryFn: async () => {
      const response = await chefsAPI.getAll();
      return Array.isArray(response) ? response.filter((chef): chef is Chef => !!chef && isValidObjectId(chef._id)) : [];
    },
    enabled: !!user?.role && ['production', 'admin'].includes(user.role),
    staleTime: 5 * 60 * 1000,
    onError: (err) => toast.error(err.message || t.errors.fetchChefs, { position: isRtl ? 'top-right' : 'top-left' }),
  });

  // Inventory Query
  const { data: inventoryData, isLoading: inventoryLoading, error: inventoryError } = useQuery<
    FactoryInventoryItem[],
    Error
  >({
    queryKey: ['factoryInventory', debouncedSearchQuery, filterStatus, filterDepartment, language],
    queryFn: async () => {
      const params = {
        product: debouncedSearchQuery || undefined,
        department: filterDepartment || undefined,
        stockStatus: filterStatus || undefined,
        lang: language,
      };
      const response = await factoryInventoryAPI.getAll(params);
      return Array.isArray(response) ? response : response?.data?.inventory || [];
    },
    enabled: !!user?.role && ['production', 'admin'].includes(user.role),
    staleTime: 5 * 60 * 1000,
    select: (data) =>
      data
        .filter((item): item is FactoryInventoryItem => !!item && !!item.product && isValidObjectId(item.product._id))
        .map((item) => ({
          ...item,
          product: item.product ? {
            ...item.product,
            displayName: isRtl ? item.product.name : item.product.nameEn || item.product.name,
            displayUnit: isRtl ? (item.product.unit || t.unit) : item.product.unitEn || item.product.unit || 'N/A',
            department: item.product.department ? {
              ...item.product.department,
              displayName: isRtl ? item.product.department.name : item.product.department.nameEn || item.product.department.name,
            } : null,
          } : null,
          status: item.currentStock <= item.minStockLevel ? InventoryStatus.LOW :
            item.currentStock >= item.maxStockLevel ? InventoryStatus.FULL : InventoryStatus.NORMAL,
          inProduction: factoryOrdersData?.some(
            (order) =>
              (order.status === 'pending' || order.status === 'in_production') &&
              order.items.some((i) => i.productId === item.product?._id)
          ) || false,
        })),
    onError: (err) => toast.error(err.message || t.errors.fetchInventory, { position: isRtl ? 'top-right' : 'top-left' }),
  });

  // Products Query
  const { data: productsData, isLoading: productsLoading } = useQuery<AvailableProduct[], Error>({
    queryKey: ['products', language],
    queryFn: async () => {
      const response = await factoryInventoryAPI.getAllProducts();
      const products = Array.isArray(response) ? response : response?.data || [];
      return products
        .filter((product: any) => product && product._id && isValidObjectId(product._id))
        .map((product: any) => ({
          productId: product._id,
          productName: isRtl ? product.name : product.nameEn || product.name,
          unit: isRtl ? (product.unit || t.unit) : product.unitEn || product.unit || 'N/A',
          departmentId: product.department?._id || '',
          departmentName: isRtl
            ? product.department?.name || t.allDepartments
            : product.department?.nameEn || product.department?.name || 'Unknown',
        }));
    },
    enabled: !!user?.role && ['production', 'admin'].includes(user.role),
    staleTime: 5 * 60 * 1000,
    onError: (err) => toast.error(err.message || t.errors.productNotFound, { position: isRtl ? 'top-right' : 'top-left' }),
  });

  // Factory Orders Query for inProduction flag
  const { data: factoryOrdersData } = useQuery<FactoryOrder[], Error>({
    queryKey: ['factoryOrders', language],
    queryFn: async () => {
      const response = await factoryOrdersAPI.getAll();
      return Array.isArray(response) ? response : response?.data || [];
    },
    enabled: !!user?.role && ['production', 'admin'].includes(user.role),
    staleTime: 5 * 60 * 1000,
    onError: (err) => toast.error(err.message || t.errors.fetchInventory, { position: isRtl ? 'top-right' : 'top-left' }),
  });

  // Product History Query
  const { data: productHistory, isLoading: historyLoading } = useQuery<ProductHistoryEntry[], Error>({
    queryKey: ['factoryProductHistory', selectedProductId, language],
    queryFn: async () => {
      if (!selectedProductId || !isValidObjectId(selectedProductId)) {
        throw new Error(t.errors.invalidProductId);
      }
      const response = await factoryInventoryAPI.getHistory({ productId: selectedProductId, lang: language });
      return Array.isArray(response) ? response : response?.data?.history || [];
    },
    enabled: isDetailsModalOpen && !!selectedProductId && isValidObjectId(selectedProductId),
    staleTime: 5 * 60 * 1000,
    onError: (err) => toast.error(err.message || t.errors.productNotFound, { position: isRtl ? 'top-right' : 'top-left' }),
  });

  // Set products
  useEffect(() => {
    if (productsData) {
      setProducts(productsData);
    }
  }, [productsData]);

  // Socket Events
  useEffect(() => {
    if (!socket || !user?.role || !isConnected) return;

    const handleFactoryInventoryUpdated = ({ productId }: { productId: string }) => {
      if (!isValidObjectId(productId)) return;
      queryClient.invalidateQueries({ queryKey: ['factoryInventory'] });
      if (selectedProductId === productId) {
        queryClient.invalidateQueries({ queryKey: ['factoryProductHistory'] });
      }
      toast.success(t.notifications.inventoryUpdated, { position: isRtl ? 'top-right' : 'top-left' });
      addNotification({
        _id: crypto.randomUUID(),
        type: 'success',
        message: t.notifications.inventoryUpdated,
        data: { productId, eventId: crypto.randomUUID(), isRtl },
        read: false,
        createdAt: new Date().toISOString(),
        sound: 'https://eljoodia-client.vercel.app/sounds/notification.mp3',
        vibrate: [200, 100, 200],
      });
    };

    const handleFactoryOrderCreated = ({ orderId, orderNumber, branchId }: { orderId: string; orderNumber: string; branchId?: string }) => {
      if (!isValidObjectId(orderId)) return;
      addNotification({
        _id: crypto.randomUUID(),
        type: 'success',
        message: t.notifications.productionCreated,
        data: { orderId, orderNumber, branchId, eventId: crypto.randomUUID(), isRtl },
        read: false,
        createdAt: new Date().toISOString(),
        sound: 'https://eljoodia-client.vercel.app/sounds/notification.mp3',
        vibrate: [200, 100, 200],
      });
      toast.success(t.notifications.productionCreated, { position: isRtl ? 'top-right' : 'top-left' });
      queryClient.invalidateQueries({ queryKey: ['factoryInventory'] });
      queryClient.invalidateQueries({ queryKey: ['factoryOrders'] });
    };

    const handleFactoryTaskAssigned = ({
      factoryOrderId,
      taskId,
      chefId,
      productName,
    }: {
      factoryOrderId: string;
      taskId: string;
      chefId: string;
      productName: string;
    }) => {
      if (!isValidObjectId(factoryOrderId) || !isValidObjectId(chefId)) return;
      if (user._id === chefId) {
        addNotification({
          _id: crypto.randomUUID(),
          type: 'info',
          message: t.notifications.taskAssigned,
          data: { factoryOrderId, taskId, chefId, productName, eventId: crypto.randomUUID(), isRtl },
          read: false,
          createdAt: new Date().toISOString(),
          sound: 'https://eljoodia-client.vercel.app/sounds/notification.mp3',
          vibrate: [200, 100, 200],
        });
        toast.info(t.notifications.taskAssigned, { position: isRtl ? 'top-right' : 'top-left' });
      }
    };

    const handleFactoryOrderCompleted = ({ factoryOrderId, orderNumber }: { factoryOrderId: string; orderNumber: string }) => {
      if (!isValidObjectId(factoryOrderId)) return;
      addNotification({
        _id: crypto.randomUUID(),
        type: 'success',
        message: t.notifications.orderCompleted,
        data: { factoryOrderId, orderNumber, eventId: crypto.randomUUID(), isRtl },
        read: false,
        createdAt: new Date().toISOString(),
        sound: 'https://eljoodia-client.vercel.app/sounds/notification.mp3',
        vibrate: [200, 100, 200],
      });
      toast.success(t.notifications.orderCompleted, { position: isRtl ? 'top-right' : 'top-left' });
      queryClient.invalidateQueries({ queryKey: ['factoryInventory'] });
      queryClient.invalidateQueries({ queryKey: ['factoryOrders'] });
    };

    socket.on('factoryInventoryUpdated', handleFactoryInventoryUpdated);
    socket.on('factoryOrderCreated', handleFactoryOrderCreated);
    socket.on('factoryTaskAssigned', handleFactoryTaskAssigned);
    socket.on('factoryOrderCompleted', handleFactoryOrderCompleted);

    return () => {
      socket.off('factoryInventoryUpdated', handleFactoryInventoryUpdated);
      socket.off('factoryOrderCreated', handleFactoryOrderCreated);
      socket.off('factoryTaskAssigned', handleFactoryTaskAssigned);
      socket.off('factoryOrderCompleted', handleFactoryOrderCompleted);
    };
  }, [socket, user, isConnected, queryClient, addNotification, t, isRtl, selectedProductId]);

  // Department options
  const departmentOptions = useMemo(() => {
    const deptMap = new Map<string, { _id: string; name: string }>();
    inventoryData?.forEach((item) => {
      if (item.product?.department?._id) {
        deptMap.set(item.product.department._id, {
          _id: item.product.department._id,
          name: isRtl ? item.product.department.name : item.product.department.nameEn || item.product.department.name,
        });
      }
    });
    return [
      { value: '', label: t.allDepartments },
      ...Array.from(deptMap.values()).map((dept) => ({ value: dept._id, label: dept.name || t.allDepartments })),
    ];
  }, [inventoryData, isRtl, t]);

  // Status options
  const statusOptions = useMemo(
    () => [
      { value: '', label: t.allStatuses },
      { value: InventoryStatus.LOW, label: t.lowStock },
      { value: InventoryStatus.NORMAL, label: t.normal },
      { value: InventoryStatus.FULL, label: t.full },
    ],
    [t]
  );

  // Filtered and paginated inventory
  const filteredInventory = useMemo(
    () =>
      (inventoryData || []).filter(
        (item) =>
          item.product &&
          (!filterStatus || item.status === filterStatus) &&
          (!filterDepartment || item.product.department?._id === filterDepartment) &&
          (item.product.displayName.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
            item.product.code.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
            (item.product.department?.displayName?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ?? false))
      ),
    [inventoryData, debouncedSearchQuery, filterStatus, filterDepartment]
  );

  const paginatedInventory = useMemo(
    () => filteredInventory.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredInventory, currentPage]
  );

  const totalPages = Math.ceil(filteredInventory.length / ITEMS_PER_PAGE);

  // Handlers
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    setSearchInputState(e.target.value);
    setCurrentPage(1);
  }, [setSearchInputState]);

  const handleOpenProductionModal = useCallback((item?: FactoryInventoryItem) => {
    dispatchProductionForm({ type: 'RESET' });
    if (item?.product) {
      dispatchProductionForm({
        type: 'ADD_ITEM',
        payload: { product: item.product._id, quantity: 1, assignedTo: '' },
      });
    }
    setProductionErrors({});
    setIsProductionModalOpen(true);
  }, []);

  const handleOpenEditModal = useCallback((item: FactoryInventoryItem) => {
    setSelectedItem(item);
    setEditForm({ minStockLevel: item.minStockLevel, maxStockLevel: item.maxStockLevel });
    setEditErrors({});
    setIsEditModalOpen(true);
  }, []);

  const handleOpenDetailsModal = useCallback((item: FactoryInventoryItem) => {
    if (item.product && isValidObjectId(item.product._id)) {
      setSelectedProductId(item.product._id);
      setIsDetailsModalOpen(true);
    } else {
      toast.error(t.errors.invalidProductId, { position: isRtl ? 'top-right' : 'top-left' });
    }
  }, [t, isRtl]);

  const validateProductionForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (productionForm.items.length === 0) {
      errors.items = t.errors.required.replace('{field}', t.items);
    }
    productionForm.items.forEach((item, index) => {
      if (!item.product) {
        errors[`item_${index}_product`] = t.errors.required.replace('{field}', t.items);
      } else if (!isValidObjectId(item.product)) {
        errors[`item_${index}_product`] = t.errors.invalidProductId;
      }
      if (item.quantity < 1 || isNaN(item.quantity)) {
        errors[`item_${index}_quantity`] = t.errors.invalidQuantityMax;
      }
      if (!item.assignedTo) {
        errors[`item_${index}_assignedTo`] = t.errors.noChefSelected;
      } else if (!isValidObjectId(item.assignedTo)) {
        errors[`item_${index}_assignedTo`] = t.errors.noChefSelected;
      }
    });
    setProductionErrors(errors);
    return Object.keys(errors).length === 0;
  }, [productionForm, t]);

  const validateEditForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (editForm.minStockLevel < 0) {
      errors.minStockLevel = t.errors.nonNegative.replace('{field}', t.minStock);
    }
    if (editForm.maxStockLevel < 0) {
      errors.maxStockLevel = t.errors.nonNegative.replace('{field}', t.maxStock);
    }
    if (editForm.maxStockLevel <= editForm.minStockLevel) {
      errors.maxStockLevel = t.errors.maxGreaterMin;
    }
    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  }, [editForm, t]);

  const createProductionMutation = useMutation<{ orderId: string; orderNumber: string }, Error>({
    mutationFn: async () => {
      if (!validateProductionForm()) {
        throw new Error(t.errors.invalidForm);
      }
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      const aggregatedItems = aggregateItemsByProduct(productionForm.items);
      if (aggregatedItems.length === 0) {
        throw new Error(t.errors.noItemSelected);
      }
      const data = {
        orderNumber: `PROD-${Date.now()}-${Math.random().toString(36).slice(-6)}`,
        items: aggregatedItems.map((item) => ({
          productId: item.product,
          quantity: item.quantity,
          assignedTo: item.assignedTo,
        })),
        notes: productionForm.notes || undefined,
        priority: 'medium',
      };
      const response = await factoryOrdersAPI.create(data);
      return {
        orderId: response?._id || crypto.randomUUID(),
        orderNumber: response?.orderNumber || data.orderNumber,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['factoryInventory'] });
      queryClient.invalidateQueries({ queryKey: ['factoryOrders'] });
      setIsProductionModalOpen(false);
      dispatchProductionForm({ type: 'RESET' });
      setProductionErrors({});
      toast.success(t.notifications.productionCreated, { position: isRtl ? 'top-right' : 'top-left' });
      if (socket && isConnected) {
        socket.emit('factoryOrderCreated', {
          orderId: data.orderId,
          orderNumber: data.orderNumber,
          branchId: user?.branch?._id,
          eventId: crypto.randomUUID(),
          isRtl,
        });
      }
    },
    onError: (err: any) => {
      const errorMessage =
        err.response?.status === 429 ? t.errors.tooManyRequests :
        err.response?.data?.errors?.length > 0 ? err.response.data.errors.map((e: any) => e.msg).join(', ') :
        err.message || t.errors.createProduction;
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
      setProductionErrors((prev) => ({ ...prev, form: errorMessage }));
    },
  });

  const updateInventoryMutation = useMutation<void, Error>({
    mutationFn: async () => {
      if (!validateEditForm()) {
        throw new Error(t.errors.invalidForm);
      }
      if (!selectedItem || !isValidObjectId(selectedItem._id)) {
        throw new Error(t.errors.noItemSelected);
      }
      await factoryInventoryAPI.updateStock(selectedItem._id, {
        minStockLevel: editForm.minStockLevel,
        maxStockLevel: editForm.maxStockLevel,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factoryInventory'] });
      setIsEditModalOpen(false);
      setEditForm({ minStockLevel: 0, maxStockLevel: 0 });
      setEditErrors({});
      setSelectedItem(null);
      toast.success(t.notifications.inventoryUpdated, { position: isRtl ? 'top-right' : 'top-left' });
      if (socket && isConnected) {
        socket.emit('factoryInventoryUpdated', {
          productId: selectedItem?.product?._id,
          eventId: crypto.randomUUID(),
          isRtl,
        });
      }
    },
    onError: (err) => {
      const errorMessage = err.response?.status === 429 ? t.errors.tooManyRequests : err.message || t.errors.updateInventory;
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
      setEditErrors({ form: errorMessage });
    },
  });

  const errorMessage = inventoryError?.message || chefsError?.message || '';

  return (
    <div className="mx-auto px-4 py-4 max-w-7xl">
      <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center gap-2">
          <Package className="w-6 h-6 text-amber-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{t.title}</h1>
            <p className="text-gray-600 text-xs">{t.description}</p>
          </div>
        </div>
        <Button
          variant="primary"
          onClick={() => handleOpenProductionModal()}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm"
          aria-label={t.create}
        >
          <Plus className="w-4 h-4 mr-1" />
          {t.create}
        </Button>
      </div>
      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-red-600 text-xs font-medium">{errorMessage}</span>
        </motion.div>
      )}
      <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:w-1/2">
            <ProductSearchInput
              value={searchInput}
              onChange={handleSearchChange}
              placeholder={t.search}
              ariaLabel={t.search}
              className="w-full text-sm"
            />
          </div>
          <div className="w-full sm:w-1/2 flex flex-col sm:flex-row gap-3">
            <ProductDropdown
              value={filterStatus}
              onChange={(value) => {
                setFilterStatus(value as InventoryStatus | '');
                setCurrentPage(1);
              }}
              options={statusOptions}
              ariaLabel={t.filterByStatus}
              className="w-full text-sm"
            />
            <ProductDropdown
              value={filterDepartment}
              onChange={(value) => {
                setFilterDepartment(value);
                setCurrentPage(1);
              }}
              options={departmentOptions}
              ariaLabel={t.filterByDepartment}
              className="w-full text-sm"
            />
          </div>
        </div>
        <div className="mt-3 text-center text-xs text-gray-600 font-medium">
          {isRtl ? `عدد العناصر: ${filteredInventory.length}` : `Items Count: ${filteredInventory.length}`}
        </div>
      </div>
      {inventoryLoading || productsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
              <div className="space-y-2 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-2 bg-gray-200 rounded w-1/4"></div>
                </div>
                <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                <div className="h-2 bg-gray-200 rounded w-1/3"></div>
                <div className="h-2 bg-gray-200 rounded w-1/3"></div>
                <div className="mt-3 flex justify-end">
                  <div className="h-6 bg-gray-200 rounded-lg w-20"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : paginatedInventory.length === 0 ? (
        <div className="p-6 text-center bg-white rounded-lg shadow-sm border border-gray-100">
          <Package className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 text-sm font-medium">{t.noItems}</p>
          <Button
            variant="primary"
            onClick={() => handleOpenProductionModal()}
            className="mt-3 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm"
            aria-label={t.create}
          >
            {t.create}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence>
            {paginatedInventory.map((item) => (
              <InventoryCard
                key={item._id}
                item={item}
                onOpenProductionModal={handleOpenProductionModal}
                onOpenEditModal={handleOpenEditModal}
                onOpenDetailsModal={handleOpenDetailsModal}
                isRtl={isRtl}
                t={t}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-sm"
            aria-label={isRtl ? 'الصفحة السابقة' : 'Previous page'}
          >
            {isRtl ? 'السابق' : 'Previous'}
          </Button>
          <span className="text-gray-700 text-xs font-medium">
            {isRtl ? `الصفحة ${currentPage} من ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
          </span>
          <Button
            variant="secondary"
            onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-sm"
            aria-label={isRtl ? 'الصفحة التالية' : 'Next page'}
          >
            {isRtl ? 'التالي' : 'Next'}
          </Button>
        </div>
      )}
      <ProductionModal
        isOpen={isProductionModalOpen}
        onClose={() => {
          setIsProductionModalOpen(false);
          dispatchProductionForm({ type: 'RESET' });
          setProductionErrors({});
        }}
        onSubmit={() => createProductionMutation.mutate()}
        formData={productionForm}
        setFormData={dispatchProductionForm}
        errors={productionErrors}
        setErrors={setProductionErrors}
        products={products}
        chefs={chefsData || []}
        isSubmitting={createProductionMutation.isLoading}
        isRtl={isRtl}
        t={t}
      />
      <EditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditForm({ minStockLevel: 0, maxStockLevel: 0 });
          setEditErrors({});
          setSelectedItem(null);
        }}
        onSubmit={() => updateInventoryMutation.mutate()}
        formData={editForm}
        setFormData={setEditForm}
        errors={editErrors}
        isSubmitting={updateInventoryMutation.isLoading}
        isRtl={isRtl}
        t={t}
      />
      <DetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedProductId('');
        }}
        history={productHistory || []}
        isLoading={historyLoading}
        isRtl={isRtl}
        t={t}
      />
    </div>
  );
};

export default FactoryInventory;