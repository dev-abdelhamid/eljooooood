import React, { memo, useEffect } from 'react';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { Eye, Check, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Return, ReturnStatus } from '../../types/types';
import { formatDate } from '../../utils/formatDate';

interface ReturnCardProps {
  ret: Return;
  isRtl: boolean;
  getStatusInfo: (status: ReturnStatus) => { color: string; icon: any; label: string };
  viewReturn: (ret: Return) => void;
  openActionModal: (ret: Return, type: 'approve' | 'reject') => void;
  submitting: string | null;
  user: any;
}

const ReturnCard: React.FC<ReturnCardProps> = memo(({ ret, isRtl, getStatusInfo, viewReturn, openActionModal, submitting, user }) => {
  const statusInfo = getStatusInfo(ret.status);
  const StatusIcon = statusInfo.icon;

  useEffect(() => {
    console.log(`ReturnCard - ID: ${ret.id}, Status: ${ret.status}, User Role: ${user?.role || 'none'}`);
  }, [ret.id, ret.status, user?.role]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-4"
    >
      <Card className="p-6 bg-white shadow-lg rounded-xl border border-gray-100 hover:shadow-xl transition-shadow duration-300">
        <div className="flex flex-col gap-4">
          <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h3 className="text-lg font-semibold text-gray-900">{isRtl ? 'رقم الإرجاع' : 'Return Number'}: {ret.returnNumber}</h3>
            <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
              <StatusIcon className="w-5 h-5" />
              {statusInfo.label}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">{isRtl ? 'رقم الطلب' : 'Order Number'}</p>
              <p className="text-base font-medium text-gray-900">{ret.order.orderNumber}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{isRtl ? 'عدد العناصر' : 'Items Count'}</p>
              <p className="text-base font-medium text-gray-900">{ret.items.length} {isRtl ? 'عناصر' : 'items'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{isRtl ? 'التاريخ' : 'Date'}</p>
              <p className="text-base font-medium text-gray-900">{formatDate(ret.createdAt, isRtl ? 'ar-SA' : 'en-US')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{isRtl ? 'الفرع' : 'Branch'}</p>
              <p className="text-base font-medium text-gray-900">{ret.branch.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{isRtl ? 'الإجمالي' : 'Total Amount'}</p>
              <p className="text-base font-medium text-teal-600">
                {ret.order.totalAmount.toFixed(2)} {isRtl ? 'ريال' : 'SAR'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{isRtl ? 'تم الإنشاء بواسطة' : 'Created By'}</p>
              <p className="text-base font-medium text-gray-900">{ret.createdBy?.username || ret.branch.name}</p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {ret.items.length > 0 ? (
              ret.items.map((item, index) => (
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
          {ret.notes && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
              <p className="text-sm text-amber-800">
                <strong>{isRtl ? 'ملاحظات:' : 'Notes:'}</strong> {ret.notes}
              </p>
            </div>
          )}
          {ret.reviewNotes && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-sm text-blue-800">
                <strong>{isRtl ? 'ملاحظات المراجعة:' : 'Review Notes:'}</strong> {ret.reviewNotes}
              </p>
            </div>
          )}
          {ret.statusHistory && ret.statusHistory.length > 0 && (
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <p className="text-sm font-semibold text-gray-900">{isRtl ? 'سجل الحالة' : 'Status History'}</p>
              {ret.statusHistory.map((history, index) => (
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
          <div className={`flex flex-col sm:flex-row gap-3 ${isRtl ? 'justify-end flex-row-reverse' : 'justify-end'}`}>
            <Button
              variant="primary"
              size="md"
              icon={Eye}
              onClick={() => viewReturn(ret)}
              className="bg-teal-600 hover:bg-teal-700 text-white rounded-full px-4 py-2 transition-colors"
              aria-label={isRtl ? `عرض المرتجع ${ret.returnNumber}` : `View Return ${ret.returnNumber}`}
            >
              {isRtl ? 'عرض' : 'View'}
            </Button>
            {ret.status === ReturnStatus.PendingApproval && ['production', 'admin'].includes(user?.role || '') ? (
              <>
                <Button
                  variant="success"
                  size="md"
                  icon={Check}
                  onClick={() => openActionModal(ret, 'approve')}
                  className="bg-green-600 hover:bg-green-700 text-white rounded-full px-4 py-2 transition-colors"
                  disabled={submitting === ret.id}
                  aria-label={isRtl ? `الموافقة على المرتجع ${ret.returnNumber}` : `Approve Return ${ret.returnNumber}`}
                >
                  {submitting === ret.id ? (isRtl ? 'جاري التحميل' : 'Loading') : isRtl ? 'الموافقة' : 'Approve'}
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  icon={AlertCircle}
                  onClick={() => openActionModal(ret, 'reject')}
                  className="bg-red-600 hover:bg-red-700 text-white rounded-full px-4 py-2 transition-colors"
                  disabled={submitting === ret.id}
                  aria-label={isRtl ? `رفض المرتجع ${ret.returnNumber}` : `Reject Return ${ret.returnNumber}`}
                >
                  {submitting === ret.id ? (isRtl ? 'جاري التحميل' : 'Loading') : isRtl ? 'رفض' : 'Reject'}
                </Button>
              </>
            ) : (
              <p className="text-sm text-gray-500">
                {ret.status !== ReturnStatus.PendingApproval
                  ? isRtl
                    ? `الإجراءات غير متاحة لحالة ${
                        ret.status === ReturnStatus.Approved ? 'تمت الموافقة' : ret.status === ReturnStatus.Rejected ? 'مرفوض' : 'تمت المعالجة'
                      }`
                    : `Actions unavailable for status ${ret.status}`
                  : isRtl
                  ? 'إجراءات غير مصرح بها'
                  : 'Actions unauthorized'}
              </p>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
});

export default ReturnCard;