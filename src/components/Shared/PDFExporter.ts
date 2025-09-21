import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';
import { Order } from '../../types/types';

// Convert numbers to Arabic numerals
const toArabicNumerals = (number: string | number): string => {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(number).replace(/[0-9]/g, (digit) => arabicNumerals[parseInt(digit)]);
};

// Format price with proper currency and Arabic numerals
const formatPrice = (amount: number | undefined | null, isRtl: boolean): string => {
  const validAmount = (typeof amount === 'number' && !isNaN(amount) && amount >= 0) ? amount : 0;
  const formatted = validAmount.toFixed(2).replace('.', ',');
  const arabicNumber = isRtl ? toArabicNumerals(formatted) : formatted;
  return isRtl ? `${arabicNumber} ر.س` : `${formatted} SAR`;
};

// Converting array buffer to base64 for font embedding
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

// Loading custom font (Alexandria)
const loadFont = async (doc: jsPDF, fontName: string, fontUrl: string): Promise<boolean> => {
  try {
    const fontBytes = await fetch(fontUrl).then(res => {
      if (!res.ok) throw new Error(isRtl ? 'فشل في تحميل الخط' : 'Failed to fetch font');
      return res.arrayBuffer();
    });
    doc.addFileToVFS(`${fontName}-Regular.ttf`, arrayBufferToBase64(fontBytes));
    doc.addFont(`${fontName}-Regular.ttf`, fontName, 'normal');
    doc.setFont(fontName, 'normal');
    return true;
  } catch (fontError) {
    console.error('Font loading error:', fontError);
    doc.setFont('helvetica', 'normal');
    toast.error(isRtl ? 'فشل في تحميل خط Alexandria، يتم استخدام Helvetica' : 'Failed to load Alexandria font, using Helvetica', {
      position: isRtl ? 'top-left' : 'top-right',
      autoClose: 3000,
    });
    return false;
  }
};

// Generating PDF header
const generatePDFHeader = (doc: jsPDF, isRtl: boolean, title: string) => {
  doc.setFontSize(18);
  doc.setTextColor(33, 33, 33);
  doc.text(isRtl ? doc.processArabic(title) : title, isRtl ? doc.internal.pageSize.width - 20 : 20, 15, {
    align: isRtl ? 'right' : 'left',
  });
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(
    isRtl ? doc.processArabic('تقرير طلبات الإنتاج') : 'Production Orders Report',
    isRtl ? doc.internal.pageSize.width - 20 : 20,
    25,
    { align: isRtl ? 'right' : 'left' }
  );
  doc.setLineWidth(0.5);
  doc.setDrawColor(200, 200, 200);
  doc.line(20, 30, doc.internal.pageSize.width - 20, 30);
};

// Generating PDF table
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
    head: [isRtl ? headers.map(header => doc.processArabic(header)).reverse() : headers],
    body: isRtl ? data.map(row => row.map((cell: string) => doc.processArabic(cell)).reverse()) : data,
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
      0: { cellWidth: 30 }, // Order Number
      1: { cellWidth: 30 }, // Branch
      2: { cellWidth: 25 }, // Status
      3: { cellWidth: 80 }, // Products
      4: { cellWidth: 30, fontStyle: 'bold' }, // Total Amount (bold)
      5: { cellWidth: 25 }, // Total Quantity
      6: { cellWidth: 30 }, // Date
    },
    styles: {
      overflow: 'linebreak',
      cellWidth: 'wrap',
    },
    didParseCell: (data) => {
      data.cell.styles.halign = isRtl ? 'right' : 'left';
      if (data.column.index === (isRtl ? headers.length - 5 : 4)) { // Total Amount column
        const rawValue = data.cell.text[0];
        if (!rawValue || rawValue.includes('NaN') || parseFloat(rawValue.replace(/[^0-9.,]/g, '').replace(',', '.')) <= 0) {
          console.warn(`Invalid total amount for order: ${data.row.raw[0]}, rawValue: ${rawValue}`);
          data.cell.text[0] = formatPrice(0, isRtl);
        }
      }
    },
  });
};

// Main export function
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

    const data = orders.map(order => {
      const statusTranslations = {
        pending: isRtl ? 'قيد الانتظار' : 'Pending',
        approved: isRtl ? 'تم الموافقة' : 'Approved',
        in_production: isRtl ? 'في الإنتاج' : 'In Production',
        completed: isRtl ? 'مكتمل' : 'Completed',
        in_transit: isRtl ? 'في النقل' : 'In Transit',
        delivered: isRtl ? 'تم التسليم' : 'Delivered',
        cancelled: isRtl ? 'ملغى' : 'Cancelled',
      };
      const totalAmountStr = calculateAdjustedTotal(order);
      const cleanedAmount = totalAmountStr.replace(/[^0-9.,]/g, '').replace(',', '.');
      const parsedAmount = parseFloat(cleanedAmount);
      const formattedTotalAmount = (isNaN(parsedAmount) || parsedAmount <= 0)
        ? formatPrice(0, isRtl)
        : formatPrice(parsedAmount, isRtl);
      const productsStr = order.items
        .map(i => `${i.productName} (${isRtl ? toArabicNumerals(i.quantity) : i.quantity} ${translateUnit(i.unit, isRtl)})`)
        .join(', ');
      return [
        isRtl ? toArabicNumerals(order.orderNumber) : order.orderNumber,
        order.branchName,
        statusTranslations[order.status] || order.status,
        productsStr,
        formattedTotalAmount,
        `${isRtl ? toArabicNumerals(calculateTotalQuantity(order)) : calculateTotalQuantity(order)} ${translateUnit('unit', isRtl)}`,
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
    console.error('PDF export error:', err.message);
    toast.error(isRtl ? `خطأ في تصدير PDF: ${err.message}` : `PDF export error: ${err.message}`, {
      position: isRtl ? 'top-left' : 'top-right',
      autoClose: 3000,
    });
  }
};