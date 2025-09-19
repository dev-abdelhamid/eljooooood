import React, { memo, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Order, OrderStatus, ItemStatus } from '../../types/types';
import { Button } from '../UI/Button';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Check, Package, Truck, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

const STATUS_COLORS: Record<OrderStatus, { color: string; label: string; icon: React.FC }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800', label: 'pending', icon: Clock },
  approved: { color: 'bg-teal-100 text-teal-800', label: 'approved', icon: Check },
  in_production: { color: 'bg-purple-100 text-purple-800', label: 'in_production', icon: Package },
  completed: { color: 'bg-green-100 text-green-800', label: 'completed', icon: Check },
  in_transit: { color: 'bg-blue-100 text-blue-800', label: 'in_transit', icon: Truck },
  delivered: { color: 'bg-gray-100 text-gray-800', label: 'delivered', icon: Check },
  cancelled: { color: 'bg-red-100 text-red-800', label: 'cancelled', icon: AlertCircle },
};

const ITEM_STATUS_COLORS: Record<ItemStatus, { label: string; color: string; icon: React.FC }> = {
  pending: { label: 'pending', color: 'bg-gray-50 text-gray-600', icon: Clock },
  assigned: { label: 'assigned', color: 'bg-blue-50 text-blue-600', icon: Check },
  in_progress: { label: 'in_progress', color: 'bg-yellow-50 text-yellow-600', icon: Package },
  completed: { label: 'completed', color: 'bg-green-50 text-green-600', icon: Check },
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
  openAssignModal: (order: Order) => void;
  submitting: string | null;
  isRtl: boolean;
  t: (key: string, params?: any) => string;
  startIndex: number;
}

