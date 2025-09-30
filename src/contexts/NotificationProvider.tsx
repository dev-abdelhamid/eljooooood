import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import io from 'socket.io-client';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useLanguage } from './LanguageContext';
import { Notification, NotificationType } from '../types/types';

interface NotificationContextType {
  socket: any;
  notifications: Notification[];
  addNotification: (notification: Notification) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearNotifications: () => void;
  isConnected: boolean;
  setFilters: (filters: { filterStatus?: string; filterBranch?: string }) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useLanguage();
  const isRtl = t('language') === 'ar';
  const [socket, setSocket] = useState<any>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [filters, setFilters] = useState<{ filterStatus?: string; filterBranch?: string }>({});

  const addNotification = useCallback((notification: Notification) => {
    setNotifications(prev => [notification, ...prev]);

    const toastOptions = {
      toastId: notification._id,
      position: isRtl ? 'top-left' : 'top-right',
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      theme: 'colored',
    };

    switch (notification.displayType) {
      case 'success':
        toast.success(notification.displayMessage, toastOptions);
        break;
      case 'info':
        toast.info(notification.displayMessage, toastOptions);
        break;
      case 'warning':
        toast.warn(notification.displayMessage, toastOptions);
        break;
      case 'error':
        toast.error(notification.displayMessage, toastOptions);
        break;
    }

    if (notification.sound) {
      const audio = new Audio(notification.sound);
      audio.play().catch(err => console.error('Audio playback failed:', err));
    }

    if (notification.vibrate && 'vibrate' in navigator) {
      navigator.vibrate(notification.vibrate);
    }
  }, [isRtl]);

  const markNotificationAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n._id === id ? { ...n, read: true } : n))
    );
    if (socket) {
      socket.emit('notificationRead', { notificationId: id });
    }
  }, [socket]);

  const markAllNotificationsAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    if (socket) {
      socket.emit('allNotificationsRead');
    }
  }, [socket]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    if (socket) {
      socket.emit('notificationsCleared');
    }
  }, [socket]);

  useEffect(() => {
    const socketInstance = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setIsConnected(true);
      console.log(`[${new Date().toISOString()}] Socket connected`);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
      console.warn(`[${new Date().toISOString()}] Socket disconnected`);
    });

    socketInstance.on('connect_error', (error: Error) => {
      console.error(`[${new Date().toISOString()}] Socket connection error:`, error);
    });

    return () => {
      socketInstance.disconnect();
      setIsConnected(false);
    };
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        socket,
        notifications,
        addNotification,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        clearNotifications,
        isConnected,
        setFilters,
      }}
    >
      {children}
      <ToastContainer
        position={isRtl ? 'top-left' : 'top-right'}
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={isRtl}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
    </NotificationContext.Provider>
  );
};