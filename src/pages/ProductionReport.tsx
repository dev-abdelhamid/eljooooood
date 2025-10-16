import React, { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/UI/Button';
import { Upload, Search, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';
import { inventoryAPI, ordersAPI, branchesAPI, salesAPI } from '../services/api';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';
import { Tooltip } from 'react-tooltip';
import { ProductDropdown } from './NewOrder'; // استيراد المكون الذي قدمته
import OrdersTable from './OrdersTable'; // استيراد جدول الطلبات المنفصل
import ReturnsTable from './ReturnsTable'; // استيراد جدول المرتجعات المنفصل
import DailyOrdersMovementTable from './DailyOrdersMovementTable'; // استيراد حركة الطلبات المنفصل

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

export const toArabicNumerals = (number: string | number): string => {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(number).replace(/[0-9]/g, (digit) => arabicNumerals[parseInt(digit)]);
};

export const formatPrice = (amount: number, isRtl: boolean, isStats: boolean = false): string => {
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

export const formatNumber = (num: number, isRtl: boolean): string => {
  return isRtl ? toArabicNumerals(num) : num.toString();
};

export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

 export const loadFont = async (doc: jsPDF): Promise<boolean> => {
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

export const generateFileName = (title: string, monthName: string, isRtl: boolean): string => {
  const date = new Date().toISOString().split('T')[0];
  return isRtl ? `${title}_${monthName}_${date}.pdf` : `${title}_${monthName}_${date}.pdf`;
};

export const generatePDFHeader = (
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

export const generatePDFTable = (
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
      if (data.section === 'body' && data.column.index >= (isRtl ? 0 : headers.length - 2)) {
        data.cell.styles.fontStyle = 'bold';
      }
      if (isRtl) {
        data.cell.text = data.cell.text.map(text => String(text).replace(/[0-9]/g, d => toArabicNumerals(d)));
      }
    },
    didDrawPage: (data) => {
      doc.setFont(fontLoaded ? fontName : 'helvetica', 'normal');
    },
  });
};

export const exportToPDF = async (
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
  const [stockInData, setStockInData] = useState<{ [month: number]: StockRow[] }>({});
  const [stockOutData, setStockOutData] = useState<{ [month: number]: StockRow[] }>({});
  const [returnData, setReturnData] = useState<{ [month: number]: ReturnRow[] }>({});
  const [salesData, setSalesData] = useState<{ [month: number]: SalesRow[] }>({});
  const [ordersVsReturnsData, setOrdersVsReturnsData] = useState<{ [month: number]: OrdersVsReturnsRow[] }>({});
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(9); // أكتوبر 2025 (بناءً على التاريخ الحالي 16 أكتوبر 2025)
  const [activeTab, setActiveTab] = useState<'orders' | 'stockIn' | 'stockOut' | 'returns' | 'sales' | 'ordersVsReturns'>('orders');
  const currentDate = new Date(); // تاريخ حالي ديناميكي مع timezone
  const currentYear = currentDate.getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: new Date(currentYear, i).toLocaleString(language, { month: 'long' }),
  }));

  // حالات للبحث والفلترة
  const [searchProduct, setSearchProduct] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all'); // 'all' لكل الفروع
  const [selectedWeek, setSelectedWeek] = useState('all'); // 'all', 'week1', 'week2', etc.
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

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

  // خيارات الدروب داون للفروع
  const branchOptions = useMemo(() => [
    { value: 'all', label: isRtl ? 'كل الفروع' : 'All Branches' },
    ...branches.map(b => ({ value: b.displayName, label: b.displayName })),
  ], [branches, isRtl]);

  // خيارات الأسابيع (قسم الشهر إلى 4 أسابيع تقريباً)
  const weekOptions = useMemo(() => [
    { value: 'all', label: isRtl ? 'كل الشهر' : 'Full Month' },
    { value: 'week1', label: isRtl ? 'الأسبوع 1 (1-7)' : 'Week 1 (1-7)' },
    { value: 'week2', label: isRtl ? 'الأسبوع 2 (8-14)' : 'Week 2 (8-14)' },
    { value: 'week3', label: isRtl ? 'الأسبوع 3 (15-21)' : 'Week 3 (15-21)' },
    { value: 'week4', label: isRtl ? 'الأسبوع 4 (22+)' : 'Week 4 (22+)' },
  ], [isRtl]);

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

        const branchMap = new Map<string, string>(fetchedBranches.map(b => [b._id, b.displayName]));

        // Process product details with language support
        const productDetails = new Map<string, { code: string; product: string; unit: string; price: number }>();
        inventory.forEach((item: any) => {
          if (item?.product?._id) {
            productDetails.set(item.product._id, {
              code: item.product.code || `code-${Math.random().toString(36).substring(2)}`,
              product: isRtl ? (item.product.name || 'منتج غير معروف') : (item.product.nameEn || item.product.name || 'Unknown Product'),
              unit: isRtl ? (item.product.unit || 'غير محدد') : (item.product.unitEn || item.product.unit || 'N/A'),
              price: Number(item.product.price) || 0,
            });
          }
        });

        // Process orders with improved fetching - no fallback, ensure complete data
        let orders = Array.isArray(ordersResponse) ? ordersResponse : [];
        if (orders.length === 0) {
          toast.warning(isRtl ? 'لا توجد طلبات مكتملة، يرجى التحقق من البيانات' : 'No completed orders, please check data');
        }

        // Process data for each month
        for (let month = 0; month < 12; month++) {
          const daysInMonthCount = new Date(currentYear, month + 1, 0).getDate();
          const orderMap = new Map<string, OrderRow>();
          const ordersDailyMap = new Map<string, { dailyOrders: number[]; totalOrders: number; totalPrice: number; code: string; product: string; unit: string }>();
          const stockInMap = new Map<string, StockRow>();
          const stockOutMap = new Map<string, StockRow>();
          const returnMap = new Map<string, ReturnRow>();
          const salesMap = new Map<string, SalesRow>();

          // Process orders with date validation
          orders.forEach((order: any) => {
            const status = order.status || order.orderStatus;
            if (status !== 'completed') return;
            const date = new Date(order.createdAt || order.date);
            if (isNaN(date.getTime())) return;
            const orderMonth = date.getMonth();
            const year = date.getFullYear();
            if (year === currentYear && orderMonth === month) {
              const day = date.getDate() - 1;
              const branch = branchMap.get(order.branch?._id || order.branchId) || (isRtl ? 'الفرع الرئيسي' : 'Main Branch');
              (order.items || []).forEach((item: any) => {
                const productId = item.product?._id || item.productId;
                if (!productId) return;
                const details = productDetails.get(productId) || {
                  code: item.product?.code || `code-${Math.random().toString(36).substring(2)}`,
                  product: isRtl ? (item.product?.name || 'منتج غير معروف') : (item.product?.nameEn || item.product?.name || 'Unknown Product'),
                  unit: isRtl ? (item.product?.unit || 'غير محدد') : (item.product?.unitEn || item.product?.unit || 'N/A'),
                  price: Number(item.price) || 0,
                };
                const key = `${productId}-${month}`;
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
                const row = orderMap.get(key)!;
                const quantity = Number(item.quantity) || 0;
                row.branchQuantities[branch] = (row.branchQuantities[branch] || 0) + quantity;
                row.totalQuantity += quantity;
                row.totalPrice += quantity * details.price;
                row.sales = row.totalPrice * 0.1;

                // Daily orders for new table
                if (!ordersDailyMap.has(key)) {
                  ordersDailyMap.set(key, {
                    dailyOrders: Array(daysInMonthCount).fill(0),
                    totalOrders: 0,
                    totalPrice: 0,
                    code: details.code,
                    product: details.product,
                    unit: details.unit,
                  });
                }
                const dailyRow = ordersDailyMap.get(key)!;
                dailyRow.dailyOrders[day] += quantity;
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

          // Process inventory movements with complete product fetching
          inventory.forEach((item: any) => {
            const productId = item?.product?._id;
            if (!productId) return;
            const details = productDetails.get(productId) || {
              code: item.product?.code || `code-${Math.random().toString(36).substring(2)}`,
              product: isRtl ? (item.product?.name || 'منتج غير معروف') : (item.product?.nameEn || item.product?.name || 'Unknown Product'),
              unit: isRtl ? (item.product?.unit || 'غير محدد') : (item.product?.unitEn || item.product?.unit || 'N/A'),
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
                    returnRow.totalOrders = ordersDailyMap.get(key)?.totalOrders || 0;
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
          ordersDailyMap.forEach((_, key) => productKeys.add(key));
          returnMap.forEach((_, key) => productKeys.add(key));

          const ordersVsReturnsMap = new Map<string, OrdersVsReturnsRow>();
          productKeys.forEach((key) => {
            const ordersRow = ordersDailyMap.get(key) || {
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
          monthlyStockInData[month] = Array.from(stockInMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
          monthlyStockOutData[month] = Array.from(stockOutMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
          monthlyReturnData[month] = Array.from(returnMap.values()).sort((a, b) => b.totalReturns - a.totalReturns);
          monthlySalesData[month] = Array.from(salesMap.values()).sort((a, b) => b.totalSales - a.totalSales);
          monthlyOrdersVsReturnsData[month] = Array.from(ordersVsReturnsMap.values()).sort((a, b) => b.totalRatio - a.totalRatio);
        }

        setOrderData(monthlyOrderData);
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

  // فلتر البيانات بناءً على البحث والفلاتر (تمريره للمكونات)
  const filterData = <T extends { product: string; branchQuantities?: { [key: string]: number } }>(data: T[]): T[] => {
    let filtered = data.filter(row => row.product.toLowerCase().includes(searchProduct.toLowerCase()));
    if (selectedBranch !== 'all') {
      filtered = filtered.filter(row => row.branchQuantities && row.branchQuantities[selectedBranch] > 0);
    }
    // فلتر الفترة (أسابيع أو تاريخ)
    const monthStart = new Date(currentYear, selectedMonth, 1);
    const monthEnd = new Date(currentYear, selectedMonth + 1, 0);
    let start = monthStart;
    let end = monthEnd;
    if (selectedWeek !== 'all') {
      const weekNum = parseInt(selectedWeek.replace('week', ''));
      start = new Date(currentYear, selectedMonth, (weekNum - 1) * 7 + 1);
      end = new Date(currentYear, selectedMonth, Math.min(weekNum * 7, monthEnd.getDate()));
    } else if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    }
    // فلتر الصفوف بناءً على الفترة (هنا مجرد مثال، يمكن تعديل حسب البيانات اليومية)
    filtered = filtered.filter(row => true); // أضف منطق فلتر يومي إذا لزم (مثل جمع dailyQuantities في الفترة)
    return filtered;
  };

  return (
    <div className={`min-h-screen px-6 py-8 ${isRtl ? 'rtl font-amiri' : 'ltr font-inter'} bg-gray-100`}>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">{isRtl ? 'تقارير الإنتاج' : 'Production Reports'}</h1>
      <div className="mb-8 bg-white shadow-md rounded-xl p-4">
        <div className="flex flex-wrap gap-2 mb-4 justify-center">
          {months.map(month => (
            <Button
              key={month.value}
              variant={selectedMonth === month.value ? 'primary' : 'secondary'}
              onClick={() => setSelectedMonth(month.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                selectedMonth === month.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {month.label}
            </Button>
          ))}
        </div>
        <div className={`flex flex-wrap gap-2 justify-center ${isRtl ? 'flex-row-reverse' : ''}`}>
          <Button
            variant={activeTab === 'orders' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              activeTab === 'orders' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isRtl ? 'الطلبات' : 'Orders'}
          </Button>
          <Button
            variant={activeTab === 'stockIn' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('stockIn')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              activeTab === 'stockIn' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isRtl ? 'إدخال المخزون' : 'Stock In'}
          </Button>
          <Button
            variant={activeTab === 'stockOut' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('stockOut')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              activeTab === 'stockOut' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isRtl ? 'إخراج المخزون' : 'Stock Out'}
          </Button>
          <Button
            variant={activeTab === 'returns' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('returns')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              activeTab === 'returns' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isRtl ? 'المرتجعات' : 'Returns'}
          </Button>
          <Button
            variant={activeTab === 'sales' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('sales')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              activeTab === 'sales' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isRtl ? 'المبيعات' : 'Sales'}
          </Button>
          <Button
            variant={activeTab === 'ordersVsReturns' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('ordersVsReturns')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              activeTab === 'ordersVsReturns' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isRtl ? 'حركة الطلبات بالنسبة للمرتجعات' : 'Orders vs Returns'}
          </Button>
        </div>
      </div>
      {/* فورم البحث والفلترة */}
      <div className="mb-6 bg-white p-4 rounded-xl shadow-md flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder={isRtl ? 'بحث حسب المنتج' : 'Search by Product'}
            value={searchProduct}
            onChange={(e) => setSearchProduct(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <ProductDropdown
          value={selectedBranch}
          onChange={setSelectedBranch}
          options={branchOptions}
          ariaLabel={isRtl ? 'اختر الفرع' : 'Select Branch'}
        />
        <ProductDropdown
          value={selectedWeek}
          onChange={setSelectedWeek}
          options={weekOptions}
          ariaLabel={isRtl ? 'اختر الأسبوع' : 'Select Week'}
        />
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-500" />
          <input
            type="date"
            value={startDate || ''}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="date"
            value={endDate || ''}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <AnimatePresence>
        {activeTab === 'orders' && (
          <OrdersTable
            data={filterData(orderData[selectedMonth] || [])}
            title={isRtl ? 'تقرير الطلبات' : 'Orders Report'}
            month={selectedMonth}
            isRtl={isRtl}
            loading={loading}
            allBranches={allBranches}
            months={months}
            formatPrice={formatPrice}
            formatNumber={formatNumber}
          />
        )}
        {activeTab === 'stockIn' && renderStockTable(stockInData[selectedMonth] || [], isRtl ? 'تقرير إدخال المخزون' : 'Stock In Report', selectedMonth, 'in')}
        {activeTab === 'stockOut' && renderStockTable(stockOutData[selectedMonth] || [], isRtl ? 'تقرير إخراج المخزون' : 'Stock Out Report', selectedMonth, 'out')}
        {activeTab === 'returns' && (
          <ReturnsTable
            data={filterData(returnData[selectedMonth] || [])}
            title={isRtl ? 'تقرير المرتجعات' : 'Returns Report'}
            month={selectedMonth}
            isRtl={isRtl}
            loading={loading}
            daysInMonth={daysInMonth}
            months={months}
            formatPrice={formatPrice}
            formatNumber={formatNumber}
          />
        )}
        {activeTab === 'sales' && renderSalesTable(salesData[selectedMonth] || [], isRtl ? 'تقرير المبيعات' : 'Sales Report', selectedMonth)}
        {activeTab === 'ordersVsReturns' && (
          <DailyOrdersMovementTable
            data={filterData(ordersVsReturnsData[selectedMonth] || [])}
            title={isRtl ? 'تقرير حركة الطلبات بالنسبة للمرتجعات' : 'Orders vs Returns Report'}
            month={selectedMonth}
            isRtl={isRtl}
            loading={loading}
            daysInMonth={daysInMonth}
            months={months}
            formatNumber={formatNumber}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductionReport;