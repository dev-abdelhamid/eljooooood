import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '../UI/Button';
import { Select } from '../UI/Select';
import { AssignChefsForm, Chef } from '../../types/types';

interface AssignChefsModalProps {
  isOpen: boolean;
  onClose: () => void;
  chefs: Chef[];
  formData: AssignChefsForm;
  onSubmit: (formData: AssignChefsForm) => void;
  submitting: boolean;
  isRtl: boolean;
}

const AssignChefsModal: React.FC<AssignChefsModalProps> = ({
  isOpen,
  onClose,
  chefs,
  formData,
  onSubmit,
  submitting,
  isRtl,
}) => {
  const handleChange = useCallback(
    (itemId: string, value: string) => {
      const updatedItems = formData.items.map((item) =>
        item.itemId === itemId ? { ...item, assignedTo: value } : item
      );
      onSubmit({ items: updatedItems });
    },
    [formData.items, onSubmit]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          role="dialog"
          aria-labelledby="assign-chefs-modal-title"
          aria-modal="true"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-lg p-6 w-full max-w-lg shadow-xl"
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="assign-chefs-modal-title" className="text-lg font-semibold text-gray-800">
                {isRtl ? 'تعيين الشيفات' : 'Assign Chefs'}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                icon={X}
                onClick={onClose}
                aria-label={isRtl ? 'إغلاق النافذة' : 'Close modal'}
              />
            </div>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {formData.items.map((item) => (
                <div key={item.itemId} className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">
                      {item.product} ({item.quantity} {item.unit})
                    </p>
                  </div>
                  <Select
                    options={[
                      { value: '', label: isRtl ? 'اختر شيف' : 'Select Chef' },
                      ...chefs
                        .filter((chef) => chef.status === 'active')
                        .map((chef) => ({ value: chef._id, label: chef.displayName })),
                    ]}
                    value={item.assignedTo}
                    onChange={(value) => handleChange(item.itemId, value)}
                    placeholder={isRtl ? 'اختر شيف' : 'Select Chef'}
                    className="w-1/2"
                    aria-label={isRtl ? `تعيين شيف لـ ${item.product}` : `Assign chef for ${item.product}`}
                  />
                </div>
              ))}
            </div>
            <div className={`flex gap-2 mt-6 ${isRtl ? 'justify-end' : 'justify-start'}`}>
              <Button
                variant="primary"
                size="md"
                onClick={() => onSubmit(formData)}
                disabled={submitting || formData.items.some((item) => !item.assignedTo)}
                aria-label={isRtl ? 'تأكيد التعيين' : 'Confirm assignment'}
              >
                {submitting ? (isRtl ? 'جارٍ...' : 'Submitting...') : (isRtl ? 'تأكيد' : 'Submit')}
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={onClose}
                aria-label={isRtl ? 'إلغاء' : 'Cancel'}
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AssignChefsModal;