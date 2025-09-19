export enum OrderStatus {
  Pending = 'pending',
  Approved = 'approved',
  InProduction = 'in_production',
  Completed = 'completed',
  InTransit = 'in_transit',
  Delivered = 'delivered',
  Cancelled = 'cancelled',
}

export enum ItemStatus {
  Pending = 'pending',
  Assigned = 'assigned',
  InProgress = 'in_progress',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export enum Priority {
  Urgent = 'urgent',
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

export enum ReturnStatus {
  PendingApproval = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Processed = 'processed',
}

export enum NotificationType {
  OrderCreated = 'orderCreated',
  TaskAssigned = 'task_assigned',
  ItemStatusUpdated = 'itemStatusUpdated',
  OrderStatusUpdated = 'orderStatusUpdated',
  OrderDelivered = 'orderDelivered',
  ReturnStatusUpdated = 'returnStatusUpdated',
  MissingAssignments = 'missingAssignments',
  OrderCompleted = 'orderCompleted',
  ReturnCreated = 'returnCreated',
}

export interface Order {
  id: string;
  orderNumber: string;
  branchId: string;
  branchName: string;
  branch: { _id: string; name: string };
  items: Array<{
    _id: string;
    itemId?: string;
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    unit: string;
    department: { _id: string; name: string };
    assignedTo?: { _id: string; name: string };
    status: ItemStatus;
    returnedQuantity?: number;
    returnReason?: string;
  }>;
  returns?: Array<{
    returnId: string;
    items: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unit: string;
      reason: string;
      status?: ReturnStatus;
      reviewNotes?: string;
    }>;
    status: ReturnStatus;
    reviewNotes?: string;
    createdAt: string;
    createdBy: { _id: string; username: string };
  }>;
  status: OrderStatus;
  totalAmount: number;
  adjustedTotal: number;
  date: string;
  notes?: string;
  priority: Priority;
  createdBy: string;
  statusHistory?: Array<{
    status: OrderStatus;
    changedBy?: string;
    changedAt?: string;
    date?: string;
    notes?: string;
  }>;
}

export interface Chef {
  _id: string;
  userId: string;
  name: string;
  department: { _id: string; name: string } | null;
}

export interface OrderItem {
  itemId: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  unit: string;
  department: { _id: string; name: string };
  status: ItemStatus;
  returnedQuantity?: number;
  returnReason?: string;
  assignedTo?: { _id: string; username: string };
}

export interface Branch {
  _id: string;
  name: string;
}

export interface AssignChefsForm {
  items: Array<{
    itemId: string;
    assignedTo: string;
    product?: string;
    quantity: number;
    unit?: string;
  }>;
}

export interface ReturnForm {
  itemId: string;
  quantity: number;
  reason: string;
  notes: string;
}

export interface Notification {
  _id: string;
  type: NotificationType;
  displayType: 'success' | 'info' | 'warning' | 'error';
  message: string;
  data?: {
    orderId?: string;
    branchId?: string;
    chefId?: string;
    taskId?: string;
    returnId?: string;
    eventId: string;
    priority?: Priority;
  };
  read: boolean;
  createdAt: string;
  sound?: string;
  vibrate?: number[];
}

export interface ReturnItem {
  itemId: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  price?: number;
  reason: string;
  status?: ReturnStatus;
  reviewNotes?: string;
}

export interface Return {
  id: string;
  returnNumber: string;
  order: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    createdAt: string;
    branch: string;
    branchName: string;
  };
  items: ReturnItem[];
  status: ReturnStatus;
  date: string;
  createdAt: string;
  notes?: string;
  reviewNotes?: string;
  branch: { _id: string; name: string };
  createdBy: { _id: string; username: string };
  reviewedBy?: { _id: string; username: string };
  statusHistory?: Array<{
    status: ReturnStatus;
    changedBy: string;
    notes?: string;
    changedAt: string;
  }>;
}

export interface State {
  orders: Order[];
  selectedOrder: Order | null;
  chefs: Chef[];
  branches: Branch[];
  returns: Return[];
  selectedReturn: Return | null;
  isAssignModalOpen: boolean;
  isViewModalOpen: boolean;
  isConfirmDeliveryModalOpen: boolean;
  isReturnModalOpen: boolean;
  isActionModalOpen: boolean;
  actionType: 'approve' | 'reject' | null;
  actionNotes: string;
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
  toasts?: { id: string; message: string; type: 'success' | 'error' }[];
  socketConnected: boolean;
  socketError: string | null;
  viewMode: 'card' | 'table';
}

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'branch' | 'chef' | 'production';
  name: string;
  branch?: string;
  department?: string;
}

