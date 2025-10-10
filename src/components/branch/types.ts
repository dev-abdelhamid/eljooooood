export enum ItemStatus {
  Pending = 'pending',
  Assigned = 'assigned',
  InProgress = 'in_progress',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export enum OrderStatus {
  Pending = 'pending',
  Approved = 'approved',
  InProduction = 'in_production',
  Completed = 'completed',
  InTransit = 'in_transit',
  Delivered = 'delivered',
  Cancelled = 'cancelled',
}

export interface Department {
  _id: string;
  name: string;
  nameEn?: string;
  displayName: string;
}

export interface OrderItem {
  itemId: string;
  productId: string;
  productName: string;
  productNameEn?: string;
  quantity: number;
  price: number;
  department: Department;
  status: ItemStatus;
  unit: string;
  unitEn?: string;
  displayUnit: string;
  assignedTo?: { _id: string; username: string; name: string; nameEn?: string; displayName: string };
  startedAt?: string;
  completedAt?: string;
  isCompleted?: boolean;
}

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'branch' | 'chef' | 'production';
  name: string;
  nameEn?: string;
  displayName: string;
  branchId?: string;
  branch?: string;
  departmentId?: string;
  department?: string;
}

export interface StatusHistory {
  status: string;
  changedBy: string;
  changedByName: string;
  changedAt: string;
  notes?: string;
  notesEn?: string;
  displayNotes: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  branchId: string;
  branchName: string;
  branchNameEn?: string;
  branch: { _id: string; name: string; nameEn?: string; displayName: string };
  items: OrderItem[];
  status: OrderStatus;
  totalAmount: number;
  date: string;
  requestedDeliveryDate?: string;
  notes?: string;
  notesEn?: string;
  displayNotes: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  createdBy: string;
  createdByName: string;
  statusHistory: StatusHistory[];
  approvedBy?: string;
  approvedAt?: string;
  transitStartedAt?: string;
  deliveredAt?: string;
  confirmedAt?: string;
  confirmedBy?: string;
  isRtl: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface State {
  orders: Order[];
  selectedOrder: Order | null;
  isViewModalOpen: boolean;
  isConfirmDeliveryModalOpen: boolean;
  searchQuery: string;
  filterStatus: string;
  sortBy: 'date' | 'totalAmount';
  sortOrder: 'asc' | 'desc';
  currentPage: number;
  loading: boolean;
  error: string;
  submitting: string | null;
  socketConnected: boolean;
  socketError: string | null;
  viewMode: 'card' | 'table';
  inventory: any[];
  isRtl: boolean;
}

export type Action =
  | { type: 'SET_ORDERS'; payload: Order[] }
  | { type: 'ADD_ORDER'; payload: Order }
  | { type: 'SET_SELECTED_ORDER'; payload: Order | null }
  | { type: 'SET_MODAL'; modal: 'view' | 'confirmDelivery'; isOpen: boolean }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_FILTER_STATUS'; payload: string }
  | { type: 'SET_SORT'; by: 'date' | 'totalAmount'; order: 'asc' | 'desc' }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_SUBMITTING'; payload: string | null }
  | { type: 'SET_SOCKET_CONNECTED'; payload: boolean }
  | { type: 'SET_SOCKET_ERROR'; payload: string | null }
  | { type: 'UPDATE_ORDER_STATUS'; orderId: string; status: OrderStatus; payload?: Order }
  | { type: 'UPDATE_ITEM_STATUS'; payload: { orderId: string; itemId: string; status: ItemStatus } }
  | { type: 'TASK_ASSIGNED'; orderId: string; items: { _id: string; assignedTo: { _id: string; username: string; name: string; nameEn?: string; displayName: string } }[] }
  | { type: 'MISSING_ASSIGNMENTS'; orderId: string; itemId: string; productName: string }
  | { type: 'SET_VIEW_MODE'; payload: 'card' | 'table' }
  | { type: 'SET_INVENTORY'; payload: any[] }
  | { type: 'UPDATE_INVENTORY'; payload: { productId: string; quantity: number; type: string } };