import React, { Fragment } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/UI/Button';
import { Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';
import { Tooltip } from 'react-tooltip';
import { exportToPDF, formatNumber } from './ProductionReport'; // استيراد الدوال المشتركة

interface DailyOrdersMovementTableProps {
  data: OrdersVsReturnsRow[];
  title: string;
  month: number;
  isRtl: boolean;
  loading: boolean;
  daysInMonth: string[];
  months: { value: number; label: string }[];
  formatNumber: (num: number, isRtl: boolean) => string;
}

const DailyOrdersMovementTable: React.FC<DailyOrdersMovementTableProps> = ({ data, title, month, isRtl, loading, daysInMonth, months, formatNumber }) => {
  const grandTotalOrders = data.reduce((sum, row) => sum + row.totalOrders, 0);
  const grandTotalReturns = data.reduce((sum, row) => sum + row.totalReturns, 0);
  const grandTotalRatio = grandTotalOrders > 0 ? (grandTotalReturns / grandTotalOrders * 100).toFixed(2) : '0.00';
  const monthName = months[month].label;

  const getTooltipContent = (dailyQuantity: number, isRtl: boolean, type: 'orders' | 'return') => {
    return `${type === 'orders' ? (isRtl ? 'طلبات' : 'Orders') : (isRtl ? 'مرتجع' : 'Return')}: ${formatNumber(dailyQuantity, isRtl)}`;
  };

  const exportTable = (format: 'excel' | 'pdf') => {
    const baseHeaders = [
      isRtl ? 'رقم' : 'No.',
      isRtl ? 'الكود' : 'Code',
      isRtl ? 'المنتج' : 'Product',
      isRtl ? 'وحدة المنتج' : 'Product Unit',
    ];
    const dayHeaders = daysInMonth.flatMap(day => [
      isRtl ? `${day} - طلبات` : `${day} - Orders`,
      isRtl ? `${day} - مرتجعات` : `${day} - Returns`,
      isRtl ? `${day} - نسبة %` : `${day} - Ratio %`,
    ]);
    const totalHeaders = [
      isRtl ? 'إجمالي الطلبات' : 'Total Orders',
      isRtl ? 'إجمالي المرتجعات' : 'Total Returns',
      isRtl ? 'نسبة إجمالية %' : 'Total Ratio %',
    ];
    const headers = [...baseHeaders, ...dayHeaders, ...totalHeaders];

    const rows = [
      ...data.map((row, index) => ({
        no: index + 1,
        code: row.code,
        product: row.product,
        unit: row.unit,
        ...Object.fromEntries(
          daysInMonth.flatMap((day, i) => [
            [`${day} - ${isRtl ? 'طلبات' : 'Orders'}`, row.dailyOrders[i]],
            [`${day} - ${isRtl ? 'مرتجعات' : 'Returns'}`, row.dailyReturns[i]],
            [`${day} - ${isRtl ? 'نسبة %' : 'Ratio %'}`, row.dailyOrders[i] > 0 ? ((row.dailyReturns[i] / row.dailyOrders[i]) * 100).toFixed(2) : '0.00'],
          ])
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
          daysInMonth.flatMap((day, i) => [
            [`${day} - ${isRtl ? 'طلبات' : 'Orders'}`, data.reduce((sum, row) => sum + row.dailyOrders[i], 0)],
            [`${day} - ${isRtl ? 'مرتجعات' : 'Returns'}`, data.reduce((sum, row) => sum + row.dailyReturns[i], 0)],
            [`${day} - ${isRtl ? 'نسبة %' : 'Ratio %'}`, (data.reduce((sum, row) => sum + row.dailyOrders[i], 0) > 0) ? ((data.reduce((sum, row) => sum + row.dailyReturns[i], 0) / data.reduce((sum, row) => sum + row.dailyOrders[i], 0)) * 100).toFixed(2) : '0.00'],
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
      exportToPDF(dataRows, title, monthName, headers, isRtl, data.length, grandTotalOrders, 0, []); // totalPrice = 0 لأنه ليس مطلوب هنا
    }
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
        <div className="flex gap-2">
          <Button
            variant={data.length > 0 ? 'primary' : 'secondary'}
            onClick={data.length > 0 ? () => exportTable('excel') : undefined}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 ${
              data.length > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
            disabled={data.length === 0}
          >
            <Upload className="w-4 h-4" />
            {isRtl ? 'تصدير إكسل' : 'Export Excel'}
          </Button>
          <Button
            variant={data.length > 0 ? 'primary' : 'secondary'}
            onClick={data.length > 0 ? () => exportTable('pdf') : undefined}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 ${
              data.length > 0 ? 'bg-green-600 hover:bg-green-700 text-white shadow-sm' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
            disabled={data.length === 0}
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
              {daysInMonth.map((day, i) => (
                <Fragment key={i}>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">
                    {isRtl ? `${day} - طلبات` : `${day} - Orders`}
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">
                    {isRtl ? `${day} - مرتجعات` : `${day} - Returns`}
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">
                    {isRtl ? `${day} - نسبة %` : `${day} - Ratio %`}
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
            {data.map((row, index) => (
              <tr key={row.id} className={`hover:bg-blue-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <td className="px-4 py-3 text-gray-700 text-center">{formatNumber(index + 1, isRtl)}</td>
                <td className="px-4 py-3 text-gray-700 text-center truncate">{row.code}</td>
                <td className="px-4 py-3 text-gray-700 text-center truncate">{row.product}</td>
                <td className="px-4 py-3 text-gray-700 text-center truncate">{row.unit}</td>
                {daysInMonth.map((day, i) => (
                  <Fragment key={i}>
                    <td
                      className={`px-4 py-3 text-center font-medium ${
                        row.dailyOrders[i] !== 0 ? 'bg-green-50 text-green-700' : 'text-gray-700'
                      }`}
                      data-tooltip-id="orders-tooltip"
                      data-tooltip-content={getTooltipContent(row.dailyOrders[i], isRtl, 'orders')}
                    >
                      {row.dailyOrders[i] !== 0 ? formatNumber(row.dailyOrders[i], isRtl) : '0'}
                    </td>
                    <td
                      className={`px-4 py-3 text-center font-medium ${
                        row.dailyReturns[i] !== 0 ? 'bg-red-50 text-red-700' : 'text-gray-700'
                      }`}
                      data-tooltip-id="returns-tooltip"
                      data-tooltip-content={getTooltipContent(row.dailyReturns[i], isRtl, 'return')}
                    >
                      {row.dailyReturns[i] !== 0 ? formatNumber(row.dailyReturns[i], isRtl) : '0'}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-blue-700">
                      {row.dailyOrders[i] > 0 ? formatNumber((row.dailyReturns[i] / row.dailyOrders[i] * 100).toFixed(2), isRtl) + '%' : '0.00%'}
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
              {daysInMonth.map((_, i) => (
                <Fragment key={i}>
                  <td className="px-4 py-3 text-gray-800 text-center">
                    {formatNumber(data.reduce((sum, row) => sum + row.dailyOrders[i], 0), isRtl)}
                  </td>
                  <td className="px-4 py-3 text-gray-800 text-center">
                    {formatNumber(data.reduce((sum, row) => sum + row.dailyReturns[i], 0), isRtl)}
                  </td>
                  <td className="px-4 py-3 text-gray-800 text-center">
                    {(() => {
                      const dailyOrdersTotal = data.reduce((sum, row) => sum + row.dailyOrders[i], 0);
                      const dailyReturnsTotal = data.reduce((sum, row) => sum + row.dailyReturns[i], 0);
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
        <Tooltip id="orders-tooltip" place="top" effect="solid" className="custom-tooltip" />
        <Tooltip id="returns-tooltip" place="top" effect="solid" className="custom-tooltip" />
      </motion.div>
    </div>
  );
};

export default DailyOrdersMovementTable;