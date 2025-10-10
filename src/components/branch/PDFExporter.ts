import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order } from '../../components/branch/types';
import { formatDate } from '../../utils/formatDate';
import { toast } from 'react-toastify';


function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export const exportToPDF = async (orders: Order[], t: (key: string) => string, isRtl: boolean, language: string, calculateTotalQuantity: (order: Order) => number) => {
  try {
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
    doc.setLanguage(isRtl ? 'ar' : 'en');

    const fontUrl = '/fonts/Amiri-Regular.ttf';
    const fontName = 'Amiri';
    const fontBytes = await fetch(fontUrl).then(res => {
      if (!res.ok) throw new Error('Failed to fetch font');
      return res.arrayBuffer();
    });
    const base64Font = arrayBufferToBase64(fontBytes);
    doc.addFileToVFS(`${fontName}-Regular.ttf`, base64Font);
    doc.addFont(`${fontName}-Regular.ttf`, fontName, 'normal');
    doc.setFont(fontName);

    doc.setFontSize(16);
    doc.text(isRtl ? 'الطلبات' : 'Orders', isRtl ? doc.internal.pageSize.width - 20 : 20, 15, { align: isRtl ? 'right' : 'left' });

    const headers = [
      isRtl ? 'رقم الطلب' : 'Order Number',
      isRtl ? 'الحالة' : 'Status',
      isRtl ? 'المنتجات' : 'Products',
      isRtl ? 'إجمالي المبلغ' : 'Total Amount',
      isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
      isRtl ? 'التاريخ' : 'Date',
      isRtl ? 'الأولوية' : 'Priority',
      isRtl ? 'الفرع' : 'Branch',
    ];

    const data = orders.map(order => [
      order.orderNumber,
      t(`orders.status_${order.status}`) || order.status,
      order.items.map(item => `(${item.quantity} ${t(`units.${item.unit}`) || item.unit} × ${item.productName})`).join(' + '),
      order.totalAmount.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR', minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      calculateTotalQuantity(order).toString(),
      order.date,
      t(`orders.priority_${order.priority}`) || order.priority,
      order.branch?.displayName || (isRtl ? 'غير معروف' : 'Unknown'),
    ]);

    autoTable(doc, {
      head: [isRtl ? headers.reverse() : headers],
      body: isRtl ? data.map(row => row.reverse()) : data,
      theme: 'grid',
      headStyles: { fillColor: [255, 193, 7], textColor: 255, fontSize: 10, halign: isRtl ? 'right' : 'left', font: fontName, cellPadding: 3 },
      bodyStyles: { fontSize: 8, halign: isRtl ? 'right' : 'left', font: fontName, cellPadding: 3, textColor: [33, 33, 33] },
      margin: { top: 25, left: 10, right: 10 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20 },
        2: { cellWidth: 80 },
        3: { cellWidth: 25 },
        4: { cellWidth: 20 },
        5: { cellWidth: 30 },
        6: { cellWidth: 20 },
        7: { cellWidth: 30 },
      },
      didParseCell: data => {
        if (data.section === 'body' && data.column.index === 3 && isRtl) {
          data.cell.text = [data.cell.text.toString().replace(/(\d+\.\d{2})/, ' $1 ر.س')];
        }
      },
      didDrawPage: data => {
        doc.setFont(fontName);
        doc.setFontSize(8);
        doc.text(
          isRtl ? `تم الإنشاء في: ${formatDate(new Date(), language)}` : `Generated on: ${formatDate(new Date(), language)}`,
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
      styles: { overflow: 'linebreak', font: fontName, fontSize: 8, cellPadding: 3, halign: isRtl ? 'right' : 'left' },
    });

    doc.save('BranchOrders.pdf');
    toast.success(isRtl ? 'تم تصدير PDF بنجاح' : 'PDF export successful', { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
  } catch (err) {
    console.error('PDF export error:', err);
    toast.error(isRtl ? 'خطأ في تصدير PDF' : 'PDF export error', { position: isRtl ? 'top-left' : 'top-right', autoClose: 3000 });
  }
};