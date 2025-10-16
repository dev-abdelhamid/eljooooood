import React from 'react';
import { Button } from '../components/UI/Button';
import { Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';
import { Tooltip } from 'react-tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { formatNumber, toArabicNumerals, generatePDFHeader, generatePDFTable, loadFont, generateFileName } from './ProductionReport';

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

interface OrdersVsReturnsTableProps {
  data: OrdersVsReturnsRow[];
  isRtl: boolean;
  daysInMonth: string[];
  monthName: string;
}

export const generatePDFTable = (
  doc: jsPDF,
  data: any[][],
  headers: string[],
  isRtl: boolean,
  totalItems: number,
  totalQuantity: number,
  totalPrice: number,
  month: string,
  title: string,
) => {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  doc.setFont(isRtl ? 'Amiri' : 'Helvetica', 'normal');
  generatePDFHeader(doc, title, month, isRtl, totalItems, totalQuantity, totalPrice);
  (doc as any).autoTable({
    head: [headers],
    body: data,
    startY: 60,
    theme: 'grid',
    headStyles: {
      fillColor: [255, 193, 7],
      textColor: [0, 0, 0],
      fontSize: 10,
      font: isRtl ? 'Amiri' : 'Helvetica',
      halign: isRtl ? 'right' : 'left',
    },
    bodyStyles: {
      fontSize: 9,
      font: isRtl ? 'Amiri' : 'Helvetica',
      halign: isRtl ? 'right' : 'left',
      textColor: [51, 51, 51],
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: { top: 60, left: isRtl ? 10 : 10, right: isRtl ? 10 : 10 },
    didDrawPage: (data: any) => {
      const pageNumber = doc.getCurrentPageInfo().pageNumber;
      doc.setFontSize(10);
      const pageText = isRtl ? `صفحة ${toArabicNumerals(pageNumber)}` : `Page ${pageNumber}`;
      const pageTextWidth = doc.getTextWidth(pageText);
      doc.text(pageText, isRtl ? pageWidth - 10 - pageTextWidth : 10, pageHeight - 10);
    },
  });
};

const OrdersVsReturnsTable: React.FC<OrdersVsReturnsTableProps> = ({ data, isRtl, daysInMonth, monthName }) => {
  const grandTotalOrders = data.reduce((sum, row) => sum + row.totalOrders, 0);
  const grandTotalReturns = data.reduce((sum, row) => sum + row.totalReturns, 0);
  const grandTotalRatio = grandTotalOrders > 0 ? (grandTotalReturns / grandTotalOrders * 100).toFixed(2) : '0.00';

  const exportTable = async (format: 'excel' | 'pdf') => {
    const baseHeaders = [
      isRtl ? 'رقم' : 'No.',
      isRtl ? 'الكود' : 'Code',
      isRtl ? 'المنتج' : 'Product',
      isRtl ? 'وحدة المنتج' : 'Product Unit',
    ];
    const dayHeaders = daysInMonth.flatMap(day => [
      isRtl ? `${day} - طلبات` : `${day} - Orders`,
      isRtl ? `${day} - مرتجعات` : `${day} - Returns`,
      isRtl ? `${day} - نسبة %` : `${day} - Ratio %`,
    ]);
    const totalHeaders = [
      isRtl ? 'إجمالي الطلبات' : 'Total Orders',
      isRtl ? 'إجمالي المرتجعات' : 'Total Returns',
      isRtl ? 'نسبة إجمالية %' : 'Total Ratio %',
    ];
    const headers = [...baseHeaders, ...dayHeaders, ...totalHeaders];
    const rows = [
      ...data.map((row, index) => ({
        no: index + 1,
        code: row.code,
        product: row.product,
        unit: row.unit,
        ...Object.fromEntries(
          daysInMonth.flatMap((day, i) => [
            [`${day} - ${isRtl ? 'طلبات' : 'Orders'}`, row.dailyOrders[i]],
            [`${day} - ${isRtl ? 'مرتجعات' : 'Returns'}`, row.dailyReturns[i]],
            [`${day} - ${isRtl ? 'نسبة %' : 'Ratio %'}`, row.dailyOrders[i] > 0 ? ((row.dailyReturns[i] / row.dailyOrders[i]) * 100).toFixed(2) : '0.00'],
          ])
        ),
        totalOrders: row.totalOrders,
        totalReturns: row.totalReturns,
        totalRatio: row.totalRatio.toFixed(2),
      })),
      {
        no: '',
        code: '',
        product: isRtl ? 'الإجمالي' : 'Total',
        unit: '',
        ...Object.fromEntries(
          daysInMonth.flatMap((day, i) => [
            [`${day} - ${isRtl ? 'طلبات' : 'Orders'}`, data.reduce((sum, row) => sum + row.dailyOrders[i], 0)],
            [`${day} - ${isRtl ? 'مرتجعات' : 'Returns'}`, data.reduce((sum, row) => sum + row.dailyReturns[i], 0)],
            [`${day} - ${isRtl ? 'نسبة %' : 'Ratio %'}`, (data.reduce((sum, row) => sum + row.dailyOrders[i], 0) > 0) ? ((data.reduce((sum, row) => sum + row.dailyReturns[i], 0) / data.reduce((sum, row) => sum + row.dailyOrders[i], 0)) * 100).toFixed(2) : '0.00'],
          ])
        ),
        totalOrders: grandTotalOrders,
        totalReturns: grandTotalReturns,
        totalRatio: grandTotalRatio,
      },
    ];
    const dataRows = rows.map(row => [
      row.no,
      row.code,
      row.product,
      row.unit,
      ...dayHeaders.map(header => row[header]),
      row.totalOrders,
      row.totalReturns,
      `${row.totalRatio}%`,
    ]);

    if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows, { header: headers });
      if (isRtl) ws['!views'] = [{ RTL: true }];
      ws['!cols'] = [{ wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, ...dayHeaders.map(() => ({ wch: 12 })), { wch: 15 }, { wch: 15 }, { wch: 15 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `OrdersVsReturns_${monthName}`);
      XLSX.writeFile(wb, `OrdersVsReturns_${monthName}.xlsx`);
      toast.success(isRtl ? 'تم تصدير ملف Excel بنجاح' : 'Excel exported successfully', {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    } else if (format === 'pdf') {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const fontName = 'Amiri';
      const fontLoaded = await loadFont(doc);
      generatePDFHeader(doc, isRtl, isRtl ? 'تقرير الطلبات مقابل المرتجعات' : 'Orders vs Returns Report', monthName, data.length, grandTotalOrders, grandTotalReturns, fontName, fontLoaded);
      generatePDFTable(doc, headers, dataRows, isRtl, fontLoaded, fontName, []);
      const fileName = generateFileName(isRtl ? 'تقرير الطلبات مقابل المرتجعات' : 'Orders vs Returns Report', monthName, isRtl);
      doc.save(fileName);
      toast.success(isRtl ? 'تم تصدير ملف PDF بنجاح' : 'PDF exported successfully', {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    }
  };

  if (data.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="text-center py-12 bg-white shadow-xl rounded-2xl border border-gray-200"
      >
        <p className="text-gray-500 text-sm font-medium">{isRtl ? 'لا توجد بيانات' : 'No data available'}</p>
      </motion.div>
    );
  }

  return (
    <div className="mb-8">
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
        <h2 className="text-lg font-semibold text-gray-800">{isRtl ? `تقرير الطلبات مقابل المرتجعات - ${monthName}` : `Orders vs Returns Report - ${monthName}`}</h2>
        <div className="flex gap-2">
          <Button
            variant="primary"
            onClick={() => exportTable('excel')}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all duration-200"
          >
            <Upload className="w-4 h-4" />
            {isRtl ? 'تصدير إكسل' : 'Export Excel'}
          </Button>
          <Button
            variant="primary"
            onClick={() => exportTable('pdf')}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium bg-green-600 hover:bg-green-700 text-white shadow-sm transition-all duration-200"
          >
            <Upload className="w-4 h-4" />
            {isRtl ? 'تصدير PDF' : 'Export PDF'}
          </Button>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-x-auto rounded-2xl shadow-xl border border-gray-200 bg-white"
      >
        <table className="min-w-full divide-y divide-gray-200 text-xs">
          <thead className="bg-blue-50 sticky top-0">
            <tr className={isRtl ? 'flex-row-reverse' : ''}>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[40px]">{isRtl ? 'رقم' : 'No.'}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'الكود' : 'Code'}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[120px]">{isRtl ? 'المنتج' : 'Product'}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'وحدة المنتج' : 'Product Unit'}</th>
              {daysInMonth.map((day, i) => (
                <React.Fragment key={i}>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">
                    {isRtl ? `${day} - طلبات` : `${day} - Orders`}
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">
                    {isRtl ? `${day} - مرتجعات` : `${day} - Returns`}
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">
                    {isRtl ? `${day} - نسبة %` : `${day} - Ratio %`}
                  </th>
                </React.Fragment>
              ))}
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">{isRtl ? 'إجمالي الطلبات' : 'Total Orders'}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">{isRtl ? 'إجمالي المرتجعات' : 'Total Returns'}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">{isRtl ? 'نسبة إجمالية %' : 'Total Ratio %'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((row, index) => (
              <tr key={row.id} className={`hover:bg-blue-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <td className="px-4 py-3 text-gray-700 text-center">{formatNumber(index + 1, isRtl)}</td>
                <td className="px-4 py-3 text-gray-700 text-center truncate">{row.code}</td>
                <td className="px-4 py-3 text-gray-700 text-center truncate">{row.product}</td>
                <td className="px-4 py-3 text-gray-700 text-center truncate">{row.unit}</td>
                {daysInMonth.map((day, i) => (
                  <React.Fragment key={i}>
                    <td
                      className={`px-4 py-3 text-center font-medium ${
                        row.dailyOrders[i] !== 0 ? 'bg-green-50 text-green-700' : 'text-gray-700'
                      }`}
                      data-tooltip-id="orders-tooltip"
                      data-tooltip-content={`${isRtl ? 'الطلبات' : 'Orders'}: ${formatNumber(row.dailyOrders[i], isRtl)}`}
                    >
                      {row.dailyOrders[i] !== 0 ? formatNumber(row.dailyOrders[i], isRtl) : '0'}
                    </td>
                    <td
                      className={`px-4 py-3 text-center font-medium ${
                        row.dailyReturns[i] !== 0 ? 'bg-red-50 text-red-700' : 'text-gray-700'
                      }`}
                      data-tooltip-id="returns-tooltip"
                      data-tooltip-content={`${isRtl ? 'المرتجعات' : 'Returns'}: ${formatNumber(row.dailyReturns[i], isRtl)}`}
                    >
                      {row.dailyReturns[i] !== 0 ? formatNumber(row.dailyReturns[i], isRtl) : '0'}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-blue-700">
                      {row.dailyOrders[i] > 0 ? `${formatNumber((row.dailyReturns[i] / row.dailyOrders[i] * 100).toFixed(2), isRtl)}%` : '0.00%'}
                    </td>
                  </React.Fragment>
                ))}
                <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalOrders, isRtl)}</td>
                <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalReturns, isRtl)}</td>
                <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.totalRatio.toFixed(2), isRtl)}%</td>
              </tr>
            ))}
            <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <td className="px-4 py-3 text-gray-800 text-center" colSpan={4}>{isRtl ? 'الإجمالي' : 'Total'}</td>
              {daysInMonth.map((_, i) => (
                <React.Fragment key={i}>
                  <td className="px-4 py-3 text-gray-800 text-center">
                    {formatNumber(data.reduce((sum, row) => sum + row.dailyOrders[i], 0), isRtl)}
                  </td>
                  <td className="px-4 py-3 text-gray-800 text-center">
                    {formatNumber(data.reduce((sum, row) => sum + row.dailyReturns[i], 0), isRtl)}
                  </td>
                  <td className="px-4 py-3 text-gray-800 text-center">
                    {data.reduce((sum, row) => sum + row.dailyOrders[i], 0) > 0
                      ? `${formatNumber((data.reduce((sum, row) => sum + row.dailyReturns[i], 0) / data.reduce((sum, row) => sum + row.dailyOrders[i], 0) * 100).toFixed(2), isRtl)}%`
                      : '0.00%'}
                  </td>
                </React.Fragment>
              ))}
              <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalOrders, isRtl)}</td>
              <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalReturns, isRtl)}</td>
              <td className="px-4 py-3 text-gray-800 text-center">{grandTotalRatio}%</td>
            </tr>
          </tbody>
        </table>
        <Tooltip id="orders-tooltip" place="top" effect="solid" className="custom-tooltip text-sm bg-gray-800 text-white rounded-lg p-2" />
        <Tooltip id="returns-tooltip" place="top" effect="solid" className="custom-tooltip text-sm bg-gray-800 text-white rounded-lg p-2" />
      </motion.div>
    </div>
  );
};

export default OrdersVsReturnsTable;
