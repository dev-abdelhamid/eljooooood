import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Upload, ChevronDown, Calendar } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { ordersAPI, branchesAPI, productsAPI, inventoryAPI } from '../services/api';
import { toast } from 'react-toastify';
import { Tooltip } from 'react-tooltip';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Interfaces
interface Order {
  _id: string;
  orderNumber: string;
  branchId: string;
  items: { product: string; quantity: number; price: number }[];
  status: string;
  createdAt: string;
}

interface Product {
  _id: string;
  name: string;
  nameEn: string;
  code: string;
  unit: string;
  unitEn: string;
  price: number;
}

interface Branch {
  _id: string;
  name: string;
  nameEn: string;
  displayName: string;
}

interface OrderRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  price: number;
  branchQuantities: { [branch: string]: number };
  totalQuantity: number;
  totalPrice: number;
}

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
    className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-200 ${
      variant === 'primary' && !disabled
        ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-lg hover:shadow-xl'
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
        className={`w-full ${isRtl ? 'pl-12 pr-4' : 'pr-12 pl-4'} px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-md hover:shadow-lg text-base placeholder-gray-500 ${isRtl ? 'text-right font-amiri' : 'text-left font-inter'}`}
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
        className={`w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 bg-gradient-to-r from-white to-gray-50 shadow-sm hover:shadow-md text-sm text-gray-700 ${isRtl ? 'text-right font-amiri' : 'text-left font-inter'} flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
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
    const [regularFontBytes, boldFontBytes] = await Promise.all([
      fetch(fontUrls.regular).then((res) => res.arrayBuffer()),
      fetch(fontUrls.bold).then((res) => res.arrayBuffer()),
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

const generateFileName = (prefix: string, period: string, isRtl: boolean, extension: string): string => {
  const dateStr = new Date().toISOString().split('T')[0];
  return `${prefix}_${period}_${dateStr}.${extension}`;
};

const generatePDFHeader = (
  doc: jsPDF,
  isRtl: boolean,
  title: string,
  period: string,
  totalItems: number,
  totalQuantity: number,
  totalPrice: number,
  fontName: string,
  fontLoaded: boolean
) => {
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  doc.setFont(fontLoaded ? fontName : 'helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(33, 33, 33);
  const titleWidth = doc.getTextWidth(title);
  const titleX = isRtl ? pageWidth - margin - titleWidth : margin;
  doc.text(title, titleX, 20, { align: isRtl ? 'right' : 'left' });

  doc.setFontSize(10);
  doc.setFont(fontLoaded ? fontName : 'helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  const stats = isRtl
    ? `إجمالي المنتجات: ${toArabicNumerals(totalItems)} | إجمالي الكمية: ${toArabicNumerals(totalQuantity)} وحدة | إجمالي المبلغ: ${formatPrice(totalPrice, isRtl)}`
    : `Total Products: ${totalItems} | Total Quantity: ${totalQuantity} units | Total Amount: ${formatPrice(totalPrice, isRtl)}`;
  const statsWidth = doc.getTextWidth(stats);
  const statsX = isRtl ? margin : pageWidth - margin - statsWidth;
  doc.text(stats, statsX, 28, { align: isRtl ? 'left' : 'right' });

  doc.setLineWidth(0.5);
  doc.setDrawColor(245, 158, 11);
  doc.line(margin, 35, pageWidth - margin, 35);

  const currentDate = new Date().toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  for (let i = 1; i <= doc.getNumberOfPages(); i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    const footerText = isRtl
      ? `تم الإنشاء بواسطة نظام إدارة الجودياء - ${toArabicNumerals(currentDate)}`
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
  const margin = 15;
  const maxTableWidth = pageWidth - 2 * margin;
  const columnWidths = [25, 20, 20, ...Array(numColumns - 5).fill(15), 25, 20].map(w => Math.min(w, maxTableWidth / numColumns));
  const columnStyles = headers.reduce((styles, _, i) => {
    styles[i] = { cellWidth: columnWidths[i], halign: 'center', valign: 'middle', overflow: 'linebreak' };
    return styles;
  }, {});

  autoTable(doc, {
    head: [isRtl ? headers.slice().reverse() : headers],
    body: isRtl ? data.map(row => row.slice().reverse()) : data,
    theme: 'grid',
    startY: 40,
    margin: { top: 40, bottom: 20, left: margin, right: margin },
    tableWidth: 'auto',
    columnStyles,
    headStyles: {
      fillColor: [245, 158, 11],
      textColor: [255, 255, 255],
      fontSize: 10,
      halign: 'center',
      valign: 'middle',
      font: fontLoaded ? fontName : 'helvetica',
      fontStyle: 'bold',
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 9,
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
      if (hookData.section === 'body' && hookData.column.index === (isRtl ? 0 : headers.length - 2)) {
        hookData.cell.styles.fontStyle = 'bold';
      }
      if (hookData.section === 'body' || hookData.section === 'head') {
        hookData.cell.text = hookData.cell.text.map(text => String(text).replace(/[0-9]/g, d => toArabicNumerals(d)));
      }
    },
    didDrawPage: () => doc.setFont(fontLoaded ? fontName : 'helvetica', 'normal'),
  });
};

const exportToPDF = async (
  data: any[][],
  title: string,
  period: string,
  headers: string[],
  isRtl: boolean,
  totalItems: number,
  totalQuantity: number,
  totalPrice: number
) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const fontName = 'Amiri';
  const fontLoaded = await loadFont(doc);
  generatePDFHeader(doc, isRtl, title, period, totalItems, totalQuantity, totalPrice, fontName, fontLoaded);
  generatePDFTable(doc, headers, data, isRtl, fontLoaded, fontName);
  const fileName = generateFileName('OrdersSummary', period, isRtl, 'pdf');
  doc.save(fileName);
  toast.success(isRtl ? 'تم تصدير ملف PDF بنجاح' : 'PDF exported successfully', {
    position: isRtl ? 'top-left' : 'top-right',
    autoClose: 3000,
  });
};

const exportToExcel = (dataRows: any[], headers: string[], period: string, isRtl: boolean) => {
  const sheetData = isRtl ? dataRows.map(row => row.slice().reverse()) : dataRows;
  const sheetHeaders = isRtl ? headers.slice().reverse() : headers;
  const ws = XLSX.utils.aoa_to_sheet([sheetHeaders, ...sheetData]);
  if (isRtl) ws['!views'] = [{ RTL: true }];
  ws['!cols'] = [
    { wch: 25 }, { wch: 20 }, { wch: 20 },
    ...Array(headers.length - 5).fill({ wch: 15 }),
    { wch: 25 }, { wch: 20 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `OrdersSummary_${period}`);
  XLSX.writeFile(wb, generateFileName('OrdersSummary', period, isRtl, 'xlsx'));
  toast.success(isRtl ? 'تم تصدير ملف Excel بنجاح' : 'Excel exported successfully', {
    position: isRtl ? 'top-left' : 'top-right',
    autoClose: 3000,
  });
};

// Main DailyOrdersSummary component
const DailyOrdersSummary: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const today = new Date('2025-10-21T12:30:00'); // Current date and time (12:30 PM EEST)
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily');
  const [customStartDate, setCustomStartDate] = useState(today.toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState(today.toISOString().split('T')[0]);
  const [orderData, setOrderData] = useState<OrderRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const periods = useMemo(() => [
    { value: 'daily', label: isRtl ? 'يومي' : 'Daily' },
    { value: 'weekly', label: isRtl ? 'أسبوعي' : 'Weekly' },
    { value: 'monthly', label: isRtl ? 'شهري' : 'Monthly' },
    { value: 'custom', label: isRtl ? 'فترة مخصصة' : 'Custom' },
  ], [isRtl]);

  const fetchData = useCallback(async () => {
    if (!user || (user.role !== 'admin' && user.role !== 'production')) {
      toast.error(isRtl ? 'لا يوجد صلاحية' : 'No access', { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [branchesResponse, productsResponse, ordersResponse] = await Promise.all([
        branchesAPI.getAll(),
        productsAPI.getAll({}),
        ordersAPI.getAll({ page: 1, limit: 10000 }),
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
      const branchMap = new Map<string, string>(fetchedBranches.map(b => [b._id, b.displayName]));

      const fetchedProducts = productsResponse
        .filter((product: any) => product && product._id)
        .map((product: any) => ({
          _id: product._id,
          name: isRtl ? (product.name || 'منتج غير معروف') : (product.nameEn || product.name || 'Unknown Product'),
          nameEn: product.nameEn || product.name,
          code: product.code || `code-${Math.random().toString(36).substring(2)}`,
          unit: isRtl ? (product.unit || 'غير محدد') : (product.unitEn || product.unit || 'N/A'),
          unitEn: product.unitEn || product.unit,
          price: Number(product.price) || 0,
        }));
      setProducts(fetchedProducts);
      const productMap = new Map<string, Product>(fetchedProducts.map(p => [p._id, p]));

      let orders = ordersResponse;
      if (!Array.isArray(orders)) {
        console.error('ordersResponse is not an array:', ordersResponse);
        toast.error(isRtl ? 'بيانات الطلبات غير صالحة' : 'Invalid orders data');
        setLoading(false);
        return;
      }

      const orderMap = new Map<string, OrderRow>();
      const getDateRange = () => {
        const start = new Date(today);
        const end = new Date(today);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        if (selectedPeriod === 'daily') {
          // Default to today
        } else if (selectedPeriod === 'weekly') {
          start.setDate(start.getDate() - start.getDay());
          end.setDate(end.getDate() + (6 - end.getDay()));
        } else if (selectedPeriod === 'monthly') {
          start.setDate(1);
          end.setMonth(end.getMonth() + 1, 0);
        } else {
          start.setTime(new Date(customStartDate).getTime());
          end.setTime(new Date(customEndDate).getTime());
        }
        return { start, end };
      };
      const { start, end } = getDateRange();

      orders.forEach((order: Order) => {
        const date = new Date(order.createdAt);
        if (isNaN(date.getTime())) {
          console.warn('Invalid date for order:', order);
          return;
        }
        if (date >= start && date <= end && (order.status === 'approved' || order.status === 'completed')) {
          const branch = branchMap.get(order.branchId) || (isRtl ? 'الفرع الرئيسي' : 'Main Branch');
          order.items.forEach((item) => {
            const product = productMap.get(item.product) || {
              _id: item.product,
              name: isRtl ? 'منتج غير معروف' : 'Unknown Product',
              code: `code-${Math.random().toString(36).substring(2)}`,
              unit: isRtl ? 'غير محدد' : 'N/A',
              price: item.price || 0,
            };
            const key = product._id;
            if (!orderMap.has(key)) {
              orderMap.set(key, {
                id: key,
                code: product.code,
                product: product.name,
                unit: product.unit,
                price: product.price,
                branchQuantities: {},
                totalQuantity: 0,
                totalPrice: 0,
              });
            }
            const row = orderMap.get(key)!;
            const quantity = Number(item.quantity) || 0;
            row.branchQuantities[branch] = (row.branchQuantities[branch] || 0) + quantity;
            row.totalQuantity += quantity;
            row.totalPrice += quantity * product.price;
          });
        }
      });

      const processedData = Array.from(orderMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
      if (processedData.length === 0) {
        toast.warn(isRtl ? 'لا توجد طلبات في هذه الفترة' : 'No orders found for this period', {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      }
      setOrderData(processedData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error(isRtl ? 'فشل في جلب البيانات' : 'Failed to fetch data', {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    } finally {
      setLoading(false);
    }
  }, [isRtl, today, selectedPeriod, customStartDate, customEndDate, language, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredData = useMemo(() => orderData.filter(row => row.product.toLowerCase().includes(searchTerm.toLowerCase())), [orderData, searchTerm]);
  const grandTotalQuantity = useMemo(() => filteredData.reduce((sum, row) => sum + row.totalQuantity, 0), [filteredData]);
  const grandTotalPrice = useMemo(() => filteredData.reduce((sum, row) => sum + row.totalPrice, 0), [filteredData]);

  const getTooltipContent = (qty: number, isRtl: boolean) => `${isRtl ? 'الكمية: ' : 'Quantity: '}${qty > 0 ? '+' : ''}${formatNumber(qty, isRtl)}`;

  const exportTable = (format: 'excel' | 'pdf') => {
    const headers = [
      isRtl ? 'الاسم' : 'Name',
      isRtl ? 'السعر' : 'Price',
      isRtl ? 'الكود' : 'Code',
      ...branches.map(b => b.displayName),
      isRtl ? 'الإجمالي' : 'Total',
      isRtl ? 'وحدة' : 'Unit',
    ];
    const periodLabel = periods.find(p => p.value === selectedPeriod)?.label || '';
    const rows = [
      ...filteredData.map((row) => [
        row.product,
        formatPrice(row.price, isRtl),
        row.code,
        ...branches.map(b => formatNumber(row.branchQuantities[b.displayName] || 0, isRtl)),
        formatNumber(row.totalQuantity, isRtl),
        row.unit,
      ]),
      [
        isRtl ? 'الإجمالي' : 'Total',
        formatPrice(grandTotalPrice, isRtl),
        '',
        ...branches.map(b => formatNumber(filteredData.reduce((sum, row) => sum + (row.branchQuantities[b.displayName] || 0), 0), isRtl)),
        formatNumber(grandTotalQuantity, isRtl),
        '',
      ],
    ];
    if (format === 'excel') exportToExcel(rows, headers, periodLabel, isRtl);
    else if (format === 'pdf') exportToPDF(rows, isRtl ? 'ملخص الطلبات' : 'Orders Summary', periodLabel, headers, isRtl, filteredData.length, grandTotalQuantity, grandTotalPrice);
  };

  if (!user || (user.role !== 'admin' && user.role !== 'production')) {
    return <div className="text-center py-16 text-lg font-medium text-gray-800">{isRtl ? 'لا يوجد صلاحية' : 'No access'}</div>;
  }

  return (
    <div className={`min-h-screen px-4 py-8 ${isRtl ? 'rtl font-amiri' : 'ltr font-inter'} bg-gray-50`}>
      <div className="mb-6 bg-white shadow-md rounded-xl p-6 border border-gray-200">
        <div className="flex flex-col gap-6">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4`}>
            <h2 className="text-xl font-bold text-gray-800">{isRtl ? 'ملخص الطلبات' : 'Orders Summary'}</h2>
            <div className={`flex gap-4 items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
              <ProductDropdown
                value={selectedPeriod}
                onChange={setSelectedPeriod}
                options={periods}
                ariaLabel={isRtl ? 'اختر الفترة' : 'Select period'}
                className="w-40"
              />
              {selectedPeriod === 'custom' && (
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    aria-label={isRtl ? 'تاريخ البداية' : 'Start date'}
                  />
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    aria-label={isRtl ? 'تاريخ النهاية' : 'End date'}
                  />
                </div>
              )}
              <Button
                variant={filteredData.length > 0 ? 'primary' : 'secondary'}
                onClick={filteredData.length > 0 ? () => exportTable('pdf') : undefined}
                disabled={filteredData.length === 0}
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير PDF' : 'Export PDF'}
              </Button>
              <Button
                variant={filteredData.length > 0 ? 'primary' : 'secondary'}
                onClick={filteredData.length > 0 ? () => exportTable('excel') : undefined}
                disabled={filteredData.length === 0}
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير Excel' : 'Export Excel'}
              </Button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
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
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-amber-50 sticky top-0 z-10">
              <tr className={isRtl ? 'flex-row-reverse' : ''}>
                <th className="px-4 py-3 font-semibold text-gray-700 text-center">{isRtl ? 'الاسم' : 'Name'}</th>
                <th className="px-4 py-3 font-semibold text-gray-700 text-center">{isRtl ? 'السعر' : 'Price'}</th>
                <th className="px-4 py-3 font-semibold text-gray-700 text-center">{isRtl ? 'الكود' : 'Code'}</th>
                {branches.map((branch) => (
                  <th key={branch._id} className="px-4 py-3 font-semibold text-gray-700 text-center">
                    {branch.displayName}
                  </th>
                ))}
                <th className="px-4 py-3 font-semibold text-gray-700 text-center">{isRtl ? 'الإجمالي' : 'Total'}</th>
                <th className="px-4 py-3 font-semibold text-gray-700 text-center">{isRtl ? 'وحدة' : 'Unit'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredData.map((row) => (
                <tr key={row.id} className="hover:bg-amber-50 transition-colors duration-200">
                  <td className="px-4 py-3 text-gray-700 text-center truncate">{row.product}</td>
                  <td className="px-4 py-3 text-gray-700 text-center">{formatPrice(row.price, isRtl)}</td>
                  <td className="px-4 py-3 text-gray-700 text-center">{row.code}</td>
                  {branches.map((branch) => (
                    <td
                      key={branch._id}
                      className={`px-4 py-3 text-center ${
                        row.branchQuantities[branch.displayName] > 0 ? 'bg-green-50 text-green-700' : 'text-gray-700'
                      }`}
                      data-tooltip-id="branch-tooltip"
                      data-tooltip-content={getTooltipContent(row.branchQuantities[branch.displayName] || 0, isRtl)}
                    >
                      {formatNumber(row.branchQuantities[branch.displayName] || 0, isRtl)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalQuantity, isRtl)}</td>
                  <td className="px-4 py-3 text-gray-700 text-center">{row.unit}</td>
                </tr>
              ))}
              <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <td className="px-4 py-3 text-gray-800 text-center">{isRtl ? 'الإجمالي' : 'Total'}</td>
                <td className="px-4 py-3 text-gray-800 text-center">{formatPrice(grandTotalPrice, isRtl)}</td>
                <td className="px-4 py-3 text-gray-800 text-center"></td>
                {branches.map((branch) => (
                  <td key={branch._id} className="px-4 py-3 text-gray-800 text-center">
                    {formatNumber(filteredData.reduce((sum, row) => sum + (row.branchQuantities[branch.displayName] || 0), 0), isRtl)}
                  </td>
                ))}
                <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalQuantity, isRtl)}</td>
                <td className="px-4 py-3 text-gray-800 text-center"></td>
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