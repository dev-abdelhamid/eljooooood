import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { ordersAPI, salesAPI, returnsAPI, productionAssignmentsAPI, branchesAPI, productsAPI } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const ProductionReport: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState('orders');

  const { data: branches, isLoading: branchesLoading, error: branchesError } = useQuery({
    queryKey: ['branches'],
    queryFn: branchesAPI.getAll,
    enabled: !!user,
    onError: (err) => toast.error(isRtl ? 'خطأ في جلب الفروع' : 'Error fetching branches'),
  });

  const { data: products, isLoading: productsLoading, error: productsError } = useQuery({
    queryKey: ['products'],
    queryFn: productsAPI.getAll,
    enabled: !!user,
    onError: (err) => toast.error(isRtl ? 'خطأ في جلب المنتجات' : 'Error fetching products'),
  });

  const { data: orders, isLoading: ordersLoading, error: ordersError } = useQuery({
    queryKey: ['orders', 'production-report'],
    queryFn: () => ordersAPI.getAll({}),
    enabled: !!user,
    onError: (err) => toast.error(isRtl ? 'خطأ في جلب الطلبات' : 'Error fetching orders'),
  });

  const { data: sales, isLoading: salesLoading, error: salesError } = useQuery({
    queryKey: ['sales', 'production-report'],
    queryFn: () => salesAPI.getAll({}),
    enabled: !!user,
    onError: (err) => toast.error(isRtl ? 'خطأ في جلب المبيعات' : 'Error fetching sales'),
  });

  const { data: returns, isLoading: returnsLoading, error: returnsError } = useQuery({
    queryKey: ['returns', 'production-report'],
    queryFn: () => returnsAPI.getAll({}),
    enabled: !!user,
    onError: (err) => toast.error(isRtl ? 'خطأ في جلب المرتجعات' : 'Error fetching returns'),
  });

  const { data: production, isLoading: productionLoading, error: productionError } = useQuery({
    queryKey: ['production', 'production-report'],
    queryFn: productionAssignmentsAPI.getAllTasks,
    enabled: !!user,
    onError: (err) => toast.error(isRtl ? 'خطأ في جلب الإنتاج' : 'Error fetching production'),
  });

  const sortedBranches = useMemo(() => {
    return (branches || []).sort((a, b) => a.name.localeCompare(b.name));
  }, [branches]);

  const tableHeaders = useMemo(() => {
    const headers = [
      { key: 'unit', label: isRtl ? 'الوحدة' : 'Unit' },
      { key: 'total', label: isRtl ? 'الإجمالي' : 'Total' },
      { key: 'sale', label: isRtl ? 'البيع' : 'Sale' },
      ...sortedBranches.map((branch) => ({
        key: branch._id,
        label: isRtl ? branch.name : branch.nameEn || branch.name,
      })),
      { key: 'code', label: isRtl ? 'الكود' : 'Code' },
      { key: 'price', label: isRtl ? 'السعر' : 'Price' },
      { key: 'name', label: isRtl ? 'الاسم' : 'Name' },
    ];
    return isRtl ? headers.reverse() : headers;
  }, [sortedBranches, isRtl]);

  const aggregateData = (items, key) => {
    const productMap = new Map();
    (items || []).forEach((entry) => {
      (entry[key] || []).forEach((item) => {
        const productId = item.product?._id || item.productId;
        if (!productId) return;
        if (!productMap.has(productId)) {
          productMap.set(productId, new Map());
        }
        const branchMap = productMap.get(productId);
        const branchId = entry.branch?._id || entry.branchId || 'unknown';
        const current = branchMap.get(branchId) || 0;
        branchMap.set(branchId, current + (item.quantity || 0));
      });
    });
    return productMap;
  };

  const generateRows = (aggregated, productsList) => {
    return (productsList || []).map((product) => {
      const branchQuantities = aggregated.get(product._id) || new Map();
      const total = Array.from(branchQuantities.values()).reduce((sum, q) => sum + q, 0);
      const sale = total; // Adjust logic if 'sale' is different; based on image, it's a separate column, perhaps for sales quantity
      return {
        unit: isRtl ? product.unit : product.unitEn || product.unit,
        total,
        sale,
        ...Object.fromEntries(sortedBranches.map((branch) => [branch._id, branchQuantities.get(branch._id) || 0])),
        code: product.code,
        price: product.price,
        name: isRtl ? product.name : product.nameEn || product.name,
      };
    });
  };

  const ordersAggregated = useMemo(() => aggregateData(orders || [], 'items'), [orders]);
  const salesAggregated = useMemo(() => aggregateData(sales?.sales || [], 'items'), [sales]);
  const returnsAggregated = useMemo(() => aggregateData(returns?.returns || [], 'items'), [returns]);
  const productionAggregated = useMemo(() => aggregateData(production || [], 'items'), [production]);

  const ordersRows = useMemo(() => generateRows(ordersAggregated, products?.products || []), [ordersAggregated, products]);
  const salesRows = useMemo(() => generateRows(salesAggregated, products?.products || []), [salesAggregated, products]);
  const returnsRows = useMemo(() => generateRows(returnsAggregated, products?.products || []), [returnsAggregated, products]);
  const productionRows = useMemo(() => generateRows(productionAggregated, products?.products || []), [productionAggregated, products]);

  const exportTable = (rows, headers, fileName, format) => {
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
  };

  const RenderTable = ({ rows, headers, title, fileName }) => (
    <div className="overflow-x-auto bg-white p-4 rounded-lg shadow-sm border border-gray-100">
      <div className="flex justify-between mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex gap-2">
          <button onClick={() => exportTable(rows, headers, fileName, 'excel')} className="bg-blue-500 text-white px-4 py-2 rounded text-sm">
            {isRtl ? 'تصدير إكسل' : 'Export Excel'}
          </button>
          <button onClick={() => exportTable(rows, headers, fileName, 'pdf')} className="bg-green-500 text-white px-4 py-2 rounded text-sm">
            {isRtl ? 'تصدير PDF' : 'Export PDF'}
          </button>
        </div>
      </div>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {headers.map((header) => (
              <th
                key={header.key}
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {header.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-6 py-4 text-center text-sm text-gray-500">
                {isRtl ? 'لا توجد بيانات' : 'No data available'}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {headers.map((header) => (
                  <td key={header.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {row[header.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  if (branchesError || productsError || ordersError || salesError || returnsError || productionError) {
    return <div className="text-red-600 p-4">{isRtl ? 'خطأ في جلب البيانات' : 'Error fetching data'}</div>;
  }

  if (branchesLoading || productsLoading || ordersLoading || salesLoading || returnsLoading || productionLoading) {
    return <div className="text-center p-4">{isRtl ? 'جاري التحميل...' : 'Loading...'}</div>;
  }

  return (
    <div className={`py-6 px-4 mx-auto ${isRtl ? 'rtl' : 'ltr'}`}>
      <h1 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">
        {isRtl ? 'تقرير الإنتاج' : 'Production Report'}
      </h1>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          className={`px-4 py-2 ${activeSection === 'orders' ? 'bg-blue-500 text-white' : 'bg-gray-200'} rounded`}
          onClick={() => setActiveSection('orders')}
        >
          {isRtl ? 'الطلبات' : 'Orders'}
        </button>
        <button
          className={`px-4 py-2 ${activeSection === 'sales' ? 'bg-blue-500 text-white' : 'bg-gray-200'} rounded`}
          onClick={() => setActiveSection('sales')}
        >
          {isRtl ? 'المبيعات' : 'Sales'}
        </button>
        <button
          className={`px-4 py-2 ${activeSection === 'returns' ? 'bg-blue-500 text-white' : 'bg-gray-200'} rounded`}
          onClick={() => setActiveSection('returns')}
        >
          {isRtl ? 'المرتجعات' : 'Returns'}
        </button>
        <button
          className={`px-4 py-2 ${activeSection === 'production' ? 'bg-blue-500 text-white' : 'bg-gray-200'} rounded`}
          onClick={() => setActiveSection('production')}
        >
          {isRtl ? 'الإنتاج اليومي' : 'Daily Production'}
        </button>
      </div>
      {activeSection === 'orders' && (
        <RenderTable rows={ordersRows} headers={tableHeaders} title={isRtl ? 'الطلبات' : 'Orders'} fileName="orders_report" />
      )}
      {activeSection === 'sales' && (
        <RenderTable rows={salesRows} headers={tableHeaders} title={isRtl ? 'المبيعات' : 'Sales'} fileName="sales_report" />
      )}
      {activeSection === 'returns' && (
        <RenderTable rows={returnsRows} headers={tableHeaders} title={isRtl ? 'المرتجعات' : 'Returns'} fileName="returns_report" />
      )}
      {activeSection === 'production' && (
        <RenderTable rows={productionRows} headers={tableHeaders} title={isRtl ? 'الإنتاج اليومي' : 'Daily Production'} fileName="production_report" />
      )}
    </div>
  );
};

export default ProductionReport;