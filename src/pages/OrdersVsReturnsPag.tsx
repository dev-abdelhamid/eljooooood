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
import { ordersAPI, returnsAPI, branchesAPI, productsAPI } from '../services/api';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';
import { Tooltip } from 'react-tooltip';
import DailyOrdersVsReturnsComponent from './DailyOrdersVsReturnsComponent';

interface Branch {
  _id: string;
  name: string;
  nameEn: string;
  displayName: string;
}

interface Product {
  _id: string;
  code: string;
  name: string;
  nameEn: string;
  unit: string;
  unitEn: string;
  price: number;
}

interface OrdersVsReturnsRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  dailyOrders: number[];
  dailyReturns: number[];
  dailyOrdersDetails: { [branch: string]: number }[];
  dailyReturnsDetails: { [branch: string]: number }[];
  totalOrders: number;
  totalReturns: number;
  totalRatio: number;
}

const toArabicNumerals = (number: string | number): string => {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(number).replace(/[0-9]/g, (digit) => arabicNumerals[parseInt(digit)]);
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

const OrdersVsReturnsPage: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [ordersVsReturnsData, setOrdersVsReturnsData] = useState<{ [month: number]: OrdersVsReturnsRow[] }>({});
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // Current month
  const currentDate = new Date('2025-10-16T00:00:00+03:00');
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

  const allBranches = useMemo(() => {
    return branches.map(b => b.displayName).sort();
  }, [branches]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [ordersResponse, returnsResponse, branchesResponse, productsResponse] = await Promise.all([
          ordersAPI.getAll({ status: 'completed', page: 1, limit: 1000 }, isRtl),
          returnsAPI.getAll({
            status: 'approved',
            page: 1,
            limit: 1000,
            startDate: new Date(currentYear, 0, 1).toISOString(),
            endDate: new Date(currentYear, 11, 31).toISOString(),
          }),
          branchesAPI.getAll(),
          productsAPI.getAll({ page: 1, limit: 1000 }),
        ]);

        // Process branches
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

        // Process products
        const fetchedProducts = productsResponse.products.map((product: any) => ({
          _id: product._id,
          code: product.code || `code-${Math.random().toString(36).substring(2)}`,
          name: product.name || (isRtl ? 'منتج غير معروف' : 'Unknown Product'),
          nameEn: product.nameEn || product.name || 'Unknown Product',
          unit: product.unit || (isRtl ? 'غير محدد' : 'N/A'),
          unitEn: product.unitEn || product.unit || 'N/A',
          price: Number(product.price) || 0,
        }));
        setProducts(fetchedProducts);

        const branchMap = new Map<string, string>(fetchedBranches.map(b => [b._id, b.displayName]));
        const productDetails = new Map<string, { code: string; product: string; unit: string; price: number }>();
        fetchedProducts.forEach((product: Product) => {
          productDetails.set(product._id, {
            code: product.code,
            product: isRtl ? product.name : product.nameEn,
            unit: isRtl ? product.unit : product.unitEn,
            price: product.price,
          });
        });

        const monthlyOrdersVsReturnsData: { [month: number]: OrdersVsReturnsRow[] } = {};

        // Process data for each month
        for (let month = 0; month < 12; month++) {
          const daysInMonthCount = new Date(currentYear, month + 1, 0).getDate();
          const ordersVsReturnsMap = new Map<string, OrdersVsReturnsRow>();

          // Initialize data for all products
          fetchedProducts.forEach((product: Product) => {
            const key = `${product._id}-${month}`;
            ordersVsReturnsMap.set(key, {
              id: key,
              code: product.code,
              product: isRtl ? product.name : product.nameEn,
              unit: isRtl ? product.unit : product.unitEn,
              dailyOrders: Array(daysInMonthCount).fill(0),
              dailyReturns: Array(daysInMonthCount).fill(0),
              dailyOrdersDetails: Array.from({ length: daysInMonthCount }, () => ({})),
              dailyReturnsDetails: Array.from({ length: daysInMonthCount }, () => ({})),
              totalOrders: 0,
              totalReturns: 0,
              totalRatio: 0,
            });
          });

          // Process orders
          let orders = Array.isArray(ordersResponse) ? ordersResponse : ordersResponse.orders || [];
          orders.forEach((order: any) => {
            const status = order.status || order.orderStatus;
            if (status !== 'completed') return;
            const date = new Date(order.createdAt || order.date);
            if (isNaN(date.getTime())) return;
            const orderMonth = date.getMonth();
            const year = date.getFullYear();
            if (year === currentYear && orderMonth === month) {
              const day = date.getDate() - 1;
              const branch =
                order.branch?.displayName ||
                order.branch?.name ||
                branchMap.get(order.branch?._id || order.branchId) ||
                (isRtl ? 'الفرع الرئيسي' : 'Main Branch');
              (order.items || []).forEach((item: any) => {
                const productId = item.product?._id || item.productId;
                if (!productId || !productDetails.has(productId)) return;
                const key = `${productId}-${month}`;
                const row = ordersVsReturnsMap.get(key)!;
                const quantity = Number(item.quantity) || 0;
                row.dailyOrders[day] += quantity;
                row.dailyOrdersDetails[day][branch] = (row.dailyOrdersDetails[day][branch] || 0) + quantity;
                row.totalOrders += quantity;
              });
            }
          });

          // Process returns
          let returns = Array.isArray(returnsResponse) ? returnsResponse : returnsResponse.data || [];
          returns.forEach((returnItem: any) => {
            if (returnItem.status !== 'approved') return;
            const date = new Date(returnItem.createdAt || returnItem.date);
            if (isNaN(date.getTime())) return;
            const returnMonth = date.getMonth();
            const year = date.getFullYear();
            if (year === currentYear && returnMonth === month) {
              const day = date.getDate() - 1;
              const branch =
                branchMap.get(returnItem.branch?._id || returnItem.branchId) ||
                (isRtl ? 'الفرع الرئيسي' : 'Main Branch');
              (returnItem.items || []).forEach((item: any) => {
                const productId = item.product?._id || item.product;
                if (!productId || !productDetails.has(productId)) return;
                const key = `${productId}-${month}`;
                const row = ordersVsReturnsMap.get(key)!;
                const quantity = Number(item.quantity) || 0;
                row.dailyReturns[day] += quantity;
                row.dailyReturnsDetails[day][branch] = (row.dailyReturnsDetails[day][branch] || 0) + quantity;
                row.totalReturns += quantity;
              });
            }
          });

          // Calculate ratios
          ordersVsReturnsMap.forEach((row, key) => {
            row.totalRatio = row.totalOrders > 0 ? (row.totalReturns / row.totalOrders * 100) : 0;
          });

          monthlyOrdersVsReturnsData[month] = Array.from(ordersVsReturnsMap.values()).sort((a, b) => b.totalRatio - a.totalRatio);
        }

        setOrdersVsReturnsData(monthlyOrdersVsReturnsData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast.error(isRtl ? 'فشل في جلب البيانات' : 'Failed to fetch data', {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isRtl, currentYear, language]);

  const handleExportExcel = () => {
    const data = ordersVsReturnsData[selectedMonth] || [];
    const headers = [
      isRtl ? 'رقم' : 'No.',
      isRtl ? 'الكود' : 'Code',
      isRtl ? 'المنتج' : 'Product',
      isRtl ? 'وحدة المنتج' : 'Product Unit',
      ...daysInMonth.flatMap(day => [
        isRtl ? `${day} - طلبات` : `${day} - Orders`,
        isRtl ? `${day} - مرتجعات` : `${day} - Returns`,
        isRtl ? `${day} - نسبة %` : `${day} - Ratio %`,
      ]),
      isRtl ? 'إجمالي الطلبات' : 'Total Orders',
      isRtl ? 'إجمالي المرتجعات' : 'Total Returns',
      isRtl ? 'نسبة إجمالية %' : 'Total Ratio %',
    ];
    const wsData = [
      headers,
      ...data.map((row, index) => [
        formatNumber(index + 1, isRtl),
        row.code,
        row.product,
        row.unit,
        ...daysInMonth.flatMap((_, i) => [
          formatNumber(row.dailyOrders[i], isRtl),
          formatNumber(row.dailyReturns[i], isRtl),
          row.dailyOrders[i] > 0 ? `${formatNumber((row.dailyReturns[i] / row.dailyOrders[i] * 100).toFixed(2), isRtl)}%` : '0.00%',
        ]),
        formatNumber(row.totalOrders, isRtl),
        formatNumber(row.totalReturns, isRtl),
        `${formatNumber(row.totalRatio.toFixed(2), isRtl)}%`,
      ]),
      [
        isRtl ? 'الإجمالي' : 'Total', '', '', '',
        ...daysInMonth.flatMap((_, i) => [
          formatNumber(data.reduce((sum, row) => sum + row.dailyOrders[i], 0), isRtl),
          formatNumber(data.reduce((sum, row) => sum + row.dailyReturns[i], 0), isRtl),
          (() => {
            const dailyOrdersTotal = data.reduce((sum, row) => sum + row.dailyOrders[i], 0);
            const dailyReturnsTotal = data.reduce((sum, row) => sum + row.dailyReturns[i], 0);
            return dailyOrdersTotal > 0 ? `${formatNumber((dailyReturnsTotal / dailyOrdersTotal * 100).toFixed(2), isRtl)}%` : '0.00%';
          })(),
        ]),
        formatNumber(data.reduce((sum, row) => sum + row.totalOrders, 0), isRtl),
        formatNumber(data.reduce((sum, row) => sum + row.totalReturns, 0), isRtl),
        (() => {
          const totalOrders = data.reduce((sum, row) => sum + row.totalOrders, 0);
          const totalReturns = data.reduce((sum, row) => sum + row.totalReturns, 0);
          return totalOrders > 0 ? `${formatNumber((totalReturns / totalOrders * 100).toFixed(2), isRtl)}%` : '0.00%';
        })(),
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders vs Returns');
    XLSX.writeFile(wb, `${isRtl ? 'حركة_الطلبات_والمرتجعات' : 'Orders_vs_Returns'}_${months[selectedMonth].label}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(isRtl ? 'تم تصدير ملف Excel بنجاح' : 'Excel exported successfully', {
      position: isRtl ? 'top-left' : 'top-right',
      autoClose: 3000,
    });
  };

  const handleExportPDF = async () => {
    const data = ordersVsReturnsData[selectedMonth] || [];
    const headers = [
      isRtl ? 'رقم' : 'No.',
      isRtl ? 'الكود' : 'Code',
      isRtl ? 'المنتج' : 'Product',
      isRtl ? 'وحدة المنتج' : 'Product Unit',
      ...daysInMonth.flatMap(day => [
        isRtl ? `${day} - طلبات` : `${day} - Orders`,
        isRtl ? `${day} - مرتجعات` : `${day} - Returns`,
        isRtl ? `${day} - نسبة %` : `${day} - Ratio %`,
      ]),
      isRtl ? 'إجمالي الطلبات' : 'Total Orders',
      isRtl ? 'إجمالي المرتجعات' : 'Total Returns',
      isRtl ? 'نسبة إجمالية %' : 'Total Ratio %',
    ];
    const pdfData = data.map((row, index) => [
      formatNumber(index + 1, isRtl),
      row.code,
      row.product,
      row.unit,
      ...daysInMonth.flatMap((_, i) => [
        formatNumber(row.dailyOrders[i], isRtl),
        formatNumber(row.dailyReturns[i], isRtl),
        row.dailyOrders[i] > 0 ? `${formatNumber((row.dailyReturns[i] / row.dailyOrders[i] * 100).toFixed(2), isRtl)}%` : '0.00%',
      ]),
      formatNumber(row.totalOrders, isRtl),
      formatNumber(row.totalReturns, isRtl),
      `${formatNumber(row.totalRatio.toFixed(2), isRtl)}%`,
    ]);
    const totalItems = data.length;
    const totalOrders = data.reduce((sum, row) => sum + row.totalOrders, 0);
    const totalReturns = data.reduce((sum, row) => sum + row.totalReturns, 0);
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const fontName = 'Amiri';
      const fontLoaded = await loadFont(doc);
      doc.setFont(fontLoaded ? fontName : 'helvetica', 'normal');
      doc.setFontSize(18);
      doc.setTextColor(33, 33, 33);
      const pageWidth = doc.internal.pageSize.width;
      doc.text(isRtl ? title : title, isRtl ? pageWidth - 20 : 20, 12, { align: isRtl ? 'right' : 'left' });
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      const stats = isRtl
        ? `إجمالي المنتجات: ${toArabicNumerals(totalItems)} | إجمالي الطلبات: ${toArabicNumerals(totalOrders)} | إجمالي المرتجعات: ${toArabicNumerals(totalReturns)}`
        : `Total Products: ${totalItems} | Total Orders: ${totalOrders} | Total Returns: ${totalReturns}`;
      doc.text(stats, isRtl ? pageWidth - 20 : 20, 20, { align: isRtl ? 'right' : 'left' });
      doc.setLineWidth(0.5);
      doc.setDrawColor(255, 193, 7);
      doc.line(20, 25, pageWidth - 20, 25);
      const tableColumnWidths = headers.map((_, index) => {
        if (index === 0) return 15; // No.
        if (index === 1) return 25; // Code
        if (index === 2) return 45; // Product
        if (index === 3) return 25; // Unit
        if (index >= 4 && index < headers.length - 3) return 20; // Daily columns
        return 30; // Total columns
      });
      autoTable(doc, {
        head: [isRtl ? headers.slice().reverse() : headers],
        body: isRtl ? pdfData.map(row => row.slice().reverse()) : pdfData,
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
          if (data.section === 'body' && data.column.index >= (isRtl ? 0 : headers.length - 3)) {
            data.cell.styles.fontStyle = 'bold';
          }
          if (isRtl) {
            data.cell.text = data.cell.text.map(text => String(text).replace(/[0-9]/g, d => toArabicNumerals(d)));
          }
        },
        didDrawPage: (data) => {
          doc.setFont(fontLoaded ? fontName : 'helvetica', 'normal');
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
            const footerText = isRtl
              ? `تم إنشاؤه بواسطة نظام إدارة الجودياء - ${toArabicNumerals(currentDate)}`
              : `Generated by elgoodia Management System - ${currentDate}`;
            doc.text(footerText, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
          }
        },
      });
      const fileName = generateFileName(isRtl ? 'حركة_الطلبات_والمرتجعات' : 'Orders_vs_Returns', months[selectedMonth].label, isRtl);
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

  return (
    <div className={`min-h-screen px-6 py-8 ${isRtl ? 'rtl font-amiri' : 'ltr font-inter'} bg-gray-100`}>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        {isRtl ? 'تقرير حركة الطلبات والمرتجعات' : 'Orders vs Returns Report'}
      </h1>
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
        <DailyOrdersVsReturnsComponent
          data={ordersVsReturnsData[selectedMonth] || []}
          title={isRtl ? 'تقرير حركة الطلبات بالنسبة للمرتجعات' : 'Orders vs Returns Report'}
          month={selectedMonth}
          isRtl={isRtl}
          loading={loading}
          months={months}
          daysInMonth={daysInMonth}
          onExportExcel={handleExportExcel}
          onExportPDF={handleExportPDF}
          allBranches={allBranches}
        />
      </AnimatePresence>
    </div>
  );
};

export default OrdersVsReturnsPage;