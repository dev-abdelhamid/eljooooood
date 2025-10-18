import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { factoryOrdersAPI, chefsAPI, productsAPI, departmentAPI } from '../services/api';
import { formatDate } from '../utils/formatDate';

const normalizeText = (text: string) => {
  return text
    .normalize('NFD')
    .replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, '')
    .replace(/أ|إ|آ|ٱ/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .trim();
};

interface Product {
  _id: string;
  name: string;
  nameEn: string;
  unit: string;
  unitEn: string;
  department: { _id: string; name: string; nameEn: string; displayName: string };
  maxStockLevel: number;
}

interface Chef {
  _id: string;
  userId: string;
  name: string;
  nameEn: string;
  displayName: string;
  department: { _id: string; name: string; nameEn: string; displayName: string };
  status: string;
}

interface FactoryOrderItem {
  _id: string;
  productId: string;
  productName: string;
  productNameEn: string;
  displayProductName: string;
  quantity: number;
  unit: string;
  unitEn: string;
  displayUnit: string;
  department: { _id: string; name: string; nameEn: string; displayName: string };
  assignedTo?: { _id: string; username: string; name: string; nameEn: string; displayName: string; department: { _id: string; name: string; nameEn: string; displayName: string } };
  status: string;
}

interface FactoryOrder {
  id: string;
  orderNumber: string;
  items: FactoryOrderItem[];
  status: string;
  date: string;
  notes: string;
  priority: string;
  createdBy: string;
  createdByRole: string;
}

interface AssignChefsForm {
  items: { itemId: string; assignedTo: string; product: string; quantity: number; unit: string }[];
}

interface CreateFormData {
  notes: string;
  items: { productId: string; quantity: number; assignedTo?: string }[];
}

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

const QuantityInput = ({
  value,
  onChange,
  onIncrement,
  onDecrement,
  max,
}: {
  value: number;
  onChange: (val: string) => void;
  onIncrement: () => void;
  onDecrement: () => void;
  max?: number;
}) => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const handleChange = (val: string) => {
    const num = parseInt(val, 10);
    if (val === '' || isNaN(num) || num < 1) {
      onChange('1');
      return;
    }
    if (max !== undefined && num > max) {
      onChange(max.toString());
      return;
    }
    onChange(val);
  };
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onDecrement}
        className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center disabled:opacity-50"
        aria-label={isRtl ? 'تقليل الكمية' : 'Decrease quantity'}
        disabled={value <= 1}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
        </svg>
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        max={max}
        min={1}
        className="w-8 h-6 text-center border border-gray-200 rounded-md text-xs focus:ring-1 focus:ring-amber-500 focus:border-transparent bg-white"
        aria-label={isRtl ? 'الكمية' : 'Quantity'}
      />
      <button
        onClick={onIncrement}
        className="w-6 h-6 bg-amber-500 hover:bg-amber-600 rounded-full flex items-center justify-center disabled:opacity-50"
        aria-label={isRtl ? 'زيادة الكمية' : 'Increase quantity'}
        disabled={max !== undefined && value >= max}
      >
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
};

