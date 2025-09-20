import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';
import { Order } from '../../types/types';
import { formatDate } from '../../utils/formatDate';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';
import { Order } from '../../types/types';
import { formatDate } from '../../utils/formatDate';

// تحسين دالة arrayBufferToBase64 لدعم التشفير الصحيح للخطوط العربية
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  try {
    const bytes = new Uint8Array(buffer);
    // تحويل البايتات إلى سلسلة باستخدام TextDecoder لدعم UTF-8
    const decoder = new TextDecoder('utf-8');
    const binary = decoder.decode(bytes);
    return window.btoa(binary);
  } catch (error) {
    console.error('خطأ في تحويل ArrayBuffer إلى Base64:', error);
    return '';
  }
};

// تحميل الخط مع ضمان دعم اللغة العربية
const loadFont = async (doc: jsPDF, fontName: string, fontUrl: string): Promise<boolean> => {
  try {
    const fontBytes = await fetch(fontUrl).then(res => {
      if (!res.ok) throw new Error('فشل في تحميل الخط');
      return res.arrayBuffer();
    });
    const fontBase64 = arrayBufferToBase64(fontBytes);
    if (!fontBase64) throw new Error('فشل في تحويل الخط إلى Base64');
    doc.addFileToVFS(`${fontName}-Regular.ttf`, fontBase64);
    doc.addFont(`${fontName}-Regular.ttf`, fontName, 'normal');
    doc.setFont(fontName, 'normal');
    return true;
  } catch (fontError) {
    console.error('خطأ تحميل الخط:', fontError);
    doc.setFont('Amiri', 'normal'); // استخدام خط Amiri كبديل موثوق للغة العربية
    return false;
  }
};

// إنشاء رأس الـ PDF
const generatePDFHeader = (doc: jsPDF, isRtl: boolean, title: string) => {
  doc.setFontSize(18);
  doc.setTextColor(33, 33, 33);
  doc.text(title, isRtl ? doc.internal.pageSize.width - 20 : 20, 15, { align: isRtl ? 'right' : 'left' });
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(isRtl ? 'تقرير طلبات الإنتاج' : 'Production Orders Report', isRtl ? doc.internal.pageSize.width - 20 : 20, 25, { align: isRtl ? 'right' : 'left' });
  doc.setLineWidth(0.5);
  doc.setDrawColor(200, 200, 200);
  doc.line(20, 30, doc.internal.pageSize.width - 20, 30);
};

// إنشاء جدول الـ PDF مع تحسين عرض الأرقام والنصوص العربية
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
  autoTable(doc, {
    head: [isRtl ? headers.reverse() : headers],
    body: data.map(row => isRtl ? row.reverse() : row),
    theme: 'grid',
    startY: 35,
    margin: { left: 20, right: 20 },
    headStyles: {
      fillColor: [34, 34, 34],
      textColor: [255, 255, 255],
      fontSize: 10,
      halign: isRtl ? 'right' : 'left',
      font: fontLoaded ? fontName : 'Amiri',
      fontStyle: 'normal',
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 9,
      halign: isRtl ? 'right' : 'left',
      font: fontLoaded ? fontName : 'Amiri',
      fontStyle: 'normal',
      cellPadding: 3,
      textColor: [33, 33, 33],
      lineColor: [200, 200, 200],
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 30 },
      2: { cellWidth: 25 },
      3: { cellWidth: 80 },
      4: { cellWidth: 30 },
      5: { cellWidth: 25 },
      6: { cellWidth: 30 },
    },
    didParseCell: (data) => {
      data.cell.styles.halign = isRtl ? 'right' : 'left';
      data.cell.styles.valign = 'middle';
      // تصحيح الأرقام المعكوسة في عمود إجمالي المبلغ
      if (data.column.index === 4 && typeof data.cell.text[0] === 'string') {
        let text = data.cell.text[0];
        if (text.trim() !== '') {
          // إزالة أي أحرف غير رقمية باستثناء النقطة
          text = text.replace(/[^\d.]/g, '');
          // إعادة ترتيب الأرقام إذا كانت معكوسة
          if (isRtl) {
            text = text.split('.').reverse().join('.');
          }
          // التأكد من التنسيق الصحيح (مثل 200.00)
          const number = parseFloat(text);
          data.cell.text[0] = number.toLocaleString('ar-SA', {
            style: 'currency',
            currency: 'SAR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        } else {
          data.cell.text[0] = '٠٫٠٠ ر.س';
        }
      }
    },
  });
};

