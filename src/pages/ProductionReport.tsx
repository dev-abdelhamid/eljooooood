import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { ordersAPI, salesAPI, returnsAPI, productionAssignmentsAPI, branchesAPI, productsAPI } from '../services/api';
import { motion } from 'framer-motion';
import { Button } from '../components/UI/Button';
import { Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

const ProductionReport = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState('orders');
  const [loading, setLoading] = useState(true);

  const { data: branches = [], isLoading: branchesLoading } = useQuery(['branches'], () => branchesAPI.getAll(), { enabled: !!user });
  const { data: products = { products: [] }, isLoading: productsLoading } = useQuery(['products'], () => productsAPI.getAll(), { enabled: !!user });
  const { data: orders = [], isLoading: ordersLoading } = useQuery(['orders', 'production-report'], () => ordersAPI.getAll({}), { enabled: !!user });
  const { data: sales = { sales: [] }, isLoading: salesLoading } = useQuery(['sales', 'production-report'], () => salesAPI.getAll({}), { enabled: !!user });
  const { data: returns = { returns: [] }, isLoading: returnsLoading } = useQuery(['returns', 'production-report'], () => returnsAPI.getAll({}), { enabled: !!user });
  const { data: production = [], isLoading: productionLoading } = useQuery(['production', 'production-report'], () => productionAssignmentsAPI.getAllTasks(), { enabled: !!user });

  const sortedBranches = useMemo(() => branches.sort((a, b) => a.name.localeCompare(b.name)), [branches]);

  const tableHeaders = useMemo(() => [
    { key: 'no', label: isRtl ? 'رقم' : 'No.', className: 'text-center min-w-[40px]' },
    { key: 'unit', label: isRtl ? 'الوحدة' : 'Unit', className: 'text-center min-w-[100px]' },
    { key: 'total', label: isRtl ? 'الإجمالي' : 'Total', className: 'text-center min-w-[100px]' },
    { key: 'sale', label: isRtl ? 'البيع' : 'Sale', className: 'text-center min-w-[80px]' },
    ...sortedBranches.map((branch) => ({
      key: branch._id,
      label: isRtl ? branch.name : branch.nameEn || branch.name,
      className: 'text-center min-w-[80px]',
    })),
    { key: 'code', label: isRtl ? 'الكود' : 'Code', className: 'text-center min-w-[100px]' },
    { key: 'price', label: isRtl ? 'السعر' : 'Price', className: 'text-center min-w-[80px]' },
    { key: 'name', label: isRtl ? 'الاسم' : 'Name', className: 'text-center min-w-[100px]' },
  ], [sortedBranches, isRtl]);

  const aggregateData = useCallback((items, key) => {
    const productMap = new Map();
    (items || []).forEach((entry) => {
      (entry[key] || []).forEach((item) => {
        const productId = item.product?._id || item.productId;
        if (!productId) return;
        if (!productMap.has(productId)) productMap.set(productId, new Map());
        const branchMap = productMap.get(productId);
        const branchId = entry.branch?._id || entry.branchId || 'unknown';
        const current = branchMap.get(branchId) || 0;
        branchMap.set(branchId, current + (item.quantity || 0));
      });
    });
    return productMap;
  }, []);

  const generateRows = useCallback((aggregated, productsList) => {
    return (productsList || []).map((product, index) => {
      const branchQuantities = aggregated.get(product._id) || new Map();
      const total = Array.from(branchQuantities.values()).reduce((sum, q) => sum + q, 0);
      const sale = total; // Simplified; adjust logic if needed
      return {
        no: index + 1,
        unit: isRtl ? product.unit : product.unitEn || product.unit,
        total,
        sale,
        ...Object.fromEntries(sortedBranches.map((branch) => [branch._id, branchQuantities.get(branch._id) || 0])),
        code: product.code,
        price: product.price,
        name: isRtl ? product.name : product.nameEn || product.name,
      };
    });
  }, [sortedBranches, isRtl]);

  const ordersAggregated = useMemo(() => aggregateData(orders, 'items'), [orders, aggregateData]);
  const salesAggregated = useMemo(() => aggregateData(sales.sales, 'items'), [sales, aggregateData]);
  const returnsAggregated = useMemo(() => aggregateData(returns.returns, 'items'), [returns, aggregateData]);
  const productionAggregated = useMemo(() => aggregateData(production, 'items'), [production, aggregateData]);

  const ordersRows = useMemo(() => generateRows(ordersAggregated, products.products), [ordersAggregated, products, generateRows]);
  const salesRows = useMemo(() => generateRows(salesAggregated, products.products), [salesAggregated, products, generateRows]);
  const returnsRows = useMemo(() => generateRows(returnsAggregated, products.products), [returnsAggregated, products, generateRows]);
  const productionRows = useMemo(() => generateRows(productionAggregated, products.products), [productionAggregated, products, generateRows]);

  const currentRows = useMemo(() => {
    switch (activeSection) {
      case 'orders': return ordersRows;
      case 'sales': return salesRows;
      case 'returns': return returnsRows;
      case 'production': return productionRows;
      default: return [];
    }
  }, [activeSection, ordersRows, salesRows, returnsRows, productionRows]);

  const exportTable = useCallback((rows, headers, fileName, format) => {
    if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(rows.map(row => {
        const newRow = {};
        headers.forEach(h => {
          newRow[h.label] = row[h.key];
        });
        return newRow;
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, fileName);
      XLSX.writeFile(wb, `${fileName}.xlsx`);
    } else if (format === 'pdf') {
      const doc = new jsPDF();
      doc.autoTable({
        head: [headers.map(h => h.label)],
        body: rows.map(row => headers.map(h => row[h.key])),
      });
      doc.save(`${fileName}.pdf`);
    }
  }, []);

  const TableSkeleton = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-x-auto bg-white shadow-md rounded-lg border border-gray-100"
    >
      <table className="min-w-full">
        <thead>
          <tr className={isRtl ? 'flex-row-reverse' : ''}>
            {tableHeaders.map((header, index) => (
              <th key={index} className={`px-2 py-2 ${header.className || ''}`}>
                <Skeleton width={80} height={14} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array(5).fill(0).map((_, rowIndex) => (
            <tr key={rowIndex} className={`hover:bg-gray-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
              {tableHeaders.map((_, cellIndex) => (
                <td key={cellIndex} className="px-2 py-2">
                  <Skeleton width={100} height={14} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  );

  useEffect(() => {
    setLoading(branchesLoading || productsLoading || ordersLoading || salesLoading || returnsLoading || productionLoading);
  }, [branchesLoading, productsLoading, ordersLoading, salesLoading, returnsLoading, productionLoading]);

  return (
    <div className={`py-6 px-4 mx-auto ${isRtl ? 'rtl' : 'ltr'}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
            {isRtl ? 'تقرير الإنتاج' : 'Production Report'}
          </h1>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={currentRows.length > 0 ? 'primary' : 'secondary'}
              onClick={currentRows.length > 0 ? () => exportTable(currentRows, tableHeaders, `${activeSection}_report`, 'excel') : undefined}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm shadow-sm ${
                currentRows.length > 0 ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'
              }`}
              disabled={currentRows.length === 0}
            >
              <Upload className="w-5 h-5" />
              {isRtl ? 'تصدير إكسل' : 'Export Excel'}
            </Button>
            <Button
              variant={currentRows.length > 0 ? 'primary' : 'secondary'}
              onClick={currentRows.length > 0 ? () => exportTable(currentRows, tableHeaders, `${activeSection}_report`, 'pdf') : undefined}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm shadow-sm ${
                currentRows.length > 0 ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'
              }`}
              disabled={currentRows.length === 0}
            >
              <Upload className="w-5 h-5" />
              {isRtl ? 'تصدير PDF' : 'Export PDF'}
            </Button>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {['orders', 'sales', 'returns', 'production'].map((section) => (
            <Button
              key={section}
              variant={activeSection === section ? 'primary' : 'secondary'}
              onClick={() => setActiveSection(section)}
              className={`px-4 py-2 ${activeSection === section ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'} rounded`}
            >
              {isRtl
                ? { orders: 'الطلبات', sales: 'المبيعات', returns: 'المرتجعات', production: 'الإنتاج اليومي' }[section]
                : { orders: 'Orders', sales: 'Sales', returns: 'Returns', production: 'Daily Production' }[section]
              }
            </Button>
          ))}
        </div>
        {loading ? (
          <TableSkeleton />
        ) : currentRows.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-center py-12 bg-white shadow-md rounded-lg border border-gray-100"
          >
            <p className="text-gray-500 text-sm">{isRtl ? 'لا توجد بيانات' : 'No data available'}</p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="overflow-x-auto rounded-md shadow-md border border-gray-100 bg-white"
          >
            <table className="min-w-full divide-y divide-gray-100 text-xs">
              <thead className="bg-gray-50">
                <tr className={isRtl ? 'flex-row-reverse' : ''}>
                  {tableHeaders.map((header) => (
                    <th
                      key={header.key}
                      className={`px-2 py-2 font-medium text-gray-600 uppercase tracking-wider ${header.className}`}
                    >
                      {header.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentRows.map((row, index) => (
                  <tr key={index} className={`hover:bg-gray-50 transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
                    {tableHeaders.map((header) => (
                      <td key={header.key} className={`px-2 py-2 text-gray-600 text-center whitespace-nowrap ${header.className}`}>
                        {row[header.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default ProductionReport;