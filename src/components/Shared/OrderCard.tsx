import React, { useState, useCallback, memo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../UI/Button';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Check, Package, Truck, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Order, OrderStatus, ItemStatus } from '../../types/types';

const STATUS_COLORS: Record<OrderStatus, { color: string; icon: React.FC; label: string; progress: number }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'pending', progress: 0 },
  approved: { color: 'bg-teal-100 text-teal-800', icon: Check, label: 'approved', progress: 25 },
  in_production: { color: 'bg-purple-100 text-purple-800', icon: Package, label: 'in_production', progress: 50 },
  completed: { color: 'bg-green-100 text-green-800', icon: Check, label: 'completed', progress: 75 },
  in_transit: { color: 'bg-blue-100 text-blue-800', icon: Truck, label: 'in_transit', progress: 90 },
  delivered: { color: 'bg-gray-100 text-gray-800', icon: Check, label: 'delivered', progress: 100 },
  cancelled: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: 'cancelled', progress: 0 },
};

const ITEM_STATUS_COLORS: Record<ItemStatus, { label: string; color: string; icon: React.FC }> = {
  pending: { label: 'pending', color: 'bg-gray-50 text-gray-600', icon: Clock },
  assigned: { label: 'assigned', color: 'bg-blue-50 text-blue-600', icon: Check },
  in_progress: { label: 'in_progress', color: 'bg-yellow-50 text-yellow-600', icon: Package },
  completed: { label: 'completed', color: 'bg-green-50 text-green-600', icon: Check },
  cancelled: { label: 'cancelled', color: 'bg-red-50 text-red-600', icon: AlertCircle },
};

const PRIORITY_COLORS: Record<Order['priority'], string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

interface OrderCardProps {
  order: Order;
  updateOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
  openAssignModal: (order: Order) => void;
  calculateAdjustedTotal: (order: Order) => string;
  calculateTotalQuantity: (order: Order) => number;
  translateUnit: (unit: string, isRtl: boolean) => string;
  submitting: string | null;
  isRtl: boolean;
}

