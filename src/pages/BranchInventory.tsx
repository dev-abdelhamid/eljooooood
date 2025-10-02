// src/pages/BranchInventory.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { inventoryAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Input } from '../components/UI/Input';
import { Button } from '../components/UI/Button';
import { Package, AlertCircle, Search, RefreshCw } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { debounce } from 'lodash';
import { motion, AnimatePresence } from 'framer-motion';

interface InventoryItem {
  _id: string;
  product: {
    _id: string;
    name: string;
    nameEn: string;
    code: string;
    unit: string;
    unitEn: string;
    department: { name: string; nameEn: string };
  };
  currentStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  status?: string;
}

const InventoryCardSkeleton: React.FC<{ isRtl: boolean }> = ({ isRtl }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className="p-4 mb-4 bg-white shadow-md rounded-lg border border-gray-200"
  >
    <div className="flex flex-col gap-3">
      <div className={`flex items-center ${isRtl ? 'justify-between flex-row-reverse' : 'justify-between'}`}>
        <div className="h-6 w-1/2 bg-gray-200 rounded animate-pulse" />
        <div className="h-5 w-20 bg-gray-200 rounded-full animate-pulse" />
      </div>
      <div className="h-4 w-1/3 bg-gray-200 rounded animate-pulse" />
      <div className="h-4 w-1/4 bg-gray-200 rounded animate-pulse" />
      <div className="h-4 w-1/4 bg-gray-200 rounded animate-pulse" />
    </div>
  </motion.div>
);

