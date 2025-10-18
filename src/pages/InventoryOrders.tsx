import React, { useReducer, useEffect, useMemo, useCallback, useRef, Suspense, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Card } from '../components/UI/Card';
import { Select } from '../components/UI/Select';
import { Button } from '../components/UI/Button';
import { Modal } from '../components/UI/Modal';
import { ProductSearchInput, ProductDropdown } from './OrdersTablePage';
import { ShoppingCart, AlertCircle, PlusCircle, Table2, Grid, Plus, MinusCircle , CheckCircle} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { factoryOrdersAPI, chefsAPI, productsAPI, inventoryAPI, departmentAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { useOrderNotifications } from '../hooks/useOrderNotifications';
import { FactoryOrder, Chef, AssignChefsForm, Product, FactoryOrderItem  ,UserRole } from '../types/types';
import Pagination from '../components/Shared/Pagination';
import OrderTable from '../components/production/OrderTable';
import OrderCardSkeleton from '../components/Shared/OrderCardSkeleton';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';

// Utility to translate units
const translateUnit = (unit: string, isRtl: boolean) => {
  const translations: Record<string, { ar: string; en: string }> = {
    'كيلو': { ar: 'كيلو', en: 'kg' },
    'قطعة': { ar: 'قطعة', en: 'piece' },
    'علبة': { ar: 'علبة', en: 'pack' },
    'صينية': { ar: 'صينية', en: 'tray' },
    'kg': { ar: 'كجم', en: 'kg' },
    'piece': { ar: 'قطعة', en: 'piece' },
    'pack': { ar: 'علبة', en: 'pack' },
    'tray': { ar: 'صينية', en: 'tray' },
  };
  return translations[unit] ? (isRtl ? translations[unit].ar : translations[unit].en) : isRtl ? 'وحدة' : 'unit';
};

// AssignChefsModal Component
interface AssignChefsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOrder: FactoryOrder | null;
  assignFormData: AssignChefsForm;
  chefs: Chef[];
  error: string;
  submitting: string | null;
  assignChefs: (orderId: string) => void;
  setAssignForm: (formData: AssignChefsForm) => void;
  isRtl: boolean;
}