const InventoryOrders: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { socket, isConnected, emit } = useSocket();
  const [orders, setOrders] = useState<FactoryOrder[]>([]);
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [departments, setDepartments] = useState<{ _id: string; displayName: string }[]>([]);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [assignFormData, setAssignFormData] = useState<AssignChefsForm>({ items: [] });
  const [createFormData, setCreateFormData] = useState<CreateFormData>({ notes: '', items: [{ productId: '', quantity: 1 }] });
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('table');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const ORDERS_PER_PAGE = { card: 12, table: 50 };

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch data
  const fetchData = async (retryCount = 0) => {
    if (!user || !['chef', 'production_manager', 'admin'].includes(user.role)) {
      setError(isRtl ? 'غير مصرح للوصول' : 'Unauthorized access');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const query: Record<string, any> = { search: debouncedSearchQuery || undefined };
      if (user.role === 'production_manager' && user.department) query.department = user.department._id;
      const [ordersResponse, chefsResponse, productsResponse, departmentsResponse] = await Promise.all([
        factoryOrdersAPI.getAll(query),
        chefsAPI.getAll(),
        productsAPI.getAll(),
        departmentAPI.getAll(),
      ]);

      // Log API responses for debugging
      console.log('Orders Response:', ordersResponse);
      console.log('Chefs Response:', chefsResponse);
      console.log('Products Response:', productsResponse);
      console.log('Departments Response:', departmentsResponse);

      // Map orders
      const ordersData = Array.isArray(ordersResponse.data) ? ordersResponse.data : [];
      setOrders(ordersData
        .filter((order: any) => order && order._id && order.orderNumber)
        .map((order: any) => ({
          id: order._id,
          orderNumber: order.orderNumber,
          items: Array.isArray(order.items)
            ? order.items.map((item: any) => ({
                _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
                productId: item.product?._id || 'unknown',
                productName: item.product?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                productNameEn: item.product?.nameEn,
                displayProductName: isRtl ? item.product?.name : item.product?.nameEn || item.product?.name,
                quantity: Number(item.quantity) || 1,
                unit: item.product?.unit || 'unit',
                unitEn: item.product?.unitEn,
                displayUnit: translateUnit(item.product?.unit || 'unit', isRtl),
                department: {
                  _id: item.product?.department?._id || 'no-department',
                  name: item.product?.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                  nameEn: item.product?.department?.nameEn,
                  displayName: isRtl
                    ? item.product?.department?.name
                    : item.product?.department?.nameEn || item.product?.department?.name,
                },
                assignedTo: item.assignedTo
                  ? {
                      _id: item.assignedTo._id,
                      username: item.assignedTo.username,
                      name: item.assignedTo.name || (isRtl ? 'غير معروف' : 'Unknown'),
                      nameEn: item.assignedTo.nameEn,
                      displayName: isRtl
                        ? item.assignedTo.name
                        : item.assignedTo.nameEn || item.assignedTo.name,
                      department: {
                        _id: item.assignedTo.department?._id || 'no-department',
                        name: item.assignedTo.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                        nameEn: item.assignedTo.department?.nameEn,
                        displayName: isRtl
                          ? item.assignedTo.department?.name
                          : item.assignedTo.department?.nameEn || item.assignedTo.department?.name,
                      },
                    }
                  : undefined,
                status: item.status || 'pending',
              }))
            : [],
          status: order.status || (order.createdBy?.role === 'chef' ? 'requested' : 'approved'),
          date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
          notes: order.notes || '',
          priority: order.priority || 'medium',
          createdBy: order.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
          createdByRole: order.createdBy?.role || 'unknown',
        })));

      // Map chefs with additional validation
      const chefsData = Array.isArray(chefsResponse.data) ? chefsResponse.data : [];
      if (chefsData.length === 0) {
        console.warn('No chefs data received from API');
      }
      const mappedChefs = chefsData
        .filter((chef: any) => chef && chef.user?._id && chef.department)
        .map((chef: any) => {
          const chefObj: Chef = {
            _id: chef._id,
            userId: chef.user._id,
            name: chef.user?.name || (isRtl ? 'غير معروف' : 'Unknown'),
            nameEn: chef.user?.nameEn || '',
            displayName: isRtl
              ? chef.user?.name || (isRtl ? 'غير معروف' : 'Unknown')
              : chef.user?.nameEn || chef.user?.name || (isRtl ? 'غير معروف' : 'Unknown'),
            department: chef.department
              ? {
                  _id: chef.department._id || 'no-department',
                  name: chef.department.name || (isRtl ? 'غير معروف' : 'Unknown'),
                  nameEn: chef.department.nameEn || '',
                  displayName: isRtl
                    ? chef.department.name || (isRtl ? 'غير معروف' : 'Unknown')
                    : chef.department.nameEn || chef.department.name || (isRtl ? 'غير معروف' : 'Unknown'),
                }
              : { _id: 'no-department', name: isRtl ? 'غير معروف' : 'Unknown', nameEn: '', displayName: isRtl ? 'غير معروف' : 'Unknown' },
            status: chef.status || 'active',
          };
          return chefObj;
        })
        .sort((a: Chef, b: Chef) => a.displayName.localeCompare(b.displayName, language));
      console.log('Mapped Chefs:', mappedChefs);
      setChefs(mappedChefs);

      // Map products
      setProducts(Array.isArray(productsResponse.data)
        ? productsResponse.data
            .filter((product: any) => product && product._id)
            .map((product: any) => ({
              _id: product._id,
              name: product.name || (isRtl ? 'غير معروف' : 'Unknown'),
              nameEn: product.nameEn || '',
              unit: product.unit || 'unit',
              unitEn: product.unitEn || '',
              department: {
                _id: product.department?._id || 'no-department',
                name: product.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                nameEn: product.department?.nameEn || '',
                displayName: isRtl
                  ? product.department?.name || (isRtl ? 'غير معروف' : 'Unknown')
                  : product.department?.nameEn || product.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
              },
              maxStockLevel: product.maxStockLevel || 1000,
            }))
            .sort((a: Product, b: Product) => {
              const nameA = isRtl ? a.name : a.nameEn || a.name;
              const nameB = isRtl ? b.name : b.nameEn || b.name;
              return nameA.localeCompare(nameB, language);
            })
        : []);

      // Map departments
      setDepartments(Array.isArray(departmentsResponse.data)
        ? departmentsResponse.data.map((d: any) => ({
            _id: d._id,
            displayName: isRtl ? d.name || (isRtl ? 'غير معروف' : 'Unknown') : d.nameEn || d.name || (isRtl ? 'غير معروف' : 'Unknown'),
          }))
        : []);

      setError('');
    } catch (err: any) {
      console.error('Fetch data error:', err.message, err);
      if (retryCount < 3) {
        console.log(`Retrying fetch data (attempt ${retryCount + 1})...`);
        setTimeout(() => fetchData(retryCount + 1), 2000);
        return;
      }
      const errorMessage = err.response?.status === 404
        ? isRtl ? 'لم يتم العثور على طلبات' : 'No orders found'
        : isRtl ? `خطأ في جلب البيانات: ${err.message}` : `Error fetching data: ${err.message}`;
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // WebSocket setup
  useEffect(() => {
    if (!user || !['chef', 'production_manager', 'admin'].includes(user.role) || !socket) {
      setError(isRtl ? 'غير مصرح للوصول' : 'Unauthorized access');
      setLoading(false);
      return;
    }
    const reconnectInterval = setInterval(() => {
      if (!isConnected && socket) {
        console.log('Attempting to reconnect WebSocket...');
        socket.connect();
      }
    }, 5000);
    socket.on('connect', () => {
      console.log('WebSocket connected');
      setError('');
    });
    socket.on('connect_error', (err) => {
      console.error('Socket connect error:', err.message);
      setError(isRtl ? 'خطأ في الاتصال' : 'Connection error');
    });
    socket.on('newFactoryOrder', (order: any) => {
      if (!order || !order._id || !order.orderNumber) return;
      const mappedOrder: FactoryOrder = {
        id: order._id,
        orderNumber: order.orderNumber,
        items: Array.isArray(order.items)
          ? order.items.map((item: any) => ({
              _id: item._id || `temp-${Math.random().toString(36).substring(2)}`,
              productId: item.product?._id || 'unknown',
              productName: item.product?.name || (isRtl ? 'غير معروف' : 'Unknown'),
              productNameEn: item.product?.nameEn || '',
              displayProductName: isRtl ? item.product?.name : item.product?.nameEn || item.product?.name,
              quantity: Number(item.quantity) || 1,
              unit: item.product?.unit || 'unit',
              unitEn: item.product?.unitEn || '',
              displayUnit: translateUnit(item.product?.unit || 'unit', isRtl),
              department: {
                _id: item.product?.department?._id || 'no-department',
                name: item.product?.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                nameEn: item.product?.department?.nameEn || '',
                displayName: isRtl
                  ? item.product?.department?.name
                  : item.product?.department?.nameEn || item.product?.department?.name,
              },
              assignedTo: item.assignedTo
                ? {
                    _id: item.assignedTo._id,
                    username: item.assignedTo.username,
                    name: item.assignedTo.name || (isRtl ? 'غير معروف' : 'Unknown'),
                    nameEn: item.assignedTo.nameEn || '',
                    displayName: isRtl
                      ? item.assignedTo.name
                      : item.assignedTo.nameEn || item.assignedTo.name,
                    department: {
                      _id: item.assignedTo.department?._id || 'no-department',
                      name: item.assignedTo.department?.name || (isRtl ? 'غير معروف' : 'Unknown'),
                      nameEn: item.assignedTo.department?.nameEn || '',
                      displayName: isRtl
                        ? item.assignedTo.department?.name
                        : item.assignedTo.department?.nameEn || item.assignedTo.department?.name,
                    },
                  }
                : undefined,
              status: item.status || 'pending',
            }))
          : [],
        status: order.status || (order.createdBy?.role === 'chef' ? 'requested' : 'approved'),
        date: formatDate(order.createdAt ? new Date(order.createdAt) : new Date(), language),
        notes: order.notes || '',
        priority: order.priority || 'medium',
        createdBy: order.createdBy?.name || (isRtl ? 'غير معروف' : 'Unknown'),
        createdByRole: order.createdBy?.role || 'unknown',
      };
      setOrders(prev => [mappedOrder, ...prev.filter(o => o.id !== mappedOrder.id)]);
    });
    socket.on('orderStatusUpdated', ({ orderId, status }: { orderId: string; status: string }) => {
      if (!orderId || !status) return;
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    });
    socket.on('itemStatusUpdated', ({ orderId, itemId, status }: { orderId: string; itemId: string; status: string }) => {
      if (!orderId || !itemId || !status) return;
      setOrders(prev => prev.map(order =>
        order.id === orderId
          ? {
              ...order,
              items: order.items.map(item =>
                item._id === itemId ? { ...item, status } : item
              ),
              status: order.items.every(i => i.status === 'completed') && order.status !== 'completed'
                ? 'completed'
                : order.status,
            }
          : order
      ));
    });
    socket.on('taskAssigned', ({ orderId, items }: { orderId: string; items: any[] }) => {
      if (!orderId || !items) return;
      setOrders(prev => prev.map(order =>
        order.id === orderId
          ? {
              ...order,
              items: order.items.map(i => {
                const assignment = items.find(a => a._id === i._id);
                return assignment
                  ? {
                      ...i,
                      assignedTo: assignment.assignedTo
                        ? {
                            _id: assignment.assignedTo._id,
                            username: assignment.assignedTo.username,
                            name: assignment.assignedTo.name || (isRtl ? 'غير معروف' : 'Unknown'),
                            nameEn: assignment.assignedTo.nameEn || '',
                            displayName: isRtl
                              ? assignment.assignedTo.name
                              : assignment.assignedTo.nameEn || assignment.assignedTo.name,
                            department: assignment.assignedTo.department
                              ? {
                                  _id: assignment.assignedTo.department._id,
                                  name: assignment.assignedTo.department.name || (isRtl ? 'غير معروف' : 'Unknown'),
                                  nameEn: assignment.assignedTo.department.nameEn || '',
                                  displayName: isRtl
                                    ? assignment.assignedTo.department.name
                                    : assignment.assignedTo.department.nameEn || assignment.assignedTo.department.name,
                                }
                              : {
                                  _id: 'no-department',
                                  name: isRtl ? 'غير معروف' : 'Unknown',
                                  nameEn: '',
                                  displayName: isRtl ? 'غير معروف' : 'Unknown',
                                },
                          }
                        : undefined,
                      status: assignment.status || i.status,
                    }
                  : i
              }),
              status: order.items.every(i => i.status === 'assigned') ? 'in_production' : order.status,
            }
          : order
      ));
    });
    return () => {
      clearInterval(reconnectInterval);
      socket.off('connect');
      socket.off('connect_error');
      socket.off('newFactoryOrder');
      socket.off('orderStatusUpdated');
      socket.off('itemStatusUpdated');
      socket.off('taskAssigned');
    };
  }, [user, socket, isConnected, isRtl, language]);

  // Fetch data on mount and when filters change
  useEffect(() => {
    fetchData();
  }, [debouncedSearchQuery, user]);

  // Validate create form
  const validateCreateForm = () => {
    const errors: Record<string, string> = {};
    const t = isRtl
      ? {
          productRequired: 'المنتج مطلوب',
          quantityRequired: 'الكمية مطلوبة',
          quantityInvalid: 'الكمية يجب أن تكون أكبر من 0',
          chefRequired: 'الشيف مطلوب',
        }
      : {
          productRequired: 'Product is required',
          quantityRequired: 'Quantity is required',
          quantityInvalid: 'Quantity must be greater than 0',
          chefRequired: 'Chef is required',
        };
    createFormData.items.forEach((item, index) => {
      if (!item.productId) {
        errors[`item_${index}_productId`] = t.productRequired;
      }
      if (!item.quantity || item.quantity < 1) {
        errors[`item_${index}_quantity`] = item.quantity === 0 ? t.quantityRequired : t.quantityInvalid;
      }
      if (['admin', 'production_manager'].includes(user.role) && !item.assignedTo) {
        errors[`item_${index}_assignedTo`] = t.chefRequired;
      }
    });
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Create order
  const createOrder = async () => {
    if (!user?.id || !validateCreateForm()) return;
    setSubmitting('create');
    try {
      const orderNumber = `ORD-${Date.now()}`;
      const isAdminOrManager = ['admin', 'production_manager'].includes(user.role);
      const initialStatus = isAdminOrManager && createFormData.items.every(i => i.assignedTo) ? 'in_production' : isAdminOrManager ? 'pending' : 'requested';
      const items = createFormData.items.map(i => ({
        product: i.productId,
        quantity: i.quantity,
        assignedTo: user.role === 'chef' ? user.id : i.assignedTo,
      }));
      const response = await factoryOrdersAPI.create({
        orderNumber,
        items,
        notes: createFormData.notes,
        priority: 'medium',
      });
      const newOrder: FactoryOrder = {
        id: response.data._id,
        orderNumber: response.data.orderNumber,
        items: response.data.items.map((item: any) => ({
          _id: item._id,
          productId: item.product._id,
          productName: item.product.name,
          productNameEn: item.product.nameEn || '',
          displayProductName: isRtl ? item.product.name : item.product.nameEn || item.product.name,
          quantity: Number(item.quantity),
          unit: item.product.unit,
          unitEn: item.product.unitEn || '',
          displayUnit: translateUnit(item.product.unit, isRtl),
          department: {
            _id: item.product.department._id,
            name: item.product.department.name,
            nameEn: item.product.department.nameEn || '',
            displayName: isRtl
              ? item.product.department.name
              : item.product.department.nameEn || item.product.department.name,
          },
          assignedTo: item.assignedTo
            ? {
                _id: item.assignedTo._id,
                username: item.assignedTo.username,
                name: item.assignedTo.name || (isRtl ? 'غير معروف' : 'Unknown'),
                nameEn: item.assignedTo.nameEn || '',
                displayName: isRtl ? item.assignedTo.name : item.assignedTo.nameEn || item.assignedTo.name,
                department: {
                  _id: item.assignedTo.department._id,
                  name: item.assignedTo.department.name,
                  nameEn: item.assignedTo.department.nameEn || '',
                  displayName: isRtl
                    ? item.assignedTo.department.name
                    : item.assignedTo.department.nameEn || item.assignedTo.department.name,
                },
              }
            : undefined,
          status: item.status || 'pending',
        })),
        status: response.data.status || initialStatus,
        date: formatDate(new Date(response.data.createdAt), language),
        notes: response.data.notes || '',
        priority: response.data.priority || 'medium',
        createdBy: user.name || (isRtl ? 'غير معروف' : 'Unknown'),
        createdByRole: user.role,
      };
      setOrders(prev => [newOrder, ...prev.filter(o => o.id !== newOrder.id)]);
      setIsCreateModalOpen(false);
      setCreateFormData({ notes: '', items: [{ productId: '', quantity: 1 }] });
      setFormErrors({});
      if (socket && isConnected) {
        emit('newFactoryOrder', newOrder);
      }
      if (isAdminOrManager && createFormData.items.some(i => !i.assignedTo)) {
        setAssignFormData({
          items: newOrder.items
            .filter(item => !item.assignedTo)
            .map(item => ({
              itemId: item._id,
              assignedTo: '',
              product: item.displayProductName,
              quantity: item.quantity,
              unit: item.displayUnit,
            })),
        });
        setIsAssignModalOpen(true);
      }
    } catch (err: any) {
      console.error('Create order error:', err.message);
      setFormErrors({ form: isRtl ? `فشل في إنشاء الطلب: ${err.message}` : `Failed to create order: ${err.message}` });
    } finally {
      setSubmitting(null);
    }
  };

  // Assign chefs
  const assignChefs = async (orderId: string) => {
    if (!user?.id || assignFormData.items.some(item => !item.assignedTo)) {
      setError(isRtl ? 'يرجى تعيين شيف لكل عنصر' : 'Please assign a chef to each item');
      return;
    }
    setSubmitting(orderId);
    try {
      await factoryOrdersAPI.assignChefs(orderId, assignFormData);
      const items = assignFormData.items.map(item => ({
        _id: item.itemId,
        assignedTo: chefs.find(chef => chef.userId === item.assignedTo) || {
          _id: item.assignedTo,
          username: 'unknown',
          name: isRtl ? 'غير معروف' : 'Unknown',
          nameEn: '',
          displayName: isRtl ? 'غير معروف' : 'Unknown',
          department: {
            _id: 'no-department',
            name: isRtl ? 'غير معروف' : 'Unknown',
            nameEn: '',
            displayName: isRtl ? 'غير معروف' : 'Unknown',
          },
        },
        status: 'assigned' as FactoryOrderItem['status'],
      }));
      setOrders(prev => prev.map(order =>
        order.id === orderId
          ? {
              ...order,
              items: order.items.map(i => {
                const assignment = items.find(a => a._id === i._id);
                return assignment
                  ? { ...i, assignedTo: assignment.assignedTo, status: assignment.status }
                  : i
              }),
              status: order.items.every(i => i.status === 'assigned') ? 'in_production' : order.status,
            }
          : order
      ));
      setIsAssignModalOpen(false);
      setAssignFormData({ items: [] });
      if (socket && isConnected) {
        emit('taskAssigned', { orderId, items });
      }
    } catch (err: any) {
      console.error('Assign chefs error:', err.message);
      setError(isRtl ? `فشل في تعيين الشيفات: ${err.message}` : `Failed to assign chefs: ${err.message}`);
    } finally {
      setSubmitting(null);
    }
  };

  // Filter and paginate orders
  const filteredOrders = orders
    .filter(order => order)
    .filter(order =>
      normalizeText(order.orderNumber || '').includes(normalizeText(debouncedSearchQuery)) ||
      normalizeText(order.notes || '').includes(normalizeText(debouncedSearchQuery)) ||
      normalizeText(order.createdBy || '').includes(normalizeText(debouncedSearchQuery)) ||
      order.items.some(item => normalizeText(item.displayProductName || '').includes(normalizeText(debouncedSearchQuery)))
    )
    .filter(order =>
      (!filterStatus || order.status === filterStatus) &&
      (!filterDepartment || order.items.some(item => item.department._id === filterDepartment)) &&
      (user?.role === 'production_manager' && user?.department
        ? order.items.some(item => item.department._id === user.department._id)
        : true) &&
      (user?.role === 'chef' ? order.items.some(item => item.assignedTo?._id === user.id) : true)
    );

  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ORDERS_PER_PAGE[viewMode],
    currentPage * ORDERS_PER_PAGE[viewMode]
  );
  const totalPages = Math.ceil(filteredOrders.length / ORDERS_PER_PAGE[viewMode]);

  // Debug: Log chefs data
  useEffect(() => {
    if (chefs.length === 0 && !loading) {
      console.warn('No chefs loaded in state:', chefs);
      setError(isRtl ? 'لم يتم تحميل الشيفات' : 'No chefs loaded');
    } else {
      console.log('Chefs loaded in state:', chefs);
    }
  }, [chefs, loading, isRtl]);

  // Render
  if (loading) {
    return <div className="text-center py-4 text-xs">{isRtl ? 'جاري التحميل...' : 'Loading...'}</div>;
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto text-center p-4 bg-red-50 rounded-lg border border-red-100">
        <p className="text-red-600 text-xs mb-2">{error}</p>
        <button
          onClick={() => fetchData()}
          className="bg-amber-500 hover:bg-amber-600 text-white rounded-md px-3 py-1 text-xs"
          aria-label={isRtl ? 'إعادة المحاولة' : 'Retry'}
        >
          {isRtl ? 'إعادة المحاولة' : 'Retry'}
        </button>
      </div>
    );
  }

  return (
    <div className={`px-3 py-4 max-w-6xl mx-auto ${isRtl ? 'dir-rtl' : ''}`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
        <div className="w-full sm:w-auto text-center sm:text-start">
          <h1 className="text-base font-semibold text-gray-900">{isRtl ? 'طلبات الإنتاج' : 'Production Orders'}</h1>
          <p className="text-xs text-gray-500 mt-1">{isRtl ? 'إدارة طلبات إنتاج المخزون' : 'Manage inventory production orders'}</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-amber-500 hover:bg-amber-600 text-white rounded-md px-3 py-1 text-xs"
        >
          {isRtl ? 'إنشاء طلب جديد' : 'Create New Order'}
        </button>
      </div>
      <div className="p-4 bg-white shadow-sm rounded-lg border border-gray-100">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <div>
            <label className={`block text-xs font-medium text-gray-600 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}>
              {isRtl ? 'بحث' : 'Search'}
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={isRtl ? 'ابحث حسب رقم الطلب أو المنتج...' : 'Search by order number or product...'}
              className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-xs p-2"
            />
          </div>
          <div>
            <label className={`block text-xs font-medium text-gray-600 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}>
              {isRtl ? 'تصفية حسب الحالة' : 'Filter by Status'}
            </label>
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
              className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-xs p-2"
            >
              <option value="">{isRtl ? 'كل الحالات' : 'All Statuses'}</option>
              <option value="requested">{isRtl ? 'مطلوب' : 'Requested'}</option>
              <option value="pending">{isRtl ? 'قيد الانتظار' : 'Pending'}</option>
              <option value="approved">{isRtl ? 'تم الموافقة' : 'Approved'}</option>
              <option value="in_production">{isRtl ? 'في الإنتاج' : 'In Production'}</option>
              <option value="completed">{isRtl ? 'مكتمل' : 'Completed'}</option>
              <option value="stocked">{isRtl ? 'مخزن' : 'Stocked'}</option>
              <option value="cancelled">{isRtl ? 'ملغى' : 'Cancelled'}</option>
            </select>
          </div>
          {['admin', 'production_manager'].includes(user.role) && (
            <div>
              <label className={`block text-xs font-medium text-gray-600 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}>
                {isRtl ? 'تصفية حسب القسم' : 'Filter by Department'}
              </label>
              <select
                value={filterDepartment}
                onChange={e => { setFilterDepartment(e.target.value); setCurrentPage(1); }}
                className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-xs p-2"
              >
                <option value="">{isRtl ? 'كل الأقسام' : 'All Departments'}</option>
                {departments.map(dept => (
                  <option key={dept._id} value={dept._id}>{dept.displayName}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={`block text-xs font-medium text-gray-600 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}>
              {isRtl ? 'عرض' : 'View'}
            </label>
            <select
              value={viewMode}
              onChange={e => { setViewMode(e.target.value as 'card' | 'table'); setCurrentPage(1); }}
              className="w-full rounded-md border-gray-200 focus:ring-amber-500 text-xs p-2"
            >
              <option value="table">{isRtl ? 'جدول' : 'Table'}</option>
              <option value="card">{isRtl ? 'بطاقات' : 'Cards'}</option>
            </select>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          {isRtl ? `عدد الطلبات: ${filteredOrders.length}` : `Orders count: ${filteredOrders.length}`}
        </div>
      </div>
      <div className="mt-4">
        {paginatedOrders.length === 0 ? (
          <div className="p-6 text-center bg-white shadow-sm rounded-lg border border-gray-100">
            <p className="text-sm font-medium text-gray-600 mb-1">{isRtl ? 'لا توجد طلبات' : 'No Orders'}</p>
            <p className="text-xs text-gray-400">
              {filterStatus || filterDepartment || debouncedSearchQuery
                ? isRtl ? 'لا توجد طلبات مطابقة' : 'No matching orders'
                : isRtl ? 'لا توجد طلبات بعد' : 'No orders yet'}
            </p>
          </div>
        ) : viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-100">
              <thead>
                <tr className="bg-gray-50">
                  <th className={`py-2 px-3 border-b text-xs ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'رقم الطلب' : 'Order Number'}</th>
                  <th className={`py-2 px-3 border-b text-xs ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'المنتجات' : 'Products'}</th>
                  <th className={`py-2 px-3 border-b text-xs ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'الحالة' : 'Status'}</th>
                  <th className={`py-2 px-3 border-b text-xs ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'إنشاء بواسطة' : 'Created By'}</th>
                  <th className={`py-2 px-3 border-b text-xs ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="py-2 px-3 border-b text-xs">{order.orderNumber}</td>
                    <td className="py-2 px-3 border-b text-xs">
                      <ul className="list-disc pr-4">
                        {order.items.map(item => (
                          <li key={item._id}>
                            {item.displayProductName} ({item.quantity} {item.displayUnit})
                            <br />
                            {isRtl ? 'الشيف: ' : 'Chef: '}
                            {item.assignedTo ? item.assignedTo.displayName : (
                              chefs.length === 0 ? (
                                <span className="text-red-600">{isRtl ? 'لا يوجد شيفات' : 'No chefs available'}</span>
                              ) : (
                                <button
                                  className="text-blue-500 hover:underline text-xs"
                                  onClick={() => {
                                    if (order.createdByRole === 'chef') {
                                      setError(isRtl ? 'الطلب مُسند تلقائيًا للشيف الذي أنشأه' : 'Order is automatically assigned to the chef who created it');
                                      return;
                                    }
                                    if (order.status !== 'approved') {
                                      setError(isRtl ? 'الطلب لم يتم الموافقة عليه' : 'Order not approved');
                                      return;
                                    }
                                    setAssignFormData({
                                      items: order.items
                                        .filter(i => !i.assignedTo)
                                        .map(i => ({
                                          itemId: i._id,
                                          assignedTo: '',
                                          product: i.displayProductName,
                                          quantity: i.quantity,
                                          unit: i.displayUnit,
                                        })),
                                    });
                                    setIsAssignModalOpen(true);
                                  }}
                                  disabled={chefs.length === 0}
                                >
                                  {isRtl ? 'تعيين شيف' : 'Assign Chef'}
                                </button>
                              )
                            )}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="py-2 px-3 border-b text-xs">
                      {isRtl
                        ? order.status === 'requested' ? 'مطلوب' :
                          order.status === 'pending' ? 'قيد الانتظار' :
                          order.status === 'approved' ? 'تم الموافقة' :
                          order.status === 'in_production' ? 'في الإنتاج' :
                          order.status === 'completed' ? 'مكتمل' :
                          order.status === 'stocked' ? 'مخزن' : 'ملغى'
                        : order.status
                      }
                    </td>
                    <td className="py-2 px-3 border-b text-xs">{order.createdBy}</td>
                    <td className="py-2 px-3 border-b text-xs">
                      {order.items.some(item => !item.assignedTo) && (
                        chefs.length === 0 ? (
                          <span className="text-red-600">{isRtl ? 'لا يوجد شيفات' : 'No chefs available'}</span>
                        ) : (
                          <button
                            className="bg-amber-500 hover:bg-amber-600 text-white rounded-md px-3 py-1 text-xs"
                            onClick={() => {
                              if (order.createdByRole === 'chef') {
                                setError(isRtl ? 'الطلب مُسند تلقائيًا للشيف الذي أنشأه' : 'Order is automatically assigned to the chef who created it');
                                return;
                              }
                              if (order.status !== 'approved') {
                                setError(isRtl ? 'الطلب لم يتم الموافقة عليه' : 'Order not approved');
                                return;
                              }
                              setAssignFormData({
                                items: order.items
                                  .filter(i => !i.assignedTo)
                                  .map(i => ({
                                    itemId: i._id,
                                    assignedTo: '',
                                    product: i.displayProductName,
                                    quantity: i.quantity,
                                    unit: i.displayUnit,
                                  })),
                              });
                              setIsAssignModalOpen(true);
                            }}
                            disabled={chefs.length === 0}
                          >
                            {isRtl ? 'تعيين شيفات' : 'Assign Chefs'}
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {paginatedOrders.map(order => (
              <div key={order.id} className="p-3 bg-white shadow-sm rounded-lg border border-gray-100">
                <h3 className="text-sm font-medium">{order.orderNumber}</h3>
                <p className="text-xs text-gray-500">{isRtl ? 'التاريخ: ' : 'Date: '}{order.date}</p>
                <p className="text-xs text-gray-500">
                  {isRtl ? 'الحالة: ' : 'Status: '}
                  {isRtl
                    ? order.status === 'requested' ? 'مطلوب' :
                      order.status === 'pending' ? 'قيد الانتظار' :
                      order.status === 'approved' ? 'تم الموافقة' :
                      order.status === 'in_production' ? 'في الإنتاج' :
                      order.status === 'completed' ? 'مكتمل' :
                      order.status === 'stocked' ? 'مخزن' : 'ملغى'
                    : order.status
                  }
                </p>
                <ul className="list-disc pr-4 mt-1 text-xs">
                  {order.items.map(item => (
                    <li key={item._id}>
                      {item.displayProductName} ({item.quantity} {item.displayUnit})
                      <br />
                      {isRtl ? 'الشيف: ' : 'Chef: '}
                      {item.assignedTo ? item.assignedTo.displayName : (
                        chefs.length === 0 ? (
                          <span className="text-red-600">{isRtl ? 'لا يوجد شيفات' : 'No chefs available'}</span>
                        ) : (
                          <button
                            className="text-blue-500 hover:underline text-xs"
                            onClick={() => {
                              if (order.createdByRole === 'chef') {
                                setError(isRtl ? 'الطلب مُسند تلقائيًا للشيف الذي أنشأه' : 'Order is automatically assigned to the chef who created it');
                                return;
                              }
                              if (order.status !== 'approved') {
                                setError(isRtl ? 'الطلب لم يتم الموافقة عليه' : 'Order not approved');
                                return;
                              }
                              setAssignFormData({
                                items: [{ itemId: item._id, assignedTo: '', product: item.displayProductName, quantity: item.quantity, unit: item.displayUnit }],
                              });
                              setIsAssignModalOpen(true);
                            }}
                            disabled={chefs.length === 0}
                          >
                            {isRtl ? 'تعيين شيف' : 'Assign Chef'}
                          </button>
                        )
                      )}
                    </li>
                  ))}
                </ul>
                {order.items.some(item => !item.assignedTo) && (
                  chefs.length === 0 ? (
                    <span className="text-red-600">{isRtl ? 'لا يوجد شيفات' : 'No chefs available'}</span>
                  ) : (
                    <button
                      className="mt-1 bg-amber-500 hover:bg-amber-600 text-white rounded-md px-3 py-1 text-xs"
                      onClick={() => {
                        if (order.createdByRole === 'chef') {
                          setError(isRtl ? 'الطلب مُسند تلقائيًا للشيف الذي أنشأه' : 'Order is automatically assigned to the chef who created it');
                          return;
                        }
                        if (order.status !== 'approved') {
                          setError(isRtl ? 'الطلب لم يتم الموافقة عليه' : 'Order not approved');
                          return;
                        }
                        setAssignFormData({
                          items: order.items
                            .filter(i => !i.assignedTo)
                            .map(i => ({
                              itemId: i._id,
                              assignedTo: '',
                              product: i.displayProductName,
                              quantity: i.quantity,
                              unit: i.displayUnit,
                            })),
                        });
                        setIsAssignModalOpen(true);
                      }}
                      disabled={chefs.length === 0}
                    >
                      {isRtl ? 'تعيين شيفات' : 'Assign Chefs'}
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        )}
        {totalPages > 1 && (
          <div className="mt-3 flex justify-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-2 py-1 rounded-md text-xs ${page === currentPage ? 'bg-amber-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
              >
                {page}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Assign Chefs Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg max-w-sm w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-base font-semibold mb-3">{isRtl ? 'تعيين شيفات' : 'Assign Chefs'}</h2>
            {assignFormData.items.length === 0 ? (
              <p className="text-red-600 text-xs mb-3">{isRtl ? 'لا توجد عناصر للتعيين' : 'No items to assign'}</p>
            ) : (
              assignFormData.items.map((item, index) => {
                const order = orders.find(o => o.items.some(i => i._id === item.itemId));
                const product = order?.items.find(i => i._id === item.itemId);
                const departmentId = product?.department._id;
                const availableChefs = chefs.filter(c => !departmentId || c.department._id === departmentId);
                return (
                  <div key={index} className="mb-3">
                    <p className="text-xs">{item.product} ({item.quantity} {item.unit})</p>
                    <select
                      value={item.assignedTo}
                      onChange={e => {
                        const newItems = [...assignFormData.items];
                        newItems[index].assignedTo = e.target.value;
                        setAssignFormData({ items: newItems });
                      }}
                      className="w-full p-2 border rounded-md mt-1 text-xs"
                      disabled={availableChefs.length === 0}
                    >
                      <option value="">{isRtl ? 'اختر شيف' : 'Select Chef'}</option>
                      {availableChefs.map(chef => (
                        <option key={chef.userId} value={chef.userId}>{chef.displayName}</option>
                      ))}
                    </select>
                    {availableChefs.length === 0 && (
                      <p className="text-red-600 text-xs mt-1">{isRtl ? 'لا يوجد شيفات متاحة لهذا القسم' : 'No chefs available for this department'}</p>
                    )}
                  </div>
                );
              })
            )}
            {error && <p className="text-red-600 text-xs mb-3">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsAssignModalOpen(false);
                  setAssignFormData({ items: [] });
                  setError('');
                }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md px-3 py-1 text-xs"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={() => assignChefs(assignFormData.items[0]?.itemId.split('-')[0])}
                disabled={submitting || assignFormData.items.some(item => !item.assignedTo) || assignFormData.items.length === 0}
                className="bg-amber-500 hover:bg-amber-600 text-white rounded-md px-3 py-1 text-xs disabled:opacity-50"
              >
                {submitting ? (isRtl ? 'جاري التعيين...' : 'Assigning...') : (isRtl ? 'تعيين' : 'Assign')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Order Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg max-w-sm w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-base font-semibold mb-3">{isRtl ? 'إنشاء طلب إنتاج جديد' : 'Create New Production Order'}</h2>
            <div className="mb-3">
              <label className={`block text-xs font-medium text-gray-600 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}>
                {isRtl ? 'ملاحظات' : 'Notes'}
              </label>
              <textarea
                value={createFormData.notes}
                onChange={e => setCreateFormData({ ...createFormData, notes: e.target.value })}
                placeholder={isRtl ? 'أدخل ملاحظات (اختياري)' : 'Enter notes (optional)'}
                className="w-full p-2 border border-gray-200 rounded-md text-xs focus:ring-1 focus:ring-amber-500"
                rows={2}
              />
            </div>
            <div>
              <label className={`block text-xs font-medium text-gray-600 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}>
                {isRtl ? 'العناصر' : 'Items'}
              </label>
              {createFormData.items.map((item, index) => (
                <div key={index} className="mb-3 p-3 bg-gray-50 rounded-md border border-gray-100">
                  <select
                    value={item.productId}
                    onChange={e => {
                      const newItems = [...createFormData.items];
                      newItems[index].productId = e.target.value;
                      setCreateFormData({ ...createFormData, items: newItems });
                      setFormErrors({ ...formErrors, [`item_${index}_productId`]: undefined });
                    }}
                    className="w-full p-2 border rounded-md mb-1 text-xs"
                  >
                    <option value="">{isRtl ? 'اختر منتج' : 'Select Product'}</option>
                    {products
                      .filter(p => user?.role === 'chef' && user.department ? p.department._id === user.department._id : true)
                      .map(p => (
                        <option key={p._id} value={p._id}>
                          {isRtl ? p.name : p.nameEn || p.name} ({translateUnit(p.unit, isRtl)})
                        </option>
                      ))}
                  </select>
                  {formErrors[`item_${index}_productId`] && (
                    <p className="text-red-600 text-xs mb-1">{formErrors[`item_${index}_productId`]}</p>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1">
                      <label className={`block text-xs font-medium text-gray-600 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}>
                        {isRtl ? 'الكمية' : 'Quantity'}
                      </label>
                      <QuantityInput
                        value={item.quantity}
                        onChange={val => {
                          const num = parseInt(val, 10);
                          const newItems = [...createFormData.items];
                          newItems[index].quantity = isNaN(num) ? 1 : num;
                          setCreateFormData({ ...createFormData, items: newItems });
                          setFormErrors({ ...formErrors, [`item_${index}_quantity`]: undefined });
                        }}
                        onIncrement={() => {
                          const newItems = [...createFormData.items];
                          newItems[index].quantity += 1;
                          setCreateFormData({ ...createFormData, items: newItems });
                        }}
                        onDecrement={() => {
                          const newItems = [...createFormData.items];
                          newItems[index].quantity = Math.max(newItems[index].quantity - 1, 1);
                          setCreateFormData({ ...createFormData, items: newItems });
                        }}
                        max={products.find(p => p._id === item.productId)?.maxStockLevel}
                      />
                      {formErrors[`item_${index}_quantity`] && (
                        <p className="text-red-600 text-xs mt-1">{formErrors[`item_${index}_quantity`]}</p>
                      )}
                    </div>
                    {['admin', 'production_manager'].includes(user.role) && item.productId && (
                      <div className="flex-1">
                        <label className={`block text-xs font-medium text-gray-600 mb-1 ${isRtl ? 'text-right' : 'text-left'}`}>
                          {isRtl ? 'تعيين شيف' : 'Assign Chef'}
                        </label>
                        <select
                          value={item.assignedTo || ''}
                          onChange={e => {
                            const newItems = [...createFormData.items];
                            newItems[index].assignedTo = e.target.value;
                            setCreateFormData({ ...createFormData, items: newItems });
                            setFormErrors({ ...formErrors, [`item_${index}_assignedTo`]: undefined });
                          }}
                          className="w-full p-2 border rounded-md text-xs"
                          disabled={chefs.filter(c => c.department._id === products.find(p => p._id === item.productId)?.department._id).length === 0}
                        >
                          <option value="">{isRtl ? 'اختر شيف' : 'Select Chef'}</option>
                          {chefs
                            .filter(c => c.department._id === products.find(p => p._id === item.productId)?.department._id)
                            .map(c => (
                              <option key={c.userId} value={c.userId}>{c.displayName}</option>
                            ))}
                        </select>
                        {formErrors[`item_${index}_assignedTo`] && (
                          <p className="text-red-600 text-xs mt-1">{formErrors[`item_${index}_assignedTo`]}</p>
                        )}
                        {chefs.filter(c => c.department._id === products.find(p => p._id === item.productId)?.department._id).length === 0 && (
                          <p className="text-red-600 text-xs mt-1">{isRtl ? 'لا يوجد شيفات متاحة لهذا القسم' : 'No chefs available for this department'}</p>
                        )}
                      </div>
                    )}
                    {createFormData.items.length > 1 && (
                      <button
                        onClick={() => {
                          const newItems = createFormData.items.filter((_, i) => i !== index);
                          setCreateFormData({ ...createFormData, items: newItems });
                        }}
                        className="p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-md self-start sm:self-end"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button
                onClick={() => setCreateFormData({ ...createFormData, items: [...createFormData.items, { productId: '', quantity: 1 }] })}
                className={`flex items-center gap-1 text-amber-500 hover:text-amber-600 text-xs ${isRtl ? 'justify-end' : 'justify-start'}`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                {isRtl ? 'إضافة عنصر' : 'Add Item'}
              </button>
            </div>
            {formErrors.form && (
              <div className="p-2 bg-red-50 border border-red-100 rounded-md text-red-600 text-xs">
                {formErrors.form}
              </div>
            )}
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setCreateFormData({ notes: '', items: [{ productId: '', quantity: 1 }] });
                  setFormErrors({});
                }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md px-3 py-1 text-xs"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={createOrder}
                disabled={submitting === 'create' || createFormData.items.length === 0}
                className="bg-amber-500 hover:bg-amber-600 text-white rounded-md px-3 py-1 text-xs disabled:opacity-50"
              >
                {submitting === 'create' ? (isRtl ? 'جارٍ الإنشاء...' : 'Creating...') : (isRtl ? 'إنشاء الطلب' : 'Create Order')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryOrders;