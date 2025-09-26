import React, { memo } from 'react';
import { Button } from '../UI/Button';
import { Eye, Clock, Package, Check, AlertCircle, ChefHat } from 'lucide-react';
import { Order, OrderStatus } from '../../types/types';

const STATUS_COLORS = {
  [OrderStatus.Pending]: { color: 'bg-yellow-100 text-yellow-800', label: 'pending' },
  [OrderStatus.Approved]: { color: 'bg-teal-100 text-teal-800', label: 'approved' },
  [OrderStatus.InProduction]: { color: 'bg-purple-100 text-purple-800', label: 'in_production' },
  [OrderStatus.Completed]: { color: 'bg-green-100 text-green-800', label: 'completed' },
  [OrderStatus.InTransit]: { color: 'bg-blue-100 text-blue-800', label: 'in_transit' },
  [OrderStatus.Delivered]: { color: 'bg-gray-100 text-gray-800', label: 'delivered' },
  [OrderStatus.Cancelled]: { color: 'bg-red-100 text-red-800', label: 'cancelled' },
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
  onView: (order: Order) => void;
  onAssign: (order: Order) => void;
  onApprove: (order: Order) => void;
  onReject: (order: Order) => void;
  onReturn: (order: Order, itemId: string) => void;
  userRole: string | undefined;
  submitting: string | null;
}

const OrderTable: React.FC<Props> = memo(
  ({ orders, t, isRtl, calculateAdjustedTotal, calculateTotalQuantity, onView, onAssign, onApprove, onReject, onReturn, userRole, submitting }) => (
    <div className="overflow-x-auto rounded-lg shadow-md border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 table-auto bg-white">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[5%]">{isRtl ? '#' : '#'}</th>
            <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[15%]">{isRtl ? 'رقم الطلب' : 'Order Number'}</th>
            <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[15%]">{isRtl ? 'الحالة' : 'Status'}</th>
            <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[30%]">{isRtl ? 'المنتجات' : 'Products'}</th>
            <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[15%]">{isRtl ? 'إجمالي المبلغ' : 'Total Amount'}</th>
            <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[10%]">{isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}</th>
            <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[15%]">{isRtl ? 'التاريخ' : 'Date'}</th>
            <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[15%]">{isRtl ? 'الإجراءات' : 'Actions'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {orders.map((order, i) => {
            const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS[OrderStatus.Pending];
            return (
              <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">{i + 1}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">{order.orderNumber}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-right">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                    {t(`orders.status_${statusInfo.label}`)}
                  </span>
                </td>
                <td className="px-4 py-2 text-sm text-gray-600 text-right truncate">
                  {order.items.map(item => `(${item.quantity} ${t(`units.${item.unit || 'unit'}`)} × ${getFirstTwoWords(item.productName)})`).join(' + ')}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">{calculateAdjustedTotal(order)}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">{calculateTotalQuantity(order)}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">{order.date}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-right">
                  <div className="flex gap-2 justify-end">
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