import React, { useState, useMemo, useCallback, useEffect, useReducer } from 'react';
import { Package, AlertCircle, Search, RefreshCw, History, Edit, X, Plus } from 'lucide-react';
import { debounce } from 'lodash';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

// قاموس الترجمة
const translations = {
  'common.all_statuses': { ar: 'جميع الحالات', en: 'All Statuses' },
  'common.search': { ar: 'بحث', en: 'Search' },
  'common.retry': { ar: 'إعادة المحاولة', en: 'Retry' },
  'common.cancel': { ar: 'إلغاء', en: 'Cancel' },
  'common.submit': { ar: 'إرسال', en: 'Submit' },
  'common.submitting': { ar: 'جاري الإرسال...', en: 'Submitting...' },
  'common.saving': { ar: 'جاري الحفظ...', en: 'Saving...' },
  'inventory.title': { ar: 'إدارة المخزون', en: 'Inventory Management' },
  'inventory.description': { ar: 'إدارة مخزون الفرع بكفاءة', en: 'Manage branch inventory efficiently' },
  'inventory.low_stock': { ar: 'مخزون منخفض', en: 'Low Stock' },
  'inventory.normal': { ar: 'مخزون طبيعي', en: 'Normal Stock' },
  'inventory.full': { ar: 'مخزون ممتلئ', en: 'Full Stock' },
  'inventory.no_items': { ar: 'لا توجد عناصر في المخزون', en: 'No items in inventory' },
  'inventory.min_stock': { ar: 'الحد الأدنى للمخزون', en: 'Minimum Stock' },
  'inventory.max_stock': { ar: 'الحد الأقصى للمخزون', en: 'Maximum Stock' },
  'inventory.edit_stock_limits': { ar: 'تعديل حدود المخزون', en: 'Edit Stock Limits' },
  'inventory.update_success': { ar: 'تم تحديث المخزون بنجاح', en: 'Inventory updated successfully' },
  'history.title': { ar: 'سجل المخزون', en: 'Inventory History' },
  'history.no_history': { ar: 'لا يوجد سجل متاح', en: 'No history available' },
  'history.date': { ar: 'التاريخ', en: 'Date' },
  'history.action': { ar: 'الإجراء', en: 'Action' },
  'history.quantity': { ar: 'الكمية', en: 'Quantity' },
  'history.reference': { ar: 'المرجع', en: 'Reference' },
  'history.created_by': { ar: 'تم الإنشاء بواسطة', en: 'Created By' },
  'returns.title': { ar: 'طلبات الإرجاع', en: 'Return Requests' },
  'returns.create': { ar: 'إنشاء طلب إرجاع', en: 'Create Return Request' },
  'returns.no_returns': { ar: 'لا توجد طلبات إرجاع', en: 'No return requests' },
  'returns.pending_approval': { ar: 'في انتظار الموافقة', en: 'Pending Approval' },
  'returns.approved': { ar: 'تمت الموافقة', en: 'Approved' },
  'returns.rejected': { ar: 'مرفوض', en: 'Rejected' },
  'returns.reason': { ar: 'السبب', en: 'Reason' },
  'returns.select_reason': { ar: 'اختر السبب', en: 'Select Reason' },
  'returns.damaged': { ar: 'تالف', en: 'Damaged' },
  'returns.wrong_item': { ar: 'منتج خاطئ', en: 'Wrong Item' },
  'returns.excess_quantity': { ar: 'كمية زائدة', en: 'Excess Quantity' },
  'returns.other': { ar: 'أخرى', en: 'Other' },
  'returns.notes': { ar: 'ملاحظات', en: 'Notes' },
  'returns.notes_placeholder': { ar: 'أدخل ملاحظات إضافية (اختياري)', en: 'Enter additional notes (optional)' },
  'returns.items': { ar: 'العناصر', en: 'Items' },
  'returns.add_item': { ar: 'إضافة عنصر', en: 'Add Item' },
  'returns.create_success': { ar: 'تم إنشاء طلب الإرجاع بنجاح', en: 'Return request created successfully' },
  'returns.view_details': { ar: 'عرض التفاصيل', en: 'View Details' },
  'returns.update_success': { ar: 'تم تحديث حالة الإرجاع بنجاح', en: 'Return status updated successfully' },
  'returns.approve': { ar: 'الموافقة', en: 'Approve' },
  'returns.reject': { ar: 'رفض', en: 'Reject' },
  'returns.details': { ar: 'تفاصيل الإرجاع', en: 'Return Details' },
  'returns.return_number': { ar: 'رقم الإرجاع', en: 'Return Number' },
  'returns.branch': { ar: 'الفرع', en: 'Branch' },
  'returns.created_by': { ar: 'تم الإنشاء بواسطة', en: 'Created By' },
  'returns.reviewed_by': { ar: 'تمت المراجعة بواسطة', en: 'Reviewed By' },
  'products.title': { ar: 'المنتج', en: 'Product' },
  'products.code': { ar: 'كود المنتج', en: 'Product Code' },
  'products.unit': { ar: 'الوحدة', en: 'Unit' },
  'products.select': { ar: 'اختر منتج', en: 'Select Product' },
  'products.unknown': { ar: 'غير معروف', en: 'Unknown' },
  'products.unit_unknown': { ar: 'وحدة غير معروفة', en: 'Unknown Unit' },
  'departments.title': { ar: 'القسم', en: 'Department' },
  'departments.unknown': { ar: 'قسم غير معروف', en: 'Unknown Department' },
  'errors.no_branch': { ar: 'لم يتم العثور على معرف الفرع', en: 'Branch ID not found' },
  'errors.fetch_inventory': { ar: 'فشل في جلب بيانات المخزون', en: 'Failed to fetch inventory data' },
  'errors.fetch_history': { ar: 'فشل في جلب سجل المخزون', en: 'Failed to fetch inventory history' },
  'errors.fetch_returns': { ar: 'فشل في جلب طلبات الإرجاع', en: 'Failed to fetch return requests' },
  'errors.create_return': { ar: 'فشل في إنشاء طلب الإرجاع', en: 'Failed to create return request' },
  'errors.update_inventory': { ar: 'فشل في تحديث المخزون', en: 'Failed to update inventory' },
  'errors.update_return': { ar: 'فشل في تحديث حالة الإرجاع', en: 'Failed to update return status' },
  'errors.no_item_selected': { ar: 'لم يتم اختيار عنصر', en: 'No item selected' },
  'errors.required': { ar: '{field} مطلوب', en: '{field} is required' },
  'errors.non_negative': { ar: '{field} يجب ألا يكون سالبًا', en: '{field} must not be negative' },
  'errors.max_greater_min': { ar: 'الحد الأقصى يجب أن يكون أكبر من الحد الأدنى', en: 'Maximum must be greater than minimum' },
  'errors.invalid_quantity_max': { ar: 'الكمية غير صالحة، الحد الأقصى {max}', en: 'Invalid quantity, maximum {max}' },
  'errors.invalid_form': { ar: 'النموذج غير صالح، يرجى التحقق من الحقول', en: 'Invalid form, please check the fields' },
  'common.available': { ar: 'متاح', en: 'Available' },
  'notifications.return_status_updated': {
    ar: 'تم تحديث حالة الإرجاع إلى {status} للفرع {branchName}',
    en: 'Return status updated to {status} for branch {branchName}',
  },
};

