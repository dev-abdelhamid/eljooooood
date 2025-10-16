import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ChevronDown, Upload } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'react-toastify';
import { Tooltip } from 'react-tooltip';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Button component (for export buttons)
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
      className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
        variant === 'primary' && !disabled
          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
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
}> = ({ value, onChange, placeholder, ariaLabel }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';

  const handleClear = () => {
    onChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>);
  };

  return (
    <div className="relative group w-full max-w-xs">
      <motion.div
        className={`absolute inset-y-0 ${isRtl ? 'right-3 pr-3' : 'left-3 pl-3'} flex items-center text-gray-400 transition-colors group-focus-within:text-amber-500`}
        initial={false}
        animate={{ opacity: value ? 0 : 1, scale: value ? 0.8 : 1 }}
        transition={{ duration: 0.2 }}
      >
        <Search className="w-5 h-5" />
      </motion.div>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full ${isRtl ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all duration-300 bg-white shadow-md hover:shadow-lg text-sm placeholder-gray-500 font-medium ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={ariaLabel}
      />
      {value && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          onClick={handleClear}
          className={`absolute inset-y-0 ${isRtl ? 'left-3 pl-3' : 'right-3 pr-3'} flex items-center text-gray-400 hover:text-amber-500 transition-colors focus:outline-none`}
          aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
        >
          <X className="w-5 h-5" />
        </motion.button>
      )}
    </div>
  );
};

