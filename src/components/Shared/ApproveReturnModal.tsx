import React, { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';
import { Textarea } from '../UI/Textarea';
import { AlertCircle } from 'lucide-react';
import { Order } from '../../types';

interface ApproveReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  returnId: string;
  t: (key: string, params?: any) => string;
  isRtl: boolean;
  handleApproveReturn: (orderId: string, returnId: string, status: 'approved' | 'rejected', notes?: string) => void;
  submitting: string | null;
}

const ApproveReturnModal: React.FC<ApproveReturnModalProps> = ({
  isOpen,
  onClose,
  order,
  returnId,
  t,
  isRtl,
  handleApproveReturn,
  submitting,
}) => {
  const [notes, setNotes] = useState('');
  const returnData = order?.returns?.find(ret => ret.returnId === returnId);

  const handleSubmit = useCallback(
    (status: 'approved' | 'rejected') => {
      if (order?.id) {
        handleApproveReturn(order.id, returnId, status, notes);
        setNotes('');
        onClose();
      }
    },
    [order, returnId, notes, handleApproveReturn, onClose]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('orders.approve_return_title', { returnId }) || (isRtl ? `الموافقة على إرجاع ${returnId}` : `Approve Return ${returnId}`)}
      size="md"
      className="bg-white rounded-lg shadow-xl"
      ariaLabel={t('orders.approve_return')}
    >
      <div className="space-y-6">
        {returnData && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <h3 className="text-sm font-medium text-gray-800">
              {t('orders.return_details') || (isRtl ? 'تفاصيل الإرجاع' : 'Return Details')}
            </h3>
            <ul className="mt-2 space-y-2 text-xs">
              {returnData.items.map((item, index) => (
                <li key={index} className="flex justify-between gap-2">
                  <span>
                    {item.quantity} {t(`units.${item.unit || 'unit'}`) || (isRtl ? { unit: 'وحدة', kg: 'كجم', piece: 'قطعة' }[item.unit || 'unit'] : item.unit || 'unit')} - {item.reason}
                  </span>
                  <span>{t(`orders.return_status_${returnData.status}`) || (isRtl
                    ? returnData.status === 'pending_approval' ? 'قيد الموافقة'
                      : returnData.status === 'approved' ? 'تم الموافقة'
                      : 'مرفوض'
                    : returnData.status)}</span>
                </li>
              ))}
            </ul>
            {returnData.reviewNotes && (
              <p className="mt-2 text-xs text-gray-600">
                <strong>{t('orders.review_notes') || (isRtl ? 'ملاحظات المراجعة' : 'Review Notes')}:</strong> {returnData.reviewNotes}
              </p>
            )}
          </motion.div>
        )}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
        >
          <label htmlFor="return-notes" className="block text-sm font-medium text-gray-900 mb-1">
            {t('orders.notes') || (isRtl ? 'ملاحظات' : 'Notes')}
          </label>
          <Textarea
            id="return-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('orders.notes_placeholder') || (isRtl ? 'أدخل ملاحظات الإرجاع...' : 'Enter return notes...')}
            className="w-full rounded-lg border-gray-300 focus:ring-blue-500 text-xs"
            aria-label={t('orders.notes')}
          />
        </motion.div>
        {submitting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}
            role="alert"
          >
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-600">{t('common.loading') || (isRtl ? 'جارٍ التحميل' : 'Loading')}</span>
          </motion.div>
        )}
        <div className={`flex justify-end gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <Button
            variant="secondary"
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-full px-4 py-2 text-sm"
            aria-label={t('common.cancel') || (isRtl ? 'إلغاء' : 'Cancel')}
          >
            {t('common.cancel') || (isRtl ? 'إلغاء' : 'Cancel')}
          </Button>
          <Button
            variant="success"
            onClick={() => handleSubmit('approved')}
            className="bg-green-600 hover:bg-green-700 text-white rounded-full px-4 py-2 text-sm"
            disabled={submitting === order?.id}
            aria-label={t('orders.approve') || (isRtl ? 'موافقة' : 'Approve')}
          >
            {t('orders.approve') || (isRtl ? 'موافقة' : 'Approve')}
          </Button>
          <Button
            variant="danger"
            onClick={() => handleSubmit('rejected')}
            className="bg-red-600 hover:bg-red-700 text-white rounded-full px-4 py-2 text-sm"
            disabled={submitting === order?.id}
            aria-label={t('orders.reject') || (isRtl ? 'رفض' : 'Reject')}
          >
            {t('orders.reject') || (isRtl ? 'رفض' : 'Reject')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ApproveReturnModal;