import React, { useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';
import { Select } from '../UI/Select';
import { AlertCircle } from 'lucide-react';
import { Order, Chef, AssignChefsForm } from '../../types/types';

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
  isRtl,
}) => {
  const availableChefsByDepartment = useMemo(() => {
    const map = new Map<string, Chef[]>();
    chefs.forEach((chef) => {
      const deptId = chef.department?._id || 'unknown';
      if (!map.has(deptId)) map.set(deptId, []);
      map.get(deptId)!.push(chef);
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
      title={isRtl ? `تعيين الشيفات لطلب ${selectedOrder?.orderNumber || ''}` : `Assign Chefs for Order ${selectedOrder?.orderNumber || ''}`}
      size="sm"
      className="bg-white rounded-lg shadow-xl max-w-md mx-auto"
      ariaLabel={isRtl ? 'تعيين الشيفات' : 'Assign Chefs'}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {assignFormData.items.map((item, index) => {
          const orderItem = selectedOrder?.items.find((i) => i._id === item.itemId);
          const departmentId = orderItem?.department?._id || 'unknown';
          const departmentName = isRtl
            ? {
                bread: 'المخبوزات',
                pastries: 'المعجنات',
                cakes: 'الكعك',
                unknown: 'غير معروف',
              }[orderItem?.department?.name || 'unknown']
            : orderItem?.department?.name || 'Unknown';
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
                className="block text-xs font-medium text-gray-700 truncate"
                htmlFor={`chef-select-${item.itemId}`}
              >
                {isRtl
                  ? `${orderItem?.productName || 'غير معروف'} (${item.quantity} ${{
                      unit: 'وحدة',
                      kg: 'كجم',
                      piece: 'قطعة',
                    }[item.unit || 'unit']})`
                  : `${orderItem?.productName || 'Unknown'} (${item.quantity} ${item.unit || 'unit'})`}
              </label>
              <Select
                id={`chef-select-${item.itemId}`}
                options={[
                  { value: '', label: isRtl ? 'اختر شيف' : 'Select Chef' },
                  ...availableChefs.map((chef) => ({
                    value: chef.userId,
                    label: `${chef.name || (isRtl ? 'غير معروف' : 'Unknown')} (${
                      isRtl
                        ? {
                            bread: 'المخبوزات',
                            pastries: 'المعجنات',
                            cakes: 'الكعك',
                            unknown: 'غير معروف',
                          }[chef.department?.name || 'unknown']
                        : chef.department?.name || 'Unknown'
                    })`,
                  })),
                ]}
                value={item.assignedTo}
                onChange={(value) => updateAssignment(index, value)}
                className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-xs"
                aria-label={isRtl ? 'اختر شيف' : 'Select Chef'}
              />
            </motion.div>
          );
        })}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-600 ${isRtl ? 'flex-row-reverse' : ''}`}
            role="alert"
          >
            <AlertCircle className="w-4 h-4" />
            <span className="truncate">{error}</span>
          </motion.div>
        )}
        <div className={`flex gap-2 ${isRtl ? 'justify-end flex-row-reverse' : 'justify-end'}`}>
          <Button
            variant="secondary"
            onClick={onClose}
            className="rounded-md px-2 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700"
            aria-label={isRtl ? 'إلغاء' : 'Cancel'}
          >
            {isRtl ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting !== null || !assignFormData.items.some((item) => item.assignedTo)}
            className="rounded-md px-2 py-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50"
            aria-label={isRtl ? 'تعيين الشيفات' : 'Assign Chefs'}
          >
            {submitting ? (isRtl ? 'جارٍ التحميل' : 'Loading') : isRtl ? 'تعيين الشيفات' : 'Assign Chefs'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AssignChefsModal;