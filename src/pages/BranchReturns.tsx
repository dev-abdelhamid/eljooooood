import React, { useState, useMemo, useCallback, useEffect, useReducer } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Eye, Clock, Check, AlertCircle, MinusCircle, Plus, X } from 'lucide-react';
import { returnsAPI, inventoryAPI } from './api';
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
    reasonDisplay: string;
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
  pending: number;
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
    pending: 'معلق',
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
      writeConflict: 'تعارض في الكتابة، حاول مرة أخرى',
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
    pending: 'Pending',
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
      writeConflict: 'Write conflict, please try again',
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
                reasonDisplay: isRtl ? item.reason : item.reasonEn || item.reason,
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

  const { data: inventoryData } = useQuery<AvailableItem[], Error>({
    queryKey: ['inventory', user?.branchId, language],
    queryFn: async () => {
      if (!user?.branchId) return [];
      const response = await inventoryAPI.getByBranch(user.branchId);
      return response
        .filter((item: any) => item.currentStock > 0 && item.product)
        .map((item: any) => ({
          productId: item.product._id,
          productName: isRtl ? item.product.name : item.product.nameEn || item.product.name,
          available: item.currentStock - (item.pendingStock || 0),
          pending: item.pendingStock || 0,
          unit: item.product.unit || t.unit,
          displayUnit: isRtl ? item.product.unit : item.product.unitEn || item.product.unit || t.unit,
          departmentName: item.product.department
            ? (isRtl ? item.product.department.name : item.product.department.nameEn || item.product.department.name)
            : t.department,
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
      return response.returns.map((order: any) => order._id);
    },
    enabled: !!user?.branchId && returnForm.items.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (ordersData) {
      dispatchReturnForm({ type: 'SET_ORDERS', payload: ordersData });
    }
  }, [ordersData]);

  useEffect(() => {
    if (!socket || !user?.branchId) return;

    const handleReturnCreated = ({ branchId, returnNumber }: { branchId: string; returnNumber: string }) => {
      if (branchId === user.branchId) {
        queryClient.invalidateQueries({ queryKey: ['returns', 'inventory'] });
        toast.success(t.newReturnNotification.replace('{returnNumber}', returnNumber), {
          position: isRtl ? 'top-right' : 'top-left',
        });
      }
    };

    const handleReturnStatusUpdated = ({ branchId, status, returnNumber }: { branchId: string; status: string; returnNumber: string }) => {
      if (branchId === user.branchId) {
        queryClient.invalidateQueries({ queryKey: ['returns', 'inventory'] });
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

  const createReturnMutation = useMutation({
    mutationFn: async (data: ReturnFormState) => {
      if (!user?.branchId) throw new Error(t.errors.noBranch);
      return returnsAPI.createReturn({
        branchId: user.branchId,
        items: data.items,
        notes: data.notes,
        orders: data.orders,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns', 'inventory'] });
      dispatchReturnForm({ type: 'RESET' });
      setIsCreateModalOpen(false);
      setReturnErrors({});
      toast.success(t.createSuccess, { position: isRtl ? 'top-right' : 'top-left' });
    },
    onError: (error: any) => {
      const message = error.message || t.errors.createReturn;
      if (error.message.includes('Write conflict') && retryCount < 3) {
        setRetryCount(retryCount + 1);
        setTimeout(() => createReturnMutation.mutate(returnForm), 2000 * (retryCount + 1));
        toast.warn(t.errors.writeConflict, { position: isRtl ? 'top-right' : 'top-left' });
      } else {
        setRetryCount(0);
        toast.error(message, { position: isRtl ? 'top-right' : 'top-left' });
      }
    },
  });

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
      ...availableItems.map((item) => ({
        value: item.productId,
        label: `${item.productName} (${t.quantity}: ${item.available}, ${t.pending}: ${item.pending} ${item.displayUnit})`,
      })),
    ],
    [availableItems, t]
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
      payload: { productId: '', quantity: 1, reason: '', reasonEn: '', maxQuantity: 0 },
    });
  }, []);

  const updateItemInForm = useCallback(
    (index: number, field: keyof ReturnItem, value: string | number) => {
      if (field === 'quantity' && typeof value === 'string') {
        const numValue = parseInt(value, 10);
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
      } else if (field === 'productId') {
        const selectedItem = availableItems.find((item) => item.productId === value);
        if (selectedItem) {
          dispatchReturnForm({
            type: 'UPDATE_ITEM',
            payload: { index, field: 'productId', value },
          });
          dispatchReturnForm({
            type: 'UPDATE_ITEM',
            payload: { index, field: 'maxQuantity', value: selectedItem.available },
          });
          if (returnForm.items[index]?.quantity > selectedItem.available) {
            dispatchReturnForm({
              type: 'UPDATE_ITEM',
              payload: { index, field: 'quantity', value: selectedItem.available },
            });
          }
        }
      } else {
        dispatchReturnForm({ type: 'UPDATE_ITEM', payload: { index, field, value } });
      }
    },
    [reasonOptions, availableItems, returnForm.items]
  );

  const removeItemFromForm = useCallback((index: number) => {
    dispatchReturnForm({ type: 'REMOVE_ITEM', payload: index });
  }, []);

  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!returnForm.items.length) {
      errors.items = t.errors.noItemSelected;
    }
    returnForm.items.forEach((item, index) => {
      if (!item.productId) {
        errors[`product_${index}`] = t.errors.required.replace('{field}', t.product);
      }
      if (!item.reason) {
        errors[`reason_${index}`] = t.errors.required.replace('{field}', t.reason);
      }
      if (item.quantity < 1 || item.quantity > item.maxQuantity) {
        errors[`quantity_${index}`] = t.errors.invalidQuantityMax.replace('{max}', item.maxQuantity.toString());
      }
      const selectedItem = availableItems.find((ai) => ai.productId === item.productId);
      if (selectedItem && item.quantity > selectedItem.available) {
        errors[`quantity_${index}`] = t.errors.insufficientQuantity;
      }
    });
    setReturnErrors(errors);
    return Object.keys(errors).length === 0;
  }, [returnForm.items, availableItems, t]);

  const handleSubmitReturn = useCallback(() => {
    if (!validateForm()) {
      toast.error(t.errors.invalidForm, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    createReturnMutation.mutate(returnForm);
  }, [validateForm, createReturnMutation, returnForm, t, isRtl]);

  const handleViewReturn = useCallback((ret: Return) => {
    setSelectedReturn(ret);
    setIsViewModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsCreateModalOpen(false);
    setIsViewModalOpen(false);
    setSelectedReturn(null);
    dispatchReturnForm({ type: 'RESET' });
    setReturnErrors({});
    setRetryCount(0);
  }, []);

  const handleStatusFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterStatus(e.target.value as ReturnStatus | '');
    setCurrentPage(1);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  }, [totalPages]);

  return (
    <div className={`container mx-auto p-4 ${isRtl ? 'font-arabic' : 'font-sans'}`}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-bold text-gray-800">{t.title}</h1>
        <p className="text-gray-600">{t.subtitle}</p>
      </motion.div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input
          type="text"
          value={searchInput}
          onChange={handleSearchChange}
          placeholder={t.searchPlaceholder}
          className="flex-1 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          dir={isRtl ? 'rtl' : 'ltr'}
        />
        <select
          value={filterStatus}
          onChange={handleStatusFilterChange}
          className="p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors duration-200"
        >
          {t.createReturn}
        </button>
      </div>

      {/* Returns Table */}
      {returnsLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
        </div>
      ) : returnsError ? (
        <div className="text-red-500 text-center">{returnsError.message || t.errors.fetchReturns}</div>
      ) : paginatedReturns.length === 0 ? (
        <div className="text-center text-gray-500">{t.noReturns}</div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="overflow-x-auto"
        >
          <table className="min-w-full bg-white shadow-md rounded-lg overflow-hidden">
            <thead className="bg-gray-100">
              <tr>
                <th className={`px-4 py-2 text-${isRtl ? 'right' : 'left'} text-sm font-medium text-gray-700`}>{t.returnNumber}</th>
                <th className={`px-4 py-2 text-${isRtl ? 'right' : 'left'} text-sm font-medium text-gray-700`}>{t.statusLabel}</th>
                <th className={`px-4 py-2 text-${isRtl ? 'right' : 'left'} text-sm font-medium text-gray-700`}>{t.date}</th>
                <th className={`px-4 py-2 text-${isRtl ? 'right' : 'left'} text-sm font-medium text-gray-700`}>{t.itemsCount}</th>
                <th className={`px-4 py-2 text-${isRtl ? 'right' : 'left'} text-sm font-medium text-gray-700`}>{t.branch}</th>
                <th className={`px-4 py-2 text-${isRtl ? 'right' : 'left'} text-sm font-medium text-gray-700`}>{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedReturns.map((ret) => (
                <motion.tr
                  key={ret._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="border-b"
                >
                  <td className={`px-4 py-3 text-${isRtl ? 'right' : 'left'}`}>{ret.returnNumber}</td>
                  <td className={`px-4 py-3 text-${isRtl ? 'right' : 'left'}`}>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-sm ${
                        ret.status === ReturnStatus.PENDING
                          ? 'bg-yellow-100 text-yellow-800'
                          : ret.status === ReturnStatus.APPROVED
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {ret.status === ReturnStatus.PENDING && <Clock className="w-4 h-4 mr-1" />}
                      {ret.status === ReturnStatus.APPROVED && <Check className="w-4 h-4 mr-1" />}
                      {ret.status === ReturnStatus.REJECTED && <AlertCircle className="w-4 h-4 mr-1" />}
                      {t.status[ret.status as keyof typeof t.status]}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-${isRtl ? 'right' : 'left'}`}>
                    {new Date(ret.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}
                  </td>
                  <td className={`px-4 py-3 text-${isRtl ? 'right' : 'left'}`}>{ret.items.length}</td>
                  <td className={`px-4 py-3 text-${isRtl ? 'right' : 'left'}`}>{ret.branch?.displayName || t.noNotes}</td>
                  <td className={`px-4 py-3 text-${isRtl ? 'right' : 'left'}`}>
                    <button
                      onClick={() => handleViewReturn(ret)}
                      className="text-amber-600 hover:text-amber-800 transition-colors duration-200"
                      aria-label={t.view}
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300 transition-colors duration-200"
          >
            {t.pagination.previous}
          </button>
          <span>{t.pagination.page.replace('{current}', currentPage.toString()).replace('{total}', totalPages.toString())}</span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300 transition-colors duration-200"
          >
            {t.pagination.next}
          </button>
        </div>
      )}

      {/* Create Return Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{t.createReturn}</h2>
                <button onClick={handleCloseModal} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t.items}</label>
                  {returnForm.items.map((item, index) => (
                    <div key={index} className="flex flex-col sm:flex-row gap-2 mb-2 border-b pb-2">
                      <div className="flex-1">
                        <select
                          value={item.productId}
                          onChange={(e) => updateItemInForm(index, 'productId', e.target.value)}
                          className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                          dir={isRtl ? 'rtl' : 'ltr'}
                        >
                          {productOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {returnErrors[`product_${index}`] && (
                          <p className="text-red-500 text-xs mt-1">{returnErrors[`product_${index}`]}</p>
                        )}
                      </div>
                      <div className="w-32">
                        <QuantityInput
                          value={item.quantity}
                          onChange={(val) => updateItemInForm(index, 'quantity', val)}
                          onIncrement={() => updateItemInForm(index, 'quantity', item.quantity + 1)}
                          onDecrement={() => updateItemInForm(index, 'quantity', item.quantity - 1)}
                          max={item.maxQuantity}
                        />
                        {returnErrors[`quantity_${index}`] && (
                          <p className="text-red-500 text-xs mt-1">{returnErrors[`quantity_${index}`]}</p>
                        )}
                      </div>
                      <div className="flex-1">
                        <select
                          value={item.reason}
                          onChange={(e) => updateItemInForm(index, 'reason', e.target.value)}
                          className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                          dir={isRtl ? 'rtl' : 'ltr'}
                        >
                          {reasonOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {returnErrors[`reason_${index}`] && (
                          <p className="text-red-500 text-xs mt-1">{returnErrors[`reason_${index}`]}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeItemFromForm(index)}
                        className="text-red-500 hover:text-red-700"
                        aria-label={t.removeItem}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  {returnErrors.items && <p className="text-red-500 text-xs mt-1">{returnErrors.items}</p>}
                  <button
                    onClick={addItemToForm}
                    className="mt-2 text-amber-600 hover:text-amber-800 flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-1" /> {t.addItem}
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t.notesLabel}</label>
                  <textarea
                    value={returnForm.notes}
                    onChange={(e) => dispatchReturnForm({ type: 'SET_NOTES', payload: e.target.value })}
                    placeholder={t.notesPlaceholder}
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                    rows={4}
                    dir={isRtl ? 'rtl' : 'ltr'}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleCloseModal}
                    className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors duration-200"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    onClick={handleSubmitReturn}
                    disabled={createReturnMutation.isLoading}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors duration-200 disabled:opacity-50"
                  >
                    {createReturnMutation.isLoading ? t.common.submitting : t.submitReturn}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Return Modal */}
      <AnimatePresence>
        {isViewModalOpen && selectedReturn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{t.viewReturn}</h2>
                <button onClick={handleCloseModal} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t.returnNumber}</label>
                  <p>{selectedReturn.returnNumber}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t.statusLabel}</label>
                  <p>{t.status[selectedReturn.status as keyof typeof t.status]}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t.date}</label>
                  <p>{new Date(selectedReturn.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t.branch}</label>
                  <p>{selectedReturn.branch?.displayName || t.noNotes}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t.items}</label>
                  <table className="min-w-full bg-gray-50 rounded-lg">
                    <thead>
                      <tr>
                        <th className={`px-4 py-2 text-${isRtl ? 'right' : 'left'} text-sm font-medium text-gray-700`}>{t.product}</th>
                        <th className={`px-4 py-2 text-${isRtl ? 'right' : 'left'} text-sm font-medium text-gray-700`}>{t.quantity}</th>
                        <th className={`px-4 py-2 text-${isRtl ? 'right' : 'left'} text-sm font-medium text-gray-700`}>{t.unit}</th>
                        <th className={`px-4 py-2 text-${isRtl ? 'right' : 'left'} text-sm font-medium text-gray-700`}>{t.reason}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReturn.items.map((item) => (
                        <tr key={item.itemId}>
                          <td className={`px-4 py-2 text-${isRtl ? 'right' : 'left'}`}>{item.product.displayName}</td>
                          <td className={`px-4 py-2 text-${isRtl ? 'right' : 'left'}`}>{item.quantity}</td>
                          <td className={`px-4 py-2 text-${isRtl ? 'right' : 'left'}`}>{item.product.displayUnit}</td>
                          <td className={`px-4 py-2 text-${isRtl ? 'right' : 'left'}`}>{item.reasonDisplay}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t.notesLabel}</label>
                  <p>{selectedReturn.notes || t.noNotes}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t.reviewNotes}</label>
                  <p>{selectedReturn.reviewNotes || t.noNotes}</p>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleCloseModal}
                    className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors duration-200"
                  >
                    {t.common.close}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

