import { useCallback, useEffect } from 'react';
import { useNotifications } from '../contexts/NotificationProvider';
import { useLanguage } from '../contexts/LanguageContext';
import { Order, NotificationType } from '../types/types';
import { formatDate } from '../utils/formatDate';
import { ordersAPI } from '../services/api';
import { addOrder, updateOrderStatus, taskAssigned, updateItemStatus, returnStatusUpdated, missingAssignments, setSocketConnected, setSocketError } from '../store/ordersSlice';

interface SocketEventConfig {
  type: string;
  roles: string[];
}

export const useOrderNotifications = (
  dispatch: React.Dispatch<any>,
  stateRef: React.MutableRefObject<any>,
  user: any
) => {
  const { socket, isConnected, addNotification } = useNotifications();
  const { t } = useLanguage();
  const isRtl = t('language') === 'ar';

  useEffect(() => {
    if (!socket || !user || !isConnected) {
      console.warn(`[${new Date().toISOString()}] Socket, user, or connection not available`);
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
            console.warn(`[${new Date().toISOString()}] Invalid orderCreated data:`, newOrder);
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
            branchNameEn: newOrder.branch?.nameEn,
            branchId: newOrder.branch?._id || 'unknown',
            branch: newOrder.branch || { _id: 'unknown', name: t('branches.unknown'), displayName: t('branches.unknown') },
            items: newOrder.items.map((item: any) => ({
              _id: item._id || crypto.randomUUID(),
              itemId: item._id || crypto.randomUUID(),
              productId: item.product?._id || 'unknown',
              productName: item.product?.name || t('products.unknown'),
              productNameEn: item.product?.nameEn,
              quantity: Number(item.quantity) || 1,
              price: Number(item.price) || 0,
              unit: item.unit || 'unit',
              unitEn: item.unitEn,
              displayUnit: isRtl ? item.unit : (item.unitEn || item.unit),
              department: item.product?.department || { _id: 'unknown', name: t('departments.unknown'), displayName: t('departments.unknown') },
              status: item.status || ItemStatus.Pending,
              assignedTo: item.assignedTo ? { _id: item.assignedTo._id, username: item.assignedTo.username || t('chefs.unknown'), name: item.assignedTo.name, displayName: isRtl ? item.assignedTo.name : (item.assignedTo.nameEn || item.assignedTo.name), department: item.assignedTo.department } : undefined,
              returnedQuantity: Number(item.returnedQuantity) || 0,
              returnReason: item.returnReason || '',
              returnReasonEn: item.returnReasonEn,
              displayReturnReason: isRtl ? item.returnReason : (item.returnReasonEn || item.returnReason),
            })),
            status: newOrder.status || OrderStatus.Pending,
            totalAmount: Number(newOrder.totalAmount) || 0,
            adjustedTotal: Number(newOrder.adjustedTotal) || 0,
            date: formatDate(newOrder.createdAt || new Date(), t('language')),
            requestedDeliveryDate: formatDate(newOrder.requestedDeliveryDate || new Date(), t('language')),
            notes: newOrder.notes || '',
            notesEn: newOrder.notesEn,
            displayNotes: isRtl ? newOrder.notes : (newOrder.notesEn || newOrder.notes),
            priority: newOrder.priority || Priority.Medium,
            createdBy: newOrder.createdBy?.username || t('orders.unknown'),
            createdByName: isRtl ? newOrder.createdBy?.name : (newOrder.createdBy?.nameEn || newOrder.createdBy?.name || t('orders.unknown')),
            statusHistory: Array.isArray(newOrder.statusHistory)
              ? newOrder.statusHistory.map((history: any) => ({
                  status: history.status || OrderStatus.Pending,
                  changedBy: history.changedBy || t('orders.unknown'),
                  changedByName: isRtl ? history.changedByName : (history.changedByNameEn || history.changedByName || t('orders.unknown')),
                  changedAt: formatDate(history.changedAt || new Date(), t('language')),
                  notes: history.notes || '',
                  notesEn: history.notesEn,
                  displayNotes: isRtl ? history.notes : (history.notesEn || history.notes),
                }))
              : [],
            returns: Array.isArray(newOrder.returns)
              ? newOrder.returns.map((ret: any) => ({
                  returnId: ret._id || crypto.randomUUID(),
                  returnNumber: ret.returnNumber || 'unknown',
                  items: Array.isArray(ret.items)
                    ? ret.items.map((item: any) => ({
                        productId: item.product?._id || item.productId || 'unknown',
                        productName: item.product?.name || item.productName || t('products.unknown'),
                        productNameEn: item.product?.nameEn || item.productNameEn,
                        quantity: Number(item.quantity) || 0,
                        unit: item.unit || 'unit',
                        unitEn: item.unitEn,
                        displayUnit: isRtl ? item.unit : (item.unitEn || item.unit),
                        reason: item.reason || '',
                        reasonEn: item.reasonEn,
                        displayReason: isRtl ? item.reason : (item.reasonEn || item.reason),
                        status: item.status || ReturnStatus.PendingApproval,
                        reviewNotes: item.reviewNotes || '',
                        reviewNotesEn: item.reviewNotesEn,
                        displayReviewNotes: isRtl ? item.reviewNotes : (item.reviewNotesEn || item.reviewNotes),
                      }))
                    : [],
                  status: ret.status || ReturnStatus.PendingApproval,
                  reviewNotes: ret.reviewNotes || '',
                  reviewNotesEn: ret.reviewNotesEn,
                  displayReviewNotes: isRtl ? ret.reviewNotes : (ret.reviewNotesEn || ret.reviewNotes),
                  createdAt: formatDate(ret.createdAt || new Date(), t('language')),
                  createdBy: ret.createdBy ? { _id: ret.createdBy._id, username: ret.createdBy.username, name: ret.createdBy.name, nameEn: ret.createdBy.nameEn, displayName: isRtl ? ret.createdBy.name : (ret.createdBy.nameEn || ret.createdBy.name) } : { _id: 'unknown', username: t('orders.unknown'), name: t('orders.unknown'), displayName: t('orders.unknown') },
                  reviewedBy: ret.reviewedBy ? { _id: ret.reviewedBy._id, username: ret.reviewedBy.username, name: ret.reviewedBy.name, nameEn: ret.reviewedBy.nameEn, displayName: isRtl ? ret.reviewedBy.name : (ret.reviewedBy.nameEn || ret.reviewedBy.name) } : undefined,
                }))
              : [],
            approvedBy: newOrder.approvedBy ? { _id: newOrder.approvedBy._id, name: newOrder.approvedBy.name, nameEn: newOrder.approvedBy.nameEn, displayName: isRtl ? newOrder.approvedBy.name : (newOrder.approvedBy.nameEn || newOrder.approvedBy.name) } : undefined,
            approvedAt: newOrder.approvedAt,
            deliveredAt: newOrder.deliveredAt,
            transitStartedAt: newOrder.transitStartedAt,
            isRtl,
          };

          dispatch(addOrder(mappedOrder));

          addNotification({
            _id: newOrder.eventId || crypto.randomUUID(),
            type: NotificationType.OrderCreated,
            displayType: 'success',
            message: t('notifications.order_created', {
              orderNumber: newOrder.orderNumber,
              branchName: isRtl ? newOrder.branch?.name : (newOrder.branch?.nameEn || newOrder.branch?.name),
            }),
            messageEn: t('notifications.order_created', {
              orderNumber: newOrder.orderNumber,
              branchName: newOrder.branch?.nameEn || newOrder.branch?.name,
            }, 'en'),
            displayMessage: isRtl ? t('notifications.order_created', {
              orderNumber: newOrder.orderNumber,
              branchName: newOrder.branch?.name,
            }) : t('notifications.order_created', {
              orderNumber: newOrder.orderNumber,
              branchName: newOrder.branch?.nameEn || newOrder.branch?.name,
            }, 'en'),
            data: {
              orderId: newOrder._id,
              orderNumber: newOrder.orderNumber,
              branchId: newOrder.branch?._id,
              eventId: newOrder.eventId || crypto.randomUUID(),
              priority: newOrder.priority,
            },
            read: false,
            createdAt: newOrder.createdAt || new Date().toISOString(),
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
        name: 'orderApprovedForBranch',
        handler: (data: any) => {
          if (!['admin', 'branch'].includes(user.role)) return;
          if (!data.orderId || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid orderApprovedForBranch data:`, data);
            return;
          }
          if (user.role === 'branch' && data.branchId !== user.branchId) return;

          dispatch(updateOrderStatus({ orderId: data.orderId, status: OrderStatus.Approved }));

          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: NotificationType.OrderStatusUpdated,
            displayType: 'success',
            message: t('notifications.order_approved', {
              orderNumber: data.orderNumber,
              branchName: isRtl ? data.branchName : (data.branchNameEn || data.branchName),
            }),
            messageEn: t('notifications.order_approved', {
              orderNumber: data.orderNumber,
              branchName: data.branchNameEn || data.branchName,
            }, 'en'),
            displayMessage: isRtl ? t('notifications.order_approved', {
              orderNumber: data.orderNumber,
              branchName: data.branchName,
            }) : t('notifications.order_approved', {
              orderNumber: data.orderNumber,
              branchName: data.branchNameEn || data.branchName,
            }, 'en'),
            data: {
              orderId: data.orderId,
              orderNumber: data.orderNumber,
              branchId: data.branchId,
              eventId: data.eventId || crypto.randomUUID(),
              status: OrderStatus.Approved,
            },
            read: false,
            createdAt: data.createdAt || new Date().toISOString(),
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
        handler: (data: any) => {
          if (!['admin', 'production', 'chef'].includes(user.role)) return;
          if (!data.orderId || !data.orderNumber || !Array.isArray(data.items) || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid taskAssigned data:`, data);
            return;
          }
          if (user.role === 'chef' && !data.items.some((item: any) => item.assignedTo?._id === user._id)) return;

          const mappedItems = data.items.map((item: any) => ({
            _id: item.itemId || crypto.randomUUID(),
            itemId: item.itemId || crypto.randomUUID(),
            productId: item.productId || 'unknown',
            productName: item.productName || t('products.unknown'),
            productNameEn: item.productNameEn,
            quantity: Number(item.quantity) || 1,
            unit: item.unit || 'unit',
            unitEn: item.unitEn,
            displayUnit: isRtl ? item.unit : (item.unitEn || item.unit),
            department: item.department || { _id: 'unknown', name: t('departments.unknown'), displayName: t('departments.unknown') },
            status: item.status || ItemStatus.Assigned,
            assignedTo: item.assignedTo
              ? { _id: item.assignedTo._id, username: item.assignedTo.username || t('chefs.unknown'), name: item.assignedTo.name, nameEn: item.assignedTo.nameEn, displayName: isRtl ? item.assignedTo.name : (item.assignedTo.nameEn || item.assignedTo.name), department: item.assignedTo.department }
              : undefined,
          }));

          dispatch(taskAssigned({ orderId: data.orderId, items: mappedItems }));

          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: NotificationType.TaskAssigned,
            displayType: 'info',
            message: t('notifications.task_assigned', {
              orderNumber: data.orderNumber,
              taskId: data.taskId || data.items[0]?.itemId || 'unknown',
            }),
            messageEn: t('notifications.task_assigned', {
              orderNumber: data.orderNumber,
              taskId: data.taskId || data.items[0]?.itemId || 'unknown',
            }, 'en'),
            displayMessage: isRtl ? t('notifications.task_assigned', {
              orderNumber: data.orderNumber,
              taskId: data.taskId || data.items[0]?.itemId || 'unknown',
            }) : t('notifications.task_assigned', {
              orderNumber: data.orderNumber,
              taskId: data.taskId || data.items[0]?.itemId || 'unknown',
            }, 'en'),
            data: {
              orderId: data.orderId,
              orderNumber: data.orderNumber,
              taskId: data.taskId || data.items[0]?.itemId,
              eventId: data.eventId || crypto.randomUUID(),
            },
            read: false,
            createdAt: data.createdAt || new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [200, 100, 200],
          });
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
            console.warn(`[${new Date().toISOString()}] Invalid itemStatusUpdated data:`, data);
            return;
          }
          if (user.role === 'chef' && data.chefId !== user._id) return;

          dispatch(updateItemStatus({ orderId: data.orderId, payload: { itemId: data.itemId, status: data.status } }));

          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: NotificationType.ItemStatusUpdated,
            displayType: 'info',
            message: t('notifications.item_status_updated', {
              orderNumber: data.orderNumber,
              status: isRtl ? t(`status.${data.status}`) : data.status,
            }),
            messageEn: t('notifications.item_status_updated', {
              orderNumber: data.orderNumber,
              status: data.status,
            }, 'en'),
            displayMessage: isRtl ? t('notifications.item_status_updated', {
              orderNumber: data.orderNumber,
              status: t(`status.${data.status}`),
            }) : t('notifications.item_status_updated', {
              orderNumber: data.orderNumber,
              status: data.status,
            }, 'en'),
            data: {
              orderId: data.orderId,
              orderNumber: data.orderNumber,
              taskId: data.itemId,
              status: data.status,
              eventId: data.eventId || crypto.randomUUID(),
            },
            read: false,
            createdAt: data.createdAt || new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [200, 100, 200],
          });

          if (data.status === ItemStatus.Completed) {
            try {
              const updatedOrder = await ordersAPI.getById(data.orderId);
              if (!updatedOrder || !updatedOrder._id || !Array.isArray(updatedOrder.items)) {
                console.warn(`[${new Date().toISOString()}] Failed to fetch updated order:`, data.orderId);
                return;
              }
              const allItemsCompleted = updatedOrder.items.every((item: any) => item.status === ItemStatus.Completed);
              if (allItemsCompleted && updatedOrder.status !== OrderStatus.Completed) {
                dispatch(updateOrderStatus({ orderId: data.orderId, status: OrderStatus.Completed }));
                addNotification({
                  _id: crypto.randomUUID(),
                  type: NotificationType.OrderCompleted,
                  displayType: 'success',
                  message: t('notifications.order_completed', {
                    orderNumber: data.orderNumber,
                    branchName: isRtl ? data.branchName : (data.branchNameEn || data.branchName),
                  }),
                  messageEn: t('notifications.order_completed', {
                    orderNumber: data.orderNumber,
                    branchName: data.branchNameEn || data.branchName,
                  }, 'en'),
                  displayMessage: isRtl ? t('notifications.order_completed', {
                    orderNumber: data.orderNumber,
                    branchName: data.branchName,
                  }) : t('notifications.order_completed', {
                    orderNumber: data.orderNumber,
                    branchName: data.branchNameEn || data.branchName,
                  }, 'en'),
                  data: {
                    orderId: data.orderId,
                    orderNumber: data.orderNumber,
                    branchId: data.branchId,
                    eventId: crypto.randomUUID(),
                    status: OrderStatus.Completed,
                  },
                  read: false,
                  createdAt: new Date().toISOString(),
                  sound: '/sounds/notification.mp3',
                  vibrate: [200, 100, 200],
                });
              }
            } catch (err) {
              console.error(`[${new Date().toISOString()}] Failed to fetch updated order:`, err);
            }
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
            console.warn(`[${new Date().toISOString()}] Invalid orderStatusUpdated data:`, data);
            return;
          }
          dispatch(updateOrderStatus({ orderId: data.orderId, status: data.status }));

          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: NotificationType.OrderStatusUpdated,
            displayType: 'info',
            message: t('notifications.order_status_updated', {
              orderNumber: data.orderNumber,
              status: isRtl ? t(`status.${data.status}`) : data.status,
            }),
            messageEn: t('notifications.order_status_updated', {
              orderNumber: data.orderNumber,
              status: data.status,
            }, 'en'),
            displayMessage: isRtl ? t('notifications.order_status_updated', {
              orderNumber: data.orderNumber,
              status: t(`status.${data.status}`),
            }) : t('notifications.order_status_updated', {
              orderNumber: data.orderNumber,
              status: data.status,
            }, 'en'),
            data: {
              orderId: data.orderId,
              orderNumber: data.orderNumber,
              branchId: data.branchId,
              status: data.status,
              eventId: data.eventId || crypto.randomUUID(),
            },
            read: false,
            createdAt: data.createdAt || new Date().toISOString(),
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
        name: 'orderCompletedByChefs',
        handler: async (data: any) => {
          if (!['admin', 'branch', 'production', 'chef'].includes(user.role)) return;
          if (!data.orderId || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid orderCompletedByChefs data:`, data);
            return;
          }
          const updatedOrder = await ordersAPI.getById(data.orderId);
          if (!updatedOrder || !updatedOrder._id) {
            console.warn(`[${new Date().toISOString()}] Failed to fetch updated order:`, data.orderId);
            return;
          }
          const mappedOrder: Order = {
            id: updatedOrder._id,
            orderNumber: updatedOrder.orderNumber || t('orders.unknown'),
            branchName: updatedOrder.branch?.name || t('branches.unknown'),
            branchNameEn: updatedOrder.branch?.nameEn,
            branchId: updatedOrder.branch?._id || 'unknown',
            branch: updatedOrder.branch || { _id: 'unknown', name: t('branches.unknown'), displayName: t('branches.unknown') },
            items: updatedOrder.items.map((item: any) => ({
              _id: item._id || crypto.randomUUID(),
              itemId: item._id || crypto.randomUUID(),
              productId: item.product?._id || 'unknown',
              productName: item.product?.name || t('products.unknown'),
              productNameEn: item.product?.nameEn,
              quantity: Number(item.quantity) || 1,
              price: Number(item.price) || 0,
              unit: item.unit || 'unit',
              unitEn: item.unitEn,
              displayUnit: isRtl ? item.unit : (item.unitEn || item.unit),
              department: item.product?.department || { _id: 'unknown', name: t('departments.unknown'), displayName: t('departments.unknown') },
              status: item.status || ItemStatus.Completed,
              assignedTo: item.assignedTo ? { _id: item.assignedTo._id, username: item.assignedTo.username || t('chefs.unknown'), name: item.assignedTo.name, nameEn: item.assignedTo.nameEn, displayName: isRtl ? item.assignedTo.name : (item.assignedTo.nameEn || item.assignedTo.name), department: item.assignedTo.department } : undefined,
              returnedQuantity: Number(item.returnedQuantity) || 0,
              returnReason: item.returnReason || '',
              returnReasonEn: item.returnReasonEn,
              displayReturnReason: isRtl ? item.returnReason : (item.returnReasonEn || item.returnReason),
            })),
            status: OrderStatus.Completed,
            totalAmount: Number(updatedOrder.totalAmount) || 0,
            adjustedTotal: Number(updatedOrder.adjustedTotal) || 0,
            date: formatDate(updatedOrder.createdAt || new Date(), t('language')),
            requestedDeliveryDate: formatDate(updatedOrder.requestedDeliveryDate || new Date(), t('language')),
            notes: updatedOrder.notes || '',
            notesEn: updatedOrder.notesEn,
            displayNotes: isRtl ? updatedOrder.notes : (updatedOrder.notesEn || updatedOrder.notes),
            priority: updatedOrder.priority || Priority.Medium,
            createdBy: updatedOrder.createdBy?.username || t('orders.unknown'),
            createdByName: isRtl ? updatedOrder.createdBy?.name : (updatedOrder.createdBy?.nameEn || updatedOrder.createdBy?.name || t('orders.unknown')),
            statusHistory: Array.isArray(updatedOrder.statusHistory)
              ? updatedOrder.statusHistory.map((history: any) => ({
                  status: history.status || OrderStatus.Pending,
                  changedBy: history.changedBy || t('orders.unknown'),
                  changedByName: isRtl ? history.changedByName : (history.changedByNameEn || history.changedByName || t('orders.unknown')),
                  changedAt: formatDate(history.changedAt || new Date(), t('language')),
                  notes: history.notes || '',
                  notesEn: history.notesEn,
                  displayNotes: isRtl ? history.notes : (history.notesEn || history.notes),
                }))
              : [],
            returns: Array.isArray(updatedOrder.returns)
              ? updatedOrder.returns.map((ret: any) => ({
                  returnId: ret._id || crypto.randomUUID(),
                  returnNumber: ret.returnNumber || 'unknown',
                  items: Array.isArray(ret.items)
                    ? ret.items.map((item: any) => ({
                        productId: item.product?._id || item.productId || 'unknown',
                        productName: item.product?.name || item.productName || t('products.unknown'),
                        productNameEn: item.product?.nameEn || item.productNameEn,
                        quantity: Number(item.quantity) || 0,
                        unit: item.unit || 'unit',
                        unitEn: item.unitEn,
                        displayUnit: isRtl ? item.unit : (item.unitEn || item.unit),
                        reason: item.reason || '',
                        reasonEn: item.reasonEn,
                        displayReason: isRtl ? item.reason : (item.reasonEn || item.reason),
                        status: item.status || ReturnStatus.PendingApproval,
                        reviewNotes: item.reviewNotes || '',
                        reviewNotesEn: item.reviewNotesEn,
                        displayReviewNotes: isRtl ? item.reviewNotes : (item.reviewNotesEn || item.reviewNotes),
                      }))
                    : [],
                  status: ret.status || ReturnStatus.PendingApproval,
                  reviewNotes: ret.reviewNotes || '',
                  reviewNotesEn: ret.reviewNotesEn,
                  displayReviewNotes: isRtl ? ret.reviewNotes : (ret.reviewNotesEn || ret.reviewNotes),
                  createdAt: formatDate(ret.createdAt || new Date(), t('language')),
                  createdBy: ret.createdBy ? { _id: ret.createdBy._id, username: ret.createdBy.username, name: ret.createdBy.name, nameEn: ret.createdBy.nameEn, displayName: isRtl ? ret.createdBy.name : (ret.createdBy.nameEn || ret.createdBy.name) } : { _id: 'unknown', username: t('orders.unknown'), name: t('orders.unknown'), displayName: t('orders.unknown') },
                  reviewedBy: ret.reviewedBy ? { _id: ret.reviewedBy._id, username: ret.reviewedBy.username, name: ret.reviewedBy.name, nameEn: ret.reviewedBy.nameEn, displayName: isRtl ? ret.reviewedBy.name : (ret.reviewedBy.nameEn || ret.reviewedBy.name) } : undefined,
                }))
              : [],
            approvedBy: updatedOrder.approvedBy ? { _id: updatedOrder.approvedBy._id, name: updatedOrder.approvedBy.name, nameEn: updatedOrder.approvedBy.nameEn, displayName: isRtl ? updatedOrder.approvedBy.name : (updatedOrder.approvedBy.nameEn || updatedOrder.approvedBy.name) } : undefined,
            approvedAt: updatedOrder.approvedAt,
            deliveredAt: updatedOrder.deliveredAt,
            transitStartedAt: updatedOrder.transitStartedAt,
            isRtl,
          };
          dispatch(updateOrderStatus({ orderId: data.orderId, status: OrderStatus.Completed, payload: mappedOrder }));

          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: NotificationType.OrderCompleted,
            displayType: 'success',
            message: t('notifications.order_completed', {
              orderNumber: data.orderNumber,
              branchName: isRtl ? data.branchName : (data.branchNameEn || data.branchName),
            }),
            messageEn: t('notifications.order_completed', {
              orderNumber: data.orderNumber,
              branchName: data.branchNameEn || data.branchName,
            }, 'en'),
            displayMessage: isRtl ? t('notifications.order_completed', {
              orderNumber: data.orderNumber,
              branchName: data.branchName,
            }) : t('notifications.order_completed', {
              orderNumber: data.orderNumber,
              branchName: data.branchNameEn || data.branchName,
            }, 'en'),
            data: {
              orderId: data.orderId,
              orderNumber: data.orderNumber,
              branchId: data.branchId,
              eventId: data.eventId || crypto.randomUUID(),
              status: OrderStatus.Completed,
            },
            read: false,
            createdAt: data.createdAt || new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [200, 100, 200],
          });
        },
        config: {
          type: 'UPDATE_ORDER_STATUS',
          roles: ['admin', 'branch', 'production', 'chef'],
        },
      },
      {
        name: 'orderInTransitToBranch',
        handler: async (data: any) => {
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.orderNumber || !data.branchName || !data.branchId) {
            console.warn(`[${new Date().toISOString()}] Invalid orderInTransitToBranch data:`, data);
            return;
          }
          if (user.role === 'branch' && data.branchId !== user.branchId) return;
          const updatedOrder = await ordersAPI.getById(data.orderId);
          if (!updatedOrder || !updatedOrder._id) {
            console.warn(`[${new Date().toISOString()}] Failed to fetch updated order:`, data.orderId);
            return;
          }
          const mappedOrder: Order = {
            id: updatedOrder._id,
            orderNumber: updatedOrder.orderNumber || t('orders.unknown'),
            branchName: updatedOrder.branch?.name || t('branches.unknown'),
            branchNameEn: updatedOrder.branch?.nameEn,
            branchId: updatedOrder.branch?._id || 'unknown',
            branch: updatedOrder.branch || { _id: 'unknown', name: t('branches.unknown'), displayName: t('branches.unknown') },
            items: updatedOrder.items.map((item: any) => ({
              _id: item._id || crypto.randomUUID(),
              itemId: item._id || crypto.randomUUID(),
              productId: item.product?._id || 'unknown',
              productName: item.product?.name || t('products.unknown'),
              productNameEn: item.product?.nameEn,
              quantity: Number(item.quantity) || 1,
              price: Number(item.price) || 0,
              unit: item.unit || 'unit',
              unitEn: item.unitEn,
              displayUnit: isRtl ? item.unit : (item.unitEn || item.unit),
              department: item.product?.department || { _id: 'unknown', name: t('departments.unknown'), displayName: t('departments.unknown') },
              status: item.status || ItemStatus.Completed,
              assignedTo: item.assignedTo ? { _id: item.assignedTo._id, username: item.assignedTo.username || t('chefs.unknown'), name: item.assignedTo.name, nameEn: item.assignedTo.nameEn, displayName: isRtl ? item.assignedTo.name : (item.assignedTo.nameEn || item.assignedTo.name), department: item.assignedTo.department } : undefined,
              returnedQuantity: Number(item.returnedQuantity) || 0,
              returnReason: item.returnReason || '',
              returnReasonEn: item.returnReasonEn,
              displayReturnReason: isRtl ? item.returnReason : (item.returnReasonEn || item.returnReason),
            })),
            status: OrderStatus.InTransit,
            totalAmount: Number(updatedOrder.totalAmount) || 0,
            adjustedTotal: Number(updatedOrder.adjustedTotal) || 0,
            date: formatDate(updatedOrder.createdAt || new Date(), t('language')),
            requestedDeliveryDate: formatDate(updatedOrder.requestedDeliveryDate || new Date(), t('language')),
            notes: updatedOrder.notes || '',
            notesEn: updatedOrder.notesEn,
            displayNotes: isRtl ? updatedOrder.notes : (updatedOrder.notesEn || updatedOrder.notes),
            priority: updatedOrder.priority || Priority.Medium,
            createdBy: updatedOrder.createdBy?.username || t('orders.unknown'),
            createdByName: isRtl ? updatedOrder.createdBy?.name : (updatedOrder.createdBy?.nameEn || updatedOrder.createdBy?.name || t('orders.unknown')),
            statusHistory: Array.isArray(updatedOrder.statusHistory)
              ? updatedOrder.statusHistory.map((history: any) => ({
                  status: history.status || OrderStatus.Pending,
                  changedBy: history.changedBy || t('orders.unknown'),
                  changedByName: isRtl ? history.changedByName : (history.changedByNameEn || history.changedByName || t('orders.unknown')),
                  changedAt: formatDate(history.changedAt || new Date(), t('language')),
                  notes: history.notes || '',
                  notesEn: history.notesEn,
                  displayNotes: isRtl ? history.notes : (history.notesEn || history.notes),
                }))
              : [],
            returns: Array.isArray(updatedOrder.returns)
              ? updatedOrder.returns.map((ret: any) => ({
                  returnId: ret._id || crypto.randomUUID(),
                  returnNumber: ret.returnNumber || 'unknown',
                  items: Array.isArray(ret.items)
                    ? ret.items.map((item: any) => ({
                        productId: item.product?._id || item.productId || 'unknown',
                        productName: item.product?.name || item.productName || t('products.unknown'),
                        productNameEn: item.product?.nameEn || item.productNameEn,
                        quantity: Number(item.quantity) || 0,
                        unit: item.unit || 'unit',
                        unitEn: item.unitEn,
                        displayUnit: isRtl ? item.unit : (item.unitEn || item.unit),
                        reason: item.reason || '',
                        reasonEn: item.reasonEn,
                        displayReason: isRtl ? item.reason : (item.reasonEn || item.reason),
                        status: item.status || ReturnStatus.PendingApproval,
                        reviewNotes: item.reviewNotes || '',
                        reviewNotesEn: item.reviewNotesEn,
                        displayReviewNotes: isRtl ? item.reviewNotes : (item.reviewNotesEn || item.reviewNotes),
                      }))
                    : [],
                  status: ret.status || ReturnStatus.PendingApproval,
                  reviewNotes: ret.reviewNotes || '',
                  reviewNotesEn: ret.reviewNotesEn,
                  displayReviewNotes: isRtl ? ret.reviewNotes : (ret.reviewNotesEn || ret.reviewNotes),
                  createdAt: formatDate(ret.createdAt || new Date(), t('language')),
                  createdBy: ret.createdBy ? { _id: ret.createdBy._id, username: ret.createdBy.username, name: ret.createdBy.name, nameEn: ret.createdBy.nameEn, displayName: isRtl ? ret.createdBy.name : (ret.createdBy.nameEn || ret.createdBy.name) } : { _id: 'unknown', username: t('orders.unknown'), name: t('orders.unknown'), displayName: t('orders.unknown') },
                  reviewedBy: ret.reviewedBy ? { _id: ret.reviewedBy._id, username: ret.reviewedBy.username, name: ret.reviewedBy.name, nameEn: ret.reviewedBy.nameEn, displayName: isRtl ? ret.reviewedBy.name : (ret.reviewedBy.nameEn || ret.reviewedBy.name) } : undefined,
                }))
              : [],
            approvedBy: updatedOrder.approvedBy ? { _id: updatedOrder.approvedBy._id, name: updatedOrder.approvedBy.name, nameEn: updatedOrder.approvedBy.nameEn, displayName: isRtl ? updatedOrder.approvedBy.name : (updatedOrder.approvedBy.nameEn || updatedOrder.approvedBy.name) } : undefined,
            approvedAt: updatedOrder.approvedAt,
            deliveredAt: updatedOrder.deliveredAt,
            transitStartedAt: updatedOrder.transitStartedAt,
            isRtl,
          };
          dispatch(updateOrderStatus({ orderId: data.orderId, status: OrderStatus.InTransit, payload: mappedOrder }));

          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: NotificationType.OrderStatusUpdated,
            displayType: 'info',
            message: t('notifications.order_shipped', {
              orderNumber: data.orderNumber,
              branchName: isRtl ? data.branchName : (data.branchNameEn || data.branchName),
            }),
            messageEn: t('notifications.order_shipped', {
              orderNumber: data.orderNumber,
              branchName: data.branchNameEn || data.branchName,
            }, 'en'),
            displayMessage: isRtl ? t('notifications.order_shipped', {
              orderNumber: data.orderNumber,
              branchName: data.branchName,
            }) : t('notifications.order_shipped', {
              orderNumber: data.orderNumber,
              branchName: data.branchNameEn || data.branchName,
            }, 'en'),
            data: {
              orderId: data.orderId,
              orderNumber: data.orderNumber,
              branchId: data.branchId,
              eventId: data.eventId || crypto.randomUUID(),
              status: OrderStatus.InTransit,
            },
            read: false,
            createdAt: data.createdAt || new Date().toISOString(),
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
        name: 'branchConfirmedReceipt',
        handler: async (data: any) => {
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.orderNumber || !data.branchName) {
            console.warn(`[${new Date().toISOString()}] Invalid branchConfirmedReceipt data:`, data);
            return;
          }
          if (user.role === 'branch' && data.branchId !== user.branchId) return;
          const updatedOrder = await ordersAPI.getById(data.orderId);
          if (!updatedOrder || !updatedOrder._id) {
            console.warn(`[${new Date().toISOString()}] Failed to fetch updated order:`, data.orderId);
            return;
          }
          const mappedOrder: Order = {
            id: updatedOrder._id,
            orderNumber: updatedOrder.orderNumber || t('orders.unknown'),
            branchName: updatedOrder.branch?.name || t('branches.unknown'),
            branchNameEn: updatedOrder.branch?.nameEn,
            branchId: updatedOrder.branch?._id || 'unknown',
            branch: updatedOrder.branch || { _id: 'unknown', name: t('branches.unknown'), displayName: t('branches.unknown') },
            items: updatedOrder.items.map((item: any) => ({
              _id: item._id || crypto.randomUUID(),
              itemId: item._id || crypto.randomUUID(),
              productId: item.product?._id || 'unknown',
              productName: item.product?.name || t('products.unknown'),
              productNameEn: item.product?.nameEn,
              quantity: Number(item.quantity) || 1,
              price: Number(item.price) || 0,
              unit: item.unit || 'unit',
              unitEn: item.unitEn,
              displayUnit: isRtl ? item.unit : (item.unitEn || item.unit),
              department: item.product?.department || { _id: 'unknown', name: t('departments.unknown'), displayName: t('departments.unknown') },
              status: item.status || ItemStatus.Completed,
              assignedTo: item.assignedTo ? { _id: item.assignedTo._id, username: item.assignedTo.username || t('chefs.unknown'), name: item.assignedTo.name, nameEn: item.assignedTo.nameEn, displayName: isRtl ? item.assignedTo.name : (item.assignedTo.nameEn || item.assignedTo.name), department: item.assignedTo.department } : undefined,
              returnedQuantity: Number(item.returnedQuantity) || 0,
              returnReason: item.returnReason || '',
              returnReasonEn: item.returnReasonEn,
              displayReturnReason: isRtl ? item.returnReason : (item.returnReasonEn || item.returnReason),
            })),
            status: OrderStatus.Delivered,
            totalAmount: Number(updatedOrder.totalAmount) || 0,
            adjustedTotal: Number(updatedOrder.adjustedTotal) || 0,
            date: formatDate(updatedOrder.createdAt || new Date(), t('language')),
            requestedDeliveryDate: formatDate(updatedOrder.requestedDeliveryDate || new Date(), t('language')),
            notes: updatedOrder.notes || '',
            notesEn: updatedOrder.notesEn,
            displayNotes: isRtl ? updatedOrder.notes : (updatedOrder.notesEn || updatedOrder.notes),
            priority: updatedOrder.priority || Priority.Medium,
            createdBy: updatedOrder.createdBy?.username || t('orders.unknown'),
            createdByName: isRtl ? updatedOrder.createdBy?.name : (updatedOrder.createdBy?.nameEn || updatedOrder.createdBy?.name || t('orders.unknown')),
            statusHistory: Array.isArray(updatedOrder.statusHistory)
              ? updatedOrder.statusHistory.map((history: any) => ({
                  status: history.status || OrderStatus.Pending,
                  changedBy: history.changedBy || t('orders.unknown'),
                  changedByName: isRtl ? history.changedByName : (history.changedByNameEn || history.changedByName || t('orders.unknown')),
                  changedAt: formatDate(history.changedAt || new Date(), t('language')),
                  notes: history.notes || '',
                  notesEn: history.notesEn,
                  displayNotes: isRtl ? history.notes : (history.notesEn || history.notes),
                }))
              : [],
            returns: Array.isArray(updatedOrder.returns)
              ? updatedOrder.returns.map((ret: any) => ({
                  returnId: ret._id || crypto.randomUUID(),
                  returnNumber: ret.returnNumber || 'unknown',
                  items: Array.isArray(ret.items)
                    ? ret.items.map((item: any) => ({
                        productId: item.product?._id || item.productId || 'unknown',
                        productName: item.product?.name || item.productName || t('products.unknown'),
                        productNameEn: item.product?.nameEn || item.productNameEn,
                        quantity: Number(item.quantity) || 0,
                        unit: item.unit || 'unit',
                        unitEn: item.unitEn,
                        displayUnit: isRtl ? item.unit : (item.unitEn || item.unit),
                        reason: item.reason || '',
                        reasonEn: item.reasonEn,
                        displayReason: isRtl ? item.reason : (item.reasonEn || item.reason),
                        status: item.status || ReturnStatus.PendingApproval,
                        reviewNotes: item.reviewNotes || '',
                        reviewNotesEn: item.reviewNotesEn,
                        displayReviewNotes: isRtl ? item.reviewNotes : (item.reviewNotesEn || item.reviewNotes),
                      }))
                    : [],
                  status: ret.status || ReturnStatus.PendingApproval,
                  reviewNotes: ret.reviewNotes || '',
                  reviewNotesEn: ret.reviewNotesEn,
                  displayReviewNotes: isRtl ? ret.reviewNotes : (ret.reviewNotesEn || ret.reviewNotes),
                  createdAt: formatDate(ret.createdAt || new Date(), t('language')),
                  createdBy: ret.createdBy ? { _id: ret.createdBy._id, username: ret.createdBy.username, name: ret.createdBy.name, nameEn: ret.createdBy.nameEn, displayName: isRtl ? ret.createdBy.name : (ret.createdBy.nameEn || ret.createdBy.name) } : { _id: 'unknown', username: t('orders.unknown'), name: t('orders.unknown'), displayName: t('orders.unknown') },
                  reviewedBy: ret.reviewedBy ? { _id: ret.reviewedBy._id, username: ret.reviewedBy.username, name: ret.reviewedBy.name, nameEn: ret.reviewedBy.nameEn, displayName: isRtl ? ret.reviewedBy.name : (ret.reviewedBy.nameEn || ret.reviewedBy.name) } : undefined,
                }))
              : [],
            approvedBy: updatedOrder.approvedBy ? { _id: updatedOrder.approvedBy._id, name: updatedOrder.approvedBy.name, nameEn: updatedOrder.approvedBy.nameEn, displayName: isRtl ? updatedOrder.approvedBy.name : (updatedOrder.approvedBy.nameEn || updatedOrder.approvedBy.name) } : undefined,
            approvedAt: updatedOrder.approvedAt,
            deliveredAt: updatedOrder.deliveredAt,
            transitStartedAt: updatedOrder.transitStartedAt,
            isRtl,
          };
          dispatch(updateOrderStatus({ orderId: data.orderId, status: OrderStatus.Delivered, payload: mappedOrder }));

          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: NotificationType.OrderDelivered,
            displayType: 'success',
            message: t('notifications.order_delivered', {
              orderNumber: data.orderNumber,
              branchName: isRtl ? data.branchName : (data.branchNameEn || data.branchName),
            }),
            messageEn: t('notifications.order_delivered', {
              orderNumber: data.orderNumber,
              branchName: data.branchNameEn || data.branchName,
            }, 'en'),
            displayMessage: isRtl ? t('notifications.order_delivered', {
              orderNumber: data.orderNumber,
              branchName: data.branchName,
            }) : t('notifications.order_delivered', {
              orderNumber: data.orderNumber,
              branchName: data.branchNameEn || data.branchName,
            }, 'en'),
            data: {
              orderId: data.orderId,
              orderNumber: data.orderNumber,
              branchId: data.branchId,
              eventId: data.eventId || crypto.randomUUID(),
              status: OrderStatus.Delivered,
            },
            read: false,
            createdAt: data.createdAt || new Date().toISOString(),
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
        name: 'returnStatusUpdated',
        handler: (data: any) => {
          if (!['admin', 'branch', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.returnId || !data.status || !data.orderNumber) {
            console.warn(`[${new Date().toISOString()}] Invalid returnStatusUpdated data:`, data);
            return;
          }
          dispatch(returnStatusUpdated({ orderId: data.orderId, returnId: data.returnId, status: data.status }));

          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: NotificationType.ReturnStatusUpdated,
            displayType: 'info',
            message: t('notifications.return_status_updated', {
              orderNumber: data.orderNumber,
              status: isRtl ? t(`status.${data.status}`) : data.status,
            }),
            messageEn: t('notifications.return_status_updated', {
              orderNumber: data.orderNumber,
              status: data.status,
            }, 'en'),
            displayMessage: isRtl ? t('notifications.return_status_updated', {
              orderNumber: data.orderNumber,
              status: t(`status.${data.status}`),
            }) : t('notifications.return_status_updated', {
              orderNumber: data.orderNumber,
              status: data.status,
            }, 'en'),
            data: {
              orderId: data.orderId,
              returnId: data.returnId,
              orderNumber: data.orderNumber,
              status: data.status,
              eventId: data.eventId || crypto.randomUUID(),
            },
            read: false,
            createdAt: data.createdAt || new Date().toISOString(),
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
        handler: (data: any) => {
          if (!['admin', 'production'].includes(user.role)) return;
          if (!data.orderId || !data.itemId || !data.orderNumber || !data.productName) {
            console.warn(`[${new Date().toISOString()}] Invalid missingAssignments data:`, data);
            return;
          }
          dispatch(missingAssignments({ orderId: data.orderId, itemId: data.itemId, productName: data.productName }));

          addNotification({
            _id: data.eventId || crypto.randomUUID(),
            type: NotificationType.MissingAssignments,
            displayType: 'warning',
            message: t('notifications.missing_assignments', {
              orderNumber: data.orderNumber,
              productName: data.productName,
            }),
            messageEn: t('notifications.missing_assignments', {
              orderNumber: data.orderNumber,
              productName: data.productNameEn || data.productName,
            }, 'en'),
            displayMessage: isRtl ? t('notifications.missing_assignments', {
              orderNumber: data.orderNumber,
              productName: data.productName,
            }) : t('notifications.missing_assignments', {
              orderNumber: data.orderNumber,
              productName: data.productNameEn || data.productName,
            }, 'en'),
            data: {
              orderId: data.orderId,
              orderNumber: data.orderNumber,
              productId: data.productId,
              productName: data.productName,
              eventId: data.eventId || crypto.randomUUID(),
            },
            read: false,
            createdAt: data.createdAt || new Date().toISOString(),
            sound: '/sounds/notification.mp3',
            vibrate: [200, 100, 200],
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
          dispatch(setSocketConnected(true));
          dispatch(setSocketError(null));
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
          dispatch(setSocketConnected(false));
          dispatch(setSocketError(t('socket.disconnected')));
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
          dispatch(setSocketError(`${t('socket.error')}: ${error.message}`));
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
  }, [socket, user, dispatch, stateRef, t, isRtl, isConnected, addNotification ]);
};