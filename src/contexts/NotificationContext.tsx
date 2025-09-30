import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { useSocket } from './SocketContext';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { notificationService } from './NotificationService';
import debounce from 'lodash/debounce';

interface Notification {
  _id: string;
  type: 'orderCreated' | 'orderConfirmed' | 'taskAssigned' | 'itemStatusUpdated' | 'orderStatusUpdated' | 'orderCompleted' | 'orderShipped' | 'orderDelivered' | 'returnStatusUpdated' | 'missingAssignments';
  message: string;
  data: {
    orderId?: string;
    branchId?: string;
    chefId?: string;
    taskId?: string;
    returnId?: string;
    itemId?: string;
    eventId?: string;
  };
  read: boolean;
  createdAt: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  unreadByPath: Record<string, number>;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { socket } = useSocket();
  const isRtl = language === 'ar';
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const notificationIds = useMemo(() => new Set<string>(), []);

  const translateUnit = (unit: string | undefined) => {
    const translations: Record<string, { ar: string; en: string }> = {
      'كيلو': { ar: 'كيلو', en: 'kg' },
      'قطعة': { ar: 'قطعة', en: 'piece' },
      'علبة': { ar: 'علبة', en: 'pack' },
      'صينية': { ar: 'صينية', en: 'tray' },
      'kg': { ar: 'كجم', en: 'kg' },
      'piece': { ar: 'قطعة', en: 'piece' },
      'pack': { ar: 'علبة', en: 'pack' },
      'tray': { ar: 'صينية', en: 'tray' },
    };
    return unit && translations[unit] ? (isRtl ? translations[unit].ar : translations[unit].en) : isRtl ? 'وحدة' : 'unit';
  };

  const playNotificationSound = useCallback(
    (soundUrl = '/sounds/notification.mp3', vibrate?: number[]) => {
      if (!hasInteracted) return;
      const audio = new Audio(soundUrl);
      audio.play().catch((err) => console.error(`[${new Date().toISOString()}] Audio play failed:`, err));
      if (navigator.vibrate && vibrate) navigator.vibrate(vibrate);
    },
    [hasInteracted]
  );

