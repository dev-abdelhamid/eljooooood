import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/UI/Button';
import { OrdersTable } from './OrdersTable';
import { DailyOrdersTable } from './DailyOrdersTable';
import { ProductDropdown } from './NewOrder';
import { Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';
import { inventoryAPI, ordersAPI, branchesAPI, salesAPI } from '../services/api';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';
import { Tooltip } from 'react-tooltip';

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
}

interface DailyOrderRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  dailyOrders: number[];
  totalOrders: number;
  totalPrice: number;
  dailyBranchDetails: { [branch: string]: number }[];
}

interface StockRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  totalQuantity: number;
  dailyQuantities: number[];
  dailyBranchDetails: { [branch: string]: number }[];
  totalPrice: number;
  dailySales?: number[];
  dailyReturns?: number[];
  dailySalesDetails?: { [branch: string]: number }[];
  dailyReturnsDetails?: { [branch: string]: number }[];
}

interface ReturnRow {
  id: string;
  product: string;
  code: string;
  unit: string;
  totalReturns: number;
  dailyReturns: number[];
  dailyBranchDetails: { [branch: string]: number }[];
  totalValue: number;
  totalOrders?: number;
}

interface SalesRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  totalSales: number;
  dailySales: number[];
  dailyBranchDetails: { [branch: string]: number }[];
  totalValue: number;
}

