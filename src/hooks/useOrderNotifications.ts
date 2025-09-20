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
    quantity?: number;
    unit?: string;
    status?: string;
    assignedTo?: { _id: string; username?: string; name?: string };
    department?: { _id: string; name: string };
  }>;
  eventId?: string;
  status?: string;
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

  // دالة ترجمة الوحدات
  const translateUnit = (unit: string | undefined) => {
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
  };

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

    const events: { name: string; handler: (data: any) => void; config: SocketEventConfig }[] = [
      {
        name: 'orderCreated',
        handler: (newOrder: any) => {
          if (!newOrder?._id || !Array.isArray(newOrder.items) || !newOrder.orderNumber || !newOrder.branch?.name) {
            console.warn(`[${new Date().toISOString()}] Invalid order data:`, newOrder);
            return;
          }
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          const currentState = stateRef.current;
          if (currentState.filterStatus && newOrder.status !== currentState.filterStatus) return;
          if (currentState.filterBranch && newOrder.branch?._id !== currentState.filterBranch) return;
          if (user.role === 'production' && user.department && !newOrder.items.some((item: any) => item?.product?.department?._id === user.department._id)) return;
          if (user.role === 'branch' && newOrder.branch?._id !== user.branchId) return;

          const mappedOrder: Order = {
            id: newOrder._id,
            orderNumber: newOrder.orderNumber || t('orders.unknown'),
            branchName: newOrder.branch?.name || t('branches.unknown'),
            branchId: newOrder.branch?._id || 'unknown',
            branch: newOrder.branch || { _id: 'unknown', name: t('branches.unknown') },
            items: newOrder.items.map((item: any) => ({
              _id: item._id || crypto.randomUUID(),
              itemId: item._id || crypto.randomUUID(),
              productId: item.product?._id || 'unknown',
              productName: item.product?.name || t('products.unknown'),
              quantity: Number(item.quantity) || 1,
              price: Number(item.price) || 0,
              unit: translateUnit(item.unit || item.product?.unit),
              department: item.product?.department || { _id: 'unknown', name: t('departments.unknown') },
              status: item.status || 'pending',
              assignedTo: item.assignedTo ? { _id: item.assignedTo._id, username: item.assignedTo.username, name: item.assignedTo.name } : undefined,
              returnedQuantity: Number(item.returnedQuantity) || 0,
              returnReason: item.returnReason || '',
            })),
            status: newOrder.status || 'pending',
            totalAmount: Number(newOrder.totalAmount) || 0,
            adjustedTotal: typeof newOrder.adjustedTotal === 'number' ? newOrder.adjustedTotal : Number(newOrder.totalAmount) || 0,
            date: formatDate(newOrder.createdAt || new Date(), t('language')),
            notes: newOrder.notes || '',
            priority: newOrder.priority || 'medium',
            createdBy: newOrder.createdBy?.username || t('orders.unknown'),
            statusHistory: Array.isArray(newOrder.statusHistory)
              ? newOrder.statusHistory.map((history: any) => ({
                  status: history.status || 'pending',
                  changedBy: history.changedBy || t('orders.unknown'),
                  changedAt: formatDate(history.changedAt || new Date(), t('language')),
                  notes: history.notes || '',
                }))
              : [],
            returns: Array.isArray(newOrder.returns)
              ? newOrder.returns.map((ret: any) => ({
                  returnId: ret._id || crypto.randomUUID(),
                  items: Array.isArray(ret.items)
                    ? ret.items.map((item: any) => ({
                        productId: item.product?._id || 'unknown',
                        quantity: Number(item.quantity) || 0,
                        reason: item.reason || '',
                      }))
                    : [],
                  status: ret.status || 'pending_approval',
                  reviewNotes: ret.reviewNotes || '',
                  createdAt: formatDate(ret.createdAt || new Date(), t('language')),
                }))
              : [],
          };

          dispatch({ type: 'ADD_ORDER', payload: mappedOrder });
          addNotification({
            _id: newOrder.eventId || crypto.randomUUID(),
            type: 'success',
            message: t('notifications.order_created', {
              orderNumber: newOrder.orderNumber,
              branchName: newOrder.branch?.name || t('branches.unknown'),
            }),
            data: { orderId: newOrder._id, eventId: newOrder.eventId },
            read: false,
            createdAt: new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [200, 100, 200],
          });
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
          if (!data.orderId || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid order confirmed data:`, data);
            return;
          }
          if (user.role === 'branch' && data.branchId !== user.branchId) return;

          dispatch({ type: 'UPDATE_ORDER_STATUS', orderId: data.orderId, status: 'confirmed' });
          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'success',
            message: t('notifications.order_confirmed', {
              orderNumber: data.orderNumber,
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [200, 100, 200],
          });
        },
        config: {
          type: 'UPDATE_ORDER_STATUS',
          roles: ['admin', 'branch'],
        },
      },
     {
  name: 'taskAssigned',
  handler: (notification: any) => {
    console.log(`[${new Date().toISOString()}] taskAssigned - Received data:`, JSON.stringify(notification, null, 2));
    const data: SocketEventData = notification.data || notification;

    if (!data.orderId || !data.orderNumber || !Array.isArray(data.items) || !data.branchName) {
      console.warn(`[${new Date().toISOString()}] Invalid task assigned data:`, data);
      return;
    }
    if (!['admin', 'production', 'chef'].includes(user.role)) return;
    if (user.role === 'chef' && !data.items.some((item: any) => item.assignedTo?._id === user._id)) return;

    const mappedItems = data.items
      .filter((item: any) => item._id && item.product?.name && item.assignedTo?._id) // فحص صارم
      .map((item: any) => ({
        _id: item._id || item.itemId || crypto.randomUUID(),
        itemId: item._id || item.itemId || crypto.randomUUID(),
        productId: item.product?._id || item.productId || 'unknown',
        productName: item.product?.name || item.productName || t('products.unknown'),
        quantity: Number(item.quantity) || 1,
        unit: translateUnit(item.unit || item.product?.unit),
        department: item.department || item.product?.department || { _id: 'unknown', name: t('departments.unknown') },
        status: item.status || 'pending', // تغيير من 'assigned' إلى 'pending' لتتماشى مع حالة المهمة الأولية
        assignedTo: item.assignedTo
          ? { _id: item.assignedTo._id, username: item.assignedTo.username || item.assignedTo.name || t('chefs.unknown'), name: item.assignedTo.name }
          : undefined,
      }));

    if (mappedItems.length === 0) {
      console.warn(`[${new Date().toISOString()}] No valid items for taskAssigned:`, data);
      return;
    }

    dispatch({ type: 'TASK_ASSIGNED', payload: { orderId: data.orderId, items: mappedItems, orderNumber: data.orderNumber, branchName: data.branchName } });
    mappedItems.forEach((item: any) => {
      addNotification({
        _id: `${data.eventId || crypto.randomUUID()}-${item.itemId}`,
        type: 'info',
        message: t('notifications.task_assigned_to_chef', {
          chefName: item.assignedTo?.name || item.assignedTo?.username || t('chefs.unknown'),
          productName: item.productName || t('products.unknown'),
          quantity: item.quantity,
          unit: item.unit,
          orderNumber: data.orderNumber,
          branchName: data.branchName || t('branches.unknown'),
        }),
        data: { orderId: data.orderId, itemId: item.itemId, eventId: data.eventId },
        read: false,
        createdAt: new Date().toISOString(),
        sound: '/sounds/notification.mp3',
        vibrate: [400, 100, 400],
      });
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

          dispatch({
            type: 'UPDATE_ITEM_STATUS',
            payload: { orderId: data.orderId, itemId: data.itemId, status: data.status },
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
                _id: data.eventId || crypto.randomUUID(),
                type: 'success',
                message: t('notifications.order_completed', {
                  orderNumber: data.orderNumber,
                  branchName: data.branchName || t('branches.unknown'),
                }),
                data: { orderId: data.orderId, eventId: data.eventId },
                read: false,
                createdAt: new Date().toISOString(),
                sound: '/sounds/notification.mp3',
                vibrate: [400, 100, 400],
              });
            }
          } catch (err) {
            console.error(`[${new Date().toISOString()}] Failed to fetch updated order:`, err);
          }
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
          if (!data.orderId || !data.status || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid order status update data:`, data);
            return;
          }
          dispatch({ type: 'UPDATE_ORDER_STATUS', orderId: data.orderId, status: data.status });
          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'info',
            message: t('notifications.order_status_updated', {
              orderNumber: data.orderNumber,
              status: t(`order_status.${data.status}`),
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [200, 100, 200],
          });
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
          if (!data.orderId || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid order completed data:`, data);
            return;
          }
          try {
            const updatedOrder = await ordersAPI.getById(data.orderId);
            if (!updatedOrder || !updatedOrder._id) {
              console.warn(`[${new Date().toISOString()}] Failed to fetch updated order:`, data.orderId);
              return;
            }
            const mappedOrder: Order = {
              id: updatedOrder._id,
              orderNumber: updatedOrder.orderNumber || t('orders.unknown'),
              branchName: updatedOrder.branch?.name || t('branches.unknown'),
              branchId: updatedOrder.branch?._id || 'unknown',
              branch: updatedOrder.branch || { _id: 'unknown', name: t('branches.unknown') },
              items: updatedOrder.items.map((item: any) => ({
                _id: item._id || crypto.randomUUID(),
                itemId: item._id || crypto.randomUUID(),
                productId: item.product?._id || 'unknown',
                productName: item.product?.name || t('products.unknown'),
                quantity: Number(item.quantity) || 1,
                price: Number(item.price) || 0,
                unit: translateUnit(item.unit || item.product?.unit),
                department: item.product?.department || { _id: 'unknown', name: t('departments.unknown') },
                status: item.status || 'completed',
                assignedTo: item.assignedTo ? { _id: item.assignedTo._id, username: item.assignedTo.username, name: item.assignedTo.name } : undefined,
                returnedQuantity: Number(item.returnedQuantity) || 0,
                returnReason: item.returnReason || '',
              })),
              status: 'completed',
              totalAmount: Number(updatedOrder.totalAmount) || 0,
              date: formatDate(updatedOrder.createdAt || new Date(), t('language')),
              notes: updatedOrder.notes || '',
              priority: updatedOrder.priority || 'medium',
              createdBy: updatedOrder.createdBy?.username || t('orders.unknown'),
              statusHistory: Array.isArray(updatedOrder.statusHistory)
                ? updatedOrder.statusHistory.map((history: any) => ({
                    status: history.status || 'pending',
                    changedBy: history.changedBy || t('orders.unknown'),
                    changedAt: formatDate(history.changedAt || new Date(), t('language')),
                    notes: history.notes || '',
                  }))
                : [],
              returns: Array.isArray(updatedOrder.returns)
                ? updatedOrder.returns.map((ret: any) => ({
                    returnId: ret._id || crypto.randomUUID(),
                    items: Array.isArray(ret.items)
                      ? ret.items.map((item: any) => ({
                          productId: item.product?._id || 'unknown',
                          quantity: Number(item.quantity) || 0,
                          reason: item.reason || '',
                        }))
                      : [],
                    status: ret.status || 'pending_approval',
                    reviewNotes: ret.reviewNotes || '',
                    createdAt: formatDate(ret.createdAt || new Date(), t('language')),
                  }))
                : [],
            };
            dispatch({ type: 'UPDATE_ORDER_STATUS', orderId: data.orderId, status: 'completed', payload: mappedOrder });
            addNotification({
              _id: data.eventId || crypto.randomUUID(),
              type: 'success',
              message: t('notifications.order_completed', {
                orderNumber: data.orderNumber,
                branchName: data.branchName || t('branches.unknown'),
              }),
              data: { orderId: data.orderId, eventId: data.eventId },
              read: false,
              createdAt: new Date().toISOString(),
              sound: '/sounds/notification.mp3',
              vibrate: [400, 100, 400],
            });
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
          if (!data.orderId || !data.orderNumber || !data.branchName || !data.branchId) {
            console.warn(`[${new Date().toISOString()}] Invalid order shipped data:`, data);
            return;
          }
          if (user.role === 'branch' && data.branchId !== user.branchId) return;
          try {
            const updatedOrder = await ordersAPI.getById(data.orderId);
            if (!updatedOrder || !updatedOrder._id) {
              console.warn(`[${new Date().toISOString()}] Failed to fetch updated order:`, data.orderId);
              return;
            }
            const mappedOrder: Order = {
              id: updatedOrder._id,
              orderNumber: updatedOrder.orderNumber || t('orders.unknown'),
              branchName: updatedOrder.branch?.name || t('branches.unknown'),
              branchId: updatedOrder.branch?._id || 'unknown',
              branch: updatedOrder.branch || { _id: 'unknown', name: t('branches.unknown') },
              items: updatedOrder.items.map((item: any) => ({
                _id: item._id || crypto.randomUUID(),
                itemId: item._id || crypto.randomUUID(),
                productId: item.product?._id || 'unknown',
                productName: item.product?.name || t('products.unknown'),
                quantity: Number(item.quantity) || 1,
                price: Number(item.price) || 0,
                unit: translateUnit(item.unit || item.product?.unit),
                department: item.product?.department || { _id: 'unknown', name: t('departments.unknown') },
                status: item.status || 'completed',
                assignedTo: item.assignedTo ? { _id: item.assignedTo._id, username: item.assignedTo.username || t('chefs.unknown'), name: item.assignedTo.name } : undefined,
                returnedQuantity: Number(item.returnedQuantity) || 0,
                returnReason: item.returnReason || '',
              })),
              status: 'in_transit',
              totalAmount: Number(updatedOrder.totalAmount) || 0,
              date: formatDate(updatedOrder.createdAt || new Date(), t('language')),
              notes: updatedOrder.notes || '',
              priority: updatedOrder.priority || 'medium',
              createdBy: updatedOrder.createdBy?.username || t('orders.unknown'),
              statusHistory: Array.isArray(updatedOrder.statusHistory)
                ? updatedOrder.statusHistory.map((history: any) => ({
                    status: history.status || 'pending',
                    changedBy: history.changedBy || t('orders.unknown'),
                    changedAt: formatDate(history.changedAt || new Date(), t('language')),
                    notes: history.notes || '',
                  }))
                : [],
              returns: Array.isArray(updatedOrder.returns)
                ? updatedOrder.returns.map((ret: any) => ({
                    returnId: ret._id || crypto.randomUUID(),
                    items: Array.isArray(ret.items)
                      ? ret.items.map((item: any) => ({
                          productId: item.product?._id || 'unknown',
                          quantity: Number(item.quantity) || 0,
                          reason: item.reason || '',
                        }))
                      : [],
                    status: ret.status || 'pending_approval',
                    reviewNotes: ret.reviewNotes || '',
                    createdAt: formatDate(ret.createdAt || new Date(), t('language')),
                  }))
                : [],
            };
            dispatch({ type: 'UPDATE_ORDER_STATUS', orderId: data.orderId, status: 'in_transit', payload: mappedOrder });
            addNotification({
              _id: data.eventId || crypto.randomUUID(),
              type: 'success',
              message: t('notifications.order_shipped', {
                orderNumber: data.orderNumber,
                branchName: data.branchName || t('branches.unknown'),
              }),
              data: { orderId: data.orderId, eventId: data.eventId },
              read: false,
              createdAt: new Date().toISOString(),
              sound: '/sounds/notification.mp3',
              vibrate: [400, 100, 400],
            });
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
          if (!data.orderId || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid order delivered data:`, data);
            return;
          }
          if (user.role === 'branch' && data.branchId !== user.branchId) return;
          try {
            const updatedOrder = await ordersAPI.getById(data.orderId);
            if (!updatedOrder || !updatedOrder._id) {
              console.warn(`[${new Date().toISOString()}] Failed to fetch updated order:`, data.orderId);
              return;
            }
            const mappedOrder: Order = {
              id: updatedOrder._id,
              orderNumber: updatedOrder.orderNumber || t('orders.unknown'),
              branchName: updatedOrder.branch?.name || t('branches.unknown'),
              branchId: updatedOrder.branch?._id || 'unknown',
              branch: updatedOrder.branch || { _id: 'unknown', name: t('branches.unknown') },
              items: updatedOrder.items.map((item: any) => ({
                _id: item._id || crypto.randomUUID(),
                itemId: item._id || crypto.randomUUID(),
                productId: item.product?._id || 'unknown',
                productName: item.product?.name || t('products.unknown'),
                quantity: Number(item.quantity) || 1,
                price: Number(item.price) || 0,
                unit: translateUnit(item.unit || item.product?.unit),
                department: item.product?.department || { _id: 'unknown', name: t('departments.unknown') },
                status: item.status || 'completed',
                assignedTo: item.assignedTo ? { _id: item.assignedTo._id, username: item.assignedTo.username || t('chefs.unknown'), name: item.assignedTo.name } : undefined,
                returnedQuantity: Number(item.returnedQuantity) || 0,
                returnReason: item.returnReason || '',
              })),
              status: 'delivered',
              totalAmount: Number(updatedOrder.totalAmount) || 0,
              date: formatDate(updatedOrder.createdAt || new Date(), t('language')),
              notes: updatedOrder.notes || '',
              priority: updatedOrder.priority || 'medium',
              createdBy: updatedOrder.createdBy?.username || t('orders.unknown'),
              statusHistory: Array.isArray(updatedOrder.statusHistory)
                ? updatedOrder.statusHistory.map((history: any) => ({
                    status: history.status || 'pending',
                    changedBy: history.changedBy || t('orders.unknown'),
                    changedAt: formatDate(history.changedAt || new Date(), t('language')),
                    notes: history.notes || '',
                  }))
                : [],
              returns: Array.isArray(updatedOrder.returns)
                ? updatedOrder.returns.map((ret: any) => ({
                    returnId: ret._id || crypto.randomUUID(),
                    items: Array.isArray(ret.items)
                      ? ret.items.map((item: any) => ({
                          productId: item.product?._id || 'unknown',
                          quantity: Number(item.quantity) || 0,
                          reason: item.reason || '',
                        }))
                      : [],
                    status: ret.status || 'pending_approval',
                    reviewNotes: ret.reviewNotes || '',
                    createdAt: formatDate(ret.createdAt || new Date(), t('language')),
                  }))
                : [],
            };
            dispatch({ type: 'UPDATE_ORDER_STATUS', orderId: data.orderId, status: 'delivered', payload: mappedOrder });
            addNotification({
              _id: data.eventId || crypto.randomUUID(),
              type: 'success',
              message: t('notifications.order_delivered', {
                orderNumber: data.orderNumber,
                branchName: data.branchName || t('branches.unknown'),
              }),
              data: { orderId: data.orderId, eventId: data.eventId },
              read: false,
              createdAt: new Date().toISOString(),
              sound: '/sounds/notification.mp3',
              vibrate: [400, 100, 400],
            });
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
          if (!data.orderId || !data.returnId || !data.status || !data.orderNumber) {
            console.warn(`[${new Date().toISOString()}] Invalid return status update data:`, data);
            return;
          }
          dispatch({ type: 'RETURN_STATUS_UPDATED', orderId: data.orderId, returnId: data.returnId, status: data.status });
          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'info',
            message: t('notifications.return_status_updated', {
              orderNumber: data.orderNumber,
              status: t(`returns.${data.status}`),
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, returnId: data.returnId, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [200, 100, 200],
          });
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
          if (!data.orderId || !data.itemId || !data.orderNumber || !data.productName) {
            console.warn(`[${new Date().toISOString()}] Invalid missing assignments data:`, data);
            return;
          }
          dispatch({ type: 'MISSING_ASSIGNMENTS', orderId: data.orderId, itemId: data.itemId, productName: data.productName });
          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'warning',
            message: t('notifications.missing_assignments', {
              orderNumber: data.orderNumber,
              productName: data.productName || t('products.unknown'),
              branchName: data.branchName || t('branches.unknown'),
            }),
            data: { orderId: data.orderId, itemId: data.itemId, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [300, 100, 300],
          });
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
    // إعادة جلب المهام عند إعادة الاتصال
    if (stateRef.current.chefId) {
      dispatch({ type: 'SET_PAGE', payload: 1 });
      // Define a simple cache Map if not already available
      const cache = (window as any).orderCache || new Map();
      cache.delete(`${stateRef.current.chefId}-${stateRef.current.page}-${stateRef.current.filter.status}-${stateRef.current.filter.search}`);
      (window as any).orderCache = cache;
      // استدعاء fetchTasks مباشرة (يفترض أن يتم استيراده أو تمريره كمعامل)
      // fetchTasks(true);
    }
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
  }, [socket, user, dispatch, stateRef, t, language, addNotification]);

  return {};
};