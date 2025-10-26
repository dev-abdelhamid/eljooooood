import React, { useState, useMemo, useEffect, useCallback, Fragment, memo } from 'react';
import { motion } from 'framer-motion';
import { Search, X, Upload, ChevronDown } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { ordersAPI, branchesAPI, returnsAPI } from '../services/api';
import { toast } from 'react-toastify';
import { Tooltip } from 'react-tooltip';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';

// Define custom text-2xs for smaller font size
const style = document.createElement('style');
style.textContent = `
  .text-2xs {
    font-size: 9px;
    line-height: 1.2;
  }
`;
document.head.appendChild(style);

// Button component
const Button: React.FC<{
  variant: 'primary' | 'secondary';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ variant, onClick, disabled, className, children }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-medium transition-all duration-200 ${
        variant === 'primary' && !disabled
          ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'
          : 'bg-gray-200 text-gray-500 cursor-not-allowed'
      } ${className}`}
    >
      {children}
    </button>
  );
};

// ProductSearchInput component
const ProductSearchInput: React.FC<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  ariaLabel: string;
  className?: string;
}> = ({ value, onChange, placeholder, ariaLabel, className }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';

  const handleClear = () => {
    onChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>);
  };

  return (
    <div className={`relative group w-full ${className}`}>
      <motion.div
        className={`absolute px-1.5 py-1 inset-y-0 ${isRtl ? 'left-1.5' : 'right-1.5'} flex items-center text-gray-400 transition-colors group-focus-within:text-amber-500`}
        initial={false}
        animate={{ opacity: value ? 0 : 1, scale: value ? 0.8 : 1 }}
        transition={{ duration: 0.2 }}
      >
        <Search className="w-2.5 h-2.5" />
      </motion.div>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full ${isRtl ? 'pl-8 pr-2' : 'pr-8 pl-2'} px-1.5 py-1 border border-gray-200 rounded-lg focus:ring-1 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-2xs placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={ariaLabel}
      />
      {value && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          onClick={handleClear}
          className={`absolute px-1.5 py-1 inset-y-0 ${isRtl ? 'left-1.5' : 'right-1.5'} flex items-center text-gray-400 hover:text-amber-500 transition-colors focus:outline-none`}
          aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
        >
          <X className="w-2.5 h-2.5" />
        </motion.button>
      )}
    </div>
  );
};

// ProductDropdown component
const ProductDropdown = ({
  value,
  onChange,
  options,
  ariaLabel,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
  disabled?: boolean;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption =
    options.find((opt) => opt.value === value) ||
    options[0] || { value: '', label: isRtl ? 'اختر' : 'Select' };

  return (
    <div className="relative group">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-2.5 py-1 border border-gray-200 rounded-lg focus:ring-1 focus:ring-amber-500 focus:border-transparent transition-all duration-200 bg-gradient-to-r from-white to-gray-50 shadow-sm hover:shadow-md text-2xs text-gray-700 ${isRtl ? 'text-right' : 'text-left'} flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={ariaLabel}
      >
        <span className="truncate">{selectedOption.label || (isRtl ? 'غير معروف' : 'Unknown')}</span>
        <div className={`${isOpen ? 'rotate-180' : 'rotate-0'} transition-transform duration-200`}>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
        </div>
      </button>
      {isOpen && !disabled && (
        <div className="absolute w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-100 z-20 max-h-40 overflow-y-auto scrollbar-none">
          {options.map((option) => (
            <div
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className="px-2.5 py-1 text-2xs text-gray-700 hover:bg-amber-50 hover:text-amber-600 cursor-pointer transition-colors duration-200"
            >
              {option.label || (isRtl ? 'غير معروف' : 'Unknown')}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Utility functions
const toArabicNumerals = (number: string | number): string => {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(number).replace(/[0-9]/g, (digit) => arabicNumerals[parseInt(digit)]);
};

const formatNumber = (num: number, isRtl: boolean, type: 'orders' | 'returns' | 'total' | 'ratio' = 'total'): string => {
  if (type === 'orders' && num !== 0) return `${num > 0 ? '+' : ''}${isRtl ? toArabicNumerals(num) : num}`;
  if (type === 'returns' && num !== 0) return `${num > 0 ? '-' : ''}${isRtl ? toArabicNumerals(num) : num}`;
  return isRtl ? toArabicNumerals(num) : num.toString();
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const loadFont = async (doc: jsPDF): Promise<boolean> => {
  const fontName = 'Amiri';
  const fontUrls = {
    regular: 'https://raw.githubusercontent.com/aliftype/amiri/master/fonts/Amiri-Regular.ttf',
    bold: 'https://raw.githubusercontent.com/aliftype/amiri/master/fonts/Amiri-Bold.ttf',
  };
  try {
    const regularFontBytes = await fetch(fontUrls.regular).then((res) => res.arrayBuffer());
    doc.addFileToVFS(`${fontName}-normal.ttf`, arrayBufferToBase64(regularFontBytes));
    doc.addFont(`${fontName}-normal.ttf`, fontName, 'normal');
    const boldFontBytes = await fetch(fontUrls.bold).then((res) => res.arrayBuffer());
    doc.addFileToVFS(`${fontName}-bold.ttf`, arrayBufferToBase64(boldFontBytes));
    doc.addFont(`${fontName}-bold.ttf`, fontName, 'bold');
    doc.setFont(fontName, 'normal');
    return true;
  } catch (error) {
    console.error('Font loading error:', error);
    return false;
  }
};

const generateFileName = (title: string, monthName: string, isRtl: boolean, format: string): string => {
  const date = new Date().toISOString().split('T')[0];
  return `${title}_${monthName}_${date}.${format}`;
};

const generatePDFHeader = (
  doc: jsPDF,
  isRtl: boolean,
  title: string,
  monthName: string,
  totalItems: number,
  totalOrders: number,
  totalReturns: number,
  fontName: string,
  fontLoaded: boolean
) => {
  doc.setFont(fontLoaded ? fontName : 'helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(33, 33, 33);
  const pageWidth = doc.internal.pageSize.width;
  doc.text(title, isRtl ? pageWidth - 3 : 3, 6, { align: isRtl ? 'right' : 'left' });
  doc.setFontSize(6);
  doc.setTextColor(100, 100, 100);
  const stats = isRtl
    ? `إجمالي المنتجات: ${toArabicNumerals(totalItems)} | إجمالي الطلبات: ${toArabicNumerals(totalOrders)} وحدة | إجمالي المرتجعات: ${toArabicNumerals(totalReturns)} وحدة`
    : `Total Products: ${totalItems} | Total Orders: ${totalOrders} units | Total Returns: ${totalReturns} units`;
  doc.text(stats, isRtl ? pageWidth - 3 : 3, 10, { align: isRtl ? 'right' : 'left' });
  doc.setLineWidth(0.2);
  doc.setDrawColor(245, 158, 11);
  doc.line(3, 12, pageWidth - 3, 12);
  const pageCount = doc.getNumberOfPages();
  const currentDate = new Date().toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(5);
    doc.setTextColor(150, 150, 150);
    doc.setFont(fontLoaded ? fontName : 'helvetica', 'normal');
    const footerText = isRtl
      ? `تم إنشاؤه بواسطة نظام إدارة الجودياء - ${toArabicNumerals(currentDate)}`
      : `Generated by elgoodia Management System - ${currentDate}`;
    doc.text(footerText, pageWidth / 2, doc.internal.pageSize.height - 3, { align: 'center' });
  }
};

const generatePDFTable = (
  doc: jsPDF,
  headers: string[],
  data: any[][],
  isRtl: boolean,
  fontLoaded: boolean,
  fontName: string
) => {
  const pageWidth = doc.internal.pageSize.width;
  const margin = 3;
  const numColumns = headers.length;
  const maxTableWidth = pageWidth - 2 * margin;
  const columnWidth = Math.min(12, maxTableWidth / numColumns);
  const fontSizeHead = 6;
  const fontSizeBody = 5;
  const cellPadding = 0.4;
  const columnStyles = headers.reduce((styles, _, i) => {
    styles[i] = {
      cellWidth: columnWidth,
      halign: 'center',
      fontStyle: 'bold',
      overflow: 'linebreak',
    };
    return styles;
  }, {});

  autoTable(doc, {
    head: [isRtl ? headers.slice().reverse() : headers],
    body: isRtl ? data.map(row => row.slice().reverse()) : data,
    theme: 'grid',
    startY: 14,
    margin: { top: 14, bottom: 8, left: margin, right: margin },
    tableWidth: 'auto',
    columnStyles,
    headStyles: {
      fillColor: [245, 158, 11],
      textColor: [255, 255, 255],
      fontSize: fontSizeHead,
      halign: 'center',
      font: fontLoaded ? fontName : 'helvetica',
      fontStyle: 'bold',
      cellPadding,
    },
    bodyStyles: {
      fontSize: fontSizeBody,
      halign: 'center',
      font: fontLoaded ? fontName : 'helvetica',
      textColor: [33, 33, 33],
      lineColor: [200, 200, 200],
      fillColor: [255, 255, 255],
      cellPadding,
    },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' || hookData.section === 'head') {
        hookData.cell.text = hookData.cell.text.map(text => {
          let processedText = text;
          if (isRtl && !text.includes('%')) {
            processedText = String(processedText).replace(/[0-9]/g, d => toArabicNumerals(d));
          }
          return processedText;
        });
      }
      if (hookData.section === 'body' && hookData.column.index >= (isRtl ? 0 : headers.length - 3)) {
        hookData.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawPage: () => {
      doc.setFont(fontLoaded ? fontName : 'helvetica', 'normal');
    },
  });
};

const exportToPDF = async (
  data: any[][],
  title: string,
  monthName: string,
  headers: string[],
  isRtl: boolean,
  totalItems: number,
  totalOrders: number,
  totalReturns: number
) => {
  try {
    toast.info(isRtl ? 'جارٍ إنشاء ملف PDF...' : 'Generating PDF...', {
      position: isRtl ? 'top-left' : 'top-right',
      autoClose: false,
      toastId: 'pdf-export',
    });
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const fontName = 'Amiri';
    const fontLoaded = await loadFont(doc);
    generatePDFHeader(doc, isRtl, title, monthName, totalItems, totalOrders, totalReturns, fontName, fontLoaded);
    generatePDFTable(doc, headers, data, isRtl, fontLoaded, fontName);
    const fileName = generateFileName(title, monthName, isRtl, 'pdf');
    doc.save(fileName);
    toast.update('pdf-export', {
      render: isRtl ? 'تم تصدير ملف PDF بنجاح' : 'PDF exported successfully',
      type: 'success',
      autoClose: 3000,
    });
  } catch (error) {
    console.error('Error exporting PDF:', error);
    toast.update('pdf-export', {
      render: isRtl ? 'فشل في تصدير ملف PDF' : 'Failed to export PDF',
      type: 'error',
      autoClose: 3000,
    });
  }
};

const exportToExcel = (
  rows: any[],
  headers: string[],
  monthName: string,
  isRtl: boolean
) => {
  toast.info(isRtl ? 'جارٍ إنشاء ملف Excel...' : 'Generating Excel...', {
    position: isRtl ? 'top-left' : 'top-right',
    autoClose: false,
    toastId: 'excel-export',
  });
  try {
    const sheetData = isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows;
    const sheetHeaders = isRtl ? headers.slice().reverse() : headers;
    const ws = XLSX.utils.json_to_sheet(sheetData, { header: sheetHeaders });
    if (isRtl) {
      ws['!views'] = [{ RTL: true }];
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Orders_vs_Returns_${monthName}`);
    XLSX.writeFile(wb, generateFileName('Orders_vs_Returns', monthName, isRtl, 'xlsx'));
    toast.update('excel-export', {
      render: isRtl ? 'تم تصدير ملف Excel بنجاح' : 'Excel exported successfully',
      type: 'success',
      autoClose: 3000,
    });
  } catch (error) {
    console.error('Error exporting Excel:', error);
    toast.update('excel-export', {
      render: isRtl ? 'فشل في تصدير ملف Excel' : 'Failed to export Excel',
      type: 'error',
      autoClose: 3000,
    });
  }
};

