import React from 'react';
import { Return, ReturnStatus, User } from '../../types/types';
import { formatDate } from '../../utils/formatDate';

interface ReturnTableProps {
  returns: Return[];
  isRtl: boolean;
  getStatusInfo: (status: ReturnStatus) => { color: string; icon: any; label: string };
  viewReturn: (ret: Return) => void;
  openActionModal: (ret: Return, type: 'approve' | 'reject') => void;
  submitting: string | null;
  user: User | null;
}

const ReturnTable: React.FC<ReturnTableProps> = ({ returns, isRtl, getStatusInfo, viewReturn, openActionModal, submitting, user }) => {
  return (
    <div className="overflow-x-auto rounded-xl shadow-lg border border-gray-100">
      <table className="min-w-full bg-white">
        <thead className="bg-teal-50 sticky top-0 z-10">
          <tr className={isRtl ? 'text-right' : 'text-left'}>
            <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{isRtl ? 'رقم المرتجع' : 'Return Number'}</th>
            <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{isRtl ? 'رقم الطلب' : 'Order Number'}</th>
            <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{isRtl ? 'الحالة' : 'Status'}</th>
            <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{isRtl ? 'التاريخ' : 'Date'}</th>
            <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{isRtl ? 'المنتجات' : 'Products'}</th>
            <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{isRtl ? 'الكميات' : 'Quantities'}</th>
            <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}</th>
            <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{isRtl ? 'الفرع' : 'Branch'}</th>
            <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{isRtl ? 'الإجمالي' : 'Total'}</th>
            <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{isRtl ? 'الإجراءات' : 'Actions'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {returns.map((ret) => {
            const totalQuantity = ret.items.reduce((sum, item) => sum + item.quantity, 0);
            return (
              <tr key={ret.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{ret.returnNumber}</td>
                <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{ret.order.orderNumber}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusInfo(ret.status).color}`}>
                    {getStatusInfo(ret.status).label}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{formatDate(ret.createdAt, isRtl ? 'ar-SA' : 'en-US')}</td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {ret.items.length > 0 ? ret.items.map((item) => item.productName).join(', ') : isRtl ? 'لا توجد منتجات' : 'No products'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {ret.items.length > 0 ? ret.items.map((item) => item.quantity).join(', ') : '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{totalQuantity}</td>
                <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{ret.branch.name}</td>
                <td className="px-4 py-3 text-sm text-teal-600 whitespace-nowrap">
                  {ret.order.totalAmount.toFixed(2)} {isRtl ? 'ريال' : 'SAR'}
                </td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">
                  <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <button
                      onClick={() => viewReturn(ret)}
                      className="text-teal-600 hover:text-teal-800 font-medium transition-colors"
                      disabled={submitting === ret.id}
                      aria-label={isRtl ? `عرض المرتجع ${ret.returnNumber}` : `View Return ${ret.returnNumber}`}
                    >
                      {isRtl ? 'عرض' : 'View'}
                    </button>
                    {user?.role === 'admin' && ret.status === ReturnStatus.PendingApproval && (
                      <>
                        <button
                          onClick={() => openActionModal(ret, 'approve')}
                          className="text-green-600 hover:text-green-800 font-medium transition-colors"
                          disabled={submitting === ret.id}
                          aria-label={isRtl ? `الموافقة على المرتجع ${ret.returnNumber}` : `Approve Return ${ret.returnNumber}`}
                        >
                          {isRtl ? 'موافقة' : 'Approve'}
                        </button>
                        <button
                          onClick={() => openActionModal(ret, 'reject')}
                          className="text-red-600 hover:text-red-800 font-medium transition-colors"
                          disabled={submitting === ret.id}
                          aria-label={isRtl ? `رفض المرتجع ${ret.returnNumber}` : `Reject Return ${ret.returnNumber}`}
                        >
                          {isRtl ? 'رفض' : 'Reject'}
                        </button>
                      </>
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

export default ReturnTable;