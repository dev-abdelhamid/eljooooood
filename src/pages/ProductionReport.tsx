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
import { inventoryAPI, ordersAPI, branchesAPI } from '../services/api';
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
  const [orderData, setOrderData] = useState<{ [month: number]: OrderRow[] }>({});
  const [stockInData, setStockInData] = useState<{ [month: number]: StockRow[] }>({});
  const [stockOutData, setStockOutData] = useState<{ [month: number]: StockRow[] }>({});
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(8); // September 2025 (0-based index)
  const [activeTab, setActiveTab] = useState<'orders' | 'stockIn' | 'stockOut'>('orders');
  const currentDate = new Date('2025-10-12T11:19:00+03:00');
  const currentYear = currentDate.getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: new Date(currentYear, i).toLocaleString(language, { month: 'long' }),
  }));

  // Calculate actual days for the selected month with improved formatting
  const getDaysInMonth = useCallback((month: number) => {
    const daysInMonthCount = new Date(currentYear, month + 1, 0).getDate();
    return Array.from({ length: daysInMonthCount }, (_, i) => {
      const date = new Date(currentYear, month, i + 1);
      return date.toLocaleString(language, { day: 'numeric', month: 'short' }); // Shorter format for better table fit
    });
  }, [currentYear, language]);

  const daysInMonth = useMemo(() => getDaysInMonth(selectedMonth), [selectedMonth, getDaysInMonth]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [inventory, ordersResponse, branchesResponse] = await Promise.all([
          inventoryAPI.getInventory({}, isRtl),
          ordersAPI.getAll({ status: 'completed', page: 1, limit: 1000 }, isRtl),
          branchesAPI.getAll(),
        ]);

        const monthlyOrderData: { [month: number]: OrderRow[] } = {};
        const monthlyStockInData: { [month: number]: StockRow[] } = {};
        const monthlyStockOutData: { [month: number]: StockRow[] } = {};

        // Set branches
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

        // Handle empty orders, fallback to inventory movements
        let orders = Array.isArray(ordersResponse) ? ordersResponse : [];
        if (orders.length === 0) {
          orders = inventory.flatMap((item: any) => {
            return (item.movements || []).map((movement: any) => ({
              status: 'completed',
              createdAt: movement.createdAt,
              branch: { displayName: fetchedBranches[Math.floor(Math.random() * fetchedBranches.length)]?.displayName || (isRtl ? 'الفرع الرئيسي' : 'Main Branch') },
              items: [{
                displayProductName: item.productName || (isRtl ? 'منتج غير معروف' : 'Unknown Product'),
                quantity: Math.abs(movement.quantity),
                price: item.product?.price || 0,
              }],
            }));
          });
        }

        for (let month = 0; month < 12; month++) {
          const daysInMonthCount = new Date(currentYear, month + 1, 0).getDate();
          const orderMap = new Map<string, OrderRow>();
          const stockInMap = new Map<string, StockRow>();
          const stockOutMap = new Map<string, StockRow>();

          // Process orders
          orders.forEach((order: any) => {
            const status = order.status || order.orderStatus;
            if (status !== 'completed') return;
            const date = new Date(order.createdAt || order.date);
            if (isNaN(date.getTime())) return;
            const orderMonth = date.getMonth();
            const year = date.getFullYear();
            if (year === currentYear && orderMonth === month) {
              const branch = order.branch?.displayName || order.branch?.name || order.branchId || (isRtl ? 'الفرع الرئيسي' : 'Main Branch');
              (order.items || []).forEach((item: any) => {
                const product = item.displayProductName || item.product?.name || item.productName || (isRtl ? 'منتج غير معروف' : 'Unknown Product');
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

          // Process inventory movements
          if (Array.isArray(inventory)) {
            inventory.forEach((item: any) => {
              const product = item.productName || item.product?.name || (isRtl ? 'منتج غير معروف' : 'Unknown Product');
              const assumedPrice = Number(item.product?.price) || 0;
              (item.movements || []).forEach((movement: any) => {
                if (!movement.type || !['in', 'out'].includes(movement.type)) return;
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
                      dailyQuantities: Array(daysInMonthCount).fill(0),
                      changes: Array(daysInMonthCount).fill(0),
                      totalPrice: 0,
                    });
                  }
                  const row = map.get(key)!;
                  const quantity = Math.abs(Number(movement.quantity) || 0);
                  row.dailyQuantities[day - 1] += quantity;
                  row.totalQuantity += quantity;
                  row.totalPrice += quantity * assumedPrice;
                  if (day > 1) {
                    row.changes[day - 1] = row.dailyQuantities[day - 1] - row.dailyQuantities[day - 2];
                  } else {
                    row.changes[0] = row.dailyQuantities[0];
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
    return branches.map(b => b.displayName).sort();
  }, [branches]);

  const renderOrderTable = useCallback(
    (data: OrderRow[], title: string, month: number) => {
      const totalQuantities = allBranches.reduce((acc, branch) => {
        acc[branch] = data.reduce((sum, row) => sum + (row.branchQuantities[branch] || 0), 0);
        return acc;
      }, {} as { [branch: string]: number });
      const grandTotalQuantity = data.reduce((sum, row) => sum + row.totalQuantity, 0);
      const grandTotalPrice = data.reduce((sum, row) => sum + row.totalPrice, 0);

      const exportTable = (format: 'excel' | 'pdf') => {
        const monthName = new Date(currentYear, month, 1).toLocaleString(language, { month: 'long' });
        const headers = [
          isRtl ? 'المنتج' : 'Product',
          ...allBranches,
          isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
          isRtl ? 'السعر الإجمالي' : 'Total Price',
        ];
        const rows = [
          ...data.map(row => ({
            product: row.product,
            ...Object.fromEntries(allBranches.map(branch => [branch, row.branchQuantities[branch] || 0])),
            totalQuantity: row.totalQuantity,
            totalPrice: row.totalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' }),
          })),
          {
            product: isRtl ? 'الإجمالي' : 'Total',
            ...Object.fromEntries(allBranches.map(branch => [branch, totalQuantities[branch] || 0])),
            totalQuantity: grandTotalQuantity,
            totalPrice: grandTotalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' }),
          },
        ];
        if (format === 'excel') {
          const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows, { header: headers });
          if (isRtl) ws['!views'] = [{ RTL: true }];
          ws['!cols'] = [{ wch: 20 }, ...allBranches.map(() => ({ wch: 15 })), { wch: 15 }, { wch: 15 }];
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, `${title}_${monthName}`);
          XLSX.writeFile(wb, `${title}_${monthName}.xlsx`);
        } else if (format === 'pdf') {
          const doc = new jsPDF();
          doc.autoTable({
            head: [headers],
            body: rows.map(row => [
              row.product,
              ...allBranches.map(branch => row[branch]),
              row.totalQuantity,
              row.totalPrice,
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
            className="text-center py-12 bg-white shadow-md rounded-xl border border-gray-200"
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
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[120px]">{isRtl ? 'المنتج' : 'Product'}</th>
                  {allBranches.map(branch => (
                    <th key={branch} className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                      {branch}
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
                {data.map(row => (
                  <tr key={row.id} className={`hover:bg-blue-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <td className="px-4 py-3 text-gray-700 text-center truncate">{row.product}</td>
                    {allBranches.map(branch => (
                      <td
                        key={branch}
                        className={`px-4 py-3 text-center ${
                          row.branchQuantities[branch] > 0 ? 'bg-green-50 text-green-700' : row.branchQuantities[branch] < 0 ? 'bg-red-50 text-red-700' : 'text-gray-700'
                        }`}
                        title={`${isRtl ? 'الكمية في ' : 'Quantity in '} ${branch}: ${row.branchQuantities[branch] || 0}`}
                      >
                        {row.branchQuantities[branch] || 0}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-gray-700 text-center font-medium">{row.totalQuantity}</td>
                    <td className="px-4 py-3 text-gray-700 text-center font-medium">
                      {row.totalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}
                    </td>
                  </tr>
                ))}
                <tr className={`font-semibold bg-gray-100 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-4 py-3 text-gray-800 text-center">{isRtl ? 'الإجمالي' : 'Total'}</td>
                  {allBranches.map(branch => (
                    <td key={branch} className="px-4 py-3 text-gray-800 text-center">
                      {totalQuantities[branch] || 0}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-gray-800 text-center">{grandTotalQuantity}</td>
                  <td className="px-4 py-3 text-gray-800 text-center">
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

  const renderStockTable = useCallback(
    (data: StockRow[], title: string, month: number, isIn: boolean) => {
      const grandTotalQuantity = data.reduce((sum, row) => sum + row.totalQuantity, 0);
      const grandTotalPrice = data.reduce((sum, row) => sum + row.totalPrice, 0);

      const exportTable = (format: 'excel' | 'pdf') => {
        const monthName = new Date(currentYear, month, 1).toLocaleString(language, { month: 'long' });
        const headers = [
          isRtl ? 'رقم' : 'No.',
          isRtl ? 'المنتج' : 'Product',
          ...daysInMonth,
          isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
          isRtl ? 'السعر الإجمالي' : 'Total Price',
        ];
        const rows = [
          ...data.map((row, index) => ({
            no: index + 1,
            product: row.product,
            ...Object.fromEntries(row.dailyQuantities.map((qty, i) => [daysInMonth[i], qty])),
            totalQuantity: row.totalQuantity,
            totalPrice: row.totalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' }),
          })),
          {
            no: '',
            product: isRtl ? 'الإجمالي' : 'Total',
            ...Object.fromEntries(daysInMonth.map((_, i) => [daysInMonth[i], data.reduce((sum, row) => sum + row.dailyQuantities[i], 0)])),
            totalQuantity: grandTotalQuantity,
            totalPrice: grandTotalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' }),
          },
        ];
        if (format === 'excel') {
          const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows, { header: headers });
          if (isRtl) ws['!views'] = [{ RTL: true }];
          ws['!cols'] = [{ wch: 10 }, { wch: 20 }, ...daysInMonth.map(() => ({ wch: 12 })), { wch: 15 }, { wch: 15 }];
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
              ...daysInMonth.map(day => row[day]),
              row.totalQuantity,
              row.totalPrice,
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
            className="text-center py-12 bg-white shadow-md rounded-xl border border-gray-200"
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
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[120px]">{isRtl ? 'المنتج' : 'Product'}</th>
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
                    <td className="px-4 py-3 text-gray-700 text-center">{index + 1}</td>
                    <td className="px-4 py-3 text-gray-700 text-center truncate">{row.product}</td>
                    {row.dailyQuantities.map((qty, i) => (
                      <td
                        key={i}
                        className={`px-4 py-3 text-center font-medium ${isIn ? 'text-green-700' : 'text-red-700'}`}
                        title={`${isRtl ? 'التغيير' : 'Change'}: ${row.changes[i] > 0 ? '+' : ''}${row.changes[i]} (${isRtl ? 'الكمية' : 'Quantity'}: ${qty})`}
                      >
                        {qty} {row.changes[i] !== 0 && `(${row.changes[i] > 0 ? '+' : ''}${row.changes[i]})`}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-gray-700 text-center font-medium">{row.totalQuantity}</td>
                    <td className="px-4 py-3 text-gray-700 text-center font-medium">
                      {row.totalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}
                    </td>
                  </tr>
                ))}
                <tr className={`font-semibold bg-gray-100 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-4 py-3 text-gray-800 text-center" colSpan={2}>{isRtl ? 'الإجمالي' : 'Total'}</td>
                  {daysInMonth.map((_, i) => (
                    <td key={i} className="px-4 py-3 text-gray-800 text-center">
                      {data.reduce((sum, row) => sum + row.dailyQuantities[i], 0)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-gray-800 text-center">{grandTotalQuantity}</td>
                  <td className="px-4 py-3 text-gray-800 text-center">
                    {grandTotalPrice.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}
                  </td>
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
    <div className={`px-6 py-8 min-h-screen ${isRtl ? 'rtl font-amiri' : 'ltr font-inter'} bg-gray-100`}>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">{isRtl ? 'تقارير الإنتاج' : 'Production Reports'}</h1>
      <div className="mb-8 bg-white shadow-md rounded-xl p-4">
        <div className="flex flex-wrap gap-2 mb-4 justify-center">
          {months.map(month => (
            <Button
              key={month.value}
              variant={selectedMonth === month.value ? 'primary' : 'secondary'}
              onClick={() => setSelectedMonth(month.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                selectedMonth === month.value ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {month.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2 border-b border-gray-200 justify-center">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-6 py-3 text-sm font-medium rounded-t-xl transition-all duration-200 ${
              activeTab === 'orders' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {isRtl ? 'توزيع الطلبات' : 'Order Distribution'}
          </button>
          <button
            onClick={() => setActiveTab('stockIn')}
            className={`px-6 py-3 text-sm font-medium rounded-t-xl transition-all duration-200 ${
              activeTab === 'stockIn' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {isRtl ? 'زيادة المخزون' : 'Stock Increases'}
          </button>
          <button
            onClick={() => setActiveTab('stockOut')}
            className={`px-6 py-3 text-sm font-medium rounded-t-xl transition-all duration-200 ${
              activeTab === 'stockOut' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {isRtl ? 'نقصان المخزون' : 'Stock Decreases'}
          </button>
        </div>
      </div>
      <AnimatePresence mode="wait">
        {activeTab === 'orders' && (
          <motion.div key="orders" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
            {renderOrderTable(orderData[selectedMonth] || [], isRtl ? 'تقرير توزيع الطلبات' : 'Order Distribution Report', selectedMonth)}
          </motion.div>
        )}
        {activeTab === 'stockIn' && (
          <motion.div key="stockIn" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
            {renderStockTable(stockInData[selectedMonth] || [], isRtl ? 'تقرير زيادة المخزون' : 'Stock Increases Report', selectedMonth, true)}
          </motion.div>
        )}
        {activeTab === 'stockOut' && (
          <motion.div key="stockOut" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
            {renderStockTable(stockOutData[selectedMonth] || [], isRtl ? 'تقرير نقصان المخزون' : 'Stock Decreases Report', selectedMonth, false)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductionReport;