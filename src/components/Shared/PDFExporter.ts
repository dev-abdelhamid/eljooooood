import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';
import { Order } from '../../types/types';

// Convert numbers to Arabic numerals
const toArabicNumerals = (number: string | number): string => {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(number).replace(/[0-9]/g, (digit) => arabicNumerals[parseInt(digit)]);
};

// Format price - بدون فواصل وكسور، عرض مباشر كـ 300 ر.س
const formatPrice = (amount: number | undefined, isRtl: boolean): string => {
  const validAmount = (typeof amount === 'number' && !isNaN(amount)) ? Math.round(amount) : 0;
  const formatted = validAmount.toString();
  const arabicNumber = isRtl ? toArabicNumerals(formatted) : formatted;
  return isRtl ? `${arabicNumber} ر.س` : `${formatted} SAR`;
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

// Load Amiri font with bold support
const loadFont = async (doc: jsPDF): Promise<boolean> => {
  const fontName = 'Amiri';
  try {
    // Load regular font
    const regularFontUrl = '/fonts/Amiri-Regular.ttf';
    const regularFontBytes = await fetch(regularFontUrl).then((res) => {
      if (!res.ok) throw new Error('فشل تحميل الخط Amiri Regular');
      return res.arrayBuffer();
    });
    doc.addFileToVFS(`${fontName}-regular.ttf`, arrayBufferToBase64(regularFontBytes));
    doc.addFont(`${fontName}-regular.ttf`, fontName, 'normal');

    // Try to load bold font
    try {
      const boldFontUrl = '/fonts/Amiri-Bold.ttf';
      const boldFontBytes = await fetch(boldFontUrl).then((res) => {
        if (!res.ok) throw new Error('فشل تحميل الخط Amiri Bold');
        return res.arrayBuffer();
      });
      doc.addFileToVFS(`${fontName}-bold.ttf`, arrayBufferToBase64(boldFontBytes));
      doc.addFont(`${fontName}-bold.ttf`, fontName, 'bold');
    } catch (boldError) {
      console.warn('فشل تحميل خط Amiri Bold، استخدام الخط العادي:', boldError);
    }

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

// Generate PDF header with factory name only
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
  doc.setFont(fontLoaded ? fontName : 'helvetica', 'bold'); // Bold for factory name
  doc.setFontSize(16); // Reduced size
  doc.setTextColor(33, 33, 33);
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Add factory name only
  const factoryName = isRtl ? 'مصنع الجودة' : 'Quality Factory'; // Change this to your factory name
  doc.text(isRtl ? doc.processArabic(factoryName) : factoryName, isRtl ? pageWidth - 20 : 20, 10, { align: isRtl ? 'right' : 'left' });

  // Add main title
  doc.setFontSize(14); // Reduced size
  doc.setFont(fontLoaded ? fontName : 'helvetica', 'bold');
  doc.text(isRtl ? doc.processArabic(title) : title, isRtl ? pageWidth - 20 : 20, 20, { align: isRtl ? 'right' : 'left' });

  // Add filter information
  doc.setFontSize(9); // Reduced size
  doc.setTextColor(100, 100, 100);
  doc.setFont(fontLoaded ? fontName : 'helvetica', 'normal');
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
  
  // Fix total amount display in header
  const formattedTotalAmount = formatPrice(totalAmount, isRtl);
  const stats = isRtl
    ? doc.processArabic(`إجمالي الطلبات: ${toArabicNumerals(totalOrders)} | إجمالي الكمية: ${toArabicNumerals(totalQuantity)} وحدة | إجمالي المبلغ: ${formattedTotalAmount}`)
    : `Total Orders: ${totalOrders} | Total Quantity: ${totalQuantity} units | Total Amount: ${formattedTotalAmount}`;

  // Position filter info and stats
  doc.text(filterInfo, isRtl ? 20 : pageWidth - 100, 28, { align: isRtl ? 'left' : 'right' });
  doc.text(stats, isRtl ? pageWidth - 20 : 20, 28, { align: isRtl ? 'right' : 'left' });

  // Add separator line
  doc.setLineWidth(0.5);
  doc.setDrawColor(33, 150, 243); // Professional blue
  doc.line(20, 33, pageWidth - 20, 33);

  // Add footer with page number
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7); // Reduced size
    doc.setTextColor(150, 150, 150);
    doc.setFont(fontLoaded ? fontName : 'helvetica', 'normal');
    const pageText = isRtl ? doc.processArabic(`صفحة ${toArabicNumerals(i)} من ${toArabicNumerals(pageCount)}`) : `Page ${i} of ${pageCount}`;
    doc.text(pageText, isRtl ? pageWidth - 20 : 20, pageHeight - 10, { align: isRtl ? 'right' : 'left' });
  }
};

