import React, { memo, useState } from 'react';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Select } from '../UI/Select';
import { Order, ReturnFormItem } from '../../types/types';
import { X, Plus, Trash2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  returnFormData: ReturnFormItem[];
  setReturnFormData: (data: ReturnFormItem[]) => void;
  t: (key: string, params?: any) => string;
  isRtl: boolean;
  onSubmit: (e: React.FormEvent, order: Order | null, returnFormData: ReturnFormItem[]) => void;
  submitting: string | null;
}

const returnReasonOptions = [
  { value: 'defective', label: 'defective' },
  { value: 'wrong_item', label: 'wrong_item' },
  { value: 'not_needed', label: 'not_needed' },
  { value: 'other', label: 'other' },
];

const ReturnModal: React.FC<Props> = memo(
  ({ isOpen, onClose, order, returnFormData, setReturnFormData, t, isRtl, onSubmit, submitting }) => {
    if (!order) return null;

    const addItem = () => {
      setReturnFormData([...returnFormData, { itemId: '', quantity: 0, reason: '', notes: '' }]);
    };

    const removeItem = (index: number) => {
      setReturnFormData(returnFormData.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: keyof ReturnFormItem, value: string | number) => {
      const updatedItems = [...returnFormData];
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      setReturnFormData(updatedItems);
    };

    const validateItem = (item: ReturnFormItem, index: number) => {
      const selectedItem = order.items.find(i => i.itemId === item.itemId);
      if (!selectedItem) return t('orders.select_product');
      if (item.quantity <= 0) return t('orders.quantity_required');
      if (item.quantity > (selectedItem.quantity - (selectedItem.returnedQuantity || 0))) {
        return t('orders.quantity_exceeds_available', { available: selectedItem.quantity - (selectedItem.returnedQuantity || 0) });
      }
      if (!item.reason) return t('orders.reason_required');
      return '';
    };

    const isFormValid = returnFormData.every((item, index) => !validateItem(item, index));

    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isRtl ? `طلب إرجاع للطلب #${order.orderNumber}` : `Return Request for Order #${order.orderNumber}`}
        icon={X}
        className="max-w-2xl w-full p-6 bg-white rounded-lg shadow-xl"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <form onSubmit={e => onSubmit(e, order, returnFormData)} className="space-y-6">
          {returnFormData.map((item, index) => (
            <div key={index} className="border p-4 rounded-lg relative">
              {returnFormData.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="absolute top-2 right-2 text-red-500 hover:text-red-600"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'المنتج' : 'Product'}</label>
                  <Select
                    options={order.items
                      .filter(i => i.quantity - (i.returnedQuantity || 0) > 0)
                      .map(item => ({
                        value: item.itemId,
                        label: isRtl
                          ? `${item.productName} (${item.quantity - (item.returnedQuantity || 0)} ${t(`units.${item.unit || 'unit'}`)})`
                          : `${item.productName} (${item.quantity - (item.returnedQuantity || 0)} ${t(`units.${item.unit || 'unit'}`)})`,
                      }))}
                    value={item.itemId}
                    onChange={value => updateItem(index, 'itemId', value)}
                    className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm"
                  />
                  {validateItem(item, index) && (
                    <p className="text-xs text-red-500 mt-1">{validateItem(item, index)}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'الكمية' : 'Quantity'}</label>
                  <Input
                    type="number"
                    value={item.quantity}
                    onChange={e => updateItem(index, 'quantity', Number(e.target.value))}
                    min={1}
                    max={order.items.find(i => i.itemId === item.itemId)?.quantity - (order.items.find(i => i.itemId === item.itemId)?.returnedQuantity || 0) || 1}
                    className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm"
                    placeholder={isRtl ? 'أدخل الكمية' : 'Enter quantity'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'سبب الإرجاع' : 'Return Reason'}</label>
                  <Select
                    options={returnReasonOptions.map(opt => ({
                      value: opt.value,
                      label: t(`orders.return_reasons_${opt.label}`),
                    }))}
                    value={item.reason}
                    onChange={value => updateItem(index, 'reason', value)}
                    className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'ملاحظات' : 'Notes'}</label>
                  <Input
                    type="text"
                    value={item.notes}
                    onChange={e => updateItem(index, 'notes', e.target.value)}
                    className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm"
                    placeholder={isRtl ? 'أدخل ملاحظات إضافية (اختياري)' : 'Enter additional notes (optional)'}
                  />
                </div>
              </div>
            </div>
          ))}
          <Button
            type="button"
            onClick={addItem}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2 text-sm"
          >
            <Plus className="w-5 h-5" />
            {isRtl ? 'إضافة منتج آخر' : 'Add Another Item'}
          </Button>
          <div className={`flex gap-4 ${isRtl ? 'justify-start' : 'justify-end'}`}>
            <Button
              variant="secondary"
              onClick={onClose}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg px-4 py-2 text-sm"
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              variant="primary"
              type="submit"
              className="bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-4 py-2 text-sm"
              disabled={submitting === order.id || !isFormValid}
            >
              {isRtl ? 'إرسال طلب الإرجاع' : 'Submit Return Request'}
            </Button>
          </div>
        </form>
      </Modal>
    );
  }
);

ReturnModal.displayName = 'ReturnModal';

export default ReturnModal;