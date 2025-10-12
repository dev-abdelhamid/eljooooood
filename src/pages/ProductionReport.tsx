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
import { ordersAPI, productionAssignmentsAPI, inventoryAPI } from '../api';
import { OrderTableSkeleton } from '../components/branch/OrderTableSkeleton';

const ProductionReport = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [activeTab, setActiveTab] = useState('products');
  const currentDate = new Date('2025-10-12T08:33:00+03:00'); // 08:33 AM EEST, October 12, 2025

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // جلب الطلبات المكتملة
        const orders = await ordersAPI.getAll({ status: 'completed', page: 1, limit: 100 });
        // جلب مهام الإنتاج
        const tasks = await productionAssignmentsAPI.getAllTasks();
        // جلب المخزون
        const inventory = await inventoryAPI.getInventory();

        const productionMap = new Map();
        orders.forEach(order => {
          order.items.forEach(item => {
            const task = tasks.find(t => t.itemId === item._id && t.status === 'completed');
            if (task) {
              const date = new Date(order.date);
              const day = date.getDate();
              if (date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear()) {
                if (!productionMap.has(item.product)) {
                  productionMap.set(item.product, Array(31).fill(0));
                }
                productionMap.get(item.product)[day - 1] += item.quantity;
              }
            }
          });
        });

        const processedData = Array.from(productionMap.entries()).map(([product, quantities]) => ({
          product,
          quantities,
          total: quantities.reduce((sum, qty) => sum + qty, 0),
        }));
        setData(processedData);
      } catch (error) {
        console.error('Failed to fetch production data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const rows = useMemo(() => {
    return data.map((item, index) => ({
      id: `prod-${index + 1}`,
      orderNumber: `PROD-${index + 1}`,
      branch: { displayName: 'الإنتاج الرئيسي' }, // يمكن تحديثه من orders.branchId
      status: 'مكتمل',
      products: item.product,
      totalAmount: item.total.toString(),
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
        'المنتجات': row.products,
        'إجمالي المبلغ': row.totalAmount,
        'الكمية الإجمالية': row.totalQuantity,
        'التاريخ': row.date,
        ...Object.fromEntries(Array(31).fill(0).map((_, i) => [`اليوم ${i + 1}`, row.dailyQuantities[i]])),
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, fileName);
      XLSX.writeFile(wb, `${fileName}.xlsx`);
    } else if (format === 'pdf') {
      const doc = new jsPDF();
      doc.autoTable({
        head: [['رقم', 'رقم الطلب', 'الفرع', 'المنتجات', 'إجمالي المبلغ', 'الكمية الإجمالية', 'التاريخ', ...Array(31).fill(0).map((_, i) => `اليوم ${i + 1}`)]],
        body: rows.map(row => [
          rows.indexOf(row) + 1,
          row.orderNumber,
          row.branch.displayName,
          row.products,
          row.totalAmount,
          row.totalQuantity,
          row.date,
          ...row.dailyQuantities,
        ]),
      });
      doc.save(`${fileName}.pdf`);
    }
  }, []);

  const renderTable = () => {
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
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center">
                {isRtl ? 'المنتجات' : 'Products'}
              </th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">
                {isRtl ? 'إجمالي المبلغ' : 'Total Amount'}
              </th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[80px]">
                {isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}
              </th>
              <th className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[100px]">
                {isRtl ? 'التاريخ' : 'Date'}
              </th>
              {Array(31).fill(0).map((_, i) => (
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
                <td className="px-2 py-2 text-gray-600 text-center truncate max-w-xs">{row.products}</td>
                <td className="px-2 py-2 text-gray-600 text-center truncate">{row.totalAmount}</td>
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
    );
  };

  return (
    <div className={`px-4 py-6 min-h-screen ${isRtl ? 'rtl' : 'ltr'}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-3">
            {isRtl ? 'تقرير الإنتاج' : 'Production Report'}
          </h1>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={rows.length > 0 ? 'primary' : 'secondary'}
              onClick={rows.length > 0 ? () => exportTable(rows, 'production_report', 'excel') : undefined}
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
              onClick={rows.length > 0 ? () => exportTable(rows, 'production_report', 'pdf') : undefined}
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
        <div className="mb-4">
          <div className={`flex gap-2 border-b ${isRtl ? 'flex-row-reverse' : ''}`}>
            <button
              className={`px-4 py-2 font-medium ${activeTab === 'products' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}`}
              onClick={() => setActiveTab('products')}
            >
              {isRtl ? 'المنتجات' : 'Products'}
            </button>
            <button
              className={`px-4 py-2 font-medium ${activeTab === 'branches' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}`}
              onClick={() => setActiveTab('branches')}
            >
              {isRtl ? 'الفروع' : 'Branches'}
            </button>
          </div>
        </div>
        {renderTable()}
      </motion.div>
    </div>
  );
};

export default ProductionReport;