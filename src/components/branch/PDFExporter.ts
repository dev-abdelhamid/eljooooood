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
  doc.setFontSize(12);
  doc.setFont(isRtl ? 'Alexandria' : 'helvetica', 'bold');
  const title = isRtl ? 'تقرير الطلبات' : 'Orders Report';
  const titleWidth = doc.getTextWidth(title);
  const xPosition = isRtl ? doc.internal.pageSize.width - 20 - titleWidth : 20;
  doc.text(title, xPosition, 15, { align: isRtl ? 'right' : 'left' });
  
  doc.setFontSize(8);
  doc.setFont(isRtl ? 'Alexandria' : 'helvetica', 'normal');
  const filters = [
    isRtl ? `الحالة: ${filterStatus || 'الكل'}` : `Status: ${filterStatus || 'All'}`,
    isRtl ? `الفرع: ${filterBranch || 'الكل'}` : `Branch: ${filterBranch || 'All'}`,
  ].filter(Boolean).join(' | ');
  const filtersWidth = doc.getTextWidth(filters);
  const filtersXPosition = isRtl ? doc.internal.pageSize.width - 20 - filtersWidth : 20;
  doc.text(filters, filtersXPosition, 25, { align: isRtl ? 'right' : 'left' });
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
    isRtl ? 'الحالة' : 'Status',
    isRtl ? 'المنتجات' : 'Products',
    isRtl ? 'إجمالي المبلغ' : 'Total Amount',
    isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
    isRtl ? 'التاريخ' : 'Date',
    isRtl ? 'الأولوية' : 'Priority',
  ];

  const body = orders.map(order => [
    order.orderNumber,
    t(`orders.status_${order.status}`) || order.status,
    order.items.map(item => `(${item.quantity} ${t(`${item.unit || 'unit'}`) || item.unit} × ${getFirstTwoWords(item.productName)})`).join(' + '),
    calculateAdjustedTotal(order),
    calculateTotalQuantity(order).toString(),
    order.date,
    t(`orders.priority_${order.priority}`) || order.priority,
  ]);

  autoTable(doc, {
    head: [headers],
    body,
    startY: 30,
    styles: {
      font: isRtl ? 'Alexandria' : 'helvetica',
      fontSize: 9,
      cellPadding: 4,
      overflow: 'linebreak',
      halign: isRtl ? 'right' : 'left',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [255, 193, 7],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 25 },
      2: { cellWidth: 100 },
      3: { cellWidth: 30 },
      4: { cellWidth: 25 },
      5: { cellWidth: 35 },
      6: { cellWidth: 25 },
    },
    margin: { top: 30, right: 15, bottom: 15, left: 15 },
  });
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

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
    const fontUrl = '/fonts/Alexandria-Regular.ttf';
    const fontName = 'Alexandria';
    const fontBytes = await fetch(fontUrl).then(res => {
      if (!res.ok) throw new Error('Failed to fetch font');
      return res.arrayBuffer();
    });
    const base64Font = arrayBufferToBase64(fontBytes);
    doc.addFileToVFS(`${fontName}-Regular.ttf`, base64Font);
    doc.addFont(`${fontName}-Regular.ttf`, fontName, 'normal');
    doc.setFont(fontName);

    doc.setLanguage('ar');
    generatePDFHeader(doc, isRtl, filterStatus, filterBranch);
    generatePDFTable(doc, orders, isRtl, calculateAdjustedTotal, calculateTotalQuantity, translateUnit);

    doc.save('Orders.pdf');
  } catch (error) {
    console.error('PDF export error:', error);
    throw new Error('Failed to export PDF');
  }
};
