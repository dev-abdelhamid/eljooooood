import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { returnsAPI, inventoryAPI, salesAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Modal } from '../components/UI/Modal';
import { Package, Eye, Clock, Check, AlertCircle, Search, Download, Plus } from 'lucide-react';
import { io } from 'socket.io-client';
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

const BranchReturns = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    orderId: '',
    branchId: user?.branchId || '',
    reason: '',
    notes: '',
    items: [],
  });

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

  const socket = useMemo(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'https://api.example.com';
    try {
      return io(apiUrl, {
        auth: { token: localStorage.getItem('token') },
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Socket initialization error:`, err);
      toast.error(t('errors.socket_init'), toastOptions);
      return null;
    }
  }, [t, toastOptions]);

  const statusOptions = useMemo(
    () => [
      { value: '', label: t('returns.status.all') },
      { value: 'pending', label: t('returns.status.pending') },
      { value: 'approved', label: t('returns.status.approved') },
      { value: 'rejected', label: t('returns.status.rejected') },
      { value: 'processed', label: t('returns.status.processed') },
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
      pending: { color: 'bg-amber-100 text-amber-800', icon: Clock, label: t('returns.status.pending') },
      approved: { color: 'bg-green-100 text-green-800', icon: Check, label: t('returns.status.approved') },
      rejected: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: t('returns.status.rejected') },
      processed: { color: 'bg-blue-100 text-blue-800', icon: Check, label: t('returns.status.processed') },
    }),
    [t]
  );

  const getStatusInfo = useCallback(
    (status) => STATUS_COLORS[status] || { color: 'bg-gray-100 text-gray-800', icon: Clock, label: t(`returns.status.${status}`) },
    [STATUS_COLORS, t]
  );

  const { data: returnsData, isLoading, error } = useQuery({
    queryKey: ['returns', filterStatus, currentPage, user?.branchId],
    queryFn: async () => {
      if (!user?.branchId) throw new Error(t('errors.no_branch_associated'));
      const query = { status: filterStatus, branch: user.branchId, page: currentPage, limit: RETURNS_PER_PAGE };
      const { returns: returnsData, total } = await returnsAPI.getAll(query);
      if (!Array.isArray(returnsData)) throw new Error('Invalid returns data format');
      return {
        returns: returnsData.map((ret) => ({
          id: ret._id || 'unknown',
          returnNumber: ret.returnNumber || t('returns.unknown'),
          order: {
            id: ret.order?._id || 'unknown',
            orderNumber: ret.order?.orderNumber || t('orders.unknown'),
            totalAmount: ret.order?.totalAmount || 0,
            createdAt: ret.order?.createdAt || new Date().toISOString(),
          },
          items: Array.isArray(ret.items)
            ? ret.items.map((item) => ({
                itemId: item.itemId || item._id || 'unknown',
                productId: item.product?._id || 'unknown',
                productName: isRtl ? item.product?.name : item.product?.nameEn || t('products.unknown'),
                quantity: item.quantity || 0,
                price: item.product?.price || 0,
                reason: isRtl ? item.reason : item.reasonEn || item.reason || 'unknown',
              }))
            : [],
          status: ret.status || 'pending',
          date: formatDate(ret.createdAt || new Date().toISOString(), language),
          createdAt: ret.createdAt || new Date().toISOString(),
          notes: isRtl ? ret.notes : ret.notesEn || ret.notes || '',
          reviewNotes: isRtl ? ret.reviewNotes : ret.reviewNotesEn || ret.reviewNotes || '',
          branch: { _id: ret.branch?._id || 'unknown', name: isRtl ? ret.branch?.name : ret.branch?.nameEn || t('branches.unknown') },
          department: ret.order?.department || { _id: 'unknown', name: t('departments.unknown') },
        })),
        total,
      };
    },
    onError: (err) => {
      toast.error(err.message || t('errors.fetch_returns'), toastOptions);
    },
  });

  const { data: inventoryData } = useQuery({
    queryKey: ['inventory', user?.branchId],
    queryFn: async () => {
      if (!user?.branchId) return [];
      const response = await inventoryAPI.getByBranch(user.branchId);
      return response.map((item) => ({
        productId: item.product._id,
        productName: isRtl ? item.product.name : item.product.nameEn,
        currentStock: item.currentStock,
        unit: isRtl ? item.product.unit : item.product.unitEn,
      }));
    },
    enabled: !!user?.branchId,
  });

  const { data: salesData } = useQuery({
    queryKey: ['sales', user?.branchId],
    queryFn: async () => {
      if (!user?.branchId) return [];
      const response = await salesAPI.getAll({ branch: user.branchId });
      return response.sales || [];
    },
    enabled: !!user?.branchId,
  });

  const createReturnMutation = useMutation({
    mutationFn: (data) => returnsAPI.createReturn(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['returns']);
      setIsCreateModalOpen(false);
      setFormData({ orderId: '', branchId: user?.branchId || '', reason: '', notes: '', items: [] });
      toast.success(t('returns.create_success'), toastOptions);
    },
    onError: (err) => {
      toast.error(err.message || t('errors.create_return'), toastOptions);
    },
  });

  useEffect(() => {
    if (!socket) return;
    socket.on('connect', () => {
      socket.emit('joinRoom', { role: user?.role, branchId: user?.branchId, userId: user?._id });
      toast.info(t('socket.connected'), toastOptions);
    });
    socket.on('returnCreated', (data) => {
      if (data.branchId === user?.branchId) {
        queryClient.invalidateQueries(['returns']);
        toast.success(t('returns.new_return_notification', { returnNumber: data.returnNumber }), toastOptions);
      }
    });
    socket.on('returnStatusUpdated', (data) => {
      if (data.branchId === user?.branchId) {
        queryClient.invalidateQueries(['returns']);
        toast.info(t('socket.return_status_updated', { status: t(`returns.status.${data.status}`) }), toastOptions);
      }
    });
    return () => {
      socket.off('connect');
      socket.off('returnCreated');
      socket.off('returnStatusUpdated');
    };
  }, [socket, user, queryClient, t, toastOptions]);

  const debouncedSetSearchQuery = useMemo(() => debounce((value) => setSearchQuery(value), 300), []);

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

  const handleCreateReturn = () => {
    createReturnMutation.mutate(formData);
  };

  const addItemToForm = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { productId: '', quantity: 1, reason: '' }],
    }));
  };

  const updateItemInForm = (index, field, value) => {
    setFormData((prev) => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const removeItemFromForm = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

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
      doc.setLanguage(isRtl ? 'ar' : 'en');
      const fontUrl = '/fonts/Amiri-Regular.ttf';
      const fontName = 'Amiri';
      const fontBytes = await fetch(fontUrl).then((res) => {
        if (!res.ok) throw new Error('Failed to fetch font');
        return res.arrayBuffer();
      });
      const base64Font = btoa(String.fromCharCode(...new Uint8Array(fontBytes)));
      doc.addFileToVFS(`${fontName}-Regular.ttf`, base64Font);
      doc.addFont(`${fontName}-Regular.ttf`, fontName, 'normal');
      doc.setFont(fontName);
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
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 10, halign: isRtl ? 'right' : 'left', font: fontName },
        bodyStyles: { fontSize: 9, halign: isRtl ? 'right' : 'left', font: fontName, cellPadding: 4 },
        columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 30 } },
        margin: { top: 20 },
        didDrawPage: (data) => {
          doc.setFont(fontName);
          doc.text(t('returns.title'), isRtl ? doc.internal.pageSize.width - data.settings.margin.right : data.settings.margin.left, 10, {
            align: isRtl ? 'right' : 'left',
          });
        },
      });
      doc.save(`Returns_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success(t('returns.pdf_export_success'), toastOptions);
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error(t('errors.pdf_export'), toastOptions);
    }
  }, [sortedReturns, isRtl, t, getStatusInfo, toastOptions]);

  const ReturnCard = ({ ret }) => {
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
                <p className="text-base font-medium text-teal-600">{ret.items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0)} {t('currency')}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {ret.items.map((item, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-md border border-gray-100">
                  <p className="text-base font-medium text-gray-900">{item.productName}</p>
                  <p className="text-sm text-gray-600">{t('returns.quantity', { quantity: item.quantity })}</p>
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
  };

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
                onClick={() => queryClient.invalidateQueries(['returns'])}
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
            >
              <Card className="p-4 sm:p-5 bg-white shadow-lg rounded-lg border border-gray-200">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.search')}</label>
                    <div className="flex items-center rounded-md border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
                      <Search className={`w-5 h-5 text-gray-400 absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2`} />
                      <Input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => debouncedSetSearchQuery(e.target.value)}
                        placeholder={t('returns.search_placeholder')}
                        className={`w-full ${isRtl ? 'pr-10 pl-3' : 'pl-10 pr-3'} py-2 rounded-md bg-transparent text-base text-gray-900 border-0 focus:ring-2 focus:ring-amber-500 transition-colors duration-200`}
                        aria-label={t('common.search')}
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <Select
                      label={t('returns.filter_by_status')}
                      options={statusOptions}
                      value={filterStatus}
                      onChange={setFilterStatus}
                      className="w-full rounded-md border-gray-200 text-base focus:ring-amber-500 transition-colors duration-200"
                      aria-label={t('returns.filter_by_status')}
                    />
                  </div>
                </div>
                <div className="text-sm text-center text-gray-600 mt-3">{t('returns.returns_count', { count: filteredReturns.length })}</div>
              </Card>
            </motion.div>
            <div className="flex flex-col gap-4">
              {paginatedReturns.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="p-6 text-center bg-white shadow-lg rounded-lg border border-gray-200">
                    <Package className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('returns.no_returns')}</h3>
                    <p className="text-base text-gray-600">{filterStatus || searchQuery ? t('returns.no_matching_returns') : t('returns.no_returns_yet')}</p>
                  </Card>
                </motion.div>
              ) : (
                paginatedReturns.map((ret) => <ReturnCard key={ret.id} ret={ret} />)
              )}
            </div>
            <Pagination />
            <AnimatePresence>
              {isViewModalOpen && selectedReturn && (
                <Modal
                  isOpen={isViewModalOpen}
                  onClose={() => setIsViewModalOpen(false)}
                  title={t('returns.view_return_title', { returnNumber: selectedReturn.returnNumber })}
                  size="lg"
                  className="bg-white rounded-lg shadow-xl"
                >
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="flex flex-col gap-4">
                    <div className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div>
                        <p className="text-sm text-gray-500">{t('returns.return_number')}</p>
                        <p className="text-base font-medium text-gray-900">{selectedReturn.returnNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">{t('returns.status_label')}</p>
                        <p className={`text-base font-medium ${getStatusInfo(selectedReturn.status).color}`}>{getStatusInfo(selectedReturn.status).label}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">{t('returns.date')}</p>
                        <p className="text-base font-medium text-gray-900">{selectedReturn.date}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">{t('returns.order_number')}</p>
                        <p className="text-base font-medium text-gray-900">{selectedReturn.order.orderNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">{t('returns.branch')}</p>
                        <p className="text-base font-medium text-gray-900">{selectedReturn.branch.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">{t('returns.total_amount')}</p>
                        <p className="text-base font-medium text-teal-600">{selectedReturn.items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0)} {t('currency')}</p>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-3">{t('returns.items')}</h4>
                      <div className="flex flex-col gap-2">
                        {selectedReturn.items.map((item, index) => (
                          <div key={index} className={`p-3 bg-gray-50 rounded-md border border-gray-100 ${isRtl ? 'text-right' : 'text-left'}`}>
                            <p className="text-base font-medium text-gray-900">{item.productName}</p>
                            <p className="text-sm text-gray-600">{t('returns.quantity', { quantity: item.quantity })}</p>
                            <p className="text-sm text-gray-600">{t('returns.reason', { reason: item.reason })}</p>
                            <p className="text-sm text-gray-600">{t('returns.item_total', { total: item.price ? item.quantity * item.price : 0 })} {t('currency')}</p>
                          </div>
                        ))}
                      </div>
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
                    <div className="border-t pt-3 border-gray-200">
                      <div className={`flex items-center justify-between text-base font-semibold text-gray-900 ${isRtl ? 'flex-row-reverse' : ''}`}>
                        <span>{t('returns.final_total')}</span>
                        <span className="text-teal-600">{selectedReturn.items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0)} {t('currency')}</span>
                      </div>
                    </div>
                    <div className={`flex justify-end gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <Button
                        variant="secondary"
                        onClick={() => setIsViewModalOpen(false)}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full px-4 py-2 transition-colors duration-200"
                        aria-label={t('common.close')}
                      >
                        {t('common.close')}
                      </Button>
                    </div>
                  </motion.div>
                </Modal>
              )}
              {isCreateModalOpen && (
                <Modal
                  isOpen={isCreateModalOpen}
                  onClose={() => setIsCreateModalOpen(false)}
                  title={t('returns.create_return')}
                  size="lg"
                  className="bg-white rounded-lg shadow-xl"
                >
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="flex flex-col gap-4">
                    <div>
                      <Select
                        label={t('returns.order_id')}
                        options={(salesData || []).map((sale) => ({
                          value: sale._id,
                          label: sale.orderNumber || sale._id,
                        }))}
                        value={formData.orderId}
                        onChange={(value) => setFormData((prev) => ({ ...prev, orderId: value }))}
                        className="w-full rounded-md border-gray-200 text-base focus:ring-amber-500 transition-colors duration-200"
                      />
                    </div>
                    <div>
                      <Select
                        label={t('returns.reason')}
                        options={reasonOptions}
                        value={formData.reason}
                        onChange={(value) => setFormData((prev) => ({ ...prev, reason: value }))}
                        className="w-full rounded-md border-gray-200 text-base focus:ring-amber-500 transition-colors duration-200"
                      />
                    </div>
                    <div>
                      <Input
                        label={t('returns.notes_label')}
                        value={formData.notes}
                        onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                        placeholder={t('returns.enter_notes')}
                        className="w-full rounded-md border-gray-200 text-base focus:ring-amber-500 transition-colors duration-200"
                      />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-3">{t('returns.items')}</h4>
                      {formData.items.map((item, index) => (
                        <div key={index} className="flex flex-col gap-2 p-3 bg-gray-50 rounded-md border border-gray-100 mb-2">
                          <Select
                            label={t('returns.product')}
                            options={(inventoryData || []).map((inv) => ({
                              value: inv.productId,
                              label: inv.productName,
                            }))}
                            value={item.productId}
                            onChange={(value) => updateItemInForm(index, 'productId', value)}
                            className="w-full rounded-md border-gray-200 text-base focus:ring-amber-500 transition-colors duration-200"
                          />
                          <Input
                            label={t('returns.quantity')}
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItemInForm(index, 'quantity', parseInt(e.target.value))}
                            min={1}
                            max={(inventoryData?.find((inv) => inv.productId === item.productId)?.currentStock || 1)}
                            className="w-full rounded-md border-gray-200 text-base focus:ring-amber-500 transition-colors duration-200"
                          />
                          <Select
                            label={t('returns.reason')}
                            options={reasonOptions}
                            value={item.reason}
                            onChange={(value) => updateItemInForm(index, 'reason', value)}
                            className="w-full rounded-md border-gray-200 text-base focus:ring-amber-500 transition-colors duration-200"
                          />
                          <Button
                            variant="danger"
                            onClick={() => removeItemFromForm(index)}
                            className="bg-red-600 hover:bg-red-700 text-white rounded-full px-4 py-2 transition-colors duration-200"
                          >
                            {t('common.remove')}
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="secondary"
                        onClick={addItemToForm}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full px-4 py-2 transition-colors duration-200"
                      >
                        {t('returns.add_item')}
                      </Button>
                    </div>
                    <div className={`flex justify-end gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <Button
                        variant="secondary"
                        onClick={() => setIsCreateModalOpen(false)}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full px-4 py-2 transition-colors duration-200"
                      >
                        {t('common.cancel')}
                      </Button>
                      <Button
                        variant="primary"
                        onClick={handleCreateReturn}
                        disabled={!formData.orderId || !formData.reason || formData.items.length === 0 || createReturnMutation.isLoading}
                        className="bg-green-600 hover:bg-green-700 text-white rounded-full px-4 py-2 transition-colors duration-200"
                      >
                        {createReturnMutation.isLoading ? t('common.loading') : t('returns.create')}
                      </Button>
                    </div>
                  </motion.div>
                </Modal>
              )}
            </AnimatePresence>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default BranchReturns;