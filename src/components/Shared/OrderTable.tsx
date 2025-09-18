
import React, { memo, useMemo } from 'react';
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
  t: (key: string, params?: any) => string;
  isRtl: boolean;
  calculateAdjustedTotal: (order: Order) => string;
  calculateTotalQuantity: (order: Order) => number;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  openAssignModal: (order: Order) => void;
  startIndex: number;
  submitting: string | null;
  user: any;
}

const getFirstTwoWords = (str: string) => {
  const words = str.trim().split(/\s+/);
  return words.length > 1 ? words.slice(0, 2).join(' ') : str;
};

const OrderTable: React.FC<OrderTableProps> = memo(
  ({ orders, t, isRtl, calculateAdjustedTotal, calculateTotalQuantity, updateOrderStatus, openAssignModal, startIndex, submitting, user }) => {
    // عرض المنتجات في سطر واحد
    const renderProducts = useMemo(
      () => (order: Order) => {
        return order.items
          .map(item => `(${item.quantity} ${t(`units.${item.unit || 'unit'}`)} ${getFirstTwoWords(item.productName)})`)
          .join(' + ');
      },
      [t]
    );

    // عرض المرتجعات الموافق عليها فقط بنفس صيغة المنتجات
    const renderReturns = useMemo(
      () => (order: Order) => {
        const approvedReturns = order.returns.filter(r => r.status === 'approved');
        if (!approvedReturns.length) {
          return t('orders.no_returns') || (isRtl ? 'لا توجد مرتجعات' : 'No Returns');
        }
        return approvedReturns
          .flatMap(r =>
            r.items.map(item => {
              const orderItem = order.items.find(i => i.productId === item.productId);
              return `(${item.quantity} ${t(`units.${item.unit || 'unit'}`)} ${orderItem ? getFirstTwoWords(orderItem.productName) : 'Unknown'})`;
            })
          )
          .join(' + ');
      },
      [t, isRtl]
    );

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="overflow-x-auto rounded-md shadow-md border border-gray-100 bg-white"
        role="table"
        aria-label={t('orders.table') || (isRtl ? 'جدول الطلبات' : 'Orders Table')}
      >
        <table className="min-w-full divide-y divide-gray-100 text-xs">
          <thead className="bg-gray-50">
            <tr className={isRtl ? 'flex-row-reverse' : ''}>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[40px]">
                {t('orders.no') || (isRtl ? 'رقم' : 'No.')}
              </th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">
                {t('orders.orderNumber') || (isRtl ? 'رقم الطلب' : 'Order Number')}
              </th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">
                {t('orders.branchName') || (isRtl ? 'الفرع' : 'Branch')}
              </th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">
                {t('orders.status') || (isRtl ? 'الحالة' : 'Status')}
              </th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[80px]">
                {t('orders.priority') || (isRtl ? 'الأولوية' : 'Priority')}
              </th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[200px]">
                {t('orders.products') || (isRtl ? 'المنتجات' : 'Products')}
              </th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[150px]">
                {t('orders.returns') || (isRtl ? 'المرتجعات' : 'Returns')}
              </th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">
                {t('orders.totalAmount') || (isRtl ? 'الإجمالي' : 'Total Amount')}
              </th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[80px]">
                {t('orders.items_count') || (isRtl ? 'عدد العناصر' : 'Items Count')}
              </th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[120px]">
                {t('orders.actions') || (isRtl ? 'الإجراءات' : 'Actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((order, index) => {
              const StatusIcon = STATUS_COLORS[order.status].icon;
              return (
                <tr
                  key={order.id}
                  className={`hover:bg-gray-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}
                >
                  <td className="px-2 py-2 text-center text-gray-600">{startIndex + index}</td>
                  <td className="px-2 py-2 text-center">
                    <Link
                      to={`/orders/${order.id}`}
                      className="text-amber-600 hover:text-amber-800 font-medium"
                      aria-label={`${t('orders.view_order')} ${order.orderNumber}`}
                    >
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-center text-gray-600">{order.branchName}</td>
                  <td className="px-2 py-2 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        STATUS_COLORS[order.status].color
                      }`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {t(`orders.status_${order.status}`) || order.status}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center text-gray-600">
                    {t(`orders.priority_${order.priority}`) || order.priority}
                  </td>
                  <td className="px-2 py-2 text-center text-gray-600" style={{ whiteSpace: 'nowrap' }}>
                    {renderProducts(order)}
                  </td>
                  <td className="px-2 py-2 text-center text-gray-600" style={{ whiteSpace: 'nowrap' }}>
                    {renderReturns(order)}
                  </td>
                  <td className="px-2 py-2 text-center text-gray-600">{calculateAdjustedTotal(order)}</td>
                  <td className="px-2 py-2 text-center text-gray-600">{calculateTotalQuantity(order)}</td>
                  <td className="px-2 py-2 text-center">
                    <div className={`flex gap-1.5 justify-center ${isRtl ? 'flex-row-reverse' : ''}`}>
                      {['admin', 'production'].includes(user?.role) &&
                        order.status !== 'delivered' &&
                        order.status !== 'cancelled' && (
                          <Button
                            variant="primary"
                            onClick={() => updateOrderStatus(order.id, order.status === 'pending' ? 'approved' : order.status === 'in_production' ? 'completed' : order.status === 'completed' ? 'in_transit' : 'delivered')}
                            disabled={submitting === order.id}
                            className={`px-2 py-1 text-xs rounded-md ${
                              submitting === order.id
                                ? 'bg-gray-300 cursor-not-allowed'
                                : 'bg-amber-500 hover:bg-amber-600 text-white'
                            }`}
                            aria-label={t('orders.update_status') || (isRtl ? 'تحديث الحالة' : 'Update Status')}
                          >
                            {t('orders.update_status') || (isRtl ? 'تحديث الحالة' : 'Update Status')}
                          </Button>
                        )}
                      {['admin', 'production'].includes(user?.role) && order.status === 'approved' && (
                        <Button
                          variant="secondary"
                          onClick={() => openAssignModal(order)}
                          disabled={submitting === order.id}
                          className={`px-2 py-1 text-xs rounded-md ${
                            submitting === order.id
                              ? 'bg-gray-300 cursor-not-allowed'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                          }`}
                          aria-label={t('orders.assign_chef') || (isRtl ? 'تعيين شيف' : 'Assign Chef')}
                        >
                          {t('orders.assign_chef') || (isRtl ? 'تعيين شيف' : 'Assign Chef')}
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
