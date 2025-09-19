import React, { useState, memo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Order, OrderStatus, ItemStatus } from '../../types';
import { Button } from '../UI/Button';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Check, Package, Truck, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

const STATUS_COLORS: Record<OrderStatus, { color: string; icon: React.FC; label: string; progress: number }> = {
  [OrderStatus.Pending]: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'pending', progress: 0 },
  [OrderStatus.Approved]: { color: 'bg-teal-100 text-teal-800', icon: Check, label: 'approved', progress: 25 },
  [OrderStatus.InProduction]: { color: 'bg-purple-100 text-purple-800', icon: Package, label: 'in_production', progress: 50 },
  [OrderStatus.Completed]: { color: 'bg-green-100 text-green-800', icon: Check, label: 'completed', progress: 75 },
  [OrderStatus.InTransit]: { color: 'bg-blue-100 text-blue-800', icon: Truck, label: 'in_transit', progress: 90 },
  [OrderStatus.Delivered]: { color: 'bg-gray-100 text-gray-800', icon: Check, label: 'delivered', progress: 100 },
  [OrderStatus.Cancelled]: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: 'cancelled', progress: 0 },
};

const ITEM_STATUS_COLORS: Record<ItemStatus, { label: string; color: string; icon: React.FC }> = {
  [ItemStatus.Pending]: { label: 'pending', color: 'bg-gray-50 text-gray-600', icon: Clock },
  [ItemStatus.Assigned]: { label: 'assigned', color: 'bg-blue-50 text-blue-600', icon: Check },
  [ItemStatus.InProgress]: { label: 'in_progress', color: 'bg-yellow-50 text-yellow-600', icon: Package },
  [ItemStatus.Completed]: { label: 'completed', color: 'bg-green-50 text-green-600', icon: Check },
  [ItemStatus.Cancelled]: { label: 'cancelled', color: 'bg-red-50 text-red-600', icon: AlertCircle },
};

const PRIORITY_COLORS: Record<Order['priority'], string> = {
  [Priority.Low]: 'bg-gray-100 text-gray-700',
  [Priority.Medium]: 'bg-blue-100 text-blue-700',
  [Priority.High]: 'bg-orange-100 text-orange-700',
  [Priority.Urgent]: 'bg-red-100 text-red-700',
};

interface OrderCardProps {
  order: Order;
  updateOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
  openAssignModal: (order: Order) => void;
  calculateAdjustedTotal: (order: Order) => string;
  calculateTotalQuantity: (order: Order) => number;
  submitting: string | null;
}

