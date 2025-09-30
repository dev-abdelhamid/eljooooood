import { useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ordersAPI } from '../services/api';
import { Order } from '../types/types';
import { formatDate } from '../utils/formatDate';
import { useNotifications } from '../contexts/NotificationContext';

interface SocketEventData {
  orderId: string;
  orderNumber: string;
  branchName?: string;
  branchId?: string;
  items?: Array<{
    _id: string;
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

export const useOrderNotifications = (
  dispatch: React.Dispatch<any>,
  stateRef: React.MutableRefObject<any>,
  user: any
) => {
  const { socket } = useSocket();
  const { t } = useLanguage();
  const { addNotification } = useNotifications();

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
    return unit && translations[unit] ? translations[unit][t('language') as 'ar' | 'en'] : t('language') === 'ar' ? 'وحدة' : 'unit';
  };

  useEffect(() => {
    if (!socket || !user) {
      console.warn(`[${new Date().toISOString()}] Socket or user not available`);
      return;
    }

    const events = [
      {
        name: 'orderCreated',
        handler: async (data: any) => {
          if (!data?._id || !Array.isArray(data.items) || !data.orderNumber || !data.branch?.name) {
            console.warn(`[${new Date().toISOString()}] Invalid order data:`, data);
            return;
          }
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          const currentState = stateRef.current;
          if (currentState.filterStatus && data.status !== currentState.filterStatus) return;
          if (currentState.filterBranch && data.branch?._id !== currentState.filterBranch) return;
          if (user.role === 'production' && user.departmentId && !data.items.some((item: any) => item?.product?.department?._id === user.departmentId)) return;
          if (user.role === 'branch' && data.branch?._id !== user.branchId) return;

          const mappedOrder: Order = {
            id: data._id,
            orderNumber: data.orderNumber || t('orders.unknown'),
            branchName: data.branch?.name || t('branches.unknown'),
            branchId: data.branch?._id || 'unknown',
            branch: data.branch || { _id: 'unknown', name: t('branches.unknown') },
            items: data.items.map((item: any) => ({
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
            status: data.status || 'pending',
            totalAmount: Number(data.totalAmount) || 0,
            adjustedTotal: typeof data.adjustedTotal === 'number' ? data.adjustedTotal : Number(data.totalAmount) || 0,
            date: formatDate(data.createdAt || new Date(), t('language')),
            notes: data.notes || '',
            priority: data.priority || 'medium',
            createdBy: data.createdBy?.username || t('orders.unknown'),
            statusHistory: Array.isArray(data.statusHistory)
              ? data.statusHistory.map((history: any) => ({
                  status: history.status || 'pending',
                  changedBy: history.changedBy || t('orders.unknown'),
                  changedAt: formatDate(history.changedAt || new Date(), t('language')),
                  notes: history.notes || '',
                }))
              : [],
            returns: Array.isArray(data.returns)
              ? data.returns.map((ret: any) => ({
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
        },
      },
      {
        name: 'orderConfirmed',
        handler: (data: any) => {
          if (!['admin', 'branch'].includes(user.role)) return;
          if (!data.orderId || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid order confirmed data:`, data);
            return;
          }
          if (user.role === 'branch' && data.branchId !== user.branchId) return;
          dispatch({ type: 'UPDATE_ORDER_STATUS', orderId: data.orderId, status: 'confirmed' });
        },
      },
      {
        name: 'taskAssigned',
        handler: (data: any) => {
          if (!data.orderId || !data.orderNumber || !Array.isArray(data.items) || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid task assigned data:`, data);
            return;
          }
          if (!['admin', 'production', 'chef'].includes(user.role)) return;
          if (user.role === 'chef' && !data.items.some((item: any) => item.assignedTo?._id === user._id)) return;

          const mappedItems = data.items
            .filter((item: any) => item._id && item.product?.name && item.assignedTo?._id)
            .map((item: any) => ({
              _id: item._id,
              itemId: item._id,
              productId: item.product?._id || 'unknown',
              productName: item.product?.name || t('products.unknown'),
              quantity: Number(item.quantity) || 1,
              unit: translateUnit(item.unit || item.product?.unit),
              department: item.product?.department || { _id: 'unknown', name: t('departments.unknown') },
              status: item.status || 'pending',
              assignedTo: item.assignedTo ? { _id: item.assignedTo._id, username: item.assignedTo.username, name: item.assignedTo.name } : undefined,
            }));

          if (mappedItems.length === 0) {
            console.warn(`[${new Date().toISOString()}] No valid items for taskAssigned:`, data);
            return;
          }
          dispatch({ type: 'TASK_ASSIGNED', payload: { orderId: data.orderId, items: mappedItems, orderNumber: data.orderNumber, branchName: data.branchName } });
        },
      },
      {
        name: 'itemStatusUpdated',
        handler: async (data: any) => {
          if (!['admin', 'production', 'chef'].includes(user.role)) return;
          if (!data.orderId || !data.itemId || !data.status || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid item status update data:`, data);
            return;
          }
          if (user.role === 'chef' && data.chefId !== user._id) return;

          dispatch({ type: 'UPDATE_ITEM_STATUS', payload: { orderId: data.orderId, itemId: data.itemId, status: data.status } });

          try {
            const updatedOrder = await ordersAPI.getById(data.orderId);
            if (!updatedOrder || !updatedOrder._id || !Array.isArray(updatedOrder.items)) {
              console.warn(`[${new Date().toISOString()}] Failed to fetch updated order:`, data.orderId);
              return;
            }
            if (updatedOrder.items.every((item: any) => item.status === 'completed') && updatedOrder.status !== 'completed') {
              dispatch({ type: 'UPDATE_ORDER_STATUS', orderId: data.orderId, status: 'completed' });
            }
          } catch (err) {
            console.error(`[${new Date().toISOString()}] Failed to fetch updated order:`, err);
          }
        },
      },
      {
        name: 'orderStatusUpdated',
        handler: (data: any) => {
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.status || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid order status update data:`, data);
            return;
          }
          dispatch({ type: 'UPDATE_ORDER_STATUS', orderId: data.orderId, status: data.status });
        },
      },
      {
        name: 'orderCompleted',
        handler: async (data: any) => {
          if (!['admin', 'branch', 'production', 'chef'].includes(user.role)) return;
          if (!data.orderId || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid order completed data:`, data);
            return;
          }
          try {
            const updatedOrder = await ordersAPI.getById(data.orderId);
            if (!updatedOrder || !updatedOrder._id) return;
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
          } catch (err) {
            console.error(`[${new Date().toISOString()}] Failed to fetch updated order:`, err);
          }
        },
      },
      {
        name: 'orderShipped',
        handler: async (data: any) => {
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.orderNumber || !data.branchName || !data.branchId) {
            console.warn(`[${new Date().toISOString()}] Invalid order shipped data:`, data);
            return;
          }
          if (user.role === 'branch' && data.branchId !== user.branchId) return;
          try {
            const updatedOrder = await ordersAPI.getById(data.orderId);
            if (!updatedOrder || !updatedOrder._id) return;
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
          } catch (err) {
            console.error(`[${new Date().toISOString()}] Failed to fetch updated order:`, err);
          }
        },
      },
      {
        name: 'orderDelivered',
        handler: async (data: any) => {
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid order delivered data:`, data);
            return;
          }
          if (user.role === 'branch' && data.branchId !== user.branchId) return;
          try {
            const updatedOrder = await ordersAPI.getById(data.orderId);
            if (!updatedOrder || !updatedOrder._id) return;
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
          } catch (err) {
            console.error(`[${new Date().toISOString()}] Failed to fetch updated order:`, err);
          }
        },
      },
      {
        name: 'returnStatusUpdated',
        handler: (data: any) => {
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.returnId || !data.status || !data.orderNumber) {
            console.warn(`[${new Date().toISOString()}] Invalid return status update data:`, data);
            return;
          }
          dispatch({ type: 'RETURN_STATUS_UPDATED', orderId: data.orderId, returnId: data.returnId, status: data.status });
        },
      },
      {
        name: 'missingAssignments',
        handler: (data: any) => {
          if (!['admin', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.itemId || !data.orderNumber || !data.productName) {
            console.warn(`[${new Date().toISOString()}] Invalid missing assignments data:`, data);
            return;
          }
          dispatch({ type: 'MISSING_ASSIGNMENTS', orderId: data.orderId, itemId: data.itemId, productName: data.productName });
        },
      },
    ];

    events.forEach(({ name, handler }) => socket.on(name, handler));
    return () => {
      events.forEach(({ name, handler }) => socket.off(name, handler));
    };
  }, [socket, user, dispatch, stateRef, t]);
};