// واجهات TypeScript
interface InventoryItem {
  _id: string;
  product: { _id: string; name: string; nameEn: string; code: string; unit: string; unitEn: string; department: { name: string; nameEn: string } | null } | null;
  currentStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  status?: string;
}

interface InventoryHistoryItem {
  _id: string;
  product: { name: string; nameEn: string } | null;
  action: string;
  quantity: number;
  reference: string;
  createdBy: { _id: string; username: string };
  createdAt: string;
}

interface Return {
  _id: string;
  returnNumber: string;
  branchId: string;
  branchName: string;
  items: Array<{
    product: { _id: string; name: string; nameEn: string; unit: string; unitEn: string; department: { name: string; nameEn: string } };
    productName: string;
    quantity: number;
    reason: string;
    unit: string;
    departmentName: string;
  }>;
  status: 'pending_approval' | 'approved' | 'rejected';
  reason: string;
  notes?: string;
  createdAt: string;
  createdBy: { _id: string; username: string };
  createdByName: string;
  reviewedBy?: { _id: string; username: string };
  reviewedByName?: string;
}

interface ReturnItem {
  productId: string;
  quantity: number;
  reason: string;
  maxQuantity: number;
}

interface EditForm {
  minStockLevel: number;
  maxStockLevel: number;
}

interface AvailableItem {
  productId: string;
  productName: string;
  available: number;
  unit: string;
  departmentName: string;
  stock: number;
}

interface ReturnFormState {
  reason: string;
  notes: string;
  items: ReturnItem[];
}

type ReturnFormAction =
  | { type: 'SET_REASON'; payload: string }
  | { type: 'SET_NOTES'; payload: string }
  | { type: 'ADD_ITEM'; payload: ReturnItem }
  | { type: 'UPDATE_ITEM'; payload: { index: number; field: keyof ReturnItem; value: string | number } }
  | { type: 'REMOVE_ITEM'; payload: number }
  | { type: 'RESET' };

// Reducer لنموذج الإرجاع
const returnFormReducer = (state: ReturnFormState, action: ReturnFormAction): ReturnFormState => {
  switch (action.type) {
    case 'SET_REASON': return { ...state, reason: action.payload };
    case 'SET_NOTES': return { ...state, notes: action.payload };
    case 'ADD_ITEM': return { ...state, items: [...state.items, action.payload] };
    case 'UPDATE_ITEM': {
      const newItems = [...state.items];
      newItems[action.payload.index] = { ...newItems[action.payload.index], [action.payload.field]: action.payload.value };
      return { ...state, items: newItems };
    }
    case 'REMOVE_ITEM': return { ...state, items: state.items.filter((_, i) => i !== action.payload) };
    case 'RESET': return { reason: '', notes: '', items: [] };
    default: return state;
  }
};

// مكونات مخصصة
const CustomCard: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <div className={`bg-white shadow-md rounded-lg ${className}`}>{children}</div>
);

