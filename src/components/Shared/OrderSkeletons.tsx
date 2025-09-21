import React from 'react';
import { motion } from 'framer-motion';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { Card } from '../../components/UI/Card';

export const OrderTableSkeleton: React.FC<{ isRtl: boolean }> = ({ isRtl }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: 'easeOut' }}
    className="overflow-x-auto bg-white shadow-sm rounded-xl border border-gray-100"
  >
    <table className="min-w-full">
      <thead>
        <tr className={isRtl ? 'flex-row-reverse' : ''}>
          {Array(7).fill(0).map((_, index) => (
            <th key={index} className="px-4 py-3">
              <Skeleton width={80} height={14} baseColor="#f0f2f5" highlightColor="#e2e8f0" duration={1.2} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array(3).fill(0).map((_, rowIndex) => (
          <tr
            key={rowIndex}
            className={`hover:bg-gray-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}
          >
            {Array(7).fill(0).map((_, cellIndex) => (
              <td key={cellIndex} className="px-4 py-3">
                <Skeleton width={100} height={14} baseColor="#f0f2f5" highlightColor="#e2e8f0" duration={1.2} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </motion.div>
);

export const OrderCardSkeleton: React.FC<{ isRtl: boolean }> = ({ isRtl }) => (
  <Card className="p-4 mb-2 bg-white shadow-sm rounded-xl border border-gray-100 hover:shadow-md transition-shadow duration-300 max-w-3xl mx-auto">
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col gap-3"
    >
      <div className={`flex items-center ${isRtl ? 'justify-end' : 'justify-between'}`}>
        <Skeleton width={140} height={16} baseColor="#f0f2f5" highlightColor="#e2e8f0" duration={1.2} />
        <Skeleton width={60} height={16} baseColor="#f0f2f5" highlightColor="#e2e8f0" duration={1.2} />
      </div>
      <Skeleton width={100} height={12} baseColor="#f0f2f5" highlightColor="#e2e8f0" duration={1.2} />
      <Skeleton width="100%" height={4} baseColor="#f0f2f5" highlightColor="#e2e8f0" duration={1.2} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array(4).fill(0).map((_, index) => (
          <div key={index}>
            <Skeleton width={50} height={12} baseColor="#f0f2f5" highlightColor="#e2e8f0" duration={1.2} />
            <Skeleton width={80} height={14} baseColor="#f0f2f5" highlightColor="#e2e8f0" duration={1.2} />
          </div>
        ))}
      </div>
      <Skeleton width="100%" height={24} baseColor="#f0f2f5" highlightColor="#e2e8f0" duration={1.2} />
      <div className={`flex gap-2 ${isRtl ? 'justify-end' : 'justify-start'}`}>
        {Array(2).fill(0).map((_, index) => (
          <Skeleton key={index} width={60} height={24} baseColor="#f0f2f5" highlightColor="#e2e8f0" duration={1.2} />
        ))}
      </div>
    </motion.div>
  </Card>
);