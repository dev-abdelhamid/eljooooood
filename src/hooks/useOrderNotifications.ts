import { useCallback, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Order } from '../types/types';
import { formatDate } from '../utils/formatDate';
import { ordersAPI } from '../services/api';

interface SocketEventConfig {
  type: string;
  roles: string[];
}

export const useOrderNotifications = (
  dispatch: React.Dispatch<any>,
  stateRef: React.MutableRefObject<any>,
  user: any
) => {
  const { socket } = useSocket();
  const { t } = useLanguage();

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
              department: item.product?.department || { _id: 'unknown', name: t('departments.unknown') },
              status: item.status || 'pending',
              assignedTo: item.assignedTo ? { _id: item.assignedTo._id, username: item.assignedTo.username || t('chefs.unknown') } : undefined,
              returnedQuantity: Number(item.returnedQuantity) || 0,
              returnReason: item.returnReason || '',
            })),
            status: newOrder.status || 'pending',
            totalAmount: Number(newOrder.totalAmount) || 0,
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
        },
        config: {
          type: 'ADD_ORDER',
          roles: ['admin', 'branch', 'production'],
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
        config: {
          type: 'UPDATE_ORDER_STATUS',
          roles: ['admin', 'branch'],
        },
      },
      {
        name: 'taskAssigned',
        handler: (data: any) => {
          if (!['admin', 'production', 'chef'].includes(user.role)) return;
          if (!data.orderId || !data.orderNumber || !Array.isArray(data.items) || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid task assigned data:`, data);
            return;
          }
          if (user.role === 'chef' && !data.items.some((item: any) => item.assignedTo?._id === user._id)) return;

          const mappedItems = data.items.map((item: any) => ({
            _id: item.itemId || crypto.randomUUID(),
            itemId: item.itemId || crypto.randomUUID(),
            productId: item.productId || 'unknown',
            productName: item.productName || t('products.unknown'),
            quantity: Number(item.quantity) || 1,
            department: item.department || { _id: 'unknown', name: t('departments.unknown') },
            status: item.status || 'assigned',
            assignedTo: item.assignedTo
              ? { _id: item.assignedTo._id, username: item.assignedTo.username || t('chefs.unknown') }
              : undefined,
          }));

          dispatch({ type: 'TASK_ASSIGNED', orderId: data.orderId, items: mappedItems });
        },
        config: {
          type: 'TASK_ASSIGNED',
          roles: ['admin', 'production', 'chef'],
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
        handler: (data: any) => {
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.status || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid order status update data:`, data);
            return;
          }
          dispatch({ type: 'UPDATE_ORDER_STATUS', orderId: data.orderId, status: data.status });
        },
        config: {
          type: 'UPDATE_ORDER_STATUS',
          roles: ['admin', 'branch', 'production'],
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
                department: item.product?.department || { _id: 'unknown', name: t('departments.unknown') },
                status: item.status || 'completed',
                assignedTo: item.assignedTo ? { _id: item.assignedTo._id, username: item.assignedTo.username || t('chefs.unknown') } : undefined,
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
        config: {
          type: 'UPDATE_ORDER_STATUS',
          roles: ['admin', 'branch', 'production'],
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
                department: item.product?.department || { _id: 'unknown', name: t('departments.unknown') },
                status: item.status || 'completed',
                assignedTo: item.assignedTo ? { _id: item.assignedTo._id, username: item.assignedTo.username || t('chefs.unknown') } : undefined,
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
        config: {
          type: 'UPDATE_ORDER_STATUS',
          roles: ['admin', 'branch', 'production'],
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
                department: item.product?.department || { _id: 'unknown', name: t('departments.unknown') },
                status: item.status || 'completed',
                assignedTo: item.assignedTo ? { _id: item.assignedTo._id, username: item.assignedTo.username || t('chefs.unknown') } : undefined,
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
        config: {
          type: 'UPDATE_ORDER_STATUS',
          roles: ['admin', 'branch', 'production'],
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
        config: {
          type: 'RETURN_STATUS_UPDATED',
          roles: ['admin', 'branch', 'production'],
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
  }, [socket, user, dispatch, stateRef, t]);

  return {};
};
