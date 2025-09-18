import React, { useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';
import { Select } from '../UI/Select';
import { AlertCircle } from 'lucide-react';
import { Order, Chef, AssignChefsForm } from '../../types';

interface AssignChefsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOrder: Order | null;
  assignFormData: AssignChefsForm;
  chefs: Chef[];
  error: string;
  submitting: string | null;
  assignChefs: (orderId: string, formData: AssignChefsForm) => void;
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
      if (selectedOrder?.id) assignChefs(selectedOrder.id, assignFormData);
    },
    [selectedOrder, assignChefs, assignFormData]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isRtl ? `تعيين الشيفات لطلب ${selectedOrder?.orderNumber || ''}` : `Assign Chefs for Order ${selectedOrder?.orderNumber || ''}`}
      size="md"
      className="bg-white rounded-lg shadow-xl"
      ariaLabel={isRtl ? 'تعيين الشيفات' : 'Assign Chefs'}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {assignFormData.items.map((item, index) => {
          const orderItem = selectedOrder?.items.find((i) => i._id === item.itemId);
          const departmentId = orderItem?.department?._id || '';
          const departmentName = orderItem?.department?.name
            ? isRtl ? {
                bread: 'المخبوزات',
                pastries: 'المعجنات',
                cakes: 'الكعك',
                unknown: 'غير معروف',
              }[orderItem.department.name] : orderItem.department.name
            : isRtl ? 'غير معروف' : 'Unknown';
          const availableChefs = availableChefsByDepartment.get(departmentId) || [];
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.1 }}
            >
              <label
                className="block text-sm font-medium text-gray-900 mb-1"
                htmlFor={`chef-select-${index}`}
              >
                {isRtl ? `تعيين شيف لـ ${orderItem?.productName || 'غير معروف'} (${item.quantity} ${{
                  unit: 'وحدة',
                  kg: 'كجم',
                  piece: 'قطعة',
                }[item.unit || 'unit']})` : `Assign chef to ${orderItem?.productName || 'Unknown'} (${item.quantity} ${item.unit || 'unit'})`}
              </label>
              <Select
                id={`chef-select-${index}`}
                options={[
                  { value: '', label: isRtl ? 'اختر شيف' : 'Select Chef' },
                  ...availableChefs.map((chef) => ({
                    value: chef.userId,
                    label: `${chef.name} (${departmentName})`,
                  })),
                ]}
                value={item.assignedTo}
                onChange={(value) => updateAssignment(index, value)}
                className="w-full rounded-lg border-gray-300 focus:ring-blue-500"
                aria-label={isRtl ? 'اختر شيف' : 'Select Chef'}
              />
            </motion.div>
          );
        })}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}
            role="alert"
          >
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-600">{error}</span>
          </motion.div>
        )}
        <div className={`flex justify-end gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <Button
            variant="secondary"
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-full px-4 py-2 text-sm"
            aria-label={isRtl ? 'إلغاء' : 'Cancel'}
          >
            {isRtl ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting !== null || !assignFormData.items.some((item) => item.assignedTo)}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 py-2 text-sm disabled:opacity-50"
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