import React, { memo } from 'react';
import { Button } from '../UI/Button';
import { Eye, Clock, Package, Check, AlertCircle, ChefHat } from 'lucide-react';
import { Order, OrderStatus } from '../../types/types';
import { motion } from 'framer-motion';

const STATUS_COLORS = {
  [OrderStatus.Pending]: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'pending', progress: 0 },
  [OrderStatus.Approved]: { color: 'bg-teal-100 text-teal-800', icon: Check, label: 'approved', progress: 25 },
  [OrderStatus.InProduction]: { color: 'bg-purple-100 text-purple-800', icon: Package, label: 'in_production', progress: 50 },
  [OrderStatus.Completed]: { color: 'bg-green-100 text-green-800', icon: Check, label: 'completed', progress: 75 },
  [OrderStatus.InTransit]: { color: 'bg-blue-100 text-blue-800', icon: Package, label: 'in_transit', progress: 90 },
  [OrderStatus.Delivered]: { color: 'bg-gray-100 text-gray-800', icon: Check, label: 'delivered', progress: 100 },
  [OrderStatus.Cancelled]: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: 'cancelled', progress: 0 },
};

const getFirstTwoWords = (name: string | undefined | null): string => {
  if (!name) return 'غير معروف';
  const words = name.trim().split(' ');
  return words.slice(0, 2).join(' ');
};

interface Props {
  order: Order;
  t: (key: string, params?: any) => string;
  isRtl: boolean;
  calculateAdjustedTotal: (order: Order) => string;
  calculateTotalQuantity: (order: Order) => number;
  onView: (order: Order) => void;
  onAssign: (order: Order) => void;
  onApprove: (order: Order) => void;
  onReject: (order: Order) => void;
  onReturn: (order: Order, itemId: string) => void;
  userRole: string | undefined;
  submitting: string | null;
}

const OrderCard: React.FC<Props> = memo(
  ({ order, t, isRtl, calculateAdjustedTotal, calculateTotalQuantity, onView, onAssign, onApprove, onReject, onReturn, userRole, submitting }) => {
    const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS[OrderStatus.Pending];
    const StatusIcon = statusInfo.icon;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="p-4 sm:p-5 mb-4 bg-white shadow-md rounded-lg border border-gray-200 hover:shadow-lg transition-shadow duration-300">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">{isRtl ? `الطلب #${order.orderNumber}` : `Order #${order.orderNumber}`}</h3>
              <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusInfo.color}`}>
                <StatusIcon className="w-4 h-4" />
                <span>{t(`orders.status_${statusInfo.label}`)}</span>
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-amber-600 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${statusInfo.progress}%` }}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500">{isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}</p>
                <p className="text-sm font-medium text-gray-800">
                  {isRtl ? `${calculateTotalQuantity(order)} عنصر` : `${calculateTotalQuantity(order)} items`}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{isRtl ? 'إجمالي المبلغ' : 'Total Amount'}</p>
                <p className="text-sm font-semibold text-teal-600">{calculateAdjustedTotal(order)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{isRtl ? 'التاريخ' : 'Date'}</p>
                <p className="text-sm font-medium text-gray-800">{order.date}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{isRtl ? 'الفرع' : 'Branch'}</p>
                <p className="text-sm font-medium text-gray-800">{order.branch.displayName}</p>
              </div>
            </div>
            <div className="mt-2 p-2 bg-gray-50 rounded-md">
              <p className="text-xs font-medium text-gray-800">{isRtl ? 'المنتجات' : 'Products'}:</p>
              <p className="text-sm text-gray-700">
                {order.items.map(item => `(${item.quantity} ${t(`units.${item.unit || 'unit'}`)} × ${getFirstTwoWords(item.productName)})`).join(' + ')}
              </p>
            </div>
            {order.returns?.length > 0 && (
              <div className="mt-2 p-2 bg-amber-50 rounded-md">
                <p className="text-xs font-medium text-amber-800">{isRtl ? 'المرتجعات' : 'Returns'}:</p>
                {order.returns.map((r, i) => (
                  <p key={i} className="text-xs text-amber-700">
                    {isRtl
                      ? `إرجاع ${r.items
                          .map(item => `${item.quantity} ${t(`units.${item.unit || 'unit'}`)} × ${item.productName} (${t(`orders.return_reasons_${item.reason}`)})`)
                          .join(', ')} - ${t(`orders.return_status_${r.status}`)}`
                      : `Return ${r.items
                          .map(item => `${item.quantity} ${t(`units.${item.unit || 'unit'}`)} × ${item.productName} (${t(`orders.return_reasons_${item.reason}`)})`)
                          .join(', ')} - ${t(`orders.return_status_${r.status}`)}`}
                  </p>
                ))}
              </div>
            )}
            {order.displayNotes && (
              <div className="mt-2 p-2 bg-amber-50 rounded-md">
                <p className="text-xs text-amber-800">
                  <strong>{isRtl ? 'ملاحظات' : 'Notes'}:</strong> {order.displayNotes}
                </p>
              </div>
            )}
            <div className={`flex flex-wrap gap-2 ${isRtl ? 'justify-end' : 'justify-start'}`}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => onView(order)}
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-3 py-1 text-xs"
                aria-label={isRtl ? `عرض الطلب ${order.orderNumber}` : `View order ${order.orderNumber}`}
              >
                <Eye className="w-4 h-4" /> {isRtl ? 'عرض' : 'View'}
              </Button>
              {userRole === 'admin' && order.status === OrderStatus.Pending && (
                <>
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => onApprove(order)}
                    className="bg-green-500 hover:bg-green-600 text-white rounded-full px-3 py-1 text-xs"
                    disabled={submitting === order.id}
                    aria-label={isRtl ? `الموافقة على الطلب ${order.orderNumber}` : `Approve order ${order.orderNumber}`}
                  >
                    <Check className="w-4 h-4" /> {isRtl ? 'الموافقة' : 'Approve'}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onReject(order)}
                    className="bg-red-500 hover:bg-red-600 text-white rounded-full px-3 py-1 text-xs"
                    disabled={submitting === order.id}
                    aria-label={isRtl ? `رفض الطلب ${order.orderNumber}` : `Reject order ${order.orderNumber}`}
                  >
                    <AlertCircle className="w-4 h-4" /> {isRtl ? 'رفض' : 'Reject'}
                  </Button>
                </>
              )}
              {userRole === 'production' && [OrderStatus.Approved, OrderStatus.InProduction].includes(order.status) && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onAssign(order)}
                  className="bg-purple-500 hover:bg-purple-600 text-white rounded-full px-3 py-1 text-xs"
                  disabled={submitting === order.id}
                  aria-label={isRtl ? `تعيين الطهاة للطلب ${order.orderNumber}` : `Assign chefs to order ${order.orderNumber}`}
                >
                  <ChefHat className="w-4 h-4" /> {isRtl ? 'تعيين' : 'Assign'}
                </Button>
              )}
              {order.status === OrderStatus.Delivered && userRole === 'branch' && order.branch?._id === order.branchId && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onReturn(order, order.items[0].itemId)}
                  className="bg-red-500 hover:bg-red-600 text-white rounded-full px-3 py-1 text-xs"
                  disabled={submitting === order.id}
                  aria-label={isRtl ? `إرجاع الطلب ${order.orderNumber}` : `Return order ${order.orderNumber}`}
                >
                  {isRtl ? 'إرجاع' : 'Return'}
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