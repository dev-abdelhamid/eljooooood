import React, { memo, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '../UI/Button';
import { useAuth } from '../../contexts/AuthContext';
import { Order, OrderStatus } from '../../types/types';
import { Clock, Check, Package, Truck, AlertCircle, ChevronRight } from 'lucide-react';

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
  openAssignModal: (order: Order) => void;
  startIndex: number;
  submitting: string | null;
  isRtl: boolean;
}

const OrderTable: React.FC<OrderTableProps> = memo(
  ({ orders, calculateAdjustedTotal, calculateTotalQuantity, translateUnit, updateOrderStatus, openAssignModal, startIndex, submitting, isRtl }) => {
    const { user } = useAuth();
    const [expandedRows, setExpandedRows] = useState<string[]>([]);

    const toggleExpand = (orderId: string) => {
      setExpandedRows((prev) => prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]);
    };

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="overflow-x-auto rounded-md shadow-md border border-gray-100 bg-white"
        role="table"
        aria-label={isRtl ? 'جدول الطلبات' : 'Orders Table'}
      >
        <table className="min-w-full divide-y divide-gray-100 text-xs">
          <thead className="bg-gray-50">
            <tr className={isRtl ? 'flex-row-reverse' : ''}>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[40px]">{isRtl ? 'رقم' : 'No.'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">{isRtl ? 'رقم الطلب' : 'Order Number'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">{isRtl ? 'الفرع' : 'Branch'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[80px]">{isRtl ? 'الحالة' : 'Status'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[300px]">{isRtl ? 'المنتجات' : 'Products'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">{isRtl ? 'إجمالي المبلغ' : 'Total Amount'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[80px]">{isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">{isRtl ? 'التاريخ' : 'Date'}</th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[150px]">{isRtl ? 'الإجراءات' : 'Actions'}</th>
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

              // Memo للـ labels
              const departmentLabels = useMemo(() => ({
                bread: isRtl ? 'الخبز' : 'Bread',
                pastries: isRtl ? 'المعجنات' : 'Pastries',
                cakes: isRtl ? 'الكعك' : 'Cakes',
                unknown: isRtl ? 'غير معروف' : 'Unknown',
              }), [isRtl]);

              return (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors h-12 align-middle"> {/* ارتفاع ثابت للـ row */}
                  <td className="px-2 py-2 text-gray-600 text-center whitespace-nowrap">{startIndex + index}</td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate max-w-[100px] whitespace-nowrap">{order.orderNumber}</td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate max-w-[100px] whitespace-nowrap">{order.branchName}</td>
                  <td className="px-2 py-2 text-center whitespace-nowrap"> {/* الحالة في سطر واحد */}
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium items-center gap-1 ${statusInfo.color} ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <StatusIcon className="w-4 h-4" />
                      {isRtl ? { pending: 'قيد الانتظار', approved: 'تم الموافقة', in_production: 'في الإنتاج', completed: 'مكتمل', in_transit: 'في النقل', delivered: 'تم التسليم', cancelled: 'ملغى' }[order.status] : statusInfo.label}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-gray-600 text-center"> {/* المنتجات مع scroll أفقي في سطر واحد */}
                    <div className="flex overflow-x-auto max-w-[300px] whitespace-nowrap scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 gap-2">
                      {productsToShow.map((item) => (
                        <span key={item._id} className="inline-block min-w-0 truncate bg-gray-100 px-1 py-0.5 rounded text-xs">
                          {`${item.quantity} ${translateUnit(item.unit, isRtl)} ${item.productName} (${departmentLabels[item.department?.name || 'unknown']}${item.assignedTo ? `, ${isRtl ? 'الشيف:' : 'Chef:'} ${item.assignedTo.name}` : ''})`}
                        </span>
                      ))}
                      {!isExpanded && remaining > 0 && (
                        <button
                          onClick={() => toggleExpand(order.id)}
                          className="inline-flex items-center text-gray-500 hover:text-gray-700 bg-blue-100 px-1 py-0.5 rounded text-xs whitespace-nowrap"
                        >
                          {isRtl ? `و ${remaining} آخرين` : `+ ${remaining} more`}
                          <ChevronRight className={`w-3 h-3 ${isRtl ? 'ml-1 rotate-180' : 'mr-1'}`} />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate whitespace-nowrap">{calculateAdjustedTotal(order)}</td>
                  <td className="px-2 py-2 text-gray-600 text-center whitespace-nowrap">{calculateTotalQuantity(order)}</td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate whitespace-nowrap">{order.date}</td>
                  <td className="px-2 py-2 text-center whitespace-nowrap"> {/* الأزرار في سطر واحد مع flex nowrap */}
                    <div className={`flex gap-1 ${isRtl ? 'flex-row-reverse' : ''} items-center justify-center`}>
                      <Link to={`/orders/${order.id}`}>
                        <Button variant="primary" size="xs" className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1 text-xs whitespace-nowrap" aria-label={isRtl ? `عرض الطلب ${order.orderNumber}` : `View order ${order.orderNumber}`}>
                          {isRtl ? 'عرض' : 'View'}
                        </Button>
                      </Link>
                      {user?.role === 'production' && order.status === 'pending' && (
                        <>
                          <Button
                            variant="success"
                            size="xs"
                            onClick={() => updateOrderStatus(order.id, 'approved')}
                            className="bg-green-500 hover:bg-green-600 text-white rounded-md px-2 py-1 text-xs whitespace-nowrap"
                            disabled={submitting === order.id}
                            aria-label={isRtl ? `الموافقة على الطلب ${order.orderNumber}` : `Approve order ${order.orderNumber}`}
                          >
                            {submitting === order.id ? (isRtl ? 'جارٍ' : 'Loading') : isRtl ? 'موافقة' : 'Approve'}
                          </Button>
                          <Button
                            variant="danger"
                            size="xs"
                            onClick={() => updateOrderStatus(order.id, 'cancelled')}
                            className="bg-red-500 hover:bg-red-600 text-white rounded-md px-2 py-1 text-xs whitespace-nowrap"
                            disabled={submitting === order.id}
                            aria-label={isRtl ? `إلغاء الطلب ${order.orderNumber}` : `Cancel order ${order.orderNumber}`}
                          >
                            {submitting === order.id ? (isRtl ? 'جارٍ' : 'Loading') : isRtl ? 'إلغاء' : 'Cancel'}
                          </Button>
                        </>
                      )}
                      {user?.role === 'production' && order.status === 'approved' && unassignedItems.length > 0 && (
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => openAssignModal(order)}
                          className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1 text-xs whitespace-nowrap"
                          disabled={submitting === order.id}
                          aria-label={isRtl ? `تعيين الطلب ${order.orderNumber}` : `Assign order ${order.orderNumber}`}
                        >
                          {submitting === order.id ? (isRtl ? 'جارٍ' : 'Loading') : isRtl ? 'تعيين' : 'Assign'}
                        </Button>
                      )}
                      {user?.role === 'production' && order.status === 'completed' && (
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => updateOrderStatus(order.id, 'in_transit')}
                          className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1 text-xs whitespace-nowrap"
                          disabled={submitting === order.id}
                          aria-label={isRtl ? `شحن الطلب ${order.orderNumber}` : `Ship order ${order.orderNumber}`}
                        >
                          {submitting === order.id ? (isRtl ? 'جارٍ' : 'Loading') : isRtl ? 'شحن' : 'Ship'}
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
          <div className="text-center py-4 text-gray-500 text-xs">{isRtl ? 'لا توجد طلبات' : 'No orders'}</div>
        )}
      </motion.div>
    );
  }
);

export default OrderTable;