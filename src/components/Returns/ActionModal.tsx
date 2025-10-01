import React from 'react';
import { Modal } from '../../components/UI/Modal';
import { Input } from '../../components/UI/Input';
import { Button } from '../../components/UI/Button';
import { Return } from '../../types/types';

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedReturn: Return | null;
  actionType: 'approve' | 'reject' | null;
  actionNotes: string;
  submitting: string | null;
  isRtl: boolean;
  handleActionSubmit: () => void;
  setActionNotes: (notes: string) => void;
}

const ActionModal: React.FC<ActionModalProps> = ({
  isOpen,
  onClose,
  selectedReturn,
  actionType,
  actionNotes,
  submitting,
  isRtl,
  handleActionSubmit,
  setActionNotes,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={isRtl ? `${actionType === 'approve' ? 'الموافقة' : 'رفض'} المرتجع ${selectedReturn?.returnNumber || ''}` : `${actionType === 'approve' ? 'Approve' : 'Reject'} Return ${selectedReturn?.returnNumber || ''}`}
    size="md"
    className="bg-white rounded-xl shadow-lg"
  >
    <div className="space-y-6 p-4">
      <p className="text-sm text-gray-600">
        {isRtl ? `هل أنت متأكد من ${actionType === 'approve' ? 'الموافقة' : 'رفض'} هذا المرتجع؟` : `Are you sure you want to ${actionType === 'approve' ? 'approve' : 'reject'} this return?`}
      </p>
      <Input
        label={isRtl ? 'ملاحظات المراجعة (اختياري)' : 'Review Notes (Optional)'}
        value={actionNotes}
        onChange={(e) => setActionNotes(e.target.value)}
        placeholder={isRtl ? 'أدخل ملاحظات المراجعة (اختياري)' : 'Enter review notes (optional)'}
        className={`w-full rounded-lg border-gray-200 focus:ring-teal-500 focus:border-teal-500 py-2.5 ${isRtl ? 'text-right' : 'text-left'} transition-all duration-200`}
        aria-label={isRtl ? 'ملاحظات المراجعة' : 'Review Notes'}
      />
      <div className={`flex gap-3 ${isRtl ? 'justify-end flex-row-reverse' : 'justify-end'}`}>
        <Button
          variant="secondary"
          size="sm"
          onClick={onClose}
          className="bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full px-4 py-2 transition-colors"
          aria-label={isRtl ? 'إلغاء' : 'Cancel'}
        >
          {isRtl ? 'إلغاء' : 'Cancel'}
        </Button>
        <Button
          variant={actionType === 'approve' ? 'success' : 'danger'}
          size="sm"
          onClick={handleActionSubmit}
          disabled={submitting === selectedReturn?.id}
          className={`${
            actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
          } text-white rounded-full px-4 py-2 transition-colors`}
          aria-label={isRtl ? (actionType === 'approve' ? 'تأكيد الموافقة' : 'تأكيد الرفض') : (actionType === 'approve' ? 'Confirm Approval' : 'Confirm Rejection')}
        >
          {submitting === selectedReturn?.id
            ? isRtl ? 'جاري التحميل' : 'Loading'
            : isRtl ? (actionType === 'approve' ? 'تأكيد الموافقة' : 'تأكيد الرفض') : (actionType === 'approve' ? 'Confirm Approval' : 'Confirm Rejection')}
        </Button>
      </div>
    </div>
  </Modal>
);

export default ActionModal;