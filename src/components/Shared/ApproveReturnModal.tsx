import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';
import { AlertCircle } from 'lucide-react';
import { Order, ReturnStatus } from '../../types/types';

interface ApproveReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  returnId: string;
  isRtl: boolean;
  handleApproveReturn: (orderId: string, returnId: string, status: ReturnStatus, notes?: string) => void;
  submitting: string | null;
}

const ApproveReturnModal: React.FC<ApproveReturnModalProps> = ({
  isOpen,
  onClose,
  order,
  returnId,
  isRtl,
  handleApproveReturn,
  submitting,
}) => {
  const [notes, setNotes] = useState('');
  const returnData = order?.returns.find(ret => ret.returnId === returnId);

  const handleSubmit = useCallback(
    (status: ReturnStatus) => {
      if (order?.id) {
        handleApproveReturn(order.id, returnId, status, notes);
        setNotes('');
        onClose();
      }
    },
    [order, returnId, notes, handleApproveReturn, onClose]
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isRtl ? `موافقة على إرجاع ${returnId}` : `Approve Return ${returnId}`} size="md" className="bg-white rounded-lg shadow-xl">
      <div className="space-y-4 p-4">
        {returnData && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-50 p-3 rounded-md shadow-sm">
            <h3 className="text-sm font-medium mb-2">{isRtl ? 'تفاصيل الإرجاع' : 'Return Details'}</h3>
            <ul className="space-y-2 text-xs">
              {returnData.items.map((item, idx) => (
                <li key={idx} className="flex justify-between gap-2 truncate">
                  <span>{item.quantity} {item.displayUnit} - {item.displayReason}</span>
                  <span>{isRtl ? { pending: 'قيد الانتظار', approved: 'تم الموافقة', rejected: 'مرفوض', processed: 'معالج' }[returnData.status] : returnData.status}</span>
                </li>
              ))}
            </ul>
            {returnData.displayReviewNotes && <p className="mt-2 text-xs text-gray-600 truncate">{returnData.displayReviewNotes}</p>}
          </motion.div>
        )}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={isRtl ? 'أدخل ملاحظات...' : 'Enter notes...'}
          className="w-full border-gray-200 rounded-md p-2 text-xs focus:ring-blue-500 shadow-sm resize-none h-20"
        />
        {submitting && <div className="text-red-600 text-xs flex gap-1 items-center"><AlertCircle className="w-4 h-4" /> {isRtl ? 'جاري...' : 'Submitting...'}</div>}
        <div className={`flex gap-2 ${isRtl ? 'justify-start flex-row-reverse' : 'justify-end'}`}>
          <Button variant="secondary" onClick={onClose} className="text-xs px-3 py-1 rounded-full shadow-md">{isRtl ? 'إلغاء' : 'Cancel'}</Button>
          <Button variant="success" onClick={() => handleSubmit(ReturnStatus.Approved)} disabled={!!submitting} className="text-xs px-3 py-1 rounded-full shadow-md">{isRtl ? 'موافقة' : 'Approve'}</Button>
          <Button variant="danger" onClick={() => handleSubmit(ReturnStatus.Rejected)} disabled={!!submitting} className="text-xs px-3 py-1 rounded-full shadow-md">{isRtl ? 'رفض' : 'Reject'}</Button>
        </div>
      </div>
    </Modal>
  );
};

export default ApproveReturnModal;