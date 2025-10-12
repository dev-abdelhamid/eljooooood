import React, { useState, useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
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
  const [loading, setLoading] = useState(false);

  // Hardcoded data from the Excel file (Sheet 1: "ورقة1") for Daily Production
  const productionData = useMemo(() => [
    { product: 'فطاير عادي', quantities: [88, 90, 120, 155, 510, 60, 76, 75, 90, 132, 110, 70, 72, 72, 77, 72, 112, 100, 60, 70, 66, 60, 54, 90, 90, 62, 66, 68, 80, 98, 104], total: 2945 },
    { product: 'فطائر حبة ريال', quantities: [60, 67, 76, 46, 17, 85, 86, 56, 72, 66, 36, 42, 56, 26, 57, 30, 50, 47, 30, 70, 52, 30, 26, 32, 30, 55, 26, 30, 40, 32, 36], total: 1428 },
    { product: 'ورق عنب بارد', quantities: [360, 1800, 0, 0, 0, 0, 2700, 0, 2700, 0, 0, 1800, 2700, 0, 2700, 0, 0, 0, 1800, 1800, 2700, 0, 0, 0, 0, 0, 2700, 0, 2700, 0, 0], total: 26460 },
    { product: 'ورق عنب حار', quantities: [0, 1800, 0, 0, 0, 1800, 0, 2700, 0, 0, 0, 0, 0, 2700, 0, 2700, 0, 0, 0, 0, 0, 2700, 2700, 0, 0, 0, 0, 2700, 0, 2700, 0], total: 22500 },
    { product: 'كفته', quantities: [4, 4, 4, 7, 0, 4, 3.5, 3.5, 4, 4.5, 4, 4, 3, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 4.5, 2, 3.5, 3.5, 4, 3.5, 3, 3, 3.5, 3, 3.5, 4], total: 107.5 },
    { product: 'كفته أصابع', quantities: [4, 4, 4, 7, 0, 4, 3.5, 3.5, 4, 4.5, 4, 4, 3, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 4.5, 2, 3.5, 3.5, 4, 3.5, 3, 3, 3.5, 3, 3.5, 4], total: 107.5 },
    { product: 'مسخن', quantities: [10, 12, 17, 7, 1, 10, 10, 9, 10, 17, 13, 7, 12, 6, 10, 9, 14, 14, 8, 9, 9, 7, 9, 18, 12, 9, 10, 10, 11, 12, 17], total: 329 },
    { product: 'فطاير ميني (بالكيلو)', quantities: [34, 34, 53, 66, 135, 14, 33, 29, 30, 42, 42, 24, 25, 24, 26, 30, 44, 35, 26, 27, 28, 28, 30, 36, 38, 28, 27, 28, 30, 35, 45], total: 1081 },
    { product: 'ميني برجر', quantities: [11, 10, 15, 15, 0, 10, 14, 11, 12, 13, 10, 10, 11, 11, 12, 11, 13, 13, 11, 12, 11, 10, 10, 12, 12, 11, 10, 11, 13, 12, 13], total: 337 },
    { product: 'خلية حبة بركه', quantities: [8, 10, 11, 14, 16, 10, 8, 11, 13, 14, 12, 10, 10, 10, 8, 10, 12, 13, 11, 11, 8, 7, 8, 13, 8, 12, 10, 9, 11, 9, 13], total: 317 },
    { product: 'خلية قرفة', quantities: [8, 10, 12, 14, 16, 10, 7, 9, 10, 10, 12, 9, 5, 9, 7, 9, 8, 10, 7, 10, 7, 7, 8, 11, 8, 9, 8, 6, 9, 6, 10], total: 271 },
    // Additional products can be added as needed; truncated for brevity
  ], []);

  const tableHeaders = useMemo(() => [
    { key: 'no', label: isRtl ? 'رقم' : 'No.', className: 'text-center min-w-[40px]' },
    { key: 'product', label: isRtl ? 'المنتج' : 'Product', className: 'text-center min-w-[100px]' },
    ...Array.from({ length: 31 }, (_, i) => ({
      key: `day${i + 1}`,
      label: (i + 1).toString(),
      className: 'text-center min-w-[40px]',
    })),
    { key: 'total', label: isRtl ? 'المجموع' : 'Total', className: 'text-center min-w-[80px]' },
  ], [isRtl]);

  const rows = useMemo(() => {
    return productionData.map((item, index) => ({
      no: index + 1,
      product: item.product,
      ...Object.fromEntries(
        Array.from({ length: 31 }, (_, i) => [`day${i + 1}`, item.quantities[i] || 0])
      ),
      total: item.total,
    }));
  }, [productionData]);

  const exportTable = useCallback((rows, headers, fileName, format) => {
    if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(rows.map(row => {
        const newRow = { [isRtl ? 'المنتج' : 'Product']: row.product };
        headers.forEach(h => {
          if (h.key !== 'no' && h.key !== 'product') newRow[h.label] = row[h.key];
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
  }, [isRtl]);

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
                  <Skeleton width={40} height={14} baseColor="#f3f4f6" highlightColor="#e5e7eb" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  );

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
            {isRtl ? 'تقرير الإنتاج اليومي' : 'Daily Production Report'}
          </h1>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={rows.length > 0 ? 'primary' : 'secondary'}
              onClick={rows.length > 0 ? () => exportTable(rows, tableHeaders, 'production_report', 'excel') : undefined}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm shadow-sm ${
                rows.length > 0 ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'
              }`}
              disabled={rows.length === 0}
            >
              <Upload className="w-5 h-5" />
              {isRtl ? 'تصدير إكسل' : 'Export Excel'}
            </Button>
            <Button
              variant={rows.length > 0 ? 'primary' : 'secondary'}
              onClick={rows.length > 0 ? () => exportTable(rows, tableHeaders, 'production_report', 'pdf') : undefined}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm shadow-sm ${
                rows.length > 0 ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'
              }`}
              disabled={rows.length === 0}
            >
              <Upload className="w-5 h-5" />
              {isRtl ? 'تصدير PDF' : 'Export PDF'}
            </Button>
          </div>
        </div>
        {loading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
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
                {rows.map((row) => (
                  <tr key={row.product} className={`hover:bg-gray-50 transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
                    {tableHeaders.map((header) => (
                      <td
                        key={header.key}
                        className={`px-2 py-2 text-gray-600 text-center whitespace-nowrap ${header.className}`}
                      >
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