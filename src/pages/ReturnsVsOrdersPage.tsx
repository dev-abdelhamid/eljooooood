import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, X, Upload, AlertCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { ordersAPI, returnsAPI, inventoryAPI, branchesAPI } from '../services/api';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ProductRow {
  id: string;
  code: string;
  name: string;
  unit: string;
  orders: number;
  returns: number;
  ratio: number;
}

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
          code: i.product.code || '—',
          name: isRtl ? i.product.name : i.product.nameEn || i.product.name,
          unit: isRtl ? i.product.unit : i.product.unitEn || i.product.unit || 'وحدة',
        }
      ]));

      const monthStart = new Date(currentYear, selectedMonth, 1);
      const monthEnd = new Date(currentYear, selectedMonth + 1, 0, 23, 59, 59);

      const orderMap = new Map<string, { orders: number; returns: number }>();
      const branchFilter = selectedBranch !== 'all' ? selectedBranch : null;

      // Process Orders
      (ordersRes || []).forEach((order: any) => {
        const date = new Date(order.createdAt || order.date);
        if (isNaN(date.getTime()) || date < monthStart || date > monthEnd) return;
        const branchName = branchMap.get(order.branch?._id || order.branch) || (isRtl ? 'غير معروف' : 'Unknown');
        if (branchFilter && branchName !== branchFilter) return;

        (order.items || []).forEach((item: any) => {
          const pid = item.product?._id || item.productId;
          if (!pid) return;
          const key = `${pid}-${branchName}`;
          if (!orderMap.has(key)) orderMap.set(key, { orders: 0, returns: 0 });
          orderMap.get(key)!.orders += Number(item.quantity) || 0;
        });
      });

      // Process Returns
      (returnsRes?.returns || returnsRes || []).forEach((ret: any) => {
        const date = new Date(ret.createdAt);
        if (isNaN(date.getTime()) || date < monthStart || date > monthEnd) return;
        const branchName = branchMap.get(ret.branch?._id || ret.branchId) || (isRtl ? 'غير معروف' : 'Unknown');
        if (branchFilter && branchName !== branchFilter) return;

        (ret.items || []).forEach((item: any) => {
          const pid = item.product?._id || item.product;
          if (!pid) return;
          const key = `${pid}-${branchName}`;
          if (!orderMap.has(key)) orderMap.set(key, { orders: 0, returns: 0 });
          orderMap.get(key)!.returns += Number(item.quantity) || 0;
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
      setBranches(['all', ...Array.from(new Set([...branchMap.values()]))].filter(Boolean));
    } catch (err) {
      console.error(err);
      toast.error(isRtl ? 'فشل تحميل البيانات' : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedBranch, isRtl, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredData = useMemo(() => {
    return data.filter(row =>
      row.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.code.toLowerCase().includes(searchTerm.toLowerCase())
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

  // Export Excel
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
      r.ratio.toFixed(1) + '%',
    ]);

    rows.push(['', isRtl ? 'الإجمالي' : 'Total', '', totals.orders, totals.returns, overallRatio.toFixed(1) + '%']);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    if (isRtl) ws['!views'] = [{ RTL: true }];
    ws['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Returns_vs_Orders');
    XLSX.writeFile(wb, `Returns_vs_Orders_${monthName.replace(/ /g, '_')}.xlsx`);
    toast.success(isRtl ? 'تم تصدير Excel' : 'Excel exported');
  };

  // Export PDF
  const exportPDF = async () => {
    const headers = isRtl
      ? ['الكود', 'المنتج', 'الوحدة', 'الطلبات', 'المرتجعات', 'النسبة %']
      : ['Code', 'Product', 'Unit', 'Orders', 'Returns', 'Ratio %'];

    const rows = filteredData.map(r => [
      r.code,
      r.name,
      r.unit,
      formatNumber(r.orders, isRtl),
      formatNumber(r.returns, isRtl),
      r.ratio.toFixed(1) + '%',
    ]);

    rows.push(['', isRtl ? 'الإجمالي' : 'Total', '', formatNumber(totals.orders, isRtl), formatNumber(totals.returns, isRtl), overallRatio.toFixed(1) + '%']);

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const fontLoaded = await loadFont(doc);

    // Title
    doc.setFontSize(18);
    doc.setTextColor(33, 33, 33);
    doc.text(isRtl ? 'تقرير المرتجعات مقابل الطلبات' : 'Returns vs Orders Report', isRtl ? 280 : 15, 15, { align: isRtl ? 'right' : 'left' });

    // Subtitle
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const stats = isRtl
      ? `الشهر: ${monthName} | إجمالي الطلبات: ${toArabicNumerals(totals.orders)} | المرتجعات: ${toArabicNumerals(totals.returns)} | النسبة: ${overallRatio.toFixed(1)}%`
      : `${monthName} | Orders: ${totals.orders} | Returns: ${totals.returns} | Ratio: ${overallRatio.toFixed(1)}%`;
    doc.text(stats, isRtl ? 280 : 15, 22, { align: isRtl ? 'right' : 'left' });

    // Line
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.5);
    doc.line(15, 25, 282, 25);

    // Table
    autoTable(doc, {
      head: [isRtl ? headers.slice().reverse() : headers],
      body: isRtl ? rows.map(r => r.slice().reverse()) : rows,
      startY: 30,
      theme: 'grid',
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontSize: 10,
        halign: 'center',
        font: fontLoaded ? 'Amiri' : 'helvetica',
      },
      bodyStyles: {
        fontSize: 9,
        halign: 'center',
        font: fontLoaded ? 'Amiri' : 'helvetica',
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 60 },
        2: { cellWidth: 25 },
        3: { cellWidth: 30 },
        4: { cellWidth: 30 },
        5: { cellWidth: 30 },
      },
      didParseCell: (data) => {
        if (isRtl && typeof data.cell.text[0] === 'string') {
          data.cell.text[0] = data.cell.text[0].replace(/\d/g, d => toArabicNumerals(d));
        }
      },
    });

    doc.save(`Returns_vs_Orders_${monthName.replace(/ /g, '_')}.pdf`);
    toast.success(isRtl ? 'تم تصدير PDF' : 'PDF exported');
  };

  if (!user || !['admin', 'production'].includes(user.role)) {
    return (
      <div className="p-8 text-center text-gray-600">
        {isRtl ? 'غير مصرح لك بالوصول' : 'You are not authorized'}
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 p-4 md:p-6 ${isRtl ? 'rtl font-amiri' : 'ltr font-inter'}`}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto">
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
                className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {months.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <button
                onClick={exportExcel}
                disabled={loading || filteredData.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" /> {isRtl ? 'إكسل' : 'Excel'}
              </button>
              <button
                onClick={exportPDF}
                disabled={loading || filteredData.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" /> {isRtl ? 'PDF' : 'PDF'}
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
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
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
              className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">{isRtl ? 'كل الفروع' : 'All Branches'}</option>
              {branches.filter(b => b !== 'all').map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="animate-pulse space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
            {isRtl ? 'لا توجد بيانات لهذا الشهر' : 'No data available for this month'}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gradient-to-r from-blue-50 to-blue-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 min-w-[80px]">{isRtl ? 'الكود' : 'Code'}</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 min-w-[200px]">{isRtl ? 'المنتج' : 'Product'}</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700 min-w-[100px]">{isRtl ? 'الوحدة' : 'Unit'}</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700 min-w-[100px]">{isRtl ? 'الطلبات' : 'Orders'}</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700 min-w-[100px]">{isRtl ? 'المرتجعات' : 'Returns'}</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700 min-w-[100px]">{isRtl ? 'النسبة %' : 'Ratio %'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredData.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-mono text-gray-600">{row.code}</td>
                      <td className="px-4 py-3 text-gray-800 font-medium">{row.name}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{row.unit}</td>
                      <td className="px-4 py-3 text-center text-gray-700 font-medium">{formatNumber(row.orders, isRtl)}</td>
                      <td className="px-4 py-3 text-center text-red-600 font-medium">{formatNumber(row.returns, isRtl)}</td>
                      <td className={`px-4 py-3 text-center font-bold ${getRatioColor(row.ratio)}`}>
                        {row.ratio.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-bold text-gray-800 text-sm">
                    <td colSpan={3} className="px-4 py-3 text-left">{isRtl ? 'الإجمالي' : 'Total'}</td>
                    <td className="px-4 py-3 text-center">{formatNumber(totals.orders, isRtl)}</td>
                    <td className="px-4 py-3 text-center text-red-600">{formatNumber(totals.returns, isRtl)}</td>
                    <td className={`px-4 py-3 text-center ${getRatioColor(overallRatio)}`}>
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