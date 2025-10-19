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
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';

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
        <Search className="w-4 h-4" />
      </motion.div>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full ${isRtl ? 'pl-12 pr-4' : 'pr-12 pl-4'} px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}
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
          <X className="w-4 h-4" />
        </motion.button>
      )}
    </div>
  );
};

// ProductDropdown component with close on outside click
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
  const selectedOption = options.find((opt) => opt.value === value) || options[0] || { label: isRtl ? 'اختر' : 'Select' };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative group w-full ${className}`} ref={dropdownRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-200 bg-white shadow-sm hover:shadow-md text-xs text-gray-700 ${isRtl ? 'text-left' : 'text-right'} flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={ariaLabel}
      >
        <span className="truncate">{selectedOption.label}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && !disabled && (
        <div className={`absolute z-50 w-full mt-1 bg-white border border-gray-300 ${isRtl ? 'text-left' : 'text-right'} rounded-lg shadow-lg max-h-48 overflow-y-auto`}>
          {options.map((option) => (
            <button
              key={option.value}
              dir={isRtl ? 'rtl' : 'ltr'}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 text-xs text-left hover:bg-amber-100 transition-colors"
            >
              {option.label}
            </button>
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
  totalQuantity: number,
  totalPrice: number,
  fontName: string,
  fontLoaded: boolean
) => {
  doc.setFont(fontLoaded ? fontName : 'helvetica', 'normal');
  doc.setFontSize(18);
  doc.setTextColor(33, 33, 33);
  const pageWidth = doc.internal.pageSize.width;
  doc.text(title, isRtl ? pageWidth - 20 : 20, 12, { align: isRtl ? 'right' : 'left' });
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
  data: any[][],
  isRtl: boolean,
  fontLoaded: boolean,
  fontName: string
) => {
  const numColumns = headers.length;
  const fontSizeHead = Math.max(6, Math.min(9, Math.floor(280 / numColumns)));
  const fontSizeBody = fontSizeHead - 1;
  const cellPadding = numColumns > 20 ? 1 : 2;
  const columnStyles = {};
  headers.forEach((_, i) => {
    columnStyles[i] = {
      cellWidth: 'auto',
      minCellWidth: 5,
      halign: 'center',
    };
  });

  autoTable(doc, {
    head: [isRtl ? headers.slice().reverse() : headers],
    body: isRtl ? data.map(row => row.slice().reverse()) : data,
    theme: 'grid',
    startY: 30,
    margin: { top: 10, bottom: 10, left: 10, right: 10 },
    tableWidth: 'wrap',
    columnStyles,
    headStyles: {
      fillColor: [255, 193, 7],
      textColor: [33, 33, 33],
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
      if (hookData.section === 'body' && hookData.column.index >= (isRtl ? 0 : headers.length - 2)) {
        hookData.cell.styles.fontStyle = 'bold';
      }
      if (isRtl) {
        hookData.cell.text = hookData.cell.text.map(text => String(text).replace(/[0-9]/g, d => toArabicNumerals(d)));
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
    generatePDFHeader(doc, isRtl, title, monthName, totalItems, totalQuantity, totalPrice, fontName, fontLoaded);
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

// Data interface
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

interface Branch {
  _id: string;
  name: string;
  nameEn: string;
  displayName: string;
}

// Main DailyOrdersPage component
const DailyOrdersPage: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentDay = currentDate.getDate();
  const initialWeek = `week${Math.ceil(currentDay / 7)}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentDate.getMonth().toString());
  const [orderData, setOrderData] = useState<{ [month: number]: OrderRow[] }>({});
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
      const [inventory, ordersResponse, branchesResponse, salesResponse] = await Promise.all([
        inventoryAPI.getInventory({}, isRtl),
        ordersAPI.getAll({ page: 1, limit: 10000 }, isRtl),
        branchesAPI.getAll(),
        salesAPI.getAnalytics({
          startDate: new Date(currentYear, parseInt(selectedMonth), 1).toISOString(),
          endDate: new Date(currentYear, parseInt(selectedMonth) + 1, 0).toISOString(),
          lang: language,
        }),
      ]);
      const monthlyOrderData: { [month: number]: OrderRow[] } = {};
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
        toast.warn(isRtl ? 'لا توجد طلبات، استخدام بيانات احتياطية' : 'No orders found, using fallback data', {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
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
                  product: {
                    _id: item.product._id,
                    name: item.product.name,
                    nameEn: item.product.nameEn,
                    code: item.product.code,
                    unit: item.product.unit,
                    unitEn: item.product.unitEn,
                    price: item.product.price,
                  },
                  quantity: Math.abs(Number(movement.quantity) || 0),
                  price: Number(item.product?.price) || 0,
                  productId: item.product._id,
                  unit: isRtl ? (item.product?.unit || 'غير محدد') : (item.product?.unitEn || item.product?.unit || 'N/A'),
                  sales: Number(item.product?.sales) || (Math.abs(Number(movement.quantity)) * Number(item.product?.price) * 0.1) || 0,
                },
              ],
            }));
          });
      }
      for (let month = 0; month < 12; month++) {
        const daysInMonthCount = new Date(currentYear, month + 1, 0).getDate();
        const orderMap = new Map<string, OrderRow>();
        orders.forEach((order: any) => {
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
              const key = productId;
              if (!orderMap.has(key)) {
                orderMap.set(key, {
                  id: key,
                  code: details.code,
                  product: details.product,
                  unit: details.unit,
                  totalQuantity: 0,
                  dailyQuantities: Array(daysInMonthCount).fill(0),
                  dailyBranchDetails: Array.from({ length: daysInMonthCount }, () => ({})),
                  totalPrice: 0,
                  actualSales: 0,
                });
              }
              const row = orderMap.get(key)!;
              const quantity = Number(item.quantity) || 0;
              row.dailyQuantities[day] += quantity;
              row.dailyBranchDetails[day][branch] = (row.dailyBranchDetails[day][branch] || 0) + quantity;
              row.totalQuantity += quantity;
              row.totalPrice += quantity * details.price;
            });
          }
        });
        if (month === parseInt(selectedMonth)) {
          for (const row of orderMap.values()) {
            const salesItem = salesResponse.productSales?.find((s: any) => s.productId === row.id);
            if (salesItem) {
              row.actualSales = Number(salesItem.totalQuantity) || 0;
            }
          }
        }
        monthlyOrderData[month] = Array.from(orderMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
      }
      setOrderData(monthlyOrderData);
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
    const data = orderData[parseInt(selectedMonth)] || [];
    return data
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
  }, [orderData, selectedMonth, searchTerm, selectedBranch, startDay, endDay]);

  const grandTotalQuantity = useMemo(() => filteredData.reduce((sum, row) => sum + row.displayedTotalQuantity, 0), [filteredData]);
  const grandTotalPrice = useMemo(() => filteredData.reduce((sum, row) => sum + row.displayedTotalPrice, 0), [filteredData]);
  const grandActualSales = useMemo(() => filteredData.reduce((sum, row) => sum + row.actualSales, 0), [filteredData]);

  const getTooltipContent = (dailyQuantity: number, branchDetails: { [branch: string]: number }, isRtl: boolean) => {
    let header = isRtl ? 'طلبات' : 'Orders';
    let content = `${header}: ${dailyQuantity > 0 ? '+' : ''}${formatNumber(dailyQuantity, isRtl)}`;
    if (Object.keys(branchDetails).length > 0) {
      content += '\n' + Object.entries(branchDetails).sort(([a], [b]) => a.localeCompare(b)).map(([branch, qty]) => `${branch}: ${qty > 0 ? '+' : ''}${formatNumber(qty, isRtl)}`).join('\n');
    }
    return content;
  };

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
        ...Object.fromEntries(row.displayedDailyQuantities.map((qty, i) => [displayedDays[i], qty !== 0 ? qty : '-'])),
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
      exportToExcel(dataRows, isRtl ? 'تقرير الطلبات اليومية' : 'Daily Orders Report', monthName, headers, isRtl, filteredData.length, grandTotalQuantity, grandTotalPrice);
    } else if (format === 'pdf') {
      exportToPDF(dataRows, isRtl ? 'تقرير الطلبات اليومية' : 'Daily Orders Report', monthName, headers, isRtl, filteredData.length, grandTotalQuantity, grandTotalPrice);
    }
  };

  if (!user || (user.role !== 'admin' && user.role !== 'production')) {
    return (
      <div className="text-center py-12 text-sm font-medium text-gray-700">
        {isRtl ? 'لا يوجد صلاحية' : 'No access'}
      </div>
    );
  }

  return (
    <div className={`min-h-screen px-4 py-8 ${isRtl ? 'rtl' : 'ltr'}`}>
      <div className="mb-6 bg-white shadow-md rounded-xl p-4 border border-gray-200">
        <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <h2 className="text-lg font-bold text-gray-800">{isRtl ? 'تقرير الطلبات اليومية' : 'Daily Orders Report'} - {monthName}</h2>
          <div className="flex gap-2 items-center">
            <ProductDropdown
              value={selectedMonth}
              onChange={setSelectedMonth}
              options={months}
              ariaLabel={isRtl ? 'اختر الشهر' : 'Select month'}
              className="w-40"
            />
            <Button
              variant={filteredData.length > 0 ? 'primary' : 'secondary'}
              onClick={filteredData.length > 0 ? () => exportTable('excel') : undefined}
              disabled={filteredData.length === 0}
              className="flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {isRtl ? 'إكسل' : 'Excel'}
            </Button>
            <Button
              variant={filteredData.length > 0 ? 'primary' : 'secondary'}
              onClick={filteredData.length > 0 ? () => exportTable('pdf') : undefined}
              disabled={filteredData.length === 0}
              className="flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {isRtl ? 'PDF' : 'PDF'}
            </Button>
          </div>
        </div>
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 items-center mb-4 ${isRtl ? 'grid-flow-row-dense' : ''}`}>
          <ProductSearchInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isRtl ? 'بحث حسب المنتج' : 'Search by product'}
            ariaLabel={isRtl ? 'بحث المنتج' : 'Product search'}
            className="md:col-span-1 max-w-none w-full md:w-64"
          />
          <ProductDropdown
            value={selectedBranch}
            onChange={setSelectedBranch}
            options={branchOptions}
            ariaLabel={isRtl ? 'اختر الفرع' : 'Select branch'}
            className="md:col-span-1 w-full md:w-64"
          />
          <ProductDropdown
            value={selectedPeriod}
            onChange={setSelectedPeriod}
            options={periodOptions}
            ariaLabel={isRtl ? 'اختر الفترة' : 'Select period'}
            className="md:col-span-1 w-full md:w-64"
          />
          {selectedPeriod === 'custom' && (
            <div className="col-span-1 md:col-span-3 flex flex-col sm:flex-row gap-4">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs w-full md:w-64"
              />
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 bg-white shadow-sm hover:shadow-md text-xs w-full md:w-64"
              />
            </div>
          )}
        </div>
      </div>
      {loading ? (
        <OrderTableSkeleton isRtl={isRtl} />
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
                <th className="px-2 py-2 font-semibold text-gray-700 text-center min-w-[40px]">{isRtl ? 'رقم' : 'No.'}</th>
                <th className="px-2 py-2 font-semibold text-gray-700 text-center min-w-[60px]">{isRtl ? 'الكود' : 'Code'}</th>
                <th className="px-2 py-2 font-semibold text-gray-700 text-center min-w-[200px]">{isRtl ? 'المنتج' : 'Product'}</th>
                <th className="px-2 py-2 font-semibold text-gray-700 text-center min-w-[70px]">{isRtl ? 'وحدة المنتج' : 'Product Unit'}</th>
                {displayedDays.map((day, i) => (
                  <th key={i} className="px-1 py-2 font-semibold text-gray-700 text-center min-w-[50px]">
                    {day}
                  </th>
                ))}
                <th className="px-2 py-2 font-semibold text-gray-700 text-center min-w-[100px]">
                  {isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}
                </th>
                <th className="px-2 py-2 font-semibold text-gray-700 text-center min-w-[100px]">
                  {isRtl ? 'المبيعات الفعلية' : 'Actual Sales'}
                </th>
                <th className="px-2 py-2 font-semibold text-gray-700 text-center min-w-[100px]">
                  {isRtl ? 'السعر الإجمالي' : 'Total Price'}
                </th>
                <th className="px-2 py-2 font-semibold text-gray-700 text-center min-w-[100px]">
                  {isRtl ? 'نسبة المبيعات %' : 'Sales Percentage %'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredData.map((row, index) => (
                <tr key={row.id} className={`hover:bg-amber-50 transition-colors duration-200`}>
                  <td className="px-2 py-2 text-gray-700 text-center">{formatNumber(index + 1, isRtl)}</td>
                  <td className="px-2 py-2 text-gray-700 text-center truncate">{row.code}</td>
                  <td className="px-2 py-2 text-gray-700 text-center truncate">{row.product}</td>
                  <td className="px-2 py-2 text-gray-700 text-center truncate">{row.unit}</td>
                  {row.displayedDailyQuantities.map((qty, i) => (
                    <td
                      key={i}
                      className={`px-1 py-2 text-center font-medium ${
                        qty > 0 ? 'bg-green-50 text-green-700' : qty < 0 ? 'bg-red-50 text-red-700' : 'text-gray-700'
                      }`}
                      data-tooltip-id="order-tooltip"
                      data-tooltip-content={getTooltipContent(qty, selectedBranch === 'all' ? row.displayedDailyBranchDetails[i] : {}, isRtl)}
                    >
                      {qty !== 0 ? `${qty > 0 ? '+' : ''}${formatNumber(qty, isRtl)}` : '-'}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-gray-700 text-center font-medium">{formatNumber(row.displayedTotalQuantity, isRtl)}</td>
                  <td className="px-2 py-2 text-gray-700 text-center font-medium">{formatNumber(row.actualSales, isRtl)}</td>
                  <td className="px-2 py-2 text-gray-700 text-center font-medium">{formatPrice(row.displayedTotalPrice, isRtl)}</td>
                  <td className="px-2 py-2 text-gray-700 text-center font-medium">
                    {formatNumber(row.displayedTotalQuantity > 0 ? ((row.actualSales / row.displayedTotalQuantity) * 100).toFixed(2) : '0.00', isRtl)}%
                  </td>
                </tr>
              ))}
              <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <td className="px-2 py-2 text-gray-800 text-center" colSpan={4}>{isRtl ? 'الإجمالي' : 'Total'}</td>
                {displayedDays.map((_, i) => (
                  <td key={i} className="px-1 py-2 text-gray-800 text-center">
                    {formatNumber(filteredData.reduce((sum, row) => sum + row.displayedDailyQuantities[i], 0), isRtl)}
                  </td>
                ))}
                <td className="px-2 py-2 text-gray-800 text-center">{formatNumber(grandTotalQuantity, isRtl)}</td>
                <td className="px-2 py-2 text-gray-800 text-center">{formatNumber(grandActualSales, isRtl)}</td>
                <td className="px-2 py-2 text-gray-800 text-center">{formatPrice(grandTotalPrice, isRtl)}</td>
                <td className="px-2 py-2 text-gray-800 text-center">
                  {formatNumber(grandTotalQuantity > 0 ? ((grandActualSales / grandTotalQuantity) * 100).toFixed(2) : '0.00', isRtl)}%
                </td>
              </tr>
            </tbody>
          </table>
          <Tooltip
            id="order-tooltip"
            place="top"
            className="custom-tooltip whitespace-pre-line z-[9999] shadow-xl bg-white border border-gray-300 rounded-md p-3 max-w-sm text-xs text-gray-800 font-medium"
          />
        </motion.div>
      )}
    </div>
  );
};

export default DailyOrdersPage;