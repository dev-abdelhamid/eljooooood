import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { returnsAPI } from '../services/api';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Select } from '../components/UI/Select';
import { Input } from '../components/UI/Input';
import { Modal } from '../components/UI/Modal';
import { Package, Eye, Clock, Check, AlertCircle, Search, Download } from 'lucide-react';
import { debounce } from 'lodash';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import 'react-toastify/dist/ReactToastify.css';

interface ReturnItem {
  itemId: string;
  productId: string;
  productName: string;
  quantity: number;
  price?: number;
  reason: string;
}

interface Return {
  id: string;
  returnNumber: string;
  order: { id: string; orderNumber: string; totalAmount: number; createdAt: string };
  items: ReturnItem[];
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  date: string;
  createdAt: string;
  notes?: string;
  reviewNotes?: string;
  branch: { _id: string; name: string };
  department?: { _id: string; name: string };
}

const RETURNS_PER_PAGE = 10;

const BranchReturns: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { socket } = useSocket();
  const [returns, setReturns] = useState<Return[]>([]);
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);

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
      { value: 'pending', label: t('returns.status.pending') },
      { value: 'approved', label: t('returns.status.approved') },
      { value: 'rejected', label: t('returns.status.rejected') },
      { value: 'processed', label: t('returns.status.processed') },
    ],
    [t]
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

  const fetchData = useCallback(async () => {
    if (!user?.branchId) {
      const errorMessage = t('errors.no_branch_associated');
      setError(errorMessage);
      toast.error(errorMessage, toastOptions);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const query = { status: filterStatus, branch: user.branchId, page: currentPage, limit: RETURNS_PER_PAGE };
      const { returns: returnsData, total } = await returnsAPI.getAll(query);

      if (!Array.isArray(returnsData)) {
        throw new Error('Invalid returns data format');
      }

      const validReturns = returnsData.filter((ret: any) => ret.order && typeof ret.order === 'object');
      if (validReturns.length < returnsData.length) {
        toast.warn(t('errors.some_returns_invalid'), toastOptions);
      }

      setReturns(
        validReturns.map((ret: any) => ({
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
                itemId: item.itemId || item._id || 'unknown',
                productId: item.product?._id || 'unknown',
                productName: item.product?.name || t('products.unknown'),
                quantity: item.quantity || 0,
                price: item.product?.price || 0,
                reason: item.reason || 'unknown',
              }))
            : [],
          status: ret.status || 'pending',
          date: formatDate(ret.createdAt || new Date().toISOString()),
          createdAt: ret.createdAt || new Date().toISOString(),
          notes: ret.notes,
          reviewNotes: ret.reviewNotes,
          branch: { _id: ret.branch?._id || 'unknown', name: ret.branch?.name || t('branches.unknown') },
          department: ret.order?.department || { _id: 'unknown', name: t('departments.unknown') },
        }))
      );
      setError('');
    } catch (err: any) {
      const errorMessage =
        err.status === 403
          ? t('errors.unauthorized_access')
          : err.status === 404
          ? t('errors.return_not_found')
          : err.message || t('errors.fetch_returns');
      console.error(`[${new Date().toISOString()}] Fetch returns error:`, err);
      setError(errorMessage);
      toast.error(errorMessage, toastOptions);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, currentPage, user, t, formatDate, toastOptions]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      setSocketConnected(true);
      socket.emit('joinRoom', { role: user?.role, branchId: user?.branchId, userId: user?._id });
      toast.info(t('socket.connected'), toastOptions);
    };

    const handleConnectError = (err: any) => {
      setSocketConnected(false);
      toast.warn(t('socket.disconnected'), toastOptions);
    };

    const handleReturnCreated = (data: any) => {
      if (data.branchId === user?.branchId) {
        toast.success(t('returns.new_return_notification', { returnNumber: data.returnNumber }), toastOptions);
        fetchData();
      }
    };

    const handleReturnStatusUpdated = (data: { returnId: string; status: string; branchId: string; returnNote?: string; items?: any[] }) => {
      if (data.branchId === user?.branchId) {
        setReturns((prev) =>
          prev.map((r) =>
            r.id === data.returnId
              ? {
                  ...r,
                  status: data.status as Return['status'],
                  reviewNotes: data.returnNote || r.reviewNotes,
                  items: data.items
                    ? data.items.map((item: any) => ({
                        itemId: item.itemId || item._id || 'unknown',
                        productId: item.product?._id || 'unknown',
                        productName: item.product?.name || t('products.unknown'),
                        quantity: item.quantity || 0,
                        price: item.product?.price || 0,
                        reason: item.reason || 'unknown',
                      }))
                    : r.items,
                }
              : r
          )
        );
        if (selectedReturn?.id === data.returnId) {
          setSelectedReturn((prev) =>
            prev
              ? {
                  ...prev,
                  status: data.status as Return['status'],
                  reviewNotes: data.returnNote || prev.reviewNotes,
                  items: data.items
                    ? data.items.map((item: any) => ({
                        itemId: item.itemId || item._id || 'unknown',
                        productId: item.product?._id || 'unknown',
                        productName: item.product?.name || t('products.unknown'),
                        quantity: item.quantity || 0,
                        price: item.product?.price || 0,
                        reason: item.reason || 'unknown',
                      }))
                    : prev.items,
                }
              : prev
          );
        }
        toast.info(t('socket.return_status_updated', { status: t(`returns.status.${data.status}`) }), toastOptions);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('connect_error', handleConnectError);
    socket.on('returnCreated', handleReturnCreated);
    socket.on('returnStatusUpdated', handleReturnStatusUpdated);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
      socket.off('returnCreated', handleReturnCreated);
      socket.off('returnStatusUpdated', handleReturnStatusUpdated);
    };
  }, [socket, user, fetchData, selectedReturn, t, toastOptions]);

  const debouncedSetSearchQuery = useMemo(() => debounce((value: string) => setSearchQuery(value), 300), []);

  const filteredReturns = useMemo(
    () =>
      returns.filter(
        (ret) =>
          ret.returnNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ret.order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (ret.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          ret.branch.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [returns, searchQuery]
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

  const viewReturn = useCallback((ret: Return) => {
    setSelectedReturn(ret);
    setIsViewModalOpen(true);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [totalPages]);

  const downloadJSON = useCallback(() => {
    const jsonData = returns.map((ret) => ({
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
  }, [returns, getStatusInfo, t]);

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
            <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${isRtl ? 'sm:flex-row' : ''}`}>
              <h3 className="text-lg font-semibold text-gray-900">
                {isRtl ? `المرتجع #${ret.returnNumber}` : `Return #${ret.returnNumber}`}
              </h3>
              <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color} ${isRtl ? 'flex-row' : ''}`}>
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
                  <p className="text-sm text-gray-600">{t('returns.reason', { reason: t(`orders.return_reasons.${item.reason}`) || item.reason })}</p>
                  <p className="text-sm text-gray-600">{t('returns.item_total', { total: item.price ? item.quantity * item.price : 0 })} {isRtl ? 'ريال' : 'SAR'}</p>
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
                onClick={() => viewReturn(ret)}
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
    totalPages > 1 && (
      <div className={`flex items-center justify-center gap-3 mt-6 ${isRtl ? 'flex-row' : ''}`}>
        <Button
          variant="secondary"
          size="md"
          onClick={() => handlePageChange(currentPage - 1)}
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
          onClick={() => handlePageChange(currentPage + 1)}
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
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex justify-center"
          >
            <Card className="p-6 max-w-md text-center bg-red-50 shadow-lg rounded-lg border border-red-200">
              <div className={`flex items-center justify-center gap-3 mb-4 ${isRtl ? 'flex-row' : ''}`}>
                <AlertCircle className="w-8 h-8 text-red-600" />
                <p className="text-lg font-medium text-red-600">{error}</p>
              </div>
              <Button
                variant="primary"
                onClick={() => fetchData()}
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
              <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRtl ? 'sm:flex-row' : ''}`}>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{t('returns.title')}</h1>
                  <p className="text-base text-gray-600 mt-1">{t('returns.subtitle')}</p>
                </div>
                <Button
                  variant={returns.length > 0 ? 'primary' : 'secondary'}
                  onClick={returns.length > 0 ? downloadJSON : undefined}
                  className={`flex items-center gap-2 ${returns.length > 0 ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'} rounded-full px-4 py-2 transition-colors duration-200`}
                  disabled={returns.length === 0}
                  aria-label={t('returns.download_json')}
                >
                  <Download className="w-5 h-5" />
                  <span>{t('returns.download_json')}</span>
                </Button>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('returns.filter_by_status')}</label>
                    <Select
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
                            <p className="text-sm text-gray-600">{t('returns.reason', { reason: t(`orders.return_reasons.${item.reason}`) || item.reason })}</p>
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
                    <div className="flex justify-end gap-3">
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
            </AnimatePresence>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default BranchReturns;