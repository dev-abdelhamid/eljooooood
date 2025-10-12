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
import axios from 'axios';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

const ProductionReport = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState([]);
  const [productionData, setProductionData] = useState([]);
  const currentDate = new Date('2025-10-12T09:35:00+03:00'); // Updated to current time
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate(); // 31 يوم

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        api.interceptors.request.use((config) => {
          if (token) config.headers.Authorization = `Bearer ${token}`;
          config.params = { ...config.params, lang: language };
          return config;
        });

        const [inventoryResponse, ordersResponse] = await Promise.all([
          api.get('/inventory', { params: { branch: user?.branchId } }),
          api.get('/orders', { params: { month: currentDate.getMonth() + 1, year: currentDate.getFullYear(), branch: user?.branchId } })
        ]);

        const inventoryData = inventoryResponse.data.inventory;
        const ordersData = ordersResponse.data.orders || [];

        // توزيع الطلبات حسب الفروع يوميًا لكل منتج
        const orderDistribution = new Map();
        ordersData.forEach(order => {
          const orderDate = new Date(order.createdAt);
          if (orderDate.getMonth() === currentDate.getMonth() && orderDate.getFullYear() === currentDate.getFullYear()) {
            const day = orderDate.getDate() - 1;
            order.items.forEach(item => {
              const key = `${item.productName}-${order.branchId}`;
              if (!orderDistribution.has(key)) {
                orderDistribution.set(key, {
                  product: item.productName,
                  branch: order.branchName || 'المصنع الرئيسي',
                  quantities: Array(daysInMonth).fill(0),
                });
              }
              const entry = orderDistribution.get(key);
              if (day >= 0 && day < daysInMonth) {
                entry.quantities[day] += item.quantity;
              }
            });
          }
        });
        setOrderData(Array.from(orderDistribution.values()).map(item => ({
          ...item,
          total: item.quantities.reduce((sum, qty) => sum + qty, 0),
        })));

        // توزيع الإنتاج
        const productionMap = new Map();
        inventoryData.forEach(item => {
          const dailyQuantities = Array(daysInMonth).fill(0);
          item.movements?.forEach(movement => {
            const date = new Date(movement.createdAt);
            if (date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear()) {
              const day = date.getDate() - 1;
              if (day >= 0 && day < daysInMonth) {
                dailyQuantities[day] += movement.type === 'in' ? Math.abs(movement.quantity) : -Math.abs(movement.quantity);
              }
            }
          });
          const key = item.productName;
          if (!productionMap.has(key)) {
            productionMap.set(key, {
              product: item.productName,
              branch: item.branchName || 'المصنع الرئيسي',
              quantities: dailyQuantities,
              total: dailyQuantities.reduce((sum, qty) => sum + qty, 0),
            });
          }
        });
        setProductionData(Array.from(productionMap.values()));
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [language, user?.branchId]);

  const renderTable = (data, title) => {
    const rows = useMemo(() => {
      const rowsData = data.map((item, index) => ({
        id: `${title.toLowerCase().replace(' ', '-')}-${index + 1}`,
        orderNumber: item.orderNumber || '-',
        branch: { displayName: item.branch },
        product: item.product,
        totalQuantity: item.total,
        dailyQuantities: item.quantities,
      }));
      const totalRow = {
        id: `${title.toLowerCase().replace(' ', '-')}-total`,
        orderNumber: isRtl ? 'الإجمالي' : 'Total',
        branch: { displayName: '' },
        product: '',
        totalQuantity: data.reduce((sum, item) => sum + item.total, 0),
        dailyQuantities: Array(daysInMonth).fill(0).map((_, i) => data.reduce((sum, item) => sum + (item.quantities[i] || 0), 0)),
      };
      return [...rowsData, totalRow];
    }, [data]);

    const exportTable = useCallback((rows, fileName, format) => {
      if (format === 'excel') {
        const ws = XLSX.utils.json_to_sheet(rows.map(row => ({
          'رقم الطلب': row.orderNumber,
          'الفرع': row.branch.displayName,
          'المنتج': row.product,
          'الكمية الإجمالية': row.totalQuantity,
          ...Object.fromEntries(Array(daysInMonth).fill(0).map((_, i) => [`اليوم ${i + 1}`, row.dailyQuantities[i]])),
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, fileName);
        XLSX.writeFile(wb, `${fileName}.xlsx`);
      } else if (format === 'pdf') {
        const doc = new jsPDF();
        doc.autoTable({
          head: [['رقم', 'رقم الطلب', 'الفرع', 'المنتج', 'الكمية الإجمالية', ...Array(daysInMonth).fill(0).map((_, i) => `اليوم ${i + 1}`)]],
          body: rows.map(row => [
            rows.indexOf(row) + 1,
            row.orderNumber,
            row.branch.displayName,
            row.product,
            row.totalQuantity,
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
                {Array(daysInMonth).fill(0).map((_, i) => (
                  <th key={i} className="px-2 py-2 font-medium text-gray-600 uppercase tracking-wider text-center min-w-[50px]">
                    {isRtl ? `اليوم ${i + 1}` : `Day ${i + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, index) => (
                <tr key={row.id} className={`hover:bg-gray-50 transition-colors ${isRtl ? 'flex-row-reverse' : ''} ${index === rows.length - 1 ? 'font-bold bg-gray-100' : ''}`}>
                  <td className="px-2 py-2 text-gray-600 text-center whitespace-nowrap">{index + 1}</td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate max-w-[100px]">{row.orderNumber}</td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate max-w-[100px]">{row.branch.displayName}</td>
                  <td className="px-2 py-2 text-gray-600 text-center truncate max-w-[120px]">{row.product}</td>
                  <td className="px-2 py-2 text-gray-600 text-center">{row.totalQuantity}</td>
                  {row.dailyQuantities.map((qty, i) => (
                    <td key={i} className="px-2 py-2 text-gray-600 text-center">{qty || 0}</td>
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