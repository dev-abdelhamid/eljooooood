import React, { useMemo } from 'react';
import { Card } from '../UI/Card';
import { Button } from '../UI/Button';
import { UserCheck, CheckCircle, Clock } from 'lucide-react';
import { FactoryOrder } from '../../types/types';

interface OrderCardProps {
  order: FactoryOrder;
  calculateTotalQuantity: (order: FactoryOrder) => number;
  translateUnit: (unit: string, isRtl: boolean) => string;
  updateOrderStatus: (orderId: string, status: FactoryOrder['status']) => void;
  openAssignModal: (order: FactoryOrder) => void;
  submitting: string | null;
  isRtl: boolean;
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
    assignChefs: 'تعيين شيفات',
    requested: 'مطلوب',
    pending: 'قيد الانتظار',
    approved: 'تم الموافقة',
    in_production: 'في الإنتاج',
    completed: 'مكتمل',
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
    assignChefs: 'Assign Chefs',
    requested: 'Requested',
    pending: 'Pending',
    approved: 'Approved',
    in_production: 'In Production',
    completed: 'Completed',
    cancelled: 'Cancelled',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    urgent: 'Urgent',
  },
};

export const OrderCard = ({
  order,
  calculateTotalQuantity,
  translateUnit,
  updateOrderStatus,
  openAssignModal,
  submitting,
  isRtl,
}) => {
  const t = translations[isRtl ? 'ar' : 'en'];
  const statusStyles = useMemo(
    () => ({
      requested: 'bg-blue-100 text-blue-800',
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-indigo-100 text-indigo-800',
      in_production: 'bg-purple-100 text-purple-800',
      completed: 'bg-green-100 text-green-800',
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
  const allAssigned = order.items.every(i => i.status === 'assigned' || i.status === 'in_progress' || i.status === 'completed');
  return (
    <Card className="p-4 bg-white shadow-md rounded-lg border border-gray-200 hover:shadow-lg transition-shadow duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={isRtl ? 'text-right' : 'text-left'}>
          <h3 className="text-sm font-semibold text-gray-800">{t.orderNumber}: {order.orderNumber}</h3>
          <p className="text-xs text-gray-600">{t.date}: {order.date}</p>
          <p className="text-xs text-gray-600">{t.createdBy}: {order.createdBy}</p>
          <p className="text-xs text-gray-600">
            {t.priority}:{' '}
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${priorityStyles[order.priority]}`}>
              {t[order.priority]}
            </span>
          </p>
        </div>
        <div className={isRtl ? 'text-right' : 'text-left'}>
          <p className="text-xs text-gray-600">
            {t.status}:{' '}
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusStyles[order.status]}`}>
              {t[order.status]}
            </span>
          </p>
          <p className="text-xs text-gray-600">{t.quantity}: {calculateTotalQuantity(order)}</p>
          <p className="text-xs text-gray-600">{t.notes}: {order.notes || '—'}</p>
        </div>
      </div>
      <div className="mt-3">
        <h4 className="text-sm font-medium text-gray-700">{t.items}</h4>
        <ul className="mt-2 space-y-1">
          {order.items.map((item) => (
            <li key={item._id} className="text-xs text-gray-600 flex items-center justify-between">
              <span>
                {item.displayProductName} ({item.quantity} {translateUnit(item.unit, isRtl)})
                {item.assignedTo && (
                  <span className="ml-2 text-xs text-gray-500">
                    ({isRtl ? 'معين إلى' : 'Assigned to'}: {item.assignedTo.displayName})
                  </span>
                )}
              </span>
              {item.progress > 0 && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {item.progress}%
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className={`mt-4 flex gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
        {order.status === 'requested' && (
          <Button
            variant="primary"
            onClick={() => updateOrderStatus(order.id, 'approved')}
            disabled={submitting === order.id}
            className="bg-amber-500 hover:bg-amber-600 text-white rounded-md px-3 py-1 text-xs shadow-sm"
            aria-label={t.approve}
          >
            {submitting === order.id ? '...' : t.approve}
          </Button>
        )}
        {['pending', 'approved'].includes(order.status) && !allAssigned && (
          <Button
            variant="secondary"
            onClick={() => openAssignModal(order)}
            disabled={submitting === order.id}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md px-3 py-1 text-xs shadow-sm"
            aria-label={t.assignChefs}
          >
            {t.assignChefs}
          </Button>
        )}
        {order.status === 'in_production' && order.items.every(i => i.status === 'completed') && (
          <Button
            variant="success"
            onClick={() => updateOrderStatus(order.id, 'completed')}
            disabled={submitting === order.id}
            className="bg-green-500 hover:bg-green-600 text-white rounded-md px-3 py-1 text-xs shadow-sm"
            aria-label={t.complete}
          >
            {submitting === order.id ? '...' : <CheckCircle className="w-4 h-4" />}
          </Button>
        )}
        {['requested', 'pending', 'approved', 'in_production'].includes(order.status) && (
          <Button
            variant="danger"
            onClick={() => updateOrderStatus(order.id, 'cancelled')}
            disabled={submitting === order.id}
            className="bg-red-500 hover:bg-red-600 text-white rounded-md px-3 py-1 text-xs shadow-sm"
            aria-label={t.cancel}
          >
            {submitting === order.id ? '...' : t.cancel}
          </Button>
        )}
      </div>
    </Card>
  );
};