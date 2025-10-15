// OrdersVsReturnsTable.tsx
import React, { useState, useMemo, Fragment } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/UI/Button';
import { Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';
import { Tooltip } from 'react-tooltip';

interface OrdersVsReturnsRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  dailyOrders: number[];
  dailyReturns: number[];
  totalOrders: number;
  totalReturns: number;
  totalRatio: number;
}

interface Props {
  data: OrdersVsReturnsRow[];
  title: string;
  month: number;
  isRtl: boolean;
  loading: boolean;
  daysInMonth: string[];
  months: { value: number; label: string }[];
  allBranches: string[];
  formatNumber: (num: number, isRtl: boolean) => string;
  toArabicNumerals: (number: string | number) => string;
  exportToPDF: (
    data: any[],
    title: string,
    monthName: string,
    headers: string[],
    isRtl: boolean,
    totalItems: number,
    totalQuantity: number,
    totalPrice: number,
    allBranches: string[]
  ) => Promise<void>;
  getTooltipContent: (dailyQuantity: number, branchDetails: { [branch: string]: number }, isRtl: boolean, type: 'in' | 'out' | 'return' | 'sales' | 'orders') => string;
}

const OrdersVsReturnsTable: React.FC<Props> = ({
  data,
  title,
  month,
  isRtl,
  loading,
  daysInMonth,
  months,
  allBranches,
  formatNumber,
  toArabicNumerals,
  exportToPDF,
  getTooltipContent,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]); // Note: For orders vs returns, branch details not in row, so perhaps not implement or assume no branch filter for this table

  const periods = useMemo(() => {
    const periodsList = [{ value: 'all', label: isRtl ? 'الكل' : 'All' }];
    let week = 1;
    const daysCount = daysInMonth.length;
    for (let d = 1; d <= daysCount; d += 7) {
      const start = d;
      const end = Math.min(d + 6, daysCount);
      periodsList.push({
        value: `week${week}`,
        label: isRtl ? `الأسبوع ${toArabicNumerals(week)} (${toArabicNumerals(start)}-${toArabicNumerals(end)})` : `Week ${week} (${start}-${end})`,
      });
      week++;
    }
    return periodsList;
  }, [daysInMonth, isRtl, toArabicNumerals]);

  const filteredDayIndices = useMemo(() => {
    if (selectedPeriod === 'all') return Array.from({ length: daysInMonth.length }, (_, i) => i);
    const weekNum = parseInt(selectedPeriod.replace('week', ''));
    const start = (weekNum - 1) * 7;
    const end = Math.min(start + 6, daysInMonth.length - 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [selectedPeriod, daysInMonth]);

  const filteredData = useMemo(() => {
    return data.filter(row =>
      row.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  const grandTotalOrders = filteredData.reduce((sum, row) => sum + filteredDayIndices.reduce((s, i) => s + row.dailyOrders[i], 0), 0);
  const grandTotalReturns = filteredData.reduce((sum, row) => sum + filteredDayIndices.reduce((s, i) => s + row.dailyReturns[i], 0), 0);
  const grandTotalRatio = grandTotalOrders > 0 ? (grandTotalReturns / grandTotalOrders * 100).toFixed(2) : '0.00';
  const monthName = months[month].label;

  const exportTable = (format: 'excel' | 'pdf') => {
    const baseHeaders = [
      isRtl ? 'رقم' : 'No.',
      isRtl ? 'الكود' : 'Code',
      isRtl ? 'المنتج' : 'Product',
      isRtl ? 'وحدة المنتج' : 'Product Unit',
    ];
    const dayHeaders = filteredDayIndices.flatMap(idx => [
      isRtl ? `${daysInMonth[idx]} - طلبات` : `${daysInMonth[idx]} - Orders`,
      isRtl ? `${daysInMonth[idx]} - مرتجعات` : `${daysInMonth[idx]} - Returns`,
      isRtl ? `${daysInMonth[idx]} - نسبة %` : `${daysInMonth[idx]} - Ratio %`,
    ]);
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
          filteredDayIndices.flatMap((idx) => [
            [`${daysInMonth[idx]} - ${isRtl ? 'طلبات' : 'Orders'}`, row.dailyOrders[idx]],
            [`${daysInMonth[idx]} - ${isRtl ? 'مرتجعات' : 'Returns'}`, row.dailyReturns[idx]],
            [`${daysInMonth[idx]} - ${isRtl ? 'نسبة %' : 'Ratio %'}`, row.dailyOrders[idx] > 0 ? ((row.dailyReturns[idx] / row.dailyOrders[idx]) * 100).toFixed(2) : '0.00'],
          ])
        ),
        totalOrders: filteredDayIndices.reduce((s, i) => s + row.dailyOrders[i], 0),
        totalReturns: filteredDayIndices.reduce((s, i) => s + row.dailyReturns[i], 0),
        totalRatio: row.totalRatio.toFixed(2),
      })),
      {
        no: '',
        code: '',
        product: isRtl ? 'الإجمالي' : 'Total',
        unit: '',
        ...Object.fromEntries(
          filteredDayIndices.flatMap((idx) => [
            [`${daysInMonth[idx]} - ${isRtl ? 'طلبات' : 'Orders'}`, filteredData.reduce((sum, row) => sum + row.dailyOrders[idx], 0)],
            [`${daysInMonth[idx]} - ${isRtl ? 'مرتجعات' : 'Returns'}`, filteredData.reduce((sum, row) => sum + row.dailyReturns[idx], 0)],
            [`${daysInMonth[idx]} - ${isRtl ? 'نسبة %' : 'Ratio %'}`, (filteredData.reduce((sum, row) => sum + row.dailyOrders[idx], 0) > 0) ? ((filteredData.reduce((sum, row) => sum + row.dailyReturns[idx], 0) / filteredData.reduce((sum, row) => sum + row.dailyOrders[idx], 0)) * 100).toFixed(2) : '0.00'],
          ])
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

  if (loading) return <OrderTableSkeleton isRtl={isRtl} />;

  if (filteredData.length === 0) {
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
          placeholder={isRtl ? 'بحث حسب المنتج أو الكود' : 'Search by product or code'}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="px-4 py-2 border rounded-md"
        />
        <select
          value={selectedPeriod}
          onChange={e => setSelectedPeriod(e.target.value)}
          className="px-4 py-2 border rounded-md"
        >
          {periods.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <select
          multiple
          value={selectedBranches}
          onChange={e => setSelectedBranches(Array.from(e.target.selectedOptions, option => option.value))}
          className="px-4 py-2 border rounded-md"
        >
          {allBranches.map(branch => (
            <option key={branch} value={branch}>{branch}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <Button
            variant={filteredData.length > 0 ? 'primary' : 'secondary'}
            onClick={filteredData.length > 0 ? () => exportTable('excel') : undefined}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 ${
              filteredData.length > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
            disabled={filteredData.length === 0}
          >
            <Upload className="w-4 h-4" />
            {isRtl ? 'تصدير إكسل' : 'Export Excel'}
          </Button>
          <Button
            variant={filteredData.length > 0 ? 'primary' : 'secondary'}
            onClick={filteredData.length > 0 ? () => exportTable('pdf') : undefined}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 ${
              filteredData.length > 0 ? 'bg-green-600 hover:bg-green-700 text-white shadow-sm' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
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
              {filteredDayIndices.map((idx) => (
                <Fragment key={idx}>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">
                    {isRtl ? `${daysInMonth[idx]} - طلبات` : `${daysInMonth[idx]} - Orders`}
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">
                    {isRtl ? `${daysInMonth[idx]} - مرتجعات` : `${daysInMonth[idx]} - Returns`}
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">
                    {isRtl ? `${daysInMonth[idx]} - نسبة %` : `${daysInMonth[idx]} - Ratio %`}
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
                {filteredDayIndices.map((idx) => (
                  <Fragment key={idx}>
                    <td
                      className={`px-4 py-3 text-center font-medium ${
                        row.dailyOrders[idx] !== 0 ? 'bg-green-50 text-green-700' : 'text-gray-700'
                      }`}
                      data-tooltip-id="orders-tooltip"
                      data-tooltip-content={getTooltipContent(row.dailyOrders[idx], {}, isRtl, 'orders')}
                    >
                      {row.dailyOrders[idx] !== 0 ? formatNumber(row.dailyOrders[idx], isRtl) : '0'}
                    </td>
                    <td
                      className={`px-4 py-3 text-center font-medium ${
                        row.dailyReturns[idx] !== 0 ? 'bg-red-50 text-red-700' : 'text-gray-700'
                      }`}
                      data-tooltip-id="returns-tooltip"
                      data-tooltip-content={getTooltipContent(row.dailyReturns[idx], {}, isRtl, 'return')}
                    >
                      {row.dailyReturns[idx] !== 0 ? formatNumber(row.dailyReturns[idx], isRtl) : '0'}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-blue-700">
                      {row.dailyOrders[idx] > 0 ? formatNumber((row.dailyReturns[idx] / row.dailyOrders[idx] * 100).toFixed(2), isRtl) + '%' : '0.00%'}
                    </td>
                  </Fragment>
                ))}
                <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(filteredDayIndices.reduce((s, i) => s + row.dailyOrders[i], 0), isRtl)}</td>
                <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(filteredDayIndices.reduce((s, i) => s + row.dailyReturns[i], 0), isRtl)}</td>
                <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalRatio.toFixed(2), isRtl)}%</td>
              </tr>
            ))}
            <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <td className="px-4 py-3 text-gray-800 text-center" colSpan={4}>{isRtl ? 'الإجمالي' : 'Total'}</td>
              {filteredDayIndices.map((idx) => (
                <Fragment key={idx}>
                  <td className="px-4 py-3 text-gray-800 text-center">
                    {formatNumber(filteredData.reduce((sum, row) => sum + row.dailyOrders[idx], 0), isRtl)}
                  </td>
                  <td className="px-4 py-3 text-gray-800 text-center">
                    {formatNumber(filteredData.reduce((sum, row) => sum + row.dailyReturns[idx], 0), isRtl)}
                  </td>
                  <td className="px-4 py-3 text-gray-800 text-center">
                    {(() => {
                      const dailyReturnsTotal = filteredData.reduce((sum, row) => sum + row.dailyReturns[idx], 0);
                      const dailyOrdersTotal = filteredData.reduce((sum, row) => sum + row.dailyOrders[idx], 0);
                      const ratio = dailyOrdersTotal > 0 ? (dailyReturnsTotal / dailyOrdersTotal * 100).toFixed(2) : '0.00';
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
        <Tooltip id="orders-tooltip" place="top" />
        <Tooltip id="returns-tooltip" place="top" />
      </motion.div>
    </div>
  );
};

export default OrdersVsReturnsTable;