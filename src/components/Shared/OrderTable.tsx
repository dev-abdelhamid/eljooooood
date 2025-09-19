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
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  onAssignChefs: (order: Order) => void;
  submitting: string | null;
  isRtl: boolean;
  t: (key: string, params?: any) => string;
  startIndex: number;
}

const OrderTable: React.FC<OrderTableProps> = memo(
  ({ orders, calculateAdjustedTotal, calculateTotalQuantity, translateUnit, updateOrderStatus, onAssignChefs, submitting, isRtl, t, startIndex }) => {
    const { user } = useAuth();
    const [expandedRows, setExpandedRows] = useState<string[]>([]);

    const toggleExpand = (orderId: string) => {
      setExpandedRows(prev => (prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]));
    };

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="overflow-x-auto rounded-md shadow-md border border-gray-100 bg-white"
        role="table"
        aria-label={t('orders.table_label')}
      >
        <table className="min-w-full divide-y divide-gray-100 text-xs">
          <thead className="bg-gray-50">
            <tr className={isRtl ? 'flex-row-reverse' : ''}>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[40px]">{t('orders.table_headers.number')}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">{t('orders.table_headers.order_number')}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">{t('orders.table_headers.branch')}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[80px]">{t('orders.table_headers.status')}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[80px]">{t('orders.table_headers.priority')}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[200px]">{t('orders.table_headers.products')}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[150px]">{t('orders.table_headers.chefs')}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">{t('orders.table_headers.total_amount')}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[80px]">{t('orders.table_headers.total_quantity')}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">{t('orders.table_headers.date')}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[120px]">{t('orders.table_headers.actions')}</th>
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
                  <td className="px-2 py-2 text-center whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium items-center gap-1 ${statusInfo.color} ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <StatusIcon className="w-4 h-4" />
                      {t(`orders.statuses.${statusInfo.label}`)}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${PRIORITY_COLORS[order.priority]}`}>
                      {t(`orders.priorities.${order.priority}`)}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-gray-600 text-center">
                    <div className="flex overflow-x-auto max-w-[200px] whitespace-nowrap scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100" onClick={() => toggleExpand(order.id)}>
                      {productsToShow.map((item, idx) => (
                        <span key={item._id} className="inline-block mx-1 truncate">
                          {`${item.quantity} ${translateUnit(item.unit, isRtl)} ${item.productName}${idx < productsToShow.length - 1 ? ',' : ''}`}
                        </span>
                      ))}
                      {!isExpanded && remaining > 0 && (
                        <span className="text-blue-500 cursor-pointer mx-1" onClick={() => toggleExpand(order.id)}>
                          {t('orders.more_items', { count: remaining })}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-gray-600 text-center">
                    <div className="flex overflow-x-auto max-w-[150px] whitespace-nowrap scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                      {order.items
                        .filter(item => item.assignedTo)
                        .map(item => (
                          <span
                            key={item._id}
                            className="inline-block mx-1 truncate bg-blue-50 px-2 py-1 rounded-md text-blue-600"
                          >
                            {item.assignedTo?.name || (isRtl ? 'غير معروف' : 'Unknown')}
                          </span>
                        ))}
                      {order.items.every(item => !item.assignedTo) && (
                        <span className="text-gray-500">{t('orders.no_chefs_assigned')}</span>
                      )}
                    </div>
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
                            className="bg-green-500 hover:bg-green-600 text-white rounded-md px-2 py-1 text-xs"
                            disabled={submitting === order.id}
                            aria-label={t('orders.approve_order', { orderNumber: order.orderNumber })}
                          >
                            {submitting === order.id ? t('common.loading') : t('orders.approve')}
                          </Button>
                          <Button
                            variant="danger"
                            size="xs"
                            onClick={() => updateOrderStatus(order.id, 'cancelled')}
                            className="bg-red-500 hover:bg-red-600 text-white rounded-md px-2 py-1 text-xs"
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
                          className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1 text-xs"
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
                          className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1 text-xs"
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
          <div className="text-center py-4 text-gray-500 text-xs">
            {t('orders.no_orders')}
          </div>
        )}
      </motion.div>
    );
  }
);

export default OrderTable;