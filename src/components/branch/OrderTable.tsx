import React, { memo } from 'react';
import { Order, OrderStatus } from '../../types/types';
import { Button } from '../UI/Button';
import { Eye, Package, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';

interface Props {
  orders: Order[];
  t: (key: string, params?: any) => string;
  isRtl: boolean;
  calculateAdjustedTotal: (order: Order) => string;
  calculateTotalQuantity: (order: Order) => number;
  startIndex: number;
  viewOrder: (order: Order) => void;
  openConfirmDeliveryModal: (order: Order) => void;
  openReturnModal: (order: Order, itemId: string) => void;
  user: any;
  submitting: string | null;
}

const OrderTable: React.FC<Props> = memo(
  ({ orders, t, isRtl, calculateAdjustedTotal, calculateTotalQuantity, startIndex, viewOrder, openConfirmDeliveryModal, openReturnModal, user, submitting }) => {
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
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="overflow-x-auto"
      >
        <table className="min-w-full bg-white border border-gray-100 rounded-lg shadow-lg">
          <thead>
            <tr className="bg-gray-50">
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRtl ? 'text-right' : 'text-left'}`}>
                {isRtl ? '#' : '#'}
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRtl ? 'text-right' : 'text-left'}`}>
                {isRtl ? 'رقم الطلب' : 'Order Number'}
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRtl ? 'text-right' : 'text-left'}`}>
                {isRtl ? 'الفرع' : 'Branch'}
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRtl ? 'text-right' : 'text-left'}`}>
                {isRtl ? 'الحالة' : 'Status'}
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRtl ? 'text-right' : 'text-left'}`}>
                {isRtl ? 'المنتجات' : 'Products'}
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRtl ? 'text-right' : 'text-left'}`}>
                {isRtl ? 'الإجمالي' : 'Total'}
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRtl ? 'text-right' : 'text-left'}`}>
                {isRtl ? 'الكمية' : 'Quantity'}
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRtl ? 'text-right' : 'text-left'}`}>
                {isRtl ? 'التاريخ' : 'Date'}
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRtl ? 'text-right' : 'text-left'}`}>
                {isRtl ? 'الإجراءات' : 'Actions'}
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order, index) => (
              <tr key={order.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-600">{startIndex + index}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{order.orderNumber}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{order.branch?.displayName}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[order.status]}`}>
                    {t(`orders.status_${order.status}`)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {order.items.map(item => (
                    <div key={item.itemId}>
                      {item.productName} ({item.quantity} {t(`units.${item.unit}`) || item.unit})
                    </div>
                  ))}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{calculateAdjustedTotal(order)}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{calculateTotalQuantity(order)}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{order.date}</td>
                <td className="px-4 py-3">
                  <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <Button
                      variant="primary"
                      onClick={() => viewOrder(order)}
                      className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-3 py-1 text-xs shadow-sm flex items-center gap-1"
                      disabled={submitting === order.id}
                    >
                      <Eye className="w-4 h-4" />
                      {isRtl ? 'عرض' : 'View'}
                    </Button>
                    {order.status === OrderStatus.InTransit && user?.role === 'branch' && (
                      <Button
                        variant="primary"
                        onClick={() => openConfirmDeliveryModal(order)}
                        className="bg-green-500 hover:bg-green-600 text-white rounded-lg px-3 py-1 text-xs shadow-sm flex items-center gap-1"
                        disabled={submitting === order.id}
                      >
                        <Package className="w-4 h-4" />
                        {isRtl ? 'تأكيد' : 'Confirm'}
                      </Button>
                    )}
                    {order.status !== OrderStatus.Cancelled && order.status !== OrderStatus.Delivered && (
                      <Button
                        variant="secondary"
                        onClick={() => openReturnModal(order, order.items[0]?.itemId || '')}
                        className="bg-red-500 hover:bg-red-600 text-white rounded-lg px-3 py-1 text-xs shadow-sm flex items-center gap-1"
                        disabled={submitting === order.id || !order.items.length}
                      >
                        <RotateCcw className="w-4 h-4" />
                        {isRtl ? 'إرجاع' : 'Return'}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    );
  }
);

export default OrderTable;
