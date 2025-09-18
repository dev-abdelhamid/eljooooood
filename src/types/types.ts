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
}

export enum Priority {
  Urgent = 'urgent',
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

export enum ReturnStatus {
  PendingApproval = 'pending_approval',
  Approved = 'approved',
  Rejected = 'rejected',
  Processed = 'processed',
}

export interface Order {
  id: string;
  orderNumber: string;
  branchId: string;
  branchName: string;
  items: Array<{
    _id: string;
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
      quantity: number;
      reason: string;
      unit: string;
    }>;
    status: ReturnStatus;
    reviewNotes?: string;
    createdAt: string;
  }>;
  status: OrderStatus;
  totalAmount: number;
  date: string;
  notes?: string;
  priority: Priority;
  createdBy: string;
  statusHistory?: Array<{
    status: OrderStatus;
    changedBy: string;
    changedAt: string;
    notes?: string;
  }>;
}

export interface Chef {
  _id: string;
  userId: string;
  name: string;
  department: { _id: string; name: string } | null;
}

export interface Branch {
  _id: string;
  name: string;
}

export interface AssignChefsForm {
  items: Array<{
    itemId: string;
    assignedTo: string;
    product: string;
    quantity: number;
    unit: string;
  }>;
}

export interface State {
  orders: Order[];
  selectedOrder: Order | null;
  chefs: Chef[];
  branches: Branch[];
  isAssignModalOpen: boolean;
  assignFormData: AssignChefsForm;
  filterStatus: string;
  filterBranch: string;
  searchQuery: string;
  sortBy: 'date' | 'totalAmount' | 'priority';
  sortOrder: 'asc' | 'desc';
  currentPage: number;
  loading: boolean;
  error: string | null;
  submitting: string | null;
  socketConnected: boolean;
  socketError: string | null;
  viewMode: 'card' | 'table';
}

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'branch' | 'chef' | 'production';
  name: string;
  department?: { _id: string; name: string };
}

export type Action =
  | { type: 'SET_ORDERS'; payload: Order[] }
  | { type: 'ADD_ORDER'; payload: Order }
  | { type: 'SET_SELECTED_ORDER'; payload: Order | null }
  | { type: 'SET_CHEFS'; payload: Chef[] }
  | { type: 'SET_BRANCHES'; payload: Branch[] }
  | { type: 'SET_MODAL'; isOpen: boolean }
  | { type: 'SET_ASSIGN_FORM'; payload: AssignChefsForm }
  | { type: 'SET_FILTER_STATUS'; payload: string }
  | { type: 'SET_FILTER_BRANCH'; payload: string }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SORT'; by: 'date' | 'totalAmount' | 'priority'; order: 'asc' | 'desc' }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SUBMITTING'; payload: string | null }
  | { type: 'UPDATE_ORDER_STATUS'; orderId: string; status: OrderStatus }
  | { type: 'UPDATE_ITEM_STATUS'; payload: { orderId: string; itemId: string; status: ItemStatus } }
  | { type: 'TASK_ASSIGNED'; orderId: string; items: any[] }
  | { type: 'UPDATE_RETURN_STATUS'; orderId: string; returnId: string; status: ReturnStatus }
  | { type: 'SET_VIEW_MODE'; payload: 'card' | 'table' };