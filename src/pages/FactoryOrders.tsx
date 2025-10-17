
import React, { useState, useMemo, useCallback, useEffect, useReducer } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, Plus, X, Eye, UserCheck, CheckCircle, RefreshCw, Minus, AlertCircle } from 'lucide-react';
import { factoryOrdersAPI, factoryInventoryAPI } from '../services/api';
import { ProductSearchInput, ProductDropdown } from './NewOrder';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useNotifications } from '../contexts/NotificationContext';

// Enums
enum OrderStatus {
  PENDING = 'pending',
  IN_PRODUCTION = 'in_production',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

// Interfaces
interface FactoryOrderItem {
  _id: string;
  product: {
    _id: string;
    name: string;
    nameEn: string;
    unit: string;
    unitEn: string;
    department: { _id: string; name: string; nameEn: string } | null;
    displayName: string;
    displayUnit: string;
  } | null;
  quantity: number;
  status: string;
  assignedTo: { _id: string; name: string; nameEn: string } | null;
  startedAt: string | null;
  completedAt: string | null;
  isCompleted: boolean;
}

interface FactoryOrder {
  _id: string;
  orderNumber: string;
  items: FactoryOrderItem[];
  status: OrderStatus;
  notes: string;
  priority: string;
  createdByName: string;
  statusHistory: { status: string; changedByName: string; changedAt: string; displayNotes: string }[];
  createdAt: string;
  approvedAt: string | null;
  isRtl: boolean;
}

interface OrderFormState {
  notes: string;
  items: { product: string; quantity: number }[];
}

interface AssignFormState {
  items: { itemId: string; assignedTo: string }[];
}

interface Chef {
  _id: string;
  name: string;
  nameEn: string;
  department: string;
}

interface AvailableProduct {
  productId: string;
  productName: string;
  unit: string;
  departmentName: string;
}

// Translations
const translations = {
  ar: {
    title: 'إدارة طلبات الإنتاج',
    description: 'إدارة ومتابعة طلبات الإنتاج الداخلية',
    noOrders: 'لا توجد طلبات إنتاج',
    orderNumber: 'رقم الطلب',
    status: 'الحالة',
    priority: 'الأولوية',
    createdAt: 'تاريخ الإنشاء',
    items: 'العناصر',
    create: 'إنشاء طلب إنتاج جديد',
    assignChefs: 'تعيين الشيفات',
    updateStatus: 'تحديث الحالة',
    confirmProduction: 'تأكيد الإنتاج',
    viewDetails: 'عرض التفاصيل',
    search: 'البحث عن الطلبات...',
    selectProduct: 'اختر منتج',
    selectChef: 'اختر شيف',
    filterByStatus: 'تصفية حسب الحالة',
    filterByPriority: 'تصفية حسب الأولوية',
    allStatuses: 'جميع الحالات',
    allPriorities: 'جميع الأولويات',
    pending: 'معلق',
    in_production: 'قيد الإنتاج',
    completed: 'مكتمل',
    cancelled: 'ملغى',
    low: 'منخفض',
    medium: 'متوسط',
    high: 'عالي',
    urgent: 'عاجل',
    notes: 'ملاحظات',
    notesPlaceholder: 'أدخل ملاحظات إضافية (اختياري)',
    addItem: 'إضافة عنصر',
    removeItem: 'إزالة العنصر',
    submit: 'إرسال',
    submitting: 'جاري الإرسال...',
    cancel: 'إلغاء',
    save: 'حفظ',
    saving: 'جاري الحفظ...',
    history: 'سجل الحالة',
    noHistory: 'لا يوجد سجل',
    errors: {
      fetchOrders: 'خطأ في جلب طلبات الإنتاج',
      createOrder: 'خطأ في إنشاء طلب الإنتاج',
      assignChefs: 'خطأ في تعيين الشيفات',
      updateStatus: 'خطأ في تحديث الحالة',
      confirmProduction: 'خطأ في تأكيد الإنتاج',
      invalidForm: 'البيانات المدخلة غير صالحة',
      required: 'حقل {field} مطلوب',
      invalidQuantity: 'الكمية يجب أن تكون أكبر من 0',
      noItemSelected: 'لم يتم اختيار عنصر',
      invalidProductId: 'معرف المنتج غير صالح',
      productNotFound: 'المنتج غير موجود',
      duplicateProduct: 'لا يمكن إضافة نفس المنتج أكثر من مرة',
      invalidChefId: 'معرف الشيف غير صالح',
      chefNotFound: 'الشيف غير موجود',
    },
    notifications: {
      orderCreated: 'تم إنشاء طلب الإنتاج بنجاح',
      chefsAssigned: 'تم تعيين الشيفات بنجاح',
      statusUpdated: 'تم تحديث حالة الطلب بنجاح',
      productionConfirmed: 'تم تأكيد الإنتاج بنجاح',
    },
  },
  en: {
    title: 'Production Orders Management',
    description: 'Manage and track internal production orders',
    noOrders: 'No production orders found',
    orderNumber: 'Order Number',
    status: 'Status',
    priority: 'Priority',
    createdAt: 'Created At',
    items: 'Items',
    create: 'Create New Production Order',
    assignChefs: 'Assign Chefs',
    updateStatus: 'Update Status',
    confirmProduction: 'Confirm Production',
    viewDetails: 'View Details',
    search: 'Search orders...',
    selectProduct: 'Select Product',
    selectChef: 'Select Chef',
    filterByStatus: 'Filter by Status',
    filterByPriority: 'Filter by Priority',
    allStatuses: 'All Statuses',
    allPriorities: 'All Priorities',
    pending: 'Pending',
    in_production: 'In Production',
    completed: 'Completed',
    cancelled: 'Cancelled',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    urgent: 'Urgent',
    notes: 'Notes',
    notesPlaceholder: 'Enter additional notes (optional)',
    addItem: 'Add Item',
    removeItem: 'Remove Item',
    submit: 'Submit',
    submitting: 'Submitting...',
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving...',
    history: 'Status History',
    noHistory: 'No history available',
    errors: {
      fetchOrders: 'Error fetching production orders',
      createOrder: 'Error creating production order',
      assignChefs: 'Error assigning chefs',
      updateStatus: 'Error updating status',
      confirmProduction: 'Error confirming production',
      invalidForm: 'Invalid form data',
      required: '{field} is required',
      invalidQuantity: 'Quantity must be greater than 0',
      noItemSelected: 'No item selected',
      invalidProductId: 'Invalid product ID',
      productNotFound: 'Product not found',
      duplicateProduct: 'Cannot add the same product multiple times',
      invalidChefId: 'Invalid chef ID',
      chefNotFound: 'Chef not found',
    },
    notifications: {
      orderCreated: 'Production order created successfully',
      chefsAssigned: 'Chefs assigned successfully',
      statusUpdated: 'Order status updated successfully',
      productionConfirmed: 'Production confirmed successfully',
    },
  },
};

// QuantityInput Component (same as before)

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

// Reducer for order form
type OrderFormAction =
  | { type: 'SET_NOTES'; payload: string }
  | { type: 'ADD_ITEM'; payload: { product: string; quantity: number } }
  | { type: 'UPDATE_ITEM'; payload: { index: number; field: 'product' | 'quantity'; value: string | number } }
  | { type: 'REMOVE_ITEM'; payload: number }
  | { type: 'RESET' };

const orderFormReducer = (state: OrderFormState, action: OrderFormAction): OrderFormState => {
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

// Reducer for assign form
type AssignFormAction =
  | { type: 'UPDATE_ITEM'; payload: { index: number; assignedTo: string } }
  | { type: 'RESET' };

const assignFormReducer = (state: AssignFormState, action: AssignFormAction): AssignFormState => {
  switch (action.type) {
    case 'UPDATE_ITEM':
      const newItems = [...state.items];
      newItems[action.payload.index] = { ...newItems[action.payload.index], assignedTo: action.payload.assignedTo };
      return { ...state, items: newItems };
    case 'RESET':
      return { items: [] };
    default:
      return state;
  }
};

// Validate ObjectId
const isValidObjectId = (id: string): boolean => /^[0-9a-fA-F]{24}$/.test(id);

// Aggregate items by product
const aggregateItemsByProduct = (items: { product: string; quantity: number }[]): { product: string; quantity: number }[] => {
  const aggregated: Record<string, { product: string; quantity: number }> = {};
  items.forEach((item) => {
    if (!aggregated[item.product]) {
      aggregated[item.product] = {
        product: item.product,
        quantity: 0,
      };
    }
    aggregated[item.product].quantity += item.quantity;
  });
  return Object.values(aggregated);
};

export const FactoryOrders: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const t = translations[isRtl ? 'ar' : 'en'];
  const { user } = useAuth();
  const { socket } = useSocket();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<OrderStatus | ''>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<FactoryOrder | null>(null);
  const [orderForm, dispatchOrderForm] = useReducer(orderFormReducer, { notes: '', items: [] });
  const [assignForm, dispatchAssignForm] = useReducer(assignFormReducer, { items: [] });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [assignErrors, setAssignErrors] = useState<Record<string, string>>({});
  const [availableProducts, setAvailableProducts] = useState<AvailableProduct[]>([]);
  const [availableChefs, setAvailableChefs] = useState<Chef[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearchQuery(searchInput), 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Orders Query
  const { data: ordersData, isLoading: ordersLoading, error: ordersError } = useQuery<FactoryOrder[], Error>({
    queryKey: ['factoryOrders', debouncedSearchQuery, filterStatus, filterPriority, currentPage, language],
    queryFn: async () => {
      const response = await factoryOrdersAPI.getAll();
      return response?.data || [];
    },
    enabled: !!user?.role && ['production', 'admin', 'chef'].includes(user.role),
    staleTime: 5 * 60 * 1000,
  });

  // Available products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await factoryInventoryAPI.getAvailableProducts();
        const products = response?.data || [];
        setAvailableProducts(
          products.map((product: any) => ({
            productId: product._id,
            productName: isRtl ? product.name : product.nameEn || product.name,
            unit: isRtl ? product.unit || t.unit : product.unitEn || product.unit || 'N/A',
            departmentName: isRtl
              ? product.department?.name || 'غير معروف'
              : product.department?.nameEn || product.department?.name || 'Unknown',
          }))
        );
      } catch (err) {
        console.error(`[${new Date().toISOString()}] Error fetching products:`, err);
      }
    };
    fetchProducts();
  }, [isRtl, t]);

  // Available chefs
  useEffect(() => {
    const fetchChefs = async () => {
      try {
        const response = await factoryOrdersAPI.getChefs();
        const chefs = response?.data || [];
        setAvailableChefs(
          chefs.map((chef: any) => ({
            _id: chef._id,
            name: isRtl ? chef.name : chef.nameEn || chef.name,
            department: chef.department,
          }))
        );
      } catch (err) {
        console.error(`[${new Date().toISOString()}] Error fetching chefs:`, err);
      }
    };
    fetchChefs();
  }, [isRtl]);

  // Socket Events
  useEffect(() => {
    if (!socket || !user?.role) return;

    const handleFactoryOrderCreated = ({ orderId, orderNumber }: { orderId: string; orderNumber: string }) => {
      queryClient.invalidateQueries({ queryKey: ['factoryOrders'] });
      addNotification({
        _id: crypto.randomUUID(),
        type: 'success',
        message: t.notifications.orderCreated,
        data: { orderId, orderNumber, eventId: crypto.randomUUID() },
        read: false,
        createdAt: new Date().toISOString(),
        sound: 'https://eljoodia-client.vercel.app/sounds/notification.mp3',
        vibrate: [200, 100, 200],
      });
      toast.success(t.notifications.orderCreated, { position: isRtl ? 'top-right' : 'top-left' });
    };

    const handleFactoryTaskAssigned = ({ orderId }: { orderId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['factoryOrders'] });
    };

    const handleFactoryOrderStatusUpdated = ({ orderId }: { orderId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['factoryOrders'] });
    };

    const handleFactoryOrderCompleted = ({ orderId }: { orderId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['factoryOrders'] });
      queryClient.invalidateQueries({ queryKey: ['factoryInventory'] });
    };

    socket.on('factoryOrderCreated', handleFactoryOrderCreated);
    socket.on('factoryTaskAssigned', handleFactoryTaskAssigned);
    socket.on('factoryOrderStatusUpdated', handleFactoryOrderStatusUpdated);
    socket.on('factoryOrderCompleted', handleFactoryOrderCompleted);

    return () => {
      socket.off('factoryOrderCreated', handleFactoryOrderCreated);
      socket.off('factoryTaskAssigned', handleFactoryTaskAssigned);
      socket.off('factoryOrderStatusUpdated', handleFactoryOrderStatusUpdated);
      socket.off('factoryOrderCompleted', handleFactoryOrderCompleted);
    };
  }, [socket, user, queryClient, addNotification, t, isRtl]);

  // Filtered and paginated orders
  const filteredOrders = useMemo(
    () =>
      (ordersData || []).filter(
        (order) =>
          (order.orderNumber.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
            order.createdByName.toLowerCase().includes(debouncedSearchQuery.toLowerCase())) &&
          (!filterStatus || order.status === filterStatus) &&
          (!filterPriority || order.priority === filterPriority)
      ),
    [ordersData, debouncedSearchQuery, filterStatus, filterPriority]
  );

  const paginatedOrders = useMemo(
    () => filteredOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredOrders, currentPage]
  );

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);

  // Status options
  const statusOptions = useMemo(
    () => [
      { value: '', label: t.allStatuses },
      { value: OrderStatus.PENDING, label: t.pending },
      { value: OrderStatus.IN_PRODUCTION, label: t.in_production },
      { value: OrderStatus.COMPLETED, label: t.completed },
      { value: OrderStatus.CANCELLED, label: t.cancelled },
    ],
    [t]
  );

  // Priority options
  const priorityOptions = useMemo(
    () => [
      { value: '', label: t.allPriorities },
      { value: 'low', label: t.low },
      { value: 'medium', label: t.medium },
      { value: 'high', label: t.high },
      { value: 'urgent', label: t.urgent },
    ],
    [t]
  );

  // Product options
  const productOptions = useMemo(
    () => [
      { value: '', label: t.selectProduct },
      ...availableProducts.map((product) => ({
        value: product.productId,
        label: `${product.productName} (${t.unit}: ${product.unit})`,
      })),
    ],
    [availableProducts, t]
  );

  // Chef options
  const chefOptions = useMemo(
    () => [
      { value: '', label: t.selectChef },
      ...availableChefs.map((chef) => ({
        value: chef._id,
        label: chef.name,
      })),
    ],
    [availableChefs, t]
  );

  // Handlers
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    setCurrentPage(1);
  }, []);

  const handleOpenCreateModal = useCallback(() => {
    dispatchOrderForm({ type: 'RESET' });
    dispatchOrderForm({ type: 'ADD_ITEM', payload: { product: '', quantity: 1 } });
    setCreateErrors({});
    setIsCreateModalOpen(true);
  }, []);

  const handleOpenAssignModal = useCallback((order: FactoryOrder) => {
    setSelectedOrder(order);
    dispatchAssignForm({ type: 'RESET' });
    order.items.forEach((item, index) => {
      dispatchAssignForm({
        type: 'UPDATE_ITEM',
        payload: { index, assignedTo: item.assignedTo?._id || '' },
      });
    });
    setAssignErrors({});
    setIsAssignModalOpen(true);
  }, []);

  const handleOpenStatusModal = useCallback((order: FactoryOrder) => {
    setSelectedOrder(order);
    setIsStatusModalOpen(true);
  }, []);

  const handleOpenConfirmModal = useCallback((order: FactoryOrder) => {
    setSelectedOrder(order);
    setIsConfirmModalOpen(true);
  }, []);

  const handleOpenDetailsModal = useCallback((order: FactoryOrder) => {
    setSelectedOrder(order);
    setIsDetailsModalOpen(true);
  }, []);

  const addItemToForm = useCallback(() => {
    dispatchOrderForm({
      type: 'ADD_ITEM',
      payload: { product: '', quantity: 1 },
    });
  }, []);

  const updateItemInForm = useCallback((index: number, field: 'product' | 'quantity', value: string | number) => {
    if (field === 'quantity' && typeof value === 'string') {
      const numValue = parseInt(value);
      if (isNaN(numValue) || numValue < 1) return;
      value = numValue;
    }
    dispatchOrderForm({ type: 'UPDATE_ITEM', payload: { index, field, value } });
  }, []);

  const handleProductChange = useCallback(
    (index: number, productId: string) => {
      if (!isValidObjectId(productId)) {
        setCreateErrors((prev) => ({
          ...prev,
          [`item_${index}_product`]: t.errors.invalidProductId,
        }));
        return;
      }
      if (orderForm.items.some((item, i) => i !== index && item.product === productId)) {
        setCreateErrors((prev) => ({
          ...prev,
          [`item_${index}_product`]: t.errors.duplicateProduct,
        }));
        return;
      }
      dispatchOrderForm({
        type: 'UPDATE_ITEM',
        payload: { index, field: 'product', value: productId },
      });
    },
    [t, orderForm.items]
  );

  const removeItemFromForm = useCallback((index: number) => {
    dispatchOrderForm({ type: 'REMOVE_ITEM', payload: index });
  }, []);

  const validateCreateForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (orderForm.items.length === 0) {
      errors.items = t.errors.required.replace('{field}', t.items);
    }
    orderForm.items.forEach((item, index) => {
      if (!item.product) {
        errors[`item_${index}_product`] = t.errors.required.replace('{field}', t.items);
      } else if (!isValidObjectId(item.product)) {
        errors[`item_${index}_product`] = t.errors.invalidProductId;
      }
      if (item.quantity < 1 || isNaN(item.quantity)) {
        errors[`item_${index}_quantity`] = t.errors.invalidQuantity;
      }
    });
    setCreateErrors(errors);
    return Object.keys(errors).length === 0;
  }, [orderForm, t]);

  const validateAssignForm = useCallback(() => {
    const errors: Record<string, string> = {};
    assignForm.items.forEach((item, index) => {
      if (!item.assignedTo) {
        errors[`item_${index}_assignedTo`] = t.errors.required.replace('{field}', t.selectChef);
      } else if (!isValidObjectId(item.assignedTo)) {
        errors[`item_${index}_assignedTo`] = t.errors.invalidChefId;
      }
    });
    setAssignErrors(errors);
    return Object.keys(errors).length === 0;
  }, [assignForm, t]);

  const createOrderMutation = useMutation<{ orderId: string; orderNumber: string }, Error, void>({
    mutationFn: async () => {
      if (!validateCreateForm()) throw new Error(t.errors.invalidForm);
      if (!user?.id) throw new Error('User not authenticated');
      const aggregatedItems = aggregateItemsByProduct(orderForm.items);
      const data = {
        orderNumber: `PROD-${Date.now()}-${Math.random().toString(36).slice(-6)}`,
        items: aggregatedItems,
        notes: orderForm.notes || undefined,
        priority: 'medium',
      };
      const response = await factoryOrdersAPI.create(data);
      return {
        orderId: response?.data?._id || crypto.randomUUID(),
        orderNumber: response?.data?.orderNumber || data.orderNumber,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['factoryOrders'] });
      setIsCreateModalOpen(false);
      dispatchOrderForm({ type: 'RESET' });
      setCreateErrors({});
      toast.success(t.notifications.orderCreated, { position: isRtl ? 'top-right' : 'top-left' });
      socket?.emit('factoryOrderCreated', {
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        eventId: crypto.randomUUID(),
      });
    },
    onError: (err: any) => {
      let errorMessage = err.message || t.errors.createOrder;
      if (err.response?.status === 429) {
        errorMessage = t.errors.tooManyRequests;
      } else if (err.response?.data?.errors?.length > 0) {
        errorMessage = err.response.data.errors.map((e: any) => e.msg).join(', ');
        err.response.data.errors.forEach((e: any, index: number) => {
          setCreateErrors((prev) => ({
            ...prev,
            [`item_${index}_${e.path}`]: e.msg,
          }));
        });
      } else if (err.message.includes('معرف المنتج غير صالح') || err.message.includes('Invalid product ID')) {
        errorMessage = t.errors.invalidProductId;
      } else if (err.message.includes('المنتج غير موجود') || err.message.includes('Product not found')) {
        errorMessage = t.errors.productNotFound;
      }
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
      setCreateErrors((prev) => ({ ...prev, form: errorMessage }));
    },
  });

  const assignChefsMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      if (!validateAssignForm()) throw new Error(t.errors.invalidForm);
      if (!selectedOrder) throw new Error(t.errors.noItemSelected);
      await factoryOrdersAPI.assignChefs(selectedOrder._id, {
        items: assignForm.items,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factoryOrders'] });
      setIsAssignModalOpen(false);
      dispatchAssignForm({ type: 'RESET' });
      setAssignErrors({});
      setSelectedOrder(null);
      toast.success(t.notifications.chefsAssigned, { position: isRtl ? 'top-right' : 'top-left' });
      socket?.emit('factoryTaskAssigned', {
        orderId: selectedOrder?._id,
        eventId: crypto.randomUUID(),
      });
    },
    onError: (err) => {
      let errorMessage = err.message || t.errors.assignChefs;
      toast.error(errorMessage, { position: isRtl ? 'top-right' : 'top-left' });
    },
  });

  const updateStatusMutation = useMutation<void, Error, OrderStatus>({
    mutationFn: async (newStatus) => {
      if (!selectedOrder) throw new Error(t.errors.noItemSelected);
      await factoryOrdersAPI.updateStatus(selectedOrder._id, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factoryOrders'] });
      setIsStatusModalOpen(false);
      setSelectedOrder(null);
      toast.success(t.notifications.statusUpdated, { position: isRtl ? 'top-right' : 'top-left' });
      socket?.emit('factoryOrderStatusUpdated', {
        orderId: selectedOrder?._id,
        eventId: crypto.randomUUID(),
      });
    },
    onError: (err) => {
      toast.error(err.message || t.errors.updateStatus, { position: isRtl ? 'top-right' : 'top-left' });
    },
  });

  const confirmProductionMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      if (!selectedOrder) throw new Error(t.errors.noItemSelected);
      await factoryOrdersAPI.confirmProduction(selectedOrder._id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factoryOrders'] });
      queryClient.invalidateQueries({ queryKey: ['factoryInventory'] });
      setIsConfirmModalOpen(false);
      setSelectedOrder(null);
      toast.success(t.notifications.productionConfirmed, { position: isRtl ? 'top-right' : 'top-left' });
      socket?.emit('factoryOrderCompleted', {
        orderId: selectedOrder?._id,
        eventId: crypto.randomUUID(),
      });
    },
    onError: (err) => {
      toast.error(err.message || t.errors.confirmProduction, { position: isRtl ? 'top-right' : 'top-left' });
    },
  });

  const errorMessage = ordersError?.message || '';

  return (
    <div className="mx-auto px-4 py-4">
      <div className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
            <p className="text-gray-600 text-sm">{t.description}</p>
          </div>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2"
          aria-label={t.create}
        >
          <Plus className="w-4 h-4" />
          {t.create}
        </button>
      </div>

      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600 text-sm font-medium">{errorMessage}</span>
        </motion.div>
      )}

      <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <ProductSearchInput
              value={searchInput}
              onChange={handleSearchChange}
              placeholder={t.search}
              ariaLabel={t.search}
              className="w-full"
            />
          </div>
          <div>
            <ProductDropdown
              value={filterStatus}
              onChange={(value) => {
                setFilterStatus(value as OrderStatus | '');
                setCurrentPage(1);
              }}
              options={statusOptions}
              ariaLabel={t.filterByStatus}
              className="w-full"
            />
          </div>
          <div>
            <ProductDropdown
              value={filterPriority}
              onChange={(value) => {
                setFilterPriority(value);
                setCurrentPage(1);
              }}
              options={priorityOptions}
              ariaLabel={t.filterByPriority}
              className="w-full"
            />
          </div>
        </div>
        <div className="mt-4 text-center text-sm text-gray-600 font-medium">
          {isRtl ? `عدد الطلبات: ${filteredOrders.length}` : `Orders Count: ${filteredOrders.length}`}
        </div>
      </div>

      {ordersLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
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
      ) : paginatedOrders.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100">
          <ClipboardList className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-sm font-medium">{t.noOrders}</p>
          <button
            onClick={handleOpenCreateModal}
            className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200"
            aria-label={t.create}
          >
            {t.create}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {paginatedOrders.map((order) => (
              <motion.div
                key={order._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 hover:border-amber-200"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-bold text-gray-900 text-base truncate" style={{ fontWeight: 700 }}>
                      {order.orderNumber}
                    </h3>
                    <p className="text-sm text-gray-500">{order.priority}</p>
                  </div>
                  <p className="text-sm text-amber-600">{t.status}: {t[order.status]}</p>
                  <p className="text-sm text-gray-600">{t.createdAt}: {new Date(order.createdAt).toLocaleDateString()}</p>
                  <p className="text-sm text-gray-600">{t.items}: {order.items.length}</p>
                  <p
                    className={`text-sm font-medium ${
                      order.status === OrderStatus.PENDING
                        ? 'text-yellow-600'
                        : order.status === OrderStatus.IN_PRODUCTION
                        ? 'text-blue-600'
                        : order.status === OrderStatus.COMPLETED
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {t[order.status]}
                  </p>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={() => handleOpenDetailsModal(order)}
                    className="p-2 text-green-600 hover:text-green-800 rounded-lg text-sm transition-colors duration-200"
                    aria-label={t.viewDetails}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {order.status === OrderStatus.PENDING && (
                    <button
                      onClick={() => handleOpenAssignModal(order)}
                      className="p-2 text-blue-600 hover:text-blue-800 rounded-lg text-sm transition-colors duration-200"
                      aria-label={t.assignChefs}
                    >
                      <UserCheck className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleOpenStatusModal(order)}
                    className="p-2 text-amber-600 hover:text-amber-800 rounded-lg text-sm transition-colors duration-200"
                    aria-label={t.updateStatus}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  {order.status === OrderStatus.IN_PRODUCTION && order.items.every(i => i.isCompleted) && (
                    <button
                      onClick={() => handleOpenConfirmModal(order)}
                      className="p-2 text-green-600 hover:text-green-800 rounded-lg text-sm transition-colors duration-200"
                      aria-label={t.confirmProduction}
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
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
            aria-label={isRtl ? 'الصفحة السابقة' : 'Previous page'}
          >
            {isRtl ? 'السابق' : 'Previous'}
          </button>
          <span className="text-gray-700 font-medium">
            {isRtl ? `الصفحة ${currentPage} من ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
            disabled={currentPage === totalPages}
            aria-label={isRtl ? 'الصفحة التالية' : 'Next page'}
          >
            {isRtl ? 'التالي' : 'Next'}
          </button>
        </div>
      )}

      {/* Create Modal */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isCreateModalOpen ? 1 : 0 }}
        className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 ${isCreateModalOpen ? '' : 'pointer-events-none'}`}
        role="dialog"
        aria-modal="true"
        aria-label={t.create}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: isCreateModalOpen ? 1 : 0.95, y: isCreateModalOpen ? 0 : 20 }}
          className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">{t.create}</h2>
            <button
              onClick={() => {
                setIsCreateModalOpen(false);
                dispatchOrderForm({ type: 'RESET' });
                setCreateErrors({});
              }}
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
                value={orderForm.notes}
                onChange={(e) => dispatchOrderForm({ type: 'SET_NOTES', payload: e.target.value })}
                placeholder={t.notesPlaceholder}
                className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm resize-none"
                rows={3}
                aria-label={t.notes}
              />
              {createErrors.form && <p className="text-red-600 text-xs mt-1">{createErrors.form}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.items}</label>
              {orderForm.items.map((item, index) => (
                <div key={index} className="flex flex-col gap-4 mb-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <ProductDropdown
                    value={item.product}
                    onChange={(value) => handleProductChange(index, value)}
                    options={productOptions}
                    ariaLabel={`${t.items} ${index + 1}`}
                    placeholder={t.selectProduct}
                    className="w-full"
                  />
                  {createErrors[`item_${index}_product`] && (
                    <p className="text-red-600 text-xs">{createErrors[`item_${index}_product`]}</p>
                  )}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t.quantity}</label>
                      <QuantityInput
                        value={item.quantity}
                        onChange={(val) => updateItemInForm(index, 'quantity', val)}
                        onIncrement={() => updateItemInForm(index, 'quantity', item.quantity + 1)}
                        onDecrement={() => updateItemInForm(index, 'quantity', item.quantity - 1)}
                      />
                      {createErrors[`item_${index}_quantity`] && (
                        <p className="text-red-600 text-xs mt-1">{createErrors[`item_${index}_quantity`]}</p>
                      )}
                    </div>
                    {orderForm.items.length > 1 && (
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
              ))}
              <button
                onClick={addItemToForm}
                className="flex items-center gap-2 text-amber-600 hover:text-amber-800 text-sm font-medium"
                aria-label={t.addItem}
              >
                <Plus className="w-4 h-4" />
                {t.addItem}
              </button>
              {createErrors.items && <p className="text-red-600 text-xs">{createErrors.items}</p>}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  dispatchOrderForm({ type: 'RESET' });
                  setCreateErrors({});
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors duration-200"
                aria-label={t.cancel}
              >
                {t.cancel}
              </button>
              <button
                onClick={() => createOrderMutation.mutate()}
                disabled={createOrderMutation.isPending}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
                aria-label={createOrderMutation.isPending ? t.submitting : t.submit}
              >
                {createOrderMutation.isPending ? t.submitting : t.submit}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Assign Modal */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isAssignModalOpen ? 1 : 0 }}
        className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 ${isAssignModalOpen ? '' : 'pointer-events-none'}`}
        role="dialog"
        aria-modal="true"
        aria-label={t.assignChefs}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: isAssignModalOpen ? 1 : 0.95, y: isAssignModalOpen ? 0 : 20 }}
          className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">{t.assignChefs}</h2>
            <button
              onClick={() => {
                setIsAssignModalOpen(false);
                dispatchAssignForm({ type: 'RESET' });
                setAssignErrors({});
                setSelectedOrder(null);
              }}
              className="p-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors duration-200"
              aria-label={t.cancel}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-4">
            {assignForm.items.map((item, index) => (
              <div key={index} className="flex flex-col gap-4 mb-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-sm text-gray-700">{selectedOrder?.items[index]?.product?.displayName || 'غير معروف'}</p>
                <ProductDropdown
                  value={item.assignedTo}
                  onChange={(value) => dispatchAssignForm({ type: 'UPDATE_ITEM', payload: { index, assignedTo: value } })}
                  options={chefOptions}
                  ariaLabel={t.selectChef}
                  placeholder={t.selectChef}
                  className="w-full"
                />
                {assignErrors[`item_${index}_assignedTo`] && (
                  <p className="text-red-600 text-xs">{assignErrors[`item_${index}_assignedTo`]}</p>
                )}
              </div>
            ))}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsAssignModalOpen(false);
                  dispatchAssignForm({ type: 'RESET' });
                  setAssignErrors({});
                  setSelectedOrder(null);
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors duration-200"
                aria-label={t.cancel}
              >
                {t.cancel}
              </button>
              <button
                onClick={() => assignChefsMutation.mutate()}
                disabled={assignChefsMutation.isPending}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
                aria-label={assignChefsMutation.isPending ? t.saving : t.save}
              >
                {assignChefsMutation.isPending ? t.saving : t.save}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Update Status Modal */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isStatusModalOpen ? 1 : 0 }}
        className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 ${isStatusModalOpen ? '' : 'pointer-events-none'}`}
        role="dialog"
        aria-modal="true"
        aria-label={t.updateStatus}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: isStatusModalOpen ? 1 : 0.95, y: isStatusModalOpen ? 0 : 20 }}
          className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">{t.updateStatus}</h2>
            <button
              onClick={() => {
                setIsStatusModalOpen(false);
                setSelectedOrder(null);
              }}
              className="p-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors duration-200"
              aria-label={t.cancel}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-4">
            <ProductDropdown
              value={selectedOrder?.status || ''}
              onChange={(value) => updateStatusMutation.mutate(value as OrderStatus)}
              options={statusOptions.filter((opt) => opt.value !== selectedOrder?.status)}
              ariaLabel={t.updateStatus}
              className="w-full"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsStatusModalOpen(false);
                  setSelectedOrder(null);
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors duration-200"
                aria-label={t.cancel}
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Confirm Production Modal */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isConfirmModalOpen ? 1 : 0 }}
        className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 ${isConfirmModalOpen ? '' : 'pointer-events-none'}`}
        role="dialog"
        aria-modal="true"
        aria-label={t.confirmProduction}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: isConfirmModalOpen ? 1 : 0.95, y: isConfirmModalOpen ? 0 : 20 }}
          className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">{t.confirmProduction}</h2>
            <button
              onClick={() => {
                setIsConfirmModalOpen(false);
                setSelectedOrder(null);
              }}
              className="p-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors duration-200"
              aria-label={t.cancel}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-gray-600 mb-4">{isRtl ? 'هل أنت متأكد من تأكيد الإنتاج؟ سيتم إضافة الكميات إلى المخزون.' : 'Are you sure you want to confirm production? Quantities will be added to inventory.'}</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setIsConfirmModalOpen(false);
                setSelectedOrder(null);
              }}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors duration-200"
              aria-label={t.cancel}
            >
              {t.cancel}
            </button>
            <button
              onClick={() => confirmProductionMutation.mutate()}
              disabled={confirmProductionMutation.isPending}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
              aria-label={confirmProductionMutation.isPending ? t.saving : t.save}
            >
              {confirmProductionMutation.isPending ? t.saving : t.save}
            </button>
          </div>
        </motion.div>
      </motion.div>

      {/* Details Modal */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isDetailsModalOpen ? 1 : 0 }}
        className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 ${isDetailsModalOpen ? '' : 'pointer-events-none'}`}
        role="dialog"
        aria-modal="true"
        aria-label={t.viewDetails}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: isDetailsModalOpen ? 1 : 0.95, y: isDetailsModalOpen ? 0 : 20 }}
          className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md sm:max-w-2xl max-h-[90vh] overflow-y-auto"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">{t.viewDetails}</h2>
            <button
              onClick={() => {
                setIsDetailsModalOpen(false);
                setSelectedOrder(null);
              }}
              className="p-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors duration-200"
              aria-label={t.cancel}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{t.orderNumber}: {selectedOrder?.orderNumber}</p>
            <p className="text-sm text-gray-600">{t.status}: {t[selectedOrder?.status || 'pending']}</p>
            <p className="text-sm text-gray-600">{t.priority}: {t[selectedOrder?.priority || 'medium']}</p>
            <p className="text-sm text-gray-600">{t.notes}: {selectedOrder?.notes || 'N/A'}</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.items}</label>
              <div className="space-y-2">
                {selectedOrder?.items.map((item) => (
                  <div key={item._id} className="p-2 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-sm text-gray-700">{item.product?.displayName || 'غير معروف'}</p>
                    <p className="text-sm text-gray-600">{t.quantity}: {item.quantity}</p>
                    <p className="text-sm text-gray-600">{t.status}: {item.status}</p>
                    <p className="text-sm text-gray-600">{t.assignedTo}: {item.assignedTo?.name || 'N/A'}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.history}</label>
              {selectedOrder?.statusHistory.length === 0 ? (
                <p className="text-gray-600 text-sm">{t.noHistory}</p>
              ) : (
                <div className="space-y-2">
                  {selectedOrder?.statusHistory.map((history, index) => (
                    <div key={index} className="p-2 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-sm text-gray-700">{t.status}: {history.status}</p>
                      <p className="text-sm text-gray-600">{t.changedByName}: {history.changedByName}</p>
                      <p className="text-sm text-gray-600">{t.changedAt}: {new Date(history.changedAt).toLocaleDateString()}</p>
                      <p className="text-sm text-gray-600">{t.notes}: {history.displayNotes || 'N/A'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => {
                  setIsDetailsModalOpen(false);
                  setSelectedOrder(null);
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors duration-200"
                aria-label={t.cancel}
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};