const OrderCard: React.FC<OrderCardProps> = memo(
  ({ order, updateOrderStatus, openAssignModal, calculateAdjustedTotal, calculateTotalQuantity, translateUnit, submitting, isRtl }) => {
    const { user } = useAuth();
    const [isItemsExpanded, setIsItemsExpanded] = useState(false);
    const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS.pending;
    const StatusIcon = statusInfo.icon;
    const unassignedItems = order.items.filter((item) => !item.assignedTo);

    const toggleItemsExpanded = useCallback(() => {
      setIsItemsExpanded((prev) => !prev);
    }, []);

    const statusTranslations = {
      pending: isRtl ? 'قيد الانتظار' : 'Pending',
      approved: isRtl ? 'تم الموافقة' : 'Approved',
      in_production: isRtl ? 'في الإنتاج' : 'In Production',
      completed: isRtl ? 'مكتمل' : 'Completed',
      in_transit: isRtl ? 'في النقل' : 'In Transit',
      delivered: isRtl ? 'تم التسليم' : 'Delivered',
      cancelled: isRtl ? 'ملغى' : 'Cancelled',
    };

    const itemStatusTranslations = {
      pending: isRtl ? 'قيد الانتظار' : 'Pending',
      assigned: isRtl ? 'معين' : 'Assigned',
      in_progress: isRtl ? 'قيد التنفيذ' : 'In Progress',
      completed: isRtl ? 'مكتمل' : 'Completed',
      cancelled: isRtl ? 'ملغى' : 'Cancelled',
    };

    const priorityTranslations = {
      low: isRtl ? 'منخفض' : 'Low',
      medium: isRtl ? 'متوسط' : 'Medium',
      high: isRtl ? 'عالي' : 'High',
      urgent: isRtl ? 'عاجل' : 'Urgent',
    };

    const validTransitions = {
      pending: [OrderStatus.Approved, OrderStatus.Cancelled],
      approved: [OrderStatus.InProduction, OrderStatus.Cancelled],
      in_production: [OrderStatus.Completed, OrderStatus.Cancelled],
      completed: [OrderStatus.InTransit],
      in_transit: [OrderStatus.Delivered],
      delivered: [],
      cancelled: [],
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`bg-white rounded-lg shadow-md p-4 flex flex-col gap-3 ${isRtl ? 'text-right' : 'text-left'}`}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <StatusIcon className="w-5 h-5" />
            <span className={`text-sm font-medium ${statusInfo.color} px-2 py-1 rounded`}>
              {statusTranslations[order.status]}
            </span>
          </div>
          <span className={`text-xs font-medium ${PRIORITY_COLORS[order.priority]} px-2 py-1 rounded`}>
            {priorityTranslations[order.priority]}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800">
            {isRtl ? 'طلب #' : 'Order #'}{order.orderNumber}
          </h3>
          <Link
            to={`/orders/${order.id}`}
            className="text-blue-600 hover:underline text-sm"
            aria-label={isRtl ? 'عرض تفاصيل الطلب' : 'View order details'}
          >
            {isRtl ? 'عرض التفاصيل' : 'View Details'}
          </Link>
        </div>

        <div className="text-sm text-gray-600">
          <p>{isRtl ? 'الفرع: ' : 'Branch: '}{order.branch.displayName}</p>
          <p>{isRtl ? 'التاريخ: ' : 'Date: '}{order.date}</p>
          <p>{isRtl ? 'إجمالي المبلغ: ' : 'Total Amount: '}{calculateAdjustedTotal(order)}</p>
          <p>{isRtl ? 'الكمية الإجمالية: ' : 'Total Quantity: '}{calculateTotalQuantity(order)} {isRtl ? 'وحدة' : 'units'}</p>
          {order.displayNotes && (
            <p>{isRtl ? 'الملاحظات: ' : 'Notes: '}{order.displayNotes}</p>
          )}
        </div>

        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={toggleItemsExpanded}
            className="flex items-center gap-2 text-sm"
            aria-label={isRtl ? isItemsExpanded ? 'إخفاء العناصر' : 'عرض العناصر' : isItemsExpanded ? 'Hide items' : 'Show items'}
          >
            {isItemsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {isRtl ? (isItemsExpanded ? 'إخفاء العناصر' : 'عرض العناصر') : (isItemsExpanded ? 'Hide Items' : 'Show Items')}
          </Button>
          {unassignedItems.length > 0 && user?.role === 'production' && (
            <Button
              variant="primary"
              onClick={() => openAssignModal(order)}
              disabled={submitting === order.id}
              className="text-sm"
              aria-label={isRtl ? 'تعيين شيفات' : 'Assign Chefs'}
            >
              {isRtl ? 'تعيين شيفات' : 'Assign Chefs'}
            </Button>
          )}
        </div>

        <AnimatePresence>
          {isItemsExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-2 border-t pt-2">
                <h4 className="text-sm font-medium text-gray-700 mb-2">{isRtl ? 'العناصر' : 'Items'}</h4>
                {order.items.map((item) => {
                  const itemStatus = ITEM_STATUS_COLORS[item.status] || ITEM_STATUS_COLORS.pending;
                  const ItemStatusIcon = itemStatus.icon;
                  return (
                    <div key={item._id} className="flex justify-between items-center py-1 text-sm">
                      <div>
                        <p>{item.displayProductName} ({item.quantity} {item.displayUnit})</p>
                        {item.assignedTo && (
                          <p className="text-xs text-gray-500">
                            {isRtl ? 'معين إلى: ' : 'Assigned to: '}{item.assignedTo.displayName}
                          </p>
                        )}
                      </div>
                      <span className={`text-xs ${itemStatus.color} px-2 py-1 rounded flex items-center gap-1`}>
                        <ItemStatusIcon className="w-4 h-4" />
                        {itemStatusTranslations[item.status]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {user?.role === 'admin' && validTransitions[order.status].length > 0 && (
          <div className="flex gap-2 mt-2">
            {validTransitions[order.status].map((status) => (
              <Button
                key={status}
                variant="outline"
                onClick={() => updateOrderStatus(order.id, status)}
                disabled={submitting === order.id}
                className="text-sm"
                aria-label={isRtl ? `تغيير الحالة إلى ${statusTranslations[status]}` : `Change status to ${statusTranslations[status]}`}
              >
                {statusTranslations[status]}
              </Button>
            ))}
          </div>
        )}
      </motion.div>
    );
  }
);

export default OrderCard;
