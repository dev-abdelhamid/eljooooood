import React, { memo } from 'react';
import { Button } from '../UI/Button';
import { Eye, Clock, Package, Check, Truck, AlertCircle } from 'lucide-react';
import { Order } from '../../types/types';
import { motion } from 'framer-motion';

const STATUS_COLORS = {
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
  calculateTotalQuantity: (order: Order) => number;
  viewOrder: (order: Order) => void;
  openConfirmDeliveryModal: (order: Order) => void;
  user: any;
  submitting: string | null;
}

const OrderCard: React.FC<Props> = memo(
  ({ order, t, isRtl, calculateTotalQuantity, viewOrder, openConfirmDeliveryModal, user, submitting }) => {
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
                <p className="text-xs leading-relaxed text-gray-500">{t('orders.total_quantity')}</p>
                <p className="text-sm font-medium text-gray-800">
                  {isRtl ? `${calculateTotalQuantity(order)} ${t('orders.items')}` : `${calculateTotalQuantity(order)} ${t('orders.items')}`}
                </p>
              </div>
              <div>
                <p className="text-xs leading-relaxed text-gray-500">{t('orders.total_amount')}</p>
                <p className="text-sm font-semibold text-teal-600">
                  {order.totalAmount.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}
                </p>
              </div>
              <div>
                <p className="text-xs leading-relaxed text-gray-500">{t('orders.date')}</p>
                <p className="text-sm font-medium text-gray-800">{order.date}</p>
              </div>
            </div>
            <div className="mt-2 p-2 leading-relaxed bg-gray-50 rounded-md">
              <p className="text-xs font-medium text-gray-800">{t('orders.products')}:</p>
              <p className="text-sm text-gray-700">
                {order.items.map(item => `(${item.quantity} ${t(`${item.unit || 'unit'}`)} × ${getFirstTwoWords(item.productName)})`).join(' + ')}
              </p>
            </div>
            {order.notes && (
              <div className="mt-2 p-2 bg-amber-50 rounded-md">
                <p className="text-xs text-amber-800">
                  <strong>{t('orders.notes')}:</strong> {order.notes}
                </p>
              </div>
            )}
            <div className={`flex flex-wrap gap-2 ${isRtl ? 'justify-end' : 'justify-start'}`}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => viewOrder(order)}
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-3 py-1 text-xs"
                aria-label={t('orders.view_order', { orderNumber: order.orderNumber })}
              >
                <Eye className="w-4 h-4" /> {t('orders.view')}
              </Button>
              {order.status === 'in_transit' && user?.role === 'branch' && order.branch?._id === user.branchId && (
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => openConfirmDeliveryModal(order)}
                  className="bg-green-500 hover:bg-green-600 text-white rounded-full px-3 py-1 text-xs"
                  disabled={submitting === order.id}
                  aria-label={t('orders.confirm_delivery', { orderNumber: order.orderNumber })}
                >
                  {t('orders.confirm_delivery')}
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