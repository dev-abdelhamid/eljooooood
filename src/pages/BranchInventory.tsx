import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { inventoryAPI, ordersAPI, returnsAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Input } from '../components/UI/Input';
import { Button } from '../components/UI/Button';
import { Modal } from '../components/UI/Modal';
import { Select } from '../components/UI/Select';
import { Package, AlertCircle, Search, RefreshCw, History as HistoryIcon, Download, Plus, X, Save } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { debounce } from 'lodash';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from '../utils/formatDate';
import 'react-toastify/dist/ReactToastify.css';
import 'tailwindcss/tailwind.css';

const ITEMS_PER_PAGE = 10;

interface InventoryItem {
  _id: string;
  product: {
    _id: string;
    name: string;
    nameEn: string;
    code: string;
    unit: string;
    unitEn: string;
    department: { name: string; nameEn: string; _id: string };
  };
  currentStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  status?: string;
}

interface InventoryHistoryItem {
  _id: string;
  product: {
    name: string;
    nameEn: string;
  };
  action: string;
  quantity: number;
  reference: string;
  createdBy: {
    username: string;
  };
  createdAt: string;
}

interface Order {
  _id: string;
  orderNumber: string;
  items: Array<{
    _id: string;
    product: {
      _id: string;
      name: string;
      nameEn: string;
    };
    quantity: number;
    returnedQuantity?: number;
  }>;
}

interface ReturnItem {
  itemId: string;
  productId: string;
  quantity: number;
  reason: string;
  maxQuantity: number;
}

interface ReturnForm {
  orderId: string;
  branchId: string;
  reason: string;
  notes: string;
  items: ReturnItem[];
}

interface StockLevelForm {
  minStockLevel: number;
  maxStockLevel: number;
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
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [activeTab, setActiveTab] = useState<'inventory' | 'history'>('inventory');
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isEditStockModalOpen, setIsEditStockModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [returnForm, setReturnForm] = useState<ReturnForm>({
    orderId: '',
    branchId: user?.branchId || '',
    reason: '',
    notes: '',
    items: [],
  });
  const [stockLevelForm, setStockLevelForm] = useState<StockLevelForm>({ minStockLevel: 0, maxStockLevel: 0 });
  const [returnErrors, setReturnErrors] = useState({});
  const [stockLevelErrors, setStockLevelErrors] = useState({});
  const [availableItems, setAvailableItems] = useState<any[]>([]);

  const toastOptions = useMemo(
    () => ({
      position: isRtl ? 'top-left' : 'top-right',
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      className: 'bg-white text-gray-800 rounded-lg shadow-lg border border-gray-200 p-3',
      progressClassName: 'bg-amber-500',
    }),
    [isRtl]
  );

  const socket = useMemo<Socket | null>(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'https://eljoodia-server-production.up.railway.app';
    try {
      const socketInstance = io(apiUrl, {
        auth: { token: localStorage.getItem('token') || '' },
        transports: ['websocket'],
        path: '/socket.io',
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
      socketInstance.on('connect_error', (err) => {
        console.error(`[${new Date().toISOString()}] Socket connect error:`, err);
        toast.error(t('errors.socket_connect'), toastOptions);
      });
      socketInstance.on('disconnect', (reason) => {
        console.warn(`[${new Date().toISOString()}] Socket disconnected:`, reason);
        if (reason !== 'io client disconnect') {
          toast.warn(t('errors.socket_disconnect'), toastOptions);
        }
      });
      return socketInstance;
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Socket initialization error:`, err);
      toast.error(t('errors.socket_init'), toastOptions);
      return null;
    }
  }, [t, toastOptions]);

  const { data: inventoryData, isLoading: inventoryLoading, error: inventoryError, refetch: refetchInventory } = useQuery({
    queryKey: ['inventory', user?.branchId, language],
    queryFn: async () => {
      if (!user?.branchId) throw new Error(t('errors.no_branch_associated'));
      const response = await inventoryAPI.getByBranch(user.branchId);
      return response.map((item: InventoryItem) => ({
        ...item,
        product: {
          _id: item.product?._id || '',
          name: item.product?.name || t('products.unknown'),
          nameEn: item.product?.nameEn || item.product?.name || t('products.unknown'),
          code: item.product?.code || 'N/A',
          unit: item.product?.unit || t('products.unit_unknown'),
          unitEn: item.product?.unitEn || item.product?.unit || 'N/A',
          department: {
            _id: item.product?.department?._id || '',
            name: item.product?.department?.name || t('departments.unknown'),
            nameEn: item.product?.department?.nameEn || item.product?.department?.name || t('departments.unknown'),
          },
        },
        status:
          item.currentStock <= item.minStockLevel
            ? 'low'
            : item.currentStock >= item.maxStockLevel
            ? 'full'
            : 'normal',
      }));
    },
    enabled: !!user?.branchId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: historyData, isLoading: historyLoading, error: historyError } = useQuery({
    queryKey: ['inventoryHistory', user?.branchId, language, currentPage],
    queryFn: async () => {
      if (!user?.branchId) return [];
      const response = await inventoryAPI.getHistory({ branchId: user.branchId, page: currentPage, limit: ITEMS_PER_PAGE });
      return { history: response.history || [], total: response.total || 0 };
    },
    enabled: activeTab === 'history' && !!user?.branchId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', user?.branchId, language],
    queryFn: async () => {
      if (!user?.branchId) return [];
      const response = await ordersAPI.getAll({ branch: user.branchId, status: 'delivered' });
      return response.orders || [];
    },
    enabled: !!user?.branchId,
    staleTime: 5 * 60 * 1000,
  });

  useQuery({
    queryKey: ['selectedOrder', returnForm.orderId, language],
    queryFn: async () => {
      if (!returnForm.orderId) return null;
      const order = await ordersAPI.getById(returnForm.orderId);
      const items = order.items.map((i: any) => {
        const inv = inventoryData?.find((inv: any) => inv.product._id === i.product._id) || { currentStock: 0 };
        return {
          itemId: i._id,
          productId: i.product._id,
          productName: isRtl ? i.product.name : i.product.nameEn || i.product.name,
          available: i.quantity - (i.returnedQuantity || 0),
          unit: isRtl ? i.product.unit : i.product.unitEn || i.product.unit,
          departmentName: isRtl ? i.product.department.name : i.product.department.nameEn || i.product.department.name,
          stock: inv.currentStock,
        };
      });
      setAvailableItems(items);
      return order;
    },
    enabled: !!returnForm.orderId,
  });

  const updateStockLevelsMutation = useMutation({
    mutationFn: async ({ itemId, minStockLevel, maxStockLevel }: { itemId: string; minStockLevel: number; maxStockLevel: number }) => {
      const errors: any = {};
      if (minStockLevel < 0) errors.minStockLevel = t('errors.negative_min_stock');
      if (maxStockLevel < 0) errors.maxStockLevel = t('errors.negative_max_stock');
      if (minStockLevel >= maxStockLevel) errors.maxStockLevel = t('errors.max_less_than_min');
      if (Object.keys(errors).length > 0) {
        setStockLevelErrors(errors);
        throw new Error(t('errors.invalid_form'));
      }
      await inventoryAPI.update(itemId, { minStockLevel, maxStockLevel });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setIsEditStockModalOpen(false);
      setStockLevelForm({ minStockLevel: 0, maxStockLevel: 0 });
      setStockLevelErrors({});
      setSelectedItem(null);
      toast.success(t('inventory.update_stock_success'), toastOptions);
    },
    onError: (err: any) => {
      toast.error(err.message || t('errors.update_stock'), toastOptions);
    },
  });

  const validateReturnForm = useCallback(() => {
    const errors: any = {};
    if (!returnForm.orderId) errors.orderId = t('errors.required', { field: t('returns.order') });
    if (!returnForm.reason) errors.reason = t('errors.required', { field: t('returns.reason') });
    if (returnForm.items.length === 0) errors.items = t('errors.required', { field: t('returns.items') });
    returnForm.items.forEach((item, index) => {
      if (!item.itemId) errors[`item_${index}_itemId`] = t('errors.required', { field: t('returns.item') });
      if (!item.reason) errors[`item_${index}_reason`] = t('errors.required', { field: t('returns.reason') });
      const maxQty = item.maxQuantity || 0;
      if (item.quantity < 1 || item.quantity > maxQty || isNaN(item.quantity)) {
        errors[`item_${index}_quantity`] = t('errors.invalid_quantity_max', { max: maxQty });
      }
    });
    setReturnErrors(errors);
    return Object.keys(errors).length === 0;
  }, [returnForm, t]);

  const createReturnMutation = useMutation({
    mutationFn: async () => {
      if (!validateReturnForm()) throw new Error(t('errors.invalid_form'));
      const payload = {
        orderId: returnForm.orderId,
        branchId: returnForm.branchId,
        reason: returnForm.reason,
        notes: returnForm.notes,
        items: returnForm.items.map((item) => ({
          itemId: item.itemId,
          productId: item.productId,
          quantity: Number(item.quantity),
          reason: item.reason,
        })),
      };
      console.log(`[${new Date().toISOString()}] returnsAPI.createReturn - Sending:`, payload);
      const response = await returnsAPI.createReturn(payload);
      const inventoryUpdates = returnForm.items.map((item) => ({
        productId: item.productId,
        branchId: returnForm.branchId,
        quantity: Number(item.quantity),
        action: 'return',
      }));
      try {
        await inventoryAPI.bulkUpdate(inventoryUpdates);
      } catch (err) {
        console.error(`[${new Date().toISOString()}] Inventory bulk update failed:`, err);
        throw new Error(t('errors.inventory_update'));
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryHistory'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setIsReturnModalOpen(false);
      setReturnForm({ orderId: '', branchId: user?.branchId || '', reason: '', notes: '', items: [] });
      setReturnErrors({});
      setAvailableItems([]);
      setSelectedItem(null);
      toast.success(t('returns.create_success'), toastOptions);
    },
    onError: (err: any) => {
      console.error(`[${new Date().toISOString()}] Return creation error:`, err);
      toast.error(err.message || t('errors.create_return'), toastOptions);
      if (err.response?.data?.errors) {
        const backendErrors = err.response.data.errors.reduce((acc: any, error: any) => {
          acc[error.path] = error.msg;
          return acc;
        }, {});
        setReturnErrors(backendErrors);
      }
    },
  });

  useEffect(() => {
    if (!socket) return;
    socket.on('connect', () => {
      socket.emit('joinRoom', { role: user?.role, branchId: user?.branchId, userId: user?._id });
      console.log(`[${new Date().toISOString()}] Socket connected`);
      toast.info(t('socket.connected'), toastOptions);
    });
    socket.on('inventoryUpdated', ({ branchId }) => {
      if (branchId === user?.branchId) {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        queryClient.invalidateQueries({ queryKey: ['inventoryHistory'] });
        toast.info(t('inventory.updated'), toastOptions);
      }
    });
    socket.on('returnCreated', ({ branchId }) => {
      if (branchId === user?.branchId) {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        queryClient.invalidateQueries({ queryKey: ['inventoryHistory'] });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        toast.success(t('returns.new_return_notification'), toastOptions);
      }
    });
    socket.on('returnStatusUpdated', ({ branchId }) => {
      if (branchId === user?.branchId) {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        queryClient.invalidateQueries({ queryKey: ['inventoryHistory'] });
        toast.info(t('socket.return_status_updated'), toastOptions);
      }
    });
    return () => {
      socket.off('connect');
      socket.off('inventoryUpdated');
      socket.off('returnCreated');
      socket.off('returnStatusUpdated');
      socket.disconnect();
    };
  }, [socket, user, queryClient, t, toastOptions]);

  const debouncedSearch = useMemo(() => debounce((value: string) => setSearchQuery(value.trim()), 300), []);

  const statusOptions = useMemo(
    () => [
      { value: '', label: t('inventory.status.all') },
      { value: 'low', label: t('inventory.status.low') },
      { value: 'normal', label: t('inventory.status.normal') },
      { value: 'full', label: t('inventory.status.full') },
    ],
    [t]
  );

  const reasonOptions = useMemo(
    () => [
      { value: 'تالف', label: isRtl ? 'تالف' : 'Damaged' },
      { value: 'منتج خاطئ', label: isRtl ? 'منتج خاطئ' : 'Wrong Item' },
      { value: 'كمية زائدة', label: isRtl ? 'كمية زائدة' : 'Excess Quantity' },
      { value: 'أخرى', label: isRtl ? 'أخرى' : 'Other' },
    ],
    [isRtl]
  );

  const filteredInventory = useMemo(
    () =>
      (inventoryData || []).filter(
        (item) =>
          (!filterStatus || item.status === filterStatus) &&
          (item.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.product.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.product.code.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
    [inventoryData, searchQuery, filterStatus]
  );

  const paginatedInventory = useMemo(
    () => filteredInventory.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredInventory, currentPage]
  );

  const totalInventoryPages = Math.ceil(filteredInventory.length / ITEMS_PER_PAGE);
  const totalHistoryPages = Math.ceil((historyData?.total || 0) / ITEMS_PER_PAGE);

  const handleOpenReturnModal = useCallback((item: InventoryItem) => {
    setSelectedItem(item);
    setReturnForm({
      orderId: '',
      branchId: user?.branchId || '',
      reason: '',
      notes: '',
      items: [{ itemId: '', productId: item.product._id, quantity: 1, reason: '', maxQuantity: 0 }],
    });
    setIsReturnModalOpen(true);
  }, [user]);

  const handleOpenEditStockModal = useCallback((item: InventoryItem) => {
    setSelectedItem(item);
    setStockLevelForm({ minStockLevel: item.minStockLevel, maxStockLevel: item.maxStockLevel });
    setIsEditStockModalOpen(true);
  }, []);

  const handleCreateReturn = useCallback(() => {
    createReturnMutation.mutate();
  }, [createReturnMutation]);

  const handleUpdateStockLevels = useCallback(() => {
    if (selectedItem) {
      updateStockLevelsMutation.mutate({
        itemId: selectedItem._id,
        minStockLevel: stockLevelForm.minStockLevel,
        maxStockLevel: stockLevelForm.maxStockLevel,
      });
    }
  }, [selectedItem, stockLevelForm, updateStockLevelsMutation]);

  const addItemToReturn = useCallback(() => {
    setReturnForm((prev) => ({
      ...prev,
      items: [...prev.items, { itemId: '', productId: '', quantity: 1, reason: '', maxQuantity: 0 }],
    }));
  }, []);

  const updateItemInReturn = useCallback((index: number, field: string, value: any) => {
    setReturnForm((prev) => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      if (field === 'itemId') {
        const sel = availableItems.find((a) => a.itemId === value);
        if (sel) {
          newItems[index].productId = sel.productId;
          newItems[index].maxQuantity = Math.min(sel.available, sel.stock);
        }
      }
      return { ...prev, items: newItems };
    });
  }, [availableItems]);

  const removeItemFromReturn = useCallback((index: number) => {
    setReturnForm((prev) => ({
      ...prev,
      items: prev.items.filter((_: any, i: number) => i !== index),
    }));
  }, []);

  const exportInventoryToExcel = useCallback(() => {
    const exportData = filteredInventory.map((item) => ({
      [t('inventory.product')]: isRtl ? item.product.name : item.product.nameEn,
      [t('inventory.code')]: item.product.code,
      [t('inventory.stock')]: item.currentStock,
      [t('inventory.min_stock')]: item.minStockLevel,
      [t('inventory.max_stock')]: item.maxStockLevel,
      [t('inventory.unit')]: isRtl ? item.product.unit : item.product.unitEn,
      [t('inventory.department')]: isRtl ? item.product.department.name : item.product.department.nameEn,
      [t('inventory.status')]: t(`inventory.status.${item.status}`),
    }));
    const ws = XLSX.utils.json_to_sheet(isRtl ? exportData.map((row) => Object.fromEntries(Object.entries(row).reverse())) : exportData);
    ws['!cols'] = Object.keys(exportData[0] || {}).map(() => ({ wpx: 120 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, `Inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(t('inventory.export_success'), toastOptions);
  }, [filteredInventory, isRtl, t]);

  const exportHistoryToExcel = useCallback(() => {
    const exportData = (historyData?.history || []).map((entry: InventoryHistoryItem) => ({
      [t('history.date')]: formatDate(entry.createdAt, language),
      [t('history.product')]: isRtl ? entry.product.name : entry.product.nameEn,
      [t('history.action')]: t(`history.${entry.action}`),
      [t('history.quantity')]: entry.quantity,
      [t('history.reference')]: entry.reference,
      [t('history.created_by')]: entry.createdBy.username,
    }));
    const ws = XLSX.utils.json_to_sheet(isRtl ? exportData.map((row) => Object.fromEntries(Object.entries(row).reverse())) : exportData);
    ws['!cols'] = Object.keys(exportData[0] || {}).map(() => ({ wpx: 120 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'History');
    XLSX.writeFile(wb, `History_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(t('history.export_success'), toastOptions);
  }, [historyData, isRtl, t, language]);

  const exportInventoryToPDF = useCallback(() => {
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFont('Amiri', 'normal');
      const headers = [
        t('inventory.product'),
        t('inventory.code'),
        t('inventory.stock'),
        t('inventory.min_stock'),
        t('inventory.max_stock'),
        t('inventory.unit'),
        t('inventory.department'),
        t('inventory.status'),
      ];
      const data = filteredInventory.map((item) => [
        isRtl ? item.product.name : item.product.nameEn,
        item.product.code,
        item.currentStock.toString(),
        item.minStockLevel.toString(),
        item.maxStockLevel.toString(),
        isRtl ? item.product.unit : item.product.unitEn,
        isRtl ? item.product.department.name : item.product.department.nameEn,
        t(`inventory.status.${item.status}`),
      ]);
      const finalHeaders = isRtl ? headers.reverse() : headers;
      const finalData = isRtl ? data.map((row) => row.reverse()) : data;
      autoTable(doc, {
        head: [finalHeaders],
        body: finalData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 10, halign: isRtl ? 'right' : 'left', font: 'Amiri' },
        bodyStyles: { fontSize: 9, halign: isRtl ? 'right' : 'left', cellPadding: 4, font: 'Amiri' },
        columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 30 } },
        margin: { top: 20 },
      });
      doc.save(`Inventory_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success(t('inventory.pdf_export_success'), toastOptions);
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error(t('errors.pdf_export'), toastOptions);
    }
  }, [filteredInventory, isRtl, t]);

  const exportHistoryToPDF = useCallback(() => {
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFont('Amiri', 'normal');
      const headers = [
        t('history.date'),
        t('history.product'),
        t('history.action'),
        t('history.quantity'),
        t('history.reference'),
        t('history.created_by'),
      ];
      const data = (historyData?.history || []).map((entry: InventoryHistoryItem) => [
        formatDate(entry.createdAt, language),
        isRtl ? entry.product.name : entry.product.nameEn,
        t(`history.${entry.action}`),
        entry.quantity.toString(),
        entry.reference,
        entry.createdBy.username,
      ]);
      const finalHeaders = isRtl ? headers.reverse() : headers;
      const finalData = isRtl ? data.map((row) => row.reverse()) : data;
      autoTable(doc, {
        head: [finalHeaders],
        body: finalData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 10, halign: isRtl ? 'right' : 'left', font: 'Amiri' },
        bodyStyles: { fontSize: 9, halign: isRtl ? 'right' : 'left', cellPadding: 4, font: 'Amiri' },
        columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 50 } },
        margin: { top: 20 },
      });
      doc.save(`History_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success(t('history.pdf_export_success'), toastOptions);
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error(t('errors.pdf_export'), toastOptions);
    }
  }, [historyData, isRtl, t, language]);

  const Pagination = ({ totalPages }: { totalPages: number }) => (
    totalPages > 1 && (
      <div className={`flex items-center justify-center gap-3 mt-6 ${isRtl ? 'flex-row-reverse' : ''}`}>
        <Button
          variant="secondary"
          size="md"
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="disabled:opacity-50 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full px-4 py-2 transition-colors duration-200"
          aria-label={t('pagination.previous')}
        >
          {t('pagination.previous')}
        </Button>
        <span className="text-gray-700 font-medium">{t('pagination.page', { current: currentPage, total: totalPages })}</span>
        <Button
          variant="secondary"
          size="md"
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="disabled:opacity-50 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full px-4 py-2 transition-colors duration-200"
          aria-label={t('pagination.next')}
        >
          {t('pagination.next')}
        </Button>
      </div>
    )
  );

  const errorMessage = inventoryError?.message || historyError?.message || '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen bg-gradient-to-br from-amber-50 to-teal-50"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="sticky top-0 z-10 bg-gradient-to-br from-amber-50 to-teal-50 py-4 border-b border-gray-100"
      >
        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${isRtl ? 'sm:flex-row-reverse' : ''}`}>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Package className="w-8 h-8 text-amber-600" />
              {t('inventory.title')}
            </h1>
            <p className="text-base text-gray-600 mt-1">{t('inventory.subtitle')}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={activeTab === 'inventory' ? exportInventoryToExcel : exportHistoryToExcel}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white rounded-full px-4 py-2 transition-colors duration-200"
              aria-label={t('common.export_excel')}
            >
              <Download className="w-5 h-5" />
              <span>{t('common.export_excel')}</span>
            </Button>
            <Button
              variant="primary"
              onClick={activeTab === 'inventory' ? exportInventoryToPDF : exportHistoryToPDF}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 py-2 transition-colors duration-200"
              aria-label={t('common.export_pdf')}
            >
              <Download className="w-5 h-5" />
              <span>{t('common.export_pdf')}</span>
            </Button>
          </div>
        </div>
      </motion.div>

      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-600">{errorMessage}</span>
          <Button
            onClick={() => refetchInventory()}
            className="ml-4 bg-amber-600 text-white px-4 py-2 rounded-full hover:bg-amber-700 transition-colors duration-200"
            aria-label={t('common.retry')}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('common.retry')}
          </Button>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex mb-6 gap-2"
      >
        <Button
          onClick={() => {
            setActiveTab('inventory');
            setCurrentPage(1);
          }}
          className={`flex-1 py-3 text-lg font-semibold rounded-l-lg transition-all duration-300 ${
            activeTab === 'inventory' ? 'bg-amber-600 text-white shadow-lg' : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
          aria-label={t('inventory.tab_inventory')}
        >
          {t('inventory.tab_inventory')}
        </Button>
        <Button
          onClick={() => {
            setActiveTab('history');
            setCurrentPage(1);
          }}
          className={`flex-1 py-3 text-lg font-semibold rounded-r-lg transition-all duration-300 ${
            activeTab === 'history' ? 'bg-amber-600 text-white shadow-lg' : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
          aria-label={t('inventory.tab_history')}
        >
          <HistoryIcon className="inline w-5 h-5 mr-2" />
          {t('inventory.tab_history')}
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row gap-4 items-center mb-6"
      >
        <div className="relative flex-1">
          <Search
            className={`absolute top-1/2 transform -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} w-5 h-5 text-gray-400`}
          />
          <Input
            placeholder={t('inventory.search_placeholder')}
            onChange={(e) => debouncedSearch(e.target.value || '')}
            className={`pl-10 pr-4 py-2 w-full rounded-full border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent ${isRtl ? 'text-right pr-10' : 'text-left'}`}
            aria-label={t('inventory.search_placeholder')}
          />
        </div>
        <Select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value || '');
            setCurrentPage(1);
          }}
          options={statusOptions}
          className="w-full sm:w-48 rounded-full border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          aria-label={t('inventory.filter_status')}
        />
      </motion.div>

      <AnimatePresence mode="wait">
        {activeTab === 'inventory' ? (
          <motion.div
            key="inventory"
            initial={{ opacity: 0, x: isRtl ? 50 : -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRtl ? -50 : 50 }}
            transition={{ duration: 0.3 }}
          >
            {inventoryLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <InventoryCardSkeleton key={i} isRtl={isRtl} />
                ))}
              </div>
            ) : paginatedInventory.length === 0 ? (
              <Card className="p-8 text-center bg-white rounded-xl shadow-md border border-gray-200">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg text-gray-600">{t('inventory.no_items')}</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {paginatedInventory.map((item) => (
                  <motion.div
                    key={item._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className="p-5 bg-white rounded-xl shadow-sm hover:shadow-lg transition-shadow duration-300 border border-gray-200">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-gray-900">{isRtl ? item.product.name : item.product.nameEn}</h3>
                          <p className="text-sm text-gray-500">{t('inventory.code')}: {item.product.code}</p>
                          <p className="text-sm text-gray-600">{t('inventory.stock')}: {item.currentStock}</p>
                          <p className="text-sm text-gray-600">{t('inventory.min_stock')}: {item.minStockLevel}</p>
                          <p className="text-sm text-gray-600">{t('inventory.max_stock')}: {item.maxStockLevel}</p>
                          <p className="text-sm text-gray-600">{t('inventory.unit')}: {isRtl ? item.product.unit : item.product.unitEn}</p>
                          <p className="text-sm text-gray-600">{t('inventory.department')}: {isRtl ? item.product.department.name : item.product.department.nameEn}</p>
                          <p
                            className={`text-sm font-medium ${
                              item.status === 'low' ? 'text-red-600' : item.status === 'full' ? 'text-yellow-600' : 'text-green-600'
                            }`}
                          >
                            {t(`inventory.status.${item.status}`)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleOpenEditStockModal(item)}
                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 py-2 transition-colors duration-200"
                            aria-label={t('inventory.edit_stock_levels')}
                          >
                            <Save className="w-4 h-4 mr-2" />
                            {t('inventory.edit')}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={item.currentStock <= 0}
                            onClick={() => handleOpenReturnModal(item)}
                            className="bg-red-600 hover:bg-red-700 text-white rounded-full px-4 py-2 transition-colors duration-200 disabled:opacity-50"
                            aria-label={t('inventory.return')}
                          >
                            {t('inventory.return')}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
            <Pagination totalPages={totalInventoryPages} />
          </motion.div>
        ) : (
          <motion.div
            key="history"
            initial={{ opacity: 0, x: isRtl ? -50 : 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRtl ? 50 : -50 }}
            transition={{ duration: 0.3 }}
          >
            {historyLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-amber-600 mx-auto"></div>
              </div>
            ) : (historyData?.history || []).length === 0 ? (
              <Card className="p-8 text-center bg-white rounded-xl shadow-md border border-gray-200">
                <HistoryIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg text-gray-600">{t('history.no_history')}</p>
              </Card>
            ) : (
              <Card className="p-4 bg-white rounded-xl shadow-md border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className={`p-3 text-left font-semibold ${isRtl ? 'text-right' : ''}`}>{t('history.date')}</th>
                      <th className={`p-3 text-left font-semibold ${isRtl ? 'text-right' : ''}`}>{t('history.product')}</th>
                      <th className={`p-3 text-left font-semibold ${isRtl ? 'text-right' : ''}`}>{t('history.action')}</th>
                      <th className={`p-3 text-left font-semibold ${isRtl ? 'text-right' : ''}`}>{t('history.quantity')}</th>
                      <th className={`p-3 text-left font-semibold ${isRtl ? 'text-right' : ''}`}>{t('history.reference')}</th>
                      <th className={`p-3 text-left font-semibold ${isRtl ? 'text-right' : ''}`}>{t('history.created_by')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(historyData?.history || []).map((entry: InventoryHistoryItem) => (
                      <tr key={entry._id} className="border-b hover:bg-gray-50">
                        <td className="p-3">{formatDate(entry.createdAt, language)}</td>
                        <td className="p-3">{isRtl ? entry.product.name : entry.product.nameEn}</td>
                        <td className="p-3">{t(`history.${entry.action}`)}</td>
                        <td className="p-3">{entry.quantity}</td>
                        <td className="p-3">{entry.reference}</td>
                        <td className="p-3">{entry.createdBy.username}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination totalPages={totalHistoryPages} />
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <Modal
        isOpen={isReturnModalOpen}
        onClose={() => {
          setIsReturnModalOpen(false);
          setReturnForm({ orderId: '', branchId: user?.branchId || '', reason: '', notes: '', items: [] });
          setReturnErrors({});
          setAvailableItems([]);
          setSelectedItem(null);
        }}
        title={t('returns.create_return')}
        className="max-w-2xl"
      >
        <div className="flex flex-col gap-6">
          <div className="grid gap-4">
            <p className="text-sm text-gray-600">
              {t('inventory.product')}: {isRtl ? selectedItem?.product.name : selectedItem?.product.nameEn}
            </p>
            <p className="text-sm text-gray-600">
              {t('inventory.available')}: {selectedItem?.currentStock}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('returns.order')}</label>
              <Select
                value={returnForm.orderId}
                onChange={(e) => setReturnForm({ ...returnForm, orderId: e.target.value || '', items: [] })}
                options={[{ value: '', label: t('returns.select_order') }].concat(
                  (ordersData || []).map((order: Order) => ({
                    value: order._id,
                    label: `${order.orderNumber} - ${formatDate(order.deliveredAt || order.createdAt, language)}`,
                  }))
                )}
                className={`w-full rounded-full border ${returnErrors.orderId ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-amber-500 focus:border-transparent`}
                aria-label={t('returns.order')}
              />
              {returnErrors.orderId && <p className="text-red-500 text-sm mt-1">{returnErrors.orderId}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('returns.reason')}</label>
              <Select
                value={returnForm.reason}
                onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value || '' })}
                options={reasonOptions}
                className={`w-full rounded-full border ${returnErrors.reason ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-amber-500 focus:border-transparent`}
                aria-label={t('returns.reason')}
              />
              {returnErrors.reason && <p className="text-red-500 text-sm mt-1">{returnErrors.reason}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('returns.notes_label')}</label>
              <Input
                type="text"
                value={returnForm.notes}
                onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value || '' })}
                className="w-full rounded-full border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                placeholder={t('returns.notes_placeholder')}
                aria-label={t('returns.notes_label')}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('returns.items')}</label>
            {returnForm.items.map((item, index) => (
              <div key={index} className="flex flex-col sm:flex-row gap-4 mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('returns.item')}</label>
                  <Select
                    value={item.itemId}
                    onChange={(e) => updateItemInReturn(index, 'itemId', e.target.value || '')}
                    options={[{ value: '', label: t('returns.select_item') }].concat(
                      (availableItems || [])
                        .filter((a) => a.productId === selectedItem?.product._id)
                        .map((a) => ({
                          value: a.itemId,
                          label: `${a.productName} (${t('inventory.available')}: ${a.available}, ${t('inventory.stock')}: ${a.stock})`,
                        }))
                    )}
                    className={`w-full rounded-full border ${returnErrors[`item_${index}_itemId`] ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-amber-500 focus:border-transparent`}
                    aria-label={t('returns.item')}
                    disabled={!returnForm.orderId}
                  />
                  {returnErrors[`item_${index}_itemId`] && (
                    <p className="text-red-500 text-sm mt-1">{returnErrors[`item_${index}_itemId`]}</p>
                  )}
                </div>
                <div className="w-24">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('returns.quantity')}</label>
                  <Input
                    type="number"
                    min="1"
                    max={item.maxQuantity}
                    value={item.quantity}
                    onChange={(e) => updateItemInReturn(index, 'quantity', parseInt(e.target.value || '1'))}
                    className={`w-full rounded-full border ${returnErrors[`item_${index}_quantity`] ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-amber-500 focus:border-transparent`}
                    aria-label={t('returns.quantity')}
                  />
                  {returnErrors[`item_${index}_quantity`] && (
                    <p className="text-red-500 text-sm mt-1">{returnErrors[`item_${index}_quantity`]}</p>
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('returns.reason')}</label>
                  <Select
                    value={item.reason}
                    onChange={(e) => updateItemInReturn(index, 'reason', e.target.value || '')}
                    options={reasonOptions}
                    className={`w-full rounded-full border ${returnErrors[`item_${index}_reason`] ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-amber-500 focus:border-transparent`}
                    aria-label={t('returns.reason')}
                  />
                  {returnErrors[`item_${index}_reason`] && (
                    <p className="text-red-500 text-sm mt-1">{returnErrors[`item_${index}_reason`]}</p>
                  )}
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => removeItemFromReturn(index)}
                  className="mt-6 bg-red-600 hover:bg-red-700 text-white rounded-full px-4 py-2 transition-colors duration-200"
                  aria-label={t('returns.remove_item')}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            ))}
            {returnErrors.items && <p className="text-red-500 text-sm mt-1">{returnErrors.items}</p>}
            <Button
              variant="secondary"
              onClick={addItemToReturn}
              className="mt-4 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full px-4 py-2 transition-colors duration-200"
              aria-label={t('returns.add_item')}
              disabled={availableItems.length === 0 || !returnForm.orderId}
            >
              <Plus className="w-5 h-5 mr-2" />
              {t('returns.add_item')}
            </Button>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setIsReturnModalOpen(false);
                setReturnForm({ orderId: '', branchId: user?.branchId || '', reason: '', notes: '', items: [] });
                setReturnErrors({});
                setAvailableItems([]);
                setSelectedItem(null);
              }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full px-4 py-2 transition-colors duration-200"
              aria-label={t('common.cancel')}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateReturn}
              disabled={createReturnMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-full px-4 py-2 transition-colors duration-200 disabled:opacity-50"
              aria-label={t('returns.submit_return')}
            >
              {createReturnMutation.isPending ? t('common.submitting') : t('returns.submit_return')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isEditStockModalOpen}
        onClose={() => {
          setIsEditStockModalOpen(false);
          setStockLevelForm({ minStockLevel: 0, maxStockLevel: 0 });
          setStockLevelErrors({});
          setSelectedItem(null);
        }}
        title={t('inventory.edit_stock_levels')}
        className="max-w-md"
      >
        <div className="flex flex-col gap-6">
          <p className="text-sm text-gray-600">
            {t('inventory.product')}: {isRtl ? selectedItem?.product.name : selectedItem?.product.nameEn}
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.min_stock')}</label>
            <Input
              type="number"
              min="0"
              value={stockLevelForm.minStockLevel}
              onChange={(e) => setStockLevelForm({ ...stockLevelForm, minStockLevel: parseInt(e.target.value || '0') })}
              className={`w-full rounded-full border ${stockLevelErrors.minStockLevel ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-amber-500 focus:border-transparent`}
              aria-label={t('inventory.min_stock')}
            />
            {stockLevelErrors.minStockLevel && <p className="text-red-500 text-sm mt-1">{stockLevelErrors.minStockLevel}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.max_stock')}</label>
            <Input
              type="number"
              min="0"
              value={stockLevelForm.maxStockLevel}
              onChange={(e) => setStockLevelForm({ ...stockLevelForm, maxStockLevel: parseInt(e.target.value || '0') })}
              className={`w-full rounded-full border ${stockLevelErrors.maxStockLevel ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-amber-500 focus:border-transparent`}
              aria-label={t('inventory.max_stock')}
            />
            {stockLevelErrors.maxStockLevel && <p className="text-red-500 text-sm mt-1">{stockLevelErrors.maxStockLevel}</p>}
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setIsEditStockModalOpen(false);
                setStockLevelForm({ minStockLevel: 0, maxStockLevel: 0 });
                setStockLevelErrors({});
                setSelectedItem(null);
              }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full px-4 py-2 transition-colors duration-200"
              aria-label={t('common.cancel')}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleUpdateStockLevels}
              disabled={updateStockLevelsMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-full px-4 py-2 transition-colors duration-200 disabled:opacity-50"
              aria-label={t('inventory.save_stock_levels')}
            >
              {updateStockLevelsMutation.isPending ? t('common.saving') : t('inventory.save')}
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
};

export default BranchInventory;