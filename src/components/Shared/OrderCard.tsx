import React, { memo, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Order, OrderStatus, ItemStatus } from '../../types/types';
import { Button } from '../UI/Button';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Check, Package, Truck, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

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
};

// ترجمات ثابتة
const translations = {
  ar: {
    order: 'طلب #{orderNumber}',
    total_quantity: 'الكمية الإجمالية',
    total_amount: 'إجمالي المبلغ',
    date: 'التاريخ',
    products: 'المنتجات',
    notes: 'ملاحظات:',
    returns: 'الإرجاعات',
    view: 'عرض',
    approve: 'موافقة',
    cancel: 'إلغاء',
    assign: 'توزيع',
    ship: 'شحن',
    loading: 'جارٍ التحميل',
    unassigned_items: '{count} عناصر غير معينة',
    statuses: {
      pending: 'قيد الانتظار',
      approved: 'تم الموافقة',
      in_production: 'في الإنتاج',
      completed: 'مكتمل',
      in_transit: 'في النقل',
      delivered: 'تم التسليم',
      cancelled: 'ملغى',
    },
    item_statuses: {
      pending: 'قيد الانتظار',
      assigned: 'معين',
      in_progress: 'قيد التقدم',
      completed: 'مكتمل',
    },
    priorities: {
      low: 'منخفض',
      medium: 'متوسط',
      high: 'مرتفع',
      urgent: 'عاجل',
    },
    assigned_to: 'معين إلى: {name} - {department}',
    view_order: 'عرض طلب رقم {orderNumber}',
    approve_order: 'الموافقة على طلب رقم {orderNumber}',
    cancel_order: 'إلغاء طلب رقم {orderNumber}',
    assign_order: 'تعيين طلب رقم {orderNumber}',
    ship_order: 'شحن طلب رقم {orderNumber}',
    unknown: 'غير معروف',
  },
  en: {
    order: 'Order #{orderNumber}',
    total_quantity: 'Total Quantity',
    total_amount: 'Total Amount',
    date: 'Date',
    products: 'Products',
    notes: 'Notes:',
    returns: 'Returns',
    view: 'View',
    approve: 'Approve',
    cancel: 'Cancel',
    assign: 'Assign',
    ship: 'Ship',
    loading: 'Loading',
    unassigned_items: '{count} unassigned items',
    statuses: {
      pending: 'Pending',
      approved: 'Approved',
      in_production: 'In Production',
      completed: 'Completed',
      in_transit: 'In Transit',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
    },
    item_statuses: {
      pending: 'Pending',
      assigned: 'Assigned',
      in_progress: 'In Progress',
      completed: 'Completed',
    },
    priorities: {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      urgent: 'Urgent',
    },
    assigned_to: 'Assigned to: {name} - {department}',
    view_order: 'View order #{orderNumber}',
    approve_order: 'Approve order #{orderNumber}',
    cancel_order: 'Cancel order #{orderNumber}',
    assign_order: 'Assign order #{orderNumber}',
    ship_order: 'Ship order #{orderNumber}',
    unknown: 'Unknown',
  },
};

interface OrderCardProps {
  order: Order;
  updateOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
  onAssignChefs: (order: Order) => void;
  calculateAdjustedTotal: (order: Order) => string;
  calculateTotalQuantity: (order: Order) => number;
  translateUnit: (unit: string, isRtl: boolean) => string;
  submitting: string | null;
  isRtl: boolean;
}

