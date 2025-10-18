import React from 'react';
import { Button } from '../UI/Button';
import { CheckCircle } from 'lucide-react';
import { FactoryOrder, UserRole } from '../../types/types';

interface OrderTableProps {
  orders: FactoryOrder[];
  calculateTotalQuantity: (order: FactoryOrder) => number;
  translateUnit: (unit: string, isRtl: boolean) => string;
  updateOrderStatus: (orderId: string, status: FactoryOrder['status']) => void;
  openAssignModal: (order: FactoryOrder) => void;
  confirmItemCompletion: (orderId: string, itemId: string) => void;
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
    stock: 'إضافة إلى المخزون',
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
    stock: 'Add to Stock',
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
  updateOrderStatus,
  openAssignModal,
  confirmItemCompletion,
  submitting,
  isRtl,
  startIndex,
  currentUserRole,
}) => {
  const t = translations[isRtl ? 'ar' : 'en'];

  const canApprove = ['admin', 'production_manager'].includes(currentUserRole);
  const canComplete = ['chef', 'admin', 'production_manager'].includes(currentUserRole);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white shadow-md rounded-lg border border-gray-200">
        <thead className="bg-gray-50">
          <tr className={isRtl ? 'text-right' : 'text-left'}>
            <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
            <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{t.orderNumber}</th>
            <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{t.date}</th>
            <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{t.items}</th>
            <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{t.quantity}</th>
            <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{t.status}</th>
            <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{t.priority}</th>
            <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{t.notes}</th>
            <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{t.createdBy}</th>
            <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{t.actions}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {orders.map((order, index) => (
            <tr key={order.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-xs">{startIndex + index}</td>
              <td className="px-4 py-3 text-xs">{order.orderNumber}</td>
              <td className="px-4 py-3 text-xs">{order.date}</td>
              <td className="px-4 py-3 text-xs">
                {order.items.map(item => (
                  <div key={item._id} className="mb-1 flex justify-between items-center">
                    <span>
                      {item.displayProductName} ({item.quantity} {translateUnit(item.unit, isRtl)})
                      {item.assignedTo && (
                        <span className="ml-2 text-xs text-gray-500">
                          ({isRtl ? 'معين إلى' : 'Assigned to'}: {item.assignedTo.displayName})
                        </span>
                      )}
                    </span>
                    {order.status === 'in_production' && item.assignedTo?._id === user.id && item.status !== 'completed' && currentUserRole === 'chef' && (
                      <Button
                        variant="success"
                        onClick={() => confirmItemCompletion(order.id, item._id)}
                        disabled={submitting === item._id}
                        className="bg-green-500 hover:bg-green-600 text-white rounded-md px-2 py-0.5 text-xxs shadow-sm"
                        aria-label={t.complete}
                      >
                        {submitting === item._id ? '...' : <CheckCircle className="w-3 h-3" />}
                      </Button>
                    )}
                  </div>
                ))}
              </td>
              <td className="px-4 py-3 text-xs">{calculateTotalQuantity(order)}</td>
              <td className="px-4 py-3 text-xs">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    order.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : order.status === 'in_production'
                      ? 'bg-purple-100 text-purple-800'
                      : order.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : order.status === 'stocked'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {t[order.status]}
                </span>
              </td>
              <td className="px-4 py-3 text-xs">{t[order.priority]}</td>
              <td className="px-4 py-3 text-xs">{order.notes || '—'}</td>
              <td className="px-4 py-3 text-xs">{order.createdBy}</td>
              <td className="px-4 py-3 text-xs">
                <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  {order.status === 'pending' && canApprove && (
                    <Button
                      variant="primary"
                      onClick={() => updateOrderStatus(order.id, 'in_production')}
                      disabled={submitting === order.id}
                      className="bg-amber-500 hover:bg-amber-600 text-white rounded-md px-3 py-1 text-xs shadow-sm"
                      aria-label={t.approve}
                    >
                      {submitting === order.id ? '...' : t.approve}
                    </Button>
                  )}
                  {order.status === 'in_production' && order.items.some(i => !i.assignedTo) && canApprove && (
                    <Button
                      variant="primary"
                      onClick={() => openAssignModal(order)}
                      disabled={submitting === order.id}
                      className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-md px-3 py-1 text-xs shadow-sm"
                      aria-label={t.assign}
                    >
                      {submitting === order.id ? '...' : t.assign}
                    </Button>
                  )}
                  {order.status === 'in_production' && canComplete && (
                    <Button
                      variant="success"
                      onClick={() => updateOrderStatus(order.id, 'completed')}
                      disabled={submitting === order.id || order.items.some(i => i.status !== 'completed')}
                      className="bg-green-500 hover:bg-green-600 text-white rounded-md px-3 py-1 text-xs shadow-sm"
                      aria-label={t.complete}
                    >
                      {submitting === order.id ? '...' : <CheckCircle className="w-4 h-4" />}
                    </Button>
                  )}
                  {order.status === 'completed' && canApprove && (
                    <Button
                      variant="primary"
                      onClick={() => updateOrderStatus(order.id, 'stocked')}
                      disabled={submitting === order.id}
                      className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-3 py-1 text-xs shadow-sm"
                      aria-label={t.stock}
                    >
                      {submitting === order.id ? '...' : t.stock}
                    </Button>
                  )}
                  {['pending', 'in_production'].includes(order.status) && (
                    <Button
                      variant="danger"
                      onClick={() => updateOrderStatus(order.id, 'cancelled')}
                      disabled={submitting === order.id}
                      className="bg-red-500 hover:bg-red-600 text-white rounded-md px-3 py-1 text-xs shadow-sm"
                      aria-label={t.cancel}
                    >
                      {submitting === order.id ? '...' : t.cancel}
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default OrderTable;