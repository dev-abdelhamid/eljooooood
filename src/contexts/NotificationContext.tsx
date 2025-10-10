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
    saleId?: string;
    itemId?: string;
  };
  read: boolean;
  createdAt: string;
  eventId?: string;
  sound?: string;
  vibrate?: number[];
}

interface SocketEventData {
  orderId?: string;
  orderNumber?: string;
  branchName?: string;
  branchId?: string;
  saleId?: string;
  saleNumber?: string;
  items?: Array<{
    _id?: string;
    productId?: string;
    productName?: string;
    productNameEn?: string;
    quantity?: number;
    unit?: string;
    unitEn?: string;
    status?: string;
    assignedTo?: { _id: string; username?: string; name?: string; nameEn?: string };
    department?: { _id: string; name: string; nameEn?: string };
  }>;
  eventId?: string;
  status?: string;
  chefId?: string;
  productName?: string;
  quantity?: number;
  unit?: string;
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
  refreshTasks: () => void;
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
              saleId: n.data?.saleId,
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
          style: { direction: isRtl ? 'rtl' : 'ltr', textAlign: isRtl ? 'right' : 'left' },
        });
      }
      if (notification.data?.taskId || notification.type === 'taskAssigned' || notification.type === 'itemStatusUpdated' || notification.type === 'saleCreated') {
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

  const refreshTasks = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const getCategoryForNotification = useCallback(
    (notif: Notification): string | null => {
      const { data, type } = notif;
      if (data?.orderId && !data.taskId) return 'orders';
      if (data?.taskId || ['taskAssigned', 'taskStarted', 'taskCompleted', 'itemStatusUpdated'].includes(type)) return 'production-tasks';
      if (data?.returnId || ['returnCreated', 'returnStatusUpdated'].includes(type)) return 'returns';
      if (data?.saleId || type === 'saleCreated') return 'sales';
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
        case 'sales':
          return role === 'branch' ? '/branch-sales' : '/sales';
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

    const events: { name: string; handler: (data: any) => void; config: SocketEventConfig }[] = [
      {
        name: 'saleCreated',
        handler: (newSale: any) => {
          if (!newSale?._id || !newSale.saleNumber || !newSale.branch?.name) {
            console.warn(`[${new Date().toISOString()}] Invalid sale data:`, newSale);
            return;
          }
          if (!['admin', 'branch'].includes(user.role)) return;
          if (user.role === 'branch' && newSale.branch?._id !== user.branchId) return;

          const eventId = newSale.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'success',
            message: t('notifications.sale_created', {
              saleNumber: newSale.saleNumber,
              branchName: newSale.branch?.name || t('branches.unknown'),
            }),
            data: { saleId: newSale._id, eventId },
            read: false,
            createdAt: new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [200, 100, 200],
          });
          setRefreshTrigger((prev) => prev + 1); // Trigger refresh for sales page
        },
        config: {
          type: 'ADD_SALE',
          sound: '/sounds/notification.mp3',
          vibrate: [200, 100, 200],
          roles: ['admin', 'branch'],
        },
      },
      {
        name: 'orderCreated',
        handler: (newOrder: any) => {
          if (!newOrder?._id || !Array.isArray(newOrder.items) || !newOrder.orderNumber || !newOrder.branch?.name) {
            console.warn(`[${new Date().toISOString()}] Invalid order data:`, newOrder);
            return;
          }
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (user.role === 'production' && user.department && !newOrder.items.some((item: any) => item?.product?.department?._id === user.department._id)) return;
          if (user.role === 'branch' && newOrder.branch?._id !== user.branchId) return;

          const eventId = newOrder.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'success',
            message: t('notifications.order_created', {
              orderNumber: newOrder.orderNumber,
              branchName: newOrder.branch?.name || t('branches.unknown'),
            }),
            data: { orderId: newOrder._id, eventId },
            read: false,
            createdAt: new Date().toISOString(),
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
        name: 'orderConfirmed',
        handler: (data: SocketEventData) => {
          if (!['admin', 'branch'].includes(user.role)) return;
          if (!data.orderId || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid order confirmed data:`, data);
            return;
          }
          if (user.role === 'branch' && data.branchId !== user.branchId) return;

          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'success',
            message: t('notifications.order_confirmed', {
              orderNumber: data.orderNumber,
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, eventId },
            read: false,
            createdAt: new Date().toISOString(),
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
        handler: (data: SocketEventData) => {
          console.log(`[${new Date().toISOString()}] taskAssigned - Received data:`, JSON.stringify(data, null, 2));
          if (!data.orderId || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid task assigned data:`, data);
            return;
          }
          if (!['admin', 'production', 'chef'].includes(user.role)) return;
          if (user.role === 'chef' && data.chefId !== user._id) return;

          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);

          const item = Array.isArray(data.items) ? data.items[0] : data;
          if (!item?._id || !item.productName || !item.quantity) {
            console.warn(`[${new Date().toISOString()}] Invalid item data for notification:`, item);
            return;
          }

          addNotification({
            _id: eventId,
            type: 'info',
            message: t('notifications.task_assigned', {
              productName: item.productName,
              orderNumber: data.orderNumber,
              quantity: item.quantity,
              unit: translateUnit(item.unit),
            }),
            data: { orderId: data.orderId, taskId: data.taskId, chefId: data.chefId, eventId },
            read: false,
            createdAt: new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [200, 100, 200],
          });
        },
        config: {
          type: 'TASK_ASSIGNED',
          sound: '/sounds/notification.mp3',
          vibrate: [200, 100, 200],
          roles: ['admin', 'production', 'chef'],
        },
      },
      {
        name: 'taskStarted',
        handler: (data: SocketEventData) => {
          if (!['admin', 'production', 'chef'].includes(user.role)) return;
          if (user.role === 'chef' && data.chefId !== user._id) return;
          if (!data.orderId || !data.orderNumber || !data.productName) {
            console.warn(`[${new Date().toISOString()}] Invalid task started data:`, data);
            return;
          }

          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'info',
            message: t('notifications.task_started', {
              productName: data.productName,
              orderNumber: data.orderNumber,
            }),
            data: { orderId: data.orderId, taskId: data.taskId, chefId: data.chefId, eventId },
            read: false,
            createdAt: new Date().toISOString(),
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
        handler: (data: SocketEventData) => {
          if (!['admin', 'production', 'chef'].includes(user.role)) return;
          if (user.role === 'chef' && data.chefId !== user._id) return;
          if (!data.orderId || !data.orderNumber || !data.productName) {
            console.warn(`[${new Date().toISOString()}] Invalid task completed data:`, data);
            return;
          }

          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'success',
            message: t('notifications.task_completed', {
              productName: data.productName,
              orderNumber: data.orderNumber,
            }),
            data: { orderId: data.orderId, taskId: data.taskId, chefId: data.chefId, eventId },
            read: false,
            createdAt: new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [200, 100, 200],
          });
        },
        config: {
          type: 'TASK_COMPLETED',
          sound: '/sounds/notification.mp3',
          vibrate: [200, 100, 200],
          roles: ['admin', 'production', 'chef'],
        },
      },
      {
        name: 'orderApproved',
        handler: (data: SocketEventData) => {
          if (!['admin', 'production', 'branch'].includes(user.role)) return;
          if (user.role === 'branch' && data.branchId !== user.branchId) return;
          if (!data.orderId || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid order approved data:`, data);
            return;
          }

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
            createdAt: new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [200, 100, 200],
          });
        },
        config: {
          type: 'UPDATE_ORDER_STATUS',
          sound: '/sounds/notification.mp3',
          vibrate: [200, 100, 200],
          roles: ['admin', 'production', 'branch'],
        },
      },
      {
        name: 'orderInTransit',
        handler: (data: SocketEventData) => {
          if (!['admin', 'production', 'branch'].includes(user.role)) return;
          if (user.role === 'branch' && data.branchId !== user.branchId) return;
          if (!data.orderId || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid order in transit data:`, data);
            return;
          }

          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'info',
            message: t('notifications.order_in_transit', {
              orderNumber: data.orderNumber,
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, eventId },
            read: false,
            createdAt: new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [200, 100, 200],
          });
        },
        config: {
          type: 'UPDATE_ORDER_STATUS',
          sound: '/sounds/notification.mp3',
          vibrate: [200, 100, 200],
          roles: ['admin', 'production', 'branch'],
        },
      },
      {
        name: 'orderDelivered',
        handler: (data: SocketEventData) => {
          if (!['admin', 'production', 'branch'].includes(user.role)) return;
          if (user.role === 'branch' && data.branchId !== user.branchId) return;
          if (!data.orderId || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid order delivered data:`, data);
            return;
          }

          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'success',
            message: t('notifications.order_delivered', {
              orderNumber: data.orderNumber,
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, eventId },
            read: false,
            createdAt: new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [200, 100, 200],
          });
        },
        config: {
          type: 'UPDATE_ORDER_STATUS',
          sound: '/sounds/notification.mp3',
          vibrate: [200, 100, 200],
          roles: ['admin', 'production', 'branch'],
        },
      },
      {
        name: 'branchConfirmedReceipt',
        handler: (data: SocketEventData) => {
          if (!['admin', 'production', 'branch'].includes(user.role)) return;
          if (user.role === 'branch' && data.branchId !== user.branchId) return;
          if (!data.orderId || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid branch confirmed receipt data:`, data);
            return;
          }

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
            createdAt: new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [200, 100, 200],
          });
        },
        config: {
          type: 'UPDATE_ORDER_STATUS',
          sound: '/sounds/notification.mp3',
          vibrate: [200, 100, 200],
          roles: ['admin', 'production', 'branch'],
        },
      },
      {
        name: 'returnCreated',
        handler: (data: SocketEventData) => {
          if (!['admin', 'production', 'branch'].includes(user.role)) return;
          if (user.role === 'branch' && data.branchId !== user.branchId) return;
          if (!data.returnId || !data.returnNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid return created data:`, data);
            return;
          }

          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'warning',
            message: t('notifications.return_created', {
              returnNumber: data.returnNumber,
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { returnId: data.returnId, eventId },
            read: false,
            createdAt: new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [200, 100, 200],
          });
        },
        config: {
          type: 'ADD_RETURN',
          sound: '/sounds/notification.mp3',
          vibrate: [200, 100, 200],
          roles: ['admin', 'production', 'branch'],
        },
      },
      {
        name: 'returnStatusUpdated',
        handler: (data: SocketEventData) => {
          if (!['admin', 'production', 'branch'].includes(user.role)) return;
          if (user.role === 'branch' && data.branchId !== user.branchId) return;
          if (!data.returnId || !data.returnNumber || !data.status) {
            console.warn(`[${new Date().toISOString()}] Invalid return status updated data:`, data);
            return;
          }

          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: data.status === 'approved' ? 'success' : 'error',
            message: t(`notifications.return_${data.status}`, {
              returnNumber: data.returnNumber,
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { returnId: data.returnId, eventId },
            read: false,
            createdAt: new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [200, 100, 200],
          });
        },
        config: {
          type: 'UPDATE_RETURN_STATUS',
          sound: '/sounds/notification.mp3',
          vibrate: [200, 100, 200],
          roles: ['admin', 'production', 'branch'],
        },
      },
      {
        name: 'newNotification',
        handler: (data: Notification) => {
          console.log(`[${new Date().toISOString()}] Received newNotification:`, data);
          if (!data._id || !data.message || !data.type) {
            console.warn(`[${new Date().toISOString()}] Invalid notification data:`, data);
            return;
          }
          if (notificationIds.current.has(data.eventId)) {
            console.log(`[${new Date().toISOString()}] Duplicate notification ignored:`, data.eventId);
            return;
          }
          if (data.data?.chefId && user.role === 'chef' && data.data.chefId !== user._id) return;
          if (data.data?.branchId && user.role === 'branch' && data.data.branchId !== user.branchId) return;
          if (data.data?.orderId && user.role === 'production' && user.department) {
            ordersAPI.getOrder(data.data.orderId).then((order) => {
              if (!order.items.some((item: any) => item.product?.department?._id === user.department?._id)) return;
              addNotification({ ...data, eventId: data.eventId || crypto.randomUUID() });
            });
          } else {
            addNotification({ ...data, eventId: data.eventId || crypto.randomUUID() });
          }
        },
        config: {
          type: 'NEW_NOTIFICATION',
          sound: '/sounds/notification.mp3',
          vibrate: [200, 100, 200],
          roles: ['admin', 'branch', 'production', 'chef'],
        },
      },
    ];

    events.forEach(({ name, handler, config }) => {
      socket.on(name, (data: any) => {
        console.log(`[${new Date().toISOString()}] Socket event ${name} received:`, data);
        if (!config.roles.includes(user.role)) {
          console.log(`[${new Date().toISOString()}] Event ${name} ignored for role ${user.role}`);
          return;
        }
        handler(data);
      });
    });

    socket.on('connect', () => {
      console.log(`[${new Date().toISOString()}] Socket connected, rejoining rooms`);
      socket.emit('joinRoom', {
        role: user.role,
        branchId: user.branchId,
        chefId: user.role === 'chef' ? user._id : undefined,
        departmentId: user.role === 'production' ? user.department?._id : undefined,
        userId: user._id,
      });
      fetchNotifications();
    });

    socket.on('connect_error', (err) => {
      console.error(`[${new Date().toISOString()}] Socket connect error:`, err);
      toast.error(t('errors.socket_connection'), { position: isRtl ? 'top-left' : 'top-right', toastId: `socket-error-${Date.now()}` });
    });

    return () => {
      events.forEach(({ name }) => socket.off(name));
      socket.off('connect');
      socket.off('connect_error');
    };
  }, [socket, user, t, isRtl, addNotification, fetchNotifications]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      unreadByPath,
      addNotification,
      markAsRead,
      markAllAsRead,
      clearNotifications,
      refreshTasks,
    }),
    [notifications, unreadCount, unreadByPath, addNotification, markAsRead, markAllAsRead, clearNotifications, refreshTasks]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('يجب استخدام useNotifications داخل NotificationProvider');
  return context;
};
