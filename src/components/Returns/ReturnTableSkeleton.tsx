import React from 'react';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

interface ReturnTableSkeletonProps {
  isRtl: boolean;
}

const ReturnTableSkeleton: React.FC<ReturnTableSkeletonProps> = ({ isRtl }) => {
  return (
    <div className="overflow-x-auto rounded-xl shadow-lg border border-gray-100">
      <table className="min-w-full bg-white">
        <thead className="bg-teal-50 sticky top-0 z-10">
          <tr className={isRtl ? 'text-right' : 'text-left'}>
            <th className="px-4 py-3">
              <Skeleton width={100} height={14} />
            </th>
            <th className="px-4 py-3">
              <Skeleton width={100} height={14} />
            </th>
            <th className="px-4 py-3">
              <Skeleton width={80} height={14} />
            </th>
            <th className="px-4 py-3">
              <Skeleton width={80} height={14} />
            </th>
            <th className="px-4 py-3">
              <Skeleton width={100} height={14} />
            </th>
            <th className="px-4 py-3">
              <Skeleton width={80} height={14} />
            </th>
            <th className="px-4 py-3">
              <Skeleton width={80} height={14} />
            </th>
            <th className="px-4 py-3">
              <Skeleton width={80} height={14} />
            </th>
            <th className="px-4 py-3">
              <Skeleton width={80} height={14} />
            </th>
            <th className="px-4 py-3">
              <Skeleton width={100} height={14} />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {Array(5).fill(0).map((_, index) => (
            <tr key={index} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <Skeleton width={80} height={16} />
              </td>
              <td className="px-4 py-3">
                <Skeleton width={80} height={16} />
              </td>
              <td className="px-4 py-3">
                <Skeleton width={100} height={16} />
              </td>
              <td className="px-4 py-3">
                <Skeleton width={120} height={16} />
              </td>
              <td className="px-4 py-3">
                <Skeleton width={150} height={16} />
              </td>
              <td className="px-4 py-3">
                <Skeleton width={100} height={16} />
              </td>
              <td className="px-4 py-3">
                <Skeleton width={60} height={16} />
              </td>
              <td className="px-4 py-3">
                <Skeleton width={80} height={16} />
              </td>
              <td className="px-4 py-3">
                <Skeleton width={80} height={16} />
              </td>
              <td className="px-4 py-3">
                <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <Skeleton width={60} height={16} />
                  <Skeleton width={60} height={16} />
                  <Skeleton width={60} height={16} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ReturnTableSkeleton;