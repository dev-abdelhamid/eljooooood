import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotifications } from '../contexts/NotificationContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCircle, AlertCircle, Info, XCircle } from 'lucide-react';
import { formatDate } from '../utils/formatDate';

interface Notification {
  _id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  data?: { orderId?: string; taskId?: string; branchId?: string; chefId?: string };
  read: boolean;
  createdAt: string;
}

const NotificationItem: React.FC<{
  notification: Notification;
  isRtl: boolean;
  onMarkAsRead: (id: string) => void;
}> = ({ notification, isRtl, onMarkAsRead }) => {
  const navigate = useNavigate();
  const handleClick = () => {
    if (!notification.read) {
      onMarkAsRead(notification._id);
      console.log(`[${new Date().toISOString()}] Notification clicked and marked as read: ${notification._id}`);
    }
    if (notification.data?.orderId) navigate(`/orders/${notification.data.orderId}`);
    else if (notification.data?.taskId) navigate(`/production-tasks/${notification.data.taskId}`);
  };

  const typeStyles = {
    success: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    error: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
    info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50' },
    warning: { icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  };

  const notificationType = notification.type in typeStyles ? notification.type : 'info';
  const { icon: Icon, color, bg } = typeStyles[notificationType];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onClick={handleClick}
      className={`flex items-start p-2 border-b border-amber-100 hover:${bg} transition-colors cursor-pointer ${
        isRtl ? 'text-right flex-row-reverse' : 'text-left'
      } ${notification.read ? 'opacity-70' : ''} rounded-md mx-1 my-0.5 shadow-sm hover:shadow-md`}
    >
      <Icon className={`w-4 h-4 ${color} flex-shrink-0 ${isRtl ? 'ml-2' : 'mr-2'} mt-0.5`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-amber-900 truncate">{notification.message}</p>
        <p className="text-[10px] text-amber-600 mt-0.5">{formatDate(notification.createdAt)}</p>
      </div>
      {!notification.read && (
        <span className={`w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 ${isRtl ? 'mr-2' : 'ml-2'} flex-shrink-0`} />
      )}
    </motion.div>
  );
};

const Notifications: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log(`[${new Date().toISOString()}] Notifications - Rendering with notifications:`, notifications);
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notifications]);

  return (
    <div className={`relative ${isRtl ? 'ml-2 sm:ml-3' : 'mr-2 sm:mr-3'}`} ref={notificationsRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-1.5 bg-amber-100 hover:bg-amber-200 rounded-full shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-amber-300"
        aria-label={t('notifications.title')}
      >
        <Bell size={18} className="text-amber-700" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`absolute ${
              isRtl ? '-right-32 origin-top-right' : '-left-32 origin-top-left'
            } top-10 w-full max-w-[24rem] sm:max-w-[28rem] min-w-[16rem] max-h-[calc(100vh-2.5rem)] bg-amber-50 rounded-md shadow-lg z-50 border border-amber-200 overflow-hidden scrollbar-thin scrollbar-thumb-amber-400/80 scrollbar-track-amber-100/50 hover:scrollbar-thumb-amber-400`}
          >
            <div
              className={`p-2 sm:p-3 border-b border-amber-200 bg-amber-100 flex ${
                isRtl ? 'flex-row-reverse' : 'flex-row'
              } justify-between items-center sticky top-0 z-10`}
            >
              <h3 className="text-xs font-semibold text-amber-900 truncate">{t('notifications.title')}</h3>
              <div className="flex gap-1.5 sm:gap-2">
                <button
                  onClick={markAllAsRead}
                  className="text-[10px] text-amber-700 hover:text-amber-900 font-medium transition hover:underline"
                  aria-label={t('notifications.markAllRead')}
                >
                  {t('notifications.markAllRead')}
                </button>
                <button
                  onClick={clearNotifications}
                  className="text-[10px] text-red-600 hover:text-red-800 font-medium transition hover:underline"
                  aria-label={t('notifications.clear')}
                >
                  {t('notifications.clear')}
                </button>
              </div>
            </div>
            <div className="max-h-[calc(100vh-7rem)] overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="p-3 text-xs text-amber-700 text-center">{t('notifications.noNotifications')}</p>
              ) : (
                notifications.map((notification) => (
                  <NotificationItem
                    key={notification._id}
                    notification={notification}
                    isRtl={isRtl}
                    onMarkAsRead={markAsRead}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Notifications;