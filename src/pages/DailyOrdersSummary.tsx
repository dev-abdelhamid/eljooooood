import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Upload, ChevronDown } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { inventoryAPI, ordersAPI, branchesAPI, salesAPI } from '../services/api';
import { toast } from 'react-toastify';
import { Tooltip } from 'react-tooltip';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  parseISO,
} from 'date-fns';

// ============================================================
// Interfaces
// ============================================================
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

// ============================================================
// Button Component
// ============================================================
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
    className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-200 ${
      variant === 'primary' && !disabled
        ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-lg hover:shadow-xl'
        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
    } ${className}`}
  >
    {children}
  </button>
);

// ============================================================
// Search Input
// ============================================================
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
        className={`absolute px-3 py-2 inset-y-0 ${isRtl ? 'left-3' : 'right-3'} flex items-center text-gray-400 transition-colors group-focus-within:text-amber-500`}
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
        className={`w-full ${isRtl ? 'pl-12 pr-4' : 'pr-12 pl-4'} px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white shadow-md hover:shadow-lg text-base placeholder-gray-500 ${isRtl ? 'text-right font-amiri' : 'text-left font-inter'}`}
        aria-label={ariaLabel}
      />
      {value && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          onClick={handleClear}
          className={`absolute px-3 py-2 inset-y-0 ${isRtl ? 'left-3' : 'right-3'} flex items-center text-gray-400 hover:text-amber-500 transition-colors focus:outline-none`}
          aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
        >
          <X className="w-5 h-5" />
        </motion.button>
      )}
    </div>
  );
};

// ============================================================
// Dropdown Component
// ============================================================
const ProductDropdown: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { [key: string]: string }[];
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}> = ({ value, onChange, options, ariaLabel, disabled = false, className }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((opt) => opt.value === value) || options[0];

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
        className={`w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 bg-gradient-to-r from-white to-gray-50 shadow-sm hover:shadow-md text-sm text-gray-700 ${isRtl ? 'text-right font-amiri' : 'text-left font-inter'} flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={ariaLabel}
      >
        <span className="truncate">{selectedOption?.label || (isRtl ? 'اختر' : 'Select')}</span>
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
                className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-600 transition-colors duration-200 text-left"
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

