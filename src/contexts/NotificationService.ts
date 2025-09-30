
import { notificationsAPI } from '../services/api';
import { toast } from 'react-toastify';

interface Notification {
  _id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  data?: { orderId?: string; branchId?: string; chefId?: string; taskId?: string; returnId?: string; eventId?: string };
  read: boolean;
  createdAt: string;
}

class NotificationService {
  async fetchNotifications(params: { userId?: string; limit?: number; departmentId?: string; branchId?: string; chefId?: string }): Promise<Notification[]> {
    try {
      const response = await notificationsAPI.getAll(params);
      return response.data.map((n: any) => ({
        _id: n._id,
        type: n.type,
        message: n.message.substring(0, 100),
        data: n.data,
        read: n.read,
        createdAt: n.createdAt,
      }));
    } catch {
      throw new Error('فشل جلب الإشعارات');
    }
  }

  async createNotification(notificationData: {
    user: string;
    type: string;
    message: string;
    data?: { orderId?: string; branchId?: string; chefId?: string; taskId?: string; returnId?: string; eventId?: string };
  }): Promise<any> {
    return notificationsAPI.create(notificationData);
  }

  async markAsRead(id: string): Promise<void> {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      toast.error('معرف الإشعار غير صالح', { position: 'top-right' });
      throw new Error('معرف الإشعار غير صالح');
    }
    await notificationsAPI.markAsRead(id);
  }

  async markAllAsRead(userId: string): Promise<void> {
    if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
      toast.error('معرف المستخدم غير صالح', { position: 'top-right' });
      throw new Error('معرف المستخدم غير صالح');
    }
    await notificationsAPI.markAllAsRead(userId);
  }

  async clearNotifications(): Promise<void> {
    await notificationsAPI.clear();
  }
}

export const notificationService = new NotificationService();