// ProductDropdown component
const ProductDropdown: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
  disabled?: boolean;
}> = ({ value, onChange, options, ariaLabel, disabled = false }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((opt) => opt.value === value) || options[0] || { value: '', label: isRtl ? 'اختر' : 'Select' };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative w-full max-w-xs">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all duration-300 bg-white shadow-md hover:shadow-lg text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex justify-between items-center ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={ariaLabel}
      >
        <span className="truncate">{selectedOption.label}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          <ChevronDown className="w-5 h-5 text-gray-500" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.ul
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute w-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-amber-400 scrollbar-track-gray-100"
          >
            {options.map((option) => (
              <li
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`px-4 py-3 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-600 cursor-pointer transition-all duration-200 font-medium ${option.value === value ? 'bg-amber-100 text-amber-700' : ''}`}
              >
                {option.label}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

// Utility functions
const toArabicNumerals = (number: string | number): string => {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(number).replace(/[0-9]/g, (digit) => arabicNumerals[parseInt(digit)]);
};

const formatPrice = (amount: number, isRtl: boolean): string => {
  const validAmount = (typeof amount === 'number' && !isNaN(amount)) ? amount : 0;
  const formatted = validAmount.toLocaleString(isRtl ? 'ar-SA' : 'en-US', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return isRtl ? formatted.replace(/\d/g, (d) => String.fromCharCode(0x0660 + parseInt(d))) : formatted;
};

const formatNumber = (num: number, isRtl: boolean): string => {
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
    doc.setFont('helvetica', 'normal');
    toast.error('Failed to load Amiri font, using default', {
      position: isRtl ? 'top-left' : 'top-right',
      autoClose: 3000,
    });
    return false;
  }
};

const generateFileName = (title: string, monthName: string, isRtl: boolean): string => {
  const date = new Date().toISOString().split('T')[0];
  return isRtl ? `${title}_${monthName}_${date}.pdf` : `${title}_${monthName}_${date}.pdf`;
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
  doc.setFont(fontLoaded ? fontName : 'helvetica', 'normal');
  doc.setFontSize(18);
  doc.setTextColor(33, 33, 33);
  const pageWidth = doc.internal.pageSize.width;
  doc.text(isRtl ? title : title, isRtl ? pageWidth - 20 : 20, 12, { align: isRtl ? 'right' : 'left' });
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  const stats = isRtl
    ? `إجمالي المنتجات: ${toArabicNumerals(totalItems)} | إجمالي الكمية: ${toArabicNumerals(totalQuantity)} وحدة | إجمالي المبلغ: ${formatPrice(totalPrice, isRtl)}`
    : `Total Products: ${totalItems} | Total Quantity: ${totalQuantity} units | Total Amount: ${formatPrice(totalPrice, isRtl)}`;
  doc.text(stats, isRtl ? pageWidth - 20 : 20, 20, { align: isRtl ? 'right' : 'left' });
  doc.setLineWidth(0.5);
  doc.setDrawColor(255, 193, 7);
  doc.line(20, 25, pageWidth - 20, 25);
  const pageCount = doc.getNumberOfPages();
  const currentDate = new Date().toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont(fontLoaded ? fontName : 'helvetica', 'normal');
    const footerText = isRtl
      ? `تم إنشاؤه بواسطة نظام إدارة الجودياء - ${toArabicNumerals(currentDate)}`
      : `Generated by elgoodia Management System - ${currentDate}`;
    doc.text(footerText, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
  }
};

const generatePDFTable = (
  doc: jsPDF,
  headers: string[],
  data: any[],
  isRtl: boolean,
  fontLoaded: boolean,
  fontName: string
) => {
  const tableColumnWidths = headers.map((_, index) => {
    if (index === 0) return 15; // No.
    if (index === 1) return 25; // Code
    if (index === 2) return 45; // Product
    if (index === 3) return 25; // Unit
    if (index >= 4 && index < headers.length - 2) return 20; // Daily Quantities
    return 30; // Total Quantity, Actual Sales, Total Price, Sales Percentage
  });
  autoTable(doc, {
    head: [isRtl ? headers.slice().reverse() : headers],
    body: isRtl ? data.map(row => row.slice().reverse()) : data,
    theme: 'grid',
    startY: 30,
    margin: { top: 10, bottom: 10, left: 10, right: 10 },
    tableWidth: 'wrap',
    columnStyles: Object.fromEntries(
      headers.map((_, i) => [i, { cellWidth: tableColumnWidths[i], halign: 'center' }])
    ),
    headStyles: {
      fillColor: [255, 193, 7],
      textColor: [33, 33, 33],
      fontSize: 10,
      halign: 'center',
      font: fontLoaded ? fontName : 'helvetica',
      fontStyle: 'bold',
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize: 9,
      halign: 'center',
      font: fontLoaded ? fontName : 'helvetica',
      textColor: [33, 33, 33],
      lineColor: [200, 200, 200],
      fillColor: [255, 255, 255],
      cellPadding: 3,
    },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index >= (isRtl ? 0 : headers.length - 2)) {
        data.cell.styles.fontStyle = 'bold';
      }
      if (isRtl) {
        data.cell.text = data.cell.text.map(text => String(text).replace(/[0-9]/g, d => toArabicNumerals(d)));
      }
    },
    didDrawPage: (data) => {
      doc.setFont(fontLoaded ? fontName : 'helvetica', 'normal');
    },
  });
};

const exportToPDF = async (
  data: any[],
  title: string,
  monthName: string,
  headers: string[],
  isRtl: boolean,
  totalItems: number,
  totalQuantity: number,
  totalPrice: number
) => {
  try {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const fontName = 'Amiri';
    const fontLoaded = await loadFont(doc);
    generatePDFHeader(doc, isRtl, title, monthName, totalItems, totalQuantity, totalPrice, fontName, fontLoaded);
    generatePDFTable(doc, headers, data, isRtl, fontLoaded, fontName);
    const fileName = generateFileName(title, monthName, isRtl);
    doc.save(fileName);
    toast.success(isRtl ? 'تم تصدير ملف PDF بنجاح' : 'PDF exported successfully', {
      position: isRtl ? 'top-left' : 'top-right',
      autoClose: 3000,
    });
  } catch (error) {
    console.error('Error exporting PDF:', error);
    toast.error(isRtl ? 'فشل في تصدير ملف PDF' : 'Failed to export PDF', {
      position: isRtl ? 'top-left' : 'top-right',
      autoClose: 3000,
    });
  }
};

// Sample data interface
interface OrderRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  totalQuantity: number;
  dailyQuantities: number[];
  dailyBranchDetails: { [branch: string]: number }[];
  totalPrice: number;
  actualSales: number;
}

