import React, { useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';
import { Select } from '../UI/Select';
import { AlertCircle } from 'lucide-react';
import { Order, Chef, AssignChefsForm } from '../../types';
import { toast } from 'react-toastify';

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
  assignChefs: (orderId: string) => Promise<void>; // تعديل التوقيع ليطابق Orders
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
        if (!map.has(chef.department._id)) {
          map.set(chef.department._id, []);
        }
        map.get(chef.department._id)!.push(chef);
      }
    });
    return map;
  }, [chefs]);

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

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
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
      assignChefs(selectedOrder.id); // إزالة formData لأنها تُدار داخل Orders
    },
    [selectedOrder, assignChefs, t, isRtl]
  );

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (typeof onClose === 'function') {
          onClose();
        } else {
          console.error('onClose is not a function:', onClose);
        }
      }}
      title={t('orders.assign_chefs_title', { orderNumber: selectedOrder?.orderNumber || '' })}
      size="md"
      className="bg-white rounded-lg shadow-xl"
      ariaLabel={t('orders.assign_chefs')}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {assignFormData.items.length === 0 ? (
          <p className="text-sm text-gray-500">{t('orders.no_items_to_assign')}</p>
        ) : (
          assignFormData.items.map((item, index) => {
            const orderItem = selectedOrder?.items.find((i) => i._id === item.itemId);
            const departmentId = orderItem?.department?._id || '';
            const departmentName = orderItem?.department?.name
              ? t(departmentLabels[orderItem.department.name] || departmentLabels.unknown)
              : t(departmentLabels.unknown);
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
                  {t('orders.assign_chef_to', {
                    product: orderItem?.productName || t('common.unknown'),
                    quantity: item.quantity,
                    unit: t(`units.${item.unit || 'unit'}`),
                  })}
                </label>
                <Select
                  id={`chef-select-${index}`}
                  options={[
                    { value: '', label: t('orders.select_chef') },
                    ...availableChefs.map((chef) => ({
                      value: chef.userId,
                      label: `${chef.name} (${t(departmentLabels[chef.department?.name || 'unknown'])})`,
                    })),
                  ]}
                  value={item.assignedTo}
                  onChange={(value) => updateAssignment(index, value)}
                  className="w-full rounded-lg border-gray-300 focus:ring-blue-500"
                  aria-label={t('orders.select_chef')}
                />
              </motion.div>
            );
          })
        )}
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
            onClick={() => {
              if (typeof onClose === 'function') {
                onClose();
              } else {
                console.error('onClose is not a function:', onClose);
              }
            }}
            className="bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-full px-4 py-2 text-sm"
            aria-label={t('common.cancel')}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting !== null || !assignFormData.items.some((item) => item.assignedTo) || assignFormData.items.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 py-2 text-sm disabled:opacity-50"
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