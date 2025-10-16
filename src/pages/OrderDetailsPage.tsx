import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, AlertCircle, Clock, Package, Truck, CheckCircle, X, Download } from 'lucide-react';
import { ordersAPI, chefsAPI } from '../services/api';
import { Order, Chef, AssignChefsForm } from '../types';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Button } from '../components/UI/Button';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Invoice component for PDF rendering
const Invoice: React.FC<{ order: Order; t: (key: string, params?: any) => string; isRtl: boolean }> = ({ order, t, isRtl }) => {
  const calculateAdjustedTotal = useCallback(
    (order: Order): number => {
      const approvedReturnsTotal = (order.returns || [])
        .filter(ret => ret.status === 'approved')
        .reduce((sum, ret) => {
          const returnTotal = ret.items.reduce((retSum, item) => {
            const orderItem = order.items.find(i => i._id === item.itemId);
            return retSum + (orderItem ? orderItem.price * item.quantity : 0);
          }, 0);
          return sum + returnTotal;
        }, 0);
      return order.totalAmount - approvedReturnsTotal;
    },
    []
  );

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-3xl mx-auto text-gray-800">
      <h1 className="text-2xl font-bold text-center text-amber-600 mb-4">{t('invoice.title', { orderNumber: order.orderNumber })}</h1>
      <p className="text-center text-sm mb-6">{t('invoice.date')}: {order.date}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-sm"><strong>{t('orders.order_number')}:</strong> {order.orderNumber}</p>
          <p className="text-sm"><strong>{t('orders.branch')}:</strong> {order.branchName}</p>
          <p className="text-sm"><strong>{t('orders.status')}:</strong> {t(`orders.${order.status}`)}</p>
        </div>
        <div className={`text-${isRtl ? 'left' : 'right'}`}>
          <p className="text-sm"><strong>{t('orders.priority')}:</strong> {t(`orders.${order.priority}`)}</p>
          <p className="text-sm"><strong>{t('orders.total_amount')}:</strong> {order.totalAmount.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}</p>
          <p className="text-sm"><strong>{t('orders.adjusted_total')}:</strong> {(order.adjustedTotal ?? calculateAdjustedTotal(order)).toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}</p>
        </div>
      </div>
      <h2 className="text-lg font-semibold mb-2">{t('orders.items')}</h2>
      <table className="w-full border-collapse mb-6">
        <thead>
          <tr className="bg-amber-100">
            <th className={`p-2 text-${isRtl ? 'right' : 'left'} text-sm font-semibold`}>{t('orders.product')}</th>
            <th className={`p-2 text-${isRtl ? 'right' : 'left'} text-sm font-semibold`}>{t('orders.quantity')}</th>
            <th className={`p-2 text-${isRtl ? 'right' : 'left'} text-sm font-semibold`}>{t('orders.status')}</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map(item => (
            <tr key={item._id} className="border-b">
              <td className={`p-2 text-${isRtl ? 'right' : 'left'} text-sm`}>{item.product?.name || t('product.unknown')}</td>
              <td className={`p-2 text-${isRtl ? 'right' : 'left'} text-sm`}>{item.quantity}</td>
              <td className={`p-2 text-${isRtl ? 'right' : 'left'} text-sm`}>{t(`orders.${item.status}`)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {order.notes && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold">{t('orders.notes')}</h2>
          <p className="text-sm text-gray-600">{order.notes}</p>
        </div>
      )}
      {order.returns && order.returns.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-2">{t('orders.returns')}</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-amber-100">
                <th className={`p-2 text-${isRtl ? 'right' : 'left'} text-sm font-semibold`}>{t('orders.product')}</th>
                <th className={`p-2 text-${isRtl ? 'right' : 'left'} text-sm font-semibold`}>{t('orders.quantity')}</th>
                <th className={`p-2 text-${isRtl ? 'right' : 'left'} text-sm font-semibold`}>{t('orders.reason')}</th>
              </tr>
            </thead>
            <tbody>
              {order.returns.map(ret =>
                ret.items.map((r, index) => (
                  <tr key={`${ret.returnId}-${index}`} className="border-b">
                    <td className={`p-2 text-${isRtl ? 'right' : 'left'} text-sm`}>{order.items.find(i => i._id === r.itemId)?.product?.name || t('product.unknown')}</td>
                    <td className={`p-2 text-${isRtl ? 'right' : 'left'} text-sm`}>{r.quantity}</td>
                    <td className={`p-2 text-${isRtl ? 'right' : 'left'} text-sm`}>{t(`returns.${r.reason}`) || t('returns.no_reason')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const OrderDetailsPage: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignFormData, setAssignFormData] = useState<AssignChefsForm>({ items: [] });
  const [returnNotes, setReturnNotes] = useState<{ [returnId: string]: string }>({});
  const invoiceRef = useRef<HTMLDivElement>(null);

  const statusIcons = {
    pending: <Clock className="w-5 h-5" />,
    approved: <CheckCircle className="w-5 h-5" />,
    in_production: <Package className="w-5 h-5" />,
    in_transit: <Truck className="w-5 h-5" />,
    delivered: <CheckCircle className="w-5 h-5" />,
    completed: <CheckCircle className="w-5 h-5" />,
    cancelled: <AlertCircle className="w-5 h-5" />,
  };

  const formatDateTime = useCallback(
    (dateString: string | Date) => {
      const date = new Date(dateString);
      if (isRtl) {
        const formatter = new Intl.DateTimeFormat('ar-EG', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        return formatter.format(date).replace('AM', 'ص').replace('PM', 'م');
      }
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    },
    [isRtl]
  );

  const fetchOrder = useCallback(async () => {
    if (!id || !user) {
      setError(t('errors.invalid_input'));
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [orderResponse, chefsResponse] = await Promise.all([
        ordersAPI.getById(id),
        chefsAPI.getAll(),
      ]);
      setOrder({
        ...orderResponse,
        branchName: orderResponse.branch?.name || t('branches.unknown'),
        branchId: orderResponse.branch?._id || 'unknown',
        date: formatDateTime(orderResponse.createdAt),
        statusHistory: orderResponse.statusHistory?.map((h: any) => ({
          ...h,
          changedAt: formatDateTime(h.changedAt),
          changedBy: h.changedByUser?.name || h.changedByUser?.username || t('orders.unknown'),
        })) || [],
        returns: orderResponse.returns?.map((ret: any) => ({
          ...ret,
          createdAt: formatDateTime(ret.createdAt),
          reviewedAt: ret.reviewedAt ? formatDateTime(ret.reviewedAt) : null,
        })) || [],
      });
      setChefs(
        chefsResponse.map((chef: any) => ({
          _id: chef._id,
          userId: chef.user?._id || chef._id,
          username: chef.user?.username || chef.username || 'Unknown',
          name: chef.user?.name || chef.name || chef.username || t('orders.unknown_chef'),
          department: chef.department || null,
        }))
      );
      setError('');
    } catch (err: any) {
      setError(t('errors.fetch_orders') + ': ' + (err.message || t('errors.unknown')));
      toast.error(t('errors.fetch_orders'), { position: isRtl ? 'top-left' : 'top-right' });
    } finally {
      setLoading(false);
    }
  }, [id, user, t, isRtl]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const playNotificationSound = useCallback(() => {
    const audio = new Audio('/sounds/notification.mp3');
    audio.play().catch((err) => {
      console.error(`[${new Date().toISOString()}] Audio playback error:`, err);
    });
  }, []);

  useEffect(() => {
    const handleUserInteraction = () => {
      const audio = new Audio('/sounds/notification.mp3');
      audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        console.log(`[${new Date().toISOString()}] Audio context initialized`);
      }).catch((err) => console.error(`[${new Date().toISOString()}] Audio context initialization failed:`, err));
      document.removeEventListener('click', handleUserInteraction);
    };
    document.addEventListener('click', handleUserInteraction, { once: true });
    return () => document.removeEventListener('click', handleUserInteraction);
  }, []);

  useEffect(() => {
    if (!socket || !order) return;

    const handleSocketEvents = {
      taskAssigned: ({ orderId, items }: { orderId: string; items: any[] }) => {
        if (orderId === order.id) {
          setOrder(prev => ({
            ...prev!,
            items: prev!.items.map(i => {
              const assignment = items.find(a => a._id === i._id);
              return assignment
                ? {
                    ...i,
                    assignedTo: {
                      _id: assignment.assignedTo._id,
                      name: assignment.assignedTo.name || t('orders.unknown_chef'),
                    },
                    status: 'assigned',
                  }
                : i;
            }),
            status: prev!.items.every(i => i.status === 'assigned') ? 'in_production' : prev!.status,
          }));
          toast.info(t('socket.task_assigned', { orderId }), { position: isRtl ? 'top-left' : 'top-right' });
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          playNotificationSound();
        }
      },
      itemStatusUpdated: ({ orderId, itemId, status, productName }: { orderId: string; itemId: string; status: string; productName: string }) => {
        if (orderId === order.id) {
          setOrder(prev => ({
            ...prev!,
            items: prev!.items.map(i => (i._id === itemId ? { ...i, status: status as any } : i)),
            status: prev!.items.every(i => i.status === 'completed') ? 'completed' : prev!.status,
          }));
          toast.info(t('socket.item_status_updated', { productName, status: t(`orders.${status}`) }), {
            position: isRtl ? 'top-left' : 'top-right',
          });
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          playNotificationSound();
        }
      },
      orderStatusUpdated: ({ orderId, status, changedByUser }: { orderId: string; status: string; changedByUser: { name?: string; username: string } }) => {
        if (orderId === order.id) {
          setOrder(prev => ({
            ...prev!,
            status: status as any,
            statusHistory: [
              ...prev!.statusHistory,
              {
                status,
                changedAt: formatDateTime(new Date()),
                changedBy: changedByUser?.name || changedByUser?.username || t('orders.unknown'),
                notes: '',
              },
            ],
          }));
          toast.info(t('socket.order_status_updated', { status: t(`orders.${status}`) }), {
            position: isRtl ? 'top-left' : 'top-right',
          });
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          playNotificationSound();
        }
      },
      returnStatusUpdated: ({ returnId, orderId, status, adjustedTotal, reviewNotes }: { returnId: string; orderId: string; status: string; adjustedTotal: number; reviewNotes?: string }) => {
        if (orderId === order.id) {
          setOrder(prev => ({
            ...prev!,
            adjustedTotal,
            returns: prev!.returns!.map(ret =>
              ret.returnId === returnId
                ? {
                    ...ret,
                    status: status as any,
                    reviewNotes: reviewNotes || ret.reviewNotes,
                    reviewedAt: formatDateTime(new Date()),
                  }
                : ret
            ),
          }));
          toast.info(t('socket.return_status_updated', { status: t(`returns.${status}`) }), {
            position: isRtl ? 'top-left' : 'top-right',
          });
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          playNotificationSound();
        }
      },
      newNotification: ({ type, message, data }: { type: string; message: string; data: any }) => {
        if (data.orderId === order.id || data.returnId) {
          toast.info(message, { position: isRtl ? 'top-left' : 'top-right' });
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          playNotificationSound();
        }
      },
    };

    Object.keys(handleSocketEvents).forEach(event => socket.on(event, handleSocketEvents[event]));
    return () => {
      Object.keys(handleSocketEvents).forEach(event => socket.off(event, handleSocketEvents[event]));
    };
  }, [socket, order, t, isRtl, formatDateTime, playNotificationSound]);

  const updateOrderStatus = useCallback(
    async (orderId: string, newStatus: Order['status']) => {
      setSubmitting(`order-${orderId}`);
      try {
        await ordersAPI.updateStatus(orderId, { status: newStatus });
        setOrder(prev => ({
          ...prev!,
          status: newStatus,
          statusHistory: [
            ...prev!.statusHistory,
            {
              status: newStatus,
              changedAt: formatDateTime(new Date()),
              changedBy: user?.name || user?.username || t('orders.unknown'),
              notes: '',
            },
          ],
        }));
        socket?.emit('orderStatusUpdated', {
          orderId,
          status: newStatus,
          changedByUser: { name: user?.name, username: user?.username },
          timestamp: new Date().toISOString(),
        });
        toast.success(t('orders.status_updated', { status: t(`orders.${newStatus}`) }), {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        setError(t('errors.update_order_status') + ': ' + (err.message || t('errors.unknown')));
        toast.error(t('errors.update_order_status'), { position: isRtl ? 'top-left' : 'top-right' });
      } finally {
        setSubmitting(null);
      }
    },
    [t, isRtl, socket, user, formatDateTime]
  );

  const updateReturnStatus = useCallback(
    async (returnId: string, status: 'approved' | 'rejected') => {
      const reviewNotes = returnNotes[returnId] || (status === 'approved' ? t('returns.approved_by_admin') : t('returns.rejected_by_admin'));
      setSubmitting(`return-${returnId}`);
      try {
        const response = await ordersAPI.updateReturnStatus(returnId, { status, reviewNotes });
        setOrder(prev => ({
          ...prev!,
          adjustedTotal: response.adjustedTotal,
          returns: prev!.returns!.map(ret =>
            ret.returnId === returnId
              ? {
                  ...ret,
                  status,
                  reviewNotes,
                  reviewedAt: formatDateTime(new Date()),
                }
              : ret
          ),
        }));
        socket?.emit('returnStatusUpdated', {
          returnId,
          orderId: order!.id,
          status,
          adjustedTotal: response.adjustedTotal,
          reviewNotes,
          timestamp: new Date().toISOString(),
        });
        toast.success(t('returns.status_updated', { status: t(`returns.${status}`) }), {
          position: isRtl ? 'top-left' : 'top-right',
        });
        setReturnNotes(prev => ({ ...prev, [returnId]: '' }));
      } catch (err: any) {
        setError(t('errors.update_return_status') + ': ' + (err.message || t('errors.unknown')));
        toast.error(t('errors.update_return_status'), { position: isRtl ? 'top-left' : 'top-right' });
      } finally {
        setSubmitting(null);
      }
    },
    [t, isRtl, socket, order, returnNotes, formatDateTime]
  );

  const openAssignModal = useCallback(
    (order: Order) => {
      if (order.status !== 'approved') {
        toast.error(t('errors.order_not_approved'), { position: isRtl ? 'top-left' : 'top-right' });
        return;
      }
      setAssignFormData({
        items: order.items
          .filter(item => !item.assignedTo)
          .map(item => ({
            itemId: item._id,
            assignedTo: '',
            product: item.product._id,
            quantity: item.quantity,
          })),
      });
      setIsAssignModalOpen(true);
    },
    [t, isRtl]
  );

  const assignChefs = useCallback(
    async (orderId: string) => {
      setSubmitting(`order-${orderId}`);
      try {
        const validAssignments = assignFormData.items.filter(item => item.assignedTo);
        if (validAssignments.length === 0) {
          toast.warn(t('orders.no_chefs_selected'), { position: isRtl ? 'top-left' : 'top-right' });
          return;
        }
        await ordersAPI.assignChef(orderId, { items: validAssignments });
        setOrder(prev => ({
          ...prev!,
          items: prev!.items.map(i => {
            const assignment = validAssignments.find(a => a.itemId === i._id);
            return assignment
              ? {
                  ...i,
                  assignedTo: chefs.find(c => c.userId === assignment.assignedTo),
                  status: 'assigned',
                }
              : i;
          }),
          status: prev!.items.every(i => i.status === 'assigned') ? 'in_production' : prev!.status,
        }));
        socket?.emit('taskAssigned', {
          orderId,
          items: validAssignments.map(item => ({
            _id: item.itemId,
            assignedTo: chefs.find(c => c.userId === item.assignedTo),
            status: 'assigned',
            timestamp: new Date().toISOString(),
          })),
        });
        setIsAssignModalOpen(false);
        setAssignFormData({ items: [] });
        toast.success(t('orders.chefs_assigned'), { position: isRtl ? 'top-left' : 'top-right' });
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        playNotificationSound();
      } catch (err: any) {
        setError(t('errors.assign_chef') + ': ' + (err.message || t('errors.unknown')));
        toast.error(t('errors.assign_chef'), { position: isRtl ? 'top-left' : 'top-right' });
      } finally {
        setSubmitting(null);
      }
    },
    [t, isRtl, socket, chefs, assignFormData, playNotificationSound]
  );

  const exportInvoice = useCallback(async () => {
    if (!order || !invoiceRef.current) return;
    setSubmitting(`export-${order.id}`);
    try {
      const canvas = await html2canvas(invoiceRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      const imgWidth = 190; // A4 width minus margins
      const pageHeight = 295; // A4 height minus margins
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 10;

      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`invoice_${order.orderNumber}.pdf`);
      toast.success(t('invoice.export_success'), { position: isRtl ? 'top-left' : 'top-right' });
    } catch (err: any) {
      setError(t('errors.pdf_generation') + ': ' + (err.message || t('errors.unknown')));
      toast.error(t('errors.pdf_generation'), { position: isRtl ? 'top-left' : 'top-right' });
    } finally {
      setSubmitting(null);
    }
  }, [order, t, isRtl]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-amber-600"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen flex items-center justify-center bg-gray-100"
      >
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md text-center">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-4" />
          <p className="text-lg font-medium text-red-600">{error || t('errors.order_not_found')}</p>
          <Button
            onClick={fetchOrder}
            className="mt-4 bg-amber-600 text-white hover:bg-amber-700 rounded-full px-4 py-2"
          >
            {t('common.retry')}
          </Button>
          <Button
            onClick={() => navigate('/orders')}
            className="mt-2 bg-gray-200 text-gray-900 hover:bg-gray-300 rounded-full px-4 py-2"
          >
            {t('common.back')}
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-100 ${isRtl ? 'rtl' : 'ltr'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-center mb-6"
        >
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate('/orders')}
              className="bg-amber-600 text-white hover:bg-amber-700 rounded-full p-2"
              aria-label={t('common.back')}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold text-gray-800">
              {t('orders.order_details', { orderNumber: order.orderNumber })}
            </h1>
          </div>
          <Button
            onClick={exportInvoice}
            disabled={submitting === `export-${order.id}`}
            className={`bg-amber-600 text-white hover:bg-amber-700 rounded-full px-4 py-2 flex items-center gap-2 ${
              submitting === `export-${order.id}` ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            aria-label={t('invoice.export')}
          >
            <Download className="w-5 h-5" />
            {t('invoice.export')}
          </Button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <OrderCard
              order={order}
              updateOrderStatus={updateOrderStatus}
              updateReturnStatus={updateReturnStatus}
              openAssignModal={openAssignModal}
              submitting={submitting}
              isRtl={isRtl}
              t={t}
              user={user}
              returnNotes={returnNotes}
              setReturnNotes={setReturnNotes}
            />
          </div>
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">{t('orders.status_history')}</h2>
              <div className="relative">
                <div className="absolute h-full w-1 bg-gray-200 left-4 top-0"></div>
                {order.statusHistory?.map((history, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="mb-6 relative"
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-amber-600 rounded-full flex items-center justify-center text-white z-10">
                        {statusIcons[history.status as keyof typeof statusIcons] || <Clock className="w-5 h-5" />}
                      </div>
                      <div className={`ml-4 ${isRtl ? 'mr-4 ml-0' : ''}`}>
                        <p className="font-medium">{t(`orders.${history.status}`)}</p>
                        <p className="text-sm text-gray-600">{history.changedAt}</p>
                        <p className="text-sm text-gray-500">{t('orders.changed_by')}: {history.changedBy}</p>
                        {history.notes && <p className="text-sm text-gray-500 mt-1">{t('orders.notes')}: {history.notes}</p>}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="hidden">
          <div ref={invoiceRef}>
            <Invoice order={order} t={t} isRtl={isRtl} />
          </div>
        </div>

        <AssignChefsModal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          order={order}
          assignFormData={assignFormData}
          setAssignFormData={setAssignFormData}
          chefs={chefs}
          assignChefs={assignChefs}
          submitting={submitting}
          isRtl={isRtl}
          t={t}
        />
      </div>
    </div>
  );
};

interface OrderCardProps {
  order: Order;
  updateOrderStatus: (orderId: string, newStatus: Order['status']) => void;
  updateReturnStatus: (returnId: string, status: 'approved' | 'rejected') => void;
  openAssignModal: (order: Order) => void;
  submitting: string | null;
  isRtl: boolean;
  t: (key: string, params?: any) => string;
  user: any;
  returnNotes: { [returnId: string]: string };
  setReturnNotes: React.Dispatch<React.SetStateAction<{ [returnId: string]: string }>>;
}

const OrderCard: React.FC<OrderCardProps> = ({
  order,
  updateOrderStatus,
  updateReturnStatus,
  openAssignModal,
  submitting,
  isRtl,
  t,
  user,
  returnNotes,
  setReturnNotes,
}) => {
  const validTransitions: Record<Order['status'], Order['status'][]> = {
    pending: ['approved', 'cancelled'],
    approved: ['in_production', 'cancelled'],
    in_production: ['completed', 'cancelled'],
    completed: ['in_transit'],
    in_transit: ['delivered'],
    delivered: [],
    cancelled: [],
  };

  const calculateAdjustedTotal = useCallback(
    (order: Order): number => {
      const approvedReturnsTotal = (order.returns || [])
        .filter(ret => ret.status === 'approved')
        .reduce((sum, ret) => {
          const returnTotal = ret.items.reduce((retSum, item) => {
            const orderItem = order.items.find(i => i._id === item.itemId);
            return retSum + (orderItem ? orderItem.price * item.quantity : 0);
          }, 0);
          return sum + returnTotal;
        }, 0);
      return order.totalAmount - approvedReturnsTotal;
    },
    []
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold">{t('orders.order_number')}: {order.orderNumber}</h2>
          <p className="text-gray-600">{t('orders.branch')}: {order.branchName}</p>
          <p className="text-gray-600">{t('orders.date')}: {order.date}</p>
          <p className="text-gray-600">{t('orders.priority')}: {t(`orders.${order.priority}`)}</p>
        </div>
        <div className={`text-${isRtl ? 'left' : 'right'}`}>
          <p className="text-gray-600">{t('orders.total_amount')}: {order.totalAmount.toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}</p>
          <p className="text-gray-600">{t('orders.adjusted_total')}: {(order.adjustedTotal ?? calculateAdjustedTotal(order)).toLocaleString(isRtl ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR' })}</p>
          <p className={`text-lg font-semibold ${order.status === 'cancelled' ? 'text-red-600' : 'text-green-600'}`}>
            {t('orders.status')}: {t(`orders.${order.status}`)}
          </p>
        </div>
      </div>

      <h3 className="text-lg font-semibold mb-4">{t('orders.items')}</h3>
      <div className="space-y-4">
        {order.items.map(item => {
          const itemReturns = (order.returns || []).filter(ret => ret.items.some(r => r.itemId === item._id));
          return (
            <motion.div
              key={item._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-b pb-4"
            >
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <p className="font-medium">{item.product?.name || t('product.unknown')}</p>
                  <p className="text-sm text-gray-600">{t('orders.quantity')}: {item.quantity}</p>
                  <p className="text-sm text-gray-600">{t('orders.department')}: {item.product?.department?.name || t('departments.unknown')}</p>
                  {item.assignedTo && (
                    <p className="text-sm text-gray-600">{t('orders.assigned_to')}: {item.assignedTo?.name || t('orders.unknown_chef')}</p>
                  )}
                  <p className={`text-sm font-medium ${item.status === 'completed' ? 'text-green-600' : 'text-blue-600'}`}>
                    {t(`orders.${item.status}`)}
                  </p>
                </div>
                {itemReturns.length > 0 && (
                  <div className="mt-4 sm:mt-0">
                    <h4 className="text-sm font-semibold text-gray-700">{t('orders.returns')}</h4>
                    {itemReturns.map(ret => (
                      <div key={ret.returnId} className="mt-2 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">{t('orders.return_status')}: {t(`returns.${ret.status}`)}</p>
                        <p className="text-sm text-gray-600">{t('orders.created_at')}: {ret.createdAt}</p>
                        {ret.reviewedAt && <p className="text-sm text-gray-600">{t('returns.reviewed_at')}: {ret.reviewedAt}</p>}
                        {ret.reviewNotes && <p className="text-sm text-gray-600">{t('orders.review_notes')}: {ret.reviewNotes}</p>}
                        <div className="mt-2">
                          {ret.items
                            .filter(r => r.itemId === item._id)
                            .map((r, index) => (
                              <p key={index} className="text-sm text-gray-600">
                                {r.quantity} x {item.product?.name || t('product.unknown')} - {t('orders.reason')}: {t(`returns.${r.reason}`) || t('returns.no_reason')}
                              </p>
                            ))}
                        </div>
                        {ret.status === 'pending_approval' && (user.role === 'admin' || user.role === 'production') && (
                          <div className="mt-4 space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700">{t('returns.review_notes')}</label>
                              <Input
                                value={returnNotes[ret.returnId] || ''}
                                onChange={(e) => setReturnNotes(prev => ({ ...prev, [ret.returnId]: e.target.value }))}
                                placeholder={t('returns.review_notes_placeholder')}
                                className="w-full mt-1 p-2 border rounded-lg"
                                aria-label={t('returns.review_notes')}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => updateReturnStatus(ret.returnId, 'approved')}
                                disabled={submitting === `return-${ret.returnId}`}
                                className={`px-4 py-2 rounded-full text-white ${
                                  submitting === `return-${ret.returnId}` ? 'bg-gray-400' : 'bg-amber-600 hover:bg-amber-700'
                                }`}
                                aria-label={t('returns.approve')}
                              >
                                {submitting === `return-${ret.returnId}` ? t('common.loading') : t('returns.approve')}
                              </Button>
                              <Button
                                onClick={() => updateReturnStatus(ret.returnId, 'rejected')}
                                disabled={submitting === `return-${ret.returnId}`}
                                className={`px-4 py-2 rounded-full text-white ${
                                  submitting === `return-${ret.returnId}` ? 'bg-gray-400' : 'bg-amber-600 hover:bg-amber-700'
                                }`}
                                aria-label={t('returns.reject')}
                              >
                                {submitting === `return-${ret.returnId}` ? t('common.loading') : t('returns.reject')}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {order.notes && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold">{t('orders.notes')}</h3>
          <p className="text-gray-600">{order.notes}</p>
        </div>
      )}

      {(user.role === 'production' || user.role === 'admin') && validTransitions[order.status].length > 0 && (
        <div className="mt-6 flex gap-4 flex-wrap">
          {validTransitions[order.status].map(status => (
            <Button
              key={status}
              onClick={() => updateOrderStatus(order.id, status)}
              disabled={submitting === `order-${order.id}`}
              className={`px-4 py-2 rounded-full text-white ${
                submitting === `order-${order.id}` ? 'bg-gray-400' : status === 'in_transit' ? 'bg-blue-300 hover:bg-blue-400' : 'bg-amber-600 hover:bg-amber-700'
              }`}
              aria-label={t(`orders.${status}`)}
            >
              {submitting === `order-${order.id}` ? t('common.loading') : t(`orders.${status}`)}
            </Button>
          ))}
          {order.status === 'approved' && order.items.some(item => !item.assignedTo) && (
            <Button
              onClick={() => openAssignModal(order)}
              disabled={submitting === `order-${order.id}`}
              className={`px-4 py-2 rounded-full text-white ${
                submitting === `order-${order.id}` ? 'bg-gray-400' : 'bg-purple-300 hover:bg-purple-400'
              }`}
              aria-label={t('orders.assign')}
            >
              {submitting === `order-${order.id}` ? t('common.loading') : t('orders.assign')}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
};

interface AssignChefsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  assignFormData: AssignChefsForm;
  setAssignFormData: React.Dispatch<React.SetStateAction<AssignChefsForm>>;
  chefs: Chef[];
  assignChefs: (orderId: string) => void;
  submitting: string | null;
  isRtl: boolean;
  t: (key: string, params?: any) => string;
}

const AssignChefsModal: React.FC<AssignChefsModalProps> = ({
  isOpen,
  onClose,
  order,
  assignFormData,
  setAssignFormData,
  chefs,
  assignChefs,
  submitting,
  isRtl,
  t,
}) => {
  const handleAssignChange = useCallback(
    (itemId: string, value: string) => {
      setAssignFormData(prev => ({
        items: prev.items.map(item =>
          item.itemId === itemId ? { ...item, assignedTo: value } : item
        ),
      }));
    },
    []
  );

  return (
    <AnimatePresence>
      {isOpen && order && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-chefs-modal-title"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-lg"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 id="assign-chefs-modal-title" className="text-xl font-semibold">{t('orders.assign_chefs')}</h2>
              <Button
                onClick={onClose}
                className="p-2 bg-gray-200 text-gray-900 hover:bg-gray-300 rounded-full"
                aria-label={t('common.close')}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            {assignFormData.items.map(item => {
              const departmentId = order.items.find(i => i._id === item.itemId)?.product?.department?._id;
              const availableChefs = chefs.filter(c => c.department?._id === departmentId);
              return (
                <div key={item.itemId} className="mb-4">
                  <p className="font-medium">{order.items.find(i => i._id === item.itemId)?.product?.name || t('product.unknown')}</p>
                  <p className="text-sm text-gray-600">{t('orders.quantity')}: {item.quantity}</p>
                  <Select
                    value={item.assignedTo}
                    onChange={(e) => handleAssignChange(item.itemId, e.target.value)}
                    className="w-full mt-2 p-2 border rounded-lg"
                    aria-label={t('orders.select_chef')}
                  >
                    <option value="">{t('orders.select_chef')}</option>
                    {availableChefs.map(chef => (
                      <option key={chef._id} value={chef.userId}>
                        {chef.name || t('orders.unknown_chef')}
                      </option>
                    ))}
                  </Select>
                </div>
              );
            })}
            <div className="flex justify-end gap-4 mt-6">
              <Button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 text-gray-900 hover:bg-gray-300 rounded-full"
                aria-label={t('common.cancel')}
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => assignChefs(order.id)}
                disabled={submitting === `order-${order.id}`}
                className={`px-4 py-2 rounded-full text-white ${
                  submitting === `order-${order.id}` ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
                }`}
                aria-label={t('orders.assign')}
              >
                {submitting === `order-${order.id}` ? t('common.loading') : t('orders.assign')}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OrderDetailsPage;