const OrderTable: React.FC<OrderTableProps> = memo(
  ({ orders, calculateAdjustedTotal, calculateTotalQuantity, translateUnit, updateOrderStatus, openAssignModal, submitting, isRtl, t, startIndex }) => {
    const { user } = useAuth();
    const [expandedRows, setExpandedRows] = useState<string[]>([]);

    const toggleExpand = useCallback((orderId: string) => {
      setExpandedRows((prev) => (prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]));
    }, []);

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="overflow-x-auto rounded-lg shadow-md border border-gray-200 bg-white"
        role="table"
        aria-label={t('orders.table_label')}
      >
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr className={isRtl ? 'flex-row-reverse' : ''}>
              <th className="px-4 py-3 font-semibold text-gray-700 uppercase tracking-wider text-center min-w-[50px]">{t('orders.table_headers.number')}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 uppercase tracking-wider text-center min-w-[120px]">{t('orders.table_headers.order_number')}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 uppercase tracking-wider text-center min-w-[120px]">{t('orders.table_headers.branch')}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 uppercase tracking-wider text-center min-w-[100px]">{t('orders.table_headers.status')}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 uppercase tracking-wider text-center min-w-[100px]">{t('orders.table_headers.priority')}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 uppercase tracking-wider text-center min-w-[250px]">{t('orders.table_headers.products')}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 uppercase tracking-wider text-center min-w-[200px]">{t('orders.table_headers.chefs')}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 uppercase tracking-wider text-center min-w-[120px]">{t('orders.table_headers.total_amount')}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 uppercase tracking-wider text-center min-w-[120px]">{t('orders.table_headers.total_quantity')}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 uppercase tracking-wider text-center min-w-[120px]">{t('orders.table_headers.date')}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 uppercase tracking-wider text-center min-w-[150px]">{t('orders.table_headers.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {orders.map((order, index) => {
              const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS.pending;
              const StatusIcon = statusInfo.icon;
              const unassignedItems = order.items.filter((item) => !item.assignedTo);
              const isExpanded = expandedRows.includes(order.id);
              const productsToShow = isExpanded ? order.items : order.items.slice(0, 3);
              const remaining = order.items.length - 3;

              return (
                <tr key={order.id} className={`hover:bg-gray-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-4 py-3 text-gray-800 text-center whitespace-nowrap">{startIndex + index}</td>
                  <td className="px-4 py-3 text-gray-800 text-center truncate max-w-[120px]">{order.orderNumber}</td>
                  <td className="px-4 py-3 text-gray-800 text-center truncate max-w-[120px]">{order.branchName}</td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium items-center gap-2 ${statusInfo.color} ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <StatusIcon className="w-4 h-4" />
                      {t(`orders.statuses.${statusInfo.label}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${PRIORITY_COLORS[order.priority]}`}>
                      {t(`orders.priorities.${order.priority}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-800 text-center">
                    <div className="flex flex-col items-center max-w-[250px]">
                      {productsToShow.map((item, idx) => (
                        <div key={item._id} className="flex items-center justify-between w-full py-1">
                          <span className="truncate flex-1">
                            {`${item.quantity} ${translateUnit(item.unit, isRtl)} ${item.productName}`}
                          </span>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium items-center gap-1 ${ITEM_STATUS_COLORS[item.status].color} ${isRtl ? 'flex-row-reverse' : ''}`}>
                            <ITEM_STATUS_COLORS[item.status].icon className="w-3 h-3" />
                            {t(`orders.item_statuses.${ITEM_STATUS_COLORS[item.status].label}`)}
                          </span>
                        </div>
                      ))}
                      {!isExpanded && remaining > 0 && (
                        <button
                          onClick={() => toggleExpand(order.id)}
                          className="text-blue-600 text-sm hover:underline mt-1"
                          aria-expanded={isExpanded}
                          aria-controls={`products-${order.id}`}
                        >
                          {t('orders.more_items', { count: remaining })}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-800 text-center">
                    <div className="flex flex-col items-center max-w-[200px] gap-1">
                      {order.items
                        .filter((item) => item.assignedTo)
                        .map((item) => (
                          <span
                            key={item._id}
                            className="inline-block truncate bg-blue-50 px-3 py-1 rounded-lg text-blue-700 text-sm"
                          >
                            {item.assignedTo?.name || (isRtl ? 'غير معروف' : 'Unknown')} ({item.department?.name || (isRtl ? 'غير معروف' : 'Unknown')})
                          </span>
                        ))}
                      {unassignedItems.length > 0 && (
                        <span className="inline-block truncate bg-yellow-50 px-3 py-1 rounded-lg text-yellow-700 text-sm">
                          {t('orders.unassigned_items', { count: unassignedItems.length })}
                        </span>
                      )}
                      {order.items.every((item) => !item.assignedTo) && (
                        <span className="text-gray-600 text-sm">{t('orders.no_chefs_assigned')}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-800 text-center truncate">{calculateAdjustedTotal(order)}</td>
                  <td className="px-4 py-3 text-gray-800 text-center">{calculateTotalQuantity(order)}</td>
                  <td className="px-4 py-3 text-gray-800 text-center truncate">{order.date}</td>
                  <td className="px-4 py-3 text-center">
                    <div className={`flex gap-2 flex-wrap ${isRtl ? 'justify-end' : 'justify-start'}`}>
                      <Link to={`/orders/${order.id}`}>
                        <Button
                          variant="primary"
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-3 py-1 text-sm"
                          aria-label={t('orders.view_order', { orderNumber: order.orderNumber })}
                        >
                          {t('orders.view')}
                        </Button>
                      </Link>
                      {user?.role === 'production' && order.status === 'pending' && (
                        <>
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => updateOrderStatus(order.id, 'approved')}
                            className="bg-green-600 hover:bg-green-700 text-white rounded-full px-3 py-1 text-sm"
                            disabled={submitting === order.id}
                            aria-label={t('orders.approve_order', { orderNumber: order.orderNumber })}
                          >
                            {submitting === order.id ? t('common.loading') : t('orders.approve')}
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => updateOrderStatus(order.id, 'cancelled')}
                            className="bg-red-600 hover:bg-red-700 text-white rounded-full px-3 py-1 text-sm"
                            disabled={submitting === order.id}
                            aria-label={t('orders.cancel_order', { orderNumber: order.id })}
                          >
                            {submitting === order.id ? t('common.loading') : t('orders.cancel')}
                          </Button>
                        </>
                      )}
                      {user?.role === 'production' && order.status === 'approved' && unassignedItems.length > 0 && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => openAssignModal(order)}
                          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-3 py-1 text-sm"
                          disabled={submitting === order.id}
                          aria-label={t('orders.assign_order', { orderNumber: order.orderNumber })}
                        >
                          {submitting === order.id ? t('common.loading') : t('orders.assign')}
                        </Button>
                      )}
                      {user?.role === 'production' && order.status === 'completed' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => updateOrderStatus(order.id, 'in_transit')}
                          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-3 py-1 text-sm"
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
          <div className="text-center py-6 text-gray-600 text-sm">
            {t('orders.no_orders')}
          </div>
        )}
      </motion.div>
    );
  }
);

export default OrderTable;