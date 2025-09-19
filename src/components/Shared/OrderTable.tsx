import React, { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '../UI/Button';
import { useAuth } from '../../contexts/AuthContext';
import { Order, OrderStatus } from '../../types/types';
import { Clock, Check, Package, Truck, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

const STATUS_COLORS: Record<OrderStatus, { color: string; label: string; icon: React.FC }> = {
  pending: { color: 'bg-yellow-100 text-yellow-700', label: 'pending', icon: Clock },
  approved: { color: 'bg-teal-100 text-teal-700', label: 'approved', icon: Check },
  in_production: { color: 'bg-purple-100 text-purple-700', label: 'in_production', icon: Package },
  completed: { color: 'bg-green-100 text-green-700', label: 'completed', icon: Check },
  in_transit: { color: 'bg-blue-100 text-blue-700', label: 'in_transit', icon: Truck },
  delivered: { color: 'bg-gray-100 text-gray-700', label: 'delivered', icon: Check },
  cancelled: { color: 'bg-red-100 text-red-700', label: 'cancelled', icon: AlertCircle },
};

interface OrderTableProps {
  orders: Order[];
  calculateAdjustedTotal: (order: Order) => string;
  calculateTotalQuantity: (order: Order) => number;
  translateUnit: (unit: string, isRtl: boolean) => string;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  openAssignModal: (order: Order) => void;
  startIndex: number;
  submitting: string | null;
  isRtl: boolean;
}

const OrderTable: React.FC<OrderTableProps> = memo(
  ({ orders, calculateAdjustedTotal, calculateTotalQuantity, translateUnit, updateOrderStatus, openAssignModal, startIndex, submitting, isRtl }) => {
    const { user } = useAuth();
    const [expandedRows, setExpandedRows] = useState<string[]>([]);

    const toggleExpand = (orderId: string) => {
      setExpandedRows(prev => prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]);
    };

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="overflow-x-auto rounded-md shadow-md border border-gray-100 bg-white"
        role="table"
        aria-label={isRtl ? 'جدول الطلبات' : 'Orders Table'}
      >
        <table className="min-w-full divide-y divide-gray-100 text-xs">
          <thead className="bg-gray-50">
            <tr className={isRtl ? 'flex-row-reverse' : ''}>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[40px]">{isRtl ? 'رقم' : 'No.'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">{isRtl ? 'رقم الطلب' : 'Order Number'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">{isRtl ? 'الفرع' : 'Branch'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">{isRtl ? 'الحالة' : 'Status'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[80px]">{isRtl ? 'الأولوية' : 'Priority'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[200px]">{isRtl ? 'المنتجات' : 'Products'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">{isRtl ? 'إجمالي المبلغ' : 'Total Amount'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[80px]">{isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">{isRtl ? 'التاريخ' : 'Date'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[120px]">{isRtl ? 'الإجراءات' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((order, index) => {
              const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS.pending;
              const StatusIcon = statusInfo.icon;
              const unassignedItems = order.items.filter((item) => !item.assignedTo);
              const isExpanded = expandedRows.includes(order.id);
              const productsToShow = isExpanded ? order.items : order.items.slice(0, 3);
              const remaining = order.items.length - 3;

              return (
                <tr key={order.id} className={`hover:bg-gray-50 transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-2 py-2 text-gray-600 text-center whitespace-nowrap">{startIndex + index}</td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate max-w-[100px]">{order.orderNumber}</td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate max-w-[100px]">{order.branchName}</td>
                  <td className="px-2 py-2 text-center">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium items-center gap-1 ${statusInfo.color} ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <StatusIcon className="w-4 h-4" />
                      {isRtl ? {pending: 'قيد الانتظار', approved: 'تم الموافقة', in_production: 'في الإنتاج', completed: 'مكتمل', in_transit: 'في النقل', delivered: 'تم التسليم', cancelled: 'ملغى'}[order.status] : statusInfo.label}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate">
                    {isRtl
                      ? {urgent: 'عاجل', high: 'مرتفع', medium: 'متوسط', low: 'منخفض'}[order.priority]
                      : order.priority}
                  </td>
                  <td className="px-2 py-2 text-gray-600 text-center cursor-pointer" onClick={() => toggleExpand(order.id)}>
                    {productsToShow.map((item) => (
                      <span key={item._id} className="inline-block mr-1 truncate">
                        {`${item.quantity} ${translateUnit(item.unit, isRtl)} ${item.productName}, `}
                      </span>
                    ))}
                    {!isExpanded && remaining > 0 && (
                      <span className="text-gray-500 truncate">{isRtl ? `و ${remaining} آخرين` : `and ${remaining} more`}</span>
                    )}
                    <span>{isExpanded ? <ChevronUp className="inline w-4 h-4" /> : <ChevronDown className="inline w-4 h-4" />}</span>
                  </td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate">{calculateAdjustedTotal(order)}</td>
                  <td className="px-2 py-2 text-gray-600 text-center">{calculateTotalQuantity(order)}</td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate">{order.date}</td>
                  <td className="px-2 py-2 text-center">
                    <div className={`flex gap-1 flex-wrap ${isRtl ? 'justify-end' : 'justify-start'}`}>
                      <Link to={`/orders/${order.id}`}>
                        <Button
                          variant="primary"
                          size="xs"
                          className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1 text-xs"
                          aria-label={isRtl ? `عرض الطلب ${order.orderNumber}` : `View order ${order.orderNumber}`}
                        >
                          {isRtl ? 'عرض' : 'View'}
                        </Button>
                      </Link>
                      {user?.role === 'production' && order.status === 'pending' && (
                        <>
                          <Button
                            variant="success"
                            size="xs"
                            onClick={() => updateOrderStatus(order.id, 'approved')}
                            className="bg-green-500 hover:bg-green-600 text-white rounded-md px-2 py-1 text-xs"
                            disabled={submitting === order.id}
                            aria-label={isRtl ? `الموافقة على الطلب ${order.orderNumber}` : `Approve order ${order.orderNumber}`}
                          >
                            {submitting === order.id ? (isRtl ? 'جارٍ' : 'Loading') : isRtl ? 'موافقة' : 'Approve'}
                          </Button>
                          <Button
                            variant="danger"
                            size="xs"
                            onClick={() => updateOrderStatus(order.id, 'cancelled')}
                            className="bg-red-500 hover:bg-red-600 text-white rounded-md px-2 py-1 text-xs"
                            disabled={submitting === order.id}
                            aria-label={isRtl ? `إلغاء الطلب ${order.orderNumber}` : `Cancel order ${order.orderNumber}`}
                          >
                            {submitting === order.id ? (isRtl ? 'جارٍ' : 'Loading') : isRtl ? 'إلغاء' : 'Cancel'}
                          </Button>
                        </>
                      )}
                      {user?.role === 'production' && order.status === 'approved' && unassignedItems.length > 0 && (
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => openAssignModal(order)}
                          className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1 text-xs"
                          disabled={submitting === order.id}
                          aria-label={isRtl ? `تعيين الطلب ${order.orderNumber}` : `Assign order ${order.orderNumber}`}
                        >
                          {submitting === order.id ? (isRtl ? 'جارٍ' : 'Loading') : isRtl ? 'تعيين' : 'Assign'}
                        </Button>
                      )}
                      {user?.role === 'production' && order.status === 'completed' && (
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => updateOrderStatus(order.id, 'in_transit')}
                          className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1 text-xs"
                          disabled={submitting === order.id}
                          aria-label={isRtl ? `شحن الطلب ${order.orderNumber}` : `Ship order ${order.orderNumber}`}
                        >
                          {submitting === order.id ? (isRtl ? 'جارٍ' : 'Loading') : isRtl ? 'شحن' : 'Ship'}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {orders.length === 0 && (
          <div className="text-center py-4 text-gray-500 text-xs">
            {isRtl ? 'لا توجد طلبات' : 'No orders'}
          </div>
        )}
      </motion.div>
    );
  }
);

export default OrderTable;