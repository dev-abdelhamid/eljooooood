import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Link } from 'react-router-dom';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'error';
  message: string;
  timestamp: string;
  read: boolean;
  data?: { orderId?: string; returnId?: string; taskId?: string; branchId?: string; chefId?: string };
  sound?: string;
  vibrate?: number[];
}

interface NotificationItemProps {
  notification: Notification;
  isRtl: boolean;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, isRtl }) => {
  useLanguage();

  const getTypeStyles = () => {
    switch (notification.type) {
      case 'success':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  const getLink = () => {
    if (notification.data?.orderId) {
      return `/orders/${notification.data.orderId}`;
    }
    if (notification.data?.returnId) {
      return `/returns/${notification.data.returnId}`;
    }
    if (notification.data?.taskId) {
      return `/tasks/${notification.data.taskId}`;
    }
    return '#';
  };

  return (
    <div
      className={`flex items-center p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${getTypeStyles()} ${
        notification.read ? 'opacity-60' : ''
      }`}
    >
      <div className="flex-shrink-0">
        <svg
          className={`w-5 h-5 ${notification.type === 'success' ? 'text-green-600' : notification.type === 'error' ? 'text-red-600' : 'text-blue-600'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          {notification.type === 'success' ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          ) : notification.type === 'error' ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          )}
        </svg>
      </div>
      <div className={`flex-1 ${isRtl ? 'mr-3' : 'ml-3'}`}>
        <Link to={getLink()} className="text-sm font-medium hover:underline">
          {notification.message}
        </Link>
        <p className="text-xs text-gray-500 mt-1">
          {notification.timestamp}
        </p>
      </div>
      {!notification.read && (
        <span
          className={`w-2 h-2 rounded-full ${notification.type === 'success' ? 'bg-green-500' : notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}
        />
      )}
    </div>
  );
};

export default NotificationItem;