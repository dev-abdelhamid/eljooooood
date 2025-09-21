import React from 'react';
import { motion } from 'framer-motion';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { Card } from '../../components/UI/Card';

export const OrderTableSkeleton: React.FC<{ isRtl: boolean }> = ({ isRtl }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className="overflow-x-auto rounded-lg shadow-md border border-gray-200 bg-white"
  >
    <table className="min-w-full divide-y divide-gray-200 table-auto">
      <thead className="bg-gray-50">
        <tr className={isRtl ? 'flex-row-reverse' : ''}>
          {['#', 'Order Number', 'Status', 'Products', 'Total Amount', 'Total Quantity', 'Date', 'Actions'].map((_, index) => (
            <th
              key={index}
              className={`px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider ${
                isRtl ? 'text-right' : 'text-left'
              } ${index === 0 ? 'w-[5%]' : index === 1 ? 'w-[15%]' : index === 2 ? 'w-[15%]' : index === 3 ? 'w-[30%]' : index === 4 ? 'w-[15%]' : index === 5 ? 'w-[10%]' : index === 6 ? 'w-[15%]' : 'w-[15%]'}`}
            >
              <Skeleton width={index === 3 ? 120 : 80} height={14} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {Array(5).fill(0).map((_, rowIndex) => (
          <tr
            key={rowIndex}
            className={`hover:bg-gray-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}
          >
            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
              <Skeleton width={30} height={14} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
            </td>
            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
              <Skeleton width={60} height={14} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
            </td>
            <td className="px-4 py-2 whitespace-nowrap text-sm">
              <Skeleton width={80} height={20} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
            </td>
            <td className="px-4 py-2 text-sm text-gray-600">
              <Skeleton width={200} height={14} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
            </td>
            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
              <Skeleton width={70} height={14} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
            </td>
            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
              <Skeleton width={50} height={14} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
            </td>
            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
              <Skeleton width={80} height={14} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
            </td>
            <td className="px-4 py-2 whitespace-nowrap text-sm">
              <div className={`flex gap-2 ${isRtl ? 'justify-end' : 'justify-start'}`}>
                <Skeleton width={60} height={24} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
                <Skeleton width={100} height={24} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </motion.div>
);

export const OrderCardSkeleton: React.FC<{ isRtl: boolean }> = ({ isRtl }) => (
  <Card className="p-3 mb-4 bg-white shadow-md rounded-lg border border-gray-200 hover:shadow-lg transition-shadow duration-300">
    <div className="flex flex-col gap-3">
      <div className={`flex items-center ${isRtl ? 'justify-end gap-2 flex-row-reverse' : 'justify-between'}`}>
        <div className="flex items-center gap-2">
          <Skeleton width={140} height={18} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
          <Skeleton width={60} height={18} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
        </div>
        <Skeleton width={90} height={20} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <Skeleton width="50%" height={6} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
      </div>
      <div className="p-1.5 bg-yellow-50 border border-yellow-100 rounded-md flex items-center gap-1.5">
        <Skeleton circle width={14} height={14} baseColor="#fef3c7" highlightColor="#fef9c3" />
        <Skeleton width={100} height={12} baseColor="#fef3c7" highlightColor="#fef9c3" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Array(4).fill(0).map((_, index) => (
          <div key={index}>
            <Skeleton width={60} height={12} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
            <Skeleton width={90} height={16} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
          </div>
        ))}
      </div>
      <div>
        <Skeleton width="100%" height={32} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
        <div className="space-y-2 mt-2">
          {Array(2).fill(0).map((_, index) => (
            <div key={index} className="p-2 bg-gray-50 rounded-md">
              <div className="flex items-center justify-between gap-2">
                <Skeleton width={150} height={14} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
                <Skeleton width={80} height={20} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
              </div>
              <Skeleton width={120} height={12} baseColor="#f3f4f6" highlightColor="#e5e7eb" className="mt-1" />
            </div>
          ))}
        </div>
      </div>
      <div className="p-1.5 bg-amber-50 rounded-md">
        <Skeleton width={200} height={12} baseColor="#fef3c7" highlightColor="#fef9c3" />
      </div>
      <div className={`flex gap-2 ${isRtl ? 'justify-end flex-row-reverse' : 'justify-start'}`}>
        {Array(3).fill(0).map((_, index) => (
          <Skeleton key={index} width={70} height={28} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
        ))}
      </div>
    </div>
  </Card>
);