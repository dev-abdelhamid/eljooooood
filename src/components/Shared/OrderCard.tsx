import React, { useState, useCallback, memo, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../UI/Button';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Check, Package, Truck, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Order, OrderStatus, ItemStatus } from '../../types/types';
import { useLanguage } from '../../contexts/LanguageContext';

const STATUS_COLORS: Record<OrderStatus, { color: string; icon: React.FC; label: string; progress: number }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'pending', progress: 0 },
  approved: { color: 'bg-teal-100 text-teal-800', icon: Check, label: 'approved', progress: 25 },
  in_production: { color: 'bg-purple-100 text-purple-800', icon: Package, label: 'in_production', progress: 50 },
  completed: { color: 'bg-green-100 text-green-800', icon: Check, label: 'completed', progress: 75 },
  in_transit: { color: 'bg-blue-100 text-blue-800', icon: Truck, label: 'in_transit', progress: 90 },
  delivered: { color: 'bg-gray-100 text-gray-800', icon: Check, label: 'delivered', progress: 100 },
  cancelled: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: 'cancelled', progress: 0 },
};

const ITEM_STATUS_COLORS: Record<ItemStatus, { label: string; color: string; icon: React.FC }> = {
  pending: { label: 'pending', color: 'bg-gray-50 text-gray-600', icon: Clock },
  assigned: { label: 'assigned', color: 'bg-blue-50 text-blue-600', icon: Check },
  in_progress: { label: 'in_progress', color: 'bg-yellow-50 text-yellow-600', icon: Package },
  completed: { label: 'completed', color: 'bg-green-50 text-green-600', icon: Check },
  cancelled: { label: 'cancelled', color: 'bg-red-50 text-red-600', icon: AlertCircle },
};

const PRIORITY_COLORS: Record<Order['priority'], string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

interface OrderCardProps {
  order: Order;
  calculateAdjustedTotal: (order: Order) => string;
  calculateTotalQuantity: (order: Order) => number;
  translateUnit: (unit: string, isRtl: boolean) => string;
  updateOrderStatus: (orderId: string, newStatus: OrderStatus) => Promise<void>;
  openAssignModal: (order: Order) => void;
  submitting: string | null;
  isRtl: boolean;
}

