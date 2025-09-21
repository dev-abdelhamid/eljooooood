import React, { memo } from 'react';
import { Button } from '../UI/Button';
import { Eye, Truck, Clock, Package, Check, AlertCircle } from 'lucide-react';
import { Order } from '../../types/types';
import { motion } from 'framer-motion';

const STATUS_COLORS: Record<string, { color: string; icon: React.ElementType; label: string; progress: number }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'pending', progress: 0 },
  approved: { color: 'bg-teal-100 text-teal-800', icon: Check, label: 'approved', progress: 25 },
  in_production: { color: 'bg-purple-100 text-purple-800', icon: Package, label: 'in_production', progress: 50 },
  completed: { color: 'bg-green-100 text-green-800', icon: Check, label: 'completed', progress: 75 },
  in_transit: { color: 'bg-blue-100 text-blue-800', icon: Truck, label: 'in_transit', progress: 90 },
  delivered: { color: 'bg-gray-100 text-gray-800', icon: Check, label: 'delivered', progress: 100 },
  cancelled: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: 'cancelled', progress: 0 },
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
  viewOrder: (order: Order) => void;
  openConfirmDeliveryModal: (order: Order) => void;
  openReturnModal: (order: Order, itemId: string) => void;
  user: { id: string; role: string; branchId: string } | null;
  submitting: string | null;
}

const OrderCard: React.FC<Props> = memo(
  ({ order, t, isRtl, calculateAdjustedTotal, calculateTotalQuantity, viewOrder, openConfirmDeliveryModal, openReturnModal, user, submitting }) => {
    // Guard against invalid order
    if (!order || !order.id || !order.orderNumber) {
      return null;
    }

    const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS.pending;
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
                <span>
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
                <p className="text-sm font-medium text-gray-800">{order.date || 'N/A'}</p>
              </div>
            </div>
            <div className="mt-2 p-2 bg-gray-50 rounded-md">
              <p className="text-xs font-medium text-gray-800">{isRtl ? 'المنتجات' : 'Products'}:</p>
              <p className="text-sm text-gray-700">
                {order.items?.length > 0
                  ? order.items.map(item => `(${item.quantity} ${t(`${item.unit || 'unit'}`)} ${getFirstTwoWords(item.productName)})`).join(' + ')
                  : isRtl ? 'لا توجد منتجات' : 'No products'}
              </p>
            </div>
            {order.returns?.length > 0 && (
              <div className="mt-2 p-2 bg-amber-50 rounded-md">
                <p className="text-xs font-medium text-amber-800">{isRtl ? 'المرتجعات' : 'Returns'}:</p>
                {order.returns.map((r, i) => (
                  <p key={i} className="text-xs text-amber-700">
                    {isRtl
                      ? `إرجاع ${r.items
                          .map(item => `${item.quantity} ${t(`سبب الارجاع: ${item.reason}`)}`)
                          .join(', ')} - ${t(` الحالة: ${r.status}`)}`
                      : `Return ${r.items
                          .map(item => `${item.quantity} ${t(`return_reason: ${item.reason}`)}`)
                          .join(', ')} - ${t(`status: ${r.status}`)}`}
                  </p>
                ))}
              </div>
            )}
            {order.notes && (
              <div className="mt-2 p-2 bg-amber-50 rounded-md">
                <p className="text-xs text-amber-800">
                  <strong>{isRtl ? 'ملاحظات' : 'Notes'}:</strong> {order.notes}
                </p>
              </div>
            )}
            <div className={`flex flex-wrap gap-2 ${isRtl ? 'justify-end' : 'justify-start'}`}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => viewOrder(order)}
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-3 py-1 text-xs"
                aria-label={isRtl ? `عرض الطلب ${order.orderNumber}` : `View order ${order.orderNumber}`}
              >
                {isRtl ? 'عرض' : 'View'}
              </Button>
              {order.status === 'in_transit' && user?.role === 'branch' && order.branch?._id === user.branchId && (
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => openConfirmDeliveryModal(order)}
                  className="bg-green-500 hover:bg-green-600 text-white rounded-full px-3 py-1 text-xs"
                  disabled={submitting === order.id}
                  aria-label={isRtl ? `تأكيد تسليم الطلب ${order.orderNumber}` : `Confirm delivery of order ${order.orderNumber}`}
                >
                  {isRtl ? 'تأكيد التسليم' : 'Confirm Delivery'}
                </Button>
              )}
              {order.status === 'delivered' && user?.role === 'branch' && order.branch?._id === user.branchId && order.items?.[0]?.itemId && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openReturnModal(order, order.items[0].itemId)}
                  className="bg-red-500 hover:bg-red-600 text-white rounded-full px-3 py-1 text-xs"
                  disabled={submitting === 'return'}
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

export default OrderCard;