// دالة تصدير الـ PDF
export const exportToPDF = async (
  orders: Order[],
  isRtl: boolean,
  calculateAdjustedTotal: (order: Order) => string,
  calculateTotalQuantity: (order: Order) => number,
  translateUnit: (unit: string, isRtl: boolean) => string
) => {
  try {
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
    doc.setLanguage(isRtl ? 'ar' : 'en');
    const fontName = 'Amiri'; // استخدام خط Amiri الذي يدعم اللغة العربية بشكل موثوق
    const fontLoaded = await loadFont(doc, fontName, '/fonts/Amiri-Regular.ttf');
    generatePDFHeader(doc, isRtl, isRtl ? 'تقرير الطلبات' : 'Orders Report');
    const headers = [
      isRtl ? 'رقم الطلب' : 'Order Number',
      isRtl ? 'الفرع' : 'Branch',
      isRtl ? 'الحالة' : 'Status',
      isRtl ? 'المنتجات' : 'Products',
      isRtl ? 'إجمالي المبلغ' : 'Total Amount',
      isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
      isRtl ? 'التاريخ' : 'Date',
    ];
    const data = orders.map(order => [
      order.orderNumber || (isRtl ? 'غير معروف' : 'Unknown'),
      order.branchName || (isRtl ? 'غير معروف' : 'Unknown'),
      isRtl ? {
        pending: 'قيد الانتظار',
        approved: 'تم الموافقة',
        in_production: 'في الإنتاج',
        completed: 'مكتمل',
        in_transit: 'في النقل',
        delivered: 'تم التسليم',
        cancelled: 'ملغى'
      }[order.status] || order.status : order.status,
      order.items.map(i => `${i.productName} (${i.quantity} ${translateUnit(i.unit, isRtl)})`).join(', ') || (isRtl ? 'لا توجد منتجات' : 'No products'),
      calculateAdjustedTotal(order) || '0.00',
      `${calculateTotalQuantity(order)} ${isRtl ? 'وحدة' : 'units'}`,
      order.date || formatDate(new Date(), isRtl ? 'ar' : 'en'),
    ]);
    generatePDFTable(doc, headers, data, isRtl, fontLoaded, fontName, calculateAdjustedTotal, calculateTotalQuantity, translateUnit);
    doc.save('Orders.pdf');
    toast.success(isRtl ? 'تم تصدير PDF بنجاح' : 'PDF export successful', {
      position: isRtl ? 'top-left' : 'top-right',
      autoClose: 3000,
    });
  } catch (err: any) {
    console.error('خطأ في تصدير PDF:', err.message);
    toast.error(isRtl ? `خطأ في تصدير PDF: ${err.message}` : `PDF export error: ${err.message}`, {
      position: isRtl ? 'top-left' : 'top-right',
      autoClose: 3000,
    });
  }
};

const loadFont = async (doc: jsPDF, fontName: string, fontUrl: string): Promise<boolean> => {
  try {
    const fontBytes = await fetch(fontUrl).then(res => {
      if (!res.ok) throw new Error('فشل في تحميل الخط');
      return res.arrayBuffer();
    });
    const fontBase64 = arrayBufferToBase64(fontBytes);
    doc.addFileToVFS(`${fontName}-Regular.ttf`, fontBase64);
    doc.addFont(`${fontName}-Regular.ttf`, fontName, 'normal');
    doc.setFont(fontName, 'normal');
    return true;
  } catch (fontError) {
    console.error('خطأ تحميل الخط:', fontError);
    doc.setFont('helvetica', 'normal');
    return false;
  }
};

