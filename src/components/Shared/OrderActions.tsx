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

    const handleApprove = useCallback(() => updateOrderStatus(order.id, OrderStatus.Approved), [updateOrderStatus, order.id]);
    const handleCancel = useCallback(() => updateOrderStatus(order.id, OrderStatus.Cancelled), [updateOrderStatus, order.id]);
    const handleAssign = useCallback(() => openAssignModal(order), [openAssignModal, order]);
    const handleShip = useCallback(() => updateOrderStatus(order.id, OrderStatus.InTransit), [updateOrderStatus, order.id]);

    return (
      <div className={`flex flex-wrap gap-2 ${isRtl ? 'justify-end' : 'justify-start'}`}>
        {user?.role === 'production' && order.status === 'pending' && (
          <>
            <Button
              variant="success"
              size="sm"
              icon={Check}
              onClick={handleApprove}
              disabled={submitting === order.id}
              className="bg-green-600 hover:bg-green-700 text-white rounded-full px-3 py-1 text-xs shadow-md"
              aria-label={isRtl ? `الموافقة على طلب ${order.orderNumber}` : `Approve order ${order.orderNumber}`}
            >
              {isRtl ? 'موافقة' : 'Approve'}
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={X}
              onClick={handleCancel}
              disabled={submitting === order.id}
              className="bg-red-600 hover:bg-red-700 text-white rounded-full px-3 py-1 text-xs shadow-md"
              aria-label={isRtl ? `إلغاء طلب ${order.orderNumber}` : `Cancel order ${order.orderNumber}`}
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
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
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-3 py-1 text-xs shadow-md"
            aria-label={isRtl ? `توزيع طلب ${order.orderNumber}` : `Assign order ${order.orderNumber}`}
          >
            {isRtl ? 'توزيع' : 'Assign'}
          </Button>
        )}
        {user?.role === 'production' && order.status === 'completed' && (
          <Button
            variant="primary"
            size="sm"
            icon={Truck}
            onClick={handleShip}
            disabled={submitting === order.id}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-full px-3 py-1 text-xs shadow-md"
            aria-label={isRtl ? `شحن طلب ${order.orderNumber}` : `Ship order ${order.orderNumber}`}
          >
            {isRtl ? 'شحن' : 'Ship'}
          </Button>
        )}
      </div>
    );
  }
);

export default OrderActions;