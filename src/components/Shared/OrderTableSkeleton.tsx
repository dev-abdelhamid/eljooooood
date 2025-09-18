import React from 'react';
import { motion } from 'framer-motion';

interface OrderTableSkeletonProps {
  isRtl: boolean;
}

const OrderTableSkeleton: React.FC<OrderTableSkeletonProps> = ({ isRtl }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="overflow-x-auto rounded-lg shadow-md border border-gray-200 animate-pulse"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <table className="min-w-full divide-y divide-gray-200 table-auto bg-white">
        <thead className="bg-gray-50">
          <tr className={isRtl ? 'flex-row-reverse' : ''}>
            <th className="px-4 py-3 w-[5%]">
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </th>
            <th className="px-4 py-3 w-[15%]">
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </th>
            <th className="px-4 py-3 w-[15%]">
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </th>
            <th className="px-4 py-3 w-[10%]">
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </th>
            <th className="px-4 py-3 w-[30%]">
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </th>
            <th className="px-4 py-3 w-[15%]">
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </th>
            <th className="px-4 py-3 w-[10%]">
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </th>
            <th className="px-4 py-3 w-[15%]">
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </th>
            <th className="px-4 py-3 w-[20%]">
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {Array(5).fill(null).map((_, index) => (
            <tr key={index} className={isRtl ? 'flex-row-reverse' : ''}>
              <td className="px-4 py-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </td>
              <td className="px-4 py-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </td>
              <td className="px-4 py-2">
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </td>
              <td className="px-4 py-2">
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </td>
              <td className="px-4 py-2">
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mt-2"></div>
              </td>
              <td className="px-4 py-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </td>
              <td className="px-4 py-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </td>
              <td className="px-4 py-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </td>
              <td className="px-4 py-2">
                <div className={`flex gap-2 ${isRtl ? 'justify-end' : 'justify-start'}`}>
                  <div className="h-8 bg-gray-200 rounded-full w-20"></div>
                  <div className="h-8 bg-gray-200 rounded-full w-20"></div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  );
};

export default OrderTableSkeleton;