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

export interface FactoryOrder {
  _id: string;
  orderNumber: string;
  items: {
    _id: string;
    product: {
      _id: string;
      name: string;
      nameEn?: string;
      unit: string;
      unitEn?: string;
      department: { _id: string; name: string; nameEn?: string; code: string };
    };
    quantity: number;
    status: 'pending' | 'assigned' | 'completed';
    assignedTo?: { _id: string; name: string; nameEn?: string };
    startedAt?: string | null;
    completedAt?: string | null;
  }[];
  status: 'pending' | 'in_production' | 'completed' | 'cancelled';
  notes?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdBy: { _id: string; name: string; nameEn?: string };
  createdAt: string;
  approvedAt?: string | null;
  statusHistory: {
    status: string;
    changedBy: { _id: string; name: string; nameEn?: string };
    changedAt: string;
    notes?: string;
  }[];
}

export interface CreateFactoryOrderRequest {
  orderNumber: string;
  items: { product: string; quantity: number }[];
  notes?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

export interface ReturnForm {
  itemId: string;
  quantity: number;
  reason: string;
  reasonEn?: string;
  notes: string;
  notesEn?: string;
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

export interface Department {
  _id: string;
  name: string;
  nameEn?: string;
  displayName: string; // Derived: name (isRtl=true) or nameEn (isRtl=false)
}

export interface Branch {
  _id: string;
  name: string;
  nameEn?: string;
  displayName: string; // Derived: name (isRtl=true) or nameEn (isRtl=false)
}

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'branch' | 'chef' | 'production';
  name: string;
  nameEn?: string;
  displayName: string; // Derived: name (isRtl=true) or nameEn (isRtl=false)
  branchId?: string;
  branch?: Branch;
  departmentId?: string;
  department?: Department;
}

export interface OrderItem {
  _id: string;
  itemId?: string;
  productId: string;
  productName: string;
  productNameEn?: string;
  quantity: number;
  price: number;
  unit: string;
  unitEn?: string;
  displayUnit: string; // Derived: unit (isRtl=true) or unitEn (isRtl=false)
  department: Department;
  assignedTo?: { _id: string; username: string; name: string; nameEn?: string; displayName: string; department: Department };
  status: ItemStatus;
  returnedQuantity?: number;
  returnReason?: string;
  returnReasonEn?: string;
  displayReturnReason?: string; // Derived: returnReason (isRtl=true) or returnReasonEn (isRtl=false)
  startedAt?: string;
  completedAt?: string;
}

export interface ReturnItem {
  productId: string;
  productName: string;
  productNameEn?: string;
  quantity: number;
  unit: string;
  unitEn?: string;
  displayUnit: string; // Derived: unit (isRtl=true) or unitEn (isRtl=false)
  reason: string;
  reasonEn?: string;
  displayReason: string; // Derived: reason (isRtl=true) or reasonEn (isRtl=false)
  status?: ReturnStatus;
  reviewNotes?: string;
  reviewNotesEn?: string;
  displayReviewNotes?: string; // Derived: reviewNotes (isRtl=true) or reviewNotesEn (isRtl=false)
}

export interface OrderReturn {
  returnId: string;
  returnNumber: string;
  items: ReturnItem[];
  status: ReturnStatus;
  reviewNotes?: string;
  reviewNotesEn?: string;
  displayReviewNotes?: string; // Derived: reviewNotes (isRtl=true) or reviewNotesEn (isRtl=false)
  createdAt: string;
  createdBy: { _id: string; username: string; name: string; nameEn?: string; displayName: string };
  reviewedBy?: { _id: string; username: string; name: string; nameEn?: string; displayName: string };
}

export interface Order {
  id: string;
  orderNumber: string;
  branchId: string;
  branchName: string;
  branchNameEn?: string;
  branch: Branch;
  items: OrderItem[];
  returns: OrderReturn[];
  status: OrderStatus;
  totalAmount: number;
  adjustedTotal: number;
  date: string;
  requestedDeliveryDate: string;
  notes?: string;
  notesEn?: string;
  displayNotes: string; // Derived: notes (isRtl=true) or notesEn (isRtl=false)
  priority: Priority;
  createdBy: string;
  createdByName: string; // Derived: name (isRtl=true) or nameEn (isRtl=false)
  statusHistory: Array<{
    status: OrderStatus;
    changedBy?: string;
    changedByName: string; // Derived: name (isRtl=true) or nameEn (isRtl=false)
    changedAt?: string;
    notes?: string;
    notesEn?: string;
    displayNotes: string; // Derived: notes (isRtl=true) or notesEn (isRtl=false)
  }>;
  approvedBy?: { _id: string; name: string; nameEn?: string; displayName: string };
  approvedAt?: string;
  deliveredAt?: string;
  transitStartedAt?: string;
  isRtl: boolean;
}

export interface Chef {
  _id: string;
  userId: string;
  name: string;
  nameEn?: string;
  displayName: string; // Derived: name (isRtl=true) or nameEn (isRtl=false)
  department: Department;
  status?: 'active' | 'inactive';
}

export interface AssignChefsForm {
  items: Array<{
    itemId: string;
    assignedTo: string;
    product?: string;
    productNameEn?: string;
    quantity: number;
    unit?: string;
    unitEn?: string;
    displayUnit?: string; // Derived: unit (isRtl=true) or unitEn (isRtl=false)
  }>;
}

export interface ReturnForm {
  itemId: string;
  quantity: number;
  reason: string;
  reasonEn?: string;
  notes: string;
  notesEn?: string;
}

export interface Notification {
  _id: string;
  type: NotificationType;
  displayType: 'success' | 'info' | 'warning' | 'error';
  message: string;
  messageEn?: string;
  displayMessage: string; // Derived: message (isRtl=true) or messageEn (isRtl=false)
  data: {
    orderId?: string;
    orderNumber?: string;
    branchId?: string;
    chefId?: string;
    taskId?: string;
    returnId?: string;
    eventId: string;
    priority?: Priority;
    productId?: string;
    productName?: string;
    quantity?: number;
    unit?: string;
    status?: string;
    reason?: string;
  };
  read: boolean;
  createdAt: string;
  sound?: string;
  vibrate?: number[];
}

export interface Product {
  _id: string;
  name: string;
  nameEn?: string;
  code: string;
  department: { _id: string; name: string; nameEn?: string };
  price: number;
  unit?: string;
  unitEn?: string;
  displayName: string;
  displayUnit: string;
}
  export interface ReturnFormItem {
  itemId: string;
  quantity: number;
  reason: string;
  notes: string;
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
    branchNameEn?: string;
    displayBranchName: string; // Derived: branchName (isRtl=true) or branchNameEn (isRtl=false)
  };
  items: ReturnFormItem[];
  status: ReturnStatus;
  date: string;
  createdAt: string;
  notes?: string;
  notesEn?: string;
  displayNotes?: string; // Derived: notes (isRtl=true) or notesEn (isRtl=false)
  reviewNotes?: string;
  reviewNotesEn?: string;
  displayReviewNotes?: string; // Derived: reviewNotes (isRtl=true) or reviewNotesEn (isRtl=false)
  branch: Branch;
  createdBy: { _id: string; username: string; name: string; nameEn?: string; displayName: string };
  reviewedBy?: { _id: string; username: string; name: string; nameEn?: string; displayName: string };
  statusHistory?: Array<{
    status: ReturnStatus;
    changedBy: string;
    changedByName: string; // Derived: name (isRtl=true) or nameEn (isRtl=false)
    notes?: string;
    notesEn?: string;
    displayNotes: string; // Derived: notes (isRtl=true) or notesEn (isRtl=false)
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
  toasts?: { id: string; message: string; messageEn?: string; displayMessage: string; type: 'success' | 'error' }[];
  socketConnected: boolean;
  socketError: string | null;
  viewMode: 'card' | 'table';
  isRtl: boolean;
}

export interface Task {
  id: string;
  orderId: string;
  orderNumber: string;
  productName: string;
  productNameEn?: string;
  displayProductName: string; // Derived: productName (isRtl=true) or productNameEn (isRtl=false)
  quantity: number;
  unit: string;
  unitEn?: string;
  displayUnit: string; // Derived: unit (isRtl=true) or unitEn (isRtl=false)
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
  productNameEn?: string;
  displayProductName: string; // Derived: productName (isRtl=true) or productNameEn (isRtl=false)
  quantity: number;
  unit: string;
  unitEn?: string;
  displayUnit: string; // Derived: unit (isRtl=true) or unitEn (isRtl=false)
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
  isRtl: boolean;
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
  | { type: 'ADD_TOAST'; payload: { id: string; message: string; messageEn?: string; displayMessage: string; type: 'success' | 'error' } }
  | { type: 'REMOVE_TOAST'; payload: string }
  | { type: 'SET_SOCKET_CONNECTED'; payload: boolean }
  | { type: 'SET_SOCKET_ERROR'; payload: string | null }
  | { type: 'UPDATE_ORDER_STATUS'; orderId: string; status: OrderStatus }
  | { type: 'UPDATE_ITEM_STATUS'; orderId: string; payload: { itemId: string; status: ItemStatus } }
  | { type: 'TASK_ASSIGNED'; orderId: string; items: any[] }
  | { type: 'ADD_RETURN'; orderId: string; returnData: OrderReturn }
  | { type: 'UPDATE_RETURN_STATUS'; orderId: string; returnId: string; status: ReturnStatus; reviewNotes?: string; adjustedTotal?: number }
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
  | { type: 'SET_VIEW_MODE'; payload: 'card' | 'table' };

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