const OrderCard: React.FC<OrderCardProps> = memo(
  ({ order, updateOrderStatus, onAssignChefs, calculateAdjustedTotal, calculateTotalQuantity, translateUnit, submitting, isRtl }) => {
    const { user } = useAuth();
    const [isItemsExpanded, setIsItemsExpanded] = useState(false);
    const t = translations[isRtl ? 'ar' : 'en'];
    const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS.pending;
    const StatusIcon = statusInfo.icon;
    const unassignedItems = order.items.filter((item) => !item.assignedTo);

    const toggleItemsExpanded = useCallback(() => {
      setIsItemsExpanded((prev) => !prev);
    }, []);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-4"
        role="region"
        aria-labelledby={`order-${order.id}`}
      >
        <div className="p-3 bg-white shadow-md rounded-lg border border-gray-200 hover:shadow-lg transition-shadow duration-300">
          <div className="flex flex-col gap-3">
            <div className={`flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div className="flex items-center gap-1">
                <h3 id={`order-${order.id}`} className="text-base font-semibold text-gray-800 truncate max-w-[220px]">
                  {t.order.replace('{orderNumber}', order.orderNumber || t.unknown)}
                </h3>
                {order.priority !== 'medium' && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status].color} ${
                      isRtl ? 'ml-1' : 'mr-1'
                    }`}
                  >
                    {t.priorities[order.priority]}
                  </span>
                )}
              </div>
              <span
                className={`px-1.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${statusInfo.color} ${
                  isRtl ? 'flex-row-reverse' : ''
                }`}
              >
                <StatusIcon className="w-3 h-3" />
                {t.statuses[statusInfo.label]}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-amber-600 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${statusInfo.progress}%` }}
              />
            </div>
            {unassignedItems.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-1.5 bg-yellow-50 border border-yellow-100 rounded-md flex items-center gap-1.5"
                role="alert"
              >
                <AlertCircle className="w-3 h-3 text-yellow-600" />
                <span className="text-xs text-yellow-600">
                  {t.unassigned_items.replace('{count}', unassignedItems.length.toString())}
                </span>
              </motion.div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-gray-500">{t.total_quantity}</p>
                <p className="text-xs font-medium text-gray-800">
                  {isRtl ? `${calculateTotalQuantity(order)} عنصر` : `${calculateTotalQuantity(order)} items`}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t.total_amount}</p>
                <p className="text-xs font-semibold text-teal-600">{calculateAdjustedTotal(order)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500">{t.date}</p>
                <p className="text-xs font-medium text-gray-800 truncate">{order.date}</p>
              </div>
            </div>
            <div>
              <button
                onClick={toggleItemsExpanded}
                className="flex items-center justify-between w-full p-2 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors duration-200"
                aria-expanded={isItemsExpanded}
                aria-controls={`items-${order.id}`}
              >
                <h4 className="text-sm font-semibold text-gray-900">{t.products}</h4>
                {isItemsExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-600" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-600" />
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
                    <div className="space-y-2 mt-2">
                      {order.items.map((item) => {
                        const itemStatusInfo = ITEM_STATUS_COLORS[item.status] || ITEM_STATUS_COLORS.pending;
                        const ItemStatusIcon = itemStatusInfo.icon;
                        return (
                          <motion.div
                            key={item._id}
                            initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2 }}
                            className="p-2 bg-gray-50 rounded-md"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-medium text-gray-900 truncate flex-1">
                                {item.productName} ({item.quantity} {translateUnit(item.unit, isRtl)})
                              </p>
                              <span
                                className={`px-1.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${itemStatusInfo.color} ${
                                  isRtl ? 'flex-row-reverse' : ''
                                }`}
                              >
                                <ItemStatusIcon className="w-3 h-3" />
                                {t.item_statuses[itemStatusInfo.label]}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {item.assignedTo && (
                                <p className="text-xs text-gray-600 truncate">
                                  {t.assigned_to
                                    .replace('{name}', item.assignedTo.name || t.unknown)
                                    .replace('{department}', item.department?.name || t.unknown)}
                                </p>
                              )}
                              <p className="text-xs font-medium text-gray-900">{item.price.toLocaleString(isRtl ? 'ar-SA' : 'en-US', {
                                style: 'currency',
                                currency: 'SAR',
                              })}</p>
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
              <div className="mt-1 p-1.5 bg-amber-50 rounded-md">
                <p className="text-xs text-amber-800 truncate">
                  <strong>{t.notes}</strong> {order.notes}
                </p>
              </div>
            )}
            {order.returns?.length > 0 && (
              <div className="mt-1 p-1.5 bg-amber-50 rounded-md">
                <p className="text-xs font-medium text-amber-800">{t.returns}</p>
                {order.returns.map((r, i) => (
                  <p key={i} className="text-xs text-amber-700 truncate">
                    {isRtl
                      ? `${r.items
                          .map((item) => `${item.quantity} ${translateUnit(item.unit, isRtl)} ${item.reason}`)
                          .join(', ')} - الحالة: ${
                          t.statuses[r.status] || r.status
                        }`
                      : `${r.items
                          .map((item) => `${item.quantity} ${translateUnit(item.unit, isRtl)} ${item.reason}`)
                          .join(', ')} - Status: ${t.statuses[r.status] || r.status}`}
                  </p>
                ))}
              </div>
            )}
            <div className={`flex flex-wrap gap-1.5 ${isRtl ? 'justify-end' : 'justify-start'}`}>
              <Link to={`/orders/${order.id}`}>
                <Button
                  variant="primary"
                  size="sm"
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-2.5 py-1 text-xs"
                  aria-label={t.view_order.replace('{orderNumber}', order.orderNumber)}
                >
                  {t.view}
                </Button>
              </Link>
              {user?.role === 'production' && order.status === 'pending' && (
                <>
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => updateOrderStatus(order.id, 'approved')}
                    className="bg-green-500 hover:bg-green-600 text-white rounded-full px-2.5 py-1 text-xs"
                    disabled={submitting === order.id}
                    aria-label={t.approve_order.replace('{orderNumber}', order.orderNumber)}
                  >
                    {submitting === order.id ? t.loading : t.approve}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => updateOrderStatus(order.id, 'cancelled')}
                    className="bg-red-500 hover:bg-red-600 text-white rounded-full px-2.5 py-1 text-xs"
                    disabled={submitting === order.id}
                    aria-label={t.cancel_order.replace('{orderNumber}', order.orderNumber)}
                  >
                    {submitting === order.id ? t.loading : t.cancel}
                  </Button>
                </>
              )}
              {user?.role === 'production' && order.status === 'approved' && unassignedItems.length > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onAssignChefs(order)}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-2.5 py-1 text-xs"
                  disabled={submitting === order.id}
                  aria-label={t.assign_order.replace('{orderNumber}', order.orderNumber)}
                >
                  {submitting === order.id ? t.loading : t.assign}
                </Button>
              )}
              {user?.role === 'production' && order.status === 'completed' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => updateOrderStatus(order.id, 'in_transit')}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-2.5 py-1 text-xs"
                  disabled={submitting === order.id}
                  aria-label={t.ship_order.replace('{orderNumber}', order.orderNumber)}
                >
                  {submitting === order.id ? t.loading : t.ship}
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
