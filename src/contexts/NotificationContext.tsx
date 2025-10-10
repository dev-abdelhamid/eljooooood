import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { useSocket } from './SocketContext';
import { toast } from 'react-toastify';
import { notificationService } from './NotificationService';
import debounce from 'lodash/debounce';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  _id: string;
  type: NotificationType;
  message: string;
  data?: {
    orderId?: string;
    branchId?: string;
    chefId?: string;
    taskId?: string;
    returnId?: string;
    eventId?: string;
    itemId?: string;
  };
  read: boolean;
  createdAt: string;
  sound?: string;
  vibrate?: number[];
}

interface SocketEventData {
  orderId?: string;
  orderNumber?: string;
  branchName?: string;
  branchId?: string;
  chefId?: string;
  taskId?: string;
  productName?: string;
  quantity?: number;
  unit?: string;
  status?: string;
  eventId?: string;
  returnId?: string;
  returnNumber?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  unreadByPath: Record<string, number>;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearNotifications: () => Promise<void>;
  refreshTasks: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { socket, isConnected } = useSocket();
  const isRtl = language === 'ar';
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
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
      if (!user || isFetching || !isConnected) return;
      setIsFetching(true);
      const params: any = { userId: user.id || user._id, limit: 100 };
      if (user.role === 'production') params.departmentId = user.departmentId || user.department?._id;
      if (user.role === 'branch') params.branchId = user.branchId;
      if (user.role === 'chef') params.chefId = user.id || user._id;
      try {
        const data = await notificationService.fetchNotifications(params);
        const uniqueNotifications = data.filter(
          (n: any, index: number, self: any[]) => index === self.findIndex((t: any) => t.data?.eventId === n.data?.eventId)
        );
        setNotifications(
          uniqueNotifications.map((n: any) => ({
            _id: n._id,
            type: n.type as NotificationType || 'info',
            message: n.message.substring(0, 100),
            data: {
              orderId: n.data?.orderId,
              branchId: n.data?.branchId,
              chefId: n.data?.chefId,
              taskId: n.data?.taskId,
              eventId: n.data?.eventId,
              returnId: n.data?.returnId,
              itemId: n.data?.itemId,
            },
            read: n.read,
            createdAt: n.createdAt,
            sound: n.data?.sound || '/sounds/notification.mp3',
            vibrate: n.data?.vibrate || [200, 100, 200],
          }))
        );
      } catch (err) {
        toast.error(t('errors.fetch_notifications'), { position: isRtl ? 'top-left' : 'top-right', toastId: `fetch-notifications-${Date.now()}` });
      } finally {
        setIsFetching(false);
      }
    }, 1000),
    [user, t, isRtl, isConnected]
  );

  const addNotification = useCallback(
    (notification: Notification) => {
      if (!notification.eventId) {
        notification.eventId = crypto.randomUUID();
      }
      if (notificationIds.current.has(notification.eventId)) {
        console.log(`[${new Date().toISOString()}] Duplicate notification ignored:`, notification.eventId);
        return;
      }
      notificationIds.current.add(notification.eventId);
      setNotifications((prev) => [notification, ...prev].slice(0, 100));
      if (!notification.read) {
        playNotificationSound(notification.sound, notification.vibrate);
        toast[notification.type](notification.message, {
          toastId: notification.eventId,
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 4000,
          pauseOnFocusLoss: true,
          style: { direction: isRtl ? 'rtl' : 'ltr', textAlign: isRtl ? 'right' : 'left' },
        });
      }
      if (notification.data?.taskId || notification.type === 'taskAssigned' || notification.type === 'itemStatusUpdated') {
        setRefreshTrigger((prev) => prev + 1);
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
        if (socket && isConnected) {
          socket.emit('notificationRead', { notificationId: id, userId: user?.id || user?._id });
        }
      } catch (err) {
        toast.error(t('errors.mark_notification_read'), { position: isRtl ? 'top-left' : 'top-right', toastId: `mark-read-${id}-${Date.now()}` });
      }
    },
    [socket, user, t, isRtl, isConnected]
  );

  const markAllAsRead = useCallback(
    async () => {
      if (!user) return;
      try {
        await notificationService.markAllAsRead(user.id || user._id);
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        if (socket && isConnected) {
          socket.emit('allNotificationsRead', { userId: user.id || user._id });
        }
      } catch (err) {
        toast.error(t('errors.mark_all_notifications_read'), { position: isRtl ? 'top-left' : 'top-right', toastId: `mark-all-read-${Date.now()}` });
      }
    },
    [socket, user, t, isRtl, isConnected]
  );

  const clearNotifications = useCallback(
    async () => {
      try {
        await notificationService.clearNotifications();
        setNotifications([]);
        notificationIds.current.clear();
        if (socket && isConnected) {
          socket.emit('notificationsCleared', { userId: user?.id || user?._id });
        }
      } catch (err) {
        toast.error(t('errors.clear_notifications'), { position: isRtl ? 'top-left' : 'top-right', toastId: `clear-notifications-${Date.now()}` });
      }
    },
    [socket, user, t, isRtl, isConnected]
  );

  const refreshTasks = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const getCategoryForNotification = useCallback(
    (notif: Notification): string | null => {
      const { data, type } = notif;
      if (data?.orderId && !data.taskId) return 'orders';
      if (data?.taskId || ['taskAssigned', 'taskStarted', 'taskCompleted', 'itemStatusUpdated'].includes(type)) return 'production-tasks';
      if (data?.returnId || ['returnCreated', 'returnStatusUpdated'].includes(type)) return 'returns';
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
        case 'returns':
          return role === 'branch' ? '/branch-returns' : '/returns';
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
    if (user && isConnected && !isFetching) fetchNotifications();
  }, [user, isConnected, fetchNotifications]);

  useEffect(() => {
    if (!socket || !user || !isConnected) {
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
          if (!data.orderId || !data.orderNumber || !data.branchName) return;
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (user.role === 'branch' && data.branchId !== user.branchId) return;
          if (user.role === 'production' && user.departmentId && !data.items?.some((item: any) => item?.department?._id === user.departmentId)) return;

          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'success',
            message: t('notifications.order_created', {
              orderNumber: data.orderNumber,
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, branchId: data.branchId, eventId },
            read: false,
            createdAt: new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [200, 100, 200],
          });
        },
      },
      {
        name: 'taskAssigned',
        handler: (data: SocketEventData) => {
          if (!data.orderId || !data.taskId || !data.chefId || !data.productName || !data.quantity || !data.orderNumber || !data.branchName) return;
          if (!['admin', 'production', 'chef'].includes(user.role)) return;
          if (user.role === 'chef' && data.chefId !== user._id) return;

          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'info',
            message: t('notifications.task_assigned_to_chef', {
              chefName: user.role === 'chef' ? t('chefs.you') : data.assignedTo?.name || t('chefs.unknown'),
              productName: data.productName || t('products.unknown'),
              quantity: data.quantity || 'غير معروف',
              unit: translateUnit(data.unit),
              orderNumber: data.orderNumber,
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, taskId: data.taskId, chefId: data.chefId, eventId },
            read: false,
            createdAt: new Date().toISOString(),
            sound: '/sounds/task-assigned.mp3',
            vibrate: [400, 100, 400],
          });
          refreshTasks();
        },
      },
      {
        name: 'taskStarted',
        handler: (data: SocketEventData) => {
          if (!data.orderId || !data.taskId || !data.chefId || !data.productName || !data.orderNumber || !data.branchName) return;
          if (!['admin', 'production', 'chef'].includes(user.role)) return;
          if (user.role === 'chef' && data.chefId !== user._id) return;

          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'info',
            message: t('notifications.task_started', {
              productName: data.productName || t('products.unknown'),
              orderNumber: data.orderNumber,
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, taskId: data.taskId, chefId: data.chefId, eventId },
            read: false,
            createdAt: new Date().toISOString(),
            sound: '/sounds/task-status-updated.mp3',
            vibrate: [200, 100, 200],
          });
          refreshTasks();
        },
      },
      {
        name: 'taskCompleted',
        handler: (data: SocketEventData) => {
          if (!data.orderId || !data.taskId || !data.chefId || !data.productName || !data.orderNumber || !data.branchName) return;
          if (!['admin', 'production', 'chef'].includes(user.role)) return;
          if (user.role === 'chef' && data.chefId !== user._id) return;

          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'success',
            message: t('notifications.task_completed', {
              productName: data.productName || t('products.unknown'),
              orderNumber: data.orderNumber,
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, taskId: data.taskId, chefId: data.chefId, eventId },
            read: false,
            createdAt: new Date().toISOString(),
            sound: '/sounds/task-status-updated.mp3',
            vibrate: [200, 100, 200],
          });
          refreshTasks();
        },
      },
      {
        name: 'orderStatusUpdated',
        handler: (data: SocketEventData) => {
          if (!data.orderId || !data.status || !data.orderNumber || !data.branchName) return;
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (user.role === 'branch' && data.branchId !== user.branchId) return;

          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'info',
            message: t('notifications.order_status_updated', {
              orderNumber: data.orderNumber,
              status: t(`order_status.${data.status}`),
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, branchId: data.branchId, eventId },
            read: false,
            createdAt: new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [200, 100, 200],
          });
        },
      },
      {
        name: 'returnCreated',
        handler: (data: SocketEventData) => {
          if (!data.returnId || !data.returnNumber || !data.branchName) return;
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (user.role === 'branch' && data.branchId !== user.branchId) return;

          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'info',
            message: t('notifications.return_created', {
              returnNumber: data.returnNumber,
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { returnId: data.returnId, branchId: data.branchId, eventId },
            read: false,
            createdAt: new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [200, 100, 200],
          });
        },
      },
      {
        name: 'returnStatusUpdated',
        handler: (data: SocketEventData) => {
          if (!data.returnId || !data.status || !data.returnNumber || !data.branchName) return;
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (user.role === 'branch' && data.branchId !== user.branchId) return;

          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'info',
            message: t('notifications.return_status_updated', {
              returnNumber: data.returnNumber,
              status: t(`returns.${data.status}`),
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { returnId: data.returnId, branchId: data.branchId, eventId },
            read: false,
            createdAt: new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [200, 100, 200],
          });
        },
      },
      {
        name: 'notificationRead',
        handler: async (data: any) => {
          if (!data.notificationId) return;
          await markAsRead(data.notificationId);
        },
      },
      {
        name: 'allNotificationsRead',
        handler: async () => {
          await markAllAsRead();
        },
      },
    ];

    events.forEach(({ name, handler }) => socket.on(name, handler));
    return () => {
      events.forEach(({ name, handler }) => socket.off(name, handler));
    };
  }, [socket, user, addNotification, markAsRead, markAllAsRead, t, isRtl, isConnected, refreshTasks]);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, unreadByPath, addNotification, markAsRead, markAllAsRead, clearNotifications, refreshTasks }}
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