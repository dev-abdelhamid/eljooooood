import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';
import { Order } from '../../types/types';

// تحويل الأرقام إلى أرقام عربية
const toArabicNumerals = (number: string | number): string => {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(number).replace(/[0-9]/g, (digit) => arabicNumerals[parseInt(digit)]);
};

// تنسيق السعر بشكل صحيح
const formatPrice = (amount: number, isRtl: boolean): string => {
  const formatted = amount.toFixed(2).replace('.', ',');
  const arabicNumber = toArabicNumerals(formatted);
  return isRtl ? `${arabicNumber} ر.س.` : `SAR ${formatted}`;
};

// تنسيق المنتجات داخل أقواس مع " + " للفصل، ترتيب صحيح للعربية بدون معكوس
const formatProducts = (items: Order['items'], isRtl: boolean, translateUnit: (unit: string, isRtl: boolean) => string): string => {
  return items
    .map((item) => {
      const quantity = isRtl ? toArabicNumerals(item.quantity) : item.quantity;
      return isRtl
        ? `(${quantity} ${translateUnit(item.unit, isRtl)} ${item.productName})`  // (كمية وحدة اسم) بدون معكوس
        : `(${item.productName} ${quantity} ${translateUnit(item.unit, isRtl)})`;
    })
    .join(' + ');  // + للمنتجات المتعددة
};

// تحويل array buffer إلى base64
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

// تحميل خط Cairo (regular وبولد)
const loadFont = async (doc: jsPDF): Promise<boolean> => {
  try {
    // Regular
    const regularUrl = '/fonts/Cairo-Regular.ttf';
    const regularBytes = await fetch(regularUrl).then((res) => {
      if (!res.ok) throw new Error('فشل تحميل Cairo Regular');
      return res.arrayBuffer();
    });
    doc.addFileToVFS('Cairo-Regular.ttf', arrayBufferToBase64(regularBytes));
    doc.addFont('Cairo-Regular.ttf', 'Cairo', 'normal');

    // Bold
    const boldUrl = '/fonts/Cairo-Bold.ttf';
    const boldBytes = await fetch(boldUrl).then((res) => {
      if (!res.ok) throw new Error('فشل تحميل Cairo Bold');
      return res.arrayBuffer();
    });
    doc.addFileToVFS('Cairo-Bold.ttf', arrayBufferToBase64(boldBytes));
    doc.addFont('Cairo-Bold.ttf', 'Cairo', 'bold');

    doc.setFont('Cairo', 'normal');
    return true;
  } catch (error) {
    console.error('خطأ تحميل خط Cairo:', error);
    doc.setFont('helvetica');
    return false;
  }
};

// إنشاء اسم ملف ديناميكي
const generateFileName = (filterStatus: string, filterBranch: string, isRtl: boolean): string => {
  const date = new Date().toISOString().split('T')[0];
  const status = isRtl
    ? filterStatus
      ? { pending: 'قيد_الانتظار', approved: 'تم_الموافقة', in_production: 'في_الإنتاج', completed: 'مكتمل', in_transit: 'في_النقل', delivered: 'تم_التسليم', cancelled: 'ملغى' }[filterStatus] || 'الكل'
      : 'الكل'
    : filterStatus || 'all';
  const branch = filterBranch ? filterBranch.replace(/\s+/g, '_') : (isRtl ? 'جميع_الفروع' : 'all_branches');
  return `Orders_${status}_${branch}_${date}.pdf`;
};

// إنشاء الهيدر
const generatePDFHeader = (
  doc: jsPDF,
  isRtl: boolean,
  title: string,
  filterStatus: string,
  filterBranch: string,
  totalOrders: number,
  totalQuantity: number,
  totalAmount: number
) => {
  doc.setFont('Cairo', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(33, 33, 33);
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  doc.text(title, isRtl ? pageWidth - 20 : 20, 15, { align: isRtl ? 'right' : 'left' });

  doc.setFont('Cairo', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  const statusTranslations = {
    pending: 'قيد الانتظار',
    approved: 'تم الموافقة',
    in_production: 'في الإنتاج',
    completed: 'مكتمل',
    in_transit: 'في النقل',
    delivered: 'تم التسليم',
    cancelled: 'ملغى',
  };
  const filterInfo = isRtl
    ? `الحالة: ${filterStatus ? statusTranslations[filterStatus] || 'الكل' : 'الكل'} | الفرع: ${filterBranch || 'جميع الفروع'}`
    : `Status: ${filterStatus || 'All'} | Branch: ${filterBranch || 'All Branches'}`;
  doc.text(filterInfo, isRtl ? pageWidth - 20 : 20, 25, { align: isRtl ? 'right' : 'left' });

  doc.setFontSize(9);
  const stats = isRtl
    ? `إجمالي الطلبات: ${toArabicNumerals(totalOrders)} | إجمالي الكمية: ${toArabicNumerals(totalQuantity)} وحدة | إجمالي المبلغ: ${formatPrice(totalAmount, isRtl)}`
    : `Total Orders: ${totalOrders} | Total Quantity: ${totalQuantity} units | Total Amount: ${formatPrice(totalAmount, isRtl)}`;
  doc.text(stats, isRtl ? pageWidth - 20 : 20, 35, { align: isRtl ? 'right' : 'left' });

  doc.setLineWidth(0.5);
  doc.setDrawColor(200, 200, 200);
  doc.line(20, 40, pageWidth - 20, 40);

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      isRtl ? `صفحة ${toArabicNumerals(i)} من ${toArabicNumerals(pageCount)}` : `Page ${i} of ${pageCount}`,
      isRtl ? pageWidth - 20 : 20,
      pageHeight - 10,
      { align: isRtl ? 'right' : 'left' }
    );
  }
};

