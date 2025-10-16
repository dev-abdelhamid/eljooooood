import React, { useState, useEffect, useMemo, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { toast } from 'react-toastify';
import 'react-tooltip/dist/react-tooltip.css';
import { Tooltip } from 'react-tooltip';
import { inventoryAPI, ordersAPI, branchesAPI, salesAPI } from '../services/api'; // استيراد واجهات الـ API

// تعريف واجهة المستخدم (محاكاة لتجربة الكود)
const user = {
  role: 'admin', // يمكن استبدال هذا ببيانات المستخدم الحقيقية من authAPI.getProfile
};

// تعريف واجهات البيانات
interface OrderRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  price: number;
  dailyQuantities: number[];
  dailyBranchDetails: { [branch: string]: number }[];
  totalQuantity: number;
  totalPrice: number;
  actualSales: number;
  salesPercentage: string;
}

interface Branch {
  _id: string;
  name: string;
  nameEn: string;
  displayName: string;
}

// مكون زر مخصص
const Button: React.FC<{ onClick: () => void; className?: string; children: React.ReactNode }> = ({
  onClick,
  className,
  children,
}) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-center px-4 py-2 rounded-full font-medium transition-all duration-200 ${className}`}
  >
    {children}
  </button>
);

// مكون القائمة المنسدلة
const ProductDropdown: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
}> = ({ value, onChange, options, ariaLabel }) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="appearance-none w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm bg-white text-gray-700 pr-10"
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
  </div>
);

// مكون اختيار متعدد للفروع
const BranchMultiSelect: React.FC<{
  value: string[];
  onChange: (value: string[]) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
}> = ({ value, onChange, options, ariaLabel }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 flex items-center justify-between"
        aria-label={ariaLabel}
      >
        <span>{value.length > 0 ? value.join(', ') : 'Select Branches'}</span>
        <ChevronDown className="w-5 h-5 text-gray-500" />
      </button>
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {options.map((option) => (
            <label key={option.value} className="flex items-center px-4 py-2 hover:bg-gray-100 cursor-pointer">
              <input
                type="checkbox"
                checked={value.includes(option.value)}
                onChange={() => handleToggle(option.value)}
                className="mr-2"
              />
              {option.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

// مكون هيكل الجدول
const OrderTableSkeleton: React.FC<{ isRtl: boolean }> = ({ isRtl }) => (
  <div className="animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-full mb-4"></div>
    <div className="space-y-2">
      {Array(5)
        .fill(0)
        .map((_, index) => (
          <div key={index} className="flex space-x-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
    </div>
  </div>
);

// دوال مساعدة
const toArabicNumerals = (num: number | string): string => {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return num
    .toString()
    .replace(/\d/g, (digit) => arabicDigits[parseInt(digit)]);
};

const formatPrice = (price: number, isRtl: boolean): string => {
  const formatted = price.toLocaleString(isRtl ? 'ar-EG' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return isRtl ? `${formatted} جنيه` : `EGP ${formatted}`;
};

const formatNumber = (num: number, isRtl: boolean): string => {
  return isRtl ? toArabicNumerals(num) : num.toLocaleString('en-US');
};

// دالة تحميل الخط العربي لـ PDF
const loadFont = async (doc: jsPDF) => {
  try {
    const fontUrl = 'https://github.com/itf-fonts/amiri/raw/master/Amiri-Regular.ttf';
    const response = await fetch(fontUrl);
    const arrayBuffer = await response.arrayBuffer();
    const base64String = arrayBufferToBase64(arrayBuffer);
    doc.addFileToVFS('Amiri-Regular.ttf', base64String);
    doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
    return true;
  } catch (error) {
    console.error('Failed to load font:', error);
    return false;
  }
};

// تحويل ArrayBuffer إلى Base64
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// إنشاء اسم الملف
const generateFileName = (title: string, month: string): string => {
  const date = new Date().toISOString().split('T')[0];
  return `${title}_${month}_${date}`.replace(/[^a-zA-Z0-9]/g, '_');
};

// إنشاء رأس PDF
const generatePDFHeader = (
  doc: jsPDF,
  title: string,
  month: string,
  isRtl: boolean,
  totalItems: number,
  totalQuantity: number,
  totalPrice: number,
) => {
  const pageWidth = doc.internal.pageSize.width;
  const margin = 10;
  doc.setFont(isRtl ? 'Amiri' : 'Helvetica', 'normal');
  doc.setFontSize(16);
  const titleText = `${title} - ${month}`;
  const titleWidth = doc.getTextWidth(titleText);
  doc.text(titleText, isRtl ? pageWidth - margin - titleWidth : margin, 20);
  doc.setFontSize(12);
  const summary = [
    isRtl ? `إجمالي المنتجات: ${toArabicNumerals(totalItems)}` : `Total Products: ${totalItems}`,
    isRtl ? `إجمالي الكمية: ${toArabicNumerals(totalQuantity)}` : `Total Quantity: ${totalQuantity}`,
    isRtl ? `إجمالي السعر: ${formatPrice(totalPrice, isRtl)}` : `Total Price: ${formatPrice(totalPrice, isRtl)}`,
  ];
  summary.forEach((text, index) => {
    const textWidth = doc.getTextWidth(text);
    doc.text(text, isRtl ? pageWidth - margin - textWidth : margin, 30 + index * 10);
  });
};

// إنشاء جدول PDF
const generatePDFTable = (
  doc: jsPDF,
  data: any[][],
  headers: string[],
  isRtl: boolean,
  totalItems: number,
  totalQuantity: number,
  totalPrice: number,
  month: string,
  title: string,
) => {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  doc.setFont(isRtl ? 'Amiri' : 'Helvetica', 'normal');
  generatePDFHeader(doc, title, month, isRtl, totalItems, totalQuantity, totalPrice);
  (doc as any).autoTable({
    head: [headers],
    body: data,
    startY: 60,
    theme: 'grid',
    headStyles: {
      fillColor: [255, 193, 7],
      textColor: [0, 0, 0],
      fontSize: 10,
      font: isRtl ? 'Amiri' : 'Helvetica',
      halign: isRtl ? 'right' : 'left',
    },
    bodyStyles: {
      fontSize: 9,
      font: isRtl ? 'Amiri' : 'Helvetica',
      halign: isRtl ? 'right' : 'left',
      textColor: [51, 51, 51],
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: { top: 60, left: isRtl ? 10 : 10, right: isRtl ? 10 : 10 },
    didDrawPage: (data: any) => {
      const pageNumber = doc.getCurrentPageInfo().pageNumber;
      doc.setFontSize(10);
      const pageText = isRtl ? `صفحة ${toArabicNumerals(pageNumber)}` : `Page ${pageNumber}`;
      const pageTextWidth = doc.getTextWidth(pageText);
      doc.text(pageText, isRtl ? pageWidth - 10 - pageTextWidth : 10, pageHeight - 10);
    },
  });
};

// تصدير إلى PDF
const exportToPDF = async (
  data: any[][],
  title: string,
  month: string,
  headers: string[],
  isRtl: boolean,
  totalItems: number,
  totalQuantity: number,
  totalPrice: number,
) => {
  const doc = new jsPDF();
  if (isRtl) {
    const fontLoaded = await loadFont(doc);
    if (!fontLoaded) {
      toast.error('Failed to load Arabic font');
      return;
    }
    doc.setFont('Amiri', 'normal');
  }
  generatePDFTable(doc, data, isRtl ? headers.reverse() : headers, isRtl, totalItems, totalQuantity, totalPrice, month, title);
  doc.save(`${generateFileName(title, month)}.pdf`);
  toast.success(isRtl ? 'تم تصدير ملف PDF بنجاح' : 'PDF exported successfully');
};

// مكون تقرير الطلبات اليومية
const DailyOrdersSummary: React.FC = () => {
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'ar');
  const isRtl = language === 'ar';

  // التحقق من صلاحيات المستخدم
  if (!user || (user.role !== 'admin' && user.role !== 'production')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-red-500 text-lg">{isRtl ? 'غير مصرح لك بالوصول إلى هذه الصفحة' : 'You are not authorized to access this page'}</p>
      </div>
    );
  }

  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<OrderRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: new Date(currentYear, i).toLocaleString(language, { month: 'long' }),
  }));

  const getDaysInMonth = (month: number) => {
    const daysInMonthCount = new Date(currentYear, month + 1, 0).getDate();
    return Array.from({ length: daysInMonthCount }, (_, i) => {
      const date = new Date(currentYear, month, i + 1);
      return date.toLocaleString(language, { day: 'numeric', month: 'short' });
    });
  };

  const daysInMonth = useMemo(() => getDaysInMonth(selectedMonth), [selectedMonth]);
  const allBranches = useMemo(() => branches.map(b => b.displayName).sort((a, b) => a.localeCompare(b, language)), [branches, language]);
  const minDate = new Date(currentYear, selectedMonth, 1).toISOString().split('T')[0];
  const maxDate = new Date(currentYear, selectedMonth + 1, 0).toISOString().split('T')[0];
  const weekCount = Math.ceil(daysInMonth.length / 7);
  const periodOptions = [
    { value: 'all', label: isRtl ? 'كل الشهر' : 'All Month' },
    ...Array.from({ length: weekCount }, (_, i) => ({
      value: `week${i + 1}`,
      label: isRtl ? `الأسبوع ${toArabicNumerals(i + 1)}` : `Week ${i + 1}`,
    })),
    { value: 'custom', label: isRtl ? 'مخصص' : 'Custom' },
  ];
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
    return indices.sort((a, b) => a - b);
  }, [selectedPeriod, startDate, endDate, daysInMonth.length]);

  // جلب البيانات باستخدام واجهات الـ API
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [inventoryResponse, ordersResponse, branchesResponse, salesResponse] = await Promise.all([
          inventoryAPI.getInventory({ lang: language }),
          ordersAPI.getAll({ status: 'completed', page: 1, limit: 1000, lang: language }),
          branchesAPI.getAll(),
          salesAPI.getAnalytics({
            startDate: new Date(currentYear, selectedMonth, 1).toISOString(),
            endDate: new Date(currentYear, selectedMonth + 1, 0).toISOString(),
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
        inventoryResponse.forEach((item: any) => {
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
          orders = inventoryResponse
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

        const daysInMonthCount = new Date(currentYear, selectedMonth + 1, 0).getDate();
        const orderMap = new Map<string, OrderRow>();

        orders.forEach((order: any) => {
          const status = order.status || order.orderStatus;
          if (status !== 'completed') return;
          const date = new Date(order.createdAt || order.date);
          if (isNaN(date.getTime())) return;
          const orderMonth = date.getMonth();
          const year = date.getFullYear();
          if (year === currentYear && orderMonth === selectedMonth) {
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
                  price: details.price,
                  dailyQuantities: Array(daysInMonthCount).fill(0),
                  dailyBranchDetails: Array.from({ length: daysInMonthCount }, () => ({})),
                  totalQuantity: 0,
                  totalPrice: 0,
                  actualSales: 0,
                  salesPercentage: '0.00',
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

        // إضافة المبيعات الفعلية
        for (const row of orderMap.values()) {
          const salesItem = salesResponse.productSales?.find((s: any) => s.productId === row.id);
          if (salesItem) {
            row.actualSales = Number(salesItem.totalQuantity) || 0;
          }
          row.salesPercentage = row.totalQuantity > 0 ? ((row.actualSales / row.totalQuantity) * 100).toFixed(2) : '0.00';
        }

        setOrderData(Array.from(orderMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity));
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast.error(isRtl ? `فشل في جلب البيانات: ${error.message}` : `Failed to fetch data: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedMonth, isRtl, language, currentYear]);

  const filteredData = useMemo(() => {
    return orderData
      .filter(row => row.product.toLowerCase().includes(search.toLowerCase()))
      .map(row => {
        const filteredDailyQuantities = selectedDayIndices.map(i => {
          if (selectedBranches.length === 0) return row.dailyQuantities[i];
          return selectedBranches.reduce((sum, b) => sum + (row.dailyBranchDetails[i][b] || 0), 0);
        });
        const filteredTotalQuantity = filteredDailyQuantities.reduce((a, b) => a + b, 0);
        const filteredTotalPrice = filteredTotalQuantity * row.price;
        const filteredActualSales = row.actualSales;
        const filteredSalesPercentage = filteredTotalQuantity > 0 ? ((filteredActualSales / filteredTotalQuantity) * 100).toFixed(2) : '0.00';
        const filteredDailyBranchDetails = selectedDayIndices.map(i => {
          if (selectedBranches.length === 0) return row.dailyBranchDetails[i];
          return Object.fromEntries(selectedBranches.map(b => [b, row.dailyBranchDetails[i][b] || 0]));
        });
        return {
          ...row,
          dailyQuantities: filteredDailyQuantities,
          dailyBranchDetails: filteredDailyBranchDetails,
          totalQuantity: filteredTotalQuantity,
          totalPrice: filteredTotalPrice,
          salesPercentage: filteredSalesPercentage,
        };
      });
  }, [orderData, search, selectedBranches, selectedDayIndices]);

  const grandTotalQuantity = filteredData.reduce((sum, row) => sum + row.totalQuantity, 0);
  const grandTotalPrice = filteredData.reduce((sum, row) => sum + row.totalPrice, 0);
  const grandActualSales = filteredData.reduce((sum, row) => sum + row.actualSales, 0);
  const grandSalesPercentage = grandTotalQuantity > 0 ? ((grandActualSales / grandTotalQuantity) * 100).toFixed(2) : '0.00';

  const monthName = months[selectedMonth].label;

  const exportTable = (format: 'excel' | 'pdf') => {
    const headers = [
      isRtl ? 'رقم' : 'No.',
      isRtl ? 'الكود' : 'Code',
      isRtl ? 'المنتج' : 'Product',
      isRtl ? 'وحدة المنتج' : 'Product Unit',
      ...selectedDayIndices.map(i => daysInMonth[i]),
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
        ...Object.fromEntries(row.dailyQuantities.map((qty, j) => [daysInMonth[selectedDayIndices[j]], qty])),
        totalQuantity: row.totalQuantity,
        actualSales: row.actualSales,
        totalPrice: formatPrice(row.totalPrice, isRtl),
        salesPercentage: row.salesPercentage,
      })),
      {
        no: '',
        code: '',
        product: isRtl ? 'الإجمالي' : 'Total',
        unit: '',
        ...Object.fromEntries(selectedDayIndices.map((i, j) => [daysInMonth[i], filteredData.reduce((sum, row) => sum + row.dailyQuantities[j], 0)])),
        totalQuantity: grandTotalQuantity,
        actualSales: grandActualSales,
        totalPrice: formatPrice(grandTotalPrice, isRtl),
        salesPercentage: grandSalesPercentage,
      },
    ];
    const dataRows = rows.map(row => [
      row.no,
      row.code,
      row.product,
      row.unit,
      ...selectedDayIndices.map((i, j) => row[daysInMonth[i]]),
      row.totalQuantity,
      row.actualSales,
      row.totalPrice,
      `${row.salesPercentage}%`,
    ]);
    if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows, { header: headers });
      if (isRtl) ws['!views'] = [{ RTL: true }];
      ws['!cols'] = [{ wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, ...selectedDayIndices.map(() => ({ wch: 12 })), { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Daily_Orders_${monthName}`);
      XLSX.writeFile(wb, `Daily_Orders_${monthName}.xlsx`);
      toast.success(isRtl ? 'تم تصدير ملف Excel بنجاح' : 'Excel exported successfully');
    } else if (format === 'pdf') {
      exportToPDF(dataRows, isRtl ? 'إجمالي حركة الطلبات اليومية' : 'Daily Orders Summary', monthName, headers, isRtl, filteredData.length, grandTotalQuantity, grandTotalPrice);
    }
  };

  const getTooltipContent = (qty: number, branchDetails: { [branch: string]: number }, isRtl: boolean) => {
    let content = `${isRtl ? 'الكمية' : 'Quantity'}: ${formatNumber(qty, isRtl)}`;
    if (Object.keys(branchDetails).length > 0) {
      content += '\n' + Object.entries(branchDetails).map(([branch, q]) => `${branch}: ${formatNumber(q, isRtl)}`).join('\n');
    }
    return content;
  };

  return (
    <div className={`min-h-screen px-6 py-8 ${isRtl ? 'rtl font-amiri' : 'ltr font-inter'} bg-gray-100`}>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">{isRtl ? 'إجمالي حركة الطلبات اليومية' : 'Daily Orders Summary'}</h1>
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
      </div>
      <div className="mb-8">
        <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <h2 className="text-lg font-semibold text-gray-800">{isRtl ? `إجمالي حركة الطلبات - ${monthName}` : `Daily Orders Summary - ${monthName}`}</h2>
          <input
            type="text"
            placeholder={isRtl ? 'بحث بالمنتج...' : 'Search by product...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 text-sm text-gray-700 ${isRtl ? 'text-right' : 'text-left'}`}
          />
          <div className="flex gap-2">
            <Button onClick={() => exportTable('excel')} className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
              <Upload className="w-4 h-4" />
              {isRtl ? 'تصدير إكسل' : 'Export Excel'}
            </Button>
            <Button onClick={() => exportTable('pdf')} className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 bg-green-600 hover:bg-green-700 text-white shadow-sm">
              <Upload className="w-4 h-4" />
              {isRtl ? 'تصدير PDF' : 'Export PDF'}
            </Button>
          </div>
        </div>
        {loading ? (
          <OrderTableSkeleton isRtl={isRtl} />
        ) : (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              className="overflow-x-auto rounded-xl shadow-xl border border-gray-200 bg-white mt-4"
            >
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-amber-50 sticky top-0 shadow-sm">
                  <tr className={isRtl ? 'flex-row-reverse' : ''}>
                    <th className="px-6 py-4 font-bold text-gray-800 text-center min-w-[50px]">{isRtl ? 'رقم' : 'No.'}</th>
                    <th className="px-6 py-4 font-bold text-gray-800 text-center min-w-[100px]">{isRtl ? 'الكود' : 'Code'}</th>
                    <th className="px-6 py-4 font-bold text-gray-800 text-center min-w-[150px]">{isRtl ? 'المنتج' : 'Product'}</th>
                    <th className="px-6 py-4 font-bold text-gray-800 text-center min-w-[100px]">{isRtl ? 'وحدة المنتج' : 'Product Unit'}</th>
                    {selectedDayIndices.map((i) => (
                      <th key={i} className="px-6 py-4 font-bold text-gray-800 text-center min-w-[100px]">
                        {daysInMonth[i]}
                      </th>
                    ))}
                    <th className="px-6 py-4 font-bold text-gray-800 text-center min-w-[120px]">{isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}</th>
                    <th className="px-6 py-4 font-bold text-gray-800 text-center min-w-[120px]">{isRtl ? 'المبيعات الفعلية' : 'Actual Sales'}</th>
                    <th className="px-6 py-4 font-bold text-gray-800 text-center min-w-[120px]">{isRtl ? 'السعر الإجمالي' : 'Total Price'}</th>
                    <th className="px-6 py-4 font-bold text-gray-800 text-center min-w-[120px]">{isRtl ? 'نسبة المبيعات %' : 'Sales %'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredData.map((row, index) => (
                    <tr key={row.id} className={`hover:bg-amber-50 transition-all duration-300 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <td className="px-6 py-4 text-gray-700 text-center">{formatNumber(index + 1, isRtl)}</td>
                      <td className="px-6 py-4 text-gray-700 text-center truncate">{row.code}</td>
                      <td className="px-6 py-4 text-gray-700 text-center truncate">{row.product}</td>
                      <td className="px-6 py-4 text-gray-700 text-center truncate">{row.unit}</td>
                      {row.dailyQuantities.map((qty, j) => (
                        <td
                          key={j}
                          className={`px-6 py-4 text-center font-medium ${qty > 0 ? 'bg-green-100 text-green-800' : 'text-gray-700'}`}
                          data-tooltip-id="daily-quantity"
                          data-tooltip-content={getTooltipContent(qty, row.dailyBranchDetails[j], isRtl)}
                        >
                          {formatNumber(qty, isRtl)}
                        </td>
                      ))}
                      <td className="px-6 py-4 text-gray-800 text-center font-bold">{formatNumber(row.totalQuantity, isRtl)}</td>
                      <td className="px-6 py-4 text-gray-800 text-center font-bold">{formatNumber(row.actualSales, isRtl)}</td>
                      <td className="px-6 py-4 text-gray-800 text-center font-bold">{formatPrice(row.totalPrice, isRtl)}</td>
                      <td className="px-6 py-4 text-gray-800 text-center font-bold">{row.salesPercentage}%</td>
                    </tr>
                  ))}
                  <tr className={`font-bold bg-gray-100 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <td className="px-6 py-4 text-gray-900 text-center" colSpan={4}>{isRtl ? 'الإجمالي' : 'Total'}</td>
                    {selectedDayIndices.map((i, j) => (
                      <td key={j} className="px-6 py-4 text-gray-900 text-center">
                        {formatNumber(filteredData.reduce((sum, row) => sum + row.dailyQuantities[j], 0), isRtl)}
                      </td>
                    ))}
                    <td className="px-6 py-4 text-gray-900 text-center">{formatNumber(grandTotalQuantity, isRtl)}</td>
                    <td className="px-6 py-4 text-gray-900 text-center">{formatNumber(grandActualSales, isRtl)}</td>
                    <td className="px-6 py-4 text-gray-900 text-center">{formatPrice(grandTotalPrice, isRtl)}</td>
                    <td className="px-6 py-4 text-gray-900 text-center">{grandSalesPercentage}%</td>
                  </tr>
                </tbody>
              </table>
              <Tooltip id="daily-quantity" place="top" className="custom-tooltip bg-amber-100 text-amber-900 shadow-lg" />
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default DailyOrdersSummary;