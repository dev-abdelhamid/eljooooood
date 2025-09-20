import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';
import { Order } from '../../types/types';

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

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

const generatePDFHeader = (doc: jsPDF, isRtl: boolean, title: string) => {
  doc.setFontSize(18);
  doc.setTextColor(33, 33, 33);
  doc.text(title, isRtl ? doc.internal.pageSize.width - 20 : 20, 15, { align: isRtl ? 'right' : 'left' });
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(isRtl ? 'تقرير طلبات الإنتاج' : 'Production Orders Report', isRtl ? doc.internal.pageSize.width - 20 : 20, 25, { align: isRtl ? 'right' : 'left' });
  doc.setLineWidth(0.5);
  doc.setDrawColor(200, 200, 200);
  doc.line(20, 30, doc.internal.pageSize.width - 20, 30);
};

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
    body: data.map(row => isRtl ? row.reverse() : row),
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
      0: { cellWidth: 30 },
      1: { cellWidth: 30 },
      2: { cellWidth: 25 },
      3: { cellWidth: 80 },
      4: { cellWidth: 30 },
      5: { cellWidth: 25 },
      6: { cellWidth: 30 },
    },
    didParseCell: (data) => {
      if (data.section === 'head') {
        data.cell.styles.halign = isRtl ? 'right' : 'left';
      }
    },
  });
};

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
    const data = orders.map(order => [
      order.orderNumber,
      order.branchName,
      isRtl ? { pending: 'قيد الانتظار', approved: 'تم الموافقة', in_production: 'في الإنتاج', completed: 'مكتمل', in_transit: 'في النقل', delivered: 'تم التسليم', cancelled: 'ملغى' }[order.status] || order.status : order.status,
      order.items.map(i => `${i.productName} (${i.quantity} ${translateUnit(i.unit, isRtl)})`).join(', '),
      calculateAdjustedTotal(order),
      `${calculateTotalQuantity(order)} ${isRtl ? 'وحدة' : 'units'}`,
      order.date,
    ]);
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