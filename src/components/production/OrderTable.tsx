// components/Shared/OrderTable.tsx
import React from 'react';
import { Button } from '../UI/Button';
import { UserCheck, CheckCircle } from 'lucide-react';
import { FactoryOrder } from '../../types/types';

interface OrderTableProps {
  orders: FactoryOrder[];
  calculateAdjustedTotal: (order: FactoryOrder) => string;
  calculateTotalQuantity: (order: FactoryOrder) => number;
  translateUnit: (unit: string, isRtl: boolean) => string;
  updateOrderStatus: (orderId: string, status: FactoryOrder['status']) => void;
  openAssignModal: (order: FactoryOrder) => void;
  submitting: string | null;
  isRtl: boolean;
  startIndex: number;
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
    assignChefs: 'تعيين شيفات',
    pending: 'قيد الانتظار',
    approved: 'تم الموافقة',
    in_production: 'في الإنتاج',
    completed: 'مكتمل',
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
    assignChefs: 'Assign Chefs',
    pending: 'Pending',
    approved: 'Approved',
    in_production: 'In Production',
    completed: 'Completed',
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
  submitting,
  isRtl,
  startIndex,
}) => {
  const t = translations[isRtl ? 'ar' : 'en'];

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
              <td className="px-4 py-3 text-sm">{startIndex + index}</td>
              <td className="px-4 py-3 text-sm">{order.orderNumber}</td>
              <td className="px-4 py-3 text-sm">{order.date}</td>
              <td className="px-4 py-3 text-sm">
                {order.items.map(item => (
                  <div key={item._id} className="mb-1">
                    {item.displayProductName} ({item.quantity} {translateUnit(item.unit, isRtl)})
                    {item.assignedTo && (
                      <span className="ml-2 text-xs text-gray-500">
                        ({isRtl ? 'معين إلى' : 'Assigned to'}: {item.assignedTo.displayName})
                      </span>
                    )}
                  </div>
                ))}
              </td>
              <td className="px-4 py-3 text-sm">{calculateTotalQuantity(order)}</td>
              <td className="px-4 py-3 text-sm">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    order.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : order.status === 'approved'
                      ? 'bg-blue-100 text-blue-800'
                      : order.status === 'in_production'
                      ? 'bg-purple-100 text-purple-800'
                      : order.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {t[order.status]}
                </span>
              </td>
              <td className="px-4 py-3 text-sm">{t[order.priority]}</td>
              <td className="px-4 py-3 text-sm">{order.notes || '—'}</td>
              <td className="px-4 py-3 text-sm">{order.createdBy}</td>
              <td className="px-4 py-3 text-sm">
                <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  {order.status === 'pending' && (
                    <Button
                      variant="primary"
                      onClick={() => updateOrderStatus(order.id, 'approved')}
                      disabled={submitting === order.id}
                      className="bg-amber-500 hover:bg-amber-600 text-white rounded-md px-3 py-1 text-xs shadow-sm"
                      aria-label={t.approve}
                    >
                      {submitting === order.id ? '...' : t.approve}
                    </Button>
                  )}
                  {order.status === 'in_production' && (
                    <Button
                      variant="success"
                      onClick={() => updateOrderStatus(order.id, 'completed')}
                      disabled={submitting === order.id}
                      className="bg-green-500 hover:bg-green-600 text-white rounded-md px-3 py-1 text-xs shadow-sm"
                      aria-label={t.complete}
                    >
                      {submitting === order.id ? '...' : <CheckCircle className="w-4 h-4" />}
                    </Button>
                  )}
                  {['pending', 'approved', 'in_production'].includes(order.status) && (
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
                  {order.status === 'approved' && (
                    <Button
                      variant="secondary"
                      onClick={() => openAssignModal(order)}
                      disabled={submitting === order.id}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md px-3 py-1 text-xs shadow-sm"
                      aria-label={t.assignChefs}
                    >
                      <UserCheck className="w-4 h-4" />
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