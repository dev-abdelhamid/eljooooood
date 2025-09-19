import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Modal } from '../../components/UI/Modal';
import { Button } from '../../components/UI/Button';
import { Select } from '../../components/UI/Select';
import { useLanguage } from '../../contexts/LanguageContext';
import { AlertCircle } from 'lucide-react';
import { Order } from '../../types/types';

interface Chef {
  _id: string;
  userId: string;
  username: string;
  name: string;
  department: { _id: string; name: string } | null;
}

interface AssignChefsForm {
  items: Array<{ itemId: string; assignedTo: string; product: string; quantity: number }>;
}

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

  order: Order;

  setAssignFormData: (data: AssignChefsForm) => void;
  onSubmit: () => Promise<void>;

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
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('orders.assign_chefs_title', { orderNumber: selectedOrder?.orderNumber })}
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
                {t('orders.assign_chef_to', { product: orderItem?.productName, quantity: item.quantity })}
              </label>
              <Select
                id={`chef-select-${index}`}
                options={[
                  { value: '', label: t('orders.select_chef') },
                  ...availableChefs.map((chef) => ({
                    value: chef.userId,
                    label: chef.name,
                  })),
                ]}
                value={item.assignedTo}
                onChange={(value) => updateAssignment(index, value)}
                className="w-full rounded-lg border-gray-300 focus:ring-blue-500"
                aria-label={t('orders.select_chef')}
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
            aria-label={t('common.cancel')}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting !== null}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 py-2 text-sm"
            aria-label={t('orders.assign_chefs')}
          >
            {submitting ? t('common.loading') : t('orders.assign_chefs')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AssignChefsModal;