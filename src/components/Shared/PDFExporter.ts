import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';
import { Order } from '../../types/types';

// Convert numbers to Arabic numerals
const toArabicNumerals = (number: string | number): string => {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(number).replace(/[0-9]/g, (digit) => arabicNumerals[parseInt(digit)]);
};

// Format price correctly
const formatPrice = (amount: number, isRtl: boolean): string => {
  const formatted = amount.toFixed(2).replace('.', ',');
  const arabicNumber = toArabicNumerals(formatted);
  return isRtl ? `${arabicNumber} ر.س.` : `SAR ${formatted}`;
};

// Format products for Arabic and English with proper structure
const formatProducts = (items: Order['items'], isRtl: boolean, translateUnit: (unit: string, isRtl: boolean) => string): string => {
  return items
    .map((item) => {
      const quantity = isRtl ? toArabicNumerals(item.quantity) : item.quantity;
      return isRtl
        ? `(${quantity} ${translateUnit(item.unit, isRtl)} ${item.productName})`
        : `(${item.productName} ${quantity} ${translateUnit(item.unit, isRtl)})`;
    })
    .join(isRtl ? ' + ' : ', '); // Use '+' for Arabic, ',' for English
};

// Convert array buffer to base64
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

// Load Arabic font (Amiri as fallback if Alexandria fails)
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
    // Fallback to Amiri font
    const fallbackFontUrl = '/fonts/Amiri-Regular.ttf';
    try {
      const fontBytes = await fetch(fallbackFontUrl).then((res) => {
        if (!res.ok) throw new Error('فشل تحميل خط الاحتياط');
        return res.arrayBuffer();
      });
      doc.addFileToVFS('Amiri-Regular.ttf', arrayBufferToBase64(fontBytes));
      doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
      doc.setFont('Amiri');
      return true;
    } catch (fallbackError) {
      console.error('خطأ تحميل خط الاحتياط:', fallbackError);
      doc.setFont('helvetica');
      return false;
    }
  }
};

// Generate dynamic file name based on filters
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

// Generate PDF header with filter information
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

  // Add main title
  doc.text(title, isRtl ? pageWidth - 20 : 20, 15, {
    align: isRtl ? 'right' : 'left',
  });

  // Add filter information
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
  doc.text(filterInfo, isRtl ? pageWidth - 20 : 20, 25, {
    align: isRtl ? 'right' : 'left',
  });

  // Add total statistics
  doc.setFontSize(9);
  const stats = isRtl
    ? `إجمالي الطلبات: ${toArabicNumerals(totalOrders)} | إجمالي الكمية: ${toArabicNumerals(totalQuantity)} وحدة | إجمالي المبلغ: ${formatPrice(totalAmount, isRtl)}`
    : `Total Orders: ${totalOrders} | Total Quantity: ${totalQuantity} units | Total Amount: ${formatPrice(totalAmount, isRtl)}`;
  doc.text(stats, isRtl ? pageWidth - 20 : 20, 35, {
    align: isRtl ? 'right' : 'left',
  });

  // Add separator line
  doc.setLineWidth(0.5);
  doc.setDrawColor(200, 200, 200);
  doc.line(20, 40, pageWidth - 20, 40);

  // Add footer with page number
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

// Generate PDF table with improved text handling
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
    startY: 45,
    margin: { left: 15, right: 15 },
    headStyles: {
      fillColor: [40, 74, 94],
      textColor: [255, 255, 255],
      fontSize: 10,
      halign: isRtl ? 'right' : 'left',
      font: fontLoaded ? fontName : 'Amiri',
      cellPadding: 5,
      textDirection: isRtl ? 'rtl' : 'ltr',
    },
    bodyStyles: {
      fontSize: 9,
      halign: isRtl ? 'right' : 'left',
      font: fontLoaded ? fontName : 'Amiri',
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
        data.cell.styles.cellPadding = { top: 5, right: 5, bottom: 5, left: 5 };
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
    doc.setLanguage('ar'); // Set language to Arabic for RTL support

    const fontName = 'Alexandria';
    const fontUrl = '/fonts/Alexandria-Regular.ttf'; // Path to Alexandria font
    const fontLoaded = await loadFont(doc, fontName, fontUrl);

    // Calculate statistics
    const totalOrders = orders.length;
    const totalQuantity = orders.reduce((sum, order) => sum + calculateTotalQuantity(order), 0);
    const totalAmount = orders.reduce((sum, order) => {
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
      isRtl ? 'رقم الطلب' : 'Order Number',
      isRtl ? 'الفرع' : 'Branch',
      isRtl ? 'الحالة' : 'Status',
      isRtl ? 'المنتجات' : 'Products',
      isRtl ? 'إجمالي المبلغ' : 'Total Amount',
      isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
      isRtl ? 'التاريخ' : 'Date',
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
    const data = orders.map((order) => {
      const productsStr = formatProducts(order.items, isRtl, translateUnit);
      const totalQuantity = isRtl ? toArabicNumerals(calculateTotalQuantity(order)) : calculateTotalQuantity(order);
      return [
        order.orderNumber,
        order.branchName,
        isRtl ? statusTranslations[order.status] || order.status : order.status,
        productsStr,
        calculateAdjustedTotal(order),
        `${totalQuantity} ${isRtl ? 'وحدة' : 'units'}`,
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