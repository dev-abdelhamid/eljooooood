import React, { useMemo } from 'react';
import { Card } from '../UI/Card';
import { Button } from '../UI/Button';
import { CheckCircle, Clock } from 'lucide-react';
import { FactoryOrder, UserRole } from '../../types/types';

interface OrderCardProps {
  order: FactoryOrder;
  calculateTotalQuantity: (order: FactoryOrder) => number;
  translateUnit: (unit: string, isRtl: boolean) => string;
  updateOrderStatus: (orderId: string, status: FactoryOrder['status']) => void;
  openAssignModal: (order: FactoryOrder) => void;
  confirmItemCompletion: (orderId: string, itemId: string) => void;
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
    stock: 'إضافة إلى المخزون',
    pending: 'قيد الانتظار',
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
    stock: 'Add to Stock',
    pending: 'Pending',
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
  updateOrderStatus,
  openAssignModal,
  confirmItemCompletion,
  submitting,
  isRtl,
  currentUserRole,
}) => {
  const t = translations[isRtl ? 'ar' : 'en'];
  const statusStyles = useMemo(
    () => ({
      pending: 'bg-yellow-100 text-yellow-800',
      in_production: 'bg-purple-100 text-purple-800',
      completed: 'bg-green-100 text-green-800',
      stocked: 'bg-blue-100 text-blue-800',
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

  const canApprove = ['admin', 'production_manager'].includes(currentUserRole);
  const canComplete = ['chef', 'admin', 'production_manager'].includes(currentUserRole);

  return (
    <Card className="p-4 bg-white shadow-md rounded-lg border border-gray-200 hover:shadow-lg transition-shadow duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={isRtl ? 'text-right' : 'text-left'}>
          <h3 className="text-xs font-semibold text-gray-800">{t.orderNumber}: {order.orderNumber}</h3>
          <p className="text-xxs text-gray-600">{t.date}: {order.date}</p>
          <p className="text-xxs text-gray-600">{t.createdBy}: {order.createdBy}</p>
          <p className="text-xxs text-gray-600">
            {t.priority}:{' '}
            <span className={`inline-flex px-1 py-0.5 text-xxs font-semibold rounded-full ${priorityStyles[order.priority]}`}>
              {t[order.priority]}
            </span>
          </p>
        </div>
        <div className={isRtl ? 'text-right' : 'text-left'}>
          <p className="text-xxs text-gray-600">
            {t.status}:{' '}
            <span className={`inline-flex px-1 py-0.5 text-xxs font-semibold rounded-full ${statusStyles[order.status]}`}>
              {t[order.status]}
            </span>
          </p>
          <p className="text-xxs text-gray-600">{t.quantity}: {calculateTotalQuantity(order)}</p>
          <p className="text-xxs text-gray-600">{t.notes}: {order.notes || '—'}</p>
        </div>
      </div>
      <div className="mt-3">
        <h4 className="text-xs font-medium text-gray-700">{t.items}</h4>
        <ul className="mt-2 space-y-1">
          {order.items.map((item) => (
            <li key={item._id} className="text-xxs text-gray-600 flex items-center justify-between">
              <span>
                {item.displayProductName} ({item.quantity} {translateUnit(item.unit, isRtl)})
                {item.assignedTo && (
                  <span className="ml-2 text-xxs text-gray-500">
                    ({isRtl ? 'معين إلى' : 'Assigned to'}: {item.assignedTo.displayName})
                  </span>
                )}
              </span>
              <div className="flex items-center gap-1">
                {item.progress > 0 && (
                  <span className="text-xxs text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {item.progress}%
                  </span>
                )}
                {order.status === 'in_production' && item.assignedTo?._id === user.id && item.status !== 'completed' && currentUserRole === 'chef' && (
                  <Button
                    variant="success"
                    onClick={() => confirmItemCompletion(order.id, item._id)}
                    disabled={submitting === item._id}
                    className="bg-green-500 hover:bg-green-600 text-white rounded-md px-2 py-0.5 text-xxs shadow-sm"
                    aria-label={t.complete}
                  >
                    {submitting === item._id ? '...' : <CheckCircle className="w-3 h-3" />}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className={`mt-4 flex gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
        {order.status === 'pending' && canApprove && (
          <Button
            variant="primary"
            onClick={() => updateOrderStatus(order.id, 'in_production')}
            disabled={submitting === order.id}
            className="bg-amber-500 hover:bg-amber-600 text-white rounded-md px-2 py-0.5 text-xxs shadow-sm"
            aria-label={t.approve}
          >
            {submitting === order.id ? '...' : t.approve}
          </Button>
        )}
        {order.status === 'in_production' && order.items.some(i => !i.assignedTo) && canApprove && (
          <Button
            variant="primary"
            onClick={() => openAssignModal(order)}
            disabled={submitting === order.id}
            className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-md px-2 py-0.5 text-xxs shadow-sm"
            aria-label={t.assign}
          >
            {submitting === order.id ? '...' : t.assign}
          </Button>
        )}
        {order.status === 'in_production' && canComplete && (
          <Button
            variant="success"
            onClick={() => updateOrderStatus(order.id, 'completed')}
            disabled={submitting === order.id || order.items.some(i => i.status !== 'completed')}
            className="bg-green-500 hover:bg-green-600 text-white rounded-md px-2 py-0.5 text-xxs shadow-sm"
            aria-label={t.complete}
          >
            {submitting === order.id ? '...' : <CheckCircle className="w-3 h-3" />}
          </Button>
        )}
        {order.status === 'completed' && canApprove && (
          <Button
            variant="primary"
            onClick={() => updateOrderStatus(order.id, 'stocked')}
            disabled={submitting === order.id}
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-0.5 text-xxs shadow-sm"
            aria-label={t.stock}
          >
            {submitting === order.id ? '...' : t.stock}
          </Button>
        )}
        {['pending', 'in_production'].includes(order.status) && (
          <Button
            variant="danger"
            onClick={() => updateOrderStatus(order.id, 'cancelled')}
            disabled={submitting === order.id}
            className="bg-red-500 hover:bg-red-600 text-white rounded-md px-2 py-0.5 text-xxs shadow-sm"
            aria-label={t.cancel}
          >
            {submitting === order.id ? '...' : t.cancel}
          </Button>
        )}
      </div>
    </Card>
  );
};

export default OrderCard;