interface OrdersVsReturnsRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  dailyOrders: number[];
  dailyReturns: number[];
  totalOrders: number;
  totalReturns: number;
  totalRatio: number;
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
  const validAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
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
  allBranches: string[]
) => {
  const tableColumnWidths = headers.map((_, index) => {
    if (index === 0 && headers[index] !== (isRtl ? 'رقم' : 'No.')) return 25; // Code
    if (index === 0 && headers[index] === (isRtl ? 'رقم' : 'No.')) return 15; // No.
    if (index === 1) return 45; // Product
    if (index === 2) return 25; // Unit
    if (index >= 3 && index < headers.length - 2) return 20; // Daily Quantities or Branch Quantities
    return 30; // Total Quantity, Total Price/Value
  });

  autoTable(doc, {
    head: [isRtl ? headers.slice().reverse() : headers],
    body: isRtl ? data.map((row) => row.slice().reverse()) : data,
    theme: 'grid',
    startY: 30,
    margin: { top: 10, bottom: 10, left: 10, right: 10 },
    tableWidth: 'wrap',
    columnStyles: Object.fromEntries(headers.map((_, i) => [i, { cellWidth: tableColumnWidths[i], halign: 'center' }])),
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
      if (data.section === 'body' && data.column.index >= (isRtl ? 0 : headers.length - 2)) {
        data.cell.styles.fontStyle = 'bold';
      }
      if (isRtl) {
        data.cell.text = data.cell.text.map((text) => String(text).replace(/[0-9]/g, (d) => toArabicNumerals(d)));
      }
    },
    didDrawPage: (data) => {
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
  allBranches: string[]
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
  const [dailyOrderData, setDailyOrderData] = useState<{ [month: number]: DailyOrderRow[] }>({});
  const [stockInData, setStockInData] = useState<{ [month: number]: StockRow[] }>({});
  const [stockOutData, setStockOutData] = useState<{ [month: number]: StockRow[] }>({});
  const [returnData, setReturnData] = useState<{ [month: number]: ReturnRow[] }>({});
  const [salesData, setSalesData] = useState<{ [month: number]: SalesRow[] }>({});
  const [ordersVsReturnsData, setOrdersVsReturnsData] = useState<{ [month: number]: OrdersVsReturnsRow[] }>({});
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(8); // September 2025
  const [activeTab, setActiveTab] = useState<
    'orders' | 'dailyOrders' | 'stockIn' | 'stockOut' | 'returns' | 'sales' | 'ordersVsReturns'
  >('orders');
  const currentDate = new Date('2025-10-13T02:39:00+03:00');
  const currentYear = currentDate.getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: new Date(currentYear, i).toLocaleString(language, { month: 'long' }),
  }));

  const getDaysInMonth = useCallback((month: number) => {
    const daysInMonthCount = new Date(currentYear, month + 1, 0).getDate();
    return Array.from({ length: daysInMonthCount }, (_, i) => {
      const date = new Date(currentYear, month, i + 1);
      return date.toLocaleString(language, { day: 'numeric', month: 'short' });
    });
  }, [currentYear, language]);

  const daysInMonth = useMemo(() => getDaysInMonth(selectedMonth), [selectedMonth, getDaysInMonth]);

  const allBranches = useMemo(() => {
    return branches.map((b) => b.displayName).sort();
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
        const monthlyDailyOrderData: { [month: number]: DailyOrderRow[] } = {};
        const monthlyStockInData: { [month: number]: StockRow[] } = {};
        const monthlyStockOutData: { [month: number]: StockRow[] } = {};
        const monthlyReturnData: { [month: number]: ReturnRow[] } = {};
        const monthlySalesData: { [month: number]: SalesRow[] } = {};
        const monthlyOrdersVsReturnsData: { [month: number]: OrdersVsReturnsRow[] } = {};

        // Process branches
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

        const branchMap = new Map<string, string>(fetchedBranches.map((b) => [b._id, b.displayName]));

        // Process product details with language support
        const productDetails = new Map<string, { code: string; product: string; unit: string; price: number }>();
        inventory.forEach((item: any) => {
          if (item?.product?._id) {
            productDetails.set(item.product._id, {
              code: item.product.code || `code-${Math.random().toString(36).substring(2)}`,
              product: isRtl
                ? item.product.name || 'منتج غير معروف'
                : item.product.nameEn || item.product.name || 'Unknown Product',
              unit: isRtl ? item.product.unit || 'غير محدد' : item.product.unitEn || item.product.unit || 'N/A',
              price: Number(item.product.price) || 0,
            });
          }
        });

        // Process orders with enhanced validation
        let orders = Array.isArray(ordersResponse) ? ordersResponse : [];
        if (orders.length === 0) {
          orders = inventory
            .filter((item: any) => item?.product?._id)
            .flatMap((item: any) => {
              return (item.movements || []).map((movement: any) => ({
                _id: `order-${Math.random().toString(36).substring(2)}`,
                status: 'completed',
                createdAt: movement.createdAt || new Date().toISOString(),
                branch: {
                  _id: fetchedBranches[Math.floor(Math.random() * fetchedBranches.length)]?._id || 'unknown',
                  displayName:
                    fetchedBranches[Math.floor(Math.random() * fetchedBranches.length)]?.displayName ||
                    (isRtl ? 'الفرع الرئيسي' : 'Main Branch'),
                },
                items: [
                  {
                    product: {
                      _id: item.product._id,
                      name: item.product.name,
                      nameEn: item.product.nameEn,
                      code: item.product.code,
                      unit: item.product.unit,
                      unitEn: item.product.unitEn,
                      price: item.product.price,
                    },
                    quantity: Math.abs(Number(movement.quantity) || 0),
                    price: Number(item.product?.price) || 0,
                    productId: item.product._id,
                    sales:
                      Number(item.product?.sales) ||
                      Math.abs(Number(movement.quantity)) * Number(item.product?.price) * 0.1 ||
                      0,
                  },
                ],
              }));
            });
        }

        // Process data for each month
        for (let month = 0; month < 12; month++) {
          const daysInMonthCount = new Date(currentYear, month + 1, 0).getDate();
          const orderMap = new Map<string, OrderRow>();
          const dailyOrderMap = new Map<string, DailyOrderRow>();
          const stockInMap = new Map<string, StockRow>();
          const stockOutMap = new Map<string, StockRow>();
          const returnMap = new Map<string, ReturnRow>();
          const salesMap = new Map<string, SalesRow>();

          // Process orders
          orders.forEach((order: any) => {
            const status = order.status || order.orderStatus;
            if (status !== 'completed') return;
            const date = new Date(order.createdAt || order.date);
            if (isNaN(date.getTime())) return;
            const orderMonth = date.getMonth();
            const year = date.getFullYear();
            if (year === currentYear && orderMonth === month) {
              const day = date.getDate() - 1;
              const branch =
                order.branch?.displayName ||
                order.branch?.name ||
                branchMap.get(order.branch?._id || order.branchId) ||
                (isRtl ? 'الفرع الرئيسي' : 'Main Branch');
              (order.items || []).forEach((item: any) => {
                const productId = item.product?._id || item.productId;
                if (!productId) return;
                const details = productDetails.get(productId) || {
                  code: item.product?.code || `code-${Math.random().toString(36).substring(2)}`,
                  product: isRtl
                    ? item.product?.name || 'منتج غير معروف'
                    : item.product?.nameEn || item.product?.name || 'Unknown Product',
                  unit: isRtl
                    ? item.product?.unit || 'غير محدد'
                    : item.product?.unitEn || item.product?.unit || 'N/A',
                  price: Number(item.price) || 0,
                };
                const key = `${productId}-${month}`;
                const quantity = Number(item.quantity) || 0;

                // OrderRow for OrdersTable
                if (!orderMap.has(key)) {
                  orderMap.set(key, {
                    id: key,
                    code: details.code,
                    product: details.product,
                    unit: details.unit,
                    branchQuantities: {},
                    totalQuantity: 0,
                    totalPrice: 0,
                    sales: 0,
                    actualSales: 0,
                  });
                }
                const orderRow = orderMap.get(key)!;
                orderRow.branchQuantities[branch] = (orderRow.branchQuantities[branch] || 0) + quantity;
                orderRow.totalQuantity += quantity;
                orderRow.totalPrice += quantity * details.price;
                orderRow.sales = orderRow.totalPrice * 0.1;

                // DailyOrderRow for DailyOrdersTable
                if (!dailyOrderMap.has(key)) {
                  dailyOrderMap.set(key, {
                    id: key,
                    code: details.code,
                    product: details.product,
                    unit: details.unit,
                    dailyOrders: Array(daysInMonthCount).fill(0),
                    totalOrders: 0,
                    totalPrice: 0,
                    dailyBranchDetails: Array.from({ length: daysInMonthCount }, () => ({})),
                  });
                }
                const dailyRow = dailyOrderMap.get(key)!;
                dailyRow.dailyOrders[day] += quantity;
                dailyRow.dailyBranchDetails[day][branch] = (dailyRow.dailyBranchDetails[day][branch] || 0) + quantity;
                dailyRow.totalOrders += quantity;
                dailyRow.totalPrice += quantity * details.price;
              });
            }
          });

          // Set actualSales for selected month
          if (month === selectedMonth) {
            for (const row of orderMap.values()) {
              const salesItem = salesResponse.productSales?.find((s: any) => s.productId === row.id.split('-')[0]);
              if (salesItem) {
                row.actualSales = Number(salesItem.totalQuantity) || 0;
              }
            }
          }

          // Process inventory movements
          inventory.forEach((item: any) => {
            const productId = item?.product?._id;
            if (!productId) return;
            const details = productDetails.get(productId) || {
              code: item.product?.code || `code-${Math.random().toString(36).substring(2)}`,
              product: isRtl
                ? item.product?.name || 'منتج غير معروف'
                : item.product?.nameEn || item.product?.name || 'Unknown Product',
              unit: isRtl ? item.product?.unit || 'غير محدد' : item.product?.unitEn || item.product?.unit || 'N/A',
              price: Number(item.product?.price) || 0,
            };
            const branchId = item.branch?._id || item.branch;
            const branchName = branchMap.get(branchId) || (isRtl ? 'غير معروف' : 'Unknown');
            (item.movements || []).forEach((movement: any) => {
              const date = new Date(movement.createdAt);
              if (isNaN(date.getTime())) return;
              const prodMonth = date.getMonth();
              const year = date.getFullYear();
              if (year === currentYear && prodMonth === month) {
                const day = date.getDate() - 1;
                const key = `${productId}-${month}`;
                const quantity = Number(movement.quantity) || 0;
                if (movement.type === 'in') {
                  if (!stockInMap.has(key)) {
                    stockInMap.set(key, {
                      id: key,
                      code: details.code,
                      product: details.product,
                      unit: details.unit,
                      totalQuantity: 0,
                      dailyQuantities: Array(daysInMonthCount).fill(0),
                      dailyBranchDetails: Array.from({ length: daysInMonthCount }, () => ({})),
                      totalPrice: 0,
                    });
                  }
                  const row = stockInMap.get(key)!;
                  row.dailyQuantities[day] += quantity;
                  row.dailyBranchDetails[day][branchName] = (row.dailyBranchDetails[day][branchName] || 0) + quantity;
                  row.totalQuantity += quantity;
                  row.totalPrice += quantity * details.price;
                } else if (movement.type === 'out') {
                  if (!stockOutMap.has(key)) {
                    stockOutMap.set(key, {
                      id: key,
                      code: details.code,
                      product: details.product,
                      unit: details.unit,
                      totalQuantity: 0,
                      dailyQuantities: Array(daysInMonthCount).fill(0),
                      dailyBranchDetails: Array.from({ length: daysInMonthCount }, () => ({})),
                      totalPrice: 0,
                      dailySales: Array(daysInMonthCount).fill(0),
                      dailyReturns: Array(daysInMonthCount).fill(0),
                      dailySalesDetails: Array.from({ length: daysInMonthCount }, () => ({})),
                      dailyReturnsDetails: Array.from({ length: daysInMonthCount }, () => ({})),
                    });
                  }
                  const row = stockOutMap.get(key)!;
                  const qty = -quantity;
                  row.dailyQuantities[day] += qty;
                  row.dailyBranchDetails[day][branchName] = (row.dailyBranchDetails[day][branchName] || 0) + qty;
                  row.totalQuantity += qty;
                  row.totalPrice += quantity * details.price;

                  const isReturn = movement.reference?.includes('مرتجع') || movement.reference?.includes('RET-');
                  const isSale = movement.reference?.includes('بيع') || movement.reference?.includes('SALE-');
                  if (isReturn) {
                    row.dailyReturns![day] += qty;
                    row.dailyReturnsDetails![day][branchName] = (row.dailyReturnsDetails![day][branchName] || 0) + qty;
                    if (!returnMap.has(key)) {
                      returnMap.set(key, {
                        id: key,
                        product: details.product,
                        code: details.code,
                        unit: details.unit,
                        totalReturns: 0,
                        dailyReturns: Array(daysInMonthCount).fill(0),
                        dailyBranchDetails: Array.from({ length: daysInMonthCount }, () => ({})),
                        totalValue: 0,
                      });
                    }
                    const returnRow = returnMap.get(key)!;
                    returnRow.dailyReturns[day] += qty;
                    returnRow.dailyBranchDetails[day][branchName] = (returnRow.dailyBranchDetails[day][branchName] || 0) + qty;
                    returnRow.totalReturns += qty;
                    returnRow.totalValue += quantity * details.price;
                    returnRow.totalOrders = dailyOrderMap.get(key)?.totalOrders || 0;
                  } else if (isSale) {
                    row.dailySales![day] += qty;
                    row.dailySalesDetails![day][branchName] = (row.dailySalesDetails![day][branchName] || 0) + qty;
                    if (!salesMap.has(key)) {
                      salesMap.set(key, {
                        id: key,
                        code: details.code,
                        product: details.product,
                        unit: details.unit,
                        totalSales: 0,
                        dailySales: Array(daysInMonthCount).fill(0),
                        dailyBranchDetails: Array.from({ length: daysInMonthCount }, () => ({})),
                        totalValue: 0,
                      });
                    }
                    const salesRow = salesMap.get(key)!;
                    salesRow.dailySales[day] += qty;
                    salesRow.dailyBranchDetails[day][branchName] = (salesRow.dailyBranchDetails[day][branchName] || 0) + qty;
                    salesRow.totalSales += qty;
                    salesRow.totalValue += quantity * details.price;
                  }
                }
              }
            });
          });

          // Process orders vs returns
          const productKeys = new Set<string>();
          dailyOrderMap.forEach((_, key) => productKeys.add(key));
          returnMap.forEach((_, key) => productKeys.add(key));

          const ordersVsReturnsMap = new Map<string, OrdersVsReturnsRow>();
          productKeys.forEach((key) => {
            const ordersRow = dailyOrderMap.get(key) || {
              dailyOrders: Array(daysInMonthCount).fill(0),
              totalOrders: 0,
              totalPrice: 0,
              code: '',
              product: '',
              unit: '',
            };
            const returnsRow = returnMap.get(key) || {
              dailyReturns: Array(daysInMonthCount).fill(0),
              totalReturns: 0,
            };
            const totalRatio = ordersRow.totalOrders > 0 ? (returnsRow.totalReturns / ordersRow.totalOrders) * 100 : 0;
            ordersVsReturnsMap.set(key, {
              id: key,
              code: ordersRow.code,
              product: ordersRow.product,
              unit: ordersRow.unit,
              dailyOrders: ordersRow.dailyOrders,
              dailyReturns: returnsRow.dailyReturns,
              totalOrders: ordersRow.totalOrders,
              totalReturns: returnsRow.totalReturns,
              totalRatio,
            });
          });

          monthlyOrderData[month] = Array.from(orderMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
          monthlyDailyOrderData[month] = Array.from(dailyOrderMap.values()).sort((a, b) => b.totalOrders - a.totalOrders);
          monthlyStockInData[month] = Array.from(stockInMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
          monthlyStockOutData[month] = Array.from(stockOutMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
          monthlyReturnData[month] = Array.from(returnMap.values()).sort((a, b) => b.totalReturns - a.totalReturns);
          monthlySalesData[month] = Array.from(salesMap.values()).sort((a, b) => b.totalSales - a.totalSales);
          monthlyOrdersVsReturnsData[month] = Array.from(ordersVsReturnsMap.values()).sort(
            (a, b) => b.totalRatio - a.totalRatio
          );
        }

        setOrderData(monthlyOrderData);
        setDailyOrderData(monthlyDailyOrderData);
        setStockInData(monthlyStockInData);
        setStockOutData(monthlyStockOutData);
        setReturnData(monthlyReturnData);
        setSalesData(monthlySalesData);
        setOrdersVsReturnsData(monthlyOrdersVsReturnsData);
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

  const getTooltipContent = (
    dailyQuantity: number,
    branchDetails: { [branch: string]: number },
    isRtl: boolean,
    type: 'in' | 'out' | 'return' | 'sales' | 'orders'
  ) => {
    let header = '';
    if (type === 'in') header = isRtl ? 'زيادة مخزون' : 'Stock In';
    if (type === 'out') header = isRtl ? 'نقص مخزون' : 'Stock Out';
    if (type === 'return') header = isRtl ? 'مرتجع' : 'Return';
    if (type === 'sales') header = isRtl ? 'مبيعات' : 'Sales';
    if (type === 'orders') header = isRtl ? 'طلبات' : 'Orders';
    let content = `${header}: ${dailyQuantity > 0 ? '+' : ''}${formatNumber(dailyQuantity, isRtl)}`;
    if (Object.keys(branchDetails).length > 0) {
      content += `\n${Object.entries(branchDetails)
        .map(([branch, qty]) => `${branch}: ${qty > 0 ? '+' : ''}${formatNumber(qty, isRtl)}`)
        .join('\n')}`;
    }
    return content;
  };

  const renderStockTable = useCallback(
    (data: StockRow[], title: string, month: number, type: 'in' | 'out') => {
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
          ...data.map((row, index)          => ({
            no: index + 1,
            code: row.code,
            product: row.product,
            unit: row.unit,
            ...Object.fromEntries(row.dailyQuantities.map((qty, i) => [daysInMonth[i], qty])),
            totalQuantity: row.totalQuantity,
            totalPrice: formatPrice(row.totalPrice, isRtl),
          })),
          {
            no: '',
            code: '',
            product: isRtl ? 'الإجمالي' : 'Total',
            unit: '',
            ...Object.fromEntries(
              daysInMonth.map((_, i) => [
                daysInMonth[i],
                data.reduce((sum, row) => sum + row.dailyQuantities[i], 0),
              ])
            ),
            totalQuantity: grandTotalQuantity,
            totalPrice: formatPrice(grandTotalPrice, isRtl),
          },
        ];
        const dataRows = rows.map((row) => [
          row.no,
          row.code,
          row.product,
          row.unit,
          ...daysInMonth.map((day) => row[day]),
          row.totalQuantity,
          row.totalPrice,
        ]);

        if (format === 'excel') {
          const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map((row) => Object.fromEntries(Object.entries(row).reverse())) : rows, {
            header: headers,
          });
          if (isRtl) ws['!views'] = [{ RTL: true }];
          ws['!cols'] = [
            { wch: 10 },
            { wch: 15 },
            { wch: 20 },
            { wch: 15 },
            ...daysInMonth.map(() => ({ wch: 12 })),
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
          exportToPDF(dataRows, title, monthName, headers, isRtl, data.length, grandTotalQuantity, grandTotalPrice, []);
        }
      };

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
              <thead className="bg-blue-50 sticky top-0">
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
                    {row.dailyQuantities.map((qty, i) => (
                      <td
                        key={i}
                        className={`px-4 py-3 text-center font-medium ${
                          qty > 0 ? 'bg-green-50 text-green-700' : qty < 0 ? 'bg-red-50 text-red-700' : 'text-gray-700'
                        }`}
                        data-tooltip-id="daily-quantity-tooltip"
                        data-tooltip-content={getTooltipContent(qty, row.dailyBranchDetails[i], isRtl, type)}
                      >
                        {qty !== 0 ? `${qty > 0 ? '+' : ''}${formatNumber(qty, isRtl)}` : '0'}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalQuantity, isRtl)}</td>
                    <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatPrice(row.totalPrice, isRtl)}</td>
                  </tr>
                ))}
                <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-4 py-3 text-gray-800 text-center" colSpan={4}>
                    {isRtl ? 'الإجمالي' : 'Total'}
                  </td>
                  {daysInMonth.map((_, i) => (
                    <td key={i} className="px-4 py-3 text-gray-800 text-center">
                      {formatNumber(data.reduce((sum, row) => sum + row.dailyQuantities[i], 0), isRtl)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalQuantity, isRtl)}</td>
                  <td className="px-4 py-3 text-gray-800 text-center">{formatPrice(grandTotalPrice, isRtl)}</td>
                </tr>
              </tbody>
            </table>
            <Tooltip id="daily-quantity-tooltip" place="top" effect="solid" className="custom-tooltip" />
          </motion.div>
        </div>
      );
    },
    [daysInMonth, isRtl, months, formatPrice, formatNumber, exportToPDF]
  );

  const renderReturnsTable = useCallback(
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
            ...Object.fromEntries(
              daysInMonth.map((_, i) => [
                daysInMonth[i],
                data.reduce((sum, row) => sum + row.dailyReturns[i], 0),
              ])
            ),
            totalReturns: grandTotalReturns,
            totalValue: formatPrice(grandTotalValue, isRtl),
          },
        ];
        const dataRows = rows.map((row) => [
          row.no,
          row.code,
          row.product,
          row.unit,
          ...daysInMonth.map((day) => row[day]),
          row.totalReturns,
          row.totalValue,
        ]);

        if (format === 'excel') {
          const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map((row) => Object.fromEntries(Object.entries(row).reverse())) : rows, {
            header: headers,
          });
          if (isRtl) ws['!views'] = [{ RTL: true }];
          ws['!cols'] = [
            { wch: 10 },
            { wch: 15 },
            { wch: 20 },
            { wch: 15 },
            ...daysInMonth.map(() => ({ wch: 12 })),
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
          exportToPDF(dataRows, title, monthName, headers, isRtl, data.length, grandTotalReturns, grandTotalValue, []);
        }
      };

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
              <thead className="bg-blue-50 sticky top-0">
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
                        className={`px-4 py-3 text-center font-medium ${
                          qty > 0 ? 'bg-red-50 text-red-700' : 'text-gray-700'
                        }`}
                        data-tooltip-id="daily-returns-tooltip"
                        data-tooltip-content={getTooltipContent(qty, row.dailyBranchDetails[i], isRtl, 'return')}
                      >
                        {qty !== 0 ? `${qty > 0 ? '+' : ''}${formatNumber(qty, isRtl)}` : '0'}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalReturns, isRtl)}</td>
                    <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatPrice(row.totalValue, isRtl)}</td>
                  </tr>
                ))}
                <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
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
            <Tooltip id="daily-returns-tooltip" place="top" effect="solid" className="custom-tooltip" />
          </motion.div>
        </div>
      );
    },
    [daysInMonth, isRtl, months, formatPrice, formatNumber, exportToPDF]
  );

  const renderSalesTable = useCallback(
    (data: SalesRow[], title: string, month: number) => {
      const grandTotalSales = data.reduce((sum, row) => sum + row.totalSales, 0);
      const grandTotalValue = data.reduce((sum, row) => sum + row.totalValue, 0);
      const monthName = months[month].label;

      const exportTable = (format: 'excel' | 'pdf') => {
        const headers = [
          isRtl ? 'رقم' : 'No.',
          isRtl ? 'الكود' : 'Code',
          isRtl ? 'المنتج' : 'Product',
          isRtl ? 'وحدة المنتج' : 'Product Unit',
          ...daysInMonth,
          isRtl ? 'إجمالي المبيعات' : 'Total Sales',
          isRtl ? 'القيمة الإجمالية' : 'Total Value',
        ];
        const rows = [
          ...data.map((row, index) => ({
            no: index + 1,
            code: row.code,
            product: row.product,
            unit: row.unit,
            ...Object.fromEntries(row.dailySales.map((qty, i) => [daysInMonth[i], qty])),
            totalSales: row.totalSales,
            totalValue: formatPrice(row.totalValue, isRtl),
          })),
          {
            no: '',
            code: '',
            product: isRtl ? 'الإجمالي' : 'Total',
            unit: '',
            ...Object.fromEntries(
              daysInMonth.map((_, i) => [
                daysInMonth[i],
                data.reduce((sum, row) => sum + row.dailySales[i], 0),
              ])
            ),
            totalSales: grandTotalSales,
            totalValue: formatPrice(grandTotalValue, isRtl),
          },
        ];
        const dataRows = rows.map((row) => [
          row.no,
          row.code,
          row.product,
          row.unit,
          ...daysInMonth.map((day) => row[day]),
          row.totalSales,
          row.totalValue,
        ]);

        if (format === 'excel') {
          const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map((row) => Object.fromEntries(Object.entries(row).reverse())) : rows, {
            header: headers,
          });
          if (isRtl) ws['!views'] = [{ RTL: true }];
          ws['!cols'] = [
            { wch: 10 },
            { wch: 15 },
            { wch: 20 },
            { wch: 15 },
            ...daysInMonth.map(() => ({ wch: 12 })),
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
          exportToPDF(dataRows, title, monthName, headers, isRtl, data.length, grandTotalSales, grandTotalValue, []);
        }
      };

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
              <thead className="bg-blue-50 sticky top-0">
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
                    {isRtl ? 'إجمالي المبيعات' : 'Total Sales'}
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
                    {row.dailySales.map((qty, i) => (
                      <td
                        key={i}
                        className={`px-4 py-3 text-center font-medium ${
                          qty > 0 ? 'bg-green-50 text-green-700' : 'text-gray-700'
                        }`}
                        data-tooltip-id="daily-sales-tooltip"
                        data-tooltip-content={getTooltipContent(qty, row.dailyBranchDetails[i], isRtl, 'sales')}
                      >
                        {qty !== 0 ? `${qty > 0 ? '+' : ''}${formatNumber(qty, isRtl)}` : '0'}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalSales, isRtl)}</td>
                    <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatPrice(row.totalValue, isRtl)}</td>
                  </tr>
                ))}
                <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-4 py-3 text-gray-800 text-center" colSpan={4}>
                    {isRtl ? 'الإجمالي' : 'Total'}
                  </td>
                  {daysInMonth.map((_, i) => (
                    <td key={i} className="px-4 py-3 text-gray-800 text-center">
                      {formatNumber(data.reduce((sum, row) => sum + row.dailySales[i], 0), isRtl)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalSales, isRtl)}</td>
                  <td className="px-4 py-3 text-gray-800 text-center">{formatPrice(grandTotalValue, isRtl)}</td>
                </tr>
              </tbody>
            </table>
            <Tooltip id="daily-sales-tooltip" place="top" effect="solid" className="custom-tooltip" />
          </motion.div>
        </div>
      );
    },
    [daysInMonth, isRtl, months, formatPrice, formatNumber, exportToPDF]
  );

  const renderOrdersVsReturnsTable = useCallback(
    (data: OrdersVsReturnsRow[], title: string, month: number) => {
      const grandTotalOrders = data.reduce((sum, row) => sum + row.totalOrders, 0);
      const grandTotalReturns = data.reduce((sum, row) => sum + row.totalReturns, 0);
      const grandTotalRatio = grandTotalOrders > 0 ? (grandTotalReturns / grandTotalOrders) * 100 : 0;
      const monthName = months[month].label;

      const exportTable = (format: 'excel' | 'pdf') => {
        const headers = [
          isRtl ? 'رقم' : 'No.',
          isRtl ? 'الكود' : 'Code',
          isRtl ? 'المنتج' : 'Product',
          isRtl ? 'وحدة المنتج' : 'Product Unit',
          ...daysInMonth.map((day, i) => `${day} ${isRtl ? 'طلبات/مرتجعات' : 'Orders/Returns'}`),
          isRtl ? 'إجمالي الطلبات' : 'Total Orders',
          isRtl ? 'إجمالي المرتجعات' : 'Total Returns',
          isRtl ? 'نسبة المرتجعات %' : 'Returns Ratio %',
        ];
        const rows = [
          ...data.map((row, index) => ({
            no: index + 1,
            code: row.code,
            product: row.product,
            unit: row.unit,
            ...Object.fromEntries(
              row.dailyOrders.map((orderQty, i) => [
                `${daysInMonth[i]} ${isRtl ? 'طلبات/مرتجعات' : 'Orders/Returns'}`,
                `${orderQty}/${row.dailyReturns[i]}`,
              ])
            ),
            totalOrders: row.totalOrders,
            totalReturns: row.totalReturns,
            totalRatio: formatNumber(row.totalRatio.toFixed(2), isRtl),
          })),
          {
            no: '',
            code: '',
            product: isRtl ? 'الإجمالي' : 'Total',
            unit: '',
            ...Object.fromEntries(
              daysInMonth.map((_, i) => [
                `${daysInMonth[i]} ${isRtl ? 'طلبات/مرتجعات' : 'Orders/Returns'}`,
                `${data.reduce((sum, row) => sum + row.dailyOrders[i], 0)}/${data.reduce(
                  (sum, row) => sum + row.dailyReturns[i],
                  0
                )}`,
              ])
            ),
            totalOrders: grandTotalOrders,
            totalReturns: grandTotalReturns,
            totalRatio: formatNumber(grandTotalRatio.toFixed(2), isRtl),
          },
        ];
        const dataRows = rows.map((row) => [
          row.no,
          row.code,
          row.product,
          row.unit,
          ...daysInMonth.map((day) => row[`${day} ${isRtl ? 'طلبات/مرتجعات' : 'Orders/Returns'}`]),
          row.totalOrders,
          row.totalReturns,
          `${row.totalRatio}%`,
        ]);

        if (format === 'excel') {
          const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map((row) => Object.fromEntries(Object.entries(row).reverse())) : rows, {
            header: headers,
          });
          if (isRtl) ws['!views'] = [{ RTL: true }];
          ws['!cols'] = [
            { wch: 10 },
            { wch: 15 },
            { wch: 20 },
            { wch: 15 },
            ...daysInMonth.map(() => ({ wch: 20 })),
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
          exportToPDF(dataRows, title, monthName, headers, isRtl, data.length, grandTotalOrders, 0, []);
        }
      };

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
              <thead className="bg-blue-50 sticky top-0">
                <tr className={isRtl ? 'flex-row-reverse' : ''}>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[40px]">{isRtl ? 'رقم' : 'No.'}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'الكود' : 'Code'}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[120px]">{isRtl ? 'المنتج' : 'Product'}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'وحدة المنتج' : 'Product Unit'}</th>
                  {daysInMonth.map((day, i) => (
                    <th key={i} className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                      {`${day} ${isRtl ? 'طلبات/مرتجعات' : 'Orders/Returns'}`}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'إجمالي الطلبات' : 'Total Orders'}
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'إجمالي المرتجعات' : 'Total Returns'}
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'نسبة المرتجعات %' : 'Returns Ratio %'}
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
                    {row.dailyOrders.map((orderQty, i) => (
                      <td
                        key={i}
                        className="px-4 py-3 text-gray-700 text-center font-medium"
                        data-tooltip-id="orders-returns-tooltip"
                        data-tooltip-content={`${isRtl ? 'طلبات' : 'Orders'}: ${formatNumber(orderQty, isRtl)}\n${isRtl ? 'مرتجعات' : 'Returns'}: ${formatNumber(row.dailyReturns[i], isRtl)}`}
                      >
                        {`${formatNumber(orderQty, isRtl)}/${formatNumber(row.dailyReturns[i], isRtl)}`}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalOrders, isRtl)}</td>
                    <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalReturns, isRtl)}</td>
                    <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalRatio.toFixed(2), isRtl)}%</td>
                  </tr>
                ))}
                <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-4 py-3 text-gray-800 text-center" colSpan={4}>
                    {isRtl ? 'الإجمالي' : 'Total'}
                  </td>
                  {daysInMonth.map((_, i) => (
                    <td key={i} className="px-4 py-3 text-gray-800 text-center">
                      {`${formatNumber(data.reduce((sum, row) => sum + row.dailyOrders[i], 0), isRtl)}/${formatNumber(
                        data.reduce((sum, row) => sum + row.dailyReturns[i], 0),
                        isRtl
                      )}`}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalOrders, isRtl)}</td>
                  <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalReturns, isRtl)}</td>
                  <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalRatio.toFixed(2), isRtl)}%</td>
                </tr>
              </tbody>
            </table>
            <Tooltip id="orders-returns-tooltip" place="top" effect="solid" className="custom-tooltip" />
          </motion.div>
        </div>
      );
    },
    [daysInMonth, isRtl, months, formatNumber, exportToPDF]
  );

  const tabs = [
    { id: 'orders', label: isRtl ? 'الطلبات' : 'Orders', component: OrdersTable },
    { id: 'dailyOrders', label: isRtl ? 'الطلبات اليومية' : 'Daily Orders', component: DailyOrdersTable },
    { id: 'stockIn', label: isRtl ? 'زيادة المخزون' : 'Stock In', component: renderStockTable },
    { id: 'stockOut', label: isRtl ? 'نقص المخزون' : 'Stock Out', component: renderStockTable },
    { id: 'returns', label: isRtl ? 'المرتجعات' : 'Returns', component: renderReturnsTable },
    { id: 'sales', label: isRtl ? 'المبيعات' : 'Sales', component: renderSalesTable },
    { id: 'ordersVsReturns', label: isRtl ? 'الطلبات مقابل المرتجعات' : 'Orders vs Returns', component: renderOrdersVsReturnsTable },
  ];

  return (
    <div className={`container mx-auto px-4 py-6 ${isRtl ? 'font-arabic' : 'font-sans'}`}>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{isRtl ? 'تقرير الإنتاج' : 'Production Report'}</h1>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <ProductDropdown
          value={selectedMonth.toString()}
          onChange={(value) => setSelectedMonth(Number(value))}
          options={months}
          ariaLabel={isRtl ? 'اختر الشهر' : 'Select Month'}
        />
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'primary' : 'secondary'}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-full text-xs font-medium transition-all duration-200 ${
              activeTab === tab.id ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {tab.label}
          </Button>
        ))}
      </div>
      <AnimatePresence>
        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <OrderTableSkeleton isRtl={isRtl} />
          </motion.div>
        ) : (
          <>
            {activeTab === 'orders' && (
              <OrdersTable
                data={orderData[selectedMonth] || []}
                title={isRtl ? 'الطلبات' : 'Orders'}
                month={selectedMonth}
                allBranches={allBranches}
                isRtl={isRtl}
                months={months}
                formatPrice={formatPrice}
                formatNumber={formatNumber}
                exportToPDF={exportToPDF}
              />
            )}
            {activeTab === 'dailyOrders' && (
              <DailyOrdersTable
                data={dailyOrderData[selectedMonth] || []}
                title={isRtl ? 'الطلبات اليومية' : 'Daily Orders'}
                month={selectedMonth}
                daysInMonth={daysInMonth}
                allBranches={allBranches}
                isRtl={isRtl}
                months={months}
                formatPrice={formatPrice}
                formatNumber={formatNumber}
                exportToPDF={exportToPDF}
              />
            )}
            {activeTab === 'stockIn' && renderStockTable(stockInData[selectedMonth] || [], isRtl ? 'زيادة المخزون' : 'Stock In', selectedMonth, 'in')}
            {activeTab === 'stockOut' && renderStockTable(stockOutData[selectedMonth] || [], isRtl ? 'نقص المخزون' : 'Stock Out', selectedMonth, 'out')}
            {activeTab === 'returns' && renderReturnsTable(returnData[selectedMonth] || [], isRtl ? 'المرتجعات' : 'Returns', selectedMonth)}
            {activeTab === 'sales' && renderSalesTable(salesData[selectedMonth] || [], isRtl ? 'المبيعات' : 'Sales', selectedMonth)}
            {activeTab === 'ordersVsReturns' &&
              renderOrdersVsReturnsTable(
                ordersVsReturnsData[selectedMonth] || [],
                isRtl ? 'الطلبات مقابل المرتجعات' : 'Orders vs Returns',
                selectedMonth
              )}
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductionReport;