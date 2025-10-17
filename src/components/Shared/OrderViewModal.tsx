import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Modal } from '../../components/UI/Modal';
import { Order } from './BranchOrders';

interface OrderViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

export default function OrderViewModal({ isOpen, onClose, order }: OrderViewModalProps) {
  const { t } = useLanguage();

  const priorityLabels = {
    low: t('orders.priority.low'),
    medium: t('orders.priority.medium'),
    high: t('orders.priority.high'),
    urgent: t('orders.priority.urgent'),
  };

  const departmentLabels = {
    'eastern-sweets': t('departments.eastern-sweets'),
    'western-sweets': t('departments.western-sweets'),
    bakery: t('departments.bakery'),
    chocolate: t('departments.chocolate'),
  };

  const getItemStatusInfo = (status: Order['items'][0]['status']) => {
    switch (status) {
      case 'pending':
        return { label: t('orders.itemStatus.pending'), color: 'bg-yellow-100 text-yellow-800' };
      case 'assigned':
        return { label: t('orders.itemStatus.assigned'), color: 'bg-blue-100 text-blue-800' };
      case 'in_progress':
        return { label: t('orders.itemStatus.in_progress'), color: 'bg-purple-100 text-purple-800' };
      case 'completed':
        return { label: t('orders.itemStatus.completed'), color: 'bg-green-100 text-green-800' };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-800' };
    }
  };

  if (!order) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('orders.orderDetails')} #${order.orderNumber}`}
      size="lg"
      className="bg-white rounded-xl"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">{t('orders.branch')}</p>
            <p className="font-medium text-lg text-gray-900">{order.branchName}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">{t('orders.date')}</p>
            <p className="font-medium text-lg text-gray-900">{order.date}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">{t('orders.priority')}</p>
            <p className="font-medium text-lg text-gray-900">{priorityLabels[order.priority]}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">{t('orders.createdBy')}</p>
            <p className="font-medium text-lg text-gray-900">{order.createdBy}</p>
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-gray-900 mb-3">{t('orders.items')}:</h4>
          <div className="space-y-2">
            {order.items.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{item.productName}</p>
                  <p className="text-sm text-gray-600">{t('orders.quantity')}: {item.quantity}</p>
                  <p className="text-sm text-gray-600">{t('departments.department') || 'القسم'}: {departmentLabels[item.department.name] || item.department.name}</p>
                  <p className="text-sm text-gray-600">{t('orders.assignedTo') || 'معين إلى'}: {item.assignedTo?.username || t('orders.unassigned')}</p>
                  <p className="text-sm text-gray-600">{t('orders.itemStatus') || 'حالة العنصر'}: {getItemStatusInfo(item.status).label}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">{item.price} {t('orders.currency')}</p>
                  <p className="text-sm text-gray-600">{t('orders.itemTotal')}: {item.quantity * item.price} {t('orders.currency')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t pt-4 border-gray-200">
          <div className="flex items-center justify-between text-lg font-bold text-gray-900">
            <span>{t('orders.finalTotal')}:</span>
            <span className="text-teal-600">{order.total} {t('orders.currency')}</span>
          </div>
        </div>

        {order.notes && (
          <div className="bg-amber-50 p-4 rounded-lg">
            <h5 className="font-medium text-amber-800 mb-2">{t('orders.notes')}:</h5>
            <p className="text-amber-700">{order.notes}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}