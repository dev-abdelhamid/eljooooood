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
  code?: string;
  displayName: string; // Derived field: name (isRtl=true) or nameEn (isRtl=false)
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
  displayUnit: string; // Derived field: unit (isRtl=true) or unitEn (isRtl=false)
  returnedQuantity?: number;
  returnReason?: string;
  returnReasonEn?: string;
  displayReturnReason?: string; // Derived field: returnReason (isRtl=true) or returnReasonEn (isRtl=false)
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
  displayName: string; // Derived field: name (isRtl=true) or nameEn (isRtl=false)
  branchId?: string;
  branch?: string;
  departmentId?: string;
  department?: string;
}

  export interface ReturnFormItem {
  itemId: string;
  quantity: number;
  reason: string;
  notes: string;
}

export interface OrderReturn {
  returnId: string;
  items: ReturnFormItem[];
  status: string;
  reviewNotes?: string;
  reviewNotesEn?: string;
  displayReviewNotes?: string; // Derived field: reviewNotes (isRtl=true) or reviewNotesEn (isRtl=false)
  createdAt: string;
}

export interface StatusHistory {
  status: string;
  changedBy: string;
  changedByName: string; // Derived field: name (isRtl=true) or nameEn (isRtl=false)
  changedAt: string;
  notes?: string;
  notesEn?: string;
  displayNotes: string; // Derived field: notes (isRtl=true) or notesEn (isRtl=false)
}

export interface Order {
  id: string;
  orderNumber: string;
  branchId: string;
  branchName: string;
  branchNameEn?: string;
  branch: { _id: string; name: string; nameEn?: string; displayName: string };
  items: OrderItem[];
  returns: OrderReturn[];
  status: OrderStatus;
  totalAmount: number;
  adjustedTotal: number;
  date: string;
  requestedDeliveryDate: string;
  notes?: string;
  notesEn?: string;
  displayNotes: string; // Derived field: notes (isRtl=true) or notesEn (isRtl=false)
  priority: 'urgent' | 'high' | 'medium' | 'low';
  createdBy: string;
  createdByName: string; // Derived field: name (isRtl=true) or nameEn (isRtl=false)
  statusHistory: StatusHistory[];
  approvedAt?: string;
  transitStartedAt?: string;
  deliveredAt?: string;
  confirmedAt?: string;
  confirmedBy?: string;
  isRtl: boolean;
}

export interface ReturnForm {
  itemId: string;
  quantity: number;
  reason: string;
  reasonEn?: string;
  notes: string;
  notesEn?: string;
}

export interface State {
  orders: Order[];
  selectedOrder: Order | null;
  isViewModalOpen: boolean;
  isConfirmDeliveryModalOpen: boolean;
  isReturnModalOpen: boolean;
  returnFormData: ReturnForm;
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
  | { type: 'SET_MODAL'; modal: 'view' | 'confirmDelivery' | 'return'; isOpen: boolean }
  | { type: 'SET_RETURN_FORM'; payload: ReturnForm }
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
  | { type: 'ADD_RETURN'; orderId: string; returnData: OrderReturn }
  | { type: 'UPDATE_RETURN_STATUS'; orderId: string; returnId: string; status: string }
  | { type: 'TASK_ASSIGNED'; orderId: string; items: { _id: string; assignedTo: { _id: string; username: string; name: string; nameEn?: string; displayName: string } }[] }
  | { type: 'MISSING_ASSIGNMENTS'; orderId: string; itemId: string; productName: string }
  | { type: 'SET_VIEW_MODE'; payload: 'card' | 'table' }
  | { type: 'SET_INVENTORY'; payload: any[] }
  | { type: 'UPDATE_INVENTORY'; payload: { productId: string; quantity: number; type: string } };



  