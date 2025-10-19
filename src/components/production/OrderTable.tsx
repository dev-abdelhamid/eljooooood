import React from 'react';
import { Button } from '../UI/Button';
import { CheckCircle } from 'lucide-react';
import { FactoryOrder, UserRole } from '../../types/types';

interface OrderTableProps {
  orders: FactoryOrder[];
  calculateTotalQuantity: (order: FactoryOrder) => number;
  translateUnit: (unit: string, isRtl: boolean) => string;
  approveOrder: (orderId: string) => void;
  updateOrderStatus: (orderId: string, status: FactoryOrder['status']) => void;
  confirmItemCompletion: (orderId: string, itemId: string) => void;
  openAssignModal: (order: FactoryOrder) => void;
  confirmFactoryProduction: (orderId: string) => void;
  submitting: string | null;
  isRtl: boolean;
  startIndex: number;
  currentUserRole: UserRole;
}

const translations = {
  ar: {
    orderNumber: 'رقم الطلب',
    date: 'التاريخ',
    items: 'العناصر',
    quantity: 'الكمية',
    status: 'الحالة',
    priority: 'الأولوية',
    notes: 'الملاحظات',
    createdBy: 'تم الإنشاء بواسطة',
    actions: 'الإجراءات',
    approve: 'الموافقة',
    complete: 'إكمال',
    cancel: 'إلغاء',
    assign: 'تعيين شيفات',
    confirmStock: 'تأكيد الإضافة إلى المخزون',
    requested: 'مطلوب',
    pending: 'قيد الانتظار',
    approved: 'تم الموافقة',
    in_production: 'في الإنتاج',
    completed: 'مكتمل',
    stocked: 'مخزن',
    cancelled: 'ملغى',
    low: 'منخفض',
    medium: 'متوسط',
    high: 'مرتفع',
    urgent: 'عاجل',
  },
  en: {
    orderNumber: 'Order Number',
    date: 'Date',
    items: 'Items',
    quantity: 'Quantity',
    status: 'Status',
    priority: 'Priority',
    notes: 'Notes',
    createdBy: 'Created By',
    actions: 'Actions',
    approve: 'Approve',
    complete: 'Complete',
    cancel: 'Cancel',
    assign: 'Assign Chefs',
    confirmStock: 'Confirm Add to Inventory',
    requested: 'Requested',
    pending: 'Pending',
    approved: 'Approved',
    in_production: 'In Production',
    completed: 'Completed',
    stocked: 'Stocked',
    cancelled: 'Cancelled',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    urgent: 'Urgent',
  },
};

