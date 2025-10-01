import React, { memo, useCallback, useMemo } from 'react';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Select } from '../UI/Select';
import { Order, ReturnFormItem } from '../../types/types';
import { X } from 'lucide-react';

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

interface ReturnItemRowProps {
  index: number;
  item: ReturnFormItem;
  orderItems: Order['items'];
  updateItem: (index: number, field: keyof ReturnFormItem, value: any) => void;
  removeItem: (index: number) => void;
  t: (key: string, params?: any) => string;
  isRtl: boolean;
}

const returnReasonOptions = [
  { value: 'تالف', label: 'تالف', labelEn: 'Damaged' },
  { value: 'منتج خاطئ', label: 'منتج خاطئ', labelEn: 'Wrong Item' },
  { value: 'كمية زائدة', label: 'كمية زائدة', labelEn: 'Excess Quantity' },
  { value: 'أخرى', label: 'أخرى', labelEn: 'Other' },
];

// مكون لعرض صف واحد من عناصر الإرجاع
const ReturnItemRow: React.FC<ReturnItemRowProps> = memo(({ index, item, orderItems, updateItem, removeItem, t, isRtl }) => {
  const selectedItem = orderItems.find((i) => i.itemId === item.itemId);

  return (
    <div className="flex flex-col gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          {isRtl ? `عنصر ${index + 1}` : `Item ${index + 1}`}
        </span>
        {index > 0 && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => removeItem(index)}
            className="bg-red-500 hover:bg-red-600 text-white rounded-full px-3 py-1 text-xs"
          >
            {isRtl ? 'إزالة' : 'Remove'}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isRtl ? 'المنتج' : 'Product'}
          </label>
          <Select
            options={orderItems.map((item) => ({
              value: item.itemId,
              label: isRtl
                ? `${item.productName} (${item.quantity} ${t(`${item.unit || 'unit'}`)})`
                : `${item.productNameEn || item.productName} (${item.quantity} ${t(`units.${item.unitEn || item.unit || 'unit'}`)})`,
            }))}
            value={item.itemId}
            onChange={(value) => updateItem(index, 'itemId', value)}
            className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isRtl ? 'الكمية' : 'Quantity'}
          </label>
          <Input
            type="number"
            value={item.quantity}
            onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
            min={1}
            max={selectedItem?.quantity || 1}
            className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm"
            placeholder={isRtl ? 'أدخل الكمية' : 'Enter quantity'}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isRtl ? 'سبب الإرجاع' : 'Return Reason'}
          </label>
          <Select
            options={returnReasonOptions.map((opt) => ({
              value: opt.value,
              label: isRtl ? opt.label : opt.labelEn,
            }))}
            value={item.reason}
            onChange={(value) => updateItem(index, 'reason', value)}
            className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {isRtl ? 'ملاحظات' : 'Notes'}
        </label>
        <Input
          type="text"
          value={item.notes}
          onChange={(e) => updateItem(index, 'notes', e.target.value)}
          className="w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm"
          placeholder={isRtl ? 'أدخل ملاحظات إضافية (اختياري)' : 'Enter additional notes (optional)'}
        />
      </div>
    </div>
  );
});

ReturnItemRow.displayName = 'ReturnItemRow';

const ReturnModal: React.FC<Props> = memo(
  ({ isOpen, onClose, order, returnFormData, setReturnFormData, t, isRtl, onSubmit, submitting }) => {
    if (!order) return null;

    const addItem = useCallback(() => {
      setReturnFormData([
        ...returnFormData,
        { itemId: order.items[0]?.itemId || '', quantity: 1, reason: '', notes: '' },
      ]);
    }, [returnFormData, setReturnFormData, order.items]);

    const updateItem = useCallback(
      (index: number, field: keyof ReturnFormItem, value: any) => {
        const updatedItems = [...returnFormData];
        updatedItems[index] = { ...updatedItems[index], [field]: value };
        setReturnFormData(updatedItems);
      },
      [returnFormData, setReturnFormData]
    );

    const removeItem = useCallback(
      (index: number) => {
        setReturnFormData(returnFormData.filter((_, i) => i !== index));
      },
      [returnFormData, setReturnFormData]
    );

    const isFormValid = useMemo(
      () =>
        returnFormData.every(
          (item) =>
            item.itemId &&
            item.quantity > 0 &&
            item.reason &&
            item.quantity <= (order.items.find((i) => i.itemId === item.itemId)?.quantity || 0)
        ),
      [returnFormData, order.items]
    );

    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isRtl ? `طلب إرجاع للطلب #${order.orderNumber}` : `Return Request for Order #${order.orderNumber}`}
        icon={X}
        className="max-w-2xl w-full p-6 bg-white rounded-lg shadow-xl"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <form onSubmit={(e) => onSubmit(e, order, returnFormData)} className="space-y-6">
          <div className="space-y-4">
            {returnFormData.map((item, index) => (
              <ReturnItemRow
                key={index}
                index={index}
                item={item}
                orderItems={order.items}
                updateItem={updateItem}
                removeItem={removeItem}
                t={t}
                isRtl={isRtl}
              />
            ))}
          </div>
          <Button
            variant="secondary"
            onClick={addItem}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg px-4 py-2 text-sm w-full sm:w-auto"
          >
            {isRtl ? 'إضافة عنصر آخر' : 'Add Another Item'}
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
              {submitting === order.id
                ? isRtl
                  ? 'جاري الإرسال...'
                  : 'Submitting...'
                : isRtl
                ? 'إرسال طلب الإرجاع'
                : 'Submit Return Request'}
            </Button>
          </div>
        </form>
      </Modal>
    );
  }
);

ReturnModal.displayName = 'ReturnModal';

export default ReturnModal;