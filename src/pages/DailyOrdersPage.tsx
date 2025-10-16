// New file: pages/DailyOrdersPage.tsx (separate page for orders)
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import { inventoryAPI, ordersAPI, branchesAPI, salesAPI } from '../services/api';
import DailyOrdersTable from './DailyOrdersTable'; // Updated version

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

interface Branch {
  _id: string;
  name: string;
  nameEn: string;
  displayName: string;
}

const DailyOrdersPage: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  if (!user || (user.role !== 'admin' && user.role !== 'production')) {
    return <div className="text-center py-12">{isRtl ? 'لا يوجد صلاحية' : 'No access'}</div>;
  }
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<{ [month: number]: OrderRow[] }>({});
  const [branches, setBranches] = useState<Branch[]>([]);
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
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
          ordersAPI.getAll({ page: 1, limit: 10000 }, isRtl),
          branchesAPI.getAll(),
          salesAPI.getAnalytics({
            startDate: new Date(currentYear, selectedMonth, 1).toISOString(),
            endDate: new Date(currentYear, selectedMonth + 1, 0).toISOString(),
            lang: language,
          }),
        ]);
        const monthlyOrderData: { [month: number]: OrderRow[] } = {};
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
          orders.forEach((order: any) => {
            const status = order.status || order.orderStatus;
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
          monthlyOrderData[month] = Array.from(orderMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
        }
        setOrderData(monthlyOrderData);
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
            <button
              key={month.value}
              onClick={() => setSelectedMonth(month.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                selectedMonth === month.value ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {month.label}
            </button>
          ))}
        </div>
      </div>
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
    </div>
  );
};

export default DailyOrdersPage;