import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, AlertCircle, Clock, Package, Truck, CheckCircle, X, Download } from 'lucide-react';
import { ordersAPI, chefsAPI } from '../services/api';
import { Order, Chef, AssignChefsForm } from '../types';
import { Input } from '../components/UI/Input';
import { Select } from '../components/UI/Select';
import { Button } from '../components/UI/Button';
import jsPDF from 'jspdf';

// Normalize text for consistent bilingual display
const normalizeText = (text: string) => {
  return text
    .normalize('NFD')
    .replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, '')
    .replace(/أ|إ|آ|ٱ/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
};

// Translate unit for bilingual display
const translateUnit = (unit: string, isRtl: boolean) => {
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
  return translations[unit] ? (isRtl ? translations[unit].ar : translations[unit].en) : isRtl ? 'وحدة' : 'unit';
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const loadFont = async (doc: jsPDF): Promise<boolean> => {
  const fontName = 'Amiri';
  const fontUrls = {
    regular: 'https://raw.githubusercontent.com/aliftype/amiri/master/fonts/Amiri-Regular.ttf',
    bold: 'https://raw.githubusercontent.com/aliftype/amiri/master/fonts/Amiri-Bold.ttf',
  };
  try {
    const regularFontBytes = await fetch(fontUrls.regular).then((res) => res.arrayBuffer());
    doc.addFileToVFS(`${fontName}-normal.ttf`, arrayBufferToBase64(regularFontBytes));
    doc.addFont(`${fontName}-normal.ttf`, fontName, 'normal');
    const boldFontBytes = await fetch(fontUrls.bold).then((res) => res.arrayBuffer());
    doc.addFileToVFS(`${fontName}-bold.ttf`, arrayBufferToBase64(boldFontBytes));
    doc.addFont(`${fontName}-bold.ttf`, fontName, 'bold');
    doc.setFont(fontName, 'normal');
    return true;
  } catch (error) {
    console.error('Font loading error:', error);
    return false;
  }
};

const generateInvoicePDF = async (order: Order, t: (key: string, params?: any) => string, isRtl: boolean) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const fontLoaded = await loadFont(doc);
  const pageWidth = doc.internal.pageSize.width;
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  let y = margin;

  // Title
  doc.setFontSize(16);
  doc.setTextColor(245, 158, 11); // Amber color
  doc.setFont(fontLoaded ? 'Amiri' : 'helvetica', 'bold');
  doc.text(t('invoice.title', { orderNumber: order.orderNumber }), pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Date
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.setFont(fontLoaded ? 'Amiri' : 'helvetica', 'normal');
  doc.text(t('invoice.date') + ': ' + order.date, pageWidth / 2, y, { align: 'center' });
  y += 15;

  // Order Details
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.setFont(fontLoaded ? 'Amiri' : 'helvetica', 'bold');
  doc.text(t('invoice.order_details'), margin, y, { align: isRtl ? 'right' : 'left' });
  y += 8;

  doc.setFontSize(10);
  doc.setFont(fontLoaded ? 'Amiri' : 'helvetica', 'normal');
  doc.text(t('orders.order_number') + ': ' + order.orderNumber, margin, y, { align: isRtl ? 'right' : 'left' });
  y += 6;
  doc.text(t('orders.branch') + ': ' + order.branch.displayName, margin, y, { align: isRtl ? 'right' : 'left' });
  y += 6;
  doc.text(t('orders.status') + ': ' + t(`orders.${order.status}`), margin, y, { align: isRtl ? 'right' : 'left' });
  y += 6;
  doc.text(t('orders.priority') + ': ' + t(`orders.${order.priority}`), margin, y, { align: isRtl ? 'right' : 'left' });
  y += 6;
  doc.text(t('orders.total_amount') + ': ' + formatCurrency(order.totalAmount, isRtl), margin, y, { align: isRtl ? 'right' : 'left' });
  y += 6;
  doc.text(t('orders.total_quantity') + ': ' + order.items.reduce((sum, item) => sum + item.quantity, 0) + ' ' + t('orders.units'), margin, y, { align: isRtl ? 'right' : 'left' });
  y += 15;

  // Items Table
  doc.setFontSize(12);
  doc.setFont(fontLoaded ? 'Amiri' : 'helvetica', 'bold');
  doc.text(t('orders.items'), margin, y, { align: isRtl ? 'right' : 'left' });
  y += 8;

  doc.setFontSize(10);
  const tableHeaders = [t('orders.product'), t('orders.quantity'), t('orders.unit'), t('orders.price'), t('orders.status')];
  const tableBody = order.items.map(item => [
    item.displayProductName,
    item.quantity.toString(),
    translateUnit(item.unit, isRtl),
    formatCurrency(item.price, isRtl),
    t(`orders.${item.status}`),
  ]);

  autoTable(doc, {
    startY: y,
    head: [isRtl ? tableHeaders.reverse() : tableHeaders],
    body: isRtl ? tableBody.map(row => row.reverse()) : tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [245, 158, 11],
      textColor: [255, 255, 255],
      fontSize: 8,
      halign: isRtl ? 'right' : 'left',
      font: fontLoaded ? 'Amiri' : 'helvetica',
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8,
      halign: isRtl ? 'right' : 'left',
      font: fontLoaded ? 'Amiri' : 'helvetica',
      textColor: [33, 33, 33],
      lineColor: [200, 200, 200],
      fillColor: [255, 255, 255],
    },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: margin, right: margin },
    didParseCell: (hookData) => {
      if (isRtl && hookData.section === 'body') {
        hookData.cell.text = hookData.cell.text.map(text => toArabicNumerals(text));
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 15;

  // Notes
  if (order.notes) {
    doc.setFontSize(12);
    doc.setFont(fontLoaded ? 'Amiri' : 'helvetica', 'bold');
    doc.text(t('orders.notes'), margin, y, { align: isRtl ? 'right' : 'left' });
    y += 8;
    doc.setFontSize(10);
    doc.setFont(fontLoaded ? 'Amiri' : 'helvetica', 'normal');
    doc.text(order.notes, margin, y, { align: isRtl ? 'right' : 'left', maxWidth: contentWidth });
  }

  doc.save(`invoice_${order.orderNumber}.pdf`);
};

const toArabicNumerals = (text: string): string => {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return text.replace(/[0-9]/g, (digit) => arabicNumerals[parseInt(digit)]);
};

const formatCurrency = (amount: number, isRtl: boolean) => {
  return amount.toLocaleString(isRtl ? 'ar-SA' : 'en-US', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const OrderDetailsPage: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignFormData, setAssignFormData] = useState<AssignChefsForm>({ items: [] });
  const invoiceRef = useRef<HTMLDivElement>(null);

  const statusIcons = {
    pending: <Clock className="w-4 h-4" />,
    approved: <CheckCircle className="w-4 h-4" />,
    in_production: <Package className="w-4 h-4" />,
    in_transit: <Truck className="w-4 h-4" />,
    delivered: <CheckCircle className="w-4 h-4" />,
    completed: <CheckCircle className="w-4 h-4" />,
    cancelled: <AlertCircle className="w-4 h-4" />,
  };

  const formatDateTime = useCallback(
    (dateString: string | Date) => {
      const date = new Date(dateString);
      return date.toLocaleString(isRtl ? 'ar-SA' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    },
    [isRtl]
  );

  const calculateTotalQuantity = useCallback((order: Order) => {
    return order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }, []);

  const fetchOrder = useCallback(async () => {
    if (!id || !user) {
      setError(t('errors.invalid_input'));
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [orderResponse, chefsResponse] = await Promise.all([
        ordersAPI.getById(id),
        chefsAPI.getAll(),
      ]);
      const mappedOrder: Order = {
        id: orderResponse._id,
        orderNumber: orderResponse.orderNumber,
        branchId: orderResponse.branch?._id || 'unknown',
        branch: {
          _id: orderResponse.branch?._id || 'unknown',
          name: orderResponse.branch?.name || t('branches.unknown'),
          nameEn: orderResponse.branch?.nameEn,
          displayName: isRtl ? orderResponse.branch?.name : orderResponse.branch?.nameEn || orderResponse.branch?.name,
        },
        items: Array.isArray(orderResponse.items)
          ? orderResponse.items.map((item: any) => ({
              _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
              productId: item.product?._id || 'unknown',
              productName: item.product?.name || t('product.unknown'),
              productNameEn: item.product?.nameEn,
              displayProductName: isRtl ? item.product?.name : item.product?.nameEn || item.product?.name,
              quantity: Number(item.quantity) || 1,
              price: Number(item.price) || 0,
              unit: item.product?.unit || 'unit',
              unitEn: item.product?.unitEn,
              displayUnit: translateUnit(item.product?.unit || 'unit', isRtl),
              department: {
                _id: item.product?.department?._id || 'unknown',
                name: item.product?.department?.name || t('departments.unknown'),
                nameEn: item.product?.department?.nameEn,
                displayName: isRtl ? item.product?.department?.name : item.product?.department?.nameEn || item.product?.department?.name,
              },
              assignedTo: item.assignedTo ? {
                _id: item.assignedTo._id,
                username: item.assignedTo.username,
                name: item.assignedTo.name || t('orders.unknown_chef'),
                nameEn: item.assignedTo.nameEn,
                displayName: isRtl ? item.assignedTo.name : item.assignedTo.nameEn || item.assignedTo.name,
                department: item.assignedTo.department
              } : undefined,
              status: item.status || 'pending',
            }))
          : [],
        status: orderResponse.status || 'pending',
        totalAmount: Number(orderResponse.totalAmount) || 0,
        adjustedTotal: Number(orderResponse.totalAmount) || 0,
        date: formatDateTime(orderResponse.createdAt ? new Date(orderResponse.createdAt) : new Date()),
        requestedDeliveryDate: orderResponse.requestedDeliveryDate ? new Date(orderResponse.requestedDeliveryDate) : null,
        notes: orderResponse.notes || '',
        priority: orderResponse.priority || 'medium',
        createdBy: {
          _id: orderResponse.createdBy?._id || 'unknown',
          name: orderResponse.createdBy?.name || orderResponse.createdBy?.username || t('orders.unknown'),
          nameEn: orderResponse.createdBy?.nameEn,
          displayName: isRtl ? orderResponse.createdBy?.name : orderResponse.createdBy?.nameEn || orderResponse.createdBy?.name,
        },
        approvedBy: orderResponse.approvedBy ? {
          _id: orderResponse.approvedBy._id,
          name: orderResponse.approvedBy.name || orderResponse.approvedBy.username || t('orders.unknown'),
          nameEn: orderResponse.approvedBy.nameEn,
          displayName: isRtl ? orderResponse.approvedBy.name : orderResponse.approvedBy.nameEn || orderResponse.approvedBy.name,
        } : undefined,
        approvedAt: orderResponse.approvedAt ? formatDateTime(new Date(orderResponse.approvedAt)) : null,
        deliveredAt: orderResponse.deliveredAt ? formatDateTime(new Date(orderResponse.deliveredAt)) : null,
        transitStartedAt: orderResponse.transitStartedAt ? formatDateTime(new Date(orderResponse.transitStartedAt)) : null,
        statusHistory: Array.isArray(orderResponse.statusHistory)
          ? orderResponse.statusHistory.map((history: any) => ({
              status: history.status || 'pending',
              changedBy: {
                _id: history.changedBy?._id || 'unknown',
                name: history.changedBy?.name || history.changedBy?.username || t('orders.unknown'),
                nameEn: history.changedBy?.nameEn,
                displayName: isRtl ? history.changedBy?.name : history.changedBy?.nameEn || history.changedBy?.name,
              },
              changedAt: formatDateTime(history.changedAt ? new Date(history.changedAt) : new Date()),
              notes: history.notes || '',
            }))
          : [],
      };
      setOrder(mappedOrder);
      setChefs(
        chefsResponse
          .filter((chef: any) => chef && chef.user?._id)
          .map((chef: any) => ({
            _id: chef._id,
            userId: chef.user._id,
            username: chef.user.username,
            name: chef.user.name || t('orders.unknown_chef'),
            nameEn: chef.user.nameEn,
            displayName: isRtl ? chef.user.name : chef.user.nameEn || chef.user.name,
            department: chef.department ? {
              _id: chef.department._id,
              name: chef.department.name || t('departments.unknown'),
              nameEn: chef.department.nameEn,
              displayName: isRtl ? chef.department.name : chef.department.nameEn || chef.department.name,
            } : null,
            status: chef.status || 'active',
          }))
      );
      setError('');
    } catch (err: any) {
      setError(t('errors.fetch_orders') + ': ' + (err.message || t('errors.unknown')));
      toast.error(t('errors.fetch_orders'), { position: isRtl ? 'top-left' : 'top-right' });
    } finally {
      setLoading(false);
    }
  }, [id, user, t, isRtl, formatDateTime]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const playNotificationSound = useCallback(() => {
    const audio = new Audio('/sounds/notification.mp3');
    audio.play().catch(err => console.error(`[${new Date().toISOString()}] Audio playback error:`, err));
  }, []);

  useEffect(() => {
    const handleUserInteraction = () => {
      const audio = new Audio('/sounds/notification.mp3');
      audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        console.log(`[${new Date().toISOString()}] Audio context initialized`);
      }).catch(err => console.error(`[${new Date().toISOString()}] Audio context initialization failed:`, err));
      document.removeEventListener('click', handleUserInteraction);
    };
    document.addEventListener('click', handleUserInteraction, { once: true });
    return () => document.removeEventListener('click', handleUserInteraction);
  }, []);

  useEffect(() => {
    if (!socket || !order || !isConnected) return;

    const handleSocketEvents = {
      taskAssigned: ({ orderId, items }: { orderId: string; items: any[] }) => {
        if (orderId === order.id) {
          setOrder(prev => ({
            ...prev!,
            items: prev!.items.map(i => {
              const assignment = items.find(a => a._id === i._id);
              return assignment
                ? {
                    ...i,
                    assignedTo: {
                      _id: assignment.assignedTo._id,
                      username: assignment.assignedTo.username,
                      name: assignment.assignedTo.name || t('orders.unknown_chef'),
                      nameEn: assignment.assignedTo.nameEn,
                      displayName: isRtl ? assignment.assignedTo.name : assignment.assignedTo.nameEn || assignment.assignedTo.name,
                      department: assignment.assignedTo.department,
                    },
                    status: 'assigned',
                  }
                : i;
            }),
            status: prev!.items.every(i => i.status === 'assigned') ? 'in_production' : prev!.status,
          }));
          toast.info(t('socket.task_assigned', { orderId }), { position: isRtl ? 'top-left' : 'top-right' });
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          playNotificationSound();
        }
      },
      itemStatusUpdated: ({ orderId, itemId, status, productName }: { orderId: string; itemId: string; status: string; productName: string }) => {
        if (orderId === order.id) {
          setOrder(prev => ({
            ...prev!,
            items: prev!.items.map(i => (i._id === itemId ? { ...i, status: status as any } : i)),
            status: prev!.items.every(i => i.status === 'completed') ? 'completed' : prev!.status,
          }));
          toast.info(t('socket.item_status_updated', { productName, status: t(`orders.${status}`) }), {
            position: isRtl ? 'top-left' : 'top-right',
          });
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          playNotificationSound();
        }
      },
      orderStatusUpdated: ({ orderId, status, changedByUser }: { orderId: string; status: string; changedByUser: { name?: string; username: string } }) => {
        if (orderId === order.id) {
          setOrder(prev => ({
            ...prev!,
            status: status as any,
            statusHistory: [
              ...prev!.statusHistory,
              {
                status,
                changedAt: formatDateTime(new Date()),
                changedBy: changedByUser?.name || changedByUser?.username || t('orders.unknown'),
                notes: '',
              },
            ],
          }));
          toast.info(t('socket.order_status_updated', { status: t(`orders.${status}`) }), {
            position: isRtl ? 'top-left' : 'top-right',
          });
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          playNotificationSound();
        }
      },
      newNotification: ({ type, message, data }: { type: string; message: string; data: any }) => {
        if (data.orderId === order.id) {
          toast.info(message, { position: isRtl ? 'top-left' : 'top-right' });
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          playNotificationSound();
        }
      },
    };

    Object.keys(handleSocketEvents).forEach(event => socket.on(event, handleSocketEvents[event]));
    return () => {
      Object.keys(handleSocketEvents).forEach(event => socket.off(event, handleSocketEvents[event]));
    };
  }, [socket, order, t, isRtl, formatDateTime, playNotificationSound, isConnected]);

  const updateOrderStatus = useCallback(
    async (orderId: string, newStatus: Order['status']) => {
      if (!order || !validTransitions[order.status].includes(newStatus)) {
        toast.error(t('errors.invalid_transition'), { position: isRtl ? 'top-left' : 'top-right' });
        return;
      }
      setSubmitting(`order-${orderId}`);
      try {
        await ordersAPI.updateStatus(orderId, { status: newStatus });
        setOrder(prev => ({
          ...prev!,
          status: newStatus,
          statusHistory: [
            ...prev!.statusHistory,
            {
              status: newStatus,
              changedAt: formatDateTime(new Date()),
              changedBy: user?.name || user?.username || t('orders.unknown'),
              notes: '',
            },
          ],
        }));
        socket?.emit('orderStatusUpdated', {
          orderId,
          status: newStatus,
          changedByUser: { name: user?.name, username: user?.username },
          timestamp: new Date().toISOString(),
        });
        toast.success(t('orders.status_updated', { status: t(`orders.${newStatus}`) }), {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        setError(t('errors.update_order_status') + ': ' + (err.message || t('errors.unknown')));
        toast.error(t('errors.update_order_status'), { position: isRtl ? 'top-left' : 'top-right' });
      } finally {
        setSubmitting(null);
      }
    },
    [t, isRtl, socket, user, order, formatDateTime]
  );

  const updateItemStatus = useCallback(
    async (orderId: string, itemId: string, status: Order['items'][0]['status']) => {
      if (!user?.id) {
        toast.error(t('errors.no_user'), { position: isRtl ? 'top-left' : 'top-right' });
        return;
      }
      setSubmitting(`item-${itemId}`);
      try {
        await ordersAPI.updateItemStatus(orderId, itemId, { status });
        setOrder(prev => ({
          ...prev!,
          items: prev!.items.map(i => (i._id === itemId ? { ...i, status } : i)),
          status: prev!.items.every(i => i.status === 'completed') ? 'completed' : prev!.status,
        }));
        socket?.emit('itemStatusUpdated', {
          orderId,
          itemId,
          status,
          productName: order!.items.find(i => i._id === itemId)?.displayProductName,
          timestamp: new Date().toISOString(),
        });
        toast.success(t('orders.item_status_updated', { status: t(`orders.${status}`) }), {
          position: isRtl ? 'top-left' : 'top-right',
        });
      } catch (err: any) {
        setError(t('errors.update_item_status') + ': ' + (err.message || t('errors.unknown')));
        toast.error(t('errors.update_item_status'), { position: isRtl ? 'top-left' : 'top-right' });
      } finally {
        setSubmitting(null);
      }
    },
    [t, isRtl, socket, user, order]
  );

  const openAssignModal = useCallback(
    (order: Order) => {
      if (order.status !== 'approved') {
        toast.error(t('errors.order_not_approved'), { position: isRtl ? 'top-left' : 'top-right' });
        return;
      }
      setAssignFormData({
        items: order.items
          .filter(item => !item.assignedTo)
          .map(item => ({
            itemId: item._id,
            assignedTo: '',
            product: item.displayProductName,
            quantity: item.quantity,
            unit: translateUnit(item.unit, isRtl),
          })),
      });
      setIsAssignModalOpen(true);
    },
    [t, isRtl]
  );

  const assignChefs = useCallback(
    async (orderId: string) => {
      if (!user?.id || assignFormData.items.some(item => !item.assignedTo)) {
        toast.error(t('orders.no_chefs_selected'), { position: isRtl ? 'top-left' : 'top-right' });
        return;
      }
      setSubmitting(`order-${orderId}`);
      try {
        await ordersAPI.assignChef(orderId, { items: assignFormData.items });
        setOrder(prev => ({
          ...prev!,
          items: prev!.items.map(i => {
            const assignment = assignFormData.items.find(a => a.itemId === i._id);
            return assignment
              ? {
                  ...i,
                  assignedTo: chefs.find(c => c.userId === assignment.assignedTo),
                  status: 'assigned',
                }
              : i;
          }),
          status: prev!.items.every(i => i.status === 'assigned') ? 'in_production' : prev!.status,
        }));
        socket?.emit('taskAssigned', {
          orderId,
          items: assignFormData.items.map(item => ({
            _id: item.itemId,
            assignedTo: chefs.find(c => c.userId === item.assignedTo),
            status: 'assigned',
            timestamp: new Date().toISOString(),
          })),
        });
        setIsAssignModalOpen(false);
        setAssignFormData({ items: [] });
        toast.success(t('orders.chefs_assigned'), { position: isRtl ? 'top-left' : 'top-right' });
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        playNotificationSound();
      } catch (err: any) {
        setError(t('errors.assign_chef') + ': ' + (err.message || t('errors.unknown')));
        toast.error(t('errors.assign_chef'), { position: isRtl ? 'top-left' : 'top-right' });
      } finally {
        setSubmitting(null);
      }
    },
    [t, isRtl, socket, user, chefs, assignFormData, playNotificationSound]
  );

  const exportInvoice = useCallback(async () => {
    if (!order) return;
    setSubmitting(`export-${order.id}`);
    try {
      await generateInvoicePDF(order, t, isRtl);
      toast.success(t('invoice.export_success'), { position: isRtl ? 'top-left' : 'top-right' });
    } catch (err: any) {
      setError(t('errors.pdf_generation') + ': ' + (err.message || t('errors.unknown')));
      toast.error(t('errors.pdf_generation'), { position: isRtl ? 'top-left' : 'top-right' });
    } finally {
      setSubmitting(null);
    }
  }, [order, t, isRtl]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-amber-600"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen flex items-center justify-center bg-gray-50"
      >
        <div className="bg-white p-4 rounded-lg shadow-md max-w-md text-center">
          <AlertCircle className="w-6 h-6 text-red-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-red-600">{error || t('errors.order_not_found')}</p>
          <Button
            onClick={fetchOrder}
            className="mt-3 bg-amber-600 text-white hover:bg-amber-700 rounded-full px-3 py-1 text-xs"
          >
            {t('common.retry')}
          </Button>
          <Button
            onClick={() => navigate('/orders')}
            className="mt-2 bg-gray-200 text-gray-800 hover:bg-gray-300 rounded-full px-3 py-1 text-xs"
          >
            {t('common.back')}
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 font-sans text-xs leading-tight ${isRtl ? 'rtl' : 'ltr'}`}>
      <div className="max-w-6xl mx-auto px-2 py-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex flex-col sm:flex-row justify-between items-center mb-4 ${isRtl ? 'flex-row-reverse' : ''}`}
        >
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate('/orders')}
              className="p-1 bg-amber-600 text-white hover:bg-amber-700 rounded-full"
              aria-label={t('common.back')}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-lg font-bold text-gray-800">
              {t('orders.order_details', { orderNumber: order.orderNumber })}
            </h1>
          </div>
          <Button
            onClick={exportInvoice}
            disabled={submitting === `export-${order.id}`}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-white text-xs ${
              submitting === `export-${order.id}` ? 'bg-gray-400 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-700'
            }`}
            aria-label={t('invoice.export')}
          >
            <Download className="w-4 h-4" />
            {t('invoice.export')}
          </Button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <OrderCard
              order={order}
              updateOrderStatus={updateOrderStatus}
              updateItemStatus={updateItemStatus}
              openAssignModal={openAssignModal}
              submitting={submitting}
              isRtl={isRtl}
              t={t}
              user={user}
            />
          </div>
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-4">
              <h2 className="text-sm font-semibold mb-3">{t('orders.status_history')}</h2>
              <div className="relative">
                <div className="absolute h-full w-0.5 bg-gray-200 left-3 top-0"></div>
                {order.statusHistory?.map((history, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: isRtl ? 10 : -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="mb-3 relative"
                  >
                    <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <div className="w-5 h-5 bg-amber-600 rounded-full flex items-center justify-center text-white z-10">
                        {statusIcons[history.status as keyof typeof statusIcons] || <Clock className="w-3 h-3" />}
                      </div>
                      <div>
                        <p className="font-medium text-xs">{t(`orders.${history.status}`)}</p>
                        <p className="text-xs text-gray-600">{history.changedAt}</p>
                        <p className="text-xs text-gray-500">{t('orders.changed_by')}: {normalizeText(history.changedBy.displayName)}</p>
                        {history.notes && <p className="text-xs text-gray-500 mt-1">{t('orders.notes')}: {normalizeText(history.notes)}</p>}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="hidden">
          <div ref={invoiceRef}>
            <Invoice order={order} t={t} isRtl={isRtl} />
          </div>
        </div>

        <AssignChefsModal
          isOpen={isAssignModalOpen}
          onClose={() => {
            setIsAssignModalOpen(false);
            setAssignFormData({ items: [] });
          }}
          order={order}
          assignFormData={assignFormData}
          setAssignFormData={setAssignFormData}
          chefs={chefs}
          assignChefs={assignChefs}
          submitting={submitting}
          isRtl={isRtl}
          t={t}
        />
      </div>
    </div>
  );
};

interface OrderCardProps {
  order: Order;
  updateOrderStatus: (orderId: string, newStatus: Order['status']) => void;
  updateItemStatus: (orderId: string, itemId: string, status: Order['items'][0]['status']) => void;
  openAssignModal: (order: Order) => void;
  submitting: string | null;
  isRtl: boolean;
  t: (key: string, params?: any) => string;
  user: any;
}

const OrderCard: React.FC<OrderCardProps> = ({
  order,
  updateOrderStatus,
  updateItemStatus,
  openAssignModal,
  submitting,
  isRtl,
  t,
  user,
}) => {
  const validTransitions: Record<Order['status'], Order['status'][]> = {
    pending: ['approved', 'cancelled'],
    approved: ['in_production', 'cancelled'],
    in_production: ['completed', 'cancelled'],
    completed: ['in_transit'],
    in_transit: ['delivered'],
    delivered: [],
    cancelled: [],
  };

  const validItemTransitions: Record<Order['items'][0]['status'], Order['items'][0]['status'][]> = {
    pending: ['assigned'],
    assigned: ['completed'],
    completed: [],
  };

  const formatCurrency = useCallback(
    (amount: number) => {
      return amount.toLocaleString(isRtl ? 'ar-SA' : 'en-US', {
        style: 'currency',
        currency: 'SAR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    },
    [isRtl]
  );

  const calculateTotalQuantity = useCallback(() => {
    return order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }, [order]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-lg shadow-md p-3 sm:p-4 mb-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold">{t('orders.order_number')}: {order.orderNumber}</h2>
          <p className="text-xs text-gray-600">{t('orders.branch')}: {normalizeText(order.branch.displayName)}</p>
          <p className="text-xs text-gray-600">{t('orders.date')}: {order.date}</p>
          <p className="text-xs text-gray-600">{t('orders.created_by')}: {normalizeText(order.createdBy.displayName)}</p>
        </div>
        <div className={`text-${isRtl ? 'left' : 'right'}`}>
          <p className="text-xs text-gray-600">{t('orders.priority')}: {t(`orders.${order.priority}`)}</p>
          <p className="text-xs text-gray-600">{t('orders.total_amount')}: {formatCurrency(order.totalAmount)}</p>
          <p className="text-xs text-gray-600">{t('orders.total_quantity')}: {calculateTotalQuantity()} {t('orders.units')}</p>
          <p className={`text-sm font-semibold ${order.status === 'cancelled' ? 'text-red-600' : 'text-green-600'}`}>
            {t('orders.status')}: {t(`orders.${order.status}`)}
          </p>
        </div>
      </div>

      <h3 className="text-sm font-semibold mb-3">{t('orders.items')}</h3>
      <div className="space-y-3">
        {order.items.map(item => (
          <motion.div
            key={item._id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-b pb-3 last:border-b-0"
          >
            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <div>
                <p className="font-medium text-xs">{normalizeText(item.displayProductName)}</p>
                <p className="text-xs text-gray-600">{t('orders.quantity')}: {item.quantity} {translateUnit(item.unit, isRtl)}</p>
                <p className="text-xs text-gray-600">{t('orders.department')}: {normalizeText(item.department.displayName)}</p>
                {item.assignedTo && (
                  <p className="text-xs text-gray-600">{t('orders.assigned_to')}: {normalizeText(item.assignedTo.displayName)}</p>
                )}
                <p className={`text-xs font-medium ${item.status === 'completed' ? 'text-green-600' : 'text-blue-600'}`}>
                  {t('orders.status')}: {t(`orders.${item.status}`)}
                </p>
              </div>
              {(user.role === 'production' || user.role === 'admin') && validItemTransitions[item.status]?.length > 0 && (
                <div className="flex gap-2 items-start">
                  {validItemTransitions[item.status].map(status => (
                    <Button
                      key={status}
                      onClick={() => updateItemStatus(order.id, item._id, status)}
                      disabled={submitting === `item-${item._id}`}
                      className={`px-2 py-1 rounded-full text-xs text-white ${
                        submitting === `item-${item._id}` ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                      aria-label={t(`orders.${status}`)}
                    >
                      {submitting === `item-${item._id}` ? t('common.loading') : t(`orders.${status}`)}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {order.notes && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">{t('orders.notes')}</h3>
          <p className="text-xs text-gray-600">{normalizeText(order.notes)}</p>
        </div>
      )}

      {(user.role === 'production' || user.role === 'admin') && validTransitions[order.status].length > 0 && (
        <div className="mt-4 flex gap-2 flex-wrap">
          {validTransitions[order.status].map(status => (
            <Button
              key={status}
              onClick={() => updateOrderStatus(order.id, status)}
              disabled={submitting === `order-${order.id}`}
              className={`px-3 py-1.5 rounded-full text-xs text-white ${
                submitting === `order-${order.id}` ? 'bg-gray-400' : status === 'in_transit' ? 'bg-blue-300 hover:bg-blue-400' : 'bg-amber-600 hover:bg-amber-700'
              }`}
              aria-label={t(`orders.${status}`)}
            >
              {submitting === `order-${order.id}` ? t('common.loading') : t(`orders.${status}`)}
            </Button>
          ))}
          {order.status === 'approved' && order.items.some(item => !item.assignedTo) && (
            <Button
              onClick={() => openAssignModal(order)}
              disabled={submitting === `order-${order.id}`}
              className={`px-3 py-1.5 rounded-full text-xs text-white ${
                submitting === `order-${order.id}` ? 'bg-gray-400' : 'bg-purple-300 hover:bg-purple-400'
              }`}
              aria-label={t('orders.assign')}
            >
              {submitting === `order-${order.id}` ? t('common.loading') : t('orders.assign')}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
};

interface AssignChefsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  assignFormData: AssignChefsForm;
  setAssignFormData: React.Dispatch<React.SetStateAction<AssignChefsForm>>;
  chefs: Chef[];
  assignChefs: (orderId: string) => void;
  submitting: string | null;
  isRtl: boolean;
  t: (key: string, params?: any) => string;
}

const AssignChefsModal: React.FC<AssignChefsModalProps> = ({
  isOpen,
  onClose,
  order,
  assignFormData,
  setAssignFormData,
  chefs,
  assignChefs,
  submitting,
  isRtl,
  t,
}) => {
  const handleAssignChange = useCallback(
    (itemId: string, value: string) => {
      setAssignFormData(prev => ({
        items: prev.items.map(item =>
          item.itemId === itemId ? { ...item, assignedTo: value } : item
        ),
      }));
    },
    []
  );

  return (
    <AnimatePresence>
      {isOpen && order && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-chefs-modal-title"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-lg"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 id="assign-chefs-modal-title" className="text-xl font-semibold">{t('orders.assign_chefs')}</h2>
              <Button
                onClick={onClose}
                className="p-2 bg-gray-200 text-gray-900 hover:bg-gray-300 rounded-full"
                aria-label={t('common.close')}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            {assignFormData.items.map(item => {
              const departmentId = order.items.find(i => i._id === item.itemId)?.department._id;
              const availableChefs = chefs.filter(c => c.department?._id === departmentId);
              return (
                <div key={item.itemId} className="mb-4">
                  <p className="font-medium">{item.product}</p>
                  <p className="text-sm text-gray-600">{t('orders.quantity')}: {item.quantity} {item.unit}</p>
                  <Select
                    value={item.assignedTo}
                    onChange={(e) => handleAssignChange(item.itemId, e.target.value)}
                    className="w-full mt-1.5 p-1.5 border rounded-md text-xs"
                    aria-label={t('orders.select_chef')}
                  >
                    <option value="">{t('orders.select_chef')}</option>
                    {availableChefs.map(chef => (
                      <option key={chef._id} value={chef.userId}>
                        {chef.displayName}
                      </option>
                    ))}
                  </Select>
                </div>
              );
            })}
            <div className="flex justify-end gap-4 mt-6">
              <Button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 text-gray-900 hover:bg-gray-300 rounded-full"
                aria-label={t('common.cancel')}
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => assignChefs(order.id)}
                disabled={submitting === `order-${order.id}`}
                className={`px-4 py-2 rounded-full text-white ${
                  submitting === `order-${order.id}` ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
                }`}
                aria-label={t('orders.assign')}
              >
                {submitting === `order-${order.id}` ? t('common.loading') : t('orders.assign')}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OrderDetailsPage;