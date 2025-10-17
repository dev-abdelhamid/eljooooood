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
    className="overflow-x-auto rounded-md shadow-md border border-gray-100 bg-white"
  >
    <table className="min-w-full divide-y divide-gray-100">
      <thead className="bg-gray-50">
        <tr className={isRtl ? 'flex-row-reverse' : ''}>
          <th className="px-2 py-1.5 min-w-[40px]">
            <Skeleton width={60} height={12} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
          </th>
          {Array(8).fill(0).map((_, index) => (
            <th key={index} className="px-2 py-1.5 min-w-[80px]">
              <Skeleton width={80} height={12} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {Array(10).fill(0).map((_, rowIndex) => (
          <tr
            key={rowIndex}
            className={`hover:bg-gray-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}
          >
            <td className="px-2 py-1.5">
              <Skeleton width={40} height={12} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
            </td>
            {Array(8).fill(0).map((_, cellIndex) => (
              <td key={cellIndex} className="px-2 py-1.5">
                <Skeleton width={90} height={12} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </motion.div>
);

export const OrderCardSkeleton: React.FC<{ isRtl: boolean }> = ({ isRtl }) => (
  <Card className="p-3 mb-4 bg-white shadow-md rounded-lg border border-gray-200 hover:shadow-lg transition-shadow duration-300">
    <div className="flex flex-col gap-1.5">
      <div className={`flex items-center ${isRtl ? 'justify-between flex-row' : 'justify-between'}`}>
        <div className="flex items-center gap-1">
          <Skeleton width={140} height={16} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
          <Skeleton width={50} height={12} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
        </div>
        <Skeleton width={80} height={14} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
      </div>
      <Skeleton width="100%" height={6} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
      <Skeleton width="50%" height={12} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Array(4).fill(0).map((_, index) => (
          <div key={index}>
            <Skeleton width={60} height={10} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
            <Skeleton width={80} height={12} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
        <Skeleton width={100} height={12} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
        <Skeleton width={20} height={12} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
      </div>
      <div className={`flex gap-1.5 ${isRtl ? 'justify-end' : 'justify-start'}`}>
        {Array(3).fill(0).map((_, index) => (
          <Skeleton key={index} width={60} height={24} baseColor="#f3f4f6" highlightColor="#e5e7eb" className="rounded-full" />
        ))}
      </div>
    </div>
  </Card>
);