import pdfMake from 'pdfmake/build/pdfmake';
import {pdfFonts} from './vfs_fonts';
import { toast } from 'react-toastify';
import { Order } from '../../types/types';

// Register custom fonts for pdfmake
pdfMake.vfs = pdfFonts.pdfMake.vfs;
pdfMake.fonts = {
  Cairo: {
    normal: 'Cairo-Regular.ttf',
    bold: 'Cairo-Bold.ttf',
  },
  Amiri: {
    normal: 'Amiri-Regular.ttf',
  },
};

// Convert numbers to Arabic numerals
const toArabicNumerals = (number: string | number): string => {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(number).replace(/[0-9]/g, (digit) => arabicNumerals[parseInt(digit)]);
};

// Format price with proper currency and Arabic numerals
const formatPrice = (amount: number, isRtl: boolean): string => {
  const formatted = amount.toFixed(2).replace('.', ',');
  const arabicNumber = isRtl ? toArabicNumerals(formatted) : formatted;
  return isRtl ? `${arabicNumber} ر.س.` : `SAR ${formatted}`;
};

// Format products for Arabic and English
const formatProducts = (items: Order['items'], isRtl: boolean, translateUnit: (unit: string, isRtl: boolean) => string): string => {
  return items
    .map((item) => {
      const quantity = isRtl ? toArabicNumerals(item.quantity) : item.quantity;
      return isRtl
        ? `${quantity} ${translateUnit(item.unit, isRtl)} ${item.productName}`
        : `${item.productName} (${quantity} ${translateUnit(item.unit, isRtl)})`;
    })
    .join(isRtl ? ' + ' : ', ');
};

// Generate dynamic file name
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

// Generate PDF content
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
    // Filter orders
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

    // Define table headers
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
    const tableBody = filteredOrders.map((order) => [
      isRtl ? toArabicNumerals(order.orderNumber) : order.orderNumber,
      order.branchName,
      isRtl ? statusTranslations[order.status] || order.status : order.status,
      formatProducts(order.items, isRtl, translateUnit),
      calculateAdjustedTotal(order),
      `${isRtl ? toArabicNumerals(calculateTotalQuantity(order)) : calculateTotalQuantity(order)} ${isRtl ? 'وحدة' : 'units'}`,
      order.date,
    ]);

    // Add headers to table body
    const tableData = [headers, ...tableBody];

    // Define document structure
    const docDefinition = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [20, 60, 20, 40],
      defaultStyle: {
        font: isRtl ? 'Cairo' : 'Roboto',
        fontSize: 10,
        alignment: isRtl ? 'right' : 'left',
      },
      header: {
        margin: [20, 15, 20, 0],
        columns: [
          {
            text: isRtl ? 'تقرير الطلبات' : 'Orders Report',
            fontSize: 18,
            color: '#212121', // Dark gray
            bold: true,
          },
        ],
      },
      footer: (currentPage: number, pageCount: number) => ({
        text: isRtl
          ? `صفحة ${toArabicNumerals(currentPage)} من ${toArabicNumerals(pageCount)}`
          : `Page ${currentPage} of ${pageCount}`,
        alignment: isRtl ? 'right' : 'left',
        fontSize: 8,
        color: '#969696', // Light gray
        margin: [20, 0],
      }),
      content: [
        // Filter information
        {
          text: isRtl
            ? `الحالة: ${filterStatus ? statusTranslations[filterStatus] || 'الكل' : 'الكل'} | الفرع: ${filterBranch || 'جميع الفروع'}`
            : `Status: ${filterStatus || 'All'} | Branch: ${filterBranch || 'All Branches'}`,
          fontSize: 10,
          color: '#646464', // Light gray
          margin: [0, 5],
        },
        // Statistics
        {
          text: isRtl
            ? `إجمالي الطلبات: ${toArabicNumerals(totalOrders)} | إجمالي الكمية: ${toArabicNumerals(totalQuantity)} وحدة | إجمالي المبلغ: ${formatPrice(totalAmount, isRtl)}`
            : `Total Orders: ${totalOrders} | Total Quantity: ${totalQuantity} units | Total Amount: ${formatPrice(totalAmount, isRtl)}`,
          fontSize: 9,
          color: '#646464',
          margin: [0, 5, 0, 10],
        },
        // Separator line
        {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 802, // A4 landscape width in points
              y2: 0,
              lineWidth: 0.5,
              lineColor: '#FFC107', // Yellow
            },
          ],
          margin: [0, 0, 0, 10],
        },
        // Table
        {
          table: {
            headerRows: 1,
            widths: [50, 50, 50, 200, 50, 50, 70], // Adjusted column widths
            body: tableData,
          },
          layout: {
            fillColor: (rowIndex: number) => (rowIndex === 0 ? '#FFC107' : rowIndex % 2 === 0 ? '#FFF5C3' : '#FFFFFF'), // Yellow header, alternating rows
            hLineColor: () => '#C8C8C8', // Light gray horizontal lines
            vLineColor: () => '#C8C8C8', // Light gray vertical lines
            paddingTop: () => 5,
            paddingBottom: () => 5,
            paddingLeft: () => 5,
            paddingRight: () => 5,
          },
        },
      ],
      styles: {
        header: {
          fontSize: 10,
          bold: true,
          color: '#212121', // Dark gray for header text
        },
      },
    };

    // Generate and download PDF
    pdfMake.createPdf(docDefinition).download(generateFileName(filterStatus, filterBranch, isRtl));

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