export const BranchInventory: React.FC = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const socket = useMemo<Socket | null>(() => {
    const apiUrl = process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app';
    try {
      return io(apiUrl, {
        auth: { token: localStorage.getItem('token') },
        transports: ['websocket'],
        path: '/socket.io',
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
    } catch (err) {
      console.error('Socket initialization error:', err);
      setError(isRtl ? 'فشل في تهيئة الاتصال بالمخزن' : 'Failed to initialize socket connection');
      return null;
    }
  }, [isRtl]);

  const fetchInventory = useCallback(async () => {
    if (!user?.branchId) {
      setError(isRtl ? 'لا يوجد فرع مرتبط بالمستخدم' : 'No branch associated with the user');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await inventoryAPI.getByBranch(user.branchId);
      const inventoryData = Array.isArray(response) ? response : response.data || [];
      const enhancedInventory = inventoryData.map((item: InventoryItem) => ({
        ...item,
        product: {
          _id: item.product?._id || '',
          name: item.product?.name || 'Unknown Product',
          nameEn: item.product?.nameEn || item.product?.name || 'Unknown Product',
          code: item.product?.code || 'N/A',
          unit: item.product?.unit || 'غير محدد',
          unitEn: item.product?.unitEn || item.product?.unit || 'N/A',
          department: {
            name: item.product?.department?.name || 'غير معروف',
            nameEn: item.product?.department?.nameEn || item.product?.department?.name || 'Unknown',
          },
        },
        status:
          item.currentStock <= item.minStockLevel
            ? 'low'
            : item.currentStock >= item.maxStockLevel
            ? 'full'
            : 'normal',
      }));
      setInventory(enhancedInventory);
      setError('');
    } catch (err: any) {
      const errorMessage = err.message || (isRtl ? 'خطأ في جلب المخزون' : 'Error fetching inventory');
      setError(errorMessage);
      if (err.status === 401) {
        setError(isRtl ? 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجددًا' : 'Session expired, please log in again');
      }
    } finally {
      setLoading(false);
    }
  }, [user, isRtl]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  useEffect(() => {
    if (!socket) return;

    socket.on('connect', () => console.log('Socket connected:', socket.id));
    socket.on('connect_error', (err) => {
      console.error('Socket connect error:', err.message);
      setError(isRtl ? 'فشل في الاتصال بالمخزن' : 'Failed to connect to socket');
    });
    socket.on('inventoryUpdated', ({ branchId }) => {
      if (branchId === user?.branchId) {
        fetchInventory();
      }
    });

    return () => {
      socket.off('connect');
      socket.off('connect_error');
      socket.off('inventoryUpdated');
      socket.disconnect();
    };
  }, [socket, user, fetchInventory]);

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchQuery(value.trim());
    }, 300),
    []
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      debouncedSearch(e.target.value);
    },
    [debouncedSearch]
  );

  const handleRetry = useCallback(() => {
    setError('');
    fetchInventory();
  }, [fetchInventory]);

  const statusOptions = useMemo(
    () => [
      { value: '', label: isRtl ? 'كل الحالات' : 'All Statuses' },
      { value: 'low', label: isRtl ? 'منخفض' : 'Low Stock' },
      { value: 'normal', label: isRtl ? 'عادي' : 'Normal' },
      { value: 'full', label: isRtl ? 'ممتلئ' : 'Full' },
    ],
    [isRtl]
  );

  const filteredInventory = useMemo(
    () =>
      inventory.filter(
        (item) =>
          (!filterStatus || item.status === filterStatus) &&
          (item.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.product.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.product.code.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
    [inventory, searchQuery, filterStatus]
  );

  return (
    <div
      className="container mx-auto px-4 py-6 min-h-screen bg-gradient-to-br from-amber-50 to-teal-50"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Package className="w-8 h-8 text-amber-600" />
          {isRtl ? 'المخزون' : 'Inventory'}
        </h1>
        <p className="text-gray-600 mt-2">
          {isRtl ? 'إدارة مخزون الفرع' : 'Manage branch inventory'}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg flex items-center gap-3 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600">{error}</span>
          <Button
            onClick={handleRetry}
            className="ml-4 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {isRtl ? 'إعادة المحاولة' : 'Retry'}
          </Button>
        </div>
      )}

      <Card className="p-6 mb-6 bg-white rounded-xl shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative">
            <Search
              className={`absolute top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 ${
                isRtl ? 'right-3' : 'left-3'
              }`}
            />
            <Input
              placeholder={isRtl ? 'ابحث حسب اسم المنتج أو الكود...' : 'Search by product name or code...'}
              onChange={handleSearchChange}
              className={`pl-10 pr-4 py-2 border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 ${
                isRtl ? 'pr-10 pl-4' : ''
              }`}
              aria-label={isRtl ? 'ابحث حسب اسم المنتج أو الكود' : 'Search by product name or code'}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isRtl ? 'تصفية حسب الحالة' : 'Filter by Status'}
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full rounded-lg border-gray-200 focus:ring-amber-500 focus:border-amber-500 text-sm shadow-sm py-2 px-3"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {loading ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-4">
          {Array(6)
            .fill(null)
            .map((_, i) => (
              <InventoryCardSkeleton key={i} isRtl={isRtl} />
            ))}
        </motion.div>
      ) : filteredInventory.length === 0 ? (
        <Card className="p-8 text-center bg-white rounded-xl shadow-md">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            {isRtl ? 'لا توجد عناصر في المخزون' : 'No items in inventory'}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {filteredInventory.map((item) => (
              <motion.div
                key={item._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-shadow duration-200">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{isRtl ? item.product.name : item.product.nameEn}</h3>
                      <p className="text-sm text-gray-500">
                        {isRtl ? 'الكود' : 'Code'}: {item.product.code}
                      </p>
                      <p className="text-sm text-gray-600">
                        {isRtl ? 'المخزون الحالي' : 'Current Stock'}: {item.currentStock}
                      </p>
                      <p className="text-sm text-gray-600">
                        {isRtl ? 'الحد الأدنى للمخزون' : 'Min Stock Level'}: {item.minStockLevel}
                      </p>
                      <p className="text-sm text-gray-600">
                        {isRtl ? 'الحد الأقصى للمخزون' : 'Max Stock Level'}: {item.maxStockLevel}
                      </p>
                      <p className="text-sm text-gray-600">
                        {isRtl ? 'الوحدة' : 'Unit'}: {isRtl ? item.product.unit : item.product.unitEn}
                      </p>
                      <p className="text-sm text-gray-600">
                        {isRtl ? 'القسم' : 'Department'}: {isRtl ? item.product.department.name : item.product.department.nameEn}
                      </p>
                      <p
                        className={`text-sm font-medium ${
                          item.status === 'low'
                            ? 'text-red-600'
                            : item.status === 'full'
                            ? 'text-yellow-600'
                            : 'text-green-600'
                        }`}
                      >
                        {isRtl
                          ? item.status === 'low'
                            ? 'منخفض'
                            : item.status === 'full'
                            ? 'ممتلئ'
                            : 'عادي'
                          : item.status === 'low'
                          ? 'Low Stock'
                          : item.status === 'full'
                          ? 'Full'
                          : 'Normal'}
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default BranchInventory;