  useEffect(() => {
    const handleUserInteraction = () => {
      setHasInteracted(true);
      const audio = new Audio('/sounds/notification.mp3');
      audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
        })
        .catch((err) => console.error(`[${new Date().toISOString()}] Audio context initialization failed:`, err));
      document.removeEventListener('click', handleUserInteraction);
    };
    document.addEventListener('click', handleUserInteraction, { once: true });
    return () => document.removeEventListener('click', handleUserInteraction);
  }, []);

  const fetchNotifications = useCallback(
    debounce(async () => {
      if (!user || isFetching) return;
      setIsFetching(true);
      const params: any = { userId: user.id || user._id, limit: 100 };
      if (user.role === 'production') params.departmentId = user.departmentId || user._id;
      if (user.role === 'branch') params.branchId = user.branchId;
      if (user.role === 'chef') params.chefId = user.id || user._id;
      try {
        const data = await notificationService.fetchNotifications(params);
        const uniqueNotifications = data.filter(
          (n: any, index: number, self: any[]) => index === self.findIndex((t: any) => t.data?.eventId === n.data?.eventId)
        );
        setNotifications(uniqueNotifications);
        uniqueNotifications.forEach((n: any) => notificationIds.add(n.data?.eventId));
      } catch (err) {
        toast.error(t('errors.fetch_notifications'), { position: isRtl ? 'top-left' : 'top-right', toastId: `fetch-notifications-${Date.now()}` });
      } finally {
        setIsFetching(false);
      }
    }, 1000),
    [user, t, isRtl]
  );

  const addNotification = useCallback(
    (notification: Notification) => {
      if (!notification.data.eventId) {
        notification.data.eventId = crypto.randomUUID();
      }
      if (notificationIds.has(notification.data.eventId)) {
        console.log(`[${new Date().toISOString()}] Duplicate notification ignored:`, notification.data.eventId);
        return;
      }
      notificationIds.add(notification.data.eventId);
      setNotifications((prev) => [notification, ...prev].slice(0, 100));
      if (!notification.read) {
        playNotificationSound('/sounds/notification.mp3', [200, 100, 200]);
        toast[notification.type.includes('Completed') || notification.type.includes('Confirmed') ? 'success' : 'info'](
          notification.message,
          {
            toastId: notification.data.eventId,
            position: isRtl ? 'top-left' : 'top-right',
            autoClose: 4000,
            pauseOnFocusLoss: true,
            style: { direction: isRtl ? 'rtl' : 'ltr', textAlign: isRtl ? 'right' : 'left', fontFamily: isRtl ? 'Noto Sans Arabic' : 'sans-serif' },
            onClick: () => {
              if (notification.data.orderId) {
                window.location.href = `/orders/${notification.data.orderId}`;
              }
            },
          }
        );
      }
    },
    [isRtl, playNotificationSound]
  );

  const markAsRead = useCallback(
    async (id: string) => {
      if (!/^[0-9a-fA-F]{24}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
        toast.error(t('errors.invalid_notification_id'), { position: isRtl ? 'top-left' : 'top-right', toastId: `invalid-notification-${id}` });
        return;
      }
      try {
        await notificationService.markAsRead(id);
        setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
        socket?.emit('notificationRead', { notificationId: id, userId: user?.id || user?._id });
      } catch (err) {
        toast.error(t('errors.mark_notification_read'), { position: isRtl ? 'top-left' : 'top-right', toastId: `mark-read-${id}-${Date.now()}` });
      }
    },
    [socket, user, t, isRtl]
  );

  const markAllAsRead = useCallback(
    async () => {
      if (!user) return;
      try {
        await notificationService.markAllAsRead(user.id || user._id);
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        socket?.emit('allNotificationsRead', { userId: user.id || user._id });
      } catch (err) {
        toast.error(t('errors.mark_all_notifications_read'), { position: isRtl ? 'top-left' : 'top-right', toastId: `mark-all-read-${Date.now()}` });
      }
    },
    [socket, user, t, isRtl]
  );

  const clearNotifications = useCallback(
    async () => {
      try {
        await notificationService.clearNotifications();
        setNotifications([]);
        socket?.emit('notificationsCleared', { userId: user?.id || user?._id });
        notificationIds.clear();
      } catch (err) {
        toast.error(t('errors.clear_notifications'), { position: isRtl ? 'top-left' : 'top-right', toastId: `clear-notifications-${Date.now()}` });
      }
    },
    [socket, user, t, isRtl]
  );

  const getCategoryForNotification = useCallback(
    (notif: Notification): string | null => {
      const { data, type } = notif;
      if (data?.orderId && !data.taskId) return 'orders';
      if (data?.taskId || ['taskAssigned', 'itemStatusUpdated'].includes(type)) return 'production-tasks';
      return null;
    },
    []
  );

  const getPathForCategory = useCallback(
    (category: string, role: string): string | null => {
      switch (category) {
        case 'orders':
          return role === 'branch' ? '/branch-orders' : '/orders';
        case 'production-tasks':
          return role === 'chef' ? '/chef-tasks' : '/production-tasks';
        default:
          return null;
      }
    },
    []
  );

  const unreadByPath = useMemo(() => {
    const counts: Record<string, number> = {};
    notifications
      .filter((n) => !n.read)
      .forEach((notif) => {
        const category = getCategoryForNotification(notif);
        if (category && user?.role) {
          const path = getPathForCategory(category, user.role);
          if (path) {
            counts[path] = (counts[path] || 0) + 1;
          }
        }
      });
    return counts;
  }, [notifications, user?.role, getCategoryForNotification, getPathForCategory]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  useEffect(() => {
    if (user && !isFetching) fetchNotifications();
  }, [user, fetchNotifications]);

  useEffect(() => {
    if (!socket || !user) {
      console.warn(`[${new Date().toISOString()}] Socket or user not available`);
      return;
    }

    const events = [
      {
        name: 'orderCreated',
        handler: (data: any) => {
          if (!data?._id || !Array.isArray(data.items) || !data.orderNumber || !data.branch?.name) {
            console.warn(`[${new Date().toISOString()}] Invalid order data:`, data);
            return;
          }
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (user.role === 'production' && user.departmentId && !data.items.some((item: any) => item?.product?.department?._id === user.departmentId)) return;
          if (user.role === 'branch' && data.branch?._id !== user.branchId) return;

          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'orderCreated',
            message: t('notifications.order_created', {
              orderNumber: data.orderNumber,
              branchName: data.branch?.name || t('branches.unknown'),
            }),
            data: { orderId: data._id, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
          });
        },
      },
      {
        name: 'orderConfirmed',
        handler: (data: any) => {
          if (!['admin', 'branch'].includes(user.role)) return;
          if (!data.orderId || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid order confirmed data:`, data);
            return;
          }
          if (user.role === 'branch' && data.branchId !== user.branchId) return;

          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'orderConfirmed',
            message: t('notifications.order_confirmed', {
              orderNumber: data.orderNumber,
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
          });
        },
      },
      {
        name: 'taskAssigned',
        handler: (notification: any) => {
          const data = notification.data || notification;
          if (!data.orderId || !data.orderNumber || !Array.isArray(data.items) || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid task assigned data:`, data);
            return;
          }
          if (!['admin', 'production', 'chef'].includes(user.role)) return;
          if (user.role === 'chef' && !data.items.some((item: any) => item.assignedTo?._id === user._id)) return;

          data.items.forEach((item: any) => {
            if (!item._id || !item.product?.name || !item.quantity || !item.assignedTo?.name) {
              console.warn(`[${new Date().toISOString()}] Invalid item data:`, item);
              return;
            }
            const itemEventId = `${data.eventId || crypto.randomUUID()}-${item._id}`;
            if (notificationIds.has(itemEventId)) return;
            notificationIds.add(itemEventId);
            addNotification({
              _id: itemEventId,
              type: 'taskAssigned',
              message: t('notifications.task_assigned_to_chef', {
                chefName: item.assignedTo.name || t('chefs.unknown'),
                productName: item.product.name || t('products.unknown'),
                quantity: item.quantity,
                unit: translateUnit(item.unit || item.product?.unit),
                orderNumber: data.orderNumber,
                branchName: data.branchName || t('branches.unknown'),
              }),
              data: { orderId: data.orderId, itemId: item._id, eventId: itemEventId },
              read: false,
              createdAt: new Date().toISOString(),
            });
          });
        },
      },
      {
        name: 'itemStatusUpdated',
        handler: (data: any) => {
          if (!['admin', 'production', 'chef'].includes(user.role)) return;
          if (!data.orderId || !data.itemId || !data.status || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid item status update data:`, data);
            return;
          }
          if (user.role === 'chef' && data.chefId !== user._id) return;

          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'itemStatusUpdated',
            message: t('notifications.item_status_updated', {
              orderNumber: data.orderNumber,
              status: t(`item_status.${data.status}`),
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, itemId: data.itemId, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
          });
        },
      },
      {
        name: 'orderStatusUpdated',
        handler: (data: any) => {
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.status || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid order status update data:`, data);
            return;
          }
          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'orderStatusUpdated',
            message: t('notifications.order_status_updated', {
              orderNumber: data.orderNumber,
              status: t(`order_status.${data.status}`),
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
          });
        },
      },
      {
        name: 'orderCompleted',
        handler: (data: any) => {
          if (!['admin', 'branch', 'production', 'chef'].includes(user.role)) return;
          if (!data.orderId || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid order completed data:`, data);
            return;
          }
          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'orderCompleted',
            message: t('notifications.order_completed', {
              orderNumber: data.orderNumber,
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
          });
        },
      },
      {
        name: 'orderShipped',
        handler: (data: any) => {
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.orderNumber || !data.branchName || !data.branchId) {
            console.warn(`[${new Date().toISOString()}] Invalid order shipped data:`, data);
            return;
          }
          if (user.role === 'branch' && data.branchId !== user.branchId) return;
          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'orderShipped',
            message: t('notifications.order_shipped', {
              orderNumber: data.orderNumber,
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
          });
        },
      },
      {
        name: 'orderDelivered',
        handler: (data: any) => {
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid order delivered data:`, data);
            return;
          }
          if (user.role === 'branch' && data.branchId !== user.branchId) return;
          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'orderDelivered',
            message: t('notifications.order_delivered', {
              orderNumber: data.orderNumber,
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
          });
        },
      },
      {
        name: 'returnStatusUpdated',
        handler: (data: any) => {
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.returnId || !data.status || !data.orderNumber) {
            console.warn(`[${new Date().toISOString()}] Invalid return status update data:`, data);
            return;
          }
          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'returnStatusUpdated',
            message: t('notifications.return_status_updated', {
              orderNumber: data.orderNumber,
              status: t(`returns.${data.status}`),
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, returnId: data.returnId, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
          });
        },
      },
      {
        name: 'missingAssignments',
        handler: (data: any) => {
          if (!['admin', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.itemId || !data.orderNumber || !data.productName) {
            console.warn(`[${new Date().toISOString()}] Invalid missing assignments data:`, data);
            return;
          }
          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'missingAssignments',
            message: t('notifications.missing_assignments', {
              orderNumber: data.orderNumber,
              productName: data.productName || t('products.unknown'),
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, itemId: data.itemId, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
          });
        },
      },
      {
        name: 'notificationRead',
        handler: async (data: any) => {
          if (!data.notificationId) {
            console.warn(`[${new Date().toISOString()}] Invalid notification read data:`, data);
            return;
          }
          await markAsRead(data.notificationId);
        },
      },
    ];

    events.forEach(({ name, handler }) => socket.on(name, handler));
    return () => {
      events.forEach(({ name, handler }) => socket.off(name, handler));
      notificationIds.clear();
    };
  }, [socket, user, addNotification, markAsRead, t, isRtl]);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, unreadByPath, addNotification, markAsRead, markAllAsRead, clearNotifications }}
    >
      <ToastContainer
        position={isRtl ? 'top-left' : 'top-right'}
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={isRtl}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('يجب استخدام useNotifications داخل NotificationProvider');
  return context;
};