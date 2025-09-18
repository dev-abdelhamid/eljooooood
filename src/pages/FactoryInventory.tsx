
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { factoryInventoryAPI, productsAPI, branchesAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Select } from '../components/UI/Select';
import { Input } from '../components/UI/Input';
import { Modal } from '../components/UI/Modal';
import { Package, Plus, Search, AlertCircle, RefreshCw, Clock, Check } from 'lucide-react';
import { io } from 'socket.io-client';
import { debounce } from 'lodash';

interface FactoryInventoryItem {
  id: string;
  productId: string;
  productName: string;
  department: { _id: string; name: string };
  quantity: number;
  minimumQuantity: number;
  lastUpdated: string;
}

interface RestockRequest {
  id: string;
  productId: string;
  productName: string;
  branchId: string;
  branchName: string;
  requestedQuantity: number;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  createdAt: string;
}

interface ProductionBatch {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  timestamp: string;
}

interface Product {
  _id: string;
  name: string;
  department: { _id: string; name: string };
}

interface Branch {
  _id: string;
  name: string;
}

interface AddProductionForm {
  productId: string;
  quantity: number;
}

interface AllocateForm {
  requestId: string;
  productId: string;
  allocatedQuantity: number;
}

export function FactoryInventory() {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const [inventory, setInventory] = useState<FactoryInventoryItem[]>([]);
  const [restockRequests, setRestockRequests] = useState<RestockRequest[]>([]);
  const [productionHistory, setProductionHistory] = useState<ProductionBatch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedItem, setSelectedItem] = useState<FactoryInventoryItem | null>(null);
  const [isAddProductionModalOpen, setIsAddProductionModalOpen] = useState(false);
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'low' | 'sufficient'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [addProductionForm, setAddProductionForm] = useState<AddProductionForm>({ productId: '', quantity: 0 });
  const [allocateForm, setAllocateForm] = useState<AllocateForm>({ requestId: '', productId: '', allocatedQuantity: 0 });
  const itemsPerPage = 10;

  // Initialize Socket.IO
  const socket = useMemo(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    return io(apiUrl, { auth: { token: localStorage.getItem('token') }, autoConnect: true });
  }, []);

  const departmentOptions = useMemo(() => [
    { value: '', label: t('inventory.all_departments') },
    ...Object.entries({
      'حلويات شرقية': t('departments.eastern-sweets'),
      'حلويات غربية': t('departments.western-sweets'),
      'كيك وتورت': t('departments.cake'),
      'معجنات': t('departments.pastries'),
      'مخبوزات': t('departments.bakery'),
      'زبده': t('departments.butter') || 'زبده',
    }).map(([value, label]) => ({ value, label })),
  ], [t]);

  const statusOptions = useMemo(() => [
    { value: 'all', label: t('inventory.allStatuses') },
    { value: 'low', label: t('inventory.low') },
    { value: 'sufficient', label: t('inventory.sufficient') },
  ], [t]);

  const getStockStatus = useCallback((item: FactoryInventoryItem) => {
    const isLow = item.quantity <= item.minimumQuantity;
    return {
      label: isLow ? t('inventory.low') : t('inventory.sufficient'),
      color: isLow ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800',
      progress: (item.quantity / (item.minimumQuantity * 2)) * 100,
    };
  }, [t]);

  useEffect(() => {
    if (!['admin', 'production'].includes(user?.role || '')) {
      setError(t('errors.unauthorized_access'));
      setLoading(false);
      return;
    }
    let mounted = true;
    const fetchData = async () => {
      if (!mounted) return;
      setLoading(true);
      try {
        const [inventoryResponse, productsResponse, branchesResponse, restockResponse, historyResponse] = await Promise.all([
          factoryInventoryAPI.getAll(),
          productsAPI.getAll({ limit: 100 }),
          user?.role === 'admin' ? branchesAPI.getAll() : Promise.resolve([]),
          user?.role === 'admin' ? factoryInventoryAPI.getRestockRequests() : Promise.resolve([]),
          factoryInventoryAPI.getHistory(),
        ]);

        if (!mounted) return;

        setInventory(inventoryResponse.map((item: any) => ({
          id: item._id,
          productId: item.product._id,
          productName: item.product.name,
          department: item.product.department || { _id: 'unknown', name: 'unknown' },
          quantity: item.quantity,
          minimumQuantity: item.minimumQuantity,
          lastUpdated: new Date(item.updatedAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        })));
        setProducts(productsResponse.map((p: any) => ({
          _id: p._id,
          name: p.name,
          department: p.department || { _id: 'unknown', name: 'unknown' },
        })));
        setBranches(branchesResponse);
        setRestockRequests(restockResponse.map((req: any) => ({
          id: req._id,
          productId: req.product._id,
          productName: req.product.name,
          branchId: req.branch._id,
          branchName: req.branch.name,
          requestedQuantity: req.requestedQuantity,
          status: req.status,
          notes: req.notes,
          createdAt: new Date(req.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
        })));
        setProductionHistory(historyResponse.map((hist: any) => ({
          id: hist._id,
          productId: hist.product._id,
          productName: hist.product.name,
          quantity: hist.quantity,
          timestamp: new Date(hist.timestamp).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        })));
        setError('');
      } catch (err: any) {
        if (!mounted) return;
        setError(err.message || t('errors.fetch_inventory'));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchData();
    return () => { mounted = false; };
  }, [t, language, user]);

  useEffect(() => {
    if (!socket) return;
    socket.on('connect', () => {});
    socket.on('connect_error', () => {});
    socket.on('inventoryUpdated', ({ productId, quantity }) => {
      setInventory((prev) =>
        prev.map((item) =>
          item.productId === productId
            ? { ...item, quantity, lastUpdated: new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }) }
            : item
        )
      );
    });
    socket.on('restockApproved', ({ requestId, branchId, productId, quantity }) => {
      setRestockRequests((prev) => prev.map((req) => req.id === requestId ? { ...req, status: 'approved' } : req));
      setInventory((prev) =>
        prev.map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity - quantity, lastUpdated: new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }) }
            : item
        )
      );
      setProductionHistory((prev) => [
        {
          id: `hist-${Date.now()}`,
          productId,
          productName: products.find(p => p._id === productId)?.name || 'Unknown',
          quantity: -quantity,
          timestamp: new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
        ...prev,
      ]);
    });
    socket.on('productionBatchAdded', ({ productId, quantity }) => {
      setInventory((prev) =>
        prev.map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + quantity, lastUpdated: new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }) }
            : item
        )
      );
      setProductionHistory((prev) => [
        {
          id: `hist-${Date.now()}`,
          productId,
          productName: products.find(p => p._id === productId)?.name || 'Unknown',
          quantity,
          timestamp: new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
        ...prev,
      ]);
    });
    return () => {
      socket.off('connect');
      socket.off('connect_error');
      socket.off('inventoryUpdated');
      socket.off('restockApproved');
      socket.off('productionBatchAdded');
    };
  }, [socket, language, products]);

  const debouncedSetSearchQuery = useMemo(() => debounce((value: string) => setSearchQuery(value), 300), []);

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const matchesSearch = item.productName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDepartment = !filterDepartment || item.department.name === filterDepartment;
      const matchesStatus = filterStatus === 'all' ||
        (filterStatus === 'low' && item.quantity <= item.minimumQuantity) ||
        (filterStatus === 'sufficient' && item.quantity > item.minimumQuantity);
      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [inventory, searchQuery, filterDepartment, filterStatus]);

  const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);
  const paginatedInventory = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredInventory.slice(start, start + itemsPerPage);
  }, [filteredInventory, currentPage]);

  const addProductionBatch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addProductionForm.productId || addProductionForm.quantity <= 0 || submitting) {
      setError(t('errors.fill_all_fields'));
      return;
    }
    setSubmitting('add');
    try {
      const response = await factoryInventoryAPI.addProductionBatch({
        productId: addProductionForm.productId,
        quantity: addProductionForm.quantity,
      });
      const newItem = inventory.find(i => i.productId === addProductionForm.productId) || {
        id: response._id || `temp-${Date.now()}`,
        productId: addProductionForm.productId,
        productName: products.find(p => p._id === addProductionForm.productId)?.name || 'Unknown',
        department: products.find(p => p._id === addProductionForm.productId)?.department || { _id: 'unknown', name: 'unknown' },
        quantity: addProductionForm.quantity,
        minimumQuantity: 0,
        lastUpdated: new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setInventory((prev) => prev.some(i => i.productId === addProductionForm.productId)
        ? prev.map(i => i.productId === addProductionForm.productId ? { ...i, quantity: i.quantity + addProductionForm.quantity, lastUpdated: newItem.lastUpdated } : i)
        : [...prev, { ...newItem, quantity: addProductionForm.quantity }]
      );
      setProductionHistory([
        {
          id: `hist-${Date.now()}`,
          productId: addProductionForm.productId,
          productName: newItem.productName,
          quantity: addProductionForm.quantity,
          timestamp: newItem.lastUpdated,
        },
        ...productionHistory,
      ]);
      setIsAddProductionModalOpen(false);
      setAddProductionForm({ productId: '', quantity: 0 });
      setError('');
      socket.emit('productionBatchAdded', { productId: addProductionForm.productId, quantity: addProductionForm.quantity });
    } catch (err: any) {
      setError(err.message || t('errors.add_production_batch'));
    } finally {
      setSubmitting(null);
    }
  }, [addProductionForm, inventory, productionHistory, products, t, socket, language]);

  const allocateToBranch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocateForm.requestId || !allocateForm.productId || allocateForm.allocatedQuantity <= 0 || submitting) {
      setError(t('errors.fill_all_fields'));
      return;
    }
    const item = inventory.find(i => i.productId === allocateForm.productId);
    if (!item || item.quantity < allocateForm.allocatedQuantity) {
      setError(t('errors.insufficient_stock'));
      return;
    }
    setSubmitting(allocateForm.requestId);
    try {
      await factoryInventoryAPI.approveRestockRequest(allocateForm.requestId, {
        approvedQuantity: allocateForm.allocatedQuantity,
      });
      setRestockRequests((prev) => prev.map(r => r.id === allocateForm.requestId ? { ...r, status: 'approved' } : r));
      setInventory((prev) =>
        prev.map((item) =>
          item.productId === allocateForm.productId
            ? { ...item, quantity: item.quantity - allocateForm.allocatedQuantity, lastUpdated: new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }) }
            : item
        )
      );
      setProductionHistory([
        {
          id: `hist-${Date.now()}`,
          productId: allocateForm.productId,
          productName: products.find(p => p._id === allocateForm.productId)?.name || 'Unknown',
          quantity: -allocateForm.allocatedQuantity,
          timestamp: new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
        ...productionHistory,
      ]);
      setIsAllocateModalOpen(false);
      setAllocateForm({ requestId: '', productId: '', allocatedQuantity: 0 });
      setError('');
      socket.emit('restockApproved', {
        requestId: allocateForm.requestId,
        branchId: restockRequests.find(r => r.id === allocateForm.requestId)?.branchId,
        productId: allocateForm.productId,
        quantity: allocateForm.allocatedQuantity,
      });
    } catch (err: any) {
      setError(err.message || t('errors.allocate_to_branch'));
    } finally {
      setSubmitting(null);
    }
  }, [allocateForm, inventory, restockRequests, productionHistory, products, t, socket, language]);

  const viewHistory = useCallback((item: FactoryInventoryItem) => {
    setSelectedItem(item);
    setIsHistoryModalOpen(true);
  }, []);

  const openAllocateModal = useCallback((request: RestockRequest) => {
    setAllocateForm({
      requestId: request.id,
      productId: request.productId,
      allocatedQuantity: request.requestedQuantity,
    });
    setIsAllocateModalOpen(true);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  }, [totalPages]);

  return (
    <div className="container mx-auto p-4 sm:p-6 min-h-screen bg-gray-50" dir={isRtl ? 'rtl' : 'ltr'}>
      {loading ? (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse space-y-4 w-full max-w-md">
            <div className="h-8 bg-gray-200 rounded w-3/4 mx-auto"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2 mx-auto"></div>
            <div className="space-y-2">
              {Array(3).fill(0).map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      ) : error ? (
        <Card className="p-8 m-4 max-w-md mx-auto text-center bg-red-50 shadow-lg rounded-xl border border-red-100">
          <div className={`flex items-center justify-center ${isRtl ? 'flex-row-reverse space-x-reverse space-x-2' : 'space-x-2'} mb-4`}>
            <AlertCircle className="w-6 h-6 text-red-600" />
            <p className="text-lg font-medium text-red-600">{error}</p>
          </div>
          <Button
            variant="primary"
            onClick={() => window.location.reload()}
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-full px-6 py-2 transition-colors duration-200"
            aria-label={t('common.retry')}
          >
            {t('common.retry')}
          </Button>
        </Card>
      ) : (
        <>
          <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{t('inventory.factory_title')}</h1>
              <p className="text-sm text-gray-600 mt-1">{t('inventory.factory_subtitle')}</p>
            </div>
            {user?.role === 'production' && (
              <div className={`flex flex-wrap gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <Button
                  variant="primary"
                  size="md"
                  icon={Plus}
                  className="bg-amber-600 hover:bg-amber-700 text-white rounded-full px-4 py-2 transition-colors duration-200"
                  onClick={() => setIsAddProductionModalOpen(true)}
                  aria-label={t('inventory.add_production_batch')}
                >
                  {t('inventory.add_production_batch')}
                </Button>
              </div>
            )}
          </div>

          <Card className="p-4 sm:p-6 mb-6 bg-white shadow-lg rounded-xl border border-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.search')}</label>
                <div className="flex items-center rounded-md shadow-sm border border-gray-200 bg-white">
                  <Search className={`w-5 h-5 text-gray-400 absolute ${isRtl ? 'right-3' : 'left-3'}`} />
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={debouncedSetSearchQuery}
                    placeholder={t('inventory.search_placeholder')}
                    className={`w-full ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 rounded-md bg-transparent text-gray-900 border-0 focus:ring-2 focus:ring-amber-500 transition-colors duration-200`}
                    aria-label={t('common.search')}
                  />
                </div>
              </div>
              <Select
                label={t('inventory.filter_by_department')}
                options={departmentOptions}
                value={filterDepartment}
                onChange={setFilterDepartment}
                className="w-full rounded-md border-gray-200 focus:ring-amber-500 transition-colors duration-200"
                aria-label={t('inventory.filter_by_department')}
              />
              <Select
                label={t('inventory.filter_by_status')}
                options={statusOptions}
                value={filterStatus}
                onChange={setFilterStatus}
                className="w-full rounded-md border-gray-200 focus:ring-amber-500 transition-colors duration-200"
                aria-label={t('inventory.filter_by_status')}
              />
            </div>
            <div className="text-sm text-center text-gray-600 mt-4">
              {t('inventory.items_count', { count: filteredInventory.length })}
            </div>
          </Card>

          <div className="space-y-4">
            {paginatedInventory.length === 0 ? (
              <Card className="p-8 sm:p-12 text-center bg-white shadow-lg rounded-xl border border-gray-100">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">{t('inventory.no_items')}</h3>
                <p className="text-gray-600">
                  {filterStatus || filterDepartment || searchQuery ? t('inventory.no_matching_items') : t('inventory.no_items_yet')}
                </p>
              </Card>
            ) : (
              paginatedInventory.map(item => {
                const stockStatus = getStockStatus(item);
                return (
                  <Card key={item.id} className="p-4 sm:p-6 bg-white shadow-md hover:shadow-xl transition-shadow duration-300 rounded-xl border border-gray-100">
                    <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <div className="flex-1">
                        <div className={`flex items-center ${isRtl ? 'flex-row-reverse space-x-reverse space-x-4' : 'space-x-4'} mb-3`}>
                          <h3 className="text-lg font-semibold text-gray-900">{item.productName}</h3>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center ${stockStatus.color} ${isRtl ? 'flex-row-reverse space-x-reverse space-x-1' : 'space-x-1'}`}>
                            <span>{stockStatus.label}</span>
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                          <div
                            className={`h-2.5 rounded-full transition-all duration-500 ${stockStatus.label === t('inventory.low') ? 'bg-red-600' : 'bg-green-600'}`}
                            style={{ width: `${Math.min(stockStatus.progress, 100)}%` }}
                          ></div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-gray-600">{t('inventory.department')}</p>
                            <p className="font-medium text-gray-900">{departmentOptions.find(opt => opt.value === item.department.name)?.label || item.department.name}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">{t('inventory.quantity')}</p>
                            <p className="font-medium text-gray-900">{item.quantity} / {item.minimumQuantity} {t('inventory.units')}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">{t('inventory.last_updated')}</p>
                            <p className="font-medium text-gray-900">{item.lastUpdated}</p>
                          </div>
                        </div>
                      </div>
                      <div className={`flex flex-col space-y-2 mt-4 sm:mt-0 ${isRtl ? 'items-end' : 'items-start'}`}>
                        <Button
                          variant="primary"
                          size="sm"
                          icon={Clock}
                          onClick={() => viewHistory(item)}
                          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 py-2 transition-colors duration-200"
                          aria-label={t('inventory.view_history', { productName: item.productName })}
                        >
                          {t('inventory.view_history')}
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>

          {filteredInventory.length > itemsPerPage && (
            <div className={`flex justify-center items-center ${isRtl ? 'flex-row-reverse space-x-reverse space-x-2' : 'space-x-2'} mt-6`}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="disabled:opacity-50 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full px-4 py-2 transition-colors duration-200"
                aria-label={t('pagination.previous')}
              >
                {t('pagination.previous')}
              </Button>
              <span className="text-gray-600 font-medium">
                {t('pagination.page', { current: currentPage, total: totalPages })}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="disabled:opacity-50 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full px-4 py-2 transition-colors duration-200"
                aria-label={t('pagination.next')}
              >
                {t('pagination.next')}
              </Button>
            </div>
          )}

          {user?.role === 'admin' && (
            <Card className="p-4 sm:p-6 mt-6 bg-white shadow-lg rounded-xl border border-gray-100">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">{t('inventory.restock_requests')}</h3>
              {restockRequests.length === 0 ? (
                <p className="text-gray-600 text-center">{t('inventory.no_restock_requests')}</p>
              ) : (
                <div className="space-y-3">
                  {restockRequests.map(req => (
                    <div key={req.id} className={`p-4 bg-gray-50 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <div className="mb-3 sm:mb-0">
                        <p className="font-medium text-gray-900">{req.productName}</p>
                        <p className="text-sm text-gray-600">{t('inventory.branch')}: {req.branchName}</p>
                        <p className="text-sm text-gray-600">{t('inventory.requested_quantity')}: {req.requestedQuantity} {t('inventory.units')}</p>
                        <p className="text-sm text-gray-600">{t('inventory.status')}: {req.status}</p>
                        {req.notes && <p className="text-sm text-gray-600">{t('inventory.notes')}: {req.notes}</p>}
                      </div>
                      {req.status === 'pending' && (
                        <div className={`flex ${isRtl ? 'flex-row-reverse space-x-reverse space-x-2' : 'space-x-2'}`}>
                          <Button
                            variant="success"
                            size="sm"
                            icon={Check}
                            onClick={() => openAllocateModal(req)}
                            className="bg-teal-600 hover:bg-teal-700 text-white rounded-full px-4 py-1 transition-colors duration-200"
                            disabled={submitting === req.id}
                            aria-label={t('inventory.approve_restock', { productName: req.productName })}
                          >
                            {submitting === req.id ? t('common.loading') : t('inventory.approve')}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          <Modal
            isOpen={isAddProductionModalOpen}
            onClose={() => setIsAddProductionModalOpen(false)}
            title={t('inventory.add_production_batch')}
            size="md"
            className="bg-white rounded-xl shadow-xl transition-all duration-300"
          >
            <form onSubmit={addProductionBatch} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.product')}</label>
                <Select
                  options={[{ value: '', label: t('inventory.select_product') }, ...products.map(p => ({ value: p._id, label: p.name }))]}
                  value={addProductionForm.productId}
                  onChange={(value) => setAddProductionForm({ ...addProductionForm, productId: value })}
                  className="w-full rounded-md border-gray-200 focus:ring-amber-500 transition-colors duration-200"
                  aria-label={t('inventory.product')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.quantity')}</label>
                <Input
                  type="number"
                  min="1"
                  value={addProductionForm.quantity.toString()}
                  onChange={(value) => setAddProductionForm({ ...addProductionForm, quantity: parseInt(value) || 0 })}
                  className="w-full rounded-md border-gray-200 focus:ring-amber-500 transition-colors duration-200"
                  aria-label={t('inventory.quantity')}
                />
              </div>
              {error && (
                <div className={`p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="text-red-600">{error}</span>
                </div>
              )}
              <div className={`flex justify-end ${isRtl ? 'flex-row-reverse space-x-reverse space-x-2' : 'space-x-2'}`}>
                <Button
                  variant="secondary"
                  onClick={() => setIsAddProductionModalOpen(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full px-4 py-2 transition-colors duration-200"
                  aria-label={t('common.cancel')}
                  disabled={submitting === 'add'}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white rounded-full px-4 py-2 transition-colors duration-200"
                  disabled={submitting === 'add' || !addProductionForm.productId || addProductionForm.quantity <= 0}
                  aria-label={t('inventory.submit')}
                >
                  {submitting === 'add' ? t('common.loading') : t('inventory.submit')}
                </Button>
              </div>
            </form>
          </Modal>

          <Modal
            isOpen={isAllocateModalOpen}
            onClose={() => setIsAllocateModalOpen(false)}
            title={t('inventory.allocate_to_branch')}
            size="md"
            className="bg-white rounded-xl shadow-xl transition-all duration-300"
          >
            <form onSubmit={allocateToBranch} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.product')}</label>
                <Input
                  type="text"
                  value={products.find(p => p._id === allocateForm.productId)?.name || ''}
                  disabled
                  className="w-full rounded-md border-gray-200 bg-gray-100 text-gray-900"
                  aria-label={t('inventory.product')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.branch')}</label>
                <Input
                  type="text"
                  value={branches.find(b => b._id === restockRequests.find(r => r.id === allocateForm.requestId)?.branchId)?.name || ''}
                  disabled
                  className="w-full rounded-md border-gray-200 bg-gray-100 text-gray-900"
                  aria-label={t('inventory.branch')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.allocated_quantity')}</label>
                <Input
                  type="number"
                  min="1"
                  value={allocateForm.allocatedQuantity.toString()}
                  onChange={(value) => setAllocateForm({ ...allocateForm, allocatedQuantity: parseInt(value) || 0 })}
                  className="w-full rounded-md border-gray-200 focus:ring-amber-500 transition-colors duration-200"
                  aria-label={t('inventory.allocated_quantity')}
                />
              </div>
              {error && (
                <div className={`p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="text-red-600">{error}</span>
                </div>
              )}
              <div className={`flex justify-end ${isRtl ? 'flex-row-reverse space-x-reverse space-x-2' : 'space-x-2'}`}>
                <Button
                  variant="secondary"
                  onClick={() => setIsAllocateModalOpen(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full px-4 py-2 transition-colors duration-200"
                  aria-label={t('common.cancel')}
                  disabled={submitting === allocateForm.requestId}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white rounded-full px-4 py-2 transition-colors duration-200"
                  disabled={submitting === allocateForm.requestId || !allocateForm.productId || allocateForm.allocatedQuantity <= 0}
                  aria-label={t('inventory.submit')}
                >
                  {submitting === allocateForm.requestId ? t('common.loading') : t('inventory.submit')}
                </Button>
              </div>
            </form>
          </Modal>

          <Modal
            isOpen={isHistoryModalOpen}
            onClose={() => setIsHistoryModalOpen(false)}
            title={t('inventory.history_title', { productName: selectedItem?.productName })}
            size="lg"
            className="bg-white rounded-xl shadow-xl transition-all duration-300"
          >
            <div className="space-y-4">
              {productionHistory.filter(h => h.productId === selectedItem?.productId).length === 0 ? (
                <p className="text-gray-600 text-center">{t('inventory.no_history')}</p>
              ) : (
                <div className="space-y-3">
                  {productionHistory
                    .filter(h => h.productId === selectedItem?.productId)
                    .map(hist => (
                      <div key={hist.id} className={`p-3 bg-gray-50 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
                        <div>
                          <p className="font-medium text-gray-900">{hist.quantity > 0 ? t('inventory.actions.production') : t('inventory.actions.allocation')}</p>
                          <p className="text-sm text-gray-600">{t('inventory.quantity')}: {Math.abs(hist.quantity)} {t('inventory.units')}</p>
                          <p className="text-sm text-gray-600">{t('inventory.timestamp')}: {hist.timestamp}</p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </Modal>
        </>
      )}
    </div>
  );
}

export default FactoryInventory;
