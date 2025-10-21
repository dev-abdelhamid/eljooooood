import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Upload, ChevronDown, Calendar } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { inventoryAPI, ordersAPI, branchesAPI, salesAPI } from '../services/api';
import { toast } from 'react-toastify';
import { Tooltip } from 'react-tooltip';
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
    className={`flex items-center gap-2.5 rounded-xl px-6 py-3 text-sm font-bold transition-all duration-200 shadow-lg hover:shadow-xl ${
      variant === 'primary' && !disabled
        ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white'
        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
    } ${className}`}
  >
    {children}
  </button>
);

// ProductSearchInput
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
        className={`absolute inset-y-0 ${isRtl ? 'left-3' : 'right-3'} flex items-center px-3 text-gray-400 group-focus-within:text-amber-500 transition-colors`}
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
        className={`w-full ${isRtl ? 'pl-12 pr-4' : 'pr-12 pl-4'} px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all bg-white shadow-sm hover:shadow-md text-base placeholder-gray-500 ${isRtl ? 'text-right font-amiri' : 'text-left font-inter'}`}
        aria-label={ariaLabel}
      />
      {value && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          onClick={handleClear}
          className={`absolute inset-y-0 ${isRtl ? 'left-3' : 'right-3'} flex items-center px-3 text-gray-400 hover:text-amber-600 transition-colors focus:outline-none`}
          aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
        >
          <X className="w-5 h-5" />
        </motion.button>
      )}
    </div>
  );
};

