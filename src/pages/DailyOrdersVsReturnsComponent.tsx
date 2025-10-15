import React, { useState, useMemo, Fragment } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/UI/Button';
import { Upload } from 'lucide-react';
import { Tooltip } from 'react-tooltip';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';

interface OrdersVsReturnsRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  dailyOrders: number[];
  dailyReturns: number[];
  dailyOrdersDetails: { [branch: string]: number }[];
  dailyReturnsDetails: { [branch: string]: number }[];
  totalOrders: number;
  totalReturns: number;
  totalRatio: number;
}

interface DailyOrdersVsReturnsProps {
  data: OrdersVsReturnsRow[];
  title: string;
  month: number;
  isRtl: boolean;
  loading: boolean;
  months: { value: number; label: string }[];
  daysInMonth: string[];
  allBranches: string[];
  onExportExcel: () => void;
  onExportPDF: () => void;
}

const toArabicNumerals = (number: string | number): string => {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(number).replace(/[0-9]/g, (digit) => arabicNumerals[parseInt(digit)]);
};

const formatNumber = (num: number, isRtl: boolean): string => {
  return isRtl ? toArabicNumerals(num) : num.toString();
};

const getTooltipContent = (quantity: number, details: { [branch: string]: number }, isRtl: boolean, type: 'orders' | 'returns') => {
  const title = isRtl ? (type === 'orders' ? 'الطلبات' : 'المرتجعات') : type === 'orders' ? 'Orders' : 'Returns';
  let content = `${title}: ${formatNumber(quantity, isRtl)}`;
  if (Object.keys(details).length > 0) {
    content += '\n' + Object.entries(details)
      .map(([branch, qty]) => `${branch}: ${formatNumber(qty, isRtl)}`)
      .join('\n');
  }
  return content;
};

const DailyOrdersVsReturnsComponent: React.FC<DailyOrdersVsReturnsProps> = ({
  data,
  title,
  month,
  isRtl,
  loading,
  months,
  daysInMonth,
  allBranches,
  onExportExcel,
  onExportPDF,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const monthName = months[month].label;

  const filteredData = useMemo(() => {
    return data.filter(row => row.product.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [data, searchTerm]);

  const grandTotalOrders = filteredData.reduce((sum, row) => sum + row.totalOrders, 0);
  const grandTotalReturns = filteredData.reduce((sum, row) => sum + row.totalReturns, 0);
  const grandTotalRatio = grandTotalOrders > 0 ? (grandTotalReturns / grandTotalOrders * 100).toFixed(2) : '0.00';

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
          placeholder={isRtl ? 'ابحث حسب المنتج' : 'Search by product'}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-full text-sm"
        />
        <div className="flex gap-2">
          <Button
            variant={filteredData.length > 0 ? 'primary' : 'secondary'}
            onClick={filteredData.length > 0 ? onExportExcel : undefined}
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
            onClick={filteredData.length > 0 ? onExportPDF : undefined}
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
            {filteredData.map((row, index) => (
              <tr key={row.id} className={`hover:bg-blue-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <td className="px-4 py-3 text-gray-700 text-center">{formatNumber(index + 1, isRtl)}</td>
                <td className="px-4 py-3 text-gray-700 text-center truncate">{row.code}</td>
                <td className="px-4 py-3 text-gray-700 text-center truncate">{row.product}</td>
                <td className="px-4 py-3 text-gray-700 text-center truncate">{row.unit}</td>
                {daysInMonth.map((_, i) => (
                  <Fragment key={i}>
                    <td
                      className={`px-4 py-3 text-center font-medium ${
                        row.dailyOrders[i] !== 0 ? 'bg-green-50 text-green-700' : 'text-gray-700'
                      }`}
                      data-tooltip-id="orders-tooltip"
                      data-tooltip-content={getTooltipContent(row.dailyOrders[i], row.dailyOrdersDetails[i], isRtl, 'orders')}
                    >
                      {row.dailyOrders[i] !== 0 ? formatNumber(row.dailyOrders[i], isRtl) : '0'}
                    </td>
                    <td
                      className={`px-4 py-3 text-center font-medium ${
                        row.dailyReturns[i] !== 0 ? 'bg-red-50 text-red-700' : 'text-gray-700'
                      }`}
                      data-tooltip-id="returns-tooltip"
                      data-tooltip-content={getTooltipContent(row.dailyReturns[i], row.dailyReturnsDetails[i], isRtl, 'returns')}
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
                    {formatNumber(filteredData.reduce((sum, row) => sum + row.dailyOrders[i], 0), isRtl)}
                  </td>
                  <td className="px-4 py-3 text-gray-800 text-center">
                    {formatNumber(filteredData.reduce((sum, row) => sum + row.dailyReturns[i], 0), isRtl)}
                  </td>
                  <td className="px-4 py-3 text-gray-800 text-center">
                    {(() => {
                      const dailyOrdersTotal = filteredData.reduce((sum, row) => sum + row.dailyOrders[i], 0);
                      const dailyReturnsTotal = filteredData.reduce((sum, row) => sum + row.dailyReturns[i], 0);
                      const ratio = dailyOrdersTotal > 0 ? (dailyReturnsTotal / dailyOrdersTotal * 100).toFixed(2) : '0.00';
                      return `${formatNumber(ratio, isRtl)}%`;
                    })()}
                  </td>
                </Fragment>
              ))}
              <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalOrders, isRtl)}</td>
              <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalReturns, isRtl)}</td>
              <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalRatio, isRtl)}%</td>
            </tr>
          </tbody>
        </table>
        <Tooltip id="orders-tooltip" place="top" effect="solid" className="custom-tooltip" />
        <Tooltip id="returns-tooltip" place="top" effect="solid" className="custom-tooltip" />
      </motion.div>
    </div>
  );
};

export default DailyOrdersVsReturnsComponent;