const OrderCard: React.FC<OrderCardProps> = ({
  order,
  calculateAdjustedTotal,
  calculateTotalQuantity,
  translateUnit,
  updateOrderStatus,
  openAssignModal,
  submitting,
  isRtl,
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);

  const validTransitions: Record<OrderStatus, OrderStatus[]> = useMemo(
    () => ({
      pending: ['approved', 'cancelled'],
      approved: ['in_production', 'cancelled'],
      in_production: ['completed', 'cancelled'],
      completed: ['in_transit'],
      in_transit: ['delivered'],
      delivered: [],
      cancelled: [],
    }),
    []
  );

  const toggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleStatusChange = useCallback(
    (newStatus: OrderStatus) => {
      if (validTransitions[order.status].includes(newStatus)) {
        updateOrderStatus(order.id, newStatus);
      }
    },
    [order.id, order.status, updateOrderStatus, validTransitions]
  );

  const statusOptions = useMemo(
    () =>
      validTransitions[order.status].map(status => ({
        value: status,
        label: t(`order_status.${status}`),
      })),
    [order.status, validTransitions, t]
  );

  const isActionDisabled = useCallback(
    (status: OrderStatus) =>
      submitting === order.id || !validTransitions[order.status].includes(status),
    [submitting, order.id, order.status, validTransitions]
  );

  const itemsList = useMemo(
    () =>
      order.items.map(item => ({
        ...item,
        displayUnit: translateUnit(item.unit, isRtl),
        statusLabel: t(`item_status.${item.status}`),
        statusColor: ITEM_STATUS_COLORS[item.status]?.color || 'bg-gray-50 text-gray-600',
        StatusIcon: ITEM_STATUS_COLORS[item.status]?.icon || Clock,
      })),
    [order.items, isRtl, translateUnit, t]
  );

  const canAssignChefs = useMemo(
    () =>
      ['admin', 'production'].includes(user?.role || '') &&
      order.status === 'approved' &&
      order.items.some(item => !item.assignedTo),
    [user?.role, order.status, order.items]
  );

  return (
    <motion.div
      className={`bg-white shadow-md rounded-xl border border-gray-100 p-4 ${
        isRtl ? 'text-right' : 'text-left'
      }`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex flex-col w-full">
          <div className={`flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-gray-900">
                {t('orders.order')} #{order.orderNumber}
              </span>
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  PRIORITY_COLORS[order.priority]
                }`}
              >
                {t(`priority.${order.priority}`)}
              </span>
            </div>
            <Button
              variant="ghost"
              onClick={toggleExpand}
              className="p-1 text-gray-500 hover:text-gray-700"
            >
              {isExpanded ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </Button>
          </div>
          <div className="text-xs text-gray-600 mt-1">
            {t('orders.branch')}: {order.branch.displayName}
          </div>
          <div className="text-xs text-gray-600">
            {t('orders.date')}: {order.date}
          </div>
        </div>
        <div className="flex flex-col items-start sm:items-end w-full sm:w-auto">
          <div
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              STATUS_COLORS[order.status].color
            }`}
          >
            <STATUS_COLORS[order.status].icon className="w-4 h-4" />
            {t(`order_status.${STATUS_COLORS[order.status].label}`)}
          </div>
          <div className="text-xs text-gray-600 mt-1">
            {t('orders.total_amount')}: {calculateAdjustedTotal(order)}
          </div>
          <div className="text-xs text-gray-600">
            {t('orders.total_quantity')}: {calculateTotalQuantity(order)}{' '}
            {isRtl ? 'وحدة' : 'units'}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-4 border-t border-gray-200 pt-3"
          >
            <div className="mb-3">
              <h4 className="text-xs font-semibold text-gray-800 mb-2">
                {t('orders.items')}
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {itemsList.length > 0 ? (
                  itemsList.map(item => (
                    <div
                      key={item._id}
                      className={`flex justify-between items-center p-2 rounded-lg ${
                        item.statusColor
                      } ${isRtl ? 'flex-row-reverse' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <item.StatusIcon className="w-4 h-4" />
                        <span className="text-xs">
                          {item.displayProductName} ({item.quantity}{' '}
                          {item.displayUnit})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs">
                          {item.assignedTo
                            ? `${t('orders.assigned_to')}: ${
                                item.assignedTo.displayName
                              }`
                            : t('orders.unassigned')}
                        </span>
                        <span className="text-xs font-medium">
                          {item.statusLabel}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-gray-500">
                    {t('orders.no_items')}
                  </div>
                )}
              </div>
            </div>
            {order.notes && (
              <div className="mb-3">
                <h4 className="text-xs font-semibold text-gray-800 mb-1">
                  {t('orders.notes')}
                </h4>
                <p className="text-xs text-gray-600">{order.notes}</p>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2 mt-3">
              {['admin', 'branch'].includes(user?.role || '') &&
                statusOptions.length > 0 && (
                  <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    {statusOptions.map(option => (
                      <Button
                        key={option.value}
                        variant={
                          submitting === order.id ? 'secondary' : 'primary'
                        }
                        onClick={() => handleStatusChange(option.value as OrderStatus)}
                        disabled={isActionDisabled(option.value as OrderStatus)}
                        className={`text-xs px-3 py-1 rounded-full ${
                          submitting === order.id
                            ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                            : 'bg-amber-600 hover:bg-amber-700 text-white'
                        }`}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                )}
              {canAssignChefs && (
                <Button
                  variant={submitting === order.id ? 'secondary' : 'primary'}
                  onClick={() => openAssignModal(order)}
                  disabled={submitting === order.id}
                  className={`text-xs px-3 py-1 rounded-full ${
                    submitting === order.id
                      ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  } ${isRtl ? 'mr-auto' : 'ml-auto'}`}
                >
                  {t('orders.assign_chefs')}
                </Button>
              )}
              <Link to={`/orders/${order.id}`}>
                <Button
                  variant="outline"
                  className="text-xs px-3 py-1 rounded-full border-amber-600 text-amber-600 hover:bg-amber-50"
                >
                  {t('orders.view_details')}
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default memo(OrderCard);