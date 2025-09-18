import React, { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '../UI/Button';
import { Order, OrderStatus } from '../../types';
import { ChefHat } from 'lucide-react';

const STATUS_COLORS: Record<OrderStatus, { color: string; label: string }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800', label: 'pending' },
  approved: { color: 'bg-teal-100 text-teal-800', label: 'approved' },
  in_production: { color: 'bg-purple-100 text-purple-800', label: 'in_production' },
  completed: { color: 'bg-green-100 text-green-800', label: 'completed' },
  in_transit: { color: 'bg-blue-100 text-blue-800', label: 'in_transit' },
  delivered: { color: 'bg-gray-100 text-gray-800', label: 'delivered' },
  cancelled: { color: 'bg-red-100 text-red-800', label: 'cancelled' },
};

const PRIORITY_COLORS: Record<Order['priority'], string> = {
  urgent: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-white',
  low: 'bg-green-500 text-white',
};

interface OrderTableProps {
  orders: Order[];
  t: (key: string, params?: any) => string;
  isRtl: boolean;
  calculateAdjustedTotal: (order: Order) => string;
  calculateTotalQuantity: (order: Order) => number;
  startIndex: number;
  updateOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
  openAssignModal: (order: Order) => void;
  user: any;
  submitting: string | null;
}

const OrderTable: React.FC<OrderTableProps> = memo(
  ({ orders, t, isRtl, calculateAdjustedTotal, calculateTotalQuantity, startIndex, updateOrderStatus, openAssignModal, user, submitting }) => {
    const getFirstTwoWords = useCallback((name: string | undefined | null): string => {
      if (!name) return isRtl ? 'غير معروف' : 'Unknown';
      const words = name.trim().split(' ');
      return words.slice(0, 2).join(' ');
    }, [isRtl]);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-x-auto bg-white shadow-md rounded-lg border border-gray-100"
      >
        <table className="min-w-full">
          <thead>
            <tr className={isRtl ? 'flex-row-reverse' : ''}>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 text-left">{t('orders.orderNumber') || (isRtl ? 'رقم الطلب' : 'Order Number')}</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 text-left">{t('orders.branchName') || (isRtl ? 'الفرع' : 'Branch')}</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 text-left">{t('orders.status') || (isRtl ? 'الحالة' : 'Status')}</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 text-left">{t('orders.priority') || (isRtl ? 'الأولوية' : 'Priority')}</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 text-left">{t('orders.totalProducts') || (isRtl ? 'إجمالي المنتجات' : 'Total Products')}</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 text-left">{t('orders.totalAmount') || (isRtl ? 'إجمالي المبلغ' : 'Total Amount')}</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 text-left">{t('orders.date') || (isRtl ? 'التاريخ' : 'Date')}</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 text-left">{t('orders.actions') || (isRtl ? 'الإجراءات' : 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order, index) => {
              const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS.pending;
              const unassignedItems = order.items.filter(item => !item.assignedTo);
              return (
                <tr
                  key={order.id}
                  className={`hover:bg-gray-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}
                >
                  <td className="px-3 py-2 text-xs text-gray-800">{order.orderNumber}</td>
                  <td className="px-3 py-2 text-xs text-gray-800">{order.branchName}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                      {t(`orders.status_${statusInfo.label}`) || (isRtl
                        ? {
                            pending: 'معلق',
                            approved: 'معتمد',
                            in_production: 'قيد الإنتاج',
                            completed: 'مكتمل',
                            in_transit: 'في النقل',
                            delivered: 'تم التسليم',
                            cancelled: 'ملغى',
                          }[order.status]
                        : statusInfo.label)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${PRIORITY_COLORS[order.priority]}`}>
                      {t(`orders.priority_${order.priority}`) || (isRtl
                        ? {
                            urgent: 'عاجل',
                            high: 'عالي',
                            medium: 'متوسط',
                            low: 'منخفض',
                          }[order.priority]
                        : order.priority)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-800">{calculateTotalQuantity(order)}</td>
                  <td className="px-3 py-2 text-xs text-gray-800">{calculateAdjustedTotal(order)}</td>
                  <td className="px-3 py-2 text-xs text-gray-800">{order.date}</td>
                  <td className="px-3 py-2">
                    <div className={`flex gap-1 flex-wrap ${isRtl ? 'justify-end' : 'justify-start'}`}>
                      <Link to={`/orders/${order.id}`}>
                        <Button
                          variant="primary"
                          size="xs"
                          className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1 text-xs"
                          aria-label={t('orders.view_order', { orderNumber: order.orderNumber }) || (isRtl ? `عرض الطلب ${order.orderNumber}` : `View order ${order.orderNumber}`)}
                        >
                          {t('common.view') || (isRtl ? 'عرض' : 'View')}
                        </Button>
                      </Link>
                      {user?.role === 'production' && ['pending', 'approved', 'in_production', 'completed'].includes(order.status) && (
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => openAssignModal(order)}
                          className="bg-amber-500 hover:bg-amber-600 text-white rounded-md px-2 py-1 text-xs"
                          disabled={submitting === order.id}
                          aria-label={t('orders.assign_chefs', { orderNumber: order.orderNumber }) || (isRtl ? `تعيين شيفات للطلب ${order.orderNumber}` : `Assign chefs to order ${order.orderNumber}`)}
                        >
                          <ChefHat className="w-3 h-3 mr-1" />
                          {t('orders.assign') || (isRtl ? 'تعيين' : 'Assign')}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </motion.div>
    );
  }
);

export default OrderTable;