import React, { memo } from 'react';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Order } from '../../types/types';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  returnId: string;
  t: (key: string, params?: any) => string;
  isRtl: boolean;
  handleApproveReturn: (orderId: string, returnId: string, status: 'approved' | 'rejected', notes?: string) => void;
  submitting: string | null;
}

const ApproveReturnModal: React.FC<Props> = memo(
  ({ isOpen, onClose, order, returnId, t, isRtl, handleApproveReturn, submitting }) => {
    if (!order) return null;

    const selectedReturn = order.returns?.find(ret => ret.returnId === returnId);

    const [notes, setNotes] = React.useState('');

    const handleSubmit = (e: React.FormEvent, status: 'approved' | 'rejected') => {
      e.preventDefault();
      handleApproveReturn(order.id, returnId, status, notes);
      setNotes('');
      onClose();
    };

    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isRtl ? `الموافقة على إرجاع الطلب #${order.orderNumber}` : `Approve Return for Order #${order.orderNumber}`}
        icon={X}
        className="max-w-lg w-full p-6 bg-white rounded-lg shadow-xl"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="space-y-6">
          <div>
            <p className="text-sm font-medium text-gray-700">{isRtl ? 'تفاصيل الإرجاع' : 'Return Details'}</p>
            <p className="text-sm text-gray-600">
              {selectedReturn?.items.map(item => 
                `${item.quantity} ${t(`units.${order.items.find(i => i.productId === item.productId)?.unit || 'unit'}`)} × ${order.items.find(i => i.productId === item.productId)?.productName || 'غير معروف'} (${t(`orders.return_reasons_${item.reason}`)})`
              ).join(', ')}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'ملاحظات' : 'Notes'}</label>
            <Input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm"
              placeholder={isRtl ? 'أدخل ملاحظات إضافية (اختياري)' : 'Enter additional notes (optional)'}
            />
          </div>
          <div className={`flex gap-4 ${isRtl ? 'justify-start' : 'justify-end'}`}>
            <Button
              variant="secondary"
              onClick={onClose}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg px-4 py-2 text-sm"
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              variant="success"
              onClick={(e) => handleSubmit(e, 'approved')}
              className="bg-green-500 hover:bg-green-600 text-white rounded-lg px-4 py-2 text-sm"
              disabled={submitting === order.id}
            >
              {isRtl ? 'الموافقة' : 'Approve'}
            </Button>
            <Button
              variant="danger"
              onClick={(e) => handleSubmit(e, 'rejected')}
              className="bg-red-500 hover:bg-red-600 text-white rounded-lg px-4 py-2 text-sm"
              disabled={submitting === order.id}
            >
              {isRtl ? 'رفض' : 'Reject'}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }
);

export default ApproveReturnModal;