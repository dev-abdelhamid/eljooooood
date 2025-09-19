import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../UI/Button';
import { Check, Package, X } from 'lucide-react';
import { Order, OrderStatus } from '../../types';

interface OrderActionsProps {
  order: Order;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  openAssignModal: (order: Order) => void;
  submitting: string | null;
}

export const OrderActions: React.FC<OrderActionsProps> = ({
  order,
  updateOrderStatus,
  openAssignModal,
  submitting,
}) => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const unassignedItems = order.items.filter((item) => !item.assignedTo);

  return (
    <div className={`flex flex-wrap gap-2 ${isRtl ? 'justify-end' : 'justify-start'}`}>
      {user?.role === 'production' && order.status === OrderStatus.Pending && (
        <>
          <Button
            variant="success"
            size="sm"
            icon={Check}
            onClick={() => updateOrderStatus(order.id, OrderStatus.Approved)}
            className="bg-green-600 hover:bg-green-700 text-white rounded-full px-3 py-1 text-xs"
            disabled={submitting === order.id}
            aria-label={t('orders.approve_order', { orderNumber: order.orderNumber, defaultValue: isRtl ? `الموافقة على طلب رقم ${order.orderNumber}` : `Approve order #${order.orderNumber}` })}
          >
            {submitting === order.id ? t('common.loading', { defaultValue: isRtl ? 'جارٍ التحميل' : 'Loading' }) : t('orders.approve', { defaultValue: isRtl ? 'موافقة' : 'Approve' })}
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={X}
            onClick={() => updateOrderStatus(order.id, OrderStatus.Cancelled)}
            className="bg-red-600 hover:bg-red-700 text-white rounded-full px-3 py-1 text-xs"
            disabled={submitting === order.id}
            aria-label={t('orders.cancel_order', { orderNumber: order.orderNumber, defaultValue: isRtl ? `إلغاء طلب رقم ${order.orderNumber}` : `Cancel order #${order.orderNumber}` })}
          >
            {submitting === order.id ? t('common.loading', { defaultValue: isRtl ? 'جارٍ التحميل' : 'Loading' }) : t('orders.cancel', { defaultValue: isRtl ? 'إلغاء' : 'Cancel' })}
          </Button>
        </>
      )}
      {user?.role === 'production' && order.status === OrderStatus.Approved && unassignedItems.length > 0 && (
        <Button
          variant="primary"
          size="sm"
          icon={Package}
          onClick={() => openAssignModal(order)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-3 py-1 text-xs"
          disabled={submitting === order.id}
          aria-label={t('orders.assign_order', { orderNumber: order.orderNumber, defaultValue: isRtl ? `تعيين طلب رقم ${order.orderNumber}` : `Assign order #${order.orderNumber}` })}
        >
          {submitting === order.id ? t('common.loading', { defaultValue: isRtl ? 'جارٍ التحميل' : 'Loading' }) : t('orders.assign', { defaultValue: isRtl ? 'تعيين' : 'Assign' })}
        </Button>
      )}
      {user?.role === 'production' && order.status === OrderStatus.Completed && (
        <Button
          variant="primary"
          size="sm"
          icon={Package}
          onClick={() => updateOrderStatus(order.id, OrderStatus.InTransit)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-3 py-1 text-xs"
          disabled={submitting === order.id}
          aria-label={t('orders.ship_order', { orderNumber: order.orderNumber, defaultValue: isRtl ? `شحن طلب رقم ${order.orderNumber}` : `Ship order #${order.orderNumber}` })}
        >
          {submitting === order.id ? t('common.loading', { defaultValue: isRtl ? 'جارٍ التحميل' : 'Loading' }) : t('orders.ship', { defaultValue: isRtl ? 'شحن' : 'Ship' })}
        </Button>
      )}
    </div>
  );
};

export default OrderActions;