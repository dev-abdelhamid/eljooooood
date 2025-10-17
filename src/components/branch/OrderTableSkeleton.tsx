
import React, { memo } from 'react';

interface Props {
  isRtl: boolean;
}

const OrderTableSkeleton: React.FC<Props> = memo(({ isRtl }) => (
  <div className="overflow-x-auto rounded-lg shadow-md border border-gray-200 animate-pulse" dir={isRtl ? 'rtl' : 'ltr'}>
    <table className="min-w-full divide-y divide-gray-200 table-auto bg-white">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[5%]">
            <div className="h-4 bg-gray-200 rounded w-8"></div>
          </th>
          <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[15%]">
            <div className="h-4 bg-gray-200 rounded w-24"></div>
          </th>
          <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[15%]">
            <div className="h-4 bg-gray-200 rounded w-20"></div>
          </th>
          <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[30%]">
            <div className="h-4 bg-gray-200 rounded w-32"></div>
          </th>
          <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[15%]">
            <div className="h-4 bg-gray-200 rounded w-24"></div>
          </th>
          <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[10%]">
            <div className="h-4 bg-gray-200 rounded w-20"></div>
          </th>
          <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[15%]">
            <div className="h-4 bg-gray-200 rounded w-24"></div>
          </th>
          <th className="px-4 py-3 text-sm font-medium text-gray-600 uppercase tracking-wider text-right w-[15%]">
            <div className="h-4 bg-gray-200 rounded w-20"></div>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {Array(5)
          .fill(null)
          .map((_, i) => (
            <tr key={i} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">
                <div className="h-5 bg-gray-200 rounded w-8"></div>
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">
                <div className="h-5 bg-gray-200 rounded w-16"></div>
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-right">
                <div className="h-5 bg-gray-200 rounded w-20"></div>
              </td>
              <td className="px-4 py-2 text-sm text-gray-600 text-right">
                <div className="h-5 bg-gray-200 rounded w-3/4"></div>
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">
                <div className="h-5 bg-gray-200 rounded w-16"></div>
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">
                <div className="h-5 bg-gray-200 rounded w-12"></div>
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">
                <div className="h-5 bg-gray-200 rounded w-24"></div>
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-right">
                <div className="flex gap-2 justify-end">
                  <div className="h-8 bg-gray-200 rounded-full w-16"></div>
                  <div className="h-8 bg-gray-200 rounded-full w-24"></div>
                </div>
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  </div>
));

export default OrderTableSkeleton;
