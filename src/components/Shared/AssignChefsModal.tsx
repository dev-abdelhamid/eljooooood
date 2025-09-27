import React, { useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Modal } from '../../components/UI/Modal';
import { Button } from '../../components/UI/Button';
import { Select } from '../../components/UI/Select';
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
    const map: Record<string, Chef[]> = {};
    chefs.forEach((chef) => {
      if (chef.department?._id) {
        if (!map[chef.department._id]) map[chef.department._id] = [];
        map[chef.department._id].push(chef);
      }
    });
    return map;
  }, [chefs]);

  const updateAssignment = (index: number, value: string) => {
    const updatedItems = [...assignFormData.items];
    updatedItems[index].assignedTo = value;
    setAssignForm({ items: updatedItems });
  };

  useEffect(() => {
    if (!selectedOrder) return;
    const updatedItems = assignFormData.items.map((item) => {
      const orderItem = selectedOrder.items.find((i) => i._id === item.itemId);
      const departmentId = orderItem?.department._id || '';
      const availableChefs = availableChefsByDepartment[departmentId] || [];
      if (!item.assignedTo && availableChefs.length === 1) {
        return { ...item, assignedTo: availableChefs[0]._id };
      }
      return item;
    });
    setAssignForm({ items: updatedItems });
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
          if (selectedOrder?.id) assignChefs(selectedOrder.id);
        }}
        className="space-y-4 max-h-96 overflow-y-auto px-2"
      >
        {assignFormData.items.map((item, index) => {
          const orderItem = selectedOrder?.items.find((i) => i._id === item.itemId);
          const departmentId = orderItem?.department._id || '';
          const availableChefs = availableChefsByDepartment[departmentId] || [];
          const chefOptions = [
            { value: '', label: isRtl ? 'اختر شيف' : 'Select Chef' },
            ...availableChefs.map((chef) => ({
              value: chef._id,
              label: `${chef.displayName} (${chef.department?.displayName || (isRtl ? 'غير معروف' : 'Unknown')})`,
            })),
          ];

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              className="p-2 bg-gray-50 rounded-md shadow-sm"
            >
              <label className={`block text-xs font-medium text-gray-700 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}>
                {isRtl ? `لـ ${orderItem?.displayProductName} (${item.quantity} ${orderItem?.displayUnit})` : `For ${orderItem?.displayProductName} (${item.quantity} ${orderItem?.displayUnit})`}
              </label>
              <Select
                options={chefOptions}
                value={item.assignedTo}
                onChange={(value) => updateAssignment(index, value)}
                className="w-full rounded-md border-gray-200 focus:ring-blue-500 text-xs shadow-sm"
              />
            </motion.div>
          );
        })}
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-2 bg-red-50 border border-red-100 rounded-md flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="w-4 h-4" />
            {error}
          </motion.div>
        )}
        <div className={`flex gap-2 ${isRtl ? 'justify-start flex-row-reverse' : 'justify-end'}`}>
          <Button variant="secondary" onClick={onClose} className="text-xs px-3 py-1 rounded-full shadow">
            {isRtl ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button type="submit" variant="primary" disabled={!!submitting} className="text-xs px-3 py-1 rounded-full shadow">
            {submitting ? (isRtl ? 'جاري...' : 'Submitting...') : (isRtl ? 'تعيين' : 'Assign')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AssignChefsModal;