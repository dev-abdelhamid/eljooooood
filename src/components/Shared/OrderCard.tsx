import React, { useState, memo } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { Order } from '../../types/types';
import { Button } from '../UI/Button';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Check, Package, Truck, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

const STATUS_COLORS = {
  pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'pending', progress: 0 },
  approved: { color: 'bg-teal-100 text-teal-800', icon: Check, label: 'approved', progress: 25 },
  in_production: { color: 'bg-purple-100 text-purple-800', icon: Package, label: 'in_production', progress: 50 },
  completed: { color: 'bg-green-100 text-green-800', icon: Check, label: 'completed', progress: 75 },
  in_transit: { color: 'bg-blue-100 text-blue-800', icon: Truck, label: 'in_transit', progress: 90 },
  delivered: { color: 'bg-gray-100 text-gray-800', icon: Check, label: 'delivered', progress: 100 },
  cancelled: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: 'cancelled', progress: 0 },
};

const departmentLabels: Record<string, string> = {
  bread: 'departments.bread',
  pastries: 'departments.pastries',
  cakes: 'departments.cakes',
  unknown: 'departments.unknown',
};

const getItemStatusInfo = (status: Order['items'][0]['status']) => {
  const statusMap: Record<Order['items'][0]['status'], { label: string; color: string; icon: React.FC }> = {
    pending: { label: 'item_pending', color: 'bg-gray-50 text-gray-600', icon: Clock },
    assigned: { label: 'item_assigned', color: 'bg-blue-50 text-blue-600', icon: Check },
    in_progress: { label: 'item_in_progress', color: 'bg-yellow-50 text-yellow-600', icon: Package },
    completed: { label: 'item_completed', color: 'bg-green-50 text-green-600', icon: Check },
  };
  return statusMap[status] || { label: status, color: 'bg-gray-50 text-gray-600', icon: Clock };
};

const priorityLabels: Record<Order['priority'], string> = {
  low: 'priority_low',
  medium: 'priority_medium',
  high: 'priority_high',
  urgent: 'priority_urgent',
};

const priorityColors: Record<Order['priority'], string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

