import { useCallback, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Order } from '../types/types';
import { formatDate } from '../utils/formatDate';
import { ordersAPI } from '../services/api';

interface SocketEventData {
  orderId: string;
  orderNumber: string;
  branchName?: string;
  branchId?: string;
  items?: Array<{
    itemId: string;
    productId?: string;
    productName?: string;
    productNameEn?: string;
    quantity?: number;
    unit?: string;
    unitEn?: string;
    status?: string;
    assignedTo?: { _id: string; username?: string; name?: string; nameEn?: string; department?: { _id: string; name: string; nameEn?: string } };
    department?: { _id: string; name: string; nameEn?: string };
  }>;
  eventId?: string;
  status?: string;
  chefId?: string;
  returnId?: string;
}

interface SocketEventConfig {
  type: string;
  roles: string[];
}

export const useOrderNotifications = (
  dispatch: React.Dispatch<any>,
  stateRef: React.MutableRefObject<any>,
  user: any,
  addNotification: (notification: any) => void
) => {
  const { socket } = useSocket();
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';

  const playNotificationSound = useCallback((sound: string, vibrate: number[]) => {
    try {
      const audio = new Audio(sound);
      audio.play().catch(err => console.error(`[${new Date().toISOString()}] Audio play error:`, err.message));
      if (navigator.vibrate) navigator.vibrate(vibrate);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Notification sound error:`, err);
    }
  }, []);

  const translateUnit = useCallback((unit: string | undefined) => {
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
  }, [isRtl]);

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

    const notificationIds = new Set<string>();

    const events: { name: string; handler: (data: any) => void; config: SocketEventConfig }[] = [
      {
        name: 'orderCreated',
        handler: (newOrder: any) => {
          if (!newOrder?._id || !Array.isArray(newOrder.items) || !newOrder.orderNumber || !newOrder.branch?._id) {
            console.warn(`[${new Date().toISOString()}] Invalid order data:`, newOrder);
            return;
          }
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          const currentState = stateRef.current;
          if (currentState.filterStatus && newOrder.status !== currentState.filterStatus) return;
          if (currentState.filterBranch && newOrder.branch?._id !== currentState.filterBranch) return;
          if (user.role === 'production' && user.department && !newOrder.items.some((item: any) => item?.product?.department?._id === user.department._id)) return;
          if (user.role === 'branch' && newOrder.branch?._id !== user.branchId) return;

          const eventId = newOrder.eventId || crypto.randomUUID();
          if (notificationIds.has(eventId)) return;
          notificationIds.add(eventId);

          const mappedOrder: Order = {
            id: newOrder._id,
            orderNumber: newOrder.orderNumber || t('orders.unknown'),
            branchId: newOrder.branch?._id || 'unknown',
            branch: {
              _id: newOrder.branch?._id || 'unknown',
              name: newOrder.branch?.name || t('branches.unknown'),
              nameEn: newOrder.branch?.nameEn,
              displayName: isRtl ? newOrder.branch?.name : (newOrder.branch?.nameEn || newOrder.branch?.name || t('branches.unknown')),
            },
            items: newOrder.items.map((item: any) => ({
              _id: item._id || crypto.randomUUID(),
              productId: item.product?._id || 'unknown',
              productName: item.product?.name || t('products.unknown'),
              productNameEn: item.product?.nameEn,
              displayProductName: isRtl ? item.product?.name : (item.product?.nameEn || item.product?.name || t('products.unknown')),
              quantity: Number(item.quantity) || 1,
              price: Number(item.price) || 0,
              unit: item.product?.unit || 'unit',
              unitEn: item.product?.unitEn,
              displayUnit: translateUnit(item.product?.unit || 'unit'),
              department: {
                _id: item.product?.department?._id || 'unknown',
                name: item.product?.department?.name || t('departments.unknown'),
                nameEn: item.product?.department?.nameEn,
                displayName: isRtl ? item.product?.department?.name : (item.product?.department?.nameEn || item.product?.department?.name || t('departments.unknown')),
              },
              assignedTo: item.assignedTo ? {
                _id: item.assignedTo._id,
                username: item.assignedTo.username,
                name: item.assignedTo.name || item.assignedTo.username || t('users.unknown'),
                nameEn: item.assignedTo.nameEn,
                displayName: isRtl ? item.assignedTo.name : (item.assignedTo.nameEn || item.assignedTo.name || t('users.unknown')),
                department: item.assignedTo.department
              } : undefined,
              status: item.status || 'pending',
              returnedQuantity: Number(item.returnedQuantity) || 0,
              returnReason: item.returnReason || '',
            })),
            returns: Array.isArray(newOrder.returns)
              ? newOrder.returns.map((ret: any) => ({
                  returnId: ret._id || crypto.randomUUID(),
                  returnNumber: ret.returnNumber || t('returns.unknown'),
                  items: Array.isArray(ret.items)
                    ? ret.items.map((item: any) => ({
                        productId: item.product?._id || 'unknown',
                        productName: item.product?.name || t('products.unknown'),
                        productNameEn: item.product?.nameEn,
                        quantity: Number(item.quantity) || 0,
                        reason: item.reason || t('returns.unspecified'),
                        unit: item.product?.unit || 'unit',
                        unitEn: item.product?.unitEn,
                        displayUnit: translateUnit(item.product?.unit || 'unit'),
                      }))
                    : [],
                  status: ret.status || 'pending',
                  reviewNotes: ret.notes || '',
                  createdAt: formatDate(ret.createdAt ? new Date(ret.createdAt) : new Date(), language),
                  createdBy: {
                    _id: ret.createdBy?._id,
                    username: ret.createdBy?.username,
                    name: ret.createdBy?.name || t('users.unknown'),
                    nameEn: ret.createdBy?.nameEn,
                    displayName: isRtl ? ret.createdBy?.name : (ret.createdBy?.nameEn || ret.createdBy?.name || t('users.unknown')),
                  },
                }))
              : [],
            status: newOrder.status || 'pending',
            totalAmount: Number(newOrder.totalAmount) || 0,
            adjustedTotal: Number(newOrder.adjustedTotal) || Number(newOrder.totalAmount) || 0,
            date: formatDate(newOrder.createdAt ? new Date(newOrder.createdAt) : new Date(), language),
            requestedDeliveryDate: newOrder.requestedDeliveryDate ? new Date(newOrder.requestedDeliveryDate) : undefined,
            notes: newOrder.notes || '',
            priority: newOrder.priority || 'medium',
            createdBy: newOrder.createdBy?.name || t('users.unknown'),
            approvedBy: newOrder.approvedBy ? { _id: newOrder.approvedBy._id, name: newOrder.approvedBy.name || t('users.unknown') } : undefined,
            approvedAt: newOrder.approvedAt ? new Date(newOrder.approvedAt) : undefined,
            deliveredAt: newOrder.deliveredAt ? new Date(newOrder.deliveredAt) : undefined,
            transitStartedAt: newOrder.transitStartedAt ? new Date(newOrder.transitStartedAt) : undefined,
            statusHistory: Array.isArray(newOrder.statusHistory)
              ? newOrder.statusHistory.map((history: any) => ({
                  status: history.status || 'pending',
                  changedBy: history.changedBy?.name || t('users.unknown'),
                  changedAt: formatDate(history.changedAt ? new Date(history.changedAt) : new Date(), language),
                  notes: history.notes || '',
                }))
              : [],
          };

          dispatch({ type: 'ADD_ORDER', payload: mappedOrder });
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
            sound: '/sounds/new-order.mp3',
            vibrate: [200, 100, 200],
          });
          playNotificationSound('/sounds/new-order.mp3', [200, 100, 200]);
        },
        config: {
          type: 'ADD_ORDER',
          roles: ['admin', 'branch', 'production'],
        },
      },
      {
        name: 'orderConfirmed',
        handler: (data: SocketEventData) => {
          if (!['admin', 'branch'].includes(user.role)) return;
          if (!data.orderId || !data.orderNumber || !data.branchId) {
            console.warn(`[${new Date().toISOString()}] Invalid order confirmed data:`, data);
            return;
          }
          if (user.role === 'branch' && data.branchId !== user.branchId) return;

          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.has(eventId)) return;
          notificationIds.add(eventId);

          dispatch({ type: 'UPDATE_ORDER_STATUS', orderId: data.orderId, status: 'approved' });
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
          playNotificationSound('/sounds/notification.mp3', [200, 100, 200]);
        },
        config: {
          type: 'UPDATE_ORDER_STATUS',
          roles: ['admin', 'branch'],
        },
      },
      {
        name: 'taskAssigned',
        handler: (notification: any) => {
          const data: SocketEventData = notification.data || notification;
          if (!data.orderId || !data.orderNumber || !Array.isArray(data.items) || !data.branchId) {
            console.warn(`[${new Date().toISOString()}] Invalid task assigned data:`, data);
            return;
          }
          if (!['admin', 'production', 'chef'].includes(user.role)) return;
          if (user.role === 'chef' && !data.items.some((item: any) => item.assignedTo?._id === user._id)) return;

          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.has(eventId)) return;
          notificationIds.add(eventId);

          const mappedItems = data.items
            .filter((item: any) => item.itemId && item.productName && item.assignedTo?._id)
            .map((item: any) => ({
              _id: item.itemId,
              productId: item.productId || 'unknown',
              productName: item.productName || t('products.unknown'),
              productNameEn: item.productNameEn,
              displayProductName: isRtl ? item.productName : (item.productNameEn || item.productName || t('products.unknown')),
              quantity: Number(item.quantity) || 1,
              unit: item.unit || item.unitEn || 'unit',
              displayUnit: translateUnit(item.unit || item.unitEn || 'unit'),
              department: item.department || {
                _id: 'unknown',
                name: t('departments.unknown'),
                displayName: t('departments.unknown'),
              },
              status: item.status || 'assigned',
              assignedTo: item.assignedTo ? {
                _id: item.assignedTo._id,
                username: item.assignedTo.username,
                name: item.assignedTo.name || item.assignedTo.username || t('users.unknown'),
                nameEn: item.assignedTo.nameEn,
                displayName: isRtl ? item.assignedTo.name : (item.assignedTo.nameEn || item.assignedTo.name || t('users.unknown')),
                department: item.assignedTo.department
              } : undefined,
            }));

          if (mappedItems.length === 0) {
            console.warn(`[${new Date().toISOString()}] No valid items for taskAssigned:`, data);
            return;
          }

          dispatch({ type: 'TASK_ASSIGNED', orderId: data.orderId, items: mappedItems });
          mappedItems.forEach((item: any) => {
            addNotification({
              _id: `${eventId}-${item._id}`,
              type: 'info',
              message: t('notifications.task_assigned_to_chef', {
                chefName: item.assignedTo?.name || item.assignedTo?.username || t('chefs.unknown'),
                productName: item.displayProductName,
                quantity: item.quantity,
                unit: item.displayUnit,
                orderNumber: data.orderNumber,
                branchName: data.branchName || t('branches.unknown'),
              }),
              data: { orderId: data.orderId, itemId: item._id, eventId },
              read: false,
              createdAt: new Date().toISOString(),
              sound: '/sounds/notification.mp3',
              vibrate: [400, 100, 400],
            });
            playNotificationSound('/sounds/notification.mp3', [400, 100, 400]);
          });
        },
        config: {
          type: 'TASK_ASSIGNED',
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

          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.has(eventId)) return;
          notificationIds.add(eventId);

          dispatch({
            type: 'UPDATE_ITEM_STATUS',
            orderId: data.orderId,
            payload: { itemId: data.itemId, status: data.status },
          });

          try {
            const updatedOrder = await ordersAPI.getById(data.orderId);
            if (!updatedOrder || !updatedOrder._id || !Array.isArray(updatedOrder.items)) {
              console.warn(`[${new Date().toISOString()}] Failed to fetch updated order:`, data.orderId);
              return;
            }
            const allItemsCompleted = updatedOrder.items.every((item: any) => item.status === 'completed');
            if (allItemsCompleted && updatedOrder.status !== 'completed') {
              dispatch({ type: 'UPDATE_ORDER_STATUS', orderId: data.orderId, status: 'completed' });
              addNotification({
                _id: crypto.randomUUID(),
                type: 'success',
                message: t('notifications.order_completed', {
                  orderNumber: data.orderNumber,
                  branchName: data.branchName || t('branches.unknown'),
                }),
                data: { orderId: data.orderId, eventId: crypto.randomUUID() },
                read: false,
                createdAt: new Date().toISOString(),
                sound: '/sounds/notification.mp3',
                vibrate: [400, 100, 400],
              });
              playNotificationSound('/sounds/notification.mp3', [400, 100, 400]);
            }
          } catch (err) {
            console.error(`[${new Date().toISOString()}] Failed to fetch updated order:`, err);
          }

          addNotification({
            _id: eventId,
            type: 'info',
            message: t('notifications.item_status_updated', {
              productName: isRtl ? data.productName : (data.productNameEn || data.productName || t('products.unknown')),
              status: t(`item_status.${data.status}`),
              orderNumber: data.orderNumber,
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, itemId: data.itemId, eventId },
            read: false,
            createdAt: new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [200, 100, 200],
          });
          playNotificationSound('/sounds/notification.mp3', [200, 100, 200]);
        },
        config: {
          type: 'UPDATE_ITEM_STATUS',
          roles: ['admin', 'production', 'chef'],
        },
      },
      {
        name: 'orderStatusUpdated',
        handler: (data: SocketEventData) => {
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.status || !data.orderNumber || !data.branchId) {
            console.warn(`[${new Date().toISOString()}] Invalid order status update data:`, data);
            return;
          }
          if (user.role === 'branch' && data.branchId !== user.branchId) return;

          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.has(eventId)) return;
          notificationIds.add(eventId);

          dispatch({ type: 'UPDATE_ORDER_STATUS', orderId: data.orderId, status: data.status });
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
          playNotificationSound('/sounds/notification.mp3', [200, 100, 200]);
        },
        config: {
          type: 'UPDATE_ORDER_STATUS',
          roles: ['admin', 'branch', 'production'],
        },
      },
      {
        name: 'orderCompleted',
        handler: async (data: SocketEventData) => {
          if (!['admin', 'branch', 'production', 'chef'].includes(user.role)) return;
          if (!data.orderId || !data.orderNumber || !data.branchId) {
            console.warn(`[${new Date().toISOString()}] Invalid order completed data:`, data);
            return;
          }
          if (user.role === 'branch' && data.branchId !== user.branchId) return;

          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.has(eventId)) return;
          notificationIds.add(eventId);

          try {
            const updatedOrder = await ordersAPI.getById(data.orderId);
            if (!updatedOrder || !updatedOrder._id) {
              console.warn(`[${new Date().toISOString()}] Failed to fetch updated order:`, data.orderId);
              return;
            }
            const mappedOrder: Order = {
              id: updatedOrder._id,
              orderNumber: updatedOrder.orderNumber || t('orders.unknown'),
              branchId: updatedOrder.branch?._id || 'unknown',
              branch: {
                _id: updatedOrder.branch?._id || 'unknown',
                name: updatedOrder.branch?.name || t('branches.unknown'),
                nameEn: updatedOrder.branch?.nameEn,
                displayName: isRtl ? updatedOrder.branch?.name : (updatedOrder.branch?.nameEn || updatedOrder.branch?.name || t('branches.unknown')),
              },
              items: updatedOrder.items.map((item: any) => ({
                _id: item._id || crypto.randomUUID(),
                productId: item.product?._id || 'unknown',
                productName: item.product?.name || t('products.unknown'),
                productNameEn: item.product?.nameEn,
                displayProductName: isRtl ? item.product?.name : (item.product?.nameEn || item.product?.name || t('products.unknown')),
                quantity: Number(item.quantity) || 1,
                price: Number(item.price) || 0,
                unit: item.product?.unit || 'unit',
                unitEn: item.product?.unitEn,
                displayUnit: translateUnit(item.product?.unit || 'unit'),
                department: {
                  _id: item.product?.department?._id || 'unknown',
                  name: item.product?.department?.name || t('departments.unknown'),
                  nameEn: item.product?.department?.nameEn,
                  displayName: isRtl ? item.product?.department?.name : (item.product?.department?.nameEn || item.product?.department?.name || t('departments.unknown')),
                },
                assignedTo: item.assignedTo ? {
                  _id: item.assignedTo._id,
                  username: item.assignedTo.username,
                  name: item.assignedTo.name || item.assignedTo.username || t('users.unknown'),
                  nameEn: item.assignedTo.nameEn,
                  displayName: isRtl ? item.assignedTo.name : (item.assignedTo.nameEn || item.assignedTo.name || t('users.unknown')),
                  department: item.assignedTo.department
                } : undefined,
                status: item.status || 'completed',
                returnedQuantity: Number(item.returnedQuantity) || 0,
                returnReason: item.returnReason || '',
              })),
              returns: Array.isArray(updatedOrder.returns)
                ? updatedOrder.returns.map((ret: any) => ({
                    returnId: ret._id || crypto.randomUUID(),
                    returnNumber: ret.returnNumber || t('returns.unknown'),
                    items: Array.isArray(ret.items)
                      ? ret.items.map((item: any) => ({
                          productId: item.product?._id || 'unknown',
                          productName: item.product?.name || t('products.unknown'),
                          productNameEn: item.product?.nameEn,
                          quantity: Number(item.quantity) || 0,
                          reason: item.reason || t('returns.unspecified'),
                          unit: item.product?.unit || 'unit',
                          unitEn: item.product?.unitEn,
                          displayUnit: translateUnit(item.product?.unit || 'unit'),
                        }))
                      : [],
                    status: ret.status || 'pending',
                    reviewNotes: ret.notes || '',
                    createdAt: formatDate(ret.createdAt ? new Date(ret.createdAt) : new Date(), language),
                    createdBy: {
                      _id: ret.createdBy?._id,
                      username: ret.createdBy?.username,
                      name: ret.createdBy?.name || t('users.unknown'),
                      nameEn: ret.createdBy?.nameEn,
                      displayName: isRtl ? ret.createdBy?.name : (ret.createdBy?.nameEn || ret.createdBy?.name || t('users.unknown')),
                    },
                  }))
                : [],
              status: 'completed',
              totalAmount: Number(updatedOrder.totalAmount) || 0,
              adjustedTotal: Number(updatedOrder.adjustedTotal) || 0,
              date: formatDate(updatedOrder.createdAt ? new Date(updatedOrder.createdAt) : new Date(), language),
              requestedDeliveryDate: updatedOrder.requestedDeliveryDate ? new Date(updatedOrder.requestedDeliveryDate) : undefined,
              notes: updatedOrder.notes || '',
              priority: updatedOrder.priority || 'medium',
              createdBy: updatedOrder.createdBy?.name || t('users.unknown'),
              approvedBy: updatedOrder.approvedBy ? { _id: updatedOrder.approvedBy._id, name: updatedOrder.approvedBy.name || t('users.unknown') } : undefined,
              approvedAt: updatedOrder.approvedAt ? new Date(updatedOrder.approvedAt) : undefined,
              deliveredAt: updatedOrder.deliveredAt ? new Date(updatedOrder.deliveredAt) : undefined,
              transitStartedAt: updatedOrder.transitStartedAt ? new Date(updatedOrder.transitStartedAt) : undefined,
              statusHistory: Array.isArray(updatedOrder.statusHistory)
                ? updatedOrder.statusHistory.map((history: any) => ({
                    status: history.status || 'pending',
                    changedBy: history.changedBy?.name || t('users.unknown'),
                    changedAt: formatDate(history.changedAt ? new Date(history.changedAt) : new Date(), language),
                    notes: history.notes || '',
                  }))
                : [],
            };
            dispatch({ type: 'UPDATE_ORDER_STATUS', orderId: data.orderId, status: 'completed', payload: mappedOrder });
            addNotification({
              _id: eventId,
              type: 'success',
              message: t('notifications.order_completed', {
                orderNumber: data.orderNumber,
                branchName: data.branchName || t('branches.unknown'),
              }),
              data: { orderId: data.orderId, eventId },
              read: false,
              createdAt: new Date().toISOString(),
              sound: '/sounds/notification.mp3',
              vibrate: [400, 100, 400],
            });
            playNotificationSound('/sounds/notification.mp3', [400, 100, 400]);
          } catch (err) {
            console.error(`[${new Date().toISOString()}] Failed to fetch updated order:`, err);
          }
        },
        config: {
          type: 'UPDATE_ORDER_STATUS',
          roles: ['admin', 'branch', 'production', 'chef'],
        },
      },
      {
        name: 'orderShipped',
        handler: async (data: SocketEventData) => {
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.orderNumber || !data.branchId) {
            console.warn(`[${new Date().toISOString()}] Invalid order shipped data:`, data);
            return;
          }
          if (user.role === 'branch' && data.branchId !== user.branchId) return;

          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.has(eventId)) return;
          notificationIds.add(eventId);

          try {
            const updatedOrder = await ordersAPI.getById(data.orderId);
            if (!updatedOrder || !updatedOrder._id) {
              console.warn(`[${new Date().toISOString()}] Failed to fetch updated order:`, data.orderId);
              return;
            }
            const mappedOrder: Order = {
              id: updatedOrder._id,
              orderNumber: updatedOrder.orderNumber || t('orders.unknown'),
              branchId: updatedOrder.branch?._id || 'unknown',
              branch: {
                _id: updatedOrder.branch?._id || 'unknown',
                name: updatedOrder.branch?.name || t('branches.unknown'),
                nameEn: updatedOrder.branch?.nameEn,
                displayName: isRtl ? updatedOrder.branch?.name : (updatedOrder.branch?.nameEn || updatedOrder.branch?.name || t('branches.unknown')),
              },
              items: updatedOrder.items.map((item: any) => ({
                _id: item._id || crypto.randomUUID(),
                productId: item.product?._id || 'unknown',
                productName: item.product?.name || t('products.unknown'),
                productNameEn: item.product?.nameEn,
                displayProductName: isRtl ? item.product?.name : (item.product?.nameEn || item.product?.name || t('products.unknown')),
                quantity: Number(item.quantity) || 1,
                price: Number(item.price) || 0,
                unit: item.product?.unit || 'unit',
                unitEn: item.product?.unitEn,
                displayUnit: translateUnit(item.product?.unit || 'unit'),
                department: {
                  _id: item.product?.department?._id || 'unknown',
                  name: item.product?.department?.name || t('departments.unknown'),
                  nameEn: item.product?.department?.nameEn,
                  displayName: isRtl ? item.product?.department?.name : (item.product?.department?.nameEn || item.product?.department?.name || t('departments.unknown')),
                },
                assignedTo: item.assignedTo ? {
                  _id: item.assignedTo._id,
                  username: item.assignedTo.username,
                  name: item.assignedTo.name || item.assignedTo.username || t('users.unknown'),
                  nameEn: item.assignedTo.nameEn,
                  displayName: isRtl ? item.assignedTo.name : (item.assignedTo.nameEn || item.assignedTo.name || t('users.unknown')),
                  department: item.assignedTo.department
                } : undefined,
                status: item.status || 'completed',
                returnedQuantity: Number(item.returnedQuantity) || 0,
                returnReason: item.returnReason || '',
              })),
              returns: Array.isArray(updatedOrder.returns)
                ? updatedOrder.returns.map((ret: any) => ({
                    returnId: ret._id || crypto.randomUUID(),
                    returnNumber: ret.returnNumber || t('returns.unknown'),
                    items: Array.isArray(ret.items)
                      ? ret.items.map((item: any) => ({
                          productId: item.product?._id || 'unknown',
                          productName: item.product?.name || t('products.unknown'),
                          productNameEn: item.product?.nameEn,
                          quantity: Number(item.quantity) || 0,
                          reason: item.reason || t('returns.unspecified'),
                          unit: item.product?.unit || 'unit',
                          unitEn: item.product?.unitEn,
                          displayUnit: translateUnit(item.product?.unit || 'unit'),
                        }))
                      : [],
                    status: ret.status || 'pending',
                    reviewNotes: ret.notes || '',
                    createdAt: formatDate(ret.createdAt ? new Date(ret.createdAt) : new Date(), language),
                    createdBy: {
                      _id: ret.createdBy?._id,
                      username: ret.createdBy?.username,
                      name: ret.createdBy?.name || t('users.unknown'),
                      nameEn: ret.createdBy?.nameEn,
                      displayName: isRtl ? ret.createdBy?.name : (ret.createdBy?.nameEn || ret.createdBy?.name || t('users.unknown')),
                    },
                  }))
                : [],
              status: 'in_transit',
              totalAmount: Number(updatedOrder.totalAmount) || 0,
              adjustedTotal: Number(updatedOrder.adjustedTotal) || 0,
              date: formatDate(updatedOrder.createdAt ? new Date(updatedOrder.createdAt) : new Date(), language),
              requestedDeliveryDate: updatedOrder.requestedDeliveryDate ? new Date(updatedOrder.requestedDeliveryDate) : undefined,
              notes: updatedOrder.notes || '',
              priority: updatedOrder.priority || 'medium',
              createdBy: updatedOrder.createdBy?.name || t('users.unknown'),
              approvedBy: updatedOrder.approvedBy ? { _id: updatedOrder.approvedBy._id, name: updatedOrder.approvedBy.name || t('users.unknown') } : undefined,
              approvedAt: updatedOrder.approvedAt ? new Date(updatedOrder.approvedAt) : undefined,
              deliveredAt: updatedOrder.deliveredAt ? new Date(updatedOrder.deliveredAt) : undefined,
              transitStartedAt: updatedOrder.transitStartedAt ? new Date(updatedOrder.transitStartedAt) : undefined,
              statusHistory: Array.isArray(updatedOrder.statusHistory)
                ? updatedOrder.statusHistory.map((history: any) => ({
                    status: history.status || 'pending',
                    changedBy: history.changedBy?.name || t('users.unknown'),
                    changedAt: formatDate(history.changedAt ? new Date(history.changedAt) : new Date(), language),
                    notes: history.notes || '',
                  }))
                : [],
            };
            dispatch({ type: 'UPDATE_ORDER_STATUS', orderId: data.orderId, status: 'in_transit', payload: mappedOrder });
            addNotification({
              _id: eventId,
              type: 'success',
              message: t('notifications.order_shipped', {
                orderNumber: data.orderNumber,
                branchName: data.branchName || t('branches.unknown'),
              }),
              data: { orderId: data.orderId, eventId },
              read: false,
              createdAt: new Date().toISOString(),
              sound: '/sounds/notification.mp3',
              vibrate: [400, 100, 400],
            });
            playNotificationSound('/sounds/notification.mp3', [400, 100, 400]);
          } catch (err) {
            console.error(`[${new Date().toISOString()}] Failed to fetch updated order:`, err);
          }
        },
        config: {
          type: 'UPDATE_ORDER_STATUS',
          roles: ['admin', 'branch', 'production'],
        },
      },
      {
        name: 'orderDelivered',
        handler: async (data: SocketEventData) => {
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.orderNumber || !data.branchId) {
            console.warn(`[${new Date().toISOString()}] Invalid order delivered data:`, data);
            return;
          }
          if (user.role === 'branch' && data.branchId !== user.branchId) return;

          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.has(eventId)) return;
          notificationIds.add(eventId);

          try {
            const updatedOrder = await ordersAPI.getById(data.orderId);
            if (!updatedOrder || !updatedOrder._id) {
              console.warn(`[${new Date().toISOString()}] Failed to fetch updated order:`, data.orderId);
              return;
            }
            const mappedOrder: Order = {
              id: updatedOrder._id,
              orderNumber: updatedOrder.orderNumber || t('orders.unknown'),
              branchId: updatedOrder.branch?._id || 'unknown',
              branch: {
                _id: updatedOrder.branch?._id || 'unknown',
                name: updatedOrder.branch?.name || t('branches.unknown'),
                nameEn: updatedOrder.branch?.nameEn,
                displayName: isRtl ? updatedOrder.branch?.name : (updatedOrder.branch?.nameEn || updatedOrder.branch?.name || t('branches.unknown')),
              },
              items: updatedOrder.items.map((item: any) => ({
                _id: item._id || crypto.randomUUID(),
                productId: item.product?._id || 'unknown',
                productName: item.product?.name || t('products.unknown'),
                productNameEn: item.product?.nameEn,
                displayProductName: isRtl ? item.product?.name : (item.product?.nameEn || item.product?.name || t('products.unknown')),
                quantity: Number(item.quantity) || 1,
                price: Number(item.price) || 0,
                unit: item.product?.unit || 'unit',
                unitEn: item.product?.unitEn,
                displayUnit: translateUnit(item.product?.unit || 'unit'),
                department: {
                  _id: item.product?.department?._id || 'unknown',
                  name: item.product?.department?.name || t('departments.unknown'),
                  nameEn: item.product?.department?.nameEn,
                  displayName: isRtl ? item.product?.department?.name : (item.product?.department?.nameEn || item.product?.department?.name || t('departments.unknown')),
                },
                assignedTo: item.assignedTo ? {
                  _id: item.assignedTo._id,
                  username: item.assignedTo.username,
                  name: item.assignedTo.name || item.assignedTo.username || t('users.unknown'),
                  nameEn: item.assignedTo.nameEn,
                  displayName: isRtl ? item.assignedTo.name : (item.assignedTo.nameEn || item.assignedTo.name || t('users.unknown')),
                  department: item.assignedTo.department
                } : undefined,
                status: item.status || 'completed',
                returnedQuantity: Number(item.returnedQuantity) || 0,
                returnReason: item.returnReason || '',
              })),
              returns: Array.isArray(updatedOrder.returns)
                ? updatedOrder.returns.map((ret: any) => ({
                    returnId: ret._id || crypto.randomUUID(),
                    returnNumber: ret.returnNumber || t('returns.unknown'),
                    items: Array.isArray(ret.items)
                      ? ret.items.map((item: any) => ({
                          productId: item.product?._id || 'unknown',
                          productName: item.product?.name || t('products.unknown'),
                          productNameEn: item.product?.nameEn,
                          quantity: Number(item.quantity) || 0,
                          reason: item.reason || t('returns.unspecified'),
                          unit: item.product?.unit || 'unit',
                          unitEn: item.product?.unitEn,
                          displayUnit: translateUnit(item.product?.unit || 'unit'),
                        }))
                      : [],
                    status: ret.status || 'pending',
                    reviewNotes: ret.notes || '',
                    createdAt: formatDate(ret.createdAt ? new Date(ret.createdAt) : new Date(), language),
                    createdBy: {
                      _id: ret.createdBy?._id,
                      username: ret.createdBy?.username,
                      name: ret.createdBy?.name || t('users.unknown'),
                      nameEn: ret.createdBy?.nameEn,
                      displayName: isRtl ? ret.createdBy?.name : (ret.createdBy?.nameEn || ret.createdBy?.name || t('users.unknown')),
                    },
                  }))
                : [],
              status: 'delivered',
              totalAmount: Number(updatedOrder.totalAmount) || 0,
              adjustedTotal: Number(updatedOrder.adjustedTotal) || 0,
              date: formatDate(updatedOrder.createdAt ? new Date(updatedOrder.createdAt) : new Date(), language),
              requestedDeliveryDate: updatedOrder.requestedDeliveryDate ? new Date(updatedOrder.requestedDeliveryDate) : undefined,
              notes: updatedOrder.notes || '',
              priority: updatedOrder.priority || 'medium',
              createdBy: updatedOrder.createdBy?.name || t('users.unknown'),
              approvedBy: updatedOrder.approvedBy ? { _id: updatedOrder.approvedBy._id, name: updatedOrder.approvedBy.name || t('users.unknown') } : undefined,
              approvedAt: updatedOrder.approvedAt ? new Date(updatedOrder.approvedAt) : undefined,
              deliveredAt: updatedOrder.deliveredAt ? new Date(updatedOrder.deliveredAt) : undefined,
              transitStartedAt: updatedOrder.transitStartedAt ? new Date(updatedOrder.transitStartedAt) : undefined,
              statusHistory: Array.isArray(updatedOrder.statusHistory)
                ? updatedOrder.statusHistory.map((history: any) => ({
                    status: history.status || 'pending',
                    changedBy: history.changedBy?.name || t('users.unknown'),
                    changedAt: formatDate(history.changedAt ? new Date(history.changedAt) : new Date(), language),
                    notes: history.notes || '',
                  }))
                : [],
            };
            dispatch({ type: 'UPDATE_ORDER_STATUS', orderId: data.orderId, status: 'delivered', payload: mappedOrder });
            addNotification({
              _id: eventId,
              type: 'success',
              message: t('notifications.order_delivered', {
                orderNumber: data.orderNumber,
                branchName: data.branchName || t('branches.unknown'),
              }),
              data: { orderId: data.orderId, eventId },
              read: false,
              createdAt: new Date().toISOString(),
              sound: '/sounds/notification.mp3',
              vibrate: [400, 100, 400],
            });
            playNotificationSound('/sounds/notification.mp3', [400, 100, 400]);
          } catch (err) {
            console.error(`[${new Date().toISOString()}] Failed to fetch updated order:`, err);
          }
        },
        config: {
          type: 'UPDATE_ORDER_STATUS',
          roles: ['admin', 'branch', 'production'],
        },
      },
      {
        name: 'returnStatusUpdated',
        handler: (data: SocketEventData) => {
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.returnId || !data.status || !data.orderNumber || !data.branchId) {
            console.warn(`[${new Date().toISOString()}] Invalid return status update data:`, data);
            return;
          }
          if (user.role === 'branch' && data.branchId !== user.branchId) return;

          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.has(eventId)) return;
          notificationIds.add(eventId);

          dispatch({ type: 'RETURN_STATUS_UPDATED', orderId: data.orderId, returnId: data.returnId, status: data.status });
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
          playNotificationSound('/sounds/notification.mp3', [200, 100, 200]);
        },
        config: {
          type: 'RETURN_STATUS_UPDATED',
          roles: ['admin', 'branch', 'production'],
        },
      },
      {
        name: 'missingAssignments',
        handler: (data: SocketEventData) => {
          if (!['admin', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.itemId || !data.orderNumber || !data.productName || !data.branchId) {
            console.warn(`[${new Date().toISOString()}] Invalid missing assignments data:`, data);
            return;
          }

          const eventId = data.eventId || crypto.randomUUID();
          if (notificationIds.has(eventId)) return;
          notificationIds.add(eventId);

          dispatch({ type: 'MISSING_ASSIGNMENTS', orderId: data.orderId, itemId: data.itemId, productName: data.productName });
          addNotification({
            _id: eventId,
            type: 'warning',
            message: t('notifications.missing_assignments', {
              orderNumber: data.orderNumber,
              productName: isRtl ? data.productName : (data.productNameEn || data.productName || t('products.unknown')),
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, itemId: data.itemId, eventId },
            read: false,
            createdAt: new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [300, 100, 300],
          });
          playNotificationSound('/sounds/notification.mp3', [300, 100, 300]);
        },
        config: {
          type: 'MISSING_ASSIGNMENTS',
          roles: ['admin', 'production'],
        },
      },
      {
        name: 'connect',
        handler: () => {
          dispatch({ type: 'SET_SOCKET_CONNECTED', payload: true });
          dispatch({ type: 'SET_SOCKET_ERROR', payload: null });
          console.log(`[${new Date().toISOString()}] Socket connected`);
        },
        config: {
          type: 'SET_SOCKET_CONNECTED',
          roles: ['admin', 'branch', 'production', 'chef'],
        },
      },
      {
        name: 'disconnect',
        handler: () => {
          dispatch({ type: 'SET_SOCKET_CONNECTED', payload: false });
          dispatch({ type: 'SET_SOCKET_ERROR', payload: t('socket.disconnected') });
          console.warn(`[${new Date().toISOString()}] Socket disconnected`);
        },
        config: {
          type: 'SET_SOCKET_DISCONNECTED',
          roles: ['admin', 'branch', 'production', 'chef'],
        },
      },
      {
        name: 'connect_error',
        handler: (error: Error) => {
          dispatch({ type: 'SET_SOCKET_ERROR', payload: `${t('socket.error')}: ${error.message}` });
          console.error(`[${new Date().toISOString()}] Socket connection error:`, error);
        },
        config: {
          type: 'SET_SOCKET_ERROR',
          roles: ['admin', 'branch', 'production', 'chef'],
        },
      },
    ];

    events.forEach(({ name, handler }) => socket.on(name, handler));
    return () => {
      events.forEach(({ name, handler }) => socket.off(name, handler));
    };
  }, [socket, user, dispatch, stateRef, t, isRtl, addNotification, translateUnit, playNotificationSound]);

  return { playNotificationSound };
};