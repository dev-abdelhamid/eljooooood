import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Bell, CheckCircle, AlertCircle, Info, XCircle } from 'lucide-react';
import { formatDate } from '../utils/formatDate';

interface Notification {
  _id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  data?: { orderId?: string; taskId?: string };
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
    if (!notification.read) onMarkAsRead(notification._id);
    if (notification.data?.orderId) navigate(`/orders/${notification.data.orderId}`);
    else if (notification.data?.taskId) navigate(`/production-tasks/${notification.data.taskId}`);
  };

  const typeStyles = {
    success: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    error: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
    info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50' },
    warning: { icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  };

  const { icon: Icon, color, bg } = typeStyles[notification.type] || typeStyles.info;

  return (
    <div
      onClick={handleClick}
      className={`flex items-start p-2 border-b border-gray-200 hover:${bg} cursor-pointer ${isRtl ? 'text-right flex-row-reverse' : 'text-left'} ${notification.read ? 'opacity-70' : ''}`}
    >
      <Icon className={`w-4 h-4 ${color} ${isRtl ? 'ml-2' : 'mr-2'}`} />
      <div className="flex-1">
        <p className="text-sm text-gray-800">{notification.message}</p>
        <p className="text-xs text-gray-500">{formatDate(notification.createdAt)}</p>
      </div>
      {!notification.read && <span className={`w-2 h-2 bg-red-500 rounded-full ${isRtl ? 'mr-2' : 'ml-2'}`} />}
    </div>
  );
};

const Notifications: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${isRtl ? 'ml-2' : 'mr-2'}`} ref={notificationsRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-1 bg-gray-100 hover:bg-gray-200 rounded-full"
      >
        <Bell size={20} className="text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {isOpen && (
        <div className={`absolute ${isRtl ? 'right-0' : 'left-0'} top-10 w-80 bg-white rounded shadow-lg z-50 overflow-hidden`}>
          <div className={`p-2 bg-gray-100 flex ${isRtl ? 'flex-row-reverse' : 'flex-row'} justify-between items-center`}>
            <h3 className="text-sm font-semibold text-gray-800">{t('notifications.title')}</h3>
            <div className="flex gap-2">
              <button onClick={markAllAsRead} className="text-xs text-blue-600 hover:underline">
                {t('notifications.markAllRead')}
              </button>
              <button onClick={clearNotifications} className="text-xs text-red-600 hover:underline">
                {t('notifications.clear')}
              </button>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-2 text-sm text-gray-600 text-center">{t('notifications.noNotifications')}</p>
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
        </div>
      )}
    </div>
  );
};

export default Notifications;