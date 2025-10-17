// components/Shared/AssignChefsModal.tsx
import React, { useCallback } from 'react';
import { Modal } from '../UI/Modal';
import { Select } from '../UI/Select';
import { Button } from '../UI/Button';
import { AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FactoryOrder, Chef, AssignChefsForm } from '../../types/types';

interface AssignChefsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOrder: FactoryOrder | null;
  chefs: Chef[];
  assignFormData: AssignChefsForm;
  setAssignForm: (data: AssignChefsForm) => void;
  assignChefs: (orderId: string) => void;
  error: string;
  submitting: string | null;
  isRtl: boolean;
}

const translations = {
  ar: {
    title: 'تعيين الشيفات',
    product: 'المنتج',
    quantity: 'الكمية',
    unit: 'الوحدة',
    chef: 'الشيف',
    selectChef: 'اختر شيف',
    assign: 'تعيين',
    assigning: 'جاري التعيين...',
    cancel: 'إلغاء',
    error: 'خطأ: {message}',
    noItems: 'لا توجد عناصر متاحة للتعيين',
  },
  en: {
    title: 'Assign Chefs',
    product: 'Product',
    quantity: 'Quantity',
    unit: 'Unit',
    chef: 'Chef',
    selectChef: 'Select Chef',
    assign: 'Assign',
    assigning: 'Assigning...',
    cancel: 'Cancel',
    error: 'Error: {message}',
    noItems: 'No items available for assignment',
  },
};

export const AssignChefsModal: React.FC<AssignChefsModalProps> = ({
  isOpen,
  onClose,
  selectedOrder,
  chefs,
  assignFormData,
  setAssignForm,
  assignChefs,
  error,
  submitting,
  isRtl,
}) => {
  const t = translations[isRtl ? 'ar' : 'en'];

  const handleChefChange = useCallback(
    (itemId: string, value: string) => {
      setAssignForm({
        items: assignFormData.items.map(item =>
          item.itemId === itemId ? { ...item, assignedTo: value } : item
        ),
      });
    },
    [assignFormData, setAssignForm]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.title}
      size="lg"
      className="bg-white rounded-lg shadow-xl border border-gray-100"
    >
      <div className="space-y-4">
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}
          >
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-600 text-sm">{t.error.replace('{message}', error)}</span>
          </motion.div>
        )}
        {assignFormData.items.length === 0 ? (
          <p className="text-gray-600 text-sm text-center">{t.noItems}</p>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {assignFormData.items.map(item => (
              <div key={item.itemId} className={`flex flex-col gap-2 ${isRtl ? 'text-right' : 'text-left'}`}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.product}</label>
                    <p className="text-sm text-gray-900">{item.product}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.quantity}</label>
                    <p className="text-sm text-gray-900">{item.quantity} {item.unit}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.chef}</label>
                    <Select
                      options={[
                        { value: '', label: t.selectChef },
                        ...chefs
                          .filter(chef => chef.status === 'active')
                          .map(chef => ({
                            value: chef.userId,
                            label: chef.displayName,
                          }))
                      ]}
                      value={item.assignedTo}
                      onChange={(value) => handleChefChange(item.itemId, value)}
                      className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-sm shadow-sm"
                      aria-label={t.selectChef}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className={`flex justify-end gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <Button
            variant="secondary"
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md px-4 py-2 text-sm shadow-sm"
            aria-label={t.cancel}
          >
            {t.cancel}
          </Button>
          {assignFormData.items.length > 0 && (
            <Button
              variant="primary"
              onClick={() => selectedOrder && assignChefs(selectedOrder.id)}
              disabled={submitting !== null || assignFormData.items.every(item => !item.assignedTo)}
              className="bg-amber-500 hover:bg-amber-600 text-white rounded-md px-4 py-2 text-sm shadow-sm disabled:opacity-50"
              aria-label={t.assign}
            >
              {submitting ? t.assigning : t.assign}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default AssignChefsModal;