// Data interface
interface OrdersVsReturnsRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  dailyOrders: number[];
  dailyReturns: number[];
  dailyBranchDetailsOrders: { [branch: string]: number }[];
  dailyBranchDetailsReturns: { [branch: string]: number }[];
  totalOrders: number;
  totalReturns: number;
  totalRatio: number;
  displayedDailyOrders: number[];
  displayedDailyReturns: number[];
  displayedDailyBranchDetailsOrders: { [branch: string]: number }[];
  displayedDailyBranchDetailsReturns: { [branch: string]: number }[];
  displayedTotalOrders: number;
  displayedTotalReturns: number;
  displayedTotalRatio: number;
}

interface Branch {
  _id: string;
  name: string;
  nameEn: string;
  displayName: string;
}

// Memoized TableRow component
const TableRow = memo(
  ({
    row,
    index,
    displayedDays,
    isRtl,
    selectedBranch,
    getTooltipContent,
    getRatioColor,
  }: {
    row: OrdersVsReturnsRow;
    index: number;
    displayedDays: string[];
    isRtl: boolean;
    selectedBranch: string;
    getTooltipContent: (dailyQuantity: number, branchDetails: { [branch: string]: number }, isRtl: boolean, type: string) => string;
    getRatioColor: (ratio: number) => string;
  }) => {
    const totalRatio = row.displayedTotalRatio;
    return (
      <tr className={`hover:bg-amber-50/30 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
        <td className="px-0.5 py-1 text-gray-700 text-center text-2xs">{formatNumber(index + 1, isRtl)}</td>
        <td className="px-0.5 py-1 text-gray-700 text-center text-2xs truncate max-w-[40px]">{row.code}</td>
        <td className="px-0.5 py-1 text-gray-700 text-center text-2xs truncate max-w-[100px]">{row.product}</td>
        <td className="px-0.5 py-1 text-gray-700 text-center text-2xs truncate max-w-[40px]">{row.unit}</td>
        {displayedDays.map((_, i) => {
          const dailyRatio = row.displayedDailyOrders[i] > 0 ? (row.displayedDailyReturns[i] / row.displayedDailyOrders[i] * 100) : 0;
          const dailyTotal = Math.abs(row.displayedDailyOrders[i] - row.displayedDailyReturns[i]);
          return (
            <Fragment key={i}>
              <td
                className={`px-0.5 py-1 text-center text-2xs font-medium ${row.displayedDailyOrders[i] > 0 ? 'bg-green-50/30 text-green-600' : 'text-gray-700'}`}
                data-tooltip-id="orders-tooltip"
                data-tooltip-content={getTooltipContent(row.displayedDailyOrders[i], selectedBranch === 'all' ? row.displayedDailyBranchDetailsOrders[i] : {}, isRtl, 'orders')}
              >
                {row.displayedDailyOrders[i] !== 0 ? formatNumber(row.displayedDailyOrders[i], isRtl, 'orders') : '-'}
              </td>
              <td
                className={`px-0.5 py-1 text-center text-2xs font-medium ${row.displayedDailyReturns[i] > 0 ? 'bg-red-50/30 text-red-600' : 'text-gray-700'}`}
                data-tooltip-id="returns-tooltip"
                data-tooltip-content={getTooltipContent(row.displayedDailyReturns[i], selectedBranch === 'all' ? row.displayedDailyBranchDetailsReturns[i] : {}, isRtl, 'returns')}
              >
                {row.displayedDailyReturns[i] !== 0 ? formatNumber(row.displayedDailyReturns[i], isRtl, 'returns') : '-'}
              </td>
              <td className={`px-0.5 py-1 text-center text-2xs font-medium ${getRatioColor(dailyRatio)}`}>
                {formatNumber(dailyTotal, isRtl, 'total')}
              </td>
            </Fragment>
          );
        })}
        <td className="px-0.5 py-1 text-gray-700 text-center text-2xs font-medium">{formatNumber(row.displayedTotalOrders, isRtl)}</td>
        <td className="px-0.5 py-1 text-gray-700 text-center text-2xs font-medium">{formatNumber(row.displayedTotalReturns, isRtl)}</td>
        <td className={`px-0.5 py-1 text-center text-2xs font-medium ${getRatioColor(totalRatio)}`}>
          {formatNumber(totalRatio.toFixed(2), isRtl, 'ratio')}%
        </td>
      </tr>
    );
  }
);

// Main ReturnsVsOrdersPage component
const ReturnsVsOrdersPage: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentDay = currentDate.getDate();
  const initialWeek = `week${Math.ceil(currentDay / 7)}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentDate.getMonth().toString());
  const [ordersVsReturnsData, setOrdersVsReturnsData] = useState<{ [month: number]: OrdersVsReturnsRow[] }>({});
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>(initialWeek);
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    value: i.toString(),
    label: new Date(currentYear, i).toLocaleString(language, { month: 'long' }),
  })), [currentYear, language]);

  const monthName = useMemo(() => months.find(m => m.value === selectedMonth)?.label || '', [months, selectedMonth]);

  const daysInMonth = useMemo(() => {
    const daysInMonthCount = new Date(currentYear, parseInt(selectedMonth) + 1, 0).getDate();
    return Array.from({ length: daysInMonthCount }, (_, i) => new Date(currentYear, parseInt(selectedMonth), i + 1).toLocaleString(language, { day: 'numeric' }));
  }, [selectedMonth, language, currentYear]);

  const daysInMonthCount = daysInMonth.length;

  const branchOptions = useMemo(() => [
    { value: 'all', label: isRtl ? 'كل الفروع' : 'All Branches' },
    ...branches.map(b => ({ value: b.displayName, label: b.displayName })).sort((a, b) => a.label.localeCompare(b.label)),
  ], [branches, isRtl]);

  const periodOptions = useMemo(() => [
    { value: 'all', label: isRtl ? 'الشهر كامل' : 'Full Month' },
    { value: 'week1', label: isRtl ? 'الأسبوع الأول' : 'Week 1' },
    { value: 'week2', label: isRtl ? 'الأسبوع الثاني' : 'Week 2' },
    { value: 'week3', label: isRtl ? 'الأسبوع الثالث' : 'Week 3' },
    { value: 'week4', label: isRtl ? 'الأسبوع الرابع' : 'Week 4' },
    { value: 'custom', label: isRtl ? 'فترة مخصصة' : 'Custom Period' },
  ], [isRtl]);

  const { startDay, endDay } = useMemo(() => {
    let s = 1, e = daysInMonthCount;
    if (selectedPeriod === 'week1') { s = 1; e = Math.min(7, daysInMonthCount); }
    else if (selectedPeriod === 'week2') { s = 8; e = Math.min(14, daysInMonthCount); }
    else if (selectedPeriod === 'week3') { s = 15; e = Math.min(21, daysInMonthCount); }
    else if (selectedPeriod === 'week4') { s = 22; e = daysInMonthCount; }
    else if (selectedPeriod === 'custom' && customStart && customEnd) {
      s = new Date(customStart).getDate();
      e = new Date(customEnd).getDate();
      if (s > e) [s, e] = [e, s];
    }
    return { startDay: s, endDay: e };
  }, [selectedPeriod, customStart, customEnd, daysInMonthCount]);

  const displayedDays = useMemo(() => daysInMonth.slice(startDay - 1, endDay), [daysInMonth, startDay, endDay]);

  const fetchData = useCallback(async () => {
    if (!user || (user.role !== 'admin' && user.role !== 'production')) {
      toast.error(isRtl ? 'لا يوجد صلاحية' : 'No access', {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [ordersResponse, branchesResponse, returnsResponse] = await Promise.all([
        ordersAPI.getAll({ page: 1, limit: 5000 }, isRtl),
        branchesAPI.getAll(),
        returnsAPI.getAll({ page: 1, limit: 5000 }),
      ]);

      const monthlyOrdersVsReturnsData: { [month: number]: OrdersVsReturnsRow[] } = {};
      const fetchedBranches = branchesResponse
        .filter((branch: any) => branch && branch._id)
        .map((branch: any) => ({
          _id: branch._id,
          name: branch.name || (isRtl ? 'غير معروف' : 'Unknown'),
          nameEn: branch.nameEn || branch.name,
          displayName: isRtl ? branch.name : branch.nameEn || branch.name,
        }))
        .sort((a: Branch, b: Branch) => a.displayName.localeCompare(b.displayName, language));
      setBranches(fetchedBranches);
      const branchMap = new Map<string, string>(fetchedBranches.map(b => [b._id, b.displayName]));

      const productDetails = new Map<string, { code: string; product: string; unit: string }>();
      let allOrders = Array.isArray(ordersResponse) ? ordersResponse : [];
      let allReturns = returnsResponse.returns || [];

      allOrders.forEach((order: any) => {
        (order.items || []).forEach((item: any) => {
          const productId = item.product?._id || item.productId;
          if (productId && !productDetails.has(productId)) {
            productDetails.set(productId, {
              code: item.product?.code || `code-${Math.random().toString(36).substring(2)}`,
              product: isRtl ? (item.product?.name || 'منتج غير معروف') : (item.product?.nameEn || item.product?.name || 'Unknown Product'),
              unit: isRtl ? (item.product?.unit || 'غير محدد') : (item.product?.unitEn || item.product?.unit || 'N/A'),
            });
          }
        });
      });

      for (let month = 0; month < 12; month++) {
        const daysInMonthCount = new Date(currentYear, month + 1, 0).getDate();
        const orderMap = new Map<string, { dailyOrders: number[], dailyBranchDetailsOrders: { [branch: string]: number }[], totalOrders: number, code: string, product: string, unit: string }>();
        const returnMap = new Map<string, { dailyReturns: number[], dailyBranchDetailsReturns: { [branch: string]: number }[], totalReturns: number }>();

        allOrders.forEach((order: any) => {
          const date = new Date(order.createdAt || order.date);
          if (isNaN(date.getTime())) return;
          const orderMonth = date.getMonth();
          const year = date.getFullYear();
          if (year === currentYear && orderMonth === month) {
            const day = date.getDate() - 1;
            const branchId = order.branch?._id || order.branch || order.branchId;
            const branch = branchMap.get(branchId) || (isRtl ? 'الفرع الرئيسي' : 'Main Branch');
            (order.items || []).forEach((item: any) => {
              const productId = item.product?._id || item.productId;
              if (!productId) return;
              const details = productDetails.get(productId) || {
                code: `code-${Math.random().toString(36).substring(2)}`,
                product: isRtl ? 'منتج غير معروف' : 'Unknown Product',
                unit: isRtl ? 'غير محدد' : 'N/A',
              };
              const key = `${productId}-${month}`;
              if (!orderMap.has(key)) {
                orderMap.set(key, {
                  dailyOrders: Array(daysInMonthCount).fill(0),
                  dailyBranchDetailsOrders: Array.from({ length: daysInMonthCount }, () => ({})),
                  totalOrders: 0,
                  code: details.code,
                  product: details.product,
                  unit: details.unit,
                });
              }
              const row = orderMap.get(key)!;
              const quantity = Number(item.quantity) || 0;
              row.dailyOrders[day] += quantity;
              row.dailyBranchDetailsOrders[day][branch] = (row.dailyBranchDetailsOrders[day][branch] || 0) + quantity;
              row.totalOrders += quantity;
            });
          }
        });

        allReturns.forEach((returnItem: any) => {
          if (returnItem.status !== 'approved') return;
          const date = new Date(returnItem.createdAt);
          if (isNaN(date.getTime())) return;
          const retMonth = date.getMonth();
          const year = date.getFullYear();
          if (year === currentYear && retMonth === month) {
            const day = date.getDate() - 1;
            const branchId = returnItem.branch?._id || returnItem.branchId;
            const branch = branchMap.get(branchId) || (isRtl ? 'الفرع الرئيسي' : 'Main Branch');
            (returnItem.items || []).forEach((item: any) => {
              const productId = item.product?._id || item.product;
              if (!productId) return;
              const details = productDetails.get(productId) || {
                code: `code-${Math.random().toString(36).substring(2)}`,
                product: isRtl ? 'منتج غير معروف' : 'Unknown Product',
                unit: isRtl ? 'غير محدد' : 'N/A',
              };
              const key = `${productId}-${month}`;
              if (!returnMap.has(key)) {
                returnMap.set(key, {
                  dailyReturns: Array(daysInMonthCount).fill(0),
                  dailyBranchDetailsReturns: Array.from({ length: daysInMonthCount }, () => ({})),
                  totalReturns: 0,
                });
              }
              const row = returnMap.get(key)!;
              const quantity = Number(item.quantity) || 0;
              row.dailyReturns[day] += quantity;
              row.dailyBranchDetailsReturns[day][branch] = (row.dailyBranchDetailsReturns[day][branch] || 0) + quantity;
              row.totalReturns += quantity;
            });
          }
        });

        const productKeys = new Set<string>();
        orderMap.forEach((_, key) => productKeys.add(key));
        returnMap.forEach((_, key) => productKeys.add(key));

        const ordersVsReturnsMap = new Map<string, OrdersVsReturnsRow>();
        productKeys.forEach((key) => {
          const ordersRow = orderMap.get(key) || {
            dailyOrders: Array(daysInMonthCount).fill(0),
            dailyBranchDetailsOrders: Array.from({ length: daysInMonthCount }, () => ({})),
            totalOrders: 0,
            code: '',
            product: '',
            unit: '',
          };
          const returnsRow = returnMap.get(key) || {
            dailyReturns: Array(daysInMonthCount).fill(0),
            dailyBranchDetailsReturns: Array.from({ length: daysInMonthCount }, () => ({})),
            totalReturns: 0,
          };
          const totalRatio = ordersRow.totalOrders > 0 ? (returnsRow.totalReturns / ordersRow.totalOrders) * 100 : 0;
          ordersVsReturnsMap.set(key, {
            id: key,
            code: ordersRow.code,
            product: ordersRow.product,
            unit: ordersRow.unit,
            dailyOrders: ordersRow.dailyOrders,
            dailyReturns: returnsRow.dailyReturns,
            dailyBranchDetailsOrders: ordersRow.dailyBranchDetailsOrders,
            dailyBranchDetailsReturns: returnsRow.dailyBranchDetailsReturns,
            totalOrders: ordersRow.totalOrders,
            totalReturns: returnsRow.totalReturns,
            totalRatio,
            displayedDailyOrders: [],
            displayedDailyReturns: [],
            displayedDailyBranchDetailsOrders: [],
            displayedDailyBranchDetailsReturns: [],
            displayedTotalOrders: 0,
            displayedTotalReturns: 0,
            displayedTotalRatio: 0,
          });
        });

        monthlyOrdersVsReturnsData[month] = Array.from(ordersVsReturnsMap.values()).sort((a, b) => b.totalRatio - a.totalRatio);
      }

      setOrdersVsReturnsData(monthlyOrdersVsReturnsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error(isRtl ? 'فشل في جلب البيانات' : 'Failed to fetch data', {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    } finally {
      setLoading(false);
    }
  }, [isRtl, currentYear, selectedMonth, language, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredData = useMemo(() => {
    const data = ordersVsReturnsData[parseInt(selectedMonth)] || [];
    return data
      .filter(row => row.product.toLowerCase().includes(searchTerm.toLowerCase()) || row.code.toLowerCase().includes(searchTerm.toLowerCase()))
      .map(row => {
        let displayedDailyOrders = row.dailyOrders.slice(startDay - 1, endDay);
        let displayedDailyBranchDetailsOrders = row.dailyBranchDetailsOrders.slice(startDay - 1, endDay);
        let displayedDailyReturns = row.dailyReturns.slice(startDay - 1, endDay);
        let displayedDailyBranchDetailsReturns = row.dailyBranchDetailsReturns.slice(startDay - 1, endDay);
        if (selectedBranch !== 'all') {
          displayedDailyOrders = displayedDailyOrders.map((_, i) => displayedDailyBranchDetailsOrders[i][selectedBranch] || 0);
          displayedDailyReturns = displayedDailyReturns.map((_, i) => displayedDailyBranchDetailsReturns[i][selectedBranch] || 0);
        }
        const displayedTotalOrders = displayedDailyOrders.reduce((sum, q) => sum + q, 0);
        const displayedTotalReturns = displayedDailyReturns.reduce((sum, q) => sum + q, 0);
        const displayedTotalRatio = displayedTotalOrders > 0 ? (displayedTotalReturns / displayedTotalOrders * 100) : 0;
        return {
          ...row,
          displayedDailyOrders,
          displayedDailyReturns,
          displayedDailyBranchDetailsOrders,
          displayedDailyBranchDetailsReturns,
          displayedTotalOrders,
          displayedTotalReturns,
          displayedTotalRatio,
        };
      }).sort((a, b) => b.displayedTotalRatio - a.displayedTotalRatio);
  }, [ordersVsReturnsData, selectedMonth, searchTerm, selectedBranch, startDay, endDay]);

  const grandTotalOrders = useMemo(() => filteredData.reduce((sum, row) => sum + row.displayedTotalOrders, 0), [filteredData]);
  const grandTotalReturns = useMemo(() => filteredData.reduce((sum, row) => sum + row.displayedTotalReturns, 0), [filteredData]);
  const grandTotalRatio = useMemo(() => grandTotalOrders > 0 ? ((grandTotalReturns / grandTotalOrders) * 100).toFixed(2) : '0.00', [grandTotalOrders, grandTotalReturns]);

  const getTooltipContent = (dailyQuantity: number, branchDetails: { [branch: string]: number }, isRtl: boolean, type: string) => {
    let header = type === 'orders' ? (isRtl ? 'طلبات' : 'Orders') : (isRtl ? 'مرتجعات' : 'Returns');
    let content = `${header}: ${type === 'orders' ? (dailyQuantity > 0 ? '+' : '') : (dailyQuantity > 0 ? '-' : '')}${formatNumber(dailyQuantity, isRtl)}`;
    if (Object.keys(branchDetails).length > 0) {
      content += '\n' + Object.entries(branchDetails).sort(([a], [b]) => a.localeCompare(b)).map(([branch, qty]) => `${branch}: ${qty > 0 ? '+' : ''}${formatNumber(qty, isRtl)}`).join('\n');
    }
    return content;
  };

  const getRatioColor = (ratio: number) => {
    if (ratio > 10) return 'text-red-600 bg-red-50/30';
    if (ratio > 5) return 'text-yellow-600 bg-yellow-50/30';
    return 'text-green-600 bg-green-50/30';
  };

  const exportTable = (format: 'excel' | 'pdf') => {
    const baseHeaders = [
      isRtl ? 'رقم' : 'No.',
      isRtl ? 'الكود' : 'Code',
      isRtl ? 'المنتج' : 'Product',
      isRtl ? 'وحدة المنتج' : 'Product Unit',
    ];
    const dayHeaders = displayedDays.flatMap(day => [
      isRtl ? `${day} - طلبات` : `${day} - Orders`,
      isRtl ? `${day} - مرتجعات` : `${day} - Returns`,
      isRtl ? `${day} - إجمالي` : `${day} - Total`,
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
          displayedDays.flatMap((day, i) => [
            [`${day} - ${isRtl ? 'طلبات' : 'Orders'}`, row.displayedDailyOrders[i] !== 0 ? formatNumber(row.displayedDailyOrders[i], isRtl, 'orders') : '-'],
            [`${day} - ${isRtl ? 'مرتجعات' : 'Returns'}`, row.displayedDailyReturns[i] !== 0 ? formatNumber(row.displayedDailyReturns[i], isRtl, 'returns') : '-'],
            [`${day} - ${isRtl ? 'إجمالي' : 'Total'}`, Math.abs(row.displayedDailyOrders[i] - row.displayedDailyReturns[i])],
          ])
        ),
        totalOrders: row.displayedTotalOrders,
        totalReturns: row.displayedTotalReturns,
        totalRatio: row.displayedTotalRatio.toFixed(2),
      })),
      {
        no: '',
        code: '',
        product: isRtl ? 'الإجمالي' : 'Total',
        unit: '',
        ...Object.fromEntries(
          displayedDays.flatMap((day, i) => [
            [`${day} - ${isRtl ? 'طلبات' : 'Orders'}`, filteredData.reduce((sum, row) => sum + row.displayedDailyOrders[i], 0)],
            [`${day} - ${isRtl ? 'مرتجعات' : 'Returns'}`, filteredData.reduce((sum, row) => sum + row.displayedDailyReturns[i], 0)],
            [`${day} - ${isRtl ? 'إجمالي' : 'Total'}`, Math.abs(filteredData.reduce((sum, row) => sum + row.displayedDailyOrders[i], 0) - filteredData.reduce((sum, row) => sum + row.displayedDailyReturns[i], 0))],
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
      exportToExcel(rows, headers, monthName, isRtl);
    } else if (format === 'pdf') {
      exportToPDF(dataRows, isRtl ? 'تقرير حركة الطلبات مقابل المرتجعات' : 'Orders vs Returns Report', monthName, headers, isRtl, filteredData.length, grandTotalOrders, grandTotalReturns);
    }
  };

  if (!user || (user.role !== 'admin' && user.role !== 'production')) {
    return (
      <div className="text-center py-8 text-2xs font-medium text-gray-700 max-w-6xl mx-auto">
        {isRtl ? 'لا يوجد صلاحية' : 'No access'}
      </div>
    );
  }

  return (
    <div className={`min-h-screen px-2 py-4 max-w-6xl mx-auto ${isRtl ? 'rtl' : 'ltr'}`}>
      <div className="mb-3 bg-white shadow-sm rounded-lg p-2 border border-gray-50">
        <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <h2 className="text-sm font-bold text-gray-800 truncate">
            {isRtl ? 'تقرير حركة الطلبات مقابل المرتجعات' : 'Orders vs Returns Report'} - {monthName}
          </h2>
          <div className="flex gap-1.5 items-center flex-wrap">
            <ProductDropdown
              value={selectedMonth}
              onChange={setSelectedMonth}
              options={months}
              ariaLabel={isRtl ? 'اختر الشهر' : 'Select month'}
              className="w-28 sm:w-32"
            />
            <Button
              variant={filteredData.length > 0 ? 'primary' : 'secondary'}
              onClick={filteredData.length > 0 ? () => exportTable('excel') : undefined}
              disabled={filteredData.length === 0}
              className="flex items-center gap-1"
            >
              <Upload className="w-2.5 h-2.5" />
              {isRtl ? 'Excel' : 'Excel'}
            </Button>
            <Button
              variant={filteredData.length > 0 ? 'primary' : 'secondary'}
              onClick={filteredData.length > 0 ? () => exportTable('pdf') : undefined}
              disabled={filteredData.length === 0}
              className="flex items-center gap-1"
            >
              <Upload className="w-2.5 h-2.5" />
              {isRtl ? 'PDF' : 'PDF'}
            </Button>
          </div>
        </div>
        <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 items-center mb-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <ProductSearchInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isRtl ? 'بحث حسب المنتج أو الكود' : 'Search by product or code'}
            ariaLabel={isRtl ? 'بحث المنتج' : 'Product search'}
            className="max-w-none"
          />
          <ProductDropdown
            value={selectedBranch}
            onChange={setSelectedBranch}
            options={branchOptions}
            ariaLabel={isRtl ? 'اختر الفرع' : 'Select branch'}
            className="max-w-none"
          />
          <ProductDropdown
            value={selectedPeriod}
            onChange={setSelectedPeriod}
            options={periodOptions}
            ariaLabel={isRtl ? 'اختر الفترة' : 'Select period'}
            className="max-w-none"
          />
          {selectedPeriod === 'custom' && (
            <div className="col-span-1 sm:col-span-2 md:col-span-3 flex flex-col sm:flex-row gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="flex-1 px-1.5 py-1 border border-gray-200 rounded-lg focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 bg-white shadow-sm hover:shadow-md text-2xs"
              />
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="flex-1 px-1.5 py-1 border border-gray-200 rounded-lg focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 bg-white shadow-sm hover:shadow-md text-2xs"
              />
            </div>
          )}
        </div>
      </div>
      {loading ? (
        <OrderTableSkeleton isRtl={isRtl} />
      ) : filteredData.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center py-8 bg-white shadow-sm rounded-lg border border-gray-50"
        >
          <p className="text-gray-500 text-2xs font-medium">{isRtl ? 'لا توجد بيانات' : 'No data available'}</p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="overflow-x-auto rounded-lg shadow-sm border border-gray-50 bg-white"
        >
          <table className="min-w-full divide-y divide-gray-50 text-2xs">
            <thead className="bg-amber-50/50 sticky top-0 z-10">
              <tr className={isRtl ? 'flex-row-reverse' : ''}>
                <th className="px-0.5 py-1 font-semibold text-gray-700 text-center min-w-[25px] text-xs">{isRtl ? 'رقم' : 'No.'}</th>
                <th className="px-0.5 py-1 font-semibold text-gray-700 text-center min-w-[40px] text-xs">{isRtl ? 'الكود' : 'Code'}</th>
                <th className="px-0.5 py-1 font-semibold text-gray-700 text-center min-w-[100px] text-xs">{isRtl ? 'المنتج' : 'Product'}</th>
                <th className="px-0.5 py-1 font-semibold text-gray-700 text-center min-w-[40px] text-xs">{isRtl ? 'وحدة المنتج' : 'Product Unit'}</th>
                {displayedDays.map((day, i) => (
                  <Fragment key={i}>
                    <th className="px-0.5 py-1 font-semibold text-gray-700 text-center min-w-[25px] text-xs">
                      {isRtl ? `${day} - طلبات` : `${day} - Orders`}
                    </th>
                    <th className="px-0.5 py-1 font-semibold text-gray-700 text-center min-w-[25px] text-xs">
                      {isRtl ? `${day} - مرتجعات` : `${day} - Returns`}
                    </th>
                    <th className="px-0.5 py-1 font-semibold text-gray-700 text-center min-w-[25px] text-xs">
                      {isRtl ? `${day} - إجمالي` : `${day} - Total`}
                    </th>
                  </Fragment>
                ))}
                <th className="px-0.5 py-1 font-semibold text-gray-700 text-center min-w-[60px] text-xs">
                  {isRtl ? 'إجمالي الطلبات' : 'Total Orders'}
                </th>
                <th className="px-0.5 py-1 font-semibold text-gray-700 text-center min-w-[60px] text-xs">
                  {isRtl ? 'إجمالي المرتجعات' : 'Total Returns'}
                </th>
                <th className="px-0.5 py-1 font-semibold text-gray-700 text-center min-w-[60px] text-xs">
                  {isRtl ? 'نسبة إجمالية %' : 'Total Ratio %'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredData.map((row, index) => (
                <TableRow
                  key={row.id}
                  row={row}
                  index={index}
                  displayedDays={displayedDays}
                  isRtl={isRtl}
                  selectedBranch={selectedBranch}
                  getTooltipContent={getTooltipContent}
                  getRatioColor={getRatioColor}
                />
              ))}
              <tr className={`font-semibold bg-gray-50/30 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <td className="px-0.5 py-1 text-gray-800 text-center text-2xs" colSpan={4}>{isRtl ? 'الإجمالي' : 'Total'}</td>
                {displayedDays.map((_, i) => (
                  <Fragment key={i}>
                    <td className="px-0.5 py-1 text-gray-800 text-center text-2xs">
                      {formatNumber(filteredData.reduce((sum, row) => sum + row.displayedDailyOrders[i], 0), isRtl, 'orders')}
                    </td>
                    <td className="px-0.5 py-1 text-gray-800 text-center text-2xs">
                      {formatNumber(filteredData.reduce((sum, row) => sum + row.displayedDailyReturns[i], 0), isRtl, 'returns')}
                    </td>
                    <td className="px-0.5 py-1 text-gray-800 text-center text-2xs">
                      {formatNumber(Math.abs(filteredData.reduce((sum, row) => sum + row.displayedDailyOrders[i], 0) - filteredData.reduce((sum, row) => sum + row.displayedDailyReturns[i], 0)), isRtl, 'total')}
                    </td>
                  </Fragment>
                ))}
                <td className="px-0.5 py-1 text-gray-800 text-center text-2xs">{formatNumber(grandTotalOrders, isRtl)}</td>
                <td className="px-0.5 py-1 text-gray-800 text-center text-2xs">{formatNumber(grandTotalReturns, isRtl)}</td>
                <td className="px-0.5 py-1 text-gray-800 text-center text-2xs">{formatNumber(Number(grandTotalRatio), isRtl, 'ratio')}%</td>
              </tr>
            </tbody>
          </table>
          <Tooltip
            id="orders-tooltip"
            place="top"
            className="custom-tooltip whitespace-pre-line z-[9999] shadow-sm bg-white border border-gray-100 rounded-md p-1.5 max-w-xs text-2xs text-gray-800 font-medium"
          />
          <Tooltip
            id="returns-tooltip"
            place="top"
            className="custom-tooltip whitespace-pre-line z-[9999] shadow-sm bg-white border border-gray-100 rounded-md p-1.5 max-w-xs text-2xs text-gray-800 font-medium"
          />
        </motion.div>
      )}
    </div>
  );
};

export default ReturnsVsOrdersPage;