export const AssignChefsModal: React.FC<AssignChefsModalProps> = ({
  isOpen,
  onClose,
  selectedOrder,
  assignFormData,
  chefs,
  error,
  submitting,
  assignChefs,
  setAssignForm,
  isRtl,
}) => {
  const { t } = useLanguage();

  const availableChefsByDepartment = useMemo(() => {
    const map = new Map<string, Chef[]>();
    chefs.forEach((chef) => {
      const deptId = chef.department?._id || 'no-department';
      if (!map.has(deptId)) {
        map.set(deptId, []);
      }
      map.get(deptId)!.push(chef);
    });
    return map;
  }, [chefs]);

  const updateAssignment = useCallback(
    (index: number, value: string) => {
      setAssignForm({
        items: assignFormData.items.map((item, idx) =>
          idx === index ? { ...item, assignedTo: value } : item
        ),
      });
    },
    [assignFormData.items, setAssignForm]
  );

  useEffect(() => {
    if (!selectedOrder) return;

    const updatedItems = assignFormData.items.map((item) => {
      const orderItem = selectedOrder.items.find((i) => i._id === item.itemId);
      const departmentId = orderItem?.department._id || 'no-department';
      const availableChefs = availableChefsByDepartment.get(departmentId) || [];
      return {
        ...item,
        unit: translateUnit(orderItem?.unit || 'unit', isRtl),
        assignedTo: item.assignedTo || (availableChefs.length === 1 ? availableChefs[0].userId : ''),
      };
    });

    const hasChanges = updatedItems.some(
      (item, idx) => item.assignedTo !== assignFormData.items[idx].assignedTo || item.unit !== assignFormData.items[idx].unit
    );
    if (hasChanges) {
      setAssignForm({ items: updatedItems });
    }
  }, [assignFormData.items, availableChefsByDepartment, selectedOrder, setAssignForm, isRtl]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isRtl ? `تعيين الشيفات لطلب ${selectedOrder?.orderNumber}` : `Assign Chefs to Order #${selectedOrder?.orderNumber}`}
      size="md"
      className="bg-white rounded-lg shadow-xl border border-gray-100"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (selectedOrder?.id) assignChefs(selectedOrder.id);
        }}
        className="space-y-6"
      >
        {assignFormData.items.map((item, index) => {
          const orderItem = selectedOrder?.items.find((i) => i._id === item.itemId);
          const departmentId = orderItem?.department._id || 'no-department';
          const availableChefs = availableChefsByDepartment.get(departmentId) || [];

          const chefOptions = [
            { value: '', label: isRtl ? 'اختر شيف' : 'Select Chef' },
            ...availableChefs.map((chef) => ({
              value: chef.userId,
              label: `${chef.displayName} (${chef.department?.displayName || (isRtl ? 'غير معروف' : 'Unknown')})`,
            })),
          ];

          return (
            <motion.div
              key={item.itemId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.1 }}
            >
              <label
                className={`block text-sm font-medium text-gray-900 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}
                htmlFor={`chef-select-${item.itemId}`}
              >
                {isRtl
                  ? `تعيين شيف لـ ${orderItem?.displayProductName || 'غير معروف'} (${item.quantity} ${item.unit})`
                  : `Assign chef to ${orderItem?.displayProductName || 'Unknown'} (${item.quantity} ${item.unit})`}
              </label>
              <Select
                id={`chef-select-${item.itemId}`}
                options={chefOptions}
                value={item.assignedTo}
                onChange={(value) => updateAssignment(index, value)}
                className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
                aria-label={isRtl ? 'اختر شيف' : 'Select Chef'}
                disabled={availableChefs.length === 0}
              />
              {availableChefs.length === 0 && (
                <p className="text-red-600 text-xs mt-1">
                  {isRtl ? 'لا يوجد شيفات متاحون لهذا القسم' : 'No chefs available for this department'}
                </p>
              )}
            </motion.div>
          );
        })}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}
          >
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-600 text-sm">{error}</span>
          </motion.div>
        )}
        <div className={`flex justify-end gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <Button
            variant="secondary"
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md px-4 py-2 text-sm shadow-sm"
            aria-label={isRtl ? 'إلغاء' : 'Cancel'}
          >
            {isRtl ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting !== null || assignFormData.items.some(item => !item.assignedTo)}
            className="bg-amber-500 hover:bg-amber-600 text-white rounded-md px-4 py-2 text-sm shadow-sm disabled:opacity-50"
            aria-label={isRtl ? 'تعيين الشيفات' : 'Assign Chefs'}
          >
            {submitting ? (isRtl ? 'جارٍ التحميل' : 'Loading') : (isRtl ? 'تعيين الشيفات' : 'Assign Chefs')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// OrderCard Component
interface OrderCardProps {
  order: FactoryOrder;
  calculateTotalQuantity: (order: FactoryOrder) => number;
  translateUnit: (unit: string, isRtl: boolean) => string;
  approveOrder: (orderId: string) => void;
  updateOrderStatus: (orderId: string, status: FactoryOrder['status']) => void;
  confirmItemCompletion: (orderId: string, itemId: string) => void;
  openAssignModal: (order: FactoryOrder) => void;
  confirmFactoryProduction: (orderId: string) => void;
  submitting: string | null;
  isRtl: boolean;
  currentUserRole: UserRole;
}

const translations = {
  ar: {
    orderNumber: 'رقم الطلب',
    date: 'التاريخ',
    items: 'العناصر',
    quantity: 'الكمية',
    status: 'الحالة',
    priority: 'الأولوية',
    notes: 'الملاحظات',
    createdBy: 'تم الإنشاء بواسطة',
    approve: 'الموافقة',
    complete: 'إكمال',
    cancel: 'إلغاء',
    assign: 'تعيين شيفات',
    confirmStock: 'تأكيد الإضافة إلى المخزون',
    requested: 'مطلوب',
    pending: 'قيد الانتظار',
    approved: 'تم الموافقة',
    in_production: 'في الإنتاج',
    completed: 'مكتمل',
    stocked: 'مخزن',
    cancelled: 'ملغى',
    low: 'منخفض',
    medium: 'متوسط',
    high: 'مرتفع',
    urgent: 'عاجل',
  },
  en: {
    orderNumber: 'Order Number',
    date: 'Date',
    items: 'Items',
    quantity: 'Quantity',
    status: 'Status',
    priority: 'Priority',
    notes: 'Notes',
    createdBy: 'Created By',
    approve: 'Approve',
    complete: 'Complete',
    cancel: 'Cancel',
    assign: 'Assign Chefs',
    confirmStock: 'Confirm Add to Inventory',
    requested: 'Requested',
    pending: 'Pending',
    approved: 'Approved',
    in_production: 'In Production',
    completed: 'Completed',
    stocked: 'Stocked',
    cancelled: 'Cancelled',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    urgent: 'Urgent',
  },
};

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  calculateTotalQuantity,
  translateUnit,
  approveOrder,
  updateOrderStatus,
  confirmItemCompletion,
  openAssignModal,
  confirmFactoryProduction,
  submitting,
  isRtl,
  currentUserRole,
}) => {
  const t = translations[isRtl ? 'ar' : 'en'];
  const statusStyles = useMemo(
    () => ({
      requested: 'bg-orange-100 text-orange-800',
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      in_production: 'bg-indigo-100 text-indigo-800',
      completed: 'bg-green-100 text-green-800',
      stocked: 'bg-purple-100 text-purple-800',
      cancelled: 'bg-red-100 text-red-800',
    }),
    []
  );
  const priorityStyles = useMemo(
    () => ({
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800',
    }),
    []
  );

  const canApprove = ['admin', 'production'].includes(currentUserRole);
  const canAssign = ['admin', 'production'].includes(currentUserRole);
  const canComplete = ['chef', 'admin', 'production'].includes(currentUserRole);
  const canConfirmStock = ['admin', 'production'].includes(currentUserRole);

  const allAssigned = order.items.every((item) => item.assignedTo);
  const allCompleted = order.items.every((item) => item.status === 'completed');
  const displayStatus = order.status === 'completed' && order.inventoryProcessed ? 'stocked' : order.status;

  return (
    <Card className="p-4 bg-white shadow-md rounded-lg border border-gray-200 hover:shadow-lg transition-shadow duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className={isRtl ? 'text-right' : 'text-left'}>
          <h3 className="text-sm font-semibold text-gray-800">{t.orderNumber}: {order.orderNumber}</h3>
          <p className="text-xs text-gray-600">{t.date}: {order.date}</p>
          <p className="text-xs text-gray-600">{t.createdBy}: {order.createdBy}</p>
          <p className="text-xs text-gray-600">
            {t.priority}: <span className={`px-2 py-1 rounded-full text-xs ${priorityStyles[order.priority]}`}>{t[order.priority]}</span>
          </p>
        </div>
        <div className={isRtl ? 'text-right' : 'text-left'}>
          <p className="text-xs text-gray-600">
            {t.status}: <span className={`px-2 py-1 rounded-full text-xs ${statusStyles[displayStatus]}`}>{t[displayStatus]}</span>
          </p>
          <p className="text-xs text-gray-600">{t.quantity}: {calculateTotalQuantity(order)}</p>
          <p className="text-xs text-gray-600">{t.notes}: {order.notes || '—'}</p>
        </div>
      </div>
      <div className="mt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">{t.items}</h4>
        <ul className="space-y-2">
          {order.items.map((item) => (
            <li key={item._id} className="text-xs text-gray-600 flex items-center justify-between gap-2">
              <span>
                {item.displayProductName} ({item.quantity} {translateUnit(item.unit, isRtl)})
                {item.assignedTo && <span className="text-gray-500 ml-2">({t.assign}: {item.assignedTo.displayName})</span>}
              </span>
              {order.status === 'in_production' && canComplete && item.assignedTo?._id === order.createdBy && item.status !== 'completed' && (
                <Button
                  variant="success"
                  onClick={() => confirmItemCompletion(order.id, item._id)}
                  disabled={submitting === item._id}
                  className="px-2 py-1 text-xs"
                >
                  {submitting === item._id ? '...' : <CheckCircle className="w-4 h-4" />}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className={`mt-4 flex gap-2 flex-wrap ${isRtl ? 'flex-row-reverse' : ''}`}>
        {(order.status === 'requested' || order.status === 'pending') && canApprove && (
          <Button
            variant="primary"
            onClick={() => approveOrder(order.id)}
            disabled={submitting === order.id}
            className="px-3 py-1 text-xs"
          >
            {submitting === order.id ? '...' : t.approve}
          </Button>
        )}
        {order.status === 'approved' && !allAssigned && canAssign && (
          <Button
            variant="primary"
            onClick={() => openAssignModal(order)}
            disabled={submitting === order.id}
            className="px-3 py-1 text-xs"
          >
            {submitting === order.id ? '...' : t.assign}
          </Button>
        )}
        {order.status === 'in_production' && allAssigned && allCompleted && canComplete && (
          <Button
            variant="success"
            onClick={() => updateOrderStatus(order.id, 'completed')}
            disabled={submitting === order.id}
            className="px-3 py-1 text-xs"
          >
            {submitting === order.id ? '...' : t.complete}
          </Button>
        )}
        {order.status === 'completed' && !order.inventoryProcessed && canConfirmStock && (
          <Button
            variant="success"
            onClick={() => confirmFactoryProduction(order.id)}
            disabled={submitting === order.id}
            className="px-3 py-1 text-xs"
          >
            {submitting === order.id ? '...' : t.confirmStock}
          </Button>
        )}
        {(order.status === 'requested' || order.status === 'pending' || order.status === 'approved' || order.status === 'in_production') && (
          <Button
            variant="danger"
            onClick={() => updateOrderStatus(order.id, 'cancelled')}
            disabled={submitting === order.id}
            className="px-3 py-1 text-xs"
          >
            {submitting === order.id ? '...' : t.cancel}
          </Button>
        )}
      </div>
    </Card>
  );
};

// QuantityInput Component
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

// InventoryOrders Component
interface State {
  orders: FactoryOrder[];
  selectedOrder: FactoryOrder | null;
  chefs: Chef[];
  products: Product[];
  departments: { _id: string; displayName: string }[];
  isAssignModalOpen: boolean;
  isCreateModalOpen: boolean;
  assignFormData: AssignChefsForm;
  createFormData: { notes: string; items: { productId: string; quantity: number; assignedTo?: string }[] };
  filterStatus: string;
  filterDepartment: string;
  searchQuery: string;
  debouncedSearchQuery: string;
  sortBy: 'date' | 'totalQuantity';
  sortOrder: 'asc' | 'desc';
  currentPage: number;
  loading: boolean;
  error: string;
  submitting: string | null;
  socketConnected: boolean;
  socketError: string | null;
  viewMode: 'card' | 'table';
  formErrors: Record<string, string>;
}

const initialState: State = {
  orders: [],
  selectedOrder: null,
  chefs: [],
  products: [],
  departments: [],
  isAssignModalOpen: false,
  isCreateModalOpen: false,
  assignFormData: { items: [] },
  createFormData: { notes: '', items: [{ productId: '', quantity: 1 }] },
  filterStatus: '',
  filterDepartment: '',
  searchQuery: '',
  debouncedSearchQuery: '',
  sortBy: 'date',
  sortOrder: 'desc',
  currentPage: 1,
  loading: true,
  error: '',
  submitting: null,
  socketConnected: false,
  socketError: null,
  viewMode: 'card',
  formErrors: {},
};

const reducer = (state: State, action: any): State => {
  switch (action.type) {
    case 'SET_ORDERS':
      return { ...state, orders: action.payload || [], error: '', currentPage: 1 };
    case 'ADD_ORDER':
      return { ...state, orders: [action.payload, ...state.orders.filter((o) => o.id !== action.payload.id)] };
    case 'SET_SELECTED_ORDER':
      return { ...state, selectedOrder: action.payload };
    case 'SET_CHEFS':
      return { ...state, chefs: action.payload || [] };
    case 'SET_PRODUCTS':
      return { ...state, products: action.payload || [] };
    case 'SET_DEPARTMENTS':
      return { ...state, departments: action.payload || [] };
    case 'SET_ASSIGN_MODAL':
      return { ...state, isAssignModalOpen: action.isOpen ?? false };
    case 'SET_CREATE_MODAL':
      return { ...state, isCreateModalOpen: action.isOpen ?? false };
    case 'SET_ASSIGN_FORM':
      return { ...state, assignFormData: action.payload };
    case 'SET_CREATE_FORM':
      return { ...state, createFormData: action.payload };
    case 'SET_FORM_ERRORS':
      return { ...state, formErrors: action.payload };
    case 'SET_FILTER_STATUS':
      return { ...state, filterStatus: action.payload, currentPage: 1 };
    case 'SET_FILTER_DEPARTMENT':
      return { ...state, filterDepartment: action.payload, currentPage: 1 };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload, currentPage: 1 };
    case 'SET_DEBOUNCED_SEARCH':
      return { ...state, debouncedSearchQuery: action.payload };
    case 'SET_SORT':
      return { ...state, sortBy: action.by ?? 'date', sortOrder: action.order ?? 'desc', currentPage: 1 };
    case 'SET_PAGE':
      return { ...state, currentPage: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_SUBMITTING':
      return { ...state, submitting: action.payload };
    case 'SET_SOCKET_CONNECTED':
      return { ...state, socketConnected: action.payload };
    case 'SET_SOCKET_ERROR':
      return { ...state, socketError: action.payload };
    case 'UPDATE_ORDER_STATUS':
      return {
        ...state,
        orders: state.orders.map((o) =>
          o.id === action.orderId ? { ...o, status: action.status! } : o
        ),
        selectedOrder:
          state.selectedOrder && state.selectedOrder.id === action.orderId
            ? { ...state.selectedOrder, status: action.status! }
            : state.selectedOrder,
      };
    case 'UPDATE_ITEM_STATUS':
      return {
        ...state,
        orders: state.orders.map((order) =>
          order.id === action.orderId
            ? {
                ...order,
                items: order.items.map((item) =>
                  item._id === action.payload.itemId ? { ...item, status: action.payload.status } : item
                ),
                status:
                  order.items.every((i) => i.status === 'completed') && order.status !== 'completed'
                    ? 'completed'
                    : order.status,
              }
            : order
        ),
        selectedOrder:
          state.selectedOrder && state.selectedOrder.id === action.orderId
            ? {
                ...state.selectedOrder,
                items: state.selectedOrder.items.map((item) =>
                  item._id === action.payload.itemId ? { ...item, status: action.payload.status } : item
                ),
                status:
                  state.selectedOrder.items.every((i) => i.status === 'completed') &&
                  state.selectedOrder.status !== 'completed'
                    ? 'completed'
                    : state.selectedOrder.status,
              }
            : state.selectedOrder,
      };
    case 'TASK_ASSIGNED':
      return {
        ...state,
        orders: state.orders.map((order) =>
          order.id === action.orderId
            ? {
                ...order,
                items: order.items.map((i) => {
                  const assignment = action.items?.find((a) => a._id === i._id);
                  return assignment
                    ? {
                        ...i,
                        assignedTo: assignment.assignedTo
                          ? {
                              _id: assignment.assignedTo._id,
                              username: assignment.assignedTo.username,
                              name: assignment.assignedTo.name,
                              nameEn: assignment.assignedTo.nameEn,
                              displayName: state.isRtl
                                ? assignment.assignedTo.name
                                : assignment.assignedTo.nameEn || assignment.assignedTo.name,
                              department: assignment.assignedTo.department,
                            }
                          : undefined,
                        status: assignment.status || i.status,
                      }
                    : i
                }),
                status: order.items.every((i) => i.status === 'assigned') ? 'in_production' : order.status,
              }
            : order
        ),
        selectedOrder:
          state.selectedOrder && state.selectedOrder.id === action.orderId
            ? {
                ...state.selectedOrder,
                items: state.selectedOrder.items.map((i) => {
                  const assignment = action.items?.find((a) => a._id === i._id);
                  return assignment
                    ? {
                        ...i,
                        assignedTo: assignment.assignedTo
                          ? {
                              _id: assignment.assignedTo._id,
                              username: assignment.assignedTo.username,
                              name: assignment.assignedTo.name,
                              nameEn: assignment.assignedTo.nameEn,
                              displayName: state.isRtl
                                ? assignment.assignedTo.name
                                : assignment.assignedTo.nameEn || assignment.assignedTo.name,
                              department: assignment.assignedTo.department,
                            }
                          : undefined,
                        status: assignment.status || i.status,
                      }
                    : i
                }),
                status: state.selectedOrder.items.every((i) => i.status === 'assigned')
                  ? 'in_production'
                  : state.selectedOrder.status,
              }
            : state.selectedOrder,
      };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload, currentPage: 1 };
    default:
      return state;
  }
};

const ORDERS_PER_PAGE = { card: 12, table: 50 };

const validTransitions: Record<FactoryOrder['status'], FactoryOrder['status'][]> = {
  requested: ['approved', 'cancelled'],
  pending: ['approved', 'cancelled'],
  approved: ['in_production', 'cancelled'],
  in_production: ['completed', 'cancelled'],
  completed: ['stocked'],
  stocked: [],
  cancelled: [],
};

const statusOptions = [
  { value: '', label: 'all_statuses' },
  { value: 'requested', label: 'requested' },
  { value: 'pending', label: 'pending' },
  { value: 'approved', label: 'approved' },
  { value: 'in_production', label: 'in_production' },
  { value: 'completed', label: 'completed' },
  { value: 'stocked', label: 'stocked' },
  { value: 'cancelled', label: 'cancelled' },
];

const sortOptions = [
  { value: 'date', label: 'sort_date' },
  { value: 'totalQuantity', label: 'sort_total_quantity' },
];

const normalizeText = (text: string) => {
  return text
    .normalize('NFD')
    .replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, '')
    .replace(/أ|إ|آ|ٱ/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .trim();
};

export const InventoryOrders: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { socket, isConnected, emit } = useSocket();
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  const listRef = useRef<HTMLDivElement>(null);
  const playNotificationSound = useOrderNotifications(dispatch, stateRef, user);
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      dispatch({ type: 'SET_DEBOUNCED_SEARCH', payload: searchInput });
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const calculateTotalQuantity = useCallback((order: FactoryOrder) => {
    return order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }, []);

  const fetchData = useCallback(
    async (retryCount = 0) => {
      if (!user || !['chef', 'production_manager', 'admin'].includes(user.role)) {
        dispatch({ type: 'SET_ERROR', payload: isRtl ? 'غير مصرح للوصول' : 'Unauthorized access' });
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const query: Record<string, any> = {
          sortBy: state.sortBy,
          sortOrder: state.sortOrder,
          search: state.debouncedSearchQuery || undefined,
        };
        if (user.role === 'production_manager' && user.department) query.department = user.department._id;
        const [ordersResponse, chefsResponse, productsResponse, departmentsResponse] = await Promise.all([
          factoryOrdersAPI.getAll(query),
          chefsAPI.getAll(),
          productsAPI.getAll(),
          departmentAPI.getAll(),
        ]);
        const ordersData = Array.isArray(ordersResponse.data) ? ordersResponse.data : [];
        const mappedOrders: FactoryOrder[] = ordersData
          .filter((order: any) => order && order._id && order.orderNumber)
          .map((order: any) => ({
            id: order._id,
            orderNumber: order.orderNumber,
            items: Array.isArray(order.items)
              ? order.items.map((item: any) => ({
                  _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
                  productId: item.product?._id || 'unknown',
                  productName: item.product?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                  productNameEn: item.product?.nameEn,
                  displayProductName: isRtl ? item.product?.name : item.product?.nameEn || item.product?.name,
                  quantity: Number(item.quantity) || 1,
                  unit: item.product?.unit || 'unit',
                  unitEn: item.product?.unitEn,
                  displayUnit: translateUnit(item.product?.unit || 'unit', isRtl),
                  department: {
                    _id: item.product?.department?._id || 'no-department',
                    name: item.product?.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: item.product?.department?.nameEn,
                    displayName: isRtl
                      ? item.product?.department?.name
                      : item.product?.department?.nameEn || item.product?.department?.name,
                  },
                  assignedTo: item.assignedTo
                    ? {
                        _id: item.assignedTo._id,
                        username: item.assignedTo.username,
                        name: item.assignedTo.name || (isRtl ? 'غير معروف' : 'Unknown'),
                        nameEn: item.assignedTo.nameEn,
                        displayName: isRtl
                          ? item.assignedTo.name
                          : item.assignedTo.nameEn || item.assignedTo.name,
                        department: {
                          _id: item.assignedTo.department?._id || 'no-department',
                          name: item.assignedTo.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                          nameEn: item.assignedTo.department?.nameEn,
                          displayName: isRtl
                            ? item.assignedTo.department?.name
                            : item.assignedTo.department?.nameEn || item.assignedTo.department?.name,
                        },
                      }
                    : undefined,
                  status: item.status || 'pending',
                }))
              : [],
            status: order.status || (order.createdBy?.role === 'chef' ? 'requested' : 'approved'),
            date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
            notes: order.notes || '',
            priority: order.priority || 'medium',
            createdBy: order.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
            createdByRole: order.createdBy?.role || 'unknown',
            inventoryProcessed: order.inventoryProcessed || false,
          }));
        dispatch({ type: 'SET_ORDERS', payload: mappedOrders });
        dispatch({
          type: 'SET_CHEFS',
          payload: Array.isArray(chefsResponse.data)
            ? chefsResponse.data
                .filter((chef: any) => chef && chef.user?._id)
                .map((chef: any) => ({
                  _id: chef._id,
                  userId: chef.user._id,
                  name: chef.user?.name || chef.name || (isRtl ? 'غير معروف' : 'Unknown'),
                  nameEn: chef.user?.nameEn || chef.nameEn,
                  displayName: isRtl
                    ? chef.user?.name || chef.name
                    : chef.user?.nameEn || chef.nameEn || chef.user?.name || chef.name,
                  department: chef.department
                    ? {
                        _id: chef.department._id || 'no-department',
                        name: chef.department.name || (isRtl ? 'غير معروف' : 'Unknown'),
                        nameEn: chef.department.nameEn,
                        displayName: isRtl
                          ? chef.department.name
                          : chef.department.nameEn || chef.department.name,
                      }
                    : { _id: 'no-department', name: isRtl ? 'غير معروف' : 'Unknown', displayName: isRtl ? 'غير معروف' : 'Unknown' },
                  status: chef.status || 'active',
                }))
            : [],
        });
        dispatch({
          type: 'SET_PRODUCTS',
          payload: Array.isArray(productsResponse.data)
            ? productsResponse.data
                .filter((product: any) => product && product._id)
                .map((product: any) => ({
                  _id: product._id,
                  name: product.name || (isRtl ? 'غير معروف' : 'Unknown'),
                  nameEn: product.nameEn,
                  unit: product.unit || 'unit',
                  unitEn: product.unitEn,
                  department: {
                    _id: product.department?._id || 'no-department',
                    name: product.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: product.department?.nameEn,
                    displayName: isRtl
                      ? product.department?.name
                      : product.department?.nameEn || product.department?.name,
                  },
                  maxStockLevel: product.maxStockLevel || 1000,
                }))
                .sort((a: Product, b: Product) => {
                  const nameA = isRtl ? a.name : a.nameEn || a.name;
                  const nameB = isRtl ? b.name : b.nameEn || b.name;
                  return nameA.localeCompare(nameB, language);
                })
            : [],
        });
        dispatch({
          type: 'SET_DEPARTMENTS',
          payload: Array.isArray(departmentsResponse.data)
            ? departmentsResponse.data.map((d: any) => ({
                _id: d._id,
                displayName: isRtl ? d.name : d.nameEn || d.name,
              }))
            : [],
        });
        dispatch({ type: 'SET_ERROR', payload: '' });
      } catch (err: any) {
        console.error('Fetch data error:', err.message);
        if (retryCount < 3) {
          setTimeout(() => fetchData(retryCount + 1), 2000);
          return;
        }
        const errorMessage =
          err.response?.status === 404
            ? isRtl
              ? 'لم يتم العثور على طلبات'
              : 'No orders found'
            : isRtl
            ? `خطأ في جلب الطلبات: ${err.message}`
            : `Error fetching orders: ${err.message}`;
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [user, state.sortBy, state.sortOrder, state.debouncedSearchQuery, isRtl, language]
  );

  useEffect(() => {
    if (!user || !['chef', 'production_manager', 'admin'].includes(user.role) || !socket) {
      dispatch({ type: 'SET_ERROR', payload: isRtl ? 'غير مصرح للوصول' : 'Unauthorized access' });
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }
    const reconnectInterval = setInterval(() => {
      if (!isConnected && socket) {
        console.log('Attempting to reconnect WebSocket...');
        socket.connect();
      }
    }, 5000);
    socket.on('connect', () => {
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: true });
      dispatch({ type: 'SET_SOCKET_ERROR', payload: null });
    });
    socket.on('connect_error', (err) => {
      console.error('Socket connect error:', err.message);
      dispatch({ type: 'SET_SOCKET_ERROR', payload: isRtl ? 'خطأ في الاتصال' : 'Connection error' });
      dispatch({ type: 'SET_SOCKET_CONNECTED', payload: false });
    });
    socket.on('newFactoryOrder', (order: any) => {
      if (!order || !order._id || !order.orderNumber) {
        console.warn('Invalid new factory order data:', order);
        return;
      }
      const mappedOrder: FactoryOrder = {
        id: order._id,
        orderNumber: order.orderNumber,
        items: Array.isArray(order.items)
          ? order.items.map((item: any) => ({
              _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
              productId: item.product?._id || 'unknown',
              productName: item.product?.name || (isRtl ? 'غير معروف' : 'Unknown'),
              productNameEn: item.product?.nameEn,
              displayProductName: isRtl ? item.product?.name : item.product?.nameEn || item.product?.name,
              quantity: Number(item.quantity) || 1,
              unit: item.product?.unit || 'unit',
              unitEn: item.product?.unitEn,
              displayUnit: translateUnit(item.product?.unit || 'unit', isRtl),
              department: {
                _id: item.product?.department?._id || 'no-department',
                name: item.product?.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                nameEn: item.product?.department?.nameEn,
                displayName: isRtl
                  ? item.product?.department?.name
                  : item.product?.department?.nameEn || item.product?.department?.name,
              },
              assignedTo: item.assignedTo
                ? {
                    _id: item.assignedTo._id,
                    username: item.assignedTo.username,
                    name: item.assignedTo.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: item.assignedTo.nameEn,
                    displayName: isRtl
                      ? item.assignedTo.name
                      : item.assignedTo.nameEn || item.assignedTo.name,
                    department: {
                      _id: item.assignedTo.department?._id || 'no-department',
                      name: item.assignedTo.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                      nameEn: item.assignedTo.department?.nameEn,
                      displayName: isRtl
                        ? item.assignedTo.department?.name
                        : item.assignedTo.department?.nameEn || item.assignedTo.department?.name,
                    },
                  }
                : undefined,
              status: item.status || 'pending',
            }))
          : [],
        status: order.status || (order.createdBy?.role === 'chef' ? 'requested' : 'approved'),
        date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
        notes: order.notes || '',
        priority: order.priority || 'medium',
        createdBy: order.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
        createdByRole: order.createdBy?.role || 'unknown',
        inventoryProcessed: order.inventoryProcessed || false,
      };
      dispatch({ type: 'ADD_ORDER', payload: mappedOrder });
      playNotificationSound('/sounds/notification.mp3', [200, 100, 200]);
      toast.success(isRtl ? `طلب إنتاج جديد: ${order.orderNumber}` : `New production order: ${order.orderNumber}`, {
        position: isRtl ? 'top-left' : 'top-right',
      });
    });
    socket.on('orderStatusUpdated', ({ orderId, status }: { orderId: string; status: FactoryOrder['status'] }) => {
      if (!orderId || !status) {
        console.warn('Invalid order status update data:', { orderId, status });
        return;
      }
      dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status });
      toast.info(isRtl ? `تم تحديث حالة الطلب ${orderId} إلى ${status}` : `Order ${orderId} status updated to ${status}`, {
        position: isRtl ? 'top-left' : 'top-right',
      });
    });
    socket.on('itemStatusUpdated', ({ orderId, itemId, status }: { orderId: string; itemId: string; status: FactoryOrderItem['status'] }) => {
      if (!orderId || !itemId || !status) {
        console.warn('Invalid item status update data:', { orderId, itemId, status });
        return;
      }
      dispatch({ type: 'UPDATE_ITEM_STATUS', orderId, payload: { itemId, status } });
      toast.info(isRtl ? `تم تحديث حالة العنصر في الطلب ${orderId}` : `Item status updated in order ${orderId}`, {
        position: isRtl ? 'top-left' : 'top-right',
      });
    });
    socket.on('taskAssigned', ({ orderId, items }: { orderId: string; items: any[] }) => {
      if (!orderId || !items) {
        console.warn('Invalid task assigned data:', { orderId, items });
        return;
      }
      dispatch({ type: 'TASK_ASSIGNED', orderId, items });
      toast.info(isRtl ? 'تم تعيين الشيفات' : 'Chefs assigned', { position: isRtl ? 'top-left' : 'top-right' });
    });
    return () => {
      clearInterval(reconnectInterval);
      socket.off('connect');
      socket.off('connect_error');
      socket.off('newFactoryOrder');
      socket.off('orderStatusUpdated');
      socket.off('itemStatusUpdated');
      socket.off('taskAssigned');
    };
  }, [user, socket, isConnected, isRtl, language, playNotificationSound]);

  const validateCreateForm = useCallback(() => {
    const errors: Record<string, string> = {};
    const t = isRtl
      ? {
          productRequired: 'المنتج مطلوب',
          quantityRequired: 'الكمية مطلوبة',
          quantityInvalid: 'الكمية يجب أن تكون أكبر من 0',
          chefRequired: 'الشيف مطلوب',
        }
      : {
          productRequired: 'Product is required',
          quantityRequired: 'Quantity is required',
          quantityInvalid: 'Quantity must be greater than 0',
          chefRequired: 'Chef is required',
        };
    state.createFormData.items.forEach((item, index) => {
      if (!item.productId) {
        errors[`item_${index}_productId`] = t.productRequired;
      }
      if (!item.quantity || item.quantity < 1) {
        errors[`item_${index}_quantity`] = item.quantity === 0 ? t.quantityRequired : t.quantityInvalid;
      }
      if (['admin', 'production_manager'].includes(user.role) && !item.assignedTo && item.productId) {
        const product = state.products.find(p => p._id === item.productId);
        const availableChefs = state.chefs.filter(c => c.department?._id === product?.department._id);
        if (availableChefs.length > 0) {
          errors[`item_${index}_assignedTo`] = t.chefRequired;
        }
      }
    });
    dispatch({ type: 'SET_FORM_ERRORS', payload: errors });
    return Object.keys(errors).length === 0;
  }, [state.createFormData, state.products, state.chefs, isRtl, user.role]);

  const createOrder = useCallback(async () => {
    if (!user?.id || !validateCreateForm()) {
      return;
    }
    dispatch({ type: 'SET_SUBMITTING', payload: 'create' });
    try {
      const orderNumber = `ORD-${Date.now()}`;
      const isAdminOrManager = ['admin', 'production_manager'].includes(user.role);
      const initialStatus = isAdminOrManager && state.createFormData.items.every(i => i.assignedTo) ? 'in_production' : isAdminOrManager ? 'pending' : 'requested';
      const items = state.createFormData.items.map((i) => ({
        product: i.productId,
        quantity: i.quantity,
        assignedTo: user.role === 'chef' ? user.id : i.assignedTo,
      }));
      const response = await factoryOrdersAPI.create({
        orderNumber,
        items,
        notes: state.createFormData.notes,
        priority: 'medium',
      });
      const newOrder: FactoryOrder = {
        id: response.data._id,
        orderNumber: response.data.orderNumber,
        items: response.data.items.map((item: any) => ({
          _id: item._id,
          productId: item.product._id,
          productName: item.product.name,
          productNameEn: item.product.nameEn,
          displayProductName: isRtl ? item.product.name : item.product.nameEn || item.product.name,
          quantity: Number(item.quantity),
          unit: item.product.unit,
          unitEn: item.product.unitEn,
          displayUnit: translateUnit(item.product.unit, isRtl),
          department: {
            _id: item.product.department._id,
            name: item.product.department.name,
            nameEn: item.product.department.nameEn,
            displayName: isRtl
              ? item.product.department.name
              : item.product.department.nameEn || item.product.department.name,
          },
          assignedTo: item.assignedTo
            ? {
                _id: item.assignedTo._id,
                username: item.assignedTo.username,
                name: item.assignedTo.name,
                nameEn: item.assignedTo.nameEn,
                displayName: isRtl ? item.assignedTo.name : item.assignedTo.nameEn || item.assignedTo.name,
                department: {
                  _id: item.assignedTo.department._id,
                  name: item.assignedTo.department.name,
                  nameEn: item.assignedTo.department.nameEn,
                  displayName: isRtl
                    ? item.assignedTo.department.name
                    : item.assignedTo.department.nameEn || item.assignedTo.department.name,
                },
              }
            : undefined,
          status: item.status || 'pending',
        })),
        status: response.data.status || initialStatus,
        date: formatDate(new Date(response.data.createdAt), language),
        notes: response.data.notes || '',
        priority: response.data.priority || 'medium',
        createdBy: user.name || (isRtl ? 'غير معروف' : 'Unknown'),
        createdByRole: user.role,
        inventoryProcessed: response.data.inventoryProcessed || false,
      };
      dispatch({ type: 'ADD_ORDER', payload: newOrder });
      dispatch({ type: 'SET_CREATE_MODAL', isOpen: false });
      dispatch({ type: 'SET_CREATE_FORM', payload: { notes: '', items: [{ productId: '', quantity: 1 }] } });
      dispatch({ type: 'SET_FORM_ERRORS', payload: {} });
      if (socket && isConnected) {
        emit('newFactoryOrder', newOrder);
      }
      toast.success(isRtl ? 'تم إنشاء طلب الإنتاج بنجاح' : 'Production order created successfully', {
        position: isRtl ? 'top-left' : 'top-right',
      });
      if (isAdminOrManager && state.createFormData.items.some(i => !i.assignedTo)) {
        dispatch({ type: 'SET_SELECTED_ORDER', payload: newOrder });
        dispatch({
          type: 'SET_ASSIGN_FORM',
          payload: {
            items: newOrder.items
              .filter((item) => !item.assignedTo)
              .map((item) => ({
                itemId: item._id,
                assignedTo: '',
                product: item.displayProductName,
                quantity: item.quantity,
                unit: translateUnit(item.unit, isRtl),
              })),
          },
        });
        dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: true });
      }
    } catch (err: any) {
      console.error('Create order error:', err.message);
      const errorMessage = isRtl ? `فشل في إنشاء الطلب: ${err.message}` : `Failed to create order: ${err.message}`;
      dispatch({ type: 'SET_FORM_ERRORS', payload: { form: errorMessage } });
      toast.error(errorMessage, { position: isRtl ? 'top-left' : 'top-right' });
    } finally {
      dispatch({ type: 'SET_SUBMITTING', payload: null });
    }
  }, [user, state.createFormData, state.products, state.chefs, isRtl, socket, isConnected, emit, language, validateCreateForm]);

  const approveOrder = useCallback(
    async (orderId: string) => {
      if (!user || !['admin', 'production_manager'].includes(user.role)) {
        toast.error(isRtl ? 'غير مصرح بالموافقة' : 'Not authorized to approve', {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        await factoryOrdersAPI.approve(orderId);
        dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status: 'approved' });
        if (socket && isConnected) {
          emit('orderStatusUpdated', { orderId, status: 'approved' });
        }
        toast.success(isRtl ? 'تم الموافقة على الطلب' : 'Order approved successfully', {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error('Approve order error:', err.message);
        toast.error(isRtl ? `فشل في الموافقة على الطلب: ${err.message}` : `Failed to approve order: ${err.message}`, {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [user, isRtl, socket, isConnected, emit]
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, newStatus: FactoryOrder['status']) => {
      const order = state.orders.find((o) => o.id === orderId);
      if (!order || !validTransitions[order.status].includes(newStatus)) {
        toast.error(isRtl ? 'انتقال غير صالح' : 'Invalid transition', { position: isRtl ? 'top-left' : 'top-right' });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        await factoryOrdersAPI.updateStatus(orderId, { status: newStatus });
        if (newStatus === 'stocked') {
          const items = order.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          }));
          await inventoryAPI.addToInventory({ orderId, items });
        }
        dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status: newStatus });
        if (socket && isConnected) {
          emit('orderStatusUpdated', { orderId, status: newStatus });
        }
        toast.success(isRtl ? `تم تحديث الحالة إلى: ${newStatus}` : `Order status updated to: ${newStatus}`, {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error('Update order status error:', err.message);
        toast.error(isRtl ? `فشل في تحديث الحالة: ${err.message}` : `Failed to update status: ${err.message}`, {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [user, state.orders, isRtl, socket, isConnected, emit]
  );

  const confirmItemCompletion = useCallback(
    async (orderId: string, itemId: string) => {
      if (!user?.id || user.role !== 'chef') {
        toast.error(isRtl ? 'غير مصرح بتأكيد الإنتاج' : 'Not authorized to confirm production', {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      const order = state.orders.find((o) => o.id === orderId);
      if (!order) {
        toast.error(isRtl ? 'الطلب غير موجود' : 'Order not found', { position: isRtl ? 'top-left' : 'top-right' });
        return;
      }
      const item = order.items.find((i) => i._id === itemId);
      if (!item || item.assignedTo?._id !== user.id) {
        toast.error(isRtl ? 'غير مصرح بتأكيد هذا العنصر' : 'Not authorized to confirm this item', {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: itemId });
      try {
        await factoryOrdersAPI.updateItemStatus(orderId, itemId, { status: 'completed' });
        dispatch({ type: 'UPDATE_ITEM_STATUS', orderId, payload: { itemId, status: 'completed' } });
        if (socket && isConnected) {
          emit('itemStatusUpdated', { orderId, itemId, status: 'completed' });
        }
        toast.success(isRtl ? 'تم تأكيد إكمال الإنتاج' : 'Production completion confirmed', {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error('Confirm item completion error:', err.message);
        toast.error(isRtl ? `فشل في تأكيد الإنتاج: ${err.message}` : `Failed to confirm production: ${err.message}`, {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [user, state.orders, isRtl, socket, isConnected, emit]
  );

  const confirmFactoryProduction = useCallback(
    async (orderId: string) => {
      if (!user || !['admin', 'production_manager'].includes(user.role)) {
        toast.error(isRtl ? 'غير مصرح بتأكيد الإنتاج' : 'Not authorized to confirm production', {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        await factoryOrdersAPI.confirmProduction(orderId);
        dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status: 'stocked' });
        if (socket && isConnected) {
          emit('orderStatusUpdated', { orderId, status: 'stocked' });
        }
        toast.success(isRtl ? 'تم تأكيد الإنتاج وإضافته إلى المخزون' : 'Production confirmed and added to inventory', {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error('Confirm production error:', err.message);
        toast.error(isRtl ? `فشل في تأكيد الإنتاج: ${err.message}` : `Failed to confirm production: ${err.message}`, {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [user, isRtl, socket, isConnected, emit]
  );

  const assignChefs = useCallback(
    async (orderId: string) => {
      if (!user?.id || state.assignFormData.items.some((item) => !item.assignedTo)) {
        toast.error(isRtl ? 'يرجى تعيين شيف لكل عنصر' : 'Please assign a chef to each item', {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      dispatch({ type: 'SET_SUBMITTING', payload: orderId });
      try {
        const response = await factoryOrdersAPI.assignChefs(orderId, state.assignFormData);
        const items = state.assignFormData.items.map((item) => ({
          _id: item.itemId,
          assignedTo: state.chefs.find((chef) => chef.userId === item.assignedTo) || {
            _id: item.assignedTo,
            username: 'unknown',
            name: isRtl ? 'غير معروف' : 'Unknown',
            displayName: isRtl ? 'غير معروف' : 'Unknown',
            department: {
              _id: 'no-department',
              name: isRtl ? 'غير معروف' : 'Unknown',
              displayName: isRtl ? 'غير معروف' : 'Unknown',
            },
          },
          status: 'assigned' as FactoryOrderItem['status'],
        }));
        dispatch({ type: 'TASK_ASSIGNED', orderId, items });
        dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: false });
        dispatch({ type: 'SET_ASSIGN_FORM', payload: { items: [] } });
        dispatch({ type: 'SET_SELECTED_ORDER', payload: null });
        if (socket && isConnected) {
          emit('taskAssigned', { orderId, items });
        }
        toast.success(isRtl ? 'تم تعيين الشيفات بنجاح' : 'Chefs assigned successfully', {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        console.error('Assign chefs error:', err.message);
        toast.error(isRtl ? `فشل في تعيين الشيفات: ${err.message}` : `Failed to assign chefs: ${err.message}`, {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } finally {
        dispatch({ type: 'SET_SUBMITTING', payload: null });
      }
    },
    [user, state.assignFormData, state.chefs, socket, isConnected, emit, isRtl]
  );

  const openAssignModal = useCallback(
    (order: FactoryOrder) => {
      if (order.createdByRole === 'chef') {
        toast.info(isRtl ? 'الطلب مُسند تلقائيًا للشيف الذي أنشأه' : 'Order is automatically assigned to the chef who created it', {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      if (order.status !== 'approved') {
        toast.error(isRtl ? 'الطلب لم يتم الموافقة عليه' : 'Order not approved', {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      const unassignedItems = order.items.filter((item) => !item.assignedTo);
      if (unassignedItems.length === 0) {
        toast.info(isRtl ? 'جميع العناصر مسندة بالفعل' : 'All items are already assigned', {
          position: isRtl ? 'top-left' : 'top-right',
        });
        return;
      }
      dispatch({ type: 'SET_SELECTED_ORDER', payload: order });
      dispatch({
        type: 'SET_ASSIGN_FORM',
        payload: {
          items: unassignedItems.map((item) => ({
            itemId: item._id,
            assignedTo: '',
            product: item.displayProductName,
            quantity: item.quantity,
            unit: translateUnit(item.unit, isRtl),
          })),
        },
      });
      dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: true });
    },
    [isRtl]
  );

  const handlePageChange = useCallback((page: number) => {
    dispatch({ type: 'SET_PAGE', payload: page });
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!state.chefs.length && !state.loading && (state.isAssignModalOpen || state.isCreateModalOpen)) {
      console.warn('No chefs loaded, retrying fetch...');
      fetchData();
    }
    if (!state.products.length && !state.loading && state.isCreateModalOpen) {
      console.warn('No products loaded, retrying fetch...');
      fetchData();
    }
  }, [state.chefs, state.products, state.loading, state.isAssignModalOpen, state.isCreateModalOpen, fetchData]);

  const filteredOrders = useMemo(() => {
    const normalizedQuery = normalizeText(state.debouncedSearchQuery);
    return state.orders
      .filter((order) => order)
      .filter(
        (order) =>
          normalizeText(order.orderNumber || '').includes(normalizedQuery) ||
          normalizeText(order.notes || '').includes(normalizedQuery) ||
          normalizeText(order.createdBy || '').includes(normalizedQuery) ||
          order.items.some((item) => normalizeText(item.displayProductName || '').includes(normalizedQuery))
      )
      .filter(
        (order) =>
          (!state.filterStatus || order.status === state.filterStatus) &&
          (!state.filterDepartment || order.items.some(item => item.department._id === state.filterDepartment)) &&
          (user?.role === 'production_manager' && user?.department
            ? order.items.some((item) => item.department._id === user.department._id)
            : true) &&
          (user?.role === 'chef' ? order.items.some((item) => item.assignedTo?._id === user.id) : true)
      );
  }, [state.orders, state.debouncedSearchQuery, state.filterStatus, state.filterDepartment, user]);

  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      if (state.sortBy === 'date') {
        return state.sortOrder === 'asc'
          ? new Date(a.date).getTime() - new Date(b.date).getTime()
          : new Date(b.date).getTime() - new Date(a.date).getTime();
      } else {
        const totalA = calculateTotalQuantity(a);
        const totalB = calculateTotalQuantity(b);
        return state.sortOrder === 'asc' ? totalA - totalB : totalB - totalA;
      }
    });
  }, [filteredOrders, state.sortBy, state.sortOrder, calculateTotalQuantity]);

  const paginatedOrders = useMemo(
    () =>
      sortedOrders.slice(
        (state.currentPage - 1) * ORDERS_PER_PAGE[state.viewMode],
        state.currentPage * ORDERS_PER_PAGE[state.viewMode]
      ),
    [sortedOrders, state.currentPage, state.viewMode]
  );

  const totalPages = useMemo(
    () => Math.ceil(sortedOrders.length / ORDERS_PER_PAGE[state.viewMode]),
    [sortedOrders, state.viewMode]
  );

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto">
      <Suspense fallback={<OrderTableSkeleton isRtl={isRtl} />}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }} className="mb-8">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div className="w-full sm:w-auto text-center sm:text-start">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center justify-center sm:justify-start gap-2">
                <ShoppingCart className="w-6 h-6 text-amber-600" />
                {isRtl ? 'طلبات الإنتاج' : 'Production Orders'}
              </h1>
              <p className="text-sm text-gray-600 mt-1">{isRtl ? 'إدارة طلبات إنتاج المخزون' : 'Manage inventory production orders'}</p>
            </div>
            <div className="flex gap-3 flex-wrap justify-center sm:justify-end w-full sm:w-auto">
              <Button
                variant="primary"
                onClick={() => dispatch({ type: 'SET_CREATE_MODAL', isOpen: true })}
                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-4 py-2 text-sm font-medium shadow transition-all duration-300"
              >
                <PlusCircle className="w-5 h-5" />
                {isRtl ? 'إنشاء طلب جديد' : 'Create New Order'}
              </Button>
            </div>
          </div>
          <Card className="p-6 bg-white shadow-md rounded-xl border border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className={`block text-sm font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}>
                  {isRtl ? 'بحث' : 'Search'}
                </label>
                <ProductSearchInput
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={isRtl ? 'ابحث حسب رقم الطلب أو المنتج...' : 'Search by order number or product...'}
                  ariaLabel={isRtl ? 'بحث' : 'Search'}
                  className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm transition-all duration-200"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}>
                  {isRtl ? 'تصفية حسب الحالة' : 'Filter by Status'}
                </label>
                <ProductDropdown
                  options={statusOptions.map((opt) => ({
                    value: opt.value,
                    label: isRtl
                      ? {
                          '': 'كل الحالات',
                          requested: 'مطلوب',
                          pending: 'قيد الانتظار',
                          approved: 'تم الموافقة',
                          in_production: 'في الإنتاج',
                          completed: 'مكتمل',
                          stocked: 'مخزن',
                          cancelled: 'ملغى',
                        }[opt.value]
                      : opt.label,
                  }))}
                  value={state.filterStatus}
                  onChange={(value) => dispatch({ type: 'SET_FILTER_STATUS', payload: value })}
                  ariaLabel={isRtl ? 'تصفية حسب الحالة' : 'Filter by Status'}
                  className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm transition-all duration-200"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}>
                  {isRtl ? 'تصفية حسب القسم' : 'Filter by Department'}
                </label>
                <ProductDropdown
                  options={[
                    { value: '', label: isRtl ? 'كل الأقسام' : 'All Departments' },
                    ...state.departments.map((dept) => ({
                      value: dept._id,
                      label: dept.displayName,
                    })),
                  ]}
                  value={state.filterDepartment}
                  onChange={(value) => dispatch({ type: 'SET_FILTER_DEPARTMENT', payload: value })}
                  ariaLabel={isRtl ? 'تصفية حسب القسم' : 'Filter by Department'}
                  className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm transition-all duration-200"
                />              
            </div>
            <div>
              <label className={`block text-sm font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}>
                {isRtl ? 'ترتيب حسب' : 'Sort By'}
              </label>
              <div className="flex gap-2">
                <ProductDropdown
                  options={sortOptions.map((opt) => ({
                    value: opt.value,
                    label: isRtl
                      ? { date: 'التاريخ', totalQuantity: 'الكمية الإجمالية' }[opt.value]
                      : t(opt.label),
                  }))}
                  value={state.sortBy}
                  onChange={(value) => dispatch({ type: 'SET_SORT', by: value })}
                  ariaLabel={isRtl ? 'ترتيب حسب' : 'Sort By'}
                  className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm transition-all duration-200"
                />
                <Button
                  variant="secondary"
                  onClick={() => dispatch({ type: 'SET_SORT', order: state.sortOrder === 'asc' ? 'desc' : 'asc' })}
                  className="px-3 py-1 text-sm"
                >
                  {state.sortOrder === 'asc' ? (isRtl ? 'تنازلي' : 'Desc') : (isRtl ? 'تصاعدي' : 'Asc')}
                </Button>
              </div>
            </div>
          </div>
          <div className={`flex gap-2 mt-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <Button
              variant={state.viewMode === 'card' ? 'primary' : 'secondary'}
              onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'card' })}
              className="p-2"
              aria-label={isRtl ? 'عرض البطاقات' : 'Card View'}
            >
              <Grid className="w-5 h-5" />
            </Button>
            <Button
              variant={state.viewMode === 'table' ? 'primary' : 'secondary'}
              onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'table' })}
              className="p-2"
              aria-label={isRtl ? 'عرض الجدول' : 'Table View'}
            >
              <Table2 className="w-5 h-5" />
            </Button>
          </div>
        </Card>
      </motion.div>

      {state.loading ? (
        state.viewMode === 'card' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: ORDERS_PER_PAGE.card }).map((_, index) => (
              <OrderCardSkeleton key={index} isRtl={isRtl} />
            ))}
          </div>
        ) : (
          <OrderTableSkeleton isRtl={isRtl} />
        )
      ) : state.error ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center p-6 bg-red-50 border border-red-200 rounded-lg"
        >
          <AlertCircle className="w-6 h-6 text-red-600 mx-auto mb-2" />
          <p className="text-red-600 text-sm">{state.error}</p>
        </motion.div>
      ) : paginatedOrders.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center p-6 bg-gray-50 border border-gray-200 rounded-lg"
        >
          <p className="text-gray-600 text-sm">{isRtl ? 'لا توجد طلبات' : 'No orders found'}</p>
        </motion.div>
      ) : state.viewMode === 'card' ? (
        <div ref={listRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {paginatedOrders.map((order) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                <OrderCard
                  order={order}
                  calculateTotalQuantity={calculateTotalQuantity}
                  translateUnit={translateUnit}
                  approveOrder={approveOrder}
                  updateOrderStatus={updateOrderStatus}
                  confirmItemCompletion={confirmItemCompletion}
                  openAssignModal={openAssignModal}
                  confirmFactoryProduction={confirmFactoryProduction}
                  submitting={state.submitting}
                  isRtl={isRtl}
                  currentUserRole={user?.role || 'chef'}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <OrderTable
          orders={paginatedOrders}
          calculateTotalQuantity={calculateTotalQuantity}
          translateUnit={translateUnit}
          approveOrder={approveOrder}
          updateOrderStatus={updateOrderStatus}
          confirmItemCompletion={confirmItemCompletion}
          openAssignModal={openAssignModal}
          confirmFactoryProduction={confirmFactoryProduction}
          submitting={state.submitting}
          isRtl={isRtl}
          currentUserRole={user?.role || 'chef'}
        />
      )}

      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination
            currentPage={state.currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            isRtl={isRtl}
          />
        </div>
      )}

      <Modal
        isOpen={state.isCreateModalOpen}
        onClose={() => {
          dispatch({ type: 'SET_CREATE_MODAL', isOpen: false });
          dispatch({ type: 'SET_CREATE_FORM', payload: { notes: '', items: [{ productId: '', quantity: 1 }] } });
          dispatch({ type: 'SET_FORM_ERRORS', payload: {} });
        }}
        title={isRtl ? 'إنشاء طلب إنتاج جديد' : 'Create New Production Order'}
        size="lg"
        className="bg-white rounded-lg shadow-xl border border-gray-100"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createOrder();
          }}
          className="space-y-6"
        >
          <div className="space-y-4">
            {state.createFormData.items.map((item, index) => {
              const selectedProduct = state.products.find((p) => p._id === item.productId);
              const availableChefs = selectedProduct
                ? state.chefs.filter((c) => c.department?._id === selectedProduct.department._id)
                : [];
              const chefOptions = [
                { value: '', label: isRtl ? 'اختر شيف' : 'Select Chef' },
                ...availableChefs.map((chef) => ({
                  value: chef.userId,
                  label: `${chef.displayName} (${chef.department?.displayName || (isRtl ? 'غير معروف' : 'Unknown')})`,
                })),
              ];
              const productOptions = [
                { value: '', label: isRtl ? 'اختر منتج' : 'Select Product' },
                ...state.products
                  .filter((p) =>
                    user?.role === 'chef' && user?.department
                      ? p.department._id === user.department._id
                      : true
                  )
                  .map((product) => ({
                    value: product._id,
                    label: `${product.name}${product.nameEn ? ` (${product.nameEn})` : ''} - ${translateUnit(product.unit, isRtl)}`,
                  })),
              ];
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.1 }}
                  className="flex flex-col sm:flex-row gap-3 items-start sm:items-center"
                >
                  <div className="flex-1">
                    <label
                      className={`block text-sm font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}
                      htmlFor={`product-${index}`}
                    >
                      {isRtl ? 'المنتج' : 'Product'}
                    </label>
                    <ProductDropdown
                      id={`product-${index}`}
                      options={productOptions}
                      value={item.productId}
                      onChange={(value) => {
                        const newItems = [...state.createFormData.items];
                        newItems[index] = { ...newItems[index], productId: value, assignedTo: '' };
                        dispatch({ type: 'SET_CREATE_FORM', payload: { ...state.createFormData, items: newItems } });
                      }}
                      ariaLabel={isRtl ? 'اختر منتج' : 'Select Product'}
                      className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
                      disabled={state.products.length === 0}
                    />
                    {state.formErrors[`item_${index}_productId`] && (
                      <p className="text-red-600 text-xs mt-1">{state.formErrors[`item_${index}_productId`]}</p>
                    )}
                  </div>
                  <div className="w-32">
                    <label
                      className={`block text-sm font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}
                      htmlFor={`quantity-${index}`}
                    >
                      {isRtl ? 'الكمية' : 'Quantity'}
                    </label>
                    <QuantityInput
                      value={item.quantity}
                      onChange={(value) => {
                        const newItems = [...state.createFormData.items];
                        newItems[index] = { ...newItems[index], quantity: parseInt(value) || 1 };
                        dispatch({ type: 'SET_CREATE_FORM', payload: { ...state.createFormData, items: newItems } });
                      }}
                      onIncrement={() => {
                        const newItems = [...state.createFormData.items];
                        newItems[index] = {
                          ...newItems[index],
                          quantity: Math.min(
                            newItems[index].quantity + 1,
                            selectedProduct?.maxStockLevel || 1000
                          ),
                        };
                        dispatch({ type: 'SET_CREATE_FORM', payload: { ...state.createFormData, items: newItems } });
                      }}
                      onDecrement={() => {
                        const newItems = [...state.createFormData.items];
                        newItems[index] = { ...newItems[index], quantity: Math.max(newItems[index].quantity - 1, 1) };
                        dispatch({ type: 'SET_CREATE_FORM', payload: { ...state.createFormData, items: newItems } });
                      }}
                      max={selectedProduct?.maxStockLevel}
                    />
                    {state.formErrors[`item_${index}_quantity`] && (
                      <p className="text-red-600 text-xs mt-1">{state.formErrors[`item_${index}_quantity`]}</p>
                    )}
                  </div>
                  {['admin', 'production_manager'].includes(user?.role || '') && (
                    <div className="flex-1">
                      <label
                        className={`block text-sm font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}
                        htmlFor={`chef-${index}`}
                      >
                        {isRtl ? 'تعيين شيف' : 'Assign Chef'}
                      </label>
                      <ProductDropdown
                        id={`chef-${index}`}
                        options={chefOptions}
                        value={item.assignedTo || ''}
                        onChange={(value) => {
                          const newItems = [...state.createFormData.items];
                          newItems[index] = { ...newItems[index], assignedTo: value };
                          dispatch({ type: 'SET_CREATE_FORM', payload: { ...state.createFormData, items: newItems } });
                        }}
                        ariaLabel={isRtl ? 'اختر شيف' : 'Select Chef'}
                        className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
                        disabled={availableChefs.length === 0}
                      />
                      {state.formErrors[`item_${index}_assignedTo`] && (
                        <p className="text-red-600 text-xs mt-1">{state.formErrors[`item_${index}_assignedTo`]}</p>
                      )}
                      {availableChefs.length === 0 && item.productId && (
                        <p className="text-red-600 text-xs mt-1">
                          {isRtl ? 'لا يوجد شيفات متاحون لهذا القسم' : 'No chefs available for this department'}
                        </p>
                      )}
                    </div>
                  )}
                  {state.createFormData.items.length > 1 && (
                    <Button
                      variant="danger"
                      onClick={() => {
                        const newItems = state.createFormData.items.filter((_, i) => i !== index);
                        dispatch({ type: 'SET_CREATE_FORM', payload: { ...state.createFormData, items: newItems } });
                      }}
                      className="mt-6 p-2"
                      aria-label={isRtl ? 'إزالة العنصر' : 'Remove Item'}
                    >
                      <MinusCircle className="w-5 h-5" />
                    </Button>
                  )}
                </motion.div>
              );
            })}
            <Button
              variant="secondary"
              onClick={() => {
                dispatch({
                  type: 'SET_CREATE_FORM',
                  payload: {
                    ...state.createFormData,
                    items: [...state.createFormData.items, { productId: '', quantity: 1 }],
                  },
                });
              }}
              className="flex items-center gap-2 text-sm"
              aria-label={isRtl ? 'إضافة عنصر جديد' : 'Add New Item'}
            >
              <PlusCircle className="w-5 h-5" />
              {isRtl ? 'إضافة عنصر جديد' : 'Add New Item'}
            </Button>
          </div>
          <div>
            <label
              className={`block text-sm font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}
              htmlFor="notes"
            >
              {isRtl ? 'ملاحظات' : 'Notes'}
            </label>
            <textarea
              id="notes"
              value={state.createFormData.notes}
              onChange={(e) =>
                dispatch({
                  type: 'SET_CREATE_FORM',
                  payload: { ...state.createFormData, notes: e.target.value },
                })
              }
              className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
              rows={4}
              placeholder={isRtl ? 'أدخل ملاحظات الطلب...' : 'Enter order notes...'}
            />
          </div>
          {state.formErrors.form && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}
            >
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-red-600 text-sm">{state.formErrors.form}</span>
            </motion.div>
          )}
          {state.products.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`p-3 bg-yellow-50 border border-yellow-200 rounded-md flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}
            >
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <span className="text-yellow-600 text-sm">
                {isRtl ? 'لا توجد منتجات متاحة' : 'No products available'}
              </span>
            </motion.div>
          )}
          <div className={`flex justify-end gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <Button
              variant="secondary"
              onClick={() => {
                dispatch({ type: 'SET_CREATE_MODAL', isOpen: false });
                dispatch({ type: 'SET_CREATE_FORM', payload: { notes: '', items: [{ productId: '', quantity: 1 }] } });
                dispatch({ type: 'SET_FORM_ERRORS', payload: {} });
              }}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md px-4 py-2 text-sm shadow-sm"
              aria-label={isRtl ? 'إلغاء' : 'Cancel'}
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={state.submitting === 'create' || state.products.length === 0}
              className="bg-amber-500 hover:bg-amber-600 text-white rounded-md px-4 py-2 text-sm shadow-sm disabled:opacity-50"
              aria-label={isRtl ? 'إنشاء الطلب' : 'Create Order'}
            >
              {state.submitting === 'create' ? (isRtl ? 'جارٍ التحميل' : 'Loading') : (isRtl ? 'إنشاء الطلب' : 'Create Order')}
            </Button>
          </div>
        </form>
      </Modal>

      <AssignChefsModal
        isOpen={state.isAssignModalOpen}
        onClose={() => {
          dispatch({ type: 'SET_ASSIGN_MODAL', isOpen: false });
          dispatch({ type: 'SET_ASSIGN_FORM', payload: { items: [] } });
          dispatch({ type: 'SET_SELECTED_ORDER', payload: null });
        }}
        selectedOrder={state.selectedOrder}
        assignFormData={state.assignFormData}
        chefs={state.chefs}
        error={state.error}
        submitting={state.submitting}
        assignChefs={assignChefs}
        setAssignForm={(formData) => dispatch({ type: 'SET_ASSIGN_FORM', payload: formData })}
        isRtl={isRtl}
      />
 </Suspense>  
 
   </div>
   


  );
};


export default InventoryOrders;