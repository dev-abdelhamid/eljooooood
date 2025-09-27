import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';
import { Order } from '../../types/types';

// Convert numbers to Arabic numerals
const toArabicNumerals = (number: string | number): string => {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(number).replace(/[0-9]/g, (digit) => arabicNumerals[parseInt(digit)]);
};

// Convert Arabic numerals to Latin for parsing
const fromArabicNumerals = (str: string): string => {
  const arabicMap: { [key: string]: string } = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
  };
  return str.replace(/[٠-٩]/g, (digit) => arabicMap[digit] || digit);
};

// Format price to match Orders.tsx, with different formatting for stats
const formatPrice = (amount: number | undefined, isRtl: boolean, isStats: boolean = false): string => {
  const validAmount = (typeof amount === 'number' && !isNaN(amount)) ? amount / 100 : 0;
  let formatted: string;
  if (isStats) {
    formatted = validAmount.toLocaleString(isRtl ? 'ar-SA' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    formatted = isRtl ? `${toArabicNumerals(formatted)} ر.س` : `${formatted} SAR`;
  } else {
    formatted = validAmount.toLocaleString(isRtl ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    if (isRtl) {
      formatted = formatted.replace(/\d/g, (d) => String.fromCharCode(0x0660 + parseInt(d)));
    }
  }
  return formatted;
};

// Format products using displayProductName and displayUnit
const formatProducts = (items: Order['items'], isRtl: boolean, translateUnit: (unit: string, isRtl: boolean) => string): string => {
  return items
    .map((item) => {
      const quantity = isRtl ? toArabicNumerals(item.quantity) : item.quantity;
      const name = item.displayProductName; // Use displayProductName for language-specific product name
      const unit = item.displayUnit; // Use displayUnit for language-specific unit
      return `${quantity} ${unit} ${name}`;
    })
    .join(' + ');
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

// Load Amiri font (regular and bold) from external URLs for reliable Arabic rendering
const loadFont = async (doc: jsPDF): Promise<boolean> => {
  const fontName = 'Amiri';
  const fontUrls = {
    regular: 'https://raw.githubusercontent.com/aliftype/amiri/master/fonts/Amiri-Regular.ttf',
    bold: 'https://raw.githubusercontent.com/aliftype/amiri/master/fonts/Amiri-Bold.ttf',
  };
  try {
    const regularFontBytes = await fetch(fontUrls.regular).then((res) => {
      if (!res.ok) throw new Error('فشل تحميل الخط Amiri العادي');
      return res.arrayBuffer();
    });
    doc.addFileToVFS(`${fontName}-normal.ttf`, arrayBufferToBase64(regularFontBytes));
    doc.addFont(`${fontName}-normal.ttf`, fontName, 'normal');

    const boldFontBytes = await fetch(fontUrls.bold).then((res) => {
      if (!res.ok) throw new Error('فشل تحميل الخط Amiri الغامق');
      return res.arrayBuffer();
    });
    doc.addFileToVFS(`${fontName}-bold.ttf`, arrayBufferToBase64(boldFontBytes));
    doc.addFont(`${fontName}-bold.ttf`, fontName, 'bold');

    doc.setFont(fontName, 'normal');
    return true;
  } catch (error) {
    console.error('خطأ تحميل الخط:', error);
    doc.setFont('helvetica', 'normal');
    toast.error('فشل تحميل خط Amiri، استخدام خط افتراضي', {
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

// Generate PDF header with filter information and footer
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

  doc.text(isRtl ? title : title, isRtl ? pageWidth - 20 : 20, 12, { align: isRtl ? 'right' : 'left' });

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
    ? `الحالة: ${filterStatus ? statusTranslations[filterStatus as keyof typeof statusTranslations] || 'الكل' : 'الكل'} | الفرع: ${filterBranchName || 'جميع الفروع'}`
    : `Status: ${filterStatus ? statusTranslations[filterStatus as keyof typeof statusTranslations] || 'All' : 'All'} | Branch: ${filterBranchName || 'All Branches'}`;
  const stats = isRtl
    ? `إجمالي الطلبات: ${toArabicNumerals(totalOrders)} | إجمالي الكمية: ${toArabicNumerals(totalQuantity)} وحدة | إجمالي المبلغ: ${formatPrice(totalAmount, isRtl, true)}`
    : `Total Orders: ${totalOrders} | Total Quantity: ${totalQuantity} units | Total Amount: ${formatPrice(totalAmount, isRtl, true)}`;

  doc.text(filterInfo, isRtl ? pageWidth - 20 : 20, 20, { align: isRtl ? 'right' : 'left' });
  doc.text(stats, isRtl ? pageWidth - 20 : 20, 28, { align: isRtl ? 'right' : 'left' });

  doc.setLineWidth(0.5);
  doc.setDrawColor(255, 193, 7);
  doc.line(20, 33, pageWidth - 20, 33);

  const pageCount = doc.getNumberOfPages();
  const currentDate = new Date().toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont(fontLoaded ? fontName : 'helvetica', 'normal');
    const footerText = isRtl
      ? `تم إنشاؤه بواسطة نظام إدارة الجودياء - ${toArabicNumerals(currentDate)}`
      : `Generated by elgoodia Management System - ${currentDate}`;
    doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }
};

// Generate PDF table with correct Arabic headers and bold price
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
  const processedData = data.map(row => isRtl ? row.map((cell: string) => doc.processArabic(String(cell))) : row);

  autoTable(doc, {
    head: [isRtl ? processedHeaders.slice().reverse() : processedHeaders],
    body: isRtl ? processedData.map(row => row.slice().reverse()) : processedData,
    theme: 'grid',
    startY: 40,
    margin: { left: 15, right: 15 },
    headStyles: {
      fillColor: [255, 193, 7],
      textColor: [33, 33, 33],
      fontSize: 10,
      halign: isRtl ? 'right' : 'left',
      font: fontLoaded ? fontName : 'helvetica',
      fontStyle: 'normal',
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
      0: { cellWidth: 30, fontStyle: 'bold' }, // Order Number
      1: { cellWidth: 20, fontStyle: 'bold' }, // Branch
      2: { cellWidth: 30, fontStyle: 'bold' }, // Status
      3: { cellWidth: 'auto', fontStyle: 'bold' }, // Products
      4: { cellWidth: 20, fontStyle: 'bold', halign: isRtl ? 'left' : 'right' }, // Total Amount (bold)
      5: { cellWidth: 16, fontStyle: 'bold' }, // Total Quantity
      6: { cellWidth: 42, fontStyle: 'bold' }, // Date
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
      data.cell.styles.halign = isRtl ? 'left' : 'right';
      if (data.column.index === (isRtl ? headers.length - 5 : 4)) {
        if (!data.cell.text[0] || data.cell.text[0].includes('NaN')) {
          data.cell.text[0] = formatPrice(0, isRtl);
        }
        data.cell.styles.fontStyle = 'bold';
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
  translateUnit: (unit: string, isRtl: boolean) => string,
  filterStatus: string = '',
  filterBranchName: string = ''
) => {
  try {
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });

    const fontName = 'Amiri';
    const fontLoaded = await loadFont(doc);

    const filteredOrders = orders.filter(
      (order) =>
        (!filterStatus || order.status === filterStatus) &&
        (!filterBranchName || order.branch.displayName === filterBranchName) // Use displayName for filtering
    );

    const totalOrders = filteredOrders.length;
    const totalQuantity = filteredOrders.reduce((sum, order) => sum + calculateTotalQuantity(order), 0);
    const totalAmount = filteredOrders.reduce((sum, order) => {
      const amountStr = calculateAdjustedTotal(order);
      const numericStr = fromArabicNumerals(amountStr);
      const cleaned = numericStr.replace(/[^0-9.]/g, '');
      return sum + (cleaned && !isNaN(parseFloat(cleaned)) ? parseFloat(cleaned) : 0);
    }, 0);

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

    const headers = [
      isRtl ? 'رقم الطلب' : 'Order Number',
      isRtl ? 'الفرع' : 'Branch',
      isRtl ? 'الحالة' : 'Status',
      isRtl ? 'المنتجات' : 'Products',
      isRtl ? 'إجمالي المبلغ' : 'Total Amount',
      isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
      isRtl ? 'التاريخ' : 'Date',
    ];

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
      let formattedTotalAmount: string;
      if (totalAmountStr.includes('NaN')) {
        formattedTotalAmount = formatPrice(0, isRtl);
      } else {
        formattedTotalAmount = totalAmountStr;
      }
      return [
        order.orderNumber,
        order.branch.displayName, // Use displayName for branch
        statusTranslations[order.status] || order.status,
        formatProducts(order.items, isRtl, translateUnit), // Use displayProductName and displayUnit
        formattedTotalAmount,
        isRtl ? `${toArabicNumerals(calculateTotalQuantity(order))} ${translateUnit('unit', isRtl)}` : `${calculateTotalQuantity(order)} ${translateUnit('unit', isRtl)}`,
        order.date,
      ];
    });

    generatePDFTable(doc, headers, data, isRtl, fontLoaded, fontName, calculateAdjustedTotal, calculateTotalQuantity, translateUnit);

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