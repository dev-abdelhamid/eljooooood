import React, { memo } from 'react';
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
        className="overflow-x-auto rounded-md shadow-md border border-gray-100 bg-white"
        role="table"
        aria-label={t('orders.table_label') || (isRtl ? 'جدول الطلبات' : 'Orders Table')}
      >
        <table className="min-w-full divide-y divide-gray-100 text-xs">
          <thead className="bg-gray-50">
            <tr className={isRtl ? 'flex-row-reverse' : ''}>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[40px]">{t('orders.table_index') || (isRtl ? 'رقم' : 'No.')}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">{t('orders.orderNumber') || (isRtl ? 'رقم الطلب' : 'Order Number')}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">{t('orders.branchName') || (isRtl ? 'الفرع' : 'Branch')}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">{t('orders.status') || (isRtl ? 'الحالة' : 'Status')}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[80px]">{t('orders.priority') || (isRtl ? 'الأولوية' : 'Priority')}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[120px]">{t('orders.products') || (isRtl ? 'المنتجات' : 'Products')}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">{t('orders.totalAmount') || (isRtl ? 'إجمالي المبلغ' : 'Total Amount')}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[80px]">{t('orders.total_quantity') || (isRtl ? 'الكمية الإجمالية' : 'Total Quantity')}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">{t('orders.date') || (isRtl ? 'التاريخ' : 'Date')}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[120px]">{t('orders.actions') || (isRtl ? 'الإجراءات' : 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((order, index) => {
              const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS.pending;
              const StatusIcon = statusInfo.icon;
              const unassignedItems = order.items.filter((item) => !item.assignedTo);
              return (
                <tr key={order.id} className={`hover:bg-gray-50 transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-2 py-2 text-gray-600 text-center whitespace-nowrap">{startIndex + index}</td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate max-w-[100px]">{order.orderNumber}</td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate max-w-[100px]">{order.branchName}</td>
                  <td className="px-2 py-2 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center justify-center gap-1 ${statusInfo.color} ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <StatusIcon className="w-4 h-4" />
                      {t(`orders.status_${statusInfo.label}`) || statusInfo.label}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate">{t(`orders.priority_${order.priority}`) || order.priority}</td>
                  <td className="px-2 py-2 text-gray-600 text-center">
                    {order.items.slice(0, 2).map((item) => (
                      <p key={item._id} className="truncate">{`${item.quantity} ${t(`units.${item.unit || 'unit'}`)} ${item.productName}`}</p>
                    ))}
                    {order.items.length > 2 && (
                      <p className="text-gray-500 truncate">+{order.items.length - 2} {t('orders.more') || (isRtl ? 'أخرى' : 'more')}</p>
                    )}
                  </td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate">{calculateAdjustedTotal(order)}</td>
                  <td className="px-2 py-2 text-gray-600 text-center">{order.items.reduce((sum, item) => sum + (item.quantity || 0), 0)}</td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate">{order.date}</td>
                  <td className="px-2 py-2 text-center">
                    <div className={`flex gap-1 flex-wrap ${isRtl ? 'justify-end' : 'justify-start'}`}>
                      <Link to={`/orders/${order.id}`}>
                        <Button
                          variant="primary"
                          size="xs"
                          className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1 text-xs"
                          aria-label={t('orders.view_order', { orderNumber: order.orderNumber }) || `View order ${order.orderNumber}`}
                        >
                          {t('orders.view') || (isRtl ? 'عرض' : 'View')}
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
                            aria-label={t('orders.approve_order', { orderNumber: order.orderNumber }) || `Approve order ${order.orderNumber}`}
                          >
                            {submitting === order.id ? t('common.loading') || (isRtl ? 'جارٍ التحميل' : 'Loading') : t('orders.approve') || (isRtl ? 'موافقة' : 'Approve')}
                          </Button>
                          <Button
                            variant="danger"
                            size="xs"
                            onClick={() => updateOrderStatus(order.id, 'cancelled')}
                            className="bg-red-500 hover:bg-red-600 text-white rounded-md px-2 py-1 text-xs"
                            disabled={submitting === order.id}
                            aria-label={t('orders.cancel_order', { orderNumber: order.orderNumber }) || `Cancel order ${order.orderNumber}`}
                          >
                            {submitting === order.id ? t('common.loading') || (isRtl ? 'جارٍ التحميل' : 'Loading') : t('orders.cancel') || (isRtl ? 'إلغاء' : 'Cancel')}
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
                          aria-label={t('orders.assign_order', { orderNumber: order.orderNumber }) || `Assign order ${order.orderNumber}`}
                        >
                          {submitting === order.id ? t('common.loading') || (isRtl ? 'جارٍ التحميل' : 'Loading') : t('orders.assign') || (isRtl ? 'تعيين' : 'Assign')}
                        </Button>
                      )}
                      {user?.role === 'production' && order.status === 'completed' && (
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => updateOrderStatus(order.id, 'in_transit')}
                          className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1 text-xs"
                          disabled={submitting === order.id}
                          aria-label={t('orders.ship_order', { orderNumber: order.orderNumber }) || `Ship order ${order.orderNumber}`}
                        >
                          {submitting === order.id ? t('common.loading') || (isRtl ? 'جارٍ التحميل' : 'Loading') : t('orders.ship') || (isRtl ? 'شحن' : 'Ship')}
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
            {t('orders.no_orders') || (isRtl ? 'لا توجد طلبات' : 'No orders')}
          </div>
        )}
      </motion.div>
    );
  }
);

export default OrderTable;