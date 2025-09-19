import React, { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '../UI/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Order, OrderStatus } from '../../types/types';
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
  calculateTotalQuantity: (order: Order) => number;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  openAssignModal: (order: Order) => void;
  startIndex: number;
  submitting: string | null;
}

const OrderTable: React.FC<OrderTableProps> = memo(
  ({ orders, calculateAdjustedTotal, calculateTotalQuantity, updateOrderStatus, openAssignModal, startIndex, submitting }) => {
    const { user } = useAuth();
    const { t, language } = useLanguage();
    const isRtl = language === 'ar';

    const getUniqueDepartments = useMemo(() => {
      return (order: Order) => {
        const departments = Array.from(new Set(order.items.map(item => item.department?.name || 'unknown')));
        return departments
          .map(dept =>
            isRtl
              ? t(`departments.${dept}`, { defaultValue: 'غير معروف' })
              : t(`departments.${dept}`, { defaultValue: 'Unknown' })
          )
          .join(', ');
      };
    }, [isRtl, t]);

    const getAssignedTo = useMemo(() => {
      return (order: Order) => {
        const assigned = Array.from(new Set(order.items.map(item => item.assignedTo?.name || (isRtl ? 'غير معين' : 'Unassigned'))));
        return assigned.join(', ');
      };
    }, [isRtl]);

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="overflow-x-auto rounded-md shadow-md border border-gray-100 bg-white"
        role="table"
        aria-label={t('orders.table_label', { defaultValue: isRtl ? 'جدول الطلبات' : 'Orders Table' })}
      >
        <table className="min-w-full divide-y divide-gray-100 text-xs">
          <thead className="bg-gray-50">
            <tr className={isRtl ? 'flex-row-reverse' : ''}>
              <th className="px-3 py-2.5 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[40px]">
                {t('common.number', { defaultValue: isRtl ? 'رقم' : 'No.' })}
              </th>
              <th className="px-3 py-2.5 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">
                {t('orders.orderNumber', { defaultValue: isRtl ? 'رقم الطلب' : 'Order Number' })}
              </th>
              <th className="px-3 py-2.5 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">
                {t('orders.branchName', { defaultValue: isRtl ? 'الفرع' : 'Branch' })}
              </th>
              <th className="px-3 py-2.5 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">
                {t('orders.status', { defaultValue: isRtl ? 'الحالة' : 'Status' })}
              </th>
              <th className="px-3 py-2.5 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[80px]">
                {t('orders.priority', { defaultValue: isRtl ? 'الأولوية' : 'Priority' })}
              </th>
              <th className="px-3 py-2.5 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[120px]">
                {t('orders.products', { defaultValue: isRtl ? 'المنتجات' : 'Products' })}
              </th>
              <th className="px-3 py-2.5 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">
                {t('orders.department', { defaultValue: isRtl ? 'القسم' : 'Department' })}
              </th>
              <th className="px-3 py-2.5 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">
                {t('orders.assignedTo', { defaultValue: isRtl ? 'معين إلى' : 'Assigned To' })}
              </th>
              <th className="px-3 py-2.5 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">
                {t('orders.totalAmount', { defaultValue: isRtl ? 'إجمالي المبلغ' : 'Total Amount' })}
              </th>
              <th className="px-3 py-2.5 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[80px]">
                {t('orders.totalQuantity', { defaultValue: isRtl ? 'الكمية الإجمالية' : 'Total Quantity' })}
              </th>
              <th className="px-3 py-2.5 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">
                {t('orders.date', { defaultValue: isRtl ? 'التاريخ' : 'Date' })}
              </th>
              <th className="px-3 py-2.5 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">
                {t('orders.returns', { defaultValue: isRtl ? 'الإرجاعات' : 'Returns' })}
              </th>
              <th className="px-3 py-2.5 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[120px]">
                {t('orders.actions', { defaultValue: isRtl ? 'الإجراءات' : 'Actions' })}
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
                  <td className="px-3 py-2 text-gray-600 text-center whitespace-nowrap">{startIndex + index}</td>
                  <td className="px-3 py-2 text-gray-600 text-center whitespace-nowrap">{order.orderNumber}</td>
                  <td className="px-3 py-2 text-gray-600 text-center truncate max-w-[100px]">{order.branchName}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color} ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <StatusIcon className="w-4 h-4" />
                      <span className="ml-1">{t(`orders.status_${statusInfo.label}`, { defaultValue: translateStatus(statusInfo.label) })}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600 text-center whitespace-nowrap">{t(`orders.priority_${order.priority}`, { defaultValue: translatePriority(order.priority) })}</td>
                  <td className="px-3 py-2 text-gray-600 text-center max-w-[120px]">
                    <div className="flex flex-col items-center gap-1">
                      {order.items.slice(0, 2).map((item) => (
                        <p key={item._id} className="truncate w-full">
                          {`${item.quantity} ${t(`units.${item.unit}`, { defaultValue: translateUnit(item.unit) })} ${item.productName}`}
                        </p>
                      ))}
                      {order.items.length > 2 && (
                        <p className="text-gray-500 truncate w-full">
                          {t('orders.moreItems', { count: order.items.length - 2, defaultValue: isRtl ? `+${order.items.length - 2} أخرى` : `+${order.items.length - 2} more` })}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-600 text-center truncate max-w-[100px]">{getUniqueDepartments(order)}</td>
                  <td className="px-3 py-2 text-gray-600 text-center truncate max-w-[100px]">{getAssignedTo(order)}</td>
                  <td className="px-3 py-2 text-gray-600 text-center whitespace-nowrap">{calculateAdjustedTotal(order)}</td>
                  <td className="px-3 py-2 text-gray-600 text-center whitespace-nowrap">{calculateTotalQuantity(order)}</td>
                  <td className="px-3 py-2 text-gray-600 text-center whitespace-nowrap">{order.date}</td>
                  <td className="px-3 py-2 text-gray-600 text-center truncate max-w-[100px]">
                    {order.returns?.length > 0
                      ? order.returns
                          .map((r) =>
                            isRtl
                              ? `${r.items
                                  .map((item) => `${item.quantity} ${t(`units.${item.unit}`, { defaultValue: translateUnit(item.unit) })} ${item.reason}`)
                                  .join(', ')} - ${t(`orders.return_status_${r.status}`, { defaultValue: translateReturnStatus(r.status) })}`
                              : `${r.items
                                  .map((item) => `${item.quantity} ${t(`units.${item.unit}`, { defaultValue: translateUnit(item.unit) })} ${item.reason}`)
                                  .join(', ')} - ${t(`orders.return_status_${r.status}`, { defaultValue: translateReturnStatus(r.status) })}`
                          )
                          .join('; ')
                      : t('orders.no_returns', { defaultValue: isRtl ? 'لا توجد إرجاعات' : 'No returns' })}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className={`flex gap-1 flex-wrap ${isRtl ? 'justify-end' : 'justify-start'}`}>
                      <Link to={`/orders/${order.id}`}>
                        <Button
                          variant="primary"
                          size="xs"
                          className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1 text-xs"
                          aria-label={t('orders.view_order', { orderNumber: order.orderNumber, defaultValue: isRtl ? `عرض طلب رقم ${order.orderNumber}` : `View order #${order.orderNumber}` })}
                        >
                          {t('common.view', { defaultValue: isRtl ? 'عرض' : 'View' })}
                        </Button>
                      </Link>
                      {user?.role === 'production' && order.status === OrderStatus.Pending && (
                        <>
                          <Button
                            variant="success"
                            size="xs"
                            onClick={() => updateOrderStatus(order.id, OrderStatus.Approved)}
                            className="bg-green-500 hover:bg-green-600 text-white rounded-md px-2 py-1 text-xs"
                            disabled={submitting === order.id}
                            aria-label={t('orders.approve_order', { orderNumber: order.orderNumber, defaultValue: isRtl ? `الموافقة على طلب رقم ${order.orderNumber}` : `Approve order #${order.orderNumber}` })}
                          >
                            {submitting === order.id ? t('common.loading', { defaultValue: isRtl ? 'جارٍ التحميل...' : 'Loading...' }) : t('orders.approve', { defaultValue: isRtl ? 'موافقة' : 'Approve' })}
                          </Button>
                          <Button
                            variant="danger"
                            size="xs"
                            onClick={() => updateOrderStatus(order.id, OrderStatus.Cancelled)}
                            className="bg-red-500 hover:bg-red-600 text-white rounded-md px-2 py-1 text-xs"
                            disabled={submitting === order.id}
                            aria-label={t('orders.cancel_order', { orderNumber: order.orderNumber, defaultValue: isRtl ? `إلغاء طلب رقم ${order.orderNumber}` : `Cancel order #${order.orderNumber}` })}
                          >
                            {submitting === order.id ? t('common.loading', { defaultValue: isRtl ? 'جارٍ التحميل...' : 'Loading...' }) : t('orders.cancel', { defaultValue: isRtl ? 'إلغاء' : 'Cancel' })}
                          </Button>
                        </>
                      )}
                      {user?.role === 'production' && order.status === OrderStatus.Approved && unassignedItems.length > 0 && (
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => openAssignModal(order)}
                          className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1 text-xs"
                          disabled={submitting === order.id}
                          aria-label={t('orders.assign_order', { orderNumber: order.orderNumber, defaultValue: isRtl ? `تعيين طلب رقم ${order.orderNumber}` : `Assign order #${order.orderNumber}` })}
                        >
                          {submitting === order.id ? t('common.loading', { defaultValue: isRtl ? 'جارٍ التحميل...' : 'Loading...' }) : t('orders.assign', { defaultValue: isRtl ? 'تعيين' : 'Assign' })}
                        </Button>
                      )}
                      {user?.role === 'production' && order.status === OrderStatus.Completed && (
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => updateOrderStatus(order.id, OrderStatus.InTransit)}
                          className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1 text-xs"
                          disabled={submitting === order.id}
                          aria-label={t('orders.ship_order', { orderNumber: order.orderNumber, defaultValue: isRtl ? `شحن طلب رقم ${order.orderNumber}` : `Ship order #${order.orderNumber}` })}
                        >
                          {submitting === order.id ? t('common.loading', { defaultValue: isRtl ? 'جارٍ التحميل...' : 'Loading...' }) : t('orders.ship', { defaultValue: isRtl ? 'شحن' : 'Ship' })}
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
            {t('orders.no_orders', { defaultValue: isRtl ? 'لا توجد طلبات' : 'No orders' })}
          </div>
        )}
      </motion.div>
    );
  }
);

