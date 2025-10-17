import React from 'react';
import { Card } from '../../components/UI/Card';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

const ReturnCardSkeleton: React.FC = () => (
  <Card className="p-6 mb-4 bg-white shadow-lg rounded-xl border border-gray-100">
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton width={180} height={20} />
        <Skeleton width={80} height={20} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array(6).fill(0).map((_, index) => (
          <div key={index}>
            <Skeleton width={70} height={14} />
            <Skeleton width={100} height={18} />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {Array(2).fill(0).map((_, index) => (
          <Skeleton key={index} width="100%" height={40} />
        ))}
      </div>
      <div className="flex gap-2 justify-end">
        {Array(3).fill(0).map((_, index) => (
          <Skeleton key={index} width={80} height={32} />
        ))}
      </div>
    </div>
  </Card>
);

export default ReturnCardSkeleton;