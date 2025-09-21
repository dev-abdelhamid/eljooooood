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
const formatPrice = (amount: number, isRtl: boolean): string => {
  const formatted = amount.toFixed(2).replace('.', ',');
  const arabicNumber = toArabicNumerals(formatted);
  return isRtl ? `${arabicNumber} ر.س.` : `SAR ${formatted}`;
};

// Format products for Arabic and English with correct parentheses and spacing
const formatProducts = (items: Order['items'], isRtl: boolean, translateUnit: (unit: string, isRtl: boolean) => string): string => {
  return items
    .map((item) => {
      const quantity = isRtl ? toArabicNumerals(item.quantity) : item.quantity;
      // Ensure correct order and parentheses for Arabic
      return isRtl
        ? `${quantity} ${translateUnit(item.unit, isRtl)} ${item.productName}`
        : `${item.productName} (${quantity} ${translateUnit(item.unit, isRtl)})`;
    })
    .join(isRtl ? ' + ' : ', ');
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
      if (!res.ok) throw new Error('فشل تحميل الخط');
      return res.arrayBuffer();
    });
    doc.addFileToVFS(`${fontName}-Regular.ttf`, arrayBufferToBase64(fontBytes));
    doc.addFont(`${fontName}-Regular.ttf`, fontName, 'normal');
    doc.setFont(fontName);
    return true;
  } catch (error) {
    console.error('خطأ تحميل الخط:', error);
    doc.setFont('helvetica'); // Fallback to Helvetica
    toast.error('فشل تحميل الخط، يتم استخدام خط افتراضي', {
      position: 'top-right',
      autoClose: 3000,
    });
    return false;
  }
};

// Generate dynamic file name based on filters
const generateFileName = (filterStatus: string, filterBranch: string, isRtl: boolean): string => {
  const date = new Date().toISOString().split('T')[0];
  const statusTranslations = {
    pending: 'قيد_الانتظار',
    approved: 'تم_الموافقة',
    in_production: 'في_الإنتاج',
    completed: 'مكتمل',
    in_transit: 'في_النقل',
    delivered: 'تم_التسليم',
    cancelled: 'ملغى',
  };
  const status = isRtl
    ? filterStatus
      ? statusTranslations[filterStatus] || 'الكل'
      : 'الكل'
    : filterStatus || 'all';
  const branch = filterBranch ? filterBranch.replace(/\s+/g, '_') : (isRtl ? 'جميع_الفروع' : 'all_branches');
  return `Orders_${status}_${branch}_${date}.pdf`;
};

// Generate PDF header with filter information and yellow theme
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
  doc.setTextColor(33, 33, 33); // Dark gray for title
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Add main title
  doc.text(title, isRtl ? pageWidth - 20 : 20, 15, { align: isRtl ? 'right' : 'left' });

  // Add filter information
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100); // Light gray for filter info
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

  // Add total statistics
  doc.setFontSize(9);
  const stats = isRtl
    ? `إجمالي الطلبات: ${toArabicNumerals(totalOrders)} | إجمالي الكمية: ${toArabicNumerals(totalQuantity)} وحدة | إجمالي المبلغ: ${formatPrice(totalAmount, isRtl)}`
    : `Total Orders: ${totalOrders} | Total Quantity: ${totalQuantity} units | Total Amount: ${formatPrice(totalAmount, isRtl)}`;
  doc.text(stats, isRtl ? pageWidth - 20 : 20, 35, { align: isRtl ? 'right' : 'left' });

  // Add separator line in yellow
  doc.setLineWidth(0.5);
  doc.setDrawColor(255, 193, 7); // Yellow (#FFC107)
  doc.line(20, 40, pageWidth - 20, 40);

  // Add footer with page number
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150); // Light gray for footer
    doc.text(
      isRtl ? `صفحة ${toArabicNumerals(i)} من ${toArabicNumerals(pageCount)}` : `Page ${i} of ${pageCount}`,
      isRtl ? pageWidth - 20 : 20,
      pageHeight - 10,
      { align: isRtl ? 'right' : 'left' }
    );
  }
};

// Generate PDF table with yellow-themed styling and correct Arabic headers
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
    head: [isRtl ? headers : headers.reverse()], // Reverse headers for RTL to maintain correct order
    body: isRtl ? data : data.map((row) => row.reverse()), // Reverse rows for RTL
    theme: 'grid',
    startY: 45,
    margin: { left: 15, right: 15 },
    headStyles: {
      fillColor: [255, 193, 7], // Yellow (#FFC107)
      textColor: [33, 33, 33], // Dark gray text
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
      lineColor: [200, 200, 200], // Light gray borders
      textDirection: isRtl ? 'rtl' : 'ltr',
      fillColor: [255, 245, 195], // Light yellow background (#FFF5C3)
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255], // White for alternating rows
    },
    columnStyles: {
      0: { cellWidth: 25 }, // Order Number
      1: { cellWidth: 25 }, // Branch
      2: { cellWidth: 25 }, // Status
      3: { cellWidth: 100 }, // Products (wider for long text)
      4: { cellWidth: 25 }, // Total Amount
      5: { cellWidth: 20 }, // Total Quantity
      6: { cellWidth: 35 }, // Date
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
        data.cell.styles.cellPadding = { top: 5, right: 5, bottom: 5, left: 5 }; // Extra padding for products
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
  translateUnit: (unit: string, isRtl: boolean) => string,
  filterStatus: string = '',
  filterBranch: string = ''
) => {
  try {
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
    doc.setLanguage('ar'); // Enable Arabic language support

    // Load Amiri font
    const fontName = 'Amiri';
    const fontLoaded = await loadFont(doc);

    // Filter orders based on provided filterStatus and filterBranch
    const filteredOrders = orders.filter(
      (order) =>
        (!filterStatus || order.status === filterStatus) &&
        (!filterBranch || order.branchId === filterBranch)
    );

    // Calculate statistics
    const totalOrders = filteredOrders.length;
    const totalQuantity = filteredOrders.reduce((sum, order) => sum + calculateTotalQuantity(order), 0);
    const totalAmount = filteredOrders.reduce((sum, order) => {
      const amountStr = calculateAdjustedTotal(order).replace(/[^0-9.]/g, '');
      return sum + (parseFloat(amountStr) || 0);
    }, 0);

    // Generate header
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

    // Prepare table headers
    const headers = [
      'رقم الطلب', // Order Number
      'الفرع', // Branch
      'الحالة', // Status
      'المنتجات', // Products
      'إجمالي المبلغ', // Total Amount
      'الكمية الإجمالية', // Total Quantity
      'التاريخ', // Date
    ];

    // Translate statuses
    const statusTranslations: Record<string, string> = {
      pending: 'قيد الانتظار',
      approved: 'تم الموافقة',
      in_production: 'في الإنتاج',
      completed: 'مكتمل',
      in_transit: 'في النقل',
      delivered: 'تم التسليم',
      cancelled: 'ملغى',
    };

    // Prepare table data
    const data = filteredOrders.map((order) => {
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

    // Generate table
    generatePDFTable(doc, headers, data, isRtl, fontLoaded, fontName, calculateAdjustedTotal, calculateTotalQuantity, translateUnit);

    // Save the file
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
