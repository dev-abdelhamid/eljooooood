import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/UI/Button';
import { Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';
import { inventoryAPI, ordersAPI, branchesAPI, salesAPI } from '../services/api';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';

interface OrderRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  branchQuantities: { [branch: string]: number };
  totalQuantity: number;
  totalPrice: number;
  sales: number;
  actualSales: number;
  movements: { type: 'order' | 'sale' | 'return'; quantity: number; date: string; branch: string }[];
}

interface StockRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  totalQuantity: number;
  dailyChanges: number[];
  totalPrice: number;
  movements: { type: 'in' | 'out' | 'return'; quantity: number; date: string; branch: string }[];
}

interface ReturnRow {
  id: string;
  product: string;
  code: string;
  unit: string;
  totalReturns: number;
  dailyReturns: number[];
  totalValue: number;
  movements: { type: 'return'; quantity: number; date: string; branch: string }[];
}

interface Branch {
  _id: string;
  name: string;
  nameEn: string;
  displayName: string;
}

const toArabicNumerals = (number: string | number): string => {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(number).replace(/[0-9]/g, (digit) => arabicNumerals[parseInt(digit)]);
};

const formatPrice = (amount: number, isRtl: boolean, isStats: boolean = false): string => {
  const validAmount = (typeof amount === 'number' && !isNaN(amount)) ? amount : 0;
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

const formatNumber = (num: number, isRtl: boolean): string => {
  return isRtl ? toArabicNumerals(num) : num.toString();
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const loadFont = async (doc: jsPDF): Promise<boolean> => {
  const fontName = 'Amiri';
  const fontUrls = {
    regular: 'https://raw.githubusercontent.com/aliftype/amiri/master/fonts/Amiri-Regular.ttf',
    bold: 'https://raw.githubusercontent.com/aliftype/amiri/master/fonts/Amiri-Bold.ttf',
  };
  try {
    const regularFontBytes = await fetch(fontUrls.regular).then((res) => res.arrayBuffer());
    doc.addFileToVFS(`${fontName}-normal.ttf`, arrayBufferToBase64(regularFontBytes));
    doc.addFont(`${fontName}-normal.ttf`, fontName, 'normal');
    const boldFontBytes = await fetch(fontUrls.bold).then((res) => res.arrayBuffer());
    doc.addFileToVFS(`${fontName}-bold.ttf`, arrayBufferToBase64(boldFontBytes));
    doc.addFont(`${fontName}-bold.ttf`, fontName, 'bold');
    doc.setFont(fontName, 'normal');
    return true;
  } catch (error) {
    console.error('Font loading error:', error);
    doc.setFont('helvetica', 'normal');
    toast.error('Failed to load Amiri font, using default', {
      position: isRtl ? 'top-left' : 'top-right',
      autoClose: 3000,
    });
    return false;
  }
};

const generateFileName = (title: string, monthName: string, isRtl: boolean): string => {
  const date = new Date().toISOString().split('T')[0];
  return isRtl ? `${title}_${monthName}_${date}.pdf` : `${title}_${monthName}_${date}.pdf`;
};

const generatePDFHeader = (
  doc: jsPDF,
  isRtl: boolean,
  title: string,
  monthName: string,
  totalItems: number,
  totalQuantity: number,
  totalPrice: number,
  fontName: string,
  fontLoaded: boolean
) => {
  doc.setFont(fontLoaded ? fontName : 'helvetica', 'normal');
  doc.setFontSize(18);
  doc.setTextColor(33, 33, 33);
  const pageWidth = doc.internal.pageSize.width;
  doc.text(isRtl ? title : title, isRtl ? pageWidth - 20 : 20, 12, { align: isRtl ? 'right' : 'left' });
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  const stats = isRtl
    ? `إجمالي المنتجات: ${toArabicNumerals(totalItems)} | إجمالي الكمية: ${toArabicNumerals(totalQuantity)} وحدة | إجمالي المبلغ: ${formatPrice(totalPrice, isRtl, true)}`
    : `Total Products: ${totalItems} | Total Quantity: ${totalQuantity} units | Total Amount: ${formatPrice(totalPrice, isRtl, true)}`;
  doc.text(stats, isRtl ? pageWidth - 20 : 20, 20, { align: isRtl ? 'right' : 'left' });
  doc.setLineWidth(0.5);
  doc.setDrawColor(255, 193, 7);
  doc.line(20, 25, pageWidth - 20, 25);
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
    doc.text(footerText, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
  }
};

const generatePDFTable = (
  doc: jsPDF,
  headers: string[],
  data: any[],
  isRtl: boolean,
  fontLoaded: boolean,
  fontName: string,
  allBranches: string[] = []
) => {
  const tableColumnWidths = headers.map((_, index) => {
    if (index === 0) return 10; // No.
    if (index === 1) return 25; // Code
    if (index === 2) return 45; // Product
    if (index === 3) return 25; // Unit
    if (index >= 4 && index < headers.length - 2 && allBranches.length > 0) return 20; // Branch Quantities
    if (index >= 4 && allBranches.length === 0) return 15; // Daily Changes
    return 30; // Total Quantity, Total Price
  });

  autoTable(doc, {
    head: [isRtl ? headers.slice().reverse() : headers],
    body: isRtl ? data.map(row => row.slice().reverse()) : data,
    theme: 'grid',
    startY: 30,
    margin: { top: 10, bottom: 10, left: 10, right: 10 },
    tableWidth: 'wrap',
    columnStyles: Object.fromEntries(
      headers.map((_, i) => [i, { cellWidth: tableColumnWidths[i], halign: 'center' }])
    ),
    headStyles: {
      fillColor: [255, 193, 7],
      textColor: [33, 33, 33],
      fontSize: 10,
      halign: 'center',
      font: fontLoaded ? fontName : 'helvetica',
      fontStyle: 'bold',
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize: 9,
      halign: 'center',
      font: fontLoaded ? fontName : 'helvetica',
      textColor: [33, 33, 33],
      lineColor: [200, 200, 200],
      fillColor: [255, 255, 255],
      cellPadding: 3,
    },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    didParseCell: (data) => {
      if (data.section === 'body' && (data.column.index === (isRtl ? 0 : headers.length - 1))) {
        data.cell.styles.fontStyle = 'bold';
      }
      if (isRtl) {
        data.cell.text = data.cell.text.map(text => String(text).replace(/[0-9]/g, d => toArabicNumerals(d)));
      }
    },
    didDrawPage: () => {
      doc.setFont(fontLoaded ? fontName : 'helvetica', 'normal');
    },
  });
};

const exportToPDF = async (
  data: any[],
  title: string,
  monthName: string,
  headers: string[],
  isRtl: boolean,
  totalItems: number,
  totalQuantity: number,
  totalPrice: number,
  allBranches: string[] = []
) => {
  try {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const fontName = 'Amiri';
    const fontLoaded = await loadFont(doc);
    generatePDFHeader(doc, isRtl, title, monthName, totalItems, totalQuantity, totalPrice, fontName, fontLoaded);
    generatePDFTable(doc, headers, data, isRtl, fontLoaded, fontName, allBranches);
    const fileName = generateFileName(title, monthName, isRtl);
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

const ProductionReport: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<{ [month: number]: OrderRow[] }>({});
  const [stockInData, setStockInData] = useState<{ [month: number]: StockRow[] }>({});
  const [stockOutData, setStockOutData] = useState<{ [month: number]: StockRow[] }>({});
  const [returnData, setReturnData] = useState<{ [month: number]: ReturnRow[] }>({});
  const [salesData, setSalesData] = useState<{ [month: number]: OrderRow[] }>({});
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(8); // September 2025
  const [activeTab, setActiveTab] = useState<'orders' | 'stockIn' | 'stockOut' | 'returns' | 'sales'>('orders');
  const currentDate = new Date('2025-10-13T00:34:00+03:00');
  const currentYear = currentDate.getFullYear();
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        value: i,
        label: new Date(currentYear, i).toLocaleString(language, { month: 'long' }),
      })),
    [currentYear, language]
  );

  const getDaysInMonth = useCallback((month: number) => {
    const daysInMonthCount = new Date(currentYear, month + 1, 0).getDate();
    return Array.from({ length: daysInMonthCount }, (_, i) => {
      const date = new Date(currentYear, month, i + 1);
      return date.toLocaleString(language, { day: 'numeric', month: 'short' });
    });
  }, [currentYear, language]);

  const daysInMonth = useMemo(() => getDaysInMonth(selectedMonth), [selectedMonth, getDaysInMonth]);

  const allBranches = useMemo(() => {
    return branches.map(b => b.displayName).sort();
  }, [branches]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [inventory, ordersResponse, branchesResponse, salesResponse] = await Promise.all([
          inventoryAPI.getInventory({}, isRtl),
          ordersAPI.getAll({ status: 'completed', page: 1, limit: 1000 }, isRtl),
          branchesAPI.getAll(),
          salesAPI.getAnalytics({
            startDate: new Date(currentYear, selectedMonth, 1).toISOString(),
            endDate: new Date(currentYear, selectedMonth + 1, 0).toISOString(),
            lang: language,
          }),
        ]);

        const monthlyOrderData: { [month: number]: OrderRow[] } = {};
        const monthlyStockInData: { [month: number]: StockRow[] } = {};
        const monthlyStockOutData: { [month: number]: StockRow[] } = {};
        const monthlyReturnData: { [month: number]: ReturnRow[] } = {};
        const monthlySalesData: { [month: number]: OrderRow[] } = {};

        const fetchedBranches = branchesResponse
          .filter((branch: any) => branch && branch._id)
          .map((branch: any) => ({
            _id: branch._id,
            name: branch.name || (isRtl ? 'غير معروف' : 'Unknown'),
            nameEn: branch.nameEn || branch.name,
            displayName: isRtl ? branch.name : branch.nameEn || branch.name,
          }))
          .sort((a: Branch, b: Branch) => a.displayName.localeCompare(b.displayName, language));
        setBranches(fetchedBranches);

        const productDetails = new Map<
          string,
          { code: string; product: string; productEn: string; unit: string; unitEn: string; price: number }
        >();
        inventory.forEach((item: any) => {
          if (item.product?._id) {
            productDetails.set(item.product._id, {
              code: item.product._id,
              product: item.product.name || (isRtl ? 'منتج غير معروف' : 'Unknown Product'),
              productEn: item.product.nameEn || item.product.name || 'Unknown Product',
              unit: item.product.unit || 'unit',
              unitEn: item.product.unitEn || item.product.unit || 'unit',
              price: Number(item.product.price) || 0,
            });
          }
        });

        let orders = Array.isArray(ordersResponse) ? ordersResponse : [];
        if (orders.length === 0) {
          orders = inventory.flatMap((item: any) => {
            const details = productDetails.get(item.product?._id) || {
              code: item.product?._id || `code-${Math.random().toString(36).substring(2)}`,
              product: item.product?.name || (isRtl ? 'منتج غير معروف' : 'Unknown Product'),
              productEn: item.product?.nameEn || item.product?.name || 'Unknown Product',
              unit: item.product?.unit || 'unit',
              unitEn: item.product?.unitEn || item.product?.unit || 'unit',
              price: Number(item.product?.price) || 0,
            };
            return (item.movements || []).map((movement: any) => ({
              status: 'completed',
              createdAt: movement.createdAt,
              branch: {
                displayName:
                  fetchedBranches[Math.floor(Math.random() * fetchedBranches.length)]?.displayName ||
                  (isRtl ? 'الفرع الرئيسي' : 'Main Branch'),
              },
              items: [
                {
                  productId: item.product?._id,
                  quantity: Math.abs(movement.quantity),
                  price: details.price,
                  unit: isRtl ? details.unit : details.unitEn,
                  sales: Math.abs(movement.quantity) * details.price * 0.1,
                },
              ],
            }));
          });
        }

        for (let month = 0; month < 12; month++) {
          const daysInMonthCount = new Date(currentYear, month + 1, 0).getDate();
          const orderMap = new Map<string, OrderRow>();
          const stockInMap = new Map<string, StockRow>();
          const stockOutMap = new Map<string, StockRow>();
          const returnMap = new Map<string, ReturnRow>();
          const salesMap = new Map<string, OrderRow>();

          orders.forEach((order: any) => {
            if ((order.status || order.orderStatus) !== 'completed') return;
            const date = new Date(order.createdAt || order.date);
            if (isNaN(date.getTime())) return;
            const orderMonth = date.getMonth();
            const year = date.getFullYear();
            if (year !== currentYear || orderMonth !== month) return;

            const branch =
              order.branch?.displayName ||
              order.branch?.name ||
              order.branchId ||
              (isRtl ? 'الفرع الرئيسي' : 'Main Branch');

            (order.items || []).forEach((item: any) => {
              const productId = item.product?._id || item.productId;
              const details = productDetails.get(productId) || {
                code: productId || `code-${Math.random().toString(36).substring(2)}`,
                product: item.product?.name || (isRtl ? 'منتج غير معروف' : 'Unknown Product'),
                productEn: item.product?.nameEn || item.product?.name || 'Unknown Product',
                unit: item.unit || 'unit',
                unitEn: item.unitEn || item.unit || 'unit',
                price: Number(item.price) || 0,
              };
              const key = `${productId}-${month}`;
              if (!orderMap.has(key)) {
                orderMap.set(key, {
                  id: key,
                  code: details.code,
                  product: isRtl ? details.product : details.productEn,
                  unit: isRtl ? details.unit : details.unitEn,
                  branchQuantities: {},
                  totalQuantity: 0,
                  totalPrice: 0,
                  sales: 0,
                  actualSales: 0,
                  movements: [],
                });
              }
              const row = orderMap.get(key)!;
              const quantity = Number(item.quantity) || 0;
              row.branchQuantities[branch] = (row.branchQuantities[branch] || 0) + quantity;
              row.totalQuantity += quantity;
              row.totalPrice += quantity * details.price;
              row.sales += quantity * details.price * 0.1;
              row.movements.push({
                type: 'order',
                quantity,
                date: date.toISOString(),
                branch,
              });
            });
          });

          for (const row of orderMap.values()) {
            const salesItem = salesResponse.productSales?.find((s: any) => s.productId === row.code);
            if (salesItem) {
              row.actualSales = salesItem.totalQuantity || 0;
            }
          }

          inventory.forEach((item: any) => {
            const productId = item.product?._id;
            const details = productDetails.get(productId) || {
              code: productId || `code-${Math.random().toString(36).substring(2)}`,
              product: item.product?.name || (isRtl ? 'منتج غير معروف' : 'Unknown Product'),
              productEn: item.product?.nameEn || item.product?.name || 'Unknown Product',
              unit: item.product?.unit || 'unit',
              unitEn: item.product?.unitEn || item.product?.unit || 'unit',
              price: Number(item.product?.price) || 0,
            };
            (item.movements || []).forEach((movement: any) => {
              const date = new Date(movement.createdAt);
              if (isNaN(date.getTime())) return;
              const prodMonth = date.getMonth();
              const year = date.getFullYear();
              if (year !== currentYear || prodMonth !== month) return;

              const day = date.getDate();
              const key = `${productId}-${month}`;
              const quantity = Number(movement.quantity) || 0;
              const branch = movement.branch || (isRtl ? 'الفرع الرئيسي' : 'Main Branch');

              if (movement.type === 'in') {
                if (!stockInMap.has(key)) {
                  stockInMap.set(key, {
                    id: key,
                    code: details.code,
                    product: isRtl ? details.product : details.productEn,
                    unit: isRtl ? details.unit : details.unitEn,
                    totalQuantity: 0,
                    dailyChanges: Array(daysInMonthCount).fill(0),
                    totalPrice: 0,
                    movements: [],
                  });
                }
                const row = stockInMap.get(key)!;
                row.dailyChanges[day - 1] += quantity;
                row.totalQuantity += quantity;
                row.totalPrice += quantity * details.price;
                row.movements.push({
                  type: 'in',
                  quantity,
                  date: date.toISOString(),
                  branch,
                });
              } else if (movement.type === 'out' || movement.quantity < 0) {
                const isReturn = movement.quantity < 0;
                if (!stockOutMap.has(key)) {
                  stockOutMap.set(key, {
                    id: key,
                    code: details.code,
                    product: isRtl ? details.product : details.productEn,
                    unit: isRtl ? details.unit : details.unitEn,
                    totalQuantity: 0,
                    dailyChanges: Array(daysInMonthCount).fill(0),
                    totalPrice: 0,
                    movements: [],
                  });
                }
                const row = stockOutMap.get(key)!;
                const absQuantity = Math.abs(quantity);
                row.dailyChanges[day - 1] += absQuantity;
                row.totalQuantity += absQuantity;
                row.totalPrice += absQuantity * details.price;
                row.movements.push({
                  type: isReturn ? 'return' : 'out',
                  quantity: absQuantity,
                  date: date.toISOString(),
                  branch,
                });

                if (isReturn) {
                  if (!returnMap.has(key)) {
                    returnMap.set(key, {
                      id: key,
                      code: details.code,
                      product: isRtl ? details.product : details.productEn,
                      unit: isRtl ? details.unit : details.unitEn,
                      totalReturns: 0,
                      dailyReturns: Array(daysInMonthCount).fill(0),
                      totalValue: 0,
                      movements: [],
                    });
                  }
                  const returnRow = returnMap.get(key)!;
                  returnRow.dailyReturns[day - 1] += absQuantity;
                  returnRow.totalReturns += absQuantity;
                  returnRow.totalValue += absQuantity * details.price;
                  returnRow.movements.push({
                    type: 'return',
                    quantity: absQuantity,
                    date: date.toISOString(),
                    branch,
                  });
                }
              }
            });
          });

          salesResponse.productSales?.forEach((s: any) => {
            const productId = s.productId;
            const details = productDetails.get(productId) || {
              code: productId,
              product: s.productName || (isRtl ? 'منتج غير معروف' : 'Unknown Product'),
              productEn: s.productNameEn || s.productName || 'Unknown Product',
              unit: s.unit || 'unit',
              unitEn: s.unitEn || s.unit || 'unit',
              price: s.totalRevenue / (s.totalQuantity || 1) || 0,
            };
            const key = `${productId}-${month}`;
            if (!salesMap.has(key)) {
              salesMap.set(key, {
                id: key,
                code: details.code,
                product: isRtl ? details.product : details.productEn,
                unit: isRtl ? details.unit : details.unitEn,
                branchQuantities: {},
                totalQuantity: s.totalQuantity || 0,
                totalPrice: s.totalRevenue || 0,
                sales: s.totalRevenue * 0.1,
                actualSales: s.totalQuantity || 0,
                movements: [],
              });
            }
            const row = salesMap.get(key)!;
            row.movements.push({
              type: 'sale',
              quantity: s.totalQuantity || 0,
              date: new Date(s.date || currentDate).toISOString(),
              branch: s.branch || (isRtl ? 'الفرع الرئيسي' : 'Main Branch'),
            });
          });

          monthlyOrderData[month] = Array.from(orderMap.values());
          monthlyStockInData[month] = Array.from(stockInMap.values());
          monthlyStockOutData[month] = Array.from(stockOutMap.values());
          monthlyReturnData[month] = Array.from(returnMap.values());
          monthlySalesData[month] = Array.from(salesMap.values());
        }

        setOrderData(monthlyOrderData);
        setStockInData(monthlyStockInData);
        setStockOutData(monthlyStockOutData);
        setReturnData(monthlyReturnData);
        setSalesData(monthlySalesData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast.error(isRtl ? 'فشل في جلب البيانات' : 'Failed to fetch data', {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isRtl, currentYear, selectedMonth, language]);

  const getMovementTooltip = (
    movements: { type: string; quantity: number; date: string; branch: string }[],
    dayIndex: number,
    isRtl: boolean
  ) => {
    const relevantMovements = movements.filter(m => {
      const date = new Date(m.date);
      return date.getDate() === dayIndex + 1;
    });
    if (!relevantMovements.length) return isRtl ? 'لا توجد حركات' : 'No movements';
    return relevantMovements
      .map(m => {
        const typeText = isRtl
          ? m.type === 'order'
            ? 'طلب'
            : m.type === 'sale'
            ? 'مبيعة'
            : m.type === 'return'
            ? 'مرتجع'
            : m.type === 'in'
            ? 'إضافة مخزون'
            : 'نقصان مخزون'
          : m.type;
        return `${typeText}: ${formatNumber(m.quantity, isRtl)} (${m.branch}, ${new Date(m.date).toLocaleTimeString(
          isRtl ? 'ar-SA' : 'en-US'
        )})`;
      })
      .join('\n');
  };

  const renderOrderTable = useCallback(
    (data: OrderRow[], title: string, month: number) => {
      const totalQuantities = allBranches.reduce((acc, branch) => {
        acc[branch] = data.reduce((sum, row) => sum + (row.branchQuantities[branch] || 0), 0);
        return acc;
      }, {} as { [branch: string]: number });
      const grandTotalQuantity = data.reduce((sum, row) => sum + row.totalQuantity, 0);
      const grandTotalPrice = data.reduce((sum, row) => sum + row.totalPrice, 0);
      const grandActualSales = data.reduce((sum, row) => sum + row.actualSales, 0);
      const monthName = months[month].label;

      const exportTable = (format: 'excel' | 'pdf') => {
        const headers = [
          isRtl ? 'رقم' : 'No.',
          isRtl ? 'الكود' : 'Code',
          isRtl ? 'المنتج' : 'Product',
          isRtl ? 'وحدة المنتج' : 'Product Unit',
          ...allBranches,
          isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
          isRtl ? 'المبيعات الفعلية' : 'Actual Sales',
          isRtl ? 'السعر الإجمالي' : 'Total Price',
        ];
        const rows = [
          ...data.map((row, index) => ({
            no: index + 1,
            code: row.code,
            product: row.product,
            unit: row.unit,
            ...Object.fromEntries(allBranches.map(branch => [branch, row.branchQuantities[branch] || 0])),
            totalQuantity: row.totalQuantity,
            actualSales: row.actualSales,
            totalPrice: formatPrice(row.totalPrice, isRtl),
          })),
          {
            no: '',
            code: '',
            product: isRtl ? 'الإجمالي' : 'Total',
            unit: '',
            ...Object.fromEntries(allBranches.map(branch => [branch, totalQuantities[branch] || 0])),
            totalQuantity: grandTotalQuantity,
            actualSales: grandActualSales,
            totalPrice: formatPrice(grandTotalPrice, isRtl),
          },
        ];
        const dataRows = rows.map(row => [
          row.no,
          row.code,
          row.product,
          row.unit,
          ...allBranches.map(branch => row[branch]),
          row.totalQuantity,
          row.actualSales,
          row.totalPrice,
        ]);

        if (format === 'excel') {
          const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows, {
            header: headers,
          });
          if (isRtl) ws['!views'] = [{ RTL: true }];
          ws['!cols'] = [
            { wch: 10 },
            { wch: 15 },
            { wch: 25 },
            { wch: 15 },
            ...allBranches.map(() => ({ wch: 15 })),
            { wch: 15 },
            { wch: 15 },
            { wch: 15 },
          ];
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, `${title}_${monthName}`);
          XLSX.writeFile(wb, `${title}_${monthName}.xlsx`);
          toast.success(isRtl ? 'تم تصدير ملف Excel بنجاح' : 'Excel exported successfully', {
            position: isRtl ? 'top-left' : 'top-right',
            autoClose: 3000,
          });
        } else if (format === 'pdf') {
          exportToPDF(dataRows, title, monthName, headers, isRtl, data.length, grandTotalQuantity, grandTotalPrice, allBranches);
        }
      };

      if (loading) return <OrderTableSkeleton isRtl={isRtl} />;

      if (data.length === 0) {
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-center py-12 bg-white shadow-md rounded-xl border border-gray-200"
          >
            <p className="text-gray-500 text-sm font-medium">{isRtl ? 'لا توجد بيانات' : 'No data available'}</p>
          </motion.div>
        );
      }

      return (
        <div className="mb-8">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h2 className="text-lg font-semibold text-gray-800">{isRtl ? `${title} - ${monthName}` : `${title} - ${monthName}`}</h2>
            <div className="flex gap-2">
              <Button
                variant={data.length > 0 ? 'primary' : 'secondary'}
                onClick={data.length > 0 ? () => exportTable('excel') : undefined}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 ${
                  data.length > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
                disabled={data.length === 0}
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير إكسل' : 'Export Excel'}
              </Button>
              <Button
                variant={data.length > 0 ? 'primary' : 'secondary'}
                onClick={data.length > 0 ? () => exportTable('pdf') : undefined}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 ${
                  data.length > 0 ? 'bg-green-600 hover:bg-green-700 text-white shadow-sm' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
                disabled={data.length === 0}
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير PDF' : 'Export PDF'}
              </Button>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-x-auto rounded-xl shadow-md border border-gray-200 bg-white"
          >
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-blue-100 sticky top-0">
                <tr className={isRtl ? 'flex-row-reverse' : ''}>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[40px]">{isRtl ? 'رقم' : 'No.'}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'الكود' : 'Code'}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[120px]">{isRtl ? 'المنتج' : 'Product'}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'وحدة المنتج' : 'Product Unit'}</th>
                  {allBranches.map(branch => (
                    <th key={branch} className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                      {branch}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'المبيعات الفعلية' : 'Actual Sales'}
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'السعر الإجمالي' : 'Total Price'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.map((row, index) => (
                  <tr key={row.id} className={`hover:bg-blue-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <td className="px-4 py-3 text-gray-700 text-center">{formatNumber(index + 1, isRtl)}</td>
                    <td className="px-4 py-3 text-gray-700 text-center truncate">{row.code}</td>
                    <td className="px-4 py-3 text-gray-700 text-center truncate">{row.product}</td>
                    <td className="px-4 py-3 text-gray-700 text-center truncate">{row.unit}</td>
                    {allBranches.map(branch => (
                      <td
                        key={branch}
                        className={`px-4 py-3 text-center font-medium ${
                          row.branchQuantities[branch] > 0
                            ? 'text-green-700'
                            : row.branchQuantities[branch] < 0
                            ? 'text-red-700'
                            : 'text-gray-700'
                        }`}
                        title={getMovementTooltip(row.movements, index, isRtl)}
                      >
                        {formatNumber(row.branchQuantities[branch] || 0, isRtl)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalQuantity, isRtl)}</td>
                    <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.actualSales, isRtl)}</td>
                    <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatPrice(row.totalPrice, isRtl)}</td>
                  </tr>
                ))}
                <tr className={`font-semibold bg-gray-100 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-4 py-3 text-gray-800 text-center" colSpan={2}></td>
                  <td className="px-4 py-3 text-gray-800 text-center">{isRtl ? 'الإجمالي' : 'Total'}</td>
                  <td className="px-4 py-3 text-gray-800 text-center"></td>
                  {allBranches.map(branch => (
                    <td key={branch} className="px-4 py-3 text-gray-800 text-center">
                      {formatNumber(totalQuantities[branch] || 0, isRtl)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalQuantity, isRtl)}</td>
                  <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandActualSales, isRtl)}</td>
                  <td className="px-4 py-3 text-gray-800 text-center">{formatPrice(grandTotalPrice, isRtl)}</td>
                </tr>
              </tbody>
            </table>
          </motion.div>
        </div>
      );
    },
    [loading, isRtl, allBranches, months]
  );

  const renderStockTable = useCallback(
    (data: StockRow[], title: string, month: number, isIn: boolean) => {
      const grandTotalQuantity = data.reduce((sum, row) => sum + row.totalQuantity, 0);
      const grandTotalPrice = data.reduce((sum, row) => sum + row.totalPrice, 0);
      const monthName = months[month].label;

      const exportTable = (format: 'excel' | 'pdf') => {
        const headers = [
          isRtl ? 'رقم' : 'No.',
          isRtl ? 'الكود' : 'Code',
          isRtl ? 'المنتج' : 'Product',
          isRtl ? 'وحدة المنتج' : 'Product Unit',
          ...daysInMonth,
          isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
          isRtl ? 'السعر الإجمالي' : 'Total Price',
        ];
        const rows = [
          ...data.map((row, index) => ({
            no: index + 1,
            code: row.code,
            product: row.product,
            unit: row.unit,
            ...Object.fromEntries(row.dailyChanges.map((qty, i) => [daysInMonth[i], qty])),
            totalQuantity: row.totalQuantity,
            totalPrice: formatPrice(row.totalPrice, isRtl),
          })),
          {
            no: '',
            code: '',
            product: isRtl ? 'الإجمالي' : 'Total',
            unit: '',
            ...Object.fromEntries(daysInMonth.map((_, i) => [daysInMonth[i], data.reduce((sum, row) => sum + row.dailyChanges[i], 0)])),
            totalQuantity: grandTotalQuantity,
            totalPrice: formatPrice(grandTotalPrice, isRtl),
          },
        ];
        const dataRows = rows.map(row => [
          row.no,
          row.code,
          row.product,
          row.unit,
          ...daysInMonth.map(day => row[day]),
          row.totalQuantity,
          row.totalPrice,
        ]);

        if (format === 'excel') {
          const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows, {
            header: headers,
          });
          if (isRtl) ws['!views'] = [{ RTL: true }];
          ws['!cols'] = [{ wch: 10 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, ...daysInMonth.map(() => ({ wch: 12 })), { wch: 15 }, { wch: 15 }];
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, `${title}_${monthName}`);
          XLSX.writeFile(wb, `${title}_${monthName}.xlsx`);
          toast.success(isRtl ? 'تم تصدير ملف Excel بنجاح' : 'Excel exported successfully', {
            position: isRtl ? 'top-left' : 'top-right',
            autoClose: 3000,
          });
        } else if (format === 'pdf') {
          exportToPDF(dataRows, title, monthName, headers, isRtl, data.length, grandTotalQuantity, grandTotalPrice);
        }
      };

      if (loading) return <OrderTableSkeleton isRtl={isRtl} />;

      if (data.length === 0) {
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-center py-12 bg-white shadow-md rounded-xl border border-gray-200"
          >
            <p className="text-gray-500 text-sm font-medium">{isRtl ? 'لا توجد بيانات' : 'No data available'}</p>
          </motion.div>
        );
      }

      return (
        <div className="mb-8">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h2 className="text-lg font-semibold text-gray-800">{isRtl ? `${title} - ${monthName}` : `${title} - ${monthName}`}</h2>
            <div className="flex gap-2">
              <Button
                variant={data.length > 0 ? 'primary' : 'secondary'}
                onClick={data.length > 0 ? () => exportTable('excel') : undefined}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 ${
                  data.length > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
                disabled={data.length === 0}
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير إكسل' : 'Export Excel'}
              </Button>
              <Button
                variant={data.length > 0 ? 'primary' : 'secondary'}
                onClick={data.length > 0 ? () => exportTable('pdf') : undefined}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 ${
                  data.length > 0 ? 'bg-green-600 hover:bg-green-700 text-white shadow-sm' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
                disabled={data.length === 0}
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير PDF' : 'Export PDF'}
              </Button>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-x-auto rounded-xl shadow-md border border-gray-200 bg-white"
          >
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-blue-100 sticky top-0">
                <tr className={isRtl ? 'flex-row-reverse' : ''}>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[40px]">{isRtl ? 'رقم' : 'No.'}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'الكود' : 'Code'}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[120px]">{isRtl ? 'المنتج' : 'Product'}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'وحدة المنتج' : 'Product Unit'}</th>
                  {daysInMonth.map((day, i) => (
                    <th key={i} className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">
                      {day}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'السعر الإجمالي' : 'Total Price'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.map((row, index) => (
                  <tr key={row.id} className={`hover:bg-blue-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <td className="px-4 py-3 text-gray-700 text-center">{formatNumber(index + 1, isRtl)}</td>
                    <td className="px-4 py-3 text-gray-700 text-center truncate">{row.code}</td>
                    <td className="px-4 py-3 text-gray-700 text-center truncate">{row.product}</td>
                    <td className="px-4 py-3 text-gray-700 text-center truncate">{row.unit}</td>
                    {row.dailyChanges.map((chg, i) => {
                      const color = isIn ? 'text-green-700' : 'text-red-700';
                      const sign = chg > 0 ? '+' : '';
                      return (
                        <td
                          key={i}
                          className={`px-4 py-3 text-center font-medium ${color}`}
                          title={getMovementTooltip(row.movements, i, isRtl)}
                        >
                          {chg !== 0 ? `${sign}${formatNumber(chg, isRtl)}` : '0'}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalQuantity, isRtl)}</td>
                    <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatPrice(row.totalPrice, isRtl)}</td>
                  </tr>
                ))}
                <tr className={`font-semibold bg-gray-100 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-4 py-3 text-gray-800 text-center" colSpan={4}>
                    {isRtl ? 'الإجمالي' : 'Total'}
                  </td>
                  {daysInMonth.map((_, i) => (
                    <td key={i} className="px-4 py-3 text-gray-800 text-center">
                      {formatNumber(data.reduce((sum, row) => sum + row.dailyChanges[i], 0), isRtl)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalQuantity, isRtl)}</td>
                  <td className="px-4 py-3 text-gray-800 text-center">{formatPrice(grandTotalPrice, isRtl)}</td>
                </tr>
              </tbody>
            </table>
          </motion.div>
        </div>
      );
    },
    [loading, isRtl, daysInMonth, months]
  );

  const renderReturnTable = useCallback(
    (data: ReturnRow[], title: string, month: number) => {
      const grandTotalReturns = data.reduce((sum, row) => sum + row.totalReturns, 0);
      const grandTotalValue = data.reduce((sum, row) => sum + row.totalValue, 0);
      const monthName = months[month].label;

      const exportTable = (format: 'excel' | 'pdf') => {
        const headers = [
          isRtl ? 'رقم' : 'No.',
          isRtl ? 'الكود' : 'Code',
          isRtl ? 'المنتج' : 'Product',
          isRtl ? 'وحدة المنتج' : 'Product Unit',
          ...daysInMonth,
          isRtl ? 'إجمالي المرتجعات' : 'Total Returns',
          isRtl ? 'القيمة الإجمالية' : 'Total Value',
        ];
        const rows = [
          ...data.map((row, index) => ({
            no: index + 1,
            code: row.code,
            product: row.product,
            unit: row.unit,
            ...Object.fromEntries(row.dailyReturns.map((qty, i) => [daysInMonth[i], qty])),
            totalReturns: row.totalReturns,
            totalValue: formatPrice(row.totalValue, isRtl),
          })),
          {
            no: '',
            code: '',
            product: isRtl ? 'الإجمالي' : 'Total',
            unit: '',
            ...Object.fromEntries(daysInMonth.map((_, i) => [daysInMonth[i], data.reduce((sum, row) => sum + row.dailyReturns[i], 0)])),
            totalReturns: grandTotalReturns,
            totalValue: formatPrice(grandTotalValue, isRtl),
          },
        ];
        const dataRows = rows.map(row => [
          row.no,
          row.code,
          row.product,
          row.unit,
          ...daysInMonth.map(day => row[day]),
          row.totalReturns,
          row.totalValue,
        ]);

        if (format === 'excel') {
          const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows, {
            header: headers,
          });
          if (isRtl) ws['!views'] = [{ RTL: true }];
          ws['!cols'] = [{ wch: 10 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, ...daysInMonth.map(() => ({ wch: 12 })), { wch: 15 }, { wch: 15 }];
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, `${title}_${monthName}`);
          XLSX.writeFile(wb, `${title}_${monthName}.xlsx`);
          toast.success(isRtl ? 'تم تصدير ملف Excel بنجاح' : 'Excel exported successfully', {
            position: isRtl ? 'top-left' : 'top-right',
            autoClose: 3000,
          });
        } else if (format === 'pdf') {
          exportToPDF(dataRows, title, monthName, headers, isRtl, data.length, grandTotalReturns, grandTotalValue);
        }
      };

      if (loading) return <OrderTableSkeleton isRtl={isRtl} />;

      if (data.length === 0) {
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-center py-12 bg-white shadow-md rounded-xl border border-gray-200"
          >
            <p className="text-gray-500 text-sm font-medium">{isRtl ? 'لا توجد بيانات مرتجعات' : 'No return data available'}</p>
          </motion.div>
        );
      }

      return (
        <div className="mb-8">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h2 className="text-lg font-semibold text-gray-800">{isRtl ? `${title} - ${monthName}` : `${title} - ${monthName}`}</h2>
            <div className="flex gap-2">
              <Button
                variant={data.length > 0 ? 'primary' : 'secondary'}
                onClick={data.length > 0 ? () => exportTable('excel') : undefined}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 ${
                  data.length > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
                disabled={data.length === 0}
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير إكسل' : 'Export Excel'}
              </Button>
              <Button
                variant={data.length > 0 ? 'primary' : 'secondary'}
                onClick={data.length > 0 ? () => exportTable('pdf') : undefined}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 ${
                  data.length > 0 ? 'bg-green-600 hover:bg-green-700 text-white shadow-sm' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
                disabled={data.length === 0}
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير PDF' : 'Export PDF'}
              </Button>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-x-auto rounded-xl shadow-md border border-gray-200 bg-white"
          >
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-blue-100 sticky top-0">
                <tr className={isRtl ? 'flex-row-reverse' : ''}>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[40px]">{isRtl ? 'رقم' : 'No.'}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'الكود' : 'Code'}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[120px]">{isRtl ? 'المنتج' : 'Product'}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'وحدة المنتج' : 'Product Unit'}</th>
                  {daysInMonth.map((day, i) => (
                    <th key={i} className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">
                      {day}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'إجمالي المرتجعات' : 'Total Returns'}
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'القيمة الإجمالية' : 'Total Value'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.map((row, index) => (
                  <tr key={row.id} className={`hover:bg-blue-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <td className="px-4 py-3 text-gray-700 text-center">{formatNumber(index + 1, isRtl)}</td>
                    <td className="px-4 py-3 text-gray-700 text-center truncate">{row.code}</td>
                    <td className="px-4 py-3 text-gray-700 text-center truncate">{row.product}</td>
                    <td className="px-4 py-3 text-gray-700 text-center truncate">{row.unit}</td>
                    {row.dailyReturns.map((qty, i) => (
                      <td
                        key={i}
                        className="px-4 py-3 text-center font-medium text-red-700"
                        title={getMovementTooltip(row.movements, i, isRtl)}
                      >
                        {formatNumber(qty, isRtl)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalReturns, isRtl)}</td>
                    <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatPrice(row.totalValue, isRtl)}</td>
                  </tr>
                ))}
                <tr className={`font-semibold bg-gray-100 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-4 py-3 text-gray-800 text-center" colSpan={4}>
                    {isRtl ? 'الإجمالي' : 'Total'}
                  </td>
                  {daysInMonth.map((_, i) => (
                    <td key={i} className="px-4 py-3 text-gray-800 text-center">
                      {formatNumber(data.reduce((sum, row) => sum + row.dailyReturns[i], 0), isRtl)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalReturns, isRtl)}</td>
                  <td className="px-4 py-3 text-gray-800 text-center">{formatPrice(grandTotalValue, isRtl)}</td>
                </tr>
              </tbody>
            </table>
          </motion.div>
        </div>
      );
    },
    [loading, isRtl, daysInMonth, months]
  );

  const renderSalesTable = useCallback(
    (data: OrderRow[], title: string, month: number) => {
      const totalQuantities = allBranches.reduce((acc, branch) => {
        acc[branch] = data.reduce((sum, row) => sum + (row.branchQuantities[branch] || 0), 0);
        return acc;
      }, {} as { [branch: string]: number });
      const grandTotalQuantity = data.reduce((sum, row) => sum + row.actualSales, 0);
      const grandTotalPrice = data.reduce((sum, row) => sum + row.totalPrice, 0);
      const grandActualSales = data.reduce((sum, row) => sum + row.actualSales, 0);
      const monthName = months[month].label;

      const exportTable = (format: 'excel' | 'pdf') => {
        const headers = [
          isRtl ? 'رقم' : 'No.',
          isRtl ? 'الكود' : 'Code',
          isRtl ? 'المنتج' : 'Product',
          isRtl ? 'وحدة المنتج' : 'Product Unit',
          ...allBranches,
          isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
          isRtl ? 'المبيعات الفعلية' : 'Actual Sales',
          isRtl ? 'السعر الإجمالي' : 'Total Price',
        ];
        const rows = [
          ...data.map((row, index) => ({
            no: index + 1,
            code: row.code,
            product: row.product,
            unit: row.unit,
            ...Object.fromEntries(allBranches.map(branch => [branch, row.branchQuantities[branch] || 0])),
            totalQuantity: row.actualSales,
            actualSales: row.actualSales,
            totalPrice: formatPrice(row.totalPrice, isRtl),
          })),
          {
            no: '',
            code: '',
            product: isRtl ? 'الإجمالي' : 'Total',
            unit: '',
            ...Object.fromEntries(allBranches.map(branch => [branch, totalQuantities[branch] || 0])),
            totalQuantity: grandTotalQuantity,
            actualSales: grandActualSales,
            totalPrice: formatPrice(grandTotalPrice, isRtl),
          },
        ];
        const dataRows = rows.map(row => [
          row.no,
          row.code,
          row.product,
          row.unit,
          ...allBranches.map(branch => row[branch]),
          row.totalQuantity,
          row.actualSales,
          row.totalPrice,
        ]);

        if (format === 'excel') {
          const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows, {
            header: headers,
          });
          if (isRtl) ws['!views'] = [{ RTL: true }];
          ws['!cols'] = [
            { wch: 10 },
            { wch: 15 },
            { wch: 25 },
            { wch: 15 },
            ...allBranches.map(() => ({ wch: 15 })),
            { wch: 15 },
            { wch: 15 },
            { wch: 15 },
          ];
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, `${title}_${monthName}`);
          XLSX.writeFile(wb, `${title}_${monthName}.xlsx`);
          toast.success(isRtl ? 'تم تصدير ملف Excel بنجاح' : 'Excel exported successfully', {
            position: isRtl ? 'top-left' : 'top-right',
            autoClose: 3000,
          });
        } else if (format === 'pdf') {
          exportToPDF(dataRows, title, monthName, headers, isRtl, data.length, grandTotalQuantity, grandTotalPrice, allBranches);
        }
      };

      if (loading) return <OrderTableSkeleton isRtl={isRtl} />;

      if (data.length === 0) {
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-center py-12 bg-white shadow-md rounded-xl border border-gray-200"
          >
            <p className="text-gray-500 text-sm font-medium">{isRtl ? 'لا توجد بيانات مبيعات' : 'No sales data available'}</p>
          </motion.div>
        );
      }

      return (
        <div className="mb-8">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h2 className="text-lg font-semibold text-gray-800">{isRtl ? `${title} - ${monthName}` : `${title} - ${monthName}`}</h2>
            <div className="flex gap-2">
              <Button
                variant={data.length > 0 ? 'primary' : 'secondary'}
                onClick={data.length > 0 ? () => exportTable('excel') : undefined}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 ${
                  data.length > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
                disabled={data.length === 0}
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير إكسل' : 'Export Excel'}
              </Button>
              <Button
                variant={data.length > 0 ? 'primary' : 'secondary'}
                onClick={data.length > 0 ? () => exportTable('pdf') : undefined}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 ${
                  data.length > 0 ? 'bg-green-600 hover:bg-green-700 text-white shadow-sm' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
                disabled={data.length === 0}
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير PDF' : 'Export PDF'}
              </Button>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-x-auto rounded-xl shadow-md border border-gray-200 bg-white"
          >
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-blue-100 sticky top-0">
                <tr className={isRtl ? 'flex-row-reverse' : ''}>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[40px]">{isRtl ? 'رقم' : 'No.'}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'الكود' : 'Code'}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[120px]">{isRtl ? 'المنتج' : 'Product'}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'وحدة المنتج' : 'Product Unit'}</th>
                  {allBranches.map(branch => (
                    <th key={branch} className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                      {branch}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'المبيعات الفعلية' : 'Actual Sales'}
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'السعر الإجمالي' : 'Total Price'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.map((row, index) => (
                  <tr key={row.id} className={`hover:bg-blue-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <td className="px-4 py-3 text-gray-700 text-center">{formatNumber(index + 1, isRtl)}</td>
                    <td className="px-4 py-3 text-gray-700 text-center truncate">{row.code}</td>
                    <td className="px-4 py-3 text-gray-700 text-center truncate">{row.product}</td>
                    <td className="px-4 py-3 text-gray-700 text-center truncate">{row.unit}</td>
                    {allBranches.map(branch => (
                      <td
                        key={branch}
                        className={`px-4 py-3 text-center font-medium ${
                          row.branchQuantities[branch] > 0
                            ? 'text-green-700'
                            : row.branchQuantities[branch] < 0
                            ? 'text-red-700'
                            : 'text-gray-700'
                        }`}
                        title={getMovementTooltip(row.movements, index, isRtl)}
                      >
                        {formatNumber(row.branchQuantities[branch] || 0, isRtl)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.actualSales, isRtl)}</td>
                    <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.actualSales, isRtl)}</td>
                    <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatPrice(row.totalPrice, isRtl)}</td>
                  </tr>
                ))}
                <tr className={`font-semibold bg-gray-100 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-4 py-3 text-gray-800 text-center" colSpan={2}></td>
                  <td className="px-4 py-3 text-gray-800 text-center">{isRtl ? 'الإجمالي' : 'Total'}</td>
                  <td className="px-4 py-3 text-gray-800 text-center"></td>
                  {allBranches.map(branch => (
                    <td key={branch} className="px-4 py-3 text-gray-800 text-center">
                      {formatNumber(totalQuantities[branch] || 0, isRtl)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalQuantity, isRtl)}</td>
                  <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandActualSales, isRtl)}</td>
                  <td className="px-4 py-3 text-gray-800 text-center">{formatPrice(grandTotalPrice, isRtl)}</td>
                </tr>
              </tbody>
            </table>
          </motion.div>
        </div>
      );
    },
    [loading, isRtl, allBranches, months]
  );

  const handleTabChange = (tab: 'orders' | 'stockIn' | 'stockOut' | 'returns' | 'sales') => {
    setActiveTab(tab);
  };

  const handleMonthChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMonth(Number(event.target.value));
  };

  return (
    <div className={`container mx-auto p-4 ${isRtl ? 'text-right' : 'text-left'}`}>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        {isRtl ? 'تقرير الإنتاج' : 'Production Report'}
      </h1>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex gap-2">
          <Button variant={activeTab === 'orders' ? 'primary' : 'secondary'}
            onClick={() => handleTabChange('orders')}
            className={`px-4 py-2 rounded-full text-xs font-medium transition-all duration-200 ${
              activeTab === 'orders'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isRtl ? 'الطلبات' : 'Orders'}
          </Button>
          <Button
            variant={activeTab === 'stockIn' ? 'primary' : 'secondary'}
            onClick={() => handleTabChange('stockIn')}
            className={`px-4 py-2 rounded-full text-xs font-medium transition-all duration-200 ${
              activeTab === 'stockIn'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isRtl ? 'إضافة المخزون' : 'Stock In'}
          </Button>
          <Button
            variant={activeTab === 'stockOut' ? 'primary' : 'secondary'}
            onClick={() => handleTabChange('stockOut')}
            className={`px-4 py-2 rounded-full text-xs font-medium transition-all duration-200 ${
              activeTab === 'stockOut'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isRtl ? 'نقصان المخزون' : 'Stock Out'}
          </Button>
          <Button
            variant={activeTab === 'returns' ? 'primary' : 'secondary'}
            onClick={() => handleTabChange('returns')}
            className={`px-4 py-2 rounded-full text-xs font-medium transition-all duration-200 ${
              activeTab === 'returns'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isRtl ? 'المرتجعات' : 'Returns'}
          </Button>
          <Button
            variant={activeTab === 'sales' ? 'primary' : 'secondary'}
            onClick={() => handleTabChange('sales')}
            className={`px-4 py-2 rounded-full text-xs font-medium transition-all duration-200 ${
              activeTab === 'sales'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isRtl ? 'المبيعات' : 'Sales'}
          </Button>
        </div>
        <select
          value={selectedMonth}
          onChange={handleMonthChange}
          className={`px-4 py-2 rounded-full text-xs font-medium border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            isRtl ? 'text-right' : 'text-left'
          }`}
        >
          {months.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'orders' && (
          <motion.div
            key="orders"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderOrderTable(
              orderData[selectedMonth] || [],
              isRtl ? 'تقرير الطلبات' : 'Orders Report',
              selectedMonth
            )}
          </motion.div>
        )}
        {activeTab === 'stockIn' && (
          <motion.div
            key="stockIn"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderStockTable(
              stockInData[selectedMonth] || [],
              isRtl ? 'تقرير إضافة المخزون' : 'Stock In Report',
              selectedMonth,
              true
            )}
          </motion.div>
        )}
        {activeTab === 'stockOut' && (
          <motion.div
            key="stockOut"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderStockTable(
              stockOutData[selectedMonth] || [],
              isRtl ? 'تقرير نقصان المخزون' : 'Stock Out Report',
              selectedMonth,
              false
            )}
          </motion.div>
        )}
        {activeTab === 'returns' && (
          <motion.div
            key="returns"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderReturnTable(
              returnData[selectedMonth] || [],
              isRtl ? 'تقرير المرتجعات' : 'Returns Report',
              selectedMonth
            )}
          </motion.div>
        )}
        {activeTab === 'sales' && (
          <motion.div
            key="sales"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderSalesTable(
              salesData[selectedMonth] || [],
              isRtl ? 'تقرير المبيعات' : 'Sales Report',
              selectedMonth
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductionReport;