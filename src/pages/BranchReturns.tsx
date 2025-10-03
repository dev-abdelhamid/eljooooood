import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { returnsAPI, ordersAPI, inventoryAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Modal } from '../components/UI/Modal';
import { Package, Eye, Clock, Check, AlertCircle, Search, Download, Plus, X } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { debounce } from 'lodash';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from '../utils/formatDate';
import 'react-toastify/dist/ReactToastify.css';
import 'tailwindcss/tailwind.css';

const RETURNS_PER_PAGE = 10;

interface ReturnItem {
  itemId: string;
  productId: string;
  quantity: number;
  reason: string;
  maxQuantity: number;
}

interface FormData {
  orderId: string;
  branchId: string;
  reason: string;
  notes: string;
  items: ReturnItem[];
}

const BranchReturns: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedReturn, setSelectedReturn] = useState<any>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    orderId: '',
    branchId: user?.branchId || '',
    reason: '',
    notes: '',
    items: [],
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
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

  const statusOptions = useMemo(
    () => [
      { value: '', label: t('returns.status.all') },
      { value: 'pending_approval', label: t('returns.status.pending') },
      { value: 'approved', label: t('returns.status.approved') },
      { value: 'rejected', label: t('returns.status.rejected') },
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

  const STATUS_COLORS = useMemo(
    () => ({
      pending_approval: { color: 'bg-amber-100 text-amber-800', icon: Clock, label: t('returns.status.pending') },
      approved: { color: 'bg-green-100 text-green-800', icon: Check, label: t('returns.status.approved') },
      rejected: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: t('returns.status.rejected') },
    }),
    [t]
  );

  const getStatusInfo = useCallback(
    (status: string) => STATUS_COLORS[status] || { color: 'bg-gray-100 text-gray-800', icon: Clock, label: t(`returns.status.${status}`) },
    [STATUS_COLORS, t]
  );

  const { data: returnsData, isLoading, error } = useQuery({
    queryKey: ['returns', filterStatus, currentPage, user?.branchId, language],
    queryFn: async () => {
      if (!user?.branchId) throw new Error(t('errors.no_branch_associated'));
      const query = { status: filterStatus, branch: user.branchId, page: currentPage, limit: RETURNS_PER_PAGE, lang: language };
      const response = await returnsAPI.getAll(query);
      if (!Array.isArray(response.returns)) throw new Error('Invalid returns data format');
      return {
        returns: response.returns.map((ret: any) => ({
          id: ret._id || 'unknown',
          returnNumber: ret.returnNumber || t('returns.unknown'),
          order: {
            id: ret.order?._id || 'unknown',
            orderNumber: ret.order?.orderNumber || t('orders.unknown'),
            totalAmount: ret.order?.totalAmount || 0,
            createdAt: ret.order?.createdAt || new Date().toISOString(),
          },
          items: Array.isArray(ret.items)
            ? ret.items.map((item: any) => ({
                itemId: item.itemId || item._id || 'unknown',
                productId: item.product?._id || 'unknown',
                productName: isRtl ? item.product?.name : item.product?.nameEn || t('products.unknown'),
                quantity: item.quantity || 0,
                price: item.product?.price || 0,
                reason: isRtl ? item.reason : item.reasonEn || item.reason || 'unknown',
                unit: isRtl ? item.product?.unit : item.product?.unitEn || 'N/A',
                departmentName: isRtl ? item.product?.department?.name : item.product?.department?.nameEn || 'Unknown',
              }))
            : [],
          status: ret.status || 'pending_approval',
          date: formatDate(ret.createdAt || new Date().toISOString(), language),
          createdAt: ret.createdAt || new Date().toISOString(),
          notes: isRtl ? ret.notes : ret.notesEn || ret.notes || '',
          reviewNotes: isRtl ? ret.reviewNotes : ret.reviewNotesEn || ret.reviewNotes || '',
          branch: { _id: ret.branch?._id || 'unknown', name: isRtl ? ret.branch?.name : ret.branch?.nameEn || t('branches.unknown') },
          department: ret.order?.department || { _id: 'unknown', name: t('departments.unknown') },
        })),
        total: response.total,
      };
    },
    staleTime: 5 * 60 * 1000,
    onError: (err: any) => {
      toast.error(err.message || t('errors.fetch_returns'), toastOptions);
    },
  });

  const { data: inventoryData } = useQuery({
    queryKey: ['inventory', user?.branchId, language],
    queryFn: async () => {
      if (!user?.branchId) return [];
      const response = await inventoryAPI.getByBranch(user.branchId);
      return response.map((item: any) => ({
        productId: item.product._id,
        productName: isRtl ? item.product.name : item.product.nameEn,
        currentStock: item.currentStock,
        unit: isRtl ? item.product.unit : item.product.unitEn,
      }));
    },
    enabled: !!user?.branchId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: deliveredOrders } = useQuery({
    queryKey: ['deliveredOrders', user?.branchId, language],
    queryFn: async () => {
      if (!user?.branchId) return [];
      const response = await ordersAPI.getAll({ branch: user.branchId, status: 'delivered' });
      return response.orders || [];
    },
    enabled: !!user?.branchId,
    staleTime: 5 * 60 * 1000,
  });

  useQuery({
    queryKey: ['selectedOrder', formData.orderId, language],
    queryFn: async () => {
      if (!formData.orderId) return null;
      const order = await ordersAPI.getById(formData.orderId);
      const items = order.items.map((i: any) => {
        const inv = inventoryData?.find((inv: any) => inv.productId === i.product._id) || { currentStock: 0 };
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
    enabled: !!formData.orderId,
  });

  const validateFormData = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!formData.orderId.trim()) errors.orderId = t('errors.required', { field: t('returns.order_id') });
    if (!formData.reason.trim()) errors.reason = t('errors.required', { field: t('returns.reason') });
    if (formData.items.length === 0) errors.items = t('errors.required', { field: t('returns.items') });
    formData.items.forEach((item, index) => {
      if (!item.itemId) errors[`item_${index}_productId`] = t('errors.required', { field: t('returns.product') });
      if (!item.reason.trim()) errors[`item_${index}_reason`] = t('errors.required', { field: t('returns.reason') });
      const maxQty = item.maxQuantity || 0;
      if (item.quantity < 1 || item.quantity > maxQty || isNaN(item.quantity)) {
        errors[`item_${index}_quantity`] = t('errors.invalid_quantity_max', { max: maxQty });
      }
    });
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, t]);

  const createReturnMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!validateFormData()) {
        throw new Error(t('errors.invalid_form'));
      }
      const payload = {
        orderId: data.orderId,
        branchId: data.branchId,
        reason: data.reason,
        notes: data.notes,
        items: data.items.map((item) => ({
          itemId: item.itemId,
          productId: item.productId,
          quantity: Number(item.quantity),
          reason: item.reason,
        })),
      };
      console.log(`[${new Date().toISOString()}] returnsAPI.createReturn - Sending:`, payload);
      const response = await returnsAPI.createReturn(payload);
      // Update inventory after successful return creation
      const inventoryUpdates = data.items.map((item) => ({
        productId: item.productId,
        branchId: data.branchId,
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
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryHistory'] });
      setIsCreateModalOpen(false);
      setFormData({ orderId: '', branchId: user?.branchId || '', reason: '', notes: '', items: [] });
      setFormErrors({});
      setAvailableItems([]);
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
        setFormErrors(backendErrors);
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
    socket.on('returnCreated', (data) => {
      if (data.branchId === user?.branchId) {
        queryClient.invalidateQueries({ queryKey: ['returns'] });
        toast.success(t('returns.new_return_notification', { returnNumber: data.returnNumber }), toastOptions);
      }
    });
    socket.on('returnStatusUpdated', (data) => {
      if (data.branchId === user?.branchId) {
        queryClient.invalidateQueries({ queryKey: ['returns'] });
        toast.info(t('socket.return_status_updated', { status: t(`returns.status.${data.status}`) }), toastOptions);
      }
    });
    return () => {
      socket.off('connect');
      socket.off('returnCreated');
      socket.off('returnStatusUpdated');
      socket.disconnect();
    };
  }, [socket, user, queryClient, t, toastOptions]);

  const debouncedSetSearchQuery = useMemo(() => debounce((value: string) => setSearchQuery(value.trim()), 300), []);

  const filteredReturns = useMemo(
    () =>
      (returnsData?.returns || []).filter(
        (ret) =>
          ret.returnNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ret.order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (ret.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          ret.branch.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [returnsData, searchQuery]
  );

  const sortedReturns = useMemo(
    () => [...filteredReturns].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [filteredReturns]
  );

  const paginatedReturns = useMemo(
    () => sortedReturns.slice((currentPage - 1) * RETURNS_PER_PAGE, currentPage * RETURNS_PER_PAGE),
    [sortedReturns, currentPage]
  );

  const totalPages = Math.ceil(sortedReturns.length / RETURNS_PER_PAGE);

  const handleCreateReturn = useCallback(() => {
    createReturnMutation.mutate(formData);
  }, [createReturnMutation, formData]);

  const addItemToForm = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { itemId: '', productId: '', quantity: 1, reason: '', maxQuantity: 0 }],
    }));
  }, []);

  const updateItemInForm = useCallback((index: number, field: string, value: any) => {
    setFormData((prev) => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      if (field === 'productId') {
        const sel = availableItems.find((a) => a.productId === value);
        if (sel) {
          newItems[index].itemId = sel.itemId;
          newItems[index].maxQuantity = Math.min(sel.available, sel.stock);
        }
      }
      return { ...prev, items: newItems };
    });
  }, [availableItems]);

  const removeItemFromForm = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_: any, i: number) => i !== index),
    }));
  }, []);

  const exportToExcel = useCallback(() => {
    const exportData = sortedReturns.map((ret) => ({
      [t('returns.return_number')]: ret.returnNumber,
      [t('returns.order_number')]: ret.order.orderNumber,
      [t('returns.status_label')]: getStatusInfo(ret.status).label,
      [t('returns.date')]: ret.date,
      [t('returns.items_count')]: ret.items.length,
      [t('returns.branch')]: ret.branch.name,
      [t('returns.notes_label')]: ret.notes || t('returns.no_notes'),
      [t('returns.review_notes')]: ret.reviewNotes || t('returns.no_notes'),
    }));
    const ws = XLSX.utils.json_to_sheet(isRtl ? exportData.map((row) => Object.fromEntries(Object.entries(row).reverse())) : exportData);
    ws['!cols'] = Object.keys(exportData[0] || {}).map(() => ({ wpx: 120 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Returns');
    XLSX.writeFile(wb, `Returns_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(t('returns.export_success'), toastOptions);
  }, [sortedReturns, isRtl, t, getStatusInfo]);

  const exportToPDF = useCallback(async () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFont('Amiri', 'normal');
      const headers = [
        t('returns.return_number'),
        t('returns.order_number'),
        t('returns.status_label'),
        t('returns.date'),
        t('returns.items_count'),
        t('returns.branch'),
        t('returns.notes_label'),
        t('returns.review_notes'),
      ];
      const data = sortedReturns.map((ret) => [
        ret.returnNumber,
        ret.order.orderNumber,
        getStatusInfo(ret.status).label,
        ret.date,
        ret.items.length.toString(),
        ret.branch.name,
        ret.notes || t('returns.no_notes'),
        ret.reviewNotes || t('returns.no_notes'),
      ]);
      const finalHeaders = isRtl ? headers.reverse() : headers;
      const finalData = isRtl ? data.map((row) => row.reverse()) : data;
      autoTable(doc, {
        head: [finalHeaders],
        body: finalData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 10, halign: isRtl ? 'right' : 'left', font: 'Amiri' },
        bodyStyles: { fontSize: 9, halign: isRtl ? 'right' : 'left', cellPadding: 4, font: 'Amiri' },
        columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 30 } },
        margin: { top: 20 },
      });
      doc.save(`Returns_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success(t('returns.pdf_export_success'), toastOptions);
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error(t('errors.pdf_export'), toastOptions);
    }
  }, [sortedReturns, isRtl, t, getStatusInfo, toastOptions]);

  const ReturnCard = useMemo(
    () =>
      ({ ret }: { ret: any }) => {
        const statusInfo = getStatusInfo(ret.status);
        const StatusIcon = statusInfo.icon;
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col"
          >
            <Card className="p-4 sm:p-5 bg-white shadow-md hover:shadow-xl transition-shadow duration-300 rounded-lg border border-gray-200">
              <div className="flex flex-col gap-4">
                <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${isRtl ? 'sm:flex-row-reverse' : ''}`}>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {t('returns.return_number', { returnNumber: ret.returnNumber })}
                  </h3>
                  <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
                    <StatusIcon className="w-5 h-5" />
                    <span>{statusInfo.label}</span>
                  </span>
                </div>
                <div className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <p className="text-sm text-gray-500">{t('returns.order_number')}</p>
                    <p className="text-base font-medium text-gray-900">{ret.order.orderNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{t('returns.items_count')}</p>
                    <p className="text-base font-medium text-gray-900">{ret.items.length} {t('returns.item')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{t('returns.date')}</p>
                    <p className="text-base font-medium text-gray-900">{ret.date}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{t('returns.branch')}</p>
                    <p className="text-base font-medium text-gray-900">{ret.branch.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{t('returns.total_amount')}</p>
                    <p className="text-base font-medium text-teal-600">{ret.items.reduce((sum: number, item: any) => sum + (item.price || 0) * item.quantity, 0)} {t('currency')}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {ret.items.map((item: any, index: number) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-md border border-gray-100">
                      <p className="text-base font-medium text-gray-900">{item.productName}</p>
                      <p className="text-sm text-gray-600">{t('returns.quantity', { quantity: item.quantity })}</p>
                      <p className="text-sm text-gray-600">{t('returns.unit', { unit: item.unit })}</p>
                      <p className="text-sm text-gray-600">{t('returns.department', { department: item.departmentName })}</p>
                      <p className="text-sm text-gray-600">{t('returns.reason', { reason: item.reason })}</p>
                      {item.price && (
                        <p className="text-sm text-gray-600">{t('returns.price', { price: item.price })} {t('currency')}</p>
                      )}
                    </div>
                  ))}
                </div>
                {ret.notes && (
                  <div className="p-3 bg-amber-50 rounded-md border border-amber-100">
                    <p className="text-sm text-amber-800"><strong>{t('returns.notes_label')}:</strong> {ret.notes}</p>
                  </div>
                )}
                {ret.reviewNotes && (
                  <div className="p-3 bg-blue-50 rounded-md border border-blue-100">
                    <p className="text-sm text-blue-800"><strong>{t('returns.review_notes')}:</strong> {ret.reviewNotes}</p>
                  </div>
                )}
                <div className="flex justify-end">
                  <Button
                    variant="primary"
                    size="md"
                    icon={Eye}
                    onClick={() => {
                      setSelectedReturn(ret);
                      setIsViewModalOpen(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 py-2 transition-colors duration-200"
                    aria-label={t('returns.view_return', { returnNumber: ret.returnNumber })}
                  >
                    {t('returns.view')}
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        );
      },
    [isRtl, t, getStatusInfo]
  );

  const Pagination = () => (
    sortedReturns.length > RETURNS_PER_PAGE && (
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen bg-gray-50"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <AnimatePresence>
        {isLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="min-h-screen flex items-center justify-center"
          >
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-amber-600"></div>
          </motion.div>
        ) : error ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex justify-center"
          >
            <Card className="p-6 max-w-md text-center bg-red-50 shadow-lg rounded-lg border border-red-200">
              <div className={`flex items-center justify-center gap-3 mb-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <AlertCircle className="w-8 h-8 text-red-600" />
                <p className="text-lg font-semibold text-red-600">{error.message}</p>
              </div>
              <Button
                variant="primary"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['returns'] })}
                className="bg-amber-600 hover:bg-amber-700 text-white rounded-full px-6 py-2 transition-colors duration-200"
                aria-label={t('common.retry')}
              >
                {t('common.retry')}
              </Button>
            </Card>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-6">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="sticky top-0 z-10 bg-gray-50 py-4 border-b border-gray-100"
            >
              <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${isRtl ? 'sm:flex-row-reverse' : ''}`}>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{t('returns.title')}</h1>
                  <p className="text-base text-gray-600 mt-1">{t('returns.subtitle')}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-full px-4 py-2 transition-colors duration-200"
                    aria-label={t('returns.create_return')}
                  >
                    <Plus className="w-5 h-5" />
                    <span>{t('returns.create_return')}</span>
                  </Button>
                  <Button
                    variant="primary"
                    onClick={exportToExcel}
                    className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white rounded-full px-4 py-2 transition-colors duration-200"
                    aria-label={t('returns.export_excel')}
                  >
                    <Download className="w-5 h-5" />
                    <span>{t('returns.export_excel')}</span>
                  </Button>
                  <Button
                    variant="primary"
                    onClick={exportToPDF}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 py-2 transition-colors duration-200"
                    aria-label={t('returns.export_pdf')}
                  >
                    <Download className="w-5 h-5" />
                    <span>{t('returns.export_pdf')}</span>
                  </Button>
                </div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col sm:flex-row gap-4 items-center"
            >
              <div className="relative flex-1">
                <Search className={`absolute top-1/2 transform -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} w-5 h-5 text-gray-400`} />
                <Input
                  type="text"
                  placeholder={t('returns.search_placeholder')}
                  value={searchQuery}
                  onChange={(e) => debouncedSetSearchQuery(e.target.value || '')}
                  className={`pl-10 pr-4 py-2 w-full rounded-full border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent ${isRtl ? 'text-right pr-10' : 'text-left'}`}
                  aria-label={t('returns.search_placeholder')}
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
                aria-label={t('returns.filter_status')}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="grid gap-6"
            >
              {paginatedReturns.length === 0 ? (
                <Card className="p-6 text-center bg-gray-100 shadow-md rounded-lg border border-gray-200">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-gray-600">{t('returns.no_returns')}</p>
                </Card>
              ) : (
                paginatedReturns.map((ret: any) => <ReturnCard key={ret.id} ret={ret} />)
              )}
            </motion.div>
            <Pagination />
          </div>
        )}
      </AnimatePresence>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setFormData({ orderId: '', branchId: user?.branchId || '', reason: '', notes: '', items: [] });
          setFormErrors({});
          setAvailableItems([]);
        }}
        title={t('returns.create_return')}
        className="max-w-2xl"
      >
        <div className="flex flex-col gap-6">
          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('returns.order_id')}</label>
              <Select
                value={formData.orderId}
                onChange={(e) => setFormData({ ...formData, orderId: e.target.value || '', items: [] })}
                options={[
                  { value: '', label: t('returns.select_order') },
                  ...(deliveredOrders || []).map((order: any) => ({
                    value: order._id,
                    label: `${order.orderNumber} - ${formatDate(order.deliveredAt || order.createdAt, language)}`,
                  })),
                ]}
                className={`w-full rounded-full border ${formErrors.orderId ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-amber-500 focus:border-transparent`}
                aria-label={t('returns.order_id')}
              />
              {formErrors.orderId && <p className="text-red-500 text-sm mt-1">{formErrors.orderId}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('returns.reason')}</label>
              <Select
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value || '' })}
                options={reasonOptions}
                className={`w-full rounded-full border ${formErrors.reason ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-amber-500 focus:border-transparent`}
                aria-label={t('returns.reason')}
              />
              {formErrors.reason && <p className="text-red-500 text-sm mt-1">{formErrors.reason}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('returns.notes_label')}</label>
              <Input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value || '' })}
                className="w-full rounded-full border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                placeholder={t('returns.notes_placeholder')}
                aria-label={t('returns.notes_label')}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('returns.items')}</label>
            {formData.items.map((item: any, index: number) => (
              <div key={index} className="flex flex-col sm:flex-row gap-4 mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('returns.product')}</label>
                  <Select
                    value={item.productId}
                    onChange={(e) => updateItemInForm(index, 'productId', e.target.value || '')}
                    options={[
                      { value: '', label: t('returns.select_product') },
                      ...availableItems.map((a: any) => ({
                        value: a.productId,
                        label: `${a.productName} (available: ${a.available}, stock: ${a.stock})`,
                      })),
                    ]}
                    className={`w-full rounded-full border ${formErrors[`item_${index}_productId`] ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-amber-500 focus:border-transparent`}
                    aria-label={t('returns.product')}
                  />
                  {formErrors[`item_${index}_productId`] && (
                    <p className="text-red-500 text-sm mt-1">{formErrors[`item_${index}_productId`]}</p>
                  )}
                </div>
                <div className="w-24">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('returns.quantity')}</label>
                  <Input
                    type="number"
                    min="1"
                    max={item.maxQuantity}
                    value={item.quantity}
                    onChange={(e) => updateItemInForm(index, 'quantity', parseInt(e.target.value || '1'))}
                    className={`w-full rounded-full border ${formErrors[`item_${index}_quantity`] ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-amber-500 focus:border-transparent`}
                    aria-label={t('returns.quantity')}
                  />
                  {formErrors[`item_${index}_quantity`] && (
                    <p className="text-red-500 text-sm mt-1">{formErrors[`item_${index}_quantity`]}</p>
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('returns.reason')}</label>
                  <Select
                    value={item.reason}
                    onChange={(e) => updateItemInForm(index, 'reason', e.target.value || '')}
                    options={reasonOptions}
                    className={`w-full rounded-full border ${formErrors[`item_${index}_reason`] ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-amber-500 focus:border-transparent`}
                    aria-label={t('returns.reason')}
                  />
                  {formErrors[`item_${index}_reason`] && (
                    <p className="text-red-500 text-sm mt-1">{formErrors[`item_${index}_reason`]}</p>
                  )}
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => removeItemFromForm(index)}
                  className="mt-6 bg-red-600 hover:bg-red-700 text-white rounded-full px-4 py-2 transition-colors duration-200"
                  aria-label={t('returns.remove_item')}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            ))}
            {formErrors.items && <p className="text-red-500 text-sm mt-1">{formErrors.items}</p>}
            <Button
              variant="secondary"
              onClick={addItemToForm}
              className="mt-4 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full px-4 py-2 transition-colors duration-200"
              aria-label={t('returns.add_item')}
              disabled={availableItems.length === 0}
            >
              {t('returns.add_item')}
            </Button>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setIsCreateModalOpen(false);
                setFormData({ orderId: '', branchId: user?.branchId || '', reason: '', notes: '', items: [] });
                setFormErrors({});
                setAvailableItems([]);
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
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={t('returns.view_return', { returnNumber: selectedReturn?.returnNumber || '' })}
        className="max-w-2xl"
      >
        {selectedReturn && (
          <div className="flex flex-col gap-6">
            <div className="grid gap-4">
              <div>
                <p className="text-sm text-gray-500">{t('returns.return_number')}</p>
                <p className="text-base font-medium text-gray-900">{selectedReturn.returnNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('returns.order_number')}</p>
                <p className="text-base font-medium text-gray-900">{selectedReturn.order.orderNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('returns.status_label')}</p>
                <span
                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusInfo(selectedReturn.status).color}`}
                >
                  {getStatusInfo(selectedReturn.status).label}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('returns.date')}</p>
                <p className="text-base font-medium text-gray-900">{selectedReturn.date}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('returns.branch')}</p>
                <p className="text-base font-medium text-gray-900">{selectedReturn.branch.name}</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">{t('returns.items')}</p>
              {selectedReturn.items.map((item: any, index: number) => (
                <div key={index} className="p-3 bg-gray-50 rounded-md border border-gray-100 mb-2">
                  <p className="text-base font-medium text-gray-900">{item.productName}</p>
                  <p className="text-sm text-gray-600">{t('returns.quantity', { quantity: item.quantity })}</p>
                  <p className="text-sm text-gray-600">{t('returns.unit', { unit: item.unit })}</p>
                  <p className="text-sm text-gray-600">{t('returns.department', { department: item.departmentName })}</p>
                  <p className="text-sm text-gray-600">{t('returns.reason', { reason: item.reason })}</p>
                  {item.price && (
                    <p className="text-sm text-gray-600">{t('returns.price', { price: item.price })} {t('currency')}</p>
                  )}
                </div>
              ))}
            </div>
            {selectedReturn.notes && (
              <div className="p-3 bg-amber-50 rounded-md border border-amber-100">
                <p className="text-sm text-amber-800"><strong>{t('returns.notes_label')}:</strong> {selectedReturn.notes}</p>
              </div>
            )}
            {selectedReturn.reviewNotes && (
              <div className="p-3 bg-blue-50 rounded-md border border-blue-100">
                <p className="text-sm text-blue-800"><strong>{t('returns.review_notes')}:</strong> {selectedReturn.reviewNotes}</p>
              </div>
            )}
            <div className="flex justify-end">
              <Button
                variant="secondary"
                onClick={() => setIsViewModalOpen(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full px-4 py-2 transition-colors duration-200"
                aria-label={t('common.close')}
              >
                {t('common.close')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </motion.div>
  );
};

export default BranchReturns;