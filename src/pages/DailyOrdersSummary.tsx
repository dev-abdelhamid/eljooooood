import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Upload, ChevronDown } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { inventoryAPI, ordersAPI, branchesAPI, salesAPI } from '../services/api';
import { toast } from 'react-toastify';
import { Tooltip } from 'react-tooltip';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';

// Interfaces
interface OrderRow {
  id: string;
  code: string;
  product: string;
  unit: string;
  price: number;
  branchQuantities: { [branch: string]: number };
  totalQuantity: number;
  totalPrice: number;
  actualSales: number;
}

interface Branch {
  _id: string;
  name: string;
  nameEn: string;
  displayName: string;
}

// Button component
const Button: React.FC<{
  variant: 'primary' | 'secondary';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ variant, onClick, disabled, className, children }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 ${
        variant === 'primary' && !disabled
          ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'
          : 'bg-gray-200 text-gray-500 cursor-not-allowed'
      } ${className}`}
    >
      {children}
    </button>
  );
};

// ProductSearchInput component
const ProductSearchInput: React.FC<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  ariaLabel: string;
  className?: string;
}> = ({ value, onChange, placeholder, ariaLabel, className }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';

  const handleClear = () => {
    onChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>);
  };

  return (
    <div className={`relative group w-full ${className}`}>
      <motion.div
        className={`absolute px-3 py-2 inset-y-0 ${isRtl ? 'left-3' : 'right-3'} flex items-center text-gray-400 transition-colors group-focus-within:text-amber-500`}
        initial={false}
        animate={{ opacity: value ? 0 : 1, scale: value ? 0.8 : 1 }}
        transition={{ duration: 0.2 }}
      >
        <Search className="w-4 h-4" />
      </motion.div>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full ${isRtl ? 'pl-12 pr-4' : 'pr-12 pl-4'} px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md text-sm placeholder-gray-400 ${isRtl ? 'text-right' : 'text-left'}`}
        aria-label={ariaLabel}
      />
      {value && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          onClick={handleClear}
          className={`absolute px-3 py-2 inset-y-0 ${isRtl ? 'left-3' : 'right-3'} flex items-center text-gray-400 hover:text-amber-500 transition-colors focus:outline-none`}
          aria-label={isRtl ? 'مسح البحث' : 'Clear search'}
        >
          <X className="w-4 h-4" />
        </motion.button>
      )}
    </div>
  );
};