// Main OrdersTablePage component
const OrdersTablePage: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const currentDate = new Date();
  const monthName = currentDate.toLocaleString(language, { month: 'long' });
  const daysInMonth = Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() }, (_, i) => {
    return new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1).toLocaleString(language, { day: 'numeric', month: 'short' });
  });

  // Sample data for demonstration
  const sampleData: OrderRow[] = [
    {
      id: '1',
      code: 'P001',
      product: isRtl ? 'منتج 1' : 'Product 1',
      unit: isRtl ? 'وحدة' : 'Unit',
      totalQuantity: 150,
      dailyQuantities: [5, 0, 10, 0, 15, 20, 0, 25, 0, 30, 0, 0, 10, 15, 0, 20, 0, 0, 0, 0, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      dailyBranchDetails: Array(31).fill({}).map(() => ({
        'Branch A': Math.floor(Math.random() * 10),
        'Branch B': Math.floor(Math.random() * 10),
      })),
      totalPrice: 1500,
      actualSales: 120,
    },
    {
      id: '2',
      code: 'P002',
      product: isRtl ? 'منتج 2' : 'Product 2',
      unit: isRtl ? 'وحدة' : 'Unit',
      totalQuantity: 200,
      dailyQuantities: [0, 10, 0, 15, 0, 20, 25, 0, 30, 0, 0, 10, 0, 15, 20, 0, 0, 0, 0, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      dailyBranchDetails: Array(31).fill({}).map(() => ({
        'Branch A': Math.floor(Math.random() * 10),
        'Branch B': Math.floor(Math.random() * 10),
      })),
      totalPrice: 2000,
      actualSales: 180,
    },
  ];

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const daysInMonthCount = daysInMonth.length;

  const allBranches = ['Branch A', 'Branch B'];

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

  const displayedDays = daysInMonth.slice(startDay - 1, endDay);

  const filteredData = useMemo(() => {
    return sampleData
      .filter(row => row.product.toLowerCase().includes(searchTerm.toLowerCase()))
      .map(row => {
        let displayedDailyQuantities = row.dailyQuantities.slice(startDay - 1, endDay);
        let displayedDailyBranchDetails = row.dailyBranchDetails.slice(startDay - 1, endDay);
        if (selectedBranch !== 'all') {
          displayedDailyQuantities = displayedDailyQuantities.map((_, i) => displayedDailyBranchDetails[i][selectedBranch] || 0);
        }
        const displayedTotalQuantity = displayedDailyQuantities.reduce((sum, q) => sum + q, 0);
        const displayedTotalPrice = displayedTotalQuantity * (row.totalPrice / row.totalQuantity || 0);
        return {
          ...row,
          displayedDailyQuantities,
          displayedDailyBranchDetails,
          displayedTotalQuantity,
          displayedTotalPrice,
        };
      }).sort((a, b) => b.displayedTotalQuantity - a.displayedTotalQuantity);
  }, [sampleData, searchTerm, selectedBranch, startDay, endDay]);

  const grandTotalQuantity = filteredData.reduce((sum, row) => sum + row.displayedTotalQuantity, 0);
  const grandTotalPrice = filteredData.reduce((sum, row) => sum + row.displayedTotalPrice, 0);
  const grandActualSales = filteredData.reduce((sum, row) => sum + row.actualSales, 0);

  const getTooltipContent = (dailyQuantity: number, branchDetails: { [branch: string]: number }, isRtl: boolean) => {
    let header = isRtl ? 'طلبات' : 'Orders';
    let content = `${header}: ${dailyQuantity > 0 ? '+' : ''}${formatNumber(dailyQuantity, isRtl)}`;
    if (Object.keys(branchDetails).length > 0) {
      content += '\n' + Object.entries(branchDetails).map(([branch, qty]) => `${branch}: ${qty > 0 ? '+' : ''}${formatNumber(qty, isRtl)}`).join('\n');
    }
    return content;
  };

  const branchOptions = useMemo(() => [
    { value: 'all', label: isRtl ? 'كل الفروع' : 'All Branches' },
    ...allBranches.map(branch => ({ value: branch, label: branch })),
  ], [allBranches, isRtl]);

  const periodOptions = useMemo(() => [
    { value: 'all', label: isRtl ? 'الشهر كامل' : 'Full Month' },
    { value: 'week1', label: isRtl ? 'الأسبوع الأول' : 'Week 1' },
    { value: 'week2', label: isRtl ? 'الأسبوع الثاني' : 'Week 2' },
    { value: 'week3', label: isRtl ? 'الأسبوع الثالث' : 'Week 3' },
    { value: 'week4', label: isRtl ? 'الأسبوع الرابع' : 'Week 4' },
    { value: 'custom', label: isRtl ? 'فترة مخصصة' : 'Custom Period' },
  ], [isRtl]);

  const exportTable = (format: 'excel' | 'pdf') => {
    const headers = [
      isRtl ? 'رقم' : 'No.',
      isRtl ? 'الكود' : 'Code',
      isRtl ? 'المنتج' : 'Product',
      isRtl ? 'وحدة المنتج' : 'Product Unit',
      ...displayedDays,
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
        ...Object.fromEntries(row.displayedDailyQuantities.map((qty, i) => [displayedDays[i], qty || ''])),
        totalQuantity: row.displayedTotalQuantity,
        actualSales: row.actualSales,
        totalPrice: formatPrice(row.displayedTotalPrice, isRtl),
        salesPercentage: row.displayedTotalQuantity > 0 ? ((row.actualSales / row.displayedTotalQuantity) * 100).toFixed(2) : '0.00',
      })),
      {
        no: '',
        code: '',
        product: isRtl ? 'الإجمالي' : 'Total',
        unit: '',
        ...Object.fromEntries(displayedDays.map((_, i) => [displayedDays[i], filteredData.reduce((sum, row) => sum + row.displayedDailyQuantities[i], 0)])),
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
      ...displayedDays.map(day => row[day]),
      row.totalQuantity,
      row.actualSales,
      row.totalPrice,
      `${row.salesPercentage}%`,
    ]);
    if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows, { header: headers });
      if (isRtl) ws['!views'] = [{ RTL: true }];
      ws['!cols'] = [{ wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, ...displayedDays.map(() => ({ wch: 12 })), { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Orders_${monthName}`);
      XLSX.writeFile(wb, `Orders_${monthName}.xlsx`);
      toast.success(isRtl ? 'تم تصدير ملف Excel بنجاح' : 'Excel exported successfully', {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    } else if (format === 'pdf') {
      exportToPDF(dataRows, isRtl ? 'تقرير الطلبات اليومية' : 'Daily Orders Report', monthName, headers, isRtl, filteredData.length, grandTotalQuantity, grandTotalPrice);
    }
  };

  return (
    <div className={`min-h-screen px-6 py-8 ${isRtl ? 'rtl font-amiri' : 'ltr font-inter'} bg-gray-50`}>
      <div className="mb-8 bg-white shadow-xl rounded-2xl p-6 border border-gray-200">
        <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <h2 className="text-xl font-bold text-gray-800">{isRtl ? 'تقرير الطلبات اليومية' : 'Daily Orders Report'} - {monthName}</h2>
          <div className="flex gap-3">
            <Button
              variant={filteredData.length > 0 ? 'primary' : 'secondary'}
              onClick={filteredData.length > 0 ? () => exportTable('excel') : undefined}
              disabled={filteredData.length === 0}
            >
              <Upload className="w-4 h-4" />
              {isRtl ? 'تصدير إكسل' : 'Export Excel'}
            </Button>
            <Button
              variant={filteredData.length > 0 ? 'primary' : 'secondary'}
              onClick={filteredData.length > 0 ? () => exportTable('pdf') : undefined}
              disabled={filteredData.length === 0}
            >
              <Upload className="w-4 h-4" />
              {isRtl ? 'تصدير PDF' : 'Export PDF'}
            </Button>
          </div>
        </div>
        <div className={`flex flex-wrap gap-4 mt-6 items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
          <ProductSearchInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isRtl ? 'بحث حسب المنتج' : 'Search by product'}
            ariaLabel={isRtl ? 'بحث المنتج' : 'Product search'}
          />
          <ProductDropdown
            value={selectedBranch}
            onChange={setSelectedBranch}
            options={branchOptions}
            ariaLabel={isRtl ? 'اختر الفرع' : 'Select branch'}
          />
          <ProductDropdown
            value={selectedPeriod}
            onChange={setSelectedPeriod}
            options={periodOptions}
            ariaLabel={isRtl ? 'اختر الفترة' : 'Select period'}
          />
          {selectedPeriod === 'custom' && (
            <>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all duration-300 bg-white shadow-md hover:shadow-lg text-sm"
              />
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all duration-300 bg-white shadow-md hover:shadow-lg text-sm"
              />
            </>
          )}
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-x-auto rounded-2xl shadow-xl border border-gray-200 bg-white"
      >
        <table className="min-w-full divide-y divide-gray-300 text-sm">
          <thead className="bg-amber-50 sticky top-0 z-10 shadow-sm">
            <tr className={isRtl ? 'flex-row-reverse' : ''}>
              <th className="px-6 py-4 font-bold text-gray-800 text-center min-w-[50px]">{isRtl ? 'رقم' : 'No.'}</th>
              <th className="px-6 py-4 font-bold text-gray-800 text-center min-w-[100px]">{isRtl ? 'الكود' : 'Code'}</th>
              <th className="px-6 py-4 font-bold text-gray-800 text-center min-w-[150px]">{isRtl ? 'المنتج' : 'Product'}</th>
              <th className="px-6 py-4 font-bold text-gray-800 text-center min-w-[100px]">{isRtl ? 'وحدة المنتج' : 'Product Unit'}</th>
              {displayedDays.map((day, i) => (
                <th key={i} className="px-6 py-4 font-bold text-gray-800 text-center min-w-[100px]">
                  {day}
                </th>
              ))}
              <th className="px-6 py-4 font-bold text-gray-800 text-center min-w-[120px]">
                {isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}
              </th>
              <th className="px-6 py-4 font-bold text-gray-800 text-center min-w-[120px]">
                {isRtl ? 'المبيعات الفعلية' : 'Actual Sales'}
              </th>
              <th className="px-6 py-4 font-bold text-gray-800 text-center min-w-[120px]">
                {isRtl ? 'السعر الإجمالي' : 'Total Price'}
              </th>
              <th className="px-6 py-4 font-bold text-gray-800 text-center min-w-[120px]">
                {isRtl ? 'نسبة المبيعات %' : 'Sales Percentage %'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredData.map((row, index) => (
              <tr key={row.id} className={`hover:bg-amber-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <td className="px-6 py-4 text-gray-700 text-center">{formatNumber(index + 1, isRtl)}</td>
                <td className="px-6 py-4 text-gray-700 text-center truncate">{row.code}</td>
                <td className="px-6 py-4 text-gray-700 text-center truncate">{row.product}</td>
                <td className="px-6 py-4 text-gray-700 text-center truncate">{row.unit}</td>
                {row.displayedDailyQuantities.map((qty, i) => (
                  <td
                    key={i}
                    className={`px-6 py-4 text-center font-medium ${
                      qty > 0 ? 'bg-green-100 text-green-800' : qty < 0 ? 'bg-red-100 text-red-800' : 'text-gray-700'
                    }`}
                    data-tooltip-id="order-tooltip"
                    data-tooltip-content={getTooltipContent(qty, selectedBranch === 'all' ? row.displayedDailyBranchDetails[i] : {}, isRtl)}
                  >
                    {qty !== 0 ? `${qty > 0 ? '+' : ''}${formatNumber(qty, isRtl)}` : ''}
                  </td>
                ))}
                <td className="px-6 py-4 text-gray-800 text-center font-bold">{formatNumber(row.displayedTotalQuantity, isRtl)}</td>
                <td className="px-6 py-4 text-gray-800 text-center font-bold">{formatNumber(row.actualSales, isRtl)}</td>
                <td className="px-6 py-4 text-gray-800 text-center font-bold">{formatPrice(row.displayedTotalPrice, isRtl)}</td>
                <td className="px-6 py-4 text-gray-800 text-center font-bold">
                  {formatNumber(row.displayedTotalQuantity > 0 ? ((row.actualSales / row.displayedTotalQuantity) * 100).toFixed(2) : '0.00', isRtl)}%
                </td>
              </tr>
            ))}
            <tr className={`font-bold bg-amber-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <td className="px-6 py-4 text-gray-900 text-center" colSpan={4}>{isRtl ? 'الإجمالي' : 'Total'}</td>
              {displayedDays.map((_, i) => (
                <td key={i} className="px-6 py-4 text-gray-900 text-center">
                  {formatNumber(filteredData.reduce((sum, row) => sum + row.displayedDailyQuantities[i], 0), isRtl)}
                </td>
              ))}
              <td className="px-6 py-4 text-gray-900 text-center">{formatNumber(grandTotalQuantity, isRtl)}</td>
              <td className="px-6 py-4 text-gray-900 text-center">{formatNumber(grandActualSales, isRtl)}</td>
              <td className="px-6 py-4 text-gray-900 text-center">{formatPrice(grandTotalPrice, isRtl)}</td>
              <td className="px-6 py-4 text-gray-900 text-center">
                {formatNumber(grandTotalQuantity > 0 ? ((grandActualSales / grandTotalQuantity) * 100).toFixed(2) : '0.00', isRtl)}%
              </td>
            </tr>
          </tbody>
        </table>
        <Tooltip id="order-tooltip" place="top" className="custom-tooltip whitespace-pre-line z-[100] shadow-xl bg-white border border-gray-200 rounded-lg p-3 max-w-xs text-sm" />
      </motion.div>
    </div>
  );
};

export default OrdersTablePage;
