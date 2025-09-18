import React, { useState, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../UI/Button';
import { useAuth } from '../../contexts/AuthContext';
import { Order, OrderStatus, ItemStatus } from '../../types';
import { Clock, Check, Package, Truck, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

const STATUS_COLORS: Record<OrderStatus, { color: string; icon: React.FC; label: string; progress: number }> = {
  [OrderStatus.Pending]: { color: 'bg-yellow-100 text-yellow-700', icon: Clock, label: 'pending', progress: 0 },
  [OrderStatus.Approved]: { color: 'bg-teal-100 text-teal-700', icon: Check, label: 'approved', progress: 25 },
  [OrderStatus.InProduction]: { color: 'bg-purple-100 text-purple-700', icon: Package, label: 'in_production', progress: 50 },
  [OrderStatus.Completed]: { color: 'bg-green-100 text-green-700', icon: Check, label: 'completed', progress: 75 },
  [OrderStatus.InTransit]: { color: 'bg-blue-100 text-blue-700', icon: Truck, label: 'in_transit', progress: 90 },
  [OrderStatus.Delivered]: { color: 'bg-gray-100 text-gray-700', icon: Check, label: 'delivered', progress: 100 },
  [OrderStatus.Cancelled]: { color: 'bg-red-100 text-red-700', icon: AlertCircle, label: 'cancelled', progress: 0 },
};

const ITEM_STATUS_COLORS: Record<ItemStatus, { label: string; color: string; icon: React.FC }> = {
  [ItemStatus.Pending]: { label: 'item_pending', color: 'bg-gray-50 text-gray-600', icon: Clock },
  [ItemStatus.Assigned]: { label: 'item_assigned', color: 'bg-blue-50 text-blue-600', icon: Check },
  [ItemStatus.InProgress]: { label: 'item_in_progress', color: 'bg-yellow-50 text-yellow-600', icon: Package },
  [ItemStatus.Completed]: { label: 'item_completed', color: 'bg-green-50 text-green-600', icon: Check },
};

const PRIORITY_COLORS: Record<Order['priority'], string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600',
};

const departmentLabels: Record<string, string> = {
  bread: 'departments.bread',
  pastries: 'departments.pastries',
  cakes: 'departments.cakes',
  unknown: 'departments.unknown',
};

interface OrderCardProps {
  order: Order;
  updateOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
  openAssignModal: (order: Order) => void;
  calculateAdjustedTotal: (order: Order) => string;
  submitting: string | null;
  t: (key: string, params?: any) => string;
  isRtl: boolean;
}

const OrderCard: React.FC<OrderCardProps> = memo(
  ({ order, updateOrderStatus, openAssignModal, calculateAdjustedTotal, submitting, t, isRtl }) => {
    const { user } = useAuth();
    const [isItemsExpanded, setIsItemsExpanded] = useState(false);
    const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS[OrderStatus.Pending];
    const StatusIcon = statusInfo.icon;
    const unassignedItems = order.items.filter((item) => !item.assignedTo);

    const toggleItemsExpanded = useCallback(() => {
      setIsItemsExpanded((prev) => !prev);
    }, []);

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-3"
        role="region"
        aria-labelledby={`order-${order.id}`}
      >
        <div className="p-3 bg-white shadow-sm rounded-md border border-gray-200 hover:shadow-md transition-shadow">
          <div className="space-y-3">
            <div className={`flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div className="flex items-center gap-2">
                <h3 id={`order-${order.id}`} className="text-sm font-semibold text-gray-800">
                  {t('orders.order_number', { number: order.orderNumber })}
                </h3>
                {order.priority !== 'medium' && (
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${PRIORITY_COLORS[order.priority]}`}>
                    {t(`orders.priority_${order.priority}`)}
                  </span>
                )}
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusInfo.color} ${isRtl ? 'flex-row-reverse' : ''}`}>
                <StatusIcon className="w-4 h-4" />
                {t(`orders.status_${statusInfo.label}`)}
              </span>
            </div>
            {unassignedItems.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-2 bg-yellow-50 border border-yellow-100 rounded-md flex items-center gap-2 text-xs text-yellow-600"
                role="alert"
              >
                <AlertCircle className="w-4 h-4" />
                <span>{t('orders.unassigned_items', { count: unassignedItems.length })}</span>
              </motion.div>
            )}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-gray-500">{t('orders.items_count')}</p>
                <p className="font-medium text-gray-800">{order.items.length}</p>
              </div>
              <div>
                <p className="text-gray-500">{t('orders.total_amount')}</p>
                <p className="font-medium text-teal-600">{calculateAdjustedTotal(order)}</p>
              </div>
              <div>
                <p className="text-gray-500">{t('orders.date')}</p>
                <p className="font-medium text-gray-800">{order.date}</p>
              </div>
            </div>
            <button
              onClick={toggleItemsExpanded}
              className="flex items-center justify-between w-full p-2 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors text-sm"
              aria-expanded={isItemsExpanded}
              aria-controls={`items-${order.id}`}
            >
              <span className="font-medium text-gray-800">{t('orders.items')}</span>
              {isItemsExpanded ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
            </button>
            <AnimatePresence>
              {isItemsExpanded && (
                <motion.div
                  id={`items-${order.id}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 mt-2">
                    {order.items.map((item) => {
                      const itemStatusInfo = ITEM_STATUS_COLORS[item.status] || ITEM_STATUS_COLORS[ItemStatus.Pending];
                      const ItemStatusIcon = itemStatusInfo.icon;
                      return (
                        <motion.div
                          key={item._id}
                          initial={{ opacity: 0, x: isRtl ? 10 : -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2 }}
                          className="p-2 bg-gray-50 rounded-md text-xs"
                        >
                          <div className="flex justify-between gap-2">
                            <div>
                              <p className="font-medium text-gray-800">{item.productName}</p>
                              <p className="text-gray-600">{item.quantity} {t(`units.${item.unit || 'unit'}`)}</p>
                              <p className="text-gray-600">{t(departmentLabels[item.department?.name || 'unknown'])}</p>
                              <p className={`flex items-center gap-1 ${itemStatusInfo.color} ${isRtl ? 'flex-row-reverse' : ''}`}>
                                <ItemStatusIcon className="w-4 h-4" />
                                {t(`orders.${itemStatusInfo.label}`)}
                              </p>
                              {item.assignedTo && (
                                <p className="text-gray-600">{t('orders.assigned_to', { name: item.assignedTo.name })}</p>
                              )}
                            </div>
                            <p className="font-medium text-gray-800">
                              {item.price.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {order.notes && (
              <div className="p-2 bg-amber-50 rounded-md text-xs">
                <p className="text-amber-800"><strong>{t('orders.notes_label')}:</strong> {order.notes}</p>
              </div>
            )}
            {order.returns?.length > 0 && (
              <div className="p-2 bg-amber-50 rounded-md text-xs">
                <p className="font-medium text-amber-800">{t('orders.returns')}</p>
                {order.returns.map((r, i) => (
                  <p key={i} className="text-amber-700">
                    {r.items.map((item) => `${item.quantity} ${t(`units.${item.unit || 'unit'}`)} ${item.reason}`).join(', ')} - {t(`orders.return_status_${r.status}`)}
                  </p>
                ))}
              </div>
            )}
            <div className={`flex gap-1 flex-wrap ${isRtl ? 'justify-end' : 'justify-start'}`}>
              <Link to={`/orders/${order.id}`}>
                <Button
                  variant="primary"
                  size="xs"
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1"
                  aria-label={t('orders.view_order', { orderNumber: order.orderNumber })}
                >
                  {t('orders.view')}
                </Button>
              </Link>
              {user?.role === 'production' && order.status === OrderStatus.Pending && (
                <>
                  <Button
                    variant="success"
                    size="xs"
                    onClick={() => updateOrderStatus(order.id, OrderStatus.Approved)}
                    className="bg-green-500 hover:bg-green-600 text-white rounded-md px-2 py-1"
                    disabled={submitting === order.id}
                    aria-label={t('orders.approve_order', { orderNumber: order.orderNumber })}
                  >
                    {submitting === order.id ? t('common.loading') : t('orders.approve')}
                  </Button>
                  <Button
                    variant="danger"
                    size="xs"
                    onClick={() => updateOrderStatus(order.id, OrderStatus.Cancelled)}
                    className="bg-red-500 hover:bg-red-600 text-white rounded-md px-2 py-1"
                    disabled={submitting === order.id}
                    aria-label={t('orders.cancel_order', { orderNumber: order.orderNumber })}
                  >
                    {submitting === order.id ? t('common.loading') : t('orders.cancel')}
                  </Button>
                </>
              )}
              {user?.role === 'production' && order.status === OrderStatus.Approved && unassignedItems.length > 0 && (
                <Button
                  variant="primary"
                  size="xs"
                  onClick={() => openAssignModal(order)}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1"
                  disabled={submitting === order.id}
                  aria-label={t('orders.assign_order', { orderNumber: order.orderNumber })}
                >
                  {submitting === order.id ? t('common.loading') : t('orders.assign')}
                </Button>
              )}
              {user?.role === 'production' && order.status === OrderStatus.Completed && (
                <Button
                  variant="primary"
                  size="xs"
                  onClick={() => updateOrderStatus(order.id, OrderStatus.InTransit)}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1"
                  disabled={submitting === order.id}
                  aria-label={t('orders.ship_order', { orderNumber: order.orderNumber })}
                >
                  {submitting === order.id ? t('common.loading') : t('orders.ship')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }
);

export default OrderCard;