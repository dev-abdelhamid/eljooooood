import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { returnsAPI, inventoryAPI, ordersAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Select } from '../components/UI/Select';
import { Input } from '../components/UI/Input';
import { Modal } from '../components/UI/Modal';
import { Package, Eye, Clock, Check, AlertCircle, Search, Download, Plus } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { debounce } from 'lodash';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import 'react-toastify/dist/ReactToastify.css';
import 'tailwindcss/tailwind.css';

interface InventoryItem {
  productId: string;
  productName: string;
  productNameEn: string;
  currentStock: number;
  unit: string;
  unitEn: string;
}

interface OrderItem {
  itemId: string;
  productId: string;
  productName: string;
  productNameEn: string;
  quantity: number;
  price: number;
  availableQuantity: number;
}

interface Order {
  id: string;
  orderNumber: string;
  items: OrderItem[];
}

interface ReturnItem {
  itemId: string;
  productId: string;
  productName: string;
  quantity: number;
  price?: number;
  reason: string;
  reasonEn?: string;
}

interface Return {
  id: string;
  returnNumber: string;
  order: { id: string; orderNumber: string; totalAmount: number; createdAt: string };
  items: ReturnItem[];
  status: 'pending_approval' | 'approved' | 'rejected';
  date: string;
  createdAt: string;
  notes?: string;
  reviewNotes?: string;
  branch: { _id: string; name: string; nameEn?: string };
  department?: { _id: string; name: string; nameEn?: string };
}

interface CreateReturnForm {
  orderId: string;
  branchId: string;
  reason: string;
  notes?: string;
  items: { itemId: string; productId: string; quantity: number; reason: string }[];
}

const RETURNS_PER_PAGE = 10;

