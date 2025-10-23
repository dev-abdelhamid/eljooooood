import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Upload, ChevronDown, Calendar } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { inventoryAPI, ordersAPI, branchesAPI, salesAPI, productsAPI } from '../services/api';
import { toast } from 'react-toastify';
import { Tooltip } from 'react-tooltip';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  startOfDay,
  endOfDay,
  subDays,
  subMonths,
  format,
  isWithinInterval,
  parseISO,
  format as dateFormat,
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

interface Product {
  _id: string;
  name: string;
  nameEn?: string;
  code: string;
  unit?: string;
  unitEn?: string;
  price: number;
}

// Period options
const PERIOD_OPTIONS = [
  { value: 'today', labelAr: 'اليوم', labelEn: 'Today' },
  { value: 'week', labelAr: 'آخر 7 أيام', labelEn: 'Last 7 Days' },
  { value: 'month', labelAr: 'آخر 30 يوم', labelEn: 'Last 30 Days' },
  { value: 'custom', labelAr: 'فترة مخصصة', labelEn: 'Custom Range' },
];

// Arabic day names
const ARABIC_DAY_NAMES = [
  'الأحد',
  'الإثنين', 
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت'
];

// English day names
const ENGLISH_DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
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
    className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-300 shadow-sm hover:shadow-md ${
      variant === 'primary' && !disabled
        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700'
        : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600'
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
        className={`absolute inset-y-0 ${isRtl ? 'left-3' : 'right-3'} flex items-center px-2 text-gray-400 transition-all duration-300 group-focus-within:text-amber-500`}
        initial={false}
        animate={{ opacity: value ? 0 : 1, scale: value ? 0.8 : 1 }}
        transition={{ duration: 0.2 }}
      >
        <Search className="w-4 h-4" />
      </motion.div>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full ${isRtl ? 'pl-11 pr-3' : 'pr-11 pl-3'} px-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 bg-white/80 backdrop-blur-sm text-sm placeholder-gray-500 shadow-sm ${isRtl ? 'text-right font-amiri' : 'text-left font-inter'}`}
        aria-label={ariaLabel}
      />
      {value && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          onClick={handleClear}
          className={`absolute inset-y-0 ${isRtl ? 'left-3' : 'right-3'} flex items-center px-2 text-gray-400 hover:text-amber-500 transition-all duration-300`}
          aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
        >
          <X className="w-4 h-4" />
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
        className={`w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 bg-white/80 backdrop-blur-sm shadow-sm text-sm text-gray-700 hover:shadow-md ${isRtl ? 'text-right font-amiri' : 'text-left font-inter'} flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={ariaLabel}
      >
        <span className="truncate">{selectedOption.label}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <ChevronDown className="w-5 h-5 text-gray-400" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 w-full mt-2 bg-white/90 backdrop-blur-sm border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto"
          >
            {options.map((option) => (
              <motion.button
                key={option.value}
                whileHover={{ x: isRtl ? -2 : 2, backgroundColor: '#FEF3C7' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className="w-full px-4 py-3 text-sm text-gray-700 hover:bg-amber-50/50 transition-all duration-200 text-left border-b last:border-b-0 border-gray-50/50"
              >
                {option.label}
              </motion.button>
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
  return isRtl ? toArabicNumerals(num.toString()) : num.toString();
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
  fontName: string,
  fontLoaded: boolean
) => {
  const pageWidth = doc.internal.pageSize.width;
  const margin = 15;

  // Professional header background
  doc.setFillColor(249, 250, 251);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  // Decorative line
  doc.setDrawColor(255, 193, 7);
  doc.setLineWidth(2);
  doc.line(margin, 8, pageWidth - margin, 8);

  doc.setFont(fontLoaded ? fontName : 'helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(17, 24, 39);

  const titleX = isRtl ? margin : pageWidth - margin - doc.getTextWidth(title);
  doc.text(title, titleX, 20, { align: isRtl ? 'left' : 'right' });

  doc.setFontSize(11);
  doc.setFont(fontLoaded ? fontName : 'helvetica', 'normal');
  doc.setTextColor(107, 114, 128);

  const periodX = isRtl ? pageWidth - margin - doc.getTextWidth(periodLabel) : margin;
  doc.text(periodLabel, periodX, 28, { align: isRtl ? 'right' : 'left' });

  // Separator line
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(1);
  doc.line(margin, 42, pageWidth - margin, 42);

  // Footer on all pages
  const currentDate = new Date().toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  doc.setFontSize(9);
  doc.setTextColor(156, 163, 175);
  const footerText = isRtl
    ? `نظام إدارة الجودياء • ${toArabicNumerals(currentDate)}`
    : `Elgoodia Management System • ${currentDate}`;
  doc.text(footerText, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
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
  const margin = 12;
  const maxTableWidth = pageWidth - 2 * margin;
  const columnWidth = maxTableWidth / numColumns;

  autoTable(doc, {
    head: [isRtl ? headers.slice().reverse() : headers],
    body: isRtl ? data.map(row => row.slice().reverse()) : data,
    theme: 'grid',
    startY: 50,
    margin: { top: 25, bottom: 20, left: margin, right: margin },
    tableWidth: 'auto',
    columnStyles: headers.reduce((styles, _, i) => {
      const index = isRtl ? numColumns - 1 - i : i;
      styles[index] = { 
        cellWidth: columnWidth, 
        halign: 'center', 
        valign: 'middle', 
        fontSize: 9, 
        overflow: 'linebreak', 
        cellPadding: 6 
      };
      return styles;
    }, {} as any),
    headStyles: {
      fillColor: [255, 193, 7],
      textColor: [33, 33, 33],
      fontSize: 11,
      halign: 'center',
      valign: 'middle',
      font: fontLoaded ? fontName : 'helvetica',
      fontStyle: 'bold',
      cellPadding: 8,
      lineWidth: 0.5,
      lineColor: [255, 193, 7],
    },
    bodyStyles: {
      fontSize: 9,
      halign: 'center',
      valign: 'middle',
      font: fontLoaded ? fontName : 'helvetica',
      textColor: [51, 65, 85],
      lineColor: [243, 244, 246],
      fillColor: [255, 255, 255],
      cellPadding: 6,
      lineWidth: 0.5,
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.row.index === data.length - 1) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fillColor = [255, 193, 7];
        hookData.cell.styles.textColor = [255, 255, 255];
      }
      if (hookData.section === 'body' || hookData.section === 'head') {
        if (hookData.column.index !== 2) { // Exclude code column
          hookData.cell.text = hookData.cell.text.map(text => {
            if (typeof text === 'string' && /[0-9]/.test(text)) {
              return text.replace(/[0-9]/g, d => toArabicNumerals(d));
            }
            return text;
          });
        }
      }
    },
    didDrawPage: (data) => {
      // Page number
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(9);
      doc.setTextColor(156, 163, 175);
      doc.text(`الصفحة ${data.pageNumber} من ${pageCount}`, pageWidth / 2, doc.internal.pageSize.height - 25, { align: 'center' });
    },
  });
};

const exportToPDF = async (
  data: any[][],
  title: string,
  periodLabel: string,
  headers: string[],
  isRtl: boolean
) => {
  try {
    toast.info(isRtl ? 'جارٍ إنشاء ملف PDF بتصميم احترافي...' : 'Creating professional PDF...', {
      position: isRtl ? 'top-left' : 'top-right',
      autoClose: false,
      toastId: 'pdf-export',
    });
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const fontName = 'Amiri';
    const fontLoaded = await loadFont(doc);
    generatePDFHeader(doc, isRtl, title, periodLabel, fontName, fontLoaded);
    generatePDFTable(doc, headers, data, isRtl, fontLoaded, fontName);
    const fileName = generateFileName('OrdersSummary', periodLabel, isRtl, 'pdf');
    doc.save(fileName);
    toast.update('pdf-export', {
      render: isRtl ? '✅ تم تصدير ملف PDF بنجاح' : '✅ PDF exported successfully',
      type: 'success',
      autoClose: 3000,
    });
  } catch (error) {
    console.error('Error exporting PDF:', error);
    toast.update('pdf-export', {
      render: isRtl ? '❌ فشل في تصدير ملف PDF' : '❌ Failed to export PDF',
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
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Orders_${periodLabel.substring(0, 20)}`);
    XLSX.writeFile(wb, generateFileName('OrdersSummary', periodLabel, isRtl, 'xlsx'));
    toast.update('excel-export', {
      render: isRtl ? '✅ تم تصدير ملف Excel بنجاح' : '✅ Excel exported successfully',
      type: 'success',
      autoClose: 3000,
    });
  } catch (error) {
    console.error('Error exporting Excel:', error);
    toast.update('excel-export', {
      render: isRtl ? '❌ فشل في تصدير ملف Excel' : '❌ Failed to export Excel',
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
  const [products, setProducts] = useState<Product[]>([]);
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
    let label = '';

    switch (selectedPeriod) {
      case 'today':
        start = startOfDay(now);
        end = endOfDay(now);
        const dayIndex = now.getDay();
        const dayName = isRtl ? ARABIC_DAY_NAMES[dayIndex] : ENGLISH_DAY_NAMES[dayIndex];
        const dateStr = dateFormat(now, 'dd/MM/yyyy', { locale: isRtl ? arSA : undefined });
        label = isRtl 
          ? `${dayName} - ${dateStr}` 
          : `${dayName}, ${dateStr}`;
        break;
      case 'week':
        start = subDays(now, 6);
        end = endOfDay(now);
        label = periodOptions.find((p) => p.value === selectedPeriod)?.label || '';
        break;
      case 'month':
        start = subMonths(now, 1);
        end = endOfDay(now);
        label = periodOptions.find((p) => p.value === selectedPeriod)?.label || '';
        break;
      case 'custom':
        if (!customStartDate || !customEndDate) return null;
        start = startOfDay(parseISO(customStartDate));
        end = endOfDay(parseISO(customEndDate));
        if (start > end) {
          toast.warn(isRtl ? 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية' : 'End date must be after start date');
          return null;
        }
        label = `${dateFormat(start, 'dd/MM/yyyy', { locale: isRtl ? arSA : undefined })} - ${dateFormat(end, 'dd/MM/yyyy', { locale: isRtl ? arSA : undefined })}`;
        break;
      default:
        return null;
    }

    return {
      start: start.toISOString(),
      end: end.toISOString(),
      label,
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
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [inventory, branchesResponse, salesResponse, productsResponse] = await Promise.all([
        inventoryAPI.getInventory({}, isRtl),
        branchesAPI.getAll(),
        salesAPI.getAnalytics({ startDate: dateRange.start, endDate: dateRange.end, lang: language }),
        productsAPI.getAll({ limit: 0 }),
      ]);

      const fetchedBranches = Array.isArray(branchesResponse)
        ? branchesResponse
            .filter((branch: any) => branch && branch._id)
            .map((branch: any) => ({
              _id: branch._id,
              name: branch.name || (isRtl ? 'غير معروف' : 'Unknown'),
              nameEn: branch.nameEn || branch.name,
              displayName: isRtl ? branch.name : branch.nameEn || branch.name,
            }))
            .sort((a: Branch, b: Branch) => a.displayName.localeCompare(b.displayName, language))
        : [];
      setBranches(fetchedBranches);

      const fetchedProducts = Array.isArray(productsResponse)
        ? productsResponse.map((product: any) => ({
            _id: product._id,
            name: product.name,
            nameEn: product.nameEn,
            code: product.code || 'N/A',
            unit: product.unit,
            unitEn: product.unitEn,
            price: Number(product.price) || 0,
          }))
        : [];
      setProducts(fetchedProducts);

      const branchMap = new Map<string, string>(fetchedBranches.map((b) => [b._id, b.displayName]));
      const productDetails = new Map<string, { code: string; product: string; unit: string; price: number }>();

      fetchedProducts.forEach((product) => {
        productDetails.set(product._id, {
          code: product.code,
          product: isRtl ? product.name : (product.nameEn || product.name),
          unit: isRtl ? (product.unit || 'غير محدد') : (product.unitEn || product.unit || 'N/A'),
          price: product.price,
        });
      });

      (Array.isArray(inventory) ? inventory : []).forEach((item: any) => {
        if (item?.product?._id && !productDetails.has(item.product._id)) {
          productDetails.set(item.product._id, {
            code: item.product.code || 'N/A',
            product: isRtl ? (item.product.name || 'منتج غير معروف') : (item.product.nameEn || item.product.name || 'Unknown Product'),
            unit: isRtl ? (item.product.unit || 'غير محدد') : (item.product.unitEn || item.product.unit || 'N/A'),
            price: Number(item.product.price) || 0,
          });
        }
      });

      // Full pagination to fetch all orders
      let allOrders: any[] = [];
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const ordersResponse = await ordersAPI.getAll({ startDate: dateRange.start, endDate: dateRange.end, page, limit: 5000 }, isRtl);
        const fetchedOrders = Array.isArray(ordersResponse) ? ordersResponse : [];
        allOrders = [...allOrders, ...fetchedOrders];
        hasMore = fetchedOrders.length === 5000;
        page++;
      }

      const orderMap = new Map<string, OrderRow>();
      allOrders.forEach((order: any) => {
        const orderDate = parseISO(order.createdAt || order.date || '1970-01-01');
        if (isNaN(orderDate.getTime())) {
          console.warn('Invalid order date:', order.createdAt || order.date);
          return;
        }

        if (!isWithinInterval(orderDate, { start: parseISO(dateRange.start), end: parseISO(dateRange.end) })) {
          return;
        }

        const branchId = order.branch?._id || order.branch || order.branchId;
        const branch = branchMap.get(branchId) || (isRtl ? 'الفرع الرئيسي' : 'Main Branch');

        (order.items || []).forEach((item: any) => {
          const productId = item.product?._id || item.productId;
          if (!productId) return;

          const details = productDetails.get(productId) || {
            code: item.product?.code || 'N/A',
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
    () => orderData.filter((row) => 
      row.product.toLowerCase().includes(searchTerm.toLowerCase()) || 
      row.code.toLowerCase().includes(searchTerm.toLowerCase())
    ),
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
        isRtl ? 'الإجمالي العام' : 'GRAND TOTAL',
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
      exportToPDF(rows, isRtl ? '📊 ملخص الطلبات اليومية' : '📊 Daily Orders Summary', periodLabel, headers, isRtl);
    }
  };

  if (!user || (user.role !== 'admin' && user.role !== 'production')) {
    return (
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        className="text-center py-16 text-base font-semibold text-red-600 bg-gradient-to-r from-red-50/50 to-pink-50/50 rounded-2xl p-8 border border-red-200/50"
      >
        🚫 {isRtl ? 'لا يوجد صلاحية للوصول لهذه الصفحة' : 'No access permission'}
      </motion.div>
    );
  }

  return (
    <div className={`min-h-screen px-4 py-8 ${isRtl ? 'rtl font-amiri' : 'ltr font-inter'} bg-gradient-to-br from-slate-50 via-blue-50/20 to-amber-50/30`}>
      {/* Enhanced Header Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="mb-8 bg-white/70 backdrop-blur-lg shadow-xl rounded-2xl p-6 border border-white/20"
      >
        <div className="flex flex-col gap-6">
          <div className={`flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4`}>
            <motion.div 
              initial={{ opacity: 0, x: isRtl ? 20 : -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              className="flex flex-col gap-2"
            >
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Calendar className="w-8 h-8 text-amber-600 bg-amber-100/60 rounded-xl p-2" />
                {isRtl ? '📊 ملخص الطلبات' : '📊 Orders Summary'}
              </h1>
              <motion.p 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="text-sm font-medium text-amber-700 bg-amber-50/60 rounded-lg px-4 py-2 max-w-2xl"
              >
                {periodLabel || '...'}
              </motion.p>
            </motion.div>
            <motion.div 
              className={`flex flex-wrap gap-3 items-center ${isRtl ? 'flex-row-reverse' : ''}`}
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: 0.2 }}
            >
              <Button
                variant={filteredData.length > 0 ? 'primary' : 'secondary'}
                onClick={() => exportTable('excel')}
                disabled={filteredData.length === 0}
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير Excel' : 'Export Excel'}
              </Button>
              <Button
                variant={filteredData.length > 0 ? 'primary' : 'secondary'}
                onClick={() => exportTable('pdf')}
                disabled={filteredData.length === 0}
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير PDF' : 'Export PDF'}
              </Button>
            </motion.div>
          </div>

          {/* Enhanced Filters */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.3 }}
            className="flex flex-col xl:flex-row gap-4 items-stretch xl:items-center"
          >
            <ProductDropdown
              value={selectedPeriod}
              onChange={setSelectedPeriod}
              options={periodOptions}
              ariaLabel={isRtl ? 'اختر الفترة' : 'Select period'}
              className="w-full xl:w-48"
            />
            {selectedPeriod === 'custom' && (
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center w-full sm:w-auto">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 bg-white/80 shadow-sm"
                />
                <span className="hidden sm:inline-flex items-center justify-center text-gray-400 px-4 font-medium">
                  {isRtl ? 'إلى' : 'to'}
                </span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 bg-white/80 shadow-sm"
                />
              </div>
            )}
            <ProductSearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isRtl ? '🔍 ابحث عن منتج أو كود...' : '🔍 Search for product or code...'}
              ariaLabel={isRtl ? 'بحث المنتج أو الكود' : 'Product or code search'}
              className="flex-1"
            />
          </motion.div>
        </div>
      </motion.div>

      {loading ? (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="flex justify-center items-center py-20"
        >
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-amber-600"></div>
            <div className="absolute inset-0 rounded-full h-16 w-16 border-4 border-amber-100/30 animate-pulse"></div>
            <p className="mt-6 text-sm font-medium text-gray-600">{isRtl ? 'جاري تحميل بيانات الطلبات...' : 'Loading orders data...'}</p>
          </div>
        </motion.div>
      ) : filteredData.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }} 
          animate={{ opacity: 1, scale: 1 }} 
          className="text-center py-20 bg-white/70 backdrop-blur-lg rounded-2xl shadow-xl p-12 border border-dashed border-gray-200/50"
        >
          <Calendar className="w-24 h-24 text-gray-300 mx-auto mb-6" />
          <p className="text-lg font-semibold text-gray-600 mb-2">{isRtl ? 'لا توجد بيانات' : 'No data available'}</p>
          <p className="text-sm text-gray-500 max-w-2xl mx-auto">
            {isRtl 
              ? 'لم يتم العثور على طلبات في هذه الفترة المحددة'
              : 'No orders found for the selected period'
            }
          </p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white/70 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200/50">
              <thead className="bg-gradient-to-r from-amber-50/80 to-yellow-50/80 sticky top-0 z-20 backdrop-blur-sm">
                <tr className={isRtl ? 'flex-row-reverse' : ''}>
                  <th className="px-4 py-4 font-semibold text-gray-700 text-center min-w-[160px] rounded-tl-xl">
                    {isRtl ? 'الاسم' : 'Name'}
                  </th>
                  <th className="px-3 py-4 font-semibold text-gray-700 text-center min-w-[80px]">
                    {isRtl ? 'السعر' : 'Price'}
                  </th>
                  <th className="px-3 py-4 font-semibold text-gray-700 text-center min-w-[80px]">
                    {isRtl ? 'الكود' : 'Code'}
                  </th>
                  {allBranches.map((branch) => (
                    <th key={branch} className="px-3 py-4 font-semibold text-gray-700 text-center min-w-[90px] break-words">
                      {branch}
                    </th>
                  ))}
                  <th className="px-4 py-4 font-semibold text-gray-700 text-center min-w-[90px] rounded-tr-xl">
                    {isRtl ? 'الإجمالي' : 'Total'}
                  </th>
                  <th className="px-3 py-4 font-semibold text-gray-700 text-center min-w-[80px]">
                    {isRtl ? 'وحدة' : 'Unit'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200/30 bg-white/50">
                {filteredData.map((row, index) => (
                  <motion.tr 
                    key={row.id} 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-amber-50/50 transition-all duration-300"
                  >
                    <td className="px-4 py-4 text-gray-700 text-center truncate max-w-[160px]" title={row.product}>
                      <div className="font-medium">{row.product}</div>
                    </td>
                    <td className="px-3 py-4 text-gray-700 text-center font-mono">{formatPrice(row.price, isRtl)}</td>
                    <td className="px-3 py-4 text-gray-700 text-center font-mono font-semibold bg-gray-50/50 rounded-lg">
                      {row.code}
                    </td>
                    {allBranches.map((branch) => {
                      const qty = row.branchQuantities[branch] || 0;
                      return (
                        <td
                          key={branch}
                          className={`px-3 py-4 text-center font-semibold ${
                            qty > 0 
                              ? 'bg-gradient-to-r from-emerald-50/60 to-teal-50/60 text-emerald-700' 
                              : 'text-gray-500'
                          } rounded-lg`}
                          data-tooltip-id="branch-tooltip"
                          data-tooltip-content={getTooltipContent(qty, isRtl)}
                        >
                          {formatNumber(qty, isRtl)}
                        </td>
                      );
                    })}
                    <td className="px-4 py-4 text-gray-700 text-center font-bold text-lg bg-gradient-to-r from-amber-50/60 to-yellow-50/60 rounded-lg">
                      {formatNumber(row.totalQuantity, isRtl)}
                    </td>
                    <td className="px-3 py-4 text-gray-700 text-center font-medium">{row.unit}</td>
                  </motion.tr>
                ))}
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className={`bg-gradient-to-r from-amber-500/10 to-yellow-500/10 ${isRtl ? 'flex-row-reverse' : ''}`}
                >
                  <td className="px-4 py-5 text-center">
                    <span className="text-lg font-bold text-amber-800 bg-amber-100/40 px-4 py-2 rounded-full">
                      {isRtl ? 'الإجمالي العام' : 'GRAND TOTAL'}
                    </span>
                  </td>
                  <td className="px-3 py-5 text-center">
                    <span className="font-bold text-lg text-amber-800 bg-amber-100/40 px-3 py-2 rounded-full">
                      {formatPrice(grandTotalPrice, isRtl)}
                    </span>
                  </td>
                  <td className="px-3 py-5 text-center"></td>
                  {allBranches.map((branch) => (
                    <td key={branch} className="px-3 py-5 text-center">
                      <span className="font-bold text-amber-700 bg-amber-100/40 px-3 py-2 rounded-full">
                        {formatNumber(filteredData.reduce((sum, row) => sum + (row.branchQuantities[branch] || 0), 0), isRtl)}
                      </span>
                    </td>
                  ))}
                  <td className="px-4 py-5 text-center">
                    <span className="text-2xl font-extrabold text-amber-800 bg-gradient-to-r from-amber-100/60 to-yellow-100/60 px-6 py-3 rounded-full shadow-lg">
                      {formatNumber(grandTotalQuantity, isRtl)}
                    </span>
                  </td>
                  <td className="px-3 py-5 text-center"></td>
                </motion.tr>
              </tbody>
            </table>
          </div>
          <Tooltip
            id="branch-tooltip"
            place="top"
            className="z-[9999] bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-xl p-3 shadow-lg max-w-xs text-xs text-gray-800 font-medium"
          />
        </motion.div>
      )}
    </div>
  );
};

export default DailyOrdersSummary;