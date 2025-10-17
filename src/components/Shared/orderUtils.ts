import { Clock, User, Package, Check, X } from 'lucide-react';
import { Order, State, Action } from '../../types/Order';

export const statusOptions = [
  { value: '', label: 'all_statuses' },
  { value: 'pending', label: 'pending' },
  { value: 'approved', label: 'approved' },
  { value: 'in_production', label: 'in_production' },
  { value: 'completed', label: 'completed' },
  { value: 'in_transit', label: 'in_transit' },
  { value: 'delivered', label: 'delivered' },
  { value: 'cancelled', label: 'cancelled' },
];

export const sortOptions = [
  { value: 'date', label: 'sort_date' },
  { value: 'totalAmount', label: 'sort_total_amount' },
  { value: 'priority', label: 'sort_priority' },
];

export const validTransitions: Record<Order['status'], Order['status'][]> = {
  pending: ['approved', 'cancelled'],
  approved: ['in_production', 'cancelled'],
  in_production: ['completed', 'cancelled'],
  completed: ['in_transit'],
  in_transit: ['delivered'],
  delivered: [],
  cancelled: [],
};

export const initialState: State = {
  orders: [],
  selectedOrder: null,
  chefs: [],
  isViewModalOpen: false,
  isAssignModalOpen: false,
  filterStatus: '',
  searchQuery: '',
  sortBy: 'date',
  sortOrder: 'desc',
  currentPage: 1,
  loading: true,
  error: '',
  submitting: null,
  socketConnected: false,
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_ORDERS':
      return { ...state, orders: action.payload };
    case 'SET_SELECTED_ORDER':
      return { ...state, selectedOrder: action.payload };
    case 'SET_CHEFS':
      return { ...state, chefs: action.payload };
    case 'SET_VIEW_MODAL_OPEN':
      return { ...state, isViewModalOpen: action.payload };
    case 'SET_ASSIGN_MODAL_OPEN':
      return { ...state, isAssignModalOpen: action.payload };
    case 'SET_FILTER_STATUS':
      return { ...state, filterStatus: action.payload, currentPage: 1 };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload, currentPage: 1 };
    case 'SET_SORT':
      return { ...state, sortBy: action.by, sortOrder: action.order, currentPage: 1 };
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
    case 'UPDATE_ORDER_STATUS':
      return {
        ...state,
        orders: state.orders.map((o) =>
          o.id === action.orderId ? { ...o, status: action.status } : o
        ),
        selectedOrder:
          state.selectedOrder && state.selectedOrder.id === action.orderId
            ? { ...state.selectedOrder, status: action.status }
            : state.selectedOrder,
      };
    case 'UPDATE_TASK_STATUS':
      return {
        ...state,
        orders: state.orders.map((order) =>
          order.items.some((i) => i._id === action.taskId)
            ? {
                ...order,
                items: order.items.map((item) =>
                  item._id === action.taskId ? { ...item, status: action.status as any } : item
                ),
                status:
                  order.items.every((i) => i.status === 'completed') && order.status !== 'completed'
                    ? 'completed'
                    : order.status,
              }
            : order
        ),
        selectedOrder:
          state.selectedOrder && state.selectedOrder.items.some((i) => i._id === action.taskId)
            ? {
                ...state.selectedOrder,
                items: state.selectedOrder.items.map((item) =>
                  item._id === action.taskId ? { ...item, status: action.status as any } : item
                ),
                status:
                  state.selectedOrder.items.every((i) => i.status === 'completed') &&
                  state.selectedOrder.status !== 'completed'
                    ? 'completed'
                    : state.selectedOrder.status,
              }
            : state.selectedOrder,
      };
    case 'ORDER_COMPLETED':
      return {
        ...state,
        orders: state.orders.map((order) =>
          order.id === action.orderId ? { ...order, status: 'completed' } : order
        ),
        selectedOrder:
          state.selectedOrder && state.selectedOrder.id === action.orderId
            ? { ...state.selectedOrder, status: 'completed' }
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
                  const assignment = action.items.find((a) => a._id === i._id);
                  if (assignment) {
                    return {
                      ...i,
                      assignedTo: assignment.assignedTo
                        ? { _id: assignment.assignedTo._id, username: assignment.assignedTo.username || 'Unknown' }
                        : undefined,
                      status: assignment.status || i.status,
                    };
                  }
                  return i;
                }),
                status: action.items.every((item) => item.status === 'assigned') ? 'in_production' : order.status,
              }
            : order
        ),
        selectedOrder:
          state.selectedOrder && state.selectedOrder.id === action.orderId
            ? {
                ...state.selectedOrder,
                items: state.selectedOrder.items.map((i) => {
                  const assignment = action.items.find((a) => a._id === i._id);
                  if (assignment) {
                    return {
                      ...i,
                      assignedTo: assignment.assignedTo
                        ? { _id: assignment.assignedTo._id, username: assignment.assignedTo.username || 'Unknown' }
                        : undefined,
                      status: assignment.status || i.status,
                    };
                  }
                  return i;
                }),
                status: action.items.every((item) => item.status === 'assigned')
                  ? 'in_production'
                  : state.selectedOrder.status,
              }
            : state.selectedOrder,
      };
    case 'RETURN_STATUS_UPDATED':
      return {
        ...state,
        orders: state.orders.map((order) =>
          order.id === action.orderId
            ? {
                ...order,
                returns: order.returns?.map((ret) =>
                  ret.returnId === action.returnId ? { ...ret, status: action.status as any } : ret
                ),
              }
            : order
        ),
        selectedOrder:
          state.selectedOrder && state.selectedOrder.id === action.orderId
            ? {
                ...state.selectedOrder,
                returns: state.selectedOrder.returns?.map((ret) =>
                  ret.returnId === action.returnId ? { ...ret, status: action.status as any } : ret
                ),
              }
            : state.selectedOrder,
      };
    default:
      return state;
  }
};

