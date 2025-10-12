import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Select } from '../components/UI/Select';
import { Input } from '../components/UI/Input';
import { Search, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { ordersAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';
import { toast } from 'react-toastify';

const ITEMS_PER_PAGE = 10;

const ProductionTrackingPage = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const [data, setData] = useState([]);
  const [branches, setBranches] = useState([]);
  const [filterBranch, setFilterBranch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !['admin', 'production'].includes(user.role)) {
      setError(isRtl ? 'غير مصرح للوصول' : 'Unauthorized access');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        // استدعاء بيانات الطلبات بدلاً من getProductionStats
        const ordersResp = await ordersAPI.getOrders({ status: 'in_production' });
        const branchesResp = await ordersAPI.getBranches(); // افتراض وجود دالة لجلب الفروع

        const mappedBranches = branchesResp.map(b => ({
          _id: b._id,
          name: b.name,
          nameEn: b.nameEn,
          displayName: isRtl ? b.name : b.nameEn || b.name,
        }));
        setBranches(mappedBranches);

        const combinedData = ordersResp.map(order => {
          const totalSales = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          const dailyProduction = order.items.reduce((sum, item) => sum + (item.status === 'completed' ? item.quantity : 0), 0);

          return {
            orderNumber: order.orderNumber,
            branch: mappedBranches.find(b => b._id === order.branch)?.displayName || '',
            product: order.items.map(i => isRtl ? i.product.name : (i.product.nameEn || i.product.name)).join(', '),
            quantity: order.items.reduce((sum, i) => sum + i.quantity, 0),
            status: order.status,
            date: formatDate(new Date(order.createdAt), language),
            salesAmount: totalSales,
            dailyProduction: dailyProduction,
          };
        });
        setData(combinedData);
      } catch (err) {
        setError(isRtl ? `خطأ في جلب البيانات: ${err.message}` : `Error fetching data: ${err.message}`);
        toast.error(error, { position: isRtl ? 'top-left' : 'top-right' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, isRtl, language]);

  const filteredData = useMemo(() => {
    const normalizedQuery = searchQuery.toLowerCase();
    return data.filter(item =>
      item.orderNumber.toLowerCase().includes(normalizedQuery) ||
      item.branch.toLowerCase().includes(normalizedQuery) ||
      item.product.toLowerCase().includes(normalizedQuery) ||
      item.status.toLowerCase().includes(normalizedQuery)
    ).filter(item => !filterBranch || item.branch === filterBranch);
  }, [data, searchQuery, filterBranch]);

  const paginatedData = useMemo(() => 
    filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
  [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);

  const handleExportToExcel = useCallback(() => {
    const headers = [
      isRtl ? 'رقم الطلب' : 'Order Number',
      isRtl ? 'الفرع' : 'Branch',
      isRtl ? 'المنتج' : 'Product',
      isRtl ? 'الكمية' : 'Quantity',
      isRtl ? 'الحالة' : 'Status',
      isRtl ? 'التاريخ' : 'Date',
      isRtl ? 'إجمالي المبيعات' : 'Sales Amount',
      isRtl ? 'الإنتاج اليومي' : 'Daily Production',
    ];
    const exportData = filteredData.map(item => ({
      [headers[0]]: item.orderNumber,
      [headers[1]]: item.branch,
      [headers[2]]: item.product,
      [headers[3]]: item.quantity,
      [headers[4]]: item.status,
      [headers[5]]: item.date,
      [headers[6]]: item.salesAmount.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' }),
      [headers[7]]: item.dailyProduction,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData, { header: headers });
    if (isRtl) ws['!views'] = [{ RTL: true }];
    ws['!cols'] = headers.map(() => ({ wch: 15 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isRtl ? 'الإنتاج' : 'Production');
    XLSX.writeFile(wb, 'ProductionTracking.xlsx');
    toast.success(isRtl ? 'تم تصدير الملف بنجاح' : 'Export successful', { position: isRtl ? 'top-left' : 'top-right' });
  }, [filteredData, isRtl]);

  const handlePageChange = useCallback((page) => setCurrentPage(page), []);

  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <div className={`p-4 ${isRtl ? 'text-right' : 'text-left'}`}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">{isRtl ? 'متابعة الإنتاج' : 'Production Tracking'}</h1>
        <p className="text-xs text-gray-600">{isRtl ? 'إدارة الطلبات والمبيعات والإنتاج اليومي' : 'Manage orders, sales, and daily production'}</p>
      </motion.div>

      <Card className="p-4 mb-6 bg-white shadow-md rounded-xl border border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="relative">
            <Search className={`w-4 h-4 text-gray-500 ${isRtl ? 'left-2' : 'right-2'} absolute top-2`} />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRtl ? 'ابحث برقم الطلب أو الفرع...' : 'Search by order number or branch...'}
              className={`w-full ${isRtl ? 'pl-8' : 'pr-8'} rounded-full border-gray-200 focus:ring-amber-500 text-sm`}
            />
          </div>
          <Select
            options={[{ value: '', label: isRtl ? 'جميع الفروع' : 'All Branches' }, ...branches.map(b => ({ value: b.displayName, label: b.displayName }))]}
            value={filterBranch}
            onChange={setFilterBranch}
            className="w-full rounded-full border-gray-200 focus:ring-amber-500 text-sm"
          />
        </div>
        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={handleExportToExcel}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white rounded-full px-4 py-2"
            disabled={data.length === 0}
          >
            <Download className="w-4 h-4" />
            {isRtl ? 'تصدير إلى Excel' : 'Export to Excel'}
          </Button>
        </div>
      </Card>

      {loading ? (
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 rounded mb-2"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      ) : paginatedData.length === 0 ? (
        <Card className="p-6 text-center bg-gray-50 rounded-xl">
          <p className="text-gray-500 text-sm">{isRtl ? 'لا توجد بيانات للعرض' : 'No data to display'}</p>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  {['orderNumber', 'branch', 'product', 'quantity', 'status', 'date', 'salesAmount', 'dailyProduction'].map((key) => (
                    <th key={key} className={`p-2 border-b ${isRtl ? 'text-right' : 'text-left'}`}>
                      {isRtl ? 
                        { orderNumber: 'رقم الطلب', branch: 'الفرع', product: 'المنتج', quantity: 'الكمية', status: 'الحالة', date: 'التاريخ', salesAmount: 'إجمالي المبيعات', dailyProduction: 'الإنتاج اليومي' }[key] :
                        { orderNumber: 'Order Number', branch: 'Branch', product: 'Product', quantity: 'Quantity', status: 'Status', date: 'Date', salesAmount: 'Sales Amount', dailyProduction: 'Daily Production' }[key]
                      }
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((item, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="p-2">{item.orderNumber}</td>
                    <td className="p-2">{item.branch}</td>
                    <td className="p-2">{item.product}</td>
                    <td className="p-2">{item.quantity}</td>
                    <td className="p-2">{item.status}</td>
                    <td className="p-2">{item.date}</td>
                    <td className="p-2">{item.salesAmount.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}</td>
                    <td className="p-2">{item.dailyProduction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-between items-center">
            <span className="text-xs text-gray-600">
              {isRtl ? `الصفحة ${currentPage} من ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
            </span>
            <div className="flex gap-2">
              <Button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded"
              >
                {isRtl ? 'السابق' : 'Previous'}
              </Button>
              <Button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded"
              >
                {isRtl ? 'التالي' : 'Next'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ProductionTrackingPage;