const OrderCard: React.FC<OrderCardProps> = memo(
  ({ order, updateOrderStatus, openAssignModal, calculateAdjustedTotal, calculateTotalQuantity, submitting }) => {
    const { user } = useAuth();
    const { t, language } = useLanguage();
    const isRtl = language === 'ar';
    const [isItemsExpanded, setIsItemsExpanded] = useState(false);
    const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS[OrderStatus.Pending];
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
        <div className="p-4 sm:p-5 bg-white shadow-md rounded-lg border border-gray-200 hover:shadow-lg transition-shadow duration-300">
          <div className="flex flex-col gap-4">
            <div className={`flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div className="flex items-center gap-2">
                <h3 id={`order-${order.id}`} className="text-lg font-semibold text-gray-800 truncate max-w-[200px]">
                  {t('orders.order_title', { orderNumber: order.orderNumber, defaultValue: isRtl ? `طلب رقم ${order.orderNumber}` : `Order #${order.orderNumber}` })}
                </h3>
                {order.priority !== Priority.Medium && (
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${PRIORITY_COLORS[order.priority]} ${isRtl ? 'ml-2' : 'mr-2'}`}
                  >
                    {t(`orders.priority_${order.priority}`, { defaultValue: translatePriority(order.priority).ar })}
                  </span>
                )}
              </div>
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusInfo.color} ${isRtl ? 'flex-row-reverse' : ''}`}
              >
                <StatusIcon className="w-4 h-4" />
                {t(`orders.status_${statusInfo.label}`, { defaultValue: translateStatus(statusInfo.label).ar })}
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
                role="alert"
              >
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                <span className="text-sm text-yellow-600">
                  {t('orders.unassigned_items', { count: unassignedItems.length, defaultValue: isRtl ? `${unassignedItems.length} عناصر غير معينة` : `${unassignedItems.length} unassigned items` })}
                </span>
              </motion.div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-gray-500">{t('orders.totalQuantity', { defaultValue: isRtl ? 'الكمية الإجمالية' : 'Total Quantity' })}</p>
                <p className="text-sm font-medium text-gray-800">
                  {t('orders.quantity_value', { count: calculateTotalQuantity(order), defaultValue: isRtl ? `${calculateTotalQuantity(order)} وحدة` : `${calculateTotalQuantity(order)} units` })}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('orders.totalAmount', { defaultValue: isRtl ? 'إجمالي المبلغ' : 'Total Amount' })}</p>
                <p className="text-sm font-semibold text-teal-600">{calculateAdjustedTotal(order)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('orders.date', { defaultValue: isRtl ? 'التاريخ' : 'Date' })}</p>
                <p className="text-sm font-medium text-gray-800 truncate">{order.date}</p>
              </div>
            </div>
            <div>
              <button
                onClick={toggleItemsExpanded}
                className="flex items-center justify-between w-full p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200"
                aria-expanded={isItemsExpanded}
                aria-controls={`items-${order.id}`}
              >
                <h4 className="font-semibold text-gray-900">{t('orders.items', { defaultValue: isRtl ? 'العناصر' : 'Items' })}</h4>
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
                        const itemStatusInfo = ITEM_STATUS_COLORS[item.status] || ITEM_STATUS_COLORS[ItemStatus.Pending];
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
                                <p className="font-medium text-gray-900 truncate max-w-[200px]">{item.productName}</p>
                                <span className="text-xs text-gray-600">
                                  ({item.quantity} {t(`units.${item.unit}`, { defaultValue: translateUnit(item.unit).ar })})
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 mt-1 truncate">
                                {t('orders.department_label', {
                                  department: item.department?.name,
                                  defaultValue: isRtl ? `القسم: ${translateDepartment(item.department?.name || 'unknown').ar}` : `Department: ${translateDepartment(item.department?.name || 'unknown').en}`,
                                })}
                              </p>
                              <p
                                className={`text-xs ${itemStatusInfo.color} flex items-center gap-1 ${isRtl ? 'flex-row-reverse' : ''}`}
                              >
                                <ItemStatusIcon className="w-4 h-4" />
                                {t(`orders.item_status_${itemStatusInfo.label}`, { defaultValue: translateItemStatus(itemStatusInfo.label).ar })}
                              </p>
                              {item.assignedTo && (
                                <p className="text-xs text-gray-600 mt-1 truncate">
                                  {t('orders.assigned_to', {
                                    name: item.assignedTo.name || 'غير معروف',
                                    defaultValue: isRtl ? `معين إلى: ${item.assignedTo.name || 'غير معروف'}` : `Assigned to: ${item.assignedTo.name || 'Unknown'}`,
                                  })}
                                </p>
                              )}
                            </div>
                            <div className={isRtl ? 'text-right' : 'text-left'}>
                              <p className="text-sm font-medium text-gray-900">
                                {item.price.toLocaleString(isRtl ? 'ar-SA' : 'en-US', {
                                  style: 'currency',
                                  currency: 'SAR',
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
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
                <p className="text-xs text-amber-800 truncate">
                  <strong>{t('orders.notes', { defaultValue: isRtl ? 'ملاحظات:' : 'Notes:' })}</strong> {order.notes}
                </p>
              </div>
            )}
            {order.returns?.length > 0 && (
              <div className="mt-2 p-2 bg-amber-50 rounded-md">
                <p className="text-xs font-medium text-amber-800">{t('orders.returns', { defaultValue: isRtl ? 'الإرجاعات' : 'Returns' })}</p>
                {order.returns.map((r, i) => (
                  <p key={i} className="text-xs text-amber-700 truncate">
                    {t('orders.return_details', {
                      items: r.items
                        .map((item) => `${item.quantity} ${t(`units.${item.unit}`, { defaultValue: translateUnit(item.unit).ar })} ${item.reason}`)
                        .join(', '),
                      status: t(`orders.return_status_${r.status}`, { defaultValue: translateReturnStatus(r.status).ar }),
                      defaultValue: isRtl
                        ? `${r.items
                            .map((item) => `${item.quantity} ${translateUnit(item.unit).ar} ${item.reason}`)
                            .join(', ')} - ${translateReturnStatus(r.status).ar}`
                        : `${r.items
                            .map((item) => `${item.quantity} ${translateUnit(item.unit).en} ${item.reason}`)
                            .join(', ')} - ${translateReturnStatus(r.status).en}`,
                    })}
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
                  aria-label={t('orders.view_order', { orderNumber: order.orderNumber, defaultValue: isRtl ? `عرض طلب رقم ${order.orderNumber}` : `View order #${order.orderNumber}` })}
                >
                  {t('common.view', { defaultValue: isRtl ? 'عرض' : 'View' })}
                </Button>
              </Link>
              {user?.role === 'production' && order.status === OrderStatus.Pending && (
                <>
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => updateOrderStatus(order.id, OrderStatus.Approved)}
                    className="bg-green-500 hover:bg-green-600 text-white rounded-full px-3 py-1 text-xs"
                    disabled={submitting === order.id}
                    aria-label={t('orders.approve_order', { orderNumber: order.orderNumber, defaultValue: isRtl ? `الموافقة على طلب رقم ${order.orderNumber}` : `Approve order #${order.orderNumber}` })}
                  >
                    {submitting === order.id ? t('common.loading', { defaultValue: isRtl ? 'جارٍ التحميل...' : 'Loading...' }) : t('orders.approve', { defaultValue: isRtl ? 'موافقة' : 'Approve' })}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => updateOrderStatus(order.id, OrderStatus.Cancelled)}
                    className="bg-red-500 hover:bg-red-600 text-white rounded-full px-3 py-1 text-xs"
                    disabled={submitting === order.id}
                    aria-label={t('orders.cancel_order', { orderNumber: order.orderNumber, defaultValue: isRtl ? `إلغاء طلب رقم ${order.orderNumber}` : `Cancel order #${order.orderNumber}` })}
                  >
                    {submitting === order.id ? t('common.loading', { defaultValue: isRtl ? 'جارٍ التحميل...' : 'Loading...' }) : t('orders.cancel', { defaultValue: isRtl ? 'إلغاء' : 'Cancel' })}
                  </Button>
                </>
              )}
              {user?.role === 'production' && order.status === OrderStatus.Approved && unassignedItems.length > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => openAssignModal(order)}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-3 py-1 text-xs"
                  disabled={submitting === order.id}
                  aria-label={t('orders.assign_order', { orderNumber: order.orderNumber, defaultValue: isRtl ? `تعيين طلب رقم ${order.orderNumber}` : `Assign order #${order.orderNumber}` })}
                >
                  {submitting === order.id ? t('common.loading', { defaultValue: isRtl ? 'جارٍ التحميل...' : 'Loading...' }) : t('orders.assign', { defaultValue: isRtl ? 'تعيين' : 'Assign' })}
                </Button>
              )}
              {user?.role === 'production' && order.status === OrderStatus.Completed && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => updateOrderStatus(order.id, OrderStatus.InTransit)}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-3 py-1 text-xs"
                  disabled={submitting === order.id}
                  aria-label={t('orders.ship_order', { orderNumber: order.orderNumber, defaultValue: isRtl ? `شحن طلب رقم ${order.orderNumber}` : `Ship order #${order.orderNumber}` })}
                >
                  {submitting === order.id ? t('common.loading', { defaultValue: isRtl ? 'جارٍ التحميل...' : 'Loading...' }) : t('orders.ship', { defaultValue: isRtl ? 'شحن' : 'Ship' })}
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }
);

const translateStatus = (status: string) => {
  const translations: Record<string, { ar: string; en: string }> = {
    pending: { ar: 'قيد الانتظار', en: 'Pending' },
    approved: { ar: 'تم الموافقة', en: 'Approved' },
    in_production: { ar: 'في الإنتاج', en: 'In Production' },
    completed: { ar: 'مكتمل', en: 'Completed' },
    in_transit: { ar: 'في النقل', en: 'In Transit' },
    delivered: { ar: 'تم التسليم', en: 'Delivered' },
    cancelled: { ar: 'ملغى', en: 'Cancelled' },
  };
  return translations[status] ? translations[status] : { ar: status, en: status };
};

const translateItemStatus = (status: string) => {
  const translations: Record<string, { ar: string; en: string }> = {
    pending: { ar: 'قيد الانتظار', en: 'Pending' },
    assigned: { ar: 'معين', en: 'Assigned' },
    in_progress: { ar: 'قيد التقدم', en: 'In Progress' },
    completed: { ar: 'مكتمل', en: 'Completed' },
    cancelled: { ar: 'ملغى', en: 'Cancelled' },
  };
  return translations[status] ? translations[status] : { ar: status, en: status };
};

const translatePriority = (priority: string) => {
  const translations: Record<string, { ar: string; en: string }> = {
    urgent: { ar: 'عاجل', en: 'Urgent' },
    high: { ar: 'مرتفع', en: 'High' },
    medium: { ar: 'متوسط', en: 'Medium' },
    low: { ar: 'منخفض', en: 'Low' },
  };
  return translations[priority] ? translations[priority] : { ar: priority, en: priority };
};

const translateDepartment = (dept: string) => {
  const translations: Record<string, { ar: string; en: string }> = {
    bread: { ar: 'الخبز', en: 'Bread' },
    pastries: { ar: 'المعجنات', en: 'Pastries' },
    cakes: { ar: 'الكعك', en: 'Cakes' },
    unknown: { ar: 'غير معروف', en: 'Unknown' },
  };
  return translations[dept] ? translations[dept] : { ar: dept, en: dept };
};

const translateUnit = (unit: string) => {
  const translations: Record<string, { ar: string; en: string }> = {
    كيلو: { ar: 'كيلو', en: 'kg' },
    قطعة: { ar: 'قطعة', en: 'Piece' },
    علبة: { ar: 'علبة', en: 'Box' },
    صينية: { ar: 'صينية', en: 'Tray' },
    unit: { ar: 'وحدة', en: 'Unit' },
  };
  return translations[unit] ? translations[unit] : { ar: unit, en: unit };
};

const translateReturnStatus = (status: string) => {
  const translations: Record<string, { ar: string; en: string }> = {
    pending: { ar: 'قيد الموافقة', en: 'Pending Approval' },
    approved: { ar: 'تمت الموافقة', en: 'Approved' },
    rejected: { ar: 'مرفوض', en: 'Rejected' },
    processed: { ar: 'تمت المعالجة', en: 'Processed' },
  };
  return translations[status] ? translations[status] : { ar: status, en: status };
};

export default OrderCard;