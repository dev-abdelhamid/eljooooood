// OrdersVsReturnsTable.tsx

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/UI/Button';
import { Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';
import { Tooltip } from 'react-tooltip';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';
import { formatNumber, formatPrice, exportToPDF } from './ProductionReport'; // Import shared functions from ProductionReport or a utils file
import { Fragment } from 'react';

interface OrdersVsReturnsRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  dailyOrders: number[];
  dailyReturns: number[];
  dailyBranchOrders: { [branch: string]: number }[];
  dailyBranchReturns: { [branch: string]: number }[];
  totalOrders: number;
  totalReturns: number;
  totalRatio: number;
}

export const OrdersVsReturnsTable = ({
  data,
  title,
  month,
  isRtl,
  loading,
  allBranches,
  daysInMonth,
  months,
  selectedBranches,
  selectedDayIndices,
}: {
  data: OrdersVsReturnsRow[];
  title: string;
  month: number;
  isRtl: boolean;
  loading: boolean;
  allBranches: string[];
  daysInMonth: string[];
  months: { value: number; label: string }[];
  selectedBranches: string[];
  selectedDayIndices: number[];
}) => {
  const [search, setSearch] = useState('');
  const sortedDayIndices = [...selectedDayIndices].sort((a, b) => a - b);
  const filteredData = useMemo(() => {
    return data
      .filter(row => row.product.toLowerCase().includes(search.toLowerCase()))
      .map(row => {
        const filteredDailyOrders = sortedDayIndices.map(i => {
          if (selectedBranches.length === 0) return row.dailyOrders[i];
          return selectedBranches.reduce((sum, b) => sum + (row.dailyBranchOrders[i][b] || 0), 0);
        });
        const filteredDailyReturns = sortedDayIndices.map(i => {
          if (selectedBranches.length === 0) return row.dailyReturns[i];
          return selectedBranches.reduce((sum, b) => sum + (row.dailyBranchReturns[i][b] || 0), 0);
        });
        const filteredTotalOrders = filteredDailyOrders.reduce((a, b) => a + b, 0);
        const filteredTotalReturns = filteredDailyReturns.reduce((a, b) => a + b, 0);
        const filteredTotalRatio = filteredTotalOrders > 0 ? (filteredTotalReturns / filteredTotalOrders * 100) : 0;
        const filteredDailyBranchOrders = sortedDayIndices.map(i => {
          if (selectedBranches.length === 0) return row.dailyBranchOrders[i];
          return Object.fromEntries(selectedBranches.map(b => [b, row.dailyBranchOrders[i][b] || 0]));
        });
        const filteredDailyBranchReturns = sortedDayIndices.map(i => {
          if (selectedBranches.length === 0) return row.dailyBranchReturns[i];
          return Object.fromEntries(selectedBranches.map(b => [b, row.dailyBranchReturns[i][b] || 0]));
        });
        return {
          ...row,
          dailyOrders: filteredDailyOrders,
          dailyReturns: filteredDailyReturns,
          dailyBranchOrders: filteredDailyBranchOrders,
          dailyBranchReturns: filteredDailyBranchReturns,
          totalOrders: filteredTotalOrders,
          totalReturns: filteredTotalReturns,
          totalRatio: filteredTotalRatio,
        };
      });
  }, [data, search, selectedBranches, sortedDayIndices, isRtl]);

  const grandTotalOrders = filteredData.reduce((sum, row) => sum + row.totalOrders, 0);
  const grandTotalReturns = filteredData.reduce((sum, row) => sum + row.totalReturns, 0);
  const grandTotalRatio = grandTotalOrders > 0 ? (grandTotalReturns / grandTotalOrders * 100).toFixed(2) : '0.00';

  const monthName = months[month].label;

  const exportTable = (format: 'excel' | 'pdf') => {
    const baseHeaders = [
      isRtl ? 'رقم' : 'No.',
      isRtl ? 'الكود' : 'Code',
      isRtl ? 'المنتج' : 'Product',
      isRtl ? 'وحدة المنتج' : 'Product Unit',
    ];
    const dayHeaders = sortedDayIndices.flatMap(i => {
      const day = daysInMonth[i];
      return [
        isRtl ? `${day} - طلبات` : `${day} - Orders`,
        isRtl ? `${day} - مرتجعات` : `${day} - Returns`,
        isRtl ? `${day} - نسبة %` : `${day} - Ratio %`,
      ];
    });
    const totalHeaders = [
      isRtl ? 'إجمالي الطلبات' : 'Total Orders',
      isRtl ? 'إجمالي المرتجعات' : 'Total Returns',
      isRtl ? 'نسبة إجمالية %' : 'Total Ratio %',
    ];
    const headers = [...baseHeaders, ...dayHeaders, ...totalHeaders];
    const rows = [
      ...filteredData.map((row, index) => ({
        no: index + 1,
        code: row.code,
        product: row.product,
        unit: row.unit,
        ...Object.fromEntries(
          sortedDayIndices.flatMap((i, j) => {
            const day = daysInMonth[i];
            const orders = row.dailyOrders[j];
            const returns = row.dailyReturns[j];
            const ratio = orders > 0 ? ((returns / orders) * 100).toFixed(2) : '0.00';
            return [
              [`${day} - ${isRtl ? 'طلبات' : 'Orders'}`, orders],
              [`${day} - ${isRtl ? 'مرتجعات' : 'Returns'}`, returns],
              [`${day} - ${isRtl ? 'نسبة %' : 'Ratio %'}`, ratio],
            ];
          })
        ),
        totalOrders: row.totalOrders,
        totalReturns: row.totalReturns,
        totalRatio: row.totalRatio.toFixed(2),
      })),
      {
        no: '',
        code: '',
        product: isRtl ? 'الإجمالي' : 'Total',
        unit: '',
        ...Object.fromEntries(
          sortedDayIndices.flatMap((i, j) => {
            const day = daysInMonth[i];
            const orders = filteredData.reduce((sum, row) => sum + row.dailyOrders[j], 0);
            const returns = filteredData.reduce((sum, row) => sum + row.dailyReturns[j], 0);
            const ratio = orders > 0 ? ((returns / orders) * 100).toFixed(2) : '0.00';
            return [
              [`${day} - ${isRtl ? 'طلبات' : 'Orders'}`, orders],
              [`${day} - ${isRtl ? 'مرتجعات' : 'Returns'}`, returns],
              [`${day} - ${isRtl ? 'نسبة %' : 'Ratio %'}`, ratio],
            ];
          })
        ),
        totalOrders: grandTotalOrders,
        totalReturns: grandTotalReturns,
        totalRatio: grandTotalRatio,
      },
    ];
    const dataRows = rows.map(row => [
      row.no,
      row.code,
      row.product,
      row.unit,
      ...dayHeaders.map(header => row[header]),
      row.totalOrders,
      row.totalReturns,
      `${row.totalRatio}%`,
    ]);
    if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows, { header: headers });
      if (isRtl) ws['!views'] = [{ RTL: true }];
      ws['!cols'] = [{ wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, ...dayHeaders.map(() => ({ wch: 12 })), { wch: 15 }, { wch: 15 }, { wch: 15 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `${title}_${monthName}`);
      XLSX.writeFile(wb, `${title}_${monthName}.xlsx`);
      toast.success(isRtl ? 'تم تصدير ملف Excel بنجاح' : 'Excel exported successfully', {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    } else if (format === 'pdf') {
      exportToPDF(dataRows, title, monthName, headers, isRtl, filteredData.length, grandTotalOrders, grandTotalReturns, []);
    }
  };

  const getTooltipContent = (dailyQuantity: number, branchDetails: { [branch: string]: number }, isRtl: boolean, type: 'in' | 'out' | 'return' | 'sales' | 'orders') => {
    let header = '';
    if (type === 'in') header = isRtl ? 'زيادة مخزون' : 'Stock In';
    if (type === 'out') header = isRtl ? 'نقص مخزون' : 'Stock Out';
    if (type === 'return') header = isRtl ? 'مرتجع' : 'Return';
    if (type === 'sales') header = isRtl ? 'مبيعات' : 'Sales';
    if (type === 'orders') header = isRtl ? 'طلبات' : 'Orders';
    let content = `${header}: ${dailyQuantity > 0 ? '+' : ''}${formatNumber(dailyQuantity, isRtl)}`;
    if (Object.keys(branchDetails).length > 0) {
      content += '\n' + Object.entries(branchDetails).map(([branch, qty]) => `${branch}: ${qty > 0 ? '+' : ''}${formatNumber(qty, isRtl)}`).join('\n');
    }
    return content;
  };

  if (loading) return <OrderTableSkeleton isRtl={isRtl} />;

  if (data.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="text-center py-12 bg-white shadow-md rounded-xl border border-gray-200"
      >
        <p className="text-gray-500 text-sm font-medium">{isRtl ? 'لا توجد بيانات' : 'No data available'}</p>
      </motion.div>
    );
  }

  return (
    <div className="mb-8">
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
        <h2 className="text-lg font-semibold text-gray-800">{isRtl ? `${title} - ${monthName}` : `${title} - ${monthName}`}</h2>
        <input
          type="text"
          placeholder={isRtl ? 'بحث بالمنتج...' : 'Search by product...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 text-sm text-gray-700 ${isRtl ? 'text-right' : 'text-left'}`}
        />
        <div className="flex gap-2">
          <Button
            variant={filteredData.length > 0 ? 'primary' : 'secondary'}
            onClick={filteredData.length > 0 ? () => exportTable('excel') : undefined}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 ${filteredData.length > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
            disabled={filteredData.length === 0}
          >
            <Upload className="w-4 h-4" />
            {isRtl ? 'تصدير إكسل' : 'Export Excel'}
          </Button>
          <Button
            variant={filteredData.length > 0 ? 'primary' : 'secondary'}
            onClick={filteredData.length > 0 ? () => exportTable('pdf') : undefined}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 ${filteredData.length > 0 ? 'bg-green-600 hover:bg-green-700 text-white shadow-sm' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
            disabled={filteredData.length === 0}
          >
            <Upload className="w-4 h-4" />
            {isRtl ? 'تصدير PDF' : 'Export PDF'}
          </Button>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-x-auto rounded-xl shadow-md border border-gray-200 bg-white"
      >
        <table className="min-w-full divide-y divide-gray-200 text-xs">
          <thead className="bg-blue-50 sticky top-0">
            <tr className={isRtl ? 'flex-row-reverse' : ''}>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[40px]">{isRtl ? 'رقم' : 'No.'}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'الكود' : 'Code'}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[120px]">{isRtl ? 'المنتج' : 'Product'}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'وحدة المنتج' : 'Product Unit'}</th>
              {sortedDayIndices.map((i, j) => (
                <Fragment key={j}>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">
                    {isRtl ? `${daysInMonth[i]} - طلبات` : `${daysInMonth[i]} - Orders`}
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">
                    {isRtl ? `${daysInMonth[i]} - مرتجعات` : `${daysInMonth[i]} - Returns`}
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">
                    {isRtl ? `${daysInMonth[i]} - نسبة %` : `${daysInMonth[i]} - Ratio %`}
                  </th>
                </Fragment>
              ))}
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                {isRtl ? 'إجمالي الطلبات' : 'Total Orders'}
              </th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                {isRtl ? 'إجمالي المرتجعات' : 'Total Returns'}
              </th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                {isRtl ? 'نسبة إجمالية %' : 'Total Ratio %'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredData.map((row, index) => (
              <tr key={row.id} className={`hover:bg-blue-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <td className="px-4 py-3 text-gray-700 text-center">{formatNumber(index + 1, isRtl)}</td>
                <td className="px-4 py-3 text-gray-700 text-center truncate">{row.code}</td>
                <td className="px-4 py-3 text-gray-700 text-center truncate">{row.product}</td>
                <td className="px-4 py-3 text-gray-700 text-center truncate">{row.unit}</td>
                {sortedDayIndices.map((i, j) => (
                  <Fragment key={j}>
                    <td
                      className={`px-4 py-3 text-center font-medium ${row.dailyOrders[j] !== 0 ? 'bg-green-50 text-green-700' : 'text-gray-700'}`}
                      data-tooltip-id="orders-tooltip"
                      data-tooltip-content={getTooltipContent(row.dailyOrders[j], row.dailyBranchOrders[j], isRtl, 'orders')}
                    >
                      {row.dailyOrders[j] !== 0 ? formatNumber(row.dailyOrders[j], isRtl) : '0'}
                    </td>
                    <td
                      className={`px-4 py-3 text-center font-medium ${row.dailyReturns[j] !== 0 ? 'bg-red-50 text-red-700' : 'text-gray-700'}`}
                      data-tooltip-id="returns-tooltip"
                      data-tooltip-content={getTooltipContent(row.dailyReturns[j], row.dailyBranchReturns[j], isRtl, 'return')}
                    >
                      {row.dailyReturns[j] !== 0 ? formatNumber(row.dailyReturns[j], isRtl) : '0'}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-blue-700">
                      {row.dailyOrders[j] > 0 ? formatNumber((row.dailyReturns[j] / row.dailyOrders[j] * 100).toFixed(2), isRtl) + '%' : '0.00%'}
                    </td>
                  </Fragment>
                ))}
                <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalOrders, isRtl)}</td>
                <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalReturns, isRtl)}</td>
                <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalRatio.toFixed(2), isRtl)}%</td>
              </tr>
            ))}
            <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <td className="px-4 py-3 text-gray-800 text-center" colSpan={4}>{isRtl ? 'الإجمالي' : 'Total'}</td>
              {sortedDayIndices.map((i, j) => (
                <Fragment key={j}>
                  <td className="px-4 py-3 text-gray-800 text-center">
                    {formatNumber(filteredData.reduce((sum, row) => sum + row.dailyOrders[j], 0), isRtl)}
                  </td>
                  <td className="px-4 py-3 text-gray-800 text-center">
                    {formatNumber(filteredData.reduce((sum, row) => sum + row.dailyReturns[j], 0), isRtl)}
                  </td>
                  <td className="px-4 py-3 text-gray-800 text-center">
                    {(() => {
                      const dailyOrdersTotal = filteredData.reduce((sum, row) => sum + row.dailyOrders[j], 0);
                      const dailyReturnsTotal = filteredData.reduce((sum, row) => sum + row.dailyReturns[j], 0);
                      const ratio = dailyOrdersTotal > 0 ? ((dailyReturnsTotal / dailyOrdersTotal) * 100).toFixed(2) : '0.00';
                      return `${formatNumber(ratio, isRtl)}%`;
                    })()}
                  </td>
                </Fragment>
              ))}
              <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalOrders, isRtl)}</td>
              <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalReturns, isRtl)}</td>
              <td className="px-4 py-3 text-gray-800 text-center">{grandTotalRatio}%</td>
            </tr>
          </tbody>
        </table>
        <Tooltip id="orders-tooltip" place="top" className="custom-tooltip" />
        <Tooltip id="returns-tooltip" place="top" className="custom-tooltip" />
      </motion.div>
    </div>
  );
};