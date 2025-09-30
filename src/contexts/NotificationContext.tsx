import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { useSocket } from './SocketContext';
import { toast } from 'react-toastify';
import { notificationService } from './NotificationService';
import debounce from 'lodash/debounce';

interface Notification {
  _id: string;
  type: 'orderCreated' | 'orderStatusUpdated' | 'taskAssigned' | 'taskStatusUpdated' | 'orderCancelled';
  message: string;
  data: {
    orderId?: string;
    orderNumber?: string;
    branchId?: string;
    taskId?: string;
    productId?: string;
    productName?: string;
    quantity?: number;
    unit?: string;
    status?: string;
    reason?: string;
    eventId?: string;
  };
  read: boolean;
  createdAt: string;
  isRtl: boolean;
}

interface SocketEventData {
  orderId?: string;
  orderNumber?: string;
  branchId?: string;
  branchName?: string;
  productId?: string;
  productName?: string;
  quantity?: number;
  unit?: string;
  status?: string;
  chefId?: string;
  chefName?: string;
  taskId?: string;
  eventId?: string;
  reason?: string;
  isRtl?: boolean;
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
  const isRtl = language === 'ar';
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const notificationIds = React.useRef(new Set<string>());

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
      if (user.role === 'production') params.departmentId = user.departmentId || user.department?._id;
      if (user.role === 'branch') params.branchId = user.branchId;
      if (user.role === 'chef') params.chefId = user.id || user._id;
      try {
        const data = await notificationService.fetchNotifications(params);
        setNotifications(
          data.map((n: any) => ({
            _id: n._id,
            type: n.type,
            message: n.message.substring(0, 100),
            data: {
              orderId: n.data?.orderId,
              orderNumber: n.data?.orderNumber,
              branchId: n.data?.branchId,
              taskId: n.data?.taskId,
              productId: n.data?.productId,
              productName: n.data?.productName,
              quantity: n.data?.quantity,
              unit: n.data?.unit,
              status: n.data?.status,
              reason: n.data?.reason,
              eventId: n.data?.eventId,
            },
            read: n.read,
            createdAt: n.createdAt,
            isRtl: n.isRtl || isRtl,
          }))
        );
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
      console.log(`[${new Date().toISOString()}] Adding notification:`, notification);
      if (!notification.data.eventId) {
        notification.data.eventId = crypto.randomUUID();
      }
      if (notificationIds.current.has(notification.data.eventId)) {
        console.log(`[${new Date().toISOString()}] Duplicate notification ignored:`, notification.data.eventId);
        return;
      }
      notificationIds.current.add(notification.data.eventId);
      setNotifications((prev) => [notification, ...prev].slice(0, 100));
      if (!notification.read) {
        playNotificationSound('/sounds/notification.mp3', [200, 100, 200]);
        toast[notification.type === 'orderCancelled' ? 'error' : 'info'](notification.message, {
          toastId: notification.data.eventId,
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 4000,
          pauseOnFocusLoss: true,
          style: { direction: isRtl ? 'rtl' : 'ltr', textAlign: isRtl ? 'right' : 'left' },
        });
      }
    },
    [isRtl, playNotificationSound]
  );

  const markAsRead = useCallback(
    async (id: string) => {
      if (!/^[0-9a-fA-F]{24}$/.test(id)) {
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
        notificationIds.current.clear();
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
      if (data?.taskId || ['taskAssigned', 'taskStatusUpdated'].includes(type)) return 'production-tasks';
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

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  useEffect(() => {
    if (user && !isFetching) fetchNotifications();
  }, [user, fetchNotifications]);

  useEffect(() => {
    if (!socket || !user) {
      console.warn(`[${new Date().toISOString()}] Socket or user not available`);
      return;
    }

    socket.emit('joinRoom', {
      role: user.role,
      branchId: user.branchId,
      chefId: user.role === 'chef' ? user._id : undefined,
      departmentId: user.role === 'production' ? user.department?._id : undefined,
      userId: user._id,
    });

    const events = [
      {
        name: 'orderCreated',
        handler: (data: SocketEventData) => {
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid order created data:`, data);
            return;
          }
          if (user.role === 'branch' && data.branchId !== user.branchId) return;
          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'orderCreated',
            message: t('notifications.order_created', {
              orderNumber: data.orderNumber,
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, orderNumber: data.orderNumber, branchId: data.branchId, eventId },
            read: false,
            createdAt: new Date().toISOString(),
            isRtl,
          });
        },
      },
      {
        name: 'orderStatusUpdated',
        handler: (data: SocketEventData) => {
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.orderNumber || !data.status || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid order status update data:`, data);
            return;
          }
          if (user.role === 'branch' && data.branchId !== user.branchId) return;
          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'orderStatusUpdated',
            message: t('notifications.order_status_updated', {
              orderNumber: data.orderNumber,
              status: t(`order_status.${data.status}`),
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, orderNumber: data.orderNumber, branchId: data.branchId, status: data.status, eventId },
            read: false,
            createdAt: new Date().toISOString(),
            isRtl,
          });
        },
      },
      {
        name: 'taskAssigned',
        handler: (data: SocketEventData) => {
          if (!['admin', 'production', 'chef'].includes(user.role)) return;
          if (!data.taskId || !data.orderId || !data.orderNumber || !data.productName || !data.quantity || !data.chefId) {
            console.warn(`[${new Date().toISOString()}] Invalid task assigned data:`, data);
            return;
          }
          if (user.role === 'chef' && data.chefId !== user._id) return;
          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'taskAssigned',
            message: t('notifications.task_assigned_to_chef', {
              chefName: data.chefName || t('chefs.unknown'),
              productName: data.productName || t('products.unknown'),
              quantity: data.quantity,
              unit: translateUnit(data.unit),
              orderNumber: data.orderNumber,
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: {
              taskId: data.taskId,
              orderId: data.orderId,
              orderNumber: data.orderNumber,
              productId: data.productId,
              productName: data.productName,
              quantity: data.quantity,
              unit: data.unit,
              eventId,
            },
            read: false,
            createdAt: new Date().toISOString(),
            isRtl,
          });
        },
      },
      {
        name: 'taskStatusUpdated',
        handler: (data: SocketEventData) => {
          if (!['admin', 'production', 'chef'].includes(user.role)) return;
          if (!data.taskId || !data.orderId || !data.orderNumber || !data.productName || !data.status) {
            console.warn(`[${new Date().toISOString()}] Invalid task status update data:`, data);
            return;
          }
          if (user.role === 'chef' && data.chefId !== user._id) return;
          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'taskStatusUpdated',
            message: t('notifications.task_status_updated', {
              productName: data.productName || t('products.unknown'),
              status: t(`task_status.${data.status}`),
              orderNumber: data.orderNumber,
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: {
              taskId: data.taskId,
              orderId: data.orderId,
              orderNumber: data.orderNumber,
              productId: data.productId,
              productName: data.productName,
              quantity: data.quantity,
              unit: data.unit,
              status: data.status,
              eventId,
            },
            read: false,
            createdAt: new Date().toISOString(),
            isRtl,
          });
        },
      },
      {
        name: 'orderCancelled',
        handler: (data: SocketEventData) => {
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid order cancelled data:`, data);
            return;
          }
          if (user.role === 'branch' && data.branchId !== user.branchId) return;
          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'orderCancelled',
            message: t('notifications.order_cancelled', {
              orderNumber: data.orderNumber,
              branchName: data.branchName || t('branches.unknown'),
              reason: data.reason || t('notifications.no_reason'),
            }),
            data: { orderId: data.orderId, orderNumber: data.orderNumber, branchId: data.branchId, reason: data.reason, eventId },
            read: false,
            createdAt: new Date().toISOString(),
            isRtl,
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
          try {
            await markAsRead(data.notificationId);
          } catch (err) {
            console.error(`[${new Date().toISOString()}] Failed to mark notification as read:`, err);
          }
        },
      },
    ];

    events.forEach(({ name, handler }) => socket.on(name, handler));
    return () => {
      events.forEach(({ name, handler }) => socket.off(name, handler));
      notificationIds.current.clear();
    };
  }, [socket, user, addNotification, markAsRead, t, isRtl, playNotificationSound, fetchNotifications]);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, unreadByPath, addNotification, markAsRead, markAllAsRead, clearNotifications }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('يجب استخدام useNotifications داخل NotificationProvider');
  return context;
};