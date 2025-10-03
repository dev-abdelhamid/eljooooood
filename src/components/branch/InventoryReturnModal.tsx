import React, { memo, useCallback, useMemo, useState, useEffect } from 'react';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Select } from '../UI/Select';
import { ReturnFormItem } from '../../components/branch/types';
import { X } from 'lucide-react';
import { inventoryAPI } from '../../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  returnFormData: ReturnFormItem[];
  setReturnFormData: (data: ReturnFormItem[]) => void;
  t: (key: string, params?: any) => string;
  isRtl: boolean;
  onSubmit: (e: React.FormEvent, returnFormData: ReturnFormItem[]) => void;
  submitting: string | null;
  branchId: string;
}

interface ReturnItemRowProps {
  index: number;
  item: ReturnFormItem;
  inventoryItems: { productId: string; name: string; nameEn?: string; currentStock: number; unit?: string; unitEn?: string }[];
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

// Component for rendering a single return item row
const ReturnItemRow: React.FC<ReturnItemRowProps> = memo(({ index, item, inventoryItems, updateItem, removeItem, t, isRtl }) => {
  const selectedItem = inventoryItems.find((i) => i.productId === item.productId);

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
            options={inventoryItems.map((item) => ({
              value: item.productId,
              label: isRtl
                ? `${item.name} (${item.currentStock} ${t(`${item.unit || 'unit'}`)})`
                : `${item.nameEn || item.name} (${item.currentStock} ${t(`units.${item.unitEn || item.unit || 'unit'}`)})`,
            }))}
            value={item.productId}
            onChange={(value) => updateItem(index, 'productId', value)}
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
            max={selectedItem?.currentStock || 1}
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

const InventoryReturnModal: React.FC<Props> = memo(
  ({ isOpen, onClose, returnFormData, setReturnFormData, t, isRtl, onSubmit, submitting, branchId }) => {
    const [inventoryItems, setInventoryItems] = useState<
      { productId: string; name: string; nameEn?: string; currentStock: number; unit?: string; unitEn?: string }[]
    >([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch inventory items for the branch
    useEffect(() => {
      if (!isOpen || !branchId) return;

      const fetchInventory = async () => {
        setLoading(true);
        try {
          const inventory = await inventoryAPI.getByBranch(branchId);
          const mappedItems = inventory
            .filter((item: any) => item.productId && item.currentStock > 0)
            .map((item: any) => ({
              productId: item.productId,
              name: item.product?.name || 'غير معروف',
              nameEn: item.product?.nameEn,
              currentStock: item.currentStock || 0,
              unit: item.product?.unit || 'unit',
              unitEn: item.product?.unitEn || 'unit',
            }));
          setInventoryItems(mappedItems);

          // Initialize returnFormData if empty
          if (!returnFormData.length && mappedItems.length > 0) {
            setReturnFormData([{ productId: mappedItems[0].productId, quantity: 1, reason: '', notes: '' }]);
          }
        } catch (err: any) {
          setError(isRtl ? `فشل في جلب المخزون: ${err.message}` : `Failed to fetch inventory: ${err.message}`);
        } finally {
          setLoading(false);
        }
      };

      fetchInventory();
    }, [isOpen, branchId, setReturnFormData, isRtl]);

    const addItem = useCallback(() => {
      setReturnFormData([
        ...returnFormData,
        { productId: inventoryItems[0]?.productId || '', quantity: 1, reason: '', notes: '' },
      ]);
    }, [returnFormData, setReturnFormData, inventoryItems]);

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
            item.productId &&
            item.quantity > 0 &&
            item.reason &&
            item.quantity <= (inventoryItems.find((i) => i.productId === item.productId)?.currentStock || 0)
        ),
      [returnFormData, inventoryItems]
    );

    if (!isOpen) return null;

    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isRtl ? 'طلب إرجاع من المخزون' : 'Inventory Return Request'}
        icon={X}
        className="max-w-2xl w-full p-6 bg-white rounded-lg shadow-xl"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {loading ? (
          <div className="text-center py-4">{isRtl ? 'جاري تحميل المخزون...' : 'Loading inventory...'}</div>
        ) : error ? (
          <div className="text-center text-red-600 py-4">{error}</div>
        ) : (
          <form onSubmit={(e) => onSubmit(e, null, returnFormData)} className="space-y-6">
            <div className="space-y-4">
              {returnFormData.map((item, index) => (
                <ReturnItemRow
                  key={index}
                  index={index}
                  item={item}
                  inventoryItems={inventoryItems}
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
              disabled={inventoryItems.length === 0}
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
                disabled={submitting || !isFormValid || inventoryItems.length === 0}
              >
                {submitting
                  ? isRtl
                    ? 'جاري الإرسال...'
                    : 'Submitting...'
                  : isRtl
                  ? 'إرسال طلب الإرجاع'
                  : 'Submit Return Request'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    );
  }
);

InventoryReturnModal.displayName = 'InventoryReturnModal';

export default InventoryReturnModal;