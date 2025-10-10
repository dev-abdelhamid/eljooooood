import React, { useState, useMemo, useCallback, useEffect, useReducer } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Eye, Clock, Check, AlertCircle, MinusCircle, Plus, X } from 'lucide-react';
import { returnsAPI, inventoryAPI } from '../services/api';
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
  }>;
  status: ReturnStatus;
  createdAt: string;
  notes: string;
  reviewNotes: string;
  orders: string[];
  createdByName: string;
  reviewedByName: string | null;
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
  const t = translations[language];

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
        aria-label={t.quantity}
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
        aria-label={t.quantity}
      />
      <button
        onClick={onIncrement}
        className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors duration-200 flex items-center justify-center"
        aria-label={t.quantity}
        disabled={max !== undefined && value >= max}
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
};

const reasonOptions = [
  { valueAr: ReturnReason.DAMAGED_AR, valueEn: ReturnReason.DAMAGED_EN, labelAr: translations.ar.damaged, labelEn: translations.en.damaged },
  { valueAr: ReturnReason.WRONG_ITEM_AR, valueEn: ReturnReason.WRONG_ITEM_EN, labelAr: translations.ar.wrongItem, labelEn: translations.en.wrongItem },
  { valueAr: ReturnReason.EXCESS_QUANTITY_AR, valueEn: ReturnReason.EXCESS_QUANTITY_EN, labelAr: translations.ar.excessQuantity, labelEn: translations.en.excessQuantity },
  { valueAr: ReturnReason.OTHER_AR, valueEn: ReturnReason.OTHER_EN, labelAr: translations.ar.other, labelEn: translations.en.other },
];

const formReducer = (state: ReturnFormState, action: { type: string; payload?: any }): ReturnFormState => {
  switch (action.type) {
    case 'SET_NOTES':
      return { ...state, notes: action.payload };
    case 'ADD_ITEM':
      return { ...state, items: [...state.items, action.payload] };
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter((_, index) => index !== action.payload) };
    case 'UPDATE_ITEM':
      return {
        ...state,
        items: state.items.map((item, index) =>
          index === action.payload.index ? { ...item, ...action.payload.item } : item
        ),
      };
    case 'SET_ORDERS':
      return { ...state, orders: action.payload };
    case 'RESET':
      return { notes: '', items: [], orders: [] };
    default:
      return state;
  }
};

