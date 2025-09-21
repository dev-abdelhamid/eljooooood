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
const formatPrice = (amount: number | undefined, isRtl: boolean): string => {
  const validAmount = (typeof amount === 'number' && !isNaN(amount)) ? amount : 0;
  const formatted = validAmount.toFixed(2).replace('.', ',');
  const arabicNumber = isRtl ? (formatted) : formatted;
  return isRtl ? `${arabicNumber} ر.س  ` : ` ${formatted} SAR`;
};


// Format products for Arabic and English with correct separator
const formatProducts = (items: Order['items'], isRtl: boolean, translateUnit: (unit: string, isRtl: boolean) => string): string => {
  return items
    .map((item) => {
      const quantity = isRtl ? toArabicNumerals(item.quantity) : item.quantity;
      return isRtl
        ? `${quantity} ${translateUnit(item.unit, isRtl)} ${item.productName}`
        : `${quantity} ${translateUnit(item.unit, isRtl)} x ${item.productName}`;
    })
    .join('  +  ');
};
// Convert array buffer to base64 for font embedding
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

// Load Amiri font for reliable Arabic rendering
const loadFont = async (doc: jsPDF): Promise<boolean> => {
  const fontName = 'Amiri';
  const fontUrl = '/fonts/Amiri-Regular.ttf';
  try {
    const fontBytes = await fetch(fontUrl).then((res) => {
      if (!res.ok) throw new Error('فشل تحميل الخط Amiri');
      return res.arrayBuffer();
    });
    doc.addFileToVFS(`${fontName}-normal.ttf`, arrayBufferToBase64(fontBytes));
    doc.addFont(`${fontName}-normal.ttf`, fontName, 'normal');
    doc.setFont(fontName, 'normal');
    return true;
  } catch (error) {
    console.error('خطأ تحميل الخط:', error);
    doc.setFont('helvetica', 'normal');
    toast.error('فشل تحميل الخط Amiri، استخدام خط افتراضي', {
      position: 'top-right',
      autoClose: 3000,
    });
    return false;
  }
};

// Generate dynamic file name based on filters
const generateFileName = (filterStatus: string, filterBranchName: string, isRtl: boolean): string => {
  const date = new Date().toISOString().split('T')[0];
  const statusTranslations = {
    pending: isRtl ? 'الطلبات_قيد_الانتظار' : 'Pending_Orders',
    approved: isRtl ? 'الطلبات_المعتمدة' : 'Approved_Orders',
    in_production: isRtl ? 'الطلبات_في_الإنتاج' : 'In_Production_Orders',
    completed: isRtl ? 'الطلبات_المكتملة' : 'Completed_Orders',
    in_transit: isRtl ? 'الطلبات_في_النقل' : 'In_Transit_Orders',
    delivered: isRtl ? 'الطلبات_المسلمة' : 'Delivered_Orders',
    cancelled: isRtl ? 'الطلبات_الملغاة' : 'Cancelled_Orders',
  };
  const status = statusTranslations[filterStatus as keyof typeof statusTranslations] || (isRtl ? 'جميع_الطلبات' : 'All_Orders');
  const branch = filterBranchName ? `_${filterBranchName.replace(/\s+/g, '_')}` : '';
  return `${status}${branch}_${date}.pdf`;
};

// Generate PDF header with filter information
const generatePDFHeader = (
  doc: jsPDF,
  isRtl: boolean,
  title: string,
  filterStatus: string,
  filterBranchName: string,
  totalOrders: number,
  totalQuantity: number,
  totalAmount: number,
  fontName: string,
  fontLoaded: boolean
) => {
  doc.setFont(fontLoaded ? fontName : 'helvetica', 'normal');
  doc.setFontSize(18);
  doc.setTextColor(33, 33, 33);
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Add main title
  doc.text(isRtl ? doc.processArabic(title) : title, isRtl ? pageWidth - 20 : 20, 12, { align: isRtl ? 'right' : 'left' });

  // Add filter information
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  const statusTranslations = {
    pending: isRtl ? 'قيد الانتظار' : 'Pending',
    approved: isRtl ? 'تم الموافقة' : 'Approved',
    in_production: isRtl ? 'في الإنتاج' : 'In Production',
    completed: isRtl ? 'مكتمل' : 'Completed',
    in_transit: isRtl ? 'في النقل' : 'In Transit',
    delivered: isRtl ? 'تم التسليم' : 'Delivered',
    cancelled: isRtl ? 'ملغى' : 'Cancelled',
  };
  const filterInfo = isRtl
    ? doc.processArabic(`الحالة: ${filterStatus ? statusTranslations[filterStatus as keyof typeof statusTranslations] || 'الكل' : 'الكل'} | الفرع: ${filterBranchName || 'جميع الفروع'}`)
    : `Status: ${filterStatus ? statusTranslations[filterStatus as keyof typeof statusTranslations] || 'All' : 'All'} | Branch: ${filterBranchName || 'All Branches'}`;
  const stats = isRtl
    ? doc.processArabic(`إجمالي الطلبات: ${toArabicNumerals(totalOrders)} | إجمالي الكمية: ${toArabicNumerals(totalQuantity)} وحدة  }`)
    : `Total Orders: ${totalOrders} | Total Quantity: ${totalQuantity} units }`;

  // Position filter info on the left and stats on the right
  doc.text(filterInfo, isRtl ? 20 : pageWidth - 100, 20, { align: isRtl ? 'left' : 'right' });
  doc.text(stats, isRtl ? pageWidth - 20 : 20, 20, { align: isRtl ? 'right' : 'left' });

  // Add separator line
  doc.setLineWidth(0.5);
  doc.setDrawColor(255, 193, 7);
  doc.line(20, 25, pageWidth - 20, 25);

  // Add footer with page number
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont(fontLoaded ? fontName : 'helvetica', 'normal');
    const pageText = isRtl ? doc.processArabic(`صفحة ${toArabicNumerals(i)} من ${toArabicNumerals(pageCount)}`) : `Page ${i} of ${pageCount}`;
    doc.text(pageText, isRtl ? pageWidth - 20 : 20, pageHeight - 10, { align: isRtl ? 'right' : 'left' });
  }
};

