import React, { useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';
import { Select } from '../UI/Select';
import { AlertCircle } from 'lucide-react';
import { Order, Chef, AssignChefsForm } from '../../types';
import { toast } from 'react-toastify';

// Department labels for translation
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
  error: string;
  submitting: string | null;
  assignChefs: (orderId: string) => Promise<void>;
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
  // Memoize available chefs by department for performance
  const availableChefsByDepartment = useMemo(() => {
    const map = new Map<string, Chef[]>();
    chefs.forEach((chef) => {
      const deptId = chef.department?._id || 'unknown';
      if (!map.has(deptId)) {
        map.set(deptId, []);
      }
      map.get(deptId)!.push(chef);
    });
    return map;
  }, [chefs]);

  // Handle chef assignment updates
  const updateAssignment = useCallback(
    (index: number, value: string) => {
      if (typeof setAssignForm !== 'function') {
        console.error('setAssignForm is not a function:', setAssignForm);
        toast.error(t('errors.set_assign_form_unavailable'), {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
        return;
      }
      setAssignForm({
        items: assignFormData.items.map((i, idx) =>
          idx === index ? { ...i, assignedTo: value } : i
        ),
      });
    },
    [assignFormData.items, setAssignForm, t, isRtl]
  );

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedOrder?.id) {
        toast.error(t('errors.no_order_selected'), {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
        return;
      }
      if (typeof assignChefs !== 'function') {
        console.error('assignChefs is not a function:', assignChefs);
        toast.error(t('errors.assign_chefs_unavailable'), {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
        return;
      }
      await assignChefs(selectedOrder.id);
    },
    [selectedOrder, assignChefs, t, isRtl]
  );

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('orders.assign_chefs_title', { orderNumber: selectedOrder?.orderNumber || t('common.unknown') })}
      size="md"
      className="bg-white rounded-lg shadow-xl max-w-lg mx-auto"
      ariaLabel={t('orders.assign_chefs')}
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-4">
        {assignFormData.items.length === 0 ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-sm text-gray-500 text-center"
          >
            {t('orders.no_items_to_assign')}
          </motion.p>
        ) : (
          assignFormData.items.map((item, index) => {
            const orderItem = selectedOrder?.items.find((i) => i._id === item.itemId);
            const departmentId = orderItem?.department?._id || 'unknown';
            const departmentName = orderItem?.department?.name
              ? t(departmentLabels[orderItem.department.name] || departmentLabels.unknown)
              : t(departmentLabels.unknown);
            const availableChefs = availableChefsByDepartment.get(departmentId) || [];
            return (
              <motion.div
                key={item.itemId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.1 }}
                className="space-y-2"
              >
                <label
                  className={`block text-sm font-medium text-gray-900 ${isRtl ? 'text-right' : 'text-left'}`}
                  htmlFor={`chef-select-${index}`}
                >
                  {t('orders.assign_chef_to', {
                    product: orderItem?.productName || t('common.unknown'),
                    quantity: item.quantity,
                    unit: t(`units.${item.unit || 'unit'}`),
                  })}
                  <span className="text-gray-500 text-xs mx-1">({departmentName})</span>
                </label>
                <Select
                  id={`chef-select-${index}`}
                  options={[
                    { value: '', label: t('orders.select_chef') },
                    ...availableChefs.map((chef) => ({
                      value: chef._id,
                      label: `${chef.name} (${t(departmentLabels[chef.department?.name || 'unknown'])})`,
                    })),
                  ]}
                  value={item.assignedTo}
                  onChange={(value) => updateAssignment(index, value)}
                  className={`w-full rounded-md border-gray-200 focus:ring-amber-500 text-sm ${isRtl ? 'text-right' : 'text-left'}`}
                  aria-label={t('orders.select_chef')}
                  dir={isRtl ? 'rtl' : 'ltr'}
                />
              </motion.div>
            );
          })
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={`p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}
            role="alert"
          >
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-600 text-sm">{error}</span>
          </motion.div>
        )}
        <div className={`flex justify-end gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <Button
            variant="secondary"
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md px-4 py-2 text-sm"
            aria-label={t('common.cancel')}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting !== null || !assignFormData.items.some((item) => item.assignedTo) || assignFormData.items.length === 0}
            className="bg-amber-500 hover:bg-amber-600 text-white rounded-md px-4 py-2 text-sm disabled:opacity-50"
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