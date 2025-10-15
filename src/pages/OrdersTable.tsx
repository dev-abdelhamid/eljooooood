// OrdersTable.tsx
import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/UI/Button';
import { Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';
import { Tooltip } from 'react-tooltip';

interface OrderRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  branchQuantities: { [branch: string]: number };
  totalQuantity: number;
  totalPrice: number;
  sales: number;
  actualSales: number;
}

interface Props {
  data: OrderRow[];
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
}

const OrdersTable: React.FC<Props> = ({
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
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranches, setSelectedBranches] = useState<string[]>(allBranches);

  const filteredData = useMemo(() => {
    return data.filter(row =>
      row.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  const totalQuantities = useMemo(() => {
    return selectedBranches.reduce((acc, branch) => {
      acc[branch] = filteredData.reduce((sum, row) => sum + (row.branchQuantities[branch] || 0), 0);
      return acc;
    }, {} as { [branch: string]: number });
  }, [filteredData, selectedBranches]);

  const grandTotalQuantity = filteredData.reduce((sum, row) => sum + row.totalQuantity, 0);
  const grandTotalPrice = filteredData.reduce((sum, row) => sum + row.totalPrice, 0);
  const grandActualSales = filteredData.reduce((sum, row) => sum + row.actualSales, 0);
  const monthName = months[month].label;

  const exportTable = (format: 'excel' | 'pdf') => {
    const headers = [
      isRtl ? 'الكود' : 'Code',
      isRtl ? 'المنتج' : 'Product',
      isRtl ? 'وحدة المنتج' : 'Product Unit',
      ...selectedBranches.map(b => b),
      isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
      isRtl ? 'المبيعات الفعلية' : 'Actual Sales',
      isRtl ? 'السعر الإجمالي' : 'Total Price',
      isRtl ? 'نسبة المبيعات %' : 'Sales Percentage %',
    ];
    const rows = [
      ...filteredData.map(row => ({
        code: row.code,
        product: row.product,
        unit: row.unit,
        ...Object.fromEntries(selectedBranches.map(branch => [branch, row.branchQuantities[branch] || 0])),
        totalQuantity: row.totalQuantity,
        actualSales: row.actualSales,
        totalPrice: formatPrice(row.totalPrice, isRtl),
        salesPercentage: row.totalQuantity > 0 ? ((row.actualSales / row.totalQuantity) * 100).toFixed(2) : '0.00',
      })),
      {
        code: '',
        product: isRtl ? 'الإجمالي' : 'Total',
        unit: '',
        ...Object.fromEntries(selectedBranches.map(branch => [branch, totalQuantities[branch] || 0])),
        totalQuantity: grandTotalQuantity,
        actualSales: grandActualSales,
        totalPrice: formatPrice(grandTotalPrice, isRtl),
        salesPercentage: grandTotalQuantity > 0 ? ((grandActualSales / grandTotalQuantity) * 100).toFixed(2) : '0.00',
      },
    ];
    const dataRows = rows.map(row => [
      row.code,
      row.product,
      row.unit,
      ...selectedBranches.map(branch => row[branch]),
      row.totalQuantity,
      row.actualSales,
      row.totalPrice,
      `${row.salesPercentage}%`,
    ]);

    if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows, { header: headers });
      if (isRtl) ws['!views'] = [{ RTL: true }];
      ws['!cols'] = [
        { wch: 15 },
        { wch: 25 },
        { wch: 15 },
        ...selectedBranches.map(() => ({ wch: 15 })),
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `${title}_${monthName}`);
      XLSX.writeFile(wb, `${title}_${monthName}.xlsx`);
      toast.success(isRtl ? 'تم تصدير ملف Excel بنجاح' : 'Excel exported successfully', {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    } else if (format === 'pdf') {
      exportToPDF(dataRows, title, monthName, headers, isRtl, filteredData.length, grandTotalQuantity, grandTotalPrice, selectedBranches);
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
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'الكود' : 'Code'}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[120px]">{isRtl ? 'المنتج' : 'Product'}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'وحدة المنتج' : 'Product Unit'}</th>
              {selectedBranches.map(branch => (
                <th key={branch} className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                  {branch}
                </th>
              ))}
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                {isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}
              </th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                {isRtl ? 'المبيعات الفعلية' : 'Actual Sales'}
              </th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                {isRtl ? 'السعر الإجمالي' : 'Total Price'}
              </th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                {isRtl ? 'نسبة المبيعات %' : 'Sales Percentage %'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredData.map(row => (
              <tr key={row.id} className={`hover:bg-blue-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <td className="px-4 py-3 text-gray-700 text-center truncate">{row.code}</td>
                <td className="px-4 py-3 text-gray-700 text-center truncate">{row.product}</td>
                <td className="px-4 py-3 text-gray-700 text-center truncate">{row.unit}</td>
                {selectedBranches.map(branch => (
                  <td
                    key={branch}
                    className={`px-4 py-3 text-center font-medium ${
                      row.branchQuantities[branch] > 0 ? 'bg-green-50 text-green-700' : row.branchQuantities[branch] < 0 ? 'bg-red-50 text-red-700' : 'text-gray-700'
                    }`}
                    data-tooltip-id="branch-quantity"
                    data-tooltip-content={`${isRtl ? 'الكمية في ' : 'Quantity in '} ${branch}: ${formatNumber(row.branchQuantities[branch] || 0, isRtl)}`}
                  >
                    {formatNumber(row.branchQuantities[branch] || 0, isRtl)}
                  </td>
                ))}
                <td className="px-4 py-3 text-gray-700 text-center font-medium" data-tooltip-id="total-quantity" data-tooltip-content={`${isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}: ${formatNumber(row.totalQuantity, isRtl)}\n${Object.entries(row.branchQuantities).map(([branch, qty]) => `${branch}: ${formatNumber(qty, isRtl)}`).join('\n')}`}>
                  {formatNumber(row.totalQuantity, isRtl)}
                </td>
                <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.actualSales, isRtl)}</td>
                <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatPrice(row.totalPrice, isRtl)}</td>
                <td className="px-4 py-3 text-gray-700 text-center font-medium">
                  {formatNumber(row.totalQuantity > 0 ? ((row.actualSales / row.totalQuantity) * 100).toFixed(2) : '0.00', isRtl)}%
                </td>
              </tr>
            ))}
            <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <td className="px-4 py-3 text-gray-800 text-center"></td>
              <td className="px-4 py-3 text-gray-800 text-center">{isRtl ? 'الإجمالي' : 'Total'}</td>
              <td className="px-4 py-3 text-gray-800 text-center"></td>
              {selectedBranches.map(branch => (
                <td key={branch} className="px-4 py-3 text-gray-800 text-center">
                  {formatNumber(totalQuantities[branch] || 0, isRtl)}
                </td>
              ))}
              <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalQuantity, isRtl)}</td>
              <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandActualSales, isRtl)}</td>
              <td className="px-4 py-3 text-gray-800 text-center">{formatPrice(grandTotalPrice, isRtl)}</td>
              <td className="px-4 py-3 text-gray-800 text-center">
                {formatNumber(grandTotalQuantity > 0 ? ((grandActualSales / grandTotalQuantity) * 100).toFixed(2) : '0.00', isRtl)}%
              </td>
            </tr>
          </tbody>
        </table>
        <Tooltip id="branch-quantity" place="top" />
        <Tooltip id="total-quantity" place="top" />
      </motion.div>
    </div>
  );
};

export default OrdersTable;