import React, { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '../UI/Button';
import { useAuth } from '../../contexts/AuthContext';
import { Order, OrderStatus } from '../../types/types';
import { Clock, Check, Package, Truck, AlertCircle } from 'lucide-react';

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
  t: (key: string, params?: any) => string;
}

const OrderTable: React.FC<OrderTableProps> = memo(
  ({ orders, calculateAdjustedTotal, calculateTotalQuantity, translateUnit, updateOrderStatus, onAssignChefs, submitting, isRtl, t }) => {
    const { user } = useAuth();
    const [expandedRows, setExpandedRows] = useState<string[]>([]);

    const toggleExpand = (orderId: string) => {
      setExpandedRows((prev) =>
        prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
      );
    };

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="overflow-x-auto rounded-lg shadow-md border border-gray-100 bg-white"
        role="table"
        aria-label={t('orders.table_label')}
      >
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50">
            <tr className={isRtl ? 'flex-row-reverse' : ''}>
              <th className="px-3 py-2 font-medium text-gray-600 uppercase tracking-wider text-center w-[60px]">{t('orders.table_headers.number')}</th>
              <th className="px-3 py-2 font-medium text-gray-600 uppercase tracking-wider text-center w-[120px]">{t('orders.table_headers.order_number')}</th>
              <th className="px-3 py-2 font-medium text-gray-600 uppercase tracking-wider text-center w-[120px]">{t('orders.table_headers.branch')}</th>
              <th className="px-3 py-2 font-medium text-gray-600 uppercase tracking-wider text-center w-[100px]">{t('orders.table_headers.priority')}</th>
              <th className="px-3 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[300px]">{t('orders.table_headers.products')}</th>
              <th className="px-3 py-2 font-medium text-gray-600 uppercase tracking-wider text-center w-[120px]">{t('orders.table_headers.status')}</th>
              <th className="px-3 py-2 font-medium text-gray-600 uppercase tracking-wider text-center w-[120px]">{t('orders.table_headers.total_amount')}</th>
              <th className="px-3 py-2 font-medium text-gray-600 uppercase tracking-wider text-center w-[100px]">{t('orders.table_headers.total_quantity')}</th>
              <th className="px-3 py-2 font-medium text-gray-600 uppercase tracking-wider text-center w-[120px]">{t('orders.table_headers.date')}</th>
              <th className="px-3 py-2 font-medium text-gray-600 uppercase tracking-wider text-center w-[200px]">{t('orders.table_headers.actions')}</th>
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
                  <td className="px-3 py-2 text-gray-600 text-center whitespace-nowrap">{index + 1}</td>
                  <td className="px-3 py-2 text-gray-600 text-center whitespace-nowrap">{order.orderNumber}</td>
                  <td className="px-3 py-2 text-gray-600 text-center truncate max-w-[120px]">{order.branchName}</td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 rounded-full text-sm font-medium ${PRIORITY_COLORS[order.priority]}`}>
                      {t(`orders.priorities.${order.priority}`)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600 text-center">
                    <div className="flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                      <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''} whitespace-nowrap`}>
                        {productsToShow.map((item) => (
                          <span key={item._id} className="inline-block px-2 py-1 bg-gray-50 rounded-md">
                            {`${item.quantity} ${translateUnit(item.unit, isRtl)} ${item.productName} (${t(`departments.${item.department?.name || 'unknown'}`)}${item.assignedTo ? `, ${t('orders.assigned_to', { name: item.assignedTo.name })}` : ''})`}
                          </span>
                        ))}
                        {!isExpanded && remaining > 0 && (
                          <button
                            onClick={() => toggleExpand(order.id)}
                            className="text-amber-600 hover:text-amber-700 text-sm font-medium px-2"
                            aria-label={t('orders.show_more_products', { count: remaining })}
                          >
                            {t('orders.show_more', { count: remaining })}
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 rounded-full text-sm font-medium items-center gap-1 ${statusInfo.color} ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <StatusIcon className="w-4 h-4" />
                      {t(`orders.statuses.${statusInfo.label}`)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600 text-center whitespace-nowrap">{calculateAdjustedTotal(order)}</td>
                  <td className="px-3 py-2 text-gray-600 text-center whitespace-nowrap">{calculateTotalQuantity(order)}</td>
                  <td className="px-3 py-2 text-gray-600 text-center whitespace-nowrap">{order.date}</td>
                  <td className="px-3 py-2 text-center">
                    <div className={`flex gap-2 ${isRtl ? 'justify-end flex-row-reverse' : 'justify-start'}`}>
                      <Link to={`/orders/${order.id}`}>
                        <Button
                          variant="primary"
                          size="xs"
                          className="bg-amber-500 hover:bg-amber-600 text-white rounded-full px-3 py-1 text-sm"
                          aria-label={t('orders.view_order', { orderNumber: order.orderNumber })}
                        >
                          {t('orders.view')}
                        </Button>
                      </Link>
                      {user?.role === 'production' && order.status === 'pending' && (
                        <>
                          <Button
                            variant="success"
                            size="xs"
                            onClick={() => updateOrderStatus(order.id, 'approved')}
                            className="bg-green-500 hover:bg-green-600 text-white rounded-full px-3 py-1 text-sm"
                            disabled={submitting === order.id}
                            aria-label={t('orders.approve_order', { orderNumber: order.orderNumber })}
                          >
                            {submitting === order.id ? t('common.loading') : t('orders.approve')}
                          </Button>
                          <Button
                            variant="danger"
                            size="xs"
                            onClick={() => updateOrderStatus(order.id, 'cancelled')}
                            className="bg-red-500 hover:bg-red-600 text-white rounded-full px-3 py-1 text-sm"
                            disabled={submitting === order.id}
                            aria-label={t('orders.cancel_order', { orderNumber: order.orderNumber })}
                          >
                            {submitting === order.id ? t('common.loading') : t('orders.cancel')}
                          </Button>
                        </>
                      )}
                      {user?.role === 'production' && order.status === 'approved' && unassignedItems.length > 0 && (
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => onAssignChefs(order)}
                          className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-3 py-1 text-sm"
                          disabled={submitting === order.id}
                          aria-label={t('orders.assign_order', { orderNumber: order.orderNumber })}
                        >
                          {submitting === order.id ? t('common.loading') : t('orders.assign')}
                        </Button>
                      )}
                      {user?.role === 'production' && order.status === 'completed' && (
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => updateOrderStatus(order.id, 'in_transit')}
                          className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-3 py-1 text-sm"
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
          <div className="text-center py-4 text-gray-500 text-sm">
            {t('orders.no_orders')}
          </div>
        )}
      </motion.div>
    );
  }
);

export default OrderTable;