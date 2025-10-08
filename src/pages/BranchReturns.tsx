import React, { useState, useMemo, useCallback, useEffect, useReducer } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Eye, Clock, Check, AlertCircle, Search, Download, Plus, X } from 'lucide-react';
import { returnsAPI, inventoryAPI } from '../services/api';
import { ProductSearchInput, ProductDropdown } from './NewOrder';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Enums for type safety
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

// Interfaces
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
}

interface Return {
  _id: string;
  returnNumber: string;
  branch: { _id: string; name: string; nameEn: string; displayName: string } | null;
  items: Array<{
    itemId: string;
    product: { _id: string; name: string; nameEn: string; unit: string; unitEn: string; department: { name: string; nameEn: string } | null };
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
  departmentName: string;
  stock: number;
}

// Translations
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
    exportExcel: 'تصدير إلى Excel',
    exportPdf: 'تصدير إلى PDF',
    exportSuccess: 'تم التصدير بنجاح',
    pdfExportSuccess: 'تم تصدير PDF بنجاح',
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
      branchNotFound: 'الفرع غير موجود',
      productNotFound: 'المنتج غير موجود',
      pdfExport: 'خطأ في تصدير PDF',
      socketInit: 'خطأ في تهيئة الاتصال بالخادم',
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
    exportExcel: 'Export to Excel',
    exportPdf: 'Export to PDF',
    exportSuccess: 'Export successful',
    pdfExportSuccess: 'PDF export successful',
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
      branchNotFound: 'Branch not found',
      productNotFound: 'Product not found',
      pdfExport: 'Error exporting PDF',
      socketInit: 'Error initializing server connection',
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

// QuantityInput Component (reused from BranchInventory)
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
        <Minus className="w-4 h-4" />
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        max={max}
        min={1}
        className="w-12 h-8 text-center border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm min-w-[2.75rem] transition-all duration-200"
        style={{ appearance: 'none' }}
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

// Reducer for return form (reused from BranchInventory)
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

// Validate ObjectId
const isValidObjectId = (id: string): boolean => /^[0-9a-fA-F]{24}$/.test(id);

const BranchReturns: React.FC = () => {
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
  const [returnForm, dispatchReturnForm] = useReducer(returnFormReducer, { notes: '', items: [] });
  const [returnErrors, setReturnErrors] = useState<Record<string, string>>({});
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);

  const RETURNS_PER_PAGE = 10;

  // Custom debounce hook
  const useDebouncedState = <T,>(initialValue: T, delay: number) => {
    const [value, setValue] = useState<T>(initialValue);
    const [debouncedValue, setDebouncedValue] = useState<T>(initialValue);
    useEffect(() => {
      const handler = setTimeout(() => setDebouncedValue(value), delay);
      return () => clearTimeout(handler);
    }, [value, delay]);
    return [value, setSearchInput, debouncedValue] as const;
  };

  const [searchInput, setSearchInput, debouncedSearchQuery] = useDebouncedState<string>('', 300);

