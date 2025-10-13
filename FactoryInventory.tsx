import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/UI/Button';
import { Select } from '../components/UI/Select';
import { Input } from '../components/UI/Input';
import { Upload, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { inventoryAPI, ordersAPI, branchesAPI } from '../services/api';
import OrderTableSkeleton from '../components/Shared/OrderTableSkeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/UI/Tooltip';

interface InventoryRow {
  id: string;
  product: string;
  branchQuantities: { [branch: string]: number };
  totalQuantity: number;
}

interface Branch {
  _id: string;
  name: string;
  nameEn: string;
  displayName: string;
  isWarehouse: boolean;
}

const FactoryInventory: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [inventoryData, setInventoryData] = useState<InventoryRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'branch' | 'warehouse'>('all');
  const [selectedBranch, setSelectedBranch] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [inventoryResponse, branchesResponse] = await Promise.all([
          inventoryAPI.getInventory({}, isRtl),
          branchesAPI.getAll(),
        ]);

        const fetchedBranches = branchesResponse
          .filter((branch: any) => branch && branch._id)
          .map((branch: any) => ({
            _id: branch._id,
            name: branch.name || (isRtl ? 'غير معروف' : 'Unknown'),
            nameEn: branch.nameEn,
            displayName: isRtl ? branch.name : branch.nameEn || branch.name,
            isWarehouse: branch.isWarehouse || false, // Assume added to Branch model
          }))
          .sort((a: Branch, b: Branch) => a.displayName.localeCompare(b.displayName, language));
        setBranches(fetchedBranches);

        const inventoryMap = new Map<string, InventoryRow>();
        inventoryResponse.forEach((item: any) => {
          const product = item.productName || item.product?.name || (isRtl ? 'منتج غير معروف' : 'Unknown Product');
          const key = product;
          if (!inventoryMap.has(key)) {
            inventoryMap.set(key, {
              id: key,
              product,
              branchQuantities: {},
              totalQuantity: 0,
            });
          }
          const row = inventoryMap.get(key)!;
          const branch = item.branch?.displayName || item.branch?.name || (isRtl ? 'الفرع الرئيسي' : 'Main Branch');
          const quantity = Number(item.currentStock) || 0;
          row.branchQuantities[branch] = (row.branchQuantities[branch] || 0) + quantity;
          row.totalQuantity += quantity;
        });

        setInventoryData(Array.from(inventoryMap.values()));
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isRtl, language]);

  const filteredBranches = useMemo(() => {
    return branches.filter(b => {
      if (filterType === 'branch') return !b.isWarehouse;
      if (filterType === 'warehouse') return b.isWarehouse;
      return true;
    });
  }, [branches, filterType]);

  const filteredData = useMemo(() => {
    if (selectedBranch) {
      return inventoryData.map(row => ({
        ...row,
        branchQuantities: { [selectedBranch]: row.branchQuantities[selectedBranch] || 0 },
        totalQuantity: row.branchQuantities[selectedBranch] || 0,
      }));
    }
    return inventoryData;
  }, [inventoryData, selectedBranch]);

  const allBranches = useMemo(() => {
    const branchesSet = new Set<string>();
    inventoryData.forEach(row => {
      Object.keys(row.branchQuantities).forEach(branch => branchesSet.add(branch));
    });
    return Array.from(branchesSet).sort();
  }, [inventoryData]);

  const renderInventoryTable = useCallback(
    (data: InventoryRow[], title: string) => {
      const totalQuantities = allBranches.reduce((acc, branch) => {
        acc[branch] = data.reduce((sum, row) => sum + (row.branchQuantities[branch] || 0), 0);
        return acc;
      }, {} as { [branch: string]: number });
      const grandTotalQuantity = data.reduce((sum, row) => sum + row.totalQuantity, 0);

      const exportTable = (format: 'excel' | 'pdf') => {
        const headers = [
          isRtl ? 'المنتج' : 'Product',
          ...allBranches,
          isRtl ? 'الكمية الإجمالية' : 'Total Quantity',
        ];
        const rows = [
          ...data.map(row => ({
            product: row.product,
            ...allBranches.reduce((acc, branch) => {
              acc[branch] = row.branchQuantities[branch] || 0;
              return acc;
            }, {} as { [key: string]: number }),
            totalQuantity: row.totalQuantity,
          })),
          {
            product: isRtl ? 'الإجمالي' : 'Total',
            ...allBranches.reduce((acc, branch) => {
              acc[branch] = totalQuantities[branch] || 0;
              return acc;
            }, {} as { [key: string]: number }),
            totalQuantity: grandTotalQuantity,
          },
        ];

        if (format === 'excel') {
          const ws = XLSX.utils.json_to_sheet(isRtl ? rows.map(row => Object.fromEntries(Object.entries(row).reverse())) : rows, { header: headers });
          if (isRtl) ws['!views'] = [{ RTL: true }];
          ws['!cols'] = [{ wch: 20 }, ...allBranches.map(() => ({ wch: 15 })), { wch: 15 }];
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, title);
          XLSX.writeFile(wb, `${title}.xlsx`);
        } else if (format === 'pdf') {
          const doc = new jsPDF();
          doc.autoTable({
            head: [headers],
            body: rows.map(row => [
              row.product,
              ...allBranches.map(branch => row[branch]),
              row.totalQuantity,
            ]),
            styles: { font: isRtl ? 'Amiri' : 'Helvetica', halign: isRtl ? 'right' : 'left', fontSize: 10 },
            headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontSize: 10 },
            bodyStyles: { fontSize: 9 },
            footStyles: { fillColor: [240, 240, 240], fontSize: 10, fontStyle: 'bold' },
          });
          doc.save(`${title}.pdf`);
        }
      };

      if (loading) return <OrderTableSkeleton isRtl={isRtl} />;
      if (data.length === 0) {
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-center py-12 bg-white shadow-sm rounded-lg border border-gray-100"
          >
            <p className="text-gray-500 text-sm font-medium">{isRtl ? 'لا توجد بيانات' : 'No data available'}</p>
          </motion.div>
        );
      }

      return (
        <div className="mb-8">
          <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={() => exportTable('excel')}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white"
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير إكسل' : 'Export Excel'}
              </Button>
              <Button
                variant="primary"
                onClick={() => exportTable('pdf')}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium bg-green-500 hover:bg-green-600 text-white"
              >
                <Upload className="w-4 h-4" />
                {isRtl ? 'تصدير PDF' : 'Export PDF'}
              </Button>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="overflow-x-auto rounded-lg shadow-sm border border-gray-100 bg-white"
          >
            <table className="min-w-full divide-y divide-gray-100 text-xs">
              <thead className="bg-blue-50 sticky top-0">
                <tr className={isRtl ? 'flex-row-reverse' : ''}>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[120px]">{isRtl ? 'المنتج' : 'Product'}</th>
                  {allBranches.map(branch => (
                    <th key={branch} className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[100px]">
                      {branch}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[100px]">
                    {isRtl ? 'الكمية الإجمالية' : 'Total Quantity'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map(row => (
                  <tr key={row.id} className={`hover:bg-blue-50/50 transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <td className="px-3 py-2 text-gray-700 text-center truncate">{row.product}</td>
                    {allBranches.map(branch => (
                      <td key={branch} className="px-3 py-2 text-gray-700 text-center">
                        {row.branchQuantities[branch] || 0}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-gray-700 text-center font-medium">{row.totalQuantity}</td>
                  </tr>
                ))}
                <tr className={`font-semibold bg-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <td className="px-3 py-2 text-gray-800 text-center">{isRtl ? 'الإجمالي' : 'Total'}</td>
                  {allBranches.map(branch => (
                    <td key={branch} className="px-3 py-2 text-gray-800 text-center">
                      {totalQuantities[branch] || 0}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-gray-800 text-center">{grandTotalQuantity}</td>
                </tr>
              </tbody>
            </table>
          </motion.div>
        </div>
      );
    },
    [loading, isRtl, allBranches]
  );

  return (
    <div className={`px-4 py-6 min-h-screen ${isRtl ? 'rtl font-amiri' : 'ltr font-inter'} bg-gray-50`}>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{isRtl ? 'المخزون الكامل للمصنع' : 'Full Factory Inventory'}</h1>
      <div className="mb-6">
        <div className="flex flex-wrap gap-2 mb-4">
          <Select
            options={[
              { value: 'all', label: isRtl ? 'الكل' : 'All' },
              { value: 'branch', label: isRtl ? 'فروع' : 'Branches' },
              { value: 'warehouse', label: isRtl ? 'مستودعات' : 'Warehouses' },
            ]}
            value={filterType}
            onChange={(value) => setFilterType(value as 'all' | 'branch' | 'warehouse')}
            className="w-full sm:w-auto"
          />
          <Select
            options={filteredBranches.map(b => ({ value: b._id, label: b.displayName }))}
            value={selectedBranch}
            onChange={(value) => setSelectedBranch(value)}
            className="w-full sm:w-auto"
          />
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key="inventory" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          {renderInventoryTable(filteredData, isRtl ? 'تقرير المخزون الكامل' : 'Full Inventory Report')}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default FactoryInventory;