import React from 'react';
import { motion } from 'framer-motion';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { Card } from '../../components/UI/Card';

export const OrderTableSkeleton: React.FC<{ isRtl: boolean; rows: number }> = ({ isRtl, rows }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className="overflow-x-auto bg-white shadow-md rounded-lg border border-gray-100"
  >
    <table className="min-w-full">
      <thead>
        <tr className={isRtl ? 'flex-row-reverse' : ''}>
          {Array(8).fill(0).map((_, index) => (
            <th key={index} className="px-2 py-2">
              <Skeleton width={70} height={12} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array(rows).fill(0).map((_, rowIndex) => (
          <tr
            key={rowIndex}
            className={`hover:bg-gray-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}
          >
            {Array(8).fill(0).map((_, cellIndex) => (
              <td key={cellIndex} className="px-2 py-2">
                <Skeleton width={80} height={12} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </motion.div>
);

export const OrderCardSkeleton: React.FC<{ isRtl: boolean }> = ({ isRtl }) => (
  <Card className="p-3 bg-white shadow-md rounded-lg border border-gray-100 hover:shadow-lg transition-shadow">
    <div className="flex flex-col gap-2">
      <div className={`flex items-center ${isRtl ? 'justify-end' : 'justify-between'}`}>
        <Skeleton width={140} height={16} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
        <Skeleton width={60} height={16} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
      </div>
      <Skeleton width={100} height={10} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
      <Skeleton width="100%" height={4} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
      <div className="grid grid-cols-2 gap-2">
        {Array(4).fill(0).map((_, index) => (
          <div key={index}>
            <Skeleton width={50} height={10} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
            <Skeleton width={80} height={14} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
          </div>
        ))}
      </div>
      <Skeleton width="100%" height={24} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
      <div className={`flex gap-2 ${isRtl ? 'justify-end' : 'justify-start'}`}>
        {Array(2).fill(0).map((_, index) => (
          <Skeleton key={index} width={60} height={20} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
        ))}
      </div>
    </div>
  </Card>
);