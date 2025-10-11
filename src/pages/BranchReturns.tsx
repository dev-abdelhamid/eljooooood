import React, { useState, useMemo, useCallback, useEffect, useReducer } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Eye, Clock, Check, AlertCircle, MinusCircle, Plus, X, CheckCircle, XCircle } from 'lucide-react';
import { returnsAPI, inventoryAPI } from '../services/api';
import { ProductSearchInput, ProductDropdown } from './NewOrder';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useNotifications } from '../contexts/NotificationContext';

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
      price: number;
    };
    quantity: number;
    reason: string;
    reasonEn: string;
  }>;
  status: ReturnStatus;
  createdAt: string;
  notes: string;
  reviewNotes: string;
}

interface AvailableItem {
  productId: string;
  productName: string;
  available: number;
  unit: string;
  displayUnit: string;
  departmentName: string;
  stock: number;
  price: number;
}

interface ReturnFormState {
  notes: string;
  items: ReturnItem[];
}

const translations = {
  ar: {
    title: 'إدارة طلبات الإرجاع',
    subtitle: 'إنشاء ومتابعة وإدارة طلبات الإرجاع',
    noReturns: 'لا توجد طلبات إرجاع',
    returnNumber: 'رقم الإرجاع',
    statusLabel: 'الحالة',
    date: 'التاريخ',
    totalQuantity: 'إجمالي الكمية',
    totalPrice: 'إجمالي السعر',
    branch: 'الفرع',
    notesLabel: 'ملاحظات',
    reviewNotes: 'ملاحظات المراجعة',
    noNotes: 'لا توجد ملاحظات',
    createReturn: 'إنشاء طلب إرجاع',
    viewReturn: 'عرض طلب الإرجاع',
    approveReturn: 'الموافقة على الإرجاع',
    rejectReturn: 'رفض الإرجاع',
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
    reviewNotesPlaceholder: 'أدخل ملاحظات المراجعة (اختياري)',
    items: 'العناصر',
    addItem: 'إضافة عنصر',
    removeItem: 'إزالة العنصر',
    submitReturn: 'إرسال طلب الإرجاع',
    approve: 'موافقة',
    reject: 'رفض',
    createSuccess: 'تم إنشاء طلب الإرجاع بنجاح',
    updateSuccess: 'تم تحديث حالة الإرجاع بنجاح',
    newReturnNotification: 'تم إنشاء طلب إرجاع جديد: {returnNumber}',
    quantity: 'الكمية',
    unit: 'الوحدة',
    department: 'القسم',
    product: 'المنتج',
    price: 'السعر',
    Currency: 'ريال',
    status: {
      pending: 'قيد الانتظار',
      approved: 'موافق عليه',
      rejected: 'مرفوض',
      all: 'جميع الحالات',
    },
    notifications: {
      return_created: 'تم إنشاء طلب إرجاع جديد {returnNumber} من {branchName}',
      return_status_updated: 'تم تحديث حالة طلب الإرجاع {returnNumber} إلى {status}',
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
      updateReturn: 'خطأ في تحديث حالة الإرجاع',
      invalidForm: 'البيانات المدخلة غير صالحة',
      required: 'حقل {field} مطلوب',
      invalidQuantityMax: 'الكمية يجب أن تكون بين 1 و{max}',
      noItemSelected: 'لم يتم اختيار عنصر',
      insufficientQuantity: 'الكمية غير كافية للمنتج في المخزون',
      productNotFound: 'المنتج غير موجود',
      invalidReasonPair: 'سبب الإرجاع وسبب الإرجاع بالإنجليزية غير متطابقين',
      writeConflict: 'تعارض في الكتابة، حاول مرة أخرى',
      accessDenied: 'غير مصرح لك بالوصول إلى هذه الصفحة',
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
    subtitle: 'Create, track, and manage return requests',
    noReturns: 'No return requests found',
    returnNumber: 'Return Number',
    statusLabel: 'Status',
    date: 'Date',
    totalQuantity: 'Total Quantity',
    totalPrice: 'Total Price',
    branch: 'Branch',
    notesLabel: 'Notes',
    reviewNotes: 'Review Notes',
    noNotes: 'No notes available',
    createReturn: 'Create Return Request',
    viewReturn: 'View Return Request',
    approveReturn: 'Approve Return',
    rejectReturn: 'Reject Return',
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
    reviewNotesPlaceholder: 'Enter review notes (optional)',
    items: 'Items',
    addItem: 'Add Item',
    removeItem: 'Remove Item',
    submitReturn: 'Submit Return Request',
    approve: 'Approve',
    reject: 'Reject',
    createSuccess: 'Return request created successfully',
    updateSuccess: 'Return status updated successfully',
    newReturnNotification: 'New return request created: {returnNumber}',
    quantity: 'Quantity',
    unit: 'Unit',
    department: 'Department',
    product: 'Product',
    price: 'Price',
    Currency: 'SAR',
    status: {
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      all: 'All Statuses',
    },
    notifications: {
      return_created: 'New return request {returnNumber} created from {branchName}',
      return_status_updated: 'Return request {returnNumber} status updated to {status}',
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
      updateReturn: 'Error updating return status',
      invalidForm: 'Invalid form data',
      required: '{field} is required',
      invalidQuantityMax: 'Quantity must be between 1 and {max}',
      noItemSelected: 'No item selected',
      insufficientQuantity: 'Insufficient quantity for the product in inventory',
      productNotFound: 'Product not found',
      invalidReasonPair: 'Return reason and English reason do not match',
      writeConflict: 'Write conflict, please try again',
      accessDenied: 'You are not authorized to access this page',
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
        className="w-7 h-7 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors duration-200 flex items-center justify-center disabled:opacity-50"
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
        className="w-10 h-7 text-center border border-gray-200 rounded-md text-xs focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm"
        aria-label={isRtl ? 'الكمية' : 'Quantity'}
      />
      <button
        onClick={onIncrement}
        className="w-7 h-7 bg-amber-600 hover:bg-amber-700 rounded-full transition-colors duration-200 flex items-center justify-center disabled:opacity-50"
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
    case 'RESET':
      return { notes: '', items: [] };
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
  const { socket, isConnected } = useSocket();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<ReturnStatus | ''>('');
  const [filterReason, setFilterReason] = useState<string>('');
  const [filterBranch, setFilterBranch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  const [returnForm, dispatchReturnForm] = useReducer(returnFormReducer, { notes: '', items: [] });
  const [returnErrors, setReturnErrors] = useState<Record<string, string>>({});
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [reviewNotes, setReviewNotes] = useState('');
  const maxRetries = 3;
  const RETURNS_PER_PAGE = 10;

  // Check if user is authorized
  if (user?.role === 'chef') {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="p-6 bg-red-50 rounded-xl shadow-sm border border-red-200">
          <p className="text-red-600 text-sm font-medium">{t.errors.accessDenied}</p>
        </div>
      </div>
    );
  }

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

  const { data: branchesData, isLoading: branchesLoading, error: branchesError, refetch: refetchBranches } = useQuery<
    Branch[],
    Error
  >({
    queryKey: ['branches', language],
    queryFn: async () => {
      try {
        const response = await returnsAPI.getBranches();
        return response.branches.map((branch: any) => ({
          _id: branch._id,
          displayName: branch.displayName,
        }));
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Error fetching branches:`, err);
        if (err.status === 404 && retryCount < maxRetries) {
          setRetryCount((prev) => prev + 1);
          toast.info(t.errors.retryFetchBranches, {
            position: isRtl ? 'top-right' : 'top-left',
            toastId: `retry-branches-${retryCount}`,
          });
          setTimeout(() => refetchBranches(), 1000 * Math.pow(2, retryCount));
        } else {
          toast.error(t.errors.fetchBranches, {
            position: isRtl ? 'top-right' : 'top-left',
            toastId: `fetch-branches-error`,
          });
        }
        throw err;
      }
    },
    enabled: user?.role === 'admin' || user?.role === 'production',
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const { data: returnsData, isLoading: returnsLoading, error: returnsError, refetch: refetchReturns } = useQuery<
    { returns: Return[]; total: number },
    Error
  >({
    queryKey: ['returns', user?.branchId, filterStatus, filterReason, filterBranch, debouncedSearchQuery, currentPage, language],
    queryFn: async () => {
      const query: any = {
        status: filterStatus,
        'items.reasonEn': filterReason,
        branch: filterBranch,
        search: debouncedSearchQuery,
        page: currentPage,
        limit: RETURNS_PER_PAGE,
      };
      if (user?.role === 'branch' && user.branchId) {
        query.branch = user.branchId;
      }
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
                  price: item.product?.price || 0,
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
        })),
        total: response.total || 0,
      };
    },
    enabled: !!user && user.role !== 'chef',
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    onError: (err) => {
      toast.error(err.message || t.errors.fetchReturns, {
        position: isRtl ? 'top-right' : 'top-left',
        toastId: `fetch-returns-${Date.now()}`,
      });
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
          available: item.currentStock,
          unit: item.product.unit || t.unit,
          displayUnit: isRtl ? item.product.unit : item.product.unitEn || item.product.unit || t.unit,
          departmentName: item.product.department
            ? (isRtl ? item.product.department.name : item.product.department.nameEn || item.product.department.name)
            : t.department,
          stock: item.currentStock,
          price: item.product.price || 0,
        }));
    },
    enabled: !!user?.branchId && user?.role === 'branch',
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!socket || !user || !isConnected) return;

    socket.emit('joinRoom', {
      role: user.role,
      branchId: user.branchId,
      userId: user._id,
    });

    const handleReturnCreated = (data: {
      branchId: string;
      returnId: string;
      returnNumber: string;
      branchName?: string;
      eventId: string;
    }) => {
      if (user.role === 'branch' && data.branchId !== user.branchId) return;
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      addNotification({
        _id: data.eventId,
        type: 'success',
        message: t.notifications.return_created
          .replace('{returnNumber}', data.returnNumber)
          .replace('{branchName}', data.branchName || t.branch),
        data: { returnId: data.returnId, branchId: data.branchId, eventId: data.eventId },
        read: false,
        createdAt: new Date().toISOString(),
        sound: '/sounds/notification.mp3',
        vibrate: [200, 100, 200],
      });
    };

    const handleReturnStatusUpdated = (data: {
      branchId: string;
      returnId: string;
      status: string;
      returnNumber: string;
      branchName?: string;
      eventId: string;
    }) => {
      if (user.role === 'branch' && data.branchId !== user.branchId) return;
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      addNotification({
        _id: data.eventId,
        type: 'info',
        message: t.notifications.return_status_updated
          .replace('{returnNumber}', data.returnNumber)
          .replace('{status}', t.status[data.status as keyof typeof t.status] || data.status)
          .replace('{branchName}', data.branchName || t.branch),
        data: { returnId: data.returnId, branchId: data.branchId, eventId: data.eventId },
        read: false,
        createdAt: new Date().toISOString(),
        sound: '/sounds/notification.mp3',
        vibrate: [200, 100, 200],
      });
    };

    socket.on('connect', () => {
      toast.info(t.socket.connected, {
        position: isRtl ? 'top-right' : 'top-left',
        toastId: `socket-connect-${Date.now()}`,
      });
    });

    socket.on('returnCreated', handleReturnCreated);
    socket.on('returnStatusUpdated', handleReturnStatusUpdated);

    return () => {
      socket.off('connect');
      socket.off('returnCreated', handleReturnCreated);
      socket.off('returnStatusUpdated', handleReturnStatusUpdated);
    };
  }, [socket, user, isConnected, queryClient, t, isRtl, addNotification]);

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
        label: `${item.productName} (${t.quantity}: ${item.available} ${item.displayUnit}, ${t.price}: ${item.price.toFixed(2)} ${t.Currency})`,
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
          (ret.branch?.displayName || '').toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
          ret.items.some((item) => item.product.displayName.toLowerCase().includes(debouncedSearchQuery.toLowerCase())) ||
          ret.items.some((item) => (isRtl ? item.reason : item.reasonEn).toLowerCase().includes(debouncedSearchQuery.toLowerCase()))
      ),
    [returnsData, debouncedSearchQuery, isRtl]
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
    },
    [inventoryData]
  );

  const removeItemFromForm = useCallback((index: number) => {
    dispatchReturnForm({ type: 'REMOVE_ITEM', payload: index });
  }, []);

  const validateReturnForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!user?.branchId && user?.role === 'branch') {
      errors.form = t.errors.noBranch;
    }
    if (returnForm.items.length === 0) {
      errors.items = t.errors.required.replace('{field}', t.items);
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
      } else if (item.quantity > inventoryItem.available) {
        errors[`item_${index}_quantity`] = t.errors.insufficientQuantity;
      }
    });
    setReturnErrors(errors);
    return Object.keys(errors).length === 0;
  }, [returnForm, t, inventoryData, user]);

  const createReturnMutation = useMutation<{ returnId: string; returnNumber: string }, Error, void>({
    mutationFn: async () => {
      if (!validateReturnForm()) throw new Error(t.errors.invalidForm);
      if (!user?.branchId) throw new Error(t.errors.noBranch);
      const data = {
        branchId: user.branchId,
        items: returnForm.items.map((item) => ({
          product: item.productId,
          quantity: item.quantity,
          reason: item.reason,
          reasonEn: item.reasonEn,
        })),
        notes: returnForm.notes || undefined,
      };
      const response = await returnsAPI.createReturn(data);
      return {
        returnId: response?._id || crypto.randomUUID(),
        returnNumber: response?.returnNumber || `RET-${response?._id.slice(-6)}`,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      setIsCreateModalOpen(false);
      dispatchReturnForm({ type: 'RESET' });
      setReturnErrors({});
      setRetryCount(0);
      toast.success(t.createSuccess, {
        position: isRtl ? 'top-right' : 'top-left',
        toastId: `create-return-${data.returnId}`,
      });
      if (isConnected) {
        socket?.emit('returnCreated', {
          branchId: user?.branchId,
          returnId: data.returnId,
          returnNumber: data.returnNumber,
          branchName: user?.branch?.displayName,
          status: ReturnStatus.PENDING,
          eventId: crypto.randomUUID(),
        });
      }
    },
    onError: (err) => {
      if (err.message.includes('Write conflict') && retryCount < 3) {
        setRetryCount(retryCount + 1);
        setTimeout(() => createReturnMutation.mutate(), 2000 * (retryCount + 1));
        toast.info(t.errors.writeConflict, {
          position: isRtl ? 'top-right' : 'top-left',
          toastId: `write-conflict-${Date.now()}`,
        });
      } else {
        toast.error(err.message || t.errors.createReturn, {
          position: isRtl ? 'top-right' : 'top-left',
          toastId: `create-error-${Date.now()}`,
        });
        setReturnErrors({ form: err.message });
      }
    },
  });

  const updateReturnStatusMutation = useMutation<
    void,
    Error,
    { returnId: string; status: ReturnStatus; reviewNotes?: string }
  >({
    mutationFn: async ({ returnId, status, reviewNotes }) => {
      if (!['approved', 'rejected'].includes(status)) {
        throw new Error(t.errors.invalidForm);
      }
      await returnsAPI.updateReturnStatus(returnId, status, reviewNotes);
    },
    onSuccess: (_, { returnId, status }) => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      setIsApproveModalOpen(false);
      setReviewNotes('');
      setSelectedReturn(null);
      toast.success(t.updateSuccess, {
        position: isRtl ? 'top-right' : 'top-left',
        toastId: `update-return-${returnId}`,
      });
      if (isConnected) {
        socket?.emit('returnStatusUpdated', {
          branchId: selectedReturn?.branch?._id,
          returnId,
          status,
          returnNumber: selectedReturn?.returnNumber,
          branchName: selectedReturn?.branch?.displayName,
          eventId: crypto.randomUUID(),
        });
      }
    },
    onError: (err) => {
      toast.error(err.message || t.errors.updateReturn, {
        position: isRtl ? 'top-right' : 'top-left',
        toastId: `update-error-${Date.now()}`,
      });
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

      const totalQuantity = ret.items.reduce((sum, item) => sum + item.quantity, 0);
      const totalPrice = ret.items.reduce((sum, item) => sum + item.quantity * item.product.price, 0).toFixed(2);

      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100 overflow-hidden"
        >
          <div className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <h3 className="text-lg font-semibold text-gray-900">{t.returnNumber}: {ret.returnNumber}</h3>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                <StatusIcon className="w-4 h-4" />
                {statusInfo.label}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
              <div>
                <p className="text-xs text-gray-500">{t.date}</p>
                <p className="text-xs font-medium text-gray-900">
                  {new Date(ret.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t.totalQuantity}</p>
                <p className="text-xs font-medium text-gray-900">
                  {totalQuantity} {t.items}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t.totalPrice}</p>
                <p className="text-xs font-medium text-gray-900">{totalPrice} {t.Currency}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t.branch}</p>
                <p className="text-xs font-medium text-gray-900">{ret.branch?.displayName || t.branch}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 mb-3">
              {ret.items.map((item, index) => (
                <div
                  key={index}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors duration-200"
                >
                  <p className="text-xs font-semibold text-gray-900">{item.product.displayName}</p>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
                    <p className="text-xs text-gray-600">
                      {t.quantity}: {item.quantity} {item.product.displayUnit}
                    </p>
                    <p className="text-xs text-gray-600">
                      {t.price}: {(item.quantity * item.product.price).toFixed(2)} {t.Currency}
                    </p>
                    <p className="text-xs text-gray-600">{t.reason}: {isRtl ? item.reason : item.reasonEn}</p>
                  </div>
                </div>
              ))}
            </div>
            {ret.notes && (
              <div className="p-3 bg-amber-50 rounded-lg">
                <p className="text-xs font-medium text-amber-800">{t.notesLabel}: {ret.notes}</p>
              </div>
            )}
            {ret.reviewNotes && (
              <div className="p-3 bg-blue-50 rounded-lg mt-2">
                <p className="text-xs font-medium text-blue-800">{t.reviewNotes}: {ret.reviewNotes}</p>
              </div>
            )}
            <div className="flex justify-end gap-3 mt-3">
              {['admin', 'production'].includes(user?.role || '') && ret.status === ReturnStatus.PENDING && (
                <>
                  <button
                    onClick={() => {
                      setSelectedReturn(ret);
                      setIsApproveModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-medium transition-colors duration-200 flex items-center gap-1.5"
                    aria-label={t.approve}
                  >
                    <CheckCircle className="w-4 h-4" />
                    {t.approve}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedReturn(ret);
                      setIsApproveModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-medium transition-colors duration-200 flex items-center gap-1.5"
                    aria-label={t.reject}
                  >
                    <XCircle className="w-4 h-4" />
                    {t.reject}
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  setSelectedReturn(ret);
                  setIsViewModalOpen(true);
                }}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-medium transition-colors duration-200 flex items-center gap-1.5"
                aria-label={t.view}
              >
                <Eye className="w-4 h-4" />
                {t.view}
              </button>
            </div>
          </div>
        </motion.div>
      );
    },
    [t, isRtl, user]
  );

  return (
    <div className={`p-4 md:p-6 ${isRtl ? 'text-right' : 'text-left'}`}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Package className="w-6 h-6 text-amber-600" />
          {t.title}
        </h1>
      </div>
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            {t.subtitle}
          </h3>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <ProductSearchInput
              value={searchInput}
              onChange={handleSearchChange}
              placeholder={t.searchPlaceholder}
              className="w-full sm:w-48 p-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-amber-500 bg-white"
            />
            <ProductDropdown
              value={filterStatus}
              onChange={(value) => setFilterStatus(value as ReturnStatus | '')}
              options={statusOptions}
              className="w-full sm:w-48 p-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-amber-500 bg-white"
            />
            <ProductDropdown
              value={filterReason}
              onChange={setFilterReason}
              options={reasonOptions}
              className="w-full sm:w-48 p-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-amber-500 bg-white"
            />
            {(user?.role === 'admin' || user?.role === 'production') && (
              <ProductDropdown
                value={filterBranch}
                onChange={setFilterBranch}
                options={branchOptions.map((branch) => ({ value: branch._id, label: branch.displayName }))}
                className="w-full sm:w-48 p-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-amber-500 bg-white"
              />
            )}
          </div>
        </div>
      </div>
      {returnsLoading ? (
        <Loader />
      ) : returnsError ? (
        <div className="text-center text-red-600 p-4">{returnsError.message}</div>
      ) : (
        <div className="space-y-6">
          {paginatedReturns.length === 0 ? (
            <p className="text-gray-500 text-sm">{t.noReturns}</p>
          ) : (
            paginatedReturns.map((ret) => <ReturnCard key={ret._id} ret={ret} />)
          )}
        </div>
      )}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-4">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md text-sm font-medium transition-colors duration-200 disabled:opacity-50"
          >
            {t.pagination.previous}
          </button>
          <span className="py-2 text-sm text-gray-600">
            {t.pagination.page.replace('{current}', currentPage.toString()).replace('{total}', totalPages.toString())}
          </span>
          <button
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md text-sm font-medium transition-colors duration-200 disabled:opacity-50"
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
            onClick={() => {
              setIsCreateModalOpen(false);
              dispatchReturnForm({ type: 'RESET' });
              setReturnErrors({});
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl p-6 w-full max-w-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">{t.createReturn}</h2>
                <button
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    dispatchReturnForm({ type: 'RESET' });
                    setReturnErrors({});
                  }}
                  className="p-1 hover:bg-gray-100 rounded-full"
                  aria-label={t.common.cancel}
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              {returnErrors.form && (
                <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm text-red-600">{returnErrors.form}</p>
                </div>
              )}
              <div className="space-y-4">
                {returnForm.items.map((item, index) => (
                  <div key={index} className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <ProductDropdown
                      value={item.productId}
                      onChange={(value) => handleProductChange(index, value)}
                      options={productOptions}
                      placeholder={t.selectProduct}
                      className="w-full"
                    />
                    {returnErrors[`item_${index}_productId`] && (
                      <p className="text-sm text-red-600">{returnErrors[`item_${index}_productId`]}</p>
                    )}
                    <div className="flex items-center gap-4">
                      <QuantityInput
                        value={item.quantity}
                        onChange={(val) => updateItemInForm(index, 'quantity', val)}
                        onIncrement={() => updateItemInForm(index, 'quantity', item.quantity + 1)}
                        onDecrement={() => updateItemInForm(index, 'quantity', item.quantity - 1)}
                        max={item.maxQuantity}
                      />
                      {returnErrors[`item_${index}_quantity`] && (
                        <p className="text-sm text-red-600">{returnErrors[`item_${index}_quantity`]}</p>
                      )}
                    </div>
                    <ProductDropdown
                      value={item.reason}
                      onChange={(value) => updateItemInForm(index, 'reason', value)}
                      options={reasonOptions}
                      placeholder={t.selectReason}
                      className="w-full"
                    />
                    {returnErrors[`item_${index}_reason`] && (
                      <p className="text-sm text-red-600">{returnErrors[`item_${index}_reason`]}</p>
                    )}
                    <button
                      onClick={() => removeItemFromForm(index)}
                      className="text-red-600 hover:text-red-700 text-sm flex items-center gap-1"
                      aria-label={t.removeItem}
                    >
                      <XCircle className="w-4 h-4" />
                      {t.removeItem}
                    </button>
                  </div>
                ))}
                {returnErrors.items && <p className="text-sm text-red-600">{returnErrors.items}</p>}
                <button
                  onClick={addItemToForm}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-1.5"
                  aria-label={t.addItem}
                >
                  <Plus className="w-4 h-4" />
                  {t.addItem}
                </button>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.notesLabel}</label>
                  <textarea
                    value={returnForm.notes}
                    onChange={(e) => dispatchReturnForm({ type: 'SET_NOTES', payload: e.target.value })}
                    placeholder={t.notesPlaceholder}
                    className="w-full p-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      dispatchReturnForm({ type: 'RESET' });
                      setReturnErrors({});
                    }}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md text-sm font-medium transition-colors duration-200"
                    aria-label={t.common.cancel}
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    onClick={() => createReturnMutation.mutate()}
                    disabled={createReturnMutation.isLoading}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-sm font-medium transition-colors duration-200 disabled:opacity-50"
                    aria-label={t.submitReturn}
                  >
                    {createReturnMutation.isLoading ? t.common.submitting : t.submitReturn}
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

export default BranchReturns;