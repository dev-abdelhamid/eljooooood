import React, { memo } from 'react';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Select } from '../UI/Select';
import { Order, ReturnForm } from '../../types/types';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  returnFormData: ReturnForm;
  setReturnFormData: (data: ReturnForm) => void;
  t: (key: string, params?: any) => string;
  isRtl: boolean;
  handleReturnItem: (e: React.FormEvent, order: Order | null, returnFormData: ReturnForm) => void;
  submitting: string | null;
}

const returnReasonOptions = [
  { value: 'defective', label: 'defective' },
  { value: 'wrong_item', label: 'wrong_item' },
  { value: 'not_needed', label: 'not_needed' },
  { value: 'other', label: 'other' },
];

const ReturnModal: React.FC<Props> = memo(
  ({ isOpen, onClose, order, returnFormData, setReturnFormData, t, isRtl, handleReturnItem, submitting }) => {
    if (!order) return null;

    const selectedItem = order.items.find(item => item.itemId === returnFormData.itemId);

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Modal
          isOpen={isOpen}
          onClose={onClose}
          title={isRtl ? `طلب إرجاع للطلب #${order.orderNumber}` : `Return Request for Order #${order.orderNumber}`}
          icon={X}
          className="max-w-lg w-full p-6 bg-white rounded-lg shadow-xl border border-gray-100"
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          <form onSubmit={e => handleReturnItem(e, order, returnFormData)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isRtl ? 'المنتج' : 'Product'}
              </label>
              <Select
                options={order.items.map(item => ({
                  value: item.itemId,
                  label: isRtl
                    ? `${item.productName} (${item.quantity} ${t(`${item.unit || 'unit'}`)})`
                    : `${item.productName} (${item.quantity} ${t(`${item.unit || 'unit'}`)})`,
                }))}
                value={returnFormData.itemId}
                onChange={value => setReturnFormData({ ...returnFormData, itemId: value })}
                className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isRtl ? 'الكمية' : 'Quantity'}
              </label>
              <Input
                type="number"
                value={returnFormData.quantity}
                onChange={e => setReturnFormData({ ...returnFormData, quantity: Number(e.target.value) })}
                min={1}
                max={selectedItem?.quantity || 1}
                className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
                placeholder={isRtl ? 'أدخل الكمية' : 'Enter quantity'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isRtl ? 'سبب الإرجاع' : 'Return Reason'}
              </label>
              <Select
                options={returnReasonOptions.map(opt => ({
                  value: opt.value,
                  label: t(`orders.return_reasons_${opt.label}`),
                }))}
                value={returnFormData.reason}
                onChange={value => setReturnFormData({ ...returnFormData, reason: value })}
                className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isRtl ? 'ملاحظات' : 'Notes'}
              </label>
              <Input
                type="text"
                value={returnFormData.notes}
                onChange={e => setReturnFormData({ ...returnFormData, notes: e.target.value })}
                className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
                placeholder={isRtl ? 'أدخل ملاحظات إضافية (اختياري)' : 'Enter additional notes (optional)'}
              />
            </div>
            <div className={`flex gap-4 ${isRtl ? 'justify-start' : 'justify-end'}`}>
              <Button
                variant="secondary"
                onClick={onClose}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg px-4 py-2 text-sm shadow-sm"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                variant="primary"
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-4 py-2 text-sm shadow-sm"
                disabled={submitting === order.id}
              >
                {isRtl ? 'إرسال طلب الإرجاع' : 'Submit Return Request'}
              </Button>
            </div>
          </form>
        </Modal>
      </motion.div>
    );
  }
);

export default ReturnModal;