export const getStatusInfo = (status: Order['status']) => {
  const statusMap: Record<Order['status'], { label: string; color: string; icon: React.FC; progress: number }> = {
    pending: { label: 'pending', color: 'bg-gray-200 text-gray-800', icon: Clock, progress: 10 },
    approved: { label: 'approved', color: 'bg-blue-200 text-blue-800', icon: Check, progress: 30 },
    in_production: { label: 'in_production', color: 'bg-yellow-200 text-yellow-800', icon: Package, progress: 50 },
    completed: { label: 'completed', color: 'bg-green-200 text-green-800', icon: Check, progress: 70 },
    in_transit: { label: 'in_transit', color: 'bg-purple-200 text-purple-800', icon: Package, progress: 90 },
    delivered: { label: 'delivered', color: 'bg-green-200 text-green-800', icon: Check, progress: 100 },
    cancelled: { label: 'cancelled', color: 'bg-red-200 text-red-800', icon: X, progress: 0 },
  };
  return statusMap[status] || { label: status, color: 'bg-gray-200 text-gray-800', icon: Clock, progress: 0 };
};

export const getItemStatusInfo = (status: Order['items'][0]['status']) => {
  const statusMap: Record<Order['items'][0]['status'], { label: string; color: string; icon: React.FC }> = {
    pending: { label: 'item_pending', color: 'bg-gray-100 text-gray-700', icon: Clock },
    assigned: { label: 'item_assigned', color: 'bg-blue-100 text-blue-700', icon: User },
    in_progress: { label: 'item_in_progress', color: 'bg-yellow-100 text-yellow-700', icon: Package },
    completed: { label: 'item_completed', color: 'bg-green-100 text-green-700', icon: Check },
  };
  return statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-700', icon: Clock };
};

export const getReturnStatusInfo = (status: Order['returns'][0]['status']) => {
  const statusMap: Record<Order['returns'][0]['status'], { label: string; color: string; icon: React.FC }> = {
    pending_approval: { label: 'pending_approval', color: 'bg-gray-100 text-gray-700', icon: Clock },
    approved: { label: 'approved', color: 'bg-green-100 text-green-700', icon: Check },
    rejected: { label: 'rejected', color: 'bg-red-100 text-red-700', icon: X },
    processed: { label: 'processed', color: 'bg-green-100 text-green-700', icon: Check },
  };
  return statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-700', icon: Clock };
};

export const departmentLabels: Record<string, string> = {
  bread: 'departments.bread',
  pastries: 'departments.pastries',
  cakes: 'departments.cakes',
  unknown: 'departments.unknown',
};

export const priorityLabels: Record<Order['priority'], string> = {
  low: 'priority_low',
  medium: 'priority_medium',
  high: 'priority_high',
  urgent: 'priority_urgent',
};