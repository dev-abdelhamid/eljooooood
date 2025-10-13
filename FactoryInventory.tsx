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

interface OrderRow {
  id: string;
  product: string;
  branchQuantities: { [branch: string]: number };
  totalQuantity: number;
  totalPrice: number;
}

interface StockRow {
  id: string;
  product: string;
  totalQuantity: number;
  dailyQuantities: number[];
  changes: number[];
  totalPrice: number;
}

interface SalesRow {
  id: string;
  product: string;
  totalQuantity: number;
  dailyQuantities: number[];
  changes: number[];
  totalPrice: number;
}

interface ReturnRow {
  id: string;
  product: string;
  totalQuantity: number;
  dailyQuantities: number[];
  changes: number[];
  totalPrice: number;
}

interface InventoryRow {
  id: string;
  product: string;
  branchQuantities: { [branch: string]: number };
  totalQuantity: number;
}

interface ProductionRequest {
  _id: string;
  type: 'branch' | 'production';
  branchName: string;
  status: string;
  items: { productName: string; quantity: number }[];
  createdBy: string;
  approvedBy: string;
  deliveredBy: string;
  createdAt: string;
  notes: string;
  assignedChef: string;
}

interface Branch {
  _id: string;
  name: string;
  nameEn: string;
  displayName: string;
}

const ProductionInventory: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [inventoryData, setInventoryData] = useState<InventoryRow[]>([]);
  const [productionRequests, setProductionRequests] = useState<ProductionRequest[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'branch' | 'production'>('all');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedType, setSelectedType] = useState<'branch' | 'production'>('branch');
  const [isCreateRequestModalOpen, setIsCreateRequestModalOpen] = useState(false);
  const [requestItems, setRequestItems] = useState([{ productId: '', quantity: 1 }]);
  const [selectedRequest, setSelectedRequest] = useState<ProductionRequest | null>(null);
  const [isAssignChefModalOpen, setIsAssignChefModalOpen] = useState(false);
  const [chefId, setChefId] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [inventoryResponse, branchesResponse, productionRequestsResponse] = await Promise.all([
          inventoryAPI.getFactoryInventory({ lang: language }),
          branchesAPI.getAll(),
          inventoryAPI.getProductionRequests({ lang: language }),
        ]);

        const fetchedBranches = branchesResponse
          .filter((branch) => branch && branch._id)
          .map((branch) => ({
            _id: branch._id,
            name: branch.name || (isRtl ? 'غير معروف' : 'Unknown'),
            nameEn: branch.nameEn,
            displayName: isRtl ? branch.name : branch.nameEn || branch.name,
          }))
          .sort((a, b) => a.displayName.localeCompare(b.displayName, language));
        setBranches(fetchedBranches);

        setInventoryData(inventoryResponse.inventory || []);
        setProductionRequests(productionRequestsResponse.requests || []);
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
      if (filterType === 'branch') return true;
      return true;
    });
  }, [branches, filterType]);

  const filteredData = useMemo(() => {
    if (selectedBranch) {
      return inventoryData.map((row) => ({
        ...row,
        branchQuantities: { [selectedBranch]: row.branchQuantities[selectedBranch] || 0 },
        totalQuantity: row.branchQuantities[selectedBranch] || 0,
      }));
    }
    return inventoryData;
  }, [inventoryData, selectedBranch]);

  const allBranches = useMemo(() => {
    const branchesSet = new Set<string>();
    inventoryData.forEach((row) => {
      Object.keys(row.branchQuantities).forEach(branch => branchesSet.add(branch));
    });
    return Array.from(branchesSet);
  }, [inventoryData]);

  const filteredProductionRequests = useMemo(() => {
    return productionRequests.filter((req) => req.type === selectedType);
  }, [productionRequests, selectedType]);

  const renderInventoryTable = useCallback(
    (data, title) => {
      const totalQuantities = allBranches.reduce((acc, branch) => {
        acc[branch] = data.reduce((sum, row) => sum + (row.branchQuantities[branch] || 0), 0);
        return acc;
      }, {} as { [branch: string]: number });
      const grandTotalQuantity = data.reduce((sum, row) => sum + row.totalQuantity, 0);

      const exportTable = (format) => {
        const exportData = data.map((row) => ({
          Product: row.product,
          ...row.branchQuantities,
          Total: row.totalQuantity,
        }));
        exportData.push({
          Product: isRtl ? 'الإجمالي' : 'Total',
          ...totalQuantities,
          Total: grandTotalQuantity,
        });

        if (format === 'excel') {
          const ws = XLSX.utils.json_to_sheet(exportData);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
          XLSX.writeFile(wb, `Production_Inventory_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } else if (format === 'pdf') {
          const doc = new jsPDF();
          doc.autoTable({
            head: [['Product', ...allBranches, 'Total']],
            body: exportData.map((row) => [row.Product, ...allBranches.map((b) => row[b]), row.Total]),
          });
          doc.save(`Production_Inventory_${new Date().toISOString().slice(0, 10)}.pdf`);
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

  const renderProductionRequests = useCallback(
    (requests) => {
      if (loading) return <OrderTableSkeleton isRtl={isRtl} />;
      if (requests.length === 0) {
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-center py-12 bg-white shadow-sm rounded-lg border border-gray-100"
          >
            <p className="text-gray-500 text-sm font-medium">{isRtl ? 'لا توجد طلبات' : 'No requests available'}</p>
          </motion.div>
        );
      }

      return (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">{isRtl ? 'طلبات الإنتاج' : 'Production Requests'}</h2>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="overflow-x-auto rounded-lg shadow-sm border border-gray-100 bg-white"
          >
            <table className="min-w-full divide-y divide-gray-100 text-xs">
              <thead className="bg-blue-50 sticky top-0">
                <tr className={isRtl ? 'flex-row-reverse' : ''}>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[100px]">{isRtl ? 'النوع' : 'Type'}</th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[120px]">{isRtl ? 'الفرع' : 'Branch'}</th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[100px]">{isRtl ? 'الحالة' : 'Status'}</th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[150px]">{isRtl ? 'العناصر' : 'Items'}</th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[100px]">{isRtl ? 'تم الإنشاء بواسطة' : 'Created By'}</th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[100px]">{isRtl ? 'تاريخ الإنشاء' : 'Created At'}</th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[100px]">{isRtl ? 'الشيف المخصص' : 'Assigned Chef'}</th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700 text-center min-w-[100px]">{isRtl ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requests.map((request) => (
                  <tr key={request._id} className={`hover:bg-blue-50/50 transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <td className="px-3 py-2 text-gray-700 text-center">{isRtl ? (request.type === 'branch' ? 'فرع' : 'إنتاج') : request.type}</td>
                    <td className="px-3 py-2 text-gray-700 text-center">{request.branchName || 'مصنع'}</td>
                    <td className="px-3 py-2 text-gray-700 text-center">{request.status}</td>
                    <td className="px-3 py-2 text-gray-700 text-center">
                      {request.items.map((item, idx) => (
                        <div key={idx}>{`${item.productName}: ${item.quantity}`}</div>
                      ))}
                    </td>
                    <td className="px-3 py-2 text-gray-700 text-center">{request.createdBy}</td>
                    <td className="px-3 py-2 text-gray-700 text-center">{new Date(request.createdAt).toLocaleDateString(language)}</td>
                    <td className="px-3 py-2 text-gray-700 text-center">{request.assignedChef || (isRtl ? 'غير مخصص' : 'Not Assigned')}</td>
                    <td className="px-3 py-2 text-gray-700 text-center">
                      <Button
                        onClick={() => {
                          setSelectedRequest(request);
                          setIsAssignChefModalOpen(true);
                        }}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200"
                      >
                        {isRtl ? 'تخصيص شيف' : 'Assign Chef'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      );
    },
    [loading, isRtl, language]
  );

  const handleCreateRequest = async () => {
    const payload = {
      type: selectedType,
      branchId: selectedBranch,
      items: requestItems.filter((item) => item.productId && item.quantity > 0),
      notes: '',
    };
    try {
      await inventoryAPI.createRestockRequest(payload);
      setIsCreateRequestModalOpen(false);
      setRequestItems([{ productId: '', quantity: 1 }]);
      const [newRequests] = await Promise.all([inventoryAPI.getRestockRequests({ lang: language })]);
      setProductionRequests(newRequests.requests || []);
    } catch (error) {
      console.error('Failed to create request:', error);
    }
  };

  const handleAssignChef = async () => {
    if (selectedRequest) {
      const payload = {
        requestId: selectedRequest._id,
        chefId,
      };
      try {
        await inventoryAPI.assignChef(payload);
        setIsAssignChefModalOpen(false);
        setChefId('');
        const [newRequests] = await Promise.all([inventoryAPI.getRestockRequests({ lang: language })]);
        setProductionRequests(newRequests.requests || []);
      } catch (error) {
        console.error('Failed to assign chef:', error);
      }
    }
  };

  return (
    <div className={`px-4 py-6 min-h-screen ${isRtl ? 'rtl font-amiri' : 'ltr font-inter'} bg-gray-50`}>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{isRtl ? 'المخزون الكامل للمصنع' : 'Full Factory Inventory'}</h1>
      <div className="mb-6">
        <div className="flex flex-wrap gap-2 mb-4">
          <Select
            options={[
              { value: 'all', label: isRtl ? 'الكل' : 'All' },
              { value: 'branch', label: isRtl ? 'فروع' : 'Branches' },
            ]}
            value={filterType}
            onChange={(value) => setFilterType(value as 'all' | 'branch' | 'production')}
            className="w-full sm:w-auto"
          />
          <Select
            options={filteredBranches.map((b) => ({ value: b._id, label: b.displayName }))}
            value={selectedBranch}
            onChange={(value) => setSelectedBranch(value)}
            className="w-full sm:w-auto"
          />
        </div>
      </div>
      {renderInventoryTable(filteredData, isRtl ? 'تقرير المخزون' : 'Inventory Report')}
      <h2 className="text-xl font-bold text-gray-800 mb-4">{isRtl ? 'طلبات الإنتاج' : 'Production Requests'}</h2>
      <div className="mb-4">
        <Select
          options={[
            { value: 'branch', label: isRtl ? 'من الفروع' : 'From Branches' },
            { value: 'production', label: isRtl ? 'إنتاج داخلي' : 'Internal Production' },
          ]}
          value={selectedType}
          onChange={(value) => setSelectedType(value as 'branch' | 'production')}
          className="w-full sm:w-auto"
        />
      </div>
      {renderProductionRequests(filteredProductionRequests)}
      <Button
        onClick={() => setIsCreateRequestModalOpen(true)}
        className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors duration-200"
      >
        {isRtl ? 'إنشاء طلب إنتاج' : 'Create Production Request'}
      </Button>

      {isCreateRequestModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-4">{isRtl ? 'إنشاء طلب إنتاج' : 'Create Production Request'}</h2>
            <Select
              options={[
                { value: 'branch', label: isRtl ? 'من فرع' : 'From Branch' },
                { value: 'production', label: isRtl ? 'إنتاج داخلي' : 'Internal Production' },
              ]}
              value={selectedType}
              onChange={(value) => setSelectedType(value as 'branch' | 'production')}
              className="w-full mb-4"
            />
            <Select
              options={filteredBranches.map((b) => ({ value: b._id, label: b.displayName }))}
              value={selectedBranch}
              onChange={(value) => setSelectedBranch(value)}
              className="w-full mb-4"
            />
            {requestItems.map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <Select
                  options={inventoryData.map((prod) => ({ value: prod.productId, label: prod.productName }))}
                  value={item.productId}
                  onChange={(value) => {
                    const newItems = [...requestItems];
                    newItems[idx].productId = value;
                    setRequestItems(newItems);
                  }}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => {
                    const newItems = [...requestItems];
                    newItems[idx].quantity = Math.max(1, parseInt(e.target.value) || 1);
                    setRequestItems(newItems);
                  }}
                  className="w-20"
                />
                {idx > 0 && (
                  <Button
                    variant="danger"
                    onClick={() => setRequestItems(requestItems.filter((_, i) => i !== idx))}
                  >
                    {isRtl ? 'حذف' : 'Remove'}
                  </Button>
                )}
              </div>
            ))}
            <Button
              onClick={() => setRequestItems([...requestItems, { productId: '', quantity: 1 }])}
              className="mt-2"
            >
              {isRtl ? 'إضافة منتج' : 'Add Product'}
            </Button>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setIsCreateRequestModalOpen(false)}
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateRequest}
              >
                {isRtl ? 'إنشاء' : 'Create'}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default ProductionInventory;