// Generate PDF table with corrected price formatting
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
    startY: 40, // Adjusted for smaller header
    margin: { left: 15, right: 15 },
    headStyles: {
      fillColor: [33, 150, 243], // Professional blue
      textColor: [255, 255, 255], // White text
      fontSize: 9, // Reduced size
      halign: isRtl ? 'right' : 'left',
      font: fontLoaded ? fontName : 'helvetica',
      fontStyle: 'bold', // Bold headers
      cellPadding: 4,
      minCellHeight: 8,
    },
    bodyStyles: {
      fontSize: 8, // Reduced size
      halign: isRtl ? 'right' : 'left',
      font: fontLoaded ? fontName : 'helvetica',
      fontStyle: 'normal',
      cellPadding: 3,
      textColor: [33, 33, 33],
      lineColor: [200, 200, 200],
      fillColor: [255, 255, 255],
      minCellHeight: 6,
    },
    alternateRowStyles: {
      fillColor: [245, 248, 255], // Light blue tint
    },
    columnStyles: {
      0: { cellWidth: 30 }, // Order Number
      1: { cellWidth: 20 }, // Branch
      2: { cellWidth: 30 }, // Status
      3: { cellWidth: 'auto' }, // Products
      4: { cellWidth: 25 }, // Total Amount (increased width)
      5: { cellWidth: 20 }, // Total Quantity
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
      
      // Fix Total Amount column - always format as price
      if (data.column.index === (isRtl ? headers.length - 5 : 4)) {
        let amountValue = data.cell.text[0];
        if (typeof amountValue === 'string') {
          // Extract number from string if needed
          const numMatch = amountValue.match(/[\d.,]+/);
          if (numMatch) {
            const numValue = parseFloat(numMatch[0].replace(',', '.'));
            amountValue = formatPrice(numValue, isRtl);
          } else {
            amountValue = formatPrice(0, isRtl);
          }
        } else {
          amountValue = formatPrice(0, isRtl);
        }
        data.cell.text[0] = amountValue;
      }
      
      // Process Arabic text in cells
      if (isRtl && typeof data.cell.text[0] === 'string') {
        data.cell.text[0] = doc.processArabic(data.cell.text[0]);
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

    // Calculate statistics with proper number parsing
    const totalOrders = filteredOrders.length;
    const totalQuantity = filteredOrders.reduce((sum, order) => sum + calculateTotalQuantity(order), 0);
    const totalAmount = filteredOrders.reduce((sum, order) => {
      const amountStr = calculateAdjustedTotal(order);
      // Extract number properly
      const cleanAmount = amountStr.replace(/[^\d.,]/g, '').replace(',', '.');
      const parsedAmount = parseFloat(cleanAmount);
      return sum + (!isNaN(parsedAmount) ? parsedAmount : 0);
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

    // Prepare table data with fixed price formatting
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
      
      // Fix individual order total amount
      const rawAmountStr = calculateAdjustedTotal(order);
      const cleanAmountStr = rawAmountStr.replace(/[^\d.,]/g, '').replace(',', '.');
      const parsedAmount = parseFloat(cleanAmountStr);
      const formattedTotalAmount = !isNaN(parsedAmount) ? formatPrice(parsedAmount, isRtl) : formatPrice(0, isRtl);
      
      return [
        isRtl ? toArabicNumerals(order.orderNumber) : order.orderNumber,
        order.branchName || '',
        statusTranslations[order.status as keyof typeof statusTranslations] || order.status,
        formatProducts(order.items, isRtl, translateUnit),
        formattedTotalAmount, // Fixed price formatting
        isRtl ? `${toArabicNumerals(calculateTotalQuantity(order))} ${translateUnit('unit', isRtl)}` : `${calculateTotalQuantity(order)} ${translateUnit('unit', isRtl)}`,
        order.date || '',
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