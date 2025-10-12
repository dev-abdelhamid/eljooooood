import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/UI/Button';
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
}

interface StockRow {
  id: string;
  product: string;
  branch: string;
  totalQuantity: number;
  date: string;
  dailyQuantities: number[];
  changes: number[];
}

const ProductionReport: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<{ [month: number]: OrderRow[] }>({});
  const [stockInData, setStockInData] = useState<{ [month: number]: StockRow[] }>({});
  const [stockOutData, setStockOutData] = useState<{ [month: number]: StockRow[] }>({});
  const [selectedMonth, setSelectedMonth] = useState(9); // October (0-based index)
  const [activeTab, setActiveTab] = useState<'orders' | 'stockIn' | 'stockOut'>('orders');
  const currentDate = new Date('2025-10-12T10:18:00+03:00');
  const currentYear = currentDate.getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: new Date(currentYear, i).toLocaleString(language, { month: 'long' }),
  }));

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

          // Process orders (pivot table: branches as columns, products as rows)
          orders.forEach((order: any) => {
            const date = new Date(order.createdAt || order.date);
            const orderMonth = date.getMonth();
            const year = date.getFullYear();
            if (year === currentYear && orderMonth === month) {
              const branch = order.branch?.displayName || order.branchId || (isRtl ? 'الفرع الرئيسي' : 'Main Branch');
              order.items.forEach((item: any) => {
                const product = item.product?.name || item.productName || (isRtl ? 'منتج غير معروف' : 'Unknown Product');
                const key = `${product}-${branch}`;
                if (!orderMap.has(product)) {
                  orderMap.set(product, {
                    id: `${product}-${month}`,
                    product,
                    branchQuantities: {},
                    totalQuantity: 0,
                  });
                }
                const row = orderMap.get(product)!;
                row.branchQuantities[branch] = (row.branchQuantities[branch] || 0) + item.quantity;
                row.totalQuantity += item.quantity;
              });
            }
          });

          // Process inventory movements (increases and decreases)
          inventory.forEach((item: any) => {
            item.movements.forEach((movement: any) => {
              const date = new Date(movement.createdAt);
              const prodMonth = date.getMonth();
              const year = date.getFullYear();
              if (year === currentYear && prodMonth === month) {
                const day = date.getDate();
                const product = item.productName || item.product?.name || (isRtl ? 'منتج غير معروف' : 'Unknown Product');
                const branch = movement.branch?.displayName || movement.branchId || (isRtl ? 'المصنع الرئيسي' : 'Main Factory');
                const key = `${product}-${branch}`;
                const map = movement.type === 'in' ? stockInMap : stockOutMap;
                if (!map.has(key)) {
                  map.set(key, {
                    id: `${key}-${month}`,
                    product,
                    branch,
                    totalQuantity: 0,
                    date: new Date(currentYear, month, 1).toISOString().split('T')[0],
                    dailyQuantities: Array(daysInMonth).fill(0),
                    changes: Array(daysInMonth).fill(0),
                  });
                }
                const row = map.get(key)!;
                const quantity = Math.abs(movement.quantity);
                row.dailyQuantities[day - 1] += quantity;
                row.totalQuantity += quantity;
                if (day > 1) {
                  row.changes[day - 1] = quantity - row.dailyQuantities[day - 2];
                } else {
                  row.changes[0] = quantity;
                }
              }
            });
          });

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
  }, [isRtl]);

  const allBranches = useMemo(() => {
    const branches = new Set<string>();
    Object.values(orderData).forEach(monthData => {
      monthData.forEach(row => {
        Object.keys(row.branchQuantities).forEach(branch => branches.add(branch));
      });
    });
    return Array.from(branches).sort();
  }, [orderData]);

  const renderOrderTable = useCallback(
    (data: OrderRow[], title: string, month: number) => {
      const daysInMonth = new Date(currentYear, month + 1, 0).getDate();
      const exportTable = (format: 'excel' | 'pdf') => {
        const monthName = new Date(currentYear, month, 1).toLocaleString(language, { month: 'long' });
        const headers = [isRtl ? 'المنتج' : 'Product', isRtl ? 'الكمية الإجمالية' : 'Total Quantity', ...allBranches];
        const rows = data.map(row => ({
          product: row.product,
          totalQuantity: row.totalQuantity,
          ...Object.fromEntries(allBranches.map(branch => [branch, row.branchQuantities[branch] || 0])),
        }));

        if (format === 'excel') {
          const ws = XLSX.utils.json_to_sheet(rows.map(row => ({
            [isRtl ? 'المنتج' : 'Product']: row.product,
            [isRtl ? 'الكمية الإجمالية' : 'Total Quantity']: row.totalQuantity,
            ...Object.fromEntries(allBranches.map(branch => [branch, row[branch]])),
          })));
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, `${title}_${monthName}`);
          XLSX.writeFile(wb, `${title}_${monthName}.xlsx`);
        } else if (format === 'pdf') {
          const doc = new jsPDF();
          doc.autoTable({
            head: [headers],
            body: rows.map(row => [row.product, row.totalQuantity, ...allBranches.map(branch => row[branch])]),
            styles: { font: isRtl ? 'Amiri' : 'Helvetica', halign: isRtl ? 'right' : 'left', fontSize: 10 },
            headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontSize: 10 },
            bodyStyles: { fontSize: 9 },
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
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[120px]">{isRtl ? 'المنتج' : 'Product'}</th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}
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
                    {allBranches.map(branch => (
                      <td key={branch} className="px-3 py-2 text-gray-700 text-center">
                        {row.branchQuantities[branch] || 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      );
    },
    [loading, isRtl, allBranches, months, currentYear, language]
  );

  const renderStockTable = useCallback(
    (data: StockRow[], title: string, month: number) => {
      const daysInMonth = new Date(currentYear, month + 1, 0).getDate();
      const exportTable = (format: 'excel' | 'pdf') => {
        const monthName = new Date(currentYear, month, 1).toLocaleString(language, { month: 'long' });
        const headers = [
          isRtl ? 'رقم' : 'No.',
          isRtl ? 'المنتج' : 'Product',
          isRtl ? 'الفرع' : 'Branch',
          isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
          isRtl ? 'التاريخ' : 'Date',
          ...Array(daysInMonth).fill(0).map((_, i) => isRtl ? `اليوم ${i + 1}` : `Day ${i + 1}`),
        ];
        const rows = data.map((row, index) => ({
          no: index + 1,
          product: row.product,
          branch: row.branch,
          totalQuantity: row.totalQuantity,
          date: row.date,
          ...Object.fromEntries(row.dailyQuantities.map((qty, i) => [`day${i + 1}`, qty])),
        }));

        if (format === 'excel') {
          const ws = XLSX.utils.json_to_sheet(rows.map(row => ({
            [isRtl ? 'رقم' : 'No.']: row.no,
            [isRtl ? 'المنتج' : 'Product']: row.product,
            [isRtl ? 'الفرع' : 'Branch']: row.branch,
            [isRtl ? 'الكمية الإجمالية' : 'Total Quantity']: row.totalQuantity,
            [isRtl ? 'التاريخ' : 'Date']: row.date,
            ...Object.fromEntries(Object.entries(row).filter(([key]) => key.startsWith('day')).map(([key, value]) => [headers[parseInt(key.replace('day', '')) + 4], value])),
          })));
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, `${title}_${monthName}`);
          XLSX.writeFile(wb, `${title}_${monthName}.xlsx`);
        } else if (format === 'pdf') {
          const doc = new jsPDF();
          doc.autoTable({
            head: [headers],
            body: rows.map(row => [row.no, row.product, row.branch, row.totalQuantity, row.date, ...row.dailyQuantities]),
            styles: { font: isRtl ? 'Amiri' : 'Helvetica', halign: isRtl ? 'right' : 'left', fontSize: 10 },
            headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontSize: 10 },
            bodyStyles: { fontSize: 9 },
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
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[100px]">{isRtl ? 'الفرع' : 'Branch'}</th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}
                  </th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[100px]">{isRtl ? 'التاريخ' : 'Date'}</th>
                  {Array(daysInMonth).fill(0).map((_, i) => (
                    <th key={i} className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[60px]">
                      {isRtl ? `اليوم ${i + 1}` : `Day ${i + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((row, index) => (
                  <tr key={row.id} className={`hover:bg-blue-50/50 transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <td className="px-3 py-2 text-gray-700 text-center">{index + 1}</td>
                    <td className="px-3 py-2 text-gray-700 text-center truncate">{row.product}</td>
                    <td className="px-3 py-2 text-gray-700 text-center truncate">{row.branch}</td>
                    <td className="px-3 py-2 text-gray-700 text-center font-medium">{row.totalQuantity}</td>
                    <td className="px-3 py-2 text-gray-700 text-center truncate">{row.date}</td>
                    {row.dailyQuantities.map((qty, i) => (
                      <td
                        key={i}
                        className={`px-3 py-2 text-center ${
                          row.changes[i] > 0 ? 'text-green-600 font-medium' : row.changes[i] < 0 ? 'text-red-600 font-medium' : 'text-gray-700'
                        }`}
                      >
                        {qty} {row.changes[i] !== 0 && `(${row.changes[i] > 0 ? '+' : ''}${row.changes[i]})`}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      );
    },
    [loading, isRtl, months, currentYear, language]
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
            {renderOrderTable(orderData[selectedMonth] || [], isRtl ? 'تقرير توزيع الطلبات' : 'Order Distribution Report', selectedMonth)}
          </motion.div>
        )}
        {activeTab === 'stockIn' && (
          <motion.div key="stockIn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            {renderStockTable(stockInData[selectedMonth] || [], isRtl ? 'تقرير زيادة المخزون' : 'Stock Increases Report', selectedMonth)}
          </motion.div>
        )}
        {activeTab === 'stockOut' && (
          <motion.div key="stockOut" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            {renderStockTable(stockOutData[selectedMonth] || [], isRtl ? 'تقرير نقصان المخزون' : 'Stock Decreases Report', selectedMonth)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductionReport;