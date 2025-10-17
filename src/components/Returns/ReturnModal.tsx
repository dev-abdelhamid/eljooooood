import React from 'react';
import { Modal } from '../../components/UI/Modal';
import { formatDate } from '../../utils/formatDate';
import { Return, ReturnStatus } from '../../types/types';

interface ReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedReturn: Return | null;
  isRtl: boolean;
  getStatusInfo: (status: ReturnStatus) => { color: string; label: string; icon: any };
}

const ReturnModal: React.FC<ReturnModalProps> = ({ isOpen, onClose, selectedReturn, isRtl, getStatusInfo }) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={isRtl ? `عرض المرتجع ${selectedReturn?.returnNumber || ''}` : `View Return ${selectedReturn?.returnNumber || ''}`}
    size="lg"
    className="bg-white rounded-xl shadow-lg"
  >
    {selectedReturn && (
      <div className="space-y-6 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500">{isRtl ? 'رقم الطلب' : 'Order Number'}</p>
            <p className="text-base font-medium text-gray-900">{selectedReturn.order.orderNumber}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">{isRtl ? 'التاريخ' : 'Date'}</p>
            <p className="text-base font-medium text-gray-900">{formatDate(selectedReturn.createdAt, isRtl ? 'ar-SA' : 'en-US')}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">{isRtl ? 'الفرع' : 'Branch'}</p>
            <p className="text-base font-medium text-gray-900">{selectedReturn.branch.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">{isRtl ? 'الإجمالي' : 'Total Amount'}</p>
            <p className="text-base font-medium text-teal-600">
              {selectedReturn.order.totalAmount.toFixed(2)} {isRtl ? 'ريال' : 'SAR'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">{isRtl ? 'الحالة' : 'Status'}</p>
            <p className={`text-base font-medium ${getStatusInfo(selectedReturn.status).color}`}>
              {getStatusInfo(selectedReturn.status).label}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">{isRtl ? 'تم الإنشاء بواسطة' : 'Created By'}</p>
            <p className="text-base font-medium text-gray-900">{selectedReturn.createdBy?.username || selectedReturn.branch.name}</p>
          </div>
        </div>
        <div className="border-t border-gray-100 pt-4">
          <p className="text-sm font-semibold text-gray-900">{isRtl ? 'المنتجات' : 'Products'}</p>
          <div className="mt-2 space-y-3">
            {selectedReturn.items.length > 0 ? (
              selectedReturn.items.map((item, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors">
                  <p className="text-base font-medium text-gray-900">{item.productName}</p>
                  <p className="text-sm text-gray-600">{isRtl ? `الكمية: ${item.quantity}` : `Quantity: ${item.quantity}`}</p>
                  <p className="text-sm text-gray-600">{isRtl ? `السبب: ${item.reason || 'غير محدد'}` : `Reason: ${item.reason || 'Not specified'}`}</p>
                  {item.price && (
                    <p className="text-sm text-gray-600">{isRtl ? `السعر: ${item.price.toFixed(2)} ريال` : `Price: ${item.price.toFixed(2)} SAR`}</p>
                  )}
                  {item.status && (
                    <p className={`text-sm ${item.status === ReturnStatus.Approved ? 'text-green-600' : item.status === ReturnStatus.Rejected ? 'text-red-600' : 'text-gray-600'}`}>
                      {isRtl
                        ? `حالة العنصر: ${
                            item.status === ReturnStatus.Approved
                              ? 'تمت الموافقة'
                              : item.status === ReturnStatus.Rejected
                              ? 'مرفوض'
                              : item.status === ReturnStatus.Processed
                              ? 'تمت المعالجة'
                              : 'في انتظار الموافقة'
                          }`
                        : `Item Status: ${item.status}`}
                    </p>
                  )}
                  {item.reviewNotes && (
                    <p className="text-sm text-gray-600">{isRtl ? `ملاحظات المراجعة: ${item.reviewNotes}` : `Review Notes: ${item.reviewNotes}`}</p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">{isRtl ? 'لا توجد عناصر' : 'No items'}</p>
            )}
          </div>
        </div>
        {selectedReturn.notes && (
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
            <p className="text-sm text-amber-800"><strong>{isRtl ? 'ملاحظات:' : 'Notes:'}</strong> {selectedReturn.notes}</p>
          </div>
        )}
        {selectedReturn.reviewNotes && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-sm text-blue-800"><strong>{isRtl ? 'ملاحظات المراجعة:' : 'Review Notes:'}</strong> {selectedReturn.reviewNotes}</p>
          </div>
        )}
        {selectedReturn.statusHistory && selectedReturn.statusHistory.length > 0 && (
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-sm font-semibold text-gray-900">{isRtl ? 'سجل الحالة' : 'Status History'}</p>
            {selectedReturn.statusHistory.map((history, index) => (
              <p key={index} className="text-sm text-gray-600">
                {isRtl
                  ? `تم تغيير الحالة إلى ${history.status} بواسطة ${history.changedBy} في ${formatDate(history.changedAt, 'ar-SA')} ${
                      history.notes ? `ملاحظات: ${history.notes}` : 'لا توجد ملاحظات'
                    }`
                  : `Status changed to ${history.status} by ${history.changedBy} on ${formatDate(history.changedAt, 'en-US')} ${
                      history.notes ? `Notes: ${history.notes}` : 'No notes'
                    }`}
              </p>
            ))}
          </div>
        )}
      </div>
    )}
  </Modal>
);
export default ReturnModal;