import React, { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/UI/Button';
import { Upload, Search, X, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';
import { inventoryAPI, ordersAPI, branchesAPI, productsAPI } from '../services/api';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';
import { Tooltip } from 'react-tooltip';
import { ProductSearchInput, ProductDropdown } from './NewOrder';
import OrdersTable from './OrdersTable';
import OrdersVsReturnsTable from './OrdersVsReturnsTable';

// واجهات البيانات
interface OrderRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  branchQuantities: { [branch: string]: number };
  totalQuantity: number;
  totalPrice: number;
  sales: number;
  actualSales: number;
}

interface OrdersVsReturnsRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  dailyOrders: number[];
  dailyReturns: number[];
  totalOrders: number;
  totalReturns: number;
  totalRatio: number;
}

interface Branch {
  _id: string;
  name: string;
  nameEn: string;
  displayName: string;
}

interface Product {
  _id: string;
  code: string;
  name: string;
  nameEn: string;
  unit: string;
  unitEn: string;
  price: number;
}

// دوال مساعدة
export const toArabicNumerals = (number: string | number): string => {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(number).replace(/[0-9]/g, (digit) => arabicNumerals[parseInt(digit)]);
};


export const formatPrice = (amount: number, isRtl: boolean, isStats: boolean = false): string => {
  const validAmount = Number.isNaN(amount) ? 0 : amount;
  let formatted = validAmount.toLocaleString(isRtl ? 'ar-SA' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (isRtl) formatted = toArabicNumerals(formatted);
  return isStats ? `${formatted} ${isRtl ? 'ر.س' : 'SAR'}` : formatted;
};

export const formatNumber = (num: number, isRtl: boolean): string => {
  const validNum = Number.isNaN(num) ? 0 : num;
  return isRtl ? toArabicNumerals(validNum.toString()) : validNum.toString();
};

export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

export const loadFont = async (doc: jsPDF): Promise<boolean> => {
  const fontName = 'Amiri';
  const fontUrls = {
    regular: 'https://raw.githubusercontent.com/aliftype/amiri/master/fonts/Amiri-Regular.ttf',
    bold: 'https://raw.githubusercontent.com/aliftype/amiri/master/fonts/Amiri-Bold.ttf',
  };
  try {
    const regularFontBytes = await fetch(fontUrls.regular).then((res) => res.arrayBuffer());
    doc.addFileToVFS(`${fontName}-normal.ttf`, arrayBufferToBase64(regularFontBytes));
    doc.addFont(`${fontName}-normal.ttf`, fontName, 'normal');
    const boldFontBytes = await fetch(fontUrls.bold).then((res) => res.arrayBuffer());
    doc.addFileToVFS(`${fontName}-bold.ttf`, arrayBufferToBase64(boldFontBytes));
    doc.addFont(`${fontName}-bold.ttf`, fontName, 'bold');
    doc.setFont(fontName, 'normal');
    return true;
  } catch (error) {
    console.error('Font loading error:', error);
    doc.setFont('helvetica', 'normal');
    toast.error('فشل في تحميل خط Amiri، يتم استخدام الخط الافتراضي', {
      position: 'top-right',
      autoClose: 3000,
    });
    return false;
  }
};

export const generateFileName = (title: string, monthName: string, isRtl: boolean): string => {
  const date = new Date().toISOString().split('T')[0];
  return `${title}_${monthName}_${date}.pdf`;
};

export const generatePDFHeader = (
  doc: jsPDF,
  isRtl: boolean,
  title: string,
  monthName: string,
  totalItems: number,
  totalQuantity: number,
  totalPrice: number,
  fontName: string,
  fontLoaded: boolean
) => {
  doc.setFont(fontLoaded ? fontName : 'helvetica', 'normal');
  doc.setFontSize(18);
  doc.setTextColor(33, 33, 33);
  const pageWidth = doc.internal.pageSize.width;
  doc.text(isRtl ? title : title, isRtl ? pageWidth - 20 : 20, 12, { align: isRtl ? 'right' : 'left' });
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  const stats = isRtl
    ? `إجمالي المنتجات: ${toArabicNumerals(totalItems)} | إجمالي الكمية: ${toArabicNumerals(totalQuantity)} وحدة | إجمالي المبلغ: ${formatPrice(totalPrice, isRtl, true)}`
    : `Total Products: ${totalItems} | Total Quantity: ${totalQuantity} units | Total Amount: ${formatPrice(totalPrice, isRtl, true)}`;
  doc.text(stats, isRtl ? pageWidth - 20 : 20, 20, { align: isRtl ? 'right' : 'left' });
  doc.setLineWidth(0.5);
  doc.setDrawColor(255, 193, 7);
  doc.line(20, 25, pageWidth - 20, 25);
  const pageCount = doc.getNumberOfPages();
  const currentDate = new Date().toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont(fontLoaded ? fontName : 'helvetica', 'normal');
    const footerText = isRtl
      ? `تم إنشاؤه بواسطة نظام إدارة الجودياء - ${toArabicNumerals(currentDate)}`
      : `Generated by elgoodia Management System - ${currentDate}`;
    doc.text(footerText, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
  }
};




export const ProductionReport: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<{ [month: number]: OrderRow[] }>({});
  const [ordersVsReturnsData, setOrdersVsReturnsData] = useState<{ [month: number]: OrdersVsReturnsRow[] }>({});
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [activeTab, setActiveTab] = useState<'orders' | 'ordersVsReturns'>('orders');
  const [searchProduct, setSearchProduct] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedWeek, setSelectedWeek] = useState('all');
  const currentYear = new Date().getFullYear();

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        value: i,
        label: new Date(currentYear, i).toLocaleString(language, { month: 'long' }),
      })),
    [language, currentYear]
  );

  const weeks = useMemo(() => {
    const daysInMonth = new Date(currentYear, selectedMonth + 1, 0).getDate();
    const weeksInMonth = Math.ceil(daysInMonth / 7);
    return Array.from({ length: weeksInMonth }, (_, i) => ({
      value: String(i + 1),
      label: isRtl ? `الأسبوع ${toArabicNumerals(i + 1)}` : `Week ${i + 1}`,
    }));
  }, [isRtl, selectedMonth, currentYear]);

  const getWeekDateRange = useCallback((week: string) => {
    if (week === 'all') {
      return {
        start: new Date(currentYear, selectedMonth, 1).toISOString().split('T')[0],
        end: new Date(currentYear, selectedMonth + 1, 0).toISOString().split('T')[0],
      };
    }
    const weekNumber = parseInt(week) - 1;
    const startDay = weekNumber * 7 + 1;
    const endDay = Math.min(startDay + 6, new Date(currentYear, selectedMonth + 1, 0).getDate());
    return {
      start: new Date(currentYear, selectedMonth, startDay).toISOString().split('T')[0],
      end: new Date(currentYear, selectedMonth, endDay).toISOString().split('T')[0],
    };
  }, [currentYear, selectedMonth]);

  const allBranches = useMemo(() => branches.map(b => b.displayName).sort(), [branches]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const weekRange = getWeekDateRange(selectedWeek);
        const [productsRes, ordersRes, branchesRes] = await Promise.all([
          productsAPI.getAll({}),
          ordersAPI.getAll({
            status: 'completed',
            startDate: startDate || weekRange.start,
            endDate: endDate || weekRange.end,
            product: searchProduct || undefined,
            branch: selectedBranch === 'all' ? undefined : selectedBranch,
            page: 1,
            limit: 1000,
          }, isRtl),
          branchesAPI.getAll(),
        ]);

        const fetchedBranches = branchesRes
          .filter((branch: any) => branch && branch._id)
          .map((branch: any) => ({
            _id: branch._id,
            name: branch.name || (isRtl ? 'غير معروف' : 'Unknown'),
            nameEn: branch.nameEn || branch.name,
            displayName: isRtl ? branch.name : branch.nameEn || branch.name,
          }))
          .sort((a: Branch, b: Branch) => a.displayName.localeCompare(b.displayName, language));
        setBranches(fetchedBranches);

        const fetchedProducts = productsRes
          .filter((product: any) => product && product._id)
          .map((product: any) => ({
            _id: product._id,
            code: product.code || `code-${Math.random().toString(36).substring(2)}`,
            name: product.name || (isRtl ? 'منتج غير معروف' : 'Unknown Product'),
            nameEn: product.nameEn || product.name || 'Unknown Product',
            unit: product.unit || (isRtl ? 'غير محدد' : 'N/A'),
            unitEn: product.unitEn || product.unit || 'N/A',
            price: Number(product.price) || 0,
          }));
        setProducts(fetchedProducts);

        const monthlyOrderData: { [month: number]: OrderRow[] } = {};
        const monthlyOrdersVsReturnsData: { [month: number]: OrdersVsReturnsRow[] } = {};
        for (let month = 0; month < 12; month++) {
          const daysInMonth = new Date(currentYear, month + 1, 0).getDate();
          const orderMap = new Map<string, OrderRow>();
          const ordersVsReturnsMap = new Map<string, OrdersVsReturnsRow>();

          ordersRes.forEach((order: any) => {
            const date = new Date(order.createdAt || order.date);
            if (isNaN(date.getTime()) || order.status !== 'completed') return;
            const orderMonth = date.getMonth();
            if (orderMonth !== month || date.getFullYear() !== currentYear) return;

            const branch = fetchedBranches.find(b => b._id === order.branchId)?.displayName || (isRtl ? 'الفرع الرئيسي' : 'Main Branch');
            (order.items || []).forEach((item: any) => {
              const productId = item.product?._id || item.productId;
              if (!productId) return;
              const product = fetchedProducts.find(p => p._id === productId) || {
                code: `code-${Math.random().toString(36).substring(2)}`,
                name: isRtl ? 'منتج غير معروف' : 'Unknown Product',
                unit: isRtl ? 'غير محدد' : 'N/A',
                price: 0,
              };
              const key = `${productId}-${month}`;
              const quantity = Number(item.quantity) || 0;

              if (!orderMap.has(key)) {
                orderMap.set(key, {
                  id: key,
                  code: product.code,
                  product: isRtl ? product.name : product.nameEn,
                  unit: isRtl ? product.unit : product.unitEn,
                  branchQuantities: {},
                  totalQuantity: 0,
                  totalPrice: 0,
                  sales: 0,
                  actualSales: 0,
                });
              }
              const row = orderMap.get(key)!;
              row.branchQuantities[branch] = (row.branchQuantities[branch] || 0) + quantity;
              row.totalQuantity += quantity;
              row.totalPrice += quantity * product.price;
              row.sales = row.totalPrice * 0.1;

              // Orders vs Returns
              if (!ordersVsReturnsMap.has(key)) {
                ordersVsReturnsMap.set(key, {
                  id: key,
                  code: product.code,
                  product: isRtl ? product.name : product.nameEn,
                  unit: isRtl ? product.unit : product.unitEn,
                  dailyOrders: Array(daysInMonth).fill(0),
                  dailyReturns: Array(daysInMonth).fill(0),
                  totalOrders: 0,
                  totalReturns: 0,
                  totalRatio: 0,
                });
              }
              const vsRow = ordersVsReturnsMap.get(key)!;
              vsRow.dailyOrders[date.getDate() - 1] += quantity;
              vsRow.totalOrders += quantity;
            });
          });

          // Process returns (assuming returns are part of inventory movements or separate API)
          const inventoryRes = await inventoryAPI.getInventory({}, isRtl);
          inventoryRes.forEach((item: any) => {
            const productId = item?.product?._id;
            if (!productId) return;
            const product = fetchedProducts.find(p => p._id === productId) || {
              code: `code-${Math.random().toString(36).substring(2)}`,
              name: isRtl ? 'منتج غير معروف' : 'Unknown Product',
              unit: isRtl ? 'غير محدد' : 'N/A',
              price: 0,
            };
            (item.movements || []).forEach((movement: any) => {
              const date = new Date(movement.createdAt);
              if (isNaN(date.getTime()) || date.getMonth() !== month || date.getFullYear() !== currentYear) return;
              if (movement.type === 'out' && (movement.reference?.includes('مرتجع') || movement.reference?.includes('RET-'))) {
                const key = `${productId}-${month}`;
                if (!ordersVsReturnsMap.has(key)) {
                  ordersVsReturnsMap.set(key, {
                    id: key,
                    code: product.code,
                    product: isRtl ? product.name : product.nameEn,
                    unit: isRtl ? product.unit : product.unitEn,
                    dailyOrders: Array(daysInMonth).fill(0),
                    dailyReturns: Array(daysInMonth).fill(0),
                    totalOrders: 0,
                    totalReturns: 0,
                    totalRatio: 0,
                  });
                }
                const vsRow = ordersVsReturnsMap.get(key)!;
                const qty = Math.abs(Number(movement.quantity) || 0);
                vsRow.dailyReturns[date.getDate() - 1] += qty;
                vsRow.totalReturns += qty;
                vsRow.totalRatio = vsRow.totalOrders > 0 ? (vsRow.totalReturns / vsRow.totalOrders) * 100 : 0;
              }
            });
          });

          monthlyOrderData[month] = Array.from(orderMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
          monthlyOrdersVsReturnsData[month] = Array.from(ordersVsReturnsMap.values()).sort((a, b) => b.totalRatio - a.totalRatio);
        }

        setOrderData(monthlyOrderData);
        setOrdersVsReturnsData(monthlyOrdersVsReturnsData);
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
  }, [isRtl, currentYear, selectedMonth, searchProduct, selectedBranch, startDate, endDate, selectedWeek, language]);

  const tabVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.3 } },
  };

  return (
    <div className={`min-h-screen px-6 py-8 ${isRtl ? 'rtl font-amiri' : 'ltr font-inter'} bg-gradient-to-br from-gray-100 to-gray-200`}>
      <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">{isRtl ? 'تقارير الإنتاج' : 'Production Reports'}</h1>
      <div className="mb-8 bg-white shadow-xl rounded-2xl p-6 border border-gray-200">
        <div className="flex flex-wrap gap-4 mb-6 justify-center">
          {months.map(month => (
            <Button
              key={month.value}
              variant={selectedMonth === month.value ? 'primary' : 'secondary'}
              onClick={() => setSelectedMonth(month.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                selectedMonth === month.value
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:shadow-md'
              }`}
            >
              {month.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 mb-6 justify-center">
          <ProductSearchInput
            value={searchProduct}
            onChange={(e) => setSearchProduct(e.target.value)}
            placeholder={isRtl ? 'بحث عن منتج' : 'Search product'}
            ariaLabel="Search product"
          />
          <ProductDropdown
            value={selectedBranch}
            onChange={setSelectedBranch}
            options={[{ value: 'all', label: isRtl ? 'كل الفروع' : 'All Branches' }, ...branches.map(b => ({ value: b._id, label: b.displayName }))]}
            ariaLabel="Select branch"
          />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm"
          />
          <ProductDropdown
            value={selectedWeek}
            onChange={setSelectedWeek}
            options={[{ value: 'all', label: isRtl ? 'كل الأسابيع' : 'All Weeks' }, ...weeks]}
            ariaLabel="Select week"
          />
        </div>
        <div className={`flex flex-wrap gap-2 justify-center ${isRtl ? 'flex-row-reverse' : ''}`}>
          <Button
            variant={activeTab === 'orders' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
              activeTab === 'orders' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:shadow-md'
            }`}
          >
            {isRtl ? 'الطلبات' : 'Orders'}
          </Button>
          <Button
            variant={activeTab === 'ordersVsReturns' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('ordersVsReturns')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
              activeTab === 'ordersVsReturns' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:shadow-md'
            }`}
          >
            {isRtl ? 'الطلبات مقابل المرتجعات' : 'Orders vs Returns'}
          </Button>
        </div>
      </div>
      <AnimatePresence mode="wait">
        {activeTab === 'orders' && (
          <motion.div key="orders" variants={tabVariants} initial="hidden" animate="visible" exit="exit">
            <OrdersTable
              data={orderData[selectedMonth] || []}
              isRtl={isRtl}
              branches={allBranches}
              monthName={months[selectedMonth].label}
            />
          </motion.div>
        )}
        {activeTab === 'ordersVsReturns' && (
          <motion.div key="ordersVsReturns" variants={tabVariants} initial="hidden" animate="visible" exit="exit">
            <OrdersVsReturnsTable
              data={ordersVsReturnsData[selectedMonth] || []}
              isRtl={isRtl}
              daysInMonth={Array.from({ length: new Date(currentYear, selectedMonth + 1, 0).getDate() }, (_, i) =>
                new Date(currentYear, selectedMonth, i + 1).toLocaleString(language, { day: 'numeric', month: 'short' })
              )}
              monthName={months[selectedMonth].label}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductionReport;
