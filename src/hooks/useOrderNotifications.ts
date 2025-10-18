import { useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Order, FactoryOrder } from '../types/types';
import { formatDate } from '../utils/formatDate';
import { ordersAPI, factoryOrdersAPI } from '../services/api';

interface SocketEventData {
  orderId?: string;
  factoryOrderId?: string;
  orderNumber?: string;
  factoryOrderNumber?: string;
  branchName?: string;
  branchId?: string;
  items?: Array<{
    _id: string;
    product?: { _id: string; name: string; nameEn?: string; unit?: string; unitEn?: string; department?: { _id: string; name: string; nameEn?: string } };
    quantity?: number;
    price?: number;
    status?: string;
    assignedTo?: { _id: string; name?: string; nameEn?: string };
  }>;
  eventId?: string;
  status?: string;
  returnId?: string;
  itemId?: string;
  taskId?: string;
  productName?: string;
  chefId?: string;
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

  const translateUnit = (unit: string | undefined) => {
    const translations: Record<string, { ar: string; en: string }> = {
      'كيلو': { ar: 'كيلو', en: 'kg' },
      'قطعة': { ar: 'قطعة', en: 'piece' },
      'علبة': { ar: 'علبة', en: 'pack' },
      'صينية': { ar: 'صينية', en: 'tray' },
    };
    return unit && translations[unit] ? (isRtl ? translations[unit].ar : translations[unit].en) : isRtl ? 'وحدة' : 'unit';
  };

  useEffect(() => {
    if (!socket || !user) return;

    socket.emit('joinRoom', {
      role: user.role,
      branchId: user.branchId,
      chefId: user.role === 'chef' ? user.id : undefined,
      departmentId: user.role === 'production' ? user.department?._id : undefined,
      userId: user.id,
    });

    const events = [
      // Existing branch order events
      {
        name: 'orderCreated',
        handler: (data: SocketEventData) => {
          if (!data.orderId || !data.orderNumber || !data.branchName || !Array.isArray(data.items)) return;
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (user.role === 'branch' && data.branchId !== user.branchId) return;
          if (user.role === 'production' && !data.items.some((item: any) => item.product?.department?._id === user.department?._id)) return;
          if (stateRef.current.filterStatus && data.status !== stateRef.current.filterStatus) return;
          if (stateRef.current.filterBranch && data.branchId !== stateRef.current.filterBranch) return;

          const mappedOrder: Order = {
            id: data.orderId,
            orderNumber: data.orderNumber,
            branchId: data.branchId || 'unknown',
            branch: {
              _id: data.branchId || 'unknown',
              name: data.branchName || t('branches.unknown'),
              nameEn: data.branchName,
              displayName: isRtl ? data.branchName : data.branchName || data.branchName,
            },
            items: data.items.map((item: any) => ({
              _id: item._id || crypto.randomUUID(),
              productId: item.product?._id || 'unknown',
              productName: item.product?.name || t('products.unknown'),
              productNameEn: item.product?.nameEn,
              displayProductName: isRtl ? item.product?.name : item.product?.nameEn || item.product?.name,
              quantity: Number(item.quantity) || 1,
              price: Number(item.price) || 0,
              unit: translateUnit(item.unit || item.product?.unit),
              unitEn: item.product?.unitEn,
              displayUnit: translateUnit(item.unit || item.product?.unit),
              department: {
                _id: item.product?.department?._id || 'unknown',
                name: item.product?.department?.name || t('departments.unknown'),
                nameEn: item.product?.department?.nameEn,
                displayName: isRtl ? item.product?.department?.name : item.product?.department?.nameEn || item.product?.department?.name,
              },
              status: item.status || 'pending',
              assignedTo: item.assignedTo ? { _id: item.assignedTo._id, name: item.assignedTo.name || t('chefs.unknown') } : undefined,
              returnedQuantity: Number(item.returnedQuantity) || 0,
              returnReason: item.returnReason || '',
            })),
            status: data.status || 'pending',
            totalAmount: Number(data.totalAmount) || 0,
            adjustedTotal: Number(data.adjustedTotal) || 0,
            date: formatDate(data.createdAt || new Date(), language),
            notes: data.notes || '',
            priority: data.priority || 'medium',
            createdBy: data.createdBy?.name || t('orders.unknown'),
            statusHistory: data.statusHistory || [],
            returns: data.returns || [],
          };

          dispatch({ type: 'ADD_ORDER', payload: mappedOrder });
          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'success',
            message: t('notifications.order_created', { orderNumber: data.orderNumber, branchName: data.branchName }),
            data: { orderId: data.orderId, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
          });
        },
      },
      {
        name: 'orderConfirmed',
        handler: (data: SocketEventData) => {
          if (!data.orderId || !data.orderNumber || !data.branchName) return;
          if (!['admin', 'branch'].includes(user.role)) return;
          if (user.role === 'branch' && data.branchId !== user.branchId) return;

          dispatch({ type: 'UPDATE_ORDER_STATUS', orderId: data.orderId, status: 'confirmed' });
          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'success',
            message: t('notifications.order_confirmed', { orderNumber: data.orderNumber, branchName: data.branchName }),
            data: { orderId: data.orderId, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
          });
        },
      },
      {
        name: 'taskAssigned',
        handler: (data: SocketEventData) => {
          if (!data.orderId || !data.orderNumber || !Array.isArray(data.items) || !data.branchName) return;
          if (!['admin', 'production', 'chef'].includes(user.role)) return;
          if (user.role === 'chef' && !data.items.some((item: any) => item.assignedTo?._id === user.id)) return;

          const mappedItems = data.items
            .filter((item: any) => item._id && item.product?.name && item.quantity && item.assignedTo?._id)
            .map((item: any) => ({
              _id: item._id,
              productId: item.product?._id || 'unknown',
              productName: item.product?.name || t('products.unknown'),
              quantity: Number(item.quantity) || 1,
              unit: translateUnit(item.unit || item.product?.unit),
              department: item.product?.department || { _id: 'unknown', name: t('departments.unknown') },
              status: item.status || 'pending',
              assignedTo: item.assignedTo ? { _id: item.assignedTo._id, name: item.assignedTo.name || t('chefs.unknown') } : undefined,
            }));

          if (mappedItems.length === 0) return;

          dispatch({ type: 'TASK_ASSIGNED', payload: { orderId: data.orderId, items: mappedItems } });
          mappedItems.forEach((item: any) => {
            addNotification({
              _id: `${data.eventId || crypto.randomUUID()}-${item._id}`,
              type: 'info',
              message: t('notifications.task_assigned_to_chef', {
                chefName: item.assignedTo?.name || t('chefs.unknown'),
                productName: item.productName,
                quantity: item.quantity,
                unit: item.unit,
                orderNumber: data.orderNumber,
                branchName: data.branchName,
              }),
              data: { orderId: data.orderId, itemId: item._id, eventId: data.eventId },
              read: false,
              createdAt: new Date().toISOString(),
            });
          });
        },
      },
      {
        name: 'itemStatusUpdated',
        handler: async (data: SocketEventData) => {
          if (!data.orderId || !data.itemId || !data.status || !data.orderNumber || !data.branchName) return;
          if (!['admin', 'production', 'chef'].includes(user.role)) return;
          if (user.role === 'chef' && data.chefId !== user.id) return;

          dispatch({ type: 'UPDATE_ITEM_STATUS', payload: { orderId: data.orderId, itemId: data.itemId, status: data.status } });

          try {
            const updatedOrder = await ordersAPI.getById(data.orderId);
            if (!updatedOrder || !Array.isArray(updatedOrder.items)) return;
            if (updatedOrder.items.every((item: any) => item.status === 'completed') && updatedOrder.status !== 'completed') {
              dispatch({ type: 'UPDATE_ORDER_STATUS', orderId: data.orderId, status: 'completed' });
              addNotification({
                _id: data.eventId || crypto.randomUUID(),
                type: 'success',
                message: t('notifications.order_completed', { orderNumber: data.orderNumber, branchName: data.branchName }),
                data: { orderId: data.orderId, eventId: data.eventId },
                read: false,
                createdAt: new Date().toISOString(),
              });
            }
          } catch {
            console.error(`[${new Date().toISOString()}] Failed to fetch updated order:`, data.orderId);
          }
        },
      },
      {
        name: 'orderStatusUpdated',
        handler: (data: SocketEventData) => {
          if (!data.orderId || !data.status || !data.orderNumber || !data.branchName) return;
          if (!['admin', 'branch', 'production'].includes(user.role)) return;

          dispatch({ type: 'UPDATE_ORDER_STATUS', orderId: data.orderId, status: data.status });
          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'info',
            message: t('notifications.order_status_updated', {
              orderNumber: data.orderNumber,
              status: t(`order_status.${data.status}`),
              branchName: data.branchName,
            }),
            data: { orderId: data.orderId, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
          });
        },
      },
      {
        name: 'orderCompleted',
        handler: (data: SocketEventData) => {
          if (!data.orderId || !data.orderNumber || !data.branchName) return;
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (user.role === 'branch' && data.branchId !== user.branchId) return;

          dispatch({ type: 'UPDATE_ORDER_STATUS', orderId: data.orderId, status: 'completed' });
          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'success',
            message: t('notifications.order_completed', { orderNumber: data.orderNumber, branchName: data.branchName }),
            data: { orderId: data.orderId, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
          });
        },
      },
      {
        name: 'orderShipped',
        handler: (data: SocketEventData) => {
          if (!data.orderId || !data.orderNumber || !data.branchName || !data.branchId) return;
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (user.role === 'branch' && data.branchId !== user.branchId) return;

          dispatch({ type: 'UPDATE_ORDER_STATUS', orderId: data.orderId, status: 'in_transit' });
          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'success',
            message: t('notifications.order_shipped', { orderNumber: data.orderNumber, branchName: data.branchName }),
            data: { orderId: data.orderId, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
          });
        },
      },
      {
        name: 'orderDelivered',
        handler: (data: SocketEventData) => {
          if (!data.orderId || !data.orderNumber || !data.branchName) return;
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (user.role === 'branch' && data.branchId !== user.branchId) return;

          dispatch({ type: 'UPDATE_ORDER_STATUS', orderId: data.orderId, status: 'delivered' });
          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'success',
            message: t('notifications.order_delivered', { orderNumber: data.orderNumber, branchName: data.branchName }),
            data: { orderId: data.orderId, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
          });
        },
      },
      {
        name: 'returnStatusUpdated',
        handler: (data: SocketEventData) => {
          if (!data.orderId || !data.returnId || !data.status || !data.orderNumber) return;
          if (!['admin', 'branch', 'production'].includes(user.role)) return;

          dispatch({ type: 'RETURN_STATUS_UPDATED', orderId: data.orderId, returnId: data.returnId, status: data.status });
          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'info',
            message: t('notifications.return_status_updated', {
              orderNumber: data.orderNumber,
              status: t(`returns.${data.status}`),
              branchName: data.branchName,
            }),
            data: { orderId: data.orderId, returnId: data.returnId, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
          });
        },
      },
      {
        name: 'missingAssignments',
        handler: (data: SocketEventData) => {
          if (!data.orderId || !data.itemId || !data.orderNumber || !data.productName) return;
          if (!['admin', 'production'].includes(user.role)) return;

          dispatch({ type: 'MISSING_ASSIGNMENTS', orderId: data.orderId, itemId: data.itemId, productName: data.productName });
          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'warning',
            message: t('notifications.missing_assignments', {
              orderNumber: data.orderNumber,
              productName: data.productName,
              branchName: data.branchName,
            }),
            data: { orderId: data.orderId, itemId: data.itemId, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
          });
        },
      },
      // New factory order events
      {
        name: 'factoryOrderCreated',
        handler: (data: SocketEventData) => {
          if (!data.factoryOrderId || !data.factoryOrderNumber || !Array.isArray(data.items)) return;
          if (!['admin', 'production'].includes(user.role)) return;
          if (user.role === 'production' && !data.items.some((item: any) => item.product?.department?._id === user.department?._id)) return;
          if (stateRef.current.filterStatus && data.status !== stateRef.current.filterStatus) return;

          const mappedOrder: FactoryOrder = {
            id: data.factoryOrderId,
            orderNumber: data.factoryOrderNumber,
            items: data.items.map((item: any) => ({
              _id: item._id || crypto.randomUUID(),
              productId: item.product?._id || 'unknown',
              productName: item.product?.name || t('products.unknown'),
              productNameEn: item.product?.nameEn,
              displayProductName: isRtl ? item.product?.name : item.product?.nameEn || item.product?.name,
              quantity: Number(item.quantity) || 1,
              unit: translateUnit(item.unit || item.product?.unit),
              unitEn: item.product?.unitEn,
              displayUnit: translateUnit(item.unit || item.product?.unit),
              department: {
                _id: item.product?.department?._id || 'unknown',
                name: item.product?.department?.name || t('departments.unknown'),
                nameEn: item.product?.department?.nameEn,
                displayName: isRtl ? item.product?.department?.name : item.product?.department?.nameEn || item.product?.department?.name,
              },
              status: item.status || 'pending',
              assignedTo: item.assignedTo ? { _id: item.assignedTo._id, name: item.assignedTo.name || t('chefs.unknown'), nameEn: item.assignedTo.nameEn } : undefined,
            })),
            status: data.status || 'pending',
            date: formatDate(data.createdAt || new Date(), language),
            notes: data.notes || '',
            priority: data.priority || 'medium',
            createdBy: data.createdBy?.name || t('orders.unknown'),
            statusHistory: data.statusHistory || [],
          };

          dispatch({ type: 'ADD_FACTORY_ORDER', payload: mappedOrder });
          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'success',
            message: t('notifications.factory_order_created', { orderNumber: data.factoryOrderNumber }),
            data: { factoryOrderId: data.factoryOrderId, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
          });
        },
      },
      {
        name: 'factoryTaskAssigned',
        handler: (data: SocketEventData) => {
          if (!data.factoryOrderId || !data.factoryOrderNumber || !Array.isArray(data.items)) return;
          if (!['admin', 'production', 'chef'].includes(user.role)) return;
          if (user.role === 'chef' && !data.items.some((item: any) => item.assignedTo?._id === user.id)) return;

          const mappedItems = data.items
            .filter((item: any) => item._id && item.product?.name && item.quantity && item.assignedTo?._id)
            .map((item: any) => ({
              _id: item._id,
              productId: item.product?._id || 'unknown',
              productName: item.product?.name || t('products.unknown'),
              productNameEn: item.product?.nameEn,
              displayProductName: isRtl ? item.product?.name : item.product?.nameEn || item.product?.name,
              quantity: Number(item.quantity) || 1,
              unit: translateUnit(item.unit || item.product?.unit),
              unitEn: item.product?.unitEn,
              displayUnit: translateUnit(item.unit || item.product?.unit),
              department: item.product?.department || { _id: 'unknown', name: t('departments.unknown'), nameEn: item.product?.department?.nameEn },
              status: item.status || 'pending',
              assignedTo: item.assignedTo ? { _id: item.assignedTo._id, name: item.assignedTo.name || t('chefs.unknown'), nameEn: item.assignedTo.nameEn } : undefined,
            }));

          if (mappedItems.length === 0) return;

          dispatch({ type: 'FACTORY_TASK_ASSIGNED', payload: { factoryOrderId: data.factoryOrderId, items: mappedItems } });
          mappedItems.forEach((item: any) => {
            addNotification({
              _id: `${data.eventId || crypto.randomUUID()}-${item._id}`,
              type: 'info',
              message: t('notifications.factory_task_assigned_to_chef', {
                chefName: item.assignedTo?.name || t('chefs.unknown'),
                productName: item.productName,
                quantity: item.quantity,
                unit: item.unit,
                orderNumber: data.factoryOrderNumber,
              }),
              data: { factoryOrderId: data.factoryOrderId, itemId: item._id, eventId: data.eventId },
              read: false,
              createdAt: new Date().toISOString(),
            });
          });
        },
      },
      {
        name: 'factoryItemStatusUpdated',
        handler: async (data: SocketEventData) => {
          if (!data.factoryOrderId || !data.itemId || !data.status || !data.factoryOrderNumber) return;
          if (!['admin', 'production', 'chef'].includes(user.role)) return;
          if (user.role === 'chef' && data.chefId !== user.id) return;

          dispatch({ type: 'UPDATE_FACTORY_ITEM_STATUS', payload: { factoryOrderId: data.factoryOrderId, itemId: data.itemId, status: data.status } });

          try {
            const updatedOrder = await factoryOrdersAPI.getById(data.factoryOrderId);
            if (!updatedOrder || !Array.isArray(updatedOrder.items)) return;
            if (updatedOrder.items.every((item: any) => item.status === 'completed') && updatedOrder.status !== 'completed') {
              dispatch({ type: 'UPDATE_FACTORY_ORDER_STATUS', factoryOrderId: data.factoryOrderId, status: 'completed' });
              addNotification({
                _id: data.eventId || crypto.randomUUID(),
                type: 'success',
                message: t('notifications.factory_order_completed', { orderNumber: data.factoryOrderNumber }),
                data: { factoryOrderId: data.factoryOrderId, eventId: data.eventId },
                read: false,
                createdAt: new Date().toISOString(),
              });
            }
          } catch {
            console.error(`[${new Date().toISOString()}] Failed to fetch updated factory order:`, data.factoryOrderId);
          }
        },
      },
      {
        name: 'factoryOrderCompleted',
        handler: (data: SocketEventData) => {
          if (!data.factoryOrderId || !data.factoryOrderNumber) return;
          if (!['admin', 'production'].includes(user.role)) return;

          dispatch({ type: 'UPDATE_FACTORY_ORDER_STATUS', factoryOrderId: data.factoryOrderId, status: 'completed' });
          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: 'success',
            message: t('notifications.factory_order_completed', { orderNumber: data.factoryOrderNumber }),
            data: { factoryOrderId: data.factoryOrderId, eventId: data.eventId },
            read: false,
            createdAt: new Date().toISOString(),
          });
        },
      },
    ];

    events.forEach(({ name, handler }) => socket.on(name, handler));
    return () => events.forEach(({ name, handler }) => socket.off(name, handler));
  }, [socket, user, dispatch, stateRef, t, language, addNotification]);
};