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
import { inventoryAPI, ordersAPI } from '../services/api';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';

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

const ProductionReport: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<OrderRow[]>([]);
  const [stockInData, setStockInData] = useState<StockRow[]>([]);
  const [stockOutData, setStockOutData] = useState<StockRow[]>([]);
  const [periodType, setPeriodType] = useState<'month' | 'week' | 'custom'>('month');
  const [selectedMonth, setSelectedMonth] = useState(9); // October 2025 (0-based)
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeTab, setActiveTab] = useState<'orders' | 'stockIn' | 'stockOut'>('orders');
  const currentDate = new Date('2025-10-12T11:19:00+03:00');
  const currentYear = currentDate.getFullYear();
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
        const [inventory, orders] = await Promise.all([
          inventoryAPI.getInventory({}, isRtl),
          ordersAPI.getAll({ status: 'completed', page: 1, limit: 1000 }, isRtl),
        ]);

        const { start, end } = getPeriodDates();
        const daysCount = daysInPeriod.length;

        const orderMap = new Map<string, OrderRow>();
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
                  product,
                  branchQuantities: {},
                  totalQuantity: 0,
                  totalPrice: 0,
                });
              }
              const row = orderMap.get(key)!;
              const quantity = Number(item.quantity) || 0;
              const price = Number(item.price) || 0;
              row.branchQuantities[branch] = (row.branchQuantities[branch] || 0) + quantity;
              row.totalQuantity += quantity;
              row.totalPrice += quantity * price;
            });
          });
        }

        // Process inventory movements
        if (Array.isArray(inventory)) {
          inventory.forEach((item: any) => {
            const product = item.productName || item.product?.name || (isRtl ? 'منتج غير معروف' : 'Unknown Product');
            const assumedPrice = Number(item.product?.price) || 0;
            (item.movements || []).forEach((movement: any) => {
              if (!movement.type || !['in', 'out'].includes(movement.type)) return;
              const date = new Date(movement.createdAt);
              if (isNaN(date.getTime()) || date < start || date > end) return;
              const dayIndex = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
              const key = product;
              const map = movement.type === 'in' ? stockInMap : stockOutMap;
              if (!map.has(key)) {
                map.set(key, {
                  id: key,
                  product,
                  totalQuantity: 0,
                  dailyQuantities: Array(daysCount).fill(0),
                  changes: Array(daysCount).fill(0),
                  totalPrice: 0,
                });
              }
              const row = map.get(key)!;
              const quantity = Math.abs(Number(movement.quantity) || 0);
              row.dailyQuantities[dayIndex] += quantity;
              row.totalQuantity += quantity;
              row.totalPrice += quantity * assumedPrice;
              if (dayIndex > 0) {
                row.changes[dayIndex] = row.dailyQuantities[dayIndex] - row.dailyQuantities[dayIndex - 1];
              } else {
                row.changes[0] = row.dailyQuantities[0];
              }
            });
          });
        }

        setOrderData(Array.from(orderMap.values()));
        setStockInData(Array.from(stockInMap.values()));
        setStockOutData(Array.from(stockOutMap.values()));
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isRtl, currentYear, periodType, selectedMonth, selectedWeek, startDate, endDate, daysInPeriod]);

  const allBranches = useMemo(() => {
    const branchesSet = new Set<string>();
    [...orderData, ...stockInData, ...stockOutData].forEach(row => {
      Object.keys(row.branchQuantities || {}).forEach(branch => branchesSet.add(branch));
    });
    return branchOrder.filter(b => branchesSet.has(b)).concat(Array.from(branchesSet).filter(b => !branchOrder.includes(b)));
  }, [orderData, stockInData, stockOutData, branchOrder]);

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
          isRtl ? 'المنتج' : 'Product',
          isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
          isRtl ? 'السعر الإجمالي' : 'Total Price',
          ...allBranches.map(b => b),
        ];
        const rows = [
          ...data.map(row => ({
            product: row.product,
            totalQuantity: row.totalQuantity,
            totalPrice: row.totalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' }),
            ...allBranches.reduce((acc, branch) => {
              acc[branch] = row.branchQuantities[branch] || 0;
              return acc;
            }, {} as { [key: string]: number }),
          })),
          {
            product: isRtl ? 'الإجمالي' : 'Total',
            totalQuantity: grandTotalQuantity,
            totalPrice: grandTotalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' }),
            ...allBranches.reduce((acc, branch) => {
              acc[branch] = totalQuantities[branch] || 0;
              return acc;
            }, {} as { [key: string]: number }),
          },
        ];

        if (format === 'excel') {
          const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows, { header: headers });
          if (isRtl) ws['!views'] = [{ RTL: true }];
          ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, ...allBranches.map(() => ({ wch: 15 }))];
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, `${title}_${periodLabel}`);
          XLSX.writeFile(wb, `${title}_${periodLabel}.xlsx`);
        } else if (format === 'pdf') {
          const doc = new jsPDF();
          doc.autoTable({
            head: [headers],
            body: rows.map(row => [
              row.product,
              row.totalQuantity,
              row.totalPrice,
              ...allBranches.map(branch => row[branch]),
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
            className="text-center py-12 bg-white shadow-xl rounded-2xl border border-gray-200"
          >
            <p className="text-gray-600 text-base font-semibold">{isRtl ? 'لا توجد بيانات' : 'No data available'}</p>
          </motion.div>
        );
      }

      return (
        <div className="mb-8">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h2 className="text-xl font-bold text-gray-900">{isRtl ? `${title} - ${periodLabel}` : `${title} - ${periodLabel}`}</h2>
            <div className="flex gap-3">
              <Button
                variant={data.length > 0 ? 'primary' : 'secondary'}
                onClick={data.length > 0 ? () => exportTable('excel') : undefined}
                className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-md transition-all duration-300 ${
                  data.length > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                disabled={data.length === 0}
              >
                <Upload className="w-5 h-5" />
                {isRtl ? 'تصدير إكسل' : 'Export Excel'}
              </Button>
              <Button
                variant={data.length > 0 ? 'primary' : 'secondary'}
                onClick={data.length > 0 ? () => exportTable('pdf') : undefined}
                className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-md transition-all duration-300 ${
                  data.length > 0 ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                disabled={data.length === 0}
              >
                <Upload className="w-5 h-5" />
                {isRtl ? 'تصدير PDF' : 'Export PDF'}
              </Button>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="overflow-x-auto rounded-2xl shadow-xl border border-gray-200 bg-white"
          >
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-blue-600 text-white sticky top-0">
                <tr className={isRtl ? 'flex-row-reverse' : ''}>
                  <th className="px-4 py-3 font-bold text-left min-w-[140px]">{isRtl ? 'المنتج' : 'Product'}</th>
                  <th className="px-4 py-3 font-bold text-center min-w-[120px]">
                    {isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}
                  </th>
                  <th className="px-4 py-3 font-bold text-center min-w-[120px]">
                    {isRtl ? 'السعر الإجمالي' : 'Total Price'}
                  </th>
                  {allBranches.map(branch => (
                    <th key={branch} className="px-4 py-3 font-bold text-center min-w-[120px]">
                      {branch}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.map(row => (
                  <tr key={row.id} className={`hover:bg-blue-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <td className="px-4 py-3 text-gray-800 text-left truncate font-medium">{row.product}</td>
                    <td className="px-4 py-3 text-gray-800 text-center font-semibold">{row.totalQuantity}</td>
                    <td className="px-4 py-3 text-gray-800 text-center font-semibold">
                      {row.totalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}
                    </td>
                    {allBranches.map(branch => (
                      <td key={branch} className="px-4 py-3 text-gray-800 text-center">
                        {row.branchQuantities[branch] || 0}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className={`font-bold bg-gray-100 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-4 py-3 text-gray-900 text-left">{isRtl ? 'الإجمالي' : 'Total'}</td>
                  <td className="px-4 py-3 text-gray-900 text-center">{grandTotalQuantity}</td>
                  <td className="px-4 py-3 text-gray-900 text-center">
                    {grandTotalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}
                  </td>
                  {allBranches.map(branch => (
                    <td key={branch} className="px-4 py-3 text-gray-900 text-center">
                      {totalQuantities[branch] || 0}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </motion.div>
        </div>
      );
    },
    [loading, isRtl, allBranches, months, periodType, selectedMonth, selectedWeek, startDate, endDate, language]
  );

  const renderStockTable = useCallback(
    (data: StockRow[], title: string, isIn: boolean) => {
      const grandTotalQuantity = data.reduce((sum, row) => sum + row.totalQuantity, 0);
      const grandTotalPrice = data.reduce((sum, row) => sum + row.totalPrice, 0);

      const periodLabel = periodType === 'month' 
        ? months[selectedMonth].label 
        : periodType === 'week' 
          ? `${isRtl ? 'أسبوع' : 'Week'} ${selectedWeek}` 
          : `${startDate} - ${endDate}`;

      const exportTable = (format: 'excel' | 'pdf') => {
        const headers = [
          isRtl ? 'رقم' : 'No.',
          isRtl ? 'المنتج' : 'Product',
          isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
          isRtl ? 'السعر الإجمالي' : 'Total Price',
          ...daysInPeriod,
        ];
        const rows = [
          ...data.map((row, index) => ({
            no: index + 1,
            product: row.product,
            totalQuantity: row.totalQuantity,
            totalPrice: row.totalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' }),
            ...daysInPeriod.reduce((acc, day, i) => {
              acc[day] = row.dailyQuantities[i];
              return acc;
            }, {} as { [key: string]: number }),
          })),
          {
            no: '',
            product: isRtl ? 'الإجمالي' : 'Total',
            totalQuantity: grandTotalQuantity,
            totalPrice: grandTotalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' }),
            ...daysInPeriod.reduce((acc, day, i) => {
              acc[day] = data.reduce((sum, row) => sum + row.dailyQuantities[i], 0);
              return acc;
            }, {} as { [key: string]: number }),
          },
        ];

        if (format === 'excel') {
          const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows, { header: headers });
          if (isRtl) ws['!views'] = [{ RTL: true }];
          ws['!cols'] = [{ wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, ...daysInPeriod.map(() => ({ wch: 15 }))];
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, `${title}_${periodLabel}`);
          XLSX.writeFile(wb, `${title}_${periodLabel}.xlsx`);
        } else if (format === 'pdf') {
          const doc = new jsPDF();
          doc.autoTable({
            head: [headers],
            body: rows.map(row => [
              row.no,
              row.product,
              row.totalQuantity,
              row.totalPrice,
              ...daysInPeriod.map(day => row[day]),
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
            className="text-center py-12 bg-white shadow-xl rounded-2xl border border-gray-200"
          >
            <p className="text-gray-600 text-base font-semibold">{isRtl ? 'لا توجد بيانات' : 'No data available'}</p>
          </motion.div>
        );
      }

      return (
        <div className="mb-8">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h2 className="text-xl font-bold text-gray-900">{isRtl ? `${title} - ${periodLabel}` : `${title} - ${periodLabel}`}</h2>
            <div className="flex gap-3">
              <Button
                variant={data.length > 0 ? 'primary' : 'secondary'}
                onClick={data.length > 0 ? () => exportTable('excel') : undefined}
                className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-md transition-all duration-300 ${
                  data.length > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                disabled={data.length === 0}
              >
                <Upload className="w-5 h-5" />
                {isRtl ? 'تصدير إكسل' : 'Export Excel'}
              </Button>
              <Button
                variant={data.length > 0 ? 'primary' : 'secondary'}
                onClick={data.length > 0 ? () => exportTable('pdf') : undefined}
                className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-md transition-all duration-300 ${
                  data.length > 0 ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                disabled={data.length === 0}
              >
                <Upload className="w-5 h-5" />
                {isRtl ? 'تصدير PDF' : 'Export PDF'}
              </Button>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="overflow-x-auto rounded-2xl shadow-xl border border-gray-200 bg-white"
          >
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-blue-600 text-white sticky top-0">
                <tr className={isRtl ? 'flex-row-reverse' : ''}>
                  <th className="px-4 py-3 font-bold text-center min-w-[60px]">{isRtl ? 'رقم' : 'No.'}</th>
                  <th className="px-4 py-3 font-bold text-left min-w-[140px]">{isRtl ? 'المنتج' : 'Product'}</th>
                  <th className="px-4 py-3 font-bold text-center min-w-[120px]">
                    {isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}
                  </th>
                  <th className="px-4 py-3 font-bold text-center min-w-[120px]">
                    {isRtl ? 'السعر الإجمالي' : 'Total Price'}
                  </th>
                  {daysInPeriod.map((day, i) => (
                    <th key={i} className="px-4 py-3 font-bold text-center min-w-[140px]">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.map((row, index) => (
                  <tr key={row.id} className={`hover:bg-blue-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <td className="px-4 py-3 text-gray-800 text-center">{index + 1}</td>
                    <td className="px-4 py-3 text-gray-800 text-left truncate font-medium">{row.product}</td>
                    <td className="px-4 py-3 text-gray-800 text-center font-semibold">{row.totalQuantity}</td>
                    <td className="px-4 py-3 text-gray-800 text-center font-semibold">
                      {row.totalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}
                    </td>
                    {row.dailyQuantities.map((qty, i) => {
                      let colorClass = '';
                      const change = row.changes[i];
                      if (change > 0) colorClass = 'bg-green-100 text-green-800';
                      else if (change < 0) colorClass = 'bg-red-100 text-red-800';
                      return (
                        <td
                          key={i}
                          className={`px-4 py-3 text-center font-medium ${colorClass} transition-colors duration-200`}
                        >
                          {qty} {change !== 0 && `(${change > 0 ? '+' : ''}${change})`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className={`font-bold bg-gray-100 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-4 py-3 text-gray-900 text-center" colSpan={2}>{isRtl ? 'الإجمالي' : 'Total'}</td>
                  <td className="px-4 py-3 text-gray-900 text-center">{grandTotalQuantity}</td>
                  <td className="px-4 py-3 text-gray-900 text-center">
                    {grandTotalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}
                  </td>
                  {daysInPeriod.map((_, i) => (
                    <td key={i} className="px-4 py-3 text-gray-900 text-center">
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
    [loading, isRtl, daysInPeriod, months, periodType, selectedMonth, selectedWeek, startDate, endDate, language]
  );

  return (
    <div className={`px-6 py-8 min-h-screen ${isRtl ? 'rtl font-amiri' : 'ltr font-inter'} bg-gray-100`}>
      <h1 className="text-3xl font-extrabold text-gray-900 mb-8 flex items-center gap-3">
        <Calendar className="w-7 h-7 text-blue-600" />
        {isRtl ? 'تقارير الإنتاج' : 'Production Reports'}
      </h1>
      <div className="mb-8 bg-white p-6 rounded-2xl shadow-xl border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{isRtl ? 'نوع الفترة' : 'Period Type'}</label>
            <Select
              options={[
                { value: 'month', label: isRtl ? 'شهر' : 'Month' },
                { value: 'week', label: isRtl ? 'أسبوع' : 'Week' },
                { value: 'custom', label: isRtl ? 'مخصص' : 'Custom' },
              ]}
              value={periodType}
              onChange={(value) => setPeriodType(value as 'month' | 'week' | 'custom')}
              className="w-full rounded-full border-gray-300 focus:ring-blue-500 text-sm shadow-sm"
            />
          </div>
          {periodType === 'month' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{isRtl ? 'الشهر' : 'Month'}</label>
              <Select
                options={months}
                value={selectedMonth.toString()}
                onChange={(value) => setSelectedMonth(parseInt(value))}
                className="w-full rounded-full border-gray-300 focus:ring-blue-500 text-sm shadow-sm"
              />
            </div>
          )}
          {periodType === 'week' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{isRtl ? 'الأسبوع' : 'Week'}</label>
              <Select
                options={weeks}
                value={selectedWeek.toString()}
                onChange={(value) => setSelectedWeek(parseInt(value))}
                className="w-full rounded-full border-gray-300 focus:ring-blue-500 text-sm shadow-sm"
              />
            </div>
          )}
          {periodType === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{isRtl ? 'تاريخ البداية' : 'Start Date'}</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-full border-gray-300 focus:ring-blue-500 text-sm shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{isRtl ? 'تاريخ النهاية' : 'End Date'}</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-full border-gray-300 focus:ring-blue-500 text-sm shadow-sm"
                />
              </div>
            </>
          )}
        </div>
      </div>
      <div className="mb-8 flex gap-4 border-b border-gray-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-6 py-3 text-base font-semibold rounded-t-xl transition-all duration-300 shadow-md ${
            activeTab === 'orders' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          {isRtl ? 'توزيع الطلبات' : 'Order Distribution'}
        </button>
        <button
          onClick={() => setActiveTab('stockIn')}
          className={`px-6 py-3 text-base font-semibold rounded-t-xl transition-all duration-300 shadow-md ${
            activeTab === 'stockIn' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          {isRtl ? 'زيادة المخزون' : 'Stock Increases'}
        </button>
        <button
          onClick={() => setActiveTab('stockOut')}
          className={`px-6 py-3 text-base font-semibold rounded-t-xl transition-all duration-300 shadow-md ${
            activeTab === 'stockOut' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          {isRtl ? 'نقصان المخزون' : 'Stock Decreases'}
        </button>
      </div>
      <AnimatePresence mode="wait">
        {activeTab === 'orders' && (
          <motion.div key="orders" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.5 }}>
            {renderOrderTable(orderData, isRtl ? 'تقرير توزيع الطلبات' : 'Order Distribution Report')}
          </motion.div>
        )}
        {activeTab === 'stockIn' && (
          <motion.div key="stockIn" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.5 }}>
            {renderStockTable(stockInData, isRtl ? 'تقرير زيادة المخزون' : 'Stock Increases Report', true)}
          </motion.div>
        )}
        {activeTab === 'stockOut' && (
          <motion.div key="stockOut" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.5 }}>
            {renderStockTable(stockOutData, isRtl ? 'تقرير نقصان المخزون' : 'Stock Decreases Report', false)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductionReport;