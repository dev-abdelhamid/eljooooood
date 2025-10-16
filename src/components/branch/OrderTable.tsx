import React, { memo } from 'react';
import { Button } from '../UI/Button';
import { Eye } from 'lucide-react';
import { Order } from '../../types/types';

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
  calculateTotalQuantity: (order: Order) => number;
  startIndex: number;
  viewOrder: (order: Order) => void;
  openConfirmDeliveryModal: (order: Order) => void;
  user: any;
  submitting: string | null;
}

const OrderTable: React.FC<Props> = memo(
  ({ orders, t, isRtl, calculateTotalQuantity, startIndex, viewOrder, openConfirmDeliveryModal, user, submitting }) => (
    <div className="overflow-x-auto rounded-lg shadow-md border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 table-auto bg-white">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[5%]">{t('orders.number')}</th>
            <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[15%]">{t('orders.order_number')}</th>
            <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[15%]">{t('orders.status')}</th>
            <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[30%]">{t('orders.products')}</th>
            <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[15%]">{t('orders.total_amount')}</th>
            <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[10%]">{t('orders.total_quantity')}</th>
            <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[15%]">{t('orders.date')}</th>
            <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[15%]">{t('orders.actions')}</th>
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
                <td className="px-4 py-2 leading-6 whitespace-nowrap text-sm text-gray-600 text-right">
                  {order.items.map(item => `(${item.quantity} ${t(`${item.unit || 'unit'}`)} × ${getFirstTwoWords(item.productName)})`).join(' + ')}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">
                  {order.totalAmount.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">{calculateTotalQuantity(order)}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">{order.date}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-right">
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => viewOrder(order)}
                      className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-3 py-1 text-xs"
                      aria-label={t('orders.view_order', { orderNumber: order.orderNumber })}
                    >
                      <Eye className="w-4 h-4" /> {t('orders.view')}
                    </Button>
                    {order.status === 'in_transit' && user?.role === 'branch' && order.branch._id === user.branchId && (
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  )
);

OrderTable.displayName = 'OrderTable';

export default OrderTable;