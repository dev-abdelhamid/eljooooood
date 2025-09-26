
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
  startIndex: number;
  user: any;
  onNavigateToDetails: (orderId: string) => void;
  t: (key: string) => string;
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
          {Array(10).fill(0).map((_, index) => (
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
            {Array(10).fill(0).map((_, cellIndex) => (
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
  ({ orders, calculateAdjustedTotal, calculateTotalQuantity, translateUnit, updateOrderStatus, openAssignModal, submitting, isRtl, startIndex, user, onNavigateToDetails, t }) => {
    const formatProducts = useMemo(() => (order: Order) => {
      return order.items
        .map(item => `(${item.quantity.toLocaleString(isRtl ? 'ar-SA' : 'en-US')} ${translateUnit(item.unit, isRtl)} ${item.displayName || item.productName})`)
        .join(' + ');
    }, [isRtl, translateUnit]);

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
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[40px]">
                {t('orders.number')}
              </th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">
                {t('orders.order_number')}
              </th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">
                {t('orders.branch')}
              </th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[80px]">
                {t('orders.status')}
              </th>
              <th className="px-2 py-2 font-medium text-gray-600 tracking-wider text-center">
                {t('orders.products')}
              </th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">
                {t('orders.total_amount')}
              </th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[80px]">
                {t('orders.total_quantity')}
              </th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">
                {t('orders.date')}
              </th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[120px]">
                {t('orders.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-4 text-gray-500 text-xs">
                  {t('orders.no_orders')}
                </td>
              </tr>
            ) : (
              orders.map((order, index) => {
                const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS.pending;
                const StatusIcon = statusInfo.icon;
                const unassignedItems = useMemo(() => order.items.filter((item) => !item.assignedTo), [order.items]);

                return (
                  <tr key={order.id} className={`hover:bg-gray-50 transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <td className="px-2 py-2 text-gray-600 text-center whitespace-nowrap">{(startIndex + index).toLocaleString(isRtl ? 'ar-SA' : 'en-US')}</td>
                    <td className="px-2 py-2 text-gray-600 text-center truncate max-w-[100px]">{order.orderNumber.toLocaleString(isRtl ? 'ar-SA' : 'en-US')}</td>
                    <td className="px-2 py-2 text-gray-600 text-center truncate max-w-[100px]">{order.displayBranchName || order.branchName}</td>
                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium items-center gap-1 ${statusInfo.color} ${isRtl ? 'flex-row-reverse' : ''}`}>
                        <StatusIcon className="w-4 h-4" />
                        {t(`orders.status_${order.status}`)}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-gray-600 text-center">{formatProducts(order)}</td>
                    <td className="px-2 py-2 text-gray-600 text-center truncate">{calculateAdjustedTotal(order)}</td>
                    <td className="px-2 py-2 text-gray-600 text-center">{calculateTotalQuantity(order).toLocaleString(isRtl ? 'ar-SA' : 'en-US')}</td>
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
                            onClick={() => openAssignModal(order)}
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
              })
            )}
          </tbody>
        </table>
      </motion.div>
    );
  }
);

export default OrderTable;