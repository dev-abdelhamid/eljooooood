import React, { memo } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { Order, OrderStatus } from '../../types/types';
import { Button } from '../UI/Button';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Check, Package, Truck, AlertCircle } from 'lucide-react';

const STATUS_COLORS: Record<OrderStatus, { color: string; label: string; icon: React.FC }> = {
  [OrderStatus.Pending]: { color: 'bg-yellow-100 text-yellow-800', label: 'pending', icon: Clock },
  [OrderStatus.Approved]: { color: 'bg-teal-100 text-teal-800', label: 'approved', icon: Check },
  [OrderStatus.InProduction]: { color: 'bg-purple-100 text-purple-800', label: 'in_production', icon: Package },
  [OrderStatus.Completed]: { color: 'bg-green-100 text-green-800', label: 'completed', icon: Check },
  [OrderStatus.InTransit]: { color: 'bg-blue-100 text-blue-800', label: 'in_transit', icon: Truck },
  [OrderStatus.Delivered]: { color: 'bg-gray-100 text-gray-800', label: 'delivered', icon: Check },
  [OrderStatus.Cancelled]: { color: 'bg-red-100 text-red-800', label: 'cancelled', icon: AlertCircle },
};

const getFirstTwoWords = (name: string | undefined | null): string => {
  if (!name) return 'غير معروف';
  const words = name.trim().split(' ');
  return words.slice(0, 2).join(' ');
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
        className="overflow-x-auto rounded-lg shadow-md border border-gray-200"
        role="table"
        aria-label={t('orders.table_label')}
      >
        <table className="min-w-full divide-y divide-gray-200 table-auto bg-white">
          <thead className="bg-gray-50">
            <tr className={isRtl ? 'flex-row-reverse' : ''}>
              <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[5%]">
                {t('orders.table_index')}
              </th>
              <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[15%]">
                {t('orders.orderNumber')}
              </th>
              <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[15%]">
                {t('orders.status')}
              </th>
              <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[10%]">
                {t('orders.priority')}
              </th>
              <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[30%]">
                {t('orders.products')}
              </th>
              <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[15%]">
                {t('orders.totalAmount')}
              </th>
              <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[10%]">
                {t('orders.total_quantity')}
              </th>
              <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[15%]">
                {t('orders.date')}
              </th>
              <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[20%]">
                {t('orders.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((order, index) => {
              const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS[OrderStatus.Pending];
              const StatusIcon = statusInfo.icon;
              const unassignedItems = order.items.filter((item) => !item.assignedTo);
              return (
                <tr key={order.id} className={`hover:bg-gray-50 transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">{startIndex + index}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">{order.orderNumber}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-right">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusInfo.color} ${
                        isRtl ? 'flex-row-reverse' : ''
                      }`}
                    >
                      <StatusIcon className="w-4 h-4" />
                      {t(`orders.status_${statusInfo.label}`)}
                    </span>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">
                    {t(`orders.priority_${order.priority}`)}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600 text-right">
                    {order.items.map((item) => (
                      <p key={item._id} className="truncate">
                        {item.quantity} {t(`units.${item.unit || 'unit'}`)} {getFirstTwoWords(item.productName)}
                      </p>
                    ))}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">{calculateAdjustedTotal(order)}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">
                    {order.items.reduce((sum, item) => sum + (item.quantity || 0), 0)}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">{order.date}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-right">
                    <div className={`flex gap-2 ${isRtl ? 'justify-end' : 'justify-start'}`}>
                      <Link to={`/orders/${order.id}`}>
                        <Button
                          variant="primary"
                          size="sm"
                          className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-3 py-1 text-xs"
                          aria-label={t('orders.view_order', { orderNumber: order.orderNumber })}
                        >
                          {t('orders.view')}
                        </Button>
                      </Link>
                      {user?.role === 'production' && order.status === OrderStatus.Pending && (
                        <>
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => updateOrderStatus(order.id, OrderStatus.Approved)}
                            className="bg-green-500 hover:bg-green-600 text-white rounded-full px-3 py-1 text-xs"
                            disabled={submitting === order.id}
                            aria-label={t('orders.approve_order', { orderNumber: order.orderNumber })}
                          >
                            {submitting === order.id ? t('common.loading') : t('orders.approve')}
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => updateOrderStatus(order.id, OrderStatus.Cancelled)}
                            className="bg-red-500 hover:bg-red-600 text-white rounded-full px-3 py-1 text-xs"
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
                          size="sm"
                          onClick={() => openAssignModal(order)}
                          className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-3 py-1 text-xs"
                          disabled={submitting === order.id}
                          aria-label={t('orders.assign_order', { orderNumber: order.orderNumber })}
                        >
                          {submitting === order.id ? t('common.loading') : t('orders.assign')}
                        </Button>
                      )}
                      {user?.role === 'production' && order.status === OrderStatus.Completed && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => updateOrderStatus(order.id, OrderStatus.InTransit)}
                          className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-3 py-1 text-xs"
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
          <div className="text-center py-8 text-gray-500">{t('orders.no_orders')}</div>
        )}
      </motion.div>
    );
  }
);

export default OrderTable;