interface OrderCardProps {
  order: Order;
  updateOrderStatus: (orderId: string, newStatus: Order['status']) => void;
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
    const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS.pending;
    const StatusIcon = statusInfo.icon;
    const unassignedItems = order.items.filter((item) => !item.assignedTo);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-4"
      >
        <div className="p-4 sm:p-5 bg-white shadow-md rounded-lg border border-gray-200 hover:shadow-lg transition-shadow duration-300">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-800">
                  {isRtl ? `الطلب #${order.orderNumber}` : `Order #${order.orderNumber}`}
                </h3>
                {order.priority !== 'medium' && (
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${priorityColors[order.priority]} ${
                      isRtl ? 'ml-2' : 'mr-2'
                    }`}
                  >
                    {t(priorityLabels[order.priority])}
                  </span>
                )}
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusInfo.color} ${isRtl ? 'flex-row-reverse' : ''}`}>
                <StatusIcon className="w-4 h-4" />
                {isRtl
                  ? order.status === 'pending'
                    ? 'معلق'
                    : order.status === 'approved'
                    ? 'معتمد'
                    : order.status === 'in_production'
                    ? 'قيد الإنتاج'
                    : order.status === 'completed'
                    ? 'مكتمل'
                    : order.status === 'in_transit'
                    ? 'في النقل'
                    : order.status === 'delivered'
                    ? 'تم التسليم'
                    : 'ملغى'
                  : t(`orders.status_${statusInfo.label}`)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-amber-600 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${statusInfo.progress}%` }}
              />
            </div>
            {unassignedItems.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-2 bg-yellow-50 border border-yellow-100 rounded-lg flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                <span className="text-sm text-yellow-600">
                  {t('orders.unassigned_items', { count: unassignedItems.length })}
                </span>
              </motion.div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-gray-500">{t('orders.items_count')}</p>
                <p className="text-sm font-medium text-gray-800">
                  {isRtl ? `${order.items.length} عنصر` : `${order.items.length} items`}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('orders.total_amount')}</p>
                <p className="text-sm font-semibold text-teal-600">{calculateAdjustedTotal(order)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('orders.date')}</p>
                <p className="text-sm font-medium text-gray-800">{order.date}</p>
              </div>
            </div>
            <div>
              <button
                onClick={() => setIsItemsExpanded(!isItemsExpanded)}
                className="flex items-center justify-between w-full p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200"
                aria-expanded={isItemsExpanded}
                aria-controls={`items-${order.id}`}
              >
                <h4 className="font-semibold text-gray-900">{t('orders.items')}</h4>
                {isItemsExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-600" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-600" />
                )}
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
                    <div className="space-y-3 mt-3">
                      {order.items.map((item) => {
                        const itemStatusInfo = getItemStatusInfo(item.status);
                        const ItemStatusIcon = itemStatusInfo.icon;
                        return (
                          <motion.div
                            key={item._id}
                            initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2 }}
                            className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-gray-50 rounded-lg gap-3"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900">{item.productName}</p>
                                <span className="text-xs text-gray-600">
                                  ({item.quantity} {t(`${item.unit || 'unit'}`)})
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 mt-1">
                                {isRtl
                                  ? `القسم: ${t(departmentLabels[item.department.name] || item.department.name)}`
                                  : `Department: ${t(departmentLabels[item.department.name] || item.department.name)}`}
                              </p>
                              <p className={`text-xs ${itemStatusInfo.color} flex items-center gap-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                                <ItemStatusIcon className="w-4 h-4" />
                                {t('orders.item_status', { status: t(itemStatusInfo.label) })}
                              </p>
                              {item.assignedTo && (
                                <p className="text-xs text-gray-600 mt-1">
                                  {isRtl
                                    ? `تم تعيينه إلى: ${item.assignedTo.name}`
                                    : `Assigned to: ${item.assignedTo.name}`}
                                </p>
                              )}
                            </div>
                            <div className={isRtl ? 'text-right' : 'text-left'}>
                              <p className="text-sm font-medium text-gray-900">
                                {(typeof item.price === 'number' ? item.price : 0).toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })} {isRtl ? 'ريال' : 'SAR'}
                              </p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {order.notes && (
              <div className="mt-2 p-2 bg-amber-50 rounded-md">
                <p className="text-xs text-amber-800">
                  <strong>{t('orders.notes_label')}:</strong> {order.notes}
                </p>
              </div>
            )}
            {order.returns?.length > 0 && (
              <div className="mt-2 p-2 bg-amber-50 rounded-md">
                <p className="text-xs font-medium text-amber-800">{isRtl ? 'المرتجعات' : 'Returns'}:</p>
                {order.returns.map((r, i) => (
                  <p key={i} className="text-xs text-amber-700">
                    {isRtl
                      ? `إرجاع ${r.items
                          .map(item => `${item.quantity} ${t(`${item.unit || 'unit'}`)} ${item.reason}`)
                          .join(', ')} - الحالة: ${t(`orders.return_status_${r.status}`)}`
                      : `Return ${r.items
                          .map(item => `${item.quantity} ${t(`${item.unit || 'unit'}`)} ${item.reason}`)
                          .join(', ')} - Status: ${t(`orders.return_status_${r.status}`)}`}
                  </p>
                ))}
              </div>
            )}
            <div className={`flex flex-wrap gap-2 ${isRtl ? 'justify-end' : 'justify-start'}`}>
              <Link to={`/orders/${order.id}`}>
                <Button
                  variant="primary"
                  size="sm"
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-3 py-1 text-xs"
                  aria-label={t('orders.view_order', { orderNumber: order.orderNumber })}
                >
                  {t('orders.view')}
                </Button>
              </Link>
              {user?.role === 'production' && order.status === 'pending' && (
                <>
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => updateOrderStatus(order.id, 'approved')}
                    className="bg-green-500 hover:bg-green-600 text-white rounded-full px-3 py-1 text-xs"
                    disabled={submitting === order.id}
                    aria-label={t('orders.approve_order', { orderNumber: order.orderNumber })}
                  >
                    {submitting === order.id ? t('common.loading') : t('orders.approve')}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => updateOrderStatus(order.id, 'cancelled')}
                    className="bg-red-500 hover:bg-red-600 text-white rounded-full px-3 py-1 text-xs"
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
                  onClick={() => openAssignModal(order)}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-3 py-1 text-xs"
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
                  onClick={() => updateOrderStatus(order.id, 'in_transit')}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-3 py-1 text-xs"
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