  // Returns Query
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
          returnNumber: ret.returnNumber || t.returnNumber,
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
                  unitEn: item.product?.unitEn || item.product?.unit || 'N/A',
                  department: item.product?.department
                    ? {
                        name: item.product.department.name,
                        nameEn: item.product.department.nameEn || item.product.department.name,
                      }
                    : null,
                },
                quantity: item.quantity || 0,
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
    enabled: !!user?.branchId,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    onError: (err) => {
      toast.error(err.message || t.errors.fetchReturns, { position: isRtl ? 'top-right' : 'top-left' });
    },
  });

  // Inventory Query for Available Items
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
          unit: isRtl ? item.product.unit || t.unit : item.product.unitEn || item.product.unit || 'N/A',
          departmentName: isRtl
            ? item.product.department?.name || t.departments?.unknown || 'Unknown'
            : item.product.department?.nameEn || item.product.department?.name || t.departments?.unknown || 'Unknown',
          stock: item.currentStock,
        }));
    },
    enabled: !!user?.branchId,
    staleTime: 5 * 60 * 1000,
  });

  // Socket Events
  useEffect(() => {
    if (!socket || !user?.branchId) return;

    const handleReturnCreated = ({ branchId, returnNumber }: { branchId: string; returnNumber: string }) => {
      if (branchId === user.branchId) {
        queryClient.invalidateQueries({ queryKey: ['returns'] });
        toast.success(t.newReturnNotification.replace('{returnNumber}', returnNumber), {
          position: isRtl ? 'top-right' : 'top-left',
        });
      }
    };

    const handleReturnStatusUpdated = ({ branchId, status }: { branchId: string; status: string }) => {
      if (branchId === user.branchId) {
        queryClient.invalidateQueries({ queryKey: ['returns'] });
        const audio = new Audio('https://eljoodia-client.vercel.app/sounds/notification.mp3');
        audio.play().catch((err) => console.error(`[${new Date().toISOString()}] Audio playback failed:`, err));
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

  // Status Options
  const statusOptions = useMemo(
    () => [
      { value: '', label: t.status.all },
      { value: ReturnStatus.PENDING, label: t.status.pending },
      { value: ReturnStatus.APPROVED, label: t.status.approved },
      { value: ReturnStatus.REJECTED, label: t.status.rejected },
    ],
    [t]
  );

  // Reason Options
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

  // Product Options
  const productOptions = useMemo(
    () => [
      { value: '', label: t.selectProduct },
      ...availableItems.map((item) => ({
        value: item.productId,
        label: `${item.productName} (${t.quantity}: ${item.available} ${item.unit})`,
      })),
    ],
    [availableItems, t]
  );

  // Update available items
  useEffect(() => {
    if (inventoryData) {
      setAvailableItems(inventoryData);
    }
  }, [inventoryData]);

  // Filtered and Paginated Returns
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

  // Handlers
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
    },
    [inventoryData]
  );

  const removeItemFromForm = useCallback((index: number) => {
    dispatchReturnForm({ type: 'REMOVE_ITEM', payload: index });
  }, []);

  const validateReturnForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!user?.branchId) {
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
      if (!item.reasonEn) {
        errors[`item_${index}_reasonEn`] = t.errors.required.replace('{field}', t.reason);
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

  const createReturnMutation = useMutation<{ returnId: string }, Error, void>({
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
      return { returnId: response?.returnRequest?._id || crypto.randomUUID() };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      setIsCreateModalOpen(false);
      dispatchReturnForm({ type: 'RESET' });
      setReturnErrors({});
      toast.success(t.createSuccess, { position: isRtl ? 'top-right' : 'top-left' });
      socket?.emit('returnCreated', {
        branchId: user?.branchId,
        returnId: data.returnId,
        returnNumber: `RET-${data.returnId.slice(-6)}`,
        status: 'pending_approval',
        eventId: crypto.randomUUID(),
      });
    },
    onError: (err) => {
      let errorMessage = err.message || t.errors.createReturn;
      if (err.message.includes('الفرع غير موجود') || err.message.includes('Branch not found')) {
        errorMessage = t.errors.noBranch;
      } else if (err.message.includes('الكمية غير كافية') || err.message.includes('Insufficient quantity')) {
        errorMessage = t.errors.insufficientQuantity;
      } else if (err.message.includes('بيانات العنصر غير صالحة') || err.message.includes('Invalid item data')) {
        errorMessage = t.errors.invalidForm;
      } else if (err.message.includes('المنتج غير موجود') || err.message.includes('Product not found')) {
        errorMessage = t.errors.productNotFound;
      }
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
      setReturnErrors({ form: errorMessage });
    },
  });

  // Export Functions
  const exportToExcel = useCallback(() => {
    const exportData = filteredReturns.map((ret) => ({
      [t.returnNumber]: ret.returnNumber,
      [t.statusLabel]: t.status[ret.status as keyof typeof t.status] || ret.status,
      [t.date]: new Date(ret.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US'),
      [t.itemsCount]: ret.items.length,
      [t.branch]: ret.branch?.displayName || t.branch,
      [t.notesLabel]: ret.notes || t.noNotes,
      [t.reviewNotes]: ret.reviewNotes || t.noNotes,
    }));
    const ws = XLSX.utils.json_to_sheet(isRtl ? exportData.map((row) => Object.fromEntries(Object.entries(row).reverse())) : exportData);
    ws['!cols'] = Object.keys(exportData[0] || {}).map(() => ({ wpx: 120 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Returns');
    XLSX.writeFile(wb, `Returns_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(t.exportSuccess, { position: isRtl ? 'top-right' : 'top-left' });
  }, [filteredReturns, isRtl, t]);

  const exportToPDF = useCallback(() => {
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFont('Amiri', 'normal');
      const headers = [t.returnNumber, t.statusLabel, t.date, t.itemsCount, t.branch, t.notesLabel, t.reviewNotes];
      const data = filteredReturns.map((ret) => [
        ret.returnNumber,
        t.status[ret.status as keyof typeof t.status] || ret.status,
        new Date(ret.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US'),
        ret.items.length.toString(),
        ret.branch?.displayName || t.branch,
        ret.notes || t.noNotes,
        ret.reviewNotes || t.noNotes,
      ]);
      const finalHeaders = isRtl ? headers.reverse() : headers;
      const finalData = isRtl ? data.map((row) => row.reverse()) : data;
      autoTable(doc, {
        head: [finalHeaders],
        body: finalData,
        theme: 'grid',
        headStyles: { fillColor: [255, 193, 7], textColor: 0, fontSize: 10, halign: isRtl ? 'right' : 'left', font: 'Amiri' },
        bodyStyles: { fontSize: 9, halign: isRtl ? 'right' : 'left', cellPadding: 4, font: 'Amiri' },
        columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 30 } },
        margin: { top: 20 },
      });
      doc.save(`Returns_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success(t.pdfExportSuccess, { position: isRtl ? 'top-right' : 'top-left' });
    } catch (err) {
      console.error(`[${new Date().toISOString()}] PDF export error:`, err);
      toast.error(t.errors.pdfExport, { position: isRtl ? 'top-right' : 'top-left' });
    }
  }, [filteredReturns, isRtl, t]);

  // ReturnCard Component
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
          <div className="p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-amber-200">
            <div className="flex flex-col gap-4">
              <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${isRtl ? 'sm:flex-row-reverse' : ''}`}>
                <h3 className="text-lg font-bold text-gray-900">{t.returnNumber}: {ret.returnNumber}</h3>
                <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
                  <StatusIcon className="w-5 h-5" />
                  {statusInfo.label}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500">{t.date}</p>
                  <p className="text-sm font-medium text-gray-900">{new Date(ret.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t.itemsCount}</p>
                  <p className="text-sm font-medium text-gray-900">{ret.items.length} {t.items}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t.branch}</p>
                  <p className="text-sm font-medium text-gray-900">{ret.branch?.displayName || t.branch}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {ret.items.map((item, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-md border border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{item.product.name}</p>
                    <p className="text-sm text-gray-600">{t.quantity}: {item.quantity}</p>
                    <p className="text-sm text-gray-600">{t.unit}: {isRtl ? item.product.unit : item.product.unitEn}</p>
                    <p className="text-sm text-gray-600">{t.department}: {item.product.department?.name || 'N/A'}</p>
                    <p className="text-sm text-gray-600">{t.reason}: {isRtl ? item.reason : item.reasonEn}</p>
                  </div>
                ))}
              </div>
              {ret.notes && (
                <div className="p-3 bg-amber-50 rounded-md border border-amber-100">
                  <p className="text-sm text-amber-800">
                    <strong>{t.notesLabel}:</strong> {ret.notes}
                  </p>
                </div>
              )}
              {ret.reviewNotes && (
                <div className="p-3 bg-blue-50 rounded-md border border-blue-100">
                  <p className="text-sm text-blue-800">
                    <strong>{t.reviewNotes}:</strong> {ret.reviewNotes}
                  </p>
                </div>
              )}
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setSelectedReturn(ret);
                    setIsViewModalOpen(true);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors duration-200"
                  aria-label={t.viewReturn}
                >
                  <Eye className="w-4 h-4 inline mr-2" />
                  {t.view}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      );
    },
    [t, isRtl]
  );

  return (
    <div
      className="container mx-auto px-4 py-8 min-h-screen bg-gradient-to-br from-amber-50 to-gray-50"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center gap-3">
          <Package className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
            <p className="text-gray-600 text-sm">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2 shadow-sm"
            aria-label={t.createReturn}
          >
            <Plus className="w-4 h-4" />
            {t.createReturn}
          </button>
          <button
            onClick={exportToExcel}
            className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2 shadow-sm"
            aria-label={t.exportExcel}
          >
            <Download className="w-4 h-4" />
            {t.exportExcel}
          </button>
          <button
            onClick={exportToPDF}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2 shadow-sm"
            aria-label={t.exportPdf}
          >
            <Download className="w-4 h-4" />
            {t.exportPdf}
          </button>
        </div>
      </div>

      {returnsError && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm font-medium">{returnsError.message}</span>
          <button
            onClick={() => refetchReturns()}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200"
            aria-label={t.common.retry}
          >
            {t.common.retry}
          </button>
        </motion.div>
      )}

      <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="lg:col-span-1">
            <ProductSearchInput
              value={searchInput}
              onChange={handleSearchChange}
              placeholder={t.searchPlaceholder}
              ariaLabel={t.searchPlaceholder}
              className="w-full"
            />
          </div>
          <div className="lg:col-span-1">
            <ProductDropdown
              value={filterStatus}
              onChange={(value) => {
                setFilterStatus(value as ReturnStatus | '');
                setCurrentPage(1);
              }}
              options={statusOptions}
              ariaLabel={t.filterStatus}
              className="w-full"
            />
          </div>
        </div>
        <div className="mt-4 text-center text-sm text-gray-600 font-medium">
          {isRtl ? `عدد الطلبات: ${filteredReturns.length}` : `Returns Count: ${filteredReturns.length}`}
        </div>
      </div>

      {returnsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-5 bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="space-y-3 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                </div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                <div className="mt-4 flex justify-end">
                  <div className="h-8 bg-gray-200 rounded-lg w-24"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : paginatedReturns.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-sm font-medium">{t.noReturns}</p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200"
            aria-label={t.createReturn}
          >
            {t.createReturn}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {paginatedReturns.map((ret) => (
              <ReturnCard key={ret._id} ret={ret} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="mt-6">
        {totalPages > 1 && (
          <div className={`flex items-center justify-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <button
              onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
              disabled={currentPage === 1}
              aria-label={t.pagination.previous}
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
              aria-label={t.pagination.next}
            >
              {t.pagination.next}
            </button>
          </div>
        )}
      </div>

      {/* Create Return Modal */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isCreateModalOpen ? 1 : 0 }}
        className={`fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 ${isCreateModalOpen ? '' : 'pointer-events-none'}`}
        role="dialog"
        aria-modal="true"
        aria-label={t.createReturn}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: isCreateModalOpen ? 1 : 0.95, y: isCreateModalOpen ? 0 : 20 }}
          className="bg-white p-6 rounded-xl shadow-2xl max-w-[95vw] sm:max-w-lg w-full"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">{t.createReturn}</h2>
            <button
              onClick={() => {
                setIsCreateModalOpen(false);
                dispatchReturnForm({ type: 'RESET' });
                setReturnErrors({});
              }}
              className="p-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors duration-200"
              aria-label={t.common.cancel}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.notesLabel}</label>
              <textarea
                value={returnForm.notes}
                onChange={(e) => dispatchReturnForm({ type: 'SET_NOTES', payload: e.target.value })}
                placeholder={t.notesPlaceholder}
                className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm resize-none"
                rows={3}
                aria-label={t.notesLabel}
              />
              {returnErrors.form && <p className="text-red-600 text-xs mt-1">{returnErrors.form}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.items}</label>
              {returnForm.items.map((item, index) => (
                <div key={index} className="flex flex-col gap-4 mb-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <ProductDropdown
                    value={item.productId}
                    onChange={(value) => handleProductChange(index, value)}
                    options={productOptions}
                    ariaLabel={`${t.items} ${index + 1}`}
                    placeholder={t.selectProduct}
                    className="w-full"
                  />
                  {returnErrors[`item_${index}_productId`] && (
                    <p className="text-red-600 text-xs">{returnErrors[`item_${index}_productId`]}</p>
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
                        ariaLabel={`${t.reason} ${index + 1}`}
                        className="w-full"
                      />
                      {returnErrors[`item_${index}_reason`] && (
                        <p className="text-red-600 text-xs mt-1">{returnErrors[`item_${index}_reason`]}</p>
                      )}
                      {returnErrors[`item_${index}_reasonEn`] && (
                        <p className="text-red-600 text-xs mt-1">{returnErrors[`item_${index}_reasonEn`]}</p>
                      )}
                    </div>
                    {returnForm.items.length > 1 && (
                      <button
                        onClick={() => removeItemFromForm(index)}
                        className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors duration-200 mt-6"
                        aria-label={t.removeItem}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button
                onClick={addItemToForm}
                className="flex items-center gap-2 text-amber-600 hover:text-amber-800 text-sm font-medium"
                aria-label={t.addItem}
                disabled={availableItems.length === 0}
              >
                <Plus className="w-4 h-4" />
                {t.addItem}
              </button>
              {returnErrors.items && <p className="text-red-600 text-xs">{returnErrors.items}</p>}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  dispatchReturnForm({ type: 'RESET' });
                  setReturnErrors({});
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors duration-200"
                aria-label={t.common.cancel}
              >
                {t.common.cancel}
              </button>
              <button
                onClick={() => createReturnMutation.mutate()}
                disabled={createReturnMutation.isLoading}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
                aria-label={createReturnMutation.isLoading ? t.common.submitting : t.submitReturn}
              >
                {createReturnMutation.isLoading ? t.common.submitting : t.submitReturn}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* View Return Modal */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isViewModalOpen ? 1 : 0 }}
        className={`fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 ${isViewModalOpen ? '' : 'pointer-events-none'}`}
        role="dialog"
        aria-modal="true"
        aria-label={t.viewReturn}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: isViewModalOpen ? 1 : 0.95, y: isViewModalOpen ? 0 : 20 }}
          className="bg-white p-6 rounded-xl shadow-2xl max-w-[95vw] sm:max-w-lg w-full"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">{t.viewReturn}: {selectedReturn?.returnNumber}</h2>
            <button
              onClick={() => setIsViewModalOpen(false)}
              className="p-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors duration-200"
              aria-label={t.common.close}
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
                    <p className="text-sm font-medium text-gray-900">{item.product.name}</p>
                    <p className="text-sm text-gray-600">{t.quantity}: {item.quantity}</p>
                    <p className="text-sm text-gray-600">{t.unit}: {isRtl ? item.product.unit : item.product.unitEn}</p>
                    <p className="text-sm text-gray-600">{t.department}: {item.product.department?.name || 'N/A'}</p>
                    <p className="text-sm text-gray-600">{t.reason}: {isRtl ? item.reason : item.reasonEn}</p>
                  </div>
                ))}
              </div>
              {selectedReturn.notes && (
                <div className="p-3 bg-amber-50 rounded-md border border-amber-100">
                  <p className="text-sm text-amber-800">
                    <strong>{t.notesLabel}:</strong> {selectedReturn.notes}
                  </p>
                </div>
              )}
              {selectedReturn.reviewNotes && (
                <div className="p-3 bg-blue-50 rounded-md border border-blue-100">
                  <p className="text-sm text-blue-800">
                    <strong>{t.reviewNotes}:</strong> {selectedReturn.reviewNotes}
                  </p>
                </div>
              )}
              <div className="flex justify-end">
                <button
                  onClick={() => setIsViewModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors duration-200"
                  aria-label={t.common.close}
                >
                  {t.common.close}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default BranchReturns;
