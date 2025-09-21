import { io, Socket } from 'socket.io-client';
import { toast } from 'react-toastify';

interface Notification {
  _id: string;
  type: 'orderCreated' | 'taskAssigned' | 'itemStatusUpdated' | 'orderStatusUpdated' | 'orderDelivered' | 'returnStatusUpdated' | 'missingAssignments';
  message: string;
  data?: {
    orderId?: string;
    branchId?: string;
    chefId?: string;
    taskId?: string;
    returnId?: string;
    eventId?: string;
  };
  read: boolean;
  createdAt: string;
}

class NotificationService {
  private socket: Socket;

  constructor() {
    this.socket = io(process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app', {
      auth: { token: localStorage.getItem('token') },
    });

    this.socket.on('connect', () => console.log(`[${new Date().toISOString()}] Socket connected`));
    this.socket.on('connect_error', (err) => console.error(`[${new Date().toISOString()}] Socket connection error:`, err));
    this.socket.on('newNotification', this.handleNotification.bind(this));
  }

  private handleNotification(notification: Notification) {
    toast.info(notification.message, {
      position: 'top-right',
      autoClose: 5000,
      pauseOnFocusLoss: true,
      onClick: () => {
        if (notification.data?.orderId) {
          window.location.href = `/orders/${notification.data.orderId}`;
        }
      },
    });

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.message, {
        body: notification.data?.orderId ? `Order ID: ${notification.data.orderId}` : undefined,
        icon: '/favicon.ico',
        data: notification.data,
      });
    }
  }

  async requestNotificationPermission(): Promise<void> {
    if ('Notification' in window && Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log(`[${new Date().toISOString()}] Notification permission granted`);
      }
    }
  }

  async setupPushNotifications(): Promise<void> {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.REACT_APP_VAPID_PUBLIC_KEY,
        });
        await fetch(`${process.env.REACT_APP_API_URL}/notifications/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify(subscription),
        });
        console.log(`[${new Date().toISOString()}] Push subscription successful`);
      } catch (err) {
        console.error(`[${new Date().toISOString()}] Push subscription failed:`, err);
      }
    }
  }

  joinRoom(room: string): void {
    this.socket.emit('joinRoom', room);
    console.log(`[${new Date().toISOString()}] Joined room: ${room}`);
  }

  leaveRoom(room: string): void {
    this.socket.emit('leaveRoom', room);
    console.log(`[${new Date().toISOString()}] Left room: ${room}`);
  }

  disconnect(): void {
    this.socket.disconnect();
    console.log(`[${new Date().toISOString()}] Socket disconnected`);
  }
}

export const notificationService = new NotificationService();