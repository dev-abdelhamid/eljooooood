import React, { useState } from 'react';
import { Button } from '../components/UI/Button';
import { Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';
import { Tooltip } from 'react-tooltip';
import { ProductSearchInput, ProductDropdown } from './NewOrder';
import { motion } from 'framer-motion';
import { formatPrice, formatNumber, toArabicNumerals, generatePDFHeader, loadFont, generateFileName } from './ProductionReport';

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

interface OrdersTableProps {
  data: OrderRow[];
  isRtl: boolean;
  branches: string[];
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

const OrdersTable: React.FC<OrdersTableProps> = ({ data, isRtl, branches, monthName }) => {
  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');

  const filteredData = data.filter(
    row =>
      row.product.toLowerCase().includes(search.toLowerCase()) &&
      (selectedBranch === 'all' || row.branchQuantities[selectedBranch])
  );

  const totalQuantities = branches.reduce((acc, branch) => {
    acc[branch] = filteredData.reduce((sum, row) => sum + (row.branchQuantities[branch] || 0), 0);
    return acc;
  }, {} as { [branch: string]: number });
  const grandTotalQuantity = filteredData.reduce((sum, row) => sum + row.totalQuantity, 0);
  const grandTotalPrice = filteredData.reduce((sum, row) => sum + row.totalPrice, 0);
  const grandActualSales = filteredData.reduce((sum, row) => sum + row.actualSales, 0);

  const exportTable = async (format: 'excel' | 'pdf') => {
    const headers = [
      isRtl ? 'الكود' : 'Code',
      isRtl ? 'المنتج' : 'Product',
      isRtl ? 'وحدة المنتج' : 'Product Unit',
      ...branches,
      isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
      isRtl ? 'المبيعات الفعلية' : 'Actual Sales',
      isRtl ? 'السعر الإجمالي' : 'Total Price',
      isRtl ? 'نسبة المبيعات %' : 'Sales Percentage %',
    ];
    const rows = [
      ...filteredData.map(row => ({
        code: row.code,
        product: row.product,
        unit: row.unit,
        ...Object.fromEntries(branches.map(branch => [branch, row.branchQuantities[branch] || 0])),
        totalQuantity: row.totalQuantity,
        actualSales: row.actualSales,
        totalPrice: formatPrice(row.totalPrice, isRtl),
        salesPercentage: row.totalQuantity > 0 ? ((row.actualSales / row.totalQuantity) * 100).toFixed(2) : '0.00',
      })),
      {
        code: '',
        product: isRtl ? 'الإجمالي' : 'Total',
        unit: '',
        ...Object.fromEntries(branches.map(branch => [branch, totalQuantities[branch] || 0])),
        totalQuantity: grandTotalQuantity,
        actualSales: grandActualSales,
        totalPrice: formatPrice(grandTotalPrice, isRtl),
        salesPercentage: grandTotalQuantity > 0 ? ((grandActualSales / grandTotalQuantity) * 100).toFixed(2) : '0.00',
      },
    ];
    const dataRows = rows.map(row => [
      row.code,
      row.product,
      row.unit,
      ...branches.map(branch => row[branch]),
      row.totalQuantity,
      row.actualSales,
      row.totalPrice,
      `${row.salesPercentage}%`,
    ]);

    if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows, { header: headers });
      if (isRtl) ws['!views'] = [{ RTL: true }];
      ws['!cols'] = [
        { wch: 15 },
        { wch: 25 },
        { wch: 15 },
        ...branches.map(() => ({ wch: 15 })),
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Orders_${monthName}`);
      XLSX.writeFile(wb, `Orders_${monthName}.xlsx`);
      toast.success(isRtl ? 'تم تصدير ملف Excel بنجاح' : 'Excel exported successfully', {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    } else if (format === 'pdf') {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const fontName = 'Amiri';
      const fontLoaded = await loadFont(doc);
      generatePDFHeader(doc, isRtl, isRtl ? 'تقرير الطلبات' : 'Orders Report', monthName, filteredData.length, grandTotalQuantity, grandTotalPrice, fontName, fontLoaded);
      generatePDFTable(doc, headers, dataRows, isRtl, fontLoaded, fontName, branches);
      const fileName = generateFileName(isRtl ? 'تقرير الطلبات' : 'Orders Report', monthName, isRtl);
      doc.save(fileName);
      toast.success(isRtl ? 'تم تصدير ملف PDF بنجاح' : 'PDF exported successfully', {
        position: isRtl ? 'top-left' : 'top-right',
        autoClose: 3000,
      });
    }
  };

  if (filteredData.length === 0) {
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
        <h2 className="text-lg font-semibold text-gray-800">{isRtl ? `تقرير الطلبات - ${monthName}` : `Orders Report - ${monthName}`}</h2>
        <div className="flex gap-4">
          <ProductSearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isRtl ? 'بحث عن منتج' : 'Search product'}
            ariaLabel="Search product"
          />
          <ProductDropdown
            value={selectedBranch}
            onChange={setSelectedBranch}
            options={[{ value: 'all', label: isRtl ? 'كل الفروع' : 'All Branches' }, ...branches.map(b => ({ value: b, label: b }))]}
            ariaLabel="Select branch"
          />
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
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'الكود' : 'Code'}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[120px]">{isRtl ? 'المنتج' : 'Product'}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">{isRtl ? 'وحدة المنتج' : 'Product Unit'}</th>
              {branches.map(branch => (
                <th key={branch} className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">
                  {branch}
                </th>
              ))}
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">{isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">{isRtl ? 'المبيعات الفعلية' : 'Actual Sales'}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">{isRtl ? 'السعر الإجمالي' : 'Total Price'}</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[100px]">{isRtl ? 'نسبة المبيعات %' : 'Sales Percentage %'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredData.map(row => (
              <tr key={row.id} className={`hover:bg-blue-50 transition-colors duration-200 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <td className="px-4 py-3 text-gray-700 text-center truncate">{row.code}</td>
                <td className="px-4 py-3 text-gray-700 text-center truncate">{row.product}</td>
                <td className="px-4 py-3 text-gray-700 text-center truncate">{row.unit}</td>
                {branches.map(branch => (
                  <td
                    key={branch}
                    className={`px-4 py-3 text-center font-medium ${
                      row.branchQuantities[branch] > 0 ? 'bg-green-50 text-green-700' : row.branchQuantities[branch] < 0 ? 'bg-red-50 text-red-700' : 'text-gray-700'
                    }`}
                    data-tooltip-id="branch-quantity"
                    data-tooltip-content={`${isRtl ? 'الكمية في ' : 'Quantity in '} ${branch}: ${formatNumber(row.branchQuantities[branch] || 0, isRtl)}`}
                  >
                    {formatNumber(row.branchQuantities[branch] || 0, isRtl)}
                  </td>
                ))}
                <td
                  className="px-4 py-3 text-gray-700 text-center font-medium"
                  data-tooltip-id="total-quantity"
                  data-tooltip-content={`${isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}: ${formatNumber(row.totalQuantity, isRtl)}\n${Object.entries(row.branchQuantities)
                    .map(([branch, qty]) => `${branch}: ${formatNumber(qty, isRtl)}`)
                    .join('\n')}`}
                >
                  {formatNumber(row.totalQuantity, isRtl)}
                </td>
                <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatNumber(row.actualSales, isRtl)}</td>
                <td className="px-4 py-3 text-gray-700 text-center font-medium">{formatPrice(row.totalPrice, isRtl)}</td>
                <td className="px-4 py-3 text-gray-700 text-center font-medium">
                  {formatNumber(row.totalQuantity > 0 ? ((row.actualSales / row.totalQuantity) * 100).toFixed(2) : '0.00', isRtl)}%
                </td>
              </tr>
            ))}
            <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <td className="px-4 py-3 text-gray-800 text-center"></td>
              <td className="px-4 py-3 text-gray-800 text-center">{isRtl ? 'الإجمالي' : 'Total'}</td>
              <td className="px-4 py-3 text-gray-800 text-center"></td>
              {branches.map(branch => (
                <td key={branch} className="px-4 py-3 text-gray-800 text-center">
                  {formatNumber(totalQuantities[branch] || 0, isRtl)}
                </td>
              ))}
              <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandTotalQuantity, isRtl)}</td>
              <td className="px-4 py-3 text-gray-800 text-center">{formatNumber(grandActualSales, isRtl)}</td>
              <td className="px-4 py-3 text-gray-800 text-center">{formatPrice(grandTotalPrice, isRtl)}</td>
              <td className="px-4 py-3 text-gray-800 text-center">
                {formatNumber(grandTotalQuantity > 0 ? ((grandActualSales / grandTotalQuantity) * 100).toFixed(2) : '0.00', isRtl)}%
              </td>
            </tr>
          </tbody>
        </table>
        <Tooltip id="branch-quantity" place="top" effect="solid" className="custom-tooltip text-sm bg-gray-800 text-white rounded-lg p-2" />
        <Tooltip id="total-quantity" place="top" effect="solid" className="custom-tooltip text-sm bg-gray-800 text-white rounded-lg p-2" />
      </motion.div>
    </div>
  );
};

export default OrdersTable;
