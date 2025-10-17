
import React, { memo } from 'react';
import { motion } from 'framer-motion';

interface Props {
  isRtl: boolean;
}

const OrderCardSkeleton: React.FC<Props> = memo(({ isRtl }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className="p-4 sm:p-5 mb-4 bg-white shadow-md rounded-lg border border-gray-200 animate-pulse"
    dir={isRtl ? 'rtl' : 'ltr'}
  >
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="h-6 bg-gray-200 rounded w-1/3"></div>
        <div className="h-5 bg-gray-200 rounded-full w-20"></div>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5"></div>
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
        <div>
          <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
          <div className="h-5 bg-gray-200 rounded w-16"></div>
        </div>
        <div>
          <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
          <div className="h-5 bg-gray-200 rounded w-16"></div>
        </div>
        <div>
          <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
          <div className="h-5 bg-gray-200 rounded w-16"></div>
        </div>
      </div>
      <div className="mt-2 p-2 bg-gray-50 rounded-md">
        <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
        <div className="h-5 bg-gray-200 rounded w-3/4"></div>
      </div>
      <div className="flex gap-2 justify-start">
        <div className="h-8 bg-gray-200 rounded-full w-16"></div>
        <div className="h-8 bg-gray-200 rounded-full w-24"></div>
      </div>
    </div>
  </motion.div>
));

export default OrderCardSkeleton;
