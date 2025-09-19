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
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';

  // تجميع الشيفات حسب القسم باستخدام useMemo لتحسين الأداء
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

  // تحديث تعيين الشيف
  const updateAssignment = (index: number, value: string) => {
    setAssignForm({
      items: assignFormData.items.map((i, idx) =>
        idx === index ? { ...i, assignedTo: value } : i
      ),
    });
  };

  // تلقائي تعيين الشيف إذا كان هناك شيف واحد فقط في القسم
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

    // تحقق إذا كان هناك تغيير لتجنب تحديثات غير ضرورية
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
      className="bg-white rounded-lg shadow-xl"
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

          // إعداد خيارات الشيفات مع إضافة اسم القسم
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
                className="block text-sm font-medium text-gray-900 mb-1"
                htmlFor={`chef-select-${index}`}
              >
                {isRtl
                  ? `تعيين شيف لـ ${orderItem?.productName} (${item.quantity})`
                  : `Assign chef to ${orderItem?.productName} (${item.quantity})`}
              </label>
              <Select
                id={`chef-select-${index}`}
                options={chefOptions}
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
            disabled={submitting !== null}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 py-2 text-sm"
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