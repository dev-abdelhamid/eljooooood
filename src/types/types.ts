// تعريف حالات الطلب
export enum OrderStatus {
  Pending = 'pending',
  Approved = 'approved',
  InProduction = 'in_production',
  Completed = 'completed',
  InTransit = 'in_transit',
  Delivered = 'delivered',
  Cancelled = 'cancelled',
}

// تعريف حالات العنصر داخل الطلب
export enum ItemStatus {
  Pending = 'pending',
  Assigned = 'assigned',
  InProgress = 'in_progress',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

// تعريف مستويات الأولوية
export enum Priority {
  Urgent = 'urgent',
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

// تعريف حالات الإرجاع
export enum ReturnStatus {
  PendingApproval = 'pending_approval',
  Approved = 'approved',
  Rejected = 'rejected',
  Processed = 'processed',
}

// واجهة الطلب
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
    unit: string; // وحدة القياس (مثل: قطعة، كجم)
    department: { _id: string; name: string };
    assignedTo?: { _id: string; name: string }; // الشيف المعين (اختياري)
    status: ItemStatus;
    returnedQuantity?: number; // الكمية المرتجعة (اختياري)
    returnReason?: string; // سبب الإرجاع (اختياري)
  }>;
  returns: Array<{
    returnId: string;
    items: Array<{
      productId: string;
      quantity: number;
      reason: string;
      unit: string;
    }>;
    status: ReturnStatus;
    reviewNotes?: string; // ملاحظات المراجعة (اختياري)
    createdAt: string; // تاريخ إنشاء الإرجاع
  }>;
  status: OrderStatus;
  totalAmount: number;
  date: string;
  notes?: string; // ملاحظات إضافية (اختياري)
  priority: Priority;
  createdBy: string; // معرف أو اسم المستخدم الذي أنشأ الطلب
  statusHistory: Array<{
    status: OrderStatus;
    changedBy: string;
    changedAt: string;
    notes?: string;
  }>;
}

// واجهة الشيف
export interface Chef {
  _id: string;
  userId: string;
  name: string; // اسم الشيف لعرضه في الواجهة
  department: { _id: string; name: string } | null; // القسم الخاص بالشيف
}

// واجهة الفرع
export interface Branch {
  _id: string;
  name: string; // اسم الفرع
}

// واجهة تعيين الشيفات
export interface AssignChefsForm {
  items: Array<{
    itemId: string;
    assignedTo: string; // معرف الشيف
    product: string; // اسم المنتج
    quantity: number;
    unit: string; // وحدة القياس
  }>;
}

// واجهة المستخدم
export interface User {
  id: string;
  username: string;
  role: 'admin' | 'branch' | 'chef' | 'production';
  name: string;
  branchId?: string; // معرف الفرع (اختياري)
  department?: { _id: string; name: string }; // القسم (اختياري)
}

// واجهة نموذج الإرجاع (لدعم مكونات أخرى محتملة)
export interface ReturnForm {
  itemId: string;
  quantity: number;
  reason: string;
  notes: string;
}