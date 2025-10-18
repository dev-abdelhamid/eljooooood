import React, { useMemo } from 'react';
import { Card } from '../UI/Card';
import { Button } from '../UI/Button';
import { CheckCircle } from 'lucide-react';
import { FactoryOrder, UserRole } from '../../types/types';

interface OrderCardProps {
  order: FactoryOrder;
  calculateTotalQuantity: (order: FactoryOrder) => number;
  translateUnit: (unit: string, isRtl: boolean) => string;
  approveOrder: (orderId: string) => void;
  updateOrderStatus: (orderId: string, status: FactoryOrder['status']) => void;
  confirmItemCompletion: (orderId: string, itemId: string) => void;
  openAssignModal: (order: FactoryOrder) => void;
  confirmFactoryProduction: (orderId: string) => void;
  submitting: string | null;
  isRtl: boolean;
  currentUserRole: UserRole;
}

const translations = {
  ar: {
    orderNumber: 'رقم الطلب',
    date: 'التاريخ',
    items: 'العناصر',
    quantity: 'الكمية',
    status: 'الحالة',
    priority: 'الأولوية',
    notes: 'الملاحظات',
    createdBy: 'تم الإنشاء بواسطة',
    approve: 'الموافقة',
    complete: 'إكمال',
    cancel: 'إلغاء',
    assign: 'تعيين شيفات',
    confirmStock: 'تأكيد الإضافة إلى المخزون',
    requested: 'مطلوب',
    pending: 'قيد الانتظار',
    approved: 'تم الموافقة',
    in_production: 'في الإنتاج',
    completed: 'مكتمل',
    stocked: 'مخزن',
    cancelled: 'ملغى',
    low: 'منخفض',
    medium: 'متوسط',
    high: 'مرتفع',
    urgent: 'عاجل',
  },
  en: {
    orderNumber: 'Order Number',
    date: 'Date',
    items: 'Items',
    quantity: 'Quantity',
    status: 'Status',
    priority: 'Priority',
    notes: 'Notes',
    createdBy: 'Created By',
    approve: 'Approve',
    complete: 'Complete',
    cancel: 'Cancel',
    assign: 'Assign Chefs',
    confirmStock: 'Confirm Add to Inventory',
    requested: 'Requested',
    pending: 'Pending',
    approved: 'Approved',
    in_production: 'In Production',
    completed: 'Completed',
    stocked: 'Stocked',
    cancelled: 'Cancelled',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    urgent: 'Urgent',
  },
};

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  calculateTotalQuantity,
  translateUnit,
  approveOrder,
  updateOrderStatus,
  confirmItemCompletion,
  openAssignModal,
  confirmFactoryProduction,
  submitting,
  isRtl,
  currentUserRole,
}) => {
  const t = translations[isRtl ? 'ar' : 'en'];
  const statusStyles = useMemo(
    () => ({
      requested: 'bg-orange-100 text-orange-800',
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      in_production: 'bg-indigo-100 text-indigo-800',
      completed: 'bg-green-100 text-green-800',
      stocked: 'bg-purple-100 text-purple-800',
      cancelled: 'bg-red-100 text-red-800',
    }),
    []
  );
  const priorityStyles = useMemo(
    () => ({
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800',
    }),
    []
  );

  const canApprove = ['admin', 'production'].includes(currentUserRole);
  const canAssign = ['admin', 'production'].includes(currentUserRole);
  const canComplete = ['chef', 'admin', 'production'].includes(currentUserRole);
  const canConfirmStock = ['admin', 'production'].includes(currentUserRole);

  const allAssigned = order.items.every((item) => item.assignedTo);
  const allCompleted = order.items.every((item) => item.status === 'completed');
  const displayStatus = order.status === 'completed' && order.inventoryProcessed ? 'stocked' : order.status;

  return (
    <Card className="p-4 bg-white shadow-md rounded-lg border border-gray-200 hover:shadow-lg transition-shadow duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className={isRtl ? 'text-right' : 'text-left'}>
          <h3 className="text-sm font-semibold text-gray-800">{t.orderNumber}: {order.orderNumber}</h3>
          <p className="text-xs text-gray-600">{t.date}: {order.date}</p>
          <p className="text-xs text-gray-600">{t.createdBy}: {order.createdBy}</p>
          <p className="text-xs text-gray-600">
            {t.priority}: <span className={`px-2 py-1 rounded-full text-xs ${priorityStyles[order.priority]}`}>{t[order.priority]}</span>
          </p>
        </div>
        <div className={isRtl ? 'text-right' : 'text-left'}>
          <p className="text-xs text-gray-600">
            {t.status}: <span className={`px-2 py-1 rounded-full text-xs ${statusStyles[displayStatus]}`}>{t[displayStatus]}</span>
          </p>
          <p className="text-xs text-gray-600">{t.quantity}: {calculateTotalQuantity(order)}</p>
          <p className="text-xs text-gray-600">{t.notes}: {order.notes || '—'}</p>
        </div>
      </div>
      <div className="mt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">{t.items}</h4>
        <ul className="space-y-2">
          {order.items.map((item) => (
            <li key={item._id} className="text-xs text-gray-600 flex items-center justify-between gap-2">
              <span>
                {item.displayProductName} ({item.quantity} {translateUnit(item.unit, isRtl)})
                {item.assignedTo && <span className="text-gray-500 ml-2">({t.assign}: {item.assignedTo.displayName})</span>}
              </span>
              {order.status === 'in_production' && currentUserRole === 'chef' && item.assignedTo?._id === user?.id && item.status !== 'completed' && (
                <Button
                  variant="success"
                  onClick={() => confirmItemCompletion(order.id, item._id)}
                  disabled={submitting === item._id}
                  className="px-2 py-1 text-xs"
                >
                  {submitting === item._id ? '...' : <CheckCircle className="w-4 h-4" />}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className={`mt-4 flex gap-2 flex-wrap ${isRtl ? 'flex-row-reverse' : ''}`}>
        {(order.status === 'requested' || order.status === 'pending') && canApprove && (
          <Button
            variant="primary"
            onClick={() => approveOrder(order.id)}
            disabled={submitting === order.id}
            className="px-3 py-1 text-xs"
          >
            {submitting === order.id ? '...' : t.approve}
          </Button>
        )}
        {order.status === 'approved' && !allAssigned && canAssign && (
          <Button
            variant="primary"
            onClick={() => openAssignModal(order)}
            disabled={submitting === order.id}
            className="px-3 py-1 text-xs"
          >
            {submitting === order.id ? '...' : t.assign}
          </Button>
        )}
        {order.status === 'in_production' && allAssigned && allCompleted && canComplete && (
          <Button
            variant="success"
            onClick={() => updateOrderStatus(order.id, 'completed')}
            disabled={submitting === order.id}
            className="px-3 py-1 text-xs"
          >
            {submitting === order.id ? '...' : t.complete}
          </Button>
        )}
        {order.status === 'completed' && !order.inventoryProcessed && canConfirmStock && (
          <Button
            variant="success"
            onClick={() => confirmFactoryProduction(order.id)}
            disabled={submitting === order.id}
            className="px-3 py-1 text-xs"
          >
            {submitting === order.id ? '...' : t.confirmStock}
          </Button>
        )}
        {(order.status === 'requested' || order.status === 'pending' || order.status === 'approved' || order.status === 'in_production') && (
          <Button
            variant="danger"
            onClick={() => updateOrderStatus(order.id, 'cancelled')}
            disabled={submitting === order.id}
            className="px-3 py-1 text-xs"
          >
            {submitting === order.id ? '...' : t.cancel}
          </Button>
        )}
      </div>
    </Card>
  );
};

export default OrderCard;