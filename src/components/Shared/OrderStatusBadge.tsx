import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

interface OrderStatusBadgeProps {
  status: string;
}

const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ status }) => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';

  const statusStyles: Record<string, { bg: string; text: string }> = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
    approved: { bg: 'bg-blue-100', text: 'text-blue-800' },
    in_production: { bg: 'bg-purple-100', text: 'text-purple-800' },
    completed: { bg: 'bg-green-100', text: 'text-green-800' },
    in_transit: { bg: 'bg-indigo-100', text: 'text-indigo-800' },
    delivered: { bg: 'bg-teal-300', text: 'text-teal-800' },
    cancelled: { bg: 'bg-red-100', text: 'text-red-800' },
  };

  const { bg, text } = statusStyles[status] || statusStyles.pending;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bg} ${text} ${isRtl ? 'ml-2' : 'mr-2'}`}
    >
      {t(`orders.${status}`)}
    </span>
  );
};

export default OrderStatusBadge;