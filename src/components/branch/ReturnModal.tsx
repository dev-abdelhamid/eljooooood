// Now, the corrected ReturnModal component
import React, { memo, useCallback, useMemo, useState, useEffect } from 'react';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';
import Input from '../../pages/Input';  // Using the new custom Input
import Select from '../../pages/Select';  // Using the new custom Select
import { ReturnFormItem } from '../../types/types';
import { X } from 'lucide-react';
import { inventoryAPI } from '../../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;  // Use order directly to get items
  returnFormData: ReturnFormItem[];
  setReturnFormData: (data: ReturnFormItem[]) => void;
  t: (key: string, params?: any) => string;
  isRtl: boolean;
  onSubmit: (e: React.FormEvent, order: Order | null, returnFormData: ReturnFormItem[]) => void;
  submitting: string | null;
  branchId: string;
}

interface ReturnItemRowProps {
  index: number;
  item: ReturnFormItem & { maxQuantity: number; productName: string; unit: string };  // Added maxQuantity, productName, unit
  updateItem: (index: number, field: keyof ReturnFormItem, value: any) => void;
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
const ReturnItemRow: React.FC<ReturnItemRowProps> = memo(({ index, item, updateItem, t, isRtl }) => {
  return (
    <div className="flex flex-col gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          {isRtl ? `${item.productName} (${item.unit})` : `${item.productName} (${item.unit})`}  {/* Show product name instead of "Item X" */}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isRtl ? 'الكمية المرتجعة' : 'Return Quantity'}
          </label>
          <Input
            type="number"
            value={item.quantity}
            onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
            min={0}
            max={item.maxQuantity}
            placeholder={isRtl ? 'أدخل الكمية (0 للتجاهل)' : 'Enter quantity (0 to skip)'}
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
          placeholder={isRtl ? 'أدخل ملاحظات إضافية (اختياري)' : 'Enter additional notes (optional)'}
        />
      </div>
    </div>
  );
});

ReturnItemRow.displayName = 'ReturnItemRow';

const ReturnModal: React.FC<Props> = memo(
  ({ isOpen, onClose, order, returnFormData, setReturnFormData, t, isRtl, onSubmit, submitting, branchId }) => {
    const [inventoryItems, setInventoryItems] = useState<
      { productId: string; name: string; nameEn?: string; currentStock: number; unit?: string; unitEn?: string }[]
    >([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch inventory items for the branch and filter based on order items
    useEffect(() => {
      if (!isOpen || !branchId || !order) return;

      const fetchInventory = async () => {
        setLoading(true);
        try {
          const inventory = await inventoryAPI.getByBranch(branchId);
          const orderProductIds = order.items.map((item) => item.productId);
          const mappedItems = inventory
            .filter((item: any) => item.productId && orderProductIds.includes(item.productId) && item.currentStock > 0)
            .map((item: any) => ({
              productId: item.productId,
              name: item.product?.name || 'غير معروف',
              nameEn: item.product?.nameEn,
              currentStock: item.currentStock || 0,
              unit: item.product?.unit || 'unit',
              unitEn: item.product?.unitEn || 'unit',
            }));
          setInventoryItems(mappedItems);

          // Initialize returnFormData based on order items that have matching inventory
          const initialFormData = order.items
            .map((orderItem) => {
              const invItem = mappedItems.find((i) => i.productId === orderItem.productId);
              if (!invItem) return null;
              return {
                productId: orderItem.productId,
                itemId: orderItem.itemId,
                quantity: 0,  // Start with 0, user can set the return quantity
                reason: '',
                notes: '',
                maxQuantity: Math.min(orderItem.quantity, invItem.currentStock || 0),
                productName: isRtl ? invItem.name : invItem.nameEn || invItem.name,
                unit: isRtl ? invItem.unit : invItem.unitEn || invItem.unit,
              };
            })
            .filter((item): item is ReturnFormItem & { maxQuantity: number; productName: string; unit: string } => item !== null);
          setReturnFormData(initialFormData);
        } catch (err: any) {
          setError(isRtl ? `فشل في جلب المخزون: ${err.message}` : `Failed to fetch inventory: ${err.message}`);
        } finally {
          setLoading(false);
        }
      };

      fetchInventory();
    }, [isOpen, branchId, order, setReturnFormData, isRtl]);

    const updateItem = useCallback(
      (index: number, field: keyof ReturnFormItem, value: any) => {
        const updatedItems = [...returnFormData];
        updatedItems[index] = { ...updatedItems[index], [field]: value };
        setReturnFormData(updatedItems);
      },
      [returnFormData, setReturnFormData]
    );

    const isFormValid = useMemo(
      () =>
        returnFormData.some((item) => item.quantity > 0) &&
        returnFormData.every(
          (item) =>
            item.quantity === 0 ||
            (item.quantity > 0 &&
              item.reason &&
              item.quantity <= (item.maxQuantity || 0))
        ),
      [returnFormData]
    );

    if (!isOpen) return null;

    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isRtl ? (order ? `طلب إرجاع للطلب #${order.orderNumber}` : 'طلب إرجاع جديد') : (order ? `Return Request for Order #${order.orderNumber}` : 'New Return Request')}
        icon={X}
        className="max-w-2xl w-full p-6 bg-white rounded-lg shadow-xl"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {loading ? (
          <div className="text-center py-4">{isRtl ? 'جاري تحميل المخزون...' : 'Loading inventory...'}</div>
        ) : error ? (
          <div className="text-center text-red-600 py-4">{error}</div>
        ) : returnFormData.length === 0 ? (
          <div className="text-center py-4">{isRtl ? 'لا توجد عناصر قابلة للإرجاع في المخزون' : 'No returnable items in inventory'}</div>
        ) : (
          <form onSubmit={(e) => onSubmit(e, order, returnFormData.filter(item => item.quantity > 0))} className="space-y-6">  {/* Filter quantity > 0 on submit */}
            <div className="space-y-4">
              {returnFormData.map((item, index) => (
                <ReturnItemRow
                  key={index}
                  index={index}
                  item={item as ReturnFormItem & { maxQuantity: number; productName: string; unit: string }}
                  updateItem={updateItem}
                  t={t}
                  isRtl={isRtl}
                />
              ))}
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

ReturnModal.displayName = 'ReturnModal';

export default ReturnModal;