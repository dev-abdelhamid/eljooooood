import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';
import { Order } from '../../types/types';
import ArabicReshaper from 'arabic-reshaper'; // تأكد من تثبيت: npm i arabic-reshaper

// تحويل الأرقام إلى أرقام عربية
const toArabicNumerals = (number: string | number): string => {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(number).replace(/[0-9]/g, (digit) => arabicNumerals[parseInt(digit)]);
};

// تحويل الأرقام العربية إلى إنجليزية
const toEnglishNumerals = (numStr: string): string => {
  const arabicMap: Record<string, string> = {'٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'};
  return numStr.replace(/[٠-٩]/g, (d) => arabicMap[d] || d);
};

// إعادة تشكيل النص العربي و عكسه للـ RTL للخطوط المتعددة
const reshapeText = (text: string, isRtl: boolean): string => {
  if (!isRtl) return text;
  const reshaped = ArabicReshaper.convertArabic(text);
  return reshaped.split('\n').map(line => line.split('').reverse().join('')).join('\n');
};

// تنسيق السعر بشكل صحيح
const formatPrice = (amount: number, isRtl: boolean): string => {
  const formatted = amount.toFixed(2).replace('.', ',');
  const arabicNumber = toArabicNumerals(formatted);
  return isRtl ? `${arabicNumber} ر.س.` : `SAR ${formatted}`;
};

// تنسيق المنتجات - وضع جميع المنتجات داخل قوس واحد إذا كانت متعددة
const formatProducts = (items: Order['items'], isRtl: boolean, translateUnit: (unit: string, isRtl: boolean) => string): string => {
  if (items.length === 0) return '';
  const productStrings = items.map((item) => {
    const quantity = isRtl ? toArabicNumerals(item.quantity) : item.quantity;
    return `${item.productName} (${quantity} ${translateUnit(item.unit, isRtl)})`;
  });
  const joined = productStrings.join(' ');
  return isRtl ? `(${joined})` : `(${joined})`;
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

// تحميل خط الكسندرية من URL عام
const loadFont = async (doc: jsPDF, fontName: string, fontUrl: string): Promise<boolean> => {
  try {
    const fontBytes = await fetch(fontUrl).then((res) => {
      if (!res.ok) throw new Error('فشل تحميل الخط');
      return res.arrayBuffer();
    });
    doc.addFileToVFS(`${fontName}-Regular.ttf`, arrayBufferToBase64(fontBytes));
    doc.addFont(`${fontName}-Regular.ttf`, fontName, 'normal');
    doc.setFont(fontName);
    return true;
  } catch (fontError) {
    console.error('خطأ تحميل الخط:', fontError);
    toast.error('فشل تحميل خط الكسندرية - سيتم استخدام خط افتراضي', { position: 'top-right', autoClose: 3000 });
    doc.setFont('helvetica');
    return false;
  }
};

// إنشاء اسم ملف ديناميكي بناءً على التصفية
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

// إنشاء الهيدر مع معلومات التصفية
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
  doc.setFontSize(18);
  doc.setTextColor(33, 33, 33);
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  doc.text(reshapeText(title, isRtl), isRtl ? pageWidth - 20 : 20, 15, { align: isRtl ? 'right' : 'left' });

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
  doc.text(reshapeText(filterInfo, isRtl), isRtl ? pageWidth - 20 : 20, 25, { align: isRtl ? 'right' : 'left' });

  doc.setFontSize(9);
  const stats = isRtl
    ? `إجمالي الطلبات: ${toArabicNumerals(totalOrders)} | إجمالي الكمية: ${toArabicNumerals(totalQuantity)} وحدة | إجمالي المبلغ: ${formatPrice(totalAmount, isRtl)}`
    : `Total Orders: ${totalOrders} | Total Quantity: ${totalQuantity} units | Total Amount: ${formatPrice(totalAmount, isRtl)}`;
  doc.text(reshapeText(stats, isRtl), isRtl ? pageWidth - 20 : 20, 35, { align: isRtl ? 'right' : 'left' });

  doc.setLineWidth(0.5);
  doc.setDrawColor(200, 200, 200);
  doc.line(20, 40, pageWidth - 20, 40);

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      reshapeText(isRtl ? `صفحة ${toArabicNumerals(i)} من ${toArabicNumerals(pageCount)}` : `Page ${i} of ${pageCount}`, isRtl),
      isRtl ? pageWidth - 20 : 20,
      pageHeight - 10,
      { align: isRtl ? 'right' : 'left' }
    );
  }
};

