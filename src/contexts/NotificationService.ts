import { notificationsAPI } from '../services/api';
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
  async fetchNotifications(params: { userId?: string; read?: boolean; page?: number; limit?: number; departmentId?: string; branchId?: string; chefId?: string }): Promise<Notification[]> {
    if (params.userId && !/^[0-9a-fA-F]{24}$/.test(params.userId)) {
      toast.error('معرف المستخدم غير صالح', { position: 'top-left', toastId: 'invalid_user_id' });
      throw new Error('معرف المستخدم غير صالح');
    }
    try {
      const response = await notificationsAPI.getAll(params);
      return response.data.map((n: any) => ({
        _id: n._id,
        type: n.type,
        message: n.message.substring(0, 100),
        data: {
          orderId: n.data?.orderId,
          branchId: n.data?.branchId,
          chefId: n.data?.chefId,
          taskId: n.data?.taskId,
          returnId: n.data?.returnId,
          eventId: n.data?.eventId,
        },
        read: n.read,
        createdAt: n.createdAt,
      }));
    } catch (err: any) {
      throw err;
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
      toast.error('معرف الإشعار غير صالح', { position: 'top-left', toastId: `invalid_notification_${id}` });
      throw new Error('معرف الإشعار غير صالح');
    }
    try {
      await notificationsAPI.markAsRead(id);
    } catch (err: any) {
      throw err;
    }
  }

  async markAllAsRead(userId: string): Promise<void> {
    if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
      toast.error('معرف المستخدم غير صالح', { position: 'top-left', toastId: 'invalid_user_id' });
      throw new Error('معرف المستخدم غير صالح');
    }
    try {
      await notificationsAPI.markAllAsRead(userId);
    } catch (err: any) {
      throw err;
    }
  }

  async clearNotifications(): Promise<void> {
    try {
      await notificationsAPI.clear();
    } catch (err: any) {
      throw err;
    }
  }
}

export const notificationService = new NotificationService();