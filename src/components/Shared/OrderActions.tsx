import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../UI/Button';
import { Check, Package, X } from 'lucide-react';
import { Order, OrderStatus } from '../../types/types';

interface OrderActionsProps {
  order: Order;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  onAssignChefs: (order: Order) => void;
  submitting: string | null;
  t: (key: string, params?: any) => string;
  isRtl: boolean;
}

const OrderActions: React.FC<OrderActionsProps> = ({
  order,
  updateOrderStatus,
  onAssignChefs,
  submitting,
  t,
  isRtl,
}) => {
  const { user } = useAuth();
  const unassignedItems = order.items.filter((item) => !item.assignedTo);

  return (
    <div className={`flex flex-wrap gap-2 ${isRtl ? 'justify-end' : 'justify-start'}`}>
      {user?.role === 'production' && order.status === 'pending' && (
        <>
          <Button
            variant="success"
            size="sm"
            icon={Check}
            onClick={() => updateOrderStatus(order.id, 'approved')}
            className="bg-green-600 hover:bg-green-700 text-white rounded-full px-3 py-1 text-xs"
            disabled={submitting === order.id}
            aria-label={t('orders.approve_order', { orderNumber: order.orderNumber })}
          >
            {submitting === order.id ? t('common.loading') : t('orders.approve')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={X}
            onClick={() => updateOrderStatus(order.id, 'cancelled')}
            className="bg-red-600 hover:bg-red-700 text-white rounded-full px-3 py-1 text-xs"
            disabled={submitting === order.id}
            aria-label={t('orders.cancel_order', { orderNumber: order.orderNumber })}
          >
            {submitting === order.id ? t('common.loading') : t('orders.cancel')}
          </Button>
        </>
      )}
      {user?.role === 'production' && order.status === 'approved' && unassignedItems.length > 0 && (
        <Button
          variant="primary"
          size="sm"
          icon={Package}
          onClick={() => onAssignChefs(order)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-3 py-1 text-xs"
          disabled={submitting === order.id}
          aria-label={t('orders.assign_order', { orderNumber: order.orderNumber })}
        >
          {submitting === order.id ? t('common.loading') : t('orders.assign')}
        </Button>
      )}
      {user?.role === 'production' && order.status === 'completed' && (
        <Button
          variant="primary"
          size="sm"
          icon={Package}
          onClick={() => updateOrderStatus(order.id, 'in_transit')}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-3 py-1 text-xs"
          disabled={submitting === order.id}
          aria-label={t('orders.ship_order', { orderNumber: order.orderNumber })}
        >
          {submitting === order.id ? t('common.loading') : t('orders.ship')}
        </Button>
      )}
    </div>
  );
};

export default OrderActions;