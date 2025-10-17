export const formatDate = (date: Date | string, language: string): string => {
  return new Date(date).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const normalizeText = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, '')
    .replace(/أ|إ|آ|ٱ/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .trim();
};

export const translateUnit = (unit: string, isRtl: boolean): string => {
  const translations: Record<string, { ar: string; en: string }> = {
    'كيلو': { ar: 'كيلو', en: 'kg' },
    'قطعة': { ar: 'قطعة', en: 'piece' },
    'علبة': { ar: 'علبة', en: 'pack' },
    'صينية': { ar: 'صينية', en: 'tray' },
    'kg': { ar: 'كجم', en: 'kg' },
    'piece': { ar: 'قطعة', en: 'piece' },
    'pack': { ar: 'علبة', en: 'pack' },
    'tray': { ar: 'صينية', en: 'tray' },
  };
  return translations[unit] ? (isRtl ? translations[unit].ar : translations[unit].en) : isRtl ? 'وحدة' : 'unit';
};

export const exportToExcel = (
  orders: Order[],
  isRtl: boolean,
  calculateAdjustedTotal: (order: Order) => string,
  calculateTotalQuantity: (order: Order) => number,
  translateUnit: (unit: string, isRtl: boolean) => string
) => {
  import('xlsx').then((XLSX) => {
    const headers = [
      isRtl ? 'رقم الطلب' : 'Order Number',
      isRtl ? 'الفرع' : 'Branch',
      isRtl ? 'الحالة' : 'Status',
      isRtl ? 'المنتجات' : 'Products',
      isRtl ? 'إجمالي المبلغ' : 'Total Amount',
      isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
      isRtl ? 'التاريخ' : 'Date',
    ];
    const data = orders.map((order) => {
      const productsStr = order.items
        .map((i) => `${i.displayProductName} (${i.quantity} ${translateUnit(i.unit, isRtl)})`)
        .join(', ');
      const totalAmount = calculateAdjustedTotal(order);
      const totalQuantity = `${calculateTotalQuantity(order)} ${isRtl ? 'وحدة' : 'units'}`;
      const statusLabel = isRtl
        ? {
            pending: 'قيد الانتظار',
            approved: 'تم الموافقة',
            in_production: 'في الإنتاج',
            completed: 'مكتمل',
            in_transit: 'في النقل',
            delivered: 'تم التسليم',
            cancelled: 'ملغى',
          }[order.status]
        : order.status;
      return {
        [headers[0]]: order.orderNumber,
        [headers[1]]: order.branch.displayName,
        [headers[2]]: statusLabel,
        [headers[3]]: productsStr,
        [headers[4]]: totalAmount,
        [headers[5]]: totalQuantity,
        [headers[6]]: order.date,
      };
    });
    const ws = XLSX.utils.json_to_sheet(isRtl ? data.map((row) => Object.fromEntries(Object.entries(row).reverse())) : data, {
      header: headers,
    });
    if (isRtl) ws['!views'] = [{ RTL: true }];
    ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 50 }, { wch: 20 }, { wch: 15 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isRtl ? 'الطلبات' : 'Orders');
    XLSX.writeFile(wb, 'Orders.xlsx');
  });
};