// ============================================================
// Utility Functions
// ============================================================
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
    const [regularFontBytes, boldFontBytes] = await Promise.all([
      fetch(fontUrls.regular).then((res) => res.arrayBuffer()),
      fetch(fontUrls.bold).then((res) => res.arrayBuffer()),
    ]);
    doc.addFileToVFS(`${fontName}-normal.ttf`, arrayBufferToBase64(regularFontBytes));
    doc.addFileToVFS(`${fontName}-bold.ttf`, arrayBufferToBase64(boldFontBytes));
    doc.addFont(`${fontName}-normal.ttf`, fontName, 'normal');
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
  return `${prefix}_${periodLabel.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}.${extension}`;
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
  const titleX = isRtl ? pageWidth - margin : margin;
  doc.text(title, titleX, 20, { align: isRtl ? 'right' : 'left' });

  doc.setFontSize(10);
  doc.setFont(fontLoaded ? fontName : 'helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  const stats = isRtl
    ? `الفترة: ${periodLabel} | إجمالي المنتجات: ${toArabicNumerals(totalItems)} | إجمالي الكمية: ${toArabicNumerals(totalQuantity)} وحدة | إجمالي المبلغ: ${formatPrice(totalPrice, isRtl)}`
    : `Period: ${periodLabel} | Total Products: ${totalItems} | Total Quantity: ${totalQuantity} units | Total Amount: ${formatPrice(totalPrice, isRtl)}`;
  const statsX = isRtl ? margin : pageWidth - margin;
  doc.text(stats, statsX, 28, { align: isRtl ? 'left' : 'right' });

  doc.setLineWidth(0.5);
  doc.setDrawColor(245, 158, 11);
  doc.line(margin, 32, pageWidth - margin, 32);

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
    startY: 35,
    margin: { top: 35, bottom: 15, left: margin, right: margin },
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
      textColor: [33, 33, 33],
      lineColor: [200, 200, 200],
      fillColor: [255, 255, 255],
      cellPadding: 1.5,
      minCellHeight: 6,
    },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' || hookData.section === 'head') {
        hookData.cell.text = hookData.cell.text.map(text => {
          const isCodeColumn = (isRtl && hookData.column.index === numColumns - 3) || (!isRtl && hookData.column.index === 2);
          return isCodeColumn ? text : toArabicNumerals(text);
        });
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
    const fileName = generateFileName('DailyOrdersSummary', periodLabel, isRtl, 'pdf');
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
    if ( toArabicNumerals ) ws['!views'] = [{ RTL: true }];
    ws['!cols'] = [
      { wch: 20 }, // Name
      { wch: 15 }, // Price
      { wch: 15 }, // Code
      ...Array(headers.length - 5).fill({ wch: 15 }),
      { wch: 15 }, // Total
      { wch: 15 }, // Unit
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Orders_${periodLabel}`);
    XLSX.writeFile(wb, generateFileName('DailyOrdersSummary', periodLabel, isRtl, 'xlsx'));
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

// ============================================================
// Main Component: DailyOrdersSummary
// ============================================================
type PeriodType = 'daily' | 'weekly' | 'monthly' | 'custom';

const DailyOrdersSummary: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();

  // Period State
  const [period, setPeriod] = useState<PeriodType>('daily');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // Data State
  const [orderData, setOrderData] = useState<OrderRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Compute Date Range
  const { start, end, label } = useMemo(() => {
    const now = new Date();
    let s: Date, e: Date, l: string;

    if (period === 'daily') {
      s = startOfDay(now);
      e = endOfDay(now);
      l = format(now, isRtl ? 'dd MMMM yyyy' : 'MMMM dd, yyyy');
    } else if (period === 'weekly') {
      s = startOfWeek(now, { weekStartsOn: 0 });
      e = endOfWeek(now, { weekStartsOn: 0 });
      l = isRtl ? 'هذا الأسبوع' : 'This Week';
    } else if (period === 'monthly') {
      s = startOfMonth(now);
      e = endOfMonth(now);
      l = format(now, isRtl ? 'MMMM yyyy' : 'MMMM yyyy');
    } else {
      const startDate = customStart ? parseISO(customStart) : startOfDay(now);
      const endDate = customEnd ? parseISO(customEnd) : endOfDay(now);
      s = startOfDay(startDate);
      e = endOfDay(endDate);
      l = `${format(startDate, 'dd/MM')} - ${format(endDate, 'dd/MM/yyyy')}`;
    }

    return { start: s, end: e, label: l };
  }, [period, customStart, customEnd, isRtl]);

  const allBranches = useMemo(() => 
    branches.map(b => b.displayName).sort((a, b) => a.localeCompare(b, language))
  , [branches, language]);

  // Fetch Data
  const fetchData = useCallback(async () => {
    if (!user || (user.role !== 'admin' && user.role !== 'production')) {
      toast.error(isRtl ? 'لا توجد صلاحية' : 'No access');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [inventory, ordersResponse, branchesResponse, salesResponse] = await Promise.all([
        inventoryAPI.getInventory({}, isRtl),
        ordersAPI.getAll({ page: 1, limit: 20000 }, isRtl),
        branchesAPI.getAll(),
        salesAPI.getAnalytics({
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          lang: language,
        }),
      ]);

      // Branches
      const fetchedBranches: Branch[] = (branchesResponse || [])
        .filter((b: any) => b?._id)
        .map((b: any) => ({
          _id: b._id,
          name: b.name || (isRtl ? 'غير معروف' : 'Unknown'),
          nameEn: b.nameEn || b.name,
          displayName: isRtl ? b.name : (b.nameEn || b.name),
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName, language));

      setBranches(fetchedBranches);
      const branchMap = new Map(fetchedBranches.map(b => [b._id, b.displayName]));

      // Product Details
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

      // Filter Approved Orders Only
      const approvedOrders = (Array.isArray(ordersResponse) ? ordersResponse : []).filter((order: any) => {
        const status = order.status || order.orderStatus;
        return ['completed', 'approved'].includes(status);
      });

      const orderMap = new Map<string, OrderRow>();
      approvedOrders.forEach((order: any) => {
        const orderDate = new Date(order.createdAt || order.date);
        if (isNaN(orderDate.getTime())) return;
        if (!isWithinInterval(orderDate, { start, end })) return;

        const branchId = order.branch?._id || order.branch || order.branchId;
        const branchName = branchMap.get(branchId) || (isRtl ? 'الفرع الرئيسي' : 'Main Branch');

        (order.items || []).forEach((item: any) => {
          const productId = item.product?._id || item.productId;
          if (!productId) return;

          const details = productDetails.get(productId) || {
            code: item.product?.code || '',
            product: isRtl ? (item.product?.name || '') : (item.product?.nameEn || ''),
            unit: isRtl ? (item.product?.unit || '') : (item.product?.unitEn || ''),
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
          const qty = Number(item.quantity) || 0;
          row.branchQuantities[branchName] = (row.branchQuantities[branchName] || 0) + qty;
          row.totalQuantity += qty;
          row.totalPrice += qty * details.price;
        });
      });

      // Actual Sales
      for (const row of orderMap.values()) {
        const salesItem = salesResponse.productSales?.find((s: any) => s.productId === row.id);
        if (salesItem) row.actualSales = Number(salesItem.totalQuantity) || 0;
      }

      setOrderData(Array.from(orderMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity));
    } catch (error) {
      console.error('Fetch Error:', error);
      toast.error(isRtl ? 'فشل في جلب البيانات' : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [user, start, end, isRtl, language]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered Data
  const filteredData = useMemo(() => {
    return orderData.filter(row => row.product.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [orderData, searchTerm]);

  const grandTotalQuantity = useMemo(() => filteredData.reduce((sum, row) => sum + row.totalQuantity, 0), [filteredData]);
  const grandTotalPrice = useMemo(() => filteredData.reduce((sum, row) => sum + row.totalPrice, 0), [filteredData]);

  // Tooltip
  const getTooltipContent = (qty: number, isRtl: boolean) => `${isRtl ? 'الكمية: ' : 'Quantity: '}${qty > 0 ? '+' : ''}${formatNumber(qty, isRtl)}`;

  // Export
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
      ...filteredData.map(row => [
        row.product,
        formatPrice(row.price, isRtl),
        row.code,
        ...allBranches.map(b => formatNumber(row.branchQuantities[b] || 0, isRtl)),
        formatNumber(row.totalQuantity, isRtl),
        row.unit,
      ]),
      [
        isRtl ? 'الإجمالي' : 'Total',
        formatPrice(grandTotalPrice, isRtl),
        '',
        ...allBranches.map(b => formatNumber(filteredData.reduce((s, r) => s + (r.branchQuantities[b] || 0), 0), isRtl)),
        formatNumber(grandTotalQuantity, isRtl),
        '',
      ],
    ];

    if (format === 'pdf') {
      exportToPDF(rows, isRtl ? 'ملخص الطلبات اليومية' : 'Daily Orders Summary', label, headers, isRtl, filteredData.length, grandTotalQuantity, grandTotalPrice);
    } else {
      exportToExcel(rows, headers, label, isRtl);
    }
  };

  if (!user || (user.role !== 'admin' && user.role !== 'production')) {
    return <div className="text-center py-16 text-lg font-medium text-gray-800">{isRtl ? 'لا توجد صلاحية' : 'No access'}</div>;
  }

  return (
    <div className={`min-h-screen px-4 py-8 ${isRtl ? 'rtl font-amiri' : 'ltr font-inter'} bg-gray-50`}>
      <div className="mb-6 bg-white shadow-md rounded-xl p-4 border border-gray-200">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-lg font-bold text-gray-800">
              {isRtl ? 'ملخص الطلبات اليومية' : 'Daily Orders Summary'} - {label}
            </h2>
            <div className="flex flex-wrap gap-2 items-center">
              <ProductDropdown
                value={period}
                onChange={(v) => { setPeriod(v as PeriodType); setCustomStart(''); setCustomEnd(''); }}
                options={[
                  { value: 'daily', label: isRtl ? 'يومي' : 'Daily' },
                  { value: 'weekly', label: isRtl ? 'أسبوعي' : 'Weekly' },
                  { value: 'monthly', label: isRtl ? 'شهري' : 'Monthly' },
                  { value: 'custom', label: isRtl ? 'فترة مخصصة' : 'Custom Range' },
                ]}
                ariaLabel={isRtl ? 'اختر الفترة' : 'Select period'}
                className="w-44"
              />
              {period === 'custom' && (
                <div className="flex gap-2 items-center">
                  <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="px-3 py-1.5 border rounded text-sm" />
                  <span className="text-gray-600">—</span>
                  <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="px-3 py-1.5 border rounded text-sm" />
 vaping                </div>
              )}
              <Button
                variant={filteredData.length > 0 ? 'primary' : 'secondary'}
                onClick={() => exportTable('pdf')}
                disabled={filteredData.length === 0}
              >
                <Upload className="w-4 h-4" />
                PDF
              </Button>
            </div>
          </div>
          <ProductSearchInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isRtl ? 'ابحث عن منتج...' : 'Search product...'}
            ariaLabel={isRtl ? 'بحث' : 'Search'}
            className="flex-1"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-600"></div>
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
                <th className="px-2 py-3 font-semibold text-gray-700 text-center min-w-[120px]">{isRtl ? 'الاسم' : 'Name'}</th>
                <th className="px-1 py-3 font-semibold text-gray-700 text-center min-w-[60px]">{isRtl ? 'السعر' : 'Price'}</th>
                <th className="px-1 py-3 font-semibold text-gray-700 text-center min-w-[60px]">{isRtl ? 'الكود' : 'Code'}</th>
                {allBranches.map((branch) => (
                  <th key={branch} className="px-2 py-3 font-semibold text-gray-700 text-center min-w-[80px]">
                    {branch}
                  </th>
                ))}
                <th className="px-2 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'الإجمالي' : 'Total'}</th>
                <th className="px-2 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'وحدة' : 'Unit'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredData.map((row) => (
                <tr key={row.id} className="hover:bg-amber-50 transition-colors duration-200">
                  <td className="px-2 py-3 text-gray-700 text-center truncate">{row.product}</td>
                  <td className="px-1 py-3 text-gray-700 text-center">{formatPrice(row.price, isRtl)}</td>
                  <td className="px-1 py-3 text-gray-700 text-center">{row.code}</td>
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
                  <td className="px-2 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalQuantity, isRtl)}</td>
                  <td className="px-2 py-3 text-gray-700 text-center">{row.unit}</td>
                </tr>
              ))}
              <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <td className="px-2 py-3 text-gray-800 text-center">{isRtl ? 'الإجمالي' : 'Total'}</td>
                <td className="px-1 py-3 text-gray-800 text-center">{formatPrice(grandTotalPrice, isRtl)}</td>
                <td className="px-1 py-3 text-gray-800 text-center"></td>
                {allBranches.map((branch) => (
                  <td key={branch} className="px-2 py-3 text-gray-800 text-center">
                    {formatNumber(filteredData.reduce((sum, row) => sum + (row.branchQuantities[branch] || 0), 0), isRtl)}
                  </td>
                ))}
                <td className="px-2 py-3 text-gray-800 text-center">{formatNumber(grandTotalQuantity, isRtl)}</td>
                <td className="px-2 py-3 text-gray-800 text-center"></td>
              </tr>
            </tbody>
          </table>
          <Tooltip
            id="branch-tooltip"
            place="top"
            className="custom-tooltip whitespace-pre-line z-[9999] shadow-xl bg-white border border-gray-300 rounded-md p-3 max-w-sm text-xs text-gray-800 font-medium"
          />
        </motion.div>
      )}
    </div>
  );
};

export default DailyOrdersSummary;