import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/UI/Button';
import { Select } from '../components/UI/Select';
import { Input } from '../components/UI/Input';
import { Upload, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { inventoryAPI, ordersAPI, branchesAPI } from '../services/api';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/UI/Tooltip';

interface OrderRow {
  id: string;
  product: string;
  branchQuantities: { [branch: string]: number };
  totalQuantity: number;
  totalPrice: number;
}

interface StockRow {
  id: string;
  product: string;
  totalQuantity: number;
  dailyQuantities: number[];
  changes: number[];
  totalPrice: number;
}

interface SalesRow {
  id: string;
  product: string;
  totalQuantity: number;
  dailyQuantities: number[];
  changes: number[];
  totalPrice: number;
}

interface ReturnRow {
  id: string;
  product: string;
  totalQuantity: number;
  dailyQuantities: number[];
  changes: number[];
  totalPrice: number;
}

interface Branch {
  _id: string;
  name: string;
  nameEn: string;
  displayName: string;
}

const ProductionReport: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<OrderRow[]>([]);
  const [salesData, setSalesData] = useState<SalesRow[]>([]);
  const [returnData, setReturnData] = useState<ReturnRow[]>([]);
  const [stockInData, setStockInData] = useState<StockRow[]>([]);
  const [stockOutData, setStockOutData] = useState<StockRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [periodType, setPeriodType] = useState<'month' | 'week' | 'custom'>('month');
  const [selectedMonth, setSelectedMonth] = useState(9); // October 2025 (0-based)
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const currentYear = new Date().getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: new Date(currentYear, i).toLocaleString(language, { month: 'long' }),
  }));
  const weeks = Array.from({ length: 53 }, (_, i) => ({
    value: i + 1,
    label: `${isRtl ? 'أسبوع' : 'Week'} ${i + 1}`,
  }));

  const branchOrder = useMemo(() => [
    'MASSAF', 'ALOWARA', 'AL ASSYAH', 'BADAYA', 'R.KABARA', 'AL RASS',
    'ONAIZA', 'ALSAFA', 'BASATHEEN', 'FAIZIYA', 'OFUQ', 'RAYYAN'
  ], []);

  const getPeriodDates = useCallback(() => {
    let start: Date, end: Date;
    if (periodType === 'month') {
      start = new Date(currentYear, selectedMonth, 1);
      end = new Date(currentYear, selectedMonth + 1, 0);
    } else if (periodType === 'week') {
      start = new Date(currentYear, 0, 1);
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek + (selectedWeek - 1) * 7);
      end = new Date(start);
      end.setDate(end.getDate() + 6);
    } else { // custom
      if (!startDate || !endDate) {
        start = new Date();
        end = new Date();
      } else {
        start = new Date(startDate);
        end = new Date(endDate);
      }
    }
    return { start, end };
  }, [periodType, selectedMonth, selectedWeek, startDate, endDate, currentYear]);

  const getDaysInPeriod = useCallback(() => {
    const { start, end } = getPeriodDates();
    const days: string[] = [];
    let current = new Date(start);
    while (current <= end) {
      days.push(current.toLocaleString(language, { weekday: 'long', day: 'numeric', month: 'long' }));
      current.setDate(current.getDate() + 1);
    }
    return days;
  }, [getPeriodDates, language]);

  const daysInPeriod = useMemo(() => getDaysInPeriod(), [getDaysInPeriod]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [inventory, orders, branchesResponse, history] = await Promise.all([
          inventoryAPI.getInventory({}, isRtl),
          ordersAPI.getAll({ status: 'completed', page: 1, limit: 1000 }, isRtl),
          branchesAPI.getAll(),
          inventoryAPI.getHistory({ period: 'monthly' }), // Adjusted for monthly history
        ]);

        const fetchedBranches = branchesResponse
          .filter((branch: any) => branch && branch._id)
          .map((branch: any) => ({
            _id: branch._id,
            name: branch.name || (isRtl ? 'غير معروف' : 'Unknown'),
            nameEn: branch.nameEn,
            displayName: isRtl ? branch.name : branch.nameEn || branch.name,
          }))
          .sort((a: Branch, b: Branch) => a.displayName.localeCompare(b.displayName, language));
        setBranches(fetchedBranches);

        const { start, end } = getPeriodDates();
        const daysCount = daysInPeriod.length;

        const orderMap = new Map<string, OrderRow>();
        const salesMap = new Map<string, SalesRow>();
        const returnMap = new Map<string, ReturnRow>();
        const stockInMap = new Map<string, StockRow>();
        const stockOutMap = new Map<string, StockRow>();

        // Process orders
        if (Array.isArray(orders)) {
          orders.forEach((order: any) => {
            const status = order.status || order.orderStatus;
            if (status !== 'completed') return;
            const date = new Date(order.createdAt || order.date);
            if (isNaN(date.getTime()) || date < start || date > end) return;
            const branch = order.branch?.displayName || order.branch?.name || order.branchId || (isRtl ? 'الفرع الرئيسي' : 'Main Branch');
            (order.items || []).forEach((item: any) => {
              const product = item.displayProductName || item.product?.name || item.productName || (isRtl ? 'منتج غير معروف' : 'Unknown Product');
              const key = product;
              if (!orderMap.has(key)) {
                orderMap.set(key, {
                  id: key,
                  code: item.product?.code || '',
                  product,
                  unit: item.unit || 'unit',
                  branchQuantities: {},
                  totalQuantity: 0,
                  totalPrice: 0,
                  sales: 0,
                  actualSales: 0,
                });
              }
              const row = orderMap.get(key)!;
              const quantity = Number(item.quantity) || 0;
              const price = Number(item.price) || 0;
              row.branchQuantities[branch] = (row.branchQuantities[branch] || 0) + quantity;
              row.totalQuantity += quantity;
              row.totalPrice += quantity * price;
              row.actualSales += quantity;
              row.sales = row.totalPrice * 0.10;
            });
          });
        }

        // Process inventory history for sales, returns, stock in, stock out
        if (Array.isArray(history)) {
          history.forEach((movement: any) => {
            const date = new Date(movement.createdAt);
            if (isNaN(date.getTime()) || date < start || date > end) return;
            const dayIndex = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            const product = movement.productName || movement.product?.name || (isRtl ? 'منتج غير معروف' : 'Unknown Product');
            const key = product;
            const quantity = Number(movement.quantity) || 0;
            const price = Number(movement.product?.price) || 0;
            let map;
            if (movement.action === 'sale') {
              map = salesMap;
            } else if (movement.action === 'return_approved' || movement.action === 'return_rejected') {
              map = returnMap;
            } else if (movement.quantity > 0) {
              map = stockInMap;
            } else {
              map = stockOutMap;
            }
            if (!map.has(key)) {
              map.set(key, {
                id: key,
                product,
                code: movement.product?.code || '',
                unit: movement.product?.unit || 'unit',
                totalQuantity: 0,
                dailyQuantities: Array(daysCount).fill(0),
                changes: Array(daysCount).fill(0),
                totalPrice: 0,
              });
            }
            const row = map.get(key)!;
            const absQuantity = Math.abs(quantity);
            row.dailyQuantities[dayIndex] += absQuantity;
            row.totalQuantity += absQuantity;
            row.totalPrice += absQuantity * price;
            if (dayIndex > 0) {
              row.changes[dayIndex] = row.dailyQuantities[dayIndex] - row.dailyQuantities[dayIndex - 1];
            } else {
              row.changes[0] = row.dailyQuantities[0];
            }
          });
        }

        setOrderData(Array.from(orderMap.values()));
        setSalesData(Array.from(salesMap.values()));
        setReturnData(Array.from(returnMap.values()));
        setStockInData(Array.from(stockInMap.values()));
        setStockOutData(Array.from(stockOutMap.values()));
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isRtl, periodType, selectedMonth, selectedWeek, startDate, endDate, daysInPeriod, language]);

  const allBranches = useMemo(() => {
    const branchesSet = new Set<string>();
    orderData.forEach(row => {
      Object.keys(row.branchQuantities).forEach(branch => branchesSet.add(branch));
    });
    return branchOrder.filter(b => branchesSet.has(b)).concat(Array.from(branchesSet).filter(b => !branchOrder.includes(b)));
  }, [orderData, branchOrder]);

  const renderOrderTable = useCallback(
    (data: OrderRow[], title: string) => {
      const totalQuantities = allBranches.reduce((acc, branch) => {
        acc[branch] = data.reduce((sum, row) => sum + (row.branchQuantities[branch] || 0), 0);
        return acc;
      }, {} as { [branch: string]: number });
      const grandTotalQuantity = data.reduce((sum, row) => sum + row.totalQuantity, 0);
      const grandTotalPrice = data.reduce((sum, row) => sum + row.totalPrice, 0);
      const periodLabel = periodType === 'month' 
        ? months[selectedMonth].label 
        : periodType === 'week' 
          ? `${isRtl ? 'أسبوع' : 'Week'} ${selectedWeek}` 
          : `${startDate} - ${endDate}`;

      const exportTable = (format: 'excel' | 'pdf') => {
        const headers = [
          isRtl ? 'الكود' : 'Code',
          isRtl ? 'المنتج' : 'Product',
          isRtl ? 'الوحدة' : 'Unit',
          ...allBranches,
          isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
          isRtl ? 'السعر الإجمالي' : 'Total Price',
        ];
        const rows = [
          ...data.map(row => ({
            code: row.code,
            product: row.product,
            unit: row.unit,
            ...allBranches.reduce((acc, branch) => {
              acc[branch] = row.branchQuantities[branch] || 0;
              return acc;
            }, {} as { [key: string]: number }),
            totalQuantity: row.totalQuantity,
            totalPrice: Math.floor(row.totalPrice) + ' SAR',
          })),
          {
            code: '',
            product: isRtl ? 'الإجمالي' : 'Total',
            unit: '',
            ...allBranches.reduce((acc, branch) => {
              acc[branch] = totalQuantities[branch] || 0;
              return acc;
            }, {} as { [key: string]: number }),
            totalQuantity: grandTotalQuantity,
            totalPrice: Math.floor(grandTotalPrice) + ' SAR',
          },
        ];

        if (format === 'excel') {
          const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows, { header: headers });
          if (isRtl) ws['!views'] = [{ RTL: true }];
          ws['!cols'] = [{ wch: 10 }, { wch: 20 }, { wch: 10 }, ...allBranches.map(() => ({ wch: 10 })) , { wch: 15 }, { wch: 15 }];
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, `${title}_${periodLabel}`);
          XLSX.writeFile(wb, `${title}_${periodLabel}.xlsx`);
        } else if (format === 'pdf') {
          const doc = new jsPDF({ orientation: 'landscape' });
          doc.autoTable({
            head: [headers],
            body: rows.map(row => [
              row.code,
              row.product,
              row.unit,
              ...allBranches.map(branch => row[branch]),
              row.totalQuantity,
              row.totalPrice,
            ]),
            styles: { font: isRtl ? 'Amiri' : 'Helvetica', halign: isRtl ? 'right' : 'left', fontSize: 10 },
            headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontSize: 10 },
            bodyStyles: { fontSize: 9 },
            footStyles: { fillColor: [240, 240, 240], fontSize: 10, fontStyle: 'bold' },
          });
          doc.save(`${title}_${periodLabel}.pdf`);
        }
      };

      if (loading) return <OrderTableSkeleton isRtl={isRtl} />;
      if (data.length === 0) {
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-center py-12 bg-white shadow-sm rounded-lg border border-gray-100"
          >
            <p className="text-gray-500 text-sm font-medium">{isRtl ? 'لا توجد بيانات' : 'No data available'}</p>
          </motion.div>
        );
      }

      return (
        <div className="mb-8">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h2 className="text-lg font-semibold text-gray-800">{isRtl ? `${title} - ${months[selectedMonth].label}` : `${title} - ${months[selectedMonth].label}`}</h2>
            <div className="flex gap-2">
              <Button
                variant={data.length > 0 ? 'primary' : 'secondary'}
                onClick={data.length > 0 ? () => exportTable('excel') : undefined}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium ${
                  data.length > 0 ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
                disabled={data.length === 0}
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير إكسل' : 'Export Excel'}
              </Button>
              <Button
                variant={data.length > 0 ? 'primary' : 'secondary'}
                onClick={data.length > 0 ? () => exportTable('pdf') : undefined}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium ${
                  data.length > 0 ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
                disabled={data.length === 0}
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير PDF' : 'Export PDF'}
              </Button>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="overflow-x-auto rounded-lg shadow-sm border border-gray-100 bg-white"
          >
            <table className="min-w-full divide-y divide-gray-100 text-xs">
              <thead className="bg-blue-50 sticky top-0">
                <tr className={isRtl ? 'flex-row-reverse' : ''}>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[80px]">
                    {isRtl ? 'الكود' : 'Code'}
                  </th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[120px]">
                    {isRtl ? 'المنتج' : 'Product'}
                  </th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[80px]">
                    {isRtl ? 'الوحدة' : 'Unit'}
                  </th>
                  {allBranches.map(branch => (
                    <th key={branch} className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[100px]">
                      {branch}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}
                  </th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'السعر الإجمالي' : 'Total Price'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map(row => (
                  <tr key={row.id} className={`hover:bg-blue-50/50 transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <td className="px-3 py-2 text-gray-700 text-center truncate">{row.code}</td>
                    <td className="px-3 py-2 text-gray-700 text-center truncate">{row.product}</td>
                    <td className="px-3 py-2 text-gray-700 text-center truncate">{row.unit}</td>
                    {allBranches.map(branch => (
                      <td key={branch} className="px-3 py-2 text-gray-700 text-center">
                        {row.branchQuantities[branch] || 0}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-gray-700 text-center font-medium">{row.totalQuantity}</td>
                    <td className="px-3 py-2 text-gray-700 text-center font-medium">
                      {row.totalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}
                    </td>
                  </tr>
                ))}
                <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-3 py-2 text-gray-800 text-center">{isRtl ? 'الإجمالي' : 'Total'}</td>
                  <td className="px-3 py-2 text-gray-800 text-center"></td>
                  <td className="px-3 py-2 text-gray-800 text-center"></td>
                  {allBranches.map(branch => (
                    <td key={branch} className="px-3 py-2 text-gray-800 text-center">
                      {totalQuantities[branch] || 0}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-gray-800 text-center">{grandTotalQuantity}</td>
                  <td className="px-3 py-2 text-gray-800 text-center">
                    {grandTotalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}
                  </td>
                </tr>
              </tbody>
            </table>
          </motion.div>
        </div>
      );
    },
    [loading, isRtl, allBranches, months, currentYear, language]
  );

  const renderStockInTable = useCallback(
    (data: StockRow[], title: string, month: number) => {
      const grandTotalQuantity = data.reduce((sum, row) => sum + row.totalQuantity, 0);
      const grandTotalPrice = data.reduce((sum, row) => sum + row.totalPrice, 0);

      const exportTable = (format: 'excel' | 'pdf') => {
        const monthName = new Date(currentYear, month, 1).toLocaleString(language, { month: 'long' });
        const headers = [
          isRtl ? 'رقم' : 'No.',
          isRtl ? 'المنتج' : 'Product',
          isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
          isRtl ? 'السعر الإجمالي' : 'Total Price',
          ...daysInMonth,
        ];
        const rows = [
          ...data.map((row, index) => ({
            no: index + 1,
            product: row.product,
            totalQuantity: row.totalQuantity,
            totalPrice: row.totalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' }),
            ...Object.fromEntries(row.dailyQuantities.map((qty, i) => [daysInMonth[i], qty])),
          })),
          {
            no: '',
            product: isRtl ? 'الإجمالي' : 'Total',
            totalQuantity: grandTotalQuantity,
            totalPrice: grandTotalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' }),
            ...Object.fromEntries(daysInMonth.map((_, i) => [daysInMonth[i], data.reduce((sum, row) => sum + row.dailyQuantities[i], 0)])),
          },
        ];

        if (format === 'excel') {
          const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows, { header: headers });
          if (isRtl) ws['!views'] = [{ RTL: true }];
          ws['!cols'] = [{ wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, ...daysInMonth.map(() => ({ wch: 15 }))];
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, `${title}_${monthName}`);
          XLSX.writeFile(wb, `${title}_${monthName}.xlsx`);
        } else if (format === 'pdf') {
          const doc = new jsPDF();
          doc.autoTable({
            head: [headers],
            body: rows.map(row => [
              row.no,
              row.product,
              row.totalQuantity,
              row.totalPrice,
              ...daysInMonth.map(day => row[day]),
            ]),
            styles: { font: isRtl ? 'Amiri' : 'Helvetica', halign: isRtl ? 'right' : 'left', fontSize: 10 },
            headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontSize: 10 },
            bodyStyles: { fontSize: 9 },
            footStyles: { fillColor: [240, 240, 240], fontSize: 10, fontStyle: 'bold' },
          });
          doc.save(`${title}_${monthName}.pdf`);
        }
      };

      if (loading) return <OrderTableSkeleton isRtl={isRtl} />;
      if (data.length === 0) {
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-center py-12 bg-white shadow-sm rounded-lg border border-gray-100"
          >
            <p className="text-gray-500 text-sm font-medium">{isRtl ? 'لا توجد بيانات' : 'No data available'}</p>
          </motion.div>
        );
      }

      return (
        <div className="mb-8">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h2 className="text-lg font-semibold text-gray-800">{isRtl ? `${title} - ${months[month].label}` : `${title} - ${months[month].label}`}</h2>
            <div className="flex gap-2">
              <Button
                variant={data.length > 0 ? 'primary' : 'secondary'}
                onClick={data.length > 0 ? () => exportTable('excel') : undefined}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium ${
                  data.length > 0 ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
                disabled={data.length === 0}
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير إكسل' : 'Export Excel'}
              </Button>
              <Button
                variant={data.length > 0 ? 'primary' : 'secondary'}
                onClick={data.length > 0 ? () => exportTable('pdf') : undefined}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium ${
                  data.length > 0 ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
                disabled={data.length === 0}
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير PDF' : 'Export PDF'}
              </Button>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="overflow-x-auto rounded-lg shadow-sm border border-gray-100 bg-white"
          >
            <table className="min-w-full divide-y divide-gray-100 text-xs">
              <thead className="bg-blue-50 sticky top-0">
                <tr className={isRtl ? 'flex-row-reverse' : ''}>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[40px]">{isRtl ? 'رقم' : 'No.'}</th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[120px]">{isRtl ? 'المنتج' : 'Product'}</th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}
                  </th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'السعر الإجمالي' : 'Total Price'}
                  </th>
                  {daysInMonth.map((day, i) => (
                    <th key={i} className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[120px]">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((row, index) => (
                  <tr key={row.id} className={`hover:bg-blue-50/50 transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <td className="px-3 py-2 text-gray-700 text-center">{index + 1}</td>
                    <td className="px-3 py-2 text-gray-700 text-center truncate">{row.product}</td>
                    <td className="px-3 py-2 text-gray-700 text-center font-medium">{row.totalQuantity}</td>
                    <td className="px-3 py-2 text-gray-700 text-center font-medium">
                      {row.totalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}
                    </td>
                    {row.dailyQuantities.map((qty, i) => (
                      <td
                        key={i}
                        className={`px-3 py-2 text-center text-green-600 font-medium`}
                      >
                        {qty} {row.changes[i] !== 0 && `(+${row.changes[i]})`}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-3 py-2 text-gray-800 text-center" colSpan={2}>{isRtl ? 'الإجمالي' : 'Total'}</td>
                  <td className="px-3 py-2 text-gray-800 text-center">{grandTotalQuantity}</td>
                  <td className="px-3 py-2 text-gray-800 text-center">
                    {grandTotalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}
                  </td>
                  {daysInMonth.map((_, i) => (
                    <td key={i} className="px-3 py-2 text-gray-800 text-center">
                      {data.reduce((sum, row) => sum + row.dailyQuantities[i], 0)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </motion.div>
        </div>
      );
    },
    [loading, isRtl, daysInMonth, months, currentYear, language]
  );

  const renderStockOutTable = useCallback(
    (data: StockRow[], title: string, month: number) => {
      const grandTotalQuantity = data.reduce((sum, row) => sum + row.totalQuantity, 0);
      const grandTotalPrice = data.reduce((sum, row) => sum + row.totalPrice, 0);

      const exportTable = (format: 'excel' | 'pdf') => {
        const monthName = new Date(currentYear, month, 1).toLocaleString(language, { month: 'long' });
        const headers = [
          isRtl ? 'رقم' : 'No.',
          isRtl ? 'المنتج' : 'Product',
          isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
          isRtl ? 'السعر الإجمالي' : 'Total Price',
          ...daysInMonth,
        ];
        const rows = [
          ...data.map((row, index) => ({
            no: index + 1,
            product: row.product,
            totalQuantity: row.totalQuantity,
            totalPrice: row.totalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' }),
            ...Object.fromEntries(row.dailyQuantities.map((qty, i) => [daysInMonth[i], qty])),
          })),
          {
            no: '',
            product: isRtl ? 'الإجمالي' : 'Total',
            totalQuantity: grandTotalQuantity,
            totalPrice: grandTotalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' }),
            ...Object.fromEntries(daysInMonth.map((_, i) => [daysInMonth[i], data.reduce((sum, row) => sum + row.dailyQuantities[i], 0)])),
          },
        ];

        if (format === 'excel') {
          const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows, { header: headers });
          if (isRtl) ws['!views'] = [{ RTL: true }];
          ws['!cols'] = [{ wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, ...daysInMonth.map(() => ({ wch: 15 }))];
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, `${title}_${monthName}`);
          XLSX.writeFile(wb, `${title}_${monthName}.xlsx`);
        } else if (format === 'pdf') {
          const doc = new jsPDF();
          doc.autoTable({
            head: [headers],
            body: rows.map(row => [
              row.no,
              row.product,
              row.totalQuantity,
              row.totalPrice,
              ...daysInMonth.map(day => row[day]),
            ]),
            styles: { font: isRtl ? 'Amiri' : 'Helvetica', halign: isRtl ? 'right' : 'left', fontSize: 10 },
            headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontSize: 10 },
            bodyStyles: { fontSize: 9 },
            footStyles: { fillColor: [240, 240, 240], fontSize: 10, fontStyle: 'bold' },
          });
          doc.save(`${title}_${monthName}.pdf`);
        }
      };

      if (loading) return <OrderTableSkeleton isRtl={isRtl} />;
      if (data.length === 0) {
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-center py-12 bg-white shadow-sm rounded-lg border border-gray-100"
          >
            <p className="text-gray-500 text-sm font-medium">{isRtl ? 'لا توجد بيانات' : 'No data available'}</p>
          </motion.div>
        );
      }

      return (
        <div className="mb-8">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h2 className="text-lg font-semibold text-gray-800">{isRtl ? `${title} - ${months[month].label}` : `${title} - ${months[month].label}`}</h2>
            <div className="flex gap-2">
              <Button
                variant={data.length > 0 ? 'primary' : 'secondary'}
                onClick={data.length > 0 ? () => exportTable('excel') : undefined}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium ${
                  data.length > 0 ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
                disabled={data.length === 0}
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير إكسل' : 'Export Excel'}
              </Button>
              <Button
                variant={data.length > 0 ? 'primary' : 'secondary'}
                onClick={data.length > 0 ? () => exportTable('pdf') : undefined}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium ${
                  data.length > 0 ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
                disabled={data.length === 0}
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير PDF' : 'Export PDF'}
              </Button>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="overflow-x-auto rounded-lg shadow-sm border border-gray-100 bg-white"
          >
            <table className="min-w-full divide-y divide-gray-100 text-xs">
              <thead className="bg-blue-50 sticky top-0">
                <tr className={isRtl ? 'flex-row-reverse' : ''}>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[40px]">{isRtl ? 'رقم' : 'No.'}</th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[120px]">{isRtl ? 'المنتج' : 'Product'}</th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}
                  </th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'السعر الإجمالي' : 'Total Price'}
                  </th>
                  {daysInMonth.map((day, i) => (
                    <th key={i} className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[120px]">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((row, index) => (
                  <tr key={row.id} className={`hover:bg-blue-50/50 transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <td className="px-3 py-2 text-gray-700 text-center">{index + 1}</td>
                    <td className="px-3 py-2 text-gray-700 text-center truncate">{row.product}</td>
                    <td className="px-3 py-2 text-gray-700 text-center font-medium">{row.totalQuantity}</td>
                    <td className="px-3 py-2 text-gray-700 text-center font-medium">
                      {row.totalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}
                    </td>
                    {row.dailyQuantities.map((qty, i) => (
                      <td
                        key={i}
                        className={`px-3 py-2 text-center font-medium ${qty > 0 ? 'bg-green-50/50 text-green-700' : qty < 0 ? 'bg-red-50/50 text-red-700' : 'text-gray-700'}`}
                        title={`${isRtl ? 'الحالة' : 'Status'}: ${qty > 0 ? (isRtl ? 'زيادة' : 'Increase') : qty < 0 ? (isRtl ? 'نقصان' : 'Decrease') : (isRtl ? 'لا تغيير' : 'No change')}`}
                      >
                        {row.changes[i] !== 0 && `${row.changes[i] > 0 ? '+' : ''}${row.changes[i]}`}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-3 py-2 text-gray-800 text-center" colSpan={2}>{isRtl ? 'الإجمالي' : 'Total'}</td>
                  <td className="px-3 py-2 text-gray-800 text-center">{grandTotalQuantity}</td>
                  <td className="px-3 py-2 text-gray-800 text-center">
                    {grandTotalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}
                  </td>
                  {daysInMonth.map((_, i) => (
                    <td key={i} className="px-3 py-2 text-gray-800 text-center">
                      {data.reduce((sum, row) => sum + row.dailyQuantities[i], 0)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </motion.div>
        </div>
      );
    },
    [loading, isRtl, daysInMonth, months, currentYear, language]
  );

  const renderStockOutTable = useCallback(
    (data: StockRow[], title: string, month: number) => {
      const grandTotalQuantity = data.reduce((sum, row) => sum + row.totalQuantity, 0);
      const grandTotalPrice = data.reduce((sum, row) => sum + row.totalPrice, 0);

      const exportTable = (format: 'excel' | 'pdf') => {
        const monthName = new Date(currentYear, month, 1).toLocaleString(language, { month: 'long' });
        const headers = [
          isRtl ? 'رقم' : 'No.',
          isRtl ? 'المنتج' : 'Product',
          isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
          isRtl ? 'السعر الإجمالي' : 'Total Price',
          ...daysInMonth,
        ];
        const rows = [
          ...data.map((row, index) => ({
            no: index + 1,
            product: row.product,
            totalQuantity: row.totalQuantity,
            totalPrice: row.totalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' }),
            ...Object.fromEntries(row.dailyQuantities.map((qty, i) => [daysInMonth[i], qty])),
          })),
          {
            no: '',
            product: isRtl ? 'الإجمالي' : 'Total',
            totalQuantity: grandTotalQuantity,
            totalPrice: grandTotalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' }),
            ...Object.fromEntries(daysInMonth.map((_, i) => [daysInMonth[i], data.reduce((sum, row) => sum + row.dailyQuantities[i], 0)])),
          },
        ];

        if (format === 'excel') {
          const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows, { header: headers });
          if (isRtl) ws['!views'] = [{ RTL: true }];
          ws['!cols'] = [{ wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, ...daysInMonth.map(() => ({ wch: 15 }))];
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, `${title}_${monthName}`);
          XLSX.writeFile(wb, `${title}_${monthName}.xlsx`);
        } else if (format === 'pdf') {
          const doc = new jsPDF();
          doc.autoTable({
            head: [headers],
            body: rows.map(row => [
              row.no,
              row.product,
              row.totalQuantity,
              row.totalPrice,
              ...daysInMonth.map(day => row[day]),
            ]),
            styles: { font: isRtl ? 'Amiri' : 'Helvetica', halign: isRtl ? 'right' : 'left', fontSize: 10 },
            headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontSize: 10 },
            bodyStyles: { fontSize: 9 },
            footStyles: { fillColor: [240, 240, 240], fontSize: 10, fontStyle: 'bold' },
          });
          doc.save(`${title}_${monthName}.pdf`);
        }
      };

      if (loading) return <OrderTableSkeleton isRtl={isRtl} />;
      if (data.length === 0) {
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-center py-12 bg-white shadow-sm rounded-lg border border-gray-100"
          >
            <p className="text-gray-500 text-sm font-medium">{isRtl ? 'لا توجد بيانات' : 'No data available'}</p>
          </motion.div>
        );
      }

      return (
        <div className="mb-8">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h2 className="text-lg font-semibold text-gray-800">{isRtl ? `${title} - ${months[month].label}` : `${title} - ${months[month].label}`}</h2>
            <div className="flex gap-2">
              <Button
                variant={data.length > 0 ? 'primary' : 'secondary'}
                onClick={data.length > 0 ? () => exportTable('excel') : undefined}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium ${
                  data.length > 0 ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
                disabled={data.length === 0}
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير إكسل' : 'Export Excel'}
              </Button>
              <Button
                variant={data.length > 0 ? 'primary' : 'secondary'}
                onClick={data.length > 0 ? () => exportTable('pdf') : undefined}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium ${
                  data.length > 0 ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
                disabled={data.length === 0}
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير PDF' : 'Export PDF'}
              </Button>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="overflow-x-auto rounded-lg shadow-sm border border-gray-100 bg-white"
          >
            <table className="min-w-full divide-y divide-gray-100 text-xs">
              <thead className="bg-blue-50 sticky top-0">
                <tr className={isRtl ? 'flex-row-reverse' : ''}>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[40px]">{isRtl ? 'رقم' : 'No.'}</th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[120px]">{isRtl ? 'المنتج' : 'Product'}</th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}
                  </th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'السعر الإجمالي' : 'Total Price'}
                  </th>
                  {daysInMonth.map((day, i) => (
                    <th key={i} className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[120px]">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((row, index) => (
                  <tr key={row.id} className={`hover:bg-blue-50/50 transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <td className="px-3 py-2 text-gray-700 text-center">{index + 1}</td>
                    <td className="px-3 py-2 text-gray-700 text-center truncate">{row.product}</td>
                    <td className="px-3 py-2 text-gray-700 text-center font-medium">{row.totalQuantity}</td>
                    <td className="px-3 py-2 text-gray-700 text-center font-medium">
                      {row.totalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}
                    </td>
                    {row.dailyQuantities.map((qty, i) => (
                      <td
                        key={i}
                        className={`px-3 py-2 text-center text-red-600 font-medium`}
                      >
                        {qty} {row.changes[i] !== 0 && `(${row.changes[i]})`}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-3 py-2 text-gray-800 text-center" colSpan={2}>{isRtl ? 'الإجمالي' : 'Total'}</td>
                  <td className="px-3 py-2 text-gray-800 text-center">{grandTotalQuantity}</td>
                  <td className="px-3 py-2 text-gray-800 text-center">
                    {grandTotalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}
                  </td>
                  {daysInMonth.map((_, i) => (
                    <td key={i} className="px-3 py-2 text-gray-800 text-center">
                      {data.reduce((sum, row) => sum + row.dailyQuantities[i], 0)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </motion.div>
        </div>
      );
    },
    [loading, isRtl, daysInMonth, months, currentYear, language]
  );

  const renderReturnTable = useCallback(
    (data: ReturnRow[], title: string, month: number) => {
      const grandTotalQuantity = data.reduce((sum, row) => sum + row.totalQuantity, 0);
      const grandTotalPrice = data.reduce((sum, row) => sum + row.totalPrice, 0);

      const exportTable = (format: 'excel' | 'pdf') => {
        const monthName = new Date(currentYear, month, 1).toLocaleString(language, { month: 'long' });
        const headers = [
          isRtl ? 'رقم' : 'No.',
          isRtl ? 'المنتج' : 'Product',
          isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
          isRtl ? 'السعر الإجمالي' : 'Total Price',
          ...daysInMonth,
        ];
        const rows = [
          ...data.map((row, index) => ({
            no: index + 1,
            product: row.product,
            totalQuantity: row.totalQuantity,
            totalPrice: row.totalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' }),
            ...Object.fromEntries(row.dailyQuantities.map((qty, i) => [daysInMonth[i], qty])),
          })),
          {
            no: '',
            product: isRtl ? 'الإجمالي' : 'Total',
            totalQuantity: grandTotalQuantity,
            totalPrice: grandTotalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' }),
            ...Object.fromEntries(daysInMonth.map((_, i) => [daysInMonth[i], data.reduce((sum, row) => sum + row.dailyQuantities[i], 0)])),
          },
        ];

        if (format === 'excel') {
          const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows, { header: headers });
          if (isRtl) ws['!views'] = [{ RTL: true }];
          ws['!cols'] = [{ wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, ...daysInMonth.map(() => ({ wch: 15 }))];
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, `${title}_${monthName}`);
          XLSX.writeFile(wb, `${title}_${monthName}.xlsx`);
        } else if (format === 'pdf') {
          const doc = new jsPDF();
          doc.autoTable({
            head: [headers],
            body: rows.map(row => [
              row.no,
              row.product,
              row.totalQuantity,
              row.totalPrice,
              ...daysInMonth.map(day => row[day]),
            ]),
            styles: { font: isRtl ? 'Amiri' : 'Helvetica', halign: isRtl ? 'right' : 'left', fontSize: 10 },
            headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontSize: 10 },
            bodyStyles: { fontSize: 9 },
            footStyles: { fillColor: [240, 240, 240], fontSize: 10, fontStyle: 'bold' },
          });
          doc.save(`${title}_${monthName}.pdf`);
        }
      };

      if (loading) return <OrderTableSkeleton isRtl={isRtl} />;
      if (data.length === 0) {
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-center py-12 bg-white shadow-sm rounded-lg border border-gray-100"
          >
            <p className="text-gray-500 text-sm font-medium">{isRtl ? 'لا توجد بيانات' : 'No data available'}</p>
          </motion.div>
        );
      }

      return (
        <div className="mb-8">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h2 className="text-lg font-semibold text-gray-800">{isRtl ? `${title} - ${months[month].label}` : `${title} - ${months[month].label}`}</h2>
            <div className="flex gap-2">
              <Button
                variant={data.length > 0 ? 'primary' : 'secondary'}
                onClick={data.length > 0 ? () => exportTable('excel') : undefined}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium ${
                  data.length > 0 ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
                disabled={data.length === 0}
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير إكسل' : 'Export Excel'}
              </Button>
              <Button
                variant={data.length > 0 ? 'primary' : 'secondary'}
                onClick={data.length > 0 ? () => exportTable('pdf') : undefined}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium ${
                  data.length > 0 ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
                disabled={data.length === 0}
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير PDF' : 'Export PDF'}
              </Button>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="overflow-x-auto rounded-lg shadow-sm border border-gray-100 bg-white"
          >
            <table className="min-w-full divide-y divide-gray-100 text-xs">
              <thead className="bg-blue-50 sticky top-0">
                <tr className={isRtl ? 'flex-row-reverse' : ''}>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[40px]">{isRtl ? 'رقم' : 'No.'}</th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[120px]">{isRtl ? 'المنتج' : 'Product'}</th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}
                  </th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'السعر الإجمالي' : 'Total Price'}
                  </th>
                  {daysInMonth.map((day, i) => (
                    <th key={i} className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[120px]">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((row, index) => (
                  <tr key={row.id} className={`hover:bg-blue-50/50 transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <td className="px-3 py-2 text-gray-700 text-center">{index + 1}</td>
                    <td className="px-3 py-2 text-gray-700 text-center truncate">{row.product}</td>
                    <td className="px-3 py-2 text-gray-700 text-center font-medium">{row.totalQuantity}</td>
                    <td className="px-3 py-2 text-gray-700 text-center font-medium">
                      {row.totalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}
                    </td>
                    {row.dailyQuantities.map((qty, i) => (
                      <td
                        key={i}
                        className={`px-3 py-2 text-center text-red-600 font-medium`}
                      >
                        {qty} {row.changes[i] !== 0 && `(${row.changes[i]})`}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-3 py-2 text-gray-800 text-center" colSpan={2}>{isRtl ? 'الإجمالي' : 'Total'}</td>
                  <td className="px-3 py-2 text-gray-800 text-center">{grandTotalQuantity}</td>
                  <td className="px-3 py-2 text-gray-800 text-center">
                    {grandTotalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}
                  </td>
                  {daysInMonth.map((_, i) => (
                    <td key={i} className="px-3 py-2 text-gray-800 text-center">
                      {data.reduce((sum, row) => sum + row.dailyQuantities[i], 0)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </motion.div>
        </div>
      );
    },
    [loading, isRtl, daysInMonth, months, currentYear, language]
  );

  return (
    <div className={`px-4 py-6 min-h-screen ${isRtl ? 'rtl font-amiri' : 'ltr font-inter'} bg-gray-50`}>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{isRtl ? 'تقارير الإنتاج' : 'Production Reports'}</h1>
      <div className="mb-6">
        <div className="flex flex-wrap gap-2 mb-4">
          {months.map(month => (
            <Button
              key={month.value}
              variant={selectedMonth === month.value ? 'primary' : 'secondary'}
              onClick={() => setSelectedMonth(month.value)}
              className={`px-4 py-2 rounded-full text-xs font-medium ${
                selectedMonth === month.value ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {month.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'orders' ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-500' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            {isRtl ? 'توزيع الطلبات' : 'Order Distribution'}
          </button>
          <button
            onClick={() => setActiveTab('stockIn')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'stockIn' ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-500' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            {isRtl ? 'زيادة المخزون' : 'Stock Increases'}
          </button>
          <button
            onClick={() => setActiveTab('stockOut')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'stockOut' ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-500' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            {isRtl ? 'نقصان المخزون' : 'Stock Decreases'}
          </button>
        </div>
      </div>
      <AnimatePresence mode="wait">
        {activeTab === 'orders' && (
          <motion.div key="orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            {renderOrderTable(orderData, isRtl ? 'تقرير توزيع الطلبات' : 'Order Distribution Report')}
          </motion.div>
        )}
        {activeTab === 'stockIn' && (
          <motion.div key="stockIn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            {renderStockInTable(stockInData, isRtl ? 'تقرير زيادة المخزون' : 'Stock Increases Report', selectedMonth)}
          </motion.div>
        )}
        {activeTab === 'stockOut' && (
          <motion.div key="stockOut" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            {renderStockOutTable(stockOutData, isRtl ? 'تقرير نقصان المخزون' : 'Stock Decreases Report', selectedMonth)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductionReport;