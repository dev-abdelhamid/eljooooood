import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload } from 'lucide-react';
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
  const [orderData, setOrderData] = useState<{ [month: number]: OrderRow[] }>({});
  const [stockInData, setStockInData] = useState<{ [month: number]: StockRow[] }>({});
  const [stockOutData, setStockOutData] = useState<{ [month: number]: StockRow[] }>({});
  const [selectedMonth, setSelectedMonth] = useState(8); // September 2025
  const [activeTab, setActiveTab] = useState<'orders' | 'stockIn' | 'stockOut'>('orders');
  const currentDate = new Date('2025-10-12T11:19:00+03:00');
  const currentYear = currentDate.getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: new Date(currentYear, i).toLocaleString(language, { month: 'long' }),
  }));

  const getDaysInMonth = useCallback((month: number) => {
    const daysInMonth = new Date(currentYear, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(currentYear, month, i + 1);
      return date.toLocaleString(language, { weekday: 'short', day: 'numeric' });
    });
  }, [currentYear, language]);

  const daysInMonth = useMemo(() => getDaysInMonth(selectedMonth), [selectedMonth, getDaysInMonth]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [inventory, orders] = await Promise.all([
          inventoryAPI.getInventory({}, isRtl),
          ordersAPI.getAll({ status: 'completed', page: 1, limit: 1000 }, isRtl),
        ]);

        const monthlyOrderData: { [month: number]: OrderRow[] } = {};
        const monthlyStockInData: { [month: number]: StockRow[] } = {};
        const monthlyStockOutData: { [month: number]: StockRow[] } = {};

        for (let month = 0; month < 12; month++) {
          const daysInMonth = new Date(currentYear, month + 1, 0).getDate();
          const orderMap = new Map<string, OrderRow>();
          const stockInMap = new Map<string, StockRow>();
          const stockOutMap = new Map<string, StockRow>();

          if (Array.isArray(orders)) {
            orders.forEach((order: any) => {
              if (order.status !== 'completed') return;
              const date = new Date(order.createdAt);
              if (isNaN(date.getTime())) return;
              const orderMonth = date.getMonth();
              const year = date.getFullYear();
              if (year === currentYear && orderMonth === month) {
                const branch = order.branch?.displayName || order.branch?.name || (isRtl ? 'الفرع الرئيسي' : 'Main Branch');
                (order.items || []).forEach((item: any) => {
                  const product = item.displayProductName || item.product?.name || (isRtl ? 'منتج غير معروف' : 'Unknown Product');
                  const key = `${product}-${month}`;
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
              }
            });
          }

          if (Array.isArray(inventory)) {
            inventory.forEach((item: any) => {
              const product = item.productName || item.product?.name || (isRtl ? 'منتج غير معروف' : 'Unknown Product');
              const assumedPrice = Number(item.product?.price) || 0;
              (item.movements || []).forEach((movement: any) => {
                if (!['in', 'out'].includes(movement.type)) return;
                const date = new Date(movement.createdAt);
                if (isNaN(date.getTime())) return;
                const prodMonth = date.getMonth();
                const year = date.getFullYear();
                if (year === currentYear && prodMonth === month) {
                  const day = date.getDate();
                  const key = `${product}-${month}`;
                  const map = movement.type === 'in' ? stockInMap : stockOutMap;
                  if (!map.has(key)) {
                    map.set(key, {
                      id: key,
                      product,
                      totalQuantity: 0,
                      dailyQuantities: Array(daysInMonth).fill(0),
                      changes: Array(daysInMonth).fill(0),
                      totalPrice: 0,
                    });
                  }
                  const row = map.get(key)!;
                  const quantity = Math.abs(Number(movement.quantity) || 0);
                  row.dailyQuantities[day - 1] += quantity;
                  row.totalQuantity += quantity;
                  row.totalPrice += quantity * assumedPrice;
                  if (day > 1) {
                    row.changes[day - 1] = quantity - (row.dailyQuantities[day - 2] || 0);
                  } else {
                    row.changes[0] = quantity;
                  }
                }
              });
            });
          }

          monthlyOrderData[month] = Array.from(orderMap.values());
          monthlyStockInData[month] = Array.from(stockInMap.values());
          monthlyStockOutData[month] = Array.from(stockOutMap.values());
        }

        setOrderData(monthlyOrderData);
        setStockInData(monthlyStockInData);
        setStockOutData(monthlyStockOutData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isRtl, currentYear]);

  const allBranches = useMemo(() => {
    const branches = new Set<string>();
    Object.values(orderData).forEach(monthData => {
      monthData.forEach(row => {
        Object.keys(row.branchQuantities).forEach(branch => branches.add(branch));
      });
    });
    return Array.from(branches).sort();
  }, [orderData]);

  const renderTable = useCallback(
    (data: OrderRow[] | StockRow[], title: string, month: number, type: 'orders' | 'stockIn' | 'stockOut') => {
      const isOrderTable = type === 'orders';
      const grandTotalQuantity = data.reduce((sum, row) => sum + row.totalQuantity, 0);
      const grandTotalPrice = data.reduce((sum, row) => sum + row.totalPrice, 0);

      const exportTable = (format: 'excel' | 'pdf') => {
        const monthName = new Date(currentYear, month, 1).toLocaleString(language, { month: 'long' });
        let headers: string[] = [];
        let rows: any[] = [];

        if (isOrderTable) {
          const totalQuantities = allBranches.reduce((acc, branch) => {
            acc[branch] = (data as OrderRow[]).reduce((sum, row) => sum + (row.branchQuantities[branch] || 0), 0);
            return acc;
          }, {} as { [branch: string]: number });

          headers = [
            isRtl ? 'المنتج' : 'Product',
            isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
            isRtl ? 'السعر الإجمالي' : 'Total Price',
            ...allBranches,
          ];
          rows = [
            ...(data as OrderRow[]).map(row => ({
              product: row.product,
              totalQuantity: row.totalQuantity,
              totalPrice: row.totalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' }),
              ...Object.fromEntries(allBranches.map(branch => [branch, row.branchQuantities[branch] || 0])),
            })),
            {
              product: isRtl ? 'الإجمالي' : 'Total',
              totalQuantity: grandTotalQuantity,
              totalPrice: grandTotalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' }),
              ...Object.fromEntries(allBranches.map(branch => [branch, totalQuantities[branch] || 0])),
            },
          ];
        } else {
          headers = [
            isRtl ? 'رقم' : 'No.',
            isRtl ? 'المنتج' : 'Product',
            isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
            isRtl ? 'السعر الإجمالي' : 'Total Price',
            ...daysInMonth,
          ];
          rows = [
            ...(data as StockRow[]).map((row, index) => ({
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
              ...Object.fromEntries(daysInMonth.map((_, i) => [daysInMonth[i], (data as StockRow[]).reduce((sum, row) => sum + row.dailyQuantities[i], 0)])),
            },
          ];
        }

        if (format === 'excel') {
          const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows, { header: headers });
          if (isRtl) ws['!views'] = [{ RTL: true }];
          ws['!cols'] = isOrderTable
            ? [{ wch: 20 }, { wch: 15 }, { wch: 15 }, ...allBranches.map(() => ({ wch: 15 }))]
            : [{ wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, ...daysInMonth.map(() => ({ wch: 15 }))];
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, `${title}_${monthName}`);
          XLSX.writeFile(wb, `${title}_${monthName}.xlsx`);
        } else if (format === 'pdf') {
          const doc = new jsPDF({ orientation: 'landscape' });
          // Note: You need to add the Arabic font properly in your project, e.g., via addFileToVFS
          doc.autoTable({
            head: [headers],
            body: rows.map(row => isOrderTable
              ? [row.product, row.totalQuantity, row.totalPrice, ...allBranches.map(branch => row[branch])]
              : [row.no, row.product, row.totalQuantity, row.totalPrice, ...daysInMonth.map(day => row[day])]),
            styles: { font: isRtl ? 'Amiri' : 'Helvetica', halign: isRtl ? 'right' : 'left', fontSize: 8 },
            headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontSize: 9 },
            bodyStyles: { fontSize: 7 },
            footStyles: { fillColor: [243, 244, 246], fontSize: 8, fontStyle: 'bold' },
            margin: { top: 10 },
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
            className="text-center py-10 bg-white rounded-xl shadow-sm border border-gray-100"
          >
            <p className="text-gray-500 text-sm font-medium">{isRtl ? 'لا توجد بيانات' : 'No data available'}</p>
          </motion.div>
        );
      }

      return (
        <div className="mb-6">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h2 className="text-lg font-semibold text-gray-900">{isRtl ? `${title} - ${months[month].label}` : `${title} - ${months[month].label}`}</h2>
            <div className="flex gap-2">
              <button
                onClick={() => exportTable('excel')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  data.length > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
                disabled={data.length === 0}
              >
                <Upload className="w-3.5 h-3.5" />
                {isRtl ? 'تصدير إكسل' : 'Export Excel'}
              </button>
              <button
                onClick={() => exportTable('pdf')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  data.length > 0 ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
                disabled={data.length === 0}
              >
                <Upload className="w-3.5 h-3.5" />
                {isRtl ? 'تصدير PDF' : 'Export PDF'}
              </button>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-x-auto rounded-xl shadow-sm border border-gray-100 bg-white"
          >
            <table className="min-w-full divide-y divide-gray-100 text-xs">
              <thead className="bg-blue-50 sticky top-0 z-10">
                <tr className={isRtl ? 'flex-row-reverse' : ''}>
                  {!isOrderTable && (
                    <th className="px-2 py-2 text-xs font-semibold text-gray-700 text-center min-w-[40px]">{isRtl ? 'رقم' : 'No.'}</th>
                  )}
                  <th className="px-2 py-2 text-xs font-semibold text-gray-700 text-center min-w-[100px]">{isRtl ? 'المنتج' : 'Product'}</th>
                  <th className="px-2 py-2 text-xs font-semibold text-gray-700 text-center min-w-[80px]">
                    {isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}
                  </th>
                  <th className="px-2 py-2 text-xs font-semibold text-gray-700 text-center min-w-[80px]">
                    {isRtl ? 'السعر الإجمالي' : 'Total Price'}
                  </th>
                  {isOrderTable
                    ? allBranches.map(branch => (
                        <th key={branch} className="px-2 py-2 text-xs font-semibold text-gray-700 text-center min-w-[80px]">
                          {branch}
                        </th>
                      ))
                    : daysInMonth.map((day, i) => (
                        <th key={i} className="px-2 py-2 text-xs font-semibold text-gray-700 text-center min-w-[80px]">
                          {day}
                        </th>
                      ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((row, index) => (
                  <tr key={row.id} className={`hover:bg-blue-50/30 transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
                    {!isOrderTable && (
                      <td className="px-2 py-1.5 text-gray-600 text-center text-xs">{index + 1}</td>
                    )}
                    <td className="px-2 py-1.5 text-gray-600 text-center truncate text-xs">{row.product}</td>
                    <td className="px-2 py-1.5 text-gray-600 text-center font-medium text-xs">{row.totalQuantity}</td>
                    <td className="px-2 py-1.5 text-gray-600 text-center font-medium text-xs">
                      {row.totalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}
                    </td>
                    {isOrderTable
                      ? allBranches.map(branch => (
                          <td key={branch} className="px-2 py-1.5 text-gray-600 text-center text-xs">
                            {(row as OrderRow).branchQuantities[branch] || 0}
                          </td>
                        ))
                      : (row as StockRow).dailyQuantities.map((qty, i) => (
                          <td
                            key={i}
                            className={`px-2 py-1.5 text-center text-xs font-medium ${
                              type === 'stockIn'
                                ? 'text-green-500 bg-green-50/50'
                                : 'text-red-500 bg-red-50/50'
                            }`}
                          >
                            {qty}
                            {(row as StockRow).changes[i] !== 0 && (
                              <span
                                className={`ml-1 text-xs ${
                                  type === 'stockIn' ? 'text-green-400' : 'text-red-400'
                                }`}
                              >
                                ({(row as StockRow).changes[i] > 0 ? '+' : ''}{(row as StockRow).changes[i]})
                              </span>
                            )}
                          </td>
                        ))}
                  </tr>
                ))}
                <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td
                    className="px-2 py-1.5 text-gray-800 text-center text-xs"
                    colSpan={isOrderTable ? 1 : 2}
                  >
                    {isRtl ? 'الإجمالي' : 'Total'}
                  </td>
                  <td className="px-2 py-1.5 text-gray-800 text-center text-xs">{grandTotalQuantity}</td>
                  <td className="px-2 py-1.5 text-gray-800 text-center text-xs">
                    {grandTotalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}
                  </td>
                  {isOrderTable
                    ? allBranches.map(branch => (
                        <td key={branch} className="px-2 py-1.5 text-gray-800 text-center text-xs">
                          {(data as OrderRow[]).reduce((sum, row) => sum + (row.branchQuantities[branch] || 0), 0)}
                        </td>
                      ))
                    : daysInMonth.map((_, i) => (
                        <td key={i} className="px-2 py-1.5 text-gray-800 text-center text-xs">
                          {(data as StockRow[]).reduce((sum, row) => sum + row.dailyQuantities[i], 0)}
                        </td>
                      ))}
                </tr>
              </tbody>
            </table>
          </motion.div>
        </div>
      );
    },
    [loading, isRtl, allBranches, daysInMonth, months, currentYear, language]
  );

  return (
    <div className={`min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8 ${isRtl ? 'rtl font-amiri' : 'ltr font-inter'}`}>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">{isRtl ? 'تقارير الإنتاج' : 'Production Reports'}</h1>
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 mb-4">
            {months.map(month => (
              <button
                key={month.value}
                onClick={() => setSelectedMonth(month.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedMonth === month.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {month.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'orders'
                  ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {isRtl ? 'توزيع الطلبات' : 'Order Distribution'}
            </button>
            <button
              onClick={() => setActiveTab('stockIn')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'stockIn'
                  ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {isRtl ? 'زيادة المخزون' : 'Stock Increases'}
            </button>
            <button
              onClick={() => setActiveTab('stockOut')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'stockOut'
                  ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {isRtl ? 'نقصان المخزون' : 'Stock Decreases'}
            </button>
          </div>
        </div>
        <AnimatePresence mode="wait">
          {activeTab === 'orders' && (
            <motion.div key="orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              {renderTable(orderData[selectedMonth] || [], isRtl ? 'تقرير توزيع الطلبات' : 'Order Distribution Report', selectedMonth, 'orders')}
            </motion.div>
          )}
          {activeTab === 'stockIn' && (
            <motion.div key="stockIn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              {renderTable(stockInData[selectedMonth] || [], isRtl ? 'تقرير زيادة المخزون' : 'Stock Increases Report', selectedMonth, 'stockIn')}
            </motion.div>
          )}
          {activeTab === 'stockOut' && (
            <motion.div key="stockOut" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              {renderTable(stockOutData[selectedMonth] || [], isRtl ? 'تقرير نقصان المخزون' : 'Stock Decreases Report', selectedMonth, 'stockOut')}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ProductionReport;