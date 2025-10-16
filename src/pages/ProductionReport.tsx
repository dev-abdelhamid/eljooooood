// File 1: ProductionReport.tsx
import React, { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { inventoryAPI, ordersAPI, branchesAPI, salesAPI } from '../services/api';
import { toast } from 'react-toastify';
import DailyOrdersTable from './DailyOrdersTable';
import DailyStockTable from './DailyStockTable';
import DailyReturnsTable from './DailyReturnsTable';
import DailySalesTable from './DailySalesTable';
import OrdersVsSalesTable from './OrdersVsSalesTable';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';
import { Button } from '../components/UI/Button';

interface OrderRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  totalQuantity: number;
  dailyQuantities: number[];
  dailyBranchDetails: { [branch: string]: number }[];
  totalPrice: number;
  sales: number;
  actualSales: number;
}

interface StockRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  totalQuantity: number;
  dailyQuantities: number[];
  dailyBranchDetails: { [branch: string]: number }[];
  totalPrice: number;
  dailySales?: number[];
  dailyReturns?: number[];
  dailySalesDetails?: { [branch: string]: number }[];
  dailyReturnsDetails?: { [branch: string]: number }[];
}

interface ReturnRow {
  id: string;
  product: string;
  code: string;
  unit: string;
  totalReturns: number;
  dailyReturns: number[];
  dailyBranchDetails: { [branch: string]: number }[];
  totalValue: number;
  totalOrders?: number;
}

interface SalesRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  totalSales: number;
  dailySales: number[];
  dailyBranchDetails: { [branch: string]: number }[];
  totalValue: number;
}

