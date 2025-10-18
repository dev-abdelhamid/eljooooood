import React, { useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Modal } from '../../components/UI/Modal';
import { Button } from '../../components/UI/Button';
import { Select } from '../../components/UI/Select';
import { useLanguage } from '../../contexts/LanguageContext';
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
  const { t } = useLanguage();
  const { user } = useAuth();

  // بناء قائمة الشيفات المتاحة حسب القسم
  const availableChefsByDepartment = useMemo(() => {
    const map = new Map<string, Chef[]>();
    chefs.forEach((chef) => {
      const departmentId = chef.department?._id || 'no-department';
      if (!map.has(departmentId)) {
        map.set(departmentId, []);
      }
      map.get(departmentId)!.push(chef);
    });
    console.log('Available Chefs by Department:', Object.fromEntries(map));
    return map;
  }, [chefs]);

  // تحديث تعيين الشيف
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

  // تحديث assignFormData بناءً على الطلب المختار
  useEffect(() => {
    if (!selectedOrder || !user) return;

    // إذا كان المستخدم شيف، يتم تعيينه تلقائيًا للعناصر التابعة لقسمه
    const updatedItems = selectedOrder.items.map((item) => {
      const orderItem = selectedOrder.items.find((i) => i._id === item._id);
      const departmentId = orderItem?.department._id || 'no-department';
      const availableChefs = availableChefsByDepartment.get(departmentId) || [];

      let assignedTo = item.assignedTo?._id || '';
      if (user.role === 'chef' && user.department?._id === departmentId) {
        assignedTo = user.id; // تعيين الشيف تلقائيًا إذا كان هو من أنشأ الطلب
      } else if (availableChefs.length === 1 && user.role !== 'chef') {
        assignedTo = availableChefs[0].userId; // تعيين تلقائي إذا كان هناك شيف واحد فقط
      }

      return {
        itemId: item._id,
        assignedTo,
        product: item.displayProductName,
        quantity: item.quantity,
        unit: translateUnit(item.unit, isRtl),
      };
    });

    const hasChanges = updatedItems.some(
      (item, idx) =>
        item.assignedTo !== assignFormData.items[idx]?.assignedTo ||
        item.unit !== assignFormData.items[idx]?.unit
    );

    if (hasChanges || assignFormData.items.length !== updatedItems.length) {
      setAssignForm({ items: updatedItems });
    }
  }, [assignFormData.items, availableChefsByDepartment, selectedOrder, setAssignForm, isRtl, user]);

  // إذا كان المستخدم شيف، يتم إخفاء المودال إذا كانت جميع العناصر مؤتمتة
  const isFullyAutomated = useMemo(() => {
    if (user?.role !== 'chef') return false;
    return assignFormData.items.every((item) => item.assignedTo === user.id);
  }, [assignFormData.items, user]);

  // إرسال التعيينات تلقائيًا إذا كانت مؤتمتة
  useEffect(() => {
    if (isFullyAutomated && selectedOrder?.id && isOpen) {
      assignChefs(selectedOrder.id);
      onClose();
    }
  }, [isFullyAutomated, selectedOrder, assignChefs, onClose, isOpen]);

  if (isFullyAutomated) {
    return null; // لا يتم عرض المودال إذا كان التعيين مؤتمتًا
  }

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
      className="bg-white rounded-lg shadow-xl border border-gray-100"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (selectedOrder?.id) {
            assignChefs(selectedOrder.id);
          }
        }}
        className="space-y-6"
      >
        {loading ? (
          <div className="space-y-4">
            {assignFormData.items.map((_, index) => (
              <Skeleton key={index} height={40} />
            ))}
          </div>
        ) : assignFormData.items.length === 0 ? (
          <p className="text-gray-600 text-sm">
            {isRtl ? 'لا توجد عناصر لتعيين الشيفات' : 'No items to assign chefs'}
          </p>
        ) : (
          assignFormData.items.map((item, index) => {
            const orderItem = selectedOrder?.items.find((i) => i._id === item.itemId);
            const departmentId = orderItem?.department._id || 'no-department';
            const availableChefs = availableChefsByDepartment.get(departmentId) || [];

            const chefOptions = [
              { value: '', label: isRtl ? 'اختر شيف' : 'Select Chef' },
              ...(availableChefs.length > 0
                ? availableChefs.map((chef) => ({
                    value: chef.userId,
                    label: `${chef.displayName} (${chef.department?.displayName || (isRtl ? 'غير معروف' : 'Unknown')})`,
                  }))
                : [
                    {
                      value: '',
                      label: isRtl ? 'لا يوجد شيفات متاحة' : 'No chefs available',
                      disabled: true,
                    },
                  ]),
            ];

            return (
              <motion.div
                key={item.itemId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.1 }}
              >
                <label
                  className={`block text-sm font-medium text-gray-900 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}
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
                  className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
                  aria-label={isRtl ? 'اختر شيف' : 'Select Chef'}
                  disabled={availableChefs.length === 0 || (user?.role === 'chef' && item.assignedTo === user.id)}
                />
                {availableChefs.length === 0 && (
                  <p className="text-red-600 text-sm mt-1">
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
            disabled={submitting !== null || loading || assignFormData.items.some((item) => !item.assignedTo)}
            className="bg-amber-500 hover:bg-amber-600 text-white rounded-md px-4 py-2 text-sm shadow-sm disabled:opacity-50"
            aria-label={isRtl ? 'تعيين الشيفات' : 'Assign Chefs'}
          >
            {submitting ? (isRtl ? 'جارٍ التعيين...' : 'Assigning...') : (isRtl ? 'تعيين الشيفات' : 'Assign Chefs')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AssignChefsModal;