// إنشاء الجدول (بيج colors، تنسيق أفضل)
const generatePDFTable = (
  doc: jsPDF,
  headers: string[],
  data: any[],
  isRtl: boolean,
  fontLoaded: boolean,
  calculateAdjustedTotal: (order: Order) => string,
  calculateTotalQuantity: (order: Order) => number,
  translateUnit: (unit: string, isRtl: boolean) => string
) => {
  autoTable(doc, {
    head: [isRtl ? headers.reverse() : headers],
    body: isRtl ? data.map((row) => row.reverse()) : data,
    theme: 'grid',
    startY: 45,
    margin: { left: 15, right: 15 },
    headStyles: {
      fillColor: [245, 245, 220],  // بيج
      textColor: [33, 33, 33],
      fontSize: 11,  // أكبر للوضوح
      halign: isRtl ? 'right' : 'left',
      font: 'Cairo',
      fontStyle: 'bold',
      cellPadding: 6,  // padding أكبر للتنسيق
      textDirection: isRtl ? 'rtl' : 'ltr',
    },
    bodyStyles: {
      fontSize: 9,
      halign: isRtl ? 'right' : 'left',
      font: 'Cairo',
      cellPadding: 6,
      textColor: [33, 33, 33],
      lineColor: [200, 200, 200],
      textDirection: isRtl ? 'rtl' : 'ltr',
      fillColor: [255, 255, 255],
    },
    alternateRowStyles: {
      fillColor: [250, 250, 240],  // light beige
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 25 },
      2: { cellWidth: 25 },
      3: { cellWidth: 120 },  // أكبر للمنتجات
      4: { cellWidth: 25 },
      5: { cellWidth: 20 },
      6: { cellWidth: 35 },
    },
    styles: {
      overflow: 'linebreak',
      cellWidth: 'wrap',
      minCellHeight: 15,
    },
    didParseCell: (data) => {
      data.cell.styles.halign = isRtl ? 'right' : 'left';
      data.cell.styles.textDirection = isRtl ? 'rtl' : 'ltr';
      if (data.column.index === 3) {
        data.cell.styles.cellPadding = { top: 6, right: 6, bottom: 6, left: 6 };
      }
    },
  });
};

// دالة التصدير
export const exportToPDF = async (
  orders: Order[],
  isRtl: boolean,
  calculateAdjustedTotal: (order: Order) => string,
  calculateTotalQuantity: (order: Order) => number,
  translateUnit: (unit: string, isRtl: boolean) => string,
  filterStatus: string = '',
  filterBranch: string = ''
) => {
  try {
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
    doc.setLanguage('ar');

    await loadFont(doc);

    const totalOrders = orders.length;
    const totalQuantity = orders.reduce((sum, order) => sum + calculateTotalQuantity(order), 0);
    const totalAmount = orders.reduce((sum, order) => {
      const amountStr = calculateAdjustedTotal(order).replace(/[^0-9.]/g, '');
      return sum + (parseFloat(amountStr) || 0);
    }, 0);

    generatePDFHeader(
      doc,
      isRtl,
      isRtl ? 'تقرير الطلبات' : 'Orders Report',
      filterStatus,
      filterBranch,
      totalOrders,
      totalQuantity,
      totalAmount
    );

    const headers = [
      isRtl ? 'رقم الطلب' : 'Order Number',
      isRtl ? 'الفرع' : 'Branch',
      isRtl ? 'الحالة' : 'Status',
      isRtl ? 'المنتجات' : 'Products',
      isRtl ? 'إجمالي المبلغ' : 'Total Amount',
      isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
      isRtl ? 'التاريخ' : 'Date',
    ];

    const statusTranslations: Record<string, string> = {
      pending: 'قيد الانتظار',
      approved: 'تم الموافقة',
      in_production: 'في الإنتاج',
      completed: 'مكتمل',
      in_transit: 'في النقل',
      delivered: 'تم التسليم',
      cancelled: 'ملغى',
    };

    const data = orders.map((order) => {
      const productsStr = formatProducts(order.items, isRtl, translateUnit);
      const totalQuantityStr = isRtl ? toArabicNumerals(calculateTotalQuantity(order)) : calculateTotalQuantity(order);
      return [
        order.orderNumber,
        order.branchName,
        isRtl ? statusTranslations[order.status] || order.status : order.status,
        productsStr,
        calculateAdjustedTotal(order),
        `${totalQuantityStr} ${isRtl ? 'وحدة' : 'units'}`,
        order.date,
      ];
    });

    generatePDFTable(doc, headers, data, isRtl, true, calculateAdjustedTotal, calculateTotalQuantity, translateUnit);

    const fileName = generateFileName(filterStatus, filterBranch, isRtl);
    doc.save(fileName);
    toast.success(isRtl ? 'تم تصدير PDF بنجاح' : 'PDF export successful', { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
  } catch (err: any) {
    console.error('خطأ تصدير PDF:', err.message);
    toast.error(isRtl ? `خطأ في تصدير PDF: ${err.message}` : `PDF export error: ${err.message}`, { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
  }
};