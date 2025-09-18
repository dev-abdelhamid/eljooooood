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





export interface ReturnForm {
  items: Array<{ itemId: string; productId: string; quantity: number; reason: string }>;
  reason: string;
  notes?: string;
}