import React from 'react';
import { motion } from 'framer-motion';

interface OrderCardSkeletonProps {
  isRtl: boolean;
}

const OrderCardSkeleton: React.FC<OrderCardSkeletonProps> = ({ isRtl }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-4 p-4 sm:p-5 bg-white shadow-md rounded-lg border border-gray-200 animate-pulse"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="flex flex-col gap-4">
        {/* Order Number and Status */}
        <div className={`flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-5 bg-gray-200 rounded w-24"></div>
        </div>
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div className="bg-gray-300 h-2.5 rounded-full w-1/2"></div>
        </div>
        {/* Unassigned Items Warning */}
        <div className="h-5 bg-gray-200 rounded w-full"></div>
        {/* Order Details */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          </div>
          <div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          </div>
          <div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          </div>
        </div>
        {/* Items Section */}
        <div>
          <div className="h-6 bg-gray-200 rounded w-full mb-3"></div>
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-gray-100 rounded-lg gap-3">
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              </div>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            </div>
          </div>
        </div>
        {/* Notes */}
        <div className="h-5 bg-gray-200 rounded w-full"></div>
        {/* Actions */}
        <div className={`flex gap-2 ${isRtl ? 'justify-end' : 'justify-start'}`}>
          <div className="h-8 bg-gray-200 rounded-full w-20"></div>
          <div className="h-8 bg-gray-200 rounded-full w-20"></div>
          <div className="h-8 bg-gray-200 rounded-full w-20"></div>
        </div>
      </div>
    </motion.div>
  );
};

export default OrderCardSkeleton;