import React, { FC } from 'react';
import { motion } from 'framer-motion';
import { Tooltip } from 'react-tooltip';
import { Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';
import {Button} from '../components/UI/Button';

interface Branch {
  id: string;
  name: string;
}

interface OrderRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  totalQuantity: number;
  totalPrice: number;
  dailyQuantities: number[];
  dailyBranchDetails: { branchId: string; quantity: number }[][];
}

interface DailyOrdersTableProps {
  data: OrderRow[];
  title: string;
  month: number;
  daysInMonth: string[];
  allBranches: Branch[];
  isRtl: boolean;
  months: { value: string; label: string }[];
  formatPrice: (price: number, isRtl: boolean) => string;
  formatNumber: (num: number | string, isRtl: boolean) => string;
  exportToPDF: (
    dataRows: any[],
    title: string,
    monthName: string,
    headers: string[],
    isRtl: boolean,
    dataLength: number,
    totalQuantity: number,
    totalPrice: number,
    extraColumns: string[]
  ) => void;
}

const DailyOrdersTable: FC<DailyOrdersTableProps> = ({
  data,
  title,
  month,
  daysInMonth,
  allBranches,
  isRtl,
  months,
  formatPrice,
  formatNumber,
  exportToPDF,
}) => {
  const grandTotalQuantity = data.reduce((sum, row) => sum + row.totalQuantity, 0);
  const grandTotalPrice = data.reduce((sum, row) => sum + row.totalPrice, 0);
  const monthName = months[month].label;

  const getTooltipContent = (qty: number, branchDetails: { branchId: string; quantity: number }[], isRtl: boolean): string => {
    if (!branchDetails || branchDetails.length === 0) return '';
    const branchQuantities = branchDetails
      .map((detail) => {
        const branch = allBranches.find((b) => b.id === detail.branchId);
        return `${branch?.name || 'Unknown'}: ${formatNumber(detail.quantity, isRtl)}`;
      })
      .join('\n');
    return `${isRtl ? 'الكمية' : 'Quantity'}: ${formatNumber(qty, isRtl)}\n${branchQuantities}`;
  };

  const exportTable = (format: 'excel' | 'pdf') => {
    const headers = [
      isRtl ? 'رقم' : 'No.',
      isRtl ? 'الكود' : 'Code',
      isRtl ? 'المنتج' : 'Product',
      isRtl ? 'وحدة المنتج' : 'Product Unit',
      ...daysInMonth,
      isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
      isRtl ? 'السعر الإجمالي' : 'Total Price',
    ];
    const rows = [
      ...data.map((row, index) => ({
        no: index + 1,
        code: row.code,
        product: row.product,
        unit: row.unit,
        ...Object.fromEntries(row.dailyQuantities.map((qty, i) => [daysInMonth[i], qty])),
        totalQuantity: row.totalQuantity,
        totalPrice: formatPrice(row.totalPrice, isRtl),
      })),
      {
        no: '',
        code: '',
        product: isRtl ? 'الإجمالي' : 'Total',
        unit: '',
        ...Object.fromEntries(
          daysInMonth.map((_, i) => [
            daysInMonth[i],
            data.reduce((sum, row) => sum + row.dailyQuantities[i], 0),
          ])
        ),
        totalQuantity: grandTotalQuantity,
        totalPrice: formatPrice(grandTotalPrice, isRtl),
      },
    ];
    const dataRows = rows.map((row) => [
      row.no,
      row.code,
      row.product,
      row.unit,
      ...daysInMonth.map((day) => row[day]),
      row.totalQuantity,
      row.totalPrice,
    ]);

    if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map((row) => Object.fromEntries(Object.entries(row).reverse())) : rows, {
        header: headers,
      });
      if (isRtl) ws['!views'] = [{ RTL: true }];
      ws['!cols'] = [
        { wch: 10 },
        { wch: 15 },
        { wch: 20 },
        { wch: 15 },
        ...daysInMonth.map(() => ({ wch: 12 })),
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
      exportToPDF(dataRows, title, monthName, headers, isRtl, data.length, grandTotalQuantity, grandTotalPrice, []);
    }
  };

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
      {data.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          {isRtl ? 'لا توجد بيانات متاحة لهذا الشهر' : 'No data available for this month'}
        </div>
      ) : (
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
                  <th key={i} className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">
                    {day}
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
              {data.map((row, index) => (
                <tr key={row.id} className={`hover:bg-blue-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-4 py-3 text-gray-700 text-center">{formatNumber(index + 1, isRtl)}</td>
                  <td className="px-4 py-3 text-gray-700 text-center truncate">{row.code}</td>
                  <td className="px-4 py-3 text-gray-700 text-center truncate">{row.product}</td>
                  <td className="px-4 py-3 text-gray-700 text-center truncate">{row.unit}</td>
                  {row.dailyQuantities.map((qty, i) => (
                    <td
                      key={i}
                      className={`px-4 py-3 text-center font-medium ${
                        qty > 0 ? 'bg-green-50 text-green-700' : qty < 0 ? 'bg-red-50 text-red-700' : 'text-gray-700'
                      }`}
                      data-tooltip-id="daily-quantity-tooltip"
                      data-tooltip-content={getTooltipContent(qty, row.dailyBranchDetails[i], isRtl)}
                    >
                      {qty !== 0 ? `${qty > 0 ? '+' : ''}${formatNumber(qty, isRtl)}` : '0'}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalQuantity, isRtl)}</td>
                  <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatPrice(row.totalPrice, isRtl)}</td>
                </tr>
              ))}
              <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <td className="px-4 py-3 text-gray-800 text-center" colSpan={4}>
                  {isRtl ? 'الإجمالي' : 'Total'}
                </td>
                {daysInMonth.map((_, i) => (
                  <td key={i} className="px-4 py-3 text-gray-800 text-center">
                    {formatNumber(data.reduce((sum, row) => sum + row.dailyQuantities[i], 0), isRtl)}
                  </td>
                ))}
                <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalQuantity, isRtl)}</td>
                <td className="px-4 py-3 text-gray-800 text-center">{formatPrice(grandTotalPrice, isRtl)}</td>
              </tr>
            </tbody>
          </table>
          <Tooltip id="daily-quantity-tooltip" place="top" effect="solid" className="custom-tooltip" />
        </motion.div>
      )}
    </div>
  );
};

export default DailyOrdersTable;