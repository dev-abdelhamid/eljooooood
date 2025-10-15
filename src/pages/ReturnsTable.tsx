// ReturnsTable.tsx
import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/UI/Button';
import { Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';
import { Tooltip } from 'react-tooltip';

interface ReturnRow {
  id: string;
  product: string;
  code: string;
  unit: string;
  totalReturns: number;
  dailyReturns: number[];
  dailyBranchDetails: { [branch: string]: number }[];
  totalValue: number;
  totalOrders?: number;
}

interface Props {
  data: ReturnRow[];
  title: string;
  month: number;
  isRtl: boolean;
  loading: boolean;
  daysInMonth: string[];
  months: { value: number; label: string }[];
  allBranches: string[];
  formatPrice: (amount: number, isRtl: boolean, isStats?: boolean) => string;
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

const ReturnsTable: React.FC<Props> = ({
  data,
  title,
  month,
  isRtl,
  loading,
  daysInMonth,
  months,
  allBranches,
  formatPrice,
  formatNumber,
  toArabicNumerals,
  exportToPDF,
  getTooltipContent,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [selectedBranches, setSelectedBranches] = useState<string[]>(allBranches);

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

  const getDailyReturn = (row: ReturnRow, i: number) => {
    if (selectedBranches.length === 0) return row.dailyReturns[i];
    return selectedBranches.reduce((sum, b) => sum + (row.dailyBranchDetails[i][b] || 0), 0);
  };

  const grandTotalReturns = filteredData.reduce((sum, row) => sum + filteredDayIndices.reduce((s, i) => s + getDailyReturn(row, i), 0), 0);
  const grandTotalValue = filteredData.reduce((sum, row) => sum + row.totalValue, 0);
  const grandTotalOrders = filteredData.reduce((sum, row) => sum + (row.totalOrders || 0), 0);
  const monthName = months[month].label;

  const exportTable = (format: 'excel' | 'pdf') => {
    const headers = [
      isRtl ? 'رقم' : 'No.',
      isRtl ? 'الكود' : 'Code',
      isRtl ? 'المنتج' : 'Product',
      isRtl ? 'وحدة المنتج' : 'Product Unit',
      ...filteredDayIndices.map(i => daysInMonth[i]),
      isRtl ? 'إجمالي المرتجعات' : 'Total Returns',
      isRtl ? 'القيمة الإجمالية' : 'Total Value',
      isRtl ? 'نسبة %' : 'Ratio %',
    ];
    const rows = [
      ...filteredData.map((row, index) => ({
        no: index + 1,
        code: row.code,
        product: row.product,
        unit: row.unit,
        ...Object.fromEntries(filteredDayIndices.map((idx) => [daysInMonth[idx], getDailyReturn(row, idx)])),
        totalReturns: filteredDayIndices.reduce((s, i) => s + getDailyReturn(row, i), 0),
        totalValue: formatPrice(row.totalValue, isRtl),
        ratio: row.totalOrders > 0 ? ((row.totalReturns / row.totalOrders) * 100).toFixed(2) : '0.00',
      })),
      {
        no: '',
        code: '',
        product: isRtl ? 'الإجمالي' : 'Total',
        unit: '',
        ...Object.fromEntries(filteredDayIndices.map((idx) => [daysInMonth[idx], filteredData.reduce((sum, row) => sum + getDailyReturn(row, idx), 0)])),
        totalReturns: grandTotalReturns,
        totalValue: formatPrice(grandTotalValue, isRtl),
        ratio: grandTotalOrders > 0 ? ((grandTotalReturns / grandTotalOrders) * 100).toFixed(2) : '0.00',
      },
    ];
    const dataRows = rows.map(row => [
      row.no,
      row.code,
      row.product,
      row.unit,
      ...filteredDayIndices.map(idx => row[daysInMonth[idx]]),
      row.totalReturns,
      row.totalValue,
      `${row.ratio}%`,
    ]);

    if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows, { header: headers });
      if (isRtl) ws['!views'] = [{ RTL: true }];
      ws['!cols'] = [{ wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, ...filteredDayIndices.map(() => ({ wch: 12 })), { wch: 15 }, { wch: 15 }, { wch: 15 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `${title}_${monthName}`);
      XLSX.writeFile(wb, `${title}_${monthName}.xlsx`);
      toast.success(isRtl ? 'تم تصدير ملف Excel بنجاح' : 'Excel exported successfully', {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    } else if (format === 'pdf') {
      exportToPDF(dataRows, title, monthName, headers, isRtl, filteredData.length, grandTotalReturns, grandTotalValue, []);
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
        <p className="text-gray-500 text-sm font-medium">{isRtl ? 'لا توجد بيانات مرتجعات' : 'No return data available'}</p>
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
              {filteredDayIndices.map(idx => (
                <th key={idx} className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">
                  {daysInMonth[idx]}
                </th>
              ))}
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                {isRtl ? 'إجمالي المرتجعات' : 'Total Returns'}
              </th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                {isRtl ? 'القيمة الإجمالية' : 'Total Value'}
              </th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                {isRtl ? 'نسبة %' : 'Ratio %'}
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
                {filteredDayIndices.map((idx) => {
                  const qty = getDailyReturn(row, idx);
                  const details = selectedBranches.length > 0 
                    ? Object.fromEntries(selectedBranches.map(b => [b, row.dailyBranchDetails[idx][b] || 0]))
                    : row.dailyBranchDetails[idx];
                  return (
                    <td
                      key={idx}
                      className="px-4 py-3 text-center font-medium text-red-700"
                      data-tooltip-id="return-tooltip"
                      data-tooltip-content={getTooltipContent(qty, details, isRtl, 'return')}
                    >
                      {qty !== 0 ? formatNumber(qty, isRtl) : '0'}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(filteredDayIndices.reduce((s, i) => s + getDailyReturn(row, i), 0), isRtl)}</td>
                <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatPrice(row.totalValue, isRtl)}</td>
                <td className="px-4 py-3 text-gray-700 text-center font-medium">
                  {row.totalOrders > 0 ? formatNumber(((row.totalReturns / row.totalOrders) * 100).toFixed(2), isRtl) + '%' : '0.00%'}
                </td>
              </tr>
            ))}
            <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <td className="px-4 py-3 text-gray-800 text-center" colSpan={4}>{isRtl ? 'الإجمالي' : 'Total'}</td>
              {filteredDayIndices.map((idx) => (
                <td key={idx} className="px-4 py-3 text-gray-800 text-center">
                  {formatNumber(filteredData.reduce((sum, row) => sum + getDailyReturn(row, idx), 0), isRtl)}
                </td>
              ))}
              <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalReturns, isRtl)}</td>
              <td className="px-4 py-3 text-gray-800 text-center">{formatPrice(grandTotalValue, isRtl)}</td>
              <td className="px-4 py-3 text-gray-800 text-center">
                {grandTotalOrders > 0 ? formatNumber(((grandTotalReturns / grandTotalOrders) * 100).toFixed(2), isRtl) + '%' : '0.00%'}
              </td>
            </tr>
          </tbody>
        </table>
        <Tooltip id="return-tooltip" place="top" />
      </motion.div>
    </div>
  );
};

export default ReturnsTable;