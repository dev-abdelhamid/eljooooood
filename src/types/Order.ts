export interface Order {
  id: string;
  orderNumber: string;
  branchName: string;
  branchId: string;
  items: Array<{
    _id: string;
    product: { _id: string; name: string; department: { _id: string; name: string } };
    quantity: number;
    price: number;
    status: 'pending' | 'assigned' | 'in_progress' | 'completed';
    assignedTo?: { _id: string; username: string };
    returnedQuantity?: number;
    returnReason?: string;
  }>;
  returns?: Array<{
    returnId: string;
    status: 'pending_approval' | 'approved' | 'rejected' | 'processed';
    items: Array<{
      itemId: string;
      quantity: number;
      reason: string;
    }>;
    createdAt: string;
    reviewedAt?: string | null;
    reviewNotes?: string;
  }>;
  status: 'pending' | 'approved' | 'in_production' | 'completed' | 'in_transit' | 'delivered' | 'cancelled';
  totalAmount: number;
  adjustedTotal?: number;
  date: string;
  notes?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdBy: string;
  statusHistory?: Array<{
    status: string;
    changedBy: string;
    changedAt: string;
    notes?: string;
  }>;
}

export interface Chef {
  _id: string;
  userId: string;
  username: string;
  name: string;
  department: { _id: string; name: string } | null;
}

export interface AssignChefsForm {
  items: Array<{
    itemId: string;
    assignedTo: string;
    product: string;
    quantity: number;
  }>;
}

export interface State {
  orders: Order[];
  selectedOrder: Order | null;
  chefs: Chef[];
  isViewModalOpen: boolean;
  isAssignModalOpen: boolean;
  assignFormData: AssignChefsForm;
  filterStatus: string;
  searchQuery: string;
  sortBy: 'date' | 'totalAmount' | 'priority';
  sortOrder: 'asc' | 'desc';
  currentPage: number;
  loading: boolean;
  error: string;
  submitting: string | null;
  socketConnected: boolean;
  socketError: string | null;
}

export type Action =
  | { type: 'SET_ORDERS'; payload: Order[] }
  | { type: 'SET_SELECTED_ORDER'; payload: Order | null }
  | { type: 'SET_CHEFS'; payload: Chef[] }
  | { type: 'SET_MODAL'; modal: 'view' | 'assign'; isOpen: boolean }
  | { type: 'SET_ASSIGN_FORM'; payload: AssignChefsForm }
  | { type: 'SET_FILTER_STATUS'; payload: string }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SORT'; by: 'date' | 'totalAmount' | 'priority'; order: 'asc' | 'desc' }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_SUBMITTING'; payload: string | null }
  | { type: 'SET_SOCKET_CONNECTED'; payload: boolean }
  | { type: 'SET_SOCKET_ERROR'; payload: string | null }
  | { type: 'UPDATE_ORDER_STATUS'; orderId: string; status: Order['status'] }
  | { type: 'UPDATE_ITEM_STATUS'; payload: { orderId: string; itemId: string; status: Order['items'][0]['status'] } }
  | { type: 'TASK_ASSIGNED'; orderId: string; items: any[] }
  | { type: 'RETURN_STATUS_UPDATED'; orderId: string; returnId: string; status: string }
  | { type: 'MISSING_ASSIGNMENTS'; orderId: string; itemId: string; productName: string };