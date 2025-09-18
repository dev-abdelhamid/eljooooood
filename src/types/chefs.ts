export interface Stats {
  totalOrders: number;
  pendingOrders: number;
  approvedOrders: number;
  inProductionOrders: number;
  completedOrders: number;
  inTransitOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  totalSales: number;
  completedTasks: number;
  inProgressTasks: number;
  activeProducts: number;
  returns: number;
  pendingReview: number;
  averageOrderValue: number;
  dailySales: number;
  topBranchPerformance: number;
}

export interface Task {
  id: string;
  orderId: string;
  orderNumber: string;
  productName: string;
  quantity: number;
  unit: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed';
  branchName: string;
  createdAt: string;
}

export interface BranchPerformance {
  branchName: string;
  performance: number;
  totalOrders: number;
  completedOrders: number;
}

export interface ChefPerformance {
  chefName: string;
  performance: number;
  totalTasks: number;
  completedTasks: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  branchName: string;
  branchId: string;
  items: Array<{
    _id: string;
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    department: { _id: string; name: string };
    assignedTo?: { _id: string; username: string };
    status: 'pending' | 'assigned' | 'in_progress' | 'completed';
    returnedQuantity?: number;
    returnReason?: string;
  }>;
  returns?: Array<{
    returnId: string;
    status: 'pending_approval' | 'approved' | 'rejected' | 'processed';
    items: Array<{
      productId: string;
      quantity: number;
      reason: string;
    }>;
    reviewNotes?: string;
    createdAt: string;
  }>;
  status: 'pending' | 'approved' | 'in_production' | 'completed' | 'in_transit' | 'delivered' | 'cancelled';
  totalAmount: number;
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
  createdAt: string;
}

export interface Chef {
  _id: string;
  userId: string;
  username: string;
  name: string;
  department: { _id: string; name: string } | null;
}

export interface User {
  id?: string;
  _id?: string;
  role: 'admin' | 'branch' | 'production' | 'chef';
  username: string;
  branchName?: string;
  department?: { _id: string; name: string };
}

export interface State {
  orders: Order[];
  tasks: Task[];
  chefs: Chef[];
  branches: { _id: string; name: string }[];
  branchPerformance: BranchPerformance[];
  chefPerformance: ChefPerformance[];
  stats: Stats;
  timeFilter: string;
  loading: boolean;
  error: string;
  socketConnected: boolean;
  socketError: string | null;
}

export interface Action {
  type:
    | 'SET_ORDERS'
    | 'SET_TASKS'
    | 'SET_CHEFS'
    | 'SET_BRANCHES'
    | 'SET_BRANCH_PERFORMANCE'
    | 'SET_CHEF_PERFORMANCE'
    | 'SET_STATS'
    | 'SET_TIME_FILTER'
    | 'SET_LOADING'
    | 'SET_ERROR'
    | 'SET_SOCKET_CONNECTED'
    | 'SET_SOCKET_ERROR'
    | 'UPDATE_ORDER_STATUS'
    | 'UPDATE_ITEM_STATUS'
    | 'TASK_ASSIGNED';
  payload?: any;
  orderId?: string;
  status?: Order['status'];
}