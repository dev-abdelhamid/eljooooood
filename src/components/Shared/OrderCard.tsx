import React, { useState, useCallback, memo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../UI/Button';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
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
  calculateAdjustedTotal: (order: Order) => string;
  calculateTotalQuantity: (order: Order) => number;
  translateUnit: (unit: string, isRtl: boolean) => string;
  updateOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
  openAssignModal: (order: Order) => void;
  submitting: string | null;
  isRtl: boolean;
}

const OrderCard: React.FC<OrderCardProps> = memo(
  ({ order, calculateAdjustedTotal, calculateTotalQuantity, translateUnit, updateOrderStatus, openAssignModal, submitting, isRtl }) => {
    const { user } = useAuth();
    const [isItemsExpanded, setIsItemsExpanded] = useState(false);
    const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS.pending;
    const StatusIcon = statusInfo.icon;
    const unassignedItems = order.items.filter((item) => !item.assignedTo);
    const displayedItems = isItemsExpanded ? order.items : order.items.slice(0, 3);
    const hasMoreItems = order.items.length > 3;

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
      in_progress: isRtl ? 'قيد التقدم' : 'In Progress',
      completed: isRtl ? 'مكتمل' : 'Completed',
      cancelled: isRtl ? 'ملغى' : 'Cancelled',
    };

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
            <div className={`flex items-center justify-between ${isRtl ? 'flex-row' : ''}`}>
              <div className="flex items-center gap-1">
                <h3 id={`order-${order.id}`} className="text-base font-semibold text-gray-800 truncate max-w-[220px]">
                  {isRtl ? `طلب ${order.orderNumber || 'غير معروف'}` : `Order #${order.orderNumber || 'Unknown'}`}
                </h3>
                {order.priority !== 'medium' && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[order.priority]} ${
                      isRtl ? 'mr-1' : 'ml-1'
                    }`}
                  >
                    {isRtl ? { urgent: 'عاجل', high: 'مرتفع', medium: 'متوسط', low: 'منخفض' }[order.priority] : order.priority}
                  </span>
                )}
              </div>
              <span
                className={`px-1.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${statusInfo.color} ${
                  isRtl ? 'flex-row-reverse' : ''
                }`}
              >
                <StatusIcon className="w-3 h-3" />
                {statusTranslations[order.status]}
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
                  {isRtl ? `${unassignedItems.length} عناصر غير معينة` : `${unassignedItems.length} unassigned items`}
                </span>
              </motion.div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <p className="text-xs text-gray-500">{isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}</p>
                <p className="text-xs font-medium text-gray-800">
                  {isRtl ? `${calculateTotalQuantity(order)} عنصر` : `${calculateTotalQuantity(order)} items`}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{isRtl ? 'إجمالي المبلغ' : 'Total Amount'}</p>
                <p className="text-xs font-semibold text-teal-600">{calculateAdjustedTotal(order)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{isRtl ? 'التاريخ' : 'Date'}</p>
                <p className="text-xs font-medium text-gray-800 truncate">{order.date}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{isRtl ? 'الفرع' : 'Branch'}</p>
                <p className="text-xs font-medium text-gray-800 truncate">{order.branch.displayName || 'غير معروف'}</p>
              </div>
            </div>
            <div>
              <div className="p-2 bg-gray-50 rounded-md">
                <h4 className="text-xs font-semibold text-gray-900">{isRtl ? 'المنتجات' : 'Products'}</h4>
                <motion.div
                  initial={{ height: 'auto' }}
                  animate={{ height: 'auto' }}
                  transition={{ duration: 0.3 }}
                  className="mt-2"
                >
                  <ul className="space-y-2">
                    {displayedItems.map((item) => {
                      const itemStatusInfo = ITEM_STATUS_COLORS[item.status] || ITEM_STATUS_COLORS.pending;
                      const ItemStatusIcon = itemStatusInfo.icon;
                      return (
                        <li
                          key={item._id}
                          className="p-2 bg-gray-50 rounded-md"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium text-gray-900 truncate flex-1">
                              {isRtl
                                ? `${item.displayProductName} (${item.quantity} ${item.displayUnit})`
                                : `${item.displayProductName} (${item.quantity} ${item.displayUnit})`}
                            </p>
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-xs font-small flex items-center gap-1 ${itemStatusInfo.color} ${
                                isRtl ? 'flex-row-reverse' : ''
                              }`}
                            >
                              <ItemStatusIcon className="w-3 h-3" />
                              {isRtl ? { pending: 'قيد الانتظار', assigned: 'معين', in_progress: 'قيد التقدم', completed: 'مكتمل', cancelled: 'ملغى' }[item.status] : itemStatusInfo.label}
                            </span>
                          </div>
                          {item.assignedTo && (
                            <p className="text-xs text-gray-600 truncate mt-1">
                              {isRtl
                                ? `معين لـ: شيف ${item.assignedTo.displayName} (${item.department?.displayName || 'غير معروف'})`
                                : `Assigned to: Chef ${item.assignedTo.displayName} (${item.department?.displayName || 'Unknown'})`}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {hasMoreItems && (
                    <button
                      onClick={toggleItemsExpanded}
                      className="text-amber-600 hover:text-amber-700 text-xs font-medium mt-2 flex items-center gap-1"
                      aria-expanded={isItemsExpanded}
                      aria-controls={`items-${order.id}`}
                    >
                      {isItemsExpanded ? (
                        <>
                          {isRtl ? 'عرض أقل' : 'Show Less'}
                          <ChevronUp className="w-4 h-4" />
                        </>
                      ) : (
                        <>
                          {isRtl ? `+${order.items.length - 3} منتج` : `+${order.items.length - 3} items`}
                          <ChevronDown className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  )}
                </motion.div>
              </div>
            </div>
            {order.notes && (
              <div className="mt-1 p-1.5 bg-amber-50 rounded-md">
                <p className="text-xs text-amber-800 truncate">
                  <strong>{isRtl ? 'ملاحظات:' : 'Notes:'}</strong> {order.notes}
                </p>
              </div>
            )}
            {order.returns?.length > 0 && (
              <div className="mt-1 p-1.5 bg-amber-50 rounded-md">
                <p className="text-xs font-medium text-amber-800">{isRtl ? 'الإرجاعات' : 'Returns'}</p>
                {order.returns.map((r, i) => (
                  <p key={i} className="text-xs text-amber-700 truncate">
                    {isRtl
                      ? `${r.items
                          .map((item) => `${item.quantity} ${item.displayUnit} ${item.reason}`)
                          .join(', ')} - الحالة: ${
                          isRtl ? { pending: 'قيد الانتظار', approved: 'تمت الموافقة', rejected: 'مرفوض', processed: 'تمت المعالجة' }[r.status] : r.status
                        }`
                      : `${r.items
                          .map((item) => `${item.quantity} ${item.displayUnit} ${item.reason}`)
                          .join(', ')} - Status: ${r.status}`}
                  </p>
                ))}
              </div>
            )}
            <div className={`flex flex-wrap gap-1.5 ${isRtl ? 'justify-end' : 'justify-start'}`}>
              <Link to={`/orders/${order.id}`}>
                <Button
                  variant="primary"
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white rounded-full px-2.5 py-1 text-xs"
                  aria-label={isRtl ? `عرض طلب رقم ${order.orderNumber}` : `View order #${order.orderNumber}`}
                >
                  {isRtl ? 'عرض' : 'View'}
                </Button>
              </Link>
              {['production', 'admin'].includes(user?.role || '') && order.status === 'pending' && (
                <>
                  <Button
                    variant="success"
                    size="sm"
                    icon={Check}
                    onClick={() => updateOrderStatus(order.id, 'approved')}
                    className="bg-amber-600 hover:bg-amber-700 text-white rounded-full px-3 py-1 text-xs"
                    disabled={submitting === order.id}
                    aria-label={isRtl ? `الموافقة على طلب رقم ${order.orderNumber}` : `Approve order #${order.orderNumber}`}
                  >
                    {submitting === order.id ? (isRtl ? 'جارٍ...' : 'Loading...') : (isRtl ? 'موافقة' : 'Approve')}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={AlertCircle}
                    onClick={() => updateOrderStatus(order.id, 'cancelled')}
                    className="bg-amber-600 hover:bg-amber-700 text-white rounded-full px-3 py-1 text-xs"
                    disabled={submitting === order.id}
                    aria-label={isRtl ? `إلغاء طلب رقم ${order.orderNumber}` : `Cancel order #${order.orderNumber}`}
                  >
                    {submitting === order.id ? (isRtl ? 'جارٍ...' : 'Loading...') : (isRtl ? 'إلغاء' : 'Cancel')}
                  </Button>
                </>
              )}
              {['production', 'admin'].includes(user?.role || '') && order.status === 'approved' && unassignedItems.length > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={Package}
                  onClick={() => openAssignModal(order)}
                  className="bg-purple-300 hover:bg-purple-400 text-white rounded-full px-3 py-1 text-xs"
                  disabled={submitting === order.id}
                  aria-label={isRtl ? `تعيين طلب رقم ${order.orderNumber}` : `Assign order #${order.orderNumber}`}
                >
                  {submitting === order.id ? (isRtl ? 'جارٍ...' : 'Loading...') : (isRtl ? 'توزيع' : 'Assign')}
                </Button>
              )}
              {['production', 'admin'].includes(user?.role || '') && order.status === 'completed' && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={Truck}
                  onClick={() => updateOrderStatus(order.id, 'in_transit')}
                  className="bg-blue-300 hover:bg-blue-400 text-white rounded-full px-3 py-1 text-xs"
                  disabled={submitting === order.id}
                  aria-label={isRtl ? `شحن طلب رقم ${order.orderNumber}` : `Ship order #${order.orderNumber}`}
                >
                  {submitting === order.id ? (isRtl ? 'جارٍ...' : 'Loading...') : (isRtl ? 'شحن' : 'Ship')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }
);

OrderCard.displayName = 'OrderCard';

export default OrderCard;