// useTaskNotifications.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotifications } from '../contexts/NotificationContext';
import { tasksAPI } from '../services/api';
import { Task } from '../types/types';

interface SocketEventConfig {
  type: string;
  sound: string;
  vibrate: number[];
  roles: string[];
}

export const useTaskNotifications = (
  dispatch: React.Dispatch<any>,
  stateRef: React.MutableRefObject<any>,
  user: any
) => {
  const { socket } = useSocket();
  const { t } = useLanguage();
  const { addNotification, markAsRead } = useNotifications();
  const [hasInteracted, setHasInteracted] = useState(false);
  const notificationIds = useRef(new Set<string>());

  const playNotificationSound = useCallback((soundUrl = '/sounds/notification.mp3', vibrate?: number[]) => {
    if (!hasInteracted) return;
    const audio = new Audio(soundUrl);
    audio.play().catch((err) => console.error(`[${new Date().toISOString()}] Audio play failed:`, err));
    if (navigator.vibrate && vibrate) navigator.vibrate(vibrate);
  }, [hasInteracted]);

  useEffect(() => {
    const handleUserInteraction = () => {
      setHasInteracted(true);
      const audio = new Audio('/sounds/notification.mp3');
      audio.play()
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

  useEffect(() => {
    if (!socket || !user) {
      console.warn(`[${new Date().toISOString()}] Socket or user not available`);
      return;
    }

    socket.emit('joinRoom', {
      role: user.role,
      chefId: user.role === 'chef' ? user._id : undefined,
      userId: user._id,
    });

    const events: { name: string; handler: (data: any) => void; config: SocketEventConfig }[] = [
      {
        name: 'taskAssigned',
        handler: async (data: any) => {
          if (!['admin', 'chef'].includes(user.role)) return;
          if (!data.taskId || !data.orderId || !data.orderNumber || !data.productName || !data.quantity) {
            console.warn(`[${new Date().toISOString()}] Invalid task assigned data:`, data);
            return;
          }
          if (user.role === 'chef' && data.chefId !== user._id) return;

          try {
            const task = await tasksAPI.getById(data.taskId);
            if (!task || !task._id) {
              console.warn(`[${new Date().toISOString()}] Failed to fetch task:`, data.taskId);
              return;
            }

            const mappedTask: Task = {
              id: task._id,
              orderId: task.orderId,
              orderNumber: task.order?.orderNumber || t('orders.unknown'),
              productName: task.product?.name || t('products.unknown'),
              quantity: Number(task.quantity) || 1,
              status: task.status || 'pending',
              updatedAt: task.updatedAt || new Date().toISOString(),
              startedAt: task.startedAt,
              completedAt: task.completedAt,
            };

            dispatch({ type: 'ADD_TASK', payload: mappedTask });

            const eventId = data.eventId || crypto.randomUUID();
            if (notificationIds.current.has(eventId)) return;
            notificationIds.current.add(eventId);

            addNotification({
              _id: eventId,
              type: 'info',
              message: t('notifications.task_assigned_to_chef', {
                chefName: user.name || t('chefs.unknown'),
                productName: data.productName,
                quantity: data.quantity,
                orderNumber: data.orderNumber,
              }),
              data: { orderId: data.orderId, taskId: data.taskId, eventId },
              read: false,
              createdAt: new Date().toISOString(),
              sound: '/sounds/task-assigned.mp3',
              vibrate: [400, 100, 400],
            });
            playNotificationSound('/sounds/task-assigned.mp3', [400, 100, 400]);
          } catch (err) {
            console.error(`[${new Date().toISOString()}] Failed to fetch task:`, err);
          }
        },
        config: {
          type: 'ADD_TASK',
          sound: '/sounds/task-assigned.mp3',
          vibrate: [400, 100, 400],
          roles: ['admin', 'chef'],
        },
      },
      {
        name: 'taskStatusUpdated',
        handler: async (data: any) => {
          if (!['admin', 'chef'].includes(user.role)) return;
          if (!data.taskId || !data.orderId || !data.status || !data.orderNumber) {
            console.warn(`[${new Date().toISOString()}] Invalid task status update data:`, data);
            return;
          }
          if (user.role === 'chef' && data.chefId !== user._id) return;

          dispatch({
            type: 'UPDATE_TASK_STATUS',
            payload: { orderId: data.orderId, taskId: data.taskId, status: data.status },
          });

          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.current.has(eventId)) return;
          notificationIds.current.add(eventId);

          addNotification({
            _id: eventId,
            type: 'success',
            message: t('notifications.task_status_updated', {
              orderNumber: data.orderNumber,
              status: t(`task_status.${data.status}`),
            }),
            data: { orderId: data.orderId, taskId: data.taskId, eventId },
            read: false,
            createdAt: new Date().toISOString(),
            sound: '/sounds/task-updated.mp3',
            vibrate: [200, 100, 200],
          });
          playNotificationSound('/sounds/task-updated.mp3', [200, 100, 200]);
        },
        config: {
          type: 'UPDATE_TASK_STATUS',
          sound: '/sounds/task-updated.mp3',
          vibrate: [200, 100, 200],
          roles: ['admin', 'chef'],
        },
      },
      {
        name: 'connect',
        handler: () => {
          dispatch({ type: 'SET_SOCKET_CONNECTED', payload: true });
          console.log(`[${new Date().toISOString()}] Socket connected`);
        },
        config: {
          type: 'SET_SOCKET_CONNECTED',
          sound: '',
          vibrate: [],
          roles: ['admin', 'chef'],
        },
      },
      {
        name: 'disconnect',
        handler: () => {
          dispatch({ type: 'SET_SOCKET_CONNECTED', payload: false });
          console.warn(`[${new Date().toISOString()}] Socket disconnected`);
        },
        config: {
          type: 'SET_SOCKET_DISCONNECTED',
          sound: '',
          vibrate: [],
          roles: ['admin', 'chef'],
        },
      },
    ];

    events.forEach(({ name, handler }) => socket.on(name, handler));
    return () => {
      events.forEach(({ name, handler }) => socket.off(name, handler));
      notificationIds.current.clear();
    };
  }, [socket, user, dispatch, playNotificationSound, addNotification, markAsRead, t]);

  return { playNotificationSound };
};