const translateStatus = (status: string) => {
  const translations: Record<string, { ar: string; en: string }> = {
    pending: { ar: 'قيد الانتظار', en: 'Pending' },
    approved: { ar: 'تم الموافقة', en: 'Approved' },
    in_production: { ar: 'في الإنتاج', en: 'In Production' },
    completed: { ar: 'مكتمل', en: 'Completed' },
    in_transit: { ar: 'في النقل', en: 'In Transit' },
    delivered: { ar: 'تم التسليم', en: 'Delivered' },
    cancelled: { ar: 'ملغى', en: 'Cancelled' },
  };
  return translations[status] ? translations[status] : { ar: status, en: status };
};

const translatePriority = (priority: string) => {
  const translations: Record<string, { ar: string; en: string }> = {
    urgent: { ar: 'عاجل', en: 'Urgent' },
    high: { ar: 'مرتفع', en: 'High' },
    medium: { ar: 'متوسط', en: 'Medium' },
    low: { ar: 'منخفض', en: 'Low' },
  };
  return translations[priority] ? translations[priority] : { ar: priority, en: priority };
};

const translateUnit = (unit: string) => {
  const translations: Record<string, { ar: string; en: string }> = {
    كيلو: { ar: 'كيلو', en: 'kg' },
    قطعة: { ar: 'قطعة', en: 'Piece' },
    علبة: { ar: 'علبة', en: 'Box' },
    صينية: { ar: 'صينية', en: 'Tray' },
    unit: { ar: 'وحدة', en: 'Unit' },
  };
  return translations[unit] ? translations[unit] : { ar: unit, en: unit };
};

const translateReturnStatus = (status: string) => {
  const translations: Record<string, { ar: string; en: string }> = {
    pending: { ar: 'قيد الموافقة', en: 'Pending Approval' },
    approved: { ar: 'تمت الموافقة', en: 'Approved' },
    rejected: { ar: 'مرفوض', en: 'Rejected' },
    processed: { ar: 'تمت المعالجة', en: 'Processed' },
  };
  return translations[status] ? translations[status] : { ar: status, en: status };
};

export default OrderTable;