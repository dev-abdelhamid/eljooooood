import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Order, OrderStatus, ItemStatus, OrderReturn, ReturnStatus, AssignChefsForm, ReturnForm } from '../types/types';

interface OrdersState {
  orders: Order[];
  selectedOrder: Order | null;
  chefs: any[];
  branches: any[];
  returns: any[];
  selectedReturn: any | null;
  isAssignModalOpen: boolean;
  isViewModalOpen: boolean;
  isConfirmDeliveryModalOpen: boolean;
  isReturnModalOpen: boolean;
  isActionModalOpen: boolean;
  actionType: 'approve' | 'reject' | null;
  actionNotes: string;
  assignFormData: AssignChefsForm;
  returnFormData: ReturnForm;
  filterStatus: string;
  filterBranch: string;
  searchQuery: string;
  sortBy: 'date' | 'totalAmount' | 'priority' | 'orderNumber' | 'returnNumber';
  sortOrder: 'asc' | 'desc';
  currentPage: number;
  totalCount: number;
  loading: boolean;
  error: string;
  submitting: string | null;
  toasts: { id: string; message: string; messageEn?: string; displayMessage: string; type: 'success' | 'error' }[];
  socketConnected: boolean;
  socketError: string | null;
  viewMode: 'card' | 'table';
  isRtl: boolean;
}

