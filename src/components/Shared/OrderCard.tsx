import React, { useState, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../UI/Button';
import { useAuth } from '../../contexts/AuthContext';
import { Order, OrderStatus, ItemStatus } from '../../types';
import { Clock, Check, Package, Truck, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

const STATUS_COLORS: Record<OrderStatus, { color: string; icon: React.FC; label: string; progress: number }> = {
  pending: { color: 'bg-yellow-100 text-yellow-700', icon: Clock, label: 'pending', progress: 0 },
  approved: { color: 'bg-teal-100 text-teal-700', icon: Check, label: 'approved', progress: 25 },
  in_production: { color: 'bg-purple-100 text-purple-700', icon: Package, label: 'in_production', progress: 50 },
  completed: { color: 'bg-green-100 text-green-700', icon: Check, label: 'completed', progress: 75 },
  in_transit: { color: 'bg-blue-100 text-blue-700', icon: Truck, label: 'in_transit', progress: 90 },
  delivered: { color: 'bg-gray-100 text-gray-700', icon: Check, label: 'delivered', progress: 100 },
  cancelled: { color: 'bg-red-100 text-red-700', icon: AlertCircle, label: 'cancelled', progress: 0 },
};

const ITEM_STATUS_COLORS: Record<ItemStatus, { label: string; color: string; icon: React.FC }> = {
  pending: { label: 'pending', color: 'bg-gray-50 text-gray-600', icon: Clock },
  assigned: { label: 'assigned', color: 'bg-blue-50 text-blue-600', icon: Check },
  in_progress: { label: 'in_progress', color: 'bg-yellow-50 text-yellow-600', icon: Package },
  completed: { label: 'completed', color: 'bg-green-50 text-green-600', icon: Check },
};

const PRIORITY_COLORS: Record<Order['priority'], string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600',
};

interface OrderCardProps {
  order: Order;
  updateOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
  openAssignModal: (order: Order) => void;
  calculateAdjustedTotal: (order: Order) => string;
  calculateTotalQuantity: (order: Order) => number;
  submitting: string | null;
  t: (key: string, params?: any) => string;
  isRtl: boolean;
}

const OrderCard: React.FC<OrderCardProps> = memo(
  ({ order, updateOrderStatus, openAssignModal, calculateAdjustedTotal, calculateTotalQuantity, submitting, t, isRtl }) => {
    const { user } = useAuth();
    const [isItemsExpanded, setIsItemsExpanded] = useState(false);
    const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS.pending;
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
        <div className="p-2 bg-white shadow-sm rounded-md border border-gray-100 hover:shadow-md transition-shadow">
          <div className="space-y-2">
            <div className={`flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div className="flex items-center gap-2">
                <h3 id={`order-${order.id}`} className="text-xs font-semibold text-gray-800 truncate">
                  {t('orders.order', { orderNumber: order.orderNumber }) || (isRtl ? `طلب رقم ${order.orderNumber}` : `Order ${order.orderNumber}`)}
                </h3>
                {order.priority !== 'medium' && (
                  <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[order.priority]}`}>
                    {t(`orders.priority_${order.priority}`) || (isRtl
                      ? {
                          urgent: 'عاجل',
                          high: 'مرتفع',
                          medium: 'متوسط',
                          low: 'منخفض',
                        }[order.priority]
                      : order.priority)}
                  </span>
                )}
              </div>
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${statusInfo.color} ${isRtl ? 'flex-row-reverse' : ''}`}>
                <StatusIcon className="w-3 h-3" />
                {t(`orders.status_${statusInfo.label}`) || (isRtl
                  ? {
                      pending: 'قيد الانتظار',
                      approved: 'تم الموافقة',
                      in_production: 'في الإنتاج',
                      completed: 'مكتمل',
                      in_transit: 'في النقل',
                      delivered: 'تم التسليم',
                      cancelled: 'ملغى',
                    }[order.status]
                  : statusInfo.label)}
              </span>
            </div>
            {unassignedItems.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-1.5 bg-yellow-50 border border-yellow-100 rounded-md flex items-center gap-1.5 text-xs text-yellow-600"
                role="alert"
              >
                <AlertCircle className="w-3 h-3" />
                <span>{t('orders.unassigned_items', { count: unassignedItems.length }) || (isRtl ? `${unassignedItems.length} عناصر غير معينة` : `${unassignedItems.length} unassigned items`)}</span>
              </motion.div>
            )}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-gray-500 truncate">{t('orders.items_count') || (isRtl ? 'عدد العناصر' : 'Items Count')}</p>
                <p className="font-medium text-gray-800">{calculateTotalQuantity(order)}</p>
              </div>
              <div>
                <p className="text-gray-500 truncate">{t('orders.total_amount') || (isRtl ? 'إجمالي المبلغ' : 'Total Amount')}</p>
                <p className="font-medium text-teal-600 truncate">{calculateAdjustedTotal(order)}</p>
              </div>
              <div>
                <p className="text-gray-500 truncate">{t('orders.date') || (isRtl ? 'التاريخ' : 'Date')}</p>
                <p className="font-medium text-gray-800 truncate">{order.date}</p>
              </div>
            </div>
            <button
              onClick={toggleItemsExpanded}
              className="flex items-center justify-between w-full p-1.5 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors text-xs"
              aria-expanded={isItemsExpanded}
              aria-controls={`items-${order.id}`}
            >
              <span className="font-medium text-gray-800 truncate">{t('orders.items') || (isRtl ? 'العناصر' : 'Items')}</span>
              {isItemsExpanded ? <ChevronUp className="w-3 h-3 text-gray-600" /> : <ChevronDown className="w-3 h-3 text-gray-600" />}
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
                  <div className="space-y-1.5 mt-1.5">
                    {order.items.map((item) => {
                      const itemStatusInfo = ITEM_STATUS_COLORS[item.status] || ITEM_STATUS_COLORS.pending;
                      const ItemStatusIcon = itemStatusInfo.icon;
                      const departmentName = t(`departments.${item.department?.name || 'unknown'}`) || (isRtl
                        ? {
                            bread: 'المخبوزات',
                            pastries: 'المعجنات',
                            cakes: 'الكعك',
                            unknown: 'غير معروف',
                          }[item.department?.name || 'unknown']
                        : item.department?.name || 'Unknown');
                      return (
                        <motion.div
                          key={item._id}
                          initial={{ opacity: 0, x: isRtl ? 10 : -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2 }}
                          className="p-1.5 bg-gray-50 rounded-md text-xs"
                        >
                          <div className="flex justify-between gap-2">
                            <div>
                              <p className="font-medium text-gray-800 truncate">{item.productName}</p>
                              <p className="text-gray-600 truncate">
                                {`${item.quantity} ${t(`units.${item.unit || 'unit'}`) || (isRtl ? { unit: 'وحدة', kg: 'كجم', piece: 'قطعة' }[item.unit || 'unit'] : item.unit || 'unit')}`}
                              </p>
                              <p className="text-gray-600 truncate">{departmentName}</p>
                              <p className={`flex items-center gap-1 ${itemStatusInfo.color} ${isRtl ? 'flex-row-reverse' : ''}`}>
                                <ItemStatusIcon className="w-3 h-3" />
                                {t(`orders.item_${item.status}`) || (isRtl
                                  ? {
                                      pending: 'قيد الانتظار',
                                      assigned: 'معين',
                                      in_progress: 'قيد التنفيذ',
                                      completed: 'مكتمل',
                                    }[item.status]
                                  : itemStatusInfo.label)}
                              </p>
                              {item.assignedTo && (
                                <p className="text-gray-600 truncate">
                                  {t('orders.assigned_to', { name: item.assignedTo.name, department: departmentName }) || (isRtl
                                    ? `معين إلى: ${item.assignedTo.name || 'غير معروف'} (${departmentName})`
                                    : `Assigned to: ${item.assignedTo.name || 'Unknown'} (${departmentName})`)}
                                </p>
                              )}
                            </div>
                            <p className="font-medium text-gray-800 truncate">
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
              <div className="p-1.5 bg-amber-50 rounded-md text-xs">
                <p className="text-amber-800 truncate">
                  <strong>{t('orders.notes') || (isRtl ? 'ملاحظات' : 'Notes')}:</strong> {order.notes}
                </p>
              </div>
            )}
            {order.returns?.length > 0 && (
              <div className="p-1.5 bg-amber-50 rounded-md text-xs">
                <p className="font-medium text-amber-800">{t('orders.returns') || (isRtl ? 'الإرجاعات' : 'Returns')}</p>
                {order.returns.map((r, i) => (
                  <p key={r.returnId} className="text-amber-700 truncate">
                    {r.items
                      .map((item) =>
                        t('orders.return_item', {
                          quantity: item.quantity,
                          unit: t(`units.${item.unit || 'unit'}`),
                          reason: item.reason,
                        }) || (isRtl
                          ? `${item.quantity} ${{
                              unit: 'وحدة',
                              kg: 'كجم',
                              piece: 'قطعة',
                            }[item.unit || 'unit']} ${item.reason}`
                          : `${item.quantity} ${item.unit || 'unit'} ${item.reason}`)
                      )
                      .join(', ')}{' '}
                    -{' '}
                    {t(`orders.return_status_${r.status}`) || (isRtl
                      ? {
                          pending_approval: 'قيد الموافقة',
                          approved: 'تم الموافقة',
                          rejected: 'مرفوض',
                        }[r.status]
                      : r.status)}
                  </p>
                ))}
              </div>
            )}
            <div className={`flex gap-1 flex-wrap ${isRtl ? 'justify-end' : 'justify-start'}`}>
              <Link to={`/orders/${order.id}`}>
                <Button
                  variant="primary"
                  size="xs"
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1 text-xs"
                  aria-label={t('orders.view_order', { orderNumber: order.orderNumber }) || (isRtl ? `عرض الطلب ${order.orderNumber}` : `View order ${order.orderNumber}`)}
                >
                  {t('common.view') || (isRtl ? 'عرض' : 'View')}
                </Button>
              </Link>
              {user?.role === 'production' && order.status === 'pending' && (
                <>
                  <Button
                    variant="success"
                    size="xs"
                    onClick={() => updateOrderStatus(order.id, 'approved')}
                    className="bg-green-500 hover:bg-green-600 text-white rounded-md px-2 py-1 text-xs"
                    disabled={submitting === order.id}
                    aria-label={t('orders.approve_order', { orderNumber: order.orderNumber }) || (isRtl ? `الموافقة على الطلب ${order.orderNumber}` : `Approve order ${order.orderNumber}`)}
                  >
                    {submitting === order.id ? (t('common.loading') || (isRtl ? 'جارٍ التحميل' : 'Loading')) : t('orders.approve') || (isRtl ? 'موافقة' : 'Approve')}
                  </Button>
                  <Button
                    variant="danger"
                    size="xs"
                    onClick={() => updateOrderStatus(order.id, 'cancelled')}
                    className="bg-red-500 hover:bg-red-600 text-white rounded-md px-2 py-1 text-xs"
                    disabled={submitting === order.id}
                    aria-label={t('orders.cancel_order', { orderNumber: order.orderNumber }) || (isRtl ? `إلغاء الطلب ${order.orderNumber}` : `Cancel order ${order.orderNumber}`)}
                  >
                    {submitting === order.id ? (t('common.loading') || (isRtl ? 'جارٍ التحميل' : 'Loading')) : t('orders.cancel') || (isRtl ? 'إلغاء' : 'Cancel')}
                  </Button>
                </>
              )}
              {user?.role === 'production' && order.status === 'approved' && unassignedItems.length > 0 && (
                <Button
                  variant="primary"
                  size="xs"
                  onClick={() => openAssignModal(order)}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1 text-xs"
                  disabled={submitting === order.id}
                  aria-label={t('orders.assign_order', { orderNumber: order.orderNumber }) || (isRtl ? `تعيين الطلب ${order.orderNumber}` : `Assign order ${order.orderNumber}`)}
                >
                  {submitting === order.id ? (t('common.loading') || (isRtl ? 'جارٍ التحميل' : 'Loading')) : t('orders.assign') || (isRtl ? 'تعيين' : 'Assign')}
                </Button>
              )}
              {user?.role === 'production' && order.status === 'completed' && (
                <Button
                  variant="primary"
                  size="xs"
                  onClick={() => updateOrderStatus(order.id, 'in_transit')}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1 text-xs"
                  disabled={submitting === order.id}
                  aria-label={t('orders.ship_order', { orderNumber: order.orderNumber }) || (isRtl ? `شحن الطلب ${order.orderNumber}` : `Ship order ${order.orderNumber}`)}
                >
                  {submitting === order.id ? (t('common.loading') || (isRtl ? 'جارٍ التحميل' : 'Loading')) : t('orders.ship') || (isRtl ? 'شحن' : 'Ship')}
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