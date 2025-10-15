import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';
import { Upload } from 'lucide-react';
import { Tooltip } from 'react-tooltip';
import { Button } from '../components/UI/Button';
import { ProductDropdown } from './NewOrder';
import OrderTableSkeleton  from '../components/Shared/OrderTableSkeleton';
import OrdersTable from './OrdersTable';
import DailyOrdersTable from './DailyOrdersTable';

interface Branch {
  id: string;
  name: string;
}

interface OrderRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  totalQuantity: number;
  totalPrice: number;
  dailyQuantities: number[];
  dailyBranchDetails: { branchId: string; quantity: number }[][];
}

interface ReturnRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  totalReturns: number;
  totalValue: number;
  dailyReturns: number[];
  dailyBranchDetails: { branchId: string; quantity: number }[][];
}

interface SalesRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  totalSales: number;
  totalValue: number;
  dailySales: number[];
  dailyBranchDetails: { branchId: string; quantity: number }[][];
}

interface OrdersVsReturnsRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  totalOrders: number;
  totalReturns: number;
  totalRatio: number;
  dailyOrders: number[];
  dailyReturns: number[];
}

const ProductionReport: React.FC = () => {
  const isRtl = true; // يمكن جعل هذا ديناميكيًا بناءً على إعدادات المستخدم
  const locale = isRtl ? ar : enUS;
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth());
  const [orderData, setOrderData] = useState<{ [key: number]: OrderRow[] }>({});
  const [dailyOrderData, setDailyOrderData] = useState<{ [key: number]: OrderRow[] }>({});
  const [stockInData, setStockInData] = useState<{ [key: number]: OrderRow[] }>({});
  const [stockOutData, setStockOutData] = useState<{ [key: number]: OrderRow[] }>({});
  const [returnData, setReturnData] = useState<{ [key: number]: ReturnRow[] }>({});
  const [salesData, setSalesData] = useState<{ [key: number]: SalesRow[] }>({});
  const [ordersVsReturnsData, setOrdersVsReturnsData] = useState<{ [key: number]: OrdersVsReturnsRow[] }>({});
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('orders');

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        value: i.toString(),
        label: format(new Date(2025, i, 1), 'MMMM', { locale }),
      })),
    [locale]
  );

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(new Date(2025, selectedMonth, 1));
    const end = endOfMonth(start);
    return eachDayOfInterval({ start, end }).map((day) => format(day, 'd', { locale }));
  }, [selectedMonth, locale]);

  const formatPrice = useCallback(
    (price: number, isRtl: boolean): string => {
      return new Intl.NumberFormat(isRtl ? 'ar-EG' : 'en-US', {
        style: 'currency',
        currency: 'SAR',
      }).format(price);
    },
    []
  );

  const formatNumber = useCallback(
    (num: number | string, isRtl: boolean): string => {
      return new Intl.NumberFormat(isRtl ? 'ar-EG' : 'en-US').format(Number(num));
    },
    []
  );

  const getTooltipContent = useCallback(
    (qty: number, branchDetails: { branchId: string; quantity: number }[], isRtl: boolean, type: string): string => {
      if (!branchDetails || branchDetails.length === 0) return '';
      const branchQuantities = branchDetails
        .map((detail) => {
          const branch = allBranches.find((b) => b.id === detail.branchId);
          return `${branch?.name || 'Unknown'}: ${formatNumber(detail.quantity, isRtl)}`;
        })
        .join('\n');
      return `${isRtl ? 'الكمية' : 'Quantity'}: ${formatNumber(qty, isRtl)}\n${branchQuantities}`;
    },
    [allBranches, formatNumber]
  );

  const exportToPDF = useCallback(
    (
      dataRows: any[],
      title: string,
      monthName: string,
      headers: string[],
      isRtl: boolean,
      dataLength: number,
      totalQuantity: number,
      totalPrice: number,
      extraColumns: string[]
    ) => {
      // تنفيذ تصدير PDF باستخدام مكتبة مثل jsPDF
      // يتم إضافته لاحقًا بناءً على متطلبات العميل
      toast.success(isRtl ? 'تم تصدير ملف PDF بنجاح' : 'PDF exported successfully', {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    },
    []
  );

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // محاكاة جلب البيانات من الواجهة الخلفية
        const branchesResponse = await fetch('/api/branches');
        const branches = await branchesResponse.json();
        setAllBranches(branches);

        const startDate = format(startOfMonth(new Date(2025, selectedMonth, 1)), 'yyyy-MM-dd');
        const endDate = format(endOfMonth(new Date(2025, selectedMonth, 1)), 'yyyy-MM-dd');

        const ordersResponse = await fetch(`/api/orders?startDate=${startDate}&endDate=${endDate}`);
        const orders = await ordersResponse.json();
        setOrderData({ [selectedMonth]: orders });

        const dailyOrdersResponse = await fetch(`/api/daily-orders?startDate=${startDate}&endDate=${endDate}`);
        const dailyOrders = await dailyOrdersResponse.json();
        setDailyOrderData({ [selectedMonth]: dailyOrders });

        const stockInResponse = await fetch(`/api/stock-in?startDate=${startDate}&endDate=${endDate}`);
        const stockIn = await stockInResponse.json();
        setStockInData({ [selectedMonth]: stockIn });

        const stockOutResponse = await fetch(`/api/stock-out?startDate=${startDate}&endDate=${endDate}`);
        const stockOut = await stockOutResponse.json();
        setStockOutData({ [selectedMonth]: stockOut });

        const returnsResponse = await fetch(`/api/returns?startDate=${startDate}&endDate=${endDate}`);
        const returns = await returnsResponse.json();
        setReturnData({ [selectedMonth]: returns });

        const salesResponse = await fetch(`/api/sales?startDate=${startDate}&endDate=${endDate}`);
        const sales = await salesResponse.json();
        setSalesData({ [selectedMonth]: sales });

        const ordersVsReturnsResponse = await fetch(`/api/orders-vs-returns?startDate=${startDate}&endDate=${endDate}`);
        const ordersVsReturns = await ordersVsReturnsResponse.json();
        setOrdersVsReturnsData({ [selectedMonth]: ordersVsReturns });
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error(isRtl ? 'فشل في جلب البيانات' : 'Failed to fetch data', {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedMonth, isRtl]);

  const renderStockTable = useCallback(
    (data: OrderRow[], title: string, month: number, type: 'in' | 'out') => {
      const grandTotalQuantity = data.reduce((sum, row) => sum + row.totalQuantity, 0);
      const grandTotalPrice = data.reduce((sum, row) => sum + row.totalPrice, 0);
      const monthName = months[month].label;

      const exportTable = (format: 'excel' | 'pdf') => {
        const headers = [
          isRtl ? 'رقم' : 'No.',
          isRtl ? 'الكود' : 'Code',
          isRtl ? 'المنتج' : 'Product',
          isRtl ? 'وحدة المنتج' : 'Product Unit',
          ...daysInMonth,
          isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
          isRtl ? 'السعر الإجمالي' : 'Total Price',
        ];
        const rows = [
          ...data.map((row, index) => ({
            no: index + 1,
            code: row.code,
            product: row.product,
            unit: row.unit,
            ...Object.fromEntries(row.dailyQuantities.map((qty, i) => [daysInMonth[i], qty])),
            totalQuantity: row.totalQuantity,
            totalPrice: formatPrice(row.totalPrice, isRtl),
          })),
          {
            no: '',
            code: '',
            product: isRtl ? 'الإجمالي' : 'Total',
            unit: '',
            ...Object.fromEntries(
              daysInMonth.map((_, i) => [
                daysInMonth[i],
                data.reduce((sum, row) => sum + row.dailyQuantities[i], 0),
              ])
            ),
            totalQuantity: grandTotalQuantity,
            totalPrice: formatPrice(grandTotalPrice, isRtl),
          },
        ];
        const dataRows = rows.map((row) => [
          row.no,
          row.code,
          row.product,
          row.unit,
          ...daysInMonth.map((day) => row[day]),
          row.totalQuantity,
          row.totalPrice,
        ]);

        if (format === 'excel') {
          const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map((row) => Object.fromEntries(Object.entries(row).reverse())) : rows, {
            header: headers,
          });
          if (isRtl) ws['!views'] = [{ RTL: true }];
          ws['!cols'] = [
            { wch: 10 },
            { wch: 15 },
            { wch: 20 },
            { wch: 15 },
            ...daysInMonth.map(() => ({ wch: 12 })),
            { wch: 15 },
            { wch: 15 },
          ];
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, `${title}_${monthName}`);
          XLSX.writeFile(wb, `${title}_${monthName}.xlsx`);
          toast.success(isRtl ? 'تم تصدير ملف Excel بنجاح' : 'Excel exported successfully', {
            position: isRtl ? 'top-left' : 'top-right',
            autoClose: 3000,
          });
        } else if (format === 'pdf') {
          exportToPDF(dataRows, title, monthName, headers, isRtl, data.length, grandTotalQuantity, grandTotalPrice, []);
        }
      };

      return (
        <div className="mb-8">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h2 className="text-lg font-semibold text-gray-800">{isRtl ? `${title} - ${monthName}` : `${title} - ${monthName}`}</h2>
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
          {data.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              {isRtl ? 'لا توجد بيانات متاحة لهذا الشهر' : 'No data available for this month'}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-x-auto rounded-xl shadow-md border border-gray-200 bg-white"
            >
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-blue-50 sticky top-0">
                  <tr className={isRtl ? 'flex-row-reverse' : ''}>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[40px]">{isRtl ? 'رقم' : 'No.'}</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'الكود' : 'Code'}</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[120px]">{isRtl ? 'المنتج' : 'Product'}</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'وحدة المنتج' : 'Product Unit'}</th>
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
                      <td className="px-4 py-3 text-gray-700 text-center">{formatNumber(index + 1, isRtl)}</td>
                      <td className="px-4 py-3 text-gray-700 text-center truncate">{row.code}</td>
                      <td className="px-4 py-3 text-gray-700 text-center truncate">{row.product}</td>
                      <td className="px-4 py-3 text-gray-700 text-center truncate">{row.unit}</td>
                      {row.dailyQuantities.map((qty, i) => (
                        <td
                          key={i}
                          className={`px-4 py-3 text-center font-medium ${
                            qty > 0 ? 'bg-green-50 text-green-700' : qty < 0 ? 'bg-red-50 text-red-700' : 'text-gray-700'
                          }`}
                          data-tooltip-id="daily-quantity-tooltip"
                          data-tooltip-content={getTooltipContent(qty, row.dailyBranchDetails[i], isRtl, type)}
                        >
                          {qty !== 0 ? `${qty > 0 ? '+' : ''}${formatNumber(qty, isRtl)}` : '0'}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalQuantity, isRtl)}</td>
                      <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatPrice(row.totalPrice, isRtl)}</td>
                    </tr>
                  ))}
                  <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <td className="px-4 py-3 text-gray-800 text-center" colSpan={4}>
                      {isRtl ? 'الإجمالي' : 'Total'}
                    </td>
                    {daysInMonth.map((_, i) => (
                      <td key={i} className="px-4 py-3 text-gray-800 text-center">
                        {formatNumber(data.reduce((sum, row) => sum + row.dailyQuantities[i], 0), isRtl)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalQuantity, isRtl)}</td>
                    <td className="px-4 py-3 text-gray-800 text-center">{formatPrice(grandTotalPrice, isRtl)}</td>
                  </tr>
                </tbody>
              </table>
              <Tooltip id="daily-quantity-tooltip" place="top" effect="solid" className="custom-tooltip" />
            </motion.div>
          )}
        </div>
      );
    },
    [daysInMonth, isRtl, months, formatPrice, formatNumber, exportToPDF, getTooltipContent]
  );

  const renderReturnsTable = useCallback(
    (data: ReturnRow[], title: string, month: number) => {
      const grandTotalReturns = data.reduce((sum, row) => sum + row.totalReturns, 0);
      const grandTotalValue = data.reduce((sum, row) => sum + row.totalValue, 0);
      const monthName = months[month].label;

      const exportTable = (format: 'excel' | 'pdf') => {
        const headers = [
          isRtl ? 'رقم' : 'No.',
          isRtl ? 'الكود' : 'Code',
          isRtl ? 'المنتج' : 'Product',
          isRtl ? 'وحدة المنتج' : 'Product Unit',
          ...daysInMonth,
          isRtl ? 'إجمالي المرتجعات' : 'Total Returns',
          isRtl ? 'القيمة الإجمالية' : 'Total Value',
        ];
        const rows = [
          ...data.map((row, index) => ({
            no: index + 1,
            code: row.code,
            product: row.product,
            unit: row.unit,
            ...Object.fromEntries(row.dailyReturns.map((qty, i) => [daysInMonth[i], qty])),
            totalReturns: row.totalReturns,
            totalValue: formatPrice(row.totalValue, isRtl),
          })),
          {
            no: '',
            code: '',
            product: isRtl ? 'الإجمالي' : 'Total',
            unit: '',
            ...Object.fromEntries(
              daysInMonth.map((_, i) => [
                daysInMonth[i],
                data.reduce((sum, row) => sum + row.dailyReturns[i], 0),
              ])
            ),
            totalReturns: grandTotalReturns,
            totalValue: formatPrice(grandTotalValue, isRtl),
          },
        ];
        const dataRows = rows.map((row) => [
          row.no,
          row.code,
          row.product,
          row.unit,
          ...daysInMonth.map((day) => row[day]),
          row.totalReturns,
          row.totalValue,
        ]);

        if (format === 'excel') {
          const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map((row) => Object.fromEntries(Object.entries(row).reverse())) : rows, {
            header: headers,
          });
          if (isRtl) ws['!views'] = [{ RTL: true }];
          ws['!cols'] = [
            { wch: 10 },
            { wch: 15 },
            { wch: 20 },
            { wch: 15 },
            ...daysInMonth.map(() => ({ wch: 12 })),
            { wch: 15 },
            { wch: 15 },
          ];
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, `${title}_${monthName}`);
          XLSX.writeFile(wb, `${title}_${monthName}.xlsx`);
          toast.success(isRtl ? 'تم تصدير ملف Excel بنجاح' : 'Excel exported successfully', {
            position: isRtl ? 'top-left' : 'top-right',
            autoClose: 3000,
          });
        } else if (format === 'pdf') {
          exportToPDF(dataRows, title, monthName, headers, isRtl, data.length, grandTotalReturns, grandTotalValue, []);
        }
      };

      return (
        <div className="mb-8">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h2 className="text-lg font-semibold text-gray-800">{isRtl ? `${title} - ${monthName}` : `${title} - ${monthName}`}</h2>
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
          {data.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              {isRtl ? 'لا توجد بيانات متاحة لهذا الشهر' : 'No data available for this month'}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-x-auto rounded-xl shadow-md border border-gray-200 bg-white"
            >
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-blue-50 sticky top-0">
                  <tr className={isRtl ? 'flex-row-reverse' : ''}>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[40px]">{isRtl ? 'رقم' : 'No.'}</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'الكود' : 'Code'}</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[120px]">{isRtl ? 'المنتج' : 'Product'}</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'وحدة المنتج' : 'Product Unit'}</th>
                    {daysInMonth.map((day, i) => (
                      <th key={i} className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">
                        {day}
                      </th>
                    ))}
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                      {isRtl ? 'إجمالي المرتجعات' : 'Total Returns'}
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                      {isRtl ? 'القيمة الإجمالية' : 'Total Value'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.map((row, index) => (
                    <tr key={row.id} className={`hover:bg-blue-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <td className="px-4 py-3 text-gray-700 text-center">{formatNumber(index + 1, isRtl)}</td>
                      <td className="px-4 py-3 text-gray-700 text-center truncate">{row.code}</td>
                      <td className="px-4 py-3 text-gray-700 text-center truncate">{row.product}</td>
                      <td className="px-4 py-3 text-gray-700 text-center truncate">{row.unit}</td>
                      {row.dailyReturns.map((qty, i) => (
                        <td
                          key={i}
                          className={`px-4 py-3 text-center font-medium ${
                            qty > 0 ? 'bg-red-50 text-red-700' : 'text-gray-700'
                          }`}
                          data-tooltip-id="daily-returns-tooltip"
                          data-tooltip-content={getTooltipContent(qty, row.dailyBranchDetails[i], isRtl, 'return')}
                        >
                          {qty !== 0 ? `${qty > 0 ? '+' : ''}${formatNumber(qty, isRtl)}` : '0'}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalReturns, isRtl)}</td>
                      <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatPrice(row.totalValue, isRtl)}</td>
                    </tr>
                  ))}
                  <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <td className="px-4 py-3 text-gray-800 text-center" colSpan={4}>
                      {isRtl ? 'الإجمالي' : 'Total'}
                    </td>
                    {daysInMonth.map((_, i) => (
                      <td key={i} className="px-4 py-3 text-gray-800 text-center">
                        {formatNumber(data.reduce((sum, row) => sum + row.dailyReturns[i], 0), isRtl)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalReturns, isRtl)}</td>
                    <td className="px-4 py-3 text-gray-800 text-center">{formatPrice(grandTotalValue, isRtl)}</td>
                  </tr>
                </tbody>
              </table>
              <Tooltip id="daily-returns-tooltip" place="top" effect="solid" className="custom-tooltip" />
            </motion.div>
          )}
        </div>
      );
    },
    [daysInMonth, isRtl, months, formatPrice, formatNumber, exportToPDF, getTooltipContent]
  );

  const renderSalesTable = useCallback(
    (data: SalesRow[], title: string, month: number) => {
      const grandTotalSales = data.reduce((sum, row) => sum + row.totalSales, 0);
      const grandTotalValue = data.reduce((sum, row) => sum + row.totalValue, 0);
      const monthName = months[month].label;

      const exportTable = (format: 'excel' | 'pdf') => {
        const headers = [
          isRtl ? 'رقم' : 'No.',
          isRtl ? 'الكود' : 'Code',
          isRtl ? 'المنتج' : 'Product',
          isRtl ? 'وحدة المنتج' : 'Product Unit',
          ...daysInMonth,
          isRtl ? 'إجمالي المبيعات' : 'Total Sales',
          isRtl ? 'القيمة الإجمالية' : 'Total Value',
        ];
        const rows = [
          ...data.map((row, index) => ({
            no: index + 1,
            code: row.code,
            product: row.product,
            unit: row.unit,
            ...Object.fromEntries(row.dailySales.map((qty, i) => [daysInMonth[i], qty])),
            totalSales: row.totalSales,
            totalValue: formatPrice(row.totalValue, isRtl),
          })),
          {
            no: '',
            code: '',
            product: isRtl ? 'الإجمالي' : 'Total',
            unit: '',
            ...Object.fromEntries(
              daysInMonth.map((_, i) => [
                daysInMonth[i],
                data.reduce((sum, row) => sum + row.dailySales[i], 0),
              ])
            ),
            totalSales: grandTotalSales,
            totalValue: formatPrice(grandTotalValue, isRtl),
          },
        ];
        const dataRows = rows.map((row) => [
          row.no,
          row.code,
          row.product,
          row.unit,
          ...daysInMonth.map((day) => row[day]),
          row.totalSales,
          row.totalValue,
        ]);

        if (format === 'excel') {
          const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map((row) => Object.fromEntries(Object.entries(row).reverse())) : rows, {
            header: headers,
          });
          if (isRtl) ws['!views'] = [{ RTL: true }];
          ws['!cols'] = [
            { wch: 10 },
            { wch: 15 },
            { wch: 20 },
            { wch: 15 },
            ...daysInMonth.map(() => ({ wch: 12 })),
            { wch: 15 },
            { wch: 15 },
          ];
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, `${title}_${monthName}`);
          XLSX.writeFile(wb, `${title}_${monthName}.xlsx`);
          toast.success(isRtl ? 'تم تصدير ملف Excel بنجاح' : 'Excel exported successfully', {
            position: isRtl ? 'top-left' : 'top-right',
            autoClose: 3000,
          });
        } else if (format === 'pdf') {
          exportToPDF(dataRows, title, monthName, headers, isRtl, data.length, grandTotalSales, grandTotalValue, []);
        }
      };

      return (
        <div className="mb-8">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h2 className="text-lg font-semibold text-gray-800">{isRtl ? `${title} - ${monthName}` : `${title} - ${monthName}`}</h2>
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
          {data.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              {isRtl ? 'لا توجد بيانات متاحة لهذا الشهر' : 'No data available for this month'}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-x-auto rounded-xl shadow-md border border-gray-200 bg-white"
            >
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-blue-50 sticky top-0">
                  <tr className={isRtl ? 'flex-row-reverse' : ''}>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[40px]">{isRtl ? 'رقم' : 'No.'}</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'الكود' : 'Code'}</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[120px]">{isRtl ? 'المنتج' : 'Product'}</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'وحدة المنتج' : 'Product Unit'}</th>
                    {daysInMonth.map((day, i) => (
                      <th key={i} className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">
                        {day}
                      </th>
                    ))}
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                      {isRtl ? 'إجمالي المبيعات' : 'Total Sales'}
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                      {isRtl ? 'القيمة الإجمالية' : 'Total Value'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.map((row, index) => (
                    <tr key={row.id} className={`hover:bg-blue-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <td className="px-4 py-3 text-gray-700 text-center">{formatNumber(index + 1, isRtl)}</td>
                      <td className="px-4 py-3 text-gray-700 text-center truncate">{row.code}</td>
                      <td className="px-4 py-3 text-gray-700 text-center truncate">{row.product}</td>
                      <td className="px-4 py-3 text-gray-700 text-center truncate">{row.unit}</td>
                      {row.dailySales.map((qty, i) => (
                        <td
                          key={i}
                          className={`px-4 py-3 text-center font-medium ${
                            qty > 0 ? 'bg-green-50 text-green-700' : 'text-gray-700'
                          }`}
                          data-tooltip-id="daily-sales-tooltip"
                          data-tooltip-content={getTooltipContent(qty, row.dailyBranchDetails[i], isRtl, 'sales')}
                        >
                          {qty !== 0 ? `${qty > 0 ? '+' : ''}${formatNumber(qty, isRtl)}` : '0'}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalSales, isRtl)}</td>
                      <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatPrice(row.totalValue, isRtl)}</td>
                    </tr>
                  ))}
                  <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <td className="px-4 py-3 text-gray-800 text-center" colSpan={4}>
                      {isRtl ? 'الإجمالي' : 'Total'}
                    </td>
                    {daysInMonth.map((_, i) => (
                      <td key={i} className="px-4 py-3 text-gray-800 text-center">
                        {formatNumber(data.reduce((sum, row) => sum + row.dailySales[i], 0), isRtl)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalSales, isRtl)}</td>
                    <td className="px-4 py-3 text-gray-800 text-center">{formatPrice(grandTotalValue, isRtl)}</td>
                  </tr>
                </tbody>
              </table>
              <Tooltip id="daily-sales-tooltip" place="top" effect="solid" className="custom-tooltip" />
            </motion.div>
          )}
        </div>
      );
    },
    [daysInMonth, isRtl, months, formatPrice, formatNumber, exportToPDF, getTooltipContent]
  );

  const renderOrdersVsReturnsTable = useCallback(
    (data: OrdersVsReturnsRow[], title: string, month: number) => {
      const grandTotalOrders = data.reduce((sum, row) => sum + row.totalOrders, 0);
      const grandTotalReturns = data.reduce((sum, row) => sum + row.totalReturns, 0);
      const grandTotalRatio = grandTotalOrders > 0 ? (grandTotalReturns / grandTotalOrders) * 100 : 0;
      const monthName = months[month].label;

      const exportTable = (format: 'excel' | 'pdf') => {
        const headers = [
          isRtl ? 'رقم' : 'No.',
          isRtl ? 'الكود' : 'Code',
          isRtl ? 'المنتج' : 'Product',
          isRtl ? 'وحدة المنتج' : 'Product Unit',
          ...daysInMonth.map((day, i) => `${day} ${isRtl ? 'طلبات/مرتجعات' : 'Orders/Returns'}`),
          isRtl ? 'إجمالي الطلبات' : 'Total Orders',
          isRtl ? 'إجمالي المرتجعات' : 'Total Returns',
          isRtl ? 'نسبة المرتجعات %' : 'Returns Ratio %',
        ];
        const rows = [
          ...data.map((row, index) => ({
            no: index + 1,
            code: row.code,
            product: row.product,
            unit: row.unit,
            ...Object.fromEntries(
              row.dailyOrders.map((orderQty, i) => [
                `${daysInMonth[i]} ${isRtl ? 'طلبات/مرتجعات' : 'Orders/Returns'}`,
                `${orderQty}/${row.dailyReturns[i]}`,
              ])
            ),
            totalOrders: row.totalOrders,
            totalReturns: row.totalReturns,
            totalRatio: formatNumber(row.totalRatio.toFixed(2), isRtl),
          })),
          {
            no: '',
            code: '',
            product: isRtl ? 'الإجمالي' : 'Total',
            unit: '',
            ...Object.fromEntries(
              daysInMonth.map((_, i) => [
                `${daysInMonth[i]} ${isRtl ? 'طلبات/مرتجعات' : 'Orders/Returns'}`,
                `${data.reduce((sum, row) => sum + row.dailyOrders[i], 0)}/${data.reduce(
                  (sum, row) => sum + row.dailyReturns[i],
                  0
                )}`,
              ])
            ),
            totalOrders: grandTotalOrders,
            totalReturns: grandTotalReturns,
            totalRatio: formatNumber(grandTotalRatio.toFixed(2), isRtl),
          },
        ];
        const dataRows = rows.map((row) => [
          row.no,
          row.code,
          row.product,
          row.unit,
          ...daysInMonth.map((day) => row[`${day} ${isRtl ? 'طلبات/مرتجعات' : 'Orders/Returns'}`]),
          row.totalOrders,
          row.totalReturns,
          `${row.totalRatio}%`,
        ]);

        if (format === 'excel') {
          const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map((row) => Object.fromEntries(Object.entries(row).reverse())) : rows, {
            header: headers,
          });
          if (isRtl) ws['!views'] = [{ RTL: true }];
          ws['!cols'] = [
            { wch: 10 },
            { wch: 15 },
            { wch: 20 },
            { wch: 15 },
            ...daysInMonth.map(() => ({ wch: 20 })),
            { wch: 15 },
            { wch: 15 },
            { wch: 15 },
          ];
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, `${title}_${monthName}`);
          XLSX.writeFile(wb, `${title}_${monthName}.xlsx`);
          toast.success(isRtl ? 'تم تصدير ملف Excel بنجاح' : 'Excel exported successfully', {
            position: isRtl ? 'top-left' : 'top-right',
            autoClose: 3000,
          });
        } else if (format === 'pdf') {
          exportToPDF(dataRows, title, monthName, headers, isRtl, data.length, grandTotalOrders, 0, []);
        }
      };

      return (
        <div className="mb-8">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h2 className="text-lg font-semibold text-gray-800">{isRtl ? `${title} - ${monthName}` : `${title} - ${monthName}`}</h2>
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
          {data.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              {isRtl ? 'لا توجد بيانات متاحة لهذا الشهر' : 'No data available for this month'}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-x-auto rounded-xl shadow-md border border-gray-200 bg-white"
            >
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-blue-50 sticky top-0">
                  <tr className={isRtl ? 'flex-row-reverse' : ''}>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[40px]">{isRtl ? 'رقم' : 'No.'}</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'الكود' : 'Code'}</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[120px]">{isRtl ? 'المنتج' : 'Product'}</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'وحدة المنتج' : 'Product Unit'}</th>
                    {daysInMonth.map((day, i) => (
                      <th key={i} className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                        {`${day} ${isRtl ? 'طلبات/مرتجعات' : 'Orders/Returns'}`}
                      </th>
                    ))}
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                      {isRtl ? 'إجمالي الطلبات' : 'Total Orders'}
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                      {isRtl ? 'إجمالي المرتجعات' : 'Total Returns'}
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                      {isRtl ? 'نسبة المرتجعات %' : 'Returns Ratio %'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.map((row, index) => (
                    <tr key={row.id} className={`hover:bg-blue-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <td className="px-4 py-3 text-gray-700 text-center">{formatNumber(index + 1, isRtl)}</td>
                      <td className="px-4 py-3 text-gray-700 text-center truncate">{row.code}</td>
                      <td className="px-4 py-3 text-gray-700 text-center truncate">{row.product}</td>
                      <td className="px-4 py-3 text-gray-700 text-center truncate">{row.unit}</td>
                      {row.dailyOrders.map((orderQty, i) => (
                        <td
                          key={i}
                          className="px-4 py-3 text-gray-700 text-center font-medium"
                          data-tooltip-id="orders-returns-tooltip"
                          data-tooltip-content={`${isRtl ? 'طلبات' : 'Orders'}: ${formatNumber(orderQty, isRtl)}\n${isRtl ? 'مرتجعات' : 'Returns'}: ${formatNumber(row.dailyReturns[i], isRtl)}`}
                        >
                          {`${formatNumber(orderQty, isRtl)}/${formatNumber(row.dailyReturns[i], isRtl)}`}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalOrders, isRtl)}</td>
                      <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalReturns, isRtl)}</td>
                      <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalRatio.toFixed(2), isRtl)}%</td>
                    </tr>
                  ))}
                  <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <td className="px-4 py-3 text-gray-800 text-center" colSpan={4}>
                      {isRtl ? 'الإجمالي' : 'Total'}
                    </td>
                    {daysInMonth.map((_, i) => (
                      <td key={i} className="px-4 py-3 text-gray-800 text-center">
                        {`${formatNumber(data.reduce((sum, row) => sum + row.dailyOrders[i], 0), isRtl)}/${formatNumber(
                          data.reduce((sum, row) => sum + row.dailyReturns[i], 0),
                          isRtl
                        )}`}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalOrders, isRtl)}</td>
                    <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalReturns, isRtl)}</td>
                    <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalRatio.toFixed(2), isRtl)}%</td>
                  </tr>
                </tbody>
              </table>
              <Tooltip id="orders-returns-tooltip" place="top" effect="solid" className="custom-tooltip" />
            </motion.div>
          )}
        </div>
      );
    },
    [daysInMonth, isRtl, months, formatNumber, exportToPDF, getTooltipContent]
  );

  const tabs = [
    { id: 'orders', label: isRtl ? 'الطلبات' : 'Orders', component: OrdersTable },
    { id: 'dailyOrders', label: isRtl ? 'الطلبات اليومية' : 'Daily Orders', component: DailyOrdersTable },
    { id: 'stockIn', label: isRtl ? 'زيادة المخزون' : 'Stock In', component: renderStockTable },
    { id: 'stockOut', label: isRtl ? 'نقص المخزون' : 'Stock Out', component: renderStockTable },
    { id: 'returns', label: isRtl ? 'المرتجعات' : 'Returns', component: renderReturnsTable },
    { id: 'sales', label: isRtl ? 'المبيعات' : 'Sales', component: renderSalesTable },
    { id: 'ordersVsReturns', label: isRtl ? 'الطلبات مقابل المرتجعات' : 'Orders vs Returns', component: renderOrdersVsReturnsTable },
  ];

  return (
    <div className={`container mx-auto px-4 py-6 ${isRtl ? 'font-arabic' : 'font-sans'}`}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Amiri&display=swap');
          .font-arabic {
            font-family: 'Amiri', serif;
          }
          .custom-tooltip {
            max-width: 200px;
            white-space: pre-wrap;
          }
        `}
      </style>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{isRtl ? 'تقرير الإنتاج' : 'Production Report'}</h1>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <ProductDropdown
          value={selectedMonth.toString()}
          onChange={(value) => setSelectedMonth(Number(value))}
          options={months}
          ariaLabel={isRtl ? 'اختر الشهر' : 'Select Month'}
        />
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'primary' : 'secondary'}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full text-xs font-medium transition-all duration-200 ${
              activeTab === tab.id ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {tab.label}
          </Button>
        ))}
      </div>
      <AnimatePresence>
        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <OrderTableSkeleton isRtl={isRtl} />
          </motion.div>
        ) : (
          <>
            {activeTab === 'orders' && (
              <OrdersTable
                data={orderData[selectedMonth] || []}
                title={isRtl ? 'الطلبات' : 'Orders'}
                month={selectedMonth}
                allBranches={allBranches}
                isRtl={isRtl}
                months={months}
                formatPrice={formatPrice}
                formatNumber={formatNumber}
                exportToPDF={exportToPDF}
              />
            )}
            {activeTab === 'dailyOrders' && (
              <DailyOrdersTable
                data={dailyOrderData[selectedMonth] || []}
                title={isRtl ? 'الطلبات اليومية' : 'Daily Orders'}
                month={selectedMonth}
                daysInMonth={daysInMonth}
                allBranches={allBranches}
                isRtl={isRtl}
                months={months}
                formatPrice={formatPrice}
                formatNumber={formatNumber}
                exportToPDF={exportToPDF}
              />
            )}
            {activeTab === 'stockIn' && renderStockTable(stockInData[selectedMonth] || [], isRtl ? 'زيادة المخزون' : 'Stock In', selectedMonth, 'in')}
            {activeTab === 'stockOut' && renderStockTable(stockOutData[selectedMonth] || [], isRtl ? 'نقص المخزون' : 'Stock Out', selectedMonth, 'out')}
            {activeTab === 'returns' && renderReturnsTable(returnData[selectedMonth] || [], isRtl ? 'المرتجعات' : 'Returns', selectedMonth)}
            {activeTab === 'sales' && renderSalesTable(salesData[selectedMonth] || [], isRtl ? 'المبيعات' : 'Sales', selectedMonth)}
            {activeTab === 'ordersVsReturns' &&
              renderOrdersVsReturnsTable(
                ordersVsReturnsData[selectedMonth] || [],
                isRtl ? 'الطلبات مقابل المرتجعات' : 'Orders vs Returns',
                selectedMonth
              )}
          </>
        )}
      </AnimatePresence>
      <div className="text-center text-sm text-gray-500 mt-6">
        {isRtl ? 'جميع الحقوق محفوظة لمصنع الجودياء للخبز والحلويات' : 'All rights reserved to Al-Joudia Bakery & Sweets'}
      </div>
    </div>
  );
};

export default ProductionReport;