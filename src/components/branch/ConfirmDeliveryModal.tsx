import React, { memo } from 'react';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';
import { Order } from '../../types/types';
import { X, Truck } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  
  t: (key: string, params?: any) => string;
  isRtl: boolean;
  confirmDelivery: (orderId: string) => void;
  submitting: string | null;
}

const ConfirmDeliveryModal: React.FC<Props> = memo(({ isOpen, onClose, order, t, isRtl, confirmDelivery, submitting }) => {
  if (!order) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isRtl ? `تأكيد تسليم الطلب #${order.orderNumber}` : `Confirm Delivery for Order #${order.orderNumber}`}
      icon={X}
      className="max-w-lg w-full p-6 bg-white rounded-lg shadow-xl"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="space-y-6">
        <p className="text-base text-gray-700">
          {isRtl
            ? `هل أنت متأكد من أنك تريد تأكيد تسليم الطلب #${order.orderNumber}؟ سيتم تحديث حالة الطلب إلى "تم التسليم" وسيتم إضافة المنتجات إلى المخزون.`
            : `Are you sure you want to confirm delivery for order #${order.orderNumber}? The order status will be updated to "Delivered" and products will be added to inventory.`}
        </p>
        <div className="border border-gray-200 rounded-md p-4">
          <p className="text-sm font-medium text-gray-700 mb-2">{isRtl ? 'المنتجات' : 'Products'}</p>
          {order.items.map(item => (
            <p key={item.itemId} className="text-sm text-gray-600">
              {isRtl
                ? `${item.quantity} ${t(`${item.unit || 'unit'}`)} × ${item.productName}`
                : `${item.quantity} ${t(`${item.unit || 'unit'}`)} × ${item.productName}`}
            </p>
          ))}
        </div>
        <div className={`flex gap-4 ${isRtl ? 'justify-end' : 'justify-start'}`}>
          <Button
            variant="secondary"
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg px-4 py-2 text-sm"
          >
            {isRtl ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            variant="success"
            icon={Truck}
            onClick={() => confirmDelivery(order.id)}
            className="bg-green-500 hover:bg-green-600 text-white rounded-lg px-4 py-2 text-sm"
            disabled={submitting === order.id}
          >
            {isRtl ? 'تأكيد التسليم' : 'Confirm Delivery'}
          </Button>
        </div>
      </div>
    </Modal>
  );
});

ConfirmDeliveryModal.displayName = 'ConfirmDeliveryModal';

export default ConfirmDeliveryModal;