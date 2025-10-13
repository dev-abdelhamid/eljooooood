import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/UI/Button';
import { Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';
import { salesAPI } from '../services/api';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';
import { Tooltip } from 'react-tooltip';

interface SalesRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  totalSales: number;
  dailySales: number[];
  totalValue: number;
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
  fontName: string
) => {
  const tableColumnWidths = headers.map((_, index) => {
    if (index === 0) return 15; // No.
    if (index === 1) return 25; // Code
    if (index === 2) return 45; // Product
    if (index === 3) return 25; // Unit
    if (index >= 4 && index < headers.length - 2) return 20; // Daily Sales
    return 30; // Total Sales, Total Value
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
  totalPrice: number
) => {
  try {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const fontName = 'Amiri';
    const fontLoaded = await loadFont(doc);
    generatePDFHeader(doc, isRtl, title, monthName, totalItems, totalQuantity, totalPrice, fontName, fontLoaded);
    generatePDFTable(doc, headers, data, isRtl, fontLoaded, fontName);
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

const SalesReport: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<{ [month: number]: SalesRow[] }>({});
  const [selectedMonth, setSelectedMonth] = useState(8); // September 2025
  const currentDate = new Date('2025-10-13T02:39:00+03:00');
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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const salesResponse = await salesAPI.getAnalytics({
          startDate: new Date(currentYear, selectedMonth, 1).toISOString(),
          endDate: new Date(currentYear, selectedMonth + 1, 0).toISOString(),
          lang: language,
        });

        const monthlySalesData: { [month: number]: SalesRow[] } = {};

        // Process product details with language support
        const productDetails = new Map<string, { code: string; product: string; unit: string; price: number }>();
        salesResponse.productSales?.forEach((item: any) => {
          if (item?.product?._id) {
            productDetails.set(item.product._id, {
              code: item.product.code || `code-${Math.random().toString(36).substring(2)}`,
              product: isRtl ? (item.product.name || 'منتج غير معروف') : (item.product.nameEn || item.product.name || 'Unknown Product'),
              unit: isRtl ? (item.product.unit || 'غير محدد') : (item.product.unitEn || item.product.unit || 'N/A'),
              price: Number(item.totalRevenue / item.totalQuantity) || 0,
            });
          }
        });

        // Process sales data for each month
        for (let month = 0; month < 12; month++) {
          const daysInMonthCount = new Date(currentYear, month + 1, 0).getDate();
          const salesMap = new Map<string, SalesRow>();

          if (month === selectedMonth) {
            salesResponse.productSales?.forEach((s: any) => {
              const productId = s.productId;
              if (!productId) return;
              const details = productDetails.get(productId) || {
                code: s.product?.code || `code-${Math.random().toString(36).substring(2)}`,
                product: isRtl
                  ? (s.product?.name || 'منتج غير معروف')
                  : (s.product?.nameEn || s.product?.name || 'Unknown Product'),
                unit: isRtl
                  ? (s.product?.unit || 'غير محدد')
                  : (s.product?.unitEn || s.product?.unit || 'N/A'),
                price: s.totalRevenue / s.totalQuantity || 0,
              };
              const key = `${productId}-${month}`;
              if (!salesMap.has(key)) {
                salesMap.set(key, {
                  id: key,
                  code: details.code,
                  product: details.product,
                  unit: details.unit,
                  totalSales: 0,
                  dailySales: Array(daysInMonthCount).fill(0),
                  totalValue: 0,
                });
              }
              const row = salesMap.get(key)!;
              s.dailySales?.forEach((sale: any, index: number) => {
                row.dailySales[index] += sale.quantity || 0;
                row.totalSales += sale.quantity || 0;
                row.totalValue += (sale.quantity || 0) * details.price;
              });
            });
          }

          monthlySalesData[month] = Array.from(salesMap.values());
        }

        setSalesData(monthlySalesData);
      } catch (error) {
        console.error('Failed to fetch sales data:', error);
        toast.error(isRtl ? 'فشل في جلب بيانات المبيعات' : 'Failed to fetch sales data', {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isRtl, currentYear, selectedMonth, language]);

  const getTooltipContent = (dailyQuantity: number, isRtl: boolean) => {
    const header = isRtl ? 'مبيعات' : 'Sales';
    return `${header}: +${formatNumber(dailyQuantity, isRtl)}`;
  };

  const renderSalesTable = useCallback(
    (data: SalesRow[], title: string, month: number) => {
      const grandTotalSales = data.reduce((sum, row) => sum + row.totalSales, 0);
      const grandTotalValue = data.reduce((sum, row) => sum + row.totalValue, 0);
      const monthName = months[month].label;

      const exportTable = (format: 'excel' | 'pdf') => {
        const headers = [
          isRtl ? 'رقم' : 'No.',
          isRtl ? 'الكود' : 'Code',
          isRtl ? 'المنتج' : 'Product',
          isRtl ? 'وحدة المنتج' : 'Product Unit',
          ...daysInMonth,
          isRtl ? 'إجمالي المبيعات' : 'Total Sales',
          isRtl ? 'القيمة الإجمالية' : 'Total Value',
        ];
        const rows = [
          ...data.map((row, index) => ({
            no: index + 1,
            code: row.code,
            product: row.product,
            unit: row.unit,
            ...Object.fromEntries(row.dailySales.map((qty, i) => [daysInMonth[i], qty])),
            totalSales: row.totalSales,
            totalValue: formatPrice(row.totalValue, isRtl),
          })),
          {
            no: '',
            code: '',
            product: isRtl ? 'الإجمالي' : 'Total',
            unit: '',
            ...Object.fromEntries(daysInMonth.map((_, i) => [daysInMonth[i], data.reduce((sum, row) => sum + row.dailySales[i], 0)])),
            totalSales: grandTotalSales,
            totalValue: formatPrice(grandTotalValue, isRtl),
          },
        ];
        const dataRows = rows.map(row => [
          row.no,
          row.code,
          row.product,
          row.unit,
          ...daysInMonth.map(day => row[day]),
          row.totalSales,
          row.totalValue,
        ]);

        if (format === 'excel') {
          const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows, { header: headers });
          if (isRtl) ws['!views'] = [{ RTL: true }];
          ws['!cols'] = [{ wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, ...daysInMonth.map(() => ({ wch: 12 })), { wch: 15 }, { wch: 15 }];
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, `${title}_${monthName}`);
          XLSX.writeFile(wb, `${title}_${monthName}.xlsx`);
          toast.success(isRtl ? 'تم تصدير ملف Excel بنجاح' : 'Excel exported successfully', {
            position: isRtl ? 'top-left' : 'top-right',
            autoClose: 3000,
          });
        } else if (format === 'pdf') {
          exportToPDF(dataRows, title, monthName, headers, isRtl, data.length, grandTotalSales, grandTotalValue);
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
            <div className="flex gap-2">
              <Button
                variant={data.length > 0 ? 'primary' : 'secondary'}
                onClick={data.length > 0 ? () => exportTable('excel') : undefined}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 ${
                  data.length > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
                disabled={data.length === 0}
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير إكسل' : 'Export Excel'}
              </Button>
              <Button
                variant={data.length > 0 ? 'primary' : 'secondary'}
                onClick={data.length > 0 ? () => exportTable('pdf') : undefined}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 ${
                  data.length > 0 ? 'bg-green-600 hover:bg-green-700 text-white shadow-sm' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
                disabled={data.length === 0}
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
              <thead className="bg-blue-100 sticky top-0">
                <tr className={isRtl ? 'flex-row-reverse' : ''}>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[40px]">{isRtl ? 'رقم' : 'No.'}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'الكود' : 'Code'}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[120px]">{isRtl ? 'المنتج' : 'Product'}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'وحدة المنتج' : 'Product Unit'}</th>
                  {daysInMonth.map((day, i) => (
                    <th key={i} className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">
                      {day}
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
                {data.map((row, index) => (
                  <tr key={row.id} className={`hover:bg-blue-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <td className="px-4 py-3 text-gray-700 text-center">{formatNumber(index + 1, isRtl)}</td>
                    <td className="px-4 py-3 text-gray-700 text-center truncate">{row.code}</td>
                    <td className="px-4 py-3 text-gray-700 text-center truncate">{row.product}</td>
                    <td className="px-4 py-3 text-gray-700 text-center truncate">{row.unit}</td>
                    {row.dailySales.map((qty, i) => (
                      <td
                        key={i}
                        className="px-4 py-3 text-center font-medium text-green-700 bg-green-50"
                        data-tooltip-id="sales-tooltip"
                        data-tooltip-content={getTooltipContent(qty, isRtl)}
                      >
                        {qty !== 0 ? `+${formatNumber(qty, isRtl)}` : '0'}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalSales, isRtl)}</td>
                    <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatPrice(row.totalValue, isRtl)}</td>
                  </tr>
                ))}
                <tr className={`font-semibold bg-gray-100 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-4 py-3 text-gray-800 text-center" colSpan={4}>{isRtl ? 'الإجمالي' : 'Total'}</td>
                  {daysInMonth.map((_, i) => (
                    <td key={i} className="px-4 py-3 text-gray-800 text-center">
                      {formatNumber(data.reduce((sum, row) => sum + row.dailySales[i], 0), isRtl)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalSales, isRtl)}</td>
                  <td className="px-4 py-3 text-gray-800 text-center">{formatPrice(grandTotalValue, isRtl)}</td>
                </tr>
              </tbody>
            </table>
            <Tooltip id="sales-tooltip" place="top" effect="solid" className="custom-tooltip" />
          </motion.div>
        </div>
      );
    },
    [loading, isRtl, daysInMonth, months, formatPrice]
  );

  return (
    <div className={`min-h-screen px-6 py-8 ${isRtl ? 'rtl font-amiri' : 'ltr font-inter'} bg-gray-100`}>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">{isRtl ? 'تقرير المبيعات' : 'Sales Report'}</h1>
      <div className="mb-8 bg-white shadow-md rounded-xl p-4">
        <div className="flex flex-wrap gap-2 mb-4 justify-center">
          {months.map(month => (
            <Button
              key={month.value}
              variant={selectedMonth === month.value ? 'primary' : 'secondary'}
              onClick={() => setSelectedMonth(month.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                selectedMonth === month.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {month.label}
            </Button>
          ))}
        </div>
      </div>
      <AnimatePresence>
        {renderSalesTable(salesData[selectedMonth] || [], isRtl ? 'تقرير المبيعات' : 'Sales Report', selectedMonth)}
      </AnimatePresence>
    </div>
  );
};

export default SalesReport;