// إنشاء الجدول مع تحسينات
const generatePDFTable = (
  doc: jsPDF,
  headers: string[],
  data: any[],
  isRtl: boolean,
  fontLoaded: boolean,
  fontName: string,
  calculateAdjustedTotal: (order: Order) => string,
  calculateTotalQuantity: (order: Order) => number,
  translateUnit: (unit: string, isRtl: boolean) => string
) => {
  const reshapedHeaders = isRtl ? headers.reverse().map(h => reshapeText(h, isRtl)) : headers;
  const reshapedData = (isRtl ? data.map(row => row.reverse()) : data).map(row => row.map(cell => reshapeText(cell, isRtl)));
  autoTable(doc, {
    head: [reshapedHeaders],
    body: reshapedData,
    theme: 'grid',
    startY: 45,
    margin: { left: 15, right: 15 },
    headStyles: {
      fillColor: [40, 74, 94],
      textColor: [255, 255, 255],
      fontSize: 10,
      halign: isRtl ? 'right' : 'left',
      font: fontLoaded ? fontName : 'helvetica',
      cellPadding: 5,
      textDirection: isRtl ? 'rtl' : 'ltr',
    },
    bodyStyles: {
      fontSize: 9,
      halign: isRtl ? 'right' : 'left',
      font: fontLoaded ? fontName : 'helvetica',
      cellPadding: 5,
      textColor: [33, 33, 33],
      lineColor: [200, 200, 200],
      textDirection: isRtl ? 'rtl' : 'ltr',
      fillColor: [245, 245, 245],
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 25 },
      2: { cellWidth: 25 },
      3: { cellWidth: 100 },
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
        data.cell.styles.cellPadding = { top: 5, right: 5, bottom: 5, left: 5 };
      }
    },
  });
};

// دالة التصدير الرئيسية
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
    const fontName = 'Alexandria';
    const fontUrl = 'https://fonts.gstatic.com/s/alexandria/v8/UMBCrPdOoHOnxExyjdBeQev9Cdy9.ttf'; // URL لخط الكسندرية (متغير)
    const fontLoaded = await loadFont(doc, fontName, fontUrl);

    const totalOrders = orders.length;
    const totalQuantity = orders.reduce((sum, order) => sum + calculateTotalQuantity(order), 0);
    const totalAmount = orders.reduce((sum, order) => {
      let amountStr = calculateAdjustedTotal(order);
      amountStr = toEnglishNumerals(amountStr).replace(/[^0-9,]/g, '').replace(',', '.');
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
      const totalQuantityStr = isRtl ? toArabicNumerals(calculateTotalQuantity(order)) : calculateTotalQuantity(order).toString();
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

    generatePDFTable(doc, headers, data, isRtl, fontLoaded, fontName, calculateAdjustedTotal, calculateTotalQuantity, translateUnit);

    const fileName = generateFileName(filterStatus, filterBranch, isRtl);
    doc.save(fileName);
    toast.success(isRtl ? 'تم تصدير PDF بنجاح' : 'PDF export successful', {
      position: isRtl ? 'top-left' : 'top-right',
      autoClose: 3000,
    });
  } catch (err: any) {
    console.error('خطأ تصدير PDF:', err.message);
    toast.error(isRtl ? `خطأ في تصدير PDF: ${err.message}` : `PDF export error: ${err.message}`, {
      position: isRtl ? 'top-left' : 'top-right',
      autoClose: 3000,
    });
  }
};