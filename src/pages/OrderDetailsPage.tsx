import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, AlertCircle, Clock, Package, Truck, CheckCircle, X , ChevronRight} from 'lucide-react';
import { ordersAPI, chefsAPI } from '../services/api';
import { Order, Chef, AssignChefsForm } from '../types';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Button } from '../components/UI/Button';

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

  const statusIcons = {
    pending: <Clock className="w-4 h-4" />,
    approved: <CheckCircle className="w-4 h-4" />,
    in_production: <Package className="w-4 h-4" />,
    in_transit: <Truck className="w-4 h-4" />,
    delivered: <CheckCircle className="w-4 h-4" />,
    completed: <CheckCircle className="w-4 h-4" />,
    cancelled: <AlertCircle className="w-4 h-4" />,
  };

  const formatDateTime = useCallback(
    (dateString: string) => {
      const date = new Date(dateString);
      if (isRtl) {
        const formatter = new Intl.DateTimeFormat('ar-EG', {
          year: 'numeric',
          month: 'short',
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
      console.error(`[${new Date().toISOString()}] خطأ تشغيل الصوت:`, err);
    });
  }, []);

  useEffect(() => {
    const handleUserInteraction = () => {
      const audio = new Audio('/sounds/notification.mp3');
      audio.play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          console.log(`[${new Date().toISOString()}] تم تهيئة سياق الصوت`);
        })
        .catch((err) => console.error(`[${new Date().toISOString()}] فشل تهيئة سياق الصوت:`, err));
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
          setOrder((prev) => ({
            ...prev!,
            items: prev!.items.map((i) => {
              const assignment = items.find((a) => a._id === i._id);
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
            status: prev!.items.every((i) => i.status === 'assigned') ? 'in_production' : prev!.status,
          }));
          toast.info(t('socket.task_assigned', { orderId }), { position: isRtl ? 'top-left' : 'top-right' });
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          playNotificationSound();
        }
      },
      itemStatusUpdated: ({ orderId, itemId, status, productName }: { orderId: string; itemId: string; status: string; productName: string }) => {
        if (orderId === order.id) {
          setOrder((prev) => ({
            ...prev!,
            items: prev!.items.map((i) => (i._id === itemId ? { ...i, status: status as any } : i)),
            status: prev!.items.every((i) => i.status === 'completed') ? 'completed' : prev!.status,
          }));
          toast.info(t('socket.item_status_updated', { productName, status: t(`orders.${status}`) }), {
            position: isRtl ? 'top-left' : 'top-right',
          });
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          playNotificationSound();
        }
      },
      orderStatusUpdated: ({ orderId, status }: { orderId: string; status: string }) => {
        if (orderId === order.id) {
          setOrder((prev) => ({ ...prev!, status: status as any }));
          toast.info(t('socket.order_status_updated', { status: t(`orders.${status}`) }), {
            position: isRtl ? 'top-left' : 'top-right',
          });
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          playNotificationSound();
        }
      },
      returnStatusUpdated: ({
        returnId,
        orderId,
        status,
        adjustedTotal,
        reviewNotes,
      }: {
        returnId: string;
        orderId: string;
        status: string;
        adjustedTotal: number;
        reviewNotes?: string;
      }) => {
        if (orderId === order.id) {
          setOrder((prev) => ({
            ...prev!,
            adjustedTotal,
            returns: prev!.returns!.map((ret) =>
              ret.returnId === returnId
                ? {
                    ...ret,
                    status: status as any,
                    reviewNotes: reviewNotes || ret.reviewNotes,
                    reviewedAt: formatDateTime(new Date().toISOString()),
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

    Object.keys(handleSocketEvents).forEach((event) => socket.on(event, handleSocketEvents[event]));
    return () => {
      Object.keys(handleSocketEvents).forEach((event) => socket.off(event, handleSocketEvents[event]));
    };
  }, [socket, order, t, isRtl, playNotificationSound]);

  const updateOrderStatus = useCallback(
    async (orderId: string, newStatus: Order['status']) => {
      setSubmitting(`order-${orderId}`);
      try {
        await ordersAPI.updateStatus(orderId, { status: newStatus });
        setOrder((prev) => ({ ...prev!, status: newStatus }));
        socket?.emit('orderStatusUpdated', { orderId, status: newStatus, timestamp: new Date().toISOString() });
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
    [t, isRtl, socket]
  );

  const updateReturnStatus = useCallback(
    async (returnId: string, status: 'approved' | 'rejected') => {
      const reviewNotes = returnNotes[returnId] || (status === 'approved' ? t('returns.approved_by_admin') : t('returns.rejected_by_admin'));
      setSubmitting(`return-${returnId}`);
      try {
        const response = await ordersAPI.updateReturnStatus(returnId, { status, reviewNotes });
        setOrder((prev) => ({
          ...prev!,
          adjustedTotal: response.adjustedTotal,
          returns: prev!.returns!.map((ret) =>
            ret.returnId === returnId
              ? {
                  ...ret,
                  status,
                  reviewNotes,
                  reviewedAt: formatDateTime(new Date().toISOString()),
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
        setReturnNotes((prev) => ({ ...prev, [returnId]: '' }));
      } catch (err: any) {
        setError(t('errors.update_return_status') + ': ' + (err.message || t('errors.unknown')));
        toast.error(t('errors.update_return_status'), { position: isRtl ? 'top-left' : 'top-right' });
      } finally {
        setSubmitting(null);
      }
    },
    [t, isRtl, socket, order, returnNotes]
  );

  const openAssignModal = useCallback(
    (order: Order) => {
      if (order.status !== 'approved') {
        toast.error(t('errors.order_not_approved'), { position: isRtl ? 'top-left' : 'top-right' });
        return;
      }
      setAssignFormData({
        items: order.items
          .filter((item) => !item.assignedTo)
          .map((item) => ({
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
        const validAssignments = assignFormData.items.filter((item) => item.assignedTo);
        if (validAssignments.length === 0) {
          toast.warn(t('orders.no_chefs_selected'), { position: isRtl ? 'top-left' : 'top-right' });
          return;
        }
        await ordersAPI.assignChef(orderId, { items: validAssignments });
        setOrder((prev) => ({
          ...prev!,
          items: prev!.items.map((i) => {
            const assignment = validAssignments.find((a) => a.itemId === i._id);
            return assignment
              ? {
                  ...i,
                  assignedTo: chefs.find((c) => c.userId === assignment.assignedTo),
                  status: 'assigned',
                }
              : i;
          }),
          status: prev!.items.every((i) => i.status === 'assigned') ? 'in_production' : prev!.status,
        }));
        socket?.emit('taskAssigned', {
          orderId,
          items: validAssignments.map((item) => ({
            _id: item.itemId,
            assignedTo: chefs.find((c) => c.userId === item.assignedTo),
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-amber-600"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen flex items-center justify-center bg-gray-50 px-4"
      >
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 max-w-md text-center">
          <AlertCircle className="w-6 h-6 text-red-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">{error || t('errors.order_not_found')}</p>
          <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
            <Button
              onClick={fetchOrder}
              className="px-4 py-1.5 bg-amber-600 text-white hover:bg-amber-700 text-sm rounded-lg"
            >
              {t('common.retry')}
            </Button>
            <Button
              onClick={() => navigate('/orders')}
              className="px-4 py-1.5 bg-gray-200 text-gray-700 hover:bg-gray-300 text-sm rounded-lg"
            >
              {t('common.back')}
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6">
      <div className=" mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-4"
        >
          <div className="flex items-center  gap-2">
            <Button
              onClick={() => navigate('/orders')}
              className=" p-5 rounded-full  bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center"
              aria-label={t('common.back')}

            >
              {isRtl ? (
                <ChevronRight className="w-3 h-3 text-gray-700" />
              ) : (
                <ChevronLeft className="w-3 h-3 text-gray-700" />
              )}
            </Button>
            <h1 className="text-xl font-semibold  text-gray-800">
              {t('orders.order_details')}  
              <span className="text-amber-600">{order.orderNumber}</span>
            </h1>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h2 className="text-base font-semibold text-gray-800 mb-3">{t('orders.status_history')}</h2>
              <div className="relative">
                <div className={`absolute h-full w-0.5 bg-gray-200 ${isRtl ? 'right-3' : 'left-3'} top-0`}></div>
                {order.statusHistory?.map((history, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: isRtl ? 10 : -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="mb-4 relative"
                  >
                    <div className="flex items-start">
                      <div className="w-6 h-6 bg-amber-600 rounded-full flex items-center justify-center text-white z-10">
                        {statusIcons[history.status as keyof typeof statusIcons] || <Clock className="w-4 h-4" />}
                      </div>
                      <div className={`ml-3 ${isRtl ? 'mr-3 ml-0' : ''}`}>
                        <p className="text-sm font-medium text-gray-700">{t(`orders.${history.status}`)}</p>
                        <p className="text-xs text-gray-500">{history.changedAt}</p>
                        {history.notes && <p className="text-xs text-gray-500 mt-0.5">{history.notes}</p>}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>

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
        .filter((ret) => ret.status === 'approved')
        .reduce((sum, ret) => {
          const returnTotal = ret.items.reduce((retSum, item) => {
            const orderItem = order.items.find((i) => i._id === item.itemId);
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
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">{t('orders.order_number')}: {order.orderNumber}</h2>
          <p className="text-xs text-gray-600">{t('orders.branch')}: {order.branchName}</p>
          <p className="text-xs text-gray-600">{t('orders.date')}: {order.date}</p>
          <p className="text-xs text-gray-600">{t('orders.priority')}: {t(`orders.${order.priority}`)}</p>
        </div>
        <div className={`text-right ${isRtl ? 'text-left' : 'text-right'}`}>
          <p className="text-xs text-gray-600">{t('orders.total_amount')}: {order.totalAmount.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</p>
          <p className="text-xs text-gray-600">{t('orders.adjusted_total')}: {(order.adjustedTotal ?? calculateAdjustedTotal(order)).toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</p>
          <p className={`text-sm font-semibold ${order.status === 'cancelled' ? 'text-red-600' : 'text-amber-600'}`}>
            {t('orders.status')}: {t(`orders.${order.status}`)}
          </p>
        </div>
      </div>

      <h3 className="text-sm font-semibold text-gray-800 mb-3">{t('orders.items')}</h3>
      <div className="space-y-3">
        {order.items.map((item) => {
          const itemReturns = (order.returns || []).filter((ret) => ret.items.some((r) => r.itemId === item._id));
          return (
            <motion.div
              key={item._id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-b border-gray-100 pb-3 last:border-b-0"
            >
              <div className="flex flex-col sm:flex-row justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">{item.product?.name || t('product.unknown')}</p>
                  <p className="text-xs text-gray-500">{t('orders.quantity')}: {item.quantity}</p>
                  <p className="text-xs text-gray-500">{t('orders.department')}: {item.product?.department?.name || t('departments.unknown')}</p>
                  {item.assignedTo && (
                    <p className="text-xs text-gray-500">{t('orders.assigned_to')}: {item.assignedTo?.name || t('orders.unknown_chef')}</p>
                  )}
                  <p className={`text-xs font-medium ${item.status === 'completed' ? 'text-amber-600' : 'text-blue-600'}`}>
                    {t(`orders.${item.status}`)}
                  </p>
                </div>
                {itemReturns.length > 0 && (
                  <div className="mt-3 sm:mt-0">
                    <h4 className="text-xs font-semibold text-gray-700">{t('orders.returns')}</h4>
                    {itemReturns.map((ret) => (
                      <div key={ret.returnId} className="mt-2 p-2 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600">{t('orders.return_status')}: {t(`returns.${ret.status}`)}</p>
                        <p className="text-xs text-gray-600">{t('orders.created_at')}: {ret.createdAt}</p>
                        {ret.reviewedAt && <p className="text-xs text-gray-600">{t('returns.reviewed_at')}: {ret.reviewedAt}</p>}
                        {ret.reviewNotes && <p className="text-xs text-gray-600">{t('orders.review_notes')}: {ret.reviewNotes}</p>}
                        <div className="mt-1">
                          {ret.items
                            .filter((r) => r.itemId === item._id)
                            .map((r, index) => (
                              <p key={index} className="text-xs text-gray-600">
                                {r.quantity} x {item.product?.name || t('product.unknown')} - {t('orders.reason')}: {t(`returns.${r.reason}`) || t('returns.no_reason')}
                              </p>
                            ))}
                        </div>
                        {ret.status === 'pending_approval' && (user.role === 'admin' || user.role === 'production') && (
                          <div className="mt-2 space-y-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-700">{t('returns.review_notes')}</label>
                              <Input
                                value={returnNotes[ret.returnId] || ''}
                                onChange={(e) => setReturnNotes((prev) => ({ ...prev, [ret.returnId]: e.target.value }))}
                                placeholder={t('returns.review_notes_placeholder')}
                                className="w-full mt-1 p-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                                aria-label={t('returns.review_notes')}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => updateReturnStatus(ret.returnId, 'approved')}
                                disabled={submitting === `return-${ret.returnId}`}
                                className={`px-3 py-1.5 text-sm rounded-lg text-white ${
                                  submitting === `return-${ret.returnId}` ? 'bg-gray-400' : 'bg-amber-600 hover:bg-amber-700'
                                }`}
                              >
                                {t('returns.approve')}
                              </Button>
                              <Button
                                onClick={() => updateReturnStatus(ret.returnId, 'rejected')}
                                disabled={submitting === `return-${ret.returnId}`}
                                className={`px-3 py-1.5 text-sm rounded-lg ${
                                  submitting === `return-${ret.returnId}` ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700 text-white'
                                }`}
                              >
                                {t('returns.reject')}
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
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-gray-800">{t('orders.notes')}</h3>
          <p className="text-xs text-gray-600 mt-1">{order.notes}</p>
        </div>
      )}

      {(user.role === 'admin' || user.role === 'production') && validTransitions[order.status]?.length > 0 && (
        <div className="mt-4 flex gap-2">
          {validTransitions[order.status].map((status) => (
            <Button
              key={status}
              onClick={() => updateOrderStatus(order.id, status)}
              disabled={submitting === `order-${order.id}`}
              className={`px-3 py-1.5 text-sm rounded-lg text-white ${
                submitting === `order-${order.id}` ? 'bg-gray-400' : status === 'cancelled' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {t(`orders.${status}`)}
            </Button>
          ))}
          {order.status === 'approved' && (
            <Button
              onClick={() => openAssignModal(order)}
              disabled={submitting === `order-${order.id}`}
              className={`px-3 py-1.5 text-sm rounded-lg text-white ${
                submitting === `order-${order.id}` ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {t('orders.assign_chefs')}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
};


export default OrderDetailsPage;