import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/UI/Button';
import { Upload, Search, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';
import { ProductDropdown } from './NewOrder';
import { Tooltip } from 'react-tooltip';
import { useLanguage } from '../contexts/LanguageContext';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

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

interface OrdersTableProps {
  data: OrderRow[];
  title: string;
  month: number;
  allBranches: string[];
  isRtl: boolean;
  months: { value: number; label: string }[];
  formatPrice: (amount: number, isRtl: boolean, isStats?: boolean) => string;
  formatNumber: (num: number, isRtl: boolean) => string;
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
  ) => void;
}

export const OrdersTable: React.FC<OrdersTableProps> = ({
  data,
  title,
  month,
  allBranches,
  isRtl,
  months,
  formatPrice,
  formatNumber,
  exportToPDF,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [startDate, endDate] = dateRange;

  const filteredData = useMemo(() => {
    let result = data;
    if (searchTerm) {
      result = result.filter(
        (row) =>
          row.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
          row.code.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (selectedBranch !== 'all') {
      result = result.filter((row) => row.branchQuantities[selectedBranch] > 0);
    }
    if (startDate && endDate) {
      result = result.filter((row) => {
        // Assume data is for the selected month; filter by date range if needed
        return true; // Add date range logic if orders have specific dates
      });
    }
    return result;
  }, [data, searchTerm, selectedBranch, startDate, endDate]);

  const totalQuantities = useMemo(
    () =>
      allBranches.reduce((acc, branch) => {
        acc[branch] = filteredData.reduce((sum, row) => sum + (row.branchQuantities[branch] || 0), 0);
        return acc;
      }, {} as { [branch: string]: number }),
    [filteredData, allBranches]
  );

  const grandTotalQuantity = filteredData.reduce((sum, row) => sum + row.totalQuantity, 0);
  const grandTotalPrice = filteredData.reduce((sum, row) => sum + row.totalPrice, 0);
  const grandActualSales = filteredData.reduce((sum, row) => sum + row.actualSales, 0);
  const monthName = months[month].label;

  const exportTable = (format: 'excel' | 'pdf') => {
    const headers = [
      isRtl ? 'الكود' : 'Code',
      isRtl ? 'المنتج' : 'Product',
      isRtl ? 'وحدة المنتج' : 'Product Unit',
      ...allBranches,
      isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
      isRtl ? 'المبيعات الفعلية' : 'Actual Sales',
      isRtl ? 'السعر الإجمالي' : 'Total Price',
      isRtl ? 'نسبة المبيعات %' : 'Sales Percentage %',
    ];
    const rows = [
      ...filteredData.map((row) => ({
        code: row.code,
        product: row.product,
        unit: row.unit,
        ...Object.fromEntries(allBranches.map((branch) => [branch, row.branchQuantities[branch] || 0])),
        totalQuantity: row.totalQuantity,
        actualSales: row.actualSales,
        totalPrice: formatPrice(row.totalPrice, isRtl),
        salesPercentage: row.totalQuantity > 0 ? ((row.actualSales / row.totalQuantity) * 100).toFixed(2) : '0.00',
      })),
      {
        code: '',
        product: isRtl ? 'الإجمالي' : 'Total',
        unit: '',
        ...Object.fromEntries(allBranches.map((branch) => [branch, totalQuantities[branch] || 0])),
        totalQuantity: grandTotalQuantity,
        actualSales: grandActualSales,
        totalPrice: formatPrice(grandTotalPrice, isRtl),
        salesPercentage: grandTotalQuantity > 0 ? ((grandActualSales / grandTotalQuantity) * 100).toFixed(2) : '0.00',
      },
    ];
    const dataRows = rows.map((row) => [
      row.code,
      row.product,
      row.unit,
      ...allBranches.map((branch) => row[branch]),
      row.totalQuantity,
      row.actualSales,
      row.totalPrice,
      `${row.salesPercentage}%`,
    ]);

    if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map((row) => Object.fromEntries(Object.entries(row).reverse())) : rows, {
        header: headers,
      });
      if (isRtl) ws['!views'] = [{ RTL: true }];
      ws['!cols'] = [
        { wch: 15 },
        { wch: 25 },
        { wch: 15 },
        ...allBranches.map(() => ({ wch: 15 })),
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
      exportToPDF(dataRows, title, monthName, headers, isRtl, filteredData.length, grandTotalQuantity, grandTotalPrice, allBranches);
    }
  };

  const branchOptions = [
    { value: 'all', label: isRtl ? 'جميع الفروع' : 'All Branches' },
    ...allBranches.map((branch) => ({ value: branch, label: branch })),
  ];

  return (
    <div className="mb-8">
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
        <h2 className="text-lg font-semibold text-gray-800">{isRtl ? `${title} - ${monthName}` : `${title} - ${monthName}`}</h2>
        <div className="flex gap-2">
          <div className="relative flex items-center">
            <Search className="absolute left-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={isRtl ? 'ابحث حسب المنتج أو الكود' : 'Search by product or code'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm text-sm text-gray-700"
            />
          </div>
          <ProductDropdown
            value={selectedBranch}
            onChange={setSelectedBranch}
            options={branchOptions}
            ariaLabel={isRtl ? 'اختر الفرع' : 'Select Branch'}
          />
          <DatePicker
            selectsRange
            startDate={startDate}
            endDate={endDate}
            onChange={(update) => setDateRange(update)}
            placeholderText={isRtl ? 'اختر فترة' : 'Select Date Range'}
            className="px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm text-sm text-gray-700"
          />
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
              {allBranches.map((branch) => (
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
            {filteredData.map((row) => (
              <tr key={row.id} className={`hover:bg-blue-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <td className="px-4 py-3 text-gray-700 text-center truncate">{row.code}</td>
                <td className="px-4 py-3 text-gray-700 text-center truncate">{row.product}</td>
                <td className="px-4 py-3 text-gray-700 text-center truncate">{row.unit}</td>
                {allBranches.map((branch) => (
                  <td
                    key={branch}
                    className={`px-4 py-3 text-center font-medium ${
                      row.branchQuantities[branch] > 0
                        ? 'bg-green-50 text-green-700'
                        : row.branchQuantities[branch] < 0
                        ? 'bg-red-50 text-red-700'
                        : 'text-gray-700'
                    }`}
                    data-tooltip-id="branch-quantity"
                    data-tooltip-content={`${isRtl ? 'الكمية في ' : 'Quantity in '} ${branch}: ${formatNumber(
                      row.branchQuantities[branch] || 0,
                      isRtl
                    )}`}
                  >
                    {formatNumber(row.branchQuantities[branch] || 0, isRtl)}
                  </td>
                ))}
                <td
                  className="px-4 py-3 text-gray-700 text-center font-medium"
                  data-tooltip-id="total-quantity"
                  data-tooltip-content={`${isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}: ${formatNumber(
                    row.totalQuantity,
                    isRtl
                  )}\n${Object.entries(row.branchQuantities)
                    .map(([branch, qty]) => `${branch}: ${formatNumber(qty, isRtl)}`)
                    .join('\n')}`}
                >
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
              {allBranches.map((branch) => (
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
        <Tooltip id="branch-quantity" place="top" effect="solid" className="custom-tooltip" />
        <Tooltip id="total-quantity" place="top" effect="solid" className="custom-tooltip" />
      </motion.div>
    </div>
  );
};
