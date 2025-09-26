import React, { memo } from 'react';
import { Modal } from '../UI/Modal';
import { Order } from '../../types/types';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  t: (key: string, params?: any) => string;
  isRtl: boolean;
  calculateAdjustedTotal: (order: Order) => string;
}

const ViewModal: React.FC<Props> = memo(({ isOpen, onClose, order, t, isRtl, calculateAdjustedTotal }) => {
  if (!order) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isRtl ? `تفاصيل الطلب #${order.orderNumber}` : `Order Details #${order.orderNumber}`}
      icon={X}
      className="max-w-2xl w-full p-6 bg-white rounded-lg shadow-xl"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700">{isRtl ? 'رقم الطلب' : 'Order Number'}</p>
            <p className="text-base text-gray-900">{order.orderNumber}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">{isRtl ? 'الحالة' : 'Status'}</p>
            <p className="text-base text-gray-900">{t(`orders.status_${order.status}`)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">{isRtl ? 'إجمالي المبلغ' : 'Total Amount'}</p>
            <p className="text-base font-semibold text-teal-600">{calculateAdjustedTotal(order)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">{isRtl ? 'التاريخ' : 'Date'}</p>
            <p className="text-base text-gray-900">{order.date}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">{isRtl ? 'الأولوية' : 'Priority'}</p>
            <p className="text-base text-gray-900 capitalize">{t(`orders.priority_${order.priority}`)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">{isRtl ? 'الفرع' : 'Branch'}</p>
            <p className="text-base text-gray-900">{order.branch.displayName}</p>
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">{isRtl ? 'المنتجات' : 'Products'}</p>
          <div className="border border-gray-200 rounded-md overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-sm font-medium text-gray-600 text-right">{isRtl ? 'المنتج' : 'Product'}</th>
                  <th className="px-4 py-2 text-sm font-medium text-gray-600 text-right">{isRtl ? 'الكمية' : 'Quantity'}</th>
                  <th className="px-4 py-2 text-sm font-medium text-gray-600 text-right">{isRtl ? 'السعر' : 'Price'}</th>
                  <th className="px-4 py-2 text-sm font-medium text-gray-600 text-right">{isRtl ? 'القسم' : 'Department'}</th>
                  <th className="px-4 py-2 text-sm font-medium text-gray-600 text-right">{isRtl ? 'الحالة' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {order.items.map(item => (
                  <tr key={item.itemId}>
                    <td className="px-4 py-2 text-sm text-gray-600 text-right">{item.productName}</td>
                    <td className="px-4 py-2 text-sm text-gray-600 text-right">
                      {isRtl ? `${item.quantity} ${t(`units.${item.unit || 'unit'}`)}` : `${item.quantity} ${t(`units.${item.unit || 'unit'}`)}`}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 text-right">
                      {item.price.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 text-right">{item.department?.displayName || (isRtl ? 'غير معروف' : 'Unknown')}</td>
                    <td className="px-4 py-2 text-sm text-gray-600 text-right">{t(`orders.item_status_${item.status}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {order.returns?.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">{isRtl ? 'المرتجعات' : 'Returns'}</p>
            <div className="border border-amber-200 rounded-md overflow-x-auto">
              <table className="min-w-full divide-y divide-amber-100">
                <thead className="bg-amber-50">
                  <tr>
                    <th className="px-4 py-2 text-sm font-medium text-amber-600 text-right">{isRtl ? 'المنتج' : 'Product'}</th>
                    <th className="px-4 py-2 text-sm font-medium text-amber-600 text-right">{isRtl ? 'الكمية' : 'Quantity'}</th>
                    <th className="px-4 py-2 text-sm font-medium text-amber-600 text-right">{isRtl ? 'السبب' : 'Reason'}</th>
                    <th className="px-4 py-2 text-sm font-medium text-amber-600 text-right">{isRtl ? 'الحالة' : 'Status'}</th>
                    <th className="px-4 py-2 text-sm font-medium text-amber-600 text-right">{isRtl ? 'ملاحظات المراجعة' : 'Review Notes'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {order.returns.map((ret, i) =>
                    ret.items.map((item, j) => (
                      <tr key={`${i}-${j}`}>
                        <td className="px-4 py-2 text-sm text-gray-600 text-right">{item.productName}</td>
                        <td className="px-4 py-2 text-sm text-gray-600 text-right">
                          {isRtl ? `${item.quantity} ${t(`units.${item.unit || 'unit'}`)}` : `${item.quantity} ${t(`units.${item.unit || 'unit'}`)}`}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 text-right">{t(`orders.return_reasons_${item.reason}`)}</td>
                        <td className="px-4 py-2 text-sm text-gray-600 text-right">{t(`orders.return_status_${ret.status}`)}</td>
                        <td className="px-4 py-2 text-sm text-gray-600 text-right">{item.displayReviewNotes || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {order.displayNotes && (
          <div>
            <p className="text-sm font-medium text-gray-700">{isRtl ? 'ملاحظات' : 'Notes'}</p>
            <p className="text-base text-gray-900">{order.displayNotes}</p>
          </div>
        )}
        {order.statusHistory?.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">{isRtl ? 'سجل الحالة' : 'Status History'}</p>
            <div className="border border-gray-200 rounded-md p-4">
              {order.statusHistory.map((history, i) => (
                <div key={i} className="flex flex-col gap-1 mb-2 last:mb-0">
                  <p className="text-sm text-gray-600">
                    <strong>{isRtl ? 'الحالة' : 'Status'}:</strong> {t(`orders.status_${history.status}`)}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>{isRtl ? 'تم التغيير بواسطة' : 'Changed By'}:</strong> {history.changedByName}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>{isRtl ? 'التاريخ' : 'Date'}:</strong> {history.changedAt}
                  </p>
                  {history.displayNotes && (
                    <p className="text-sm text-gray-600">
                      <strong>{isRtl ? 'ملاحظات' : 'Notes'}:</strong> {history.displayNotes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
});

ViewModal.displayName = 'ViewModal';

export default ViewModal;