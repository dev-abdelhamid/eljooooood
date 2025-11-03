import React, { useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Modal } from '../../components/UI/Modal';
import { Button } from '../../components/UI/Button';
import { CustomDropdown } from '../../components/UI/CustomDropdown';
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

/* -------------------------------------------------------------------------- */
/*  ترجمة الوحدات (كيلو، قطعة …)                                           */
/* -------------------------------------------------------------------------- */
const translateUnit = (unit: string, isRtl: boolean) => {
  const translations: Record<string, { ar: string; en: string }> = {
    كيلو: { ar: 'كيلو', en: 'kg' },
    قطعة: { ar: 'قطعة', en: 'piece' },
    علبة: { ar: 'علبة', en: 'pack' },
    صينية: { ar: 'صينية', en: 'tray' },
    kg: { ar: 'كجم', en: 'kg' },
    piece: { ar: 'قطعة', en: 'piece' },
    pack: { ar: 'علبة', en: 'pack' },
    tray: { ar: 'صينية', en: 'tray' },
  };
  return translations[unit] ? (isRtl ? translations[unit].ar : translations[unit].en) : isRtl ? 'وحدة' : 'unit';
};

/* -------------------------------------------------------------------------- */
/*  المكوّن الرئيسي                                                          */
/* -------------------------------------------------------------------------- */
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

  /* --------------------------------------------------------------- */
  /*  تحديث الوحدات + تعيين تلقائي إذا كان هناك شيف واحد فقط   */
  /* --------------------------------------------------------------- */
  useEffect(() => {
    if (!selectedOrder) return;

    const updatedItems = assignFormData.items.map((item) => {
      const orderItem = selectedOrder.items.find((i) => i._id === item.itemId);
      const departmentId = orderItem?.department?._id?.toString() || '';

      /* شيفات نشطة للقسم الحالي فقط */
      const available = departmentId
        ? chefs.filter(
            (c) =>
              c.status === 'active' &&
              Array.isArray(c.department) &&
              c.department.some((d) => d._id?.toString() === departmentId)
          )
        : [];

      let assignedTo = item.assignedTo;
      if (!assignedTo && available.length === 1) {
        assignedTo = available[0].userId;
      }

      return {
        ...item,
        assignedTo,
        unit: translateUnit(orderItem?.unit || 'unit', isRtl),
      };
    });

    const hasChanges = updatedItems.some(
      (it, idx) =>
        it.assignedTo !== assignFormData.items[idx].assignedTo ||
        it.unit !== assignFormData.items[idx].unit
    );

    if (hasChanges) {
      setAssignForm({ items: updatedItems });
    }
  }, [selectedOrder, chefs, assignFormData.items, setAssignForm, isRtl]);

  /* --------------------------------------------------------------- */
  /*  تحديث التعيين عند اختيار شيف                                 */
  /* --------------------------------------------------------------- */
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

  /* --------------------------------------------------------------------- */
  /*  الـ Render                                                            */
  /* --------------------------------------------------------------------- */
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isRtl
          ? `تعيين الشيفات لطلب ${selectedOrder?.orderNumber}`
          : `Assign Chefs to Order #${selectedOrder?.orderNumber}`
      }
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
        {/* ---------- كل عنصر في الطلب ---------- */}
        {assignFormData.items.map((item, index) => {
          const orderItem = selectedOrder?.items.find((i) => i._id === item.itemId);
          const productDeptId = orderItem?.department?._id?.toString() || '';

          /* شيفات نشطة للقسم الحالي فقط */
          const availableChefs = useMemo(() => {
            if (!productDeptId) return [];
            return chefs.filter(
              (c) =>
                c.status === 'active' &&
                Array.isArray(c.department) &&
                c.department.some((d) => d._id?.toString() === productDeptId)
            );
          }, [chefs, productDeptId]);

          /* خيارات الـ Dropdown مع اسم القسم الصحيح */
          const chefOptions = useMemo(() => {
            return [
              { value: '', label: isRtl ? 'اختر شيف' : 'Select Chef' },
              ...availableChefs.map((chef) => {
                const matchedDept = chef.department.find(
                  (d) => d._id?.toString() === productDeptId
                );
                const deptName = matchedDept
                  ? isRtl
                    ? matchedDept.name
                    : matchedDept.nameEn || matchedDept.name
                  : isRtl
                  ? 'غير معروف'
                  : 'Unknown';

                return {
                  value: chef.userId,
                  label: `${chef.displayName} (${deptName})`,
                };
              }),
            ];
          }, [availableChefs, productDeptId, isRtl]);

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
                  ? `تعيين شيف لـ ${orderItem?.displayProductName} (${item.quantity} ${item.unit})`
                  : `Assign chef to ${orderItem?.displayProductName} (${item.quantity} ${item.unit})`}
              </label>

              <CustomDropdown
                value={item.assignedTo}
                onChange={(value) => updateAssignment(index, value as string)}
                options={chefOptions}
                ariaLabel={isRtl ? 'اختر شيف' : 'Select Chef'}
                className="w-full"
                placeholder={isRtl ? 'اختر شيف...' : 'Select a chef...'}
              />
            </motion.div>
          );
        })}

        {/* ---------- رسالة الخطأ ---------- */}
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

        {/* ---------- أزرار الحفظ / الإلغاء ---------- */}
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
            {submitting
              ? isRtl
                ? 'جارٍ التحميل'
                : 'Loading'
              : isRtl
              ? 'تعيين الشيفات'
              : 'Assign Chefs'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AssignChefsModal;