export type Action =
  | { type: 'SET_ORDERS'; payload: Order[] }
  | { type: 'ADD_ORDER'; payload: Order }
  | { type: 'SET_SELECTED_ORDER'; payload: Order | null }
  | { type: 'SET_CHEFS'; payload: Chef[] }
  | { type: 'SET_BRANCHES'; payload: Branch[] }
  | { type: 'SET_MODAL'; modal: 'assign' | 'view' | 'confirmDelivery' | 'return'; isOpen: boolean }
  | { type: 'SET_ASSIGN_FORM'; payload: AssignChefsForm }
  | { type: 'SET_RETURN_FORM'; payload: ReturnForm }
  | { type: 'SET_FILTER_STATUS'; payload: string }
  | { type: 'SET_FILTER_BRANCH'; payload: string }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SORT'; by: 'date' | 'totalAmount' | 'priority' | 'orderNumber' | 'returnNumber'; order: 'asc' | 'desc' }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_SUBMITTING'; payload: string | null }
  | { type: 'ADD_TOAST'; payload: { id: string; message: string; type: 'success' | 'error' } }
  | { type: 'REMOVE_TOAST'; payload: string }
  | { type: 'SET_SOCKET_CONNECTED'; payload: boolean }
  | { type: 'SET_SOCKET_ERROR'; payload: string | null }
  | { type: 'UPDATE_ORDER_STATUS'; orderId: string; status: OrderStatus }
  | { type: 'UPDATE_ITEM_STATUS'; payload: { orderId: string; itemId: string; status: ItemStatus } }
  | { type: 'TASK_ASSIGNED'; orderId: string; items: any[] }
  | { type: 'ADD_RETURN'; orderId: string; returnData: Order['returns'][0] }
  | { type: 'UPDATE_RETURN_STATUS'; orderId: string; returnId: string; status: ReturnStatus }
  | { type: 'UPDATE_TASK_STATUS'; taskId: string; status: ItemStatus; updatedAt: string }
  | { type: 'REMOVE_TASKS_BY_ORDER'; orderId: string }
  | { type: 'MISSING_ASSIGNMENTS'; orderId: string; itemId: string; productName: string }
  | { type: 'SET_RETURNS'; payload: { returns: Return[]; totalCount: number } }
  | { type: 'ADD_RETURN'; payload: Return }
  | { type: 'SET_SELECTED_RETURN'; payload: Return | null }
  | { type: 'SET_VIEW_MODAL'; isOpen: boolean }
  | { type: 'SET_ACTION_MODAL'; isOpen: boolean }
  | { type: 'SET_ACTION_TYPE'; payload: 'approve' | 'reject' | null }
  | { type: 'SET_ACTION_NOTES'; payload: string }
  | { type: 'UPDATE_RETURN_STATUS'; returnId: string; status: ReturnStatus; reviewNotes?: string; adjustedTotal?: number }
  | { type: 'SET_VIEW_MODE'; payload: 'card' | 'table' };

export interface Task {
  id: string;
  orderId: string;
  orderNumber: string;
  productName: string;
  quantity: number;
  unit: string;
  status: ItemStatus;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  chefId?: string;
}

export interface ChefTask {
  id: string;
  orderId: string;
  orderNumber: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: string;
  updatedAt: string;
  progress?: number;
}

export interface ChefTasksState {
  tasks: ChefTask[];
  chefId: string | null;
  loading: boolean;
  error: string;
  submitting: string | null;
  socketConnected: boolean;
  filterStatus: string;
  searchQuery: string;
  page: number;
  totalPages: number;
  showConfirmModal: { taskId: string; orderId: string; status: string } | null;
}

export const socketEvents = {
  joinRoom: 'joinRoom',
  newOrderFromBranch: 'newOrderFromBranch',
  orderApprovedForBranch: 'orderApprovedForBranch',
  taskAssigned: 'taskAssigned',
  taskCompleted: 'taskCompleted',
  orderCompletedByChefs: 'orderCompletedByChefs',
  orderInTransitToBranch: 'orderInTransitToBranch',
  branchConfirmedReceipt: 'branchConfirmedReceipt',
  orderStatusUpdated: 'orderStatusUpdated',
  itemStatusUpdated: 'itemStatusUpdated',
  returnStatusUpdated: 'returnStatusUpdated',
  missingAssignments: 'missingAssignments',
  notificationRead: 'notificationRead',
  allNotificationsRead: 'allNotificationsRead',
  notificationsCleared: 'notificationsCleared',
  returnCreated: 'returnCreated',
};