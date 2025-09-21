import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';
import { Order } from '../../types/types';

// Converting array buffer to base64 for font embedding
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

// Convert Arabic numerals to Latin for parsing
const fromArabicNumerals = (str: string): string => {
  const arabicMap: { [key: string]: string } = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
  };
  return str.replace(/[٠-٩]/g, (digit) => arabicMap[digit] || digit);
};

// Convert Latin numerals to Arabic for display (except orderNumber)
const toArabicNumerals = (number: string | number): string => {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(number).replace(/[0-9]/g, (digit) => arabicNumerals[parseInt(digit)]);
};

// Format price with proper currency and Arabic numerals
const formatPrice = (amount: number | undefined, isRtl: boolean): string => {
  const validAmount = (typeof amount === 'number' && !isNaN(amount)) ? amount : 0;
  const formatted = validAmount.toFixed(2).replace('.', ',');
  const arabicNumber = isRtl ? toArabicNumerals(formatted) : formatted;
  return isRtl ? `${arabicNumber} ر.س` : `${formatted} SAR`;
};

// Loading custom font (Alexandria)
const loadFont = async (doc: jsPDF, fontName: string, fontUrl: string): Promise<boolean> => {
  try {
    const fontBytes = await fetch(fontUrl).then(res => {
      if (!res.ok) throw new Error('Failed to fetch font');
      return res.arrayBuffer();
    });
    doc.addFileToVFS(`${fontName}-Regular.ttf`, arrayBufferToBase64(fontBytes));
    doc.addFont(`${fontName}-Regular.ttf`, fontName, 'normal');
    doc.setFont(fontName);
    return true;
  } catch (fontError) {
    console.error('Font loading error:', fontError);
    doc.setFont('helvetica');
    return false;
  }
};

// Generating PDF header
const generatePDFHeader = (doc: jsPDF, isRtl: boolean, title: string) => {
  doc.setFontSize(18);
  doc.setTextColor(33, 33, 33);
  doc.text(title, isRtl ? doc.internal.pageSize.width - 20 : 20, 15, {
    align: isRtl ? 'right' : 'left',
  });
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(isRtl ? 'تقرير طلبات الإنتاج' : 'Production Orders Report', isRtl ? doc.internal.pageSize.width - 20 : 20, 25, {
    align: isRtl ? 'right' : 'left',
  });
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
    head: [isRtl ? headers.slice().reverse() : headers],
    body: isRtl ? data.map(row => row.slice().reverse()) : data,
    theme: 'grid',
    startY: 35,
    margin: { left: 20, right: 20 },
    headStyles: {
      fillColor: [34, 34, 34],
      textColor: [255, 255, 255],
      fontSize: 10,
      halign: isRtl ? 'right' : 'left',
      font: fontLoaded ? fontName : 'helvetica',
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 9,
      halign: isRtl ? 'right' : 'left',
      font: fontLoaded ? fontName : 'helvetica',
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
        if (!data.cell.text[0] || data.cell.text[0].includes('NaN')) {
          data.cell.text[0] = formatPrice(0, isRtl);
        }
        data.cell.styles.fontStyle = 'bold'; // Ensure bold for price
      }
      if (isRtl) {
        data.cell.text = data.cell.text.map(text => doc.processArabic(text));
      }
    },
    didDrawPage: () => {
      doc.setFont(fontLoaded ? fontName : 'helvetica', 'normal');
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
      // Use productNameEn if available and isRtl
      const productsStr = order.items.map(i => {
        const name = isRtl && i.productNameEn ? i.productNameEn : i.productName;
        const quantity = isRtl ? toArabicNumerals(i.quantity) : i.quantity;
        return `${name} (${quantity} ${translateUnit(i.unit, isRtl)})`;
      }).join(', ');
      // Parse calculateAdjustedTotal correctly
      const totalAmountStr = calculateAdjustedTotal(order);
      let formattedTotalAmount: string;
      if (totalAmountStr.includes('NaN')) {
        formattedTotalAmount = formatPrice(0, isRtl);
      } else {
        const numericStr = fromArabicNumerals(totalAmountStr);
        const cleaned = numericStr.replace(/[^0-9.,]/g, '').replace(',', '.');
        const parsedAmount = parseFloat(cleaned);
        formattedTotalAmount = isNaN(parsedAmount) ? formatPrice(0, isRtl) : formatPrice(parsedAmount, isRtl);
      }
      return [
        order.orderNumber, // Always use Latin numerals for orderNumber
        order.branchName,
        isRtl ? {pending: 'قيد الانتظار', approved: 'تم الموافقة', in_production: 'في الإنتاج', completed: 'مكتمل', in_transit: 'في النقل', delivered: 'تم التسليم', cancelled: 'ملغى'}[order.status] : order.status,
        productsStr,
        formattedTotalAmount,
        isRtl ? `${toArabicNumerals(calculateTotalQuantity(order))} ${translateUnit('unit', isRtl)}` : `${calculateTotalQuantity(order)} ${translateUnit('unit', isRtl)}`,
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