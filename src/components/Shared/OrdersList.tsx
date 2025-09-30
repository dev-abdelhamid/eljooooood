import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../../components/UI/Card';
import { ShoppingCart, AlertCircle } from 'lucide-react';
import OrderCard from '../../components/Shared/OrderCard';
import OrderTable from '../../components/Shared/OrderTable';
import { OrderCardSkeleton, OrderTableSkeleton } from '../../components/Shared/OrderSkeletons';
import { Order, OrderStatus } from '../../types/types';

interface OrdersListProps {
  loading: boolean;
  error: string;
  paginatedOrders: Order[];
  viewMode: 'card' | 'table';
  calculateAdjustedTotal: (order: Order) => string;
  calculateTotalQuantity: (order: Order) => number;
  translateUnit: (unit: string, isRtl: boolean) => string;
  updateOrderStatus: (orderId: string, newStatus: OrderStatus) => Promise<void>;
  openAssignModal: (order: Order) => void;
  submitting: string | null;
  isRtl: boolean;
  startIndex: number;
  filterStatus: string;
  filterBranch: string;
  searchQuery: string;
}

const ORDERS_PER_PAGE = { card: 12, table: 50 };

const OrdersList: React.FC<OrdersListProps> = ({
  loading,
  error,
  paginatedOrders,
  viewMode,
  calculateAdjustedTotal,
  calculateTotalQuantity,
  translateUnit,
  updateOrderStatus,
  openAssignModal,
  submitting,
  isRtl,
  startIndex,
  filterStatus,
  filterBranch,
  searchQuery,
}) => {
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-4"
      >
        {viewMode === 'card' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: ORDERS_PER_PAGE.card }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <OrderCardSkeleton isRtl={isRtl} />
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <OrderTableSkeleton isRtl={isRtl} rows={ORDERS_PER_PAGE.table} />
          </motion.div>
        )}
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="mt-6"
      >
        <Card className="p-5 max-w-md mx-auto text-center bg-red-50 shadow-md rounded-xl border border-red-100">
          <div className={`flex items-center justify-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-xs font-medium text-red-600">{error}</p>
          </div>
        </Card>
      </motion.div>
    );
  }

  if (paginatedOrders.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="mt-6"
      >
        <Card className="p-6 text-center bg-white shadow-md rounded-xl border border-gray-100">
          <ShoppingCart className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-medium text-gray-800 mb-1">{isRtl ? 'لا توجد طلبات' : 'No Orders'}</h3>
          <p className="text-xs text-gray-500">
            {filterStatus || filterBranch || searchQuery
              ? isRtl
                ? 'لا توجد طلبات مطابقة'
                : 'No matching orders'
              : isRtl
              ? 'لا توجد طلبات بعد'
              : 'No orders yet'}
          </p>
        </Card>
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={viewMode}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-4"
      >
        {viewMode === 'table' ? (
          <OrderTable
            orders={paginatedOrders}
            calculateAdjustedTotal={calculateAdjustedTotal}
            calculateTotalQuantity={calculateTotalQuantity}
            translateUnit={translateUnit}
            updateOrderStatus={updateOrderStatus}
            openAssignModal={openAssignModal}
            submitting={submitting}
            isRtl={isRtl}
            startIndex={startIndex}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedOrders.map(order => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <OrderCard
                  order={order}
                  calculateAdjustedTotal={calculateAdjustedTotal}
                  calculateTotalQuantity={calculateTotalQuantity}
                  translateUnit={translateUnit}
                  updateOrderStatus={updateOrderStatus}
                  openAssignModal={openAssignModal}
                  submitting={submitting}
                  isRtl={isRtl}
                />
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default OrdersList;