const CustomInput: React.FC<{
  label?: string;
  type?: string;
  min?: number;
  max?: number;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  className?: string;
  placeholder?: string;
}> = ({ label, type = 'text', min, max, value, onChange, error, className, placeholder }) => (
  <div className="flex flex-col">
    {label && <label className="text-sm font-medium text-gray-700 mb-1">{label}</label>}
    <input
      type={type}
      min={min}
      max={max}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 ${error ? 'border-red-500' : ''} ${className}`}
    />
    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
  </div>
);

const CustomButton: React.FC<{
  variant?: 'primary' | 'secondary' | 'destructive';
  size?: 'sm' | 'md';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ variant = 'primary', size = 'md', onClick, disabled, className, children }) => {
  const baseClass = `px-4 py-2 rounded-lg transition-colors duration-200 text-sm font-medium ${
    size === 'sm' ? 'text-xs px-3 py-1' : ''
  }`;
  const variantClass =
    variant === 'secondary'
      ? 'bg-gray-100 hover:bg-gray-200 text-gray-800'
      : variant === 'destructive'
      ? 'text-red-600 hover:text-red-800'
      : 'bg-amber-600 text-white hover:bg-amber-700';
  const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : '';
  return (
    <button onClick={onClick} disabled={disabled} className={`${baseClass} ${variantClass} ${disabledClass} ${className}`}>
      {children}
    </button>
  );
};

const CustomModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <CustomButton onClick={onClose} variant="secondary">
            <X className="w-4 h-4" />
          </CustomButton>
        </div>
        {children}
      </div>
    </div>
  );
};

const CustomSelect: React.FC<{
  label?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: Array<{ value: string; label: string }>;
  error?: string;
  disabled?: boolean;
}> = ({ label, value, onChange, options, error, disabled }) => (
  <div className="flex flex-col">
    {label && <label className="text-sm font-medium text-gray-700 mb-1">{label}</label>}
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={`px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 ${
        error ? 'border-red-500' : ''
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
  </div>
);

const Pagination: React.FC<{
  totalPages: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  isRtl: boolean;
}> = ({ totalPages, currentPage, setCurrentPage, isRtl }) => (
  totalPages > 1 && (
    <div className={`flex items-center justify-center gap-3 mt-6 ${isRtl ? 'flex-row-reverse' : ''}`}>
      <CustomButton
        variant="secondary"
        size="md"
        onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
        disabled={currentPage === 1}
      >
        {isRtl ? 'السابق' : 'Previous'}
      </CustomButton>
      <span className="text-gray-700 font-medium">
        {isRtl ? `الصفحة ${currentPage} من ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
      </span>
      <CustomButton
        variant="secondary"
        size="md"
        onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
        disabled={currentPage === totalPages}
      >
        {isRtl ? 'التالي' : 'Next'}
      </CustomButton>
    </div>
  )
);

const ITEMS_PER_PAGE = 10;

export const BranchInventory: React.FC = () => {
  const [language, setLanguage] = useState<'ar' | 'en'>('ar');
  const isRtl = language === 'ar';
  const t = (key: string, params?: Record<string, string>) => {
    const text = translations[key]?.[language] || key;
    return params ? Object.entries(params).reduce((acc, [k, v]) => acc.replace(`{${k}}`, v), text) : text;
  };

  // محاكاة بيانات المستخدم (يجب استبدالها بـ useAuth حقيقي)
  const user = { _id: 'user123', branchId: 'branch123', role: 'admin', username: 'Admin User' };

  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [activeTab, setActiveTab] = useState<'inventory' | 'history' | 'returns'>('inventory');
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isReturnDetailsModalOpen, setIsReturnDetailsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [returnForm, dispatchReturnForm] = useReducer(returnFormReducer, { reason: '', notes: '', items: [] });
  const [editForm, setEditForm] = useState<EditForm>({ minStockLevel: 0, maxStockLevel: 0 });
  const [returnErrors, setReturnErrors] = useState<Record<string, string>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);

  // إعداد WebSocket
  const socket = useMemo(() => new WebSocket('wss://your-backend-api/socket'), []);
  const [isConnected, setIsConnected] = useState(socket.readyState === WebSocket.OPEN);

  useEffect(() => {
    socket.onopen = () => {
      setIsConnected(true);
      if (user?.branchId) socket.send(JSON.stringify({ type: 'joinRoom', branchId: user.branchId }));
    };
    socket.onclose = () => setIsConnected(false);
    socket.onerror = (err) => console.error('Socket error:', err);
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'inventoryUpdated' && data.branchId === user?.branchId) {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        queryClient.invalidateQueries({ queryKey: ['inventoryHistory'] });
        toast.info(t('inventory.update_success'), { position: 'top-right', autoClose: 3000 });
      }
      if (data.type === 'returnStatusUpdated' && data.branchId === user?.branchId) {
        queryClient.invalidateQueries({ queryKey: ['returns'] });
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        queryClient.invalidateQueries({ queryKey: ['inventoryHistory'] });
        toast.info(
          t('notifications.return_status_updated', {
            status: t(`returns.${data.status}`),
            branchName: user?.branchId || t('branches.unknown'),
          }),
          { position: 'top-right', autoClose: 3000 }
        );
      }
    };
    return () => socket.close();
  }, [socket, user?.branchId, queryClient, t]);

  // واجهات API
  const inventoryAPI = {
    getByBranch: (branchId: string) =>
      axios.get(`/api/inventory?branchId=${branchId}`).then((res) => res.data.inventory),
    getHistory: (params: { branchId: string }) =>
      axios.get(`/api/inventory/history?branchId=${params.branchId}`).then((res) => res.data),
    updateStock: (itemId: string, data: { minStockLevel: number; maxStockLevel: number; userId: string }) =>
      axios.put(`/api/inventory/${itemId}`, { ...data }).then((res) => res.data),
  };

  const returnsAPI = {
    getAll: (params: { branch: string; status?: string; page: number; limit: number }) =>
      axios.get(`/api/returns`, { params }).then((res) => res.data),
    getById: (returnId: string) => axios.get(`/api/returns/${returnId}`).then((res) => res.data),
    createReturn: (data: {
      branchId: string;
      createdBy: string;
      reason: string;
      notes: string;
      items: Array<{ product: string; quantity: number; reason: string }>;
    }) => axios.post(`/api/returns`, data).then((res) => res.data),
    updateReturnStatus: (returnId: string, data: { status: string; reviewNotes?: string; reviewedBy: string }) =>
      axios.put(`/api/returns/${returnId}/status`, data).then((res) => res.data),
  };

  // استعلامات React Query
  const { data: inventoryData, isLoading: inventoryLoading, error: inventoryError } = useQuery<InventoryItem[], Error>({
    queryKey: ['inventory', user?.branchId, isRtl],
    queryFn: async () => {
      if (!user?.branchId) throw new Error(t('errors.no_branch'));
      const response = await inventoryAPI.getByBranch(user.branchId);
      return response.map((item: InventoryItem) => ({
        ...item,
        product: item.product
          ? {
              _id: item.product._id || '',
              name: item.product.name || t('products.unknown'),
              nameEn: item.product.nameEn || item.product.name || t('products.unknown'),
              code: item.product.code || 'N/A',
              unit: item.product.unit || t('products.unit_unknown'),
              unitEn: item.product.unitEn || item.product.unit || 'N/A',
              department: item.product.department
                ? {
                    name: item.product.department.name || t('departments.unknown'),
                    nameEn: item.product.department.nameEn || item.product.department.name || t('departments.unknown'),
                  }
                : null,
            }
          : null,
        status:
          item.currentStock <= item.minStockLevel
            ? 'low'
            : item.currentStock >= item.maxStockLevel
            ? 'full'
            : 'normal',
      }));
    },
    enabled: !!user?.branchId,
    onError: (err) => toast.error(err.message || t('errors.fetch_inventory'), { position: 'top-right', autoClose: 3000 }),
  });

  const { data: historyData, isLoading: historyLoading, error: historyError } = useQuery<InventoryHistoryItem[], Error>({
    queryKey: ['inventoryHistory', user?.branchId, isRtl],
    queryFn: async () => {
      if (!user?.branchId) throw new Error(t('errors.no_branch'));
      const response = await inventoryAPI.getHistory({ branchId: user.branchId });
      return response.history.map((entry: InventoryHistoryItem) => ({
        ...entry,
        product: entry.product
          ? {
              name: entry.product.name || t('products.unknown'),
              nameEn: entry.product.nameEn || entry.product.name || t('products.unknown'),
            }
          : null,
      }));
    },
    enabled: activeTab === 'history' && !!user?.branchId,
    onError: (err) => toast.error(err.message || t('errors.fetch_history'), { position: 'top-right', autoClose: 3000 }),
  });

  const { data: returnsData, isLoading: returnsLoading, error: returnsError } = useQuery<
    { returns: Return[]; total: number },
    Error
  >({
    queryKey: ['returns', user?.branchId, filterStatus, currentPage, isRtl],
    queryFn: async () => {
      if (!user?.branchId) throw new Error(t('errors.no_branch'));
      return returnsAPI.getAll({ branch: user.branchId, status: filterStatus, page: currentPage, limit: ITEMS_PER_PAGE });
    },
    enabled: activeTab === 'returns' && !!user?.branchId,
    select: (response) => ({
      returns: response.returns.map((ret: Return) => ({
        ...ret,
        items: ret.items.map((item) => ({
          ...item,
          product: {
            _id: item.product._id,
            name: item.product.name || t('products.unknown'),
            nameEn: item.product.nameEn || item.product.name || t('products.unknown'),
            unit: item.product.unit || t('products.unit_unknown'),
            unitEn: item.product.unitEn || item.product.unit || 'N/A',
            department: item.product.department
              ? {
                  name: item.product.department.name || t('departments.unknown'),
                  nameEn: item.product.department.nameEn || item.product.department.name || t('departments.unknown'),
                }
              : { name: t('departments.unknown'), nameEn: t('departments.unknown') },
          },
          productName: isRtl ? item.product.name : item.product.nameEn,
          unit: isRtl ? item.product.unit : item.product.unitEn,
          departmentName: isRtl ? item.product.department.name : item.product.department.nameEn,
        })),
      })),
      total: response.total,
    }),
    onError: (err) => toast.error(err.message || t('errors.fetch_returns'), { position: 'top-right', autoClose: 3000 }),
  });

  // تحديث العناصر المتاحة
  useEffect(() => {
    if (inventoryData) {
      setAvailableItems(
        inventoryData
          .filter((item) => item.currentStock > 0 && item.product)
          .map((item) => ({
            productId: item.product!._id,
            productName: isRtl ? item.product!.name : item.product!.nameEn || item.product!.name,
            available: item.currentStock,
            unit: isRtl ? item.product!.unit : item.product!.unitEn,
            departmentName: isRtl
              ? item.product!.department?.name || t('departments.unknown')
              : item.product!.department?.nameEn || item.product!.department?.name || t('departments.unknown'),
            stock: item.currentStock,
          }))
      );
    }
  }, [inventoryData, isRtl, t]);

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchQuery(value.trim());
      setCurrentPage(1);
    }, 300),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => debouncedSearch(e.target.value);

  const statusOptions = [
    { value: '', label: t('common.all_statuses') },
    { value: 'low', label: t('inventory.low_stock') },
    { value: 'normal', label: t('inventory.normal') },
    { value: 'full', label: t('inventory.full') },
  ];

  const returnStatusOptions = [
    { value: '', label: t('common.all_statuses') },
    { value: 'pending_approval', label: t('returns.pending_approval') },
    { value: 'approved', label: t('returns.approved') },
    { value: 'rejected', label: t('returns.rejected') },
  ];

  const reasonOptions = [
    { value: '', label: t('returns.select_reason') },
    { value: 'تالف', label: t('returns.damaged') },
    { value: 'منتج خاطئ', label: t('returns.wrong_item') },
    { value: 'كمية زائدة', label: t('returns.excess_quantity') },
    { value: 'أخرى', label: t('returns.other') },
  ];

  const filteredInventory = useMemo(
    () =>
      (inventoryData || []).filter(
        (item) =>
          item.product &&
          (!filterStatus || item.status === filterStatus) &&
          (item.product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.product.nameEn?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.product.code?.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
    [inventoryData, searchQuery, filterStatus]
  );

  const paginatedInventory = useMemo(
    () => filteredInventory.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredInventory, currentPage]
  );

  const totalInventoryPages = Math.ceil(filteredInventory.length / ITEMS_PER_PAGE);

  const filteredHistory = useMemo(
    () =>
      (historyData || []).filter(
        (entry) =>
          entry.product &&
          (entry.product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            entry.product.nameEn?.toLowerCase().includes(searchQuery.toLowerCase())) &&
          (!filterStatus || entry.action === filterStatus)
      ),
    [historyData, searchQuery, filterStatus]
  );

  const paginatedHistory = useMemo(
    () => filteredHistory.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredHistory, currentPage]
  );

  const totalHistoryPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);

  const totalReturnsPages = Math.ceil((returnsData?.total || 0) / ITEMS_PER_PAGE);

  const handleOpenReturnModal = useCallback((item?: InventoryItem) => {
    setSelectedItem(item || null);
    dispatchReturnForm({ type: 'RESET' });
    if (item?.product) {
      dispatchReturnForm({
        type: 'ADD_ITEM',
        payload: { productId: item.product._id, quantity: 1, reason: '', maxQuantity: item.currentStock },
      });
    }
    setReturnErrors({});
    setIsReturnModalOpen(true);
  }, []);

  const handleOpenEditModal = useCallback((item: InventoryItem) => {
    setSelectedItem(item);
    setEditForm({ minStockLevel: item.minStockLevel, maxStockLevel: item.maxStockLevel });
    setEditErrors({});
    setIsEditModalOpen(true);
  }, []);

  const handleOpenReturnDetailsModal = useCallback(async (returnId: string) => {
    try {
      const response = await returnsAPI.getById(returnId);
      setSelectedReturn(response.returnRequest);
      setIsReturnDetailsModalOpen(true);
    } catch (error: any) {
      toast.error(error.message || t('errors.fetch_returns'), { position: 'top-right', autoClose: 3000 });
    }
  }, [t]);

  const addItemToForm = useCallback(() => {
    dispatchReturnForm({
      type: 'ADD_ITEM',
      payload: { productId: '', quantity: 1, reason: '', maxQuantity: 0 },
    });
  }, []);

  const updateItemInForm = useCallback(
    (index: number, field: keyof ReturnItem, value: string | number) => {
      dispatchReturnForm({ type: 'UPDATE_ITEM', payload: { index, field, value } });
      if (field === 'productId') {
        const sel = availableItems.find((a) => a.productId === value);
        if (sel) {
          dispatchReturnForm({
            type: 'UPDATE_ITEM',
            payload: { index, field: 'maxQuantity', value: sel.stock },
          });
        }
      }
    },
    [availableItems]
  );

  const removeItemFromForm = useCallback((index: number) => {
    dispatchReturnForm({ type: 'REMOVE_ITEM', payload: index });
  }, []);

  const validateReturnForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!returnForm.reason) errors.reason = t('errors.required', { field: t('returns.reason') });
    if (returnForm.items.length === 0) errors.items = t('errors.required', { field: t('returns.items') });
    returnForm.items.forEach((item, index) => {
      if (!item.productId) errors[`item_${index}_productId`] = t('errors.required', { field: t('returns.item') });
      if (!item.reason) errors[`item_${index}_reason`] = t('errors.required', { field: t('returns.reason') });
      if (item.quantity < 1 || item.quantity > (item.maxQuantity ?? 0) || isNaN(item.quantity)) {
        errors[`item_${index}_quantity`] = t('errors.invalid_quantity_max', { max: item.maxQuantity ?? 0 });
      }
    });
    setReturnErrors(errors);
    return Object.keys(errors).length === 0;
  }, [returnForm, t]);

  const validateEditForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (editForm.minStockLevel < 0) errors.minStockLevel = t('errors.non_negative', { field: t('inventory.min_stock') });
    if (editForm.maxStockLevel < 0) errors.maxStockLevel = t('errors.non_negative', { field: t('inventory.max_stock') });
    if (editForm.maxStockLevel <= editForm.minStockLevel) errors.maxStockLevel = t('errors.max_greater_min');
    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  }, [editForm, t]);

  const createReturnMutation = useMutation<void, Error>({
    mutationFn: async () => {
      if (!validateReturnForm()) throw new Error(t('errors.invalid_form'));
      if (!user?.branchId || !user?._id) throw new Error(t('errors.no_branch'));
      await returnsAPI.createReturn({
        branchId: user.branchId,
        createdBy: user._id,
        reason: returnForm.reason,
        notes: returnForm.notes,
        items: returnForm.items.map((item) => ({
          product: item.productId,
          quantity: item.quantity,
          reason: item.reason,
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryHistory'] });
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      setIsReturnModalOpen(false);
      dispatchReturnForm({ type: 'RESET' });
      setReturnErrors({});
      setSelectedItem(null);
      toast.success(t('returns.create_success'), { position: 'top-right', autoClose: 3000 });
      if (isConnected) {
        socket.send(
          JSON.stringify({
            type: 'returnCreated',
            branchId: user?.branchId,
            returnId: crypto.randomUUID(),
            status: 'pending_approval',
          })
        );
      }
    },
    onError: (err) => {
      toast.error(err.message || t('errors.create_return'), { position: 'top-right', autoClose: 3000 });
      if (err.message.includes('Invalid')) setReturnErrors({ form: err.message });
    },
  });

  const updateInventoryMutation = useMutation<void, Error>({
    mutationFn: async () => {
      if (!validateEditForm()) throw new Error(t('errors.invalid_form'));
      if (!selectedItem || !user?._id) throw new Error(t('errors.no_item_selected'));
      await inventoryAPI.updateStock(selectedItem._id, {
        minStockLevel: editForm.minStockLevel,
        maxStockLevel: editForm.maxStockLevel,
        userId: user._id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setIsEditModalOpen(false);
      setEditForm({ minStockLevel: 0, maxStockLevel: 0 });
      setEditErrors({});
      setSelectedItem(null);
      toast.success(t('inventory.update_success'), { position: 'top-right', autoClose: 3000 });
      if (isConnected) {
        socket.send(
          JSON.stringify({
            type: 'inventoryUpdated',
            branchId: user?.branchId,
            minStockLevel: editForm.minStockLevel,
            maxStockLevel: editForm.maxStockLevel,
          })
        );
      }
    },
    onError: (err) => {
      toast.error(err.message || t('errors.update_inventory'), { position: 'top-right', autoClose: 3000 });
    },
  });

  const updateReturnStatusMutation = useMutation<void, Error, { returnId: string; status: 'approved' | 'rejected'; reviewNotes?: string }>({
    mutationFn: async ({ returnId, status, reviewNotes }) => {
      if (!user?._id) throw new Error(t('errors.no_user'));
      await returnsAPI.updateReturnStatus(returnId, { status, reviewNotes, reviewedBy: user._id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryHistory'] });
      setIsReturnDetailsModalOpen(false);
      setSelectedReturn(null);
      toast.success(t('returns.update_success'), { position: 'top-right', autoClose: 3000 });
    },
    onError: (err) => {
      toast.error(err.message || t('errors.update_return'), { position: 'top-right', autoClose: 3000 });
    },
  });

  const errorMessage = inventoryError?.message || historyError?.message || returnsError?.message || '';

  return (
    <div className="container mx-auto px-4 py-6 min-h-screen bg-gradient-to-br from-amber-50 to-teal-50" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Package className="w-8 h-8 text-amber-600" />
              {t('inventory.title')}
            </h1>
            <p className="text-gray-600 mt-2">{t('inventory.description')}</p>
          </div>
          <CustomButton
            onClick={() => handleOpenReturnModal()}
            className="bg-amber-600 text-white hover:bg-amber-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('returns.create')}
          </CustomButton>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600">{errorMessage}</span>
          <CustomButton
            onClick={() => queryClient.invalidateQueries({ queryKey: ['inventory'] })}
            className="ml-4 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('common.retry')}
          </CustomButton>
        </div>
      )}

      <div className="flex mb-4 overflow-hidden rounded-full bg-white shadow-md">
        <CustomButton
          onClick={() => {
            setActiveTab('inventory');
            setCurrentPage(1);
          }}
          className={`flex-1 py-2 font-semibold transition-all duration-300 ${
            activeTab === 'inventory' ? 'bg-amber-600 text-white' : 'text-gray-700'
          }`}
        >
          {t('inventory.title')}
        </CustomButton>
        <CustomButton
          onClick={() => {
            setActiveTab('history');
            setCurrentPage(1);
          }}
          className={`flex-1 py-2 font-semibold transition-all duration-300 ${
            activeTab === 'history' ? 'bg-amber-600 text-white' : 'text-gray-700'
          }`}
        >
          <History className="inline w-4 h-4 mr-2" />
          {t('history.title')}
        </CustomButton>
        <CustomButton
          onClick={() => {
            setActiveTab('returns');
            setCurrentPage(1);
          }}
          className={`flex-1 py-2 font-semibold transition-all duration-300 ${
            activeTab === 'returns' ? 'bg-amber-600 text-white' : 'text-gray-700'
          }`}
        >
          {t('returns.title')}
        </CustomButton>
      </div>

      <CustomCard className="p-6 mb-6 bg-white rounded-xl shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative">
            <Search
              className={`absolute top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 ${isRtl ? 'right-3' : 'left-3'}`}
            />
            <CustomInput
              placeholder={t('common.search')}
              onChange={handleSearchChange}
              className={`pl-10 pr-4 py-2 border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 ${isRtl ? 'pr-10 pl-4' : ''}`}
              value={searchQuery}
            />
          </div>
          <CustomSelect
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
            }}
            options={activeTab === 'returns' ? returnStatusOptions : statusOptions}
            label={t('common.filter_by_status')}
          />
        </div>
      </CustomCard>

      <AnimatePresence mode="wait">
        {activeTab === 'inventory' ? (
          <motion.div
            key="inventory"
            initial={{ opacity: 0, x: isRtl ? -50 : 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRtl ? 50 : -50 }}
            transition={{ duration: 0.3 }}
          >
            {inventoryLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="p-4 mb-4 bg-white shadow-md rounded-lg border border-gray-200">
                    <div className="flex flex-col gap-3">
                      <div className={`flex items-center ${isRtl ? 'justify-between flex-row-reverse' : 'justify-between'}`}>
                        <div className="h-6 w-1/2 bg-gray-200 rounded animate-pulse" />
                        <div className="h-5 w-20 bg-gray-200 rounded-full animate-pulse" />
                      </div>
                      <div className="h-4 w-1/3 bg-gray-200 rounded animate-pulse" />
                      <div className="h-4 w-1/4 bg-gray-200 rounded animate-pulse" />
                      <div className="h-4 w-1/4 bg-gray-200 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : paginatedInventory.length === 0 ? (
              <CustomCard className="p-8 text-center bg-white rounded-xl shadow-md">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">{t('inventory.no_items')}</p>
              </CustomCard>
            ) : (
              <div className="space-y-4">
                <AnimatePresence>
                  {paginatedInventory.map((item) =>
                    item.product ? (
                      <motion.div
                        key={item._id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                      >
                        <CustomCard className="p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-shadow">
                          <div className={`flex items-start justify-between gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900">{isRtl ? item.product.name : item.product.nameEn}</h3>
                              <p className="text-sm text-gray-500">{t('products.code')}: {item.product.code}</p>
                              <p className="text-sm text-gray-600">{t('inventory.stock')}: {item.currentStock}</p>
                              <p className="text-sm text-gray-600">{t('inventory.min_stock')}: {item.minStockLevel}</p>
                              <p className="text-sm text-gray-600">{t('inventory.max_stock')}: {item.maxStockLevel}</p>
                              <p className="text-sm text-gray-600">{t('products.unit')}: {isRtl ? item.product.unit : item.product.unitEn}</p>
                              <p className="text-sm text-gray-600 font-medium">
                                {t('departments.title')}: {isRtl ? item.product.department?.name : item.product.department?.nameEn}
                              </p>
                              <p
                                className={`text-sm font-medium ${
                                  item.status === 'low' ? 'text-red-600' : item.status === 'full' ? 'text-yellow-600' : 'text-green-600'
                                }`}
                              >
                                {t(`inventory.${item.status}`)}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <CustomButton
                                variant="secondary"
                                size="sm"
                                onClick={() => handleOpenEditModal(item)}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <Edit className="w-4 h-4" />
                              </CustomButton>
                              <CustomButton
                                variant="destructive"
                                size="sm"
                                disabled={item.currentStock <= 0}
                                onClick={() => handleOpenReturnModal(item)}
                                className="text-red-600 hover:text-red-800 disabled:opacity-50"
                              >
                                {t('returns.create')}
                              </CustomButton>
                            </div>
                          </div>
                        </CustomCard>
                      </motion.div>
                    ) : null
                  )}
                </AnimatePresence>
                <Pagination totalPages={totalInventoryPages} currentPage={currentPage} setCurrentPage={setCurrentPage} isRtl={isRtl} />
              </div>
            )}
          </motion.div>
        ) : activeTab === 'history' ? (
          <motion.div
            key="history"
            initial={{ opacity: 0, x: isRtl ? 50 : -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRtl ? -50 : 50 }}
            transition={{ duration: 0.3 }}
          >
            {historyLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-amber-600 mx-auto"></div>
              </div>
            ) : paginatedHistory.length === 0 ? (
              <CustomCard className="p-8 text-center bg-white rounded-xl shadow-md">
                <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">{t('history.no_history')}</p>
              </CustomCard>
            ) : (
              <CustomCard className="p-4 bg-white rounded-xl shadow-md">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{t('history.date')}</th>
                      <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{t('history.action')}</th>
                      <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{t('history.quantity')}</th>
                      <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{t('history.reference')}</th>
                      <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{t('history.created_by')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedHistory.map((entry) =>
                      entry.product ? (
                        <tr key={entry._id} className="border-b">
                          <td className="p-2">{new Date(entry.createdAt).toLocaleString(isRtl ? 'ar' : 'en')}</td>
                          <td className="p-2">{t(`history.${entry.action}`)}</td>
                          <td className="p-2">{entry.quantity}</td>
                          <td className="p-2">{entry.reference}</td>
                          <td className="p-2">{entry.createdBy.username}</td>
                        </tr>
                      ) : null
                    )}
                  </tbody>
                </table>
                <Pagination totalPages={totalHistoryPages} currentPage={currentPage} setCurrentPage={setCurrentPage} isRtl={isRtl} />
              </CustomCard>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="returns"
            initial={{ opacity: 0, x: isRtl ? 50 : -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRtl ? -50 : 50 }}
            transition={{ duration: 0.3 }}
          >
            {returnsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-amber-600 mx-auto"></div>
              </div>
            ) : (returnsData?.returns || []).length === 0 ? (
              <CustomCard className="p-8 text-center bg-white rounded-xl shadow-md">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">{t('returns.no_returns')}</p>
              </CustomCard>
            ) : (
              <div className="space-y-4">
                <AnimatePresence>
                  {(returnsData?.returns || []).map((ret) => (
                    <motion.div
                      key={ret._id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <CustomCard className="p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-shadow">
                        <div className={`flex items-start justify-between gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">{ret.returnNumber}</h3>
                            <p className="text-sm text-gray-600">{t('returns.date')}: {new Date(ret.createdAt).toLocaleString(isRtl ? 'ar' : 'en')}</p>
                            <p className="text-sm text-gray-600">{t('returns.status')}: {t(`returns.${ret.status}`)}</p>
                            <p className="text-sm text-gray-600">{t('returns.reason')}: {t(`returns.${ret.reason}`)}</p>
                            <p className="text-sm text-gray-600">{t('returns.notes')}: {ret.notes || 'لا يوجد'}</p>
                            <p className="text-sm text-gray-600">{t('returns.created_by')}: {ret.createdByName}</p>
                            {ret.reviewedByName && (
                              <p className="text-sm text-gray-600">{t('returns.reviewed_by')}: {ret.reviewedByName}</p>
                            )}
                            <div className="mt-2">
                              <p className="text-sm font-medium text-gray-700">{t('returns.items')}:</p>
                              <ul className={`list-disc ${isRtl ? 'pr-4' : 'pl-4'}`}>
                                {ret.items.map((item, i) => (
                                  <li key={i} className="text-sm text-gray-600">
                                    {item.productName} - {item.quantity} {item.unit} ({t(`returns.${item.reason}`)})
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          <CustomButton
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenReturnDetailsModal(ret._id)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            {t('returns.view_details')}
                          </CustomButton>
                        </div>
                      </CustomCard>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <Pagination totalPages={totalReturnsPages} currentPage={currentPage} setCurrentPage={setCurrentPage} isRtl={isRtl} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <CustomModal
        isOpen={isReturnModalOpen}
        onClose={() => {
          setIsReturnModalOpen(false);
          dispatchReturnForm({ type: 'RESET' });
          setReturnErrors({});
          setSelectedItem(null);
        }}
        title={t('returns.create')}
      >
        <div className="flex flex-col gap-4">
          {selectedItem?.product && (
            <p className="text-sm text-gray-600">
              {t('products.title')}: {isRtl ? selectedItem.product.name : selectedItem.product.nameEn}
            </p>
          )}
          <CustomSelect
            label={t('returns.reason')}
            value={returnForm.reason}
            onChange={(e) => dispatchReturnForm({ type: 'SET_REASON', payload: e.target.value })}
            options={reasonOptions}
            error={returnErrors.reason}
          />
          <CustomInput
            label={t('returns.notes')}
            value={returnForm.notes}
            onChange={(e) => dispatchReturnForm({ type: 'SET_NOTES', payload: e.target.value })}
            placeholder={t('returns.notes_placeholder')}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('returns.items')}</label>
            {returnForm.items.map((item, index) => (
              <div key={index} className={`flex gap-2 mb-2 items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
                <CustomSelect
                  value={item.productId}
                  onChange={(e) => updateItemInForm(index, 'productId', e.target.value)}
                  options={[{ value: '', label: t('products.select') }].concat(
                    availableItems
                      .filter((a) => !returnForm.items.some((i, idx) => i.productId === a.productId && idx !== index))
                      .map((a) => ({
                        value: a.productId,
                        label: `${a.productName} (${a.stock} ${t('common.available')}) - ${a.departmentName}`,
                      }))
                  )}
                  error={returnErrors[`item_${index}_productId`]}
                  disabled={!!selectedItem}
                />
                <CustomInput
                  type="number"
                  min={1}
                  max={item.maxQuantity}
                  value={item.quantity}
                  onChange={(e) => updateItemInForm(index, 'quantity', Number(e.target.value))}
                  error={returnErrors[`item_${index}_quantity`]}
                  className="w-24"
                />
                <CustomSelect
                  value={item.reason}
                  onChange={(e) => updateItemInForm(index, 'reason', e.target.value)}
                  options={reasonOptions}
                  error={returnErrors[`item_${index}_reason`]}
                />
                <CustomButton
                  variant="destructive"
                  size="sm"
                  onClick={() => removeItemFromForm(index)}
                  disabled={!!selectedItem}
                >
                  <X className="w-4 h-4" />
                </CustomButton>
              </div>
            ))}
            {returnErrors.items && <p className="text-red-500 text-sm mt-1">{returnErrors.items}</p>}
            {!selectedItem && (
              <CustomButton
                variant="secondary"
                onClick={addItemToForm}
                disabled={availableItems.length === 0 || availableItems.length === returnForm.items.length}
                className="mt-2"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('returns.add_item')}
              </CustomButton>
            )}
          </div>
          {returnErrors.form && <p className="text-red-500 text-sm">{returnErrors.form}</p>}
          <div className={`flex justify-end gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <CustomButton
              variant="secondary"
              onClick={() => {
                setIsReturnModalOpen(false);
                dispatchReturnForm({ type: 'RESET' });
                setReturnErrors({});
                setSelectedItem(null);
              }}
            >
              {t('common.cancel')}
            </CustomButton>
            <CustomButton
              onClick={() => createReturnMutation.mutate()}
              disabled={createReturnMutation.isPending}
              className="disabled:opacity-50"
            >
              {createReturnMutation.isPending ? t('common.submitting') : t('common.submit')}
            </CustomButton>
          </div>
        </div>
      </CustomModal>

      <CustomModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditForm({ minStockLevel: 0, maxStockLevel: 0 });
          setEditErrors({});
          setSelectedItem(null);
        }}
        title={t('inventory.edit_stock_limits')}
      >
        <div className="flex flex-col gap-4">
          {selectedItem?.product && (
            <p className="text-sm text-gray-600">
              {t('products.title')}: {isRtl ? selectedItem.product.name : selectedItem.product.nameEn}
            </p>
          )}
          <CustomInput
            label={t('inventory.min_stock')}
            type="number"
            min={0}
            value={editForm.minStockLevel}
            onChange={(e) => setEditForm({ ...editForm, minStockLevel: Number(e.target.value) })}
            error={editErrors.minStockLevel}
          />
          <CustomInput
            label={t('inventory.max_stock')}
            type="number"
            min={0}
            value={editForm.maxStockLevel}
            onChange={(e) => setEditForm({ ...editForm, maxStockLevel: Number(e.target.value) })}
            error={editErrors.maxStockLevel}
          />
          <div className={`flex justify-end gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <CustomButton
              variant="secondary"
              onClick={() => {
                setIsEditModalOpen(false);
                setEditForm({ minStockLevel: 0, maxStockLevel: 0 });
                setEditErrors({});
                setSelectedItem(null);
              }}
            >
              {t('common.cancel')}
            </CustomButton>
            <CustomButton
              onClick={() => updateInventoryMutation.mutate()}
              disabled={updateInventoryMutation.isPending}
              className="disabled:opacity-50"
            >
              {updateInventoryMutation.isPending ? t('common.saving') : t('common.submit')}
            </CustomButton>
          </div>
        </div>
      </CustomModal>

      <CustomModal
        isOpen={isReturnDetailsModalOpen}
        onClose={() => {
          setIsReturnDetailsModalOpen(false);
          setSelectedReturn(null);
        }}
        title={t('returns.details')}
      >
        {selectedReturn && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-600">
              <strong>{t('returns.return_number')}:</strong> {selectedReturn.returnNumber}
            </p>
            <p className="text-sm text-gray-600">
              <strong>{t('returns.branch')}:</strong> {selectedReturn.branchName}
            </p>
            <p className="text-sm text-gray-600">
              <strong>{t('returns.reason')}:</strong> {t(`returns.${selectedReturn.reason}`)}
            </p>
            <p className="text-sm text-gray-600">
              <strong>{t('returns.status')}:</strong> {t(`returns.${selectedReturn.status}`)}
            </p>
            <p className="text-sm text-gray-600">
              <strong>{t('returns.created_by')}:</strong> {selectedReturn.createdByName}
            </p>
            {selectedReturn.reviewedByName && (
              <p className="text-sm text-gray-600">
                <strong>{t('returns.reviewed_by')}:</strong> {selectedReturn.reviewedByName}
              </p>
            )}
            <p className="text-sm text-gray-600">
              <strong>{t('returns.notes')}:</strong> {selectedReturn.notes || 'لا يوجد'}
            </p>
            <div>
              <p className="text-sm font-medium text-gray-700">{t('returns.items')}:</p>
              <ul className={`list-disc ${isRtl ? 'pr-4' : 'pl-4'}`}>
                {selectedReturn.items.map((item, i) => (
                  <li key={i} className="text-sm text-gray-600">
                    {item.productName} - {item.quantity} {item.unit} ({t(`returns.${item.reason}`)})
                  </li>
                ))}
              </ul>
            </div>
            {(user?.role === 'admin' || user?.role === 'production') && selectedReturn.status === 'pending_approval' && (
              <div className={`flex justify-end gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <CustomButton
                  onClick={() =>
                    updateReturnStatusMutation.mutate({
                      returnId: selectedReturn._id,
                      status: 'approved',
                      reviewNotes: t('returns.approved'),
                    })
                  }
                  className="bg-green-500 text-white hover:bg-green-600"
                >
                  {t('returns.approve')}
                </CustomButton>
                <CustomButton
                  onClick={() =>
                    updateReturnStatusMutation.mutate({
                      returnId: selectedReturn._id,
                      status: 'rejected',
                      reviewNotes: t('returns.rejected'),
                    })
                  }
                  className="bg-red-500 text-white hover:bg-red-600"
                >
                  {t('returns.reject')}
                </CustomButton>
              </div>
            )}
            <div className={`flex justify-end ${isRtl ? 'flex-row-reverse' : ''}`}>
              <CustomButton
                variant="secondary"
                onClick={() => {
                  setIsReturnDetailsModalOpen(false);
                  setSelectedReturn(null);
                }}
              >
                {t('common.cancel')}
              </CustomButton>
            </div>
          </div>
        )}
      </CustomModal>
    </div>
  );
};

export default BranchInventory;