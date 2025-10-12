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
    } else {
      start = startDate ? new Date(startDate) : new Date();
      end = endDate ? new Date(endDate) : new Date();
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

        if (Array.isArray(orders) && orders.length > 0) {
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
        } else {
          // Hardcoded fallback if API is empty
          setOrderData(hardcodedOrderData);
        }

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
  }, [isRtl, periodType, selectedMonth, selectedWeek, startDate, endDate, daysInPeriod, language]);

  const hardcodedOrderData = [
    {
      id: '1',
      product: 'FATHAIR ALO 40 50',
      branchQuantities: {
        MASSAF: 76,
        ALOWARA: 5,
        'AL ASSYAH': 6,
        BADAYA: 6,
        'R.KABARA': 8,
        'AL RASS': 6,
        ONAIZA: 4,
        ALSAFA: 4,
        BASATHEEN: 11,
        FAIZIYA: 8,
        OFUQ: 13,
        RAYYAN: 5,
      },
      totalQuantity: 76,
      totalPrice: 0,
    },
    {
      id: '2',
      product: 'new item kufta',
      branchQuantities: {
        MASSAF: 26,
        ALOWARA: 2,
        'AL ASSYAH': 2,
        BADAYA: 2,
        'R.KABARA': 2,
        'AL RASS': 2,
        ONAIZA: 2,
        ALSAFA: 2,
        BASATHEEN: 2,
        FAIZIYA: 2,
        OFUQ: 2,
        RAYYAN: 2,
      },
      totalQuantity: 26,
      totalPrice: 0,
    },
    {
      id: '3',
      product: 'Fryers (KUBA)',
      branchQuantities: {
        MASSAF: 3500,
        ALOWARA: 250,
        'AL ASSYAH': 250,
        BADAYA: 250,
        'R.KABARA': 250,
        'AL RASS': 250,
        ONAIZA: 250,
        ALSAFA: 250,
        BASATHEEN: 250,
        FAIZIYA: 250,
        OFUQ: 250,
        RAYYAN: 250,
      },
      totalQuantity: 3500,
      totalPrice: 0,
    },
    {
      id: '4',
      product: 'Fryers (musakhan)',
      branchQuantities: {
        MASSAF: 3500,
        ALOWARA: 250,
        'AL ASSYAH': 250,
        BADAYA: 250,
        'R.KABARA': 250,
        'AL RASS': 250,
        ONAIZA: 250,
        ALSAFA: 250,
        BASATHEEN: 250,
        FAIZIYA: 250,
        OFUQ: 250,
        RAYYAN: 250,
      },
      totalQuantity: 3500,
      totalPrice: 0,
    },
    {
      id: '5',
      product: 'Box ATHAR MINI Burger',
      branchQuantities: {
        MASSAF: 3,
        ALOWARA: 500,
        'AL ASSYAH': 500,
        BADAYA: 500,
        'R.KABARA': 500,
        'AL RASS': 500,
        ONAIZA: 150,
        ALSAFA: 4,
        BASATHEEN: 1,
        FAIZIYA: 3,
        OFUQ: 1,
      },
      totalQuantity: 3,
      totalPrice: 0,
    },
    {
      id: '6',
      product: 'Box ATHAR MINI 45 SR NEW',
      branchQuantities: {
        MASSAF: 13,
        ALOWARA: 2,
        'AL ASSYAH': 1.5,
        BADAYA: 1,
        'R.KABARA': 3,
        'AL RASS': 2,
        ONAIZA: 2,
        ALSAFA: 3,
        BASATHEEN: 5,
        FAIZIYA: 10,
        OFUQ: 5,
      },
      totalQuantity: 13,
      totalPrice: 0,
    },
    {
      id: '7',
      product: 'CORUSAN Smoked chicken',
      branchQuantities: {
        MASSAF: 50,
        ALOWARA: 4,
        'AL ASSYAH': 3,
        BADAYA: 2,
        'R.KABARA': 3,
        'AL RASS': 1,
        ONAIZA: 1,
        ALSAFA: 2,
        BASATHEEN: 1,
        FAIZIYA: 2,
        OFUQ: 2,
      },
      totalQuantity: 50,
      totalPrice: 0,
    },
    {
      id: '8',
      product: 'Sandwich Grilled halloumi',
      branchQuantities: {
        MASSAF: 22,
        ALOWARA: 4,
        'AL ASSYAH': 1,
        BADAYA: 2,
        'R.KABARA': 4,
        'AL RASS': 1,
        ONAIZA: 1,
        ALSAFA: 5,
        BASATHEEN: 4,
        FAIZIYA: 5,
        OFUQ: 3,
      },
      totalQuantity: 22,
      totalPrice: 0,
    },
    {
      id: '9',
      product: 'Sandwich Buffalo chicken',
      branchQuantities: {
        MASSAF: 32,
        ALOWARA: 2,
        'AL ASSYAH': 3,
        BADAYA: 2,
        'R.KABARA': 4,
        'AL RASS': 1,
        ONAIZA: 2,
        ALSAFA: 5,
        BASATHEEN: 4,
        FAIZIYA: 5,
        OFUQ: 3,
      },
      totalQuantity: 32,
      totalPrice: 0,
    },
    {
      id: '10',
      product: 'Sandwich Grilled BARD L',
      branchQuantities: {
        MASSAF: 30,
        ALOWARA: 2,
        'AL ASSYAH': 3,
        BADAYA: 2,
        'R.KABARA': 4,
        'AL RASS': 1,
        ONAIZA: 3,
        ALSAFA: 5,
        BASATHEEN: 4,
        FAIZIYA: 5,
        OFUQ: 3,
      },
      totalQuantity: 30,
      totalPrice: 0,
    },
    {
      id: '11',
      product: 'WARGENAB BARD S',
      branchQuantities: {
        MASSAF: 31,
        ALOWARA: 2,
        'AL ASSYAH': 3,
        BADAYA: 2,
        'R.KABARA': 4,
        'AL RASS': 1,
        ONAIZA: 2,
        ALSAFA: 0,
        BASATHEEN: 3,
        FAIZIYA: 3,
        OFUQ: 2,
      },
      totalQuantity: 31,
      totalPrice: 0,
    },
    {
      id: '12',
      product: 'WARGENAB Hot L',
      branchQuantities: {
        MASSAF: 31,
        ALOWARA: 2,
        'AL ASSYAH': 3,
        BADAYA: 4,
        'R.KABARA': 2,
        'AL RASS': 3,
        ONAIZA: 2,
        ALSAFA: 2,
        BASATHEEN: 3,
        FAIZIYA: 3,
        OFUQ: 2,
      },
      totalQuantity: 31,
      totalPrice: 0,
    },
    {
      id: '13',
      product: 'WARGENAB Hot S',
      branchQuantities: {
        MASSAF: 20,
        ALOWARA: 2,
        'AL ASSYAH': 2,
        BADAYA: 4,
        'R.KABARA': 3,
        'AL RASS': 1,
        ONAIZA: 1,
        ALSAFA: 2,
        BASATHEEN: 2,
        FAIZIYA: 2,
        OFUQ: 2,
      },
      totalQuantity: 20,
      totalPrice: 0,
    },
    {
      id: '14',
      product: 'Khalyyat jobn 10 9',
      branchQuantities: {
        MASSAF: 16,
        ALOWARA: 3,
        'AL ASSYAH': 2.5,
        BADAYA: 4,
        'R.KABARA': 1,
        'AL RASS': 1,
        ONAIZA: 1,
        ALSAFA: 1,
        BASATHEEN: 2,
        FAIZIYA: 5,
        OFUQ: 1,
      },
      totalQuantity: 16,
      totalPrice: 0,
    },
    {
      id: '15',
      product: 'Khaliyyat gerfa 10 9',
      branchQuantities: {
        MASSAF: 18,
        ALOWARA: 5,
        'AL ASSYAH': 3.5,
        BADAYA: 1,
        'R.KABARA': 1,
        'AL RASS': 1,
        ONAIZA: 1,
        ALSAFA: 1,
        BASATHEEN: 1,
        FAIZIYA: 2,
        OFUQ: 1,
      },
      totalQuantity: 18,
      totalPrice: 0,
    },
    {
      id: '16',
      product: 'Mini Kefta (Marinated)',
      branchQuantities: {
        MASSAF: 17,
        ALOWARA: 3,
        'AL ASSYAH': 2,
        BADAYA: 1,
        'R.KABARA': 1,
        'AL RASS': 1,
        ONAIZA: 1,
        ALSAFA: 1,
        BASATHEEN: 1,
        FAIZIYA: 1,
        OFUQ: 1,
      },
      totalQuantity: 17,
      totalPrice: 0,
    },
    {
      id: '17',
      product: 'BALAH ASHAR',
      branchQuantities: {
        MASSAF: 8,
        ALOWARA: 1,
        'AL ASSYAH': 1,
        BADAYA: 1,
        'R.KABARA': 1,
        'AL RASS': 1,
        ONAIZA: 1,
        ALSAFA: 1,
        BASATHEEN: 1,
        FAIZIYA: 1,
        OFUQ: 1,
      },
      totalQuantity: 8,
      totalPrice: 0,
    },
    {
      id: '18',
      product: '. SAMBUSA',
      branchQuantities: {
        MASSAF: 6,
        ALOWARA: 1,
        'AL ASSYAH': 1,
        BADAYA: 1,
        'R.KABARA': 1,
        'AL RASS': 1,
        ONAIZA: 1,
        ALSAFA: 1,
        BASATHEEN: 1,
        FAIZIYA: 1,
      },
      totalQuantity: 6,
      totalPrice: 0,
    },
    {
      id: '19',
      product: 'SAMBUSA',
      branchQuantities: {
        MASSAF: 0,
        ALOWARA: 500,
        'AL ASSYAH': 500,
        BADAYA: 0,
        'R.KABARA': 0,
        'AL RASS': 0,
        ONAIZA: 0,
        ALSAFA: 0,
        BASATHEEN: 500,
        FAIZIYA: 0,
        OFUQ: 0,
      },
      totalQuantity: 1500,
      totalPrice: 0,
    },
    {
      id: '20',
      product: 'SAMBUSA',
      branchQuantities: {
        MASSAF: 5500,
        ALOWARA: 500,
        'AL ASSYAH': 500,
        BADAYA: 0,
        'R.KABARA': 0,
        'AL RASS': 0,
        ONAIZA: 0,
        ALSAFA: 0,
        BASATHEEN: 500,
        FAIZIYA: 0,
        OFUQ: 0,
      },
      totalQuantity: 7500,
      totalPrice: 0,
    },
    {
      id: '21',
      product: ' ',
      branchQuantities: {
        MASSAF: 3500,
        ALOWARA: 0,
        'AL ASSYAH': 0,
        BADAYA: 0,
        'R.KABARA': 0,
        'AL RASS': 0,
        ONAIZA: 0,
        ALSAFA: 0,
        BASATHEEN: 0,
        FAIZIYA: 0,
        OFUQ: 0,
      },
      totalQuantity: 3500,
      totalPrice: 0,
    },
  ];

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
          ...allBranches,
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
          ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, ...allBranches.map(() => ({ wch: 15 }))];
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, `${title}_${periodLabel}`);
          XLSX.writeFile(wb, `${title}_${periodLabel}.xlsx`);
        } else if (format === 'pdf') {
          const doc = new jsPDF({ orientation: 'landscape' });
          doc.autoTable({
            head: [headers],
            body: rows.map(row => [
              row.product,
              row.totalQuantity,
              row.totalPrice,
              ...allBranches.map(branch => row[branch]),
            ]),
            styles: { font: isRtl ? 'Amiri' : 'Helvetica', halign: isRtl ? 'right' : 'left', fontSize: 8 },
            headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontSize: 9 },
            bodyStyles: { fontSize: 7 },
            footStyles: { fillColor: [240, 240, 240], fontSize: 8, fontStyle: 'bold' },
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
            <h2 className="text-lg font-semibold text-gray-800">{isRtl ? `${title} - ${periodLabel}` : `${title} - ${periodLabel}`}</h2>
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={() => exportTable('excel')}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white"
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير إكسل' : 'Export Excel'}
              </Button>
              <Button
                variant="primary"
                onClick={() => exportTable('pdf')}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium bg-green-500 hover:bg-green-600 text-white"
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
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[120px]">{isRtl ? 'المنتج' : 'Product'}</th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}
                  </th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'السعر الإجمالي' : 'Total Price'}
                  </th>
                  {allBranches.map(branch => (
                    <th key={branch} className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[100px]">
                      {branch}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map(row => (
                  <tr key={row.id} className={`hover:bg-blue-50/50 transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <td className="px-3 py-2 text-gray-700 text-center truncate">{row.product}</td>
                    <td className="px-3 py-2 text-gray-700 text-center font-medium">{row.totalQuantity}</td>
                    <td className="px-3 py-2 text-gray-700 text-center font-medium">
                      {row.totalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}
                    </td>
                    {allBranches.map(branch => (
                      <td key={branch} className="px-3 py-2 text-gray-700 text-center">
                        {row.branchQuantities[branch] || 0}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-3 py-2 text-gray-800 text-center">{isRtl ? 'الإجمالي' : 'Total'}</td>
                  <td className="px-3 py-2 text-gray-800 text-center">{grandTotalQuantity}</td>
                  <td className="px-3 py-2 text-gray-800 text-center">
                    {grandTotalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}
                  </td>
                  {allBranches.map(branch => (
                    <td key={branch} className="px-3 py-2 text-gray-800 text-center">
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
    [loading, isRtl, allBranches, periodType, selectedMonth, selectedWeek, startDate, endDate, months, language]
  );

  const renderStockInTable = useCallback(
    (data: StockRow[], title: string) => {
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
          const doc = new jsPDF({ orientation: 'landscape' });
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
            className="text-center py-12 bg-white shadow-sm rounded-lg border border-gray-100"
          >
            <p className="text-gray-500 text-sm font-medium">{isRtl ? 'لا توجد بيانات' : 'No data available'}</p>
          </motion.div>
        );
      }

      return (
        <div className="mb-8">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h2 className="text-lg font-semibold text-gray-800">{isRtl ? `${title} - ${periodLabel}` : `${title} - ${periodLabel}`}</h2>
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={() => exportTable('excel')}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white"
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير إكسل' : 'Export Excel'}
              </Button>
              <Button
                variant="primary"
                onClick={() => exportTable('pdf')}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium bg-green-500 hover:bg-green-600 text-white"
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
                  {daysInPeriod.map((day, i) => (
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
                    {row.dailyQuantities.map((qty, i) => {
                      const change = row.changes[i];
                      let colorClass = '';
                      if (change > 0) colorClass = 'bg-green-100 text-green-800';
                      else if (change < 0) colorClass = 'bg-red-100 text-red-800';
                      return (
                        <td
                          key={i}
                          className={`px-3 py-2 text-center font-medium ${colorClass}`}
                        >
                          {qty} {change !== 0 && `(${change > 0 ? '+' : ''}${change})`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-3 py-2 text-gray-800 text-center" colSpan={2}>{isRtl ? 'الإجمالي' : 'Total'}</td>
                  <td className="px-3 py-2 text-gray-800 text-center">{grandTotalQuantity}</td>
                  <td className="px-3 py-2 text-gray-800 text-center">
                    {grandTotalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}
                  </td>
                  {daysInPeriod.map((_, i) => (
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
    [loading, isRtl, daysInPeriod, periodType, selectedMonth, selectedWeek, startDate, endDate, months, language]
  );

  const renderStockOutTable = useCallback(
    (data: StockRow[], title: string) => {
      // Similar to renderStockInTable, with same logic for colors
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
          const doc = new jsPDF({ orientation: 'landscape' });
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
            className="text-center py-12 bg-white shadow-sm rounded-lg border border-gray-100"
          >
            <p className="text-gray-500 text-sm font-medium">{isRtl ? 'لا توجد بيانات' : 'No data available'}</p>
          </motion.div>
        );
      }

      return (
        <div className="mb-8">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h2 className="text-lg font-semibold text-gray-800">{isRtl ? `${title} - ${periodLabel}` : `${title} - ${periodLabel}`}</h2>
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={() => exportTable('excel')}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white"
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير إكسل' : 'Export Excel'}
              </Button>
              <Button
                variant="primary"
                onClick={() => exportTable('pdf')}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium bg-green-500 hover:bg-green-600 text-white"
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
                  {daysInPeriod.map((day, i) => (
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
                    {row.dailyQuantities.map((qty, i) => {
                      const change = row.changes[i];
                      let colorClass = '';
                      if (change > 0) colorClass = 'bg-green-100 text-green-800';
                      else if (change < 0) colorClass = 'bg-red-100 text-red-800';
                      return (
                        <td
                          key={i}
                          className={`px-3 py-2 text-center font-medium ${colorClass}`}
                        >
                          {qty} {change !== 0 && `(${change > 0 ? '+' : ''}${change})`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-3 py-2 text-gray-800 text-center" colSpan={2}>{isRtl ? 'الإجمالي' : 'Total'}</td>
                  <td className="px-3 py-2 text-gray-800 text-center">{grandTotalQuantity}</td>
                  <td className="px-3 py-2 text-gray-800 text-center">
                    {grandTotalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}
                  </td>
                  {daysInPeriod.map((_, i) => (
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
    [loading, isRtl, daysInPeriod, periodType, selectedMonth, selectedWeek, startDate, endDate, months, language]
  );

  return (
    <div className={`px-4 py-6 min-h-screen ${isRtl ? 'rtl font-amiri' : 'ltr font-inter'} bg-gray-50`}>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{isRtl ? 'تقارير الإنتاج' : 'Production Reports'}</h1>
      <div className="mb-6 bg-white p-4 rounded-lg shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'نوع الفترة' : 'Period Type'}</label>
            <Select
              options={[
                { value: 'month', label: isRtl ? 'شهر' : 'Month' },
                { value: 'week', label: isRtl ? 'أسبوع' : 'Week' },
                { value: 'custom', label: isRtl ? 'مخصص' : 'Custom' },
              ]}
              value={periodType}
              onChange={(value) => setPeriodType(value as 'month' | 'week' | 'custom')}
            />
          </div>
          {periodType === 'month' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'الشهر' : 'Month'}</label>
              <Select
                options={months}
                value={selectedMonth.toString()}
                onChange={(value) => setSelectedMonth(parseInt(value))}
              />
            </div>
          )}
          {periodType === 'week' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'الأسبوع' : 'Week'}</label>
              <Select
                options={weeks}
                value={selectedWeek.toString()}
                onChange={(value) => setSelectedWeek(parseInt(value))}
              />
            </div>
          )}
          {periodType === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'تاريخ البداية' : 'Start Date'}</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'تاريخ النهاية' : 'End Date'}</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </>
          )}
        </div>
      </div>
      <div className="mb-6 flex gap-2 border-b border-gray-200">
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
      <AnimatePresence mode="wait">
        {activeTab === 'orders' && (
          <motion.div key="orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            {renderOrderTable(orderData, isRtl ? 'تقرير توزيع الطلبات' : 'Order Distribution Report')}
          </motion.div>
        )}
        {activeTab === 'stockIn' && (
          <motion.div key="stockIn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            {renderStockInTable(stockInData, isRtl ? 'تقرير زيادة المخزون' : 'Stock Increases Report')}
          </motion.div>
        )}
        {activeTab === 'stockOut' && (
          <motion.div key="stockOut" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            {renderStockOutTable(stockOutData, isRtl ? 'تقرير نقصان المخزون' : 'Stock Decreases Report')}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductionReport;