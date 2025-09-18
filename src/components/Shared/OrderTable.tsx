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
  calculateTotalQuantity: (order: Order) => number;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  openAssignModal: (order: Order) => void;
  startIndex: number;
  submitting: string | null;
  isRtl: boolean;
}

const OrderTable: React.FC<OrderTableProps> = memo(
  ({ orders, calculateAdjustedTotal, calculateTotalQuantity, updateOrderStatus, openAssignModal, startIndex, submitting, isRtl }) => {
    const { user } = useAuth();

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
      return translations[status] ? (isRtl ? translations[status].ar : translations[status].en) : status;
    };

    const translatePriority = (priority: string) => {
      const translations: Record<string, { ar: string; en: string }> = {
        urgent: { ar: 'عاجل', en: 'Urgent' },
        high: { ar: 'مرتفع', en: 'High' },
        medium: { ar: 'متوسط', en: 'Medium' },
        low: { ar: 'منخفض', en: 'Low' },
      };
      return translations[priority] ? (isRtl ? translations[priority].ar : translations[priority].en) : priority;
    };

    const translateDepartment = (dept: string) => {
      const translations: Record<string, { ar: string; en: string }> = {
        bread: { ar: 'الخبز', en: 'Bread' },
        pastries: { ar: 'المعجنات', en: 'Pastries' },
        cakes: { ar: 'الكعك', en: 'Cakes' },
        unknown: { ar: 'غير معروف', en: 'Unknown' },
      };
      return translations[dept] ? (isRtl ? translations[dept].ar : translations[dept].en) : dept;
    };

    const translateUnit = (unit: string) => {
      const translations: Record<string, { ar: string; en: string }> = {
        unit: { ar: 'وحدة', en: 'Unit' },
        kg: { ar: 'كجم', en: 'kg' },
        piece: { ar: 'قطعة', en: 'Piece' },
      };
      return translations[unit] ? (isRtl ? translations[unit].ar : translations[unit].en) : unit;
    };

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="overflow-x-auto rounded-md shadow-md border border-gray-100 bg-white"
        role="table"
        aria-label={isRtl ? 'جدول الطلبات' : 'Orders table'}
      >
        <table className="min-w-full divide-y divide-gray-100 text-xs">
          <thead className="bg-gray-50">
            <tr className={isRtl ? 'flex-row-reverse' : ''}>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[40px]">{isRtl ? 'رقم' : 'No.'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">{isRtl ? 'رقم الطلب' : 'Order Number'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">{isRtl ? 'الفرع' : 'Branch'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">{isRtl ? 'الحالة' : 'Status'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[80px]">{isRtl ? 'الأولوية' : 'Priority'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[120px]">{isRtl ? 'المنتجات' : 'Products'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">{isRtl ? 'القسم' : 'Department'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">{isRtl ? 'معين إلى' : 'Assigned To'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">{isRtl ? 'إجمالي المبلغ' : 'Total Amount'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[80px]">{isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">{isRtl ? 'التاريخ' : 'Date'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">{isRtl ? 'الإرجاعات' : 'Returns'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[120px]">{isRtl ? 'الإجراءات' : 'Actions'}</th>
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
                  <td className="px-2 py-2 text-gray-600 text-center truncate max-w-[100px]">{order.orderNumber || (isRtl ? 'غير معروف' : 'Unknown')}</td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate max-w-[100px]">{order.branchName || (isRtl ? 'غير معروف' : 'Unknown')}</td>
                  <td className="px-2 py-2 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center justify-center gap-1 ${statusInfo.color} ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <StatusIcon className="w-4 h-4" />
                      {translateStatus(statusInfo.label)}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate max-w-[80px]">{translatePriority(order.priority)}</td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate max-w-[120px]">
                    {order.items.slice(0, 2).map((item) => (
                      <p key={item._id} className="truncate">
                        {`${item.quantity} ${translateUnit(item.unit || 'unit')} ${item.productName}`}
                      </p>
                    ))}
                    {order.items.length > 2 && (
                      <p className="text-gray-500 truncate">{isRtl ? `+${order.items.length - 2} أخرى` : `+${order.items.length - 2} more`}</p>
                    )}
                  </td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate max-w-[100px]">
                    {order.items.map((item) => translateDepartment(item.department?.name || 'unknown')).join(', ')}
                  </td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate max-w-[100px]">
                    {order.items.map((item) => item.assignedTo?.name || (isRtl ? 'غير معين' : 'Unassigned')).join(', ')}
                  </td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate max-w-[100px]">{calculateAdjustedTotal(order)}</td>
                  <td className="px-2 py-2 text-gray-600 text-center">{calculateTotalQuantity(order)}</td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate max-w-[100px]">{order.date}</td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate max-w-[100px]">
                    {order.returns?.length > 0
                      ? order.returns
                          .map((r) =>
                            isRtl
                              ? `${r.items
                                  .map((item) => `${item.quantity} ${translateUnit(item.unit || 'unit')} ${item.reason}`)
                                  .join(', ')} - الحالة: ${
                                  {
                                    pending_approval: 'قيد الموافقة',
                                    approved: 'تمت الموافقة',
                                    rejected: 'مرفوض',
                                    processed: 'تمت المعالجة',
                                  }[r.status] || r.status
                                }`
                              : `${r.items
                                  .map((item) => `${item.quantity} ${translateUnit(item.unit || 'unit')} ${item.reason}`)
                                  .join(', ')} - Status: ${
                                  {
                                    pending_approval: 'Pending Approval',
                                    approved: 'Approved',
                                    rejected: 'Rejected',
                                    processed: 'Processed',
                                  }[r.status] || r.status
                                }`
                          )
                          .join('; ')
                      : isRtl ? 'لا توجد إرجاعات' : 'No returns'}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <div className={`flex gap-1 flex-wrap ${isRtl ? 'justify-end' : 'justify-start'}`}>
                      <Link to={`/orders/${order.id}`}>
                        <Button
                          variant="primary"
                          size="xs"
                          className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1 text-xs"
                          aria-label={isRtl ? `عرض طلب رقم ${order.orderNumber}` : `View order #${order.orderNumber}`}
                        >
                          {isRtl ? 'عرض' : 'View'}
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
                            aria-label={isRtl ? `الموافقة على طلب رقم ${order.orderNumber}` : `Approve order #${order.orderNumber}`}
                          >
                            {submitting === order.id ? (isRtl ? 'جارٍ التحميل...' : 'Loading...') : isRtl ? 'موافقة' : 'Approve'}
                          </Button>
                          <Button
                            variant="danger"
                            size="xs"
                            onClick={() => updateOrderStatus(order.id, 'cancelled')}
                            className="bg-red-500 hover:bg-red-600 text-white rounded-md px-2 py-1 text-xs"
                            disabled={submitting === order.id}
                            aria-label={isRtl ? `إلغاء طلب رقم ${order.orderNumber}` : `Cancel order #${order.orderNumber}`}
                          >
                            {submitting === order.id ? (isRtl ? 'جارٍ التحميل...' : 'Loading...') : isRtl ? 'إلغاء' : 'Cancel'}
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
                          aria-label={isRtl ? `تعيين طلب رقم ${order.orderNumber}` : `Assign order #${order.orderNumber}`}
                        >
                          {submitting === order.id ? (isRtl ? 'جارٍ التحميل...' : 'Loading...') : isRtl ? 'تعيين' : 'Assign'}
                        </Button>
                      )}
                      {user?.role === 'production' && order.status === 'completed' && (
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => updateOrderStatus(order.id, 'in_transit')}
                          className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1 text-xs"
                          disabled={submitting === order.id}
                          aria-label={isRtl ? `شحن طلب رقم ${order.orderNumber}` : `Ship order #${order.orderNumber}`}
                        >
                          {submitting === order.id ? (isRtl ? 'جارٍ التحميل...' : 'Loading...') : isRtl ? 'شحن' : 'Ship'}
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
            {isRtl ? 'لا توجد طلبات' : 'No orders'}
          </div>
        )}
      </motion.div>
    );
  }
);

export default OrderTable;