const initialState: OrdersState = {
  orders: [],
  selectedOrder: null,
  chefs: [],
  branches: [],
  returns: [],
  selectedReturn: null,
  isAssignModalOpen: false,
  isViewModalOpen: false,
  isConfirmDeliveryModalOpen: false,
  isReturnModalOpen: false,
  isActionModalOpen: false,
  actionType: null,
  actionNotes: '',
  assignFormData: { items: [] },
  returnFormData: { itemId: '', quantity: 0, reason: '', notes: '' },
  filterStatus: '',
  filterBranch: '',
  searchQuery: '',
  sortBy: 'date',
  sortOrder: 'desc',
  currentPage: 1,
  totalCount: 0,
  loading: false,
  error: '',
  submitting: null,
  toasts: [],
  socketConnected: false,
  socketError: null,
  viewMode: 'table',
  isRtl: true,
};

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    setOrders: (state, action: PayloadAction<Order[]>) => {
      state.orders = action.payload;
    },
    addOrder: (state, action: PayloadAction<Order>) => {
      state.orders.push(action.payload);
    },
    setSelectedOrder: (state, action: PayloadAction<Order | null>) => {
      state.selectedOrder = action.payload;
    },
    setChefs: (state, action: PayloadAction<any[]>) => {
      state.chefs = action.payload;
    },
    setBranches: (state, action: PayloadAction<any[]>) => {
      state.branches = action.payload;
    },
    setModal: (state, action: PayloadAction<{ modal: 'assign' | 'view' | 'confirmDelivery' | 'return'; isOpen: boolean }>) => {
      switch (action.payload.modal) {
        case 'assign':
          state.isAssignModalOpen = action.payload.isOpen;
          break;
        case 'view':
          state.isViewModalOpen = action.payload.isOpen;
          break;
        case 'confirmDelivery':
          state.isConfirmDeliveryModalOpen = action.payload.isOpen;
          break;
        case 'return':
          state.isReturnModalOpen = action.payload.isOpen;
          break;
      }
    },
    setAssignForm: (state, action: PayloadAction<AssignChefsForm>) => {
      state.assignFormData = action.payload;
    },
    setReturnForm: (state, action: PayloadAction<ReturnForm>) => {
      state.returnFormData = action.payload;
    },
    setFilterStatus: (state, action: PayloadAction<string>) => {
      state.filterStatus = action.payload;
      state.currentPage = 1;
    },
    setFilterBranch: (state, action: PayloadAction<string>) => {
      state.filterBranch = action.payload;
      state.currentPage = 1;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
      state.currentPage = 1;
    },
    setSort: (state, action: PayloadAction<{ by: 'date' | 'totalAmount' | 'priority' | 'orderNumber' | 'returnNumber'; order: 'asc' | 'desc' }>) => {
      state.sortBy = action.payload.by;
      state.sortOrder = action.payload.order;
    },
    setPage: (state, action: PayloadAction<number>) => {
      state.currentPage = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    },
    setSubmitting: (state, action: PayloadAction<string | null>) => {
      state.submitting = action.payload;
    },
    addToast: (state, action: PayloadAction<{ id: string; message: string; messageEn?: string; displayMessage: string; type: 'success' | 'error' }>) => {
      state.toasts.push(action.payload);
    },
    removeToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter(toast => toast.id !== action.payload);
    },
    setSocketConnected: (state, action: PayloadAction<boolean>) => {
      state.socketConnected = action.payload;
    },
    setSocketError: (state, action: PayloadAction<string | null>) => {
      state.socketError = action.payload;
    },
    updateOrderStatus: (state, action: PayloadAction<{ orderId: string; status: OrderStatus; payload?: Order }>) => {
      const orderIndex = state.orders.findIndex(order => order.id === action.payload.orderId);
      if (orderIndex !== -1) {
        if (action.payload.payload) {
          state.orders[orderIndex] = action.payload.payload;
        } else {
          state.orders[orderIndex].status = action.payload.status;
          state.orders[orderIndex].statusHistory.push({
            status: action.payload.status,
            changedBy: 'system',
            changedByName: 'System',
            changedAt: new Date().toISOString(),
            notes: '',
            displayNotes: '',
          });
        }
      }
    },
    updateItemStatus: (state, action: PayloadAction<{ orderId: string; payload: { itemId: string; status: ItemStatus } }>) => {
      const orderIndex = state.orders.findIndex(order => order.id === action.payload.orderId);
      if (orderIndex !== -1) {
        const itemIndex = state.orders[orderIndex].items.findIndex(item => item._id === action.payload.payload.itemId);
        if (itemIndex !== -1) {
          state.orders[orderIndex].items[itemIndex].status = action.payload.payload.status;
        }
      }
    },
    taskAssigned: (state, action: PayloadAction<{ orderId: string; items: any[] }>) => {
      const orderIndex = state.orders.findIndex(order => order.id === action.payload.orderId);
      if (orderIndex !== -1) {
        action.payload.items.forEach(item => {
          const itemIndex = state.orders[orderIndex].items.findIndex(i => i._id === item._id);
          if (itemIndex !== -1) {
            state.orders[orderIndex].items[itemIndex] = { ...state.orders[orderIndex].items[itemIndex], ...item };
          }
        });
      }
    },
    addReturn: (state, action: PayloadAction<{ orderId: string; returnData: OrderReturn }>) => {
      const orderIndex = state.orders.findIndex(order => order.id === action.payload.orderId);
      if (orderIndex !== -1) {
        state.orders[orderIndex].returns.push(action.payload.returnData);
      }
    },
    updateReturnStatus: (state, action: PayloadAction<{ orderId: string; returnId: string; status: ReturnStatus; reviewNotes?: string; adjustedTotal?: number }>) => {
      const orderIndex = state.orders.findIndex(order => order.id === action.payload.orderId);
      if (orderIndex !== -1) {
        const returnIndex = state.orders[orderIndex].returns.findIndex(ret => ret.returnId === action.payload.returnId);
        if (returnIndex !== -1) {
          state.orders[orderIndex].returns[returnIndex].status = action.payload.status;
          if (action.payload.reviewNotes) {
            state.orders[orderIndex].returns[returnIndex].reviewNotes = action.payload.reviewNotes;
            state.orders[orderIndex].returns[returnIndex].displayReviewNotes = state.orders[orderIndex].isRtl ? action.payload.reviewNotes : (state.orders[orderIndex].returns[returnIndex].reviewNotesEn || action.payload.reviewNotes);
          }
          if (action.payload.adjustedTotal !== undefined) {
            state.orders[orderIndex].adjustedTotal = action.payload.adjustedTotal;
          }
        }
      }
    },
    updateTaskStatus: (state, action: PayloadAction<{ taskId: string; status: ItemStatus; updatedAt: string }>) => {
      state.orders.forEach(order => {
        const itemIndex = order.items.findIndex(item => item._id === action.payload.taskId);
        if (itemIndex !== -1) {
          order.items[itemIndex].status = action.payload.status;
          order.items[itemIndex].updatedAt = action.payload.updatedAt;
        }
      });
    },
    removeTasksByOrder: (state, action: PayloadAction<string>) => {
      const orderIndex = state.orders.findIndex(order => order.id === action.payload);
      if (orderIndex !== -1) {
        state.orders[orderIndex].items = state.orders[orderIndex].items.filter(item => item.status !== ItemStatus.Completed);
      }
    },
    missingAssignments: (state, action: PayloadAction<{ orderId: string; itemId: string; productName: string }>) => {
      const orderIndex = state.orders.findIndex(order => order.id === action.payload.orderId);
      if (orderIndex !== -1) {
        const itemIndex = state.orders[orderIndex].items.findIndex(item => item._id === action.payload.itemId);
        if (itemIndex !== -1) {
          state.orders[orderIndex].items[itemIndex].status = ItemStatus.Pending;
        }
      }
    },
    setReturns: (state, action: PayloadAction<{ returns: any[]; totalCount: number }>) => {
      state.returns = action.payload.returns;
      state.totalCount = action.payload.totalCount;
    },
    setSelectedReturn: (state, action: PayloadAction<any | null>) => {
      state.selectedReturn = action.payload;
    },
    setViewModal: (state, action: PayloadAction<boolean>) => {
      state.isViewModalOpen = action.payload;
    },
    setActionModal: (state, action: PayloadAction<boolean>) => {
      state.isActionModalOpen = action.payload;
    },
    setActionType: (state, action: PayloadAction<'approve' | 'reject' | null>) => {
      state.actionType = action.payload;
    },
    setActionNotes: (state, action: PayloadAction<string>) => {
      state.actionNotes = action.payload;
    },
    setViewMode: (state, action: PayloadAction<'card' | 'table'>) => {
      state.viewMode = action.payload;
    },
  },
});

export const {
  setOrders,
  addOrder,
  setSelectedOrder,
  setChefs,
  setBranches,
  setModal,
  setAssignForm,
  setReturnForm,
  setFilterStatus,
  setFilterBranch,
  setSearchQuery,
  setSort,
  setPage,
  setLoading,
  setError,
  setSubmitting,
  addToast,
  removeToast,
  setSocketConnected,
  setSocketError,
  updateOrderStatus,
  updateItemStatus,
  taskAssigned,
  addReturn,
  updateReturnStatus,
  updateTaskStatus,
  removeTasksByOrder,
  missingAssignments,
  setReturns,
  setSelectedReturn,
  setViewModal,
  setActionModal,
  setActionType,
  setActionNotes,
  setViewMode,
} = ordersSlice.actions;

export default ordersSlice.reducer;