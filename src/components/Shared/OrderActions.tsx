import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../UI/Button';
import { Check, Package, X } from 'lucide-react';

interface Order {
  id: string;
  orderNumber: string;
  status: 'pending' | 'approved' | 'in_production' | 'completed' | 'in_transit' | 'delivered' | 'cancelled';
  items: Array<{
    _id: string;
    assignedTo?: { _id: string; name: string; department?: { _id: string; name: string } };
  }>;
}

interface OrderActionsProps {
  order: Order;
  updateOrderStatus: (orderId: string, status: Order['status']) => void;
  openAssignModal: (order: Order) => void;
  submitting: string | null;
  isRtl: boolean;
}

const OrderActions: React.FC<OrderActionsProps> = ({
  order,
  updateOrderStatus,
  openAssignModal,
  submitting,
  isRtl,
}) => {
  const { user } = useAuth();
  const unassignedItems = order.items.filter((item) => !item.assignedTo || !item.assignedTo.name);

  return (
    <div className={`flex flex-wrap gap-2 ${isRtl ? 'justify-end' : 'justify-start'}`}>
      {user?.role === 'production' && order.status === 'pending' && (
        <>
          <Button
            variant="success"
            size="sm"
            icon={Check}
            onClick={() => updateOrderStatus(order.id, 'approved')}
            className="bg-green-500 hover:bg-green-600 text-white rounded-full px-3 py-1 text-xs"
            disabled={submitting === order.id}
            aria-label={isRtl ? `الموافقة على طلب رقم ${order.orderNumber}` : `Approve order #${order.orderNumber}`}
          >
            {submitting === order.id ? (isRtl ? 'جارٍ...' : 'Loading...') : (isRtl ? 'موافقة' : 'Approve')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={X}
            onClick={() => updateOrderStatus(order.id, 'cancelled')}
            className="bg-red-500 hover:bg-red-600 text-white rounded-full px-3 py-1 text-xs"
            disabled={submitting === order.id}
            aria-label={isRtl ? `إلغاء طلب رقم ${order.orderNumber}` : `Cancel order #${order.orderNumber}`}
          >
            {submitting === order.id ? (isRtl ? 'جارٍ...' : 'Loading...') : (isRtl ? 'إلغاء' : 'Cancel')}
          </Button>
        </>
      )}
      {user?.role === 'production' && order.status === 'approved' && unassignedItems.length > 0 && (
        <Button
          variant="primary"
          size="sm"
          icon={Package}
          onClick={() => openAssignModal(order)}
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-3 py-1 text-xs"
          disabled={submitting === order.id}
          aria-label={isRtl ? `تعيين طلب رقم ${order.orderNumber}` : `Assign order #${order.orderNumber}`}
        >
          {submitting === order.id ? (isRtl ? 'جارٍ...' : 'Loading...') : (isRtl ? 'توزيع' : 'Assign')}
        </Button>
      )}
      {user?.role === 'production' && order.status === 'completed' && (
        <Button
          variant="primary"
          size="sm"
          icon={Package}
          onClick={() => updateOrderStatus(order.id, 'in_transit')}
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-3 py-1 text-xs"
          disabled={submitting === order.id}
          aria-label={isRtl ? `شحن طلب رقم ${order.orderNumber}` : `Ship order #${order.orderNumber}`}
        >
          {submitting === order.id ? (isRtl ? 'جارٍ...' : 'Loading...') : (isRtl ? 'شحن' : 'Ship')}
        </Button>
      )}
    </div>
  );
};

export default OrderActions;