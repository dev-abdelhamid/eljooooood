import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import { Button } from '../components/UI/Button';
import { Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { inventoryAPI, ordersAPI } from '../services/api';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';

const ProductionReport = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState([]);
  const [productionData, setProductionData] = useState([]);
  const currentDate = new Date('2025-10-12T09:12:00+03:00'); // 09:12 AM EEST, October 12, 2025
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate(); // 31 يوم في أكتوبر

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [inventory, orders] = await Promise.all([
          inventoryAPI.getInventory(),
          ordersAPI.getAll({ status: 'completed', page: 1, limit: 100 }),
        ]);

        console.log('Inventory:', inventory);
        console.log('Orders:', orders);

        // توزيع الطلبات
        const orderDistribution = new Map();
        orders.forEach(order => {
          const date = new Date(order.createdAt || order.date);
          const day = date.getDate();
          const month = date.getMonth();
          const year = date.getFullYear();
          if (year === currentDate.getFullYear() && month === currentDate.getMonth() && day <= currentDate.getDate()) {
            const branch = order.branch?.displayName || order.branchId || 'الفرع الرئيسي';
            order.items.forEach(item => {
              const product = item.product?.name || item.productName || 'Unknown Product';
              const key = `${branch}-${product}`;
              if (!orderDistribution.has(key)) {
                orderDistribution.set(key, {
                  branch,
                  product,
                  orderNumber: order.orderNumber || `ORDER-${Math.floor(Math.random() * 1000)}`,
                  quantities: Array(daysInMonth).fill(0),
                  total: 0,
                });
              }
              orderDistribution.get(key).quantities[day - 1] += item.quantity;
              orderDistribution.get(key).total += item.quantity;
            });
          }
        });

        // توزيع الإنتاج
        const productionMap = new Map();
        inventory.forEach(item => {
          item.movements.forEach(movement => {
            const date = new Date(movement.createdAt);
            const day = date.getDate();
            const month = date.getMonth();
            const year = date.getFullYear();
            if (year === currentDate.getFullYear() && month === currentDate.getMonth() && day <= currentDate.getDate()) {
              const product = item.productName || item.product?.name || 'Unknown Product';
              const branch = movement.branch?.displayName || movement.branchId || 'المصنع الرئيسي';
              if (!productionMap.has(product)) {
                productionMap.set(product, {
                  product,
                  branch,
                  quantities: Array(daysInMonth).fill(0),
                  total: 0,
                });
              }
              if (movement.type === 'in') { // الإنتاج يعتمد على المدخلات
                productionMap.get(product).quantities[day - 1] += Math.abs(movement.quantity);
                productionMap.get(product).total += Math.abs(movement.quantity);
              }
            }
          });
        });

        setOrderData(Array.from(orderDistribution.values()));
        setProductionData(Array.from(productionMap.values()));
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const renderTable = (data, title) => {
    const rows = useMemo(() => {
      return data.map((item, index) => ({
        id: `${title.toLowerCase().replace(' ', '-')}-${index + 1}`,
        orderNumber: item.orderNumber || '-',
        branch: { displayName: item.branch },
        product: item.product,
        totalQuantity: item.total,
        date: currentDate.toISOString().split('T')[0],
        dailyQuantities: item.quantities,
      }));
    }, [data]);

    const exportTable = useCallback((rows, fileName, format) => {
      if (format === 'excel') {
        const ws = XLSX.utils.json_to_sheet(rows.map(row => ({
          'رقم الطلب': row.orderNumber,
          'الفرع': row.branch.displayName,
          'المنتج': row.product,
          'الكمية الإجمالية': row.totalQuantity,
          'التاريخ': row.date,
          ...Object.fromEntries(Array(daysInMonth).fill(0).map((_, i) => [`اليوم ${i + 1}`, row.dailyQuantities[i]])),
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, fileName);
        XLSX.writeFile(wb, `${fileName}.xlsx`);
      } else if (format === 'pdf') {
        const doc = new jsPDF();
        doc.autoTable({
          head: [['رقم', 'رقم الطلب', 'الفرع', 'المنتج', 'الكمية الإجمالية', 'التاريخ', ...Array(daysInMonth).fill(0).map((_, i) => `اليوم ${i + 1}`)]],
          body: rows.map(row => [
            rows.indexOf(row) + 1,
            row.orderNumber,
            row.branch.displayName,
            row.product,
            row.totalQuantity,
            row.date,
            ...row.dailyQuantities,
          ]),
        });
        doc.save(`${fileName}.pdf`);
      }
    }, []);

    if (loading) return <OrderTableSkeleton isRtl={isRtl} />;
    if (rows.length === 0) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center py-12 bg-white shadow-md rounded-lg border border-gray-100"
        >
          <p className="text-gray-500 text-sm">{isRtl ? 'لا توجد بيانات' : 'No data available'}</p>
        </motion.div>
      );
    }
    return (
      <div className="mb-8">
        <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-3">
            {isRtl ? title : title}
          </h1>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={rows.length > 0 ? 'primary' : 'secondary'}
              onClick={rows.length > 0 ? () => exportTable(rows, `${title.toLowerCase().replace(' ', '_')}_report`, 'excel') : undefined}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm shadow-sm ${
                rows.length > 0 ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'
              }`}
              disabled={rows.length === 0}
            >
              <Upload className="w-5 h-5" />
              {isRtl ? 'تصدير إكسل' : 'Export Excel'}
            </Button>
            <Button
              variant={rows.length > 0 ? 'primary' : 'secondary'}
              onClick={rows.length > 0 ? () => exportTable(rows, `${title.toLowerCase().replace(' ', '_')}_report`, 'pdf') : undefined}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm shadow-sm ${
                rows.length > 0 ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'
              }`}
              disabled={rows.length === 0}
            >
              <Upload className="w-5 h-5" />
              {isRtl ? 'تصدير PDF' : 'Export PDF'}
            </Button>
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="overflow-x-auto rounded-md shadow-md border border-gray-100 bg-white"
        >
          <table className="min-w-full divide-y divide-gray-100 text-xs">
            <thead className="bg-gray-50">
              <tr className={isRtl ? 'flex-row-reverse' : ''}>
                <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[40px]">
                  {isRtl ? 'رقم' : 'No.'}
                </th>
                <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">
                  {isRtl ? 'رقم الطلب' : 'Order Number'}
                </th>
                <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">
                  {isRtl ? 'الفرع' : 'Branch'}
                </th>
                <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[120px]">
                  {isRtl ? 'المنتج' : 'Product'}
                </th>
                <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[80px]">
                  {isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}
                </th>
                <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">
                  {isRtl ? 'التاريخ' : 'Date'}
                </th>
                {Array(daysInMonth).fill(0).map((_, i) => (
                  <th key={i} className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[50px]">
                    {isRtl ? `اليوم ${i + 1}` : `Day ${i + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, index) => (
                <tr key={row.id} className={`hover:bg-gray-50 transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-2 py-2 text-gray-600 text-center whitespace-nowrap">{index + 1}</td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate max-w-[100px]">{row.orderNumber}</td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate max-w-[100px]">{row.branch.displayName}</td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate max-w-[120px]">{row.product}</td>
                  <td className="px-2 py-2 text-gray-600 text-center">{row.totalQuantity}</td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate">{row.date}</td>
                  {row.dailyQuantities.map((qty, i) => (
                    <td key={i} className="px-2 py-2 text-gray-600 text-center">{qty}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    );
  };

  return (
    <div className={`px-4 py-6 min-h-screen ${isRtl ? 'rtl' : 'ltr'}`}>
      {renderTable(orderData, isRtl ? 'تقرير توزيع الطلبات' : 'Order Distribution Report')}
      {renderTable(productionData, isRtl ? 'تقرير الإنتاج' : 'Production Report')}
    </div>
  );
};

export default ProductionReport;