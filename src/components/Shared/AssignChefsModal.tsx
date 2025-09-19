import React, { useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Modal } from '../../components/UI/Modal';
import { Button } from '../../components/UI/Button';
import { Select } from '../../components/UI/Select';
import { useLanguage } from '../../contexts/LanguageContext';
import { AlertCircle } from 'lucide-react';
import { Order, Chef, AssignChefsForm } from '../../types/types';

interface AssignChefsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOrder: Order | null;
  assignFormData: AssignChefsForm;
  chefs: Chef[];
  error: string;
  submitting: string | null;
  assignChefs: (orderId: string) => void;
  setAssignForm: (formData: AssignChefsForm) => void;
  isRtl: boolean;
}

export const AssignChefsModal: React.FC<AssignChefsModalProps> = ({
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
  const { t } = useLanguage();

  const availableChefsByDepartment = useMemo(() => {
    const map = new Map<string, Chef[]>();
    chefs.forEach((chef) => {
      if (chef.department?._id) {
        if (!map.has(chef.department._id)) {
          map.set(chef.department._id, []);
        }
        map.get(chef.department._id)!.push(chef);
      }
    });
    return map;
  }, [chefs]);

  const updateAssignment = (index: number, value: string) => {
    setAssignForm({
      items: assignFormData.items.map((i, idx) =>
        idx === index ? { ...i, assignedTo: value } : i
      ),
    });
  };

  useEffect(() => {
    if (!selectedOrder) return;

    const updatedItems = assignFormData.items.map((item) => {
      const orderItem = selectedOrder.items.find((i) => i._id === item.itemId);
      const departmentId = orderItem?.department._id || '';
      const availableChefs = availableChefsByDepartment.get(departmentId) || [];

      if (item.assignedTo === '' && availableChefs.length === 1) {
        return { ...item, assignedTo: availableChefs[0].userId };
      }
      return item;
    });

    const hasChanges = updatedItems.some((item, idx) => item.assignedTo !== assignFormData.items[idx].assignedTo);
    if (hasChanges) {
      setAssignForm({ items: updatedItems });
    }
  }, [assignFormData.items, availableChefsByDepartment, selectedOrder, setAssignForm]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isRtl ? `تعيين الشيفات لطلب ${selectedOrder?.orderNumber}` : `Assign Chefs to Order #${selectedOrder?.orderNumber}`}
      size="md"
      className="bg-white rounded-lg shadow-xl border border-gray-100"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          assignChefs(selectedOrder?.id || '');
        }}
        className="space-y-6"
      >
        {assignFormData.items.map((item, index) => {
          const orderItem = selectedOrder?.items.find((i) => i._id === item.itemId);
          const departmentId = orderItem?.department._id || '';
          const availableChefs = availableChefsByDepartment.get(departmentId) || [];

          const chefOptions = [
            { value: '', label: isRtl ? 'اختر شيف' : 'Select Chef' },
            ...availableChefs.map((chef) => ({
              value: chef.userId,
              label: `${chef.name} (${chef.department?.name || (isRtl ? 'غير معروف' : 'Unknown')})`,
            })),
          ];

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.1 }}
            >
              <label
                className={`block text-sm font-medium text-gray-900 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}
                htmlFor={`chef-select-${index}`}
              >
                {isRtl
                  ? `تعيين شيف لـ ${orderItem?.productName} (${item.quantity} ${item.unit})`
                  : `Assign chef to ${orderItem?.productName} (${item.quantity} ${item.unit})`}
              </label>
              <Select
                id={`chef-select-${index}`}
                options={chefOptions}
                value={item.assignedTo}
                onChange={(value) => updateAssignment(index, value)}
                className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
                aria-label={isRtl ? 'اختر شيف' : 'Select Chef'}
              />
            </motion.div>
          );
        })}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}
          >
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-600 text-sm">{error}</span>
          </motion.div>
        )}
        <div className={`flex justify-end gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <Button
            variant="secondary"
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md px-4 py-2 text-sm shadow-sm"
            aria-label={isRtl ? 'إلغاء' : 'Cancel'}
          >
            {isRtl ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting !== null}
            className="bg-amber-500 hover:bg-amber-600 text-white rounded-md px-4 py-2 text-sm shadow-sm"
            aria-label={isRtl ? 'تعيين الشيفات' : 'Assign Chefs'}
          >
            {submitting ? (isRtl ? 'جارٍ التحميل' : 'Loading') : (isRtl ? 'تعيين الشيفات' : 'Assign Chefs')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AssignChefsModal;