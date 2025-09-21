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
  const arabicNumber = isRtl ? toArabicNumerals(formatted) : formatted;
  return isRtl ? `${arabicNumber} ر.س` : `SAR ${formatted}`;
};

// Format products for Arabic and English with correct separator
const formatProducts = (items: Order['items'], isRtl: boolean, translateUnit: (unit: string, isRtl: boolean) => string): string => {
  return items
    .map((item) => {
      const quantity = isRtl ? toArabicNumerals(item.quantity) : item.quantity;
      return isRtl
        ? `${item.productName} (${quantity} ${translateUnit(item.unit, isRtl)})`
        : `${item.productName} (${quantity} ${translateUnit(item.unit, isRtl)})`;
    })
    .join(isRtl ? '، ' : ', ');
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
    doc.addFileToVFS(`${fontName}-Regular.ttf`, arrayBufferToBase64(fontBytes));
    doc.addFont(`${fontName}-Regular.ttf`, fontName, 'normal');
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
  doc.text(title, isRtl ? pageWidth - 20 : 20, 12, { align: isRtl ? 'right' : 'left' });

  // Add filter information
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  const statusTranslations = {
    pending: 'قيد الانتظار',
    approved: 'المعتمدة',
    in_production: 'في الإنتاج',
    completed: 'مكتمل',
    in_transit: 'في النقل',
    delivered: 'تم التسليم',
    cancelled: 'ملغى',
  };
  const filterInfo = isRtl
    ? `الحالة: ${filterStatus ? statusTranslations[filterStatus as keyof typeof statusTranslations] || 'الكل' : 'الكل'} | الفرع: ${filterBranchName || 'جميع الفروع'}`
    : `Status: ${filterStatus || 'All'} | Branch: ${filterBranchName || 'All Branches'}`;
  doc.text(filterInfo, isRtl ? pageWidth - 20 : 20, 20, { align: isRtl ? 'right' : 'left' });

  // Add total statistics with Arabic numerals
  doc.setFontSize(9);
  const stats = isRtl
    ? `إجمالي الطلبات: ${toArabicNumerals(totalOrders)} | إجمالي الكمية: ${toArabicNumerals(totalQuantity)} وحدة | إجمالي المبلغ: ${formatPrice(totalAmount, isRtl)}`
    : `Total Orders: ${totalOrders} | Total Quantity: ${totalQuantity} units | Total Amount: ${formatPrice(totalAmount, isRtl)}`;
  doc.text(stats, isRtl ? pageWidth - 20 : 20, 28, { align: isRtl ? 'right' : 'left' });

  // Add separator line in yellow
  doc.setLineWidth(0.5);
  doc.setDrawColor(255, 193, 7);
  doc.line(20, 32, pageWidth - 20, 32);

  // Add footer with page number
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont(fontLoaded ? fontName : 'helvetica', 'normal');
    doc.text(
      isRtl ? `صفحة ${toArabicNumerals(i)} من ${toArabicNumerals(pageCount)}` : `Page ${i} of ${pageCount}`,
      isRtl ? pageWidth - 20 : 20,
      pageHeight - 10,
      { align: isRtl ? 'right' : 'left' }
    );
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
  autoTable(doc, {
    head: [headers], // Headers are already in correct order for RTL
    body: data, // Data is prepared in correct order
    theme: 'grid',
    startY: 35,
    margin: { left: 15, right: 15 },
    headStyles: {
      fillColor: [255, 193, 7],
      textColor: [33, 33, 33],
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
      fillColor: [255, 245, 195],
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
    },
    columnStyles: {
      0: { cellWidth: 25 }, // Order Number
      1: { cellWidth: 30 }, // Branch
      2: { cellWidth: 25 }, // Status
      3: { cellWidth: 'auto' }, // Products
      4: { cellWidth: 30 }, // Total Amount
      5: { cellWidth: 25 }, // Total Quantity
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
      if (data.column.index === 4 && !data.cell.text[0]) {
        data.cell.text[0] = formatPrice(0, isRtl); // Fallback if total amount is empty
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
      const amountStr = calculateAdjustedTotal(order).replace(/[^0-9.]/g, '');
      return sum + (parseFloat(amountStr) || 0);
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
      'رقم الطلب',
      'الفرع',
      'الحالة',
      'المنتجات',
      'إجمالي المبلغ',
      'الكمية الإجمالية',
      'التاريخ',
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
      const adjustedTotalStr = calculateAdjustedTotal(order) || formatPrice(0, isRtl);
      return [
        isRtl ? toArabicNumerals(order.orderNumber) : order.orderNumber,
        order.branchName,
        isRtl ? statusTranslations[order.status] || order.status : order.status,
        productsStr,
        adjustedTotalStr,
        `${totalQuantityStr} ${isRtl ? 'وحدة' : 'units'}`,
        order.date,
      ];
    });

    // Generate table
    generatePDFTable(doc, headers, data, isRtl, fontLoaded, fontName, calculateAdjustedTotal, calculateTotalQuantity, translateUnit);

    // Save the file
    const fileName = generateFileName(filterStatus, filterBranchName, isRtl);
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