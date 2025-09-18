import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '../UI/Button';
import { useAuth } from '../../contexts/AuthContext';
import { Order, OrderStatus } from '../../types';
import { Clock, Check, Package, Truck, AlertCircle } from 'lucide-react';

const STATUS_COLORS: Record<OrderStatus, { color: string; label: string; icon: React.FC }> = {
  [OrderStatus.Pending]: { color: 'bg-yellow-100 text-yellow-700', label: 'pending', icon: Clock },
  [OrderStatus.Approved]: { color: 'bg-teal-100 text-teal-700', label: 'approved', icon: Check },
  [OrderStatus.InProduction]: { color: 'bg-purple-100 text-purple-700', label: 'in_production', icon: Package },
  [OrderStatus.Completed]: { color: 'bg-green-100 text-green-700', label: 'completed', icon: Check },
  [OrderStatus.InTransit]: { color: 'bg-blue-100 text-blue-700', label: 'in_transit', icon: Truck },
  [OrderStatus.Delivered]: { color: 'bg-gray-100 text-gray-700', label: 'delivered', icon: Check },
  [OrderStatus.Cancelled]: { color: 'bg-red-100 text-red-700', label: 'cancelled', icon: AlertCircle },
};

interface OrderTableProps {
  orders: Order[];
  calculateAdjustedTotal: (order: Order) => string;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  openAssignModal: (order: Order) => void;
  startIndex: number;
  submitting: string | null;
  t: (key: string, params?: any) => string;
  isRtl: boolean;
}

const OrderTable: React.FC<OrderTableProps> = memo(
  ({ orders, calculateAdjustedTotal, updateOrderStatus, openAssignModal, startIndex, submitting, t, isRtl }) => {
    const { user } = useAuth();

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="overflow-x-auto rounded-md shadow-md border border-gray-200 bg-white"
        role="table"
        aria-label={t('orders.table_label')}
      >
        <table className="min-w-full divide-y divide-gray-200 text-xs">
          <thead className="bg-gray-50">
            <tr className={isRtl ? 'flex-row-reverse' : ''}>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center w-[5%]">{t('orders.table_index')}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center w-[15%]">{t('orders.orderNumber')}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center w-[15%]">{t('orders.status')}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center w-[10%]">{t('orders.priority')}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center w-[20%]">{t('orders.products')}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center w-[15%]">{t('orders.totalAmount')}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center w-[10%]">{t('orders.total_quantity')}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center w-[15%]">{t('orders.date')}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center w-[20%]">{t('orders.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((order, index) => {
              const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS[OrderStatus.Pending];
              const StatusIcon = statusInfo.icon;
              const unassignedItems = order.items.filter((item) => !item.assignedTo);
              return (
                <tr key={order.id} className={`hover:bg-gray-50 transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-2 py-2 text-gray-600 text-center">{startIndex + index}</td>
                  <td className="px-2 py-2 text-gray-600 text-center">{order.orderNumber}</td>
                  <td className="px-2 py-2 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center justify-center gap-1 ${statusInfo.color} ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <StatusIcon className="w-4 h-4" />
                      {t(`orders.status_${statusInfo.label}`)}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-gray-600 text-center">{t(`orders.priority_${order.priority}`)}</td>
                  <td className="px-2 py-2 text-gray-600 text-center">
                    {order.items.slice(0, 2).map((item) => (
                      <p key={item._id} className="truncate">{item.quantity} {t(`units.${item.unit || 'unit'}`)} {item.productName}</p>
                    ))}
                    {order.items.length > 2 && <p className="text-gray-500">+{order.items.length - 2} {t('orders.more')}</p>}
                  </td>
                  <td className="px-2 py-2 text-gray-600 text-center">{calculateAdjustedTotal(order)}</td>
                  <td className="px-2 py-2 text-gray-600 text-center">{order.items.reduce((sum, item) => sum + (item.quantity || 0), 0)}</td>
                  <td className="px-2 py-2 text-gray-600 text-center">{order.date}</td>
                  <td className="px-2 py-2 text-center">
                    <div className={`flex gap-1 flex-wrap ${isRtl ? 'justify-end' : 'justify-start'}`}>
                      <Link to={`/orders/${order.id}`}>
                        <Button
                          variant="primary"
                          size="xs"
                          className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1"
                          aria-label={t('orders.view_order', { orderNumber: order.orderNumber })}
                        >
                          {t('orders.view')}
                        </Button>
                      </Link>
                      {user?.role === 'production' && order.status === OrderStatus.Pending && (
                        <>
                          <Button
                            variant="success"
                            size="xs"
                            onClick={() => updateOrderStatus(order.id, OrderStatus.Approved)}
                            className="bg-green-500 hover:bg-green-600 text-white rounded-md px-2 py-1"
                            disabled={submitting === order.id}
                            aria-label={t('orders.approve_order', { orderNumber: order.orderNumber })}
                          >
                            {submitting === order.id ? t('common.loading') : t('orders.approve')}
                          </Button>
                          <Button
                            variant="danger"
                            size="xs"
                            onClick={() => updateOrderStatus(order.id, OrderStatus.Cancelled)}
                            className="bg-red-500 hover:bg-red-600 text-white rounded-md px-2 py-1"
                            disabled={submitting === order.id}
                            aria-label={t('orders.cancel_order', { orderNumber: order.orderNumber })}
                          >
                            {submitting === order.id ? t('common.loading') : t('orders.cancel')}
                          </Button>
                        </>
                      )}
                      {user?.role === 'production' && order.status === OrderStatus.Approved && unassignedItems.length > 0 && (
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => openAssignModal(order)}
                          className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1"
                          disabled={submitting === order.id}
                          aria-label={t('orders.assign_order', { orderNumber: order.orderNumber })}
                        >
                          {submitting === order.id ? t('common.loading') : t('orders.assign')}
                        </Button>
                      )}
                      {user?.role === 'production' && order.status === OrderStatus.Completed && (
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => updateOrderStatus(order.id, OrderStatus.InTransit)}
                          className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1"
                          disabled={submitting === order.id}
                          aria-label={t('orders.ship_order', { orderNumber: order.orderNumber })}
                        >
                          {submitting === order.id ? t('common.loading') : t('orders.ship')}
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
          <div className="text-center py-4 text-gray-500 text-xs">{t('orders.no_orders')}</div>
        )}
      </motion.div>
    );
  }
);

export default OrderTable;