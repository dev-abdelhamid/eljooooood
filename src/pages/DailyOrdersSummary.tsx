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
  subDays,
  subMonths,
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

const PERIOD_OPTIONS = [
  { value: 'today', labelAr: 'اليوم', labelEn: 'Today' },
  { value: 'week', labelAr: 'آخر 7 أيام', labelEn: 'Last 7 Days' },
  { value: 'month', labelAr: 'آخر 30 يوم', labelEn: 'Last 30 Days' },
  { value: 'custom', labelAr: 'فترة مخصصة', labelEn: 'Custom Range' },
];

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
    className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all duration-200 ${
      variant === 'primary' && !disabled
        ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-md hover:shadow-lg'
        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
    } ${className}`}
  >
    {children}
  </button>
);

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
        className={`absolute inset-y-0 ${isRtl ? 'left-2' : 'right-2'} flex items-center px-2 text-gray-400 transition-colors group-focus-within:text-amber-500`}
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
        className={`w-full ${isRtl ? 'pl-8 pr-2' : 'pr-8 pl-2'} px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all bg-white text-sm placeholder-gray-500 ${isRtl ? 'text-right font-amiri' : 'text-left font-inter'}`}
        aria-label={ariaLabel}
      />
      {value && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          onClick={handleClear}
          className={`absolute inset-y-0 ${isRtl ? 'left-2' : 'right-2'} flex items-center px-2 text-gray-400 hover:text-amber-500 transition-colors`}
          aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
        >
          <X className="w-4 h-4" />
        </motion.button>
      )}
    </div>
  );
};

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
        className={`w-full px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all bg-white shadow-sm text-sm text-gray-700 ${isRtl ? 'text-right font-amiri' : 'text-left font-inter'} flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={ariaLabel}
      >
        <span className="truncate">{selectedOption.label}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-lg shadow-lg max-h-48 overflow-y-auto"
          >
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-1.5 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-600 transition-colors text-left"
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
  const dateStr = new Date('2025-10-21').toISOString().split('T')[0];
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
  const margin = 15;

  doc.setFillColor(220, 220, 220);
  doc.rect(0, 0, pageWidth, 20, 'F');

  doc.setFont(fontLoaded ? fontName : 'helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(50, 50, 50);

  const titleX = isRtl ? margin : pageWidth - margin - doc.getTextWidth(title);
  doc.text(title, titleX, 15, { align: isRtl ? 'left' : 'right' });

  const stats = isRtl
    ? `المنتجات: ${toArabicNumerals(totalItems)} | الكمية: ${toArabicNumerals(totalQuantity)} وحدة | المبلغ: ${formatPrice(totalPrice, isRtl)}`
    : `Products: ${totalItems} | Quantity: ${totalQuantity} units | Amount: ${formatPrice(totalPrice, isRtl)}`;
  const statsX = isRtl ? pageWidth - margin - doc.getTextWidth(stats) : margin;
  doc.text(stats, statsX, 15, { align: isRtl ? 'right' : 'left' });

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, 22, pageWidth - margin, 22);

  const currentDate = new Date('2025-10-21T16:26:00').toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  const footerText = isRtl
    ? `نظام إدارة الجودياء - ${toArabicNumerals(currentDate)}`
    : `Elgoodia Management System - ${currentDate}`;
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
  const margin = 10;
  const maxTableWidth = pageWidth - 2 * margin;
  const columnWidth = maxTableWidth / numColumns;

  autoTable(doc, {
    head: [isRtl ? headers.slice().reverse() : headers],
    body: isRtl ? data.map(row => row.slice().reverse()) : data,
    theme: 'grid',
    startY: 25,
    margin: { top: 25, bottom: 15, left: margin, right: margin },
    tableWidth: 'auto',
    columnStyles: headers.reduce((styles, _, i) => {
      const index = isRtl ? numColumns - 1 - i : i;
      styles[index] = { cellWidth: columnWidth, halign: 'center', valign: 'middle', fontSize: 8 };
      return styles;
    }, {}),
    headStyles: {
      fillColor: [220, 220, 220],
      textColor: [50, 50, 50],
      fontSize: 10,
      halign: 'center',
      valign: 'middle',
      font: fontLoaded ? fontName : 'helvetica',
      fontStyle: 'bold',
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 8,
      halign: 'center',
      valign: 'middle',
      font: fontLoaded ? fontName : 'helvetica',
      textColor: [33, 33, 33],
      lineColor: [200, 200, 200],
      fillColor: [255, 255, 255],
      cellPadding: 2,
    },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.row.index === data.length - 1) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fillColor = [240, 240, 240];
      }
      if (hookData.section === 'body' || hookData.section === 'head') {
        hookData.cell.text = hookData.cell.text.map(text => {
          if (typeof text === 'string' && /[0-9]/.test(text)) {
            return text.replace(/[0-9]/g, d => toArabicNumerals(d));
          }
          return text;
        });
      }
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
      { wch: 25 }, // Name
      { wch: 15 }, // Price
      { wch: 20 }, // Code
      ...Array(headers.length - 5).fill({ wch: 15 }),
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
  const [searchInput, setSearchInput] = useState<string>('');
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
    const now = new Date('2025-10-21T16:26:00'); // Updated to 04:26 PM EEST
    let start: Date, end: Date;

    switch (selectedPeriod) {
      case 'today':
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case 'week':
        start = subDays(now, 6);
        end = endOfDay(now);
        break;
      case 'month':
        start = subMonths(now, 1);
        end = endOfDay(now);
        break;
      case 'custom':
        if (!customStartDate || !customEndDate) return null;
        start = startOfDay(parseISO(customStartDate));
        end = endOfDay(parseISO(customEndDate));
        if (start > end) {
          toast.warn(isRtl ? 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية' : 'End date must be after start date');
          return null;
        }
        break;
      default:
        return null;
    }

    return {
      start: start.toISOString(),
      end: end.toISOString(),
      label: selectedPeriod === 'custom'
        ? `${format(start, 'dd/MM/yyyy', { locale: isRtl ? arSA : undefined })} - ${format(end, 'dd/MM/yyyy', { locale: isRtl ? arSA : undefined })}`
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
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [inventory, ordersResponse, branchesResponse, salesResponse] = await Promise.all([
        inventoryAPI.getInventory({}, isRtl),
        ordersAPI.getAll({ startDate: dateRange.start, endDate: dateRange.end, page: 1, limit: 10000 }, isRtl),
        branchesAPI.getAll(),
        salesAPI.getAnalytics({ startDate: dateRange.start, endDate: dateRange.end, lang: language }),
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

      const branchMap = new Map<string, string>(fetchedBranches.map((b) => [b._id, b.displayName]));
      const productDetails = new Map<string, { code: string; product: string; unit: string; price: number }>();

      (Array.isArray(inventory) ? inventory : []).forEach((item: any) => {
        if (item?.product?._id) {
          productDetails.set(item.product._id, {
            code: item.product.code || 'N/A',
            product: isRtl ? (item.product.name || 'منتج غير معروف') : (item.product.nameEn || item.product.name || 'Unknown Product'),
            unit: isRtl ? (item.product.unit || 'غير محدد') : (item.product.unitEn || item.product.unit || 'N/A'),
            price: Number(item.product.price) || 0,
          });
        }
      });

      const orders = Array.isArray(ordersResponse) ? ordersResponse : [];
      if (orders.length === 0 && selectedPeriod === 'today') {
        console.log(`No orders found for today (${dateRange.start} to ${dateRange.end})`);
      }

      const orderMap = new Map<string, OrderRow>();
      orders.forEach((order: any) => {
        const orderDate = parseISO(order.createdAt || order.date || '1970-01-01');
        if (isNaN(orderDate.getTime())) {
          console.warn('Invalid order date:', order.createdAt || order.date);
          return;
        }

        if (!isWithinInterval(orderDate, { start: parseISO(dateRange.start), end: parseISO(dateRange.end) })) {
          console.log('Order excluded:', orderDate, dateRange);
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
    return <div className="text-center py-12 text-base font-medium text-gray-700">{isRtl ? 'لا يوجد صلاحية' : 'No access'}</div>;
  }

  return (
    <div className={`min-h-screen px-4 py-6 ${isRtl ? 'rtl font-amiri' : 'ltr font-inter'} bg-gray-50`} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="mb-4 flex flex-col items-center sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-6 h-6 text-amber-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">{isRtl ? 'إدارة ملخص الطلبات' : 'Manage Orders Summary'}</h1>
            <p className="text-gray-600 text-xs">{isRtl ? 'عرض أو تصدير ملخص الطلبات' : 'View or export orders summary'}</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
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

      <div className="space-y-3">
        <div className="p-4 bg-white rounded-xl shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ProductSearchInput
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setSearchTerm(e.target.value); // Simplified without debounce for now
              }}
              placeholder={isRtl ? 'ابحث عن منتج...' : 'Search for product...'}
              ariaLabel={isRtl ? 'بحث المنتج' : 'Product search'}
            />
            <ProductDropdown
              value={selectedPeriod}
              onChange={setSelectedPeriod}
              options={periodOptions}
              ariaLabel={isRtl ? 'اختر الفترة' : 'Select period'}
            />
            {selectedPeriod === 'custom' && (
              <div className="flex gap-2 items-center w-full sm:w-auto">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 w-full sm:w-auto"
                />
                <span className="text-gray-600 hidden sm:inline">-</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 w-full sm:w-auto"
                />
              </div>
            )}
          </div>
        </div>
        <div className="text-center text-xs text-gray-600">
          {isRtl ? `عدد المنتجات: ${filteredData.length}` : `Products Count: ${filteredData.length}`}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="p-4 bg-white rounded-xl shadow-sm">
                <div className="space-y-2 animate-pulse">
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-2 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredData.length === 0 ? (
          <div className="p-6 text-center bg-white rounded-xl shadow-sm">
            <Calendar className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 text-xs">{isRtl ? 'لا توجد بيانات في هذه الفترة' : 'No data for this period'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto">
            {filteredData.map((row) => (
              <div
                key={row.id}
                className="p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">{row.product}</h3>
                    <p className="text-xs text-gray-500">{row.code}</p>
                  </div>
                  <p className="text-xs text-amber-600">
                    {isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}: {formatNumber(row.totalQuantity, isRtl)}
                  </p>
                  <p className="font-semibold text-gray-900 text-xs">
                    {formatPrice(row.totalPrice, isRtl)} / {row.unit}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-end gap-1.5">
                  {/* Add edit/delete buttons if needed */}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyOrdersSummary;