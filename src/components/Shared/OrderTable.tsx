import React, { memo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../UI/Button';
import { Link } from 'react-router-dom';
import { Clock, Check, Package, Truck, AlertCircle } from 'lucide-react';
import { Order, OrderStatus, ItemStatus } from '../../types/types';

const STATUS_COLORS: Record<OrderStatus, { color: string; icon: React.FC; label: string }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'pending' },
  approved: { color: 'bg-teal-100 text-teal-800', icon: Check, label: 'approved' },
  in_production: { color: 'bg-purple-100 text-purple-800', icon: Package, label: 'in_production' },
  completed: { color: 'bg-green-100 text-green-800', icon: Check, label: 'completed' },
  in_transit: { color: 'bg-blue-100 text-blue-800', icon: Truck, label: 'in_transit' },
  delivered: { color: 'bg-gray-100 text-gray-800', icon: Check, label: 'delivered' },
  cancelled: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: 'cancelled' },
};

const PRIORITY_COLORS: Record<Order['priority'], string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

interface OrderTableProps {
  orders: Order[];
  calculateAdjustedTotal: (order: Order) => string;
  calculateTotalQuantity: (order: Order) => number;
  translateUnit: (unit: string, isRtl: boolean) => string;
  updateOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
  openAssignModal: (order: Order) => void;
  submitting: string | null;
  isRtl: boolean;
  startIndex: number;
}

const OrderTable: React.FC<OrderTableProps> = memo(
  ({ orders, calculateAdjustedTotal, calculateTotalQuantity, translateUnit, updateOrderStatus, openAssignModal, submitting, isRtl, startIndex }) => {
    const { user } = useAuth();

    const statusTranslations = {
      pending: isRtl ? 'قيد الانتظار' : 'Pending',
      approved: isRtl ? 'تم الموافقة' : 'Approved',
      in_production: isRtl ? 'في الإنتاج' : 'In Production',
      completed: isRtl ? 'مكتمل' : 'Completed',
      in_transit: isRtl ? 'في النقل' : 'In Transit',
      delivered: isRtl ? 'تم التسليم' : 'Delivered',
      cancelled: isRtl ? 'ملغى' : 'Cancelled',
    };

    const priorityTranslations = {
      low: isRtl ? 'منخفض' : 'Low',
      medium: isRtl ? 'متوسط' : 'Medium',
      high: isRtl ? 'عالي' : 'High',
      urgent: isRtl ? 'عاجل' : 'Urgent',
    };

    const validTransitions = {
      pending: [OrderStatus.Approved, OrderStatus.Cancelled],
      approved: [OrderStatus.InProduction, OrderStatus.Cancelled],
      in_production: [OrderStatus.Completed, OrderStatus.Cancelled],
      completed: [OrderStatus.InTransit],
      in_transit: [OrderStatus.Delivered],
      delivered: [],
      cancelled: [],
    };

    return (
      <div className="overflow-x-auto">
        <table className={`min-w-full bg-white rounded-lg shadow-md ${isRtl ? 'text-right' : 'text-left'}`}>
          <thead>
            <tr className="bg-gray-100 text-gray-700 text-sm">
              <th className="py-3 px-4">{isRtl ? 'رقم' : 'No.'}</th>
              <th className="py-3 px-4">{isRtl ? 'رقم الطلب' : 'Order Number'}</th>
              <th className="py-3 px-4">{isRtl ? 'الفرع' : 'Branch'}</th>
              <th className="py-3 px-4">{isRtl ? 'الحالة' : 'Status'}</th>
              <th className="py-3 px-4">{isRtl ? 'الأولوية' : 'Priority'}</th>
              <th className="py-3 px-4">{isRtl ? 'المنتجات' : 'Products'}</th>
              <th className="py-3 px-4">{isRtl ? 'إجمالي المبلغ' : 'Total Amount'}</th>
              <th className="py-3 px-4">{isRtl ? 'الكمية' : 'Quantity'}</th>
              <th className="py-3 px-4">{isRtl ? 'التاريخ' : 'Date'}</th>
              <th className="py-3 px-4">{isRtl ? 'الإجراءات' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order, index) => {
              const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS.pending;
              const StatusIcon = statusInfo.icon;
              const unassignedItems = order.items.filter((item) => !item.assignedTo);
              return (
                <tr key={order.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm">{startIndex + index}</td>
                  <td className="py-3 px-4 text-sm">{order.orderNumber}</td>
                  <td className="py-3 px-4 text-sm">{order.branch.displayName}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs ${statusInfo.color} px-2 py-1 rounded flex items-center gap-1`}>
                      <StatusIcon className="w-4 h-4" />
                      {statusTranslations[order.status]}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs ${PRIORITY_COLORS[order.priority]} px-2 py-1 rounded`}>
                      {priorityTranslations[order.priority]}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {order.items.map((item) => (
                      <div key={item._id}>
                        {item.displayProductName} ({item.quantity} {item.displayUnit})
                      </div>
                    ))}
                  </td>
                  <td className="py-3 px-4 text-sm">{calculateAdjustedTotal(order)}</td>
                  <td className="py-3 px-4 text-sm">{calculateTotalQuantity(order)} {isRtl ? 'وحدة' : 'units'}</td>
                  <td className="py-3 px-4 text-sm">{order.date}</td>
                  <td className="py-3 px-4 flex gap-2">
                    <Link
                      to={`/orders/${order.id}`}
                      className="text-blue-600 hover:underline text-sm"
                      aria-label={isRtl ? 'عرض تفاصيل الطلب' : 'View order details'}
                    >
                      {isRtl ? 'عرض' : 'View'}
                    </Link>
                    {user?.role === 'production' && unassignedItems.length > 0 && (
                      <Button
                        variant="primary"
                        onClick={() => openAssignModal(order)}
                        disabled={submitting === order.id}
                        className="text-sm"
                        aria-label={isRtl ? 'تعيين شيفات' : 'Assign Chefs'}
                      >
                        {isRtl ? 'تعيين' : 'Assign'}
                      </Button>
                    )}
                    {user?.role === 'admin' && validTransitions[order.status].length > 0 && (
                      <div className="flex gap-2">
                        {validTransitions[order.status].map((status) => (
                          <Button
                            key={status}
                            variant="outline"
                            onClick={() => updateOrderStatus(order.id, status)}
                            disabled={submitting === order.id}
                            className="text-sm"
                            aria-label={isRtl ? `تغيير الحالة إلى ${statusTranslations[status]}` : `Change status to ${statusTranslations[status]}`}
                          >
                            {statusTranslations[status]}
                          </Button>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
);

export default OrderTable;
