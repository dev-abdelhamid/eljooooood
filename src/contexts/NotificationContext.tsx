
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { useSocket } from './SocketContext';
import { toast } from 'react-toastify';
import { notificationService } from './NotificationService';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  _id: string;
  type: NotificationType;
  message: string;
  data?: { orderId?: string; branchId?: string; chefId?: string; taskId?: string; returnId?: string; eventId?: string };
  read: boolean;
  createdAt: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
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
  const notificationIds = React.useRef(new Set<string>());

  const translateUnit = (unit: string | undefined) => {
    const translations: Record<string, { ar: string; en: string }> = {
      'كيلو': { ar: 'كيلو', en: 'kg' },
      'قطعة': { ar: 'قطعة', en: 'piece' },
      'علبة': { ar: 'علبة', en: 'pack' },
      'صينية': { ar: 'صينية', en: 'tray' },
    };
    return unit && translations[unit] ? (isRtl ? translations[unit].ar : translations[unit].en) : isRtl ? 'وحدة' : 'unit';
  };

  const addNotification = useCallback(
    (notification: Notification) => {
      if (!notification.eventId || notificationIds.current.has(notification.eventId)) {
        return;
      }
      notificationIds.current.add(notification.eventId);
      setNotifications((prev) => [notification, ...prev].slice(0, 50));
      if (!notification.read) {
        toast[notification.type](notification.message, {
          toastId: notification.eventId,
          position: isRtl ? 'top-left' : 'top-right',
          autoClose: 3000,
        });
      }
    },
    [isRtl]
  );

  const markAsRead = useCallback(
    async (id: string) => {
      try {
        await notificationService.markAsRead(id);
        setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
        socket?.emit('notificationRead', { notificationId: id, userId: user?.id });
      } catch {
        toast.error(t('errors.mark_notification_read'), { position: isRtl ? 'top-left' : 'top-right' });
      }
    },
    [socket, user, t, isRtl]
  );

  const markAllAsRead = useCallback(
    async () => {
      if (!user) return;
      try {
        await notificationService.markAllAsRead(user.id);
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        socket?.emit('allNotificationsRead', { userId: user.id });
      } catch {
        toast.error(t('errors.mark_all_notifications_read'), { position: isRtl ? 'top-left' : 'top-right' });
      }
    },
    [socket, user, t, isRtl]
  );

  const clearNotifications = useCallback(
    async () => {
      try {
        await notificationService.clearNotifications();
        setNotifications([]);
        notificationIds.current.clear();
        socket?.emit('notificationsCleared', { userId: user?.id });
      } catch {
        toast.error(t('errors.clear_notifications'), { position: isRtl ? 'top-left' : 'top-right' });
      }
    },
    [socket, user, t, isRtl]
  );

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const params: any = { userId: user.id, limit: 50 };
      if (user.role === 'production') params.departmentId = user.department?._id;
      if (user.role === 'branch') params.branchId = user.branchId;
      if (user.role === 'chef') params.chefId = user.id;
      const data = await notificationService.fetchNotifications(params);
      setNotifications(data);
    } catch {
      toast.error(t('errors.fetch_notifications'), { position: isRtl ? 'top-left' : 'top-right' });
    }
  }, [user, t, isRtl]);

  useEffect(() => {
    if (user) fetchNotifications();
  }, [user, fetchNotifications]);

  useEffect(() => {
    if (!socket || !user) return;

    socket.emit('joinRoom', {
      role: user.role,
      branchId: user.branchId,
      chefId: user.role === 'chef' ? user.id : undefined,
      departmentId: user.role === 'production' ? user.department?._id : undefined,
      userId: user.id,
    });

    const events = [
      {
        name: 'orderCreated',
        handler: (data: any) => {
          if (!data._id || !data.orderNumber || !data.branch?.name || !Array.isArray(data.items)) return;
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (user.role === 'branch' && data.branch?._id !== user.branchId) return;
          if (user.role === 'production' && !data.items.some((item: any) => item.product?.department?._id === user.department?._id)) return;

          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'success',
            message: t('notifications.order_created', { orderNumber: data.orderNumber, branchName: data.branch.name }),
            data: { orderId: data._id, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
          });
        },
      },
      {
        name: 'orderConfirmed',
        handler: (data: any) => {
          if (!data.orderId || !data.orderNumber || !data.branchName) return;
          if (!['admin', 'branch'].includes(user.role)) return;
          if (user.role === 'branch' && data.branchId !== user.branchId) return;

          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'success',
            message: t('notifications.order_confirmed', { orderNumber: data.orderNumber, branchName: data.branchName }),
            data: { orderId: data.orderId, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
          });
        },
      },
      {
        name: 'taskAssigned',
        handler: (data: any) => {
          if (!data.orderId || !data.orderNumber || !Array.isArray(data.items) || !data.branchName) return;
          if (!['admin', 'production', 'chef'].includes(user.role)) return;
          if (user.role === 'chef' && !data.items.some((item: any) => item.assignedTo?._id === user.id)) return;

          data.items.forEach((item: any) => {
            if (!item._id || !item.product?.name || !item.quantity) return;
            const itemEventId = `${data.eventId || crypto.randomUUID()}-${item._id}`;
            addNotification({
              _id: itemEventId,
              type: 'info',
              message: t('notifications.task_assigned_to_chef', {
                chefName: item.assignedTo?.name || t('chefs.unknown'),
                productName: item.product.name,
                quantity: item.quantity,
                unit: translateUnit(item.unit),
                orderNumber: data.orderNumber,
                branchName: data.branchName,
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
          if (!data.orderId || !data.itemId || !data.status || !data.orderNumber || !data.branchName) return;
          if (!['admin', 'production', 'chef'].includes(user.role)) return;
          if (user.role === 'chef' && data.chefId !== user.id) return;

          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'info',
            message: t('notifications.item_status_updated', {
              orderNumber: data.orderNumber,
              status: t(`item_status.${data.status}`),
              branchName: data.branchName,
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
          if (!data.orderId || !data.status || !data.orderNumber || !data.branchName) return;
          if (!['admin', 'branch', 'production'].includes(user.role)) return;

          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'info',
            message: t('notifications.order_status_updated', {
              orderNumber: data.orderNumber,
              status: t(`order_status.${data.status}`),
              branchName: data.branchName,
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
          if (!data.orderId || !data.orderNumber || !data.branchName) return;
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (user.role === 'branch' && data.branchId !== user.branchId) return;

          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'success',
            message: t('notifications.order_completed', { orderNumber: data.orderNumber, branchName: data.branchName }),
            data: { orderId: data.orderId, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
          });
        },
      },
      {
        name: 'orderShipped',
        handler: (data: any) => {
          if (!data.orderId || !data.orderNumber || !data.branchName || !data.branchId) return;
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (user.role === 'branch' && data.branchId !== user.branchId) return;

          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'success',
            message: t('notifications.order_shipped', { orderNumber: data.orderNumber, branchName: data.branchName }),
            data: { orderId: data.orderId, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
          });
        },
      },
      {
        name: 'orderDelivered',
        handler: (data: any) => {
          if (!data.orderId || !data.orderNumber || !data.branchName) return;
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (user.role === 'branch' && data.branchId !== user.branchId) return;

          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'success',
            message: t('notifications.order_delivered', { orderNumber: data.orderNumber, branchName: data.branchName }),
            data: { orderId: data.orderId, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
          });
        },
      },
      {
        name: 'returnStatusUpdated',
        handler: (data: any) => {
          if (!data.orderId || !data.returnId || !data.status || !data.orderNumber) return;
          if (!['admin', 'branch', 'production'].includes(user.role)) return;

          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'info',
            message: t('notifications.return_status_updated', {
              orderNumber: data.orderNumber,
              status: t(`returns.${data.status}`),
              branchName: data.branchName,
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
          if (!data.orderId || !data.itemId || !data.orderNumber || !data.productName) return;
          if (!['admin', 'production'].includes(user.role)) return;

          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'warning',
            message: t('notifications.missing_assignments', {
              orderNumber: data.orderNumber,
              productName: data.productName,
              branchName: data.branchName,
            }),
            data: { orderId: data.orderId, itemId: data.itemId, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
          });
        },
      },
    ];

    events.forEach(({ name, handler }) => socket.on(name, handler));
    return () => events.forEach(({ name, handler }) => socket.off(name, handler));
  }, [socket, user, addNotification, t, isRtl]);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount: notifications.filter((n) => !n.read).length, addNotification, markAsRead, markAllAsRead, clearNotifications }}
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
