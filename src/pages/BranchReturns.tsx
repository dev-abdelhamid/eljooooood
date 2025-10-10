import React, { useState, useMemo, useCallback, useEffect, useReducer } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Eye, Clock, Check, AlertCircle, MinusCircle, Plus, X } from 'lucide-react';
import { returnsAPI, inventoryAPI } from '../services/api';
import { ProductSearchInput, ProductDropdown } from './NewOrder';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

enum ReturnStatus {
  PENDING = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

enum ReturnReason {
  DAMAGED_AR = 'تالف',
  WRONG_ITEM_AR = 'منتج خاطئ',
  EXCESS_QUANTITY_AR = 'كمية زائدة',
  OTHER_AR = 'أخرى',
  DAMAGED_EN = 'Damaged',
  WRONG_ITEM_EN = 'Wrong Item',
  EXCESS_QUANTITY_EN = 'Excess Quantity',
  OTHER_EN = 'Other',
}

interface ReturnItem {
  productId: string;
  quantity: number;
  reason: string;
  reasonEn: string;
  maxQuantity: number;
  price?: number;
}

interface ReturnFormState {
  notes: string;
  items: ReturnItem[];
  orders: string[];
}

interface Return {
  _id: string;
  returnNumber: string;
  branch: { _id: string; name: string; nameEn: string; displayName: string } | null;
  items: Array<{
    itemId: string;
    product: {
      _id: string;
      name: string;
      nameEn: string;
      unit: string;
      unitEn: string;
      displayName: string;
      displayUnit: string;
      department: { name: string; nameEn: string; displayName: string } | null;
    };
    quantity: number;
    reason: string;
    reasonEn: string;
  }>;
  status: ReturnStatus;
  createdAt: string;
  notes: string;
  reviewNotes: string;
  orders: string[];
}

interface AvailableItem {
  productId: string;
  productName: string;
  available: number;
  unit: string;
  displayUnit: string;
  departmentName: string;
  stock: number;
}

const translations = {
  ar: {
    title: 'إدارة طلبات الإرجاع',
    subtitle: 'إنشاء ومتابعة طلبات الإرجاع للفرع',
    noReturns: 'لا توجد طلبات إرجاع',
    returnNumber: 'رقم الإرجاع',
    statusLabel: 'الحالة',
    date: 'التاريخ',
    itemsCount: 'عدد العناصر',
    branch: 'الفرع',
    notesLabel: 'ملاحظات',
    reviewNotes: 'ملاحظات المراجعة',
    noNotes: 'لا توجد ملاحظات',
    createReturn: 'إنشاء طلب إرجاع',
    viewReturn: 'عرض طلب الإرجاع',
    view: 'عرض',
    searchPlaceholder: 'البحث برقم الإرجاع أو الملاحظات...',
    filterStatus: 'تصفية حسب الحالة',
    allStatuses: 'جميع الحالات',
    selectProduct: 'اختر منتج',
    reason: 'سبب الإرجاع',
    selectReason: 'اختر السبب',
    damaged: 'تالف',
    wrongItem: 'منتج خاطئ',
    excessQuantity: 'كمية زائدة',
    other: 'أخرى',
    notesPlaceholder: 'أدخل ملاحظات إضافية (اختياري)',
    items: 'العناصر',
    addItem: 'إضافة عنصر',
    removeItem: 'إزالة العنصر',
    submitReturn: 'إرسال طلب الإرجاع',
    createSuccess: 'تم إنشاء طلب الإرجاع بنجاح',
    newReturnNotification: 'تم إنشاء طلب إرجاع جديد: {returnNumber}',
    quantity: 'الكمية',
    unit: 'الوحدة',
    department: 'القسم',
    product: 'المنتج',
    status: {
      pending: 'قيد الانتظار',
      approved: 'موافق عليه',
      rejected: 'مرفوض',
      all: 'جميع الحالات',
    },
    pagination: {
      previous: 'السابق',
      next: 'التالي',
      page: 'الصفحة {current} من {total}',
    },
    errors: {
      noBranch: 'لم يتم العثور على فرع',
      fetchReturns: 'خطأ في جلب طلبات الإرجاع',
      createReturn: 'خطأ في إنشاء طلب الإرجاع',
      invalidForm: 'البيانات المدخلة غير صالحة',
      required: 'حقل {field} مطلوب',
      invalidQuantityMax: 'الكمية يجب أن تكون بين 1 و{max}',
      noItemSelected: 'لم يتم اختيار عنصر',
      insufficientQuantity: 'الكمية غير كافية للمنتج في المخزون',
      productNotFound: 'المنتج غير موجود',
      invalidReasonPair: 'سبب الإرجاع وسبب الإرجاع بالإنجليزية غير متطابقين',
      writeConflict: 'تعارض في الكتابة، جاري إعادة المحاولة...',
      duplicateProduct: 'لا يمكن إضافة نفس المنتج أكثر من مرة في طلب الإرجاع',
    },
    socket: {
      connected: 'تم الاتصال بالخادم',
      returnStatusUpdated: 'تم تحديث حالة الإرجاع إلى {status}',
    },
    common: {
      cancel: 'إلغاء',
      close: 'إغلاق',
      retry: 'إعادة المحاولة',
      submitting: 'جاري الإرسال...',
    },
  },
  en: {
    title: 'Return Requests Management',
    subtitle: 'Create and track return requests for the branch',
    noReturns: 'No return requests found',
    returnNumber: 'Return Number',
    statusLabel: 'Status',
    date: 'Date',
    itemsCount: 'Items Count',
    branch: 'Branch',
    notesLabel: 'Notes',
    reviewNotes: 'Review Notes',
    noNotes: 'No notes available',
    createReturn: 'Create Return Request',
    viewReturn: 'View Return Request',
    view: 'View',
    searchPlaceholder: 'Search by return number or notes...',
    filterStatus: 'Filter by Status',
    allStatuses: 'All Statuses',
    selectProduct: 'Select Product',
    reason: 'Return Reason',
    selectReason: 'Select Reason',
    damaged: 'Damaged',
    wrongItem: 'Wrong Item',
    excessQuantity: 'Excess Quantity',
    other: 'Other',
    notesPlaceholder: 'Enter additional notes (optional)',
    items: 'Items',
    addItem: 'Add Item',
    removeItem: 'Remove Item',
    submitReturn: 'Submit Return Request',
    createSuccess: 'Return request created successfully',
    newReturnNotification: 'New return request created: {returnNumber}',
    quantity: 'Quantity',
    unit: 'Unit',
    department: 'Department',
    product: 'Product',
    status: {
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      all: 'All Statuses',
    },
    pagination: {
      previous: 'Previous',
      next: 'Next',
      page: 'Page {current} of {total}',
    },
    errors: {
      noBranch: 'No branch found',
      fetchReturns: 'Error fetching return requests',
      createReturn: 'Error creating return request',
      invalidForm: 'Invalid form data',
      required: '{field} is required',
      invalidQuantityMax: 'Quantity must be between 1 and {max}',
      noItemSelected: 'No item selected',
      insufficientQuantity: 'Insufficient quantity for the product in inventory',
      productNotFound: 'Product not found',
      invalidReasonPair: 'Return reason and English reason do not match',
      writeConflict: 'Write conflict, retrying...',
      duplicateProduct: 'Cannot add the same product multiple times in one return request',
    },
    socket: {
      connected: 'Connected to server',
      returnStatusUpdated: 'Return status updated to {status}',
    },
    common: {
      cancel: 'Cancel',
      close: 'Close',
      retry: 'Retry',
      submitting: 'Submitting...',
    },
  },
};

const QuantityInput = ({
  value,
  onChange,
  onIncrement,
  onDecrement,
  max,
}: {
  value: number;
  onChange: (val: string) => void;
  onIncrement: () => void;
  onDecrement: () => void;
  max?: number;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const handleChange = (val: string) => {
    const num = parseInt(val, 10);
    if (val === '' || isNaN(num) || num < 1) {
      onChange('1');
      return;
    }
    if (max !== undefined && num > max) {
      onChange(max.toString());
      return;
    }
    onChange(val);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onDecrement}
        className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors duration-200 flex items-center justify-center"
        aria-label={isRtl ? 'تقليل الكمية' : 'Decrease quantity'}
        disabled={value <= 1}
      >
        <MinusCircle className="w-4 h-4" />
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        max={max}
        min={1}
        className="w-12 h-8 text-center border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm"
        aria-label={isRtl ? 'الكمية' : 'Quantity'}
      />
      <button
        onClick={onIncrement}
        className="w-8 h-8 bg-amber-600 hover:bg-amber-700 rounded-full transition-colors duration-200 flex items-center justify-center"
        aria-label={isRtl ? 'زيادة الكمية' : 'Increase quantity'}
        disabled={max !== undefined && value >= max}
      >
        <Plus className="w-4 h-4 text-white" />
      </button>
    </div>
  );
};

type ReturnFormAction =
  | { type: 'SET_NOTES'; payload: string }
  | { type: 'ADD_ITEM'; payload: ReturnItem }
  | { type: 'UPDATE_ITEM'; payload: { index: number; field: keyof ReturnItem; value: string | number } }
  | { type: 'REMOVE_ITEM'; payload: number }
  | { type: 'SET_ORDERS'; payload: string[] }
  | { type: 'RESET' };

const returnFormReducer = (state: ReturnFormState, action: ReturnFormAction): ReturnFormState => {
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
    case 'SET_ORDERS':
      return { ...state, orders: action.payload };
    case 'RESET':
      return { notes: '', items: [], orders: [] };
    default:
      return state;
  }
};