interface OrdersVsSalesRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  dailyOrders: number[];
  dailySales: number[];
  dailyBranchDetailsOrders: { [branch: string]: number }[];
  dailyBranchDetailsSales: { [branch: string]: number }[];
  totalOrders: number;
  totalSales: number;
  totalRatio: number;
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
  if (!user || (user.role !== 'admin' && user.role !== 'production')) {
    return <div className="text-center py-12">{isRtl ? 'لا يوجد صلاحية' : 'No access'}</div>;
  }
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<{ [month: number]: OrderRow[] }>({});
  const [stockInData, setStockInData] = useState<{ [month: number]: StockRow[] }>({});
  const [stockOutData, setStockOutData] = useState<{ [month: number]: StockRow[] }>({});
  const [returnData, setReturnData] = useState<{ [month: number]: ReturnRow[] }>({});
  const [salesData, setSalesData] = useState<{ [month: number]: SalesRow[] }>({});
  const [ordersVsSalesData, setOrdersVsSalesData] = useState<{ [month: number]: OrdersVsSalesRow[] }>({});
  const [branches, setBranches] = useState<Branch[]>([]);
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [activeTab, setActiveTab] = useState<'orders' | 'stockIn' | 'stockOut' | 'returns' | 'sales' | 'ordersVsSales'>('orders');
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: new Date(currentYear, i).toLocaleString(language, { month: 'long' }),
  }));
  const getDaysInMonth = useCallback((month: number) => {
    const daysInMonthCount = new Date(currentYear, month + 1, 0).getDate();
    return Array.from({ length: daysInMonthCount }, (_, i) => {
      const date = new Date(currentYear, month, i + 1);
      return date.toLocaleString(language, { day: 'numeric', month: 'short' });
    });
  }, [currentYear, language]);
  const daysInMonth = useMemo(() => getDaysInMonth(selectedMonth), [selectedMonth, getDaysInMonth]);
  const allBranches = useMemo(() => branches.map(b => b.displayName).sort(), [branches]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [inventory, ordersResponse, branchesResponse, salesResponse] = await Promise.all([
          inventoryAPI.getInventory({}, isRtl),
          ordersAPI.getAll({ status: 'completed', page: 1, limit: 10000 }, isRtl),
          branchesAPI.getAll(),
          salesAPI.getAnalytics({
            startDate: new Date(currentYear, selectedMonth, 1).toISOString(),
            endDate: new Date(currentYear, selectedMonth + 1, 0).toISOString(),
            lang: language,
          }),
        ]);
        const monthlyOrderData: { [month: number]: OrderRow[] } = {};
        const monthlyStockInData: { [month: number]: StockRow[] } = {};
        const monthlyStockOutData: { [month: number]: StockRow[] } = {};
        const monthlyReturnData: { [month: number]: ReturnRow[] } = {};
        const monthlySalesData: { [month: number]: SalesRow[] } = {};
        const monthlyOrdersVsSalesData: { [month: number]: OrdersVsSalesRow[] } = {};
        const fetchedBranches = branchesResponse
          .filter((branch: any) => branch && branch._id)
          .map((branch: any) => ({
            _id: branch._id,
            name: branch.name || (isRtl ? 'غير معروف' : 'Unknown'),
            nameEn: branch.nameEn || branch.name,
            displayName: isRtl ? branch.name : branch.nameEn || branch.name,
          }))
          .sort((a: Branch, b: Branch) => a.displayName.localeCompare(b.displayName, language));
        setBranches(fetchedBranches);
        const branchMap = new Map<string, string>(fetchedBranches.map(b => [b._id, b.displayName]));
        const productDetails = new Map<string, { code: string; product: string; unit: string; price: number }>();
        inventory.forEach((item: any) => {
          if (item?.product?._id) {
            productDetails.set(item.product._id, {
              code: item.product.code || `code-${Math.random().toString(36).substring(2)}`,
              product: isRtl ? (item.product.name || 'منتج غير معروف') : (item.product.nameEn || item.product.name || 'Unknown Product'),
              unit: isRtl ? (item.product.unit || 'غير محدد') : (item.product.unitEn || item.product.unit || 'N/A'),
              price: Number(item.product.price) || 0,
            });
          }
        });
        let orders = Array.isArray(ordersResponse) ? ordersResponse : [];
        if (orders.length === 0) {
          toast.warn(isRtl ? 'لا توجد طلبات، استخدام بيانات احتياطية' : 'No orders found, using fallback data');
          orders = inventory
            .filter((item: any) => item?.product?._id)
            .flatMap((item: any) => {
              return (item.movements || []).map((movement: any) => ({
                status: 'completed',
                createdAt: movement.createdAt || new Date().toISOString(),
                branch: {
                  _id: fetchedBranches[Math.floor(Math.random() * fetchedBranches.length)]?._id,
                },
                items: [
                  {
                    product: {
                      _id: item.product._id,
                      name: item.product.name,
                      nameEn: item.product.nameEn,
                      code: item.product.code,
                      unit: item.product.unit,
                      unitEn: item.product.unitEn,
                      price: item.product.price,
                    },
                    quantity: Math.abs(Number(movement.quantity) || 0),
                    price: Number(item.product?.price) || 0,
                    productId: item.product._id,
                    unit: isRtl ? (item.product?.unit || 'غير محدد') : (item.product?.unitEn || item.product?.unit || 'N/A'),
                    sales: Number(item.product?.sales) || (Math.abs(Number(movement.quantity)) * Number(item.product?.price) * 0.1) || 0,
                  },
                ],
              }));
            });
        }
        for (let month = 0; month < 12; month++) {
          const daysInMonthCount = new Date(currentYear, month + 1, 0).getDate();
          const orderMap = new Map<string, OrderRow>();
          const stockInMap = new Map<string, StockRow>();
          const stockOutMap = new Map<string, StockRow>();
          const returnMap = new Map<string, ReturnRow>();
          const salesMap = new Map<string, SalesRow>();
          orders.forEach((order: any) => {
            const status = order.status || order.orderStatus;
            if (status !== 'completed') return;
            const date = new Date(order.createdAt || order.date);
            if (isNaN(date.getTime())) return;
            const orderMonth = date.getMonth();
            const year = date.getFullYear();
            if (year === currentYear && orderMonth === month) {
              const day = date.getDate() - 1;
              const branchId = order.branch?._id || order.branch || order.branchId;
              const branch = branchMap.get(branchId) || (isRtl ? 'الفرع الرئيسي' : 'Main Branch');
              (order.items || []).forEach((item: any) => {
                const productId = item.product?._id || item.productId;
                if (!productId) return;
                const details = productDetails.get(productId) || {
                  code: item.product?.code || `code-${Math.random().toString(36).substring(2)}`,
                  product: isRtl ? (item.product?.name || 'منتج غير معروف') : (item.product?.nameEn || item.product?.name || 'Unknown Product'),
                  unit: isRtl ? (item.product?.unit || 'غير محدد') : (item.product?.unitEn || item.product?.unit || 'N/A'),
                  price: Number(item.price) || 0,
                };
                const key = `${productId}-${month}`;
                if (!orderMap.has(key)) {
                  orderMap.set(key, {
                    id: key,
                    code: details.code,
                    product: details.product,
                    unit: details.unit,
                    totalQuantity: 0,
                    dailyQuantities: Array(daysInMonthCount).fill(0),
                    dailyBranchDetails: Array.from({ length: daysInMonthCount }, () => ({})),
                    totalPrice: 0,
                    sales: 0,
                    actualSales: 0,
                  });
                }
                const row = orderMap.get(key)!;
                const quantity = Number(item.quantity) || 0;
                row.dailyQuantities[day] += quantity;
                row.dailyBranchDetails[day][branch] = (row.dailyBranchDetails[day][branch] || 0) + quantity;
                row.totalQuantity += quantity;
                row.totalPrice += quantity * details.price;
                row.sales = row.totalPrice * 0.1;
              });
            }
          });
          if (month === selectedMonth) {
            for (const row of orderMap.values()) {
              const salesItem = salesResponse.productSales?.find((s: any) => s.productId === row.id.split('-')[0]);
              if (salesItem) {
                row.actualSales = Number(salesItem.totalQuantity) || 0;
              }
            }
          }
          inventory.forEach((item: any) => {
            const productId = item?.product?._id;
            if (!productId) return;
            const details = productDetails.get(productId) || {
              code: item.product?.code || `code-${Math.random().toString(36).substring(2)}`,
              product: isRtl ? (item.product?.name || 'منتج غير معروف') : (item.product?.nameEn || item.product?.name || 'Unknown Product'),
              unit: isRtl ? (item.product?.unit || 'غير محدد') : (item.product?.unitEn || item.product?.unit || 'N/A'),
              price: Number(item.product?.price) || 0,
            };
            const branchId = item.branch?._id || item.branch;
            const branchName = branchMap.get(branchId) || (isRtl ? 'غير معروف' : 'Unknown');
            (item.movements || []).forEach((movement: any) => {
              const date = new Date(movement.createdAt);
              if (isNaN(date.getTime())) return;
              const prodMonth = date.getMonth();
              const year = date.getFullYear();
              if (year === currentYear && prodMonth === month) {
                const day = date.getDate() - 1;
                const key = `${productId}-${month}`;
                const quantity = Number(movement.quantity) || 0;
                const isReturn = movement.reference?.includes('مرتجع') || movement.reference?.includes('RET-');
                const isSale = movement.reference?.includes('بيع') || movement.reference?.includes('SALE-');
                if (movement.type === 'in') {
                  if (!stockInMap.has(key)) {
                    stockInMap.set(key, {
                      id: key,
                      code: details.code,
                      product: details.product,
                      unit: details.unit,
                      totalQuantity: 0,
                      dailyQuantities: Array(daysInMonthCount).fill(0),
                      dailyBranchDetails: Array.from({ length: daysInMonthCount }, () => ({})),
                      totalPrice: 0,
                      dailyReturns: Array(daysInMonthCount).fill(0),
                      dailyReturnsDetails: Array.from({ length: daysInMonthCount }, () => ({})),
                    });
                  }
                  const row = stockInMap.get(key)!;
                  row.dailyQuantities[day] += quantity;
                  row.dailyBranchDetails[day][branchName] = (row.dailyBranchDetails[day][branchName] || 0) + quantity;
                  row.totalQuantity += quantity;
                  row.totalPrice += quantity * details.price;
                  if (isReturn) {
                    row.dailyReturns![day] += quantity;
                    row.dailyReturnsDetails![day][branchName] = (row.dailyReturnsDetails![day][branchName] || 0) + quantity;
                    if (!returnMap.has(key)) {
                      returnMap.set(key, {
                        id: key,
                        product: details.product,
                        code: details.code,
                        unit: details.unit,
                        totalReturns: 0,
                        dailyReturns: Array(daysInMonthCount).fill(0),
                        dailyBranchDetails: Array.from({ length: daysInMonthCount }, () => ({})),
                        totalValue: 0,
                        totalOrders: 0,
                      });
                    }
                    const returnRow = returnMap.get(key)!;
                    returnRow.dailyReturns[day] += quantity;
                    returnRow.dailyBranchDetails[day][branchName] = (returnRow.dailyBranchDetails[day][branchName] || 0) + quantity;
                    returnRow.totalReturns += quantity;
                    returnRow.totalValue += quantity * details.price;
                    returnRow.totalOrders = orderMap.get(key)?.totalQuantity || 0;
                  }
                } else if (movement.type === 'out') {
                  if (!stockOutMap.has(key)) {
                    stockOutMap.set(key, {
                      id: key,
                      code: details.code,
                      product: details.product,
                      unit: details.unit,
                      totalQuantity: 0,
                      dailyQuantities: Array(daysInMonthCount).fill(0),
                      dailyBranchDetails: Array.from({ length: daysInMonthCount }, () => ({})),
                      totalPrice: 0,
                      dailySales: Array(daysInMonthCount).fill(0),
                      dailySalesDetails: Array.from({ length: daysInMonthCount }, () => ({})),
                    });
                  }
                  const row = stockOutMap.get(key)!;
                  const qty = -quantity;
                  row.dailyQuantities[day] += qty;
                  row.dailyBranchDetails[day][branchName] = (row.dailyBranchDetails[day][branchName] || 0) + qty;
                  row.totalQuantity += qty;
                  row.totalPrice += -qty * details.price; // positive value
                  if (isSale) {
                    row.dailySales![day] += -qty; // positive
                    row.dailySalesDetails![day][branchName] = (row.dailySalesDetails![day][branchName] || 0) + -qty;
                    if (!salesMap.has(key)) {
                      salesMap.set(key, {
                        id: key,
                        code: details.code,
                        product: details.product,
                        unit: details.unit,
                        totalSales: 0,
                        dailySales: Array(daysInMonthCount).fill(0),
                        dailyBranchDetails: Array.from({ length: daysInMonthCount }, () => ({})),
                        totalValue: 0,
                      });
                    }
                    const salesRow = salesMap.get(key)!;
                    salesRow.dailySales[day] += -qty;
                    salesRow.dailyBranchDetails[day][branchName] = (salesRow.dailyBranchDetails[day][branchName] || 0) + -qty;
                    salesRow.totalSales += -qty;
                    salesRow.totalValue += -qty * details.price;
                  }
                }
              }
            });
          });
          const productKeys = new Set<string>();
          orderMap.forEach((_, key) => productKeys.add(key));
          salesMap.forEach((_, key) => productKeys.add(key));
          const ordersVsSalesMap = new Map<string, OrdersVsSalesRow>();
          productKeys.forEach((key) => {
            const ordersRow = orderMap.get(key) || {
              dailyQuantities: Array(daysInMonthCount).fill(0),
              dailyBranchDetails: Array.from({ length: daysInMonthCount }, () => ({})),
              totalQuantity: 0,
              code: '',
              product: '',
              unit: '',
            };
            const salesRow = salesMap.get(key) || {
              dailySales: Array(daysInMonthCount).fill(0),
              dailyBranchDetails: Array.from({ length: daysInMonthCount }, () => ({})),
              totalSales: 0,
            };
            const totalRatio = ordersRow.totalQuantity > 0 ? (salesRow.totalSales / ordersRow.totalQuantity) * 100 : 0;
            ordersVsSalesMap.set(key, {
              id: key,
              code: ordersRow.code,
              product: ordersRow.product,
              unit: ordersRow.unit,
              dailyOrders: ordersRow.dailyQuantities,
              dailySales: salesRow.dailySales,
              dailyBranchDetailsOrders: ordersRow.dailyBranchDetails,
              dailyBranchDetailsSales: salesRow.dailyBranchDetails,
              totalOrders: ordersRow.totalQuantity,
              totalSales: salesRow.totalSales,
              totalRatio,
            });
          });
          monthlyOrderData[month] = Array.from(orderMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
          monthlyStockInData[month] = Array.from(stockInMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
          monthlyStockOutData[month] = Array.from(stockOutMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
          monthlyReturnData[month] = Array.from(returnMap.values()).sort((a, b) => b.totalReturns - a.totalReturns);
          monthlySalesData[month] = Array.from(salesMap.values()).sort((a, b) => b.totalSales - a.totalSales);
          monthlyOrdersVsSalesData[month] = Array.from(ordersVsSalesMap.values()).sort((a, b) => b.totalRatio - a.totalRatio);
        }
        setOrderData(monthlyOrderData);
        setStockInData(monthlyStockInData);
        setStockOutData(monthlyStockOutData);
        setReturnData(monthlyReturnData);
        setSalesData(monthlySalesData);
        setOrdersVsSalesData(monthlyOrdersVsSalesData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast.error(isRtl ? 'فشل في جلب البيانات' : 'Failed to fetch data', {
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isRtl, currentYear, selectedMonth, language]);

  return (
    <div className={`min-h-screen px-6 py-8 ${isRtl ? 'rtl font-amiri' : 'ltr font-inter'} bg-gray-100`}>
      <div className="mb-8 bg-white shadow-md rounded-xl p-4">
        <div className="flex flex-wrap gap-2 mb-4 justify-center">
          {months.map(month => (
            <Button
              key={month.value}
              variant={selectedMonth === month.value ? 'primary' : 'secondary'}
              onClick={() => setSelectedMonth(month.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                selectedMonth === month.value ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {month.label}
            </Button>
          ))}
        </div>
        <div className={`flex flex-wrap gap-2 justify-center ${isRtl ? 'flex-row-reverse' : ''}`}>
          <Button
            variant={activeTab === 'orders' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              activeTab === 'orders' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isRtl ? 'حركة الطلبات اليومية' : 'Daily Orders'}
          </Button>
          <Button
            variant={activeTab === 'stockIn' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('stockIn')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              activeTab === 'stockIn' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isRtl ? 'إدخال المخزون' : 'Stock In'}
          </Button>
          <Button
            variant={activeTab === 'stockOut' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('stockOut')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              activeTab === 'stockOut' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isRtl ? 'إخراج المخزون' : 'Stock Out'}
          </Button>
          <Button
            variant={activeTab === 'returns' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('returns')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              activeTab === 'returns' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isRtl ? 'المرتجعات' : 'Returns'}
          </Button>
          <Button
            variant={activeTab === 'sales' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('sales')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              activeTab === 'sales' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isRtl ? 'المبيعات' : 'Sales'}
          </Button>
          <Button
            variant={activeTab === 'ordersVsSales' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('ordersVsSales')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              activeTab === 'ordersVsSales' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isRtl ? 'حركة الطلبات مقابل المبيعات' : 'Orders vs Sales'}
          </Button>
        </div>
      </div>
      <AnimatePresence>
        {activeTab === 'orders' && (
          <DailyOrdersTable
            data={orderData[selectedMonth] || []}
            title={isRtl ? 'تقرير حركة الطلبات اليومية' : 'Daily Orders Report'}
            month={selectedMonth}
            isRtl={isRtl}
            loading={loading}
            allBranches={allBranches}
            daysInMonth={daysInMonth}
            monthName={months[selectedMonth].label}
          />
        )}
        {activeTab === 'stockIn' && (
          <DailyStockTable
            data={stockInData[selectedMonth] || []}
            title={isRtl ? 'تقرير إدخال المخزون' : 'Stock In Report'}
            month={selectedMonth}
            isRtl={isRtl}
            loading={loading}
            allBranches={allBranches}
            daysInMonth={daysInMonth}
            monthName={months[selectedMonth].label}
            type="in"
          />
        )}
        {activeTab === 'stockOut' && (
          <DailyStockTable
            data={stockOutData[selectedMonth] || []}
            title={isRtl ? 'تقرير إخراج المخزون' : 'Stock Out Report'}
            month={selectedMonth}
            isRtl={isRtl}
            loading={loading}
            allBranches={allBranches}
            daysInMonth={daysInMonth}
            monthName={months[selectedMonth].label}
            type="out"
          />
        )}
        {activeTab === 'returns' && (
          <DailyReturnsTable
            data={returnData[selectedMonth] || []}
            title={isRtl ? 'تقرير المرتجعات' : 'Returns Report'}
            month={selectedMonth}
            isRtl={isRtl}
            loading={loading}
            allBranches={allBranches}
            daysInMonth={daysInMonth}
            monthName={months[selectedMonth].label}
          />
        )}
        {activeTab === 'sales' && (
          <DailySalesTable
            data={salesData[selectedMonth] || []}
            title={isRtl ? 'تقرير المبيعات' : 'Sales Report'}
            month={selectedMonth}
            isRtl={isRtl}
            loading={loading}
            allBranches={allBranches}
            daysInMonth={daysInMonth}
            monthName={months[selectedMonth].label}
          />
        )}
        {activeTab === 'ordersVsSales' && (
          <OrdersVsSalesTable
            data={ordersVsSalesData[selectedMonth] || []}
            title={isRtl ? 'تقرير حركة الطلبات مقابل المبيعات' : 'Orders vs Sales Report'}
            month={selectedMonth}
            isRtl={isRtl}
            loading={loading}
            allBranches={allBranches}
            daysInMonth={daysInMonth}
            monthName={months[selectedMonth].label}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductionReport;