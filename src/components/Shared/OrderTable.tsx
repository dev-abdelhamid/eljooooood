import React, { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '../UI/Button';
import { useAuth } from '../../contexts/AuthContext';
import { Order, OrderStatus } from '../../types/types';
import { Clock, Check, Package, Truck, AlertCircle } from 'lucide-react';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

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
  onAssignChefs: (order: Order) => void;
  submitting: string | null;
  isRtl: boolean;
  loading: boolean;
  startIndex: number;
}

const OrderTableSkeleton: React.FC<{ isRtl: boolean }> = ({ isRtl }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className="overflow-x-auto bg-white shadow-md rounded-lg border border-gray-100"
  >
    <table className="min-w-full">
      <thead>
        <tr className={isRtl ? 'flex-row-reverse' : ''}>
          {Array(8).fill(0).map((_, index) => (
            <th key={index} className="px-3 py-2">
              <Skeleton width={80} height={14} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array(5).fill(0).map((_, rowIndex) => (
          <tr
            key={rowIndex}
            className={`hover:bg-gray-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}
          >
            {Array(8).fill(0).map((_, cellIndex) => (
              <td key={cellIndex} className="px-3 py-2">
                <Skeleton width={100} height={14} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </motion.div>
);

const OrderTable: React.FC<OrderTableProps> = memo(
  ({ orders, calculateAdjustedTotal, calculateTotalQuantity, translateUnit, updateOrderStatus, onAssignChefs, submitting, isRtl, loading, startIndex }) => {
    const { user } = useAuth();

    const formatProducts = useMemo(() => (order: Order) => {
      return order.items
        .map(item => `(${item.quantity} ${translateUnit(item.unit, isRtl)} ${item.productName})`)
        .join(' + ');
    }, [isRtl, translateUnit]);

    if (loading) {
      return <OrderTableSkeleton isRtl={isRtl} />;
    }

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
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[40px]">
                {isRtl ? 'رقم' : 'No.'}
              </th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">
                {isRtl ? 'رقم الطلب' : 'Order Number'}
              </th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">
                {isRtl ? 'الفرع' : 'Branch'}
              </th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[80px]">
                {isRtl ? 'الحالة' : 'Status'}
              </th>
              <th className="px-2 py-2 font-medium text-gray-600  tracking-wider text-center ">
                {isRtl ? 'المنتجات' : 'Products'}
              </th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">
                {isRtl ? 'إجمالي المبلغ' : 'Total Amount'}
              </th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[80px]">
                {isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}
              </th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">
                {isRtl ? 'التاريخ' : 'Date'}
              </th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[120px]">
                {isRtl ? 'الإجراءات' : 'Actions'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-4 text-gray-500 text-xs">
                  {isRtl ? 'لا توجد طلبات' : 'No orders found'}
                </td>
              </tr>
            ) : (
              orders.map((order, index) => {
                const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS.pending;
                const StatusIcon = statusInfo.icon;
                const unassignedItems = useMemo(() => order.items.filter((item) => !item.assignedTo), [order.items]);

                return (
                  <tr key={order.id} className={`hover:bg-gray-50 transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <td className="px-2 py-2 text-gray-600 text-center whitespace-nowrap">{startIndex + index}</td>
                    <td className="px-2 py-2 text-gray-600 text-center truncate max-w-[100px]">{order.orderNumber}</td>
                    <td className="px-2 py-2 text-gray-600 text-center truncate max-w-[100px]">{order.branchName}</td>
                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium items-center gap-1 ${statusInfo.color} ${isRtl ? 'flex-row-reverse' : ''}`}>
                        <StatusIcon className="w-4 h-4" />
                        {isRtl
                          ? { pending: 'قيد الانتظار', approved: 'تم الموافقة', in_production: 'في الإنتاج', completed: 'مكتمل', in_transit: 'في النقل', delivered: 'تم التسليم', cancelled: 'ملغى' }[statusInfo.label]
                          : statusInfo.label}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-gray-600 text-center">
                      {formatProducts(order)}
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
                            aria-label={isRtl ? `عرض طلب رقم ${order.orderNumber}` : `View order #${order.orderNumber}`}
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
                              aria-label={isRtl ? `الموافقة على طلب رقم ${order.orderNumber}` : `Approve order #${order.orderNumber}`}
                            >
                              {submitting === order.id ? (isRtl ? 'جارٍ...' : 'Loading...') : (isRtl ? 'موافقة' : 'Approve')}
                            </Button>
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() => updateOrderStatus(order.id, 'cancelled')}
                              className="bg-red-500 hover:bg-red-600 text-white rounded-md px-2 py-1 text-xs"
                              disabled={submitting === order.id}
                              aria-label={isRtl ? `إلغاء طلب رقم ${order.orderNumber}` : `Cancel order #${order.orderNumber}`}
                            >
                              {submitting === order.id ? (isRtl ? 'جارٍ...' : 'Loading...') : (isRtl ? 'إلغاء' : 'Cancel')}
                            </Button>
                          </>
                        )}
                        {user?.role === 'production' && order.status === 'approved' && unassignedItems.length > 0 && (
                          <Button
                            variant="primary"
                            size="xs"
                            onClick={() => onAssignChefs(order)}
                            className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1 text-xs"
                            disabled={submitting === order.id}
                            aria-label={isRtl ? `تعيين طلب رقم ${order.orderNumber}` : `Assign order #${order.orderNumber}`}
                          >
                            {submitting === order.id ? (isRtl ? 'جارٍ...' : 'Loading...') : (isRtl ? 'توزيع' : 'Assign')}
                          </Button>
                        )}
                        {user?.role === 'production' && order.status === 'completed' && (
                          <Button
                            variant="primary"
                            size="xs"
                            onClick={() => updateOrderStatus(order.id, 'in_transit')}
                            className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1 text-xs"
                            disabled={submitting === order.id}
                            aria-label={isRtl ? `شحن طلب رقم ${order.orderNumber}` : `Ship order #${order.orderNumber}`}
                          >
                            {submitting === order.id ? (isRtl ? 'جارٍ...' : 'Loading...') : (isRtl ? 'شحن' : 'Ship')}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </motion.div>
    );
  }
);

export default OrderTable;