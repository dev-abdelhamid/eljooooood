// StockOutTable.tsx
import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/UI/Button';
import { Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';
import { Tooltip } from 'react-tooltip';

interface StockRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  totalQuantity: number;
  dailyQuantities: number[];
  dailyBranchDetails: { [branch: string]: number }[];
  totalPrice: number;
  dailySales?: number[];
  dailyReturns?: number[];
  dailySalesDetails?: { [branch: string]: number }[];
  dailyReturnsDetails?: { [branch: string]: number }[];
}

interface Props {
  data: StockRow[];
  title: string;
  month: number;
  isRtl: boolean;
  loading: boolean;
  allBranches: string[];
  months: { value: number; label: string }[];
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
  daysInMonth: string[];
  getTooltipContent: (dailyQuantity: number, branchDetails: { [branch: string]: number }, isRtl: boolean, type: 'in' | 'out' | 'return' | 'sales' | 'orders') => string;
  getOutTooltip: (qty: number, sales: number, returns: number, salesDetails: { [branch: string]: number }, returnsDetails: { [branch: string]: number }, isRtl: boolean) => string;
}

const StockOutTable: React.FC<Props> = ({
  data,
  title,
  month,
  isRtl,
  loading,
  allBranches,
  months,
  formatPrice,
  formatNumber,
  toArabicNumerals,
  exportToPDF,
  daysInMonth,
  getTooltipContent,
  getOutTooltip,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranches, setSelectedBranches] = useState<string[]>(allBranches);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const filteredData = useMemo(() => {
    return data.filter(row =>
      row.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  const monthName = months[month].label;

  const filteredDayIndices = useMemo(() => {
    let startIdx = 0;
    let endIdx = daysInMonth.length - 1;
    if (startDate) {
      const startD = new Date(startDate);
      startIdx = startD.getDate() - 1;
    }
    if (endDate) {
      const endD = new Date(endDate);
      endIdx = endD.getDate() - 1;
    }
    return Array.from({ length: endIdx - startIdx + 1 }, (_, i) => startIdx + i);
  }, [startDate, endDate, daysInMonth]);

  const grandTotalQuantity = filteredData.reduce((sum, row) => sum + row.totalQuantity, 0);
  const grandTotalPrice = filteredData.reduce((sum, row) => sum + row.totalPrice, 0);

  const getDailyQuantity = (row: StockRow, i: number) => {
    if (selectedBranches.length === 0) return row.dailyQuantities[i];
    return selectedBranches.reduce((sum, b) => sum + (row.dailyBranchDetails[i][b] || 0), 0);
  };

  const getDailySales = (row: StockRow, i: number) => {
    if (selectedBranches.length === 0) return row.dailySales ? row.dailySales[i] : 0;
    return selectedBranches.reduce((sum, b) => sum + (row.dailySalesDetails ? row.dailySalesDetails[i][b] || 0 : 0), 0);
  };

  const getDailyReturns = (row: StockRow, i: number) => {
    if (selectedBranches.length === 0) return row.dailyReturns ? row.dailyReturns[i] : 0;
    return selectedBranches.reduce((sum, b) => sum + (row.dailyReturnsDetails ? row.dailyReturnsDetails[i][b] || 0 : 0), 0);
  };

  const exportTable = (format: 'excel' | 'pdf') => {
    const headers = [
      isRtl ? 'رقم' : 'No.',
      isRtl ? 'الكود' : 'Code',
      isRtl ? 'المنتج' : 'Product',
      isRtl ? 'وحدة المنتج' : 'Product Unit',
      ...filteredDayIndices.map(i => daysInMonth[i]),
      isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
      isRtl ? 'السعر الإجمالي' : 'Total Price',
    ];
    const rows = [
      ...filteredData.map((row, index) => ({
        no: index + 1,
        code: row.code,
        product: row.product,
        unit: row.unit,
        ...Object.fromEntries(filteredDayIndices.map((idx) => [daysInMonth[idx], getDailyQuantity(row, idx)])),
        totalQuantity: filteredDayIndices.reduce((s, i) => s + getDailyQuantity(row, i), 0),
        totalPrice: formatPrice(row.totalPrice, isRtl),
      })),
      {
        no: '',
        code: '',
        product: isRtl ? 'الإجمالي' : 'Total',
        unit: '',
        ...Object.fromEntries(filteredDayIndices.map((idx) => [daysInMonth[idx], filteredData.reduce((sum, row) => sum + getDailyQuantity(row, idx), 0)])),
        totalQuantity: grandTotalQuantity,
        totalPrice: formatPrice(grandTotalPrice, isRtl),
      },
    ];
    const dataRows = rows.map(row => [
      row.no,
      row.code,
      row.product,
      row.unit,
      ...filteredDayIndices.map(idx => row[daysInMonth[idx]]),
      row.totalQuantity,
      row.totalPrice,
    ]);

    if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows, { header: headers });
      if (isRtl) ws['!views'] = [{ RTL: true }];
      ws['!cols'] = [{ wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, ...filteredDayIndices.map(() => ({ wch: 12 })), { wch: 15 }, { wch: 15 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `${title}_${monthName}`);
      XLSX.writeFile(wb, `${title}_${monthName}.xlsx`);
      toast.success(isRtl ? 'تم تصدير ملف Excel بنجاح' : 'Excel exported successfully', {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    } else if (format === 'pdf') {
      exportToPDF(dataRows, title, monthName, headers, isRtl, filteredData.length, grandTotalQuantity, grandTotalPrice, []);
    }
  };

  const monthStart = new Date(currentYear, month, 1);
  const monthEnd = new Date(currentYear, month + 1, 0);

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
          className="px-4 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-4">
          <label>
            {isRtl ? 'من' : 'From'}
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              min={monthStart.toISOString().split('T')[0]}
              max={monthEnd.toISOString().split('T')[0]}
              className="px-4 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ml-2"
            />
          </label>
          <label>
            {isRtl ? 'إلى' : 'To'}
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              min={monthStart.toISOString().split('T')[0]}
              max={monthEnd.toISOString().split('T')[0]}
              className="px-4 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ml-2"
            />
          </label>
        </div>
        <select
          multiple
          value={selectedBranches}
          onChange={e => setSelectedBranches(Array.from(e.target.selectedOptions, option => option.value))}
          className="px-4 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {allBranches.map(branch => (
            <option key={branch} value={branch}>{branch}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <Button
            variant={filteredData.length > 0 ? 'primary' : 'secondary'}
            onClick={filteredData.length > 0 ? () => exportTable('excel') : undefined}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md ${
              filteredData.length > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
            disabled={filteredData.length === 0}
          >
            <Upload className="w-4 h-4" />
            {isRtl ? 'تصدير إكسل' : 'Export Excel'}
          </Button>
          <Button
            variant={filteredData.length > 0 ? 'primary' : 'secondary'}
            onClick={filteredData.length > 0 ? () => exportTable('pdf') : undefined}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md ${
              filteredData.length > 0 ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
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
                {isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}
              </th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                {isRtl ? 'السعر الإجمالي' : 'Total Price'}
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
                  const qty = getDailyQuantity(row, idx);
                  const sales = getDailySales(row, idx);
                  const returns = getDailyReturns(row, idx);
                  const salesDetails = selectedBranches.length > 0 
                    ? Object.fromEntries(selectedBranches.map(b => [b, row.dailySalesDetails ? row.dailySalesDetails[idx][b] || 0 : 0]))
                    : row.dailySalesDetails ? row.dailySalesDetails[idx] : {};
                  const returnsDetails = selectedBranches.length > 0 
                    ? Object.fromEntries(selectedBranches.map(b => [b, row.dailyReturnsDetails ? row.dailyReturnsDetails[idx][b] || 0 : 0]))
                    : row.dailyReturnsDetails ? row.dailyReturnsDetails[idx] : {};
                  return (
                    <td
                      key={idx}
                      className={`px-4 py-3 text-center font-medium ${
                        qty > 0 ? 'bg-green-50 text-green-700' : qty < 0 ? 'bg-red-50 text-red-700' : 'text-gray-700'
                      }`}
                      data-tooltip-id="stock-change"
                      data-tooltip-content={getOutTooltip(qty, sales, returns, salesDetails, returnsDetails, isRtl)}
                    >
                      {qty !== 0 ? `${qty > 0 ? '+' : ''}${formatNumber(qty, isRtl)}` : '0'}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(filteredDayIndices.reduce((s, i) => s + getDailyQuantity(row, i), 0), isRtl)}</td>
                <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatPrice(row.totalPrice, isRtl)}</td>
              </tr>
            ))}
            <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <td className="px-4 py-3 text-gray-800 text-center" colSpan={4}>{isRtl ? 'الإجمالي' : 'Total'}</td>
              {filteredDayIndices.map((idx) => (
                <td key={idx} className="px-4 py-3 text-gray-800 text-center">
                  {formatNumber(filteredData.reduce((sum, row) => sum + getDailyQuantity(row, idx), 0), isRtl)}
                </td>
              ))}
              <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalQuantity, isRtl)}</td>
              <td className="px-4 py-3 text-gray-800 text-center">{formatPrice(grandTotalPrice, isRtl)}</td>
            </tr>
          </tbody>
        </table>
        <Tooltip id="stock-change" place="top" />
      </motion.div>
    </div>
  );
};

export default StockOutTable;