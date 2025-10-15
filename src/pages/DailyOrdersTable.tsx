import React, { useState, useMemo, Fragment } from 'react';
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

interface DailyOrderRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  dailyOrders: number[];
  totalOrders: number;
  totalPrice: number;
  dailyBranchDetails: { [branch: string]: number }[];
}

interface DailyOrdersTableProps {
  data: DailyOrderRow[];
  title: string;
  month: number;
  daysInMonth: string[];
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

export const DailyOrdersTable: React.FC<DailyOrdersTableProps> = ({
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
      result = result.filter((row) =>
        row.dailyBranchDetails.some((details) => details[selectedBranch] > 0)
      );
    }
    if (startDate && endDate) {
      const startDay = startDate.getDate() - 1;
      const endDay = endDate.getDate() - 1;
      result = result.map((row) => ({
        ...row,
        dailyOrders: row.dailyOrders.map((qty, i) => (i >= startDay && i <= endDay ? qty : 0)),
        dailyBranchDetails: row.dailyBranchDetails.map((details, i) =>
          i >= startDay && i <= endDay ? details : {}
        ),
        totalOrders: row.dailyOrders
          .slice(startDay, endDay + 1)
          .reduce((sum, qty) => sum + qty, 0),
      }));
    }
    return result;
  }, [data, searchTerm, selectedBranch, startDate, endDate]);

  const grandTotalOrders = filteredData.reduce((sum, row) => sum + row.totalOrders, 0);
  const grandTotalPrice = filteredData.reduce((sum, row) => sum + row.totalPrice, 0);
  const monthName = months[month].label;

  const exportTable = (format: 'excel' | 'pdf') => {
    const headers = [
      isRtl ? 'رقم' : 'No.',
      isRtl ? 'الكود' : 'Code',
      isRtl ? 'المنتج' : 'Product',
      isRtl ? 'وحدة المنتج' : 'Product Unit',
      ...daysInMonth,
      isRtl ? 'إجمالي الطلبات' : 'Total Orders',
      isRtl ? 'السعر الإجمالي' : 'Total Price',
    ];
    const rows = [
      ...filteredData.map((row, index) => ({
        no: index + 1,
        code: row.code,
        product: row.product,
        unit: row.unit,
        ...Object.fromEntries(row.dailyOrders.map((qty, i) => [daysInMonth[i], qty])),
        totalOrders: row.totalOrders,
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
            filteredData.reduce((sum, row) => sum + row.dailyOrders[i], 0),
          ])
        ),
        totalOrders: grandTotalOrders,
        totalPrice: formatPrice(grandTotalPrice, isRtl),
      },
    ];
    const dataRows = rows.map((row) => [
      row.no,
      row.code,
      row.product,
      row.unit,
      ...daysInMonth.map((day) => row[day]),
      row.totalOrders,
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
      exportToPDF(dataRows, title, monthName, headers, isRtl, filteredData.length, grandTotalOrders, grandTotalPrice, []);
    }
  };

  const branchOptions = [
    { value: 'all', label: isRtl ? 'جميع الفروع' : 'All Branches' },
    ...allBranches.map((branch) => ({ value: branch, label: branch })),
  ];

  const getTooltipContent = (qty: number, branchDetails: { [branch: string]: number }, isRtl: boolean) => {
    let content = `${isRtl ? 'الطلبات' : 'Orders'}: ${qty > 0 ? '+' : ''}${formatNumber(qty, isRtl)}`;
    if (Object.keys(branchDetails).length > 0) {
      content += `\n${Object.entries(branchDetails)
        .map(([branch, qty]) => `${branch}: ${qty > 0 ? '+' : ''}${formatNumber(qty, isRtl)}`)
        .join('\n')}`;
    }
    return content;
  };

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
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[40px]">{isRtl ? 'رقم' : 'No.'}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'الكود' : 'Code'}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[120px]">{isRtl ? 'المنتج' : 'Product'}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'وحدة المنتج' : 'Product Unit'}</th>
              {daysInMonth.map((day, i) => (
                <th key={i} className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">
                  {day}
                </th>
              ))}
              {allBranches.map((branch) => (
                <th key={branch} className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                  {isRtl ? `طلبات ${branch}` : `${branch} Orders`}
                </th>
              ))}
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                {isRtl ? 'إجمالي الطلبات' : 'Total Orders'}
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
                {row.dailyOrders.map((qty, i) => (
                  <td
                    key={i}
                    className={`px-4 py-3 text-center font-medium ${
                      qty > 0 ? 'bg-green-50 text-green-700' : 'text-gray-700'
                    }`}
                    data-tooltip-id="daily-orders-tooltip"
                    data-tooltip-content={getTooltipContent(qty, row.dailyBranchDetails[i], isRtl)}
                  >
                    {qty !== 0 ? `${qty > 0 ? '+' : ''}${formatNumber(qty, isRtl)}` : '0'}
                  </td>
                ))}
                {allBranches.map((branch) => (
                  <td
                    key={branch}
                    className="px-4 py-3 text-center font-medium text-gray-700"
                    data-tooltip-id="branch-orders-tooltip"
                    data-tooltip-content={`${isRtl ? 'طلبات ' : 'Orders in '} ${branch}: ${formatNumber(
                      row.dailyBranchDetails.reduce((sum, details) => sum + (details[branch] || 0), 0),
                      isRtl
                    )}`}
                  >
                    {formatNumber(
                      row.dailyBranchDetails.reduce((sum, details) => sum + (details[branch] || 0), 0),
                      isRtl
                    )}
                  </td>
                ))}
                <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalOrders, isRtl)}</td>
                <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatPrice(row.totalPrice, isRtl)}</td>
              </tr>
            ))}
            <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <td className="px-4 py-3 text-gray-800 text-center" colSpan={4}>
                {isRtl ? 'الإجمالي' : 'Total'}
              </td>
              {daysInMonth.map((_, i) => (
                <td key={i} className="px-4 py-3 text-gray-800 text-center">
                  {formatNumber(filteredData.reduce((sum, row) => sum + row.dailyOrders[i], 0), isRtl)}
                </td>
              ))}
              {allBranches.map((branch) => (
                <td key={branch} className="px-4 py-3 text-gray-800 text-center">
                  {formatNumber(
                    filteredData.reduce(
                      (sum, row) => sum + row.dailyBranchDetails.reduce((s, details) => s + (details[branch] || 0), 0),
                      0
                    ),
                    isRtl
                  )}
                </td>
              ))}
              <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalOrders, isRtl)}</td>
              <td className="px-4 py-3 text-gray-800 text-center">{formatPrice(grandTotalPrice, isRtl)}</td>
            </tr>
          </tbody>
        </table>
        <Tooltip id="daily-orders-tooltip" place="top" effect="solid" className="custom-tooltip" />
        <Tooltip id="branch-orders-tooltip" place="top" effect="solid" className="custom-tooltip" />
      </motion.div>
    </div>
  );
};
