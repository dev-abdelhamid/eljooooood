
import React, { memo } from 'react';
import { Card } from '../UI/Card';
import { Button } from '../UI/Button';
import { Order, OrderStatus } from '../../types/types';
import { Eye, Package, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';

interface Props {
  order: Order;
  t: (key: string, params?: any) => string;
  isRtl: boolean;
  calculateAdjustedTotal: (order: Order) => string;
  calculateTotalQuantity: (order: Order) => number;
  viewOrder: (order: Order) => void;
  openConfirmDeliveryModal: (order: Order) => void;
  openReturnModal: (order: Order, itemId: string) => void;
  user: any;
  submitting: string | null;
}

const OrderCard: React.FC<Props> = memo(
  ({ order, t, isRtl, calculateAdjustedTotal, calculateTotalQuantity, viewOrder, openConfirmDeliveryModal, openReturnModal, user, submitting }) => {
    const statusColors: { [key in OrderStatus]: string } = {
      [OrderStatus.Pending]: 'bg-yellow-100 text-yellow-800',
      [OrderStatus.Approved]: 'bg-green-100 text-green-800',
      [OrderStatus.InProduction]: 'bg-blue-100 text-blue-800',
      [OrderStatus.Completed]: 'bg-purple-100 text-purple-800',
      [OrderStatus.InTransit]: 'bg-orange-100 text-orange-800',
      [OrderStatus.Delivered]: 'bg-teal-100 text-teal-800',
      [OrderStatus.Cancelled]: 'bg-red-100 text-red-800',
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative"
      >
        <Card className="p-4 sm:p-6 bg-white shadow-md rounded-lg border border-gray-100 hover:shadow-lg transition-shadow duration-200">
          <div className={`flex flex-col sm:flex-row ${isRtl ? 'sm:flex-row-reverse' : ''} justify-between items-start sm:items-center gap-4`}>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-gray-800">
                  {isRtl ? `طلب #${order.orderNumber}` : `Order #${order.orderNumber}`}
                </h3>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[order.status]}`}>
                  {t(`orders.status_${order.status}`)}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {isRtl ? `الفرع: ${order.branch?.displayName}` : `Branch: ${order.branch?.displayName}`}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {isRtl ? `التاريخ: ${order.date}` : `Date: ${order.date}`}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {isRtl ? `الكمية: ${calculateTotalQuantity(order)}` : `Quantity: ${calculateTotalQuantity(order)}`}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {isRtl ? `الإجمالي: ${calculateAdjustedTotal(order)}` : `Total: ${calculateAdjustedTotal(order)}`}
              </p>
              <div className="mt-2">
                <p className="text-sm font-medium text-gray-700">{isRtl ? 'المنتجات:' : 'Products:'}</p>
                <ul className={`text-sm text-gray-600 ${isRtl ? 'pr-4' : 'pl-4'} list-disc`}>
                  {order.items.map(item => (
                    <li key={item.itemId}>
                      {item.productName} ({item.quantity} {t(`units.${item.unit}`) || item.unit})
                    </li>
                  ))}
                </ul>
              </div>
              {order.returns && order.returns.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-gray-700">{isRtl ? 'المرتجعات:' : 'Returns:'}</p>
                  <ul className={`text-sm text-gray-600 ${isRtl ? 'pr-4' : 'pl-4'} list-disc`}>
                    {order.returns.map(ret => (
                      <li key={ret.returnId}>
                        {isRtl
                          ? `${ret.items.map(i => `${i.quantity} ${i.productName}`).join(', ')} - ${t(`orders.return_status_${ret.status}`)}`
                          : `${ret.items.map(i => `${i.quantity} ${i.productName}`).join(', ')} - ${t(`orders.return_status_${ret.status}`)}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className={`flex flex-col gap-2 ${isRtl ? 'sm:items-end' : 'sm:items-start'}`}>
              <Button
                variant="primary"
                onClick={() => viewOrder(order)}
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2 text-sm shadow-sm flex items-center gap-2"
                disabled={submitting === order.id}
              >
                <Eye className="w-5 h-5" />
                {isRtl ? 'عرض التفاصيل' : 'View Details'}
              </Button>
              {order.status === OrderStatus.InTransit && user?.role === 'branch' && (
                <Button
                  variant="primary"
                  onClick={() => openConfirmDeliveryModal(order)}
                  className="bg-green-500 hover:bg-green-600 text-white rounded-lg px-4 py-2 text-sm shadow-sm flex items-center gap-2"
                  disabled={submitting === order.id}
                >
                  <Package className="w-5 h-5" />
                  {isRtl ? 'تأكيد التسليم' : 'Confirm Delivery'}
                </Button>
              )}
              {order.status !== OrderStatus.Cancelled && order.status !== OrderStatus.Delivered && (
                <Button
                  variant="secondary"
                  onClick={() => openReturnModal(order, order.items[0]?.itemId || '')}
                  className="bg-red-500 hover:bg-red-600 text-white rounded-lg px-4 py-2 text-sm shadow-sm flex items-center gap-2"
                  disabled={submitting === order.id || !order.items.length}
                >
                  <RotateCcw className="w-5 h-5" />
                  {isRtl ? 'طلب إرجاع' : 'Request Return'}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </motion.div>
    );
  }
);

export default OrderCard;
