import React, { useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';
import { Select } from '../UI/Select';
import { AlertCircle } from 'lucide-react';
import { Order, Chef, AssignChefsForm } from '../../types';

const departmentLabels: Record<string, string> = {
  bread: 'departments.bread',
  pastries: 'departments.pastries',
  cakes: 'departments.cakes',
  unknown: 'departments.unknown',
};

interface AssignChefsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOrder: Order | null;
  assignFormData: AssignChefsForm;
  chefs: Chef[];
  error: string | null;
  submitting: string | null;
  assignChefs: (orderId: string) => void;
  setAssignForm: (formData: AssignChefsForm) => void;
  t: (key: string, params?: any) => string;
  isRtl: boolean;
}

const AssignChefsModal: React.FC<AssignChefsModalProps> = ({
  isOpen,
  onClose,
  selectedOrder,
  assignFormData,
  chefs,
  error,
  submitting,
  assignChefs,
  setAssignForm,
  t,
  isRtl,
}) => {
  const availableChefsByDepartment = useMemo(() => {
    const map = new Map<string, Chef[]>();
    chefs.forEach((chef) => {
      if (chef.department?._id) {
        if (!map.has(chef.department._id)) map.set(chef.department._id, []);
        map.get(chef.department._id)!.push(chef);
      }
    });
    return map;
  }, [chefs]);

  const updateAssignment = useCallback(
    (index: number, value: string) => {
      setAssignForm({
        items: assignFormData.items.map((i, idx) =>
          idx === index ? { ...i, assignedTo: value } : i
        ),
      });
    },
    [assignFormData.items, setAssignForm]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (selectedOrder?.id) assignChefs(selectedOrder.id);
    },
    [selectedOrder, assignChefs]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('orders.assign_chefs_title', { orderNumber: selectedOrder?.orderNumber || '' }) || (isRtl ? `تعيين شيفات للطلب ${selectedOrder?.orderNumber || ''}` : `Assign Chefs for Order ${selectedOrder?.orderNumber || ''}`)}
      size="sm"
      className="bg-white rounded-lg shadow-xl max-w-md mx-auto"
      ariaLabel={t('orders.assign_chefs') || (isRtl ? 'تعيين شيفات' : 'Assign Chefs')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {assignFormData.items.map((item, index) => {
          const orderItem = selectedOrder?.items.find((i) => i._id === item.itemId);
          const departmentId = orderItem?.department?._id || '';
          const departmentName = orderItem?.department?.name
            ? t(departmentLabels[orderItem.department.name] || departmentLabels.unknown)
            : t(departmentLabels.unknown) || (isRtl ? 'غير معروف' : 'Unknown');
          const availableChefs = availableChefsByDepartment.get(departmentId) || [];
          return (
            <motion.div
              key={item.itemId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.1 }}
              className="space-y-1"
            >
              <label
                className="block text-xs font-medium text-gray-700"
                htmlFor={`chef-select-${item.itemId}`}
              >
                {t('orders.assign_chef_to', {
                  product: orderItem?.productName || t('common.unknown'),
                  quantity: item.quantity,
                  unit: t(`units.${item.unit || 'unit'}`) || (isRtl ? { unit: 'وحدة', kg: 'كجم', piece: 'قطعة' }[item.unit || 'unit'] : item.unit || 'unit'),
                }) || (isRtl
                  ? `تعيين شيف لـ ${orderItem?.productName || 'غير معروف'} (${item.quantity} ${{
                      unit: 'وحدة',
                      kg: 'كجم',
                      piece: 'قطعة',
                    }[item.unit || 'unit']})`
                  : `Assign chef to ${orderItem?.productName || 'Unknown'} (${item.quantity} ${item.unit || 'unit'})`)}
              </label>
              <Select
                id={`chef-select-${item.itemId}`}
                options={[
                  { value: '', label: t('orders.select_chef') || (isRtl ? 'اختر شيف' : 'Select Chef') },
                  ...availableChefs.map((chef) => ({
                    value: chef.userId,
                    label: `${chef.name} (${t(departmentLabels[chef.department?.name || 'unknown']) || (isRtl ? { bread: 'المخبوزات', pastries: 'المعجنات', cakes: 'الكعك', unknown: 'غير معروف' }[chef.department?.name || 'unknown'] : chef.department?.name || 'Unknown')})`,
                  })),
                ]}
                value={item.assignedTo}
                onChange={(value) => updateAssignment(index, value)}
                className="w-full rounded-md border-gray-200 text-sm focus:ring-amber-500"
                aria-label={t('orders.select_chef') || (isRtl ? 'اختر شيف' : 'Select Chef')}
              />
            </motion.div>
          );
        })}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-600 ${isRtl ? 'flex-row-reverse' : ''}`}
            role="alert"
          >
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </motion.div>
        )}
        <div className={`flex gap-2 ${isRtl ? 'justify-end flex-row-reverse' : 'justify-end'}`}>
          <Button
            variant="secondary"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700"
            aria-label={t('common.cancel') || (isRtl ? 'إلغاء' : 'Cancel')}
          >
            {t('common.cancel') || (isRtl ? 'إلغاء' : 'Cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting !== null || !assignFormData.items.some((item) => item.assignedTo)}
            className="rounded-md px-3 py-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50"
            aria-label={t('orders.assign_chefs') || (isRtl ? 'تعيين شيفات' : 'Assign Chefs')}
          >
            {submitting ? (t('common.loading') || (isRtl ? 'جارٍ التحميل' : 'Loading')) : t('orders.assign_chefs') || (isRtl ? 'تعيين شيفات' : 'Assign Chefs')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AssignChefsModal;