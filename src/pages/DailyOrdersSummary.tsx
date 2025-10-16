// DailyOrdersReport.tsx
import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/UI/Button';
import { Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';
import { Tooltip } from 'react-tooltip';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface OrderRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  dailyQuantities: number[];
  dailyBranchDetails: { [branch: string]: number }[];
  totalQuantity: number;
  totalPrice: number;
  actualSales: number;
}

interface Props {
  data: OrderRow[];
  month: number;
  isRtl: boolean;
  loading: boolean;
  allBranches: string[];
  daysInMonth: string[];
  months: { value: number; label: string }[];
  currentYear: number;
}

const toArabicNumerals = (number: string | number): string => {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(number).replace(/[0-9]/g, (digit) => arabicNumerals[parseInt(digit)]);
};

const formatPrice = (amount: number, isRtl: boolean, isStats: boolean = false): string => {
  const validAmount = isNaN(amount) ? 0 : amount;
  let formatted = validAmount.toLocaleString(isRtl ? 'ar-SA' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (isRtl) formatted = toArabicNumerals(formatted);
  return isStats ? `${formatted} ${isRtl ? 'ر.س' : 'SAR'}` : formatted;
};

const formatNumber = (num: number, isRtl: boolean): string => isRtl ? toArabicNumerals(num) : num.toString();

const loadFont = async (doc: jsPDF): Promise<boolean> => {
  // Same as original
  // ... (omit for brevity, assume same as in original code)
  return true; // Placeholder
};

const generateFileName = (title: string, monthName: string, isRtl: boolean): string => {
  const date = new Date().toISOString().split('T')[0];
  return `${title}_${monthName}_${date}.pdf`;
};

const generatePDFHeader = (
  doc: jsPDF,
  isRtl: boolean,
  title: string,
  monthName: string,
  totalItems: number,
  totalQuantity: number,
  totalPrice: number,
  fontName: string,
  fontLoaded: boolean
) => {
  // Same as original
};

const generatePDFTable = (
  doc: jsPDF,
  headers: string[],
  data: any[],
  isRtl: boolean,
  fontLoaded: boolean,
  fontName: string,
  allBranches: string[]
) => {
  // Same as original
};

const exportToPDF = async (
  data: any[],
  title: string,
  monthName: string,
  headers: string[],
  isRtl: boolean,
  totalItems: number,
  totalQuantity: number,
  totalPrice: number,
  allBranches: string[]
) => {
  // Same as original
};

const getTooltipContent = (dailyQuantity: number, branchDetails: { [branch: string]: number }, isRtl: boolean, type: string) => {
  // Same as original, adjusted for 'orders'
};

const DailyOrdersReport: React.FC<Props> = ({ data, month, isRtl, loading, allBranches, daysInMonth, months, currentYear }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'full' | 'week1' | 'week2' | 'week3' | 'week4' | 'custom'>('full');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const monthName = months[month].label;

  const monthDates = useMemo(() => daysInMonth.map((_, i) => new Date(currentYear, month, i + 1)), [daysInMonth, currentYear, month]);

  const filteredDaysIndices = useMemo(() => {
    let indices = Array.from({ length: daysInMonth.length }, (_, i) => i);
    if (selectedPeriod !== 'full' && selectedPeriod !== 'custom') {
      const weekNum = parseInt(selectedPeriod.slice(4));
      const start = (weekNum - 1) * 7;
      const end = Math.min(start + 6, daysInMonth.length - 1);
      indices = indices.slice(start, end + 1);
    } else if (selectedPeriod === 'custom' && startDate && endDate) {
      indices = indices.filter(i => monthDates[i] >= startDate && monthDates[i] <= endDate);
    }
    return indices;
  }, [selectedPeriod, startDate, endDate, daysInMonth.length, monthDates]);

  const filteredDays = filteredDaysIndices.map(i => daysInMonth[i]);

  const filteredData = useMemo(() => {
    let processedData = data.map(row => {
      const filteredDailyQuantities = filteredDaysIndices.map(i => row.dailyQuantities[i] || 0);
      const filteredDailyBranchDetails = filteredDaysIndices.map(i => row.dailyBranchDetails[i] || {});
      const newTotalQuantity = filteredDailyQuantities.reduce((sum, q) => sum + q, 0);
      return { ...row, dailyQuantities: filteredDailyQuantities, dailyBranchDetails: filteredDailyBranchDetails, totalQuantity: newTotalQuantity };
    });

    if (selectedBranches.length > 0) {
      processedData = processedData.map(row => {
        const newDailyQuantities = row.dailyQuantities.map((_, j) => selectedBranches.reduce((sum, b) => sum + (row.dailyBranchDetails[j][b] || 0), 0));
        const newDailyBranchDetails = row.dailyBranchDetails.map(details => {
          const newDetails: { [branch: string]: number } = {};
          selectedBranches.forEach(b => {
            if (details[b] !== undefined) newDetails[b] = details[b];
          });
          return newDetails;
        });
        const newTotalQuantity = newDailyQuantities.reduce((sum, q) => sum + q, 0);
        return { ...row, dailyQuantities: newDailyQuantities, dailyBranchDetails: newDailyBranchDetails, totalQuantity: newTotalQuantity };
      });
    }

    return processedData.filter(row => row.product.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [data, searchTerm, selectedBranches, filteredDaysIndices]);

  const grandTotalQuantity = filteredData.reduce((sum, row) => sum + row.totalQuantity, 0);
  const grandTotalPrice = filteredData.reduce((sum, row) => sum + row.totalPrice, 0);
  const grandActualSales = filteredData.reduce((sum, row) => sum + row.actualSales, 0);

  const exportTable = (format: 'excel' | 'pdf') => {
    const headers = [
      isRtl ? 'رقم' : 'No.',
      isRtl ? 'الكود' : 'Code',
      isRtl ? 'المنتج' : 'Product',
      isRtl ? 'وحدة المنتج' : 'Product Unit',
      ...filteredDays,
      isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
      isRtl ? 'المبيعات الفعلية' : 'Actual Sales',
      isRtl ? 'السعر الإجمالي' : 'Total Price',
      isRtl ? 'نسبة المبيعات %' : 'Sales Percentage %',
    ];

    const rows = [
      ...filteredData.map((row, index) => ({
        no: index + 1,
        code: row.code,
        product: row.product,
        unit: row.unit,
        ...Object.fromEntries(filteredDays.map((day, i) => [day, row.dailyQuantities[i]])),
        totalQuantity: row.totalQuantity,
        actualSales: row.actualSales,
        totalPrice: formatPrice(row.totalPrice, isRtl),
        salesPercentage: row.totalQuantity > 0 ? ((row.actualSales / row.totalQuantity) * 100).toFixed(2) : '0.00',
      })),
      {
        no: '',
        code: '',
        product: isRtl ? 'الإجمالي' : 'Total',
        unit: '',
        ...Object.fromEntries(filteredDays.map((day, i) => [day, filteredData.reduce((sum, row) => sum + row.dailyQuantities[i], 0)])),
        totalQuantity: grandTotalQuantity,
        actualSales: grandActualSales,
        totalPrice: formatPrice(grandTotalPrice, isRtl),
        salesPercentage: grandTotalQuantity > 0 ? ((grandActualSales / grandTotalQuantity) * 100).toFixed(2) : '0.00',
      },
    ];

    const dataRows = rows.map(row => [
      row.no,
      row.code,
      row.product,
      row.unit,
      ...filteredDays.map(day => row[day]),
      row.totalQuantity,
      row.actualSales,
      row.totalPrice,
      `${row.salesPercentage}%`,
    ]);

    if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows, { header: headers });
      if (isRtl) ws['!views'] = [{ RTL: true }];
      ws['!cols'] = [{ wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, ...filteredDays.map(() => ({ wch: 12 })), { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `${isRtl ? 'حركة الطلبات' : 'Orders Movement'}_${monthName}`);
      XLSX.writeFile(wb, `${isRtl ? 'حركة الطلبات' : 'Orders Movement'}_${monthName}.xlsx`);
      toast.success(isRtl ? 'تم تصدير ملف Excel بنجاح' : 'Excel exported successfully');
    } else if (format === 'pdf') {
      exportToPDF(dataRows, isRtl ? 'حركة الطلبات' : 'Orders Movement', monthName, headers, isRtl, filteredData.length, grandTotalQuantity, grandTotalPrice, allBranches);
    }
  };

  if (loading) {
    return <div className="text-center py-12 bg-white shadow-md rounded-xl border border-gray-200"><p>{isRtl ? 'جاري التحميل...' : 'Loading...'}</p></div>;
  }

  if (filteredData.length === 0) {
    return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 bg-white shadow-md rounded-xl border border-gray-200"><p>{isRtl ? 'لا توجد بيانات' : 'No data available'}</p></motion.div>;
  }

  return (
    <div className="mb-8">
      <div className={`flex flex-col gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
        <input
          type="text"
          placeholder={isRtl ? 'بحث حسب المنتج' : 'Search by product'}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="p-2 border rounded"
        />
        <select
          multiple
          value={selectedBranches}
          onChange={(e) => setSelectedBranches(Array.from(e.target.options).filter(o => o.selected).map(o => o.value))}
          className="p-2 border rounded"
        >
          {allBranches.map(branch => <option key={branch} value={branch}>{branch}</option>)}
        </select>
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value as any)}
          className="p-2 border rounded"
        >
          <option value="full">{isRtl ? 'الشهر الكامل' : 'Full Month'}</option>
          <option value="week1">{isRtl ? 'الأسبوع 1' : 'Week 1'}</option>
          <option value="week2">{isRtl ? 'الأسبوع 2' : 'Week 2'}</option>
          <option value="week3">{isRtl ? 'الأسبوع 3' : 'Week 3'}</option>
          <option value="week4">{isRtl ? 'الأسبوع 4' : 'Week 4'}</option>
          <option value="custom">{isRtl ? 'فترة مخصصة' : 'Custom Period'}</option>
        </select>
        {selectedPeriod === 'custom' && (
          <div className="flex gap-2">
            <DatePicker selected={startDate} onChange={setStartDate} placeholderText={isRtl ? 'بداية' : 'Start'} />
            <DatePicker selected={endDate} onChange={setEndDate} placeholderText={isRtl ? 'نهاية' : 'End'} />
          </div>
        )}
      </div>
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
        <h2 className="text-lg font-semibold text-gray-800">{isRtl ? `حركة الطلبات - ${monthName}` : `Orders Movement - ${monthName}`}</h2>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => exportTable('excel')} className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-sm"><Upload className="w-4 h-4" /> {isRtl ? 'تصدير إكسل' : 'Export Excel'}</Button>
          <Button variant="primary" onClick={() => exportTable('pdf')} className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium bg-green-600 hover:bg-green-700 text-white shadow-sm"><Upload className="w-4 h-4" /> {isRtl ? 'تصدير PDF' : 'Export PDF'}</Button>
        </div>
      </div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="overflow-x-auto rounded-xl shadow-md border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-xs">
          <thead className="bg-blue-50 sticky top-0">
            <tr className={isRtl ? 'flex-row-reverse' : ''}>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[40px]">{isRtl ? 'رقم' : 'No.'}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'الكود' : 'Code'}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[120px]">{isRtl ? 'المنتج' : 'Product'}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'وحدة المنتج' : 'Product Unit'}</th>
              {filteredDays.map((day, i) => (
                <th key={i} className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{day}</th>
              ))}
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">{isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">{isRtl ? 'المبيعات الفعلية' : 'Actual Sales'}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">{isRtl ? 'السعر الإجمالي' : 'Total Price'}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">{isRtl ? 'نسبة المبيعات %' : 'Sales Percentage %'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredData.map((row, index) => (
              <tr key={row.id} className={`hover:bg-blue-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <td className="px-4 py-3 text-gray-700 text-center">{formatNumber(index + 1, isRtl)}</td>
                <td className="px-4 py-3 text-gray-700 text-center truncate">{row.code}</td>
                <td className="px-4 py-3 text-gray-700 text-center truncate">{row.product}</td>
                <td className="px-4 py-3 text-gray-700 text-center truncate">{row.unit}</td>
                {row.dailyQuantities.map((qty, i) => (
                  <td
                    key={i}
                    className={`px-4 py-3 text-center font-medium ${qty > 0 ? 'bg-green-50 text-green-700' : qty < 0 ? 'bg-red-50 text-red-700' : 'text-gray-700'}`}
                    data-tooltip-id="order-tooltip"
                    data-tooltip-content={getTooltipContent(qty, row.dailyBranchDetails[i], isRtl, 'orders')}
                  >
                    {qty !== 0 ? `${qty > 0 ? '+' : ''}${formatNumber(qty, isRtl)}` : '0'}
                  </td>
                ))}
                <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalQuantity, isRtl)}</td>
                <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.actualSales, isRtl)}</td>
                <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatPrice(row.totalPrice, isRtl)}</td>
                <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalQuantity > 0 ? ((row.actualSales / row.totalQuantity) * 100).toFixed(2) : '0.00', isRtl)}%</td>
              </tr>
            ))}
            <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <td className="px-4 py-3 text-gray-800 text-center" colSpan={4}>{isRtl ? 'الإجمالي' : 'Total'}</td>
              {filteredDays.map((_, i) => (
                <td key={i} className="px-4 py-3 text-gray-800 text-center">{formatNumber(filteredData.reduce((sum, row) => sum + row.dailyQuantities[i], 0), isRtl)}</td>
              ))}
              <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalQuantity, isRtl)}</td>
              <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandActualSales, isRtl)}</td>
              <td className="px-4 py-3 text-gray-800 text-center">{formatPrice(grandTotalPrice, isRtl)}</td>
              <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalQuantity > 0 ? ((grandActualSales / grandTotalQuantity) * 100).toFixed(2) : '0.00', isRtl)}%</td>
            </tr>
          </tbody>
        </table>
        <Tooltip id="order-tooltip" place="top" className="custom-tooltip" />
      </motion.div>
    </div>
  );
};

export default DailyOrdersReport;