export const OrderTable: React.FC<OrderTableProps> = ({
  orders,
  calculateTotalQuantity,
  translateUnit,
  approveOrder,
  updateOrderStatus,
  confirmItemCompletion,
  openAssignModal,
  confirmFactoryProduction,
  submitting,
  isRtl,
  startIndex,
  currentUserRole,
}) => {
  const t = translations[isRtl ? 'ar' : 'en'];

  const canApprove = ['admin', 'production'].includes(currentUserRole);
  const canAssign = ['admin', 'production'].includes(currentUserRole);
  const canComplete = ['chef', 'admin', 'production'].includes(currentUserRole);
  const canConfirmStock = ['admin', 'production'].includes(currentUserRole);

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-lg">
      <table className="min-w-full bg-white divide-y divide-gray-200">
        <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
          <tr className={isRtl ? 'text-right' : 'text-left'}>
            <th className="px-6 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">#</th>
            <th className="px-6 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">{t.orderNumber}</th>
            <th className="px-6 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">{t.date}</th>
            <th className="px-6 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">{t.items}</th>
            <th className="px-6 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">{t.quantity}</th>
            <th className="px-6 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">{t.status}</th>
            <th className="px-6 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">{t.priority}</th>
            <th className="px-6 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">{t.notes}</th>
            <th className="px-6 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">{t.createdBy}</th>
            <th className="px-6 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">{t.actions}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {orders.map((order, index) => {
            const allAssigned = order.items.every((item) => item.assignedTo);
            const allCompleted = order.items.every((item) => item.status === 'completed');
            const displayStatus = order.status === 'completed' && order.inventoryProcessed ? 'stocked' : order.status;
            return (
              <tr key={order.id} className="hover:bg-gray-50 transition-colors duration-200">
                <td className="px-6 py-4 text-xs text-gray-900">{startIndex + index}</td>
                <td className="px-6 py-4 text-xs text-gray-900">{order.orderNumber}</td>
                <td className="px-6 py-4 text-xs text-gray-900">{order.date}</td>
                <td className="px-6 py-4 text-xs text-gray-900">
                  {order.items.map((item) => (
                    <div key={item._id} className="mb-1 flex items-center justify-between gap-2">
                      <span>{item.displayProductName} ({item.quantity} {translateUnit(item.unit, isRtl)})</span>
                      {item.assignedTo && (
                        <span className="text-xs text-gray-500">
                          ({isRtl ? 'معين إلى' : 'Assigned to'}: {item.assignedTo.displayName})
                        </span>
                      )}
                      {order.status === 'in_production' && currentUserRole === 'chef' && item.assignedTo?._id === user?.id && item.status !== 'completed' && (
                        <Button
                          variant="success"
                          onClick={() => confirmItemCompletion(order.id, item._id)}
                          disabled={submitting === item._id}
                          className="bg-green-500 hover:bg-green-600 text-white rounded-md px-2 py-1 text-xs shadow-sm"
                        >
                          {submitting === item._id ? '...' : <CheckCircle className="w-3 h-3" />}
                        </Button>
                      )}
                    </div>
                  ))}
                </td>
                <td className="px-6 py-4 text-xs text-gray-900">{calculateTotalQuantity(order)}</td>
                <td className="px-6 py-4 text-xs">
                  <span
                    className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${
                      displayStatus === 'requested' ? 'bg-orange-100 text-orange-800' :
                      displayStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      displayStatus === 'approved' ? 'bg-blue-100 text-blue-800' :
                      displayStatus === 'in_production' ? 'bg-indigo-100 text-indigo-800' :
                      displayStatus === 'completed' ? 'bg-green-100 text-green-800' :
                      displayStatus === 'stocked' ? 'bg-purple-100 text-purple-800' :
                      'bg-red-100 text-red-800'
                    }`}
                  >
                    {t[displayStatus]}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-gray-900">{t[order.priority]}</td>
                <td className="px-6 py-4 text-xs text-gray-900">{order.notes || '—'}</td>
                <td className="px-6 py-4 text-xs text-gray-900">{order.createdBy}</td>
                <td className="px-6 py-4 text-xs">
                  <div className={`flex gap-2 flex-wrap ${isRtl ? 'flex-row-reverse' : ''}`}>
                    {(order.status === 'requested' || order.status === 'pending') && canApprove && (
                      <Button
                        variant="primary"
                        onClick={() => approveOrder(order.id)}
                        disabled={submitting === order.id}
                        className="bg-amber-500 hover:bg-amber-600 text-white rounded-md px-3 py-1 text-xs shadow-sm"
                      >
                        {submitting === order.id ? '...' : t.approve}
                      </Button>
                    )}
                    {order.status === 'approved' && !allAssigned && canAssign && (
                      <Button
                        variant="primary"
                        onClick={() => openAssignModal(order)}
                        disabled={submitting === order.id}
                        className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-3 py-1 text-xs shadow-sm"
                      >
                        {submitting === order.id ? '...' : t.assign}
                      </Button>
                    )}
                    {order.status === 'in_production' && allAssigned && allCompleted && canComplete && (
                      <Button
                        variant="success"
                        onClick={() => updateOrderStatus(order.id, 'completed')}
                        disabled={submitting === order.id}
                        className="bg-green-500 hover:bg-green-600 text-white rounded-md px-3 py-1 text-xs shadow-sm"
                      >
                        {submitting === order.id ? '...' : t.complete}
                      </Button>
                    )}
                    {order.status === 'completed' && !order.inventoryProcessed && canConfirmStock && (
                      <Button
                        variant="success"
                        onClick={() => confirmFactoryProduction(order.id)}
                        disabled={submitting === order.id}
                        className="bg-purple-500 hover:bg-purple-600 text-white rounded-md px-3 py-1 text-xs shadow-sm"
                      >
                        {submitting === order.id ? '...' : t.confirmStock}
                      </Button>
                    )}
                    {(order.status === 'requested' || order.status === 'pending' || order.status === 'approved' || order.status === 'in_production') && (
                      <Button
                        variant="danger"
                        onClick={() => updateOrderStatus(order.id, 'cancelled')}
                        disabled={submitting === order.id}
                        className="bg-red-500 hover:bg-red-600 text-white rounded-md px-3 py-1 text-xs shadow-sm"
                      >
                        {submitting === order.id ? '...' : t.cancel}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default OrderTable;