const BranchReturns: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[language];
  const { user } = useAuth();
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewReturn, setViewReturn] = useState<Return | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const limit = 10;

  const [formState, dispatch] = useReducer(formReducer, { notes: '', items: [], orders: [] });

  const branchId = user?.role === 'branch' ? user.branchId : '';

  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => returnsAPI.getBranches(),
    enabled: user?.role === 'admin' || user?.role === 'production',
  });

  const { data: returnsData, isLoading, error } = useQuery({
    queryKey: ['returns', branchId, statusFilter, search, page],
    queryFn: () =>
      returnsAPI.getAll({
        branch: branchId,
        status: statusFilter,
        search,
        page,
        limit,
      }),
  });

  const { data: availableStock, refetch: refetchStock } = useQuery({
    queryKey: ['availableStock', branchId],
    queryFn: () => inventoryAPI.getByBranch(branchId),
    enabled: !!branchId && isModalOpen,
  });

  const createReturnMutation = useMutation({
    mutationFn: (data: ReturnFormState) =>
      returnsAPI.createReturn({
        branchId,
        items: data.items.map((item) => ({
          product: item.productId,
          quantity: item.quantity,
          reason: item.reason,
          reasonEn: item.reasonEn,
        })),
        notes: data.notes,
        orders: data.orders,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      dispatch({ type: 'RESET' });
      setIsModalOpen(false);
      toast.success(t.createSuccess, { position: isRtl ? 'top-right' : 'top-left' });
    },
    onError: (error: any) => {
      toast.error(error.message || t.errors.createReturn, { position: isRtl ? 'top-right' : 'top-left' });
    },
  });

  useEffect(() => {
    if (socket) {
      socket.on('connect', () => {
        console.log(`[${new Date().toISOString()}] Socket connected`);
        toast.info(t.socket.connected, { position: isRtl ? 'top-right' : 'top-left' });
      });

      socket.on('returnCreated', (data: { returnId: string; branchId: string; returnNumber: string }) => {
        if (data.branchId === branchId || user?.role === 'admin' || user?.role === 'production') {
          queryClient.invalidateQueries({ queryKey: ['returns'] });
          toast.info(t.newReturnNotification.replace('{returnNumber}', data.returnNumber), {
            position: isRtl ? 'top-right' : 'top-left',
          });
        }
      });

      socket.on('returnStatusUpdated', (data: { returnId: string; branchId: string; status: string }) => {
        if (data.branchId === branchId || user?.role === 'admin' || user?.role === 'production') {
          queryClient.invalidateQueries({ queryKey: ['returns'] });
          toast.info(
            t.socket.returnStatusUpdated.replace('{status}', t.status[data.status as keyof typeof t.status] || data.status),
            { position: isRtl ? 'top-right' : 'top-left' }
          );
        }
      });

      return () => {
        socket.off('connect');
        socket.off('returnCreated');
        socket.off('returnStatusUpdated');
      };
    }
  }, [socket, branchId, user?.role, queryClient, t, isRtl]);

  const handleAddItem = () => {
    dispatch({
      type: 'ADD_ITEM',
      payload: { productId: '', quantity: 1, reason: '', reasonEn: '', maxQuantity: 0 },
    });
  };

  const handleRemoveItem = (index: number) => {
    dispatch({ type: 'REMOVE_ITEM', payload: index });
  };

  const handleSubmit = () => {
    if (!formState.items.length) {
      toast.error(t.errors.noItemSelected, { position: isRtl ? 'top-right' : 'top-left' });
      return;
    }
    for (const [index, item] of formState.items.entries()) {
      if (!item.productId) {
        toast.error(t.errors.required.replace('{field}', t.product), { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      if (!item.reason || !item.reasonEn) {
        toast.error(t.errors.required.replace('{field}', t.reason), { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
      if (item.quantity > item.maxQuantity) {
        toast.error(t.errors.invalidQuantityMax.replace('{max}', item.maxQuantity.toString()), {
          position: isRtl ? 'top-right' : 'top-left',
        });
        return;
      }
      const reasonOption = reasonOptions.find((opt) => opt.valueAr === item.reason);
      if (reasonOption && reasonOption.valueEn !== item.reasonEn) {
        toast.error(t.errors.invalidReasonPair, { position: isRtl ? 'top-right' : 'top-left' });
        return;
      }
    }
    createReturnMutation.mutate(formState);
  };

  const handleViewReturn = async (returnId: string) => {
    try {
      const response = await returnsAPI.getReturnById(returnId);
      setViewReturn(response);
    } catch (error: any) {
      toast.error(error.message || t.errors.fetchReturns, { position: isRtl ? 'top-right' : 'top-left' });
    }
  };

  const statusIcon = (status: ReturnStatus) => {
    switch (status) {
      case ReturnStatus.PENDING:
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case ReturnStatus.APPROVED:
        return <Check className="w-5 h-5 text-green-500" />;
      case ReturnStatus.REJECTED:
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className={`container mx-auto p-4 ${isRtl ? 'font-arabic' : 'font-sans'}`}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="text-gray-600">{t.subtitle}</p>
        </div>
        {user?.role === 'branch' && (
          <button
            onClick={() => {
              setIsModalOpen(true);
              refetchStock();
            }}
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
          >
            <Package className="w-5 h-5" />
            {t.createReturn}
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder={t.searchPlaceholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-1/2 border border-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-1/4 border border-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        >
          <option value="">{t.status.all}</option>
          <option value={ReturnStatus.PENDING}>{t.status.pending}</option>
          <option value={ReturnStatus.APPROVED}>{t.status.approved}</option>
          <option value={ReturnStatus.REJECTED}>{t.status.rejected}</option>
        </select>
      </div>

      {isLoading && (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500"></div>
        </div>
      )}
      {error && (
        <div className="text-red-500 text-center">{t.errors.fetchReturns}</div>
      )}
      {!isLoading && !error && returnsData?.returns?.length === 0 && (
        <div className="text-center text-gray-500">{t.noReturns}</div>
      )}

      <AnimatePresence>
        {returnsData?.returns?.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {returnsData.returns.map((ret: Return) => (
              <motion.div
                key={ret._id}
                className="bg-white shadow-md rounded-lg p-4 hover:shadow-lg transition-shadow duration-200"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold">{t.returnNumber}: {ret.returnNumber}</h3>
                  <div className="flex items-center gap-2">
                    {statusIcon(ret.status)}
                    <span>{t.status[ret.status as keyof typeof t.status]}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600">{t.date}: {formatDate(ret.createdAt)}</p>
                <p className="text-sm text-gray-600">{t.itemsCount}: {ret.items.length}</p>
                <p className="text-sm text-gray-600">{t.branch}: {ret.branch?.displayName || t.noNotes}</p>
                <p className="text-sm text-gray-600">{t.notesLabel}: {ret.notes || t.noNotes}</p>
                {ret.reviewNotes && (
                  <p className="text-sm text-gray-600">{t.reviewNotes}: {ret.reviewNotes}</p>
                )}
                <button
                  onClick={() => handleViewReturn(ret._id)}
                  className="mt-2 text-amber-500 hover:text-amber-600 flex items-center gap-1"
                >
                  <Eye className="w-4 h-4" />
                  {t.view}
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {returnsData?.totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <button
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50"
          >
            {t.pagination.previous}
          </button>
          <span>{t.pagination.page.replace('{current}', page.toString()).replace('{total}', returnsData.totalPages.toString())}</span>
          <button
            onClick={() => setPage((prev) => Math.min(prev + 1, returnsData.totalPages))}
            disabled={page === returnsData.totalPages}
            className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50"
          >
            {t.pagination.next}
          </button>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{t.createReturn}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              {formState.items.map((item, index) => (
                <div key={index} className="flex flex-col gap-4 border-b pb-4">
                  <div className="flex items-center gap-4">
                    <ProductSearchInput
                      value={item.productId}
                      onChange={(productId) => {
                        const product = availableStock?.find((p: AvailableItem) => p.productId === productId);
                        dispatch({
                          type: 'UPDATE_ITEM',
                          payload: {
                            index,
                            item: {
                              productId,
                              maxQuantity: product?.stock || 0,
                            },
                          },
                        });
                      }}
                      branchId={branchId}
                      placeholder={t.selectProduct}
                    />
                    <button
                      onClick={() => handleRemoveItem(index)}
                      className="text-red-500 hover:text-red-600"
                      aria-label={t.removeItem}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-4">
                    <QuantityInput
                      value={item.quantity}
                      onChange={(value) =>
                        dispatch({
                          type: 'UPDATE_ITEM',
                          payload: { index, item: { quantity: parseInt(value) } },
                        })
                      }
                      onIncrement={() =>
                        dispatch({
                          type: 'UPDATE_ITEM',
                          payload: { index, item: { quantity: item.quantity + 1 } },
                        })
                      }
                      onDecrement={() =>
                        dispatch({
                          type: 'UPDATE_ITEM',
                          payload: { index, item: { quantity: Math.max(item.quantity - 1, 1) } },
                        })
                      }
                      max={item.maxQuantity}
                    />
                    <select
                      value={item.reason}
                      onChange={(e) => {
                        const selectedReason = reasonOptions.find((opt) => opt.valueAr === e.target.value);
                        dispatch({
                          type: 'UPDATE_ITEM',
                          payload: {
                            index,
                            item: {
                              reason: e.target.value,
                              reasonEn: selectedReason?.valueEn || '',
                            },
                          },
                        });
                      }}
                      className="w-full border border-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    >
                      <option value="">{t.selectReason}</option>
                      {reasonOptions.map((opt) => (
                        <option key={opt.valueAr} value={opt.valueAr}>
                          {isRtl ? opt.labelAr : opt.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              <button
                onClick={handleAddItem}
                className="text-amber-500 hover:text-amber-600 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                {t.addItem}
              </button>
              <textarea
                value={formState.notes}
                onChange={(e) => dispatch({ type: 'SET_NOTES', payload: e.target.value })}
                placeholder={t.notesPlaceholder}
                className="w-full border border-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                rows={4}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 rounded-lg"
                >
                  {t.common.cancel}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={createReturnMutation.isLoading}
                  className="px-4 py-2 bg-amber-500 text-white rounded-lg disabled:opacity-50"
                >
                  {createReturnMutation.isLoading ? t.common.submitting : t.submitReturn}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {viewReturn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{t.viewReturn}</h2>
              <button onClick={() => setViewReturn(null)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <p><strong>{t.returnNumber}:</strong> {viewReturn.returnNumber}</p>
              <p><strong>{t.statusLabel}:</strong> {t.status[viewReturn.status as keyof typeof t.status]}</p>
              <p><strong>{t.date}:</strong> {formatDate(viewReturn.createdAt)}</p>
              <p><strong>{t.branch}:</strong> {viewReturn.branch?.displayName || t.noNotes}</p>
              <p><strong>{t.notesLabel}:</strong> {viewReturn.notes || t.noNotes}</p>
              {viewReturn.reviewNotes && (
                <p><strong>{t.reviewNotes}:</strong> {viewReturn.reviewNotes}</p>
              )}
              <h3 className="font-semibold">{t.items}</h3>
              <div className="space-y-2">
                {viewReturn.items.map((item) => (
                  <div key={item.itemId} className="border-b pb-2">
                    <p><strong>{t.product}:</strong> {item.product.displayName}</p>
                    <p><strong>{t.quantity}:</strong> {item.quantity}</p>
                    <p><strong>{t.unit}:</strong> {item.product.displayUnit}</p>
                    <p><strong>{t.department}:</strong> {item.product.department?.displayName || t.noNotes}</p>
                    <p><strong>{t.reason}:</strong> {isRtl ? item.reason : item.reasonEn}</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setViewReturn(null)}
                  className="px-4 py-2 bg-gray-200 rounded-lg"
                >
                  {t.common.close}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default BranchReturns;