const isValidObjectId = (id: string): boolean => /^[0-9a-fA-F]{24}$/.test(id);

export const BranchReturns: React.FC = () => {
  const { t: languageT, language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const { user } = useAuth();
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<ReturnStatus | ''>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  const [returnForm, dispatchReturnForm] = useReducer(returnFormReducer, { notes: '', items: [], orders: [] });
  const [returnErrors, setReturnErrors] = useState<Record<string, string>>({});
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [retryCount, setRetryCount] = useState(0);

  const RETURNS_PER_PAGE = 10;

  const useDebouncedState = <T,>(initialValue: T, delay: number) => {
    const [value, setValue] = useState<T>(initialValue);
    const [debouncedValue, setDebouncedValue] = useState<T>(initialValue);
    useEffect(() => {
      const handler = setTimeout(() => setDebouncedValue(value), delay);
      return () => clearTimeout(handler);
    }, [value, delay]);
    return [value, setValue, debouncedValue] as const;
  };

  const [searchInput, setSearchInput, debouncedSearchQuery] = useDebouncedState<string>('', 300);

  const { data: returnsData, isLoading: returnsLoading, error: returnsError, refetch: refetchReturns } = useQuery<
    { returns: Return[]; total: number },
    Error
  >({
    queryKey: ['returns', user?.branchId, filterStatus, debouncedSearchQuery, currentPage, language],
    queryFn: async () => {
      if (!user?.branchId) throw new Error(t.errors.noBranch);
      const query = {
        branch: user.branchId,
        status: filterStatus,
        search: debouncedSearchQuery,
        page: currentPage,
        limit: RETURNS_PER_PAGE,
      };
      const response = await returnsAPI.getAll(query);
      return {
        returns: response.returns.map((ret: any) => ({
          _id: ret._id,
          returnNumber: ret.returnNumber || `RET-${ret._id.slice(-6)}`,
          branch: ret.branch
            ? {
                _id: ret.branch._id,
                name: ret.branch.name,
                nameEn: ret.branch.nameEn || ret.branch.name,
                displayName: isRtl ? ret.branch.name : ret.branch.nameEn || ret.branch.name,
              }
            : null,
          items: Array.isArray(ret.items)
            ? ret.items.map((item: any) => ({
                itemId: item.itemId || item._id,
                product: {
                  _id: item.product?._id || '',
                  name: item.product?.name || t.product,
                  nameEn: item.product?.nameEn || item.product?.name || t.product,
                  unit: item.product?.unit || t.unit,
                  unitEn: item.product?.unitEn || item.product?.unit || t.unit,
                  displayName: isRtl ? item.product?.name : item.product?.nameEn || item.product?.name || t.product,
                  displayUnit: isRtl ? item.product?.unit : item.product?.unitEn || item.product?.unit || t.unit,
                  department: item.product?.department
                    ? {
                        name: item.product.department.name,
                        nameEn: item.product.department.nameEn || item.product.department.name,
                        displayName: isRtl ? item.product.department.name : item.product.department.nameEn || item.product.department.name,
                      }
                    : null,
                },
                quantity: item.quantity || 1,
                reason: item.reason || '',
                reasonEn: item.reasonEn || '',
              }))
            : [],
          status: ret.status || ReturnStatus.PENDING,
          createdAt: ret.createdAt || new Date().toISOString(),
          notes: ret.notes || '',
          reviewNotes: ret.reviewNotes || '',
          orders: ret.orders || [],
        })),
        total: response.total || 0,
      };
    },
    enabled: !!user?.branchId,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    onError: (err) => {
      toast.error(err.message || t.errors.fetchReturns, { position: isRtl ? 'top-right' : 'top-left' });
    },
  });

  const { data: inventoryData, refetch: refetchInventory } = useQuery<AvailableItem[], Error>({
    queryKey: ['inventory', user?.branchId, language],
    queryFn: async () => {
      if (!user?.branchId) return [];
      const response = await inventoryAPI.getByBranch(user.branchId);
      return response
        .filter((item: any) => item.currentStock > 0 && item.product)
        .map((item: any) => ({
          productId: item.product._id,
          productName: isRtl ? item.product.name : item.product.nameEn || item.product.name,
          available: item.currentStock,
          unit: item.product.unit || t.unit,
          displayUnit: isRtl ? item.product.unit : item.product.unitEn || item.product.unit || t.unit,
          departmentName: item.product.department
            ? (isRtl ? item.product.department.name : item.product.department.nameEn || item.product.department.name)
            : 'Unknown',
          stock: item.currentStock,
        }));
    },
    enabled: !!user?.branchId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: ordersData } = useQuery<string[], Error>({
    queryKey: ['orders', user?.branchId, returnForm.items, language],
    queryFn: async () => {
      if (!user?.branchId || !returnForm.items.length) return [];
      const productIds = returnForm.items.map((item) => item.productId).filter((id) => isValidObjectId(id));
      if (!productIds.length) return [];
      const response = await returnsAPI.getAll({
        branch: user.branchId,
        status: 'delivered',
        'items.product': { $in: productIds },
      });
      return response.orders.map((order: any) => order._id);
    },
    enabled: !!user?.branchId && returnForm.items.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (ordersData) {
      dispatchReturnForm({ type: 'SET_ORDERS', payload: ordersData });
    }
  }, [ordersData]);

  // Fetch real-time available stock before submitting
  const validateStock = useCallback(async () => {
    if (!user?.branchId || !returnForm.items.length) return true;
    const productIds = returnForm.items.map((item) => item.productId).filter((id) => isValidObjectId(id));
    if (!productIds.length) return false;
    try {
      const response = await returnsAPI.getAvailableStock(user.branchId, productIds);
      const stockMap = new Map(response.map((item: any) => [item.productId, item.available]));
      const errors: Record<string, string> = {};
      returnForm.items.forEach((item, index) => {
        const available = stockMap.get(item.productId) || 0;
        if (item.quantity > available) {
          errors[`item_${index}_quantity`] = t.errors.insufficientQuantity;
        }
        dispatchReturnForm({
          type: 'UPDATE_ITEM',
          payload: { index, field: 'maxQuantity', value: available },
        });
      });
      setReturnErrors((prev) => ({ ...prev, ...errors }));
      return Object.keys(errors).length === 0;
    } catch (err) {
      toast.error(t.errors.insufficientQuantity, { position: isRtl ? 'top-right' : 'top-left' });
      return false;
    }
  }, [returnForm.items, user?.branchId, t, isRtl]);

  useEffect(() => {
    if (!socket || !user?.branchId) return;

    const handleReturnCreated = ({ branchId, returnNumber }: { branchId: string; returnNumber: string }) => {
      if (branchId === user.branchId) {
        queryClient.invalidateQueries({ queryKey: ['returns'] });
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        toast.success(t.newReturnNotification.replace('{returnNumber}', returnNumber), {
          position: isRtl ? 'top-right' : 'top-left',
        });
      }
    };

    const handleReturnStatusUpdated = ({ branchId, status }: { branchId: string; status: string }) => {
      if (branchId === user.branchId) {
        queryClient.invalidateQueries({ queryKey: ['returns'] });
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        toast.info(t.socket.returnStatusUpdated.replace('{status}', t.status[status as keyof typeof t.status] || status), {
          position: isRtl ? 'top-right' : 'top-left',
        });
      }
    };

    socket.on('connect', () => {
      socket.emit('joinRoom', { role: user?.role, branchId: user?.branchId, userId: user?._id });
      toast.info(t.socket.connected, { position: isRtl ? 'top-right' : 'top-left' });
    });
    socket.on('returnCreated', handleReturnCreated);
    socket.on('returnStatusUpdated', handleReturnStatusUpdated);

    return () => {
      socket.off('connect');
      socket.off('returnCreated', handleReturnCreated);
      socket.off('returnStatusUpdated', handleReturnStatusUpdated);
    };
  }, [socket, user, queryClient, t, isRtl]);

  const statusOptions = useMemo(
    () => [
      { value: '', label: t.status.all },
      { value: ReturnStatus.PENDING, label: t.status.pending },
      { value: ReturnStatus.APPROVED, label: t.status.approved },
      { value: ReturnStatus.REJECTED, label: t.status.rejected },
    ],
    [t]
  );

  const reasonOptions = useMemo(
    () => [
      { value: '', label: t.selectReason, enValue: '' },
      { value: ReturnReason.DAMAGED_AR, label: t.damaged, enValue: ReturnReason.DAMAGED_EN },
      { value: ReturnReason.WRONG_ITEM_AR, label: t.wrongItem, enValue: ReturnReason.WRONG_ITEM_EN },
      { value: ReturnReason.EXCESS_QUANTITY_AR, label: t.excessQuantity, enValue: ReturnReason.EXCESS_QUANTITY_EN },
      { value: ReturnReason.OTHER_AR, label: t.other, enValue: ReturnReason.OTHER_EN },
    ],
    [t]
  );

  const productOptions = useMemo(
    () => [
      { value: '', label: t.selectProduct },
      ...availableItems
        .filter((item) => !returnForm.items.some((i) => i.productId === item.productId)) // Exclude already selected products
        .map((item) => ({
          value: item.productId,
          label: `${item.productName} (${t.quantity}: ${item.available} ${item.displayUnit})`,
        })),
    ],
    [availableItems, t, returnForm.items]
  );

  useEffect(() => {
    if (inventoryData) {
      setAvailableItems(inventoryData);
    }
  }, [inventoryData]);

  const filteredReturns = useMemo(
    () =>
      (returnsData?.returns || []).filter(
        (ret) =>
          ret.returnNumber.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
          (ret.notes || '').toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
          (ret.branch?.displayName || '').toLowerCase().includes(debouncedSearchQuery.toLowerCase())
      ),
    [returnsData, debouncedSearchQuery]
  );

  const paginatedReturns = useMemo(
    () => filteredReturns.slice((currentPage - 1) * RETURNS_PER_PAGE, currentPage * RETURNS_PER_PAGE),
    [filteredReturns, currentPage]
  );

  const totalPages = Math.ceil(filteredReturns.length / RETURNS_PER_PAGE);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    setCurrentPage(1);
  }, [setSearchInput]);

  const addItemToForm = useCallback(() => {
    dispatchReturnForm({
      type: 'ADD_ITEM',
      payload: { productId: '', quantity: 1, reason: '', reasonEn: '', maxQuantity: 0, price: 0 },
    });
  }, []);

  const updateItemInForm = useCallback(
    (index: number, field: keyof ReturnItem, value: string | number) => {
      if (field === 'quantity' && typeof value === 'string') {
        const numValue = parseInt(value);
        if (isNaN(numValue) || numValue < 1) return;
        value = numValue;
      }
      if (field === 'reason') {
        const selectedReason = reasonOptions.find((opt) => opt.value === value);
        dispatchReturnForm({
          type: 'UPDATE_ITEM',
          payload: { index, field: 'reason', value },
        });
        dispatchReturnForm({
          type: 'UPDATE_ITEM',
          payload: { index, field: 'reasonEn', value: selectedReason?.enValue || '' },
        });
      } else {
        dispatchReturnForm({ type: 'UPDATE_ITEM', payload: { index, field, value } });
      }
    },
    [reasonOptions]
  );

  const handleProductChange = useCallback(
    (index: number, productId: string) => {
      if (returnForm.items.some((item, i) => i !== index && item.productId === productId)) {
        toast.error(t.errors.duplicateProduct, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      const inventoryItem = inventoryData?.find((inv) => inv.productId === productId);
      dispatchReturnForm({
        type: 'UPDATE_ITEM',
        payload: { index, field: 'productId', value: productId },
      });
      dispatchReturnForm({
        type: 'UPDATE_ITEM',
        payload: { index, field: 'maxQuantity', value: inventoryItem?.available || 0 },
      });
      dispatchReturnForm({
        type: 'UPDATE_ITEM',
        payload: { index, field: 'quantity', value: 1 },
      });
      dispatchReturnForm({
        type: 'UPDATE_ITEM',
        payload: { index, field: 'reason', value: '' },
      });
      dispatchReturnForm({
        type: 'UPDATE_ITEM',
        payload: { index, field: 'reasonEn', value: '' },
      });
      dispatchReturnForm({
        type: 'UPDATE_ITEM',
        payload: { index, field: 'price', value: inventoryItem?.price || 0 },
      });
    },
    [inventoryData, returnForm.items, t, isRtl]
  );

  const removeItemFromForm = useCallback((index: number) => {
    dispatchReturnForm({ type: 'REMOVE_ITEM', payload: index });
  }, []);

  const validateReturnForm = useCallback(async () => {
    const errors: Record<string, string> = {};
    if (!user?.branchId) {
      errors.form = t.errors.noBranch;
    }
    if (returnForm.items.length === 0) {
      errors.items = t.errors.required.replace('{field}', t.items);
    }
    // Check for duplicate products
    const productIds = returnForm.items.map((item) => item.productId);
    const duplicates = productIds.filter((id, index) => id && productIds.indexOf(id) !== index);
    if (duplicates.length > 0) {
      errors.items = t.errors.duplicateProduct;
    }
    returnForm.items.forEach((item, index) => {
      if (!item.productId) {
        errors[`item_${index}_productId`] = t.errors.required.replace('{field}', t.product);
      } else if (!isValidObjectId(item.productId)) {
        errors[`item_${index}_productId`] = t.errors.productNotFound;
      }
      if (!item.reason) {
        errors[`item_${index}_reason`] = t.errors.required.replace('{field}', t.reason);
      }
      if (item.quantity < 1 || item.quantity > item.maxQuantity || isNaN(item.quantity)) {
        errors[`item_${index}_quantity`] = t.errors.invalidQuantityMax.replace('{max}', item.maxQuantity.toString());
      }
      const inventoryItem = inventoryData?.find((inv) => inv.productId === item.productId);
      if (!inventoryItem) {
        errors[`item_${index}_productId`] = t.errors.productNotFound;
      }
    });
    // Validate reason pairs
    returnForm.items.forEach((item, index) => {
      const reasonPair = reasonOptions.find((opt) => opt.value === item.reason);
      if (reasonPair && item.reasonEn !== reasonPair.enValue) {
        errors[`item_${index}_reason`] = t.errors.invalidReasonPair;
      }
    });
    setReturnErrors(errors);
    if (Object.keys(errors).length > 0) return false;
    // Validate stock in real-time
    return await validateStock();
  }, [returnForm, t, inventoryData, user, validateStock, reasonOptions]);

  const createReturnMutation = useMutation<{ returnId: string; returnNumber: string }, Error, void>({
    mutationFn: async () => {
      const isValid = await validateReturnForm();
      if (!isValid) throw new Error(t.errors.invalidForm);
      if (!user?.branchId) throw new Error(t.errors.noBranch);
      const data = {
        branchId: user.branchId,
        items: returnForm.items.map((item) => ({
          product: item.productId,
          quantity: item.quantity,
          reason: item.reason,
          reasonEn: item.reasonEn,
          price: item.price || 0,
        })),
        notes: returnForm.notes || undefined,
        orders: returnForm.orders || [],
      };
      const response = await returnsAPI.createReturn(data);
      return { returnId: response?.returnRequest?._id || crypto.randomUUID(), returnNumber: response?.returnRequest?.returnNumber || `RET-${response?._id.slice(-6)}` };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setIsCreateModalOpen(false);
      dispatchReturnForm({ type: 'RESET' });
      setReturnErrors({});
      setRetryCount(0);
      toast.success(t.createSuccess, { position: isRtl ? 'top-right' : 'top-left' });
      socket?.emit('returnCreated', {
        branchId: user?.branchId,
        returnId: data.returnId,
        returnNumber: data.returnNumber,
        status: 'pending_approval',
        eventId: crypto.randomUUID(),
      });
    },
    onError: (err) => {
      if (err.message.includes('conflict') && retryCount < 3) {
        setRetryCount(retryCount + 1);
        toast.info(t.errors.writeConflict, { position: isRtl ? 'top-right' : 'top-left' });
        setTimeout(() => createReturnMutation.mutate(), 2000 * (retryCount + 1));
      } else {
        toast.error(err.message || t.errors.createReturn, { position: isRtl ? 'top-right' : 'top-left' });
        setReturnErrors({ form: err.message || t.errors.createReturn });
      }
    },
  });

  const ReturnCard = useCallback(
    ({ ret }: { ret: Return }) => {
      const statusInfo = {
        [ReturnStatus.PENDING]: { color: 'bg-amber-100 text-amber-800', icon: Clock, label: t.status.pending },
        [ReturnStatus.APPROVED]: { color: 'bg-green-100 text-green-800', icon: Check, label: t.status.approved },
        [ReturnStatus.REJECTED]: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: t.status.rejected },
      }[ret.status] || { color: 'bg-gray-100 text-gray-800', icon: Clock, label: t.status.pending };
      const StatusIcon = statusInfo.icon;

      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col"
        >
          <div className="p-5 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="text-lg font-semibold text-gray-900">{t.returnNumber}: {ret.returnNumber}</h3>
                <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
                  <StatusIcon className="w-5 h-5" />
                  {statusInfo.label}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">{t.date}</p>
                  <p className="text-sm font-medium text-gray-900">{new Date(ret.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t.itemsCount}</p>
                  <p className="text-sm font-medium text-gray-900">{ret.items.length} {t.items}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {ret.items.map((item, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-md border border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{item.product.displayName}</p>
                    <p className="text-sm text-gray-600">{t.quantity}: {item.quantity} {item.product.displayUnit}</p>
                    <p className="text-sm text-gray-600">{t.reason}: {isRtl ? item.reason : item.reasonEn}</p>
                  </div>
                ))}
              </div>
              {ret.notes && (
                <div className="p-3 bg-amber-50 rounded-md">
                  <p className="text-sm text-amber-800">{t.notesLabel}: {ret.notes}</p>
                </div>
              )}
              {ret.reviewNotes && (
                <div className="p-3 bg-blue-50 rounded-md">
                  <p className="text-sm text-blue-800">{t.reviewNotes}: {ret.reviewNotes}</p>
                </div>
              )}
              <button
                onClick={() => {
                  setSelectedReturn(ret);
                  setIsViewModalOpen(true);
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 self-end"
              >
                <Eye className="w-4 h-4 inline mr-2" />
                {t.view}
              </button>
            </div>
          </div>
        </motion.div>
      );
    },
    [t, isRtl]
  );

  return (
    <div className="mx-auto px-4 py-8 min-h-screen" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Package className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
            <p className="text-gray-600 text-sm">{t.subtitle}</p>
          </div>
        </div>
        <button
          onClick={() => {
            setIsCreateModalOpen(true);
            refetchInventory(); // Refresh inventory before opening modal
          }}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t.createReturn}
        </button>
      </div>

      {returnsError && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm font-medium">{returnsError.message}</span>
          <button
            onClick={() => refetchReturns()}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200"
          >
            {t.common.retry}
          </button>
        </motion.div>
      )}

      <div className="p-6 bg-white rounded-xl shadow-sm mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ProductSearchInput
            value={searchInput}
            onChange={handleSearchChange}
            placeholder={t.searchPlaceholder}
            className="w-full"
          />
          <ProductDropdown
            value={filterStatus}
            onChange={(value) => {
              setFilterStatus(value as ReturnStatus | '');
              setCurrentPage(1);
            }}
            options={statusOptions}
            className="w-full"
          />
        </div>
      </div>

      {returnsLoading ? (
        <div className="grid grid-cols-1 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-5 bg-white rounded-xl shadow-sm animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      ) : paginatedReturns.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl shadow-sm">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-sm font-medium">{t.noReturns}</p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200"
          >
            {t.createReturn}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <AnimatePresence>
            {paginatedReturns.map((ret) => (
              <ReturnCard key={ret._id} ret={ret} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
            disabled={currentPage === 1}
          >
            {t.pagination.previous}
          </button>
          <span className="text-gray-700 font-medium">
            {t.pagination.page.replace('{current}', currentPage.toString()).replace('{total}', totalPages.toString())}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
            disabled={currentPage === totalPages}
          >
            {t.pagination.next}
          </button>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isCreateModalOpen ? 1 : 0 }}
        className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${isCreateModalOpen ? '' : 'pointer-events-none'}`}
      >
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: isCreateModalOpen ? 1 : 0.95 }}
          className="bg-white p-6 rounded-xl shadow-xl max-w-lg w-full"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">{t.createReturn}</h2>
            <button
              onClick={() => {
                setIsCreateModalOpen(false);
                dispatchReturnForm({ type: 'RESET' });
                setReturnErrors({});
                setRetryCount(0);
              }}
              className="p-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.notesLabel}</label>
              <textarea
                value={returnForm.notes}
                onChange={(e) => dispatchReturnForm({ type: 'SET_NOTES', payload: e.target.value })}
                placeholder={t.notesPlaceholder}
                className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                rows={3}
              />
              {returnErrors.form && <p className="text-red-600 text-xs mt-1">{returnErrors.form}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.items}</label>
              {returnForm.items.map((item, index) => (
                <div key={index} className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <ProductDropdown
                    value={item.productId}
                    onChange={(value) => handleProductChange(index, value)}
                    options={productOptions}
                    placeholder={t.selectProduct}
                    className="w-full mb-2"
                  />
                  {returnErrors[`item_${index}_productId`] && (
                    <p className="text-red-600 text-xs mb-2">{returnErrors[`item_${index}_productId`]}</p>
                  )}
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t.quantity}</label>
                      <QuantityInput
                        value={item.quantity}
                        onChange={(val) => updateItemInForm(index, 'quantity', val)}
                        onIncrement={() => updateItemInForm(index, 'quantity', item.quantity + 1)}
                        onDecrement={() => updateItemInForm(index, 'quantity', item.quantity - 1)}
                        max={item.maxQuantity}
                      />
                      {returnErrors[`item_${index}_quantity`] && (
                        <p className="text-red-600 text-xs mt-1">{returnErrors[`item_${index}_quantity`]}</p>
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t.reason}</label>
                      <ProductDropdown
                        value={item.reason}
                        onChange={(value) => updateItemInForm(index, 'reason', value)}
                        options={reasonOptions}
                        className="w-full"
                      />
                      {returnErrors[`item_${index}_reason`] && (
                        <p className="text-red-600 text-xs mt-1">{returnErrors[`item_${index}_reason`]}</p>
                      )}
                    </div>
                    <button
                      onClick={() => removeItemFromForm(index)}
                      className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg mt-6"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={addItemToForm}
                className="flex items-center gap-2 text-amber-600 hover:text-amber-800 text-sm font-medium"
                disabled={availableItems.length === 0 || productOptions.length <= 1}
              >
                <Plus className="w-4 h-4" />
                {t.addItem}
              </button>
              {returnErrors.items && <p className="text-red-600 text-xs">{returnErrors.items}</p>}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  dispatchReturnForm({ type: 'RESET' });
                  setReturnErrors({});
                  setRetryCount(0);
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={() => createReturnMutation.mutate()}
                disabled={createReturnMutation.isLoading}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {createReturnMutation.isLoading ? t.common.submitting : t.submitReturn}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isViewModalOpen ? 1 : 0 }}
        className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${isViewModalOpen ? '' : 'pointer-events-none'}`}
      >
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: isViewModalOpen ? 1 : 0.95 }}
          className="bg-white p-6 rounded-xl shadow-xl max-w-lg w-full"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">{t.viewReturn}: {selectedReturn?.returnNumber}</h2>
            <button
              onClick={() => setIsViewModalOpen(false)}
              className="p-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {selectedReturn && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">{t.returnNumber}</p>
                  <p className="text-sm font-medium text-gray-900">{selectedReturn.returnNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t.statusLabel}</p>
                  <span
                    className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                      selectedReturn.status === ReturnStatus.PENDING
                        ? 'bg-amber-100 text-amber-800'
                        : selectedReturn.status === ReturnStatus.APPROVED
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {t.status[selectedReturn.status as keyof typeof t.status] || selectedReturn.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t.date}</p>
                  <p className="text-sm font-medium text-gray-900">{new Date(selectedReturn.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t.branch}</p>
                  <p className="text-sm font-medium text-gray-900">{selectedReturn.branch?.displayName || t.branch}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">{t.items}</p>
                {selectedReturn.items.map((item, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-md border border-gray-100 mb-2">
                    <p className="text-sm font-medium text-gray-900">{item.product.displayName}</p>
                    <p className="text-sm text-gray-600">{t.quantity}: {item.quantity} {item.product.displayUnit}</p>
                    <p className="text-sm text-gray-600">{t.reason}: {isRtl ? item.reason : item.reasonEn}</p>
                  </div>
                ))}
              </div>
              {selectedReturn.notes && (
                <div className="p-3 bg-amber-50 rounded-md">
                  <p className="text-sm text-amber-800">{t.notesLabel}: {selectedReturn.notes}</p>
                </div>
              )}
              {selectedReturn.reviewNotes && (
                <div className="p-3 bg-blue-50 rounded-md">
                  <p className="text-sm text-blue-800">{t.reviewNotes}: {selectedReturn.reviewNotes}</p>
                </div>
              )}
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium w-full"
              >
                {t.common.close}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default BranchReturns;