import React, { memo } from 'react';
import { Button } from '../UI/Button';
import { Eye, Truck } from 'lucide-react';
import { Order } from '../../types/types';
import { motion } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';

const STATUS_COLORS = {
  pending: { color: 'bg-yellow-100 text-yellow-800', label: 'pending' },
  approved: { color: 'bg-teal-100 text-teal-800', label: 'approved' },
  in_production: { color: 'bg-purple-100 text-purple-800', label: 'in_production' },
  completed: { color: 'bg-green-100 text-green-800', label: 'completed' },
  in_transit: { color: 'bg-blue-100 text-blue-800', label: 'in_transit' },
  delivered: { color: 'bg-gray-100 text-gray-800', label: 'delivered' },
  cancelled: { color: 'bg-red-100 text-red-800', label: 'cancelled' },
};

const getFirstTwoWords = (name: string | undefined | null): string => {
  if (!name) return 'غير معروف';
  const words = name.trim().split(' ');
  return words.slice(0, 2).join(' ');
};

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
  ({ orders, t, isRtl, calculateAdjustedTotal, calculateTotalQuantity, startIndex, viewOrder, openConfirmDeliveryModal, openReturnModal, user, submitting }) => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="overflow-x-auto rounded-lg shadow-md border border-gray-200"
    >
      <table className="min-w-full divide-y divide-gray-200 table-auto bg-white">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[5%]">
              {isRtl ? '#' : '#'}
            </th>
            <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[15%]">
              {isRtl ? 'رقم الطلب' : 'Order Number'}
            </th>
            <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[15%]">
              {isRtl ? 'الحالة' : 'Status'}
            </th>
            <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[20%]">
              {isRtl ? 'المنتجات' : 'Products'}
            </th>
            <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[15%]">
              {isRtl ? 'إجمالي المبلغ' : 'Total Amount'}
            </th>
            <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[10%]">
              {isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}
            </th>
            <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[15%]">
              {isRtl ? 'التاريخ' : 'Date'}
            </th>
            <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[15%]">
              {isRtl ? 'الفرع' : 'Branch'}
            </th>
            <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[15%]">
              {isRtl ? 'الإجراءات' : 'Actions'}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {orders.map((order, i) => {
            const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS.pending;
            return (
              <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">{startIndex + i}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">{order.orderNumber}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-right">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                    {t(`orders.status_${statusInfo.label}`)}
                  </span>
                </td>
                <td className="px-4 py-2 text-sm text-gray-600 text-right truncate">
                  {order.items
                    .map(item => `(${item.quantity} ${t(`${item.unit || 'unit'}`)} ${getFirstTwoWords(item.productName)})`)
                    .join(' + ')}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">{calculateAdjustedTotal(order)}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">{calculateTotalQuantity(order)}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">{order.date}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">
                  {order.branch?.displayName || (isRtl ? 'غير معروف' : 'Unknown')}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-right">
                  <div className={`flex gap-2 ${isRtl ? 'justify-end' : 'justify-start'}`}>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => viewOrder(order)}
                      className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-3 py-1 text-xs shadow-sm"
                      aria-label={isRtl ? `عرض الطلب ${order.orderNumber}` : `View order ${order.orderNumber}`}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      {isRtl ? 'عرض' : 'View'}
                    </Button>
                    {order.status === 'in_transit' && user?.role === 'branch' && order.branch?._id === user.branchId && (
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => openConfirmDeliveryModal(order)}
                        className="bg-green-500 hover:bg-green-600 text-white rounded-lg px-3 py-1 text-xs shadow-sm"
                        disabled={submitting === order.id}
                        aria-label={isRtl ? `تأكيد تسليم الطلب ${order.orderNumber}` : `Confirm delivery of order ${order.orderNumber}`}
                      >
                        <Truck className="w-4 h-4 mr-1" />
                        {isRtl ? 'تأكيد التسليم' : 'Confirm Delivery'}
                      </Button>
                    )}
                    {order.status === 'delivered' && user?.role === 'branch' && order.branch?._id === user.branchId && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openReturnModal(order, order.items[0].itemId)}
                        className="bg-red-500 hover:bg-red-600 text-white rounded-lg px-3 py-1 text-xs shadow-sm"
                        disabled={submitting === 'return'}
                        aria-label={isRtl ? `إرجاع الطلب ${order.orderNumber}` : `Return order ${order.orderNumber}`}
                      >
                        {isRtl ? 'إرجاع' : 'Return'}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </motion.div>
  )
);

export default OrderTable;