// Generate PDF table with correct Arabic headers and RTL support
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
  const processedHeaders = isRtl ? headers.map(header => doc.processArabic(header)) : headers;
  const processedData = data.map(row => isRtl ? row.map((cell: string) => doc.processArabic(cell)) : row);

  autoTable(doc, {
    head: [isRtl ? processedHeaders.slice().reverse() : processedHeaders],
    body: isRtl ? processedData.map(row => row.slice().reverse()) : processedData,
    theme: 'grid',
    startY: 35,
    margin: { left: 15, right: 15 },
    headStyles: {
      fillColor: [255, 193, 7],
      textColor: [33, 33, 33],
      fontSize: 10,
      halign: isRtl ? 'right' : 'left',
      font: fontLoaded ? fontName : 'helvetica',
      fontStyle: 'normal', // Critical for custom fonts
      cellPadding: 4,
      minCellHeight: 8,
    },
    bodyStyles: {
      fontSize: 9,
      halign: isRtl ? 'right' : 'left',
      font: fontLoaded ? fontName : 'helvetica',
      fontStyle: 'normal',
      cellPadding: 4,
      textColor: [33, 33, 33],
      lineColor: [200, 200, 200],
      fillColor: [255, 255, 255],
      minCellHeight: 6,
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: {
      0: { cellWidth: 30 }, // Order Number
      1: { cellWidth: 20 }, // Branch
      2: { cellWidth: 30 }, // Status
      3: { cellWidth: 'auto' }, // Products
      4: { cellWidth: 20 }, // Total Amount
      5: { cellWidth: 16 }, // Total Quantity
      6: { cellWidth: 42 }, // Date
    },
    styles: {
      overflow: 'linebreak',
      cellWidth: 'wrap',
      font: fontLoaded ? fontName : 'helvetica',
      halign: isRtl ? 'right' : 'left',
      valign: 'middle',
      fontStyle: 'normal',
    },
    didParseCell: (data) => {
      data.cell.styles.halign = isRtl ? 'right' : 'left';
      if (data.column.index === (isRtl ? headers.length - 5 : 4)) { // Total Amount column
        if (!data.cell.text[0] || data.cell.text[0].includes('NaN')) {
          data.cell.text[0] = formatPrice(0, isRtl);
        }
      }
      // Process Arabic text in cells
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
  translateUnit: (unit: string, isRtl: boolean) => string,
  filterStatus: string = '',
  filterBranchName: string = ''
) => {
  try {
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });

    // Load Amiri font
    const fontName = 'Amiri';
    const fontLoaded = await loadFont(doc);

    // Filter orders
    const filteredOrders = orders.filter(
      (order) =>
        (!filterStatus || order.status === filterStatus) &&
        (!filterBranchName || order.branchName === filterBranchName)
    );

    // Calculate statistics
    const totalOrders = filteredOrders.length;
    const totalQuantity = filteredOrders.reduce((sum, order) => sum + calculateTotalQuantity(order), 0);
    const totalAmount = filteredOrders.reduce((sum, order) => {
      const amountStr = calculateAdjustedTotal(order).replace(/[^0-9.,]/g, '').replace(',', '.');
      return sum + (amountStr && !isNaN(parseFloat(amountStr)) ? parseFloat(amountStr) : 0);
    }, 0);

    // Generate header
    generatePDFHeader(
      doc,
      isRtl,
      isRtl ? 'تقرير الطلبات' : 'Orders Report',
      filterStatus,
      filterBranchName,
      totalOrders,
      totalQuantity,
      totalAmount,
      fontName,
      fontLoaded
    );

    // Prepare table headers
    const headers = [
      isRtl ? 'رقم الطلب' : 'Order Number',
      isRtl ? 'الفرع' : 'Branch',
      isRtl ? 'الحالة' : 'Status',
      isRtl ? 'المنتجات' : 'Products',
      isRtl ? 'إجمالي المبلغ' : 'Total Amount',
      isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
      isRtl ? 'التاريخ' : 'Date',
    ];

    // Prepare table data
    const data = filteredOrders.map((order) => {
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
      const formattedTotalAmount = totalAmountStr.includes('NaN') ? formatPrice(0, isRtl) : totalAmountStr;
      return [
        isRtl ? (order.orderNumber) : order.orderNumber,
        order.branchName,
        statusTranslations[order.status] || order.status,
        formatProducts(order.items, isRtl, translateUnit),
        formattedTotalAmount,
        isRtl ? `${(calculateTotalQuantity(order))} ${translateUnit('unit', isRtl)}` : `${calculateTotalQuantity(order)} ${translateUnit('unit', isRtl)}`,
        order.date,
      ];
    });

    // Generate table
    generatePDFTable(doc, headers, data, isRtl, fontLoaded, fontName, calculateAdjustedTotal, calculateTotalQuantity, translateUnit);

    // Save the PDF
    const fileName = generateFileName(filterStatus, filterBranchName, isRtl);
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