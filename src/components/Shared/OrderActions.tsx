import React, { memo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../UI/Button';
import { Check, X, Package, Truck } from 'lucide-react';
import { Order, OrderStatus } from '../../types/types';

interface OrderActionsProps {
  order: Order;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  openAssignModal: (order: Order) => void;
  submitting: string | null;
  isRtl: boolean;
}

const OrderActions: React.FC<OrderActionsProps> = memo(
  ({ order, updateOrderStatus, openAssignModal, submitting, isRtl }) => {
    const { user } = useAuth();
    const unassignedItems = order.items.filter((item) => !item.assignedTo);

    const handleUpdateStatus = useCallback(
      (newStatus: OrderStatus) => updateOrderStatus(order.id, newStatus),
      [updateOrderStatus, order.id]
    );

    const handleAssign = useCallback(() => openAssignModal(order), [openAssignModal, order]);


    

    const validTransitions = {
      pending: [OrderStatus.Approved, OrderStatus.Cancelled],
      approved: [OrderStatus.InProduction, OrderStatus.Cancelled],
      in_production: [OrderStatus.Completed, OrderStatus.Cancelled],
      completed: [OrderStatus.InTransit],
      in_transit: [OrderStatus.Delivered],
      delivered: [],
      cancelled: [],
    };


    

    const statusTranslations = {
      approved: isRtl ? 'موافقة' : 'Approve',
      cancelled: isRtl ? 'إلغاء' : 'Cancel',
      in_production: isRtl ? 'بدء الإنتاج' : 'Start Production',
      completed: isRtl ? 'مكتمل' : 'Completed',
      in_transit: isRtl ? 'شحن' : 'Ship',
      delivered: isRtl ? 'تم التسليم' : 'Delivered',
    };

    return (
      <div className={`flex flex-wrap gap-2 ${isRtl ? 'justify-end' : 'justify-start'}`}>
        {user?.role === 'production' && order.status === 'pending' && (
          <>
            <Button
              variant="success"
              size="sm"
              icon={Check}
              onClick={() => handleUpdateStatus(OrderStatus.Approved)}
              disabled={submitting === order.id}
              className="bg-green-600 hover:bg-green-700 text-white rounded-full px-3 py-1 text-xs shadow-md transition-all"
              aria-label={isRtl ? `الموافقة على طلب ${order.orderNumber}` : `Approve order ${order.orderNumber}`}
            >
              {submitting === order.id ? (isRtl ? 'جارٍ...' : 'Loading...') : statusTranslations.approved}
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={X}
              onClick={() => handleUpdateStatus(OrderStatus.Cancelled)}
              disabled={submitting === order.id}
              className="bg-red-600 hover:bg-red-700 text-white rounded-full px-3 py-1 text-xs shadow-md transition-all"
              aria-label={isRtl ? `إلغاء طلب ${order.orderNumber}` : `Cancel order ${order.orderNumber}`}
            >
              {submitting === order.id ? (isRtl ? 'جارٍ...' : 'Loading...') : statusTranslations.cancelled}
            </Button>
          </>
        )}
        {user?.role === 'production' && order.status === 'approved' && unassignedItems.length > 0 && (
          <Button
            variant="primary"
            size="sm"
            icon={Package}
            onClick={handleAssign}
            disabled={submitting === order.id}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-3 py-1 text-xs shadow-md transition-all"
            aria-label={isRtl ? `توزيع طلب ${order.orderNumber}` : `Assign order ${order.orderNumber}`}
          >
            {submitting === order.id ? (isRtl ? 'جارٍ...' : 'Loading...') : (isRtl ? 'توزيع' : 'Assign')}
          </Button>
        )}
        {user?.role === 'production' && order.status === 'completed' && (
          <Button
            variant="primary"
            size="sm"
            icon={Truck}
            onClick={() => handleUpdateStatus(OrderStatus.InTransit)}
            disabled={submitting === order.id}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-full px-3 py-1 text-xs shadow-md transition-all"
            aria-label={isRtl ? `شحن طلب ${order.orderNumber}` : `Ship order ${order.orderNumber}`}
          >
            {submitting === order.id ? (isRtl ? 'جارٍ...' : 'Loading...') : statusTranslations.in_transit}
          </Button>
        )}
        {user?.role === 'admin' && validTransitions[order.status].length > 0 && (
          validTransitions[order.status].map((status) => (
            <Button
              key={status}
              variant="outline"
              size="sm"
              onClick={() => handleUpdateStatus(status)}
              disabled={submitting === order.id}
              className="text-xs shadow-md transition-all"
              aria-label={isRtl ? `تغيير حالة طلب ${order.orderNumber} إلى ${statusTranslations[status]}` : `Change status of order ${order.orderNumber} to ${statusTranslations[status]}`}
            >
              {statusTranslations[status]}
            </Button>
          ))
        )}
      </div>
    );
  }
);

export default OrderActions;