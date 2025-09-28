import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { useSocket } from './SocketContext';
import { toast } from 'react-toastify';
import { notificationService } from './NotificationService';
import debounce from 'lodash/debounce';
import { ordersAPI } from '../services/api';

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
    eventId?: string;
    returnId?: string;
    itemId?: string;
  };
  read: boolean;
  createdAt: string;
  eventId?: string;
  sound?: string;
  vibrate?: number[];
}

interface SocketEventData {
  _id: string;
  orderId?: string;
  orderNumber?: string;
  branchName?: string;
  branchId?: string;
  items?: Array<{
    _id: string;
    product?: { _id: string; name?: string; nameEn?: string; unit?: string; unitEn?: string; department?: { _id: string; name?: string; nameEn?: string } };
    quantity?: number;
    status?: string;
    assignedTo?: { _id: string; username?: string; name?: string; nameEn?: string };
  }>;
  eventId?: string;
  status?: string;
  type: string;
  message: string;
  read?: boolean;
  createdAt?: string;
}

interface SocketEventConfig {
  type: string;
  sound: string;
  vibrate: number[];
  roles: string[];
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
      'unit': { ar: 'وحدة', en: 'unit' },
    };
    return unit && translations[unit] ? translations[unit][isRtl ? 'ar' : 'en'] : isRtl ? 'وحدة' : 'unit';
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
            eventId: n.data?.eventId,
            sound: '/sounds/notification.mp3',
            vibrate: [200, 100, 200],
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
        playNotificationSound(notification.sound || '/sounds/notification.mp3', notification.vibrate);
        toast[notification.type](notification.message, {
          toastId: notification.eventId,
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 4000,
          pauseOnFocusLoss: true,
          style: { direction: isRtl ? 'rtl' : 'ltr', textAlign: isRtl ? 'left' : 'right' },
        });
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
      if (data?.taskId || ['taskAssigned', 'taskStarted', 'taskCompleted'].includes(type)) return 'production-tasks';
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

    // الانضمام إلى الغرف بناءً على الدور
    const rooms = [`user-${user._id}`];
    if (user.role === 'admin') rooms.push('admin');
    if (user.role === 'production' && user.department?._id) rooms.push(`department-${user.department._id}`);
    if (user.role === 'branch' && user.branchId) rooms.push(`branch-${user.branchId}`);
    if (user.role === 'chef') rooms.push(`chef-${user._id}`);
    socket.emit('joinRoom', rooms);

    const events: { name: string; handler: (data: SocketEventData) => void; config: SocketEventConfig }[] = [
      {
        name: 'newNotification',
        handler: (data) => {
          if (!data._id || !data.type || !data.message || !data.data?.eventId) {
            console.warn(`[${new Date().toISOString()}] Invalid newNotification data:`, data);
            return;
          }
          if (!['admin', 'branch', 'production', 'chef'].includes(user.role)) return;
          if (notificationIds.current.has(data.data.eventId)) return;
          notificationIds.current.add(data.data.eventId);
          addNotification({
            _id: data._id,
            type: data.type as NotificationType,
            message: data.message,
            data: data.data,
            read: data.read || false,
            createdAt: data.createdAt || new Date().toISOString(),
            eventId: data.data.eventId,
            sound: '/sounds/notification.mp3',
            vibrate: [200, 100, 200],
          });
        },
        config: {
          type: 'NEW_NOTIFICATION',
          sound: '/sounds/notification.mp3',
          vibrate: [200, 100, 200],
          roles: ['admin', 'branch', 'production', 'chef'],
        },
      },
      {
        name: 'orderCreated',
        handler: (data) => {
          if (!data.orderId || !data.orderNumber || !Array.isArray(data.items)) {
            console.warn(`[${new Date().toISOString()}] Invalid orderCreated data:`, data);
            return;
          }
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (user.role === 'production' && user.department?._id && !data.items.some((item) => item.product?.department?._id === user.department._id)) return;
          if (user.role === 'branch' && data.branchId !== user.branchId) return;
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
            data: { orderId: data.orderId, eventId },
            read: false,
            createdAt: data.createdAt || new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [200, 100, 200],
          });
        },
        config: {
          type: 'ADD_ORDER',
          sound: '/sounds/notification.mp3',
          vibrate: [200, 100, 200],
          roles: ['admin', 'branch', 'production'],
        },
      },
      {
        name: 'orderApproved',
        handler: (data) => {
          if (!data.orderId || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid orderApproved data:`, data);
            return;
          }
          if (!['admin', 'branch'].includes(user.role)) return;
          if (user.role === 'branch' && data.branchId !== user.branchId) return;
          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'success',
            message: t('notifications.order_approved', {
              orderNumber: data.orderNumber,
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, eventId },
            read: false,
            createdAt: data.createdAt || new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [200, 100, 200],
          });
        },
        config: {
          type: 'UPDATE_ORDER_STATUS',
          sound: '/sounds/notification.mp3',
          vibrate: [200, 100, 200],
          roles: ['admin', 'branch'],
        },
      },
      {
        name: 'taskAssigned',
        handler: (data) => {
          console.log(`[${new Date().toISOString()}] taskAssigned - Received data:`, JSON.stringify(data, null, 2));
          if (!data.orderId || !data.orderNumber || !Array.isArray(data.items) || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid taskAssigned data:`, data);
            return;
          }
          if (!['admin', 'production', 'chef'].includes(user.role)) return;
          if (user.role === 'chef' && !data.items.some((item) => item.assignedTo?._id === user._id)) return;
          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          data.items.forEach((item) => {
            if (!item._id || !item.product?.name || !item.quantity) {
              console.warn(`[${new Date().toISOString()}] Invalid item data for notification:`, item);
              return;
            }
            const itemEventId = `${eventId}-${item._id}`;
            if (notificationIds.current.has(itemEventId)) return;
            notificationIds.current.add(itemEventId);
            addNotification({
              _id: itemEventId,
              type: 'info',
              message: t('notifications.task_assigned_to_chef', {
                chefName: item.assignedTo?.name || item.assignedTo?.username || t('chefs.unknown'),
                productName: isRtl ? item.product?.name : (item.product?.nameEn || item.product?.name || t('products.unknown')),
                quantity: item.quantity || 'غير معروف',
                unit: translateUnit(item.unit || item.product?.unit),
                orderNumber: data.orderNumber,
                branchName: data.branchName || t('branches.unknown'),
              }),
              data: { orderId: data.orderId, itemId: item._id, eventId: itemEventId },
              read: false,
              createdAt: data.createdAt || new Date().toISOString(),
              sound: '/sounds/notification.mp3',
              vibrate: [400, 100, 400],
            });
          });
        },
        config: {
          type: 'TASK_ASSIGNED',
          sound: '/sounds/notification.mp3',
          vibrate: [400, 100, 400],
          roles: ['admin', 'production', 'chef'],
        },
      },
      {
        name: 'taskStarted',
        handler: (data) => {
          if (!data.orderId || !data.orderNumber || !data.branchName || !data.taskId) {
            console.warn(`[${new Date().toISOString()}] Invalid taskStarted data:`, data);
            return;
          }
          if (!['admin', 'production', 'chef'].includes(user.role)) return;
          if (user.role === 'chef' && data.chefId !== user._id) return;
          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'info',
            message: t('notifications.task_started', {
              orderNumber: data.orderNumber,
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, taskId: data.taskId, eventId },
            read: false,
            createdAt: data.createdAt || new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [200, 100, 200],
          });
        },
        config: {
          type: 'TASK_STARTED',
          sound: '/sounds/notification.mp3',
          vibrate: [200, 100, 200],
          roles: ['admin', 'production', 'chef'],
        },
      },
      {
        name: 'taskCompleted',
        handler: (data) => {
          if (!data.orderId || !data.orderNumber || !data.branchName || !data.taskId) {
            console.warn(`[${new Date().toISOString()}] Invalid taskCompleted data:`, data);
            return;
          }
          if (!['admin', 'production', 'chef'].includes(user.role)) return;
          if (user.role === 'chef' && data.chefId !== user._id) return;
          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'success',
            message: t('notifications.task_completed', {
              orderNumber: data.orderNumber,
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, taskId: data.taskId, eventId },
            read: false,
            createdAt: data.createdAt || new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [400, 100, 400],
          });
        },
        config: {
          type: 'TASK_COMPLETED',
          sound: '/sounds/notification.mp3',
          vibrate: [400, 100, 400],
          roles: ['admin', 'production', 'chef'],
        },
      },
      {
        name: 'orderCompleted',
        handler: (data) => {
          if (!data.orderId || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid orderCompleted data:`, data);
            return;
          }
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (user.role === 'branch' && data.branchId !== user.branchId) return;
          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'success',
            message: user.role === 'branch' && data.branchId === user.branchId
              ? t('notifications.order_completed_for_branch', { orderNumber: data.orderNumber })
              : t('notifications.order_completed', {
                  orderNumber: data.orderNumber,
                  branchName: data.branchName || t('branches.unknown'),
                }),
            data: { orderId: data.orderId, eventId },
            read: false,
            createdAt: data.createdAt || new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [400, 100, 400],
          });
        },
        config: {
          type: 'UPDATE_ORDER_STATUS',
          sound: '/sounds/notification.mp3',
          vibrate: [400, 100, 400],
          roles: ['admin', 'branch', 'production'],
        },
      },
      {
        name: 'orderInTransit',
        handler: (data) => {
          if (!data.orderId || !data.orderNumber || !data.branchName || !data.branchId) {
            console.warn(`[${new Date().toISOString()}] Invalid orderInTransit data:`, data);
            return;
          }
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (user.role === 'branch' && data.branchId !== user.branchId) return;
          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'success',
            message: user.role === 'branch' && data.branchId === user.branchId
              ? t('notifications.order_in_transit_for_branch', { orderNumber: data.orderNumber })
              : t('notifications.order_in_transit', {
                  orderNumber: data.orderNumber,
                  branchName: data.branchName || t('branches.unknown'),
                }),
            data: { orderId: data.orderId, eventId },
            read: false,
            createdAt: data.createdAt || new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [400, 100, 400],
          });
        },
        config: {
          type: 'UPDATE_ORDER_STATUS',
          sound: '/sounds/notification.mp3',
          vibrate: [400, 100, 400],
          roles: ['admin', 'branch', 'production'],
        },
      },
      {
        name: 'orderDelivered',
        handler: (data) => {
          if (!data.orderId || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid orderDelivered data:`, data);
            return;
          }
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (user.role === 'branch' && data.branchId !== user.branchId) return;
          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'success',
            message: user.role === 'branch' && data.branchId === user.branchId
              ? t('notifications.order_delivered_for_branch', { orderNumber: data.orderNumber })
              : t('notifications.order_delivered', {
                  orderNumber: data.orderNumber,
                  branchName: data.branchName || t('branches.unknown'),
                }),
            data: { orderId: data.orderId, eventId },
            read: false,
            createdAt: data.createdAt || new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [400, 100, 400],
          });
        },
        config: {
          type: 'UPDATE_ORDER_STATUS',
          sound: '/sounds/notification.mp3',
          vibrate: [400, 100, 400],
          roles: ['admin', 'branch', 'production'],
        },
      },
      {
        name: 'branchConfirmedReceipt',
        handler: (data) => {
          if (!data.orderId || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid branchConfirmedReceipt data:`, data);
            return;
          }
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (user.role === 'branch' && data.branchId !== user.branchId) return;
          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'success',
            message: t('notifications.branch_confirmed_receipt', {
              orderNumber: data.orderNumber,
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, eventId },
            read: false,
            createdAt: data.createdAt || new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [400, 100, 400],
          });
        },
        config: {
          type: 'UPDATE_ORDER_STATUS',
          sound: '/sounds/notification.mp3',
          vibrate: [400, 100, 400],
          roles: ['admin', 'branch', 'production'],
        },
      },
      {
        name: 'notificationRead',
        handler: async (data) => {
          if (!data.notificationId) {
            console.warn(`[${new Date().toISOString()}] Invalid notificationRead data:`, data);
            return;
          }
          try {
            await markAsRead(data.notificationId);
          } catch (err) {
            console.error(`[${new Date().toISOString()}] Failed to mark notification as read:`, err);
          }
        },
        config: {
          type: 'NOTIFICATION_READ',
          sound: '',
          vibrate: [],
          roles: ['admin', 'branch', 'production', 'chef'],
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