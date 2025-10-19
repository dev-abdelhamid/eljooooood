import React, { useMemo, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Modal } from '../../components/UI/Modal';
import { Button } from '../../components/UI/Button';
import { Select } from '../../components/UI/Select';
import { AlertCircle } from 'lucide-react';
import { FactoryOrder, Chef, AssignChefsForm } from '../../types/types';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { useAuth } from '../../contexts/AuthContext';

interface AssignChefsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOrder: FactoryOrder | null;
  assignFormData: AssignChefsForm;
  chefs: Chef[];
  error: string;
  submitting: string | null;
  assignChefs: (orderId: string) => void;
  setAssignForm: (formData: AssignChefsForm) => void;
  isRtl: boolean;
  loading: boolean;
}

const translateUnit = (unit: string, isRtl: boolean): string => {
  const translations: Record<string, { ar: string; en: string }> = {
    'كيلو': { ar: 'كيلو', en: 'kg' },
    'قطعة': { ar: 'قطعة', en: 'piece' },
    'علبة': { ar: 'علبة', en: 'pack' },
    'صينية': { ar: 'صينية', en: 'tray' },
    'kg': { ar: 'كجم', en: 'kg' },
    'piece': { ar: 'قطعة', en: 'piece' },
    'pack': { ar: 'علبة', en: 'pack' },
    'tray': { ar: 'صينية', en: 'tray' },
  };
  return translations[unit] ? (isRtl ? translations[unit].ar : translations[unit].en) : isRtl ? 'وحدة' : 'unit';
};

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
  loading,
}) => {
  const { user } = useAuth();

  const availableChefsByDepartment = useMemo(() => {
    const map = new Map<string, Chef[]>();
    chefs.forEach((chef) => {
      const departmentId = chef.department?._id.toString() || 'no-department';
      if (!map.has(departmentId)) {
        map.set(departmentId, []);
      }
      map.get(departmentId)!.push(chef);
    });
    return map;
  }, [chefs]);

  const updateAssignment = useCallback(
    (index: number, value: string) => {
      setAssignForm({
        items: assignFormData.items.map((item, idx) =>
          idx === index ? { ...item, assignedTo: value } : item
        ),
      });
    },
    [assignFormData.items, setAssignForm]
  );

  useEffect(() => {
    if (!selectedOrder || !user) return;

    const updatedItems = selectedOrder.items.filter(item => !item.assignedTo).map((item) => {
      const departmentId = item.department?._id.toString() || 'no-department';
      const availableChefs = availableChefsByDepartment.get(departmentId) || [];
      let assignedTo = '';
      if (availableChefs.length === 1) {
        assignedTo = availableChefs[0].userId;
      }
      return {
        itemId: item._id,
        assignedTo,
        product: item.displayProductName,
        quantity: item.quantity,
        unit: translateUnit(item.unit, isRtl),
      };
    });

    setAssignForm({ items: updatedItems });
  }, [availableChefsByDepartment, selectedOrder, setAssignForm, isRtl, user]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isRtl
          ? `تعيين الشيفات لطلب ${selectedOrder?.orderNumber || ''}`
          : `Assign Chefs to Order #${selectedOrder?.orderNumber || ''}`
      }
      size="md"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (selectedOrder?.id) {
            assignChefs(selectedOrder.id);
          }
        }}
        className="space-y-4"
      >
        {loading ? (
          <Skeleton count={assignFormData.items.length} height={40} />
        ) : assignFormData.items.length === 0 ? (
          <p className="text-gray-600 text-xs">
            {isRtl ? 'لا توجد عناصر غير معينة' : 'No unassigned items'}
          </p>
        ) : (
          assignFormData.items.map((item, index) => {
            const orderItem = selectedOrder?.items.find((i) => i._id === item.itemId);
            const departmentId = orderItem?.department?._id.toString() || 'no-department';
            const availableChefs = availableChefsByDepartment.get(departmentId) || [];
            const chefOptions = availableChefs
              .sort((a, b) => a.displayName.localeCompare(b.displayName))
              .map((chef) => ({
                value: chef.userId,
                label: `${chef.displayName} (${chef.department.displayName})`,
              }));
            chefOptions.unshift({ value: '', label: isRtl ? 'اختر شيف' : 'Select Chef' });

            return (
              <motion.div
                key={item.itemId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.1 }}
              >
                <label
                  className={`block text-xs font-medium text-gray-900 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}
                  htmlFor={`chef-select-${index}`}
                >
                  {isRtl
                    ? `تعيين شيف لـ ${orderItem?.displayProductName || 'غير معروف'} (${item.quantity} ${item.unit})`
                    : `Assign chef to ${orderItem?.displayProductName || 'Unknown'} (${item.quantity} ${item.unit})`}
                </label>
                <Select
                  id={`chef-select-${index}`}
                  options={chefOptions}
                  value={item.assignedTo}
                  onChange={(value) => updateAssignment(index, value)}
                  className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-xs shadow-sm"
                  aria-label={isRtl ? 'اختر شيف' : 'Select Chef'}
                  disabled={availableChefs.length === 0}
                />
                {availableChefs.length === 0 && (
                  <p className="text-red-600 text-xs mt-1">
                    {isRtl ? 'لا يوجد شيفات متاحة لهذا القسم' : 'No chefs available for this department'}
                  </p>
                )}
              </motion.div>
            );
          })
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}
          >
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-red-600 text-xs">{error}</span>
          </motion.div>
        )}
        <div className={`flex justify-end gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <Button
            variant="secondary"
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md px-3 py-1 text-xs shadow-sm"
          >
            {isRtl ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting !== null || loading || assignFormData.items.some((item) => !item.assignedTo)}
            className="bg-amber-500 hover:bg-amber-600 text-white rounded-md px-3 py-1 text-xs shadow-sm disabled:opacity-50"
          >
            {submitting ? (isRtl ? 'جارٍ التعيين...' : 'Assigning...') : (isRtl ? 'تعيين' : 'Assign')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AssignChefsModal;