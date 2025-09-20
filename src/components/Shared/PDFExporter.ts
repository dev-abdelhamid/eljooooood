import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';
import { Order } from '../../types/types';

// تحويل الأرقام إلى أرقام عربية
const toArabicNumerals = (number: string | number): string => {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(number).replace(/[0-9]/g, (digit) => arabicNumerals[parseInt(digit)]);
};

// تنسيق السعر بشكل صحيح للعربية
const formatPrice = (amount: number, isRtl: boolean): string => {
  const formatted = amount.toFixed(2).replace('.', ',');
  const arabicNumber = toArabicNumerals(formatted);
  return isRtl ? `${arabicNumber} ر.س.` : `SAR ${formatted}`;
};

// تنسيق المنتجات بشكل صحيح
const formatProducts = (items: Order['items'], isRtl: boolean, translateUnit: (unit: string, isRtl: boolean) => string): string => {
  return items
    .map((item) => {
      const quantity = isRtl ? toArabicNumerals(item.quantity) : item.quantity;
      return isRtl
        ? `(${item.productName}، ${quantity} ${translateUnit(item.unit, isRtl)})`
        : `(${item.productName}, ${quantity} ${translateUnit(item.unit, isRtl)})`;
    })
    .join('، ');
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

// تحميل الخط العربي (Amiri)
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
    doc.setFont('helvetica');
    return false;
  }
};

// إنشاء الهيدر
const generatePDFHeader = (doc: jsPDF, isRtl: boolean, title: string) => {
  doc.setFontSize(18);
  doc.setTextColor(33, 33, 33);
  const pageWidth = doc.internal.pageSize.width;
  doc.text(title, isRtl ? pageWidth - 20 : 20, 15, {
    align: isRtl ? 'right' : 'left',
  });
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(
    isRtl ? 'تقرير طلبات الإنتاج' : 'Production Orders Report',
    isRtl ? pageWidth - 20 : 20,
    25,
    {
      align: isRtl ? 'right' : 'left',
    }
  );
  doc.setLineWidth(0.5);
  doc.setDrawColor(200, 200, 200);
  doc.line(20, 30, pageWidth - 20, 30);
};

// إنشاء الجدول
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
    body: isRtl ? data.map((row) => row.reverse()) : data,
    theme: 'grid',
    startY: 35,
    margin: { left: 20, right: 20 },
    headStyles: {
      fillColor: [34, 34, 34],
      textColor: [255, 255, 255],
      fontSize: 10,
      halign: isRtl ? 'right' : 'left',
      font: fontLoaded ? fontName : 'helvetica',
      cellPadding: 4,
      textDirection: isRtl ? 'rtl' : 'ltr',
    },
    bodyStyles: {
      fontSize: 9,
      halign: isRtl ? 'right' : 'left',
      font: fontLoaded ? fontName : 'helvetica',
      cellPadding: 4,
      textColor: [33, 33, 33],
      lineColor: [200, 200, 200],
      textDirection: isRtl ? 'rtl' : 'ltr',
    },
    columnStyles: {
      0: { cellWidth: 30 }, // رقم الطلب
      1: { cellWidth: 30 }, // الفرع
      2: { cellWidth: 25 }, // الحالة
      3: { cellWidth: 80 }, // المنتجات
      4: { cellWidth: 30 }, // إجمالي المبلغ
      5: { cellWidth: 25 }, // الكمية الإجمالية
      6: { cellWidth: 30 }, // التاريخ
    },
    styles: {
      overflow: 'linebreak',
      cellWidth: 'wrap',
    },
    didParseCell: (data) => {
      data.cell.styles.halign = isRtl ? 'right' : 'left';
      data.cell.styles.textDirection = isRtl ? 'rtl' : 'ltr';
    },
  });
};

// دالة التصدير الرئيسية
export const exportToPDF = async (
  orders: Order[],
  isRtl: boolean,
  calculateAdjustedTotal: (order: Order) => string,
  calculateTotalQuantity: (order: Order) => number,
  translateUnit: (unit: string, isRtl: boolean) => string
) => {
  try {
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
    doc.setLanguage('ar'); // دعم اللغة العربية
    const fontName = 'Amiri';
    const fontUrl = '/fonts/Amiri-Regular.ttf'; // تأكد من وجود الملف
    const fontLoaded = await loadFont(doc, fontName, fontUrl);
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
      const totalQuantity = isRtl ? toArabicNumerals(calculateTotalQuantity(order)) : calculateTotalQuantity(order);
      return [
        order.orderNumber,
        order.branchName,
        isRtl ? statusTranslations[order.status] || order.status : order.status,
        productsStr,
        formatPrice(order.adjustedTotal, isRtl),
        `${totalQuantity} ${isRtl ? 'وحدة' : 'units'}`,
        order.date,
      ];
    });

    generatePDFTable(doc, headers, data, isRtl, fontLoaded, fontName, calculateAdjustedTotal, calculateTotalQuantity, translateUnit);
    doc.save('Orders.pdf');
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