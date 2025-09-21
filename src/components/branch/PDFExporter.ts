import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order } from '../../types/types';
import { bidiFactory } from 'bidi-js';

// تهيئة bidi-js لمعالجة النصوص ثنائية الاتجاه
const bidi = bidiFactory();

// دالة لتحميل الخط
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

// دالة لتحويل ArrayBuffer إلى Base64
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

// دالة لإنشاء هيدر الـ PDF
const generatePDFHeader = (
  doc: jsPDF,
  isRtl: boolean,
  filterStatus: string,
  filterBranch: string,
  t: (key: string) => string
) => {
  doc.setFontSize(14);
  doc.setFont(isRtl ? 'Alexandria' : 'helvetica', 'bold');
  const title = isRtl ? t('orders.report_title') || 'تقرير الطلبات' : t('orders.report_title') || 'Orders Report';
  const titleWidth = doc.getTextWidth(title);
  const xPosition = isRtl ? doc.internal.pageSize.width - 20 - titleWidth : 20;
  doc.text(title, xPosition, 15, { align: isRtl ? 'right' : 'left' });

  doc.setFontSize(10);
  doc.setFont(isRtl ? 'Alexandria' : 'helvetica', 'normal');
  const filters = [
    isRtl ? `${t('orders.status_label') || 'الحالة'}: ${filterStatus || t('orders.all_statuses') || 'الكل'}` : `Status: ${filterStatus || t('orders.all_statuses') || 'All'}`,
    isRtl ? `${t('orders.branch_label') || 'الفرع'}: ${filterBranch || t('orders.all_branches') || 'الكل'}` : `Branch: ${filterBranch || t('orders.all_branches') || 'All'}`,
  ].filter(Boolean).join(' | ');
  const filtersWidth = doc.getTextWidth(filters);
  const filtersXPosition = isRtl ? doc.internal.pageSize.width - 20 - filtersWidth : 20;
  doc.text(filters, filtersXPosition, 25, { align: isRtl ? 'right' : 'left' });
};

// دالة لإنشاء جدول الـ PDF
const generatePDFTable = (
  doc: jsPDF,
  orders: Order[],
  isRtl: boolean,
  calculateAdjustedTotal: (order: Order) => string,
  calculateTotalQuantity: (order: Order) => number,
  translateUnit: (unit: string) => string,
  t: (key: string) => string
) => {
  const headers = [
    isRtl ? t('orders.order_number') || 'رقم الطلب' : t('orders.order_number') || 'Order Number',
    isRtl ? t('orders.status') || 'الحالة' : t('orders.status') || 'Status',
    isRtl ? t('orders.products') || 'المنتجات' : t('orders.products') || 'Products',
    isRtl ? t('orders.total_amount') || 'إجمالي المبلغ' : t('orders.total_amount') || 'Total Amount',
    isRtl ? t('orders.total_quantity') || 'الكمية الإجمالية' : t('orders.total_quantity') || 'Total Quantity',
    isRtl ? t('orders.date') || 'التاريخ' : t('orders.date') || 'Date',
    isRtl ? t('orders.priority') || 'الأولوية' : t('orders.priority') || 'Priority',
  ];

  const body = orders.map(order => [
    isRtl ? bidi.processText(order.orderNumber, 'auto') : order.orderNumber,
    isRtl ? bidi.processText(t(`orders.status_${order.status}`) || order.status, 'auto') : t(`orders.status_${order.status}`) || order.status,
    isRtl
      ? bidi.processText(
          order.items
            .map(item => `(${item.quantity} ${translateUnit(item.unit || 'unit')} × ${item.productName})`)
            .join(' + '),
          'auto'
        )
      : order.items
          .map(item => `(${item.quantity} ${translateUnit(item.unit || 'unit')} × ${item.productName})`)
          .join(' + '),
    isRtl ? bidi.processText(calculateAdjustedTotal(order), 'auto') : calculateAdjustedTotal(order),
    calculateTotalQuantity(order).toString(),
    isRtl ? bidi.processText(order.date, 'auto') : order.date,
    isRtl ? bidi.processText(t(`orders.priority_${order.priority}`) || order.priority, 'auto') : t(`orders.priority_${order.priority}`) || order.priority,
  ]);

  autoTable(doc, {
    head: [isRtl ? headers.reverse() : headers],
    body: isRtl ? body.map(row => row.reverse()) : body,
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
      halign: isRtl ? 'right' : 'left',
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
    didParseCell: (data) => {
      if (isRtl && data.section === 'body') {
        data.cell.text = data.cell.text.map(text => bidi.processText(text, 'auto'));
      }
      if (data.section === 'body' && data.column.index === 3 && isRtl) {
        data.cell.text = [data.cell.raw.toString().replace(/(\d+\.\d{2})/, ' $1 ر.س')];
      }
    },
    didDrawPage: (data) => {
      doc.setFont(isRtl ? 'Alexandria' : 'helvetica');
      doc.setFontSize(8);
      doc.text(
        isRtl ? `تم الإنشاء في: ${t('orders.generated_on') || 'تم الإنشاء في'} ${new Date().toLocaleDateString('ar-SA')}` : `Generated on: ${new Date().toLocaleDateString('en-US')}`,
        isRtl ? doc.internal.pageSize.width - 10 : 10,
        doc.internal.pageSize.height - 10,
        { align: isRtl ? 'right' : 'left' }
      );
      doc.text(
        isRtl ? `الصفحة ${data.pageNumber}` : `Page ${data.pageNumber}`,
        isRtl ? 10 : doc.internal.pageSize.width - 30,
        doc.internal.pageSize.height - 10,
        { align: isRtl ? 'left' : 'right' }
      );
    },
  });
};

// دالة التصدير الرئيسية
export const exportToPDF = async (
  orders: Order[],
  isRtl: boolean,
  calculateAdjustedTotal: (order: Order) => string,
  calculateTotalQuantity: (order: Order) => number,
  translateUnit: (unit: string) => string,
  filterStatus: string,
  filterBranch: string,
  t: (key: string) => string
) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  try {
    // تحميل خط الأسكندرية
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
    doc.setLanguage('ar'); // ضبط اللغة على العربية لدعم النصوص

    // إنشاء الهيدر والجدول
    generatePDFHeader(doc, isRtl, filterStatus, filterBranch, t);
    generatePDFTable(doc, orders, isRtl, calculateAdjustedTotal, calculateTotalQuantity, translateUnit, t);

    // حفظ الملف
    doc.save('Orders.pdf');
  } catch (error) {
    console.error('PDF export error:', error);
    throw new Error('Failed to export PDF');
  }
};