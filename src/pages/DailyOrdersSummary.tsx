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
  const selectedOption = options.find((opt) => opt.value === value) || options[0] || { label: isRtl ? 'اختر' : 'Select' };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isRtl]);

  return (
    <div className={`relative group w-full ${className}`} ref={dropdownRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-200 bg-white shadow-md hover:shadow-lg text-sm text-gray-700 ${isRtl ? 'text-right font-amiri' : 'text-left font-inter'} flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={ariaLabel}
      >
        <span className="truncate">{selectedOption.label}</span>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && !disabled && (
        <div className={`absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-52 overflow-y-auto ${isRtl ? 'text-right font-amiri' : 'text-left font-inter'}`}>
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-sm hover:bg-amber-50 transition-colors text-left"
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

const generateFileName = (prefix: string, monthName: string, isRtl: boolean, extension: string): string => {
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, isRtl ? '٢٠٢٥' : '2025');
  return `${prefix}_${monthName}_${dateStr}.${extension}`;
};

// Export functions
const exportToExcel = (dataRows: any[], headers: string[], monthName: string, isRtl: boolean) => {
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
      { wch: 20 },
      { wch: 20 },
      ...Array(headers.length - 4).fill({ wch: 15 }),
      { wch: 20 },
      { wch: 50 },
      { wch: 50 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `DailyOrdersSummary_${monthName}`);
    XLSX.writeFile(wb, generateFileName('DailyOrdersSummary', monthName, isRtl, 'xlsx'));
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

const exportToPDF = async (dataRows: any[], title: string, monthName: string, headers: string[], isRtl: boolean) => {
  toast.info(isRtl ? 'جارٍ إنشاء ملف PDF...' : 'Generating PDF...', {
    position: isRtl ? 'top-left' : 'top-right',
    autoClose: false,
    toastId: 'pdf-export',
  });
  try {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const fontName = 'Amiri';
    const fontLoaded = await loadFont(doc, fontName);

    const pageWidth = doc.internal.pageSize.width;
    doc.setFont(fontLoaded ? fontName : 'helvetica', 'normal');
    doc.setFontSize(20);
    doc.setTextColor(33, 33, 33);
    doc.text(title, isRtl ? pageWidth - 20 : 20, 15, { align: isRtl ? 'right' : 'left' });

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const currentDate = new Date().toLocaleString('ar-EG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).replace(/am|pm/i, match => match === 'am' ? 'ص' : 'م');
    doc.text(`${isRtl ? 'تاريخ الإنشاء: ' : 'Generated on: '}${currentDate}`, isRtl ? pageWidth - 20 : 20, 25, { align: isRtl ? 'right' : 'left' });

    doc.setLineWidth(0.7);
    doc.setDrawColor(245, 158, 11);
    doc.line(20, 30, pageWidth - 20, 30);

    const tableData = isRtl ? dataRows.map(row => row.slice().reverse()) : dataRows;
    const tableHeaders = isRtl ? headers.slice().reverse() : headers;

    autoTable(doc, {
      head: [tableHeaders],
      body: tableData,
      startY: 40,
      theme: 'grid',
      margin: { top: 10, bottom: 20, left: 15, right: 15 },
      tableWidth: 'auto',
      headStyles: {
        fillColor: [245, 158, 11],
        textColor: [255, 255, 255],
        fontSize: 12,
        font: fontLoaded ? fontName : 'helvetica',
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: 4,
      },
      bodyStyles: {
        fontSize: 10,
        textColor: [33, 33, 33],
        font: fontLoaded ? fontName : 'helvetica',
        halign: 'center',
        lineColor: [180, 180, 180],
        fillColor: [255, 255, 255],
        cellPadding: 3,
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index >= (isRtl ? 0 : headers.length - 4)) {
          data.cell.styles.fontStyle = 'bold';
        }
        if (isRtl) {
          data.cell.text = data.cell.text.map(text => String(text).replace(/[0-9]/g, d => toArabicNumerals(d)));
        }
      },
      didDrawPage: (data) => {
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.setFont(fontLoaded ? fontName : 'helvetica', 'normal');
      
      },
    });

    const fileName = generateFileName('DailyOrdersSummary', monthName, isRtl, 'pdf');
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

const loadFont = async (doc: jsPDF, fontName: string) => {
  try {
    const fontUrls = {
      regular: 'https://raw.githubusercontent.com/aliftype/amiri/master/fonts/Amiri-Regular.ttf',
      bold: 'https://raw.githubusercontent.com/aliftype/amiri/master/fonts/Amiri-Bold.ttf',
    };
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

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return window.btoa(binary);
};

// Main DailyOrdersSummary component
const DailyOrdersSummary: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const [selectedMonth, setSelectedMonth] = useState<string>(currentDate.getMonth().toString());
  const [orderData, setOrderData] = useState<OrderRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    value: i.toString(),
    label: new Date(currentYear, i).toLocaleString(language, { month: 'long' }),
  })), [currentYear, language]);

  const monthName = useMemo(() => months.find(m => m.value === selectedMonth)?.label || '', [months, selectedMonth]);

  const allBranches = useMemo(() => branches.map(b => b.displayName).sort((a, b) => a.localeCompare(b, language)), [branches, language]);

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
        toast.warn(isRtl ? 'لا توجد طلبات، استخدام بيانات احتياطية' : 'No orders found, using fallback data');
        orders = inventory
          .filter((item: any) => item?.product?._id)
          .flatMap((item: any) => (item.movements || []).map((movement: any) => ({
            status: 'completed',
            createdAt: movement.createdAt || new Date().toISOString(),
            branch: { _id: fetchedBranches[Math.floor(Math.random() * fetchedBranches.length)]?._id },
            items: [{
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
            }],
          })));
      }
      const orderMap = new Map<string, OrderRow>();
      orders.forEach((order: any) => {
        const status = order.status || order.orderStatus;
        const date = new Date(order.createdAt || order.date);
        if (isNaN(date.getTime())) return;
        const orderMonth = date.getMonth();
        const year = date.getFullYear();
        if (year === currentYear && orderMonth === parseInt(selectedMonth)) {
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
        }
      });

      for (const row of orderMap.values()) {
        const salesItem = salesResponse.productSales?.find((s: any) => s.productId === row.id);
        if (salesItem) row.actualSales = Number(salesItem.totalQuantity) || 0;
      }

      setOrderData(Array.from(orderMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity));
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error(isRtl ? 'فشل في جلب البيانات' : 'Failed to fetch data', {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    } finally {
      setLoading(false);
    }
  }, [isRtl, currentYear, selectedMonth, language]);

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
      ...allBranches,
      isRtl ? 'الإجمالي' : 'Total',
      isRtl ? 'وحدة' : 'Unit',
    ];
    const rows = [
      ...filteredData.map((row) => [
        row.product,
        formatPrice(row.price, isRtl),
        row.code,
        ...allBranches.map(branch => formatNumber(row.branchQuantities[branch] || 0, isRtl)),
        formatNumber(row.totalQuantity, isRtl),
        row.unit,
      ]),
      [
        isRtl ? 'الإجمالي' : 'Total',
        formatPrice(grandTotalPrice, isRtl),
        '',
        ...allBranches.map(branch => formatNumber(filteredData.reduce((sum, row) => sum + (row.branchQuantities[branch] || 0), 0), isRtl)),
        formatNumber(grandTotalQuantity, isRtl),
        '',
      ],
    ];
    if (format === 'excel') exportToExcel(rows, headers, monthName, isRtl);
    else if (format === 'pdf') exportToPDF(rows, isRtl ? 'ملخص الطلبات اليومية' : 'Daily Orders Summary', monthName, headers, isRtl);
  };

  if (!user || (user.role !== 'admin' && user.role !== 'production')) {
    return <div className="text-center py-16 text-lg font-medium text-gray-800">{isRtl ? 'لا يوجد صلاحية' : 'No access'}</div>;
  }

  return (
    <div className={`min-h-screen px-8 py-10 ${isRtl ? 'rtl font-amiri' : 'ltr font-inter'} bg-gray-50`}>
      <div className="mb-10 bg-white shadow-xl rounded-2xl p-8">
        <div className={`flex flex-wrap gap-4 mb-8 justify-center ${isRtl ? 'flex-row-reverse' : ''}`}>
          {months.map((month) => (
            <Button
              key={month.value}
              variant={selectedMonth === month.value ? 'primary' : 'secondary'}
              onClick={() => setSelectedMonth(month.value)}
              className="capitalize"
            >
              {month.label}
            </Button>
          ))}
        </div>
      </div>
      <div className={`mb-10 ${isRtl ? 'flex-row-reverse' : ''}`}>
        <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
         
          <div className="flex gap-4">
            <Button
              variant={filteredData.length > 0 ? 'primary' : 'secondary'}
              onClick={filteredData.length > 0 ? () => exportTable('excel') : undefined}
              disabled={filteredData.length === 0}
            >
              <Upload className="w-5 h-5" />
              {isRtl ? 'تصدير إكسل' : 'Export Excel'}
            </Button>
            <Button
              variant={filteredData.length > 0 ? 'primary' : 'secondary'}
              onClick={filteredData.length > 0 ? () => exportTable('pdf') : undefined}
              disabled={filteredData.length === 0}
            >
              <Upload className="w-5 h-5" />
              {isRtl ? 'تصدير PDF' : 'Export PDF'}
            </Button>
          </div>
        </div>
        <ProductSearchInput
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={isRtl ? 'ابحث عن منتج...' : 'Search for product...'}
          ariaLabel={isRtl ? 'بحث المنتج' : 'Product search'}
          className="mt-8 w-full lg:w-1/3"
        />
      </div>
      {loading ? (
        <OrderTableSkeleton isRtl={isRtl} />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="overflow-x-auto rounded-2xl shadow-xl border border-gray-200 bg-white"
        >
          <table className="min-w-full divide-y divide-gray-200 text-base">
            <thead className="bg-amber-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-700 text-center min-w-[180px]">{isRtl ? 'الاسم' : 'Name'}</th>
                <th className="px-6 py-4 font-semibold text-gray-700 text-center min-w-[100px]">{isRtl ? 'السعر' : 'Price'}</th>
                <th className="px-6 py-4 font-semibold text-gray-700 text-center min-w-[100px]">{isRtl ? 'الكود' : 'Code'}</th>
                {allBranches.map((branch) => (
                  <th key={branch} className="px-6 py-4 font-semibold text-gray-700 text-center min-w-[120px]">
                    {branch}
                  </th>
                ))}
                <th className="px-6 py-4 font-semibold text-gray-700 text-center min-w-[100px]">{isRtl ? 'الإجمالي' : 'Total'}</th>
                <th className="px-6 py-4 font-semibold text-gray-700 text-center min-w-[100px]">{isRtl ? 'وحدة' : 'Unit'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredData.map((row) => (
                <tr key={row.id} className="hover:bg-amber-50 transition-colors duration-200">
                  <td className="px-6 py-4 text-gray-700 text-center truncate">{row.product}</td>
                  <td className="px-6 py-4 text-gray-700 text-center">{formatPrice(row.price, isRtl)}</td>
                  <td className="px-6 py-4 text-gray-700 text-center">{row.code}</td>
                  {allBranches.map((branch) => (
                    <td
                      key={branch}
                      className={`px-6 py-4 text-center font-medium ${row.branchQuantities[branch] > 0 ? 'bg-green-50 text-green-700' : 'text-gray-700'}`}
                      data-tooltip-id="branch-tooltip"
                      data-tooltip-content={getTooltipContent(row.branchQuantities[branch] || 0, isRtl)}
                    >
                      {row.branchQuantities[branch] !== 0 ? formatNumber(row.branchQuantities[branch] || 0, isRtl) : '0'}
                    </td>
                  ))}
                  <td className="px-6 py-4 text-gray-700 text-center font-medium">{formatNumber(row.totalQuantity, isRtl)}</td>
                  <td className="px-6 py-4 text-gray-700 text-center">{row.unit}</td>
                </tr>
              ))}
              <tr className="font-semibold bg-gray-50">
                <td className="px-6 py-4 text-gray-800 text-center">{isRtl ? 'الإجمالي' : 'Total'}</td>
                <td className="px-6 py-4 text-gray-800 text-center">{formatPrice(grandTotalPrice, isRtl)}</td>
                <td className="px-6 py-4 text-gray-800 text-center"></td>
                {allBranches.map((branch) => (
                  <td key={branch} className="px-6 py-4 text-gray-800 text-center">
                    {formatNumber(filteredData.reduce((sum, row) => sum + (row.branchQuantities[branch] || 0), 0), isRtl)}
                  </td>
                ))}
                <td className="px-6 py-4 text-gray-800 text-center">{formatNumber(grandTotalQuantity, isRtl)}</td>
                <td className="px-6 py-4 text-gray-800 text-center"></td>
              </tr>
            </tbody>
          </table>
          <Tooltip id="branch-tooltip" place="top" className="custom-tooltip whitespace-pre-line z-50" />
        </motion.div>
      )}
    </div>
  );
};

export default DailyOrdersSummary;