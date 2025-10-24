// src/pages/ReturnsVsOrdersPage.tsx
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, X, Upload, ChevronDown, AlertCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { ordersAPI, returnsAPI, inventoryAPI, branchesAPI } from '../services/api';
import { toast } from 'react-toastify';
import { Tooltip } from 'react-tooltip';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// === Utility Functions ===
const toArabicNumerals = (num: number | string): string => {
  return String(num).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
};

const formatNumber = (num: number, isRtl: boolean): string => {
  return isRtl ? toArabicNumerals(num) : num.toString();
};

const getRatioColor = (ratio: number): string => {
  if (ratio >= 15) return 'text-red-700 bg-red-50';
  if (ratio >= 8) return 'text-yellow-700 bg-yellow-50';
  return 'text-green-700 bg-green-50';
};

// === PDF Export ===
const loadFont = async (doc: jsPDF): Promise<boolean> => {
  const fontUrl = 'https://raw.githubusercontent.com/aliftype/amiri/master/fonts/Amiri-Regular.ttf';
  try {
    const fontBytes = await fetch(fontUrl).then(res => res.arrayBuffer());
    const base64 = btoa(String.fromCharCode(...new Uint8Array(fontBytes)));
    doc.addFileToVFS('Amiri.ttf', base64);
    doc.addFont('Amiri.ttf', 'Amiri', 'normal');
    doc.setFont('Amiri');
    return true;
  } catch {
    doc.setFont('helvetica');
    return false;
  }
};

const exportToPDF = async (data: any[], headers: string[], title: string, month: string, isRtl: boolean, totalOrders: number, totalReturns: number) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const fontLoaded = await loadFont(doc);

  // Header
  doc.setFontSize(16);
  doc.text(title, isRtl ? 280 : 15, 15, { align: isRtl ? 'right' : 'left' });
  doc.setFontSize(10);
  doc.setTextColor(100);
  const stats = isRtl
    ? `إجمالي الطلبات: ${toArabicNumerals(totalOrders)} | المرتجعات: ${toArabicNumerals(totalReturns)} | نسبة: ${((totalReturns / totalOrders) * 100).toFixed(1)}%`
    : `Orders: ${totalOrders} | Returns: ${totalReturns} | Ratio: ${((totalReturns / totalOrders) * 100).toFixed(1)}%`;
  doc.text(stats, isRtl ? 280 : 15, 22, { align: isRtl ? 'right' : 'left' });

  // Table
  autoTable(doc, {
    head: [isRtl ? headers.slice().reverse() : headers],
    body: isRtl ? data.map(row => row.slice().reverse()) : data,
    startY: 30,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246], fontSize: 9, halign: 'center' },
    bodyStyles: { fontSize: 8, halign: 'center' },
    didParseCell: (d) => {
      if (isRtl && typeof d.cell.text[0] === 'string') {
        d.cell.text[0] = d.cell.text[0].replace(/\d/g, m => toArabicNumerals(m));
      }
    },
  });

  doc.save(`${title}_${month}.pdf`);
};

// === Interfaces ===
interface ProductRow {
  id: string;
  code: string;
  name: string;
  unit: string;
  orders: number;
  returns: number;
  ratio: number;
}

