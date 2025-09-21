import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order } from '../../types/types';

const loadFont = async (fontName: string, fontUrl: string): Promise<string | null> => {
  try {
    const response = await fetch(fontUrl);
    if (!response.ok) {
      console.error(`Failed to fetch font ${fontName}: ${response.statusText}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer).toString('base64');
  } catch (error) {
    console.error(`Error loading font ${fontName}:`, error);
    return null;
  }
};

const generatePDFHeader = (doc: jsPDF, isRtl: boolean, filterStatus: string, filterBranch: string) => {
  doc.setFontSize(16);
  doc.setFont(isRtl ? 'Cairo' : 'helvetica', 'bold');
  const title = isRtl ? 'تقرير الطلبات' : 'Orders Report';
  const titleWidth = doc.getTextWidth(title);
  const xPosition = isRtl ? doc.internal.pageSize.width - 20 - titleWidth : 20;
  doc.text(title, xPosition, 20, { align: isRtl ? 'right' : 'left' });
  
  doc.setFontSize(10);
  doc.setFont(isRtl ? 'Cairo' : 'helvetica', 'normal');
  const filters = [
    isRtl ? `الحالة: ${filterStatus || 'الكل'}` : `Status: ${filterStatus || 'All'}`,
    isRtl ? `الفرع: ${filterBranch || 'الكل'}` : `Branch: ${filterBranch || 'All'}`,
  ].filter(Boolean).join(' | ');
  const filtersWidth = doc.getTextWidth(filters);
  const filtersXPosition = isRtl ? doc.internal.pageSize.width - 20 - filtersWidth : 20;
  doc.text(filters, filtersXPosition, 30, { align: isRtl ? 'right' : 'left' });
};

const generatePDFTable = (
  doc: jsPDF,
  orders: Order[],
  isRtl: boolean,
  calculateAdjustedTotal: (order: Order) => string,
  calculateTotalQuantity: (order: Order) => number,
  translateUnit: (unit: string) => string
) => {
  const headers = [
    isRtl ? 'رقم الطلب' : 'Order Number',
    isRtl ? 'الفرع' : 'Branch',
    isRtl ? 'الحالة' : 'Status',
    isRtl ? 'المنتجات' : 'Products',
    isRtl ? 'إجمالي المبلغ' : 'Total Amount',
    isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
    isRtl ? 'التاريخ' : 'Date',
  ];

  const body = orders.map(order => {
    const productsStr = order.items
      .map(item => `${item.productName} (${item.quantity} ${translateUnit(item.unit)})`)
      .join(', ');
    return [
      order.orderNumber,
      order.branchName,
      isRtl ? {
        pending: 'قيد الانتظار',
        approved: 'تم الموافقة',
        in_production: 'في الإنتاج',
        completed: 'مكتمل',
        in_transit: 'في النقل',
        delivered: 'تم التسليم',
        cancelled: 'ملغى',
      }[order.status] : order.status,
      productsStr,
      calculateAdjustedTotal(order),
      `${calculateTotalQuantity(order)} ${isRtl ? 'وحدة' : 'units'}`,
      order.date,
    ];
  });

  autoTable(doc, {
    head: [headers],
    body,
    startY: 40,
    styles: {
      font: isRtl ? 'Cairo' : 'helvetica',
      fontSize: 10,
      cellPadding: 4,
      overflow: 'linebreak',
      halign: isRtl ? 'right' : 'left',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [245, 245, 220],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 40 },
      2: { cellWidth: 30 },
      3: { cellWidth: 60 },
      4: { cellWidth: 30 },
      5: { cellWidth: 20 },
      6: { cellWidth: 30 },
    },
    margin: { top: 40, right: 20, bottom: 20, left: 20 },
    direction: isRtl ? 'rtl' : 'ltr',
  });
};

export const exportToPDF = async (
  orders: Order[],
  isRtl: boolean,
  calculateAdjustedTotal: (order: Order) => string,
  calculateTotalQuantity: (order: Order) => number,
  translateUnit: (unit: string) => string,
  filterStatus: string,
  filterBranch: string
) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  try {
    const regularFont = await loadFont('Cairo-Regular', '/fonts/Cairo-Regular.ttf');
    const boldFont = await loadFont('Cairo-Bold', '/fonts/Cairo-Bold.ttf');

    if (regularFont && boldFont) {
      doc.addFileToVFS('Cairo-Regular.ttf', regularFont);
      doc.addFileToVFS('Cairo-Bold.ttf', boldFont);
      doc.addFont('Cairo-Regular.ttf', 'Cairo', 'normal');
      doc.addFont('Cairo-Bold.ttf', 'Cairo', 'bold');
    } else {
      console.warn('Failed to load Cairo fonts, falling back to helvetica');
    }

    doc.setLanguage('ar');
    generatePDFHeader(doc, isRtl, filterStatus, filterBranch);
    generatePDFTable(doc, orders, isRtl, calculateAdjustedTotal, calculateTotalQuantity, translateUnit);

    doc.save('Orders.pdf');
  } catch (error) {
    console.error('PDF export error:', error);
    throw new Error('Failed to export PDF');
  }
};