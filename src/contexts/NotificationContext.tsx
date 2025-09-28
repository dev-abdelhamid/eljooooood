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
  orderId: string;
  orderNumber: string;
  branchName?: string;
  branchId?: string;
  items?: Array<{
    itemId: string;
    productId?: string;
    productName?: string;
    quantity?: number;
    unit?: string;
    status?: string;
    assignedTo?: { _id: string; username?: string; name?: string };
    department?: { _id: string; name: string };
  }>;
  eventId?: string;
  status?: string;
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

  // دالة ترجمة الوحدات
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

    socket.emit('joinRoom', {
      role: user.role,
      branchId: user.branchId,
      chefId: user.role === 'chef' ? user._id : undefined,
      departmentId: user.role === 'production' ? user.department?._id : undefined,
      userId: user._id,
    });

    const events: { name: string; handler: (data: any) => void; config: SocketEventConfig }[] = [
      {
        name: 'newNotification',
        handler: (data: any) => {
          if (!data?._id || !data.type || !data.message || !data.data?.eventId) {
            console.warn(`[${new Date().toISOString()}] Invalid newNotification data:`, data);
            return;
          }
          const eventId = data.data.eventId;
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: data._id,
            type: data.type,
            message: data.message,
            data: data.data,
            read: data.read || false,
            createdAt: data.createdAt || new Date().toISOString(),
            sound: data.sound || '/sounds/notification.mp3',
            vibrate: data.vibrate || [200, 100, 200],
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
  handler: (notification: any) => {
    console.log(`[${new Date().toISOString()}] taskAssigned - Received data:`, JSON.stringify(notification, null, 2));
    const data: SocketEventData = notification.data || notification;
    if (!data.orderId || !data.orderNumber || !Array.isArray(data.items) || !data.branchName) {
      console.warn(`[${new Date().toISOString()}] Invalid task assigned data:`, data);
      return;
    }
    if (!['admin', 'production', 'chef'].includes(user.role)) return;
    if (user.role === 'chef' && !data.items.some((item: any) => item.assignedTo?._id === user._id)) return;
    const eventId = data.eventId || crypto.randomUUID();
    if (notificationIds.current.has(eventId)) return;
    notificationIds.current.add(eventId);
    data.items.forEach((item: any) => {
      // تعديل: استخدام item._id بدلاً من item.itemId، وitem.product.name بدلاً من item.productName، وجعل username اختياريًا
      if (!item._id || !item.product?.name || !item.quantity || !(item.assignedTo?.name || item.assignedTo?.username)) {
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
          chefName: item.assignedTo.name || item.assignedTo.username || t('chefs.unknown'),
          productName: item.product?.name || t('products.unknown'),
          quantity: item.quantity || 'غير معروف',
          unit: translateUnit(item.unit || item.product?.unit),
          orderNumber: data.orderNumber,
          branchName: data.branchName || t('branches.unknown'),
        }),
        data: { orderId: data.orderId, itemId: item._id, eventId: itemEventId },
        read: false,
        createdAt: new Date().toISOString(),
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
        name: 'itemStatusUpdated',
        handler: async (data: SocketEventData) => {
          if (!['admin', 'production', 'chef'].includes(user.role)) return;
          if (!data.orderId || !data.itemId || !data.status || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid item status update data:`, data);
            return;
          }
          if (user.role === 'chef' && data.chefId !== user._id) return;

          try {
            const updatedOrder = await ordersAPI.getById(data.orderId);
            if (!updatedOrder || !updatedOrder._id || !Array.isArray(updatedOrder.items)) {
              console.warn(`[${new Date().toISOString()}] Failed to fetch updated order:`, data.orderId);
              return;
            }
            const allItemsCompleted = updatedOrder.items.every((item: any) => item.status === 'completed');
            if (allItemsCompleted && updatedOrder.status !== 'completed') {
              const completedEventId = crypto.randomUUID();
              if (notificationIds.current.has(completedEventId)) return;
              notificationIds.current.add(completedEventId);
              addNotification({
                _id: completedEventId,
                type: 'success',
                message: user.role === 'branch' && updatedOrder.branch?._id === user.branchId
                  ? t('notifications.order_completed_for_branch', { orderNumber: data.orderNumber })
                  : t('notifications.order_completed', {
                      orderNumber: data.orderNumber,
                      branchName: data.branchName || t('branches.unknown'),
                    }),
                data: { orderId: data.orderId, eventId: completedEventId },
                read: false,
                createdAt: new Date().toISOString(),
                sound: '/sounds/notification.mp3',
                vibrate: [400, 100, 400],
              });
            }
          } catch (err) {
            console.error(`[${new Date().toISOString()}] Failed to fetch updated order:`, err);
          }
        },
        config: {
          type: 'UPDATE_ITEM_STATUS',
          sound: '/sounds/notification.mp3',
          vibrate: [200, 100, 200],
          roles: ['admin', 'production', 'chef'],
        },
      },
      {
        name: 'orderStatusUpdated',
        handler: (data: SocketEventData) => {
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.status || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid order status update data:`, data);
            return;
          }
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
          roles: ['admin', 'branch', 'production'],
        },
      },
      {
        name: 'orderCompleted',
        handler: (data: SocketEventData) => {
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid order completed data:`, data);
            return;
          }
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
            createdAt: new Date().toISOString(),
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
        name: 'orderShipped',
        handler: (data: SocketEventData) => {
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.orderNumber || !data.branchName || !data.branchId) {
            console.warn(`[${new Date().toISOString()}] Invalid order shipped data:`, data);
            return;
          }
          if (user.role === 'branch' && data.branchId !== user.branchId) return;
          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'success',
            message: user.role === 'branch' && data.branchId === user.branchId
              ? t('notifications.order_shipped_for_branch', { orderNumber: data.orderNumber })
              : t('notifications.order_shipped', {
                  orderNumber: data.orderNumber,
                  branchName: data.branchName || t('branches.unknown'),
                }),
            data: { orderId: data.orderId, eventId },
            read: false,
            createdAt: new Date().toISOString(),
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
        handler: (data: SocketEventData) => {
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid order delivered data:`, data);
            return;
          }
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
            createdAt: new Date().toISOString(),
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
        name: 'returnStatusUpdated',
        handler: (data: SocketEventData) => {
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.returnId || !data.status || !data.orderNumber) {
            console.warn(`[${new Date().toISOString()}] Invalid return status update data:`, data);
            return;
          }
          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'info',
            message: t('notifications.return_status_updated', {
              orderNumber: data.orderNumber,
              status: t(`returns.${data.status}`),
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, returnId: data.returnId, eventId },
            read: false,
            createdAt: new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [200, 100, 200],
          });
        },
        config: {
          type: 'RETURN_STATUS_UPDATED',
          sound: '/sounds/notification.mp3',
          vibrate: [200, 100, 200],
          roles: ['admin', 'branch', 'production'],
        },
      },
      {
        name: 'missingAssignments',
        handler: (data: SocketEventData) => {
          if (!['admin', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.itemId || !data.orderNumber || !data.productName) {
            console.warn(`[${new Date().toISOString()}] Invalid missing assignments data:`, data);
            return;
          }
          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);
          addNotification({
            _id: eventId,
            type: 'warning',
            message: t('notifications.missing_assignments', {
              orderNumber: data.orderNumber,
              productName: data.productName || t('products.unknown'),
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, itemId: data.itemId, eventId },
            read: false,
            createdAt: new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [300, 100, 300],
          });
        },
        config: {
          type: 'MISSING_ASSIGNMENTS',
          sound: '/sounds/notification.mp3',
          vibrate: [300, 100, 300],
          roles: ['admin', 'production'],
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