const generatePDFHeader = (doc: jsPDF, isRtl: boolean, title: string) => {
  doc.setFontSize(18);
  doc.setTextColor(33, 33, 33);
  doc.text(title, isRtl ? doc.internal.pageSize.width - 20 : 20, 15, { align: isRtl ? 'right' : 'left' });
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(isRtl ? 'تقرير طلبات الإنتاج' : 'Production Orders Report', isRtl ? doc.internal.pageSize.width - 20 : 20, 25, { align: isRtl ? 'right' : 'left' });
  doc.setLineWidth(0.5);
  doc.setDrawColor(200, 200, 200);
  doc.line(20, 30, doc.internal.pageSize.width - 20, 30);
};

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
  autoTable(doc, {
    head: [isRtl ? headers.reverse() : headers],
    body: data.map(row => isRtl ? row.reverse() : row),
    theme: 'grid',
    startY: 35,
    margin: { left: 20, right: 20 },
    headStyles: {
      fillColor: [34, 34, 34],
      textColor: [255, 255, 255],
      fontSize: 10,
      halign: isRtl ? 'right' : 'left',
      font: fontLoaded ? fontName : 'helvetica',
      fontStyle: 'normal',
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 9,
      halign: isRtl ? 'right' : 'left',
      font: fontLoaded ? fontName : 'helvetica',
      fontStyle: 'normal',
      cellPadding: 3,
      textColor: [33, 33, 33],
      lineColor: [200, 200, 200],
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 30 },
      2: { cellWidth: 25 },
      3: { cellWidth: 80 },
      4: { cellWidth: 30 },
      5: { cellWidth: 25 },
      6: { cellWidth: 30 },
    },
    didParseCell: (data) => {
      data.cell.styles.halign = isRtl ? 'right' : 'left';
      data.cell.styles.valign = 'middle';
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const text = data.cell.text[0];
        if (typeof text === 'string' && text.trim() !== '') {
          data.cell.text[0] = text.replace(/٫/g, '.').replace(/[^\d.]/g, '');
        } else {
          data.cell.text[0] = '0.00'; // قيمة افتراضية في حال كانت القيمة غير موجودة
        }
      }
    },
  });
};

export const exportToPDF = async (
  orders: Order[],
  isRtl: boolean,
  calculateAdjustedTotal: (order: Order) => string,
  calculateTotalQuantity: (order: Order) => number,
  translateUnit: (unit: string, isRtl: boolean) => string
) => {
  try {
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
    doc.setLanguage(isRtl ? 'ar' : 'en');
    const fontName = 'Alexandria';
    const fontLoaded = await loadFont(doc, fontName, '/fonts/Alexandria-Regular.ttf');
    generatePDFHeader(doc, isRtl, isRtl ? 'تقرير الطلبات' : 'Orders Report');
    const headers = [
      isRtl ? 'رقم الطلب' : 'Order Number',
      isRtl ? 'الفرع' : 'Branch',
      isRtl ? 'الحالة' : 'Status',
      isRtl ? 'المنتجات' : 'Products',
      isRtl ? 'إجمالي المبلغ' : 'Total Amount',
      isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
      isRtl ? 'التاريخ' : 'Date',
    ];
    const data = orders.map(order => [
      order.orderNumber || (isRtl ? 'غير معروف' : 'Unknown'),
      order.branchName || (isRtl ? 'غير معروف' : 'Unknown'),
      isRtl ? {
        pending: 'قيد الانتظار',
        approved: 'تم الموافقة',
        in_production: 'في الإنتاج',
        completed: 'مكتمل',
        in_transit: 'في النقل',
        delivered: 'تم التسليم',
        cancelled: 'ملغى'
      }[order.status] || order.status : order.status,
      order.items.map(i => `${i.productName} (${i.quantity} ${translateUnit(i.unit, isRtl)})`).join(', ') || (isRtl ? 'لا توجد منتجات' : 'No products'),
      calculateAdjustedTotal(order) || '0.00',
      `${calculateTotalQuantity(order)} ${isRtl ? 'وحدة' : 'units'}`,
      order.date || formatDate(new Date(), isRtl ? 'ar' : 'en'),
    ]);
    generatePDFTable(doc, headers, data, isRtl, fontLoaded, fontName, calculateAdjustedTotal, calculateTotalQuantity, translateUnit);
    doc.save('Orders.pdf');
    toast.success(isRtl ? 'تم تصدير PDF بنجاح' : 'PDF export successful', {
      position: isRtl ? 'top-left' : 'top-right',
      autoClose: 3000,
    });
  } catch (err: any) {
    console.error('خطأ في تصدير PDF:', err.message);
    toast.error(isRtl ? `خطأ في تصدير PDF: ${err.message}` : `PDF export error: ${err.message}`, {
      position: isRtl ? 'top-left' : 'top-right',
      autoClose: 3000,
    });
  }
};