// === Main Component ===
const ReturnsVsOrdersPage: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [data, setData] = useState<ProductRow[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');

  const monthName = useMemo(() => {
    return new Date(currentYear, selectedMonth).toLocaleString(language, { month: 'long', year: 'numeric' });
  }, [selectedMonth, language]);

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      value: i,
      label: new Date(currentYear, i).toLocaleString(language, { month: 'long' }),
    }));
  }, [currentYear, language]);

  // === Fetch Data ===
  const fetchData = useCallback(async () => {
    if (!user || !['admin', 'production'].includes(user.role)) {
      toast.error(isRtl ? 'غير مصرح' : 'Unauthorized');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [ordersRes, returnsRes, inventoryRes, branchesRes] = await Promise.all([
        ordersAPI.getAll({ limit: 10000 }),
        returnsAPI.getAll({ limit: 10000 }),
        inventoryAPI.getInventory(),
        branchesAPI.getAll(),
      ]);

      const branchMap = new Map(branchesRes.map((b: any) => [b._id, isRtl ? b.name : b.nameEn || b.name]));
      const productMap = new Map(inventoryRes.map((i: any) => [
        i.product._id,
        {
          code: i.product.code,
          name: isRtl ? i.product.name : i.product.nameEn || i.product.name,
          unit: isRtl ? i.product.unit : i.product.unitEn || i.product.unit,
        }
      ]));

      const monthStart = new Date(currentYear, selectedMonth, 1);
      const monthEnd = new Date(currentYear, selectedMonth + 1, 0, 23, 59, 59);

      const orderMap = new Map<string, { orders: number; returns: number }>();
      const branchFilter = selectedBranch !== 'all' ? selectedBranch : null;

      // Process Orders
      ordersRes.forEach((order: any) => {
        const date = new Date(order.createdAt);
        if (date < monthStart || date > monthEnd) return;
        const branchName = branchMap.get(order.branch?._id) || 'Unknown';
        if (branchFilter && branchName !== branchFilter) return;

        order.items?.forEach((item: any) => {
          const pid = item.product?._id || item.productId;
          if (!pid) return;
          const key = `${pid}-${branchName}`;
          if (!orderMap.has(key)) orderMap.set(key, { orders: 0, returns: 0 });
          orderMap.get(key)!.orders += item.quantity;
        });
      });

      // Process Returns
      returnsRes.forEach((ret: any) => {
        const date = new Date(ret.createdAt);
        if (date < monthStart || date > monthEnd) return;
        const branchName = branchMap.get(ret.branch?._id) || 'Unknown';
        if (branchFilter && branchName !== branchFilter) return;

        ret.items?.forEach((item: any) => {
          const pid = item.product?._id || item.productId;
          if (!pid) return;
          const key = `${pid}-${branchName}`;
          if (!orderMap.has(key)) orderMap.set(key, { orders: 0, returns: 0 });
          orderMap.get(key)!.returns += item.quantity;
        });
      });

      const rows: ProductRow[] = [];
      for (const [key, vals] of orderMap) {
        const [pid] = key.split('-');
        const info = productMap.get(pid);
        if (!info) continue;
        const ratio = vals.orders > 0 ? (vals.returns / vals.orders) * 100 : 0;
        rows.push({
          id: pid,
          code: info.code,
          name: info.name,
          unit: info.unit,
          orders: vals.orders,
          returns: vals.returns,
          ratio,
        });
      }

      setData(rows.sort((a, b) => b.ratio - a.ratio));
      setBranches(['all', ...Array.from(branchMap.values())].filter(Boolean));
    } catch (err) {
      toast.error(isRtl ? 'فشل تحميل البيانات' : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedBranch, isRtl, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // === Filtered Data ===
  const filteredData = useMemo(() => {
    return data
      .filter(row => 
        row.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.code.includes(searchTerm)
      );
  }, [data, searchTerm]);

  const totals = useMemo(() => {
    return filteredData.reduce((acc, row) => {
      acc.orders += row.orders;
      acc.returns += row.returns;
      return acc;
    }, { orders: 0, returns: 0 });
  }, [filteredData]);

  const overallRatio = totals.orders > 0 ? (totals.returns / totals.orders) * 100 : 0;

  // === Export ===
  const exportExcel = () => {
    const headers = isRtl
      ? ['الكود', 'المنتج', 'الوحدة', 'الطلبات', 'المرتجعات', 'النسبة %']
      : ['Code', 'Product', 'Unit', 'Orders', 'Returns', 'Ratio %'];

    const rows = filteredData.map(r => [
      r.code,
      r.name,
      r.unit,
      r.orders,
      r.returns,
      r.ratio.toFixed(2) + '%',
    ]);

    rows.push(['', isRtl ? 'الإجمالي' : 'Total', '', totals.orders, totals.returns, overallRatio.toFixed(2) + '%']);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Returns_vs_Orders');
    XLSX.writeFile(wb, `Returns_vs_Orders_${monthName}.xlsx`);
    toast.success(isRtl ? 'تم التصدير' : 'Exported');
  };

  const exportPDF = () => {
    const headers = isRtl
      ? ['رقم', 'كود', 'منتج', 'وحدة', 'طلبات', 'مرتجعات', 'نسبة %']
      : ['No.', 'Code', 'Product', 'Unit', 'Orders', 'Returns', 'Ratio %'];

    const rows = filteredData.map((r, i) => [
      formatNumber(i + 1, isRtl),
      r.code,
      r.name,
      r.unit,
      formatNumber(r.orders, isRtl),
      formatNumber(r.returns, isRtl),
      r.ratio.toFixed(2) + '%',
    ]);

    rows.push(['', '', isRtl ? 'الإجمالي' : 'Total', '', formatNumber(totals.orders, isRtl), formatNumber(totals.returns, isRtl), overallRatio.toFixed(2) + '%']);

    exportToPDF(rows, headers, isRtl ? 'تقرير المرتجعات مقابل الطلبات' : 'Returns vs Orders Report', monthName, isRtl, totals.orders, totals.returns);
  };

  if (!user || !['admin', 'production'].includes(user.role)) {
    return <div className="p-8 text-center text-gray-600">{isRtl ? 'غير مصرح' : 'Unauthorized'}</div>;
  }

  return (
    <div className={`min-h-screen bg-gray-50 p-4 md:p-6 ${isRtl ? 'rtl' : 'ltr'}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto"
      >
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600" />
                {isRtl ? 'المرتجعات مقابل الطلبات' : 'Returns vs Orders'}
              </h1>
              <p className="text-sm text-gray-600 mt-1">{monthName}</p>
            </div>
            <div className="flex gap-2">
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(parseInt(e.target.value))}
                className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                {months.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <button
                onClick={exportExcel}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
              >
                <Upload className="w-4 h-4" /> Excel
              </button>
              <button
                onClick={exportPDF}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition"
              >
                <Upload className="w-4 h-4" /> PDF
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3 mt-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={isRtl ? 'بحث بالمنتج أو الكود' : 'Search product or code'}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{isRtl ? 'كل الفروع' : 'All Branches'}</option>
              {branches.filter(b => b !== 'all').map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="animate-pulse space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
            {isRtl ? 'لا توجد بيانات' : 'No data available'}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gradient-to-r from-blue-50 to-blue-100">
                  <tr>
                    <th className="px-3 py-3 text-left font-semibold text-gray-700">{isRtl ? 'الكود' : 'Code'}</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-700 min-w-[180px]">{isRtl ? 'المنتج' : 'Product'}</th>
                    <th className="px-3 py-3 text-center font-semibold text-gray-700">{isRtl ? 'طلبات' : 'Orders'}</th>
                    <th className="px-3 py-3 text-center font-semibold text-gray-700">{isRtl ? 'مرتجعات' : 'Returns'}</th>
                    <th className="px-3 py-3 text-center font-semibold text-gray-700">{isRtl ? 'نسبة %' : 'Ratio %'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredData.map((row, i) => (
                    <tr key={row.id} className="hover:bg-gray-50 transition">
                      <td className="px-3 py-3 font-mono text-gray-600">{row.code}</td>
                      <td className="px-3 py-3 text-gray-800 font-medium">{row.name}</td>
                      <td className="px-3 py-3 text-center text-gray-700">{formatNumber(row.orders, isRtl)}</td>
                      <td className="px-3 py-3 text-center text-red-600 font-medium">{formatNumber(row.returns, isRtl)}</td>
                      <td className={`px-3 py-3 text-center font-bold ${getRatioColor(row.ratio)}`}>
                        {row.ratio.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-bold text-gray-800">
                    <td colSpan={2} className="px-3 py-3 text-left">{isRtl ? 'الإجمالي' : 'Total'}</td>
                    <td className="px-3 py-3 text-center">{formatNumber(totals.orders, isRtl)}</td>
                    <td className="px-3 py-3 text-center text-red-600">{formatNumber(totals.returns, isRtl)}</td>
                    <td className={`px-3 py-3 text-center ${getRatioColor(overallRatio)}`}>
                      {overallRatio.toFixed(1)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ReturnsVsOrdersPage;