const BranchReturns: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [formData, setFormData] = useState<CreateReturnForm>({
    orderId: '',
    branchId: user?.branch || '',
    reason: '',
    notes: '',
    items: [],
  });

  const toastOptions = useMemo(
    () => ({
      position: isRtl ? ('top-left' as const) : ('top-right' as const),
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
    const apiUrl = import.meta.env.VITE_API_URL || 'https://eljoodia-server-production.up.railway.app/api';
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
      { value: 'pending_approval', label: t('returns.status.pending_approval') },
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
    [isRtl, t]
  );

  const STATUS_COLORS = useMemo(
    () => ({
      pending_approval: { color: 'bg-amber-100 text-amber-800', icon: Clock, label: t('returns.status.pending_approval') },
      approved: { color: 'bg-green-100 text-green-800', icon: Check, label: t('returns.status.approved') },
      rejected: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: t('returns.status.rejected') },
    }),
    [t]
  );

  const getStatusInfo = useCallback(
    (status: Return['status']) => STATUS_COLORS[status] || { color: 'bg-gray-100 text-gray-800', icon: Clock, label: t(`returns.status.${status}`) },
    [STATUS_COLORS, t]
  );

  const formatDate = useCallback(
    (dateString: string) => {
      const date = new Date(dateString);
      return isNaN(date.getTime())
        ? t('errors.invalid_date')
        : date.toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
    },
    [isRtl, t]
  );

  const { data: returnsData, isLoading, error } = useQuery({
    queryKey: ['returns', filterStatus, currentPage, user?.branch],
    queryFn: async () => {
      if (!user?.branch) throw new Error(t('errors.no_branch_associated'));
      const query = { status: filterStatus, branch: user.branch, page: currentPage, limit: RETURNS_PER_PAGE };
      const { returns: returnsData, total } = await returnsAPI.getAll(query);
      if (!Array.isArray(returnsData)) throw new Error('Invalid returns data format');
      return {
        returns: returnsData.map((ret: any) => ({
          id: ret._id,
          returnNumber: ret.returnNumber,
          order: {
            id: ret.order._id || 'unknown',
            orderNumber: ret.order.orderNumber || t('orders.unknown'),
            totalAmount: ret.order.totalAmount || 0,
            createdAt: ret.order.createdAt || new Date().toISOString(),
          },
          items: Array.isArray(ret.items)
            ? ret.items.map((item: any) => ({
                itemId: item.itemId || 'unknown',
                productId: item.product?._id || 'unknown',
                productName: isRtl ? item.product?.name : (item.product?.nameEn || item.product?.name || t('products.unknown')),
                quantity: item.quantity || 0,
                price: item.product?.price || 0,
                reason: isRtl ? item.reason : (item.reasonEn || item.reason || 'unknown'),
              }))
            : [],
          status: ret.status || 'pending_approval',
          date: formatDate(ret.createdAt || new Date().toISOString()),
          createdAt: ret.createdAt || new Date().toISOString(),
          notes: isRtl ? ret.notes : (ret.notesEn || ret.notes || ''),
          reviewNotes: isRtl ? ret.reviewNotes : (ret.reviewNotesEn || ret.reviewNotes || ''),
          branch: { _id: ret.branch?._id || 'unknown', name: isRtl ? ret.branch?.name : (ret.branch?.nameEn || ret.branch?.name || t('branches.unknown')) },
          department: ret.order?.department || { _id: 'unknown', name: isRtl ? t('departments.unknown') : (ret.order?.department?.nameEn || t('departments.unknown')) },
        })),
        total,
      };
    },
    onError: (err: any) => {
      const errorMessage = err.status === 403 ? t('errors.unauthorized_access') : err.message || t('errors.fetch_returns');
      toast.error(errorMessage, toastOptions);
    },
  });

  const { data: inventoryData } = useQuery({
    queryKey: ['inventory', user?.branch],
    queryFn: async () => {
      if (!user?.branch) return [];
      const response = await inventoryAPI.getByBranch(user.branch);
      return response.map((item: any) => ({
        productId: item.productId,
        productName: isRtl ? item.productName : (item.productNameEn || item.productName),
        productNameEn: item.productNameEn || item.productName,
        currentStock: item.currentStock,
        unit: isRtl ? (item.unit || 'غير محدد') : (item.unitEn || item.unit || 'N/A'),
        unitEn: item.unitEn || item.unit || 'N/A',
      }));
    },
    enabled: !!user?.branch,
  });

  const { data: ordersData } = useQuery({
    queryKey: ['orders', user?.branch],
    queryFn: async () => {
      if (!user?.branch) return [];
      const response = await ordersAPI.getAll({ branch: user.branch, status: 'delivered' });
      return response.orders.map((order: any) => ({
        id: order._id,
        orderNumber: order.orderNumber,
        items: order.items.map((item: any) => ({
          itemId: item._id,
          productId: item.product._id,
          productName: isRtl ? item.product.name : (item.product.nameEn || item.product.name),
          productNameEn: item.product.nameEn || item.product.name,
          quantity: item.quantity,
          price: item.price,
          availableQuantity: item.quantity - (item.returnedQuantity || 0),
        })),
      }));
    },
    enabled: !!user?.branch,
  });

  const createReturnMutation = useMutation({
    mutationFn: (data: CreateReturnForm) => {
      const invalidItems = data.items.some(
        (item) =>
          !item.itemId ||
          !item.productId ||
          item.quantity < 1 ||
          !reasonOptions.some((reason) => reason.value === item.reason)
      );
      if (!data.orderId || !data.reason || data.items.length === 0 || invalidItems) {
        throw new Error(t('errors.invalid_return_data'));
      }
      return returnsAPI.createReturn(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['returns']);
      setIsCreateModalOpen(false);
      setFormData({ orderId: '', branchId: user?.branch || '', reason: '', notes: '', items: [] });
      toast.success(t('returns.create_success'), toastOptions);
    },
    onError: (err: any) => {
      toast.error(err.message || t('errors.create_return'), toastOptions);
    },
  });

  useEffect(() => {
    if (!socket) return;
    const handleConnect = () => {
      socket.emit('joinRoom', { role: user?.role, branchId: user?.branch, userId: user?._id });
      toast.info(t('socket.connected'), toastOptions);
    };
    const handleReturnCreated = (data: any) => {
      if (data.branchId === user?.branch) {
        queryClient.invalidateQueries(['returns']);
        toast.success(t('returns.new_return_notification', { returnNumber: data.returnNumber }), toastOptions);
      }
    };
    const handleReturnStatusUpdated = (data: any) => {
      if (data.branchId === user?.branch) {
        queryClient.invalidateQueries(['returns']);
        toast.info(t('socket.return_status_updated', { status: t(`returns.status.${data.status}`) }), toastOptions);
      }
    };
    socket.on('connect', handleConnect);
    socket.on('returnCreated', handleReturnCreated);
    socket.on('returnStatusUpdated', handleReturnStatusUpdated);
    return () => {
      socket.off('connect', handleConnect);
      socket.off('returnCreated', handleReturnCreated);
      socket.off('returnStatusUpdated', handleReturnStatusUpdated);
    };
  }, [socket, user, queryClient, t, toastOptions]);

  const debouncedSetSearchQuery = useMemo(() => debounce((value: string) => setSearchQuery(value), 300), []);

  const filteredReturns = useMemo(
    () =>
      (returnsData?.returns || []).filter(
        (ret: Return) =>
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

  const totalPages = Math.ceil(sortedReturns.length / RETURNS_PER_PAGE);
  const paginatedReturns = useMemo(
    () => sortedReturns.slice((currentPage - 1) * RETURNS_PER_PAGE, currentPage * RETURNS_PER_PAGE),
    [sortedReturns, currentPage]
  );

  const handleCreateReturn = () => {
    createReturnMutation.mutate(formData);
  };

  const addItemToForm = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { itemId: '', productId: '', quantity: 1, reason: '' }],
    }));
  };

  const updateItemInForm = (index: number, field: string, value: any) => {
    setFormData((prev) => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const removeItemFromForm = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleOrderChange = (orderId: string) => {
    setFormData((prev) => ({ ...prev, orderId, items: [] }));
  };

  const downloadJSON = useCallback(() => {
    const jsonData = (returnsData?.returns || []).map((ret: Return) => ({
      [t('returns.return_number')]: ret.returnNumber,
      [t('returns.order_number')]: ret.order.orderNumber,
      [t('returns.status_label')]: getStatusInfo(ret.status).label,
      [t('returns.date')]: ret.date,
      [t('returns.items_count')]: ret.items.length,
      [t('returns.branch')]: ret.branch.name,
      [t('returns.department')]: ret.department?.name || t('departments.unknown'),
      [t('returns.notes_label')]: ret.notes || t('returns.no_notes'),
      [t('returns.review_notes')]: ret.reviewNotes || t('returns.no_notes'),
    }));
    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `returns-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [returnsData, getStatusInfo, t]);

  const ReturnCard: React.FC<{ ret: Return }> = ({ ret }) => {
    const statusInfo = getStatusInfo(ret.status);
    const StatusIcon = statusInfo.icon;
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col"
      >
        <Card className="flex flex-col p-4 sm:p-5 bg-white shadow-md hover:shadow-xl transition-shadow duration-300 rounded-lg border border-gray-200">
          <div className="flex flex-col gap-4">
            <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${isRtl ? 'sm:flex-row-reverse' : ''}`}>
              <h3 className="text-lg font-semibold text-gray-900">
                {isRtl ? `المرتجع #${ret.returnNumber}` : `Return #${ret.returnNumber}`}
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
                <p className="text-base font-medium text-gray-900">{ret.items.length} {isRtl ? 'عنصر' : 'item'}</p>
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
                <p className="text-sm text-gray-500">{t('returns.department')}</p>
                <p className="text-base font-medium text-gray-900">{ret.department?.name || t('departments.unknown')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('returns.total_amount')}</p>
                <p className="text-base font-medium text-teal-600">{ret.items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0)} {isRtl ? 'ريال' : 'SAR'}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {ret.items.map((item, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-md border border-gray-100">
                  <p className="text-base font-medium text-gray-900">{item.productName}</p>
                  <p className="text-sm text-gray-600">{t('returns.quantity', { quantity: item.quantity })}</p>
                  <p className="text-sm text-gray-600">{t('returns.reason', { reason: item.reason })}</p>
                  {item.price && (
                    <p className="text-sm text-gray-600">{t('returns.price', { price: item.price })} {isRtl ? 'ريال' : 'SAR'}</p>
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
                onClick={() => setSelectedReturn(ret) || setIsViewModalOpen(true)}
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

  const Pagination: React.FC = () => (
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

  const LoadingSpinner: React.FC = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen flex items-center justify-center"
    >
      <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-amber-600"></div>
    </motion.div>
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
          <LoadingSpinner />
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
                    variant={returnsData?.returns.length ? 'primary' : 'secondary'}
                    onClick={returnsData?.returns.length ? downloadJSON : undefined}
                    className={`flex items-center gap-2 ${returnsData?.returns.length ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'} rounded-full px-4 py-2 transition-colors duration-200`}
                    disabled={!returnsData?.returns.length}
                    aria-label={t('returns.download_json')}
                  >
                    <Download className="w-5 h-5" />
                    <span>{t('returns.download_json')}</span>
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
                        <p className="text-sm text-gray-500">{t('returns.department')}</p>
                        <p className="text-base font-medium text-gray-900">{selectedReturn.department?.name || t('departments.unknown')}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">{t('returns.total_amount')}</p>
                        <p className="text-base font-medium text-teal-600">{selectedReturn.items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0)} {isRtl ? 'ريال' : 'SAR'}</p>
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
                            <p className="text-sm text-gray-600">{t('returns.item_total', { total: item.price ? item.quantity * item.price : 0 })} {isRtl ? 'ريال' : 'SAR'}</p>
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
                        <span className="text-teal-600">{selectedReturn.items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0)} {isRtl ? 'ريال' : 'SAR'}</span>
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
                        options={(ordersData || []).map((order: Order) => ({
                          value: order.id,
                          label: order.orderNumber,
                        }))}
                        value={formData.orderId}
                        onChange={handleOrderChange}
                        className="w-full rounded-md border-gray-200 text-base focus:ring-amber-500 transition-colors duration-200"
                        aria-label={t('returns.order_id')}
                      />
                    </div>
                    <div>
                      <Select
                        label={t('returns.reason')}
                        options={reasonOptions}
                        value={formData.reason}
                        onChange={(value) => setFormData((prev) => ({ ...prev, reason: value }))}
                        className="w-full rounded-md border-gray-200 text-base focus:ring-amber-500 transition-colors duration-200"
                        aria-label={t('returns.reason')}
                      />
                    </div>
                    <div>
                      <Input
                        label={t('returns.notes_label')}
                        value={formData.notes}
                        onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                        placeholder={t('returns.enter_notes')}
                        className="w-full rounded-md border-gray-200 text-base focus:ring-amber-500 transition-colors duration-200"
                        aria-label={t('returns.notes_label')}
                      />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-3">{t('returns.items')}</h4>
                      {formData.items.map((item, index) => {
                        const selectedOrder = ordersData?.find((order: Order) => order.id === formData.orderId);
                        const availableItems = selectedOrder?.items.filter((i) => i.availableQuantity > 0) || [];
                        return (
                          <div key={index} className="flex flex-col gap-2 p-3 bg-gray-50 rounded-md border border-gray-100 mb-2">
                            <Select
                              label={t('returns.item')}
                              options={availableItems.map((i: OrderItem) => ({
                                value: i.itemId,
                                label: `${i.productName} (${t('returns.available_quantity', { quantity: i.availableQuantity })})`,
                              }))}
                              value={item.itemId}
                              onChange={(value) => {
                                const selectedItem = availableItems.find((i) => i.itemId === value);
                                updateItemInForm(index, 'itemId', value);
                                updateItemInForm(index, 'productId', selectedItem?.productId || '');
                              }}
                              className="w-full rounded-md border-gray-200 text-base focus:ring-amber-500 transition-colors duration-200"
                              disabled={!formData.orderId}
                              aria-label={t('returns.item')}
                            />
                            <Input
                              label={t('returns.quantity')}
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateItemInForm(index, 'quantity', parseInt(e.target.value))}
                              min={1}
                              max={availableItems.find((i: OrderItem) => i.itemId === item.itemId)?.availableQuantity || 1}
                              className="w-full rounded-md border-gray-200 text-base focus:ring-amber-500 transition-colors duration-200"
                              disabled={!item.itemId}
                              aria-label={t('returns.quantity')}
                            />
                            <Select
                              label={t('returns.reason')}
                              options={reasonOptions}
                              value={item.reason}
                              onChange={(value) => updateItemInForm(index, 'reason', value)}
                              className="w-full rounded-md border-gray-200 text-base focus:ring-amber-500 transition-colors duration-200"
                              aria-label={t('returns.reason')}
                            />
                            <Button
                              variant="danger"
                              onClick={() => removeItemFromForm(index)}
                              className="bg-red-600 hover:bg-red-700 text-white rounded-full px-4 py-2 transition-colors duration-200"
                              aria-label={t('common.remove')}
                            >
                              {t('common.remove')}
                            </Button>
                          </div>
                        );
                      })}
                      <Button
                        variant="secondary"
                        onClick={addItemToForm}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full px-4 py-2 transition-colors duration-200"
                        disabled={!formData.orderId}
                        aria-label={t('returns.add_item')}
                      >
                        {t('returns.add_item')}
                      </Button>
                    </div>
                    <div className={`flex justify-end gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <Button
                        variant="secondary"
                        onClick={() => setIsCreateModalOpen(false)}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full px-4 py-2 transition-colors duration-200"
                        aria-label={t('common.cancel')}
                      >
                        {t('common.cancel')}
                      </Button>
                      <Button
                        variant="primary"
                        onClick={handleCreateReturn}
                        disabled={!formData.orderId || !formData.reason || formData.items.length === 0 || createReturnMutation.isLoading}
                        className="bg-green-600 hover:bg-green-700 text-white rounded-full px-4 py-2 transition-colors duration-200"
                        aria-label={t('returns.create')}
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