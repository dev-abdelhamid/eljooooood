// ProductionReport.tsx

import React, { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/UI/Button';
import { Upload, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';
import { inventoryAPI, ordersAPI, branchesAPI, salesAPI } from '../services/api';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';
import { Tooltip } from 'react-tooltip';
import { OrdersTable } from './OrdersTable';
import { OrdersVsReturnsTable } from './OrdersVsReturnsTable';

interface OrderRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  price: number;
  dailyQuantities: number[];
  dailyBranchDetails: { [branch: string]: number }[];
  branchQuantities: { [branch: string]: number };
  totalQuantity: number;
  totalPrice: number;
  sales: number;
  actualSales: number;
}

interface StockRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  price: number;
  totalQuantity: number;
  dailyQuantities: number[];
  dailyBranchDetails: { [branch: string]: number }[];
  totalPrice: number;
  dailySales?: number[];
  dailyReturns?: number[];
  dailySalesDetails?: { [branch: string]: number }[];
  dailyReturnsDetails?: { [branch: string]: number }[];
}

interface ReturnRow {
  id: string;
  product: string;
  code: string;
  unit: string;
  price: number;
  totalReturns: number;
  dailyReturns: number[];
  dailyBranchDetails: { [branch: string]: number }[];
  totalValue: number;
  totalOrders?: number;
}

interface SalesRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  price: number;
  totalSales: number;
  dailySales: number[];
  dailyBranchDetails: { [branch: string]: number }[];
  totalValue: number;
}

interface OrdersVsReturnsRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  dailyOrders: number[];
  dailyReturns: number[];
  dailyBranchOrders: { [branch: string]: number }[];
  dailyBranchReturns: { [branch: string]: number }[];
  totalOrders: number;
  totalReturns: number;
  totalRatio: number;
}

interface Branch {
  _id: string;
  name: string;
  nameEn: string;
  displayName: string;
}

const toArabicNumerals = (number: string | number): string => {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(number).replace(/[0-9]/g, (digit) => arabicNumerals[parseInt(digit)]);
};

