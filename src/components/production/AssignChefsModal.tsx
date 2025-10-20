import React, { useMemo, useCallback, useEffect } from 'react';
import { Modal } from '../../components/UI/Modal';
import { Button } from '../../components/UI/Button';
import { ProductDropdown } from '../../pages/FactoryInventory'; // Assuming ProductDropdown is exported from FactoryInventory
import { AlertCircle } from 'lucide-react';
import { FactoryOrder, Chef, AssignChefsForm } from '../../types/types';
import { useLanguage } from '../../contexts/LanguageContext';

const translateUnit = (unit: string, isRtl: boolean) => {
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

// واجهة الخصائص لمكون AssignChefsModal
interface AssignChefsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOrder: FactoryOrder | null;
  chefs: Chef[];
  assignFormData: AssignChefsForm;
  setAssignForm: (data: AssignChefsForm) => void;
  assignChefs: (orderId: string) => Promise<void>;
  error: string;
  submitting: string | null;
  loading: boolean;
}

const AssignChefsModal: React.FC<AssignChefsModalProps> = ({
  isOpen,
  onClose,
  selectedOrder,
  chefs,
  assignFormData,
  setAssignForm,
  assignChefs,
  error,
  submitting,
  loading,
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';

  // تنظيم الشيفات حسب القسم
  const availableChefsByDepartment = useMemo(() => {
    const chefsByDept: Record<string, Chef[]> = {};
    chefs.forEach((chef) => {
      const deptId = chef.department?._id || 'no-department';
      if (!chefsByDept[deptId]) {
        chefsByDept[deptId] = [];
      }
      chefsByDept[deptId].push({
        ...chef,
        displayName: chef.displayName || chef.name || chef.nameEn || (isRtl ? 'غير معروف' : 'Unknown'),
        department: {
          ...chef.department,
          displayName: chef.department?.displayName || chef.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
        },
      });
    });
    return chefsByDept;
  }, [chefs, isRtl]);

  // التحقق من صحة النموذج
  const isFormValid = useCallback(() => {
    return assignFormData.items.every(
      (item) => item.assignedTo && item.departmentId && item.departmentId !== 'no-department'
    );
  }, [assignFormData]);

  // تحديث شيف معين لعنصر معين
  const handleAssignChef = useCallback(
    (index: number, chefId: string) => {
      setAssignForm({
        items: assignFormData.items.map((item, i) =>
          i === index ? { ...item, assignedTo: chefId } : item
        ),
      });
    },
    [assignFormData, setAssignForm]
  );

  // إعادة تعيين النموذج عند فتح النافذة
  useEffect(() => {
    if (isOpen && selectedOrder) {
      setAssignForm({
        items: selectedOrder.items
          .filter((item) => !item.assignedTo && item.department?._id && item.department._id !== 'no-department')
          .map((item) => ({
            itemId: item._id,
            assignedTo: '',
            product: item.displayProductName || item.productName || (isRtl ? 'غير معروف' : 'Unknown'),
            quantity: item.quantity,
            unit: item.displayUnit || translateUnit(item.unit || 'unit', isRtl),
            departmentId: item.department._id,
          })),
      });
    }
  }, [isOpen, selectedOrder, setAssignForm, isRtl]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isRtl ? 'تعيين الشيفات للطلب' : 'Assign Chefs to Order'}
      size="md"
      className="bg-white rounded-xl shadow-xl border border-gray-100 max-h-[90vh] overflow-y-auto"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {loading ? (
          <div className="text-center">
            <p className="text-sm text-gray-600">{isRtl ? 'جاري التحميل...' : 'Loading...'}</p>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center gap-2 text-red-600">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">{error}</p>
          </div>
        ) : selectedOrder ? (
          <>
            <div className="space-y-4">
              <h3 className={`text-lg font-semibold text-gray-800 ${isRtl ? 'text-right' : 'text-left'} whitespace-nowrap overflow-hidden text-ellipsis`}>
                {isRtl ? `طلب رقم: ${selectedOrder.orderNumber}` : `Order Number: ${selectedOrder.orderNumber}`}
              </h3>
              {assignFormData.items.length === 0 ? (
                <p className="text-sm text-gray-600 text-center whitespace-nowrap overflow-hidden text-ellipsis">
                  {isRtl
                    ? 'جميع العناصر تم تعيينها مسبقًا أو لا تحتوي على قسم صالح'
                    : 'All items have already been assigned or have no valid department'}
                </p>
              ) : (
                assignFormData.items.map((item, index) => {
                  const availableChefs = availableChefsByDepartment[item.departmentId] || [];
                  return (
                    <div
                      key={item.itemId}
                      className="flex flex-col gap-2 p-4 bg-gray-50 rounded-lg border border-gray-100 shadow-sm"
                    >
                      <div className={`flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
                        <span className="text-sm font-medium text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis">
                          {isRtl
                            ? `${item.product} (${item.quantity} ${item.unit})`
                            : `${item.product} (${item.quantity} ${item.unit})`}
                        </span>
                      </div>
                      {item.departmentId === 'no-department' ? (
                        <p className="text-sm text-red-600 whitespace-nowrap overflow-hidden text-ellipsis">
                          {isRtl ? 'القسم غير مُعرف لهذا العنصر' : 'Department not defined for this item'}
                        </p>
                      ) : availableChefs.length === 0 ? (
                        <p className="text-sm text-red-600 whitespace-nowrap overflow-hidden text-ellipsis">
                          {isRtl ? 'لا يوجد شيفات متاحين لهذا القسم' : 'No chefs available for this department'}
                        </p>
                      ) : (
                        <ProductDropdown
                          options={[
                            { value: '', label: isRtl ? 'اختر شيف' : 'Select Chef' },
                            ...availableChefs.map((chef) => ({
                              value: chef.userId || chef._id,
                              label: chef.displayName || (isRtl ? 'غير معروف' : 'Unknown'),
                            })),
                          ]}
                          value={item.assignedTo}
                          onChange={(value) => handleAssignChef(index, value)}
                          ariaLabel={isRtl ? 'تعيين شيف' : 'Assign Chef'}
                          className={`w-full rounded-lg border-gray-200 focus:ring-amber-500 text-sm shadow-sm transition-all duration-200 ${
                            !item.assignedTo ? 'border-red-500' : ''
                          }`}
                        />
                      )}
                      {!item.assignedTo && availableChefs.length > 0 && item.departmentId !== 'no-department' && (
                        <p className="text-xs text-red-600 mt-1 whitespace-nowrap overflow-hidden text-ellipsis">
                          {isRtl ? 'يرجى اختيار شيف' : 'Please select a chef'}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <div className={`flex justify-end gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <Button
                variant="secondary"
                onClick={onClose}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg px-4 py-2 text-sm font-medium shadow transition-all duration-200"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                variant="primary"
                onClick={() => assignChefs(selectedOrder.id)}
                disabled={submitting === selectedOrder.id || !isFormValid() || assignFormData.items.length === 0}
                className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-4 py-2 text-sm font-medium shadow transition-all duration-200 disabled:opacity-50"
              >
                {submitting === selectedOrder.id
                  ? isRtl
                    ? 'جاري التعيين...'
                    : 'Assigning...'
                  : isRtl
                  ? 'تعيين الشيفات'
                  : 'Assign Chefs'}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-600 text-center whitespace-nowrap overflow-hidden text-ellipsis">
            {isRtl ? 'لم يتم تحديد طلب' : 'No order selected'}
          </p>
        )}
      </motion.div>
    </Modal>
  );
};

export default AssignChefsModal;