// ProductDropdown component
const ProductDropdown: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}> = ({ value, onChange, options, ariaLabel, disabled = false, className }) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((opt) => opt.value === value) || options[0] || { label: isRtl ? 'اختر' : 'Select' };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative group w-full ${className}`} ref={dropdownRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-200 bg-white shadow-sm hover:shadow-md text-xs text-gray-700 ${isRtl ? 'text-right' : 'text-left'} flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={ariaLabel}
      >
        <span className="truncate">{selectedOption.label}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && !disabled && (
        <div className={`absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto ${isRtl ? 'text-right' : 'text-left'}`}>
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 text-xs hover:bg-amber-100 transition-colors text-left"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Utility functions
const toArabicNumerals = (number: string | number): string => {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(number).replace(/[0-9]/g, (digit) => arabicNumerals[parseInt(digit)]);
};

const formatPrice = (amount: number, isRtl: boolean, isStats: boolean = false): string => {
  const validAmount = (typeof amount === 'number' && !isNaN(amount)) ? amount : 0;
  let formatted: string;
  if (isStats) {
    formatted = validAmount.toLocaleString(isRtl ? 'ar-SA' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    formatted = isRtl ? `${toArabicNumerals(formatted)} ر.س` : `${formatted} SAR`;
  } else {
    formatted = validAmount.toLocaleString(isRtl ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    if (isRtl) {
      formatted = formatted.replace(/\d/g, (d) => String.fromCharCode(0x0660 + parseInt(d)));
    }
  }
  return formatted;
};

const formatNumber = (num: number, isRtl: boolean): string => {
  return isRtl ? toArabicNumerals(num) : num.toString();
};

// Main BranchOrdersSummary component
const DailyOrdersSummary: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const [selectedMonth, setSelectedMonth] = useState<string>(currentDate.getMonth().toString());
  const [orderData, setOrderData] = useState<OrderRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    value: i.toString(),
    label: new Date(currentYear, i).toLocaleString(language, { month: 'long' }),
  })), [currentYear, language]);

  const monthName = useMemo(() => months.find(m => m.value === selectedMonth)?.label || '', [months, selectedMonth]);

  const allBranches = useMemo(() => branches.map(b => b.displayName).sort((a, b) => a.localeCompare(b, language)), [branches, language]);

  const fetchData = useCallback(async () => {
    if (!user || (user.role !== 'admin' && user.role !== 'production')) {
      toast.error(isRtl ? 'لا يوجد صلاحية' : 'No access', {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [inventory, ordersResponse, branchesResponse, salesResponse] = await Promise.all([
        inventoryAPI.getInventory({}, isRtl),
        ordersAPI.getAll({ page: 1, limit: 10000 }, isRtl),
        branchesAPI.getAll(),
        salesAPI.getAnalytics({
          startDate: new Date(currentYear, parseInt(selectedMonth), 1).toISOString(),
          endDate: new Date(currentYear, parseInt(selectedMonth) + 1, 0).toISOString(),
          lang: language,
        }),
      ]);
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
      const orderMap = new Map<string, OrderRow>();
      orders.forEach((order: any) => {
        const status = order.status || order.orderStatus;
        const date = new Date(order.createdAt || order.date);
        if (isNaN(date.getTime())) return;
        const orderMonth = date.getMonth();
        const year = date.getFullYear();
        if (year === currentYear && orderMonth === parseInt(selectedMonth)) {
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
            const key = productId;
            if (!orderMap.has(key)) {
              orderMap.set(key, {
                id: key,
                code: details.code,
                product: details.product,
                unit: details.unit,
                price: details.price,
                branchQuantities: {},
                totalQuantity: 0,
                totalPrice: 0,
                actualSales: 0,
              });
            }
            const row = orderMap.get(key)!;
            const quantity = Number(item.quantity) || 0;
            row.branchQuantities[branch] = (row.branchQuantities[branch] || 0) + quantity;
            row.totalQuantity += quantity;
            row.totalPrice += quantity * details.price;
          });
        }
      });

      for (const row of orderMap.values()) {
        const salesItem = salesResponse.productSales?.find((s: any) => s.productId === row.id);
        if (salesItem) {
          row.actualSales = Number(salesItem.totalQuantity) || 0;
        }
      }

      setOrderData(Array.from(orderMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity));
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error(isRtl ? 'فشل في جلب البيانات' : 'Failed to fetch data', {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    } finally {
      setLoading(false);
    }
  }, [isRtl, currentYear, selectedMonth, language]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredData = useMemo(() => {
    return orderData.filter(row => row.product.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [orderData, searchTerm]);

  const grandTotalQuantity = useMemo(() => filteredData.reduce((sum, row) => sum + row.totalQuantity, 0), [filteredData]);
  const grandTotalPrice = useMemo(() => filteredData.reduce((sum, row) => sum + row.totalPrice, 0), [filteredData]);
  const grandActualSales = useMemo(() => filteredData.reduce((sum, row) => sum + row.actualSales, 0), [filteredData]);

  const getTooltipContent = (qty: number, isRtl: boolean) => {
    return `${isRtl ? 'الكمية' : 'Quantity'}: ${qty > 0 ? '+' : ''}${formatNumber(qty, isRtl)}`;
  };

  const exportTable = (format: 'excel' | 'pdf') => {
    const headers = [
      isRtl ? 'وحدة' : 'Unit',
      isRtl ? 'الإجمالي' : 'Total',
      ...allBranches,
      isRtl ? 'الكود' : 'Code',
      isRtl ? 'السعر' : 'Price',
      isRtl ? 'الاسم' : 'Name',
    ];
    const rows = [
      ...filteredData.map((row, index) => ({
        unit: row.unit,
        total: row.totalQuantity,
        ...Object.fromEntries(allBranches.map(branch => [branch, row.branchQuantities[branch] || 0])),
        code: row.code,
        price: formatPrice(row.price, isRtl),
        name: row.product,
      })),
      {
        unit: '',
        total: grandTotalQuantity,
        ...Object.fromEntries(allBranches.map(branch => [branch, filteredData.reduce((sum, row) => sum + (row.branchQuantities[branch] || 0), 0)])),
        code: '',
        price: formatPrice(grandTotalPrice / grandTotalQuantity || 0, isRtl),
        name: isRtl ? 'الإجمالي' : 'Total',
      },
    ];
    const dataRows = rows.map(row => [
      row.unit,
      row.total,
      ...allBranches.map(branch => row[branch]),
      row.code,
      row.price,
      row.name,
    ]);
    if (format === 'excel') {
      toast.info(isRtl ? 'جارٍ إنشاء ملف Excel...' : 'Generating Excel...', {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: false,
        toastId: 'excel-export',
      });
      try {
        const sheetData = isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows;
        const sheetHeaders = isRtl ? headers.slice().reverse() : headers;
        const ws = XLSX.utils.json_to_sheet(sheetData, { header: sheetHeaders });
        if (isRtl) {
          ws['!views'] = [{ RTL: true }];
        }
        ws['!cols'] = [
          { wch: 10 },
          { wch: 10 },
          ...allBranches.map(() => ({ wch: 10 })),
          { wch: 10 },
          { wch: 10 },
          { wch: 25 },
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Branch_Orders_${monthName}`);
        XLSX.writeFile(wb, generateFileName('Branch_Orders', monthName, isRtl, 'xlsx'));
        toast.update('excel-export', {
          render: isRtl ? 'تم تصدير ملف Excel بنجاح' : 'Excel exported successfully',
          type: 'success',
          autoClose: 3000,
        });
      } catch (error) {
        console.error('Error exporting Excel:', error);
        toast.update('excel-export', {
          render: isRtl ? 'فشل في تصدير ملف Excel' : 'Failed to export Excel',
          type: 'error',
          autoClose: 3000,
        });
      }
    } else if (format === 'pdf') {
      exportToPDF(dataRows, isRtl ? 'ملخص الطلبات لكل فرع' : 'Branch Orders Summary', monthName, headers, isRtl, filteredData.length, grandTotalQuantity, grandTotalPrice);
    }
  };

  if (!user || (user.role !== 'admin' && user.role !== 'production')) {
    return (
      <div className="text-center py-12 text-sm font-medium text-gray-700">
        {isRtl ? 'لا يوجد صلاحية' : 'No access'}
      </div>
    );
  }

  return (
    <div className={`min-h-screen px-6 py-8 ${isRtl ? 'rtl font-amiri' : 'ltr font-inter'} bg-gray-100`}>
      <div className="mb-8 bg-white shadow-md rounded-xl p-4">
        <div className="flex flex-wrap gap-2 mb-4 justify-center">
          {months.map(month => (
            <Button
              key={month.value}
              variant={selectedMonth === month.value ? 'primary' : 'secondary'}
              onClick={() => setSelectedMonth(month.value)}
            >
              {month.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="mb-8">
        <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <h2 className="text-lg font-semibold text-gray-800">{isRtl ? `ملخص الطلبات لكل فرع - ${monthName}` : `Branch Orders Summary - ${monthName}`}</h2>
          <div className="flex gap-2">
            <Button
              variant={filteredData.length > 0 ? 'primary' : 'secondary'}
              onClick={filteredData.length > 0 ? () => exportTable('excel') : undefined}
              disabled={filteredData.length === 0}
            >
              <Upload className="w-4 h-4" />
              {isRtl ? 'تصدير إكسل' : 'Export Excel'}
            </Button>
            <Button
              variant={filteredData.length > 0 ? 'primary' : 'secondary'}
              onClick={filteredData.length > 0 ? () => exportTable('pdf') : undefined}
              disabled={filteredData.length === 0}
            >
              <Upload className="w-4 h-4" />
              {isRtl ? 'تصدير PDF' : 'Export PDF'}
            </Button>
          </div>
        </div>
        <ProductSearchInput
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={isRtl ? 'بحث حسب المنتج' : 'Search by product'}
          ariaLabel={isRtl ? 'بحث المنتج' : 'Product search'}
          className="mt-4"
        />
      </div>
      {loading ? (
        <OrderTableSkeleton isRtl={isRtl} />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-x-auto rounded-xl shadow-md border border-gray-200 bg-white"
        >
          <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-amber-50 sticky top-0 z-10">
              <tr className={isRtl ? 'flex-row-reverse' : ''}>
                <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'وحدة' : 'Unit'}</th>
                <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'الإجمالي' : 'Total'}</th>
                {allBranches.map((branch) => (
                  <th key={branch} className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                    {branch}
                  </th>
                ))}
                <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'الكود' : 'Code'}</th>
                <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'السعر' : 'Price'}</th>
                <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[150px]">{isRtl ? 'الاسم' : 'Name'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredData.map((row, index) => (
                <tr key={row.id} className={`hover:bg-amber-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-4 py-3 text-gray-700 text-center">{row.unit}</td>
                  <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalQuantity, isRtl)}</td>
                  {allBranches.map((branch) => (
                    <td
                      key={branch}
                      className={`px-4 py-3 text-center font-medium ${row.branchQuantities[branch] > 0 ? 'bg-green-50 text-green-700' : 'text-gray-700'}`}
                      data-tooltip-id="branch-tooltip"
                      data-tooltip-content={getTooltipContent(row.branchQuantities[branch] || 0, isRtl)}
                    >
                      {row.branchQuantities[branch] !== 0 ? formatNumber(row.branchQuantities[branch] || 0, isRtl) : '0'}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-gray-700 text-center">{row.code}</td>
                  <td className="px-4 py-3 text-gray-700 text-center">{formatPrice(row.price, isRtl)}</td>
                  <td className="px-4 py-3 text-gray-700 text-center truncate">{row.product}</td>
                </tr>
              ))}
              <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <td className="px-4 py-3 text-gray-800 text-center"></td>
                <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalQuantity, isRtl)}</td>
                {allBranches.map((branch) => (
                  <td key={branch} className="px-4 py-3 text-gray-800 text-center">
                    {formatNumber(filteredData.reduce((sum, row) => sum + (row.branchQuantities[branch] || 0), 0), isRtl)}
                  </td>
                ))}
                <td className="px-4 py-3 text-gray-800 text-center"></td>
                <td className="px-4 py-3 text-gray-800 text-center">{formatPrice(grandTotalPrice, isRtl)}</td>
                <td className="px-4 py-3 text-gray-800 text-center">{isRtl ? 'الإجمالي' : 'Total'}</td>
              </tr>
            </tbody>
          </table>
          <Tooltip id="branch-tooltip" place="top" className="custom-tooltip whitespace-pre-line" />
        </motion.div>
      )}
    </div>
  );
};

export default DailyOrdersSummary;