// ProductDropdown
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
        className={`w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all bg-white shadow-sm hover:shadow-md text-sm font-medium text-gray-700 ${isRtl ? 'text-right font-amiri' : 'text-left font-inter'} flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
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
            className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl max-h-60 overflow-y-auto"
          >
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className="w-full px-4 py-3 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-600 transition-colors text-left font-medium"
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

const generateFileName = (prefix: string, periodLabel: string, isRtl: boolean): string => {
  const dateStr = new Date().toISOString().split('T')[0];
  const sanitizedLabel = periodLabel.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_');
  return `${prefix}_${sanitizedLabel}_${dateStr}.pdf`;
};

// PDF Header (أنيق وواضح)
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
  const margin = 18;

  // خلفية الهيدر
  doc.setFillColor(245, 158, 11);
  doc.rect(0, 0, pageWidth, 60, 'F');

  // العنوان
  doc.setFont(fontLoaded ? fontName : 'helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(255, 255, 255);
  const titleX = isRtl ? pageWidth - margin - 10 : margin + 10;
  doc.text(title, titleX, 35, { align: isRtl ? 'right' : 'left' });

  // الفترة
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  const periodX = isRtl ? margin + 10 : pageWidth - margin - 10;
  doc.text(`الفترة: ${periodLabel}`, periodX, 50, { align: isRtl ? 'left' : 'right' });

  // خط فاصل
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.8);
  doc.line(margin, 65, pageWidth - margin, 65);

  // الإحصائيات
  doc.setFontSize(12);
  doc.setTextColor(33, 33, 33);
  const stats = [
    `المنتجات: ${toArabicNumerals(totalItems)}`,
    `الكمية: ${toArabicNumerals(totalQuantity)} وحدة`,
    `المبلغ: ${formatPrice(totalPrice, isRtl)}`,
  ];
  stats.forEach((stat, i) => {
    const x = isRtl ? margin + 10 : pageWidth - margin - 10;
    doc.text(stat, x, 75 + i * 10, { align: isRtl ? 'left' : 'right' });
  });

  // التذييل
  const currentDate = new Date().toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  const footerText = isRtl
    ? `نظام إدارة الجودياء - ${toArabicNumerals(currentDate)}`
    : `Elgoodia Management System - ${currentDate}`;
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text(footerText, pageWidth / 2, doc.internal.pageSize.height - 12, { align: 'center' });
};

// PDF Table (متجاوب، واضح، أعمدة متساوية)
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
  const margin = 18;
  const maxTableWidth = pageWidth - 2 * margin;
  const columnWidth = maxTableWidth / numColumns;

  autoTable(doc, {
    head: [isRtl ? headers.slice().reverse() : headers],
    body: isRtl ? data.map(row => row.slice().reverse()) : data,
    theme: 'grid',
    startY: 90,
    margin: { top: 90, bottom: 25, left: margin, right: margin },
    tableWidth: 'auto',
    columnStyles: headers.reduce((styles, _, i) => {
      const index = isRtl ? numColumns - 1 - i : i;
      styles[index] = {
        cellWidth: columnWidth,
        halign: 'center',
        valign: 'middle',
        overflow: 'linebreak',
        fontSize: 10,
      };
      return styles;
    }, {}),
    headStyles: {
      fillColor: [245, 158, 11],
      textColor: [255, 255, 255],
      fontSize: 11,
      halign: 'center',
      valign: 'middle',
      font: fontLoaded ? fontName : 'helvetica',
      fontStyle: 'bold',
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize: 9,
      halign: 'center',
      valign: 'middle',
      font: fontLoaded ? fontName : 'helvetica',
      textColor: [33, 33, 33],
      lineColor: [220, 220, 220],
      fillColor: [255, 255, 255],
      cellPadding: 4,
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' || hookData.section === 'head') {
        hookData.cell.text = hookData.cell.text.map(text => {
          let processedText = text;
          // تح: تحويل الأرقام فقط في الأعمدة التي تحتاج
          if (hookData.column.index >= 1 && hookData.column.index <= numColumns - 2) {
            processedText = String(processedText).replace(/[0-9]/g, d => toArabicNumerals(d));
          }
          return processedText;
        });
      }
      if (hookData.section === 'body' && hookData.row.index === data.length - 1) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fillColor = [240, 240, 240];
        hookData.cell.styles.fontSize = 11;
      }
    },
  });
};

// PDF Export
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
    toast.info(isRtl ? 'جارٍ إنشاء PDF...' : 'Generating PDF...', {
      position: isRtl ? 'top-left' : 'top-right',
      autoClose: false,
      toastId: 'pdf-export',
    });
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const fontName = 'Amiri';
    const fontLoaded = await loadFont(doc);
    generatePDFHeader(doc, isRtl, title, periodLabel, totalItems, totalQuantity, totalPrice, fontName, fontLoaded);
    generatePDFTable(doc, headers, data, isRtl, fontLoaded, fontName);
    const fileName = generateFileName('OrdersSummary', periodLabel, isRtl);
    doc.save(fileName);
    toast.update('pdf-export', {
      render: isRtl ? 'تم تصدير PDF بنجاح' : 'PDF exported successfully',
      type: 'success',
      autoClose: 3000,
    });
  } catch (error) {
    console.error('Error exporting PDF:', error);
    toast.update('pdf-export', {
      render: isRtl ? 'فشل في تصدير PDF' : 'Failed to export PDF',
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

    const weekOptions = { weekStartsOn: 1, locale: isRtl ? arSA : undefined };

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

  const exportTable = () => {
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
  };

  if (!user || (user.role !== 'admin' && user.role !== 'production')) {
    return <div className="text-center py-16 text-lg font-medium text-gray-800">{isRtl ? 'لا يوجد صلاحية' : 'No access'}</div>;
  }

  return (
    <div className={`min-h-screen px-4 py-8 ${isRtl ? 'rtl font-amiri' : 'ltr font-inter'} bg-gradient-to-br from-gray-50 to-gray-100`}>
      <div className="mb-8 bg-white shadow-2xl rounded-3xl p-8 border border-gray-200">
        <div className="flex flex-col gap-8">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6`}>
            <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-4">
              <Calendar className="w-7 h-7 text-amber-600" />
              {isRtl ? 'ملخص الطلبات' : 'Orders Summary'} - <span className="text-amber-600">{periodLabel || '...'}</span>
            </h2>
            <Button
              variant={filteredData.length > 0 ? 'primary' : 'secondary'}
              onClick={exportTable}
              disabled={filteredData.length === 0}
            >
              <Upload className="w-5 h-5" />
              {isRtl ? 'تصدير PDF' : 'Export PDF'}
            </Button>
          </div>

          <div className="flex flex-col lg:flex-row gap-5 items-center">
            <ProductDropdown
              value={selectedPeriod}
              onChange={setSelectedPeriod}
              options={periodOptions}
              ariaLabel={isRtl ? 'اختر الفترة' : 'Select period'}
              className="w-full sm:w-64"
            />
            {selectedPeriod === 'custom' && (
              <div className="flex gap-3 items-center w-full sm:w-auto">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-5 py-3 border border-gray-300 rounded-xl text-sm w-full sm:w-auto focus:ring-2 focus:ring-amber-500 transition-all"
                />
                <span className="text-gray-600 hidden sm:inline text-lg">→</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-5 py-3 border border-gray-300 rounded-xl text-sm w-full sm:w-auto focus:ring-2 focus:ring-amber-500 transition-all"
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
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-amber-600"></div>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="text-center py-20 text-gray-600 bg-white rounded-3xl shadow-xl p-10">
          <p className="text-xl font-medium">{isRtl ? 'لا توجد بيانات في هذه الفترة' : 'No data for this period'}</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="overflow-x-auto rounded-3xl shadow-2xl border border-gray-200 bg-white"
        >
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gradient-to-r from-amber-50 to-amber-100 sticky top-0 z-10">
              <tr className={isRtl ? 'flex-row-reverse' : ''}>
                <th className="px-5 py-5 font-bold text-gray-700 text-center min-w-[180px]">{isRtl ? 'الاسم' : 'Name'}</th>
                <th className="px-4 py-5 font-bold text-gray-700 text-center min-w-[90px]">{isRtl ? 'السعر' : 'Price'}</th>
                <th className="px-4 py-5 font-bold text-gray-700 text-center min-w-[90px]">{isRtl ? 'الكود' : 'Code'}</th>
                {allBranches.map((branch) => (
                  <th key={branch} className="px-4 py-5 font-bold text-gray-700 text-center min-w-[100px] break-words">
                    {branch}
                  </th>
                ))}
                <th className="px-5 py-5 font-bold text-gray-700 text-center min-w-[100px]">{isRtl ? 'الإجمالي' : 'Total'}</th>
                <th className="px-4 py-5 font-bold text-gray-700 text-center min-w-[90px]">{isRtl ? 'وحدة' : 'Unit'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredData.map((row) => (
                <tr key={row.id} className="hover:bg-amber-50 transition-colors duration-200">
                  <td className="px-5 py-4 text-gray-700 text-center truncate max-w-[180px]" title={row.product}>
                    {row.product}
                  </td>
                  <td className="px-4 py-4 text-gray-700 text-center font-medium">{formatPrice(row.price, isRtl)}</td>
                  <td className="px-4 py-4 text-gray-700 text-center">{row.code}</td>
                  {allBranches.map((branch) => (
                    <td
                      key={branch}
                      className={`px-4 py-4 text-center font-bold ${
                        row.branchQuantities[branch] > 0 ? 'bg-green-50 text-green-700' : 'text-gray-700'
                      }`}
                      data-tooltip-id="branch-tooltip"
                      data-tooltip-content={getTooltipContent(row.branchQuantities[branch] || 0, isRtl)}
                    >
                      {row.branchQuantities[branch] !== 0 ? formatNumber(row.branchQuantities[branch] || 0, isRtl) : '0'}
                    </td>
                  ))}
                  <td className="px-5 py-4 text-gray-700 text-center font-bold">{formatNumber(row.totalQuantity, isRtl)}</td>
                  <td className="px-4 py-4 text-gray-700 text-center">{row.unit}</td>
                </tr>
              ))}
              <tr className={`font-bold bg-gradient-to-r from-gray-100 to-gray-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <td className="px-5 py-5 text-gray-800 text-center">{isRtl ? 'الإجمالي' : 'Total'}</td>
                <td className="px-4 py-5 text-gray-800 text-center">{formatPrice(grandTotalPrice, isRtl)}</td>
                <td className="px-4 py-5 text-gray-800 text-center"></td>
                {allBranches.map((branch) => (
                  <td key={branch} className="px-4 py-5 text-gray-800 text-center">
                    {formatNumber(filteredData.reduce((sum, row) => sum + (row.branchQuantities[branch] || 0), 0), isRtl)}
                  </td>
                ))}
                <td className="px-5 py-5 text-gray-800 text-center">{formatNumber(grandTotalQuantity, isRtl)}</td>
                <td className="px-4 py-5 text-gray-800 text-center"></td>
              </tr>
            </tbody>
          </table>
          <Tooltip
            id="branch-tooltip"
            place="top"
            className="z-[9999] bg-white border border-gray-300 rounded-xl p-4 shadow-2xl max-w-xs text-sm text-gray-800 font-medium"
          />
        </motion.div>
      )}
    </div>
  );
};

export default DailyOrdersSummary;