const formatPrice = (amount: number, isRtl: boolean, isStats: boolean = false): string => {
  const validAmount = (typeof amount === 'number' && !isNaN(amount)) ? amount : 0;
  let formatted: string;
  if (isStats) {
    formatted = validAmount.toLocaleString(isRtl ? 'ar-SA' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    formatted = isRtl ? `${toArabicNumerals(formatted)} ر.س` : `${formatted} SAR`;
  } else {
    formatted = validAmount.toLocaleString(isRtl ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    if (isRtl) {
      formatted = formatted.replace(/\d/g, (d) => String.fromCharCode(0x0660 + parseInt(d)));
    }
  }
  return formatted;
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
    ? `إجمالي المنتجات: ${toArabicNumerals(totalItems)} | إجمالي الكمية: ${toArabicNumerals(totalQuantity)} وحدة | إجمالي المبلغ: ${formatPrice(totalPrice, isRtl, true)}`
    : `Total Products: ${totalItems} | Total Quantity: ${totalQuantity} units | Total Amount: ${formatPrice(totalPrice, isRtl, true)}`;
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
  fontName: string,
  allBranches: string[]
) => {
  const tableColumnWidths = headers.map((_, index) => {
    if (index === 0 && headers[index] !== (isRtl ? 'رقم' : 'No.')) return 25; // Code
    if (index === 0 && headers[index] === (isRtl ? 'رقم' : 'No.')) return 15; // No.
    if (index === 1) return 45; // Product
    if (index === 2) return 25; // Unit
    if (index >= 3 && index < headers.length - 2) return 20; // Daily Quantities or Branch Quantities
    return 30; // Total Quantity, Total Price/Value
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
  totalPrice: number,
  allBranches: string[]
) => {
  try {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const fontName = 'Amiri';
    const fontLoaded = await loadFont(doc);
    generatePDFHeader(doc, isRtl, title, monthName, totalItems, totalQuantity, totalPrice, fontName, fontLoaded);
    generatePDFTable(doc, headers, data, isRtl, fontLoaded, fontName, allBranches);
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

export const ProductDropdown = ({
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
  const selectedOption = options.find((opt) => opt.value === value) || options[0] || { label: isRtl ? 'اختر' : 'Select', value: '' };
  return (
    <div className="relative group">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 bg-gradient-to-r from-white to-gray-50 shadow-sm hover:shadow-md text-sm text-gray-700 ${isRtl ? 'text-right' : 'text-left'} flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={ariaLabel}
      >
        <span className="truncate">{selectedOption.label}</span>
        <div className={`${isOpen ? 'rotate-180' : 'rotate-0'} transition-transform duration-200`}>
          <ChevronDown className="w-5 h-5 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
        </div>
      </button>
      {isOpen && !disabled && (
        <div className="absolute w-full mt-2 bg-white rounded-lg shadow-2xl border border-gray-100 z-20 max-h-60 overflow-y-auto scrollbar-none">
          {options.map((option) => (
            <div
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className="px-4 py-2.5 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-600 cursor-pointer transition-colors duration-200"
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const BranchMultiSelect = ({
  value,
  onChange,
  options,
  ariaLabel,
  disabled = false,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
  disabled?: boolean;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabels = options.filter(opt => value.includes(opt.value)).map(opt => opt.label);
  const displayText = selectedLabels.length > 0 ? selectedLabels.join(', ') : isRtl ? 'كل الفروع' : 'All Branches';
  const toggleBranch = (branchValue: string) => {
    if (value.includes(branchValue)) {
      onChange(value.filter(v => v !== branchValue));
    } else {
      onChange([...value, branchValue]);
    }
  };
  return (
    <div className="relative group">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 bg-gradient-to-r from-white to-gray-50 shadow-sm hover:shadow-md text-sm text-gray-700 ${isRtl ? 'text-right' : 'text-left'} flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={ariaLabel}
      >
        <span className="truncate">{displayText}</span>
        <div className={`${isOpen ? 'rotate-180' : 'rotate-0'} transition-transform duration-200`}>
          <ChevronDown className="w-5 h-5 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
        </div>
      </button>
      {isOpen && !disabled && (
        <div className="absolute w-full mt-2 bg-white rounded-lg shadow-2xl border border-gray-100 z-20 max-h-60 overflow-y-auto scrollbar-none">
          {options.map((option) => (
            <div
              key={option.value}
              onClick={() => toggleBranch(option.value)}
              className="px-4 py-2.5 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-600 cursor-pointer transition-colors duration-200 flex items-center gap-2"
            >
              <input type="checkbox" checked={value.includes(option.value)} readOnly className="w-4 h-4 accent-amber-500" />
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const ReturnsTable = ({
  data,
  title,
  month,
  isRtl,
  loading,
  allBranches,
  daysInMonth,
  months,
  selectedBranches,
  selectedDayIndices,
  orderData,
}: {
  data: ReturnRow[];
  title: string;
  month: number;
  isRtl: boolean;
  loading: boolean;
  allBranches: string[];
  daysInMonth: string[];
  months: { value: number; label: string }[];
  selectedBranches: string[];
  selectedDayIndices: number[];
  orderData: OrderRow[];
}) => {
  const [search, setSearch] = useState('');
  const sortedDayIndices = [...selectedDayIndices].sort((a, b) => a - b);
  const orderMap = useMemo(() => new Map(orderData.map(o => [o.id, o])), [orderData]);
  const filteredData = useMemo(() => {
    return data
      .filter(row => row.product.toLowerCase().includes(search.toLowerCase()))
      .map(row => {
        const filteredDailyReturns = sortedDayIndices.map(i => {
          if (selectedBranches.length === 0) return row.dailyReturns[i];
          return selectedBranches.reduce((sum, b) => sum + (row.dailyBranchDetails[i][b] || 0), 0);
        });
        const filteredTotalReturns = filteredDailyReturns.reduce((a, b) => a + b, 0);
        const filteredTotalValue = filteredTotalReturns * row.price;
        const orderRow = orderMap.get(row.id);
        let filteredTotalOrders = 0;
        if (orderRow) {
          const filteredDailyOrders = sortedDayIndices.map(i => {
            if (selectedBranches.length === 0) return orderRow.dailyQuantities[i];
            return selectedBranches.reduce((sum, b) => sum + (orderRow.dailyBranchDetails[i][b] || 0), 0);
          });
          filteredTotalOrders = filteredDailyOrders.reduce((a, b) => a + b, 0);
        }
        const filteredRatio = filteredTotalOrders > 0 ? ((filteredTotalReturns / filteredTotalOrders) * 100).toFixed(2) : '0.00';
        const filteredDailyBranchDetails = sortedDayIndices.map(i => {
          if (selectedBranches.length === 0) return row.dailyBranchDetails[i];
          return Object.fromEntries(selectedBranches.map(b => [b, row.dailyBranchDetails[i][b] || 0]));
        });
        return {
          ...row,
          dailyReturns: filteredDailyReturns,
          dailyBranchDetails: filteredDailyBranchDetails,
          totalReturns: filteredTotalReturns,
          totalValue: filteredTotalValue,
          totalOrders: filteredTotalOrders,
          ratio: filteredRatio,
        };
      });
  }, [data, search, selectedBranches, sortedDayIndices, orderMap, isRtl]);

  const grandTotalReturns = filteredData.reduce((sum, row) => sum + row.totalReturns, 0);
  const grandTotalValue = filteredData.reduce((sum, row) => sum + row.totalValue, 0);
  const grandTotalOrders = filteredData.reduce((sum, row) => sum + (row.totalOrders || 0), 0);
  const grandRatio = grandTotalOrders > 0 ? ((grandTotalReturns / grandTotalOrders) * 100).toFixed(2) : '0.00';

  const monthName = months[month].label;

  const exportTable = (format: 'excel' | 'pdf') => {
    const headers = [
      isRtl ? 'رقم' : 'No.',
      isRtl ? 'الكود' : 'Code',
      isRtl ? 'المنتج' : 'Product',
      isRtl ? 'وحدة المنتج' : 'Product Unit',
      ...sortedDayIndices.map(i => daysInMonth[i]),
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
        ...Object.fromEntries(row.dailyReturns.map((qty, j) => [daysInMonth[sortedDayIndices[j]], qty])),
        totalReturns: row.totalReturns,
        totalValue: formatPrice(row.totalValue, isRtl),
        ratio: row.ratio,
      })),
      {
        no: '',
        code: '',
        product: isRtl ? 'الإجمالي' : 'Total',
        unit: '',
        ...Object.fromEntries(sortedDayIndices.map((i, j) => [daysInMonth[i], filteredData.reduce((sum, row) => sum + row.dailyReturns[j], 0)])),
        totalReturns: grandTotalReturns,
        totalValue: formatPrice(grandTotalValue, isRtl),
        ratio: grandRatio,
      },
    ];
    const dataRows = rows.map(row => [
      row.no,
      row.code,
      row.product,
      row.unit,
      ...sortedDayIndices.map((i, j) => row[daysInMonth[i]]),
      row.totalReturns,
      row.totalValue,
      `${row.ratio}%`,
    ]);
    if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows, { header: headers });
      if (isRtl) ws['!views'] = [{ RTL: true }];
      ws['!cols'] = [{ wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, ...sortedDayIndices.map(() => ({ wch: 12 })), { wch: 15 }, { wch: 15 }, { wch: 15 }];
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

  const getTooltipContent = (dailyQuantity: number, branchDetails: { [branch: string]: number }, isRtl: boolean, type: 'in' | 'out' | 'return' | 'sales' | 'orders') => {
    let header = '';
    if (type === 'in') header = isRtl ? 'زيادة مخزون' : 'Stock In';
    if (type === 'out') header = isRtl ? 'نقص مخزون' : 'Stock Out';
    if (type === 'return') header = isRtl ? 'مرتجع' : 'Return';
    if (type === 'sales') header = isRtl ? 'مبيعات' : 'Sales';
    if (type === 'orders') header = isRtl ? 'طلبات' : 'Orders';
    let content = `${header}: ${dailyQuantity > 0 ? '+' : ''}${formatNumber(dailyQuantity, isRtl)}`;
    if (Object.keys(branchDetails).length > 0) {
      content += '\n' + Object.entries(branchDetails).map(([branch, qty]) => `${branch}: ${qty > 0 ? '+' : ''}${formatNumber(qty, isRtl)}`).join('\n');
    }
    return content;
  };

  if (loading) return <OrderTableSkeleton isRtl={isRtl} />;

  if (data.length === 0) {
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
          placeholder={isRtl ? 'بحث بالمنتج...' : 'Search by product...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 text-sm text-gray-700 ${isRtl ? 'text-right' : 'text-left'}`}
        />
        <div className="flex gap-2">
          <Button
            variant={filteredData.length > 0 ? 'primary' : 'secondary'}
            onClick={filteredData.length > 0 ? () => exportTable('excel') : undefined}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 ${filteredData.length > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
            disabled={filteredData.length === 0}
          >
            <Upload className="w-4 h-4" />
            {isRtl ? 'تصدير إكسل' : 'Export Excel'}
          </Button>
          <Button
            variant={filteredData.length > 0 ? 'primary' : 'secondary'}
            onClick={filteredData.length > 0 ? () => exportTable('pdf') : undefined}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 ${filteredData.length > 0 ? 'bg-green-600 hover:bg-green-700 text-white shadow-sm' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
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
              {sortedDayIndices.map((i) => (
                <th key={i} className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">
                  {daysInMonth[i]}
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
                {row.dailyReturns.map((qty, j) => (
                  <td
                    key={j}
                    className="px-4 py-3 text-center font-medium text-red-700"
                    data-tooltip-id="return-tooltip"
                    data-tooltip-content={getTooltipContent(qty, row.dailyBranchDetails[j], isRtl, 'return')}
                  >
                    {qty !== 0 ? formatNumber(qty, isRtl) : '0'}
                  </td>
                ))}
                <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalReturns, isRtl)}</td>
                <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatPrice(row.totalValue, isRtl)}</td>
                <td className="px-4 py-3 text-gray-700 text-center font-medium">{row.ratio}%</td>
              </tr>
            ))}
            <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <td className="px-4 py-3 text-gray-800 text-center" colSpan={4}>{isRtl ? 'الإجمالي' : 'Total'}</td>
              {sortedDayIndices.map((i, j) => (
                <td key={j} className="px-4 py-3 text-gray-800 text-center">
                  {formatNumber(filteredData.reduce((sum, row) => sum + row.dailyReturns[j], 0), isRtl)}
                </td>
              ))}
              <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalReturns, isRtl)}</td>
              <td className="px-4 py-3 text-gray-800 text-center">{formatPrice(grandTotalValue, isRtl)}</td>
              <td className="px-4 py-3 text-gray-800 text-center">{grandRatio}%</td>
            </tr>
          </tbody>
        </table>
        <Tooltip id="return-tooltip" place="top" className="custom-tooltip" />
      </motion.div>
    </div>
  );
};

const ProductionReport: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<{ [month: number]: OrderRow[] }>({});
  const [stockInData, setStockInData] = useState<{ [month: number]: StockRow[] }>({});
  const [stockOutData, setStockOutData] = useState<{ [month: number]: StockRow[] }>({});
  const [returnData, setReturnData] = useState<{ [month: number]: ReturnRow[] }>({});
  const [salesData, setSalesData] = useState<{ [month: number]: SalesRow[] }>({});
  const [ordersVsReturnsData, setOrdersVsReturnsData] = useState<{ [month: number]: OrdersVsReturnsRow[] }>({});
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(9); // October 2025
  const [activeTab, setActiveTab] = useState<'orders' | 'stockIn' | 'stockOut' | 'returns' | 'sales' | 'ordersVsReturns'>('orders');
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const currentDate = new Date('2025-10-16T00:00:00+03:00');
  const currentYear = currentDate.getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: new Date(currentYear, i).toLocaleString(language, { month: 'long' }),
  }));
  const getDaysInMonth = useCallback((month: number) => {
    const daysInMonthCount = new Date(currentYear, month + 1, 0).getDate();
    return Array.from({ length: daysInMonthCount }, (_, i) => {
      const date = new Date(currentYear, month, i + 1);
      return date.toLocaleString(language, { day: 'numeric', month: 'short' });
    });
  }, [currentYear, language]);
  const daysInMonth = useMemo(() => getDaysInMonth(selectedMonth), [selectedMonth, getDaysInMonth]);
  const allBranches = useMemo(() => branches.map(b => b.displayName).sort((a, b) => a.localeCompare(b, language)), [branches, language]);
  const minDate = new Date(currentYear, selectedMonth, 1).toISOString().split('T')[0];
  const maxDate = new Date(currentYear, selectedMonth + 1, 0).toISOString().split('T')[0];
  const weekCount = Math.ceil(daysInMonth.length / 7);
  const periodOptions = useMemo(() => [
    { value: 'all', label: isRtl ? 'كل الشهر' : 'All Month' },
    ...Array.from({ length: weekCount }, (_, i) => ({
      value: `week${i + 1}`,
      label: isRtl ? `الأسبوع ${toArabicNumerals(i + 1)}` : `Week ${i + 1}`,
    })),
    { value: 'custom', label: isRtl ? 'مخصص' : 'Custom' },
  ], [isRtl, weekCount]);
  const branchOptions = allBranches.map(b => ({ value: b, label: b }));
  const selectedDayIndices = useMemo(() => {
    let indices: number[] = [];
    const daysCount = daysInMonth.length;
    if (selectedPeriod === 'all') {
      indices = Array.from({ length: daysCount }, (_, i) => i);
    } else if (selectedPeriod.startsWith('week')) {
      const weekNum = parseInt(selectedPeriod.replace('week', '')) - 1;
      const start = weekNum * 7;
      const end = Math.min(start + 6, daysCount - 1);
      for (let i = start; i <= end; i++) indices.push(i);
    } else if (selectedPeriod === 'custom' && startDate && endDate) {
      const start = new Date(startDate).getDate() - 1;
      const end = new Date(endDate).getDate() - 1;
      if (start <= end) {
        for (let i = start; i <= end; i++) indices.push(i);
      }
    }
    return indices;
  }, [selectedPeriod, startDate, endDate, daysInMonth.length]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [inventory, ordersResponse, branchesResponse, salesResponse] = await Promise.all([
          inventoryAPI.getInventory({}, isRtl),
          ordersAPI.getAll({ status: 'completed', page: 1, limit: 1000 }, isRtl),
          branchesAPI.getAll(),
          salesAPI.getAnalytics({
            startDate: new Date(currentYear, selectedMonth, 1).toISOString(),
            endDate: new Date(currentYear, selectedMonth + 1, 0).toISOString(),
            lang: language,
          }),
        ]);
        const monthlyOrderData: { [month: number]: OrderRow[] } = {};
        const monthlyStockInData: { [month: number]: StockRow[] } = {};
        const monthlyStockOutData: { [month: number]: StockRow[] } = {};
        const monthlyReturnData: { [month: number]: ReturnRow[] } = {};
        const monthlySalesData: { [month: number]: SalesRow[] } = {};
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
        const productDetails = new Map<string, { code: string; product: string; unit: string; price: number }>();
        inventory.forEach((item: any) => {
          if (item?.product?._id) {
            productDetails.set(item.product._id, {
              code: item.product.code || `code-${Math.random().toString(36).substring(2)}`,
              product: isRtl ? (item.product.name || 'منتج غير معروف') : (item.product.nameEn || item.product.name || 'Unknown Product'),
              unit: isRtl ? (item.product.unit || 'غير محدد') : (item.product.unitEn || item.product.unit || 'N/A'),
              price: Number(item.product.price) || 0,
            });
          }
        });
        let orders = Array.isArray(ordersResponse) ? ordersResponse : [];
        if (orders.length === 0) {
          orders = inventory
            .filter((item: any) => item?.product?._id)
            .flatMap((item: any) => {
              return (item.movements || []).map((movement: any) => ({
                status: 'completed',
                createdAt: movement.createdAt || new Date().toISOString(),
                branch: {
                  _id: fetchedBranches[Math.floor(Math.random() * fetchedBranches.length)]?._id,
                },
                items: [
                  {
                    product: item.product,
                    quantity: Math.abs(Number(movement.quantity) || 0),
                    price: Number(item.product?.price) || 0,
                    productId: item.product._id,
                    unit: isRtl ? (item.product?.unit || 'غير محدد') : (item.product?.unitEn || item.product?.unit || 'N/A'),
                  },
                ],
              }));
            });
        }
        for (let month = 0; month < 12; month++) {
          const daysInMonthCount = new Date(currentYear, month + 1, 0).getDate();
          const orderMap = new Map<string, OrderRow>();
          const stockInMap = new Map<string, StockRow>();
          const stockOutMap = new Map<string, StockRow>();
          const returnMap = new Map<string, ReturnRow>();
          const salesMap = new Map<string, SalesRow>();
          orders.forEach((order: any) => {
            const status = order.status || order.orderStatus;
            if (status !== 'completed') return;
            const date = new Date(order.createdAt || order.date);
            if (isNaN(date.getTime())) return;
            const orderMonth = date.getMonth();
            const year = date.getFullYear();
            if (year === currentYear && orderMonth === month) {
              const day = date.getDate() - 1;
              const branchId = order.branch?._id || order.branchId;
              const branch = branchMap.get(branchId) || (isRtl ? 'الفرع الرئيسي' : 'Main Branch');
              (order.items || []).forEach((item: any) => {
                const productId = item.product?._id || item.productId;
                if (!productId) return;
                const details = productDetails.get(productId) || {
                  code: item.product?.code || `code-${Math.random().toString(36).substring(2)}`,
                  product: isRtl ? (item.product?.name || 'منتج غير معروف') : (item.product?.nameEn || item.product?.name || 'Unknown Product'),
                  unit: isRtl ? (item.product?.unit || 'غير محدد') : (item.product?.unitEn || item.product?.unit || 'N/A'),
                  price: Number(item.price) || 0,
                };
                const key = `${productId}-${month}`;
                if (!orderMap.has(key)) {
                  orderMap.set(key, {
                    id: key,
                    code: details.code,
                    product: details.product,
                    unit: details.unit,
                    price: details.price,
                    dailyQuantities: Array(daysInMonthCount).fill(0),
                    dailyBranchDetails: Array.from({ length: daysInMonthCount }, () => ({})),
                    branchQuantities: {},
                    totalQuantity: 0,
                    totalPrice: 0,
                    sales: 0,
                    actualSales: 0,
                  });
                }
                const row = orderMap.get(key)!;
                const quantity = Number(item.quantity) || 0;
                row.dailyQuantities[day] += quantity;
                row.dailyBranchDetails[day][branch] = (row.dailyBranchDetails[day][branch] || 0) + quantity;
                row.branchQuantities[branch] = (row.branchQuantities[branch] || 0) + quantity;
                row.totalQuantity += quantity;
                row.totalPrice += quantity * details.price;
                row.sales = row.totalPrice * 0.1;
              });
            }
          });
          if (month === selectedMonth) {
            for (const row of orderMap.values()) {
              const salesItem = salesResponse.productSales?.find((s: any) => s.productId === row.id.split('-')[0]);
              if (salesItem) {
                row.actualSales = Number(salesItem.totalQuantity) || 0;
              }
            }
          }
          inventory.forEach((item: any) => {
            const productId = item?.product?._id;
            if (!productId) return;
            const details = productDetails.get(productId) || {
              code: item.product?.code || `code-${Math.random().toString(36).substring(2)}`,
              product: isRtl ? (item.product?.name || 'منتج غير معروف') : (item.product?.nameEn || item.product?.name || 'Unknown Product'),
              unit: isRtl ? (item.product?.unit || 'غير محدد') : (item.product?.unitEn || item.product?.unit || 'N/A'),
              price: Number(item.product?.price) || 0,
            };
            const branchId = item.branch?._id || item.branch;
            const branchName = branchMap.get(branchId) || (isRtl ? 'غير معروف' : 'Unknown');
            (item.movements || []).forEach((movement: any) => {
              const date = new Date(movement.createdAt);
              if (isNaN(date.getTime())) return;
              const prodMonth = date.getMonth();
              const year = date.getFullYear();
              if (year === currentYear && prodMonth === month) {
                const day = date.getDate() - 1;
                const key = `${productId}-${month}`;
                const quantity = Number(movement.quantity) || 0;
                let qty = quantity;
                if (movement.type === 'out') {
                  qty = Math.abs(quantity);
                }
                if (movement.type === 'in') {
                  if (!stockInMap.has(key)) {
                    stockInMap.set(key, {
                      id: key,
                      code: details.code,
                      product: details.product,
                      unit: details.unit,
                      price: details.price,
                      totalQuantity: 0,
                      dailyQuantities: Array(daysInMonthCount).fill(0),
                      dailyBranchDetails: Array.from({ length: daysInMonthCount }, () => ({})),
                      totalPrice: 0,
                    });
                  }
                  const row = stockInMap.get(key)!;
                  row.dailyQuantities[day] += qty;
                  row.dailyBranchDetails[day][branchName] = (row.dailyBranchDetails[day][branchName] || 0) + qty;
                  row.totalQuantity += qty;
                  row.totalPrice += qty * details.price;
                } else if (movement.type === 'out') {
                  if (!stockOutMap.has(key)) {
                    stockOutMap.set(key, {
                      id: key,
                      code: details.code,
                      product: details.product,
                      unit: details.unit,
                      price: details.price,
                      totalQuantity: 0,
                      dailyQuantities: Array(daysInMonthCount).fill(0),
                      dailyBranchDetails: Array.from({ length: daysInMonthCount }, () => ({})),
                      totalPrice: 0,
                      dailySales: Array(daysInMonthCount).fill(0),
                      dailyReturns: Array(daysInMonthCount).fill(0),
                      dailySalesDetails: Array.from({ length: daysInMonthCount }, () => ({})),
                      dailyReturnsDetails: Array.from({ length: daysInMonthCount }, () => ({})),
                    });
                  }
                  const row = stockOutMap.get(key)!;
                  row.dailyQuantities[day] += qty;
                  row.dailyBranchDetails[day][branchName] = (row.dailyBranchDetails[day][branchName] || 0) + qty;
                  row.totalQuantity += qty;
                  row.totalPrice += qty * details.price;
                  const isReturn = movement.reference?.includes('مرتجع') || movement.reference?.includes('RET-');
                  const isSale = movement.reference?.includes('بيع') || movement.reference?.includes('SALE-');
                  if (isReturn) {
                    row.dailyReturns![day] += qty;
                    row.dailyReturnsDetails![day][branchName] = (row.dailyReturnsDetails![day][branchName] || 0) + qty;
                    if (!returnMap.has(key)) {
                      returnMap.set(key, {
                        id: key,
                        product: details.product,
                        code: details.code,
                        unit: details.unit,
                        price: details.price,
                        totalReturns: 0,
                        dailyReturns: Array(daysInMonthCount).fill(0),
                        dailyBranchDetails: Array.from({ length: daysInMonthCount }, () => ({})),
                        totalValue: 0,
                      });
                    }
                    const returnRow = returnMap.get(key)!;
                    returnRow.dailyReturns[day] += qty;
                    returnRow.dailyBranchDetails[day][branchName] = (returnRow.dailyBranchDetails[day][branchName] || 0) + qty;
                    returnRow.totalReturns += qty;
                    returnRow.totalValue += qty * details.price;
                    const orderRow = orderMap.get(key);
                    returnRow.totalOrders = orderRow ? orderRow.totalQuantity : 0;
                  } else if (isSale) {
                    row.dailySales![day] += qty;
                    row.dailySalesDetails![day][branchName] = (row.dailySalesDetails![day][branchName] || 0) + qty;
                    if (!salesMap.has(key)) {
                      salesMap.set(key, {
                        id: key,
                        code: details.code,
                        product: details.product,
                        unit: details.unit,
                        price: details.price,
                        totalSales: 0,
                        dailySales: Array(daysInMonthCount).fill(0),
                        dailyBranchDetails: Array.from({ length: daysInMonthCount }, () => ({})),
                        totalValue: 0,
                      });
                    }
                    const salesRow = salesMap.get(key)!;
                    salesRow.dailySales[day] += qty;
                    salesRow.dailyBranchDetails[day][branchName] = (salesRow.dailyBranchDetails[day][branchName] || 0) + qty;
                    salesRow.totalSales += qty;
                    salesRow.totalValue += qty * details.price;
                  }
                }
              }
            });
          });
          const productKeys = new Set<string>([...orderMap.keys(), ...returnMap.keys()]);
          const ordersVsReturnsMap = new Map<string, OrdersVsReturnsRow>();
          productKeys.forEach((key) => {
            const ordersRow = orderMap.get(key);
            const returnsRow = returnMap.get(key);
            const dailyOrders = ordersRow ? ordersRow.dailyQuantities : Array(daysInMonthCount).fill(0);
            const dailyReturns = returnsRow ? returnsRow.dailyReturns : Array(daysInMonthCount).fill(0);
            const dailyBranchOrders = ordersRow ? ordersRow.dailyBranchDetails : Array.from({ length: daysInMonthCount }, () => ({}));
            const dailyBranchReturns = returnsRow ? returnsRow.dailyBranchDetails : Array.from({ length: daysInMonthCount }, () => ({}));
            const totalOrders = dailyOrders.reduce((a, b) => a + b, 0);
            const totalReturns = dailyReturns.reduce((a, b) => a + b, 0);
            const totalRatio = totalOrders > 0 ? (totalReturns / totalOrders) * 100 : 0;
            ordersVsReturnsMap.set(key, {
              id: key,
              code: ordersRow?.code || returnsRow?.code || '',
              product: ordersRow?.product || returnsRow?.product || '',
              unit: ordersRow?.unit || returnsRow?.unit || '',
              dailyOrders,
              dailyReturns,
              dailyBranchOrders,
              dailyBranchReturns,
              totalOrders,
              totalReturns,
              totalRatio,
            });
          });
          monthlyOrderData[month] = Array.from(orderMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
          monthlyStockInData[month] = Array.from(stockInMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
          monthlyStockOutData[month] = Array.from(stockOutMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
          monthlyReturnData[month] = Array.from(returnMap.values()).sort((a, b) => b.totalReturns - a.totalReturns);
          monthlySalesData[month] = Array.from(salesMap.values()).sort((a, b) => b.totalSales - a.totalSales);
          monthlyOrdersVsReturnsData[month] = Array.from(ordersVsReturnsMap.values()).sort((a, b) => b.totalRatio - a.totalRatio);
        }
        setOrderData(monthlyOrderData);
        setStockInData(monthlyStockInData);
        setStockOutData(monthlyStockOutData);
        setReturnData(monthlyReturnData);
        setSalesData(monthlySalesData);
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
    };
    fetchData();
  }, [isRtl, currentYear, selectedMonth, language]);

  const getTooltipContent = (dailyQuantity: number, branchDetails: { [branch: string]: number }, isRtl: boolean, type: 'in' | 'out' | 'return' | 'sales' | 'orders') => {
    let header = '';
    if (type === 'in') header = isRtl ? 'زيادة مخزون' : 'Stock In';
    if (type === 'out') header = isRtl ? 'نقص مخزون' : 'Stock Out';
    if (type === 'return') header = isRtl ? 'مرتجع' : 'Return';
    if (type === 'sales') header = isRtl ? 'مبيعات' : 'Sales';
    if (type === 'orders') header = isRtl ? 'طلبات' : 'Orders';
    let content = `${header}: ${dailyQuantity > 0 ? '+' : ''}${formatNumber(dailyQuantity, isRtl)}`;
    if (branchDetails && Object.keys(branchDetails).length > 0) {
      content += '\n' + Object.entries(branchDetails).map(([branch, qty]) => `${branch}: ${qty > 0 ? '+' : ''}${formatNumber(qty, isRtl)}`).join('\n');
    }
    return content;
  };

  const getOutTooltip = (qty: number, sales: number, returns: number, salesDetails: { [branch: string]: number }, returnsDetails: { [branch: string]: number }, isRtl: boolean) => {
    let content = `${isRtl ? 'إجمالي النقصان' : 'Total Out'}: ${formatNumber(qty, isRtl)}`;
    content += `\n${isRtl ? 'مبيعات' : 'Sales'}: ${formatNumber(sales, isRtl)}\n${Object.entries(salesDetails).map(([branch, s]) => `${branch}: ${formatNumber(s, isRtl)}`).join('\n')}`;
    content += `\n${isRtl ? 'مرتجعات' : 'Returns'}: ${formatNumber(returns, isRtl)}\n${Object.entries(returnsDetails).map(([branch, r]) => `${branch}: ${formatNumber(r, isRtl)}`).join('\n')}`;
    return content;
  };

  const renderStockTable = useCallback(
    (data: StockRow[], title: string, month: number, type: 'in' | 'out') => {
      const [search, setSearch] = useState('');
      const sortedDayIndices = [...selectedDayIndices].sort((a, b) => a - b);
      const filteredData = useMemo(() => {
        return data
          .filter(row => row.product.toLowerCase().includes(search.toLowerCase()) || row.code.toLowerCase().includes(search.toLowerCase()))
          .map(row => {
            const filteredDailyQuantities = sortedDayIndices.map(i => {
              if (selectedBranches.length === 0) return row.dailyQuantities[i];
              return selectedBranches.reduce((sum, b) => sum + (row.dailyBranchDetails[i][b] || 0), 0);
            });
            const filteredTotalQuantity = filteredDailyQuantities.reduce((a, b) => a + b, 0);
            const filteredTotalPrice = filteredTotalQuantity * row.price;
            const filteredDailyBranchDetails = sortedDayIndices.map(i => {
              if (selectedBranches.length === 0) return row.dailyBranchDetails[i];
              return Object.fromEntries(selectedBranches.map(b => [b, row.dailyBranchDetails[i][b] || 0]));
            });
            let filteredDailySales, filteredDailyReturns, filteredDailySalesDetails, filteredDailyReturnsDetails;
            if (type === 'out') {
              filteredDailySales = sortedDayIndices.map(i => {
                if (selectedBranches.length === 0) return row.dailySales![i];
                return selectedBranches.reduce((sum, b) => sum + (row.dailySalesDetails![i][b] || 0), 0);
              });
              filteredDailyReturns = sortedDayIndices.map(i => {
                if (selectedBranches.length === 0) return row.dailyReturns![i];
                return selectedBranches.reduce((sum, b) => sum + (row.dailyReturnsDetails![i][b] || 0), 0);
              });
              filteredDailySalesDetails = sortedDayIndices.map(i => {
                if (selectedBranches.length === 0) return row.dailySalesDetails![i];
                return Object.fromEntries(selectedBranches.map(b => [b, row.dailySalesDetails![i][b] || 0]));
              });
              filteredDailyReturnsDetails = sortedDayIndices.map(i => {
                if (selectedBranches.length === 0) return row.dailyReturnsDetails![i];
                return Object.fromEntries(selectedBranches.map(b => [b, row.dailyReturnsDetails![i][b] || 0]));
              });
            }
            return {
              ...row,
              dailyQuantities: filteredDailyQuantities,
              dailyBranchDetails: filteredDailyBranchDetails,
              totalQuantity: filteredTotalQuantity,
              totalPrice: filteredTotalPrice,
              dailySales: filteredDailySales,
              dailyReturns: filteredDailyReturns,
              dailySalesDetails: filteredDailySalesDetails,
              dailyReturnsDetails: filteredDailyReturnsDetails,
            };
          });
      }, [data, search, selectedBranches, sortedDayIndices, type]);
      const grandTotalQuantity = filteredData.reduce((sum, row) => sum + row.totalQuantity, 0);
      const grandTotalPrice = filteredData.reduce((sum, row) => sum + row.totalPrice, 0);
      const monthName = months[month].label;
      const exportTable = (format: 'excel' | 'pdf') => {
        const headers = [
          isRtl ? 'رقم' : 'No.',
          isRtl ? 'الكود' : 'Code',
          isRtl ? 'المنتج' : 'Product',
          isRtl ? 'وحدة المنتج' : 'Product Unit',
          ...sortedDayIndices.map(i => daysInMonth[i]),
          isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
          isRtl ? 'السعر الإجمالي' : 'Total Price',
        ];
        const rows = [
          ...filteredData.map((row, index) => ({
            no: index + 1,
            code: row.code,
            product: row.product,
            unit: row.unit,
            ...Object.fromEntries(row.dailyQuantities.map((qty, j) => [daysInMonth[sortedDayIndices[j]], qty])),
            totalQuantity: row.totalQuantity,
            totalPrice: formatPrice(row.totalPrice, isRtl),
          })),
          {
            no: '',
            code: '',
            product: isRtl ? 'الإجمالي' : 'Total',
            unit: '',
            ...Object.fromEntries(sortedDayIndices.map((i, j) => [daysInMonth[i], filteredData.reduce((sum, row) => sum + row.dailyQuantities[j], 0)])),
            totalQuantity: grandTotalQuantity,
            totalPrice: formatPrice(grandTotalPrice, isRtl),
          },
        ];
        const dataRows = rows.map(row => [
          row.no,
          row.code,
          row.product,
          row.unit,
          ...sortedDayIndices.map((i, j) => row[daysInMonth[i]]),
          row.totalQuantity,
          row.totalPrice,
        ]);
        if (format === 'excel') {
          const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows, { header: headers });
          if (isRtl) ws['!views'] = [{ RTL: true }];
          ws['!cols'] = [{ wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, ...sortedDayIndices.map(() => ({ wch: 12 })), { wch: 15 }, { wch: 15 }];
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
      if (loading) return <OrderTableSkeleton isRtl={isRtl} />;
      if (data.length === 0) {
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-center py-12 bg-white shadow-md rounded-xl border border-gray-200"
          >
            <p className="text-gray-500 text-sm font-medium">{isRtl ? 'لا توجد بيانات مبيعات' : 'No sales data available'}</p>
          </motion.div>
        );
      }
      return (
        <div className="mb-8">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h2 className="text-lg font-semibold text-gray-800">{isRtl ? `${title} - ${monthName}` : `${title} - ${monthName}`}</h2>
            <input
              type="text"
              placeholder={isRtl ? 'بحث بالمنتج...' : 'Search by product...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 text-sm text-gray-700 ${isRtl ? 'text-right' : 'text-left'}`}
            />
            <div className="flex gap-2">
              <Button
                variant={filteredData.length > 0 ? 'primary' : 'secondary'}
                onClick={filteredData.length > 0 ? () => exportTable('excel') : undefined}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 ${filteredData.length > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                disabled={filteredData.length === 0}
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير إكسل' : 'Export Excel'}
              </Button>
              <Button
                variant={filteredData.length > 0 ? 'primary' : 'secondary'}
                onClick={filteredData.length > 0 ? () => exportTable('pdf') : undefined}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 ${filteredData.length > 0 ? 'bg-green-600 hover:bg-green-700 text-white shadow-sm' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
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
                  {sortedDayIndices.map((i) => (
                    <th key={i} className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">
                      {daysInMonth[i]}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'إجمالي المبيعات' : 'Total Sales'}
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'القيمة الإجمالية' : 'Total Value'}
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
                    {row.dailySales.map((qty, j) => (
                      <td
                        key={j}
                        className={`px-4 py-3 text-center font-medium ${qty !== 0 ? 'bg-green-50 text-green-700' : 'text-gray-700'}`}
                        data-tooltip-id="sales-tooltip"
                        data-tooltip-content={getTooltipContent(qty, row.dailyBranchDetails[j], isRtl, 'sales')}
                      >
                        {qty !== 0 ? formatNumber(qty, isRtl) : '0'}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalSales, isRtl)}</td>
                    <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatPrice(row.totalValue, isRtl)}</td>
                  </tr>
                ))}
                <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-4 py-3 text-gray-800 text-center" colSpan={4}>{isRtl ? 'الإجمالي' : 'Total'}</td>
                  {sortedDayIndices.map((i, j) => (
                    <td key={j} className="px-4 py-3 text-gray-800 text-center">
                      {formatNumber(filteredData.reduce((sum, row) => sum + row.dailySales[j], 0), isRtl)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalSales, isRtl)}</td>
                  <td className="px-4 py-3 text-gray-800 text-center">{formatPrice(grandTotalValue, isRtl)}</td>
                </tr>
              </tbody>
            </table>
            <Tooltip id="sales-tooltip" place="top" className="custom-tooltip" />
          </motion.div>
        </div>
      );
    },
    [loading, isRtl, months, selectedBranches, selectedDayIndices, formatPrice]
  );

  return (
    <div className={`min-h-screen px-6 py-8 ${isRtl ? 'rtl font-amiri' : 'ltr font-inter'} bg-gray-100`}>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">{isRtl ? 'تقارير الإنتاج' : 'Production Reports'}</h1>
      <div className="mb-8 bg-white shadow-md rounded-xl p-4">
        <div className="flex flex-wrap gap-4 mb-4 items-center">
          <div className="w-48">
            <ProductDropdown
              value={selectedMonth.toString()}
              onChange={(v) => setSelectedMonth(parseInt(v))}
              options={months.map(m => ({ value: m.value.toString(), label: m.label }))}
              ariaLabel={isRtl ? 'اختر الشهر' : 'Select Month'}
            />
          </div>
          <div className="w-48">
            <BranchMultiSelect
              value={selectedBranches}
              onChange={setSelectedBranches}
              options={branchOptions}
              ariaLabel={isRtl ? 'اختر الفروع' : 'Select Branches'}
            />
          </div>
          <div className="w-48">
            <ProductDropdown
              value={selectedPeriod}
              onChange={setSelectedPeriod}
              options={periodOptions}
              ariaLabel={isRtl ? 'اختر الفترة' : 'Select Period'}
            />
          </div>
          {selectedPeriod === 'custom' && (
            <div className="flex gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={minDate}
                max={maxDate}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={minDate}
                max={maxDate}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          )}
        </div>
        <div className={`flex flex-wrap gap-2 justify-center ${isRtl ? 'flex-row-reverse' : ''}`}>
          <Button
            variant={activeTab === 'orders' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              activeTab === 'orders' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isRtl ? 'الطلبات' : 'Orders'}
          </Button>
          <Button
            variant={activeTab === 'stockIn' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('stockIn')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              activeTab === 'stockIn' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isRtl ? 'إدخال المخزون' : 'Stock In'}
          </Button>
          <Button
            variant={activeTab === 'stockOut' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('stockOut')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              activeTab === 'stockOut' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isRtl ? 'إخراج المخزون' : 'Stock Out'}
          </Button>
          <Button
            variant={activeTab === 'returns' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('returns')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              activeTab === 'returns' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isRtl ? 'المرتجعات' : 'Returns'}
          </Button>
          <Button
            variant={activeTab === 'sales' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('sales')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              activeTab === 'sales' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isRtl ? 'المبيعات' : 'Sales'}
          </Button>
          <Button
            variant={activeTab === 'ordersVsReturns' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('ordersVsReturns')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              activeTab === 'ordersVsReturns' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isRtl ? 'حركة الطلبات بالنسبة للمرتجعات' : 'Orders vs Returns'}
          </Button>
        </div>
      </div>
      <AnimatePresence>
        {activeTab === 'orders' && (
          <OrdersTable
            data={orderData[selectedMonth] || []}
            title={isRtl ? 'تقارير الطلبات' : 'Orders Report'}
            month={selectedMonth}
            isRtl={isRtl}
            loading={loading}
            allBranches={allBranches}
            daysInMonth={daysInMonth}
            months={months}
            selectedBranches={selectedBranches}
            selectedDayIndices={selectedDayIndices}
          />
        )}
        {activeTab === 'stockIn' && renderStockTable(stockInData[selectedMonth] || [], isRtl ? 'تقرير إدخال المخزون' : 'Stock In Report', selectedMonth, 'in')}
        {activeTab === 'stockOut' && renderStockTable(stockOutData[selectedMonth] || [], isRtl ? 'تقرير إخراج المخزون' : 'Stock Out Report', selectedMonth, 'out')}
        {activeTab === 'returns' && (
          <ReturnsTable
            data={returnData[selectedMonth] || []}
            title={isRtl ? 'تقرير المرتجعات' : 'Returns Report'}
            month={selectedMonth}
            isRtl={isRtl}
            loading={loading}
            allBranches={allBranches}
            daysInMonth={daysInMonth}
            months={months}
            selectedBranches={selectedBranches}
            selectedDayIndices={selectedDayIndices}
            orderData={orderData[selectedMonth] || []}
          />
        )}
        {activeTab === 'sales' && renderSalesTable(salesData[selectedMonth] || [], isRtl ? 'تقرير المبيعات' : 'Sales Report', selectedMonth)}
        {activeTab === 'ordersVsReturns' && (
          <OrdersVsReturnsTable
            data={ordersVsReturnsData[selectedMonth] || []}
            title={isRtl ? 'تقرير حركة الطلبات بالنسبة للمرتجعات' : 'Orders vs Returns Report'}
            month={selectedMonth}
            isRtl={isRtl}
            loading={loading}
            allBranches={allBranches}
            daysInMonth={daysInMonth}
            months={months}
            selectedBranches={selectedBranches}
            selectedDayIndices={selectedDayIndices}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductionReport;