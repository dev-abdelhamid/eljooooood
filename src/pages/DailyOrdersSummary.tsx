import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Upload, ChevronDown, Calendar } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { inventoryAPI, ordersAPI, branchesAPI, salesAPI } from '../services/api';
import { toast } from 'react-toastify';
import { Tooltip } from 'react-tooltip';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
  isWithinInterval,
  parseISO,
} from 'date-fns';
import { arSA } from 'date-fns/locale';

// Interfaces
interface OrderRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  price: number;
  branchQuantities: { [branch: string]: number };
  totalQuantity: number;
  totalPrice: number;
  actualSales: number;
}

interface Branch {
  _id: string;
  name: string;
  nameEn: string;
  displayName: string;
}

// Period options
const PERIOD_OPTIONS = [
  { value: 'today', labelAr: 'اليوم', labelEn: 'Today' },
  { value: 'week', labelAr: 'هذا الأسبوع', labelEn: 'This Week' },
  { value: 'month', labelAr: 'هذا الشهر', labelEn: 'This Month' },
  { value: 'custom', labelAr: 'فترة مخصصة', labelEn: 'Custom Range' },
];

// Button component
const Button: React.FC<{
  variant: 'primary' | 'secondary';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ variant, onClick, disabled, className, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${
      variant === 'primary' && !disabled
        ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-md hover:shadow-lg'
        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
    } ${className}`}
  >
    {children}
  </button>
);

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
        className={`absolute inset-y-0 ${isRtl ? 'left-3' : 'right-3'} flex items-center px-3 text-gray-400 transition-colors group-focus-within:text-amber-500`}
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
        className={`w-full ${isRtl ? 'pl-12 pr-4' : 'pr-12 pl-4'} px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all bg-white shadow-sm hover:shadow-md text-base placeholder-gray-500 ${isRtl ? 'text-right font-amiri' : 'text-left font-inter'}`}
        aria-label={ariaLabel}
      />
      {value && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          onClick={handleClear}
          className={`absolute inset-y-0 ${isRtl ? 'left-3' : 'right-3'} flex items-center px-3 text-gray-400 hover:text-amber-500 transition-colors focus:outline-none`}
          aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
        >
          <X className="w-5 h-5" />
        </motion.button>
      )}
    </div>
  );
};

// Enhanced ProductDropdown component
const ProductDropdown: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}> = ({ value, onChange, options, ariaLabel, disabled = false, className }) => {
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
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className={`relative group ${className}`} ref={dropdownRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all bg-gradient-to-r from-white to-gray-50 shadow-sm hover:shadow-md text-sm text-gray-700 ${isRtl ? 'text-right font-amiri' : 'text-left font-inter'} flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={ariaLabel}
      >
        <span className="truncate">{selectedOption.label}</span>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-lg shadow-2xl max-h-60 overflow-y-auto scrollbar-none"
          >
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-600 transition-colors text-left"
              >
                {option.label}
              </button>
            ))}
          </motion.div>
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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return isRtl ? `${toArabicNumerals(formatted)} ر.س` : `${formatted} SAR`;
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
    const [regularRes, boldRes] = await Promise.all([
      fetch(fontUrls.regular),
      fetch(fontUrls.bold),
    ]);
    const [regularFontBytes, boldFontBytes] = await Promise.all([
      regularRes.arrayBuffer(),
      boldRes.arrayBuffer(),
    ]);
    doc.addFileToVFS(`${fontName}-normal.ttf`, arrayBufferToBase64(regularFontBytes));
    doc.addFont(`${fontName}-normal.ttf`, fontName, 'normal');
    doc.addFileToVFS(`${fontName}-bold.ttf`, arrayBufferToBase64(boldFontBytes));
    doc.addFont(`${fontName}-bold.ttf`, fontName, 'bold');
    doc.setFont(fontName, 'normal');
    return true;
  } catch (error) {
    console.error('Font loading error:', error);
    return false;
  }
};

const generateFileName = (prefix: string, periodLabel: string, isRtl: boolean, extension: string): string => {
  const dateStr = new Date().toISOString().split('T')[0];
  const sanitizedLabel = periodLabel.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_');
  return `${prefix}_${sanitizedLabel}_${dateStr}.${extension}`;
};

const generatePDFHeader = (
  doc: jsPDF,
  isRtl: boolean,
  title: string,
  periodLabel: string,
  totalItems: number,
  totalQuantity: number,
  totalPrice: number,
  fontName: string,
  fontLoaded: boolean
) => {
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;

  doc.setFont(fontLoaded ? fontName : 'helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(33, 33, 33);
  const titleWidth = doc.getTextWidth(title);
  const titleX = isRtl ? pageWidth - margin - titleWidth : margin;
  doc.text(title, titleX, 20, { align: isRtl ? 'right' : 'left' });

  doc.setFontSize(10);
  doc.setFont(fontLoaded ? fontName : 'helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  const stats = isRtl
    ? `إجمالي المنتجات: ${toArabicNumerals(totalItems)} | إجمالي الكمية: ${toArabicNumerals(totalQuantity)} وحدة | إجمالي المبلغ: ${formatPrice(totalPrice, isRtl)} | الفترة: ${periodLabel}`
    : `Total Products: ${totalItems} | Total Quantity: ${totalQuantity} units | Total Amount: ${formatPrice(totalPrice, isRtl)} | Period: ${periodLabel}`;
  const statsWidth = doc.getTextWidth(stats);
  const statsX = isRtl ? margin : pageWidth - margin - statsWidth;
  doc.text(stats, statsX, 28, { align: isRtl ? 'left' : 'right' });

  doc.setLineWidth(0.5);
  doc.setDrawColor(245, 158, 11);
  doc.line(margin, 33, pageWidth - margin, 33);

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
  data: any[][],
  isRtl: boolean,
  fontLoaded: boolean,
  fontName: string
) => {
  const numColumns = headers.length;
  const pageWidth = doc.internal.pageSize.width;
  const margin = 10;
  const maxTableWidth = pageWidth - 2 * margin;
  const firstThreeWidths = [20, 15, 15];
  const otherColumnWidth = Math.max(10, (maxTableWidth - firstThreeWidths.reduce((a, b) => a + b, 0)) / (numColumns - 3));
  const columnStyles = headers.reduce((styles, _, i) => {
    const index = isRtl ? numColumns - 1 - i : i;
    styles[index] = {
      cellWidth: i < 3 ? firstThreeWidths[i] : otherColumnWidth,
      halign: 'center',
      valign: 'middle',
      overflow: 'linebreak',
    };
    return styles;
  }, {});

  autoTable(doc, {
    head: [isRtl ? headers.slice().reverse() : headers],
    body: isRtl ? data.map(row => row.slice().reverse()) : data,
    theme: 'grid',
    startY: 38,
    margin: { top: 38, bottom: 15, left: margin, right: margin },
    tableWidth: 'auto',
    columnStyles,
    headStyles: {
      fillColor: [245, 158, 11],
      textColor: [255, 255, 255],
      fontSize: 8,
      halign: 'center',
      valign: 'middle',
      font: fontLoaded ? fontName : 'helvetica',
      fontStyle: 'bold',
      cellPadding: 1.5,
      minCellHeight: 8,
    },
    bodyStyles: {
      fontSize: 7,
      halign: 'center',
      valign: 'middle',
      font: fontLoaded ? fontName : 'helvetica',
      textColor: [33, 33, , 33],
      lineColor: [200, 200, 200],
      fillColor: [255, 255, 255],
      cellPadding: 1.5,
      minCellHeight: 6,
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' || hookData.section === 'head') {
        hookData.cell.text = hookData.cell.text.map(text => {
          let processedText = text;
          if ((isRtl && hookData.column.index !== numColumns - 3) || (!isRtl && hookData.column.index !== 2)) {
            processedText = String(processedText).replace(/[0-9]/g, d => toArabicNumerals(d));
          }
          return processedText;
        });
      }
      if (hookData.section === 'body' && hookData.column.index === (isRtl ? numColumns - 4 : headers.length - 2)) {
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
  periodLabel: string,
  headers: string[],
  isRtl: boolean,
  totalItems: number,
  totalQuantity: number,
  totalPrice: number
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
    generatePDFHeader(doc, isRtl, title, periodLabel, totalItems, totalQuantity, totalPrice, fontName, fontLoaded);
    generatePDFTable(doc, headers, data, isRtl, fontLoaded, fontName);
    const fileName = generateFileName('OrdersSummary', periodLabel, isRtl, 'pdf');
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

const exportToExcel = (dataRows: any[], headers: string[], periodLabel: string, isRtl: boolean) => {
  toast.info(isRtl ? 'جارٍ إنشاء ملف Excel...' : 'Generating Excel...', {
    position: isRtl ? 'top-left' : 'top-right',
    autoClose: false,
    toastId: 'excel-export',
  });
  try {
    const sheetData = isRtl ? dataRows.map(row => row.slice().reverse()) : dataRows;
    const sheetHeaders = isRtl ? headers.slice().reverse() : headers;
    const ws = XLSX.utils.aoa_to_sheet([sheetHeaders, ...sheetData]);
    if (isRtl) ws['!views'] = [{ RTL: true }];
    ws['!cols'] = [
      { wch: 22 }, // Name
      { wch: 15 }, // Price
      { wch: 15 }, // Code
      ...Array(headers.length - 5).fill({ wch: 14 }),
      { wch: 15 }, // Total
      { wch: 12 }, // Unit
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Orders_${periodLabel.substring(0, 20)}`);
    XLSX.writeFile(wb, generateFileName('OrdersSummary', periodLabel, isRtl, 'xlsx'));
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

// Main Component
const DailyOrdersSummary: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();

  const [selectedPeriod, setSelectedPeriod] = useState<string>('today');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [orderData, setOrderData] = useState<OrderRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const periodOptions = useMemo(
    () =>
      PERIOD_OPTIONS.map((p) => ({
        value: p.value,
        label: isRtl ? p.labelAr : p.labelEn,
      })),
    [isRtl]
  );

  const getDateRange = useCallback(() => {
    const now = new Date();
    let start: Date, end: Date;

    const weekOptions = isRtl ? { weekStartsOn: 1, locale: arSA } : { weekStartsOn: 1 };

    switch (selectedPeriod) {
      case 'today':
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case 'week':
        start = startOfWeek(now, weekOptions);
        end = endOfWeek(now, weekOptions);
        break;
      case 'month':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'custom':
        if (!customStartDate || !customEndDate) return null;
        start = startOfDay(parseISO(customStartDate));
        end = endOfDay(parseISO(customEndDate));
        if (start > end) return null;
        break;
      default:
        return null;
    }

    return {
      start: start.toISOString(),
      end: end.toISOString(),
      label:
        selectedPeriod === 'custom'
          ? `${format(start, 'dd/MM/yyyy')} - ${format(end, 'dd/MM/yyyy')}`
          : periodOptions.find((p) => p.value === selectedPeriod)?.label || '',
    };
  }, [selectedPeriod, customStartDate, customEndDate, periodOptions, isRtl]);

  const allBranches = useMemo(
    () => branches.map((b) => b.displayName).sort((a, b) => a.localeCompare(b, language)),
    [branches, language]
  );

  const fetchData = useCallback(async () => {
    if (!user || (user.role !== 'admin' && user.role !== 'production')) {
      toast.error(isRtl ? 'لا يوجد صلاحية' : 'No access');
      setLoading(false);
      return;
    }

    const dateRange = getDateRange();
    if (!dateRange) {
      if (selectedPeriod === 'custom') {
        toast.warn(isRtl ? 'اختر تاريخ البداية والنهاية' : 'Select start and end dates');
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [inventory, ordersResponse, branchesResponse, salesResponse] = await Promise.all([
        inventoryAPI.getInventory({}, isRtl),
        ordersAPI.getAll({ startDate: dateRange.start, endDate: dateRange.end, page: 1, limit: 10000 }, isRtl),
        branchesAPI.getAll(),
        salesAPI.getAnalytics({
          startDate: dateRange.start,
          endDate: dateRange.end,
          lang: language,
        }),
      ]);

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

      const branchMap = new Map<string, string>(fetchedBranches.map((b) => [b._id, b.displayName]));
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
        toast.info(isRtl ? 'لا توجد طلبات في هذه الفترة' : 'No orders in this period');
      }

      const orderMap = new Map<string, OrderRow>();
      orders.forEach((order: any) => {
        const orderDate = new Date(order.createdAt || order.date);
        if (isNaN(orderDate.getTime())) return;

        if (!isWithinInterval(orderDate, { start: new Date(dateRange.start), end: new Date(dateRange.end) })) return;

        const branchId = order.branch?._id || order.branch || order.branchId;
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

          const key = productId;
          if (!orderMap.has(key)) {
            orderMap.set(key, {
              id: key,
              code: details.code,
              product: details.product,
              unit: details.unit,
              price: details.price,
              branchQuantities: {},
              totalQuantity: 0,
              totalPrice: 0,
              actualSales: 0,
            });
          }

          const row = orderMap.get(key)!;
          const quantity = Number(item.quantity) || 0;
          row.branchQuantities[branch] = (row.branchQuantities[branch] || 0) + quantity;
          row.totalQuantity += quantity;
          row.totalPrice += quantity * details.price;
        });
      });

      for (const row of orderMap.values()) {
        const salesItem = salesResponse.productSales?.find((s: any) => s.productId === row.id);
        if (salesItem) row.actualSales = Number(salesItem.totalQuantity) || 0;
      }

      setOrderData(Array.from(orderMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity));
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error(isRtl ? 'فشل في جلب البيانات' : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [user, getDateRange, language, isRtl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredData = useMemo(
    () => orderData.filter((row) => row.product.toLowerCase().includes(searchTerm.toLowerCase())),
    [orderData, searchTerm]
  );

  const grandTotalQuantity = useMemo(() => filteredData.reduce((sum, row) => sum + row.totalQuantity, 0), [filteredData]);
  const grandTotalPrice = useMemo(() => filteredData.reduce((sum, row) => sum + row.totalPrice, 0), [filteredData]);

  const periodLabel = useMemo(() => getDateRange()?.label || '', [getDateRange]);

  const getTooltipContent = (qty: number, isRtl: boolean) => `${isRtl ? 'الكمية: ' : 'Quantity: '}${qty > 0 ? '+' : ''}${formatNumber(qty, isRtl)}`;

  const exportTable = (format: 'excel' | 'pdf') => {
    const headers = [
      isRtl ? 'الاسم' : 'Name',
      isRtl ? 'السعر' : 'Price',
      isRtl ? 'الكود' : 'Code',
      ...allBranches,
      isRtl ? 'الإجمالي' : 'Total',
      isRtl ? 'وحدة' : 'Unit',
    ];

    const rows = [
      ...filteredData.map((row) => [
        row.product,
        formatPrice(row.price, isRtl),
        row.code,
        ...allBranches.map((branch) => formatNumber(row.branchQuantities[branch] || 0, isRtl)),
        formatNumber(row.totalQuantity, isRtl),
        row.unit,
      ]),
      [
        isRtl ? 'الإجمالي' : 'Total',
        formatPrice(grandTotalPrice, isRtl),
        '',
        ...allBranches.map((branch) =>
          formatNumber(filteredData.reduce((sum, row) => sum + (row.branchQuantities[branch] || 0), 0), isRtl)
        ),
        formatNumber(grandTotalQuantity, isRtl),
        '',
      ],
    ];

    if (format === 'excel') {
      exportToExcel(rows, headers, periodLabel, isRtl);
    } else if (format === 'pdf') {
      exportToPDF(
        rows,
        isRtl ? 'ملخص الطلبات' : 'Orders Summary',
        periodLabel,
        headers,
        isRtl,
        filteredData.length,
        grandTotalQuantity,
        grandTotalPrice
      );
    }
  };

  if (!user || (user.role !== 'admin' && user.role !== 'production')) {
    return <div className="text-center py-16 text-lg font-medium text-gray-800">{isRtl ? 'لا يوجد صلاحية' : 'No access'}</div>;
  }

  return (
    <div className={`min-h-screen px-4 py-8 ${isRtl ? 'rtl font-amiri' : 'ltr font-inter'} bg-gray-50`}>
      <div className="mb-6 bg-white shadow-md rounded-xl p-5 border border-gray-200">
        <div className="flex flex-col gap-5">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4`}>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-600" />
              {isRtl ? 'ملخص الطلبات' : 'Orders Summary'} - {periodLabel || '...'}
            </h2>
            <div className={`flex gap-2 items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
              <Button
                variant={filteredData.length > 0 ? 'primary' : 'secondary'}
                onClick={() => exportTable('excel')}
                disabled={filteredData.length === 0}
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'Excel' : 'Excel'}
              </Button>
              <Button
                variant={filteredData.length > 0 ? 'primary' : 'secondary'}
                onClick={() => exportTable('pdf')}
                disabled={filteredData.length === 0}
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'PDF' : 'PDF'}
              </Button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-4 items-center">
            <ProductDropdown
              value={selectedPeriod}
              onChange={setSelectedPeriod}
              options={periodOptions}
              ariaLabel={isRtl ? 'اختر الفترة' : 'Select period'}
              className="w-full sm:w-48"
            />
            {selectedPeriod === 'custom' && (
              <div className="flex gap-2 items-center w-full sm:w-auto">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm w-full sm:w-auto"
                />
                <span className="text-gray-600 hidden sm:inline">→</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm w-full sm:w-auto"
                />
              </div>
            )}
            <ProductSearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isRtl ? 'ابحث عن منتج...' : 'Search for product...'}
              ariaLabel={isRtl ? 'بحث المنتج' : 'Product search'}
              className="flex-1"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-600"></div>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          {isRtl ? 'لا توجد بيانات في هذه الفترة' : 'No data for this period'}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-x-auto rounded-xl shadow-md border border-gray-200 bg-white"
        >
          <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-amber-50 sticky top-0 z-10">
              <tr className={isRtl ? 'flex-row-reverse' : ''}>
                <th className="px-3 py-3 font-semibold text-gray-700 text-center min-w-[140px]">{isRtl ? 'الاسم' : 'Name'}</th>
                <th className="px-2 py-3 font-semibold text-gray-700 text-center min-w-[70px]">{isRtl ? 'السعر' : 'Price'}</th>
                <th className="px-2 py-3 font-semibold text-gray-700 text-center min-w-[70px]">{isRtl ? 'الكود' : 'Code'}</th>
                {allBranches.map((branch) => (
                  <th key={branch} className="px-2 py-3 font-semibold text-gray-700 text-center min-w-[85px] break-words">
                    {branch}
                  </th>
                ))}
                <th className="px-3 py-3 font-semibold text-gray-700 text-center min-w-[85px]">{isRtl ? 'الإجمالي' : 'Total'}</th>
                <th className="px-2 py-3 font-semibold text-gray-700 text-center min-w-[70px]">{isRtl ? 'وحدة' : 'Unit'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredData.map((row) => (
                <tr key={row.id} className="hover:bg-amber-50 transition-colors duration-200">
                  <td className="px-3 py-3 text-gray-700 text-center truncate max-w-[140px]" title={row.product}>
                    {row.product}
                  </td>
                  <td className="px-2 py-3 text-gray-700 text-center">{formatPrice(row.price, isRtl)}</td>
                  <td className="px-2 py-3 text-gray-700 text-center">{row.code}</td>
                  {allBranches.map((branch) => (
                    <td
                      key={branch}
                      className={`px-2 py-3 text-center font-medium ${
                        row.branchQuantities[branch] > 0 ? 'bg-green-50 text-green-700' : 'text-gray-700'
                      }`}
                      data-tooltip-id="branch-tooltip"
                      data-tooltip-content={getTooltipContent(row.branchQuantities[branch] || 0, isRtl)}
                    >
                      {row.branchQuantities[branch] !== 0 ? formatNumber(row.branchQuantities[branch] || 0, isRtl) : '0'}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalQuantity, isRtl)}</td>
                  <td className="px-2 py-3 text-gray-700 text-center">{row.unit}</td>
                </tr>
              ))}
              <tr className={`font-bold bg-gray-100 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <td className="px-3 py-3 text-gray-800 text-center">{isRtl ? 'الإجمالي' : 'Total'}</td>
                <td className="px-2 py-3 text-gray-800 text-center">{formatPrice(grandTotalPrice, isRtl)}</td>
                <td className="px-2 py-3 text-gray-800 text-center"></td>
                {allBranches.map((branch) => (
                  <td key={branch} className="px-2 py-3 text-gray-800 text-center">
                    {formatNumber(filteredData.reduce((sum, row) => sum + (row.branchQuantities[branch] || 0), 0), isRtl)}
                  </td>
                ))}
                <td className="px-3 py-3 text-gray-800 text-center">{formatNumber(grandTotalQuantity, isRtl)}</td>
                <td className="px-2 py-3 text-gray-800 text-center"></td>
              </tr>
            </tbody>
          </table>
          <Tooltip
            id="branch-tooltip"
            place="top"
            className="z-[9999] bg-white border border-gray-300 rounded-md p-3 shadow-xl max-w-xs text-xs text-gray-800 font-medium"
          />
        </motion.div>
      )}
    </div>
  );
};

export default DailyOrdersSummary;